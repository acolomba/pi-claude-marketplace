---
phase: 116-edge-surface
plan: "28"
subsystem: testing
tags: [node-test, edge, register, registration-glue, autocomplete, callback-capture, mod-09]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's `createNotificationBoundary(emissions, toolProbes, cwd?)` — the strict Pi boundary with a required probe count"
  - phase: 116-edge-surface
    provides: "116-29's `edge/router.ts` owner, which owns the subcommand dispatch matrix and pins both usage blocks against hand-authored copies"
  - phase: 116-edge-surface
    provides: "116-27's `edge/handlers/tools.ts` owner, which owns both tool bodies and the narrowed `registerTool` property shape this suite reuses"
  - phase: 116-edge-surface
    provides: "116-05's `edge/completions/provider.ts` owner and 116-03's `edge/completions/data.ts` owner, which own the completion candidate sets"
  - phase: 116-edge-surface
    provides: "116-04's `edge/completions/normalize.ts` owner, which owns the whitespace collapse and the command-line recogniser"
provides:
  - "tests/edge/register.test.ts — the sole mirrored direct owner for edge/register.ts, at 100 percent direct functions, lines AND branches"
  - "a MEASURED correction to a stated fact: the working directory is read when the completion callback RUNS, not when the command is registered — two production comments and the plan's own must_haves assert the opposite"
  - "a plan whose literal plant has NO TARGET, because the plant's premise was already true; the mirror was run instead"
  - "a worked pattern for owning a registration table: every name an EXACT argument in the expectation, only the callback beside it captured"
  - "the edge tier's correspondence closed — all 30 sources under extensions/pi-claude-marketplace/edge/ have a mirrored owner"

affects: []

actuals:
  tokens: 24000
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Capture the callback, then INVOKE it. A registration assertion leaves the callback body unexecuted, which is exactly why two functions in this module were unreached by a thirteen-case suite that asserted registration thoroughly"
    - "`It.willCapture` is the sanctioned tool for a callback argument, and only for the callback. The house rules permit a matcher for a value that cannot be compared structurally; the name beside it is still an exact hand-authored argument, so a registration under a different name has no expectation and fails at the call site"
    - "A two-root case is what separates a registration-time read from an invocation-time read. Register while the process sits in one root, move it to a second, then drive the callback — without the move, the case passes for either implementation"
    - "Give an untouched-value claim a value that WOULD have changed. A pass-through asserted over a result with no collapsible whitespace passes for a wrapper that normalises unconditionally; both untouched-line cases carry a doubled space at the cursor, so the identity claim is a value comparison rather than a reference check"

key-files:
  created: []
  modified:
    - tests/edge/register.test.ts

