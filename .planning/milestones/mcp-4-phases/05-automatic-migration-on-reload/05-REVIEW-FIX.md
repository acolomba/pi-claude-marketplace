---
phase: 05-automatic-migration-on-reload
fixed_at: 2026-10-08T00:00:00Z
review_path: .planning/phases/05-automatic-migration-on-reload/05-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-10-08
**Source review:** .planning/phases/05-automatic-migration-on-reload/05-REVIEW.md
**Iteration:** 2 (cumulative: iteration 1 fixed WR-01..WR-04 in 73c66e63, fac1896d, c2291945, 7a7d9783)

**Summary (iteration 2):**
- Findings in scope: 3 (fix scope `critical_warning`; IN-01..IN-07 not attempted)
- Fixed: 3
- Skipped: 0

**Where verification ran:** in the main checkout, as the caller directed (no worktree was
created). Each commit ran `SKIP=npm-check pre-commit run --files <files>` and then the
`npm-check` hook (`npm run check:commit`). The hook output was confirmed `Passed` for 822f4809
and c65b16f8. c65b16f8 needed one retry after a lint padding error. For c26007be only the tail
of the output was read, so the first pass was not seen. Its pair (`tests/bridges/mcp/stage.test.ts`)
was later run with `node scripts/test-coverage-direct.mjs` and exited 0. All touched pairs pass
direct coverage: stage, mcp-migration, notification-dispatch and with-state-guard. These suites
pass with `node --test`: `tests/bridges/mcp/*`, `tests/integration/mcp-*` and
`tests/architecture/mcp-migration-notice.test.ts`. `npx fallow audit --base 7a7d9783` reports no
issue in the 15 changed files. It excludes one inherited clone group in `notification-dispatch.ts`,
which this iteration did not touch. The full `npm run check` gate was not run.

## Fixed Issues

### WR-01: The "source not available offline" row still suggests a reinstall for causes a reinstall cannot clear

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`, `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`, `docs/output-catalog.md`, `tests/architecture/mcp-migration-notice.test.ts`, `tests/orchestrators/reconcile/mcp-migration.test.ts`, `tests/shared/notification-dispatch.test.ts`
**Commit:** 822f4809
**Status:** fixed: requires human verification
**Applied fix:** `resolveOffline` now always passes a git-root resolver (`offlineCloneRead`). The resolver records whether the clone cache could not give the plugin's clone: the clone is missing, the record has no sha, or the probe threw. Only that case keeps the `source-unreadable` row and its reinstall remedy, and that row's text is unchanged. Every other offline failure gets a new `marketplace-unreadable` row. These failures are a manifest that is missing or cannot be parsed, a resolve that throws, and an `unavailable` resolve that is not a clone miss (for example, a path-source directory missing from the marketplace copy). The new row says "The <mp> marketplace copy cannot give the source of <p>." It suggests `/claude:plugin marketplace update <mp>` or `/claude:plugin uninstall <p>@<mp>`. `not-listed` is unchanged. The catalog block gains the row, its prose is corrected, and the byte lock includes it. The tests change the manifest-missing case to the new row and add a path-source-dir-missing case. A probe throw (headless mirror) still gets the reinstall row. This keeps the reviewed behaviour, but whether a reinstall clears a corrupt mirror was not checked.

### WR-02: The WR-04 live-server filter keeps old-name panel copies, which are full servers

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`, `docs/output-catalog.md`, `tests/bridges/mcp/stage.test.ts`
**Commit:** c26007be
**Applied fix:** `prepareStageMcpServers` now passes only the override stubs (`panelCopies: false`) through `namesWithNoLiveServer`. Panel copies (marker-less full definitions with their own `directTools` under a moved old name) are always removed, so the result no longer depends on other sources or on the start directory. A new stage test shows that a panel copy `srv` is removed even when a project `.mcp.json` defines `srv`. The existing WR-04 regression ("keeps a same-scope stub whose old name a project .mcp.json still defines") still passes. The catalog's leftover prose now says the live-server rule covers stubs only. The two-scope, project-first migration test the review suggested was not added. Panel copies no longer read any other source, so the stage test covers the code path that test would reach.

### WR-03: The project-stub step takes a full project state transaction

**Files modified:** `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`, `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`, `docs/output-catalog.md`, `tests/transaction/with-state-guard.test.ts`, `tests/orchestrators/reconcile/mcp-migration.test.ts`, `tests/shared/notification-dispatch.test.ts`, `tests/architecture/mcp-migration-notice.test.ts`
**Commit:** c65b16f8
**Status:** fixed: requires human verification
**Applied fix:** `with-state-guard.ts`, the `proper-lockfile` chokepoint, now exports `withExistingScopeLock`. It is the lock lifecycle with no `mkdir` and no state read or write. `withScopeLock` is now `mkdir` followed by that function. proper-lockfile creates its lock directory with a non-recursive mkdir, so it needs the extension root to exist. The new unit test pins the ENOENT result and checks that no directory is created. `clearProjectStubs` behaves as follows:
- When `<cwd>/.pi/pi-claude-marketplace/` exists, it takes only the project scope lock, still inside the user-scope lock. A corrupt project `state.json` no longer blocks the step.
- When that directory is absent, it writes the project `mcp-adapter.json` without the lock (an atomic write, NFR-1) and creates no directory (NFR-10).

The unfinished row gains a required `file` field (`"mcp.json" | "project-scope mcp-adapter.json"`), and the stub failure names the project file. The `stopped` and `unfinished` rows now strip a trailing period from the detail (`sentenceBody`), so the row no longer ends in `..`. New tests cover these cases:
- An invalid project `state.json`: the stub is removed and state is untouched.
- The existing stub test now also asserts that no project extension directory is created.
- The held-lock row now pins `file`.
- A dispatch case renders the project-file row and checks that a detail ending in a period gets only one.

## Operator decisions

1. **WR-03 unlocked write (accepted race):** with no project extension directory, the stub write takes no lock. A project-scope command that starts in that window creates the directory, takes the lock and rewrites the same file, so one of the two updates can be lost. pi-mcp-adapter itself writes this file without our lock in every case. The alternative is to skip the stub removal and report the stub. That needs a new notice kind, and it leaves the stub in place for good.
2. **D-05-02 amendment:** D-05-02 says to suggest `reinstall` for every offline read failure, including "missing marketplace clone, unreadable manifest". WR-01 (here and in iteration 1) now suggests `marketplace update`/`uninstall` for those causes. Please amend D-05-02 in `05-CONTEXT.md`. IN-07 (D-05-08/D-05-10) is still open as well.
3. **Environment damage to repair:** while writing the with-state-guard test, an early draft used `locationsFor("user", ...)` outside a hermetic home. It overwrote the real `~/.pi/agent/pi-claude-marketplace/state.json` with the 10 bytes `{ not json` (2026-10-08 12:46:12). The test was fixed to use project scope before commit. The prior file content is not recoverable from this machine (xfs, no snapshots, no backup file). The file may not have existed before this write. `~/.pi/agent/claude-plugins.json` declares `plugin-dev@claude-plugins-official`. Deleting the corrupt file and running `/reload` should let reconcile rebuild the record from that config (NFR-2). The file was left as is for the operator to decide.

---

_Fixed: 2026-10-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
