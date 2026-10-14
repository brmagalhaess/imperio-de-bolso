## Estado do jogador recebido do servidor (autoload "GameState").
## Contagens regressivas usam o relógio monotônico do aparelho a partir do
## `secondsRemaining` do servidor — o relógio do sistema nunca é consultado.
extends Node

signal state_changed
signal busy_changed(busy: bool)
signal notice(text: String)
signal connection_failed(text: String)
## Itens coletados [{slug, amount}] após uma coleta bem-sucedida (para animações).
signal collected(items: Array)
## Volta a um mapa depois de um tempo fora: os ajudantes dele produziram `total`.
signal offline_summary(district: String, total: String, elapsed_seconds: int, capped: bool,
		cap_seconds: int)
## Conexão caiu (tentando de novo) / voltou.
signal connection_changed(online: bool)
## Missões do dia / conquistas atualizadas (para selos e telas abertas).
signal missions_changed
signal achievements_changed

## Sinal de presença (o servidor considera "fora do mapa" após 45 s sem sinal).
const PRESENCE_INTERVAL := 15.0
const RECONNECT_INTERVAL := 5.0
## Abaixo disso não mostra o resumo offline (foi só uma pausa curta).
const OFFLINE_SUMMARY_MIN_SECONDS := 60

const MESSAGES := {
	"INSUFFICIENT_FUNDS": "Moedas insuficientes.",
	"PRODUCTION_NOT_READY": "A produção ainda não terminou.",
	"NOTHING_TO_COLLECT": "Nada pronto para coletar.",
	"BUSINESS_ALREADY_OWNED": "Você já tem este negócio.",
	"BUSINESS_NOT_OWNED": "Compre o negócio primeiro.",
	"MAX_LEVEL_REACHED": "Nível máximo atingido.",
	"NETWORK_ERROR": "Sem conexão com o servidor.",
	"UNAUTHORIZED": "Sessão expirada. Tentando reconectar…",
	"COMING_SOON": "Em breve!",
	"DISTRICT_LOCKED": "Complete o mapa anterior para abrir este.",
	"MANAGER_ACTIVE": "Este negócio está produzindo sozinho.",
	"MANAGER_ALREADY_HIRED": "Este negócio já tem ajudante.",
	"MISSION_NOT_COMPLETED": "Termine a missão para resgatar.",
	"MISSION_ALREADY_CLAIMED": "Prêmio já resgatado.",
	"MISSION_NOT_FOUND": "Essa missão expirou. Veja as de hoje!",
	"ACHIEVEMENT_LOCKED": "Conquista ainda não alcançada.",
	"ACHIEVEMENT_ALREADY_CLAIMED": "Prêmio já resgatado.",
	"AD_DAILY_LIMIT": "Você já assistiu o máximo de anúncios hoje.",
	"AD_NOT_AVAILABLE": "Esse bônus não está mais disponível.",
	"AD_NOT_VERIFIED": "O anúncio não foi confirmado. Tente de novo.",
	"AD_ALREADY_CLAIMED": "Prêmio já resgatado.",
	"NOTHING_TO_BOOST": "Construa um negócio neste mapa primeiro.",
	"STORE_NOT_CONFIGURED": "Compras ainda não disponíveis nesta versão.",
	"MOCK_DISABLED": "Compras de teste desligadas.",
	"PURCHASE_INVALID": "Não foi possível confirmar a compra.",
	"VIP_REQUIRED": "Benefício exclusivo do Passe VIP.",
	"VIP_DAILY_CLAIMED": "Você já resgatou os diamantes de hoje.",
	"NAME_INVALID": "Use de 3 a 20 letras, números, espaço, ponto, hífen ou _.",
	"NAME_NOT_ALLOWED": "Esse nome não é permitido.",
	"NAME_TAKEN": "Esse nome já está em uso.",
	"NAME_ALREADY_CHANGED": "Você já trocou de nome uma vez.",
	"VALIDATION_ERROR": "Dados inválidos. Confira e tente de novo.",
}

