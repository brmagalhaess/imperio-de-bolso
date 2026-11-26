"""Monta o lote v9: uma ilha única e maior por mapa, com os 12 lotes dentro (pedido do titular em
2026-11-25: as ilhas de expansão separadas ficaram feias). Todos os mapas são edições do mesmo
cenário-mestre (g9_mestre_v04: 14 lotes em losango 1-2-3-2-3-2-1); o lote do topo e o de baixo
viram decoração, sobram 12.  Uso: python3 tools/art/v9/montar.py <url do mestre>"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
src = (ROOT / "tools/art/v8/montar_lotes.py").read_text()
ns: dict = {}
exec(src[src.index("SEA = "):src.index("NEW = ")], ns)  # THEMES da v8 (tema, blocos, bordas, fundo)
THEMES = ns["THEMES"]
M = "xai/grok-imagine-image-2.0"
NO = "No people, no cars, no text, no letters, no numbers, no logos, no flags, no UI."
# Decoração do lote do topo e do de baixo nos mapas antigos (os novos já têm na v8).
OLD_DECOR = {
    "cidade": ("a round park with a big fountain", "a playground with a colorful carousel"),
    "porto": ("a small plaza with a red and white lighthouse and anchors", "a fish market square with crates, nets and barrels"),
    "centro": ("a modern plaza with a glass fountain", "a small park with a golden abstract sculpture"),
    "industrial": ("a big water tower with pipes", "a yard of stacked colorful shipping containers"),
    "serra": ("a frozen pond with a snowman", "a wooden gazebo among snowy pine trees"),
    "ilha": ("a blue swimming pool with palm trees and sunbeds", "a tiki garden with hibiscus flowers and a small waterfall"),
    "espaco": ("a launch pad with a small white rocket", "a garden with a big white satellite dish"),
}
STYLE = ("Keep the exact same glossy cartoon mobile city-builder art style, the same isometric camera angle, "
         "the same big island shape filling the image and the exact same layout of roads with crosswalks.")


def job(d: str, ref: str) -> dict:
    t, blocks, edges, back = THEMES[d]
    edges = edges.replace("the bridge is wooden.", "").replace("; .", ".")
    if d == "praia":
        prompt = (f"Edit this image into a {t} island. {STYLE} There are fourteen lots in the reference: keep ONLY SIX of them as large EMPTY flat building lots "
                  "(plain light concrete plazas, nothing on them, same positions and sizes): the six lots that form the two widest rows of three lots. "
                  "ALL the other eight lots are replaced by beach scenery: white sand with colorful beach umbrellas and sunbeds, a beach volleyball court, "
                  "a blue swimming pool, sand castles, surfboards stuck in the sand and palm trees. The roads become light wooden boardwalks. "
                  f"{edges} {back} Bright and cheerful. No buildings on the six lots. No bridges. {NO}")
    else:
        a, b = blocks or OLD_DECOR[d]
        prompt = (f"Edit this image into a {t} district. {STYLE} There are fourteen lots in the reference: keep EXACTLY the TWELVE lots of the middle as large EMPTY flat building lots "
                  "(plain light concrete plazas, nothing on them) in the same positions and sizes; ONLY the single lot at the very top corner and the single lot at the very bottom corner "
                  f"of the grid are replaced by decorations: at the top {a}, and at the bottom {b}. {edges} {back} Bright and cheerful. No buildings on the twelve lots. No bridges. {NO}")
    return {"id": f"g9_{d}_ilha", "model": M, "variations": 3 if d == "praia" else 2,
            "input": {"prompt": prompt, "image_urls": [ref], "aspect_ratio": "3:4", "resolution": "2k"}}


if __name__ == "__main__":
    jobs = [job(d, sys.argv[1]) for d in THEMES]
    json.dump(jobs, open(ROOT / "tools/art/jobs/v9-ilhas.json", "w"), ensure_ascii=False, indent=1)
    print(len(jobs), "mapas;", sum(j["variations"] for j in jobs), "imagens")
