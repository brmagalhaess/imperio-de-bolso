## Planta dos distritos (direção visual v2 — docs/ADRs/0004-direcao-visual-v2.md).
## Coordenadas na resolução base 720×1280, medidas sobre os cenários em assets/optimized/.
## Cada posição de lote é o ponto de apoio (centro da base) do negócio no chão.
extends RefCounted

## Os sprites ficam em 2× o tamanho de exibição; negócios um pouco maiores para lerem bem
## no celular (como no mockup aprovado).
const ART_SCALE := 0.5
const BUILDING_SCALE := 0.6

## Ordem de desbloqueio igual à do servidor (backend/src/economy/districts.ts).
const DISTRICT_ORDER := ["praia", "cidade"]

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
		## Vendedor fixo ao lado deste negócio, quando comprado.
		"vendor": ["agua", Vector2(-78, 16)],
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
		"vendor": [],
	},
}

## Retrato do ajudante de cada negócio (personagens da arte v2; arte própria por negócio: a fazer).
const HELPERS := {
	"agua": "char_vendor",
	"pipoca": "char_boy",
	"sorveteria": "char_kid",
	"quiosque_coco": "char_grandma",
	"mercadinho": "char_woman",
	"restaurante": "char_tourist",
	"supermercado": "char_vendor",
	"academia": "char_boy",
	"hotel": "char_woman",
	"shopping": "char_tourist",
}

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


static func title(district: String) -> String:
	return DISTRICTS[district].title if DISTRICTS.has(district) else district
