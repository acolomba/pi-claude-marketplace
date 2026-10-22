---
phase: 07-marketplace-autoupdate
fixed_at: 2026-10-20T00:00:00Z
review_path: .planning/phases/07-marketplace-autoupdate/07-REVIEW.md
iteration: 4
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-10-20
**Source review:** .planning/phases/07-marketplace-autoupdate/07-REVIEW.md
**Iteration:** 4

**Summary:**

- Findings in scope: 5 (WR-04, WR-05, IN-01, IN-02, IN-03)
- Fixed: 4 (WR-04 and WR-05 in iteration 3, IN-02 and IN-03 in this iteration)
- Skipped: 1 (IN-01)

Iteration 1 fixed WR-01 (commit 4a40a0c2) and WR-02 (commit e32d79a1); its report is in `07-REVIEW-FIX.iter2.md`. Iteration 2 fixed WR-03 (commit 7732b694); its report is in `07-REVIEW-FIX.iter3.md`. Iteration 3 fixed WR-04 and WR-05; its full report, with the mutation proofs, is in `07-REVIEW-FIX.iter4.md`. This iteration changes only comments and prose. No behavior or test changed.

## Fixed Issues

### WR-04: No scenario starts from a base entry with an explicit `autoupdate: false`, so `inheritFrom` can read "the base sets a value" as "on"

**Files modified:** `features/marketplace/autoupdate.feature`, `tests/orchestrators/marketplace/autoupdate.test.ts`
**Commit:** 5cc95f04 (iteration 3)
**Applied fix:** Added the scenario "Disabling autoupdate with --local skips a local entry without a value while the base layer has it set off" and the unit row "inherits off from a base entry that has it off". Both fail only on mutant M1. See `07-REVIEW-FIX.iter4.md`.

### WR-05: No scenario covers a nameless `noautoupdate` of a local-only entry without a value, so a design that "always writes a local-only entry" passes

**Files modified:** `features/marketplace/autoupdate.feature`
**Commit:** 306f6465 (iteration 3)
**Applied fix:** Added the scenario "Disabling autoupdate for every marketplace skips a local entry without a value that the base config does not declare". It fails only on mutant M2. See `07-REVIEW-FIX.iter4.md`.

### IN-02: Two comments still say a nameless flip writes every declaring layer, or only the base entry (carried forward, extended)

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`
**Commit:** 5d70ff48
**Applied fix:**

- Module header, unnamed (D-MF-03) line: now says each recorded marketplace is written in each declaring layer whose value, own or inherited, differs from the request; with `--local`, `claude-plugins.local.json` only. A local entry without a value inherits the base entry's value, or off when the base config does not declare the marketplace (LAYER-09).
- `planEveryFlip` doc comment: "so only the base entry is written" now ends with "when the base config declares the marketplace".

### IN-03: Small inaccuracies and placement issues in the docs (carried forward)

**Files modified:** `README.md`, `README.es.md`, `docs/output-catalog.md`, `CHANGELOG.md`
**Commit:** e63a536d
**Applied fix:**

- README and `README.es.md`: the nameless-flip exception now says a local entry without `autoupdate` takes the new base value "when the base config declares the marketplace" ("cuando la configuración base declara el mercado"). The two `--local` sentences stay in place, and now say "with or without a name" ("con o sin un nombre").
- `docs/output-catalog.md` (marketplace autoupdate, Config files): the same inheritance clause, and the inherited-value failure now "writes nothing in that scope". The next paragraph already covers an earlier scope that was written.
- `CHANGELOG.md`: the unscoped-miss (D-08) sub-bullet moved out of the "declare a marketplace in both configs" entry to its own top-level bullet, right after that entry. It now names the commands in full: `marketplace autoupdate <name>` and `marketplace noautoupdate <name>`.
- The catalog change is prose only, outside every example block. `EXPECTED_UTF8_BYTES` sums only the example blocks, so it stays 46,623, and no fixture changed.

## Skipped Issues

### IN-01: The inherited-value path reports an unreadable base config as `{invalid manifest}` / "failed schema validation" (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:301-311`
**Reason:** It matches the existing CFG-03 layer-gate reporting. A cause change across every site belongs in a later change. The review itself calls the fix optional and says this diff did not introduce the problem.
**Original issue:** `loadConfig` returns `status: "invalid"` for every read error except `ENOENT` (`EACCES` included) and for a JSON parse failure. `inheritFrom` then throws `invalidConfigError`, whose message always says `failed schema validation`, so the `{permission denied}` branch of `autoupdateFailedReason` is never reached on this path.

## Verification

All checks and both commits ran in the main checkout (`/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests`, branch `features/cucumber-behavioral-tests`). No worktree or temp branch was used, so the results reproduce from this tree. Every exit code was captured directly, not through a pipe. The tests ran with a temporary `HOME`, `TMPDIR`, and `PI_CODING_AGENT_DIR` in the session scratchpad.

- IN-02: `node --test tests/orchestrators/marketplace/autoupdate.test.ts` exited 0. `npx eslint extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts --max-warnings 0` exited 0. `SKIP=npm-check pre-commit run --files <file>` exited 0. The commit hook ran `npm run check:commit`, which passed.
- IN-03: `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts` exited 0 (56 tests). `npx cucumber-js features/marketplace/autoupdate.feature` exited 0 (37 scenarios, 366 steps). `SKIP=npm-check pre-commit run --files README.md README.es.md docs/output-catalog.md CHANGELOG.md` exited 0 (mdformat and markdownlint made no changes). The commit hook ran `npm run check:commit`, which passed.
- The full `npm run check` was not run. The orchestrator runs it after the fix loop.

---

_Fixed: 2026-10-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 4_
