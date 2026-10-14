## Um distrito do mapa (Ilha da Praia, Cidade): cenário, lotes, decoração e pessoas, com
## ordem de pintura por altura (y-sort). Toque na moeda coleta; toque no lote abre o painel.
extends Node2D

signal lot_selected(slug: String)

const Layout := preload("res://scripts/layout.gd")
const BusinessLot := preload("res://scripts/business_lot.gd")
const Walker := preload("res://scripts/walker.gd")
const FloatingText := preload("res://scripts/floating_text.gd")
const Fmt := preload("res://scripts/fmt.gd")

## Quanto o dedo pode escorregar entre tocar e soltar e ainda contar como toque (pixels da
## resolução base 720×1280; dedos reais se mexem bem mais que o mouse).
const TAP_MAX_DRAG := 40.0

var district := ""
var config: Dictionary
var lots := {}  # slug → BusinessLot
var _helpers := {}  # slug → Sprite2D do ajudante (visível quando contratado)
var _sorted: Node2D
var _press_pos := Vector2.ZERO


func _init(p_district: String) -> void:
	district = p_district
	name = p_district.capitalize()
	config = Layout.DISTRICTS[p_district]


func _ready() -> void:
	# Cores do cenário estendidas para telas mais altas que 9:16.
	for half in [[config.top_color, -1000.0], [config.bottom_color, 640.0]]:
		var fill := ColorRect.new()
		fill.color = half[0]
		fill.position = Vector2(-1000, half[1])
		fill.size = Vector2(2720, 1640)
		fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(fill)

	var bg := Sprite2D.new()
	bg.texture = load("res://assets/optimized/%s" % config.base)
	bg.centered = false
	bg.scale = Vector2(720, 1280) / bg.texture.get_size()
	add_child(bg)

	_sorted = Node2D.new()
	_sorted.y_sort_enabled = true
	add_child(_sorted)

	for d in config.decor:
		var s := Sprite2D.new()
		s.texture = Layout.texture(d[0])
		s.scale = Vector2.ONE * Layout.ART_SCALE
		s.offset = Vector2(0, -s.texture.get_height() / 2.0)
		s.position = d[1]
		_sorted.add_child(s)

	for slug in config.lots:
		var lot := BusinessLot.new(slug)
		lot.position = config.lots[slug]
		_sorted.add_child(lot)
		lots[slug] = lot

	for i in config.walkers.size():
		_sorted.add_child(Walker.new(config.walkers[i], config.waypoints, i * 2, config.char_scale))

	# Ajudante em pé ao lado do negócio quando contratado (pedido: "mostrar os ajudantes").
	for slug in config.lots:
		var helper := Sprite2D.new()
		helper.texture = Layout.texture(Layout.helper_texture_name(slug))
		helper.scale = Vector2.ONE * config.char_scale
		helper.offset = Vector2(0, -helper.texture.get_height() / 2.0)
		helper.position = config.lots[slug] + config.helper_offset
		helper.visible = false
		_sorted.add_child(helper)
		_helpers[slug] = helper

	GameState.state_changed.connect(_sync)
	GameState.collected.connect(_on_collected)
	_sync()


## Posiciona a câmera para enquadrar este distrito.
func frame(camera: Camera2D) -> void:
	camera.position = config.camera_center
	camera.zoom = Vector2.ONE * config.zoom


func _sync() -> void:
	for b in GameState.businesses():
		if lots.has(b.slug):
			lots[b.slug].update_from(b)
	for slug in _helpers:
		var b := GameState.business(slug)
		var show: bool = b.get("managed", false)
		if show and not _helpers[slug].visible:
			_pop(_helpers[slug])
		_helpers[slug].visible = show


## Pulinho ao aparecer (contratação).
func _pop(node: Node2D) -> void:
	var base := node.scale
	node.scale = base * Vector2(0.6, 1.3)
	create_tween().tween_property(node, "scale", base, 0.4).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)


func select(slug: String) -> void:
	highlight(slug)
	lot_selected.emit(slug)


## Só o destaque visual (sem abrir painel); "" tira o destaque de todos.
func highlight(slug: String) -> void:
	for s in lots:
		lots[s].selected = s == slug


func _on_collected(items: Array) -> void:
	for item in items:
		if lots.has(item.slug):
			var lot: Node2D = lots[item.slug]
			add_child(FloatingText.new("+" + Fmt.coins(item.amount), lot.position + lot.bubble_position()))


func _unhandled_input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	# Só o primeiro dedo: um segundo dedo encostando não vira toque fantasma.
	if event is InputEventScreenTouch and event.index == 0:
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
			GameState.collect_fast(lot.slug)
			get_viewport().set_input_as_handled()
			return
		if lot.hits(local):
			select(lot.slug)
			get_viewport().set_input_as_handled()
			return
