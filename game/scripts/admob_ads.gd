## Anúncios recompensados reais (AdMob) no iPhone e no Android — ADR 0023/0028. Plugin da
## Poing Studios (instalado por tools/apple/fetch_admob.sh, fora do Git): os scripts dele são
## carregados aqui por caminho, então sem o plugin (CI, computador) `available()` é falso e o jogo
## usa o anúncio de teste. O servidor ainda decide por plataforma (ADS_PLATFORMS). O prêmio é decidido pelo servidor: o sessionId vai no custom_data do SSV e o Google
## confirma direto na API (/ads/ssv) antes do resgate.
extends Node

const API := "res://addons/admob/gdscript/src/"
## Blocos de anúncio de teste do Google. O real (imperio/ads/<ios|android>_rewarded_unit) só vale
## no build de release: no de desenvolvimento ver o próprio anúncio real conta como tráfego inválido.
const TEST_UNIT_IOS := "ca-app-pub-3940256099942544/1712485313"
const TEST_UNIT_ANDROID := "ca-app-pub-3940256099942544/5224354917"

var _started := false
var _initialized := false
var _ad: Object
var _loading := false
var _show := {"done": true, "earned": false}


static func available() -> bool:
	return OS.get_name() in ["iOS", "Android"] and ResourceLoader.exists(API + "api/MobileAds.gd")


func unit_id() -> String:
	var android := OS.get_name() == "Android"
	var configured := str(ProjectSettings.get_setting(
			"imperio/ads/android_rewarded_unit" if android else "imperio/ads/ios_rewarded_unit", ""))
	if configured != "" and not OS.is_debug_build():
		return configured
	return TEST_UNIT_ANDROID if android else TEST_UNIT_IOS


## Consentimento (UMP: LGPD/GDPR e, se configurado no AdMob, a pergunta de rastreamento da
## Apple) e depois o SDK. Chamar quando a Loja abrir ou o primeiro anúncio for pedido.
func start() -> void:
	if _started or not available():
		return
	_started = true
	var ump: GDScript = load(API + "ump/api/UserMessagingPlatform.gd")
	var params: Object = load(API + "ump/core/ConsentRequestParameters.gd").new()
	ump.consent_information.update(params, func(): _load_consent_form(ump), func(_err): _init_sdk())


func _load_consent_form(ump: GDScript) -> void:
	if not ump.consent_information.get_is_consent_form_available():
		_init_sdk()
		return
	ump.load_consent_form(func(form: Object):
		# ConsentStatus.REQUIRED = 2 (UNKNOWN 0, NOT_REQUIRED 1, OBTAINED 3).
		if int(ump.consent_information.get_consent_status()) == 2:
			form.show(func(_err): _init_sdk())
		else:
			_init_sdk(), func(_err): _init_sdk())


func _init_sdk() -> void:
	if _initialized:
		return
	var mobile_ads: GDScript = load(API + "api/MobileAds.gd")
	var listener: Object = load(API + "api/listeners/OnInitializationCompleteListener.gd").new()
	listener.on_initialization_complete = func(_status): _on_sdk_ready()
	mobile_ads.initialize(listener)


func _on_sdk_ready() -> void:
	_initialized = true
	print("AdMob: SDK pronto")
	_load_ad()


func _load_ad() -> void:
	if _loading or _ad != null or not _initialized:
		return
	_loading = true
	var callback: Object = load(API + "api/listeners/RewardedAdLoadCallback.gd").new()
	callback.on_ad_loaded = func(ad: Object):
		_loading = false
		_ad = ad
	callback.on_ad_failed_to_load = func(error: Object):
		_loading = false
		print("AdMob: anúncio não carregou (", error.message, ")")
	load(API + "api/RewardedAdLoader.gd").new().load(unit_id(), load(API + "api/core/AdRequest.gd").new(), callback)


## Mostra o anúncio ligado à sessão do servidor. Devolve {shown, earned}: shown falso = não havia
## anúncio pronto (o jogo avisa para tentar de novo); earned = o usuário assistiu até o fim.
func show_rewarded(session_id: String) -> Dictionary:
	if not available():
		return {"shown": false, "earned": false}
	start()
	for i in 80:  # até ~8 s esperando consentimento + carregamento
		if _ad != null:
			break
		_load_ad()
		await get_tree().create_timer(0.1).timeout
	if _ad == null:
		return {"shown": false, "earned": false}
	var ad := _ad
	_ad = null
	var ssv: Object = load(API + "api/core/ServerSideVerificationOptions.gd").new()
	ssv.custom_data = session_id
	ad.set_server_side_verification_options(ssv)
	_show = {"done": false, "earned": false}
	var content: Object = load(API + "api/listeners/FullScreenContentCallback.gd").new()
	content.on_ad_dismissed_full_screen_content = func(): _show.done = true
	content.on_ad_failed_to_show_full_screen_content = func(_err): _show.done = true
	ad.full_screen_content_callback = content
	var reward: Object = load(API + "api/listeners/OnUserEarnedRewardListener.gd").new()
	reward.on_user_earned_reward = func(_item): _show.earned = true
	ad.show(reward)
	while not _show.done:
		await get_tree().process_frame
	ad.destroy()
	_load_ad()  # já deixa o próximo pronto
	return {"shown": true, "earned": _show.earned}
