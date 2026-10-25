## Interface no estilo do mockup B (docs/ADRs/0004-direcao-visual-v2.md): cartão do topo com
## avatar e saldo, renda por segundo, barra inferior Construir/Loja/Mapa/Perfil, painel do
## negócio selecionado, menus modais e telas de carregamento/erro. Textos via tr() para i18n.
extends Control

signal retry_requested
signal business_requested(slug: String)
signal district_requested(id: String)
## Painel do negócio fechado: o mundo tira o destaque do lote.
signal selection_cleared

const Fmt := preload("res://scripts/fmt.gd")
const Layout := preload("res://scripts/layout.gd")
const UiFont := preload("res://scripts/ui_font.gd")
const AppleAuth := preload("res://scripts/apple_auth.gd")
const GoogleAuth := preload("res://scripts/google_auth.gd")
const Style := preload("res://scripts/ui_style.gd")
const MenuModal := preload("res://scripts/menu_modal.gd")
const MapTrail := preload("res://scripts/map_trail.gd")
const Tutorial := preload("res://scripts/tutorial.gd")
const GlyphButton := preload("res://scripts/glyph_button.gd")
const MockAd := preload("res://scripts/mock_ad.gd")
const COIN_TEX := preload("res://assets/optimized/icon_coin.png")
const PURPLE := Color("9b7bff")
const PURPLE_DARK := Color("6a4fd1")
const BLUE := Color("2bb6e0")
const BLUE_DARK := Color("1f7fa8")

var slug := ""
var current_district := "praia":
	set(value):
		current_district = value
		if _district_label:
			_district_label.text = Layout.title(value)

var _coins_label: Label
var _rate_label: Label
var _district_label: Label
var _sheet: PanelContainer
var _title: Label
var _info: Label
var _progress: ProgressBar
var _action_button: Button
var _collect_button: Button
var _hire_button: Button
var _modal: Control
var tutorial: Control
## Tela de Mapas em trilha (mapas flutuando, bloqueados sob nuvens, "Em breve" no topo).
var map_trail: Control
## Botão Ajudantes da barra (alvo da seta no último passo do tutorial).
var _helpers_button: Control
## Cartões da tela de Ajudantes aberta (slug → identificador), atualizados no lugar.
var _helper_cards := {}
## Cartões de Missões/Conquistas abertos (id → identificador), atualizados no lugar.
var _reward_cards := {}
var _reward_kind := ""  # "missions" | "achievements" | ""
var _missions_button: Control
var _ranking_button: Control
var _daily_button: Control
var _event_button: Control
## Coluna direita dos pacotes promocionais (ADR 0024): no máximo 5 ícones.
var _offer_col: VBoxContainer
var _offers_box: VBoxContainer
const MAX_OFFERS := 5
## Turbo e Dobro de moedas ativos: ícones no topo da coluna direita (com o tempo restante).
var _status_turbo: Label
var _status_double: Label
var _ranking_tab := 0
var _gems_label: Label
var _mock_ad: ColorRect
var _gem_tex: Texture2D = GlyphButton.gem_texture()
var _toast: Label
var _toast_timer: Timer
var _offline_pill: PanelContainer
var _fader: ColorRect
var _overlay: ColorRect
var _overlay_label: Label
var _retry_button: Button


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = _build_theme()
	_build_top()
	_build_side_buttons()
	_build_offer_column()
	_build_bottom_bar()
	_build_sheet()
	tutorial = Tutorial.new()
	add_child(tutorial)
	_modal = MenuModal.new()
	add_child(_modal)
	map_trail = MapTrail.new()
	add_child(map_trail)
	map_trail.district_chosen.connect(func(id): district_requested.emit(id))
	map_trail.visibility_changed.connect(func(): Audio.set_ducked(map_trail.visible or _modal.visible))
	tutorial.blockers = [_sheet, _modal, map_trail]
	tutorial.helpers_target = func() -> Variant:
		if _helpers_button == null:
			return null
		var r := _helpers_button.get_global_rect()
		return Vector2(r.get_center().x, r.position.y)
	_mock_ad = MockAd.new()
	add_child(_mock_ad)
	# Janela abriu com um aviso na tela: o aviso desce para não cobrir o título.
	_modal.visibility_changed.connect(func():
		Audio.set_ducked(_modal.visible)
		if _toast and _toast.visible:
			show_toast(_toast.text))
	_build_toast()
	_build_offline_pill()
	_build_fader()
	_build_overlay()

	GameState.state_changed.connect(_refresh)
	GameState.busy_changed.connect(func(_b): _refresh())
	GameState.notice.connect(show_toast)
	GameState.offline_summary.connect(show_offline_summary)
	GameState.state_changed.connect(_sync_helper_cards)
	GameState.state_changed.connect(func(): _modal.refresh_store_cards())
	GameState.catalog_changed.connect(func():
		_modal.refresh_store_cards()
		_sync_offers())
	GameState.busy_changed.connect(func(_b): _modal.refresh_store_cards())
	GameState.missions_changed.connect(_sync_rewards)
	GameState.achievements_changed.connect(_sync_rewards)
	GameState.busy_changed.connect(func(_b): _sync_rewards())
	GameState.busy_changed.connect(func(_b): _sync_helper_cards())
	GameState.connection_changed.connect(func(online): _offline_pill.visible = not online)
	GameState.daily_changed.connect(_sync_side)
	GameState.event_changed.connect(_sync_side)
	GameState.missions_changed.connect(_sync_side)


func show_business(new_slug: String) -> void:
	slug = new_slug
	_refresh()


## Fecha o painel e esquece o negócio selecionado — senão a próxima atualização de estado
## (ex.: coletar pela moeda) reabriria o painel.
func close_sheet() -> void:
	if slug == "" and not _sheet.visible:
		return
	slug = ""
	_sheet.visible = false
	selection_cleared.emit()


## "Enquanto você estava fora…" — o servidor já creditou; a janela só mostra (docs §8).
func show_offline_summary(district: String, total: String, elapsed_seconds: int, capped: bool,
		cap_seconds: int) -> void:
	close_sheet()
	_helper_cards.clear()
	_reward_cards.clear()
	_reward_kind = ""
	_modal.open(tr("Bem-vindo de volta!"))
	var body := tr("Em %s fora da %s, seus ajudantes faturaram:") % [
		Fmt.duration(elapsed_seconds), Layout.title(district)]
	_modal.add_message(Layout.texture("char_vendor"), "+" + Fmt.coins(total), body)
	if capped:
		_modal.add_message(null, "", tr("Os ajudantes trabalham até %s fora de cada mapa. Volte antes para não perder nada!")
				% Fmt.duration(cap_seconds))
	if GameState.ads_enabled():
		_modal.add_action(tr("Assistir anúncio e dobrar"), func(): watch_ad("offline_double"), PURPLE, PURPLE_DARK)
	_modal.add_action(tr("Coletar"), func(): pass, Style.ORANGE, Style.ORANGE_DARK)


## Tela de Ajudantes do mapa atual: ver quem já trabalha e contratar (pedido do titular).
func open_helpers_menu() -> void:
	close_sheet()
	_helper_cards.clear()
	_reward_cards.clear()
	_reward_kind = ""
	GameState.track("screen_view", {"screen": "ajudantes"})
	_modal.open(tr("Ajudantes · %s") % Layout.title(current_district))
	var auto_text := tr("Auto-coleta neste mapa: ativa") if GameState.auto_collect() \
			else tr("Auto-coleta enquanto você joga neste mapa: em breve na Loja")
	_modal.add_message(null, "", tr("Ajudantes produzem sozinhos enquanto você está em outro mapa ou com o jogo fechado — até 4 horas por mapa.") + "\n" + tr("Cada ajudante deixa o negócio 25% mais rápido.") + "\n" + auto_text)
	for b in GameState.businesses():
		if Layout.district_of(b.slug) != current_district:
			continue
		var target: String = b.slug
		_helper_cards[target] = _modal.add_helper(b, _helper_state(b), func(): _hire_from_menu(target))


func _helper_state(b: Dictionary) -> String:
	return "hired" if b.get("managed", false) else ("buy" if b.owned else "locked")


## Estado/saldo mudou com a tela de Ajudantes aberta: atualiza os cartões sem recriar.
func _sync_helper_cards() -> void:
	if _helper_cards.is_empty() or not _modal.visible:
		return
	for slug in _helper_cards:
		var b := GameState.business(slug)
		if not b.is_empty():
			_modal.set_helper_state(_helper_cards[slug], b, _helper_state(b))


func _hire_from_menu(target: String) -> void:
	# Sem aviso flutuante aqui: ele cobria o texto da janela. O próprio cartão vira
	# "Contratado" e dá um pulinho de confirmação.
	if await GameState.hire_manager(target):
		_sync_helper_cards()
		var button: Button = _helper_cards.get(target, {}).get("button")
		if button:
			button.pivot_offset = button.size / 2
			button.scale = Vector2(1.15, 1.15)
			create_tween().tween_property(button, "scale", Vector2.ONE, 0.35) \
					.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	else:
		_sync_helper_cards()


func show_loading() -> void:
	_overlay.visible = true
	_overlay_label.text = tr("Abrindo a praia…")
	_retry_button.visible = false


func show_error(text: String) -> void:
	_overlay.visible = true
	_overlay_label.text = text
	_retry_button.visible = true


func hide_overlay() -> void:
	_overlay.visible = false


func show_toast(text: String) -> void:
	# Com janela aberta, o aviso vai para baixo (em cima ele cobria o título da janela).
	if _modal.visible:
		_toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
		_toast.offset_top = -260
		_toast.offset_bottom = -200
	else:
		_toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
		_toast.offset_top = 300
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.text = text
	_toast.visible = true
	_toast_timer.start(2.5)


## Escurece (true) ou clareia (false) a tela; usado na troca de distrito.
func fade(to_dark: bool) -> void:
	_fader.visible = true
	var tween := create_tween()
	tween.tween_property(_fader, "modulate:a", 1.0 if to_dark else 0.0, 0.22)
	await tween.finished
	_fader.visible = to_dark


func _process(_delta: float) -> void:
	if _sheet.visible and slug != "":
		_update_cycle(GameState.business(slug))
	_update_turbo_pill()


## "⚡ Turbo 2× · 43 min" enquanto o Turbo da Loja/prêmios estiver ativo (ADR 0013).
func _update_turbo_pill() -> void:
	if _status_turbo == null:
		return
	_set_status(_status_turbo, GameState.turbo_until() if GameState.loaded else null)
	_set_status(_status_double, GameState.double_until() if GameState.loaded else null)


