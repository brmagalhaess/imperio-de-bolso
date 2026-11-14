## "Anúncio de teste" (ADS_MODE=mock): tela cheia de 5 s, claramente identificada, no lugar
## do AdMob até o plugin ser integrado (ADR 0008). `play()` devolve true se assistiu até o fim.
## Nenhum anúncio real é exibido e nada é cobrado.
extends ColorRect

signal finished(completed: bool)

const Style := preload("res://scripts/ui_style.gd")
const UiFont := preload("res://scripts/ui_font.gd")
const DURATION := 5.0

var _left := 0.0
var _label: Label
var _skip: Button


func _ready() -> void:
	color = Color(0.05, 0.06, 0.1, 0.96)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.add_theme_constant_override("separation", 22)
	add_child(box)
	for t in [["ANÚNCIO DE TESTE", 48, Color("ffd34d")],
			["Modo de desenvolvimento: nenhum anúncio real é exibido.", 24, Color(1, 1, 1, 0.8)]]:
		var l := Label.new()
		l.text = tr(t[0])
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size.x = 560
		l.add_theme_font_override("font", UiFont.bold())
		l.add_theme_font_size_override("font_size", t[1])
		l.add_theme_color_override("font_color", t[2])
		box.add_child(l)
	_label = Label.new()
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.add_theme_font_override("font", UiFont.bold())
	_label.add_theme_font_size_override("font_size", 96)
	_label.add_theme_color_override("font_color", Color.WHITE)
	box.add_child(_label)
	_skip = Button.new()
	_skip.text = tr("Fechar (sem prêmio)")
	_skip.custom_minimum_size = Vector2(360, 76)
	Style.style_button(_skip, Style.GREY, Style.GREY_DARK)
	_skip.pressed.connect(func(): _end(false))
	box.add_child(_skip)


func play() -> bool:
	_left = DURATION
	visible = true
	return await finished


func _process(delta: float) -> void:
	if not visible:
		return
	_left -= delta
	_label.text = str(maxi(0, ceili(_left)))
	if _left <= 0.0:
		_end(true)


func _end(completed: bool) -> void:
	if not visible:
		return
	visible = false
	finished.emit(completed)
