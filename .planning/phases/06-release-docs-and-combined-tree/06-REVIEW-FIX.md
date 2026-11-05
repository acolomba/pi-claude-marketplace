---
phase: 06-release-docs-and-combined-tree
fixed_at: 2026-11-05T04:10:00Z
review_path: .planning/phases/06-release-docs-and-combined-tree/06-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-11-05
**Source review:** .planning/phases/06-release-docs-and-combined-tree/06-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 3 (fix scope: Critical and Warning; the review has no Critical finding)
- Fixed: 3
- Skipped: 0
- Info findings covered as a side effect: IN-03 (by WR-02). IN-01, IN-02, IN-04, IN-05, IN-06, and IN-07 stay open in 06-REVIEW.md.

All edits and commits ran in the main checkout on `features/mcp-builtin`, with no worktree. Verification also ran there.

## Fixed Issues

### WR-01: README remedy for `{requires builtin mcp}` does not work while pi-mcp-adapter is loaded

**Outcome:** fixed
**Files modified:** `README.md`, `README.es.md`
**Commit:** 4ef28fa
**Applied fix:** The `{requires builtin mcp}` row of the marker table now says that the plugin needs Pi's built-in MCP. Its remedy says to remove pi-mcp-adapter if it is loaded, then turn on Pi's built-in MCP, and it links [Choosing an implementation](docs/mcp-compatibility.md#choosing-an-implementation). That section gives both steps, including removing the `-builtin:mcp` entry. This holds under both implementations: `activeMcpImplementation` (`platform/pi-api.ts:340-352`) picks the adapter whenever it is loaded. Both READMEs changed in the same commit. Each still has 541 lines, 22 headings, and 30 table rows. The fixed phrases that the 06-06 and 06-12 checks grep are unchanged. CHANGELOG.md and docs/mcp-compatibility.md do not give a remedy for this marker, so they needed no change.

### WR-02: List and completion parity is duplicated by hand, and the module header cites a parity test that does not exist

**Outcome:** fixed
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts`, `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts`, `test/orchestrators/plugin/list-installed-row.test.ts`, `test/orchestrators/edge-deps.test.ts`, `test/architecture/gate-targets.ts`, `test/architecture/manifest-lookup-drift.test.ts`
**Commit:** 970f5e2
**Applied fix:** A new export, `classifyInstalledForImplementation` in `list-installed-row.ts`, now owns the whole installed-row classification. It returns `disabled` for a recorded-but-disabled record before any MCP verdict read or candidate probe. For any other record, it runs `readRecordMcpVerdict`, `upgradeCandidate`, `candidateFor`, and `classifyInstalledRecord`. Both `composeInstalledListRow` and the completion resolver's `classifyInstalledPluginRow` call it, so neither has a copy of the steps. Completion now finds the manifest entry with `lookupDeclaredPlugin`, as `list` does. It maps `disabled` to `installed`, because completion has no `disabled` token. The helper lives in `orchestrators/plugin/`, which `edge-deps.ts` already imported from (it imported `upgradeCandidate`), so no new zone edge was added. `upgradeCandidate` is no longer exported, because nothing outside the module uses it. The classifier header no longer cites a parity test. It now names the shared composition, so the redundant cross-module test was not written. The D-99-02a manifest-lookup gate listed `edge-deps.ts` as an allowed raw-lookup site. That entry went stale and failed the commit hook's first run, so it was removed from `MANIFEST_LOOKUP_TARGETS` and from the gate's order list and allowlist. This also fixes IN-03.

**TDD:** The new edge-deps case "classifies a disabled legacy record as installed with 0 verdict read(s)" failed on the old code with one `[mcp] recorded MCP servers unreadable: ... not-in-manifest` debug line, where none was expected. Its enabled twin passed on both trees, which shows that the debug capture works. A new list-installed-row case checks the disabled short-circuit of the helper. When the short-circuit was moved after the verdict read as a mutation check, that case failed. It passed again once the code was restored.

### WR-03: The completion cache compares a stamp in one shared file, but D-P6-22 says the file is keyed by the implementation

**Outcome:** fixed (records and comments only, no behavior change)
**Files modified:** `.planning/phases/06-release-docs-and-combined-tree/06-CONTEXT.md`, `extensions/pi-claude-marketplace/shared/completion-cache.ts`, `.planning/codebase/ARCHITECTURE.md`, `.planning/phases/06-release-docs-and-combined-tree/06-03-SUMMARY.md`
**Commit:** 4dc6a36
**Applied fix:** The cache design is unchanged. The six cache-drop sites still unlink one path (P6-PLN-03). D-P6-22 in 06-CONTEXT.md gains the amendment line "Amended in execution: one cache file per scope and marketplace, stamped with the implementation; a read under another implementation rebuilds it (P6-PLN-03)". The schema comment in `completion-cache.ts` now says that the stamp is a field, not part of the key or the file name. It also names the cost: Pi processes that read a shared file under different implementations rebuild and rewrite it in turn on each lookup. An example is two projects that differ on `builtin:mcp` and complete from one user-scope marketplace. `pluginIndexKey` notes that its key names no implementation. The codebase map line in ARCHITECTURE.md and the one-line summary of 06-03-SUMMARY.md now say "stamped" where they said "keyed". The parent line quoted in 06-PARENT-LINES.md and the historical commit title in the 06-03 task list were left as written.

## Verification

All checks ran in the main checkout (`/home/user/pi-claude-marketplace`, branch `features/mcp-builtin`).

- Each commit passed the pre-commit fixers. The commit hook ran `npm run check:commit` for each commit that staged a build input (WR-02 and WR-03). The first WR-02 attempt failed in `test/architecture/manifest-lookup-drift.test.ts` (the stale `edge-deps.ts` exemption). The gate files were fixed and staged, and the second attempt passed.
- WR-01: the 06-12 MDOC-02 node check exited 0, and the four 06-06 phrase greps exited 0.
- `npm run check:static`: passed before the WR-02 and WR-03 commits (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- `npm run test:unpaired`: exit 0 after the gate update.
- Owner and consumer tests on the WR-02 tree: `edge-deps.test.ts` 39 of 39, `list-installed-row.test.ts` 32 of 32, `plugin-state-classifier.test.ts` 20 of 20, `list-flow.test.ts` 111 of 111, `test/edge/register.test.ts` 332 of 332, and `test/edge/completions/data.test.ts` 71 of 71.
- `test/shared/completion-cache.test.ts`: 47 of 47 on the WR-03 tree.
- `npm run test:coverage:direct` reached 100% for `edge-deps.ts`, `list-installed-row.ts`, and `plugin-state-classifier.ts` (WR-02), and for `completion-cache.ts` (WR-03). Each run exited 0.
- Cucumber: `--profile builtin --name "Partial update completion" features/mcp-server/verdict-list.feature` ran 1 scenario and passed. No whole profile and no `npm run check` was run. The orchestrator re-runs the full gate.

---

_Fixed: 2026-11-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
