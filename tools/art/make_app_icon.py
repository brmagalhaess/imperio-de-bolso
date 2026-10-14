"""Ícone do app (Android/Play) a partir da arte do Carrinho de Água — sem gerar imagem nova.

Saída em game/assets/app_icon/:
  icon_512.png          ícone de alta resolução (Play Console e config/icon do Godot)
  icon_192.png          ícone legado do Android
  icon_1024.png         ícone do iOS / App Store (sem transparência)
  adaptive_fg_432.png   primeiro plano do ícone adaptativo (carrinho na zona segura central)
  adaptive_bg_432.png   fundo do ícone adaptativo (mar turquesa com raios de sol)
  monochrome_432.png    ícone temático do Android 13+ (silhueta)

Uso: python3 tools/art/make_app_icon.py
"""

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from process_assets import cutout  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "game/assets/source/g_water_cart_lv1/g_water_cart_lv1_v01.jpeg"
COIN = ROOT / "game/assets/optimized/icon_coin.png"
OUT = ROOT / "game/assets/app_icon"
S = 1728  # trabalha em 4× o tamanho adaptativo (432) e reduz no fim


def background(size: int) -> Image.Image:
    """Mar turquesa da paleta (mockup B) com raios de sol suaves a partir do topo."""
    top, bottom = (0x2B, 0xC4, 0xB6), (0x0B, 0x6F, 0x6B)
    bg = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(bg)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    rays = Image.new("L", (size, size), 0)
    rd = ImageDraw.Draw(rays)
    cx, cy, r = size / 2, size * 0.42, size * 1.2
    for i in range(16):
        a0, a1 = math.radians(i * 22.5), math.radians(i * 22.5 + 10)
        rd.polygon([(cx, cy), (cx + r * math.cos(a0), cy + r * math.sin(a0)),
                    (cx + r * math.cos(a1), cy + r * math.sin(a1))], fill=38)
    rays = rays.filter(ImageFilter.GaussianBlur(size / 90))
    glow = Image.new("L", (size, size), 0)
    ImageDraw.Draw(glow).ellipse([cx - size * 0.36, cy - size * 0.36, cx + size * 0.36, cy + size * 0.36], fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(size / 10))
    white = Image.new("RGB", (size, size), (255, 248, 220))
    bg = Image.composite(white, bg, rays)
    return Image.composite(white, bg, glow)


def foreground(size: int, scale: float) -> Image.Image:
    """Carrinho centralizado ocupando `scale` do lado, com sombra e moeda."""
    cart = cutout(Image.open(SRC))
    cart = cart.crop(cart.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    h = round(size * scale)
    cart = cart.resize((round(cart.width * h / cart.height), h), Image.LANCZOS)
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x, y = (size - cart.width) // 2, (size - cart.height) // 2 + round(size * 0.01)
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sw, sh = cart.width * 0.8, size * 0.07
    ImageDraw.Draw(shadow).ellipse([size / 2 - sw / 2, y + cart.height - sh * 0.6,
                                    size / 2 + sw / 2, y + cart.height + sh * 0.4], fill=(0, 40, 40, 110))
    fg = Image.alpha_composite(fg, shadow.filter(ImageFilter.GaussianBlur(size / 80)))
    fg.alpha_composite(cart, (x, y))
    coin = Image.open(COIN).convert("RGBA")
    c = round(size * scale * 0.34)
    coin = coin.resize((c, round(coin.height * c / coin.width)), Image.LANCZOS)
    fg.alpha_composite(coin, (x + cart.width - round(c * 0.75), y + cart.height - round(c * 0.95)))
    return fg


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    bg = background(S)
    # Adaptativo: o launcher corta até ~33% das bordas; o desenho fica nos 61% centrais.
    fg_adaptive = foreground(S, 0.47)
    # Ícone cheio (512/192): o Play/launcher aplica a máscara; desenho maior.
    full = bg.convert("RGBA")
    full.alpha_composite(foreground(S, 0.74))

    full.resize((512, 512), Image.LANCZOS).save(OUT / "icon_512.png", optimize=True)
    # iOS (App Store) exige 1024×1024 sem transparência.
    full.convert("RGB").resize((1024, 1024), Image.LANCZOS).save(OUT / "icon_1024.png", optimize=True)
    full.resize((192, 192), Image.LANCZOS).save(OUT / "icon_192.png", optimize=True)
    fg_adaptive.resize((432, 432), Image.LANCZOS).save(OUT / "adaptive_fg_432.png", optimize=True)
    bg.resize((432, 432), Image.LANCZOS).save(OUT / "adaptive_bg_432.png", optimize=True)
    alpha = fg_adaptive.getchannel("A").point(lambda v: 255 if v > 100 else 0)
    mono = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    mono.putalpha(alpha)
    mono.resize((432, 432), Image.LANCZOS).save(OUT / "monochrome_432.png", optimize=True)
    # Prévia com máscara redonda, só para conferência (não vai para o jogo).
    preview = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    m = Image.new("L", (512, 512), 0)
    ImageDraw.Draw(m).ellipse([0, 0, 511, 511], fill=255)
    adaptive = bg.convert("RGBA")
    adaptive.alpha_composite(fg_adaptive)
    preview.paste(adaptive.resize((768, 768), Image.LANCZOS).crop((128, 128, 640, 640)), (0, 0), m)
    preview.save(Path(sys.argv[1]) if len(sys.argv) > 1 else OUT / "_preview_round.png")
    print("ícones gerados em", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
