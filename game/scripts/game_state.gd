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
## Prestígio atualizado / império vendido (gained = estrelas ganhas).
signal prestige_changed
## Catálogo da Loja recarregado (contadores do dia, direitos do VIP).
signal catalog_changed
## Calendário de 7 dias / evento de fim de semana atualizados (ADR 0014).
signal daily_changed
signal event_changed
signal empire_sold(gained: int)

## Sinal de presença (o servidor considera "fora do mapa" após 45 s sem sinal).
const PRESENCE_INTERVAL := 15.0
const RECONNECT_INTERVAL := 5.0
## Abaixo disso não mostra o resumo offline (foi só uma pausa curta).
const OFFLINE_SUMMARY_MIN_SECONDS := 60
## Dinheiro sem teto (ADR 0033): contas de moedas em texto, exatas (scripts/big.gd).
const Big := preload("res://scripts/big.gd")

const AppleAuth := preload("res://scripts/apple_auth.gd")

const MESSAGES := {
	"IDENTITY_IN_USE": "Essa conta já está ligada a outro progresso.",
	"ALREADY_LINKED": "Este progresso já tem uma conta ligada.",
	"LINK_NOT_CONFIGURED": "Vincular conta ainda não está disponível.",
	"APPLE_SIGNIN_FAILED": "Não foi possível entrar com a Apple. Tente de novo.",
	"GOOGLE_SIGNIN_FAILED": "Não foi possível entrar com o Google. Tente de novo.",
	"INVALID_ID_TOKEN": "Não foi possível confirmar a conta. Tente de novo.",
	"IDENTITY_NOT_FOUND": "Nenhum progresso ligado a essa conta.",
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
	"PURCHASE_REVOKED": "Essa compra foi estornada.",
	"PURCHASE_EXPIRED": "Essa assinatura já venceu.",
	"PURCHASE_OWNED_BY_OTHER": "Essa compra pertence a outra conta do jogo.",
	"PRODUCT_NOT_FOUND": "Produto indisponível no momento.",
	"VIP_REQUIRED": "Benefício exclusivo do Passe VIP.",
	"VIP_DAILY_CLAIMED": "Você já resgatou os diamantes de hoje.",
	"NAME_INVALID": "Use de 3 a 20 letras, números, espaço, ponto, hífen ou _.",
	"NAME_NOT_ALLOWED": "Esse nome não é permitido.",
	"NAME_TAKEN": "Esse nome já está em uso.",
	"NAME_ALREADY_CHANGED": "Você já trocou de nome uma vez.",
	"PRESTIGE_NOT_AVAILABLE": "Complete a cidade e fature mais para vender o império.",
	"VALIDATION_ERROR": "Dados inválidos. Confira e tente de novo.",
	"PURCHASES_DISABLED": "Compras ainda não disponíveis nesta versão.",
	"ADS_DISABLED": "Anúncios ainda não disponíveis nesta versão.",
	"DAILY_REWARD_CLAIMED": "Você já pegou o prêmio de hoje. Volte amanhã!",
	"MISSION_CHEST_LOCKED": "Resgate as 3 missões do dia para abrir o baú.",
	"MISSION_CHEST_CLAIMED": "O baú de hoje já foi aberto.",
	"EVENT_NOT_ACTIVE": "O evento acabou. Volte no próximo fim de semana!",
	"EVENT_GOAL_NOT_REACHED": "Fature mais para alcançar a meta do evento.",
	"EVENT_ALREADY_CLAIMED": "Prêmio do evento já resgatado.",
	"WEEKLY_REWARD_CLAIMED": "Prêmio já resgatado.",
	"WEEKLY_REWARD_NOT_FOUND": "Esse prêmio não está mais disponível.",
}

