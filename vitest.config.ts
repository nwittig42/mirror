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
    // Each test that needs a real Postgres dialect spins up its own
    // in-memory PGlite instance (see tests/helpers/db.ts). Running test
    // files in parallel worker processes contends over PGlite's shared
    // native lock/temp-file resources and produces flaky timeouts under
    // load. Serializing file execution (still parallel *within* a file)
    // fixes that at a small cost to wall-clock time for this suite's size.
    fileParallelism: false,
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
