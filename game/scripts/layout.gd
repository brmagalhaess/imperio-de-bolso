## Planta dos distritos (direção visual v2 — docs/ADRs/0004-direcao-visual-v2.md).
## Coordenadas na resolução base 720×1280, medidas sobre os cenários em assets/optimized/.
## Cada posição de lote é o ponto de apoio (centro da base) do negócio no chão.
extends RefCounted

## Os sprites ficam em 2× o tamanho de exibição; negócios um pouco maiores para lerem bem
## no celular (como no mockup aprovado).
const ART_SCALE := 0.5
const BUILDING_SCALE := 0.6

## Ordem de desbloqueio igual à do servidor (backend/src/economy/districts.ts).
const DISTRICT_ORDER := ["praia", "cidade", "porto", "centro"]

const DISTRICTS := {
	"praia": {
		"title": "Ilha da Praia",
		"base": "island_base.jpg",
		"top_color": Color("017272"),
		"bottom_color": Color("017272"),
		"camera_center": Vector2(370, 615),
		"zoom": 1.12,
		"char_scale": 0.6,
		"lots": {
			"agua": Vector2(250, 560),
			"pipoca": Vector2(490, 545),
			"sorveteria": Vector2(235, 845),
			"quiosque_coco": Vector2(505, 840),
		},
		"waypoints": [
			Vector2(330, 470), Vector2(420, 455), Vector2(370, 600), Vector2(290, 700),
			Vector2(520, 690), Vector2(410, 790), Vector2(340, 880), Vector2(560, 640),
			Vector2(200, 700), Vector2(450, 900), Vector2(600, 760), Vector2(380, 520),
		],
		"decor": [["beach_umbrella", Vector2(175, 790)], ["beach_umbrella", Vector2(600, 905)]],
		"walkers": ["char_woman", "char_boy", "char_grandma", "char_tourist", "char_kid"],
		## Onde o ajudante contratado fica em pé, relativo ao lote.
		"helper_offset": Vector2(-80, 16),
		"trail_center": 0.5,
	},
	"cidade": {
		"title": "Cidade",
		"base": "city_base.jpg",
		"top_color": Color("006f9a"),
		"bottom_color": Color("082b17"),
		"camera_center": Vector2(360, 690),
		"zoom": 1.0,
		"char_scale": 0.42,
		"lots": {
			"mercadinho": Vector2(205, 655),
			"restaurante": Vector2(560, 685),
			"supermercado": Vector2(390, 760),
			"academia": Vector2(155, 835),
			"hotel": Vector2(560, 855),
			"shopping": Vector2(345, 950),
		},
		"waypoints": [
			Vector2(300, 470), Vector2(355, 568), Vector2(420, 598), Vector2(250, 668),
			Vector2(170, 706), Vector2(470, 742), Vector2(560, 748), Vector2(410, 818),
			Vector2(285, 850), Vector2(520, 885), Vector2(110, 700), Vector2(620, 610),
		],
		"decor": [],
		"walkers": ["char_tourist", "char_grandma", "char_woman", "char_boy", "char_kid"],
		"helper_offset": Vector2(-100, 6),
		## Recorte da cena usado na trilha de mapas (centro vertical, fração da altura).
		"trail_center": 0.53,
	},
	# Porto e Centro: cenas editadas a partir da cidade (mesma malha de ruas e lotes).
	"porto": {
		"title": "Porto da Marina",
		"base": "porto_base.jpg",
		"top_color": Color("006ea1"),
		"bottom_color": Color("006291"),
		"camera_center": Vector2(360, 690),
		"zoom": 1.0,
		"char_scale": 0.42,
		"lots": {
			"peixaria": Vector2(376, 530),
			"loja_surf": Vector2(209, 620),
			"frutos_mar": Vector2(563, 640),
			"marina": Vector2(387, 725),
			"estaleiro": Vector2(165, 805),
			"terminal": Vector2(565, 830),
		},
		"waypoints": [
			Vector2(300, 470), Vector2(355, 568), Vector2(420, 598), Vector2(250, 668),
			Vector2(170, 706), Vector2(470, 742), Vector2(560, 748), Vector2(410, 818),
			Vector2(285, 850), Vector2(520, 885), Vector2(110, 700), Vector2(620, 610),
		],
		"decor": [],
		"walkers": ["char_tourist", "char_woman", "char_boy", "char_grandma", "char_kid"],
		"helper_offset": Vector2(-100, 6),
		"trail_center": 0.5,
	},
	"centro": {
		"title": "Centro Financeiro",
		"base": "centro_base.jpg",
		"top_color": Color("0178b0"),
		"bottom_color": Color("053420"),
		"camera_center": Vector2(360, 690),
		"zoom": 1.0,
		"char_scale": 0.42,
		"lots": {
			"joalheria": Vector2(373, 532),
			"banco": Vector2(200, 632),
			"torre": Vector2(560, 665),
			"convencoes": Vector2(158, 805),
			"estadio": Vector2(578, 845),
			"aeroporto": Vector2(347, 952),
		},
		"waypoints": [
			Vector2(300, 470), Vector2(355, 568), Vector2(420, 598), Vector2(250, 668),
			Vector2(170, 706), Vector2(470, 742), Vector2(560, 748), Vector2(410, 818),
			Vector2(285, 850), Vector2(520, 885), Vector2(110, 700), Vector2(620, 610),
		],
		"decor": [],
		"walkers": ["char_woman", "char_tourist", "char_boy", "char_grandma", "char_kid"],
		"helper_offset": Vector2(-100, 6),
		"trail_center": 0.47,
	},
}

