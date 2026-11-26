## Paleta e caixas da interface (mockup B): cartões creme com borda turquesa, botões
## "de brinquedo" com sombra embaixo. Usado pelo HUD e pelos menus.
extends RefCounted

const CREAM := Color("fff6e3")
const CREAM_CARD := Color("fffaf0")
const CREAM_LINE := Color("ecd9b0")
const TEAL := Color("0f8f8a")
const TEAL_LIGHT := Color("14a8a1")
const TEAL_DARK := Color("0b5f5c")
const INK := Color("3a2a14")
const INK_SOFT := Color("7a6a50")
const GREEN := Color("37c06a")
const GREEN_DARK := Color("1f8c48")
const ORANGE := Color("ff9f1c")
const ORANGE_DARK := Color("c46f00")
const RED := Color("ff6b6b")
const RED_DARK := Color("d94f4f")
const GREY := Color("c9bfae")
const GREY_DARK := Color("a99f8e")
const MIN_TOUCH := 88  # px na resolução base (~48 dp)


static func box(color: Color, radius: int, border := Color.TRANSPARENT, border_w := 0,
		shadow := true) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = color
	s.set_corner_radius_all(radius)
	s.set_content_margin_all(16)
	if border_w > 0:
		s.border_color = border
		s.set_border_width_all(border_w)
	if shadow:
		s.shadow_color = Color(0, 0, 0, 0.18)
		s.shadow_size = 6
		s.shadow_offset = Vector2(0, 4)
	return s


## Caixa de botão com "degrau" embaixo (pressed = degrau menor).
static func toy_button(color: Color, edge: Color, radius := 26, pressed := false) -> StyleBoxFlat:
	var s := box(color.darkened(0.06) if pressed else color, radius, edge, 0, false)
	s.border_color = edge
	s.border_width_bottom = 2 if pressed else 7
	s.content_margin_left = 18
	s.content_margin_right = 18
	return s


## Aplica as caixas de botão (normal/hover/pressed/disabled) com a cor dada.
static func style_button(b: Button, color: Color, edge: Color, radius := 26) -> void:
	b.add_theme_stylebox_override("normal", toy_button(color, edge, radius))
	b.add_theme_stylebox_override("hover", toy_button(color.lightened(0.05), edge, radius))
	b.add_theme_stylebox_override("pressed", toy_button(color, edge, radius, true))
	b.add_theme_stylebox_override("disabled", toy_button(GREY, GREY_DARK, radius))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())


## Botão redondo vermelho de fechar.
static func close_button(on_press: Callable) -> Button:
	var b := Button.new()
	b.text = "✕"
	b.custom_minimum_size = Vector2(68, 68)
	b.add_theme_font_size_override("font_size", 30)
	style_button(b, RED, RED_DARK, 34)
	b.pressed.connect(on_press)
	return b