var state: Dictionary = {}
## {day, resetsAt, missions:[...]} do servidor.
var missions: Dictionary = {}
var achievements: Array = []
## Situação do prestígio ({stars, bonusPercent, starsToGain, available, ...}).
var prestige: Dictionary = {}
## Catálogo da Loja ({sandbox, items, entitlements}).
var catalog: Dictionary = {}
## Calendário de 7 dias ({day, claimedToday, rewards}) e evento ({active, district, …}).
var daily: Dictionary = {}
## Prêmios do pódio da semana esperando resgate ([{week, kind, rank, league, gems}]).
var podium: Array = []
var weekend: Dictionary = {}
var loaded := false
var busy := false
var online := true
## Mapa aberto agora (praia/cidade/porto/centro) — define onde a produção é manual.
var current_district := "praia"
var _received_at_ms := 0
## Moedas tocadas aguardando a confirmação do servidor (coleta rápida).
var _collecting := {}
## Conta as mudanças feitas no toque (previsões). Resposta "de fundo" (presença, atualização)
## pedida antes de uma delas chega velha e é descartada — senão desfazia melhorias recém-feitas
## (pedido do titular: "a auto coleta está voltando as minhas melhorias").
var _local_rev := 0
var _resync_pending := false
## Loja precisa ser recarregada depois da confirmação (contadores e direitos).
var _catalog_dirty := false
var _pinging := false
## Auto-coleta ao vivo: ciclos dos ajudantes já mostrados (slug → ciclos desde a última resposta).
var _live_shown := {}
var _presence_timer: Timer
var _reconnect_timer: Timer


func _ready() -> void:
	_presence_timer = Timer.new()
	_presence_timer.wait_time = PRESENCE_INTERVAL
	_presence_timer.timeout.connect(_ping)
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
	refresh_prestige()
	refresh_event()
	await refresh_daily()
	await refresh_podium()
	return true


## `force`: aplica mesmo com previsões na fila (desfazer uma previsão recusada pelo servidor).
func refresh(force := false) -> void:
	var rev := _local_rev
	var res := await Api.get_state()
	if res.ok:
		if force:
			_apply_state(res.data)
		else:
			_apply_background(res.data, rev)
		_set_online(true)
	elif res.network_error:
		_set_online(false)


## Ao voltar do segundo plano: o servidor paga o AFK do mapa aberto (com resumo).
func resume() -> void:
	await enter_district(current_district, true)


## Sinal periódico de presença: espera as confirmações da fila (nunca corre na frente delas).
func _ping() -> void:
	if _pinging or busy:
		return
	_pinging = true
	await settled()
	await enter_district(current_district, false)
	_pinging = false


## Avisa o servidor do mapa aberto; ao entrar num mapa recebe o AFK dos ajudantes dele.
## `show_summary` mostra "Bem-vindo de volta" se ficou fora ≥ 1 min e houve ganho.
func enter_district(district: String, show_summary: bool) -> void:
	current_district = district
	# Antes de trocar de mapa (ou ao voltar ao jogo), tudo que foi tocado chega ao servidor.
	flush_now()
	await settled()
	var rev := _local_rev
	var res := await Api.presence(district)
	if not res.ok:
		if res.network_error:
			_set_online(false)
		return
	_set_online(true)
	_apply_background(res.data.state, rev)
	# Ficando no mesmo mapa (auto-coleta), os ganhos já apareceram ao vivo, ciclo a ciclo.
	if not res.data.settled.is_empty():
		if res.data.get("returned", true):
			collected.emit(res.data.settled)
		refresh_missions()
	if show_summary and int(res.data.elapsedSeconds) >= OFFLINE_SUMMARY_MIN_SECONDS \
			and str(res.data.total) != "0":
		offline_summary.emit(district, str(res.data.total), int(res.data.elapsedSeconds),
				bool(res.data.capped), int(res.data.capSeconds))


## AFK acumulado (ainda não pago) dos ajudantes de um mapa.
func pending_in(district: String) -> String:
	var total := "0"
	for b in businesses():
		if b.get("district", "") == district and b.get("automatic", false):
			total = Big.add(total, b.get("pendingAmount", "0"))
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


## Listas com resgate na fila não são trocadas pela resposta velha (o botão voltaria a
## "Resgatar"); a fila, ao esvaziar, pede de novo.
func refresh_missions() -> void:
	var res := await Api.missions()
	if res.ok and _queued == 0:
		missions = res.data
		missions_changed.emit()


func refresh_achievements() -> void:
	var res := await Api.achievements()
	if res.ok and _queued == 0:
		achievements = res.data.achievements
		achievements_changed.emit()


## Resgates respondem no toque (pedido do titular: Loja e Perfil estavam lentos); o servidor
## confirma na fila e, se recusar, tudo volta ao estado dele.
func claim_mission(mission_id: String) -> bool:
	var ok := await _optimistic(Api.claim_mission.bind(mission_id), func() -> bool:
		for m in missions.get("missions", []):
			if m.id == mission_id and m.completed and not m.claimed:
				m["claimed"] = true
				_add_coins(m.rewardCoins)
				_add_gems(m.rewardGems)
				return true
		return false, "reward")
	missions_changed.emit()
	return ok


