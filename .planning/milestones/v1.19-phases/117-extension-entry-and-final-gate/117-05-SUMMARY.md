---
phase: 117-extension-entry-and-final-gate
plan: "05"
subsystem: testing
tags: [node-test, strong-mock, device-flow, output-catalog, corresponding-test-gate]

requires:
  - phase: 117-extension-entry-and-final-gate
    provides: "D-117-01's fold-or-relocate rule for supplemental suites, and the deferred-items protocol established by 117-04"
provides:
  - "tests/domain/github-auth.test.ts now carries the published output-catalog byte form and severity of the AUTH-03 device-flow prompt"
  - "tests/shared/device-flow-prompt.test.ts deleted; the corresponding-test gate drops from 5 violations to 4"
  - "a recorded finding that the owner never held a substring assertion, so the supplement's stated premise was false"
affects: [117-12]

actuals:
  tokens: 12186
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A catalog byte-form lock written as a strong-mock exactParams expectation rather than a hand-rolled notify recorder"
    - "A single case carrying both a byte-form claim and an ordering claim by driving the denied-poll path, where no token ever exists"

key-files:
  created: []
  modified:
    - tests/domain/github-auth.test.ts
    - .planning/phases/117-extension-entry-and-final-gate/deferred-items.md
    - .planning/WINDOWS.md

key-decisions:
  - "Fold the supplement into one case, not two: its ordering case restated the owner's existing reports-denied-authorization row"
  - "Drive the surviving case on the denied poll so the byte-form claim and the no-token-in-scope claim are proven by one case"
  - "Build the transport with createDeviceFlowFake but keep the credential and notify ports as strong-mocks, per the house role table"
  - "Leave the output catalog's now-stale pointer to the deleted suite as a deferred item; the plan pins the catalog"

patterns-established:
  - "A folded case that cannot fail independently of an existing case is reported as such, not presented as new evidence"
  - "A plant is run in both the literal form the plan named and the sharper form that actually violates the claim, and both readings are recorded"

requirements-completed: []

coverage:
  - id: D1
    description: "The AUTH-03 device-flow prompt's exact bytes and severity are locked against the published output-catalog example, in the mirrored owner of the module that emits them"
    requirement: "OWN-06"
    verification:
      - kind: unit
        ref: "tests/domain/github-auth.test.ts#emits the documented AUTH-03 prompt before any token is acquired"
        status: pass
      - kind: other
        ref: "plant: one character changed in the expected prompt string (ABCD-1234 -> ABCD-1235); the case failed"
        status: pass
    human_judgment: false
  - id: D2
    description: "The prompt is emitted while no access token exists, so the asserted string can carry no credential field"
    requirement: "CASE-04"
    verification:
      - kind: unit
        ref: "tests/domain/github-auth.test.ts#emits the documented AUTH-03 prompt before any token is acquired"
        status: pass
      - kind: other
        ref: "plant: emission moved into the token-acquired branch of initiateDeviceFlow; 22 of 48 cases failed, including this one"
        status: pass
    human_judgment: false
  - id: D3
    description: "tests/shared/device-flow-prompt.test.ts is deleted and the corresponding-test gate no longer names it"
    requirement: "DEL-01"
    verification:
      - kind: other
        ref: "node scripts/check-corresponding-tests.mjs"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pair keeps complete direct function, line and branch coverage of domain/github-auth.ts with the owner run alone"
    requirement: "CASE-01"
    verification:
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/github-auth.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The surviving case adds a documentation link the owner did not have, but it cannot fail independently of the owner's existing prompt expectations"
    verification: []
    human_judgment: true
    rationale: "Whether a case whose only distinct input is the catalog's example values earns its place is a judgment about evidence value, not something a run can settle. The finding is stated in full below so the phase verifier can rule on it."

duration: 9 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 05: Fold the Device-Flow Prompt Lock Into Its Owner Summary