key-decisions:
  - "MEASURED — the plan's `must_haves` truth 'The working directory captured at registration is the one the completion callback resolves against' is FALSE against the module. `process.cwd()` is evaluated INSIDE the `getArgumentCompletions` arrow (`register.ts:107-108`), so it is read on every completion invocation and nothing is closed over. The case was written to the measured behaviour — register in one hermetic root, `process.chdir` to a second, drive the callback, assert the SECOND root's marketplace names — and Plant C (hoisting the read into a `registrationCwd` binding above `pi.registerCommand`) turned exactly that case RED with `registration-mp` where `invocation-mp` was expected. That RED is the measurement: the case discriminates the two implementations, which is what the two-root form exists for"
  - "MEASURED — the plan's literal Plant 3 ('move the working-directory read from registration time into the completion callback, confirm the two-root case goes RED') has NO TARGET. The read is already in the callback, so the plant is a zero-diff edit and cannot redden anything. The mirror was run in its place and recorded above. Same family as 116-24's wrong-plant row: run the form that reaches the behaviour, and say the plan's premise was false rather than silently substituting"
  - "REPORTED, NOT FIXED — two production comments assert the property the code does not have. `register.ts:18-20` says 'The cwd captured here is per-command-registration' and `register.ts:104-106` says 'Captured at registration time; threads through every keystroke's completion lookup via the closed-over resolver'. Behaviourally harmless today (`index.ts` registers once per session and Pi does not change directory), but one of the two is wrong and an operator has to say which. Both production licences for this phase are spent, so nothing was edited. Filed as WINDOWS ledger entry 20"
  - "A registration table is almost entirely DATA, so 116-05's and 116-19's data-field warning binds hardest here: coverage cannot see a wrong wiring. Every name is a hand-authored literal matched EXACTLY in the expectation — the command name, the session event name, the description, and both tool names — and only the callback beside each name is captured. Plant G (register under `claude:plugins`) and Plant H (listen on `session_shutdown`) each fail at the CALL SITE across 10 of 11 rows with strong-mock's `Didn't expect ... to be called`; Plant D (swap the two tool registrations) reddens exactly ONE row on the hand-authored name order. No name is read back off the module"
  - "NO case asserts that the handler record has every key, per the plan and the house rule that usage is not a property of a type. `SubcommandHandlers` is satisfied where the record is built, so a missing key already fails to compile and an assertion would restate a compiler guarantee. The suite says so in its header instead"
  - "The router case pins the token it hands over (`frobnicate`) by hand and reads the surrounding usage block off `router.ts`'s exported `TOP_LEVEL_USAGE`. The block is not this pair's fact — `tests/edge/router.test.ts` pins it against its own hand-authored copy — and a second copy here would be the duplication the contract forbids. What this case claims is that the captured handler reaches the router carrying the argument text and the context, and the named token plus the emission arriving on this case's boundary is what proves it"
  - "NFR-5 offline half: the `fetch` counter is asserted zero in all 11 cases and LABELLED a regression guard with no positive control. Nothing in this module's reachable input space opens a transport — the completion path reads the two scope roots off disk and the injected git operations are never invoked — so the zero is honest as a guard and would be dishonest as a measurement. Same shape 116-20, 116-21 and 116-24 recorded"
  - "No production file was touched. EIGHT plants were applied to `edge/register.ts`, all EIGHT RED, all reverted from a byte copy taken beforehand; `git diff --quiet` over the pair's own source, all three `shared.ts` helpers, `flag-catalog.ts` and `tests/helpers/notification-boundary.ts` exits 0"

patterns-established:
  - "Own a registration by invoking what it registered. Capture each callback off the recorded call and drive it; asserting that registration happened leaves the callback body unexecuted, which is measurable as an uncovered function"
  - "Ask whether a value the module reads is read ONCE or PER CALL, and build the case that separates the two. A single-root case passes for both readings"
  - "Give every untouched-value claim a value that would visibly have changed under the mutation you fear, so the claim is a value comparison rather than an object-identity check the contract discourages"

requirements-completed: []

