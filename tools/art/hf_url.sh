#!/bin/sh
# Imprime o link (CDN, válido ~7 dias) da imagem gerada para uma tag do generations.jsonl.
#   sh tools/art/hf_url.sh g_restaurant_lv2_v01
cd "$(dirname "$0")/../.." || exit 1
REQ=$(grep "\"tag\":\"$1\"" tools/art/generations.jsonl | tail -1 | python3 -c 'import sys,json;print(json.loads(sys.stdin.read())["requestId"])')
HF_KEY=$(grep -E '^HF_KEY=' .env | cut -d= -f2-)
curl -s -m 20 "https://api.higgsfield.ai/requests/$REQ/status" -H "Authorization: Key $HF_KEY" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["images"][0]["url"])'
