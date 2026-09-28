---
phase: 114-degradation-and-documentation
plan: 03
subsystem: workflows-bridge
tags: [soft-dep, workflows, byte-equality, architecture-gate, negative-control]
status: complete

requires:
  - "platform/pi-api.ts::hasLoadedWorkflowEngine"
  - "shared/concerns/soft-dep.ts::Dependency member \"workflows\""
  - "orchestrators/plugin/install.ts::composeInstalledRow declaresWorkflows"
  - "tests/architecture/source-scan.ts::assertNoForbiddenSurface"
provides:
  - "tests/orchestrators/plugin/install.test.ts::installWorkflowBearingPlugin (returns envelope bytes + inventory + row)"
  - "tests/orchestrators/plugin/install.test.ts::the WDEP-02 / WDEP-03 byte-equality pair"
  - "tests/architecture/no-probe-in-workflows-bridge.test.ts (the probe-purity gate)"
affects:
  - "docs/workflows-compatibility.md (plan 04 states the write-anyway contract this plan proves)"

tech-stack:
  added: []
  patterns:
    - "byte-equality pair anchored on an independently written literal, so agreement cannot be satisfied by two empty reads"
    - "forbidden-surface gate with explicitly enumerated targets (WR-06 missing-target failure)"

key-files:
  created:
    - tests/architecture/no-probe-in-workflows-bridge.test.ts
  modified:
    - tests/orchestrators/plugin/install.test.ts

decisions:
  - "The existing `installWorkflowBearingPlugin` helper was WIDENED to return `{ envelopeBytes, recordedWorkflows, row }` rather than a second near-identical helper being added beside it. Two install helpers differing only in what they return is exactly the shape `sonarjs/no-identical-functions` and `fallow dupes` exist to refuse."
  - "The non-vacuity anchor is a full byte pin against an independently written envelope literal, not a `JSON.parse` structural check. The acceptance criterion forbids `JSON.parse` on the compared value, and a byte pin is the stronger claim anyway: it is the same instrument criterion 2 is measured on."
  - "`orchestrators/plugin/install.ts` is NOT a gate target, against 114-PATTERNS.md section 2's suggestion. It calls `softDepStatus(pi)` legitimately at `install.ts:1854` for the install row's severity, so listing it would make the gate red on day one."
  - "Both planted-violation controls were run, not just the forbidden-symbol one: the missing-target half is what proves WR-06 is live, and it is the half a glob would have silently disabled."

metrics:
  duration: "~25m"
  completed: 2026-09-08

actuals:
  tokens: 2550
  tasks: 2
  commits: 2

plan_head_before: 5997dcda70f543ad55f265dc41ad831b223bea68
---

# Phase 114 Plan 03: Engine-independent envelope bytes — Summary

Criterion 2 is now proved twice. Behaviorally: two installs of one fixture that
differ only in the session's tool list write byte-identical envelopes and
identical inventories, and each run is separately shown to have reached the arm
its tool list names. Structurally: the five modules that write, replace and
remove those envelopes cannot name the probe at all, so no future change can
make the write conditional on the answer.

## What was built

**The byte pair (`tests/orchestrators/plugin/install.test.ts`).** One case,
`WDEP-02 / WDEP-03: the envelope bytes do not depend on whether the host engine
is loaded`, calling `installWorkflowBearingPlugin` exactly twice — once with
`["workflow"]` (the `@nicknisi/pi-workflows` decoy, so the engine reads absent)
and once with `["workflow_control"]`. Each call takes its own
`withHermeticHome` and its own `mkdtemp` cwd, removed in a `finally`; two runs
sharing one home would let the first run's envelope satisfy the second run's
read.

The helper already existed (plan 01 wrote it for the marker case) and was
widened rather than duplicated. It now returns `{ envelopeBytes,
recordedWorkflows, row }`: the raw `readFile(..., "utf8")` string, the persisted
`record.resources.workflows`, and the rendered row. `locationsFor` is called
INSIDE the hermetic closure, and the envelope path is composed with `path.join`
rather than the async `workflowArtifactPath` composer, carrying the existing
case's comment about why (a forgotten `await` there yields a leaf named after a
promise instead of throwing).

