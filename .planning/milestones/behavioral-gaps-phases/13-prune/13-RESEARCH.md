# Phase 13: Prune - Research

**Researched:** 2026-11-08
**Domain:** cucumber coverage of `/claude:plugin prune` (scope default, `--dry-run` per scope, usage errors, state lock, disabled holders)
**Confidence:** HIGH (every scenario literal below comes from a prototype run against the current product; every red proof was run and restored)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Upstream contract (claude-code-compat-research)

Evidence: `strings` over the Claude Code 2.1.319 binary
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`), read 2026-11-08. Confidence: high for every point below, because each is read from the command definition or the function body, not from prose.

- **The command.** `n.command("prune").aliases(["autoremove"])` with `-s, --scope <scope>` ("Prune at scope: user, project, or local", default `"user"`), `--dry-run` ("List what would be removed without removing"), and `-y, --yes`. The handler (`pluginPruneHandler`) resolves the scope through `requireInstallableScope`: `let i=s.scope||"user"`, then `Invalid scope: <x>. Must be one of: user, project, local.` for any other value. It is a CLI command only; the in-session `/plugin` command has no prune.
- **Which scope a bare prune sweeps.** Only the user scope (the option default). A bare `claude plugin prune` never touches the project or local scope.
- **What is an orphan.** The orphan scan (`jGi`) splits the scope's installed plugins into explicit ones and auto-installed ones (`auto === true`), walks the manifest dependencies of every explicit plugin transitively, and reports each auto-installed plugin the walk does not reach. The plugins it walks come from `[...enabled, ...disabled]`, so a DISABLED explicit plugin still holds what it declares. An auto-installed plugin that no explicit plugin reaches is an orphan even when it is disabled, and so is everything only it reaches.
- **Output.** `Nothing to prune (no auto-installed plugins at <scope> scope).`, `Nothing to prune (<n> auto-installed plugin(s) at <scope> scope, all still needed).`, `<n> auto-installed plugin(s) no longer needed at <scope> scope: ...`, `(dry run — nothing removed)`, and `Removed <n> auto-installed plugin(s): ...`. A non-TTY run without `-y` lists and removes nothing. The removal deletes each plugin's data directory.

#### Scope (PRUNE-01)

- **D-BG-1301: a bare `prune` sweeps the user scope alone.** This is Claude Code's default (`-s, --scope` defaults to `user`). The product already does it (`createPrunePlugin`: `options.scope ?? "user"`). A new scenario pins it with an orphaned dependency in EACH scope: `prune` removes the user scope's orphan and leaves the project scope's orphan installed. A wrong default (project, or both scopes, as `apply` and `pending` do) fails it.
- **D-BG-1302: each `--scope` combines with `--dry-run` and previews that scope alone.** Two scenarios, one per scope (an Outline needs three variants), each with an orphaned dependency in both scopes: `prune --scope user --dry-run` lists only the user scope's orphan as `will uninstall {dependency pruned}`, and `prune --scope project --dry-run` lists only the project scope's. Each then shows that both scopes are unchanged: the remembered config and installation record bytes of both scopes are unchanged, and the previewed scope still stages the orphan's skill. The existing project dry-run scenario (one scope only) may be folded into the new project scenario.

#### Disabled holders (PRUNE-02)

- **D-BG-1303: a dependency that only a disabled plugin needs is kept while that plugin is installed by name, and pruned with it when the disabled plugin is itself an orphaned dependency.** Upstream's scan walks disabled explicit plugins (above). The product matches: D-05-04 (a disabled installed plugin still holds what it declares) plus the D-05-02 fixpoint, which removes an unheld disabled dependency first and then what only it held. Two scenarios:
  - kept: `install app` (app -> lib), `disable app`, then `prune` reports `prune-empty` and the installation record still holds both plugins;
  - pruned: `install app` (app -> mid -> lib), `uninstall app`, `disable mid`, then `prune` uninstalls `mid` and then `lib`, both with the reason `dependency pruned`, and the scope has no installed plugins.
  The exact enabled flags in the record come from the run; the plan states them as whole literals after a prototype run.

#### Coverage that already exists in unowned files (PRUNE-01, PRUNE-02)

- **D-BG-1304: prune's usage errors are already pinned, with their usage text, in `features/plugin/usage-errors.feature`, and the phase adds no duplicate.** The handler (`edge/handlers/plugin/prune.ts`) has exactly five usage-error paths, and each has a row that states the message and `Usage: /claude:plugin prune [--scope user|project] [--dry-run]`: an unknown flag (`prune --bogus`, the same path as `-y`, `--yes`, and `--scope=project`), `--local` (`prune --local`), an extra argument (`prune extra`), a bad scope value (`prune --scope bad`, the same path as `local`), and a missing scope value (`prune --scope`). The file belongs to no stream, so the phase does not edit it. The plan records a red proof for each of the five rows (break the path, see the row fail, restore), so criterion 2 is met with evidence. Upstream's `-y/--yes` stays unsupported under FLAG-02 / D-02-05 (Pi's slash command has no confirmation prompt; `--dry-run` is the preview path).
- **D-BG-1305: prune under a held state lock is already pinned in `features/plugin/state-lock.feature`, for both scopes, and the phase adds no duplicate.** Each scenario states the `lock held` failure row with the lock path, and that the installation record, the config, and the staged skills are unchanged. The file belongs to no stream. The plan records a red proof (for example, run the sweep without taking the lock, see both scenarios fail, restore), so criterion 3 is met with evidence. `--dry-run` takes no lock (it is a read-only preview) and is not part of criterion 3.

#### Steps and product

- **D-BG-1306: no new step module unless a step is missing.** Every step the new scenarios need exists in the frozen shared modules (`command`, `scope-state`, `marketplace/publishing`, `plugin/installation`): the publishing and add Givens, `the user has run {string}`, `the config and installation record bytes of the {word} scope are remembered` / `... are unchanged`, `the installation record of the {word} scope holds these plugins:`, `the {word} scope has no installed plugins`, `the {word} scope stages these skills and prompts:`, and the result steps. If the executor finds a missing step, it goes in the reserved `features/step_definitions/plugin/prune.steps.ts` with text that names prune.
- **D-BG-1307: no product change is planned.** The research above finds the product already at parity for every criterion. A bug that a scenario exposes is fixed in this phase's own files (milestone bug policy); one in a frozen or sibling file becomes a parent line and a dubious choice.
- No scenario has an MCP surface, so none carries an implementation tag; each runs once, under the `adapter` profile (D-BG-04).

### Claude's Discretion

- Scenario titles, the feature description's wording, and the order of scenarios in `prune.feature`.
- Whether the existing one-scope dry-run scenario stays beside the new two-scope ones or is replaced by the project one.
- The plugin and marketplace names in the new scenarios (follow the file's `tools`, `app`, `lib` names).

### Deferred Ideas (OUT OF SCOPE)

- **Upstream's `autoremove` alias.** `claude plugin autoremove` is upstream's CLI alias for prune; `/claude:plugin autoremove` is an unknown subcommand here. The router also has none of the CLI's other plugin aliases (`i`, `remove`, `rm`), and prune is a CLI-only command upstream. Out of scope (a new command surface); a BACKLOG parent line.
- **An island of dependencies that declare each other.** Upstream walks from explicit plugins only, so auto-installed plugins that only declare each other are orphans. The product keeps such an island (PRUNE-03, v1.20: "a mutually-declaring island of dependency records holds itself"). Install refuses a dependency cycle, so an island forms only when installed manifests change. No criterion of this phase names it; a dubious choice and a BACKLOG parent line for review.
- **Upstream's two empty messages.** Upstream says `no auto-installed plugins` or `<n> auto-installed ... all still needed`; the product has one `prune-empty` kind. Output wording, not a criterion here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRUNE-01 | `prune` without `--scope` behaves as Claude Code does, `--scope user\|project` combines with `--dry-run`, and its usage errors are covered. | Scenarios A, B, C below (prototype-run literals); the five existing usage-error rows confirmed passing at `usage-errors.feature:88,102,135,167,203` with run red proofs R1-R4 |
| PRUNE-02 | `prune` while another process holds the state lock fails as lock held and removes nothing, and a dependency only a disabled plugin needs is handled as upstream does. | Existing `state-lock.feature:331,358` confirmed passing with run red proof R5; scenarios D, E below (prototype-run literals) with run red proofs M3, M4 |
</phase_requirements>

## Summary

This is a coverage phase. The product already matches upstream for every success criterion (D-BG-1307), and the prototype run confirms it: five new scenarios, written with existing steps only, pass against the current product with the literals below. The phase adds those five scenarios (or four, if the new project dry-run scenario replaces the existing one-scope one) to `features/plugin/prune.feature`, needs no step module, and records red proofs for the new scenarios and for the existing usage-error rows and state-lock scenarios it relies on.

One prototype finding changes a planned scenario. With the same orphan (`lib@tools 1.2.0`) in both scopes, as CONTEXT's "Specific Ideas" suggests, a preview that reads the WRONG scope's state but labels the rows with the requested scope produces identical rows, so scenarios B and C would not catch it (the row's `scope` and `marketplace scope` come from the `scope` variable, not the record: `prune.ts:243-258`). Give each scope a different orphan: the user scope orphans `lib` (via `app`), the project scope orphans `mid` (via a new plugin `tool`). With that setup the wrong-scope mutation fails A, B, and C (run 5 below).

A second prototype finding is a small upstream divergence the planner must decide on: after scenario E, `claude-plugins.json` of the project scope still declares `mid@tools` with `enabled: false` (written by the `disable`), while upstream's prune removal (`bEi`) deletes each pruned id from the scope's `enabledPlugins`. The residue is inert in the product (`pending` reports `reconcile-pending-empty`, and a later `install app` re-enables `mid`), and the shared sweep that would clear it lives in `orchestrators/plugin/uninstall.ts`, which Phase 13 does not own. Recommendation: no product change in this phase; scenario E does not state the config file; log a dubious choice and a BACKLOG parent line (see Open Question 1).

**Primary recommendation:** add scenarios A-E exactly as in "Code Examples", replace the existing one-scope dry-run scenario with C, add no step module, and record the eight red proofs in the SUMMARY.

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap (Constraints, "Upstream parity").
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it (Behavioral tests). Here no behavior changes; the new scenarios pin existing behavior and each still needs a recorded red proof (child brief section 8).
- Never commit to `main`; Conventional Commit titles with no milestone/phase/plan IDs; never `--no-verify`, never rebase, never `git add -A` (Git; child brief section 7).
- Every plan SUMMARY.md has `## Threat Flags` (GSD records).
- Gates run `npm run check` on the combined tree; the commit hook (`check:commit`) is not a gate (Build verification; `local-verification` skill).
- Frozen files (never edit): `package.json`, `package-lock.json`, `cucumber.json`, `scripts/check-features.mjs`, `features/support/**`, `features/lib/**`, every existing step module, `.agents/skills/cucumber/**`, `platform/pi-api.ts`, and the rest of the ROADMAP list.
- Unowned feature files `features/plugin/usage-errors.feature` and `features/plugin/state-lock.feature` are not edited (D-BG-1304, D-BG-1305).
- Hermetic home: no run may write the real `~/.pi`.
- Cucumber rules: `Given`/`When`/`Then` only, lower-case step text outside quotes, every `Given` before the first `When`, tables list every row, a scenario with no MCP surface carries no implementation tag (`.agents/skills/cucumber/rules/features.md`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Argument parsing and usage errors | edge (`edge/handlers/plugin/prune.ts`, `edge/handlers/shared.ts::extractLocalFlag`, `edge/args.ts::parseArgs`) | shared (`notifyUsageError`) | The handler owns all five usage-error paths |
| Scope default and dry-run vs. locked sweep | orchestrators (`orchestrators/plugin/prune.ts::createPrunePlugin`) | transaction (`withLockedStateTransaction`) | `scope = options.scope ?? "user"`; dry-run reads with no lock |
| Orphan selection (disabled holders count) | domain (`domain/dependency-orphans.ts::pruneOrphans`) | orchestrators (`dependency-index.ts::buildScopeDeclarationIndex`) | The index never filters on `enabled` (D-05-04) |
| Removal of one member | orchestrators (`orchestrators/plugin/uninstall.ts::removeDependencyMember`, unowned) | bridges (cascade unstage) | Shared with `uninstall --prune`; never touches config layers |
| Behavioral coverage | `features/plugin/prune.feature` | shared step modules (frozen) | No new step needed |

## Standard Stack

No package is added. The phase uses the repository's existing cucumber harness.

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` (via `npx cucumber-js`) | as locked in `package-lock.json` | Runs `features/plugin/prune.feature` under the default (`adapter`) profile |
| `scripts/check-features.mjs` (`npm run check:features`) | in repo | Unused/undefined/ambiguous steps and feature-file rules |

## Package Legitimacy Audit

Not applicable: this phase installs no external package.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Data flow of `/claude:plugin prune [--scope S] [--dry-run]`

```text
/claude:plugin prune ...
   -> router -> makePruneHandler (edge/handlers/plugin/prune.ts)
        extractLocalFlag: consumes --dry-run; any other "-" token -> usage error "Unknown flag"   (R1)
        scanned.local (--local)                                -> usage error "Unknown flag: --local" (R2)
        withParsedArgs(parseArgs): --scope bad / --scope (no value) -> usage error              (R3)
        positional present                                     -> usage error "Too many arguments." (R4)
   -> createPrunePlugin (orchestrators/plugin/prune.ts)
        scope = options.scope ?? "user"                         (D-BG-1301; mutation M1)
        dryRun?  yes -> loadState (no lock, no persist) -> buildScopeDeclarationIndex -> pruneOrphans
                        -> cascade rows "will uninstall {dependency pruned}" | prune-empty
                 no  -> withLockedStateTransaction (held lock -> "(prune) failed {lock held}")  (R5)
                        -> buildScopeDeclarationIndex -> pruneOrphans -> sweepOrphans -> save
                        -> cascade rows "uninstalled {dependency pruned}" | prune-empty
```

### Pattern: the two-scope setup with distinct orphans

Every scope-selection scenario (A, B, C) seeds a DIFFERENT orphan in each scope from one `tools` marketplace added to both scopes. The user scope runs `install app` / `uninstall app` (orphan `lib@tools 1.2.0`, skill `lib-skill`); the project scope runs `install tool` / `uninstall tool` (orphan `mid@tools 1.1.0`, skill `mid-skill`). A shared orphan in both scopes cannot tell a wrong-scope preview from a right one.

### Anti-Patterns to Avoid

- **Same orphan in both scopes for the dry-run scenarios:** passes under a preview that reads the other scope (see Summary).
- **A second `When` to check `pending` after prune:** one scenario, one behavior; the `pending` probe was research only.
- **Pinning the `mid@tools enabled false` config residue in scenario E:** it would freeze a known upstream divergence (Open Question 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proving a scope is untouched | per-file assertions | `the config and installation record bytes of the {word} scope are remembered` / `... are unchanged` (`config.steps.ts:170-175, 240-247`) | Compares config and record bytes in one step |
| Proving a scope is empty | separate record and staging checks | `the {word} scope has no installed plugins` (`installation.steps.ts:386-401`) | Checks record, skills, and prompts together |
| A new step module | `plugin/prune.steps.ts` | the existing shared steps | D-BG-1306; the prototype needed no new step |

## Common Pitfalls

### Pitfall 1: Missing optional-peer cache in a fresh worktree
**What goes wrong:** every scenario fails in `BeforeAll` with `the peer cache holds no pi-mcp-adapter. Run node scripts/install-test-peers.mjs.`
**Why it happens:** `npx cucumber-js` does not install the peers; only the `test:cucumber*` npm scripts do. This worktree had no `node_modules/.cache/optional-peers` until this research ran `node scripts/install-test-peers.mjs` (it installed `pi-mcp-adapter@7.0.0 pi-subagents@0.84.0 @quintinshaw/pi-dynamic-workflows@3.15.0`).
**How to avoid:** the cache now exists in this worktree; if it is ever cleared, run that script before `npx cucumber-js`.

### Pitfall 2: Wrong scope previewed looks right
See Summary and the pattern above. Use distinct orphans.

### Pitfall 3: `disable mid` while `app` is installed and enabled is refused
**What goes wrong:** the setup `install app`, `disable mid` fails with `(failed) {dependents remain}`, cause `Disable app@tools first, then mid@tools.` (observed in run 3).
**How to avoid:** scenario E runs `uninstall app` BEFORE `disable mid`, as CONTEXT orders it.

### Pitfall 4: A red proof whose first failing `Then` hides the later ones
**What goes wrong:** under the lock mutation R5, the first `Then` (result fields) fails and the record/config/staging `Then`s are skipped.
**How to avoid:** record in the SUMMARY that the failing result was `severity info, needs reload true` (the sweep ran and removed `lib`), which is the evidence that the guard is what keeps the record unchanged.

## Code Examples

All scenarios below passed against the current product (prototype run 4, `npx cucumber-js features/plugin/prune-scratch.feature`, 5 scenarios, 5 passed). [VERIFIED: prototype run 2026-11-08]. Scenario D and E literals also passed in runs 2 and 3.

### Scenario A (PRUNE-01, D-BG-1301): bare prune sweeps the user scope alone

```gherkin
  Scenario: Pruning without a scope prunes the user scope alone
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | tool | 1.0.0   | mid          |
      | mid  | 1.1.0   |              |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin uninstall app@tools --scope user"
    Given the user has run "/claude:plugin install tool@tools --scope project"
    Given the user has run "/claude:plugin uninstall tool@tools --scope project"
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin prune"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope | version |
      | tools            | user              | lib@tools | lib  | uninstalled | dependency pruned | user  | 1.2.0   |
    Then the user scope has no installed plugins
    Then the config and installation record bytes of the project scope are unchanged
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | mid@tools | 1.1.0   | true    |
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | mid-skill |
```

### Scenario B (PRUNE-01, D-BG-1302): user-scope preview

```gherkin
  Scenario: Previewing a prune of the user scope lists only its dependency and removes nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | tool | 1.0.0   | mid          |
      | mid  | 1.1.0   |              |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the user scope
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope user"
    Given the user has run "/claude:plugin uninstall app@tools --scope user"
    Given the user has run "/claude:plugin install tool@tools --scope project"
    Given the user has run "/claude:plugin uninstall tool@tools --scope project"
    Given the config and installation record bytes of the user scope are remembered
    Given the config and installation record bytes of the project scope are remembered
    When the user runs "/claude:plugin prune --scope user --dry-run"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status         | reasons           | scope | version |
      | tools            | user              | lib@tools | lib  | will uninstall | dependency pruned | user  | 1.2.0   |
    Then the config and installation record bytes of the user scope are unchanged
    Then the config and installation record bytes of the project scope are unchanged
    Then the user scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |
```

### Scenario C (PRUNE-01, D-BG-1302): project-scope preview (replaces `prune.feature:60-82`)

Same Givens as B; then:

```gherkin
    When the user runs "/claude:plugin prune --scope project --dry-run"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status         | reasons           | scope   | version |
      | tools            | project           | mid@tools | mid  | will uninstall | dependency pruned | project | 1.1.0   |
    Then the config and installation record bytes of the user scope are unchanged
    Then the config and installation record bytes of the project scope are unchanged
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | mid-skill |
```

Title used in the prototype: `Previewing a prune of the project scope lists only its dependency and removes nothing`.

### Scenario D (PRUNE-02, D-BG-1303 kept)

```gherkin
  Scenario: Pruning keeps a dependency that only a disabled plugin needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin disable app@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | prune-empty |
      | severity     | info        |
      | needs reload | false       |
      | scope        | project     |
    Then the installation record of the project scope holds these plugins:
      | id        | version | enabled |
      | app@tools | 1.0.0   | false   |
      | lib@tools | 1.2.0   | true    |
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        | enabled |
      | app@tools | false   |
```

Observed: `disable app` does not cascade to `lib` (`lib` stays `enabled: true`). The config step accepts an `enabled` column (`config.steps.ts:115-139` builds rows from the stated header). The config assertion is optional; it is consistent with upstream (`disable` writes `enabledPlugins[id]=false`) and is not touched by prune.

### Scenario E (PRUNE-02, D-BG-1303 pruned)

```gherkin
  Scenario: Pruning removes a disabled dependency that nothing needs and what only it needs
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" offers these plugins with dependencies:
      | name | version | dependencies |
      | app  | 1.0.0   | mid          |
      | mid  | 1.1.0   | lib          |
      | lib  | 1.2.0   |              |
    Given the marketplace "tools" is added to the project scope
    Given the user has run "/claude:plugin install app@tools --scope project"
    Given the user has run "/claude:plugin uninstall app@tools --scope project"
    Given the user has run "/claude:plugin disable mid@tools --scope project"
    When the user runs "/claude:plugin prune --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id        | name | status      | reasons           | scope   | version |
      | tools            | project           | mid@tools | mid  | uninstalled | dependency pruned | project | 1.1.0   |
      | tools            | project           | lib@tools | lib  | uninstalled | dependency pruned | project | 1.2.0   |
    Then the project scope has no installed plugins
```

Observed but NOT recommended as a `Then` (Open Question 1): `claude-plugins.json` of the project scope still holds `"plugins": { "mid@tools": { "enabled": false } }` after the prune (run 2 failure text, verbatim config dump). The record row order is `mid` then `lib` (the fixpoint order).

## Red proofs (all run locally, all restored; `git diff` empty at the end)

### Existing coverage the phase relies on (D-BG-1304, D-BG-1305)

Baseline: `npx cucumber-js features/plugin/usage-errors.feature:88:102:135:167:203 features/plugin/state-lock.feature:331:358` -> 7 scenarios (7 passed). [VERIFIED: run 2026-11-08]

The five usage-error rows, verbatim from `features/plugin/usage-errors.feature` [VERIFIED: read this session]:

- line 88: `| prune --bogus                  | --bogus     | Usage: /claude:plugin prune [--scope user\|project] [--dry-run]  |` (outline "A plugin subcommand rejects a flag it does not accept", message `Unknown flag: "<flag>".`)
- line 102: `| prune --local                  | --local     | Usage: /claude:plugin prune [--scope user\|project] [--dry-run]  |` (same outline)
- line 135: `| prune extra                    | Too many arguments.                          | Usage: /claude:plugin prune [--scope user\|project] [--dry-run] |`
- line 167: `| prune --scope bad                  | bad     | Usage: /claude:plugin prune [--scope user\|project] [--dry-run] |` (message `Invalid --scope value: "<value>". Must be "user" or "project".`)
- line 203: `| prune --scope                 | Usage: /claude:plugin prune [--scope user\|project] [--dry-run] |` (message `--scope requires a value: "user" or "project".`)

The handler has no other usage-error path [VERIFIED: `edge/handlers/plugin/prune.ts:15-52`, `edge/handlers/shared.ts:64-105`, `edge/args.ts:31-65,75-106`]: `extractLocalFlag` emits only `Unknown flag: "${tok}".` (shared.ts:101-103); `parseArgs` throws only the two `--scope` messages (args.ts:51, 53); `tokenizeArgs` never throws (an unbalanced quote just continues the token); a repeated `--scope` keeps the last value; a repeated `--dry-run` is consumed. The handler's USAGE constant is `const USAGE = "Usage: /claude:plugin prune [--scope user|project] [--dry-run]";` (prune.ts:15).

| Proof | Mutation (one line, in an owned file unless noted) | Command | Observed |
|-------|----------|---------|----------|
| R1 unknown flag | `edge/handlers/plugin/prune.ts:25` `usage: USAGE` -> `usage: "MUTATED"` | `npx cucumber-js features/plugin/usage-errors.feature:88:102:135:167:203` | row 88 fails, 4 pass |
| R2 `--local` | `prune.ts:30` `if (scanned.local) {` -> `if (scanned.local && false) {` | same | row 102 fails |
| R3 extra argument | `prune.ts:39` `parsed.positional.length > 0` -> `> 99` | same | row 135 fails (R2+R3 run together: 102 and 135 fail, 3 pass) |
| R4 bad / missing scope | `prune.ts:38` `withParsedArgs(parseArgs, USAGE,` -> `withParsedArgs(parseArgs, "MUTATED",` | same | rows 167 and 203 fail, 3 pass |
| R5 state lock | `transaction/with-state-guard.ts:213` `lockfilePath: locations.stateLockFile,` -> ``lockfilePath: `${locations.stateLockFile}.mutated`,`` (Phase 15's file; local and temporary only) | `npx cucumber-js features/plugin/state-lock.feature:331:358` | both fail at `the result has these fields:` with actual `severity info`, `needs reload true` (the sweep ran) |

R4 breaks both `--scope` rows with one line, because both reach the same `withParsedArgs` usage. To split them, mutate the message instead: `edge/args.ts:53` (bad value, row 167) and `edge/args.ts:51` (missing value, row 203) [ASSUMED: not run; args.ts is shared and unowned, so a local temporary edit only]. If the plan prefers an owned-file proof for R5, `orchestrators/plugin/prune.ts:116` (`reason = "lock held";` -> `"unreadable"`) fails both scenarios' result row [ASSUMED: not run]; it proves the row but not "removes nothing", so R5 above is stronger.

### New scenarios

| Proof | Mutation | Scenarios that fail (observed) |
|-------|----------|-------------------------------|
| M1 default scope | `orchestrators/plugin/prune.ts:231` `options.scope ?? "user"` -> `?? "project"` | A (run together with M2: A, B, C fail; D, E pass) |
| M2 preview reads the wrong scope | `prune.ts:232` `locationsFor(scope, options.cwd)` -> `locationsFor(options.dryRun === true ? (scope === "user" ? "project" : "user") : scope, options.cwd)` | B, C |
| M3 disabled holders dropped from the index | `orchestrators/plugin/dependency-index.ts:485` `index.set(...)` -> `if (record.enabled) index.set(...)` (unowned; local only) | D (`prune-empty` expected, `cascade` actual) and E (row order `lib, mid`) |
| M4 a disabled dependency is never pruned | `prune.ts:306` `snapshot,` -> `snapshot: { ...snapshot, candidates: snapshot.candidates.filter((c) => c.record.enabled) },` | E only |

Run each with `npx cucumber-js features/plugin/prune.feature:<line>` once the scenarios are in place. M2 would NOT fail B or C with a shared orphan in both scopes (rows are labeled from the `scope` variable: `prune.ts:243-258`) [VERIFIED: code read; ASSUMED for the run, not executed on the shared-orphan variant]. An owned-file equivalent of M3 is a `prune.ts` edit that passes `snapshot: { ...snapshot, index: <index without disabled holders> }` to `sweepOrphans` [ASSUMED: not run].

## `npm run check:features`

Passed with the scratch file present (exit 0) [VERIFIED: run 2026-11-08]. It needs nothing for the new scenarios: every step they use is already used elsewhere, so no step is unused or undefined, and no step is added. The feature title must stay `Plugin prune` (`titleFindings`, `scripts/check-features.mjs:369-383`: kebab-case of the title equals `plugin-prune`). Scenario titles must start upper case; step text stays lower case outside quotes; no `Given` after a `When`. No new scenario has an MCP surface, so none carries a tag.

## State of the Art

| Old (in `prune.feature`) | New | Impact |
|--------------|------------------|--------|
| One-scope project dry-run (`prune.feature:60-82`) | Two-scope previews B and C with distinct orphans | Catches a preview of the wrong scope and proves the other scope is untouched |
| Only `--scope project` prunes | Bare `prune` (A) | Pins the user-scope default (D-BG-1301) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `edge/args.ts:51` and `:53` message mutations split R4 into one row each | Red proofs | Low: R4 as run already fails both rows |
| A2 | `prune.ts:116` reason mutation fails both state-lock scenarios | Red proofs | Low: alternative only |
| A3 | M2 does not fail B/C under the shared-orphan setup | Red proofs | Low: it only motivates the distinct-orphan setup, which is verified |
| A4 | An owned-file `prune.ts` index filter reproduces M3 | Red proofs | Low: M3 as run works |

## Open Questions

1. **The `enabled: false` declaration left after pruning a disabled dependency.**
   - What we know: after scenario E, `claude-plugins.json` holds `"mid@tools": { "enabled": false }` with no record. `pending --scope project` then reports `reconcile-pending-empty`, and a later `install app@tools --scope project` installs `app`, `lib`, `mid` all `enabled: true` (prototype probes). Upstream's prune removal `bEi` writes the scope's settings with `Ae[xe]=void 0` for every pruned id, so upstream leaves no entry [VERIFIED: Claude Code 2.1.319 binary, `async function bEi(...)`, read this session]. The product's sweep body `removeDependencyMember` (`orchestrators/plugin/uninstall.ts:880-934`) "never sweeps the config layers", citing D-04-02; no recorded decision licenses keeping a `disable`-written entry.
   - What's unclear: whether to fix it now. A fix only in `prune.ts` (owned) would leave `uninstall --prune` (same sweep, `uninstall.ts`, unowned) divergent, and it adds a config write that the prune rollback (`prune-rollback.ts`) would have to restore (NFR-3).
   - Recommendation: no product change in this phase (D-BG-1307). Scenario E omits the config `Then`. Log a dubious choice (P13-DC) and a BACKLOG parent line: "prune and `uninstall --prune` keep a pruned dependency's `enabled: false` declaration; Claude Code's prune deletes `enabledPlugins[id]`; fix in the shared sweep with the rollback covering the config files." If the planner instead applies the bug policy strictly, the fix site is `prune.ts` plus `prune-rollback.ts`, and scenario E gains `Then the "claude-plugins.json" file of the project scope declares no plugins` (which fails today: run 2).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node / npx | cucumber runs | yes | per repo engines | - |
| Optional peer cache (`node_modules/.cache/optional-peers`) | cucumber `BeforeAll` | yes (installed by this research) | pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, pi-dynamic-workflows 3.15.0 | rerun `node scripts/install-test-peers.mjs` |
| Pi | shared cucumber Pi | yes | 1.5.0 | - |
| Claude Code binary | upstream evidence only | yes | 2.1.319 | - |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | cucumber-js (repo-locked), default profile = `adapter` |
| Config file | `cucumber.json` (frozen) |
| Quick run command | `npx cucumber-js features/plugin/prune.feature` (about 25 s for five two-scope scenarios on this machine) |
| Full suite command | `npm run check` (both cucumber profiles), plus `npm run test:modules` at the phase gate |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRUNE-01 | bare prune sweeps the user scope alone | cucumber | `npx cucumber-js features/plugin/prune.feature:<A>` | prune.feature exists; scenario A new |
| PRUNE-01 | `--scope user --dry-run` previews only the user scope | cucumber | `npx cucumber-js features/plugin/prune.feature:<B>` | new |
| PRUNE-01 | `--scope project --dry-run` previews only the project scope | cucumber | `npx cucumber-js features/plugin/prune.feature:<C>` | new (replaces lines 60-82) |
| PRUNE-01 | each usage error shows its usage text | cucumber | `npx cucumber-js features/plugin/usage-errors.feature:88:102:135:167:203` | exists (unowned) |
| PRUNE-02 | held lock fails as lock held, removes nothing | cucumber | `npx cucumber-js features/plugin/state-lock.feature:331:358` | exists (unowned) |
| PRUNE-02 | disabled holder keeps its dependency | cucumber | `npx cucumber-js features/plugin/prune.feature:<D>` | new |
| PRUNE-02 | disabled orphan and what only it needs are pruned | cucumber | `npx cucumber-js features/plugin/prune.feature:<E>` | new |
| both | steps used, layout and wording rules | static | `npm run check:features` | exists |

### Sampling Rate
- **Per task commit:** `npx cucumber-js features/plugin/prune.feature` and `npm run check:features` (the commit hook runs `check:commit` only when a build input is staged).
- **Per wave merge / phase gate:** `npm run check` on the combined tree (background call, exit code to a file; never piped), plus `npm run test:modules` at the phase gate. Rerun a failing cucumber case once before calling a gate red.
- **Red proofs:** each run once against a local, uncommitted mutation, then restored; `git diff` empty afterwards.

### Wave 0 Gaps
None. The existing harness and steps cover every scenario; no fixture, step, or framework install is needed.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | no | - |
| V4 Access Control | no | - |
| V5 Input Validation | yes (argument parsing) | `extractLocalFlag` + `parseArgs` usage errors, pinned by the five existing rows |
| V6 Cryptography | no | - |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Concurrent writer corrupts `state.json` | Tampering | `withLockedStateTransaction` (`proper-lockfile`, `retries: 0`); pinned by `state-lock.feature:331,358` |
| Tests touching the real `~/.pi` | Tampering / info disclosure | Hermetic Pi home per scenario; no file under the real `~/.pi` changed during these runs (checked with `find ~/.pi -newer <marker>`) |

## Sources

### Primary (HIGH confidence)
- Prototype runs of `features/plugin/prune-scratch.feature` (deleted): runs 2-10, 2026-11-08.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts:1-53`, `edge/handlers/shared.ts:54-151`, `edge/args.ts:31-106`, `orchestrators/plugin/prune.ts:1-385`, `domain/dependency-orphans.ts:1-209`, `orchestrators/plugin/dependency-index.ts:465-491`, `orchestrators/plugin/uninstall.ts:880-990`, `transaction/with-state-guard.ts:208-230` (read this session).
- `features/plugin/prune.feature`, `features/plugin/usage-errors.feature`, `features/plugin/state-lock.feature`, `features/step_definitions/config.steps.ts`, `features/step_definitions/plugin/installation.steps.ts` (read this session).
- Claude Code 2.1.319 binary: `async function oe(e,n,r,c)` (prune report) and `async function bEi(...)` (prune removal, settings `enabledPlugins` cleanup).
- `.planning/phases/13-prune/13-CONTEXT.md`, `.planning/ROADMAP.md`, `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md`, `.agents/skills/cucumber/**`.

## Metadata

**Confidence breakdown:**
- Scenario literals: HIGH - observed in prototype runs
- Red proofs: HIGH for R1-R5 and M1-M4 (run); LOW for the alternatives tagged [ASSUMED]
- Config residue finding: HIGH for the observation and the upstream behavior; the disposition is a planner decision

**Research date:** 2026-11-08
**Valid until:** until a product file in the prune path or a shared step changes (stable)
