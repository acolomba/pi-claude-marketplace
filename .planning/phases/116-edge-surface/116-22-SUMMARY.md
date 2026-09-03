---
phase: 116-edge-surface
plan: "22"
subsystem: testing
tags: [node-test, edge, plugin, reinstall, group-c, two-stage-rejection, offline, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-02's `edge/args.ts` owner, which owns the tokenizer and the scope-value diagnostics this owner does not restate"
  - phase: 116-edge-surface
    provides: "116-08's normative Group-C no-seam negative-delegation shape"
  - phase: 116-edge-surface
    provides: "116-23's `edge/handlers/plugin/shared.ts` owner, which owns the reference split this handler calls"
  - phase: 116-edge-surface
    provides: "116-26's `edge/handlers/shared.ts` owner, which owns the shared unknown-flag rule this handler's first rejection stage delegates to"
provides:
  - "tests/edge/handlers/plugin/reinstall.test.ts — the sole mirrored direct owner for edge/handlers/plugin/reinstall.ts, at 100 percent direct functions, lines AND branches"
  - "the MEASURED reachability of the second rejection stage: `reinstall.ts:50-51` is reached by a QUOTED long flag, not unreachable. Three distinct quoted shapes drive it, and the plan's unreachability fallback did not fire"
  - "a THIRTEENTH distinct `--local` outcome: ACCEPTED, and observable as the config LAYER the write-back lands in rather than as anything in the notification"
  - "a SEVENTH parser/arity/flag combination: `parseArgs` behind `extractLocalFlag` plus the handler's own `> 1` guard — ZERO and ONE positional both accepted, TWO rejected"
  - "a SEVENTH Group-C negative-delegation diagnostic pair, and the second module (after 116-20) where the SCOPE does NOT discriminate the plant"
  - "the fourth acceptance of mutually exclusive scope selectors, so that inherited truth is again FALSE against the real module"

affects: []

actuals:
  tokens: 34000
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "A two-stage rejection is proven distinct by a plant that MOVES a token from one stage to the other: putting the offending flag into the shared scanner's pass-through list makes the stage-one row emit the stage-TWO sentence. Neither family alone proves anything but 'something rejected'"
    - "Delegation for a state-changing seamless handler is observed as the SET of artifact names each scope root carries afterwards. Give every seeded plugin a differently named artifact, and a command that reached the wrong target form materialises the wrong NAME rather than merely materialising nothing"
    - "The scope-target flag is a config-LAYER discriminator, not a message discriminator: the notification is byte-identical with and without it, and only the base-versus-override layer separates them"
    - "Boundary sizing per row: a rejection is `(1, 0)` with NO stated `cwd`, a delegating command is `(1, 2, {cwd, reads: 1})`. Both counts held across every target form, scope and flag combination measured"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/reinstall.test.ts

key-decisions:
  - "MEASURED — the second rejection stage IS REACHABLE, so the plan's 'report the branch as unreachable' fallback did not fire. The mechanism is exactly the one the plan hypothesised. `extractLocalFlag` splits on `/\\s+/` and reads RAW characters, while `parseArgs`'s tokenizer STRIPS quote characters, so a quoted long flag passes stage one as an ordinary word and is reassembled into a long-flag-shaped token before the handler's own loop reads it. THREE distinct quoted shapes were measured and all three land in the second stage: `\"--frobnicate\"` (double quotes), `'--frobnicate'` (single quotes), and `\"--\"frobnicate` (only the prefix quoted, reassembled by the tokenizer's character accumulator). Direct coverage moved from branches 24/25, lines 98/100, uncovered 50-51 to branches 25/25, functions 3/3, lines 100/100 — no D-116-01a claim exists for this pair"
  - "MEASURED — the two stages emit DIFFERENT sentences and neither family can satisfy the other. Stage one, the shared scanner called with an EMPTY pass-through list, emits `Unknown flag: \"<token>\".`; stage two, the handler's own positional loop, emits `Unknown option: \"<token>\".` Both are hand-authored here. Plant B is the discriminating proof in one direction (moving `--frobnicate` into the pass-through list makes the three stage-ONE rows emit the stage-TWO sentence) and Plant C in the other (deleting the stage-two branch makes the four stage-TWO rows emit `Invalid <plugin>@<marketplace> ref: \"--frobnicate\".` while every stage-one row stays GREEN)"
  - "MEASURED — a SEVENTH parser/arity/flag combination: `parseArgs` behind `extractLocalFlag`, then the handler's own `refs.length > 1` guard. ZERO positionals AND ONE positional are BOTH accepted (zero is the all form, one is the marketplace or plugin form), and TWO is rejected with `Too many arguments.` So the surplus half of the arity `must_haves` truth HOLDS, and the 'one below the accepted arity' half has NO TARGET — there is nothing below zero. That truth's lower half is now false or targetless for a fifteenth consecutive plan"
  - "MEASURED — `--local` is ACCEPTED. It reaches `extractLocalFlag` directly, which consumes it and strips it from the residual, so it never reaches the positional loop. That is the THIRTEENTH distinct `--local` outcome in this phase. It DISCRIMINATES, but not in the notification: the emission is byte-identical with and without it, and the only observable difference is that the write-back lands in `claude-plugins.local.json` instead of `claude-plugins.json`. A suite that compared only messages would have called the flag inert"
  - "MEASURED — the inherited truth 'mutually exclusive scope flags supplied together are rejected before any orchestrator call' is FALSE against this module, the fourth acceptance in the phase. `--scope user --local` runs to completion and honours BOTH selectors: only the user scope is re-materialised, and its OVERRIDE layer takes the write-back. The case asserts that combined outcome instead of a rejection"
  - "MEASURED — the Group-C negative fires, and the SCOPE does NOT discriminate it. This is 116-20's exception rather than 116-19's rule. Plant D deleted the `return` after the too-many-arguments emission so a rejection path falls through to the workflow. With the working directory UNSTATED, all four surplus rows died identically — `TypeError: ctx.ui.notify is not a function` at `shared/notify.ts:3660`, routed through `handleEnumerationFailure` (`orchestrators/plugin/reinstall.ts:649`) which CATCHES the unstated-cwd `ERR_INVALID_ARG_TYPE` and re-emits, making a SECOND `ctx.ui` access past its `times(1)`. The `--scope user` and `--scope project` rows produced BYTE-IDENTICAL diagnostics. With the working directory STATED, the same plant died one frame later and on a different path: `renderReinstallPartitionAndNotify` (`orchestrators/plugin/reinstall.messaging.ts:199`) at `notify.ts:3658`, the workflow having run to completion. Both variants RED, both recorded after running rather than promised"
  - "SC-4 — the zero IS asserted, in all 28 cases, watching `https.request` and never `globalThis.fetch`. One case seeds a COLD git source (`https://127.0.0.1:9/far.git`) as the installed plugin, which is the input that would need the network to resolve any further; MEASURED, the no-network resolver answers first and the row renders `⊘ far (failed) {source mismatch}` offline with the counter at zero and nothing materialised. So the zero is not the all-path-source vacuity 116-18 found. But nothing in the reachable input space turns materialisation on — reinstall has no flag for it and the resolver rejects a cold source before `materializePluginClone` is ever reached — so there is NO positive control here, and the zero is an NFR-5 regression guard rather than a discriminated proof. Same conclusion as 116-20 and 116-21, reached through a fourth code path. The door itself was already proven instrumented by 116-21's out-of-suite control and is not re-derived"
  - "DEVIATION — the plan's `<action>` asks for the scope-target flag 'driven before and after the positional, asserting the identical outcome', which is the phase's known tautology template (116-11). Two things keep it falsifiable here and both were PLANTED rather than argued. The flag discriminates against its own omission through the config layer (Plant E: an unconditional `local: true` turns all seven base-layer rows RED). And position independence is a real claim: Plant F, honouring the scope-target flag only at index 0 of `extractLocalFlag`, turned exactly the two rows where it is NOT leading RED — `@mp --local` and `--scope user --local` — while `--local @mp` stayed GREEN. Plant G did the same for the scope flag in `parseArgs`, turning only `@mp --scope project` RED"
  - "No production file was touched. Seven plants were applied across three production files — `edge/handlers/plugin/reinstall.ts`, `edge/handlers/shared.ts` and `edge/args.ts` — all seven RED, each reverted from a byte copy taken beforehand. `shared.ts` SHA-1 `df479ac141765fb8fca26ba3ccb3378e2cc34255` and `args.ts` SHA-1 `0dd1b58731f4fe18b5b23760a9439d56bafc04da` were identical before the first plant and after the last revert; `git diff --quiet` over the five pinned production files and `tests/helpers/notification-boundary.ts` exits 0"

patterns-established:
  - "Prove a two-stage rejection by MOVING the offending token between stages, not by asserting that two sentences differ. A literal-versus-literal comparison of two hand-authored strings is a tautology; a plant that reroutes the same input from one stage to the other is not"
  - "Ask what a flag changes before deciding it is inert. The scope-target flag here leaves the notification byte-identical and only moves the config layer — a message-only suite would have missed it entirely"
  - "Run BOTH working-directory variants of a Group-C negative plant. Here they differ in the FRAME, not the message: unstated cwd dies inside the orchestrator's own enumeration catch, stated cwd dies at the final render one frame later"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/plugin/reinstall.test.ts owns edge/handlers/plugin/reinstall.ts at 100 percent direct functions, lines and branches"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/reinstall.test.ts — 28 runtime cases from 14 marked bodies, pass 28 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts → Direct coverage passed (branches 25/25, functions 3/3, lines 100/100); was branches 24/25, lines 98/100 with 50-51 uncovered"
        status: pass
  - deliverable: "The three target forms each touch only what they name"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/reinstall.test.ts#re-materialises only the named marketplace when a bare marketplace reference is supplied (RINST-01)"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/plugin/reinstall.test.ts#re-materialises only the named plugin when a plugin reference is supplied (RINST-01)"
        status: pass
      - kind: command
        ref: "Plant A — delete the leading-separator branch; 5 rows RED, the marketplace-form row receiving Invalid <plugin>@<marketplace> ref: \"@mp\"."
        status: pass
  - deliverable: "The two flag-rejection stages are distinct, and a stage-two case cannot be satisfied by stage one"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/reinstall.test.ts#reports an unrecognised long flag driven alone as an unknown FLAG and re-materialises nothing (D-116-06)"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/plugin/reinstall.test.ts#reports a quoted long flag wrapped in double quotes as an unknown OPTION and re-materialises nothing (D-116-06)"
        status: pass
      - kind: command
        ref: "Plant B — add --frobnicate to the shared scanner's pass-through list; exactly the 3 stage-ONE rows RED, each receiving Unknown option: \"--frobnicate\". in place of Unknown flag:"
        status: pass
      - kind: command
        ref: "Plant C — delete the stage-two branch; exactly the 4 stage-TWO rows RED, each receiving Invalid <plugin>@<marketplace> ref: \"--frobnicate\"., every stage-one row GREEN"
        status: pass
  - deliverable: "The retired overwrite flag now fails as an unknown flag"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/reinstall.test.ts#rejects the retired overwrite flag as an unknown flag rather than accepting it (RINST-01 / D-67-03)"
        status: pass
  - deliverable: "The D-116-06 negative: the reinstall workflow is proven unreached on every rejection channel"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant D — delete the return after the too-many-arguments emission; all 4 surplus rows RED in BOTH working-directory variants, at two different frames, recorded verbatim"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/plugin/reinstall.test.ts — 17 rejecting runtime cases, each sized (1, 0) with no stated cwd, each reading back NOTHING_REINSTALLED, each calling verifyBoundary()"
        status: pass
  - deliverable: "The scope and the scope-target flag each reach the workflow, position-independently"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant E — make the override layer unconditional; all 7 base-layer rows RED on projectBase/userBase moving to projectLocal/userLocal"
        status: pass
      - kind: command
        ref: "Plant F — honour the scope-target flag only at index 0; exactly the 2 non-leading rows RED, the leading row GREEN"
        status: pass
      - kind: command
        ref: "Plant G — honour the scope flag only at index 0; exactly the trailing-scope row RED"
        status: pass
  - deliverable: "This surface never reaches the network"
    human_judgment: true
    rationale: "Every case asserts the https.request call count is zero, and one case drives a cold git source through the no-network resolver so the assertion is not vacuous over the fixture. But no reinstall input turns the transport on — the resolver rejects a cold source before materialisation — so no positive control could be run. A human should read the SC-4 decision and accept the zero as an NFR-5 regression guard rather than a discriminated proof"
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/reinstall.test.ts — assert.strictEqual(workspace.transportCalls(), 0) in all 28 cases"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/plugin/reinstall.test.ts#answers a cold git source from the no-network resolver without opening a connection (NFR-5)"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over reinstall.ts, all three handler shared.ts files, flag-catalog.ts, and tests/helpers/notification-boundary.ts → exit 0; git status --short shows only the operator's pre-existing entries; shared.ts and args.ts SHA-1s identical before the first plant and after the last revert"
        status: pass

duration: 50 min
completed: 2026-09-03
---

# Phase 116 Plan 22: Plugin Reinstall Owner Summary

The reinstall shim now has one exhaustive, hermetic, offline-proven owner at 100 percent direct
coverage, and its two flag-rejection stages are proven distinct by plants that move the same token
from one stage to the other.

## What was built

`tests/edge/handlers/plugin/reinstall.test.ts` was rewritten from 9 cases that matched substrings
and regular expressions (`assert.match(..., /Usage: \/claude:plugin reinstall/)`) into **28 runtime
cases from 14 marked bodies**, all on the shared strict boundary, with every expected value
hand-authored and compared whole.

| Marked body | Args | Rows | Boundary sizing | Proves |
|-------------|------|------|-----------------|--------|
| all form | `""` | 1 | `(1, 2, {cwd, reads: 1})` | the accepted arity of ZERO; all four plugins across both scopes |
| marketplace form | `@mp` | 1 | same | only the named marketplace's two plugins; `gamma` and `delta` untouched |
| plugin form | `alpha@mp` | 1 | same | only the named plugin; `beta` untouched |
| scope | `--scope project`, `--scope user` | 2 | same | each scope holds a DIFFERENT marketplace, so a wrong root names a wrong plugin |
| scope position | `--scope project @mp`, `@mp --scope project` | 2 | same | AP-4 position independence |
| scope-target position | `--local @mp`, `@mp --local` | 2 | same | WR-02 position independence, and the override config layer |
| both selectors | `--scope user --local` | 1 | same | mutually exclusive selectors are ACCEPTED and both honoured |
| cold git source | `far@mp` | 1 | same | an input that would need the network, answered offline |
| arity above | 4 rows, two of them scope-flagged | 4 | `(1, 0)`, **no `cwd`** | the too-many-arguments sentence on both scopes |
| malformed reference | `noseparator`, `alpha@`, `@` | 3 | `(1, 0)`, **no `cwd`** | the lone separator is NOT the marketplace form |
| stage one | 3 rows | 3 | `(1, 0)`, **no `cwd`** | the unknown-FLAG sentence from the shared scanner |
| retired overwrite flag | `alpha@mp --force` | 1 | `(1, 0)`, **no `cwd`** | RINST-01 / D-67-03 as its own titled case |
| stage two | 4 quoted rows | 4 | `(1, 0)`, **no `cwd`** | the unknown-OPTION sentence from the handler's own loop |
| parse failure | `--scope bogus`, `--scope` | 2 | `(1, 0)`, **no `cwd`** | the throw's own sentence under this shim's usage block |

## The two rejection stages

The uncovered region at the start of this plan was `reinstall.ts:50-51`, the unknown-option
rejection inside the handler's own positional loop. It looked unreachable: the handler passes an
EMPTY pass-through list to the shared scanner, so that scanner rejects every long flag before the
loop runs.

It is reachable through quoting, and the plan's unreachability fallback did not fire.
`extractLocalFlag` splits on `/\s+/` and reads raw characters; `parseArgs`'s tokenizer strips quote
characters. So a quoted long flag passes stage one as an ordinary word and is reassembled into a
long-flag-shaped token before stage two reads it. Measured:

| Args | Stage | Emission |
|------|-------|----------|
| `--frobnicate` | one | `Unknown flag: "--frobnicate".` |
| `@mp --frobnicate` | one | `Unknown flag: "--frobnicate".` |
| `--scope project --frobnicate` | one | `Unknown flag: "--frobnicate".` |
| `alpha@mp --force` | one | `Unknown flag: "--force".` |
| `"--frobnicate"` | two | `Unknown option: "--frobnicate".` |
| `'--frobnicate'` | two | `Unknown option: "--frobnicate".` |
| `"--"frobnicate` | two | `Unknown option: "--frobnicate".` |
| `--scope project "--frobnicate"` | two | `Unknown option: "--frobnicate".` |

Two hand-authored sentences that merely differ prove nothing on their own. Two plants separate
them, in opposite directions:

- **Plant B** puts `--frobnicate` into the shared scanner's pass-through list. The three stage-ONE
  rows then receive the stage-TWO sentence and go RED; the stage-two rows stay GREEN. A stage-one
  case therefore cannot be satisfied by stage two.
- **Plant C** deletes the stage-two branch entirely. The four stage-TWO rows then receive
  `Invalid <plugin>@<marketplace> ref: "--frobnicate".` and go RED; every stage-one row stays GREEN.
  A stage-two case therefore cannot be satisfied by stage one.

## Measured against the plan

| Plan claim | Measured |
|------------|----------|
| `reinstall.ts:50-51` may be unreachable | **Reachable.** Three quoted shapes drive it; 100 percent branches, no D-116-01a claim |
| "the accepted positional arity, one below it, and one above it" | Zero AND one are both accepted, two is rejected. The **lower half has no target** — nothing is below zero |
| "mutually exclusive scope flags supplied together are rejected" | **FALSE.** `--scope user --local` is accepted and both selectors are honoured |
| the scope-target flag, "asserting the identical outcome" | The notification IS identical either way; the flag discriminates only through the config LAYER. Position independence is a separate, real claim, proven by Plant F |
| Group-C negative varies by scope (116-19) | **It does not here** (116-20's exception): `--scope user` and `--scope project` gave byte-identical plant diagnostics |

## Plants (D-116-04)

Seven plants across three production files. All seven RED. All reverted; `shared.ts` and `args.ts`
SHA-1s were identical before the first and after the last, `git diff --quiet -- extensions/` exits 0,
and `git log -1 --stat` shows 1 file changed.

| Plant | File | Edit | Result |
|-------|------|------|--------|
| A | `edge/handlers/plugin/reinstall.ts` | delete the leading-separator branch in `parseTarget` | **RED**, 5 rows. Marketplace form fell through to the reference split and emitted `Invalid <plugin>@<marketplace> ref: "@mp".` |
| B | `edge/handlers/plugin/reinstall.ts` | pass-through list `[]` → `["--frobnicate"]` | **RED**, exactly the 3 stage-one rows, each receiving `Unknown option:` in place of `Unknown flag:` |
| C | `edge/handlers/plugin/reinstall.ts` | delete the stage-two `startsWith("--")` branch | **RED**, exactly the 4 stage-two rows, each receiving `Invalid <plugin>@<marketplace> ref: "--frobnicate".` Stage-one rows GREEN |
| D | `edge/handlers/plugin/reinstall.ts` | delete the `return` after the too-many-arguments emission | **RED**, all 4 surplus rows, in BOTH cwd variants. Unstated cwd: `TypeError: ctx.ui.notify is not a function` at `notify.ts:3660` via `handleEnumerationFailure` (`reinstall.ts:649`). Stated cwd: same message at `notify.ts:3658` via `renderReinstallPartitionAndNotify` (`reinstall.messaging.ts:199`) |
| E | `edge/handlers/plugin/reinstall.ts` | `...(localFlag.local && { local: true })` → `local: true` | **RED**, all 7 base-layer rows, on `projectBase`/`userBase` moving to `projectLocal`/`userLocal` |
| F | `edge/handlers/shared.ts` | honour the scope-target flag only at index 0 | **RED**, exactly `@mp --local` and `--scope user --local`; `--local @mp` GREEN |
| G | `edge/args.ts` | honour the scope flag only at index 0 | **RED**, exactly `@mp --scope project` |

Plant D is the phase's SEVENTH distinct Group-C negative diagnostic. It is the second module (after
116-20) where the scope does NOT discriminate, and the first where the two working-directory
variants differ in the FRAME rather than in the message: the orchestrator's own enumeration catch
converts the unstated-cwd throw into a second emission, so the plant is caught one frame earlier
than the stated-cwd variant, which runs the workflow to completion and dies at the final render.

## The exact-argument gap (D-116-05)

`reinstallPlugins` is reached by direct import with no injection point, so no delegating case here
states an exact argument list against it. Delegation is observed as the minimal on-disk effect
instead: the SET of skill directory names each scope root carries after the act, plus which config
layer took the write-back. Each seeded plugin owns a differently named skill directory and each
scope a different marketplace, so a command that reached the wrong target form, the wrong
marketplace or the wrong scope materialises the WRONG NAME rather than merely materialising nothing.
That gap is recorded in this plan's `must_haves` so a verifier reads it as scoped rather than
missed.

## Verification

Each gate run separately, exit code checked. `npm run check` was NOT used — its `format:check` link
fails on the operator's pre-existing untracked files and short-circuits before the tests run.

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/plugin/reinstall.test.ts` | tests 28, pass 28, fail 0 |
| `npm run test:coverage:direct -- .../plugin/reinstall.ts` | `Direct coverage passed` — branches 25/25, functions 3/3, lines 100/100 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 (dead-code clean, 0 above threshold, duplication under threshold) |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm test` | **tests 5126, suites 293, pass 5126, fail 0** (read from the runner's `ℹ tests` line; baseline was 5109/5109 across 293) |
| `npm run test:integration` | tests 31, pass 31, fail 0 |
| anti-pattern scan | no matches (`rg` exit 1) |
| arrange markers vs case bodies | 14 and 14 |
| `git diff --check` | exit 0 |
| `git diff --quiet` over the 5 pinned production files + the boundary helper | exit 0 |
| trufflehog filesystem scan | chunks 4, bytes 43847, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | all hooks Passed |

## Deviations from Plan

**1. [Rule 2 — plan claim false against the module] The mutually-exclusive-selector truth**

- **Found during:** Task 1, measurement pass before any case was written
- **Issue:** `must_haves` truth 5 states that "mutually exclusive scope flags supplied together are
  rejected before any orchestrator call". Measured, `--scope user --local` is ACCEPTED and both
  selectors are honoured.
- **Fix:** the case asserts the measured combined outcome — the user scope alone re-materialised,
  its override layer taking the write-back — instead of a rejection that does not happen.
- **Commit:** 87fd5673

**2. [Rule 2 — plan claim targetless] The lower half of the arity truth**

- **Found during:** Task 1
- **Issue:** `must_haves` truth 4 asks for "the accepted positional arity, one below it, and one
  above it". Zero AND one positional are both accepted here, so there is no arity below the accepted
  one.
- **Fix:** the surplus half is proven on four rows including both scopes; the lower half is reported
  as targetless rather than faked with a case that cannot fail.
- **Commit:** 87fd5673

**3. [Rule 2 — tautology template] "Asserting the identical outcome"**

- **Found during:** Task 1
- **Issue:** the plan's `<action>` asks for the scope-target flag "driven before and after the
  positional, asserting the identical outcome", which is the phase's known unfalsifiable phrasing.
- **Fix:** kept the identical-outcome rows, because position independence IS a real claim here, and
  proved they can fail rather than arguing it — Plant F turns exactly the non-leading rows RED. The
  flag's discrimination against its own OMISSION is carried separately by the config layer and by
  Plant E.
- **Commit:** 87fd5673

**4. [Rule 2 — vacuity check on an inherited negative] The offline assertion**

- **Found during:** Task 1
- **Issue:** a zero asserted over an all-path-source fixture cannot fail (116-18).
- **Fix:** added a case seeding a COLD git source as the installed plugin, which is an input that
  would need the network to resolve further, and recorded that no positive control exists because
  reinstall's resolver rejects a cold source before materialisation. The limit is stated in the
  suite header and in the coverage block, with `human_judgment: true`.
- **Commit:** 87fd5673

**Total deviations:** 4 auto-fixed (4 × Rule 2). **Impact:** three plan-specified proofs that could
not have failed were replaced by proofs that can, and one targetless claim was reported rather than
faked.

## Issues Encountered

None.

## Next Phase Readiness

Wave 5 has 116-24 and 116-25 remaining, plus 116-28 (register) in wave 6. Both remaining wave-5
plans are seamless Group C and inherit the same three questions this owner re-measured: arity,
`--local`, and whether the scope discriminates the Group-C negative plant. All three answered
differently here than in the sibling they would most naturally be copied from.
