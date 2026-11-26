#!/usr/bin/env python3
"""Cadastra as compras do jogo na App Store Connect (ADR 0022). Pode rodar de novo: pula o que
já existe. Preços em reais (território BRA); a Apple equaliza os outros países.

    python3 tools/apple/iap_setup.py

Produtos (iguais a backend/src/economy/store.ts):
  br.com.imperiodebolso.gems_50   consumível   R$ 4,90
  br.com.imperiodebolso.gems_120  consumível   R$ 9,90
  br.com.imperiodebolso.gems_300  consumível   R$ 19,90
  br.com.imperiodebolso.vip_monthly  assinatura mensal  R$ 14,90  (grupo "Passe VIP")
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = "6822892071"

GEMS = [
    ("gems_50", "4.9", 50, "Punhado de diamantes", "Handful of gems", "Puñado de diamantes"),
    ("gems_120", "9.9", 120, "Saco de diamantes", "Bag of gems", "Bolsa de diamantes"),
    ("gems_300", "19.9", 300, "Baú de diamantes", "Chest of gems", "Cofre de diamantes"),
]
LOCALES = ("pt-BR", "en-US", "es-ES")


def asc(method, path, body=None):
    args = ["sh", str(ROOT / "tools/apple/asc.sh"), method, path]
    if body is not None:
        args.append(json.dumps(body))
    out = subprocess.run(args, capture_output=True, text=True).stdout
    try:
        data = json.loads(out) if out.strip() else {}
    except json.JSONDecodeError:
        sys.exit(f"resposta inválida em {method} {path}: {out[:300]}")
    if "errors" in data:
        sys.exit(f"ERRO {method} {path}: {json.dumps(data['errors'], ensure_ascii=False)[:1200]}")
    return data


def all_pages(path):
    items, url = [], path
    while url:
        d = asc("GET", url)
        items += d.get("data", [])
        nxt = d.get("links", {}).get("next")
        url = nxt.replace("https://api.appstoreconnect.apple.com", "") if nxt else None
    return items


def app_territories():
    return [t["id"] for t in all_pages(f"/v1/apps/{APP}/appAvailabilityV2/territoryAvailabilities?limit=200&include=territory")
            if t["attributes"].get("available")] or None


def territories_of_app():
    av = asc("GET", f"/v1/apps/{APP}/appAvailabilityV2")
    av_id = av["data"]["id"]
    rows = all_pages(f"/v2/appAvailabilities/{av_id}/territoryAvailabilities?limit=200&include=territory")
    return [r["relationships"]["territory"]["data"]["id"] for r in rows if r["attributes"].get("available")]


def gem_desc(n):
    return (f"{n} diamantes para usar na Loja do jogo",
            f"{n} gems to spend in the game Store",
            f"{n} diamantes para usar en la Tienda del juego")


def setup_gems(territories):
    existing = {x["attributes"]["productId"]: x["id"] for x in all_pages(f"/v1/apps/{APP}/inAppPurchasesV2?limit=50")}
    for slug, price, n, pt, en, es in GEMS:
        pid = f"br.com.imperiodebolso.{slug}"
        if pid in existing:
            print(f"= {pid} já existe")
            continue
        iap = asc("POST", "/v2/inAppPurchases", {"data": {"type": "inAppPurchases", "attributes": {
            "name": pt, "productId": pid, "inAppPurchaseType": "CONSUMABLE", "familySharable": False,
            "reviewNote": f"Credita {n} diamantes na conta do jogador (verificado no servidor)."},
            "relationships": {"app": {"data": {"type": "apps", "id": APP}}}}})["data"]["id"]
        for loc, name, desc in zip(LOCALES, (pt, en, es), gem_desc(n)):
            asc("POST", "/v1/inAppPurchaseLocalizations", {"data": {"type": "inAppPurchaseLocalizations",
                "attributes": {"locale": loc, "name": name, "description": desc},
                "relationships": {"inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": iap}}}}})
        points = asc("GET", f"/v2/inAppPurchases/{iap}/pricePoints?filter%5Bterritory%5D=BRA&limit=800")["data"]
        point = next(p for p in points if p["attributes"]["customerPrice"] in (price, price + "0"))
        asc("POST", "/v1/inAppPurchasePriceSchedules", {
            "data": {"type": "inAppPurchasePriceSchedules", "relationships": {
                "inAppPurchase": {"data": {"type": "inAppPurchases", "id": iap}},
                "baseTerritory": {"data": {"type": "territories", "id": "BRA"}},
                "manualPrices": {"data": [{"type": "inAppPurchasePrices", "id": "${p0}"}]}}},
            "included": [{"type": "inAppPurchasePrices", "id": "${p0}", "attributes": {"startDate": None},
                          "relationships": {"inAppPurchasePricePoint": {"data": {"type": "inAppPurchasePricePoints", "id": point["id"]}}}}]})
        asc("POST", "/v1/inAppPurchaseAvailabilities", {"data": {"type": "inAppPurchaseAvailabilities",
            "attributes": {"availableInNewTerritories": True},
            "relationships": {"inAppPurchase": {"data": {"type": "inAppPurchases", "id": iap}},
                              "availableTerritories": {"data": [{"type": "territories", "id": t} for t in territories]}}}})
        print(f"+ {pid} criado (R$ {price})")


def setup_vip(territories):
    groups = asc("GET", f"/v1/apps/{APP}/subscriptionGroups")["data"]
    group = next((g["id"] for g in groups if g["attributes"]["referenceName"] == "Passe VIP"), None)
    if not group:
        group = asc("POST", "/v1/subscriptionGroups", {"data": {"type": "subscriptionGroups",
            "attributes": {"referenceName": "Passe VIP"},
            "relationships": {"app": {"data": {"type": "apps", "id": APP}}}}})["data"]["id"]
        for loc, name in zip(LOCALES, ("Passe VIP", "VIP Pass", "Pase VIP")):
            asc("POST", "/v1/subscriptionGroupLocalizations", {"data": {"type": "subscriptionGroupLocalizations",
                "attributes": {"locale": loc, "name": name},
                "relationships": {"subscriptionGroup": {"data": {"type": "subscriptionGroups", "id": group}}}}})
        print("+ grupo Passe VIP criado")
    subs = asc("GET", f"/v1/subscriptionGroups/{group}/subscriptions")["data"]
    sub = next((x["id"] for x in subs if x["attributes"]["productId"] == "br.com.imperiodebolso.vip_monthly"), None)
    if not sub:
        sub = asc("POST", "/v1/subscriptions", {"data": {"type": "subscriptions", "attributes": {
            "name": "Passe VIP mensal", "productId": "br.com.imperiodebolso.vip_monthly",
            "subscriptionPeriod": "ONE_MONTH", "groupLevel": 1, "familySharable": False,
            "reviewNote": "Assinatura mensal: auto-coleta em todos os mapas, produção 50% mais rápida e 5 diamantes por dia (verificada no servidor)."},
            "relationships": {"group": {"data": {"type": "subscriptionGroups", "id": group}}}}})["data"]["id"]
        print("+ assinatura vip_monthly criada")
    have_locs = {l["attributes"]["locale"] for l in asc("GET", f"/v1/subscriptions/{sub}/subscriptionLocalizations")["data"]}
    texts = (("Passe VIP", "Auto-coleta, +50% de velocidade e 5 diamantes/dia"),
             ("VIP Pass", "Auto-collect, +50% speed and 5 gems a day"),
             ("Pase VIP", "Auto-recolección, +50% velocidad y 5 diamantes/día"))
    for loc, (name, desc) in zip(LOCALES, texts):
        if loc in have_locs:
            continue
        asc("POST", "/v1/subscriptionLocalizations", {"data": {"type": "subscriptionLocalizations",
            "attributes": {"locale": loc, "name": name, "description": desc},
            "relationships": {"subscription": {"data": {"type": "subscriptions", "id": sub}}}}})
    try_av = subprocess.run(["sh", str(ROOT / "tools/apple/asc.sh"), "GET", f"/v1/subscriptions/{sub}/subscriptionAvailability"], capture_output=True, text=True).stdout
    if '"errors"' in try_av or '"data" : null' in try_av:
        asc("POST", "/v1/subscriptionAvailabilities", {"data": {"type": "subscriptionAvailabilities",
            "attributes": {"availableInNewTerritories": True},
            "relationships": {"subscription": {"data": {"type": "subscriptions", "id": sub}},
                              "availableTerritories": {"data": [{"type": "territories", "id": t} for t in territories]}}}})
    if asc("GET", f"/v1/subscriptions/{sub}/prices?limit=1")["data"]:
        print("= preços do VIP já cadastrados")
        return
    points = all_pages(f"/v1/subscriptions/{sub}/pricePoints?filter%5Bterritory%5D=BRA&limit=200")
    point = next(p for p in points if p["attributes"]["customerPrice"] in ("14.9", "14.90"))
    # Preço base no Brasil + equivalentes da Apple em TODOS os países (175): a Apple recusa enviar a
    # assinatura se faltar preço em algum, mesmo onde o app não é vendido (ex.: UE).
    targets = [point] + all_pages(f"/v1/subscriptionPricePoints/{point['id']}/equalizations?limit=200&include=territory")
    for p in targets:
        asc("POST", "/v1/subscriptionPrices", {"data": {"type": "subscriptionPrices",
            "attributes": {"preserveCurrentPrice": False},
            "relationships": {"subscription": {"data": {"type": "subscriptions", "id": sub}},
                              "subscriptionPricePoint": {"data": {"type": "subscriptionPricePoints", "id": p["id"]}}}}})
    print(f"+ br.com.imperiodebolso.vip_monthly criado (R$ 14,90/mês, {len(targets)} preços)")


if __name__ == "__main__":
    terr = territories_of_app()
    print(f"territórios do app: {len(terr)}")
    setup_gems(terr)
    setup_vip(terr)


# --- Imagem da revisão de cada compra (docs/lojas/capturas/compras) ---
import hashlib  # noqa: E402


def _upload(kind, rel, owner_id, path):
    raw = Path(path).read_bytes()
    shot = asc("POST", f"/v1/{kind}", {"data": {"type": kind, "attributes": {
        "fileName": Path(path).name, "fileSize": len(raw)},
        "relationships": {rel: {"data": {"type": "inAppPurchases" if rel == "inAppPurchaseV2" else "subscriptions", "id": owner_id}}}}})["data"]
    for op in shot["attributes"]["uploadOperations"]:
        headers = sum((["-H", f"{h['name']}: {h['value']}"] for h in op.get("requestHeaders", [])), [])
        chunk = raw[op["offset"]: op["offset"] + op["length"]]
        subprocess.run(["curl", "-s", "-m", "120", "-X", op["method"], op["url"], *headers, "--data-binary", "@-"],
                       input=chunk, capture_output=True, check=True)
    asc("PATCH", f"/v1/{kind}/{shot['id']}", {"data": {"type": kind, "id": shot["id"],
        "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(raw).hexdigest()}}})


def review_screenshots():
    shots = ROOT / "docs/lojas/capturas/compras"
    for x in all_pages(f"/v1/apps/{APP}/inAppPurchasesV2?limit=50"):
        have = subprocess.run(["sh", str(ROOT / "tools/apple/asc.sh"), "GET", f"/v2/inAppPurchases/{x['id']}/appStoreReviewScreenshot"], capture_output=True, text=True).stdout
        if '"data" : {' in have:
            print(f"= imagem de revisão de {x['attributes']['productId']} já enviada")
            continue
        _upload("inAppPurchaseAppStoreReviewScreenshots", "inAppPurchaseV2", x["id"], shots / "loja_diamantes.jpg")
        print(f"+ imagem de revisão: {x['attributes']['productId']}")
    for g in asc("GET", f"/v1/apps/{APP}/subscriptionGroups")["data"]:
        for s in asc("GET", f"/v1/subscriptionGroups/{g['id']}/subscriptions")["data"]:
            have = subprocess.run(["sh", str(ROOT / "tools/apple/asc.sh"), "GET", f"/v1/subscriptions/{s['id']}/appStoreReviewScreenshot"], capture_output=True, text=True).stdout
            if '"data" : {' in have:
                print(f"= imagem de revisão de {s['attributes']['productId']} já enviada")
                continue
            _upload("subscriptionAppStoreReviewScreenshots", "subscription", s["id"], shots / "loja_vip.jpg")
            print(f"+ imagem de revisão: {s['attributes']['productId']}")


if __name__ == "__main__" and "--screenshots" in sys.argv:
    review_screenshots()
