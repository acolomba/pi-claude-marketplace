# Phase 3: Marketplace Layers and Cross-Scope Install - Research

**Researched:** 2026-11-21
**Domain:** Moving integration cases to cucumber scenarios (test-only, with one candidate small product fix)
**Confidence:** HIGH. Every scenario draft below ran green under the `adapter` profile in a scratch feature file against the real extension. Every break below was applied, run, and reverted in this session, and `git status --porcelain` stayed clean.

## Summary

All five integration files can move to cucumber. Twenty scenario drafts pass under `adapter`, and 26 deliberate breaks each fail the scenario they target. The drafts, the scratch step module, the break definitions, and every log are in `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/research-03/` (`probe/*.feature`, `probe-steps/probe.steps.ts`, `brk/<id>.old|.new`, `break-<id>.log`, `timings.txt`). Planners can copy rows from them. No scenario has an MCP surface, so the `builtin` profile selects 0 of them (measured), and no scenario takes an implementation tag (DUAL-02).

The audit's "cheapest moves" hold for the autoupdate and remove cases: they need only existing steps. The other cases need **six new steps** in three shared topic modules:

| New step | Module | Needed by |
|---|---|---|
| `Given the marketplace {string} offers these plugins from its own repository:` (`\| name \| version \| url \| pinned \|`) | `marketplace/publishing.steps.ts` (+ a builder in `features/lib/git-plugin.ts`) | the same-repository plugin cases (D-SEED-01) |
| `Given the {word} scope holds a checkout of the marketplace {string} that an interrupted add left` | `marketplace/checkout.steps.ts` | MA-12 |
| `Given the {word} scope holds a directory of the user's own where the checkout of the marketplace {string} goes` | `marketplace/checkout.steps.ts` | MA-13 |
| `Then the checkout of the marketplace {string} in the {word} scope holds these files:` (`\| file \|`) | `marketplace/checkout.steps.ts` | MA-12, MA-13 |
| `Given the plugin {string} has written the file {string} with the text {string} to its data directory in the {word} scope` | `plugin/installation.steps.ts` | LAYER-03 (a dependency install creates no data directory) |
| `Then the {word} scope holds no plugin data` | `plugin/installation.steps.ts` | the full remove of an undeclared marketplace |

The research found these items for the planner:

1. **Product finding (a candidate small fix, rule 4).** Mirror seeding (D-SEED-01) does not happen when a `git-subdir` plugin's `url` ends in `.git`, which is the usual spelling. `canonicalCloneUrl` strips `.git` from a `url` source but keeps it on a `git-subdir` source (`domain/source.ts:256-264`, pinned by `test/domain/clone-key.test.ts:303`). So the marketplace URL and the plugin URL never compare equal (`orchestrators/plugin/clone-cache.ts:800`). The result: `list` shows the plugin as `remote` right after the add, and a pinned install clones it again. Spelled without `.git`, both work. A 4-line fix in `clone-cache.ts` compares the URLs without the suffix and keys the seed by the plugin's own canonical URL. With the fix, the `.git` variants pass. I tried the fix in the tree and reverted it. The fix is not committed.
2. **ROADMAP criterion 2 holds only for a pinned plugin.** An unpinned same-repository install always fetches, because MIRR-02 / D-79.1-02 refresh a warm mirror on install (`clone-cache.ts:520-540`). The fetch is GET `info/refs` plus POST `git-upload-pack`, the same requests as a clone. So "no git request" is provable for a pinned plugin only. For an unpinned plugin, the user-visible proof is that `list` shows `available`, not `remote`, right after the add.
3. **A dependency install creates no data directory.** AS-6's eager `mkdir` runs only for the root plugin (`install-flow-ledger.ts:536`). So the existing `the data directory of ... holds the file ...` step, which requires the directory, cannot seed LAYER-03's dependency data. Hence the new "has written" step. Claude Code creates the plugin data directory lazily (`[ASSUMED]`), so this is not a parity bug.
4. **The requirement says "a base-layer remove of a url marketplace that removes its clone and data directory".** The integration case it maps to (`marketplace-layer-remove.test.ts:197`) proves the opposite: while the local layer still declares the marketplace, the base-layer remove keeps them. Both directions are covered: M01 keeps them, and M02 (the full remove of an undeclared marketplace) removes them.

**Primary recommendation:** Use four plans in one wave, split by feature file, each owning a disjoint set of shared step modules: 03-01 autoupdate, 03-02 remove, 03-03 url-source (add and seeding), and 03-04 cross-scope install. Every scenario and break below is verified. Settle the seeding fix (item 1) with the user, or record it as a BACKLOG parent line. The scenarios work without the fix if the step's `url` cell omits `.git`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- [Placement] Q: "Where does each moved case go?" → Selected: "Autoupdate flips (D-09, CFG-03) in `marketplace/autoupdate.feature`; re-declarations in `marketplace/add.feature` (url sources may go in `marketplace/url-source.feature` if that is where url stand-ins are set up); remove cases in `marketplace/remove.feature`; the same-repo url plugin install with no git request in `marketplace/url-source.feature` or `plugin/cross-scope-install.feature`, whichever already holds url-plugin installs; all project-install cases in `plugin/cross-scope-install.feature`" — placement is reversible.
- [Unchanged checks] Q: "How does a scenario prove 'changes nothing'?" → Selected: "With the whole-scope steps Phase 2 added, `the files of the {word} scope are remembered` / `... are unchanged` (`features/step_definitions/scope-state.steps.ts`), for every scope the command can touch, plus 'the git host receives no request' where the integration case checked for no git call; the narrower config/record byte steps only where a scenario must allow other files to change" — reuses existing steps; Phase 2's review showed the narrow steps miss real regressions.
- [Harness] Q: "How are a leftover clone, a foreign tree, and a stale user clone set up?" → Selected: "New Given steps in the marketplace topic modules (`marketplace/publishing.steps.ts` or `marketplace/checkout.steps.ts`, whichever owns clones), named for what they set up: the extension's own leftover clone at the project clone path (MA-12), a foreign tree there (MA-13), and a user clone older than the marketplace so that the fresh project clone holds a different dependency list (D-MF-04). Library code they need goes in the marketplace library under `features/lib/` that the plan names" — shared harness additions are named in the plan, as the ROADMAP requires.
- [Breaks] Q: "How is each replaced case checked before deletion?" → Selected: "As in Phases 1 and 2: one deliberate break per behavior, reverted in an EXIT trap in the plan's own worktree and never committed; SUMMARY.md records the break, the command, and the failing scenario; already-covered cases get a break too" — test approach only.
- [Deletion] Q: "Which files go?" → Selected: "`marketplace-layer-autoupdate`, `marketplace-layer-redeclare`, and `project-install-adds-user-marketplace` when all their cases are covered; `marketplace-layer-remove` keeps its three EACCES cases; `marketplace-add-seed-mirrors` keeps its internal mirror cases; helpers no remaining test imports go with their last user; each deleted file goes in `files_deleted`" — git history keeps them.
- [Parallelism] Q: "How are plans split?" → Selected: "By feature-file ownership; the plan that adds the clone-setup steps owns the marketplace topic module and library changes in its wave; another plan that needs them depends on it" — wave layout is local to the plan.
- [Bugs] Q: "What if a scenario exposes a product bug?" → Selected: "Rule 4: fix it in the phase when small, with a unit test beside its source pair; otherwise a BACKLOG.md entry and the guarding integration case stays with a header naming the BACKLOG ID" — milestone rule.