## Mostra o ícone de status (Turbo/Dobro) só enquanto ativo, com o tempo restante embaixo.
func _set_status(label: Label, until: Variant) -> void:
	var left := 0.0
	if until != null:
		left = _iso_seconds(str(until)) - GameState.server_now()
	var row: Control = label.get_parent()
	row.visible = left > 0.0
	if left > 0.0:
		label.text = Fmt.duration(left)

func _refresh() -> void:
	if not GameState.loaded:
		return
	_coins_label.text = Fmt.coins(GameState.coins())
	_gems_label.text = Fmt.coins(GameState.gems())
	_rate_label.text = Fmt.rate(GameState.income_per_second())
	_district_label.text = Layout.title(current_district)

	var b := GameState.business(slug)
	_sheet.visible = not b.is_empty()
	if b.is_empty():
		return
	_title.text = tr(b.name)
	if b.owned:
		_info.text = tr("Nível %d · Lucro %s a cada %s") % [
			int(b.level), Fmt.coins(b.profitPerCycle), Fmt.duration(b.cycleSeconds)]
		var speed := int(b.get("speedPercent", 100))
		if speed > 100:
			_info.text += tr(" · Velocidade +%d%%") % (speed - 100)
		if b.get("automatic", false):
			_info.text += tr(" · Produzindo sozinho")
		elif b.get("managed", false):
			_info.text += tr(" · Ajudante vende quando você sai do mapa. Coleta automática aqui: Loja")
		if b.nextUpgradeCost == null:
			_action_button.text = tr("Nível máximo")
			_action_button.disabled = true
		else:
			_action_button.text = tr("Melhorar  %s") % Fmt.coins(b.nextUpgradeCost)
			_action_button.disabled = GameState.busy or not GameState.can_afford(b.nextUpgradeCost)
	else:
		_info.text = tr("Lucro %s a cada %s") % [Fmt.coins(b.profitPerCycle), Fmt.duration(b.cycleSeconds)]
		if GameState.district_unlocked(str(b.get("district", "praia"))):
			_action_button.text = tr("Comprar  %s") % Fmt.coins(b.cost)
			_action_button.disabled = GameState.busy or not GameState.can_afford(b.cost)
		else:
			var prev := Layout.previous_district(str(b.get("district", "praia")))
			_action_button.text = tr("Complete %s") % Layout.title(prev)
			_action_button.disabled = true
	var can_hire: bool = b.owned and not b.get("managed", false)
	_hire_button.visible = can_hire
	if can_hire:
		_hire_button.text = tr("Contratar ajudante  %s") % Fmt.coins(b.managerCost)
		_hire_button.disabled = GameState.busy or not GameState.can_afford(b.managerCost)
	_update_cycle(b)


func _update_cycle(b: Dictionary) -> void:
	if b.is_empty():
		return
	_progress.visible = b.owned
	_collect_button.visible = b.owned
	if not b.owned:
		return
	_progress.value = GameState.cycle_progress(b) * 100.0
	if b.get("automatic", false):
		_collect_button.disabled = true
		_collect_button.text = tr("Automático · %s") % Fmt.duration(GameState.seconds_remaining(b))
		return
	var ready := GameState.is_ready(b)
	_collect_button.disabled = GameState.busy or not ready
	_collect_button.text = (tr("Coletar  %s") % Fmt.coins(b.profitPerCycle)) if ready \
			else tr("Pronto em %s") % Fmt.duration(GameState.seconds_remaining(b))


func _on_action_pressed() -> void:
	var b := GameState.business(slug)
	if b.is_empty():
		return
	if b.owned:
		await GameState.upgrade(slug)
		return
	var was_open := Layout.DISTRICT_ORDER.filter(func(d): return GameState.district_unlocked(d))
	if await GameState.purchase(slug):
		var opened := Layout.DISTRICT_ORDER.filter(func(d):
			return GameState.district_unlocked(d) and not was_open.has(d))
		if not opened.is_empty():
			show_toast(tr("%s foi liberado! Abra o Mapa.") % Layout.title(opened[0]))
		else:
			show_toast(tr("%s é seu!") % tr(b.name))


func _on_collect_pressed() -> void:
	await GameState.collect(slug)


func _on_hire_pressed() -> void:
	var b := GameState.business(slug)
	if await GameState.hire_manager(slug):
		# Regra (ADR 0006): o ajudante trabalha quando você sai do mapa; aqui dentro, coleta
		# automática só com a Auto-coleta da Loja ou o Passe VIP.
		if GameState.state.get("player", {}).get("autoCollect", false):
			show_toast(tr("Ajudante contratado! %s agora produz sozinho.") % tr(b.name))
		else:
			show_toast(tr("Ajudante contratado! Ele vende sozinho quando você sai da %s (até 4h).")
					% Layout.title(current_district).to_lower())


## Construir: só o mapa atual e só o que ainda não foi construído (pedido do titular).
func open_build_menu() -> void:
	close_sheet()
	_helper_cards.clear()
	_reward_cards.clear()
	_reward_kind = ""
	_modal.open(tr("Construir · %s") % Layout.title(current_district))
	var unlocked := GameState.district_unlocked(current_district)
	var shown := 0
	for b in GameState.businesses():
		if Layout.district_of(b.slug) != current_district or b.owned:
			continue
		var target: String = b.slug
		_modal.add_business(b, "buy" if unlocked else "locked", func(): business_requested.emit(target))
		shown += 1
	if shown > 0:
		return
	# Tudo construído aqui: sugere o próximo passo.
	var next := _next_district(current_district)
	if next != "" and GameState.district_unlocked(next):
		_modal.add_message(Layout.texture("icon_map"), tr("Tudo construído!"),
				tr("A %s está esperando por você.") % Layout.title(next))
		_modal.add_action(tr("Ir para %s") % Layout.title(next), func(): district_requested.emit(next))
	else:
		_modal.add_message(Layout.texture("icon_build"), tr("Tudo construído!"),
				tr("Melhore seus negócios e contrate ajudantes para lucrar mais."))


func _next_district(id: String) -> String:
	var i := Layout.DISTRICT_ORDER.find(id)
	return Layout.DISTRICT_ORDER[i + 1] if i >= 0 and i + 1 < Layout.DISTRICT_ORDER.size() else ""


func open_map_menu() -> void:
	close_sheet()
	_modal.close()
	_helper_cards.clear()
	_reward_cards.clear()
	_reward_kind = ""
	GameState.track("screen_view", {"screen": "mapa"})
	map_trail.open(current_district)


# --- Loja (Etapa 4, ADR 0008) ------------------------------------------------

