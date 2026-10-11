---
phase: 02-adapter-file-delivery
plan: 12
subsystem: mcp-bridge
status: complete
tags: [gap-closure, integration, user-overrides, prune-rollback, cascades]
requires:
  - phase: 02-adapter-file-delivery
    provides: "keptOverride in the entry marker and the write-back on unstage (plan 02-10); the override-kept warning and override-restored fact (plan 02-11)"
provides:
  - "Cross-scope integration case: a project-level disable survives a project install, update, reinstall and uninstall of a user-scope plugin"
  - "Orchestrator cases for prune rollback and commit, cascadeUnstagePlugin, disable then enable, and a commented uninstall with a kept override"
  - "BACKLOG MCPOVR-01 updated for the kept override"
affects: [phase 2 verification gap 1, MCPOVR-01]
actuals:
  tokens: 7900
  tasks: 3
  commits: 1
plan_head_before: f88cb1be52493634605236ce1c996e788d268bea
plan_head_after: dc4971c618c2bf86f213c55172d7145ed4113cc1
tech-stack:
  added: []
  patterns:
    - "Case-local seed helpers shared by a new case and the existing case it mirrors, so no new clone group appears"
key-files:
  created: []
  modified:
    - tests/integration/mcp-override-lifecycle.test.ts
    - tests/orchestrators/plugin/prune.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - .planning/BACKLOG.md
key-decisions:
  - "No production code changed; every behavior the plan names already held"
  - "unstageMcpServers has one production caller, inside cascadeUnstagePlugin, so the cascade case covers marketplace remove and reconcile"
requirements-completed: [AFILE-01, AFILE-04, AFILE-05, AFILE-06]
metrics:
  duration: 33min
  completed: 2026-10-04
---

# Phase 2 Plan 12: Kept Override Across Every Unstage Path Summary

**The real install, update, reinstall and uninstall operations keep a project-level disable of a user-scope plugin's server through a whole project-scope cycle and never touch the user file. Prune (rolled back and committed), `cascadeUnstagePlugin`, disable then enable, and a commented uninstall each write the kept override back with the notices the user should see. No production code changed.**

## Performance

- **Duration:** about 33 min, of which about 25 min is one full-scope pre-commit run
- **Tasks:** 3 of 3
- **Commits:** 1 (`dc4971c6`), per the plan's single-commit gate
- **Files:** 6 (5 test files, BACKLOG.md)

## Cross-Scope Lifecycle (Task 1)

Case `AFILE-06: a user-scope plugin disabled in the project keeps that disable through a project install, update, reinstall and uninstall` in `tests/integration/mcp-override-lifecycle.test.ts`. The file's seed now registers `mp` at each scope it is given; `makeCtx` now records notifications and returns the `{ ctx, pi }` pair as `session`, so spreading it into an operation's options passes no extra member. The case asserts every step's whole `notifications` array in one `deepStrictEqual`.

