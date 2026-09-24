---
phase: 117-measured-agent-failure-evidence
fixed_at: 2026-09-09T20:36:00Z
review_path: .planning/workstreams/workflows/phases/117-measured-agent-failure-evidence/117-REVIEW.md
iteration: 1
findings_in_scope: 14
fixed: 14
skipped: 0
status: all_fixed
---

# Phase 117: Code Review Fix Report

**Fixed at:** 2026-09-09T20:36:00Z
**Source review:** `117-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 14 (2 critical, 12 warning)
- Fixed: 14
- Skipped: 0
- Out-of-scope Info closed in passing: 1 (IN-04)
- Out-of-scope Info left open: 3 (IN-01, IN-02, IN-03)
- Broken Windows entries filed: 1 (id 46)

The scratch engine was re-installed at `@quintinshaw/pi-dynamic-workflows@3.10.1` to
`/tmp/wf-engine` for the duration of this work, used to re-derive the code list from
source and to exercise every canary fix end to end, and removed afterward. It never
entered `package.json` or `package-lock.json`, and `--ignore-scripts` was not used.

## How the corrected code list was derived

The review's fix suggestion proposed publishing six codes as the set. Reading the
engine at 3.10.1 shows the honest answer is stronger and different: **the list cannot
be proven closed, and the code is not a reliable predictor of the class at all.** Both
facts are now in the doc.

Derivation, in order:

1. **The enum is 12 codes** (`src/errors.ts:31-64`), so the class is not the enum.
1. **Recoverability is per construction site, not per code.** `WorkflowError` sets
   `this.recoverable = options.recoverable ?? false` (`src/errors.ts:83`) — omitting
   the option yields a NON-recoverable error. So a new site can add a code to the
   class without any enum change and without any derivation site to catch it.
1. **Two codes sit on both sides of the split.** `WORKFLOW_ABORTED` is
   `recoverable: true` at `src/workflow.ts:610` and `false` at `:1358-1361`;
   `AGENT_EXECUTION_ERROR` is `true` in `wrapError`'s catch-all (`src/errors.ts:200-204`)
   and `false` at `src/workflow-manager.ts:800-804`.
1. **The flags survive classification.** `wrapError` returns an existing `WorkflowError`
   unchanged (`src/errors.ts:167`), so a `recoverable: false` set inside `agent.ts`
   reaches the retry arm intact and rejects.
1. **`wrapError` can also mint a non-recoverable code out of a plain `Error`** whose
   message matches a provider-limit pattern (`src/errors.ts:185-198`). The catch-all
   is not the last word.
1. **Restricting to `agent()`'s own failure path** and taking the distinct codes whose
   construction site sets `recoverable: false` gives **six**:
   `MODEL_NOT_FOUND` (`agent.ts:939-941`), `AGENT_LIMIT_EXCEEDED` (`workflow.ts:550-559`),
   `TOKEN_BUDGET_EXHAUSTED` (`workflow.ts:666-668`, `:680-686`),
   `SCRIPT_VALIDATION_ERROR` (`workflow.ts:618-632`, `:698-704`; `agent.ts:830-844`, `:876-890`),
   `PROVIDER_USAGE_LIMIT` (`agent.ts:109-113`), `SCHEMA_NONCOMPLIANCE` (`agent.ts:164-171`).
   This matches `117-RESEARCH.md`'s branch matrix rows 1/2/4-9 (credential-free) plus
   rows 13/14 (`:203-204`), and the doc's four were rows 4/5/9 plus the validation rows.

**Grade split, per the doc's own rule.** Of the six, only `MODEL_NOT_FOUND` is
reproducible from the canary the table names, so only that one carries the
runtime-measured grade. `AGENT_LIMIT_EXCEEDED`, `TOKEN_BUDGET_EXHAUSTED` and
`SCRIPT_VALIDATION_ERROR` were driven at 3.10.1 by the research probe
(`117-RESEARCH.md:253-266`) that was never committed, so they are published at
source-read. The remaining two need a live provider and were only read. The doc says
all of this explicitly and marks the list as read-on-one-path-at-one-version rather
than closed.

## Fixed Issues

### CR-01: The published non-recoverable code list is incomplete and reads as closed

**File:** `docs/workflows-compatibility.md`
**Commit:** `eadbd677`
**Applied fix:** Replaced the four-code enumeration with all six, plus three new
paragraphs establishing that the list is not closed (per-site flag, `?? false`
default, message-matched provider limit) and grading each code at the evidence that
actually backs it. Verified against `117-RESEARCH.md` and re-derived from the engine
source at 3.10.1 (see above).

### CR-02: "the class decides the outcome" is falsified by a case the same phase measured

**File:** `docs/workflows-compatibility.md`
**Commits:** `c657202c` (lead-in at `:134`), `eadbd677` (body)
**Applied fix:** The lead-in no longer says "the class decides the outcome". The body
now states only the safe direction — read `recoverable: false` as "this rejects", never
read `recoverable: true` as "this resolves to `null`" — and gives the abort as the
counter-example with two citations: the pre-try guard that throws `WORKFLOW_ABORTED`
with `recoverable: true` (`src/workflow.ts:608-612,650`), and the guard inside the
retry loop that rethrows before classification ever runs (`:941-944`), which I read
directly and which is stronger than the research's row-3 note.

### WR-01: A `parallel()` claim carries a runtime-measured grade the canary cannot reproduce

**File:** `docs/workflows-compatibility.md`
**Commit:** `c5385d89`
**Applied fix:** Split the sentence. `pipeline()` keeps the runtime-measured grade and
names the canary; `parallel()` is source-read at `src/workflow.ts:1036-1044`, with
`pipeline()`'s own arm cited at `:1074-1080`. Both arms read directly in the scratch
install.

### WR-02: Two claims in the rewritten section carry no evidence grade

**File:** `docs/workflows-compatibility.md`
**Commit:** `eadbd677`
**Applied fix:** The catch-all citation now reads `(source-read at 3.10.1, src/errors.ts:200-204)`,
and the code enumeration carries its own graded citation set.

### WR-03: The `@nicknisi` row's grade matches none of the five defined grade names

**File:** `docs/workflows-compatibility.md`
**Commit:** `1600257f`
**Applied fix:** `**runtime-measured at 0.2.1**`. The version came from the spike that
produced the observation: `.planning/spikes/022-b-script-trust-boundary-nicknisi/README.md:58`
installs `@nicknisi/pi-workflows@0.2.1`, and `:146-152` records the failing-spawn run
that threw.

### WR-04: "The two engines therefore agree" is false under the document's own vocabulary

**File:** `docs/workflows-compatibility.md`
**Commit:** `c657202c`
**Applied fix:** "Claude Code and the chosen engine therefore agree", with an explicit
note that "engine" stays reserved for the two Pi extensions.

### WR-05: The claimed divergence from Claude Code is asserted with no evidence

**File:** `docs/workflows-compatibility.md`
**Commits:** `c657202c`, plus the lead-in change in the same commit
**Applied fix:** The lead-in no longer says the hosts "part company on the second". The
closing paragraph states the one-sided fact (this engine rejects, cites `:1430-1471`)
and then says Claude Code's behaviour on a non-recoverable failure has been neither
read out of the binary nor measured, so no divergence is claimed.

### WR-06: The sandbox guard is a substring test and a `..` segment walks through it

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs`
**Commit:** `d88fdff9`
**Applied fix:** `SANDBOX_ROOT = path.resolve(process.cwd(), "tmp", "pi-uat")`; the
supplied value is resolved and must equal the root or start with `SANDBOX_ROOT + path.sep`.
The resolved value is returned, so `stateDir` is built from it. Exercised below.