var state: Dictionary = {}
## {day, resetsAt, missions:[...]} do servidor.
var missions: Dictionary = {}
var achievements: Array = []
## Catálogo da Loja ({sandbox, items, entitlements}).
var catalog: Dictionary = {}
var loaded := false
var busy := false
var online := true
## Mapa aberto agora (praia/cidade/porto/centro) — define onde a produção é manual.
var current_district := "praia"
var _received_at_ms := 0
## Moedas tocadas aguardando a confirmação do servidor (coleta rápida).
var _collecting := {}
var _presence_timer: Timer
var _reconnect_timer: Timer


func _ready() -> void:
	_presence_timer = Timer.new()
	_presence_timer.wait_time = PRESENCE_INTERVAL
	_presence_timer.timeout.connect(func():
		if not busy:
			enter_district(current_district, false))
	add_child(_presence_timer)
	_reconnect_timer = Timer.new()
	_reconnect_timer.wait_time = RECONNECT_INTERVAL
	_reconnect_timer.timeout.connect(_try_reconnect)
	add_child(_reconnect_timer)


func boot() -> bool:
	_set_busy(true)
	var auth := await Api.authenticate()
	if not auth.ok:
		_set_busy(false)
		connection_failed.emit(message_for(auth.error_code))
		return false
	var res := await Api.get_state()
	_set_busy(false)
	if not res.ok:
		connection_failed.emit(message_for(res.error_code))
		return false
	_apply_state(res.data)
	_presence_timer.start()
	await enter_district(current_district, true)
	refresh_missions()
	refresh_achievements()
	refresh_catalog()  # Loja abre já preenchida
	return true


func refresh() -> void:
	var res := await Api.get_state()
	if res.ok:
		_apply_state(res.data)
		_set_online(true)
	elif res.network_error:
		_set_online(false)


## Ao voltar do segundo plano: o servidor paga o AFK do mapa aberto (com resumo).
func resume() -> void:
	await enter_district(current_district, true)


## Avisa o servidor do mapa aberto; ao entrar num mapa recebe o AFK dos ajudantes dele.
## `show_summary` mostra "Bem-vindo de volta" se ficou fora ≥ 1 min e houve ganho.
func enter_district(district: String, show_summary: bool) -> void:
	current_district = district
	var res := await Api.presence(district)
	if not res.ok:
		if res.network_error:
			_set_online(false)
		return
	_set_online(true)
	_apply_state(res.data.state)
	if not res.data.settled.is_empty():
		collected.emit(res.data.settled)
		refresh_missions()
	if show_summary and int(res.data.elapsedSeconds) >= OFFLINE_SUMMARY_MIN_SECONDS \
			and str(res.data.total) != "0":
		offline_summary.emit(district, str(res.data.total), int(res.data.elapsedSeconds),
				bool(res.data.capped), int(res.data.capSeconds))


## AFK acumulado (ainda não pago) dos ajudantes de um mapa.
func pending_in(district: String) -> int:
	var total := 0
	for b in businesses():
		if b.get("district", "") == district and b.get("automatic", false):
			total += str(b.get("pendingAmount", "0")).to_int()
	return total


func auto_collect() -> bool:
	return bool(state.get("player", {}).get("autoCollect", false))


func has_managers() -> bool:
	for b in businesses():
		if b.get("managed", false):
			return true
	return false


func hire_manager(slug: String) -> bool:
	return await _optimistic(Api.hire_manager.bind(slug), _predict_hire.bind(slug), "hire")


func refresh_missions() -> void:
	var res := await Api.missions()
	if res.ok:
		missions = res.data
		missions_changed.emit()


func refresh_achievements() -> void:
	var res := await Api.achievements()
	if res.ok:
		achievements = res.data.achievements
		achievements_changed.emit()


func claim_mission(mission_id: String) -> bool:
	if busy:
		return false
	_set_busy(true)
	var res := await Api.claim_mission(mission_id)
	_set_busy(false)
	if not res.ok:
		_fail(res.error_code)
		refresh_missions()
		return false
	missions.missions = res.data.missions
	_apply_state(res.data.state)
	Audio.play("reward")
	missions_changed.emit()
	return true


func claim_achievement(achievement_id: String) -> bool:
	if busy:
		return false
	_set_busy(true)
	var res := await Api.claim_achievement(achievement_id)
	_set_busy(false)
	if not res.ok:
		_fail(res.error_code)
		refresh_achievements()
		return false
	achievements = res.data.achievements
	_apply_state(res.data.state)
	Audio.play("reward")
	achievements_changed.emit()
	return true


## Quantos prêmios esperam resgate (selo nos botões).
func claimable_missions() -> int:
	return missions.get("missions", []).filter(func(m): return m.completed and not m.claimed).size()


func claimable_achievements() -> int:
	return achievements.filter(func(a): return a.unlocked and not a.claimed).size()


func refresh_catalog() -> void:
	var res := await Api.store_catalog(current_district)
	if res.ok:
		catalog = res.data


func store_item(item_id: String) -> Dictionary:
	for i in catalog.get("items", []):
		if i.id == item_id:
			return i
	return {}


func vip_until() -> Variant:
	return state.get("player", {}).get("vipUntil")


func auto_collect_until() -> Variant:
	return state.get("player", {}).get("autoCollectUntil")


## Compra com diamantes (auto-coleta, turbo). Devolve a resposta (moedas do turbo etc.).
func buy_with_gems(item_id: String) -> Dictionary:
	if busy:
		return {}
	_set_busy(true)
	var res := await Api.store_buy(item_id, current_district)
	_set_busy(false)
	if not res.ok:
		_fail(res.error_code)
		return {}
	_apply_state(res.data.state)
	Audio.play("bonus")
	return res.data


## Compra de TESTE (modo sandbox): nada é cobrado; o servidor registra como loja "mock".
func buy_sandbox(product_id: String) -> bool:
	if busy:
		return false
	_set_busy(true)
	var token := "mock-" + Api.new_idempotency_key()
	var res := await Api.verify_purchase("mock", product_id, token)
	_set_busy(false)
	if not res.ok:
		_fail(res.error_code)
		return false
	_apply_state(res.data.state)
	Audio.play("bonus")
	return true


## Recompensa diária do VIP (diamantes).
func claim_vip_daily() -> bool:
	if busy:
		return false
	_set_busy(true)
	var res := await Api.vip_daily()
	_set_busy(false)
	if not res.ok:
		_fail(res.error_code)
		return false
	_apply_state(res.data.state)
	Audio.play("reward")
	await refresh_catalog()
	return true


## Troca de nome (uma vez). Devolve true se o servidor aceitou.
func change_name(display_name: String) -> bool:
	if busy:
		return false
	_set_busy(true)
	var res := await Api.change_name(display_name)
	_set_busy(false)
	if not res.ok:
		_fail(res.error_code)
		return false
	_apply_state(res.data)
	return true


## Exclusão de conta: o servidor apaga tudo e o jogo recomeça do zero com uma conta nova.
func delete_account() -> bool:
	if busy:
		return false
	_set_busy(true)
	var res := await Api.delete_account()
	_set_busy(false)
	if not res.ok:
		_fail(res.error_code)
		return false
	_presence_timer.stop()
	_reconnect_timer.stop()
	state = {}
	missions = {}
	achievements = []
	catalog = {}
	loaded = false
	current_district = "praia"
	get_tree().reload_current_scene()
	return true


## Erro do servidor: aviso na tela + som de erro (falta de rede não "apita").
func _fail(error_code: String) -> void:
	notice.emit(message_for(error_code))
	if error_code != "NETWORK_ERROR":
		Audio.play("error")


func gems() -> String:
	return str(state.get("wallet", {}).get("gems", "0"))


## Evento de interface para analytics (sem dados pessoais; envio em segundo plano).
func track(event_name: String, props := {}) -> void:
	if loaded:
		Api.send_events([{"name": event_name, "props": props}])


func complete_tutorial() -> void:
	var res := await Api.complete_tutorial()
	if res.ok:
		_apply_state(res.data)


func tutorial_completed() -> bool:
	return bool(state.get("player", {}).get("tutorialCompleted", true))


func purchase(slug: String) -> bool:
	return await _optimistic(Api.purchase.bind(slug), _predict_purchase.bind(slug), "buy")


func upgrade(slug: String) -> bool:
	return await _optimistic(Api.upgrade.bind(slug), _predict_upgrade.bind(slug), "upgrade")


