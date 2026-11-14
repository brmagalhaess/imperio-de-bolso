#!/bin/sh
# Instala em game/addons/admob o plugin AdMob da Poing Studios (MIT, github.com/poingstudios/
# godot-admob-plugin) — anúncios recompensados no iPhone e no Android (ADR 0023/0028). Baixa a
# versão fixada, confere o SHA-256 e instala só o SDK principal (sem redes de mediação).
#   sh tools/apple/fetch_admob.sh
set -e
cd "$(dirname "$0")/../.."
VER=v5.1.0
GODOT=4.7.2
SHA_ADDON=8c53ff52719edf6a81cc7d32a9cdaad2d9e11693c85faca25008a1c19355726f
SHA_IOS=6e7f1c807761f9c0ad45d335ac4c74acd4bba7a31f9e1c7cd16a5220010cce71
SHA_ANDROID=f7fdf644d50c0e231d8f02ae044057e489d0bcafcf50e908a4858477e7ee05ee
BASE="https://github.com/poingstudios/godot-admob-plugin/releases/download/$VER"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -sL -m 600 -o "$TMP/addon.zip" "$BASE/poing-godot-admob-$VER.zip"
curl -sL -m 600 -o "$TMP/ios.zip" "$BASE/ios-template-v$GODOT.zip"
curl -sL -m 600 -o "$TMP/android.zip" "$BASE/android-template-v$GODOT.zip"
echo "$SHA_ADDON  $TMP/addon.zip" | shasum -a 256 -c -
echo "$SHA_IOS  $TMP/ios.zip" | shasum -a 256 -c -
echo "$SHA_ANDROID  $TMP/android.zip" | shasum -a 256 -c -
unzip -q "$TMP/addon.zip" -d "$TMP/addon"
unzip -q "$TMP/ios.zip" -d "$TMP/ios"
unzip -q "$TMP/android.zip" -d "$TMP/android"
rm -rf game/addons/admob
cp -R "$TMP/addon/poing-godot-admob/addons/admob" game/addons/admob
rm -rf game/addons/admob/csharp game/addons/admob/skills game/addons/admob/docs game/addons/admob/gdscript/sample
mkdir -p game/addons/admob/ios/bin game/addons/admob/android/bin
cp -R "$TMP/ios/ads" game/addons/admob/ios/bin/ads
cp "$TMP/ios/package.gd" game/addons/admob/ios/bin/package.gd
cp -R "$TMP/android/ads" game/addons/admob/android/bin/ads
cp "$TMP/android/package.gd" game/addons/admob/android/bin/package.gd
echo "AdMob $VER (iOS e Android, Godot $GODOT) instalado em game/addons/admob"