func claim_achievement(achievement_id: String) -> bool:
	var ok := await _optimistic(Api.claim_achievement.bind(achievement_id), func() -> bool:
		for a in achievements:
			if a.id == achievement_id and a.unlocked and not a.claimed:
				a["claimed"] = true
				_add_gems(a.rewardGems)
				return true
		return false, "reward")
	achievements_changed.emit()
	return ok


func _add_coins(amount: Variant) -> void:
	var wallet: Dictionary = state.get("wallet", {})
	wallet["coins"] = Big.add(wallet.get("coins", "0"), amount)


func _add_gems(amount: Variant) -> void:
	var wallet: Dictionary = state.get("wallet", {})
	wallet["gems"] = str(str(wallet.get("gems", "0")).to_int() + str(amount).to_int())


## Quantos prêmios esperam resgate (selo nos botões).
func claimable_missions() -> int:
	return missions.get("missions", []).filter(func(m): return m.completed and not m.claimed).size()


func claimable_achievements() -> int:
	return achievements.filter(func(a): return a.unlocked and not a.claimed).size()


func refresh_catalog() -> void:
	var res := await Api.store_catalog(current_district)
	if res.ok and _queued == 0:
		catalog = res.data
		if ads_enabled():
			_ensure_admob()  # consentimento e primeiro anúncio já carregando
		if bool(catalog.get("purchasesEnabled", false)) and not catalog.get("sandbox", false):
			_ensure_store()
			if store_node != null:
				store_node.load_products(Array(catalog.get("items", [])).filter(
					func(i): return i.has("productId")).map(func(i): return str(i.productId))
					+ offers().map(func(o): return str(o.productId)))
		catalog_changed.emit()


## Compras em dinheiro real / anúncios ligados no servidor (versão 1.0 sai sem — ADR 0018).
func purchases_enabled() -> bool:
	return bool(catalog.get("purchasesEnabled", false))


## Pacotes promocionais na vitrine (ADR 0024): no máximo 5, já sem os comprados nesta semana.
func offers() -> Array:
	return Array(catalog.get("offers", []))


func ads_enabled() -> bool:
	return bool(catalog.get("adsEnabled", false))


## Anúncio real do AdMob (iPhone com o plugin). Com o servidor em "mock" o anúncio de teste do
## Google aparece, mas quem confirma é a rota de teste; em "admob" quem confirma é o SSV.
var admob: Node


func real_ads() -> bool:
	_ensure_admob()
	return admob != null


func ads_mode() -> String:
	return str(catalog.get("adsMode", "mock"))


func _ensure_admob() -> void:
	if admob == null and ads_enabled() and preload("res://scripts/admob_ads.gd").available():
		admob = preload("res://scripts/admob_ads.gd").new()
		add_child(admob)
		admob.start()


func store_item(item_id: String) -> Dictionary:
	for i in catalog.get("items", []):
		if i.id == item_id:
			return i
	return {}


func vip_until() -> Variant:
	return state.get("player", {}).get("vipUntil")


func auto_collect_until() -> Variant:
	return state.get("player", {}).get("autoCollectUntil")


