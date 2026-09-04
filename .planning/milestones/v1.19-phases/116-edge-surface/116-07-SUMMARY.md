---
phase: 116-edge-surface
plan: "07"
subsystem: testing
tags: [node-test, edge, marketplace, handler-shim, injected-port, strong-mock, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-12's owner for `openMarketplaceCommand`, which owns the flag scan, the positional parse, and the usage-collapse comparison this shim consumes and which this owner therefore does not restate"
  - phase: 116-edge-surface
    provides: "116-26's owner for `extractLocalFlag`, which owns the unknown-long-flag rejection rule itself"
provides:
  - "tests/edge/handlers/marketplace/add.test.ts — the sole mirrored direct owner for edge/handlers/marketplace/add.ts, at branches 8/8, functions 2/2, lines 48/48"
  - "the port-forwarding proof shape for the remaining port-carrying handler owners: `createGitOpsFake` driven by a url source the workflow must clone, with the whole clone recorder compared as one value after substituting a token for the `randomUUID()` staging leaf"
  - "the measured finding that a delegation proof can observe SCOPE and the scope-target flag as an on-disk footprint — which scope root holds `state.json`, and whether the write-back landed in `claude-plugins.json` or `claude-plugins.local.json` — rather than through an options bag the edge tier has no injection point against"
  - "the measured finding that `--scope <value>` and the scope-target flag are NOT mutually exclusive on this handler: `extractLocalFlag` consumes the scope pair as downstream-owned and removes only the scope-target token, so both members reach the workflow"

affects: []

actuals:
  tokens: 5650
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Injected-port delegation: the git port is `createGitOpsFake({ boundary: \"memory\", allowedRemoteUrls, cloneFixture })` and the whole `state.calls.clone` array is compared with `deepStrictEqual`. The staging `dir` carries a `randomUUID()` leaf, so a leaf that is a UUID under the EXPECTED scope's staging root is substituted for a stable token and any other directory is compared verbatim — the whole value stays comparable and a clone into the wrong scope root still fails on its directory"
    - "Every driven source is `https://gitlab.example.com/team/alpha#main`, a url on a host with no registered auth provider. That is the shape that puts the git port on the clone path at all (a path source never reaches git) AND keeps the clone options structured-clonable — a github source resolves the GitHub provider and attaches a credential bundle whose functions make the fake's `structuredClone` recorder throw"
    - "Scope and the scope-target flag are proven as an on-disk footprint: `{ user: { state, config, localConfig }, project: { … } }` read back through `locationsFor` and compared as one whole value against a hand-authored literal. The scope-target flag switches the config write-back from `claude-plugins.json` to `claude-plugins.local.json`, which is what makes 'present only when supplied' provable rather than asserted"
    - "The `pluginUpdate` port is `mock<EdgeDeps[\"pluginUpdate\"]>({ exactParams: true })` with NO expectation stated and `verify()` as the last line. A green case is the proof this handler never touches it; an expectation of zero calls would not be"
    - "Every emission, probe, and `cwd` read count in the suite was MEASURED against the real module through a counting proxy before a line was written, never assumed: delegating cases are `(1, 2, { value: cwd, reads: 1 })`, rejecting cases are `(1, 0)` with no `cwd` stated"

key-files:
  created: []
  modified:
    - tests/edge/handlers/marketplace/add.test.ts

key-decisions:
  - "The pair holds 100 percent direct coverage — `branches 8/8, functions 2/2, lines 48/48`, byte-identical to the baseline the plan measured. Nothing was dropped by the thinner rewrite (T-116-07-B), and this pair is NOT a D-116-01a claimant: no unreachable branch was measured, so nothing is filed in `.planning/WINDOWS.md`"
  - "DEVIATION — the plan's `must_haves` truth 4 ('one above the accepted arity is rejected with a usage error before any orchestrator call') is FALSE against this module, the same class 116-10 and 116-13 recorded. `parseCommandArgs` iterates `schema.positional.entries()` — the SCHEMA, not the input — so a second token is never inspected. Measured: `<url>` and `<url> extra` produce byte-identical output, the same notification, the same footprint, and the same single clone. Written instead as a two-row table stating the DROP, both rows carrying the full delegation proof so neither row is decorative"
  - "DEVIATION — the plan's `must_haves` truth 5 has two clauses and neither lands as written. The router-alias clause belongs to the router owner, not to a handler. The 'mutually exclusive scope flags supplied together are rejected' clause has no rejection to prove: `extractLocalFlag` consumes `--scope <value>` as a downstream-owned pair (`i += 2`) and filters only the scope-target token out of the residual, so `--scope project --local` carries BOTH members into the workflow. Measured and written as that observed outcome, with the project-scope root holding `state.json` and `claude-plugins.local.json` at once — a combination no other case in the suite produces"
  - "DEVIATION — the plan asks for the clone recorder 'compared as one whole value against a hand-authored literal'. Not literally achievable: `addGitClonedInGuard` stages into `locations.sourcesStagingDir(randomUUID())`, so the recorded `dir` cannot be a literal. Deriving the expectation from the actual is forbidden by the task's own acceptance criteria. Resolved by substituting a stable token for a leaf that is a UUID under the EXPECTED scope's staging root and comparing every other directory verbatim, which keeps the whole-value comparison AND makes the staging root a second, independent scope proof"
  - "The port forward sites were COUNTED before planting, per the 116-13 under-scoping finding: `grep -c deps.gitOps` reports 2, but one hit is the module's own header comment — there is exactly ONE real forward site (`add.ts:44`). A single plant is therefore in scope here, and Plant A turned all seven clone-carrying cases red at once"
  - "DEVIATION — the plan's unknown-long-flag and unrecognised-scope cases restate diagnostics that `tests/edge/handlers/shared.test.ts` and `tests/edge/args.test.ts` already own, which the plan's own action forbids. Their claim was NARROWED rather than dropped: each proves this handler's private USAGE string reached a DIFFERENT consumer inside `openMarketplaceCommand` (the flag scan and the positional parse), and that the `opened === undefined` early return left the workflow, the git port, and the disk untouched. That is handler-owned and unreachable from either sibling owner"
  - "The omitted-scope default is proven THREE ways at once, because the plan asked which observation was used: the notification's `[user]` bracket, the `state.json` and `claude-plugins.json` landing under the temporary HOME rather than under `<cwd>/.pi`, and the clone staging root the recorder carries. Plant B (default flipped to the project scope) turned exactly the five scope-omitted cases red and left both explicit-scope cases green, which is what proves the default is the thing being read"
  - "No production file was touched. Five plants (A, B, C, D, D2) were applied to `edge/handlers/marketplace/add.ts` and each reverted from a byte-copy taken before the first plant. `git diff --quiet -- extensions/` exited 0 after the last revert, and the plan's pinned-path check over add.ts, all three handler `shared.ts` files, `flag-catalog.ts`, and `tests/helpers/notification-boundary.ts` exited 0 before staging"

patterns-established:
  - "When a delegated argument reaches the workflow inside an options bag the edge tier cannot intercept, observe WHERE THE COMMAND LANDED instead of what was passed. A per-scope on-disk footprint compared as one whole value discriminates scope, the scope-target flag, and the rejection cases' silence in a single assertion"
  - "A recorder entry carrying a non-deterministic path segment is still comparable as one whole value: substitute a token ONLY when the segment matches the shape expected under the EXPECTED root, and compare anything else verbatim. The substitution then carries information instead of discarding it — a wrong root fails on the raw directory"
  - "Count a port's forward sites before planting, then state the count. One site means one plant is in scope; recording the count is what separates 'in scope' from the under-scoped single plant 116-13 found"
  - "A plant that makes a rejection path delegate needs TWO variants. Handing the workflow `ctx.cwd` on a case that never states `cwd` fails inside `path.join` on strong-mock's pending-call proxy — a real boundary catch, but not the emission proof. The second variant hands the workflow a literal working directory, and the RED then comes from the emission count as `ctx.ui.notify is not a function`"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/marketplace/add.test.ts owns edge/handlers/marketplace/add.ts at full direct coverage"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/add.test.ts — 11 runtime cases from 8 marked bodies, pass 11 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- .../marketplace/add.ts → Direct coverage passed (branches 8/8, functions 2/2, lines 48/48)"
        status: pass
  - deliverable: "The injected git port reaches the add workflow, proven by the port recording the clone the workflow performed"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/add.test.ts#clones through the injected port into the user scope when no scope flag narrows the command at the accepted arity"
        status: pass
      - kind: command
        ref: "Plant A — drop the sole `gitOps: deps.gitOps` forward; all 7 clone-carrying cases go RED with `{network unreachable}`, the path-source case and the three rejections stay green"
        status: pass
  - deliverable: "An omitted scope flag reaches the workflow as the user default and a supplied one reaches it unchanged"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/add.test.ts#clones into the project scope when --scope project selects it"
        status: pass
      - kind: command
        ref: "Plant B — flip the default to the project scope; exactly the 5 scope-omitted cases go RED, both explicit-scope cases stay green"
        status: pass
  - deliverable: "The scope-target flag reaches the workflow only when supplied, independent of its position"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/add.test.ts#records the marketplace in the per-machine config when the scope-target flag is supplied before the source"
        status: pass
      - kind: command
        ref: "Plant C — delete the conditional `local: true` spread; exactly the 3 scope-target cases go RED on the config footprint"
        status: pass
  - deliverable: "Both out-of-range and malformed argument shapes leave the workflow, the git port, and the disk untouched"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/add.test.ts#collapses the duplicated usage block to one sentence when no source is supplied and adds nothing"
        status: pass
      - kind: command
        ref: "Plant D2 — make the rejection path delegate with a fully valid options bag; all 3 rejection cases go RED with `ctx.ui.notify is not a function`"
        status: pass
  - deliverable: "A path source completes without ever reaching the git port it was handed, and no case reaches the network (NFR-5)"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/add.test.ts#adds a path source without ever reaching the git port it was handed (NFR-5) — empty clone recorder, fetch call count 0"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet -- add.ts handlers/shared.ts marketplace/shared.ts plugin/shared.ts flag-catalog.ts tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass
      - kind: command
        ref: "npm test 5047/5047, npm run test:integration 31/31, npm run typecheck 0, npm run lint 0, npm run fallow 0, prettier --check 0"
        status: pass

duration: 35 min
completed: 2026-09-02
---

# Phase 116 Plan 07: Marketplace Add Owner Summary

The marketplace add shim now has one exhaustive, hermetic owner that proves the injected git port
reaches the add workflow, and proves the scope and scope-target selections by where the command
actually landed on disk.

## What was built

`tests/edge/handlers/marketplace/add.test.ts` was rewritten from eight loose cases built on a
hand-rolled context object and a hand-wrapped git port into **11 runtime cases from 8 marked
bodies**, all on the shared strict boundary:

| Case | Args | Boundary sizing | Clone recorder | Footprint |
|------|------|-----------------|----------------|-----------|
| clones into the user scope, no scope flag (accepted arity / surplus dropped) | `<url>`, `<url> extra` | `(1, 2, {cwd, reads: 1})` | 1 clone, user staging root | user state + base config |
| clones into the user scope, `--scope user` | `<url> --scope user` | `(1, 2, {cwd, reads: 1})` | 1 clone, user staging root | user state + base config |
| clones into the project scope, `--scope project` | `<url> --scope project` | `(1, 2, {cwd, reads: 1})` | 1 clone, project staging root | project state + base config |
| per-machine config when the scope-target flag is supplied (after / before the source) | `<url> --local`, `--local <url>` | `(1, 2, {cwd, reads: 1})` | 1 clone, user staging root | user state + **local** config |
| carries a scope flag and the scope-target flag through together | `<url> --scope project --local` | `(1, 2, {cwd, reads: 1})` | 1 clone, project staging root | project state + **local** config |
| adds a path source without reaching the git port (NFR-5) | `<tmp source tree>` | `(1, 2, {cwd, reads: 1})` | **empty** | user state + base config |
| collapses the duplicated usage block, adds nothing | `""` | `(1, 0)`, **no `cwd`** | empty | nothing written |
| reports an unknown long flag, adds nothing | `<url> --frobnicate` | `(1, 0)`, **no `cwd`** | empty | nothing written |
| shows an unrecognised scope value verbatim, adds nothing | `<url> --scope bogus` | `(1, 0)`, **no `cwd`** | empty | nothing written |

Direct coverage is unchanged at **branches 8/8, functions 2/2, lines 48/48** — the rewrite dropped
nothing the old suite covered incidentally, which is what T-116-07-B asked to re-measure.

Every case owns three `mkdtemp` roots (working directory, home, source tree), restores `HOME` and
`PI_CODING_AGENT_DIR` through `t.after()` registered before the act (with the agent-directory
variable **deleted** rather than overwritten, because `getAgentDir()` reads it before `homedir()`),
and installs a context-owned fail-fast replacement for `globalThis.fetch` whose call count is
asserted zero.

### The forward proof

Every delegating case drives `https://gitlab.example.com/team/alpha#main` — a url source on a host
with **no registered auth provider**. That choice is load-bearing twice over: a path source never
reaches git at all, and a github source would resolve the GitHub provider and attach a
`GitAuthBundle` whose functions make `createGitOpsFake`'s `structuredClone` recorder throw (the
finding 116-13 measured). The url path runs the same clone sequence authless, so the recorded
options carry no `auth` key and the whole value stays comparable:

