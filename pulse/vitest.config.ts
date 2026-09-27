import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/__regression__/setup.ts"],
    pool: "forks",
    testTimeout: 20000,
  },
})
