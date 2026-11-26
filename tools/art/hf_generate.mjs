#!/usr/bin/env node
// Gera arte pela API Higgsfield (docs.higgsfield.ai) com teto de gasto.
//
//   node tools/art/hf_generate.mjs tools/art/jobs/<lote>.json --max-usd 1.30 [--dry-run]
//
// - Lê HF_KEY (<key_id>:<key_secret>) do .env da raiz; a chave nunca é impressa.
// - Estima cada imagem (endpoint /estimate, gratuito) e para antes de passar do teto,
//   somando o que já foi gasto em tools/art/generations.jsonl.
// - Idempotency-Key estável por (job, variação): repetir o comando não cobra de novo.
// - Originais em game/assets/source/<job>/; registro em tools/art/generations.jsonl.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const API = "https://api.higgsfield.ai";
const LOG = join(ROOT, "tools/art/generations.jsonl");
const POLL_MS = 3000;
const TIMEOUT_MS = 5 * 60 * 1000;

function readKey() {
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("HF_KEY="));
  const key = line?.slice("HF_KEY=".length).trim();
  if (!key || !key.includes(":")) throw new Error("HF_KEY ausente ou sem o formato id:secret no .env");
  return key;
}

function parseArgs(argv) {
  const args = { file: null, maxUsd: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--max-usd") args.maxUsd = Number(argv[++i]);
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else args.file = argv[i];
  }
  if (!args.file || !(args.maxUsd > 0)) {
    throw new Error("uso: hf_generate.mjs <jobs.json> --max-usd <valor> [--dry-run]");
  }
  return args;
}

function logEntries() {
  if (!existsSync(LOG)) return [];
  return readFileSync(LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Soma o custo da última situação de cada requisição (enviada ou concluída). */
function spentSoFar() {
  const latest = new Map();
  for (const e of logEntries()) latest.set(e.requestId, e);
  return [...latest.values()]
    .filter((e) => e.status === "completed" || e.status === "submitted")
    .reduce((sum, e) => sum + Number(e.usd ?? 0), 0);
}

function alreadyDone(idempotencyKey) {
  return (
    logEntries().find((e) => e.idempotencyKey === idempotencyKey && e.status === "completed") ??
    null
  );
}

async function api(key, method, path, body, extraHeaders = {}) {
  const res = await fetch(path.startsWith("http") ? path : `${API}/${path}`, {
    method,
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = readKey();
  const jobs = JSON.parse(readFileSync(resolve(args.file), "utf8"));
  let spent = spentSoFar();
  console.log(`Teto: US$${args.maxUsd.toFixed(2)} · já gasto (log): US$${spent.toFixed(3)}`);

  for (const job of jobs) {
    for (let v = 1; v <= (job.variations ?? 1); v++) {
      const tag = `${job.id}_v${String(v).padStart(2, "0")}`;
      const idempotencyKey = createHash("sha256")
        .update(`${job.id}|${v}|${job.model}|${JSON.stringify(job.input)}`)
        .digest("hex")
        .slice(0, 40);

      const done = alreadyDone(idempotencyKey);
      if (done) {
        console.log(`= ${tag}: já gerado (${done.files.join(", ")})`);
        continue;
      }

      const estimate = await api(key, "POST", `estimate/${job.model}`, job.input);
      const usd = Number(estimate.usd);
      if (spent + usd > args.maxUsd + 1e-9) {
        console.log(`! ${tag}: US$${usd} passaria do teto (gasto US$${spent.toFixed(3)}). Parando.`);
        return;
      }
      if (args.dryRun) {
        console.log(`~ ${tag}: ${job.model} US$${usd} (simulação)`);
        spent += usd;
        continue;
      }

      const submitted = await api(key, "POST", job.model, job.input, {
        "Idempotency-Key": idempotencyKey,
      });
      spent += usd;
      const base = {
        tag,
        job: job.id,
        variation: v,
        model: job.model,
        input: job.input,
        usd,
        credits: estimate.credits,
        idempotencyKey,
        requestId: submitted.request_id,
        at: new Date().toISOString(),
      };
      appendFileSync(LOG, JSON.stringify({ ...base, status: "submitted" }) + "\n");
      process.stdout.write(`> ${tag}: ${job.model} US$${usd} req ${submitted.request_id} `);

      const started = Date.now();
      let status = submitted;
      while (!["completed", "failed", "nsfw", "canceled"].includes(status.status)) {
        if (Date.now() - started > TIMEOUT_MS) throw new Error(`${tag}: tempo esgotado`);
        await sleep(POLL_MS);
        try {
          status = await api(key, "GET", submitted.status_url);
        } catch (err) {
          // Falha de rede na consulta não afeta a geração; tenta de novo no próximo ciclo.
          process.stdout.write("!");
        }
        process.stdout.write(".");
      }

      if (status.status !== "completed") {
        // failed/nsfw/canceled não são cobrados (docs: Billing and retention).
        appendFileSync(
          LOG,
          JSON.stringify({ ...base, usd: 0, status: status.status, error: status.error }) + "\n",
        );
        spent -= usd;
        console.log(` ${status.status}`);
        continue;
      }

      const dir = join(ROOT, "game/assets/source", job.id);
      mkdirSync(dir, { recursive: true });
      const files = [];
      for (const [i, img] of (status.images ?? []).entries()) {
        const res = await fetch(img.url);
        const ext = extname(new URL(img.url).pathname) || ".png";
        const name = `${tag}${status.images.length > 1 ? `_${i + 1}` : ""}${ext}`;
        writeFileSync(join(dir, name), Buffer.from(await res.arrayBuffer()));
        files.push(`game/assets/source/${job.id}/${name}`);
      }
      appendFileSync(LOG, JSON.stringify({ ...base, status: "completed", files }) + "\n");
      console.log(` ok → ${files.join(", ")}`);
    }
  }
  console.log(`Total gasto (log): US$${spent.toFixed(3)}`);
}

main().catch((err) => {
  console.error(String(err.message ?? err));
  process.exit(1);
});
