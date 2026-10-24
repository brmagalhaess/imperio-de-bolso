## Cliente HTTP da API v1 (autoload "Api").
## O servidor é a autoridade: este cliente só envia intenções (comprar, melhorar,
## coletar) e recebe o estado oficial. Nunca envia saldo nem horário.
extends Node

const DEFAULT_SESSION_PATH := "user://session.cfg"
const COMMAND_ATTEMPTS := 3

var base_url: String
var session_path := DEFAULT_SESSION_PATH
var _token := ""


func _ready() -> void:
	var env_url := OS.get_environment("IMPERIO_API_URL")
	# Celular usa o servidor online; desktop (desenvolvimento) usa a API local. Escolha explícita:
	# o sufixo de plataforma (`base_url.android`) não é aplicado no jogo exportado.
	var key := "imperio/api/base_url_mobile" if OS.has_feature("mobile") else "imperio/api/base_url"
	base_url = env_url if env_url != "" else str(
		ProjectSettings.get_setting(key, "http://127.0.0.1:3000/api/v1")
	)


## Garante um token válido: retoma a conta convidada salva ou cria uma nova.
## Retorna o mesmo formato de resposta de `_send`.
func authenticate() -> Dictionary:
	var session := ConfigFile.new()
	var has_session := session.load(session_path) == OK
	var body := {}
	if has_session:
		body = {
			"guestId": session.get_value("guest", "guest_id", ""),
			"guestSecret": session.get_value("guest", "guest_secret", ""),
		}

	var res := await _send(HTTPClient.METHOD_POST, "/auth/guest", body)
	if not res.ok and has_session and res.status == 401:
		# Conta salva não existe mais no servidor (ex.: banco local recriado).
		push_warning("Conta convidada salva foi recusada; criando uma nova.")
		res = await _send(HTTPClient.METHOD_POST, "/auth/guest", {})

	if res.ok:
		_token = res.data.accessToken
		if res.data.has("guestSecret"):
			session.set_value("guest", "guest_id", res.data.guestId)
			session.set_value("guest", "guest_secret", res.data.guestSecret)
			session.save(session_path)
	return res


func get_state() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/player/state", null, "")


func purchase(slug: String) -> Dictionary:
	return await _command("/businesses/purchase", {"businessSlug": slug})


## `times`: toques rápidos no mesmo negócio viram um comando só (o servidor sobe até N níveis).
func upgrade(slug: String, times := 1) -> Dictionary:
	var body := {"businessSlug": slug}
	if times > 1:
		body.times = times
	return await _command("/businesses/upgrade", body)


func collect(slug := "") -> Dictionary:
	return await _command("/production/collect", {"businessSlug": slug} if slug != "" else {})


func hire_manager(slug: String) -> Dictionary:
	return await _command("/managers/hire", {"businessSlug": slug})


## Presença no mapa (ADR 0006): ao abrir, ao trocar de mapa e a cada ~15 s. Ao entrar num
## mapa o servidor paga o AFK dos ajudantes dele.
func presence(district: String) -> Dictionary:
	return await _command("/presence", {"district": district})


func missions() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/missions", null, "")


func claim_mission(mission_id: String) -> Dictionary:
	return await _command("/missions/claim", {"missionId": mission_id})


func achievements() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/achievements", null, "")


func claim_achievement(achievement_id: String) -> Dictionary:
	return await _command("/achievements/claim", {"achievementId": achievement_id})


func leaderboard() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/leaderboard", null, "")


## Eventos de interface (o servidor só aceita os da lista permitida).
func send_events(events: Array) -> Dictionary:
	return await _authed(HTTPClient.METHOD_POST, "/analytics/events", {"events": events}, "")


# --- Loja, compras e anúncios (ADR 0008) ---

func store_catalog(district := "praia") -> Dictionary:
	# A plataforma decide se a loja paga aparece (compras podem abrir só no iPhone — ADR 0022).
	var platform := "ios" if OS.get_name() == "iOS" else ("android" if OS.get_name() == "Android" else "other")
	return await _authed(HTTPClient.METHOD_GET, "/store/catalog?district=%s&platform=%s" % [district, platform], null, "")


