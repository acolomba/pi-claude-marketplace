# 261011-bsm merge log

Merge of `origin/main` into `features/json`. The merge stays uncommitted (MERGE_HEAD set) until Task 3.

## SHAs and environment

| Item | Value |
| --- | --- |
| PRE (features/json HEAD before merge) | `699daee819be91cac53a76b07a8beab863bf1b83` |
| MAIN (origin/main) | `94160614b64398734ff0536efafa2747ab7525f8` |
| BASE (merge base) | `000be227d8bb606ba9c7958eb263e527d0d5b77c` |
| Node | `v26.11.1` |
| Merge command | `git merge --no-commit --no-ff origin/main` (exit 1, conflicts expected) |
| Install | `npm ci --ignore-scripts` exit 0; `npm ls`: pi-coding-agent 1.0.0, strip-json-comments 5.0.3, fallow 3.31.0 |

## Live conflict list

`git diff --name-only --diff-filter=U`, sorted: 115 paths, the same count as the plan. Every path is in the plan's `files_modified` snapshot; no path appeared or vanished.

```text
CHANGELOG.md
docs/output-catalog.md
extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
extensions/pi-claude-marketplace/edge/register.ts
extensions/pi-claude-marketplace/index.ts
extensions/pi-claude-marketplace/orchestrators/import/execute.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
extensions/pi-claude-marketplace/orchestrators/types.ts
extensions/pi-claude-marketplace/platform/pi-api.ts
extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
extensions/pi-claude-marketplace/shared/notification-dispatch.ts
extensions/pi-claude-marketplace/shared/notification-grammar.ts
extensions/pi-claude-marketplace/shared/notification-types.ts
extensions/pi-claude-marketplace/shared/notify-context.ts
.planning/BACKLOG.md
.planning/MILESTONES.md
.planning/PROJECT.md
.planning/research/ARCHITECTURE.md
.planning/research/FEATURES.md
.planning/research/PITFALLS.md
.planning/research/STACK.md
.planning/research/SUMMARY.md
.planning/RETROSPECTIVE.md
.planning/ROADMAP.md
.planning/state.json
.planning/STATE.md
.planning/WINDOWS.md
tests/architecture/catalog-uat/mock-pi.ts
tests/architecture/cross-op-convergence.test.ts
tests/architecture/hooks-cap-notify.test.ts
tests/architecture/manifest-read-agreement.test.ts
tests/architecture/notify-grammar-invariant.test.ts
tests/architecture/notify-producer-wire-coverage.test.ts
tests/architecture/notify-will-reload-agreement.test.ts
tests/architecture/workflows-marker-coverage.test.ts
tests/edge/handlers/marketplace/add.test.ts
tests/edge/handlers/marketplace/autoupdate.test.ts
tests/edge/handlers/marketplace/info.test.ts
tests/edge/handlers/marketplace/list.test.ts
tests/edge/handlers/marketplace/remove.test.ts
tests/edge/handlers/marketplace/update.test.ts
tests/edge/handlers/plugin/bootstrap.test.ts
tests/edge/handlers/plugin/browse.test.ts
tests/edge/handlers/plugin/enable-disable.test.ts
tests/edge/handlers/plugin/fetch.test.ts
tests/edge/handlers/plugin/import.test.ts
tests/edge/handlers/plugin/info.test.ts
tests/edge/handlers/plugin/install.test.ts
tests/edge/handlers/plugin/list.test.ts
tests/edge/handlers/plugin/pending.test.ts
tests/edge/handlers/plugin/prune.test.ts
tests/edge/handlers/plugin/reinstall.test.ts
tests/edge/handlers/plugin/uninstall.test.ts
tests/edge/handlers/plugin/update.test.ts
tests/edge/handlers/tools.test.ts
tests/edge/notification-boundary.ts
tests/edge/register.test.ts
tests/index.test.ts
tests/integration/marketplace-add-seed-mirrors.test.ts
tests/integration/provenance-invisibility.test.ts
tests/integration/skill-path-resolution.test.ts
tests/orchestrators/import/execute.test.ts
tests/orchestrators/marketplace/add.test.ts
tests/orchestrators/marketplace/autoupdate.test.ts
tests/orchestrators/marketplace/info.test.ts
tests/orchestrators/marketplace/list.test.ts
tests/orchestrators/marketplace/remove.test.ts
tests/orchestrators/marketplace/shared.test.ts
tests/orchestrators/marketplace/update.test.ts
tests/orchestrators/plugin/bootstrap.test.ts
tests/orchestrators/plugin/enable-disable.messaging.test.ts
tests/orchestrators/plugin/enable-disable.test.ts
tests/orchestrators/plugin/fetch.test.ts
tests/orchestrators/plugin/info.test.ts
tests/orchestrators/plugin/install-cascade.messaging.test.ts
tests/orchestrators/plugin/install-flow.test.ts
tests/orchestrators/plugin/list-flow.test.ts
tests/orchestrators/plugin/operations.test.ts
tests/orchestrators/plugin/prune.test.ts
tests/orchestrators/plugin/reinstall-flow.test.ts
tests/orchestrators/plugin/reinstall.messaging.test.ts
tests/orchestrators/plugin/shared.test.ts
tests/orchestrators/plugin/uninstall.test.ts
tests/orchestrators/plugin/update-cascade.test.ts
tests/orchestrators/plugin/update-flow.test.ts
tests/orchestrators/reconcile/apply.test.ts
tests/orchestrators/reconcile/pending.test.ts
tests/platform/pi-api.test.ts
tests/shared/notification-dispatch.test.ts
tests/shared/notification-grammar.test.ts
tests/shared/notification-summary.test.ts
tests/shared/notify-context.test.ts
```

## Partitions and status

| Partition | Status |
| --- | --- |
| Task 1 notification core | done; verify chain exit 0 (see Task 1 verification) |

## Task 1: notification core

### Files resolved or edited

Conflicted, resolved per hunk (R1), no conflict marker left (the paths stay `U` in the index because nothing is staged; Task 3 stages them):

- `extensions/pi-claude-marketplace/platform/pi-api.ts`: header combines both sides (`getCommands()`, `openNotificationRun`, `requires pi-mcp-adapter`). The branch's `ExtensionMode` and `NotificationContext.mode` and main's `PiInventory` / `CommandInventoryItem` / `PiEventSource` / ADET-02 probe all stand.
- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`: main's companion constants and `companionRequirements`; the branch's resolve-step wording.
- `extensions/pi-claude-marketplace/shared/notification-types.ts`: one comment hunk; main's reason rename, `unsupported mcp`, `McpServerStatus`, `McpServerSummaryEntry`, `requires` merged cleanly.
- `extensions/pi-claude-marketplace/shared/notify-context.ts`: every hunk takes the branch side (R4). The result equals PRE byte for byte; main's changes there were the inventory rename and render-map typing only.
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts`: hunks 1 (adds `McpServerSummaryEntry` import), 2 and 6 combined; 3 to 5 take the branch side (main only reworded comments in code the branch deleted). Main's info `requires:` / MCP server rendering merged cleanly onto the branch renderer.
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`: all nine hunks take the branch side (equals PRE), then the two new builders are added (see design decisions).
- `docs/output-catalog.md`: two hunks combine main's `requires pi-mcp-adapter` wording with the branch's resolve-step phrasing; fenced blocks untouched.
- Tests: `tests/platform/pi-api.test.ts`, `tests/architecture/catalog-uat/mock-pi.ts`, `tests/shared/{notification-dispatch,notification-grammar,notification-summary,notify-context}.test.ts`. `notification-summary.test.ts` and `notify-context.test.ts` equal PRE (main changed only Pi inventory fakes the run model removes).
- Shared test support resolved here because `mock-pi.ts` imports it: `tests/edge/notification-boundary.ts` keeps the branch boundary (no Pi mock) plus main's `expectSoftDepProbes(pi, probes, tools, commands)` (3 `getAllTools` + 1 `getCommands` per snapshot) for the strict root and catalog mocks.

Cleanly merged files edited for the port:

- `extensions/pi-claude-marketplace/shared/notification-run.ts`, `edge/command-run.ts`: `ToolInventory` -> `PiInventory` (R5).
- `extensions/pi-claude-marketplace/shared/{notification-resolve,notification-json,notification-wire}.ts`, new `shared/notification-mcp.ts`.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`: `notifyMcpMigration(opts.ctx, opts.run, ...)` and `notifyMcpConfigNotices(opts.ctx, opts.run, ...)`; type import moved to `notification-types.ts`.
- R10 importers moved to `notification-types.ts`: `bridges/mcp/{stage,unstage,legacy,types}.ts`, `orchestrators/reconcile/mcp-migration.ts`, `shared/errors-bridges.ts`.
- `schema/claude-plugin.schema.json` regenerated (`npm run schema:generate`, exit 0).
- `docs/json-output.md`: kind count nineteen -> twenty-one; sections `kind:mcp-config-notices`, `kind:mcp-migration`, `mcp-server`, `companion-requirement`, `mcp-config-notice`, `mcp-migration-row`; `requires` on the plugin info row; Components `mcp` type; R9 and new closed sets in Closed-set tokens. Pi version claims untouched (Task 3). Formatted with the pre-commit mdformat 1.0.0 env.
- Tests: `tests/shared/{notification-resolve,notification-json,notification-wire,notification-run}.test.ts`, new `tests/shared/notification-mcp.test.ts`, `tests/architecture/{mcp-config-notices,mcp-migration-notice,wire-schema}.test.ts`, `tests/architecture/catalog-uat/catalog-wire.test.ts`.

### Design decisions (R6-R8)

