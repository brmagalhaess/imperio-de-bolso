#!/usr/bin/env python3
"""Lotes vazios (praças de concreto claro) de um cenário, em pixels da própria imagem:
centro, largura/altura da caixa e ponto de apoio (onde o prédio pisa). Base do mapa de ilha
única (v9, 2026-11-25). Uso: python3 tools/art/v9_lotes.py imagem [--min 0.006]"""
import sys
from collections import deque

import numpy as np
from PIL import Image


def lots(path: str, min_share: float = 0.006):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    a = np.asarray(im).astype(int)
    r, b = a[..., 0], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    mask = (mx > 165) & (mx - mn < 40) & (r >= b - 5)
    seen = np.zeros_like(mask)
    out = []
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
            if len(pts) > w * h * min_share:
                c = np.array(pts)
                ys, xs = c[:, 0], c[:, 1]
                bw, bh = xs.max() - xs.min(), ys.max() - ys.min()
                # Praça = losango: a área ocupa ~metade da caixa. Areia/neve espalhada não passa.
                fill = len(pts) / max(1, bw * bh)
                cy = ys.mean()
                foot = cy + (np.percentile(ys, 97) - cy) * 0.75
                out.append({"x": float(xs.mean()), "y": float(cy), "foot": float(foot),
                            "w": int(bw), "h": int(bh), "area": len(pts), "fill": round(fill, 2)})
    return (w, h), sorted(out, key=lambda p: (round(p["y"] / (h * 0.03)), p["x"]))


if __name__ == "__main__":
    share = float(sys.argv[sys.argv.index("--min") + 1]) if "--min" in sys.argv else 0.006
    size, found = lots(sys.argv[1], share)
    print(size, len(found))
    for p in found:
        print({k: (round(v) if isinstance(v, float) and k != "fill" else v) for k, v in p.items()})
