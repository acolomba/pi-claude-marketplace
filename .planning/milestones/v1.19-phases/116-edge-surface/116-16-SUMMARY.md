---
phase: 116-edge-surface
plan: "16"
subsystem: testing
tags: [node-test, edge, plugin, fetch, exported-parser, group-c, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-08's normative Group-C shape: boundary sized at one emission and zero probes with `cwd` omitted, both scopes seeded, whole-value comparison, `verifyBoundary()` last"
  - phase: 116-edge-surface
    provides: "116-02's `edge/args.ts` owner, which owns the tokenizer and the scope-value diagnostics this parser surfaces"
  - phase: 116-edge-surface
    provides: "116-23's `edge/handlers/plugin/shared.ts` owner, which owns the `<plugin>@<marketplace>` reference split this parser calls"
provides:
  - "tests/edge/handlers/plugin/fetch.test.ts — the sole mirrored direct owner for edge/handlers/plugin/fetch.ts, at 100 percent direct branches, functions, and lines"
  - "the exported-parser owner shape: two top-level `describe()` blocks, one per exported entrypoint, with the parser proven as a contract in its own right on a ZERO-emission boundary and the factory proven separately"
  - "a FOURTH parser/arity combination: `parseArgs` plus a handler-owned positional-count guard — zero positionals ACCEPTED (so nothing lies below it) and a surplus positional genuinely REJECTED by the handler rather than dropped by the parser"
  - "the EIGHTH distinct `--local` outcome in this phase, and the FIRST time the inherited mutually-exclusive-selector rejection truth has held: `--scope user --local` is rejected as `Unknown flag: \"--local\".`"
  - "the measured correction that the delegating probe count is per-orchestrator: TWO here, not the FOUR 116-15 measured, because `fetchPlugins` emits one cascade through a single soft-dependency probe"
  - "the measured SEVENTH and EIGHTH diagnostic sites for the Group-C negative: persistence/locations.ts:145 via orchestrators/plugin/fetch.ts:244 when `ctx.cwd` is forwarded, and orchestrators/plugin/fetch.ts:194 with a literal working directory"
  - "the measured limit that a derive-not-persist workflow leaves NO on-disk footprint, so the emission itself is the only minimal effect a Group-C owner can observe, and an empty-tree assertion beside verifyBoundary() would be a tautology"
affects: []

actuals:
  tokens: 4300
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "One top-level `describe()` per exported entrypoint (`parseFetchTarget`, `makeFetchHandler`), no nesting — the house form for a module with more than one public contract"
    - "Accepting parser cases size the boundary at `createNotificationBoundary(0, 0)`. With zero emissions the helper leaves `ctx.ui` unstated, so a successful parse that emitted anything would die on the pending-call proxy. The silence proof is the SIZING, not a length assertion"
    - "Group-C negative delegation: `createNotificationBoundary(1, 0)` with the `cwd` parameter OMITTED and both scopes seeded with a DIFFERENT marketplace each, so which scope a command enumerated is readable off the single emission"
    - "Delegating cases size the boundary at `(1, 2, { value: cwd, reads: 1 })`. The TWO is measured against the real module through a counting context, not inherited from a sibling: `fetchPlugins` emits ONE cascade and that cascade runs ONE soft-dependency probe reading `getAllTools()` twice"
    - "A derive-not-persist workflow is observed through its emission compared as a whole value, with the seeded tree kept small enough that the hand-authored literal stays readable and the enumerated set is what discriminates the three target forms"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/fetch.test.ts

key-decisions:
  - "MEASURED FINDING — this module calls `parseArgs` DIRECTLY and never reaches `extractLocalFlag`, and that single fact decided all three inherited questions in a FOURTH combination. Zero positionals is an ACCEPTED arity (the all form), so nothing lies below it; TWO positionals IS rejected, with `Too many arguments.`, by the handler's own `nonFlagPositionals.length > 1` guard rather than by any parser. Every earlier `parseCommandArgs` sibling DROPPED its surplus token because `parseCommandArgs` iterates the schema; the two `parseArgs` siblings rejected theirs inside the shared opener. This is the first module in the phase where the surplus rejection is the handler's own code"
  - "DEVIATION — the plan's `must_haves` truth 4 ('the accepted positional arity, one below it, and one above it … both out-of-range counts are rejected') is HALF false, failing on the LOWER half. Zero positionals is accepted and is itself the all form, so there is no arity below it and no rejection to write. The upper half HOLDS, which is the first time in nine plans; it is proven by two rows (two references and three references) and by Plant B2, which moves the threshold to two and turns exactly the two-reference row red"
  - "MEASURED FINDING — `--scope user --local` is REJECTED here, with `Unknown flag: \"--local\".`. The scope-target flag reaches `parseArgs` as an ordinary token, lands on `positional`, and the handler's own `startsWith(\"--\")` scan claims it before the arity guard. This is the EIGHTH distinct `--local` outcome measured in this phase and the FIRST time the plan's mutually-exclusive-selector rejection truth has held against a real module — five earlier siblings accepted, dropped, or renamed it. The claim was measured on this module before the case was written, exactly as the handoff requires"
  - "MEASURED CORRECTION — the delegating probe count here is TWO, not the FOUR 116-15 measured. `fetchPlugins` makes exactly one `notifyWithContext` call and that cascade runs ONE soft-dependency probe, which reads `getAllTools()` twice. 116-15's four came from an orchestrator whose cascade runs two probes. The count is a property of the ORCHESTRATOR, not of the delegating shape, and neither the helper's documented default nor a sibling's measured value may be inherited"
  - "DEVIATION — the plan asks each delegating case to assert 'one minimal effect the workflow produces for that form … rather than re-deriving its outcome or notification body'. `fetch` persists NO state (derive-not-persist: its only write is the clone seam's, which a path source never reaches), so no on-disk effect exists to observe. The emission IS the only effect, and the three forms produce three visibly different sweeps. Each delegating case therefore compares the whole notification list against a hand-authored literal; what the case CLAIMS is which targets reached the workflow, and the row grammar rides along because whole-value comparison is the house rule. Plant G (forwarding a hard-coded all target) turns exactly the marketplace-form and plugin-form rows red, so the cases discriminate between the forms rather than restating the orchestrator's rendering"
  - "DEVIATION — no on-disk footprint is asserted beside `verifyBoundary()` on the rejecting case, unlike every earlier Group-C owner. 116-08's note 5 scopes that addition to owners 'where your workflow writes something'. This workflow never writes, so an empty-tree assertion would pass whether or not the workflow ran — a tautology of exactly the kind 116-11 was caught adding. The boundary alone carries the negative, and Plants F1 and F2 prove it fires"
  - "No offline guard was added. `orchestrators/plugin/fetch.ts` is a NAMED member of the forbidden-targets set in `tests/architecture/no-orchestrator-network.test.ts` (its own file header says so), so a `fetch` spy here would restate a gate. 116-15 added one because `orchestrators/plugin/enable-disable.ts` is NOT in that set"
  - "No D-116-01a claim. The pair reaches 100 percent — branches 27/27, functions 4/4, lines 132/132 — and both the baseline and the rewrite read the same numbers, so the plan's T-116-16-B risk (an outcome-thin rewrite dropping a branch the old suite covered incidentally) did not occur. Nothing was filed in `.planning/WINDOWS.md`"
  - "`roadmap.update-plan-progress` was NOT run: every prior plan in this phase reported that it mangles ROADMAP.md. The checkbox and BOTH counts (the `**Plans**:` prose line and the progress-table row) were edited by hand and verified with `grep -c '^- \\[x\\] \\*\\*116-'`, which reads 23. `state.advance-plan`, `state.update-progress` and `state.record-metric` were likewise not run — STATE.md was hand-edited so the Current Position keeps NAMING the completed plans and `completed_plans` moves 197 → 198 exactly once"
  - "No production file was touched. Nine plants were applied to `edge/handlers/plugin/fetch.ts` and reverted from a byte copy taken before the first plant; the file's md5 is identical to the pre-plant copy, `git diff --stat -- extensions/` is empty, and the plan's pinned-path check exited 0 before staging"

patterns-established:
  - "A module with two public contracts gets two top-level `describe()` blocks and two independent proofs. An exported parser is a contract in its own right: prove it on a zero-emission boundary as a pure function over whole values, and prove the factory separately as delegation plus short-circuit. Do not fold the parser's grammar into the factory's cases"
  - "Size an accepting pure-function case at `createNotificationBoundary(0, 0)`. Leaving `ctx.ui` unstated makes an unexpected emission die where it happens — Plant A produced `TypeError: ctx.ui.notify is not a function` from a parser case for exactly this reason — which is stronger than asserting the notification array is empty"
  - "Measure the probe count on YOUR orchestrator every time. Two siblings in the same wave measured 4 and 2 for structurally identical delegating paths; the number counts the cascades the orchestrator runs, not the emissions the handler makes"
  - "A Group-C owner whose workflow writes nothing must NOT add an empty-footprint assertion beside `verifyBoundary()`. It passes whether or not the workflow ran, and it dresses a tautology as a second proof"
  - "When two rows of a row table share an expectation, find the plant that separates them before keeping both. Plant B2 (threshold moved to two) separates the two-reference row from the three-reference row; Plant C (scan stops at the first non-flag) separates the two unknown-flag rows; Plant A2 (length guard dropped) separates the lone-separator row from the other two malformed references"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/plugin/fetch.test.ts owns edge/handlers/plugin/fetch.ts across both exported entrypoints and the module-private target mapper"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/fetch.test.ts — 21 runtime cases from 8 marked bodies, pass 21 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- .../plugin/fetch.ts → branches 27/27, functions 4/4, lines 132/132 (baseline 27/27, 4/4, 132/132)"
        status: pass
  - deliverable: "The exported parser is proven as a public contract in its own right: three accepted positional shapes map onto three target forms, each asserted as one whole value, and an accepted parse is silent"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant A — remove the leading-separator branch; the marketplace-form parser row RED with ctx.ui.notify is not a function (the zero-emission boundary refusing an unexpected emission) and the marketplace-form delegating row RED on the diff"
        status: pass
      - kind: command
        ref: "Plant D — return { target } unconditionally; the two scope rows on the all form, the scope row on a plugin reference, and both delegating scope rows RED (5 cases)"
        status: pass
  - deliverable: "Every rejection path emits exactly one notification and returns undefined, each carrying its own stated sentence"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant B — delete the too-many-arguments guard; both arity rows RED, each returning a plugin target instead of undefined"
        status: pass
      - kind: command
        ref: "Plant B2 — move the threshold from one to two; exactly the two-reference row RED, the three-reference row green"
        status: pass
      - kind: command
        ref: "Plant A2 — drop the length guard on the leading separator; exactly the lone-separator row RED, returning { kind: 'marketplace', marketplace: '' }"
        status: pass
      - kind: command
        ref: "Plant C — stop the flag scan at the first non-flag token; the after-a-valid-reference unknown-flag row RED and both arity rows RED, the only-positional row green"
        status: pass
  - deliverable: "makeFetchHandler forwards the parsed target and the optional scope into the fetch workflow"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant G — forward a hard-coded { kind: 'all' } target; exactly the marketplace-form and plugin-form delegating rows RED"
        status: pass
      - kind: command
        ref: "Plant E — delete the conditional scope spread; both scope rows RED, each widening back to a both-scope sweep"
        status: pass
  - deliverable: "The D-116-06 negative: the fetch workflow is proven unreached on a rejection"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/fetch.test.ts#reports an unknown flag and never reaches the fetch workflow (D-116-06)"
        status: pass
      - kind: command
        ref: "Plant F1 — fall through to a real fetchPlugins call forwarding ctx.cwd; RED with ERR_INVALID_ARG_TYPE at persistence/locations.ts:145 via orchestrators/plugin/fetch.ts:244"
        status: pass
      - kind: command
        ref: "Plant F2 — the same fall-through with a literal working directory; RED with ctx.ui.notify is not a function at orchestrators/plugin/fetch.ts:194"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over fetch.ts, the three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass

duration: 35 min
completed: 2026-09-02
---

# Phase 116 Plan 16: Plugin Fetch Owner Summary

The fetch shim — the only plugin handler that exports its own parser — now has one exhaustive owner
that proves the parser as a public contract separately from the factory's delegation, at 100 percent
direct coverage.

## What was built

`tests/edge/handlers/plugin/fetch.test.ts` was rewritten from twelve loose cases built on a
hand-rolled context cast into **twenty-one runtime cases from eight marked bodies**, in two top-level
`describe()` blocks, all on the shared strict boundary.

| Marked body | Entry point | Rows | Boundary sizing | Proves |
|-------------|-------------|------|-----------------|--------|
| accepted shapes | `parseFetchTarget` | 6 | `(0, 0)` | the three target forms as whole values; the scope member present only when supplied; an accepted parse is SILENT |
| malformed reference | `parseFetchTarget` | 3 | `(1, 0)` | the offending token is named verbatim; a lone separator falls through to the reference split |
| too many arguments | `parseFetchTarget` | 2 | `(1, 0)` | one above the accepted arity IS rejected, and the threshold is exactly one |
| unknown long flag | `parseFetchTarget` | 3 | `(1, 0)` | the scan does not stop at the first non-flag; the scope-target flag beside a scope flag is REJECTED |
| unrecognised scope value | `parseFetchTarget` | 1 | `(1, 0)` | the tokenizer's own sentence with the usage block appended |
| three target forms | `makeFetchHandler` | 3 | `(1, 2, {cwd, reads: 1})` | each parsed form reaches the workflow and narrows the sweep differently |
| scope narrowing | `makeFetchHandler` | 2 | same | the scope member reaches the workflow; an omitted scope sweeps both scopes |
| rejection short-circuit | `makeFetchHandler` | 1 | `(1, 0)`, **no `cwd`** | the D-116-06 negative |

Direct coverage held at **branches 27/27, functions 4/4, lines 132/132**, the same reading as the
baseline. The plan's `T-116-16-B` risk — an outcome-thin rewrite dropping a branch the old suite
covered incidentally — did not occur.

## Which parser this module calls, checked before any arity or flag claim

`parseFetchTarget` calls **`parseArgs` directly** and never reaches `extractLocalFlag`. It then runs
two guards of its own over the returned positionals: a `startsWith("--")` scan, then
`nonFlagPositionals.length > 1`. That is a **fourth** combination, distinct from all three the phase
has recorded:

| Question | This module | The six marketplace siblings | `bootstrap` / `import` | `enable-disable` |
|---|---|---|---|---|
| Zero positionals | **ACCEPTED** (it IS the all form) | accepted | no arity below zero | rejected |
| Surplus positional | **REJECTED, by the handler's own guard** | dropped | rejected in the shared opener | dropped |
| `--scope X --local` | **REJECTED** as an unknown flag | four different answers | an ordinary positional token | accepted, both honoured |

So the arity truth fails on its **lower** half here, and the surplus half HOLDS — the first time in
nine plans. The `--local` answer is the **eighth** distinct outcome in this phase, and the first time
the inherited "mutually exclusive scope selectors are rejected" truth has held against a real module.
Every one of these was measured against the module before a line of the suite was written.

## Measured boundary counts

Taken through a counting context before a case was written, because the two paths disagree:

| Path | `ctx.ui` | `ctx.cwd` | `pi.getAllTools()` | Sizing |
|---|---|---|---|---|
| accepted parse | 0 | 0 | 0 | `(0, 0)` |
| rejection (`notifyUsageError`) | 1 | 0 | 0 | `(1, 0)` |
| delegation (`notifyWithContext` cascade) | 1 | 1 | **2** | `(1, 2, {cwd, reads: 1})` |

The **2** is the finding worth carrying. 116-15 measured **4** on its delegating path and warned that
the helper's documented default of 2 would be wrong; here the documented value happens to be right,
for a different reason — `fetchPlugins` emits ONE cascade and that cascade runs ONE probe. Neither
the documentation nor a sibling's measurement may be inherited: the number counts the cascades the
orchestrator runs.

## The Group-C negative, and two more diagnostic sites

The negative is `createNotificationBoundary(1, 0)` with `cwd` OMITTED, both scopes seeded with a
different marketplace each, the whole notification list compared, and `verifyBoundary()` last. Both
plant variants were run and neither was promised in advance:

- **Forwarding `ctx.cwd`** dies at `persistence/locations.ts:145`, reached from
  `orchestrators/plugin/fetch.ts:244` inside `enumerateFetchTargets`. `fetchPlugins` runs **no catch**
  around enumeration, so the unstated-`cwd` failure escapes as `ERR_INVALID_ARG_TYPE` rather than
  being converted into a notification.
- **A literal working directory** runs the sweep to completion and dies at
  `orchestrators/plugin/fetch.ts:194` — the orchestrator's own cascade is what the boundary refuses.

That is the **seventh and eighth** diagnostic site in this phase from the same omission. The rule
holds: omitting `cwd` is the constant, the diagnostic is a property of the orchestrator.

**What is deliberately absent:** no on-disk footprint assertion beside `verifyBoundary()`. `fetch`
persists no state — its only write is the clone seam's, which a path source never reaches — so an
empty-tree assertion would pass whether or not the workflow ran. 116-08's note 5 scopes that addition
to owners whose workflow writes something.

## Plants (D-116-04)

Nine plants, **all nine RED**, all reverted. The production file's md5 is identical to the byte copy
taken before the first plant and `git diff --stat -- extensions/` is empty.

### Plant A — remove the leading-separator branch from `toFetchTarget`

```text
✖ strips the leading separator from a bare marketplace reference and stays silent (D-81-01)
  TypeError: ctx.ui.notify is not a function
      at notifyUsageError (.../shared/notify.ts:326:10)
      at toFetchTarget (.../edge/handlers/plugin/fetch.ts:96:5)
      at parseFetchTarget (.../edge/handlers/plugin/fetch.ts:72:18)
      at TestContext.<anonymous> (.../tests/edge/handlers/plugin/fetch.test.ts:215:22)

✖ narrows the sweep to the named marketplace (D-81-01)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: 'Invalid <plugin>@<marketplace> ref: "@mp".\n' +
  -     message: '● mp [project]\n' +
  -       '  ⊘ alpha v1.0.0 (skipped) {up-to-date}\n' +
  -       '  ⊘ beta v1.0.0 (skipped) {up-to-date}\n' +
          '\n' +
  +       'Usage: /claude:plugin fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]',
  +     severity: 'error'
  -       'Plugin fetch: 2 successes'
      }
    ]
```

The parser row's failure is the zero-emission sizing doing its job: with `ctx.ui` unstated, the
unexpected emission dies at the boundary rather than quietly appending to an array.

### Plant A2 — drop `&& ref.length > 1` from the leading-separator guard

```text
✖ names a lone separator with no marketplace after it verbatim and returns no target (FTCH-01)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + { target: { kind: 'marketplace', marketplace: '' } }
  - undefined
```

Exactly one row RED; the other two malformed references stay green. That is what makes the lone
separator its own case rather than a third copy.

### Plant B — delete the too-many-arguments guard

```text
✖ rejects two references as too many arguments and returns no target (D-81-01)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  + { target: { kind: 'plugin', marketplace: 'mp', plugin: 'a' } }
  - undefined
```

Both arity rows RED.

### Plant B2 — move the threshold from `> 1` to `> 2`

```text
✖ rejects two references as too many arguments and returns no target (D-81-01)
```

Exactly the two-reference row RED, the three-reference row green. The pair pins the accepted count at
exactly one positional rather than merely "not many".

### Plant C — stop the flag scan at the first non-flag token

```text
✖ rejects two references as too many arguments and returns no target (D-81-01)
✖ rejects three references as too many arguments and returns no target (D-81-01)
✖ names an unrecognised long flag supplied after a valid reference verbatim and returns no target (T-81-10)
```

The after-a-reference unknown-flag row is RED while the only-positional row stays green, which is the
proof that the scan does not stop early — and the reason the two rows are not one case run twice.

### Plant D — return `{ target }` unconditionally from the parser

```text
✖ carries the user scope beside the all form and stays silent (D-81-01)
✖ carries the project scope beside the all form and stays silent (D-81-01)
✖ carries the user scope beside a plugin reference and stays silent (D-81-01)
✖ sweeps the project scope alone when it is the supplied scope (FTCH-01)
✖ sweeps the user scope alone when it is the supplied scope (FTCH-01)
```

5 cases RED, spanning both `describe()` blocks: the parser's scope member and the sweep it produces
are one chain.

### Plant E — delete the conditional `scope` spread in the factory

```text
✖ sweeps the project scope alone when it is the supplied scope (FTCH-01)
    actual:   [ { message: '● mp [project]\n  ⊘ alpha …\n  ⊘ beta …\n\n● other [user]\n  ⊘ gamma …\n\nPlugin fetch: 3 successes' } ]
    expected: [ { message: '● mp [project]\n  ⊘ alpha …\n  ⊘ beta …\n\nPlugin fetch: 2 successes' } ]
```

Both scope rows RED, and the failure is exactly the sweep widening back to both scopes — which is
what makes "present only when supplied" a measurement. The scope-omitted form is the all-form row of
the target table, which stays green.

### Plant F1 — negative fall-through forwarding `ctx.cwd`

```ts
    const parsed = parseFetchTarget(args, ctx);
    if (parsed === undefined) {
      await fetchPlugins({ ctx, pi, cwd: ctx.cwd, target: { kind: "all" } });
      return;
    }
```

```text
✖ reports an unknown flag and never reaches the fetch workflow (D-116-06)
  TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function
      at Object.join (node:path:1339:7)
      at locationsFor (.../persistence/locations.ts:145:61)
      at enumerateFetchTargets (.../orchestrators/plugin/fetch.ts:244:23)
      at fetchPlugins (.../orchestrators/plugin/fetch.ts:126:47)
      at .../edge/handlers/plugin/fetch.ts:121:13
```

### Plant F2 — the same fall-through with a literal working directory

```text
✖ reports an unknown flag and never reaches the fetch workflow (D-116-06)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at emitCascadeWith (.../shared/notify.ts:3850:3)
      at emitContextCascade (.../shared/notify.ts:3869:3)
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at fetchPlugins (.../orchestrators/plugin/fetch.ts:194:3)
      at async .../edge/handlers/plugin/fetch.ts:121:7
```

The sweep ran to completion and its own cascade is what the boundary refused.

### Plant G — forward a hard-coded `{ kind: "all" }` target

```text
✖ narrows the sweep to the named marketplace (D-81-01)
✖ narrows the sweep to the named plugin (D-81-01)
```

Exactly the two narrowing rows RED, the all-form row green. This is what makes the three delegating
cases discriminate between the target forms rather than restate the orchestrator's rendering.

## Deviations from Plan

### 1. [Rule 1 — half-false plan claim] `must_haves` truth 4: nothing lies below the accepted arity, and the surplus IS rejected

- **Found during:** Task 1, reading `edge/args.ts` and the handler's own guards before writing a
  line.
- **Issue:** The truth promises "the accepted positional arity, one below it, and one above it …
  both out-of-range counts are rejected". Zero positionals is itself an accepted arity (the all
  form), so there is no count below it. The upper half holds, and the plan's own action text already
  said so.
