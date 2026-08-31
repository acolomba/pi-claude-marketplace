# Phase 112: Hook Runtime - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver compliant mirrored owner tests for the 31 hook-runtime modules under
`bridges/hooks`. Each pair must reach 100 percent direct function, line, and branch
coverage while preserving public payload translation, matcher evaluation, routing order,
decision control, subprocess execution, stream handling, timeout escalation, async-rewake,
session lifecycle, environment, persistence, barrel, and type-only contracts. This phase
does not redesign hook behavior or widen production APIs for tests.

</domain>

<decisions>
## Implementation Decisions

### Milestone test contract carried forward

- **D-01:** Normalize and re-prove all 31 owners, including accepted-HEAD `PASS` tests.
  Baseline triage is input, not completion evidence.
- **D-02:** Every runtime case uses separate lowercase `// arrange`, `// act`, and
  `// assert` phases with the canonical blank lines. Lowercase `// act & assert` is
  limited to one `assert.throws()` or `assert.rejects()` expression. Data rows use
  separate phases.
- **D-03:** Type-only evidence stays at module scope through positive `satisfies` checks
  and targeted negative `@ts-expect-error` checks. Barrel owners prove intended public
  bindings without widening the production surface.
- **D-04:** Each case constructs complete, case-local inputs and independently authored
  complete expectations. Small concern-local factories may return fresh setup values but
  must not become shared scenario oracles.
- **D-05:** Each case owns and restores its filesystem, environment, process, session,
  router, registry, mock, stream, and timer state. Production modules gain no test-only
  exports, reset hooks, state readers, or test modes.
- **D-06:** Retain supplemental hook suites only for genuine cross-module proof. Absorb
  and remove cases that duplicate one mirrored owner's behavior. — **Reversibility:**
  costly — Restoring duplicated suites would weaken the milestone's one-source-to-one-owner
  structure and create competing contract authorities.

### Subprocess fidelity

- **D-07:** Use injected process doubles for controllable event sequences and a real
  subprocess only at the operating-system spawn boundary. Any real child is a small,
  portable `process.execPath` program in the owning direct test when the default spawn arm
  needs proof.
- **D-08:** Cover every behaviorally distinct child ordering that changes the result:
  normal close, spawn error, exit before pipe close, interleaved output, and relevant late
  terminal events. Do not enumerate orderings that are observably equivalent.
- **D-09:** Assert the complete subprocess boundary and outcome: command, arguments,
  shell, cwd, environment, stdin, returned result, signals, listener removal, timer
  cancellation, and cleanup.
- **D-10:** Stream proof is behaviorally complete at byte boundaries but not
  combinatorially exhaustive. Cover empty and zero-capacity input, exact limits,
  one-byte overflow, multiple chunks, wraparound, oversized chunks, independent stdout
  and stderr, UTF-8 sequences split across chunks, decoder flush, and overflow cleanup.
  Preserve order within each stream; do not invent a total ordering between stdout and
  stderr that Node does not guarantee.
- **D-11:** Assert the full stdin delivery and failure contract: exact serialized bytes,
  error-listener registration before `end`, normal delivery, EPIPE/error diagnostics,
  absent optional stdin in the async lane, and synchronous `end` failure containment.
- **D-12:** Use real Node `PassThrough` streams inside process doubles for buffering,
  UTF-8, `end`, and listener behavior. Use small custom emitters only for event orderings
  that real streams cannot stage.
- **D-13:** Subprocess diagnostics are asserted by contract-bearing meaning: failure
  category, plugin/event context, relevant stderr or error text, and destination. Do not
  freeze incidental punctuation or complete debug-log wording.

### Timer schedules

- **D-14:** Scheduling cases use the current `node:test` context's fake timers. Advance
  to just before and exactly at the SIGTERM deadline, then just before and exactly at the
  five-second SIGKILL deadline; prove cancellation suppresses both signals.
- **D-15:** Cover every timeout decision partition: configured positive and fractional
  values, zero, negative, non-numeric and non-finite inputs, event-specific blocking
  defaults, the background default, the maximum representable delay, and above-maximum
  clamping.
