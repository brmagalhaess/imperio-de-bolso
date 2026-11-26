// Chamadas à API da App Store Connect com a chave da equipe (ADR 0019).
// A chave fica fora do Git: ~/.imperio/keys/appstore.env (ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH).
//   sh tools/apple/asc.sh GET /v1/devices
//   sh tools/apple/asc.sh POST /v1/devices '{"data":{...}}'
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const env = Object.fromEntries(
  readFileSync(`${homedir()}/.imperio/keys/appstore.env`, "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: env.ASC_KEY_ID, typ: "JWT" });
  const body = b64({ iss: env.ASC_ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
  const sig = createSign("SHA256")
    .update(`${head}.${body}`)
    .sign({ key: readFileSync(env.ASC_KEY_PATH), dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return `${head}.${body}.${sig}`;
}

// Só imprime o token (as chamadas vão pelo curl em tools/apple/asc.sh).
console.log(token());
