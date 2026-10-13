## Roteiro de demonstração para capturas (não é teste): abre o jogo e simula toques.
##   godot --path game --write-movie out.png --fixed-fps 15 res://tests/demo_runner.tscn
## Passos: praia → coleta pela moeda → menu Construir → menu Mapa → cidade → painel.
extends Node

var main: Node


func _ready() -> void:
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	while not GameState.loaded:
		await get_tree().process_frame
	await _wait(1.0)
	var hud: Control = main.get_node("UI/HUD")
	var praia: Node2D = main.districts["praia"]
	var agua: Node2D = praia.lots["agua"]
	_tap(praia, agua.position + agua.bubble_position())
	print("PASSO coleta")
	await _wait(1.5)
	hud.open_build_menu()
	print("PASSO construir")
	await _wait(1.5)
	hud._modal.close()
	hud.open_map_menu()
	print("PASSO mapa")
	await _wait(1.5)
	hud._modal.close()
	await main.go_to_district("cidade")
	print("PASSO cidade")
	await _wait(1.5)
	var cidade: Node2D = main.districts["cidade"]
	var lot: Node2D = cidade.lots["shopping"]
	_tap(cidade, lot.position + Vector2(0, -40))
	print("PASSO painel cidade")
	await _wait(1.5)
	get_tree().quit()


func _tap(view: Node2D, world: Vector2) -> void:
	view._handle_tap(view.get_canvas_transform() * world)


func _wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout
