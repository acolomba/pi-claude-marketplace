# Phase 4: Prune - Research

**Researched:** 2026-11-22
**Domain:** Moving integration cases to cucumber scenarios (test-only, with one candidate small product fix)
**Confidence:** HIGH. Every scenario draft below ran green under the `adapter` profile against the real extension. Every break below was applied, run, and reverted in this session. `git status --porcelain` was clean at the end.

## Summary

Every user-visible case of `test/integration/standalone-prune.test.ts` can move to `features/plugin/prune.feature`. The file has 25 tests (14 `test(...)` sites, three of them parameterized: 2 + 7 + 5 variants). Twenty-eight new scenario rows (eight scenarios plus four Outlines with 20 rows) pass under `adapter` in 8 s together with the 12 existing scenarios (`final` run: 40 passed). The builtin profile selects 0 of them, because no draft has an MCP surface (measured, DUAL-02). Twenty-seven deliberate breaks were run. Twenty-six failed the scenario they target. One break (K2, a same-bytes save of an unchanged record) passes everything, as Phase 3's IN-05 predicted. The drafts, the typed step module, the break definitions, and all logs are in `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/research-04/`: `probe/final.feature` (the scenarios to copy), `probe/e.feature` (the one-`When` form of two of them), `probe/d.feature` (the backup-leak scenario), `prune.steps.ts` (the typed step module), `brk/K*.json`, `break-K*.log`, and `timings.txt`.

**The failed-member case is user-reachable.** A plugin can ship a read-only directory inside a skill. The existing step `the published plugin {string} of the marketplace {string} has a read-only skill directory` (`plugin/publishing.steps.ts:311`) sets that up. A prune then cannot remove the staged copy. Under the non-DAC shell wrapper it fails with EACCES, the member keeps its record, its dependency stays (D-05-13, PRUNE-03), and the row reads `failed {permission denied}` with the cause token `{read-only skill directory removal error}`. After the user makes the directory writable, a second prune removes both. So the integration case's `../invalid` fault injection is not needed, and that case can be deleted (drafts F01 and F02, breaks K9 and K10).

**Product finding (rule 4 candidate).** That same prune leaks its backup. `snapshotPath` copies the read-only directory into `prune-backup-XXXXXX/` with its mode (`prune-rollback.ts:117`), and `discard` then cannot remove it. The failure is only debug-logged (`prune-rollback.ts:497-504`). So `<scope>/pi-claude-marketplace/prune-backup-XXXXXX/2/read-only/data.txt` stays after every such prune (measured). A 21-line fix gives the owner write permission on each backup directory before the three `removeBackup` calls. I tried it in the tree: the leak scenario turned green, all 41 drafts and existing scenarios passed, `tsc` and `eslint` passed, and the 90 unit tests of `prune-rollback.test.ts` and `prune.test.ts` passed. Then I reverted it. The diff is in `research-04/fix-leak.diff`.

New steps: four, all in the new verb module `features/step_definitions/plugin/prune.steps.ts`, each naming prune (D-08). No shared step module changes. Three are needed by the migration, and one is needed only if the leak fix is taken.

**Primary recommendation:** Use one plan, 04-01, which adds the scenarios and the three migration steps and trims `standalone-prune` to its two internal carrier cases. If the user accepts the leak fix, add a second plan, 04-02, in wave 2. It owns `prune-rollback.ts` and its unit test, and it adds the leak scenario and its `Then` step to the same two files. Two plans cannot share a wave without touching the same files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- [Failed member] Q: "How does a scenario make a prune member fail, when the integration case tampers a record to a skill path of `../invalid`?" → Selected: "Use a failure a user could meet if one exists (for example a staged artifact the prune cannot remove because its directory is not writable, which the non-DAC wrapper makes real for the root container); if no user-reachable failure exists, keep the case as fault injection for Phase 8 (Out of Scope) and say why in the SUMMARY" — matches the ROADMAP note; the choice is local to the test.
- [Unchanged checks] Q: "How do 'changes nothing' and 'both scopes unchanged' get proved?" → Selected: "With the whole-scope steps `the files of the {word} scope are remembered` / `... are unchanged` for every scope the command can touch (Phases 2 and 3 found narrower checks let regressions pass)" — reuses existing steps.
- [Steps] Q: "Where do new prune steps go?" → Selected: "In the new verb module `features/step_definitions/plugin/prune.steps.ts`, with text that names prune (D-08); a step a second verb needs goes to a topic module in its own commit" — layout rule.
- [Malformed state] Q: "How is 'without showing its path' checked?" → Selected: "The scenario checks the complete notification rows and asserts the absolute state path and the sandbox home do not appear in them" — test approach.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "As in Phases 1-3: one reverted deliberate break per behavior, recorded in SUMMARY.md; already-covered cases get a break too" — test approach only.
- [Deletion] Q: "What happens to standalone-prune?" → Selected: "It keeps only its internal cases (and the failed-member case if no user-reachable failure exists); the file header says what it keeps and why" — git history keeps the rest.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it when small, with a unit test beside its source pair and a CHANGELOG parent line; otherwise a BACKLOG.md entry and the guarding integration case stays" — milestone rule.

