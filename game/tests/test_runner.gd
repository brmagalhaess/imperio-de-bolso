## Testes do cliente. Rodar:
##   godot --headless --path game res://tests/test_runner.tscn
## Com a API local no ar, adicione IMPERIO_TEST_API=1 para o teste de integração.
extends Node

const Fmt := preload("res://scripts/fmt.gd")
const Layout := preload("res://scripts/layout.gd")
const Tutorial := preload("res://scripts/tutorial.gd")
const Hud := preload("res://scripts/hud.gd")
const MockAd := preload("res://scripts/mock_ad.gd")

var _failures := 0
var _checks := 0
var _sections_done := 0


func _ready() -> void:
	var expected_sections := 1
	# Os testes conferem textos em pt-BR, qualquer que seja o idioma da máquina (CI em inglês).
	TranslationServer.set_locale("pt_BR")
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
	check(Fmt.coins("9999") == "9.999" and Fmt.coins("10000") == "10K", "coins inteiro até 9.999")
	check(Fmt.coins("12345") == "12,3K" and Fmt.coins("123456") == "123K", "coins abreviado em K")
	check(Fmt.coins("8000000") == "8M" and Fmt.coins("174183741") == "174M", "coins abreviado em M")
	check(Fmt.coins("1999999999") == "1,99B", "coins trunca (não arredonda para cima)")
	check(Fmt.coins("7890000000000") == "7,89T", "coins abreviado em T")
	check(Fmt.coins("123456789012345678") == "123aa" and Fmt.coins("1" + "0".repeat(18)) == "1ab",
			"coins além de float vira aa, ab")
	check(Fmt.suffix(30) == "az" and Fmt.suffix(31) == "ba", "sufixos seguem az → ba")
	check(Fmt.coins("-1500") == "-1.500" and Fmt.coins("-25000") == "-25K", "coins negativo")
	check(Fmt.full("8000000") == "8.000.000", "número inteiro com milhar")
	check(Fmt.duration(10) == "10 s", "duração 10 s")
	check(Fmt.duration(90) == "1 min 30 s", "duração 90 s")
	check(Fmt.duration(3700) == "1 h 01 min", "duração 3700 s")
	check(Fmt.duration(480_000) == "5 d 13 h", "duração em dias")
	check(Fmt.rate(12.0) == "+12/s", "renda inteira")
	check(Fmt.rate(2.5) == "+2,5/s", "renda com decimal")
	check(Fmt.rate(1250.4) == "+1.250/s" and Fmt.rate(18302.0) == "+18,3K/s", "renda grande")

	check(Layout.visual_tier(1) == 1 and Layout.visual_tier(9) == 1, "arte nível 1 (1–9)")
	check(Layout.visual_tier(10) == 2 and Layout.visual_tier(24) == 2, "arte nível 2 (10–24)")
	check(Layout.visual_tier(25) == 3 and Layout.visual_tier(49) == 3, "arte nível 3 (25–49)")
	check(Layout.visual_tier(50) == 4 and Layout.visual_tier(99) == 4, "arte nível 4 (50–99)")
	check(Layout.visual_tier(100) == 5, "arte nível 5 (100)")
	var all_art := true
	for slug in Layout.BUSINESS_ART:
		for lv in [1, 10, 25, 50, 100]:
			all_art = all_art and ResourceLoader.exists(Layout.art_path(slug, lv))
	check(all_art, "todo negócio tem arte em qualquer nível (usa a evolução anterior se faltar)")
	check(Layout.art_path("agua", 100).ends_with("water_cart_lv5.png")
			and Layout.art_path("porto_espacial", 50).ends_with("porto_espacial_lv4.png"), "evoluções 4 e 5 nos níveis 50 e 100")
	var praia: Dictionary = Layout.DISTRICTS.praia.lots
	var cidade: Dictionary = Layout.DISTRICTS.cidade.lots
	check(praia.size() == 4 and cidade.size() == 9, "4 lotes na praia e 9 na cidade (ilha de expansão)")
	check(Layout.district_of("agua") == "praia" and Layout.district_of("shopping") == "cidade",
			"distrito de cada negócio")
	check(Layout.BUSINESS_ART.size() == 67, "arte cadastrada para os 67 negócios")
	var nine := true
	for id in Layout.DISTRICT_ORDER.slice(1):
		nine = nine and Layout.DISTRICTS[id].lots.size() == 9 and Layout.DISTRICTS[id].get("pan", false)
	check(nine, "mapas 2–8 com 9 lotes e câmera de arrastar")
	var helpers_art := true
	for slug in Layout.BUSINESS_ART:
		helpers_art = helpers_art and ResourceLoader.exists("res://assets/optimized/%s.png" % Layout.helper_texture_name(slug))
	check(helpers_art, "retrato do ajudante existe para os 67 negócios")
	var lots_total := 0
	for id in Layout.DISTRICT_ORDER:
		lots_total += Layout.DISTRICTS[id].lots.size()
	check(Layout.DISTRICT_ORDER.size() == 8 and lots_total == 67, "8 mapas com um lote para cada um dos 67 negócios")
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
	check(await _store_tests() == true, "seção loja executou até o fim")
	check(await _audio_tests() == true, "seção áudio executou até o fim")
	check(await _trail_tests() == true, "seção trilha de mapas executou até o fim")
	check(await _fast_collect_tests() == true, "seção coleta rápida executou até o fim")
	check(await _i18n_tests() == true, "seção idiomas executou até o fim")
	check(await _live_tests() == true, "seção auto-coleta ao vivo executou até o fim")
	check(await _growth_tests() == true, "seção velocidade e retenção executou até o fim")
	_sections_done += 1