### WR-07: A3's verdict is read without its own measurement precondition

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs`
**Commit:** `a6c61af4`
**Applied fix:** Extracted `requireInducedFailure(run)` and applied it to both the A1
drive and the A3 drive. A2 is deliberately ungated: a bogus model spec fails regardless
of credentials. Exercised below.

### WR-08: The validated engine root is discarded and the entry path is hard-coded

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs`
**Commit:** `eeba6dfc`
**Applied fix:** `resolveEngineVersion` became `resolveEngine`, returning
`{ entry, version }` where `entry` comes from the manifest's `main` and is existence-checked
and routed through `liveEngineRequired`. `main` no longer re-reads `process.env`.
Exercised below.

### WR-09: The cleanup `finally` can replace the failure it was meant to survive

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs`
**Commit:** `852b32ab`
**Applied fix:** `rm(...).catch(...)` reports the cleanup failure on stderr and lets the
original error stand. Exercised below with a real `EACCES`.

### WR-10: `NOTHING WAS MEASURED` diagnoses a cause it did not observe

**Files:** `tests/live-uat/workflow-agent-failure-canary.mjs`, `tests/live-uat/README.md`
**Commits:** `5c79eaca` (driver), `56c2c0a7` (README)
**Applied fix:** The headline is now "no log line named `AGENT_EXECUTION_ERROR`", which is
what the absence supports. The body branches on the logs: empty means the shape a
successful call produces, so the provider reading is offered; non-empty without the
marker says the engine ran and used different words, so the operator is sent to the
engine's vocabulary rather than to their own credentials. Both branches exercised below.

### WR-11: The README states a containment guarantee the code does not deliver

**File:** `tests/live-uat/README.md`
**Commit:** `1727456c`
**Applied fix:** WR-06 makes the existing sentence true. Both README sites now also say
how it is enforced — both sides resolved, `..` refused, `tmp/pi-uat-backup` not a child —
so a reader can tell it is a containment check rather than a name test.

### WR-12: The reproduction route installs an unpinned engine while the doc pins every citation

**Files:** `tests/live-uat/README.md`, `tests/live-uat/workflow-agent-failure-canary.mjs`
**Commit:** `8de38b0a`
**Applied fix:** Both run blocks and the prerequisite row pin `@3.10.1`, with a note that
dropping the pin re-measures against a different version, which the PASS lines will name.

### IN-04 (out of scope, closed in passing): the documented run leaves the sandbox root behind

**Files:** `tests/live-uat/README.md`, `tests/live-uat/workflow-agent-failure-canary.mjs`
**Commit:** `4bc0859f`
**Applied fix:** Both teardown lines became `rm -rf /tmp/wf-engine tmp/pi-uat/wf-agent`.
Closed only because the WR-12 fix edited the same two blocks.

## Collateral corrections

### `117-SECURITY.md` — two threat rows re-cited and amended

**Commit:** `8b5dc278`

- **T-117-02** closed on `assertSandboxContainment` by citing its *ordering* (before
  `mkdir`, before the import), which always held. The guard itself was the substring test
  WR-06 names. The audit's live re-drive used `$HOME/.pi/agent`, which the substring test
  *did* refuse, so it never reached the hole. The row now records what the guard checked,
  why the re-drive missed it, and what it checks now.
- **T-117-03** closed on A0 covering "the" drive; it covered one of three. The row records
  the gap and the fix.
- **T-117-06**'s literal-only citations were repointed to the moved lines.

### Broken Windows ledger id 46

`gsd-tools windows append --kind unmet-truth --phase 117`, description prefixed
`[workflows-replay]`. Records that `stop-canary.mjs:193` and
`manifest-absence-canary.mjs:142` carry the same substring guard, and that fixing them
was left out of this phase's scope. Committed as `bdb1d00a`.

## Transcripts

Every behavioural canary fix was exercised. `node --check` passed on every edit.

### WR-06 — traversal and sibling names are now refused

Pre-fix predicate, evaluated directly:

```text
OLD predicate agentDir.includes(path.join("tmp","pi-uat")) = true
OLD existsSync(agentDir) = true
=> old guard verdict: ACCEPTED, engine would have been handed
   /home/acolomba/pi-claude-marketplace-workflows/tmp/pi-uat/../../../tmp