- **D-16:** Cover every distinct exit/cancellation race state: cancellation before either
  deadline, prior exit at SIGTERM time, exit between SIGTERM and SIGKILL, exit by code,
  exit by signal, repeated cancellation, and late callbacks against a finished child.
- **D-17:** Assert the complete timer lifecycle: two case-owned timers at exact delays,
  both unreferenced, exact handles cleared, idempotent cancellation, and no timers left
  after settlement.

### Runtime-state isolation

- **D-18:** Obtain clean state through existing production lifecycle APIs before and
  after each case. Each case owns every inserted entry and verifies cleanup; do not use
  module-cache reloads, hidden state readers, or new test-only seams.
- **D-19:** Cover behaviorally distinct registry interleavings without exhaustively
  permuting schedules: multiple live children within one scope and across scopes, one
  child settling while another remains, persistence snapshots during registration and
  removal, and reload shutdown without cross-entry deletion.
- **D-20:** Prefer injected probes for process-wide inputs. When mutation is unavoidable,
  capture exact property existence and value, register case-local restoration before
  acting, and serialize only cases that truly touch shared process state.
- **D-21:** Test PID-table persistence with fresh case-owned temporary roots, including
  atomic write/read/unlink, malformed and stale files, and scope separation. Use narrow
  existing doubles only for hard-to-stage I/O failures; add no production test seam.

### Payload and wire exactness

- **D-22:** Each translator owner deep-asserts its complete explicit envelope. Optional
  fields must be genuinely absent rather than present with `undefined`; unexpected keys
  are rejected; nested Pi input and output values pass through unchanged.
- **D-23:** Direct translator cases stay within their typed input contracts. Malformed
  values are tested where `dispatch-exec` accepts `unknown`: null, non-object, missing
  required fields, and wrong-shape containment, including diagnostics and the public
  never-throws outcome. Do not fuzz every translator with impossible values.
- **D-24:** Wire-protocol tests cover every decision and precedence partition with
  targeted conflicts: exit-code precedence, empty and malformed JSON, top-level stop
  before block, top-level decisions before nested output, nested deny before mutation,
  mutation before `suppressOutput`, wrong-type omission, and final noop fallback.
- **D-25:** Serialization tests cover the complete UTF-8 boundary contract: exact cap,
  one byte over, multibyte byte counting, top-level `_truncated: true` precedence over an
  input field of the same name, defensive wrapping of oversized non-object values,
  permitted marker overshoot, and no mutation of the source payload.

### the agent's Discretion

- Choose the exact case names, row grouping, and order within each owner while preserving
  independent cases and every locked behavior partition above.
- Choose the smallest custom child/stream emitter needed for an ordering that
  `PassThrough` cannot express.
- Choose the narrow mechanism for hard-to-stage PID-table I/O failures, provided it uses
  an existing production boundary and restores all changed state.
- Choose which existing architecture and integration cases provide genuine cross-module
  proof, and document the distinct contract for every retained supplemental case.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and acceptance

- `.planning/ROADMAP.md` — Phase 112 boundary, all 31 source-test pairs, success criteria,
  dependency, and execution order.
- `.planning/REQUIREMENTS.md` — `MOD-05` plus case structure, assertions, doubles, direct
  coverage, production-design, pair-atomic delivery, preservation, and suite-quality
  requirements.
- `.planning/PROJECT.md` — v1.19 intent and locked `D-UTR-10` through `D-UTR-12`
  decisions for complete local proof, preserved public surfaces, lowercase phases, and no
  test-only production surface.

### Unit-testing contract

- `.claude/rules/typescript-unit-testing.md` — executable rules for lowercase phases,
  independent expectations, role-correct doubles, direct coverage, test-context timers,
  hermetic process state, filesystem ownership, type-only modules, and barrels.
- `docs/guidelines/typescript-unit-testing-guidelines.md` — normative rationale and full
  TypeScript examples for the same contract.

### Hook compatibility and public surfaces

- `docs/hooks-compatibility.md` — supported hook events and the bridge's compatibility
  boundary.
