# Task 5: Scoring Implementation Report

## Status
COMPLETE

## Summary
Implemented `computeScore` function in `src/core/scoring.ts` with full test coverage. All 21 tests pass, TypeScript strict mode compliance verified.

## Implementation Details
- **Function**: `computeScore(input: ScoreInput): ScoreBreakdown`
- **Business Logic Enforced**:
  - Citation rate: percentage of checks with mentions
  - Position quality: average position weight for category-only prompts
  - Engine breadth: unique engines with mentions / 4
  - Accuracy: 1 - (brandedChecksWithFinding / brandedCheckCount), defaults to 1 when no branded checks
  - Score formula: `round(100 × (0.50·citationRate + 0.20·positionQuality + 0.15·engineBreadth + 0.15·accuracy))`
  - Score capped at 70 when open critical finding exists and raw score > 70
  - Score forced to 0 when citation rate is 0

## Test Coverage
- **4 explicit tests**: zero edge case, single-engine breadth limiting, critical finding cap, category position filtering
- **All 21 total tests pass** (5 test files in suite)
- No regressions in existing tests

## Quality Assurance
- TypeScript strict mode: PASS (no errors)
- ESLint/formatting: passes existing project linting
- No `any` types used in implementation

## Commit Information
- Commit hash: `0dbe438`
- Message: "feat: visibility score formula with accuracy cap"
- Files: `src/core/scoring.ts`, `tests/core/scoring.test.ts`

---

## Fix Report: Locked Rule Enforcement

### Changes Applied (Three Items)

#### 1. Added Locked Rule Comment
**File**: `src/core/scoring.ts`
- Added comment above zero-citation branch: `// Locked rule: zero citations => score 0; accuracy never lifts an invisible practice.`
- Clarifies the business rule that accuracy component cannot lift an invisible (zero-citation) practice to a visible score.

#### 2. Type-Safe Position Weights
**File**: `src/core/scoring.ts:19`
- Changed: `const POSITION_WEIGHT: Record<string, number>` → `Record<Position, number>`
- Added import: `Position` from `@/core/types`
- Benefit: Compiler now catches missing or typo'd position keys at compile time.

#### 3. New Test Case: Locked Rule Verification
**File**: `tests/core/scoring.test.ts`
- Test name: `"locked rule: zero citations with perfect accuracy still scores 0"`
- Setup: 4 category checks (all mentioned:false, position:"absent") across 4 engines, perfect accuracy=1
- Verification: Score = 0 (despite accuracy=1), and breakdown.accuracy = 1 (component preserved)
- Confirms: The zero-citation rule takes precedence over accuracy

### Test Results
```
npx vitest run tests/core/scoring.test.ts
✓ All 5 scoring tests pass (original 4 + new locked rule test)

npm run test
✓ All 22 tests pass (5 test files)

npx tsc --noEmit
✓ TypeScript strict mode: no errors
```

### Verification
- Rule enforced: Zero citations forces score to 0 regardless of other components
- Component preservation: Accuracy component still calculated and reported (1 in this case)
- Type safety: Position type narrowing prevents configuration errors
- No regressions: All existing tests continue to pass
