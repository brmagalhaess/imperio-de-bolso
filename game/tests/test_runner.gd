## Testes do cliente. Rodar:
##   godot --headless --path game res://tests/test_runner.tscn
## Com a API local no ar, adicione IMPERIO_TEST_API=1 para o teste de integração.
extends Node

const Fmt := preload("res://scripts/fmt.gd")
const Layout := preload("res://scripts/layout.gd")
const Tutorial := preload("res://scripts/tutorial.gd")
const Hud := preload("res://scripts/hud.gd")

var _failures := 0
var _checks := 0
var _sections_done := 0


func _ready() -> void:
	var expected_sections := 1
	await _unit_tests()
	if OS.get_environment("IMPERIO_TEST_API") == "1":
		expected_sections += 1
		await _integration_test()
	# Erro de script aborta a função sem exceção: seção não concluída = falha.
	check(_sections_done == expected_sections, "todas as seções terminaram sem erro de script")
	print("\n%d verificações, %d falhas" % [_checks, _failures])
	get_tree().quit(1 if _failures > 0 else 0)


func check(cond: bool, label: String) -> void:
	_checks += 1
	if cond:
		print("  ok  ", label)
	else:
		_failures += 1
		printerr("  FALHOU  ", label)


func _unit_tests() -> void:
	print("Unitários")
	check(Fmt.coins("0") == "0", "coins 0")
	check(Fmt.coins("100") == "100", "coins 100")
	check(Fmt.coins("1000") == "1.000", "coins 1.000")
	check(Fmt.coins("8000000") == "8.000.000", "coins 8.000.000")
	check(Fmt.coins("123456789012345678") == "123.456.789.012.345.678", "coins além de float")
	check(Fmt.coins("-1500") == "-1.500", "coins negativo")
	check(Fmt.duration(10) == "10 s", "duração 10 s")
	check(Fmt.duration(90) == "1 min 30 s", "duração 90 s")
	check(Fmt.duration(3700) == "1 h 01 min", "duração 3700 s")
	check(Fmt.duration(480_000) == "5 d 13 h", "duração em dias")
	check(Fmt.rate(12.0) == "+12/s", "renda inteira")
	check(Fmt.rate(2.5) == "+2,5/s", "renda com decimal")
	check(Fmt.rate(1250.4) == "+1.250/s", "renda grande")

	check(Layout.visual_tier(1) == 1 and Layout.visual_tier(9) == 1, "arte nível 1 (1–9)")
	check(Layout.visual_tier(10) == 2 and Layout.visual_tier(24) == 2, "arte nível 2 (10–24)")
	check(Layout.visual_tier(25) == 3 and Layout.visual_tier(100) == 3, "arte nível 3 (25+)")
	var praia: Dictionary = Layout.DISTRICTS.praia.lots
	var cidade: Dictionary = Layout.DISTRICTS.cidade.lots
	check(praia.size() == 4 and cidade.size() == 6, "4 lotes na praia e 6 na cidade")
	check(Layout.district_of("agua") == "praia" and Layout.district_of("shopping") == "cidade",
			"distrito de cada negócio")
	var all_art := true
	for slug in Layout.BUSINESS_ART:
		for level in [1, 10, 25]:
			all_art = all_art and ResourceLoader.exists(Layout.art_path(slug, level))
	check(all_art and Layout.BUSINESS_ART.size() == 10, "arte dos 3 níveis existe para os 10 negócios")
	var lots_apart := true
	for lots in [praia, cidade]:
		var points: Array = lots.values()
		for i in points.size():
			for j in range(i + 1, points.size()):
				lots_apart = lots_apart and points[i].distance_to(points[j]) > 150
	check(lots_apart, "lotes afastados entre si")
	var ui_ok := true
	for name in ["icon_build", "icon_shop", "icon_map", "icon_profile", "icon_coin",
			"icon_settings", "icon_help", "lot_lock", "char_vendor"] + Layout.DISTRICTS.praia.walkers:
		ui_ok = ui_ok and ResourceLoader.exists("res://assets/optimized/%s.png" % name)
	for id in Layout.DISTRICT_ORDER:
		ui_ok = ui_ok and ResourceLoader.exists("res://assets/optimized/%s" % Layout.DISTRICTS[id].base)
	for slug in Layout.BUSINESS_ART:
		ui_ok = ui_ok and ResourceLoader.exists("res://assets/optimized/%s.png" % Layout.helper_texture_name(slug))
	ui_ok = ui_ok and ResourceLoader.exists("res://assets/optimized/icon_helpers.png")
	check(ui_ok, "ícones e personagens existem")

	var key: String = Api.new_idempotency_key()
	check(key.length() == 32 and key != Api.new_idempotency_key(), "Idempotency-Key aleatória")

	GameState._apply_state({"wallet": {"coins": "250", "gems": "0"}, "businesses": [
		{"slug": "agua", "owned": true, "profitPerCycle": "10", "cycleSeconds": 10},
		{"slug": "pipoca", "owned": true, "profitPerCycle": "40", "cycleSeconds": 20},
		{"slug": "sorveteria", "owned": false, "profitPerCycle": "150", "cycleSeconds": 30},
	]})
	check(GameState.can_afford("250") and not GameState.can_afford("251"), "can_afford")
	check(is_equal_approx(GameState.income_per_second(), 3.0), "renda por segundo só dos comprados")
	# Erro de script aborta a função e ela devolve null: a seção conta como falha.
	check(await _tutorial_tests() == true, "seção tutorial executou até o fim")
	check(await _build_menu_tests() == true, "seção menus executou até o fim")
	_sections_done += 1