func open_store_menu() -> void:
	_open_rewards("store")
	_modal.open(tr("Loja"))
	if GameState.catalog.get("district", "") != current_district:
		await GameState.refresh_catalog()  # estimativas são do mapa atual
	if not _modal.visible or _reward_kind != "store":
		return
	if GameState.catalog.get("sandbox", false):
		_modal.add_message(null, "", tr("MODO DE TESTE: nenhuma compra é cobrada e os anúncios são simulados."))

	# Coleta antecipada: recebe agora X tempo de produção do mapa atual (pedido do titular).
	_modal.add_section(tr("Coleta antecipada · %s") % Layout.title(current_district))
	if GameState.ads_enabled():
		_add_ad_boost_card()
	for id in ["boost_1h", "boost_4h"]:
		var item_id: String = id
		_modal.add_store_card(func():
			var item := GameState.store_item(item_id)
			var cost: String = item.get("costGems", "0")
			var estimate := GameState.boost_estimate(int(item.get("hours", 0)) * 3600)
			var has_income := estimate != "0" and not estimate.begins_with("-")
			return {
				"title": item.get("title", item_id), "icon": COIN_TEX,
				"subtitle": tr("≈ %s moedas na hora") % Fmt.coins(estimate) if has_income
						else tr("Construa um negócio neste mapa primeiro."),
				"button": cost, "button_icon": _gem_tex, "color": BLUE, "edge": BLUE_DARK,
				"enabled": has_income and GameState.gems().to_int() >= cost.to_int(),
			}, func(): _buy_with_gems(item_id))

	# Turbo (ADR 0013): produção 2× em todos os mapas; soma com ajudante, níveis e VIP.
	_modal.add_section(tr("Turbo 2×"))
	for id in ["turbo_1h", "turbo_4h", "turbo_24h"]:
		var item_id: String = id
		_modal.add_store_card(func():
			var item := GameState.store_item(item_id)
			var cost: String = item.get("costGems", "0")
			var until: Variant = GameState.turbo_until()
			return {
				"title": item.get("title", item_id), "icon": COIN_TEX,
				"subtitle": tr("Produção 2× em todos os mapas") + "\n" + (tr("Ativo até %s") % _date_text(until) if until != null else tr("Soma tempo se já estiver ativo")),
				"button": cost, "button_icon": _gem_tex, "color": BLUE, "edge": BLUE_DARK,
				"enabled": GameState.gems().to_int() >= cost.to_int(),
			}, func(): _buy_with_gems(item_id))

	_modal.add_section(tr("Auto-coleta"))
	for id in ["auto_collect_24h", "auto_collect_7d"]:
		var item_id: String = id
		_modal.add_store_card(func():
			var item := GameState.store_item(item_id)
			var cost: String = item.get("costGems", "0")
			return {
				"title": item.get("title", item_id),
				"subtitle": tr("Os ajudantes coletam sozinhos enquanto você joga") + "\n" + _auto_collect_status(),
				"button": cost, "button_icon": _gem_tex, "color": BLUE, "edge": BLUE_DARK,
				"enabled": GameState.gems().to_int() >= cost.to_int(),
			}, func(): _buy_with_gems(item_id))

	if not GameState.purchases_enabled():
		_modal.refit()  # versão 1.0: sem itens em dinheiro real (ADR 0018)
		return
	_modal.add_section(tr("Passe VIP"))
	# Já assinante: o botão vira "Ativo ✓" (desligado) e aparece "Gerenciar assinatura", que abre os
	# Ajustes da conta Apple — cancelar/trocar é sempre pela Apple, nunca dentro do jogo.
	_modal.add_store_card(func():
		var vip := GameState.store_item("vip_monthly")
		var active := GameState.vip_until() != null
		return {
			"title": vip.get("title", "Passe VIP"), "icon": Layout.texture("icon_helpers"),
			"subtitle": " · ".join(Array(vip.get("benefits", [])).map(func(t): return tr(t))) + "\n" + _vip_status(),
			"button": tr("Ativo ✓") if active else tr("%s/mês") % _price_label(vip),
			"color": Style.TEAL_LIGHT if active else Style.ORANGE,
			"edge": Style.TEAL_DARK if active else Style.ORANGE_DARK, "enabled": not active,
		}, func():
			var vip := GameState.store_item("vip_monthly")
			_buy_real_or_sandbox(vip))
	if GameState.real_store() and GameState.vip_until() != null:
		_modal.add_action(tr("Gerenciar assinatura"), func():
			if GameState.store_brand() == "google":
				GameState.store_node.manage(str(GameState.store_item("vip_monthly").get("productId", "")))
			else:
				OS.shell_open("https://apps.apple.com/account/subscriptions"), Style.TEAL_LIGHT, Style.TEAL_DARK)
	if GameState.real_store():
		# Diretriz 3.1.2 da Apple: preço, período, renovação automática e links de termos/privacidade.
		var terms := tr("Assinatura mensal de %s, renovada automaticamente até você cancelar em Google Play → Pagamentos e assinaturas. A cobrança é feita na sua conta Google.") \
				if GameState.store_brand() == "google" else \
				tr("Assinatura mensal de %s, renovada automaticamente até você cancelar nos Ajustes da sua conta Apple (pelo menos 24 h antes do fim do período). A cobrança é feita na sua conta Apple.")
		_modal.add_message(null, "", terms % _price_label(GameState.store_item("vip_monthly")))
		_modal.add_action(tr("Termos de uso"), func(): OS.shell_open("https://imperio.crowntech.com.br/termos/"), Style.TEAL_LIGHT, Style.TEAL_DARK)
		_modal.add_action(tr("Política de privacidade"), func(): OS.shell_open("https://imperio.crowntech.com.br/privacidade/"), Style.TEAL_LIGHT, Style.TEAL_DARK)
	# Recompensa diária de diamantes do VIP (pedido do titular).
	_modal.add_store_card(func():
		var ent: Dictionary = GameState.catalog.get("entitlements", {})
		var is_vip := GameState.vip_until() != null
		var claimed: bool = ent.get("vipDailyClaimed", false)
		return {
			"title": tr("Diamantes diários do VIP"), "icon": _gem_tex,
			"subtitle": tr("+%d diamantes por dia para assinantes") % int(ent.get("vipDailyGems", 5)) \
					if not is_vip else (tr("Volte amanhã para mais") if claimed else tr("Disponível hoje")),
			"button": tr("Resgatado") if claimed else tr("Resgatar"),
			"color": Style.TEAL_LIGHT if claimed else Style.ORANGE,
			"edge": Style.TEAL_DARK if claimed else Style.ORANGE_DARK,
			"enabled": is_vip and not claimed,
		}, func():
			if await GameState.claim_vip_daily():
				show_toast(tr("+%d diamantes!") % int(GameState.catalog.get("entitlements", {}).get("vipDailyGems", 5)))
			_modal.refresh_store_cards())

	# Dobro de moedas (ADR 0025): ×2 em toda a produção por 1 hora, até 3 por mês.
	var dbl := GameState.store_item("double_1h")
	if not dbl.is_empty():
		_modal.add_section(tr("Dobro de moedas"))
		_modal.add_store_card(func():
			var d := GameState.store_item("double_1h")
			var used := int(d.get("usedThisMonth", 0))
			var limit := int(d.get("monthlyLimit", 3))
			var until: Variant = GameState.double_until()
			return {
				"title": tr("Dobro de moedas por 1 hora"), "icon": COIN_TEX,
				"subtitle": tr("Toda a produção ×2 (soma com Turbo e VIP)") + "\n" + (
						tr("Ativo até %s") % _date_text(until) if until != null else tr("Este mês: %d/%d") % [used, limit]),
				"button": _price_label(d) if used < limit else "%d/%d" % [used, limit],
				"color": Style.ORANGE, "edge": Style.ORANGE_DARK, "enabled": used < limit,
			}, func():
				_buy_real_or_sandbox(GameState.store_item("double_1h")))

	_modal.add_section(tr("Diamantes"))
	for id in ["gems_50", "gems_120", "gems_300"]:
		var item_id: String = id
		_modal.add_store_card(func():
			var item := GameState.store_item(item_id)
			return {
				"title": item.get("title", item_id), "icon": _gem_tex,
				"subtitle": tr("+%s diamantes") % Fmt.coins(item.get("gems", "0")),
				"button": _price_label(item), "color": Style.GREEN,
				"edge": Style.GREEN_DARK, "enabled": true,
			}, func():
				var item := GameState.store_item(item_id)
				_buy_real_or_sandbox(item))

	_modal.add_action(tr("Restaurar compras"), _restore_purchases, Style.TEAL_LIGHT, Style.TEAL_DARK)
	_modal.refit()


## Coleta antecipada grátis com anúncio (só com anúncios ligados — ADR 0018).
func _add_ad_boost_card() -> void:
	_modal.add_store_card(func():
		var ad := GameState.store_item("ad_boost")
		var used := int(ad.get("usedToday", 0))
		var limit := int(ad.get("dailyLimit", 5))
		return {
			"title": ad.get("title", tr("Coleta antecipada")), "icon": COIN_TEX,
			"subtitle": tr("Grátis com anúncio · ≈ %s moedas\nHoje: %d/%d") % [
				Fmt.coins(GameState.boost_estimate(int(ad.get("minutes", 15)) * 60)), used, limit],
			"button": tr("Assistir") if used < limit else "%d/%d" % [used, limit],
			"color": PURPLE, "edge": PURPLE_DARK, "enabled": used < limit,
		}, func(): watch_ad("ad_boost"))


func _buy_with_gems(item_id: String) -> void:
	var data := await GameState.buy_with_gems(item_id)
	if data.is_empty():
		_modal.refresh_store_cards()
		return
	if data.has("coins"):
		show_toast(tr("Coleta antecipada: +%s moedas") % Fmt.coins(data.coins))
	elif data.has("turbo"):
		show_toast(tr("Turbo 2× ligado!"))
	else:
		show_toast(tr("Auto-coleta ativa!"))
	_modal.refresh_store_cards()


## Preço do item: o da App Store (localizado) quando a loja real está ligada; senão o do catálogo.
func _price_label(item: Dictionary) -> String:
	if GameState.real_store():
		var p: String = GameState.store_node.price(str(item.get("productId", "")))
		if p != "":
			return p
	return "R$ " + str(item.get("priceBRL", ""))


## Loja real (iPhone): a própria Apple mostra a confirmação. Teste: nossa confirmação "sem cobrança".
func _buy_real_or_sandbox(item: Dictionary, reopen_store := true) -> void:
	var product_id := str(item.get("productId", ""))
	if not GameState.real_store():
		_confirm_sandbox(item, product_id, reopen_store)
		return
	var r: Dictionary = await GameState.buy_real(product_id)
	if r.ok:
		show_toast(tr("Compra confirmada: %s") % item.get("title", ""))
	elif r.message == "PURCHASE_PENDING":
		show_toast(tr("Compra aguardando aprovação. O item chega assim que for aprovada."))
	elif r.message != "":
		show_toast(GameState.message_for(str(r.message)) if GameState.MESSAGES.has(str(r.message)) else tr("Não foi possível concluir a compra."))
	if reopen_store:
		open_store_menu()
	else:
		_modal.close()


## Confirmação da compra em dinheiro. No modo de teste deixa claro que nada é cobrado.
func _confirm_sandbox(item: Dictionary, product_id: String, reopen_store := true) -> void:
	_reward_kind = "store_confirm"
	_modal.open(tr("Confirmar compra"))
	var price := "R$ " + str(item.get("priceBRL", ""))
	if GameState.catalog.get("sandbox", false):
		_modal.add_message(null, str(item.get("title", "")),
				tr("%s\n\nCOMPRA DE TESTE: nenhum valor será cobrado.") % price)
	else:
		_modal.add_message(null, str(item.get("title", "")), price)
	_modal.add_action(tr("Confirmar"), func(): _sandbox_buy(item, product_id, reopen_store),
			Style.GREEN, Style.GREEN_DARK)
	var back := open_store_menu if reopen_store else Callable(_modal, "close")
	_modal.add_action(tr("Voltar"), back, Style.GREY, Style.GREY_DARK)
	_modal.refit()


func _sandbox_buy(item: Dictionary, product_id: String, reopen_store: bool) -> void:
	if await GameState.buy_sandbox(product_id):
		show_toast(tr("Compra confirmada: %s") % item.get("title", ""))
	if reopen_store:
		open_store_menu()


func _restore_purchases() -> void:
	if GameState.real_store():
		await GameState.store_node.restore()
	var res := await Api.restore_purchases()
	if res.ok:
		show_toast(tr("%d compra(s) encontrada(s) nesta conta.") % res.data.purchases.size())
		await GameState.refresh()


## Anúncio recompensado: sessão no servidor → anúncio (de teste) → confirmação → resgate.
func watch_ad(placement: String) -> void:
	var start := await Api.ad_start(placement, current_district)
	if not start.ok:
		show_toast(GameState.message_for(start.error_code))
		return
	var session: String = start.data.sessionId
	if GameState.real_ads():
		var shown: Dictionary = await GameState.admob.show_rewarded(session)
		if not shown.shown:
			show_toast(tr("Nenhum anúncio disponível agora. Tente de novo em instantes."))
			return
		if not shown.earned:
			show_toast(tr("Anúncio fechado antes do fim: sem prêmio."))
			return
	elif not await _mock_ad.play():
		show_toast(tr("Anúncio fechado antes do fim: sem prêmio."))
		return
	if GameState.ads_mode() == "mock":
		var done := await Api.ad_mock_complete(session)
		if not done.ok:
			show_toast(GameState.message_for(done.error_code))
			return
	# Com AdMob a confirmação (SSV) chega do Google ao servidor alguns segundos depois.
	var claim := await Api.ad_claim(session)
	for attempt in 8:
		if claim.ok or claim.error_code != "AD_NOT_VERIFIED" or GameState.ads_mode() == "mock":
			break
		await get_tree().create_timer(1.5).timeout
		claim = await Api.ad_claim(session)
	if not claim.ok:
		show_toast(GameState.message_for(claim.error_code))
		return
	GameState._apply_state(claim.data.state)
	show_toast(tr("+%s moedas!") % Fmt.coins(claim.data.coins))
	await GameState.refresh_catalog()  # atualiza o "Hoje: 1/5"
	_modal.refresh_store_cards()


func _auto_collect_status() -> String:
	if GameState.vip_until() != null:
		return tr("Ativa pelo Passe VIP")
	var until: Variant = GameState.auto_collect_until()
	return tr("Ativa até %s") % _date_text(until) if until != null else tr("Desligada")


