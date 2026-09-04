---
phase: 116-edge-surface
plan: "00"
subsystem: test-support
tags: [test-helper, notification-boundary, strong-mock, il-2]
status: complete
requires: []
provides:
  - "createNotificationBoundary(emissions, toolProbes, cwd?) typed for the edge tier"
affects:
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
tech-stack:
  added: []
  patterns:
    - "A zero count states no strong-mock expectation at all, because times(0) is inert"
key-files:
  created: []
  modified:
    - tests/helpers/notification-boundary.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/pending.test.ts
decisions:
  - "strong-mock times(0) permits unlimited calls and verifies clean, so the boundary omits the expectation entirely when a count is 0"
  - "The call-site substitution was committed before the required-parameter change, so both commits pass the whole-repo typecheck the pre-commit hook runs"
metrics:
  duration: "~35 min"
  completed: 2026-09-02
actuals:
  tokens: 13000
  tasks: 2
  commits: 3
---

# Phase 116 Plan 00: Edge-Tier Notification Boundary Summary

`createNotificationBoundary` now returns an `ExtensionCommandContext`, requires an explicit
`toolProbes` count, accepts an optional stated `cwd`, and — a defect the mandated plant
uncovered — actually forbids what a zero count claims to forbid.

## What was built

`tests/helpers/notification-boundary.ts` changed in three planned ways and one unplanned way.

**Command-context typing.** The context mock is built as `mock<ExtensionCommandContext>` and
`NotificationBoundary.ctx` is declared `ExtensionCommandContext`. Because that interface extends
`ExtensionContext`, this is a widening: the typecheck run immediately after the change produced
exactly 92 errors, all `TS2554` (wrong argument count), and zero assignability errors. No existing
consumer needed a change to keep compiling, and no owner in this phase needs a double assertion
through `unknown` to build a command context.

**Required `toolProbes`.** The `= emissions * 2` default is gone. `notify()` runs one
soft-dependency probe per emission and each probe reads `pi.getAllTools()` twice, but
`notifyUsageError` writes straight to `ctx.ui.notify` and never probes. A usage-error case
inheriting the old default failed `verifyBoundary()` naming an unmet `getAllTools()` expectation
that said nothing about the case's real mistake.

**Optional stated `cwd`.** A third parameter `cwd?: { readonly value: string; readonly reads: number }`,
with no default on `reads`. Supplied, it states `ctx.cwd` with an exact `times()`; omitted, it
states nothing.

**Unplanned: a zero count now forbids.** See Deviations.

## Call-site inventory

Confirmed before editing with `grep -roh 'createNotificationBoundary([^)]*)' tests/ | sort | uniq -c`.

| Form before | Count | Form after | Note |
| --- | --- | --- | --- |
| `createNotificationBoundary(0)` | 6 | `(0, 0)` | substituted |
| `createNotificationBoundary(1)` | 80 | `(1, 2)` | substituted |
| `createNotificationBoundary(2)` | 5 | `(2, 4)` | substituted |
| `createNotificationBoundary(3)` | 1 | `(3, 6)` | substituted |
| `createNotificationBoundary(1, 0)` | 2 | unchanged | already explicit |
| `createNotificationBoundary(2, 2)` | 3 | unchanged | already explicit |

97 sites total, 92 substituted, 5 left alone — matching the plan's stated counts exactly. No site
needed a corrected count: the full suite passed at the same 4832 with the mechanical substitution
alone, so every substituted literal was the value that site already relied on.

`grep -rn 'createNotificationBoundary([0-9]*)' tests/` now returns nothing (exit 1).

Consumers were re-confirmed with `grep -rl createNotificationBoundary tests/` before and after: the
same four suites plus the helper. No fifth consumer had appeared since the plan was written.

## Plants

### Plant 1 — non-degenerate over-emission (the plant the plan owed)

`tests/orchestrators/reconcile/pending.test.ts:252`, `createNotificationBoundary(2, 4)` lowered to
`(1, 4)` on a case whose path emits twice. **RED**, verbatim:

```
✖ DIFF-01 / NFR-5: a repeated invocation emits the same notification and leaves both scope roots byte-identical (31.210502ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/shared/notify.ts:3658:12)
      at emitCascadeWith (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/shared/notify.ts:3850:3)
      at emitContextCascade (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/shared/notify.ts:3869:3)
      at notifyWithContext (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/shared/notify-context.ts:174:3)
      at pendingReconcile (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:267:3)
```

Reverted with `git checkout --`; the suite returned to 18/18.

### Plant 2 — degenerate over-emission, which stayed GREEN (a finding)

`tests/orchestrators/reconcile/pending.test.ts:162`, `createNotificationBoundary(1, 2)` lowered to
`(0, 2)` on a case that emits once and asserts the emission. Expected RED. **Observed: 18 passed,
0 failed** — and the assertion `assert.deepStrictEqual(notifications, [...])` still saw the
notification, so the emission both happened and was recorded while the boundary claimed none was
allowed.

Root cause, isolated in a disposable probe outside the suite: `strong-mock` treats
`.times(0)` as *no limit*, not as a ban. It installs the stub, serves every call, and `verify()`
reports clean. The helper's own doc comment asserted the opposite — "`emissions` of 0 states that
nothing may be emitted at all" — and 6 `(0, 0)` and 2 `(1, 0)` call sites rested on that claim.

Per D-116-04 this was treated as a finding, not a formality. See Deviations for the fix.

### Plant 2, re-run against the fixed helper

Same edit, same case. **RED**, verbatim:

```
✖ DIFF-01: reports the zero-action advisory when neither scope has pending work (21.561322ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/shared/notify.ts:3658:12)
      at dispatchInfoMessage (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/shared/notify.ts:3723:3)
      at notify (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/shared/notify.ts:3752:5)
      at pendingReconcile (file:///home/acolomba/pi-claude-marketplace-unit-test-refactor/extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:215:5)
```

Reverted; `git status --short -- tests/` clean; suite back to 18/18.

### `cwd` negative control (disposable, not shipped)

No committed consumer reads `ctx.cwd` yet, so the new parameter was exercised by a throwaway probe
under `tests/tmp-probe/`, run and then deleted. Measured behavior:

- A read within the stated `reads` serves the value.
- A read beyond `reads`, or a read when `cwd` was omitted, returns strong-mock's pending-call proxy
  **function** rather than throwing at the read. A handler forwarding it into path joining then dies
  with `The "path" argument must be of type string. Received function` — loud, but downstream of the
  mock. This is the failure mode the phase research already documented.
- An **unstated** read (fewer reads than promised) is caught cleanly by `verifyBoundary()`:
  `There are unmet expectations:`.

Recording this honestly: `cwd` gives an exact under-read proof through `verify()`, and an over-read
or unstated read surfaces as a downstream type failure rather than a named mock rejection.

## Verification

Every gate run separately, exit code captured without a pipe (a piped `$?` reports `tail`, not the
command). `npm run check` was not used — its `format:check` link fails on pre-existing untracked
operator files and short-circuits before the tests.

| Gate | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | clean |
| `npm run fallow` | 0 | clean |
| `npm test` | 0 | 4832/4832 across 274 suites |
| `npm run test:integration` | 0 | 31/31 |
| `npm exec -- prettier --check <5 paths>` | 0 | clean |
| `git diff --quiet -- extensions/` | 0 | no production change |

Unit count is **4832 across 274 suites**, identical to the phase-start baseline measured before any
edit. No difference to explain.

Backstop truth: `grep -rnE 'parseInt|parseFloat|Number\(|toFixed|Math\.(round|floor|ceil)'
extensions/pi-claude-marketplace/edge/` returns zero matches (exit 1). No edge-tier module performs
arithmetic, numeric parsing, rounding, or overflow-capable work.

Commit hygiene: filesystem trufflehog scan per commit, confirmed non-zero (`chunks: 1, bytes: 4191`;
`chunks: 24, bytes: 277462`; `chunks: 1, bytes: 4745`), `verified_secrets: 0` and
`unverified_secrets: 0` throughout. `SKIP=trufflehog,npm-format-check pre-commit run --files <paths>`
exited 0 before each commit. Only the five planned paths were staged; `git status --short` after each
commit confirmed the operator's unrelated modified and untracked files were untouched.

## Deviations from Plan

### 1. [Rule 3 — Blocking] Task order inverted so both commits pass the hooks

- **Found during:** Task 1
- **Issue:** Making `toolProbes` required breaks its 92 callers by construction. Task 1's own
  acceptance criteria demand `npm run typecheck` exit 0, which is impossible with the helper change
  alone. Worse, `pre-commit` runs a whole-repo `npm typecheck`, so a helper-first commit could not
  pass the hooks at all — and the hooks may not be skipped.
- **Fix:** Landed Task 2's mechanical call-site substitution first. Passing two arguments is already
  legal under the old `toolProbes = emissions * 2` signature, so that commit is green on its own.
  The required-parameter change followed and is green because every caller already passes a count.
  No task content changed; only commit order.
- **Commits:** `c0a69fdd` then `66e11dac`

### 2. [Rule 1 — Bug] A zero count in the boundary forbade nothing

- **Found during:** Task 2, by the mandated plant
- **Issue:** `strong-mock`'s `.times(0)` is inert. The boundary stated `ctx.ui`, `ui.notify`,
  `pi.getAllTools()`, and `ctx.cwd` with `times(count)` unconditionally, so any count of 0 installed
  a stub that served unlimited calls and verified clean. Every zero claim in the helper was vacuous,
  including the 6 `(0, 0)` and 2 `(1, 0)` sites already committed. Left alone this would have voided
  the D-116-06 "the orchestrator never ran" proofs that roughly twenty later plans in this phase are
  built on — exactly threat T-116-00-B.
- **Fix:** State no expectation at all when a count is 0. The mock then serves its pending-call
  proxy, and the first unwanted emission, probe, or `cwd` read fails where it happens. Confirmed by
  re-running the plant, which now goes RED.
- **Scope check:** The plan says change three things "and nothing else". This is a fourth change,
  taken under D-116-04's standing instruction that a GREEN plant is a finding to act on, never to
  paper over. The alternative — narrowing the doc claim — would have shipped a boundary whose zeros
  prove nothing to twenty dependent plans.
- **Blast radius:** none. Sizing is unchanged at every call site; the full unit suite stayed at
  4832/4832 and integration at 31/31, which also confirms the 8 pre-existing zero-count sites
  genuinely emit and probe nothing. Their claims are now real rather than vacuous.
- **Files modified:** `tests/helpers/notification-boundary.ts`
- **Commit:** `af7c501f`

## Known Stubs

None.

## Threat Flags

None. This plan writes only under `tests/` and crosses no trust boundary.

## Self-Check: PASSED

- `tests/helpers/notification-boundary.ts` — FOUND
- `tests/orchestrators/import/execute.test.ts` — FOUND
- `tests/orchestrators/plugin/bootstrap.test.ts` — FOUND
- `tests/orchestrators/reconcile/apply.test.ts` — FOUND
- `tests/orchestrators/reconcile/pending.test.ts` — FOUND
- Commit `c0a69fdd` — FOUND
- Commit `66e11dac` — FOUND
- Commit `af7c501f` — FOUND
