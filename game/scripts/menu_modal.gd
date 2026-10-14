## Janela modal no padrão do jogo: fundo escurecido, cartão creme com borda turquesa,
## faixa de título e lista rolável de cartões (negócios, distritos). Toque fora fecha.
extends Control

const Style := preload("res://scripts/ui_style.gd")
const UiFont := preload("res://scripts/ui_font.gd")
const Fmt := preload("res://scripts/fmt.gd")
const Layout := preload("res://scripts/layout.gd")
const TouchScroll := preload("res://scripts/touch_scroll.gd")

const COIN := preload("res://assets/optimized/icon_coin.png")
const LOCK := preload("res://assets/optimized/lot_lock.png")
const GlyphButton := preload("res://scripts/glyph_button.gd")
var GEM: Texture2D = GlyphButton.gem_texture()

const MAX_LIST_HEIGHT := 760.0

var _title: Label
var _list: VBoxContainer
var _card: PanelContainer
var _scroll: ScrollContainer
var _store_cards: Array = []


## Rolagem por toque mesmo começando em cima de um item (ver touch_scroll.gd).
var touch_scroll: Node


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false

	var backdrop := ColorRect.new()
	backdrop.color = Color(0.02, 0.12, 0.13, 0.55)
	backdrop.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	# Fecha ao soltar o dedo fora do cartão (não ao encostar: no celular, errar o botão por
	# pouco fechava a janela). Só o clique: o toque chega também como clique emulado.
	backdrop.gui_input.connect(func(e):
		if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
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
	# No celular, o dedo sempre escorrega um pouco: sem esta folga, qualquer toque num botão
	# da lista virava rolagem e o botão não respondia.
	_scroll.scroll_deadzone = 28
	touch_scroll = TouchScroll.new(_scroll)
	add_child(touch_scroll)
	col.add_child(_scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 12)
	_scroll.add_child(_list)


func open(title_text: String) -> void:
	var was_open := visible
	_title.text = title_text
	_store_cards.clear()
	_scroll.scroll_vertical = 0  # cada janela abre no topo (não herda a rolagem da anterior)
	for c in _list.get_children():
		c.queue_free()
	visible = true
	if was_open:
		# Troca de conteúdo com a janela aberta: sem piscar (sem nova animação de entrada).
		await get_tree().process_frame
		_scroll.custom_minimum_size.y = min(_list.get_combined_minimum_size().y, MAX_LIST_HEIGHT)
		return
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


## Recalcula a altura da lista depois de adicionar itens com a janela já aberta
## (ex.: ranking, que chega do servidor depois de a janela abrir).
func refit() -> void:
	await get_tree().process_frame
	_scroll.custom_minimum_size.y = min(_list.get_combined_minimum_size().y, MAX_LIST_HEIGHT)


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


## Linha com valor e botão "Alterar" (Configurações → Idioma). Devolve o botão (para testes).
func add_option(text_value: String, value_text: String, on_press: Callable) -> Button:
	var row := _card_row()
	var texts := VBoxContainer.new()
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	texts.add_child(_text(text_value, 30, Style.INK))
	texts.add_child(_text(value_text, 24, Style.INK_SOFT))
	row.add_child(texts)
	var button := Button.new()
	button.text = tr("Alterar")
	button.custom_minimum_size = Vector2(190, 76)
	button.add_theme_font_size_override("font_size", 28)
	Style.style_button(button, Style.TEAL, Style.TEAL_DARK)
	button.pressed.connect(on_press)
	row.add_child(button)
	return button


## Linha liga/desliga (Configurações): não fecha a janela; o botão muda no lugar, sem piscar.
## `on_toggled(novo_valor)`. Devolve o botão (para testes).
func add_toggle(icon: Texture2D, text_value: String, value: bool, on_toggled: Callable) -> Button:
	var row := _card_row()
	if icon:
		var thumb := TextureRect.new()
		thumb.texture = icon
		thumb.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		thumb.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		thumb.custom_minimum_size = Vector2(72, 72)
		row.add_child(thumb)
	var label := _text(text_value, 30, Style.INK)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label)
	var button := Button.new()
	button.custom_minimum_size = Vector2(190, 76)
	button.add_theme_font_size_override("font_size", 28)
	button.set_meta("no_click_sfx", true)  # tem som próprio (toggle)
	var paint := func(on: bool) -> void:
		button.text = tr("Ligado") if on else tr("Desligado")
		if on:
			Style.style_button(button, Style.GREEN, Style.GREEN_DARK)
		else:
			Style.style_button(button, Style.GREY, Style.GREY_DARK)
	paint.call(value)
	button.set_meta("on", value)
	button.pressed.connect(func():
		var on := not bool(button.get_meta("on"))
		button.set_meta("on", on)
		paint.call(on)
		on_toggled.call(on))
	row.add_child(button)
	return button


