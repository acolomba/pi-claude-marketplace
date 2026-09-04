---
phase: 116-edge-surface
plan: "14"
subsystem: testing
tags: [node-test, edge, plugin, handler-shim, injected-port, strong-mock, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-07's injected-port forwarding proof: `createGitOpsFake` driven through the real workflow, with the whole clone recorder compared after substituting a token for the `randomUUID()` staging leaf"
  - phase: 116-edge-surface
    provides: "116-17's measured correction that a port-forward proof pins the port's implementation, not the container object"
  - phase: 116-edge-surface
    provides: "116-12's and 116-26's owners for the shared marketplace opener and the unknown-long-flag rule, neither of which this handler reaches"
  - phase: 116-edge-surface
    provides: "116-23's owner for the plugin-tier argument helper, which this handler also does not reach — it parses raw arguments itself"
provides:
  - "tests/edge/handlers/plugin/bootstrap.test.ts — the sole mirrored direct owner for edge/handlers/plugin/bootstrap.ts, at branches 8/8, functions 2/2, lines 88/88"
  - "the measured finding that a RECORDER-based port-forward proof is weaker than 116-17's structural `when()` comparison: a re-boxed port AND a port with one member wrapped around a call back into the injected one both stay GREEN; only replacing the implementation goes RED"
  - "the measured finding that `plugin/bootstrap.ts` calls `parseArgs`, so it answers the arity question like `plugin/import.ts` and unlike every marketplace sibling: a surplus positional IS rejected and `--local` is an ordinary positional token"
  - "the measured guard order — a parse failure, then the positional guard, then the scope guard — pinned by driving a positional token alongside each of the later two rejections"
  - "the measured probing counts for the two `notify()` paths on this handler: the delegating path emits twice and probes four times, the failure conversion emits once and probes twice, and both read `ctx.cwd` exactly once"

affects: []

actuals:
  tokens: 18000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "A github-source workflow cannot be driven through a bare `createGitOpsFake`: the GitHub provider attaches a credential bundle whose functions are not structured-clonable, and the fake's recorder clones every call structurally, so it throws inside its own recorder before the workflow runs. The port drops that downstream-owned bundle and delegates every operation, the clone included, to the fake — every member is still the fake's own, so it is not a hand-rolled object of git functions"
    - "A delegating case can size the boundary at the workflow's exact emission count WITHOUT asserting the notification bodies its orchestrator pair already owns. An exact `times(2)` on `ctx.ui` and `ui.notify` fails on a third emission and fails at `verify()` on a second, which is the completeness proof; the bodies stay with the orchestrator owner"
    - "Guard order is pinned by driving an input that satisfies TWO guards at once and asserting which sentence appears: a positional token beside a scope flag proves the positional guard runs first, and a positional token beside an unrecognised scope value proves the parse failure runs before both"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/bootstrap.test.ts

key-decisions:
  - "The pair holds 100 percent direct coverage — `branches 8/8, functions 2/2, lines 88/88`. This pair is NOT a D-116-01a claimant: no unreachable branch was measured, so nothing is filed in `.planning/WINDOWS.md`. The `errorMessage(err)` call that would carry the usual compiler-forced residual arm lives in `shared/errors.ts`, not in this module"
  - "OBSERVATION — the branch DENOMINATOR moved from 11 to 8 while both readings are complete. Measured in both directions by restoring the HEAD suite and re-running the gate: the old suite reports `branches 11/11`, the rewrite reports `branches 8/8`, and lines stay at 88/88 in both. Nothing is uncovered in either reading, and 8 is exactly the structural count — four binary branches (the two try/catch pairs, the positional guard, the scope guard) times two sides. This is the 116-02 / 116-26 finding again: a branch pair is a property of the execution profile, not of the source, so it is recorded rather than pinned"
  - "The port forward sites were COUNTED before planting, per the 116-13 under-scoping finding and 116-07's comment-counting warning: `grep -n deps.gitOps` reports 2 hits, one of which is the module's own header comment, so there is exactly ONE real forward site (`bootstrap.ts:67`). One plant is therefore in scope"
  - "DEVIATION — the plan's `must_haves` truth 4 asks for 'the accepted positional arity, one below it, and one above it'. The accepted arity is ZERO positionals; there is no count below zero, so that half has no reachable target and no case asserts it. The 'one above' half, false for all six marketplace siblings, is TRUE here — this handler calls `parseArgs` and rejects a non-empty positional list itself"
  - "DEVIATION — the plan's `must_haves` truth 5 has two clauses and neither lands as written. The router-alias clause belongs to the router owner (116-29), not to a handler. The 'mutually exclusive scope flags supplied together are rejected' clause has no scope diagnostic to prove: this handler never reaches `extractLocalFlag`, so `--local` is an ordinary token that lands on `positional` and is rejected by the positional guard before the scope value is consulted. Written as that measured outcome, which doubles as the guard-order pin"
  - "DEVIATION — the plan asks the unrecognised-scope case to be driven 'by supplying no positional, so the ordering of the three guards is pinned rather than assumed'. That input cannot pin an ordering: with no positional token the positional guard never applies, so the case would pass whichever guard ran first. Written as a two-row table instead — the plan's row, plus a row that supplies a positional token so the parse failure is proven to win over the positional guard"
  - "DEVIATION — the delegating case does NOT assert the two notification bodies the workflow renders. The plan forbids re-deriving the workflow's outcome or its notification body, which `tests/orchestrators/plugin/bootstrap.test.ts` and the two composed orchestrator pairs already own. The exact `times(2)` boundary sizing carries the completeness claim instead"
  - "DEVIATION — the old suite's whitespace-only-argument case and its fixture-pointer case were dropped. The first restates the tokenizer behaviour owned by `tests/edge/args.test.ts`; the second asserts that a directory path string ends in its own last segment, which cannot fail. The clone fixture is now built inside the case rather than pointed at another concern's `_fixtures` tree"
  - "No production file was touched. Four plants were applied to `edge/handlers/plugin/bootstrap.ts` and each reverted from a byte-copy taken before the first. `git diff --quiet -- extensions/` exits 0, and the plan's pinned-path check over bootstrap.ts, all three handler `shared.ts` files, `flag-catalog.ts`, and `tests/helpers/notification-boundary.ts` exited 0 before staging"

patterns-established:
  - "A recorder-based port-forward proof and a structural exact-argument port expectation are NOT equivalent, and the difference is measurable. 116-17's `when()` comparison goes red on a wrapped member; a recorder stays green, because a wrapper that delegates back still lets the injected implementation perform the operation. State the claim at the strength the plant supports: 'the operation is carried out by the injected implementation', not 'the identical object was forwarded' and not 'the identical member was forwarded'"
  - "Pin a guard order by finding an input that satisfies two guards at once. A guard sequence is otherwise untestable — each single-purpose input reaches only its own guard and passes whatever the order is"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/plugin/bootstrap.test.ts owns edge/handlers/plugin/bootstrap.ts at full direct coverage"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/bootstrap.test.ts — 10 runtime cases from 6 marked bodies, pass 10 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- .../plugin/bootstrap.ts → Direct coverage passed (branches 8/8, functions 2/2, lines 88/88)"
        status: pass
  - deliverable: "The injected git port reaches the bootstrap workflow, proven by that port recording the clone the workflow performs"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/bootstrap.test.ts#clones through the injected git port into the user scope at the accepted arity"
        status: pass
      - kind: other
        ref: "Plant B — forward a freshly-constructed port instead of the injected one; both clone-carrying cases go RED, the eight rejection cases stay green"
        status: pass
      - kind: other
        ref: "Plant B2 (re-box) and Plant B3 (wrap one member) both stay GREEN — recorded as the boundary of the claim, not as a passing proof"
        status: pass
  - deliverable: "A throw escaping the bootstrap workflow becomes one failed marketplace row at error severity with no raw error text"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/bootstrap.test.ts#converts a thrown bootstrap failure into one failed marketplace row carrying no error text"
        status: pass
      - kind: other
        ref: "Plant A — remove the try/catch around the workflow call; the case goes RED with the raw sentinel error escaping to the caller"
        status: pass
  - deliverable: "The accepted arity is zero positionals and one above it is rejected before any workflow call"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/bootstrap.test.ts#rejects a single positional token / two positional tokens with the no-arguments sentence and never reaches the workflow"
        status: pass
  - deliverable: "The scope flag is rejected outright with its own sentence, at both scope values"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/bootstrap.test.ts#rejects --scope user / --scope project as never accepted, because bootstrap always targets the user scope"
        status: pass
  - deliverable: "The three guards run in a pinned order: the parse failure, then the positional guard, then the scope guard"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/bootstrap.test.ts#takes the scope-target flag as a positional and rejects it before the scope guard is consulted"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/plugin/bootstrap.test.ts#reports an unrecognised scope value with the bootstrap usage block when a positional token is already present"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet -- bootstrap.ts, three handler shared.ts files, flag-catalog.ts, tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass
      - kind: command
        ref: "npm test 5054/5054 across 291 suites, npm run test:integration 31/31, typecheck 0, lint 0, fallow 0, prettier 0"
        status: pass

duration: 45 min
completed: 2026-09-02
---

# Phase 116 Plan 14: Plugin Bootstrap Handler Owner Summary

The bootstrap shim — the one handler that rejects a scope flag rather than forwarding it — now has
one exhaustive, hermetic owner that proves the injected git port reaches the workflow, proves the
failure conversion, and pins the order of its three guards.

## Accomplishments

`tests/edge/handlers/plugin/bootstrap.test.ts` was rewritten from eight loose cases on a hand-rolled
context object into **10 runtime cases from 6 marked bodies**, all on the shared strict boundary:

| Case | Args | Boundary sizing | Clone recorder | Notification |
|------|------|-----------------|----------------|--------------|
| clones through the injected port at the accepted arity | `""` | `(2, 4, {cwd, reads: 1})` | 1 clone, user staging root | not asserted — owned by the orchestrator pair |
| rejects one / two positional tokens | `official`, `official extra` | `(1, 0)`, **no `cwd`** | empty | no-arguments sentence |
| rejects `--scope user` / `--scope project` | `--scope <scope>` | `(1, 0)`, **no `cwd`** | empty | scope-not-accepted sentence |
| takes the scope-target flag as a positional | `--local`, `--scope user --local` | `(1, 0)`, **no `cwd`** | empty | no-arguments sentence |
| reports an unrecognised scope value | `--scope nope`, `extra --scope nope` | `(1, 0)`, **no `cwd`** | empty | parse diagnostic + usage block |
| converts a thrown failure into one failed row | `""` (port refuses the clone) | `(1, 2, {cwd, reads: 1})` | 1 clone, user staging root | failed marketplace row, error severity |

Every count was **measured** against the real module through a counting context before a line was
written, never inherited from a sibling: the workflow emits twice and probes four times, the failure
conversion emits once and probes twice, and `ctx.cwd` is read exactly once on both `notify()` paths
and never on a rejection path.

Each case owns three `mkdtemp` roots (working directory, home, clone source tree), restores `HOME`
and `PI_CODING_AGENT_DIR` through `t.after()` registered before the act with the agent-directory
variable **deleted** rather than overwritten, and installs a context-owned fail-fast replacement for
`globalThis.fetch` whose call count is asserted zero.

### The forward proof

The bootstrap source is a hard-coded github shorthand, so 116-13's credential-bundle finding applies
directly and could not be avoided by choosing a different source: the GitHub provider attaches a
`GitAuthBundle` whose functions are not structured-clonable, and `createGitOpsFake` records every
call with `structuredClone`. Measured verbatim before any test was written:

```text
THREW: DOMException [DataCloneError]: (host) => credentialFill(host, runGitCredential) could not be cloned.
    at Object.clone (tests/platform/git-ops-fake.ts:129:24)
    at addGitClonedInGuard (extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:656:18)
```

The port therefore drops that downstream-owned bundle and delegates every operation, the clone
included, to the fake. Every member is still the fake's own, which is what the plan's "never a
hand-rolled literal of git functions" rule protects. The recorder then compares as one whole value:

```ts
const BOOTSTRAP_CLONE: GitCloneCall = { dir: STAGED_CLONE_DIR, url: CLONE_URL };
```

`STAGED_CLONE_DIR` is 116-07's substitution — a token stands in for a leaf that is a UUID under the
**user** scope's staging root, and any other directory is compared verbatim, so a clone staged
anywhere else still fails on its raw directory.

## Plants

Four plants, all applied to a byte-copy-backed production file and each reverted;
`git diff --quiet -- extensions/` exits 0.

**Forward sites were counted first.** `grep -n deps.gitOps` reports 2 hits, one of which is the
module's own header comment; there is exactly **one** real forward site, `bootstrap.ts:67`. One
plant is in scope, unlike the two-site case 116-13 measured.

### Plant A — remove the try/catch around the workflow call

The failure-conversion case RED, with the raw error escaping to the caller — which is exactly what
the catch exists to prevent.

```text
test at tests/edge/handlers/plugin/bootstrap.test.ts:360:1
✖ converts a thrown bootstrap failure into one failed marketplace row carrying no error text (9.952761ms)
  Error: @@the injected git port refused this clone@@
      at TestContext.<anonymous> (file:///.../tests/edge/handlers/plugin/bootstrap.test.ts:367:41)
      at async Test.run (node:internal/test_runner/test:1404:7)
```

`ℹ pass 9 / ℹ fail 1`. The sentinel message is the same one the passing case proves never reaches
the user channel.

### Plant B — forward a freshly-constructed port instead of the injected one

Both clone-carrying cases RED; all eight rejection cases stayed green, as they must — they never
reach git. The two failures land at different boundaries, which is itself informative.

```text
✖ clones through the injected git port into the user scope at the accepted arity (14709.391374ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + []
  - [
  -   {
  -     dir: '<sources-staging>/<uuid>',
  -     url: 'https://github.com/anthropics/claude-plugins-official.git'
  -   }
  - ]
```

```text
✖ converts a thrown bootstrap failure into one failed marketplace row carrying no error text (15067.254451ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3660:12)
      at notify (.../shared/notify.ts:3796:3)
      at .../edge/handlers/plugin/bootstrap.ts:76:7
```

`ℹ pass 8 / ℹ fail 2`. The fifteen-second case durations are the fallback port reaching a real
transport that the hermetic tree cannot satisfy.

### Plant B2 — re-box the port as `{ ...deps.gitOps }`

**GREEN, 10/10.** A finding, not a failure to hide: the recorder sees the same member references, so
an identical re-box is indistinguishable. This reproduces 116-17's correction under a different proof
mechanism.

### Plant B3 — wrap one member: `{ ...deps.gitOps, clone: (o) => deps.gitOps.clone(o) }`

**GREEN, 10/10** — and here this pair's proof is measurably WEAKER than 116-17's. Its structural
`when()` comparison turned red on exactly this mutation; a recorder cannot, because a wrapper that
delegates back still lets the injected implementation perform the clone. The suite header therefore
states the claim at the strength the plants support: the operation is **carried out by** the injected
implementation. No second case was added for the container — that would be one case run twice.

## Measured findings

### 1. This handler answers the inherited questions like `plugin/import`, not like the marketplace tier

It calls `parseArgs`, not `parseCommandArgs`:

| Question | Six marketplace handlers | `plugin/bootstrap` |
| --- | --- | --- |
| Surplus positional | silently DROPPED | **REJECTED** with its own sentence |
| One below the accepted arity | depends on `required` | **no target** — accepted arity is zero |
| `--local` | six different outcomes, all downstream of `extractLocalFlag` | **never reaches it**; lands on `positional` and is rejected there |

### 2. The guard order is pinnable, but not by the input the plan named

The plan asks for the unrecognised-scope case to be driven with **no** positional token, "so the
ordering of the three guards is pinned rather than assumed". With no positional token the positional
guard never applies, so that case passes whichever guard runs first — it cannot pin an order. Two
inputs that satisfy two guards at once do:

- `--scope user --local` → the **no-arguments** sentence, so the positional guard precedes the scope
  guard.
- `extra --scope nope` → the **parse diagnostic**, so the parse failure precedes the positional
  guard.

Both were written as extra rows beside the plan's own, so nothing the plan asked for was dropped.

### 3. The branch denominator moved while both readings stayed complete

Measured in both directions by restoring the HEAD suite and re-running the gate:

| Suite | Verdict |
| --- | --- |
| HEAD (old) | `Direct coverage passed … (branches 11/11, functions 2/2, lines 88/88)` |
| Rewrite | `Direct coverage passed … (branches 8/8, functions 2/2, lines 88/88)` |

Nothing is uncovered in either reading, and 8 is exactly the structural count: four binary branches
(two try/catch pairs, the positional guard, the scope guard) times two sides. T-116-07-B asked
whether a thinner rewrite drops a branch the old suite covered incidentally; it did not — the
denominator is a property of the execution profile, which is the 116-02 / 116-26 finding.

## Deviations from Plan

### 1. [Rule 1 — unreachable claim] The arity truth's lower half has no target

- **Found during:** Task 1, reading the module.
- **Issue:** `must_haves` promises "the accepted positional arity, one below it, and one above it".
  The accepted arity is zero positionals; there is no count below zero.
- **Fix:** the case list covers zero (accepted) and one and two (both rejected); the suite header
  records that the lower half has no reachable target rather than asserting something untrue.
- **Commit:** `f472cc31`

### 2. [Rule 1 — false plan claim] `must_haves` truth 5: neither clause lands here

- **Found during:** Task 1, measuring `--local` against the real module.
- **Issue:** the router-alias clause belongs to the router owner. The mutually-exclusive-selector
  clause has no scope diagnostic to prove: this handler never reaches `extractLocalFlag`, so
  `--local` is an ordinary positional token and the positional guard rejects the pair before the
  scope value is consulted.
- **Fix:** wrote the measured outcome, and used it as the guard-order pin so the row is
  discriminating rather than a third copy of the positional rejection.
- **Commit:** `f472cc31`

### 3. [Rule 1 — case that cannot fail] The plan's ordering input pins no ordering

- **Found during:** Task 1, writing the unrecognised-scope case.
- **Issue:** driving it with no positional token means the positional guard never applies, so the
  case passes under any guard order.
- **Fix:** kept the plan's row and added a second row that supplies a positional token, which is the
  row that actually discriminates. Detail in Measured findings §2.
- **Commit:** `f472cc31`

### 4. [Rule 1 — restated fact] The delegating case would have re-derived the workflow's notifications

- **Found during:** Task 1.
- **Issue:** asserting the two rendered rows duplicates `tests/orchestrators/plugin/bootstrap.test.ts`
  and the two composed orchestrator pairs, which the plan's own action forbids.
- **Fix:** the case asserts the clone recorder and relies on the boundary's exact `times(2)` for
  completeness. A third emission throws on the pending-call proxy; a second one fails at
  `verify()`.
- **Commit:** `f472cc31`

### 5. [Rule 1 — restated fact] Two old cases were dropped rather than carried over

- **Found during:** Task 1, reading the suite being replaced.
- **Issue:** the whitespace-only-argument case restates the tokenizer contract owned by
  `tests/edge/args.test.ts`; the fixture-pointer case asserts that a path string ends in its own last
  segment, which cannot fail.
- **Fix:** dropped both. The clone fixture is now written inside the case, so the suite no longer
  points at another concern's `_fixtures` tree.
- **Commit:** `f472cc31`

### 6. [Rule 2 — under-specified plant] The port plant needed two green companions to bound its claim

- **Found during:** Task 1, plant phase.
- **Issue:** the plan's plant ("construct a fresh git port") goes red, but on its own it would have
  licensed the stronger wording the plan uses ("the identical injected port").
- **Fix:** ran Plant B2 (re-box) and Plant B3 (wrap one member); both stayed green, so the header
  states the narrowed claim. B3 is a new measurement — 116-17's structural comparison goes red on it
  and a recorder does not.
- **Commit:** `f472cc31`

**Total deviations:** 6 auto-fixed (1 unreachable claim, 1 false plan claim, 1 case that cannot fail,
2 restated-fact removals, 1 plant bounding). **Impact:** no production change, no claim stronger than
what was measured, and every case the plan named is present in a form that can fail.

## Authentication Gates

None.

## Issues Encountered

None.

## Known Stubs

None.

## Deferred Issues

None. This pair is not a D-116-01a claimant — direct coverage is complete on all three axes, so
nothing was filed in `.planning/WINDOWS.md`. No stub, skipped test, or unrun `<verify>` exists in
this pair.

## Threat Flags

None. The plan's three threats are mitigated as specified: T-116-14-A by the failure-conversion case
plus Plant A and by every rejection case proving the workflow unreached, T-116-14-B by the
re-measured direct coverage in both directions, and T-116-14-C by the `git diff --quiet` pin over the
six paths.

## Verification Results

Each gate was run separately and its exit code checked. `npm run check` was NOT used: its
`format:check` link fails on pre-existing untracked operator files and short-circuits before the
tests run.

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/plugin/bootstrap.test.ts` | exit 0 — `ℹ tests 10`, pass 10, fail 0 |
| `npm run test:coverage:direct -- .../plugin/bootstrap.ts` | `Direct coverage passed … (branches 8/8, functions 2/2, lines 88/88)` |
| `npm run typecheck` | 0 |
| `npm exec -- eslint tests/edge/handlers/plugin/bootstrap.test.ts` | 0 |
| `npm exec -- prettier --check tests/edge/handlers/plugin/bootstrap.test.ts` | 0 |
| `npm run fallow` | 0 |
| `npm run lint` | 0 |
| anti-pattern scan (`! rg -n …`) | 0 (no match) |
| `rg -c '^\s+// arrange$'` | 6 markers, equal to the 6 case bodies |
| `git diff --check` | 0 |
| `git diff --quiet` over the 6 pinned paths | 0 |
| `npm test` | exit 0 — `ℹ tests 5054`, 5054/5054 across 291 suites (baseline 5052; 8 old cases became 10) |
| `npm run test:integration` | exit 0 — 31/31 |
| trufflehog filesystem scan | `chunks: 2, bytes: 20619, verified_secrets: 0, unverified_secrets: 0` |
| `SKIP=trufflehog,npm-format-check pre-commit run --files …` | 0, all hooks passed |

## Next Phase Readiness

Ready for the rest of wave 5 (116-15, 116-16, 116-18 … 116-22, 116-24, 116-25) and then 116-28.
Three things to carry forward:

1. **Check which parser your handler calls.** `plugin/bootstrap.ts` is the second `parseArgs`
   handler measured and it answered all three inherited questions like `plugin/import.ts`, not like
   the marketplace tier.
2. **A recorder-based port proof is weaker than a structural `when()` proof.** Both a re-boxed port
   and a port with one member wrapped around a delegating call stay green under a recorder. State
   the claim as "carried out by the injected implementation".
3. **A guard order needs an input that satisfies two guards at once.** Single-purpose inputs reach
   only their own guard and pass under any order.

## Self-Check: PASSED

- `tests/edge/handlers/plugin/bootstrap.test.ts` exists on disk.
- `git log --oneline --all | grep f472cc31` returns the task commit; `git log -1 --stat` shows one
  file changed, 324 insertions, 246 deletions, and no deletions of tracked files.
- Every `<acceptance_criteria>` item was re-run after the last revert and passes; the table above
  records each result.
