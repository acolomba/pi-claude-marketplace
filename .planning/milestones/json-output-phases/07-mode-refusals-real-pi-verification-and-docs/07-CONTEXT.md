# Phase 7: Mode Refusals, Real-Pi Verification, and Docs - Context

**Gathered:** 2026-10-09 (America/New_York)
**Status:** Ready for planning

<domain>
## Phase Boundary

Refuse browse outside tui and device-flow authentication in print mode.
Prove the JSON contract with real headless Pi, document its schema and limits,
and finish the temporary corpus tool's lifecycle. Requirements MODE-03,
MODE-04, TENB-03, JDOC-01, JDOC-02, JDOC-03 and all six ROADMAP criteria apply.
The user approved writing this context and continuing planning with option 1.

**Upstream compatibility:** These choices concern Pi-specific modes, output,
testing, and documentation. No Claude Code upstream position applies to the
wording or document layout. Existing command vocabulary, scope, and install
semantics remain fixed. This assessment follows the compatibility research
skill; confidence high for this scope assessment, observed 2026-10-09.
Evidence: ROADMAP criteria, prior Phase 5/6 contexts, browse handler and
host-auth composition. No new upstream divergence is proposed.

</domain>

<decisions>
## Implementation Decisions

### Refusal messages

- **D-01:** Browse refusals name the actual current mode and the replacement
  command: "Browse is unavailable in json mode. Use /claude:plugin list
  instead." Substitute rpc or print for json as appropriate. No list fallback;
  tui behavior stays unchanged.
- **D-02:** Use brief device-flow refusal wording: "Device-flow authentication
  is unavailable in print mode. Retry with --mode json or interactive Pi."
  Preserve the requirement for a typed error and fail before device-flow
  polling. Stored credentials and operations that do not need device flow
  must continue to work.
- **D-03:** Include existing usage help with JSON and RPC browse refusals.
  The user corrected their initial refusal-only choice: "usage help can always
  appear in json", then explicitly chose matching RPC behavior. This is about
  refusal help, not adding help to every successful payload. Keep text refusal
  focused on its error and remedy.

### Documentation layout

- **D-04:** Put instructions and reference material in `docs/json-output.md`.
  Add only a short README link, not a README quick-start example.
- **D-05:** Begin the guide with a runnable command and extracted result,
  then explain the format. Put limitations in a later dedicated section.
- **D-06:** Document common envelope fields once, followed by the fields for
  each payload kind. Cover every kind and field, version compatibility, and
  maximum severity over command-origin entries.

### Script examples

- **D-07:** Use small task-based examples for extracting plugin rows,
  calculating command severity, and detecting reload needs, rather than one
  large script. Use jq as required by JDOC-01.
- **D-08:** The exit-status example fails on errors and displays warnings
  without failing. This is the example's policy, not a change to wire severity
  or Pi's process exit behavior.
- **D-09:** If no command outcome arrives, fail with "No command outcome
  received". Silence does not prove success; prompts or diagnostics alone
  cannot satisfy the outcome check.
- **D-10:** Show earlier results together with a final error to explain partial
  failure. Completed changes remain and `needsReload` can still be true.

### Carried constraints

- **D-11:** Real-Pi testing uses the required headless command with stdin
  closed, schema-valid claude-plugin stdout entries, entry_appended at the
  peer floor, and proof that startup entries are not streamed. Keep the Pi
  peer floor at 0.86.1 and use isolated fixtures without operator credentials.
- **D-12:** Document all JDOC-02 limitations and Phase 6's accepted delivery
  limit: one direct recovery attempt on append failure, no operation retry,
  no rollback promise, and possible missing output if the sink stays broken.
  Keep per-command correlation separate from tracking or telemetry.
- **D-13:** Amend AGENTS.md IL-2 to match PROJECT.md D8; close MRO-01 and
  correct its two false claims. After the final strict corpus re-diff is empty
  against the narrowly amended baseline authorized by D-14,
  delete the three scripts/notify-corpus*.mjs files and remove references
  outside .planning/. Only the two sanctioned output-catalog prose corrections
  are allowed: resolver owns soft-dependency markers; dispatch text strategy
  renders device-flow values. Preserve fenced blocks and count/byte locks.

### Approved corpus exception