```ts
const ALPHA_CLONE: GitCloneCall = {
  dir: STAGED_CLONE_DIR,
  url: "https://gitlab.example.com/team/alpha.git",
  ref: "main",
  singleBranch: true,
};
```

`STAGED_CLONE_DIR` is the substitution described under Deviation 3. The old suite hand-wrapped
`createGitOpsFake`'s `clone` to strip the credential bundle; choosing the right source kind removes
the wrapper entirely, which is what the plan's "never a hand-rolled object literal of git functions"
rule is really protecting.

### The scope proof

The scope member reaches the workflow inside an options bag this owner has no injection point
against, so each case reads back **where the command landed**:

```ts
assert.deepStrictEqual(await readAddFootprint(cwd), {
  user: { state: true, config: false, localConfig: true },
  project: { state: false, config: false, localConfig: false },
});
```

The scope-target flag is visible in the same value: it switches the config write-back from
`claude-plugins.json` to `claude-plugins.local.json`. That is what makes "present as a member only
when supplied" a measurement rather than an assertion — and it is why Plant C fails on the footprint
rather than on a notification.

## Plants (D-116-04)

Five plants across four edits, all reverted. Production is byte-identical to HEAD
(`git diff --quiet -- extensions/` exits 0).

**Forward sites were counted first.** `grep -c deps.gitOps` reports 2, but one hit is the module's
own header comment; there is exactly **one** real forward site, `add.ts:44`. One plant is therefore
in scope, unlike the two-site case 116-13 measured.

