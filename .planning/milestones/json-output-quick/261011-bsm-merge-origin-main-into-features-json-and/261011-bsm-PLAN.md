---
phase: 261011-bsm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - CHANGELOG.md
  - docs/json-output.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/mcp/legacy.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/edge/command-run.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-run.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - .planning/BACKLOG.md
  - .planning/milestones/json-output-research/ARCHITECTURE.md
  - .planning/milestones/json-output-research/FEATURES.md
  - .planning/milestones/json-output-research/PITFALLS.md
  - .planning/milestones/json-output-research/STACK.md
  - .planning/milestones/json-output-research/SUMMARY.md
  - .planning/MILESTONES.md
  - .planning/PROJECT.md
  - .planning/research/ARCHITECTURE.md
  - .planning/research/FEATURES.md
  - .planning/research/PITFALLS.md
  - .planning/research/STACK.md
  - .planning/research/SUMMARY.md
  - .planning/RETROSPECTIVE.md
  - .planning/ROADMAP.md
  - .planning/state.json
  - .planning/STATE.md
  - .planning/WINDOWS.md
  - schema/claude-plugin.schema.json
  - tests/architecture/catalog-uat/mock-pi.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/hooks-cap-notify.test.ts
  - tests/architecture/manifest-read-agreement.test.ts
  - tests/architecture/mcp-config-notices.test.ts
  - tests/architecture/mcp-migration-notice.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-producer-wire-coverage.test.ts
  - tests/architecture/notify-will-reload-agreement.test.ts
  - tests/architecture/wire-schema.test.ts
  - tests/architecture/workflows-marker-coverage.test.ts
  - tests/e2e/adapter-detection-rpc.test.ts
  - tests/e2e/pi-json-output.test.ts
  - tests/e2e/pi-peer-floor/package.json
  - tests/e2e/pi-peer-floor/package-lock.json
  - tests/e2e/_rpc.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/browse.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/pending.test.ts
  - tests/edge/handlers/plugin/prune.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/tools.test.ts
  - tests/edge/notification-boundary.ts
  - tests/edge/register.test.ts
  - tests/index.test.ts
  - tests/integration/marketplace-add-seed-mirrors.test.ts
  - tests/integration/provenance-invisibility.test.ts
  - tests/integration/skill-path-resolution.test.ts
  - tests/live-uat/mcp-adapter-canary.mjs
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/list-flow.test.ts
  - tests/orchestrators/plugin/operations.test.ts
  - tests/orchestrators/plugin/prune.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall.messaging.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-cascade.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
  - tests/platform/pi-api.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-json.test.ts
  - tests/shared/notification-mcp.test.ts
  - tests/shared/notification-resolve.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notification-wire.test.ts
  - tests/shared/notify-context.test.ts
autonomous: true
requirements: [NFR-6, NFR-11, TEXT-01, WIRE-01, WIRE-03, WIRE-04, WIRE-09, JOUT-01, PMOD-01, PMOD-04, TENB-02, TENB-03]

estimate:
  tokens: 1200000
  raw_tokens: 1200000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "features/json's tip is ONE merge commit whose parents are the pre-merge features/json tip and the origin/main the merge used (94160614 at plan time); no tracked file holds a conflict marker; origin/features/json points at that commit and `gh pr view 251` reports mergeable MERGEABLE."
    - "`npm run check` exits 0 on the exact committed tree (Node version recorded), `SKIP=npm-check pre-commit run --all-files` exits 0, and `npm run test:e2e` exits 0 with the peer-floor fixture pinned at Pi 1.0.0."
    - "In tui and print modes every message main added keeps main's bytes: the MCP config notice sections, the /reload MCP migration notice, the info `requires:` line and MCP server states, and the `{requires pi-mcp-adapter}` and `{unsupported mcp}` reasons. Main's catalog blocks and byte locks pass through the branch's run API."
    - "In json and rpc modes those messages arrive only as schema-valid `claude-plugin` entries: `mcp-config-notices` (one per non-empty section) and `mcp-migration` are payload kinds of the committed schema, plugin info carries typed MCP server entries and companion requirements, and the dispatch module's only notify calls stay inside `deliver` (presentation-sink gate)."
    - "Every soft-dependency read in main's ported code comes from the command's or load pass's NotificationRun snapshot: handlers and orchestrators take `run`, not `pi`, and the snapshot probes through main's PiInventory (getAllTools plus getCommands)."
    - "No test is silently lost: every test title present on either side (and not removed by that side's own history) exists somewhere in the merged test tree, or the merge log names where it moved or why it was retired; main's RPC adapter-detection e2e asserts `claude-plugin` entries instead of notify events."
    - "Both milestones' planning records survive: WINDOWS.md holds 92 entries (main's 88-90 keep their ids, json-output's 88/89 become 91/92, open 0) and `windows status` accepts it; MILESTONES, RETROSPECTIVE, ROADMAP, BACKLOG and PROJECT name both mcp-4 and json-output; main's research stays in .planning/research and the branch's moves to .planning/milestones/json-output-research/."
  artifacts:
    - path: "extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
      provides: "notifyMcpConfigNotices(ctx, run, notices) and notifyMcpMigration(ctx, run, report) over the raw-surface path; no notify call outside deliver"
      contains: "notifyMcpMigration"
    - path: "extensions/pi-claude-marketplace/shared/notification-mcp.ts"
      provides: "main's MCP notice and migration text composition (escaping, section and row lines, summaries), pure and imported by the text strategy"
      contains: "printable"
    - path: "extensions/pi-claude-marketplace/shared/notification-wire.ts"
      provides: "typebox members for mcp-config-notices and mcp-migration, typed MCP server entries and companion requirements on plugin info"
      contains: "mcp-migration"
    - path: "schema/claude-plugin.schema.json"
      provides: "regenerated committed schema (WIRE-09) with the two new kinds"
      contains: "mcp-config-notices"
    - path: "docs/json-output.md"
      provides: "reference sections for every new kind and field, with the version claims re-verified on Pi 1.0.0"
      contains: "<!-- fields: kind:mcp-migration -->"
    - path: "tests/e2e/pi-peer-floor/package.json"
      provides: "exact peer-floor fixture at the new floor"
      contains: "\"@earendil-works/pi-coding-agent\": \"1.0.0\""
    - path: ".planning/WINDOWS.md"
      provides: "merged broken-windows ledger, JSON and table in agreement"
      contains: "total_count: 92"
  key_links:
    - from: "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts"
      to: "extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
      via: "the load pass hands its run to the migration notice"
      pattern: "notifyMcpMigration\\(opts\\.ctx, opts\\.run"
    - from: "extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
      to: "extensions/pi-claude-marketplace/shared/notification-resolve.ts"
      via: "resolveRawSurface resolves both MCP kinds once; text and JSON read the same resolved value"
      pattern: "mcp-config-notices"
    - from: "extensions/pi-claude-marketplace/shared/notification-wire.ts"
      to: "schema/claude-plugin.schema.json"
      via: "npm run schema:generate; tests/architecture/wire-schema.test.ts fails on drift"
      pattern: "mcp-migration"
    - from: "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
      to: "extensions/pi-claude-marketplace/shared/notification-run.ts"
      via: "the info requires: entries read the command run's soft-dep snapshot"
      pattern: "run\\.softDeps"
    - from: "extensions/pi-claude-marketplace/shared/notification-run.ts"
      to: "extensions/pi-claude-marketplace/platform/pi-api.ts"
      via: "openNotificationSnapshot takes main's PiInventory"
      pattern: "PiInventory"
