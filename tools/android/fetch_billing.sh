#!/bin/sh
# Instala em game/addons/GodotGooglePlayBilling o plugin oficial de compras do Google Play
# (MIT, github.com/godot-sdk-integrations/godot-google-play-billing, Billing Library 9.1) — ADR
# 0028. Baixa a versão fixada e confere o SHA-256. Só o exportador e as bibliotecas Android:
# o jogo fala com o plugin direto (scripts/google_store.gd), sem o BillingClient.gd (class_name).
#   sh tools/android/fetch_billing.sh
set -e
cd "$(dirname "$0")/../.."
VER=3.3.0
SHA=20d75623d6f337f08d8283c83098b73678d5f575e39247af5a8eb80588b18568
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -sL -m 600 -o "$TMP/billing.zip" \
  "https://github.com/godot-sdk-integrations/godot-google-play-billing/releases/download/$VER/godot-google-play-billing.zip"
echo "$SHA  $TMP/billing.zip" | shasum -a 256 -c -
unzip -q "$TMP/billing.zip" -d "$TMP/x"
rm -rf game/addons/GodotGooglePlayBilling
mkdir -p game/addons/GodotGooglePlayBilling
cp -R "$TMP/x/GodotGooglePlayBilling/bin" "$TMP/x/GodotGooglePlayBilling/plugin.cfg" \
  "$TMP/x/GodotGooglePlayBilling/export_plugin.gd" "$TMP/x/GodotGooglePlayBilling/LICENSE" \
  game/addons/GodotGooglePlayBilling/
echo "Google Play Billing $VER instalado em game/addons/GodotGooglePlayBilling"
