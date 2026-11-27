"""Processa as ilhas únicas (v9, versão "de longe": ilha inteira com o entorno até as bordas).
Escolhe a variação de cada mapa, acha os lotes e grava game/assets/optimized/<mapa>_ilha.jpg, a
miniatura da trilha e game/scripts/layout_v9.gd.

    python3 tools/art/v9/processar.py            # processa tudo
    python3 tools/art/v9/processar.py --contar   # lotes, largura do lote e bordas de cada variação

O mundo de cada mapa é a própria imagem, numa escala em que o lote fica com PAD_WORLD de largura
(bem maior que o prédio: sobra espaço entre as construções). A câmera do jogo nunca sai da imagem.
Escolha manual: tools/art/v9/escolhas.json  {"cidade": 2, ...}; cache da detecção em
/tmp/claude-501/v9_cache.json (a detecção é lenta)."""
import json, sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from lotes import lots

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "game/assets/source"
OUT = ROOT / "game/assets/optimized"
PAD_WORLD = 290.0
ORDER = ["praia", "cidade", "porto", "centro", "industrial", "serra", "ilha", "espaco", "piratas",
         "atlantida", "dinos", "pinguins", "doces", "brinquedos", "lua", "marte", "gatos", "saturno",
         "gelatina", "galaxia"]
HERE = Path(__file__).parent
CHOICES = json.loads((HERE / "escolhas.json").read_text()) if (HERE / "escolhas.json").exists() else {}
CACHE_FILE = Path("/tmp/claude-501/v9_cache.json")
CACHE = json.loads(CACHE_FILE.read_text()) if CACHE_FILE.exists() else {}


def variations(d: str) -> list[Path]:
    # Sem a versão "de longe" (créditos do Higgsfield acabaram em 2026-11-26): usa a da 1ª passada.
    # A 3ª passada (g9_<mapa>_longe3, mais afastada) vale sobre a 2ª.
    # g9_<mapa>_largo = 3ª passada com as bordas expandidas (outpaint), quando ela encostava nos lados.
    return (sorted((SRC / f"g9_{d}_largo").glob("*.png")) or sorted((SRC / f"g9_{d}_longe3").glob("*.png")) or sorted((SRC / f"g9_{d}_longe").glob("*.png"))
            or sorted((SRC / f"g9_{d}_ilha").glob("*.png")))


def detect(path: Path) -> dict:
    key = f"{path.name}:{path.stat().st_mtime_ns}"
    if key in CACHE:
        return CACHE[key]
    (w, h), found = lots(str(path), 0.002)
    ok = [p for p in found if 0.45 <= p["fill"] <= 0.68 and 0.006 < p["area"] / (w * h) < 0.03]
    CACHE[key] = {"w": w, "h": h, "lots": ok}
    CACHE_FILE.write_text(json.dumps(CACHE, default=float))
    return CACHE[key]


def margin(det: dict) -> float:
    """Folga lateral da ilha na imagem, em larguras de lote (a ilha passa ~0,35 lote além dos
    lotes de fora). Negativa = ilha cortada pela borda."""
    if not det["lots"]:
        return -9.0
    pw = float(np.median([p["w"] for p in det["lots"]]))
    left = min(p["x"] for p in det["lots"]) - pw / 2
    right = det["w"] - (max(p["x"] for p in det["lots"]) + pw / 2)
    return round(min(left, right) / pw - 0.35, 2)


def middle(found: list, want: int) -> tuple[list, list]:
    """Os `want` lotes do meio: tira das pontas (cima/baixo) as fileiras de um lote só."""
    pts = sorted(found, key=lambda p: (p["y"], p["x"]))
    extra = []
    while len(pts) > want:
        hh = np.median([p["h"] for p in pts]) / 2
        top = [p for p in pts if p["y"] - pts[0]["y"] < hh * 0.6]
        bot = [p for p in pts if pts[-1]["y"] - p["y"] < hh * 0.6]
        if len(top) <= len(bot):
            extra.append(pts.pop(0))
        else:
            extra.append(pts.pop(-1))
    return pts, extra


def score(det: dict, want: int) -> tuple:
    n = len(det["lots"])
    pad = float(np.median([p["w"] for p in det["lots"]])) if n else 0.0
    # Melhor: sem corte, com lotes suficientes e a ilha o maior possível (mais nitidez).
    return (n < want, margin(det) < 0.0, n > want + 2, -pad)


