---
phase: 116-edge-surface
plan: "24"
subsystem: testing
tags: [node-test, edge, plugin, uninstall, group-c, footprint, offline, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-08's normative Group-C no-seam negative-delegation shape, copied here for the unknown-flag case"
  - phase: 116-edge-surface
    provides: "116-23's `edge/handlers/plugin/shared.ts` owner, which owns the reference parse and split this handler calls"
  - phase: 116-edge-surface
    provides: "116-26's `edge/handlers/shared.ts` owner, which owns the shared unknown-flag rule this handler's first rejection delegates to"
provides:
  - "tests/edge/handlers/plugin/uninstall.test.ts — the sole mirrored direct owner for edge/handlers/plugin/uninstall.ts, at 100 percent direct functions, lines AND branches"
  - "a FOURTEENTH distinct `--local` outcome: ACCEPTED, and invisible in BOTH the notification and the on-disk footprint unless the override layer is the one that fails schema validation"
  - "an EIGHTH parser/arity/flag combination: `extractLocalFlag` then `parseCommandArgs` with ONE REQUIRED positional — zero rejected, surplus DROPPED"
  - "an EIGHTH Group-C negative-delegation diagnostic family, and THREE distinct frames from a single plant on one module"
  - "the fifth acceptance of mutually exclusive scope selectors, so that inherited truth is again FALSE against the real module"
  - "a measured NFR-5 finding: the uninstall path can reach NO transport at all, so its offline zero is a regression guard with neither a positive control nor a reachable input"

affects: []

actuals:
  tokens: 7400
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A destructive verb is owned through its FOOTPRINT: every case, rejecting ones included, reads back the surviving install records of BOTH scope roots as one whole value beside the notification. A rejection asserting only its sentence proves nothing about whether state changed"
    - "The discriminating fixture for a precondition-selecting flag is one where the two targets DISAGREE. `--local` picks which config layer the CFG-03 precondition reads; an override layer that fails schema validation makes supplying the flag abort the command and omitting it complete it. With both layers valid or absent the two forms are byte-identical AND footprint-identical"
    - "One case can prove two selectors at once when each single-selector failure lands somewhere distinct: `--scope user --local` against an invalid USER override layer fails one way if only the scope is honoured, another way if only the flag is, and passes only when both are"
    - "Boundary sizing per row: a rejection is `(1, 0)` with NO stated `cwd`, a delegating command is `(1, 2, {cwd, reads: 1})`. Both counts MEASURED through a counting context before a line was written, and both held across every arity, scope and flag combination"

key-files:
  created: []
  modified:
    - tests/edge/handlers/plugin/uninstall.test.ts

key-decisions:
  - "MEASURED — an EIGHTH parser/arity/flag combination: `extractLocalFlag` then `parseCommandArgs` with a schema of ONE REQUIRED positional (`{ name: \"ref\" }`, `required` defaulting to true). ZERO positionals ARE rejected, with `Missing required argument.` collapsed from the duplicate-usage path. A SURPLUS positional is NOT rejected: `parseCommandArgs` iterates the SCHEMA, so `demo@alpha surplus` takes the first token and drops the second, and the command uninstalls exactly as the bare form does. So the arity `must_haves` truth is HALF false for a SIXTEENTH consecutive plan — the lower half holds because the positional is required, the surplus half does not"
  - "MEASURED — `--local` is ACCEPTED, the FOURTEENTH distinct outcome in this phase and the fifth acceptance. It reaches `extractLocalFlag` directly, which sets `local: true` and strips the token from the residual, and the handler's conditional spread carries it into `uninstallPlugin`. But it is invisible on a healthy workspace in a way even 116-22's config-layer answer is not: `uninstallPlugin` reads `opts.local` in ONE place, to pick `targetConfigPath` for the CFG-03 precondition (`orchestrators/plugin/uninstall.ts:543-545`), and the success path then calls `sweepPluginFromConfigLayers` on BOTH layers unconditionally (378-384). So with both layers valid or absent, the notification AND the on-disk footprint are identical either way. This is the 116-11 `remove.ts` shape reproduced exactly, and the plan's 'asserting the identical outcome' wording would have been a pure tautology against a healthy fixture"
  - "MEASURED — the inherited truth 'mutually exclusive scope flags supplied together are rejected before any orchestrator call' is FALSE against this module, the FIFTH acceptance in the phase. `demo@alpha --scope user --local` honours BOTH selectors: `extractLocalFlag` consumes `--scope <value>` as a downstream-owned pair and filters only the scope-target token, so `parseCommandArgs` still sees `--scope user` while `local: true` reaches the workflow. The case asserts that combined outcome against an invalid USER override layer, where a dropped scope and a dropped flag fail in two visibly different ways"
  - "MEASURED — the Group-C negative fires, the SCOPE DOES discriminate it (116-19's rule, not 116-20's exception), and ONE plant produced THREE distinct frames. `resolveCrossScopePluginTarget`'s scope selection IS what reaches `locationsFor`, and `locationsFor` is `scope === \"user\" ? getAgentDir() : path.join(cwd, \".pi\")`. With the working directory UNSTATED: the bare form dies at `persistence/locations.ts:145` via the unqualified project-first fan-out (`orchestrators/plugin/shared.ts:275`); `--scope project` dies at the same line via the explicit-scope arm (`shared.ts:248`); `--scope user` never reaches `path.join` at all, runs the workflow to COMPLETION, and dies on the SECOND `ctx.ui` access past its `times(1)` as `TypeError: ctx.ui.notify is not a function` at `shared/notify.ts:3658` via `orchestrators/plugin/uninstall.ts:737`. With the working directory STATED, the unknown-flag case produced that same completion diagnostic. All four variants RED, all recorded after running rather than promised"
  - "MEASURED — NFR-5's network half has NO reachable target on this module, which is a THIRD answer to the two questions the phase asks separately. `orchestrators/plugin/uninstall.ts` reads state and locations only; the git door is in its import graph solely because `orchestrators/marketplace/shared.ts`, which supplies the unstage cascade, also re-exports the git operations. Unlike 116-20's cold git source rendered `(remote)` and 116-21's cold source routed through `resolveStrict`, NOTHING in the uninstall path can reach a transport, so the fixture cannot reach it and no input turns it on. The counting fail-fast replacement of `https.request` is kept and read back at zero in every case as an explicit NFR-5 REGRESSION GUARD, and the suite header says so in those words rather than presenting the zero as a discriminated proof. An out-of-suite positive control confirmed the door is instrumented (a direct `https.request` call moves the counter 0 → 1)"
  - "DEVIATION — the plan's `<action>` asks for the scope-target flag 'supplied and omitted, driven before and after the reference, both asserting the identical outcome', which is the phase's known tautology template. Against a healthy workspace it is unfalsifiable here for the reason recorded above. Resolved by moving the whole scope-target family onto an INVALID override layer, where the flag's presence changes the outcome, and by proving position independence with a PLANT (Plant C) rather than by asserting the three positions agree. A dedicated companion case drives the same fixture with the flag OMITTED and asserts the OPPOSITE outcome, so the identical-outcome rows have a demonstrated disagreement beside them"
  - "No production file was touched. Five plants were applied across two production files — `edge/handlers/plugin/uninstall.ts` and `edge/handlers/shared.ts` — all five RED, each reverted from a byte copy taken beforehand. Post-revert `git hash-object` reads `1016e3daba7394561e4a3cf50e54762120434b0f` for `uninstall.ts` and `9c42cb8b2c5c7066e962b50dbef035485c7e0320` for `shared.ts`; `git diff --quiet` over the five pinned production files and `tests/helpers/notification-boundary.ts` exits 0"

patterns-established:
  - "Own a destructive verb through what survived, not through what it said. Sixteen cases here each compare both scopes' surviving install records as one whole value; the notification alone would have left every rejection unproven and the scope-target flag looking inert"
  - "When a flag selects a PRECONDITION target rather than an effect, the only falsifiable fixture is one where the two targets disagree. Look for the arm that ABORTS"
  - "A single plant can produce several distinct frames on one module when the scope selection is what reaches the path composition. Run every scope variant and both working-directory variants, and write down what each actually said"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/plugin/uninstall.test.ts owns edge/handlers/plugin/uninstall.ts at 100 percent direct functions, lines and branches"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/uninstall.test.ts — 16 runtime cases from 10 marked bodies, pass 16 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts → branches 10/10, functions 2/2, lines 42/42"
        status: pass
  - deliverable: "Every rejection is proven to leave both seeded install records intact on disk, and the workflow unreached (D-116-06 negative half, T-116-24-A)"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/uninstall.test.ts — eight rejecting cases at (1, 0) with no stated cwd, each asserting BOTH_RECORDS_INTACT and calling verifyBoundary()"
        status: pass
      - kind: command
        ref: "Plant A' (fall through after the usage error) turned the unknown-flag case RED in all four scope and cwd variants"
        status: pass
  - deliverable: "The cross-scope pair proves the SELECTED scope rather than any scope"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant B (delete the scope conditional spread) turned the --scope user row and the both-selectors case RED while the --scope project row stayed GREEN"
        status: pass
  - deliverable: "The scope-target flag is honoured, and honoured position-independently"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant D (delete the local conditional spread) turned all four flag-supplied rows RED; Plant C (honour the flag only at index 0 of extractLocalFlag) turned exactly the two non-leading rows and the both-selectors case RED"
        status: pass
  - deliverable: "NFR-5 offline half: the git transport door is never opened"
    human_judgment: true
    rationale: "The zero is asserted in every case and the door was proven instrumented out of suite, but nothing in the reachable input space of this handler can move the counter — the uninstall path reaches no transport at all. It is a regression guard, not a discriminated measurement, and a verifier should read it as one."

duration: 46 min
completed: 2026-09-03
---

# Phase 116 Plan 24: Plugin Uninstall Shim Owner Summary

The uninstall handler is now owned through its on-disk footprint: sixteen cases compare a
hand-authored notification and the surviving install records of both scope roots as whole values, so
a destructive verb is proven by what it removed and by what it left alone.

## Accomplishments

- Rewrote `tests/edge/handlers/plugin/uninstall.test.ts` on `createNotificationBoundary`, removing
  the previous suite's hand-rolled context and its double assertion through `unknown`, and replacing
  eleven `assert.match` regex probes with whole-value `assert.deepStrictEqual` comparisons.
- Paired EVERY case — the eight rejecting ones included — with a read-back of both scopes' surviving
  install records plus the transport counter, as one whole value. This is the substance of the plan:
  a notification-only proof of a destructive verb passes while proving nothing.
- Sized every rejection at one emission and zero probes with no stated working directory, and called
  `verifyBoundary()` in all sixteen cases. The probe count (2 on a delegating path, 0 on a rejection)
  and the `ctx.cwd` read count (1 and 0) were MEASURED through a counting context before a line of
  the suite was written, not inherited from the helper's docs or from a sibling.
- Held the pair at 100 percent direct coverage — branches 10/10, functions 2/2, lines 42/42 — the
  same numbers the old suite produced, so the thinner rewrite dropped nothing it covered
  incidentally (T-116-24-B).
- Ran five plants, all five RED, all reverted; `git diff --quiet` over the pinned sources exits 0
  (T-116-24-C).

## Task Commits

| Task | Name                                                       | Commit     | Files                                       |
| ---- | ---------------------------------------------------------- | ---------- | ------------------------------------------- |
| 1    | Rewrite the uninstall owner as the canonical seamless proof | `69134046` | tests/edge/handlers/plugin/uninstall.test.ts |

## Case inventory

16 runtime cases from 10 marked bodies (`rg -c '^\s+// arrange$'` = 10, and the same for `// act` and
`// assert`).

| Body                          | Rows | Input                                        | Outcome                                          |
| ----------------------------- | ---- | -------------------------------------------- | ------------------------------------------------ |
| Accepted arity, scope omitted | 1    | `demo@alpha`                                 | project record removed, user record survives      |
| One below the accepted arity  | 1    | `""`                                         | `Missing required argument.`, both intact         |
| One above the accepted arity  | 1    | `demo@alpha surplus`                         | surplus DROPPED, project record removed           |
| Malformed reference           | 3    | `no-at-sign`, `@alpha`, `demo@`              | offending token named verbatim, both intact       |
| Scope selection               | 2    | `--scope project`, `--scope user`            | the selected scope's record removed, other survives |
| Scope-target flag position    | 3    | flag ahead of, between, and last             | override layer read, command aborts, both intact  |
| Scope-target flag omitted     | 1    | same fixture, no flag                        | base layer read, project record removed           |
| Both selectors together       | 1    | `--scope user --local`                       | user override layer read, both intact             |
| Unknown long flag             | 1    | `--frobnicate`                               | `Unknown flag: "--frobnicate".`, both intact      |
| Unrecognised scope value      | 2    | `bogus`, `--frobnicate` in the value position | parse diagnostic verbatim, both intact            |

## Plants (D-116-04)

All five reverted from byte copies taken beforehand.

**Plant A — the plan's literal form.** Delete the `return` inside the flag-scan guard, leaving the
`if` body empty. The unknown-flag case went RED, but NOT with the boundary report the plan promised:

```
✖ reports an unknown long flag and removes nothing (D-116-06)
  TypeError: Cannot read properties of undefined (reading 'residualArgs')
      at .../edge/handlers/plugin/uninstall.ts:27:64
```

The literal form is also compiler-rejected, which the plan does not mention:

```
extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts(27,54): error TS18048: 'localFlag' is possibly 'undefined'.
extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts(39,11): error TS18048: 'localFlag' is possibly 'undefined'.
```

**Plant A′ — the form that tests the claim.** `extractLocalFlag(args, ctx, USAGE) ?? { local: false,
residualArgs: args }`, so control genuinely falls through past the usage error with usable data and
the workflow runs. RED in four variants, all recorded after running.

Unstated working directory, no scope token:

```
  TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function
      at Object.join (node:path:1339:7)
      at locationsFor (.../persistence/locations.ts:145:61)
      at resolveCrossScopePluginTarget (.../orchestrators/plugin/shared.ts:275:28)
      at uninstallPlugin (.../orchestrators/plugin/uninstall.ts:522:28)
```

Unstated working directory, `--scope project` — same error, DIFFERENT frame (`shared.ts:248`, the
explicit-scope arm rather than the unqualified fan-out):

```
      at resolveCrossScopePluginTarget (.../orchestrators/plugin/shared.ts:248:32)
```

Unstated working directory, `--scope user` — a completely different diagnostic, because
`locationsFor` never calls `path.join` on a user-scope call. The workflow runs to completion and the
emission count is what catches it:

```
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at emitCascadeWith (.../shared/notify.ts:3850:3)
      at emitContextCascade (.../shared/notify.ts:3869:3)
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at uninstallPlugin (.../orchestrators/plugin/uninstall.ts:737:3)
```

Stated working directory, no scope token — byte-identical to the `--scope user` frame above. So on
this module the SCOPE discriminates and the cwd forwarding does not, which is 116-19's rule and the
mirror image of what 116-22 measured one plan earlier.

**Plant B — delete `...(parsed.scope !== undefined && { scope: parsed.scope })`.** RED on exactly two
cases:

```
✖ removes the user-scope record alone when --scope user is supplied
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: '● alpha [project]\n' + '  ○ demo v1.0.0 (uninstalled)\n' + '\n' + '/reload to pick up changes'
  -     message: '● alpha [user]\n  ○ demo v1.0.0 (uninstalled)\n\n/reload to pick up changes'
      }
    ]
✖ honors the scope flag and the scope-target flag together
```

The `--scope project` row stayed GREEN, because project is what the unqualified form already
resolves to. That is precisely why the cross-scope pair — not a single scope case — is the
discriminating proof.

**Plant C — honour the scope-target flag only at index 0 of `extractLocalFlag`** (on the pinned
`edge/handlers/shared.ts`). RED on exactly the two rows where the flag is not leading, plus the
both-selectors case; GREEN on the leading row and on all thirteen others:

```
✔ reads the override layer when the scope-target flag appears ahead of the reference
✖ reads the override layer when the scope-target flag appears between the two other tokens
✖ reads the override layer when the scope-target flag appears last
✖ honors the scope flag and the scope-target flag together
ℹ tests 16   ℹ pass 13   ℹ fail 3
```

This is what makes the position rows falsifiable rather than three assertions that agree.

**Plant D — delete `...(localFlag.local && { local: true })`.** RED on all four flag-supplied rows
and GREEN on the flag-omitted control, which is the pair that proves the flag reaches the workflow:

```
✖ reads the override layer when the scope-target flag appears ahead of the reference
✖ reads the override layer when the scope-target flag appears between the two other tokens
✖ reads the override layer when the scope-target flag appears last
✖ honors the scope flag and the scope-target flag together
ℹ tests 16   ℹ pass 12   ℹ fail 4
```

with the diff showing the abort replaced by a completed uninstall:

```
  +     message: '● alpha [project]\n' + '  ○ demo v1.0.0 (uninstalled)\n' + '\n' + '/reload to pick up changes'
  -     message: 'A plugin operation has failed.\n' + '\n' + '● alpha [project]\n' + '  ⊘ demo (failed) {invalid manifest}\n' + '    cause: Config file "claude-plugins.local.json" failed schema validation.'
  -     severity: 'error'
```

No plant stayed GREEN.

## Where the canonical shape does NOT hold here

The plan calls this owner "the canonical shape of a seamless handler". Three parts of that shape do
not hold, and they are stated rather than tidied away, because a canonical example is the one later
readers copy.

1. **The arity claim is half false.** The `must_haves` truth says both out-of-range counts are
   rejected. The surplus count is not rejected — it is silently dropped, because `parseCommandArgs`
   iterates the schema rather than the input. The suite asserts the drop.
2. **The scope-target flag is not observable at all on a healthy workspace.** Not in the message,
   and — unlike every sibling that measured a config-layer answer — not in the footprint either,
   because the success path sweeps both layers unconditionally. The whole scope-target family had to
   be moved onto an invalid override layer to become falsifiable.
3. **The offline zero has no target.** Nothing in the uninstall path can reach a transport, so the
   assertion is a regression guard rather than a measurement. Copying it into a sibling without
   asking the two reachability questions again would repeat the vacuity 116-16 and 116-18 found.

## Deviations from Plan

**1. [Rule 2 — falsifiability] The scope-target flag family moved onto a discriminating fixture**

- **Found during:** Task 1
- **Issue:** the plan asks for the flag "supplied and omitted, driven before and after the reference,
  both asserting the identical outcome". Against a healthy workspace the three forms are byte- and
  footprint-identical whatever the module does, because `opts.local` selects only the CFG-03
  precondition target and the success path sweeps both config layers regardless. This is the phase's
  known tautology template, and 116-11 met the same mechanism in `remove.ts`.
- **Fix:** seeded an override layer that fails schema validation in the scope under test, so
  supplying the flag aborts the command and omitting it completes it; added a companion case that
  drives the same fixture with the flag omitted and asserts the OPPOSITE outcome; and proved position
  independence with Plant C rather than by asserting the three positions agree.
- **Commit:** `69134046`

**2. [Rule 2 — vacuity check on an inherited negative] The offline assertion's limits recorded**

- **Found during:** Task 1
- **Issue:** the plan asks for the network call count asserted at zero in every case. Measured, the
  uninstall path reaches no transport at all, so the zero has neither a positive control nor a
  reachable input — the shape 116-16 deleted rather than inherit.
- **Fix:** kept the assertion (a real regression guard, since the git operations ARE in the import
  graph via `orchestrators/marketplace/shared.ts`), folded it into the same whole-value comparison so
  every case carries it, proved the door instrumented with an out-of-suite positive control, and
  stated the limit in the suite header and in the coverage block with `human_judgment: true`.
- **Commit:** `69134046`

**3. [Rule 2 — plant strengthened] Plant A run in two forms**

- **Found during:** Task 1
- **Issue:** the plan's literal Plant A ("delete the early return that follows the flag-scan guard")
  does not make control fall through with usable data — it dereferences `undefined` on the next line
  and does not compile. It went RED, but on a `TypeError` at the handler rather than on anything the
  boundary reports, so it does not test the claim the plan attaches to it.
- **Fix:** ran the literal form, recorded its output and its two TS18048 errors, then ran Plant A′
  (`?? { local: false, residualArgs: args }`) which genuinely reaches the workflow, in all four scope
  and working-directory variants. Both forms are recorded above.
- **Commit:** `69134046`

**Total deviations:** 3 auto-fixed (3 × Rule 2). **Impact:** one plan-specified proof that could not
have failed was replaced by one that can, one inherited negative had its limits recorded instead of
being presented as evidence, and one plant was run in the form that tests its own claim.

## Verification

Each gate run separately, exit code checked. `npm run check` was NOT used — its `format:check` link
fails on the operator's pre-existing untracked files and short-circuits before the tests.

| Gate                                                                | Result                                            |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `node --test tests/edge/handlers/plugin/uninstall.test.ts`           | tests 16, pass 16, fail 0                         |
| `npm run test:coverage:direct -- .../plugin/uninstall.ts`            | branches 10/10, functions 2/2, lines 42/42        |
| `npm run typecheck`                                                  | exit 0                                            |
| `npm run lint` / `eslint <file>`                                     | exit 0                                            |
| `npm run fallow`                                                     | exit 0                                            |
| `npm exec -- prettier --check <file>`                                | exit 0                                            |
| `npm test`                                                           | exit 0 — `ℹ tests 5132`, 293 suites, fail 0       |
| `npm run test:integration`                                           | exit 0 — `ℹ tests 31`, fail 0                     |
| anti-pattern `rg` scan                                               | no match (the negated link exits 0)               |
| `rg -c '^\s+// arrange$'`                                            | 10, equal to the marked-body count                |
| `git diff --check`                                                   | exit 0                                            |
| `git diff --quiet` over 5 pinned sources + `notification-boundary.ts` | exit 0                                            |

The suite total was READ from the runner's `ℹ tests` line, never computed from a delta.

## Issues Encountered

None.

## Next Phase Readiness

Only 116-25 and 116-28 (register) remain. 116-25 is the last seamless Group-C owner and inherits the
same three questions this owner re-measured — arity, `--local`, and whether the scope discriminates
the Group-C negative plant. All three answered differently here than in 116-22, the sibling it would
most naturally be copied from: the scope DOES discriminate here where it did not there, and the
scope-target flag is invisible in the footprint here where the footprint was exactly what exposed it
there.

## Self-Check: PASSED

- `tests/edge/handlers/plugin/uninstall.test.ts` and
  `.planning/phases/116-edge-surface/116-24-SUMMARY.md` both present on disk.
- Commit `69134046` reachable from `git log --all`.
- The plan's whole `<verify>` chain re-run end to end against the committed pair: exit 0, with the
  arrange-marker link reporting 10.
- Both planted production files restored byte-for-byte; `git hash-object` and `git diff --quiet` both
  confirm it.
- `git status --short` lists only the operator's pre-existing modified and untracked entries.
- The scratch probe suite created for the measurement pass was deleted before the commit.
- Nothing filed in `.planning/WINDOWS.md`: this pair carries no stub, no skipped test, no unrun
  `<verify>` link and no D-116-01a shortfall — direct coverage is complete at 10/10 branches with no
  unreachable region measured.
