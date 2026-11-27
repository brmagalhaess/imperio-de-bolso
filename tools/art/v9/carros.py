"""Recorta os carrinhos da folha g9_carros (v9): 3 veículos × frente (indo para baixo-esquerda)
e costas (indo para cima-direita). A van branca fica de fora (some no fundo branco).
Saída: game/assets/optimized/car_<n>_f.png e car_<n>_b.png (n = 1..3), 150 px de largura."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PIL import Image
from process_assets import cutout, split_sheet, trim_and_resize

ROOT = Path(__file__).resolve().parents[3]
sheet = Image.open(ROOT / "game/assets/source/g9_carros/g9_carros_v02.png").convert("RGB")
w, h = sheet.size
sheet = sheet.crop((0, 0, int(w * 0.76), h))  # sem a 4ª coluna (van branca)
for row, kind in ((0, "f"), (1, "b")):
    half = sheet.crop((0, row * h // 2, sheet.width, (row + 1) * h // 2))
    items = sorted(split_sheet(cutout(half)), key=lambda im: -im.width * im.height)[:3]
    print(kind, [i.size for i in items])
    # split_sheet devolve na ordem da folha; os 3 maiores mantêm a ordem pela posição original
    for n, item in enumerate(items, 1):
        trim_and_resize(item, {"width": 150}).save(ROOT / f"game/assets/optimized/car_{n}_{kind}.png")