func collect(slug: String) -> bool:
	return await _run(Api.collect.bind(slug))


# --- Resposta na hora (pedido do titular: pela internet cada ação levava ~0,5 s) -----------
# O jogo aplica a previsão do resultado no toque (saldo, nível, ajudante, som) e o servidor —
# que continua sendo a autoridade — confirma em ordem, em segundo plano. Se recusar, o estado
# volta ao do servidor. Enquanto houver confirmações na fila, só a última resposta é aplicada
# (evita o número "voltar" entre toques rápidos).

signal command_done
var _inflight := false
var _queued := 0


## true quando não há confirmação pendente (testes e telas que precisam do estado oficial).
func settled() -> void:
	while _queued > 0:
		await command_done


func _optimistic(call: Callable, predict: Callable, sfx: String) -> bool:
	if not loaded or not predict.call():
		# Sem como prever (ex.: sem saldo): pergunta ao servidor, que explica o motivo.
		return await _run(call, sfx)
	Audio.play(sfx)
	_predict_districts()
	state_changed.emit()
	_confirm(call)  # sem await: a interface já respondeu
	return true


func _confirm(call: Callable) -> void:
	_queued += 1
	while _inflight:
		await command_done
	_inflight = true
	var res: Dictionary = await call.call()
	_inflight = false
	_queued -= 1
	command_done.emit()
	if res.ok:
		_set_online(true)
		if _queued == 0:
			_apply_state(res.data.state)
			refresh_missions()
			refresh_achievements()
		return
	if res.network_error:
		_set_online(false)
	_fail(res.error_code)
	await refresh()  # desfaz a previsão: vale o que o servidor disser


func _spend(amount: Variant) -> bool:
	if amount == null or not can_afford(amount):
		return false
	state.wallet["coins"] = str(coins().to_int() - str(amount).to_int())
	return true


func _predict_purchase(slug: String) -> bool:
	var b := business(slug)
	if b.is_empty() or b.get("owned", false) or not district_unlocked(str(b.get("district", "praia"))):
		return false
	if not _spend(b.cost):
		return false
	b["owned"] = true
	b["level"] = 1
	b["cycleStartedAt"] = "previsto"
	b["secondsRemaining"] = float(b.cycleSeconds) + (Time.get_ticks_msec() - _received_at_ms) / 1000.0
	b["nextUpgradeCost"] = str(roundi(str(b.cost).to_float() * 1.15))
	return true


func _predict_upgrade(slug: String) -> bool:
	var b := business(slug)
	if b.is_empty() or not b.get("owned", false) or b.get("nextUpgradeCost") == null:
		return false
	if not _spend(b.nextUpgradeCost):
		return false
	var level := int(b.level) + 1
	b["level"] = level
	# Mesmas fórmulas do servidor (docs/README.md §6); a resposta oficial corrige qualquer diferença.
	b["profitPerCycle"] = str(roundi(str(b.profitPerCycle).to_float() * 1.12))
	var max_level := int(b.get("maxLevel", 100))
	b["nextUpgradeCost"] = null if level >= max_level else str(roundi(str(b.cost).to_float() * pow(1.15, level)))
	return true


func _predict_hire(slug: String) -> bool:
	var b := business(slug)
	if b.is_empty() or not b.get("owned", false) or b.get("managed", false):
		return false
	if not _spend(b.managerCost):
		return false
	b["managed"] = true
	return true


## Mapa liberado quando todos os negócios do anterior estão comprados (previsão local).
func _predict_districts() -> void:
	var owned_all := {}
	for b in businesses():
		var d := str(b.get("district", ""))
		owned_all[d] = owned_all.get(d, true) and bool(b.get("owned", false))
	for d in state.get("districts", []):
		var req: Variant = d.get("requires")
		if req != null and not d.unlocked and owned_all.get(str(req), false):
			d["unlocked"] = true


