---
phase: 12-standalone-prune-with-dry-run
fixed_at: 2026-09-24T13:49:18Z
review_path: .planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.md
iteration: 5
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-09-24T13:49:18Z
**Source review:** `.planning/phases/12-standalone-prune-with-dry-run/12-REVIEW.md`
**Iteration:** 5

**Summary:** One Critical finding was fixed. No finding was skipped. Earlier fixes remain recorded below.

## Iteration 5 fixed issues

### CR-01: Cleanup failure is attributed to the wrong pruned plugin

**Status:** fixed: requires human verification
**Commit:** `97f39a60`
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts`, `extensions/pi-claude-marketplace/shared/notification-types.ts`, `extensions/pi-claude-marketplace/shared/notification-summary.ts`, `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`, `tests/orchestrators/plugin/prune.test.ts`, `tests/shared/notification-types.test.ts`, `tests/shared/notification-summary.test.ts`, `tests/shared/notification-dispatch.test.ts`, `tests/architecture/notify-closed-set-locks.test.ts`, `docs/output-catalog.md`, `tests/architecture/catalog-uat/fixtures/plugin-prune.ts`, `tests/architecture/catalog-uat/catalog-contract.test.ts`, `tests/architecture/catalog-uat/catalog-parser.test.ts`, and `scripts/check-unused-type-members.contracts.json`.

**Applied fix:** Cleanup failures retain the member that raised them. Only that member's committed removal row receives its warning and cause. A transaction-wide failure after save emits a separate typed, scoped warning that states prune committed and requests `/reload`. Tests prove that `a` loses its data while `b` keeps its data and receives its own cleanup warning. A combined lock-release and `b` cleanup failure keeps both causes on their proper notifications. The exact second-member and committed-warning outputs are pinned in the catalog. The type-member contract coordinates now point to the `kind` selectors after those source lines moved.

## Iteration 5 verification

Checks ran in the shared `features/manifest` linked checkout. The new second-member regression failed before the implementation and passed after it. Focused prune, notification, and catalog tests passed (287 cases). The standalone prune integration passed (25 cases), and the changed notification-kind architecture and type tests passed with prune (68 cases). Direct-pair coverage reached 100% for `prune.ts` (68 branches, 18 functions, 336 lines), `notification-dispatch.ts` (47 branches, 17 functions, 449 lines), `notification-summary.ts` (130 branches, 19 functions, 636 lines), and `notification-types.ts` (26 branches, 3 functions, 861 lines). The final full unit run passed all 7,758 tests with 100% aggregate line, branch, and function coverage; all 15 integration test files passed. The parent's final scoped pre-commit run passed global lint, typecheck, Fallow, changed-pair coverage, the positive type-member check, changed-file Prettier, and Markdown checks. It skipped `npm-type-members-negative` because the sandbox cannot spawn Node (`EPERM`); the separate escalated run passed 7 of 7. It also skipped `trufflehog` for the linked checkout's `.git/index` limitation and `npm-format-check` because it scans untouched operator-owned `.planning/config.json`. The sandboxed Fallow agent audit returned a JSON temporary-worktree runtime error; the escalated `fallow audit --base HEAD` passed with zero introduced findings. Diff whitespace checks passed.

## Earlier fix history: iteration 4

## Iteration 4 fixed issues

### CR-01: A failed directory publication leaves a partial artifact

**Status:** fixed: requires human verification
**Commit:** `e35c747b`
**Files modified:** `prune-rollback.ts`, `prune-rollback.test.ts`, `prune.test.ts`, and `docs/output-catalog.md`.

**Applied fix:** The user chose to preserve every possible replacement. When a directory target is absent, rollback leaves it absent and reports structured partial recovery. It retains the numbered backup and manifest for manual restoration. An identical existing directory remains accepted, and a changed directory remains untouched. Tests cover complete nested backups, repeated rollback, state restoration, and the command notification.

### CR-02: Hard-link publication aliases a restored file to its backup

**Status:** fixed: requires human verification
**Commit:** `e35c747b`
**Files modified:** `prune-rollback.ts` and `prune-rollback.test.ts`.

**Applied fix:** Rollback copies each regular-file backup to a private inode, restores its mode, and exclusively links that staged file into the destination. A deterministic write after publication changes the target without changing the retained numbered backup, even when a later MCP collision makes rollback partial.

### CR-03: The process umask changes restored directory permissions

**Status:** fixed: requires human verification
**Commit:** `e35c747b`
**Files modified:** `prune-rollback.ts` and `prune-rollback.test.ts`.

**Applied fix:** Rollback does not automatically publish directory artifacts, so process umask cannot change a restored directory's mode. The saved directory remains in the backup for manual restoration. File publication applies the saved mode with `chmod`; a test uses umask `0o077` and checks the exact restored file mode.

## Iteration 4 verification

Checks ran in the shared `features/manifest` linked checkout. The new missing-directory regression failed against automatic publication and passes with manual recovery. Focused rollback (34 cases), prune command (26 cases), standalone integration, and catalog contract/parser tests pass. Direct-pair coverage reaches 100% for `prune-rollback.ts` (102 branches, 19 functions, 390 lines) and `prune.ts` (70 branches, 18 functions, 331 lines). TypeScript typecheck, scoped ESLint, changed-file Prettier, diff whitespace checks, and scoped pre-commit pass. Pre-commit skipped `trufflehog` for the linked checkout's `.git/index` limitation and `npm-format-check` because its global scan includes the untouched operator-owned `.planning/config.json`; changed-file Prettier passed. The sandboxed Fallow agent audit returned a JSON temporary-worktree runtime error, which project instructions treat as non-blocking.

The escalated `fallow audit --base HEAD` passed with no findings. Node's `rename` API has no no-replace option for directories. The user chose manual recovery for missing directory targets so rollback never publishes into that race. The command reports the backup manifest and each directory restore failure; `/reload` is not suggested because persistence did not commit.

## Earlier fix history: iteration 3

## Iteration 3 fixed issues

### CR-01: Preserve independent edits to shared metadata

**Status:** fixed: requires human verification
**Commit:** `7060c032`
**Files modified:** `prune-rollback.ts`, `prune.ts`, their paired tests, `docs/output-catalog.md`, and catalog fixtures and tests.

**Applied fix:** Rollback no longer treats a post-sweep read as proof that prune owns a shared document. If `mcp.json` or the agents index differs from the snapshot, rollback leaves it in place, retains the original backup and manifest, and reports partial recovery. This deliberately requires manual merging when prune itself changed shared metadata: the scope state lock does not coordinate independent writers. Tests cover an MCP edit after a cascade that owns no MCP resources, an edit during rollback observation, absent metadata, and a damaged backup.

### CR-02: Publish restored artifacts without replacing another entry

**Status:** fixed: requires human verification
**Commit:** `7060c032`
**Files modified:** `prune-rollback.ts` and `prune-rollback.test.ts`.

**Applied fix:** Regular files use same-filesystem hard-link publication, symlinks use exclusive symlink creation, and directories are reserved with exclusive `mkdir` before child entries are published. A collision at publication leaves the independent entry and recovery backup in place. A deterministic test creates a replacement at the file publication boundary and checks both sets of bytes.

### CR-03: Check the full replacement and backup state

**Status:** fixed
**Commit:** `7060c032`
**Files modified:** `prune-rollback.test.ts`.

**Applied fix:** Each of the six replacement cases verifies the replacement kind, bytes or directory inventory, and mode where relevant. Each case reads the original from the path named by the recovery manifest.

### WR-01: Keep rollback details through lock-release wrapping

**Status:** fixed: requires human verification
**Commit:** `7060c032`
**Files modified:** `prune.ts`, `prune.test.ts`, `docs/output-catalog.md`, and catalog fixtures and tests.

**Applied fix:** Notification lookup follows the error cause chain with cycle protection to recover structured rollback failures while preserving the complete outer release error. A real state-guard test combines a partial MCP rollback with lock-release rejection. The catalog pins the exact combined message.

## Iteration 3 verification

Checks ran in the shared `features/manifest` linked checkout. Focused suites passed: 30 rollback tests, 24 prune tests, 25 registered-command integration tests, and the 243-state catalog contract at 35,702 UTF-8 bytes. Direct-pair coverage reached 100% for `prune-rollback.ts` (104 branches, 19 functions, 384 lines) and `prune.ts` (71 branches, 18 functions, 331 lines). Changed-file Prettier, scoped ESLint, TypeScript typecheck, and diff whitespace checks passed. The final scoped pre-commit run passed with `trufflehog` skipped for the linked checkout's `.git/index` limitation and `npm-format-check` skipped because its global scan fails on the untouched operator-owned `.planning/config.json`; changed-file Prettier passed. The sandboxed `fallow audit` returned a JSON runtime error while creating its temporary worktree, which the project instructions treat as non-blocking. The escalated `fallow audit --base HEAD` passed with no findings. The full project suite is reserved for post-fix verification.

## Earlier fix history: iteration 2

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

_Fixed: 2026-09-24T13:49:18Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 5_
