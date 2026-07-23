import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // server-only is a Next.js bundler guard that throws in client bundles.
      // In vitest (plain Node), alias it to an empty no-op so server modules
      // can be imported and unit-tested without a Next.js runtime.
      "server-only": new URL("./src/__mocks__/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
