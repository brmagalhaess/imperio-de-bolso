#!/bin/sh
# Cria um jogo novo a partir deste motor (Império de Bolso): copia o repositório sem Git,
# segredos, builds e arte original, e troca nome, slug, bundle id e domínios.
#
#   sh tools/novo_jogo.sh <pasta_destino> "<Nome do Jogo>" <slug> <bundle_id> <subdominio>
#   ex.: sh tools/novo_jogo.sh ~/Documents/Projetos/reino-de-bolso "Reino de Bolso" \
#          reino-de-bolso br.com.reinodebolso reino
#
# <subdominio> vira: site <sub>.crowntech.com.br · API api-<sub>.crowntech.com.br ·
# painel admin-<sub>.crowntech.com.br. Depois rode o checklist impresso no final.
set -e
DEST=${1:?pasta de destino}
NAME=${2:?nome do jogo, ex.: "Reino de Bolso"}
SLUG=${3:?slug, ex.: reino-de-bolso}
BUNDLE=${4:?bundle id, ex.: br.com.reinodebolso}
SUB=${5:?subdominio, ex.: reino}
ROOT_DOMAIN=crowntech.com.br
SRC=$(cd "$(dirname "$0")/.." && pwd)

[ -e "$DEST" ] && { echo "Já existe: $DEST (escolha outra pasta)"; exit 1; }
mkdir -p "$DEST"

# 1) Cópia sem o que é deste jogo ou gerado (arte original fica de fora; a otimizada vem
#    como PLACEHOLDER para o jogo novo abrir e testar desde o primeiro minuto).
rsync -a "$SRC/" "$DEST/" \
  --exclude .git --exclude node_modules --exclude '.env' --exclude '.env.*.local' \
  --exclude build --exclude out --exclude .next --exclude dist --exclude '*.tsbuildinfo' \
  --exclude 'game/.godot' --exclude 'game/addons/GodotApplePlugins*' --exclude 'game/addons/admob' \
  --exclude 'game/assets/source' --exclude 'game/override.cfg' \
  --exclude 'backend/src/generated' --exclude 'docs/lojas/capturas' \
  --exclude 'docs/Imperio_de_Bolso_Documentacao_Completa.docx'
cp "$SRC/backend/.env.example" "$DEST/backend/.env.example" 2>/dev/null || true

# 2) Troca de identificadores em todos os arquivos de texto (ordem importa: o mais específico
#    primeiro). IDs de loja/anúncio deste jogo viram marcadores a preencher.
NAME_ASCII=$(printf '%s' "$NAME" | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || printf '%s' "$NAME")
BUNDLE_TAIL=${BUNDLE##*.}
cd "$DEST"
SUB="$SUB" ROOT="$ROOT_DOMAIN" BUNDLE="$BUNDLE" TAIL="$BUNDLE_TAIL" SLUG="$SLUG" NAME="$NAME" \
NAME_ASCII="$NAME_ASCII" python3 - <<'PY'
import os
e = os.environ
pairs = [
    ("api-imperio.crowntech.com.br", f"api-{e['SUB']}.{e['ROOT']}"),
    ("admin-imperio.crowntech.com.br", f"admin-{e['SUB']}.{e['ROOT']}"),
    ("imperio.crowntech.com.br", f"{e['SUB']}.{e['ROOT']}"),
    ("suporte-imperio@", f"suporte-{e['SUB']}@"),
    ("br.com.imperiodebolso", e["BUNDLE"]),
    ("imperiodebolso", e["TAIL"]),
    ("imperio-de-bolso", e["SLUG"]),
    ("Império de Bolso", e["NAME"]),
    ("Imperio de Bolso", e["NAME_ASCII"]),
    ("6822892071", "PREENCHER_APP_ID_APPLE"),
    ("ca-app-pub-9538653038510274~3260733869", "ca-app-pub-3940256099942544~1458002511"),
    ("ca-app-pub-9538653038510274/3843187791", ""),
    ("pub-9538653038510274", "PREENCHER_PUB_ADMOB"),
    ("55432", "55433"),  # banco local não colide com o do jogo de origem
]
skip_dirs = {".git", "node_modules"}
changed = 0
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for f in files:
        if f == "novo_jogo.sh" or f.endswith((".png", ".jpg", ".jpeg", ".webp", ".ttf", ".ogg", ".wav", ".mp3", ".ico", ".docx")):
            continue
        path = os.path.join(root, f)
        try:
            text = open(path, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        new = text
        for a, b in pairs:
            new = new.replace(a, b)
        if new != text:
            open(path, "w", encoding="utf-8").write(new)
            changed += 1
print(f"arquivos atualizados: {changed}")
PY

# 3) Estado do projeto novo: histórico e capturas deste jogo não valem lá.
: > tools/art/generations.jsonl
rm -f landing/public/app-ads.txt
cat > docs/IMPLEMENTATION_STATUS.md <<EOF
# Status de implementação — $NAME

Criado a partir do motor do Império de Bolso (tools/novo_jogo.sh) em $(date +%Y-%m-%d).
Arte em game/assets/optimized é PLACEHOLDER (do jogo de origem) até a arte nova entrar.
EOF
printf '# Backlog — %s\n\nVer docs/PROMPT_NOVO_JOGO.md (fases 1–9).\n' "$NAME" > docs/BACKLOG.md

git init -q && git checkout -q -b main && git add -A && \
  git -c user.name="${GIT_AUTHOR_NAME:-$(git -C "$SRC" config user.name)}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-$(git -C "$SRC" config user.email)}" \
      commit -qm "Base do $NAME a partir do motor do Império de Bolso"

echo "Pronto: $DEST ($NAME · $SLUG · $BUNDLE · $SUB.$ROOT_DOMAIN)"
echo "Restos do jogo de origem (revisar à mão):"
python3 - <<'PY'
import os
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in {".git", "node_modules"}]
    for f in files:
        p = os.path.join(root, f)
        try: t = open(p, encoding="utf-8").read()
        except Exception: continue
        if "PREENCHER" in t: print("  a preencher:", p)
PY
echo "Próximo: siga docs/PROMPT_NOVO_JOGO.md a partir da Fase 1."