coverage:
  - deliverable: "tests/edge/register.test.ts owns edge/register.ts at 100 percent direct functions, lines and branches"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/register.test.ts — 11 runtime cases from 11 marked bodies, pass 11 fail 0"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/register.ts → branches 15/15, functions 9/9, lines 143/143, exit 0"
        status: pass
  - deliverable: "Both previously-unreached functions are covered by capturing the callback and invoking it, not by asserting registration"
    human_judgment: false
    verification:
      - kind: command
        ref: "Baseline was branches 9/10, functions 7/9 with every line covered; after the rewrite the gate reports 15/15 and 9/9"
        status: pass
      - kind: test
        ref: "tests/edge/register.test.ts — the suggestion pass-through case and the two file-completion trigger cases invoke the wrapper members the previous suite never called"
        status: pass
  - deliverable: "The completion callback's working-directory read is measured, and the case discriminates a registration-time read from an invocation-time one"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant C (hoist process.cwd() above pi.registerCommand into a registrationCwd binding) turned exactly the two-root case RED with 'registration-mp' where 'invocation-mp' was expected"
        status: pass
  - deliverable: "The completion post-processor rewrites only lines the recogniser accepts, so it cannot alter another extension's line (T-116-28-A)"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant A (normalise unconditionally) turned exactly the two untouched-line cases RED — the foreign line and the absent-line index — and left the recognised-line case GREEN"
        status: pass
  - deliverable: "The file-completion trigger delegates when the underlying provider answers it and permits it when it does not"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant B (`?? true` becomes `?? false`) turned exactly the fallback case RED with 'false !== true' and left the delegating case GREEN"
        status: pass
  - deliverable: "Every registered name and the tool order are hand-authored and provably pinned"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant G (command name), Plant H (event name) each fail at the call site across 10 of 11 rows; Plant D (swap the two tool registrations) reddens exactly one row"
        status: pass
  - deliverable: "The suggestion pass-through returns the underlying result and forwards every argument"
    human_judgment: false
    verification:
      - kind: command
        ref: "Plant E (return null) and Plant F (forward col + 1) each turned exactly that case RED, on the returned value and on the recorded request respectively"
        status: pass
  - deliverable: "No production file changed and the shared boundary helper is untouched (T-116-28-C)"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet over register.ts, the three shared.ts helpers, flag-catalog.ts and tests/helpers/notification-boundary.ts → exit 0"
        status: pass
  - deliverable: "NFR-5 offline half: this read-only registration path never opens a transport"
    human_judgment: true
    rationale: "The zero is asserted in all 11 cases, but nothing in this module's reachable input space can move the counter — the completion path reads disk and the injected git operations are never invoked. It is a regression guard, not a discriminated measurement, and a verifier should read it as one."

duration: 30 min
completed: 2026-09-03
---

# Phase 116 Plan 28: Registration Glue Owner Summary

The registration glue is now owned by invoking what it registers: every callback the module hands to
Pi is captured off the recorded call and driven, which is what took the pair from 9/10 branches and
7/9 functions to complete direct coverage — and what surfaced the fact that its working-directory
read happens per keystroke rather than once at registration.

## Accomplishments

- Rewrote `tests/edge/register.test.ts` in the G7 shape: one top-level `describe()` per exported
  entrypoint, no nesting, 11 runtime cases from 11 marked bodies. The previous suite's hand-rolled
  recorder and its double assertion through `unknown` are gone, replaced by a strict `strong-mock`
  handle whose type derives from `platform/pi-api.ts`'s own export.
- Reached both previously-unexecuted functions by capturing and invoking rather than asserting
  registration: the suggestion pass-through, and the file-completion trigger whose fallback arm was
  the one missing branch. Direct coverage moved from branches 9/10, functions 7/9 to branches 15/15,
  functions 9/9, lines 143/143, so no D-116-01a claim arises from this pair.
- Measured that the working directory is read when the completion callback RUNS. The case registers
  the command inside one hermetic root, moves the process into a second root, then drives the
  captured callback and asserts the candidates came from the second — and Plant C, which hoists the
  read to registration time, turns exactly that case RED.
- Pinned every registered name as an exact hand-authored argument in the expectation, capturing only
  the callback beside it. Four plants prove the pinning: two on the names (call-site failures across
  10 of 11 rows), one on the tool order (exactly one row), one on the description path.
- Ran eight plants, all eight RED, all reverted; `git diff --quiet` over the pinned sources and the
  shared boundary helper exits 0.
- Closed the edge tier's correspondence: all 30 sources under `extensions/pi-claude-marketplace/edge/`
  now have a mirrored owner under `tests/edge/`, and the one orphan test file is a deliberate
  deferral.

## Task Commits

| Task | Name                                                              | Commit     | Files                       |
| ---- | ----------------------------------------------------------------- | ---------- | --------------------------- |
| 1    | Rewrite the register owner by capturing and invoking every callback | `037af9b9` | tests/edge/register.test.ts |

## Case inventory

11 runtime cases from 11 marked bodies (`rg -c '^\s+// arrange$'` = 11, and the same for `// act` and
`// assert`).

