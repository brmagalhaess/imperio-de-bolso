#!/bin/sh
# Instala o APK de depuração no Android conectado por cabo e abre o jogo. O APK usa a API do
# servidor (api/base_url.android no project.godot). Para testar contra a API local do Mac,
# exporte com IMPERIO_API_URL não funciona no Android: troque base_url.android para
# http://127.0.0.1:3000/api/v1 — o adb reverse abaixo leva a porta 3000 do celular ao Mac.
#   tools/android/run_device.sh            exporta, instala e abre
#   tools/android/run_device.sh --no-export  só instala o APK já exportado
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
GODOT="${GODOT:-/Applications/Godot.app/Contents/MacOS/Godot}"
APK="$ROOT/build/android/imperio-de-bolso-debug.apk"
PKG="br.com.imperiodebolso.game"

"$ADB" get-state >/dev/null 2>&1 || { echo "Nenhum Android conectado (ative a Depuração USB e autorize o Mac)." >&2; exit 1; }
if [ "${1:-}" != "--no-export" ]; then
  mkdir -p "$ROOT/build/android"
  "$GODOT" --headless --path "$ROOT/game" --export-debug "Android" "$APK" >/dev/null 2>&1
fi
"$ADB" reverse tcp:3000 tcp:3000
"$ADB" install -r "$APK"
"$ADB" shell am force-stop "$PKG"
"$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
echo "Aberto em $("$ADB" shell getprop ro.product.model | tr -d '\r'). Logs: $ADB logcat -s godot"
