## Interface no estilo do mockup B (docs/ADRs/0004-direcao-visual-v2.md): cartão do topo com
## avatar e saldo, renda por segundo, barra inferior Construir/Loja/Mapa/Perfil, painel do
## negócio selecionado, menus modais e telas de carregamento/erro. Textos via tr() para i18n.
extends Control

signal retry_requested
signal business_requested(slug: String)
signal district_requested(id: String)
## Painel do negócio fechado: o mundo tira o destaque do lote.
signal selection_cleared

const Fmt := preload("res://scripts/fmt.gd")
const Layout := preload("res://scripts/layout.gd")
const UiFont := preload("res://scripts/ui_font.gd")
const Style := preload("res://scripts/ui_style.gd")
const MenuModal := preload("res://scripts/menu_modal.gd")
const Tutorial := preload("res://scripts/tutorial.gd")

var slug := ""
var current_district := "praia"

var _coins_label: Label
var _rate_label: Label
var _district_label: Label
var _sheet: PanelContainer
var _title: Label
var _info: Label
var _progress: ProgressBar
var _action_button: Button
var _collect_button: Button
var _hire_button: Button
var _modal: Control
var tutorial: Control
## Cartões da tela de Ajudantes aberta (slug → identificador), atualizados no lugar.
var _helper_cards := {}
var _toast: Label
var _toast_timer: Timer
var _offline_pill: PanelContainer
var _fader: ColorRect
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
	tutorial = Tutorial.new()
	add_child(tutorial)
	_modal = MenuModal.new()
	add_child(_modal)
	tutorial.blockers = [_sheet, _modal]
	_build_toast()
	_build_offline_pill()
	_build_fader()
	_build_overlay()

	GameState.state_changed.connect(_refresh)
	GameState.busy_changed.connect(func(_b): _refresh())
	GameState.notice.connect(show_toast)
	GameState.offline_summary.connect(show_offline_summary)
	GameState.state_changed.connect(_sync_helper_cards)
	GameState.busy_changed.connect(func(_b): _sync_helper_cards())
	GameState.connection_changed.connect(func(online): _offline_pill.visible = not online)


func show_business(new_slug: String) -> void:
	slug = new_slug
	_refresh()


## Fecha o painel e esquece o negócio selecionado — senão a próxima atualização de estado
## (ex.: coletar pela moeda) reabriria o painel.
func close_sheet() -> void:
	if slug == "" and not _sheet.visible:
		return
	slug = ""
	_sheet.visible = false
	selection_cleared.emit()


## "Enquanto você estava fora…" — o servidor já creditou; a janela só mostra (docs §8).
func show_offline_summary(district: String, total: String, elapsed_seconds: int, capped: bool,
		cap_seconds: int) -> void:
	close_sheet()
	_helper_cards.clear()
	_modal.open(tr("Bem-vindo de volta!"))
	var body := tr("Em %s fora da %s, seus ajudantes faturaram:") % [
		Fmt.duration(elapsed_seconds), Layout.title(district)]
	_modal.add_message(Layout.texture("char_vendor"), "+" + Fmt.coins(total), body)
	if capped:
		_modal.add_message(null, "", tr("Os ajudantes trabalham até %s fora de cada mapa. Volte antes para não perder nada!")
				% Fmt.duration(cap_seconds))
	_modal.add_action(tr("Coletar"), func(): pass, Style.ORANGE, Style.ORANGE_DARK)


## Tela de Ajudantes do mapa atual: ver quem já trabalha e contratar (pedido do titular).
func open_helpers_menu() -> void:
	close_sheet()
	_helper_cards.clear()
	_modal.open(tr("Ajudantes · %s") % Layout.title(current_district))
	var auto_text := tr("Auto-coleta neste mapa: ativa") if GameState.auto_collect() \
			else tr("Auto-coleta enquanto você joga neste mapa: em breve na Loja")
	_modal.add_message(null, "", tr("Ajudantes produzem sozinhos enquanto você está em outro mapa ou com o jogo fechado — até 4 horas por mapa.") + "\n" + auto_text)
	for b in GameState.businesses():
		if Layout.district_of(b.slug) != current_district:
			continue
		var target: String = b.slug
		_helper_cards[target] = _modal.add_helper(b, _helper_state(b), func(): _hire_from_menu(target))


func _helper_state(b: Dictionary) -> String:
	return "hired" if b.get("managed", false) else ("buy" if b.owned else "locked")


