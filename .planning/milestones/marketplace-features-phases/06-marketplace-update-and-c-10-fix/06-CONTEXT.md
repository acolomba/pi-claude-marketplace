# Phase 6: Marketplace Update and C-10 Fix - Context

**Gathered:** 2026-10-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 completes the real-Pi Cucumber contract for `marketplace update`:
named and bare updates, unchanged and changed manifests, autoupdate-off and
autoupdate-on behavior, path-source failures, cross-scope ordering, and C-10.
It may correct production behavior exposed by those scenarios, including file
source identity and semantic manifest comparison, but it does not activate the
remote git stand-ins reserved for Phases 9 and 10.

</domain>

<decisions>
## Implementation Decisions

### C-10 file identity

- **D-01 (user; upstream parity):** A file-based marketplace keeps the exact
  resolved manifest file as its authoritative source. `info` shows that exact
  file path for every file source, including a conventional
  `.claude-plugin/marketplace.json`; directory sources continue to show their
  directory. This follows Claude Code's distinct `file` and `directory` source
  types.
- **D-02 (user):** Do not copy a local file-source manifest into a managed or
  conventional layout. Every update rereads the exact file originally added.
  If that source no longer exists, report `source missing`, keep the marketplace
  registered, and do not search for or fall back to another manifest.
- **D-03 (user):** Prove C-10 with a real-Pi behavioral regression scenario and
  the repository's normal paired unit tests at 100% direct coverage. The
  behavioral scenario must update the external manifest in place and observe
  the refreshed contents.

### Change detection

- **D-04 (user):** Compare the old and refreshed manifests as parsed JSON.
  Whitespace and object-key order do not count as changes.
- **D-05 (user):** Tolerated but currently unrecognized fields remain part of
  the comparison. Adding, removing, or changing one reports `updated`.
- **D-06 (user):** Array order remains significant. Reordering plugin entries
  or another array reports `updated` because array order can affect visible
  behavior.
- **D-07 (user):** Invalid refreshed JSON or an invalid refreshed manifest
  fails that update, keeps the marketplace registration, and causes no plugin
  or autoupdate changes. A later update rereads the source and can succeed once
  it is fixed.

### Autoupdate cascade

- **D-08 (user):** Process installed plugins in installed-record order. A
  plugin failure does not stop later plugins; emit one result for every
  attempted installed plugin.
- **D-09 (user):** A plugin that is installed but absent from the refreshed
  manifest stays installed and enabled. Emit a skipped `not in manifest`
  warning. A newly offered plugin is not auto-installed.
- **D-10 (user):** When the marketplace refresh succeeds, its primary result
  remains `updated` even if a plugin autoupdate fails. Report plugin failures in
  their own rows instead of replacing the marketplace result with an aggregate
  failure.

### Bare update sequencing

- **D-11 (user):** Process all project marketplaces before all user
  marketplaces. Within each scope, preserve saved marketplace-record insertion
  order.
- **D-12 (user):** A failed marketplace refresh does not stop the bare update.
  Continue through every remaining marketplace and emit one primary result per
  marketplace.
- **D-13 (user):** Emit each `mcp-config-notices` payload immediately after the
  marketplace/plugin cascade that produced it and before the next marketplace
  result. Targeted tests measured and confirmed this current order on
  2026-10-18.

### Agent's Discretion

- The structural comparison implementation, provided it ignores object-key
  order, preserves array order, and includes tolerated unknown fields.
- Exact Gherkin wording, fixture names, step boundaries, and plan split within
  the repository's Cucumber rules.
- The focused paired unit-test cases needed around the behavioral regression,
  provided changed source-test pairs retain 100% direct coverage.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project contract and phase scope

- `.planning/PROJECT.md` — upstream-parity rule, recovery and retry contracts,
  network policy, containment, output-channel rules, and two-scope model.
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, and research flag.
- `.planning/REQUIREMENTS.md` — FIX-01; UPD-01 through UPD-10; UPD-13 and
  UPD-14.
- `.planning/phases/05-marketplace-info/05-CONTEXT.md` — current info source
  projection and the Phase 5 boundary that deferred C-10 to this phase. D-01
  above refines its conventional file-source path expectation to match
  upstream.

### Behavioral-test and verification contracts

- `.agents/skills/cucumber/rules/layout.md` — vertical feature and step-module
  placement.
- `.agents/skills/cucumber/rules/features.md` — Scenario Outline, source-kind,
  tag, table, and placeholder rules.