## Compra com diamantes (auto-coleta, coleta antecipada), na hora. Devolve a previsão
## ({coins} da coleta antecipada ou {autoCollect}); o servidor confirma em seguida.
func buy_with_gems(item_id: String) -> Dictionary:
	var item := store_item(item_id)
	var result := {}
	var predict := func() -> bool:
		var cost := str(item.get("costGems", "")).to_int()
		if item.is_empty() or cost <= 0 or gems().to_int() < cost:
			return false
		var estimate := boost_estimate(int(item.get("hours", 0)) * 3600)
		if item.get("kind", "") == "boost" and not Big.lt("0", estimate):
			return false
		_add_gems(-cost)
		if item.get("kind", "") == "boost":
			_add_coins(estimate)
			result["coins"] = estimate  # (lambda copia variáveis: muta, não reatribui)
		elif item.get("kind", "") == "turbo":
			var player: Dictionary = state.get("player", {})
			var base := server_now()
			if player.get("turboUntil") != null:
				base = max(base, Time.get_unix_time_from_datetime_string(str(player.turboUntil).substr(0, 19)))
			else:
				_change_speed(100)  # ligou agora: tudo 2× mais rápido na hora
			player["turboUntil"] = Time.get_datetime_string_from_unix_time(
					int(base) + int(item.get("hours", 1)) * 3600) + "Z"
			result["turbo"] = true
		else:
			var player: Dictionary = state.get("player", {})
			player["autoCollect"] = true
			var base := Time.get_unix_time_from_system()
			if player.get("autoCollectUntil") != null:
				base = max(base, Time.get_unix_time_from_datetime_string(str(player.autoCollectUntil).substr(0, 19)))
			player["autoCollectUntil"] = Time.get_datetime_string_from_unix_time(
					int(base) + int(item.get("hours", 24)) * 3600) + "Z"
			result["autoCollect"] = true
		_catalog_dirty = true
		return true
	# Como evoluir: responde na hora e toques seguidos no mesmo item vão juntos ao servidor.
	_bank_live()
	if not loaded or not predict.call():
		flush_now()
		await settled()
		var ok := await _run(Api.store_buy.bind(item_id, current_district, 1), "bonus")
		return result if ok else {}
	Audio.play("bonus")
	_predict_districts()
	_local_rev += 1
	state_changed.emit()
	_pending_store[item_id] = int(_pending_store.get(item_id, 0)) + 1
	_queued += 1
	_schedule_flush()
	return result


## Loja real do aparelho: App Store no iPhone (scripts/apple_store.gd) ou Google Play no
## Android (scripts/google_store.gd). Mesma interface: load_products, price, buy, restore.
var store_node: Node


func _ensure_store() -> void:
	if store_node != null:
		return
	for script in [preload("res://scripts/apple_store.gd"), preload("res://scripts/google_store.gd")]:
		if script.available():
			store_node = script.new()
			add_child(store_node)
			return


## "apple" no iPhone, "google" no Android (textos da Loja e do Passe VIP).
func store_brand() -> String:
	return "google" if OS.get_name() == "Android" else "apple"


## Recibo de uma loja real → servidor (chamado pela loja da Apple). Atualiza o estado.
func verify_store_purchase(store: String, product_id: String, token: String) -> Dictionary:
	var res := await Api.verify_purchase(store, product_id, token, current_district)
	if res.ok:
		_apply_state(res.data.state)
		_catalog_dirty = true
		refresh_catalog()
		Audio.play("bonus")
	return res


## Compra pela loja do aparelho. Devolve {ok, message} (message "" = cancelado pelo jogador).
func buy_real(product_id: String) -> Dictionary:
	_ensure_store()
	if store_node == null:
		return {"ok": false, "message": "unavailable"}
	return await store_node.buy(product_id)


## Loja paga real neste aparelho (iPhone/Android com compras ligadas no servidor).
func real_store() -> bool:
	return purchases_enabled() and not catalog.get("sandbox", false) and store_node != null


## Compra de TESTE (modo sandbox): nada é cobrado; o servidor registra como loja "mock".
func buy_sandbox(product_id: String) -> bool:
	if busy:
		return false
	_set_busy(true)
	var token := "mock-" + Api.new_idempotency_key()
	var res := await Api.verify_purchase("mock", product_id, token, current_district)
	_set_busy(false)
	if not res.ok:
		_fail(res.error_code)
		return false
	_apply_state(res.data.state)
	Audio.play("bonus")
	return true


## Recompensa diária do VIP (diamantes), na hora.
func claim_vip_daily() -> bool:
	return await _optimistic(Api.vip_daily, func() -> bool:
		var ent: Dictionary = catalog.get("entitlements", {})
		if vip_until() == null or ent.get("vipDailyClaimed", false):
			return false
		ent["vipDailyClaimed"] = true
		_add_gems(int(ent.get("vipDailyGems", 5)))
		_catalog_dirty = true
		return true, "reward")


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


# --- Retenção (ADR 0014) -----------------------------------------------------

func refresh_daily() -> void:
	var res := await Api.daily_reward()
	if res.ok:
		daily = res.data
		daily_changed.emit()


