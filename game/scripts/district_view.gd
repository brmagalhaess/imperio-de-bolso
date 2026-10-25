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
## Ilhas de expansão: cada uma some (e a câmera para antes) se o servidor ainda não tem os
## negócios dela (jogo novo com servidor antigo — ADR 0034).
var _islands: Array[Sprite2D] = []
var _world_height := 1280.0
var _sorted: Node2D
var _press_pos := Vector2.ZERO
## Mapas maiores (12 negócios): arrastar move a câmera e pinça aproxima (pedido de 2026-10-15).
const MAX_ZOOM_FACTOR := 1.8
var _camera: Camera2D
var _touches := {}  # índice do dedo → posição
var _dragging := false
var _pinch_dist := 0.0


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

	# Mapa maior: mar contínuo abaixo do cenário principal, até o fim da ilha de expansão.
	var exp: Dictionary = config.get("expansion", {})
	if not exp.is_empty():
		var sea := ColorRect.new()
		sea.color = exp.sea_color
		sea.position = Vector2(-1000, 1000)
		sea.size = Vector2(2720, float(config.world_height) + 1000.0)
		sea.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(sea)

	var bg := Sprite2D.new()
	bg.texture = load("res://assets/optimized/%s" % config.base)
	bg.centered = false
	bg.scale = Vector2(720, 1280) / bg.texture.get_size()
	add_child(bg)

	# Ilhas de expansão: a primeira (2026-10-15) e a segunda (12 negócios por mapa, ADR 0034).
	for e in [exp, config.get("expansion2", {})]:
		if e.is_empty():
			continue
		var island := Sprite2D.new()
		island.texture = load("res://assets/optimized/%s" % e.base)
		island.centered = false
		island.scale = Vector2.ONE * (720.0 / island.texture.get_width())
		island.position = Vector2(0, float(e.y))
		add_child(island)
		_islands.append(island)
	if not exp.is_empty():
		# Dica no fim do mapa principal: há mais lotes descendo.
		var hint := Label.new()
		hint.text = tr("▼ Arraste para ver mais negócios ▼")
		hint.add_theme_font_size_override("font_size", 26)
		hint.add_theme_color_override("font_color", Color.WHITE)
		hint.add_theme_color_override("font_outline_color", Color("063a52"))
		hint.add_theme_constant_override("outline_size", 8)
		hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		hint.size = Vector2(720, 40)
		hint.position = Vector2(0, float(exp.y) + 40.0)
		hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(hint)

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
	_camera = camera
	camera.position = config.camera_center
	camera.zoom = Vector2.ONE * config.zoom
	_touches.clear()
	_dragging = false


func _pannable() -> bool:
	return config.get("pan", false) and _camera != null


## Mantém a câmera dentro do cenário (720×1280) e o zoom entre o enquadramento e 1,8×.
func _clamp_camera() -> void:
	var z: float = clamp(_camera.zoom.x, config.zoom, config.zoom * MAX_ZOOM_FACTOR)
	_camera.zoom = Vector2.ONE * z
	var half := get_viewport_rect().size / z / 2.0
	var lo := half
	var hi := Vector2(720, _world_height) - half
	_camera.position = Vector2(
			clamp(_camera.position.x, min(lo.x, hi.x), max(lo.x, hi.x)) if lo.x <= hi.x else 360.0,
			clamp(_camera.position.y, min(lo.y, hi.y), max(lo.y, hi.y)) if lo.y <= hi.y else config.camera_center.y)


func _zoom_by(factor: float) -> void:
	_camera.zoom *= factor
	_clamp_camera()


func _sync() -> void:
	var known := {}
	for b in GameState.businesses():
		known[b.slug] = true
		if lots.has(b.slug):
			lots[b.slug].update_from(b)
	for slug in lots:
		lots[slug].visible = known.is_empty() or known.has(slug)
	_world_height = 1280.0
	for island in _islands:
		var bottom := island.position.y + island.texture.get_height() * island.scale.y
		var any := false
		for slug in lots:
			var y: float = lots[slug].position.y
			any = any or (lots[slug].visible and y > island.position.y and y < bottom)
		island.visible = any
		if any:
			_world_height = maxf(_world_height, bottom)
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
	focus(slug)
	lot_selected.emit(slug)


## Mapa maior: desliza a câmera até o lote (ex.: escolhido na lista Construir, na ilha de baixo).
func focus(slug: String) -> void:
	if not _pannable() or not lots.has(slug):
		return
	var target: Vector2 = lots[slug].position - Vector2(0, 120)
	var half := get_viewport_rect().size / _camera.zoom.x / 2.0
	var lo_y := half.y
	var hi_y := _world_height - half.y
	target.y = clamp(target.y, min(lo_y, hi_y), max(lo_y, hi_y))
	target.x = _camera.position.x
	if absf(target.y - _camera.position.y) > half.y * 0.6:
		create_tween().tween_property(_camera, "position", target, 0.45).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


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
	if _pannable():
		if event is InputEventScreenTouch:
			if event.pressed:
				_touches[event.index] = event.position
			else:
				_touches.erase(event.index)
			_pinch_dist = _touch_distance()
		elif event is InputEventScreenDrag:
			_touches[event.index] = event.position
			if _touches.size() >= 2:
				var dist := _touch_distance()
				if _pinch_dist > 0.0 and dist > 0.0:
					_zoom_by(dist / _pinch_dist)
				_pinch_dist = dist
				_dragging = true
			elif event.index == 0 and (_dragging or event.position.distance_to(_press_pos) > TAP_MAX_DRAG):
				_dragging = true
				_camera.position -= event.relative / _camera.zoom.x
				_clamp_camera()
		elif event is InputEventMouseButton and event.pressed:
			if event.button_index == MOUSE_BUTTON_WHEEL_UP:
				_zoom_by(1.1)
			elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
				_zoom_by(1.0 / 1.1)
	# Só o primeiro dedo: um segundo dedo encostando não vira toque fantasma.
	if event is InputEventScreenTouch and event.index == 0:
		if event.pressed:
			_press_pos = event.position
			_dragging = false
		elif not _dragging and event.position.distance_to(_press_pos) <= TAP_MAX_DRAG:
			_handle_tap(event.position)


func _touch_distance() -> float:
	if _touches.size() < 2:
		return 0.0
	var pts: Array = _touches.values()
	return (pts[0] as Vector2).distance_to(pts[1])


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
