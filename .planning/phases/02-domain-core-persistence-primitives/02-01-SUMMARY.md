---
phase: 02-domain-core-persistence-primitives
plan: 01
subsystem: domain
tags: [parser, discriminated-union, source-parsing, scope-type, prd-§6.1]

# Dependency graph
requires:
  - phase: 01-foundations-toolchain/03
    provides: "9-folder skeleton + ESLint import-x boundary rules (D-11) constraining domain/ -> shared/ only"
  - phase: 01-foundations-toolchain/06
    provides: "tests/{architecture,shared,helpers}/ directory layout that tests/domain/ now joins"
  - phase: 01-foundations-toolchain/07
    provides: "Phase 2 handoff item #1 -- Move Scope to shared/types.ts so edge/ can import without crossing D-11"
provides:
  - "extensions/pi-claude-marketplace/shared/types.ts -- Scope = 'user' | 'project' (SC-1) + SCOPES tuple"
  - "extensions/pi-claude-marketplace/domain/source.ts -- ParsedSource discriminated union + parsePluginSource + pathSource/githubSource factories"
  - "extensions/pi-claude-marketplace/domain/index.ts -- public API surface re-export"
  - "tests/domain/source.test.ts -- 28-case PRD §6.1 coverage suite"
  - "tests/domain/ directory (created -- Wave 0 of VALIDATION.md)"