- `docs/env-vars.md` — hook environment variables, session paths, and delivery behavior.
- `docs/research/claude-hook-config-syntax.md` — authoritative Claude hook input/output,
  decision, timeout, and command syntax used by payload and wire cases.
- `docs/research/claude-hooks-vs-pi-events.md` — event mapping and semantic differences
  between Claude hooks and Pi events.
- `docs/research/issue-103-stop-stopfailure-promotion.md` — Stop and StopFailure routing,
  settlement, and re-entry decisions.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `SpawnDeps.spawnImpl` in synchronous dispatch and async-rewake registration is the real
  production dependency seam for controlled child-process doubles.
- `planSpawn()` and `serializeWithTruncation()` centralize exec-form versus shell-form
  planning and the 256 KiB UTF-8 stdin contract for both execution lanes.
- `installTimerLadder()` exposes the production SIGTERM-to-SIGKILL lifecycle through its
  structural `ChildLike` port and idempotent `TimerLadder.cancel()` handle.
- `routing-state.ts` already exposes production accessors and lifecycle mutators for
  parsed config, routing buckets, epoch, and pending SessionStart context; its composite
  reset is an existing production-facing testable boundary, not a reason to add a new
  seam.
- `pid-table.ts` exposes path, read, write, and unlink operations suitable for real
  temporary-root owner cases; `registry.ts` already accepts orphan probes for safe PID
  liveness, marker, and kill behavior.
- Each module under `payloads/` exposes one typed `translate()` function, while
  `TranslationContext` provides the shared session, transcript, and cwd snapshot.
- `parseHookStdout()` is a pure public parser over exit code, stdout, and stderr and can
  express the complete wire decision matrix without spawning a child.

### Established Patterns

- Blocking dispatch and async rewake share translator tables, spawn planning, payload
  serialization, environment preparation, and the timer ladder but differ in settlement
  and persistence ownership.
- `dispatch-exec.ts` decodes stdout/stderr through `StringDecoder`, enforces independent
  byte caps, detaches listeners on overflow, and replaces the normal timer ladder with an
  immediate escalation ladder.
- `RingBuffer` stores raw bytes, drops the oldest bytes on overflow, latches truncation,
  and returns chronological tail content across wraparound.
- Bridge registration bumps an epoch, clears pending session and settle state, shuts down
  live async children, then reaps persisted Linux-marked orphans before registering new
  event handlers.
- Wire parsing is permissive and never throws: unsupported, malformed, or mistyped shapes
  become noop after stable diagnostic behavior where applicable.

### Integration Points

- `event-router.ts` owns bridge registration, hydration, reload hygiene, orphan reaping,
  and registration of the composite dispatch and settle handlers.
- `dispatch.ts`, `event-adapters.ts`, and `settle.ts` combine matcher, `if` predicate,
  decision reduction, event adaptation, epoch guarding, Stop behavior, and re-entry caps.
- `dispatch-exec.ts`, `hook-env.ts`, `spawn-helpers.ts`, `exec-timer.ts`, and `timeout.ts`
  form the blocking subprocess boundary; `async-rewake/registry.ts`, `pid-table.ts`, and
  `ring-buffer.ts` extend it with background lifecycle and persistence.
- Existing `tests/architecture/hooks-*.test.ts` suites contain migration evidence and
  candidate cross-module contracts. They are not substitutes for the 31 direct owners.

</code_context>

<specifics>
## Specific Ideas

- Use a portable `process.execPath` child only where the real default spawn implementation
  is itself the public boundary under test.
- Use `PassThrough` streams for realistic chunking and UTF-8 decoding, with custom
  emitters reserved for otherwise unstageable event orderings.
- Express timer cases by ticking to one millisecond before and exactly at each deadline;
  never wait for wall-clock time.
- Use `Object.hasOwn()` or complete key comparisons when absence versus `undefined` is the
  payload contract.
- Preserve the exact lowercase runtime comments everywhere: `// arrange`, `// act`, and
  `// assert`; use lowercase `// act & assert` only for one throwing or rejection
  expression.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 112-Hook Runtime_
_Context gathered: 2026-08-30_
