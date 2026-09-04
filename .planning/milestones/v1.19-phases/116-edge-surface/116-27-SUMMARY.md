---
phase: 116-edge-surface
plan: "27"
subsystem: testing
tags: [node-test, edge, llm-tools, exhaustiveness, d-116-14, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-02's amended D-116-01a pin form — never pin an absolute branch pair"
  - phase: 116-edge-surface
    provides: "the G6 hermetic-scope and offline-proof shape settled by tests/orchestrators/edge-deps.test.ts"
provides:
  - "tests/edge/handlers/tools.test.ts — the sole mirrored direct owner for edge/handlers/tools.ts, at 100 percent direct functions, lines and branches"
  - "the discharged D-116-14 exhaustiveness obligation for the whole phase: four recorded plants, three TS2366 and one TS7030"
  - "the corrected premise that noImplicitReturns gates a default-less switch returning an optional value"
affects: []

actuals:
  tokens: 20260
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Captured registration: the recorder is installed as a strong-mock property read, and the tool definition it records is what the case drives — registration alone leaves the tool body unexecuted"
    - "A narrowed Pi port for a generic method: ExtensionAPI declares registerTool as a generic method, and a method cannot be read as a value, so the mock is typed with registerTool restated as a property"
    - "Type-level table completeness: Record<Exclude<Union, TableMembers>, never> makes a status no row table drives a compile error"
    - "Parameter narrowing as an exhaustiveness gate: give a function the producer's own row union, and the arms the producer can never emit stop compiling"

key-files:
  created: []
  modified:
    - tests/edge/handlers/tools.test.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts

key-decisions:
  - "Research's premise for the fourth switch was wrong and the plan's correction is confirmed: deleting an arm from pluginVersion raises TS7030, not nothing. noImplicitReturns (tsconfig.json:11) makes the end of a default-less switch reachable once an arm goes missing, so all four switches in tools.ts are gated — three by TS2366 and one by TS7030"
  - "pluginVersion's parameter type is Awaited<ReturnType<typeof loadPluginListPayload>>[number][\"plugins\"][number], derived from the producer rather than named or hand-excluded, so a change to the list surface's row union lands here as a compile error"
  - "The deletions were compiler-forced, not chosen: re-adding the updated arm to the narrowed switch raises TS2678, which is the control that proves the removed arms were unreachable rather than merely unused"
  - "The shared boundary helper was NOT used. createNotificationBoundary hands back a mock<ExtensionAPI>, and reading its generic registerTool method as a value is an @typescript-eslint/unbound-method error; the tools never notify and never probe, so the helper would have stated nothing this file needs. Both mocks are built in-file, and tests/helpers/notification-boundary.ts is untouched"
  - "DEVIATION: a second production edit beyond the licensed one. The inline `err instanceof Error ? err.message : String(err)` in the tool's failure branch is now shared/errors.ts's errorMessage(err) — byte-identical logic, no cast, no behavior change. Without it the pair tops out at branches 101/102: no payload load this module can reach throws a non-Error, so the local copy was a branch unreachable through the module's own surface, and the pair rule's remedy is removal rather than a coverage exception"
  - "projectRowStatus throws a plain Error with no structured fields, so the ten refusal rows assert instanceof Error, the exact name, and the WHOLE message. A whole-value message equality is not the message-substring match the rule bars, and adding a typed error class would have been a production edit this plan is not licensed to make"
  - "partially-available and remote rows are unreachable through the tool. The tool always sends installed/available/unavailable to the orchestrator (it never sends partial or remote), and shouldShow admits those two buckets only under their own flags — so their projection arms are proven through the exported projectRowStatus alone, and the version table covers the seven statuses the tool can actually render"

patterns-established:
  - "When a switch survives only as a missing-arm gate, say so in the comment and say why it must not be collapsed — otherwise the next reader deletes the gate as redundant"
  - "A defensive narrowing duplicated from a shared helper is a branch the local pair can never reach; call the helper instead of copying it, and the branch is owned where it is already proven"

requirements-completed: [MOD-09]

coverage:
  - deliverable: "tests/edge/handlers/tools.test.ts owns every export of edge/handlers/tools.ts through its registered callbacks"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/tools.test.ts — 47 runtime cases from 18 marked bodies across 3 top-level describes, pass 47 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/tools.ts → Direct coverage passed (branches 101/101, functions 16/16, lines 513/513)"
        status: pass
  - deliverable: "The phase's whole D-116-14 exhaustiveness obligation, discharged by four recorded plants"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant 1 projectRowStatus → TS2366; Plant 2 statusLabel → TS2366; Plant 3 statusKey → TS2366; Plant 4 pluginVersion → TS7030. All four RED, all reverted"
        status: pass
  - deliverable: "The narrowed version reader still carries the missing-arm gate"
    human_judgment: false
    verification:
      - kind: other
        ref: "Step 4 re-plant — the reachable failed arm deleted from the narrowed switch → TS7030 at tools.ts:381; reverted"
        status: pass
  - deliverable: "The removed arms were compiler-forced, not chosen"
    human_judgment: false
    verification:
      - kind: other
        ref: "Control — the updated arm re-added to the narrowed switch → TS2678 'not comparable to type'; reverted"
        status: pass
  - deliverable: "Behavior parity across the parameter-type change"
    human_judgment: false
    verification:
      - kind: test
        ref: "the nine version-parity cases were written and passing against the unmodified module, then re-run unedited after the narrowing — all nine still pass, git diff --stat -- tests/ empty at that point"
        status: pass
  - deliverable: "The suite's status tables stay total over the plugin status union"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant A — the disabled row removed from the projection table → TS1360 'Property disabled is missing in type {} but required in type Record<\"disabled\", never>'; reverted"
        status: pass
  - deliverable: "The exact ctx.cwd read counts are a real promise"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant B — one case's reads raised from 1 to 2 → that case reddened alone (46 → 45 pass, 1 fail); reverted"
        status: pass
  - deliverable: "The rest of the suite is unaffected"
    human_judgment: false
    verification:
      - kind: command
        ref: "npm test → 4964/4964 across 283 suites, exit 0; npm run test:integration → 31/31, exit 0; npm run typecheck, npm run lint, npm run fallow all exit 0"
        status: pass

metrics:
  duration: "70 min"
  completed: 2026-09-02
---

# Phase 116 Plan 27: Read-Only Tool Surface Owner Summary

`edge/handlers/tools.ts` now has a mirrored owner that drives both registered LLM-tool callbacks
against a seeded tree, projects every plugin status through the exported projection, and reaches
**100 percent direct functions, lines and branches** with no coverage exception. The plan's whole
D-116-14 obligation is discharged: all four switches in the module were planted, all four went RED,
and the version reader's parameter type is now derived from the producer that feeds it.

## What was built

`tests/edge/handlers/tools.test.ts`, 1213 lines: 18 marked case bodies emitting 47 runtime cases
across three top-level `describe()` blocks, one per export (`projectRowStatus`,
`registerListMarketplacesTool`, `registerListPluginsTool`). `ToolPluginStatus` is a type and gets
no block.

### The boundary

Both mocks are `strong-mock` with `exactParams: true`, built per case inside `createToolBoundary`.
Exactly two members carry an expectation:

- `pi.registerTool` — a recorder promised `times(1)`. A second registration, or none, fails at
  `verifyBoundary()`. The recorded tool definition is what every rendering case then invokes;
  asserting only that registration happened is what left function coverage short before.
- `ctx.cwd` — an exact count. One read on the marketplace-existence check, one on the payload
  load, so a path that short-circuits before the load promises 1 and a `marketplace`-narrowed path
  promises 2.

Nothing else is stated. `ctx.ui` carries no expectation, so an attempt to notify dies at the
pending-call proxy — that silence is the BLOCK A proof. `pi.getAllTools()` carries none either, so
a soft-dependency probe fails the same way; the payload loader reads neither `ctx` nor `pi`, which
is why `toolProbes` is effectively zero here.

Every case installs a fail-fast `fetch` through `t.mock.method` and asserts `fetchCallCount() === 0`
by count, never by an error message (SC-4 / NFR-5). Both environment restores and both temporary
directories are registered with `t.after()` before the act, and `PI_CODING_AGENT_DIR` is deleted
rather than overwritten.

### Cases

| Group | Cases | What it pins |
| --- | --- | --- |
| `projectRowStatus` reachable | 9 rows | each list-surface status onto its three-value tool bucket |
| `projectRowStatus` refused | 10 rows | each status the surface cannot produce throws, asserted by class, `name`, and whole message |
| table completeness | compile-time | `Record<Exclude<PluginStatus, drivenStatuses>, never>` — a status neither table drives is a compile error |
| marketplaces tool | 3 | the registered definition; the empty-state text; one line per marketplace with scope, plugin count and logical source |
| plugins tool registration | 1 | the whole declared parameter schema and the definition's member list |
| version parity | 9 rows | the `version` each seeded status carries, present and equal or absent from the row object |
| filters | 5 rows | each bucket alone, the available-plus-unavailable union, and the no-filter default |
| bucket skip | 1 | a disabled row the `installed` filter excludes is skipped, not rendered as an empty section |
| absence reason | 1 | an installed record the manifest omits forwards `not in manifest` |
| no-plugins body | 1 | a marketplace declaring none renders the header plus `(no plugins)` |
| narrowing | 3 | marketplace, scope, and marketplace-within-scope, including the not-found surface |
| orphan fold | 1 | a row whose own scope differs from its marketplace block's scope |
| load failure | 1 | an unreadable state record surfaces `isError: true` with the whole message |
| empty state | 2 | both tools report `No marketplaces configured.` |

Every rendered payload is compared as **one whole value** with `assert.deepStrictEqual` against a
hand-authored literal — content array, text, `isError`, and `details` together. No expected value is
produced by calling the production renderer.

### Registration capture

`ExtensionAPI` declares `registerTool` as a **generic method**, and a method may not be read as a
value: `when(() => pi.registerTool)` is an `@typescript-eslint/unbound-method` error. The mock is
therefore typed

```ts
type ToolRegistrar = Omit<ExtensionAPI, "registerTool"> & {
  readonly registerTool: (tool: ToolRegistration) => void;
};
```

which is still what both registration functions accept. The definition type is derived, not
hand-written:

```ts
type ToolRegistration = Omit<
  Parameters<ExtensionAPI["registerTool"]>[0],
  "renderCall" | "renderResult"
>;
```

Those two optional custom renderers are the only members a definition instantiated at a concrete
schema cannot widen into the uninstantiated form (`TS2379` on `renderCall`); both tools leave them
undeclared, and the omission is what keeps the capture derived from the production parameter type.

## D-116-14: the four plants

All four run against the unmodified module, each arm deleted, `npm run typecheck` run, output
recorded verbatim, and the file restored from a saved copy with `git diff --quiet -- extensions/`
confirming the revert.

**Plant 1 — `projectRowStatus`, returns `ToolPluginStatus` (`"installed" | "available" |
"unavailable"`).** Deleted `case "available": return "available";`.

```text
extensions/pi-claude-marketplace/edge/handlers/tools.ts(160,80): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

**Plant 2 — `statusLabel`, returns `string`.** Deleted `case "available": return "[available]";`.

```text
extensions/pi-claude-marketplace/edge/handlers/tools.ts(209,49): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

**Plant 3 — `statusKey`, returns `"i" | "a" | "u"`.** Deleted `case "available": return "a";`.

```text
extensions/pi-claude-marketplace/edge/handlers/tools.ts(252,47): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

**Plant 4 — `pluginVersion`, returns `string | undefined`.** Deleted the `case "updated": return
p.to;` arm. RESEARCH predicted this would compile clean. It does not:

```text
extensions/pi-claude-marketplace/edge/handlers/tools.ts(366,55): error TS7030: Not all code paths return a value.
```

**All four switches are gated** — three by `TS2366` because their return type excludes `undefined`,
and the fourth by `TS7030` because `noImplicitReturns` (`tsconfig.json:11`) makes the end of a
`default`-less switch reachable the moment an arm goes missing. The plan's correction to research
holds under this repository's own settings.

## The production change

**Licensed edit.** `pluginVersion` declared `(p: PluginNotificationMessage)`, but its only call
site iterates `mp.plugins` off `loadPluginListPayload`'s return value, whose `plugins` slot is
already the orchestrator's own list-surface row union. The parameter now carries that type,
**derived from the producer in one expression** rather than named by import or hand-written as an
exclusion list:

```ts
type ToolPluginRow = Awaited<ReturnType<typeof loadPluginListPayload>>[number]["plugins"][number];
```

The compiler then rejected, and this plan removed:

- the `case "updated":` arm with its own `return p.to;` body (3 lines plus its comment);
- the four pending arms `will install` / `will uninstall` / `will enable` / `will disable` with
  their own `return undefined;` body (5 lines plus its comment);
- the bare labels `reinstalled`, `uninstalled`, `skipped`, and `manual recovery` inside the shared
  `return p.version;` group (4 lines, no coverage or behavior effect — they shared a covered
  block).

Those first two bodies are exactly the regions `392-394` and `399-401` that the baseline reported
uncovered.

**No call site changed. The answer is none.** The loop variable already had the narrowed type, so
the narrowing made the producer's existing guarantee visible; no assertion function was added, no
cast and no non-null assertion appears in the diff.

**Control — the deletions were forced, not chosen.** Re-adding one removed arm to the narrowed
switch:

```text
extensions/pi-claude-marketplace/edge/handlers/tools.ts(392,10): error TS2678: Type '"updated"' is not comparable to type '"installed" | "available" | "unavailable" | "upgradable" | "failed" | "disabled" | "partially-installed" | "partially-upgradable" | "partially-available" | "remote"'.
```

That union is also the measured answer to which statuses the list surface can emit: ten, including
`failed` (the synthetic list-failure row is part of `ListMsg`), which is why the `failed` arm stays.

**Step 4 re-plant.** Deleting the reachable `failed` arm from the restructured switch, at the final
state of the file:

```text
extensions/pi-claude-marketplace/edge/handlers/tools.ts(381,43): error TS7030: Not all code paths return a value.
```

The gate survived the restructure. The switch now computes nothing — every arm returns
`p.version` — so its comment says that its only remaining job is the missing-arm gate, cites
`D-116-14`, and says it must not be collapsed into a single expression.

**Behavior parity.** The nine version-parity cases were written and **passing against the
unmodified module** before Task 2 touched the type, and re-run **unedited** afterwards with
`git diff --stat -- tests/` empty. All nine still pass, which is what makes them a parity proof
rather than a restatement of the new code.

## Deviations from plan

### 1. A second production edit: the non-Error narrowing moved to its owner

**Found during:** Task 2, Step 4 coverage measurement.

**Issue.** After the licensed narrowing the pair measured `branches 101/102, lines 513/513,
functions 16/16` — one residual branch, `BRDA:486,97,0`, the `String(err)` side of

```ts
text: `Failed to load plugin list: ${err instanceof Error ? err.message : String(err)}`,
```

Nothing the tool can reach throws a non-`Error`: the payload loader's whole failure surface is
`state.json` read and validation errors, every one of them an `Error` subclass. The branch is
unreachable through this module's exports. The plan's `<verify>` fails on **any** incomplete
verdict and its prohibitions bar a coverage pragma, so 101/102 could not simply be reported.

**Why the branch cannot be deleted in place.** `err` is `unknown` in a `catch`. Keeping only
`err.message` needs a cast (barred by the phase's anti-pattern grep) and keeping only `String(err)`
changes the message on the *reachable* path from `boom` to `Error: boom`.

**Fix.** Call `shared/errors.ts`'s `errorMessage(err)`, whose body is
`err instanceof Error ? err.message : String(err)` — byte-identical logic, no cast, no behavior
change, and the pair-rule remedy of removing a locally unreachable branch rather than excepting it.
`tests/shared/errors.test.ts` owns and covers both of its sides (`returns an Error message`,
`stringifies a non-Error value`), so the branch is proven where it lives instead of being moved to
a hole. `edge → shared` is an allowed import in both the ESLint and fallow boundary rules, and
`tools.ts` already imports from `shared/notify.ts`.

**Verification.** `Direct coverage passed: … (branches 101/101, functions 16/16, lines 513/513)`.
The load-failure case still asserts the whole message as one value, unchanged.

**Commit:** `4b273a00`.

This is recorded prominently because the plan's success criteria say the only production change in
the phase is the parameter type and the arms the compiler removed. The phase's own artifacts list
already names 116-27 as a plan that deletes a branch unreachable through the module exports; this
is a second instance of that same move, found only by measuring.

### 2. The refusal rows assert a whole message, not structured fields

**Found during:** Task 1.

The plan asked for the unreachable statuses to be asserted "by error class and structured fields,
never by message substring". `projectRowStatus` throws a plain `new Error(...)` — there are no
structured fields to assert, and adding a typed error class would be a production edit this plan is
not licensed to make. The ten rows therefore assert `instanceof Error`, the exact `name`, and the
**whole** message compared as one value. A whole-value equality is not the substring match the rule
bars, and it is the strongest assertion the existing error shape allows.

### 3. The shared notification boundary was not used

**Found during:** Task 1.

`createNotificationBoundary` returns a `mock<ExtensionAPI>`, and `registerTool` is declared there as
a generic method; reading it as a value to install the recorder is an
`@typescript-eslint/unbound-method` error (measured — the rule does not fire on
`pi.getAllTools()`, which every other suite *calls*, and does not fire on the helper's own
`ui.notify`, which the helper restates as a property). The tools also neither notify nor probe, so
`createNotificationBoundary(0, 0)` would have stated nothing this file needs. Both mocks are built
in-file with the same discipline. `tests/helpers/notification-boundary.ts` is unchanged, and the
plan's pin on it holds.

### 4. Two statuses are unreachable through the tool (named, as the plan asked)

**Found during:** Task 1, while building the version table.

The plan asked which statuses the seeded tree could and could not produce. Measured: a seeded tree
can produce `installed`, `upgradable`, `partially-installed`, `partially-upgradable`, `disabled`,
`available`, `partially-available`, `unavailable`, and `remote` from `loadPluginListPayload`
directly — but **`partially-available` and `remote` never reach the tool**. With no filter set the
tool computes `{i: true, a: true, u: true}` and forwards `installed`, `available` and `unavailable`
to the orchestrator, which is *not* the orchestrator's passive state; `shouldShow` admits the
`partially-available` bucket only under `--partial` and the `remote` bucket only under `--remote`,
and the tool has no parameter for either. Their projection arms are therefore proven through the
exported `projectRowStatus` alone, and the version table covers the **seven** statuses the tool can
actually render. `failed` never reaches the projection either: the list surface emits it only from
`listPlugins`'s own catch, in a synthetic marketplace block that `loadPluginListPayload` does not
return.

### 5. One case added beyond the plan

**Found during:** Task 2, closing the branch gap.

`forwards the absence reason of an installed record the manifest omits` was added: it is the only
shape that reaches the true side of `pluginReasons`'s optional-`reasons` guard
(`p.reasons !== undefined && p.reasons.length > 0`), because every other seeded installed row is
manifest-declared and carries no `reasons` field at all. It closed two of the three residual
branches.

**Total deviations:** 5 — 1 production fix (Rule 2, a branch unreachable through the module's own
surface, removed rather than excepted), 4 recorded narrowings or additions to the plan's own
instructions. **Impact:** the plan's stated goal is met exactly; two of its instructions could not
be executed as literally written and were narrowed, and one extra edit was required to reach the
coverage bar it set.

## Additional plants

Two beyond the four the plan named, both RED, both reverted.

**Plant A — drop a status from the projection table.** Removed
`{ status: "disabled", bucket: "unavailable" }` from `projectedStatuses`:

```text
tests/edge/handlers/tools.test.ts(366,12): error TS1360: Type '{}' does not satisfy the expected type 'Record<"disabled", never>'.
  Property 'disabled' is missing in type '{}' but required in type 'Record<"disabled", never>'.
```

The completeness check fires. Without it, a status silently dropped from the table would leave the
projection untested and every gate green.

**Plant B — overstate the `ctx.cwd` reads.** Raised one case's `reads` from 1 to 2:

```text
✖ reports no marketplaces configured when neither scope holds a record
ℹ tests 46 / pass 45 / fail 1
```

The exact-count promise fires, and fires only on the case that was changed.

## Gate results

Run separately, each exit code checked; `npm run check` was **not** used, because its
`format:check` link fails on the operator's pre-existing untracked files and short-circuits before
the tests run.

| Gate | Result |
| --- | --- |
| `node --test tests/edge/handlers/tools.test.ts` | 47/47, fail 0 |
| `npm run test:coverage:direct -- …/tools.ts` | `Direct coverage passed … (branches 101/101, functions 16/16, lines 513/513)` |
| `npm run typecheck` | exit 0 |
| `npm run lint` / `eslint` on both files | exit 0 |
| `prettier --check` on both files | exit 0 |
| `npm run fallow` | exit 0 (dead-code, health, dupes) |
| `npm test` | 4964/4964 across 283 suites, exit 0 |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan | no match |
| `rg -c '^\s+// arrange$'` | 18 |
| `git diff --check` | clean |
| pinned files unchanged (`shared.ts` ×3, `flag-catalog.ts`, `notification-boundary.ts`) | `git diff --quiet` exit 0 |
| trufflehog filesystem scan | 6 chunks, 71297 bytes, 0 verified, 0 unverified |
| `pre-commit run --files …` | all hooks Passed |

## Issues Encountered

None outstanding. The one blocking measurement — the residual `String(err)` branch — is resolved
and recorded as Deviation 1.

## Next

Phase 116 wave 6 continues with 116-03 (`completions/data`) and 116-29 (`router`). The D-116-14
exhaustiveness obligation is now fully discharged and no later plan carries any part of it.

## Self-Check: PASSED

- `tests/edge/handlers/tools.test.ts` — FOUND
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` — FOUND
- commit `7ef34b4a` — FOUND
- commit `4b273a00` — FOUND
