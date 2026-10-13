#!/usr/bin/env python3
"""Prepara a arte gerada para o Godot (direção visual v2: ilha de praia cartoon).

    python3 tools/art/process_assets.py

- Sprites: remove o fundo claro ligado às bordas (flood fill com tolerância),
  suaviza a borda, recorta e redimensiona.
- Folhas (personagens, ícones): remove o fundo e separa cada item pelos vãos vazios.
- Cenários (ilha, cidade): viram o fundo da tela em 1080×1920 (JPEG).

Originais ficam em game/assets/source/ (intocados); saídas em game/assets/optimized/.
Sprites ficam em 2× o tamanho de exibição na resolução base 720×1280.
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "game/assets/source"
OUT = ROOT / "game/assets/optimized"

# id final → (arquivo de origem escolhido, {"width" ou "height": px a 2×})
SPRITES = {
    "water_cart_lv1": ("g_water_cart_lv1/g_water_cart_lv1_v01.jpeg", {"width": 250}),
    "water_cart_lv2": ("g_water_cart_lv2/g_water_cart_lv2_v01.jpeg", {"width": 260}),
    "water_cart_lv3": ("g_water_cart_lv3/g_water_cart_lv3_v01.jpeg", {"width": 270}),
    "popcorn_cart_lv1": ("g_popcorn_cart_lv1/g_popcorn_cart_lv1_v01.jpeg", {"width": 240}),
    "popcorn_cart_lv2": ("g_popcorn_cart_lv2/g_popcorn_cart_lv2_v01.jpeg", {"width": 260}),
    "popcorn_cart_lv3": ("g_popcorn_cart_lv3/g_popcorn_cart_lv3_v01.jpeg", {"width": 280}),
    "icecream_cart_lv1": ("g_icecream_cart_lv1/g_icecream_cart_lv1_v01.jpeg", {"width": 230}),
    "icecream_cart_lv2": ("g_icecream_cart_lv2/g_icecream_cart_lv2_v01.jpeg", {"width": 250}),
    "icecream_cart_lv3": ("g_icecream_cart_lv3/g_icecream_cart_lv3_v01.jpeg", {"width": 270}),
    "coconut_kiosk_lv1": ("g_coconut_kiosk_lv1/g_coconut_kiosk_lv1_v01.jpeg", {"width": 250}),
    "coconut_kiosk_lv2": ("g_coconut_kiosk_lv2/g_coconut_kiosk_lv2_v01.jpeg", {"width": 280}),
    "coconut_kiosk_lv3": ("g_coconut_kiosk_lv3/g_coconut_kiosk_lv3_v01.jpeg", {"width": 310}),
    "lot_lock": ("g_lot_lock/g_lot_lock_v01.jpeg", {"width": 130}),
    # Cidade-maquete (mockup D)
    "market_lv1": ("g_market_lv1/g_market_lv1_v01.jpeg", {"width": 280}),
    "market_lv2": ("g_market_lv2/g_market_lv2_v01.jpeg", {"width": 290}),
    "market_lv3": ("g_market_lv3_r2/g_market_lv3_r2_v01.jpeg", {"width": 300}),
    "restaurant_lv1": ("g_restaurant_lv1_r2/g_restaurant_lv1_r2_v01.jpeg", {"width": 280}),
    "restaurant_lv2": ("g_restaurant_lv2/g_restaurant_lv2_v01.jpeg", {"width": 290}),
    "restaurant_lv3": ("g_restaurant_lv3/g_restaurant_lv3_v01.jpeg", {"width": 300}),
    "supermarket_lv1": ("g_supermarket_lv1/g_supermarket_lv1_v01.jpeg", {"width": 280}),
    "supermarket_lv2": ("g_supermarket_lv2_r2/g_supermarket_lv2_r2_v01.jpeg", {"width": 290}),
    "supermarket_lv3": ("g_supermarket_lv3/g_supermarket_lv3_v01.jpeg", {"width": 310}),
    "gym_lv1": ("g_gym_lv1/g_gym_lv1_v01.jpeg", {"width": 280}),
    "gym_lv2": ("g_gym_lv2/g_gym_lv2_v01.jpeg", {"width": 290}),
    "gym_lv3": ("g_gym_lv3/g_gym_lv3_v01.jpeg", {"width": 310}),
    "hotel_lv1": ("g_hotel_lv1_r2/g_hotel_lv1_r2_v01.jpeg", {"width": 270}),
    "hotel_lv2": ("g_hotel_lv2/g_hotel_lv2_v01.jpeg", {"width": 280}),
    "hotel_lv3": ("g_hotel_lv3/g_hotel_lv3_v01.jpeg", {"width": 290}),
    "mall_lv1": ("g_mall_lv1_r2/g_mall_lv1_r2_v01.jpeg", {"width": 290}),
    "mall_lv2": ("g_mall_lv2/g_mall_lv2_v01.jpeg", {"width": 300}),
    "mall_lv3": ("g_mall_lv3/g_mall_lv3_v01.jpeg", {"width": 320}),
    "beach_umbrella": ("g_beach_umbrella/g_beach_umbrella_v01.jpeg", {"width": 150}),
    "icon_helpers": ("g_icon_helpers/g_icon_helpers_v01.jpeg", {"width": 176}),
}

# Folhas: arquivo → lista de ids na ordem de leitura (linhas de cima p/ baixo, esq. → dir.)
SHEETS = {
    "g_characters2/g_characters2_v01.png": (
        ["char_vendor", "char_woman", "char_boy", "char_grandma", "char_tourist", "char_kid"],
        {"height": 132},
    ),
    "g_ui_icons/g_ui_icons_v01.png": (
        ["icon_build", "icon_shop", "icon_map", "icon_profile",
         "icon_coin", None, "icon_settings", "icon_help"],  # None = bolha (desenhada no código)
        {"width": 176},
    ),
    "g_helpers_praia/g_helpers_praia_v01.png": (
        ["helper_agua", "helper_pipoca", "helper_sorveteria", "helper_quiosque_coco",
         "helper_mercadinho"],
        {"height": 140},
    ),
    "g_helpers_cidade/g_helpers_cidade_v01.png": (
        ["helper_restaurante", "helper_supermercado", "helper_academia", "helper_hotel",
         "helper_shopping"],
        {"height": 140},
    ),
}
SHEET_OVERRIDES = {"icon_coin": {"width": 96}}

SCENES = {
    "island_base": ("g_island_base/g_island_base_v01.png", (1080, 1920)),
    "city_base": ("g_city_base/g_city_base_v01.png", (1080, 1920)),
}

BG_TOLERANCE = 30  # distância máxima de cor até o fundo (0–441)


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """True nos pixels de fundo conectados à borda e parecidos com a cor de fundo."""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(np.float32)
    bg = np.median(border, axis=0)
    close = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2) <= BG_TOLERANCE

    mask = np.zeros((h, w), dtype=bool)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x]:
                mask[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not mask[y, x]:
                mask[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True
                queue.append((ny, nx))
    return mask


def cutout(im: Image.Image) -> Image.Image:
    """RGB → RGBA com o fundo removido e borda suavizada (sem recortar)."""
    rgb = np.asarray(im.convert("RGB"))
    alpha = Image.fromarray(np.where(background_mask(rgb), 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = im.convert("RGB")
    rgba.putalpha(alpha)
    return rgba


def trim_and_resize(rgba: Image.Image, target: dict) -> Image.Image:
    bbox = rgba.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    rgba = rgba.crop(bbox)
    w, h = rgba.size
    if "width" in target:
        size = (target["width"], round(h * target["width"] / w))
    else:
        size = (round(w * target["height"] / h), target["height"])
    return rgba.resize(size, Image.LANCZOS)


def runs(filled: np.ndarray, min_gap: int) -> list[tuple[int, int]]:
    """Intervalos [início, fim) de posições preenchidas separados por vãos ≥ min_gap."""
    out, start, gap = [], None, 0
    for i, f in enumerate(filled):
        if f:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                out.append((start, i - gap + 1))
                start, gap = None, 0
    if start is not None:
        out.append((start, len(filled) - gap))
    return out


def split_touching(items: list[Image.Image], expected: int) -> list[Image.Image]:
    """Figuras encostadas: divide a peça mais larga na coluna mais vazia do seu miolo."""
    while len(items) < expected:
        i = max(range(len(items)), key=lambda k: items[k].width)
        item = items[i]
        cover = (np.asarray(item.getchannel("A")) > 8).sum(axis=0)
        lo, hi = int(item.width * 0.3), int(item.width * 0.7)
        cut = lo + int(np.argmin(cover[lo:hi]))
        left = item.crop((0, 0, cut, item.height))
        right = item.crop((cut, 0, item.width, item.height))
        items[i:i + 1] = [left, right]
    return items


def split_sheet(rgba: Image.Image) -> list[Image.Image]:
    """Separa itens de uma folha: primeiro em linhas, depois em colunas, pelos vãos."""
    a = np.asarray(rgba.getchannel("A")) > 8
    gap = 3
    items = []
    for y0, y1 in runs(a.any(axis=1), gap):
        row = a[y0:y1]
        for x0, x1 in runs(row.any(axis=0), gap):
            if (x1 - x0) * (y1 - y0) > 400:  # ignora sujeira
                items.append(rgba.crop((x0, y0, x1, y1)))
    return items


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    for name, (rel, target) in SPRITES.items():
        im = Image.open(SRC / rel)
        im.thumbnail((1024, 1024), Image.LANCZOS)
        out = trim_and_resize(cutout(im), target)
        out.save(OUT / f"{name}.png", optimize=True)
        print(f"sprite {name}: {out.size[0]}×{out.size[1]}")

    for rel, (names, target) in SHEETS.items():
        im = Image.open(SRC / rel)
        im.thumbnail((2048, 2048), Image.LANCZOS)
        items = split_touching(split_sheet(cutout(im)), len(names))
        if len(items) != len(names):
            raise SystemExit(f"{rel}: esperava {len(names)} itens, encontrei {len(items)}")
        for name, item in zip(names, items):
            if name is None:
                continue
            out = trim_and_resize(item, SHEET_OVERRIDES.get(name, target))
            out.save(OUT / f"{name}.png", optimize=True)
            print(f"folha  {name}: {out.size[0]}×{out.size[1]}")

    for name, (rel, size) in SCENES.items():
        scene = Image.open(SRC / rel).convert("RGB").resize(size, Image.LANCZOS)
        scene.save(OUT / f"{name}.jpg", quality=88, optimize=True)
        print(f"cena   {name}: {size[0]}×{size[1]}")


if __name__ == "__main__":
    main()
