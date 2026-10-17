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
		var raw: Variant = credential.get("identityToken") if credential != null else null
		if raw is PackedByteArray and not (raw as PackedByteArray).is_empty():
			result.token = (raw as PackedByteArray).get_string_from_utf8()
		else:
			result.error = "no_token"
		done[0] = true)
	ctl.connect("authorization_failed", func(message: String) -> void:
		result.error = message
		done[0] = true)
	ctl.call("signin")
	var loop := Engine.get_main_loop() as SceneTree
	while not done[0]:
		await loop.process_frame
	return result
