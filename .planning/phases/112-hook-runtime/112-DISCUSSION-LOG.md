# Phase 112: Hook Runtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-30
**Phase:** 112-Hook Runtime
**Areas discussed:** Subprocess fidelity, timer schedules, runtime-state isolation, payload and wire exactness

---

The user requested a complete restart after an earlier interactive prompt sequence became
unclear. All earlier partial answers were discarded. The selections below are from the
restarted discussion only.

## Subprocess fidelity

The user asked why subprocesses were in scope. The bridge runs configured hook commands as
child processes, so command planning, stdin/stdout/stderr, exit events, signals, and cleanup
are public hook-runtime behavior owned by this phase.

### Authoritative subprocess proof

| Option                       | Description                                                                                           | Selected |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| Hybrid structural proof      | Inject process doubles for controlled sequences and use a real process only at the OS spawn boundary. | ✓        |
| Process doubles only         | Prove all behavior through injected children without a real spawn.                                    |          |
| Real subprocesses throughout | Exercise most subprocess cases with real operating-system children.                                   |          |
| Something else               | Supply another proof strategy.                                                                        |          |

**User's choice:** Hybrid structural proof.

### Child-event orderings

| Option                               | Description                                                                                                    | Selected |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------- |
| Every behaviorally distinct ordering | Cover normal close, spawn error, exit before pipe close, interleaved output, and outcome-changing late events. | ✓        |
| Common event orderings               | Cover normal completion plus a small failure sample.                                                           |          |
| Normal completion only               | Assert the usual data-to-close sequence.                                                                       |          |
| Something else                       | Supply another ordering policy.                                                                                |          |

**User's choice:** Every behaviorally distinct ordering.

### Location of real subprocess proof

| Option                            | Description                                                                            | Selected |
| --------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| Owning direct test when necessary | Use a small portable `process.execPath` child only when proving the default spawn arm. | ✓        |
| Supplemental architecture suite   | Keep the real process proof outside the mirrored owner.                                |          |
| No real subprocess proof          | Rely entirely on structural process doubles.                                           |          |
| Something else                    | Supply another location.                                                               |          |

**User's choice:** Owning direct test when necessary.

### Subprocess assertion completeness

| Option                        | Description                                                                 | Selected |
| ----------------------------- | --------------------------------------------------------------------------- | -------- |
| Complete boundary and outcome | Assert command, args, shell, cwd, env, stdin, result, signals, and cleanup. | ✓        |
| Key spawn fields and result   | Assert selected spawn options and the returned outcome.                     |          |
| Result only                   | Assert only the public execution result.                                    |          |
| Something else                | Supply another assertion boundary.                                          |          |

**User's choice:** Complete boundary and outcome.

### Stream handling depth

| Option                                | Description                                                                                                                           | Selected |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Behaviorally complete byte boundaries | Cover every distinct byte, cap, wrap, UTF-8, stream-separation, overflow, and cleanup boundary without exhaustive chunk permutations. | ✓        |
| Text chunks only                      | Cover multiple ordinary string chunks and limits, not raw-byte boundaries.                                                            |          |
| Final output only                     | Assert only completed stdout and stderr.                                                                                              |          |
| Something else                        | Supply another stream policy.                                                                                                         |          |

**User's choice:** Behaviorally complete byte boundaries.

**Notes:** Preserve each stream's ordering but do not assert a global stdout/stderr order
that Node does not guarantee.

### Child stdin delivery

| Option                             | Description                                                                                                                                            | Selected |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Full delivery and failure contract | Assert exact bytes, listener-before-end ordering, normal completion, EPIPE/error handling, absent optional stdin, and synchronous failure containment. | ✓        |
| Common failures only               | Assert exact payload, normal completion, and one EPIPE case.                                                                                           |          |
| Successful delivery only           | Assert only the value passed to `stdin.end`.                                                                                                           |          |
| Something else                     | Supply another stdin policy.                                                                                                                           |          |

