#!/usr/bin/env python3
"""Ilhas de expansão dos mapas maiores (2026-10-15): recorta a faixa da ilha, esfuma as bordas de
cima e de baixo no mar e grava game/assets/optimized/<mapa>_expansao.png (1,5× da resolução
base, como os cenários). Imprime os lotes já na coordenada do mundo (720 de largura).

    python3 tools/art/process_expansions.py
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "game/assets/source"
OUT = ROOT / "game/assets/optimized"

CHOSEN = {
    "cidade": "g_cidade_ilhota3/g_cidade_ilhota3_v02.jpeg",
    "porto": "g_porto_ilhota3/g_porto_ilhota3_v01.jpeg",
    "centro": "g_centro_ilhota3/g_centro_ilhota3_v02.jpeg",
    "industrial": "g_industrial_ilhota3/g_industrial_ilhota3_v02.jpeg",
    "serra": "g_serra_ilhota3/g_serra_ilhota3_v01.jpeg",
    "ilha": "g_ilha_ilhota3/g_ilha_ilhota3_v01.jpeg",
    "espaco": "g_espaco_ilhota3/g_espaco_ilhota3_v02.jpeg",
}
# Faixa recortada (coordenadas da imagem 720×1280) e esfumado das bordas.
TOP, BOTTOM = 250, 1120
FADE_TOP, FADE_BOTTOM = 150, 140
SCALE = 1.5


def main() -> None:
    for d, rel in CHOSEN.items():
        im = Image.open(SRC / rel).convert("RGB").resize((720, 1280), Image.LANCZOS)
        crop = im.crop((0, TOP, 720, BOTTOM))
        h = BOTTOM - TOP
        alpha = np.full((h, 720), 255, dtype=np.float32)
        ramp_top = np.linspace(0, 1, FADE_TOP) ** 1.5
        alpha[:FADE_TOP] *= ramp_top[:, None]
        alpha[h - FADE_BOTTOM:] *= np.linspace(1, 0, FADE_BOTTOM)[:, None]
        rgba = crop.convert("RGBA")
        rgba.putalpha(Image.fromarray(alpha.astype(np.uint8)))
        rgba = rgba.resize((int(720 * SCALE), int(h * SCALE)), Image.LANCZOS)
        out = OUT / f"{d}_expansao.png"
        rgba.save(out, optimize=True)
        # Lotes: o detector trabalha sobre a faixa opaca (sem o esfumado).
        tmp = Path("/tmp") / f"{d}_exp_rgb.png"
        crop.resize((720, int(720 * 16 / 9))).save(tmp)  # proporção 9:16 p/ escala 720×1280
        res = subprocess.run([sys.executable, str(ROOT / "tools/art/find_lots.py"), str(tmp)],
                             capture_output=True, text=True).stdout
        sy = h / (720 * 16 / 9) * 1280 / 1280  # volta para pixels da faixa
        lots = []
        for line in res.splitlines():
            x, y = [float(v) for v in line.split("(")[1].split(")")[0].split(",")]
            lots.append((round(x), round(y * (720 * 16 / 9) / 1280 * h / (720 * 16 / 9))))
        print(d, out.name, f"altura {h}", "lotes (na faixa):", lots)


if __name__ == "__main__":
    main()