**The AUTH-03 device-flow prompt's published catalog byte form is now locked inside `tests/domain/github-auth.test.ts` by one case on the denied-poll path, the 153-line supplement is deleted, and the corresponding-test gate drops from 5 violations to 4.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-03T18:24:12Z
- **Completed:** 2026-09-03T18:33:30Z
- **Tasks:** 1
- **Files modified:** 2 in the production commit (1 modified, 1 deleted)

## Accomplishments

- Folded the device-flow prompt supplement into the mirrored owner of the module it measures. `tests/shared/device-flow-prompt.test.ts` measured exactly one production module, `extensions/pi-claude-marketplace/domain/github-auth.ts`, and that module already had an owner, so D-117-01's fold branch applied and its relocate branch did not.
- Added one case to the owner, `emits the documented AUTH-03 prompt before any token is acquired`, which drives `initiateDeviceFlow` with the catalog's own example device-code values through `createDeviceFlowFake`, denies the poll, and pins the emitted message and severity as one whole value.
- Proved the lock is a byte comparison and the ordering claim is real by running both plants and recording what each actually printed.
- Re-checked the supplement's header claim against the fold target and found it stale in a stronger sense than the plan anticipated (see Findings).
- Resolved exactly one corresponding-test violation and introduced none.

## Task Commits

1. **Task 1: Fold the device-flow prompt byte-form lock into the github-auth owner** — `4bca542a` (test)

**Plan metadata:** see the `docs(117-05)` commit that carries this file.

## Files Created/Modified

- `tests/domain/github-auth.test.ts` — added the catalog byte-form case and the `./device-flow-fake.ts` import (+49 lines)
- `tests/shared/device-flow-prompt.test.ts` — deleted (-153 lines)
- `.planning/phases/117-extension-entry-and-final-gate/deferred-items.md` — entry 2, the catalog's stale pointer
- `.planning/WINDOWS.md` — the same finding, for the 117-12 sweep

## This is a delete plus an edit, not a rename

Git recorded no rename and could not have. A rename is detected by content similarity between one deleted path and one added path; here the surviving evidence was merged into a 1198-line file that already existed, so there is no added path and nothing structural is shared with the 153-line file that went away. `git log -1 --stat` shows `2 files changed, 49 insertions(+), 153 deletions(-)` and a bare `delete mode`, with no `rename` line. The plan forbade promising git a rename, and none was promised.

## Gate readings

Each gate was run separately and its own exit code read. `npm run check` was not used, because its `format:check` link fails on the operator's pre-existing untracked files and would short-circuit before the tests.

| Gate | Command | Reading |
| --- | --- | --- |
| Focused run | `node --test tests/domain/github-auth.test.ts` | tests 48, pass 48, fail 0 (was 47/47 before the fold) |
| Direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/github-auth.ts` | `Direct coverage passed: extensions/pi-claude-marketplace/domain/github-auth.ts (branches 78/78, functions 10/10, lines 439/439)` |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm exec -- eslint tests/domain/github-auth.test.ts` | exit 0, no problem lines |
| Format | `npm exec -- prettier --check tests/domain/github-auth.test.ts` | `All matched files use Prettier code style!` |
| Fallow | `npm run fallow` | exit 0; dead-code `No issues found`, health score 78 B, dupes reported no new clone group |
| Full unit suite | `npm test` | tests 5142, suites 295, pass 5142, fail 0 |
| Anti-pattern scan | the plan's `rg` alternation over the owner | no matches (rg exit 1) |
| Arrange markers | `rg -c '^\s*// arrange$' tests/domain/github-auth.test.ts` | 23 |
| Corresponding tests | `node scripts/check-corresponding-tests.mjs` | 4 violations, `device-flow-prompt` named in none |
| Supplement absent | `test ! -e tests/shared/device-flow-prompt.test.ts` | exit 0 |
| Production pinned | `git diff --quiet -- extensions/ package.json docs/output-catalog.md` | exit 0 |

### Coverage is quoted, not restated

