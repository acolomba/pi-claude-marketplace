---
phase: 116-edge-surface
plan: "10"
subsystem: testing
tags: [node-test, edge, marketplace, handler-shim, group-c, offline, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-01's args-schema owner, which owns the positional-schema contract this handler consumes and which this owner therefore does not restate"
provides:
  - "tests/edge/handlers/marketplace/list.test.ts — the sole mirrored direct owner for edge/handlers/marketplace/list.ts, at 100 percent direct branches, functions, and lines"
  - "the normative Group-C (D-116-05 O3) negative-delegation shape for the remaining twelve seamless handler owners: a rejecting case sized at one emission, zero probes, and NO stated `cwd`, run against a tree seeded in both scopes so a workflow that did run would have rows to emit"
  - "the measured correction that the Group-C negative fires on the first unstated boundary READ, not on the emission count — a handler forwarding `ctx.cwd` dies in `path.join` on strong-mock's pending-call proxy before it can emit"
  - "the measured correction that an EMPTY positional schema drops surplus tokens rather than rejecting them, so a zero-positional handler has no `one below the accepted arity` case and no out-of-range rejection"
  - "the measured correction that `marketplace/list.ts` swallows the scope-target flag as a positional, so the phase-wide mutually-exclusive-selectors truth has no target on this handler"
affects: []

actuals:
  tokens: 30000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Group-C negative delegation: `createNotificationBoundary(1, 0)` with the `cwd` parameter OMITTED. The omission is the load-bearing half — the workflow's first act is to read `ctx.cwd`, so an unreached-workflow claim is falsified at that read, before any emission counting"
    - "The rejecting case seeds the same two-scope tree the delegating cases use. An unseeded tree weakens the negative: the workflow it must not reach would emit only the empty-state sentinel, whereas a seeded tree gives it real rows"
    - "Delegating cases size the boundary at `(1, 2, { value: cwd, reads: 1 })` — one emission, two `getAllTools()` reads (one soft-dependency probe reading twice), one `cwd` read. All four counts were measured against the real module through a counting proxy, never assumed"
    - "Seeded records deliberately omit `lastUpdatedAt` and declare no autoupdate entry, so the renderer emits the bare `<glyph> <name> [<scope>]` header row. That keeps the delegation assertion a minimal effect rather than a re-derivation of the orchestrator's detail tokens"
    - "Scope forwarding is observed through the emitted rows' scope brackets rather than through a stated argument list, because there is no injection point to state one against"

key-files:
  created: []
  modified:
    - tests/edge/handlers/marketplace/list.test.ts

key-decisions:
  - "DEVIATION — the plan's `must_haves` truth 3 ('Each handler owner proves the accepted positional arity, one below it, and one above it … both out-of-range counts are rejected with a usage error before any orchestrator call') is FALSE against this module in two ways. The accepted arity is ZERO, so there is no count below it. And `parseCommandArgs` iterates `schema.positional.entries()` — the SCHEMA, not the input — so an empty schema performs zero iterations and every surplus token is silently dropped; the handler then delegates normally. Measured: `official` and `official extra` both produce the full two-scope listing, identical to the bare form. The plan's own `<action>` anticipated this ('do not assume a rejection'); its `must_haves` did not. Written instead: two rows proving the surplus tokens are DROPPED and the listing still runs, plus Plant C, which shows those rows would go RED if the handler ever did reject a surplus positional"
  - "DEVIATION — the plan's `must_haves` truth 4 ('Each handler owner proves that mutually exclusive scope flags supplied together are rejected before any orchestrator call') has no target here. `marketplace/list.ts` never calls `extractLocalFlag`, so the scope-target flag `--local` reaches `parseArgs` as an ordinary token, is pushed onto `positional`, and is then dropped by the empty schema. Measured: `--scope user --local` lists the user scope alone, exactly as `--scope user` does. Written instead: one case pinning that the token is swallowed and the scope beside it is honoured, plus Plant E, which shows the case goes RED if the handler ever rejects it. The sibling reading of that truth — a repeated `--scope` pair — is owned by `tests/edge/args.test.ts:224` ('parseArgs keeps the last scope value when the pair is supplied twice') and is not restated here"
  - "DEVIATION — the plan's Plant A as literally worded ('delete the early return … confirm the case goes RED with an unexpected-call report from the boundary') does not produce a boundary report. Deleting the return makes `parsed.scope` a read off `undefined`, and the case goes RED on `TypeError: Cannot read properties of undefined (reading 'scope')` — a JavaScript accident, not the boundary mechanism the plan wanted proved. A second variant (A2) was run that reaches the workflow with a valid options bag, and that one exercises the intended mechanism. Both are recorded below; A2 is the load-bearing one"
  - "FINDING for the twelve remaining Group-C owners — the phase's normative G5 excerpt states the wrong mechanism. It says an orchestrator notification 'would be a second `ctx.ui` access past its `times(1)` count, which throws at the call site'. Measured: the workflow never gets that far. `listMarketplaces` reads `opts.cwd` (forwarded from `ctx.cwd`) inside `locationsFor` on its first line, and because the rejecting case omits the boundary's `cwd` parameter, strong-mock serves a pending-call proxy that dies in `path.join` with `The \"path\" argument must be of type string. Received function`. The emission-count mechanism is only the FALLBACK, reached by a handler whose orchestrator reads no working directory. Omitting `cwd` on a rejecting case is therefore not cosmetic — it is the primary trigger"
  - "The plan's 'accepted arity, zero positionals with no flags' case and its 'scope omitted' case are the same call with the same expectation. They were written as ONE case rather than the same case run twice, which 116-29 recorded as a defect class. Its title names the scope-omitted behavior ('lists every scope project-first when no scope flag narrows the listing') because that is the discriminating half"
  - "The missing-`--scope`-value diagnostic (`--scope` with no operand) was NOT added as a second rejecting case. It enters the same callback and the same early return, adds no branch, and its diagnostic is already owned by `tests/edge/args.test.ts:176`. A second case here would be the first case run twice with a different string"
  - "No production file was touched. Five plants were applied to `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` and reverted from a byte-copy taken before the first plant; `git diff --stat -- extensions/` was empty after the last revert, and the plan's pinned-path check (`git diff --quiet` over list.ts, the three handler `shared.ts` files, `flag-catalog.ts`, and `tests/helpers/notification-boundary.ts`) exited 0 before staging"
  - "Every boundary count in this suite was MEASURED, not assumed, through a counting proxy over `ctx.ui`, `ctx.cwd`, and `pi.getAllTools()` run against the real module before a line of the suite was written: delegating paths are `ui 1, notify 1, cwd 1, tools 2`; rejecting paths are `ui 1, notify 1, cwd 0, tools 0`"

patterns-established:
  - "When a plan says 'read the module and state what it does; do not assume a rejection', treat the sibling `must_haves` truth as suspect too. Here the action clause was right and the truth clause was wrong about the same behavior, twice"
  - "A phase-wide `must_haves` truth written for a family of handlers can be vacuous for one member. A zero-positional handler has no arity below its accepted count, and a handler that never scans for the scope-target flag cannot reject a conflict involving it. Narrow the claim to what the module can falsify rather than authoring a case that cannot fail"
  - "A negative-delegation proof should be planted in the form that reaches the workflow with valid inputs. Deleting an early return in front of a guard that produced `undefined` proves only that JavaScript dereferences `undefined`; substituting a real workflow call proves the boundary is what catches it"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/marketplace/list.test.ts owns edge/handlers/marketplace/list.ts, including the previously-uncovered parse-failure callback and early return"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/list.test.ts — 7 runtime cases from 5 marked case bodies, pass 7 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts → branches 8/8, functions 3/3, lines 44/44 (was 4/5, 2/3, 41/44)"
        status: pass
  - deliverable: "The D-116-06 negative: the list workflow is proven unreached on the parse-failure path"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/list.test.ts#reports an unrecognised scope value with the list usage block and never lists"
        status: pass
      - kind: command
        ref: "Plant A2 — replace the early return with a real listMarketplaces call; the case goes RED with ERR_INVALID_ARG_TYPE from locationsFor"
        status: pass
  - deliverable: "The usage block is a hand-authored literal, not a value read back off the module"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant B — swap the module's USAGE constant to the marketplace info form; the case goes RED on the deepStrictEqual diff"
        status: pass
  - deliverable: "The listing stays offline (NFR-5 / SC-4) in every case, delegating and rejecting alike"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/list.test.ts — every case asserts fetchCallCount() === 0 against a context-owned fail-fast replacement for globalThis.fetch"
        status: pass
  - deliverable: "The scope member reaches the workflow only when supplied, and the empty positional schema drops surplus tokens"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant D — delete the conditional scope spread; both scope rows and the scope-target case go RED"
        status: pass
      - kind: command
        ref: "Plant C — add a surplus-positional rejection; both surplus rows go RED"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet -- list.ts handlers/shared.ts marketplace/shared.ts plugin/shared.ts flag-catalog.ts tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass

duration: 45 min
completed: 2026-09-02
---

# Phase 116 Plan 10: Marketplace List Owner Summary

The marketplace listing shim now has one exhaustive, hermetic, offline-proven owner at 100 percent
direct coverage, and it establishes the normative Group-C negative-delegation shape that the twelve
remaining seamless handler owners copy.

## What was built

`tests/edge/handlers/marketplace/list.test.ts` was rewritten from three loose cases built on a
hand-rolled context into seven cases from five marked bodies, all on the shared strict boundary:

| Case | Args | Boundary sizing | Proves |
|------|------|-----------------|--------|
| lists every scope project-first | `""` | `(1, 2, {cwd, reads: 1})` | accepted arity; scope omitted enumerates both scopes |
| drops one / two surplus positional tokens | `official`, `official extra` | same | the empty schema drops surplus tokens and still lists |
| lists the user / project scope alone | `--scope user`, `--scope project` | same | the scope member reaches the workflow only when supplied |
| drops the scope-target flag | `--scope user --local` | same | `--local` is swallowed as a positional, not rejected |
| reports an unrecognised scope value | `--scope bogus` | `(1, 0)`, **no `cwd`** | the parse-failure callback, the early return, and the D-116-06 negative |

Direct coverage moved from branches 4/5, functions 2/3, lines 41/44 to **8/8, 3/3, 44/44**.

Every case owns two `mkdtemp` roots, restores `HOME` and `PI_CODING_AGENT_DIR` through `t.after()`
registered before the act (with the agent-directory variable deleted rather than overwritten), and
installs a context-owned fail-fast replacement for `globalThis.fetch` whose call count is asserted
zero — never an error-message match.

## Plants (D-116-04)

Five plants, all RED, all reverted. Production is byte-identical to HEAD.

### Plant A — delete the early return (the plan's literal wording)

```text
✖ reports an unrecognised scope value with the list usage block and never lists (17.746637ms)
  TypeError: Cannot read properties of undefined (reading 'scope')
      at .../edge/handlers/marketplace/list.ts:37:18
      at TestContext.<anonymous> (.../tests/edge/handlers/marketplace/list.test.ts:215:9)
```

RED, but for the wrong reason: `parsed` is `undefined`, so the conditional spread dereferences it
before the boundary can say anything. This proves the return is load-bearing; it does not prove the
boundary catches a workflow run.

### Plant A2 — fall through to a real workflow call (the mechanism the plan wanted)

```ts
    if (parsed === undefined) {
      await listMarketplaces({ ctx, pi, cwd: ctx.cwd });
      return;
    }
```

```text
✖ reports an unrecognised scope value with the list usage block and never lists (26.84334ms)
  TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function
      at Object.join (node:path:1339:7)
      at locationsFor (.../persistence/locations.ts:145:61)
      at listMarketplaces (.../orchestrators/marketplace/list.ts:58:23)
      at .../edge/handlers/marketplace/list.ts:34:13
    code: 'ERR_INVALID_ARG_TYPE'
```

This is the finding for the twelve later Group-C owners: the negative fires at the workflow's first
unstated boundary read, not at the emission count.

### Plant B — swap the usage constant to the marketplace info form

```text
✖ reports an unrecognised scope value with the list usage block and never lists (11.738411ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
        message: 'Invalid --scope value: "bogus". Must be "user" or "project".\n' +
          '\n' +
  +       'Usage: /claude:plugin marketplace info <name> [--scope user|project]',
  -       'Usage: /claude:plugin marketplace <list|ls> [--scope user|project]',
        severity: 'error'
```

### Plant C — reject surplus positionals

```text
✖ drops one surplus positional token and still lists every scope (15.604177ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +     message: 'Unexpected argument.\n' +
  +       '\n' +
  +       'Usage: /claude:plugin marketplace <list|ls> [--scope user|project]',
  +     severity: 'error'
  -     message: '● alpha [project]\n\n● beta [user]'
```

Both surplus rows went RED. This is what makes them discriminating rather than decorative.

### Plant D — delete the conditional scope spread

```text
✖ lists the user scope alone when --scope user is supplied (16.388ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +     message: '● alpha [project]\n\n● beta [user]'
  -     message: '● beta [user]'
```

Both scope rows and the scope-target case went RED.

### Plant E — reject the scope-target flag as an unknown flag

```text
✖ drops the scope-target flag as a surplus positional and honors the scope beside it (14.331424ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  +     message: 'Unknown flag: "--local".\n' +
  +       '\n' +
  +       'Usage: /claude:plugin marketplace <list|ls> [--scope user|project]',
  +     severity: 'error'
  -     message: '● beta [user]'
```

## Deviations from Plan

### 1. [Rule 1 — false plan claim] `must_haves` truth 3 is false: an empty schema drops surplus tokens

- **Found during:** Task 1, reading `edge/args-schema.ts` before writing a line.
- **Issue:** The truth promises "the accepted positional arity, one below it, and one above it … both
  out-of-range counts are rejected with a usage error before any orchestrator call". The accepted
  arity here is zero, so no count exists below it; and `parseCommandArgs` loops over
  `schema.positional.entries()`, which for `positional: []` runs zero times, so a surplus token is
  never inspected and never rejected.
- **Fix:** Wrote the two rows as DROP proofs, not rejection proofs, and planted a rejection
  (Plant C) to show the rows discriminate.
- **Verification:** Measured against the real module before writing — `official` and `official extra`
  each produce `● alpha [project]\n\n● beta [user]`, byte-identical to the bare form.
- **Commit:** `8a139f36`

### 2. [Rule 1 — false plan claim] `must_haves` truth 4 has no target on this handler

- **Found during:** Task 1.
- **Issue:** The truth promises that "mutually exclusive scope flags supplied together are rejected
  before any orchestrator call". This handler never calls `extractLocalFlag`, so `--local` is an
  ordinary token to `parseArgs`, lands on `positional`, and is dropped. Nothing is rejected. The
  sibling reading — a repeated `--scope` pair — is last-wins and is owned by `tests/edge/args.test.ts`.
- **Fix:** Wrote the swallow as the claim and planted a rejection (Plant E) to show it discriminates.
  Did not restate the repeated-pair rule.
- **Verification:** `--scope user --local` emits `● beta [user]`, identical to `--scope user`.
- **Commit:** `8a139f36`

### 3. [Rule 1 — plan plant produces the wrong diagnostic] Plant A needed a second variant

- **Found during:** Task 1, plant phase.
- **Issue:** The plan predicted "an unexpected-call report from the boundary". The literal plant
  produces a raw `TypeError` on `undefined`, because the spread dereferences `parsed` before the
  boundary is consulted.
- **Fix:** Ran both. A2 reaches the workflow with a valid options bag and exercises the real
  mechanism; both outputs are recorded verbatim above.
- **Verification:** Both variants RED; production reverted and `git diff --stat -- extensions/` empty.
- **Commit:** `8a139f36`

### 4. [Scope narrowing] Missing-`--scope`-value case not added

- **Found during:** Task 1, case selection.
- **Issue:** It enters the same callback, the same early return, and adds no branch; its diagnostic is
  already owned by `tests/edge/args.test.ts:176`.
- **Fix:** Omitted, so the suite does not carry one case run twice.
- **Commit:** `8a139f36`

**Total deviations:** 4 (2 false `must_haves` truths corrected, 1 plant strengthened, 1 case narrowed).
**Impact:** The owner asserts only what the module can falsify. No claim was weakened to go green; two
claims were replaced with the true behaviors and both got a plant.

## Scoped gap (D-116-05, O3, Group C)

`listMarketplaces` is reached by direct import with no injection point, so this owner cannot state an
exact argument list against it. The delegation is observed as one minimal effect — the seeded
marketplace appearing as a row with its scope bracket. This gap is recorded in the plan's `must_haves`
truth 6 and is scoped, not missed. The negative half of D-116-06 is proven in full.

## Verification

Every gate run separately, exit code checked individually. `npm run check` was NOT used (its
`format:check` link short-circuits on pre-existing untracked operator files).

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/marketplace/list.test.ts` | pass 7, fail 0 |
| `npm run test:coverage:direct -- .../marketplace/list.ts` | branches 8/8, functions 3/3, lines 44/44 |
| `npm run typecheck` | exit 0 |
| `npm run lint` (whole repo) | exit 0 |
| `npm exec -- eslint <file>` | exit 0 |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | 5041/5041 across 291 suites, exit 0 |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan (`! rg …`) | no matches |
| `rg -c '^\s+// arrange$'` | 5 (equals the case-body count) |
| `git diff --check` | clean |
| `git diff --quiet` over pinned production paths | exit 0 |
| trufflehog filesystem scan | chunks 1, bytes 9063, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | exit 0 |

## Issues Encountered

None.

## Next Phase Readiness

Ready for 116-13, which closes the DAG-recomputed wave 3. The Group-C shape and the corrected negative
mechanism are the reusable output for the twelve remaining seamless handler owners.

## Self-Check: PASSED

- `tests/edge/handlers/marketplace/list.test.ts` exists on disk.
- `git log --oneline --all | grep 8a139f36` returns the task commit.
- All plan `<verify>` links re-run at close-out; every one passed.
- `git diff --stat -- extensions/` is empty; no production file changed.
