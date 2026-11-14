# Pipeline de arte — Higgsfield → Godot

Segue `docs/GUIA_ARTE_HIGGSFIELD.md`. Nenhuma geração paga sem autorização do titular.

1. **Chave:** `HF_KEY=<key_id>:<key_secret>` no `.env` da raiz (fora do Git). Nunca imprimir.
2. **Lote:** descreva os jobs em `tools/art/jobs/<lote>.json` (modelo, prompt, variações).
3. **Simular custo** (endpoint `/estimate`, gratuito):
   `node tools/art/hf_generate.mjs tools/art/jobs/<lote>.json --max-usd <teto> --dry-run`
4. **Gerar** (mesmo comando sem `--dry-run`). O teto considera todo o gasto já registrado em
   `generations.jsonl`; repetir o comando não cobra de novo (Idempotency-Key estável).
   Originais → `game/assets/source/<id>/` (ignorados pelo Godot via `.gdignore`).
5. **Escolher** a variação em `tools/art/process_assets.py` e rodar
   `python3 tools/art/process_assets.py` → `game/assets/optimized/` (fundo removido, recorte,
   2× o tamanho de exibição; texturas viram losangos 2:1).
6. **Catálogo:** `python3 tools/art/build_catalog.py` regera `docs/ASSET_CATALOG.csv` a partir
   do log e do mapeamento do passo 5. Para reusar uma imagem como referência:
   `sh tools/art/hf_url.sh <tag>` imprime o link (válido ~7 dias).
7. **Integrar e testar** no Godot (`scripts/city.gd`), capturar tela real e atualizar
   `docs/ASSET_CATALOG.csv` e `docs/IMPLEMENTATION_STATUS.md`.

Modelo padrão (direção v2): `xai/grok-imagine-image-2.0` em modo edição — `image_urls` com o
mockup aprovado (estilo) e a peça aprovada do nível 1 (ângulo/escala); `quality: medium`,
`resolution: 1k` (US$0,07–0,08/imagem em 2026-10-12). Evite descrever trajes de banho (moderação).
`ideogram/v4.0` (US$0,06) serve para mockups/telas; o remix dele falha quando a referência
tem proporção diferente da saída. Links das imagens geradas (CDN) valem ~7 dias: use
`GET /requests/<id>/status` para obtê-los de novo.
