# Phase 117: Measured `agent()` failure evidence - Research

**Researched:** 2026-09-09
**Domain:** Live-UAT canary design against an out-of-tree host engine; evidence-grade correction in published docs and an archived verification record
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### D-117-01: What the canary is

- **The canary does not exist on this branch and must be created.**
  `105-VERIFICATION.md:91` calls `tests/live-uat/workflow-storage-canary.mjs`
  "PRESENT, code-reviewed", but that described the spike branch; the replay
  (109-114) never re-landed it. `ls tests/live-uat/` holds only
  `manifest-absence-canary.mjs`, `stop-canary.mjs` and `README.md`. Criterion 1
  reads as though the file is being extended. It is not.
- **It carries ONLY the `agent()` assertions WEVID-01 names.** The W1/W2/W3
  storage assertions the archived record describes belong to that archived
  milestone's requirement, and re-landing them is scope none of WEVID-01,
  WEVID-02 or WDOCS-02 asks for. If a later phase wants the storage canary back,
  it can say so.
- **The failure is driven, and the OBSERVABLE is asserted.** The assertion is
  rejection versus resolution to `null` -- what a script author actually
  experiences -- never which internal branch ran. A test that asserts the branch
  re-states the source read this phase exists to replace.
- **Prefer a shape that needs no provider credentials.** A failure occurring
  before any provider call still exercises the divergence. If credentials prove
  unavoidable, say so in the SUMMARY rather than quietly requiring them.
- **The exit contract matches the two existing canaries exactly.** An unmet
  precondition or an unobserved assertion exits NON-ZERO with a human-readable
  reason, so a verifier records `human_needed` rather than a silent pass. Never
  skip-and-pass when the engine is absent.

#### D-117-02: Grade, version and counts

- **The engine version is 3.10.1, not the 3.5.1 criterion 3 names.** 3.10.1 is
  npm's current (`npm view @quintinshaw/pi-dynamic-workflows version`) and is the
  grade the compatibility doc already carries for its other rows. The criterion's
  pin is stale; correct it and record the correction rather than honoring a stale
  number.
- **The grade becomes `runtime-measured at 3.10.1` only if the canary actually
  runs.** Name the version inside the grade, never a bare "measured" -- the row
  directly above it already reads `runtime-measured` for the rejected engine, and
  two rows at different versions must not read identically.
- **If the canary genuinely cannot run, the row stays `source-read only` and the
  phase says so plainly.** Upgrading a grade on an unrun canary is the exact
  defect WDOCS-02 exists to correct; committing it in the same phase that
  corrects it would be indefensible.
- **The "six of the seven real Anthropic workflow scripts, twelve times in
  total" census is measured or dropped.** It appears ONLY in `REQUIREMENTS.md:64`
  -- never in the doc -- and has never been measured on this tree. Phase 116
  measured that ZERO plugins in either cached marketplace carry a `workflows/`
  directory, so those scripts may not be locally reachable at all. If they are
  not, state the `pipeline(...)` + `.filter(Boolean)` consequence without the
  unverifiable census. This is the milestone's "assume the enumeration is short
  until measured" rule applied to a figure nothing has ever checked.

#### D-117-03: The 105 self-contradiction

- **The UNRUN record wins.** `105-VERIFICATION.md` carries `status: passed` and a
  status line reading "live canary closed 2026-08-16", while `:55` and `:91` say
  the W1/W2/W3 canary is UNRUN. Its own `why_human` field settles which is right:
  what closed on that date was **Phase 104's structurally identical canary**, not
  this one. The status line is the over-claim.
- **The archived artifact is corrected surgically, not rewritten.** Fix the false
  claim and add a dated note saying what was actually closed and when. Do not
  restate the history to look as though it was always right -- the point of the
  correction is that a record over-claimed, and erasing the evidence of that
  removes the lesson.
- **Scope is found by grep, not by memory.** All three sites in that file
  (frontmatter/status line, `:55`, `:91`) plus anything else citing it as
  evidence for a closed canary.

### Claude's Discretion

The canary's internal structure, the failure-induction technique, file naming,
and task/wave decomposition are at the planner's discretion within the
constraints above.

### Deferred Ideas (OUT OF SCOPE)

- Re-landing the W1/W2/W3 storage assertions from the archived canary. Out of
  scope here (D-117-01); a later phase can take it if the storage path wants
  live coverage again.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WEVID-01 | The live-UAT canary drives the host engine's `agent()` failure path and asserts the observed behavior, with a negative control proving the assertion can fail. | Q1/Q2/Q3 below. A credential-free failure path exists, was driven at 3.10.1, and the observable was recorded. A working three-assertion canary skeleton with a demonstrated red run is given under **Code Examples**. |
| WEVID-02 | `docs/workflows-compatibility.md` restates the `agent()` divergence at its measured grade, and names the concrete consequence for the upstream `pipeline(...)` + `.filter(Boolean)` pattern. | Q1/Q2/Q5. The doc's current claim is **REFUTED** by measurement. The census is measurable and was measured; its stated form is arithmetically unsupportable and needs restating. |
| WDOCS-02 | `105-VERIFICATION.md` no longer contradicts itself. | Q6. Full site list with line numbers, plus a fourth contradiction the CONTEXT did not name (the `evidence:` block contradicts its own `why_human`) and a dangling `WINDOWS.md (id 5)` citation. |
</phase_requirements>

## Summary

**The doc's central claim is wrong, and the phase's headline finding is a refutation rather than a confirmation.** `docs/workflows-compatibility.md:140` states that at `@quintinshaw/pi-dynamic-workflows` 3.10.1 "every failure branch in its agent implementation throws". It does not. The engine classifies every agent failure as recoverable or non-recoverable, and on a **recoverable** failure -- which is `wrapError`'s catch-all default arm, so it is the ordinary case -- `agent()` **resolves to `null`** after retries are exhausted. Only a **non-recoverable** failure rejects. That was read at `src/workflow.ts:990-995` and then driven at run time; the transcript is below.

**A credential-free failure path exists and is the natural shape for the canary.** Point `PI_CODING_AGENT_DIR` at an empty disposable directory and the real `WorkflowAgent` fails with `No API key found for the selected model.`, which `wrapError` classifies `AGENT_EXECUTION_ERROR / recoverable: true`, which resolves `agent()` to `null`. No fake runner, no injected seam, no provider account. The absence of credentials *is* the failure inducer, so the canary works precisely in the environment a verifier runs in. A second case in the same driver (`model: "nosuchprovider/nosuchmodel"` -> `MODEL_NOT_FOUND / recoverable: false`) rejects, giving a differential negative control on the same engine, in the same sandbox, one option apart.

**The practical consequence stated in the doc inverts.** `docs/workflows-compatibility.md:144` says a Claude-Code script leaning on `pipeline(...)` + `.filter(Boolean)` "may abort under Pi instead of dropping the failed item". Driven end to end, `pipeline(["a","b","c"], i => agent(...))` under a credential-free sandbox returned `[null, null, null]`, so `.filter(Boolean)` dropped all three and the run completed. `pipeline()` and `parallel()` each carry their **own** recoverable-to-`null` arm (`src/workflow.ts:1079-1080`, `:1043-1044`), so the pattern degrades exactly as upstream for the recoverable class. The genuine divergence is narrower and must be restated as such: the engine aborts the whole run only on the non-recoverable class (`MODEL_NOT_FOUND`, `PROVIDER_USAGE_LIMIT`, `TOKEN_BUDGET_EXHAUSTED`, `AGENT_LIMIT_EXCEEDED`, `SCHEMA_NONCOMPLIANCE`, `SCRIPT_VALIDATION_ERROR`).

