"""Monta os lotes v8 (20 mapas, ADR 0034): folhas de evolução, cenários e ilhas de expansão."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from descricoes import DESC, SPACE

ROOT = Path(__file__).resolve().parents[3]
R = json.load(open(ROOT / "tools/art/jobs/v8-refs.json"))
CAT = json.load(open("/tmp/claude-501/catalog_new.json"))
M = "xai/grok-imagine-image-2.0"
NO = "No people, no cars, no text, no letters, no numbers, no logos, no flags, no UI."

def sheet(slug, district):
    space = district in SPACE or district == "espaco"
    return {"id": f"g8_{slug}_lv", "model": M, "variations": 1, "input": {"prompt":
        "Use the exact art style of the reference image (a row of five upgrade levels of one building: glossy cartoon mobile city-builder, saturated colors, chunky rounded shapes, soft outlines), the same isometric camera angle and the same square light-gray sidewalk base. "
        f"Draw ONE horizontal row of FIVE separate versions of the SAME business: {DESC[slug]}. From left to right they are its upgrade levels 1 to 5: level 1 is a small humble starter version and each next level is clearly bigger, taller, richer and more detailed, level 5 is a spectacular luxurious landmark. Keep the same identity and main colors in all five so it is clearly the same business. All five stand on the same baseline, evenly spaced, with wide empty white space between them, none touching, each fully visible. Plain solid pure white background. No people, no cars, no text, no letters, no numbers, no logos, no sign boards with writing, no UI.",
        "image_urls": [R["strip_espaco" if space else "strip_padaria"]], "aspect_ratio": "16:9", "resolution": "2k"}}

# id: (tema, decoração dos 2 blocos, bordas, fundo, entorno da ilhota)
SEA = "Only open sea around the tile."
SPACE_BG = "The tile floats in deep outer space instead of the sea, with stars all around."
THEMES = {
 "praia": ("sunny TROPICAL BEACH", None, "The tile edges get white sand, palm trees, beach umbrellas and small dunes; the bridge is wooden.", "Only turquoise sea around the tile."),
 "cidade": ("colorful CITY", None, "The tile edges get green lawns, trees, benches and street lamps.", SEA),
 "porto": ("seaside MARINA PORT", None, "The tile edges get wooden docks, small boats, buoys, ropes and seagulls.", SEA),
 "centro": ("modern FINANCIAL DOWNTOWN", None, "The tile edges get neat lawns, modern lamp posts, fountains and small glass kiosks.", SEA),
 "industrial": ("INDUSTRIAL PARK", None, "The tile edges get stacked containers, pallets, a small railway and pipes.", SEA),
 "serra": ("SNOWY MOUNTAIN VILLAGE", None, "The tile is covered with fresh snow at the edges, snowy pine trees and wooden fences; the lots and roads are clear.", "Only icy blue sea around the tile."),
 "ilha": ("luxury TROPICAL RESORT", None, "The tile edges get white sand, palm trees, hibiscus flowers and wooden boardwalks.", "Only crystal clear turquoise sea around the tile."),
 "espaco": ("futuristic SPACE CENTER", None, "The tile edges get satellite dishes, white tanks and neat lawns; roads have glowing blue lines.", SEA),
 "piratas": ("funny PIRATE ISLAND", ("a treasure chest overflowing with gold coins next to a palm tree", "a small sandy hill with old crossed cannons"), "Replace the outer edges with golden sand beaches, palm trees, wooden docks, barrels, ropes and old cannons.", "Far behind the tile a big pirate ship with black sails floats on the turquoise sea (blurred, not on the lots)."),
 "atlantida": ("magical UNDERWATER ATLANTIS city", ("a giant open clam shell with a glowing pearl", "a garden of colorful corals with small fishes"), "The tile is made of white marble and sand with seaweed, corals, sea shells and starfish at the edges; the roads are pale stone. The whole scene is deep underwater in turquoise ocean light with bubbles and sun rays from above instead of a sky.", "Far behind the tile there are ruins of golden domes and Greek columns (blurred, not on the lots)."),
 "dinos": ("funny PREHISTORIC DINOSAUR VALLEY", ("a big nest with three giant spotted dinosaur eggs", "a pond with a cute long-neck dinosaur"), "Replace the outer edges with lush prehistoric jungle, giant ferns, palm trees and rocks; the roads are dirt paths with stone curbs.", "Far behind the tile a smoking volcano and cute long-neck dinosaurs walk in the jungle (blurred, not on the lots)."),
 "pinguins": ("funny PENGUIN KINGDOM on the south pole", ("a frozen pond with cute penguins sliding", "a big snowman with a scarf"), "The tile is snow and ice with icebergs and igloos at the edges; the roads are cleared blue ice.", "Far behind the tile there are icebergs and snowy mountains on an icy sea (blurred, not on the lots)."),
 "doces": ("funny CANDY LAND city", ("a fountain of pink lemonade with lollipop trees", "a hill of whipped cream with a cherry on top"), "The ground is pink frosting, the edges have candy cane fences, lollipop trees, gumdrops and chocolate rocks; the roads are chocolate with white icing crosswalks.", "The tile floats on a sea of strawberry milk; far behind it there are cotton candy clouds and candy mountains (blurred, not on the lots)."),
 "brinquedos": ("funny TOY TOWN", ("a giant rubber duck in a little pool", "a playground with toy blocks and a rocking horse"), "The tile edges are made of giant colorful toy blocks, toy trees and toy soldiers; the roads are like a toy car play mat.", "Far behind the tile there are giant teddy bears and toy balloons (blurred, not on the lots)."),
 "lua": ("MOON BASE in outer space", ("a little moon crater with a moon rover", "a glass dome greenhouse with plants"), "The tile is gray moon rock with craters at the edges, futuristic lamp posts and small antennas; the roads have glowing blue lane lines. " + SPACE_BG, "Far behind the tile the blue planet Earth rises over the horizon (blurred, not on the lots)."),
 "marte": ("MARS COLONY", ("a small potato farm under a glass dome", "a red rock formation with a parked rover"), "The tile is red martian soil and rocks with small domes and solar panels at the edges; the roads have glowing orange lane lines. The sky is a dusty orange-pink martian sky.", "Far behind the tile there are red mountains and a big volcano (blurred, not on the lots)."),
 "gatos": ("funny CAT PLANET", ("a giant ball of yarn with a cat bed", "a fish shaped fountain"), "The ground is soft lavender grass with cat paw prints, the edges have scratching posts, cardboard boxes and fish bone decorations; the roads are purple. " + SPACE_BG, "Far behind the tile a big planet shaped like a cat face with ears glows in space (blurred, not on the lots)."),
 "saturno": ("RINGS OF SATURN colony", ("a cluster of glowing purple crystals", "a small ice skating rink"), "The tile is golden rock with sparkling ice crystals at the edges and futuristic lamp posts; the roads have glowing golden lane lines. " + SPACE_BG, "Far behind the tile the giant planet Saturn with its rings fills the sky (blurred, not on the lots)."),
 "gelatina": ("funny JELLY PLANET", ("a wobbly rainbow jelly dome", "a pool of green slime with bubbles"), "The ground is shiny translucent jelly in rainbow colors with jelly trees and gummy rocks at the edges; the roads are blue jelly. " + SPACE_BG, "Far behind the tile there are wobbly jelly planets (blurred, not on the lots)."),
 "galaxia": ("majestic GALACTIC EMPIRE capital", ("a glowing teleport portal ring", "a small golden statue of a planet with rings"), "The tile is polished dark metal and gold with glowing purple lines at the edges and futuristic lamp posts; the roads have glowing purple lane lines. " + SPACE_BG, "Far behind the tile there is a colorful spiral galaxy and a nebula (blurred, not on the lots)."),
}
NEW = ["piratas","atlantida","dinos","pinguins","doces","brinquedos","lua","marte","gatos","saturno","gelatina","galaxia"]

def base(d):
    t, (a, b), edges, back = THEMES[d]
    return {"id": f"g8_{d}_base", "model": M, "variations": 2, "input": {"prompt":
        f"Edit this image into a {t} district. Keep the exact same glossy cartoon mobile city-builder art style, the same isometric camera angle, the same square diorama tile shape and the same layout of gray roads with crosswalks. Keep EXACTLY the six large EMPTY flat building lots (plain light concrete plazas, nothing on them) in the same positions and sizes as in the reference; the two small decorative blocks become: {a}, and {b}. Remove the rocket, the satellite dishes, the globe and the satellite. {edges} {back} Bright and cheerful. No buildings on the six lots. {NO}",
        "image_urls": [R["base"]], "aspect_ratio": "9:16"}}

def ilhota(d, n, k):
    t, _, edges, around = THEMES[d]
    if d in SPACE: around = "Only deep outer space with stars around the tile, no sea."
    if d == "atlantida": around = "Everything is deep underwater in turquoise ocean light with bubbles."
    if d == "marte": around = "Only a dusty orange martian plain around the tile, no sea."
    return {"id": f"g8_{d}_ilhota{k}", "model": M, "variations": 2 if k == 1 else 1, "input": {"prompt":
        f"Edit this image into the {t} theme. Keep the exact same glossy cartoon mobile city-builder art style, isometric camera angle, the same small separate diorama tile in the middle of the image with EXACTLY {'THREE' if n == 3 else 'TWO'} EMPTY flat building lots (plain light concrete plazas, nothing on them) in one diagonal row separated by roads with crosswalks, and the short bridge leaving the top-right of the tile. Remove the satellite dishes and white tanks. {edges} {around} No buildings on the lots. {NO}",
        "image_urls": [R["ilhota"]], "aspect_ratio": "9:16"}}

old = {e["slug"] for e in json.load(open("/tmp/claude-501/catalog_old.json"))}
sheets = [sheet(e["slug"], e["district"]) for e in CAT if e["slug"] not in old]
scenes = [base(d) for d in NEW]
islands = [ilhota(d, 2 if d == "praia" else 3, 2) for d in THEMES if d not in NEW] + \
          [ilhota(d, 3, 1) for d in NEW] + [ilhota(d, 3, 2) for d in NEW]
J = ROOT / "tools/art/jobs"
json.dump(sheets, open(J / "v8-folhas.json", "w"), ensure_ascii=False, indent=1)
json.dump(scenes + islands, open(J / "v8-cenarios.json", "w"), ensure_ascii=False, indent=1)
print(len(sheets), "folhas;", len(scenes), "cenários;", len(islands), "ilhotas")

# Ajudantes: folhas de 7 personagens (mesmo formato das folhas g_helpers_novos_*).
def worker(slug):
    d = DESC[slug].split(",")[0].split(" with ")[0]
    for art in ("a funny ", "an ", "a ", "the "):
        if d.startswith(art):
            d = d[len(art):]
            break
    return f"a cute worker of the {d} in a matching themed uniform holding an item related to it"

new_slugs = [e["slug"] for e in CAT if e["slug"] not in old]
helpers = []
for i in range(0, len(new_slugs), 7):
    group = new_slugs[i:i + 7]
    items = "; ".join(f"({k + 1}) {worker(s)}" for k, s in enumerate(group))
    helpers.append({"id": f"g8_helpers_{i // 7 + 1:02d}", "model": M, "variations": 1, "slugs": group, "input": {"prompt":
        f"Using the exact character art style of this reference sheet (cute chibi cartoon people, big heads, glossy, saturated colors, same proportions and rendering), draw a NEW character sheet of {len(group)} different cute chibi workers standing in a single row, evenly spaced with wide white space between them, full body, fully clothed, family-friendly, facing the viewer at a slight angle, each one clearly showing their job: {items}. Plain solid pure white background, no ground, no shadow, no text, no letters, no numbers, no logos.",
        "image_urls": [R["helpers"]], "quality": "medium", "resolution": "2k", "aspect_ratio": "16:9"}})
json.dump(helpers, open(J / "v8-ajudantes.json", "w"), ensure_ascii=False, indent=1)
print(len(helpers), "folhas de ajudantes")
