# Phase 7: Marketplace Autoupdate - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 completes the real-Pi Cucumber contract for `marketplace autoupdate`
and `marketplace noautoupdate` (AU-01 to AU-09): by name and for every
marketplace, the new-marketplace default as a source-kind Outline, the setting
in `list` and `info` and across a new session, both scopes, and the not-added
results. The scenarios extend `features/marketplace/autoupdate.feature`, which
already holds the Phase 3.2 layer scenarios (LAYER-02).

The discussion chose two production changes, each written test-first: a local
entry without a value inherits its value (D-02 to D-05), and an unscoped miss
carries no scope (D-08). The phase does not activate the `@url` and `@github`
rows, which wait for Phases 9 and 10.

</domain>

<decisions>
## Implementation Decisions

### Row order of a nameless flip

- **D-01 (user):** Keep today's order. Within each scope, the rows of the
  marketplaces whose value changed come first, then the
  `(skipped) {already autoupdate}` or `{already no autoupdate}` rows. Each group
  keeps state-record insertion order, and project rows come before user rows.
  No production change. The scenario uses deliberately non-alphabetical names
  with interleaved starting values, such as `zeta` on and then `alpha` off, so
  it tells this grouping apart from insertion order and from alphabetical
  order.

### A local entry without a value inherits it

- **D-02 (user):** A local-config entry that has no `autoupdate` value is
  judged by the value it inherits. When the base config declares the
  marketplace, it inherits the base entry's value, and a base entry without a
  value is off (MAU-4). Otherwise it inherits off. This replaces the Phase 3.2
  research rule ("an absent value in the local layer is no value at all, so a
  flip always writes it"). It refines 3.2 D-07: "already" is still judged per
  target layer, but the local layer's value now includes what it inherits. The
  rule applies to named and nameless flips, with and without `--local`.
- **D-03 (user):** As a result, a local flip writes an explicit value only
  when the flip changes the effective value:
  - After `marketplace add <src> --local` (declared in the local config only),
    `noautoupdate <name> --local` reports `(skipped) {already no autoupdate}`
    and writes nothing.
  - When the base config declares the marketplace off and the local entry has
    no value, `noautoupdate <name> --local` also reports
    `{already no autoupdate}` and writes nothing.
  - When the base declares it on and the local entry has no value,
    `noautoupdate <name> --local` still writes an explicit local `false` and
    reports `autoupdate disabled` (a per-machine override).
    `autoupdate <name> --local` there reports `{already autoupdate}`.
  - A local entry that has an explicit value is judged by that value, as it is
    today.
- **D-04 (user):** A nameless flip without `--local` judges a local entry
  against the base value as it stands after the flip. When the flip writes the
  base config, a local entry with no value is not written: it inherits the new
  value. A local entry whose explicit value differs from the request is still
  written. Every declaring layer still ends with the requested effective value,
  which is the outcome of 3.2 D-06. This rewrites the Phase 3.2 scenario
  "Enabling autoupdate for every marketplace sets it in each config that
  declares the marketplace": the local `tools` entry keeps no value, and the
  title changes to match.
- **D-05 (derived from CFG-03 and the fail-closed rule):** A local flip now
  needs the inherited value, so it must read the base config. When the
  inherited value is needed and the base config is invalid, the flip fails with
  the CFG-03 `invalid manifest` row that names the base file. It writes
  nothing. Never guess an inherited value from a config that cannot be read.
  Under `--local`, writes and rows still cover only the local layer (3.2 D-09).
  The planner chooses whether the base is read always or only when it is
  needed. The unit test "D-09: an unnamed --local flip reads only the local
  config" changes either way.
- **D-06:** Each behavior change in D-02 to D-04 first gets a scenario that
  fails on today's code, then the fix makes it pass (the Phase 6 C-10
  precedent). Paired unit tests keep 100% direct coverage. The change gets a
  CHANGELOG line, and every doc that states the old "always writes" rule is
  corrected. The tests that pin the old rule are listed under Integration
  Points.

- **D-09 (user, after research):** D-05 is proven the same way as the other
  decisions: by paired unit tests as usual and by a cucumber scenario. Every
  decision in this phase serves the cucumber suite. No step can make a config
  invalid today, because `.agents/skills/cucumber/rules/steps.md` allows only
  one config-writing step, the `plugins`-member writer. So this phase adds a
  second config step. It writes the raw text of one layer config, which
  models a hand edit that breaks the file. Its library code goes in
  `features/lib/layer-config.ts`, and the step goes in
  `features/step_definitions/config.steps.ts`. The steps.md rule is amended
  to name both writers. The D-05 scenario runs a `--local` flip that needs the
  inherited value while the base config is malformed. It expects the
  CFG-03 `invalid manifest` failure naming `claude-plugins.json` and no
  change to either config. This resolves Open Question 1 of
  07-RESEARCH.md. Any gate that enforces the "only config step that writes"
  rule (for example in `npm run check:features`) is updated with the rule.

### Not-added results