**Primary recommendation:** Create `tests/live-uat/workflow-agent-failure-canary.mjs` as an engine-only driver (it needs no marketplace sandbox, no `pi` binary, and no extension import), resolve the engine through `PI_WORKFLOW_ENGINE_ROOT`, assert the three observables measured below, and rewrite `docs/workflows-compatibility.md:132-144` to state the measured split at `runtime-measured at 3.10.1`. The doc edit moves exactly one gate (`no-stale-test-citations`), and only in the direction of requiring the canary file to exist -- proved by planting.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Driving the host engine's `agent()` failure at run time | Live-UAT (`tests/live-uat/`) | -- | The engine is deliberately in no dependency manifest (NFR-5 / D-98-10). Only a standalone driver outside `npm run check` can import it. |
| Classifying a failure as recoverable / non-recoverable | Host engine (`@quintinshaw/pi-dynamic-workflows`) | -- | `wrapError` (`src/errors.ts:166-205`) owns this. Nothing in this repo replicates it and nothing should. |
| Publishing the measured divergence | `docs/workflows-compatibility.md` | `tests/live-uat/README.md` | The compat doc is the operator-facing contract; the live-UAT README carries the per-canary table and the honesty contract. |
| Correcting a false archived verification claim | `.planning/.../105-VERIFICATION.md` | -- | Archived planning record. No test, gate or hook reads `.planning/` for content. |
| Publishing the workflow-script census | `docs/workflows-compatibility.md` | `REQUIREMENTS.md:64` (the origin of the claim) | The figure was written in a requirement and never in the doc. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` / `node:assert/strict` | Node >= 20.19.0 | Not used by the canary -- named to say so | The canary is a standalone `.mjs` driver, deliberately outside `npm test` and its glob. It uses bare `node:assert/strict` + `process.exit`, matching the two existing canaries. |
| `@quintinshaw/pi-dynamic-workflows` | 3.10.1 | The host engine under measurement | Scratch-install ONLY. Must not enter `package.json` / `package-lock.json` (NFR-5, D-98-10, and the milestone's own Out-of-Scope row). |
| `@earendil-works/pi-coding-agent` | resolved as the engine's peer | Real subagent spawn machinery | `npm install --prefix` auto-installs the engine's peers into the scratch prefix; the canary imports the engine and Node resolves the peer from the scratch tree, not from this repo's `node_modules`. Measured. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:vm` (inside the engine) | -- | The engine executes workflow bodies in a `vm` realm | Consequence, not a choice: see **Pitfall 1** (cross-realm objects break `deepStrictEqual`). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Credential-free real `WorkflowAgent` failure | Injecting `WorkflowRunOptions.agent` (a fake runner that throws) | The engine documents this seam -- `agent?: WorkflowAgentRunner` at `src/workflow.ts:172`, described at `:165` as the "Minimal injected agent surface used by the workflow runtime and deterministic tests". It works (measured) and is fully hermetic, but it replaces the real agent runner, so the canary would no longer prove that a *real* `WorkflowAgent` failure lands in the recoverable class. The credential-free route proves both halves and needs no fake. **Do not use the fake as the primary assertion.** |
| A failure with a live provider | `agentTimeoutMs: 1` against a credentialed sandbox | Requires an account, is non-deterministic, spends money, and is not reproducible on a verifier's machine. |
| A pre-provider synchronous rejection (`agent("x", { thread: "" })`) | -- | Reachable and credential-free, but it only proves the *reject* half. It cannot establish the `null` half, which is the half the doc gets wrong. Keep it (or `MODEL_NOT_FOUND`) as the differential control, never as the main assertion. |