func _biz(slug: String, owned: bool, level := 1, managed := false, district := "praia") -> Dictionary:
	return {"slug": slug, "name": slug, "owned": owned, "level": level if owned else 0,
		"managed": managed, "district": district, "cost": "100", "profitPerCycle": "10",
		"cycleSeconds": 10, "managerCost": "150", "nextUpgradeCost": "115",
		"cycleStartedAt": null, "secondsRemaining": 0, "ready": false}


## Coleta rápida pela moeda: some e soma na hora, sem esperar o servidor.
func _fast_collect_tests() -> bool:
	var b := _biz("agua", true)
	b.cycleStartedAt = "2026-01-01T00:00:00.000Z"
	b.secondsRemaining = 0
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "5", "gems": "0"}, "businesses": [b]})
	var got := []
	var on_collected := func(items): got.append_array(items)
	GameState.collected.connect(on_collected)
	var real_url: String = Api.base_url
	Api.base_url = "http://127.0.0.1:9/api/v1"  # sem servidor: só o efeito imediato importa aqui
	GameState.collect_fast("agua")  # sem await: verifica o que acontece já no toque
	check(not GameState.is_ready(GameState.business("agua")), "coleta rápida: a moeda some no toque")
	check(GameState.coins() == "15" and got.size() == 1 and got[0].amount == "10",
			"coleta rápida: ganho e saldo aparecem na hora")
	GameState.collect_fast("agua")
	check(got.size() == 1, "coleta rápida: tocar de novo não coleta duas vezes")
	GameState.collected.disconnect(on_collected)
	while GameState._collecting.has("agua"):
		await get_tree().process_frame

	# Compra, melhoria e ajudante também respondem no toque (mesmas contas do servidor).
	var water := _biz("agua", false)
	water.cost = "100"
	water.profitPerCycle = "10"
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "1000", "gems": "0"},
		"businesses": [water], "districts": [{"id": "praia", "unlocked": true, "requires": null}]})
	check(await GameState.purchase("agua") and GameState.business("agua").owned and GameState.coins() == "900",
			"resposta na hora: compra aparece e desconta no toque")
	check(str(GameState.business("agua").nextUpgradeCost) == "115", "previsão: melhoria do nível 2 custa 115 (= servidor)")
	check(await GameState.upgrade("agua") and int(GameState.business("agua").level) == 2 and GameState.coins() == "785",
			"resposta na hora: melhoria sobe o nível no toque")
	check(str(GameState.business("agua").profitPerCycle) == "11" and str(GameState.business("agua").nextUpgradeCost) == "132",
			"previsão: lucro 11 e próxima melhoria 132 no nível 2 (= servidor)")
	check(await GameState.hire_manager("agua") and GameState.business("agua").managed and GameState.coins() == "635",
			"resposta na hora: ajudante contratado no toque")
	await GameState.settled()
	Api.base_url = real_url
	GameState.state = {}
	GameState.loaded = false
	return true


