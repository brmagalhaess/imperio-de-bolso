## Ilha da Praia: fundo, lotes, decoração e clientes, com ordem de pintura por altura (y-sort).
## Toque na bolha de moeda coleta; toque no lote abre o painel do negócio.
extends Node2D

signal lot_selected(slug: String)

const Layout := preload("res://scripts/layout.gd")
const BusinessLot := preload("res://scripts/business_lot.gd")
const Walker := preload("res://scripts/walker.gd")
const FloatingText := preload("res://scripts/floating_text.gd")
const Fmt := preload("res://scripts/fmt.gd")

const TAP_MAX_DRAG := 16.0

var lots := {}  # slug → BusinessLot
var selected_slug := ""
var _sorted: Node2D
var _press_pos := Vector2.ZERO


func _ready() -> void:
	var sea := ColorRect.new()
	sea.color = Layout.SEA_COLOR
	sea.position = Vector2(-1000, -1000)
	sea.size = Vector2(2720, 3280)
	sea.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(sea)

	var bg := Sprite2D.new()
	bg.texture = load("res://assets/optimized/island_base.jpg")
	bg.centered = false
	bg.scale = Vector2(720, 1280) / bg.texture.get_size()
	add_child(bg)

	_sorted = Node2D.new()
	_sorted.y_sort_enabled = true
	add_child(_sorted)

	for d in Layout.DECOR:
		var s := Sprite2D.new()
		s.texture = Layout.texture(d[0])
		s.scale = Vector2.ONE * Layout.ART_SCALE
		s.offset = Vector2(0, -s.texture.get_height() / 2.0)
		s.position = d[1]
		_sorted.add_child(s)

	for slug in Layout.ISLAND_LOTS:
		var lot := BusinessLot.new(slug)
		lot.position = Layout.ISLAND_LOTS[slug]
		_sorted.add_child(lot)
		lots[slug] = lot

	for i in Layout.WALKERS.size():
		_sorted.add_child(Walker.new(Layout.WALKERS[i], Layout.WAYPOINTS[i * 2 % Layout.WAYPOINTS.size()]))

	# Vendedor fixo ao lado do carrinho de água (aparece quando comprado).
	var vendor := Sprite2D.new()
	vendor.name = "Vendor"
	vendor.texture = Layout.texture("char_vendor")
	vendor.scale = Vector2.ONE * Layout.CHAR_SCALE
	vendor.offset = Vector2(0, -vendor.texture.get_height() / 2.0)
	vendor.position = Layout.ISLAND_LOTS["agua"] + Vector2(-78, 16)
	vendor.visible = false
	_sorted.add_child(vendor)

	var camera: Camera2D = get_node_or_null("../Camera2D")
	if camera:
		camera.position = Layout.CAMERA_CENTER
		camera.zoom = Vector2.ONE * Layout.CAMERA_ZOOM

	GameState.state_changed.connect(_sync)
	GameState.collected.connect(_on_collected)
	_sync()


func _sync() -> void:
	for b in GameState.businesses():
		if lots.has(b.slug):
			lots[b.slug].update_from(b)
	var agua := GameState.business("agua")
	_sorted.get_node("Vendor").visible = agua.get("owned", false)


func select(slug: String) -> void:
	selected_slug = slug
	for s in lots:
		lots[s].selected = s == slug
	lot_selected.emit(slug)


func _on_collected(items: Array) -> void:
	for item in items:
		if lots.has(item.slug):
			var lot: Node2D = lots[item.slug]
			add_child(FloatingText.new("+" + Fmt.coins(item.amount), lot.position + lot.bubble_position()))


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_press_pos = event.position
		elif event.position.distance_to(_press_pos) <= TAP_MAX_DRAG:
			_handle_tap(event.position)


func _handle_tap(screen_pos: Vector2) -> void:
	var world := get_canvas_transform().affine_inverse() * screen_pos
	# Do mais à frente (maior y) para o mais ao fundo.
	var ordered: Array = lots.values()
	ordered.sort_custom(func(a, b): return a.position.y > b.position.y)
	for lot in ordered:
		var local: Vector2 = world - lot.position
		# Moeda: só coleta, sem abrir o painel (coleta rápida e repetida).
		if lot.hits_bubble(local):
			GameState.collect(lot.slug)
			get_viewport().set_input_as_handled()
			return
		if lot.hits(local):
			select(lot.slug)
			get_viewport().set_input_as_handled()
			return
