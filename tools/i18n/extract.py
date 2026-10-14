"""Lista todos os textos traduzíveis do jogo (pt-BR = chave) e atualiza game/i18n/translations.csv.

Fontes: tr("...") nos scripts, MESSAGES e títulos de mapas, textos do tutorial, e os textos que
vêm do servidor (nomes de negócios, missões, conquistas e itens da Loja).
Mantém as traduções já feitas; textos novos entram com en/es vazios (o build avisa).

Uso: python3 tools/i18n/extract.py
"""
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "game/i18n/translations.csv"

STR = r'"((?:[^"\\]|\\.)*)"'


def unescape(s: str) -> str:
    return s.replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")


keys: dict[str, None] = {}


def add(s: str) -> None:
    s = s.strip("\n")
    if s and any(c.isalpha() for c in s):
        keys.setdefault(s, None)


for f in sorted((ROOT / "game/scripts").glob("*.gd")):
    src = f.read_text()
    for m in re.finditer(r"\btr\(" + STR, src):
        add(unescape(m.group(1)))
    if f.name == "game_state.gd":
        block = src[src.index("const MESSAGES") : src.index("}", src.index("const MESSAGES"))]
        for m in re.finditer(r":\s*" + STR, block):
            add(unescape(m.group(1)))
        add("Algo deu errado. Tente novamente.")
    if f.name == "hud.gd":
        add("5 diamantes por dia")  # benefício do VIP (vem do servidor, começa com número)
    if f.name == "layout.gd":
        for m in re.finditer(r'"title":\s*' + STR, src):
            add(unescape(m.group(1)))
        for m in re.finditer(r'"(?:praia|cidade|porto|centro)":\s*' + STR, src[src.index("short_title"):]):
            add(unescape(m.group(1)))
    if f.name == "tutorial.gd":
        block = src[src.index("const TEXTS") : src.index("}", src.index("const TEXTS"))]
        for m in re.finditer(r":\s*" + STR, block):
            add(unescape(m.group(1)))

back = ROOT / "backend/src/economy"
cat = (back / "catalog.ts").read_text()
for m in re.finditer(r'\["[a-z_]+", "([^"]+)"', cat):
    add(m.group(1))
for name in ("missions.ts", "achievements.ts", "store.ts"):
    src = (back / name).read_text()
    for m in re.finditer(r'(?:title|description|subtitle|label|benefits?)\s*:\s*"([^"]+)"', src):
        add(m.group(1))
    for m in re.finditer(r'\[\s*"[a-z_]+",\s*"([^"]+)",\s*"([^"]+)"', src):
        add(m.group(1))
        add(m.group(2))
    # listas de benefícios e textos soltos entre aspas com letra maiúscula
    for m in re.finditer(r'"([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^"]{2,90})"', src):
        add(m.group(1))

old: dict[str, dict] = {}
if CSV_PATH.exists():
    with CSV_PATH.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            old[row["keys"]] = row

CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
missing = 0
with CSV_PATH.open("w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh)
    w.writerow(["keys", "pt_BR", "en", "es"])
    for k in sorted(keys):
        row = old.get(k, {})
        en, es = row.get("en", ""), row.get("es", "")
        missing += (not en) + (not es)
        w.writerow([k, k, en, es])
print(f"{len(keys)} textos · {missing} traduções faltando → {CSV_PATH.relative_to(ROOT)}")
