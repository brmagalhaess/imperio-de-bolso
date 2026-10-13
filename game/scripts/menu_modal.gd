## Janela modal no padrão do jogo: fundo escurecido, cartão creme com borda turquesa,
## faixa de título e lista rolável de cartões (negócios, distritos). Toque fora fecha.
extends Control

const Style := preload("res://scripts/ui_style.gd")
const UiFont := preload("res://scripts/ui_font.gd")
const Fmt := preload("res://scripts/fmt.gd")
const Layout := preload("res://scripts/layout.gd")

const COIN := preload("res://assets/optimized/icon_coin.png")
const LOCK := preload("res://assets/optimized/lot_lock.png")

const MAX_LIST_HEIGHT := 760.0

var _title: Label
var _list: VBoxContainer
var _card: PanelContainer
var _scroll: ScrollContainer


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false

	var backdrop := ColorRect.new()
	backdrop.color = Color(0.02, 0.12, 0.13, 0.55)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	backdrop.gui_input.connect(func(e):
		if (e is InputEventScreenTouch and not e.pressed) or (e is InputEventMouseButton and e.pressed):
			close())
	add_child(backdrop)

	# CenterContainer centraliza o cartão depois que o tamanho dele é calculado.
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(center)

	_card = PanelContainer.new()
	_card.custom_minimum_size = Vector2(664, 0)
	var card_box := Style.box(Style.CREAM, 40, Style.TEAL, 6)
	card_box.content_margin_top = 0
	card_box.shadow_size = 18
	_card.add_theme_stylebox_override("panel", card_box)
	center.add_child(_card)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 14)
	_card.add_child(col)

	# Faixa de título turquesa encostada no topo do cartão.
	var ribbon := PanelContainer.new()
	var ribbon_box := Style.box(Style.TEAL_LIGHT, 0, Style.TEAL_DARK, 0, false)
	ribbon_box.corner_radius_bottom_left = 28
	ribbon_box.corner_radius_bottom_right = 28
	ribbon_box.border_width_bottom = 6
	ribbon_box.border_color = Style.TEAL_DARK
	ribbon_box.content_margin_top = 14
	ribbon_box.content_margin_bottom = 14
	ribbon.add_theme_stylebox_override("panel", ribbon_box)
	col.add_child(ribbon)
	var head := HBoxContainer.new()
	ribbon.add_child(head)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 42)
	_title.add_theme_color_override("font_color", Color.WHITE)
	_title.add_theme_color_override("font_outline_color", Style.TEAL_DARK)
	_title.add_theme_constant_override("outline_size", 10)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	head.add_child(_title)
	head.add_child(Style.close_button(close))

	_scroll = ScrollContainer.new()
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(_scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 12)
	_scroll.add_child(_list)


func open(title_text: String) -> void:
	_title.text = title_text
	for c in _list.get_children():
		c.queue_free()
	visible = true
	modulate.a = 0.0
	_card.scale = Vector2.ONE * 0.85
	await get_tree().process_frame  # espera os cartões entrarem no layout
	# Altura da lista = conteúdo, até o máximo (acima disso, rola).
	_scroll.custom_minimum_size.y = min(_list.get_combined_minimum_size().y, MAX_LIST_HEIGHT)
	await get_tree().process_frame
	_card.pivot_offset = _card.size / 2
	var tween := create_tween().set_parallel()
	tween.tween_property(self, "modulate:a", 1.0, 0.15)
	tween.tween_property(_card, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func close() -> void:
	visible = false


## Bloco de mensagem centralizado com imagem opcional (resumo offline, lista vazia).
func add_message(texture: Texture2D, headline: String, body: String) -> void:
	var box := VBoxContainer.new()
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 10)
	_list.add_child(box)
	if texture:
		var img := TextureRect.new()
		img.texture = texture
		img.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		img.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		img.custom_minimum_size = Vector2(0, 170)
		box.add_child(img)
	if headline != "":
		var h := _text(headline, 44, Style.TEAL_DARK)
		h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		box.add_child(h)
	var b := _text(body, 26, Style.INK_SOFT, 500)
	b.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(b)