## Prêmio do dia do calendário, na hora (o servidor confirma em seguida).
func claim_daily() -> bool:
	var ok := await _optimistic(Api.claim_daily_reward, func() -> bool:
		if daily.is_empty() or daily.get("claimedToday", true):
			return false
		var r: Dictionary = daily.rewards[int(daily.day) - 1]
		if r.get("coins") != null:
			_add_coins(r.coins)
		_add_gems(int(r.get("gems", 0)))
		daily["claimedToday"] = true
		return true, "reward")
	daily_changed.emit()
	return ok


## Baú das 3 missões do dia (diamantes + Turbo).
func open_mission_chest() -> bool:
	var ok := await _optimistic(Api.open_mission_chest, func() -> bool:
		var chest: Dictionary = missions.get("chest", {})
		if chest.is_empty() or not chest.get("available", false) or chest.get("claimed", false):
			return false
		chest["claimed"] = true
		_add_gems(int(chest.get("gems", 0)))
		return true, "reward")
	missions_changed.emit()
	return ok


func refresh_podium() -> void:
	var res := await Api.weekly_rewards()
	if res.ok:
		podium = res.data.get("pending", [])


## Prêmio do pódio (1º/2º/3º da semana), na hora.
func claim_podium(week: String, kind: String) -> bool:
	return await _optimistic(Api.claim_weekly_reward.bind(week, kind), func() -> bool:
		for i in podium.size():
			var r: Dictionary = podium[i]
			if r.week == week and r.kind == kind:
				_add_gems(int(r.gems))
				podium.remove_at(i)
				return true
		return false, "reward")


func refresh_event() -> void:
	var res := await Api.weekend_event()
	if res.ok:
		weekend = res.data
		event_changed.emit()


func claim_event() -> bool:
	var ok := await _optimistic(Api.claim_event, func() -> bool:
		if not weekend.get("completed", false) or weekend.get("claimed", true):
			return false
		weekend["claimed"] = true
		_add_gems(int(weekend.get("prizeGems", 0)))
		return true, "reward")
	event_changed.emit()
	return ok


## Hora do servidor agora (ISO da última resposta + tempo do relógio monotônico).
func server_now() -> float:
	var base := Time.get_unix_time_from_datetime_string(str(state.get("serverTime", "1970-01-01T00:00:00")).substr(0, 19))
	return base + (Time.get_ticks_msec() - _received_at_ms) / 1000.0


## Dobro de moedas (×2 em tudo, ADR 0025) ativo até (ISO) ou null.
func double_until() -> Variant:
	return state.get("player", {}).get("doubleUntil")


## Turbo 2× ativo até (ISO) ou null.
func turbo_until() -> Variant:
	return state.get("player", {}).get("turboUntil")


func refresh_prestige() -> void:
	var res := await Api.prestige()
	if res.ok:
		prestige = res.data
		prestige_changed.emit()


## Vender o império: o servidor zera os negócios e soma as estrelas; o jogo volta à praia.
func sell_empire() -> bool:
	if busy:
		return false
	await settled()
	_set_busy(true)
	var res := await Api.sell_empire()
	_set_busy(false)
	if not res.ok:
		_fail(res.error_code)
		return false
	prestige = res.data.prestige
	_apply_state(res.data.state)
	Audio.play("reward")
	prestige_changed.emit()
	empire_sold.emit(int(res.data.gained))
	refresh_missions()
	refresh_achievements()
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


## Evoluir responde na hora; toques seguidos no mesmo negócio se juntam por ~0,35 s e vão ao
## servidor num comando só ("suba N níveis"). Antes: um pedido por toque numa fila longa — quem
## trocava de mapa ou saía do jogo antes de ela acabar perdia as últimas evoluções.
const UPGRADE_BATCH_SECONDS := 0.35
var _pending_upgrades := {}  # slug → níveis tocados ainda não enviados
var _pending_store := {}  # item da Loja (diamantes) → compras tocadas ainda não enviadas
var _upgrade_flush_scheduled := false


func upgrade(slug: String) -> bool:
	_bank_live()
	if not loaded or not _predict_upgrade(slug):
		flush_now()  # mantém a ordem: o que já foi tocado vai antes
		await settled()
		return await _run(Api.upgrade.bind(slug, 1), "upgrade")
	Audio.play("upgrade")
	_predict_districts()
	_local_rev += 1
	state_changed.emit()
	_pending_upgrades[slug] = int(_pending_upgrades.get(slug, 0)) + 1
	_queued += 1  # conta como pendente: estados em segundo plano não sobrescrevem a previsão
	_schedule_flush()
	return true


