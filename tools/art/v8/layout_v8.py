#!/usr/bin/env python3
"""Escreve no game/scripts/layout.gd os 20 mapas (ADR 0034): segunda ilha de expansão nos 8 mapas
antigos (a praia ganha a primeira), os 12 mapas novos e a arte dos negócios novos. Os cenários
novos são edições do Centro Espacial (mesmos lotes); as ilhas, edições da ilha do Espaço.

    python3 tools/art/v8/layout_v8.py   (depois de processar.py)
"""
from __future__ import annotations

import json, re, subprocess, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
L = ROOT / "game/scripts/layout.gd"
HERE = Path(__file__).parent
cat = json.load(open("/tmp/claude-501/catalog_new.json"))
old = {e["slug"] for e in json.load(open("/tmp/claude-501/catalog_old.json"))}
colors = json.load(open(HERE / "cores.json"))
NEW = ["piratas", "atlantida", "dinos", "pinguins", "doces", "brinquedos", "lua", "marte", "gatos",
       "saturno", "gelatina", "galaxia"]
TITLES = dict(json.load(open("/tmp/claude-501/districts_new.json")))
SHORT = {"piratas": "a ilha dos piratas", "atlantida": "Atlântida", "dinos": "o vale dos dinossauros",
         "pinguins": "o reino dos pinguins", "doces": "a cidade dos doces", "brinquedos": "a cidade dos brinquedos",
         "lua": "a base lunar", "marte": "a colônia em Marte", "gatos": "o planeta dos gatos",
         "saturno": "os anéis de Saturno", "gelatina": "o planeta gelatina", "galaxia": "o império galáctico"}
BASE_LOTS = [(380, 545), (212, 668), (565, 715), (390, 795), (157, 870), (350, 995)]
ISLAND_LOTS = [(470, 377), (362, 445), (255, 512)]  # relativos ao topo da ilha
Y1, Y2 = 1080, 1650
H1, H2 = 1950, 2520
WAYPOINTS = """[
			Vector2(300, 470), Vector2(455, 470), Vector2(368, 588), Vector2(110, 690),
			Vector2(200, 705), Vector2(545, 722), Vector2(660, 690), Vector2(395, 852),
			Vector2(250, 950), Vector2(520, 965), Vector2(610, 815), Vector2(150, 640),
		]"""


def v(x, y):
    return f"Vector2({x}, {y})"


def detect(img: Image.Image) -> list[tuple[float, float]]:
    """Lotes achados pelo find_lots numa imagem já em coordenadas 720 de largura."""
    canvas = Image.new("RGB", (720, 1280), (0, 0, 0))
    canvas.paste(img.convert("RGB"), (0, 0))
    tmp = Path("/tmp/v8_lots.png")
    canvas.save(tmp)
    out = subprocess.run([sys.executable, str(ROOT / "tools/art/find_lots.py"), str(tmp)],
                         capture_output=True, text=True).stdout
    return [tuple(map(float, m)) for m in re.findall(r"Vector2\(([\d.]+), ([\d.]+)\)", out)]


def snap(ref: list[tuple[int, int]], found: list[tuple[float, float]]) -> list[tuple[int, int]]:
    """Cada lote de referência vai para o achado mais próximo (até 80 px); os não achados levam o
    deslocamento médio dos achados (a imagem gerada às vezes sai um pouco deslocada)."""
    got, shifts = [], []
    for x, y in ref:
        best = min(found, key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2, default=None)
        if best and ((best[0] - x) ** 2 + (best[1] - y) ** 2) ** 0.5 <= 80:
            got.append(best)
            shifts.append((best[0] - x, best[1] - y))
        else:
            got.append(None)
    dx = sum(s[0] for s in shifts) / len(shifts) if shifts else 0
    dy = sum(s[1] for s in shifts) / len(shifts) if shifts else 0
    return [(round(g[0]), round(g[1])) if g else (round(x + dx), round(y + dy)) for g, (x, y) in zip(got, ref)]


def base_lots(d: str) -> list[tuple[int, int]]:
    return snap(BASE_LOTS, detect(Image.open(ROOT / f"game/assets/optimized/{d}_base.jpg").resize((720, 1280))))


def island_lots(png: str, n: int = 3) -> list[tuple[int, int]]:
    im = Image.open(ROOT / "game/assets/optimized" / png)
    im = im.resize((720, round(im.height * 720 / im.width)))
    found = detect(im)
    if n == 2:
        found.sort(key=lambda p: p[1])
        if len(found) == 2:
            return [(round(x), round(y)) for x, y in found]
        print("! praia: lotes achados", found, "— usando os da ilha do Espaço")
        return ISLAND_LOTS[:2]
    return snap(ISLAND_LOTS, found)


