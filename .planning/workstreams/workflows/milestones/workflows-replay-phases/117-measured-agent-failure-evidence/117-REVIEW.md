---
phase: 117-measured-agent-failure-evidence
reviewed: 2026-09-09T20:01:12Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - tests/live-uat/workflow-agent-failure-canary.mjs
  - tests/live-uat/README.md
  - docs/workflows-compatibility.md
findings:
  critical: 2
  warning: 12
  info: 4
  total: 18
status: issues_found
---

# Phase 117: Code Review Report

**Reviewed:** 2026-09-09T20:01:12Z
**Depth:** deep
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files, reviewed against the phase's own research artifact (`117-RESEARCH.md`), the two
sibling live-UAT drivers, and the project's comment/grade discipline. Cross-file tracing covered
the canary's assertion chain, the README's description of that chain, and the doc's claims about
what the canary establishes.

The four focus items hold up, with qualifications:

- **A0 ordering and exit path are correct.** `A0` reads `recoverable.logs` before any
  `assert.deepEqual`, `nothingWasMeasured` throws `CanaryExit` from inside the `try`, the `finally`
  runs, and the epilogue exits 1. Every malformed shape of the run result (`undefined` result,
  `undefined` logs, non-array logs, string logs) fails toward exit 1, never toward a silent pass.
  The "successful call produces `[]` logs" premise behind the plant is backed by a measurement
  (`117-RESEARCH.md:298`), not asserted. Two gaps remain: the gate covers one of three verdicts
  (WR-07), and its diagnosis of *why* the marker is missing is not something it observed (WR-10).
- **Containment ordering holds.** `resolveEngineVersion` reads only a manifest; nothing is created
  and nothing imported before `assertSandboxContainment`. But the guard itself is a substring test,
  not a containment test, and a `..` segment walks straight through it (WR-06).
- **Cleanup holds** on assertion failure, on `CanaryExit`, and on containment refusal (the `mkdir`
  is after the guard, the `try` starts after the `mkdir`). The `finally` can, however, replace the
  original error with its own (WR-09).
- **`--invert` inverts the assertion only.** `isNull: !INVERT` sits in the expected value; setup,
  A2 and A3 are untouched. The README's "flips A1's expectation and nothing else" is accurate.
- **The doc states the refutation plainly** ("That was a source read, and driving the engine
  overturned it"), names the version in the grade, and carries the counting rule beside the census.

The serious problems are in the doc, not the canary, and they are the same class of defect this
phase existed to remove: unhedged claims that the evidence does not support. The published set of
non-recoverable error codes is **incomplete** relative to the phase's own measurement, and it omits
the two codes a real plugin author is most likely to hit (CR-01). The rule the doc invites the
reader to apply — read `recoverable` off the error to know which observable you got — is falsified
by a case the same research recorded (CR-02).

## Critical Issues

### CR-01: The published non-recoverable code list is incomplete and reads as closed

**File:** `docs/workflows-compatibility.md:142`
**Issue:** The sentence enumerates the non-recoverable class as four codes and frames the list as
the set:

> Only the non-recoverable class rejects, and its codes are named ones -- `MODEL_NOT_FOUND`,
> `AGENT_LIMIT_EXCEEDED`, `TOKEN_BUDGET_EXHAUSTED`, `SCRIPT_VALIDATION_ERROR` -- each carrying
> `recoverable: false` [...]

This phase's own research names **six** (`117-RESEARCH.md:106`, and the branch matrix at
`:203-204`): the four above plus `PROVIDER_USAGE_LIMIT` (rows 13) and `SCHEMA_NONCOMPLIANCE`
(row 14). Both were dropped in transcription from research to doc.

The omission is not cosmetic, and it is not random. The four that survived are exactly the
credential-free branches (`Needs credentials? no`) — the ones the canary and the local probes could
reach. The two that were dropped are exactly the two that require a live provider — a rate/quota
limit and a schema agent that never produces conforming output. Those are the non-recoverable
failures a plugin author actually meets in production.

