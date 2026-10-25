#!/usr/bin/env python3
"""Processa a arte v8 (20 mapas, ADR 0034) para game/assets/optimized/:
folhas de evolução → <slug>_lv1..5.png; folhas de ajudantes → helper_<slug>.png; cenários novos →
<mapa>_base.jpg; ilhas → <mapa>_expansao.png / <mapa>_expansao2.png; miniaturas da trilha →
<mapa>_trilha.jpg. Imprime as cores de cada cenário (para o layout.gd).

    python3 tools/art/v8/processar.py
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/art"))
from process_assets import SRC, OUT, cutout, split_sheet, split_touching, trim_and_resize  # noqa: E402

LV_WIDTH = [290, 305, 320, 330, 340]
NEW = ["piratas", "atlantida", "dinos", "pinguins", "doces", "brinquedos", "lua", "marte", "gatos",
       "saturno", "gelatina", "galaxia"]
OLD = ["praia", "cidade", "porto", "centro", "industrial", "serra", "ilha", "espaco"]
# Variação escolhida de cada cena (revisão visual); o resto usa _v01.
CHOICE = json.load(open(Path(__file__).parent / "escolhas.json")) if (Path(__file__).parent / "escolhas.json").exists() else {}
TOP, BOTTOM, FADE_TOP, FADE_BOTTOM, SCALE = 250, 1120, 150, 140, 1.5


def src(job: str) -> Path | None:
    v = CHOICE.get(job, "v01")
    for ext in (".jpeg", ".png", ".jpg", ".webp"):
        p = SRC / job / f"{job}_{v}{ext}"
        if p.exists():
            return p
    return None


def hexc(rgb) -> str:
    return "%02x%02x%02x" % tuple(int(c) for c in rgb)


def island(job: str, out: str) -> str | None:
    p = src(job)
    if p is None:
        return None
    im = Image.open(p).convert("RGB").resize((720, 1280), Image.LANCZOS)
    crop = im.crop((0, TOP, 720, BOTTOM))
    h = BOTTOM - TOP
    alpha = np.full((h, 720), 255, dtype=np.float32)
    alpha[:FADE_TOP] *= (np.linspace(0, 1, FADE_TOP) ** 1.5)[:, None]
    alpha[h - FADE_BOTTOM:] *= np.linspace(1, 0, FADE_BOTTOM)[:, None]
    rgba = crop.convert("RGBA")
    rgba.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    rgba.resize((int(720 * SCALE), int(h * SCALE)), Image.LANCZOS).save(OUT / out, optimize=True)
    # Cor do mar: média dos cantos de cima da faixa (onde só há fundo).
    return hexc(np.asarray(crop)[:60, :80].reshape(-1, 3).mean(0))


def main() -> None:
    cat = json.load(open("/tmp/claude-501/catalog_new.json"))
    old = {e["slug"] for e in json.load(open("/tmp/claude-501/catalog_old.json"))}
    missing = []
    for e in cat:
        s = e["slug"]
        if s in old:
            continue
        p = src(f"g8_{s}_lv")
        if p is None:
            missing.append(s)
            continue
        im = Image.open(p)
        im.thumbnail((2048, 2048), Image.LANCZOS)
        items = split_touching(split_sheet(cutout(im)), 5)
        if len(items) != 5:
            print(f"! {s}: {len(items)} peças na folha (esperava 5)")
            missing.append(s)
            continue
        items.sort(key=lambda it: 0)  # split_sheet já devolve da esquerda para a direita
        for lv, (it, w) in enumerate(zip(items, LV_WIDTH), start=1):
            trim_and_resize(it, {"width": w}).save(OUT / f"{s}_lv{lv}.png", optimize=True)
    print("folhas sem arte:", missing)

    for f in sorted((ROOT / "tools/art/jobs").glob("v8-ajudantes.json")):
        for job in json.load(open(f)):
            p = src(job["id"])
            if p is None:
                print("ajudantes sem arte:", job["id"])
                continue
            im = Image.open(p)
            im.thumbnail((2048, 2048), Image.LANCZOS)
            items = split_touching(split_sheet(cutout(im)), len(job["slugs"]))
            if len(items) != len(job["slugs"]):
                print(f"! {job['id']}: {len(items)} personagens (esperava {len(job['slugs'])})")
                continue
            for s, it in zip(job["slugs"], items):
                trim_and_resize(it, {"height": 140}).save(OUT / f"helper_{s}.png", optimize=True)

    colors = {}
    for d in NEW:
        p = src(f"g8_{d}_base")
        if p is None:
            print("cenário sem arte:", d)
            continue
        im = Image.open(p).convert("RGB")
        im.resize((1080, 1920), Image.LANCZOS).save(OUT / f"{d}_base.jpg", quality=88, optimize=True)
        a = np.asarray(im.resize((720, 1280)))
        colors[d] = {"top": hexc(a[:40].reshape(-1, 3).mean(0)), "bottom": hexc(a[-40:].reshape(-1, 3).mean(0))}
        colors[d]["sea"] = island(f"g8_{d}_ilhota1", f"{d}_expansao.png")
        island(f"g8_{d}_ilhota2", f"{d}_expansao2.png")
    for d in OLD:
        sea = island(f"g8_{d}_ilhota2", f"{d}_expansao.png" if d == "praia" else f"{d}_expansao2.png")
        colors[d] = {"sea": sea}
    # Miniaturas da trilha de mapas (a trilha abre os 20 de uma vez).
    names = {"praia": "island_base", "cidade": "city_base"}
    for d in OLD + NEW:
        p = OUT / f"{names.get(d, d + '_base')}.jpg"
        if p.exists():
            Image.open(p).convert("RGB").resize((360, 640), Image.LANCZOS).save(OUT / f"{d}_trilha.jpg", quality=85)
    json.dump(colors, open(Path(__file__).parent / "cores.json", "w"), indent=1)
    print(json.dumps(colors))


if __name__ == "__main__":
    main()