def main():
    s = L.read_text()
    by = {}
    for e in cat:
        by.setdefault(e["district"], []).append(e["slug"])
    order = list(by)
    s = re.sub(r"const DISTRICT_ORDER := \[[^\]]*\]",
               "const DISTRICT_ORDER := [\n\t" + ", ".join(f'"{d}"' for d in order[:8]) + ",\n\t"
               + ", ".join(f'"{d}"' for d in order[8:]) + ",\n]", s)

    # Mapas antigos: lotes da segunda ilha (a praia ganha a primeira).
    for d in order[:8]:
        news = [x for x in by[d] if x not in old]
        m = re.search(rf'\n\t"{d}": {{\n(.*?)\n\t}},', s, re.S)
        block = m.group(1)
        if d == "praia":
            lots = [(x, Y1 + y) for x, y in island_lots("praia_expansao.png", 2)]
            extra = f'\t\t"expansion": {{"base": "praia_expansao.png", "y": {Y1}, "sea_color": Color("{colors[d]["sea"]}")}},\n\t\t"pan": true,\n\t\t"world_height": {H1},\n'
        else:
            lots = [(x, Y2 + y) for x, y in island_lots(f"{d}_expansao2.png")]
            extra = f'\t\t"expansion2": {{"base": "{d}_expansao2.png", "y": {Y2}}},\n'
            block = block.replace(f'"world_height": {H1}', f'"world_height": {H2}')
        add = "\t\t\t# Ilha nova (12 negócios por mapa, ADR 0034).\n" + "".join(
            f'\t\t\t"{slug}": {v(*p)},\n' for slug, p in zip(news, lots))
        block = re.sub(r'(\t\t"lots": \{\n.*?)(\t\t\},\n)', lambda mm: mm.group(1) + add + mm.group(2), block, count=1, flags=re.S)
        block = block.replace('\t\t"waypoints"', extra + '\t\t"waypoints"', 1)
        s = s[:m.start(1)] + block + s[m.end(1):]

    # Mapas novos.
    blocks = []
    for d in NEW:
        slugs = by[d]
        c = colors[d]
        lots = list(zip(slugs[:6], base_lots(d))) \
            + [(x, (px, Y1 + py)) for x, (px, py) in zip(slugs[6:9], island_lots(f"{d}_expansao.png"))] \
            + [(x, (px, Y2 + py)) for x, (px, py) in zip(slugs[9:12], island_lots(f"{d}_expansao2.png"))]
        print(d, lots)
        lot_txt = "".join(f'\t\t\t"{x}": {v(*p)},\n' for x, p in lots)
        blocks.append(f'''	"{d}": {{
		"title": "{TITLES[d]}",
		"base": "{d}_base.jpg",
		"top_color": Color("{c["top"]}"),
		"bottom_color": Color("{c["bottom"]}"),
		"camera_center": Vector2(360, 690),
		"zoom": 1.0,
		"char_scale": 0.42,
		"lots": {{
{lot_txt}		}},
		"expansion": {{"base": "{d}_expansao.png", "y": {Y1}, "sea_color": Color("{c["sea"]}")}},
		"expansion2": {{"base": "{d}_expansao2.png", "y": {Y2}}},
		"pan": true,
		"world_height": {H2},
		"waypoints": {WAYPOINTS},
		"decor": [],
		"walkers": ["char_tourist", "char_woman", "char_boy", "char_grandma", "char_kid"],
		"helper_offset": Vector2(-100, 6),
		"trail_center": 0.5,
	}},
''')
    marker = "\n}\n\n## Retrato do ajudante"
    assert marker in s
    s = s.replace(marker, "\n\t# Mapas 9–20 (ADR 0034): edições do Centro Espacial, mesmos lotes.\n" + "".join(blocks).rstrip("\n") + marker, 1)

    art = "".join(f'\t"{e["slug"]}": "{e["slug"]}",\n' for e in cat if e["slug"] not in old)
    s = s.replace('\t"elevador_espacial": "elevador_espacial",\n}',
                  '\t"elevador_espacial": "elevador_espacial",\n\t# 20 mapas (ADR 0034).\n' + art + "}", 1)
    short = ", ".join(f'"{d}": "{SHORT[d]}"' for d in NEW)
    s = s.replace('"espaco": "o centro espacial"}', '"espaco": "o centro espacial",\n\t\t' + short + "}", 1)
    L.write_text(s)
    print("layout.gd atualizado")


if __name__ == "__main__":
    main()
