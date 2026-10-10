---
phase: 02-adapter-file-delivery
plan: 11
subsystem: mcp-bridge
status: complete
tags: [gap-closure, notifications, user-overrides, catalog]
requires:
  - phase: 02-adapter-file-delivery
    provides: "keptOverride in the plugin entry's marker and the write-back on unstage (plan 02-10); the McpConfigNotice routes from every stage and unstage (plans 02-04..02-08)"
provides:
  - "McpConfigNotice union: McpConfigFileNotice, McpOverrideKeptNotice, McpOverrideRestoredNotice"
  - "The `MCP server override kept.` warning, folded against same-command write-backs"
  - "inactiveOverrideFields (adapter-entry.ts) and restoredOverrideNames (adapter-doc.ts)"
  - "Catalog state mcp-override-kept, byte-locked by tests/architecture/mcp-config-notices.test.ts"
affects: [plan 02-12 cross-scope lifecycle, verification gap 1]
actuals:
  tokens: 21100
  tasks: 3
  commits: 1
plan_head_before: 75408b6d98167b5a18fd4d4da136d67f1fbeb3ff
plan_head_after: 59a0e56d305334246d3267c8f6e39e5fc0dfe42b
tech-stack:
  added: []
  patterns:
    - "A rendered notice can be cancelled by a later non-rendering fact on the same carrier: the seam folds the list in order"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - docs/output-catalog.md
    - tests/shared/notification-dispatch.test.ts
    - tests/architecture/mcp-config-notices.test.ts
    - tests/bridges/mcp/adapter-entry.test.ts
    - tests/bridges/mcp/adapter-doc.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/unstage.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - scripts/check-unused-type-members.contracts.json
key-decisions:
  - "The override-kept fold keys on (scope, file, server) through JSON.stringify, so no separator choice can make two triples collide"
  - "Override lines are built from the fold's standing notices; a Set still removes identical lines"
  - "No orchestrator changed: the new kinds ride the existing McpConfigNotice routes"
requirements-completed: [AFILE-06, AFILE-04]
metrics:
  duration: 44min
  completed: 2026-10-04
---

# Phase 2 Plan 11: Override-Kept Warning Summary

**A stage that absorbs a user's marker-less override now warns `MCP server override kept.` and names the override fields that stop applying (never their values). An unstage reports each write-back as an `override-restored` fact, and the seam drops the matching warning, so a same-command write-back shows nothing.**

## Performance

- **Duration:** about 44 min, of which about 25 min is one full-scope pre-commit run
- **Tasks:** 3 of 3
- **Commits:** 1 (`59a0e56d`), per the plan's single-commit gate
- **Files:** 15 (6 source, 7 test, catalog, contracts JSON)

## What Changed

- **notification-dispatch.ts:** `McpConfigNotice` is now the exported union `McpConfigFileNotice | McpOverrideKeptNotice | McpOverrideRestoredNotice`. `notifyMcpConfigNotices` sends at most three warnings, in the order comments-dropped, left-unchanged, override-kept. The private `standingOverrideNotices` walks the list in order: an `override-kept` notice sets its (scope, file, server) key, a later keep replaces it in its first-set position, and an `override-restored` notice deletes it. `override-restored` renders nothing. The seam doc comment now names override fields; the module's list of direct-notify functions is unchanged.
- **adapter-entry.ts:** `inactiveOverrideFields(override)` returns the override's own keys outside the carried set, in key order, frozen. It reads a module-private `CARRIED_FIELD_SET`; `CARRIED_FIELDS` stays private.
- **stage.ts:** the private `overrideKeptNotices` adds one `McpOverrideKeptNotice` per staged name, in the plugin's declared order, that absorbs an own overlay with inactive fields. It runs after the comments-dropped notice. A restaged name that carries a kept override absorbs no overlay and adds nothing. The comments-dropped and left-unchanged literals are typed `McpConfigFileNotice`.
- **adapter-doc.ts:** `restoredOverrideNames(config, plugin, marketplace)` lists the plugin's entries whose `restorableOverride` is defined, selected key first, file order, de-duplicated, frozen. It uses the same test as the write-back.
- **unstage.ts:** `noticesOf` now takes an `UnstageOwner` (plugin, marketplace, scope). For each rewritten file, in write order, it yields the `comments-dropped` notice (when the bytes held comments) and then one `McpOverrideRestoredNotice` per restored name. `McpUnstagePartialError` keeps receiving `noticesOf(writtenTargets, ...)`. The header comment states the new fact.
- **types.ts:** doc comments only, for `StageMcpCommitResult.notices` and `UnstageMcpResult.notices`.

## Catalog Block (exact bytes)

`docs/output-catalog.md`, inside "## Out-of-band notifications", after `mcp-config-left-unchanged`:

```text
MCP server override kept.

hello now provides "srv" in the project-scope mcp-adapter.json. Your override for "srv" is kept, but these fields of it stop applying: env, headers. It comes back when you uninstall or disable hello.
```

Annotation: `<!-- catalog-state: mcp-override-kept -->` under `### MCP server override kept (AFILE-06)`. `tests/architecture/mcp-config-notices.test.ts` has the row `{ state: "mcp-override-kept", notice: { kind: "override-kept", scope: "project", file: "mcp-adapter.json", plugin: "hello", server: "srv", fields: ["env", "headers"] } }`; its three cases for that row pass. The catalog-contract test still reports "21 fixture modules to 262 exact documented states": the out-of-band section is skipped by its parser.