## Estado/saldo mudou com a tela de Ajudantes aberta: atualiza os cartões sem recriar.
func _sync_helper_cards() -> void:
	if _helper_cards.is_empty() or not _modal.visible:
		return
	for slug in _helper_cards:
		var b := GameState.business(slug)
		if not b.is_empty():
			_modal.set_helper_state(_helper_cards[slug], b, _helper_state(b))


func _hire_from_menu(target: String) -> void:
	# Sem aviso flutuante aqui: ele cobria o texto da janela. O próprio cartão vira
	# "Contratado" e dá um pulinho de confirmação.
	if await GameState.hire_manager(target):
		_sync_helper_cards()
		var button: Button = _helper_cards.get(target, {}).get("button")
		if button:
			button.pivot_offset = button.size / 2
			button.scale = Vector2(1.15, 1.15)
			create_tween().tween_property(button, "scale", Vector2.ONE, 0.35) \
					.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	else:
		_sync_helper_cards()


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


## Escurece (true) ou clareia (false) a tela; usado na troca de distrito.
func fade(to_dark: bool) -> void:
	_fader.visible = true
	var tween := create_tween()
	tween.tween_property(_fader, "modulate:a", 1.0 if to_dark else 0.0, 0.22)
	await tween.finished
	_fader.visible = to_dark


func _process(_delta: float) -> void:
	if _sheet.visible and slug != "":
		_update_cycle(GameState.business(slug))


func _refresh() -> void:
	if not GameState.loaded:
		return
	_coins_label.text = Fmt.coins(GameState.coins())
	_rate_label.text = Fmt.rate(GameState.income_per_second())
	_district_label.text = Layout.title(current_district)

	var b := GameState.business(slug)
	_sheet.visible = not b.is_empty()
	if b.is_empty():
		return
	_title.text = b.name
	if b.owned:
		_info.text = tr("Nível %d · Lucro %s a cada %s") % [
			int(b.level), Fmt.coins(b.profitPerCycle), Fmt.duration(b.cycleSeconds)]
		if b.get("automatic", false):
			_info.text += tr(" · Produzindo sozinho")
		elif b.get("managed", false):
			_info.text += tr(" · Ajudante produz quando você sai do mapa")
		if b.nextUpgradeCost == null:
			_action_button.text = tr("Nível máximo")
			_action_button.disabled = true
		else:
			_action_button.text = tr("Melhorar  %s") % Fmt.coins(b.nextUpgradeCost)
			_action_button.disabled = GameState.busy or not GameState.can_afford(b.nextUpgradeCost)
	else:
		_info.text = tr("Lucro %s a cada %s") % [Fmt.coins(b.profitPerCycle), Fmt.duration(b.cycleSeconds)]
		if GameState.district_unlocked(str(b.get("district", "praia"))):
			_action_button.text = tr("Comprar  %s") % Fmt.coins(b.cost)
			_action_button.disabled = GameState.busy or not GameState.can_afford(b.cost)
		else:
			_action_button.text = tr("Complete a praia")
			_action_button.disabled = true
	var can_hire: bool = b.owned and not b.get("managed", false)
	_hire_button.visible = can_hire
	if can_hire:
		_hire_button.text = tr("Contratar ajudante  %s") % Fmt.coins(b.managerCost)
		_hire_button.disabled = GameState.busy or not GameState.can_afford(b.managerCost)
	_update_cycle(b)


func _update_cycle(b: Dictionary) -> void:
	if b.is_empty():
		return
	_progress.visible = b.owned
	_collect_button.visible = b.owned
	if not b.owned:
		return
	_progress.value = GameState.cycle_progress(b) * 100.0
	if b.get("automatic", false):
		_collect_button.disabled = true
		_collect_button.text = tr("Automático · %s") % Fmt.duration(GameState.seconds_remaining(b))
		return
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
		return
	var city_was_open := GameState.district_unlocked("cidade")
	if await GameState.purchase(slug):
		if not city_was_open and GameState.district_unlocked("cidade"):
			show_toast(tr("A Cidade foi liberada! Abra o Mapa."))
		else:
			show_toast(tr("%s é seu!") % b.name)


func _on_collect_pressed() -> void:
	await GameState.collect(slug)


func _on_hire_pressed() -> void:
	var b := GameState.business(slug)
	if await GameState.hire_manager(slug):
		show_toast(tr("Ajudante contratado! %s agora produz sozinho.") % b.name)