## Linha "rótulo: valor" com botão Copiar (ex.: Código do jogador). Devolve o botão.
func add_copy_row(label_text: String, value: String, on_copied: Callable) -> Button:
	var row := _card_row()
	var texts := VBoxContainer.new()
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(texts)
	texts.add_child(_text(label_text, 24, Style.INK_SOFT))
	texts.add_child(_text(value, 36, Style.TEAL_DARK, 700))
	var button := Button.new()
	button.text = tr("Copiar")
	button.custom_minimum_size = Vector2(170, 76)
	button.add_theme_font_size_override("font_size", 28)
	Style.style_button(button, Style.TEAL_LIGHT, Style.TEAL_DARK)
	button.pressed.connect(func():
		DisplayServer.clipboard_set(value)
		on_copied.call())
	row.add_child(button)
	return button


func clear_list() -> void:
	_store_cards.clear()
	for c in _list.get_children():
		c.queue_free()


## Campo de texto no padrão do jogo (ex.: novo nome). Devolve o LineEdit.
func add_line_edit(placeholder: String, max_length: int) -> LineEdit:
	var edit := LineEdit.new()
	edit.placeholder_text = placeholder
	edit.max_length = max_length
	edit.custom_minimum_size = Vector2(0, 84)
	edit.alignment = HORIZONTAL_ALIGNMENT_CENTER
	edit.add_theme_font_override("font", UiFont.bold())
	edit.add_theme_font_size_override("font_size", 32)
	edit.add_theme_color_override("font_color", Style.INK)
	edit.add_theme_color_override("font_placeholder_color", Style.INK_SOFT)
	edit.add_theme_stylebox_override("normal", Style.box(Color.WHITE, 22, Style.TEAL, 4, false))
	edit.add_theme_stylebox_override("focus", Style.box(Color.WHITE, 22, Style.ORANGE, 4, false))
	_list.add_child(edit)
	return edit


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
	texts.add_child(_text(tr(b.name), 30, Style.INK))
	var sub := tr("Lucro %s a cada %s") % [Fmt.coins(b.profitPerCycle), Fmt.duration(b.cycleSeconds)]
	if state == "locked":
		sub = tr("Complete %s para abrir") % Layout.short_title(Layout.previous_district(str(b.get("district", "praia"))))
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
## Devolve um identificador para atualizar o cartão no lugar (set_helper_state), sem recriar
## a lista — recriar fazia a janela piscar a cada contratação.
func add_helper(b: Dictionary, state: String, on_press: Callable) -> Dictionary:
	var row := _card_row()
	var portrait := TextureRect.new()
	portrait.texture = Layout.texture(Layout.helper_texture_name(b.slug))
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait.custom_minimum_size = Vector2(70, 108)
	row.add_child(portrait)
	var thumb := TextureRect.new()
	thumb.texture = load(Layout.art_path(b.slug, max(1, int(b.level))))
	thumb.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	thumb.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	thumb.custom_minimum_size = Vector2(64, 64)
	thumb.size_flags_vertical = Control.SIZE_SHRINK_END
	row.add_child(thumb)

	var texts := VBoxContainer.new()
	texts.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	texts.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(texts)
	texts.add_child(_text(tr(b.name), 28, Style.INK))
	var sub := _text("", 21, Style.INK_SOFT, 500)
	texts.add_child(sub)

	var button := Button.new()
	button.custom_minimum_size = Vector2(160, 76)
	button.pressed.connect(func():
		button.disabled = true  # evita clique duplo enquanto o servidor responde
		on_press.call())
	row.add_child(button)

	var handle := {"button": button, "sub": sub, "portrait": portrait, "thumb": thumb, "state": ""}
	set_helper_state(handle, b, state)
	return handle