### Claude's Discretion
- Scenario titles, step wording, tables; break edits; plan count and waves (one feature file and one new step module suggest one or two plans).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITMIG-08 | Scenarios cover the uncovered `prune` cases that a user can see: the remaining empty-scope variants, a malformed state file, held neighbours across marketplaces, an actual prune after a stale preview, a failed member that keeps its dependency until a retry, a preview with no project state, an unreadable declarer manifest, the flags `-y`, `--keep-data`, and `--prune`, a project-only prune, and a dependent-first chain whose preview matches the actual prune. | Verified drafts E01 (7 rows), M01 (4), FL01 (5), S01, C01, A01, P01, N02, U01 (4), F01, F02, and optionally L01 (`probe/final.feature`). Each fails under at least one break (table below). The already-covered cases fail under K18-K22. |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Read a file before you edit it, and trace callers before you change a function. Never commit to `main`. Update branches by merging, never by rebasing. Commit as `.agents/skills/committing/SKILL.md` describes, and never use `--no-verify`.
- Every plan `SUMMARY.md` has `## Threat Flags`, even when the answer is "None".
- GSD gates run `npm run check` on the combined tree. A passing hook is not a verdict. Inside `.claude/worktrees/...` the hook may check nothing, so run `npm run check:static` and the touched scenarios by hand before you commit (CONTEXT).
- A user-visible `/claude:plugin` change ships with a cucumber scenario that fails without it. This applies to the backup-leak fix if the phase takes it: draft F03 (`probe/d.feature`) is that scenario.
- **Upstream parity:** prune is a project verb (`docs/dependency-resolution.md` "Pruning without uninstalling a named plugin"). Scenarios name the decision IDs they pin. These IDs occur in product comments or docs: D-12-01 (`docs/messaging-style-guide.md:94`), D-02-05 (`edge/handlers/shared.ts`, `isOptionToken`), D-05-07 (`orchestrators/plugin/dependency-index.ts:479-480`), D-05-13 and PRUNE-03 (`orchestrators/plugin/uninstall.ts:966-972`), and D-04-03 (`persistence/migrate.ts:191`) `[VERIFIED: grep and read this session]`. Precedent puts the ID in parentheses at the end of the title.
- **Parent lines:** no phase edits `CHANGELOG.md`, `.planning/BACKLOG.md`, or the PROJECT.md Key Decisions table. List those lines under "Parent lines" in the last plan's SUMMARY.
- **fallow audit:** trimming `standalone-prune` gives one `weakened-tests` warn. Record it and move on. Do not change `.fallowrc.json` or the CI workflows (user decision, STATE.md Blockers).
- Environment: prefix npm with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Pass `--parallel 2` to cucumber. Run direct coverage under `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp ...`.
- Comments and titles cite spec IDs, never `Phase N` or `Plan N` (CONVENTIONS.md).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Flag and argument refusal before any read (D-02-05) | Edge: `edge/handlers/plugin/prune.ts:24-41`, `edge/handlers/shared.ts:95-104`, `:151` (`isOptionToken`) | `edge/flag-catalog.ts:200` (`prune: [DRY_RUN_FLAG_ENTRY]`) | The handler refuses before it calls the orchestrator |
| Scope default and empty report (D-12-01) | Orchestrator: `orchestrators/plugin/prune.ts:236` (`options.scope ?? "user"`), `:173`, `:273` | — | `prune-empty` is one notification kind for both forms |
| Preview (read-only, no lock) | `prune.ts:238-279` (`loadState(..., { persistMigration: false })`) | `dependency-index.ts:465-492` | No lock, no save |
| Actual sweep (locked, one save) | `prune.ts:287-348` | `uninstall.ts:980-1024` (`sweepOrphans`), `:915-956` (`removeDependencyMember`) | Rollback snapshot only when there are candidates |
| Fail closed on an unreadable declarer (D-05-07) | `dependency-index.ts:479-483` | `prune.ts:66-98` (`notifyUnreadable`) | The first unreadable record stops the index |
| Failed member holds its dependency (PRUNE-03 / D-05-13) | `uninstall.ts:1004-1016` (`gone` gets only removed keys) | — | A held key is re-checked just before its removal |
| Path redaction of a failure cause | `prune.ts:104-107` | `shared/redact-absolute-paths.ts` | The lock path is the one cause it keeps (PRN-03) |
| Backup and its removal | `orchestrators/plugin/prune-rollback.ts:365-505` | `operations.ts:148` (`removeBackup: rm`) | The finding below lives here |
| Behavioral proof | `features/plugin/prune.feature` | `features/step_definitions/plugin/prune.steps.ts` (NEW) | Test tier |

## Standard Stack

No packages are installed. The phase uses the harness that is already in the repo.

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` via `scripts/cucumber.mjs` | `^13.3.0` `[VERIFIED: package.json:19]` | Runs scenarios. Profiles `adapter` and `builtin` `[VERIFIED: cucumber.json]` |
| Node | v24.22.3 | Runtime `[VERIFIED: node --version]` |
| `node:test` | built in | The remaining `standalone-prune` cases, and the `prune-rollback.test.ts` unit pair if the fix is taken |

## Package Legitimacy Audit

None. The phase installs no external package.

## Architecture Patterns

### How a scenario reaches the behavior

```
Given publish dir marketplace(s) ─► offers plugins with dependencies ─► (allows cross-marketplace deps)
   ─► added to user/project scope ─► the user has run install/uninstall/disable  (makes orphans and holders)
   ─► hand edits: state.json "{" | plugin.json "{" | read-only skill dir | a config with this text | release-shaped record
   ─► NEW: the user has previewed the prune with "...", which listed these plugins:   (stale or parity preview)
When /claude:plugin prune [--scope] [--dry-run] [bad flag]  (headless Pi, real extension, RPC)
   ─► result fields + every plugin row ─► whole-scope files unchanged | installation record | staged skills
