## Compras do Google Play (Billing Library) pelo plugin oficial GodotGooglePlayBilling 3.3.
## Mesma interface da loja da Apple (scripts/apple_store.gd). O servidor é a autoridade: cada
## compra vai para /purchases/verify (loja "google", com o purchaseToken) e só depois de aceita
## é consumida (diamantes/pacotes/Dobro) ou reconhecida (Passe VIP). Compra que ficou sem
## entregar (app fechado no meio) e renovações da assinatura voltam pelo queryPurchases ao abrir
## o jogo e são enviadas de novo — o servidor ignora a repetida.
extends Node

const VERIFY_ATTEMPTS := 3
const SINGLETON := "GodotGooglePlayBilling"
# Purchase.PurchaseState do Google: 1 = paga, 2 = pendente (boleto, aprovação da família).
const STATE_PURCHASED := 1
const STATE_PENDING := 2
const USER_CANCELED := 1

var _bp: Object
var _connected := false
var _wanted: Array = []  # productIds pedidos antes de conectar
var _products := {}  # productId → ProductDetails (Dictionary do plugin)
var _waiting := {}  # productId → {done, ok, message}
var _queries := 0  # consultas de compras em andamento (restaurar)


static func available() -> bool:
	return OS.get_name() == "Android" and Engine.has_singleton(SINGLETON)


func _ready() -> void:
	if not available():
		return
	_bp = Engine.get_singleton(SINGLETON)
	_bp.call("initPlugin")
	_bp.connect("connected", _on_connected)
	_bp.connect("disconnected", func(): _connected = false)
	_bp.connect("query_product_details_response", _on_products)
	_bp.connect("query_purchases_response", _on_purchases_query)
	_bp.connect("on_purchase_updated", _on_purchase_updated)
	_bp.call("startConnection")


func _on_connected() -> void:
	_connected = true
	if not _wanted.is_empty():
		load_products(_wanted)
	_query_owned()  # entrega pendentes e renovações


## Busca preço/nome localizados no Google Play (os dois tipos: avulso e assinatura).
func load_products(ids: Array) -> void:
	if _bp == null or ids.is_empty():
		return
	_wanted = ids
	if not _connected:
		return
	_bp.call("queryProductDetails", PackedStringArray(ids), "inapp")
	_bp.call("queryProductDetails", PackedStringArray(ids), "subs")


## Preço como o Google Play mostra ("R$ 4,90"); vazio se ainda não carregou.
func price(product_id: String) -> String:
	var d: Dictionary = _products.get(product_id, {})
	if d.is_empty():
		return ""
	var one: Variant = d.get("one_time_purchase_offer_details_list")
	if one is Array and not one.is_empty():
		return str(one[0].get("formatted_price", ""))
	var plan := _base_offer(d)
	var phases: Array = plan.get("pricing_phases", [])
	return str(phases[-1].get("formatted_price", "")) if not phases.is_empty() else ""


## Abre a folha de compra do Google. Devolve {ok, message}; cancelado = ok falso e message "".
func buy(product_id: String) -> Dictionary:
	if _bp == null:
		return {"ok": false, "message": "unavailable"}
	if not _products.has(product_id):
		load_products(_wanted if _wanted.has(product_id) else _wanted + [product_id])
		for i in 100:  # até ~5 s esperando os detalhes chegarem
			if _products.has(product_id):
				break
			await get_tree().create_timer(0.05).timeout
	var d: Dictionary = _products.get(product_id, {})
	if d.is_empty():
		return {"ok": false, "message": "PRODUCT_NOT_FOUND"}
	var wait := {"done": false, "ok": false, "message": ""}
	_waiting[product_id] = wait
	var started: Dictionary
	if str(d.get("product_type", "")) == "subs":
		started = _bp.call("purchaseSubscription", product_id, str(_base_offer(d).get("base_plan_id", "")), "", false)
	else:
		started = _bp.call("purchase", product_id, "", "", false)
	if int(started.get("response_code", -1)) != 0:
		_waiting.erase(product_id)
		return {"ok": false, "message": "" if int(started.get("response_code", -1)) == USER_CANCELED else "unavailable"}
	while not wait.done:
		await get_tree().process_frame
	_waiting.erase(product_id)
	return {"ok": wait.ok, "message": wait.message}


