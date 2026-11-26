#!/usr/bin/env node
// Google Play Developer API com a conta de serviço (~/.imperio/keys/google-play.json, fora do Git).
//
//   node tools/android/play.mjs GET  /applications/br.com.imperiodebolso.game/reviews
//   node tools/android/play.mjs POST /applications/<pkg>/edits '{}'
//   node tools/android/play.mjs UPLOAD /applications/<pkg>/edits/<id>/bundles arquivo.aab
//
// Caminhos relativos a https://androidpublisher.googleapis.com/androidpublisher/v3. A chave nunca
// é impressa. Saída: o JSON da resposta (erros vão para stderr com o status).
import { createSign } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const KEY = process.env.GOOGLE_PLAY_KEY ?? join(homedir(), ".imperio/keys/google-play.json");
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3";

const b64url = (v) => Buffer.from(v).toString("base64url");

export async function accessToken() {
  const sa = JSON.parse(readFileSync(KEY, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${claims}`);
  const jwt = `${head}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`token recusado (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

export async function play(method, path, body) {
  const token = await accessToken();
  const isUpload = method === "UPLOAD";
  const url = isUpload ? `${UPLOAD}${path}?uploadType=media` : `${API}${path}`;
  const init = { method: isUpload ? "POST" : method, headers: { authorization: `Bearer ${token}` } };
  if (isUpload) {
    init.headers["content-type"] = "application/octet-stream";
    init.headers["content-length"] = String(statSync(body).size);
    init.body = readFileSync(body);
  } else if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 600)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [method, path, body] = process.argv.slice(2);
  play(method, path, body)
    .then((r) => console.log(JSON.stringify(r, null, 1)))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