func vip_daily() -> Dictionary:
	return await _command("/vip/daily", {})


## Troca de nome (permitida uma vez; o servidor valida).
func change_name(display_name: String) -> Dictionary:
	return await _authed(HTTPClient.METHOD_POST, "/player/name", {"displayName": display_name}, "")


## Denúncia de nome impróprio no ranking (diretriz 1.2 da App Store).
func report_player(player_id: String) -> Dictionary:
	return await _authed(HTTPClient.METHOD_POST, "/players/report", {"playerId": player_id}, "")


## Prestígio — "Vender o império" (ADR 0011).
func prestige() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/prestige", null, "")


func sell_empire() -> Dictionary:
	return await _command("/prestige", {})


## Exclusão de conta (LGPD, ADR 0009): irreversível. Esquece a sessão salva no aparelho.
func delete_account() -> Dictionary:
	var res := await _authed(HTTPClient.METHOD_POST, "/player/delete", {"confirm": "EXCLUIR"}, "")
	if res.ok:
		forget_session()
	return res


## Apaga o token e a conta convidada salva (a próxima autenticação cria uma conta nova).
func forget_session() -> void:
	_token = ""
	if FileAccess.file_exists(session_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(session_path))


## `times`: toques rápidos no mesmo item viram um comando só (o servidor compra até N).
func store_buy(item_id: String, district := "", times := 1) -> Dictionary:
	var body := {"itemId": item_id}
	if district != "":
		body.district = district
	if times > 1:
		body.times = times
	return await _command("/store/buy", body)


## `district`: mapa atual (a coleta antecipada dos pacotes promocionais é entregue nele).
func verify_purchase(store: String, product_id: String, token: String, district := "") -> Dictionary:
	var body := {"store": store, "productId": product_id, "purchaseToken": token}
	if district != "":
		body.district = district
	return await _command("/purchases/verify", body)


func restore_purchases() -> Dictionary:
	return await _authed(HTTPClient.METHOD_POST, "/purchases/restore", {}, "")


func ad_start(placement: String, district := "") -> Dictionary:
	var platform := "ios" if OS.get_name() == "iOS" else ("android" if OS.get_name() == "Android" else "other")
	var body := {"placement": placement, "platform": platform}  # anúncios por plataforma (ADR 0023)
	if district != "":
		body.district = district
	return await _command("/ads/start", body)


## Somente modo de teste: confirma no servidor que o "anúncio de teste" terminou.
func ad_mock_complete(session_id: String) -> Dictionary:
	return await _authed(HTTPClient.METHOD_POST, "/ads/mock-complete", {"sessionId": session_id}, "")


func ad_claim(session_id: String) -> Dictionary:
	return await _command("/ads/claim", {"sessionId": session_id})


# --- Contas vinculadas (ADR 0015) ---

func identities() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/auth/identities", null, "")


func link_identity(provider: String, id_token: String) -> Dictionary:
	return await _authed(HTTPClient.METHOD_POST, "/auth/link", {"provider": provider, "idToken": id_token}, "")


## Entra no progresso já ligado a essa conta Google/Apple (outro aparelho): passa a usar a conta
## convidada dela neste aparelho (o servidor troca o segredo; o aparelho antigo pede login de novo).
func social_sign_in(provider: String, id_token: String) -> Dictionary:
	var res := await _send(HTTPClient.METHOD_POST, "/auth/social", {"provider": provider, "idToken": id_token})
	if res.ok:
		_token = res.data.accessToken
		var session := ConfigFile.new()
		session.set_value("guest", "guest_id", res.data.guestId)
		session.set_value("guest", "guest_secret", res.data.guestSecret)
		session.save(session_path)
	return res


# --- Retenção (ADR 0014) ---

func daily_reward() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/daily-reward", null, "")