| Case                                | What it drives                                            | Outcome asserted                                                 |
| ----------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Command registration                | the recorded `registerCommand` options                     | the published description as one whole hand-authored string       |
| Command handler                     | the captured handler with an unknown subcommand            | one emission naming the token, at error severity                  |
| Completion callback, two roots      | the captured callback after moving the process             | the marketplace of the root the callback ran in                   |
| Session listener                    | the captured `session_start` listener                      | exactly one autocomplete provider factory installed               |
| Suggestion pass-through             | the wrapper's `getSuggestions`                             | the underlying result, and all four arguments forwarded           |
| Completion application, own line    | a doubled space at the cursor on a `/claude:plugin` line   | the run collapsed, and all five arguments forwarded               |
| Completion application, foreign line| the same doubled space on `/other-extension`               | the underlying result untouched                                   |
| Completion application, absent line | a cursor line index past the end of the buffer             | the underlying result untouched                                   |
| File trigger, delegating            | an underlying provider that answers `false`                | `false`, and all three arguments forwarded                        |
| File trigger, fallback              | an underlying provider that omits the member               | `true`                                                            |
| Tool registration                   | `registerClaudeMarketplaceTools`                           | both tool names in order, and no third registration               |

Both untouched-line cases carry a whitespace run the collapse WOULD have removed, so each is a value
comparison rather than the object-identity check the previous suite used. The delegating file-trigger
case answers `false` specifically so it cannot be confused with the fallback's `true`, and so a
`||` in place of the `??` would be caught.

## Plants (D-116-04)

Eight applied to `extensions/pi-claude-marketplace/edge/register.ts`, all eight RED, all reverted from
a byte copy taken beforehand. No plant stayed GREEN.

**Plant A — delete the recognised-line guard** so the completion application normalises
unconditionally. RED on exactly the two untouched-line cases, GREEN on the recognised-line case:

```
✖ leaves another extension's command line exactly as the underlying provider left it (TC-7)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    {
      cursorCol: 17,
      cursorLine: 0,
      lines: [
  +     '/other-extension alpha'
  -     '/other-extension  alpha'
      ]
    }
✖ leaves the result untouched when the cursor names a line the buffer does not hold (TC-7)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    {
      cursorCol: 23,
      cursorLine: 0,
      lines: [
  +     '/claude:plugin install alpha'
  -     '/claude:plugin install  alpha'
      ]
    }
ℹ tests 11   ℹ pass 9   ℹ fail 2
```

**Plant B — `?? true` becomes `?? false`** in the file-completion trigger. RED on exactly the
fallback case; the delegating case stays GREEN because it answers `false` on its own:

```
✖ permits the file-completion trigger when the underlying provider does not answer it (TC-7)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:

  false !== true

    actual: false,
    expected: true,
    operator: 'deepStrictEqual',
ℹ tests 11   ℹ pass 10   ℹ fail 1
```

**Plant C — hoist `process.cwd()` above `pi.registerCommand`** into a `registrationCwd` binding, so
the completion callback resolves against the registration-time root. This is the MIRROR of the plan's
literal Plant 3, which has no target (see Deviations). RED on exactly the two-root case:

```
✖ resolves argument completions against the working directory the callback runs in (D-04)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     label: 'registration-mp',
  +     value: 'list registration-mp '
  -     label: 'invocation-mp',
  -     value: 'list invocation-mp '
      }
    ]
ℹ tests 11   ℹ pass 10   ℹ fail 1
```

**Plant D — swap the two tool registrations.** RED on exactly the tools case, on the hand-authored
name order:

```
✖ registers the two read-only tools in order and nothing else (D-04)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
  +   'pi_claude_marketplace_plugin_list',
      'pi_claude_marketplace_list',
  -   'pi_claude_marketplace_plugin_list'
    ]
ℹ tests 11   ℹ pass 10   ℹ fail 1
```