---

<objective>
Merge `origin/main` into `features/json` as ONE merge commit, port main's new code onto this branch's notification model (`run: NotificationRun` instead of `pi`, `run.softDeps` instead of `softDepStatus(pi)`, `rowPolicies` instead of render maps, the mode-selected text/JSON strategies), keep `npm run check` green, and push so PR #251 becomes mergeable.

Purpose: PR #251 is `CONFLICTING` / `DIRTY` (measured 2026-10-11). main is two commits ahead of the merge base `000be227`: `369eaec3` (#248, workflow storage root) and `94160614` (#250, plugin MCP servers move to pi-mcp-adapter 5 on Pi 1.0, release 0.20.0). The textual merge is the small part. main's #250 code is written against the old API, and three of its additions collide with this branch's contracts:

1. `notifyMcpConfigNotices(ctx, notices)` and `notifyMcpMigration(ctx, report)` call the Pi notify API directly inside the dispatch module. That breaks JOUT-01 in json/rpc mode and the D-16 presentation-sink gate. They must become typed raw surfaces that both strategies render (WIRE-01).
2. Plugin info gained typed MCP server entries (`McpServerSummaryEntry`), a `requires:` companion list, two reasons (`requires pi-mcp-adapter` replaces `requires pi-mcp`; `unsupported mcp` is new), and a second soft-dep probe in `orchestrators/plugin/info.ts`. The wire schema, the committed JSON Schema, and the docs reference must carry them. The probe must become `run.softDeps` (PMOD-01).
3. `tests/e2e/adapter-detection-rpc.test.ts` reads notify events in RPC mode. This branch delivers RPC output as `claude-plugin` entries, so the test must assert entries. It runs in the CI e2e job, not in `npm run check`.

Output: one merge commit on `features/json` (pushed fast-forward to `origin/features/json`), a merge log in this task directory, and the SUMMARY.
</objective>

<execution_context>
@/home/acolomba/src/pi-claude-marketplace-json/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/src/pi-claude-marketplace-json/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@skills/local-verification/SKILL.md
@skills/typescript-google-style-review/SKILL.md
@skills/typescript-comments/SKILL.md
@skills/typescript-unit-testing/SKILL.md
@skills/typescript-unit-testing-review/SKILL.md
@.planning/milestones/json-output-REQUIREMENTS.md
@extensions/pi-claude-marketplace/shared/notification-dispatch.ts
@extensions/pi-claude-marketplace/shared/notification-wire.ts

Read on demand, not up front: `docs/json-output.md` (the `## Schema reference` section and its `<!-- fields: ... -->` table format), `extensions/pi-claude-marketplace/shared/notification-{resolve,json,grammar,run,types}.ts`, and the three versions of any conflicted file (`git show <PRE>:<path>`, `git show <MAIN>:<path>`, `git show <BASE>:<path>`).

<merge_facts>
Measured at plan time. Re-measure before relying on them. The live merge index governs the edit scope.

- HEAD `699daee8` (features/json, clean). origin/main `94160614`. Merge base `000be227`. If the orchestrator committed this plan first, HEAD is a planning-only descendant of `699daee8`.
- `git merge-tree --write-tree --name-only HEAD origin/main` reports 115 conflicted paths: 37 production files, 65 test files, 13 planning files, `CHANGELOG.md`, and `docs/output-catalog.md`. `package.json` and `package-lock.json` merge cleanly: Pi `^1.0.0` dev / `>=1.0.0` peer, new runtime dependency `strip-json-comments`, optional peer `pi-mcp-adapter >=5.2.0 <6`, `fallow ^3.31.0`, version 0.20.0. The branch's root `brace-expansion` 5.0.12 lock bump survives the merge.
- Largest conflict regions (marker lines): `tests/shared/notification-dispatch.test.ts` 2448 (main added about 55 MCP notice/migration tests there), `.planning/STATE.md` 1996, `.planning/research/PITFALLS.md` 1596, `.planning/research/ARCHITECTURE.md` 1388, `extensions/.../shared/notification-dispatch.ts` 916, `tests/orchestrators/reconcile/apply.test.ts` 534 (75 hunks), `tests/orchestrators/plugin/reinstall-flow.test.ts` 594 (64 hunks), `extensions/.../shared/notification-grammar.ts` 389, `tests/orchestrators/import/execute.test.ts` 340, `tests/orchestrators/plugin/install-flow.test.ts` 335, `tests/integration/provenance-invisibility.test.ts` 324, `extensions/.../orchestrators/plugin/install-flow.ts` 212, `extensions/.../shared/notify-context.ts` 194. Test conflicts total about 8,500 lines in 564 hunks.
- 59 main production files merge cleanly. Of those, `orchestrators/reconcile/{apply,backfill,notify}.ts` and `shared/notify-reasons.ts` touch the notify API. About 17 cleanly merged main test files build Pi or notify fakes. They include `tests/architecture/mcp-config-notices.test.ts`, `tests/architecture/mcp-migration-notice.test.ts`, `tests/e2e/adapter-detection-rpc.test.ts`, `tests/e2e/_rpc.ts`, `tests/platform/pi-inventory-seed.ts`, `tests/orchestrators/plugin/{install-cascade,install-outcome,reinstall-clone-probe}.test.ts`, and `tests/orchestrators/reconcile/{backfill,types}.test.ts`. `npm run typecheck` names the rest.
- main renamed `ToolInventory` to `PiInventory { getAllTools(); getCommands(); }`. Its `softDepStatus` now also reads `getCommands()` (ADET-02). Strict Pi mocks that count inventory reads (`tests/edge/register.test.ts`, `tests/index.test.ts`, `tests/edge/notification-boundary.ts`, `tests/architecture/catalog-uat/mock-pi.ts`) need main's extra reads on top of this branch's one-probe-per-run counts. `tests/platform/pi-inventory-seed.ts` is main's seed helper.
- Tooling the old merge notes mention is gone. The notify corpus tools were retired (`0a11761d`). No `lint:type-members` script and no `check-unused-type-members.*.json` pins exist. Do not look for either.
- WINDOWS ledger: ids 1-87 are shared, and only the branch changed them. main appended 88 (fixed), 89 (fixed), 90 (waived). The branch appended 88 (waived) and 89 (fixed). Result: 92 entries, open 0, waived 51, fixed 41.
- Research docs: both sides rewrote all five `.planning/research/*.md` files, and neither archived its copy. Root keeps main's copy. The branch's copy moves to `.planning/milestones/json-output-research/`, following the `notification-refactor-research` precedent. This keeps both and keeps PR #251's diff against main small.
- Pre-existing, not caused by the merge: `npx fallow audit --base 000be227` on HEAD returns verdict `warn` from 3 clone groups the branch introduced in edge handlers: `edge/handlers/plugin/install.ts` ~ `update.ts`, `bootstrap.ts` ~ `import.ts`, and `marketplace/autoupdate.ts` ~ `plugin/enable-disable.ts`. The Lint `fallow-audit` job fails on `warn`. main's ruleset requires no status checks, so this does not block mergeability.
- `PI_CODING_AGENT_DIR` was unset at plan time. #248 makes the test home helpers clear it.
</merge_facts>

