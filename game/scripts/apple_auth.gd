## Login com Apple no iPhone (ADR 0015) pelo Godot Apple Plugins — AuthenticationServices
## (instalado por tools/apple/fetch_plugins.sh). Sem o plugin (Android, CI) `available()` é falso.
## Só pede o identity token (JWT): nome e e-mail não são solicitados nem guardados.
extends RefCounted


static func available() -> bool:
	return OS.get_name() == "iOS" and ClassDB.class_exists("ASAuthorizationController")


## Abre a folha da Apple e devolve {token, error}; token vazio = cancelado ou falhou.
static func request_token() -> Dictionary:
	var result := {"token": "", "error": ""}
	if not available():
		result.error = "unavailable"
		return result
	var ctl: Object = ClassDB.instantiate("ASAuthorizationController")
	var done := [false]  # (lambda copia variáveis: muta o array, não reatribui)
	ctl.connect("authorization_completed", func(credential: Object) -> void:
		result.token = token_of(credential)
		if result.token == "":
			result.error = "no_token"
		done[0] = true)
	ctl.connect("authorization_failed", func(message: String) -> void:
		result.error = message
		done[0] = true)
	ctl.call("signin")
	print("AppleAuth: aguardando a folha da Apple")
	var loop := Engine.get_main_loop() as SceneTree
	while not done[0]:
		await loop.process_frame
	return result


## O plugin expõe o JWT como `identity_token` (getter `get_identity_token`); bytes UTF-8 ou texto.
static func token_of(credential: Object) -> String:
	if credential == null:
		return ""
	var raw: Variant = null
	for prop in ["identity_token", "identityToken"]:
		raw = credential.get(prop)
		if raw != null:
			break
	if raw == null and credential.has_method("get_identity_token"):
		raw = credential.call("get_identity_token")
	if raw is PackedByteArray:
		return (raw as PackedByteArray).get_string_from_utf8()
	if raw is String:
		return raw
	return ""
