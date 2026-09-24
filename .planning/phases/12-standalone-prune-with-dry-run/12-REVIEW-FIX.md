---
phase: 12-standalone-prune-with-dry-run
fixed_at: 2026-09-24T05:50:05Z
review_path: .planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-09-24T05:50:05Z
**Source review:** `.planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.md`
**Iteration:** 2

**Summary:** Three Critical findings and one Warning were fixed across three commits. No finding was skipped. The earlier two-finding review and its fixes remain recorded below.

## Iteration 2 fixed issues

### CR-01: Report durable prune commits after finalization failures

**Status:** fixed: requires human verification
**Commit:** `66613d6c`
**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts`
- `extensions/pi-claude-marketplace/shared/notification-types.ts`
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts`
- `tests/orchestrators/plugin/prune.test.ts`
- `docs/output-catalog.md`
- `tests/architecture/catalog-uat/fixtures/plugin-prune.ts`
- `tests/architecture/catalog-uat/catalog-contract.test.ts`
- `tests/architecture/catalog-uat/catalog-parser.test.ts`

**Applied fix:** Prune records members after a successful state save. A later lock-release or cleanup failure produces a warning on a committed member, with a redacted cause and `/reload` hint. Finalization continues for the remaining members. A failure before state save keeps the existing failed operation row. The output catalog pins the warning text.

### CR-03: Map retained recovery backups to safe relative targets

**Status:** fixed: requires human verification
**Commit:** `9d6819e3`
**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts`
- `tests/orchestrators/plugin/prune-rollback.test.ts`
- `tests/orchestrators/plugin/prune.test.ts`
- `docs/output-catalog.md`
- `tests/architecture/catalog-uat/fixtures/plugin-prune.ts`
- `tests/architecture/catalog-uat/catalog-contract.test.ts`

**Applied fix:** The snapshot writes `manifest.json` atomically before any unstage. Each entry records the restore phase, its root relative to the scope, the target relative to that root, and the numbered backup item. A partial rollback retains the manifest and unresolved backup items. Its error row names the backup directory and directs the operator to the manifest before retrying. A direct test identifies two same-phase skills when one restore fails.

### CR-02: Preserve independent edits to shared metadata during rollback

**Status:** fixed: requires human verification
**Commit:** `9d6819e3`
**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts`
- `tests/orchestrators/plugin/prune-rollback.test.ts`
- `tests/orchestrators/plugin/prune.test.ts`
- `docs/output-catalog.md`
- `tests/architecture/catalog-uat/fixtures/plugin-prune.ts`
- `tests/architecture/catalog-uat/catalog-contract.test.ts`

**Applied fix:** Prune records the post-unstage bytes and mode of `mcp.json` and `agents-index.json` before saving state. Rollback restores either document only if its current version still matches. A collision retains the current document and its original backup and reports a partial rollback. State restoration still runs last under the scope lock. Direct tests cover both shared documents; a command test covers an MCP edit during a failing state save, the retained backup, the notification, and lock cleanup.

### WR-01: Run rollback variants as independent test cases

**Status:** fixed
**Commit:** `6335f8e4`
**Files modified:** `tests/orchestrators/plugin/prune-rollback.test.ts`

**Applied fix:** The six artifact replacement variants and two backup cleanup outcomes run as named sibling tests. Each test creates a fresh hermetic environment and retains its original assertions.

## Iteration 2 verification

All checks ran in the shared `features/manifest` linked checkout. The modified source, test, and catalog sections were re-read after editing. The initial two-skill recovery-map and shared-MCP collision tests failed before their implementations and passed afterward. Focused suites passed: 23 rollback tests, 22 prune tests, 25 registered-command integration tests, and the exact 241-state catalog contract at 34,772 UTF-8 bytes. TypeScript typecheck, scoped ESLint, changed-file Prettier, and diff whitespace checks passed.

Direct-pair coverage reached 100% for `prune-rollback.ts` (98 branches, 20 functions, 362 lines) and `prune.ts` (67 branches, 17 functions, 319 lines). Final scoped pre-commit runs passed for both fix handoffs and the WR-01 test handoff. Each escalated `fallow audit --base HEAD` passed with zero introduced findings. TruffleHog was skipped because the linked checkout cannot expose `.git/index` as a directory; the global npm format hook was skipped because it includes operator-owned dirty `.planning/config.json`, while changed-file Prettier passed. The type-member negative-control hook found no matching files in these handoffs; its standalone escalated run passed 7 of 7 in iteration 1. The full project suite is reserved for post-fix verification.

## Earlier fix history: iteration 1

### CR-01: Prune reports state and lock failures

**Status:** fixed: requires human verification
**Commit:** `b1f2163f`
**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts`
- `tests/orchestrators/plugin/prune.test.ts`
- `tests/integration/standalone-prune.test.ts`
- `docs/output-catalog.md`
- `tests/architecture/catalog-uat/fixtures/plugin-prune.ts`
- `tests/architecture/catalog-uat/catalog-contract.test.ts`
- `tests/architecture/catalog-uat/catalog-parser.test.ts`

**Applied fix:** Preview and actual prune catch state and lock failures at the command boundary. They emit a typed, scoped error row with a redacted cause and no reload hint. A declaration-read failure keeps its separate row. Registered-command tests cover malformed state and a held lock. The output catalog pins both messages.

### CR-02: Failed state saves restore prune artifacts

**Status:** fixed: requires human verification
**Commit:** `0fa8c4d1`
**Files modified:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`
- `tests/orchestrators/plugin/prune.test.ts`
- `tests/orchestrators/plugin/prune-rollback.test.ts`
- `docs/output-catalog.md`
- `tests/architecture/catalog-uat/fixtures/plugin-prune.ts`
- `tests/architecture/catalog-uat/catalog-contract.test.ts`
- `tests/architecture/catalog-uat/catalog-parser.test.ts`

**Applied fix:** Actual prune snapshots bridge-owned artifacts and exact metadata bytes while it holds the scope lock. It completes the snapshot before unstaging any member. A failed sweep or state save restores artifacts and then state. An occupied artifact path stays untouched, the backup remains available, and the command reports `{rollback partial}` with redacted causes. A successful save removes the backup. A prune with no candidates creates no backup and does not save state.

## Iteration 1 verification

All checks ran in the shared `features/manifest` linked checkout. The two source files and their paired tests were read again after the edits. TypeScript typecheck, scoped ESLint, changed-file Prettier, catalog contract, and diff checks passed.

The CR-02 focused unit, catalog, and integration tests passed. The registered-command integration file passed 25 of 25 tests. Direct-pair coverage passed at 100% for `prune.ts` (50 branches, 13 functions, 259 lines) and `prune-rollback.ts` (67 branches, 15 functions, 277 lines). The tests cover save rejection before and after a write, absent original state, restored artifacts and metadata, partial rollback, a successful cleanup, and a no-candidate prune.

The final scoped pre-commit run passed every applicable hook. It skipped the TruffleHog hook because the linked checkout cannot expose `.git/index` as a directory. It skipped the global npm format hook because that hook includes operator-owned dirty `.planning/config.json`; changed-file Prettier passed. The final escalated `fallow audit --base HEAD` passed with zero introduced findings. The standalone escalated type-member negative controls passed 7 of 7. The full project suite is reserved for final post-fix verification.

---

_Fixed: 2026-09-24T05:50:05Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