<port_rules>
Every task and every delegated agent applies these rules. Cite the rule ID in the merge log when a choice depends on it.

- R1 Per hunk. Resolve each hunk with the three versions read. Never take one side of a whole file with `git checkout --ours/--theirs` (or by pasting one side) when the other side has edits in that file. The only whole-file outcomes allowed are the ones named below (`.planning/state.json`, root research files).
- R2 pi -> run. Wherever main's code threads `pi: PiInventory` for notification, the branch's equivalent is `run: NotificationRun`. `softDepStatus(pi)` becomes `run.softDeps`. Option bags take `run` and not `pi` (D-05). Large main-side files: start from main's hunk and substitute mechanically. `index.ts` keeps `pi` for non-notification uses (`createMcpStatusTracker(pi.events)`, `applyMcpAdapterEnv`).
- R3 Edge factories take no `pi` (D-07). `makePluginInfoHandler(deps.mcpStatus)` threads main's `McpStatusReader` and the router's run into `getPluginInfo`.
- R4 Messaging files (`*.messaging.ts`): start from the branch side and add main's new functions and rows. A render callback becomes a `rowPolicies` entry. A new row shape or remedy goes into `notification-resolve.ts`.
- R5 One probe per run. `openNotificationSnapshot` (and `edge/command-run.ts`) take main's `PiInventory`. `softDepStatus` is called only where the branch opens a run. The info `requires:` entries come from main's `companionRequirements(declaresAgents, declaresMcp, declaresWorkflows, opts.run.softDeps)`.
- R6 MCP config notices become the raw kind `mcp-config-notices`. `notifyMcpConfigNotices(ctx, run, notices)` emits one presentation per non-empty section, in main's section order: comments-dropped, left-unchanged, override-kept (after main's override-restored fold), variables-missing, credentials-blanked, tool-rules-unenforced, leftover-removed. Each presentation carries that section's typed notices after main's duplicate removal. Severity is `warning` and `needsReload` is false. The text bytes are main's: `<section summary>`, a blank line, the section lines. An empty list emits nothing. Origin is whatever the run is (command or load).
- R7 The /reload migration notice becomes the raw kind `mcp-migration` (load group, D-14). `notifyMcpMigration(ctx, run, report)` keeps main's control flow: an empty report emits nothing, and a report with notices but no rows emits the R6 sections. The resolved surface holds the sorted typed rows (moved, then removed, then left-in-place, each in main's code-unit order), the folded typed notices, `severity` (main's info/warning rule), and `needsReload` (true exactly when moved or removed rows exist, which is when main's text appends the reload hint). Raw kinds carry no `summary` (D-01): the text strategy composes main's three summary sentences, row sections, cost line, notice lines, and `RELOAD_HINT_TRAILER` byte for byte. JSON copies rows and notices in that order (WIRE-04).
- R8 Plugin info on the wire. `components.mcp` becomes an array of MCP server objects: `name` is required; `unsupportedFeature`, `unsetVariables`, `withheldVariables`, and `status` are optional, as main's type has them. The componentsResolved:true row gains optional `requires: { companion, missing }[]`. `McpServerStatus`, `Companion`, the migration row kinds, the removal causes, the notice kinds, and the file names are emitted verbatim through `Record<ClosedSet, true>` enrollment maps (WIRE-03, Phase 04 decision on `Type.Enum`).
- R9 Reasons. `requires pi-mcp-adapter` replaces `requires pi-mcp`, and `unsupported mcp` is appended in main's declared order. This applies to the wire REASONS map and to the closed-set token list in `docs/json-output.md`.
- R10 Vocabulary lives in `shared/notification-types.ts`. Move main's `McpConfigNotice` family, `McpMigrationRow` family, `McpMigrationReport`, and `McpMigrationRemovalCause` there from `notification-dispatch.ts`. Point every importer (`bridges/mcp/*`, `orchestrators/**`, tests) at the new location. No re-export: dispatch keeps behavior only.
- R11 Tests. Every Pi or notify context fake carries an explicit `mode` (TENB-02). Anything that touches a scope root runs under `tests/platform/hermetic-environment.ts` (`withHermeticEnvironment` / `createHermeticEnvironment` / `enterHermeticEnvironment`) or the suite's existing hermetic helper. Never read or write the real `~/.pi/agent`. Each source keeps 100% direct coverage from its paired test alone (`node scripts/test-coverage-direct.mjs <source>`). When main's tests exercise code that moved modules, MOVE them to the owner's paired test; do not duplicate them. Text cases keep main's exact expected bytes. JSON cases validate payloads through `tests/edge/json-capture.ts` (TENB-01).
- R12 Comments follow `skills/typescript-comments`: durable IDs only (AMIG-03, WIRE-01, D-14, ...), no phase, plan, or wave history, no comments on trivial code. Rewrite main's comments that say these notices call notify directly or bypass the structured path (for example the header of `tests/architecture/mcp-migration-notice.test.ts`).
- R13 No new dependencies and no version bump. The merged `package.json` and `package-lock.json` stand as merged (version 0.20.0). The only package metadata this plan edits is the e2e peer-floor fixture.
</port_rules>

<delegation>
The executor orchestrates and keeps its own context lean. Delegation is safe here because no commit happens until Task 3. Each delegated agent owns a disjoint set of files.

Every delegated agent's brief must say:
- the PRE, MAIN, and BASE SHAs, the owned paths, port rules R1-R13, and that the brief comes from this plan;
- edit only the owned paths; if a fix needs a file outside them, report it instead of editing it;
- never run commands that change the index, HEAD, the stash, or other files: no git add, commit, stash, checkout, restore, reset, merge, rebase, clean, and no npm ci or npm install (read-only git such as `git show` and `git diff` is fine);
- tests touch scope roots only through the hermetic helpers in R11, never the real home or `~/.pi/agent`;
- verify with `node --test <owned test files>` and `node scripts/test-coverage-direct.mjs <owned sources>`, not `npm run check`, `npm test`, or the all-pair sweep;
- report back: files finished, test commands and exit statuses, every test title it renamed, moved, or dropped with the reason, and every cross-partition need.