```

Post-fix, same value:

```text
[wf-agent-canary] LIVE ENGINE REQUIRED: PI_CODING_AGENT_DIR
  (/home/.../tmp/pi-uat/../../../tmp -> /home/acolomba/tmp) is not inside
  /home/acolomba/pi-claude-marketplace-workflows/tmp/pi-uat.
  Refusing to hand the engine an agent-state directory outside the disposable sandbox.
EXIT=1
```

Sibling name `tmp/pi-uat-backup`, post-fix:

```text
[wf-agent-canary] LIVE ENGINE REQUIRED: PI_CODING_AGENT_DIR
  (.../tmp/pi-uat-backup -> .../tmp/pi-uat-backup) is not inside .../tmp/pi-uat.
EXIT=1
```

### WR-07 — A3's guard fires

Driven against a stub engine that returns the induced-failure shape for the first two
drives and the shape three SUCCESSFUL calls produce (`{ logs: [], result: { rows: 3,
survivors: 3 } }`) for the fan-out drive.

Post-fix:

```text
[wf-agent-canary] engine 3.10.1-stub
[wf-agent-canary] PASS: A0: the agent call failed as induced, ...
[wf-agent-canary] PASS: A1: a recoverable agent() failure resolves to null ...
[wf-agent-canary] PASS: A2: a non-recoverable agent() failure rejects MODEL_NOT_FOUND ...