func _vip_status() -> String:
	var until: Variant = GameState.vip_until()
	if until == null:
		return tr("Assinatura mensal")
	# Versão de desenvolvimento compra no ambiente de teste da Apple, onde o "mês" é encurtado
	# (renova a cada poucos minutos ou 1 dia, conforme a conta de teste). Na App Store é 1 mês.
	if OS.is_debug_build() and GameState.real_store():
		return (tr("Ativo até %s (assinatura de teste do Google: renova mais rápido)") if GameState.store_brand() == "google" \
				else tr("Ativo até %s (assinatura de teste da Apple: renova mais rápido)")) % _date_text(until)
	return tr("Ativo até %s · renova todo mês") % _date_text(until)


## "dd/mm às hh:mm" no fuso do aparelho.
static func _date_text(iso: Variant) -> String:
	var unix: float = _iso_seconds(str(iso)) + Time.get_time_zone_from_system().bias * 60
	var d := Time.get_datetime_dict_from_unix_time(int(unix))
	return "%02d/%02d às %02d:%02d" % [d.day, d.month, d.hour, d.minute]


# --- Missões, Ranking e Perfil/Conquistas (Etapa 3) ---------------------------

func open_missions_menu() -> void:
	_open_rewards("missions")
	_modal.open(tr("Missões do dia"))
	_modal.add_message(null, "", tr("Complete as missões e resgate moedas e diamantes.") + "\n" + _reset_text())
	for m in GameState.missions.get("missions", []):
		var mission: Dictionary = m
		var id: String = mission.id
		_reward_cards[id] = _modal.add_reward_card(_mission_item(mission), func(): GameState.claim_mission(id))
	# Baú das missões (ADR 0014): abre com as 3 resgatadas.
	if GameState.missions.has("chest"):
		_modal.add_store_card(func():
			var chest: Dictionary = GameState.missions.get("chest", {})
			var claimed: bool = chest.get("claimed", false)
			return {
				"title": tr("Baú das missões"), "icon": _gem_tex,
				"subtitle": tr("Resgate as 3 missões: +%d diamantes e Turbo 2× por %d min (%d/%d)") % [
					int(chest.get("gems", 5)), int(chest.get("turboMinutes", 30)),
					int(chest.get("progress", 0)), int(chest.get("target", 3))],
				"button": tr("Aberto") if claimed else tr("Abrir"),
				"color": Style.TEAL_LIGHT if claimed else Style.ORANGE,
				"edge": Style.TEAL_DARK if claimed else Style.ORANGE_DARK,
				"enabled": chest.get("available", false) and not claimed,
			}, func():
				if await GameState.open_mission_chest():
					show_toast(tr("Baú aberto! +%d diamantes e Turbo 2×.") % int(GameState.missions.chest.gems))
				_modal.refresh_store_cards())
	GameState.refresh_missions()


func open_profile_menu() -> void:
	_open_rewards("achievements")
	_modal.open(tr("Perfil"))
	var player: Dictionary = GameState.state.get("player", {})
	var owned := GameState.businesses().filter(func(b): return b.owned).size()
	var helpers := GameState.businesses().filter(func(b): return b.get("managed", false)).size()
	_modal.add_message(Layout.texture("icon_profile"), str(player.get("displayName", "")),
			tr("%d negócios · %d ajudantes · %s diamantes") % [owned, helpers, Fmt.coins(GameState.gems())])
	if GameState.vip_until() != null:
		_modal.add_vip_badge(tr("Jogador VIP"), tr("Passe VIP ativo até %s") % _date_text(GameState.vip_until()))
	# Código usado no suporte e para pedir exclusão pelo site (sem o jogo instalado).
	_modal.add_copy_row(tr("Código do jogador (suporte)"), player_code(), func():
		show_toast(tr("Código copiado!")))
	if player.get("canChangeName", false):
		_modal.add_action(tr("Alterar nome (só 1 vez)"), open_name_form, Style.TEAL_LIGHT, Style.TEAL_DARK)
	_add_prestige_section()
	_modal.add_section(tr("Conquistas"))
	for a in GameState.achievements:
		var ach: Dictionary = a
		var id: String = ach.id
		_reward_cards[id] = _modal.add_reward_card(_achievement_item(ach), func(): GameState.claim_achievement(id))
	_modal.add_section(tr("Conta"))
	_add_save_progress()
	_modal.add_action(tr("Excluir conta"), open_delete_account_form, Style.RED, Style.RED_DARK)
	GameState.refresh_achievements()


## Salvar progresso (ADR 0015): vincular a conta convidada ao Google (Android) ou à Apple (iOS)
## para recuperar o jogo em outro aparelho. Já vinculada, a linha vira só a confirmação (sem botão).
func _add_save_progress() -> void:
	var provider := "apple" if OS.get_name() == "iOS" else "google"
	var label := tr("Vincular com a Apple") if provider == "apple" else tr("Vincular com o Google")
	var holder: Array = []  # o botão só existe depois de add_option (lambda copia variáveis)
	var info: Button = _modal.add_option(tr("Salvar progresso"), tr("Conta convidada: vincule para não perder o progresso ao trocar de aparelho."), func():
		_on_link_pressed(holder[0] as Button, provider))
	holder.append(info)
	info.text = label
	if GameState.linked_providers.has(provider):
		_show_linked(info, provider)
		return
	var res := await Api.identities()
	if res.ok:
		GameState.linked_providers = Array(res.data.get("linked", []))
	if GameState.linked_providers.has(provider) and is_instance_valid(info):
		_show_linked(info, provider)


## Troca o botão "Vincular" pela confirmação na própria linha do Perfil.
func _show_linked(button: Button, provider: String) -> void:
	var row := button.get_parent()
	button.visible = false
	var texts := row.get_child(0) if row != null and row.get_child_count() > 0 else null
	if texts != null and texts.get_child_count() > 1:
		(texts.get_child(1) as Label).text = tr("Progresso salvo na sua conta Apple ✓") if provider == "apple" else tr("Progresso salvo na sua conta Google ✓")


func _on_link_pressed(button: Button, provider: String) -> void:
	var ready_ := AppleAuth.available() if provider == "apple" else GoogleAuth.available()
	if not ready_:
		show_toast(tr("Atualize o jogo na loja para vincular sua conta."))
		return
	button.disabled = true
	var r: Dictionary = await GameState.link_account(provider)
	if not is_instance_valid(button):
		return
	button.disabled = false
	if r.ok:
		_show_linked(button, provider)
		show_toast(tr("Progresso salvo na sua conta Apple!") if provider == "apple" else tr("Progresso salvo na sua conta Google!"))
	elif r.code == "IDENTITY_IN_USE":
		_offer_load_linked_progress(provider, str(r.token))
	elif r.code != "CANCELLED":
		show_toast(GameState.message_for(str(r.code)))


## A conta Apple/Google já guarda outro progresso (ex.: de outro aparelho): pergunta se carrega.
func _offer_load_linked_progress(provider: String, id_token: String) -> void:
	_reward_kind = "link"
	var apple := provider == "apple"
	_modal.open(tr("Conta Apple já usada") if apple else tr("Conta Google já usada"))
	_modal.add_message(null, "", tr("Essa conta Apple já tem um progresso salvo. Quer carregar aquele progresso neste aparelho? O progresso atual deste aparelho deixa de ser usado.") if apple \
			else tr("Essa conta Google já tem um progresso salvo. Quer carregar aquele progresso neste aparelho? O progresso atual deste aparelho deixa de ser usado."))
	_modal.add_action(tr("Carregar o progresso salvo"), func():
		if await GameState.sign_in_with(provider, id_token):
			get_tree().reload_current_scene()
		else:
			show_toast(tr("Não foi possível carregar. Tente de novo."))
			_modal.close(), Style.ORANGE, Style.ORANGE_DARK)
	_modal.add_action(tr("Continuar com este progresso"), func(): open_profile_menu())


## Código curto da conta (8 primeiros caracteres do id) para suporte e pedidos de exclusão
## pelo site; o painel admin encontra o jogador por ele.
static func player_code() -> String:
	return str(GameState.state.get("player", {}).get("id", "")).substr(0, 8).to_upper()


# --- Prestígio: "Vender o império" (ADR 0011) ---------------------------------

func _add_prestige_section() -> void:
	var p: Dictionary = GameState.prestige
	if p.is_empty():
		return
	var stars := int(p.get("stars", 0))
	var gain := int(p.get("starsToGain", 0))
	_modal.add_section(tr("Prestígio"))
	var status: String
	if not p.get("requirementMet", false):
		var total := int(p.get("totalBusinesses", 0))
		status = tr("Complete o império para vender: todos os negócios e todos os ajudantes.") \
				+ "\n" + tr("Negócios %d/%d · Ajudantes %d/%d") % [
					int(p.get("ownedBusinesses", 0)), total, int(p.get("hiredHelpers", 0)), total]
	elif gain < 1:
		status = tr("Fature mais para ganhar a primeira estrela desta rodada.")
	else:
		status = tr("Vender agora rende +%d ⭐ (lucro +%d%% para sempre).") % [gain, int(p.get("nextBonusPercent", 0))]
	_modal.add_message(null, tr("⭐ %d estrelas · lucro +%d%%") % [stars, int(p.get("bonusPercent", 0))],
			tr("Venda o império para recomeçar da praia com mais lucro em tudo.") + "\n" + status)
	if p.get("available", false):
		_modal.add_action(tr("Vender o império (+%d ⭐)") % gain, open_prestige_form, Style.ORANGE, Style.ORANGE_DARK)


func open_prestige_form() -> void:
	_reward_kind = "prestige"
	_reward_cards.clear()
	var p: Dictionary = GameState.prestige
	_modal.open(tr("Vender o império"))
	_modal.add_message(null, tr("+%d ⭐ · lucro +%d%% para sempre") % [int(p.get("starsToGain", 0)), int(p.get("nextBonusPercent", 0))],
			tr("Você recomeça na praia com 100 moedas. Negócios, níveis, ajudantes, moedas e mapas voltam ao início.\nFicam: diamantes, conquistas, Passe VIP, auto-coleta comprada e o ranking da semana."))
	_modal.add_action(tr("Vender e recomeçar"), func():
		if await GameState.sell_empire():
			show_toast(tr("Império vendido! +%d ⭐ — agora seu lucro é +%d%%.") % [
					int(GameState.prestige.get("stars", 0)) - int(p.get("stars", 0)), int(GameState.prestige.get("bonusPercent", 0))])
		else:
			open_profile_menu(), Style.ORANGE, Style.ORANGE_DARK)
	_modal.add_action(tr("Agora não"), open_profile_menu, Style.GREY, Style.GREY_DARK)


