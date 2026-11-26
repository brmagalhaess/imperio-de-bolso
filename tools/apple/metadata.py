#!/usr/bin/env python3
"""Aplica os textos e dados da página da App Store (tools/apple/store_texts.json) pela API.
    python3 tools/apple/metadata.py
"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = "6822892071"
T = json.loads((ROOT / "tools/apple/store_texts.json").read_text())
LOCALES = ["pt-BR", "en-US", "es-ES"]


def api(method, path, body=None):
    args = ["sh", str(ROOT / "tools/apple/asc.sh"), method, path] + ([json.dumps(body)] if body else [])
    out = subprocess.run(args, capture_output=True, text=True).stdout
    data = json.loads(out) if out.strip() else {}
    if "errors" in data:
        print(f"! {method} {path}: " + "; ".join(e.get("detail", e.get("title", "")) for e in data["errors"]))
    return data


# Versão em preparação; se não houver (a anterior já está à venda), cria a de store_texts.json.
editable = [v for v in api("GET", f"/v1/apps/{APP}/appStoreVersions")["data"]
            if v["attributes"]["appStoreState"] in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED")]
if editable:
    vid = editable[0]["id"]
else:
    vid = api("POST", "/v1/appStoreVersions", {"data": {"type": "appStoreVersions",
        "attributes": {"platform": "IOS", "versionString": T["version"]},
        "relationships": {"app": {"data": {"type": "apps", "id": APP}}}}})["data"]["id"]
info = api("GET", f"/v1/apps/{APP}/appInfos")["data"][0]
iid = info["id"]

api("PATCH", f"/v1/appStoreVersions/{vid}", {"data": {"type": "appStoreVersions", "id": vid, "attributes": {
    "versionString": T["version"], "copyright": T["copyright"], "releaseType": "AFTER_APPROVAL"}}})

# Textos da versão (descrição, palavras-chave, texto promocional, URLs).
existing = {l["attributes"]["locale"]: l["id"] for l in
            api("GET", f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations")["data"]}
for loc in LOCALES:
    x = T[loc]
    attrs = {"description": x["description"], "keywords": x["keywords"], "promotionalText": x["promotionalText"],
             "supportUrl": T["urls"]["support"], "marketingUrl": T["urls"]["marketing"]}
    if x.get("whatsNew") and T["version"] != "1.0.0":  # a primeira versão não aceita "Novidades"
        attrs["whatsNew"] = x["whatsNew"]
    if loc in existing:
        api("PATCH", f"/v1/appStoreVersionLocalizations/{existing[loc]}",
            {"data": {"type": "appStoreVersionLocalizations", "id": existing[loc], "attributes": attrs}})
    else:
        api("POST", "/v1/appStoreVersionLocalizations", {"data": {"type": "appStoreVersionLocalizations",
            "attributes": {**attrs, "locale": loc},
            "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})

# Nome, subtítulo e política de privacidade por idioma.
existing = {l["attributes"]["locale"]: l["id"] for l in api("GET", f"/v1/appInfos/{iid}/appInfoLocalizations")["data"]}
for loc in LOCALES:
    attrs = {"name": T[loc]["name"], "subtitle": T[loc]["subtitle"], "privacyPolicyUrl": T["urls"]["privacy"]}
    if loc in existing:
        api("PATCH", f"/v1/appInfoLocalizations/{existing[loc]}",
            {"data": {"type": "appInfoLocalizations", "id": existing[loc], "attributes": attrs}})
    else:
        api("POST", "/v1/appInfoLocalizations", {"data": {"type": "appInfoLocalizations",
            "attributes": {**attrs, "locale": loc},
            "relationships": {"appInfo": {"data": {"type": "appInfos", "id": iid}}}}})

# Categoria: Jogos › Simulação / Casual.
api("PATCH", f"/v1/appInfos/{iid}", {"data": {"type": "appInfos", "id": iid, "relationships": {
    "primaryCategory": {"data": {"type": "appCategories", "id": "GAMES"}},
    "primarySubcategoryOne": {"data": {"type": "appCategories", "id": "GAMES_SIMULATION"}},
    "primarySubcategoryTwo": {"data": {"type": "appCategories", "id": "GAMES_CASUAL"}}}}})

# Direitos de conteúdo: usa conteúdo de terceiros com licença (músicas/efeitos CC0).
api("PATCH", f"/v1/apps/{APP}", {"data": {"type": "apps", "id": APP, "attributes": {
    "contentRightsDeclaration": "USES_THIRD_PARTY_CONTENT"}}})
print("ok: versão", vid, "· appInfo", iid)