### Plant A — delete the sole `gitOps: deps.gitOps` forward

All 7 clone-carrying cases RED. The path-source case and the three rejections stayed green, as they
must — they never reach git.

```text
✖ clones through the injected port into the user scope when no scope flag narrows the command at the accepted arity (117.470014ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: 'A marketplace operation has failed.\n' +
  +       '\n' +
  +       '⊘ https://gitlab.example.com/team/alpha#main [user] (failed) {network unreachable}',
  +     severity: 'error'
  -     message: '● seeded [user] (added)'
      }
    ]
```

`ℹ pass 4 / ℹ fail 7`. Without the forward the workflow fell back to `DEFAULT_GIT_OPS` and reached a
real transport, which the hermetic tree turns into `{network unreachable}`.

### Plant B — flip the scope default from `"user"` to `"project"`

Exactly the 5 scope-omitted cases RED; both explicit-scope cases green.

```text
✖ clones through the injected port into the user scope when no scope flag narrows the command at the accepted arity (73.094518ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
      {
  +     message: '● seeded [project] (added)'
  -     message: '● seeded [user] (added)'
      }
    ]
```

`ℹ pass 6 / ℹ fail 5`. The two `--scope` cases staying green is the discriminating half: they never
consult the default.

### Plant C — delete the conditional `...(opened.local && { local: true })` spread

Exactly the 3 scope-target cases RED, on the footprint rather than the notification — the row is
identical either way, which is why the on-disk observation is the one that carries the claim.

```text
✖ records the marketplace in the per-machine config when the scope-target flag is supplied after the source (50.318431ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    {
      project: {
        config: false,
        localConfig: false,
        state: false
      },
      user: {
  +     config: true,
  +     localConfig: false,
  -     config: false,
  -     localConfig: true,
        state: true
      }
    }
```

`ℹ pass 8 / ℹ fail 3`.

### Plant D — make the `opened === undefined` arm delegate with `ctx.cwd`

All 3 rejection cases RED, but for the mechanism the phase's findings warn about: the rejection
cases state no `cwd`, so strong-mock's pending-call proxy flowed into `addedFromCwd` and died in
schema validation rather than at the emission count.

```text
✖ collapses the duplicated usage block to one sentence when no source is supplied and adds nothing (18.802473ms)
  Error: saveState refused: in-memory state failed schema validation: /marketplaces/seeded/addedFromCwd: must be string
      at saveState (.../persistence/state-io.ts:488:11)
      at Object.save (.../transaction/with-state-guard.ts:99:45)
      at async .../edge/handlers/marketplace/add.ts:35:7
```

That is a real boundary catch — the case proved `ctx.cwd` is never read on a rejection — but it is
not the emission proof, so a second variant was run.