- D1 (R10, module placement): main's `McpConfigNotice` family (7 interfaces plus the union), the 11 `McpMigration*Row` interfaces, `McpMigrationRemovalCause`, `McpMigrationRow`, and `McpMigrationReport` move verbatim into `shared/notification-types.ts`. Added there: `McpMigrationLeftRow` (was module-private in main's dispatch; resolve and the text module both need it), `RenderedMcpConfigNotice = Exclude<McpConfigNotice, McpOverrideRestoredNotice>`, `McpConfigNoticeSection = RenderedMcpConfigNotice["kind"]`, and the two surfaces. Dispatch re-exports nothing.
- D2 (R6, raw surface shape): `McpConfigNoticesSurface { kind: "mcp-config-notices"; section: McpConfigNoticeSection; notices: readonly RenderedMcpConfigNotice[] }` joins `RawSurface` and no fixed-origin group (commands and the load pass both emit it). One surface is one non-empty section. `section` is internal only: the wire payload carries `notices` (minItems 1), because every notice of a section has the section's kind.
- D3 (R6, where the fold and dedup live): `notification-resolve.ts` exports `mcpConfigNoticeSurfaces(notices)`. It applies main's override-restored fold over the whole list (Map first-set order, later keep replaces, restore deletes), groups by kind in main's section order, and drops empty sections, so `override-restored` never reaches a surface. The `resolveRawSurface` arm then redacts every free-text field and removes duplicates keyed on the rendered line (`mcpConfigNoticeLine`), which is main's `new Set(lines)` semantics, so text and JSON agree. `notifyMcpConfigNotices(ctx, run, notices)` is `for (surface of mcpConfigNoticeSurfaces(notices)) emitPresentation(ctx, run, resolveRawSurface(surface))`. Severity `warning` comes from `RAW_SURFACE_SEVERITY`; `needsReload` false.
- D4 (R7, migration surface and severity site): `McpMigrationSurface { kind: "mcp-migration"; rows; notices }` joins `LoadSurface` (D-14) and is emitted through `emitLoadSurface`. `notifyMcpMigration(ctx, run, report)` keeps main's flow: no rows -> `notifyMcpConfigNotices(ctx, run, report.notices)`. `RAW_SURFACE_SEVERITY` is now `satisfies Record<Exclude<RawSurface["kind"], "mcp-migration">, Severity>`; the one severity decision for the migration is `resolveMcpMigration` in resolve, carried as `ResolvedMcpMigration.severity: "info" | "warning"` with `needsReload` (true exactly when a moved or removed row exists). Resolved `rows` = moved, removed, left, each sorted with main's comparators after redaction; resolved `notices` = the D3 sections flattened in section order. Both the grammar arm and the JSON arm read these resolved values.
- D5 (R6/R7, text module): new pure `shared/notification-mcp.ts` (imports only types) holds `printable`, the code-unit escapes, every notice line, the section summaries, the moved/removed/left row lines, `removalReason`, the migration summaries, and the cost line. Exports: `mcpConfigNoticeLine`, `composeMcpConfigNoticesText(section, notices)`, `composeMcpMigrationText(rows, notices)` (text without the reload hint), and the row guards `isMovedRow` / `isRemovedRow` / `isLeftRow` (shared with resolve so fallow dupes stays clean). `formatRawSurface` appends `\n` + `RELOAD_HINT_TRAILER` when the resolved migration needs a reload, which reproduces main's bytes (the hint was main's last line).
- D6 (R8, wire): notice union = 6 objects (the two file kinds share one object with an enrolled `kind` enum; the 5 subject kinds each a literal with `scope`, `file: "mcp-adapter.json"`, `plugin`, `server`, plus `fields` or `names`). Row union = 7 objects (moved; removed with optional `feature`; stopped; the 5 owner kinds sharing one object with an enrolled `kind` enum; collision; file-unreadable; unfinished). Enrollment maps (`Record<ClosedSet, true>`): `MCP_SERVER_STATUSES`, `COMPANIONS`, `MCP_CONFIG_FILE_NOTICE_KINDS`, `MCP_CONFIG_FILES` (one set serves both file notices and file-unreadable rows), `MCP_MIGRATION_OWNER_ROW_KINDS`, `MCP_MIGRATION_REMOVAL_CAUSES`, `MCP_MIGRATION_UNFINISHED_FILES`. Plugin info: `components.mcp` = `MCP_SERVER[]` (`name` required; `unsupportedFeature`, `unsetVariables`, `withheldVariables`, `status` optional); resolved row gains optional `requires: { companion, missing }[]`. Payload members `MCP_CONFIG_NOTICES_PAYLOAD`, `MCP_MIGRATION_PAYLOAD` sit after `plugin-path-skipped`, `internal-error` last (21 members).
- D7 (R9): wire REASONS renames `requires pi-mcp` -> `requires pi-mcp-adapter` in place and appends `unsupported mcp` last; the docs token list matches.
- D8 (complexity vs D-16): the grown `isCommandOutcome` switch hit fallow cyclomatic 22. A typed lookup table in the dispatch module trips the D-16 presentation-sink literal clause (its quoted keys are module literals), so the classification is split into two exhaustive switches instead: `isStructuredOutcome` (presentations with an envelope) and `isRawOutcome` (raw surfaces and the command error). Both MCP kinds are non-outcomes. Nothing is suppressed; fallow health reports no finding on the parsable tree.
- D9 (redaction, PMOD-04): `redactCredentials` runs on plugin, server, marketplace, from, to, servers, feature, detail, key, source, fields, and names; scope, file, kind, and cause are closed sets and pass through. Text then escapes with `printable`; JSON carries the redacted raw strings.

### Test title moves and retirements (Task 1)

From main's `tests/shared/notification-dispatch.test.ts` MCP block (about 55 declarations). Kept in `tests/shared/notification-dispatch.test.ts` (entry points, ported to `(ctx, run, ...)`), titles unchanged:

- `AFILE-04: an empty MCP config notice list sends nothing`
- `AFILE-04: notices of every kind send one warning per kind in section order`
- `AMIG-03: a report with no row and no notice sends nothing`
- `AMIG-03: a report with notices but no row sends each notice section as its own warning`

Moved to `tests/shared/notification-mcp.test.ts` (bytes; inputs given in resolved order, expected text without the reload line, which `formatRawSurface` owns):

- `AFILE-04: one comments-dropped notice sends its exact warning bytes` -> `AFILE-04: one comments-dropped notice renders its exact bytes`
- `AFILE-04: comments-dropped notices for two scopes share one warning with a line each` -> `... share one section with a line each`
- `AFILE-06: one override-kept notice sends its exact warning bytes` -> `AFILE-06: one override-kept notice renders its exact bytes`
- `AFILE-06: control, line-separator and bidi characters in an override-kept field name render as \u escapes` (unchanged)
- `AVAR-04: variables-missing notices for two servers send MCP server variables not set. with a line each` -> `... render MCP server variables not set. with a line each`
- `AVAR-05: credentials-blanked notices for two servers send MCP server credentials withheld. with a line each` -> `... render MCP server credentials withheld. with a line each`
- `AMIG-01: control characters in a leftover's old name render as \u escapes` (unchanged)
- `AMIG-01: line separators and format characters in a leftover's old name render as \u escapes` (unchanged)
- `AMIG-03: line separators and format characters in a leftover's plugin name render as \u escapes` (unchanged)
- `AMIG-03: line separators and format characters in plugin and server names render as \u escapes in the other MCP config notices` (unchanged)
- `AMIG-03: control characters in names and details render as \u escapes` (unchanged)
- `AMIG-03: line separators and format characters in a file-derived name render as \u escapes` (unchanged)
- `AMIG-01 / AMIG-04: each left-in-place kind renders its remedy, project first, with no cost line and no reload hint` -> `AMIG-01 / AMIG-04: each left-in-place kind renders its remedy, with no cost line` (sort order is resolve's, covered by the left-row sort tests; the hint is `formatRawSurface`'s)
- loop `AMIG-03: a ${kind} row beside a moved row makes the notice a warning that keeps the reload hint` -> `AMIG-03: a ${kind} row beside a moved row renders its remedy after the moved section` (severity and reload asserted in resolve by `moved and stopped rows share one warning...`)
- `D-08-05: a source-outdated row names an update and sorts by plugin beside a marketplace-unreadable row` -> `D-08-05: a source-outdated row names an update beside a marketplace-unreadable row` (plugin sort covered by the new resolve test `owner rows of every kind sort by plugin, then first old name`)
- `AMIG-04: control characters in a left-in-place row's file-derived strings render as \u escapes` (unchanged)
- `AMIG-03: removed rows render between moved and left-in-place rows, each with its reason, at warning` -> drops `, at warning`
- `AMIG-03: an unsupported removal with no feature names only the token` (unchanged)
- `AMIG-02: an unfinished move renders under the left-in-place rows at warning` -> drops ` at warning`
- `AMIG-02: an unfinished row names the project-scope mcp-adapter.json and adds one final period to the detail` (unchanged)
- `AMIG-03: control characters in removed and unfinished rows render as \u escapes` (unchanged)

Moved to `tests/shared/notification-resolve.test.ts`, `describe("resolveRawSurface")` (typed resolved values):

