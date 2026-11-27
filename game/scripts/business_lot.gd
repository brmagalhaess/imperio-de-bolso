## Um lote da ilha: negócio comprado (arte por nível, progresso, bolha de coleta)
## ou lote travado (placa com cadeado, nome e preço).
extends Node2D

const Layout := preload("res://scripts/layout.gd")
const Fmt := preload("res://scripts/fmt.gd")
const UiFont := preload("res://scripts/ui_font.gd")
const Stars := preload("res://scripts/stars.gd")

const BUBBLE_RADIUS := 34.0
const COIN := preload("res://assets/optimized/icon_coin.png")
const LOCK := preload("res://assets/optimized/lot_lock.png")

var slug := ""
var business: Dictionary = {}
var selected := false

var _building: Sprite2D
var _lock: Sprite2D
var _overlay: Node2D  # bolha/progresso/etiquetas acima de tudo
var _art_path := ""


func _init(p_slug: String) -> void:
	slug = p_slug


func _ready() -> void:
	_building = Sprite2D.new()
	_building.centered = false
	add_child(_building)

	_lock = Sprite2D.new()
	_lock.texture = LOCK
	_lock.scale = Vector2.ONE * Layout.ART_SCALE
	_lock.centered = false
	_lock.position = -Vector2(LOCK.get_width() / 2.0, LOCK.get_height()) * Layout.ART_SCALE
	add_child(_lock)

	_overlay = Node2D.new()
	_overlay.z_index = 20
	_overlay.draw.connect(_draw_overlay)
	add_child(_overlay)


func _process(_delta: float) -> void:
	_overlay.queue_redraw()


func update_from(b: Dictionary) -> void:
	var was_owned: bool = business.get("owned", false)
	var old_tier := Layout.visual_tier(int(business.get("level", 1)))
	business = b
	var owned: bool = b.get("owned", false)
	_lock.visible = not owned
	_building.visible = owned
	if owned:
		var path := Layout.art_path(slug, int(b.level))
		if path != _art_path:
			_art_path = path
			var tex: Texture2D = load(path)
			_building.texture = tex
			_building.scale = Vector2.ONE * Layout.BUILDING_SCALE
			_building.position = -Vector2(tex.get_width() / 2.0, tex.get_height()) * Layout.BUILDING_SCALE
		if not was_owned or Layout.visual_tier(int(b.level)) != old_tier:
			pop()


## Pulinho de comemoração (compra ou nova arte).
func pop() -> void:
	var tween := create_tween()
	scale = Vector2(0.8, 1.2)
	tween.tween_property(self, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)


func building_height() -> float:
	if _building.texture:
		return _building.texture.get_height() * Layout.BUILDING_SCALE
	return LOCK.get_height() * Layout.ART_SCALE


func bubble_position() -> Vector2:
	return Vector2(0, -building_height() - 40)


## Área de toque do lote (prédio ou placa), em coordenadas locais.
func hit_rect() -> Rect2:
	var size := (_building.texture.get_size() * Layout.BUILDING_SCALE
			if _building.visible and _building.texture else LOCK.get_size() * Layout.ART_SCALE)
	return Rect2(Vector2(-size.x / 2, -size.y), size).grow(14)


func hits(local: Vector2) -> bool:
	return hit_rect().has_point(local) or hits_bubble(local)


func hits_bubble(local: Vector2) -> bool:
	return GameState.is_ready(business) and local.distance_to(bubble_position()) <= BUBBLE_RADIUS + 12


func _draw_overlay() -> void:
	if business.is_empty():
		return
	var font: Font = UiFont.bold()
	if not business.owned:
		_pill(font, Vector2(0, 26), tr(business.name), 20, Color(0.12, 0.3, 0.32, 0.92), Color.WHITE)
		if GameState.district_unlocked(str(business.get("district", "praia"))):
			_pill(font, Vector2(0, 58), Fmt.coins(business.cost), 22, Color("fff3d6"), Color("8a4b00"), true)
		else:
			var prev := Layout.previous_district(str(business.get("district", "praia")))
			_pill(font, Vector2(0, 58), tr("Evolua %s ao máximo") % Layout.short_title(prev), 18, Color("e8e0d0"), Color("6b5d48"))
		return

	var top := bubble_position()
	if GameState.is_ready(business):
		var bob := sin(Time.get_ticks_msec() / 220.0) * 5.0
		var c := top + Vector2(0, bob)
		_overlay.draw_circle(c, BUBBLE_RADIUS, Color(1, 1, 1, 0.35))
		_overlay.draw_arc(c, BUBBLE_RADIUS, 0, TAU, 40, Color(1, 1, 1, 0.9), 3.0, true)
		var cs := COIN.get_size() * 0.5
		_overlay.draw_texture_rect(COIN, Rect2(c - cs / 2, cs), false)
	else:
		var p := GameState.cycle_progress(business)
		var automatic: bool = business.get("automatic", false)
		var fill := Color("7ee08a") if automatic else Color("ffd34d")
		_overlay.draw_arc(top, 18, 0, TAU, 32, Color(0, 0, 0, 0.35), 9.0, true)
		_overlay.draw_arc(top, 18, -PI / 2, -PI / 2 + TAU * p, 32, fill, 9.0, true)
	# Mapa limpo (pedido do titular em 2026-11-26): nível e estrelas só no painel do negócio.
	# Sem anel de seleção (pedido do titular em 2026-11-25: ficava fora de posição).


## Etiqueta arredondada centrada em `at`; `coin` adiciona o ícone de moeda à esquerda.
func _pill(font: Font, at: Vector2, text: String, size: int, bg: Color, fg: Color, coin := false) -> void:
	var ts := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size)
	var icon := 22.0 if coin else 0.0
	var w := ts.x + 24 + icon
	var h := size + 12.0
	var rect := Rect2(at - Vector2(w / 2, h / 2), Vector2(w, h))
	var box := StyleBoxFlat.new()
	box.bg_color = bg
	box.set_corner_radius_all(int(h / 2))
	box.draw(_overlay.get_canvas_item(), rect)
	if coin:
		_overlay.draw_texture_rect(COIN, Rect2(rect.position + Vector2(8, (h - 20) / 2), Vector2(20, 20)), false)
	_overlay.draw_string(font, Vector2(rect.position.x + 12 + icon, at.y + size * 0.36), text,
			HORIZONTAL_ALIGNMENT_LEFT, -1, size, fg)