### Plant D2 — the same arm delegating with a literal working directory

All 3 rejection cases RED at the emission count, which is the proof the cases actually claim.

```text
✖ collapses the duplicated usage block to one sentence when no source is supplied and adds nothing (19.30836ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at notifyWithContext (.../shared/notify-context.ts:174:3)
      at addMarketplace (.../orchestrators/marketplace/add.ts:627:3)
      at async .../edge/handlers/marketplace/add.ts:35:7
```

`ℹ pass 8 / ℹ fail 3`. No plant stayed green.

## Deviations from Plan

### 1. [Rule 1 — false plan claim] `must_haves` truth 4: one above the accepted arity is not rejected

- **Found during:** Task 1, measuring the module before writing a line.
- **Issue:** The truth promises "both out-of-range counts are rejected with a usage error before any
  orchestrator call". `parseCommandArgs` iterates `schema.positional.entries()` — the SCHEMA, not the
  input — so a second token is never inspected. Measured: `<url>` and `<url> extra` produce the same
  notification, the same footprint, and the same single clone.
- **Fix:** A two-row table stating the DROP, both rows carrying the full delegation proof. The plan's
  `<action>` already anticipated this ("state the observed outcome from the module source"); the
  `must_haves` truth did not.
- **Commit:** `657fdd2c`

### 2. [Rule 1 — false plan claim] `must_haves` truth 5: neither clause lands here

- **Found during:** Task 1.
- **Issue:** The router-alias clause is not a handler's business. The mutually-exclusive-selector
  clause has no rejection to prove: `extractLocalFlag` treats `--scope <value>` as a
  downstream-consumed pair (`i += 2`) and filters only the scope-target token from the residual, so
  `--scope project --local` carries both members into the workflow.
- **Fix:** Wrote the observed outcome — the project scope root holding `state.json` and
  `claude-plugins.local.json` at once, a combination no other case in the suite produces, so the row
  is discriminating rather than decorative.
- **Commit:** `657fdd2c`

### 3. [Rule 3 — blocker] The clone recorder cannot hold a hand-authored directory literal

- **Found during:** Task 1, writing the forward proof.
- **Issue:** The plan asks for the recorder "compared as one whole value against a hand-authored
  literal". `addGitClonedInGuard` stages into `locations.sourcesStagingDir(randomUUID())`, so the
  recorded `dir` is non-deterministic. Reading it back off the actual is exactly the
  "expectation transformed from an actual" the task's acceptance criteria forbid.
- **Fix:** `describeClone(call, stagingRoot)` substitutes the token `<sources-staging>/<uuid>` ONLY
  for a leaf that is a UUID under the EXPECTED scope's staging root, and returns any other directory
  verbatim. The comparison stays one `deepStrictEqual` over the whole recorder, and the substitution
  carries information rather than discarding it: a clone into the wrong scope root fails on its raw
  directory. Plants A and B both exercise that path.
- **Commit:** `657fdd2c`

