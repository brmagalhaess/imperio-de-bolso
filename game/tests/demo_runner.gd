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
	if mode == "excluir":
		Api.session_path = "user://demo_excluir.cfg"
		DirAccess.remove_absolute(ProjectSettings.globalize_path(Api.session_path))
	# DEMO_LANG=en|es: captura em outro idioma sem mudar a escolha salva.
	if OS.get_environment("DEMO_LANG") != "":
		TranslationServer.set_locale(OS.get_environment("DEMO_LANG"))
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	while not GameState.loaded:
		await get_tree().process_frame
	var hud: Control = main.get_node("UI/HUD")
	if mode == "idioma":
		await _wait(2.0)
		hud._modal.close()
		await _wait(0.8)
		print("PASSO mapa")
		hud.open_missions_menu()
		await _wait(1.2)
		print("PASSO missoes")
		hud.open_store_menu()
		await _wait(1.2)
		print("PASSO loja")
		hud.open_settings_menu()
		await _wait(1.0)
		print("PASSO config")
		hud.open_language_menu()
		await _wait(1.0)
		print("PASSO idiomas")
		get_tree().quit()
		return
	if mode == "prestigio":
		await _wait(2.0)
		hud._modal.close()
		await GameState.refresh_prestige()
		hud.open_profile_menu()
		await _wait(1.0)
		hud._modal._scroll.scroll_vertical = 100000
		await _wait(1.2)
		print("PASSO perfil prestigio")
		hud.open_prestige_form()
		await _wait(1.2)
		print("PASSO vender")
		get_tree().quit()
		return
	if mode == "mapas":
		# Trilha de mapas + cenas novas (porto e centro) mostradas direto, para captura.
		await _wait(2.0)
		hud._modal.close()
		hud.open_map_menu()
		await _wait(1.5)
		print("PASSO trilha")
		hud.map_trail._scroll.scroll_vertical = 0
		await _wait(1.2)
		print("PASSO trilha topo")
		hud.map_trail.close()
		for id in ["porto", "centro"]:
			main._show_district(id)
			await _wait(1.5)
			print("PASSO cena " + id)
		get_tree().quit()
		return
	if mode == "excluir":
		# Mostra Perfil → Excluir conta (não confirma: aqui a cena atual é o roteiro).
		await _wait(2.0)
		hud.open_profile_menu()
		await _wait(1.2)
		hud._modal._scroll.scroll_vertical = 100000
		await _wait(1.0)
		print("PASSO perfil fim")
		hud.open_delete_account_form()
		await _wait(1.2)
		print("PASSO excluir conta")
		await Api.delete_account()
		get_tree().quit()
		return
	if mode == "loja2":
		await _wait(2.5)
		hud._modal.close()
		await hud.open_store_menu()
		await _wait(1.5)
		print("PASSO loja topo")
		hud._modal._scroll.scroll_vertical = 520
		await _wait(1.0)
		print("PASSO loja vip")
		hud._modal.close()
		hud.open_profile_menu()
		await _wait(1.2)
		print("PASSO perfil")
		hud.open_name_form()
		await _wait(1.2)
		print("PASSO alterar nome")
		get_tree().quit()
		return
	if mode == "loja":
		await _wait(2.5)
		hud._modal.close()
		await hud.open_store_menu()
		await _wait(1.5)
		print("PASSO loja")
		hud._modal._scroll.scroll_vertical = 900
		await _wait(1.0)
		print("PASSO loja rolada")
		var item := GameState.store_item("gems_120")
		hud._confirm_sandbox(item, item.productId)
		await _wait(1.2)
		print("PASSO confirmar compra de teste")
		hud._modal.close()
		hud.watch_ad("ad_boost")
		await _wait(2.0)
		print("PASSO anúncio de teste")
		await _wait(5.0)
		hud.show_offline_summary("praia", "1250000", 7200, false, 14400)
		await _wait(1.2)
		print("PASSO resumo com dobrar")
		get_tree().quit()
		return
	if mode == "etapa3":
		await _wait(2.5)
		hud._modal.close()
		await _wait(0.8)
		print("PASSO tela com botões laterais")
		hud.open_missions_menu()
		await _wait(1.5)
		print("PASSO missões")
		hud._modal.close()
		hud.open_ranking_menu()
		await _wait(1.8)
		print("PASSO ranking")
		hud._modal.close()
		hud.open_profile_menu()
		await _wait(1.5)
		print("PASSO perfil e conquistas")
		get_tree().quit()
		return
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