## Auto-coleta ao vivo, respostas velhas descartadas e resgates na hora (pedidos do titular).
func _live_tests() -> bool:
	var real_url: String = Api.base_url
	Api.base_url = "http://127.0.0.1:9/api/v1"
	GameState.current_district = "praia"
	var b := _biz("agua", true, 1, true)
	b.automatic = true
	b.cycleStartedAt = "2026-01-01T00:00:00.000Z"
	b.secondsRemaining = 0.05
	b.pendingAmount = "20"
	GameState._apply_state({"player": {"tutorialCompleted": true, "autoCollect": true},
		"wallet": {"coins": "100", "gems": "3"}, "businesses": [b]})
	var got := []
	var on_collected := func(items): got.append_array(items)
	GameState.collected.connect(on_collected)
	check(not GameState.is_ready(GameState.business("agua")), "ao vivo: com auto-coleta não aparece moeda para tocar")
	check(GameState.coins() == "120", "ao vivo: saldo já conta o que o ajudante produziu")
	await get_tree().create_timer(0.15).timeout
	await get_tree().process_frame
	check(got.size() == 1 and got[0].amount == "10" and GameState.coins() == "130",
			"ao vivo: ciclo terminou → +lucro aparece uma vez e o saldo anda")
	await get_tree().process_frame
	check(got.size() == 1, "ao vivo: o mesmo ciclo não aparece duas vezes")
	check(GameState.seconds_remaining(GameState.business("agua")) > 9.0,
			"ao vivo: a barra recomeça sozinha (próximo ciclo)")
	GameState.collected.disconnect(on_collected)

	# Resposta de fundo pedida antes de uma melhoria chega velha: não desfaz a melhoria.
	var old_state := {"player": {"tutorialCompleted": true, "autoCollect": true},
		"wallet": {"coins": "100", "gems": "3"}, "businesses": [_biz("agua", true, 1, true)]}
	var rev: int = GameState._local_rev
	GameState._local_rev += 1  # (uma melhoria no toque)
	GameState._apply_background(old_state, rev)
	check(int(GameState.business("agua").get("level", 0)) != 1 or GameState.coins() != "100",
			"resposta velha da presença não desfaz o que foi feito no toque")

	# Missões e conquistas: resgate na hora.
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "0", "gems": "0"}, "businesses": []})
	GameState.missions = {"missions": [{"id": "m1", "completed": true, "claimed": false, "rewardCoins": "50", "rewardGems": 1}]}
	GameState.achievements = [{"id": "a1", "unlocked": true, "claimed": false, "rewardGems": 5}]
	GameState.claim_mission("m1")
	check(GameState.missions.missions[0].claimed and GameState.coins() == "50" and GameState.gems() == "1",
			"missão: prêmio entra no toque")
	GameState.claim_achievement("a1")
	check(GameState.achievements[0].claimed and GameState.gems() == "6", "conquista: diamantes entram no toque")
	await GameState.settled()
	Api.base_url = real_url
	GameState.state = {}
	GameState.missions = {}
	GameState.achievements = []
	GameState.loaded = false
	return true


## Aceleradores (ADR 0013) e retenção (ADR 0014) do lado do jogo.
func _growth_tests() -> bool:
	var real_url: String = Api.base_url
	Api.base_url = "http://127.0.0.1:9/api/v1"
	var b := _biz("agua", true, 9)
	b.cost = "100"
	b.baseCycleSeconds = 10
	b.speedPercent = 100
	b.nextUpgradeCost = "100"
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "100000", "gems": "50"},
		"businesses": [b], "districts": [{"id": "praia", "unlocked": true, "requires": null}],
		"serverTime": "2026-01-01T12:00:00.000Z"})
	GameState.upgrade("agua")
	var w := GameState.business("agua")
	check(int(w.level) == 10 and int(w.speedPercent) == 150 and is_equal_approx(float(w.cycleSeconds), 10.0 / 1.5),
			"velocidade: marco do nível 10 deixa o negócio 50% mais rápido na hora")
	GameState.hire_manager("agua")
	check(int(GameState.business("agua").speedPercent) == 175, "velocidade: ajudante soma +25%")
	await GameState.settled()

	GameState._apply_state({"player": {"tutorialCompleted": true, "turboUntil": "2026-01-01T12:30:00.000Z"},
		"wallet": {"coins": "0", "gems": "0"}, "businesses": [], "serverTime": "2026-01-01T12:00:00.000Z"})
	var hud: Control = Hud.new()
	add_child(hud)
	await get_tree().process_frame
	await get_tree().process_frame  # (o sinal vem antes do _process do quadro)
	check(hud._status_turbo.get_parent().visible and hud._status_turbo.text.contains("min")
			and not hud._status_double.get_parent().visible,
			"Turbo ativo vira ícone na coluna direita com o tempo que falta (Dobro inativo some)")

	GameState.daily = {"day": 2, "claimedToday": false, "rewards": [
		{"day": 1, "coins": "200", "gems": 0, "turboMinutes": 0},
		{"day": 2, "coins": null, "gems": 5, "turboMinutes": 0}]}
	GameState.daily_changed.emit()
	check(hud._daily_button.badge == 1, "prêmio diário esperando: selo no botão Diário")
	GameState.claim_daily()
	check(GameState.daily.claimedToday and GameState.gems() == "5" and hud._daily_button.badge == 0,
			"prêmio diário: diamantes entram no toque e o selo some")
	GameState.podium = [{"week": "2025-12-29", "kind": "semana", "rank": 1, "league": null, "gems": 100}]
	hud.open_podium_reward(GameState.podium[0])
	await get_tree().process_frame
	var podium_texts: Array = hud._modal._list.find_children("*", "Label", true, false).map(func(l): return l.text)
	check(podium_texts.has("1º lugar") and podium_texts.any(func(t): return t.contains("ranking da semana")),
			"pódio: aviso de 1º lugar com o prêmio")
	GameState.claim_podium("2025-12-29", "semana")
	check(GameState.podium.is_empty() and GameState.gems() == "105", "pódio: diamantes entram no toque")
	# Ranking: arrastar a partir de um jogador rola a lista; só soltar sem mover abre as opções.
	var opened := [0]
	hud._modal.open("teste")
	hud._modal.add_rank_row(4, "Outro", "10", false, func(): opened[0] += 1)
	var row: Control = hud._modal._list.get_child(hud._modal._list.get_child_count() - 1)
	var ev := func(pressed: bool, pos: Vector2):
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_LEFT
		e.pressed = pressed
		e.global_position = pos
		row.gui_input.emit(e)
	var move := InputEventMouseMotion.new()
	move.global_position = Vector2(100, 160)
	ev.call(true, Vector2(100, 100))
	row.gui_input.emit(move)
	ev.call(false, Vector2(100, 160))
	check(opened[0] == 0, "ranking: arrastar sobre um jogador não abre denunciar/ocultar")
	ev.call(true, Vector2(100, 100))
	ev.call(false, Vector2(102, 101))
	check(opened[0] == 1, "ranking: tocar e soltar no jogador abre as opções")
	hud._modal.close()

	var items: Array = hud._prize_items([{"gems": 300, "bonusKind": "turbo", "bonusHours": 6},
		{"gems": 180, "bonusKind": "auto", "bonusHours": 48}, {"gems": 100, "bonusKind": null, "bonusHours": 0}])
	check(items[0].gems == 300 and items[0].extra == "+ Turbo 6 h" and items[1].extra == "+ Auto-coleta 2 dias"
			and items[2].extra == "", "ranking mostra os prêmios do pódio com o bônus da semana")
	GameState.weekend = {"active": true, "completed": true, "claimed": false, "prizeGems": 20}
	GameState.event_changed.emit()
	check(hud._event_button.visible and hud._event_button.badge == 1, "evento ativo: botão aparece com selo da meta batida")
	await GameState.settled()
	hud.queue_free()
	Api.base_url = real_url
	GameState.state = {}
	GameState.daily = {}
	GameState.weekend = {}
	GameState.podium = []
	GameState.loaded = false
	return true


## Trilha de mapas (pedido do titular): 4 mapas + "Em breve"; bloqueados sob nuvens.
func _trail_tests() -> bool:
	var Trail := load("res://scripts/map_trail.gd")
	var trail: Control = Trail.new()
	add_child(trail)
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "0", "gems": "0"},
		"businesses": [_biz("agua", true), _biz("mercadinho", false, 1, false, "cidade")],
		"districts": [{"id": "praia", "unlocked": true}, {"id": "cidade", "unlocked": true},
			{"id": "porto", "unlocked": false}, {"id": "centro", "unlocked": false}]})
	await trail.open("praia")
	var ids: Array = trail._cards.map(func(c): return c.get_meta("district"))
	check(ids == Layout.DISTRICT_ORDER + ["em_breve"] and ids.size() == 9, "trilha: 8 mapas em ordem + Em breve no fim")
	check(trail._nodes[0].y > trail._nodes[4].y, "trilha: primeiro mapa embaixo, Em breve em cima")
	var texts := func(card: Control) -> String:
		return " ".join(card.find_children("*", "Label", true, false).map(func(l): return l.text))
	check(texts.call(trail._cards[2]).contains("???") and texts.call(trail._cards[2]).contains("Complete a cidade"),
			"trilha: mapa bloqueado escondido (nome oculto, diz o que falta)")
	check(texts.call(trail._cards[0]).contains("Você está aqui"), "trilha: marca o mapa atual")
	var chosen := []
	trail.district_chosen.connect(func(id): chosen.append(id))
	var go: Array = trail._cards[1].find_children("*", "Button", true, false).filter(func(b): return b.text == "Ir")
	go[0].pressed.emit()
	check(chosen == ["cidade"] and not trail.visible, "trilha: Ir leva ao mapa e fecha")
	trail.queue_free()
	GameState.state = {}
	return true


