"""Processa as ilhas únicas (v9): escolhe a variação de cada mapa, acha os lotes e grava
game/assets/optimized/<mapa>_ilha.jpg, a miniatura da trilha e game/scripts/layout_v9.gd.

    python3 tools/art/v9/processar.py            # processa tudo
    python3 tools/art/v9/processar.py --contar   # só mostra quantos lotes cada variação tem

Mundo do jogo: 840×1120 (a imagem 3:4 inteira). Os lotes de todos os mapas partem dos 14 do
cenário-mestre (o do topo e o de baixo viram decoração); cada um é ajustado ao lote detectado
mais próximo na arte do mapa. A praia usa só os lotes que sobraram na arte dela (6).
Escolha manual de variação: tools/art/v9/escolhas.json  {"cidade": 2, ...}."""
import json, sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from lotes import lots

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "game/assets/source"
OUT = ROOT / "game/assets/optimized"
WORLD = (840, 1120)
TEX_W = 1260  # 1,5× o mundo: nítido com zoom
ORDER = ["praia", "cidade", "porto", "centro", "industrial", "serra", "ilha", "espaco", "piratas",
         "atlantida", "dinos", "pinguins", "doces", "brinquedos", "lua", "marte", "gatos", "saturno",
         "gelatina", "galaxia"]
CHOICES = json.loads((Path(__file__).parent / "escolhas.json").read_text()) \
    if (Path(__file__).parent / "escolhas.json").exists() else {}


def variations(d: str) -> list[Path]:
    return sorted((SRC / f"g9_{d}_ilha").glob("*.png"))


def detect(path: Path):
    (w, h), found = lots(str(path), 0.004)
    # Praça de verdade: losango cheio (areia/neve espalhada tem preenchimento baixo ou é enorme).
    ok = [p for p in found if 0.45 <= p["fill"] <= 0.68 and 0.012 < p["area"] / (w * h) < 0.03]
    return (w, h), ok


def master():
    (w, h), found = detect(SRC / "g9_mestre/g9_mestre_v04.png")
    assert len(found) == 14, len(found)
    found.sort(key=lambda p: (p["y"], p["x"]))
    return (w, h), found[1:-1]  # sem o do topo e o de baixo


def main() -> None:
    (mw, mh), base = master()
    if "--contar" in sys.argv:
        for d in ORDER:
            print(d, [len(detect(v)[1]) for v in variations(d)])
        return
    out = ["## GERADO por tools/art/v9/processar.py — não edite à mão.",
           "## Ilha única por mapa (2026-11-25): cenário, cor do mar e lotes no mundo 840×1120.",
           "extends RefCounted", "", "const WORLD := Vector2(%d, %d)" % WORLD, "", "const ISLANDS := {"]
    sx, sy = WORLD[0] / mw, WORLD[1] / mh
    for d in ORDER:
        want = 6 if d == "praia" else 12
        vs = variations(d)
        if not vs:
            print("SEM ARTE:", d)
            continue
        pick = CHOICES.get(d)
        if pick is None:
            counts = [len(detect(v)[1]) for v in vs]
            pick = min(range(len(vs)), key=lambda i: (abs(counts[i] - want), i)) + 1
        path = vs[pick - 1]
        (w, h), found = detect(path)
        extra = []
        if d == "praia":
            pts = sorted(found, key=lambda p: (round(p["y"] / (h * 0.03)), p["x"]))
            # A arte da praia sobra com lotes vazios a mais: ficam os 6 do meio e os das pontas
            # viram área de guarda-sóis (decoração por cima, no jogo).
            while len(pts) > want:
                extra.append(pts.pop(0 if len(extra) % 2 == 0 else -1))
        else:
            pts = []
            for b in base:
                near = min(found, key=lambda p: (p["x"] - b["x"]) ** 2 + (p["y"] - b["y"]) ** 2, default=None)
                good = near is not None and abs(near["x"] - b["x"]) < 70 and abs(near["y"] - b["y"]) < 70
                pts.append(near if good else b)
        im = Image.open(path).convert("RGB")
        im.resize((TEX_W, round(TEX_W * h / w)), Image.LANCZOS).save(OUT / f"{d}_ilha.jpg", quality=88)
        # Miniatura da trilha de mapas (mesmo formato das antigas: 540 de largura).
        im.crop((0, int(h * 0.12), w, int(h * 0.82))).resize((540, round(540 * 0.70 * h / w)), Image.LANCZOS) \
            .save(OUT / f"{d}_trilha.jpg", quality=82)
        a = np.asarray(im)
        k = 24
        corners = np.concatenate([a[:k, :k].reshape(-1, 3), a[:k, -k:].reshape(-1, 3),
                                  a[-k:, :k].reshape(-1, 3), a[-k:, -k:].reshape(-1, 3)])
        sea = "%02x%02x%02x" % tuple(int(v) for v in np.median(corners[len(corners) // 2:], axis=0))
        sea_top = "%02x%02x%02x" % tuple(int(v) for v in np.median(corners[:len(corners) // 2], axis=0))
        vec = ", ".join("Vector2(%d, %d)" % (round(p["x"] * sx), round(p["foot"] * sy)) for p in pts)
        cover = ", ".join("Vector2(%d, %d)" % (round(p["x"] * sx), round(p["y"] * sy)) for p in extra)
        # Pontos de passeio das pessoas: no meio do caminho entre lotes vizinhos (ruas).
        cs = [(p["x"] * sx, p["y"] * sy) for p in pts]
        ways = []
        for i, (ax, ay) in enumerate(cs):
            for bx, by in cs[i + 1:]:
                if 100 < ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5 < 180:
                    ways.append("Vector2(%d, %d)" % (round((ax + bx) / 2), round((ay + by) / 2)))
        out.append('\t"%s": {"base": "%s_ilha.jpg", "sea_top": Color("%s"), "sea": Color("%s"), "lots": [%s], "cover": [%s], "waypoints": [%s]},'
                   % (d, d, sea_top, sea, vec, cover, ", ".join(ways)))
        print(d, "variação", pick, "lotes", len(pts), "detectados", len(found), "mar", sea,
              "" if len(pts) == want else "  <-- CONFERIR")
    out += ["}", ""]
    (ROOT / "game/scripts/layout_v9.gd").write_text("\n".join(out))


if __name__ == "__main__":
    main()
