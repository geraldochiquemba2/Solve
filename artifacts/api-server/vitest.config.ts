import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**"],
    },
  },
  resolve: {
    alias: [
      {
        find: /^@workspace\/db\/schema$/,
        replacement: path.resolve(__dirname, "../../lib/db/src/schema/index.ts"),
      },
      {
        find: /^@workspace\/db$/,
        replacement: path.resolve(__dirname, "../../lib/db/src/index.ts"),
      },
      {
        find: /^@workspace\/api-zod$/,
        replacement: path.resolve(__dirname, "../../lib/api-zod/src/index.ts"),
      },
    ],
  },
});
