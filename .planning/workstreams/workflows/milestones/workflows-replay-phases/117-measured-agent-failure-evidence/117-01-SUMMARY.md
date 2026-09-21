---
phase: 117-measured-agent-failure-evidence
plan: 01
subsystem: live-uat
tags: [live-uat, host-engine, measurement, negative-control, WEVID-01]
status: complete

requires:
  - a reachable npm registry, once, to create the scratch engine prefix
provides:
  - tests/live-uat/workflow-agent-failure-canary.mjs -- the standing live driver for the host engine's agent() failure observable
  - a measured, dated engine version (3.10.1) that plan 02 may publish as a grade
affects:
  - tests/live-uat/README.md

tech-stack:
  added: []
  patterns:
    - engine-only live-UAT driver -- no marketplace fixture, no install ledger, no subprocess, no `pi` on PATH, nothing imported from extensions/
    - absence-of-credentials as the failure inducer, with a measurement precondition that converts a credentialed machine into a non-zero exit

key-files:
  created:
    - tests/live-uat/workflow-agent-failure-canary.mjs
  modified:
    - tests/live-uat/README.md

decisions:
  - "The published claim is REFUTED at 3.10.1: a recoverable agent() failure resolves to null, and only a non-recoverable one rejects."
  - "The fan-out pattern completes rather than aborting -- three failed items came back as three rows, none survived .filter(Boolean), and the run finished."
  - "A0 was proven to fire by planting, not merely written. It is the load-bearing assertion in the file."
  - "No fallowrc ignoredClones entry was needed: the engine-only shape kept the third canary structurally distinct and the dupes leg did not move."

metrics:
  duration: ~35 min
  completed: 2026-09-09

actuals:
  tokens: 9270
  tasks: 3
  commits: 3
plan_head_before: 09f7da0a25f9f0e88b02f8daadeabde1bf450918
---

# Phase 117 Plan 01: Measured `agent()` failure evidence Summary

A standalone live-UAT driver now measures what the host workflow engine's `agent()` call does when the subagent fails, and it refutes the published claim: at 3.10.1 a recoverable failure resolves to `null` and only a non-recoverable one rejects.

## Did the canary run green against a real engine?

**Yes.** `tests/live-uat/workflow-agent-failure-canary.mjs` was driven against a real scratch install of `@quintinshaw/pi-dynamic-workflows` in a credential-free sandbox and exited 0 with all four assertions observed. Plan 02 may publish a measured grade.

## Engine version

| Source | Version |
|---|---|
| `npm view @quintinshaw/pi-dynamic-workflows version`, read 2026-09-09 immediately before the scratch install | `3.10.1` |
| Read at run time from `/tmp/wf-engine/node_modules/@quintinshaw/pi-dynamic-workflows/package.json` by the canary itself | `3.10.1` |

**They do not differ.** The registry's current release and the version the run actually observed are the same, and the research's `3.10.1` is still accurate. No version literal appears anywhere in the canary — every PASS line prints the version read from the engine's own manifest, so a transcript dates itself.

## What was measured

| # | Observation | Result at 3.10.1 |
|---|---|---|
| A0 | The induced failure actually occurred (asserted before any verdict) | the engine's `AGENT_EXECUTION_ERROR` line was present in the run's logs |
| A1 | A **recoverable** `agent()` failure — the real subagent runner throws on a missing API key | **resolves to `null`** |
| A2 | A **non-recoverable** failure, same run, same sandbox, one option apart (a model spec that resolves to nothing) | **rejects** with `MODEL_NOT_FOUND`, `recoverable: false` |
| A3 | The upstream fan-out pattern: three items through the engine's `pipeline` helper, each calling `agent()` | **3 rows, 0 survivors, run completes** |

A1 and A2 land on opposite sides of the split in the same run, which is what makes the driver non-vacuous. A3 is the one that inverts the doc's practical-consequence paragraph: the pattern degrades and completes; it does not abort.

## Transcripts

### 1. The green run (verbatim)