## Sons e música (pedido do titular): efeitos e música desligáveis, escolha salva no aparelho.
func _i18n_tests() -> bool:
	var real_path: String = Lang.settings_path
	Lang.settings_path = "user://test_settings.cfg"
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Lang.settings_path))
	check(Lang.detect("pt") == "pt_BR" and Lang.detect("es") == "es" and Lang.detect("en") == "en"
			and Lang.detect("fr") == "en", "idiomas: automático segue o aparelho (outros → inglês)")

	Lang.set_choice("en")
	check(TranslationServer.get_locale().begins_with("en"), "idiomas: escolher inglês")
	check(tr("Loja") == "Shop" and tr("Carrinho de Água") == "Water Cart", "idiomas: textos e negócios em inglês")
	check(Layout.title("praia") == "Beach Island" and Layout.short_title("porto") == "the harbor",
			"idiomas: nomes dos mapas traduzidos")
	check(GameState.message_for("INSUFFICIENT_FUNDS") == "Not enough coins.", "idiomas: erros do servidor traduzidos")
	check(tr("Escolha com cuidado: você só pode trocar de nome uma vez.\nDe 3 a 20 caracteres. O nome aparece no ranking.")
			.begins_with("Choose carefully"), "idiomas: texto com quebra de linha traduzido")
	check(Fmt.full("1234567") == "1,234,567" and Fmt.coins("1234567") == "1.23M" and Fmt.rate(2.5) == "+2.5/s",
			"idiomas: números no padrão inglês")
	var mission := {"title": "Fature 1.000 moedas", "titleTemplate": "Fature {n} moedas", "target": "1000"}
	check(Hud.mission_title(mission) == "Earn 1,000 coins", "idiomas: missão traduzida com o alvo formatado")
	check(Hud.mission_title({"title": "Fature 1.000 moedas", "target": "1000"}) == "Fature 1.000 moedas",
			"idiomas: servidor antigo sem modelo mostra o título pronto")

	Lang.set_choice("es")
	check(tr("Vender o império") == "Vender el imperio" and Fmt.full("1234567") == "1.234.567",
			"idiomas: espanhol com milhar em ponto")
	Lang.choice = "pt_BR"
	Lang.load_settings()
	check(Lang.choice == "es", "idiomas: escolha fica salva no aparelho")

	var hud: Control = Hud.new()
	add_child(hud)
	hud.open_settings_menu()
	await get_tree().process_frame
	var labels: Array = hud._modal._list.find_children("*", "Label", true, false).map(func(l): return l.text)
	check(labels.has("Idioma") and labels.has("Español"), "idiomas: Configurações mostra o idioma atual")
	hud.open_language_menu()
	await get_tree().process_frame
	var names: Array = hud._modal._list.find_children("*", "Button", true, false).map(func(b): return b.text)
	check(names.has("✓  Español") and names.has("English") and names.has("Português"),
			"idiomas: lista de idiomas marca o escolhido")
	hud.queue_free()

	Lang.set_choice("auto")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Lang.settings_path))
	Lang.settings_path = real_path
	TranslationServer.set_locale("pt_BR")
	check(tr("Loja") == "Loja" and Fmt.coins("1000") == "1.000", "idiomas: português volta ao normal")
	return true


func _audio_tests() -> bool:
	var real_path: String = Audio.settings_path
	Audio.settings_path = "user://test_settings.cfg"
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Audio.settings_path))
	Audio.music_on = true
	Audio.sfx_on = true
	Audio.last_sfx = ""
	Audio.play("buy")
	check(Audio.last_sfx == "buy", "áudio: efeito toca com efeitos ligados")
	Audio.play_music("praia")
	await get_tree().process_frame
	check(Audio.current_track() == "praia" and Audio.is_music_playing(), "áudio: música do mapa toca")

	var hud: Control = Hud.new()
	add_child(hud)
	hud.open_settings_menu()
	await get_tree().process_frame
	var toggles: Array = hud._modal._list.find_children("*", "Button", true, false).filter(
			func(b): return b.text == "Ligado" or b.text == "Desligado")
	check(toggles.size() == 2 and toggles[0].text == "Ligado", "configurações: música e efeitos ligados")
	toggles[0].pressed.emit()
	toggles[1].pressed.emit()
	check(not Audio.music_on and not Audio.is_music_playing() and toggles[0].text == "Desligado",
			"configurações: desligar a música para na hora")
	check(hud._modal.visible, "configurações: liga/desliga não fecha a janela")
	Audio.last_sfx = ""
	Audio.play("coin")
	check(Audio.last_sfx == "", "áudio: efeitos desligados não tocam")
	Audio.music_on = true
	Audio.sfx_on = true
	Audio.load_settings()
	check(not Audio.music_on and not Audio.sfx_on, "áudio: escolha fica salva no aparelho")
	Audio.play_music("cidade")
	check(not Audio.is_music_playing(), "áudio: trocar de mapa com música desligada não toca")
	Audio.set_music_on(true)
	await get_tree().process_frame
	check(Audio.is_music_playing() and Audio.current_track() == "cidade", "áudio: religar volta a faixa do mapa atual")
	Audio.set_sfx_on(true)
	hud.queue_free()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Audio.settings_path))
	Audio.settings_path = real_path
	Audio.load_settings()
	return true


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

	# Seta: comprado o carrinho, ela sai do lote (pedido do titular) e só volta quando há o que fazer.
	var arrow := func(coins: String, b: Dictionary) -> String:
		GameState.state = {"player": {"tutorialCompleted": true}, "wallet": {"coins": coins}, "businesses": [b]}
		GameState._received_at_ms = Time.get_ticks_msec()
		return t.arrow_kind()
	check(arrow.call("100", _biz("agua", false)) == "lot", "seta: no carrinho para comprar")
	var producing := _biz("agua", true)
	producing.cycleStartedAt = "2026-01-01T00:00:00.000Z"
	producing.secondsRemaining = 8
	check(arrow.call("0", producing) == "", "seta: some depois da compra enquanto produz")
	var ready := producing.duplicate()
	ready.secondsRemaining = 0
	check(arrow.call("0", ready) == "bubble", "seta: aponta a moeda quando fica pronta")
	check(arrow.call("30", _biz("agua", true)) == "", "seta: sem saldo para melhorar, sem seta")
	check(arrow.call("115", _biz("agua", true)) == "lot", "seta: com saldo, aponta para melhorar")
	check(arrow.call("0", _biz("agua", true, 2)) == "helpers", "seta: último passo aponta o botão Ajudantes")
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


