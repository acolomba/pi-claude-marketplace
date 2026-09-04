---
phase: 117-extension-entry-and-final-gate
fixed_at: 2026-09-03T23:49:03Z
review_path: .planning/phases/117-extension-entry-and-final-gate/117-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 117: Code Review Fix Report

**Fixed at:** 2026-09-03T23:49:03Z
**Source review:** `.planning/phases/117-extension-entry-and-final-gate/117-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 10 (CR-01, CR-02, WR-01 through WR-08)
- Fixed: 10
- Skipped: 0
- Info findings IN-01 through IN-05: out of scope, untouched

Every fix that changes behaviour was proved by planting the fault, watching the
gate or case go RED, reverting, and watching it go GREEN. The verbatim output of
each plant is recorded below. `extensions/` is unchanged: `git diff --quiet
562f5d13 HEAD -- extensions/` exits 0 across the whole phase including these
eleven commits.

## Fixed Issues

### CR-01: Two NFR-2 cases in the new entry-point suite pass with their fault injection removed

**Files modified:** `tests/index.test.ts`
**Commit:** `123ab7de`

**Applied fix:** `eventRefusingCwdRead` now returns `{ event, refused(), readCount() }`
instead of a bare proxy. Both cases assert the injection fired and that the handler
made exactly `CWD_READS_PER_DISCOVER` reads, and the bare ordinals became named
constants (`CWD_READ_DEFERRED_HYDRATE = 1`, `CWD_READ_PLUGIN_PATH_RECOMPUTE = 3`)
documenting the four stages that read `event.cwd`.

The two cases are also separated by a side effect, per the reviewer's second shape.
Each seeds one enabled plugin, so the plugin PATH recompute has work to do: the
hydrate-refused case asserts `PATH` gained the plugin's bin dir and
`PI_CLAUDE_MARKETPLACE_PATH` is set, and the recompute-refused case asserts both
were left alone. The answer and the emission count are identical either way, which
is exactly why they were the pristine-workspace case written twice.

**Plants:**

Both ordinals set past the last read (the reviewer's own experiment) — exactly the
two cases fail, and they fail on the refusal never firing:

```
✖ still answers when the deferred project-scope hydrate fails (NFR-2)
✖ still answers when the plugin PATH recompute fails (NFR-2)
ℹ tests 12  ℹ pass 10  ℹ fail 2
  AssertionError: actual: { refused: false, reads: 4 }, expected: { refused: true, reads: 4 }
```

Recompute case retargeted at the hydrate read (`= 1`) — only that case fails, and it
fails on the stage it names rather than on the answer:

```
✖ still answers when the plugin PATH recompute fails (NFR-2)
ℹ tests 12  ℹ pass 11  ℹ fail 1
  actual: '/usr/bin:/tmp/index-recompute-refused-cwd-Qdw06H/vendored-plugin/bin'
  expected: '/usr/bin'
```

Reverted: 12 pass / 0 fail.

---

### CR-02: The five gate scripts are wired into no automated run

**Files modified:** `package.json`, `CONTRIBUTING.md`
**Commit:** `6442ecf8`

**Applied fix:** `check` now runs `test:corresponding`, `test:corresponding:negative`
and `test:coverage:direct:negative` between `format:check` and the test suites. The
three together take 4.3 s measured; none spawns a test run.

The two slow sweeps stayed out, as the review directed. They did **not** get a CI
job, and the reason is measured rather than assumed: both stop at the first accepted
D-116-01a single-branch shortfall (`.planning/WINDOWS.md` entries 15-19, 21, 22), so
a nightly job for either would be red every night and report nothing. Instead
`CONTRIBUTING.md` gained a "Coverage sweeps (manual)" section naming both scripts,
when to run each (changed pairs before a PR that touches a production module, the
whole tree at a milestone boundary), and that a stop on a ledgered shortfall is the
expected outcome rather than a regression.

**Ordering note:** WR-01 was fixed before this wiring, per the review's own
instruction, because `test:coverage:direct` in its default mode was broken.

---

### WR-01: `npm run test:coverage:direct` (default mode) crashes on this branch

**Files modified:** `scripts/test-coverage-direct.mjs`
**Commit:** `f6a4a386`

**Applied fix:** `pairsForChangedPaths` filters through a new `isPairablePath` that
requires `.ts` on the production side and excludes the `nonCorrespondingRoots`
(`architecture`, `e2e`, `integration`) on the test side, mirroring the correspondence
gate.

**Beyond the review:** the reviewer's fix as written was not sufficient on this
branch. Three more changed paths remained unmappable — `tests/domain/device-flow-fake.test.ts`,
`tests/platform/credential-ops-fake.test.ts`, `tests/platform/git-ops-fake.test.ts` —
because they are the correspondence gate's *structural supplements* (a suite owning a
contract and its fake, with no production pair). `isPairablePath` mirrors that
exemption too, requiring both the `-fake.ts` and `-contract.ts` companions to be
present so a suite merely named `*-fake.test.ts` still has to map.

**Before / after:**

```
$ node scripts/test-coverage-direct.mjs                 # before
Not a production TypeScript path: extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
rc=1                                                    # zero pairs reached

