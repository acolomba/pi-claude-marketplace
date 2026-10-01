---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
plan: 01
subsystem: marketplace-add
tags: [git, clone-url, isomorphic-git, marketplace-add, url-source]

requires:
  - phase: 01-private-repos-on-any-git-host
    provides: buildAuthForHost host-keyed GitAuthBundle on every https clone
provides:
  - "networkCloneUrl(source) in domain/clone-key.ts: the wire-url sibling to canonicalCloneUrl"
  - "stripSlashAndFragment in domain/source.ts: the .git-preserving half of the parse-time strip"
  - "marketplace add's addGitClonedInGuard wired to derive its clone url from the parsed source, not a pre-computed cloneUrl"
affects: [02-02-plugin-clone-cache-seams, 02-03-residual-suite-audit-and-check]

actuals:
  tokens: 6880
  tasks: 3
  commits: 3
  plan_head_before: 0bfdde810475e07a7792475dff67ecbeb14e06a1
  plan_head_after: 5a745526a31cab74cc3d63ed7b404687b3a58bdd

tech-stack:
  added: []
  patterns:
    - "Sibling pure-function derivation beside an existing one in the same module (networkCloneUrl beside canonicalCloneUrl), rather than a new file or type member."
    - "Extract-and-wrap: stripUrlDecorations becomes a thin .git-strip wrapper over the newly exported stripSlashAndFragment, preserving its own behavior byte-for-byte."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/domain/clone-key.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - tests/domain/source.test.ts
    - tests/domain/clone-key.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/edge/handlers/marketplace/add.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "networkCloneUrl's url arm reads source.raw (not source.url) so a user-typed trailing .git survives to the wire, per D-2-01/D-2-03."
  - "ALLOWED_MARKETPLACE_REMOTES is narrowed per source.kind, not per hostname: only kind: github keeps the .git suffix; every url-kind entry (including the case-folded GitHub.com and gitlab.com fixtures, neither of which our parser recognizes as github) drops it."
  - "The two test titles naming the retired suffix-everywhere rule (MURL-01) are retitled to MURL-08 rather than having their assertions edited under an unchanged name."
  - "Task 2's tests are additive coverage over behavior Task 1's tracer already implemented and verified end-to-end; no RED phase was possible without reverting Task 1's production commit, so Task 2 produced one test(...) commit rather than a RED/GREEN pair (see Deviations)."
  - "The check-unused-type-members.contracts.json line:col pins for addMarketplace.opts.notifications were remapped from line 539 to 540, matching the one-line shift the new domain/clone-key.ts import introduces above them -- owner/key/purpose left untouched, per the plan's own remap contingency."

requirements-completed: [MURL-08, MURL-09]

coverage:
  - id: D1
    description: "A url-source marketplace add against a port that admits ONLY the verbatim path succeeds end-to-end (real edge handler, parser, orchestrator)."
    requirement: "MURL-08"
    verification:
      - kind: e2e
        ref: "tests/edge/handlers/marketplace/add.test.ts#(CLONE_URL is now the verbatim form)"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-08: url source clones the URL as typed, with a bundle bound to its host"
        status: pass
    human_judgment: false
  - id: D2
    description: "A github source's wire URL stays byte-identical (.git appended), and canonicalCloneUrl is unchanged for every kind."
    requirement: "MURL-08"
    verification:
      - kind: unit
        ref: "tests/domain/clone-key.test.ts#canonicalCloneUrl (3 unchanged exact-string cases)"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-01 regression: github source is byte-identical"
        status: pass
    human_judgment: false
  - id: D3
    description: "A url source whose typed input ends in .git still sends .git (derived from source.raw, not the parse-time-stripped source.url)."
    requirement: "MURL-08"
    verification:
      - kind: unit
        ref: "tests/domain/clone-key.test.ts#networkCloneUrl: preserves a trailing .git the user typed, even though source.url stripped it"
        status: pass
    human_judgment: false
  - id: D4
    description: "Exactly one clone attempt per operation on the success path and on three failure paths (404, 401, D-2-02 refusal), with the sent URL asserted by value in the same case."
    requirement: "MURL-09"
    verification:
      - kind: integration
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-09: a 404 clone failure makes exactly one attempt and keeps its original identity"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-09: a 401 clone failure makes exactly one attempt and keeps its original identity"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-09 / D-2-02: an add against a suffix-only port fails naming the verbatim URL that was sent"
        status: pass
    human_judgment: false
  - id: D5
    description: "A 401/403/404/5xx from the clone keeps its original error identity and message through the add seam."
    requirement: "MURL-09"
    verification:
      - kind: integration
        ref: "tests/orchestrators/marketplace/add.test.ts#MURL-09: a 404 / 401 clone failure ... keeps its original identity"
        status: pass
    human_judgment: false

duration: 95min
completed: 2026-09-26
status: complete
---

# Phase 2 Plan 1: Clone verbatim URLs instead of decorating with `.git` Summary

**`networkCloneUrl(source)` replaces the unconditional `ensureGitSuffix` on the marketplace-add clone seam, proven end-to-end against a git port that admits only the verbatim URL and blocks the `.git` form.**

## Performance

- **Duration:** 95 min
- **Started:** 2026-09-26T23:10:00Z
- **Completed:** 2026-09-27T00:45:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `networkCloneUrl(source)` in `domain/clone-key.ts` beside `canonicalCloneUrl`: a 3-arm switch over `github` / `url` / `git-subdir` with no `default`, where only the `github` arm appends `.git` (via `ensureGitSuffix`, keeping that helper's last production consumer alive against `fallow`'s dead-code gate).
- Extracted `stripSlashAndFragment` in `domain/source.ts` (trailing-slash trim + `#<ref>` split, `.git` left untouched) and made the parse-time `stripUrlDecorations` a thin wrapper adding the `.git` strip on top — behavior-identical to before.
- Wired `orchestrators/marketplace/add.ts::addGitClonedInGuard` to `networkCloneUrl(args.source)`, removing the now-dead `cloneUrl: string` args field and both call-site passes (`addGithubInGuard`, `addUrlInGuard`); `addGithubInGuard` keeps its own `cloneUrl` local since `hostFromCloneUrl` still reads it.
- Narrowed `tests/orchestrators/marketplace/add.test.ts`'s `ALLOWED_MARKETPLACE_REMOTES` to admit exactly the verbatim form per `source.kind`, retitled the two cases whose names promised the retired suffix-everywhere rule, and added direct-coverage and end-to-end proof for the new derivation.
- Added the MURL-09 regression guard: exactly one recorded clone call on the success path and on three failure paths (404, 401, and the accepted D-2-02 refusal), with the sent URL asserted by value alongside the count in every case.

## Task Commits

1. **Task 1: A verbatim-only endpoint clones, end to end** - `48493e4e` (feat)
2. **Task 2: every arm of the new derivation is covered directly** - `c0e5a1fe` (test)
3. **Task 3: exactly one attempt, and a failure that is still itself** - `5a745526` (test)

_Note: Task 2 carried `tdd="true"` but produced a single `test(...)` commit rather than a RED/GREEN pair — see Deviations._

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/source.ts` - exports `stripSlashAndFragment`; `stripUrlDecorations` becomes a thin wrapper over it
- `extensions/pi-claude-marketplace/domain/clone-key.ts` - adds `networkCloneUrl`; corrects `canonicalCloneUrl`'s docstring tail
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - `addGitClonedInGuard` derives its clone url from `networkCloneUrl(source)`; drops the dead `cloneUrl` args field and the `ensureGitSuffix` import
- `tests/domain/source.test.ts` - new `describe("stripSlashAndFragment", ...)` block (7 cases, 100% direct coverage)
- `tests/domain/clone-key.test.ts` - new `describe("networkCloneUrl", ...)` block (8 cases, 100% direct coverage)
- `tests/orchestrators/marketplace/add.test.ts` - narrowed remote allowlist (+1 fixture entry for the D-2-02 case), two retitled cases, five rewritten wire-URL expectations, three new count-and-identity regression cases
- `tests/edge/handlers/marketplace/add.test.ts` - `CLONE_URL` constant now carries no `.git` suffix, making the fake a verbatim-only endpoint for the end-to-end proof
- `scripts/check-unused-type-members.contracts.json` - two `addMarketplace.opts.notifications` pins remapped from line 539 to 540

## Decisions Made

- `networkCloneUrl`'s `url` arm reads `source.raw`, never `source.url` — the parse-time-stripped identity form would silently discard a user-typed `.git`.
- The `ALLOWED_MARKETPLACE_REMOTES` narrowing decision is keyed on `source.kind`, not the hostname string: `https://GitHub.com/acme/mp` and `https://gitlab.com/team/mp` are both `url` kind under this parser (case-sensitive github prefix check; no gitlab.com literal), so both drop the suffix despite the host name looking github/gitlab-adjacent.
- Retitled rather than silently reworded: both cases whose titles promised the retired suffix-everywhere rule (`MURL-01`) are retitled to `MURL-08`, keeping the requirement ID traceable while the assertion changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `import-x/order` requires a blank line between clone-key.ts's new value import and its existing type-only import**
- **Found during:** Task 3 (`npm run lint` verify gate)
- **Issue:** Adding `import { ensureGitSuffix, stripSlashAndFragment } from "./source.ts";` directly above the pre-existing `import type { ... } from "./source.ts";` violates the project's `"type"` group being separated by `newlines-between: "always"`.
- **Fix:** Inserted one blank line between the two import statements.
- **Files modified:** `extensions/pi-claude-marketplace/domain/clone-key.ts`
- **Verification:** `npm run lint` exits 0; `node --test` and direct coverage re-run clean afterward.
- **Committed in:** `5a745526` (bundled with Task 3, the commit whose verify gate caught it)

**2. [Rule 3 - Blocking] `check-unused-type-members.contracts.json` line:col pins drifted by one line**
- **Found during:** Task 1, immediately after adding the new `domain/clone-key.ts` import to `add.ts`
- **Issue:** The plan's own research (RESEARCH.md Gate Exposure section) stated the two `addMarketplace.opts.notifications` pins at `add.ts:539:35` / `:539:52` sat above no other edit in this plan except the url-arm comment — but it did not anticipate the new import line the seam wiring requires, which shifts every line below it down by one.
- **Fix:** Remapped both `id` and both `refines` line numbers from 539 to 540 (columns unchanged — same content, shifted one line). Owner, key, and purpose fields untouched; no entry added or removed.
- **Files modified:** `scripts/check-unused-type-members.contracts.json`
- **Verification:** `npm run lint:type-members` exits 0 with the same 4 pre-existing exceptions and no new drift warning; contracts count unchanged at 108.
- **Committed in:** `48493e4e` (Task 1)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues the plan's own contingency clauses anticipated and authorized). **Impact:** No scope creep; both fixes are exactly the remediation the plan's own text named as the expected fallback.

### TDD Gate Compliance

Task 2 carried `tdd="true"` but the plan's own task boundaries make a literal RED phase impossible: Task 1 (a `type="tracer"` task) already implemented and end-to-end-verified `networkCloneUrl` and `stripSlashAndFragment` in a separate, already-committed commit, and Task 2's `<files>` list is test-files-only (no production edit). Writing a "failing" test first would have required reverting Task 1's already-verified production commit, which is not what the plan's Task 2 `<action>`/`<behavior>` describes — it describes backfilling arm-by-arm direct-coverage cases for an already-correct, already-tracer-proven implementation. Per the "Unexpected GREEN in RED phase" fail-fast rule's own escape hatch ("the feature may already exist"), this is exactly that case, by design of the plan's tracer-first sequencing. Task 2 therefore produced one `test(02-01): ...` commit with the full arm-by-arm case set (100% direct coverage on both target files), rather than a `test(...)` / `feat(...)` pair. No `feat(...)` commit was needed because no production code changed in Task 2.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `networkCloneUrl` and `stripSlashAndFragment` are landed, tested at 100% direct coverage, and proven end-to-end on the `marketplace add` seam.
- Plan 02 (wave 2) threads the same `networkCloneUrl` derivation through the three `clone-cache.ts` seam sites (`materializePluginClone`, `materializeOrRefreshPluginMirror`, `resolvePluginPin`) and their nine callers, per ROADMAP's sequencing.
- Whole-suite `test:coverage:unit` thresholds are expected to stay red until plan 02 lands the plugin-clone seam (stated in the plan's own `<verification>` block) — not a regression introduced here.
- No blockers.

---
*Phase: 02-endpoints-that-answer-only-at-the-verbatim-url*
*Completed: 2026-09-26*

## Self-Check: PASSED

All 8 modified files and the SUMMARY itself verified present on disk; all 3 task commits (`48493e4e`, `c0e5a1fe`, `5a745526`) verified present in git log.
