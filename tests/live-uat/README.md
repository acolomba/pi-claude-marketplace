# Live runtime UAT

The harnesses in this directory verify runtime behavior that the offline suites cannot prove. Each harness is standalone, and `npm run check` does not run any of them. The canaries that start Pi run the version that `package-lock.json` pins, which `npm ci` installs. They find that version through `tests/pi-runtime.ts` and never use a `pi` on `PATH`, so run `npm ci` before you run a canary. Each harness needs a disposable `PI_CODING_AGENT_DIR` sandbox, and some also need a live Pi session with provider credentials. One harness needs a scratch install of the host workflow engine, and its provider credentials must be unreachable on purpose. One harness needs a scratch install of pi-mcp-adapter and no provider key.

| Canary                              | Proves                                                                                                                                                                           | Needs live `pi`                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `stop-canary.mjs`                   | the `agent_settled` Stop dispatcher fire-point (STOP-01, STOP-03, STOP-07)                                                                                                       | yes, for every assertion                                     |
| `manifest-absence-canary.mjs`       | installed plugins survive their manifest entry disappearing; disabled partials read as disabled                                                                                  | only for the optional host smoke                             |
| `workflow-agent-failure-canary.mjs` | the host engine's `agent()` failure observable -- a recoverable failure resolves to `null`, a non-recoverable one rejects (WEVID-01)                                             | no -- it drives the engine, not a Pi session                 |
| `workflow-storage-canary.mjs`       | the envelopes the bridge writes are the envelopes the host engine lists, loads and parses, in both scopes (WSTOR-01)                                                             | no -- it drives the extension and the engine's storage layer |
| `mcp-adapter-canary.mjs`            | pi-mcp-adapter 5.2.0 loads this extension's entries, a legacy entry migrates with the reloads counted, tool search finds the plugin tools, and info shows their status (ADOC-02) | yes, with the keyless stub, which the canary starts itself   |

All five follow the same honesty contract: an unmet precondition or an unobserved assertion exits **non-zero** with a human-readable reason, so the verifier records `human_needed` rather than a silent pass.

## Manifest-absence canary -- `manifest-absence-canary.mjs`

Proves the manifest-independent installed-plugin surface end to end against a real on-disk sandbox. The offline suites pin each surface's byte form against fabricated state; this canary fabricates nothing -- it installs through the extension's own ledger, edits the marketplace manifest on disk, and reads back whatever the surfaces actually render. A record shape no install can produce cannot pass here.

### Run

```bash
mkdir -p tmp/pi-uat/agent
PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent node tests/live-uat/manifest-absence-canary.mjs
```

The harness builds a disposable path-source marketplace with three plugins -- a five-kind plugin whose entry it later drops, a control plugin that stays declared, and a plugin carrying an unsupported component kind so it installs partially -- and **always** uninstalls all three and removes the marketplace afterward, even on failure.

### What it asserts (exit 0 conditions)

**Flow A -- manifest absence.** The manifest stays _valid_; only the entry goes away. That distinction is the point: an unreadable manifest must never be reported as a missing entry, so the canary never corrupts the file.

- **A1** (INV-01..04) -- `list` keeps the record and stamps `{not in manifest}`.
- **A2** (BOUND-03) -- the still-declared control plugin is **not** stamped, proving the reason tracks the entry rather than the read.
- **A3** (INFO-09..11) -- `info` renders from the installation record instead of `(failed)`, and reconstructs the component inventory across all six kinds.
- **A4** (INFO-12) -- `info --fetch` emits the skip note instead of reaching the network.
- **A5** (LIFE-05) -- `update` renders `(skipped) {not in manifest}`.
- **A6** (LIFE-04) -- `uninstall` succeeds, removes the staged artifacts from disk, and drops the record.

**Flow B -- disabled partial.** The fixture installs partially (`compatibility.installable: false`), which is the exact record shape the disabled-state repair was about.

- **B1** (ENBL-05/06) -- `disable` succeeds on a partially installed plugin.
- **B2** (ENBL-06) -- `list` and `info` both render it as `(disabled)`, not as installed.
- **B3** (ENBL-07) -- a second `disable` is idempotent.

### What it routes to `human_needed` (exit non-zero)

**Flow C -- live `pi` host smoke.** Flows A and B drive the extension in-process against real disk, which is where every surface above lives. Flow C adds the one thing in-process cannot establish: that a real host imports the extension and runs its session lifecycle with no extension error escaping the guards NFR-2 places around `resources_discover` and `session_start`. A completed turn is what makes that observable, so the sandbox needs a configured provider; without one `pi` prints `No API key found` and tears down first. The harness prints the proven halves and exits non-zero rather than reading that quiet exit as a pass.

Do **not** substitute an on-disk self-heal probe for the provider. `planReconcile` diffs the declared config against the installation records, not the records against staged artifacts, so an externally deleted artifact is not something reconcile is meant to restore -- a probe built on that assumption reports a false defect.

### Observed result (2026-08-11, pi 0.84.0)

```text
Flow A: A0 baseline, A1, A2, A3, A4, A5, A6 -- all PASS
Flow B: B0 partial-install shape, B1, B2 (list + info), B3 -- all PASS
Flow C: -> human_needed (no configured provider in the sandbox)
exit 1
```

Flows A and B are proven on the real extension against real disk. Flow C is the only residue.

## Engine `agent()` failure canary -- `workflow-agent-failure-canary.mjs`

Proves what the host workflow engine's `agent()` call actually does when the subagent fails (WEVID-01). The offline suites cannot establish this at all: the engine is deliberately in no dependency manifest (NFR-5, D-98-10), so nothing inside `npm run check` can import it, and driving the failure needs the real subagent runner the fixtures avoid. This is the first harness in the table above that drives the **engine** rather than a Pi session, which is why its "Needs live `pi`" answer is `no`.

### Prerequisites

| Requirement                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A scratch install of `@quintinshaw/pi-dynamic-workflows` | `npm install --prefix /var/tmp/wf-engine @quintinshaw/pi-dynamic-workflows@3.13.1`, then point `PI_WORKFLOW_ENGINE_ROOT` at `/var/tmp/wf-engine/node_modules`. The version is pinned because `docs/workflows-compatibility.md` publishes this driver's result as a grade naming 3.13.1; dropping the pin re-measures against whatever is current, which the PASS lines will then name. The prefix must live OUTSIDE this repository and the engine must never enter `package.json` or `package-lock.json` (NFR-5, D-98-10). Do not add `--ignore-scripts`: the engine's peer places a platform binary in a post-install step, so suppressing scripts breaks the import instead of hardening anything. |
| A disposable `PI_CODING_AGENT_DIR` sandbox               | Use `$(pwd)/tmp/pi-uat/wf-agent`. The harness refuses any directory outside `tmp/pi-uat` before it creates anything and before it imports the engine, because the engine writes into whatever agent-state directory it is handed. Both sides of that comparison are resolved first, so a `..` segment does not walk out of the sandbox and a sibling such as `tmp/pi-uat-backup` does not pass as a child.                                                                                                                                                                                                                                                                                            |
| Provider credentials **unreachable** from that sandbox   | This inverts the usual precondition, and saying so outright is the point. The failure inducer is an ABSENCE: with no API key reachable, the real subagent runner throws, and that throw is the thing being measured. A machine whose sandbox can reach a provider measures nothing at all.                                                                                                                                                                                                                                                                                                                                                                                                            |

