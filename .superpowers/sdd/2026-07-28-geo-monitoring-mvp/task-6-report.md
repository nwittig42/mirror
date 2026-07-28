# Task 6 Report: Judge Output Parser

## Status
COMPLETE

## Implementation Summary
Implemented `parseJudgeOutput()` in `src/core/judge-parse.ts` following TDD approach:
- Test suite created (4 tests)
- Implementation follows exact specification from brief
- Uses zod for schema validation
- Extracts JSON array from surrounding prose/code fences via regex
- Throws `JudgeParseError` on parse failure or invalid severity

## Files Created
- `src/core/judge-parse.ts` - Judge output parser implementation
- `tests/core/judge-parse.test.ts` - Test suite (4 tests, all passing)

## Test Results
- Judge-parse tests: 4/4 passing
- Full suite: 26/26 passing
- TypeScript strict mode: No errors

## Validation
- Parses clean JSON arrays
- Strips code fences and surrounding prose
- Handles empty arrays
- Rejects invalid severity values
- All Severity enum values ("critical", "major", "minor") correctly validated

## Concerns
None - implementation complete and fully validated.

---

## Fix Round 1: Robustness Improvements

### Issues Addressed

**IMPORTANT - Greedy regex vulnerability:** The original `/\[[\s\S]*\]/` regex matched from first `[` to last `]` in the entire string, causing failures when:
- Trailing prose contained brackets (e.g., "See reference [1]")
- Scratch lists preceded the actual findings (e.g., "Scratch: [1,2,3]")

**MINOR - Error name property:** `JudgeParseError` instances had `name = "Error"` instead of `"JudgeParseError"`

### Implementation Changes

1. **Balanced bracket scanning** (new `extractJsonArray()` helper):
   - First tries ```json ... ``` code fence blocks
   - Then tries plain ``` fence blocks
   - Finally scans raw string with proper bracket-depth tracking
   - Respects JSON string boundaries (ignores brackets inside quoted strings)
   - Handles backslash escapes in strings
   - Validates each candidate against schema; keeps scanning if invalid
   - Returns first valid match

2. **JudgeParseError constructor:** Added explicit `this.name = "JudgeParseError"` assignment

### New Tests Added

- `ignores trailing prose with brackets`: Code fence JSON followed by reference citation
- `ignores scratch list before answer`: Numeric scratch array then actual findings
- `handles embedded brackets in claim strings`: Brackets inside JSON string values
- `error has correct name property`: Verifies `err.name === "JudgeParseError"`

### Test Results After Fix

- Judge-parse tests: 8/8 passing (4 original + 4 new)
- Full suite: 30/30 passing
- TypeScript strict mode: No errors
