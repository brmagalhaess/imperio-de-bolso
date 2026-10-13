## Roteiro de demonstração para capturas (não é teste): abre o jogo e simula toques.
##   godot --path game --write-movie out.png --fixed-fps 15 res://tests/demo_runner.tscn
## Passos: coleta pela bolha (+N) → painel de lote travado → lista Construir.
extends Node

var main: Node


func _ready() -> void:
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	while not GameState.loaded:
		await get_tree().process_frame
	await _wait(1.0)
	var island: Node2D = main.get_node("Island")
	var agua: Node2D = island.lots["agua"]
	_tap(island, agua.position + agua.bubble_position())   # coleta → "+N"
	await _wait(0.5)
	print("PASSO coleta")
	await _wait(1.5)
	var coco: Node2D = island.lots["quiosque_coco"]
	_tap(island, coco.position + Vector2(0, -40))           # lote travado → painel
	await _wait(1.5)
	print("PASSO painel")
	main.get_node("UI/HUD")._open_build_list()
	await _wait(1.5)
	print("PASSO construir")
	get_tree().quit()


func _tap(island: Node2D, world: Vector2) -> void:
	island._handle_tap(island.get_canvas_transform() * world)


func _wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout
