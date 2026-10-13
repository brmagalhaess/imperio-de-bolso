## Interface no estilo do mockup B (docs/ADRs/0004-direcao-visual-v2.md): cartão do topo com
## avatar e saldo, renda por segundo, barra inferior Construir/Loja/Mapa/Perfil, painel do
## negócio selecionado, listas e telas de carregamento/erro. Textos via tr() para i18n.
extends Control

signal retry_requested
signal business_requested(slug: String)

const Fmt := preload("res://scripts/fmt.gd")
const Layout := preload("res://scripts/layout.gd")
const UiFont := preload("res://scripts/ui_font.gd")

const CREAM := Color("fff6e3")
const CREAM_DARK := Color("f1e2c2")
const TEAL := Color("0f8f8a")
const TEAL_DARK := Color("0b5f5c")
const INK := Color("3a2a14")
const GREEN := Color("37c06a")
const ORANGE := Color("ff9f1c")
const MIN_TOUCH := 88  # px na resolução base (~48 dp)

var slug := ""

var _coins_label: Label
var _rate_label: Label
var _sheet: PanelContainer
var _title: Label
var _info: Label
var _progress: ProgressBar
var _action_button: Button
var _collect_button: Button
var _list_panel: PanelContainer
var _list_title: Label
var _list_box: VBoxContainer
var _toast: Label
var _toast_timer: Timer
var _overlay: ColorRect
var _overlay_label: Label
var _retry_button: Button


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = _build_theme()
	_build_top()
	_build_bottom_bar()
	_build_sheet()
	_build_list_panel()
	_build_toast()
	_build_overlay()

	GameState.state_changed.connect(_refresh)
	GameState.busy_changed.connect(func(_b): _refresh())
	GameState.notice.connect(show_toast)


func show_business(new_slug: String) -> void:
	slug = new_slug
	_list_panel.visible = false
	_refresh()


func show_loading() -> void:
	_overlay.visible = true
	_overlay_label.text = tr("Abrindo a praia…")
	_retry_button.visible = false


func show_error(text: String) -> void:
	_overlay.visible = true
	_overlay_label.text = text
	_retry_button.visible = true


func hide_overlay() -> void:
	_overlay.visible = false


func show_toast(text: String) -> void:
	_toast.text = text
	_toast.visible = true
	_toast_timer.start(2.5)


func _process(_delta: float) -> void:
	if _sheet.visible and slug != "":
		_update_cycle(GameState.business(slug))


func _refresh() -> void:
	if not GameState.loaded:
		return
	_coins_label.text = Fmt.coins(GameState.coins())
	_rate_label.text = Fmt.rate(GameState.income_per_second())

	var b := GameState.business(slug)
	_sheet.visible = not b.is_empty()
	if b.is_empty():
		return
	_title.text = b.name
	if b.owned:
		_info.text = tr("Nível %d · Lucro %s a cada %s") % [
			int(b.level), Fmt.coins(b.profitPerCycle), Fmt.duration(b.cycleSeconds)]
		if b.nextUpgradeCost == null:
			_action_button.text = tr("Nível máximo")
			_action_button.disabled = true
		else:
			_action_button.text = tr("Melhorar  %s") % Fmt.coins(b.nextUpgradeCost)
			_action_button.disabled = GameState.busy or not GameState.can_afford(b.nextUpgradeCost)
	else:
		_info.text = tr("Lucro %s a cada %s") % [Fmt.coins(b.profitPerCycle), Fmt.duration(b.cycleSeconds)]
		_action_button.text = tr("Comprar  %s") % Fmt.coins(b.cost)
		_action_button.disabled = GameState.busy or not GameState.can_afford(b.cost)
	_update_cycle(b)


func _update_cycle(b: Dictionary) -> void:
	if b.is_empty():
		return
	_progress.visible = b.owned
	_collect_button.visible = b.owned
	if not b.owned:
		return
	_progress.value = GameState.cycle_progress(b) * 100.0
	var ready := GameState.is_ready(b)
	_collect_button.disabled = GameState.busy or not ready
	_collect_button.text = (tr("Coletar  %s") % Fmt.coins(b.profitPerCycle)) if ready \
			else tr("Pronto em %s") % Fmt.duration(GameState.seconds_remaining(b))