## Exclusão de conta (LGPD, ADR 0009): irreversível, com confirmação digitada.
func open_delete_account_form() -> void:
	_reward_kind = "delete"
	_reward_cards.clear()
	_modal.open(tr("Excluir conta"))
	_modal.add_message(null, tr("Isso não pode ser desfeito"),
			tr("Seus negócios, moedas, diamantes, ajudantes, missões, conquistas e posição no ranking serão apagados para sempre, e o jogo recomeça do zero.\nCompras feitas na loja não são reembolsadas por aqui; o Passe VIP pode ser recuperado em \"Restaurar compras\" numa conta nova."))
	var edit: LineEdit = _modal.add_line_edit(tr("Digite EXCLUIR para confirmar"), 10)
	_modal.add_action(tr("Excluir para sempre"), func():
		if edit.text.strip_edges().to_upper() != "EXCLUIR":
			show_toast(tr("Digite EXCLUIR para confirmar."))
			open_delete_account_form()
			return
		if not await GameState.delete_account():
			open_profile_menu(), Style.RED, Style.RED_DARK)
	_modal.add_action(tr("Voltar"), open_profile_menu, Style.GREY, Style.GREY_DARK)
	_modal.refit()
	edit.grab_focus.call_deferred()


## Configurações: música e efeitos sonoros (pedido do titular). Salvo só no aparelho.
func open_settings_menu() -> void:
	close_sheet()
	_reward_kind = "settings"
	_reward_cards.clear()
	_helper_cards.clear()
	_modal.open(tr("Configurações"))
	_modal.add_toggle(null, tr("Música"), Audio.music_on, func(on: bool):
		Audio.set_music_on(on)
		Audio.play("toggle"))
	_modal.add_toggle(null, tr("Efeitos sonoros"), Audio.sfx_on, func(on: bool):
		Audio.set_sfx_on(on)
		Audio.play("toggle"))
	_modal.add_option(tr("Idioma"), Lang.label(), open_language_menu)
	_modal.add_message(null, "", tr("Versão %s") % str(ProjectSettings.get_setting("application/config/version", "0.1.0")))
	_modal.refit()


## Idioma (V1.2): troca na hora — a cena é recarregada para todos os textos mudarem.
func open_language_menu() -> void:
	_reward_kind = "language"
	_modal.open(tr("Idioma"))
	var auto_name: String = Lang.NAMES[Lang.detect(OS.get_locale_language())]
	var options := [["auto", tr("Automático · %s") % auto_name]]
	for code in Lang.SUPPORTED:
		options.append([code, Lang.NAMES[code]])
	for o in options:
		var code: String = o[0]
		var chosen: bool = Lang.choice == code
		_modal.add_action(("✓  " if chosen else "") + o[1], func(): choose_language(code),
				Style.GREEN if chosen else Style.TEAL, Style.GREEN_DARK if chosen else Style.TEAL_DARK)
	_modal.add_action(tr("Voltar"), open_settings_menu, Style.GREY, Style.GREY_DARK)
	_modal.refit()


func choose_language(code: String) -> void:
	var before := TranslationServer.get_locale()
	Lang.set_choice(code)
	_modal.close()
	if TranslationServer.get_locale() != before:
		get_tree().reload_current_scene()


## Troca de nome: permitida uma única vez (pedido do titular); o servidor valida.
func open_name_form() -> void:
	_reward_kind = "name"
	_reward_cards.clear()
	_modal.open(tr("Alterar nome"))
	_modal.add_message(null, "", tr("Escolha com cuidado: você só pode trocar de nome uma vez.\nDe 3 a 20 caracteres. O nome aparece no ranking."))
	var edit: LineEdit = _modal.add_line_edit(tr("Seu novo nome"), 20)
	_modal.add_action(tr("Confirmar"), func():
		if await GameState.change_name(edit.text):
			show_toast(tr("Agora você é %s!") % GameState.state.player.displayName)
			open_profile_menu()
		else:
			open_name_form(), Style.GREEN, Style.GREEN_DARK)
	_modal.add_action(tr("Voltar"), open_profile_menu, Style.GREY, Style.GREY_DARK)
	_modal.refit()
	edit.grab_focus.call_deferred()


## Ranking (ADR 0014): Liga da semana · Geral da semana · Estrelas de prestígio.
func open_ranking_menu(tab := -1) -> void:
	close_sheet()
	_helper_cards.clear()
	_reward_cards.clear()
	_reward_kind = "ranking"
	if tab >= 0:
		_ranking_tab = tab
	GameState.track("screen_view", {"screen": "ranking"})
	_modal.open(tr("Ranking"))
	var tabs := [tr("Liga"), tr("Semana"), tr("Estrelas")]
	_modal.add_tabs(tabs, _ranking_tab, func(i): open_ranking_menu(i))
	_modal.add_message(null, "", tr("Carregando…"))
	var shown_tab := _ranking_tab
	var res: Dictionary
	if shown_tab == 2:
		res = await Api.leaderboard_stars()
	else:
		res = await Api.leaderboard()
	if _reward_kind != "ranking" or not _modal.visible or shown_tab != _ranking_tab:
		return
	_modal.clear_list()
	_modal.add_tabs(tabs, _ranking_tab, func(i): open_ranking_menu(i))
	if not res.ok:
		_modal.add_message(null, "", GameState.message_for(res.error_code))
		return
	var data: Dictionary = res.data
	var entries: Array = data.entries
	var me: Variant = data.me
	if shown_tab == 0:
		var lg: Dictionary = data.get("league", {})
		var ends := _iso_seconds(data.week.end) - _iso_seconds(data.serverTime)
		var lines := [_bracket_text(int(lg.get("bracket", 0)))]
		var size := int(lg.get("size", 0))
		lines.append(tr("1 jogador nesta liga") if size == 1 else tr("%d jogadores nesta liga") % size)
		if int(lg.get("promote", 0)) > 0:
			lines.append(tr("O 1º sobe para a próxima liga") if int(lg.promote) == 1 else tr("Os %d primeiros sobem para a próxima liga") % int(lg.promote))
		else:
			lines.append(tr("Liga mais alta: mantenha o topo!"))
		if int(lg.get("demote", 0)) > 0:
			lines.append(tr("Os %d últimos descem") % int(lg.demote))
		lines.append(tr("Termina em %s.") % Fmt.duration(ends))
		lines.append(tr("A pontuação zera toda segunda: todos começam do zero."))
		_modal.add_message(null, tr("Liga %s") % tr(str(lg.get("name", "Bronze"))), "\n".join(lines))
		_modal.add_prize_strip(tr("Prêmios desta semana"), _prize_items(data.get("prizes", {}).get("liga", [])))
		entries = lg.get("entries", [])
		me = lg.get("me")
	elif shown_tab == 1:
		var ends := _iso_seconds(data.week.end) - _iso_seconds(data.serverTime)
		_modal.add_message(null, tr("Desafio dos 7 dias"),
				tr("Quem faturar mais com seus negócios até domingo vence.\nTermina em %s.") % Fmt.duration(ends)
				+ "\n" + tr("A pontuação zera toda segunda: todos começam do zero."))
		_modal.add_prize_strip(tr("Prêmios desta semana"), _prize_items(data.get("prizes", {}).get("semana", [])))
	else:
		_modal.add_message(null, tr("Estrelas de investidor"),
				tr("Quem acumulou mais estrelas vendendo o império (Perfil → Prestígio)."))
	if data.get("staff", false):
		_modal.add_message(null, tr("Conta da equipe"), tr("Esta conta é de testes da equipe e fica fora do ranking, para não concorrer com os jogadores."))
	if entries.is_empty():
		_modal.add_message(null, "", tr("Ninguém faturou nesta semana ainda. Colete moedas e saia na frente!")
				if shown_tab < 2 else tr("Ninguém vendeu o império ainda. Seja o primeiro!"))
	var hidden := GameState.hidden_players()
	var vips: Array = data.get("vip", [])
	for e in entries:
		if not e.isMe and hidden.has(str(e.get("playerId", ""))):
			continue
		var entry: Dictionary = e
		_modal.add_rank_row(int(e.rank), e.displayName, ("⭐ " + str(e.score)) if shown_tab == 2 else e.score, e.isMe,
				Callable() if e.isMe or not e.has("playerId") else func(): open_player_options(entry),
				vips.has(str(e.get("playerId", ""))))
	if me != null and not entries.any(func(e): return e.isMe):
		_modal.add_section(tr("Sua posição"))
		_modal.add_rank_row(int(me.rank), me.displayName, ("⭐ " + str(me.score)) if shown_tab == 2 else me.score, true,
				Callable(), GameState.vip_until() != null)
	# A conta da equipe fica fora das listas, mas compartilha a posição que teria (a página do
	# servidor calcula).
	var share_id := str(me.get("playerId", "")) if me != null else ""
	if share_id == "" and data.get("staff", false):
		share_id = str(GameState.state.get("player", {}).get("id", ""))
	if share_id != "":
		var tab_key: String = ["liga", "semana", "estrelas"][shown_tab]
		var player_id := share_id
		_modal.add_action(tr("Compartilhar minha posição"), func(): share_rank(player_id, tab_key),
				Color("1877f2"), Color("0d5bbf"))
	_modal.refit()


## Compartilhar a posição: abre a página do servidor que monta a imagem com o nome e a posição e
## chama a folha de compartilhar do celular (Facebook, WhatsApp, Instagram…) com a imagem e o
## link. Abrir o facebook.com/sharer direto não serve: o app do Facebook só abre o feed.
func share_rank(player_id: String, tab_key: String) -> void:
	var page := "%s/share/rank/%s?t=%s&s=1" % [Api.base_url, player_id, tab_key]
	GameState.track("rank_shared", {"tab": tab_key, "network": "sheet"})
	OS.shell_open(page)


## Tocar em outro jogador no ranking: denunciar o nome ou ocultar (diretriz 1.2 da App Store).
func open_player_options(entry: Dictionary) -> void:
	var tab := _ranking_tab
	_reward_kind = "player"
	_modal.open(str(entry.displayName))
	_modal.add_message(null, "", tr("Achou este nome ofensivo? Denuncie: com várias denúncias o nome é trocado. Você também pode ocultar este jogador do seu ranking."))
	_modal.add_action(tr("Denunciar nome impróprio"), func():
		if await GameState.report_player(str(entry.playerId)):
			show_toast(tr("Denúncia enviada. Obrigado!"))
		open_ranking_menu(tab), Style.ORANGE, Style.ORANGE_DARK)
	_modal.add_action(tr("Ocultar este jogador"), func():
		GameState.hide_player(str(entry.playerId))
		show_toast(tr("Jogador oculto do seu ranking."))
		open_ranking_menu(tab))
	_modal.add_action(tr("Voltar"), func(): open_ranking_menu(tab))


# --- Calendário de 7 dias e evento de fim de semana (ADR 0014) -----------------

## Avisos ao entrar: primeiro o pódio da semana (se ganhou), depois o prêmio do dia.
func maybe_show_popups() -> void:
	await maybe_show_update()
	await maybe_show_podium()
	await maybe_show_daily()