### 4. [Rule 1 — restated fact] The two flag-diagnostic cases would have restated sibling owners

- **Found during:** Task 1, reading `tests/edge/handlers/marketplace/shared.test.ts` and
  `tests/edge/handlers/shared.test.ts`.
- **Issue:** The plan asks for "exactly one notification carrying the unknown-flag sentence" and one
  "carrying the parse diagnostic". 116-26 already owns the unknown-long-flag rule and 116-12 already
  owns both `openMarketplaceCommand` reject arms including the collapse comparison, so the sentences
  themselves are not this owner's to claim — and the plan's own action forbids restating them.
- **Fix:** Kept both cases and narrowed the claim they carry. Each proves that this handler's private
  `USAGE` constant reached a DIFFERENT consumer inside `openMarketplaceCommand` — the flag scan and
  the positional parse — and that the `opened === undefined` early return left the workflow, the git
  port, and the disk untouched. Neither fact is reachable from either sibling owner. Recorded here
  because the marginal value of the third rejection case is the usage-string forward, not the
  diagnostic.
- **Commit:** `657fdd2c`

### 5. [Rule 2 — under-specified plant] The rejection plant needs two variants

- **Found during:** Task 1, plant phase.
- **Issue:** A plant that makes the rejection arm delegate can go RED for the wrong reason. Handing
  the workflow `ctx.cwd` on a case that states no `cwd` fails inside the persistence layer on
  strong-mock's pending-call proxy, which proves the `cwd` absence but not the emission count.
- **Fix:** Ran Plant D (with `ctx.cwd`) and Plant D2 (with a literal working directory). Both
  outputs are recorded above; D2 is the one that fires the emission-count boundary.
- **Commit:** `657fdd2c`

**Total deviations:** 5 auto-fixed (2 false plan claims, 1 blocker, 1 restated-fact narrowing,
1 under-specified plant). **Impact:** no production change, no weakened claim; three plan-specified
promises were narrowed to what the module can actually discriminate and the reasons are recorded.

## Authentication Gates

None.

## Issues Encountered

None.

## Deferred Issues

None. This pair is not a D-116-01a claimant — no unreachable branch was measured, so nothing was
filed in `.planning/WINDOWS.md`. No stub, skipped test, or unrun `<verify>` exists in this pair.

## Verification

Each gate was run separately and its exit code checked. `npm run check` was NOT used: its
`format:check` link fails on pre-existing untracked operator files and short-circuits before the
tests run.

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/marketplace/add.test.ts` | pass 11, fail 0 |
| `npm run test:coverage:direct -- .../marketplace/add.ts` | `Direct coverage passed … (branches 8/8, functions 2/2, lines 48/48)` |
| `npm run typecheck` | 0 |
| `npm exec -- eslint tests/edge/handlers/marketplace/add.test.ts` | 0 |
| `npm exec -- prettier --check tests/edge/handlers/marketplace/add.test.ts` | 0 |
| `npm run fallow` | 0 |
| anti-pattern scan (`! rg -n …`) | 0 (no match) |
| `rg -c '^\s+// arrange$'` | 8 markers, equal to the 8 case bodies |
| `git diff --check` | 0 |
| `git diff --quiet` over the 6 pinned paths | 0 |
| `npm test` | 5047/5047 |
| `npm run test:integration` | 31/31 |
| `npm run lint` | 0 |
| trufflehog filesystem scan | `chunks: 2, bytes: 22597, verified_secrets: 0, unverified_secrets: 0` |
| `SKIP=trufflehog,npm-format-check pre-commit run --files …` | 0, all hooks passed |

## Next Phase Readiness

Ready for 116-14 (`plugin/bootstrap`), which carries the same `deps.gitOps` port and copies the shape
established here. Two things to carry across: **count the forward sites before planting**, and
`bootstrap.ts` calls `notify()`, so its boundary states a real `toolProbes` count rather than 0.

## Self-Check: PASSED

- `tests/edge/handlers/marketplace/add.test.ts` exists on disk.
- `git log --oneline --all | grep 657fdd2c` returns the task commit; `git log -1 --stat` shows one
  file changed.
- Every `<acceptance_criteria>` item was re-run after the last revert and passes; the table above
  records each result.