Partitions (re-derive membership from `git diff --name-only --diff-filter=U` plus `npm run typecheck` output; split any partition whose conflict regions exceed about 1,500 marker lines, by file):
- Task 1 (sequential): the notification core. The executor may hand it whole to ONE agent, or to two in sequence (1a sources + schema + docs, then 1b owner tests).
- Wave A (parallel, after Task 1): P-A `extensions/pi-claude-marketplace/orchestrators/plugin/**`; P-B `extensions/pi-claude-marketplace/{orchestrators/{marketplace,import,reconcile},edge,bridges}/**`, `extensions/pi-claude-marketplace/orchestrators/*.ts`, `extensions/pi-claude-marketplace/index.ts`; D-PLAN `.planning/**` (not the quick-task directory) plus `CHANGELOG.md`.
- Wave B (parallel, after Wave A production compiles and the executor has resolved the shared test support): T-ARCH the remaining `tests/architecture/**`; T-PLUGIN `tests/orchestrators/plugin/**`; T-ORCH `tests/orchestrators/**` outside `plugin/`; T-EDGE `tests/{edge,bridges,integration,domain,persistence,platform,transaction}/**` plus `tests/index.test.ts`; T-E2E `tests/e2e/**` plus `tests/live-uat/**`.

If sub-agents are unavailable, run the same partitions one at a time in this order. After each one, append its status to the merge log so that a fresh context can resume from the log plus `git diff --name-only --diff-filter=U` (MERGE_HEAD persists).

Merge log: `.planning/quick/261011-bsm-merge-origin-main-into-features-json-and/261011-bsm-MERGE-LOG.md`. It records SHAs, the live conflict list, partitions and status, design decisions, the ledger renumbering, and test title moves. It is never staged in the merge commit; it goes in with the SUMMARY.
</delegation>

<interfaces>
Branch (now): `notifyDiagnostic(ctx, run, header, lines)`; `emitPresentation(ctx, run, presentation)` (module-private); `resolveRawSurface(surface: RawSurface): ResolvedRawSurface`; `formatRawSurface(surface: ResolvedRawSurface): NotifyArguments | undefined`; `wireRawSurface(surface, origin)` (module-private in notification-json.ts); `RAW_SURFACE_SEVERITY` (`satisfies Record<RawSurface["kind"], Severity>`); `LoadSurface = ReconcileAbortedSurface | PluginPathSkippedSurface`; `HookSurface`; `isCommandOutcome(presentation)` (exhaustive switch in dispatch); `openNotificationSnapshot(pi: ToolInventory): NotificationSnapshot`; `NOTIFICATION_PAYLOAD_SCHEMA` (19 members; internal-error last); `RAW_ENVELOPE_FIELDS` = schemaVersion, origin, severity, needsReload.

main (to port): `notifyMcpConfigNotices(ctx, notices)`; `notifyMcpMigration(ctx, report: McpMigrationReport)` where `McpMigrationReport = { rows: McpMigrationRow[]; notices: McpConfigNotice[] }`; 7 `McpConfigNotice` kinds (`comments-dropped`, `left-unchanged`, `override-kept`, `override-restored`, `variables-missing`, `credentials-blanked`, `tool-rules-unenforced`, `leftover-removed`; `override-restored` only cancels); 11 `McpMigrationRow` kinds (`moved`, `removed`, `stopped`, `unowned`, `not-listed`, `source-unreadable`, `source-outdated`, `marketplace-unreadable`, `collision`, `file-unreadable`, `unfinished`); `McpServerSummaryEntry { name; unsupportedFeature?; unsetVariables?; withheldVariables?; status?: McpServerStatus }`; `CompanionRequirement { companion: Companion; missing: boolean }`; `companionRequirements(...)`; `PiInventory`; `McpStatusReader` (`platform/mcp-status.ts`).