**The comparison is on bytes.** `assert.equal` over two raw utf-8 strings, with
no `JSON.parse` anywhere in the case. A parsed comparison would green over a
key-order or whitespace difference, which is the difference criterion 2 is about.

**The purity gate (`tests/architecture/no-probe-in-workflows-bridge.test.ts`).**
Five explicitly named `bridges/workflows/*.ts` targets — `discover.ts`,
`index.ts`, `stage.ts`, `types.ts`, `unstage.ts` — each preceded by the
requirement that makes it probe-free, scanned for four `\b`-anchored patterns:
`softDepStatus`, `SoftDepStatus`, `hasLoadedWorkflowEngine`,
`workflowEngineLoaded`. `assertNoForbiddenSurface` is called with exactly three
arguments; no `allowMissing` opts object, because WR-06's missing-target failure
is the whole point.

## Non-vacuity: what would still be green if the behavior were broken

The plan's prohibition is that two agreeing runs must never be accepted as
proof on their own. Four assertions carry that weight, and each one was chosen
against the question "what stays green if this breaks":

| Assertion | What it rules out |
|---|---|
| `assert.equal(withoutEngine.envelopeBytes, workflowEnvelopeBytes)` | Both runs writing nothing, or writing something other than the envelope. The literal is written independently of `buildEnvelope`, so it is not the production serializer grading its own homework. |
| `assert.deepStrictEqual(withoutEngine.recordedWorkflows, ["hello:greet"])` | Both runs staging zero workflows, which would make the record deep-equality a comparison of two empty arrays. |
| `assert.match(withoutEngine.row.message, /\{[^}]*requires pi-dynamic-workflows[^}]*\}/)` | Neither run degrading — the case passing because both sessions saw the engine. |
| `assert.doesNotMatch(withEngine.row.message, /requires pi-dynamic-workflows/)` | The marker being unconditional, which would make the previous assertion prove nothing about the probe. |

`readFile` throws `ENOENT` rather than returning an empty string, so "the
envelope exists" is proved structurally by the helper's own read before any
comparison runs.

**Control run for the byte pair.** The two `toolNames` arguments were made
identical (`["workflow_control"]` for both) and the suite re-run. Exactly one
case reddened — the new one — on the marker assertion:

```
✖ WDEP-02 / WDEP-03: the envelope bytes do not depend on whether the host engine is loaded (44.060322ms)
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /\{[^}]*requires pi-dynamic-workflows[^}]*\}/. Input:

  '● mp [project]\n  ● hello v0.0.1 (installed)\n\n/reload to pick up changes'

      at TestContext.<anonymous> (.../tests/orchestrators/plugin/install.test.ts:9793:10)
```

The tool lists were restored and the suite is green at 152 cases.

## The two planted-violation runs (mandatory, Task 2)

### 1. Forbidden symbol

`import type { SoftDepStatus } from "../../platform/pi-api.ts";` was added to
`bridges/workflows/stage.ts` and nothing else touched. The gate was green
immediately before. Verbatim:

```
✖ WDEP-02 + WDEP-03: the workflows bridge has zero host-engine probe surface (13.801025ms)
ℹ tests 1
ℹ pass 0
ℹ fail 1

✖ failing tests:

test at tests/architecture/no-probe-in-workflows-bridge.test.ts:76:1
✖ WDEP-02 + WDEP-03: the workflows bridge has zero host-engine probe surface (13.801025ms)
  AssertionError [ERR_ASSERTION]: WDEP-02 / WDEP-03 violation: host-engine probe surface detected in the workflows bridge:
    extensions/pi-claude-marketplace/bridges/workflows/stage.ts matches forbidden soft-dependency snapshot type: /\bSoftDepStatus\b/
    (a bridge that can read the probe can make the envelope write conditional on it, which turns a recoverable state -- install the engine, reload, everything runs -- into a reported install with no artifact, recoverable only by a reinstall. The probe belongs to the notify marker; orchestrators/plugin/install.ts is the only file that legitimately reads it, for the install row's severity.)
  + actual - expected

  + [
  +   'extensions/pi-claude-marketplace/bridges/workflows/stage.ts matches forbidden soft-dependency snapshot type: /\\bSoftDepStatus\\b/'
  + ]
  - []
```

**The offender line names the file that was planted in, and no other.** The
import was removed, `git status --short extensions/` is empty, and the gate is
green again.

### 2. Missing target

`.../bridges/workflows/stage.ts` was misspelled `.../staging.ts` in
`FORBIDDEN_TARGETS`. The gate failed on the missing target rather than passing
over four files:

```
✖ WDEP-02 + WDEP-03: the workflows bridge has zero host-engine probe surface (12.502558ms)
ℹ tests 1
ℹ pass 0
ℹ fail 1

✖ failing tests:

test at tests/architecture/no-probe-in-workflows-bridge.test.ts:76:1
✖ WDEP-02 + WDEP-03: the workflows bridge has zero host-engine probe surface (12.502558ms)
  AssertionError [ERR_ASSERTION]: source-scan: target extensions/pi-claude-marketplace/bridges/workflows/staging.ts does not exist, so this gate inspected nothing for it. A renamed or deleted target silently uncovers the gate; add it to allowMissing only while it is genuinely unwritten.
      at assertNoForbiddenSurface (.../tests/architecture/source-scan.ts:81:16)
```

The path was restored and the gate is green. This is the half a glob would have
silently disabled: a directory rename under a glob leaves the gate scanning zero
files and reporting success.

## The live end-to-end half of WDEP-03 rests on Spike 027, not on a suite

"A real host engine started after an engine-absent install lists and runs the
envelope with no reinstall" is a `backstop` truth and has **no automated home on
this tree**. `tests/live-uat/` holds only `manifest-absence-canary.mjs`,
`stop-canary.mjs` and `README.md`; `workflow-storage-canary.mjs` does not exist
here (CONTEXT D-114-08).

The evidence is **Spike 027**, which re-drove the equivalent probes against
`@quintinshaw/pi-dynamic-workflows` 3.10.1 with a negative control and recorded
that a hand-planted envelope is found by the engine's own `storage.list()`
across all three tiers. No canary was manufactured to stand in for it, and no
`tests/...` path naming one was written anywhere — `no-stale-test-citations`
would have caught that, and it is green.

What this plan DOES establish about that claim, mechanically: the artifact path
and the probe path never touch. `prepareStageWorkflows` takes a
`StageWorkflowsInput` carrying no `pi`, the gate proves no bridge module can
reach the probe by any other route, and the byte pair shows the two probe states
produce the same file. The engine registers from its own directory scan at its
own session start, so an envelope written earlier is found later without a
reinstall.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] The plan's cited `install.ts` probe line was stale**

- **Found during:** Task 2 preparation
- **Issue:** The plan's `read_first` cites the legitimate `softDepStatus(pi)`
  call at `install.ts:1835-1850`. Plans 01 and 02 shifted it to line 1854.
- **Fix:** The gate anchors on SYMBOLS (`softDepStatus`, `SoftDepStatus`,
  `hasLoadedWorkflowEngine`, `workflowEngineLoaded`), never on a line number,
  and the header names the file and its reason rather than a line. Nothing in
  the new suite can go stale when the call moves again.
- **Files modified:** none beyond the new suite
- **Commit:** 71fe2d0c

### Notes on what the plan expected and what the tree held

- **The helper was widened, not duplicated.** The plan's action step says to
  "structure it as a small local helper that performs one install and returns
  `{ envelopeBytes, record, message }`". That helper already existed —
  `installWorkflowBearingPlugin`, written by plan 01, returning only the row.
  Adding a second one beside it would have put two install bodies differing
  only in their return value in one file, which `sonarjs/no-identical-functions`
  and `fallow dupes` both exist to refuse. The existing WDEP-02 marker case
  moved from `withoutEngine.message` to `withoutEngine.row.message`
  accordingly; its assertions are unchanged.

- **`114-PATTERNS.md` section 2 lists `install.ts` as a sixth gate target.** It
  is not one. The plan's own `<prohibitions>` block and CONTEXT's
  "Engine-independent bytes" area both say the opposite, and the tree agrees:
  `install.ts:1854` calls the probe legitimately for the install row's severity.
  A gate listing it would have been red on its first run.

- **The four non-vacuity assertions from `114-RESEARCH.md` were used as
  written**, plus two more the orchestrator's brief required: the envelope byte
  pin and the `["hello:greet"]` inventory pin, which are what stop "same bytes"
  from being satisfiable by "no bytes at all, twice".

