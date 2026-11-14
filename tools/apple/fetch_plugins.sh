#!/bin/sh
# Instala em game/addons/ as partes do Godot Apple Plugins (MIT, github.com/migueldeicaza/
# GodotApplePlugins) usadas pelo jogo: login com Apple (AuthenticationServices) e compras
# (StoreKit 2), mais o runtime SwiftGodot. Os binários (~250 MB) não vão para o Git: este script
# baixa a versão fixada e confere o SHA-256 antes de extrair.
#   sh tools/apple/fetch_plugins.sh
set -e
cd "$(dirname "$0")/../.."
BUILD=a6d667dda4d4f7b008009d3704f679b06f81424f
SHA=a5c48a9949fa0f96217c1b8900810098d27cf8d0ac77224d875780e34edc8166
URL="https://github.com/migueldeicaza/GodotApplePlugins/releases/download/build-$BUILD/GodotApplePlugins-addons-$BUILD.zip"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -sL -m 600 -o "$TMP/gap.zip" "$URL"
echo "$SHA  $TMP/gap.zip" | shasum -a 256 -c -
unzip -q "$TMP/gap.zip" -d "$TMP/x"
mkdir -p game/addons
for part in GodotApplePluginsRuntime GodotApplePluginsAuthenticationServices GodotApplePluginsStoreKit; do
  rm -rf "game/addons/$part"
  cp -R "$TMP/x/dist/addons/$part" game/addons/
done
# Só iOS e Mac com Apple Silicon (editor/testes): tira cópias Intel e stubs de Windows/Linux.
find game/addons/GodotApplePlugins* \( -name '*_x64.framework' -o -name '*.dll' -o -name '*.so' \) -prune -exec rm -rf {} +
echo "Godot Apple Plugins $BUILD instalado em game/addons/"
