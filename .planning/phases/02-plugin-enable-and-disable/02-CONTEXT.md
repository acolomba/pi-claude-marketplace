# Phase 2: Plugin Enable and Disable - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous; the run is non-interactive, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

Phase 2 adds cucumber scenarios for every `enable` and `disable` lifecycle
behavior (ENA-01..ENA-06) to `features/plugin/enable.feature` and
`features/plugin/disable.feature`, the two files this phase owns. Test plugins
carry skills only. A product bug a scenario exposes is fixed in this phase,
with Claude Code's `/plugin` as the reference.

</domain>

<upstream>
## Upstream evidence (claude-code-compat-research)

Phase touches the upstream contract: enablement state and dependency handling
of `enable` and `disable`.

### Q1: disabling a plugin that an enabled plugin depends on (ENA-05)

- **Claude Code:** refused. The disable operation collects the reverse
  dependents among the enabled plugins and, when there are any, returns
  `success: false`, `failureCode: "required_by_dependents"`, with the message
  `<name> is still required by <dependents>. Disable that plugin first, or
  disable everything together: <chained disable commands>`.
- **Evidence:** the installed binary
  `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.308/claude`
  (Claude Code 2.1.308), grepped 2026-10-23 for `required_by_dependents` and
  `is still required by`.
- **Confidence:** high. The function body is readable in the binary.
- **pi-claude-marketplace today:** refused, `failed` row with
  `{dependents remain}` and the cause `Disable <dependents> first, then
  <target>.` (EDEP-02, D-08-01). Matches upstream; no change.

### Q2: enabling a plugin whose dependency is not installed (ENA-05)

- **Claude Code:** refused. The enable operation computes the dependency
  closure over the installed plugins; a dependency that is not installed
  lands in `missing`, and a non-empty `missing` returns `success: false`,
  `failureCode: "dependency_missing"`, with the message `<name> depends on
  <missing>, which is not installed. Install it first: <install commands>`.
  Nothing is enabled.
- **Evidence:** the same binary (2.1.308), grepped 2026-10-23 for
  `dependency_missing` and the closure walk that returns
  `{closure, missing}`.
- **Confidence:** high.
- **pi-claude-marketplace today:** enables the root anyway, reports the
  dependency on a `skipped` row with `{not installed}` at warning severity,
  and leaves the next reload to install it (MISS-01). No recorded decision
  licenses this divergence: the only marker is the code-review fix id WR-04 in
  `enable-disable.ts`, not a project decision, and it is not a Pi capability
  gap. Under the bug policy it is a product bug.

### Q3: enabling a plugin whose dependency is installed but disabled

- **Claude Code:** the closure's members are enabled with the root.
- **pi-claude-marketplace today:** the same (EDEP-01/EDEP-03, D-08-02): each
  disabled member returns on an `installed` row with `{dependency enabled}`.

### Q4: enable or disable of a plugin that is not installed (ENA-06)

- **Claude Code:** fails (`not found in settings`).
- **pi-claude-marketplace today:** error severity, summary `A plugin
  operation has failed.`, a `skipped` row with `{not installed}`. The reason
  and the failure severity match the requirement; no change.

### Q5: a command that matches the current state (ENA-03)

- **Claude Code:** `already_in_goal_state`, `Plugin "<id>" is already
  enabled|disabled`.
- **pi-claude-marketplace today:** a `skipped` row with `{already enabled}` or
  `{already disabled}` at info severity. Matches.

</upstream>

<decisions>
## Implementation Decisions

- **D-01:** ENA-05's disable half follows upstream: disabling a plugin that an
  enabled installed plugin depends on is **refused**. The scenario title says
  "fails as dependents remain" and the scenario checks that the dependency
  stays enabled and its skills stay offered.
- **D-02:** ENA-05's enable half for an **absent** dependency follows upstream
  and diverges from the ROADMAP wording "enables or installs them": enable is
  **refused** when a member of the dependency closure is not installed, and
  nothing changes. This is a product fix in `orchestrators/plugin/enable-disable.ts`
  (bug policy). The ROADMAP wording predates the research flag's answer;
  constraint "Upstream parity" makes Claude Code the default, and no recorded
  decision licenses the current behavior.
- **D-03:** The refusal reuses the existing reason `dependency unsatisfied`,
  which already mirrors upstream's `dependency-unsatisfied` load-time code and
  whose subject is the dependent: here the dependent is the plugin the user
  named. No new token joins the closed reason set. The cause follows the
  D-08-01 plain-English form, without a chained command:
  `Install <missing dependencies> first, then enable <target>.`
- **D-09:** (code review) A root that is already enabled is skipped as
  `{already enabled}` even when a dependency is missing, because Claude Code
  answers `already_in_goal_state` before it reads the closure. Only an enable
  that would turn the root on is refused.
- **D-04:** ENA-05's enable half for a **disabled** dependency keeps the current
  behavior (EDEP-03): the dependency is enabled through its record and
  reported on its own `installed` row with `{dependency enabled}`.
- **D-05:** The absent-dependency precondition is reached the way a user
  reaches it: install the dependency by name, install the dependent, disable
  the dependent, then uninstall the dependency (which goes through, D-06-06).
  No hand-edited state file.
- **D-06:** ENA-04 is four plain scenarios (enable and disable, each in the
  user scope and the project scope), two per feature file. An Outline needs
  three variants per behavior, and each verb has two. Each scenario installs
  `demo` in both scopes, changes one, and checks both scopes' installation
  records, both scopes' base configs, and the skills a new session offers.
- **D-07:** ENA-01 already has its scenario in `enable.feature` (`Enabling a
  disabled plugin offers its skills again and keeps one installation
  record`), from the earlier marketplace-features work; it stays. ENA-02 gets
  the matching disable scenario, with a `list` command showing the plugin
  installed and disabled.
- **D-08:** No phase-local step module is needed: every step the scenarios use
  exists in the Phase 1 shared modules. If one turns out to be missing, it
  goes in `plugin/enable.steps.ts` or `plugin/disable.steps.ts` with text that
  names the verb.

### Claude's Discretion

- Exact scenario titles, the plugin names in the dependency scenarios, and the
  order of scenarios in each file.

</decisions>

<code_context>
## Existing Code Insights

- `orchestrators/plugin/enable-disable.ts`: `resolveEnableCascade` classifies
  each closure member as `re-enabled`, `already-enabled`, or `not-installed`;
  `enableCascadeSkipRow` renders the `not-installed` arm as a warning skip. An
  `EnableRefusedError` thrown inside the locked transaction becomes a `failed`
  row with the reason and the cause, and nothing is written (the cycle refusal
  is the precedent).
- `orchestrators/plugin/enable-disable.messaging.ts`:
  `composeDisableRefusalCause` is the D-08-01 cause precedent.
- `docs/plugin-enablement.md` and `docs/dependency-resolution.md` describe the
  enable cascade; the absent-member sentence changes with D-02.
- Steps: `features/step_definitions/{command,config,session}.steps.ts`,
  `plugin/installation.steps.ts`, `marketplace/publishing.steps.ts`.

</code_context>

<deferred>
## Deferred Ideas

- Whether the enable closure reads a member's declarations from the installed
  copy, as Claude Code does, or from the marketplace's current copy is not
  exercised here: the fixtures never change a declaration after install. Out
  of scope.

</deferred>