Target: `notifyMcpConfigNotices(ctx, run, notices)`; `notifyMcpMigration(ctx, run, report)`; `openNotificationSnapshot(pi: PiInventory)`; `NOTIFICATION_PAYLOAD_SCHEMA` with 21 members (the two new kinds after `plugin-path-skipped`, internal-error still last).
</interfaces>
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1 (tracer): start the merge and carry the MCP notices end to end through the notification core in text and JSON</name>
  <precondition>The checkout is on features/json at 699daee8 or a descendant that differs from it only under .planning/quick/; `git status --porcelain --untracked-files=no` is empty; `git rev-parse -q --verify MERGE_HEAD` fails (no merge in progress); `git fetch origin` succeeded; the npm registry is reachable; `.claude/gsd-core/bin/gsd-tools.cjs` exists in this checkout (copy it in from the main checkout if this is an executor worktree).</precondition>
  <reversibility rating="costly">The two new payload kinds and the plugin-info MCP fields extend the committed JSON Schema (schemaVersion 1). Nothing has been released yet, but once PR #251 ships, a change means schema, docs, tests, and consumer updates.</reversibility>
  <files>extensions/pi-claude-marketplace/platform/pi-api.ts, extensions/pi-claude-marketplace/edge/command-run.ts, extensions/pi-claude-marketplace/shared/notification-run.ts, extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts, extensions/pi-claude-marketplace/shared/notification-types.ts, extensions/pi-claude-marketplace/shared/notify-context.ts, extensions/pi-claude-marketplace/shared/notification-mcp.ts (new), extensions/pi-claude-marketplace/shared/notification-grammar.ts, extensions/pi-claude-marketplace/shared/notification-resolve.ts, extensions/pi-claude-marketplace/shared/notification-json.ts, extensions/pi-claude-marketplace/shared/notification-wire.ts, extensions/pi-claude-marketplace/shared/notification-dispatch.ts, extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts, extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts, extensions/pi-claude-marketplace/bridges/mcp/{stage,unstage,legacy,types}.ts, schema/claude-plugin.schema.json, docs/json-output.md, docs/output-catalog.md, tests/shared/{notification-dispatch,notification-grammar,notification-summary,notification-resolve,notification-json,notification-wire,notify-context}.test.ts, tests/shared/notification-mcp.test.ts (new), tests/platform/pi-api.test.ts, tests/architecture/catalog-uat/mock-pi.ts, tests/architecture/{mcp-migration-notice,mcp-config-notices,wire-schema}.test.ts</files>
  <behavior>
    - tui/print: `notifyMcpMigration` with each report of main's catalog blocks `mcp-migration-moved`, `-stopped`, `-left-in-place`, `-removed`, `-unfinished` makes exactly one notify call with main's bytes and severity. A report with no rows and no notices makes none. A report with only notices makes one call per non-empty notice section.
    - json/rpc: the same reports append exactly one `claude-plugin` entry each, of kind `mcp-migration`. Its origin is the run's, its severity equals the text severity, `needsReload` is true exactly when moved or removed rows exist, and its rows and notices follow the text order. Each entry validates against `NOTIFICATION_PAYLOAD_SCHEMA`. No notify call happens.
    - `notifyMcpConfigNotices` emits one presentation per non-empty section in main's order. Duplicates collapse, an override-restored notice cancels an earlier override-kept notice for the same scope, file, and server, and an empty list emits nothing. The text bytes equal main's catalog blocks. Each JSON entry is a schema-valid `mcp-config-notices` payload at `warning` with `needsReload: false`.
    - A credential planted in a server name and in a migration `detail` comes out redacted in both strategies (PMOD-04). Text escapes control, line-separator, and bidi characters exactly as main's `printable` does. JSON carries the raw (redacted) string.
    - Plugin info catalog fixtures (main's `fixtures/plugin-info.ts` states) convert to schema-valid payloads carrying MCP server objects and `requires` entries, and their text matches the catalog bytes.
  </behavior>
  <action>
    1. Record and start the merge. Write the merge log with PRE (`git rev-parse HEAD`), MAIN (`git rev-parse origin/main`), BASE (`git merge-base HEAD origin/main`), and `node --version`. Run `git merge --no-commit --no-ff origin/main`; it exits non-zero with conflicts, which is expected. Save the output of `git diff --name-only --diff-filter=U` (capture it to a file first, then sort the file) to the merge log as the authoritative conflict list and diff it against this plan's frontmatter snapshot. If main or the branch moved, the live list governs.
    2. Install. If `node_modules` is a symlink, remove only the link (never its target) before installing. Run `npm ci --ignore-scripts`, which is what CI runs. `npm ls @earendil-works/pi-coding-agent strip-json-comments fallow` must show 1.0.0, 5.0.3, and 3.31.x.
    3. Resolve the core sources per R1, R2, R5, R9, and R10:
       - `platform/pi-api.ts`: keep the branch's `ExtensionMode` and `NotificationContext.mode`, and main's `ToolInventoryItem` / `CommandInventoryItem` / `PiInventory` / `PiEventSource` and adapter probe.
       - `shared/notification-run.ts` and `edge/command-run.ts`: take `PiInventory` (plus `NotificationEntrySink`).
       - `shared/concerns/soft-dep.ts`: main's companion constants and `companionRequirements`, with the branch's resolve-step wording.
       - `shared/notify-context.ts`: the branch side (row policies). Drop main's render-map typing. Its `PiInventory` rename applies only where inventory is still named.
       - `shared/notification-types.ts`: main's reason, `McpServerStatus`, `McpServerSummaryEntry`, and `requires` additions; the moved MCP vocabulary (R10); `McpConfigNoticesSurface` in `RawSurface`; `McpMigrationSurface` in `LoadSurface` (D-14).
    4. Implement R6 and R7 on the house raw-surface path. Move main's text composition (`printable`, the code-unit escaping, the section summaries and lines, the moved/removed/left row lines, `removalReason`, the migration summaries, and the cost line) into a new pure module `shared/notification-mcp.ts` that imports neither dispatch nor resolve.
       - `notification-resolve.ts` gains the two `resolveRawSurface` arms: the override fold, duplicate removal, main's sort orders, severity, `needsReload`, and `redactCredentials` on every free-text field. The migration severity varies, so keep one decision site: narrow `RAW_SURFACE_SEVERITY`'s key type to exclude `mcp-migration` and carry `severity` on the resolved migration surface.
       - `notification-grammar.ts` `formatRawSurface` composes main's bytes through `notification-mcp.ts`, appending `RELOAD_HINT_TRAILER` when `needsReload` is set.
       - `notification-json.ts` `wireRawSurface` copies typed values. `needsReload` comes from the resolved migration surface; update the "a raw kind never needs a reload" comment.
       - `notification-wire.ts` adds the notice union, the migration-row union, the MCP server object, the companion requirement, the R8 plugin-info changes, the R9 REASONS rename, and the two payload members after `plugin-path-skipped`.
       - `notification-dispatch.ts` keeps the branch side, adds `notifyMcpConfigNotices(ctx, run, notices)` and `notifyMcpMigration(ctx, run, report)` as builders that call `emitPresentation`, and classifies both kinds as non-outcomes in `isCommandOutcome`. If fallow health or sonarjs complexity rejects the grown switches, convert that classification to a typed lookup table; never suppress it.
       - main's info rendering hunks in `notification-grammar.ts` (the `requires:` line and MCP server entries and states) port onto the branch's info renderer with main's bytes.
       - In `orchestrators/reconcile/apply.ts`, pass `opts.run` at main's two MCP notice call sites. Point the type imports of `orchestrators/reconcile/mcp-migration.ts` and `bridges/mcp/{stage,unstage,legacy,types}.ts` at `notification-types.ts`.
    5. Run `npm run schema:generate`. In `docs/json-output.md`, add `<!-- fields: kind:mcp-config-notices -->` and `<!-- fields: kind:mcp-migration -->` sections plus referenced sections for the notice, the migration row, the MCP server, and the companion requirement, in the existing table format and with the presence values the schema yields. Change the Components `mcp` row type, add `requires` to the plugin info row, and update the closed-set tokens (R9 plus the new closed sets). Leave the Pi version claims for Task 3.
    6. In `docs/output-catalog.md`, resolve its two hunks: main's `requires pi-mcp-adapter` wording combined with the branch's "resolve step" phrasing. main's fenced blocks stay byte-identical.
    7. Owner tests (R11). Resolve `tests/shared/{notification-dispatch,notification-grammar,notification-summary,notify-context}.test.ts`, `tests/platform/pi-api.test.ts`, and `tests/architecture/catalog-uat/mock-pi.ts` (main's `getCommands` reads on top of the branch's run counts). Distribute main's MCP notice and migration tests (about 55 test declarations under `notifyMcpConfigNotices` / `notifyMcpMigration`) by owner:
       - composition and bytes to `tests/shared/notification-mcp.test.ts` and the `formatRawSurface` cases in `tests/shared/notification-grammar.test.ts`;
       - fold, sort, severity, `needsReload`, and redaction to `tests/shared/notification-resolve.test.ts`;
       - wire shape to `tests/shared/notification-json.test.ts` and `tests/shared/notification-wire.test.ts`;
       - entry points and transport per mode to `tests/shared/notification-dispatch.test.ts`.
       Keep each title, adjusting it only where the subject moved, and log every move. Port `tests/architecture/mcp-migration-notice.test.ts` and `mcp-config-notices.test.ts` to `(ctx, run, ...)` in tui mode, keep their catalog byte checks, and add a json-mode schema validation per catalog report. In `tests/architecture/wire-schema.test.ts`, change the member count and declared order from 19 to 21.
    8. Log every design choice made under R6-R8 (field names, where the severity sits, module placement) in the merge log. Stage nothing yet; Task 3 stages everything explicitly.
  </action>
  <verify>
    <automated>test -z "$(git diff --name-only --diff-filter=U -- extensions/pi-claude-marketplace/shared extensions/pi-claude-marketplace/platform tests/shared tests/platform/pi-api.test.ts tests/architecture/catalog-uat docs/output-catalog.md)" && node --test tests/architecture/mcp-migration-notice.test.ts tests/architecture/mcp-config-notices.test.ts tests/architecture/presentation-sink.test.ts tests/architecture/wire-schema.test.ts tests/architecture/json-output-docs.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts && node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/shared/notification-dispatch.ts extensions/pi-claude-marketplace/shared/notification-grammar.ts extensions/pi-claude-marketplace/shared/notification-resolve.ts extensions/pi-claude-marketplace/shared/notification-json.ts extensions/pi-claude-marketplace/shared/notification-wire.ts extensions/pi-claude-marketplace/shared/notification-mcp.ts extensions/pi-claude-marketplace/shared/notify-context.ts extensions/pi-claude-marketplace/shared/notification-run.ts extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts extensions/pi-claude-marketplace/platform/pi-api.ts</automated>
  </verify>
  <done>The merge is in progress with no unmerged path left in the notification core. main's MCP config notices and migration notice render main's exact bytes in tui and arrive as schema-valid `mcp-config-notices` / `mcp-migration` entries in json/rpc. Both are produced from the reconcile load pass through the run. Plugin info catalog fixtures are schema-valid with MCP server objects and `requires`. The committed schema and the docs reference agree. Every core source keeps 100% direct coverage. Nothing is committed yet.</done>
</task>

<task type="auto">
  <name>Task 2: port the remaining production call sites, every test partition, and both milestones' planning records</name>
  <files>The rest of the live conflict list plus every file `npm run typecheck` flags after Task 1: extensions/pi-claude-marketplace/orchestrators/**, extensions/pi-claude-marketplace/edge/**, extensions/pi-claude-marketplace/index.ts, extensions/pi-claude-marketplace/bridges/** (only as typecheck requires), tests/** outside Task 1's set (including tests/edge/notification-boundary.ts, tests/e2e/adapter-detection-rpc.test.ts, tests/e2e/_rpc.ts, tests/e2e/pi-json-output.test.ts, tests/e2e/pi-peer-floor/package.json, tests/e2e/pi-peer-floor/package-lock.json, tests/live-uat/mcp-adapter-canary.mjs), CHANGELOG.md, .planning/{STATE,PROJECT,ROADMAP,MILESTONES,RETROSPECTIVE,BACKLOG,WINDOWS}.md, .planning/state.json, .planning/research/*.md, .planning/milestones/json-output-research/*.md (new)</files>
  <action>
    Run the delegation waves from `<delegation>`, collect each report into the merge log, and after each wave check that `git rev-parse -q --verify MERGE_HEAD` still succeeds and no agent touched the index.

    Wave A, production (P-A, P-B), per R2-R5 and R10:
    - The orchestrator option bags that main typed `pi: PiInventory` take the branch's `run`.
    - main has 15 config-notice call sites. Task 1 already ported the reconcile one. The other 14 become `notifyMcpConfigNotices(ctx, run, ...)`: `orchestrators/import/execute.ts`, `marketplace/{remove (3), update}.ts`, and `plugin/{enable-disable (2), install-flow, prune, reinstall-flow (2), uninstall (2), update-flow}.ts`.
    - `orchestrators/plugin/info.ts` stamps `requires` from `opts.run.softDeps` and threads main's `mcpStatus`. `edge/handlers/plugin/info.ts` and `edge/register.ts` follow R3. `index.ts` merges main's `applyMcpAdapterEnvFrom` and `mcpStatus` into the branch's run-opening code.
    - `install.messaging.ts` and `reinstall.messaging.ts` follow R4.
    - When P-A and P-B both report done, `npm run typecheck` must show no error under `extensions/`.

    Wave A, D-PLAN (parallel with production), per R1:
    - `.planning/state.json`: the branch's content; json-output closed after mcp-4. Log that main's side is superseded by `.planning/milestones/mcp-4-ROADMAP.md`.
    - `.planning/STATE.md`: the branch's frontmatter, Current Position, and Session Continuity. Add an `### mcp-4 closeout` section built from main's STATE (completed 2026-10-10, merged as PR #250, release 0.20.0, and its carried items such as ROOTKEY-01). Union the Deferred Items rows, newest first. Keep both sides' decision lines (main's under an `### mcp-4 decisions` heading). Update Operator Next Steps to: main (#248, #250) merged into features/json, PR #251 next.
    - `MILESTONES.md`, `RETROSPECTIVE.md`, `BACKLOG.md`: both sides' entries, newest first (json-output 2026-10-11, then mcp-4 2026-10-10).
    - `ROADMAP.md`: the milestone list keeps the json-output line and turns main's mcp-4 line into "merged to main 2026-10-10 (PR #250)". The branch's "completed" wording stays, and no "shipped" is introduced, because that word flips GSD's milestone-status detection. The phase table and the next-milestone paragraph stay json-output's and point to the mcp-4 archive.
    - `PROJECT.md`: both milestones' current-state, validated-requirement, and decision content.
    - `.planning/research/*.md`: the root files take origin/main's version. Write PRE's five versions to `.planning/milestones/json-output-research/` (R1 exception: the branch's content is preserved there).
    - `CHANGELOG.md`: the branch's JSON-output bullet stays under `## [Unreleased]`, above main's `## [0.20.0] - 2026-10-10` section and its bullets; everything below merges unchanged.
    - `.planning/WINDOWS.md`: never hand-edit the table. With `parseLedger` / `renderLedger` from `.claude/gsd-core/bin/lib/broken-windows.cjs`, take entries 1-87 from PRE, entries 88-90 from MAIN, and PRE's 88 and 89 renumbered to 91 and 92. Recompute the counts (open 0, waived 51, fixed 41, total 92), set `last_updated` to the later of the two sides, render, and confirm with `node .claude/gsd-core/bin/gsd-tools.cjs windows status`. Record the renumbering once in STATE.md's json-output notes. Update live (non-archived) planning citations of json-output's #88/#89, such as the Deferred Items row "WINDOWS #89" -> "#92 (was #89 before the main merge)". Leave dated archives untouched.

    Before Wave B, the executor resolves the shared test support that several partitions import: `tests/edge/notification-boundary.ts` (the branch's `createNotificationBoundary(emissions, cwd?)` plus main's additions) and any main support file that typecheck flags across partitions (`tests/platform/pi-inventory-seed.ts`, `tests/integration/mcp-plugin-seed.ts`, `tests/e2e/_helpers.ts`).

    Wave B, tests, per R11:
    - Conflicted tests: the branch's harness plus main's new cases ported to the run API. Strict Pi mocks state main's extra `getCommands` reads.
    - The soft-dep-marker-policy, index source-scan, notify-producer-wire-coverage, and notify-grammar-invariant gates are updated only as far as the port changes what they check.
    - T-E2E pins `tests/e2e/pi-peer-floor/package.json` to `"@earendil-works/pi-coding-agent": "1.0.0"` and regenerates its lock with `npm --prefix tests/e2e/pi-peer-floor install --package-lock-only --ignore-scripts`. This lock is the one install this plan authorizes outside `npm ci` (T-261011-bsm-SC). T-E2E then sets `tests/e2e/pi-json-output.test.ts`'s floor assertions to 1.0.0.
    - T-E2E ports `tests/e2e/adapter-detection-rpc.test.ts` to read `claude-plugin` entries (the RPC event stream or a `get_entries` step, as `tests/e2e/json-output-runtime.ts` does) instead of notify events:
      - install and list: the cascade row for `mcp-fixture`, whether its reasons include `requires pi-mcp-adapter`, and the payload severity;
      - info: `plugin.components`' `requires` entry `{ companion: "pi-mcp-adapter", missing }`.
      Reuse one RPC session helper rather than cloning `tests/e2e/json-output-runtime.ts` (`fallow dupes` runs over tests). Fix the `_rpc.ts` comment about notify output. Port `tests/live-uat/mcp-adapter-canary.mjs` the same way where it reads `/claude:plugin` output from notify events. It is operator-run: verify it with `node --check` and record a live run as human-needed.
  </action>
  <verify>
    <automated>test -z "$(git diff --name-only --diff-filter=U)" && test -z "$(git grep -lE -e '^<{7} ' -e '^>{7} ' -- .)" && npm run typecheck && npm run test:unpaired && npm run test:modules && npm run test:integration && node .claude/gsd-core/bin/gsd-tools.cjs windows status && node --check tests/live-uat/mcp-adapter-canary.mjs</automated>
  </verify>
  <done>No unmerged path and no conflict marker remain. The whole program typechecks. The unpaired, module, and integration suites pass. The WINDOWS ledger renders 92 entries that `windows status` accepts. Both milestones' records are present. The e2e sources are ported to entries and the Pi 1.0.0 floor. Every agent report and test-title move is in the merge log. Nothing is committed yet.</done>
</task>

<task type="auto">
  <name>Task 3: run every gate on the exact tree, commit the one merge commit, push, and confirm PR #251 is mergeable</name>
  <precondition>`gh auth status` succeeds for github.com, and the user authorized pushing to origin features/json (granted in the planning context).</precondition>
  <files>Files a gate fix touches (stay inside the merged scope), docs/json-output.md (version claims), the index (explicit staging only)</files>
  <action>
    1. Test-title preservation. Write a scratch script outside the repo. For every `tests/**/*.test.ts` path in PRE or MAIN, extract the first literal argument of each `test(`, `it(`, and `describe(` call from BASE, PRE, MAIN, and the working tree. The expected set is (PRE ∩ MAIN) ∪ (PRE − BASE) ∪ (MAIN − BASE). Report expected titles found in NO working-tree test file. Each reported title needs a merge-log line: renamed to, moved to, or retired because. Unexplained drops get restored before gating.
    2. E2E on Pi 1.0.0, which is what the CI e2e job runs: `npm --prefix tests/e2e/pi-peer-floor ci --ignore-scripts`, then `npm run test:e2e`. If Pi 1.0.0 changed a behavior the docs state (startup entries not streamed, `entry_appended`, RPC retrieval), update the assertion and the `docs/json-output.md` Limitations prose to the observed behavior with evidence. Never loosen an assertion just to pass. Then rewrite the version claims in `docs/json-output.md` (the "Real CLI tests passed on ..." sentence and the "real-runtime tests passed on installed Pi ..." paragraph) to name only the versions that just ran. Keep the archived 0.86.1/0.87.1 evidence link as history.
    3. Format and lint before the full check, so the check sees the final bytes: `npm run format`, then `SKIP=npm-check pre-commit run --all-files` until it exits 0 (restage nothing yet; fixers write the worktree).
    4. Full gate: `npm run check`, run in the foreground and unpiped. Read its exit status directly; never capture `$?` after a pipe. Fix every failure inside the merge and re-run until it exits 0 on the final tree. Record the command, exit status, `node --version`, and the tree (`git diff --cached --stat` plus `git diff --stat`) in the merge log. If any build input changes after this run, run it again.
    5. Fallow audit, mirroring the Lint job: `npx fallow audit --base origin/main --format json --quiet`. Read `verdict` and `attribution`. Clone groups the merge introduced (ported code, RPC helpers) are fixed now and step 4 runs again. The three pre-existing edge-handler groups from `<merge_facts>` are only recorded for the SUMMARY as a pre-existing PR #251 CI finding for the user to decide; do not fix them in this merge.
    6. Stage explicitly, never `git add -A`. Build a path list from: the logged conflict list; `git diff --name-only` (port edits to cleanly merged files and fixer output); and the reviewed new files from `git ls-files --others --exclude-standard` (`shared/notification-mcp.ts`, its test, `.planning/milestones/json-output-research/*`, anything else this plan created). Exclude every file under `.planning/quick/261011-bsm-merge-origin-main-into-features-json-and/` (PLAN, COVERAGE, merge log), user-owned files such as `.mcp.json`, and any `node_modules` symlink. Run `git add --pathspec-from-file=<list>`. Then confirm that `git diff --name-only` and `git diff --name-only --diff-filter=U` are both empty, and that the remaining untracked files are only the excluded ones.
    7. Commit through the hook path, in the foreground with the longest timeout (background it once and wait for the notification only if it can outlast the limit). Use `git commit` with a Conventional Commits title of at most 72 characters, `chore: merge main into features/json`, and a body with lines of at most 80 characters. The body names #248 and #250 and the port: run instead of pi, the run's soft-dep snapshot, the two MCP payload kinds, typed MCP info fields, and the Pi 1.0.0 floor fixture. No milestone or phase names. End with the session's configured attribution trailer if one is set. If the hook fails, no commit happened: fix, restage, and commit again. Never `--no-verify`, never `--amend`, never rebase. Afterwards `git status --porcelain --untracked-files=no` must be empty. If a hook fixer rewrote a file, stop and report it rather than amending.
    8. Push fast-forward only: `git merge-base --is-ancestor origin/features/json HEAD`, then `git push origin HEAD:features/json` (never `--force`). Query `gh pr view 251 --json mergeable,mergeStateStatus`, re-querying a few times while GitHub reports `UNKNOWN`. Record the result and the first CI check states. The adapter-backed integration conformance cases and SonarCloud run only in CI: list them as CI-verified.
  </action>
  <verify>
    <automated>git merge-base --is-ancestor origin/main HEAD && git rev-parse -q --verify HEAD^2 && ! git rev-parse -q --verify HEAD^3 && test "$(git rev-parse HEAD)" = "$(git rev-parse origin/features/json)" && test -z "$(git status --porcelain --untracked-files=no)" && test "$(gh pr view 251 --json mergeable --jq .mergeable)" = MERGEABLE</automated>
  </verify>
  <done>One merge commit, with parents PRE and origin/main, is on features/json and origin/features/json. `npm run check` exited 0 on exactly that tree (Node version recorded). `SKIP=npm-check pre-commit run --all-files` and `npm run test:e2e` exited 0. The title-preservation report has no unexplained drop. PR #251 reports MERGEABLE. The fallow audit verdict and any pre-existing finding are recorded for the SUMMARY.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| origin/main -> features/json | Reviewed upstream code enters through conflict resolution. A wrong pick can drop security behavior from either side: main's credential deny-list blanking, `__proto__` refusal, and the adapter 5.2.0 redirect floor; the branch's PMOD-04 redaction, the appendEntry chokepoint, and the presentation sink. |
| plugin and marketplace strings -> text and JSON output | Server, plugin, and marketplace names, variable names, and migration `detail` strings come from plugin manifests, config files, and thrown errors. |
| delegated agents -> shared working tree with an open merge | Several agents edit one tree while MERGE_HEAD is set. |
| local tests -> real user scope | Tests that touch scope roots could write the real `~/.pi/agent`. |
| npm registry -> node_modules | `npm ci` of the merged lockfile and one regenerated test-fixture lockfile. |
| local checkout -> GitHub | Pushing the merge commit to `origin/features/json`. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261011-bsm-01 | Information disclosure | `mcp-config-notices`, `mcp-migration`, and plugin-info MCP fields in both strategies | high | mitigate | `resolveRawSurface` applies `redactCredentials` to every free-text field of both new kinds before either strategy reads them (PMOD-04, R6/R7). Notices carry variable names only, never values (AVAR-04/05). A resolve owner case plants userinfo in a server name and in a migration detail and asserts both outputs are redacted. `tests/architecture/no-credential-leak.test.ts` and the WIRE-08 walk run in `npm run check`. |
| T-261011-bsm-02 | Tampering | Conflict resolution of security-relevant code on either side | high | mitigate | R1 per-hunk resolution with all three versions read; the Task 3 test-title preservation report; `npm run check` on the exact committed tree (no-credential-leak, presentation-sink, the rule-pack chokepoints, the ESLint appendEntry rule, `tests/integration/reserved-record-keys.test.ts`). |
| T-261011-bsm-03 | Elevation of privilege | Delegated agents in one working tree | medium | mitigate | The `<delegation>` brief forbids index-, HEAD-, and stash-changing git commands and installs; ownership is disjoint; only the executor stages and commits; MERGE_HEAD and the index are checked after each wave. |
| T-261011-bsm-04 | Information disclosure | Real `~/.pi/agent` during local test runs | medium | mitigate | R11 hermetic helpers in every brief; #248 makes those helpers clear `PI_CODING_AGENT_DIR` (unset at plan time). |
| T-261011-bsm-05 | Repudiation | The merge commit and the push | medium | mitigate | One commit through the hook path (no `--no-verify`, no `--amend`, no rebase); fast-forward-only push after `git merge-base --is-ancestor`; never `--force`; the SUMMARY records each command, exit status, commit SHA, and Node version. |
| T-261011-bsm-06 | Spoofing | The ported RPC e2e reading `claude-plugin` entries | low | accept | Test-only, in a hermetic sandbox, and the entries come from the extension under test. |
| T-261011-bsm-SC | Tampering | npm installs | medium | mitigate | No new package name. `npm ci --ignore-scripts` restores main's reviewed lockfile (Pi 1.0.0, `strip-json-comments` 5.0.3, fallow 3.31.x, all added by #250). The peer-floor fixture pins `@earendil-works/pi-coding-agent` to exactly 1.0.0, the version main's root lockfile already resolves, and regenerates its lock with `--ignore-scripts`. Packages are [VERIFIED: in-repo lockfile at origin/main]. Any package name absent from origin/main's `package-lock.json` is a stop-and-ask. |
</threat_model>

<verification>
- Task 1: the notification-core gates and direct coverage listed in its `<automated>` block.
- Task 2: no unmerged path or marker; `npm run typecheck`, `npm run test:unpaired`, `npm run test:modules`, and `npm run test:integration` pass; `windows status` accepts the ledger.
- Task 3: the title-preservation report has no unexplained drop; `npm run test:e2e` passes on Pi 1.0.0; `SKIP=npm-check pre-commit run --all-files` and `npm run check` exit 0 on the exact committed tree; the fallow audit verdict is recorded; one two-parent merge commit is pushed fast-forward; `gh pr view 251` reports MERGEABLE.
- CI-only, recorded as such: the integration conformance cases that need `PI_MCP_ADAPTER_ROOT` (pi-mcp-adapter 5.2.0), SonarCloud, and the Lint `fallow-audit` job (expected `warn` from the three pre-existing edge-handler clone groups unless the user decides otherwise).
</verification>

<success_criteria>
- PR #251 is MERGEABLE, and features/json carries main's #248 and #250 behavior with this branch's output model intact.
- In tui/print, every byte main added is unchanged. In json/rpc, every new message is a schema-valid `claude-plugin` entry, and none reaches notify.
- `npm run check` is green on the committed merge, the e2e suite is green on Pi 1.0.0, and no test was silently dropped.
- Both milestones' planning records, the ledger, and the research survive without loss.
</success_criteria>

<source_audit>
| Source | ID | Item | Covered by | Status |
| --- | --- | --- | --- | --- |
| GOAL | quick | Merge origin/main into features/json | Task 1 step 1, Task 3 | COVERED |
| GOAL | quick | Port main to the run / rowPolicies model | Tasks 1-2 (R2-R10) | COVERED |
| GOAL | quick | PR #251 mergeable | Task 3 steps 7-8 | COVERED |
| GOAL | quick | `npm run check` passes | Task 3 step 4 | COVERED |
| CONSTRAINT | C-1 | Single merge commit, no intermediate commits | Tasks 1-2 stage nothing; Task 3 step 7 | COVERED |
| CONSTRAINT | C-2 | No rebase, no `--no-verify`, no `git add -A`, no whole-file side picks on mixed files | R1; Task 3 steps 6-7 | COVERED |
| CONSTRAINT | C-3 | Hermetic tests, never the real `~/.pi/agent` | R11; delegation brief; T-261011-bsm-04 | COVERED |
| CONSTRAINT | C-4 | Repo-root-relative paths; edit scope from the live merge index | merge_facts; Task 1 step 1 | COVERED |
| CONSTRAINT | C-5 | Delegate test porting where safe | `<delegation>` | COVERED |
| CONSTRAINT | C-6 | Push authorized | Task 3 step 8 | COVERED |
| CONSTRAINT | C-7 | Planning docs keep both milestones; WINDOWS through the JSON ledger | Task 2 D-PLAN | COVERED |
| CONSTRAINT | C-8 | JSON docs and e2e version claims updated or flagged | Task 2 T-E2E; Task 3 step 2 | COVERED |
| REQ | WIRE-01, WIRE-03, WIRE-04, WIRE-09, JOUT-01, PMOD-01, PMOD-04, TEXT-01, TENB-02, TENB-03, NFR-6, NFR-11 | Branch contracts the port must keep | R5-R11; Task 1 behavior; Task 3 gates | COVERED |
| RESEARCH | — | No research phase (quick task) | — | N/A |
</source_audit>

<output>
Create `.planning/quick/261011-bsm-merge-origin-main-into-features-json-and/261011-bsm-SUMMARY.md` after Task 3. Commit it in a separate docs commit after the merge commit, together with the merge log (and this PLAN and COVERAGE.md if they are not committed yet). The SUMMARY contains:
- Verification evidence: each gate command, its exit status, the merge commit SHA, `node --version`, and the e2e Pi versions.
- The live conflict count against the 115 measured at plan time, the partition table, and the agent reports summary.
- The R6-R8 wire decisions as built: field names, severity placement, and module placement.
- The WINDOWS renumbering (json-output #88 -> #91, #89 -> #92).
- The test-title moves and retirements.
- The fallow audit verdict, with the three pre-existing edge-handler clone groups called out as a pre-existing PR #251 CI finding for the user.
- CI-only checks.
- Human-needed items: a live run of `tests/live-uat/mcp-adapter-canary.mjs`.
- Follow-ups for the user: offer the version bump and CHANGELOG release section before PR #251 merges (AGENTS.md "Versioning"); decide on the pre-existing audit `warn`.
- A `## Threat Flags` section (AGENTS.md). Write "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced." if that holds.
</output>
