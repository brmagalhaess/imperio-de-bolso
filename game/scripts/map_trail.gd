## Tela de Mapas em trilha (pedido do titular): os mapas flutuam numa trilha vertical, do
## primeiro (embaixo) ao último (em cima). Mapas ainda não liberados ficam escondidos por
## nuvens; no topo, um mapa "Em breve" mostra que novos lugares vão chegar.
extends Control

signal district_chosen(id: String)

const Style := preload("res://scripts/ui_style.gd")
const Layout := preload("res://scripts/layout.gd")
const Fmt := preload("res://scripts/fmt.gd")
const UiFont := preload("res://scripts/ui_font.gd")
const TouchScroll := preload("res://scripts/touch_scroll.gd")

const CARD_SIZE := Vector2(540, 380)
## Distância vertical entre os mapas na trilha.
const STEP := 560.0
const TOP_MARGIN := 210.0
const BOTTOM_MARGIN := 170.0
## Zigue-zague horizontal da trilha (centro de cada cartão).
const XS := [380.0, 340.0]

var _scroll: ScrollContainer
var _canvas: Control
var _nodes: Array[Vector2] = []
var _cards: Array[Control] = []
var _time := 0.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false

	var bg := ColorRect.new()
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.color = Color("0b5f5c")
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)

	_scroll = ScrollContainer.new()
	_scroll.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	_scroll.scroll_deadzone = 28
	add_child(_scroll)
	add_child(TouchScroll.new(_scroll))
	_canvas = Control.new()
	_canvas.mouse_filter = Control.MOUSE_FILTER_PASS
	_canvas.draw.connect(_draw_trail)
	_scroll.add_child(_canvas)

	# Cabeçalho fixo (não rola com a trilha).
	var header := PanelContainer.new()
	header.add_theme_stylebox_override("panel", Style.box(Style.TEAL, 0, Style.TEAL_DARK, 0))
	header.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE, Control.PRESET_MODE_MINSIZE)
	header.custom_minimum_size = Vector2(0, 118)
	add_child(header)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	header.add_child(row)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(68, 0)
	row.add_child(spacer)
	var title := Label.new()
	title.text = tr("Mapas")
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.add_theme_font_override("font", UiFont.bold())
	title.add_theme_font_size_override("font_size", 44)
	title.add_theme_color_override("font_color", Color.WHITE)
	row.add_child(title)
	var close_button := Style.close_button(close)
	close_button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(close_button)
	var pad := Control.new()
	pad.custom_minimum_size = Vector2(14, 0)
	row.add_child(pad)


func close() -> void:
	visible = false


## Monta a trilha com o estado atual e rola até o mapa em que o jogador está.
func open(current: String) -> void:
	for c in _canvas.get_children():
		c.queue_free()
	_cards.clear()
	_nodes.clear()
	var order: Array = Layout.DISTRICT_ORDER
	var count := order.size() + 1  # + "Em breve"
	var height := TOP_MARGIN + STEP * (count - 1) + CARD_SIZE.y + BOTTOM_MARGIN
	_canvas.custom_minimum_size = Vector2(720, height)
	for i in count:
		# O primeiro mapa fica embaixo; a trilha sobe.
		var center := Vector2(XS[i % 2], height - BOTTOM_MARGIN - CARD_SIZE.y / 2 - STEP * i)
		_nodes.append(center)
		var card: Control
		if i < order.size():
			card = _district_card(order[i], order[i] == current)
		else:
			card = _soon_card()
		card.position = center - CARD_SIZE / 2
		card.set_meta("base_y", card.position.y)
		card.set_meta("phase", i * 1.7)
		_canvas.add_child(card)
		_cards.append(card)
	visible = true
	_canvas.queue_redraw()
	await get_tree().process_frame
	var idx := maxi(order.find(current), 0)
	_scroll.scroll_vertical = int(_nodes[idx].y - size.y * 0.55)


func _process(delta: float) -> void:
	if not visible:
		return
	_time += delta
	# Os mapas "flutuam" devagar.
	for card in _cards:
		if is_instance_valid(card):
			card.position.y = float(card.get_meta("base_y")) + sin(_time * 1.6 + float(card.get_meta("phase"))) * 6.0


func _draw_trail() -> void:
	var h := _canvas.custom_minimum_size.y
	# Céu em cima, mar embaixo.
	var top := Color("8fd8f0")
	var bottom := Color("0c8a85")
	var bands := 24
	for b in bands:
		var t := float(b) / (bands - 1)
		_canvas.draw_rect(Rect2(0, h * b / bands, 720, h / bands + 1), top.lerp(bottom, t))
	# Trilha pontilhada ligando os mapas.
	for i in _nodes.size() - 1:
		var a := _nodes[i] - Vector2(0, CARD_SIZE.y / 2 - 20)
		var b := _nodes[i + 1] + Vector2(0, CARD_SIZE.y / 2 - 20)
		var ctrl := (a + b) / 2 + Vector2(160 if i % 2 == 0 else -160, 0)
		var steps := 22
		for s in steps + 1:
			var t := float(s) / steps
			var p := a.lerp(ctrl, t).lerp(ctrl.lerp(b, t), t)
			_canvas.draw_circle(p, 9.0, Color(1, 1, 1, 0.9))
			_canvas.draw_circle(p, 5.0, Style.ORANGE)


