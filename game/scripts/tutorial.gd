## Tutorial do primeiro minuto (docs/README.md §2 e §8: menos de 5 minutos).
## O passo atual é deduzido do estado do servidor — nada fica salvo no aparelho:
## comprar o carrinho → coletar → melhorar → contratar ajudante. Ao terminar (ou pular),
## o servidor registra a conclusão (POST /tutorial/complete).
extends Control

const Style := preload("res://scripts/ui_style.gd")
const Layout := preload("res://scripts/layout.gd")
const UiFont := preload("res://scripts/ui_font.gd")

enum Step { BUY, COLLECT, UPGRADE, HIRE, DONE }

const TEXTS := {
	Step.BUY: "Bem-vindo à praia! Toque no Carrinho de Água e compre por 100 moedas.",
	Step.COLLECT: "Seu carrinho já está vendendo! Quando a moeda aparecer, toque nela para coletar.",
	Step.UPGRADE: "Junte 115 moedas e melhore o carrinho: toque nele e depois em Melhorar.",
	Step.HIRE: "Contrate um ajudante no botão Ajudantes: ele vende sozinho quando você sai da praia (até 4h)!",
}
const TUTORIAL_SLUG := "agua"

## Devolve a posição de tela do lote (ou da bolha, se `bubble`) — fornecido pela cena principal.
var target_provider: Callable
## Ponto de tela do botão Ajudantes (topo, centro) — fornecido pelo HUD.
var helpers_target: Callable
## Telas que, abertas, escondem o tutorial (painel do negócio, menus) — fornecido pelo HUD.
var blockers: Array = []
var _collected_once := false
var _finishing := false
var _started_tracked := false
var _card: PanelContainer
var _label: Label
var _arrow: Control


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false

	_card = PanelContainer.new()
	_card.add_theme_stylebox_override("panel", Style.box(Style.CREAM, 30, Style.ORANGE, 5))
	# Embaixo, acima da barra de botões: não cobre os negócios nem as moedas da ilha.
	_card.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE, Control.PRESET_MODE_MINSIZE, 24)
	_card.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_card.offset_bottom = -206
	add_child(_card)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	_card.add_child(row)
	var avatar := TextureRect.new()
	avatar.texture = Layout.texture("char_vendor")
	avatar.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	avatar.custom_minimum_size = Vector2(64, 110)
	row.add_child(avatar)
	_label = Label.new()
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_label.custom_minimum_size.x = 400
	_label.add_theme_font_size_override("font_size", 26)
	_label.add_theme_color_override("font_color", Style.INK)
	row.add_child(_label)
	var skip := Button.new()
	skip.text = tr("Pular")
	skip.custom_minimum_size = Vector2(110, 64)
	skip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	skip.add_theme_font_size_override("font_size", 22)
	Style.style_button(skip, Style.GREY, Style.GREY_DARK, 22)
	skip.pressed.connect(func():
		GameState.track("tutorial_skipped", {"step": int(current_step())})
		_finish())
	row.add_child(skip)

	_arrow = Control.new()
	_arrow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_arrow.draw.connect(_draw_arrow)
	add_child(_arrow)

	GameState.state_changed.connect(_update)
	GameState.collected.connect(func(_items):
		_collected_once = true
		_update())


## Passo atual, deduzido do estado (público para testes).
func current_step() -> Step:
	var b := GameState.business(TUTORIAL_SLUG)
	if not b.get("owned", false):
		return Step.BUY
	var managed: bool = b.get("managed", false)
	var level := int(b.get("level", 1))
	if not (_collected_once or managed or level >= 2 or GameState.coins() != "0"):
		return Step.COLLECT
	if level < 2 and not managed:
		return Step.UPGRADE
	if not managed:
		return Step.HIRE
	return Step.DONE


## Para onde a seta aponta agora (público para testes): "lot", "bubble", "helpers" ou "".
## A seta só aparece quando há algo a fazer — comprado o carrinho, ela sai do lote até a moeda
## ficar pronta; no passo de melhorar, só quando há saldo; no do ajudante, vai para o botão.
func arrow_kind() -> String:
	var b := GameState.business(TUTORIAL_SLUG)
	match current_step():
		Step.BUY:
			return "lot"
		Step.COLLECT:
			return "bubble" if GameState.is_ready(b) else ""
		Step.UPGRADE:
			var cost: Variant = b.get("nextUpgradeCost")
			return "lot" if cost != null and GameState.can_afford(cost) else ""
		Step.HIRE:
			return "helpers"
	return ""


func _update() -> void:
	if not GameState.loaded or GameState.tutorial_completed():
		visible = false
		return
	var step := current_step()
	if step == Step.DONE:
		_finish()
		return
	visible = true
	_label.text = tr(TEXTS[step])
	if not _started_tracked:
		_started_tracked = true
		GameState.track("tutorial_started")


func _process(_delta: float) -> void:
	if not visible:
		return
	var blocked := blockers.any(func(c): return c.visible)
	_card.visible = not blocked
	_arrow.visible = not blocked
	_arrow.queue_redraw()


func _draw_arrow() -> void:
	var kind := arrow_kind()
	var target: Variant = null
	if kind == "helpers" and helpers_target.is_valid():
		target = helpers_target.call()
	elif (kind == "lot" or kind == "bubble") and target_provider.is_valid():
		target = target_provider.call(TUTORIAL_SLUG, kind == "bubble")
	if target == null:
		return
	var bob := sin(Time.get_ticks_msec() / 160.0) * 10.0
	# Alvo no alto da tela (perto do saldo): a seta vem de baixo, apontando para cima.
	var up: bool = target.y < 420
	var dir := -1.0 if up else 1.0
	var tip: Vector2 = target + Vector2(0, (28 + bob) * (1 if up else -1))
	var pts := PackedVector2Array([tip, tip + Vector2(-26, -40 * dir), tip + Vector2(-10, -40 * dir),
			tip + Vector2(-10, -78 * dir), tip + Vector2(10, -78 * dir), tip + Vector2(10, -40 * dir),
			tip + Vector2(26, -40 * dir)])
	_arrow.draw_colored_polygon(pts, Style.ORANGE)
	var outline := pts.duplicate()
	outline.append(pts[0])
	_arrow.draw_polyline(outline, Color.WHITE, 5.0, true)


func _finish() -> void:
	if _finishing:
		return
	_finishing = true
	visible = false
	await GameState.complete_tutorial()
	GameState.notice.emit(tr("Pronto! Agora é com você: construa seu império."))