- **D-14:** The user selected option 1 after research exposed the conflict
  between new print refusals and the zero-additions corpus rule. Allow only
  new samples caused by the Phase 7 browse/device-flow refusals. Preserve all
  3,149 existing samples exactly, including per-file multiplicity, severity,
  and argument count. Record every addition in an exact ledger before updating
  the baseline. No removals, replacements, unrelated additions, recorder
  suppression, or catalog-example changes are authorized. The final comparison
  must show the amended baseline fully present and zero unexplained extras
  before deleting the three corpus scripts. This narrowly supersedes the
  earlier fixed-3149/zero-additions interpretation of D-13 and ROADMAP criterion 6.

### the agent's Discretion

Use existing schema, notification, authentication, and e2e mechanisms.
Choose internal names, test fixtures, task boundaries, and document section
names within the agreed behavior. Do not add dependencies, new product
features, output sinks, or unrelated documentation work without need.

</decisions>

<canonical_refs>
## Canonical References

Downstream agents must read these before planning or implementing.

- `.planning/ROADMAP.md`, Phase 7: all six acceptance criteria.
- `.planning/REQUIREMENTS.md`: the six phase requirements and exclusions.
- `.planning/PROJECT.md`: output policy and compatibility constraints.
- `.planning/research/SUMMARY.md`: locked milestone decisions D1-D8.
- `.planning/research/FEATURES.md` and `.planning/research/ARCHITECTURE.md`:
  payload contract and Pi delivery behavior; active requirements supersede
  the old invocation-ID deferral.
- `.planning/phases/06-command-run-contract/06-CONTEXT.md` and
  `.planning/phases/06-command-run-contract/06-VERIFICATION.md`: run identity,
  outcomes, failure semantics, and approved delivery limits.
- `.planning/phases/05-mode-selected-json-sink/05-CONTEXT.md`: live mode
  selection and startup streaming gap.
- `.planning/phases/04-wire-schema-and-json-strategy/04-CONTEXT.md`: wire
  compatibility and redaction policy.
- `.planning/phases/01-presentation-model/01-CONTEXT.md`: temporary corpus
  lifecycle; strict corpus baseline is now 3149 entries, zero extras.
- `docs/output-catalog.md`: frozen text contract (baseline 26cb0056).
- `README.md`: short guide link only.
- `.planning/BACKLOG.md`, MRO-01: closeout and corrections.
- `AGENTS.md`, `skills/local-verification/SKILL.md`, and
  `skills/claude-code-compat-research/SKILL.md`: project constraints.

Supporting writing research (observed 2026-10-09; guidance, not product rules):
- https://developers.google.com/tech-writing/error-messages/show-fix —
  explain the problem and a concrete remedy.
- https://www.diataxis.fr/start-here/ — practical guidance and technical
  reference serve different reader needs.
- https://jqlang.org/manual/ — filtering, aggregation, and exit-status options.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts`: current
  non-tui list fallback; preserve argument validation and interactive flow.
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`: host-specific
  credential/device-flow binding, shared by network operations.
- `extensions/pi-claude-marketplace/shared/notification-wire.ts`,
  `notification-dispatch.ts`, and `notification-run.ts` in the same directory:
  typed schema, sink ownership, and command outcome lifecycle.
- `tests/e2e/_helpers.ts` and `tests/e2e/pi-runtime-smoke.test.ts`: existing
  real-runtime test patterns to inspect before extending.

### Established Patterns

README links to detailed topic guides in docs/. Machine output uses session
entries; print follows Pi's silent notify behavior. Commands retain their
outer identity, and nested work shares one invocation ID. JSON/RPC output
must not also notify or write directly to stdout/stderr.

### Integration Points

Browse handler and owner tests; auth-host and credential callback/error
propagation; real-Pi e2e harness and CI; schema reference and README link;
AGENTS.md, backlog, and corpus tool references. Research must check whether
existing tests exercising non-tui fallbacks affect the frozen corpus before
planning changes. Do not silently recapture corpus differences.

</code_context>

<specifics>
## Specific Ideas

The user chose a dedicated guide, examples before reference, and limitations
later. Consumer examples treat missing outcomes as failure while preserving
successful partial results. Usage help is explicitly welcome in JSON/RPC
browse refusals. All three discussion areas are complete.

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope.

</deferred>