- **Fix:** Wrote no "one below" case. Wrote the surplus rejection as two rows (two references, three
  references) and added Plant B2 to show the threshold is exactly one.
- **Verification:** Measured before writing — `""` returns `{ target: { kind: "all" } }` with no
  emission; `a@mp b@mp` returns `undefined` after one `Too many arguments.` notification.
- **Commit:** `9e6f4368`

### 2. [Rule 1 — the flag truth measured, not inherited] `--local` beside `--scope` is REJECTED here

- **Found during:** Task 1.
- **Issue:** The handoff's standing rule is that no `--local` claim may be carried across handlers.
  Measured on this module: the token reaches `parseArgs` as an ordinary positional and the handler's
  own long-flag scan rejects it as `Unknown flag: "--local".`, before the arity guard.
- **Fix:** Wrote it as the third row of the unknown-flag table, labelled as the scope-target flag
  supplied beside a scope flag, so the title states the fact the case proves.
- **Verification:** `--local`, `--scope user --local`, `--local --scope user` and `a@mp --local` all
  produce the same single `Unknown flag: "--local".` notification.
- **Commit:** `9e6f4368`

### 3. [Rule 3 — the plan's stated observation does not exist] a derive-not-persist workflow leaves no minimal effect but its emission

- **Found during:** Task 1, reading `orchestrators/plugin/fetch.ts`.
- **Issue:** The plan asks each delegating case to assert "one minimal effect … rather than
  re-deriving its outcome or notification body". `fetch` persists no state; its only write is the
  clone seam's, which a path source never reaches. There is no file to read back.
