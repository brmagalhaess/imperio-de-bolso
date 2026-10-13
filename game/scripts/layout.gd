## Planta da Ilha da Praia (direção visual v2 — docs/ADRs/0004-direcao-visual-v2.md).
## Coordenadas na resolução base 720×1280, medidas sobre assets/optimized/island_base.jpg.
## Cada posição de lote é o ponto de apoio (centro da base) do negócio na areia.
extends RefCounted

const SEA_COLOR := Color("017272")
## Os sprites ficam em 2× o tamanho de exibição; negócios e pessoas um pouco maiores
## para lerem bem no celular (como no mockup aprovado).
const ART_SCALE := 0.5
const BUILDING_SCALE := 0.6
const CHAR_SCALE := 0.6
## Câmera: centro e zoom que fazem a ilha ocupar a tela.
const CAMERA_CENTER := Vector2(370, 615)
const CAMERA_ZOOM := 1.12

## Negócios da ilha, na ordem do catálogo.
const ISLAND_LOTS := {
	"agua": Vector2(250, 560),
	"pipoca": Vector2(490, 545),
	"sorveteria": Vector2(235, 845),
	"quiosque_coco": Vector2(505, 840),
}

## Faixas de nível visual: nível 1–9 → arte 1, 10–24 → arte 2, 25+ → arte 3.
const VISUAL_TIERS := [1, 10, 25]

const BUSINESS_ART := {
	"agua": "water_cart",
	"pipoca": "popcorn_cart",
	"sorveteria": "icecream_cart",
	"quiosque_coco": "coconut_kiosk",
}

## Pontos de passeio dos clientes na areia (longe dos lotes e da água).
const WAYPOINTS := [
	Vector2(330, 470), Vector2(420, 455), Vector2(370, 600), Vector2(290, 700),
	Vector2(520, 690), Vector2(410, 790), Vector2(340, 880), Vector2(560, 640),
	Vector2(200, 700), Vector2(450, 900), Vector2(600, 760), Vector2(380, 520),
]

## Decoração fixa: [textura, posição].
const DECOR := [
	["beach_umbrella", Vector2(175, 790)],
	["beach_umbrella", Vector2(600, 905)],
]

const WALKERS := ["char_woman", "char_boy", "char_grandma", "char_tourist", "char_kid"]


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


static func is_island(slug: String) -> bool:
	return ISLAND_LOTS.has(slug)