### Claude's Discretion
- Scenario titles, step wording, and tables, within the cucumber skill's rules; break edits; plan count and waves.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITMIG-05 | Scenarios cover the marketplace layer cases: D-09 named and unnamed autoupdate flips of a recorded but undeclared marketplace; CFG-03 for a non-local flip when the local config cannot be read; a re-declaration and a same-repo url plugin install that make no git request; a named remove of a recorded but undeclared marketplace; LAYER-02 refusing a remove when the other layer cannot be read; a base-layer remove of a url marketplace (clone and data directory); a refused remove with an installed plugin that changes no state and no skill; LAYER-03 keeping a url-source dependency, its clone, and its data while the scope converges. | Verified drafts A01-A03 (autoupdate), R01, R02, U01, U02 (url-source), M01-M06 (remove). Breaks A1-A5b, D1, D2, R1-R9 all fail their scenarios. |
| ITMIG-06 | Scenarios cover a project install that adds a user marketplace to the project: WR-07, MA-12, MA-13, D-MF-04, and a dependency's user git marketplace added to the project with a clone in each scope. | Verified drafts C01-C05 (cross-scope-install). Breaks C1-C4, C6, and C8 fail them. C8 also proves the already-covered LAYER-07 kept-after-remove rows. |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Read a file before you edit it, and trace callers before you change a function. Never commit to `main`. Update branches by merging, never by rebasing. Commit as `.agents/skills/committing/SKILL.md` describes, and never use `--no-verify`.
- Every plan `SUMMARY.md` has `## Threat Flags`, even when it is "None".
- GSD gates run `npm run check` on the combined tree. A passing hook is not a verdict. Inside `.claude/worktrees/...` the hook may check nothing, so run `npm run check:static` and the touched scenarios by hand before you commit (CONTEXT).
- A user-visible `/claude:plugin` change ships with a cucumber scenario that fails without it. This applies to the seeding fix if the phase takes it: a `.git`-spelled U01/U02 variant is that scenario.
- **Upstream parity:** a scenario expects Claude Code's behavior or names the ID that licenses a divergence. IDs these scenarios pin: D-09, CFG-03, LAYER-01, LAYER-02, LAYER-03, LAYER-07, WR-07, MA-12, MA-13, D-MF-04, D-SEED-01 (`[VERIFIED: grep of extensions/; each ID occurs in product comments]`). Precedent puts the ID in parentheses at the end of the title.
- **Parent lines:** no phase edits `CHANGELOG.md`, `.planning/BACKLOG.md`, or the PROJECT.md Key Decisions table. List those lines under "Parent lines" in the last plan's SUMMARY. A BACKLOG entry for the seeding finding, if the fix is not taken, is a parent line.
- **fallow audit:** each deleted or trimmed integration file gives one `weakened-tests` warn. Record it and move on; do not change `.fallowrc.json` or CI (user decision, STATE.md Blockers).
- Environment: prefix npm with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Pass `--parallel 2`, or `--parallel 1` when more than two executors share the 4 CPUs. Run direct coverage under `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp ...`.
- Comments and titles cite spec IDs, never `Phase N` or `Plan N` (CONVENTIONS.md).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| D-09 / LAYER-02 / CFG-03 flip gate | Orchestrators: `marketplace/autoupdate.ts:418-436` (`requireTargetDeclares`), `:510-519` (`planEveryFlip`) | `marketplace/shared.ts:1124-1159` (`marketplaceLayerVerdict`) | The gate runs inside the scope lock and before any write |
| D-07 local inherits base | Persistence: `config-merge.ts:110-113` | — | The merge is per field |
| Re-declaration with no clone (LAYER-01, MPA-01) | Orchestrators: `marketplace/add.ts:597-648` (`recordedSourceAction`), `:1071` | — | A reuse returns before `addMarketplaceToState` |
| Same-repo mirror seeding (D-SEED-01) | Orchestrators: `plugin/clone-cache.ts:767-819`, called from `add.ts:1236-1248` | Domain: `clone-key.ts:83-85` | A best-effort step after the commit |
| Layer, full, and refused remove (LAYER-02/03, MR-7) | Orchestrators: `marketplace/remove.ts:579-629` (`planStandaloneRemove`), `:653-680` (`commitRemove`), `:1212-1243` (cleanup) | — | Record, clone, and data removal follow `recordDeleted` |
| Cross-scope install add (LAYER-07, WR-07, D-MF-04) | Orchestrators: `plugin/install-outcome.ts:636-729` | `install-flow-cascade-context.ts:431-443` (`installCatalog`) | The target scope gets its own record and clone before the first read |
| Leftover and foreign tree recognition (MA-12, MA-13) | Orchestrators: `marketplace/add.ts:1672-1720` (`recognizeLeftover`) | Platform: `git.ts:911-960` (`listRemotes`) | The marker file plus a matching `origin` is the only authority to remove |
| Behavioral proof | `features/{marketplace,plugin}/*.feature` | the step modules named below | Test tier |

## Standard Stack

No packages are installed. The phase uses the harness in the repo.

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` (through `scripts/cucumber.mjs`, which passes extra CLI arguments through) | repo-pinned | Runs scenarios; profiles `adapter` and `builtin` `[VERIFIED: cucumber.json]` |
| Node | v24.22.3 | Runtime `[VERIFIED: node --version]` |
| The https git host stand-in | `features/lib/https-git-host/server.ts` | Serves url and github marketplaces and git plugins, and logs every request |

## Package Legitimacy Audit

None. The phase installs no external package.

## Architecture Patterns

### How a scenario reaches the behavior

```
Given publish (dir | url on the loopback git host) ─► Given add to user/project scope
      └─► Given hand edits: a config with this text, a leftover or foreign tree under sources/<name>/
When /claude:plugin <verb> (headless Pi, real extension, RPC)
      └─► JSON payload ─► "the result has these fields:" + "the result lists these plugins|marketplaces:" (every row)
      └─► git host request window (opened at each When) ─► "receives these requests:" / "receives no request"
      └─► disk: whole-scope snapshot, git clones, checkout files, data dir, configs, record
