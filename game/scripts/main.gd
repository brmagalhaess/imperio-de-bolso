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
	GameState.connection_failed.connect(hud.show_error)
	_boot()


func _boot() -> void:
	hud.show_loading()
	if await GameState.boot():
		hud.hide_overlay()
		# Jogador novo: já mostra o carrinho de água para a primeira compra.
		if not GameState.business("agua").get("owned", true):
			districts["praia"].select("agua")


## Troca de distrito com fade (usado pelo Mapa e pela lista Construir).
func go_to_district(id: String) -> void:
	if id == current or not districts.has(id):
		return
	await hud.fade(true)
	_show_district(id)
	await hud.fade(false)


func _show_district(id: String) -> void:
	current = id
	hud.current_district = id
	hud.close_sheet()
	for d in districts:
		districts[d].visible = d == id
	districts[id].frame(camera)


func _on_business_requested(slug: String) -> void:
	var id := Layout.district_of(slug)
	if id == "":
		return
	await go_to_district(id)
	districts[id].select(slug)


func _notification(what: int) -> void:
	# Ao voltar do segundo plano, o servidor reapura o estado.
	if what == NOTIFICATION_APPLICATION_RESUMED and GameState.loaded:
		GameState.refresh()
