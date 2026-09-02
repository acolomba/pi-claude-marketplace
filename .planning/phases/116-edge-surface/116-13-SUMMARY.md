---
phase: 116-edge-surface
plan: "13"
subsystem: testing
tags: [node-test, edge, marketplace, handler-shim, injected-port, strong-mock, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count and an optional stated working directory"
  - phase: 116-edge-surface
    provides: "116-01's args-schema owner, which owns the positional-schema contract this handler consumes and which this owner therefore does not restate"
provides:
  - "tests/edge/handlers/marketplace/update.test.ts — the sole mirrored direct owner for edge/handlers/marketplace/update.ts, at functions 3/3, lines 72/72, branches 11/12"
  - "the normative injected-port (D-116-05 O3, Group B) shape for the three remaining port-carrying handler owners: `createGitOpsFake` compared as a whole call recorder, plus a per-arm strict interaction mock stated in one `when()` and closed with `verify()`"
  - "the measured finding that a FIXTURE, not an assertion, is what makes a delegation proof discriminating — three seeded marketplaces across two scopes give the all-marketplaces arm three fetches and the single-marketplace arm one, so the recorder tells the two arms apart"
  - "the measured finding that a per-arm plant is required when a handler forwards the same port from two call sites: one edit removes one arm's forward and leaves the other arm's cases green"
  - "a sixth D-116-01a-class unreachable branch at edge/handlers/marketplace/update.ts:41, the usage-string collapse arm: proven unreachable four ways, reported here under the locked four-claimant rule, and pinned by its identity once the operator opened the claimant list to measurement"

affects: []

actuals:
  tokens: 5585
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Injected-port delegation: the git port is `createGitOpsFake({ boundary: \"memory\" })` and the whole `state.calls.fetch` array is compared with `deepStrictEqual`. The dir in each expected entry is the clone directory the arrange phase created; `remote` and `ref` are hand-authored literals"
    - "The plugin update port is `mock<EdgeDeps[\"pluginUpdate\"]>({ exactParams: true })` with its complete promised call in one `when()` and `verify()` as the last line. Cases where no cascade may run state NO expectation, so any call throws — a green result is the negative"
    - "Every seeded marketplace is a url source pinned to `main` on a host with no registered auth provider. That is the shape that puts the git port on the refresh path at all (a path source never reaches git) AND keeps the fetch options structured-clonable — a github source would attach a credential bundle whose functions make `createGitOpsFake`'s `structuredClone` recorder throw"
    - "Only one of the three seeded marketplaces carries autoupdate and an installed plugin, so the plugin update port fires on exactly the two selection arms and provably not on the scope-narrowed, scope-target, or rejecting runs"
    - "Every emission, probe, and `cwd` read count in the suite was MEASURED against the real module through a counting proxy before a line was written, never assumed"

key-files:
  created: []
  modified:
    - tests/edge/handlers/marketplace/update.test.ts

key-decisions:
  - "FINDING (blocking the plan's own acceptance criterion) — the pair CANNOT reach 100 percent direct branches without a production edit. `Incomplete direct coverage for extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts: branches 11/12`, functions 3/3, lines 72/72 (baseline was branches 7/9, functions 2/3, lines 64/72). The shortfall is exactly 1 and its identity is `BRDA:41,11,0,0` in the pair's own lcov — line 41, the `message === USAGE ? \"Missing required argument.\" : message` collapse arm. 116-13 was NOT a D-116-01a claimant when this plan ran, so the shortfall was REPORTED rather than pinned; the operator then opened the claimant list to measurement, and the identity is now pinned in the plan verify block and stated in the suite header. No coverage pragma was added at any point"
  - "The collapse arm is unreachable four independent ways. (1) By construction: `parseCommandArgs` calls `onError(schema.usage)` only inside `if (required)`, and this schema declares the sole positional `required: false`, so the callback is only ever reached from `parseArgsOrNotify` with a tokenizer diagnostic. (2) By brute force: 170 argument shapes — empty, whitespace, both quote forms, unbalanced quotes, tabs, newlines, bare `--`, repeated `--scope`, and the usage string itself both bare and quoted — produced zero notifications beginning `Missing required argument.`. (3) Plant C: replacing the arm's literal left all 7 cases GREEN. (4) Plant D: inverting the condition to `message !== USAGE` turned the rejection case RED with the collapsed sentence, proving the pass-through arm is the one that runs"
  - "DEVIATION — the plan's `must_haves` truth 3 promises 'the parse-failure callback collapses the duplicated usage block to the missing-argument sentence and passes any other diagnostic through verbatim'. Only the second half has a reachable target. The plan's `<action>` therefore also asks for 'a diagnostic that is not the usage string reaches the user verbatim … the discriminating case for the collapse rule' — with the collapse arm unreachable, BOTH that case and the unrecognised-scope case take the same else arm, so the second case would have been the first case run twice with a different string, and its diagnostic is already owned by `tests/edge/args.test.ts:176`. Written instead: one rejection case pinning the verbatim pass-through, plus Plants C and D, which state the collapse arm's unreachability as a finding rather than authoring a case that cannot fail"
  - "DEVIATION — the plan's `must_haves` truth 4 ('Each handler owner proves the accepted positional arity, one below it, and one above it … both out-of-range counts are rejected with a usage error before any orchestrator call') is FALSE against this module in two ways, the same class 116-10 recorded. The schema declares ONE OPTIONAL positional, so zero and one are BOTH accepted and there is no count below the accepted range. And `parseCommandArgs` iterates `schema.positional.entries()` — the SCHEMA, not the input — so the second token is never inspected. Measured: `alpha` and `alpha extra` produce byte-identical output. Written instead: a two-row table stating the DROP, both rows carrying the full single-arm delegation proof"
  - "DEVIATION — the plan's `must_haves` truth 5 has two clauses and neither lands here. The router-alias clause belongs to `tests/edge/router.ts`'s owner, not to a handler. The 'mutually exclusive scope flags supplied together are rejected before any orchestrator call' clause has no rejection to prove: this handler never calls `extractLocalFlag`. Measured, and DIFFERENT from 116-10's sibling reading — `marketplace/list.ts` has an empty schema so `--local` is dropped, but here the schema declares a positional, so `--scope user --local` takes `--local` AS THE MARKETPLACE NAME and emits `⊘ --local [user] (failed) {not added}`. Written as that observed outcome, which also proves the single-marketplace arm ran with the token as its name"
  - "DEVIATION — the plan's Plant B as worded ('change the handler to construct a fresh git port instead of forwarding the injected one') and the implicit plugin-update twin each need TWO variants, not one. The handler forwards each port from two separate call sites, one per selection arm. Removing the all-arm `pluginUpdate` forward (Plant E) leaves the named-marketplace cases GREEN, and removing the single-arm forward (Plant E2) leaves the bare and `--scope project` cases GREEN. Each arm's forward is only proven by the plant that targets that arm; a single-site plant would have left half the claim unproven"
  - "The scope proof observes which scope's RECORDS were touched rather than a stated argument list, because the scope member reaches the orchestrator inside an options bag this owner has no injection point against. `alpha` is seeded in BOTH scopes with different clone directories, so a wrong scope shows up as the wrong clone directory in the fetch recorder and the wrong bracket in the row"
  - "No production file was touched. Six plants (A, B, C, D, E, E2, F) were applied to `edge/handlers/marketplace/update.ts` and each reverted from a byte-copy taken before the first plant. `git diff --quiet -- extensions/` exited 0 after the last revert, and the plan's pinned-path check over update.ts, all three handler `shared.ts` files, `flag-catalog.ts`, and `tests/helpers/notification-boundary.ts` exited 0 before staging"

patterns-established:
  - "A delegation proof is made discriminating by the FIXTURE, not by the assertion. One seeded marketplace makes the all-marketplaces and single-marketplace arms indistinguishable; three across two scopes makes the difference visible in the recorder, the emission count, and the row set at once"
  - "When a handler forwards the same injected port from more than one call site, the plant must be applied per site. A whole-file substitution proves the ports are load-bearing somewhere; only the per-site edit proves each arm forwards"
  - "Before choosing a fixture source kind for a port-recording proof, check what the recorder does with the options it is handed. `createGitOpsFake` records via `structuredClone`, so any source kind that attaches a credential bundle (functions) makes the recorder throw. A url source on a provider-less host reaches the same git sequence authless"
  - "A phase-wide `must_haves` truth can be false for one member in a way OPPOSITE to how it was false for its sibling. `--local` is dropped by a zero-positional handler and consumed as the NAME by a one-positional handler. Measure per module; do not carry the sibling's verdict forward"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/handlers/marketplace/update.test.ts owns edge/handlers/marketplace/update.ts, including the previously-uncovered parse-failure callback and early return"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/update.test.ts — 7 runtime cases from 5 marked case bodies, pass 7 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- .../marketplace/update.ts → functions 3/3, lines 72/72 (was 2/3 and 64/72); the callback body and early return are now covered"
        status: pass
  - deliverable: "Both selection arms are proven, and each is proven to be the arm that ran"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/update.test.ts#updates every recorded marketplace in both scopes when no name is supplied — three fetches, three rows"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/marketplace/update.test.ts#updates the named marketplace alone and leaves its siblings untouched at the accepted arity — one fetch, one row"
        status: pass
      - kind: command
        ref: "Plant A — invert the selection guard; 6 of 7 cases go RED, both selection cases among them"
        status: pass
  - deliverable: "Both injected ports reach both workflows"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant B — forward DEFAULT_GIT_OPS instead of deps.gitOps; all 5 delegating cases go RED"
        status: pass
      - kind: command
        ref: "Plant E — drop the all-marketplaces arm's pluginUpdate forward; the bare and --scope project cases go RED on an unmet strong-mock expectation"
        status: pass
      - kind: command
        ref: "Plant E2 — drop the single-marketplace arm's pluginUpdate forward; both named-marketplace rows go RED on the same unmet expectation"
        status: pass
  - deliverable: "The usage block is a hand-authored literal and the pass-through diagnostic reaches the user verbatim"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/marketplace/update.test.ts#reports an unrecognised scope value with the update usage block and never updates"
        status: pass
      - kind: command
        ref: "Plant D — invert the collapse condition; the rejection case goes RED showing the collapsed sentence in place of the tokenizer diagnostic"
        status: pass
  - deliverable: "The scope member reaches the workflow only when supplied, and only the selected scope's records are touched"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant F — delete both conditional scope spreads; both scope rows and the scope-target case go RED"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet -- update.ts handlers/shared.ts marketplace/shared.ts plugin/shared.ts flag-catalog.ts tests/helpers/notification-boundary.ts → exit 0; git log -1 --stat shows 1 file changed"
        status: pass
  - deliverable: "The pair reaches 100 percent direct BRANCH coverage"
    human_judgment: true
    rationale: "NOT achieved and not achievable without a production edit. The pair stands at branches 11/12; the single uncovered branch is the unreachable usage-string collapse arm at update.ts:41. RESOLVED: the operator opened the D-116-01a claimant list to measurement, so update.ts:41 is a claimant and 11/12 is the pinned, argued end state rather than an open gap."

duration: 50 min
completed: 2026-09-02
---

# Phase 116 Plan 13: Marketplace Update Owner Summary

The marketplace update shim now has one exhaustive, hermetic owner that proves its two-way arity
selection in both directions and proves both injected ports reach both workflows, per arm.

## RESOLUTION (operator amendment, 2026-09-02) — this pair is now a D-116-01a claimant

The shortfall below was reported under the original rule, which locked D-116-01a to four named
claimants. The operator has since opened the claimant list to measurement: **any pair that MEASURES
an unreachable branch becomes a claimant and MUST pin the shortfall identity.**

`update.ts:41` is therefore a claim, not an open item. Two things were added and nothing else moved:

- **The suite states the claim.** `tests/edge/handlers/marketplace/update.test.ts` carries a
  D-116-01a header paragraph naming the exact line, the runtime unreachability, and the reason. That
  reason is explicitly NOT a compiler setting: `parseCommandArgs` passes the usage string only for a
  REQUIRED positional, and this schema declares its sole positional `required: false`, so the arm is
  dead for THIS module and stays LIVE for the sibling handlers that declare a required positional.
  D-116-01a as amended requires that distinction to be part of the claim.
- **The plan's verify block pins the identity.** `116-13-PLAN.md` now asserts, from the same gate
  output, that an `Incomplete direct coverage for .../edge/handlers/marketplace/update.ts:` verdict is
  printed with NO `lines` or `functions` clause, and that denominator minus numerator equals exactly
  1. Branch numbers are matched loosely and never pinned as an absolute pair. A passing verdict still
  fails the link. The plan's `must_haves` carries the matching truth.

The measured `branches 11/12` is retained throughout this summary as an observation. Neither the
suite's cases nor any production file changed; the amended verify command was re-run against the
committed pair and exits 0.

## What was built

`tests/edge/handlers/marketplace/update.test.ts` was rewritten from four loose cases built on a
hand-rolled context object into seven runtime cases from five marked bodies, all on the shared strict
boundary:

| Case | Args | Boundary sizing | Fetch recorder | Cascade |
|------|------|-----------------|----------------|---------|
| updates every recorded marketplace in both scopes | `""` | `(3, 6, {cwd, reads: 1})` | 3 clones, project-first | 1 call, verified |
| updates the named marketplace alone (accepted arity / surplus dropped) | `alpha`, `alpha extra` | `(1, 2, {cwd, reads: 1})` | project `alpha` only | 1 call, verified |
| updates the user scope alone | `--scope user` | `(1, 2, {cwd, reads: 1})` | user `alpha` only | no expectation stated |
| updates the project scope alone | `--scope project` | `(2, 4, {cwd, reads: 1})` | project `alpha` + `beta` | 1 call, verified |
| takes the scope-target flag as the marketplace name | `--scope user --local` | `(1, 2, {cwd, reads: 1})` | empty | no expectation stated |
| reports an unrecognised scope value | `--scope bogus` | `(1, 0)`, **no `cwd`** | empty | no expectation stated |

Direct coverage moved from **branches 7/9, functions 2/3, lines 64/72** to **branches 11/12,
functions 3/3, lines 72/72**.

The fixture is what makes the selection proof discriminating: `alpha` and `beta` in the project
scope and a second `alpha` in the user scope, every one a url source pinned to `main`. Only the
project `alpha` carries autoupdate and an installed plugin, so the plugin update port fires on
exactly the two selection arms and provably nowhere else.

Every case owns two `mkdtemp` roots, restores `HOME` and `PI_CODING_AGENT_DIR` through `t.after()`
registered before the act (with the agent-directory variable deleted rather than overwritten), and
installs a context-owned fail-fast replacement for `globalThis.fetch` whose call count is asserted
zero.

## The coverage shortfall (now pinned as a D-116-01a claim)

The pair does **not** reach 100 percent direct branches, and cannot without a production edit:

```text
Incomplete direct coverage for extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts: branches 11/12
```

Functions are 3/3 and lines are 72/72 (the report's uncovered-line column is empty). The shortfall is
exactly 1, and its identity is unambiguous — the pair's own lcov reports

```text
BRDA:41,11,0,0
```

which is line 41 of the module:

```ts
          message: message === USAGE ? "Missing required argument." : message,
```

The `message === USAGE` arm has no reachable target through `makeMarketplaceUpdateHandler`.
`parseCommandArgs` is the only caller that can pass the usage string to the callback, and it does so
only inside `if (required)`; this handler's schema declares its sole positional `required: false`,
so that branch never runs. Every other diagnostic arrives from `parseArgsOrNotify` as a tokenizer
error, which can never equal the usage string.

This was proven four ways — by construction, by a 170-shape brute force, and by two plants (C and D
below). **No coverage-exception pragma was added**, and none is admitted for this class. When this
plan ran, 116-13 was not one of D-116-01a's four claimants, so no shortfall assertion was written;
the amendment recorded in the RESOLUTION section made it one, and the identity pin was added
afterwards without touching a case or a production file. This claim differs in character from the
others: it is not a compiler-forced branch but a defensive collapse that is live for the sibling
handlers which declare a REQUIRED positional and dead for this one — and D-116-01a as amended
requires that distinction to be stated as part of the claim.

## Plants (D-116-04)

Seven plants across six edits, all reverted. Production is byte-identical to HEAD.

### Plant A — invert the selection guard (`parsed.name !== undefined`)

6 of 7 cases RED, both selection cases among them.

```text
✖ updates every recorded marketplace in both scopes when no name is supplied (52.499335ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: 'A marketplace operation has failed.\n\n⊘  (failed) {not added}',
  +     severity: 'error'
  -     message: '● alpha [project] (skipped) {up-to-date}'
      },
  -   { message: '● beta [project] (skipped) {up-to-date}' },
  -   { message: '● alpha [user] (skipped) {up-to-date}' }
    ]
```

```text
✖ updates the named marketplace alone and leaves its siblings untouched at the accepted arity
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at refreshOneMarketplace (.../orchestrators/marketplace/update.ts:775:7)
      at async updateAllMarketplaces (.../orchestrators/marketplace/update.ts:265:5)
      at async .../edge/handlers/marketplace/update.ts:51:7
```

The second output is the boundary firing on an emission past its `times(1)` count — the named case
was sized for one row and the inverted guard fanned out to three.

### Plant B — forward `DEFAULT_GIT_OPS` instead of `deps.gitOps` (both arms)

All 5 delegating cases RED; the two that never reach git stayed green, as they must.

```text
✖ updates every recorded marketplace in both scopes when no name is supplied (107.065345ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: 'Some operations have failed.\n' +
  +       '\n' +
  +       '⊘ alpha [project] (failed)\n' +
  +       '  ⊘ alpha (failed) {network unreachable}\n' +
  +       '    cause: Failed to update marketplace "alpha". -> The function requires a "remote OR url" parameter but none was provided.',
  +     severity: 'error'
  -     message: '● alpha [project] (skipped) {up-to-date}'
      },
```

### Plant C — change the collapse arm's literal (**stayed GREEN — this is the finding**)

```ts
message: message === USAGE ? "PLANT C: this arm is unreachable." : message,
```

```text
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

A plant that stays green is a finding, so the claim was narrowed rather than papered over: the suite
asserts nothing about the collapse arm, and the shortfall is reported above instead of pinned.

### Plant D — invert the collapse condition (`message !== USAGE`)

The rejection case RED, proving the pass-through arm is the one that actually runs.

```text
✖ reports an unrecognised scope value with the update usage block and never updates (31.104891ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: 'Missing required argument.\n' +
  -     message: 'Invalid --scope value: "bogus". Must be "user" or "project".\n' +
          '\n' +
          'Usage: /claude:plugin marketplace update [<name>] [--scope user|project]',
        severity: 'error'
      }
    ]
```

### Plant E — drop the all-marketplaces arm's `pluginUpdate` forward

The bare case and the `--scope project` row RED; the named rows stayed green because their arm's
forward was intact.

```text
✖ updates every recorded marketplace in both scopes when no name is supplied (79.624368ms)
  Error: There are unmet expectations:

   - when(() => plugin update("hello", "alpha", "project")).thenResolve({"declaresAgents": false, "declaresMcp": false, "fromVersion": "0.0.1", "name": "hello", "partition": "unchanged", "toVersion": "0.0.1"}).between(1, 1)
      at verifyRepo (.../node_modules/strong-mock/dist/index.js:903:11)
```

### Plant E2 — drop the single-marketplace arm's `pluginUpdate` forward

The mirror image: both named rows RED, the all-arm cases green.

```text
✖ updates the named marketplace alone and leaves its siblings untouched at the accepted arity (52.395438ms)
  Error: There are unmet expectations:

   - when(() => plugin update("hello", "alpha", "project")).thenResolve({"declaresAgents": false, "declaresMcp": false, "fromVersion": "0.0.1", "name": "hello", "partition": "unchanged", "toVersion": "0.0.1"}).between(1, 1)
✖ updates the named marketplace alone and leaves its siblings untouched with a surplus positional token dropped (35.800571ms)
  Error: There are unmet expectations: …
```

### Plant F — delete both conditional scope spreads

Both scope rows and the scope-target case RED.

```text
✖ updates the user scope alone when --scope user narrows the command (38.260318ms)
  TypeError: ctx.ui.notify is not a function
      at emitWithSummary (.../shared/notify.ts:3658:12)
      at refreshOneMarketplace (.../orchestrators/marketplace/update.ts:775:7)
      at async updateAllMarketplaces (.../orchestrators/marketplace/update.ts:265:5)
```

The user-scope case was sized for one emission; without the scope member the workflow enumerated
both scopes and the boundary caught the second emission where it was made.

## Deviations from Plan

### 1. [Rule 1 — false plan claim] `must_haves` truth 3: the collapse arm has no reachable target

- **Found during:** Task 1, reading `edge/args-schema.ts` before writing a line.
- **Issue:** The truth promises the callback "collapses the duplicated usage block to the
  missing-argument sentence". `parseCommandArgs` reaches `onError(schema.usage)` only for a REQUIRED
  positional; this schema declares `required: false`. The plan's `<action>` then asks for a case
  that discriminates the collapse rule — with the collapse arm dead, that case takes the same arm as
  the unrecognised-scope case and would have been the first case run twice with a different string,
  and its diagnostic is already owned by `tests/edge/args.test.ts:176`.
- **Fix:** Wrote one rejection case pinning the verbatim pass-through. Proved the collapse arm dead
  four ways and reported the resulting `branches 11/12` shortfall rather than pinning or excepting it.
- **Commit:** `0ef8ee23`

### 2. [Rule 1 — false plan claim] `must_haves` truth 4: one optional positional has no arity below it and rejects nothing above it

- **Found during:** Task 1.
- **Issue:** The schema declares ONE OPTIONAL positional, so zero and one are both accepted and no
  count exists below the range. `parseCommandArgs` walks the schema rather than the input, so the
  second token is never inspected. Measured: `alpha` and `alpha extra` produce byte-identical output.
- **Fix:** Wrote a two-row table stating the DROP, both rows carrying the full single-arm delegation
  proof, so neither row is decorative.
- **Commit:** `0ef8ee23`

### 3. [Rule 1 — false plan claim] `must_haves` truth 5 has no target, and fails differently than it did for the sibling

- **Found during:** Task 1.
- **Issue:** The router-alias clause is not a handler's business. The mutually-exclusive-selector
  clause has no rejection: this handler never calls `extractLocalFlag`. Where `marketplace/list.ts`
  DROPS `--local` (116-10), this handler takes it AS THE MARKETPLACE NAME, because its schema
  declares a positional to bind it to.
- **Fix:** Wrote the observed outcome — `⊘ --local [user] (failed) {not added}` — which doubles as a
  proof that the single-marketplace arm ran with the token as its name.
- **Commit:** `0ef8ee23`

### 4. [Rule 1 — plan plant is under-scoped] Each port forward needs a per-arm plant

- **Found during:** Task 1, plant phase.
- **Issue:** The handler forwards each port from two call sites. Removing one arm's forward leaves
  the other arm's cases green, so a single-site plant proves only half the claim.
- **Fix:** Ran Plant E (all arm) and Plant E2 (single arm) separately; both outputs recorded above.
  Plant B was applied to both `gitOps` sites at once and turned all five delegating cases red, which
  covers both arms for the git port.
- **Commit:** `0ef8ee23`

### 5. [Rule 3 — fixture blocker] A github-source fixture breaks the git recorder

- **Found during:** Task 1, fixture selection.
- **Issue:** A github source resolves an auth provider for `github.com`, so `refreshGitHubClone`
  attaches a `GitAuthBundle` to the fetch options. `createGitOpsFake` records via `structuredClone`,
  which throws on the bundle's functions.
- **Fix:** Seeded url sources on `gitlab.example.com`, a host with no registered provider. The same
  fetch → resolveRef → forceUpdateRef → checkout sequence runs authless and the recorder stays
  clonable.
- **Commit:** `0ef8ee23`

**Total deviations:** 5 (3 false `must_haves` truths corrected, 1 plant scope corrected, 1 fixture
blocker resolved).
**Impact:** The owner asserts only what the module can falsify. No claim was weakened to go green;
the one claim that could not be met — 100 percent branches — is reported as a finding rather than
bought with a pragma or a production edit.

## Scoped gap (D-116-05, O3, Group B)

`deps.gitOps` and `deps.pluginUpdate` are injected, so this owner states exact arguments against the
plugin update port. The two orchestrator functions themselves are reached by direct import with no
injection point, so the options bag they receive is observed as effects — which clones the git port
fetched, which scope's rows were emitted — rather than as a stated argument list. That residual gap
is scoped, not missed.

## Verification

Every gate run separately, exit code checked individually. `npm run check` was NOT used (its
`format:check` link short-circuits on pre-existing untracked operator files).

| Gate | Result |
|------|--------|
| `node --test tests/edge/handlers/marketplace/update.test.ts` | pass 7, fail 0 |
| `npm run test:coverage:direct -- .../marketplace/update.ts` | **exit 1** — branches 11/12; functions 3/3, lines 72/72 (see the shortfall section) |
| `npm run typecheck` | exit 0 |
| `npm run lint` (whole repo) | exit 0 |
| `npm exec -- eslint <file>` | exit 0 |
| `npm exec -- prettier --check <file>` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | 5044/5044 across 291 suites, exit 0 (was 5041) |
| `npm run test:integration` | 31/31, exit 0 |
| anti-pattern scan (`! rg …`) | no matches |
| `rg -c '^\s+// arrange$'` | 5 (equals the marked case-body count) |
| `git diff --check` | clean |
| `git diff --quiet` over pinned production paths | exit 0 |
| trufflehog filesystem scan | chunks 2, bytes 19190, verified 0, unverified 0 |
| `SKIP=trufflehog,npm-format-check pre-commit run --files <file>` | exit 0 |

## Issues Encountered

One, since resolved: the direct-coverage gate exits 1 at branches 11/12 because of the unreachable
collapse arm at `update.ts:41`. This was the plan's own acceptance criterion and it cannot be met
without a production edit that the spent licence forbids. The operator's amendment made this pair a
D-116-01a claimant, so the shortfall is now a pinned claim rather than an unmet criterion. See the
shortfall section for the four independent unreachability proofs and the `BRDA:41,11,0,0` identity.

## Next Phase Readiness

Wave 3 is closed. The injected-port (Group B) shape is the reusable output for 116-07
(`marketplace/add`), 116-14 (`plugin/bootstrap`), and 116-17 (`plugin/import`), together with the
per-arm plant discipline and the url-source fixture rule.

## Self-Check: PASSED

- `tests/edge/handlers/marketplace/update.test.ts` exists on disk.
- `git log --oneline --all | grep 0ef8ee23` returns the task commit.
- All plan `<verify>` links re-run at close-out; every one passed except the direct-coverage link,
  whose failure is the recorded finding above.
- `git diff --stat -- extensions/` is empty; no production file changed.
