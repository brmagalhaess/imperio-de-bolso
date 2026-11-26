## Compras da App Store (StoreKit 2) pelo Godot Apple Plugins — ADR 0022.
## O servidor é a autoridade: cada transação vai para /purchases/verify (loja "apple", com o
## jwsRepresentation assinado pela Apple) e só depois de aceita é finalizada (`finish()`).
## Transação não finalizada (app fechado no meio) volta pelo `transaction_updated` no próximo
## start() e é entregue de novo — o servidor ignora a repetida.
extends Node

const VERIFY_ATTEMPTS := 3

var _skm: Object
var _products := {}  # productId → StoreProduct
var _waiting := {}  # productId → {done, ok, message}
var _restore := {"done": false, "ok": false}


static func available() -> bool:
	return OS.get_name() == "iOS" and ClassDB.class_exists("StoreKitManager")


func _ready() -> void:
	if not available():
		return
	_skm = ClassDB.instantiate("StoreKitManager")
	_skm.connect("products_request_completed", _on_products)
	_skm.connect("purchase_completed", _on_purchase_completed)
	_skm.connect("transaction_updated", _on_transaction)
	_skm.connect("restore_completed", _on_restore_completed)
	_skm.connect("current_entitlements_fetch_completed", _on_entitlements)
	_skm.call("start")


## Busca preço/nome localizados na App Store (chame com os productIds do catálogo).
func load_products(ids: Array) -> void:
	if _skm == null or ids.is_empty():
		return
	_skm.call("request_products", PackedStringArray(ids))


## Preço como a App Store mostra ("R$ 4,90"); vazio se ainda não carregou.
func price(product_id: String) -> String:
	var p: Object = _products.get(product_id)
	return str(p.get("display_price")) if p != null else ""


## Abre a folha de compra da Apple. Devolve {ok, message}; cancelado = ok falso e message "".
func buy(product_id: String) -> Dictionary:
	if _skm == null:
		return {"ok": false, "message": "unavailable"}
	if not _products.has(product_id):
		load_products([product_id])
		for i in 100:  # até ~5 s esperando o preço chegar
			if _products.has(product_id):
				break
			await get_tree().create_timer(0.05).timeout
	var product: Object = _products.get(product_id)
	if product == null:
		return {"ok": false, "message": "PRODUCT_NOT_FOUND"}
	var wait := {"done": false, "ok": false, "message": ""}
	_waiting[product_id] = wait
	_skm.call("purchase", product)
	while not wait.done:
		await get_tree().process_frame
	_waiting.erase(product_id)
	return {"ok": wait.ok, "message": wait.message}


## Restaurar compras: a Apple sincroniza e reenviamos as assinaturas ativas ao servidor.
func restore() -> bool:
	if _skm == null:
		return false
	_restore = {"done": false, "ok": false}
	_skm.call("restore_purchases")
	while not _restore.done:
		await get_tree().process_frame
	return _restore.ok


func _on_products(products: Array, _status: int) -> void:
	for p in products:
		if p != null:
			_products[str(p.get("product_id"))] = p


func _on_purchase_completed(transaction: Object, status: int, message: String) -> void:
	var product_id := str(transaction.get("product_id")) if transaction != null else ""
	# OK = 0; USER_CANCELLED = 4; PURCHASE_PENDING = 5 (aprovação dos pais / banco).
	var ok := status == 0 and transaction != null and await _deliver(transaction)
	var key: String = product_id if _waiting.has(product_id) else (_waiting.keys()[0] if _waiting.size() == 1 else "")
	if key != "":
		_waiting[key].ok = ok
		_waiting[key].message = "" if status == 4 else ("PURCHASE_PENDING" if status == 5 else (message if not ok else ""))
		_waiting[key].done = true


## Renovações, compras feitas fora do app e transações que ficaram sem entregar.
func _on_transaction(transaction: Object) -> void:
	if transaction != null:
		await _deliver(transaction)


func _on_restore_completed(status: int, _message: String) -> void:
	if status != 0:
		_restore.ok = false
		_restore.done = true
		return
	_skm.call("fetch_current_entitlements")


func _on_entitlements(entitlements: Array) -> void:
	for t in entitlements:
		if t != null:
			await _deliver(t)
	_restore.ok = true
	_restore.done = true


## Manda o recibo ao servidor; finaliza na Apple só se o servidor aceitou (ou já tinha).
func _deliver(transaction: Object) -> bool:
	var jws := str(transaction.get("jws_representation"))
	var product_id := str(transaction.get("product_id"))
	for attempt in VERIFY_ATTEMPTS:
		var res := await GameState.verify_store_purchase("apple", product_id, jws)
		if res.ok or res.error_code in ["PURCHASE_REVOKED", "PURCHASE_EXPIRED", "PURCHASE_INVALID", "PURCHASE_OWNED_BY_OTHER"]:
			transaction.call("finish")  # entregue ou definitivamente recusado: não reenviar
			return res.ok
		if not res.get("network_error", false):
			return false
		await get_tree().create_timer(1.0 + attempt).timeout
	return false  # sem rede: fica pendente na Apple e volta no próximo start()
