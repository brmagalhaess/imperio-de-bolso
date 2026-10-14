#!/usr/bin/env python3
"""Envia as capturas de tela (docs/lojas/capturas) para a versão em preparação na App Store.
    python3 tools/apple/screenshots.py
Substitui as capturas existentes do idioma principal (pt-BR); os outros idiomas usam as mesmas.
Gerar as capturas: DEMO=capturas no tests/demo_runner.gd (ver docs/lojas/README.md).
"""
import hashlib, json, subprocess, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = "6822892071"
SETS = {"APP_IPHONE_67": "docs/lojas/capturas/iphone-6.9", "APP_IPAD_PRO_3GEN_129": "docs/lojas/capturas/ipad-13"}


def api(method, path, body=None):
    args = ["sh", str(ROOT / "tools/apple/asc.sh"), method, path] + ([json.dumps(body)] if body else [])
    out = subprocess.run(args, capture_output=True, text=True).stdout
    data = json.loads(out) if out.strip() else {}
    if "errors" in data:
        raise SystemExit(f"{method} {path}: " + "; ".join(e.get("detail", "") for e in data["errors"]))
    return data


vid = [v for v in api("GET", f"/v1/apps/{APP}/appStoreVersions")["data"]
       if v["attributes"]["appStoreState"] in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED")][0]["id"]
loc = [l for l in api("GET", f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations")["data"]
       if l["attributes"]["locale"] == "pt-BR"][0]["id"]
existing = {s["attributes"]["screenshotDisplayType"]: s["id"]
            for s in api("GET", f"/v1/appStoreVersionLocalizations/{loc}/appScreenshotSets")["data"]}

for display, folder in SETS.items():
    if display in existing:
        for shot in api("GET", f"/v1/appScreenshotSets/{existing[display]}/appScreenshots")["data"]:
            api("DELETE", f"/v1/appScreenshots/{shot['id']}")
        set_id = existing[display]
    else:
        set_id = api("POST", "/v1/appScreenshotSets", {"data": {"type": "appScreenshotSets",
            "attributes": {"screenshotDisplayType": display},
            "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc}}}}})["data"]["id"]
    for f in sorted((ROOT / folder).glob("*.jpg")):
        raw = f.read_bytes()
        shot = api("POST", "/v1/appScreenshots", {"data": {"type": "appScreenshots",
            "attributes": {"fileName": f.name, "fileSize": len(raw)},
            "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}}}})["data"]
        for op in shot["attributes"]["uploadOperations"]:
            req = urllib.request.Request(op["url"], data=raw[op["offset"]:op["offset"] + op["length"]], method=op["method"],
                                         headers={h["name"]: h["value"] for h in op["requestHeaders"]})
            urllib.request.urlopen(req, timeout=120).read()
        api("PATCH", f"/v1/appScreenshots/{shot['id']}", {"data": {"type": "appScreenshots", "id": shot["id"],
            "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(raw).hexdigest()}}})
        print(f"{display}: {f.name} enviado")