## Ao abrir: se a loja já tem uma versão mais nova, oferece atualizar (abre a página do jogo na
## App Store / Play Store). Abaixo da versão mínima do servidor, a atualização é obrigatória.
func maybe_show_update() -> void:
	if OS.get_name() not in ["iOS", "Android"]:
		return
	var res := await Api.app_version()
	if not res.ok:
		return
	var mine := str(ProjectSettings.get_setting("application/config/version", ""))
	var latest := str(res.data.get("latest", "")) if res.data.get("latest") != null else ""
	var minimum := str(res.data.get("minimum", "")) if res.data.get("minimum") != null else ""
	var required := minimum != "" and version_less(mine, minimum)
	if not required and (latest == "" or not version_less(mine, latest)):
		return
	# Android: a própria Play Store atualiza por cima do jogo (baixa, instala e reinicia).
	if OS.get_name() == "Android" and await GoogleAuth.start_store_update():
		return
	while _modal.visible or map_trail.visible:
		await get_tree().create_timer(0.4).timeout
	open_update_prompt(latest if latest != "" else minimum, required)
	while _modal.visible and _reward_kind == "update":
		await get_tree().create_timer(0.3).timeout


func open_update_prompt(version: String, required: bool) -> void:
	_reward_kind = "update"
	_modal.open(tr("Atualização disponível"))
	_modal.add_message(null, tr("Versão %s") % version,
			tr("Esta versão do jogo não é mais aceita. Atualize para continuar jogando.") if required
			else tr("Tem uma versão nova do Império de Bolso na loja, com novidades e correções. Atualize para não perder nada."))
	_modal.add_action(tr("Atualizar agora"), func():
		OS.shell_open(store_link())
		if required:
			open_update_prompt(version, required)  # continua aberto até atualizar
		else:
			_modal.close(), Style.GREEN, Style.GREEN_DARK)
	if not required:
		_modal.add_action(tr("Depois"), func(): _modal.close(), Style.GREY, Style.GREY_DARK)
	_modal.refit()


## Abre direto o app da loja (App Store / Play Store), não o navegador.
static func store_link() -> String:
	if OS.get_name() == "iOS":
		return "itms-apps://apps.apple.com/app/id6822892071"
	return "market://details?id=br.com.imperiodebolso.game"


## "1.0.5" < "1.0.10": compara versões por partes numéricas.
static func version_less(a: String, b: String) -> bool:
	var x := a.split(".")
	var y := b.split(".")
	for i in max(x.size(), y.size()):
		var p := int(x[i]) if i < x.size() else 0
		var q := int(y[i]) if i < y.size() else 0
		if p != q:
			return p < q
	return false


## "Parabéns! Você ficou em 1º lugar…" com o botão de resgatar (ADR 0017).
func maybe_show_podium() -> void:
	while not GameState.podium.is_empty():
		while _modal.visible or map_trail.visible:
			await get_tree().create_timer(0.4).timeout
		if GameState.podium.is_empty():
			return
		open_podium_reward(GameState.podium[0])
		while _modal.visible and _reward_kind == "podium":
			await get_tree().create_timer(0.3).timeout


func open_podium_reward(r: Dictionary) -> void:
	close_sheet()
	_reward_cards.clear()
	_reward_kind = "podium"
	_modal.open(tr("Parabéns!"))
	var where := tr("no ranking da semana") if r.kind == "semana" else tr("na Liga %s") % tr(str(r.get("league", "Bronze")))
	var rank := int(r.rank)
	var medal: Texture2D = load("res://assets/optimized/rank_%d.png" % rank) if rank >= 1 and rank <= 3 else _gem_tex
	var bonus := _bonus_text(str(r.get("bonusKind", "")), int(r.get("bonusHours", 0)))
	_modal.add_message(medal, tr("%dº lugar") % rank,
			tr("Você ficou em %dº lugar %s. Seu prêmio:") % [rank, where] + "\n" + tr("+%d diamantes") % int(r.gems)
			+ ("\n" + bonus if bonus != "" else ""))
	_modal.add_action(tr("Resgatar +%d diamantes") % int(r.gems), func():
		var gems := int(r.gems)
		if await GameState.claim_podium(str(r.week), str(r.kind)):
			show_toast(tr("+%d diamantes!") % gems)
		_modal.close(), Style.ORANGE, Style.ORANGE_DARK)


## Prêmios do pódio para a faixa do Ranking: [{gems, extra}] (o bônus muda toda semana).
func _prize_items(values: Array) -> Array:
	return values.map(func(p): return {
		"gems": int(p.get("gems", 0)) if p is Dictionary else int(p),
		"extra": _bonus_text(str(p.get("bonusKind", "")), int(p.get("bonusHours", 0))) if p is Dictionary else "",
	})


## "+ Turbo 6 h", "+ Auto-coleta 3 dias", "+ 12 h de produção" (bônus do pódio da semana).
func _bonus_text(kind: String, hours: int) -> String:
	if hours <= 0:
		return ""
	match kind:
		"turbo":
			return tr("+ Turbo %d h") % hours
		"auto":
			return tr("+ Auto-coleta %d dias") % (hours / 24) if hours >= 48 else tr("+ Auto-coleta %d h") % hours
		"boost":
			return tr("+ %d h de produção") % hours
	return ""


## Grupo de vendas do império da liga (ADR 0026).
func _bracket_text(bracket: int) -> String:
	if bracket <= 0:
		return tr("Grupo: quem ainda não vendeu o império")
	if bracket >= 5:
		return tr("Grupo: quem vendeu o império 5 vezes ou mais")
	return tr("Grupo: quem vendeu o império 1 vez") if bracket == 1 else tr("Grupo: quem vendeu o império %d vezes") % bracket


## Abre o calendário sozinho quando o prêmio do dia está esperando (depois do tutorial e de
## qualquer janela aberta, como o resumo "Bem-vindo de volta").
func maybe_show_daily() -> void:
	if GameState.daily.is_empty() or GameState.daily.get("claimedToday", true) or not GameState.tutorial_completed():
		return
	while _modal.visible or map_trail.visible:
		await get_tree().create_timer(0.4).timeout
	if not GameState.daily.get("claimedToday", true):
		open_daily_menu()


func _reward_text(r: Dictionary) -> String:
	var parts := []
	if r.get("coins") != null:
		parts.append(tr("+%s moedas") % Fmt.coins(r.coins))
	if int(r.get("gems", 0)) > 0:
		parts.append(tr("+%d diamantes") % int(r.gems))
	if int(r.get("turboMinutes", 0)) > 0:
		var m := int(r.turboMinutes)
		parts.append(tr("Turbo 2× por %s") % ("%d h" % (m / 60) if m % 60 == 0 else "%d min" % m))
	return " · ".join(parts)


func open_daily_menu() -> void:
	close_sheet()
	_helper_cards.clear()
	_reward_cards.clear()
	_reward_kind = "daily"
	GameState.track("screen_view", {"screen": "diario"})
	_modal.open(tr("Prêmio diário"))
	var d := GameState.daily
	if d.is_empty():
		_modal.add_message(null, "", tr("Carregando…"))
		await GameState.refresh_daily()
		if _reward_kind == "daily" and _modal.visible:
			open_daily_menu()
		return
	_modal.add_message(null, "", tr("Entre todo dia para ganhar prêmios cada vez maiores. Faltou um dia, volta ao Dia 1."))
	for r in d.get("rewards", []):
		var day: int = int(r.day)
		_modal.add_store_card(func():
			var today := int(GameState.daily.get("day", 1))
			var claimed_today: bool = GameState.daily.get("claimedToday", false)
			var done := day < today or (day == today and claimed_today)
			var current := day == today and not claimed_today
			return {
				"title": tr("Dia %d") % day, "icon": _gem_tex if int(r.get("gems", 0)) > 0 else COIN_TEX,
				"subtitle": _reward_text(r),
				"button": tr("Pegar") if current else ("✓" if done else tr("Dia %d") % day),
				"color": Style.ORANGE if current else (Style.TEAL_LIGHT if done else Style.GREY),
				"edge": Style.ORANGE_DARK if current else (Style.TEAL_DARK if done else Style.GREY_DARK),
				"enabled": current,
			}, func():
				if await GameState.claim_daily():
					show_toast(tr("Dia %d: %s") % [day, _reward_text(r)])
				_modal.refresh_store_cards())
	_modal.refit()


func open_event_menu() -> void:
	close_sheet()
	_helper_cards.clear()
	_reward_cards.clear()
	_reward_kind = "event"
	GameState.track("screen_view", {"screen": "evento"})
	_modal.open(tr("Fim de semana em dobro"))
	var ev := GameState.weekend
	if not ev.get("active", false):
		_modal.add_message(null, "", tr("O evento acontece de sexta a domingo. Volte no fim de semana!"))
		return
	var ends := _iso_seconds(ev.endsAt) - _iso_seconds(ev.serverTime)
	_modal.add_message(Layout.texture("icon_map"), tr("Lucro 2× em %s") % Layout.title(str(ev.district)),
			tr("Todos os negócios de %s rendem o dobro até domingo.\nTermina em %s.") % [Layout.title(str(ev.district)), Fmt.duration(ends)])
	_modal.add_store_card(func():
		var e := GameState.weekend
		var claimed: bool = e.get("claimed", false)
		return {
			"title": tr("Meta: fature %s") % Fmt.coins(e.get("target", "0")), "icon": _gem_tex,
			"subtitle": tr("%s de %s · prêmio +%d diamantes") % [Fmt.coins(e.get("progress", "0")),
					Fmt.coins(e.get("target", "0")), int(e.get("prizeGems", 20))],
			"button": tr("Resgatado") if claimed else tr("Resgatar"),
			"color": Style.TEAL_LIGHT if claimed else Style.ORANGE,
			"edge": Style.TEAL_DARK if claimed else Style.ORANGE_DARK,
			"enabled": e.get("completed", false) and not claimed,
		}, func():
			if await GameState.claim_event():
				show_toast(tr("+%d diamantes!") % int(GameState.weekend.get("prizeGems", 20)))
			_modal.refresh_store_cards())
	if ev.district != current_district and GameState.district_unlocked(str(ev.district)):
		_modal.add_action(tr("Ir para %s") % Layout.title(str(ev.district)), func():
			_modal.close()
			district_requested.emit(str(ev.district)))
	_modal.refit()
	await GameState.refresh_event()
	_modal.refresh_store_cards()


func _open_rewards(kind: String) -> void:
	close_sheet()
	_helper_cards.clear()
	_reward_cards.clear()
	_reward_kind = kind
	GameState.track("screen_view", {"screen": kind})


