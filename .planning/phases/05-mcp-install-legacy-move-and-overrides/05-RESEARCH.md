# Phase 5: MCP Install, Legacy Move, and Overrides - Research

**Researched:** 2026-11-22
**Domain:** Moving integration cases to cucumber scenarios (test-only; no product change found necessary)
**Confidence:** HIGH. Every scenario draft below ran green under the `adapter` and the `builtin` profile against the real extension, first from scratch files, then appended to the real owner feature files with the typed step code in place. Every break below was applied, run, and reverted in this session. `git status --porcelain` was clean at the end; this file is the only change.

## Summary

All user-visible cases of the seven files have verified replacements. The seven files hold 43 tests (one parameterized pair). One more case, `mcp-verdict-list.test.ts:139`, belongs to ITMIG-10. Of these 44 cases, **40 move to cucumber** and **4 stay** for Phase 8: the refused-write case `mcp-migration.test.ts:749` (fault injection) and the three released-build record cases of `mcp-verdict-migration` (`:117`, `:149`, `:250`) that CONTEXT keeps. Two migration cases are already covered by `legacy-move.feature`; a break confirms it. The drafts total **52 new scenarios plus 3 new Outline rows**, in five owner files: `configuration.feature` (8 scenarios + 3 rows), `options.feature` (1), `legacy-move.feature` (16), `verdict-list.feature` (3), and `lifecycle.feature` (24, plus 1 optional). With the drafts appended, `npm run check:features`, `tsc`, ESLint, Prettier, and `npm run fallow` pass. All five owner files pass under both profiles (timings below).

**Tag finding (blocks a locked decision; see Open Question 1).** CONTEXT [Tags] and the ROADMAP note say the legacy-move and override scenarios carry `@adapter-only`. I measured every one of them under both profiles, and the result is byte-identical. The extension writes `mcp-adapter.json`, moves `mcp.json`, absorbs stubs, and stores choices the same way whatever implementation runs. The rules give two reasons to use `@mcp` for all of them. First, `features.md` defines `@adapter-only` as "the expectation holds only under pi-mcp-adapter". Second, success criteria 3 and 4 require that "the scenarios pass under both profiles", and the builtin profile excludes `@adapter-only` (`cucumber.json`: `(@mcp or @builtin-only) and not @adapter-only`). The one real divergence is the list row of a moved plugin whose only server needs an elicitation handler (MREC-03, D-P3-16). It is drafted as a licensed `@adapter-only`/`@builtin-only` pair. The existing `legacy-move.feature` scenarios are already `@mcp`.

**Breaks.** I ran 42 distinct breaks. 37 failed their target scenarios. Five survivors were ineffective edits, not coverage gaps: one hit the wrong arm, one the wrong sort site, and three were no-ops. Each was replaced by an effective break, which failed its target. One behavior has no break: a user-scope install that leaves the project files alone. It is guarded by a whole-scope check, and a break would have to add a project-file write to a user-scope stage.

**New steps: five, in four modules, all validated in tree.** They are a neutral environment-variable profile Pi (`mcp-implementation.steps.ts`), a "which warned" setup session (`session.steps.ts`), a legacy `mcp.json` text writer (`legacy-move.steps.ts`), and two `mcp-adapter.json` user edits (`lifecycle.steps.ts`). `fallow dupes` caught a 5-line clone between the new and the existing `legacy-move` Given. The validated code extracts a helper; see Code Examples.

**No product bug found.** One known backlog item shows: **MCPMIG-01** (`.planning/BACKLOG.md:4618`). The move reports a server that the plugin still declares, but that the resolver skipped as malformed, as `cause: "not-declared"`. The draft for that case pins today's behavior, so its scenario must name MCPMIG-01 in a comment, as the integration case does.

**Primary recommendation:** Three plans in one wave, split by feature file and step module, with no shared file between them: 05-01 (ITMIG-09), 05-02 (ITMIG-10), and 05-03 (ITMIG-11). Tag every scenario `@mcp` except the MREC-03 pair, and get the user's confirmation of that deviation from CONTEXT [Tags] first (Open Question 1).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- [Placement] Q: "Which feature file gets each case?" → Selected: "The existing `mcp-server/` file that already owns the behavior (research maps each case to its owner by file:line); a new file only when none does" — placement is reversible.
- [Tags] Q: "How are the scenarios tagged?" → Selected: "Install refusals and variable cases: `@mcp` when both implementations behave the same, else a licensed `@adapter-only`/`@builtin-only` pair with the licensing decision ID in a comment; legacy move and override cases: `@adapter-only` with the ID (AFILE-06, D-08-01, D-08-02, AMIG-01, AMIG-02, AMIG-04)" — follows the ROADMAP note and DUAL-02.
- [Earlier records] Q: "How do scenarios get records an earlier release wrote?" → Selected: "Through `features/lib/mcp-builtin-earlier-record.ts` and `features/lib/earlier-version-state.ts` (real released-build records); no hand-made record that no release wrote" — matches Phase 4's L01 approach.
- [Group B fields] Q: "The audit says no step reads `compatibilityBasis`, `mcpServerConfigs`, `resources.mcpServers`, `keptOverride`, or `serverChoices`; do scenarios read them?" → Selected: "No: a scenario checks what a user sees (notices, list rows, the `mcp-adapter.json` and `mcp.json` contents a user edits, server behavior); a check only a record field shows stays internal for Phase 8" — the user-visible contract.
- [Unchanged checks] Q: "How are 'leaves the file alone' and 'keeps the user's servers' proved?" → Selected: "With the whole file content (exact JSON or the whole-scope remembered/unchanged steps), never a sample of keys; Phases 2-4 reviews found narrow checks let regressions pass" — reuses existing steps.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "As in Phases 1-4: one reverted deliberate break per behavior, run under every profile the scenario selects, recorded in SUMMARY.md; already-covered cases get a break too" — test approach only.
- [Deletion] Q: "What happens to the seven files?" → Selected: "`mcp-home-path-partial` and `mcp-tool-rules` are deleted; the others keep only their internal cases with a header saying what they keep and why, or are deleted if none remains; helpers no remaining case uses go" — git history keeps the rest.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it when small, with a unit test beside its source pair and a CHANGELOG parent line; otherwise a BACKLOG.md entry and the guarding integration case stays" — milestone rule.
- [Parallelism] Q: "How are plans split?" → Selected: "By feature-file ownership so plans in a wave touch disjoint files; a shared step module or `features/lib/**` file changes in only one plan per wave; plans in one wave share the 4 CPUs (`--parallel 1` or a shared flock for heavy runs)" — wave layout is local to the plan.