func _schedule_flush() -> void:
	if not _upgrade_flush_scheduled:
		_upgrade_flush_scheduled = true
		get_tree().create_timer(UPGRADE_BATCH_SECONDS).timeout.connect(flush_now)


## Envia já as evoluções juntadas (na ordem da fila). Chamado pelo temporizador, antes de
## qualquer outro comando, ao trocar de mapa e quando o jogo vai para o segundo plano.
func flush_now() -> void:
	_upgrade_flush_scheduled = false
	var store := _pending_store
	_pending_store = {}
	for item_id in store:
		var left: int = store[item_id]
		_queued -= left
		while left > 0:
			var n: int = min(left, 50)
			left -= n
			_confirm(Api.store_buy.bind(item_id, current_district, n))
	if _pending_upgrades.is_empty():
		return
	var batch := _pending_upgrades
	_pending_upgrades = {}
	for slug in batch:
		var left: int = batch[slug]
		_queued -= left
		while left > 0:
			var n: int = min(left, 100)
			left -= n
			_confirm(Api.upgrade.bind(slug, n))  # sem await: entra na fila na ordem


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
	flush_now()  # evoluções juntadas entram na fila antes deste comando
	# O servidor paga os ciclos ao vivo antes de gastar (settleLive): a previsão faz o mesmo.
	_bank_live()
	if not loaded or not predict.call():
		# Sem como prever (ex.: sem saldo): pergunta ao servidor, que explica o motivo.
		return await _run(call, sfx)
	Audio.play(sfx)
	_predict_districts()
	_local_rev += 1
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
	if res.ok:
		_set_online(true)
		if _queued == 1:  # última da fila: vale o estado oficial
			_apply_state(res.data.state)
			refresh_missions.call_deferred()
			refresh_achievements.call_deferred()
			refresh_prestige()
			if _catalog_dirty:
				_catalog_dirty = false
				refresh_catalog.call_deferred()
	else:
		if res.network_error:
			_set_online(false)
		_fail(res.error_code)
		await refresh(true)  # desfaz a previsão: vale o que o servidor disser
		refresh_missions.call_deferred()
		refresh_achievements.call_deferred()
		if _catalog_dirty:
			_catalog_dirty = false
			refresh_catalog.call_deferred()
	# Só sai da fila depois de acertar o estado (settled() = estado oficial na tela).
	_queued -= 1
	command_done.emit()


func _spend(amount: Variant) -> bool:
	if amount == null or not can_afford(amount):
		return false
	state.wallet["coins"] = Big.sub(coins(), amount)
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
	if SPEED_MILESTONES.has(level):
		_set_speed(b, int(b.get("speedPercent", 100)) + 50)
	# Mesmas fórmulas do servidor (docs/README.md §6); a resposta oficial corrige qualquer diferença.
	b["profitPerCycle"] = str(roundi(str(b.profitPerCycle).to_float() * 1.1))
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
	_set_speed(b, int(b.get("speedPercent", 100)) + 25)  # ajudante: +25% (ADR 0013)
	return true


## Marcos de nível que aceleram o negócio em +50% cada (ADR 0013, igual ao servidor).
const SPEED_MILESTONES := [10, 25, 50, 75, 100]


## Nova velocidade do negócio: o ciclo efetivo encolhe na hora (o servidor confirma depois).
func _set_speed(b: Dictionary, percent: int) -> void:
	b["speedPercent"] = percent
	var base := float(b.get("baseCycleSeconds", b.get("cycleSeconds", 10)))
	b["cycleSeconds"] = max(1.0, base * 100.0 / percent)


## Turbo/VIP ligado: todos os negócios comprados mudam de velocidade.
func _change_speed(delta: int) -> void:
	for b in businesses():
		if b.get("owned", false):
			_set_speed(b, int(b.get("speedPercent", 100)) + delta)


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
	_local_rev += 1
	# Novo ciclo começa agora (como o servidor faz ao coletar).
	b["secondsRemaining"] = float(b.cycleSeconds) + (Time.get_ticks_msec() - _received_at_ms) / 1000.0
	var wallet: Dictionary = state.get("wallet", {})
	wallet["coins"] = Big.add(coins(), b.profitPerCycle)
	collected.emit([{"slug": slug, "amount": str(b.profitPerCycle)}])
	state_changed.emit()
	await _confirm(Api.collect.bind(slug))
	_collecting.erase(slug)