$ node scripts/test-coverage-direct.mjs                 # after
Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts (branches 115/115, functions 30/30, lines 731/731)
... 20 pairs run ...
Incomplete direct coverage for extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts: branches 11/12
```

The run now reaches real work and stops on `import.ts`, which is accepted-shortfall
ledger entry 18 — the gate doing its job, not a mapping defect.

---

### WR-02: `assertReportComplete` cannot fail at its only production call site

**Files modified:** `scripts/test-coverage-direct.mjs`
**Commit:** `d556f3de`

**Applied fix:** `runAllPairs` reads the rows back out of the retained report and
asserts against those, instead of against the in-memory array the same loop just
appended to. The comment on `assertReportComplete` was rewritten to say plainly that
the report-less arm remains a structural invariant over the loop's own output and
cannot fail — the previous comment's claim about catching a quietly-skipping run was
untrue of the code as written.

**Plant:** the all-pair sweep takes about nine minutes, so the experiment used a
two-module scaffold (`productionPaths()` temporarily narrowed to `shared/types.ts` and
`shared/atomic-json.ts`) with one dropped `appendFileSync`. Both the scaffold and the
plant were reverted.

```
Arm A (read-back, one lost append):
  rc=1  Missing from the all-pair result: extensions/pi-claude-marketplace/shared/atomic-json.ts

Arm B (previous in-memory form, SAME lost append):
  rc=0  All-pair run complete: 2 pairs in 1.0s (963ms) on v26.8.1
  report rows actually written: 1
```

Arm B is the finding: a run reporting "2 pairs" against a report holding one row.

---

### WR-03: The gate scripts sit outside every quality gate the repository runs

**Files modified:** `package.json`, `eslint.config.js`, `scripts/test-coverage-direct.mjs`,
`scripts/test-coverage-direct.negative.mjs`
**Commits:** `ea5ca571`, then `ea14e3a0`

**Applied fix:** `lint` and `lint:fix` take `scripts` as an argument, with a new flat
config block scoped to `scripts/**/*.mjs` that switches off the type-aware presets the
same way the block for `eslint.config.js` already does, adds `globals.node`, and turns
off the `extensions/**`-scoped `no-restricted-syntax` ban on `process.stdout.write`
(which is how a command-line gate reports its verdict). The comment states that
`scripts/` sits outside the typed tree deliberately. The two drifted gate scripts were
reformatted.

**Deviation from the review, and why.** The review prescribed widening the brace list
to `"**/*.{js,mjs,json,ts}"`. That form was applied first (`ea5ca571`) and then
narrowed (`ea14e3a0`) because it **breaks `npm run fallow`**: fallow reads package.json
script globs as entry points, so naming `.mjs` repo-wide made `tests/live-uat/*.mjs`
reachable and turned their two `fallow-ignore-file unused-file` markers stale.

```
repo-wide "**/*.{js,mjs,json,ts}":   496 entry points detected → ✗ 2 stale suppressions, rc=1
"**/*.{js,json,ts}" + "scripts/**/*.mjs":  494 entry points detected → ✓ No issues found, rc=0
```

The shipped form passes `scripts/**/*.mjs` as a second glob argument. That keeps the
gate scripts formatted without changing what fallow sees anywhere else. The reason not
to merge the two globs is recorded in `eslint.config.js` beside the matching lint block,
so the next editor does not re-introduce it. The repo-wide form had also reformatted
two handoff kit scripts under `.planning/inputs/`; `ea14e3a0` restored both to their
pre-phase bytes, and they no longer appear in `git diff --name-only 562f5d13 HEAD`.

**Plants (both against the shipped form):**

```
unused binding appended to scripts/check-corresponding-tests.mjs:
  npm run lint → 216:7 error 'plantedUnusedBinding' is assigned a value but never used

misformatted statement in the same file:
  npm run format:check       → [warn] scripts/check-corresponding-tests.mjs
  previous glob (control)    → (no match; the old gate does not see the file)
```

**Not done:** `scripts/` was not added to `tsconfig.json`. The review offered that as
optional and asked only that the exclusion be stated where a reader will find it, which
the new eslint block does.

---

### WR-04: `assertCompleteCoverage` honors its injected project root only halfway

**Files modified:** `scripts/test-coverage-direct.mjs`, `scripts/test-coverage-direct.negative.mjs`
**Commit:** `4b6acf90`

**Applied fix:** record selection resolves through a new `recordProjectPath(root, path)`
that answers `undefined` for a path outside the given root instead of throwing, so the
injected root governs both halves of the answer and an LCOV record for an out-of-tree
module is a non-match rather than an abort. The CLI-facing `toProjectPath`, which
*should* refuse a path the user typed, is untouched and still used by `pairForPath` and
`productionPaths`.

The negative control dropped the workaround its fixture records carried (`lcovRecord`
now takes the absolute source path the caller chooses, via a small `inRepo()` helper)
and gained the two states that make the new behaviour falsifiable: a fixture-root record
that must reach a verdict, and a foreign record that must be passed over.

**Plants:**

```
filter reverted to the module-level toProjectPath:
  Error: Path is outside the project: /tmp/direct-coverage-gate-GU9xiA/extensions/pi-claude-marketplace/domain/types.ts
    at assertCompleteCoverage ... at test-coverage-direct.negative.mjs:103

recordProjectPath made to throw instead of answering undefined:
  AssertionError: The input did not match /Expected one LCOV record.*found 0/.
  Input: 'Error: Path is outside the project: /tmp/outside-every-root/peer.ts'
```

Reverted: `Direct-coverage negative controls passed.` rc=0.

---

### WR-05: `notification-boundary.ts` documents a `toolProbes` rule its newest consumer does not follow

**Files modified:** `tests/edge/notification-boundary.ts`
**Commit:** `49f1e1c5`

**Applied fix:** the `emissions * 2` derivation is replaced by a statement that the
ratio is not fixed, naming the three paths that break it: `notifyUsageError` and
`makeRawNotifyFn` both write straight to `ctx.ui.notify` and never probe, and an
emission routed through a caller-supplied `ui` never reaches this boundary's `ui` mock
so it does not count toward `emissions` while still probing through `pi`. The doc now
says to find out why a count moved before changing it, because refitting the number is
what turns it from a claim about the probe into a fudge factor.

The mechanism was traced in production, not inferred: `applyReconcile` emits exactly
one `notify()` per invocation (two `getAllTools()` reads), and the plugin PATH warning
and the last-ditch reconcile line both take `makeRawNotifyFn`, which probes nothing.

**Plant:** raising `loadExtension(2, 2)` to `(2, 4)`:

```
✖ reports the scope whose install state it cannot read once as a reconcile failure
  and once as a plugin PATH warning (PENV-01)
ℹ tests 13  ℹ pass 12  ℹ fail 1
   - when(() => extension API.getAllTools()).thenReturn([]).between(4, 4)
```

Two emissions really do take two probes on that path, so the old arithmetic was wrong.

---

### WR-06: Five EISDIR sites dropped the errno identity along with the runtime-owned wording

**Files modified:** `tests/persistence/config-io.test.ts`,
`tests/orchestrators/import/settings.test.ts`, `tests/bridges/agents/unstage.test.ts`,
`tests/orchestrators/plugin/install.test.ts`, `tests/orchestrators/plugin/reinstall.test.ts`
**Commit:** `07a83332`

**Applied fix:** each probe's catch now pins `{ code, syscall }` as a whole value
against `{ "EISDIR", "read" }` before returning the sentence, following the
`state-io.test.ts` case that composes from the cause and still asserts the identity. The
comment at each site says why: the probe is the same read production makes, so it moves
with whatever is on disk and is not independent evidence on its own.

**Plant** (on `config-io.test.ts`, drifting the fixture from a directory to a mode-000
file so both sides report `EACCES`/`open` rather than `EISDIR`/`read`):

```
Arm A (identity assertion present):
  ✖ returns the complete ordinary read failure
  ℹ pass 16  ℹ fail 1
    actual:   { code: 'EACCES', syscall: 'open' }
    expected: { code: 'EISDIR', syscall: 'read' }

Arm B (previous probe shape, SAME drift):
  ✔ returns the complete ordinary read failure
  ℹ pass 17  ℹ fail 0
```

Arm B is the finding: the case stays green while testing a different failure entirely.

---

### WR-07: The `undefined sessionManager` branch lost its test in the entry-point fold

**Files modified:** `tests/index.test.ts`
**Commit:** `4bf548be`

**Applied fix:** adds `contextWithoutSessionManager` (a `Proxy` answering the
`sessionManager` member with `undefined`) and a case driving the second input the
production comment names. Suite is now 13 cases.

**Plant:** giving the same helper a working session manager turns the new case red —

```
✖ leaves the session variables alone when there is no session manager (WR-02)
  actual:   [ '1', 'session-planted', 'session-planted' ]
  expected: [ undefined, undefined, undefined ]
```

**Limit of that plant, stated plainly:** the other half of the case's claim — that the
throw is swallowed rather than propagated — can only be falsified by removing the
`try`/`catch` in `extensions/pi-claude-marketplace/index.ts`, which this phase does not
touch. `node:test` does fail the case if the handler throws, so the claim is live; it
was simply not planted.

---

### WR-08: The glob-completeness gate treats every quoted substring in a script as a glob pattern

**Files modified:** `tests/architecture/unit-suite-glob-completeness.test.ts`
**Commit:** `d1c8ec02`

**Applied fix:** `pathsMatchedByScript` now rejects any scraped quoted argument that is
not a `tests/` glob, naming the script and the offending argument, and rejects a script
that quotes no glob at all. The doc comment records that the precondition is checked
rather than assumed.

**Plant** (quoting `--test-reporter=spec` in `test:coverage:unit`), which **refines the
review's claim**:

```
without the guard (control):
  ℹ pass 2  ℹ fail 0        ← the malformed script was INVISIBLE, not badly reported

with the guard:
  ✖ COV-04 the test:coverage:unit script reaches every unit test file that exists
  Error: the "test:coverage:unit" script quotes an argument that is not a tests/ glob:
    --test-reporter=spec
```

The review expected a confusing path diff. What actually happened is worse: `globSync`
matched nothing for the stray argument, the path set was unchanged, and the gate stayed
green against a malformed script.

## Skipped Issues

None.

## Verification

All gates were run in the **main checkout** of `features/unit-test-refactor`
(`workflow.use_worktrees` is `false`, so no worktree was created), unpiped, each exit
code read on its own.

| Gate | Result |
|---|---|
| `npm run typecheck` | rc 0 |
| `npm run lint` | rc 0 (now covers `scripts/`) |
| `npm run fallow` | rc 0 — 494 entry points, `✓ No issues found` |
| `npm run format:check` | **rc 1** — see below |
| `npm run test:corresponding` | rc 0 |
| `npm run test:corresponding:negative` | rc 0 |
| `npm run test:coverage:direct:negative` | rc 0 |
| `npm test` (PATH node v26.8.1) | rc 0 — 5143 tests / 295 suites / 0 fail |
| `npm test` (`/usr/bin/node` v22.22.2) | rc 0 — 5143 tests / 295 suites / 0 fail |
| `npm run test:integration` | rc 0 — 31 / 31 |

5143 is the measured baseline of 5142 plus the one case WR-07 added.

`npm run check` as a whole exits 1, and it stops at `format:check` on eight files that
are pre-existing, untracked and unrelated to this phase: `.mcp.json` and seven
`.planning/research/.cache/*.json`. That failure list contains no file this fix session
touched, and those files were deliberately left alone. Because that link short-circuits
the chain, the chain was also run with the format link omitted and completed rc 0 in
gate order — so `check` is green apart from the operator's own untracked files.

`git diff --quiet 562f5d13 HEAD -- extensions/` exits 0: no production file changed,
across the whole phase and these eleven commits. The working tree holds only the
operator's own pre-existing modifications (`.claude/settings.json`, `.codex/config.toml`)
and untracked files; nothing from this session is uncommitted.

## Notes for the reader

1. **WR-03 shipped a narrower glob than the review prescribed**, because the prescribed
   form fails `npm run fallow`. The measurement is in the WR-03 entry above and the
   constraint is recorded in `eslint.config.js`. Worth a look if the intent was
   repo-wide `.mjs` coverage: getting there needs the two `tests/live-uat/` suppressions
   revisited, which is a separate decision.
2. **CR-02 gave the two slow sweeps a documented cadence, not a CI job.** A job is not
   possible while the seven accepted D-116-01a shortfalls stand, because both scripts
   refuse a shortfall by design. When those close, `test:coverage:direct:all` becomes a
   candidate for the nightly workflow.
3. Nothing was added to `deferred-items.md` or `.planning/WINDOWS.md`: no finding in
   scope needed a production edit.

---

_Fixed: 2026-09-03T23:49:03Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