**Plant E — the suggestion pass-through returns `null`** instead of delegating. RED on exactly that
case:

```
✖ returns the underlying provider's suggestions unchanged (TC-7)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  + null
  - {
  -   items: [ { label: 'install', value: 'install ' } ],
  -   prefix: 'ins'
  - }
ℹ tests 11   ℹ pass 10   ℹ fail 1
```

**Plant F — forward `col + 1`** from the suggestion pass-through. RED on the same case, but on the
recorded request rather than the returned value, which is what proves the two halves of that case are
separately pinned:

```
✖ returns the underlying provider's suggestions unchanged (TC-7)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [ [ [ '/claude:plugin install  alpha' ], 0,
  +     24,
  -     23,
    ...
ℹ tests 11   ℹ pass 10   ℹ fail 1
```

**Plant G — register under `claude:plugins`.** RED at the CALL SITE across 10 of 11 rows, which is
what proves the command name is a hand-authored expectation rather than a value read back:

```
✖ registers the slash command once under its published description (D-04)
  Error: Didn't expect extension API.registerCommand("claude:plugins", {...}) to be called.

  Remaining expectations:
  when(() => extension API.registerCommand("claude:plugin", Capture(claude:plugin registration))).thenReturn(undefined).between(1, 1)
  - Expected
  + Received
  -   "claude:plugin",
  +   "claude:plugins",
    at registerClaudePluginCommand (extensions/pi-claude-marketplace/edge/register.ts:101:6)
ℹ tests 11   ℹ pass 1   ℹ fail 10
```

**Plant H — listen on `session_shutdown`.** Same shape, on the event name:

```
✖ registers the slash command once under its published description (D-04)
  Error: Didn't expect extension API.on("session_shutdown", [Function anonymous]) to be called.

  Remaining expectations:
ℹ tests 11   ℹ pass 1   ℹ fail 10
```

Post-revert, `git diff --quiet -- extensions/pi-claude-marketplace/edge/register.ts
extensions/pi-claude-marketplace/edge/handlers/shared.ts
extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
extensions/pi-claude-marketplace/edge/flag-catalog.ts tests/helpers/notification-boundary.ts`
exits 0.

## Deviations from Plan

### 1. [Rule 1 — plan defect] The plan's working-directory truth is FALSE against the module

- **Found during:** Task 1, reading `register.ts` before writing a line.
- **Issue:** The plan's `must_haves` truth reads "The working directory captured at registration is
  the one the completion callback resolves against, proven by driving the callback after changing the
  process working directory", and its case bullet asks the suite to "register while the process
  working directory is one hermetic root, change the process working directory to the second root,
  then invoke the callback and assert the candidates came from the FIRST". The module does the
  opposite: `getArgumentCompletions: (prefix) => getArgumentCompletions(prefix,
  makeLocationsResolver(process.cwd()))` evaluates `process.cwd()` inside the arrow body, so it is
  read on every completion invocation and nothing is closed over. Writing the specified case would
  have produced a RED test asserting a behaviour the module does not have.
- **Fix:** The case asserts the measured behaviour — the candidates come from the root the process is
  in when the callback runs — and its title says so. The two-root form is kept, because it is what
  makes the two readings distinguishable; a single-root case would pass for either.
- **Verification:** Plant C (hoisting the read into a `registrationCwd` binding above
  `pi.registerCommand`) turns exactly that case RED, which is the measurement that the module reads
  per invocation and that the case can tell the two apart.
- **Commit:** `037af9b9`

### 2. [Rule 1 — plan defect] The plan's Plant 3 has NO TARGET

- **Found during:** Task 1, executing the plant list.
- **Issue:** Plant 3 as written is "move the working-directory read from registration time into the
  completion callback, confirm the two-root case goes RED, and revert." The read is already in the
  completion callback, so the edit is a zero-diff no-op and nothing can redden. Reporting it as run
  would have been reporting a proof that did not happen.
