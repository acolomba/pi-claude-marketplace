# Phase 5: Mode-Selected JSON Sink - Context

**Gathered:** 2026-10-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect every existing notification surface to Pi's mode-selected output:
`json` and `rpc` append `claude-plugin` session entries; `tui` and `print`
keep the existing text. Read `ctx.mode` at emission time. Reject unknown
modes before mutation and contain output failures at lifecycle boundaries.

Requirements: MODE-01, MODE-02, JOUT-01, JOUT-05, TENB-01, TENB-02.
All six Phase 5 success criteria in ROADMAP.md remain binding.

Origin, invocation IDs, command completion, and internal-error payloads belong
to Phase 6. Mode-specific browse and authentication refusals, real-Pi e2e,
and public documentation belong to Phase 7. The accepted startup streaming
gap has no timer workaround. This is Pi transport plumbing, with no new
Claude Code command behavior to research.

</domain>

<decisions>
## Implementation Decisions

### Lifecycle failure handling

The user accepted all three recommendations with "yes" on 2026-10-06.

- **D-05-01:** An unsupported mode during loading prevents mutations, but
  existing resources are still discovered through the read-only path. Do not
  abort discovery merely because output cannot be selected.
- **D-05-02:** Contain lifecycle output failures and continue independent
  cleanup and discovery. Ending the entire callback immediately is not the
  default. This does not authorize continuing mutations in an unsupported
  mode, rolling back completed work merely because delivery failed, or
  swallowing command-handler errors globally.
- **D-05-03:** Record these failures through the existing opt-in debug logger.
  With `PI_CLAUDE_MARKETPLACE_DEBUG` unset, logging remains silent. No new
  always-on error log is introduced.

### Existing decisions carried forward

- **D-05-04:** One exhaustive mode switch selects text or JSON at emit time;
  never cache the mode or strategy in the run. Validate a plain string with a
  membership check that raises `UnsupportedModeError` before state changes.
- **D-05-05:** Extend the existing per-invocation `NotificationRun` with the
  entry sink (Phase 1 D-06). Construct runs at command and lifecycle roots;
  nested operations reuse the parent run (Phase 1 D-07). Hook callbacks get
  their run when their first sink reader lands. Preserve the one soft-dep
  snapshot per command/load run, with no new per-emission probes.
- **D-05-06:** Only notification-dispatch calls `appendEntry`. Cover all
  structured and raw surfaces, including load warnings, device flow,
  diagnostics, async rewake, and Stop-cap warnings. JSON/RPC do not also
  notify. Preserve text's argument counts and empty diagnostic/rewake no-ops.
- **D-05-07:** Keep schema validation in the test capture helper, not in the
  production converter. Every captured entry validates. All context fakes
  carry an explicit, required mode; do not hide a missing mode behind casts.
- **D-05-08:** Preserve the text corpus and catalog. The Phase 4 close baseline
  is 3149 corpus entries, zero extras; the catalog includes already-merged
  main's citation correction. Compare with `26cb0056`, not the superseded
  `4e6c568a` catalog base. No new corpus exception is approved here.

### the agent's Discretion

- Exact sink type, private helper names, and how raw helpers receive the run,
  within the existing explicit-root construction contract.
- Task boundaries and owner-test placement. Keep changes surgical and every
  intermediate wave verifiable; do not add unused transitional scaffolding.
- Prove the appendEntry lint restriction with a temporary planted violation
  and remove it. The current codebase conventions retired committed gate
  self-tests; do not restore the old copied-tree test harness just because an
  older phase plan mentions it.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `shared/notification-run.ts`: per-invocation soft-dependency snapshot.
- `shared/notification-dispatch.ts`: shared text sink and typed raw helpers.
- `shared/notification-present.ts`, `notification-json.ts`, and
  `notification-wire.ts`: presentation values, pure converter, and schema.
- `shared/debug-log.ts`: existing opt-in, tagged debug logging.
- `tests/edge/notification-boundary.ts` and catalog fixtures: existing output
  test boundaries; retain text assertions and add schema-valid JSON capture.

### Established Patterns

- `edge/register.ts` opens one run before command routing. `index.ts` opens
  the load-pass run inside an NFR-2 boundary.
- Raw helpers currently take only the notification context and typed data;
  they intentionally deferred sink plumbing until this phase.
- Load warnings already catch notify failures independently and use debug
  logging. Stop-cap output in `bridges/hooks/settle.ts` needs the corresponding
  containment when appendEntry can throw.
- Use current `skills/local-verification/SKILL.md`: hooks check staged build
  inputs, and each combined-wave/phase gate runs `npm run check`.

### Integration Points

- `platform/pi-api.ts`: local notification-context shape and upstream types.
- `edge/register.ts`, `edge/router.ts`, raw helper callers, and auth-host
  callback binding: command roots and dispatch.
- `index.ts`, hook async-rewake registry, and Stop settle: lifecycle roots and
  failure containment, including stale pi/ctx after reload.
- `eslint.config.js`: appendEntry ownership restriction, preserving existing
  file-scoped rules. Installed Pi declarations are the local API authority.

</code_context>

<specifics>
## Specific Ideas

The user approved preserving read-only discovery, continuing independent
lifecycle work after delivery failure, and using debug-only logging. All
other product behavior comes from the existing roadmap and prior contexts.
Research should trace mutation ordering before choosing the validation sites.

</specifics>

<deferred>
## Deferred Ideas

None. Phase 6 and Phase 7 responsibilities remain in their existing phases.

</deferred>
