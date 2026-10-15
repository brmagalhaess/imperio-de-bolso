#!/usr/bin/env python3
"""Acha os lotes vazios (praças de concreto claro) num cenário de mapa e imprime o ponto de
apoio de cada um em coordenadas da resolução base 720×1280.

    python3 tools/art/find_lots.py game/assets/optimized/industrial_base.jpg [--debug saida.png]

Concreto = pixels claros e pouco saturados; componentes conexos grandes viram lotes. O ponto de
apoio fica entre o centro e a ponta de baixo do losango (como os lotes ajustados à mão).
"""
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw


def main() -> None:
    path = sys.argv[1]
    im = Image.open(path).convert("RGB")
    w, h = im.size
    a = np.asarray(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    mask = (mx > 165) & (mx - mn < 40) & (r >= b - 5)
    seen = np.zeros_like(mask)
    comps = []
    for y0 in range(0, h, 3):
        for x0 in range(0, w, 3):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            q = deque([(y0, x0)])
            seen[y0, x0] = True
            pts = []
            while q:
                y, x = q.popleft()
                pts.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            if len(pts) > w * h * 0.006:
                comps.append(np.array(pts))
    sx, sy = 720 / w, 1280 / h
    lots = []
    for c in comps:
        ys, xs = c[:, 0], c[:, 1]
        cy, cx = ys.mean(), xs.mean()
        bottom = np.percentile(ys, 97)
        lots.append((cx * sx, (cy + (bottom - cy) * 0.75) * sy, len(c)))
    lots.sort(key=lambda p: (round(p[1] / 60), p[0]))
    for x, y, n in lots:
        print(f"Vector2({x:.0f}, {y:.0f})  # área {n}")
    if "--debug" in sys.argv:
        out = sys.argv[sys.argv.index("--debug") + 1]
        dbg = im.copy()
        d = ImageDraw.Draw(dbg)
        for x, y, _ in lots:
            d.ellipse((x / sx - 12, y / sy - 12, x / sx + 12, y / sy + 12), fill="red")
        dbg.save(out)


if __name__ == "__main__":
    main()