- **Fix:** The mirror was run in its place (Plant C above) and both the premise and the substitution
  are recorded here rather than made silently. Same family as 116-24's wrong-plant row.
- **Verification:** Plant C's verbatim RED output is above.
- **Commit:** `037af9b9`

### 3. [Rule 2 — reported, not fixed] Two production comments assert a property the code lacks

- **Found during:** Task 1, same reading.
- **Issue:** `register.ts:18-20` ("`process.cwd()` is acceptable here at the registration glue
  layer … The cwd captured here is per-command-registration") and `register.ts:104-106` ("Captured at
  registration time; threads through every keystroke's completion lookup via the closed-over
  resolver") both assert a registration-time capture the code does not perform. It is behaviourally
  harmless today — `index.ts` registers once per session and Pi does not change directory — but one of
  the comment and the code is wrong, and this plan's own `must_haves` inherited the comment's claim as
  a truth to prove, which is the concrete cost of leaving it.
- **Fix:** None applied. Both production licences for this phase are spent (116-06 `flag-catalog.ts`,
  116-27 `tools.ts`), and no remaining plan may edit a production file. Filed as WINDOWS ledger entry
  20 for the operator, and recorded in `.continue-here.md`.
- **Verification:** `git diff --quiet -- extensions/` exits 0.
- **Commit:** `037af9b9`

### 4. [Rule 3 — mechanism] The mock states the callback with a capture matcher, not a value read

- **Found during:** Task 1, building the harness.
- **Issue:** 116-27's finding is that reading a generic method off a `strong-mock` handle as a VALUE
  is an `unbound-method` lint error, which is why its suite narrowed `registerTool` to a property. The
  same recorder shape does not transfer to `pi.on`: its 33 overloads mean no single-signature property
  can stand in for the method and still be assignable to `ExtensionAPI`, and a recorder general enough
  to be assignable receives its handler at a type too wide to invoke.
- **Fix:** State the call rather than read the member: `when(() => { pi.on("session_start", listener);
  })` with the event name as an EXACT argument and `It.willCapture` on the callback beside it. The
  house rules sanction a matcher for "a value that cannot be compared structurally (a function, a
  stream)", and `willCapture` is the library's purpose-built form of exactly that. Only
  `registerTool` keeps 116-27's property narrowing, because it is generic. The braces on the `when()`
  callbacks are required by `@typescript-eslint/no-confusing-void-expression`, which rejects the
  shorthand form for a void-returning call.
- **Verification:** Plants G and H prove the exact-argument half is load-bearing: a different command
  name or event name fails at the call site across 10 of 11 rows. `npm exec -- eslint
  tests/edge/register.test.ts` exits 0.
- **Commit:** `037af9b9`

### 5. [Rule 3 — scope] The router case reads the usage block off the router

- **Found during:** Task 1, writing the handler-forwarding case.
- **Issue:** The smallest observable the router produces for an unknown subcommand is
  `Unknown subcommand: "<token>".\n\n` followed by the 15-line top-level usage block. Hand-authoring
  the block here would be a second copy of a text `tests/edge/router.test.ts` already pins against its
  own hand-authored copy — the duplication the contract forbids.
- **Fix:** The token is hand-authored (`frobnicate`); the surrounding block is read from `router.ts`'s
  exported `TOP_LEVEL_USAGE`. That constant belongs to a COLLABORATOR, not to the module under test,
  and this case's claim is that the captured handler reaches the router carrying the argument text and
  the context — not what the router's usage text says. The suite header states the split.
- **Verification:** The named token is what the emission carries, so a handler that dropped `args`
  would emit the bare usage block and fail the whole-value comparison.
- **Commit:** `037af9b9`

**Total deviations:** 5 — two plan defects corrected and reported, one production defect reported
un-fixed, two mechanism/scope decisions recorded. **Impact:** the plan's stated behaviour for the
sanctioned working-directory read was wrong, and the case that would have "proved" it would have
failed; the corrected case plus its mirror plant is a measurement instead. Nothing else in the plan
changed.