The private prefix of `scripts/pi.sh` cannot replace this scratch install. The script installs the engine without its peer dependencies, because Pi supplies those to the extensions that it loads. This driver imports the engine outside Pi, so the peer dependencies must be installed.

### Run

```bash
mkdir -p /var/tmp/wf-engine tmp/pi-uat/wf-agent
npm install --prefix /var/tmp/wf-engine @quintinshaw/pi-dynamic-workflows@3.13.1
PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-agent \
PI_WORKFLOW_ENGINE_ROOT=/var/tmp/wf-engine/node_modules \
  node tests/live-uat/workflow-agent-failure-canary.mjs
rm -rf /var/tmp/wf-engine tmp/pi-uat/wf-agent
```

The harness reads the engine version out of the engine's own manifest and prints it in every PASS line, so a transcript dates itself. It creates its own empty child directory beneath the sandbox root and removes it in a `finally`, so a failed assertion still cleans up.

### What it asserts (exit 0 conditions)

- **A0 -- the measurement precondition.** The induced failure actually happened, read off the run's own logs, asserted BEFORE any verdict. Without it a machine with reachable credentials exits 0 having proved nothing (D-117-05).
- **A1 -- the measurement** (WEVID-01, D-117-04). A recoverable `agent()` failure resolves to `null`. It asserts the OBSERVABLE a script author experiences, never which internal branch ran; an assertion on the branch would only restate a source read.
- **A2 -- the differential control**, always on and never behind a flag. The same call one option apart, with a model specification that resolves to nothing, REJECTS with `MODEL_NOT_FOUND`. Two assertions in one run that disagree by design are what prove the harness discriminates rather than reporting whatever it sees. This is the only assertion here that names an error code.
- **A3 -- the upstream fan-out pattern, end to end.** Three failing calls through the engine's own pipeline helper return three rows, none of which survives `.filter(Boolean)`, and the run completes. That it completes at all is part of the observation.

### What it routes to `human_needed` (exit non-zero)

- **No engine.** `PI_WORKFLOW_ENGINE_ROOT` unset, or the engine's manifest unreadable beneath it. Prints `LIVE ENGINE REQUIRED` with the scratch-install route.
- **A non-sandbox agent directory.** Refused before anything is created and before the engine is imported. The check resolves the supplied path and requires it to be `tmp/pi-uat` itself or a child of it, so a traversal segment is refused rather than followed.
- **A call whose failure was not observed.** Prints `NOTHING WAS MEASURED`, which is what the missing marker actually supports: no log line named it. The message then branches on the logs, because they discriminate. No logs at all is the shape a _successful_ call produces, so the sandbox most likely reached a provider. Logs that name something else say the engine ran and used different words -- check its error vocabulary before concluding anything about the machine. Either way no verdict about the engine can be read from that run, and neither reading is an engine regression.

### The negative control

`--invert` flips A1's expectation and nothing else, so a green run means something:

```bash
PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-agent \
PI_WORKFLOW_ENGINE_ROOT=/var/tmp/wf-engine/node_modules \
  node tests/live-uat/workflow-agent-failure-canary.mjs --invert
```

Expect exit 1 naming A1. A0 still PASSES on that run, which is exactly the discrimination the control is for: the failure was induced, and only the verdict disagreed.

### Not here, deliberately

The storage assertions (`W0`-`W5`, the envelope listing and round trip) live in `workflow-storage-canary.mjs` below, not in this harness. This canary carries only the `agent()` assertions WEVID-01 names.

### Observed result (2026-10-02, engine 3.13.1, pi 1.0.0)

The scratch prefix held engine 3.13.1, and its `@earendil-works/pi-coding-agent` peer resolved to 1.0.0. The run used `TMPDIR=/var/tmp/mcp4-uat`. The canary's output, verbatim, with the exit status appended by the shell:

```text
[wf-agent-canary] engine 3.13.1
[wf-agent-canary] PASS: A0: the agent call failed as induced, so this run measured something (engine 3.13.1)
[wf-agent-canary] PASS: A1: a recoverable agent() failure resolves to null (engine 3.13.1)
[wf-agent-canary] PASS: A2: a non-recoverable agent() failure rejects MODEL_NOT_FOUND (engine 3.13.1)
[wf-agent-canary] PASS: A3: three fanned-out failures return 3 rows, 0 survive the truthiness filter, and the run completes (engine 3.13.1)
EXIT=0
```

All four assertions are proven against a real engine in a credential-free sandbox: at 3.10.1 on 2026-09-09, at 3.13.0 on 2026-09-21, and at 3.13.1 on 2026-10-02, with the same lines apart from the version. The `--invert` control ran at 3.13.1 on the same prefix. It failed at A1 and exited 1, after A0 passed:

```text
[wf-agent-canary] engine 3.13.1
[wf-agent-canary] PASS: A0: the agent call failed as induced, so this run measured something (engine 3.13.1)

[wf-agent-canary] FAILED:
AssertionError [ERR_ASSERTION]: A1: a recoverable agent() failure did not produce the expected observable at engine 3.13.1.
+ actual - expected

  {
+   isNull: true,
-   isNull: false,
    kind: 'resolved'
  }

    at main (file:///home/acolomba/src/pi-claude-marketplace-mcp-4/tests/live-uat/workflow-agent-failure-canary.mjs:177:12)
    at async file:///home/acolomba/src/pi-claude-marketplace-mcp-4/tests/live-uat/workflow-agent-failure-canary.mjs:240:3
EXIT=1
```

The planted A0 control (an empty log collection, the shape a successful call produces) ran at 3.10.1 and 3.13.0 and exited 1 with `NOTHING WAS MEASURED`. It was not repeated at 3.13.1.

## Engine storage canary -- `workflow-storage-canary.mjs`

Proves that the envelopes this extension writes are the envelopes the host workflow engine reads (WSTOR-01). The offline suites pin the bytes the bridge writes against a layout read out of the engine's source; this driver installs a workflow-bearing plugin through the extension's own `/claude:plugin` handler into a scratch sandbox, then reads it back through the **engine's** public entry -- `createWorkflowStorage`, `parseWorkflowScript`, `workflowUserSavedDir`, `workflowProjectPaths` -- resolved out of the same scratch install the agent-failure canary uses. A layout the engine moved shows up as a listing that comes back empty, which is exactly the failure nothing inside `npm run check` can see.

Nothing is run: no subagent starts, so no provider credentials are needed in either direction.

### Prerequisites

