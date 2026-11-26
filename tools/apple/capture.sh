#!/bin/sh
# Capturas do jogo para as lojas num tamanho exato (renderiza na proporção e escala com Lanczos).
#   sh tools/apple/capture.sh <modo DEMO> <largura> <altura> <pasta> [largura_render]
# ex.: sh tools/apple/capture.sh capturas 1206 2622 docs/lojas/capturas/iphone-6.3
# A janela do Mac limita a altura (~1900 px): renderiza menor e amplia até o tamanho pedido.
set -e
cd "$(dirname "$0")/../.."
MODE=$1 W=$2 H=$3 OUT=$4
RW=${5:-$(python3 -c "print(min($W, int(1860*$W/$H)))")}
RH=$(python3 -c "print(round($RW*$H/$W))")
mkdir -p "$OUT"
TMP=$(mktemp -d)
# Só a janela muda; a resolução base (720×1280, stretch "expand") continua a do jogo.
printf '[display]\nwindow/size/window_width_override=%s\nwindow/size/window_height_override=%s\n' "$RW" "$RH" > game/override.cfg
trap 'rm -f game/override.cfg; rm -rf "$TMP"' EXIT
DEMO=$MODE CAPTURE_DIR="$TMP" perl -e 'alarm 240; exec @ARGV' /Applications/Godot.app/Contents/MacOS/Godot --path game res://tests/demo_runner.tscn 2>&1 | grep PASSO || true
python3 - "$TMP" "$OUT" "$W" "$H" <<'PY'
import sys, glob, os
from PIL import Image
src, out, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
for f in sorted(glob.glob(os.path.join(src, "*.png"))):
    im = Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS)
    dest = os.path.join(out, os.path.basename(f).replace(".png", ".jpg"))
    im.save(dest, quality=92)
    print(dest, im.size)
PY