```text
$ mkdir -p tmp/pi-uat/wf-agent
$ PI_CODING_AGENT_DIR="$(pwd)/tmp/pi-uat/wf-agent" \
    PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules \
    node tests/live-uat/workflow-agent-failure-canary.mjs
[wf-agent-canary] engine 3.10.1
[wf-agent-canary] PASS: A0: the agent call failed as induced, so this run measured something (engine 3.10.1)
[wf-agent-canary] PASS: A1: a recoverable agent() failure resolves to null (engine 3.10.1)
[wf-agent-canary] PASS: A2: a non-recoverable agent() failure rejects MODEL_NOT_FOUND (engine 3.10.1)
[wf-agent-canary] PASS: A3: three fanned-out failures return 3 rows, 0 survive the truthiness filter, and the run completes (engine 3.10.1)
EXIT=0
```

### 2. Negative control 1 — `--invert` (verbatim, RUN)

The inversion flips A1's expectation and nothing else. `INVERT` is referenced at exactly two lines in the file: its declaration and A1's expected value.

```text
$ PI_CODING_AGENT_DIR="$(pwd)/tmp/pi-uat/wf-agent" \
    PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules \
    node tests/live-uat/workflow-agent-failure-canary.mjs --invert
[wf-agent-canary] engine 3.10.1
[wf-agent-canary] PASS: A0: the agent call failed as induced, so this run measured something (engine 3.10.1)

[wf-agent-canary] FAILED:
AssertionError [ERR_ASSERTION]: A1: a recoverable agent() failure did not produce the expected observable at engine 3.10.1.
+ actual - expected

  {
+   isNull: true,
-   isNull: false,
    kind: 'resolved'
  }

    at main (file:///home/acolomba/pi-claude-marketplace-workflows/tests/live-uat/workflow-agent-failure-canary.mjs:228:12)
    at async file:///home/acolomba/pi-claude-marketplace-workflows/tests/live-uat/workflow-agent-failure-canary.mjs:274:3
EXIT=1
```

Note the discrimination: A0 still **passed** on this run — the failure was genuinely induced — and only the verdict disagreed. That is the difference between "the assertion can fail" and "the run fell over".

### 3. Negative control 2 — A0 planted and observed firing (verbatim, RUN)

**The plant.** A0's input is a single binding, deliberately written as one plantable seam:

```js
const observedLogs = recoverable.logs;
```

It was temporarily replaced with the exact shape a **successful** agent call produces — an empty log collection — because proving A0 by borrowing real credentials is barred (the containment refusal forbids running against the operator's real agent directory, and a live provider call spends money):

```js
const observedLogs = []; // PLANTED: the shape a SUCCESSFUL agent call produces
```

`git diff --stat` over the plant: `1 file changed, 1 insertion(+), 1 deletion(-)`.

**The run, verbatim:**

```text
$ PI_CODING_AGENT_DIR="$(pwd)/tmp/pi-uat/wf-agent" \
    PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules \
    node tests/live-uat/workflow-agent-failure-canary.mjs
[wf-agent-canary] engine 3.10.1

[wf-agent-canary] NOTHING WAS MEASURED: the agent call did not fail.
  The sandbox resolved a provider, so the induced failure never occurred and no
  verdict about the engine can be read from this run. This is a statement about
  this machine, not an engine regression.
  Expected a log line naming AGENT_EXECUTION_ERROR; observed logs=[]

Re-run with an EMPTY agent-state directory inside tmp/pi-uat that cannot reach
any provider. The absence of credentials is what induces the failure.
EXIT=1
```

The run exited non-zero on the precondition and **never read a verdict** — it did not report a failed A1, which is exactly the mis-diagnosis A0 exists to prevent.

**Reversion confirmed.** `git checkout -- tests/live-uat/workflow-agent-failure-canary.mjs`, then `git status --porcelain tests/` printed nothing, `grep -n "observedLogs = "` returned the original `recoverable.logs` binding, and the canary was re-run green afterwards (the transcript in section 1 is that post-revert run). The reverted state is the state that shipped.

### 4. The refusal paths (verbatim, RUN)

Both exit non-zero before anything is created and before the engine is imported.

```text
$ PI_CODING_AGENT_DIR="$(pwd)/tmp/pi-uat/wf-agent" node tests/live-uat/workflow-agent-failure-canary.mjs

[wf-agent-canary] LIVE ENGINE REQUIRED: PI_WORKFLOW_ENGINE_ROOT is unset.
  It must name the node_modules of a scratch install of the engine.

See tests/live-uat/README.md for the scratch-install route.
EXIT=1

$ PI_CODING_AGENT_DIR="$HOME/.pi/agent" PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules \
    node tests/live-uat/workflow-agent-failure-canary.mjs

[wf-agent-canary] LIVE ENGINE REQUIRED: PI_CODING_AGENT_DIR (/home/acolomba/.pi/agent) is not the tmp/pi-uat sandbox.
  Refusing to hand the engine an agent-state directory outside the disposable sandbox.

See tests/live-uat/README.md for the scratch-install route.
EXIT=1
```

The second is worth reading twice: it was pointed at the operator's **real** agent directory — the one holding working credentials — and refused before importing the engine.

## What the run measured that the research did not predict

Nothing landed on the other side of the split from the research's branch matrix. Row 10 (real runner throws on a missing key) resolved `null` as predicted; row 9 (model spec resolves to nothing) rejected `MODEL_NOT_FOUND` as predicted; the fan-out returned three rows with zero survivors as predicted. The research's own measurements reproduced exactly.

Three smaller things worth recording:

1. **The duplication gate did not move.** `npm run fallow` exits 0 with the new file present, and the dupes leg reports the same `1,045 lines (1.4%) duplicated across 40 files` the research measured *before* the file existed. The engine-only shape — no `execFileAsync` / `REPO_ROOT` / `EXTENSION_ENTRY` preamble, and a top-level `try { await main() }` epilogue instead of the siblings' `main().then(...)` — kept the third canary out of both pre-approved clone groups. **No `.fallowrc.json` `ignoredClones` entry was added, and none was needed.** The research rated this MEDIUM confidence and unexercised; it is now measured.
2. **The dead-code leg accepts the file on its marker.** `fallow dead-code` reports `✓ No issues found`, `dead files 0.0%`. Line 6 of the new canary is byte-identical to `stop-canary.mjs:6` (verified with `cmp`).
3. **`PI_CODING_AGENT_DIR` alone is sufficient isolation on this machine.** `HOME` was left untouched and `~/.pi/agent/auth.json` carries working credentials, yet every run induced the failure. The sandbox variable does the whole job.

## Deviations from Plan

### 1. [Rule 3 — Blocking] The `pre-commit` trufflehog hook cannot pass in this worktree

- **Found during:** every commit in this plan.
- **Issue:** `.git` is a file here, so the hook's git-mode scan aborts with `failed to read index file: open .../.git/index: not a directory`. It is structural, not transient, and `pre-commit run --files` therefore exits 1 no matter what the files contain.
- **Fix:** the sanctioned route in `CLAUDE.md` — a filesystem scan over exactly the paths being committed, then `SKIP=trufflehog git commit`. Every commit was preceded by a clean scan (`verified_secrets: 0`, `unverified_secrets: 0`). `SKIP=` was extended to nothing else; `--no-verify` was never used.
- **Consequence for the plan's gate:** Task 3's `pre-commit run --files ...` verify cannot return 0 in this environment. Every other hook in that run passed, including `mdformat`, `markdownlint-cli2` and `npm fallow`.

### 2. [Rule 3 — Blocking] `mdformat` rewrote the README mid-hook

- **Found during:** Task 3.
- **Issue:** the first hook pass reported `mdformat ... files were modified by this hook` — it realigned the canary table to the new, wider third row.
- **Fix:** restaged and re-ran until `mdformat` passed. The commit was made **after** the rewrite settled, so no follow-up commit was needed and nothing was amended. `git status` after the commit shows only the operator's pre-existing untracked/modified files.

### 3. Commits were made on `features/workflow`, not an `agent-*` branch

- **Issue:** the executor's worktree commit guard expects an `agent-*` / `worktree-agent-*` branch namespace, and this is a linked worktree on `features/workflow`.
- **Why it was proceeded with:** worktree isolation is OFF for this dispatch and the run is directly against the operator's checkout by design. `features/workflow` is the sanctioned branch for this milestone; the protected-branch rule (never `main`) was honored. Recorded here rather than silently.

## Threat Flags

None. This plan adds no production code, no network endpoint, no auth path and no schema change. The only install was the scratch prefix, which lived at `/tmp/wf-engine`, never entered `package.json` or `package-lock.json`, and was deleted (`rm -rf /tmp/wf-engine`, confirmed absent) once the measurement was recorded.

## Threat-model mitigations applied

| Threat ID | How it was mitigated, and how that was confirmed |
|---|---|
| T-117-01 | Scratch prefix at `/tmp/wf-engine`, outside the repository. `! grep -q 'pi-dynamic-workflows' package.json package-lock.json` and `git status --porcelain -- package.json package-lock.json` both clean, checked after every task. Prefix deleted at the end. `--ignore-scripts` deliberately not used — npm reported the three expected uncovered install scripts (`@google/genai`, `esbuild`, `protobufjs`) and the import worked. |
| T-117-02 | Containment refusal, driven against the operator's real `~/.pi/agent` and observed refusing (transcript section 4). The run creates and removes its own child directory beneath the sandbox root; `ls -A tmp/pi-uat/wf-agent` is empty afterwards. |
| T-117-03 | A0 asserted before any verdict AND proven to fire by planting (transcript section 3). |
| T-117-04 | Every transcript pasted here was read first. The green run carries only PASS lines; the engine's missing-key message (which contains a notice and two documentation paths, no key material) does not appear in any committed transcript at all, because A0 passes silently on the induced failure. Trufflehog filesystem scans over the committed files returned `verified_secrets: 0, unverified_secrets: 0`. |
| T-117-05 | No provider was reached in any run: every run induced the missing-key failure, which is what A0 confirms. Cost of this plan's measurement: nothing. |
| T-117-06 | Accepted as planned. The workflow scripts are literals in the driver. |
| T-117-SC | Only the scratch install; no manifest entry; prefix deleted. |

## Verification

| Check | Result |
|---|---|
| `node --check tests/live-uat/workflow-agent-failure-canary.mjs` | exit 0 |
| Line 6 marker byte-identical to `stop-canary.mjs:6` (`cmp`) | identical |
| Green run against the real engine in a credential-free sandbox | exit 0, four assertions, version printed |
| `--invert` run | exit 1 naming A1 |
| A0 planted | exit 1 with `NOTHING WAS MEASURED`; plant reverted, tree clean |
| `npm run fallow` (all three legs) | exit 0 — dead-code `✓ No issues found`, dupes unchanged at 1,045 lines / 40 files |
| `node --test tests/architecture/no-stale-test-citations.test.ts` | exit 0 |
| README names the canary outside a blockquote | 4 times (table row, section heading, two run commands) |
| `pre-commit run --files ...` | every hook passed except trufflehog, which fails structurally in this worktree (see Deviations 1) |
| Manifests | neither names the engine; neither is dirty |
| No version literal in the canary | confirmed by grep |
| No `deepStrictEqual` on anything the runner returns | confirmed by grep; A1/A2/A3 all compare through `structuredClone` |
| No phase / plan / wave references in the canary | confirmed by grep |

## What plan 02 needs from this

- The engine version to name in the grade: **3.10.1**, observed at run time on 2026-09-09.
- The canary path to cite (the citation gate requires it to resolve, and it now does): `tests/live-uat/workflow-agent-failure-canary.mjs`.
- The measured content of the row: a recoverable failure **resolves to `null`**, a non-recoverable one **throws**. The claim that "every failure branch throws" is refuted.
- The practical-consequence paragraph inverts: `pipeline(...)` + `.filter(Boolean)` **drops the failed items and completes**, measured at three rows and zero survivors. It aborts only on the non-recoverable class.

## Self-Check: PASSED

- `tests/live-uat/workflow-agent-failure-canary.mjs` — FOUND
- `tests/live-uat/README.md` — FOUND
- `7b8f67db` — FOUND
- `db487f56` — FOUND
- `8eb52565` — FOUND
- `/tmp/wf-engine` — ABSENT (deleted as required)
