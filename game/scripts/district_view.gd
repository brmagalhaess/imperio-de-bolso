## Um distrito do mapa (Ilha da Praia, Cidade): cenário, lotes, decoração e pessoas, com
## ordem de pintura por altura (y-sort). Toque na moeda coleta; toque no lote abre o painel.
extends Node2D

signal lot_selected(slug: String)

const Layout := preload("res://scripts/layout.gd")
const BusinessLot := preload("res://scripts/business_lot.gd")
const Walker := preload("res://scripts/walker.gd")
const FloatingText := preload("res://scripts/floating_text.gd")
const Fmt := preload("res://scripts/fmt.gd")
const LayoutV9 := preload("res://scripts/layout_v9.gd")
const StreetAgent := preload("res://scripts/street_agent.gd")

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
## Mapa em 2D (2026-11-25, pedido do titular: "só movimenta pra cima e pra baixo" e "as ilhas
## não ficam juntas"). As ilhas de expansão descem em escada para a esquerda: a ponte desenhada
## no canto superior direito de cada uma chega na terra da anterior. A arte e o layout seguem
## feitos para a pilha antiga (ilha em x=0, y=`expansion.y`); aqui tudo é reposicionado.
const ISLAND_POS := [Vector2(-470, 930), Vector2(-960, 1390)]
const ISLAND_SIZE := Vector2(720, 870)
const MAIN_RECT := Rect2(0, 0, 720, 1280)
## Regiões por onde a câmera anda (mapa principal + ilhas visíveis).
var _regions: Array[Rect2] = [MAIN_RECT]
var _old_y: Array[float] = []
var _velocity := Vector2.ZERO
const INERTIA_DECAY := 4.5
const MIN_ZOOM_FACTOR := 0.72
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


## Ilha única (2026-11-25, pedido do titular: uma ilha maior com todos os negócios dentro, no
## lugar das ilhas de expansão separadas). Dados em layout_v9.gd; {} = mapa ainda no formato antigo.
var _v9: Dictionary = {}
const V9_MAX_ZOOM := 2.4
## Zoom ao abrir o mapa (1 = lotes no tamanho da resolução base).
const V9_START_ZOOM := 0.8
const V9_CARS := 5


func _ready_v9() -> void:
	# O cenário inteiro é o mundo: ilha completa com o entorno pintado até as bordas. A câmera
	# nunca sai da arte, então não existe "quadrado" nem pedaço faltando.
	var world: Vector2 = _v9.size
	var bg := Sprite2D.new()
	bg.texture = load("res://assets/optimized/%s" % _v9.base)
	bg.centered = false
	bg.scale = world / bg.texture.get_size()
	add_child(bg)

	_sorted = Node2D.new()
	_sorted.y_sort_enabled = true
	add_child(_sorted)
	# Lotes que sobram na arte (praia): área de guarda-sóis.
	for at in _v9.get("cover", []):
		for off in [Vector2(-40, 0), Vector2(36, 22)]:
			var s := Sprite2D.new()
			s.texture = Layout.texture("beach_umbrella")
			s.scale = Vector2.ONE * Layout.ART_SCALE
			s.offset = Vector2(0, -s.texture.get_height() / 2.0)
			s.position = at + off
			_sorted.add_child(s)
	var slugs: Array = config.lots.keys()
	var points: Array = _v9.lots
	for i in mini(slugs.size(), points.size()):
		var slug: String = slugs[i]
		var lot := BusinessLot.new(slug)
		lot.position = points[i]
		_sorted.add_child(lot)
		lots[slug] = lot
		var helper := Sprite2D.new()
		helper.texture = Layout.texture(Layout.helper_texture_name(slug))
		helper.scale = Vector2.ONE * config.char_scale
		helper.offset = Vector2(0, -helper.texture.get_height() / 2.0)
		helper.position = points[i] + config.helper_offset
		helper.visible = false
		_sorted.add_child(helper)
		_helpers[slug] = helper

	# Pessoas nas calçadas (beira dos lotes) e carros nas ruas (em volta deles).
	var pads: Array = _v9.get("pads", [])
	var pad: Vector2 = _v9.get("pad", Vector2(140, 90))
	var step: Vector2 = _v9.get("step", pad * 1.1)
	if pads.size() >= 2:
		var walk: Dictionary = StreetAgent.build(pads, pad * 0.86, 6.0, pad.x * 0.6)
		for i in config.walkers.size():
			_sorted.add_child(StreetAgent.new(walk.nodes, walk.links, i * 7 + 1, config.walkers[i], config.char_scale))
		if _v9.get("cars", true):
			var road: Dictionary = StreetAgent.build(pads, step, pad.x * 0.3, 0.0)
			for i in V9_CARS:
				_sorted.add_child(StreetAgent.new(road.nodes, road.links, i * 5 + 2, "car_%d" % (i % 3 + 1), 0.42, true))
	_regions = [Rect2(Vector2.ZERO, world)]
	_world_height = world.y
	GameState.state_changed.connect(_sync)
	GameState.collected.connect(_on_collected)
	GameState.evolved.connect(_on_evolved)
	_sync()