func claim_daily_reward() -> Dictionary:
	return await _command("/daily-reward/claim", {})


func open_mission_chest() -> Dictionary:
	return await _command("/missions/chest", {})


func weekend_event() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/event", null, "")


func claim_event() -> Dictionary:
	return await _command("/event/claim", {})


func weekly_rewards() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/rewards/weekly", null, "")


func claim_weekly_reward(week: String, kind: String) -> Dictionary:
	return await _command("/rewards/weekly/claim", {"week": week, "kind": kind})


func leaderboard_stars() -> Dictionary:
	return await _authed(HTTPClient.METHOD_GET, "/leaderboard/stars", null, "")


func complete_tutorial() -> Dictionary:
	return await _authed(HTTPClient.METHOD_POST, "/tutorial/complete", {}, "")


static func new_idempotency_key() -> String:
	return Crypto.new().generate_random_bytes(16).hex_encode()


## Comando econômico: a mesma Idempotency-Key é reutilizada nas novas tentativas,
## então uma falha de rede depois do servidor ter aplicado o comando não duplica nada.
func _command(path: String, body: Dictionary) -> Dictionary:
	var key := new_idempotency_key()
	var res := {}
	for attempt in COMMAND_ATTEMPTS:
		res = await _authed(HTTPClient.METHOD_POST, path, body, key)
		if not res.network_error:
			return res
		await get_tree().create_timer(0.5 * pow(2, attempt)).timeout
	return res


func _authed(method: int, path: String, body: Variant, idempotency_key: String) -> Dictionary:
	if _token == "":
		var auth := await authenticate()
		if not auth.ok:
			return auth
	var res := await _send(method, path, body, idempotency_key)
	if res.status == 401:
		var auth := await authenticate()
		if not auth.ok:
			return auth
		res = await _send(method, path, body, idempotency_key)
	return res


## Envia uma requisição e normaliza a resposta:
## { ok, status, data, error_code, network_error }.
func _send(method: int, path: String, body: Variant, idempotency_key := "") -> Dictionary:
	# Versão do jogo: o servidor só abre a loja do Google e os anúncios no Android a partir da
	# versão com os plugins (ADR 0028).
	var headers := PackedStringArray(["Accept: application/json",
			"X-App-Version: " + str(ProjectSettings.get_setting("application/config/version", ""))])
	var payload := ""
	if body != null:
		headers.append("Content-Type: application/json")
		payload = JSON.stringify(body)
	if _token != "":
		headers.append("Authorization: Bearer " + _token)
	if idempotency_key != "":
		headers.append("Idempotency-Key: " + idempotency_key)

	var http := HTTPRequest.new()
	http.timeout = 10.0
	add_child(http)
	var err := http.request(base_url + path, headers, method, payload)
	if err != OK:
		http.queue_free()
		push_warning("Api: requisição não iniciou (erro %d) %s" % [err, base_url + path])
		return _network_failure()
	var result: Array = await http.request_completed
	http.queue_free()

	if result[0] != HTTPRequest.RESULT_SUCCESS:
		# Sem dados pessoais: só o código do HTTPRequest (ex.: 5 = TLS, 3 = conexão) e a rota.
		push_warning("Api: falha de rede (result %d) %s" % [result[0], base_url + path])
		return _network_failure()
	var status: int = result[1]
	var text: String = (result[3] as PackedByteArray).get_string_from_utf8()
	var data: Variant = JSON.parse_string(text) if text != "" else {}
	if typeof(data) != TYPE_DICTIONARY:
		data = {}
	var ok := status >= 200 and status < 300
	var error_code := ""
	if not ok:
		error_code = str(data.get("error", {}).get("code", "HTTP_%d" % status))
	return {
		"ok": ok, "status": status, "data": data,
		"error_code": error_code, "network_error": false,
	}


func _network_failure() -> Dictionary:
	return {
		"ok": false, "status": 0, "data": {},
		"error_code": "NETWORK_ERROR", "network_error": true,
	}