func _district_card(id: String, is_current: bool) -> Control:
	var unlocked := GameState.district_unlocked(id)
	var card := _card_frame()
	var info: Dictionary = Layout.DISTRICTS[id]

	var clip := Panel.new()
	clip.clip_children = CanvasItem.CLIP_CHILDREN_ONLY
	clip.add_theme_stylebox_override("panel", Style.box(Color.WHITE, 40, Color.WHITE, 0))
	clip.position = Vector2(10, 10)
	clip.size = CARD_SIZE - Vector2(20, 20)
	clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(clip)
	var pic := TextureRect.new()
	var atlas := AtlasTexture.new()
	atlas.atlas = load("res://assets/optimized/%s" % info.base)
	var s: Vector2 = atlas.atlas.get_size()
	var rh := s.x * clip.size.y / clip.size.x
	atlas.region = Rect2(0, clamp(s.y * float(info.get("trail_center", 0.5)) - rh / 2, 0, s.y - rh), s.x, rh)
	pic.texture = atlas
	pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	pic.stretch_mode = TextureRect.STRETCH_SCALE
	pic.size = clip.size
	pic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip.add_child(pic)

	if not unlocked:
		var clouds := Control.new()
		clouds.size = clip.size
		clouds.mouse_filter = Control.MOUSE_FILTER_IGNORE
		clouds.draw.connect(_draw_clouds.bind(clouds, int(hash(id))))
		clip.add_child(clouds)

	# Faixa de baixo: nome, progresso e botão.
	var bar := PanelContainer.new()
	bar.add_theme_stylebox_override("panel", Style.box(Color(1, 0.98, 0.94, 0.95), 26, Style.CREAM_LINE, 3))
	bar.position = Vector2(26, CARD_SIZE.y - 128)
	bar.size = Vector2(CARD_SIZE.x - 52, 110)
	card.add_child(bar)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	bar.add_child(row)
	var texts := VBoxContainer.new()
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(texts)
	texts.add_child(_label(Layout.title(id) if unlocked else "???", 30, Style.INK))
	texts.add_child(_label(_status(id, unlocked, is_current), 21, Style.INK_SOFT))
	var button := Button.new()
	button.custom_minimum_size = Vector2(120, 70)
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	button.add_theme_font_size_override("font_size", 26)
	if is_current:
		button.text = tr("Aqui")
		button.disabled = true
		Style.style_button(button, Style.TEAL_LIGHT, Style.TEAL_DARK)
		button.add_theme_stylebox_override("disabled", Style.toy_button(Style.TEAL_LIGHT, Style.TEAL_DARK))
	elif unlocked:
		button.text = tr("Ir")
		Style.style_button(button, Style.GREEN, Style.GREEN_DARK)
		button.pressed.connect(func():
			close()
			district_chosen.emit(id))
	else:
		button.text = "🔒"
		button.disabled = true
		Style.style_button(button, Style.GREY, Style.GREY_DARK)
	row.add_child(button)
	card.set_meta("district", id)
	return card


func _soon_card() -> Control:
	var card := _card_frame()
	var clip := Panel.new()
	clip.clip_children = CanvasItem.CLIP_CHILDREN_ONLY
	clip.add_theme_stylebox_override("panel", Style.box(Color.WHITE, 40, Color.WHITE, 0))
	clip.position = Vector2(10, 10)
	clip.size = CARD_SIZE - Vector2(20, 20)
	clip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(clip)
	var clouds := Control.new()
	clouds.size = clip.size
	clouds.mouse_filter = Control.MOUSE_FILTER_IGNORE
	clouds.draw.connect(_draw_clouds.bind(clouds, 7))
	clip.add_child(clouds)
	var box := VBoxContainer.new()
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.position = Vector2(0, 90)
	box.size = Vector2(CARD_SIZE.x, 200)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(box)
	box.add_child(_label(tr("Em breve"), 48, Style.TEAL_DARK, true))
	box.add_child(_label(tr("Novos mapas estão a caminho!"), 26, Style.INK_SOFT, true))
	card.set_meta("district", "em_breve")
	return card


func _card_frame() -> Control:
	var card := Panel.new()
	card.size = CARD_SIZE
	var box := Style.box(Color.WHITE, 46, Color.WHITE, 0)
	box.shadow_size = 18
	box.shadow_offset = Vector2(0, 14)
	box.shadow_color = Color(0, 0.15, 0.15, 0.35)
	card.add_theme_stylebox_override("panel", box)
	card.mouse_filter = Control.MOUSE_FILTER_PASS
	return card


func _status(id: String, unlocked: bool, is_current: bool) -> String:
	if not unlocked:
		return tr("Complete %s para abrir") % Layout.short_title(Layout.previous_district(id))
	var total := 0
	var owned := 0
	for b in GameState.businesses():
		if Layout.district_of(b.slug) == id:
			total += 1
			owned += 1 if b.owned else 0
	var text := tr("%d de %d negócios") % [owned, total]
	if is_current:
		return tr("Você está aqui · ") + text
	var pending := GameState.pending_in(id)
	if pending > 0:
		text += " · " + tr("ajudantes +%s") % Fmt.coins(str(pending))
	return text


## Nuvens fofas cobrindo o mapa (desenhadas em código, sem arte nova).
func _draw_clouds(target: Control, seed_value: int) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var sz := target.size
	target.draw_rect(Rect2(Vector2.ZERO, sz), Color(0.86, 0.94, 0.98, 0.94))
	for i in 34:
		var c := Vector2(rng.randf_range(-20, sz.x + 20), rng.randf_range(-10, sz.y + 10))
		var r := rng.randf_range(48, 96)
		target.draw_circle(c + Vector2(0, 8), r, Color(0.72, 0.84, 0.92, 0.9))
		target.draw_circle(c, r, Color(1, 1, 1, 0.97))


func _label(text_value: String, font_size: int, color: Color, center := false) -> Label:
	var l := Label.new()
	l.text = text_value
	l.add_theme_font_override("font", UiFont.bold())
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if center:
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l