- six `... a repeated <kind> notice renders once` tests (AFILE-04 MCP config notice / AFILE-06 override-kept / AVAR-04 variables-missing / AVAR-05 credentials-blanked / ANAME-07 tool-rules-unenforced / AMIG-01 leftover-removed) -> one loop `${requirement}: a repeated ${kind} notice resolves once` (AFILE-04's subject is now named: left-unchanged)
- `AMIG-03: moved rows sort project first, then by plugin and old name in code-unit order, at info` (unchanged)
- `AMIG-03: a stopped row with nothing moved is a warning with no cost line and no reload hint` -> `... is a warning that needs no reload`
- `AMIG-03: moved and stopped rows share one warning, stopped rows sorted by scope then detail` (unchanged)
- `AMIG-03: config notices render as their distinct lines after the cost line, in section order, at warning` -> `AMIG-03: config notices resolve to their distinct notices in section order, at warning` (cost-line placement covered by the new mcp test `notice lines follow the cost line, ...`)
- `AMIG-03: a tool-rules-unenforced notice renders its line after the credentials-withheld line, at warning` -> `... resolves after the credentials-withheld notice, at warning`
- loop `AMIG-03: a ${kind} notice alone sends an all-moved report at ${severity}` -> `... alone resolves an all-moved report at ${severity}`
- `AMIG-03: a leftover-removed notice makes an all-moved report a warning, its line last` -> `..., its notice last`
- `AMIG-03: left-in-place rows sort with the stopped rows by scope, then plugin, then first old name` (unchanged)
- `AMIG-03: not-declared and disabled removals alone stay info, with no cost line but the reload hint` -> `... stay info and need a reload`
- `AMIG-03: a move with a not-declared removal stays info` (unchanged)
- loop `AMIG-03: a removal for ${cause} alone is a warning with the reload hint` -> `... is a warning that needs a reload`

Moved to `tests/shared/notification-resolve.test.ts`, `describe("mcpConfigNoticeSurfaces")`:

- `AFILE-04: mixed MCP config notices send comments-dropped first, then left-unchanged` -> `... group comments-dropped first, then left-unchanged`
- `AFILE-06: override-kept notices for two servers share one warning with a line each, in list order` -> `... share one section, in list order`
- `AFILE-06: a later override-kept notice for a server replaces the earlier one in its first position` (unchanged)
- `AFILE-06: mixed MCP config notices send comments-dropped, then left-unchanged, then override-kept` -> `... group ...`
- `AFILE-06: an override-restored notice alone sends nothing` -> `... yields no section`
- `AFILE-06: an override-restored notice cancels an earlier override-kept notice for the same server` (unchanged)
- `AFILE-06: an override-kept notice after an override-restored notice for the same server stands` (unchanged)
- `AFILE-06: a restore for another server, scope or file leaves the override-kept line standing` -> `... leaves the override-kept notice standing`
- `AFILE-06: comments-dropped notices still render beside a cancelled override` -> `... still form a section beside a cancelled override`
- `AVAR-04: a variables-missing notice listed first still sends after the override-kept warning` -> `... still groups after the override-kept section`
- `AVAR-05: a credentials-blanked notice listed first still sends after the variables-missing warning` -> `... still groups after the variables-missing section`
- `ANAME-07: tool-rules-unenforced notices send MCP server tool rules not enforced. after the credentials-withheld warning, with a line each` -> `ANAME-07: tool-rules-unenforced notices group after the credentials-withheld section, with a notice each`
- `AMIG-01: leftover-removed notices send Old MCP server settings removed. after the tool-rules warning, with a line each` -> `AMIG-01: leftover-removed notices group after the tool-rules section, with a notice each`

Other renames:

- `tests/shared/notification-grammar.test.ts`: `ADET-01: formats the requires entries as stamped, whatever the probe it is handed reports` -> `ADET-01: formats the requires entries as stamped` (the branch renderer takes no probe). main's info rendering tests now call `renderPluginInfo(message)`.
- `tests/shared/notification-run.test.ts`: `D-05: opening a run reads the tool inventory exactly three times` -> `D-05: opening a run reads the tools three times and the commands once` (ADET-02: the probe reads `getCommands()` once and a bare `mcp` tool no longer reports the adapter).
- `tests/architecture/wire-schema.test.ts`: `the committed schema has exactly 19 payload members` -> `... 21 ...`.
- `tests/architecture/catalog-uat/catalog-wire.test.ts`: `WIRE-02: the retained inventory and separate command error cover all 19 kinds` -> `... 21 kinds`; presented count 268 -> 280, catalog tuple count 260 -> 270 (main's new catalog examples plus two raw samples).

New tests (no source title): mcp `a notice renders its one line without a summary`, `one left-unchanged notice renders its exact bytes`, `notice lines follow the cost line, one per notice, in the given order`; resolve `PMOD-04 redacts a credential in each name a config notice carries`, `owner rows of every kind sort by plugin, then first old name`, `removed rows sort project first, then by plugin and old name`, `PMOD-04 redacts a credential in each name and detail a migration row or notice carries`; dispatch json/rpc entry tests for both kinds, `a report with rows sends one notice with the reload hint at its severity`, `PMOD-04: a credential in a server name and a migration detail is redacted in text and JSON`, two `classifies mcp-* as command outcome false` rows; grammar `formatRawSurface` rows for both kinds and `ends a migration notice that needs no reload without the hint, at its resolved severity`; json `converts every MCP config notice kind field by field`, `converts a migration surface with its resolved severity and reload, every row kind field by field`, two `RAW_CASES` rows, plugin info MCP server objects and `requires`; wire schema accept/reject cases for both kinds and MCP server status; architecture locks gain one json-mode schema-valid entry test per catalog notice and report. Retired: none.

### Task 1 verification

- `node --test` over the seven architecture files in the verify block: 231 pass, 0 fail.
- `node scripts/test-coverage-direct.mjs` over the ten core sources: exit 0 (100% each).
- Owner suites `tests/shared/notification-*.test.ts`, `notify-context`, `concerns/soft-dep`, `platform/pi-api`: 1529 pass, 0 fail.
- ESLint `--max-warnings 0` on the core sources and Task 1 tests: exit 0. Prettier check: clean. fallow health: no finding; fallow dupes: no clone group touching a Task 1 file.
- Typecheck: a scratch copy of the tree with every other conflict auto-resolved to the branch side typechecks every Task 1 source and test clean. Its only errors in a Task 1 path are `orchestrators/reconcile/apply.ts` lines 777 and 797, which come from the branch-side `InstallPluginOutcome` arms lacking main's `mcpConfigNotices` (P-A's port fixes them).
- The verify clause `test -z "$(git diff --name-only --diff-filter=U -- ...)"` cannot pass without staging, which this run must not do: the 13 Task 1 paths stay `U` in the index with zero conflict markers in the worktree.

### Cross-partition needs found in Task 1

- P-A / P-B (R10): these still `import type { McpConfigNotice }` (and `McpMigrationRow`) from `shared/notification-dispatch.ts` and must point at `notification-types.ts`: conflicted `orchestrators/types.ts`, `import/execute.ts`, `marketplace/{remove,shared}.ts`, `plugin/{enable-disable,install-flow,install-outcome,reinstall-flow,uninstall,update-swap}.ts`, `reconcile/types.ts`; cleanly merged `plugin/{install-cascade,install-disable-cascade,reinstall-replace}.ts`, `reconcile/apply-outcomes.ts`.
- P-A / P-B: `notifyMcpConfigNotices` is now `(ctx, run, notices)` at the 14 remaining call sites. `ToolInventory` no longer exists; option bags take `run`.
- P-A: `orchestrators/plugin/info.ts` stamps `requires` from `companionRequirements(..., opts.run.softDeps)`; keep main's `mcpConfigNotices` on the install outcome arms (see the apply.ts typecheck note).
- Wave B: `tests/orchestrators/marketplace/shared.test.ts` imports `McpConfigNotice` from the dispatch module. Tests that assert `requires pi-mcp` need `requires pi-mcp-adapter`. Strict Pi mocks in `tests/edge/register.test.ts` and `tests/index.test.ts` can use `expectSoftDepProbes` from the resolved `tests/edge/notification-boundary.ts`. These test files still name `ToolInventory`: `tests/architecture/{cross-op-convergence,manifest-read-agreement}.test.ts`, `tests/orchestrators/auth-host.test.ts`, `tests/orchestrators/marketplace/update.test.ts`, `tests/orchestrators/plugin/{enable-disable,install-cascade.messaging,install-flow,operations,reinstall-flow,update-flow}.test.ts`.

<!-- merge-log-continue -->

## P-B: marketplace, import, reconcile, edge, bridges, orchestrators root, index.ts (Wave A)

Files finished (per hunk, R1; no conflict marker left; nothing staged):

- `edge/handlers/plugin/info.ts` (R3): `makePluginInfoHandler(mcpStatus: McpStatusReader): SubcommandHandler`; the handler forwards the router's `run` plus main's `mcpStatus` to `getPluginInfo`. Doc comment merges the branch's D-05 run wording with main's ASTAT-01 tracker sentence.
- `edge/register.ts` (R3): branch factory list (no `pi`) with `makePluginInfoHandler(deps.mcpStatus)`. main's doc comment on `deps.mcpStatus` merged cleanly.
- `index.ts` (R2): branch's run-opening imports plus main's `applyMcpAdapterEnv`; main's `applyMcpAdapterEnvFrom`, `createMcpStatusTracker(pi.events)`, and `mcpStatus` in `EdgeDeps` merged cleanly beside the branch's `openNotificationRun(pi, { kind: "load" })`. `pi` stays for non-notification uses only.
- `orchestrators/import/execute.ts` (R2, R6, R10): `notifyMcpConfigNotices(opts.ctx, opts.run, mcpConfigNotices)` after the branch's `notifyWithContext(..., opts.run, ...)` / `surfaceImportDiagnostics(..., opts.run, ...)`; `McpConfigNotice` type from `notification-types.ts`.
- `orchestrators/marketplace/{add,autoupdate,list}.ts`: option bags keep `run: NotificationRun` (branch); main's `ownValue` / `setOwn` hunks kept (list.ts conflict combined: branch `entries.push({ scope, record, block })` shape with main's `ownValue(merged.marketplaces, record.name)`).
- `orchestrators/marketplace/remove.ts` (R2, R6, R10): 3 notice sites take `run`. `rethrowWithMcpConfigNotices(err, opts, orchestrated, notices)` now takes `opts: Pick<RemoveMarketplaceOptions, "ctx" | "run">` instead of main's bare `ctx`, so the standalone pre-throw notice reads the command run.
- `orchestrators/marketplace/shared.ts`, `orchestrators/marketplace/update.ts` (R2, R6, R10): `run` option fields kept; update's cascade notice call is `notifyMcpConfigNotices(ctx, run, ...)`.
- `orchestrators/reconcile/{pending,types}.ts`: `run` fields kept; `McpConfigNotice` / `McpMigrationRow` from `notification-types.ts`.
- `orchestrators/types.ts`: branch's `run` doc comment with main's `{requires pi-mcp-adapter}` token (R9); `McpConfigNotice` import re-pointed (R10).
- Cleanly merged, edited for R10: `orchestrators/reconcile/apply-outcomes.ts` (`McpConfigNotice` from `notification-types.ts`).