[wf-agent-canary] NOTHING WAS MEASURED: no log line named AGENT_EXECUTION_ERROR.
  The run produced no logs at all, which is the shape a SUCCESSFUL agent call
  produces. The sandbox most likely resolved a provider, ...
EXIT=1
```

Pre-fix, same stub — the mis-attribution the finding describes:

```text
[wf-agent-canary] FAILED:
AssertionError [ERR_ASSERTION]: A3: the fan-out pattern did not drop its failed items
and complete at engine 3.10.1-stub.
+   survivors: 3
-   survivors: 0
EXIT=1
```

### WR-08 — a missing entry routes as a precondition

Against a scratch tree carrying a manifest but no `dist/`:

```text
[wf-agent-canary] LIVE ENGINE REQUIRED: the engine entry point is missing at
  /tmp/wf-broken/node_modules/@quintinshaw/pi-dynamic-workflows/dist/index.js.
  The scratch install may be incomplete, or the engine changed its published layout.
EXIT=1
```

Pre-fix, same tree:

```text
[wf-agent-canary] FAILED:
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/tmp/wf-broken/.../dist/index.js'
    at finalizeResolution (node:internal/modules/esm/resolve:272:11)
EXIT=1
```

### WR-09 — the verdict survives a failing cleanup

Stub engine chmods the state directory's parent to `0500`, so `rm` rejects `EACCES`
while an `--invert` assertion is already in flight.

Post-fix — cleanup reported, A1 verdict preserved:

```text
[wf-agent-canary] PASS: A0: the agent call failed as induced, ...
[wf-agent-canary] cleanup failed for .../wf-agent-canary-1254172: EACCES: permission
  denied, rmdir '.../wf-agent-canary-1254172'

[wf-agent-canary] FAILED:
AssertionError [ERR_ASSERTION]: A1: a recoverable agent() failure did not produce the
expected observable at engine 3.10.1-busystub.
EXIT=1
```

Pre-fix — the verdict is gone:

```text
[wf-agent-canary] PASS: A0: the agent call failed as induced, ...

[wf-agent-canary] FAILED:
Error: EACCES: permission denied, rmdir '.../wf-agent-canary-1254188'
EXIT=1
```

### WR-10 — both branches

Marker renamed by the engine (non-empty logs):

```text
[wf-agent-canary] NOTHING WAS MEASURED: no log line named AGENT_EXECUTION_ERROR.
  The run produced 1 log line(s), none naming the marker. Either the
  induced failure did not occur, or this engine version no longer uses that name.
  Check the engine's error vocabulary before concluding anything about this machine.
  observed logs=["agent \"agent 1\" exhausted 1 attempt: SUBAGENT_RUN_FAILED ..."]
EXIT=1
```

Pre-fix, same run — the unhedged, wrong diagnosis:

```text
[wf-agent-canary] NOTHING WAS MEASURED: the agent call did not fail.
  The sandbox resolved a provider, so the induced failure never occurred ...
