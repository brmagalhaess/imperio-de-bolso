import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    // Os testes de API compartilham o banco de teste: um arquivo por vez.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