func _on_action_pressed() -> void:
	var b := GameState.business(slug)
	if b.is_empty():
		return
	if b.owned:
		await GameState.upgrade(slug)
	elif await GameState.purchase(slug):
		show_toast(tr("%s é seu!") % b.name)


func _on_collect_pressed() -> void:
	await GameState.collect(slug)


func _open_build_list() -> void:
	_list_title.text = tr("Construir")
	_clear_list()
	for b in GameState.businesses():
		var on_island := Layout.is_island(b.slug)
		var status := ""
		if not on_island:
			status = tr("Cidade · em breve")
		elif b.owned:
			status = tr("Nível %d") % int(b.level)
		else:
			status = Fmt.coins(b.cost)
		var row := _list_row(b.name, status, on_island)
		if on_island:
			row.pressed.connect(func(): business_requested.emit(b.slug))
	_list_panel.visible = true
	_sheet.visible = false


func _open_map() -> void:
	_list_title.text = tr("Mapa")
	_clear_list()
	_list_row(tr("Ilha da Praia"), tr("Você está aqui"), false)
	_list_row(tr("Cidade"), tr("Chega na próxima etapa"), false)
	_list_panel.visible = true
	_sheet.visible = false


func _clear_list() -> void:
	for c in _list_box.get_children():
		c.queue_free()


func _list_row(name_text: String, status: String, enabled: bool) -> Button:
	var b := Button.new()
	b.custom_minimum_size.y = 76
	b.disabled = not enabled
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.text = "  %s   ·   %s" % [name_text, status]
	b.add_theme_stylebox_override("normal", _box(CREAM_DARK, 22))
	b.add_theme_stylebox_override("hover", _box(CREAM_DARK, 22))
	b.add_theme_stylebox_override("pressed", _box(Color("e6d0a4"), 22))
	b.add_theme_stylebox_override("disabled", _box(Color(0.93, 0.89, 0.8, 0.6), 22))
	b.add_theme_color_override("font_color", INK)
	b.add_theme_color_override("font_disabled_color", Color(INK, 0.55))
	b.add_theme_font_size_override("font_size", 28)
	_list_box.add_child(b)
	return b


# --- Construção da interface -------------------------------------------------

func _box(color: Color, radius: int, border := Color.TRANSPARENT, border_w := 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = color
	s.set_corner_radius_all(radius)
	s.set_content_margin_all(16)
	if border_w > 0:
		s.border_color = border
		s.set_border_width_all(border_w)
	s.shadow_color = Color(0, 0, 0, 0.18)
	s.shadow_size = 6
	s.shadow_offset = Vector2(0, 4)
	return s


func _build_theme() -> Theme:
	var t := Theme.new()
	t.default_font = UiFont.bold()
	t.default_font_size = 30
	t.set_color("font_color", "Label", INK)
	t.set_stylebox("panel", "PanelContainer", _box(CREAM, 36, TEAL, 5))

	var normal := _box(GREEN, 26, Color("1f8c48"), 4)
	normal.shadow_size = 0
	normal.border_width_top = 0
	normal.border_width_left = 0
	normal.border_width_right = 0
	normal.border_width_bottom = 7
	var pressed := normal.duplicate()
	pressed.bg_color = Color("2ea95c")
	pressed.border_width_bottom = 2
	var disabled := normal.duplicate()
	disabled.bg_color = Color("c9bfae")
	disabled.border_color = Color("a99f8e")
	t.set_stylebox("normal", "Button", normal)
	t.set_stylebox("hover", "Button", normal)
	t.set_stylebox("pressed", "Button", pressed)
	t.set_stylebox("disabled", "Button", disabled)
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	t.set_color("font_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color.WHITE)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", Color(1, 1, 1, 0.85))
	t.set_color("font_outline_color", "Button", Color(0, 0, 0, 0.25))
	t.set_constant("outline_size", "Button", 4)

	var bar_bg := _box(Color(0, 0, 0, 0.18), 12)
	bar_bg.shadow_size = 0
	var bar_fill := _box(Color("ffd34d"), 12)
	bar_fill.shadow_size = 0
	t.set_stylebox("background", "ProgressBar", bar_bg)
	t.set_stylebox("fill", "ProgressBar", bar_fill)
	return t


func _icon_button(icon_name: String, size: int, handler: Callable) -> TextureButton:
	var b := TextureButton.new()
	b.texture_normal = Layout.texture(icon_name)
	b.ignore_texture_size = true
	b.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	b.custom_minimum_size = Vector2(size, size)
	b.pivot_offset = Vector2(size, size) / 2
	b.button_down.connect(func(): b.scale = Vector2.ONE * 0.9)
	b.button_up.connect(func(): b.scale = Vector2.ONE)
	b.pressed.connect(handler)
	return b


func _build_top() -> void:
	var col := VBoxContainer.new()
	col.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE, Control.PRESET_MODE_MINSIZE, 20)
	col.offset_top = 28
	col.add_theme_constant_override("separation", 10)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(col)

	var card := PanelContainer.new()
	col.add_child(card)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	card.add_child(row)
	var avatar := TextureRect.new()
	avatar.texture = Layout.texture("icon_profile")
	avatar.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	avatar.custom_minimum_size = Vector2(72, 72)
	row.add_child(avatar)
	var title := Label.new()
	title.text = tr("Império de Bolso")
	title.add_theme_font_size_override("font_size", 38)
	title.add_theme_color_override("font_color", TEAL_DARK)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(title)
	row.add_child(_icon_button("icon_help", 68, func(): show_toast(
			tr("Compre negócios, toque na moeda para coletar e melhore para lucrar mais!"))))
	row.add_child(_icon_button("icon_settings", 68, func(): show_toast(tr("Configurações em breve"))))

	var money := HBoxContainer.new()
	money.add_theme_constant_override("separation", 12)
	money.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(money)
	money.add_child(_money_pill(true))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	money.add_child(spacer)
	money.add_child(_money_pill(false))