## Botão grande de ação no fim da lista (fecha a janela e chama `on_press`).
func add_action(text_value: String, on_press: Callable, color := Style.GREEN,
		edge := Style.GREEN_DARK) -> void:
	var button := Button.new()
	button.text = text_value
	button.custom_minimum_size = Vector2(0, Style.MIN_TOUCH)
	button.add_theme_font_size_override("font_size", 34)
	Style.style_button(button, color, edge)
	button.pressed.connect(func(): close(); on_press.call())
	_list.add_child(button)


func add_section(text: String) -> void:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 30)
	label.add_theme_color_override("font_color", Style.TEAL_DARK)
	_list.add_child(label)


## Cartão de negócio. `state`: "owned" (Nv + Ver), "buy" (preço), "locked" (cadeado).
func add_business(b: Dictionary, state: String, on_press: Callable) -> void:
	var row := _card_row()
	var thumb := TextureRect.new()
	thumb.texture = load(Layout.art_path(b.slug, max(1, int(b.level)))) if state != "locked" else LOCK
	thumb.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	thumb.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	thumb.custom_minimum_size = Vector2(108, 108)
	if state == "locked":
		thumb.modulate = Color(1, 1, 1, 0.8)
	row.add_child(thumb)

	var texts := VBoxContainer.new()
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(texts)
	texts.add_child(_text(b.name, 30, Style.INK))
	var sub := tr("Lucro %s a cada %s") % [Fmt.coins(b.profitPerCycle), Fmt.duration(b.cycleSeconds)]
	if state == "locked":
		sub = tr("Complete a praia para abrir")
	texts.add_child(_text(sub, 22, Style.INK_SOFT, 500))

	var button := Button.new()
	button.custom_minimum_size = Vector2(170, 76)
	button.add_theme_font_size_override("font_size", 28)
	match state:
		"owned":
			button.text = tr("Nv %d") % int(b.level)
			Style.style_button(button, Style.TEAL_LIGHT, Style.TEAL_DARK)
		"buy":
			button.text = Fmt.coins(b.cost)
			button.icon = COIN
			button.add_theme_constant_override("icon_max_width", 34)
			Style.style_button(button, Style.ORANGE, Style.ORANGE_DARK)
		_:
			button.text = tr("Bloqueado")
			button.disabled = true
			Style.style_button(button, Style.GREY, Style.GREY_DARK)
			button.add_theme_font_size_override("font_size", 22)
	if not button.disabled:
		button.pressed.connect(func(): close(); on_press.call())
	row.add_child(button)