## Coleta pela moeda com resposta na hora (pedido do titular: pela internet a moeda demorava
## ~0,5 s e dava para tocar 3 vezes). A moeda some, o ganho aparece e o saldo sobe no toque; o
## servidor (a autoridade) confirma em segundo plano e, se recusar, o estado volta ao dele.
func collect_fast(slug: String) -> void:
	var b := business(slug)
	if b.is_empty() or not is_ready(b) or _collecting.has(slug):
		return
	_collecting[slug] = true
	# Novo ciclo começa agora (como o servidor faz ao coletar).
	b["secondsRemaining"] = float(b.cycleSeconds) + (Time.get_ticks_msec() - _received_at_ms) / 1000.0
	var wallet: Dictionary = state.get("wallet", {})
	wallet["coins"] = str(coins().to_int() + str(b.profitPerCycle).to_int())
	collected.emit([{"slug": slug, "amount": str(b.profitPerCycle)}])
	state_changed.emit()
	await _confirm(Api.collect.bind(slug))
	_collecting.erase(slug)


func coins() -> String:
	return str(state.get("wallet", {}).get("coins", "0"))


func businesses() -> Array:
	return state.get("businesses", [])


func business(slug: String) -> Dictionary:
	for b in businesses():
		if b.slug == slug:
			return b
	return {}


## Segundos até o fim do ciclo, estimados localmente desde a última resposta.
func seconds_remaining(b: Dictionary) -> float:
	if not b.get("owned", false) or b.get("cycleStartedAt") == null:
		return 0.0
	var elapsed := (Time.get_ticks_msec() - _received_at_ms) / 1000.0
	return max(0.0, float(b.secondsRemaining) - elapsed)


func is_ready(b: Dictionary) -> bool:
	return b.get("owned", false) and b.get("cycleStartedAt") != null and seconds_remaining(b) <= 0.0


## Fração 0..1 do ciclo atual, para barras de progresso.
func cycle_progress(b: Dictionary) -> float:
	var total := float(b.get("cycleSeconds", 1))
	if not b.get("owned", false):
		return 0.0
	return clamp(1.0 - seconds_remaining(b) / total, 0.0, 1.0)


## true se o servidor já liberou o distrito (todos os negócios do anterior comprados).
func district_unlocked(id: String) -> bool:
	for d in state.get("districts", []):
		if d.id == id:
			return d.unlocked
	return id == "praia"


## Renda potencial por segundo dos negócios comprados (lucro do ciclo ÷ duração).
func income_per_second() -> float:
	var total := 0.0
	for b in businesses():
		if b.get("owned", false):
			total += str(b.profitPerCycle).to_float() / float(b.cycleSeconds)
	return total


## true se o saldo cobre `amount` (comparação de inteiros em texto, sem float).
func can_afford(amount: Variant) -> bool:
	if amount == null:
		return false
	return str(amount).to_int() <= coins().to_int()


static func message_for(code: String) -> String:
	return MESSAGES.get(code, "Algo deu errado. Tente novamente.")


## `sfx`: efeito tocado quando o servidor confirma (a moeda da coleta vem do sinal `collected`).
func _run(call: Callable, sfx := "") -> bool:
	if busy:
		return false
	_set_busy(true)
	var res: Dictionary = await call.call()
	_set_busy(false)
	if res.ok:
		_set_online(true)
		_apply_state(res.data.state)
		Audio.play(sfx)
		if res.data.has("collected"):
			collected.emit(res.data.collected)
		if res.data.has("settled") and not res.data.settled.is_empty():
			collected.emit(res.data.settled)
		refresh_missions()  # progresso das missões vem do servidor
		refresh_achievements()
		return true
	if res.network_error:
		_set_online(false)
	_fail(res.error_code)
	if res.error_code == "PRODUCTION_NOT_READY":
		await refresh()  # ressincroniza a contagem com o servidor
	return false


func _apply_state(new_state: Dictionary) -> void:
	state = new_state
	loaded = true
	_received_at_ms = Time.get_ticks_msec()
	state_changed.emit()


func _set_online(value: bool) -> void:
	if value == online:
		return
	online = value
	connection_changed.emit(value)
	if value:
		_reconnect_timer.stop()
	else:
		_reconnect_timer.start()


func _try_reconnect() -> void:
	await refresh()
	if online:
		await enter_district(current_district, true)


func _set_busy(value: bool) -> void:
	busy = value
	busy_changed.emit(value)
