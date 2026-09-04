---
phase: 116-edge-surface
plan: "18"
subsystem: testing
tags: [node-test, edge, plugin, info, offline, group-c, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-08's normative Group-C shape: boundary sized at one emission and zero probes with `cwd` omitted, both scopes seeded, whole-value comparison, `verifyBoundary()` last"
  - phase: 116-edge-surface
    provides: "116-02's `edge/args.ts` owner, which owns the tokenizer and the scope-value diagnostics this handler surfaces"
  - phase: 116-edge-surface
    provides: "116-06's `edge/flag-catalog.ts` owner, whose per-verb parse-set this handler consumes and this owner takes its accepted flag names from"
  - phase: 116-edge-surface
    provides: "116-23's `edge/handlers/plugin/shared.ts` owner, which owns the prelude and the reference split this handler calls"
provides:
  - "tests/edge/handlers/plugin/info.test.ts — the sole mirrored direct owner for edge/handlers/plugin/info.ts, at 100 percent direct branches, functions, and lines"
  - "a FIFTH parser/arity/flag combination, and the FIRST module in the phase where BOTH halves of the arity truth hold: `parseArgs` through the prelude plus the handler's own exact-count guard rejects zero, two and three positionals with one sentence"
  - "the NINTH distinct `--local` outcome in this phase, and the SECOND time the inherited mutually-exclusive-selector rejection truth has held: `--scope user --local` is rejected as `Unknown flag: \"--local\".`"
  - "the measured finding that the phase's inherited SC-4 offline proof is UNFALSIFIABLE as written — the watched door is wrong (isomorphic-git reaches the wire through `simple-get`/`https.request`, never `globalThis.fetch`) AND the fixture is wrong (a path-source plugin never reaches the transport with or without the flag)"
  - "the falsifiable replacement: a cold git-source plugin on a closed loopback port with `https.request` counted, where the flag-absent row records 0 and the same reference with the flag records 2"
  - "the measured NINTH and TENTH diagnostic sites for the Group-C negative: persistence/locations.ts:145 via orchestrators/plugin/info.ts:2257 when `ctx.cwd` is forwarded, and orchestrators/plugin/info.ts:2306 with a literal working directory"
  - "the measured limit that `fetch: false` and an omitted `fetch` member are indistinguishable, because `getInfoFetchContext` tests `opts.fetch !== true`"
affects: []

actuals:
  tokens: 9300
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Group-C negative delegation: `createNotificationBoundary(1, 0)` with the `cwd` parameter OMITTED and both scopes seeded with the SAME marketplace and the SAME plugins at different versions, so a projection from the wrong scope is readable off the single emission"
    - "Delegating cases size the boundary at `(1, 2, { value: cwd, reads: 1 })`. Every count was measured against the real module through a counting context before a line of the suite was written"
    - "A falsifiable offline proof needs BOTH the door the transport actually opens and a fixture where the flag flips the count. Here: `t.mock.method(https, \"request\", …)` as a fail-fast counter, and a git-source plugin with no clone, whose flag-supplied sibling reaches the door"
    - "The accepted flag NAMES are taken from `parseFlagNames(\"info\")` and joined into the argument string, so a catalog rename follows the catalog; every EXPECTED value stays a hand-authored literal, and the catalog contents stay owned by tests/architecture/flag-catalog-drift.test.ts"
    - "The two scope roots are values this file chose — `<cwd>/.pi` and `<HOME>/.pi/agent` with the agent-directory variable DELETED rather than overwritten — so the projection's scope bracket is a measurement, not a reading of the path the workflow computed"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/info.test.ts

key-decisions:
  - "MEASURED FINDING — a FIFTH parser/arity/flag combination. This module reaches `parseArgs` through `withParsedArgs` and never calls `extractLocalFlag`, then applies its OWN `nonFlagPositionals.length !== 1` guard. Both halves of the arity truth HOLD, for the first time in the phase: zero positionals IS rejected and two or three ARE rejected, all with the single sentence `info requires exactly one <plugin>@<marketplace> argument.`. Four rows drive it (none, the accepted flags alone, two references, three references); the accepted-flags-alone row additionally proves the flag scan removes its tokens before the count is taken. Plant B (the exact comparison weakened to a lower bound) turns exactly the two- and three-reference rows RED"
  - "MEASURED FINDING — `--scope user --local` is REJECTED here, as `Unknown flag: \"--local\".`. The scope-target flag reaches `parseArgs` as an ordinary token, lands on `positional`, and the handler's own `startsWith(\"--\")` scan claims it before the arity guard. That is the NINTH distinct `--local` outcome measured in this phase and the SECOND time the inherited mutually-exclusive-selector rejection truth has held. Measured on this module before the case was written"
  - "DEVIATION — the plan's action text says of the mutually-exclusive selectors that 'this handler runs no flag scan'. It does: the scan at info.ts:37-49 is the handler's own, and it is what claims the token. The case was written from the measurement and lives as the fourth row of the unknown-flag table"
  - "MEASURED FINDING, the one worth carrying — the inherited SC-4 offline proof is UNFALSIFIABLE as written, on TWO independent counts. The precedent (`tests/orchestrators/edge-deps.test.ts`) watches `globalThis.fetch`, but `isomorphic-git/http/node` reaches the wire through `simple-get`, which calls `https.request`; `globalThis.fetch` has exactly one production caller in this repo (`domain/github-auth.ts`'s device flow), so a global-fetch spy records zero here whatever the handler does. And a PATH-source fixture never reaches the transport with or without the flag, so a zero asserted over one is vacuous even with the right door. The proof is asserted on the one fixture where it can fail — a cold git-source plugin on a closed loopback port, with `https.request` replaced by a fail-fast counter"
  - "The offline assertion is therefore made ONCE, on the git-source flag-absent case, not on all four delegating cases. Plant C is the measurement that justifies the narrowing: an unconditional `fetch: true` spread turns exactly that case RED — on the emitted row (a `{unreadable}` reason token appears) and, with the row assertion temporarily lifted, on the count as `2 !== 0` — while all three path-source delegating cases stay GREEN. A zero asserted on those three would have passed whether or not the flag reached the workflow"
  - "The offline assertion is also NOT made on the rejecting cases, though their arguments omit the flag. With `cwd` unstated, a workflow that ran dies before it could reach any transport, so `verifyBoundary()` already carries that half; a network count there could not fail without the case having failed first"
  - "DEVIATION — the plan's 'the member is absent from the workflow options, not present as false' is NOT observable. `getInfoFetchContext` (orchestrators/plugin/info.ts:161) tests `opts.fetch !== true`, so an explicit `false` and an omitted member take the same arm. What IS observable is supplied versus omitted, and that is what the pair asserts: the same git-source reference renders `(remote)` with the flag absent and `(remote) {unreadable}` with it supplied, and the network count moves 0 → 2"
  - "The position-independence pair (the accepted flags driven before and after the reference) asserts the identical outcome, which is the tautology template 116-11 was caught by — so it is kept only because a plant SEPARATES the two rows. Plant E (the flag scan stopped at the first non-flag token) turns the flag-AFTER row RED and leaves the flag-BEFORE row GREEN. The same plant separates the two unknown-flag rows for the same reason"
  - "No on-disk footprint is asserted beside `verifyBoundary()`. `getPluginInfo` is a read-only projection over state and on-disk manifests and persists nothing, so an unchanged-tree assertion would pass whether or not the workflow ran — 116-16's finding, and 116-08's note 5 scopes that addition to owners whose workflow writes something"
  - "No D-116-01a claim. The pair reaches 100 percent — branches 17/17, functions 2/2, lines 79/79 — the same reading as the baseline, so the plan's T-116-18-B risk (an outcome-thin rewrite dropping a branch the old suite covered incidentally) did not occur. The `positional === undefined` disjunct at info.ts:52 cannot be true when it is evaluated (it is only reached with `length === 1`, and `noUncheckedIndexedAccess` is what forces it to be written), but V8 reports no shortfall for it, so there is nothing to pin. Nothing was filed in `.planning/WINDOWS.md`"
  - "`roadmap.update-plan-progress` was NOT run: every prior plan in this phase reported that it mangles ROADMAP.md. The checkbox and BOTH counts (the `**Plans**:` prose line and the progress-table row) were edited by hand and verified with `grep -c '^- \\[x\\] \\*\\*116-'`, which reads 24. `state.advance-plan`, `state.update-progress` and `state.record-metric` were likewise not run — STATE.md was hand-edited so the Current Position keeps NAMING the completed plans and `completed_plans` moves 198 → 199 exactly once. `MOD-09` stays `Pending`; it is shared by every plan in this phase and closes at phase end"
  - "No production file was touched. Six plants were applied to `edge/handlers/plugin/info.ts` and reverted from a byte copy taken before the first plant; the file's md5 is identical to that copy, `git diff --stat -- extensions/` is empty, and the plan's pinned-path check exited 0 before staging"

patterns-established:
  - "An offline proof has TWO independent ways to be vacuous, and both must be measured: the DOOR (spy on what the transport actually calls — here `https.request`, not `globalThis.fetch`) and the FIXTURE (a source the workflow could reach the network for — here a git source with no clone, not a path source). Assert the zero only where a plant can make it non-zero, and record which plant does"
  - "Before keeping an assert-the-identical-outcome pair, find the plant that separates its rows. If none exists, the pair is one case run twice"
  - "A read-only surface named in `tests/architecture/no-orchestrator-network.test.ts` is still worth a runtime offline case when it has an opt-in warm-up flag. The gate proves the module NAMES no git surface; it does not prove the flag-absent path opens no connection, because the warm-up reaches git through an injected seam the gate cannot see"
  - "Read the orchestrator's error handling before predicting the negative's diagnostic. `getPluginInfo` runs no catch around its scope fan-out, so a forwarded unstated `cwd` escapes as `ERR_INVALID_ARG_TYPE`; a literal working directory instead lets the projection finish and the boundary refuses its emission"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/plugin/info.test.ts owns edge/handlers/plugin/info.ts: the flag scan, the exact-count guard, the reference split, and the delegation"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/info.test.ts — 18 runtime cases from 7 marked bodies, pass 18 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- .../plugin/info.ts → branches 17/17, functions 2/2, lines 79/79 (baseline 17/17, 2/2, 79/79)"
        status: pass
  - deliverable: "The accepted arity is exactly one reference; zero, two and three are all rejected before any workflow call"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/info.test.ts#rejects two references with the exactly-one-argument sentence (MSG-NC-2)"
        status: pass
      - kind: command
        ref: "Plant B — the exact comparison weakened to a lower bound; exactly the two- and three-reference rows RED, falling through to a real getPluginInfo call"
        status: pass
  - deliverable: "The catalog-accepted flags are honored wherever they appear, and the accepted-set check runs before the unknown-flag rejection"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant A — the accepted-set membership test moved after the unknown-flag rejection; 4 cases RED, each reporting Unknown flag: \"--fetch\""
        status: pass
      - kind: command
        ref: "Plant E — the flag scan stopped at the first non-flag token; the flag-after row and both after-a-token unknown-flag rows RED, the flag-before and flag-alone rows green"
        status: pass
  - deliverable: "The scope member reaches the workflow only when supplied, observed as which scope the projection came from"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant D — the conditional scope spread deleted; both scope rows RED, each widening back to a both-scope projection"
        status: pass
  - deliverable: "NFR-5, scoped: no network connection is opened while the fetch flag is absent"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/info.test.ts#reads a git-source plugin from disk alone while the fetch flag is absent, opening no network connection (NFR-5)"
        status: pass
      - kind: command
        ref: "Plant C — an unconditional fetch spread; exactly that case RED on the row, and RED as `2 !== 0` on the count with the row assertion lifted; all three path-source delegating cases GREEN"
        status: pass
  - deliverable: "The D-116-06 negative: the info workflow is proven unreached on every rejection channel"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant F1 — fall through to a real getPluginInfo call forwarding ctx.cwd; all 4 unknown-flag rows RED with ERR_INVALID_ARG_TYPE at persistence/locations.ts:145 via orchestrators/plugin/info.ts:2257"
        status: pass
      - kind: command
        ref: "Plant F2 — the same fall-through with a literal working directory; all 4 rows RED with ctx.ui.notify is not a function at orchestrators/plugin/info.ts:2306"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over info.ts, the three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass

duration: 45 min
completed: 2026-09-02
---

# Phase 116 Plan 18: Plugin Info Owner Summary

The plugin info shim now has one exhaustive owner at 100 percent direct coverage, with an offline
claim that is scoped to the warm-up flag being absent **and** measured on the one fixture where it
can fail.

## What was built

`tests/edge/handlers/plugin/info.test.ts` was rewritten from eleven loose cases built on a
hand-rolled context cast into **eighteen runtime cases from seven marked bodies**, flat at the top
level (one export), all on the shared strict boundary.

| Marked body | Args | Rows | Boundary sizing | Proves |
|-------------|------|------|-----------------|--------|
| scope projection | `alpha@mp`, `… --scope project`, `… --scope user` | 3 | `(1, 2, {cwd, reads: 1})` | the accepted arity of one reference delegates; the scope member is present only when supplied |
| offline, flag absent | `gitp@mp` | 1 | same | a cold git source resolves from disk and opens NO connection |
| warm-up consented | `--fetch gitp@mp`, `gitp@mp --fetch` | 2 | same | the accepted flags reach the workflow from either position |
| arity rejection | `""`, `--fetch`, two refs, three refs | 4 | `(1, 0)`, **no `cwd`** | every count other than one is rejected with one sentence |
| unknown long flag | `--bogus`, `alpha@mp --bogus`, `alpha@mp --fetch --bogus`, `--scope user --local` | 4 | `(1, 0)`, **no `cwd`** | the D-116-06 negative; the scan does not stop early; the scope-target flag is rejected |
| malformed reference | `no-at-sign`, `@mp`, `alpha@` | 3 | `(1, 0)`, **no `cwd`** | the offending token is named verbatim |
| unrecognised scope value | `alpha@mp --scope bogus` | 1 | `(1, 0)`, **no `cwd`** | the tokenizer's own sentence with the usage block appended |

Direct coverage held at **branches 17/17, functions 2/2, lines 79/79**, the same reading as the
baseline.

## Which parser this module calls, checked before any arity or flag claim

`makePluginInfoHandler` wraps `parseArgs` in `withParsedArgs` and never calls `extractLocalFlag`. It
then runs its own scan over the returned positionals — the catalog-accepted set first, then
`startsWith("--")` — followed by its own `nonFlagPositionals.length !== 1` guard. That is a **fifth**
combination:

| Question | This module | `parseCommandArgs` + optional | `parseCommandArgs` + required | `parseArgs` + own guards (`fetch`) |
|---|---|---|---|---|
| Zero positionals | **REJECTED** | accepted | rejected | accepted (it IS the all form) |
| Surplus positional | **REJECTED**, same sentence | dropped | dropped | rejected, own guard |
| `--scope X --local` | **REJECTED** as an unknown flag | four different answers | accepted, both honoured | rejected as an unknown flag |

Both halves of the arity truth hold here, for the **first time in the phase**. The `--local` answer
is the **ninth** distinct outcome measured across this phase's handlers, and the second time the
inherited mutually-exclusive-selector rejection truth has held.

## Measured boundary counts

Taken through a counting context before a case was written, because the two paths disagree:

| Path | `ctx.ui` | `ctx.cwd` | `pi.getAllTools()` | Sizing |
|---|---|---|---|---|
| rejection (`notifyUsageError`) | 1 | 0 | 0 | `(1, 0)` |
| delegation (`notify` cascade) | 1 | 1 | **2** | `(1, 2, {cwd, reads: 1})` |

## The offline proof, and why the inherited one could not fail

The phase's pattern map assigns this owner an SC-4 offline proof modelled on
`tests/orchestrators/edge-deps.test.ts`, which replaces `globalThis.fetch` and asserts its call count
is zero. Measured here, that proof is unfalsifiable on two independent counts:

1. **Wrong door.** `isomorphic-git/http/node` imports `simple-get`, which calls `https.request`.
   `globalThis.fetch` has exactly one production caller in this repository —
   `domain/github-auth.ts`'s device flow — so a global-fetch spy records zero on every git path
   whatever the handler does.
2. **Wrong fixture.** A path-source plugin never reaches the transport, with or without the flag. A
   zero asserted over one is vacuous even with the door corrected.

The replacement asserts the count on the one fixture that can fail: a plugin declared with the git
source `https://127.0.0.1:9/repo.git` and no clone on disk, with `https.request` replaced by a
fail-fast counter. With the flag absent the count is **0** and the row reads `(remote)`; with the
flag supplied the count is **2** (one materialize per scope) and the row reads `(remote)
{unreadable}`. Plant C is what proves the assertion discriminates, and the same plant proves the
narrowing was right: the three path-source delegating cases stay GREEN under it.

This is not a restatement of `tests/architecture/no-orchestrator-network.test.ts`, which names
`orchestrators/plugin/info.ts` in its forbidden-targets set. That gate proves the module NAMES no git
surface. It cannot prove the flag-absent path opens no connection, because the warm-up reaches git
through the injected clone-cache seam the gate does not look at.

## The Group-C negative, and two more diagnostic sites

`createNotificationBoundary(1, 0)` with `cwd` OMITTED, both scopes seeded with the same marketplace
and the same two plugins, the whole notification list compared, `verifyBoundary()` last. Both plant
variants were run and neither was promised in advance:

- **Forwarding `ctx.cwd`** dies at `persistence/locations.ts:145`, reached from
  `orchestrators/plugin/info.ts:2257` through `collectMarketplaceRecordsByScope`. `getPluginInfo`
  runs **no catch** around its scope fan-out, so the unstated-`cwd` failure escapes as
  `ERR_INVALID_ARG_TYPE`.
- **A literal working directory** runs the projection to completion and dies at
  `orchestrators/plugin/info.ts:2306` — the orchestrator's own `notify` is what the boundary refuses.

That is the **ninth and tenth** diagnostic site in this phase from the same omission. Omitting `cwd`
is the constant; the diagnostic is a property of the orchestrator.

**What is deliberately absent:** no on-disk footprint assertion beside `verifyBoundary()`. This
read-only projection persists nothing, so an unchanged-tree assertion would pass whether or not the
workflow ran.

## Plants (D-116-04)

Six plants, **all six RED**, all reverted. The production file's md5 is identical to the byte copy
taken before the first plant and `git diff --stat -- extensions/` is empty.

### Plant A — the accepted-set membership test moved after the unknown-flag rejection

```text
✖ consents to a git-source warm-up when the accepted flags are supplied before the reference (FTCH-03) (14.886769ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
    actual: [ { message: 'Unknown flag: "--fetch".\n\nUsage: /claude:plugin info <plugin>@<marketplace> [--fetch] [--scope user|project]', severity: 'error' } ],
    expected: [ { message: '● mp [project] <no autoupdate>\n  ◌ gitp v3.0.0 (remote) {unreadable}\n    components: not resolved\n\n● mp [user] <no autoupdate>\n  ◌ gitp v3.0.0 (remote) {unreadable}\n    components: not resolved' } ],
```

4 cases RED — both warm-up rows, the accepted-flags-alone arity row, and the unknown-flag-after-the-
accepted-flags row — each reporting the accepted flag as unknown.

### Plant B — the exact count comparison weakened to a lower bound

```text
✖ rejects two references with the exactly-one-argument sentence (MSG-NC-2) (13.375205ms)
  TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function
      at Object.join (node:path:1339:7)
      at locationsFor (.../persistence/locations.ts:145:61)
      at readScopeMarketplaceRecord (.../orchestrators/scope-fanout.ts:75:21)
      at collectMarketplaceRecordsByScope (.../orchestrators/scope-fanout.ts:62:23)
      at getPluginInfo (.../orchestrators/plugin/info.ts:2257:23)
      at .../edge/handlers/plugin/info.ts:69:11
```

Exactly the two- and three-reference rows RED, the zero-positional and accepted-flags-alone rows
green — so the guard is pinned at exactly one, not merely "at least one". The failure is itself a
Group-C negative firing: with the guard relaxed the case falls through to a real workflow call.

### Plant C — an unconditional fetch spread

```text
✖ reads a git-source plugin from disk alone while the fetch flag is absent, opening no network connection (NFR-5) (64.707645ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
    actual: [ { message: '● mp [project] <no autoupdate>\n  ◌ gitp v3.0.0 (remote) {unreadable}\n    components: not resolved\n\n● mp [user] <no autoupdate>\n  ◌ gitp v3.0.0 (remote) {unreadable}\n    components: not resolved' } ],
    expected: [ { message: '● mp [project] <no autoupdate>\n  ◌ gitp v3.0.0 (remote)\n    components: not resolved\n\n● mp [user] <no autoupdate>\n  ◌ gitp v3.0.0 (remote)\n    components: not resolved' } ],
```

Exactly one case RED. With the row assertion temporarily lifted so the count assertion could be
reached on its own, the same plant produces:

```text
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  2 !== 0

      at TestContext.<anonymous> (.../tests/edge/handlers/plugin/info.test.ts:249:10)
```

Both halves of the offline case are load-bearing. The three path-source delegating cases stayed
GREEN under this plant, which is the measurement behind the decision to assert the count once rather
than four times.

### Plant D — the conditional scope spread deleted

```text
✖ narrows the projection to the project scope when it is the supplied scope (INFO-02) (26.595929ms)
    actual: [ { message: '● mp [project] <no autoupdate>\n  ○ alpha v1.0.0 (available)\n\n● mp [user] <no autoupdate>\n  ○ alpha v2.0.0 (available)' } ],
    expected: [ { message: '● mp [project] <no autoupdate>\n  ○ alpha v1.0.0 (available)' } ],
```

Both scope rows RED, and the failure is exactly the projection widening back to both scopes — which
is what makes "present only when supplied" a measurement. The no-scope row is the widened form and
stays green.

### Plant E — the flag scan stopped at the first non-flag token

```text
✖ consents to a git-source warm-up when the accepted flags are supplied after the reference (FTCH-03) (15.151186ms)
    actual: [ { message: 'info requires exactly one <plugin>@<marketplace> argument.\n\nUsage: …', severity: 'error' } ],
    expected: [ { message: '● mp [project] <no autoupdate>\n  ◌ gitp v3.0.0 (remote) {unreadable}\n…' } ],
✖ names an unrecognised long flag supplied after a valid reference verbatim and never reaches the info workflow (D-116-06) (13.335497ms)
✖ names an unrecognised long flag supplied after the accepted flags verbatim and never reaches the info workflow (D-116-06) (13.759776ms)
```

3 cases RED. The flag-BEFORE row and the flag-alone unknown-flag row stay green, which is what makes
the position pair two cases rather than one case run twice.

### Plant F1 — negative fall-through forwarding `ctx.cwd`

```ts
        notifyUsageError(ctx, { message: `Unknown flag: "${token}".`, usage: USAGE });
        await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", cwd: ctx.cwd });
        return;
```

```text
✖ names an unrecognised long flag supplied as the only positional verbatim and never reaches the info workflow (D-116-06) (13.73598ms)
  TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function
      at Object.join (node:path:1339:7)
      at locationsFor (.../persistence/locations.ts:145:61)
      at readScopeMarketplaceRecord (.../orchestrators/scope-fanout.ts:75:21)
      at collectMarketplaceRecordsByScope (.../orchestrators/scope-fanout.ts:62:23)
      at getPluginInfo (.../orchestrators/plugin/info.ts:2257:23)
      at .../edge/handlers/plugin/info.ts:45:15
      at .../edge/handlers/plugin/shared.ts:199:11
```

All 4 unknown-flag rows RED.

### Plant F2 — the same fall-through with a literal working directory

```text
✖ names an unrecognised long flag supplied as the only positional verbatim and never reaches the info workflow (D-116-06) (17.89488ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at dispatchInfoMessage (.../shared/notify.ts:3723:3)
      at notify (.../shared/notify.ts:3752:5)
      at getPluginInfo (.../orchestrators/plugin/info.ts:2306:5)
      at async .../edge/handlers/plugin/info.ts:45:9
      at async .../edge/handlers/plugin/shared.ts:199:5
```

All 4 rows RED. The projection ran to completion and its own emission is what the boundary refused.

## Deviations from Plan

### 1. [Rule 1 — the offline proof as specified could not fail] the door and the fixture were both wrong

- **Found during:** Task 1, before a case was written.
- **Issue:** The plan asks for "a context-owned fail-fast network entry point" asserted at zero "in
  every case that omits the accepted boolean flag, including the delegating ones", modelled on
  `tests/orchestrators/edge-deps.test.ts`'s `globalThis.fetch` spy. Measured: the git transport goes
  through `simple-get` to `https.request` and never touches `globalThis.fetch`; and a path-source
  fixture never reaches the transport at all, with or without the flag.
- **Fix:** Watched `https.request` instead, and asserted the count on ONE case built on a cold
  git-source plugin, where a flag-supplied sibling does reach the door.
- **Verification:** Plant C turns that case RED (`2 !== 0`) and leaves the three path-source
  delegating cases GREEN — the measurement that separates a falsifiable zero from a vacuous one.
- **Commit:** `298e1d35`

### 2. [Rule 1 — a specified assertion is not observable] `fetch: false` and an omitted `fetch` are indistinguishable

- **Found during:** Task 1, reading `orchestrators/plugin/info.ts`.
- **Issue:** The plan asks the flag-omitted case to prove "the member is absent from the workflow
  options, not present as false". `getInfoFetchContext` tests `opts.fetch !== true`, so both take
  the same arm and no observable effect separates them.
- **Fix:** Wrote the case as supplied versus omitted, which the git-source fixture does separate —
  `(remote)` against `(remote) {unreadable}`, and a network count of 0 against 2.
- **Commit:** `298e1d35`

### 3. [Rule 1 — false premise in the plan's action text] this handler DOES run a flag scan

- **Found during:** Task 1.
- **Issue:** The plan says of the mutually-exclusive scope selectors that "this handler runs no flag
  scan, so read the module and state where the scope-target token lands". The scan at
  `info.ts:37-49` is the handler's own, and it is what claims `--local`.
- **Fix:** Measured the outcome (`Unknown flag: "--local".`) and wrote it as the fourth row of the
  unknown-flag table, labelled as the scope-target flag supplied beside a scope flag.
- **Commit:** `298e1d35`

### 4. [Scope narrowing] the offline assertion is made once, not on every flag-absent case

- **Found during:** Task 1, after Plant C.
- **Issue:** The plan's wording covers the rejecting cases too. On a rejection the boundary states no
  `cwd`, so a workflow that ran dies before reaching any transport — a network count there cannot
  fail unless `verifyBoundary()` already has.
- **Fix:** Asserted the count only where a plant can move it, and recorded the reason in the file
  header and above.
- **Commit:** `298e1d35`

### 5. [Scope narrowing] one arity body instead of two, one malformed-reference body instead of three

- **Found during:** Task 1, case selection.
- **Issue:** The plan lists "one below" and "one above" as separate cases. Measured, both counts hit
  the same guard and produce the same sentence, so two bodies would be one body written twice.
- **Fix:** One four-row table (none, the accepted flags alone, two references, three references),
  with Plant B separating the surplus rows from the zero row. The accepted-flags-alone row is the
  extra fact the plan did not ask for: the flag scan removes its tokens before the count is taken.
- **Commit:** `298e1d35`

**Total deviations:** 5 (1 specified proof rebuilt to be falsifiable, 1 specified assertion measured
not to be observable, 1 false premise corrected, 2 sets of cases narrowed). **Impact:** the owner
asserts only what the module can falsify. No claim was weakened to go green; the offline claim was
made stronger by being asserted in one place that can fail instead of four that cannot.

## Scoped gap (D-116-05, O3, Group C)

`getPluginInfo` is reached by direct import with no injection point, so this owner cannot state an
exact argument list against it. Delegation is observed as one minimal effect — the single emission
naming the seeded plugin, its version, and the scope it was projected from. This exact-argument gap
is recorded in the plan's `must_haves` truth 6 and is **scoped, not missed**. The negative half of
D-116-06 is proven in full, on every rejection channel, with both plant variants.

## Verification

Every gate run separately, exit code checked individually. `npm run check` was NOT used (its
`format:check` link short-circuits on pre-existing untracked operator files).

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/plugin/info.test.ts` | tests 18, pass 18, fail 0 |
| `npm run test:coverage:direct -- .../plugin/info.ts` | branches 17/17, functions 2/2, lines 79/79 |
| `npm run typecheck` | exit 0 |
| `npm run lint` (whole repo) | exit 0 |
| `npm exec -- eslint <file>` | exit 0 |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | **5077/5077 across 293 suites**, exit 0 (read from the runner's `ℹ tests` line) |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan (`! rg …`) | no matches |
| `rg -c '^\s+// arrange$'` | 7 (equals the marked-body count) |
| `git diff --check` | clean |
| `git diff --quiet` over pinned production paths and the boundary helper | exit 0 |
| trufflehog filesystem scan | chunks 2, bytes 20481, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | exit 0, every applicable hook Passed |

## Note to the five remaining Group-C owners

1. Read which parser your module calls FIRST. Five combinations now exist. This one is the first
   where BOTH halves of the arity truth hold.
2. If your plan asks for an offline proof, measure the DOOR and the FIXTURE before writing it. A
   `globalThis.fetch` spy cannot see this repository's git transport, and a path-source fixture
   cannot reach any transport.
3. Assert a zero only where a plant can make it non-zero. Record the plant that does, and record
   which cases stayed green under it.
4. If your workflow persists nothing, do NOT add an empty-footprint assertion beside
   `verifyBoundary()`.
5. Before keeping an assert-the-identical-outcome pair, find the plant that separates its rows.

## Issues Encountered

None.

## Next Phase Readiness

Ready for the next wave-5 owner. 116-19, 116-20, 116-21, 116-22, 116-24 and 116-25 remain, then
116-28. **116-21 is still the outstanding D-116-01a claimant and must pin `plugin/pending.ts:39`.**

## Self-Check: PASSED

- `tests/edge/handlers/plugin/info.test.ts` exists on disk.
- `git log --oneline --all | grep 298e1d35` returns the task commit.
- All plan `<verify>` links re-run at close-out; every one passed.
- `git diff --stat -- extensions/` is empty; no production file changed.