No `ToolInventory`, `softDepStatus(`, or `opts.pi` is left under P-B's paths; the only `PiInventory` is `edge/command-run.ts` (Task 1).

Verification (P-B):

- `npm run typecheck` exit 2: every error is under `orchestrators/plugin/**` (P-A in progress; conflict markers there make tsc report syntax errors only).
- Semantic check: scratch copy of `extensions/` with a tsconfig over `extensions/**/*.ts`, the P-A conflicts resolved to the branch side, and P-A's half-edited `install-flow.ts` replaced by PRE's: `npx tsc --noEmit` exit 2 with 20 errors, none in a P-B file. The two in `reconcile/apply.ts` (777, 797) come from PRE's `InstallPluginOutcome` arms in install-flow, which P-A's port fixes (same as Task 1's note).
- `npx prettier --check` on the 14 P-B files: exit 0. `npx eslint --max-warnings 0` on them: exit 0 (live tree, while P-A files still held markers; re-run in the post-Wave-A typecheck).
- No owned tests (Wave B ports them); no test title renamed, moved, or dropped by P-B.

Owner tests expected to need Wave B changes: `tests/edge/handlers/plugin/info.test.ts` (factory takes an `McpStatusReader`, no `pi`), `tests/edge/register.test.ts` (`deps.mcpStatus`; `expectSoftDepProbes` reads), `tests/index.test.ts` (`pi.events` for `createMcpStatusTracker`, `applyMcpAdapterEnv` env effects, `getCommands` reads), `tests/orchestrators/import/execute.test.ts` (config notices through `run`; returned result omits `mcpConfigNotices`), `tests/orchestrators/marketplace/{remove,update,shared,add,autoupdate,list}.test.ts` (`run` option, `notifyMcpConfigNotices(ctx, run, ...)`, `MarketplaceRemoveFailureError`, `McpConfigNotice` from `notification-types.ts`), `tests/orchestrators/reconcile/{pending,apply,types}.test.ts`.

Cross-partition needs: none on P-A or D-PLAN beyond the apply.ts outcome arms already noted. Direct coverage for `marketplace/remove.ts` (`rethrowWithMcpConfigNotices` both arms) and `import/execute.ts` depends on Wave B porting main's tests for them.

## Wave A: D-PLAN (planning records and CHANGELOG)

Status: done. No conflict marker is left in `.planning/**` or `CHANGELOG.md`; the paths stay `U` in the index because nothing is staged.

### Files finished

- `.planning/state.json`: the branch's content (json-output, 9/9 phases). main's side (mcp-4, 8/8 phases) is superseded by `.planning/milestones/mcp-4-ROADMAP.md`.
- `.planning/research/{ARCHITECTURE,FEATURES,PITFALLS,STACK,SUMMARY}.md`: root files are `git show 94160614:<path>` (R1 exception). PRE's five versions (`git show 699daee8:<path>`) are new files under `.planning/milestones/json-output-research/`.
- `.planning/WINDOWS.md`: built with `parseLedger` / `renderLedger` (`.claude/gsd-core/bin/lib/broken-windows.cjs`), never hand-edited. Entries 1-87 from PRE (main's 1-87 equal BASE), 88-90 from MAIN, PRE's 88 and 89 renumbered to 91 and 92. Counts open 0, waived 51, fixed 41, total 92; `last_updated` 2026-10-10T20:21:09.962Z (PRE's, the later side). `gsd-tools windows status --raw` exit 0.
- `.planning/STATE.md`: every hunk takes the branch side (the all-branch resolution equals PRE byte for byte), then: `### mcp-4 closeout` under Current Position (completed 2026-10-10, PR #250, 0.20.0, ROOTKEY-01 and the moved-aside user state record carried); a main-merge paragraph in Session Continuity that records the WINDOWS renumbering once; `### mcp-4 decisions` at the end of Decisions with main's 120 added decision bullets verbatim (main's base-era decisions were already dropped by the branch and stay dropped); Operator Next Steps now say main (#248, #250) is merged and PR #251 (open) is next. Deferred Items: main added no row, so the table is the branch's; the json-output row now reads `WINDOWS #92 (was #89 before the main merge)`. main's mcp-4 metrics rows, session log, pending todos and quick-task row are not carried; the closeout section points at the mcp-4 archive.
- `.planning/MILESTONES.md`, `.planning/RETROSPECTIVE.md`, `.planning/BACKLOG.md`: both entries, json-output first. The mcp-4 headers and release-state lines now read merged to main via PR #250 and released in 0.20.0 (tag `v0.20.0` exists at `94160614`). RETROSPECTIVE trend tables keep both rows in chronological order (mcp-4, then json-output).
- `.planning/ROADMAP.md`: json-output line kept; mcp-4 line added as "completed 2026-10-10, merged to main 2026-10-10 (PR #250)". Phase table and paragraph stay json-output's and point at the mcp-4 archive; ROOTKEY-01 added to Carried Forward. The file contains no "shipped".
- `.planning/PROJECT.md`: json-output's Previous Milestone section, then main's mcp-4 section (header updated to merged and 0.20.0); Current State lists json-output, then mcp-4 as merged and released; both milestones' validated requirements; Active notes both archives; the Next paragraph names PR #251; both sides' last-updated lines plus one for this merge. Key Decisions merged cleanly with both milestones' rows.
- `CHANGELOG.md`: the branch's JSON-output bullet `(#251)` under `## [Unreleased]`, then main's `## [0.20.0] - 2026-10-10` and its bullets. `git diff 94160614 -- CHANGELOG.md` shows only that bullet.

### Commands (exit status)

- `git show 94160614|699daee8:<path>` for the research files and `state.json`: 0.
- `node <scratch>/merge-windows.cjs ...` (parse, merge, render, re-parse): 0.
- `node .claude/gsd-core/bin/gsd-tools.cjs windows status --raw > <scratch>/windows-status.txt`: 0 (`ok: true`, 0/51/41/92).
- `mdformat --check CHANGELOG.md` (pre-commit's cached mdformat 1.0.0 env with frontmatter, gfm, gfm-alerts, footnote): 0.
- `markdownlint-cli2 CHANGELOG.md` (pre-commit's cached v0.20.0 env): 0 errors.
- `node .claude/gsd-core/bin/gsd-tools.cjs query state.load > <scratch>`: 0.
- Marker scan (`^<<<<<<<`, `^|||||||`, `^=======$`, `^>>>>>>>`) over `.planning/**` (quick-task directory excluded) and `CHANGELOG.md`: no match. Trailing whitespace and end-of-file checks on every edited file: clean. `.planning/` is outside mdformat and markdownlint (pre-commit excludes it).

### Notes

- Test titles: none renamed, moved, or dropped (no test file owned).
- Left as is: the STATE.md decision line `08-04: ... 85 and 89 fixed; ... total 89` is a dated json-output record of PRE's numbering; the renumbering note covers it. PROJECT.md still calls any-git-host and workflows-replay "Landed on main, unreleased"; both are in 0.20.0 now, but main did not change those lines.
- Cross-partition needs: none.


## Wave A: P-A (`orchestrators/plugin/**` production)

Status: done. No conflict marker is left in any `orchestrators/plugin/*.ts` source; the 16 conflicted paths stay `U` in the index because nothing is staged.

### Files finished

Conflicted, resolved per hunk (R1): `enable-disable.ts` (6), `info.ts` (4), `install-flow.ts` (12), `install-outcome.ts` (1), `install.messaging.ts` (1), `list-flow.ts` (2), `prune.ts` (4), `reinstall-flow.ts` (5), `reinstall.messaging.ts` (4), `shared.ts` (3), `uninstall.ts` (7), `update-cascade.ts` (2), `update-flow.ts` (7), `update-preflight.ts` (2), `update-row.ts` (1), `update-swap.ts` (4).

Cleanly merged, edited for R10: `install-cascade.ts`, `install-disable-cascade.ts`, `reinstall-replace.ts` (`McpConfigNotice` now from `shared/notification-types.ts`).

### Decisions

- R2: every `pi: ToolInventory` / `pi: PiInventory` option or argument hunk takes the branch's `run: NotificationRun`. No orchestrator under `plugin/` imports `PiInventory` or calls `softDepStatus`.
- R6: the nine plugin-side call sites are `notifyMcpConfigNotices(ctx, run, notices)`: `enable-disable.ts` (2), `install-flow.ts` (1, inside `withMcpConfigNotices`), `prune.ts` (1), `reinstall-flow.ts` (2: the single-plugin arm and `surfaceReinstallMcpConfigNotices`), `uninstall.ts` (2), `update-flow.ts` (1, inside `surfaceUpdateMcpConfigNotices`). The module-private helpers `withMcpConfigNotices`, `surfaceReinstallMcpConfigNotices`, and `surfaceUpdateMcpConfigNotices` gained a `run` parameter after `ctx`; main's call order (rows, then discovery warnings, then MCP notices) is kept.
- `install-flow.ts` hunks 7-10: main's restructured catch (one `failed` from `handleCascadeThrow` or `handleInstallThrow`, then `withMcpConfigNotices`) and main's `promoted` / `disable-cascade-failed` arms are taken, with `run` in place of `pi` (git had interleaved the branch's old argument lists into main's new `withMcpConfigNotices` calls). main's `mcpConfigNotices` stays on every install outcome arm, so `reconcile/apply.ts` lines ~777/797 typecheck.
- R5 (`info.ts`): `GetPluginInfoOptions` takes `run` and main's `mcpStatus: McpStatusReader`. The `const probe = softDepStatus(opts.pi)` line is gone; `withCompanionRequirements(block, opts.run.softDeps)` stamps `requires` through main's `companionRequirements(...)`, so info opens no second probe. main's `withServerStatus` / `readProjectInstallRecord` / `env` threading merged as is.
- R4: `install.messaging.ts` keeps the branch's `rowPolicies` (main's only content change, the ANAME-07 `malformed mcp server ` arm, merged cleanly); `reinstall.messaging.ts` takes the branch side with `pi-mcp-adapter` in its comments. main added no new function or row in either file.
- `prune.ts`: both sides kept. The branch's injected `restoreOps: PruneRestoreOps` (`createBackupRoot`) and main's `recordingCascade` (NFR-3) coexist; the type import names `PruneRestoreFailure, PruneRestoreOps, PruneRollback`.
- R9 in comments: every `{requires pi-mcp}` in the branch-side comment hunks now reads `{requires pi-mcp-adapter}`.

### Commands (exit status)

- `npx tsc --noEmit -p <scratch>/tsconfig.ext.json` (extends the repo tsconfig, `include` = `extensions/**/*.ts` only, because conflict markers in tests make the full `npm run typecheck` stop at syntax errors): 0, 304 extension files, no error anywhere under `extensions/`.
- `npx prettier --check` on the 19 files: 0.
- `npx eslint --max-warnings 0` on the 19 files: 1 (one `import-x/order` in `install-outcome.ts`), fixed, then 0.
- `node --test tests/orchestrators/plugin/{install-cascade,install-outcome,install-disable-cascade,reinstall-replace,prune-rollback,update-row,update-preflight,update-swap,info-mcp-status}.test.ts` (the clean paired tests): 1. 295 pass, 13 fail: 12 in `prune-rollback.test.ts` (main's new AFILE-01 / NFR-3 cases build `PruneRestoreOps` as `{ removeBackup: rm }` without the branch's required `createBackupRoot`; test-side fix for T-PLUGIN), and `update-swap.test.ts` as a file, because it imports the still-conflicted `update-flow.test.ts`.
- `node scripts/test-coverage-direct.mjs` on `install-outcome.ts`, `install-cascade.ts`, `install-disable-cascade.ts`, `reinstall-replace.ts`, `update-row.ts`, `update-preflight.ts`: 0.

### Test titles

None renamed, moved, or dropped (no test file owned).

### Cross-partition needs (Wave B, T-PLUGIN)

- Owner tests that must follow the run port: `tests/orchestrators/plugin/{enable-disable,enable-disable.messaging,info,install-flow,install-cascade.messaging,list-flow,operations,bootstrap,prune,reinstall-flow,reinstall.messaging,shared,update-cascade,update-flow}.test.ts` (typecheck errors or conflict markers today), plus `prune-rollback.test.ts` (add `createBackupRoot` to main's new restore-ops literals) and `update-swap.test.ts` (unblocks once `update-flow.test.ts` resolves).
- `info.test.ts`: options take `run` (with `softDeps`) and `mcpStatus`; main's ADET-01 cases that count `getAllTools` / `getCommands` reads inside `getPluginInfo` must expect zero reads there, because the `requires` stamp now comes from `run.softDeps` (R5).
- Tests that call the install, reinstall, update, uninstall, enable/disable, or prune entry points and assert MCP config notices must read them through the run's emissions (`notifyMcpConfigNotices(ctx, run, ...)`), not a notify-direct call.

## Wave B: T-EDGE-H (`tests/edge/handlers/**`)

Files finished (per hunk, R1; no conflict marker left; nothing staged): the 20 conflicted files `tests/edge/handlers/marketplace/{add,autoupdate,info,list,remove,update}.test.ts`, `tests/edge/handlers/plugin/{bootstrap,browse,enable-disable,fetch,import,info,install,list,pending,prune,reinstall,uninstall,update}.test.ts`, and `tests/edge/handlers/tools.test.ts`.

Decisions:

- 75 of 121 hunks differed on main only by the `createNotificationBoundary(emissions, probes, ...)` probe count (3 -> 1 per emission). The branch boundary has no `pi` and no probe argument (D-05, D-07), so these take the branch side. The other non-trivial hunks are main's comment rewrites of the same probe counts (`takes ONE soft-dependency probe`), `probes:` table fields in `marketplace/update.test.ts` and `plugin/install.test.ts`, and main's `expectSoftDepProbes(pi, 1)` in browse; all take the branch side for the same reason. The cleanly merged `probes: number;` line main added to the install table's `satisfies` type is removed (no row carries it on the branch).
- `plugin/info.test.ts` (R3): `makePluginInfoHandler(noStatusSnapshot())` from main's `tests/platform/mcp-status-seed.ts`, and every case still hands the router run. main's "+1 probe for the `requires:` line (ADET-01)" boundary counts are dropped, because the `requires` stamp now reads `run.softDeps` (R5).
- `plugin/browse.test.ts`: main's mock renames (`mockInstall` -> `installHandler`, and so on for uninstall, pluginInfo, enable, disable) are applied to the branch's `SubcommandHandler` mocks. main's `listHandler` is not carried over, because the branch's browse has no list fallback (json/rpc/print refuse). main's `tui` / `theme` / `keybindings` local renames merged cleanly.
- `tools.test.ts`: the boundary `ctx` is main's `ExtensionToolContext` (Pi 1.0); `ExtensionContext` import dropped; the branch's `PluginStatus` / `Reason` imports kept. The branch's `inventoryReads` parameter (3 `getAllTools` reads per run) becomes `probes` (snapshots) stated through `expectSoftDepProbes` from `tests/edge/notification-boundary.ts`, so the strict Pi mock now also expects the one `getCommands()` read per snapshot; the 15 call sites pass 1 instead of 3. The redaction cases and their expected strings are unchanged. The tool context fake carries no `mode` expectation: the tools never notify, and a stated `mode` would fail `verify` because no tool path reads it.

Test titles: the six `TUI mode action dispatch: <action> (local: ...) dispatches to <handler>` titles in `plugin/browse.test.ts` now end in main's handler names (`installHandler`, `uninstallHandler`, `pluginInfoHandler`, `enableHandler`, `disableHandler`) instead of the branch's `mock*` names, following main's rename. No other title renamed, moved, or dropped.

Commands (exit status):

- `npx tsc --noEmit -p <scratch tsconfig over extensions/** + tests/edge/handlers/**>`: 2 (install table `probes` field), then 0 after the fix.
- `node --test tests/edge/handlers/`: 0 (662 pass, 0 fail).
- `node scripts/test-coverage-direct.mjs` over the 24 `edge/handlers/**` sources: 0.
- `npx eslint --max-warnings 0` on the 25 `tests/edge/handlers/**` files: 0. `npx prettier --check` on them: 0.

Cross-partition needs: none.

## Wave B: T-ARCH (`tests/architecture/**` outside Task 1's files)

Status: done. No conflict marker is left under `tests/architecture/`; the conflicted paths stay `U` in the index because nothing is staged.

### Files finished

Conflicted, resolved per hunk (R1):

- `cross-op-convergence.test.ts` (6): branch run harness (`runWithNothingLoaded`, `run` in the invoker env, `mode: "tui"` ctx); main's `mcpStatus: noStatusSnapshot()` on the info invoker; main's per-op test split merged cleanly. `emptyPiInventory` / `PiInventory` dropped (R2).
- `manifest-read-agreement.test.ts` (7): branch `run`; main's three multi-line `getPluginInfo` calls with `run` in place of `pi` plus `mcpStatus: noStatusSnapshot()`.
- `hooks-cap-notify.test.ts` (4): main's `t.mock` recording harness and `onlyNotification`; ctx gains `mode: "tui"` (R11); calls take the branch's `(ctx, runWithNothingLoaded(), CATALOG_PLUGIN_ID, STOP_OVERRIDE_CAP)`. main's "reads only `ui.notify`" comment now says `mode` and `ui.notify`; the header says the seam is a raw hook surface, not a direct notify call (R12).
- `notify-grammar-invariant.test.ts` (10): main's per-fixture tests through `emitOnce(t, fixture)`; `emitOnce` takes the branch fixture's `run` and builds a `mode: "tui"` `NotificationContext`. main's `MockPi` / `piWithAllLoaded` / `adapterCommand` dropped (the fixtures merged with the branch's `run: runWithAllLoaded()`).
- `notify-will-reload-agreement.test.ts` (3): main's `render(t, fixture)` with `mode: "tui"` and `fixture.run`; the empty "Mock helpers" banner removed with the helpers it headed.
- `notify-producer-wire-coverage.test.ts` (2): branch side. The harness has no Pi mock (the run carries the snapshot), so main's `expectSoftDepProbes(pi, 1)` has nothing to bind to.
- `workflows-marker-coverage.test.ts` (2): branch `runWithSoftDeps` plus main's `withHermeticEnvironment` (main's three `withHermeticEnvironment("wf-marker-", ...)` call sites merged cleanly); main's tool-name helpers and `toolInfo` dropped (the branch seeds the snapshot directly). main's ctx comment now names `mode` and `ui.notify` only.

Cleanly merged, edited:

- `catalog-block.ts` (main's new helper): header says the out-of-band seams emit raw surfaces (WIRE-01), not direct notify calls (R12).

No production file was edited. `soft-dep-marker-policy.test.ts`, `closed-set-enrollment.test.ts`, `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, `cross-surface-reason-parity.test.ts`, `peer-floor.test.ts`, and the rest pass unchanged against the ported production.

### Gate scope notes

- `notify-producer-wire-coverage` states severity and reload parity between paired `CommandContext`s through `notifyWithContext`. It has no producer list or totality scan, so the port adds nothing it checks. `notifyMcpConfigNotices` / `notifyMcpMigration` take no context; their severity, reload, origin, and bytes are locked by Task 1's `mcp-config-notices`, `mcp-migration-notice`, and the `tests/shared/notification-dispatch.test.ts` `classifies ... as command outcome` and per-mode entry cases. No duplicate case added.
- `soft-dep-marker-policy` states per-status `markers` / `contentReasons` booleans per context, not marker tokens; no policy changed in the port. The `requires pi-mcp-adapter` token is locked by `closed-set-enrollment` (markers) and `notify-closed-set-locks` (REASONS), both green.

### Test titles

No title dropped by this partition. The title audit (PRE and MAIN title sets vs the merged files) shows only:

- main's own per-fixture splits replace the base titles in `cross-op-convergence` (3), `notify-grammar-invariant` (7), and `notify-will-reload-agreement` (2); each fixture now has its own test titled with the base wording plus `: <label>`.
- main's own renames: `peer-floor` (`>=0.86.1` -> `>=1.0.0`) and `notify-closed-set-locks` OUT-08 (`65-entry` -> `66-entry`, `unsupported mcp`). The branch's own earlier renames in `compat-01-no-expansion` and `no-credential-leak` (2), whose old titles exist in BASE and on main.

### Commands (exit status)

- `npx tsc --noEmit -p <scratch>/tarch-tsconfig.json` (`include` = `extensions/**/*.ts` + `tests/architecture/*.ts`, 57 architecture files listed): 0, no error.
- `node --test` over the 46 owned `*.test.ts` files: 0 (450 pass, 0 fail).
- `node --test tests/architecture/{hooks-cap-notify,mcp-config-notices,mcp-migration-notice}.test.ts` after the `catalog-block.ts` comment edit: 0.
- `npx prettier --check` on the 51 owned files: 0. `npx eslint --max-warnings 0` on them: 0.
- Direct coverage: not applicable (architecture tests are unpaired; no owned source).

### Cross-partition needs

None.

## Wave B: T-E2E (`tests/e2e/**`, `tests/live-uat/**`)

Files finished (no conflict marker existed in the owned paths; nothing staged): `tests/e2e/pi-peer-floor/package.json`, `tests/e2e/pi-peer-floor/package-lock.json`, `tests/e2e/pi-json-output.test.ts`, `tests/e2e/_rpc.ts`, `tests/e2e/adapter-detection-rpc.test.ts`, `tests/live-uat/mcp-adapter-canary.mjs`. The cleanly merged `tests/e2e/_helpers.ts`, `tests/e2e/import-command.test.ts`, and `tests/e2e/install-soft-deps.test.ts` typecheck against the branch as merged and needed no port.

Decisions:

- Peer floor: the fixture pins `@earendil-works/pi-coding-agent` `1.0.0`; the regenerated lock resolves it with the same integrity as the root lock. `pi-json-output.test.ts` asserts `1.0.0` for the manifest and the runtime. The fixture's gitignored `node_modules` still holds 0.86.1 until Task 3 runs `npm --prefix tests/e2e/pi-peer-floor ci --ignore-scripts`.
- One RPC helper: `_rpc.ts` now also collects `entry_appended` custom entries as `RpcSessionResult.entries` (`{ after, customType, data }`, `after` = the step in flight, as for notifies). `json-output-runtime.ts` is untouched and nothing was cloned from it; `fallow dupes` reports no clone group in `tests/e2e/**` or `tests/live-uat/**`. The `_rpc.ts` header now says the extension answers `/claude:plugin` in RPC with `claude-plugin` entries (JOUT-01) and that notifies carry what other extensions print.
- `adapter-detection-rpc.test.ts` reads each plugin step's `claude-plugin` payloads, checks every one against `NOTIFICATION_PAYLOAD_SCHEMA`, and asserts: the `mcp-fixture` row of the install cascade as `{ status: "installed", version: "1.0.0", reasons }` plus the cascade severity (`warning` with `requires pi-mcp-adapter`, `info` without); the same row on the list cascade; and the info step's `plugin-info` `plugin.requires` as `[{ companion: "pi-mcp-adapter", missing }]`. The schema puts `requires` on the resolved info row beside `components`, not inside it, so the test reads `plugin.requires`. The inventory probe fixture still reports through a notify, which the test keeps reading.
- `mcp-adapter-canary.mjs`: the session also collects `entry_appended` custom entries per step, and a `sendCommand` underlies `sendStep` so the canary can send `get_entries`. M1 polls `get_entries` for the load-time `mcp-migration` payload (startup entries are not streamed) and requires the moved row `{ kind: "moved", scope: "user", plugin: "echo", marketplace: "canary-mkt", from: "echo", to: "plugin_echo_echo_" }`. `infoToken` reads the `status` of the `plugin:<p>:<p>` MCP server from the `plugin-info` or `plugin-info-cascade` payload (wire status tokens equal the text tokens). I1 requires an installed `ping` `1.0.0` row in the install cascade. `--capture-legacy` still reads notifies, because it drives the published 0.19.2. pi-mcp-adapter's own "Ignored settings" notifies and the helper's `canary-status` notify stay notify reads.

Test titles: none renamed, moved, or dropped.

Commands (exit status):

- `npm --prefix tests/e2e/pi-peer-floor install --package-lock-only --ignore-scripts`: 0 (npm's audit summary reports 1 high-severity advisory in the fixture tree).
- `npx tsc --noEmit -p <scratch>/t-e2e-tsconfig.json` (`include` = `extensions/**/*.ts`, `tests/e2e/**/*.ts`, `tests/pi-runtime.ts`): 0.
- `npx eslint --max-warnings 0 tests/e2e/_rpc.ts tests/e2e/adapter-detection-rpc.test.ts tests/e2e/pi-json-output.test.ts`: 0 (`tests/live-uat/` is in the ESLint ignore list).
- `npx prettier --check` on the six files: 1 (canary), then `npx prettier --write tests/live-uat/mcp-adapter-canary.mjs`: 0, recheck: 0.
- `node --check tests/live-uat/mcp-adapter-canary.mjs`: 0.
- `npx fallow dupes --format json --quiet`: 0, no clone group names a `tests/e2e/**` or `tests/live-uat/**` file.
- `node --test --test-name-pattern="runRpcSession refuses" tests/e2e/adapter-detection-rpc.test.ts`: 0 (2 pass; loads the module, spawns no Pi).
- `node --test tests/e2e/import-command.test.ts`: 0 (3 pass; mock Pi, hermetic environment).
- The real-Pi e2e suite was not run (Task 3 runs it).

Human-needed: a live run of `tests/live-uat/mcp-adapter-canary.mjs` against pi-mcp-adapter 5.2.0 (operator-run; M1 now depends on `get_entries` returning the load-time `mcp-migration` entry).

Cross-partition needs: none.

## Wave B: T-ORCH (`tests/orchestrators/**` outside `plugin/`)

Files finished (per hunk, R1; no conflict marker left; nothing staged):

- Conflicted: `import/execute.test.ts` (46 hunks), `marketplace/{add,autoupdate,info,list,remove,shared,update}.test.ts`, `reconcile/{apply,pending}.test.ts` (75 and 19 hunks). Every count-only hunk (`createNotificationBoundary(n, probes)`, `expectSoftDepProbes(pi, n)`, `pi: PiInventory` fields, `emptyPiInventory()`) takes the branch side: the run model has no Pi mock to count (D-05). The now-unused clean-merged `expectSoftDepProbes` / `adapterCommand` / `emptyPiInventory` imports are dropped.
- `marketplace/remove.test.ts`: the boundary keeps the branch doc and takes main's `noticeCalls` parameter; `ctx.mode`, `ctx.ui`, and `notify` are each `.times(1 + noticeCalls)` (every emission reads mode and ui once). main's seven AFILE-04 / save-failure tests ported to `run`; together they cover all three arms of `rethrowWithMcpConfigNotices` (no notice: rethrow; orchestrated: `MarketplaceRemoveFailureError`; standalone: notices through the run, then rethrow).
- `marketplace/shared.test.ts`: `McpConfigNotice` imported from `shared/notification-types.ts` (R10); main's D-08-07 tests take `run: boundary.run`.
- `marketplace/{add,update}.test.ts`, `import/execute.test.ts`, `reconcile/{apply,backfill,types}.test.ts`: main's new cases take `run` (`runWithNothingLoaded()`, or `runWithSoftDeps({ piMcpAdapterLoaded: true, ... })` for the adapter-loaded import case) in place of `pi` and the probe count (R2).
- Strict inventory mocks behind `openNotificationRun` (`auth-host.test.ts`, `import/execute.test.ts`, `reconcile/apply.test.ts`, `marketplace/update.test.ts`): `ToolInventory` -> `PiInventory`, plus one `getCommands()` read per run (ADET-02).
- `requires pi-mcp` -> `requires pi-mcp-adapter` in the typed reason inputs of `marketplace/update.messaging.test.ts`, `import/execute.messaging.test.ts`, `reconcile/reconcile.messaging.test.ts` (R9; main changed only the expected text).

Test titles: none renamed, moved, or dropped. Every title from both sides is kept.

Commands (exit status):

- `npx tsc --noEmit -p <scratch tsconfig: extensions/** + tests/orchestrators/{*,import,marketplace,reconcile}>`: 0
- `node --test tests/orchestrators/*.test.ts tests/orchestrators/{import,marketplace,reconcile}/*.test.ts`: 0 (1062 pass, 0 fail)
- `node scripts/test-coverage-direct.mjs <the 36 paired sources>`: 0
- `npx eslint --max-warnings 0 <owned files>`: 0
- `npx prettier --check <owned files>`: 0 (after `prettier --write` reflowed lines the port lengthened)

Cross-partition needs: none. No production change needed.

## Wave B: T-EDGE-R (`tests/edge/**` outside `handlers/`, `tests/{bridges,integration,domain,persistence,platform,transaction}/**`, `tests/index.test.ts`)

Shared support (done first):

- `tests/platform/pi-inventory-seed.ts`: main's file stands unchanged. API: `toolInfo(name)`, `toolInventoryItem(name)`, `emptyPiInventory()`, `adapterCommand(name?, source?)`, `adapterProxyTool()`, `forkAdapterCommand()`, `builtinMcpTool()`, `builtinMcpCommand()`, `foreignMcpTool()`.
- `tests/integration/mcp-plugin-seed.ts` (R2, R11): `makeCtx(origin?: NotificationOrigin)` now returns `{ session: { ctx, run }, notifications }`. `ctx` is a text-mode (`mode: "tui"`) recording context; `run` is `openNotificationRun({ ...emptyPiInventory(), appendEntry: throws }, origin)`, so its snapshot reports no companion loaded (main's empty-inventory Pi). `origin` defaults to a command run; `seedMcpPlugin` and `seedLegacyMcpInstall` keep main's signatures.

Conflicted files, per hunk (R1):

- `tests/integration/marketplace-add-seed-mirrors.test.ts`: the one hunk takes the branch side (the boundary holds no Pi mock); main's then-unused `expectSoftDepProbes` import dropped. Equals PRE.
- `tests/integration/skill-path-resolution.test.ts`, `tests/integration/provenance-invisibility.test.ts`: both sides fixed the same defect; main's version supersedes the branch's in every hunk, so each file equals MAIN. The branch invariants hold: the peer lookup (`findPiSubagentsPackage`) runs before `createHermeticEnvironment` swaps HOME (skill-path's comment says so; provenance never swaps HOME), and a present but broken peer fails (`loadPiSubagentsModule` rejects; an override naming no package throws). main imports the compiled `src/agents/*.js` through `pi-subagents-peer.ts` and skips below the peer floor.
- `tests/edge/register.test.ts` (R5): both import lines kept; the strict registrar states `expectSoftDepProbes(pi, probes.runs)` after the branch's `appendEntry` expectation; main's `mcpStatus: noStatusSnapshot()` merged cleanly. Edited for the port: the two independent hook-run inventories gain `getCommands`, the single-probe severity case states one `getCommands()` read, and `subagentTool()` sets `exposure: "direct"` (PIFL-04).
- `tests/index.test.ts` (R2, R5, R11): `loadExtension(emissions, probes, cwd?, modeReads?, output?)` keeps the branch's own strict Pi mock and boundary; its second argument now counts soft-dependency snapshots (main's meaning) and `expectSoftDepProbes` states their reads. A stale-inventory case throws from both `getAllTools()` and `getCommands()`. main's ASTAT-01 event-bus mock (`pi.events`, one `pi-mcp-adapter/status/v1` subscription) and `publishStatus` are merged in, and `verifyBoundary` verifies the boundary, the Pi mock, and the bus. `TOOL_READS_PER_DISCOVER = 3` became `PROBES_PER_DISCOVER = 1`, and the old `modeReads = emissions + rootReads` default became `emissions + MODE_READS_PER_DISCOVER * probes` (three mode reads per discover pass; the same numbers as before). The session-env cases take main's `cwd` read (AVAR-01, `applyMcpAdapterEnvFrom(() => ctx.cwd)`) and the branch's one mode read. main's new cases: ASTAT-01 states 2 and 1 probes (one per command run; main's second info probe is gone, R5) and 6 and 3 mode reads; the AVAR-01 session cases state one mode read.

Cleanly merged files edited for the port:

- `tests/edge/command-run.test.ts`: every test inventory gains `getCommands` (empty, or throwing like its `getAllTools`; in `reports inventory failure with the allocated identity`, whose custom `openRun` reads only `getAllTools`, it throws `Unexpected inventory`). `delivers a handler failure through the original sink in ${mode}` now expects the probe's read order `inventory, commands, inventory, inventory`.
- `tests/integration/mcp-migration.test.ts`: the `reload` helper opens a load-origin run (`makeCtx({ kind: "load" })`), since it drives `applyReconcile`.
- `tests/integration/reserved-record-keys.test.ts`: the reconcile case passes `run: openNotificationRun(makeMockPi([]).pi, { kind: "load" })` instead of `pi` (it uses T-E2E's `tests/e2e/_helpers.ts`, unchanged).

Test titles: none renamed, moved, or dropped. Both sides' titles are present in every conflicted file (checked by diffing the title sets of PRE + MAIN against the result).

Commands (exit status):

- `npx tsc --noEmit -p <scratch tsconfig: extensions/** + owned test globs>`: 0
- `node --test <147 owned unit test files>`: 0; `node --test tests/index.test.ts tests/edge/register.test.ts tests/edge/command-run.test.ts`: 0 (453 pass)
- `node --test "tests/integration/**/*.test.ts"`: 0 (180 tests: 120 pass, 60 skipped -- 58 `PI_MCP_ADAPTER_ROOT is not set`, 2 pi-subagents 0.47.1 below the 0.74.0 floor; both environmental)
- `PI_MCP_ADAPTER_ROOT=<global pi-mcp-adapter> node --test <the 3 adapter conformance files>`: 1 -- the only installed adapter is 2.6.1, outside the declared `>=5.2.0 <6`, so the opt-in run cannot prove anything here; not a merge defect
- `node scripts/test-coverage-direct.mjs <143 sources paired with owned tests>`: 0
- `npx eslint --max-warnings 0 <every owned .ts file>`: 0; `npx prettier --check <same>`: 0

Cross-partition needs: none. No production defect found.

## Wave B: T-PLUGIN (`tests/orchestrators/plugin/**`)

Status: done. No conflict marker is left in the directory; the 16 conflicted paths stay `U` in the index because nothing is staged.

### Files finished

Conflicted, resolved per hunk (R1): `bootstrap` (6 hunks), `enable-disable` (7), `enable-disable.messaging` (9), `fetch` (1), `info` (6), `install-cascade.messaging` (4), `install-flow` (20), `list-flow` (5), `operations` (7), `prune` (35), `reinstall-flow` (64), `reinstall.messaging` (4), `shared` (3), `uninstall` (1), `update-cascade` (16), `update-flow` (6) — all `.test.ts`.

Cleanly merged, ported: `install-outcome.test.ts` (main's 10 new ANAME / AFILE ledger cases take `run: runWithNothingLoaded()`; `InstallLedgerOptions` requires it), `prune-rollback.test.ts` (main's 12 AFILE-01 / NFR-3 restore-ops literals spread the file's `restoreOps`, which carries the branch's required `createBackupRoot`), `install.messaging`, `list.messaging`, `update.messaging` (branch-side resolved-row literals: `requires pi-mcp` -> `requires pi-mcp-adapter`, R9).

### Decisions

- R2/R5: every main hunk that built a `PiInventory` (`makePi`, `emptyPiInventory()`, `adapterCommand()` commands, `toolNames`) or stated `expectSoftDepProbes` takes the branch's run. "pi-mcp-adapter loaded" is `runWithSoftDeps({ piMcpAdapterLoaded: true, ... })` (`enable-disable.test.ts` gained a local `runWithMcpAdapterLoaded()` for main's 13 AFILE sites); no-companion is `runWithNothingLoaded()`. Probe counts drop out of every boundary (`createNotificationBoundary(n)` with no read count), so main's `expectSoftDepProbes` imports were removed where they became unused.
- `info.test.ts` (R5, ADET-01): `makeCtx(expectedNotifications, inventory)` takes the run's snapshot from `softDepStatus(inventory)` when the run is built, the way the command run opens, and passes that run to `getPluginInfo`. main's `orchestratorProbes` parameter is gone: `getPluginInfo` receives no inventory, so it can read none. main's two ADET-01 parameterized cases (built-in MCP alone -> `pi-mcp-adapter (missing)`; adapter command -> untagged) keep their titles and bytes, now proven through the snapshot. `makeCtx(1, 0)` (marketplace-not-added path) became `makeCtx()`.
- `operations.test.ts`: main's `getPluginInfo` call keeps `mcpStatus: noStatusSnapshot()` with `run`.
- `prune.test.ts`: main's added `// act` lines kept on the branch's `run` calls; the backup-file index check combines the branch's fixed `prune-backup-ABC123` with main's new index `"4"` (AFILE-01 backs up one more file); the rollback regexes take main's `[mcp adapter]` label with the branch's `Inspect prune-backup-ABC123/manifest.json`.
- `reinstall-flow.test.ts`: 37 hunks where main only inserted `// act` / `// assert` / `// act & assert` lines were resolved by taking the branch line with main's comment lines kept in place.
- `enable-disable.messaging.test.ts`: main renamed the result variable `actual` -> `renderedRow` (its assertions merged cleanly); the branch's `composePluginLines(...)` statements use `renderedRow` to match.
- `enable-disable.test.ts`: the branch's JSON-run case passes `openNotificationRun` a `getCommands: () => []` too (`PiInventory`).
- R11: every notify fake in the directory states `mode`; MCP config notice cases (AFILE-04 in uninstall/enable-disable/install/reinstall/update/prune) assert the notices from the run's text emissions (`ctx.ui.notify` captured per run).

### Test titles

- `install-flow.test.ts`: renamed to `PI-12 / RH-4: staged mcp + a run reporting pi-mcp-adapter unloaded -> the success row carries the {requires pi-mcp-adapter} marker`. It replaces the branch's `... carries the {requires pi-mcp} marker` (R9 reason rename) and main's `PI-12 / ADET-02: staged MCP servers with no mcp-adapter command or adapter source -> ... {requires pi-mcp-adapter} marker` (the case drives a run snapshot; the adapter-command / source detection it named is `softDepStatus`'s, covered by `tests/platform/pi-api.test.ts`).
- No other title renamed, moved, or dropped. Title check (scratch script, expected = (PRE ∩ MAIN) ∪ (PRE − BASE) ∪ (MAIN − BASE) over `tests/orchestrators/plugin/*.test.ts`): only the two titles above are absent.

### Commands (exit status)

- `npx tsc --noEmit -p <scratch>/t-plugin-tsconfig.json` (`extensions/**/*.ts` + `tests/orchestrators/plugin/**/*.ts`): 0.
- `node --test tests/orchestrators/plugin/*.test.ts`: 0 (2457 pass, 0 fail).
- `node scripts/test-coverage-direct.mjs` over the 50 `orchestrators/plugin/*.ts` sources that have a paired test here: 0 (`CI=1` spot check on `info.ts`: 437/437 branches, 92/92 functions, 3213/3213 lines).
- `npx eslint --max-warnings 0 tests/orchestrators/plugin/`: 0.
- `npx prettier --check tests/orchestrators/plugin/`: 0 (after `prettier --write` on `install-flow`, `prune`, `update-flow`, `update.messaging`, line wrapping only).

### Cross-partition needs

None. No production bug found. The directory uses `tests/platform/pi-inventory-seed.ts` (`adapterCommand`, `builtinMcpCommand`, `builtinMcpTool`), `tests/platform/mcp-status-seed.ts` (`noStatusSnapshot`, `statusSnapshot`), and `tests/shared/notification-run-seeds.ts` as they stand; it no longer imports `expectSoftDepProbes`.

## Task 3: gates, merge commit, push

### Step 1: test-title preservation

Scratch script (outside the repo): for every `tests/**/*.test.ts` path in PRE or MAIN (382 paths), the first literal argument of each `test(`, `it(`, and `describe(` call in BASE, PRE, and MAIN; the working-tree set is every tracked or untracked `tests/**/*.test.ts`. Expected = (PRE ∩ MAIN) ∪ (PRE − BASE) ∪ (MAIN − BASE): 7155 titles; working tree: 7170; absent: 40.

- 39 of the 40 are the renames and moves already logged above (Task 1: the dispatch MCP block, `notification-run`, `notification-grammar`, `wire-schema`, `catalog-wire`; T-PLUGIN: the two `install-flow` titles). Each logged target title was spot-checked present.
- 1 new line: main's `describe("notifyMcpMigration", ...)` wrapper in `tests/shared/notification-dispatch.test.ts` is retired because its body split three ways (Task 1): the four entry tests stay in the dispatch file as top-level tests, the bytes cases moved to `notification-mcp.test.ts`, and the typed cases moved to `describe("resolveRawSurface")` in `notification-resolve.test.ts`. No test inside it was lost.

Unexplained drops: none.

### Step 2: e2e on Pi 1.0.0

- `npm --prefix tests/e2e/pi-peer-floor ci --ignore-scripts`: 0; the fixture now resolves `@earendil-works/pi-coding-agent` 1.0.0 (npm audit notes advisories in the fixture tree, unchanged by this step).
- `CI=1 npm run test:e2e`: 0, 24 s. 33 tests: 33 pass, 0 fail, 0 skipped, 0 todo. Installed runtime Pi 1.0.0 and peer-floor fixture Pi 1.0.0 both reported: json exit 0 with one validated command outcome, startup markers observed in session memory before the streamed proof (not streamed), RPC `get_entries` retrieval, and zero session files for a persistence-enabled slash-only run. No environment-limited case and no skip.
- Pi 1.0.0 changed no behavior the docs state, so no assertion and no Limitations prose changed. `docs/json-output.md`: the "Real CLI tests passed on ..." sentence and the "real-runtime tests passed on installed Pi ..." paragraph now name Pi 1.0.0 for both runs; the archived 07-03 evidence link stays as the record of the earlier 0.87.1 / 0.86.1 runs.

### Step 3: format and pre-commit

- `npm run format`: 0, no file changed.
- `SKIP=npm-check pre-commit run --all-files`: 1. Every hook passed except `check-added-large-files`, which names `tests/orchestrators/reconcile/mcp-migration.test.ts` (73 KB) and `docs/mcp-compatibility.md` (66 KB). Both are byte-identical to origin/main, where they are already committed. The hook only checks files staged as added; during the merge, main's new files are staged as added relative to PRE, so `--all-files` sees them. A clean checkout (the Lint job) stages nothing and the commit-time run covers only conflicted and evil-merge paths, so neither sees them. Not a merge defect; re-run on the committed tree after the commit (below).

### Step 4: full gate

- `npm run check` (foreground, output to a scratch file, exit read directly): 0, 377 s, Node v26.11.1. check:static passed (typecheck 10.4 s, lint 297.8 s, lint:workflows, fallow, format:check, test:corresponding); test:unpaired, test:integration, and test:coverage:direct:all passed (Merged LCOV 279 records).
- Tree at the run: `git diff --cached --stat` 447 files changed, 89801 insertions, 2781 deletions; `git diff --stat` 134 files changed, 18020 insertions, 4005 deletions; untracked: the five `.planning/milestones/json-output-research/*.md`, `shared/notification-mcp.ts`, `tests/shared/notification-mcp.test.ts`, and this quick-task directory. A sha256 fingerprint of every tracked and untracked file was taken; after staging (step 6) it matches byte for byte outside this directory, so the run covers exactly the committed tree.

### Step 5: fallow audit

`npx fallow audit --base origin/main --format json --quiet`: exit 0, verdict `warn`. Attribution: dead code 0/0, complexity 0/0, duplication introduced 3, inherited 10. The three introduced groups are exactly the pre-existing edge-handler groups: `edge/handlers/plugin/install.ts:52-65` ~ `plugin/update.ts:33-46`, `plugin/bootstrap.ts:37-48` ~ `plugin/import.ts:32-47`, `marketplace/autoupdate.ts:30-46` ~ `plugin/enable-disable.ts:38-47`. The merge introduced no clone group. Recorded as a pre-existing PR #251 CI finding (the Lint `fallow-audit` job fails on `warn`) for the user to decide; not fixed here.

### Step 6: staging

List = `git diff --name-only --diff-filter=U` (115) ∪ `git diff --name-only` ∪ `git ls-files --others --exclude-standard`, minus this directory, `.mcp.json`, `node_modules`, and `.gsd/`: 170 paths. `git add --pathspec-from-file=<list>`: 0. Afterwards `git diff --name-only` and `--diff-filter=U` are empty; the only untracked files are this directory's three files. Staged: 558 files changed vs PRE. `git write-tree`: `51d4f9baa2c8c8b7fc12a03c2dba3f546f29a651`.

### Step 7: merge commit

- First `git commit -F <msg>`: exit 1, so no commit happened. In merge state the commit-time pre-commit run checks only conflicted and evil-merge files, and it now saw the newly staged `tests/shared/notification-mcp.test.ts`. The earlier `--all-files` run did not check that file, because it was untracked then. `fix-spaces` rewrote a literal U+00A0, and `forbid-bidi-controls` failed on lines 104, 202, 220, 237, 238, and 349. Cause: when Task 1 moved main's escape cases out of `notification-dispatch.test.ts`, main's `\u2028`, `\u2029`, `\u202E`, `\u200B`, and ` ` escapes were written as literal characters. Fix [Rule 1]: the hook's rewrite was discarded (`git checkout -- <file>`), and a scratch script turned each of those literal characters back into its escape. This gives main's exact source spelling and the same runtime strings. A scan of all 558 staged paths found no other file with more invisible or control characters than its PRE or MAIN version.
- `npm run check` re-run after that fix: 0, 95 s, Node v26.11.1 (ESLint cache warm). The worktree it ran on equals the committed tree.
- `SKIP=npm-check pre-commit run --files <every staged path>`: the only failure is the `check-added-large-files` merge-state result described in step 3. No fixer changed a file.
- Second `git commit -F <msg>`: 0, 93 s. Every hook passed, including `npm run check:commit` (staged package files, so all pairs) and gitlint. Commit `f38ce0f47da2d6096f3b59d62bd7062cbecdd112`, parents `699daee819be91cac53a76b07a8beab863bf1b83` (PRE) and `94160614b64398734ff0536efafa2747ab7525f8` (origin/main). `HEAD^{tree}` equals the staged `git write-tree`. `git status --porcelain --untracked-files=no` is empty, and the only untracked path is this directory.
- `SKIP=npm-check pre-commit run --all-files` on the committed tree (nothing staged): 0. This closes step 3.

### Step 8: push and PR

- `git fetch origin`: origin/features/json was `699daee8` and origin/main `94160614`, so main had not moved. `git merge-base --is-ancestor origin/features/json HEAD`: 0.
- `git push origin HEAD:features/json`: 0, `699daee8..f38ce0f4` (fast-forward, no force).
- `gh pr view 251 --json mergeable,mergeStateStatus,headRefOid`: `MERGEABLE`, `CLEAN`, head `f38ce0f4` on the first query.
- First CI states, all `pending`: static checks, integration tests, direct coverage, and pinned e2e tests (Node 24), plus pre-commit and fallow-audit. Expected: fallow-audit fails on the three pre-existing edge-handler clone groups (step 5).
- Task 3 `<automated>` verify block: 0.
- CI-only: the adapter-backed integration conformance cases (`PI_MCP_ADAPTER_ROOT`, pi-mcp-adapter 5.2.0; locally only 2.6.1 is installed), the pi-subagents cases below the 0.74.0 floor (locally 0.47.1), SonarCloud, and the Lint fallow-audit job.
