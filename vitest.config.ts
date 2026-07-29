import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    server: {
      deps: {
        // next-auth ships pure ESM and imports bare subpaths like
        // "next/server" that only resolve via a bundler (next itself has no
        // package.json "exports" map, so Node's native ESM resolver can't
        // find them). Inlining forces Vite's own resolver to handle it.
        inline: ["next-auth", "@auth/core", "@auth/drizzle-adapter"],
      },
    },
  },
});