func _biz(slug: String, owned: bool, level := 1, managed := false, district := "praia") -> Dictionary:
	return {"slug": slug, "name": slug, "owned": owned, "level": level if owned else 0,
		"managed": managed, "district": district, "cost": "100", "profitPerCycle": "10",
		"cycleSeconds": 10, "managerCost": "150", "nextUpgradeCost": "115",
		"cycleStartedAt": null, "secondsRemaining": 0, "ready": false}


func _tutorial_tests() -> bool:
	var t: Control = Tutorial.new()
	add_child(t)
	var states := [
		[{"coins": "100", "agua": [false]}, Tutorial.Step.BUY, "tutorial: comprar"],
		[{"coins": "0", "agua": [true, 1]}, Tutorial.Step.COLLECT, "tutorial: coletar"],
		[{"coins": "30", "agua": [true, 1]}, Tutorial.Step.UPGRADE, "tutorial: melhorar"],
		[{"coins": "0", "agua": [true, 2]}, Tutorial.Step.HIRE, "tutorial: contratar ajudante"],
		[{"coins": "0", "agua": [true, 2, true]}, Tutorial.Step.DONE, "tutorial: concluído"],
	]
	for case in states:
		var a: Array = case[0].agua
		GameState.state = {"player": {"tutorialCompleted": true}, "wallet": {"coins": case[0].coins},
			"businesses": [_biz("agua", a[0], a[1] if a.size() > 1 else 1, a[2] if a.size() > 2 else false)]}
		check(t.current_step() == case[1], case[2])
	t.queue_free()
	return true