- `.agents/skills/typescript-unit-tests/SKILL.md` — paired-test placement,
  case design, doubles, and boundary rules.
- `.agents/skills/local-verification/SKILL.md` — focused checks, paired direct
  coverage, and combined-tree gates.
- `features/marketplace/update.feature` — existing bare-update scenario and
  the feature file this phase extends.
- `docs/output-catalog.md` — structured notification vocabulary and payload
  rendering contract.

### Upstream compatibility evidence

- `https://code.claude.com/docs/en/plugins/cli-reference` — official Claude
  Code command reference checked 2026-10-18. It distinguishes local
  `directory` and `file` sources, reads each in place, reports local paths, and
  defines named and bare marketplace refresh behavior.
- Installed Claude Code `2.1.296`, `claude plugin marketplace --help`, and
  `claude plugin marketplace update --help` — checked 2026-10-18. Upstream has
  no scoped marketplace-update flag and does not expose Pi's detailed
  `updated` versus `up-to-date` result grammar.

**Compatibility conclusion:** Exact local-file identity and rereading the file
in place follow upstream. Pi's two-scope order, per-marketplace payloads,
change classification, cascade rows, and notice ordering are project-specific
contracts governed by the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/marketplace/update.feature`: already proves one bare update across
  both scopes in project-first order; extend it rather than creating another
  update feature.
- `features/step_definitions/marketplace/publishing.steps.ts` and
  `features/step_definitions/marketplace/add.steps.ts`: provide marketplace
  publication, source-kind, and add setup. New update-specific actions and
  assertions belong in a marketplace update vertical.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`:
  already owns named/bare refresh, autoupdate cascades, per-marketplace failure
  isolation, scope order, and adjacent MCP-notice emission.
- `tests/orchestrators/marketplace/update.test.ts`: already contains focused
  update, bare-order, autoupdate, path-failure, and MCP-notice coverage to
  extend without creating a parallel test module.

### Established Patterns

- `updateAllMarketplaces` enumerates project then user and preserves object
  insertion order within each state record. It catches each marketplace
  failure so later marketplaces still run.
- The current file-source defect is in root reconstruction: update derives
  `.claude-plugin/marketplace.json` from `marketplaceRoot` instead of rereading
  `record.manifestPath`. The fix must preserve separate manifest-file identity
  and plugin-relative resolution root semantics.
- Current change detection compares `JSON.stringify` results of parsed
  manifests. It already ignores whitespace but incorrectly treats object-key
  order as significant; planning must replace only that comparison behavior.
- Autoupdate already produces one marketplace cascade followed immediately by
  any `mcp-config-notices` payload. The bare-update loop preserves that
  adjacency before advancing to the next marketplace.
- Source-kind behavioral coverage uses untagged `dir` and `file` rows with
  tagged `@url` and `@github` rows. Local rows must pass in this phase; later
  source phases activate the tagged remote rows.

### Integration Points

- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` must
  project the exact manifest path for file sources after D-01.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` owns persisted
  marketplace records whose `manifestPath` and `marketplaceRoot` meanings must
  remain distinct.
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` emits
  `mcp-config-notices`; update must preserve one adjacent notice emission per
  producing marketplace cascade.
- Behavioral scenarios exercise the real extension through headless Pi and
  assert structured JSON payloads. They must not call implementation modules
  or depend on temporary absolute paths.

</code_context>

<specifics>
## Specific Ideas

- Write the C-10 scenario first and observe it fail against the current root
  reconstruction. Rewrite the external manifest with valid content of a
  different file size so the mtime/size cache cannot hide the update.
- Use deliberately non-alphabetical marketplace names to distinguish insertion
  order from sorting in the bare-update scenario.
- Include a bare-update case where an early marketplace produces an MCP notice
  and a later marketplace produces its own primary result, proving adjacency
  rather than merely proving both payloads exist.
- Keep autoupdate scenarios explicit about installed-record order, a removed
  catalog entry, a newly offered entry, independent plugin failure rows, and
  the version observed in a new Pi session.

</specifics>

<deferred>
## Deferred Ideas

- Activating `@url` and `@github` behavioral rows remains in Phases 9 and 10.

### Reviewed Todos (not folded)

- `.planning/todos/pending/2026-10-13-cucumber-rules-trial.md` §3: porting the
  Cucumber skills and gates to `acolomba/blueprint-typescript` concerns another
  repository and does not belong in Phase 6.

</deferred>

---

*Phase: 6-marketplace-update-and-c-10-fix*
*Context gathered: 2026-10-18*