## Retrato do ajudante de cada negócio (folhas g_helpers_praia/g_helpers_cidade).
static func helper_texture_name(slug: String) -> String:
	return "helper_%s" % slug


## Faixas de nível visual: nível 1–9 → arte 1, 10–24 → arte 2, 25+ → arte 3.
const VISUAL_TIERS := [1, 10, 25]

const BUSINESS_ART := {
	"agua": "water_cart",
	"pipoca": "popcorn_cart",
	"sorveteria": "icecream_cart",
	"quiosque_coco": "coconut_kiosk",
	"mercadinho": "market",
	"restaurante": "restaurant",
	"supermercado": "supermarket",
	"academia": "gym",
	"hotel": "hotel",
	"shopping": "mall",
	"peixaria": "peixaria",
	"loja_surf": "loja_surf",
	"frutos_mar": "frutos_mar",
	"marina": "marina",
	"estaleiro": "estaleiro",
	"terminal": "terminal",
	"joalheria": "joalheria",
	"banco": "banco",
	"torre": "torre",
	"convencoes": "convencoes",
	"estadio": "estadio",
	"aeroporto": "aeroporto",
}


## Índice 1..3 da arte para o nível do negócio.
static func visual_tier(level: int) -> int:
	var tier := 1
	for i in VISUAL_TIERS.size():
		if level >= VISUAL_TIERS[i]:
			tier = i + 1
	return tier


static func art_path(slug: String, level: int) -> String:
	if not BUSINESS_ART.has(slug):
		return ""
	return "res://assets/optimized/%s_lv%d.png" % [BUSINESS_ART[slug], visual_tier(level)]


static func texture(name: String) -> Texture2D:
	return load("res://assets/optimized/%s.png" % name)


## Distrito em que o negócio fica no mapa ("" se não tiver lote).
static func district_of(slug: String) -> String:
	for id in DISTRICTS:
		if DISTRICTS[id].lots.has(slug):
			return id
	return ""


## Mapa anterior na ordem de desbloqueio ("" para o primeiro).
static func previous_district(district: String) -> String:
	var i := DISTRICT_ORDER.find(district)
	return DISTRICT_ORDER[i - 1] if i > 0 else ""


## Nome curto para etiquetas pequenas ("a praia", "a cidade", "o porto", "o centro").
static func short_title(district: String) -> String:
	var short: Dictionary = {"praia": "a praia", "cidade": "a cidade", "porto": "o porto", "centro": "o centro"}
	return TranslationServer.translate(short[district]) if short.has(district) else title(district)


static func title(district: String) -> String:
	return TranslationServer.translate(DISTRICTS[district].title) if DISTRICTS.has(district) else district
