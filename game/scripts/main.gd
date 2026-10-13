## Cena principal: Ilha da Praia + interface, ligadas ao estado do servidor.
extends Node2D

@onready var island: Node2D = $Island
@onready var hud: Control = $UI/HUD


func _ready() -> void:
	RenderingServer.set_default_clear_color(Color("017272"))
	island.lot_selected.connect(hud.show_business)
	hud.business_requested.connect(island.select)
	hud.retry_requested.connect(_boot)
	GameState.connection_failed.connect(hud.show_error)
	_boot()


func _boot() -> void:
	hud.show_loading()
	if await GameState.boot():
		hud.hide_overlay()
		# Jogador novo: já mostra o carrinho de água para a primeira compra.
		if not GameState.business("agua").get("owned", true):
			island.select("agua")


func _notification(what: int) -> void:
	# Ao voltar do segundo plano, o servidor reapura o estado.
	if what == NOTIFICATION_APPLICATION_RESUMED and GameState.loaded:
		GameState.refresh()