def main() -> None:
    if "--contar" in sys.argv:
        for d in ORDER:
            print(d, [(len(x["lots"]), round(float(np.median([p["w"] for p in x["lots"]])) if x["lots"] else 0),
                       margin(x)) for x in map(detect, variations(d))])
        return
    out = ["## GERADO por tools/art/v9/processar.py — não edite à mão.",
           "## Ilha única por mapa (2026-11-26): cenário (= mundo), lotes, calçadas e ruas.",
           "extends RefCounted", "", "const ISLANDS := {"]
    for d in ORDER:
        want = 6 if d == "praia" else 12
        vs = variations(d)
        # Escolha "ilha:N" = usar a variação N da 1ª passada (quando a "de longe" saiu ruim).
        if str(CHOICES.get(d, "")).startswith("ilha:"):
            vs = sorted((SRC / f"g9_{d}_ilha").glob("*.png"))
            CHOICES[d] = int(str(CHOICES[d]).split(":")[1])
        if not vs:
            print("SEM ARTE:", d)
            continue
        dets = [detect(v) for v in vs]
        pick = CHOICES.get(d) or min(range(len(vs)), key=lambda i: score(dets[i], want)) + 1
        det, path = dets[pick - 1], vs[pick - 1]
        w, h = det["w"], det["h"]
        pts, extra = middle(det["lots"], want)
        pts.sort(key=lambda p: (round(p["y"] / (h * 0.025)), p["x"]))
        pw = float(np.median([p["w"] for p in pts]))
        ph = float(np.median([p["h"] for p in pts]))
        s = PAD_WORLD / pw
        # Passo da malha: distância (em x e em y) até o vizinho na diagonal.
        dxs, dys = [], []
        for a in pts:
            near = sorted((b for b in pts if b is not a), key=lambda b: (b["x"] - a["x"]) ** 2 + (b["y"] - a["y"]) ** 2)[0]
            dxs.append(abs(near["x"] - a["x"])); dys.append(abs(near["y"] - a["y"]))
        step = (float(np.median(dxs)) * s, float(np.median(dys)) * s)
        im = Image.open(path).convert("RGB")
        im.save(OUT / f"{d}_ilha.jpg", quality=88)
        xs = [p["x"] for p in pts]; ys = [p["y"] for p in pts]
        box = (max(0, int(min(xs) - pw * 1.2)), max(0, int(min(ys) - ph * 1.6)),
               min(w, int(max(xs) + pw * 1.2)), min(h, int(max(ys) + ph * 1.4)))
        thumb = im.crop(box)
        thumb.resize((540, round(540 * thumb.height / thumb.width)), Image.LANCZOS).save(OUT / f"{d}_trilha.jpg", quality=82)
        v2 = lambda x, y: "Vector2(%d, %d)" % (round(x * s), round(y * s))
        out.append('\t"%s": {"base": "%s_ilha.jpg", "size": Vector2(%d, %d), "pad": Vector2(%d, %d), "step": Vector2(%d, %d), '
                   '"lots": [%s], "pads": [%s], "cover": [%s], "cars": %s},'
                   % (d, d, round(w * s), round(h * s), round(pw * s / 2), round(ph * s / 2), round(step[0]), round(step[1]),
                      ", ".join(v2(p["x"], p["foot"]) for p in pts),
                      ", ".join(v2(p["x"], p["y"]) for p in pts + (extra if d == "praia" else [])),
                      ", ".join(v2(p["x"], p["y"]) for p in extra) if d == "praia" else "",
                      "false" if d in ("praia", "atlantida") else "true"))
        flag = "" if len(pts) == want and margin(det) >= 0.0 else "  <-- CONFERIR"
        print(f"{d}: variação {pick}, {len(pts)} lotes de {len(det['lots'])}, lote {pw:.0f}px, mundo {w * s:.0f}×{h * s:.0f}, "
              f"{pw / PAD_WORLD:.2f} px/un, folga {margin(det)}{flag}")
    out += ["}", ""]
    (ROOT / "game/scripts/layout_v9.gd").write_text("\n".join(out))


if __name__ == "__main__":
    main()
