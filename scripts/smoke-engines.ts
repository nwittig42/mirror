/**
 * Live smoke test for all four engine adapters. Requires real API keys in
 * the environment (see src/lib/env.ts for the full required set). Not run
 * in CI or `npm run test` — this hits real vendor endpoints and costs money.
 *
 * Usage: npx tsx scripts/smoke-engines.ts
 */
import { getAdapters } from "@/engines/index";

const PROMPT = "best med spa in Santa Monica for Botox";

async function main() {
  const adapters = getAdapters();
  let successCount = 0;

  for (const adapter of adapters) {
    try {
      const result = await adapter.run(PROMPT);
      successCount += 1;
      const snippet = result.answer.slice(0, 200);
      console.log(`\n=== ${adapter.name} ===`);
      console.log(`answer (first 200 chars): ${snippet}`);
      console.log(`citation count: ${result.citations.length}`);
    } catch (err) {
      console.log(`\n=== ${adapter.name} ===`);
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (successCount === 0) {
    console.error("\nAll engines failed.");
    process.exit(1);
  }
  process.exit(0);
}

main();