- **Fix:** Compared the whole notification list against a hand-authored literal, with the seeded tree
  kept small (two plugins in the project scope's marketplace, one in a different user-scope
  marketplace) so the three forms produce three visibly different sweeps. Plant G bounds the claim to
  "which targets reached the workflow".
- **Verification:** The three literals differ in the marketplaces named, the plugins listed, and
  whether a tally is rendered at all.
- **Commit:** `9e6f4368`

### 4. [Rule 1 — a specified assertion would be a tautology] no empty-footprint assertion on the negative

- **Found during:** Task 1, negative case design.
- **Issue:** Every earlier Group-C owner asserts an unchanged on-disk footprint beside
  `verifyBoundary()`. Here that assertion would pass whether or not the workflow ran, because the
  workflow never writes.
- **Fix:** Omitted it and said so in the file header. The boundary alone carries the negative, and
  Plants F1 and F2 show it fires from both variants.
- **Commit:** `9e6f4368`

**Total deviations:** 4 (1 half-false `must_haves` truth corrected, 1 inherited flag claim measured
and replaced, 1 plan-stated observation measured not to exist, 1 specified assertion removed as
unfalsifiable). **Impact:** the owner asserts only what the module can falsify. No claim was weakened
to go green.

## Scoped gap (D-116-05, O3, Group C)