func _money_pill(is_coins: bool) -> PanelContainer:
	var pill := PanelContainer.new()
	pill.add_theme_stylebox_override("panel", _box(CREAM if is_coins else Color("d9f7c8"), 32,
			ORANGE if is_coins else GREEN, 4))
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	pill.add_child(row)
	var coin := TextureRect.new()
	coin.texture = Layout.texture("icon_coin")
	coin.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	coin.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	coin.custom_minimum_size = Vector2(52, 52) if is_coins else Vector2(36, 36)
	row.add_child(coin)
	var label := Label.new()
	label.add_theme_font_size_override("font_size", 44 if is_coins else 30)
	label.add_theme_color_override("font_color", Color("8a4b00") if is_coins else Color("1f7a3f"))
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.custom_minimum_size.x = 150 if is_coins else 0
	row.add_child(label)
	if is_coins:
		_coins_label = label
	else:
		_rate_label = label
	return pill


func _build_bottom_bar() -> void:
	var bar := PanelContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE, Control.PRESET_MODE_MINSIZE, 20)
	bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bar.offset_bottom = -26
	add_child(bar)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 18)
	bar.add_child(row)
	for item in [
		["icon_build", tr("Construir"), _open_build_list],
		["icon_shop", tr("Loja"), func(): show_toast(tr("Loja em breve"))],
		["icon_map", tr("Mapa"), _open_map],
		["icon_profile", tr("Perfil"), func(): show_toast(tr("Perfil em breve"))],
	]:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 2)
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(col)
		var btn := _icon_button(item[0], 92, item[2])
		btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		col.add_child(btn)
		var label := Label.new()
		label.text = item[1]
		label.add_theme_font_size_override("font_size", 24)
		label.add_theme_color_override("font_color", TEAL_DARK)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(label)


