## Botão quadrado arredondado com ícone desenhado em código (PLACEHOLDER até a arte
## definitiva de Missões/Ranking/Diamante — ver docs/BACKLOG.md). Mesmo formato dos ícones
## da arte: cor viva, borda inferior mais escura e ícone branco.
extends Control

signal pressed

const Style := preload("res://scripts/ui_style.gd")

enum Glyph { MISSIONS, TROPHY, GEM }

var glyph: Glyph
var color: Color
var edge: Color
## Número no selo vermelho (0 = escondido).
var badge := 0:
	set(v):
		badge = v
		queue_redraw()


func _init(p_glyph: Glyph, p_color: Color, p_edge: Color, p_size := 76.0) -> void:
	glyph = p_glyph
	color = p_color
	edge = p_edge
	custom_minimum_size = Vector2(p_size, p_size)
	mouse_filter = Control.MOUSE_FILTER_STOP


func _gui_input(event: InputEvent) -> void:
	# Só o clique (o toque no celular chega também como clique emulado): tratar os dois fazia
	# cada toque contar duas vezes.
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			pivot_offset = size / 2
			scale = Vector2.ONE * 0.9
		else:
			scale = Vector2.ONE
			if Rect2(Vector2.ZERO, size).has_point(event.position):
				pressed.emit()
		accept_event()


func _draw() -> void:
	var s := size
	var body := Style.toy_button(color, edge, int(s.x * 0.3))
	body.draw(get_canvas_item(), Rect2(Vector2.ZERO, s))
	var c := s / 2 + Vector2(0, -2)
	var u := s.x / 76.0
	var white := Color.WHITE
	match glyph:
		Glyph.MISSIONS:
			# Prancheta com check.
			draw_rect(Rect2(c + Vector2(-16, -20) * u, Vector2(32, 40) * u), white)
			draw_rect(Rect2(c + Vector2(-8, -25) * u, Vector2(16, 9) * u), color.darkened(0.25))
			draw_polyline(PackedVector2Array([c + Vector2(-9, 1) * u, c + Vector2(-2, 9) * u,
					c + Vector2(10, -6) * u]), color.darkened(0.15), 5 * u, true)
		Glyph.TROPHY:
			var gold := Color("ffd34d")
			draw_colored_polygon(PackedVector2Array([c + Vector2(-17, -20) * u, c + Vector2(17, -20) * u,
					c + Vector2(12, 2) * u, c + Vector2(4, 8) * u, c + Vector2(-4, 8) * u,
					c + Vector2(-12, 2) * u]), gold)
			draw_arc(c + Vector2(-17, -10) * u, 7 * u, PI / 2, PI * 1.5, 12, gold, 4 * u)
			draw_arc(c + Vector2(17, -10) * u, 7 * u, -PI / 2, PI / 2, 12, gold, 4 * u)
			draw_rect(Rect2(c + Vector2(-4, 8) * u, Vector2(8, 8) * u), gold)
			draw_rect(Rect2(c + Vector2(-12, 16) * u, Vector2(24, 6) * u), gold)
		Glyph.GEM:
			draw_colored_polygon(PackedVector2Array([c + Vector2(-16, -8) * u, c + Vector2(-8, -18) * u,
					c + Vector2(8, -18) * u, c + Vector2(16, -8) * u, c + Vector2(0, 18) * u]), Color("7fe3ff"))
			draw_polyline(PackedVector2Array([c + Vector2(-16, -8) * u, c + Vector2(16, -8) * u]),
					Color("2bb6e0"), 2 * u)
	if badge > 0:
		var b := Vector2(s.x - 8, 8)
		draw_circle(b, 15, Color("ff3b3b"))
		draw_arc(b, 15, 0, TAU, 24, Color.WHITE, 3, true)
		var font := ThemeDB.fallback_font
		var t := str(badge)
		var w := font.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x
		draw_string(font, b + Vector2(-w / 2, 7), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color.WHITE)


## Ícone de diamante pequeno, para usar dentro de textos/etiquetas.
static func gem_texture() -> Texture2D:
	var img := Image.create(48, 48, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for y in 48:
		for x in 48:
			var dx := absf(x - 24.0)
			var inside := (y >= 10 and y < 20 and dx <= 8 + (y - 10) * 0.8) or (y >= 20 and y < 44 and dx <= 16 * (44 - y) / 24.0)
			if inside:
				img.set_pixel(x, y, Color("7fe3ff") if y < 20 else Color("43c8f0"))
	return ImageTexture.create_from_image(img)