## Restaurar compras: reenvia ao servidor tudo que o Google ainda tem nesta conta.
func restore() -> bool:
	if _bp == null or not _connected:
		return false
	_query_owned()
	while _queries > 0:
		await get_tree().process_frame
	return true


## Tela de assinaturas do Google Play (cancelar/trocar é sempre pela loja).
func manage(product_id: String) -> void:
	if _bp != null:
		_bp.call("openSubscriptions", product_id)
	else:
		OS.shell_open("https://play.google.com/store/account/subscriptions")


func _query_owned() -> void:
	_queries += 2
	_bp.call("queryPurchases", "inapp", false)
	_bp.call("queryPurchases", "subs", false)


## Plano base da assinatura (a oferta sem desconto): é ele que o jogo compra.
static func _base_offer(d: Dictionary) -> Dictionary:
	var offers: Variant = d.get("subscription_offer_details")
	if not (offers is Array) or offers.is_empty():
		return {}
	for o in offers:
		if o.get("offer_id") == null or str(o.get("offer_id")) == "":
			return o
	return offers[0]


func _on_products(res: Dictionary) -> void:
	if int(res.get("response_code", -1)) != 0:
		return
	for d in res.get("product_details", []):
		if d is Dictionary:
			_products[str(d.get("product_id"))] = d


func _on_purchases_query(res: Dictionary) -> void:
	if int(res.get("response_code", -1)) == 0:
		for p in res.get("purchases", []):
			if p is Dictionary and int(p.get("purchase_state", 0)) == STATE_PURCHASED:
				await _deliver(p)
	_queries = max(_queries - 1, 0)


func _on_purchase_updated(res: Dictionary) -> void:
	var code := int(res.get("response_code", -1))
	var purchases: Array = res.get("purchases", []) if code == 0 else []
	if purchases.is_empty():
		# Cancelado (1) ou erro: libera quem está esperando.
		for key in _waiting.keys():
			_waiting[key].message = "" if code == USER_CANCELED else "unavailable"
			_waiting[key].done = true
		return
	for p in purchases:
		if not (p is Dictionary):
			continue
		var ids: Array = Array(p.get("product_ids", []))
		var product_id: String = str(ids[0]) if not ids.is_empty() else ""
		var state := int(p.get("purchase_state", 0))
		var ok := state == STATE_PURCHASED and await _deliver(p)
		var key: String = product_id if _waiting.has(product_id) else (_waiting.keys()[0] if _waiting.size() == 1 else "")
		if key != "":
			_waiting[key].ok = ok
			_waiting[key].message = "PURCHASE_PENDING" if state == STATE_PENDING else ("" if ok else "unavailable")
			_waiting[key].done = true


## Manda o token ao servidor; consome/reconhece no Google só se o servidor aceitou (ou recusou
## de vez). Sem rede, fica pendente no Google e volta no próximo queryPurchases.
func _deliver(p: Dictionary) -> bool:
	var token := str(p.get("purchase_token", ""))
	var ids: Array = Array(p.get("product_ids", []))
	if token == "" or ids.is_empty():
		return false
	var product_id := str(ids[0])
	var is_sub := str(_products.get(product_id, {}).get("product_type", "")) == "subs" \
			or product_id.ends_with(".vip_monthly")
	for attempt in VERIFY_ATTEMPTS:
		var res := await GameState.verify_store_purchase("google", product_id, token)
		if res.ok or res.error_code in ["PURCHASE_REVOKED", "PURCHASE_EXPIRED", "PURCHASE_INVALID"]:
			if is_sub:
				if not bool(p.get("is_acknowledged", false)):
					_bp.call("acknowledgePurchase", token)
			else:
				_bp.call("consumePurchase", token)
			return res.ok
		if not res.get("network_error", false):
			return false
		await get_tree().create_timer(1.0 + attempt).timeout
	return false