- **D-07 (user):** Pin the scoped misses in both directions for both verbs.
  When only the project holds the name, `autoupdate <name> --scope user` and
  `noautoupdate <name> --scope user` fail with `marketplace-not-added`,
  scope `user`, and the reason `marketplace not added to user scope`. The
  reverse direction is the same with `--scope project`. No config changes. This
  mirrors RM-05 and INFO-06.
- **D-08 (user):** An unscoped `autoupdate <name>` or `noautoupdate <name>` for
  a name that neither scope holds fails with `marketplace-not-added` and
  **no scope**. This matches `remove`, `info`, and `update` (RM-06, INFO-05,
  UPD-09). Today the result names `[project]`, the first scope tried (ATTR-05,
  output-catalog S2). That is a production change in `notifyNamedMiss`, the
  catalog S2 entry, the unit tests, and the cross-op convergence matrix, where
  autoupdate moves into the bracketless bare-form matrix. It is written
  test-first. Unchanged: when no scope changed, a layer refusal is still
  reported as the first scope's refusal (3.2 D-09), and an explicit `--scope`
  miss still carries the requested scope. — **Reversibility:** costly — it
  changes the documented catalog S2 bytes and the JSON `marketplace-not-added`
  payload's `scope` field, so undoing it touches the catalog, the convergence
  matrix, and the unit and behavioral tests again.

### Pinned as they are (carried forward, not re-asked)

- AU-09 (milestone invariant): an unscoped named flip changes every scope whose
  target layer declares the name, project row before user row. A scope whose
  target layer does not declare the name produces no row (3.2 D-09).
- 3.2 D-05 to D-07 otherwise stand: a named flip changes only its target layer
  and is refused when only the other layer declares the marketplace. A row
  reports the target layer, so a base flip reports the base value even when a
  local value overrides it.
- The flip changes no installed plugin and needs no reload. Severity is
  `info` for changed and already-set rows.
- AU-03 is an Outline over a flagless add, with an untagged `dir`/`file`
  block, an `@url` block, and an `@github` block. Phase 3 set this pattern even
  for requirements that list only dir.

### Claude's Discretion

- Exact Gherkin wording, fixture names, step boundaries, and plan split, within
  `.agents/skills/cucumber/rules/`.
- How AU-05 proves persistence, as long as the asserted value is one the
  default cannot produce. For example: `autoupdate`, then a new session that
  shows on in both `list` and `info`; or `autoupdate`, then `noautoupdate`,
  then a new session that shows off.
- Whether AU-09 uses different starting values per scope (one scope
  `already autoupdate`, the other `autoupdate enabled`) to show that each scope
  is judged on its own.
- Whether AU-06, AU-07, and the D-07 misses run for both verbs as separate
  scenarios or as an Outline (an Outline needs three or more variants).
- Whether a new `features/step_definitions/marketplace/autoupdate.steps.ts` is
  needed, or the shared steps suffice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project contract and phase scope

- `.planning/PROJECT.md`: the upstream-parity rule, "Terminology: Scope and
  Layer" (line 13), D-MF-03, the network and containment rules, and the
  two-scope model.
- `.planning/ROADMAP.md`: the Phase 7 goal and success criteria, the
  source-kind strategy, and the milestone invariants (AU-09 pinned; the
  `@url`/`@github` exclusion).
- `.planning/REQUIREMENTS.md`: AU-01 to AU-09, and LAYER-02.
- `.planning/phases/03.2-marketplace-layer-partition/03.2-CONTEXT.md`: D-05 to
  D-09, the layer rules for autoupdate. D-02 to D-04 above refine its D-07.
- `.planning/phases/04-marketplace-remove-and-list/04-CONTEXT.md`: the ordering
  precedents (D-07, D-08) and the not-added forms.
- `.planning/phases/05-marketplace-info/05-CONTEXT.md`: D-03, the form of a
  scoped miss.
- `.planning/phases/06-marketplace-update-and-c-10-fix/06-CONTEXT.md`: the
  test-first precedent (D-03) and the project-first order (D-11).

### Behavioral-test and verification contracts

- `.agents/skills/cucumber/SKILL.md`, with `rules/layout.md`, `rules/features.md`,
  and `rules/steps.md`: file placement, Outline and tag rules, whole-result
  tables, and run tokens.
- `.agents/skills/typescript-unit-tests/SKILL.md`: paired-test placement and
  case design.
- `.agents/skills/local-verification/SKILL.md`: focused checks, paired direct
  coverage, and combined-tree gates.
- `features/marketplace/autoupdate.feature`: the existing Phase 3.2 scenarios
  that this phase extends (one is rewritten by D-04).
- `features/marketplace/remove.feature` and `features/marketplace/info.feature`:
  the scoped and unscoped not-added scenarios that D-07 and D-08 mirror.
- `features/marketplace/update.feature`: "An update without a scope reports a
  marketplace missing from both scopes", the no-scope form for D-08.
- `docs/output-catalog.md` (about lines 4473 to 4490): the ATTR-05 S1 and S2
  entries. S2 changes with D-08.