**User's choice:** Full delivery and failure contract.

### Stream doubles

| Option                                   | Description                                                                                                             | Selected |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| Real Node streams inside process doubles | Use `PassThrough` for buffering, UTF-8, end, and listeners; reserve custom emitters for otherwise impossible orderings. | ✓        |
| Custom stream doubles                    | Model every stream event manually.                                                                                      |          |
| Simple emitters only                     | Emit basic data and end events without real stream behavior.                                                            |          |
| Something else                           | Supply another double design.                                                                                           |          |

**User's choice:** Real Node streams inside process doubles.

### Subprocess diagnostics

| Option                      | Description                                                                                   | Selected |
| --------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| Contract fields and meaning | Assert category, context, relevant text, and destination without freezing incidental wording. | ✓        |
| Exact diagnostic strings    | Match every diagnostic byte-for-byte.                                                         |          |
| Presence only               | Assert only that a diagnostic occurred.                                                       |          |
| Something else              | Supply another strictness level.                                                              |          |

**User's choice:** Contract fields and meaning.

---

## Timer schedules

### Timing boundaries

| Option                    | Description                                                                                                           | Selected |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| Every behavioral boundary | Tick just before and exactly at SIGTERM, then just before and exactly at SIGKILL; prove cancellation suppresses both. | ✓        |
| Callback deadlines only   | Tick directly to the two deadlines.                                                                                   |          |
| Final outcome only        | Tick beyond both deadlines and assert final signals.                                                                  |          |
| Something else            | Supply another timing depth.                                                                                          |          |

**User's choice:** Every behavioral boundary.

### Timeout-value coverage

| Option                   | Description                                                                                                               | Selected |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| Every decision partition | Cover configured, fractional, invalid, defaulted, maximum, and clamped values for both lanes and event-specific defaults. | ✓        |
| Representative values    | Cover one configured, invalid, defaulted, and clamped value.                                                              |          |
| Happy path and default   | Cover a normal configured timeout and an omitted timeout.                                                                 |          |
| Something else           | Supply another value matrix.                                                                                              |          |

**User's choice:** Every decision partition.

### Exit and cancellation races

| Option                    | Description                                                                                                        | Selected |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| Every distinct race state | Cover cancellation, prior exit, exit between signals, code/signal exit, repeated cancellation, and late callbacks. | ✓        |
| Main race states          | Cover cancellation, exit before SIGTERM, and exit after SIGTERM.                                                   |          |
| Cancellation only         | Prove normal completion clears timers.                                                                             |          |
| Something else            | Supply another race matrix.                                                                                        |          |

**User's choice:** Every distinct race state.

### Timer resource ownership

| Option                       | Description                                                                                           | Selected |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| Complete scheduler lifecycle | Assert exact delays and handles, `unref`, clearing, idempotent cancellation, and no remaining timers. | ✓        |
| Scheduling and cleanup       | Assert delays and cancellation without checking `unref` or each handle.                               |          |
| Signals only                 | Assert only signal timing.                                                                            |          |
| Something else               | Supply another lifecycle depth.                                                                       |          |

**User's choice:** Complete scheduler lifecycle.

---

## Runtime-state isolation

### Clean-state mechanism

| Option                             | Description                                                                                                        | Selected |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| Production lifecycle APIs per case | Use existing lifecycle operations before and after each case; own and verify all inserted state; add no test seam. | ✓        |
| Fresh module instance per case     | Recreate state through dynamic import or module-cache isolation.                                                   |          |
| Suite-level reset                  | Reset once and share state across related cases.                                                                   |          |
| Something else                     | Supply another isolation mechanism.                                                                                |          |

**User's choice:** Production lifecycle APIs per case.

### Concurrent registry state