### Claude's Discretion
- Scenario titles, step wording, tables; break edits; plan count and waves.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITMIG-09 | Scenarios cover the MCP install refusals and warnings: a literal `~/` in stdio args refused as `{unsupported mcp}` and left out under `--partial`, the warning that tool permission rules are not enforced, AVAR-04 notices on update, reinstall, and enable, AVAR-05 (a deny-listed credential withheld with a notice), `${CLAUDE_PROJECT_DIR}`, `!` escaped to `!!`, a secret value kept out of `mcp-adapter.json`, and D-PG10-11 entries holding a reference and no option value in all five fields. | Drafts `probe/final-configuration.feature` (8 scenarios, `@mcp`) and `probe/final-options.feature` (1, `@mcp`), plus three Outline rows for `configuration.feature:441` and `:479`. Breaks M1-M10, M3b, M3c, and M9b fail them under both profiles. |
| ITMIG-10 | Scenarios cover the legacy `mcp.json` move: the install-time sweep (AMIG-02), one notice for both scopes with project rows first, AMIG-04 unowned-entry warnings, undeclared/unsupported/malformed entries, a plugin that lists as partially installed after the move, a cold clone cache, the stub notice, the user-scope stub removed from the project file, a user-scope install that leaves the project `mcp-adapter.json` alone, and the `list` row of a legacy record with no MCP trace. | Drafts `probe/final-legacy-move.feature` (16, `@mcp`) and `probe/final-verdict-list.feature` (an MREC-03 `@adapter-only`/`@builtin-only` pair, plus 1 `@mcp`). Breaks L1-L13, L6b, L12b, V1, V2, and V3b. |
| ITMIG-11 | Scenarios cover the pi-mcp-adapter override cases: a project install that keeps a user stub and writes it back on uninstall, a user plugin disabled in the project, an `/mcp-adapter enable` that survives, an update that drops a server and a later version that restores its choice, `openUi` and trace kept on reinstall, carried fields written back with the values at uninstall, the ANAME-07 stub timeout, a foreign `serverChoices` key left alone, and an emptied stub removed. | Draft `probe/final-lifecycle.feature` (24, `@mcp`, in `lifecycle.feature`'s own Background), plus the optional `probe/final-lifecycle-extra.feature` (1). Breaks O1, O2b, O3-O6, O7b, O8a, O8b, and O9. |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Read a file before editing it and trace callers before changing a function. Never commit to `main`. Update by merging, never rebase. Commit per `.agents/skills/committing/SKILL.md`, and never use `--no-verify`.
- Every plan `SUMMARY.md` has `## Threat Flags`, even when the answer is "None".
- GSD gates run `npm run check` on the combined tree. Inside `.claude/worktrees/...` the hook may check nothing, so run `npm run check:static` and the touched scenarios by hand before you commit.
- **Upstream parity:** these cases pin project decisions, not Claude Code behavior, except the AVAR-* variable rules, which follow Claude Code's expansion and its deny list. Scenarios name the decision IDs in their titles (precedent: the ID in parentheses at the end). The IDs used here: AVAR-02..05, ANAME-07, D-PG10-11, D-PG10-20, AMIG-01..04, MREC-02, MREC-03, D-P3-16, D-CF6-02, AFILE-06, D-08-01, D-08-02, and MCPMIG-01 (comment only).
- **Parent lines:** no phase edits `CHANGELOG.md`, `.planning/BACKLOG.md`, or the PROJECT.md Key Decisions table. No CHANGELOG line is needed: no product change.
- **fallow audit:** each deleted or trimmed integration file gives a `weakened-tests` warn. Record it and move on; do not change `.fallowrc.json` or the CI workflows (user decision, STATE.md).
- **Environment:** prefix npm with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Cucumber runs use `npm run test:cucumber:profile -- --profile <adapter|builtin> --parallel 2 <files>`.
- **Cucumber rules that bit this research:** no scenario may reach the network. The integration fixtures used `example.test` hosts, and the drafts use the suite's loopback discard port `127.0.0.1:9` instead (`configuration.feature:46`; a re-run was green). An `@mcp` scenario never names `pi-mcp-adapter` in a step, cell, or doc string. A Given never follows a When. Every new step must be used (`check:features`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Home-path (`~/`) refusal of a stdio server (AVAR-03) | Domain: `domain/mcp-server-features.ts:469-476` (`leadingHomeFeature`) | resolver `--partial` gate | Both implementations block the feature, so the result is the same |
| Tool permission rules not enforced (ANAME-07) | Domain: `domain/mcp-server-features.ts:429-448` (`unenforcedToolRules`) | notice `tool-rules-unenforced` | Stage drops the fields and reports them |
| Claude variable rule, deny list, `!` escape (AVAR-02/04/05) | Domain: `domain/claude-mcp-variables.ts:96-212` | `bridges/mcp/adapter-escape.ts:120` (`!`→`!!`), `shared/session-env.ts:121-140` (Pi's `CLAUDE_PROJECT_DIR`), `orchestrators/mcp/builtin-registration-step.ts:262` (the built-in's project dir) | The file is written the same under both implementations; the server-side values differ by implementation |
| Option references (D-PG10-11) | `bridges/mcp/substitute.ts:69` (`optionForm: reference`) | `domain/claude-mcp-variables.ts:226-235` | The adapter file holds references; the built-in holds values in memory |
| AVAR-04 notices after rows | `orchestrators/plugin/update-flow.ts:634-646`, `reinstall-flow.ts:610-621`, `enable-disable.ts:2690-2692` | `shared/notification-dispatch.ts` | Each verb emits its rows, then the notices |
| Install-time sweep (AMIG-02) | `bridges/mcp/stage.ts:604-627`, `:863` (`removeLegacy`) | `bridges/mcp/legacy.ts:153-182` (`isLeftover`, `leftoverNames`) | A staging command finishes the move in its own scope |
| Load move, rows, ownership, cold clone | `orchestrators/reconcile/mcp-migration.ts` (`reportUnowned` :261-265, `missKind` :368-374, removal causes :660-684, `applyNeutralVerdict` :569-600) | `bridges/mcp/legacy.ts:270-300` (project stubs), `shared/notification-resolve.ts:1043-1045` (row order) | One notice for both scopes |
| Legacy-record list verdict (MREC-02, MREC-03) | `orchestrators/plugin/mcp-verdict-read.ts:45-70` | `orchestrators/mcp/recorded-servers.ts:115-136` | Read at list time per implementation |
| Override absorption and write-back (AFILE-06) | `bridges/mcp/stage.ts:651` (`keptOverrides`), `bridges/mcp/adapter-doc.ts:263-379` | `bridges/mcp/adapter-entry.ts:468-484` (`restoredOverride`) | The marker keeps the user's stub |
| Stored choices (D-08-02) | `bridges/mcp/adapter-doc.ts:489-689` (`ownedChoiceOf`, `storedChoicesFor`, `capturedChoices`, `withPluginServersKeepingChoices`) | `stage.ts:637-650` | Top-level `_piClaudeMarketplace.serverChoices` |
| Behavioral proof | the five owner feature files | four step modules | Test tier |

## Standard Stack

No packages are installed. The phase uses the harness already in the repo.

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` via `scripts/cucumber.mjs` | `^13.3.0` `[VERIFIED: package.json:19]` | Profiles `adapter` (`not @builtin-only`) and `builtin` (`(@mcp or @builtin-only) and not @adapter-only`) `[VERIFIED: cucumber.json]` |
| pi-mcp-adapter (optional peer, test cache) | 7.0.1 `[VERIFIED: node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/package.json]` | The adapter profile's implementation |
| Node | v24.22.3 | Runtime `[VERIFIED: node --version]` |
| `node:test` | built in | The cases left in the integration files |

## Package Legitimacy Audit

None. The phase installs no external package.

## Architecture Patterns

### How a scenario reaches the behavior

```
Given publish dir marketplace ─► plugin files (.mcp.json / plugin.json with userConfig, via "has the file ... with these stub mcp servers:")
   ─► added to user/project scope ─► (optional) profile Pi with an env var  [NEW neutral step]
   ─► user files: mcp-adapter.json fields/whole text [NEW], mcp.json as release 0.19.2 wrote it (from a record, existing) or by text [NEW]
   ─► earlier-release record: "rewritten as release \"0.19.2\" wrote it" | "has no recorded mcp servers, as an earlier release wrote it"
   ─► (optional) cached git clones deleted | user enable [NEW] | setup session that warned [NEW]
When /claude:plugin install|update|reinstall|enable|disable|uninstall|apply|list  OR  the user starts a new pi session (load = AMIG-01 move)
   ─► "the command reports these results:" / "the session reports these results:" (kind, severity, needs reload, notices JSON, rows JSON)
   ─► "the results list these marketplaces and plugins:" ─► whole text of mcp-adapter.json / mcp.json ─► whole-scope remembered/unchanged
```

The extension writes `mcp-adapter.json` under both profiles. Install, sweep, move, absorb, and choice-store results are identical (measured, with a byte diff of dumped payloads and files per scenario). This is why the drafts are `@mcp`.

### Case inventory: what each integration case asserts, and what replaces it

Draft lines refer to the files in `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/research-05/probe/`. Break IDs refer to the break table. "Visible" means user-visible under CONTEXT [Group B fields].

**`mcp-home-path-partial.test.ts` (2 cases, delete the file)**

| Case | Asserts | Visible | Replacement (`final-configuration.feature`) | Breaks |
|---|---|---|---|---|
| `:40` | error cascade, row `partially-available {unsupported mcp}` hint `partial-install`, no `mcp-adapter.json` | yes | `:6` "A normal install of a plugin whose stdio server argument starts with a home path refuses with the --partial hint and writes nothing (AVAR-03)": the whole project scope is unchanged | M1 (both profiles) |
| `:69` | `--partial` writes only `plugin_hello_local_`, row `partially-installed {unsupported mcp}`; record fields (internal) | yes (record part internal, dropped) | `:27` "An install with --partial leaves out the stdio server whose argument starts with a home path (AVAR-03)" | M1 (both) |

**`mcp-tool-rules.test.ts` (1 case, delete the file)**

| `:23` | the http entry without the rule fields, installed, notice `tool-rules-unenforced` with both fields, no rule values in notices | yes | `:76` "An install of a remote server with tool permission rules writes it without them and warns that they are not enforced (ANAME-07)" | M2 |
|---|---|---|---|---|

**`mcp-variable-expansion.test.ts` (6 cases, delete the file)**

| Case | Asserts | Replacement | Breaks |
|---|---|---|---|
| `:42` AVAR-02 | plugin root and `CLAUDE_PROJECT_DIR` expanded at project scope, `${UNSET}` and `${X:-info}` kept, the set secret `${PI_CM_AVAR_TOKEN}` kept as a reference, `MODE: !!fast`, `variables-missing` for the unset one | `final-configuration.feature:117` (whole `mcp-adapter.json` + results). Plus Outline rows: `${CLAUDE_PROJECT_DIR}` → `{project dir}:echo:ping` and `!echo pwned` → `!echo pwned:echo:ping` in the adapter Outline (`configuration.feature:441-444`), and `${CLAUDE_PROJECT_DIR}` in the builtin Outline (`:479-485`). These rows prove the value **reaches the server** under each implementation | M3, M4, M5 (A4); M3b (adapter row), M3c (builtin row), M4 (adapter `!` row) |
| `:124` AVAR-05 | headers `"Bearer "` and `""`, no sentinel in the file or notices, `credentials-blanked` | `:176` (`ANTHROPIC_API_KEY` set through the NEW neutral profile step) | M6 (both) |
| `:186` D-PG10-11 | five fields hold `${PI_CLAUDE_MARKETPLACE_OPTION_<hex>}`, `auth: "oauth"`, no "sentinel" | `final-options.feature:12` (whole file text: hashes `6a5842ad7e4c0fc9`, `34f6bcb3de70f47b`, `3a682b5e5419c027`, `d67d32b4704c49d5`, `79e27a896a32f1b0`) | M7 (both; under adapter it also fails `options.feature:221`, `:469`, `:499`, `:561`) |
| `:317` update | rows, then `variables-missing`, then `credentials-blanked` | `:222` | M8 (both), M5, M6 |
| `:365` reinstall | same | `:248` | M9b (both), M5, M6 |
| `:403` enable | same | `:271` | M10 (both), M5, M6 |

**`mcp-legacy-sweep.test.ts` (4 cases, delete the file)**, all in `final-legacy-move.feature`:

| Case | Replacement | Breaks |
|---|---|---|
| `:87` sweep: marked entry and old-name `{disabled}` stub go, `other` stays, `mcp.json` becomes `{"mcpServers": {}}`, `leftover-removed` warning | `:6` | L1, L2 |
| `:116` direct-tools copy removed, marker-less `keep` stub stays (also warns `leftover-removed`, measured) | `:73` | L1, L2, L3 |
| `:143` user's own full server under the old name stays, no notice | `:140` | L1, L4 |
| `:171` user-scope install leaves the project `mcp-adapter.json` unchanged | `:205` (whole project scope remembered/unchanged + user files' text) | L1 (user half); **no break for the project half** (see gaps) |

**`mcp-migration.test.ts` (14 cases; keep `:749`)**

| Case | Replacement | Breaks |
|---|---|---|
| `:151` move to the fresh-install bytes | **already covered**: `legacy-move.feature:8`, `:247` (whole `mcp-adapter.json` text equals a fresh install's) | L1 fails all six existing `legacy-move.feature` scenarios |
| `:185` second load idempotent | **already covered**: `legacy-move.feature:136` | L1 |
| `:201` one notice, project rows first | `final-legacy-move.feature:266` | L6b |
| `:229` tool rules in the move notice (warning) | `:284` | M2 |
| `:297` unowned entry stays, warning | `:323` (whole project scope unchanged; the `unowned` row appears twice, as Pi's RPC `new_session` binds twice; `session.steps.ts:206-208` states this) | L7a (both) |
| `:314` a user record does not own a project entry | `:343` | L7a (both) |
| `:337` declared owner: apply installs and sweeps, no unowned warning | `:364` (`/claude:plugin apply --scope project`) | L7b, L1 |
| `:448` git plugin, cold clone cache: left, "reinstall" | `:699` (`source-unreadable` row twice; whole project scope unchanged) | L8 |
| `:448` warm half | `:422`: the reinstall the notice names moves the entries (whole `mcp.json`) | L1 |
| `:509` undeclared removed, ws dropped, rest moved | `:458` (republish trick: declare `gone`, write the 0.19.2 `mcp.json`, then drop `gone` from `.mcp.json`; strip records with the MREC-02 step) | L9 |
| `:580` malformed plugin.json: all old entries removed, none written | `:521`. Its second half, a fresh install refusing `{malformed mcp}`, is covered by `invalid-configs.feature:69` | L1, L10 |
| `:640` malformed sibling skipped | `:561` (pins `cause: "not-declared"`, MCPMIG-01) | L1 |
| `:682` stub removed in the move → warning | `:618` | L2, L12b |
| `:713` user-scope move removes the project stub | `:665` | L2, L12b, L13 |
| `:749` refused write between the two writes | **stays** (fault injection, REQUIREMENTS Out of Scope) | — |

**`mcp-verdict-migration.test.ts` (4 cases; keep 3)**

| Case | Disposition |
|---|---|
| `:117`, `:149`, `:250` | **stay** (released-build record cases, CONTEXT) |
| `:210` moved legacy plugin lists as partially installed under the adapter | `final-verdict-list.feature:6` (`@adapter-only`: `partially-installed`, `unsupported mcp, requires builtin mcp`) and `:35` (`@builtin-only`: `installed`), both MREC-03/D-P3-16. Breaks V1 (adapter half), V3b (builtin half) |

**`mcp-verdict-list.test.ts:139`** (ITMIG-10, ROADMAP "takes the legacy-record list row"): replaced by `final-verdict-list.feature:64` (`@mcp`, release 0.19.2 record of a plugin installed with no server, which later declares an sse server; lists `installed` under both). Break V2 (builtin) fails it. Delete that case; the file keeps `:57` and `:97` for Phase 8.

**`mcp-override-lifecycle.test.ts` (12 cases, delete the file)**, all in `final-lifecycle.feature`:

| Case | Replacement | Breaks |
|---|---|---|
| `:46` project install keeps the override, uninstall writes it back byte for byte | `:14` (install text + `override-kept` `["env"]`), `:76` (uninstall text = the user's original) | O8a |
| `:117` user plugin disabled in the project through install, update, reinstall, uninstall; user file unchanged | `:117`, `:175`, `:236`, `:294` (each also checks the whole user scope unchanged); optional `final-lifecycle-extra.feature:17` for the final user re-install with no kept override | O8a (all), O8b (`:175`, `:236`), O9 (`:175`, `:236`) |
| `:329` `/mcp-adapter enable` survives disable, enable, uninstall | `:331`, `:365`, `:421` (NEW user-enable step) | O2b, O8a |
| `:412` no write-back of a carried field only the plugin declares | `:455` (install), `:507` (uninstall writes back `{"disabled": true}` only) | O8a |
| `:458` ANAME-07 stub timeout | `:538` (install: plugin's 60000 applies, `pluginSetFields`, `keptOverride`, notice `["requestTimeoutMs"]`), `:584` (after enable, uninstall writes back `{"requestTimeoutMs": 5000}`) | O3, O2b, O8a |
| `:555` disabled and openUi survive uninstall then reinstall | `:616`, `:655` | O4, O5 |
| `:671` disabled and trace survive disable (twice) then enable | `:706`, `:745` (second disable: `skipped` / `already disabled`, file unchanged), `:785` | O4, O5 |
| `:727` update drops server, a later one restores it | `:836`, `:881` | O4, O5 |
| `:786` reinstall keeps openUi and trace | `:947` | O9 |
| `:823` ×2 foreign choice neither applied nor removed | `:997`, `:1055` | O6 (applied), O7b (removed) |
| `:864` emptied stub removed on uninstall | `:1113` | O1, O2b |

The whole-file checks include `_piClaudeMarketplace.keptOverride` and `.serverChoices` because they are part of the file. They are not record (`state.json`) checks. No case in these files asserts those fields except through the file text (see Open Question 2).

**Counts.** 2 + 1 + 6 + 4 + 14 + 4 + 12 + 1 = 44 cases. Delete 40. Keep 4: `mcp-migration:749` and `mcp-verdict-migration:117`, `:149`, `:250`. Delete five files: `mcp-home-path-partial`, `mcp-tool-rules`, `mcp-variable-expansion`, `mcp-legacy-sweep`, and `mcp-override-lifecycle`.

### Helpers after the trim (tsc `noUnusedLocals` will flag the rest)

- `mcp-migration.test.ts` keeps `:749` with `reload`, `APPLY_EMPTY_NOTICE`, `COST_LINE`, `adapterKeys`, `markedLegacyNames`, `lockedLink`, `scopeBytes`, `seedLegacyMcpInstall`, `makeCtx`, `NotifyRecord`, `TestContext`, and the chmod-denial imports. These go: `access`, `canonicalCloneUrl`, `pluginCloneKey`, `parsePluginSource`, `pathSource`, `createInstallOperation`, `getPluginInfo`, `saveConfig`, `saveState`, `noStatusReaders`, `seedMcpPlugin`, `MARKER`, `declareServers`, `seedLegacyNames`, `writeProjectLegacyEntry`, `UNOWNED_PROJECT_NOTICE`, `RECORDED_SHA`, and `seedGitPluginRecord`. The new header says the file keeps the refused-write recovery as an internal fault-injection case (ITSCOPE-01), and that `features/mcp-server/legacy-move.feature` covers everything a user can see.
- `mcp-verdict-migration.test.ts` drops `:210`. `listText` stays, because `:250` uses it for `builtin`. `MCP_INVENTORY.adapter`, `adapterCommand`, and `adapterProxyTool` go.
- `mcp-verdict-list.test.ts` drops `:139`, and its `saveState` import goes, because only that case uses it.
- `mcp-plugin-seed.ts`, `test/platform/mcp-status-seed.ts`, and `test/chmod-denial.ts` stay: other tests import them (grep this session).

### Existing steps used (file:line)

| Step | Module |
|---|---|
| `the published plugin {string} of the marketplace {string} has the file {string} with these stub mcp servers:` | `mcp-server/listing.steps.ts:104` (a raw `{"mcpServers": ...}` writes non-stub servers as written) |
| `... declares the mcp server {string}` | `mcp-configuration.steps.ts:95` (writes `{command: "pi-features-absent-mcp-server", args: []}`) |
| `... has the file {string} with this text:` | `plugin/publishing.steps.ts` (plugin.json, `userConfig`) |
| `the mcp.json file of the {word} scope holds the servers of the plugin {string} as release 0.19.2 wrote them, beside the user's own server {string}` | `mcp-configuration.steps.ts:171` (reads the record's `resolvedSource`, so the plugin must be installed in that scope; it strips the plugin's adapter entries) |
| `the user has written these fields on the mcp server {string} in the mcp-adapter.json file of the {word} scope:` / `the user has disabled ...` | `mcp-server/lifecycle.steps.ts:50` / `:32` (merge into the entry, pretty-printed) |
| `the installation record of the {word} scope is rewritten as release {string} wrote it` | `plugin/installation.steps.ts:413` (release 0.19.2 drops `compatibilityBasis`, `mcpServerConfigs`, `mcpBundle`, `userConfig`, `provenance`; `features/lib/earlier-version-state.ts:206-221`) |
| `the installation record of the plugin {string} in the {word} scope has no recorded mcp servers, as an earlier release wrote it` | `mcp-server/implementation-switch.steps.ts:37` |
| `the cached clones of git plugins in the {word} scope are deleted` | `plugin/installation.steps.ts:331` |
| `the git repository {string} holds these plugins:` / `adds this .mcp.json to the plugin {string}:` / `the marketplace {string} offers these plugins from git repositories:` | `plugin/publishing.steps.ts:84`, `mcp-server/verdict-fetch.steps.ts:17`, `plugin/publishing.steps.ts:181` |
| `a config in scope {word} and layer {word}, with these plugins:` | `config.steps.ts:161` |
| `the files of the {word} scope are remembered` / `... are unchanged` | `scope-state.steps.ts:64` / `:71` (throw if the scope root is missing) |
| `the command reports these results:` / `the session reports these results:` / `the results list these marketplaces and plugins:` / `the result has these fields:` / `the result lists these plugins:` | `command.steps.ts:198`, `session.steps.ts:209`, `command.steps.ts:239`, `:158`, `:166` |
| `the mcp configuration file {string} of the {word} scope holds this text:` | `mcp-configuration.steps.ts:191` |

### New steps (validated in tree: `tsc`, ESLint, Prettier, `check:features`, `npm run fallow` all exit 0)

| # | Text | Module | Owner plan | Used by |
|---|---|---|---|---|
| S1 | `pi runs with the scripted model, the mcp implementation, and the environment variable {string} set to {string}` | `mcp-implementation.steps.ts` (shared module, named in the plan) | 05-01 | AVAR-02 (secret set), AVAR-05, the 3 AVAR-04 scenarios |
| S2 | `the user has started a new pi session, which warned` | `session.steps.ts` (shared) | 05-02 | the MREC-03 pair |
| S3 | `the mcp.json file of the {word} scope holds this text, as release 0.19.2 wrote it:` | `mcp-server/legacy-move.steps.ts` (with the `mcpJsonText` helper that the existing Given now shares) | 05-02 | sweep d1-d4, unowned d9/d10, apply d11 |
| S4 | `the user has enabled the mcp server {string} in the mcp-adapter.json file of the {word} scope` | `mcp-server/lifecycle.steps.ts` | 05-03 | `:331`, `:365`, `:421`, `:584`, `:1113` |
| S5 | `the user has written the mcp-adapter.json file of the {word} scope with this text:` | `mcp-server/lifecycle.steps.ts` | 05-03 | `:997`, `:1055` |

The harness does **not** drive `/mcp-adapter enable`. pi-mcp-adapter 7.0.1's `writeProjectServerDisabledOverride` (`config.ts:2005-2050` in the peer) is a JSON rewrite: "Persist only the disabled field in the project Pi layer". S4 reproduces it, as `lifecycle.steps.ts:27-38` reproduces disable. Driving the real command would need a new driver in `features/lib/` (`runCommandPayloads` requires a `claude-plugin` payload, `pi-commands.ts:133-142`), so it is not recommended.

### Ready-to-apply patch

`research-05/intree-final.diff` (2,411 lines added) holds exactly the validated in-tree state: the five owner feature files with the drafts appended (loopback hosts), the three Outline rows, and the four step modules. An executor can `git apply` the hunks of its own plan's files and then write the feature descriptions and the MCPMIG-01 comment. `research-05/steps.diff` holds the step changes alone. The drafts' Then tables were generated from measured payloads, so they state every row and the whole file text.

### Anti-patterns to avoid

- **`@adapter-only` on a scenario that holds under both profiles.** It drops the builtin run that success criteria 3 and 4 require. Use it only for the MREC-03 list rows.
- **An `example.test` URL.** Use `https://127.0.0.1:9/...` (measured green with identical texts).
- **A whole-text check of a file that holds a git clone path.** The `plugin-clones/<key>` key hashes the run's git host URL, whose port changes every run. The cold-cache scenario uses the whole-scope remembered/unchanged steps, and the reinstall scenario checks `mcp.json` only.
- **The lifecycle Background's stub server in a whole-text check.** Its entry holds `/opt/node24/bin/node` and the repo path (measured). Override drafts replace `.mcp.json` with an absent-command server, as `lifecycle.feature:403` does.
- **`the user has started a new pi session` before a list after the move.** It refuses warnings. Use S2.
- **S3 in a scope with no `.pi`.** The validated S3 creates the directory. `writeScenarioFile` does not (`features/lib/scenario-file.ts:12-20`); the first in-tree run failed there.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| An earlier-release record | a hand-written legacy `state.json` | `rewriteStateAsRelease` (`plugin/installation.steps.ts:413`) or `dropRecordedMcpServers` (`implementation-switch.steps.ts:37`) | CONTEXT [Earlier records]; real release shapes |
| A 0.19.2 `mcp.json` for an installed plugin | a text writer | `mcp-configuration.steps.ts:171` | It also strips today's adapter entries, as the upgrade state was |
| A server the plugin no longer declares | a hand-edited marker | republish `.mcp.json` with it, write the 0.19.2 file, republish without it (`final-legacy-move.feature:458`) | Keeps the legacy file in its release shape |
| `/mcp-adapter disable` / `enable` | a pi-mcp-adapter driver | `lifecycle.steps.ts:32` / S4 | Same bytes as the peer's writer |
| "Changes no file" | narrow byte checks | `the files of the {word} scope are remembered/unchanged` | Phase 2-4 reviews |
| Seeing actual output while drafting | guessing tables | a scratch dump step (`research-05/steps/probe-dump.steps.ts`) and the `gen*.py` generators | Every table was generated from measured payloads |

## Runtime State Inventory

Not a rename or migration phase. Nothing is renamed; the phase adds scenarios and deletes or trims tests. No stored data, live service config, OS registration, secret, or build artifact changes.

## Common Pitfalls

### Pitfall 1: The tag decision vs the skill
**What goes wrong:** `@adapter-only` on legacy and override scenarios passes `check:features`, because the title names an ID. But those scenarios never run under `builtin`, so the success criteria's "pass under both profiles" is not met.
**How to avoid:** Use `@mcp` (Open Question 1). The measured equality is the license.

### Pitfall 2: Pi reports a lasting load warning twice
`the session reports these results:` must state both `unowned` and `source-unreadable` rows (Pi's RPC `new_session` binds the extension twice; `pi-commands.ts:159-163`). The drafts already do.

### Pitfall 3: A user-scope `${CLAUDE_PROJECT_DIR}` is not expanded at install
At user scope the entry keeps the reference, and the server reads Pi's process variable (`shared/session-env.ts:100-104`). Under the built-in, registration expands it from `session.cwd` (`builtin-registration-step.ts:262`). So the domain break M3 fails only the project-scope file check. The Outline rows need M3b (adapter) and M3c (builtin) to fail.

### Pitfall 4: A break that does not reach the scenario's path
M9 (`reinstall-flow.ts:360`) is the single-target arm, but `reinstall demo@fixtures` uses `surfaceReinstallMcpConfigNotices` (`:610-621`); M9b is the effective break. `load.ts:103` `SCOPES` is not the row order; the order is the sort at `notification-resolve.ts:1043` (L6b). Record both in SUMMARY.

### Pitfall 5: `fallow dupes` on step code
The new legacy-move Given at first repeated 5 lines of the existing one. `npm run fallow` failed with `duplication-findings`. The validated version extracts `mcpJsonText` (Code Examples). Run `npm run fallow` after any step module change.

### Pitfall 6: CPU sharing
Three executors in one wave on 4 CPUs: use `--parallel 1` per executor, or run the heavy owner files one at a time. Measured in-tree times at `--parallel 2` with no other load are under 30 s per file and profile (table below).

### Pitfall 7: Break verify commands
A failed scenario prints as `  N) <title> # <file>:<line>`. A `file:line` filter must point at a `Scenario:` line, and the run must not print `0 scenarios`.

## Code Examples

The four modules' additions as validated in tree (`research-05/steps.diff`). Imports are verified by `tsc`: `writeLaunchEnvironment`, `readAppliedLaunchEnvironments`, and `PI_LAUNCH_ENVIRONMENT_EXTENSION` (`features/lib/pi-launch-environment.ts:25`, `:49`, `:64`); `mcpImplementationLaunch` (`features/lib/mcp-implementation.ts:155-159`); `writeScenarioFile` (`features/lib/scenario-file.ts:12`); `isPlainObject` (`features/lib/field-rows.ts:25`, returns `value is object`).

```ts
// mcp-implementation.steps.ts (S1). Imports add `rm` and the three launch-environment names.
// A profile Pi's environment is fixed when it starts, so a command that reads
// a variable, such as an install that withholds a credential (AVAR-05), runs
// in a Pi started with it. The variable is never set in this worker.
Given(
  "pi runs with the scripted model, the mcp implementation, and the environment variable {string} set to {string}",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, variable: string, value: string) {
    const variables = { [variable]: value };
    const launch = mcpImplementationLaunch(this.mcpProfile);
    const file = await writeLaunchEnvironment(this.tokens.home, variables);
    this.onRelease(() => rm(file, { force: true }));
    await this.usePiWithProfile({
      ...launch,
      extraExtensions: [...launch.extraExtensions, PI_LAUNCH_ENVIRONMENT_EXTENSION],
    });
    assert.deepStrictEqual(await readAppliedLaunchEnvironments(this.profileHarness()), [variables]);
  },
);

// session.steps.ts (S2), placed before `When("the user starts a new pi session", ...)`.
Given("the user has started a new pi session, which warned", async function (this: ScenarioWorld) {
  const { payloads } = await startSession(this.pi);
  assert.notDeepStrictEqual(payloads, []);
  assert.deepStrictEqual(
    payloads.filter((payload) => payload.severity !== "warning"),
    [],
  );
});

// legacy-move.steps.ts (S3 + the shared helper; the existing Given now calls it too, which fallow requires).
function mcpJsonText(
  world: ScenarioWorld,
  scope: string,
  text: string,
): { readonly file: string; readonly expanded: string; readonly markedNames: string[] } {
  const file = path.join(world.scopeRoot(scope), "mcp.json");
  const expanded = expandTokens(text, world.tokens);
  const doc: unknown = JSON.parse(expanded);
  const servers: unknown = isPlainObject(doc) ? Reflect.get(doc, "mcpServers") : undefined;
  assert.ok(isPlainObject(servers), `the text for ${file} holds no mcpServers object`);
  const markedNames = Object.keys(servers).filter((name) => {
    const entry: unknown = Reflect.get(servers, name);
    return isPlainObject(entry) && "_piClaudeMarketplace" in entry;
  });
  return { file, expanded, markedNames };
}
//   existing Given body becomes:
//     const { file, expanded, markedNames } = mcpJsonText(this, scope, text);
//     assert.strictEqual(expanded, `${JSON.stringify(JSON.parse(expanded), null, 2)}\n`);
//     assert.deepStrictEqual(markedNames, []);
//     await writeScenarioFile(this, file, expanded);
Given(
  "the mcp.json file of the {word} scope holds this text, as release 0.19.2 wrote it:",
  async function (this: ScenarioWorld, scope: string, text: string) {
    const { file, expanded, markedNames } = mcpJsonText(this, scope, text);
    assert.notDeepStrictEqual(markedNames, [], `the text for ${file} holds no marked server`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeScenarioFile(this, file, expanded);
  },
);

// lifecycle.steps.ts (S4, S5). Imports: mkdir, readFile, writeFile; expandTokens; writeScenarioFile.
// pi-mcp-adapter 7.0.1's `/mcp-adapter enable <key>` removes `disabled` from
// the entry under the key and keeps every other member, the marker included.
Given(
  "the user has enabled the mcp server {string} in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const doc: unknown = JSON.parse(await readFile(file, "utf8"));
    const servers: unknown = isRecord(doc) ? doc.mcpServers : undefined;
    assert.ok(isRecord(doc) && isRecord(servers), `${file} holds no mcpServers object`);
    const entry = servers[key];
    assert.ok(isRecord(entry) && entry.disabled === true, `${key} is not disabled in ${file}`);
    const enabled = Object.fromEntries(
      Object.entries(entry).filter(([field]) => field !== "disabled"),
    );
    const text = `${JSON.stringify({ ...doc, mcpServers: { ...servers, [key]: enabled } }, null, 2)}\n`;
    await writeFile(file, text);
    assert.strictEqual(await readFile(file, "utf8"), text);
  },
);

Given(
  "the user has written the mcp-adapter.json file of the {word} scope with this text:",
  async function (this: ScenarioWorld, scope: string, text: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    await mkdir(path.dirname(file), { recursive: true });
    await writeScenarioFile(this, file, expandTokens(text, this.tokens));
  },
);
```

A representative draft (`final-legacy-move.feature:6`, green under both profiles):

```gherkin
  @mcp
  Scenario: An install removes the plugin's marked mcp.json entry and the disable stub under its old name, keeps the user's own server, and says so (AMIG-02)
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" declares the mcp server "srv"
    Given the marketplace "fixtures" is added to the project scope
    Given the mcp.json file of the project scope holds this text, as release 0.19.2 wrote it:
      """
      {"mcpServers": {"srv": {"command": "pi-features-absent-mcp-server", "args": [], "_piClaudeMarketplace": {"plugin": "demo", "marketplace": "fixtures"}}}}
      """
    Given the user has written these fields on the mcp server "srv" in the mcp-adapter.json file of the project scope:
      """
      {"disabled": true}
      """
    Given the user has written these fields on the mcp server "other" in the mcp-adapter.json file of the project scope:
      """
      {"command": "pi-features-users-own-mcp-server"}
      """
    When the user runs "/claude:plugin install demo@fixtures --scope project"
    Then the command reports these results:
      | kind               | severity | needs reload | notices                                                                                                |
      | cascade            | info     | true         |                                                                                                        |
      | mcp-config-notices | warning  | false        | [{"kind":"leftover-removed","scope":"project","file":"mcp-adapter.json","plugin":"demo","server":"srv"}] |
    Then the results list these marketplaces and plugins:
    ...
    Then the mcp configuration file "mcp-adapter.json" of the project scope holds this text:   (other + plugin_demo_srv_)
    Then the mcp configuration file "mcp.json" of the project scope holds this text:           ({"mcpServers": {}})
```

## Deliberate breaks (each applied, run, and reverted in this session)

Each edit is an exact-substring replacement that matched once. The definitions are in `research-05/breaks.py`, the runners in `brk.sh` and `brk2.sh`, and the logs in `research-05/logs/brk-*.log` and `batch*.log`. Paths are relative to `extensions/pi-claude-marketplace/`. G means `&& process.env.NEVER_SET === "x"`. Unless noted, each break ran under the adapter profile. Draft lines are in the probe files; owner-file lines are in-tree.

| ID | Site | Edit | Failed |
|---|---|---|---|
| M1 | `domain/mcp-server-features.ts:476` args `~` | `return undefined;` | cfg `:6`, `:27` (adapter and builtin) |
| M2 | same file `:443` `toolPermissions` push | add G | cfg `:76`; lm `:284` |
| M3 | `domain/claude-mcp-variables.ts:105` `${CLAUDE_PROJECT_DIR}` replace | `: withRoot;` | cfg `:117` (adapter and builtin) |
| M3b | `shared/session-env.ts:138` | `CLAUDE_PROJECT_DIR = "/nowhere"` | the adapter Outline `${CLAUDE_PROJECT_DIR}` row |
| M3c | `orchestrators/mcp/builtin-registration-step.ts:262` | `projectDir: "/nowhere",` | the builtin Outline `${CLAUDE_PROJECT_DIR}` row |
| M4 | `bridges/mcp/adapter-escape.ts:120` | `return written;` | cfg `:117` (both); the adapter `!echo pwned` row |
| M5 | `domain/claude-mcp-variables.ts:211` `missing.push` | delete | cfg `:117`, `:222`, `:248`, `:271` |
| M6 | same file, the `isDenied` branch | add G | cfg `:176`, `:222`, `:248`, `:271` (both) |
| M7 | `bridges/mcp/substitute.ts:69` | `optionForm: { kind: "text" }` | opt `:12` (both); `options.feature:221`, `:469`, `:499`, `:561` (adapter) |
| M8 | `orchestrators/plugin/update-flow.ts:645` | drop `...notices` | cfg `:222` (both) |
| M9 | `orchestrators/plugin/reinstall-flow.ts:360` | `[]` | **nothing**: that arm is not reached (Pitfall 4) |
| M9b | `reinstall-flow.ts:619` | `[]` | cfg `:248` (both) |
| M10 | `orchestrators/plugin/enable-disable.ts:2692` | `[]` | cfg `:271` (both) |
| L1 | `bridges/mcp/stage.ts:863` `removeLegacy` | skip | 15 of 16 lm drafts (adapter and builtin); all 6 existing `legacy-move.feature` scenarios |
| L2 | `bridges/mcp/legacy.ts:158` `isLeftover` | `return false;` | lm `:6`, `:73`, `:618`, `:665` (both) |
| L3 | same line | drop the `panelCopies` arm | lm `:73` |
| L4 | same line | `return true;` | lm `:140` |
| L6 | `orchestrators/reconcile/load.ts:103` | swap the scopes | **nothing**: not the row order (Pitfall 4) |
| L6b | `shared/notification-resolve.ts:1043` | reverse the moved-row sort | lm `:266` |
| L7a | `orchestrators/reconcile/mcp-migration.ts:262` `reportUnowned` | add G | lm `:323`, `:343` (both) |
| L7b | same | `if (true)` | lm `:364` |
| L8 | same file `:369` `missKind` | add G | lm `:699` |
| L9 | same file `:675` | `dropped === undefined \|\| true` | lm `:458` |
| L10 | same file `:411` | `arm: "disabled"` | `legacy-move.feature` (in tree) malformed scenario |
| L12 | `bridges/mcp/legacy.ts:351` | wrong field order | **nothing**: an ineffective edit (overwritten by a later spread) |
| L12b | `shared/notification-resolve.ts:1004` | drop `leftover-removed` from the warning kinds | lm `:618`, `:665` |
| L13 | `bridges/mcp/legacy.ts:299` `projectDisableStubNames` | `return [];` | lm `:665` |
| V1 | `mcp-migration.ts:570` `applyNeutralVerdict` | `if (true) return false` | vl `:6` (adapter). The builtin half passes, as expected |
| V2 | `orchestrators/plugin/mcp-verdict-read.ts:47` `readTracedLegacyServers` | add G (always re-resolve) | vl `:64` (builtin) |
| V3b | same file `:69` | pass `"adapter"` | vl `:35` (builtin) |
| O1 | `bridges/mcp/adapter-doc.ts:345` `emptied` | `false` | lc `:1113` (both) |
| O2 | `bridges/mcp/adapter-entry.ts:479` | use the kept value | **nothing**: a no-op for these inputs |
| O2b | same, add an `else` that writes back the kept value | — | lc `:331`, `:365`, `:421`, `:584`, `:1113` (both) |
| O3 | `adapter-entry.ts:476` | drop the `livePluginSet` test | lc `:584` |
| O4 | `adapter-doc.ts:563` `capturedChoices` | add G | lc `:616`, `:655`, `:706`, `:745`, `:785`, `:836`, `:881` (both) |
| O5 | `adapter-doc.ts:522` `storedChoicesFor` | never apply | lc `:655`, `:785`, `:881` |
| O6 | `adapter-doc.ts:496` `ownedChoiceOf` | any owner | lc `:997`, `:1055` |
| O7 | `adapter-doc.ts:630` `nextChoices` | drop unconsumed | **nothing**: the store is not rewritten with nothing captured |
| O7b | `adapter-doc.ts:671` `consumed` | any owner | lc `:997`, `:1055` |
| O8a | `bridges/mcp/stage.ts:651` | drop `...overlays` | 13 lc drafts |
| O8b | `adapter-doc.ts:304` | `keptOverrides: {}` | lc `:175`, `:236` |
| O9 | `stage.ts:650` | drop `...ours` from `previous` | lc `:175`, `:236`, `:947` (both) and 9 existing `lifecycle.feature` scenarios |

(cfg = `final-configuration.feature`, opt = `final-options.feature`, lm = `final-legacy-move.feature`, vl = `final-verdict-list.feature`, lc = `final-lifecycle.feature`.)

**Gap:** no break for the project half of "a user-scope install leaves the project `mcp-adapter.json` alone" (lm `:205`). A plausible break would add a project-file write to a user-scope stage, which today's code has no hook for. The whole-scope unchanged check guards it. Record it in the SUMMARY, as Phase 4 recorded K2.

## State of the Art

| Old approach | Current approach | Impact |
|---|---|---|
| Integration `makeCtx()` sessions with no MCP implementation (rows show `{requires mcp}`) | cucumber under both real implementations | Rows show no soft-dependency marker; the notices are JSON payloads, not text |
| A "reload" through `createApplyReconcile` (prints `Apply: nothing to change.`) | `the user starts a new pi session` (load); `apply` only for the declared-owner case | The load's notice is the `mcp-migration` payload |
| `example.test` remote URLs | `https://127.0.0.1:9/...` | No network reach |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The user accepts `@mcp` (not `@adapter-only`) for the legacy-move and override scenarios, given the measured equality | Summary, Open Q1 | Relabel up to 40 scenarios `@adapter-only`; they would then not run under `builtin`, against success criteria 3 and 4 |
| A2 | Whole-file `mcp-adapter.json` checks that include `keptOverride`/`serverChoices` are within CONTEXT [Group B fields] (they read the user's file, not the record) | Case inventory | The planner keeps some override cases in the integration file for Phase 8 |
| A3 | Replacing the integration's warm-reload half of `:448` by the reinstall the notice names is acceptable | Case inventory | Add a scenario that restores the clone and reloads; that needs a step to recreate a clone |
| A4 | Pinning `cause: "not-declared"` (MCPMIG-01) in a scenario is acceptable with a comment | Summary | The integration case `:640` stays instead |
| A5 | The info row `plugin:hello:live (unsupported ws)` that `:509` also asserted needs no scenario (the move rows and list cover the user's view) | Case inventory | Add a `plugin info` scenario after the move |

## Open Questions

1. **`@mcp` instead of `@adapter-only` for the legacy-move and override scenarios** (deviation from CONTEXT [Tags]).
   - Known: all 16 legacy-move drafts, all 24 override drafts, and the optional 25th give byte-identical payloads and files under both profiles (dump diff per scenario). The skill defines `@adapter-only` as holding only under pi-mcp-adapter. Success criteria 3 and 4 require "pass under both profiles". The existing `legacy-move.feature` scenarios are `@mcp`.
   - Recommendation: `@mcp`, confirmed by the user before planning locks it. Name the IDs in the titles anyway.
2. **What "the `keptOverride` and `serverChoices` field checks" (CONTEXT, ROADMAP) refers to.** No case in `mcp-override-lifecycle` checks those fields other than through the file's text. Recommendation: delete the whole file once the scenarios land. If the user meant something else, the planner keeps the named cases.
3. **Optional additions.** `final-lifecycle-extra.feature:17` (the user re-install after the project cycle, the last assertion of `:117`) is validated. Recommendation: include it. The integration case's "no `mcp.json` is created" check has no step; it would need a new `Then ... does not exist` step in `mcp-configuration.steps.ts`. Recommendation: skip it, because the `mcp-adapter.json` checks cover the user's file.
4. **`options.feature:221` is `@adapter-only` though the file is identical under `builtin`** (measured with the five-field draft). It is out of scope; leave it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v24.22.3 | — |
| non-DAC shell wrapper | `npm` scripts (permission behavior) | ✓ | `…/scratchpad/nondac-sh` | CI runs as non-root |
| pi-mcp-adapter test peer | adapter profile | ✓ | 7.0.1 | — |
| `fdfind` | `npm run check` (hook Glob scenarios only) | ✓ (as `fdfind`; no `fd` on `PATH`) | — | symlink `fd` for the full check |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` ^13.3.0 (behavior); `node:test` (integration) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`) |
| Quick run command | `<prefix> npm run test:cucumber:profile -- --profile <adapter\|builtin> --parallel 2 features/mcp-server/<file>.feature` |
| Integration file | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/integration/mcp-<name>.test.ts` (each 1.2-2.0 s today) |
| Full suite command | `npm run check` (with the prefix) |

Measured in tree with all drafts appended (`--parallel 2`, idle machine):

| Feature file | adapter | builtin |
|---|---|---|
| `configuration.feature` | 22 scenarios, 26 s | 23 scenarios, 23 s |
| `options.feature` | 12, 17 s | 8, 12 s |
| `legacy-move.feature` | 22, 22 s | 22, 20 s |
| `verdict-list.feature` | 10, 13 s | 8, 5 s |
| `lifecycle.feature` | 48, 23 s | 33, 17 s |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITMIG-09 | home path, tool rules, variables, credentials, options, AVAR-04 | behavioral | quick run of `configuration.feature`, `options.feature` under both profiles | ✅ (append) |
| ITMIG-10 | sweep, move, unowned, cold cache, malformed, list rows | behavioral | quick run of `legacy-move.feature`, `verdict-list.feature` under both | ✅ (append) |
| ITMIG-11 | overrides and choices | behavioral | quick run of `lifecycle.feature` under both | ✅ (append) |
| all | kept internal cases | integration | the integration command for `mcp-migration`, `mcp-verdict-migration`, `mcp-verdict-list` | ✅ (trim) |
| all | steps and layout | static | `npm run check:features`, `npm run fallow`, `npx tsc --noEmit -p .`, `npm run lint` | ✅ |

### Sampling Rate
- **Per task commit:** the quick run of the touched owner file under both profiles, plus `npm run check:static` (in a worktree the hook may check nothing).
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green on the combined tree; each break recorded in the SUMMARY with the failing `N) <title> # <file>:<line>` lines.

### Wave 0 Gaps
- [ ] S1 in `mcp-implementation.steps.ts` (05-01)
- [ ] S2 in `session.steps.ts` and S3 + `mcpJsonText` in `mcp-server/legacy-move.steps.ts` (05-02)
- [ ] S4 and S5 in `mcp-server/lifecycle.steps.ts` (05-03)

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (tests only) | The variable and deny-list rules are tested, not changed |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A credential reaching a remote header (AVAR-05) | Information disclosure | `credentials-blanked`; the AVAR-05 draft checks the whole file and every payload |
| An option or secret value written to a user file (D-PG10-11) | Information disclosure | References only; the five-field and AVAR-02 drafts check the whole file |
| A scenario reaching the network | — | Loopback discard port `127.0.0.1:9` in every remote URL |

## Plan Split (suggested)

One wave, three plans, with disjoint files:

| Plan | Requirement | Feature files | Step modules | Integration files |
|---|---|---|---|---|
| 05-01 | ITMIG-09 | `mcp-server/configuration.feature` (8 scenarios, 3 Outline rows, description update), `mcp-server/options.feature` (1) | `mcp-implementation.steps.ts` (S1) | delete `mcp-home-path-partial`, `mcp-tool-rules`, `mcp-variable-expansion` |
| 05-02 | ITMIG-10 | `mcp-server/legacy-move.feature` (16; description adds AMIG-02..04; e15 comment names MCPMIG-01), `mcp-server/verdict-list.feature` (3; description adds MREC-02 and D-P3-16) | `session.steps.ts` (S2), `mcp-server/legacy-move.steps.ts` (S3, helper) | delete `mcp-legacy-sweep`; trim `mcp-migration` to `:749`, `mcp-verdict-migration` (drop `:210`), `mcp-verdict-list` (drop `:139`), each with a new header |
| 05-03 | ITMIG-11 | `mcp-server/lifecycle.feature` (24 + optional 1; the description sentence "exist only for pi-mcp-adapter" needs an update for the `@mcp` file scenarios) | `mcp-server/lifecycle.steps.ts` (S4, S5) | delete `mcp-override-lifecycle` |

No file is shared: 05-02's sweep drafts use `lifecycle.steps.ts:50` unchanged, and no plan uses another plan's new step. Each plan owns one shared step module. 05-02 is the largest by integration edits; 05-03 is the largest by feature lines (about 1,135).

## Sources

### Primary (HIGH confidence)
- Read this session: the seven integration files and `mcp-verdict-list.test.ts`, `mcp-plugin-seed.ts`; `features/mcp-server/{legacy-move,options,configuration,lifecycle,verdict-list,verdict-install,verdict-fetch,builtin-options}.feature`; the step modules `mcp-configuration`, `session`, `command`, `scope-state`, `config`, `mcp-implementation`, and `mcp-server/{legacy-move,lifecycle,listing,configuration,implementation-switch}`; `features/lib/{mcp-configuration,mcp-builtin-earlier-record,earlier-version-state,pi-commands,result-rows,scenario-file,pi-launch-environment,mcp-implementation}.ts`; the cucumber skill (`SKILL.md`, `layout.md`, `features.md`); `scripts/check-features.mjs:449-620`; `cucumber.json`; `docs/json-output.md:535-830`; the product sites in the break table; pi-mcp-adapter 7.0.1 `index.ts:2219-2241` and `config.ts:2000-2050`; `.planning/BACKLOG.md:4618-4620`.
- Measured: every draft, break, and in-tree run, in `research-05/` (`logs/`, `dump/`, `timings.txt`, `batch*.log`, `intree*.log`).

## Metadata

**Confidence breakdown:**
- Scenarios and steps: HIGH. All ran green under both profiles, in scratch and in tree; the static gates passed.
- Breaks: HIGH. 37 of 42 failed their targets, and the 5 survivors are explained and replaced.
- Tags: HIGH for the measurement, MEDIUM for the disposition (it needs the user, Open Question 1).

**Research date:** 2026-11-22
**Valid until:** 2026-12-22 (stable tree, no dependency changes)