func _store_tests() -> bool:
	# Anúncio de teste: só conta como assistido se for até o fim.
	var ad: ColorRect = MockAd.new()
	add_child(ad)
	var closed := [null]
	(func(): closed[0] = await ad.play()).call()
	ad._end(false)
	check(closed[0] == false, "anúncio fechado antes do fim não paga")
	var watched := [null]
	(func(): watched[0] = await ad.play()).call()
	ad._process(6.0)
	check(watched[0] == true, "anúncio assistido até o fim conta")
	ad.queue_free()

	# Loja: cartões de diamantes ficam habilitados/esmaecidos sem recriar a lista.
	var hud: Control = Hud.new()
	add_child(hud)
	GameState.catalog = {"sandbox": true, "purchasesEnabled": true, "adsEnabled": true, "district": "praia", "entitlements": {"vipDailyGems": 5}, "items": [
		{"id": "ad_boost", "kind": "ad", "title": "Coleta antecipada de 15 min", "estimateCoins": "900",
			"usedToday": 5, "dailyLimit": 5},
		{"id": "auto_collect_24h", "kind": "auto_collect", "title": "Auto-coleta por 24 horas", "costGems": "20"},
		{"id": "auto_collect_7d", "kind": "auto_collect", "title": "Auto-coleta por 7 dias", "costGems": "100"},
		{"id": "boost_1h", "kind": "boost", "title": "Turbo 1h", "costGems": "10"},
		{"id": "boost_4h", "kind": "boost", "title": "Turbo 4h", "costGems": "30"},
		{"id": "gems_50", "kind": "iap", "title": "Punhado", "priceBRL": "4,90", "gems": "50",
			"productId": "br.com.imperiodebolso.gems_50"},
		{"id": "vip_monthly", "kind": "subscription", "title": "Passe VIP", "priceBRL": "14,90",
			"benefits": ["Auto-coleta em todos os mapas"], "productId": "br.com.imperiodebolso.vip_monthly"}]}
	# Estimativa calculada do estado (o catálogo ficava velho e mostrava 0): 100 por ciclo de 100 s.
	GameState.current_district = "praia"
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "0", "gems": "0"},
		"businesses": [{"slug": "agua", "district": "praia", "owned": true, "level": 1,
			"profitPerCycle": "100", "cycleSeconds": 100.0, "cycleStartedAt": null}]})
	check(GameState.boost_estimate(3600) == "3600", "coleta antecipada de 1 h = ciclos que cabem × lucro")
	await hud.open_store_menu()
	var buttons := []
	for h in hud._modal._store_cards:
		buttons.append(h.button)
	var ad_button: Button = buttons[0]
	var ad_sub: String = hud._modal._store_cards[0].sub.text
	check(ad_button.text == "5/5" and ad_button.disabled and ad_sub.contains("Hoje: 5/5"),
			"coleta antecipada grátis mostra o uso de hoje e trava no limite")
	check(ad_sub.contains("900"), "coleta antecipada mostra a estimativa de moedas")
	var gem_button: Button = buttons[6]  # auto-coleta 24h (depois de coleta antecipada e Turbo)
	check(gem_button.text == "20" and gem_button.disabled, "sem diamantes: botão esmaecido com o preço")
	GameState._apply_state({"player": {"tutorialCompleted": true}, "wallet": {"coins": "0", "gems": "25"},
		"businesses": []})
	check(not gem_button.disabled and hud._modal._store_cards[6].button == gem_button,
			"com diamantes: o mesmo botão habilita (sem recriar)")
	check(buttons[7].disabled, "item mais caro continua esmaecido")

	# Versão 1.0 (ADR 0018): sem dinheiro real e sem anúncios, esses itens nem aparecem.
	var full_count: int = hud._modal._store_cards.size()
	GameState.catalog.purchasesEnabled = false
	GameState.catalog.adsEnabled = false
	await hud.open_store_menu()
	await get_tree().process_frame  # cartões antigos saem da árvore (queue_free)
	var titles: Array = hud._modal._store_cards.map(func(h): return h.title.text)
	var actions: Array = hud._modal._list.find_children("*", "Button", true, false).map(func(b): return b.text)
	check(hud._modal._store_cards.size() == full_count - 6 and not titles.has("Passe VIP")
			and not actions.has("Restaurar compras") and not actions.has("Assistir"),
			"versão sem dinheiro real: some VIP, diamantes em R$, anúncio e restaurar compras")
	GameState.catalog.purchasesEnabled = true
	GameState.catalog.adsEnabled = true
	await hud.open_store_menu()

	# Rolagem por toque começando num item da Loja (pedido do titular).
	var ts: Node = hud._modal.touch_scroll
	ts.pass_through()
	var stoppers: Array = hud._modal._scroll.find_children("*", "Control", true, false).filter(
			func(c): return c.mouse_filter == Control.MOUSE_FILTER_STOP and not c is LineEdit)
	check(stoppers.is_empty(), "lista: cartões e botões repassam o arrasto para a rolagem")
	hud._modal._scroll.scroll_started.emit()
	var store_buttons: Array = hud._modal._scroll.find_children("*", "BaseButton", true, false)
	check(ts.muted and store_buttons.all(func(b): return b.button_mask == 0),
			"lista: enquanto rola, nenhum botão aceita o toque (não compra sem querer)")
	ts.unmute()
	check(store_buttons.all(func(b): return b.button_mask == MOUSE_BUTTON_MASK_LEFT),
			"lista: no próximo toque os botões voltam a funcionar")

	# Cada janela abre no topo, mesmo que a anterior estivesse rolada.
	hud._modal._scroll.scroll_vertical = 400
	hud.open_profile_menu()
	check(hud._modal._scroll.scroll_vertical == 0, "janela nova abre no topo")

	# Perfil: "Alterar nome" só aparece se ainda pode trocar.
	GameState._apply_state({"player": {"tutorialCompleted": true, "displayName": "Empreendedor 1",
		"canChangeName": true, "id": "0418f66f-4380-4ef4-a53c-74d1007c18a6"}, "wallet": {"coins": "0", "gems": "0"}, "businesses": []})
	hud.open_profile_menu()
	var profile_text: String = " ".join(hud._modal._list.find_children("*", "Label", true, false).map(func(l): return l.text))
	check(profile_text.contains("Código do jogador") and profile_text.contains("0418F66F"),
			"perfil mostra o código do jogador (suporte/exclusão)")
	var has_rename: bool = hud._modal._list.get_children().any(func(c): return c is Button and c.text.begins_with("Alterar nome"))
	check(has_rename, "perfil oferece trocar o nome uma vez")
	GameState.state.player.canChangeName = false
	hud.open_profile_menu()
	await get_tree().process_frame
	has_rename = hud._modal._list.get_children().any(func(c): return not c.is_queued_for_deletion() and c is Button and c.text.begins_with("Alterar nome"))
	check(not has_rename, "depois de trocar, a opção some")
	# Ranking: tocar em outro jogador abre denunciar/ocultar (diretriz 1.2 da App Store).
	hud.open_player_options({"playerId": "00000000-0000-4000-8000-000000000001", "displayName": "Fulano"})
	await get_tree().process_frame
	var opt_texts: Array = hud._modal._list.find_children("*", "Button", true, false).map(func(b): return b.text)
	check(opt_texts.has("Denunciar nome impróprio") and opt_texts.has("Ocultar este jogador"), "ranking: opções de denunciar e ocultar")
	GameState.hide_player("00000000-0000-4000-8000-000000000001")
	check(GameState.hidden_players().has("00000000-0000-4000-8000-000000000001"), "ranking: jogador oculto fica salvo no aparelho")
	hud._modal.close()
	# Prestígio no Perfil (ADR 0011): só oferece vender quando o servidor diz que dá.
	GameState.prestige = {"stars": 7, "bonusPercent": 14, "starsToGain": 3, "nextBonusPercent": 20,
		"requirementMet": true, "available": true}
	hud.open_profile_menu()
	await get_tree().process_frame
	var prof_texts: String = " ".join(hud._modal._list.find_children("*", "Label", true, false).map(func(l): return l.text))
	var sell_btn: Array = hud._modal._list.find_children("*", "Button", true, false).filter(func(b): return b.text.begins_with("Vender o império"))
	check(prof_texts.contains("⭐ 7 estrelas · lucro +14%") and sell_btn.size() == 1 and sell_btn[0].text.contains("+3"),
			"prestígio: perfil mostra estrelas, bônus e o botão de vender")
	GameState.prestige.available = false
	GameState.prestige.requirementMet = false
	GameState.prestige.merge({"totalBusinesses": 46, "ownedBusinesses": 46, "hiredHelpers": 30}, true)
	hud.open_profile_menu()
	await get_tree().process_frame
	prof_texts = " ".join(hud._modal._list.find_children("*", "Label", true, false).filter(func(l): return not l.is_queued_for_deletion()).map(func(l): return l.text))
	check(prof_texts.contains("Negócios 46/46 · Ajudantes 30/46"), "prestígio: mostra o progresso do império completo")
	sell_btn = hud._modal._list.find_children("*", "Button", true, false).filter(func(b): return not b.is_queued_for_deletion() and b.text.begins_with("Vender o império"))
	check(sell_btn.is_empty(), "prestígio: sem botão antes de completar o império")
	GameState.prestige = {}
	var live := func() -> Array: return hud._modal._list.get_children().filter(func(c): return not c.is_queued_for_deletion())
	var del_btn: Array = live.call().filter(func(c): return c is Button and c.text == "Excluir conta")
	check(del_btn.size() == 1, "perfil oferece excluir a conta (LGPD)")
	hud.open_delete_account_form()
	await get_tree().process_frame
	var form: Array = live.call()
	check(form.any(func(c): return c is LineEdit) and form.any(func(c): return c is Button and c.text == "Excluir para sempre"),
			"exclusão pede confirmação digitada")
	hud.queue_free()
	GameState.state = {}
	GameState.catalog = {}
	GameState.loaded = false
	return true


