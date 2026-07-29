# Task 7 report: Engine adapters (4 engines, one interface)

## Summary

Implemented `EngineAdapter` interface + `EngineError` in `src/engines/types.ts`, four
raw-`fetch` adapters (`openai.ts`, `anthropic.ts`, `gemini.ts`, `perplexity.ts`), the
`getAdapters()` registry in `src/engines/index.ts`, mapping tests for all four engines in
`tests/engines/adapters.test.ts`, and a live smoke script at `scripts/smoke-engines.ts`.

Followed TDD: wrote the 8 mapping tests first (2 per engine — happy path + non-OK status →
`EngineError`), confirmed all 8 failed (module-not-found, since adapters didn't exist yet),
then implemented the adapters and confirmed all 8 pass. Full `npm run test` is green (38/38
across 7 files) and `npx tsc --noEmit` is clean.

## Hardening added beyond the brief's bare mapping logic

- `engineFetch(engine, url, init)` helper in `src/engines/types.ts`: wraps `fetch` with
  `AbortSignal.timeout(120_000)`. On abort/timeout it throws
  `EngineError(engine, 408, "timeout")` instead of letting the raw `AbortError` /
  `TimeoutError` propagate. All four adapters route their request through this helper so the
  timeout behavior is centralized rather than duplicated per file.
- Token limits added where the API supports them: anthropic `max_tokens: 1500` (per brief),
  openai `max_output_tokens: 1500`, gemini `generationConfig.maxOutputTokens: 1500`.
  Perplexity left at vendor default per your instruction.

## Exact request bodies used per engine

**perplexity** — `POST https://api.perplexity.ai/chat/completions`
```json
{ "model": "<PERPLEXITY_MODEL>", "messages": [{ "role": "user", "content": "<prompt>" }] }
```
Headers: `Authorization: Bearer <PERPLEXITY_API_KEY>`, `Content-Type: application/json`.
Mapping: `answer = choices[0].message.content`, `citations = data.citations`.

**openai** — `POST https://api.openai.com/v1/responses`
```json
{
  "model": "<OPENAI_MODEL>",
  "tools": [{ "type": "web_search" }],
  "input": "<prompt>",
  "max_output_tokens": 1500
}
```
Headers: `Authorization: Bearer <OPENAI_API_KEY>`, `Content-Type: application/json`.
Mapping: find `output[]` entry with `type === "message"`, take `content[0].text` as answer;
citations from that same `content[0].annotations` filtered to `type === "url_citation"`,
mapped to `.url`.

**anthropic** — `POST https://api.anthropic.com/v1/messages`
```json
{
  "model": "<ANTHROPIC_MODEL>",
  "max_tokens": 1500,
  "tools": [{ "type": "web_search_20250305", "name": "web_search", "max_uses": 3 }],
  "messages": [{ "role": "user", "content": "<prompt>" }]
}
```
Headers: `x-api-key: <ANTHROPIC_API_KEY>`, `anthropic-version: 2023-06-01`,
`Content-Type: application/json`.
Mapping: `answer` = all `content[]` blocks with `type === "text"`, `.text` joined;
`citations` = dedup'd (via `Set`) URLs from `content[].citations[].url`, blank/falsy
filtered out.

**gemini** — `POST https://generativelanguage.googleapis.com/v1beta/models/<GEMINI_MODEL>:generateContent?key=<GEMINI_API_KEY>`
```json
{
  "contents": [{ "parts": [{ "text": "<prompt>" }] }],
  "tools": [{ "googleSearch": {} }],
  "generationConfig": { "maxOutputTokens": 1500 }
}
```
Headers: `Content-Type: application/json` (key passed as query param, not header, per the
brief's URL).
Mapping: `answer` = `candidates[0].content.parts[].text` joined; `citations` =
`candidates[0].groundingMetadata.groundingChunks[].web.uri`, falsy filtered out.

## Where I'm least confident about real API shape

- **openai**: The Responses API `output` array can contain non-`message` entries (e.g.
  `reasoning`, tool-call steps) before/around the message block — my mapping test includes a
  decoy `reasoning` entry to guard against picking the wrong element, but I haven't verified
  against a live response whether `web_search` tool calls surface as separate `output[]`
  entries that could also carry a `type` value my `.find(o => o.type === "message")` should
  skip. Also unconfirmed: whether `max_output_tokens: 1500` is compatible with the
  `web_search` tool (some OpenAI tool configs reserve tokens differently) — the smoke script
  will surface truncation if it's too tight.
- **anthropic**: uncertain whether `web_search_20250305` is still the current tool version
  string at run time (brief flagged these drift) and whether citation objects always include
  a top-level `url` field or nest it differently for some citation types (e.g. page vs. search
  result citations may have different shapes than what I mapped).
- **gemini**: least confident here. `groundingChunks[].web.uri` vs `.web.url` naming, and
  whether `tools: [{ googleSearch: {} }]` (Gemini 2.x syntax) vs. the older
  `tools: [{ googleSearchRetrieval: {} }]` (1.5) is correct for `GEMINI_MODEL`'s current
  default (`gemini-2.5-flash`) — these have changed across Gemini API versions and I did not
  verify against live docs beyond the brief's spec.
- All of the above should be caught by `npx tsx scripts/smoke-engines.ts` once run with real
  keys — it prints per-engine answer snippets and citation counts and won't abort the loop on
  a single engine's failure, so drift shows up per-engine rather than crashing the whole run.

## Verification run (no live keys available)

Ran `npx tsx scripts/smoke-engines.ts` without any env vars set to confirm the script itself
is correct (module resolution via `@/` alias works under tsx, the try/catch-per-engine loop
does not abort on failure, and the exit-code-1-when-all-fail path fires). All four adapters
correctly threw the expected `loadEnv()` "Invalid environment" error and were caught and
printed individually; script exited 1 (all four failed, as expected with no keys). This is
not a live-API check — that requires real keys and was intentionally not run.

## Test results

- `npx vitest run tests/engines/adapters.test.ts` — 8/8 pass (2 per engine).
- `npm run test` — 38/38 pass across 7 files.
- `npx tsc --noEmit` — clean.

## Fix round 1 (coordinator review)

Two items addressed:

1. **Timeout path was untested.** Added a parameterized test in the `perplexity adapter`
   describe block that stubs `fetch` to reject with an `Error` whose `.name` is `AbortError`
   or `TimeoutError` (both variants covered via `it.each`), and asserts
   `perplexityAdapter.run("x")` rejects with a message matching `/perplexity 408: timeout/`.
   This exercises `engineFetch`'s catch branch in `src/engines/types.ts` end-to-end, since all
   four adapters route through it — perplexity alone is sufficient to prove the shared path
   works.
2. **`EngineError.engine` widened correctly.** Changed the constructor param from `string` to
   `Engine` (imported as a type from `@/core/types`, already imported in `types.ts`). No call
   sites needed changes — all four adapters already pass one of the four literal engine names,
   which are valid `Engine` members.

### Verification

- `npx vitest run tests/engines/` — 10/10 pass (8 original + 2 new timeout-variant tests).
- `npm run test` — 40/40 pass across 7 files.
- `npx tsc --noEmit` — clean.
