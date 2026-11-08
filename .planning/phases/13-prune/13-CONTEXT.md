# Phase 13: Prune - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss in a child session; the user asked for the recommended answer on every question, so each decision below is the recommendation, auto-accepted.

<domain>
## Phase Boundary

Phase 13 adds cucumber coverage for `/claude:plugin prune` (PRUNE-01, PRUNE-02): which scope a bare `prune` sweeps, `--dry-run` in each scope, the usage errors, the state lock, and a dependency that only a disabled plugin needs. It owns `features/plugin/prune.feature`, the reserved verb module `features/step_definitions/plugin/prune.steps.ts` (created only if a new step is needed), and the product files `orchestrators/plugin/{prune,prune-rollback}.ts`, `edge/handlers/plugin/prune.ts`, and `domain/dependency-orphans.ts` with their unit pairs. A product change happens only if a scenario exposes a bug, with Claude Code as the reference.

</domain>

<decisions>
## Implementation Decisions

### Upstream contract (claude-code-compat-research)

Evidence: `strings` over the Claude Code 2.1.319 binary
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude`), read 2026-11-08. Confidence: high for every point below, because each is read from the command definition or the function body, not from prose.

- **The command.** `n.command("prune").aliases(["autoremove"])` with `-s, --scope <scope>` ("Prune at scope: user, project, or local", default `"user"`), `--dry-run` ("List what would be removed without removing"), and `-y, --yes`. The handler (`pluginPruneHandler`) resolves the scope through `requireInstallableScope`: `let i=s.scope||"user"`, then `Invalid scope: <x>. Must be one of: user, project, local.` for any other value. It is a CLI command only; the in-session `/plugin` command has no prune.
- **Which scope a bare prune sweeps.** Only the user scope (the option default). A bare `claude plugin prune` never touches the project or local scope.
- **What is an orphan.** The orphan scan (`jGi`) splits the scope's installed plugins into explicit ones and auto-installed ones (`auto === true`), walks the manifest dependencies of every explicit plugin transitively, and reports each auto-installed plugin the walk does not reach. The plugins it walks come from `[...enabled, ...disabled]`, so a DISABLED explicit plugin still holds what it declares. An auto-installed plugin that no explicit plugin reaches is an orphan even when it is disabled, and so is everything only it reaches.
- **Output.** `Nothing to prune (no auto-installed plugins at <scope> scope).`, `Nothing to prune (<n> auto-installed plugin(s) at <scope> scope, all still needed).`, `<n> auto-installed plugin(s) no longer needed at <scope> scope: ...`, `(dry run — nothing removed)`, and `Removed <n> auto-installed plugin(s): ...`. A non-TTY run without `-y` lists and removes nothing. The removal deletes each plugin's data directory.

### Scope (PRUNE-01)

- **D-BG-1301: a bare `prune` sweeps the user scope alone.** This is Claude Code's default (`-s, --scope` defaults to `user`). The product already does it (`createPrunePlugin`: `options.scope ?? "user"`). A new scenario pins it with an orphaned dependency in EACH scope: `prune` removes the user scope's orphan and leaves the project scope's orphan installed. A wrong default (project, or both scopes, as `apply` and `pending` do) fails it.
- **D-BG-1302: each `--scope` combines with `--dry-run` and previews that scope alone.** Two scenarios, one per scope (an Outline needs three variants), each with an orphaned dependency in both scopes: `prune --scope user --dry-run` lists only the user scope's orphan as `will uninstall {dependency pruned}`, and `prune --scope project --dry-run` lists only the project scope's. Each then shows that both scopes are unchanged: the remembered config and installation record bytes of both scopes are unchanged, and the previewed scope still stages the orphan's skill. The existing project dry-run scenario (one scope only) may be folded into the new project scenario.

### Disabled holders (PRUNE-02)

- **D-BG-1303: a dependency that only a disabled plugin needs is kept while that plugin is installed by name, and pruned with it when the disabled plugin is itself an orphaned dependency.** Upstream's scan walks disabled explicit plugins (above). The product matches: D-05-04 (a disabled installed plugin still holds what it declares) plus the D-05-02 fixpoint, which removes an unheld disabled dependency first and then what only it held. Two scenarios:
  - kept: `install app` (app -> lib), `disable app`, then `prune` reports `prune-empty` and the installation record still holds both plugins;
  - pruned: `install app` (app -> mid -> lib), `uninstall app`, `disable mid`, then `prune` uninstalls `mid` and then `lib`, both with the reason `dependency pruned`, and the scope has no installed plugins.
  The exact enabled flags in the record come from the run; the plan states them as whole literals after a prototype run.

### Coverage that already exists in unowned files (PRUNE-01, PRUNE-02)

- **D-BG-1304: prune's usage errors are already pinned, with their usage text, in `features/plugin/usage-errors.feature`, and the phase adds no duplicate.** The handler (`edge/handlers/plugin/prune.ts`) has exactly five usage-error paths, and each has a row that states the message and `Usage: /claude:plugin prune [--scope user|project] [--dry-run]`: an unknown flag (`prune --bogus`, the same path as `-y`, `--yes`, and `--scope=project`), `--local` (`prune --local`), an extra argument (`prune extra`), a bad scope value (`prune --scope bad`, the same path as `local`), and a missing scope value (`prune --scope`). The file belongs to no stream, so the phase does not edit it. The plan records a red proof for each of the five rows (break the path, see the row fail, restore), so criterion 2 is met with evidence. Upstream's `-y/--yes` stays unsupported under FLAG-02 / D-02-05 (Pi's slash command has no confirmation prompt; `--dry-run` is the preview path).
- **D-BG-1305: prune under a held state lock is already pinned in `features/plugin/state-lock.feature`, for both scopes, and the phase adds no duplicate.** Each scenario states the `lock held` failure row with the lock path, and that the installation record, the config, and the staged skills are unchanged. The file belongs to no stream. The plan records a red proof (for example, run the sweep without taking the lock, see both scenarios fail, restore), so criterion 3 is met with evidence. `--dry-run` takes no lock (it is a read-only preview) and is not part of criterion 3.

### Steps and product

- **D-BG-1306: no new step module unless a step is missing.** Every step the new scenarios need exists in the frozen shared modules (`command`, `scope-state`, `marketplace/publishing`, `plugin/installation`): the publishing and add Givens, `the user has run {string}`, `the config and installation record bytes of the {word} scope are remembered` / `... are unchanged`, `the installation record of the {word} scope holds these plugins:`, `the {word} scope has no installed plugins`, `the {word} scope stages these skills and prompts:`, and the result steps. If the executor finds a missing step, it goes in the reserved `features/step_definitions/plugin/prune.steps.ts` with text that names prune.
- **D-BG-1307: no product change is planned.** The research above finds the product already at parity for every criterion. A bug that a scenario exposes is fixed in this phase's own files (milestone bug policy); one in a frozen or sibling file becomes a parent line and a dubious choice.
- No scenario has an MCP surface, so none carries an implementation tag; each runs once, under the `adapter` profile (D-BG-04).

### Claude's Discretion

- Scenario titles, the feature description's wording, and the order of scenarios in `prune.feature`.
- Whether the existing one-scope dry-run scenario stays beside the new two-scope ones or is replaced by the project one.
- The plugin and marketplace names in the new scenarios (follow the file's `tools`, `app`, `lib` names).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/plugin/prune.feature` (6 scenarios, no seed): the empty scope, a path-source orphan, a git-source orphan and its clone, a one-scope `--dry-run`, and the keep rules for a needed dependency and for a plugin installed by name.
- `features/plugin/usage-errors.feature` (unowned): prune rows at the unknown-flag, `--local`, too-many-arguments, bad-scope, and missing-scope outlines.
- `features/plugin/state-lock.feature` (unowned): `prune --scope project` and `prune --scope user` under a held lock.
- Shared steps: `features/step_definitions/scope-state.steps.ts` (`another process holds the state lock of the {word} scope`, the remembered and unchanged bytes steps, the installation record step, `the {word} scope has no installed plugins`, `the {word} scope stages these skills and prompts:`), `marketplace/publishing.steps.ts` (`the marketplace {string} offers these plugins with dependencies:`, `... is added to the {word} scope`), `command.steps.ts`.