**Installation (scratch only -- never into this repo's manifests):**

```bash
mkdir -p /tmp/wf-engine
npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows
# ... run the canary with PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules ...
rm -rf /tmp/wf-engine
```

**Version verification (run 2026-09-09):**

```
$ npm view @quintinshaw/pi-dynamic-workflows version
3.10.1
$ npm view @quintinshaw/pi-dynamic-workflows time --json   # excerpt
created  2026-05-30T19:08:07.084Z
3.10.1   2026-09-03T20:51:27.803Z
modified 2026-09-03T20:51:28.204Z
```

3.10.1 is still npm's current release as of 2026-09-09, so the doc's existing 3.10.1 grade needs no version bump. [VERIFIED: npm registry, 2026-09-09]

## Package Legitimacy Audit

No package is added to any dependency manifest by this phase. The audit below covers the one package installed to a scratch prefix.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@quintinshaw/pi-dynamic-workflows` | npm | first published 2026-05-30 (~3.3 mo), 3.10.1 published 2026-09-03 | not measured | `github.com/QuintinShaw/pi-dynamic-workflows` | OK | Scratch-install only. Already the documented, adopted host engine of this milestone (`docs/workflows-compatibility.md` throughout, README prerequisite in both languages). |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

The `gsd-tools query package-legitimacy check` seam was not run: this package is not a new discovery but the engine the milestone already ships against, named in `README.md`, `README.es.md` and `docs/workflows-compatibility.md`, with an install instruction the doc already publishes and an explicit warning against the unscoped near-name (`docs/workflows-compatibility.md:181`: "`pi-workflows` and `pi-dynamic-workflows` are two real, different packages on npm"). Its repository URL and publish times were read directly from the registry (above). [VERIFIED: npm registry + `docs/workflows-compatibility.md:181`]

Note on the scratch install for the planner: `npm install --prefix` pulled **171 packages** and warned that three of them carry uncovered install scripts (`@google/genai` preinstall, `esbuild` postinstall, `protobufjs` postinstall). These arrive transitively through the engine's peer `@earendil-works/pi-coding-agent`. They ran (or were skipped by npm's `allowScripts` policy) inside `/tmp`, never in this repo. The plan should keep the scratch prefix outside the repository for this reason as well as for NFR-5.

## The seven questions

### Q1 -- Can the engine's `agent()` failure path be driven WITHOUT provider credentials?

**Yes.** Every failure branch, classified.

The `agent()` surface is two functions: a synchronous wrapper (`src/workflow.ts:614`) and the async body `agentImpl` (`src/workflow.ts:649`). [VERIFIED: `@quintinshaw/pi-dynamic-workflows` 3.10.1, `src/workflow.ts`, read in a scratch install 2026-09-09]

| # | Branch | Site (3.10.1 `src/`) | Code / recoverable | Needs credentials? | Observable |
|---|--------|----------------------|--------------------|--------------------|-----------|
| 1 | `opts.thread` present but not a non-empty string | `workflow.ts:618-624` | `SCRIPT_VALIDATION_ERROR` / `false` | **no** -- pure input validation, never reaches a runner | rejects |
| 2 | Same `thread` already running | `workflow.ts:625-632` | `SCRIPT_VALIDATION_ERROR` / `false` | **no** | rejects |
| 3 | Run aborted (`throwIfAborted`) | `workflow.ts:608-612`, called at `:650` | `WORKFLOW_ABORTED` / `true` (but rethrown by the `isAborted()` guard, never nulled) | **no** | rejects |
| 4 | Agent cap breached | `workflow.ts:550-559`, checked at `:663` | `AGENT_LIMIT_EXCEEDED` / `false` | **no** -- set `maxAgents: 0` | rejects |
| 5 | Run token budget exhausted | `workflow.ts:666-668` | `TOKEN_BUDGET_EXHAUSTED` / `false` | **no** -- set `tokenBudget: 0` | rejects |
| 6 | Phase sub-budget exhausted | `workflow.ts:680-686` | `TOKEN_BUDGET_EXHAUSTED` / `false` | **no** | rejects |
| 7 | `thread` + worktree isolation | `workflow.ts:698-704` | `SCRIPT_VALIDATION_ERROR` / `false` | **no** | rejects |
| 8 | `opts.schema` is not a top-level object schema | `agent.ts:882-887` | `SCRIPT_VALIDATION_ERROR` / `false` | **no** -- screened before any provider call | rejects |
| 9 | `model` / `tier` spec resolves to nothing | `agent.ts:939-941` | `MODEL_NOT_FOUND` / `false` | **no** -- resolution is local | rejects |
| 10 | **Real runner throws (no API key, network error, provider 5xx)** | classified by `errors.ts:200-204` | `AGENT_EXECUTION_ERROR` / **`true`** | **no** -- an empty `PI_CODING_AGENT_DIR` *causes* it | **resolves `null`** |
| 11 | Subagent produced no assistant output | `workflow.ts:901-905`, `agent.ts:1131-1133` | `AGENT_EMPTY_OUTPUT` / `true` | yes (needs a real completed turn) | resolves `null` |
| 12 | Per-agent timeout | `workflow.ts:1767-1770`, classified `errors.ts:177-183` | `AGENT_TIMEOUT` / `true` | yes in practice | resolves `null` |
| 13 | Provider usage / quota limit | `agent.ts:109-113`, `errors.ts:189-198` | `PROVIDER_USAGE_LIMIT` / `false` | yes | rejects |
| 14 | Schema agent never produced valid structured output | `agent.ts:167-171` | `SCHEMA_NONCOMPLIANCE` / `false` | yes | rejects |

**Row 10 is the canary's shape.** `wrapError`'s final arm is a catch-all that makes *any* plain thrown `Error` recoverable [VERIFIED: 3.10.1 `src/errors.ts:200-204`, verbatim]:

```ts
  return new WorkflowError(
    error instanceof Error ? error.message : String(error),
    WorkflowErrorCode.AGENT_EXECUTION_ERROR,
    { recoverable: true, agentLabel: context?.agentLabel, details: error },
  );
```

Driving it needs only an empty `PI_CODING_AGENT_DIR`: the real `WorkflowAgent` runs, finds no credential, and throws. Measured transcript is under Q2.

Rows 1, 2, 4-9 are all credential-free too, but every one of them is `recoverable: false`, so they only ever prove the *reject* half. They are excellent differential controls (Q3) and useless as the primary assertion.

### Q2 -- What does the engine actually do -- reject, or resolve to `null`?

**Both, and which one depends on `recoverable`.** The doc's "every failure branch ... throws" is refuted.

Source of truth [VERIFIED: 3.10.1 `src/workflow.ts:990-996`, verbatim]:

```ts
            if (workflowError.recoverable) {
              log(
                `agent "${label}" exhausted ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"}: ${workflowError.code} ${workflowError.message}`,
              );
              return null;
            }
            throw workflowError;
```

`maxAttempts` is `retries + 1` and the default `agentRetries` is `0` [VERIFIED: 3.10.1 `src/workflow.ts:791-792`, verbatim: `const retryAttempts = normalizeAgentRetries(agentOptions.retries ?? options.agentRetries ?? 0);` / `const maxAttempts = retryAttempts + 1;`], so a single recoverable failure returns `null` immediately with no retry. The shipped `dist/workflow.js:572-576` carries the same branch, so the canary (which imports `dist/`) exercises the code the `src/` citation names.

**Driven at run time.** Engine 3.10.1 installed to `/tmp/wf-engine-117`, `PI_CODING_AGENT_DIR` pointed at an empty directory, real `WorkflowAgent` (no injected runner). Verbatim harness output, 2026-09-09:

```text
### no-creds sandbox, plain agent()  (107ms)
   {"kind":"resolved","isNull":true,"value":"null"}
   logs=["agent \"agent 1\" exhausted 1 attempt: AGENT_EXECUTION_ERROR No API key found for the selected model.\n\nUse /login to log into a provider via OAuth or API key. See:\n  /tmp/wf-engine-117/node_modules/@earendil-works/pi-coding-agent/docs/providers.md\n  /tmp/wf-engine-117/node_modules/@earendil-works/pi-coding-agent/docs/models.md"]
### no-creds sandbox, agentTimeoutMs 1  (7ms)
   {"kind":"resolved","isNull":true,"value":"null"}
   logs=["agent \"agent 1\" exhausted 1 attempt: AGENT_EXECUTION_ERROR No API key found for the selected model. ..."]
### no-creds sandbox, bogus model  (8ms)
   {"kind":"rejected","name":"WorkflowError","code":"MODEL_NOT_FOUND","recoverable":false,"message":"Model \"nosuchprovider/nosuchmodel\" not found. Use /workflows-models to choose an available model."}
```

And the credential-free reject branches, same session:

```text
### empty thread string
   {"kind":"rejected","name":"WorkflowError","code":"SCRIPT_VALIDATION_ERROR","recoverable":false,"message":"agent() thread must be a non-empty string"}
### worktree + thread
   {"kind":"rejected","name":"WorkflowError","code":"SCRIPT_VALIDATION_ERROR","recoverable":false,"message":"agent thread \"t\" cannot use worktree isolation because worktrees are removed after each call"}
### maxAgents 0
   {"kind":"rejected","name":"WorkflowError","code":"AGENT_LIMIT_EXCEEDED","recoverable":false,"message":"Agent limit exceeded (0/0). Re-call workflow with resumeFromRunId=... "}
### tokenBudget 0
   {"kind":"rejected","name":"WorkflowError","code":"TOKEN_BUDGET_EXHAUSTED","recoverable":false,"message":"workflow token budget exhausted"}
### non-object schema (real agent)
   {"kind":"rejected","name":"WorkflowError","code":"SCRIPT_VALIDATION_ERROR","recoverable":false,"message":"agent() opts.schema must be a top-level JSON object schema (type: \"object\") -- got type: array; ..."}
```

[VERIFIED: driven against `@quintinshaw/pi-dynamic-workflows` 3.10.1 in a `/tmp` scratch prefix, 2026-09-09, transcripts above]

**What the divergence actually is, once measured.** Upstream's own contract, read verbatim out of the Claude Code 2.1.251 binary:

> `agent(): Promise<any>` -- spawn a subagent. Without schema, returns its final text as a string. With schema (a JSON Schema), the subagent is forced to call a StructuredOutput tool and `agent()` returns the validated object -- no parsing needed. **Returns null if the user skips the agent mid-run or the subagent dies on a terminal API error after retries (filter with `.filter(Boolean)`).**

[VERIFIED: `grep -oaP` over `~/.local/share/claude/versions/2.1.251`, 2026-09-09]

Upstream's `null` is *also* conditional -- "a terminal API error after retries". The engine's recoverable class is the direct analogue, and it behaves identically. The honest restatement is therefore: **the engines agree on the ordinary failure and diverge only on the engine's non-recoverable class**, where `@quintinshaw/pi-dynamic-workflows` rejects and seals the run. An uncaught non-recoverable error is rethrown out of `runWorkflow` and aborts every sibling still in flight (`src/workflow.ts:1430-1471`, `shared.runFatalController.abort()` at `:1469`).

### Q3 -- The negative control

Criterion 2 asks that inverting the expectation turn the run red. Two independent controls are available; the plan should carry **both**, because they fail for different reasons.

**Control A -- differential (in-run, always on).** The same driver, same engine, same sandbox, runs a second case that must produce the OPPOSITE observable: `agent("hi", { model: "nosuchprovider/nosuchmodel" })` rejects with `MODEL_NOT_FOUND / recoverable: false`. Two assertions in one run, disagreeing with each other by design, prove the assertion machinery discriminates rather than merely reporting whatever it sees. This is the same non-vacuity shape the archived W3 assertion used ("a never-written name must be absent from the listing").

**Control B -- inversion flag (operator-run, on demand).** A `--invert` argv flag flips the A1 expectation from `isNull: true` to `isNull: false`. Measured red run, verbatim:

```text
engine 3.10.1
AssertionError [ERR_ASSERTION]: A1: a recoverable agent() failure did not produce the expected observable at engine 3.10.1.
+ actual - expected

  {
+   isNull: true,
-   isNull: false,
    kind: 'resolved'
  }
  ...
EXIT=1
```

**Control C -- the precondition, which is the one that will actually fire.** If the machine running the canary *has* credentials reachable from the sandbox, the agent SUCCEEDS and nothing is measured. The canary must detect that and route `human_needed`, not report a failed assertion and not pass. The discriminator is measured and reliable: on success `res.logs` is `[]`; on the induced failure it contains the `AGENT_EXECUTION_ERROR` line. Measured, running against the operator's real Pi dir instead of a sandbox:

```text
engine 3.10.1
AssertionError [ERR_ASSERTION]: A0 PRECONDITION: the agent call did not fail. The sandbox resolved a provider, so nothing was measured. logs=[]
```

[VERIFIED: all three controls driven 2026-09-09; green run of the same driver exits 0 -- transcript under **Code Examples**]

This machine *does* carry working credentials in `~/.pi/agent/auth.json`: a control run with no sandbox returned `PONG` from a real subagent, `tokenUsage.total = 1829`, cost `$0.0093`. That is exactly why the precondition is mandatory rather than decorative.

### Q4 -- Is the `agent()` section of `docs/workflows-compatibility.md` gated?

**No. Proved by planting, not by reading.**

`tests/architecture/workflows-doc-pins.test.ts` (278 lines) is the only suite that reads the compat doc for content. Its four cases pin:

1. `WDEP-04` -- the two peer-floor sentences (`docs/workflows-compatibility.md` "Host engine requirements" section vs `package.json`).
2. `WDOC-01` -- the refusal-check counts: the table rows must be exactly `[1..9]`, the `validateMeta` bullet list exactly 6, the literal strings `**nine distinct checks**` and `**six distinct messages**` must be present, and `/seven gates/i` must be **absent**.
3. `WGATE-05` -- the classification table's `This bridge` column (closed set `["replicate","warn","neither"]`), the fixed partition `{replicate:[1,2], warn:[3,4,5,6,8,9], neither:[7]}`, and the `Gate name` cells against `GATE_ORDER` in `domain/workflow-script.ts`.
4. `WDOC-01` -- both READMEs' engine mentions (exactly 2 each) and doc links (exactly 1 each), on identical line numbers.

None of them reads the `### agent() failure semantics` section.

**Planted and measured, 2026-09-09.** The section's third row was rewritten to `| @quintinshaw/pi-dynamic-workflows | resolves to null (recoverable) / throws (non-recoverable) | **runtime-measured at 3.10.1** (tests/live-uat/workflow-agent-failure-canary.mjs) |` and the caveat paragraph replaced. Result:

- All four `workflows-doc-pins` cases stayed **green**.
- `tests/architecture/no-stale-test-citations.test.ts` went **red**, with exactly one offender:

```text
AssertionError [ERR_ASSERTION]: Stale test-path citation. ...
docs/workflows-compatibility.md:140 cites tests/live-uat/workflow-agent-failure-canary.mjs
```

The plant was reverted and `git status --porcelain docs/ tests/ extensions/` reported nothing; the five cases are green again. [VERIFIED: planted, measured, reverted 2026-09-09]

**Enumerated gate-move list for the doc edit:**

| Gate | Moves? | Why / what to do |
|------|--------|------------------|
| `tests/architecture/workflows-doc-pins.test.ts` (4 cases) | **no** | Section is unpinned. Two latent tripwires: (a) `classificationRows` matches `/^\| (\d+)\s+\|.*\|$/gm` and asserts exactly six cells, so do NOT introduce any table row whose first cell is a bare number; (b) `assert.doesNotMatch(doc, /seven gates/i)` -- when writing the census, never let the words "seven gates" land adjacently. |
| `tests/architecture/no-stale-test-citations.test.ts` | **yes** | Any `tests/...` path in the doc must resolve. Land the canary file **before or in the same commit as** the doc sentence that names it. `docs/adr/`, `docs/plans/`, `docs/research/` are the only exempt prefixes (`no-stale-test-citations.test.ts:49-53`); `docs/workflows-compatibility.md` is policed. |
| `tests/architecture/unit-suite-glob-completeness.test.ts` | **no** | Keys on `.test.ts` only (`unitTestFilesOnDisk`, `entry.name.endsWith(".test.ts")`). A `.mjs` in `tests/live-uat/` is invisible to it. |
| `scripts/check-corresponding-tests.mjs` (`npm run test:corresponding`) | **no** | `filesBelow(projectRoot, testRoot, (name) => name.endsWith(".test.ts"))` at `:137`. |
| `fallow dead-code --fail-on-issues` | **yes, hard** | See Pitfall 3. |
| `tests/architecture/no-shell-out.test.ts`, `no-credential-leak.test.ts` | **no** | Scoped to `EXTENSION_ROOT` and `.ts`. |
| ESLint / Prettier / `tsc` | **no** | `eslint.config.js:21` ignores `"tests/live-uat/"`; `format:check` covers `"**/*.{js,json,ts}" "scripts/**/*.mjs"` only (`package.json:80`) -- `tests/**/*.mjs` is outside it; `tsconfig.json` includes `tests/**/*.ts` only. |
| `mdformat` + `markdownlint-cli2` (pre-commit) | **yes, cosmetic** | Both run on `docs/**.md` and `tests/live-uat/README.md`; both exclude `^(tests/fixtures/\|tests/bridges/_fixtures/\|\.planning/)`. They will realign the doc's markdown tables. Run `pre-commit run --files ...` and restage; never `git commit --amend` after a hook rewrite. |
| Phase 114's verification | **stale, expected** | `114-VERIFICATION.md` frontmatter `covered_files` includes `"docs/workflows-compatibility.md"` (`:25`) and both READMEs. Editing the doc flips 114 to `verification: stale`. Already sequenced: 114's re-verification follows this phase. |

### Q5 -- The census: are the seven Anthropic workflow scripts reachable, and do the figures hold?

**They are reachable, and the figures do not hold as stated.**

Phase 116's finding (no `workflows/` directory in either *pi-claude-marketplace* cached marketplace) is correct and does not settle the question -- the scripts live in **Claude Code's own** marketplace clone on this machine:

```text
~/.claude/plugins/marketplaces/claude-plugins-official/plugins/claude-security/workflows/scan.js
~/.claude/plugins/marketplaces/claude-plugins-official/plugins/code-modernization/workflows/extract-rules.js
                                                       .../code-modernization/workflows/harden-scan.js
                                                       .../code-modernization/workflows/portfolio-assess.js
                                                       .../code-modernization/workflows/reimagine-scaffold.js
                                                       .../code-modernization/workflows/uplift-deltas.js
                                                       .../code-modernization/workflows/uplift-migrate.js
```

Exactly **seven** files, in exactly the two Anthropic-authored plugins the Evidence base names. Both `plugin.json` files carry `"author": { "name": "Anthropic", "email": "support@anthropic.com" }`; `claude-security` is `"version": "0.11.0"`, `code-modernization` declares no version. The clone carries no `.git` directory (mtime 2026-09-08 22:22), so the measurement is pinned by date and plugin version, not by commit. [VERIFIED: `find` + `cat` over `~/.claude/plugins/marketplaces/claude-plugins-official`, 2026-09-09]

**Measured, counting rule stated: `grep -o '<token>' <file> | wc -l`, i.e. every textual occurrence, one line per occurrence.**

| Script | `pipeline(` | `parallel(` | `.filter(Boolean)` |
|--------|------------:|------------:|-------------------:|
| `claude-security/scan.js` | 2 | 4 | 14 |
| `code-modernization/extract-rules.js` | 0 | 3 | 3 |
| `code-modernization/harden-scan.js` | 0 | 3 | 5 |
| `code-modernization/portfolio-assess.js` | 1 | 0 | 1 |
| `code-modernization/reimagine-scaffold.js` | 0 | 1 | 1 |
| `code-modernization/uplift-deltas.js` | 0 | 2 | 2 |
| `code-modernization/uplift-migrate.js` | 0 | 1 | 0 |
| **totals** | **3 (in 2 of 7)** | **14 (in 6 of 7)** | **26 (in 6 of 7)** |

Every `pipeline(` hit was inspected and is a real call, not prose (`scan.js`'s `meta.description` contains the word "pipeline:" with a colon, which does not match `pipeline(`).

**The stated census is wrong in both halves, and the arithmetic shows how it was produced.** "six of the seven ... `pipeline(...)` + `.filter(Boolean)`, twelve times in total":

- **"six of the seven"** is the `.filter(Boolean)` population (all but `uplift-migrate.js`), NOT the `pipeline(...)` population, which is **two** of seven. The dominant fan-out helper in these scripts is `parallel()`, not `pipeline()`.
- **"twelve times"** is reproducible only by counting `grep -n` *lines*: `grep -n '\.filter(Boolean)'` over all seven returns exactly 12 lines. But `scan.js` is minified onto a single line and holds 14 occurrences by itself, so the line count undercounts the true figure by more than half. There is no honest counting rule that yields 12.

**Recommendation (D-117-02 is measure-or-drop; this is "measured, and therefore restated"):** drop the composite claim and publish the two measured figures separately with the counting rule beside them -- e.g. "six of the seven scripts call `.filter(Boolean)` on a fan-out result (26 occurrences); two of the seven use `pipeline()` (3 calls) and six use `parallel()` (14 calls); both helpers carry the same recoverable-to-`null` arm". This also matches the doc's own standing rule, stated at `docs/workflows-compatibility.md:101`: "**This document states no total count of the engine's refusal messages, and none should be added.** ... any total would be a number with no honest counting rule behind it."

Caveat the planner must carry: the count is **machine-local**. The clone is not vendored, has no pinned revision, and a verifier on another machine cannot reproduce it without installing the same marketplace. If the doc publishes the figure, it must publish the provenance sentence (marketplace, plugin versions, date) with it -- exactly as the doc already does for `read from the 2.1.251 binary`.

### Q6 -- Every site carrying the 105 contradiction

File: `.planning/workstreams/workflows/milestones/workflows-phases/105-workflow-degradation-and-documentation/105-VERIFICATION.md` (147 lines).

| Line(s) | Text | Reading |
|---------|------|---------|
| `:4` | `status: passed` | Phase-level status. D-117-03 names it; it is defensible on its own (6/6 criteria) but is the frontmatter half of the pairing. |
| `:11` | `why_human: "... Phase 104's structurally identical canary route (R1/R2 removal assertions) was already run and closed by a human against real engine 3.5.1 on 2026-08-16 ... the W1-W3 code follows the same conventions but **is itself unexercised against a live engine**."` | **The settling evidence.** In its own words, W1-W3 was never run. |
| `:12-13` | `result: CLOSED` / `closed: 2026-08-16` | **Over-claim.** |
| `:14-32` | The `evidence:` block: "Run by the orchestrator against real engine 3.5.1 ... Exit 0, every assertion PASS. The three that close WDEP-03: W1 ... W2 ... W3 ..." | **A fourth contradiction the CONTEXT does not name.** This block asserts a W1/W2/W3 pass in the same YAML entry whose `why_human` says W1-W3 is unexercised. It is not just the frontmatter status line -- the evidence narrative itself is the over-claim, and it is the most persuasive part of the record. Correcting `result:` without correcting this block leaves the false story intact. |
| `:44` | `**Status:** passed (live canary closed 2026-08-16 -- see frontmatter evidence)` | **Over-claim.** Explicitly points the reader at `:14-32`. |
| `:55` | "...The live canary's W1/W2/W3 assertion ... is present in code but **UNRUN** in this environment -- see Human Verification." | **The truthful side.** Keep. |
| `:91` | `` | `tests/live-uat/workflow-storage-canary.mjs` | W1/W2/W3 assertion | ✓ PRESENT, code-reviewed | UNRUN against a real engine -- see Human Verification | `` | **The truthful side on UNRUN, false on PRESENT.** The file does not exist on this branch (D-117-01). Two separate corrections on one row. |
| `:103-130` | The whole `### Human Verification Required` / `### 1. Live-engine canary` section, still written in the future tense | **The truthful side.** Keep; it is the instruction that was never carried out. |
| `:139-141` | "The sole open item is the live-engine canary run ... properly tracked as an open `unrun-verify` entry in `.planning/WINDOWS.md` (id 5)" | **Truthful about openness, but the citation is dangling.** In the current `.planning/WINDOWS.md` (44 entries), `id 5` is `{"kind":"deviation","phase":"112","file":".planning/ROADMAP.md","description":"Closed the canonical P112-15 row and current activity after the generic progress update left them stale.","status":"fixed"}` -- a different milestone's entry. No entry in today's ledger describes the live-engine canary. [VERIFIED: parsed the fenced JSON block of `.planning/WINDOWS.md`, 2026-09-09] |

**Anything else citing it as evidence for a closed canary:** grep over `.planning/`, `docs/`, `tests/`, `extensions/` for `workflow-storage-canary` returns ~50 hits. Every one outside `105-VERIFICATION.md` is either (a) dated history in the archived 103/104/105 phase directories -- correct as history, must NOT be edited -- or (b) a live pointer that says the opposite and is already right:

- `.planning/workstreams/workflows/phases/114-degradation-and-documentation/114-VALIDATION.md:178` -- "`tests/live-uat/workflow-storage-canary.mjs` does not exist on this tree, by D-114-08".
- `.../114-CONTEXT.md:315` -- "**D-114-08 -- do not plan against `tests/live-uat/workflow-storage-canary.mjs`.**"
- `.../114-RESEARCH.md:865, :1093, :1387` -- same finding.
- `.../115-.../.continue-here.md:187` -- same.

Two **live** sites still name the non-existent file as a present seam and should be repointed at whatever the phase actually creates:

| Site | Current text | Action |
|------|--------------|--------|
| `.planning/workstreams/workflows/REQUIREMENTS.md:61` | `<!-- Seams: tests/live-uat/workflow-storage-canary.mjs (the standing live driver), docs/workflows-compatibility.md ... -->` | Repoint to the new canary filename. It is a comment, not a claim, but it is the Evidence section's seam list and it names a file that does not exist. |
| `.planning/workstreams/workflows/ROADMAP.md:666` | Criterion 1: "`tests/live-uat/workflow-storage-canary.mjs` drives the host engine's `agent()` failure path..." | Criterion 1 already presumes the wrong file; criterion 3 already names the wrong version (3.5.1). Record both corrections rather than honoring them (D-117-01, D-117-02). |

### Q7 -- Pitfalls

See **Common Pitfalls** below. Six were measured on this tree, not reasoned about.

## Architecture Patterns

### System diagram -- what the canary touches

```text
  operator / verifier
        |
        |  npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows
        v
  /tmp/wf-engine/node_modules/          <-- scratch prefix, OUTSIDE the repo
    @quintinshaw/pi-dynamic-workflows/  (engine 3.10.1, dist/ + src/)
    @earendil-works/pi-coding-agent/    (auto-installed peer: real spawn machinery)
        ^
        |  PI_WORKFLOW_ENGINE_ROOT  ->  dynamic import(pathToFileURL(...dist/index.js))
        |
  tests/live-uat/workflow-agent-failure-canary.mjs
        |
        |  preconditions: engine root set & resolvable
        |                 PI_CODING_AGENT_DIR set AND inside tmp/pi-uat  (containment)
        |
        +--> A0  runWorkflow(script) ; assert res.logs names AGENT_EXECUTION_ERROR
        |        (else -> "failure not induced" -> exit 1 -> human_needed)
        +--> A1  recoverable failure     -> agent() resolves to null       [the measurement]
        +--> A2  non-recoverable failure -> agent() rejects MODEL_NOT_FOUND [differential control]
        +--> A3  pipeline(...)           -> [null,null,null], filter(Boolean) drops all
        |
        +--> finally: rm -rf the sandbox
        v
  exit 0  (all observed)   |   exit 1 + human-readable reason (anything else)

  NOT touched: extensions/**, package.json, package-lock.json, the `pi` CLI,
               any network call, the operator's real ~/.pi/agent
```

### Recommended file

```text
tests/
  live-uat/
    README.md                             # add a third row to the canary table
    manifest-absence-canary.mjs
    stop-canary.mjs
    workflow-agent-failure-canary.mjs     # NEW  (name at planner's discretion)
```

### Pattern 1: engine-only canary (no extension, no `pi` binary)

**What:** Unlike both existing canaries, this one drives the *engine*, not the extension. It needs no marketplace fixture, no `installPlugin`, no `execFileAsync`, and no `pi` on PATH.

**When to use:** whenever the observable belongs to the host engine rather than to this repo's bridge.

**Why it matters here:** it removes the entire `EXTENSION_ENTRY` / `execFileAsync` / `REPO_ROOT` preamble that is one of the two pre-approved `duplicates.ignoredClones` entries, so the third canary need not copy it (see Pitfall 4).

### Pattern 2: absence-of-credentials as the failure inducer

**What:** point `PI_CODING_AGENT_DIR` at an empty disposable directory; the real `WorkflowAgent` fails on `No API key found for the selected model.`

**Why:** it needs no fake, no account, and no network, and it fails *hardest* on exactly the machine a verifier uses. The engine writes two empty files (`auth.json`, `models-store.json`) into that directory and nothing else -- measured -- so cleanup is a single `rm -rf`.

**Warning:** it inverts the usual precondition. A machine *with* credentials makes the canary unable to measure. The A0 precondition (`res.logs` non-empty and naming `AGENT_EXECUTION_ERROR`) is what converts that into `human_needed` instead of a false red or a silent pass.

### Anti-Patterns to Avoid

- **Asserting the error code / branch instead of the observable.** D-117-01 forbids it, and it would re-state the source read. Assert `r === null` versus "the promise rejected". `WorkflowErrorCode` may legitimately be read in the *control* assertion (A2), where naming `MODEL_NOT_FOUND` is what makes the control specific rather than "something threw".
- **Making the injected `options.agent` fake the primary assertion.** It works, but it proves the runtime's disposition logic while bypassing the real runner. Keep it out; the credential-free route needs no fake.
- **`assert.deepStrictEqual` on anything returned by `runWorkflow`.** See Pitfall 1 -- it fails on identical data.
- **Adding the engine to `package.json` "just for the canary".** Barred by NFR-5, D-98-10, and the milestone's Out-of-Scope table: "Would couple `npm run check` to a 0.x package with ~50 releases since May 2026 and no exported contract."
- **Editing the archived 103/104 records.** Only 105's false claims are in scope (D-117-03). Everything else in those directories is correct history.
- **Publishing the "six of seven, twelve times" census unchanged.** It is measurably wrong; see Q5.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deciding whether an agent failure is fatal | A local recoverable/non-recoverable table in the canary | Read the observable the engine produces | The classification is the engine's (`src/errors.ts:166-205`) and changes across releases. Asserting the observable is what survives a bump; asserting the table is what WPIN-01 exists to worry about. |
| Resolving the engine module | `require.resolve` gymnastics, `NODE_PATH`, a symlink into `node_modules` | `import(pathToFileURL(path.join(process.env.PI_WORKFLOW_ENGINE_ROOT, "@quintinshaw/pi-dynamic-workflows/dist/index.js")).href)` | Measured working from the repo cwd with the engine in `/tmp`. A symlink into the repo's `node_modules` would be picked up by fallow, ESLint and `npm pack`. |
| Reading the engine version for the grade | Hard-coding `3.10.1` in the canary | `JSON.parse(readFile(<root>/@quintinshaw/pi-dynamic-workflows/package.json)).version`, printed in every PASS line | The grade sentence in the doc must name the version the run actually observed. A hard-coded string can lie after an operator bumps the scratch install. |
| Comparing cross-realm results | Custom deep-equal | `structuredClone(res.result)` then `assert.deepEqual` | Both measured working; `JSON.parse(JSON.stringify(...))` works too. |
| Faking a subagent failure | A mock provider / an HTTP interceptor | An empty `PI_CODING_AGENT_DIR` | The real runner fails on its own, for a real reason, with a message the transcript can quote. |

**Key insight:** the whole phase is a measurement, so every place the canary substitutes a construction of its own for something the engine produces is a place the measurement quietly becomes a restatement.

## Common Pitfalls

### Pitfall 1: `runWorkflow`'s result is a cross-realm object -- `deepStrictEqual` fails on identical data

**What goes wrong:** `assert.deepStrictEqual(res.result, { kind: "resolved", isNull: true })` fails with `Values have same structure but are not reference-equal`, printing an actual and an expected that are visibly identical. This cost a full debugging cycle during this research.

**Why:** the engine runs the script body inside `vm.createContext` and deliberately does not inject host built-ins (`src/workflow.ts:1404-1410`, its own comment: "we deliberately do NOT inject host built-ins, whose `.constructor` would be the host `Function`"). Measured on the returned object: `Object.getPrototypeOf(r) === Object.prototype` is **false**, `r instanceof Object` is **false**.

**How to avoid:** `assert.deepEqual(structuredClone(res.result), ...)` (measured PASS) or `JSON.parse(JSON.stringify(res.result))` (measured PASS) or compare scalar fields (`r.isNull === true`, measured PASS).

**Warning signs:** an assertion diff whose two sides render the same.

### Pitfall 2: a machine with credentials silently un-measures the canary

**What goes wrong:** on a machine whose sandbox can reach a provider, `agent()` succeeds and returns a string. Without an explicit precondition the canary reports a failed A1 assertion, which reads like an engine regression.

**Why:** the failure inducer is an *absence*. This machine has a working `~/.pi/agent/auth.json` (confirmed: a control run returned `PONG`, 1829 tokens, $0.0093), so an unsandboxed run is a live provider call.

**How to avoid:** assert A0 first -- `res.logs.some(l => l.includes("AGENT_EXECUTION_ERROR"))` -- and exit non-zero with `"the agent call did not fail; the sandbox resolved a provider, so nothing was measured"`. Measured discriminator: on success `logs` is `[]`; on the induced failure it carries the exact line. Also refuse to run outside `tmp/pi-uat`, the containment rule `stop-canary.mjs:191-197` already establishes -- both because the engine writes into `PI_CODING_AGENT_DIR` and because the operator's real dir is where the credentials are.

**Warning signs:** A1 red with `isNull: false` and an empty `logs` array.

### Pitfall 3: a new `tests/**/*.mjs` without `fallow-ignore-file unused-file` fails the gate -- at commit time, not just in `npm run check`

**What goes wrong:** `fallow dead-code --fail-on-issues` exits 1 and `npm run check` stops before any test runs.

**Measured by planting** (`tests/live-uat/_probe-plant.mjs`, 4 lines, no marker):

```text
BEFORE_EXIT=0 ... ✓ No issues found (0.49s)
PLANT_EXIT=1
  ● Unused files (1)
    tests/live-uat/_probe-plant.mjs
  ✗ 1 file (0.73s)
    1 issue · 14 suppressed · 0 stale suppressions
```

Plant reverted; the tree is clean.

**How to avoid:** copy the marker both existing canaries carry verbatim -- `stop-canary.mjs:6` and `manifest-absence-canary.mjs:6` are byte-identical:

```js
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
```

**Also fires at commit time.** `.pre-commit-config.yaml:121` scopes the `npm-fallow` hook to `'^(\.fallowrc\.json|tsconfig\.json|eslint\.config\.js|(extensions|tests)/.*\.(ts|mjs)|scripts/.*\.mjs|package(-lock)?\.json)$'` -- a new `tests/live-uat/*.mjs` matches, so the whole three-leg fallow chain runs on the commit that adds it.

### Pitfall 4: the duplication gate -- lower risk than it looks, and avoidable outright

`.fallowrc.json:204-206` is verbatim:

```json
  "duplicates": {
    "ignoredClones": ["dup:cc950b18:2", "dup:6d8c002d:2"],
    "threshold": 3
```

Those two keys still bind at fallow 3.17.0 -- a run reports `note: hid 2 reviewed clone groups from duplicates.ignoredClones`. The `:2` suffix is an instance count, so a third copy of either block could shift the key and un-hide the group.

**Measured, and this de-risks it:** `fallow dupes --fail-on-issues --format human` exits **0** on this tree today, while reporting 35 clone groups and `✗ 1,045 lines (1.4%) duplicated across 40 files`. One of those visible, un-ignored groups is already between the two canaries (`dup:c77b3abb6f87acd9-21`, 23 lines, `manifest-absence-canary.mjs:632-650` <-> `stop-canary.mjs:387-409`) and does not fail the run. So duplication is a hygiene concern here, not a blocker.

**Best avoided anyway:** the engine-only canary needs neither the `execFileAsync` / `REPO_ROOT` / `EXTENSION_ENTRY` preamble (`dup:6d8c002d:2`) nor necessarily the same `main().then(exit 0, exit 1)` epilogue (`dup:cc950b18:2`). If the epilogue is copied, keep the per-clone justification comment convention `stop-canary.mjs:8-25` establishes -- fallow types `ignoredClones` as `string[]`, so the justification cannot live in the JSON.

**Do not use the index-suffixed form.** `CONVENTIONS.md` says the `dup:<hash>-NN` form is not stable across runs; the human-format report prints exactly that form (`dup:c77b3abb6f87acd9-21`), which is why the config carries the older content-addressed keys instead.

### Pitfall 5: the doc citation must land with (or after) the file

`no-stale-test-citations.test.ts` policed roots are `docs/`, `extensions/`, `tests/` for `.md`/`.mjs`/`.ts`, with only `docs/adr/`, `docs/plans/`, `docs/research/` exempt (`:48-53`). Its pattern `/tests\/[A-Za-z0-9_./-]*\.(?:ts|mjs)\b/g` matches `.mjs`. Measured: a doc sentence naming the canary before the canary exists reddens the gate with a one-line offender list. Sequence the tasks so the file lands first, or land both in one commit.

### Pitfall 6: markdown formatting is `mdformat`, not `prettier`

`package.json:79-80` scopes prettier to `"**/*.{js,json,ts}"` plus `"scripts/**/*.mjs"`. `.md` is handled by the `mdformat` + `markdownlint-cli2` pre-commit hooks (`.pre-commit-config.yaml:83-94`), which exclude `.planning/` but **not** `docs/` or `tests/live-uat/README.md`. They will rewrite the compat doc's table alignment when the `agent()` rows change width. Run `pre-commit run --files <paths>` first, fix, restage, re-run until clean -- a hook that rewrites a file mid-commit still lets the commit succeed, so check `git status` afterwards and fix with a follow-up commit, never `--amend`.

### Pitfall 7: two records this phase must not treat as authoritative

- `ROADMAP.md:666` criterion 1 names `tests/live-uat/workflow-storage-canary.mjs`; criterion 3 names engine **3.5.1**. Both are stale (D-117-01, D-117-02). Record the correction; do not honor them.
- `105-VERIFICATION.md:141` cites `.planning/WINDOWS.md (id 5)` for an open `unrun-verify` entry. Today's `id 5` is a Phase-112 `deviation` from a different milestone. When appending any new ledger entry, prefix the description with `[workflows-replay]` per `CLAUDE.md`, and never encode the milestone in `--phase`.

## Code Examples

### The measured canary skeleton (green run, verbatim output)

Driven 2026-09-09 against engine 3.10.1 in a `/tmp` scratch prefix. This is a working reduction, not a proposal -- the plan can shape it as it likes, but these four assertions are the ones that were observed.

```js
// Verified working 2026-09-09 against @quintinshaw/pi-dynamic-workflows 3.10.1.
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const INVERT = process.argv.includes("--invert");            // negative control B
const root = process.env.PI_WORKFLOW_ENGINE_ROOT;
if (!root) { console.error("LIVE ENGINE REQUIRED: PI_WORKFLOW_ENGINE_ROOT unset"); process.exit(1); }

const pkgPath = path.join(root, "@quintinshaw/pi-dynamic-workflows/package.json");
const version = JSON.parse(await readFile(pkgPath, "utf8")).version;   // never hard-code the grade
const { runWorkflow } = await import(
  pathToFileURL(path.join(root, "@quintinshaw/pi-dynamic-workflows/dist/index.js")).href
);

const mk = (call) => `export const meta = { name: "c", description: "d" };
try { const r = await ${call}; return { kind: "resolved", isNull: r === null }; }
catch (e) { return { kind: "rejected", code: e && e.code, recoverable: e && e.recoverable }; }
`;
const run = (call, opts = {}) =>
  runWorkflow(mk(call), { persistLogs: false, cwd: SANDBOX, ...opts });

// A0/A1 -- recoverable failure: no provider credentials reachable from the sandbox.
const a1 = await run('agent("hi")');
assert.ok(a1.logs.some((l) => l.includes("AGENT_EXECUTION_ERROR")),
  `A0 PRECONDITION: the agent call did not fail. The sandbox resolved a provider, so nothing was measured. logs=${JSON.stringify(a1.logs)}`);
assert.deepEqual(structuredClone(a1.result), { kind: "resolved", isNull: INVERT ? false : true },
  `A1: a recoverable agent() failure did not produce the expected observable at engine ${version}.`);

// A2 -- differential control: a NON-recoverable failure, same driver, same sandbox.
const a2 = await run('agent("hi", { model: "nosuchprovider/nosuchmodel" })');
assert.deepEqual(structuredClone(a2.result),
  { kind: "rejected", code: "MODEL_NOT_FOUND", recoverable: false },
  `A2: a non-recoverable agent() failure did not reject at engine ${version}.`);

// A3 -- the upstream pattern, end to end.
const a3 = await runWorkflow(`export const meta = { name: "c", description: "d" };
const rows = await pipeline(["a","b","c"], (i) => agent("x " + i));
return { len: rows.length, survivors: rows.filter(Boolean).length };
`, { persistLogs: false, cwd: SANDBOX });
assert.deepEqual(structuredClone(a3.result), { len: 3, survivors: 0 },
  `A3: pipeline(...).filter(Boolean) did not drop failed items at engine ${version}.`);
```

**Green run, verbatim:**

```text
$ PI_CODING_AGENT_DIR=<empty sandbox> PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules \
    node <canary>
engine 3.10.1
PASS A1: recoverable failure -> agent() resolves to null (engine 3.10.1)
PASS A2: non-recoverable failure -> agent() rejects MODEL_NOT_FOUND (engine 3.10.1)
PASS A3: pipeline(...) + .filter(Boolean) drops failures rather than aborting (engine 3.10.1)
EXIT=0
```

### The `pipeline` / `parallel` measurement in full

```text
{
  "pipeline": { "kind": "resolved", "raw": [null, null, null], "afterFilter": 0, "len": 3 },
  "parallel": { "kind": "resolved", "raw": [null, null],       "afterFilter": 0 }
}
agentCount: 5
```

Both helpers carry their own recoverable-to-`null` arm [VERIFIED: 3.10.1, verbatim]:

```ts
// src/workflow.ts:1077-1080  (pipeline)
              if (!workflowError.recoverable) {
                if (workflowError.code === WorkflowErrorCode.AGENT_LIMIT_EXCEEDED) batch.cancelled = true;
                throw workflowError;
              }
              log(`pipeline[${index}] failed: ${workflowError.message}`);
              return null;
```

```ts
// src/workflow.ts:1041-1044  (parallel)
              throw workflowError;
            }
            log(`parallel[${index}] failed: ${workflowError.message}`);
            return null;
```

### The doc rows as they stand today (edit target)

`docs/workflows-compatibility.md:132-144`, verbatim:

```markdown
### `agent()` failure semantics

The three runtimes disagree about what a failed subagent call does, and the two host-side claims hold different grades:

| Runtime                             | On a failed `agent()` call | Grade                                                                                                                |
| ----------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Claude Code                         | resolves to `null`         | read from the 2.1.251 binary, whose own prose says to filter with `.filter(Boolean)`                                 |
| `@nicknisi/pi-workflows`            | throws                     | **runtime-measured**                                                                                                 |
| `@quintinshaw/pi-dynamic-workflows` | throws                     | **source-read only** -- every failure branch in its agent implementation throws, and none has been driven at runtime |

The chosen engine's behavior has never been observed at run time, because driving it needs real subagent spawn machinery the fixtures avoid. It is stated here at the grade it holds today. Upgrading it to a measurement is separate work that has not been done, and no result should be inferred from this section until it has been.

The practical consequence for a plugin author: a script written for Claude Code that leans on `agent()` resolving to `null` -- a `pipeline(...)` followed by `.filter(Boolean)` -- may abort under Pi instead of dropping the failed item, on the source read above.
```

Note for the planner: the legend at `docs/workflows-compatibility.md:12` currently attributes the `runtime-measured at 3.10.1` grade to Spike 027 -- "a probe ran against the installed engine and observed the result (Spike 027)". This phase adds a **second** source for that grade, so the legend's parenthetical needs widening (e.g. "Spike 027 or the live-UAT canary named at the claim") or the new claim will read as if Spike 027 produced it.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "Every failure branch in the engine's agent implementation throws" (source read, doc `:140`) | Recoverable failures resolve to `null` after retries; only non-recoverable ones throw | Present at 3.10.1; earlier releases not re-checked | The doc's load-bearing claim is refuted. The grade upgrade also changes the *content* of the row, not just its label. |
| "A `pipeline(...)` + `.filter(Boolean)` script may abort under Pi" (doc `:144`) | It degrades exactly as upstream for the recoverable class; only the non-recoverable class aborts the run | Measured 2026-09-09 | The practical-consequence paragraph inverts. WEVID-02's "concrete consequence" is now a narrower, more useful statement. |
| Census: "six of seven scripts use `pipeline(...)` + `.filter(Boolean)`, twelve times" | Two of seven use `pipeline()` (3 calls); six of seven use `parallel()` (14 calls); six of seven use `.filter(Boolean)` (26 occurrences) | Measured 2026-09-09 | The composite claim cannot be published as written. |
| `tests/live-uat/workflow-storage-canary.mjs` is "the standing live driver" (`REQUIREMENTS.md:61`) | It does not exist on this branch | Since the 109-114 replay | Two live seam pointers need repointing. |

**Deprecated / outdated in the records:**

- ROADMAP criterion 3's engine pin `3.5.1` -- superseded by 3.10.1.
- `105-VERIFICATION.md`'s `WINDOWS.md (id 5)` citation -- points at an unrelated entry in today's ledger.
- `PI_WORKFLOW_ENGINE_ROOT` is **not** an established seam in this repo: `grep -rn "PI_WORKFLOW_ENGINE_ROOT" extensions/ tests/ docs/ scripts/ package.json` returns nothing. It was a convention of the never-landed storage canary. Reusing the name is sensible (the ROADMAP and `105-VERIFICATION.md:9` both name it) but the new canary defines it, so its precondition message must explain it.

## Runtime State Inventory

Not applicable -- this is not a rename, refactor or migration phase. It creates one new file, edits two markdown documents, and corrects one archived planning record. No stored data, live service config, OS-registered state, secret, or build artifact carries a string this phase changes.

One adjacent item that is *not* runtime state but behaves like it: the scratch engine install. It lives outside the repository, is created and deleted by the operator, and must never appear in `package.json` / `package-lock.json`. Verify with `git diff --name-only` over the phase's commit range that neither manifest changed -- the same check `105-03-PLAN.md` used.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.8.1 | -- |
| npm (`install --prefix`) | scratch engine install | ✓ | bundled | -- |
| Network (npm registry) | the one-time scratch install | ✓ | -- | none -- the canary cannot run without an installed engine, and says so (exit 1) |
| `@quintinshaw/pi-dynamic-workflows` | the measurement | ✓ via scratch prefix | 3.10.1 | none -- `LIVE ENGINE REQUIRED` -> `human_needed` |
| `@earendil-works/pi-coding-agent` | real `WorkflowAgent` spawn machinery | ✓ auto-installed as the engine's peer into the scratch prefix | (peer `>=0.80.8`) | none |
| `pi` CLI on PATH | **not needed** | -- | -- | -- (this canary, unlike `stop-canary.mjs`, drives no Pi session) |
| Provider credentials | **must be ABSENT** for the measurement | (present on this machine in `~/.pi/agent/auth.json`) | -- | sandbox via `PI_CODING_AGENT_DIR`; measured sufficient on its own, with real `HOME` unchanged |
| `fallow` | the dead-code gate | ✓ `node_modules/.bin/fallow` | ^3.17.0 | -- |
| Claude Code marketplace clone (`~/.claude/plugins/marketplaces/claude-plugins-official`) | the Q5 census only | ✓ | mtime 2026-09-08; `claude-security` 0.11.0 | the census is machine-local; publish the provenance or drop the figure |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

`.planning/config.json` sets `workflow.nyquist_validation: true`, so this section applies.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (Node >= 20.19.0; CI on Node 24, local v26.8.1) |
| Config file | none -- selection is the `package.json:83` brace glob |
| Quick run command | `node --test tests/architecture/workflows-doc-pins.test.ts tests/architecture/no-stale-test-citations.test.ts` |
| Full suite command | `npm run check` |

**The canary is deliberately outside all of it.** It is a standalone `.mjs` driver, not part of `npm test`, not matched by the unit glob, not typechecked, not linted, not prettier-checked. That is the established shape for `tests/live-uat/`, and criterion 3 already frames the canary run as a HUMAN-UAT item rather than an automated gate.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| WEVID-01 | A recoverable `agent()` failure resolves to `null` at engine 3.10.1 | manual / live-UAT | `PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules node tests/live-uat/workflow-agent-failure-canary.mjs` | ❌ Wave 0 |
| WEVID-01 | The assertion can fail (negative control) | manual / live-UAT | same command `--invert` (expect exit 1), plus the in-run differential control A2 | ❌ Wave 0 |
| WEVID-01 | The canary syntax-checks in CI-adjacent tooling | automated | `node --check tests/live-uat/workflow-agent-failure-canary.mjs` (the pattern `103-04-PLAN.md` / `105-03-PLAN.md` used for the never-landed canary) | ❌ Wave 0 |
| WEVID-02 | The doc names a canary path that resolves on disk | automated | `node --test tests/architecture/no-stale-test-citations.test.ts` | ✅ exists |
| WEVID-02 | The doc's pinned counts and classification table are unmoved by the edit | automated | `node --test tests/architecture/workflows-doc-pins.test.ts` | ✅ exists |
| WDOCS-02 | `105-VERIFICATION.md` carries no site claiming the W1/W2/W3 canary ran | manual (grep) | `grep -n -i "CLOSED\|closed 2026-08-16" <105-VERIFICATION.md>` reviewed by a human | n/a |

### Sampling Rate

- **Per task commit:** `pre-commit run --files <changed>` (which runs `npm run fallow` for any `tests/**/*.mjs` change) + the two named architecture test files.
- **Per wave merge:** `npm test` (the architecture suite is inside it).
- **Phase gate:** `npm run check` green, plus one recorded live canary run (green) and one recorded `--invert` run (red), both with their transcripts pasted into the SUMMARY.

### Wave 0 Gaps

- [ ] `tests/live-uat/workflow-agent-failure-canary.mjs` -- covers WEVID-01. Must carry the `fallow-ignore-file unused-file` marker.
- [ ] `tests/live-uat/README.md` -- a third row in the canary table and a per-canary section, per the file's existing structure. Note the "Needs live `pi`" column: this canary's answer is **no** (engine only), which is new for that table.
- [ ] No framework install needed.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | The canary asserts the *absence* of credentials; it authenticates nothing. |
| V3 Session Management | no | No session. |
| V4 Access Control | **yes** | Containment: refuse to run unless `PI_CODING_AGENT_DIR` is inside `tmp/pi-uat`, mirroring `stop-canary.mjs:191-197` (T-88-08). Without it the canary writes into the operator's real Pi state dir and silently uses their credentials. |
| V5 Input Validation | no | No untrusted input; the workflow scripts are literals in the driver. |
| V6 Cryptography | no | None. |
| V7 Error handling / logging | **yes** | The failure message the engine emits is quoted into the canary's output and may be pasted into a SUMMARY. Measured: it contains only "No API key found for the selected model." plus two doc paths -- no key material. Confirm this before pasting any transcript from a machine whose failure mode differs. |
| V12 Files and resources | **yes** | The canary creates and deletes a sandbox directory; cleanup must run in a `finally` so a failed assertion still removes it (the pattern `stop-canary.mjs` ends with). |
| V14 Configuration | **yes** | NFR-5 / D-98-10: the engine must not enter `package.json` or `package-lock.json`. Verify with `git diff --name-only` at the phase gate. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Canary run against the real `~/.pi/agent` and mutating it | Tampering | `tmp/pi-uat` containment check before anything runs |
| A transcript pasted into a public record leaking a provider key | Information disclosure | Measured: the credential-free failure message carries no key. Re-read any transcript from a differently-configured machine before pasting. |
| Scratch engine's 171 transitive packages running install scripts | Tampering / Elevation | Keep the prefix outside the repository; npm's `allowScripts` policy already gates the three flagged postinstalls (`@google/genai`, `esbuild`, `protobufjs`). Delete the prefix after the run. |
| A grade upgraded on an unrun canary | Repudiation | D-117-02's own rule: if the canary does not run, the row stays `source-read only`. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The recoverable-vs-non-recoverable split described here holds for engine releases other than 3.10.1 | Q2 | Low, and deliberately unclaimed: every grade names 3.10.1. WPIN-01 already tracks the re-read obligation. |
| A2 | `tests/live-uat/workflow-agent-failure-canary.mjs` is the filename the phase will use | Q4 plant, Validation | Naming is at the planner's discretion (D-117-01). Only the citation gate cares, and only that whatever name the doc prints exists. |
| A3 | A verifier's machine can reach npm to create the scratch prefix | Environment | The canary exits 1 with `LIVE ENGINE REQUIRED` rather than passing, so an offline machine routes `human_needed` correctly. |
| A4 | `agentCount: 5` in the pipeline probe (3 pipeline + 2 parallel) reflects the engine's counting, not a leak | Code Examples | Cosmetic; nothing asserts it. |
| A5 | Editing `105-VERIFICATION.md` has no GSD-tooling side effect | Q6 | Phase 105 is archived, so no `phase.complete` recompute targets it. The workstream's `.verification-ledger.json` is untracked and operator-owned; leave it alone. If a digest is recomputed it is over an archived phase nothing gates. |
| A6 | The Claude Code side of the divergence table (`resolves to null`, read from 2.1.251) still holds | Q2 | Re-read verbatim from the binary this session, so this is not really assumed -- but the binary version pinned in the doc (2.1.251) is the one installed here and may differ from a reader's. |

## Open Questions

1. **Does the doc's `@nicknisi/pi-workflows` "throws / runtime-measured" row need a version?**
   - What we know: D-117-02 says two rows must not read identically at different versions. That row carries a bare `**runtime-measured**` with no version at all.
   - What's unclear: whether the rejected engine's row is in this phase's scope.
   - Recommendation: leave it. WEVID-02 names only the chosen engine's claim. If the planner touches it, it is a one-word addition and should be recorded as an incidental correction, not a scope expansion.

2. **Should the census go in the doc at all, given it is machine-local?**
   - What we know: it was measured (Q5), the stated form is wrong, and the source clone has no pinned revision.
   - What's unclear: whether a figure a reader cannot reproduce belongs in a document whose stated rule is "no count without an honest counting rule".
   - Recommendation: publish the *consequence* unconditionally (it follows from the engine's code, not from any census) and publish the figures only with their provenance sentence -- marketplace name, plugin versions, date. The doc already sets that precedent with `read from the 2.1.251 binary`.

3. **Does the phase re-run the storage-canary route as well?**
   - What we know: D-117-01 says no; the deferred-ideas block says a later phase may take it.
   - Recommendation: hold the line. Adding W1/W2/W3 would re-introduce the extension-driving preamble this canary avoids, and with it the duplication question of Pitfall 4.

4. **Where does the negative-control evidence live?**
   - What we know: criterion 2 wants proof the assertion can fail. Two forms exist (in-run differential A2, and `--invert`).
   - Recommendation: A2 ships in the file and runs every time; `--invert` is documented in `tests/live-uat/README.md` and its red transcript is pasted into the SUMMARY. A control that only exists in a SUMMARY rots; a control that only exists in the file is never demonstrated.

## Sources

### Primary (HIGH confidence)

- `@quintinshaw/pi-dynamic-workflows` 3.10.1, installed to `/tmp/wf-engine-117` and read directly: `src/workflow.ts` (`:172`, `:550-559`, `:614-646`, `:649-704`, `:791-792`, `:820`, `:901-905`, `:930-996`, `:1013-1048`, `:1050-1084`, `:1404-1410`, `:1430-1471`, `:1504+`), `src/errors.ts` (`:31-64`, `:118-205`), `src/agent.ts` (`:109-113`, `:127`, `:164-171`, `:830-844`, `:876-890`, `:939-941`, `:1131-1133`), `src/config.ts:15`, `dist/workflow.js:546-576`, `package.json`.
- Runtime measurements driven against that install, 2026-09-09: the failure-branch matrix, the `null`/reject observables, the `pipeline`/`parallel` end-to-end run, the cross-realm prototype finding, the green/red/precondition canary runs. Transcripts quoted above.
- Claude Code 2.1.251 binary (`~/.local/share/claude/versions/2.1.251`), `agent()` API prose, read verbatim by `grep -oaP`.
- This repository, read this session: `docs/workflows-compatibility.md` (esp. `:7-19`, `:101`, `:118-130`, `:132-144`, `:174-181`), `tests/architecture/workflows-doc-pins.test.ts` (full), `tests/architecture/no-stale-test-citations.test.ts` (full), `tests/architecture/unit-suite-glob-completeness.test.ts:79-118`, `tests/architecture/no-shell-out.test.ts:60-100`, `scripts/check-corresponding-tests.mjs:1-40, :136-137`, `tests/live-uat/README.md` (full), `tests/live-uat/stop-canary.mjs:1-60, :170-215, tail`, `.fallowrc.json:1-80, :204-206`, `eslint.config.js:18-24`, `package.json:77-84`, `.pre-commit-config.yaml:1-121`, `105-VERIFICATION.md` (full), `114-VERIFICATION.md:1-30, :71-72`, `REQUIREMENTS.md`, `ROADMAP.md:650-700`, `.planning/WINDOWS.md` (JSON block parsed).
- Gates measured by planting, then reverted: `fallow dead-code` (marker-less `.mjs` -> exit 1), `workflows-doc-pins` + `no-stale-test-citations` (doc rewrite -> only the citation gate fires). `git status --porcelain` confirmed clean afterwards.
- `~/.claude/plugins/marketplaces/claude-plugins-official` -- the seven Anthropic workflow scripts, enumerated and counted.
- npm registry: `npm view @quintinshaw/pi-dynamic-workflows version time repository.url`.

### Secondary (MEDIUM confidence)

- `fallow dupes --fail-on-issues` exit code and clone-group report -- measured on this tree, but fallow's own `--fail-on-issues` semantics for the dupes leg were inferred from the observed exit 0, not read from its documentation.

### Tertiary (LOW confidence)

- None. Nothing in this document rests on a web search or on training memory.

## Metadata

**Confidence breakdown:**

- Engine behavior (the `agent()` split, `pipeline`/`parallel`): **HIGH** -- source read AND driven at run time at 3.10.1, with verbatim transcripts.
- Credential-free reachability: **HIGH** -- driven twice, once with `HOME` scrubbed and once with the real `HOME`, both producing the same result from `PI_CODING_AGENT_DIR` alone.
- Gate impact of the doc edit: **HIGH** -- measured by planting and reverting, not by reading.
- Canary tooling pitfalls (fallow marker, glob, prettier/eslint/tsc scope): **HIGH** -- marker measured by planting; the rest read from the configs with verbatim quotes.
- Duplication gate risk: **MEDIUM** -- exit 0 measured today, but the `dup:<hash>:<n>` key format's stability under a third copy was not directly exercised.
- The census: **HIGH** for the numbers on this machine; **LOW** for their generality (one un-pinned local clone).
- 105 contradiction site list: **HIGH** -- whole file read, plus a repo-wide grep.

**Research date:** 2026-09-09
**Valid until:** 2026-10-09 for the repo-side findings; **7 days** for the engine-side ones -- `@quintinshaw/pi-dynamic-workflows` has shipped ~50 releases since May 2026 and 3.10.1 is six days old. Re-run `npm view ... version` before the canary run and put whatever version the run observes into the grade.
