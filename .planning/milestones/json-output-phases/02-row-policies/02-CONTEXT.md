# Phase 2: Row Policies - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** Interactive autonomous run; remaining choices delegated to the agent

<domain>
## Phase Boundary

Replace per-command row-rendering callbacks with total maps of policy data.
Preserve every existing output byte and notification severity. Carry the
pending retained-workflow-staging advisory as `{name, envelopeCount?}` data,
with its sentence and indentation composed by the text formatter.

Requirements: PMOD-02 and PMOD-05. Other raw output surfaces belong to phase 3.
The wire schema and credential redaction belong to phase 4. Mode selection,
command identity, and real-Pi JSON verification belong to later phases.

Upstream contract: none applies to this internal refactor. Existing command
behavior stays unchanged. The `claude-code-compat-research` skill was applied
on 2026-10-01; no new Claude Code behavior or divergence requires research.

</domain>

<decisions>
## Implementation Decisions

### Preserved contracts

- **D-01:** Extend the policy already attached to each `CommandContext`, as
  phase 1 D-12 requires. Keep a total map keyed by status and its `satisfies`
  exhaustiveness check. The policies contain data, with no string-returning
  callback or function hidden inside a policy entry.
- **D-02:** Preserve all known differences: marker-free `partially-installed`
  list rows; content reasons on list `available` and `remote` rows; no reasons
  on reconcile-applied `uninstalled` rows; both `disabled` row forms; and
  pending rows independent of the soft-dependency snapshot. Each difference
  needs an owner test that checks both policy data and complete rendered text.
- **D-03:** Delete the render callbacks, central `renderPluginRow` switch,
  and `dispatchRow` string fallback by the end of the phase. Migrate the
  direct render-arm tests to policy and formatter assertions. Recount the
  current call sites before planning; the roadmap's 70 calls in 12 files is
  an inventory to verify, not permission to leave newly found callers behind.
- **D-04:** Preserve defensive missing-policy behavior in the resolved model.
  Keep the existing failed-row text and severity behavior, including the
  frozen-row handling. Removing the callback fallback must not erase that
  behavior or introduce a new exception path.
- **D-05:** Pending retained-workflow advisories carry only the observed facts
  `{name, envelopeCount?}`. Keep the existing single scan per invocation,
  empty-result behavior, order, and absence semantics. The text formatter
  owns the sentence and indent. Do not introduce a generic advisory framework
  for unrelated raw surfaces in this phase.
- **D-06:** Keep phase 1's shared `NotificationRun`, resolved reasons and
  failures, and internal readonly TypeScript model. No new probe occurs in
  rendering. Internal policy data is not the future public JSON schema.
- **D-07:** The phase closes with `npm run check` passing and production
  output unchanged. Starting baseline: 2,661 corpus entries and the catalog
  at upstream commit `e40d3dda` (206 states, 26,848 bytes). On 2026-10-01 the
  user approved a narrow exception: "yes, narrow update is fine". Replace
  only the 25 synthetic callback emissions enumerated in `02-RESEARCH.md`,
  plus the three summary-owner occurrences at original lines 2633, 2634,
  and 2640 identified during execution. The user explicitly approved this
  extension with "yes": 28 replacements total, 2,633 unchanged occurrences.
  On 2026-10-02 code review finding CR-01 required one more: the
  `emitMarketplaceNotAddedSignal` owner case in
  `tests/orchestrators/plugin/shared.test.ts` (original line 1907) gains its
  produced `{not installed, marketplace in user scope}` reasons. The user
  approved it with "Yes, approve this one replacement": 29 replacements
  total, 2,632 unchanged, 2,661 total in the immutable original blob.
  Replace them with the migrated tests' real-policy emissions. Record exact before/after
  triples, owner files, multiplicities, and the behavior each test preserves.
  Keep severity, argument count, and all other corpus occurrences unchanged;
  keep the production catalog unchanged. No full recapture, blanket acceptance,
  production template flexibility, or replayed literals to pass the corpus.

### Agent's Discretion

The user declined all proposed discussion areas and said:
"none, apply your best judgement, stay consistent with the rest of the codebase".

The agent owns policy readability, handling of unexpected runtime rows, and
the internal advisory representation within the contracts above. Prefer
explicit status entries matching existing tables. Share small data constants
only where actual repetition justifies them. Exact field names, module
boundaries, migration order, and test organization remain planner decisions.
Do not add abstractions, optional behavior, or compatibility adapters without
a current consumer. Keep commits and verification steps small enough to review.

</decisions>

<canonical_refs>
## Canonical References

Downstream agents must read these before planning or implementing:

- `.planning/ROADMAP.md`, Phase 2: the five acceptance criteria.
- `.planning/REQUIREMENTS.md`, PMOD-02 and PMOD-05: the required contracts.
- `.planning/phases/01-presentation-model/01-CONTEXT.md`, D-05 through D-13:
  the run, resolved model, and phase 1/2 seam decisions.
- `.planning/phases/01-presentation-model/01-VERIFICATION.md`: current
  implementation evidence and the accepted upstream catalog baseline.
- `docs/output-catalog.md`: the exact output contract.
- `.planning/phases/01-presentation-model/notify-corpus/baseline.jsonl` and
  `.planning/phases/01-presentation-model/notify-corpus/meta.json`: the
  committed comparison baseline. Inspect metadata and relevant entries.
- `AGENTS.md`: repository rules and quality gates.
- `skills/typescript-google-style-review/SKILL.md` and
  `skills/typescript-comments/SKILL.md`: TypeScript rules.
- `skills/typescript-unit-testing/SKILL.md` and
  `skills/typescript-unit-testing-review/SKILL.md`: test rules.

No external specification adds behavior to this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/shared/notification-resolve.ts` resolves
  row reasons and failures and owns the central marker policy.
- `extensions/pi-claude-marketplace/shared/notify-context.ts` defines the
  total command marker and render maps and the current defensive fallback.
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` formats
  the resolved rows and contains the existing row helpers.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`
  scans retained workflow staging once and currently composes advisory text.

### Established Patterns

Readonly interfaces, discriminated unions, explicit status tables, and
`satisfies` checks make missing cases visible during type checking. Tests
construct independent expected values and assert complete output strings.
Phase 1's marker-policy and workflow-marker architecture tests must survive
the new policy representation with their original guarantees.

### Integration Points

All command `*.messaging.ts` files, reconcile notifications, the central
notification path, and their direct render-arm tests require a fresh inventory.
The pending advisory must work for both cascade and empty-state messages.
Comments and type-member contract pins must follow each changed declaration.

</code_context>

<specifics>
## Specific Ideas

The user wants the agent's best judgment and consistency with the codebase.
This direction authorizes routine choices within phase 2's recorded boundary.

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope.

</deferred>