- **`grep -c 'doesNotMatch'` moved 1 → 2**, satisfying the verify step's
  "greater than the count recorded before this task".

## Known Stubs

None. No stub, skipped test, or unrun `<verify>` was left behind — every
`<automated>` command in both tasks was run and is recorded in the table below.
Nothing was appended to `.planning/WINDOWS.md`.

## Threat Flags

None. Both files changed are tests. No network endpoint, auth path, file-access
pattern or schema change was introduced. `git diff --name-only` for
`package.json`, `package-lock.json`, `sonar-project.properties` and
`CHANGELOG.md` is empty across both commits (D-114-07, T-114-SC), and
`orchestrators/plugin/info.ts` appears in neither diff.

## Verification

| Gate | Result |
|---|---|
| `node --test tests/orchestrators/plugin/install.test.ts` | `# fail 0`, 152 tests |
| `node --test tests/architecture/no-probe-in-workflows-bridge.test.ts` | `# fail 0`, 1 case |
| Planted forbidden symbol in `stage.ts` | gate red, offender line names `stage.ts` only; restored, green |
| Planted missing target (`staging.ts`) | gate red on the WR-06 missing-target assertion; restored, green |
| Control: identical `toolNames` on both runs | byte pair red on the marker assertion, and only that case; restored, green |
| `grep -c 'bridges/workflows/'` on the new suite | 5 (>= 5) |
| `grep -rn 'softDepStatus\|SoftDepStatus\|hasLoadedWorkflowEngine\|workflowEngineLoaded' extensions/pi-claude-marketplace/bridges/` | no match |
| `node --test tests/architecture/no-stale-test-citations.test.ts tests/architecture/unit-suite-glob-completeness.test.ts` | `# fail 0`, 3 tests |
| `npm run typecheck` | 0 errors |
| `npm run lint` | clean |
| `npm run fallow` | exit 0 |
| `npm run format:check` | clean |
| `npm test` | `# fail 0`, 5563 tests |
| `npm run check` | exit 0 |
| `pre-commit run --files <changed>` | clean before each commit, except the structural TruffleHog worktree failure |
| TruffleHog filesystem scan of both files | `verified_secrets: 0`, `unverified_secrets: 0`, exit 0 |
| `git diff --name-only -- package.json package-lock.json sonar-project.properties CHANGELOG.md` | empty |
| `.planning/workstreams/workflows/STATE.md` / `ROADMAP.md` | not modified |
| `.claude/settings.json` / `.codex/config.toml` | not staged, not modified by this plan |

**TruffleHog note.** The `trufflehog` pre-commit hook runs in git mode and
aborts structurally in this linked worktree (`failed to read index file: ...
.git/index: not a directory`). Both commits were prefixed `SKIP=trufflehog` and
only after a clean filesystem scan of the exact paths being committed, per the
project's CLAUDE.md.

**Commit-count basis.** `actuals.commits: 2` counts the two task commits,
measured as `git rev-list --count 5997dcda..HEAD` at SUMMARY-write time, on the
same basis plans 01 and 02 used. `actuals.tokens` is measured as `chars / 4`
over the realized diff's added and removed content lines (10,226 chars →
~2,550), the instrument `114-02-SUMMARY.md` records — not the `tokens: 44000`
scale the plan's estimate used.

## Self-Check: PASSED

- `tests/architecture/no-probe-in-workflows-bridge.test.ts` — FOUND, 5 explicit
  targets, 4 `\b`-anchored patterns, `assertNoForbiddenSurface` called with 3
  arguments
- `tests/orchestrators/plugin/install.test.ts` — FOUND, the
  `WDEP-02 / WDEP-03` case present, `doesNotMatch` count 2, no `JSON.parse` in
  the new case
- Commit `cbe63568` — FOUND
- Commit `71fe2d0c` — FOUND
- `extensions/pi-claude-marketplace/bridges/workflows/*.ts` — all five present
  and byte-unchanged by this plan (`git status --short extensions/` empty)
- `orchestrators/plugin/info.ts` — NOT in either commit's diff, as required
- `.planning/workstreams/workflows/STATE.md` / `ROADMAP.md` — NOT modified