| Option                              | Description                                                                                                                  | Selected |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| Behaviorally distinct interleavings | Cover multiple children/scopes, partial settlement, persistence snapshots, and reload shutdown without exhaustive schedules. | ✓        |
| Sequential multi-entry state        | Cover several entries in one fixed settlement order.                                                                         |          |
| Single-entry state only             | Exercise one live registry entry at a time.                                                                                  |          |
| Something else                      | Supply another concurrency depth.                                                                                            |          |

**User's choice:** Behaviorally distinct interleavings.

### Process-wide inputs

| Option                       | Description                                                                                   | Selected |
| ---------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| Exact case-owned restoration | Prefer probes; otherwise preserve exact property existence/value and restore inside the case. | ✓        |
| Suite-level restoration      | Share mutations across cases and restore after the suite.                                     |          |
| Runner isolation             | Depend on test files or workers for separation.                                               |          |
| Something else               | Supply another process-state policy.                                                          |          |

**User's choice:** Exact case-owned restoration.

### Persisted PID-table state

| Option                                             | Description                                                                                        | Selected |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| Real temporary roots plus targeted failure doubles | Use case-owned real files for persistence semantics and narrow existing doubles for hard failures. | ✓        |
| Filesystem doubles only                            | Mock every PID-table filesystem operation.                                                         |          |
| Happy-path temporary files                         | Use real files only for successful round trips.                                                    |          |
| Something else                                     | Supply another persistence proof.                                                                  |          |

**User's choice:** Real temporary roots plus targeted failure doubles.

---

## Payload and wire exactness

### Translator output assertions

| Option                                  | Description                                                                             | Selected |
| --------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Complete explicit envelope              | Deep-assert all fields, true omission, no unexpected keys, and unchanged nested values. | ✓        |
| Required fields plus selected optionals | Assert the common envelope and representative optional fields.                          |          |
| Snapshots                               | Use serialized snapshots as the primary contract.                                       |          |
| Something else                          | Supply another payload strictness.                                                      |          |

**User's choice:** Complete explicit envelope.

### Malformed Pi event shapes

| Option                       | Description                                                                                              | Selected |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| At the runtime boundary only | Keep translators typed; test malformed values at the `unknown` dispatch boundary and assert containment. | ✓        |
| Every translator defensively | Pass malformed values directly to every translator.                                                      |          |
| Typed inputs only            | Do not test malformed event shapes.                                                                      |          |
| Something else               | Supply another malformed-input policy.                                                                   |          |

**User's choice:** At the runtime boundary only.

### Wire-protocol precedence

| Option                                  | Description                                                                                                     | Selected |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Every decision and precedence partition | Cover exit codes, parse failures, top-level and nested conflicts, mutation, suppression, wrong types, and noop. | ✓        |
| Every recognized output shape           | Cover each output independently without conflicting fields.                                                     |          |
| Common outputs only                     | Cover mutation, block, and malformed JSON.                                                                      |          |
| Something else                          | Supply another parser matrix.                                                                                   |          |

**User's choice:** Every decision and precedence partition.

### Serialization and truncation

| Option                           | Description                                                                                                           | Selected |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| Complete UTF-8 boundary contract | Cover exact cap, one byte over, substantially oversized and multibyte values, marker precedence, bounded non-object wrapping, and immutability. | ✓        |
| Object boundary cases            | Cover exact cap, over-cap, and marker insertion for objects.                                                          |          |
| Oversized payload only           | Assert only that an oversized value gains the marker.                                                                 |          |
| Something else                   | Supply another serialization depth.                                                                                   |          |

**User's choice:** Complete UTF-8 boundary contract.

---

## the agent's Discretion

- Exact case names, row grouping, and ordering within each direct owner.
- The smallest custom emitter for orderings that real Node streams cannot stage.
- The narrow existing mechanism used to produce hard-to-stage PID-table I/O failures.
- Which supplemental architecture or integration cases prove a distinct cross-module
  contract and therefore remain.

## Deferred Ideas

None — discussion stayed within phase scope.
