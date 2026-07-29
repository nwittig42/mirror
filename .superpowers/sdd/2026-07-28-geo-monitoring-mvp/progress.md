# SDD ledger — plan: /Users/nicholaswittig/geo-platform/docs/plans/2026-07-28-geo-monitoring-mvp.md
Task 1: minor (deferred): no engines field/.nvmrc for Node>=20
Task 1: minor (deferred): z.string().url() deprecated spelling (Zod v4)
Task 1: minor (deferred): layout.tsx metadata still "Create Next App" — replace in UI task
Task 1: complete (commits 04793df..2a5d98e, review clean)
Task 2: minor (deferred): Auth.js adapter tables not created — Task 10 must add them
Task 2: minor (deferred): unused `sql` import warning in schema test (brief-verbatim)
Task 2: complete (commits 2a5d98e..7769370, review clean)
Task 3: minor (deferred): no edge-case tests beyond brief set (metacharacters/overlapping variations); regex compiled per call (non-issue at scale)
Task 3: complete (commits 7769370..6e92c44, review clean)
Task 4: fix round 1/5 (2 addressed, 0 open — prefix-collision suppression + dedupe; commits 8cf670b..1e12985)
Task 4: minor (deferred): firstIndexOf only finds first occurrence per name (repeated-mention answers ignore later standalone hits)
Task 4: complete (commits 6e92c44..1e12985, review clean after 1 fix round)
Task 5: fix round 1/5 (2 addressed, 0 open — zero-citation rule spec-amended+pinned, Record<Position,number>; commits 8155070..b40ee77)
Task 5: complete (commits 1e12985..b40ee77, review clean after 1 fix round; spec amended: zero-citation floor)
Task 6: fix round 1/5 (2 addressed, 0 open — balanced-bracket extraction + error name; commits c5a8a63..9f133fb)
Task 6: minor (deferred): backslash-run parity not counted — claim ending in literal backslash throws JudgeParseError (fails loud; rare)
Task 6: complete (commits b40ee77..9f133fb, review clean after 1 fix round)
Task 7: fix round 1/5 (2 addressed, 0 open — timeout-path tests + Engine type; commits 7cbf199..d1bbcbd)
Task 7: minor (deferred): live smoke vs real APIs pending real keys (ship-checklist item); shape drift would fail silent (empty answer)
Task 7: minor (deferred): request-body contents (model/tools) not asserted in tests (brief scoped tests to response mapping)
Task 7: complete (commits 9f133fb..d1bbcbd, review clean after 1 fix round)
Task 8: complete (commits d1bbcbd..749692b, review clean, zero findings; judge prompt verified verbatim)
Task 9: minor (deferred): judge-failed branded check counts as clean in accuracy denominator (inflates accuracy slightly on judge errors)
Task 9: minor (deferred): finding dedup practice-wide — same claim from two engines in one scan yields one findings row
Task 9: complete (commits 749692b..20ca1f3, review clean)
Task 10: fix round 1/5 (4 addressed, 0 open — api/* matcher, operator magic-link block, AUTH_URL, prod-default guard; commits cf43b39..a0e530c)
Task 10: minor (deferred): report prose says "four new tests", actual three (report accuracy only)
Task 10: minor (deferred): admin/dashboard pages don't exist yet — page-level requireOperator/requirePracticeAccess enforcement verified in T11/T12 reviews
Task 10: complete (commits 20ca1f3..a0e530c, review clean after 1 fix round)
Task 11: fix round 1/5 (3 addressed, 0 open — after() wrapper, detail header, reopen activity; commits c6bff09..b4421ac; fresh fixer, original transcript lost)
Task 11: minor (deferred): invalid practiceId in actions surfaces raw FK error (operator-only, acceptable); inviteClient can link any existing user (operator-trust)
Task 11: complete (commits a0e530c..b4421ac, review clean after 1 fix round)
Task 12: minor (deferred): citation href no scheme allowlist — javascript: URL from engine output would execute on click; RECOMMEND fixing in final wave (http/https allowlist)
Task 12: minor (deferred): citation key={i} → key={url}; delta 0 suppressed (judgment call); getFindingsForPractice added beyond brief list (justified)
Task 12: minor (deferred): manual client-user walkthrough not performed (needs live server; T15 checklist)
Task 12: complete (commits b4421ac..2c7ce03, review clean)
Task 13: fix round 1/5 (4 addressed, 0 open — escapeHtml everywhere, variation snippets, sendPulse transport+tests, zero-delta; commits c1f6229..243b0f0)
Task 13: minor (deferred): PGlite makeTestDb contention flake under full-suite parallelism (bumped timeout; suite-wide flake-reduction candidate)
Task 13: minor (deferred): maxDuration 800 requires paid Vercel plan; cron bearer compare not constant-time (brief-mandated snippet)
Task 13: complete (commits 2c7ce03..243b0f0, review clean after 1 fix round)
Task 14: fix round 1/5 (1 addressed, 0 open — resolveMonthParam validation; commits cb90bc0..10fd621)
Task 14: minor (deferred): verdict keyed on totalChecks while score/trend keyed on inMonthScans (zero-check completed scan shows mismatched copy; scan-runner invariant makes it unlikely)
Task 14: complete (commits 243b0f0..10fd621, review clean after 1 fix round)
Task 15: minor (deferred): loadEnv() called redundantly in seed.ts; seed requires all vendor keys though unused (loadEnv validates full schema)
Task 15: complete (commits 10fd621..06fd3ed, review clean, v0.1.0 tagged)
Final review: 4 fix-now findings + 2 minors fixed in one wave (commits c2ab62b..1aa783d); scoped re-review: all addressed, no new breakage; 101/101 tests
Final review: deferred (with rulings in final-review.md): pulse To: exposure, containment divergence, month-agnostic open findings, dark-mode chart grid, plaintext compares (documented), write-only component columns
BUILD COMPLETE: v0.1.0 at 1aa783d