func _build_menu_tests() -> bool:
	var hud: Control = Hud.new()
	add_child(hud)
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "50000", "gems": "0"},
		"districts": [{"id": "praia", "unlocked": true}, {"id": "cidade", "unlocked": true}],
		"businesses": [_biz("agua", true), _biz("pipoca", false), _biz("sorveteria", false),
			_biz("quiosque_coco", true), _biz("mercadinho", false, 1, false, "cidade")]})
	hud.current_district = "praia"
	hud.open_build_menu()
	var names := []
	for c in hud._modal._list.get_children():
		if not c.is_queued_for_deletion():
			names.append(c.get_child(0).get_child(1).get_child(0).text)
	check(names == ["pipoca", "sorveteria"], "Construir: só o mapa atual e só o que falta construir")
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "0", "gems": "0"},
		"districts": [{"id": "praia", "unlocked": true}, {"id": "cidade", "unlocked": true}],
		"businesses": [_biz("agua", true), _biz("pipoca", true), _biz("sorveteria", true),
			_biz("quiosque_coco", true)]})
	hud.open_build_menu()
	var buttons := 0
	for c in hud._modal._list.get_children():
		if not c.is_queued_for_deletion() and c is Button:
			buttons += 1
	check(buttons == 1, "Construir vazio sugere ir para a Cidade")

	var helper_state := _biz("pipoca", true)
	helper_state.managed = true
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "500", "gems": "0"},
		"districts": [{"id": "praia", "unlocked": true}, {"id": "cidade", "unlocked": false}],
		"businesses": [_biz("agua", true), helper_state, _biz("sorveteria", false),
			_biz("quiosque_coco", false), _biz("mercadinho", true, 1, false, "cidade")]})
	hud.open_helpers_menu()
	var helper_buttons := []
	for c in hud._modal._list.get_children():
		if not c.is_queued_for_deletion() and c is PanelContainer:
			var row: HBoxContainer = c.get_child(0)
			var btn: Button = row.get_child(row.get_child_count() - 1)
			helper_buttons.append([row.get_child(2).get_child(0).text, btn.text, btn.disabled])
	check(helper_buttons.size() == 4, "Ajudantes: só os 4 negócios do mapa atual")
	check(helper_buttons[0] == ["agua", "150", false], "Ajudantes: contratar com preço")
	check(helper_buttons[1][1] == "Contratado", "Ajudantes: contratado")
	check(helper_buttons[2][2] == true, "Ajudantes: negócio não construído fica travado")

	# Regressão: contratar com a tela aberta não pode recriar a lista (a janela piscava).
	await get_tree().create_timer(0.5).timeout  # termina a animação de entrada
	var cards_before := []
	for c in hud._modal._list.get_children():
		cards_before.append(c)
	var hired_now := _biz("agua", true)
	hired_now.managed = true
	helper_state.managed = true
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "350", "gems": "0"},
		"districts": [{"id": "praia", "unlocked": true}, {"id": "cidade", "unlocked": false}],
		"businesses": [hired_now, helper_state, _biz("sorveteria", true),
			_biz("quiosque_coco", false), _biz("mercadinho", true, 1, false, "cidade")]})
	var cards_after := []
	for c in hud._modal._list.get_children():
		cards_after.append(c)
	check(cards_after == cards_before and not cards_after.any(func(c): return c.is_queued_for_deletion()),
			"contratar não recria os cartões")
	check(is_equal_approx(hud._modal.modulate.a, 1.0) and hud._modal._card.scale == Vector2.ONE,
			"contratar não faz a janela piscar")
	var agua_btn: Button = hud._helper_cards["agua"].button
	var sorv_btn: Button = hud._helper_cards["sorveteria"].button
	check(agua_btn.text == "Contratado", "cartão contratado atualiza no lugar")
	check(sorv_btn.text == "150" and not sorv_btn.disabled, "preço dos outros ajudantes não muda")

	# Missões: cartões com progresso e resgate; atualização no lugar ao resgatar.
	GameState.missions = {"day": "2026-01-01", "resetsAt": "2026-01-02T03:00:00.000Z",
		"serverTime": "2026-01-01T12:00:00.000Z", "missions": [
			{"id": "m1", "template": "collect_times", "title": "Colete moedas 10 vezes", "target": "10",
				"progress": "10", "completed": true, "claimed": false, "rewardCoins": "450", "rewardGems": 1},
			{"id": "m2", "template": "upgrade_times", "title": "Melhore negócios 5 vezes", "target": "5",
				"progress": "2", "completed": false, "claimed": false, "rewardCoins": "450", "rewardGems": 1}]}
	hud.open_missions_menu()
	var m1: Button = hud._reward_cards["m1"].button
	var m2: Button = hud._reward_cards["m2"].button
	check(m1.text == "Resgatar" and not m1.disabled, "missão concluída mostra Resgatar")
	check(m2.text == "2/5" and m2.disabled, "missão em andamento mostra o progresso")
	check(GameState.claimable_missions() == 1, "selo conta 1 prêmio para resgatar")
	var m1_card: Node = hud._modal._list.get_child(1)
	GameState.missions.missions[0].claimed = true
	GameState.missions_changed.emit()
	check(m1.text == "Resgatado" and hud._modal._list.get_child(1) == m1_card, "resgate atualiza no lugar")
	check(hud._missions_button.badge == 0, "selo some depois do resgate")
	hud._modal.close()

	GameState.achievements = [{"id": "first_business", "title": "Primeiro negócio",
		"description": "Construa seu primeiro negócio", "rewardGems": 1, "progress": "1", "target": "1",
		"unlocked": true, "claimed": false}]
	hud.open_profile_menu()
	check(hud._reward_cards["first_business"].button.text == "Resgatar", "conquista alcançada mostra Resgatar")
	check(GameState.claimable_achievements() == 1, "conquistas para resgatar contadas")
	hud._modal.close()
	hud.queue_free()
	GameState.state = {}
	GameState.loaded = false
	return true


