## Estrelas de evolução (ADR 0035): desenho compartilhado pelos lotes do mapa e pela interface.
extends Control

const GOLD := Color("ffc93c")
const GOLD_EDGE := Color("b8730a")
const EMPTY := Color(0.1, 0.2, 0.25, 0.55)

var value := 0:
	set(v):
		value = v
		queue_redraw()
var total := 5
var radius := 13.0


func _init(p_value := 0, p_radius := 13.0) -> void:
	value = p_value
	radius = p_radius
	custom_minimum_size = Vector2(total * radius * 2.3, radius * 2.4)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	draw_row(self, Vector2(custom_minimum_size.x / 2.0, custom_minimum_size.y / 2.0), value, total, radius)


## Fileira de `total` estrelas centrada em `center`; as `count` primeiras cheias.
static func draw_row(canvas: CanvasItem, center: Vector2, count: int, total_stars: int, r: float) -> void:
	var step := r * 2.3
	var start := center.x - step * (total_stars - 1) / 2.0
	for i in total_stars:
		var c := Vector2(start + step * i, center.y)
		var filled := i < count
		canvas.draw_colored_polygon(_star(c, r + 2.0), GOLD_EDGE if filled else Color(0, 0, 0, 0.35))
		canvas.draw_colored_polygon(_star(c, r), GOLD if filled else EMPTY)


static func _star(c: Vector2, r: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for k in 10:
		var radius_k := r if k % 2 == 0 else r * 0.46
		var ang := -PI / 2.0 + TAU * k / 10.0
		pts.append(c + Vector2(cos(ang), sin(ang)) * radius_k)
	return pts
