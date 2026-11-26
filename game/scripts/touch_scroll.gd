## Rolagem por toque que começa em cima de um cartão ou botão (pedido do titular: na Loja,
## arrastar a partir de um item não rolava). Anexe a uma ScrollContainer:
## - todo controle dentro dela passa o toque adiante (MOUSE_FILTER_PASS), então a lista recebe
##   o arrasto mesmo começando num botão;
## - quando a lista começa a rolar, os botões param de aceitar o toque até o dedo subir — rolar
##   por cima de um item nunca compra/aciona sem querer.
extends Node

var scroll: ScrollContainer
## true enquanto a rolagem iniciada por toque estiver em andamento (para testes).
var muted := false


func _init(target: ScrollContainer) -> void:
	scroll = target


func _ready() -> void:
	scroll.scroll_started.connect(mute)


func _input(event: InputEvent) -> void:
	# Chega antes da interface: prepara a lista para o novo toque.
	if event is InputEventMouseButton and event.pressed and scroll.is_visible_in_tree() \
			and scroll.get_global_rect().has_point(event.position):
		pass_through()
		unmute()


## Faz os controles dentro da lista repassarem o toque à ScrollContainer.
func pass_through() -> void:
	for c in scroll.find_children("*", "Control", true, false):
		var control := c as Control
		if control.mouse_filter == Control.MOUSE_FILTER_STOP and not control is LineEdit:
			control.mouse_filter = Control.MOUSE_FILTER_PASS


## A lista começou a rolar: botões ignoram o dedo até o próximo toque.
func mute() -> void:
	if muted:
		return
	muted = true
	for c in scroll.find_children("*", "BaseButton", true, false):
		var b := c as BaseButton
		b.set_meta("touch_scroll_mask", b.button_mask)
		b.button_mask = 0


func unmute() -> void:
	if not muted:
		return
	muted = false
	for c in scroll.find_children("*", "BaseButton", true, false):
		var b := c as BaseButton
		if b.has_meta("touch_scroll_mask"):
			b.button_mask = b.get_meta("touch_scroll_mask")
			b.remove_meta("touch_scroll_mask")