```

### Case inventory: what each integration case asserts, and what replaces it

Draft IDs refer to the verified scratch scenarios (`probe/*.feature`). "Break" IDs refer to the table under "Deliberate breaks".

**`test/integration/marketplace-layer-autoupdate.test.ts`: delete the file (all 6 cases covered)**

| Case (line) | Asserts | Covered by | Break |
|---|---|---|---|
| D-09 named flip, undeclared (`:127`) | `{marketplace not added}`, state and both configs byte-identical | NEW A01 → `marketplace/autoupdate.feature` | A1 |
| D-09 unnamed flip (`:155`) | rows for `extras` only; base config gains `autoupdate: true` for extras only | NEW A02 → `autoupdate.feature` | A2 |
| LAYER-02 ×2 (`:211`, a loop over 2) | refusal rows; no file changed | EXISTING `autoupdate.feature:262`, `:279` | A4 (also fails `:296`) |
| CFG-03 (`:234`) | `{invalid manifest}` naming `claude-plugins.local.json`; no file changed | NEW A03 → `autoupdate.feature` | A3 |
| D-07 (`:258`) | the list reads the base value a local entry inherits, then the local override | EXISTING `autoupdate.feature:241` (inherit) and `:574` (override) | A5a, A5b |

**`test/integration/marketplace-layer-redeclare.test.ts`: delete the file**

| Case | Asserts | Covered by | Break |
|---|---|---|---|
| `:96` local re-declaration | both configs declare it, state bytes unchanged, one clone in total, no git or credential call | NEW R01 → `marketplace/url-source.feature`. Config rows are also in `add.feature:116`'s `@url` row | D1 |
| `:123` recorded but undeclared | base config declares it again, the local config is absent, state bytes unchanged, no git call | NEW R02 → `url-source.feature` | D1 |

R01 and R02 check the clone with `the project scope holds these git clones:`, which shows exactly one marketplace clone. The integration's "state bytes unchanged" has no exact step: the whole-scope step cannot be used because the add writes a config. The git-host and clone checks catch the plausible regression, a second clone or a fetch. See Open Question 3.

**`test/integration/marketplace-layer-remove.test.ts`: trim to its 3 EACCES cases**

| Case | Asserts | Covered by | Break |
|---|---|---|---|
| `:197` base-layer remove keeps clone, data, local config, and local plugin | the alpha row; clone entries, data, local bytes, `beta-greet`, and the record unchanged | NEW M01 → `marketplace/remove.feature` (url; beta's data directory; clone; both configs; record; staged skill; no request) | R4, R9 |
| `:235` named remove of a recorded url marketplace no layer declares | removed; no clone and no data directory; empty state | NEW M02 (with an installed plugin and its data) and optional M02b (empty marketplace) → `remove.feature` | R1 |
| `:265` refused remove changes nothing | the local-layer-only refusal row; state, configs, clone, and skills unchanged | NEW M03 → `remove.feature` (whole project scope). The dir version is `remove.feature:343` | R3 |
| `:321` blockers | every `dependents remain` row; nothing changed | EXISTING `remove.feature:542` (and `:514`) | R6 |
| `:418` partial remove (EACCES) | — | **stays** (fault injection, Phase 8) | — |
| `:576` failure-only remove (EACCES) | — | **stays** | — |
| `:680` LAYER-02, the other layer unreadable | the `{invalid manifest}` row; footprint unchanged | NEW M04 → `remove.feature` (whole project scope) | R2 |
| `:708` PRUNE-03 (EACCES) | — | **stays** | — |
| `:748` D-05-07 | the `{unreadable}` row; footprint unchanged | EXISTING `remove.feature:592` | R7 |
| `:777` LAYER-03 keeps the url dependency, its record, data, and clone, and converges | rows; clone; data; record; `planReconcile` empty | NEW M05 (keep) + M06 (`pending` reports `reconcile-pending-empty`) → `remove.feature` | R4, R5, R9 |
| `:841` lock held | the `{lock held}` row; footprint unchanged | EXISTING `marketplace/state-lock.feature:7` (and `:37`) | R8 |

After the trim the file keeps `:418`, `:576`, and `:708`. Remove the imports that only deleted cases used: `lockfile` (`proper-lockfile`), `planReconcile`, `emptyReconcilePlan`, `mergeScopeConfigs`, `loadConfig`, and `saveConfig`. Check with `npm run typecheck` and `npm run lint`. `addMarketplace`, `ALPHA_WITH_LIB_INSTALLED`, `ALPHA_NEEDS_LIB`, `removeFootprint`, `removeMp`, and `installed()` are still used `[VERIFIED: read of the file]`. Rewrite the header (`:1-8`) so it describes what is left.

**`test/integration/marketplace-add-seed-mirrors.test.ts`: keep the internal cases**

| Case | Class | Disposition |
|---|---|---|
| `:155` seeds a same-repository URL plugin mirror with one clone (mirror exists, probe `available`, one clone call) | its user-visible half is "the plugin is available after the add" | NEW U01 (pinned install, no request) + U02 (`list` shows `available`) → `url-source.feature`. Break D2 fails both. **Delete `:155` only if the planner reads it as the user-visible case** (Open Question 1); CONTEXT lists "mirror seeding" as internal |
| `:202` path marketplace, no git calls | internal ("no-call checks") | stays |
| `:253` different repository left remote and unseeded | internal | stays. A U03 "lists as remote" draft passes, but no plausible break fails it (D3 did not), so it proves nothing |
| `:299` reachable pin seeded, unreachable left unseeded | internal ("unseeded pin") | stays |
| `:357` mirror keeps the real remote URL | internal ("mirror remote") | stays |
| `:396` clone GC sweeps an unreferenced mirror | internal ("mirror GC") | stays |

`test/integration/path-source-tag-install.test.ts:8` cites this file. It stays valid because the file stays.

**`test/integration/project-install-adds-user-marketplace.test.ts`: delete the file**

| Case | Asserts | Covered by | Break |
|---|---|---|---|
| `:214` LAYER-07: the project keeps the marketplace after a user-scope remove (+ list, info, update fetch only the project clone) | rows, clone targets, record paths, config | EXISTING `remove.feature:695`, `:731`, `:771` Outlines, whose `@url`/`@github` rows include the git host log | C8 (fails the url and github rows `:724`, `:729`, `:764`, `:769`, `:796`, `:801`) |
| `:330` WR-07: a plugin the manifest lacks fails before the project clones | `{not in manifest}` row; one clone (user) only; no project record, sources, staging, or base config | NEW C01 → `plugin/cross-scope-install.feature` | C1 |
| `:355` MA-12: a leftover clone is replaced | installed row; `stale.txt` gone; manifest present; record has `p` | NEW C02 → `cross-scope-install.feature` | C2 |
| `:386` MA-13: a foreign tree is refused and kept | `{stale clone}` row; `notes.txt` kept; no record or base config | NEW C03 → `cross-scope-install.feature` | C3 |
| `:416` D-MF-04: dependencies come from the fresh project clone | app + `lib@mp` installed; record holds both | NEW C04 → `cross-scope-install.feature` | C4 |
| `:446` a dependency's user git marketplace is added to the project, with a clone in each scope | rows; one clone per scope; project config | NEW C05 → `cross-scope-install.feature` (the dir version is `:6`) | C6 |

No helper is left without a user once the three files are deleted. Users outside the deleted files and outside each helper's own module: `createNotificationBoundary` 40, `createMachineNotificationBoundary` 25, `createHermeticEnvironment` 92, `runWithNothingLoaded` 96, `createGitOpsFake` 24, `createCredentialOpsFake` 20, `noStatusReaders` 9 `[VERIFIED: grep of test/]`. No file outside `.planning/` names the deleted files, except `path-source-tag-install.test.ts:8`, which names seed-mirrors, a file that stays `[VERIFIED: grep]`.

### Existing steps to use (file:line)

| Step | Module |
|---|---|
| `the marketplace {string} is published as a {source kind} source` | `marketplace/publishing.steps.ts:63` |
| `the marketplace {string} offers these plugins:` / `... with dependencies:` | `marketplace/publishing.steps.ts:138` / `:145`. For a url kind each call commits and pushes a new revision (`published-marketplace.ts:162-181`), which **is the D-MF-04 setup**: add to the user scope, then offer the new dependency list |
| `the marketplace {string} allows dependencies on the marketplace {string}` / `is added to the {word} scope` | `marketplace/publishing.steps.ts:200` / `:207` |
| `the user has run {string}` / `the user runs {string}` | `command.steps.ts:91` / `:123` |
| `the result has these fields:` / `lists these plugins:` / `lists these marketplaces:` | `command.steps.ts:158` / `:166` / `:173` |
| `a config in scope {word} and layer {word}, with this text:` / `with these marketplaces:` | `config.steps.ts:195` / `:178`. The text step writes raw text with no token expansion. The marketplaces step expands `{home}`, and an empty `autoupdate` cell writes no `autoupdate` key (`layer-config.ts:78-89`) |
| `the files of the {word} scope are remembered` / `are unchanged` | `scope-state.steps.ts:64` / `:71`. **Throws if the scope root does not exist yet.** Before a cross-scope install the project `.pi` does not exist (measured) |
| `the git host receives no request` / `receives these requests:` | `git-host.steps.ts:324` / `:268`. Only the last `When`'s window |
| `the {word} scope holds these git clones:` / `holds no git clones` | `plugin/installation.steps.ts:602` / `:622`. Columns `clone \| origin \| revision`. A marketplace clone has an empty revision |
| `the {word} scope holds no marketplace checkout` / `holds no marketplace record` | `marketplace/checkout.steps.ts:45` / `:59` |
| `the data directory of {string} in the {word} scope holds the file {string} with the text {string}` / `holds these files:` | `plugin/installation.steps.ts:243` / `:534`. The Given **requires the directory to exist**, and only a root install creates it |
| `the installation record of the {word} scope holds these plugins:` / `the {word} scope stages these skills and prompts:` | `plugin/installation.steps.ts:464` / `:451` |
| `the {string} file of the {word} scope declares these marketplaces:` / `declares these plugins:` / `does not exist` / `declares no marketplaces` / `declares no plugins` | `config.steps.ts:228` / `:250` / `:266` / `:274` / `:283` |

### New steps (verified in a scratch module; the plan names the shared files)

Each was run as `--import <scratch>/probe.steps.ts`. The scratch version types `this` as `any`. The typed skeletons under "Code Examples" are `[ASSUMED]` to typecheck and need the usual `npm run typecheck` / `lint` pass.

1. **`the marketplace {string} offers these plugins from its own repository:`**, in `marketplace/publishing.steps.ts`, with a builder in `features/lib/git-plugin.ts` beside `gitPluginEntry`/`offerGitPlugins` (`git-plugin.ts:324-386`). Use the table `| name | version | url | pinned |`. It republishes the url or github marketplace with the plugins' files (`republishMarketplace`), reads `HEAD` with `runGit(published.root, published.gitHome, "rev-parse", "HEAD")`, then rewrites each entry's source to `{ source: "git-subdir", url: expandTokens(url), path: "plugins/<name>", sha? }` and pushes (`rewritePublishedManifest`). The `url` cell makes the `.git` spelling visible to the reader. That matters because of the seeding finding.
2. **`the {word} scope holds a checkout of the marketplace {string} that an interrupted add left`** (MA-12), in `marketplace/checkout.steps.ts`. I verified two variants. The minimal one writes `sources/<name>/.git/config` with `[remote "origin"]\n\turl = <repositoryUrl>`, the marker `.git/pi-claude-marketplace.json` (`{"generatedBy":"pi-claude-marketplace"}`, the file name from `add.ts:1653`), and `stale.txt`. The faithful one runs `git clone --quiet <bareRepository> <name>` under `sources/`, sets `origin` to the url, and writes the marker and `stale.txt`. Both pass C02, and break C2 fails both. Recommend the faithful variant: it is what an interrupted add leaves.
3. **`the {word} scope holds a directory of the user's own where the checkout of the marketplace {string} goes`** (MA-13): it writes `sources/<name>/notes.txt` and nothing else.
4. **`the checkout of the marketplace {string} in the {word} scope holds these files:`**: it lists the file paths under `sources/<name>/`, outside `.git/`, sorted, against `| file |`. It proves `stale.txt` is gone (MA-12) and `notes.txt` is kept (MA-13).
5. **`the plugin {string} has written the file {string} with the text {string} to its data directory in the {word} scope`**, in `plugin/installation.steps.ts`: `mkdir -p data/<mp>/<plugin>`, then write the file. It models a plugin that writes `${CLAUDE_PLUGIN_DATA}` at run time.
6. **`the {word} scope holds no plugin data`**, in `plugin/installation.steps.ts`: `pi-claude-marketplace/data` is absent or empty.

### Verified scenario drafts (all green under adapter)

Full text: `research-03/probe/{autoupdate,url,remove,cross}.feature`. The key rows follow. Titles are suggestions, within Claude's discretion.

**`marketplace/autoupdate.feature` (plan 03-01)**

- **A01** "Enabling autoupdate of a marketplace the scope records but no layer declares fails as not added and changes nothing (D-09)": dir `tools` added to project; `a config in scope project and layer base, with this text: { "schemaVersion": 1, "marketplaces": {} }`; remember the project files; `When … marketplace autoupdate tools --scope project`. Fields: `kind marketplace-not-added | severity error | needs reload false | summary A marketplace operation has failed. | name tools | scope project | reasons marketplace not added`. Then the project files are unchanged.
- **A02** "Enabling autoupdate for every marketplace gives no row to a marketplace the scope records but no layer declares (D-09)": dir `tools` and `extras` added; `a config … with these marketplaces:` declaring only `extras` (empty autoupdate cell); `When … marketplace autoupdate --scope project`. Fields: `cascade | info | false | tally label Marketplace autoupdate | 0 | 0 | success count 1`; marketplaces `extras | project | autoupdate enabled`; base declares only `extras` with `autoupdate true`. Add `the "claude-plugins.local.json" file of the project scope does not exist`.
- **A03** "Enabling autoupdate without --local of a marketplace only the local layer declares fails as invalid manifest when the local config cannot be read, and changes nothing (CFG-03)": `marketplace add … --local`; local config text `{ malformed`; remember the files; `When … autoupdate tools --scope project`. Fields `cascade | error | false | Some operations have failed.`; plugin row `tools | project | failed | tools | tools | failed | invalid manifest | project | Config file "claude-plugins.local.json" failed schema validation. | false | |`. Then the files are unchanged.

**`marketplace/url-source.feature` (plan 03-03)**

- **R01** "Adding with --local a url marketplace that the base layer declares makes no second clone and no git request (LAYER-01)": url `tools` added to project; `When … marketplace add https://{git host}/acme/tools.git --scope project --local`. Fields `cascade | info | false`; marketplaces `tools | project | added`; `the git host receives no request`; git clones: one row, `marketplace | https://{git host}/acme/tools.git |`; both configs declare `tools` with that source.
- **R02** "Adding again a url marketplace that the scope records but no layer declares declares it with no git request (LAYER-01)": as R01, but the base config text is `{ "schemaVersion": 1, "marketplaces": {} }` and the add runs without `--local`. The same rows, base declares it, and the local config does not exist.
- **U01** "Installing a pinned plugin from the repository of a url marketplace makes no git request after the add (D-SEED-01)": url `tools`; `offers these plugins from its own repository: | demo | 1.0.0 | https://{git host}/acme/tools | true |`; added to project; `When … install demo@tools --scope project`. Fields `cascade | info | true`; row `tools | project | demo@tools | demo | installed | | project | 1.0.0`; the git host receives no request. Do **not** add `holds these git clones:`: the pinned copy's revision is the marketplace repository's commit, and no run token projects it.
- **U02** "A plugin from the repository of a url marketplace lists as available right after the add (D-SEED-01)": the same setup, unpinned; `When … list --scope project`. Fields `cascade | info | false | Plugin list | 0 | 0 | 1`; row `tools | project | demo@tools | demo | available | | 1.0.0`.

**`marketplace/remove.feature` (plan 03-02)**

- **M01** (url `tools`, alpha and beta; add, `--local` add, install alpha in base and beta `--local`; beta's data directory holds `notes.txt`; remove): fields `cascade | info | true`; row `tools | project | removed | alpha@tools | alpha | uninstalled | | project`; git clones: the one marketplace clone; beta's data `notes.txt | Kept by the user.`; base declares no marketplaces and no plugins; local declares `tools` and `beta@tools`; record `beta@tools 1.0.0 true`; stages `skill beta-skill`; the git host receives no request.
- **M02** (url `tools` with demo installed; demo's data holds a file; base text `{ "schemaVersion": 1, "marketplaces": {}, "plugins": {} }`; remove): `cascade | info | true`; row `removed | demo@tools | uninstalled`; `holds no marketplace record`, `holds no marketplace checkout`, `holds no git clones`, NEW `holds no plugin data`, no request. **M02b** (no plugin): marketplaces `tools | project | removed`, `needs reload false`, the same record, checkout, and clone checks.
- **M03** (url `tools`; `--local` add; `install beta@tools --local`; remember the project files; remove without `--local`): `cascade | error | false | Some operations have failed.`; the `marketplace in local layer only` row with its cause (the text of `remove.feature:353`); the files are unchanged.
- **M04** (url `tools` in both layers; alpha installed in base; local text `{ not json`; remember; remove): the `invalid manifest` row naming `claude-plugins.local.json`; the files are unchanged.
- **M05** (url `tools`: alpha needs `lib`; dir `upstream`: app needs `lib@tools`, allows `tools`; both added to project; install alpha, then app; NEW "lib@tools has written notes.txt"; remove tools): `cascade | info | true`; row `tools | project | removed | alpha@tools | alpha | uninstalled`; the one marketplace clone; lib's data `notes.txt`; record `app@upstream` and `lib@tools`; base declares only `upstream`.
- **M06** (the M05 setup, then `Given the user has run "…marketplace remove tools --scope project"`; `When … pending --scope project`): `kind reconcile-pending-empty | info | false`.

**`plugin/cross-scope-install.feature` (plan 03-04)**

- **C01** (url `tools` with demo added to the **user** scope; remember the **user** files; `When … install ghost@tools --scope project`): `cascade | error | false | A plugin operation has failed.`; row `tools | project | ghost@tools | ghost | failed | not in manifest | project | | | Plugin "ghost" not found in marketplace "tools". | false`; no request; the project holds no marketplace record and no checkout; the project's `claude-plugins.json` does not exist; the user files are unchanged. (The failed install leaves an empty `.pi/pi-claude-marketplace/`, measured, so whole-scope checks on the project cannot be used here.)
- **C02** (the same user setup; NEW leftover Given; `When … install demo@tools --scope project`): `cascade | info | true`; `demo installed 1.0.0`; NEW checkout files `.claude-plugin/marketplace.json`, `plugins/demo/.claude-plugin/plugin.json`, `plugins/demo/skills/demo-skill/SKILL.md`; the one marketplace clone; requests GET `/acme/tools.git/info/refs?service=git-upload-pack` 200 and POST `/acme/tools.git/git-upload-pack` 200.
- **C03** (NEW foreign-tree Given; remember the user files; install): row `demo@tools | demo | failed | stale clone | project | | | stale source clone at tools | false`; NEW checkout files `notes.txt`; no marketplace record; the project's `claude-plugins.json` does not exist; the user files are unchanged. The whole-scope step on the project **cannot** be used: the install leaves a new empty `sources-staging/` (measured). The integration case accepted that too (`treeOf` of an empty directory is `[]`).
- **C04** (url `tools` offers `app` 1.0.0 → added to user → `offers these plugins with dependencies: app→lib, lib` → `install app@tools --scope project`): rows `app@tools app installed` and `lib@tools lib@tools installed` (a dependency row's `name` cell is `lib@tools`); record `app@tools`, `lib@tools`.
- **C05** (url `tools` offers lib; dir `upstream`: app needs `lib@tools`, allows tools; both added to user; `install app@upstream --scope project`): two installed rows; the project and the user each hold the one `tools` marketplace clone; requests: one GET+POST pair for `/acme/tools.git`; project base declares `upstream` (`{home}/marketplaces/upstream`) and `tools` (`https://{git host}/acme/tools.git`), plugins `app@upstream`.

### Deliberate breaks (each applied, run, and reverted in this session)

Each is a one-substring replacement (`assert count == 1`). The old and new text are in `research-03/brk/<id>.old|.new`. Paths are relative to `extensions/pi-claude-marketplace/`. The guard `G` is `&& process.env.NEVER_SET === "x"` (the condition never holds). Line numbers were read this session.

| ID | Site | Edit | Failed | Passed (selected) |
|---|---|---|---|---|
| A1 | `orchestrators/marketplace/autoupdate.ts:429` `if (verdict.kind === "undeclared") {` | add G | A01 | A02, A03 |
| A2 | `autoupdate.ts:516` `(name) => layers.filter(…)` | `(name) => layers,` | A02 | A01, A03 |
| A3 | `autoupdate.ts:433` `if (verdict.kind === "other-unreadable") {` | add G | A03 | A01, A02 |
| A4 | `autoupdate.ts:425` `if (verdict.kind === "refused") {` | add G | `autoupdate.feature:262`, `:279`, `:296` | 40 others |
| A5a | `persistence/config-merge.ts:112` `{ ...baseEntry, ...entry }` | `{ ...entry }` | `autoupdate.feature:241` | 42 |
| A5b | same line | `{ ...entry, ...baseEntry }` | `autoupdate.feature:574` | 42 |
| D1 | `orchestrators/marketplace/add.ts:1071` `if (action?.kind === "reuse") {` | add G | R01, R02 | U01, U02 |
| D2 | `add.ts:1242` `marketplaceName: name,` (the seeding call) | `` `${name}-never` `` | U01, U02 | R01, R02 |
| R1 | `orchestrators/marketplace/remove.ts:620`, before the `fullRemovePlan` branch | `if (verdict.kind === "undeclared") return { layerOnly: true, entries: fullRemovePlan(…).entries };` | M02, M02b | the rest |
| R2 | `remove.ts:613` `if (other.status === "invalid") {` | add G | M04 | the rest |
| R3 | `remove.ts:609` `if (verdict.kind === "refused") {` | add G | M03 | the rest |
| R4 | `remove.ts:1231` `if (args.recordDeleted) {` | `\|\| process.env.NEVER_SET === undefined` | M01, M05 | M02-M04, M06 |
| R5 | `remove.ts:677` `… .length === 0;` | `>= 0` | M05, M06 | the rest |
| R9 | `remove.ts:1227`, before `if (!args.allPluginsUnstaged)` | `await removePath(locations.marketplaceDataDir(name));` | M01, M05 (data checks only) | the rest |
| R6 | `remove.ts:760` `if (!plan.layerOnly \|\| index === undefined) {` | `\|\| process.env.NEVER_SET === undefined` | `remove.feature:514`, `:542` | 50 |
| R7 | `remove.ts:718` `throw new DeclarationIndexStop(result.cause);` | `return undefined;` | `remove.feature:592` | 51 |
| R8 | `remove.ts:1137` `if (err instanceof StateLockHeldError) {` | add G | `state-lock.feature:7`, `:37` | 30 |
| C1 | `orchestrators/plugin/install-outcome.ts:723` `if (plugin !== undefined) {` (`requireListedBeforeAdd`) | add G | C01 | C02-C05 |
| C2 | `add.ts:1707` `return cleanupStaging(removalOps, finalDir, "marketplace leftover clone");` | `throw new StaleSourceCloneError(finalDir, derivedName);` | C02 (both variants) | the rest |
| C3 | `add.ts:1710-1715`, the `not-a-repo` throw | `return cleanupStaging(removalOps, finalDir, "foreign tree");` | C03 | the rest |
| C4 | `orchestrators/plugin/install-flow-cascade-context.ts:442` | the walk's lookup prefers the user scope's record (`userFirst` wrapper, `brk/C4.new`) | C04 | the rest |
| C6 | `install-outcome.ts:727`, before `return addTargetScopeMarketplace(` | `if (process.env.NEVER_SET === undefined) return source.sourceRecord;` | C02-C05 + `cross-scope-install.feature:6`, `:58-69` + the `remove.feature` LAYER-07 Outlines | — |
| C8 | `install-outcome.ts:667` `return targetRecord;` | `Object.assign(targetRecord, { marketplaceRoot: sourceRecord.marketplaceRoot, manifestPath: sourceRecord.manifestPath });` first | C04 + `remove.feature:724`, `:729`, `:764`, `:769`, `:796`, `:801` (url and github rows) | dir and file rows |

Breaks that **failed nothing**, and why:
- C5 (skip the add only for a walk call without `plugin`) passed everything: the ledger calls `resolveTargetScopeMarketplace` again with the plugin and adds the marketplace then. C6 is the break for C05. It fails C05 at the install row, so it is coarser.
- C7 (return a copy with the user's roots) passed everything: the copy is used for one read only. C8 persists the change and is the faithful break.
- D3 (seed every git source, `clone-cache.ts:800`) left U03 green: a seed is keyed by the marketplace URL, so another repository's key never gets one. U03 was dropped.

### Product finding: `.git`-spelled git-subdir plugins are never seeded (D-SEED-01)

- **Measured.** With `url: https://{git host}/acme/tools.git` on the git-subdir entry, U02 lists `remote` and U01 makes GET+POST requests. With `…/acme/tools`, both pass (`probe-seed.log`, `seed.feature`).
- **Cause.** `seedSameRepoPluginMirrors` compares `canonicalCloneUrl(src)` to the marketplace URL (`clone-cache.ts:800`). A `url` marketplace source strips `.git` at parse time (D-76-01, `source.ts:91-108`). A `git-subdir` source keeps its `url` verbatim (`source.ts:256-264`; `test/domain/source.test.ts:243-251` and `test/domain/clone-key.test.ts:303` pin this). The docstring of `canonicalCloneUrl` (`clone-key.ts:72-76`) says git-subdir is `.git`-stripped too. That is not true.
- **Candidate fix (tried and reverted; it made the `.git` variants of S01 and S02 pass).** In `seedSameRepoPluginMirrors`, compare both URLs with one trailing `.git` removed. In `seedOnePluginMirror` (`clone-cache.ts:694-697`), key the seed by `canonicalCloneUrl(source)` instead of `marketplaceUrl`, so the key is the one install and the probe compute. No existing key changes, because only cases that never seeded now seed. It needs a unit test in `test/orchestrators/plugin/clone-cache.test.ts` (direct coverage stays at 100%) and a `.git` variant of U01/U02 that fails without it. Also correct the `clone-key.ts` docstring.
- **Disposition.** Rule 4: the fix is small (about 4 lines plus a test), but it changes product code in a test-migration phase. The planner confirms with the user, or records a BACKLOG parent line. No integration case guards this, so nothing has to stay.

### Anti-patterns to avoid

- **Whole-scope steps on a scope that does not exist yet.** `scopeFiles` calls `readdir` on the scope root. Before a cross-scope install, the project `.pi` is absent (measured). The Given throws.
- **Whole-scope steps around a command that legitimately creates an empty directory.** MA-13's refused install creates `sources-staging/` (measured). Use the targeted checks listed for C03.
- **`holds these git clones:` with a pinned seed copy.** Its revision is the marketplace repository's commit, and no `{… revision n}` token covers marketplace repositories.
- **A partial row table.** The world's After hook fails a scenario that leaves result rows unchecked.
- **A git-host log step in an Outline shared with local kinds** (steps.md). Every new git-host check sits in a url-only scenario.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| A user clone older than the marketplace (D-MF-04) | a stale-clone fixture step | add to the user scope, then `offers these plugins with dependencies:` (it pushes a new revision for a url kind) | `published-marketplace.ts:162-181` commits and pushes on every change. Verified in C04 |
| "Changes no file" | another snapshot step | `the files of the {word} scope are remembered/unchanged` (whole scope) | Phase 2's review: the narrow byte steps missed regressions |
| A url marketplace on the network | anything outside the harness | `the marketplace … is published as a url source` + `{git host}` | Loopback host with a request log |
| Seeing actual rows while drafting | logging in steps | a deliberately wrong `Then`; the assertion diff prints every row | Used throughout this session |
| Running a draft step outside the repo | editing `features/step_definitions/` | `npm run test:cucumber:profile -- --profile adapter --import <scratch>.steps.ts <feature>`, importing `@cucumber/cucumber` by its absolute `node_modules/@cucumber/cucumber/lib/wrapper.mjs` path | Verified: the CLI `--import` adds to the profile's list (a run with only the scratch import still found the repo steps) |

## Runtime State Inventory

Not a rename or migration phase. The section does not apply: the phase deletes and trims test files and changes no runtime state. The optional seeding fix changes no key that is already in use (see the finding).

## Common Pitfalls

### Pitfall 1: The unpinned same-repository install always fetches
**What goes wrong:** an executor writes ROADMAP criterion 2 literally ("installing a url plugin from the same repository … makes no git request") with an unpinned plugin, and the scenario fails.
**Why:** MIRR-02 / D-79.1-02 refresh a warm mirror on install (`clone-cache.ts:520-540`). The fetch requests look like a clone's.
**How to avoid:** U01 is pinned. U02 proves the unpinned seed through `list` → `available`. Name the pin in U01's title.

### Pitfall 2: The `.git` spelling in the own-repository step
Writing `https://{git host}/acme/tools.git` in the `url` cell makes U01 and U02 fail (the seeding finding). Without the product fix, use `https://{git host}/acme/tools`. With the fix, add the `.git` row as the scenario that fails without it.

### Pitfall 3: Dependency installs have no data directory
`Given the data directory of "lib@tools" … holds the file …` fails with "does not exist, so the install did not create it" (measured). Use the new "has written" step for a dependency.

### Pitfall 4: Break verify commands
Cucumber prints a failed scenario as `  N) <title> # <file>:<line>`. Match `^  [0-9]+\) .* # features/<dir>/<file>\.feature:[0-9]+$`, and assert the run did not print `0 scenarios`. A `file:line` filter must point at the `Scenario:` line.

### Pitfall 5: The builtin profile selects nothing here
No draft has an MCP surface, so `--profile builtin` prints `0 scenarios`, exit 0 (measured on all four probe files). Record "0 selected (DUAL-02)", and put no implementation tag on these scenarios.

### Pitfall 6: Config text and tokens
`a config … with this text:` does not expand `{home}` or `{git host}`. Write an empty `marketplaces` member there (it holds no path), or use `with these marketplaces:`, which expands tokens.

### Pitfall 7: A scratch step module must import cucumber by absolute path
A step module outside the repo cannot resolve `@cucumber/cucumber` by name. Import `/home/user/pi-claude-marketplace/node_modules/@cucumber/cucumber/lib/wrapper.mjs`, so it registers with the same instance that the repo steps use. The CLI `--import` adds to the profile's globs (verified). This is a research technique only: committed steps go in `features/step_definitions/`.

### Pitfall 8: Parallel executors on 4 CPUs
Four plans in one wave means four cucumber runners. Use `--parallel 1` per executor when more than two run at once.

### Pitfall 9: The ambiguous D-09
`D-09` also names the same-filesystem staging rule in `add.ts:23` and other places. The ROADMAP and the integration titles use D-09 for "recorded but no layer declares", and so do the drafts. If a reviewer objects, D-MF-03 (`autoupdate.ts:510-519`) and LAYER-03 (`remove.ts:588-590`) are the IDs that the product comments give to this behavior.

## Code Examples

Typed skeletons of the new steps. The behavior is verified, but these typed forms are `[ASSUMED]` to pass typecheck and lint until an executor runs them.

```ts
// marketplace/checkout.steps.ts -- MA-12, the faithful variant (verified as the scratch "cloned checkout" step)
Given(
  "the {word} scope holds a checkout of the marketplace {string} that an interrupted add left",
  async function (this: ScenarioWorld, scope: string, name: string) {
    const published = this.requirePublished(name);
    if (published.kind !== "url" && published.kind !== "github") {
      assert.fail(`the marketplace ${name} is not published on the git host`);
    }

    const sources = path.join(extensionRootOf(this, scope), "sources");
    const checkout = path.join(sources, name);
    const url = this.gitHost.repositoryUrl(published.repository, published.owner);
    assert.equal(existsSync(checkout), false);
    await mkdir(sources, { recursive: true });
    await runGit(sources, published.gitHome, "clone", "--quiet", published.bareRepository, name);
    await runGit(checkout, published.gitHome, "remote", "set-url", "origin", url);
    // Q-01: the marker every clone of `marketplace add` carries (add.ts:1653).
    await writeFile(
      path.join(checkout, ".git", "pi-claude-marketplace.json"),
      JSON.stringify({ generatedBy: "pi-claude-marketplace" }),
    );
    await writeFile(path.join(checkout, "stale.txt"), "left behind");
    assert.equal(await runGit(checkout, published.gitHome, "remote", "get-url", "origin"), url);
  },
);

Then(
  "the checkout of the marketplace {string} in the {word} scope holds these files:",
  async function (this: ScenarioWorld, name: string, scope: string, table: DataTable) {
    const checkout = path.join(extensionRootOf(this, scope), "sources", name);
    const entries = await readdir(checkout, { recursive: true, withFileTypes: true });
    const rows = entries
      .filter((entry) => !entry.isDirectory())
      .map((entry) => path.relative(checkout, path.join(entry.parentPath, entry.name)))
      .filter((file) => file.split(path.sep)[0] !== ".git")
      .sort((left, right) => left.localeCompare(right))
      .map((file) => [file]);
    assert.deepStrictEqual([["file"], ...rows], table.raw());
  },
);
```

```ts
// marketplace/publishing.steps.ts + features/lib/git-plugin.ts -- the own-repository offer (verified)
Given(
  "the marketplace {string} offers these plugins from its own repository:",
  async function (this: ScenarioWorld, name: string, table: DataTable) {
    const published = this.requirePublished(name);
    // readOwnRepositoryOffers: | name | version | url | pinned |, throwing on a missing or unknown column.
    const offers = readOwnRepositoryOffers(table);
    await republishMarketplace(published, name, offers);           // commits the plugin files
    const commit = await runGit(published.root, published.gitHome, "rev-parse", "HEAD");
    const text = await readFile(published.manifestPath, "utf8");
    await rewritePublishedManifest(                                 // commits the git-subdir entries
      published,
      offerOwnRepositoryPlugins(text, offers, commit, this.tokens), // source: git-subdir, url, path plugins/<name>, sha when pinned
    );
  },
);
```

Break helper (the Phase 1 and 2 pattern), as used here:

```bash
F=extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts; trap "git checkout -- $F" EXIT
python3 -c 'import sys;p,o,n=sys.argv[1:4];s=open(p).read();o=open(o).read();n=open(n).read();assert s.count(o)==1;open(p,"w").write(s.replace(o,n))' "$F" R5.old R5.new
npm_config_script_shell=… NODE_OPTIONS=--max-old-space-size=6144 \
  npm run --silent test:cucumber:profile -- --profile adapter --parallel 2 features/marketplace/remove.feature > "$D/R5.log" 2>&1
git checkout -- "$F"; trap - EXIT; git status --porcelain -- extensions/   # must print nothing
grep -E '^  [0-9]+\) .* # features/marketplace/remove\.feature:[0-9]+$' "$D/R5.log"
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v24.22.3 | — |
| non-DAC shell wrapper | npm scripts | ✓ | `…/36571f01-…/scratchpad/nondac-sh` | — |
| git CLI (the publishing harness and the faithful MA-12 Given use `runGit`) | url publications | ✓ (used by every url scenario this session) | — | the minimal MA-12 variant needs no git call |
| Optional peers | cucumber harness | ✓ (`install-test-peers.mjs` runs in `test:cucumber:profile`) | per `optional-peer-suite-versions.json` | — |

Measured adapter timings (`--parallel 2`, wall clock including the peer install step): `marketplace/add` 11 s (51 scenarios), `marketplace/autoupdate` 9 s (43), `marketplace/remove` 12 s (52), `marketplace/url-source` 7 s (9), `plugin/cross-scope-install` 6 s (5), `marketplace/state-lock` 10 s (32). Each probe file of 4 to 7 scenarios takes 5 to 8 s. Both integration files that stay run in about 2 s each.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | cucumber-js (behavioral), node:test (the trimmed integration files and any seeding-fix unit test) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`) |
| Quick run command | `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/marketplace/<file>.feature` (6 to 12 s) |
| Feature gate | `npm run check:features` (inside `check:static`): layout, lower-case steps, Given order, tags, and unused, undefined, or ambiguous steps |
| Integration (trimmed files) | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/integration/marketplace-layer-remove.test.ts` (about 2 s) |
| Full suite command | `npm run check` (phase gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITMIG-05 | D-09 ×2, CFG-03 flips | behavioral | `… --profile adapter --parallel 2 features/marketplace/autoupdate.feature` | ✅ (scenarios new) |
| ITMIG-05 | re-declaration with no request; same-repo seeding | behavioral | `… features/marketplace/url-source.feature` | ✅ |
| ITMIG-05 | url remove: base layer, undeclared, refused, LAYER-02, LAYER-03 + convergence | behavioral | `… features/marketplace/remove.feature` | ✅ |
| ITMIG-05 | EACCES cases kept | integration | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/integration/marketplace-layer-remove.test.ts` | ✅ (trimmed) |
| ITMIG-05 | internal mirror cases kept | integration | `… --test test/integration/marketplace-add-seed-mirrors.test.ts` | ✅ |
| ITMIG-06 | WR-07, MA-12, MA-13, D-MF-04, dependency marketplace | behavioral | `… features/plugin/cross-scope-install.feature` | ✅ |
| all | red proofs | break + adapter run | break helper above; match `^  N\) <title> # <file>:<line>` | evidence in SUMMARY |
| (optional) | seeding fix | unit + behavioral | direct coverage of `orchestrators/plugin/clone-cache.ts` + the `.git` U01/U02 row | ❌ new test case |

### Sampling Rate
- **Per task commit:** the touched feature file under adapter, plus `npm run check:static` (which includes `check:features`).
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green (adapter and builtin), then `/gsd-verify-work`.

### Wave 0 Gaps
None blocking. The six new steps are part of the plans that use them (each plan owns its shared module), not a separate wave.

## Security Domain

`security_enforcement` is absent, so it is enabled. The phase changes tests, plus the optional seeding fix.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3/V4 | no | — |
| V5 Input Validation | indirectly: the scenarios pin MA-13's refusal to remove a foreign tree, and CFG-03 and LAYER-02 refusals on unreadable configs | `recognizeLeftover` (`add.ts:1672`), `marketplaceLayerVerdict` |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Deleting a user's directory at the clone path | Tampering / data loss | MA-13: only the marker plus a matching `origin` licenses removal; C03 pins it, and break C3 proves the check |
| Seeding from the wrong tree (the optional fix) | Tampering | the seed still requires the same repository after `.git` normalization; SEED-03 different-repo skip unchanged; per-commit pins still require a checkout of the sha (SEED-04) |
| A break left in the tree | Tampering (test integrity) | EXIT-trap `git checkout`; `git status --porcelain -- extensions/` empty; never committed |

## Plan Split (suggested)

One wave of four plans with disjoint files. Each shared step module has exactly one owning plan in the wave, so no plan depends on another.

| Plan | Req | Feature file | Shared files it owns | Integration files | Breaks |
|---|---|---|---|---|---|
| 03-01 | ITMIG-05 (flips) | `features/marketplace/autoupdate.feature` (A01-A03) | none | delete `marketplace-layer-autoupdate.test.ts` | A1, A2, A3, A4, A5a, A5b |
| 03-02 | ITMIG-05 (remove) | `features/marketplace/remove.feature` (M01-M06, M02b optional) | `features/step_definitions/plugin/installation.steps.ts` (the "has written" and "holds no plugin data" steps) | trim `marketplace-layer-remove.test.ts` to `:418`, `:576`, `:708` | R1-R9 |
| 03-03 | ITMIG-05 (add, seeding) | `features/marketplace/url-source.feature` (R01, R02, U01, U02) | `features/step_definitions/marketplace/publishing.steps.ts`, `features/lib/git-plugin.ts` (own-repository offer); optional `orchestrators/plugin/clone-cache.ts` + its unit test (seeding fix) | delete `marketplace-layer-redeclare.test.ts`; seed-mirrors `:155` per Open Question 1 | D1, D2 |
| 03-04 | ITMIG-06 | `features/plugin/cross-scope-install.feature` (C01-C05) | `features/step_definitions/marketplace/checkout.steps.ts` (MA-12, MA-13 Givens, checkout files Then) | delete `project-install-adds-user-marketplace.test.ts` | C1, C2, C3, C4, C6, C8 |

**Phase 7 dependency:** 03-03 changes `marketplace/publishing.steps.ts` and `features/lib/git-plugin.ts`. Phase 7 adds its marketplace tag step to the marketplace publishing harness (`published-marketplace.ts` / `git-marketplace.ts` and `publishing.steps.ts`), and it starts after Phase 3 merges (ROADMAP). Name these files in 03-03's plan so Phase 7 knows where they changed. If 03-03 takes the seeding fix, its commit stages a source-test pair, so the hook runs that pair's direct coverage.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The typed skeletons of the new steps pass `typecheck` and `lint` as written | Code Examples | Small edits only; the behavior is verified |
| A2 | Claude Code creates a plugin's data directory lazily, so a missing dependency data directory is not a parity gap | Summary item 3 | If upstream creates it eagerly, a BACKLOG item; not in this phase's scope |
| A3 | `fallow audit` gives `weakened-tests` for each trimmed file as well as each deleted one | Constraints | One more warn to record |
| A4 | Reading `marketplace-add-seed-mirrors.test.ts:155` as internal ("mirror seeding") matches CONTEXT's intent | Case inventory | If it is the user-visible case, delete it after break D2 (already run: it fails U01 and U02) |

## Open Questions

1. **Delete `marketplace-add-seed-mirrors.test.ts:155`?** What we know: its user-visible content (the plugin available after the add, one clone) is now U02 plus U01, and D2 fails both. CONTEXT lists "mirror seeding" among the cases that stay. Recommendation: keep it (it asserts the mirror directory and the probe internals), unless the planner reads CONTEXT's "only its user-visible case" as this test. Then delete it with D2 as its red proof.
2. **Take the seeding fix in this phase?** Recommendation: yes, if the user agrees. It is small, has no key migration, and has a scenario that fails without it. Otherwise record a BACKLOG parent line, and write the U01/U02 `url` cells without `.git`.
3. **R02's "state bytes unchanged".** No step compares only `state.json`. The narrow `config and installation record bytes` step also covers the base config, which the add rewrites. Recommendation: rely on no request plus one clone plus the declarations, as drafted. A plausible wrong record rewrite would be a refresh, which the git host log shows. Adding a record-only byte step to `config.steps.ts` is the alternative, and it would make a fifth shared file.

## Sources

### Primary (HIGH confidence)
- Repo source read this session: `orchestrators/marketplace/autoupdate.ts:405-560`, `orchestrators/marketplace/shared.ts:1124-1159`, `persistence/config-merge.ts:1-129`, `orchestrators/marketplace/add.ts:565-720, 1040-1110, 1195-1260, 1640-1730`, `orchestrators/marketplace/remove.ts:1-80, 570-775, 900-940, 1130-1260`, `orchestrators/plugin/install-outcome.ts:620-830, 1205-1240`, `orchestrators/plugin/install-flow-cascade-context.ts:415-460`, `orchestrators/plugin/clone-cache.ts:410-560, 596-819`, `domain/clone-key.ts:53-123`, `domain/source.ts:210-264`, `platform/git.ts:900-960`, `persistence/locations.ts:337-370`.
- Test sources: the five integration files (read in full); `test/domain/source.test.ts:243-251`; `test/domain/clone-key.test.ts:303-317`.
- Harness: `features/step_definitions/{scope-state,config,git-host,command}.steps.ts`, `marketplace/{publishing,checkout}.steps.ts`, `plugin/{installation,git-source,publishing}.steps.ts`, `features/lib/{published-marketplace,path-marketplace,git-plugin,git-clones,layer-config}.ts`, `features/support/world.ts:365-400, 605-620`, `scripts/cucumber.mjs`, `scripts/check-features.mjs:449-520`, `cucumber.json`.
- Skill rules: `.agents/skills/cucumber/{SKILL.md,rules/features.md,rules/steps.md,rules/layout.md}`.
- Scratch runs: 4 probe files (20 scenarios + 3 diagnostic), 26 break runs, and 5 timing runs, all logged in `research-03/`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Existing harness only.
- Scenario shapes: HIGH. Every draft passed under adapter.
- Breaks: HIGH. 26 breaks applied and reverted; the 3 that failed nothing are explained.
- Seeding finding: HIGH (measured both spellings, and a candidate fix tried); the fix's unit-test shape is MEDIUM.
- Pitfalls: HIGH. Each one was hit or measured.

**Research date:** 2026-11-21
**Valid until:** 2026-12-21, or until a step module, `published-marketplace.ts`, or a break-site file changes.
