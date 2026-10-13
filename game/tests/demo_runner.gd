## Roteiro de demonstração para capturas (não é teste): abre o jogo e simula toques.
##   DEMO=novo     godot --path game --write-movie out.png --fixed-fps 15 res://tests/demo_runner.tscn
##   DEMO=veterano (usa a conta salva; prepare o banco antes)
## novo: tutorial com seta → compra do carrinho.
## veterano: resumo offline → ajudantes trabalhando → Construir (praia) → Cidade → Construir.
extends Node

var main: Node


func _ready() -> void:
	var mode := OS.get_environment("DEMO")
	if mode == "contratar":
		Api.session_path = "user://demo_hire.cfg"
	if mode == "novo":
		Api.session_path = "user://demo_novo.cfg"
		DirAccess.remove_absolute(ProjectSettings.globalize_path(Api.session_path))
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	while not GameState.loaded:
		await get_tree().process_frame
	var hud: Control = main.get_node("UI/HUD")
	if mode == "ajudantes":
		await _wait(2.5)
		hud._modal.close()
		await _wait(1.0)
		print("PASSO praia com ajudantes")
		hud.open_helpers_menu()
		await _wait(1.2)
		print("PASSO tela de ajudantes")
		hud._modal.close()
		await main.go_to_district("cidade")
		await _wait(2.5)
		hud._modal.close()
		await _wait(1.0)
		print("PASSO cidade com ajudantes")
		get_tree().quit()
		return
	if mode == "contratar":
		await _wait(2.5)  # deixa o resumo inicial (se houver) aparecer antes
		hud._modal.close()
		hud.open_helpers_menu()
		await _wait(1.0)
		print("PASSO antes")
		hud._hire_from_menu("pipoca")
		await _wait(1.5)
		print("PASSO depois")
		get_tree().quit()
		return
	if mode == "novo":
		await _wait(2.0)
		print("PASSO tutorial comprar")
		await GameState.purchase("agua")
		main.get_node("UI/HUD").close_sheet()
		await _wait(11.0)
		print("PASSO tutorial coletar")
	else:
		await _wait(2.5)
		print("PASSO resumo praia")
		hud._modal.close()
		hud.open_helpers_menu()
		await _wait(1.5)
		print("PASSO ajudantes")
		hud._modal.close()
		hud.open_map_menu()
		await _wait(1.5)
		print("PASSO mapa com AFK da cidade")
		hud._modal.close()
		await main.go_to_district("cidade")
		await _wait(1.5)
		print("PASSO resumo cidade")
	get_tree().quit()


func _wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout
