---
phase: 08-direct-coverage
reviewed: 2026-09-11T00:00:00Z
depth: deep
diff_base: cff1d8cc
files_reviewed: 36
files_reviewed_list:
  - .github/workflows/ci.yml
  - .pre-commit-config.yaml
  - CONTRIBUTING.md
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/edge/args.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts
  - extensions/pi-claude-marketplace/edge/handlers/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/shared/fs-utils.ts
  - package.json
  - scripts/revalidation.mjs
  - scripts/test-coverage-direct.mjs
  - scripts/test-coverage-direct.negative.mjs
  - scripts/test-coverage-direct.pin.json
  - scripts/test-coverage-direct.pin.mjs
  - scripts/test-coverage-direct.report.mjs
  - tests/bridges/agents/stage.test.ts
  - tests/bridges/commands/stage.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/bridges/skills/stage.test.ts
  - tests/edge/args.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/platform/removal-ops-contract.ts
  - tests/platform/removal-ops-fake.test.ts
  - tests/platform/removal-ops-fake.ts
  - tests/shared/fs-utils.test.ts
findings:
  critical: 2
  warning: 8
  info: 7
  total: 17
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-09-11
**Depth:** deep (cross-file: gate scripts, CI wiring, port call graph, comment-to-code agreement)
**Files Reviewed:** 36
**Status:** issues_found

## Summary

The removal port itself is clean work. `RemovalOps` is genuinely required with no default, no
`DEFAULT_REMOVAL_OPS`, no `__deps` bag, no test-only export, no forwarding module, and no new
ignore pragma anywhere in the diff. `ops` is the first parameter at all 18 exported bridge entry
points, so the `TS1016` hazard `D-08-A11` warned about cannot arise. `removeOrphanIfPresent`'s
exception is recorded in `shared/fs-utils.ts:32-35` as a decision, and the `fs.mkdir` narrowing is
recorded beside it. `assertCompleteCoverage` stayed pure of the pin. The pin comparator fails in
both directions and every direction is planted rather than described. The two loop rewrites are
behavior-preserving (I traced `--scope` at end-of-input, `--scope --scope`, `--scope --local`, and
the empty-positional cases against the old index arithmetic).

Two findings are critical, and both are the same shape the phase exists to remove: an instrument
that reports success without measuring.

First, the changed-pair and all-pairs arms no longer abort on a shortfall — `measurePair` records
it and continues — so the *only* thing that turns a new shortfall red is a single
`assertPinnedReadings(...)` call per arm. Nothing anywhere proves either arm makes that call. The
negative harness plants the pure comparator only. Delete either line and `npm run check`, the
pre-commit hook, and the CI job all stay green while coverage enforcement is gone. That is
`D-08-A01`'s defect class reintroduced one layer up, inside the phase that diagnosed it.

Second, the new CI job measures an empty change set on exactly the event `CONTRIBUTING.md` names as
the one it protects. On `push: main` and on the `workflow_call` that `publish.yml` makes for a
`v*` tag, `origin/main...HEAD` is empty, so the job runs the two pinned pairs and exits 0.

The remaining findings are claim accuracy. Four owner-test headers still assert a coverage
shortfall this phase's own sweep measured away — one of them naming a source line the phase itself
deleted — and three sentences in `CONTRIBUTING.md` plus two in `test-coverage-direct.report.mjs`
describe gate behavior the phase changed underneath them.

## Critical Issues

### CR-01: Nothing proves either gate arm calls the pin comparison, and a shortfall no longer fails on its own

**File:** `scripts/test-coverage-direct.mjs:658-694` (`measurePair`), `:732`, `:806`
**Issue:**
Before this phase, a shortfall was enforced structurally: `runPair` threw, and the arm died on the
spot. `measurePair` now catches every shortfall, pushes it onto `observed`, and returns a normal
record. The arms therefore enforce nothing by themselves; enforcement rests entirely on one line
each:

```
732:  assertPinnedReadings(observed, loadCoveragePin(), modulePaths);   // runAllPairs
806:  assertPinnedReadings(observed, pinRows, enumeratedModules);       // runChangedPairs
```

`scripts/test-coverage-direct.negative.mjs:565-701` plants six states against `assertPinnedReadings`
and `loadCoveragePin` directly, as in-memory arrays. It never runs either arm. No file under
`tests/` mentions the gate scripts at all (`grep -rl test-coverage-direct tests/` is empty). So:

- delete line 806 and every pre-commit run and the CI `direct-coverage` job go permanently green on
  any shortfall, with `npm run check` still passing;
- delete the `observed.push(...)` in `measurePair` and the same thing happens with the call sites
  intact;
- `npm run check` cannot detect either, because it runs only the negative harness, which exercises
  the comparator in isolation.

This is the argument `D-08-A09` makes verbatim about the reporter ("Nothing in `npm run check` runs
the reporter today, which is exactly how `D-08-A01`'s defect shipped"), and the project convention
`.planning/codebase/CONVENTIONS.md` records as "a gate wants a test that plants the violation, not
one that reads the config." The wiring between measurement and comparison is the new load-bearing
edge and it is the one edge with no control.

**Fix:** Plant the arm, not just the comparator. `runChangedPairs` is the smaller target: extract
the measure-then-compare body so it takes its pair list, its pin rows, its enumerated modules, and
a pair runner, then in the negative harness drive it with a stub runner that answers a synthesized
`Incomplete direct coverage for <path>: branches 1/2` error and assert the arm throws — plus a
control where the stub answers a complete reading and the arm does not. No focused test run, no
fixture tree, and it fails the moment the comparison call or the `observed.push` goes away. For
example:

```js
// scripts/test-coverage-direct.mjs
export async function enforcePairs(pairs, pinRows, enumeratedModules, run = runPair) {
  const observed = [];
  for (const pair of pairs) { await measurePair(pair, observed, run); }
  assertPinnedReadings(observed, pinRows, enumeratedModules);
}
```

### CR-02: The `direct-coverage` job measures an empty change set on the release path, and CONTRIBUTING.md claims otherwise

**File:** `.github/workflows/ci.yml:124-171`, `CONTRIBUTING.md:67`
**Issue:**
The job runs `npm run test:coverage:direct`, whose base chain resolves `origin/main` and diffs
`origin/main...HEAD` (`scripts/test-coverage-direct.mjs:273`). `ci.yml` fires on three relevant
events:

| event | `origin/main...HEAD` | what the job measures |
| --- | --- | --- |
| `pull_request` | the PR's commits | the changed pairs — works as designed |
| `push: main` | empty (`origin/main` *is* `HEAD`) | the two pinned pairs only |
| `workflow_call` from `publish.yml` on a `v*` tag | empty (the tag is on `main`) | the two pinned pairs only |

On the two non-PR events the job prints `Changed-pair base: origin/main`, prints "No changed
source-test pairs", measures the pinned pairs, and exits 0. Both in-job assertions still pass: the
base *did* resolve and the gate *did* select `origin/main`. So the job is green having measured
nothing about the commit that triggered it — and both added assertions are blind to that, because
they check the base, never the size of the change set.

`CONTRIBUTING.md:67` states the stronger claim the wiring does not support: "`package` depends on
the job, so a shortfall blocks the release manifest check the way every other gate does." On the
release path it cannot block anything; `check`, `integration-tests`, and `e2e-tests` all re-run
their full suites on a tag build, and this one does not.

**Fix:** Make the non-PR base explicit rather than letting an empty diff read as a pass — the
explicit-base path added in this phase is exactly the tool, and `D-08-A07` requires the name to
fail closed rather than fall back, which it does:

```yaml
      - name: Run the changed-pair direct-coverage gate
        run: |
          set -o pipefail
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            npm run test:coverage:direct | tee coverage-direct.log
          else
            npm run test:coverage:direct:all | tee coverage-direct.log
          fi
```

and gate the "Assert the gate selected origin/main" step on the same condition. If a whole-tree
sweep is too slow for the release path, say so in `CONTRIBUTING.md` and drop the sentence at line
67 rather than leaving a claim the job cannot keep. Either way the gate should refuse a zero-pair
selection on `push`/`workflow_call`, where zero pairs means the base was the wrong question, not
that nothing changed.

## Warnings

### WR-01: Four owner-test headers still claim a coverage shortfall this phase measured away

**File:** `tests/edge/handlers/plugin/pending.test.ts:72-91`, `tests/edge/completions/data.test.ts:29-45`,
`tests/edge/completions/provider.test.ts:54-71`, `tests/edge/handlers/plugin/import.test.ts:44-58`
**Issue:**
`pending.test.ts:72` says the pair "lands with functions and lines COMPLETE and exactly ONE
uncovered branch, at edge/handlers/plugin/pending.ts:39 -- the `?? ""` fallback on the first
positional." Commit `3df79731` (this phase) deleted that fallback; `pending.ts:38-39` now reads
`const [first] = parsed.positional; if (first !== undefined) {`. The header describes source that
no longer exists, and `08-08-SUMMARY.md:186` records the module as complete.

The other three say "this pair lands one branch short of complete." `08-01-SUMMARY.md:234-237`
records all three as measured complete in this phase's own enumeration sweep
(`data.ts branches 109/109`, `provider.ts 78/78`, `import.ts 11/11`), which is why `D-08-A02` had
them struck from `CONTRIBUTING.md` — and they were struck there, and only there.

The pin is now the authoritative record of which pairs fall short, and it holds two rows, neither
of them these. Four files assert the opposite. This is the defect class the phase exists to remove,
and leaving it in the four files whose claims the phase falsified is the most visible instance of
it.

**Fix:** Rewrite each `D-116-01a` paragraph to state the current measured reading and, where the
arm still exists but is now covered, what covers it. For `pending.test.ts` delete the paragraph
outright and replace it with the `D-08-A03` note that the guard was removed by destructuring. State
the residue authority once, in each file: `scripts/test-coverage-direct.pin.json` holds the pairs
that fall short; a pair absent from it reads complete.

### WR-02: CONTRIBUTING.md describes gate behavior this phase changed underneath it

**File:** `CONTRIBUTING.md:56`, `:63`, `:81`
**Issue:** Three sentences are false against the code shipped in the same phase.

- `:56` — "All three stop at the first pair that falls short of complete direct coverage." None of
  the three stops. `measurePair` (`scripts/test-coverage-direct.mjs:672`) records the reading and
  continues; the run ends at `assertPinnedReadings` after every selected pair has been measured.
- `:63` — "Stopping on one of those, with that exact reading, is the expected outcome rather than a
  regression." A pinned row with its pinned reading now produces a *green* run, not a stop. A
  contributor following this sentence expects a red run on `bridges/commands/discover.ts` and gets
  exit 0.
- `:81` — "Because every sweep stops at the first shortfall, none of them can say what the rest of
  the tree reads. This does:" — the stated reason the report tool exists. `runAllPairs` now writes
  a JSONL row for every pair including refused ones (the comment at
  `scripts/test-coverage-direct.mjs:579-583` says so explicitly), so `:all` *can* say what the rest
  of the tree reads.

**Fix:** Rewrite `:56` as "All three measure every selected pair and compare every reading they
took against a committed pin"; rewrite `:63` to say a pinned row reading exactly as pinned is a
pass and any other divergence is a failure; rewrite `:81` to name the report's real remaining
distinction — it files no verdict and therefore survives a pin mismatch, which `:all` does not.

### WR-03: `test-coverage-direct.report.mjs` carries two claims the phase falsified

**File:** `scripts/test-coverage-direct.report.mjs:28-31`, `:37-38`
**Issue:**

- `:31` (the `usage` string, printed to any operator who runs the tool wrong) — "The gate is
  `npm run test:coverage:direct` and `npm run test:coverage:direct:all`, which still refuse a
  shortfall." They refuse an *unpinned* shortfall. A pinned one passes. The sentence is the reader's
  only stated model of the gate and it is now wrong in the direction that matters.
- `:37-38` (the `verdictFor` doc) — "A shortfall is recorded because recording it is the whole point
  -- the gate stops at the first one, so nothing downstream of it ever sees the rest of the tree."
  The gate no longer stops at the first one.
- `:44-46` — "Compare the rows it emits against the readings documented in CONTRIBUTING.md." The
  machine-readable record is now `scripts/test-coverage-direct.pin.json`; the `CONTRIBUTING.md`
  table is a rendering of it. Point the reader at the pin.

**Fix:** Restate the usage text as "the gate arms compare every reading against
`scripts/test-coverage-direct.pin.json` and refuse any divergence; this tool compares against
nothing", and delete the "stops at the first one" clause from `verdictFor`'s doc — the reason the
report exists is now that it files no verdict, not that the gate halts.

### WR-04: The hooks-hydration test counts `currentGeneration()` calls, which `D-08-A04` forbids and which its own assertions cannot discriminate

**File:** `tests/bridges/hooks/event-router.test.ts:1887-1929`
**Issue:** The case replaces `currentGeneration` with a counter and advances the generation on the
third consultation after the state read:

```ts
const GUARDS_FROM_THE_STATE_READ_TO_THE_HOOKS_READ = 3;
...
if (guardsAfterTheStateRead === GUARDS_FROM_THE_STATE_READ_TO_THE_HOOKS_READ) {
  runtime.advanceGeneration();
}
```

`D-08-A04` states the constraint in as many words: "Do not couple the new tests to a
`currentGeneration()` call index." Beyond the rule, the case cannot tell whether it hit its target.
Its three assertions are `currentGeneration() === 1`, `parsedConfigEntries()` empty, and the
`PreToolUse` bucket empty — all three hold identically if hydration stopped at the *first* or
*second* guard. Any production edit that adds or removes one generation read before the hooks.json
read silently moves the trigger to a different guard; the test stays green, the arm at 615-616 goes
uncovered, and the only thing that would notice is a full direct-coverage sweep of
`bridges/hooks/event-router.ts` — which neither gate arm runs unless that file changes.

**Fix:** Drive the staleness from something the case owns rather than from a call ordinal. The two
sibling cases already show the pattern: `:1838-1874` uses a deferred `loadState` and a real
concurrent registration; `:1933-1988` intercepts `getRoutingBucket` for one named event. Here, make
the hooks.json read the trigger — inject the reader (or fault the plugin's `hooks.json` path
through a collaborator) so the advance happens *because* the read happened, and add an assertion
that the read occurred, so the case fails loudly if it stops earlier than intended.

### WR-05: A passing run says nothing about the pinned shortfalls it measured

**File:** `scripts/test-coverage-direct.mjs:672-693`
**Issue:** `runPair` prints `Direct coverage passed: <path> (<reading>)` on success
(`:646`). `measurePair`'s shortfall branch prints nothing at all. So a green run over the current
tree emits N "passed" lines and is completely silent about the two pairs that fell short and were
forgiven by the pin — including in the CI log that `CONTRIBUTING.md:67` calls the auditable
artifact. The operator cannot tell a run that measured 231 complete pairs from one that measured
229 complete pairs plus two pinned shortfalls, which is precisely the "reports success having
measured a stale or partial tree" reading the phase's `<specifics>` names as the failure mode.

**Fix:** Print the recorded reading and the pin row that authorizes it at the point it is recorded:

```js
process.stdout.write(`Direct coverage pinned: ${pair.sourcePath} (${reading})\n`);
```

and print a one-line tally before `assertPinnedReadings` returns clean ("2 pinned shortfall(s)
matched the pin"). A gate that forgives something should say what it forgave.

### WR-06: The single-path arm bypasses the pin, so the invocation the project's own rules prescribe fails with no pointer

**File:** `scripts/test-coverage-direct.mjs:824-827`
**Issue:** `.claude/rules/typescript-unit-testing.md:32` tells developers to run
`npm run test:coverage:direct -- <path>` while working on a pair. That routes to
`await runPair(pairForPath(args[0]))`, which throws `Incomplete direct coverage for ...` and never
consults the pin. A developer editing `orchestrators/plugin/install-outcome.ts` or
`bridges/commands/discover.ts` therefore gets a red run, an error naming no pin, and nothing to
distinguish "you broke coverage" from "this pair is pinned and reads exactly as recorded" —
contradicting `CONTRIBUTING.md:56`'s "all three compare every reading they took against a committed
pin" (which is also wrong about which arms exist: there are four).

**Fix:** Route the single-path arm through the same comparison. It already has everything it needs:

```js
if (args.length === 1) {
  const pair = pairForPath(args[0]);
  const observed = [];
  await measurePair(pair, observed);
  assertPinnedReadings(observed, loadCoveragePin().filter((row) => row.sourcePath === pair.sourcePath), productionPaths());
  return;
}
```

At minimum, catch the shortfall, look up the row, and reword the refusal to say the reading matches
the pin — otherwise the most-used arm is the one arm that lies about the tree's state.

### WR-07: `as unknown as` double assertion in a new test, against both the project rule and the sibling precedent

**File:** `tests/platform/removal-ops-fake.test.ts:73-87`
**Issue:**

```ts
const unboundedOptions = { boundary: "disk" } as unknown as Parameters<typeof createRemovalOpsFake>[0];
```

`.claude/rules/typescript-unit-testing.md:184` is explicit: "Do not use `any`, a double assertion,
or a broad `Partial<T>` cast to hide an invalid double." The house precedent for this exact case
avoids it — `tests/platform/credential-ops-fake.test.ts:63` writes
`Reflect.apply(createCredentialOpsFake, undefined, [{}])`, and `tests/domain/device-flow-fake.test.ts:83`
does the same. This is the only `as unknown as` in the entire phase diff, so it is a one-off
regression from an established pattern, not a convention.

Secondary: the case restates a constraint the compiler already enforces
(`.claude/rules/typescript-unit-testing.md:221`, "Do not test what a gate already enforces") — no
typed caller can reach the throw. That is defensible here only because the sibling fakes carry the
same case; if it stays, it should at least stay in the same form they use.

**Fix:** Replace the cast with `Reflect.apply(createRemovalOpsFake, undefined, [{ boundary: "disk" }])`.

### WR-08: `assertPinPopulated` is fully subsumed by `assertPinMembership`, and the control that plants it claims a property it does not prove

**File:** `scripts/test-coverage-direct.pin.mjs:178-190`, `scripts/test-coverage-direct.negative.mjs:659-669`
**Issue:** `assertPinPopulated` fires only when `rows.length === 0 && readings.length > 0`. Every
such state is also caught by `assertPinMembership`, which would report all readings as `appeared`.
The function changes the message, not the verdict. The planted case says otherwise:

```js
// An emptied pin with a shortfall present. Different from the addition state above: that one
// proves a populated pin rejects a new row, this one proves a pin that lost all its rows cannot
// read as success.
```

The second half is already proved by `assertPinMembership`; what this case actually pins is the
wording of a message. That is not a fifth divergence class, and describing it as one overstates the
harness's coverage of the pin's failure modes — the same overstatement the phase is removing
elsewhere.

**Fix:** Either delete `assertPinPopulated` and let the membership refusal carry the emptied-pin
case (adjust the planted case's expected message accordingly), or keep it and rewrite the comment
to say what it is: a more legible message for a state the membership check would otherwise report
as N simultaneous additions.

## Info

### IN-01: `--base` accepts option-shaped ref names

**File:** `scripts/test-coverage-direct.mjs:149`, `:133-152`
`baseCandidateName = /^[A-Za-z0-9._\/-]+$/` permits a leading `-`, so
`--base --git-dir=x` reaches `git rev-parse --verify -- git-dir=x^{commit}` as an option-shaped
argument rather than a ref. `spawnSync` with an argument array means there is no shell and no
injection; the value comes from a developer's own command line or from `package.json`, not from
untrusted input, and every outcome is a refusal. Judgment call, not a vulnerability. If you want it
closed, add `&& !explicitBase.startsWith("-")` to the guard, or pass `--end-of-options` before the
ref.

### IN-02: `--base` with no ref degrades into a confusing path error

**File:** `scripts/test-coverage-direct.mjs:822-827`
`node scripts/test-coverage-direct.mjs --base` has `args.length === 1`, falls past the `--base`
branch, and reports `Not a production TypeScript path: --base`. Fails closed, reads as a typo in a
path. One more arm (`args[0] === "--base"` with the wrong arity) would say what is actually wrong.

### IN-03: Refused rows in `coverage/all-pairs.jsonl` are shape-identical to complete rows

**File:** `scripts/test-coverage-direct.mjs:681-692`
`measurePair`'s record carries `coverage: reading` with no verdict field, so a shortfall row
(`"branches 55/57, lines 412/414"`) and a complete row are distinguishable only by noticing that
`hit !== found` inside a string. `test-coverage-direct.report.mjs` emits an explicit `verdict` field
for the same data. Adding `verdict: "shortfall"` to the gate's record would make the retained
artifact self-describing at no cost.

### IN-04: The leak-arm expected strings are built from the path the double recorded

**File:** `tests/orchestrators/plugin/install-outcome.test.ts:496-549`
`installWithFaultedStagingCleanup` reads the staging root out of `removal.calls.rm` and the three
cases interpolate it into their expected message. The helper constrains it well (exactly one `rm`
under the bridge's own staging dir), and the header explains why the UUID cannot be predicted, so
this is a reasoned tradeoff rather than a defect. It does mean the assertion cannot fail on a wrong
path *within* the right staging parent. `.claude/rules/typescript-unit-testing.md:108` ("Build
expected values independently") is the rule being traded against; worth a sentence in the header
saying so.

### IN-05: `check-phase-06-hub-ledger.mjs` still says "both D-116-01a shortfalls"

**File:** `scripts/check-phase-06-hub-ledger.mjs:260`
`D-08-A03` found three dense-index guards, not two, and all three have now been rewritten. The
record is a historical route (`route: "phase-08"`) so its tense is defensible, but the count is
stale against the phase it routes to. One word.

### IN-06: Assertions inside the arrange phase and inside a shared helper

**File:** `tests/bridges/skills/stage.test.ts:1689`, `:1927`; `tests/orchestrators/plugin/install-outcome.test.ts:498-503`
`assert.notStrictEqual(backupDirectory, undefined)` is a standalone negative assertion
(`.claude/rules/typescript-unit-testing.md:92` names this exact form) sitting in the `// arrange`
block, followed by a `?? "missing"` fallback it makes unreachable. Similarly
`installWithFaultedStagingCleanup` asserts `kind === "installed"` and `attempted.length === 1`
inside the shared helper rather than in each case's `// assert`. Both are arrange-time guards rather
than the cases' real assertions, and both are minor — but `assert.strictEqual(replacement.kind, "replaced")`
two lines earlier shows the positive form the rules ask for.

### IN-07: The removal port's fake lives under `tests/platform/` while the port lives in `shared/`

**File:** `tests/platform/removal-ops-fake.ts`, `tests/platform/removal-ops-contract.ts`
`RemovalOps` and `createRemovalOps` are exported from
`extensions/pi-claude-marketplace/shared/fs-utils.ts`, so the concern's tests are
`tests/shared/fs-utils.test.ts` — which imports its fake and contract from `../platform/`. The
placement follows the `git-ops-fake` / `credential-ops-fake` naming precedent and is load-bearing
for the correspondence gate's structural-supplement exemption (`scripts/test-coverage-direct.mjs:316`
matches `tests/{domain,platform}/*-fake.test.ts` only), so moving it is not free. Recording it
here as a known asymmetry rather than a defect: the fake is genuinely test-only, imports no
filesystem module, and is not reachable from production.

---

_Reviewed: 2026-09-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Diff base: cff1d8cc_