```

### Case inventory: what each integration case asserts, and what replaces it

Draft IDs refer to `probe/final.feature`. Break IDs refer to the break table below. Lines are in `test/integration/standalone-prune.test.ts` `[VERIFIED: read this session]`.

| Case (line) | Variants | Asserts | Replacement | Break |
|---|---|---|---|---|
| malformed state (`:222-247`) | 2: `prune --dry-run`, `prune` (user) | state bytes kept; row `● (prune) [user] ⊘ (prune) (failed) {unreadable}`, cause `state.json at state.json is not valid JSON: …` | NEW **M01** Outline (`final.feature:33`), 4 rows: user without `--scope`, both forms, and project with `--scope`, both forms | K3 (all 4 rows), K4 (dry-run rows), K1 (user rows) |
| held lock (`:250`) | 1 | `{lock held}`, cause with the lock path | already covered: `plugin/state-lock.feature:331`, `:358` | K18 fails both |
| orphan removal (`:284`) | 1 | the record drops the orphan, keeps app's skill, no git call | already covered: `plugin/prune.feature:15`, `:60` | K19. **Keep the case** as the internal carrier for "no `applyReconcile`, no `installMissingDependencies`, no git" |
| dry-run preview (`:317`) | 1 (runs twice) | rows; state and config bytes and mtimes kept; no lock; no git | already covered: `plugin/prune.feature:92`, `:122` | K20. **Keep the case** as the internal carrier for the preview |
| dependent-first fixpoint (`:351`) | 1 | the preview lists orphan, leaf; the actual run removes the same two, in that order | NEW **C01** (`final.feature:127`, or the one-`When` form `e.feature:6`) | K12, K8 |
| alternating marketplaces and held neighbours (`:417`) | 1 | the preview and the actual run both list `a@alpha, z@beta, b@beta, c@alpha`; disabled, paused, keeper, and held stay; no lock; no git | NEW **A01** (`final.feature:157`, or `e.feature:31`) | K11, K12, K8 |
| stale preview (`:489`) | 1 | the preview lists `old`; after the change on disk, the actual run removes `fresh` only and keeps `old` | NEW **S01** (`final.feature:95`) | K8 |
| failed member and retry (`:533`) | 1 | first run: a failed, free removed, a and b kept, warning; retry: a and b removed | NEW **F01** (`final.feature:308`) + **F02** (`final.feature:339`) | K9 (both), K10 (F02) |
| legacy previews (`:621`) | 1 (runs twice) | a schema-1 file that keeps `provenance` lists the orphan; nothing is written | optional NEW **L01** (`final.feature:364`; passes with release `"0.19.2"` and `"0.6.0"`) | K16 fails both L01 and this case |
| missing project state preview (`:670`) | 1 (runs twice) | prune-empty for project; both trees unchanged; no project extension root, state, config, or lock | NEW **N02** (`final.feature:243`) | K14 |
| empty scope (`:702-711`) | **7** | prune-empty for the scope; state and config bytes and mtimes kept; tree unchanged; no lock; no git | NEW **E01** Outline (`final.feature:6`), 7 rows | K1 (`:25`, `:28`), K28 (`:26`, `:29`), K25 (`:27`), K26 (`:30`, `:31`), K27 (`:29`, `:31`). K2 (same-bytes save) **passes**: see Pitfall 1 |
| project-only (`:766`) | 1 | the project orphan goes; the user tree is unchanged | NEW **P01** (`final.feature:219`) | K13 |
| unreadable declarer (`:802`) | 1 (runs `--dry-run`, then `prune`) | both runs refuse `app (failed) {unreadable}` with the fixed cause; both trees unchanged | NEW **U01** Outline (`final.feature:267`), 4 rows: user and project, both forms | K15 (all 4), K24 (dry-run rows) |
| flags (`:845-852`) | **5**: `-y`, `--keep-data`, `--prune`, `--bogus`, `orphan@mp` | the usage error and line; both trees unchanged | NEW **FL01** Outline (`final.feature:63`), 5 rows | K5 (`-y`), K6 (`--keep-data`), K7 (`--prune`), K29 (the 4 flag rows), K21 (`lib@tools` row) |

Count: 2 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 7 + 1 + 1 + 5 = 25. **Delete 23. Keep 2** (`:284` and `:317`), or 3 if the planner keeps the legacy case (Open Question 2).

**What stays in `standalone-prune` (internal, for Phase 8).** The no-`applyReconcile`, no-`installMissingDependencies`, and no-git checks are not separate cases. `registeredCommand` (`:188-219`) puts them into every case: its `applyReconcile` and `installMissingDependencies` throw, and each case checks `gitCalls.clone`/`fetch`. So at least one actual case and one preview case must stay to carry them. Keep "prune removes an orphan dependency through the registered command" (`:284`) and "prune --dry-run previews the orphan without writing current state" (`:317`). The second one also pins mtimes, which the whole-scope step does not compare. After the trim, these helpers have no user and must go: `seedGraphScope` (`:58-108`), `installedKeys` (`:110-117`), and the `proper-lockfile` import (`:6`). `seedScope`, `scopeTree`, `registeredCommand`, and `pluginRecord` stay. The new header says the file keeps the two cases as internal call-absence checks (ITSCOPE-01 class "calls that must not happen"), and that cucumber covers everything a user can see (`plugin/prune.feature`, `plugin/state-lock.feature`, `plugin/usage-errors.feature`).

### Existing steps to use (file:line)

| Step | Module |
|---|---|
| `the marketplace {string} is published as a {source kind} source` / `offers these plugins with dependencies:` | `marketplace/publishing.steps.ts:70` / `:152`. The `dependencies` cell is comma-separated, and `b@beta` names another marketplace (`features/lib/path-marketplace.ts:66-72`) |
| `the marketplace {string} allows dependencies on the marketplace {string}` / `is added to the {word} scope` | `marketplace/publishing.steps.ts:250` / `:257`. **Run the allow step after the `offers` step.** Run before it, the allow is lost and the install fails `cross-marketplace` (measured) |
| `the published plugin {string} of the marketplace {string} has a read-only skill directory` | `plugin/publishing.steps.ts:311`. It records `{read-only skill directory removal error}` and restores the write permission on release |
| `the published plugin {string} of the marketplace {string} has the file {string} with this text:` | `plugin/publishing.steps.ts:356`. It writes `.claude-plugin/plugin.json` as `{` for U01. A dir marketplace's record points into the published tree, so this breaks the declarer in both scopes |
| `the user has run {string}` / `…, which warned` | `command.steps.ts:91` / `:106`. F02's first prune is `which warned` |
| `the user runs {string}` / `the result has these fields:` / `the result lists these plugins:` / `the command result contains no absolute sandbox path` | `command.steps.ts:123` / `:158` / `:166` / `:205` |
| `the files of the {word} scope are remembered` / `… are unchanged` | `scope-state.steps.ts:64` / `:71`. **Throws if the scope root does not exist.** The project `.pi` does not exist until something writes there (measured) |
| `a config in scope {word} and layer {word}, with this text:` | `config.steps.ts:206`. N02 uses it to create the project `.pi` with no installation record |
| `the installation record of the {word} scope is rewritten as release {string} wrote it` | `plugin/installation.steps.ts:413` (L01) |
| `the installation record of the {word} scope holds these plugins:` / `the {word} scope stages these skills and prompts:` / `the {word} scope has no installed plugins` | `plugin/installation.steps.ts:478` / `:465` / `:448`. The record rows come in record order, not sorted. A disabled plugin stages no skill |

### New steps (all in NEW `features/step_definitions/plugin/prune.steps.ts`)

The typed module `research-04/prune.steps.ts` was copied into the repo, passed `npx tsc --noEmit -p .`, ESLint, and Prettier (after one rewrap), ran every draft, and was then deleted. `npm run check:features` was not run (see Pitfall 6).

1. `Given the user has previewed the prune with {string}, which listed these plugins:`. It runs the preview, requires exactly one `info` payload, and compares every row as `the result lists these plugins:` does. S01 needs it, because a `Given` cannot follow a `When`. C01 and A01 can use it too, so they keep to one `When` (`e.feature`, verified, and K8 and K12 fail both).
2. `Given the installation record of the {word} scope to prune is not valid json`. It writes `{` to `state.json` and requires the file to exist first (M01).
3. `Given the user has made the skills the prune could not remove in the {word} scope writable`. It calls `restoreDirectoryWrites` from `features/lib/published-marketplace.ts:647` on `resources/skills`, then checks that each directory is writable (F02).
4. `Then the prune has left no backup in the {word} scope`. It requires no `prune-backup-*` entry in `pi-claude-marketplace/` (F03). **Only with the leak fix.**

### Verified scenario drafts (all green under adapter)

The full text is in `research-04/probe/final.feature`, with the one-`When` forms in `probe/e.feature`. The planner can copy the rows verbatim. Key facts:

- **E01** (7 rows `| arguments | scope |`): app→lib installed in `<scope>`. Remember the scope's files. Fields: `prune-empty | info | false | scope <scope>`. The files are unchanged.
- **M01** (4 rows): app→lib, uninstall app, then NEW step 2. Fields: `cascade | error | false | A plugin operation has failed.`. Row: `(prune) | <scope> | (prune)@(prune) | (prune) | failed | unreadable | <scope> | state.json at state.json is not valid JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2), Expected property name or '}' in JSON at position 1 (line 1 column 2) | false | | |`. Then `the command result contains no absolute sandbox path` and the files are unchanged.
- **FL01** (5 rows): orphans in both scopes; remember both. Fields: `usage-error | error | false | message <message> | usage Usage: /claude:plugin prune [--scope user\|project] [--dry-run]`. Both scopes' files are unchanged.
- **S01**: `app→old`, `tool→fresh`. Install app, uninstall app. NEW step 1 shows that the preview lists `old@tools 1.1.0 will uninstall`. Then install old by name, install tool, uninstall tool. `When prune`: one row, `fresh@tools uninstalled`. The record holds only `old@tools 1.1.0`. Stages `old-skill`.
- **C01**: `app→mid→lib`. Preview rows mid, lib (`will uninstall`). Actual rows mid, lib (`uninstalled`). The user scope has no installed plugins.
- **A01**: alpha `roota→a`, `a→b@beta`, `c`, `disabled→paused`, `paused`; beta `rootz→z`, `z→c@alpha`, `b→c@alpha`, `keeper→held`, `held`. Install roota, rootz, disabled (then disable it), and keeper, then uninstall roota and rootz. The preview and the actual run both list `a@alpha, z@beta, b@beta, c@alpha`, the same order as the integration case. Record: `disabled@alpha false, held@beta, keeper@beta, paused@alpha`. Stages `held-skill, keeper-skill, paused-skill`.
- **P01**: orphan lib in both scopes; remember the user files; `prune --scope project` → `lib@tools project uninstalled`. The project has no installed plugins, and the user files are unchanged.
- **N02**: user orphan. The project base config has the text `{ "schemaVersion": 1, "marketplaces": {}, "plugins": {} }` (this creates `.pi` with no record). Remember both scopes. `prune --scope project --dry-run` → `prune-empty | project`. Both scopes are unchanged.
- **U01** (4 rows): app→lib installed and an orphan mid in both scopes, app's `plugin.json` is `{`, remember both. Fields: error, `A plugin operation has failed.`. Row: `tools | <scope> | app@tools | app | failed | unreadable | <scope> | cannot read the dependencies of app@tools: its own manifest is present but cannot be read | false | | |`. This row has **no version column**. Both scopes are unchanged.
- **F01**: `app→mid, free`; `mid→lib`; mid has a read-only skill directory. Install app, uninstall app, `prune --scope project`. Fields: `cascade | warning | true | A plugin operation needs attention.`. Rows (in this order): `free@tools | free | uninstalled | dependency pruned | project | 1.3.0 | | | |`, then `mid@tools | mid | failed | permission denied | project | 1.1.0 | {read-only skill directory removal error} | false | |`. Record: `lib@tools 1.2.0 true`, then `mid@tools 1.1.0 true`. Stages `lib-skill, mid-skill`.
- **F02**: the F01 setup, then `the user has run "…prune --scope project", which warned`, then NEW step 3, then `When prune --scope project`. Rows: mid, lib `uninstalled`. The project has no installed plugins.
- **L01** (optional): app→lib, uninstall app, then the record is rewritten as release `"0.19.2"` (or `"0.6.0"`) wrote it. Remember the files. `prune --dry-run` → `prune-empty | user`. The files are unchanged. A release record has no `provenance`, so D-04-03 reads every plugin as installed by name.
- **F03** (only with the fix, `probe/d.feature:6`): the F01 setup and rows, plus NEW step 4. It fails today (`prune-backup-XXXXXX` is left) and passes with the fix.

### Deliberate breaks (each applied, run, and reverted in this session)

Each break is an exact-substring replacement that must match once. The edits are in `research-04/brk/<id>.json`. Paths are relative to `extensions/pi-claude-marketplace/`. G is `&& process.env.NEVER_SET === "x"`. "Failed" lists the targets. Runs covered `final.feature` + `plugin/prune.feature` (and `state-lock`, `usage-errors`, and `uninstall` for the first batch).

| ID | Site | Edit | Failed |
|---|---|---|---|
| K1 | `orchestrators/plugin/prune.ts:236` `options.scope ?? "user"` | `?? "project"` | E01 `:25`, `:28`; M01 user rows; S01; C01; U01 user rows; L01; `prune.feature:60` |
| K2 | `prune.ts:325` `if (members.length > 0) {` | `>= 0` (save an unchanged record) | **nothing** (same bytes) |
| K3 | `prune.ts:107` `: (redactCauseChain(error) ?? new Error(errorMessage(error)));` | `: error;` | M01 all 4 |
| K4 | `prune.ts:275-276`, dry-run catch `notifyOperationFailure(...)` | `notify(... prune-empty ...)` | M01 dry-run rows |
| K5 | `edge/handlers/shared.ts:151` `return token.startsWith("-");` | `"--"` | FL01 `-y` |
| K6 | `edge/flag-catalog.ts:200` `prune: [DRY_RUN_FLAG_ENTRY],` | `+ KEEP_DATA_FLAG_ENTRY` | FL01 `--keep-data` |
| K7 | same line | `+ PRUNE_FLAG_ENTRY` | FL01 `--prune` |
| K8 | `prune.ts` (3 edits): keep the preview's snapshot in the closure and reuse it at `:291` | stale snapshot | S01, C01, A01 (both forms) |
| K9 | `orchestrators/plugin/uninstall.ts:1011-1013` `if (result.removed) { gone.add(member.key); }` | always `gone.add` (PRUNE-03) | F01, F02 |
| K10 | `uninstall.ts:942`, after `cascadeFailureCause` | `Object.assign(member.record, { provenance: "explicit" })` | F02 |
| K11 | `orchestrators/plugin/dependency-index.ts:485` `index.set(key, new Set(read.declared.map(declarationKey)));` | a disabled record declares nothing (D-05-04) | A01; `prune.feature:194`, `:217` |
| K12 | `prune.ts:248` `const marketplaces = order.flatMap((key) =>` | `[...order].reverse()` (preview order only) | C01, A01 (both forms) |
| K13 | `prune.ts:236` | an actual run always uses `"user"` | P01 + 15 others |
| K14 | `prune.ts:240`, before the dry-run `loadState` | `mkdir(locations.extensionRoot, { recursive: true })` | N02 (and probe N01) |
| K15 | `dependency-index.ts:481-483` `if (!read.ok) { return read; }` | `continue;` (skip an unreadable record) | U01 all 4; `uninstall.feature:288` |
| K16 | `prune.ts:240` `{ persistMigration: false }` | `true` | L01; also the integration legacy case (measured) |
| K18 | `prune.ts:120` `} else if (error instanceof StateLockHeldError) {` | add G | `state-lock.feature:331`, `:358` |
| K19 | `uninstall.ts:926` `args.transaction.commitPluginRemoval(...)` | comment it out | `prune.feature:15`, `:34`, `:60`, `:217`, `:240`; `uninstall.feature:351`, `:401`; S01, C01, A01, P01, F01, F02 |
| K20 | `prune.ts:260-261` the preview row `needsReload: false,` | `true` | `prune.feature:92`, `:122`; C01; A01 |
| K21 | `edge/handlers/plugin/prune.ts:39` `positional.length > 0` | `> 1` | `usage-errors.feature:135`; FL01 `lib@tools` |
| K22 | `edge/handlers/plugin/prune.ts:30` `if (scanned.local) {` | add G | `usage-errors.feature:102` |
| K24 | `prune.ts:242-245`, the dry-run `notifyUnreadable` | report `prune-empty` | U01 dry-run rows |
| K25 | `prune.ts:173` actual `prune-empty` | `scope: "user"` | E01 `:27` |
| K26 | `prune.ts:273` preview `prune-empty` | `scope: "user"` | E01 `:30`, `:31` |
| K27 | `edge/handlers/shared.ts:80` `skipValue = false;` | delete it | E01 `:29`, `:31` |
| K28 | `edge/handlers/plugin/prune.ts:48` | `--scope user` maps to project | E01 `:26`, `:29` |
| K29 | `edge/handlers/shared.ts:101` `if (isRejected(tok)) {` | add G | FL01 `-y`, `--keep-data`, `--prune`, `--bogus`; `usage-errors.feature:88`, `:91` |

`final.feature` row lines: E01 rows `:25`-`:31` in argument order, FL01 rows `:89`-`:93`.

### Product finding: a prune that cannot remove a read-only directory leaks its backup

- **Measured.** After F01's prune, `.pi/pi-claude-marketplace/` holds `prune-backup-XXXXXX/2/read-only/data.txt`. The retry in F02 does not remove it.
- **Cause.** `snapshotPath` copies each target with `cp(..., { recursive })` (`prune-rollback.ts:117`). The copy keeps the 0555 mode, and the restore depends on that: `sameEntry` compares modes. `discard` calls `ops.removeBackup(backupRoot, { recursive: true, force: true })` (`:499`), which hits EACCES on the read-only directory. The catch only calls `hookDebugLog` (`:500-503`). The same removal sits in the rollback's final cleanup (`:489`), where it would report a `backup cleanup` failure, and in the `preparePruneRollback` catch (`:440`).
- **Candidate fix (tried and reverted).** Add `grantBackupWrites(root)` (lstat; for a directory, `chmod(mode | 0o200)` and recurse with `Promise.all`; never follow symlinks) and `removeBackupRoot(ops, backupRoot)`, and use the latter at all three sites. The diff is `research-04/fix-leak.diff`. It passed `tsc`, ESLint, and Prettier, made F03 pass, kept 41/41 scenarios and 90/90 unit tests green. **Two cautions for the executor.** (1) In the `preparePruneRollback` catch, `lstat` of a missing root would throw and hide the original error. Treat ENOENT as done (`rm` with `force` never threw there). (2) Replace the three call sites *before* you insert the helper. My first try replaced the helper's own call too, which recursed forever and hung every actual prune (the 224 s `fix-final` run in `timings.txt`).
- **Unit test.** Add a case to `test/orchestrators/plugin/prune-rollback.test.ts` that snapshots a skill with a 0555 subdirectory, calls `discard`, and expects the backup root to be gone. It is red only without the DAC override (CI's non-root runner, or the `nondac-sh` wrapper here). Run as plain root, it passes even without the fix. Direct coverage of `prune-rollback.ts` must stay at 100%. The ENOENT branch needs its own case.
- **Disposition (rule 4).** The fix is small. It changes product code in a test-migration phase, so the planner confirms it with the user or records a BACKLOG parent line. No integration case guards it, so nothing has to stay if it is deferred.

### MCP surface

None. No draft names `mcp`, `mcpServers`, or `.mcp.json`. `--profile builtin` over all drafts and `prune.feature` printed `0 scenarios`, exit 0 (measured). No draft takes an implementation tag.

### Anti-patterns to avoid

- **The whole-scope step on a scope that does not exist.** The project `.pi` is absent until a command or a step writes there (measured, probe PX). N02 creates it with a config text, and E01 creates it with a project install.
- **Two `When`s for a preview-then-prune parity case.** `features.md` says a second `When` usually hides a second behavior. Use NEW step 1 for the preview (`e.feature`).
- **A partial row table.** A row table must state every row the result has. F01 lists the `free` row as well as the failed `mid` row.
- **A version cell on the unreadable-declarer row.** That row has no version, so a version column leaves an empty cell where the reader expects one.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| A member that fails to unstage | a record tamper step (the `../invalid` skill name) | `the published plugin … has a read-only skill directory` | User-reachable, already holds its error token and its release cleanup |
| An unreadable declarer | a state edit | `the published plugin … has the file ".claude-plugin/plugin.json" with this text:` | A dir marketplace's record points into the published tree |
| An earlier-release record | a hand-written legacy JSON | `the installation record of the {word} scope is rewritten as release {string} wrote it` | Release-accurate shapes (`features/lib/earlier-version-state.ts:333`) |
| "Changes no file" | another snapshot step | `the files of the {word} scope are remembered/unchanged` | Phase 2 and 3 reviews: the narrow byte steps missed regressions |
| Making the skill dirs writable again | an ad-hoc chmod walk | `restoreDirectoryWrites` (`features/lib/published-marketplace.ts:647`) | Same walk the release hook uses, symlinks not followed |
| Seeing actual rows while drafting | logging | a deliberately wrong `Then`; the assertion diff prints every row | Used throughout this session |

## Runtime State Inventory

Not a rename or migration phase. The phase trims a test file and adds scenarios. The optional fix changes how a backup directory is removed, and no stored key or name changes. A `prune-backup-*` directory that earlier runs leaked stays on users' disks; the fix does not sweep old leaks (Open Question 3).

## Common Pitfalls

### Pitfall 1: "changes no file" does not see a same-bytes rewrite
**What goes wrong:** K2 (save the record even when nothing was pruned) passes every scenario. `scopeFiles` compares bytes, not mtimes (`scope-state.steps.ts:19-38`). The deleted empty-scope cases compared mtimes too.
**How to avoid:** Accept it, as Phase 3 did (IN-05). Record K2 in the SUMMARY as the one surviving break. The kept `:317` integration case still pins mtimes for the preview. Do not change the shared step in this phase: it would change what every other scenario compares.

### Pitfall 2: The read-only directory needs the non-DAC shell
Root ignores directory modes. Without `npm_config_script_shell=…/nondac-sh`, F01 and F02 prune `mid` successfully and fail. CI runs as non-root, so it needs no wrapper. The same applies to the existing `apply.feature` and `install-rollback.feature` uses of the step.

### Pitfall 3: Allow cross-marketplace dependencies after the offer
In A01, `allows dependencies on the marketplace` must come after `offers these plugins with dependencies:`. Before it, the install fails `{cross-marketplace}` (measured).

### Pitfall 4: Row and record order
Prune rows come in sweep order, not by name: F01 lists `free` before `mid`. The record step lists record order: `lib, mid` in F01, `disabled, held, keeper, paused` in A01. The drafts give the measured orders. They held across 6+ runs with random scenario order.

### Pitfall 5: Break verify commands
Cucumber prints a failed scenario as `  N) <title> # <file>:<line>`. For an Outline row, the line is the `Examples:` row. A `file:line` filter must point at the `Scenario:` or `Scenario Outline:` line (a filter of `final.feature:57`, a non-scenario line, selected nothing in this session). Assert that the run did not print `0 scenarios`.

### Pitfall 6: `check:features` and the reserved verb module
`plugin/prune.steps.ts` is the name that `layout.md:57` and `:181` reserve for prune. Every step text in it names prune (D-08). Every new step must be used by a scenario, or `npm run check:features` fails. So if the leak fix is deferred, leave NEW step 4 out. I did not run `check:features` with the module in place.

### Pitfall 7: The JSON parse message
M01 pins V8's text `Expected property name or '}' in JSON at position 1 (line 1 column 2)`. CI runs Node 24 only. `marketplace/update.feature:846` already pins a V8 JSON message.

### Pitfall 8: Scratch steps
A scratch step module outside the repo must import cucumber by absolute path (`/home/user/pi-claude-marketplace/node_modules/@cucumber/cucumber/lib/wrapper.mjs`). Committed steps go in `features/step_definitions/`. Never import the scratch probe module together with the real `prune.steps.ts`: they define the same texts, and the steps become ambiguous.

## Code Examples

The typed module that passed `tsc`, ESLint, and Prettier and ran every draft (`research-04/prune.steps.ts`). Imports are verified by the typecheck: `recordTable` (`features/lib/field-rows.ts:93`), `runCommandPayloads` (`features/lib/pi-commands.ts:133`), `restoreDirectoryWrites` (`features/lib/published-marketplace.ts:647`), `pluginRowRecords` (`features/lib/result-rows.ts:110`), and `expandTokens` (`features/lib/run-tokens.ts`).

```ts
/**
 * @fileoverview Steps about plugin prune: a preview whose rows it states, an
 * installation record the prune cannot read, the skill directories a failed
 * prune left that the user repairs, and the backups a prune leaves.
 *
 * A prune backs up what it removes until its state save succeeds (NFR-3).
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { recordTable } from "../../lib/field-rows.ts";
import { runCommandPayloads } from "../../lib/pi-commands.ts";
import { restoreDirectoryWrites } from "../../lib/published-marketplace.ts";
import { pluginRowRecords } from "../../lib/result-rows.ts";
import { expandTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// The directory where the extension keeps the scope's record, staged resources, and backups.
function extensionRoot(world: ScenarioWorld, scope: string): string {
  return path.join(world.scopeRoot(scope), "pi-claude-marketplace");
}

// A preview that a later Given makes stale: the step states the rows it listed.
Given(
  "the user has previewed the prune with {string}, which listed these plugins:",
  async function (this: ScenarioWorld, command: string, table: DataTable) {
    const payloads = await runCommandPayloads(this.pi, expandTokens(command, this.tokens));
    const [payload, ...rest] = payloads;
    assert.ok(payload !== undefined && rest.length === 0, JSON.stringify(payloads));
    assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
    const [stated = []] = table.raw();
    assert.deepStrictEqual(
      recordTable(stated, pluginRowRecords(payload, this.tokens)),
      table.raw(),
    );
  },
);

Given(
  "the installation record of the {word} scope to prune is not valid json",
  async function (this: ScenarioWorld, scope: string) {
    const file = path.join(extensionRoot(this, scope), "state.json");
    assert.ok(existsSync(file), `${file} does not exist`);
    await writeFile(file, "{");
    assert.strictEqual(await readFile(file, "utf8"), "{");
  },
);

// The repair a user makes after a prune failed on a read-only directory
// that a plugin's skill ships.
Given(
  "the user has made the skills the prune could not remove in the {word} scope writable",
  async function (this: ScenarioWorld, scope: string) {
    const skills = path.join(extensionRoot(this, scope), "resources", "skills");
    await restoreDirectoryWrites([skills]);
    const entries = await readdir(skills, { recursive: true, withFileTypes: true });
    for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
      const directory = path.join(entry.parentPath, entry.name);
      assert.notStrictEqual((await stat(directory)).mode & 0o200, 0, `${directory} is read-only`);
    }
  },
);

// Only with the backup-leak fix (F03).
Then(
  "the prune has left no backup in the {word} scope",
  async function (this: ScenarioWorld, scope: string) {
    const names = await readdir(extensionRoot(this, scope));
    assert.deepStrictEqual(
      names.filter((name) => name.startsWith("prune-backup-")),
      [],
    );
  },
);
```

The `prune-backup-` prefix is verified at `prune-rollback.ts:372` (`path.join(locations.extensionRoot, "prune-backup-")`). The `no-await-in-loop` rule applies only to `extensions/pi-claude-marketplace/**`, so the `for … await` in the repair step passed lint.

## State of the Art

| Old approach | Current approach | Impact |
|---|---|---|
| A member failure by tampering a record (`skills: ["../invalid"]`) | A plugin that ships a read-only skill directory | The case becomes user-visible and leaves `standalone-prune` |
| Hand-written schema-1 state that keeps `provenance` | `rewriteStateAsRelease` (a real release's shape) | Real legacy state has no `provenance`, so the preview lists nothing (D-04-03) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `npm run check:features` accepts the new module and texts (not run with the module in place) | Pitfall 6 | The executor rewords a step text; low |
| A2 | The candidate fix needs only an ENOENT guard to be safe in the prepare-catch path | Product finding | A later review asks for more; low |
| A3 | A same-bytes record rewrite (K2) is not a user-visible change | Pitfall 1 | A reviewer wants mtimes pinned; the kept `:317` case pins them for the preview |
| A4 | The user accepts deleting the legacy-preview case in favor of L01 | Open Question 2 | The case stays for Phase 8; no other change |

## Open Questions

1. **Take the backup-leak fix in this phase?**
   - Known: the fix is about 21 lines plus a unit test, measured green. F03 is its scenario.
   - Recommendation: take it as plan 04-02 (wave 2), with a CHANGELOG parent line: "A prune that cannot remove a plugin's read-only directory no longer leaves its backup behind in the scope's `pi-claude-marketplace` directory." Otherwise give a BACKLOG parent line and leave NEW step 4 and F03 out.
2. **The legacy-preview case (`:621`).** Its file is a schema-1 record that keeps `provenance`, which no release wrote. L01 shows a real release's record at no extra harness cost, and K16 fails both. Recommendation: add L01 and delete the case, as CONTEXT allows ("unless a scenario can show them through `earlier-version-state.ts` at no extra harness cost"). Keeping the case for Phase 8 is the alternative.
3. **Old leaks.** The fix does not remove `prune-backup-*` directories that earlier runs left. Recommendation: out of scope. Mention it in the CHANGELOG line if the user wants.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v24.22.3 | — |
| non-DAC shell wrapper | F01, F02, F03, the leak unit test | ✓ | `…/scratchpad/nondac-sh` (setpriv) | CI runs as non-root |
| `fdfind` | `npm run check` (hook Glob scenarios) | ✓ | — | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` ^13.3.0 (behavior); `node:test` (integration and unit) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`) |
| Quick run command | `npm_config_script_shell=…/nondac-sh NODE_OPTIONS=--max-old-space-size=6144 npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/prune.feature` (12 scenarios today in 6 s; about 40 after the phase in 8 s, measured) |
| Integration file | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/integration/standalone-prune.test.ts` (25 tests, 2.6 s today) |
| Full suite command | `npm run check` (with the prefix) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITMIG-08 | empty variants, malformed state, flags, stale preview, chain parity, alternating marketplaces, project-only, no project state, unreadable declarer, failed member and retry, (legacy) | behavioral | quick run command above | `prune.feature` ✅; `prune.steps.ts` ❌ (create) |
| ITMIG-08 | already-covered lock and usage rows | behavioral | `… --profile adapter --parallel 2 features/plugin/state-lock.feature features/plugin/usage-errors.feature` | ✅ |
| ITMIG-08 | internal carriers left in `standalone-prune` | integration | integration file command above | ✅ (trim) |
| (fix) | backup removed after a failed member | unit + behavioral | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`, plus F03 | ✅ test file; new case |

### Sampling Rate
- **Per task commit:** the quick run command, plus `npm run check:static` (in a worktree the hook may check nothing).
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green on the combined tree, plus `--profile builtin` on `prune.feature` printing `0 scenarios` (DUAL-02).

### Wave 0 Gaps
- [ ] `features/step_definitions/plugin/prune.steps.ts`: NEW steps 1-3 (and 4 with the fix).

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (tests only) | The flag refusals are tested, not changed |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Absolute path in an error notice | Information disclosure | `redactCauseChain` (`prune.ts:104-107`); M01 adds `the command result contains no absolute sandbox path` |
| `chmod` walk in the fix | Tampering | `lstat`, never follow symlinks; confined to the backup root that `mkdtemp` made under `extensionRoot` (NFR-10) |

## Plan Split (suggested)

| Plan | Wave | Files | Content |
|---|---|---|---|
| 04-01 | 1 | `features/plugin/prune.feature`, NEW `features/step_definitions/plugin/prune.steps.ts` (steps 1-3), `test/integration/standalone-prune.test.ts` (trim to `:284` and `:317`, update the header, drop the dead helpers) | E01, M01, FL01, S01, C01, A01, P01, N02, U01, F01, F02, (L01). Breaks K1-K29 recorded, and the already-covered rows broken by K18-K22 |
| 04-02 (only if the fix is accepted) | 2 | `orchestrators/plugin/prune-rollback.ts`, `test/orchestrators/plugin/prune-rollback.test.ts`, `features/plugin/prune.feature` (F03), `features/step_definitions/plugin/prune.steps.ts` (step 4) | The fix, its red unit test, F03, and a red proof without the fix. Parent CHANGELOG line |

Two plans in one wave cannot avoid shared files: F03 and its step live in the files that 04-01 owns. 04-01 alone is small enough to run with one executor (`--parallel 2`). With a second executor in parallel elsewhere, use `--parallel 1`.

## Sources

### Primary (HIGH confidence)
- Read this session: `test/integration/standalone-prune.test.ts`; `features/plugin/prune.feature`, `state-lock.feature:325-385`, `usage-errors.feature:70-140`; `orchestrators/plugin/{prune,prune-rollback}.ts`; `uninstall.ts:915-1099`; `dependency-index.ts:150-545`; `edge/handlers/plugin/prune.ts`; `edge/handlers/shared.ts:10-160`; `edge/flag-catalog.ts`; `features/step_definitions/{command,scope-state}.steps.ts`; `plugin/{installation,publishing,uninstall}.steps.ts`; `features/lib/earlier-version-state.ts`; `published-marketplace.ts:595-690`; the cucumber skill rules; `docs/dependency-resolution.md:238-262`; `docs/output-catalog.md:1486-1540`.
- Measured: every draft and break run in `research-04/` (`timings.txt`, `break-*.log`, `breaks-*.txt`).

## Metadata

**Confidence breakdown:**
- Scenarios and steps: HIGH. All ran green. The typed module passed `tsc`, ESLint, and Prettier.
- Breaks: HIGH. 26 of 27 fail their targets. K2 is explained.
- Product finding: HIGH for the leak (measured both ways); MEDIUM for the exact fix shape (A2).

**Research date:** 2026-11-22
**Valid until:** 2026-12-22 (stable tree, no dependency changes)
