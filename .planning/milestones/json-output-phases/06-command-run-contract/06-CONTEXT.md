# Phase 6: Command-Run Contract - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Every JSON payload identifies its origin. Command payloads identify their
command and share one invocation ID per run. Commands emit their complete
output before their promise settles. Unexpected command failures become typed,
redacted `internal-error` payloads in `json` and `rpc`. Text behavior stays fixed.

Requirements: WIRE-02, WIRE-07, JOUT-03, JOUT-04. All four Phase 6 success
criteria in `.planning/ROADMAP.md` remain binding, subject to the explicitly
accepted delivery limit in D-08 below.

Mode refusals, real-Pi e2e tests, and public documentation remain in Phase 7.

**Upstream compatibility:** This is Pi-specific output plumbing. No Claude
Code upstream position applies. The command vocabulary and behavior remain
unchanged. This assessment follows `skills/claude-code-compat-research/SKILL.md`.
Confidence: high for the scope assessment, observed 2026-10-09. The router and
Phase 5 context are the local evidence. No upstream divergence is proposed.

</domain>

<decisions>
## Implementation Decisions

The user selected each recommendation in the interactive discussion and
approved writing this context and continuing planning.

### Command identity

- **D-01:** Use canonical command names only. `ls` becomes `plugin list`.
  `marketplace rm` becomes `marketplace remove`. Do not add an alias field.
- **D-02:** Invalid commands use their recognized parent as the command ID.
  An unknown top-level verb uses `plugin`. A missing or unknown marketplace
  verb uses `marketplace`. The `usage-error` describes the mistake.
- **D-03:** Delegated work retains the outer command identity and the same
  invocation ID. Installation work inside `enable` remains `plugin enable`.
  Bare `/claude:plugin` uses `plugin browse`.
- **D-04:** `help marketplace` and `marketplace help` both use
  `marketplace help`.

### Explicit command outcomes

- **D-05:** A successful empty result uses the appropriate typed outcome.
  Do not manufacture a generic success acknowledgment on normal return.
  In JSON/RPC, a handler that returns without an outcome emits `internal-error`
  for the missing result.
- **D-06:** Device-flow prompts and diagnostics alone do not count as an
  outcome. A run that emits only those and returns normally also emits
  `internal-error` for the missing result. Help and usage errors are valid
  explicit responses. Planning must classify the existing result kinds and
  keep legitimate empty results valid.

### Failure after partial output

- **D-07:** Keep earlier entries and append `internal-error` for an unexpected
  throw, using the same invocation ID. The error payload preserves any reload
  requirement already reported by this run. Earlier `needsReload: true`
  therefore makes the subsequent error's `needsReload` true. This does not
  claim that completed changes were rolled back.
- **D-08:** If `appendEntry` fails, make one attempt to emit `internal-error`.
  If that delivery also fails, contain it, stop emitting, and use the existing
  opt-in debug logger. Let the command return. Do not retry the operation or
  roll back completed changes. Payload delivery cannot be guaranteed when the
  sink fails. This is an explicit user-accepted limit on the delivery contract.
  Do not recurse through the error-reporting path or add another output sink.

### Carried constraints

- **D-09:** Every payload carries `severity`, `needsReload`, and origin.
  Origin distinguishes command, load, and hook output. Command origin carries
  the machine command ID. Mint one invocation ID with an injectable generator
  per command run. Different runs receive different IDs. Load and hook output
  remain separate from command outcomes, even when their timing overlaps.
- **D-10:** Emit all command payloads before the command promise settles.
  Resolve and redact failure causes before formatting. Keep both strategies
  as format-only peers, preserve text bytes and argument counts, and retain
  Phase 5's emit-time mode selection and lifecycle containment.

### the agent's Discretion

Internal type names, file placement within existing architecture boundaries,
generator implementation, and task decomposition follow project conventions.
Do not add unused transitional fields or exports. Use the existing schema and
cause-chain serialization mechanisms. No additional product behavior was
delegated during discussion.

</decisions>

<canonical_refs>
## Canonical References

Downstream agents must read these before planning or implementing.

- `.planning/ROADMAP.md`, Phase 6: goal and success criteria.
- `.planning/REQUIREMENTS.md`: WIRE-02, WIRE-07, JOUT-03, JOUT-04 and constraints.
- `.planning/PROJECT.md`: current milestone and accepted output-channel policy.
- `.planning/research/SUMMARY.md`: locked milestone decisions D1-D8.
- `.planning/research/FEATURES.md`: TS-16 origin sketch and consumer verdict.
  The active requirements supersede its old deferral of invocation IDs.
- `.planning/research/ARCHITECTURE.md`: notification paths and timing.
- `.planning/phases/05-mode-selected-json-sink/05-CONTEXT.md`: run ownership,
  mode selection, output containment, and unchanged corpus contract.
- `.planning/phases/04-wire-schema-and-json-strategy/04-CONTEXT.md`: schema,
  redaction, and disclosure rules.
- `.planning/phases/03-typed-raw-surfaces/03-CONTEXT.md`: raw kinds and origins.
- `docs/output-catalog.md`: existing text contract.
- `skills/local-verification/SKILL.md`: commit checks and combined-tree gates.
- `skills/claude-code-compat-research/SKILL.md`: scope assessment rules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/shared/notification-run.ts`: explicit run,
  one soft-dependency snapshot, and original entry sink.
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`: sole
  appendEntry caller and mode-selected text/JSON delivery.
- `extensions/pi-claude-marketplace/shared/notification-wire.ts`: typebox schema.
- `extensions/pi-claude-marketplace/shared/notification-resolve.ts` and
  `extensions/pi-claude-marketplace/shared/errors.ts`: resolved causes.
- `extensions/pi-claude-marketplace/shared/debug-log.ts`: opt-in logging.

### Established Patterns

The router maps aliases onto handlers. The root creates a NotificationRun and
nested operations reuse it. Raw hook and load surfaces already have distinct
entry functions. Diagnostics need caller context because commands and loading
both emit them. Empty diagnostic lists and empty hook summaries are no-ops.

### Integration Points

- `extensions/pi-claude-marketplace/edge/register.ts`: command root and run.
- `extensions/pi-claude-marketplace/edge/router.ts`: canonical command selection.
- `extensions/pi-claude-marketplace/index.ts`: load roots.
- `extensions/pi-claude-marketplace/bridges/hooks/`: hook callback roots.
- Existing owner tests and JSON capture support: correlation, completion,
  redaction, invalid commands, missing outcomes, and delivery failures.

</code_context>

<specifics>
## Specific Ideas

The user accepted all proposed identity rules. The outcome contract is stricter
than merely counting emitted entries: a prompt or diagnostic cannot mask a
missing result. The final error preserves known reload needs after partial work.

Research consulted on 2026-10-09 included OpenTelemetry RPC naming conventions
and the JSON-RPC 2.0 response specification. These are supporting analogies,
not Pi or Claude Code requirements. No dependency or telemetry is introduced.

</specifics>

<deferred>
## Deferred Ideas

None. Phase 7 documentation must describe the accepted sink-failure delivery
limit and avoid implying that an internal error undoes earlier changes.

</deferred>