affects:
  [
    phase-02-domain-core-persistence (resolver, manifest, persistence consumers),
    phase-03-bridges,
    phase-04-marketplace-orchestrators,
    phase-05-plugin-orchestrators,
    phase-06-edge,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-written character-level parser with discriminated union (D-06): ParsedSource = PathSource | GitHubSource | UnknownSource. Branches on first character / substring patterns; TypeBox is reserved for shape-validating already-parsed JSON, not character-level work."
    - "Discriminated union + literal-typed kind field for forward-compat tail (NFR-12 / D-08): UnknownSource carries verbatim raw + non-empty reason; future source kinds become new branches; consumers that switch on kind get a static-exhaustiveness miss they can address."
    - "SP-6 / ST-6 factory funnel (single funnel for parse-time + state-load revalidation): pathSource() / githubSource() wrap parse-or-throw; persistence layer (Plan 02-04) will reuse the same chokepoint."
    - "SP-7 verbatim raw preservation: PathSource.raw stores user input unmodified; tilde expansion deferred to Phase 4 location/index.ts (security-relevant -- keeps state.json portable across users)."
    - "Cross-tier types in shared/types.ts (Phase 1 SUMMARY handoff #1): Scope union lives in shared/ so edge/ (Phase 6) can consume without crossing the D-11 import boundary."
    - "Table-driven test pattern: ACCEPT_CASES / REJECT_CASES arrays with name/raw/expect rows; each row maps 1:1 to a PRD requirement so `grep -n SP-2 tests/domain/source.test.ts` is the audit source-of-truth."

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/types.ts
    - extensions/pi-claude-marketplace/domain/source.ts
    - tests/domain/source.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/index.ts (placeholder -> public surface re-export)

key-decisions:
  - "Followed CONTEXT.md D-06 verbatim: hand-written parser, NOT TypeBox. Slash counting, tilde detection, hash-fragment splitting, /tree/<ref> rejection are character-level operations that read cleaner as conditional code than nested TypeBox unions."
  - "Followed CONTEXT.md D-08: UnknownSource is the NFR-12 forward-compat tail. MM-4 non-classifiable strings route here with a non-empty reason, NOT to GitHub fallback."
  - "Followed Phase 1 SUMMARY handoff #1: Scope lives in shared/types.ts (not domain/), so edge/ can import without crossing D-11. shared/README.md Planned Contents already had types.ts as [ ] for Phase 2."
  - "domain/source.ts has zero imports -- well within D-11 (domain/ may import only from shared/, but here doesn't even need to)."

patterns-established:
  - "Discriminated union with literal-string kind tag + readonly fields: TypeScript narrows automatically on `if (s.kind === 'path')` checks. Phase 2 resolver (Plan 02-05) will mirror this for `installable: true | false`."
  - "Forward-compat unknown branch: every reject path produces a discriminated `unknown` variant carrying raw + reason instead of throwing. Throws are reserved for the SP-6 factory funnel (validate-or-throw at trust boundaries)."
  - "Table-driven PRD coverage tests: requirement IDs in test row names give grep-able audit trail. Reuse for resolver fixtures (Plan 02-05) and manifest schema fixtures (Plan 02-02/03)."

requirements-completed:
  [SP-1, SP-2, SP-3, SP-4, SP-5, SP-6, SP-7, SC-1, NFR-12, MM-4]

# Metrics
duration: ~10min
completed: 2026-05-10
---

# Phase 02 Plan 01: Source Parser & Scope Type Summary

**Hand-written `parsePluginSource` discriminated `ParsedSource` union (path | github | unknown) covering PRD §6.1 SP-1..7 + MM-4 + NFR-12, plus the cross-tier `Scope = 'user' | 'project'` type in `shared/types.ts` so Phase 6's edge/ can import without crossing D-11.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-10T12:08:00Z (plan executor spawn)
- **Completed:** 2026-05-10T12:18:30Z
- **Tasks:** 3 (all auto + tdd; 0 checkpoints)
- **Files created:** 3 (`shared/types.ts`, `domain/source.ts`, `tests/domain/source.test.ts`)
- **Files modified:** 1 (`domain/index.ts` placeholder → real exports)

## Accomplishments

- **`Scope` cross-tier type lives in `shared/types.ts`** with the `'user' | 'project'` union (SC-1: no Claude Code `local` scope) and a `SCOPES` readonly tuple for tab completion. Resolves Phase 1 SUMMARY handoff item #1 -- edge/ (Phase 6) can now import `Scope` without crossing the D-11 boundary, because shared/ is reachable from every tier.
- **`domain/source.ts` ships the hand-written parser** (188 lines) with the `ParsedSource = PathSource | GitHubSource | UnknownSource` discriminated union, `parsePluginSource(raw)` covering every PRD §6.1 accept/reject case verbatim, and the `pathSource()` / `githubSource()` factories that Plan 02-04 will reuse at state-load time (ST-6 funnel).
- **`tests/domain/source.test.ts` ships 28 tests** that all pass (full pipeline 58/58). Table-driven structure (ACCEPT_CASES + REJECT_CASES + factory tests + targeted hint-substring tests) maps PRD §6.1 requirements 1:1 to test-row names so the audit trail is grep-able.
- **`domain/index.ts` upgraded** from Phase 1's `export {}` placeholder to the public surface re-export covering 4 types + 3 functions.
- **Zero `domain/source.ts` imports** -- well within D-11 (the parser is character-level work that needs nothing beyond standard string methods). Phase 1's `shared/errors.ts` `errorMessage` helper is available but not needed here; the parser produces structured `UnknownSource` records, not thrown errors, except in the SP-6 factories.

## Task Commits

Each task was committed atomically:

1. **Task 1: shared/types.ts with Scope union** -- `4f9eb75` (feat)
2. **Task 2: domain/source.ts hand-written parser + factories** -- `33309d5` (feat)
3. **Task 3: tests/domain/source.test.ts (PRD §6.1 coverage)** -- `eac5f59` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/types.ts` -- Scope union (SC-1), SCOPES readonly tuple, no runtime side effects
- `extensions/pi-claude-marketplace/domain/source.ts` -- ParsedSource discriminated union (PathSource/GitHubSource/UnknownSource), parsePluginSource(raw), parseGitHubUrl helper, pathSource()/githubSource() SP-6/ST-6 factories
- `extensions/pi-claude-marketplace/domain/index.ts` -- replaced Phase 1 `export {}` placeholder with re-exports of 4 types + 3 functions
- `tests/domain/source.test.ts` -- 28-case suite covering PRD §6.1 SP-1..7 + MM-4 + NFR-12 (12 accept rows, 9 reject rows, 4 factory tests, 3 targeted hint/forward-compat tests)

## Decisions Made

- **Followed CONTEXT.md D-06 strictly:** Hand-written parser, not TypeBox. Slash counting, tilde detection, hash-fragment splitting, `/tree/<ref>` rejection all read cleaner as conditional code.
- **Followed CONTEXT.md D-08 strictly:** UnknownSource = forward-compat tail (NFR-12). Every reject path produces a discriminated `{ kind: 'unknown', raw, reason }` instead of throwing. Throws are confined to the SP-6 factory funnel.
- **Followed Phase 1 SUMMARY handoff #1 strictly:** Scope lives in shared/types.ts (NOT domain/types.ts). shared/README.md Planned Contents now updates from `[ ]` to `[x]` for types.ts when shared/README.md is next touched.
- **Source.ts has zero imports.** The parser doesn't need `errorMessage` from shared/errors.ts -- UnknownSource carries reason directly, and the two factory throws use `new Error(...)` inline (consistent with Phase 1's `pathSource('') throws Error('...')` exemplar from CONTEXT.md / RESEARCH.md Pattern 4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 -- Bug] Test file failed typecheck due to direct ParsedSource → Record\<string, unknown\> cast**

- **Found during:** Task 3 (full `npm run check` after writing tests)
- **Issue:** TS2352 -- `(got as Record<string, unknown>)[k]` was rejected because UnknownSource (with optional fields) doesn't have an index signature. The plan's specified test code used a single `as` cast.
- **Fix:** Changed both casts to double-cast through `unknown`: `(got as unknown as Record<string, unknown>)[k]`. This is the canonical TypeScript escape hatch for "I know this is structurally compatible but the compiler doesn't" -- TS even suggests it in the error message.
- **Files modified:** `tests/domain/source.test.ts` (2 cast sites in the ACCEPT_CASES loop)
- **Verification:** `npm run typecheck` now exits 0; the runtime behavior is identical.
- **Committed in:** `eac5f59` (Task 3 commit, included before staging)

**2. [Rule 1 -- Bug] Test file failed lint due to redundant `String(k)` interpolation**

- **Found during:** Task 3 (`npm run lint` after fix #1)
- **Issue:** `@typescript-eslint/no-unnecessary-type-conversion` rejected `${String(k)}` because `k` was already a string-typed key (typeof `keyof typeof c.expect`).
- **Fix:** Replaced `${String(k)}` with `${k}`. Identical runtime output, no lint error.
- **Files modified:** `tests/domain/source.test.ts` (assertion message template)
- **Verification:** `npm run lint` exits 0.
- **Committed in:** `eac5f59` (Task 3 commit)

**3. [Rule 1 -- Bug] Test file failed prettier formatting**

- **Found during:** Task 3 (`npm run format:check` after fixes #1-2)
- **Issue:** Plan-specified test source had a long line in the `assert.throws()` predicate callback that prettier wanted to wrap.
- **Fix:** `npx prettier --write tests/domain/source.test.ts` reformatted the predicate callback into a multi-line `&&` chain.
- **Files modified:** `tests/domain/source.test.ts`
- **Verification:** `npm run format:check` exits 0; semantics unchanged.
- **Committed in:** `eac5f59` (Task 3 commit)

**4. [Rule 1 -- Bug] domain/source.ts auto-fixed by ESLint for `@stylistic/padding-line-between-statements` and `curly`**

- **Found during:** Task 2 (`npm run lint` after writing source.ts per plan-specified contents)
- **Issue:** Plan-specified action contained statements without surrounding blank lines (stylistic rule) and single-line `if`/`while` bodies without braces (`curly` rule).
- **Fix:** Ran `npx eslint --fix` to auto-add blank lines and braces. Then manually reformatted the auto-fixed `{rest = rest.slice(0, -1);}` single-line bodies to multi-line bodies for readability (no semantic change). Prettier confirmed formatting.
- **Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`
- **Verification:** Full `npm run check` exits 0; behavior identical to plan-specified action; tests still pass.
- **Committed in:** `33309d5` (Task 2 commit)

**5. [Rule 1 -- Plan-spec consistency note] Task 1 acceptance criterion vs action body conflict**

- **Found during:** Task 1 (post-write acceptance verification)
- **Issue:** Task 1's action specified an exact file body containing the comment text `// Code \`local\` scope is intentionally NOT introduced.` (intentional documentation of SC-1's exclusion). The Task 1 acceptance criterion `grep -c "local" extensions/pi-claude-marketplace/shared/types.ts` returns `0` -- but the action body produces `1` (the comment match). The behavioral intent (no `'local'` *type literal*) is satisfied: `grep -E '"local"'` returns no matches. Wrote the file per the plan's verbatim action body and treated this as a known acceptance-criterion-vs-action-spec mismatch in the plan.
- **Fix:** Kept the file body as the plan specified (preserving the SC-1 documentation comment). The behavioral check (`grep -E '"local"' produces no match`) is satisfied. Plan author should consider revising the criterion to `grep -c '\"local\"'` (looking for the *literal type member*) in any future iteration.
- **Files modified:** None (no fix needed -- file body matches action verbatim)
- **Verification:** SC-1 satisfied: `Scope` union has exactly two members, `'user'` and `'project'`. `grep -E '"local"' shared/types.ts` returns no match.
- **Committed in:** `4f9eb75` (Task 1 commit, body verbatim from plan action)

