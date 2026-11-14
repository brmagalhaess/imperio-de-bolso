import "dotenv/config";
import { execSync } from "node:child_process";

/** Aplica as migrações no banco de teste antes da suíte. */
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL não definido (veja backend/.env.example)");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
