## Planta dos distritos (direção visual v2 — docs/ADRs/0004-direcao-visual-v2.md).
## Coordenadas na resolução base 720×1280, medidas sobre os cenários em assets/optimized/.
## Cada posição de lote é o ponto de apoio (centro da base) do negócio no chão.
extends RefCounted

## Os sprites ficam em 2× o tamanho de exibição; negócios um pouco maiores para lerem bem
## no celular (como no mockup aprovado).
const ART_SCALE := 0.5
const BUILDING_SCALE := 0.6

## Ordem de desbloqueio igual à do servidor (backend/src/economy/districts.ts).
const DISTRICT_ORDER := ["praia", "cidade", "porto", "centro", "industrial", "serra", "ilha", "espaco"]

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
			# Ilha de expansão (mapas maiores, 2026-10-15).
			"padaria": Vector2(501, 1455),
			"farmacia": Vector2(365, 1546),
			"cinema": Vector2(228, 1639),
		},
		"expansion": {"base": "cidade_expansao.png", "y": 1080, "sea_color": Color("0273a2")},
		"pan": true,
		"world_height": 1950,
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
		# Lotes = ponto de apoio do prédio (base), perto da borda de baixo de cada quadra — no
		# centro da quadra o prédio "subia" para a rua/cais (pedido do titular).
		"base": "porto_base.jpg",
		"top_color": Color("006ea1"),
		"bottom_color": Color("006291"),
		"camera_center": Vector2(360, 690),
		"zoom": 1.0,
		"char_scale": 0.42,
		"lots": {
			"peixaria": Vector2(378, 578),
			"loja_surf": Vector2(212, 668),
			"frutos_mar": Vector2(560, 700),
			"marina": Vector2(387, 805),
			"estaleiro": Vector2(165, 855),
			"terminal": Vector2(565, 878),
			# Ilha de expansão (mapas maiores, 2026-10-15).
			"feira_porto": Vector2(506, 1404),
			"clube_nautico": Vector2(376, 1504),
			"farol": Vector2(236, 1604),
		},
		"expansion": {"base": "porto_expansao.png", "y": 1080, "sea_color": Color("016697")},
		"pan": true,
		"world_height": 1950,
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
			"joalheria": Vector2(375, 578),
			"banco": Vector2(205, 680),
			"torre": Vector2(562, 712),
			"convencoes": Vector2(160, 866),
			"estadio": Vector2(575, 900),
			"aeroporto": Vector2(347, 998),
			# Ilha de expansão (mapas maiores, 2026-10-15).
			"hospital": Vector2(491, 1421),
			"universidade": Vector2(370, 1503),
			"bolsa_valores": Vector2(243, 1588),
		},
		"expansion": {"base": "centro_expansao.png", "y": 1080, "sea_color": Color("01537e")},
		"pan": true,
		"world_height": 1950,
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
	# Mapas 5–8 (2026-10-14): base de cada prédio na borda de baixo da quadra.
	"industrial": {
		"title": "Polo Industrial",
		"base": "industrial_base.jpg",
		"top_color": Color("1e88cb"),
		"bottom_color": Color("014572"),
		"camera_center": Vector2(360, 690),
		"zoom": 1.0,
		"char_scale": 0.42,
		"lots": {
			"oficina": Vector2(380, 530),
			"moveis": Vector2(210, 660),
			"metalurgica": Vector2(580, 878),
			"montadora": Vector2(390, 800),
			"refinaria": Vector2(160, 862),
			"usina_solar": Vector2(350, 995),
			# Ilha de expansão (mapas maiores, 2026-10-15).
			"fabrica_brinquedos": Vector2(517, 1402),
			"centro_logistica": Vector2(374, 1505),
			"parque_eolico": Vector2(230, 1592),
		},
		"expansion": {"base": "industrial_expansao.png", "y": 1080, "sea_color": Color("025087")},
		"pan": true,
		"world_height": 1950,
		# Pessoas andam pelas ruas do molde de quadras (cruzamentos e calçadas).
		"waypoints": [
			Vector2(300, 470), Vector2(455, 470), Vector2(368, 588), Vector2(110, 690),
			Vector2(200, 705), Vector2(545, 722), Vector2(660, 690), Vector2(395, 852),
			Vector2(250, 950), Vector2(520, 965), Vector2(610, 815), Vector2(150, 640),
		],
		"decor": [],
		"walkers": ["char_tourist", "char_woman", "char_boy", "char_grandma", "char_kid"],
		"helper_offset": Vector2(-100, 6),
		"trail_center": 0.5,
	},
	"serra": {
		"title": "Serra Nevada",
		"base": "serra_base.jpg",
		"top_color": Color("379de1"),
		"bottom_color": Color("087cb0"),
		"camera_center": Vector2(360, 690),
		"zoom": 1.0,
		"char_scale": 0.42,
		"lots": {
			"chocolateria": Vector2(380, 548),
			"pousada": Vector2(212, 668),
			"aluguel_esqui": Vector2(565, 730),
			"teleferico": Vector2(158, 875),
			"spa_termal": Vector2(575, 895),
			"estacao_esqui": Vector2(350, 1010),
			# Ilha de expansão (mapas maiores, 2026-10-15).
			"queijaria": Vector2(499, 1446),
			"vinicola": Vector2(372, 1534),
			"pista_patinacao": Vector2(238, 1625),
		},
		"expansion": {"base": "serra_expansao.png", "y": 1080, "sea_color": Color("0778b6")},
		"pan": true,
		"world_height": 1950,
		# Pessoas andam pelas ruas do molde de quadras (cruzamentos e calçadas).
		"waypoints": [
			Vector2(300, 470), Vector2(455, 470), Vector2(368, 588), Vector2(110, 690),
			Vector2(200, 705), Vector2(545, 722), Vector2(660, 690), Vector2(395, 852),
			Vector2(250, 950), Vector2(520, 965), Vector2(610, 815), Vector2(150, 640),
		],
		"decor": [],
		"walkers": ["char_tourist", "char_woman", "char_boy", "char_grandma", "char_kid"],
		"helper_offset": Vector2(-100, 6),
		"trail_center": 0.5,
	},
	"ilha": {
		"title": "Ilha Paraíso",
		"base": "ilha_base.jpg",
		"top_color": Color("0978c3"),
		"bottom_color": Color("025e83"),
		"camera_center": Vector2(360, 690),
		"zoom": 1.0,
		"char_scale": 0.42,
		"lots": {
			"escola_mergulho": Vector2(372, 525),
			"bangalos": Vector2(207, 660),
			"parque_aquatico": Vector2(565, 700),
			"clube_golfe": Vector2(387, 795),
			"heliponto": Vector2(157, 850),
			"resort": Vector2(350, 975),
			# Ilha de expansão (mapas maiores, 2026-10-15).
			"mercado_artesanato": Vector2(484, 1430),
			"aquario": Vector2(376, 1496),
			"hotel_flutuante": Vector2(266, 1584),
		},
		"expansion": {"base": "ilha_expansao.png", "y": 1080, "sea_color": Color("005897")},
		"pan": true,
		"world_height": 1950,
		# Pessoas andam pelas ruas do molde de quadras (cruzamentos e calçadas).
		"waypoints": [
			Vector2(300, 470), Vector2(455, 470), Vector2(368, 588), Vector2(110, 690),
			Vector2(200, 705), Vector2(545, 722), Vector2(660, 690), Vector2(395, 852),
			Vector2(250, 950), Vector2(520, 965), Vector2(610, 815), Vector2(150, 640),
		],
		"decor": [],
		"walkers": ["char_tourist", "char_woman", "char_boy", "char_grandma", "char_kid"],
		"helper_offset": Vector2(-100, 6),
		"trail_center": 0.5,
	},
	"espaco": {
		"title": "Centro Espacial",
		"base": "espaco_base.jpg",
		"top_color": Color("006b9b"),
		"bottom_color": Color("052615"),
		"camera_center": Vector2(360, 690),
		"zoom": 1.0,
		"char_scale": 0.42,
		"lots": {
			"observatorio": Vector2(380, 545),
			"museu_espaco": Vector2(212, 668),
			"fabrica_satelites": Vector2(565, 715),
			"centro_controle": Vector2(390, 795),
			"foguete": Vector2(157, 870),
			"porto_espacial": Vector2(350, 995),
			# Ilha de expansão (mapas maiores, 2026-10-15).
			"escola_astronautas": Vector2(470, 1457),
			"laboratorio_robos": Vector2(362, 1525),
			"elevador_espacial": Vector2(255, 1592),
		},
		"expansion": {"base": "espaco_expansao.png", "y": 1080, "sea_color": Color("0071a5")},
		"pan": true,
		"world_height": 1950,
		# Pessoas andam pelas ruas do molde de quadras (cruzamentos e calçadas).
		"waypoints": [
			Vector2(300, 470), Vector2(455, 470), Vector2(368, 588), Vector2(110, 690),
			Vector2(200, 705), Vector2(545, 722), Vector2(660, 690), Vector2(395, 852),
			Vector2(250, 950), Vector2(520, 965), Vector2(610, 815), Vector2(150, 640),
		],
		"decor": [],
		"walkers": ["char_tourist", "char_woman", "char_boy", "char_grandma", "char_kid"],
		"helper_offset": Vector2(-100, 6),
		"trail_center": 0.5,
	},
}