| Requirement                                              | Notes                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A scratch install of `@quintinshaw/pi-dynamic-workflows` | The same route as the agent-failure canary. Pin the version you mean to publish a grade for; the driver reads the version out of the engine's own manifest and prints it in every PASS line. Keep the prefix on a real filesystem -- a tmpfs `/tmp` that is out of inodes fails the install with `ENOSPC`.        |
| A disposable `PI_CODING_AGENT_DIR` sandbox               | Use `$(pwd)/tmp/pi-uat/wf-store`. The driver refuses any directory outside `tmp/pi-uat` before it creates anything. It then points `HOME` and `PI_CODING_AGENT_DIR` at fresh children of this directory before either side is imported, because both the bridge and the engine derive the storage root from them. |

### Run

```bash
mkdir -p /var/tmp/wf-engine tmp/pi-uat/wf-store
npm install --prefix /var/tmp/wf-engine @quintinshaw/pi-dynamic-workflows@3.14.0
PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-store \
PI_WORKFLOW_ENGINE_ROOT=/var/tmp/wf-engine/node_modules \
  node tests/live-uat/workflow-storage-canary.mjs
PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-store \
PI_WORKFLOW_ENGINE_ROOT=/var/tmp/wf-engine/node_modules \
  node tests/live-uat/workflow-storage-canary.mjs --home-default
rm -rf /var/tmp/wf-engine tmp/pi-uat/wf-store
```

The fixture is one plugin with four scripts: two the engine loads (one with a `meta.name` that repeats the plugin prefix, so the envelope name is the elided form while the script keeps the full one), and two it refuses at first run (no `meta.description`; a statement before the `meta` export). Both scopes are driven in turn, and the plugin is always uninstalled and the marketplace removed afterward.

The first run roots storage under `PI_CODING_AGENT_DIR`, which the driver points at a child of the sandbox. The second run, with `--home-default`, clears that variable after the sandbox check, so both sides root storage under `HOME`. Engine releases before 3.14.0 ignore `PI_CODING_AGENT_DIR`, so against them only the second run passes W0.

### What it asserts (exit 0 conditions)

- **W0 -- the precondition.** The bridge's `workflowsSavedDir` equals the engine's `workflowUserSavedDir()` and `workflowProjectPaths(cwd).savedDir` under the same `HOME` and `PI_CODING_AGENT_DIR`. Without it, an empty listing in W1 would be a root mismatch rather than the engine moving its storage.
- **W1** -- the engine's own `list()` reports every admitted script under its generated name, in the tier the scope maps to (`user` or `project`), read off the row's `source` field rather than inferred from a path.
- **W2** -- `load(name)` round-trips every envelope, and the script bytes are the plugin's source bytes, unchanged. This is the verbatim promise measured on the engine's side.
- **W3** -- the engine's `parseWorkflowScript` admits the two loadable scripts and refuses the other two with the messages its checks 9 and 3 raise.
- **W4** -- the install output named check 9 and check 3 for those same two files, so the admit-versus-run divergence is paired on both sides from one run.
- **W5** -- after `uninstall`, the engine's listing is empty.

### What it routes to `human_needed` (exit non-zero)

- **No engine.** `PI_WORKFLOW_ENGINE_ROOT` unset, or the engine's manifest unreadable beneath it. Prints `LIVE ENGINE REQUIRED`.
- **A non-sandbox agent directory.** Refused on the resolved path before anything is created, because `HOME` and `PI_CODING_AGENT_DIR` are about to be rewritten to children of it.

### The negative control

`--invert` flips W2's byte-identity expectation and nothing else:

```bash
PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-store \
PI_WORKFLOW_ENGINE_ROOT=/var/tmp/wf-engine/node_modules \
  node tests/live-uat/workflow-storage-canary.mjs --invert
```

Expect exit 1 naming `[user] W2`, after W0 and `[user] W1` have passed.

### Observed result (2026-10-06, engine 3.14.0)

```text
[wf-storage-canary] engine 3.14.0, storage root from PI_CODING_AGENT_DIR
[wf-storage-canary] PASS: W0: the bridge and the engine derive the same saved directories for both scopes from PI_CODING_AGENT_DIR (engine 3.14.0)
[wf-storage-canary] PASS: [user] W1: the engine lists all 4 envelopes in its user tier (engine 3.14.0)
[wf-storage-canary] PASS: [user] W2: load() returns every envelope with byte-identical script source (engine 3.14.0)
[wf-storage-canary] PASS: [user] W3: the engine's parser admits 2 scripts and refuses 2 at the checks the install warned about (engine 3.14.0)
[wf-storage-canary] PASS: [user] W4: the install named check 9 and check 3 for the scripts the engine refuses at them (engine 3.14.0)
[wf-storage-canary] PASS: [user] W5: uninstall leaves the engine's listing empty (engine 3.14.0)
[wf-storage-canary] PASS: [project] W1: the engine lists all 4 envelopes in its project tier (engine 3.14.0)
[wf-storage-canary] PASS: [project] W2: load() returns every envelope with byte-identical script source (engine 3.14.0)
[wf-storage-canary] PASS: [project] W3: the engine's parser admits 2 scripts and refuses 2 at the checks the install warned about (engine 3.14.0)
[wf-storage-canary] PASS: [project] W4: the install named check 9 and check 3 for the scripts the engine refuses at them (engine 3.14.0)
[wf-storage-canary] PASS: [project] W5: uninstall leaves the engine's listing empty (engine 3.14.0)
[wf-storage-canary] all assertions proven; exit 0
```

The `--home-default` run printed the same lines with `from HOME` in place of `from PI_CODING_AGENT_DIR`, and it exited 0. Three controls exited 1:

- `--invert` failed at `[user] W2`.
- Against engine 3.14.0, the bridge from before it followed `PI_CODING_AGENT_DIR` failed W0. It rooted storage under `HOME`, and the engine rooted it under the agent directory.
- Against engine 3.13.0, the run without `--home-default` failed W0, because that release ignores `PI_CODING_AGENT_DIR`. The `--home-default` run against 3.13.0 passed.

The sandbox was empty afterward.

### Observed result (2026-10-02, engine 3.13.1, pi 1.0.0)

The same scratch prefix as the agent-failure canary: engine 3.13.1, with its `@earendil-works/pi-coding-agent` peer at 1.0.0. The run used `TMPDIR=/var/tmp/mcp4-uat`. The canary's output, verbatim, with the exit status appended by the shell:

```text
[wf-storage-canary] engine 3.13.1
[wf-storage-canary] PASS: W0: the bridge and the engine derive the same saved directories for both scopes (engine 3.13.1)
[wf-storage-canary] PASS: [user] W1: the engine lists all 4 envelopes in its user tier (engine 3.13.1)
[wf-storage-canary] PASS: [user] W2: load() returns every envelope with byte-identical script source (engine 3.13.1)
[wf-storage-canary] PASS: [user] W3: the engine's parser admits 2 scripts and refuses 2 at the checks the install warned about (engine 3.13.1)
[wf-storage-canary] PASS: [user] W4: the install named check 9 and check 3 for the scripts the engine refuses at them (engine 3.13.1)
[wf-storage-canary] PASS: [user] W5: uninstall leaves the engine's listing empty (engine 3.13.1)
[wf-storage-canary] PASS: [project] W1: the engine lists all 4 envelopes in its project tier (engine 3.13.1)
[wf-storage-canary] PASS: [project] W2: load() returns every envelope with byte-identical script source (engine 3.13.1)
[wf-storage-canary] PASS: [project] W3: the engine's parser admits 2 scripts and refuses 2 at the checks the install warned about (engine 3.13.1)
[wf-storage-canary] PASS: [project] W4: the install named check 9 and check 3 for the scripts the engine refuses at them (engine 3.13.1)
[wf-storage-canary] PASS: [project] W5: uninstall leaves the engine's listing empty (engine 3.13.1)
[wf-storage-canary] all assertions proven; exit 0
EXIT=0
```

Two controls ran at 3.13.1 and exited 1. `--invert` failed at `[user] W2`, after W0 and `[user] W1` passed:

```text
[wf-storage-canary] engine 3.13.1
[wf-storage-canary] PASS: W0: the bridge and the engine derive the same saved directories for both scopes (engine 3.13.1)
[wf-storage-canary] PASS: [user] W1: the engine lists all 4 envelopes in its user tier (engine 3.13.1)

[wf-storage-canary] FAIL: [user] W2: the script bytes the engine loads for acme:audit are not the plugin's source bytes at engine 3.13.1.

true !== false

EXIT=1
```

With `PI_WORKFLOW_ENGINE_ROOT` unset, the canary routed to `LIVE ENGINE REQUIRED`:

```text

[wf-storage-canary] LIVE ENGINE REQUIRED: PI_WORKFLOW_ENGINE_ROOT is unset.
  It must name the node_modules of a scratch install of the engine.

See tests/live-uat/README.md for the scratch-install route.
EXIT=1
```

The third control, a `PI_CODING_AGENT_DIR` outside the sandbox, ran at 3.13.0 and routed to `LIVE ENGINE REQUIRED`. It was not repeated at 3.13.1. The sandbox was empty after the 3.13.1 runs.

## Stop contract canary -- `stop-canary.mjs`

Live-Pi verification for the `agent_settled` Stop dispatcher (STOP-01, STOP-03, STOP-07). The mocked settle tests under `tests/bridges/hooks/` prove the dispatcher logic offline; this canary proves the settle **fire-point** on a real Pi runtime, which no fake `pi` can establish.

It has two halves:

- A **scripted canary** that drives a real Pi session and autonomously asserts what a headless drive can observe: `agent_settled` dispatch and block re-entry.
- A **human verification checklist** (below) for the runtime timing / interrupt questions a headless drive cannot sustain -- the verifier routes these `human_needed` rather than passing them silently.

### Prerequisites

| Requirement                                | Notes                                                                                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The repository's Pi, >= 1.0.0              | `npm ci` installs it from the `@earendil-works/pi-coding-agent` devDependency. 1.0.0 is the package peer floor. `agent_settled` first appeared in 0.80.5. The earlier canary run used 0.80.10.                                          |
| A disposable `PI_CODING_AGENT_DIR` sandbox | Use `$(pwd)/tmp/pi-uat/agent`. The harness refuses to run against any dir outside `tmp/pi-uat` (T-88-08) so the always-block canary never churns a real Pi state dir.                                                                   |
| A working default provider in the sandbox  | The sandbox's `settings.json` selects the provider/model; a real turn must reach it. `--offline` disables only Pi's _startup_ network ops (marketplace autoupdate), not the model call. The keyless stub route below needs no real key. |

**Keyless stub route.** `tests/live-uat/openai-stub-server.mjs` is a local OpenAI-compatible stub. Without `STUB_SCRIPT`, it answers every chat completion with the text `ready`, so no real provider key is involved. This canary relies on that default. If you set `STUB_SCRIPT` to a JSON file, the stub replays scripted tool calls instead. It picks the script by a marker in the last user message. `mcp-adapter-canary.mjs` uses this mode. The stub listens on `127.0.0.1` only, on `STUB_PORT` (default 18787). `STUB_PORT=0` binds a free port, and the startup line names that port. If you set `STUB_HTTP_LOG`, it appends one line per request to that file: the time, the URL, the `stream` flag and the requested tool names. It never logs headers. Two sandbox files point Pi at it.

`tmp/pi-uat/agent/models.json`:

```json
{"providers":{"stubllm":{"baseUrl":"http://127.0.0.1:18787/v1","api":"openai-completions","apiKey":"stub","models":[{"id":"stub"}]}}}
```

`tmp/pi-uat/agent/settings.json`:

```json
{"defaultProvider":"stubllm","defaultModel":"stub"}
```

### The scripted canary

#### Run

```bash
mkdir -p tmp/pi-uat/agent   # then write the two sandbox files above
STUB_HTTP_LOG=/var/tmp/stub-http.log node tests/live-uat/openai-stub-server.mjs &
PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent node tests/live-uat/stop-canary.mjs
kill %1
rm -rf tmp/pi-uat/agent
```

The harness:

1. Verifies the live-pi + sandbox preconditions (refuses non-sandbox dirs).
2. Builds a disposable path-source marketplace carrying a Stop-only "ralph-loop" plugin whose Stop hook **always** returns `{"decision":"block","reason":"keep going"}` and appends one line to a marker file per invocation.
3. Installs it into the sandbox (user scope) through the extension's own `/claude:plugin` machinery.
4. Drives a real `pi -p --mode json --no-tools --offline` turn and reads the marker file, the JSON lifecycle event stream and the exit status of the `pi` process.
5. **Always uninstalls the canary and removes the marketplace afterward** (the sandbox is left clean even on failure).

#### What it asserts (exit 0 conditions for the scriptable half)

- **STOP-01** -- `agent_settled` fires and dispatches the Stop bucket end-to-end (`agent_settled` event present AND the Stop hook fired at least once).
- **STOP-03** -- block re-entry starts a new turn: two `turn_start` events for a single user prompt (the documented extra-turn-boundary divergence).
- **STOP-07 bound** -- the run ends normally at exactly 8 blocks, with one `agent_settled` per block. A normal end means that `pi` exits with code 0, without a signal, before the 120-second harness timeout. The harness reads the exit status of the child process. It does not infer the status from the timeout.

Exit 0 also needs the cap-trip warning, which a headless run cannot show. So a healthy headless run exits 1 (see below).

#### What it routes to `human_needed` (exit non-zero)

- **STOP-07 cap-trip warning (the expected headless result, exit 1)** -- since Pi 0.87 a one-shot `pi -p` drives the settle→block→re-enter loop itself: a run requested from an `agent_settled` handler is deferred until the settle handlers finish and is then awaited. The loop reaches the 8-consecutive-block cap headless, and the harness checks the bound above. The cap-trip warning goes through `ctx.ui.notify`, which does nothing in print/json mode, so the harness cannot see it. It prints the proven half, then exits 1 with a `SCRIPTABLE HALF PROVEN, cap-trip warning -> human_needed` message. Confirm the cap-trip warning interactively per **item 4** below.

- **The cap check.** The harness compares the block count and the way the run ended against the cap, in this order:

  | Observed                                                             | Result                                     | Exit |
  | -------------------------------------------------------------------- | ------------------------------------------ | ---- |
  | More than 8 blocks, whether or not the run ended                     | `STOP-07 REGRESSION -- failed:`            | 2    |
  | Exactly 8 blocks, and the run did not end normally                   | `STOP-07 REGRESSION -- failed:`            | 2    |
  | Fewer than 8 blocks, and the run did not end normally (inconclusive) | `LIVE RUNTIME REQUIRED`                    | 1    |
  | Fewer than 8 blocks after a normal end                               | `STOP-07 REGRESSION -- failed:`            | 2    |
  | Exactly 8 blocks after a normal end                                  | goes on to the `agent_settled` check below | --   |

  "Did not end normally" means that the drive was still running at the timeout, or that `pi` exited with another code or a signal. The message states which one it saw. It does not name a cause: at exactly 8 blocks, the count cannot show whether the cap failed to end the run or re-entry went on past the cap.

- **`agent_settled` count.** A run that passes the cap check must show one `agent_settled` per block. Any other count is a `STOP-07 REGRESSION`, exit 2.

- If a precondition is not met, the harness exits 1 with a `LIVE RUNTIME REQUIRED` message. The preconditions are: the Pi package is installed (run `npm ci`), its version is 1.0.0 or later, and `PI_CODING_AGENT_DIR` is inside `tmp/pi-uat`.

Exit 2 is kept apart from exit 1 on purpose. A script that reads only the exit code can then tell a broken bound from the expected headless result.

The harness **never fakes a live result**: it exits non-zero rather than reporting a warning it could not observe, so the verifier records `human_needed`.

#### Observed result (2026-07-31, pi 0.80.10)

Openai-codex provider, sandbox `tmp/pi-uat/agent`. Summary of the observed run (not a verbatim transcript -- see `stop-canary.mjs` for the exact output formats):

```text
blocks=1, agent_settled=1, turn_start=2, cap=8, capWarning=false
PASS STOP-01: agent_settled dispatched the Stop bucket end-to-end
PASS STOP-03: block re-entry started a second turn for one prompt
-> CAP LOOP routed to human_needed (headless pi does not sustain the loop)
exit 1
```

STOP-01 and STOP-03 are proven on real Pi. STOP-07's cap loop is item 4 in the human checklist.

#### Observed result (2026-10-02, pi 1.0.0)

Provider: the keyless stub `tests/live-uat/openai-stub-server.mjs` on `127.0.0.1:18787`, selected by the two sandbox files from the Prerequisites section. No real provider key was used. Sandbox `tmp/pi-uat/agent`, `TMPDIR=/var/tmp/mcp4-uat`. The stub logged 8 chat-completion requests, one per turn. The canary's full output from this run, verbatim, with the exit status appended by the shell:

```text
[stop-canary] PASS: live pi 1.0.0 (/home/acolomba/src/pi-claude-marketplace-mcp-4/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js) >= 1.0.0, sandbox /home/acolomba/src/pi-claude-marketplace-mcp-4/tmp/pi-uat/agent
[stop-canary] PASS: canary installed (ralph-loop@stop-canary-mkt, hooks: ralph-loop)
[stop-canary] observed: Stop-hook blocks=8, agent_settled=8, turn_start=8, cap=8, capWarning=false.
[stop-canary] drive: pi exited with code 0.
[stop-canary] PASS: STOP-01: agent_settled fired and dispatched the Stop bucket end-to-end (stopReason "stop").
[stop-canary] PASS: STOP-03: block re-entry proven -- the always-block Stop hook re-entered the agent loop (8 turns for one prompt; the expected extra-turn-boundary divergence).

[stop-canary] SCRIPTABLE HALF PROVEN, cap-trip warning -> human_needed:
  agent_settled dispatched the Stop bucket and block re-entry started a new turn (proven above).
  Headless `pi` observed 8 block(s) against the 8-block override cap.
  Since Pi 0.87 a headless run drives the settle->block->re-enter loop itself, because runs
  requested from agent_settled handlers are deferred and then awaited.
  The cap-trip warning goes through ctx.ui.notify, which does nothing in print/json mode, so
  this harness cannot see it.

Confirm the cap-trip warning interactively per tests/live-uat/README.md (Human verification, item 4).
STOP_EXIT=1
```

The run exited 1 through the `cap-trip warning -> human_needed` routing. The loop stopped at exactly 8 blocks with one `agent_settled` and one `turn_start` per block, and `pi` exited with code 0, so the cap bounds the loop (T-88-02). `capWarning=false` because print/json mode replaces `ctx.ui.notify` with a no-op. The STOP-07 warning stays item 4 in the human checklist.

The two negative controls ran on the same tree. Each exited 1 with `LIVE RUNTIME REQUIRED`:

- `PI_CODING_AGENT_DIR` unset: `PI_CODING_AGENT_DIR is unset.`
- `PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/../../.pi/agent`: refused, because it resolves to `.pi/agent`, which is outside `tmp/pi-uat`.

A third control proved the regression exit. A temporary copy of the canary with the cap constant set to 7 saw the same 8 blocks, printed `STOP-07 REGRESSION -- failed:` and `the always-block canary spun to 8 blocks, past the 7 cap (pi exited with code 0).`, and exited 2. The copy was then deleted.

### Real-plugin run -- `ralph-loop@claude-plugins-official`

Observed 2026-07-31, pi 0.80.10, openai-codex provider, sandbox `tmp/pi-uat/agent`, project dir `tmp/work`. Unlike the scripted canary (which carries a synthetic always-block hook), this run exercised the **unmodified upstream plugin** -- `stop-hook.sh` and `setup-ralph-loop.sh` byte-for-byte from `claude-plugins-official` -- installed through `/claude:plugin bootstrap` + `install ralph-loop@claude-plugins-official` + `/reload`, with the command registering as `/ralph-loop:ralph-loop`.

Task given (interactive session):

```text
/ralph-loop:ralph-loop Append one line "iteration done" to ralph-canary.txt (create it if missing). If the file now has 3 or more lines, output <promise>COUNTER COMPLETE</promise> and stop adding lines. --max-iterations 5 --completion-promise "COUNTER COMPLETE"
```

Observed sequence (summary from the session JSONL, not a verbatim transcript): the setup script activated the loop (iteration 1, max 5); turns 1 and 2 each appended a line and settled into a Stop block, each re-entering via a `claude-hook-stop-block` injected turn; turn 3 appended the third line and ended with `<promise>COUNTER COMPLETE</promise>` as its final text; on that settle the hook matched the promise, removed `.claude/ralph-loop.local.md`, and allowed the stop. Final state: `ralph-canary.txt` with exactly 3 lines, empty `.claude/`, 2 block re-entries total, no cap warning.

What this proves beyond the scripted canary:

- The upstream block-to-continue contract holds against the real script, including its state-file iteration bookkeeping (the `session_id` guard falls through because `CLAUDE_CODE_SESSION_ID` is unset under Pi, preserving legacy behavior).
- `transcript_path` (Pi's live session JSONL) is **parseable by the upstream extractor**: the per-line `.message.content[]` shape with `"role":"assistant"` satisfies the script's `grep` + `jq` pipeline, so completion-promise detection terminates the loop exactly as on Claude Code -- the loop ended by promise, not by its `--max-iterations` fallback.
- Empty-text assistant lines (tool-call turns) are tolerated by the script's `last // ""` guard.

### Human verification checklist

A headless `pi -p` drive on Pi 1.0.0 reaches the 8-block cap (8 blocks, pi exit 0; see the Stop contract canary above), but it cannot show the cap-trip warning or the interrupt and queued-message timing below. These items require a **human at an interactive `pi` session**. Each item below is an explicit `human_needed` verification: record the observed result against the expected result; a mismatch is a STOP-01 / STOP-07 regression.

**Interactive setup** (shared by all items):

```bash
export PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent
export PI_CLAUDE_MARKETPLACE_DEBUG=1   # emit [hooks] dispatch logs on stderr
pi_cli=$(node --input-type=module -e 'import { pathToFileURL } from "node:url"; const { resolvePiRuntime } = await import(pathToFileURL(process.argv[1]).href); process.stdout.write(resolvePiRuntime(process.cwd()).cliPath);' ./tests/pi-runtime.ts)
node "$pi_cli" --no-extensions \
   --extension "$(pwd)/extensions/pi-claude-marketplace/index.ts" \
   --offline
```

Do NOT pass `--mode json` here: it is a non-interactive output mode (it prints the session header and exits on a TTY), so it cannot host these checklist items. Read the runtime evidence from the session JSONL (under `PI_CODING_AGENT_SESSION_DIR`, which records each assistant message's `stopReason`) and from the observing hook's `stdin.log`.

For items that need an installed Stop hook, install a Stop-only plugin whose hook logs its received stdin and echoes a decision. A minimal observing hook:

```bash
#!/usr/bin/env bash
# stop-observe.sh -- log stdin (carries stop_hook_active) then decide.
cat >> /tmp/stop-uat/stdin.log
echo >> /tmp/stop-uat/stdin.log
# For the always-block canary, uncomment the next line:
# printf '%s' '{"decision":"block","reason":"keep going"}'
```

#### Item 1 -- abort mid-tool-call does NOT fire Stop (STOP-01)

- **Repro:** In an interactive session, start a turn that calls a slow tool (e.g. ask the model to run `bash -c 'sleep 30'`). While the tool is running, interrupt the turn (the Pi interrupt key). Watch the session JSONL and the `[hooks]` debug log.
- **Expected:** the final assistant message carries `stopReason: "aborted"`; the settle gate maps `aborted` → **neither** Stop nor StopFailure, so **no** Stop/StopFailure hook fires (no `stop-observe.sh` invocation, no marker). Pi's provider contract says every interrupt path surfaces a final assistant message with `stopReason: "aborted"`.
- **Failure signature:** a Stop (or StopFailure) hook fires after an abort, OR the final message's `stopReason` is not `"aborted"` on some interrupt path (e.g. interrupting exactly at the tool-result boundary). Record which interrupt paths, if any, do not carry `"aborted"`.

#### Item 2 -- settle timing with queued user messages (STOP-01)

- **Repro:** Start a turn, then while it is still running submit a **second** user message so it queues. Let both drain. Count `agent_settled` events and Stop hook firings in the session JSONL / `[hooks]` log.
- **Expected:** upstream Claude fires `Stop` once per response; Pi's `agent_settled` fires **once, after the queue fully drains** (no automatic retry / compaction / queued continuation remains), so exactly **one** settle-time Stop dispatch for the whole drained sequence.
- **Failure signature:** `agent_settled` (and the Stop dispatch) fires mid-queue before the drain, or fires more than once for a single logical completion. Document any per-response vs per-settle divergence from the upstream cadence.

#### Item 3 -- re-entry does NOT self-clear `stop_hook_active` (STOP-07)

- **Repro:** Install the always-block canary (the `stop-observe.sh` above with the `block` line uncommented, logging stdin). Send one prompt and let the block re-enter at least twice. Inspect `stop-observe.sh`'s `stdin.log`: read the `stop_hook_active` field of each consecutive Stop payload. Then submit a **genuine** new user prompt.
- **Expected:** the bridge's re-entry uses `sendMessage(customType: "claude-hook-stop-block", display: false, …)`, which does **not** pass through the `input` event -- so `stop_hook_active` stays `true` across every consecutive re-entry (the 2nd+ Stop payloads show `"stop_hook_active": true`). Only the genuine user prompt fires `input`, which clears the flag (the next Stop payload after it shows `"stop_hook_active": false`).
- **Failure signature:** the 2nd consecutive Stop payload shows `"stop_hook_active": false` (the injected re-entry self-cleared the flag via a stray `input`), or a genuine user prompt fails to clear it.

#### Item 4 -- the 8-consecutive-block override cap (STOP-07)

- **Repro:** Install the always-block canary. In an **interactive** session (a real TTY -- a headless `pi -p` run reaches the cap, but only an interactive session shows the cap-trip warning), send one prompt and let the always-block hook drive the re-entry loop with no further input.
- **Expected:** the loop runs settle → block → re-enter for 8 consecutive blocks; the **8th** block is suppressed (no re-entry), the turn ends, and the warning surfaces **exactly once**: `Stop hook override cap reached.` followed by the detail naming the plugin (`… blocked 8 times in a row; the turn ended despite its active block.`). The marker/`stdin.log` shows exactly 8 block invocations, then the run goes idle (no livelock).
- **Failure signature:** the marker shows more than 8 blocks (the cap did not bound the livelock -- a T-88-02 regression), the warning is missing or fires more than once, or the run never terminates.

## MCP adapter canary -- `mcp-adapter-canary.mjs`

Proves that a real pi-mcp-adapter loads the MCP server entries that this extension writes to `mcp-adapter.json` (ADOC-02). The offline suites check the entries that the extension writes. Only a live adapter can show that the adapter reads those entries, starts the servers, and gives their tools to the model. The canary drives a real Pi over its RPC mode (JSON commands on stdin, JSON events on stdout). Pi loads this extension, pi-mcp-adapter 5.2.0, and a small helper extension that the canary writes into its sandbox. The model is the keyless stub, which replays scripted tool calls.

### Prerequisites

| Requirement                               | Notes                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The repository's Pi, 1.0.0 or later       | `npm ci` installs it from the `@earendil-works/pi-coding-agent` devDependency. The canary finds it through `tests/pi-runtime.ts`.                                                                                                                                                                                                                                   |
| A scratch install of pi-mcp-adapter 5.2.0 | Run `npm install --prefix /var/tmp/mcp-adapter-520 pi-mcp-adapter@5.2.0 --ignore-scripts --omit=peer --no-audit --no-fund`, then set `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp-adapter-520/node_modules/pi-mcp-adapter`. Keep the prefix outside this repository. The adapter must never enter `package.json` or `package-lock.json`. The canary refuses any other version. |
| `TMPDIR` outside the repository           | Use a directory on a real filesystem, such as `/var/tmp/mcp-adapter-canary`. The canary makes its sandbox there and removes it on every exit, also after Ctrl-C or `SIGTERM`. It refuses a temp directory inside the repository, because Pi asks for project trust there.                                                                                           |
| No provider key                           | The canary starts the stub on `127.0.0.1` itself. Each Pi child gets an environment that the canary builds from scratch, so no inherited variable reaches Pi.                                                                                                                                                                                                       |

### Run

```bash
mkdir -p /var/tmp/mcp-adapter-canary
npm install --prefix /var/tmp/mcp-adapter-520 pi-mcp-adapter@5.2.0 \
  --ignore-scripts --omit=peer --no-audit --no-fund
PI_MCP_ADAPTER_ROOT=/var/tmp/mcp-adapter-520/node_modules/pi-mcp-adapter \
TMPDIR=/var/tmp/mcp-adapter-canary \
  node tests/live-uat/mcp-adapter-canary.mjs
echo "EXIT=$?"
```

The canary runs five Pi sessions in one sandbox:

1. Session 1 loads the legacy files from the fixture, installs `ping`, and reloads Pi until the adapter serves the new keys.
2. Session 2 is a fresh Pi process for route A, which finds the tool with `mcp({ search })`.
3. Session 3 is a fresh Pi process for route B, which finds the tool with Pi's `tool_search`. Route B needs its own process. `tool_search` searches only tools that are not active, and route A activated the tool in session 2.
4. Two short probe sessions start Pi with `--no-extensions`, one of them with `-e builtin:tool-search`.

### What it asserts (exit 0 conditions)

- **M0** -- the preconditions: the repository's Pi is 1.0.0 or later, `PI_MCP_ADAPTER_ROOT` holds pi-mcp-adapter 5.2.0, and `TMPDIR` is outside the repository.
- **M1** (AMIG-03) -- the migration notice lists `echo -> plugin_echo_echo_ (echo) [user]`.
- **M2** (AMIG-03, ASTAT-02) -- before any reload, the adapter still lists the old name `echo`, and info shows `(not loaded)`.
- **M3** (AMIG-01, ANAME-01, ANAME-04) -- `mcp.json` keeps no entry with this extension's marker, and `mcp-adapter.json` holds `plugin_echo_echo_` with `toolPrefix: "mcp"` and `directTools: "search"`.
- **I1** (AFILE-01) -- `ping`, installed fresh in session 1, is written to `mcp-adapter.json` as `plugin_ping_ping_`.
- **M4** (AMIG-03, ASTAT-01, AFILE-01) -- exactly one reload makes both keys live in the adapter and removes `echo`. Info shows the status that the adapter reports for each plugin.
- **A1** (ASTAT-02) -- in the route A session, info shows `(status unknown)` before any MCP use.
- **A2** (ANAME-01, ANAME-04) -- `mcp({ search })` returns `mcp__plugin_echo_echo__echo_canary` on `plugin_echo_echo_`. The first model request does not declare the tool, and a later request does.
- **A3** (ADOC-02) -- the call returns `echo-canary:hi`.
- **A4** (ASTAT-01) -- the adapter reports `plugin_echo_echo_` as connected, and info shows `(connected)`.
- **B1** (ASTAT-02) -- in the route B session, info shows `(status unknown)` before any MCP use.
- **B2** (ANAME-01, ANAME-04) -- `tool_search` loads `mcp__plugin_echo_echo__echo_canary`. The first model request declares `tool_search` and not the plugin tool, and a later request declares the plugin tool.
- **B3** (ADOC-02) -- the call returns `echo-canary:via-tool-search`.
- **B4** (ASTAT-01) -- the adapter reports `plugin_echo_echo_` as connected, and info shows `(connected)`.

### What it records

The canary prints these facts on `observed:` lines. They do not change the exit code, except the reload count, which M4 also asserts.

- The number of reloads until `plugin_echo_echo_` is live and `echo` is gone.
- The warning that pi-mcp-adapter prints at its first start. It names the `_piClaudeMarketplace` marker of the old `mcp.json` entry as an ignored setting.
- The tool names that the first model request of each route declares.
- Whether Pi declares `tool_search` in a session started with `--no-extensions`, and in a session started with `--no-extensions -e builtin:tool-search`. `scripts/pi.sh` starts Pi with `--no-extensions`, and it passes `-e builtin:tool-search` because of this reading. If a probe session fails, the canary prints `not measured` with the reason.

### What it routes to `human_needed` (exit non-zero)

- Exit 1 prints `LIVE RUNTIME REQUIRED`. The run did not prove the assertions: a precondition is not met, Pi stopped answering, a step timed out, Pi opened a dialog, or the RPC pacing check failed. The pacing check is the first step of every session. `/canary-wait 1500` must take at least 1400 ms, or the waits cannot pace the run.
- Exit 2 prints `ADOC-02 REGRESSION`. An observation contradicts an assertion. This includes an expected notice or state that never arrived while Pi kept answering.

The canary keeps the two exit codes apart, so a script can tell a broken assertion from an unproven run.

Exit 130 or 143 means that `SIGINT` (Ctrl-C) or `SIGTERM` stopped the run, which proves nothing. Before it exits, the canary kills the Pi process groups and the stub and removes the sandbox.

### The negative control

`--invert` flips the expected route A result text and nothing else:

```bash
PI_MCP_ADAPTER_ROOT=/var/tmp/mcp-adapter-520/node_modules/pi-mcp-adapter \
TMPDIR=/var/tmp/mcp-adapter-canary \
  node tests/live-uat/mcp-adapter-canary.mjs --invert
echo "EXIT=$?"
```

Expect exit 2 naming A3, after A2 has passed.

### Capturing the legacy fixture

`tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json` holds the files that pi-claude-marketplace 0.19.2 wrote on Pi 1.0.0: the marked `mcp.json` entry, the `state.json` record, and `claude-plugins.json`. The sandbox root in these files is replaced with `@@SANDBOX@@`. Every run seeds the agent directory from this fixture, so the run is offline and gives the same result each time.

The fixture is captured once. Regenerate it only on purpose, from a scratch install of 0.19.2 outside the repository:

```bash
npm install --prefix /var/tmp/pcm-0192 pi-claude-marketplace@0.19.2 \
  --legacy-peer-deps --ignore-scripts --no-audit --no-fund
TMPDIR=/var/tmp/mcp-adapter-canary \
  node tests/live-uat/mcp-adapter-canary.mjs --capture-legacy /var/tmp/pcm-0192
```

The capture drives 0.19.2 alone. It adds the canary marketplace, installs `echo`, and writes the fixture. It refuses to write a fixture that still holds the sandbox, repository, or home path.

The capture writes the fixture with one array element on each line, but `npm run check` expects the Prettier layout. Format the fixture before you commit it:

```bash
npx prettier --write tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json
```

### Observed result (2026-10-09, pi-mcp-adapter 5.2.0, pi 1.0.0)

The run used `TMPDIR=/var/tmp/mcp4-p7-04` and the scratch prefix `/var/tmp/mcp4-p7-research/a520`, which held pi-mcp-adapter 5.2.0. The canary's output, verbatim, with the exit status appended by the shell:

```text
[mcp-adapter-canary] PASS: M0: Pi 1.0.0 (/home/acolomba/src/pi-claude-marketplace-mcp-4/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js), pi-mcp-adapter 5.2.0 at /var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter, sandbox parent /var/tmp/mcp4-p7-04
[mcp-adapter-canary] observed: pi-mcp-adapter first-start warning: <sandbox>/agent/mcp.json: Ignored settings (details in /mcp-adapter): "echo": _piClaudeMarketplace.
[mcp-adapter-canary] PASS: M1: AMIG-03: the migration notice lists "echo -> plugin_echo_echo_ (echo) [user]"
[mcp-adapter-canary] PASS: M2: AMIG-03, ASTAT-02: before any reload the adapter lists [["echo","cached"]] and info shows (not loaded)
[mcp-adapter-canary] PASS: M3: AMIG-01, ANAME-01, ANAME-04: mcp.json keeps no marked entry; mcp-adapter.json holds plugin_echo_echo_ with toolPrefix "mcp" and directTools "search"
[mcp-adapter-canary] PASS: I1: AFILE-01: ping installed fresh is written to mcp-adapter.json as plugin_ping_ping_
[mcp-adapter-canary] observed: reloads until plugin_echo_echo_ is live and echo is gone: 1
[mcp-adapter-canary] PASS: M4: AMIG-03, ASTAT-01, AFILE-01: after 1 reload the adapter lists [["plugin_echo_echo_","cached"],["plugin_ping_ping_","cached"]]; info shows echo (cached, connects on first use) and ping (cached, connects on first use)
[mcp-adapter-canary] PASS: A1: ASTAT-02: in a fresh deferred session info shows (status unknown)
[mcp-adapter-canary] observed: route A first model request tools: ["read","bash","edit","write","tool_search","pi_claude_marketplace_list","pi_claude_marketplace_plugin_list","mcp"]
[mcp-adapter-canary] PASS: A2: ANAME-01, ANAME-04: mcp({ search }) returned mcp__plugin_echo_echo__echo_canary, declared only after the search
[mcp-adapter-canary] PASS: A3: ADOC-02: mcp__plugin_echo_echo__echo_canary returned "echo-canary:hi"
[mcp-adapter-canary] PASS: A4: ASTAT-01: after the first MCP use the adapter reports plugin_echo_echo_ connected and info shows (connected)
[mcp-adapter-canary] PASS: B1: ASTAT-02: in a fresh deferred session info shows (status unknown)
[mcp-adapter-canary] observed: route B first model request tools: ["read","bash","edit","write","tool_search","pi_claude_marketplace_list","pi_claude_marketplace_plugin_list","mcp"]
[mcp-adapter-canary] PASS: B2: ANAME-01, ANAME-04: tool_search loaded mcp__plugin_echo_echo__echo_canary, declared only after the search
[mcp-adapter-canary] PASS: B3: ADOC-02: mcp__plugin_echo_echo__echo_canary returned "echo-canary:via-tool-search"
[mcp-adapter-canary] PASS: B4: ASTAT-01: after the first MCP use the adapter reports plugin_echo_echo_ connected and info shows (connected)
[mcp-adapter-canary] observed: --no-extensions: tool_search declared: no
[mcp-adapter-canary] observed: --no-extensions -e builtin:tool-search: tool_search declared: yes
[mcp-adapter-canary] all assertions proven; exit 0
EXIT=0
```

The `--invert` control ran on the same file and the same prefix. It failed at A3 and exited 2, after A2 passed:

```text
[mcp-adapter-canary] PASS: M0: Pi 1.0.0 (/home/acolomba/src/pi-claude-marketplace-mcp-4/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js), pi-mcp-adapter 5.2.0 at /var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter, sandbox parent /var/tmp/mcp4-p7-04
[mcp-adapter-canary] observed: pi-mcp-adapter first-start warning: <sandbox>/agent/mcp.json: Ignored settings (details in /mcp-adapter): "echo": _piClaudeMarketplace.
[mcp-adapter-canary] PASS: M1: AMIG-03: the migration notice lists "echo -> plugin_echo_echo_ (echo) [user]"
[mcp-adapter-canary] PASS: M2: AMIG-03, ASTAT-02: before any reload the adapter lists [["echo","cached"]] and info shows (not loaded)
[mcp-adapter-canary] PASS: M3: AMIG-01, ANAME-01, ANAME-04: mcp.json keeps no marked entry; mcp-adapter.json holds plugin_echo_echo_ with toolPrefix "mcp" and directTools "search"
[mcp-adapter-canary] PASS: I1: AFILE-01: ping installed fresh is written to mcp-adapter.json as plugin_ping_ping_
[mcp-adapter-canary] observed: reloads until plugin_echo_echo_ is live and echo is gone: 1
[mcp-adapter-canary] PASS: M4: AMIG-03, ASTAT-01, AFILE-01: after 1 reload the adapter lists [["plugin_echo_echo_","cached"],["plugin_ping_ping_","cached"]]; info shows echo (cached, connects on first use) and ping (cached, connects on first use)
[mcp-adapter-canary] PASS: A1: ASTAT-02: in a fresh deferred session info shows (status unknown)
[mcp-adapter-canary] observed: route A first model request tools: ["read","bash","edit","write","tool_search","pi_claude_marketplace_list","pi_claude_marketplace_plugin_list","mcp"]
[mcp-adapter-canary] PASS: A2: ANAME-01, ANAME-04: mcp({ search }) returned mcp__plugin_echo_echo__echo_canary, declared only after the search

[mcp-adapter-canary] ADOC-02 REGRESSION -- A3 failed:
  mcp__plugin_echo_echo__echo_canary returned "echo-canary:hi" (isError false); expected "echo-canary:inverted".
EXIT=2
```

The move took 1 reload. With `--no-extensions` alone, Pi did not declare `tool_search`. With `--no-extensions -e builtin:tool-search`, it did. No sandbox was left after either run.
