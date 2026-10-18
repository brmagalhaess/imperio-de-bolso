## Roteiro de demonstração para capturas (não é teste): abre o jogo e simula toques.
##   DEMO=novo     godot --path game --write-movie out.png --fixed-fps 15 res://tests/demo_runner.tscn
##   DEMO=veterano (usa a conta salva; prepare o banco antes)
## novo: tutorial com seta → compra do carrinho.
## veterano: resumo offline → ajudantes trabalhando → Construir (praia) → Cidade → Construir.
extends Node

const Layout := preload("res://scripts/layout.gd")

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
	if mode == "evolucao":
		Api.session_path = "user://demo_evolucao.cfg"
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	while not GameState.loaded:
		await get_tree().process_frame
	var hud: Control = main.get_node("UI/HUD")
	if mode == "capturas":
		# Capturas para as lojas (tamanho = janela; ver tools/apple/screenshots.sh).
		var out := OS.get_environment("CAPTURE_DIR")
		await _wait(2.5)
		hud._modal.close()
		var build_all := func():  # mapas novos construídos (só na tela, servidor intocado)
			GameState._presence_timer.stop()
			for b in GameState.businesses():
				b["owned"] = true
				b["level"] = 25
				b["managed"] = true
			GameState.state_changed.emit()
		GameState.daily["claimedToday"] = true  # sem o aviso automático por cima das telas
		var shots := [
			["01_praia", func(): main._show_district("praia")],
			["02_cidade", func(): main._show_district("cidade")],
			["03_mapas", func(): hud.open_map_menu()],
			["04_missoes", func():
				hud.map_trail.close()
				hud.open_missions_menu()],
			["05_loja", func(): hud.open_store_menu()],
			["06_diario", func():
				GameState.daily["claimedToday"] = false
				hud.open_daily_menu()],
			["07_espaco", func():
				build_all.call()
				main._show_district("espaco")],
			["08_serra", func(): main._show_district("serra")],
		]
		for shot in shots:
			if shot[0] in ["01_praia", "02_cidade", "07_espaco", "08_serra"]:
				hud._modal.close()
			shot[1].call()
			await _wait(1.6)
			var img := get_viewport().get_texture().get_image()
			img.save_png(out.path_join(shot[0] + ".png"))
			print("PASSO %s %dx%d" % [shot[0], img.get_width(), img.get_height()])
		get_tree().quit()
		return
	if mode == "evolucao":
		# Bug relatado (2026-10-18): evoluir rápido e trocar de mapa perdia evoluções.
		await _wait(2.0)
		hud._modal.close()
		if not GameState.business("agua").owned:
			await GameState.purchase("agua")
			await GameState.settled()
		print("PLAYER %s" % str(GameState.state.player.get("id", "")))
		if GameState.coins().to_int() < 10_000_000:
			print("PASSO precisa de moedas")
			get_tree().quit()
			return
		var before := int(GameState.business("agua").level)
		for i in 15:
			GameState.upgrade("agua")  # toques seguidos, sem esperar
			await get_tree().create_timer(0.05).timeout
		var shown := int(GameState.business("agua").level)
		await GameState.enter_district("praia", false)  # "troca de mapa" logo depois
		var res := await Api.get_state()
		print("PASSO evolucao antes=%d tela=%d servidor=%d" % [before, shown, int(res.data.businesses.filter(func(b): return b.slug == "agua")[0].level)])
		get_tree().quit()
		return
	if mode == "ofertas":
		# Pacotes promocionais (ADR 0024): coluna direita na cidade e a tela de um pacote.
		var out := OS.get_environment("CAPTURE_DIR")
		await _wait(2.5)
		hud._modal.close()
		GameState.daily["claimedToday"] = true
		await GameState.refresh_catalog()
		await _wait(1.5)
		get_viewport().get_texture().get_image().save_png(out.path_join("ofertas_hud.png"))
		print("PASSO ofertas hud (%d pacotes)" % GameState.offers().size())
		# Turbo ativo (só na tela): o selo não pode ficar por cima da coluna dos pacotes.
		GameState.state.player["turboUntil"] = Time.get_datetime_string_from_unix_time(int(GameState.server_now()) + 3 * 3600) + "Z"
		await _wait(1.5)
		get_viewport().get_texture().get_image().save_png(out.path_join("ofertas_turbo.png"))
		print("PASSO ofertas com turbo")
		GameState.state.player["doubleUntil"] = Time.get_datetime_string_from_unix_time(int(GameState.server_now()) + 3000) + "Z"
		await _wait(1.5)
		get_viewport().get_texture().get_image().save_png(out.path_join("ofertas_turbo_dobro.png"))
		print("PASSO turbo + dobro")
		GameState.state.player.erase("doubleUntil")
		hud.open_store_menu()
		await _wait(1.5)
		for c in hud._modal._list.get_children():
			if c is Label and c.text == tr("Dobro de moedas"):
				hud._modal._scroll.scroll_vertical = int(c.position.y) - 20
		await _wait(1.0)
		get_viewport().get_texture().get_image().save_png(out.path_join("loja_dobro.png"))
		print("PASSO loja dobro")
		hud._modal.close()
		var list := GameState.offers()
		if not list.is_empty():
			hud.open_offer_menu(list[min(1, list.size() - 1)])
			await _wait(1.5)
			get_viewport().get_texture().get_image().save_png(out.path_join("ofertas_pacote.png"))
			print("PASSO ofertas pacote")
		get_tree().quit()
		return
	if mode == "loja_paga":
		# Imagens da revisão das compras (App Store): Loja com diamantes e Passe VIP à venda.
		var out := OS.get_environment("CAPTURE_DIR")
		await _wait(2.5)
		hud._modal.close()
		GameState.daily["claimedToday"] = true
		hud.open_store_menu()
		await _wait(1.5)
		hud._modal._scroll.scroll_vertical = 100000
		await _wait(1.0)
		get_viewport().get_texture().get_image().save_png(out.path_join("loja_diamantes.png"))
		print("PASSO loja diamantes")
		var vip_y := 0
		for c in hud._modal._list.get_children():
			if c is Label and c.text == tr("Passe VIP"):
				vip_y = int(c.position.y) - 20
		hud._modal._scroll.scroll_vertical = vip_y
		await _wait(1.0)
		get_viewport().get_texture().get_image().save_png(out.path_join("loja_vip.png"))
		print("PASSO loja vip")
		get_tree().quit()
		return
	if mode == "ilhas":
		# Mapas maiores: tudo construído e a câmera arrastada até a ilha de expansão.
		var out := OS.get_environment("CAPTURE_DIR")
		await _wait(2.5)
		hud._modal.close()
		GameState._presence_timer.stop()
		for b in GameState.businesses():
			b["owned"] = true
			b["level"] = [1, 10, 25, 50, 100][randi() % 5]
			b["managed"] = true
		GameState.daily["claimedToday"] = true
		GameState.state_changed.emit()
		for id in ["cidade", "porto", "ilha", "espaco"]:
			main._show_district(id)
			var view: Node2D = main.districts[id]
			main.camera.position.y = 99999.0
			view._clamp_camera()
			await _wait(1.2)
			get_viewport().get_texture().get_image().save_png(out.path_join("ilha_%s.png" % id))
			print("PASSO ilha %s" % id)
		get_tree().quit()
		return
	if mode == "lote2":
		await _wait(2.0)
		hud._modal.close()
		hud.open_store_menu()
		await _wait(1.0)
		hud._modal._scroll.scroll_vertical = 430
		await _wait(1.0)
		print("PASSO loja turbo cedo")
		GameState.daily = {"day": 3, "claimedToday": false, "rewards": [
			{"day": 1, "coins": "2300000", "gems": 0, "turboMinutes": 0}, {"day": 2, "coins": null, "gems": 5, "turboMinutes": 0},
			{"day": 3, "coins": "70000000", "gems": 0, "turboMinutes": 0}, {"day": 4, "coins": null, "gems": 0, "turboMinutes": 60},
			{"day": 5, "coins": null, "gems": 10, "turboMinutes": 0}, {"day": 6, "coins": "140000000", "gems": 0, "turboMinutes": 0},
			{"day": 7, "coins": null, "gems": 25, "turboMinutes": 120}]}
		hud.open_daily_menu()
		await _wait(1.2)
		print("PASSO diario")
		hud.open_missions_menu()
		await _wait(0.6)
		hud._modal._scroll.scroll_vertical = 100000
		await _wait(1.0)
		print("PASSO missoes")
		hud.open_ranking_menu(0)
		await _wait(1.5)
		print("PASSO liga")
		hud.open_store_menu()
		await _wait(1.0)
		hud._modal._scroll.scroll_vertical = 520
		await _wait(1.0)
		print("PASSO loja turbo")
		GameState.weekend = {"active": true, "district": "cidade", "endsAt": "2026-10-19T03:00:00.000Z",
			"serverTime": "2026-10-17T15:00:00.000Z", "target": "7200000", "progress": "5100000",
			"prizeGems": 20, "completed": false, "claimed": false}
		GameState.event_changed.emit()
		hud.open_event_menu()
		await _wait(1.2)
		print("PASSO evento")
		get_tree().quit()
		return
	if mode == "saldo":
		for i in 4:
			await _wait(2.0)
			print("cur=%s wallet=%s live=%d coins=%s" % [GameState.current_district, GameState.state.wallet.coins, GameState.live_coins(), GameState.coins()])
			for b in GameState.businesses():
				if b.get("automatic", false):
					print("  auto %s d=%s live=%s pend=%s rem=%s cyc=%s" % [b.slug, b.district, GameState.is_live(b), b.pendingAmount, b.secondsRemaining, b.cycleSeconds])
		get_tree().quit()
		return
	if mode == "distritos" or mode == "vitrine":
		hud._modal.close()
		await _wait(1.5)
		if mode == "vitrine":  # só na tela: todos construídos no nível 25 (servidor intocado)
			GameState._presence_timer.stop()
			for b in GameState.businesses():
				b["owned"] = true
				b["level"] = 25
				b["managed"] = true
			GameState.state_changed.emit()
		for id in Layout.DISTRICT_ORDER:
			hud._modal.close()
			if mode == "vitrine":
				for b in GameState.businesses():
					b["owned"] = true
					b["level"] = 25
					b["managed"] = true
				GameState.state_changed.emit()
			main._show_district(id)
			await _wait(1.2)
			print("PASSO " + id)
		get_tree().quit()
		return
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
