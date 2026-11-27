"""Segunda passada da v9 (2026-11-26, pedido do titular): a ilha aparecia cortada nas bordas da
imagem e com um "quadrado" em volta. Aqui cada cenário escolhido é refeito com a câmera mais
longe: ilha inteira no centro e o entorno (mar, espaço, deserto) uniforme até as quatro bordas.
Uso: python3 tools/art/v9/afastar.py [mapa ...]   (sem nomes = todos)"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
M = "xai/grok-imagine-image-2.0"
PICK = {"praia": 3, "atlantida": 2, "galaxia": 2}
SEA = "calm open turquoise sea with gentle small waves"
SPACE = "deep dark outer space with small stars"
AROUND = {
    "serra": "calm icy blue sea with a few small ice floes", "pinguins": "calm icy blue sea with a few small ice floes",
    "atlantida": "open underwater turquoise ocean with soft light rays, bubbles and a sandy sea floor",
    "doces": "a calm sea of pink strawberry milk", "marte": "a flat red martian desert plain with small rocks",
    "lua": SPACE, "gatos": SPACE, "saturno": SPACE, "gelatina": SPACE, "galaxia": SPACE,
}
ORDER = ["praia", "cidade", "porto", "centro", "industrial", "serra", "ilha", "espaco", "piratas",
         "atlantida", "dinos", "pinguins", "doces", "brinquedos", "lua", "marte", "gatos", "saturno",
         "gelatina", "galaxia"]


def url(tag: str) -> str:
    return subprocess.run(["sh", str(ROOT / "tools/art/hf_url.sh"), tag], capture_output=True, text=True).stdout.strip()


def job(d: str) -> dict:
    around = AROUND.get(d, SEA)
    n = "six" if d == "praia" else "twelve"
    prompt = (f"Zoom the camera out. Show the SAME island exactly as it is, but smaller: the island takes about 60 percent of the image width, centered, "
              "COMPLETELY visible with all four corners of the island inside the picture and nothing cut by the image edges. "
              f"All around the island, on every side and up to all four image edges, there is only {around}, uniform and continuous, with no horizon, no sky, "
              "no far objects, no ships, no planets, no mountains and no other islands. "
              f"Keep the same glossy cartoon mobile city-builder art style, the same isometric camera angle, the same roads with crosswalks, the same {n} large EMPTY flat building lots "
              "(plain light concrete plazas, nothing on them) in the same arrangement and the same decorations on the island. "
              "No buildings on the lots. No people, no cars, no text, no letters, no numbers, no logos, no flags, no UI.")
    return {"id": f"g9_{d}_longe", "model": M, "variations": 2,
            "input": {"prompt": prompt, "image_urls": [url(f"g9_{d}_ilha_v{PICK.get(d, 1):02d}")],
                      "aspect_ratio": "3:4", "resolution": "2k"}}


if __name__ == "__main__":
    which = sys.argv[1:] or ORDER
    out = ROOT / "tools/art/jobs" / ("v9-longe.json" if not sys.argv[1:] else "v9-longe-teste.json")
    json.dump([job(d) for d in which], open(out, "w"), ensure_ascii=False, indent=1)
    print(out.name, len(which), "mapas")
