---
phase: 116-edge-surface
plan: "11"
subsystem: testing
tags: [node-test, edge, marketplace, remove, group-c, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-12's `openMarketplaceCommand` owner, which owns the opener's parse, its two reject arms, and the positional-name generic this handler consumes"
  - phase: 116-edge-surface
    provides: "116-26's `edge/handlers/shared.ts` owner, which owns the scope-target flag scan the opener calls"
provides:
  - "tests/edge/handlers/marketplace/remove.test.ts — the sole mirrored direct owner for edge/handlers/marketplace/remove.ts, at 100 percent direct branches, functions, and lines"
  - "the measured finding that `removeMarketplace` sweeps BOTH config layers on write-back and reads the scope-target flag ONLY to select the CFG-03 precondition target, so a valid-config workspace cannot observe the forwarded `local` member at all"
  - "the sixth `--local` outcome measured in this phase: `marketplace/remove.ts` ACCEPTS `--scope <value> --local` and honors both, because it reaches `extractLocalFlag` through the shared opener"
  - "the measured split on the arity truth: a single REQUIRED positional rejects zero (the lower half holds) while a surplus token is silently DROPPED (the upper half is false)"
  - "the fourth Group-C negative diagnostic pair: `removeMarketplace` runs no catch around `locationsFor`, so the ctx.cwd-forwarding variant dies as ERR_INVALID_ARG_TYPE at persistence/locations.ts:145 and the literal-cwd variant runs to completion and dies on the emission count at orchestrators/marketplace/remove.ts:783"
affects: []

actuals:
  tokens: 21000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Group-C negative delegation: `createNotificationBoundary(1, 0)` with the `cwd` parameter OMITTED, both scopes seeded so a workflow that ran would have records to remove, plus an on-disk assertion that every seeded record survived"
    - "Delegating cases size the boundary at `(1, 2, { value: cwd, reads: 1 })` — one emission, two `getAllTools()` reads (one soft-dependency probe reading twice), one `cwd` read. All four counts were measured against the real module through a counting proxy before a line of the suite was written"
    - "The removal footprint is read back as ONE whole value — the sorted marketplace names each scope's `state.json` records, absent files reading empty — so a removal that landed in the wrong scope fails on the diff rather than on a missing existence check"
    - "A forwarded member with no observable effect in the default fixture gets a fixture that MAKES it observable. The scope-target flag rows run against a `claude-plugins.local.json` that fails schema validation, where supplying the flag aborts the removal and omitting it does not"

key-files:
  created: []
  modified:
    - tests/edge/handlers/marketplace/remove.test.ts

key-decisions:
  - "DEVIATION — the plan's scope-target case as worded ('supplied and omitted, driven before and after the positional, asserting the identical outcome') CANNOT FAIL. Measured: `removeMarketplace` reads `opts.local` in exactly one place, to pick `configLocalJsonPath` over `configJsonPath` as the CFG-03 precondition target; the success write-back then calls `cascadeRemoveFromLayer` on BOTH layers unconditionally (orchestrators/marketplace/remove.ts:405-406). In a valid-config workspace `alpha`, `alpha --local` and `--local alpha` are byte-identical in notification and on-disk footprint. Rewritten as a three-row body against a workspace whose override layer fails schema validation, which keeps the ordering half (both positions abort identically) and adds the supplied-versus-omitted half. Plant C proves the strengthening was necessary: deleting the forwarded `local` member turns the two flag-supplied rows RED and would have left the plan's version fully GREEN"
  - "DEVIATION — the plan's `must_haves` truth 4 ('both out-of-range counts are rejected with a usage error before any orchestrator call') is HALF FALSE against this module, for the sixth plan running. The schema is `[{ name: 'name' }]` — ONE REQUIRED positional (`required` defaults to true, args-schema.ts:78) — so zero positionals IS rejected and the lower half HOLDS. The upper half is false: `parseCommandArgs` iterates `schema.positional.entries()`, so the second token of `alpha beta` is never inspected. Measured: `alpha beta` removes the project-scope `alpha` and leaves the user-scope `beta` untouched, byte-identical to `alpha`. Written as a DROP proof with Plant F confirming the row discriminates"
  - "DEVIATION — the plan's 'mutually exclusive scope selectors' case is not a rejection here. `--scope user --local` is ACCEPTED and BOTH members reach the workflow: `extractLocalFlag` consumes `--scope <value>` as a downstream-owned pair and filters only the scope-target token. This is the sixth `--local` outcome measured in the phase and the third acceptance, matching `marketplace/add.ts` and `marketplace/autoupdate.ts` — all three reach `extractLocalFlag`, unlike `info.ts` which places the token in the name position"
  - "The four forwarded members each got their own plant rather than one plant standing for all four. Plant B (scope), Plant C (scope-target flag), Plant D (name) and Plant E (working directory) fail disjoint case sets, so no member rides another member's proof"
  - "No D-116-01a claim. The pair reaches 100 percent — branches 8/8, functions 2/2, lines 46/46. The baseline read 7/7; the denominator ROSE with the numerator exactly as the phase's V8 finding predicts, and nothing is uncovered. Nothing was filed in `.planning/WINDOWS.md`, and no coverage-exception pragma was added"
  - "The old suite's `ghost` cases were dropped. They asserted the not-added precondition does not escape the handler, which is the remove workflow's own outcome shape and belongs to `tests/orchestrators/marketplace/remove.test.ts`. What replaced them proves the handler's own promise: which record disappeared, from which scope"
  - "No production file was touched. Seven plants were applied across `edge/handlers/marketplace/remove.ts` and `edge/args-schema.ts` and reverted from byte copies taken before the first plant; `git diff --stat -- extensions/` was empty after the last revert, and the plan's pinned-path check exited 0 before staging"

patterns-established:
  - "Before writing a case that asserts 'supplied and omitted behave identically', find where the module READS the member. If the module reads it in one place and that place is inert in your fixture, the case cannot fail and a plant will stay green. Build a fixture that reaches the read"
  - "A removal is proven BOTH ways: what disappeared, and what did not. Every rejecting case here asserts the full seeded footprint is intact, which is the fact a user cares about and the on-disk half of the D-116-06 negative"
  - "The Group-C negative's diagnostic is a property of the orchestrator's error handling, and `removeMarketplace` is a fourth data point: no catch wraps `locationsFor`, so it behaves like `marketplace/list` on the forwarding variant and like a completed workflow on the literal-cwd variant. The SIZING is what is durable, never the stack trace"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/marketplace/remove.test.ts owns edge/handlers/marketplace/remove.ts at 100 percent direct coverage"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/remove.test.ts — 11 runtime cases from 7 marked bodies, pass 11 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts → branches 8/8, functions 2/2, lines 46/46 (was 7/7, 2/2, 46/46)"
        status: pass
  - deliverable: "The usage block this handler supplies is the remove form and no other"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant A — swap the USAGE constant to the add form; all 3 rejecting cases RED on the deepStrictEqual diff"
        status: pass
  - deliverable: "The removal lands in the scope the flags selected, and a record seeded in the other scope survives"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/remove.test.ts#reaches the remove workflow, which drops the record held by the user scope the flag names"
        status: pass
      - kind: command
        ref: "Plant B — force the forwarded scope to user; 6 cases RED"
        status: pass
  - deliverable: "The scope-target flag reaches the workflow only when supplied, and its position does not change the outcome"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant C — delete the conditional local spread; both flag-supplied rows RED, the omitted row correctly GREEN"
        status: pass
  - deliverable: "The parsed name and the working directory reach the workflow"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant D — replace the forwarded name with a literal; 8 cases RED"
        status: pass
      - kind: command
        ref: "Plant E — replace the forwarded working directory with a literal; 8 cases RED"
        status: pass
  - deliverable: "A surplus positional drops rather than rejecting, and only the first name is removed"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant F — reject surplus positionals inside parseCommandArgs; the drop row RED"
        status: pass
  - deliverable: "The D-116-06 negative: the remove workflow is proven unreached on all three rejection channels"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant G1 — fall through to a real removeMarketplace call forwarding ctx.cwd; all 3 rejecting cases RED with ERR_INVALID_ARG_TYPE at persistence/locations.ts:145"
        status: pass
      - kind: command
        ref: "Plant G2 — the same fall-through with a literal working directory; all 3 rejecting cases RED with ctx.ui.notify is not a function at orchestrators/marketplace/remove.ts:783"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over remove.ts, the three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass

duration: 35 min
completed: 2026-09-02
---

# Phase 116 Plan 11: Marketplace Remove Owner Summary

The marketplace remove shim now has one exhaustive hermetic owner at 100 percent direct coverage,
proving which record disappeared from which scope — and, for the scope-target flag, a fixture that
makes a member the plan assumed was observable actually observable.

## What was built

`tests/edge/handlers/marketplace/remove.test.ts` was rewritten from six loose cases built on a
hand-rolled context cast into eleven runtime cases from seven marked bodies, all on the shared strict
boundary.

| Marked body | Args | Boundary sizing | Proves |
|-------------|------|-----------------|--------|
| scope selection | `alpha`, `alpha --scope project`, `alpha --scope user` | `(1, 2, {cwd, reads: 1})` | the accepted arity of one positional; project-then-user precedence; the cross-scope pair |
| missing positional | `""` | `(1, 0)`, **no `cwd`** | one below the accepted arity IS rejected; the remove usage block, hand-authored |
| surplus positional | `alpha beta` | `(1, 2, {cwd, reads: 1})` | one above the accepted arity is DROPPED, not rejected; `beta` survives |
| scope-target flag | `alpha`, `alpha --local`, `--local alpha` | `(1, 2, {cwd, reads: 1})` | the flag reaches the workflow only when supplied, and its position does not change the outcome |
| both selectors | `alpha --scope user --local` | `(1, 2, {cwd, reads: 1})` | a scope flag beside the scope-target flag is ACCEPTED and the named scope is honored |
| unknown flag | `alpha --frobnicate` | `(1, 0)`, **no `cwd`** | the D-116-06 negative on the flag-scan channel |
| invalid scope value | `alpha --scope bogus` | `(1, 0)`, **no `cwd`** | the D-116-06 negative on the parse channel; the diagnostic verbatim |

Direct coverage moved from branches 7/7, functions 2/2, lines 46/46 to **8/8, 2/2, 46/46**. The
denominator rose with the numerator, which is the phase's measured V8 behavior, not a regression.

Delegation is observed as the **on-disk footprint**: the sorted marketplace names each scope's
`state.json` records, read back as one whole value with absent files reading empty. `alpha` is seeded
in both scopes so a scope selection is visible as which copy survives, and `beta` is seeded in the
user scope alone as a marketplace no expectation names — a lookup that widened past the first
positional would take it.

## The scope-target flag: a case the plan specified that could not fail

The plan asked for the flag "supplied and omitted, driven before and after the positional, asserting
the identical outcome". Measured against the real module, that case cannot fail.

`removeMarketplace` reads `opts.local` in exactly one place:

```ts
const targetConfigPath =
  opts.local === true ? locations.configLocalJsonPath : locations.configJsonPath;
```

That path is used for the CFG-03 validity precondition and for the basename in the failure row. The
success write-back then sweeps **both** layers unconditionally
(`orchestrators/marketplace/remove.ts:405-406`). So in a workspace whose config is valid or absent —
which is what the plan's fixture would have been — `alpha`, `alpha --local` and `--local alpha`
produce byte-identical notifications and byte-identical on-disk state.

The rows were rewritten against a workspace whose `claude-plugins.local.json` fails schema
validation. There the flag is decisive:

| Args | Notification | Footprint |
|------|--------------|-----------|
| `alpha` | `● alpha [project] (removed)` | `{ project: [], user: [] }` |
| `alpha --local` | `A marketplace operation has failed.\n\n⊘ alpha [project] (failed) {invalid manifest}` | `{ project: ["alpha"], user: [] }` |
| `--local alpha` | the same failure row | `{ project: ["alpha"], user: [] }` |

The ordering half survives (both positions abort identically), and the supplied-versus-omitted half
is now a real difference. Plant C confirms the strengthening was needed.

## Plants (D-116-04)

Seven plants, all RED, all reverted. Production is byte-identical to HEAD.

### Plant A — swap the `USAGE` constant to the add form

```text
✖ supplies the remove usage block, shown when the name positional is missing (17.713973ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
        message: 'Missing required argument.\n' +
          '\n' +
  +       'Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]',
  -       'Usage: /claude:plugin marketplace <remove|rm> <name> [--scope user|project] [--local]',
        severity: 'error'
      }
    ]
```

All 3 rejecting cases RED.

### Plant B — force the forwarded scope to `"user"`

```text
✖ reaches the remove workflow, which drops the record held by the project scope first when no scope flag is supplied (65.121712ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: '● alpha [user] (removed)'
  -     message: '● alpha [project] (removed)'
      }
    ]
```

6 cases RED (both project-scope selection rows, the surplus row, all three scope-target rows). The
`--scope user` row and the three rejecting cases stayed green, which is correct: the first already
names the user scope and the others never reach the workflow.

### Plant C — delete the conditional scope-target spread

```text
✖ selects the override config layer as the removal precondition when the scope-target flag is supplied after the positional (WB-01) (15.942779ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: '● alpha [project] (removed)'
  -     message: 'A marketplace operation has failed.\n' +
  -       '\n' +
  -       '⊘ alpha [project] (failed) {invalid manifest}',
  -     severity: 'error'
      }
    ]
```

Exactly the two flag-supplied rows RED; the omitted row correctly stayed green. This is the plant
that shows the plan's original wording would have proven nothing.

### Plant D — replace the forwarded name with a literal

```text
✖ removes the first positional alone, so a surplus token drops rather than rejecting (25.211862ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: '● beta [user] (removed)'
  -     message: '● alpha [project] (removed)'
      }
    ]
```

8 cases RED — every delegating case.

### Plant E — replace the forwarded working directory with a literal

```text
✖ reaches the remove workflow, which drops the record held by the project scope first when no scope flag is supplied (113.458727ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: '● alpha [user] (removed)'
  -     message: '● alpha [project] (removed)'
      }
    ]
```

8 cases RED. The project scope root is derived from the working directory, so a wrong one makes the
bare form fall through to the user scope.

### Plant F — reject surplus positionals inside `parseCommandArgs`

```text
✖ removes the first positional alone, so a surplus token drops rather than rejecting (14.989792ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: 'Missing required argument.\n' +
  +       '\n' +
  +       'Usage: /claude:plugin marketplace <remove|rm> <name> [--scope user|project] [--local]',
  +     severity: 'error'
  -     message: '● alpha [project] (removed)'
      }
    ]
```

Exactly the drop row RED. This is what makes the drop assertion discriminating rather than
decorative.

### Plant G1 — the D-116-06 negative, forwarding `ctx.cwd`

```ts
    if (opened === undefined) {
      await removeMarketplace({ ctx, pi, name: "alpha", cwd: ctx.cwd });
      return;
    }
```

```text
✖ supplies the remove usage block, shown when the name positional is missing (16.00674ms)
  TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function
      at Object.join (node:path:1339:7)
      at locationsFor (.../persistence/locations.ts:145:61)
      at removeMarketplace (.../orchestrators/marketplace/remove.ts:665:28)
      at .../edge/handlers/marketplace/remove.ts:34:13
```

All 3 rejecting cases RED. `removeMarketplace` calls `locationsFor("user", opts.cwd)` on its first
line of real work and wraps no catch around it, so it behaves like `marketplace/list`.

### Plant G2 — the same fall-through with a literal working directory

```ts
    if (opened === undefined) {
      await removeMarketplace({ ctx, pi, name: "alpha", cwd: "/tmp/plant-g2-cwd" });
      return;
    }
```

```text
✖ supplies the remove usage block, shown when the name positional is missing (29.832712ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at emitCascadeWith (.../shared/notify.ts:3850:3)
      at emitContextCascade (.../shared/notify.ts:3869:3)
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at removeMarketplace (.../orchestrators/marketplace/remove.ts:783:3)
      at async .../edge/handlers/marketplace/remove.ts:34:7
```

All 3 rejecting cases RED. With a usable working directory the workflow runs to completion and its
own `{not added}` notification is the emission the boundary refuses. Both variants confirm the
sizing; neither diagnostic was predicted before the plant ran.

## Deviations from Plan

### 1. [Rule 1 — a specified case that cannot fail] The scope-target ordering case was strengthened

- **Found during:** Task 1, reading `orchestrators/marketplace/remove.ts` before writing a line.
- **Issue:** The plan asks for the flag "supplied and omitted, driven before and after the
  positional, asserting the identical outcome". The forwarded `local` member only selects the CFG-03
  precondition target; the write-back sweeps both layers. In a valid-config fixture the three inputs
  are byte-identical, so the case could not fail.
- **Fix:** Drove the three rows against a workspace whose `claude-plugins.local.json` fails schema
  validation, keeping the ordering half and adding a real supplied-versus-omitted difference.
- **Verification:** Plant C turns exactly the two flag-supplied rows RED and leaves the omitted row
  green.
- **Commit:** `480a5512`

### 2. [Rule 1 — half-false plan claim] `must_haves` truth 4: the surplus half is false, the lower half holds

- **Found during:** Task 1, reading `edge/args-schema.ts`.
- **Issue:** The truth promises both out-of-range counts are rejected. The schema is one REQUIRED
  positional, so zero IS rejected and the lower half holds; `parseCommandArgs` iterates the SCHEMA,
  so the second token of `alpha beta` is never inspected and the upper half is false.
- **Fix:** Kept the missing-positional rejection as written and wrote the surplus row as a DROP
  proof.
- **Verification:** Measured before writing — `alpha beta` removes the project-scope `alpha` and
  leaves the user-scope `beta`, byte-identical to `alpha`. Plant F confirms the row discriminates.
- **Commit:** `480a5512`

### 3. [Rule 1 — false plan claim] The mutually-exclusive scope selectors are ACCEPTED

- **Found during:** Task 1.
- **Issue:** The plan asks the owner to state the observed outcome, allowing for a rejection. There
  is none: `extractLocalFlag` consumes `--scope <value>` as a downstream-owned pair and filters only
  the scope-target token, so both members reach the workflow.
- **Fix:** Wrote an acceptance case naming both selectors and asserting the named scope is honored.
- **Verification:** `alpha --scope user --local` removes the user-scope record and leaves the
  project-scope record; Plant B shows the scope half is load-bearing.
- **Commit:** `480a5512`

### 4. [Scope narrowing] The old suite's not-added cases were dropped

- **Found during:** Task 1, case selection.
- **Issue:** Three of the six old cases asserted the not-added precondition does not escape the
  handler and re-derived the workflow's `{not added}` row. That is the remove workflow's own outcome
  shape, owned by `tests/orchestrators/marketplace/remove.test.ts`, and the plan forbids re-deriving
  it.
- **Fix:** Replaced them with what the handler alone promises — which record disappeared and from
  which scope.
- **Commit:** `480a5512`

**Total deviations:** 4 (1 specified case that could not fail, strengthened; 2 false or half-false
`must_haves` truths corrected; 1 set of cases narrowed). **Impact:** the owner asserts only what the
module can falsify. No claim was weakened to go green.

## Scoped gap (D-116-05, O3, Group C)

`removeMarketplace` is reached by direct import with no injection point, so this owner cannot state
an exact argument list against it. Delegation is observed as one minimal effect — which marketplace
records each scope holds after the command. This exact-argument gap is recorded in the plan's
`must_haves` truth 6 and is **scoped, not missed**. The negative half of D-116-06 is proven in full,
on all three rejection channels, with two plant variants.

## Verification

Every gate run separately, exit code checked individually. `npm run check` was NOT used (its
`format:check` link short-circuits on pre-existing untracked operator files).

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/marketplace/remove.test.ts` | tests 11, pass 11, fail 0 |
| `npm run test:coverage:direct -- .../marketplace/remove.ts` | branches 8/8, functions 2/2, lines 46/46 |
| `npm run typecheck` | exit 0 |
| `npm run lint` (whole repo) | exit 0 |
| `npm exec -- eslint <file>` | exit 0 |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | 5058/5058 across 291 suites, exit 0 |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan (`! rg …`) | no matches |
| `rg -c '^\s+// arrange$'` | 7 (equals the marked-body count) |
| `git diff --check` | clean |
| `git diff --quiet` over pinned production paths and the boundary helper | exit 0 |
| trufflehog filesystem scan | chunks 2, bytes 18949, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | exit 0 |

## Note to the remaining Group-C owners

1. `removeMarketplace` is a fourth data point for the negative's diagnostic: no catch around
   `locationsFor`, so the forwarding variant dies as `ERR_INVALID_ARG_TYPE` and the literal-cwd
   variant dies on the emission count. Copy the sizing, never the stack trace.
2. `marketplace/remove.ts` is the sixth `--local` measurement and the third acceptance. The
   discriminator remains whether the module reaches `extractLocalFlag` — through the shared opener
   counts.
3. Before writing "supplied and omitted behave identically", find where the module READS the member.
   If the read is inert in your fixture, the case cannot fail and a plant will stay green.

## Issues Encountered

None.

## Next Phase Readiness

Ready for 116-05 (completions/provider), which closes wave 4. The scope-target-flag finding — a
forwarded member whose only read is a precondition selector — applies directly to any remaining
owner whose handler forwards `local`.

## Self-Check: PASSED

- `tests/edge/handlers/marketplace/remove.test.ts` exists on disk.
- `git log --oneline --all | grep 480a5512` returns the task commit.
- All plan `<verify>` links re-run at close-out; every one passed.
- `git diff --stat -- extensions/` is empty; no production file changed.