## Retrato do ajudante de cada negócio (folhas g_helpers_praia/g_helpers_cidade).
static func helper_texture_name(slug: String) -> String:
	return "helper_%s" % slug


## Faixas de nível visual: 1–9 → arte 1, 10–24 → 2, 25–49 → 3, 50–99 → 4, 100 → 5
## (evoluções 4 e 5 pedidas pelo titular em 2026-10-15).
const VISUAL_TIERS := [1, 10, 25, 50, 100]

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
	"oficina": "oficina",
	"moveis": "moveis",
	"metalurgica": "metalurgica",
	"montadora": "montadora",
	"refinaria": "refinaria",
	"usina_solar": "usina_solar",
	"chocolateria": "chocolateria",
	"pousada": "pousada",
	"aluguel_esqui": "aluguel_esqui",
	"teleferico": "teleferico",
	"spa_termal": "spa_termal",
	"estacao_esqui": "estacao_esqui",
	"escola_mergulho": "escola_mergulho",
	"bangalos": "bangalos",
	"parque_aquatico": "parque_aquatico",
	"clube_golfe": "clube_golfe",
	"heliponto": "heliponto",
	"resort": "resort",
	"observatorio": "observatorio",
	"museu_espaco": "museu_espaco",
	"fabrica_satelites": "fabrica_satelites",
	"centro_controle": "centro_controle",
	"foguete": "foguete",
	"porto_espacial": "porto_espacial",
	# Mapas maiores (2026-10-15): 3 negócios novos por mapa.
	"padaria": "padaria",
	"farmacia": "farmacia",
	"cinema": "cinema",
	"feira_porto": "feira_porto",
	"clube_nautico": "clube_nautico",
	"farol": "farol",
	"hospital": "hospital",
	"universidade": "universidade",
	"bolsa_valores": "bolsa_valores",
	"fabrica_brinquedos": "fabrica_brinquedos",
	"centro_logistica": "centro_logistica",
	"parque_eolico": "parque_eolico",
	"queijaria": "queijaria",
	"vinicola": "vinicola",
	"pista_patinacao": "pista_patinacao",
	"mercado_artesanato": "mercado_artesanato",
	"aquario": "aquario",
	"hotel_flutuante": "hotel_flutuante",
	"escola_astronautas": "escola_astronautas",
	"laboratorio_robos": "laboratorio_robos",
	"elevador_espacial": "elevador_espacial",
}


## Índice 1..5 da arte para o nível do negócio.
static func visual_tier(level: int) -> int:
	var tier := 1
	for i in VISUAL_TIERS.size():
		if level >= VISUAL_TIERS[i]:
			tier = i + 1
	return tier


static func art_path(slug: String, level: int) -> String:
	if not BUSINESS_ART.has(slug):
		return ""
	# Sem a arte da faixa (negócio novo ainda sem todas as evoluções), usa a anterior.
	for tier in range(visual_tier(level), 0, -1):
		var path := "res://assets/optimized/%s_lv%d.png" % [BUSINESS_ART[slug], tier]
		if tier == 1 or ResourceLoader.exists(path):
			return path
	return ""


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
	var short: Dictionary = {"praia": "a praia", "cidade": "a cidade", "porto": "o porto", "centro": "o centro",
		"industrial": "o polo industrial", "serra": "a serra", "ilha": "a ilha", "espaco": "o centro espacial"}
	return TranslationServer.translate(short[district]) if short.has(district) else title(district)


static func title(district: String) -> String:
	return TranslationServer.translate(DISTRICTS[district].title) if DISTRICTS.has(district) else district
