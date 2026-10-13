## Testes do cliente. Rodar:
##   godot --headless --path game res://tests/test_runner.tscn
## Com a API local no ar, adicione IMPERIO_TEST_API=1 para o teste de integração.
extends Node

const Fmt := preload("res://scripts/fmt.gd")
const Layout := preload("res://scripts/layout.gd")

var _failures := 0
var _checks := 0
var _sections_done := 0


func _ready() -> void:
	var expected_sections := 1
	_unit_tests()
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
	check(Fmt.rate(12.0) == "+12/s", "renda inteira")
	check(Fmt.rate(2.5) == "+2,5/s", "renda com decimal")
	check(Fmt.rate(1250.4) == "+1.250/s", "renda grande")

	check(Layout.visual_tier(1) == 1 and Layout.visual_tier(9) == 1, "arte nível 1 (1–9)")
	check(Layout.visual_tier(10) == 2 and Layout.visual_tier(24) == 2, "arte nível 2 (10–24)")
	check(Layout.visual_tier(25) == 3 and Layout.visual_tier(100) == 3, "arte nível 3 (25+)")
	check(Layout.ISLAND_LOTS.size() == 4, "4 lotes na ilha")
	var all_art := true
	for slug in Layout.ISLAND_LOTS:
		for level in [1, 10, 25]:
			all_art = all_art and ResourceLoader.exists(Layout.art_path(slug, level))
	check(all_art, "arte dos 3 níveis existe para os 4 negócios da ilha")
	check(Layout.art_path("shopping", 1) == "", "negócio da cidade ainda sem arte")
	var lots_apart := true
	var points: Array = Layout.ISLAND_LOTS.values()
	for i in points.size():
		for j in range(i + 1, points.size()):
			lots_apart = lots_apart and points[i].distance_to(points[j]) > 180
	check(lots_apart, "lotes afastados entre si")
	var ui_ok := true
	for name in ["icon_build", "icon_shop", "icon_map", "icon_profile", "icon_coin",
			"icon_settings", "icon_help", "lot_lock", "char_vendor"] + Layout.WALKERS:
		ui_ok = ui_ok and ResourceLoader.exists("res://assets/optimized/%s.png" % name)
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
	_sections_done += 1


func _integration_test() -> void:
	print("Integração com a API (%s)" % Api.base_url)
	Api.session_path = "user://test_session.cfg"
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Api.session_path))

	check(await GameState.boot(), "boot cria convidado e carrega estado")
	check(GameState.coins() == "100", "saldo inicial 100")
	check(GameState.businesses().size() == 10, "10 negócios no catálogo")
	check(not await GameState.purchase("pipoca"), "pipoca recusada sem saldo")
	check(await GameState.purchase("agua"), "compra do carrinho de água")
	check(GameState.coins() == "0", "saldo após compra")
	check(GameState.business("agua").owned, "água marcada como comprada")
	check(not await GameState.collect("agua"), "coleta antes do ciclo recusada")

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
	main.queue_free()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Api.session_path))
	_sections_done += 1