The gate's own line after the fold is `branches 78/78, functions 10/10, lines 439/439`. It read the same before the fold. The numbers did not move, which is the measured result rather than an assumption: the plan warned the branch denominator is a property of the suite and has moved in both directions this milestone, so it was re-measured. The `+1` case exercises a path the suite already reached, so it added no branch.

### Corresponding-test gate, before and after

Before (5): `missing-test: tests/index.test.ts`, `unexpected-test: tests/edge/index-handler.test.ts`, `unexpected-test: tests/orchestrators/marketplace/cascade.test.ts`, `unexpected-test: tests/shared/device-flow-prompt.test.ts`, `unexpected-test: tests/shared/index-smoke.test.ts`.

After (4): the same list without `tests/shared/device-flow-prompt.test.ts`. The remaining four belong to 117-06 and 117-08 and were not touched.

## Plants

Both plants were run against the real tree, and both outputs below are verbatim.

### Plant 1 — one character of the expected prompt string

Changed the expected string in the new case from `ABCD-1234` to `ABCD-1235` and ran `node --test tests/domain/github-auth.test.ts`. The case went RED:

```
✖ emits the documented AUTH-03 prompt before any token is acquired (7.283791ms)
  Error: Didn't expect notification("Open https://github.com/login/device and enter: ABCD-1234", "info") to be called.

  Remaining expectations:
  when(() => notification("Open https://github.com/login/device and enter: ABCD-1235", "info")).thenReturn(undefined).between(1, 1)
  - Expected
  + Received

  -   "Open https://github.com/login/device and enter: ABCD-1235",
  +   "Open https://github.com/login/device and enter: ABCD-1234",
      "info"
```

Reverted; the suite returned to 48/48. The comparison is byte-level over the whole argument, not a shape or substring check.

### Plant 2 — moving the emission past the poll

The plan named one plant here. It was run first, exactly as written, and it did **not** put the new case RED. That reading is a finding, so a second, sharper form was then run. Both are reported.

**Plant 2a, the literal form.** Moved the emission to after `runPollLoop` returns, unconditionally:

```ts
const deviceFlowResult = await runPollLoop(http, provider, deviceCode, opts);
opts.notifyFn(`Open ${deviceCode.verification_uri} and enter: ${deviceCode.user_code}`, "info");
return deviceFlowResult;
```

Reading: `tests 48, pass 47, fail 1`. The one failure was **not** the new case, which stayed GREEN:

```
test at tests/domain/github-auth.test.ts:761:3
✖ propagates credential persistence errors (9.384077ms)
  Error: There are unmet expectations:

   - when(() => notification("Open https://verify.example/device and enter: CODE-1", "info")).thenReturn(undefined).between(1, 1)
```

That case only detects the move incidentally: `credentialOps.approve` rejects there, so `runPollLoop` throws and the relocated emission is never reached. Nothing in the suite asserts emission order as such.

**Plant 2b, the form that actually violates the claim.** The claim is that the prompt is emitted while no token exists. The counterfactual is therefore not "after the poll" but "only once a token exists":

```ts
const deviceFlowResult = await runPollLoop(http, provider, deviceCode, opts);
if (deviceFlowResult.ok) {
  opts.notifyFn(`Open ${deviceCode.verification_uri} and enter: ${deviceCode.user_code}`, "info");
}

return deviceFlowResult;
```

Reading: `tests 48, pass 26, fail 22`, the new case among them:

```
✖ emits the documented AUTH-03 prompt before any token is acquired (2.76424ms)
  Error: There are unmet expectations:

   - when(() => notification("Open https://github.com/login/device and enter: ABCD-1234", "info")).thenReturn(undefined).between(1, 1)
```

Reverted with `git checkout -- extensions/pi-claude-marketplace/domain/github-auth.ts`; `git diff --quiet -- extensions/ package.json docs/output-catalog.md` then exited 0 and the suite returned to 48/48. Nothing under `extensions/` is in the commit.