func _integration_test() -> void:
	print("Integração com a API (%s)" % Api.base_url)
	Api.session_path = "user://test_session.cfg"
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Api.session_path))

	check(await GameState.boot(), "boot cria convidado e carrega estado")
	check(GameState.coins() == "100", "saldo inicial 100")
	check(not GameState.tutorial_completed(), "conta nova começa com tutorial pendente")
	check(GameState.businesses().size() == 10, "10 negócios no catálogo")
	check(not await GameState.purchase("pipoca"), "pipoca recusada sem saldo")
	check(await GameState.purchase("agua"), "compra do carrinho de água")
	check(GameState.coins() == "0", "saldo após compra")
	check(GameState.business("agua").owned, "água marcada como comprada")
	check(not await GameState.collect("agua"), "coleta antes do ciclo recusada")

	# Falha de rede e retomada (prompt mestre, Etapa 2).
	var real_url := Api.base_url
	Api.base_url = "http://127.0.0.1:9/api/v1"
	await GameState.refresh()
	check(not GameState.online, "sem servidor: jogo percebe que está offline")
	Api.base_url = real_url
	await GameState.refresh()
	check(GameState.online, "servidor de volta: jogo reconecta")
	check(not await GameState.hire_manager("agua"), "ajudante recusado sem saldo")
	await GameState.refresh_missions()
	check(GameState.missions.get("missions", []).size() == 3, "servidor entrega 3 missões do dia")
	await GameState.refresh_achievements()
	check(GameState.achievements.size() >= 10, "servidor entrega as conquistas")
	var lb := await Api.leaderboard()
	check(lb.ok and lb.data.has("entries"), "ranking semanal responde")

	# Mesma conta é retomada com as credenciais salvas.
	var player_id: String = GameState.state.player.id
	Api._token = ""
	check(await GameState.boot(), "reconexão com credenciais salvas")
	check(GameState.state.player.id == player_id, "mesma conta após reconexão")

	var main: Node = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await get_tree().create_timer(1.0).timeout
	var coins_label: Label = main.get_node("UI/HUD")._coins_label
	check(coins_label.text == "0", "cena principal mostra saldo do servidor")

	# Regressão: fechar o painel e depois coletar pela moeda não pode reabrir o painel.
	var hud: Control = main.get_node("UI/HUD")
	var praia: Node2D = main.districts["praia"]
	praia.select("agua")
	check(hud._sheet.visible, "tocar no negócio abre o painel")
	hud.close_sheet()
	check(not hud._sheet.visible and hud.slug == "", "fechar o painel limpa a seleção")
	check(not praia.lots["agua"].selected, "fechar o painel tira o destaque do lote")
	GameState._apply_state(GameState.state)  # o que acontece após uma coleta
	check(not hud._sheet.visible, "atualização após coleta não reabre o painel")
	praia.select("agua")
	hud.open_build_menu()
	GameState._apply_state(GameState.state)
	check(not hud._sheet.visible, "abrir Construir fecha o painel de vez")
	hud._modal.close()
	main.queue_free()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Api.session_path))
	_sections_done += 1
