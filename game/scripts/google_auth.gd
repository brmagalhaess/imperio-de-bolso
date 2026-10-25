## Login com Google e atualização dentro do app no Android (ADR 0032) pelo plugin próprio
## ImperioAndroid (fonte em tools/android/imperio-plugin). Sem o plugin (iPhone, CI)
## `available()` é falso.
## Só pede o ID token (JWT) com o público do cliente "web" do projeto: o servidor valida e vincula.
extends RefCounted

const SINGLETON := "ImperioAndroid"


static func available() -> bool:
	return OS.get_name() == "Android" and Engine.has_singleton(SINGLETON)


## Atualização dentro do app do Google Play (tela cheia: baixa, instala e reinicia). Devolve
## true se a Play Store assumiu a atualização; false = não há (ou não deu) — aí vale o aviso.
static func start_store_update() -> bool:
	if not available():
		return false
	var plugin: Object = Engine.get_singleton(SINGLETON)
	if not plugin.has_method("checkForUpdate"):
		return false
	var result := {"started": false, "done": false}
	var started := func() -> void:
		result.started = true
		result.done = true
	var none := func(_reason: String) -> void:
		result.done = true
	plugin.connect("update_started", started)
	plugin.connect("update_not_available", none)
	plugin.call("checkForUpdate")
	var loop := Engine.get_main_loop() as SceneTree
	var waited := 0.0
	while not result.done and waited < 8.0:
		await loop.process_frame
		waited += loop.root.get_process_delta_time()
	plugin.disconnect("update_started", started)
	plugin.disconnect("update_not_available", none)
	return result.started


## Abre o "Entrar com Google" do Android e devolve {token, error}; token vazio = cancelado/falhou.
static func request_token() -> Dictionary:
	var result := {"token": "", "error": ""}
	if not available():
		result.error = "unavailable"
		return result
	var plugin: Object = Engine.get_singleton(SINGLETON)
	var done := [false]
	var ok := func(token: String) -> void:
		result.token = token
		done[0] = true
	var fail := func(reason: String) -> void:
		result.error = reason
		done[0] = true
	plugin.connect("google_id_token", ok)
	plugin.connect("google_sign_in_failed", fail)
	plugin.call("googleSignIn", str(ProjectSettings.get_setting("imperio/auth/google_web_client_id", "")))
	var loop := Engine.get_main_loop() as SceneTree
	while not done[0]:
		await loop.process_frame
	plugin.disconnect("google_id_token", ok)
	plugin.disconnect("google_sign_in_failed", fail)
	return result