func _build_sheet() -> void:
	_sheet = PanelContainer.new()
	_sheet.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE, Control.PRESET_MODE_MINSIZE, 20)
	_sheet.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_sheet.offset_bottom = -200
	_sheet.visible = false
	add_child(_sheet)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	_sheet.add_child(col)

	var head := HBoxContainer.new()
	col.add_child(head)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 38)
	_title.add_theme_color_override("font_color", TEAL_DARK)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(_title)
	var close := Button.new()
	close.text = "✕"
	close.custom_minimum_size = Vector2(64, 64)
	close.add_theme_stylebox_override("normal", _box(Color("ff6b6b"), 32))
	close.add_theme_stylebox_override("hover", _box(Color("ff6b6b"), 32))
	close.add_theme_stylebox_override("pressed", _box(Color("e85555"), 32))
	close.pressed.connect(func(): _sheet.visible = false)
	head.add_child(close)

	_info = Label.new()
	_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_info.add_theme_font_size_override("font_size", 28)
	_info.add_theme_font_override("font", UiFont.weight(500))
	col.add_child(_info)
	_progress = ProgressBar.new()
	_progress.custom_minimum_size.y = 24
	_progress.show_percentage = false
	col.add_child(_progress)

	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 14)
	col.add_child(buttons)
	_collect_button = _make_button(buttons, _on_collect_pressed)
	_collect_button.add_theme_stylebox_override("normal", _orange_box())
	_collect_button.add_theme_stylebox_override("hover", _orange_box())
	_action_button = _make_button(buttons, _on_action_pressed)


func _orange_box() -> StyleBoxFlat:
	var s := _box(ORANGE, 26, Color("c46f00"), 0)
	s.shadow_size = 0
	s.border_color = Color("c46f00")
	s.border_width_bottom = 7
	return s


func _make_button(parent: Control, handler: Callable) -> Button:
	var b := Button.new()
	b.custom_minimum_size.y = MIN_TOUCH
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.add_theme_font_size_override("font_size", 32)
	b.pressed.connect(handler)
	parent.add_child(b)
	return b


func _build_list_panel() -> void:
	_list_panel = PanelContainer.new()
	_list_panel.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE, Control.PRESET_MODE_MINSIZE, 20)
	_list_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_list_panel.offset_bottom = -200
	_list_panel.visible = false
	add_child(_list_panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	_list_panel.add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	_list_title = Label.new()
	_list_title.add_theme_font_size_override("font_size", 38)
	_list_title.add_theme_color_override("font_color", TEAL_DARK)
	_list_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(_list_title)
	var close := Button.new()
	close.text = "✕"
	close.custom_minimum_size = Vector2(64, 64)
	close.add_theme_stylebox_override("normal", _box(Color("ff6b6b"), 32))
	close.add_theme_stylebox_override("hover", _box(Color("ff6b6b"), 32))
	close.pressed.connect(func(): _list_panel.visible = false)
	head.add_child(close)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size.y = 560
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(scroll)
	_list_box = VBoxContainer.new()
	_list_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list_box.add_theme_constant_override("separation", 10)
	scroll.add_child(_list_box)


func _build_toast() -> void:
	_toast = Label.new()
	_toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_toast.offset_top = 300
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.custom_minimum_size.x = 640
	_toast.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.add_theme_color_override("font_color", Color.WHITE)
	_toast.add_theme_color_override("font_outline_color", TEAL_DARK)
	_toast.add_theme_constant_override("outline_size", 12)
	_toast.visible = false
	add_child(_toast)
	_toast_timer = Timer.new()
	_toast_timer.one_shot = true
	_toast_timer.timeout.connect(func(): _toast.visible = false)
	add_child(_toast_timer)


func _build_overlay() -> void:
	_overlay = ColorRect.new()
	_overlay.color = Color("0c8a85")
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_overlay)
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.add_theme_constant_override("separation", 24)
	_overlay.add_child(box)
	var logo := TextureRect.new()
	logo.texture = Layout.texture("water_cart_lv1")
	logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo.custom_minimum_size = Vector2(200, 260)
	box.add_child(logo)
	var title := Label.new()
	title.text = tr("Império de Bolso")
	title.add_theme_font_size_override("font_size", 56)
	title.add_theme_color_override("font_color", Color.WHITE)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	_overlay_label = Label.new()
	_overlay_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_overlay_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.9))
	box.add_child(_overlay_label)
	_retry_button = Button.new()
	_retry_button.text = tr("Tentar novamente")
	_retry_button.custom_minimum_size = Vector2(360, MIN_TOUCH)
	_retry_button.pressed.connect(func(): retry_requested.emit())
	box.add_child(_retry_button)
