#!/bin/sh
# Instala o APK de depuração no Android conectado por cabo e abre o jogo apontando para a API
# local (adb reverse: 127.0.0.1:3000 no celular → 3000 no Mac). Requer `npm run dev` no backend.
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