The consequence lands on the very next paragraph. Line 148 tells the author: "What such a script
does need to defend against is the non-recoverable class." An author who defends against the four
named codes and fans out with `.filter(Boolean)` will have their entire run aborted, with every
sibling call in flight cancelled (line 146), the first time they hit a usage limit — a failure the
doc's list told them was not in that class.

This is also the failure mode already recorded against this codebase: a closed set that gains
members silently, with no derivation site to catch the omission.

**Fix:** Publish all six, or stop presenting the list as closed. Preferred — do both, and grade it:

```markdown
Only the non-recoverable class rejects. At 3.10.1 its codes are `MODEL_NOT_FOUND`,
`AGENT_LIMIT_EXCEEDED`, `TOKEN_BUDGET_EXHAUSTED`, `SCRIPT_VALIDATION_ERROR`,
`PROVIDER_USAGE_LIMIT` and `SCHEMA_NONCOMPLIANCE` (source-read at 3.10.1,
`src/errors.ts:166-205`). The last two need a live provider to reach, so only the first four
have been driven; a rate or quota limit rejects and ends the run exactly as a bad model spec
does. Treat the list as the set read at 3.10.1, not as a contract the engine publishes.
```

### CR-02: "the class decides the outcome" is falsified by a case the same phase measured

**File:** `docs/workflows-compatibility.md:134,142`
**Issue:** Two sentences invite the reader to predict the observable from the error's `recoverable`
flag:

- `:134` — "The chosen engine sorts a failed `agent()` call into a recoverable class and a
  non-recoverable one, **and the class decides the outcome**."
- `:142` — "[...] each carrying `recoverable: false`, **so a reader can tell which class they hit
  from the error itself**."

`117-RESEARCH.md:196` (branch matrix row 3) records a counter-example at the same version:
`WORKFLOW_ABORTED` carries `recoverable: **true**` and still **rejects** — "rethrown by the
`isAborted()` guard, never nulled". So the flag is not a sound predictor of the observable in the
direction the doc invites, and the inference the doc explicitly endorses ("a reader can tell...")
produces the wrong answer for it.

The direction that matters is the unsafe one: an author who catches a `recoverable: true` error and
concludes "this class resolves to `null`, my `.filter(Boolean)` covers it" is wrong for aborts,
which is precisely the case where they most need the run to unwind predictably.

**Fix:** State the mapping as the engine implements it, not as a two-class law:

```markdown
Recoverability is the engine's own classification and it drives the ordinary path, but it is not
a total rule: `WORKFLOW_ABORTED` is classified `recoverable: true` and is still rethrown by the
abort guard rather than nulled (source-read at 3.10.1, `src/workflow.ts:608-612`). Read
`recoverable: false` as "this will reject"; do not read `recoverable: true` as "this will resolve
to `null`".
```

## Warnings

### WR-01: A `parallel()` claim carries a runtime-measured grade the named canary cannot reproduce

**File:** `docs/workflows-compatibility.md:148`
**Issue:** "**Both** fan-out helpers carry the same recoverable-to-`null` arm as a bare `agent()`
call: three deliberately failed items came back as three rows, none survived the filter, and the
run completed (runtime-measured at 3.10.1)."

The evidence sentence describes A3, which drives `pipeline()` only (`FAN_OUT_SCRIPT`,
`workflow-agent-failure-canary.mjs:182-185`). `parallel()` appears nowhere in the harness. The
grade legend this phase rewrote (`:12`) says the runtime-measured grade is carried by "the live
canary named beside the claim it establishes" — and the canary named in the table establishes half
of this sentence.

`parallel()` *was* driven, but only by an ad-hoc research probe (`117-RESEARCH.md:653`) that was not
committed. So the published grade points a reader at an artifact that cannot re-derive half the
claim, in a document whose stated rule (`:17`) is that a claim's grade names what was actually done.

**Fix:** Either add a second `parallel()` case to A3 (two lines: same script, `parallel` instead of
`pipeline`, assert the same shape), or split the sentence — measure the `pipeline` half, source-read
the `parallel` half with its citation (`src/workflow.ts:1043-1044`).

### WR-02: Two claims in the rewritten section carry no evidence grade

**File:** `docs/workflows-compatibility.md:142`
**Issue:** The section's opening paragraph grades its first sentence ("source-read at 3.10.1,
`src/workflow.ts:990-995,791-792`") and then drops the discipline for the next two:

- "The engine's error classification ends in a catch-all arm [...] (`src/errors.ts:200-204`)" — a
  bare file citation with no grade word.
- The code enumeration (see CR-01) — no citation and no grade at all.

`:9` states "Every claim about either engine carries its evidence grade where it is made" and `:17`
states "Where a claim is a source read, the sentence says so." These two sentences are the
document's own invariant, and the paragraph this phase wrote breaks it.

**Fix:** Append `(source-read at 3.10.1, ...)` to both, as CR-01's fix does for the enumeration.

### WR-03: The `@nicknisi` row's grade matches none of the five defined grade names

**File:** `docs/workflows-compatibility.md:139`
**Issue:** The row grades "throws" as bare "**runtime-measured**". Every grade defined at `:11-15`
names a version or a source ("runtime-measured at 3.10.1", "measured at 3.5.1", ...). A reader
cannot tell which engine version was driven, and the only version in scope on that line (3.10.1) is
the *other* engine's. The row is pre-existing, but this phase rewrote both the table and the grade
legend, so the mismatch is now between two things changed in the same commit.

**Fix:** Grade it "measured at 3.5.1" if that is where the observation came from (which is what the
sandbox table at `:126-127` uses for this engine), or name whichever version was driven.

### WR-04: "The two engines therefore agree" is false under the document's own vocabulary

**File:** `docs/workflows-compatibility.md:146`
**Issue:** `:120` establishes the doc's meaning of "engine": "The columns here name two Pi
extensions rather than the two hosts [...] which engine to trust with third-party code." Under that
definition, "The two engines therefore agree on the ordinary failure" asserts that
`@quintinshaw/pi-dynamic-workflows` and `@nicknisi/pi-workflows` agree — and the table three lines
above says `@nicknisi` **throws**.

The intended pair is Claude Code + the chosen engine, which `:134` calls "the two hosts". The same
pair is named two different ways four sentences apart, and one of those names collides with an
established term.

**Fix:** "Claude Code and the chosen engine therefore agree on the ordinary failure." Keep "engine"
for the two Pi extensions throughout the section.

### WR-05: The claimed divergence from Claude Code is asserted with no evidence

**File:** `docs/workflows-compatibility.md:134,146`
**Issue:** `:134` says the two hosts "part company on the second" class, and `:146` says "What
remains is the narrower divergence: on the non-recoverable class this engine rejects."

Nothing in this document establishes what Claude Code does on a non-recoverable failure. The only
upstream evidence quoted is the binary read for the *recoverable* condition — "dies on a terminal
API error after retries". A divergence needs both sides; only one side has a grade. Given a
nonexistent model spec, Claude Code's behaviour is simply unknown here.

This matters more than usual because `:17` promises "the measurement that would upgrade it is named
as work that has not been done rather than implied to have been done" — and this claim implies a
comparison that was not made.

**Fix:** State the one-sided fact and mark the other side unknown:

```markdown
What remains is a divergence this document cannot yet size: on the non-recoverable class this
engine rejects and an uncaught rejection ends the run (source-read at 3.10.1,
`src/workflow.ts:1430-1471`). Claude Code's behaviour on a non-recoverable failure -- e.g. a model
spec that resolves to nothing -- has not been read or measured, so the two sides are not compared
here.
```

