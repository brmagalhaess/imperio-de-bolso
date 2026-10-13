#!/usr/bin/env python3
"""Regera docs/ASSET_CATALOG.csv a partir do log de gerações e do mapeamento em uso.

    python3 tools/art/build_catalog.py

- Assets em uso: tudo que tools/art/process_assets.py transforma (SPRITES, SHEETS, SCENES).
- Demais gerações concluídas: mockups (referência), testes/descartes v2 e arte v1 descontinuada.
- Custo e request id vêm de tools/art/generations.jsonl (última situação de cada requisição).
"""

import csv
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/art"))
import process_assets as pa  # noqa: E402

LOG = ROOT / "tools/art/generations.jsonl"
OUT = ROOT / "docs/ASSET_CATALOG.csv"
LICENSE = "verificar termos de uso comercial da API Higgsfield"
CHOSEN_MOCKUPS = {"mockup_praia_v01", "mockup_praia_v02", "mockup_cidade_v02"}
HEADER = ["id", "nome", "categoria", "versao", "prompt", "referencia", "dimensoes",
          "transparencia", "licenca_status", "custo_aprovado", "fonte", "otimizado",
          "cena_godot", "revisao"]


def generations() -> dict:
    latest = {}
    for line in LOG.read_text().splitlines():
        if line.strip():
            e = json.loads(line)
            latest[e["requestId"]] = e
    return {e["tag"]: e for e in latest.values() if e["status"] == "completed"}


def tag_of(rel: str) -> str:
    return Path(rel).stem


def refs(e: dict) -> str:
    names = {"fa85b3b8": "mockup A", "c4a9d33a": "mockup B", "67ea3561": "mockup D"}
    out = []
    for url in e["input"].get("image_urls", []) + ([e["input"]["image_url"]] if "image_url" in e["input"] else []):
        out.append(next((v for k, v in names.items() if k in url), "peça aprovada anterior"))
    return ", ".join(out)


def category(name: str) -> str:
    if name.startswith("icon_"):
        return "ui"
    if name.startswith("char_"):
        return "character"
    if name.endswith("_base"):
        return "scene"
    if name in ("lot_lock", "beach_umbrella"):
        return "prop"
    return "building"


def main() -> None:
    done = generations()
    rows, used = [], set()

    in_use = [(name, rel) for name, (rel, _t) in pa.SPRITES.items()]
    in_use += [(n, rel) for rel, (names, _t) in pa.SHEETS.items() for n in names if n]
    in_use += [(name, rel) for name, (rel, _s) in pa.SCENES.items()]
    for name, rel in in_use:
        tag = tag_of(rel)
        used.add(tag)
        e = done[tag]
        ext = ".jpg" if name.endswith("_base") else ".png"
        opt = pa.OUT / f"{name}{ext}"
        w, h = Image.open(opt).size
        rows.append([
            name, name.replace("_", " "), category(name), "v2", e["input"]["prompt"], refs(e),
            f"{w}x{h}", "não (cenário)" if ext == ".jpg" else "sim (fundo removido)", LICENSE,
            f"sim — US${e['usd']}", f"{e['files'][0]} · {e['model']} · request {e['requestId']}",
            str(opt.relative_to(ROOT)), "scenes/main.tscn (district_view.gd / hud.gd)",
            "integrado e testado no Godot",
        ])

    for tag, e in sorted(done.items()):
        if tag in used:
            continue
        if tag.startswith("mockup_"):
            cat, rev = "reference", ("alvo visual escolhido (ADR 0004)" if tag in CHOSEN_MOCKUPS
                                     else "mockup não escolhido")
        elif tag.startswith(("g_", "t2_", "t3_", "island_base_")):
            cat, rev = "rejeitado", "teste de estilo ou versão substituída (v2)"
        else:
            cat, rev = "descontinuado", "arte v1 substituída pela direção v2 (ADR 0004)"
        rows.append([tag, "", cat, "v1" if cat == "descontinuado" else "v2", e["input"]["prompt"],
                     refs(e), "", "", LICENSE, f"sim — US${e['usd']}",
                     f"{e['files'][0]} · {e['model']} · request {e['requestId']}", "", "", rev])

    with OUT.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows)
    total = sum(e["usd"] for e in done.values())
    print(f"{len(rows)} linhas ({len(in_use)} em uso) · gasto concluído US${total:.3f}")


if __name__ == "__main__":
    main()