**What the pair of plants narrows the claim to.** The suite proves the prompt fires on a flow that never acquires a token. It does not prove the emission precedes the poll in program order — an implementation that polled first and then emitted unconditionally would keep the new case green. That is the honest strength of the evidence, and it is the strength the requirement needs: AUTH-09 is about a credential never being in scope at the emission, and a denied flow has no credential in scope at any point.

## Findings

### The supplement's header claim was stale, and staler than the plan expected

The supplement's header said it "parallels tests/domain/github-auth.test.ts's existing AUTH-03 test (\"AUTH-03 notify content includes user_code AND verification_uri\" -- substring assertion) but tightens substring checks to full byte-form equality against the catalog."

Re-checked by grep, as the plan required:

- `rg -n "AUTH-03" tests/domain/github-auth.test.ts` before the fold: no matches. No case by that name exists in the fold target, or anywhere under `tests/`.
- `rg -n "includes\(|match\(" tests/domain/github-auth.test.ts`: no matches.

So both halves of the sentence were false. There was no such case to parallel, and there was no substring assertion in the owner to tighten. Every existing prompt expectation in the owner is a `strong-mock` `exactParams` expectation, which already compares the whole message and severity. The sentence was not carried across; nothing replaced it, because there is nothing in the target it could be restated against.

### The surviving case cannot fail independently of the owner's existing expectations

This is the honest limit of what was folded, and it is why deliverable D5 is routed to human judgment.

The owner already held roughly twenty cases whose expectation is the exact prompt string with fixture values, so any change to the emission template turns those RED too. There is no production edit that turns only the new case RED while leaving them green: the verification URI and user code are inputs supplied by the test, and the template is the only variable. Plant 1 confirms this — it fails by changing the test's own expected value, not by changing production.

What the new case does add is the link the plan required in `key_links`: the expected string is hand-authored from the published catalog example, the case's comment names the catalog entry and its `catalog-state` marker, and the case's inputs are the catalog's own example values rather than invented ones. A developer who changes the emission now gets a RED case that names the document to update. That is a documentation-lockstep mechanism, not an additional failure mode. Note also what it does not do: it does not detect drift in the catalog itself, since the expected string is a hand copy taken at authoring time rather than a value read from the document.

### The catalog's pointer to the deleted suite is now stale

`docs/output-catalog.md` line 2729 still reads "The byte form is locked by `tests/shared/device-flow-prompt.test.ts`". That path no longer exists. The plan pins the catalog (`git diff --quiet -- ... docs/output-catalog.md`), so the correction was filed rather than made: `deferred-items.md` entry 2 and a `.planning/WINDOWS.md` entry, both naming the 117-12 sweep. No gate reads the cited path — `tests/architecture/catalog-uat.test.ts` pairs on the `<!-- catalog-state: -->` marker and its own driver, not on this prose — and `rg` confirmed the catalog is the only remaining reference to the deleted path anywhere in the tree.

## Dropped folded cases

| Dropped | Owner case that already carried the claim |
| --- | --- |
| The supplement's second case, `Device Flow prompt is emitted BEFORE the poll loop (token not yet acquired -- AUTH-09)` | `reports denied authorization`, a data row that already drives an `access_denied` poll and expects the exact prompt string and `"info"` severity through a `verify`d `strong-mock`. Plant 2b puts that row RED alongside the new case. Its remaining assertion, `!promptCall.message.includes("access_token")`, is subsumed by whole-value equality and separately gate-enforced by `tests/architecture/no-credential-leak.test.ts`; the house rules forbid restating what a gate already enforces. Its "different user_code proves the template is not hard-coded" point survives across the file, since the owner's rows use `CODE-1` and the new case uses `ABCD-1234`. |
| The supplement's `NotifyCall` interface and `makeNotifyRecorder()` factory | The owner's `mock<NotifyFn>({ exactParams: true, name: "notification" })` plus `verify(notification)`. The plan told me to check for an equivalent before copying one in; this is that equivalent, and copying a hand-rolled recorder beside it would have been a second mocking idiom in one file, against the house rule that forbids adding another mocking library, and a real `fallow dupes` exposure at a threshold of 3. |

## Decisions Made

- **One case, not two.** The supplement's two cases collapse into one because the surviving case runs the denied-poll path: the prompt's catalog byte form and the fact that no token exists at emission time are then proven by the same run. Keeping a separate ordering case would have been the same case run twice.
- **Denied poll rather than successful poll.** A success-path case would have stayed GREEN under plant 2a *and* 2b, since the emission would still fire once a token existed. Choosing the denied path is what makes the plant land on this case rather than on an unrelated one.
- **`createDeviceFlowFake` for the transport, `strong-mock` for the ports.** The house role table calls a scripted stateful boundary a fake and calls notifying a mock. Using the fake also keeps the new arrange block structurally distinct from the owner's existing ones, which matters at a `fallow dupes` threshold of 3.
- **`mock<CredentialOps>` with no expectations.** Per the house rules, a mock with no expectations proves the module never touches that port. On the denied path that is the strongest available statement that nothing was persisted, so `createCredentialOpsFake` was not carried across. This is the one place the plan's import note was not followed to the letter; the rationale is above.

## Deviations from Plan

### Auto-fixed Issues

None. No bug, missing critical functionality, or blocking issue was encountered.

### Judgment calls that differ from the plan's letter

**1. Only one of the two support imports was carried across**

- **Found during:** Task 1
- **Plan text:** "the device-flow fake becomes a sibling and the credential fake keeps its cross-directory climb"
- **What was done:** `./device-flow-fake.ts` was imported; `../platform/credential-ops-fake.ts` was not. The credential port is a `strong-mock` with no expectations instead.
- **Why:** the surviving case runs the denied path, where `credentialOps.approve` is never called. A fake would record an empty call list; an expectation-free strict mock throws on any call at all, which is the stronger statement and is the owner's existing idiom for exactly this situation.
- **Verification:** focused run 48/48, `verify(credentialOps)` present, lint and fallow clean.

**2. A second plant was run beyond the one the plan named**

- **Found during:** Task 1
- **Plan text:** "move the emission to after the poll completes ... record what the ordering case said"
- **What was done:** that plant was run first and recorded; because the new case stayed GREEN under it, a sharper plant was then run and also recorded.
- **Why:** the plan itself says a plant that stays GREEN is a finding and the claim must be narrowed or strengthened. Both readings and the narrowed claim are in the Plants section.

---

**Total deviations:** 0 auto-fixed. 2 judgment calls documented above.
**Impact on plan:** none on scope. Both calls make the evidence stronger or more honest, and neither touches production.

## Issues Encountered

- `gsd-tools query state.add-decision --summary-file` rejects any path outside the repository root, so the scratchpad files could not be used. The decisions were passed inline with `--summary` instead, phrased without double quotes or backticks because this shell is fish.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The corresponding-test gate stands at 4 violations. `tests/index.test.ts` and the two `index` orphans belong to 117-08; `tests/orchestrators/marketplace/cascade.test.ts` belongs to 117-06. Neither was touched.
- Two items are queued for the 117-12 sweep: the `install.messaging.ts` doc comment filed by 117-04, and the output-catalog pointer filed here.
- Requirements were deliberately not marked. `requirements.ready-ids` reports `0/4 requirement(s) ready to mark complete` for `OWN-06`, `CASE-01`, `CASE-04`, `DEL-01`, because sibling plans in this phase also declare them. D-117-12 owns the sweep.
- The phase verifier should rule on finding D5: whether a case that adds a documentation link but no independent failure mode earns its place in the owner.

## Self-Check: PASSED

- `[ -f tests/domain/github-auth.test.ts ]` — FOUND
- `[ ! -e tests/shared/device-flow-prompt.test.ts ]` — confirmed absent
- `git log --oneline --all | grep 4bca542a` — FOUND
- All task acceptance criteria re-run after the commit; every gate in the table above was read at its final state.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*