## Task Results

- **Task 1 (tracer):** the seam, `inactiveOverrideFields`, the stage producer, the catalog block, its byte-lock row and the owner tests went in. The install-flow case `AFILE-06: install over a project override with an env field shows the override notice after its row` asserts the whole `notifications` array (the installed row, then the warning) and that no notification contains `stub-secret`. The tracer gate re-ran the verify block green before Task 2 continued.
- **Task 2 (TDD):** one `test()` per `<behavior>` row. Seam: five fold cases. adapter-doc: `restoredOverrideNames` (selected key first, file order, de-duplicated, invalid kept value skipped, foreign marker skipped) and the empty case. unstage: the per-file order case (comments, then restores, adapter before legacy) and an `McpUnstagePartialError` case built with `lockedLink`. install-flow: the landed-disabled and failed-cascade cases each assert the whole `notifications` array and the adapter file's exact bytes (the override is back), plus the commented-file case (row, comments notice, override notice).
- **Task 3:** Prettier, the contract re-pins, one full-scope pre-commit run, the fallow audit and one commit.

## Re-pinned Contract Entries

Only line numbers moved; every column is unchanged.

| Entry (owner) | Before (id / filter) | After (id / filter) |
|---|---|---|
| `replacement.kind` (stage.ts) | `:317:48` / `:317:22` | `:364:48` / `:364:22` |
| `requireMcpReplacementInternals.replacement.kind` (stage.ts) | `:362:42` / `:362:16` | `:409:42` / `:409:16` |
| `mcpReplacementInternals.kind` (stage.ts) | `:61:29` / `:61:3` | `:66:29` / `:66:3` |
| `McpReplacementNoop.prepared.kind` (types.ts) | `:102:52` / `:102:22` | `:104:52` / `:104:22` |
| `dispatchInfoMessage.message.kind` (notification-dispatch.ts) | `:273:43` / `:273:12` | `:346:43` / `:346:12` |

`npm run lint:type-members`: "Unused type member gate passed with 4 recorded exception(s)." No new member was reported unread, and no `Extract<McpConfigNotice` position was added.

## Verification Evidence

- Task 1 and Task 2 verify blocks: `npm run typecheck` exited 0. The six owner files gave pass 399 / 19 / 52 / 61 / 36 (fail 0 each). `node --test --test-name-pattern="^AFILE-0[46]" tests/orchestrators/plugin/install-flow.test.ts` gave pass 17, fail 0.
- `npm run test:coverage:direct` printed "Direct coverage passed" for notification-dispatch.ts (68/68 branches, 25/25 functions, 600/600 lines), adapter-doc.ts (87/87, 20/20, 383/383), adapter-entry.ts (26/26, 7/7, 157/157), stage.ts (78/78, 20/20, 429/429) and unstage.ts (33/33, 12/12, 214/214).
- `npx fallow health` exited 0 (0 above threshold).
- `npx fallow audit --format json --quiet --explain --gate-marker agent`: verdict **`warn`** (dead code 0, complexity findings 0, 14 clone groups, the known pre-existing set). Not `fail`.
- Pre-commit (`tmp/p2-11-precommit.log`), all 15 `files_modified` paths, `SKIP=trufflehog`, `TMPDIR=/var/tmp/mcp4-p2-11`, first run: **`PRECOMMIT_EXIT=0`**. mdformat and Prettier rewrote nothing. The contracts-JSON change selects the full scope for `npm changed checks`.
- Task 3 verify block: exit 0 (type-member gate, both architecture tests pass 13 / fail 0, the precommit log's last line, `git show --stat`).
- `{ rg -n 'D-02-(19|20|21)' extensions tests; test $? -eq 1; }` exits 0 on the committed tree.
- focused task verification passed; full phase/PR verification pending

## Deviations from Plan

### Auto-fixed Issues

None.

Other notes:
- **adapter-entry.test.ts re-indent.** The module now has two exported entrypoints, so the unit-testing skill's hard rule (one top-level `describe()` per entrypoint) applies. The existing `stampServers` cases moved into `describe("stampServers")` unchanged, and the new cases sit in `describe("inactiveOverrideFields")` as one data-driven row per override shape. The pi-mcp-adapter floor-tie case stays at top level because it tests no entrypoint. This re-indent makes up most of the test diff (403+/358-).
- **No separate RED commit.** The plan's commit gate is one commit for all three tasks, so Task 2's tests and code landed together. Each new seam, unstage and install-flow case asserts output that the code before this plan could not produce (`override-restored` notices, the override line, an override notice missing after a write-back).
- **No existing stage case changed.** The plan expected the 02-10 credentials-absorb case might need its notice added. That case asserts file bytes, not the prepared result, so it passes unchanged.
- **The existing unstage kept-override case** (`AFILE-01: writes an owned entry's kept override back marker-less in place`) asserts the whole result, so its `notices` now holds the one `override-restored` fact. Nothing else in it changed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The mitigations in the threat register are implemented and tested:
- T-02-31: the line carries field names only. The install-flow tracer case asserts that `stub-secret` appears in no notification, and the seam tests pin the exact bytes.
- T-02-32: unstage reports each write-back as `override-restored`, and the seam's fold drops the matching keep. The landed-disabled and failed-cascade install cases assert no override notice and the restored file bytes.

## Self-Check: PASSED

- Files: all 15 `files_modified` paths are in `git show --name-only 59a0e56d`.
- Commit: `59a0e56d` is in `git log`.