## Menor zoom em que a tela ainda cabe inteira dentro da arte (ilha única).
func _v9_zoom() -> float:
	var view := get_viewport_rect().size
	var world: Vector2 = _v9.size
	return maxf(view.x / world.x, view.y / world.y)


func _ready() -> void:
	_v9 = LayoutV9.ISLANDS.get(district, {})
	if not _v9.is_empty():
		_ready_v9()
		return
	# Cores do cenário estendidas para telas mais altas que 9:16.
	for half in [[config.top_color, -1000.0], [config.bottom_color, 640.0]]:
		var fill := ColorRect.new()
		fill.color = half[0]
		fill.position = Vector2(-1000, half[1])
		fill.size = Vector2(2720, 1640)
		fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(fill)

	# Mapa maior: mar contínuo abaixo e à esquerda do cenário principal, onde ficam as ilhas.
	var exp: Dictionary = config.get("expansion", {})
	for e in [exp, config.get("expansion2", {})]:
		if not e.is_empty():
			_old_y.append(float(e.y))
	if not exp.is_empty():
		for rect in [Rect2(-2400, 1000, 4200, 3200), Rect2(-2400, -1000, 2460, 4000)]:
			var sea := ColorRect.new()
			sea.color = exp.sea_color
			sea.position = rect.position
			sea.size = rect.size
			sea.mouse_filter = Control.MOUSE_FILTER_IGNORE
			add_child(sea)

	var bg := Sprite2D.new()
	bg.texture = load("res://assets/optimized/%s" % config.base)
	bg.centered = false
	bg.scale = Vector2(720, 1280) / bg.texture.get_size()
	if not exp.is_empty():
		# Borda esquerda e de baixo se desfazem no mar (sem emenda reta ao andar para as ilhas).
		var feather := ShaderMaterial.new()
		feather.shader = EDGE_FEATHER
		bg.material = feather
	add_child(bg)

	# Ilhas de expansão: a primeira (2026-10-15) e a segunda (12 negócios por mapa, ADR 0034).
	for e in [exp, config.get("expansion2", {})]:
		if e.is_empty():
			continue
		var island := Sprite2D.new()
		island.texture = load("res://assets/optimized/%s" % e.base)
		island.centered = false
		island.scale = Vector2.ONE * (720.0 / island.texture.get_width())
		island.position = ISLAND_POS[_islands.size()]
		# O mar pintado na ilha se mistura ao mar do mapa; a ponte (canto de cima, à direita)
		# quase não desbota para chegar inteira na terra vizinha.
		var soft := ShaderMaterial.new()
		soft.shader = EDGE_FEATHER
		soft.set_shader_parameter("left", 0.16)
		soft.set_shader_parameter("bottom", 0.16)
		soft.set_shader_parameter("top", 0.07)
		soft.set_shader_parameter("right", 0.03)
		island.material = soft
		add_child(island)
		_islands.append(island)
	if not exp.is_empty():
		# Dica no fim do mapa principal: há mais lotes descendo.
		var hint := Label.new()
		hint.text = tr("◀ Arraste para explorar as ilhas")
		hint.add_theme_font_size_override("font_size", 26)
		hint.add_theme_color_override("font_color", Color.WHITE)
		hint.add_theme_color_override("font_outline_color", Color("063a52"))
		hint.add_theme_constant_override("outline_size", 8)
		hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		hint.size = Vector2(720, 40)
		hint.position = Vector2(0, 1085)
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
		s.position = _place(d[1])
		_sorted.add_child(s)

	for slug in config.lots:
		var lot := BusinessLot.new(slug)
		lot.position = _place(config.lots[slug])
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
		helper.position = _place(config.lots[slug]) + config.helper_offset
		helper.visible = false
		_sorted.add_child(helper)
		_helpers[slug] = helper

	GameState.state_changed.connect(_sync)
	GameState.collected.connect(_on_collected)
	GameState.evolved.connect(_on_evolved)
	_sync()


## Borda do cenário principal que se desfaz (esquerda e embaixo).
const EDGE_FEATHER := preload("res://scripts/edge_feather.gdshader")


## Posição no mapa 2D de um ponto do layout antigo (ilhas empilhadas em x=0).
func _place(pos: Vector2) -> Vector2:
	for i in range(_old_y.size() - 1, -1, -1):
		if pos.y >= _old_y[i] + 100.0:
			return pos - Vector2(0, _old_y[i]) + ISLAND_POS[i]
	return pos


