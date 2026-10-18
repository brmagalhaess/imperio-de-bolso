#!/usr/bin/env python3
"""Cadastra os pacotes promocionais (ADR 0024) como consumíveis na App Store Connect, lendo o
catálogo do servidor (backend/src/economy/bundles.ts) para não divergir. Pode rodar de novo:
pula o que já existe. Preço base em BRA; a Apple equaliza os outros países.

    python3 tools/apple/bundles_setup.py            # cria produtos
    python3 tools/apple/bundles_setup.py --screenshots docs/lojas/capturas/compras/ofertas.jpg
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from iap_setup import APP, LOCALES, all_pages, asc, territories_of_app  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

NAMES = {  # id → (en, es); o pt vem do servidor
    "iniciante": ("Starter Kit", "Kit de Inicio"),
    "combo_turbo": ("Turbo Combo", "Combo Turbo"),
    "empreendedor": ("Entrepreneur Kit", "Kit Emprendedor"),
    "fim_de_semana": ("Weekend Combo", "Combo Fin de Semana"),
    "investidor": ("Investor's Chest", "Cofre del Inversor"),
    "express": ("Empire Express", "Imperio Express"),
    "mala_de_ouro": ("Golden Suitcase", "Maleta de Oro"),
    "magnata": ("Tycoon's Vault", "Bóveda del Magnate"),
    "tesouro_real": ("Royal Treasure", "Tesoro Real"),
    "lenda": ("Pocket Legend", "Leyenda de Bolsillo"),
    "carnaval": ("Carnival Pack", "Paquete de Carnaval"),
    "pascoa": ("Easter Pack", "Paquete de Pascua"),
    "dia_das_maes": ("Mother's Day Pack", "Paquete Día de la Madre"),
    "festa_junina": ("June Festival Pack", "Paquete Fiesta de Junio"),
    "dia_dos_pais": ("Father's Day Pack", "Paquete Día del Padre"),
    "independencia": ("Independence Pack", "Paquete Independencia"),
    "dia_das_criancas": ("Children's Day Pack", "Paquete Día del Niño"),
    "black_friday": ("Black Friday Pack", "Paquete Black Friday"),
    "natal": ("Christmas Pack", "Paquete de Navidad"),
    "ano_novo": ("New Year Pack", "Paquete de Año Nuevo"),
}


def bundles():
    js = ('import("./src/economy/bundles.ts").then(m=>console.log(JSON.stringify('
          'm.BUNDLES.map(b=>({...b,gems:b.gems.toString()})))))')
    out = subprocess.run(["npx", "tsx", "-e", js], cwd=ROOT / "backend", capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def num(n):
    return f"{int(n):,}".replace(",", ".")


def desc(b, lang):
    """Descrição curta (máx. 55 caracteres na Apple)."""
    d = b["autoCollectHours"] // 24
    parts = {"pt": [f"{num(b['gems'])} diamantes"], "en": [f"{num(b['gems'])} gems"], "es": [f"{num(b['gems'])} diamantes"]}[lang]
    if b["autoCollectHours"]:
        parts.append({"pt": f"auto-coleta {d}d" if d else "auto-coleta 24h", "en": f"auto-collect {d}d", "es": f"autorecogida {d}d"}[lang])
    if b["turboHours"]:
        t = b["turboHours"]
        parts.append(f"turbo {t // 24}d" if t > 24 and t % 24 == 0 else f"turbo {t}h")
    if b["boostHours"]:
        parts.append({"pt": f"{b['boostHours']}h de produção", "en": f"{b['boostHours']}h of income", "es": f"{b['boostHours']}h de producción"}[lang])
    text = " + ".join(parts)
    return text if len(text) <= 55 else text[:55]


def setup(territories):
    existing = {x["attributes"]["productId"]: x["id"] for x in all_pages(f"/v1/apps/{APP}/inAppPurchasesV2?limit=50")}
    for b in bundles():
        pid = b["productId"]
        if pid in existing:
            print(f"= {pid} já existe")
            continue
        en, es = NAMES[b["id"]]
        iap = asc("POST", "/v2/inAppPurchases", {"data": {"type": "inAppPurchases", "attributes": {
            "name": b["title"], "productId": pid, "inAppPurchaseType": "CONSUMABLE", "familySharable": False,
            "reviewNote": ("Pacote promocional (vitrine da semana ou de feriado, 1 compra por vitrine). "
                           f"Entrega no servidor: {desc(b, 'pt')}.")},
            "relationships": {"app": {"data": {"type": "apps", "id": APP}}}}})["data"]["id"]
        for loc, name, lang in zip(LOCALES, (b["title"], en, es), ("pt", "en", "es")):
            asc("POST", "/v1/inAppPurchaseLocalizations", {"data": {"type": "inAppPurchaseLocalizations",
                "attributes": {"locale": loc, "name": name[:30], "description": desc(b, lang)},
                "relationships": {"inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": iap}}}}})
        price = b["priceBRL"].replace(",", ".")
        points = all_pages(f"/v2/inAppPurchases/{iap}/pricePoints?filter%5Bterritory%5D=BRA&limit=800")
        want = {price, price.rstrip("0"), price.rstrip("0").rstrip(".")}
        point = next((p for p in points if p["attributes"]["customerPrice"] in want), None)
        if not point:
            sys.exit(f"sem faixa de preço R$ {price} para {pid}")
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
        print(f"+ {pid} criado (R$ {b['priceBRL']}) — {desc(b, 'pt')}")


def screenshots(path):
    raw = Path(path).read_bytes()
    pids = {b["productId"] for b in bundles()}
    for x in all_pages(f"/v1/apps/{APP}/inAppPurchasesV2?limit=50"):
        if x["attributes"]["productId"] not in pids:
            continue
        iap = x["id"]
        old = asc("GET", f"/v2/inAppPurchases/{iap}/appStoreReviewScreenshot").get("data")
        if old:
            print(f"= {x['attributes']['productId']} já tem imagem")
            continue
        shot = asc("POST", "/v1/inAppPurchaseAppStoreReviewScreenshots", {"data": {
            "type": "inAppPurchaseAppStoreReviewScreenshots",
            "attributes": {"fileName": Path(path).name, "fileSize": len(raw)},
            "relationships": {"inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": iap}}}}})["data"]
        for op in shot["attributes"]["uploadOperations"]:
            headers = sum((["-H", f"{h['name']}: {h['value']}"] for h in op.get("requestHeaders", [])), [])
            chunk = raw[op["offset"]: op["offset"] + op["length"]]
            subprocess.run(["curl", "-s", "-m", "120", "-X", op["method"], op["url"], *headers, "--data-binary", "@-"],
                           input=chunk, capture_output=True, check=True)
        asc("PATCH", f"/v1/inAppPurchaseAppStoreReviewScreenshots/{shot['id']}", {"data": {
            "type": "inAppPurchaseAppStoreReviewScreenshots", "id": shot["id"],
            "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(raw).hexdigest()}}})
        print(f"+ imagem de revisão: {x['attributes']['productId']}")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--screenshots":
        screenshots(sys.argv[2])
    else:
        setup(territories_of_app())