func _integration_test() -> void:
	print("Integração com a API (%s)" % Api.base_url)
	Api.session_path = "user://test_session.cfg"
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Api.session_path))

	check(await GameState.boot(), "boot cria convidado e carrega estado")
	check(GameState.coins() == "100", "saldo inicial 100")
	check(not GameState.tutorial_completed(), "conta nova começa com tutorial pendente")
	check(GameState.businesses().size() == 67, "67 negócios no catálogo (8 mapas)")
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
	await GameState.refresh_prestige()
	check(int(GameState.prestige.get("stars", -1)) == 0 and not GameState.prestige.get("available", true),
			"prestígio: conta nova sem estrelas e sem venda liberada")
	var early_sell := await Api.sell_empire()
	check(early_sell.error_code == "PRESTIGE_NOT_AVAILABLE", "prestígio: servidor recusa vender antes da cidade")
	var lb := await Api.leaderboard()
	check(lb.ok and lb.data.has("entries"), "ranking semanal responde")

	# Loja em modo de teste (nada é cobrado).
	await GameState.refresh_catalog()
	check(GameState.catalog.get("sandbox", false), "servidor local está em modo de teste")
	check(await GameState.buy_sandbox("br.com.imperiodebolso.gems_50"), "compra de teste de diamantes")
	check(GameState.gems() == "50", "diamantes creditados pelo servidor")
	var bought := await GameState.buy_with_gems("auto_collect_24h")
	check(not bought.is_empty() and GameState.state.player.autoCollect, "auto-coleta comprada com diamantes")
	check(GameState.state.player.canChangeName, "conta nova pode trocar de nome")
	check(not await GameState.change_name("P0rr4"), "nome ofensivo recusado pelo servidor")
	var new_name := "Teste %d" % (randi() % 100000)
	check(await GameState.change_name(new_name), "troca de nome aceita")
	check(GameState.state.player.displayName == new_name and not GameState.state.player.canChangeName,
			"nome novo e troca bloqueada")
	check(not await GameState.change_name("Outro Nome"), "segunda troca recusada")
	var ad := await Api.ad_start("ad_boost", "praia")
	check(ad.ok, "anúncio de bônus: sessão criada")
	var early := await Api.ad_claim(ad.data.sessionId)
	check(early.error_code == "AD_NOT_VERIFIED", "anúncio não confirmado não paga")
	await Api.ad_mock_complete(ad.data.sessionId)
	var coins_before := GameState.coins().to_int()
	var claim := await Api.ad_claim(ad.data.sessionId)
	check(claim.ok and claim.data.state.wallet.coins.to_int() == coins_before + claim.data.coins.to_int(),
			"anúncio confirmado paga uma vez")

	# Mesma conta é retomada com as credenciais salvas.
	var player_id: String = GameState.state.player.id
	Api._token = ""
	check(await GameState.boot(), "reconexão com credenciais salvas")
	check(GameState.state.player.id == player_id, "mesma conta após reconexão")

	var main: Node = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await get_tree().create_timer(1.0).timeout
	var coins_label: Label = main.get_node("UI/HUD")._coins_label
	check(coins_label.text == Fmt.coins(GameState.coins()), "cena principal mostra saldo do servidor")

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

	# Exclusão de conta (LGPD): servidor apaga, sessão do aparelho é esquecida, entra conta nova.
	var deleted := await Api.delete_account()
	check(deleted.ok and not FileAccess.file_exists(Api.session_path),
			"conta excluída e sessão do aparelho apagada")
	check(await GameState.boot(), "depois de excluir, o jogo entra com conta nova")
	check(GameState.state.player.id != player_id and GameState.coins() == "100", "conta nova começa do zero")
	await Api.delete_account()  # não deixa conta de teste no banco local
	DirAccess.remove_absolute(ProjectSettings.globalize_path(Api.session_path))
	_sections_done += 1