## Atualiza um cartão de ajudante sem recriá-lo (preço fixo; só muda se dá para pagar).
func set_helper_state(handle: Dictionary, b: Dictionary, state: String) -> void:
	var button: Button = handle.button
	handle.sub.text = {
		"locked": tr("Construa o negócio primeiro"),
		"buy": tr("Produz sozinho quando você sai do mapa"),
		"hired": tr("Trabalhando · até 4h fora do mapa"),
	}[state]
	var dim := Color(0.4, 0.4, 0.4, 0.8) if state == "locked" else Color.WHITE
	handle.portrait.modulate = dim
	handle.thumb.modulate = Color(1, 1, 1, 0.5) if state == "locked" else Color.WHITE

	if state == "buy":
		var affordable := GameState.can_afford(b.managerCost) and not GameState.busy
		button.disabled = not affordable
		if handle.state != "buy":
			button.text = Fmt.coins(b.managerCost)
			button.icon = COIN
			button.add_theme_constant_override("icon_max_width", 32)
			button.add_theme_font_size_override("font_size", 26)
			Style.style_button(button, Style.ORANGE, Style.ORANGE_DARK)
			# Sem saldo: o mesmo botão laranja, só esmaecido — o preço não "muda".
			var faded := Style.toy_button(Style.ORANGE, Style.ORANGE_DARK)
			faded.bg_color.a = 0.45
			faded.border_color.a = 0.45
			button.add_theme_stylebox_override("disabled", faded)
	elif state == "hired" and handle.state != "hired":
		button.text = tr("Contratado")
		button.icon = null
		button.disabled = true
		button.add_theme_font_size_override("font_size", 22)
		Style.style_button(button, Style.TEAL_LIGHT, Style.TEAL_DARK)
		button.add_theme_stylebox_override("disabled", Style.toy_button(Style.TEAL_LIGHT, Style.TEAL_DARK))
	elif state == "locked" and handle.state != "locked":
		button.text = ""
		button.icon = LOCK
		button.add_theme_constant_override("icon_max_width", 40)
		button.disabled = true
		Style.style_button(button, Style.GREY, Style.GREY_DARK)
	handle.state = state


## Cartão de missão/conquista com barra de progresso e prêmio. Atualiza no lugar
## (set_reward_card) para não piscar ao resgatar. `item`: {title, subtitle, progress, target,
## rewardCoins?, rewardGems, done, claimed}.
func add_reward_card(item: Dictionary, on_claim: Callable) -> Dictionary:
	var row := _card_row()
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 4)
	row.add_child(col)
	var title := _text("", 26, Style.INK)
	col.add_child(title)
	var sub := _text("", 20, Style.INK_SOFT, 500)
	col.add_child(sub)
	var bar := ProgressBar.new()
	bar.custom_minimum_size = Vector2(0, 16)
	bar.show_percentage = false
	col.add_child(bar)
	var reward := HBoxContainer.new()
	reward.add_theme_constant_override("separation", 6)
	col.add_child(reward)
	var coin_icon := _icon(COIN, 26)
	reward.add_child(coin_icon)
	var coin_label := _text("", 22, Color("8a4b00"))
	coin_label.autowrap_mode = TextServer.AUTOWRAP_OFF  # números não quebram linha
	reward.add_child(coin_label)
	reward.add_child(_icon(GEM, 26))
	var gem_label := _text("", 22, Color("1f7fa8"))
	gem_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	reward.add_child(gem_label)

	var button := Button.new()
	button.custom_minimum_size = Vector2(150, 76)
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	button.pressed.connect(func():
		button.disabled = true
		on_claim.call())
	row.add_child(button)
	var handle := {"title": title, "sub": sub, "bar": bar, "coin_icon": coin_icon,
		"coin_label": coin_label, "gem_label": gem_label, "button": button, "state": ""}
	set_reward_card(handle, item)
	return handle


func set_reward_card(h: Dictionary, item: Dictionary) -> void:
	h.title.text = tr(item.title)
	h.sub.text = item.get("subtitle", "")
	h.sub.visible = h.sub.text != ""
	var target := maxf(1.0, str(item.target).to_float())
	h.bar.value = clampf(str(item.progress).to_float() / target * 100.0, 0.0, 100.0)
	var coins := str(item.get("rewardCoins", "0"))
	h.coin_icon.visible = coins != "0"
	h.coin_label.visible = coins != "0"
	h.coin_label.text = Fmt.coins(coins)
	h.gem_label.text = "+%d" % int(item.rewardGems)
	var button: Button = h.button
	var state := "claimed" if item.claimed else ("ready" if item.done else "progress")
	button.disabled = state != "ready" or GameState.busy
	if state == h.state:
		return
	h.state = state
	button.add_theme_font_size_override("font_size", 24)
	match state:
		"ready":
			button.text = tr("Resgatar")
			Style.style_button(button, Style.ORANGE, Style.ORANGE_DARK)
		"claimed":
			button.text = tr("Resgatado")
			Style.style_button(button, Style.TEAL_LIGHT, Style.TEAL_DARK)
			button.add_theme_stylebox_override("disabled", Style.toy_button(Style.TEAL_LIGHT, Style.TEAL_DARK))
		_:
			button.text = "%s/%s" % [Fmt.coins(item.progress), Fmt.coins(item.target)]
			Style.style_button(button, Style.GREY, Style.GREY_DARK)