## Cartão de ajudante. `state`: "locked" (negócio não construído), "buy" (preço), "hired".
func add_helper(b: Dictionary, state: String, on_press: Callable) -> void:
	var row := _card_row()
	var portrait := TextureRect.new()
	portrait.texture = Layout.texture(Layout.HELPERS.get(b.slug, "char_vendor"))
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait.custom_minimum_size = Vector2(70, 108)
	if state == "locked":
		portrait.modulate = Color(0.4, 0.4, 0.4, 0.8)
	row.add_child(portrait)
	var thumb := TextureRect.new()
	thumb.texture = load(Layout.art_path(b.slug, max(1, int(b.level))))
	thumb.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	thumb.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	thumb.custom_minimum_size = Vector2(64, 64)
	thumb.size_flags_vertical = Control.SIZE_SHRINK_END
	thumb.modulate = Color(1, 1, 1, 0.5 if state == "locked" else 1.0)
	row.add_child(thumb)

	var texts := VBoxContainer.new()
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(texts)
	texts.add_child(_text(b.name, 28, Style.INK))
	var sub: String = {
		"locked": tr("Construa o negócio primeiro"),
		"buy": tr("Produz sozinho quando você sai do mapa"),
		"hired": tr("Trabalhando · até 4h fora do mapa"),
	}[state]
	texts.add_child(_text(sub, 21, Style.INK_SOFT, 500))

	var button := Button.new()
	button.custom_minimum_size = Vector2(160, 76)
	button.add_theme_font_size_override("font_size", 26)
	match state:
		"buy":
			button.text = Fmt.coins(b.managerCost)
			button.icon = COIN
			button.add_theme_constant_override("icon_max_width", 32)
			Style.style_button(button, Style.ORANGE, Style.ORANGE_DARK)
			button.disabled = not GameState.can_afford(b.managerCost)
			button.pressed.connect(on_press)
		"hired":
			button.text = tr("Contratado")
			button.disabled = true
			Style.style_button(button, Style.TEAL_LIGHT, Style.TEAL_DARK)
			button.add_theme_stylebox_override("disabled", Style.toy_button(Style.TEAL_LIGHT, Style.TEAL_DARK))
			button.add_theme_font_size_override("font_size", 22)
		_:
			button.icon = LOCK
			button.add_theme_constant_override("icon_max_width", 40)
			button.disabled = true
			Style.style_button(button, Style.GREY, Style.GREY_DARK)
	row.add_child(button)


## Cartão grande de distrito com miniatura do cenário.
func add_district(id: String, status: String, is_current: bool, unlocked: bool,
		on_press: Callable) -> void:
	var row := _card_row()
	var thumb := TextureRect.new()
	var atlas := AtlasTexture.new()
	atlas.atlas = load("res://assets/optimized/%s" % Layout.DISTRICTS[id].base)
	var s: Vector2 = atlas.atlas.get_size()
	atlas.region = Rect2(s.x * 0.12, s.y * 0.28, s.x * 0.76, s.y * 0.42)
	thumb.texture = atlas
	thumb.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	thumb.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	thumb.custom_minimum_size = Vector2(190, 140)
	if not unlocked:
		thumb.modulate = Color(0.55, 0.55, 0.55)
	row.add_child(thumb)

	var texts := VBoxContainer.new()
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(texts)
	texts.add_child(_text(Layout.title(id), 32, Style.INK))
	texts.add_child(_text(status, 22, Style.INK_SOFT, 500))

	var button := Button.new()
	button.custom_minimum_size = Vector2(130, 76)
	button.add_theme_font_size_override("font_size", 28)
	if is_current:
		button.text = tr("Aqui")
		button.disabled = true
		Style.style_button(button, Style.TEAL_LIGHT, Style.TEAL_DARK)
		button.add_theme_stylebox_override("disabled", Style.toy_button(Style.TEAL_LIGHT, Style.TEAL_DARK))
	elif unlocked:
		button.text = tr("Ir")
		Style.style_button(button, Style.GREEN, Style.GREEN_DARK)
		button.pressed.connect(func(): close(); on_press.call())
	else:
		button.icon = LOCK
		button.add_theme_constant_override("icon_max_width", 40)
		button.disabled = true
		Style.style_button(button, Style.GREY, Style.GREY_DARK)
	row.add_child(button)


func _card_row() -> HBoxContainer:
	var panel := PanelContainer.new()
	var b := Style.box(Style.CREAM_CARD, 26, Style.CREAM_LINE, 3)
	b.shadow_size = 3
	b.shadow_offset = Vector2(0, 3)
	b.content_margin_left = 12
	b.content_margin_right = 14
	b.content_margin_top = 10
	b.content_margin_bottom = 10
	panel.add_theme_stylebox_override("panel", b)
	_list.add_child(panel)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	panel.add_child(row)
	return row


func _text(value: String, size: int, color: Color, weight := 600) -> Label:
	var label := Label.new()
	label.text = value
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_override("font", UiFont.weight(weight))
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return label