- `docs/json-output.md`: the published `marketplace-not-added` payload.

### Upstream compatibility evidence

- **Question:** does Claude Code have a command to switch marketplace
  auto-update, and what is the default for a new marketplace?
- **Claude Code 2.1.296**, checked 2026-10-19:
  - `claude plugin marketplace --help` lists only `add`, `list`, `remove|rm`,
    and `update`, so the CLI has no auto-update switch.
  - A grep of the installed binary
    (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.296/claude`)
    finds the `/plugin` UI entries "Enable auto-update" and "Disable
    auto-update", the note "Auto-update enabled. Claude Code will automatically
    update this marketplace and its installed plugins.", and a marketplace
    entry written with `autoUpdate:!1` (off).
- **Confidence:** high for the CLI surface (help output). Medium for the
  default (binary strings, not traced through the code).
- **Pi constraints:** the `autoupdate` and `noautoupdate` commands, their row
  grammar and ordering, and the two layers (D-MF-03) exist only in Pi. No
  upstream position applies to D-01 to D-08. AU-03's default of off agrees with
  upstream for third-party marketplaces.
- **Divergence:** this phase introduces none.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/step_definitions/marketplace/publishing.steps.ts`: publishes a
  marketplace as a `<source kind>` source and adds it to a scope.
- `features/step_definitions/command.steps.ts`: runs a command and compares the
  whole result: fields, marketplace rows, and the empty-result step.
- `features/step_definitions/config.steps.ts`: reads which marketplaces the
  user's `claude-plugins.json` and `claude-plugins.local.json` declare, and
  asserts that a config file does not exist.
- `features/step_definitions/session.steps.ts`: "the user starts a new pi
  session", for AU-05.
- `features/step_definitions/marketplace/info.steps.ts` and
  `features/lib/marketplace-info-fields.ts`: the info field rows, including
  autoupdate.
- `features/lib/layer-config.ts` and the `plugins` writer step in
  `features/step_definitions/config.steps.ts`: the pattern for the second
  config writer of D-09.

### Established Patterns

- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`:
  - `layerAlreadySet` (about line 297) decides "already" per layer. It is the
    D-02 change point: a local entry without a value currently returns not set.
  - `planFlip` (about line 312), `planNamedFlip` (about line 401), and
    `planEveryFlip` (about line 434) build each scope's changed and unchanged
    sets. `planNamedFlip` loads only the target layer, and the nameless
    `--local` form loads only the local config; D-05 changes both.
  - `collectFlipRows` (about line 482) emits changed names first (D-01, kept).
  - `notifyNamedMiss` (about line 545) sets `scope: opts.scope ?? "project"`,
    the D-08 change point.
  - `writeFlipPlan` writes one batched patch per layer, carrying only
    `autoupdate`.
- `orchestrators/marketplace/shared.ts`: `marketplaceLayerVerdict` (the layer
  gate) and `crossScopeFlag` (the cross-scope reason of D-07).
- `persistence/config-merge.ts`: local fields win over base fields, which is
  the merged value that `list` and `info` show.

### Integration Points

The tests and docs that pin today's rules and must change:

- `tests/orchestrators/marketplace/autoupdate.test.ts`:
  - "LAYER-02: a local flip writes an explicit value into a local entry that
    has none" (D-02, D-03)
  - "D-07: an unnamed enable over a base value that is on writes the explicit
    value into a local entry that has none" (D-04)
  - "D-06: an unnamed flip sets the value in every layer that declares each
    marketplace" (D-04)
  - "D-09: an unnamed --local flip reads only the local config" (D-05)
  - "reports a named marketplace absent from both implicit scopes" and
    "SCOPE-01: an unscoped flip both scopes miss names no other scope, even one
    that records the marketplace" (D-08)
- `tests/integration/marketplace-layer-autoupdate.test.ts`: check "D-07: the
  list reads the value both layers carry, then the local override" against
  D-02 to D-04.
- `tests/architecture/cross-op-convergence.test.ts`: the scope-bracket
  asymmetry comment and matrices. Autoupdate leaves the explicit-only group
  for the bare form (D-08).
- `docs/output-catalog.md` S2 and any catalog fixture that locks its bytes.
  Also `CHANGELOG.md`.

</code_context>

<specifics>
## Specific Ideas

- Show each production change failing first on today's code, on a behavioral
  assertion, then passing.
- In the D-01 scenario, use interleaved starting values under non-alphabetical
  names, so neither insertion order nor sorting passes.
- In the D-03 scenarios, assert the local config's exact declaration after the
  command, so a stray explicit `false` fails.
- Assert that the configs are unchanged in the D-07 scenarios, as RM-05 does.

</specifics>

<deferred>
## Deferred Ideas

- Activating the `@url` and `@github` rows remains in Phases 9 and 10.
- A session-start autoupdate run (Claude Code parity) remains deferred in
  PROJECT.md. Discussion did not reopen it.

</deferred>

---

*Phase: 07-marketplace-autoupdate*
*Context gathered: 2026-10-19*