## Saldo na tela: o da carteira + os ciclos dos ajudantes que a auto-coleta já completou no
## mapa aberto (o servidor paga esses ciclos no próximo sinal ou antes de qualquer gasto).
func coins() -> String:
	var wallet := str(state.get("wallet", {}).get("coins", "0"))
	var live := live_coins()
	return wallet if live == "0" else Big.add(wallet, live)


## Auto-coleta ao vivo: negócio com ajudante produzindo sozinho no mapa aberto.
## Sem auto-coleta, "automático" é o AFK de outro mapa (pago com resumo ao voltar), nunca ao vivo.
func is_live(b: Dictionary) -> bool:
	return b.get("owned", false) and b.get("automatic", false) and auto_collect() \
			and str(b.get("district", "")) == current_district


## Ciclos que terminaram desde a última resposta do servidor (relógio do aparelho).
func _live_cycles(b: Dictionary) -> int:
	if not is_live(b):
		return 0
	var elapsed := (Time.get_ticks_msec() - _received_at_ms) / 1000.0
	var first := float(b.get("secondsRemaining", 0))
	if elapsed < first:
		return 0
	return 1 + int((elapsed - first) / max(1.0, float(b.cycleSeconds)))


## Moedas ainda não pagas pelo servidor dos negócios ao vivo (pendentes + ciclos locais).
func live_coins() -> String:
	var total := "0"
	for b in businesses():
		if is_live(b):
			total = Big.add(Big.add(total, b.get("pendingAmount", "0")),
					Big.mul_int(b.profitPerCycle, _live_cycles(b)))
	return total


## Passa os ganhos ao vivo para a carteira (antes de uma previsão de gasto, como o servidor).
func _bank_live() -> void:
	var wallet: Dictionary = state.get("wallet", {})
	for b in businesses():
		if not is_live(b):
			continue
		var cycles := _live_cycles(b)
		var amount := Big.add(b.get("pendingAmount", "0"), Big.mul_int(b.profitPerCycle, cycles))
		if amount != "0":
			wallet["coins"] = Big.add(wallet.get("coins", "0"), amount)
		b["pendingAmount"] = "0"
		b["secondsRemaining"] = float(b.secondsRemaining) + cycles * float(b.cycleSeconds)
		_live_shown[b.slug] = 0


## A cada quadro: ciclo ao vivo terminou → "+lucro" sobe do negócio e o saldo anda (uma vez só).
func _process(_delta: float) -> void:
	if not loaded:
		return
	var items := []
	for b in businesses():
		if not is_live(b):
			continue
		var cycles := _live_cycles(b)
		var shown := int(_live_shown.get(b.slug, 0))
		if cycles > shown:
			items.append({"slug": b.slug, "amount": Big.mul_int(b.profitPerCycle, cycles - shown)})
			_live_shown[b.slug] = cycles
	if not items.is_empty():
		collected.emit(items)
		state_changed.emit()


## Jogadores ocultos no ranking (bloqueio — fica só neste aparelho, user://settings.cfg).
const SETTINGS_PATH := "user://settings.cfg"


func hidden_players() -> Array:
	var cfg := ConfigFile.new()
	cfg.load(SETTINGS_PATH)
	return cfg.get_value("ranking", "hidden", [])


func hide_player(player_id: String) -> void:
	var cfg := ConfigFile.new()
	cfg.load(SETTINGS_PATH)
	var hidden: Array = cfg.get_value("ranking", "hidden", [])
	if not hidden.has(player_id):
		hidden.append(player_id)
	cfg.set_value("ranking", "hidden", hidden)
	cfg.save(SETTINGS_PATH)


func report_player(player_id: String) -> bool:
	var res := await Api.report_player(player_id)
	return res.ok


## Vincula a conta Apple a este progresso. Devolve {ok, code, token}: code "IDENTITY_IN_USE"
## (a conta Apple já tem outro progresso) vem com o token para oferecer carregar esse progresso.
## Provedores já vinculados a esta conta ("apple", "google"); o Perfil atualiza ao abrir.
var linked_providers: Array = []


