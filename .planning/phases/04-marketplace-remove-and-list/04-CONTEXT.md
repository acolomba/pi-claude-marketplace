# Phase 4: Marketplace Remove and List - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 completes the real-Pi Cucumber contract for `marketplace remove`/`rm` and `marketplace list`/`ls`: scope resolution, layer enforcement, source-kind rows, plugin cascades and persistence, missing-marketplace failures, empty and populated listings, aliases, scope filters, autoupdate state, and last-updated time. It may correct production behavior exposed by those scenarios, but it does not add a new marketplace capability.

</domain>

<decisions>
## Implementation Decisions

### Unscoped removal

- **D-01 (user; explicit upstream divergence):** When the same marketplace name exists in project and user scopes, `marketplace remove <name>` without `--scope` removes only the project-scope copy. The result contains only the project-scoped `removed` row; it adds no warning or unchanged row for the user copy. Claude Code 2.1.296 currently documents the unscoped form as removing the declaration from every scope, so planning must record this project-first behavior in `PROJECT.md` under a stable project decision ID before implementing or pinning it.
- **D-02 (user):** When only the user scope contains the name, an unscoped remove removes that sole user-scope match. Project-first is precedence for an ambiguous cross-scope match, not an implicit project-only default.
- **D-03 (user):** Resolve scope before resolving layer. If the project scope contains the name only in its local layer and the user scope contains it in its base layer, an unscoped flagless remove selects project scope and fails as `marketplace in local layer only`; it never falls through to the user scope.

### Cascade failure behavior

- **D-04 (user; corrected after code inspection):** Preserve the shipped MR-3 partial-result contract. Each plugin cascade remains individually fail-clean, but the marketplace command continues across plugins: successful removals persist, failed plugins remain installed and recorded, and any plugin failure keeps the marketplace record and its declaration. This supersedes the discussion's initial command-wide rollback choice, which was made before the existing binding continuation contract was surfaced.
- **D-05 (user):** A refusal discovered before mutation reports every discovered blocker, emits no `uninstalled` rows, changes nothing, and needs no reload.
- **D-06 (user):** Preserve the exact existing partial payload. Successful `uninstalled` rows come first and carry `needsReload: true`; failed rows follow and carry `needsReload: false`. The command requests reload exactly when at least one plugin was actually removed. Do not add new rollback-detail fields or a reload hint for a failure-only result in this phase.

### Result ordering

- **D-07 (user):** `marketplace list` groups every project row before every user row. Within each scope it preserves marketplace state-record insertion order; it does not alphabetize or reorder by timestamp.
- **D-08 (user):** Successful remove rows preserve cascade execution order. Failed preflight or cascade rows preserve discovery order. In a partial result, preserve the existing grouping from D-06: all successful rows precede all failed rows.

### Agent's Discretion

- Exact Gherkin step wording, fixture names, helper boundaries, and plan split, within the repository's Cucumber rules.
- Whether a behavior already covered by the current layer scenarios needs a new scenario or only reuse as setup, provided every Phase 4 requirement remains independently observable.
- Test mechanics for last-updated time, using the existing `{scenario time}` contract rather than weakening the assertion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project contract and phase scope

- `.planning/PROJECT.md` — upstream-parity rule, NFR-1 through NFR-7, scope model, D-MF-03 layer partition, and D-MF-04 per-scope marketplace ownership.
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, and dependency boundary.
- `.planning/REQUIREMENTS.md` — RM-01 through RM-08 and LS-01 through LS-04.

### Carried decisions

- `.planning/phases/03.2-marketplace-layer-partition/03.2-CONTEXT.md` — marketplace layer targeting, dependency retention, per-scope marketplace ownership, and real-Pi versus integration-test placement.
- `.planning/phases/03.3-plugin-layer-partition/03.3-CONTEXT.md` — plugin layer declarations, dependency behavior, fail-closed reads, and test placement.
- `.planning/phases/03.4-scope-and-layer-terminology/03.4-CONTEXT.md` — binding scope, base/local layer, config, reason-token, and cause-line terminology.

### Behavioral-test and output contracts

- `.agents/skills/cucumber/rules/layout.md` — vertical file families and marketplace verb step-module boundaries.
- `.agents/skills/cucumber/rules/features.md` — scenario, Outline, source-kind, table, and `{scenario time}` rules.
- `docs/output-catalog.md` — byte-level marketplace list/remove payload shapes, including the existing partial remove state.

### Upstream compatibility evidence

- `https://code.claude.com/docs/en/plugin-marketplaces` — official removal documentation; checked 2026-10-18. It confirms that removing a marketplace also uninstalls its plugins.
- Installed Claude Code `2.1.296`, `claude plugin marketplace remove --help` — checked 2026-10-18. It says omitting `--scope` removes the marketplace declaration from every scope; D-01 deliberately diverges.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/marketplace/remove.feature`: already covers base/local layer removal, other-layer refusals, persistence, retained declarations, and layer-scoped plugin cascades. Extend it without duplicating those proofs.
- `features/marketplace/list.feature`: existing marketplace-list scenarios and result-table vocabulary are the starting point for LS-01 through LS-04.
- `features/step_definitions/marketplace/add.steps.ts` and `features/step_definitions/marketplace/publishing.steps.ts`: reuse marketplace publication and setup steps; new verb-specific steps belong in `marketplace/remove.steps.ts` or `marketplace/list.steps.ts` when required.
- `features/step_definitions/plugin.steps.ts`: reuse installed-plugin, new-session, skill-presence, and plugin-list observations for the remove cascade.

### Established Patterns

- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`: `resolveScopeOrNotifyNotAdded` owns cross-scope selection; `planStandaloneRemove` enforces the selected layer; `cascadePluginsInPlace` continues per plugin; `emitPartialFailure` emits successes first and failures second.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts`: bare list iterates `project` then `user`, and `Object.values(state.marketplaces)` preserves record insertion order inside each scope.
- Source-kind coverage uses one Outline with untagged `dir`/`file` rows and tagged `@url`/`@github` examples. Phase 4's local rows must pass now; later source phases activate tagged rows.
- Behavioral scenarios exercise the real extension in headless Pi with local stand-ins. Unit tests continue to own isolated module branches and exact failure injection.

### Integration Points

- Marketplace edge handlers already canonicalize `remove|rm` and `list|ls`; Phase 4 pins behavioral equivalence rather than adding aliases.
- Remove output flows through `REMOVE_CONTEXT` and `notifyWithContext`; list output flows through the marketplace-list context. Scenario tables must assert the structured result rather than terminal bytes.
- State and config persistence are observed after a new Pi session. No scenario may rely on temporary paths or implementation module names.

</code_context>

<specifics>
## Specific Ideas

- Make the multi-source no-plugin removal behavior one Scenario Outline, as the roadmap requires.
- Use deliberately non-alphabetical marketplace names to prove insertion order and a project name that sorts after a user name to prove project-first grouping.
- Use deliberately non-alphabetical plugin names to discriminate cascade execution/discovery order.
- For partial cascade fixtures, assert the existing mixed payload: successful rows first, failed rows second, marketplace retained, and reload requested only when at least one success occurred.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-marketplace-remove-and-list*
*Context gathered: 2026-10-18*