## Construir: só o mapa atual e só o que ainda não foi construído (pedido do titular).
func open_build_menu() -> void:
	close_sheet()
	_helper_cards.clear()
	_modal.open(tr("Construir · %s") % Layout.title(current_district))
	var unlocked := GameState.district_unlocked(current_district)
	var shown := 0
	for b in GameState.businesses():
		if Layout.district_of(b.slug) != current_district or b.owned:
			continue
		var target: String = b.slug
		_modal.add_business(b, "buy" if unlocked else "locked", func(): business_requested.emit(target))
		shown += 1
	if shown > 0:
		return
	# Tudo construído aqui: sugere o próximo passo.
	var next := _next_district(current_district)
	if next != "" and GameState.district_unlocked(next):
		_modal.add_message(Layout.texture("icon_map"), tr("Tudo construído!"),
				tr("A %s está esperando por você.") % Layout.title(next))
		_modal.add_action(tr("Ir para %s") % Layout.title(next), func(): district_requested.emit(next))
	else:
		_modal.add_message(Layout.texture("icon_build"), tr("Tudo construído!"),
				tr("Melhore seus negócios e contrate ajudantes para lucrar mais."))


func _next_district(id: String) -> String:
	var i := Layout.DISTRICT_ORDER.find(id)
	return Layout.DISTRICT_ORDER[i + 1] if i >= 0 and i + 1 < Layout.DISTRICT_ORDER.size() else ""


func open_map_menu() -> void:
	close_sheet()
	_helper_cards.clear()
	_modal.open(tr("Mapa"))
	for id in Layout.DISTRICT_ORDER:
		var unlocked := GameState.district_unlocked(id)
		var total := 0
		var owned := 0
		for b in GameState.businesses():
			if Layout.district_of(b.slug) == id:
				total += 1
				owned += 1 if b.owned else 0
		var status := tr("%d de %d negócios") % [owned, total]
		var pending := GameState.pending_in(id)
		if id == current_district:
			status = tr("Você está aqui · ") + status
		elif not unlocked:
			status = tr("Compre os 4 negócios da praia")
		elif pending > 0:
			status += "\n" + tr("Ajudantes juntaram +%s") % Fmt.coins(str(pending))
		var target: String = id
		_modal.add_district(id, status, id == current_district, unlocked,
				func(): district_requested.emit(target))


# --- Construção da interface -------------------------------------------------

func _build_theme() -> Theme:
	var t := Theme.new()
	t.default_font = UiFont.bold()
	t.default_font_size = 30
	t.set_color("font_color", "Label", Style.INK)
	t.set_stylebox("panel", "PanelContainer", Style.box(Style.CREAM, 36, Style.TEAL, 5))
	t.set_stylebox("normal", "Button", Style.toy_button(Style.GREEN, Style.GREEN_DARK))
	t.set_stylebox("hover", "Button", Style.toy_button(Style.GREEN.lightened(0.05), Style.GREEN_DARK))
	t.set_stylebox("pressed", "Button", Style.toy_button(Style.GREEN, Style.GREEN_DARK, 26, true))
	t.set_stylebox("disabled", "Button", Style.toy_button(Style.GREY, Style.GREY_DARK))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	for c in ["font_color", "font_pressed_color", "font_hover_color", "font_focus_color"]:
		t.set_color(c, "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", Color(1, 1, 1, 0.9))
	t.set_color("font_outline_color", "Button", Color(0, 0, 0, 0.25))
	t.set_constant("outline_size", "Button", 4)

	var bar_bg := Style.box(Color(0, 0, 0, 0.18), 12, Color.TRANSPARENT, 0, false)
	var bar_fill := Style.box(Color("ffd34d"), 12, Color.TRANSPARENT, 0, false)
	bar_bg.set_content_margin_all(0)
	bar_fill.set_content_margin_all(0)
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
	var titles := VBoxContainer.new()
	titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	titles.alignment = BoxContainer.ALIGNMENT_CENTER
	titles.add_theme_constant_override("separation", -6)
	row.add_child(titles)
	var title := Label.new()
	title.text = tr("Império de Bolso")
	title.add_theme_font_size_override("font_size", 36)
	title.add_theme_color_override("font_color", Style.TEAL_DARK)
	titles.add_child(title)
	_district_label = Label.new()
	_district_label.add_theme_font_size_override("font_size", 22)
	_district_label.add_theme_color_override("font_color", Style.INK_SOFT)
	titles.add_child(_district_label)
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
	pill.add_theme_stylebox_override("panel", Style.box(Style.CREAM if is_coins else Color("d9f7c8"), 32,
			Style.ORANGE if is_coins else Style.GREEN, 4))
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


