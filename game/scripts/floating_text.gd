## Texto "+N" que sobe e some ao coletar.
extends Label

const UiFont := preload("res://scripts/ui_font.gd")


func _init(text_value: String, at: Vector2) -> void:
	text = text_value
	z_index = 50
	add_theme_font_override("font", UiFont.bold())
	add_theme_font_size_override("font_size", 40)
	add_theme_color_override("font_color", Color("ffe14d"))
	add_theme_color_override("font_outline_color", Color("7a3e00"))
	add_theme_constant_override("outline_size", 10)
	horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	size = Vector2(240, 60)
	position = at - Vector2(120, 30)


func _ready() -> void:
	var tween := create_tween().set_parallel()
	tween.tween_property(self, "position:y", position.y - 110, 1.1).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tween.tween_property(self, "modulate:a", 0.0, 0.5).set_delay(0.6)
	tween.chain().tween_callback(queue_free)
