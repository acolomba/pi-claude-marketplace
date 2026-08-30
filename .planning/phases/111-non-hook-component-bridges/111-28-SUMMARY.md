---
phase: 111-non-hook-component-bridges
plan: 28
subsystem: testing
tags: [typescript, node-test, skills, frontmatter, direct-coverage]

requires:
  - phase: 110-core-platform-and-persistence
    provides: Lowercase test structure, independent expectations, and exact direct-coverage gates.
provides:
  - Canonical direct owner for skill frontmatter name rewriting.
  - Exact byte proof for scalar insertion and replacement, multiline YAML nodes, newline variants, malformed documents, and parser failures.
affects: [phase-111-verification, security-review, skills-bridge]

actuals:
  tokens: 3595
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - Case-local complete skill documents with independently authored expected bytes.
    - Test-context restoration for a defensive sparse split branch without a production seam.

key-files:
  created: []
  modified:
    - tests/bridges/skills/rewrite-frontmatter.test.ts

key-decisions:
  - "Kept skills/rewrite-frontmatter.ts byte-identical because rewriteFrontmatterName exposes the complete public contract."
  - "Compared complete rewritten documents instead of parsing or normalizing the output under test."
  - "Used exact structured error values for parser mismatches, injected sibling fields, and malformed replacement text."

patterns-established:
  - "Pure skill rewrite data rows carry complete input and expected documents through separate lowercase phases."
  - "Defensive sparse-array branches use only the current test context and restore String.prototype.split automatically."

requirements-completed: [MOD-04]

coverage:
  - id: D1
    description: "Skill name rewriting replaces scalar names and inserts missing names while preserving every remaining document byte."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/skills/rewrite-frontmatter.test.ts#replacement and insertion rows"
        status: pass
      - kind: other
        ref: "node --test tests/bridges/skills/rewrite-frontmatter.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Quoted, folded, literal, plain, CRLF, missing, malformed, and unsafe inputs have complete public outcomes."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/skills/rewrite-frontmatter.test.ts#edge and failure rows"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-08-30
status: complete
---

# Phase 111 Plan 28: Skill frontmatter rewrite owner summary

**The direct owner now proves exact skill-document bytes for insertion, replacement, multiline nodes, malformed sources, and rejected generated names without changing production.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-30T19:07:31Z
- **Completed:** 2026-08-30T19:18:29Z
- **Tasks:** 2
- **Implementation files modified:** 1

## Accomplishments

- Replaced partial substring and parsed-field checks with complete independently authored document expectations.
- Proved scalar insertion and replacement plus quoted, folded, literal, multiline plain, multiline quoted, CRLF, terminal-newline, missing-block, unclosed-block, and noncanonical-delimiter behavior.
- Proved exact structured failures for parser coercion, sibling-field injection, and malformed YAML replacement text.
- Reached 14/14 branches, 3/3 functions, and 87/87 lines for the direct owner while retaining the production source SHA-256.

## Task commits

1. **Task 1: Establish the canonical skills/rewrite-frontmatter owner** - `3a9e5598` (`test`)
2. **Task 2: Close edge and direct-coverage evidence** - `e46c3468` (`test`)

## Files created or modified

- `tests/bridges/skills/rewrite-frontmatter.test.ts` - Owns the complete public rewrite, insertion, byte-preservation, and failure contract.

## Decisions made

- Kept `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts` byte-identical at SHA-256 `d7b13f4231d7e7ada8001f8a48bbbca49b67b8f684a18972ffb2412cfce6fcf0`.
- Compared the entire rewritten skill document so a sibling-field, body, line-ending, or terminal-newline change fails directly.
- Used only the current test context to replace and restore `String.prototype.split` for the defensive sparse-entry branch that native string splitting cannot produce.
- Asserted failures through complete `{ constructorName, name, message }` records rather than message fragments.

## Deviations from plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Covered the defensive sparse split branch without a production seam**

- **Found during:** Task 2 direct-coverage verification.
- **Issue:** All real string-input behaviors passed, but Node coverage reported 13/14 branches because native `String.prototype.split()` cannot create a sparse array entry for the existing nullish guard.
- **Fix:** Added one case-local `t.mock.method()` substitution that returns a sparse split only for that case's source text and is restored by the test context.
- **Files modified:** `tests/bridges/skills/rewrite-frontmatter.test.ts`
- **Verification:** Focused tests, ESLint, Prettier, typecheck, and exact direct coverage pass.
- **Committed in:** `e46c3468`

**Total deviations:** 1 auto-fixed blocking issue.
**Impact on plan:** The correction changes test construction only and preserves public behavior, production bytes, and the one-owner boundary.

## Issues encountered

`npm run check` passed typecheck, lint, Fallow, and formatting, then the broad unit run reported 228/231 files passing. The three inherited lane failures are the same ones already documented by Plan 25:

- `tests/bridges/agents/stage.test.ts` failed only in the broad concurrent run and passed when rerun alone.
- `tests/orchestrators/marketplace/add.test.ts` cannot create its Unix-domain socket in this sandbox.
- `tests/orchestrators/plugin/update.test.ts` retains unrelated stale network-reason expectations.

The separately invoked integration suite passed 10/10 files. Plan 28's focused owner, typecheck, lint, formatting, and direct-coverage gates all pass.

## User setup required

None. The owner is pure and uses no external service, credentials, or persistent filesystem state.

## Next phase readiness

Plan 28 is ready for phase verification. It has no open threat, stub, skip, todo, coverage exception, shared fixture, production delta, or supplemental-suite dependency.

## Self-check: PASSED

The owner test, summary, and both task commits exist. The production source retains its recorded SHA-256, and only the Plan 28 summary remains uncommitted for the final metadata commit.

---

_Phase: 111-non-hook-component-bridges_
_Completed: 2026-08-30_
