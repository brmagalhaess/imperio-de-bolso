## Cena principal: distritos (Ilha da Praia, Cidade) + interface, ligados ao servidor.
extends Node2D

const Layout := preload("res://scripts/layout.gd")
const DistrictView := preload("res://scripts/district_view.gd")

var districts := {}  # id → DistrictView
var current := ""

@onready var camera: Camera2D = $Camera2D
@onready var hud: Control = $UI/HUD


func _ready() -> void:
	RenderingServer.set_default_clear_color(Color("017272"))
	for id in Layout.DISTRICT_ORDER:
		var view := DistrictView.new(id)
		view.visible = false
		view.lot_selected.connect(hud.show_business)
		$World.add_child(view)
		districts[id] = view
	_show_district("praia")

	hud.business_requested.connect(_on_business_requested)
	hud.selection_cleared.connect(func():
		for d in districts:
			districts[d].highlight(""))
	hud.district_requested.connect(go_to_district)
	hud.retry_requested.connect(_boot)
	hud.tutorial.target_provider = _tutorial_target
	GameState.connection_failed.connect(hud.show_error)
	# Vendeu o império: recomeça na praia (os outros mapas voltam a ficar bloqueados).
	GameState.empire_sold.connect(func(_gained):
		current = ""
		go_to_district("praia"))
	_boot()


func _boot() -> void:
	hud.show_loading()
	if await GameState.boot():
		hud.hide_overlay()
		# Jogador novo: já mostra o carrinho de água para a primeira compra.
		if not GameState.business("agua").get("owned", true):
			districts["praia"].select("agua")
		hud.maybe_show_popups()  # pódio da semana e prêmio do dia (ADR 0014/0017)


## Troca de distrito com fade (usado pelo Mapa e pela lista Construir).
func go_to_district(id: String) -> void:
	if id == current or not districts.has(id):
		return
	await hud.fade(true)
	_show_district(id)
	await hud.fade(false)
	# Servidor paga o AFK dos ajudantes deste mapa e passa o anterior para AFK.
	await GameState.enter_district(id, true)


func _show_district(id: String) -> void:
	current = id
	GameState.current_district = id
	hud.current_district = id
	hud.close_sheet()
	for d in districts:
		districts[d].visible = d == id
	districts[id].frame(camera)
	Audio.play_music(id)


func _on_business_requested(slug: String) -> void:
	var id := Layout.district_of(slug)
	if id == "":
		return
	await go_to_district(id)
	districts[id].select(slug)


## Posição de tela do lote (ou da sua bolha) para a seta do tutorial; null se fora da tela atual.
func _tutorial_target(slug: String, bubble: bool) -> Variant:
	var id := Layout.district_of(slug)
	if id != current:
		return null
	var view: Node2D = districts[id]
	var lot: Node2D = view.lots[slug]
	var world: Vector2 = lot.position + (lot.bubble_position() if bubble else Vector2(0, -lot.building_height()))
	return view.get_canvas_transform() * world


func _notification(what: int) -> void:
	# Indo para o segundo plano / fechando: manda já o que foi tocado (nada fica só na tela).
	if what in [NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_APPLICATION_FOCUS_OUT,
			NOTIFICATION_WM_CLOSE_REQUEST, NOTIFICATION_WM_GO_BACK_REQUEST] and GameState.loaded:
		GameState.flush_now()
	# Ao voltar do segundo plano, o servidor reapura o estado.
	if what == NOTIFICATION_APPLICATION_RESUMED and GameState.loaded:
		GameState.resume()