## Cartão da Loja. `spec` é um Callable que devolve o estado atual do cartão:
## {title, subtitle, icon?: Texture2D, button: String, button_icon?: Texture2D, color, edge,
## enabled: bool}. Atualizado no lugar por refresh_store_cards() (sem recriar = sem piscar).
func add_store_card(spec: Callable, on_press: Callable) -> Dictionary:
	var row := _card_row()
	var icon := _icon(null, 72)
	row.add_child(icon)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(col)
	var title := _text("", 26, Style.INK)
	col.add_child(title)
	var sub := _text("", 20, Style.INK_SOFT, 500)
	col.add_child(sub)
	var button := Button.new()
	button.custom_minimum_size = Vector2(170, 76)
	button.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	button.add_theme_font_size_override("font_size", 24)
	button.add_theme_constant_override("icon_max_width", 30)
	button.pressed.connect(func():
		button.disabled = true
		on_press.call())
	row.add_child(button)
	var handle := {"spec": spec, "icon": icon, "title": title, "sub": sub, "button": button, "color": null}
	_store_cards.append(handle)
	set_store_card(handle)
	return handle


func set_store_card(h: Dictionary) -> void:
	var d: Dictionary = h.spec.call()
	h.icon.texture = d.get("icon")
	h.icon.visible = d.get("icon") != null
	h.title.text = tr(d.title)
	h.sub.text = d.get("subtitle", "")
	h.sub.visible = h.sub.text != ""
	var button: Button = h.button
	button.text = d.button
	button.icon = d.get("button_icon")
	button.disabled = not d.get("enabled", true) or GameState.busy
	if h.color != d.color:
		h.color = d.color
		Style.style_button(button, d.color, d.edge)
		# Indisponível: mesma cor, esmaecida (o preço continua visível e igual).
		var faded := Style.toy_button(d.color, d.edge)
		faded.bg_color.a = 0.45
		faded.border_color.a = 0.45
		button.add_theme_stylebox_override("disabled", faded)


func refresh_store_cards() -> void:
	for h in _store_cards:
		if is_instance_valid(h.button):
			set_store_card(h)


## Linha do ranking (posição, nome, faturamento); `me` destaca o jogador.
func add_rank_row(rank: int, name_text: String, score: String, me: bool) -> void:
	var panel := PanelContainer.new()
	var b := Style.box(Color("ffe9b8") if me else Style.CREAM_CARD, 20,
			Style.ORANGE if me else Style.CREAM_LINE, 3, false)
	b.content_margin_top = 8
	b.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", b)
	_list.add_child(panel)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	panel.add_child(row)
	var pos := _text("#%d" % rank, 28, [Color("c99a00"), Color("8f9aa6"), Color("b0703a")][rank - 1]
			if rank <= 3 else Style.TEAL_DARK)
	pos.custom_minimum_size.x = 76
	pos.autowrap_mode = TextServer.AUTOWRAP_OFF
	row.add_child(pos)
	var who := _text(name_text + (tr(" (você)") if me else ""), 26, Style.INK)
	who.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	who.autowrap_mode = TextServer.AUTOWRAP_OFF
	who.clip_text = true
	row.add_child(who)
	var coin := TextureRect.new()
	coin.texture = COIN
	coin.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	coin.custom_minimum_size = Vector2(28, 28)
	coin.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(coin)
	var score_label := _text(Fmt.coins(score), 26, Color("8a4b00"))
	score_label.autowrap_mode = TextServer.AUTOWRAP_OFF
	row.add_child(score_label)


## Cartão grande de distrito com miniatura do cenário.
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


func _icon(texture: Texture2D, size: int) -> TextureRect:
	var icon := TextureRect.new()
	icon.texture = texture
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(size, size)
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return icon


func _text(value: String, size: int, color: Color, weight := 600) -> Label:
	var label := Label.new()
	label.text = value
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_override("font", UiFont.weight(weight))
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return label