---

**Total deviations:** 5 auto-fixed (4 lint/typecheck/format mechanical fixes from plan-specified code being slightly out of step with the project's strict ESLint+prettier+TS config; 1 plan-spec consistency note that did not require a code change).

**Impact on plan:** Zero behavioral or scope deviation. All five deviations are mechanical adjustments to align plan-specified literal code with the project's `npm run check` quality bar. Behavior, line counts (188 ≥ 80 minimum), and acceptance criteria all met. No design or threat-model deviations.

## Issues Encountered

- **Pre-commit hooks initially rejected commit message:** First Task 2 commit attempt failed with two simultaneous failures: (1) `Fix Unicode dash characters` auto-rewrote a unicode em-dash in the commit message to `--`, and (2) gitlint `B1 Line exceeds max length (81>80)`. Resolved by retrying with a shorter, ASCII-only commit message. No code changes; staged files were preserved across the failed commit. Recorded for future executors: keep commit-body lines `\<= 80` chars and use ASCII `--` (NOT unicode dashes).
- **TruffleHog skip:** Reused Phase 1's documented `SKIP=trufflehog` workaround for the worktree-incompatibility. NOT `--no-verify` -- this is the canonical selective-skip per pre-commit's documented mechanism.

## Threat Model Coverage

The plan's `<threat_model>` block called out four threats (T-02-01..T-02-04). All four are mitigated as designed:

- **T-02-01 (Tampering -- disguised source string):** `git@…`, arbitrary `://` schemes, and browser-paste `/tree/<ref>` URLs all explicitly rejected by `parsePluginSource` SP-3 branch. UnknownSource carries `raw` verbatim so downstream NFR-10 containment checks (Phase 4) cannot be bypassed by a successful parse.
- **T-02-02 (Information disclosure -- per-user tilde):** SP-4 branch rejects `~user/foo` form before any expansion. Reject reason echoes the user's raw input but does NOT attempt to resolve `~user`'s home dir. SP-7 ensures `~/foo` (own home) is stored verbatim -- actual home-dir resolution is Phase 4's responsibility, not Phase 2's.
- **T-02-03 (Path traversal):** Deliberately accepted -- Phase 2 parser is the *syntactic* gate; Phase 3 bridges + Phase 1's `assertPathInside` are the *semantic* gate. Documented in source.ts file-header comment (SECURITY block).
- **T-02-04 (Spoofing -- silent unknown):** Every UnknownSource carries a non-empty `reason`. NFR-12 test (`reason.length > 0`) asserts this on every reject case. Plan 02-05 resolver will map `kind === 'unknown'` directly to `installable: false` with `notes: [reason]`. No silent-acceptance path exists.

No new threat surface introduced beyond the plan's threat model.

## User Setup Required

None -- pure code/test additions, no external service configuration, no env vars, no network.

## Next Phase Readiness

- **Wave 2 of Phase 2 unblocked:** `ParsedSource` and `Scope` are now consumable by every downstream Phase 2 module (resolver per Plan 02-05, manifest per 02-02/03, persistence per 02-04).
- **Plan 02-04 (persistence) can call `pathSource(raw)` / `githubSource(raw)`** as the ST-6 factory funnel for state-load revalidation. The factories throw `Error` so the persistence layer's load-time error handling stays straight-line.
- **Plan 02-02/03 (TypeBox manifest schemas) does not need to import from `domain/source.ts`** -- schemas are data-shape; source-string parsing is character-level. Per D-06.
- **Plan 02-05 (resolver) will mirror the discriminated-union pattern** for `installable: true | false`. The pattern is now established and tested; copy with confidence.
- **Plan 02-06+ (transaction/state-guard) consumes `Scope`** from `shared/types.ts` -- straightforward import from the already-shared module.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/types.ts` exists -- FOUND
- `extensions/pi-claude-marketplace/domain/source.ts` exists, 188 lines (≥ 80 min) -- FOUND
- `extensions/pi-claude-marketplace/domain/index.ts` exists with 3 function re-exports -- FOUND
- `tests/domain/source.test.ts` exists, 28 tests, all pass -- FOUND
- Task 1 commit `4f9eb75` (`feat(02-01): add shared/types.ts with Scope union (SC-1)`) -- FOUND in `git log`
- Task 2 commit `33309d5` (`feat(02-01): add domain/source.ts hand-written parser + factories`) -- FOUND in `git log`
- Task 3 commit `eac5f59` (`test(02-01): add tests/domain/source.test.ts (PRD §6.1 coverage)`) -- FOUND in `git log`
- `npm run check` exits 0 (58/58 tests pass) -- VERIFIED

---

*Phase: 02-domain-core-persistence-primitives*
*Completed: 2026-05-10*
