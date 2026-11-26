#!/bin/sh
# Gera e envia uma versão do iOS para a App Store Connect / TestFlight (ADR 0019).
#   sh tools/apple/release.sh <número do build>      ex.: sh tools/apple/release.sh 2
# Pré-requisitos (fora do Git, em ~/.imperio/keys): appstore.env (chave da API), certificado
# "Apple Distribution: Crown Tech LTDA" no Keychain e o perfil "Imperio de Bolso App Store".
# O número do build precisa crescer a cada envio; a versão (1.0.0…) vem do export_presets.cfg.
set -e
BUILD="${1:?informe o número do build (maior que o último enviado)}"
cd "$(dirname "$0")/../.."
. "$HOME/.imperio/keys/appstore.env"
GODOT=/Applications/Godot.app/Contents/MacOS/Godot
OUT=build/ios-release
rm -rf "$OUT" && mkdir -p "$OUT"
sed -i '' "/name=\"iOS\"/,\$ s/^application\/version=\"[0-9]*\"/application\/version=\"$BUILD\"/" game/export_presets.cfg
"$GODOT" --headless --path game --export-release "iOS" "../$OUT/imperio.ipa" >/dev/null 2>&1
cd "$OUT"
xcodebuild -project imperio.xcodeproj -scheme imperio -configuration Release \
  -destination 'generic/platform=iOS' -archivePath imperio.xcarchive \
  -allowProvisioningUpdates -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic CODE_SIGN_IDENTITY="Apple Development" \
  PROVISIONING_PROFILE_SPECIFIER="" PRODUCT_BUNDLE_IDENTIFIER=br.com.imperiodebolso.game archive \
  > archive.log 2>&1 || { grep error: archive.log; exit 1; }
cat > ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>destination</key><string>upload</string>
<key>teamID</key><string>$APPLE_TEAM_ID</string>
<key>signingStyle</key><string>manual</string>
<key>signingCertificate</key><string>Apple Distribution</string>
<key>provisioningProfiles</key><dict><key>br.com.imperiodebolso.game</key><string>Imperio de Bolso App Store</string></dict>
<key>uploadSymbols</key><true/>
<key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath imperio.xcarchive -exportOptionsPlist ExportOptions.plist \
  -exportPath export -authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" > export.log 2>&1 || { grep -i error export.log; exit 1; }
grep -E "Upload succeeded" export.log && echo "Build $BUILD enviado. Processamento na Apple: 5–30 min."