## Botão dos Ajudantes no mesmo formato dos ícones (quadrado arredondado com degrau).
## Ícone provisório: retrato do vendedor (arte própria: a gerar).
func _helpers_button(size: int, handler: Callable) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(size, size)
	b.icon = Layout.texture("char_vendor")
	b.expand_icon = true
	b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_theme_constant_override("icon_max_width", int(size * 0.5))
	Style.style_button(b, Color("9b7bff"), Color("6a4fd1"), 24)
	for state in ["normal", "hover", "pressed"]:
		var box: StyleBoxFlat = b.get_theme_stylebox(state)
		box.content_margin_top = 8
		box.content_margin_bottom = 12
	b.pressed.connect(handler)
	return b


func _build_bottom_bar() -> void:
	var bar := PanelContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE, Control.PRESET_MODE_MINSIZE, 20)
	bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bar.offset_bottom = -26
	add_child(bar)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 4)
	bar.add_child(row)
	for item in [
		["icon_build", tr("Construir"), open_build_menu],
		["helpers", tr("Ajudantes"), open_helpers_menu],
		["icon_shop", tr("Loja"), func(): show_toast(tr("Loja em breve"))],
		["icon_map", tr("Mapa"), open_map_menu],
		["icon_profile", tr("Perfil"), func(): show_toast(tr("Perfil em breve"))],
	]:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 2)
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(col)
		var btn: Control = _helpers_button(84, item[2]) if item[0] == "helpers" \
				else _icon_button(item[0], 84, item[2])
		btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		col.add_child(btn)
		var label := Label.new()
		label.text = item[1]
		label.add_theme_font_size_override("font_size", 22)
		label.add_theme_color_override("font_color", Style.TEAL_DARK)
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
	_title.add_theme_color_override("font_color", Style.TEAL_DARK)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(_title)
	head.add_child(Style.close_button(close_sheet))

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
	Style.style_button(_collect_button, Style.ORANGE, Style.ORANGE_DARK)
	_action_button = _make_button(buttons, _on_action_pressed)
	_hire_button = _make_button(col, _on_hire_pressed)
	Style.style_button(_hire_button, Style.TEAL_LIGHT, Style.TEAL_DARK)


func _make_button(parent: Control, handler: Callable) -> Button:
	var b := Button.new()
	b.custom_minimum_size.y = Style.MIN_TOUCH
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.add_theme_font_size_override("font_size", 32)
	b.pressed.connect(handler)
	parent.add_child(b)
	return b


func _build_toast() -> void:
	_toast = Label.new()
	_toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_toast.offset_top = 300
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.custom_minimum_size.x = 640
	_toast.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.add_theme_color_override("font_color", Color.WHITE)
	_toast.add_theme_color_override("font_outline_color", Style.TEAL_DARK)
	_toast.add_theme_constant_override("outline_size", 12)
	_toast.visible = false
	add_child(_toast)
	_toast_timer = Timer.new()
	_toast_timer.one_shot = true
	_toast_timer.timeout.connect(func(): _toast.visible = false)
	add_child(_toast_timer)


func _build_offline_pill() -> void:
	_offline_pill = PanelContainer.new()
	_offline_pill.add_theme_stylebox_override("panel", Style.box(Style.RED, 30, Style.RED_DARK, 4))
	_offline_pill.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_offline_pill.offset_top = 230
	_offline_pill.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_offline_pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_offline_pill.visible = false
	var label := Label.new()
	label.text = tr("Sem conexão · reconectando…")
	label.add_theme_color_override("font_color", Color.WHITE)
	label.add_theme_font_size_override("font_size", 26)
	_offline_pill.add_child(label)
	add_child(_offline_pill)


func _build_fader() -> void:
	_fader = ColorRect.new()
	_fader.color = Color("0c6f6b")
	_fader.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fader.modulate.a = 0.0
	_fader.visible = false
	add_child(_fader)


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
	_retry_button.custom_minimum_size = Vector2(360, Style.MIN_TOUCH)
	_retry_button.pressed.connect(func(): retry_requested.emit())
	box.add_child(_retry_button)