## Título da missão no idioma do jogador: o servidor manda o modelo ("Fature {n} moedas") e o
## alvo; versões antigas do servidor só mandam o título pronto em pt-BR.
static func mission_title(m: Dictionary) -> String:
	if not m.has("titleTemplate"):
		return str(m.get("title", ""))
	return TranslationServer.translate(m.titleTemplate).replace("{n}", Fmt.coins(m.target))


func _mission_item(m: Dictionary) -> Dictionary:
	return {"title": mission_title(m), "progress": m.progress, "target": m.target, "rewardCoins": m.rewardCoins,
		"rewardGems": m.rewardGems, "done": m.completed, "claimed": m.claimed}


func _achievement_item(a: Dictionary) -> Dictionary:
	return {"title": tr(a.title), "subtitle": tr(a.description), "progress": a.progress, "target": a.target,
		"rewardGems": a.rewardGems, "done": a.unlocked, "claimed": a.claimed}


## Missões/conquistas mudaram: atualiza selos e, se a tela estiver aberta, os cartões no lugar.
func _sync_rewards() -> void:
	_sync_side()
	if _ranking_button:
		_ranking_button.badge = 0
	if _reward_cards.is_empty() or not _modal.visible:
		return
	if _reward_kind == "missions":
		# Virou o dia com a tela aberta: missões novas (ids novos) → monta a tela de novo.
		if GameState.missions.get("missions", []).any(func(m): return not _reward_cards.has(m.id)):
			open_missions_menu()
			return
		for m in GameState.missions.get("missions", []):
			if _reward_cards.has(m.id):
				_modal.set_reward_card(_reward_cards[m.id], _mission_item(m))
	elif _reward_kind == "achievements":
		for a in GameState.achievements:
			if _reward_cards.has(a.id):
				_modal.set_reward_card(_reward_cards[a.id], _achievement_item(a))


func _reset_text() -> String:
	var data: Dictionary = GameState.missions
	if not data.has("resetsAt"):
		return ""
	var left := _iso_seconds(data.resetsAt) - _iso_seconds(data.serverTime)
	return tr("Novas missões em %s.") % Fmt.duration(left)


## Segundos Unix de um ISO 8601 do servidor ("2026-01-02T03:00:00.000Z").
static func _iso_seconds(iso: String) -> float:
	return Time.get_unix_time_from_datetime_string(iso.substr(0, 19))


func _build_side_buttons() -> void:
	var col := VBoxContainer.new()
	col.position = Vector2(18, 232)
	col.add_theme_constant_override("separation", 6)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(col)
	_missions_button = _side_button(col, GlyphButton.Glyph.MISSIONS, Style.ORANGE, Style.ORANGE_DARK,
			tr("Missões"), open_missions_menu)
	_ranking_button = _side_button(col, GlyphButton.Glyph.TROPHY, Color("9b7bff"), Color("6a4fd1"),
			tr("Ranking"), open_ranking_menu)
	_daily_button = _side_button(col, GlyphButton.Glyph.CALENDAR, Style.TEAL_LIGHT, Style.TEAL_DARK,
			tr("Diário"), open_daily_menu)
	_event_button = _side_button(col, GlyphButton.Glyph.STAR, Style.RED, Style.RED_DARK,
			tr("Evento"), open_event_menu)
	_set_side_visible(_event_button, false)


func _side_button(parent: Control, glyph: int, color: Color, edge: Color, text_value: String,
		handler: Callable) -> Control:
	var b: Control = GlyphButton.new(glyph, color, edge, 76.0)
	b.pressed.connect(handler)
	parent.add_child(b)
	var label := Label.new()
	label.text = text_value
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.custom_minimum_size.x = 76
	label.add_theme_font_size_override("font_size", 20)
	label.add_theme_color_override("font_color", Color.WHITE)
	label.add_theme_color_override("font_outline_color", Style.TEAL_DARK)
	label.add_theme_constant_override("outline_size", 8)
	parent.add_child(label)
	b.set_meta("label", label)
	return b


func _set_side_visible(b: Control, show: bool) -> void:
	b.visible = show
	(b.get_meta("label") as Control).visible = show


# --- Pacotes promocionais (ADR 0024) -----------------------------------------

## Coluna à direita, espelhando a da esquerda (missões/ranking): ícones chamativos dos pacotes
## da semana/feriado com o tempo restante. Some quando a loja paga está desligada.
func _build_offer_column() -> void:
	_offer_col = VBoxContainer.new()
	_offer_col.anchor_left = 1.0
	_offer_col.anchor_right = 1.0
	_offer_col.offset_left = -108
	_offer_col.offset_right = -14
	_offer_col.offset_top = 232
	_offer_col.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_offer_col.alignment = BoxContainer.ALIGNMENT_BEGIN
	_offer_col.add_theme_constant_override("separation", 4)
	_offer_col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_offer_col)
	_status_turbo = _status_icon("status_turbo", tr("Turbo 2×"))
	_status_double = _status_icon("status_double", tr("Dobro de moedas"))
	_offers_box = VBoxContainer.new()
	_offers_box.add_theme_constant_override("separation", 4)
	_offers_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_offer_col.add_child(_offers_box)


## Ícone redondo de status no topo da coluna (toque abre a Loja); devolve o rótulo do tempo.
func _status_icon(texture: String, hint: String) -> Label:
	var row := VBoxContainer.new()
	row.add_theme_constant_override("separation", 0)
	row.visible = false
	row.tooltip_text = hint
	_offer_col.add_child(row)
	var button := TextureButton.new()
	button.texture_normal = Layout.texture(texture)
	button.ignore_texture_size = true
	button.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	button.custom_minimum_size = Vector2(94, 74)
	button.pressed.connect(open_store_menu)
	row.add_child(button)
	var label := Label.new()
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.custom_minimum_size.x = 94
	label.add_theme_font_size_override("font_size", 18)
	label.add_theme_color_override("font_color", Color.WHITE)
	label.add_theme_color_override("font_outline_color", Style.TEAL_DARK)
	label.add_theme_constant_override("outline_size", 8)
	row.add_child(label)
	return label


func _sync_offers() -> void:
	if _offer_col == null:
		return
	for c in _offers_box.get_children():
		c.queue_free()
	var list := GameState.offers().slice(0, MAX_OFFERS)
	for o in list:
		var offer: Dictionary = o
		var button := TextureButton.new()
		button.texture_normal = Layout.texture(str(offer.icon)) if ResourceLoader.exists("res://assets/optimized/%s.png" % offer.icon) else _gem_tex
		button.ignore_texture_size = true
		button.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
		button.custom_minimum_size = Vector2(88, 88)
		button.pivot_offset = Vector2(44, 44)
		button.pressed.connect(func(): open_offer_menu(offer))
		_offers_box.add_child(button)
		# Pulso discreto para chamar atenção sem poluir a tela.
		var tw := button.create_tween().set_loops()
		tw.tween_property(button, "scale", Vector2(1.06, 1.06), 0.7).set_trans(Tween.TRANS_SINE)
		tw.tween_property(button, "scale", Vector2.ONE, 0.7).set_trans(Tween.TRANS_SINE)
		var label := Label.new()
		label.text = _offer_badge(offer)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.custom_minimum_size.x = 94
		label.add_theme_font_size_override("font_size", 18)
		label.add_theme_color_override("font_color", Color.WHITE)
		label.add_theme_color_override("font_outline_color", Style.TEAL_DARK)
		label.add_theme_constant_override("outline_size", 8)
		_offers_box.add_child(label)


## Texto curto embaixo do ícone: tempo que falta ou "Novo!" (Kit Iniciante, sem prazo).
func _offer_badge(o: Dictionary) -> String:
	if o.get("endsAt") == null:
		return tr("Novo!")
	var left := _iso_seconds(str(o.endsAt)) - _iso_seconds(str(GameState.catalog.get("serverTime", o.endsAt)))
	return Fmt.duration(left) if left < 86400 else tr("%d dias") % int(ceil(left / 86400.0))


## Lista do que vem no pacote, uma linha por item.
func _offer_contents(o: Dictionary) -> String:
	var lines: Array[String] = [tr("+%s diamantes") % Fmt.coins(str(o.get("gems", "0")))]
	var ac := int(o.get("autoCollectHours", 0))
	if ac > 0:
		lines.append(tr("Auto-coleta por %s") % (tr("%d dias") % (ac / 24) if ac >= 48 else tr("%d horas") % ac))
	var tb := int(o.get("turboHours", 0))
	if tb > 0:
		lines.append(tr("Turbo 2× por %s") % (tr("%d dias") % (tb / 24) if tb >= 48 else tr("%d horas") % tb))
	var bh := int(o.get("boostHours", 0))
	if bh > 0:
		lines.append(tr("%d horas de produção na hora") % bh)
	return "\n".join(lines)


func open_offer_menu(o: Dictionary) -> void:
	close_sheet()
	_reward_kind = "offer"
	GameState.track("screen_view", {"screen": "oferta", "offer": str(o.get("id", ""))})
	_modal.open(tr(str(o.title)))
	var ends := tr("Compra única por conta.") if o.get("endsAt") == null else \
			tr("Disponível por mais %s · 1 compra nesta vitrine.") % _offer_badge(o)
	_modal.add_message(Layout.texture(str(o.icon)) if ResourceLoader.exists("res://assets/optimized/%s.png" % o.icon) else _gem_tex,
			"", _offer_contents(o) + "\n\n" + ends)
	_modal.add_store_card(func():
		return {
			"title": tr(str(o.title)), "icon": _gem_tex, "subtitle": (tr("Pagamento pela sua conta Google") if GameState.store_brand() == "google" else tr("Pagamento pela sua conta Apple")) if GameState.real_store() else tr("Pacote promocional"),
			"button": _price_label(o), "color": Style.GREEN, "edge": Style.GREEN_DARK, "enabled": true,
		}, func(): _buy_real_or_sandbox(o, false))
	_modal.refit()


## Selos: prêmio do dia esperando; evento ativo (com selo se a meta foi batida).
func _sync_side() -> void:
	if _daily_button:
		_daily_button.badge = 1 if not GameState.daily.is_empty() and not GameState.daily.get("claimedToday", true) else 0
	if _event_button:
		var ev := GameState.weekend
		_set_side_visible(_event_button, ev.get("active", false))
		_event_button.badge = 1 if ev.get("completed", false) and not ev.get("claimed", true) else 0
	if _missions_button:
		var chest: Dictionary = GameState.missions.get("chest", {})
		var chest_ready := 1 if chest.get("available", false) and not chest.get("claimed", true) else 0
		_missions_button.badge = GameState.claimable_missions() + chest_ready


# --- Construção da interface -------------------------------------------------

