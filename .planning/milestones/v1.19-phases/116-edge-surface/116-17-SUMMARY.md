---
phase: 116-edge-surface
plan: "17"
subsystem: testing
tags: [edge, handler, import, exact-argument-mock, d-116-01a, git-mv, correspondence-gate]
status: complete

requires:
  - phase: 116-edge-surface
    provides: "116-00's createNotificationBoundary(emissions, toolProbes, cwd?)"
  - phase: 116-edge-surface
    provides: "116-02's D-116-01a identity-pin shape"
  - phase: 116-edge-surface
    provides: "116-07's injected-port forwarding proof and createGitOpsFake usage"
provides:
  - "tests/edge/handlers/plugin/import.test.ts — the sole mirrored owner for edge/handlers/plugin/import.ts"
  - "the phase's one LITERAL exact-argument proof: a strong-mock when() stating the complete orchestrator options bag with no wildcard matcher"
  - "the measured correction that an exact-argument port forward pins the port's MEMBER identities, not the container object's — a spread copy still matches"
  - "the measured correction that plugin/import.ts uses parseArgs, not parseCommandArgs, so a surplus positional IS rejected here and --local lands on positional"
  - "the D-116-01a pin for edge/handlers/plugin/import.ts:31 (compiler-forced by the unknown-typed catch binding), WINDOWS ledger entry 18"
affects: []

actuals:
  tokens: 12000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A total rewrite and a git mv cannot land in one commit AND be recorded as a rename: git stores no rename, it detects one by content similarity, and a rewritten file shares nothing with its predecessor even at -M10%. Split into a pure move (fixing only the relative import depth so the tree still compiles) and then the rewrite; both intermediate states leave the correspondence gate at its final violation count, so the gate's real requirement — never a state where only one member of a pair exists — is met either way"
    - "A strong-mock exact-argument expectation over an injected port compares the port STRUCTURALLY. A spread copy of the port satisfies it; a port with one method substituted or wrapped does not. State the claim as 'every operation runs through the injected implementation', not 'the identical object was forwarded'"

key-files:
  created:
    - tests/edge/handlers/plugin/import.test.ts
  modified:
    - .planning/WINDOWS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "DEVIATION (commit shape) — the plan's Task 1 demands the move and the rewrite in ONE commit and, in the same acceptance block, that `git status` show a rename. Those are mutually exclusive against a total rewrite. The orchestrator prompt resolves the tension explicitly ('Move and rewrite are two tasks — commit the move so `git log --follow` keeps the file's history'), so the work landed as two commits. `git log --follow tests/edge/handlers/plugin/import.test.ts` now reaches f1855ecf, the 2026 commit that added the import command; a single combined commit would have severed that"
  - "The git-port bullet did NOT get its own case. A second case constructing a second port would be one case run twice on the same branch. The forward rides in every delegating case's stated options and is carried by a plant; the header states this and states the narrowed claim the plant measured"
  - "The arity truth's 'one below the accepted arity' half has NO target here: the accepted arity is zero positionals and there is no count below zero. The 'one above' half, false for all six marketplace siblings, is TRUE here — this handler rejects a surplus positional itself rather than letting parseCommandArgs walk the schema past it"
  - "The 'mutually exclusive scope selectors' case asserts a POSITIONAL rejection, which is what the module actually does: it never reaches extractLocalFlag, so --local is an ordinary token that lands on positional and is rejected before the scope value matters"
  - "No production file changed. Seven plants were applied and each reverted from a byte-copy taken beforehand; `git diff --quiet -- extensions/` exits 0"

requirements-completed: []

coverage:
  - deliverable: "The import suite sits at its mirrored path with history preserved and closes two correspondence-gate violations"
    human_judgment: false
    verification:
      - kind: command
        ref: "node scripts/check-corresponding-tests.mjs → 10 violations before, 8 after; neither import path named"
        status: pass
      - kind: command
        ref: "git log --follow tests/edge/handlers/plugin/import.test.ts → reaches 291de1e7, 03e50dce, 0a8155dd, f1855ecf"
        status: pass
  - deliverable: "A literal exact-argument proof over the complete orchestrator options bag"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/import.test.ts#imports the project scope before the user scope when no scope flag narrows the command"
        status: pass
      - kind: test
        ref: "tests/edge/handlers/plugin/import.test.ts#imports the {project,user} scope alone when --scope <scope> narrows the command"
        status: pass
      - kind: other
        ref: "Plant A (single scope on the no-scope branch) RED; Plant G (literal cwd) RED on all four delegating cases; Plant F (always the real orchestrator) RED on three"
        status: pass
  - deliverable: "The delegate-absent branch is covered by the real workflow against a hermetic tree"
    human_judgment: false
    verification:
      - kind: test
        ref: "tests/edge/handlers/plugin/import.test.ts#runs the real import workflow when the dependency object declares no delegate"
        status: pass
  - deliverable: "Every rejection path proves the workflow never started and the context was never read"
    human_judgment: false
    verification:
      - kind: other
        ref: "Plant E (drop the early return after the positional rejection) turned all three rejection cases RED, dying on the unstated ctx.cwd proxy"
        status: pass
  - deliverable: "The D-116-01a shortfall at import.ts:31 is pinned, not reported"
    human_judgment: false
    verification:
      - kind: command
        ref: "116-17-PLAN.md Task 2 <verify> chain, run end to end → exit 0 at branches 11/12"
        status: pass
      - kind: other
        ref: "Six pin plants: two assertion-side and three output-side all FAIL, control PASSES"
        status: pass
      - kind: other
        ref: "Plant C (replace the arm) stayed GREEN across all 8 cases; Plant D (mutate the live arm) turned the tokenizer case RED; brute force over 3,615 argument strings produced 521 throws and zero non-Error values"
        status: pass
  - deliverable: "No production file and no shared helper changed"
    human_judgment: false
    verification:
      - kind: command
        ref: "git diff --quiet -- extensions/ tests/helpers/notification-boundary.ts → exit 0"
        status: pass

duration: 40 min
completed: 2026-09-02
---

# Phase 116 Plan 17: Plugin Import Handler Owner Summary

The import suite moved from `tests/edge/handlers/` to its mirrored path and was rewritten as the
phase's one LITERAL exact-argument owner: every delegating case states the complete orchestrator
options bag — context, Pi handle, working directory, selected scopes, git port — in a `strong-mock`
`when()` with no wildcard matcher, and ends in `verify()`.

## Accomplishments

- **The move closed two correspondence-gate violations with one rename.** The gate went from 10 to 8
  violations; neither `tests/edge/handlers/import.test.ts` nor
  `tests/edge/handlers/plugin/import.test.ts` appears in its output any more.
- **8 runtime cases from 6 marked bodies** replace the old suite's 5. Direct coverage:
  `branches 11/12`, with lines and functions both complete.
- **The one literal D-116-05 proof in the handler tier.** `deps.importClaudeSettings` is a real
  seam, so the whole options bag is statable. Four cases state it: the omitted-scope default
  (`["project", "user"]`, hand-written in the `when()`) and each supplied scope value.
- **The absent delegate is a distinct branch and is covered.** Constructing the handler without the
  member lets the real import workflow run against a hermetic tree with no Claude settings in either
  scope; its minimal observable effect is the `(no marketplaces)` cascade notification.
- **Every rejection case builds the delegate with NO stated expectation** and omits the boundary's
  `cwd`, so a green case proves both that the workflow never started and that the early return read
  nothing off the context.
- **A new D-116-01a pin**, WINDOWS ledger entry 18.

## Measured findings

### 1. The plan's two Task 1 acceptance criteria are mutually exclusive

The plan demands the move and the rewrite in **one commit** and, in the same acceptance block, that
`git status` show **a rename rather than an add plus a delete**. Git stores no rename; it detects one
by content similarity. The rewrite the plan itself mandates (new harness, new assertions, new header)
shares almost nothing with the original:

```text
git diff --cached -C -M10% --summary
 delete mode 100644 tests/edge/handlers/import.test.ts
 create mode 100644 tests/edge/handlers/plugin/import.test.ts
```

Not a rename even at a 10 percent threshold. The orchestrator's instruction resolves it directly —
"Move and rewrite are two tasks — commit the move so `git log --follow` keeps the file's history" —
so the work landed as two commits:

1. `291de1e7` — pure move, fixing only the relative import depth so the tree still compiles.
   Recorded as `rename tests/edge/handlers/{ => plugin}/import.test.ts (91%)`. Verified green at that
   commit: typecheck 0, the moved suite 5/5, lint 0, prettier clean.
2. `855284bf` — the rewrite.

The plan's stated REASON for one commit is that the correspondence gate rejects a state where only
one member of a changed pair exists. The pure-move commit creates no such state — it already reports
the final 8 violations — so the gate's real requirement is satisfied either way, while the single
combined commit would have severed the history. `git log --follow` now reaches back through
`03e50dce` and `0a8155dd` to `f1855ecf`, the commit that added the import command.

### 2. An exact-argument port forward pins the port's MEMBERS, not the container

Plant B was authored as "pass a freshly-constructed git port instead of the injected one." The first
form, `gitOps: { ...deps.gitOps }`, stayed **GREEN**: `strong-mock` compares the options bag
structurally, so a spread copy carrying the same method references still matches.

The second form, `gitOps: { ...deps.gitOps, clone: (o) => deps.gitOps.clone(o) }`, turned all three
delegating cases RED. What the stated `gitOps` member therefore proves is that **every git operation
the workflow performs runs through the injected implementation** — a substituted or wrapped method
fails, a re-boxed identical one does not. That is the property worth pinning, and the suite header
now states it in those terms instead of claiming object identity.

### 3. This handler answers all three inherited questions differently from every marketplace sibling

It parses raw arguments with `parseArgs`, not `parseCommandArgs`:

| Question | Six marketplace handlers | `plugin/import` |
| --- | --- | --- |
| Surplus positional | silently DROPPED (the schema is walked, not the input) | **REJECTED** with its own sentence |
| One below the accepted arity | depends on `required` | **no target** — accepted arity is zero |
| `--local` | six different outcomes, all downstream of `extractLocalFlag` | **never reaches it**; lands on `positional` and is rejected there |

So the "mutually exclusive scope selectors" case asserts the positional rejection, which is what
`--scope user --local` actually produces — not a scope diagnostic. And the arity truth's "one below"
half has no reachable target and no case asserts it; the "one above" half, false for all six
siblings, is TRUE here.

## D-116-01a: `edge/handlers/plugin/import.ts:31`

The gate's verdict line, verbatim:

```text
Incomplete direct coverage for extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts: branches 11/12
```

Denominator minus numerator is exactly 1. No `lines` clause and no `functions` clause: the uncovered
line set is empty and pinned by the trailing `$` anchor, the 116-21 variant of the identity shape.
`11/12` is recorded here as an observation; the plan's `<verify>` link matches the branch numbers
loosely and never pins the pair.

**The shortfall** is the `String(err)` arm of `err instanceof Error ? err.message : String(err)`. The
only throw reaching that catch comes from `parseArgs`, which constructs a `new Error` at both of its
throw sites, so no input can deliver a non-error value there.

**The reason is COMPILER-FORCED.** A `catch (err)` binding is typed `unknown` under
`useUnknownInCatchVariables`; narrowing it to `Error` leaves a residual arm, and removing that arm
needs a type assertion, which is barred throughout `extensions/`. The production route that would
reach 100 percent — replacing the local conditional with `shared/errors.ts`'s `errorMessage(err)`,
which is what 116-27 did inside its licensed file — is a production change this plan is not
authorized to make.

### Proof by measurement

| Route | Result |
| --- | --- |
| Plant C: `String(err)` → `"@@unreached@@"` | **GREEN**, all 8 cases — the arm is unreachable |
| Plant D: `err.message` → `"@@live-arm@@"` | **RED**, the tokenizer case — the live arm is the one that runs |
| Brute force: 3,615 argument strings from 15 atoms in 1-, 2- and 3-token shapes | 521 throws, **0** non-`Error` values, 27 distinct messages, all from the two `parseArgs` throw sites |

Plant D's verbatim failure:

```text
✖ reports an unrecognised scope value with the import usage block and never imports
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
    [
      {
  +     message: '@@live-arm@@\n\nUsage: /claude:plugin import [--scope user|project]',
  -     message: 'Invalid --scope value: "bad". Must be "user" or "project".\n' +
  -       '\n' +
  -       'Usage: /claude:plugin import [--scope user|project]',
        severity: 'error'
      }
    ]
```

### The pin planted in both directions

Against real captured gate output, with the plan's `<verify>` assertion as authored:

| Direction | Mutation | Result |
| --- | --- | --- |
| — | real output, pin as authored | **PASS** (`PIN OK`) |
| assertion | require a `lines` clause | FAIL — `no documented incomplete verdict, or lines/functions are no longer complete` |
| assertion | assert a 2-branch shortfall | FAIL — `expected exactly 2 uncovered branch, saw 1` |
| output | a `lines` clause appears | FAIL, exit 1 |
| output | a second branch goes uncovered | FAIL — `expected exactly 1 uncovered branch, saw 2` |
| output | the verdict disappears (the gate passes) | FAIL, exit 1 |

The last row is the one D-116-01a names: a passing verdict still fails the link and must be reported,
never edited away. Filed as `.planning/WINDOWS.md` entry 18 (`unmet-truth`, open). No
coverage-exception pragma was added; zero exist repo-wide.

## Plants

Seven production plants. Each was applied to a byte-copy-backed file and restored;
`git diff --quiet -- extensions/` exits 0.

| Plant | Mutation | Expected | Measured |
| --- | --- | --- | --- |
| A | no-scope branch selects `["project"]` alone | RED | **RED** — the no-scope case, `Didn't expect import claude settings(…"selectedScopes": ["project"]…)` with the `- "user"` diff line |
| B1 | `gitOps: { ...deps.gitOps }` | RED | **GREEN** — a finding, see above |
| B2 | `gitOps: { ...deps.gitOps, clone: (o) => deps.gitOps.clone(o) }` | RED | **RED**, 3 delegating cases, `UnexpectedCall` (strong-mock's own diff printer then throws on the anonymous function, which is cosmetic) |
| C | `String(err)` → a distinguishable literal | GREEN by design | **GREEN**, 8/8 |
| D | `err.message` → a distinguishable literal | RED | **RED**, the tokenizer case (verbatim above) |
| E | drop the early `return` after the positional rejection | RED | **RED**, 3 rejection cases, dying on the unstated `ctx.cwd` proxy (`"cwd": [Function anonymous]`) |
| F | `(deps.importClaudeSettings ?? importClaudeSettings)` → `importClaudeSettings` | RED | **RED**, 3 delegating cases |
| G | `cwd: ctx.cwd` → a literal | RED | **RED**, all 4 cwd-forwarding cases |

## Deviations from Plan

### 1. [Rule 3 - Blocker] The move and the rewrite could not be one commit and a recorded rename

- **Found during:** Task 1, at staging time.
- **Issue:** the two Task 1 acceptance criteria contradict each other against a total rewrite.
- **Fix:** two commits, per the orchestrator's explicit instruction. Detail in Measured findings §1.
- **Verification:** `git log --follow` reaches `f1855ecf`; both commits typecheck, lint and pass.
- **Commits:** `291de1e7`, `855284bf`.

### 2. [Rule 1 - Overstated claim] The git-port bullet claimed more than the proof measures

- **Found during:** Task 1, Plant B.
- **Issue:** "the same object the handler was constructed with appears in the stated options" is not
  what the expectation discriminates — a spread copy passes.
- **Fix:** the header states the narrowed, measured claim. No separate case was added: a second port
  instance would be one case run twice on the same branch.

### 3. [Rule 1 - Unreachable claim] The arity truth's lower half has no target

- **Issue:** `must_haves` promises "the accepted positional arity, one below it, and one above it."
  The accepted arity is zero; there is no count below zero.
- **Fix:** the case list covers zero (accepted) and one and two (both rejected); the header records
  that the lower half has no reachable target rather than asserting something untrue.

### 4. [Rule 1 - Stale wording] Task 2's acceptance criteria contradict the plan's own must_haves

- **Issue:** Task 2's acceptance block opens with "the direct-coverage gate reports 100 percent
  functions, lines, and branches", and its `<done>` says "at 100 percent direct coverage". Both are
  stale template wording, contradicted by the same block's closing sentence, by the task's own
  `<verify>` link and by the plan's `must_haves`, all of which require the one-branch shortfall.
- **Fix:** followed the `<verify>` link and `must_haves`. Reported here rather than silently
  reconciled.

### 5. [Rule 3 - Stale baseline] The handoff's `npm test` baseline was wrong

- **Issue:** `.continue-here.md` and the dispatch prompt both record 5041/5041; the pins report
  records 5044/5044. Neither matches.
- **Fix:** measured it directly by restoring the HEAD version of the suite and re-running:
  **5049/5049** before this plan, **5052/5052** after (+3, from 5 old cases to 8 new). Reported so
  the next executor does not inherit a false baseline.

**Total deviations:** 5 (1 blocker resolved by the orchestrator's own instruction, 2 claim
narrowings, 2 reported document defects). **Impact:** the pair's history is preserved, no claim in
the suite is stronger than what was measured, and the phase baseline is corrected.

## Known Stubs

None.

## Threat Flags

None. The plan's three threats are all mitigated as specified: T-116-17-A by the exact-argument
`when()` plus the no-expectation mocks on every rejection path, T-116-17-B by the re-measured direct
coverage, and T-116-17-C by the `git diff --quiet` pin, which exits 0 over `extensions/` and
`tests/helpers/notification-boundary.ts`.

## Verification Results

Each gate run separately with its own exit code checked. `npm run check` was NOT used — its
`format:check` link fails on pre-existing untracked operator files and short-circuits before the
tests.

| Gate | Result |
| --- | --- |
| `node --test tests/edge/handlers/plugin/import.test.ts` | exit 0 — 8/8 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | exit 0 — 5052/5052 across 291 suites |
| `npm run test:integration` | exit 0 — 31/31 |
| `node scripts/check-corresponding-tests.mjs` | 8 violations, down from 10; neither import path named |
| 116-17-PLAN.md Task 1 `<verify>` chain | exit 0 |
| 116-17-PLAN.md Task 2 `<verify>` chain | exit 0 (`rg -c` reports 6 arrange markers for 6 case bodies) |
| `npm exec -- prettier --check` on the suite | clean |
| `SKIP=trufflehog,npm-format-check pre-commit run --files` | all hooks Passed, both commits |
| trufflehog filesystem scan | `chunks: 2, bytes: 16340, verified_secrets: 0, unverified_secrets: 0` |
| `git diff --quiet -- extensions/ tests/helpers/notification-boundary.ts` | exit 0 |
| `git diff --check` on the suite | clean |

## Next Phase Readiness

Wave 5 continues with the ten remaining plugin handlers (116-14, 116-15, 116-16, 116-18 … 116-22,
116-24, 116-25), then 116-28. Three things to carry forward:

1. **Every plugin handler using `parseArgs` rather than `parseCommandArgs` rejects surplus
   positionals.** Check which parser your module calls before writing the arity case; the marketplace
   tier's "surplus is always dropped" finding does not transfer.
2. **`--local` for a `parseArgs` handler is an ordinary positional token**, so its outcome is that
   handler's positional rule, not a scope diagnostic. Still measure it — the discriminator is whether
   the module reaches `extractLocalFlag`, directly or through the shared opener.
3. **An exact-argument port expectation pins the port's methods, not the container.** If a plan asks
   you to prove "the identical object was forwarded", narrow the claim to what the plant measures.

## Self-Check: PASSED

- `tests/edge/handlers/plugin/import.test.ts` exists on disk; `tests/edge/handlers/import.test.ts`
  does not.
- `git log --oneline` carries `291de1e7` and `855284bf`; `git log --follow` links them to the file's
  original history.
- Both plan `<verify>` chains re-run end to end at exit 0 against the committed state.
- `git diff --stat -- extensions/` is empty.