### WR-06: The sandbox guard is a substring test and a `..` segment walks through it

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs:149-154`
**Issue:**

```js
if (!agentDir.includes(path.join("tmp", "pi-uat"))) {
```

This is a substring smell test on an un-normalized string, not containment. `PI_CODING_AGENT_DIR`
values that pass it and are *not* the sandbox:

- `$(pwd)/tmp/pi-uat/../../../somewhere` — the `..` segments are never resolved, `existsSync`
  succeeds, containment passes, and `mkdir` then creates the state directory outside the repo. The
  engine is handed that directory, and `rm -rf` runs against it at the end.
- `~/mytmp/pi-uat-backup/agent` — contains the literal `tmp/pi-uat`.

The function's own doc comment states the guarantee it does not deliver: "Refusing to hand the
engine an agent-state directory outside the disposable sandbox." The README repeats it (`:69`,
`:95`, see WR-11). The blast radius is bounded — the canary only creates and removes a child
directory it names itself — but the stated guarantee is that the *engine* never gets an agent-state
directory outside the sandbox, and that is what fails.

This is the sibling pattern (`stop-canary.mjs:193`, `manifest-absence-canary.mjs:142`), so the fix
belongs on all three; it is reported here because this file is the one under review and because
this driver is the one that hands the directory to third-party code.

**Fix:**

```js
const SANDBOX_ROOT = path.resolve(process.cwd(), "tmp", "pi-uat");
const resolved = path.resolve(agentDir);
if (resolved !== SANDBOX_ROOT && !resolved.startsWith(SANDBOX_ROOT + path.sep)) {
  liveEngineRequired(
    `PI_CODING_AGENT_DIR (${agentDir} -> ${resolved}) is not inside ${SANDBOX_ROOT}.`,
    "Refusing to hand the engine an agent-state directory outside the disposable sandbox.",
  );
}
```

Return `resolved`, not `agentDir`, so `stateDir` is built from the normalized value.

### WR-07: A3's verdict is read without its own measurement precondition

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs:258-263`
**Issue:** The file's stated doctrine (`:35-36`) is that the induced failure must be proven "BEFORE
any verdict is read". A0 does that for A1's drive. A3 is a **separate** `drive()` call whose
verdict — `{ rows: 3, survivors: 0 }` — depends on the same absence, and its logs are never checked.

A2 needs no such gate (a bogus model spec fails regardless of credentials), but A3 does: three
agent calls that *succeed* produce `{ rows: 3, survivors: 3 }`, and the harness reports

> A3: the fan-out pattern did not drop its failed items and complete at engine 3.10.1.

which blames the engine for a property of the machine. That is the exact mis-attribution
`nothingWasMeasured` exists to prevent, and its own comment (`:87`) says so: "deliberately not
reported as an engine regression".

The window is narrow (A0 already established the sandbox had no reachable provider a moment
earlier), but the fix is three lines and the doctrine is the phase's headline control.

**Fix:** Extract the marker check and apply it to every drive whose verdict depends on the induced
absence:

```js
const requireInducedFailure = (run) => {
  const logs = run.logs;
  if (!logs.some((line) => line.includes(INDUCED_FAILURE_MARKER))) {
    nothingWasMeasured(logs);
  }
  return run;
};

const recoverable = requireInducedFailure(await drive(agentCallScript(`agent("ping")`)));
// ...
const fanOut = requireInducedFailure(await drive(FAN_OUT_SCRIPT));
```

### WR-08: The validated engine root is discarded and the entry path is hard-coded

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs:110-132,187,202-207`
**Issue:** Three problems in one path:

1. `resolveEngineVersion` returns `{ root, version }` after validating `root`, but `main` destructures
   `const { version } = ...` — `root` is dead — and then re-reads the raw
   `process.env.PI_WORKFLOW_ENGINE_ROOT` to build the import path. Two reads of a mutable global
   where a validated value is already in hand, separated by a `process.env` mutation.
2. The entry is hard-coded as `dist/index.js`, bypassing the package's `exports`/`main`. The manifest
   is already open two functions earlier and carries the answer.
3. A missing or renamed entry is an **unmet precondition**, but it is not routed as one. The dynamic
   `import` throws `ERR_MODULE_NOT_FOUND`, which is not a `CanaryExit`, so the operator gets

   ```
   [wf-agent-canary] FAILED:
   Error [ERR_MODULE_NOT_FOUND]: Cannot find module ...
   ```

   instead of the `LIVE ENGINE REQUIRED` message with the scratch-install route. The file's own exit
   contract (`:39-41`) promises "an unmet precondition [...] exits NON-ZERO with a human-readable
   reason". It exits non-zero; the reason is a stack trace.

**Fix:** Return the resolved entry from `resolveEngineVersion` and route its failure:

```js
const entry = path.join(root, ENGINE_PACKAGE, manifest.main ?? "dist/index.js");
if (!existsSync(entry)) {
  liveEngineRequired(
    `the engine entry point is missing at ${entry}.`,
    "The scratch install may be incomplete, or the engine changed its published layout.",
  );
}
return { entry, version: manifest.version };
```

and use `entry` in `main`.

### WR-09: The cleanup `finally` can replace the failure it was meant to survive

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs:268-270`
**Issue:**

```js
} finally {
  await rm(stateDir, { recursive: true, force: true });
}
```

`force: true` suppresses `ENOENT` and nothing else. If the engine leaves a file handle or a subagent
process holding the directory, `rm` rejects with `EBUSY`/`EPERM`, that rejection propagates out of
`main`, and it **replaces** the in-flight `AssertionError` or `CanaryExit`. The operator then sees a
filesystem error instead of "A1: a recoverable agent() failure did not produce the expected
observable", and a `CanaryExit` that had already printed its reason gets a second, unrelated stack
appended (because the replacement error is not a `CanaryExit`, the epilogue's suppression no longer
applies).

**Fix:**

```js
} finally {
  await rm(stateDir, { recursive: true, force: true }).catch((err) => {
    console.error(`[wf-agent-canary] cleanup failed for ${stateDir}: ${String(err?.message ?? err)}`);
  });
}
```

### WR-10: `NOTHING WAS MEASURED` diagnoses a cause it did not observe

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs:58,89-102`; `tests/live-uat/README.md:96`
**Issue:** A0 keys on a raw substring of a private engine log line
(`INDUCED_FAILURE_MARKER = "AGENT_EXECUTION_ERROR"`). When it does not match, the harness states a
cause as fact:

> NOTHING WAS MEASURED: the agent call did not fail.
> The sandbox resolved a provider, so the induced failure never occurred [...]
> This is a statement about this machine, not an engine regression.

The absence of the marker supports "no line named `AGENT_EXECUTION_ERROR`". It does not support
"the sandbox resolved a provider". If a future engine renames its error code or its log vocabulary
— exactly what `WPIN-01` and the doc's own pinning caveat (`docs:19`) exist to worry about — an
operator on a credential-free machine is told, in an unhedged sentence, that their sandbox has
credentials, and is sent to check the wrong thing. The README (`:96`) repeats the diagnosis
verbatim.

The harness already holds the data to discriminate. `117-RESEARCH.md:298` measured that a successful
call produces `logs === []`. So an **empty** log array supports the "provider resolved" reading, and
a **non-empty** array without the marker supports "the engine ran, logged, and used different
words".

**Fix:** Branch on it, and hedge only where the evidence is thin:

```js
function nothingWasMeasured(logs) {
  const ranAndLogged = Array.isArray(logs) && logs.length > 0;
  console.error(`\n[wf-agent-canary] NOTHING WAS MEASURED: no log line named ${INDUCED_FAILURE_MARKER}.`);
  console.error(
    ranAndLogged
      ? `  The run produced ${logs.length} log line(s) but none named the marker. Either the failure\n` +
        `  did not occur, or this engine version no longer uses that name. Check the engine's\n` +
        `  error vocabulary before concluding anything about this machine.`
      : `  The run produced no logs at all, which is the shape a SUCCESSFUL agent call produces.\n` +
        `  The sandbox most likely resolved a provider, so no verdict about the engine can be read.`,
  );
  console.error(`  observed logs=${JSON.stringify(logs)}`);
  throw new CanaryExit("the induced agent failure did not occur");
}
```

### WR-11: The README states a containment guarantee the code does not deliver

**File:** `tests/live-uat/README.md:69,95`
**Issue:** "The harness **refuses any directory outside `tmp/pi-uat`** before it creates anything and
before it imports the engine" and "**A non-sandbox agent directory.** Refused before anything is
created and before the engine is imported."

The ordering half is accurate. The refusal half is not: see WR-06. A reader with a relative or
`..`-bearing path will believe the harness protects them.

**Fix:** Land WR-06's normalization, at which point the README sentence becomes true as written. If
WR-06 is deferred, weaken the README to what the code checks ("refuses a path that does not name
`tmp/pi-uat`").

### WR-12: The reproduction route installs an unpinned engine while the doc pins every citation

**File:** `tests/live-uat/README.md:76`; canary header `:21`
**Issue:** `npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows` resolves to
whatever is current. `docs/workflows-compatibility.md:19` sets the opposite rule for this engine —
"Read that exact version to follow a citation -- `npm pack @quintinshaw/pi-dynamic-workflows@3.10.1`
-- rather than whichever version is current" — and `docs:140` publishes a grade that names 3.10.1
and names this harness as its driver.

The canary does mitigate the worst outcome: it reads the version from the engine's own manifest and
prints it in every PASS line, so a transcript from a newer engine cannot silently masquerade as a
3.10.1 run. But an operator asked to *reproduce the published grade* is handed a command that will
not reproduce it once 3.10.2 ships, and nothing in the README says which version to pin.

**Fix:** Pin the documented route and say why:

```bash
npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows@3.10.1
```

with a note that dropping the pin re-measures against a different version, which the PASS lines will
then name.

## Info

### IN-01: `err && err.code` conflates a falsy error with an absent code

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs:171`
**Issue:** `{ kind: "rejected", code: err && err.code, recoverable: err && err.recoverable }` yields
the *error value itself* (not `undefined`) when `err` is falsy, and cannot distinguish
`recoverable: false` from "no error object". The engine always rejects with a `WorkflowError` today,
so this is latent.
**Fix:** `code: err?.code, recoverable: err?.recoverable`. Both are available in the engine's realm.

### IN-02: `process.exit(0)` after `console.log` can truncate piped output

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs:275,283`
**Issue:** Node's stdout is asynchronous when it is a pipe. `process.exit` does not flush pending
writes, so `node ... | tee transcript.txt` can lose trailing PASS lines — the exact artifact the
README's "Observed result" block is made of. Both sibling drivers share this shape, so it is a
directory-wide convention rather than a regression.
**Fix:** Set `process.exitCode = 0 | 1` and let the process end naturally, or await a
`process.stdout.write` drain before exiting.

### IN-03: `CanaryExit` does not set `this.name`

**File:** `tests/live-uat/workflow-agent-failure-canary.mjs:64`
**Issue:** `class CanaryExit extends Error {}` — the project's error convention
(`.planning/codebase/CONVENTIONS.md`, "Error Handling") sets `this.name = "<ClassName>"` in every
error constructor. Discrimination here is `instanceof`, which is correct, so nothing misbehaves; the
name only shows up in an unexpected stack. Sibling `UatExit` is identical.
**Fix:** `class CanaryExit extends Error { constructor(m) { super(m); this.name = "CanaryExit"; } }`

### IN-04: The documented run leaves the sandbox root behind

**File:** `tests/live-uat/README.md:75-81`; canary header `:20-26`
**Issue:** Both run blocks `mkdir -p tmp/pi-uat/wf-agent` and `rm -rf /tmp/wf-engine`, but never
remove `tmp/pi-uat/wf-agent`. The canary removes only the per-PID child it created, by design, so
the operator is left with an empty directory inside the repo tree.
**Fix:** Add `rm -rf tmp/pi-uat/wf-agent` to the documented teardown, or note that the sandbox root
is shared with the sibling canaries and is meant to persist.

## Notes

No `<structural_findings>` block was supplied for this phase, so there is no fallow substrate
section. `mdformat --check` passes on both markdown files. No process-artifact references
(`Phase NN`, `Plan NN`, `Wave N`, `Pitfall N`) appear in any of the three files; every traceability
anchor is a durable ID (`WEVID-01`, `D-117-01/04/05`, `D-98-10`, `NFR-5`, `WPIN-01`). No debug
artifacts, no secrets, no injection surfaces — the only interpolation into generated script source
(`agentCallScript`) takes two module-local literals.

---

_Reviewed: 2026-09-09T20:01:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
