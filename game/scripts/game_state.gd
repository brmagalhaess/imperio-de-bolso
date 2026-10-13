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
## Volta depois de um tempo fora: ajudantes produziram `total` em `elapsed_seconds`.
signal offline_summary(total: String, elapsed_seconds: int, capped: bool, cap_seconds: int)
## Conexão caiu (tentando de novo) / voltou.
signal connection_changed(online: bool)

const SETTLE_INTERVAL := 15.0
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
	"DISTRICT_LOCKED": "Compre os 4 negócios da praia para abrir a cidade.",
	"MANAGER_ACTIVE": "O ajudante já coleta este negócio sozinho.",
	"MANAGER_ALREADY_HIRED": "Este negócio já tem ajudante.",
}

var state: Dictionary = {}
var loaded := false
var busy := false
var online := true
var _received_at_ms := 0
var _settle_timer: Timer
var _reconnect_timer: Timer


func _ready() -> void:
	_settle_timer = Timer.new()
	_settle_timer.wait_time = SETTLE_INTERVAL
	_settle_timer.timeout.connect(func():
		if has_managers() and not busy:
			settle(false))
	add_child(_settle_timer)
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
	_settle_timer.start()
	await settle(true)
	return true


func refresh() -> void:
	var res := await Api.get_state()
	if res.ok:
		_apply_state(res.data)
		_set_online(true)
	elif res.network_error:
		_set_online(false)


## Ao voltar do segundo plano: estado novo + produção dos ajudantes com resumo.
func resume() -> void:
	await refresh()
	await settle(true)


## Liquida os ajudantes no servidor; `show_summary` mostra o resumo se ficou fora ≥ 1 min.
func settle(show_summary: bool) -> void:
	if not has_managers():
		return
	var res := await Api.settle()
	if not res.ok:
		if res.network_error:
			_set_online(false)
		return
	_set_online(true)
	_apply_state(res.data.state)
	if not res.data.settled.is_empty():
		collected.emit(res.data.settled)
	if show_summary and int(res.data.elapsedSeconds) >= OFFLINE_SUMMARY_MIN_SECONDS \
			and str(res.data.total) != "0":
		offline_summary.emit(str(res.data.total), int(res.data.elapsedSeconds),
				bool(res.data.capped), int(res.data.capSeconds))


func has_managers() -> bool:
	for b in businesses():
		if b.get("managed", false):
			return true
	return false


func hire_manager(slug: String) -> bool:
	return await _run(Api.hire_manager.bind(slug))


func complete_tutorial() -> void:
	var res := await Api.complete_tutorial()
	if res.ok:
		_apply_state(res.data)


func tutorial_completed() -> bool:
	return bool(state.get("player", {}).get("tutorialCompleted", true))


func purchase(slug: String) -> bool:
	return await _run(Api.purchase.bind(slug))


func upgrade(slug: String) -> bool:
	return await _run(Api.upgrade.bind(slug))


func collect(slug: String) -> bool:
	return await _run(Api.collect.bind(slug))


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


func _run(call: Callable) -> bool:
	if busy:
		return false
	_set_busy(true)
	var res: Dictionary = await call.call()
	_set_busy(false)
	if res.ok:
		_set_online(true)
		_apply_state(res.data.state)
		if res.data.has("collected"):
			collected.emit(res.data.collected)
		if res.data.has("settled") and not res.data.settled.is_empty():
			collected.emit(res.data.settled)
		return true
	if res.network_error:
		_set_online(false)
	notice.emit(message_for(res.error_code))
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
		await settle(true)


func _set_busy(value: bool) -> void:
	busy = value
	busy_changed.emit(value)