## Cases the plan named that were NOT written

- **"the handler record has every key."** The plan itself forbids it and asks the summary to say so.
  `SubcommandHandlers` is satisfied where the record is built, so a missing key already fails to
  compile; an assertion would restate a compiler guarantee. Not written, by instruction and by the
  house rule that usage is not a property of a type.

## Phase correspondence — the last plan's obligation

All 30 sources under `extensions/pi-claude-marketplace/edge/` now have a mirrored owner under
`tests/edge/` at the matching path. Verified by walking both directions:

- Every `extensions/pi-claude-marketplace/edge/**/*.ts` has a `tests/edge/**/*.test.ts` at the
  mirrored path — 30 for 30, no gaps.
- Exactly one test file under `tests/edge/` has no mirrored source there:
  `tests/edge/index-handler.test.ts`, whose paired source is the root `index.ts`. D-116-10 leaves it
  alone deliberately; Phase 117 absorbs it alongside `tests/index.test.ts`. It is a known, decided
  deferral, not a gap this phase left behind.

Nothing in the edge tier is unmirrored or unowned.

## Verification results

Each gate run separately with its exit code checked. `npm run check` was NOT used — its
`format:check` link fails on the operator's pre-existing untracked files and short-circuits before the
tests run.

| Gate                                             | Result                                                   |
| ------------------------------------------------ | -------------------------------------------------------- |
| `node --test tests/edge/register.test.ts`         | tests 11, pass 11, fail 0, exit 0                         |
| `npm run test:coverage:direct -- …/register.ts`   | branches 15/15, functions 9/9, lines 143/143, exit 0      |
| `npm run typecheck`                               | exit 0                                                    |
| `npm exec -- eslint tests/edge/register.test.ts`  | exit 0, no output                                         |
| `npm exec -- prettier --check …`                  | exit 0                                                    |
| `npm run fallow`                                  | exit 0                                                    |
| `npm test`                                        | tests 5134, suites 295, pass 5134, fail 0, exit 0         |
| `npm run test:integration`                        | tests 31, pass 31, fail 0, exit 0                         |
| anti-pattern scan (`! rg …`)                      | no match, so the negated link exits 0                     |
| `rg -c '^\s+// arrange$'`                         | 11                                                        |
| `git diff --check`                                | exit 0                                                    |
| `git diff --quiet` over six pinned files          | exit 0                                                    |
| trufflehog filesystem scan                        | chunks 3, bytes 27228, verified 0, unverified 0, exit 0   |
| `SKIP=trufflehog,npm-format-check pre-commit run` | all applicable hooks Passed, exit 0                       |

The suite total was READ from the runner's `ℹ tests` line, not computed from a delta. It moves from
5136/5136 across 293 suites to **5134/5134 across 295 suites**: the previous file held 13 top-level
cases and no `describe()`, this one holds 11 cases in 2 suites.

## Issues Encountered

None beyond the deviations above.

## Next Phase Readiness

Phase 116's plan set is complete — 31 of 31. The phase now goes to its gates (aggregate, code review,
regression, verification), which the orchestrator owns. Two items are deliberately left for the
orchestrator's phase-boundary sweep and were NOT touched here: the `173/204` pair total in
ROADMAP.md's Total row and STATE.md's prose, and `MOD-09`, which every plan in this phase shares and
which closes only at phase end. The ROADMAP phase-116 row is bumped to 31/31 but left `In Progress`
with no date, because verification has not run.

One item wants an operator decision before the phase closes: WINDOWS ledger entry 20, the two
`register.ts` comments that assert a registration-time working-directory capture the code does not
perform.

## Self-Check: PASSED

- `tests/edge/register.test.ts` exists on disk.
- `git log --oneline --all | grep 037af9b9` returns the task commit.
- Every `<acceptance_criteria>` item re-run above; all pass.
- The plan-level `<verification>` chain re-run; every link exits 0.