## Posiciona a câmera para enquadrar este distrito.
func frame(camera: Camera2D) -> void:
	_camera = camera
	camera.position = config.camera_center
	camera.zoom = Vector2.ONE * config.zoom
	if not _v9.is_empty():
		# Abre no meio da ilha, um pouco afastado; dali o jogador arrasta e dá zoom à vontade.
		camera.zoom = Vector2.ONE * maxf(_v9_zoom(), V9_START_ZOOM)
		var center := Vector2.ZERO
		for p in _v9.lots:
			center += p
		camera.position = center / maxf(1.0, _v9.lots.size()) - Vector2(0, 40)
		_clamp_camera()
	_touches.clear()
	_dragging = false
	_velocity = Vector2.ZERO


func _pannable() -> bool:
	return (config.get("pan", false) or not _v9.is_empty()) and _camera != null


## Mantém a câmera sobre o mapa: zoom entre 0,72× e 1,8× do enquadramento e o centro dentro do
## corredor formado pelo cenário principal e pelas ilhas visíveis (anda em todas as direções).
func _clamp_camera() -> void:
	var z: float = clamp(_camera.zoom.x, config.zoom * MIN_ZOOM_FACTOR, config.zoom * MAX_ZOOM_FACTOR)
	if not _v9.is_empty():
		z = clamp(_camera.zoom.x, _v9_zoom(), maxf(_v9_zoom(), 1.0) * V9_MAX_ZOOM)
	_camera.zoom = Vector2.ONE * z
	var half := get_viewport_rect().size / z / 2.0
	var top := _regions[0].position.y
	var bottom := top
	for r in _regions:
		bottom = maxf(bottom, r.end.y)
	var y := _camera.position.y
	if bottom - top > half.y * 2.0:
		y = clampf(y, top + half.y, bottom - half.y)
	else:
		y = (top + bottom) / 2.0
	# Faixa de x: união das regiões na altura da câmera (centro da região se ela é mais
	# estreita que a tela).
	var lo := INF
	var hi := -INF
	for r in _regions:
		if y < r.position.y - 1.0 or y > r.end.y + 1.0:
			continue
		var a := r.position.x + half.x
		var b := r.end.x - half.x
		if a > b:
			a = r.get_center().x
			b = a
		lo = minf(lo, a)
		hi = maxf(hi, b)
	if lo > hi:
		lo = config.camera_center.x
		hi = lo
	_camera.position = Vector2(clampf(_camera.position.x, lo, hi), y)


## Inércia: depois de soltar o dedo o mapa continua deslizando e freia sozinho.
func _process(delta: float) -> void:
	if _camera == null or _dragging or not _touches.is_empty() or _velocity.length_squared() < 16.0:
		return
	if not is_visible_in_tree():
		_velocity = Vector2.ZERO
		return
	var before := _camera.position
	_camera.position += _velocity * delta
	_clamp_camera()
	if _camera.position.is_equal_approx(before):
		_velocity = Vector2.ZERO
	_velocity = _velocity.lerp(Vector2.ZERO, minf(1.0, INERTIA_DECAY * delta))


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
	if not _v9.is_empty():
		_sync_helpers()
		return
	_world_height = 1280.0
	_regions = [MAIN_RECT]
	for island in _islands:
		var rect := Rect2(island.position, ISLAND_SIZE)
		var any := false
		for slug in lots:
			any = any or (lots[slug].visible and rect.has_point(lots[slug].position))
		island.visible = any
		if any:
			_regions.append(rect)
			_world_height = maxf(_world_height, rect.end.y)
	_sync_helpers()


func _sync_helpers() -> void:
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
	var half := get_viewport_rect().size / _camera.zoom.x / 2.0
	var from := _camera.position
	var offset: Vector2 = lots[slug].position - Vector2(0, 120) - from
	if absf(offset.y) <= half.y * 0.6 and absf(offset.x) <= half.x * 0.6:
		return
	# O destino passa pelo mesmo limite da câmera (corredor das ilhas).
	_velocity = Vector2.ZERO
	_camera.position = from + offset
	_clamp_camera()
	var target := _camera.position
	_camera.position = from
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


## Evolução (ADR 0035): estrela subindo do negócio que evoluiu.
func _on_evolved(evolved_slug: String, evolution: int) -> void:
	if lots.has(evolved_slug) and is_visible_in_tree():
		var lot: Node2D = lots[evolved_slug]
		add_child(FloatingText.new("⭐ ×%d" % evolution, lot.position + Vector2(0, -150)))


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
				var move: Vector2 = event.relative / _camera.zoom.x
				_camera.position -= move
				_clamp_camera()
				_velocity = _velocity.lerp(-event.velocity / _camera.zoom.x, 0.5)
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
			_velocity = Vector2.ZERO
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