### Established Patterns

- `orchestrators/plugin/prune.ts::createPrunePlugin`: `scope = options.scope ?? "user"`; `--dry-run` reads state with `persistMigration: false` and no lock, then emits `will uninstall {dependency pruned}` rows or `prune-empty`; a real prune runs inside `withLockedStateTransaction`, snapshots a rollback backup, sweeps, and reports `uninstalled {dependency pruned}` rows or `prune-empty`. A held lock reports one `(prune)` row with `lock held` and the lock path (PRN-03).
- `domain/dependency-orphans.ts::pruneOrphans`: a sorted fixpoint over `provenance: "dependency"` records that no remaining holder declares; the index never filters on `enabled` (D-05-04).
- `edge/handlers/plugin/prune.ts`: `extractLocalFlag` (consuming `--dry-run`, rejecting any other option token and `--local`), then `parseArgs` (`--scope` value), then `Too many arguments.` for a positional.

### Integration Points

- No new integration point. The scenarios drive the real extension through `/claude:plugin` in the shared Pi, as the existing prune scenarios do.

</code_context>

<specifics>
## Specific Ideas

- Keep the file's names: marketplace `tools` (dir source), plugins `app`, `mid`, and `lib`, version `1.0.0` and `1.2.0` as the existing scenarios use.
- A two-scope setup adds the marketplace to both scopes, installs `app` in each, and uninstalls `app` in each, so each scope holds one orphaned `lib`.

</specifics>

<deferred>
## Deferred Ideas

- **Upstream's `autoremove` alias.** `claude plugin autoremove` is upstream's CLI alias for prune; `/claude:plugin autoremove` is an unknown subcommand here. The router also has none of the CLI's other plugin aliases (`i`, `remove`, `rm`), and prune is a CLI-only command upstream. Out of scope (a new command surface); a BACKLOG parent line.
- **An island of dependencies that declare each other.** Upstream walks from explicit plugins only, so auto-installed plugins that only declare each other are orphans. The product keeps such an island (PRUNE-03, v1.20: "a mutually-declaring island of dependency records holds itself"). Install refuses a dependency cycle, so an island forms only when installed manifests change. No criterion of this phase names it; a dubious choice and a BACKLOG parent line for review.
- **Upstream's two empty messages.** Upstream says `no auto-installed plugins` or `<n> auto-installed ... all still needed`; the product has one `prune-empty` kind. Output wording, not a criterion here.

</deferred>