```

No logs at all (post-fix):

```text
[wf-agent-canary] NOTHING WAS MEASURED: no log line named AGENT_EXECUTION_ERROR.
  The run produced no logs at all, which is the shape a SUCCESSFUL agent call
  produces. The sandbox most likely resolved a provider, ...
EXIT=1
```

### The canary still measures, end to end, against the real engine

Real `@quintinshaw/pi-dynamic-workflows@3.10.1`, credential-free sandbox, after all
five driver fixes:

```text
[wf-agent-canary] engine 3.10.1
[wf-agent-canary] PASS: A0: the agent call failed as induced, so this run measured
  something (engine 3.10.1)
[wf-agent-canary] PASS: A1: a recoverable agent() failure resolves to null (engine 3.10.1)
[wf-agent-canary] PASS: A2: a non-recoverable agent() failure rejects MODEL_NOT_FOUND
  (engine 3.10.1)
[wf-agent-canary] PASS: A3: three fanned-out failures return 3 rows, 0 survive the
  truthiness filter, and the run completes (engine 3.10.1)
EXIT=0
```

The A3 gate did not falsely fire: the fan-out drive genuinely produced the marker.

Negative control, same engine:

```text
[wf-agent-canary] PASS: A0: the agent call failed as induced, ... (engine 3.10.1)

[wf-agent-canary] FAILED:
AssertionError [ERR_ASSERTION]: A1: a recoverable agent() failure did not produce the
expected observable at engine 3.10.1.
+   isNull: true
-   isNull: false
EXIT=1
```

A0 still passes on the inverted run, which is the discrimination the control is for.

## Gate results

Doc gates, re-run after every doc edit:

```text
node --test tests/architecture/workflows-doc-pins.test.ts \
            tests/architecture/no-stale-test-citations.test.ts
ℹ pass 5
ℹ fail 0
```

Full chain, run to completion after the last commit:

```text
npm run check
EXIT=0
  typecheck                      tsc --noEmit                        clean
  lint                           eslint extensions tests scripts     clean
  fallow dead-code               ✓ No issues found (0.57s)
  fallow health                  ● Health score: 78 B                exit 0
  fallow dupes                   35 clone groups, 1.4%               exit 0
  format:check                   All matched files use Prettier code style!
  test:corresponding             clean
  test:corresponding:negative    clean
  test:coverage:direct:negative  clean
  test                           ℹ tests 5654  ℹ pass 5654  ℹ fail 0
  test:integration               ℹ tests 35    ℹ pass 35    ℹ fail 0
```

Baseline preserved exactly: 5654 unit, 35 integration, exit 0.

## Environment

- Scratch prefix `/tmp/wf-engine` installed at `@3.10.1` and **removed**; `/tmp/wf-engine`
  absent, `node_modules/@quintinshaw` absent.
- `package.json` and `package-lock.json` untouched (`git status` clean for both; zero
  occurrences of `pi-dynamic-workflows` in either).
- All stub engine trees under `/tmp` removed. `tmp/pi-uat/wf-agent` removed.
- No operator-owned file was staged. Every commit staged explicit paths and was verified
  with `git show --stat`.
- `pre-commit run --files <paths>` was run before every commit; the only failing hook was
  `trufflehog`, which fails structurally in this linked worktree (`.git` is a file). Each
  commit was preceded by a filesystem scan over exactly the committed paths, every one
  reporting `verified_secrets: 0, unverified_secrets: 0`, and used `SKIP=trufflehog` and
  nothing else.

## Info findings left open (out of scope)

- **IN-01** `err && err.code` inside the generated script body. Latent — the engine always
  rejects with a `WorkflowError`. Not touched by any fix above.
- **IN-02** `process.exit(0)` can truncate piped output. A directory-wide convention shared
  by both sibling drivers; changing it here alone would split the convention.
- **IN-03** `CanaryExit` does not set `this.name`. Sibling `UatExit` is identical.

______________________________________________________________________

*Fixed: 2026-09-09T20:36:00Z*
*Fixer: Claude (gsd-code-fixer)*
*Iteration: 1*