| Step | Notifications (in order) | File evidence |
|---|---|---|
| 1. Install `hello` at user scope | `A plugin operation needs attention.` / `● mp [user]` / `● hello v1.0.0 (installed) {requires pi-mcp-adapter}` / reload hint (warning) | user bytes kept as `userBytes` |
| 2. Write the project override `srv` = `{ "disabled": true, "env": { "STUB_TOKEN": "stub-secret" } }` | none | bytes kept as `overrideBytes` |
| 3. Install at project scope | the installed row for `[project]` (warning); then `MCP server override kept.` with `hello now provides "srv" in the project-scope mcp-adapter.json. Your override for "srv" is kept, but these fields of it stop applying: env. It comes back when you uninstall or disable hello.` (warning) | project entry has `disabled: true` and `keptOverride` = the override; user bytes = `userBytes` |
| 4. Publish 1.1.0 (`args` `["v2.js"]`), update at project scope | `● hello v1.0.0 → v1.1.0 (updated) {requires pi-mcp-adapter}` (warning); no override notice | project `srv` has `args` `["v2.js"]`, `disabled: true`, same `keptOverride`; user bytes unchanged |
| 5. Reinstall at project scope | `● hello v1.1.0 (reinstalled) {requires pi-mcp-adapter}` (info, as the catalog's `success-with-soft-dep` reinstall state shows); no override notice | project bytes = step 4 bytes; user bytes unchanged |
| 6. Uninstall at project scope | `○ hello v1.1.0 (uninstalled)` + reload hint (info) only | project bytes = `overrideBytes`; user bytes = `userBytes` |
| 7. Uninstall at user scope, then install at user scope again | `○ hello v1.0.0 (uninstalled)` (info); then `● hello v1.1.0 (installed) {requires pi-mcp-adapter}` (warning), no failure | user file again holds hello's marked `srv` (v2) |
| 8. End | -- | neither `<cwd>/.pi/mcp.json` nor `<agentDir>/mcp.json` exists |

Step 3 also shows the collision walk exempts the plugin's own user-scope entry while the target holds an override. Step 7 shows the written-back project override is a partial entry, which the walk treats as an override (AFILE-05).

## Unstage Paths (Task 2)

- **prune.test.ts:** `NFR-3: a rolled-back prune restores the plugin entry that keeps a user override byte-for-byte` (adapter bytes, state bytes, no `prune-backup-*`, record still lists `orphan-server`, single failed row) and `AFILE-01: a committed prune writes the pruned plugin's kept override back` (uninstalled row only; file is the two-space marker-less override). The existing NFR-3 own-write case and the two new ones share a case-local `seedMcpOrphan` and a `REFUSED_SAVE_TRANSACTION` constant; the old case's assertions are unchanged.
- **shared.test.ts:** `AFILE-01: cascadeUnstagePlugin writes a kept override back and reports the write-back` asserts the whole `UnstageOutcome` (`dropped.mcpServers` `["sample-server"]`, one `override-restored` notice, `writtenMcpFiles` with the exact bytes) and the file bytes.
- **enable-disable.test.ts:** `AFILE-06: disable writes a kept override back and enable keeps it again with the override notice` at user scope: enable -> installed row then the override warning (fields `env`); disable -> disabled row only and the file equals the kept override bytes; enable again -> the same two notifications.
- **uninstall.test.ts:** `AFILE-04: uninstall over a commented mcp-adapter.json writes the kept override back and shows only the comments notice`: uninstalled row then the project comments-removed warning; file is the two-space form of `{ "mcpServers": { "uni-server": { "disabled": true } } }`. It and the existing AFILE-04 commented-file case now share `uninstallOverAdapterFile` and `HELLO_UNINSTALLED_ROW`; the existing case's expectations are unchanged.

## Verification Evidence

- Task 1 verify: `node --test tests/integration/mcp-override-lifecycle.test.ts` -> pass 2, fail 0. The tracer gate re-ran it green before Task 2.
- Task 2 verify: the pattern-filtered run (`keeps a user override|kept override`) over the four owner files -> pass 5, fail 0. The four owner files plus the integration file run whole -> tests 350, pass 350, fail 0.
- Single-caller check (checker advisory): `rg -n "unstageMcpServers\(" extensions` prints only the definition (`bridges/mcp/unstage.ts:183`) and one call (`orchestrators/marketplace/shared.ts:447`), which is inside `cascadeUnstagePlugin` (starts at line 387). No other production caller exists, so marketplace remove and reconcile reach the write-back only through the primitive the cascade case covers.
- `npm run typecheck` exit 0; `npx eslint` on the five test files exit 0; Prettier changed nothing.
- `npx fallow audit --format json --quiet --explain --gate-marker agent`: verdict **`warn`** (dead code 0, complexity 0, 14 clone groups, the known pre-existing set; no clone group touches the changed test files).
- Pre-commit (`tmp/p2-12-precommit.log`), all six `files_modified` paths, `SKIP=trufflehog`, `TMPDIR=/var/tmp/mcp4-p2-12`, first run: **`PRECOMMIT_EXIT=0`** (`npm changed checks` passed, full scope).
- Task 3 verify: the log's last line, `git show --stat --format=%s HEAD`, and `{ rg -n 'D-02-(19|20|21)' extensions tests; test $? -eq 1; }` all pass.
- focused task verification passed; full phase/PR verification pending

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `makeCtx` spread passed `notifications` into operation options**
- **Found during:** Task 3 typecheck
- **Issue:** recording notifications in the integration file's `makeCtx` made `{ ...makeCtx(), ...request }` carry a `notifications` member that conflicts with the options' own `notifications` type (TS2345/TS2769), including in the existing case.
- **Fix:** `makeCtx` returns `{ session: { ctx, pi }, notifications }`; both cases spread `.session`. Two `JSON.parse` results got `unknown` annotations for `no-unsafe-assignment`.
- **Files modified:** tests/integration/mcp-override-lifecycle.test.ts
- **Commit:** dc4971c6

Other notes:
- **Shared seeds over new clones.** The new prune and uninstall cases mirror existing cases closely, so each file gained one case-local helper used by the old and new case. The old cases' assertions did not change.
- **Step 7 version.** The user-scope reinstall installs 1.1.0, because the marketplace manifest was republished at step 4.
- **BACKLOG.md** cites D-02-21 in prose, like the entry's existing D-02-15 citation; the no-`D-02-NN` rule covers `extensions` and `tests` only.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The mitigations in the threat register are tested:
- T-02-34: the NFR-3 kept-override case proves the rollback restores the entry with its `keptOverride` exactly.
- T-02-35: step 7 of the integration case reinstalls at user scope over the written-back project override with no refusal.
- T-02-36: the integration case asserts the user file's bytes after every project step. This is the evidence for the plan's descriptor-less prohibition (a write-back changes only the file that held the entry).

## Self-Check: PASSED

- Files: all six `files_modified` paths are in `git show --name-only dc4971c6`.
- Commit: `dc4971c6` is in `git log`.