## Vincula a conta convidada à Apple (iPhone) ou ao Google (Android). Devolve {ok, code, token};
## code "IDENTITY_IN_USE" traz o token para oferecer carregar o progresso daquela conta.
func link_account(provider: String) -> Dictionary:
	var auth: Dictionary = await (preload("res://scripts/apple_auth.gd") if provider == "apple" \
			else preload("res://scripts/google_auth.gd")).request_token()
	if auth.token == "":
		# Fechar a folha não é erro; qualquer outra falha precisa aparecer.
		var err := str(auth.error).to_lower()
		var cancelled: bool = err.contains("cancel") or err.contains("1001")
		print("Login ", provider, ": sem token (", auth.error, ")")
		return {"ok": false, "code": "CANCELLED" if cancelled else ("APPLE_SIGNIN_FAILED" if provider == "apple" else "GOOGLE_SIGNIN_FAILED"), "token": ""}
	var res := await Api.link_identity(provider, auth.token)
	print("Login ", provider, ": vínculo ", "ok" if res.ok else res.error_code)
	if res.ok or res.error_code == "ALREADY_LINKED":
		if not linked_providers.has(provider):
			linked_providers.append(provider)
		if res.ok:
			track("account_linked", {"provider": provider})
		return {"ok": true, "code": "", "token": ""}
	return {"ok": false, "code": res.error_code, "token": auth.token}


func link_apple() -> Dictionary:
	return await link_account("apple")


## Troca este aparelho para o progresso ligado à conta Apple/Google (token de `link_account`).
func sign_in_with(provider: String, id_token: String) -> bool:
	var res := await Api.social_sign_in(provider, id_token)
	return res.ok


func sign_in_apple(id_token: String) -> bool:
	return await sign_in_with("apple", id_token)


func businesses() -> Array:
	return state.get("businesses", [])


## Moedas da coleta antecipada de `seconds` no mapa atual, calculadas do estado (mesma conta do
## servidor: ciclos que cabem no tempo × lucro). O catálogo da Loja ficava velho e mostrava 0.
func boost_estimate(seconds: int) -> String:
	var total := "0"
	for b in businesses():
		if not b.get("owned", false) or b.get("district", "") != current_district:
			continue
		var cycles := int(floor(seconds / max(0.001, float(b.cycleSeconds))))
		total = Big.add(total, Big.mul_int(b.profitPerCycle, cycles))
	return total


func business(slug: String) -> Dictionary:
	for b in businesses():
		if b.slug == slug:
			return b
	return {}


## Segundos até o fim do ciclo, estimados localmente desde a última resposta. No ciclo
## automático o relógio dá a volta sozinho (o ajudante já começa o próximo).
func seconds_remaining(b: Dictionary) -> float:
	if not b.get("owned", false) or b.get("cycleStartedAt") == null:
		return 0.0
	var elapsed := (Time.get_ticks_msec() - _received_at_ms) / 1000.0
	var left := float(b.secondsRemaining) - elapsed
	if b.get("automatic", false) and left <= 0.0:
		var cycle: float = max(1.0, float(b.cycleSeconds))
		return cycle - fmod(-left, cycle)
	return max(0.0, left)


## Moeda para tocar: só na produção manual (com auto-coleta não há moeda — pedido do titular:
## a moeda ficava parada esperando e o valor parecia duplicar).
func is_ready(b: Dictionary) -> bool:
	return b.get("owned", false) and b.get("cycleStartedAt") != null \
			and not b.get("automatic", false) and seconds_remaining(b) <= 0.0


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
	return Big.lte(amount, coins())


static func message_for(code: String) -> String:
	return TranslationServer.translate(MESSAGES.get(code, "Algo deu errado. Tente novamente."))


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
		refresh_prestige()
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
	_live_shown.clear()  # ciclos ao vivo recomeçam da resposta nova (pagos ou pendentes nela)
	state_changed.emit()


## Estado pedido em segundo plano: só vale se nada mudou no toque desde o pedido e não há
## confirmação na fila. Senão descarta e, quando a fila esvaziar, pede o estado de novo.
func _apply_background(new_state: Dictionary, rev: int) -> void:
	if rev == _local_rev and _queued == 0:
		_apply_state(new_state)
		return
	if _resync_pending:
		return
	_resync_pending = true
	await settled()
	_resync_pending = false
	if _queued == 0:
		await refresh()


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