func _build_theme() -> Theme:
	var t := Theme.new()
	t.default_font = UiFont.bold()
	t.default_font_size = 30
	t.set_color("font_color", "Label", Style.INK)
	t.set_stylebox("panel", "PanelContainer", Style.box(Style.CREAM, 36, Style.TEAL, 5))
	t.set_stylebox("normal", "Button", Style.toy_button(Style.GREEN, Style.GREEN_DARK))
	t.set_stylebox("hover", "Button", Style.toy_button(Style.GREEN.lightened(0.05), Style.GREEN_DARK))
	t.set_stylebox("pressed", "Button", Style.toy_button(Style.GREEN, Style.GREEN_DARK, 26, true))
	t.set_stylebox("disabled", "Button", Style.toy_button(Style.GREY, Style.GREY_DARK))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	for c in ["font_color", "font_pressed_color", "font_hover_color", "font_focus_color"]:
		t.set_color(c, "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", Color(1, 1, 1, 0.9))
	t.set_color("font_outline_color", "Button", Color(0, 0, 0, 0.25))
	t.set_constant("outline_size", "Button", 4)

	var bar_bg := Style.box(Color(0, 0, 0, 0.18), 12, Color.TRANSPARENT, 0, false)
	var bar_fill := Style.box(Color("ffd34d"), 12, Color.TRANSPARENT, 0, false)
	bar_bg.set_content_margin_all(0)
	bar_fill.set_content_margin_all(0)
	t.set_stylebox("background", "ProgressBar", bar_bg)
	t.set_stylebox("fill", "ProgressBar", bar_fill)
	return t


func _icon_button(icon_name: String, size: int, handler: Callable) -> TextureButton:
	var b := TextureButton.new()
	b.texture_normal = Layout.texture(icon_name)
	b.ignore_texture_size = true
	b.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	b.custom_minimum_size = Vector2(size, size)
	b.pivot_offset = Vector2(size, size) / 2
	b.button_down.connect(func(): b.scale = Vector2.ONE * 0.9)
	b.button_up.connect(func(): b.scale = Vector2.ONE)
	b.pressed.connect(handler)
	return b


func _build_top() -> void:
	var col := VBoxContainer.new()
	col.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE, Control.PRESET_MODE_MINSIZE, 20)
	col.offset_top = 28
	col.add_theme_constant_override("separation", 10)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(col)

	var card := PanelContainer.new()
	col.add_child(card)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	card.add_child(row)
	var avatar := TextureRect.new()
	avatar.texture = Layout.texture("icon_profile")
	avatar.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	avatar.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	avatar.custom_minimum_size = Vector2(72, 72)
	row.add_child(avatar)
	var titles := VBoxContainer.new()
	titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	titles.alignment = BoxContainer.ALIGNMENT_CENTER
	titles.add_theme_constant_override("separation", -6)
	row.add_child(titles)
	var title := Label.new()
	title.text = tr("Império de Bolso")
	title.add_theme_font_size_override("font_size", 36)
	title.add_theme_color_override("font_color", Style.TEAL_DARK)
	titles.add_child(title)
	_district_label = Label.new()
	_district_label.add_theme_font_size_override("font_size", 22)
	_district_label.add_theme_color_override("font_color", Style.INK_SOFT)
	titles.add_child(_district_label)
	row.add_child(_icon_button("icon_help", 68, func(): show_toast(
			tr("Compre negócios, toque na moeda para coletar e melhore para lucrar mais!"))))
	row.add_child(_icon_button("icon_settings", 68, open_settings_menu))

	var money := HBoxContainer.new()
	money.add_theme_constant_override("separation", 12)
	money.mouse_filter = Control.MOUSE_FILTER_IGNORE
	col.add_child(money)
	money.add_child(_money_pill(true))
	money.add_child(_gems_pill())
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	money.add_child(spacer)
	money.add_child(_money_pill(false))


func _gems_pill() -> PanelContainer:
	var pill := PanelContainer.new()
	pill.add_theme_stylebox_override("panel", Style.box(Color("e3f6ff"), 32, Color("2bb6e0"), 4))
	# Tocar nos diamantes abre a Loja.
	pill.mouse_filter = Control.MOUSE_FILTER_STOP
	pill.gui_input.connect(func(e):
		if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
			open_store_menu())
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	pill.add_child(row)
	var gem := TextureRect.new()
	gem.texture = GlyphButton.gem_texture()
	gem.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	gem.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	gem.custom_minimum_size = Vector2(34, 34)
	row.add_child(gem)
	_gems_label = Label.new()
	_gems_label.add_theme_font_size_override("font_size", 30)
	_gems_label.add_theme_color_override("font_color", Color("1f7fa8"))
	_gems_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(_gems_label)
	return pill


func _money_pill(is_coins: bool) -> PanelContainer:
	var pill := PanelContainer.new()
	pill.add_theme_stylebox_override("panel", Style.box(Style.CREAM if is_coins else Color("d9f7c8"), 32,
			Style.ORANGE if is_coins else Style.GREEN, 4))
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	pill.add_child(row)
	var coin := TextureRect.new()
	coin.texture = Layout.texture("icon_coin")
	coin.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	coin.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	coin.custom_minimum_size = Vector2(52, 52) if is_coins else Vector2(36, 36)
	row.add_child(coin)
	var label := Label.new()
	label.add_theme_font_size_override("font_size", 44 if is_coins else 30)
	label.add_theme_color_override("font_color", Color("8a4b00") if is_coins else Color("1f7a3f"))
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.custom_minimum_size.x = 150 if is_coins else 0
	row.add_child(label)
	if is_coins:
		_coins_label = label
	else:
		_rate_label = label
	return pill


func _build_bottom_bar() -> void:
	var bar := PanelContainer.new()
	bar.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE, Control.PRESET_MODE_MINSIZE, 20)
	bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bar.offset_bottom = -26
	add_child(bar)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 4)
	bar.add_child(row)
	for item in [
		["icon_build", tr("Construir"), open_build_menu],
		["icon_helpers", tr("Ajudantes"), open_helpers_menu],
		["icon_shop", tr("Loja"), open_store_menu],
		["icon_map", tr("Mapa"), open_map_menu],
		["icon_profile", tr("Perfil"), open_profile_menu],
	]:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 2)
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(col)
		var btn := _icon_button(item[0], 84, item[2])
		btn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		col.add_child(btn)
		if item[0] == "icon_helpers":
			_helpers_button = btn
		var label := Label.new()
		label.text = item[1]
		label.add_theme_font_size_override("font_size", 22)
		label.add_theme_color_override("font_color", Style.TEAL_DARK)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(label)


func _build_sheet() -> void:
	_sheet = PanelContainer.new()
	_sheet.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE, Control.PRESET_MODE_MINSIZE, 20)
	_sheet.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_sheet.offset_bottom = -200
	_sheet.visible = false
	add_child(_sheet)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	_sheet.add_child(col)

	var head := HBoxContainer.new()
	col.add_child(head)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 38)
	_title.add_theme_color_override("font_color", Style.TEAL_DARK)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_title.clip_text = true
	_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	head.add_child(_title)
	head.add_child(Style.close_button(close_sheet))

	_info = Label.new()
	_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_info.add_theme_font_size_override("font_size", 28)
	_info.add_theme_font_override("font", UiFont.weight(500))
	col.add_child(_info)
	_progress = ProgressBar.new()
	_progress.custom_minimum_size.y = 24
	_progress.show_percentage = false
	col.add_child(_progress)

	var buttons := HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 14)
	col.add_child(buttons)
	_collect_button = _make_button(buttons, _on_collect_pressed)
	Style.style_button(_collect_button, Style.ORANGE, Style.ORANGE_DARK)
	_action_button = _make_button(buttons, _on_action_pressed)
	_hire_button = _make_button(col, _on_hire_pressed)
	Style.style_button(_hire_button, Style.TEAL_LIGHT, Style.TEAL_DARK)


func _make_button(parent: Control, handler: Callable) -> Button:
	var b := Button.new()
	b.custom_minimum_size.y = Style.MIN_TOUCH
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.add_theme_font_size_override("font_size", 32)
	# Texto longo nunca alarga o painel para fora da tela (pedido do titular): corta com "…".
	b.clip_text = true
	b.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	b.pressed.connect(handler)
	parent.add_child(b)
	return b


func _build_toast() -> void:
	_toast = Label.new()
	_toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_toast.offset_top = 300
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.custom_minimum_size.x = 640
	_toast.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.add_theme_color_override("font_color", Color.WHITE)
	_toast.add_theme_color_override("font_outline_color", Style.TEAL_DARK)
	_toast.add_theme_constant_override("outline_size", 12)
	_toast.visible = false
	add_child(_toast)
	_toast_timer = Timer.new()
	_toast_timer.one_shot = true
	_toast_timer.timeout.connect(func(): _toast.visible = false)
	add_child(_toast_timer)


func _build_offline_pill() -> void:
	_offline_pill = PanelContainer.new()
	_offline_pill.add_theme_stylebox_override("panel", Style.box(Style.RED, 30, Style.RED_DARK, 4))
	_offline_pill.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_offline_pill.offset_top = 230
	_offline_pill.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_offline_pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_offline_pill.visible = false
	var label := Label.new()
	label.text = tr("Sem conexão · reconectando…")
	label.add_theme_color_override("font_color", Color.WHITE)
	label.add_theme_font_size_override("font_size", 26)
	_offline_pill.add_child(label)
	add_child(_offline_pill)


func _build_fader() -> void:
	_fader = ColorRect.new()
	_fader.color = Color("0c6f6b")
	_fader.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fader.modulate.a = 0.0
	_fader.visible = false
	add_child(_fader)


func _build_overlay() -> void:
	_overlay = ColorRect.new()
	_overlay.color = Color("0c8a85")
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_overlay)
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER, Control.PRESET_MODE_MINSIZE)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.add_theme_constant_override("separation", 24)
	_overlay.add_child(box)
	var logo := TextureRect.new()
	logo.texture = Layout.texture("water_cart_lv1")
	logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo.custom_minimum_size = Vector2(200, 260)
	box.add_child(logo)
	var title := Label.new()
	title.text = tr("Império de Bolso")
	title.add_theme_font_size_override("font_size", 56)
	title.add_theme_color_override("font_color", Color.WHITE)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	_overlay_label = Label.new()
	_overlay_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_overlay_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.9))
	box.add_child(_overlay_label)
	_retry_button = Button.new()
	_retry_button.text = tr("Tentar novamente")
	_retry_button.custom_minimum_size = Vector2(360, Style.MIN_TOUCH)
	_retry_button.pressed.connect(func(): retry_requested.emit())
	box.add_child(_retry_button)
