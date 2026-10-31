# Phase 5: Marketplace Info - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 completes the real-Pi Cucumber contract for `marketplace info`: one
source-kind Outline, project-first scope fan-out, scoped and unscoped
not-added results, invalid-manifest reporting, and the manifest's allowed
cross-marketplace dependencies. It may correct production behavior exposed by
those scenarios, but it does not add a new marketplace capability or activate
the remote git stand-ins reserved for Phases 9 and 10.

</domain>

<decisions>
## Implementation Decisions

### Invalid manifests and scope fan-out

- **D-01 (user):** Preserve the shipped invalid-manifest representation: a
  known marketplace whose manifest can no longer be loaded renders through the
  existing `plugin-info` failed-row shape with `{invalid manifest}`. Phase 5
  does not introduce a new marketplace-failure message type.
- **D-02 (user):** When an unscoped info lookup finds the name in both scopes,
  evaluate and report the scopes independently in project-first order. A
  healthy scope still renders when the other scope's manifest is invalid; the
  invalid scope renders its failed row instead of failing or suppressing the
  entire command.

### Scoped misses

- **D-03 (user):** When `--scope` names a scope that does not hold the
  marketplace but the other scope does, report
  `<name> [<requested-scope>] (failed) {marketplace not added}` and preserve the
  existing cross-scope indication that a copy exists elsewhere. Do not fall
  back to or render the other scope's marketplace.

### Allowed dependency marketplaces

- **D-04 (user):** Display `allowCrossMarketplaceDependenciesOn` names in
  manifest declaration order. Do not alphabetize them. The scenario must use a
  deliberately non-alphabetical list so it proves the ordering contract.

### Agent's Discretion

- Exact Gherkin wording, fixture names, helper boundaries, and plan split,
  within the repository's Cucumber rules.
- Whether a behavior already pinned by focused unit tests needs production
  changes or only behavioral coverage.
- The exact non-alphabetical marketplace names used to prove D-04.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project contract and phase scope

- `.planning/PROJECT.md` — upstream-parity rule, scope model, network policy,
  containment, output-channel contract, and existing marketplace decisions.
- `.planning/ROADMAP.md` — Phase 5 goal and three success criteria.
- `.planning/REQUIREMENTS.md` — INFO-01 through INFO-06, INFO-08, and INFO-09.

### Behavioral-test contracts

- `.agents/skills/cucumber/rules/layout.md` — vertical file families and
  marketplace verb step-module boundaries.
- `.agents/skills/cucumber/rules/features.md` — Scenario Outline, source-kind,
  tag, table, and placeholder rules.
- `features/marketplace/info.feature` — current four-scenario starting point
  and the shipped invalid-manifest result shape.
- `docs/output-catalog.md` — byte-level notification vocabulary that the
  structured Cucumber results project.

### Upstream compatibility evidence

- Installed Claude Code `2.1.296`, `claude plugin marketplace --help` and
  `claude plugin marketplace info --help` — observed 2026-10-18. The command
  set contains `add`, `list`, `remove`, and `update`; there is no marketplace
  `info` command, so Claude Code provides no exact info-output contract.
- `https://code.claude.com/docs/en/plugins/cli-reference` — official command
  reference checked 2026-10-18. It likewise documents only marketplace add,
  list, remove, and update. Its marketplace-list JSON fields establish the
  upstream source vocabulary: `repo` for GitHub, `url` for git/url, `path` for
  directory/file, and optional `ref` for pinned git sources.
- `https://code.claude.com/docs/en/plugins/marketplace-reference` — official
  marketplace schema checked 2026-10-18. It defines the marketplace manifest
  and source objects but no marketplace-info presentation.

**Compatibility conclusion:** Phase 5's command is a Pi extension surface, not
an upstream divergence. Source field names should stay aligned with upstream
where the concepts overlap; result shape, fan-out, and failure composition are
governed by this project's established notification grammar and the decisions
above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/marketplace/info.feature`: already covers one directory source, an
  unscoped miss, two-scope fan-out, and an invalid manifest. Convert and extend
  it rather than creating a parallel feature.
- `features/step_definitions/marketplace/publishing.steps.ts` and
  `features/step_definitions/marketplace/add.steps.ts`: existing publication,
  manifest, source-kind, and add setup belong here when reusable; new
  info-specific assertions belong in the info vertical.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`: already
  projects path, URL, GitHub, description, autoupdate, last-updated time, and
  allowed marketplaces; it also isolates manifest failures by scope.
- `extensions/pi-claude-marketplace/orchestrators/scope-fanout.ts`: collects
  project before user and narrows to an explicit scope when supplied.

### Established Patterns

- Source-kind coverage uses one Outline with untagged `dir` and `file` rows and
  tagged `@url` and `@github` rows. Phase 5's local rows must pass now; Phases 9
  and 10 activate the tagged remote rows.
- `buildNotAddedMessage` carries the requested scope only when `--scope` was
  supplied and uses `crossScopeFlag` to retain the other-scope indication.
- `buildManifestFailureMessage` intentionally reuses `PluginInfoMessage` so
  the standard failed-row discriminator and `{invalid manifest}` vocabulary
  remain stable.
- `renderAllowedMarketplaces` serializes the names without sorting, matching
  D-04's manifest-order decision.

### Integration Points

- The marketplace edge handler already parses `info <name> [--scope]`; Phase 5
  pins behavior rather than adding a command.
- Behavioral scenarios exercise the real extension in headless Pi and assert
  structured JSON results, not implementation calls or terminal bytes.
- A new Pi session is needed only when a criterion requires persisted state;
  info itself is read-only and must not touch the network.

</code_context>

<specifics>
## Specific Ideas

- Replace the directory-only source scenario with the roadmap's single
  four-row source Outline. Assert description for both local rows and the
  source-specific identity fields for every row.
- Use two allowed marketplace names whose lexical order is the reverse of
  their declaration order.
- Add an explicit scoped-miss scenario where the other scope holds the name,
  so D-03 proves both the failed requested scope and the cross-scope hint.
- Keep a mixed healthy/invalid two-scope case in focused coverage if the
  behavioral result schema can express both emissions without weakening the
  scenario.

</specifics>

<deferred>
## Deferred Ideas

- INFO-07 and all remote no-request proofs remain in Phase 9.
- Activating `@url` and `@github` examples remains in Phases 9 and 10.
- Marketplace update behavior, including a file source outside
  `.claude-plugin/`, remains in Phase 6.

</deferred>

---

*Phase: 5-marketplace-info*
*Context gathered: 2026-10-18*
