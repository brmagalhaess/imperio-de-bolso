import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Só em `npm run dev` (localhost): lê o ADMIN_TOKEN do backend/.env para entrar direto. */
function devAdminToken(): string {
  try {
    const env = readFileSync(new URL("../backend/.env", import.meta.url), "utf8");
    return env.match(/^ADMIN_TOKEN=(.+)$/m)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

// Em desenvolvimento, /api vai para a API local; em produção o nginx faz o mesmo proxy.
// O build de produção NUNCA embute o token (string vazia).
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: { __DEV_ADMIN_TOKEN__: JSON.stringify(command === "serve" ? devAdminToken() : "") },
  server: {
    port: 5174,
    proxy: { "/api": process.env.ADMIN_API_URL ?? "http://127.0.0.1:3000" },
  },
}));
