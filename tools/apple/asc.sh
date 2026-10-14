#!/bin/sh
# API da App Store Connect: sh tools/apple/asc.sh MÉTODO /v1/caminho ['json']
cd "$(dirname "$0")/../.." || exit 1
TOKEN=$(node tools/apple/asc.mjs) || exit 1
if [ -n "$3" ]; then
  curl -s -m 60 -X "$1" "https://api.appstoreconnect.apple.com$2" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$3"
else
  curl -s -m 60 -X "$1" "https://api.appstoreconnect.apple.com$2" -H "Authorization: Bearer $TOKEN"
fi