`fetchPlugins` is reached by direct import with no injection point, so this owner cannot state an
exact argument list against it. Delegation is observed as the one effect the workflow produces — the
enumerated set the cascade names for the parsed target and the supplied scope. This exact-argument
gap is recorded in the plan's `must_haves` truth 6 and is **scoped, not missed**. The negative half
of D-116-06 is proven in full, with both plant variants.

## Verification

Every gate run separately, exit code checked individually. `npm run check` was NOT used (its
`format:check` link short-circuits on pre-existing untracked operator files).

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/plugin/fetch.test.ts` | tests 21, suites 2, pass 21, fail 0 |
| `npm run test:coverage:direct -- .../plugin/fetch.ts` | branches 27/27, functions 4/4, lines 132/132 |
| `npm run typecheck` | exit 0 |
| `npm run lint` (whole repo) | exit 0 |
| `npm exec -- eslint <file>` | exit 0 |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | **5070/5070 across 293 suites**, exit 0 (read from the runner's `ℹ tests` line) |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan (`! rg …`) | no matches |
| `rg -c '^\s+// arrange$'` | 8 (equals the marked-body count) |
| `git diff --check` | clean |
| `git diff --quiet` over pinned production paths and the boundary helper | exit 0 |
| trufflehog filesystem scan | chunks 2, bytes 20309, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | exit 0, every applicable hook Passed |

## Note to the six remaining Group-C owners

1. Read which parser your module calls FIRST. Four combinations now exist, and the fourth
   (`parseArgs` plus a handler-owned count guard) rejects a surplus positional where the
   `parseCommandArgs` siblings drop it.
2. Measure your probe count. Two owners in this wave measured 4 and 2 for the same delegating shape.
3. If your workflow persists nothing, do NOT add an empty-footprint assertion beside
   `verifyBoundary()`. It is unfalsifiable.
4. Size an accepting pure-function case at `(0, 0)`. An unexpected emission then dies at the
   boundary instead of being counted after the fact.
5. Check whether your orchestrator is a named member of `no-orchestrator-network.test.ts`'s
   forbidden-targets set before adding an offline guard. `orchestrators/plugin/fetch.ts` is one, so
   no guard was added here.

## Issues Encountered

None.

## Next Phase Readiness

Ready for the next wave-5 owner. 116-18, 116-19, 116-20, 116-21, 116-22, 116-24 and 116-25 remain,
then 116-28. **116-21 is still the outstanding D-116-01a claimant and must pin
`plugin/pending.ts:39`.**

## Self-Check: PASSED

- `tests/edge/handlers/plugin/fetch.test.ts` exists on disk.
- `git log --oneline --all | grep 9e6f4368` returns the task commit.
- All plan `<verify>` links re-run at close-out; every one passed.
- `git diff --stat -- extensions/` is empty; no production file changed.
