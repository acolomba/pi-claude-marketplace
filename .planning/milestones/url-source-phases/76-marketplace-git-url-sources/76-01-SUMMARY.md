---
phase: 76-marketplace-git-url-sources
plan: 01
subsystem: api
tags: [source-parser, url-source, isomorphic-git, notify, closed-set, typebox]

# Dependency graph
requires:
  - phase: force-install
    provides: three-way resolver state, ParsedSource discriminated union, REASONS closed set
provides:
  - "generic https:// string/object source parses to UrlSource with .git-canonical url + optional #ref"
  - "github.com URLs (string and object form) always normalize to github kind"
  - "owner/repo@ref shorthand folds to github kind with ref (SP-2 reject retired)"
  - "samePlannedSource url arm is live, ref-aware, and .git-canonical (MURL-06 reconcile identity)"
  - "authentication required REASONS token (33rd member, error severity, truthful attribution)"
affects: [76-02, 76-03, marketplace-add, marketplace-update, marketplace-info, reconcile-planner, provider-auth]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generic-https parser arm sits after the github-host check and before the scheme reject (canonical identity)"
    - ".git-suffix canonicalization at parse time so sourceLogical/samePlannedSource compare equal"
    - "Closed-set REASONS amendment is lockstep: tuple + completeness-proof home + tripwire + catalog + style guide"

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/domain/source.ts"
    - "extensions/pi-claude-marketplace/shared/notify.ts"
    - "extensions/pi-claude-marketplace/shared/notify-reasons.ts"
    - "tests/domain/source.test.ts"
    - "tests/architecture/notify-closed-set-locks.test.ts"
    - "tests/architecture/catalog-uat.test.ts"
    - "docs/output-catalog.md"
    - "docs/messaging-style-guide.md"

key-decisions:
  - "D-76-01: normalize a single trailing .git at parse time; only https:// accepted, other schemes named in reject"
  - "D-76-02: github.com URLs (string + object form) always normalize to github kind, checked before the generic-https arm"
  - "D-76-04: owner/repo@ref folds to github+ref; the SP-2 reject and ownerRepoAtRefReason are retired"
  - "D-76-08: authentication required is a FAILURE_REASONS member (not network unreachable); reason+cause ride a synthetic child"

patterns-established:
  - "Order-sensitive parser arms: host-specific check precedes the generic scheme arm to preserve canonical identity"
  - "New closed-set REASONS member must be given a home in a notify-reasons.ts partition view or the completeness proof fails typecheck"

requirements-completed: [MURL-01, MURL-06]

coverage:
  - id: D1
    description: "Generic https:// (non-github) string/object sources parse to UrlSource with a .git-canonical url and optional #ref"
    requirement: "MURL-01"
    verification:
      - kind: unit
        ref: "tests/domain/source.test.ts#parsePluginSource accepts: MURL-01 https non-github string with .git#ref canonicalizes"
        status: pass
      - kind: unit
        ref: "tests/domain/source.test.ts#parsePluginSource accepts: MURL-01 object url source (non-github) stays url with .git stripped"
        status: pass
    human_judgment: false
  - id: D2
    description: "github.com URLs (string + object form) normalize to github kind; owner/repo@ref folds to github+ref"
    requirement: "MURL-01"
    verification:
      - kind: unit
        ref: "tests/domain/source.test.ts#D-76-02 https github.com string stays github kind (host wins)"
        status: pass
      - kind: unit
        ref: "tests/domain/source.test.ts#parsePluginSource accepts: D-76-02 object url source pointing at github.com normalizes to github"
        status: pass
      - kind: unit
        ref: "tests/domain/source.test.ts#D-76-04 owner/repo@ref parses to github kind with ref set"
        status: pass
    human_judgment: false
  - id: D3
    description: "Non-https schemes (http/ssh/scp-form) reject with per-scheme reasons naming the rejected scheme"
    requirement: "MURL-01"
    verification:
      - kind: unit
        ref: "tests/domain/source.test.ts#parsePluginSource rejects: D-76-01 http:// scheme / ssh:// scheme / SSH git@ scp-form"
        status: pass
      - kind: unit
        ref: "tests/domain/source.test.ts#D-76-01 unsupported-scheme reason no longer says 'only github URLs'"
        status: pass
    human_judgment: false
  - id: D4
    description: "samePlannedSource url arm is live, ref-aware, and .git-canonical (reconcile identity holds)"
    requirement: "MURL-06"
    verification:
      - kind: unit
        ref: "tests/domain/source.test.ts#MURL-06 samePlannedSource: .git-suffixed declaration matches bare stored url"
        status: pass
      - kind: unit
        ref: "tests/domain/source.test.ts#MURL-06 samePlannedSource: differing #ref returns 'different' (ref-aware)"
        status: pass
    human_judgment: false
  - id: D5
    description: "authentication required REASONS token minted (33rd member); tripwire, catalog, and style guide in lockstep"
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 33-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (add-authentication-required)"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-07-11
status: complete
---

# Phase 76 Plan 01: Source-parser widening + authentication required token Summary

**Generic https:// sources now parse to a .git-canonical UrlSource, github.com URLs (string + object form) normalize to github kind, owner/repo@ref folds to github+ref, the samePlannedSource url arm is live and ref-aware, and the closed-set gains a truthful `authentication required` REASONS token.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-11T02:00:00Z
- **Completed:** 2026-07-11T02:30:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Widened the pure source-string/object parser: a new generic-`https://` arm produces a `UrlSource` with a single trailing `.git` stripped and an optional `#ref` split off (D-76-01), positioned after the github-host check and before the scheme reject so github.com always wins (D-76-02).
- Folded `owner/repo@ref` upstream shorthand into `github` kind with `ref` (D-76-04), retiring the SP-2 reject and `ownerRepoAtRefReason`; rewrote `unsupportedUrlReason` to name the still-rejected scheme (http/ssh/scp-form).
- Funneled object-form github.com url sources through the github parser so `{source:"url", url:"https://github.com/..."}` resolves to `github` kind (D-76-02).
- Made the `samePlannedSource` url arm live (removed the `c8 ignore`) — it was already ref-aware and, thanks to parse-time `.git` canonicalization, a config-declared `repo.git` reconciles against a stored `repo` with no spurious remove-then-re-add (MURL-06).
- Minted the `authentication required` REASONS token as the 33rd member (D-76-08): error severity, truthful attribution (a 401/403 is an auth failure, never `network unreachable`), with the tripwire bumped 32→33 and catalog + style-guide rows added in lockstep.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the source-string parser + object-form url funnel + owner/repo@ref fold** - `10d9c176` (feat)
2. **Task 2: Make the samePlannedSource url arm live and ref-aware** - `ab88d544` (feat)
3. **Task 3: Mint the "authentication required" REASONS token** - `9f6d090e` (feat)

_Note: TDD tasks 1-2 combined their RED tests and GREEN implementation into a single feat commit per task (tests and implementation live in the same task `<files>`)._

## Files Created/Modified
- `extensions/pi-claude-marketplace/domain/source.ts` - New `parseUrlSource`/`parseOwnerRepo` helpers, generic-https string arm, object-form github funnel, retired SP-2 reject, live samePlannedSource url arm, rewritten reject message.
- `extensions/pi-claude-marketplace/shared/notify.ts` - `authentication required` appended to REASONS (33rd member); tuple doc count 32→33.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - `authentication required` added to `FAILURE_REASONS` (its completeness-proof home); doc counts 32→33.
- `tests/domain/source.test.ts` - New url/github-normalization/owner-repo@ref/per-scheme-reject accept+reject cases; MURL-06 samePlannedSource url-arm cases; updated two stale `.git`-suffix sourceLogical expectations to the canonical form.
- `tests/architecture/notify-closed-set-locks.test.ts` - Tripwire assertion 32→33.
- `tests/architecture/catalog-uat.test.ts` - New `add-authentication-required` byte-equality fixture (synthetic-child failed row + HTTP cause).
- `docs/output-catalog.md` - New `marketplace add` auth-required failure catalog state with rendered byte form.
- `docs/messaging-style-guide.md` - Closed-set REASONS contract row for `authentication required` (error severity, truthful attribution).

## Decisions Made
- **`.git` identity (Claude's Discretion, D-76-01):** normalize a single trailing `.git` at parse time so `https://host/repo.git` and `https://host/repo` compare `"same"`. Simplest truthful rule; documented in a `D-76-01` comment.
- **Auth-required rendered shape:** the CONTEXT-approved preview pairs a 4-space cause chain with a `1 marketplace operation(s) failed.` summary, but those are mutually exclusive in the current renderer — a cause chain requires a synthetic plugin child (SNM-10: marketplace headers carry no `cause`), and a synthetic child makes the cascade a mixed-subject failure whose real summary prefix is `Some operations have failed.`. The catalog documents the actual `notify()` bytes (byte-equality UAT is authoritative), mirroring the existing `update-path-invalid-manifest` synthetic-child precedent. Wave-2 add.ts owns the live wiring.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `authentication required` to `FAILURE_REASONS` completeness proof**
- **Found during:** Task 3
- **Issue:** `shared/notify-reasons.ts` carries a compile-time `_ReasonsCoverageProof` that requires every REASONS member to have a "home" in a partition view. Appending the token to REASONS alone would break `npm run typecheck` (`_UncoveredReason` no longer resolves to `never`). The plan's acceptance criteria require typecheck to stay green.
- **Fix:** Added `authentication required` to `FAILURE_REASONS` (it is a failure-class reason — an operation that could not complete due to auth) and bumped the two `32-entry` doc mentions to `33`.
- **Files modified:** extensions/pi-claude-marketplace/shared/notify-reasons.ts
- **Verification:** `npm typecheck` pre-commit hook passes; `tests/architecture/catalog-uat.test.ts` passes.
- **Committed in:** 9f6d090e (Task 3 commit)

**2. [Rule 1 - Bug] Updated two stale sourceLogical UrlSource test expectations**
- **Found during:** Task 1 (GREEN)
- **Issue:** Two pre-existing tests asserted `sourceLogical` returns a url WITH the `.git` suffix (`https://example.com/p.git`). D-76-01's parse-time canonicalization now strips it, so those expectations were stale and failed.
- **Fix:** Updated both expectations to the canonical `.git`-stripped form (`https://example.com/p`), matching the new D-76-01 identity rule.
- **Files modified:** tests/domain/source.test.ts
- **Verification:** `node --test "tests/domain/source.test.ts"` passes (70 tests).
- **Committed in:** 10d9c176 (Task 1 commit)

**3. [Rule 3 - Blocking] Refactored nested ternary in `unsupportedUrlReason` to an if-chain helper**
- **Found during:** Task 1
- **Issue:** The initial nested-ternary scheme selector tripped `sonarjs/no-nested-conditional` and `@stylistic/padding-line-between-statements` in the lint pre-commit hook.
- **Fix:** Extracted a `rejectedScheme(raw)` if-chain helper with blank-line-separated returns.
- **Files modified:** extensions/pi-claude-marketplace/domain/source.ts
- **Verification:** `npm lint` pre-commit hook passes.
- **Committed in:** 10d9c176 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correctness and the plan's green-typecheck/green-lint acceptance criteria. No scope creep — every change traces to a plan task or its stated acceptance bar.

## Issues Encountered
- **No node_modules in the worktree:** a full `npm run check` (typecheck + ESLint + tests + coverage) cannot run standalone here, but the pre-commit hook environment resolves them (npm lint / format / typecheck all pass per-commit). `node --test` runs natively (Node 22.22.2 strips TS). Full-suite `npm run check` and coverage counting are deferred to the orchestrator post-merge, as is standard in worktree mode. The `samePlannedSource` coverage claim (MURL-06 acceptance criterion) rests on the removed `c8 ignore` + the exercising tests; the coverage gate itself runs post-merge.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The leaf-layer parser + REASONS token are in place for both Wave-2 orchestrator plans (76-02 add/update/remove, 76-03 info/import).
- Wave 2 must: wire `classifyAddError`'s new `HttpError`/401-403 arm to emit the `authentication required` token (D-76-08); widen the add.ts S5b gate and update.ts/remove.ts kind branches to admit `url`; add the info.ts url projection; and read the upstream nested import shape (D-76-13, pending upstream-shape verification per PATTERNS Open Q1).

## Self-Check: PASSED

- SUMMARY.md present on disk.
- All task commits verified in git log: `10d9c176`, `ab88d544`, `9f6d090e`.
- Docs commit verified: `51e61a4c`.

---
*Phase: 76-marketplace-git-url-sources*
*Completed: 2026-07-11*
