# Phase 7: Workflows - Research

**Researched:** 2026-11-01
**Domain:** Cucumber behavioral tests for bridged workflows run by `@quintinshaw/pi-dynamic-workflows` 3.15.0 inside a headless Pi 1.4.0 (RPC), plus the upstream contract of Claude Code 2.1.316
**Confidence:** HIGH for every engine, Pi, and bridge fact below (each one was observed in a live probe run or read in source this session); HIGH for the upstream workflow-command and `meta` loader facts (read from the 2.1.316 binary and the docs page); MEDIUM for what value a script receives upstream when the user types text after the command (the model makes the tool call).

## Summary

Every question was answered by live probes (throwaway feature and step files run with `npx cucumber-js`, since deleted) and by reading the engine 3.15.0, Pi 1.4.0, and Claude Code 2.1.316 sources. The seed `features/workflow/run.feature` passes (1 scenario, 11 steps). No new package is needed. The Phase 1 harness can do everything Phase 7 needs without editing a frozen file.

Five results change how the plan must be written.

1. **A script the engine refuses at parse time never starts a run.** `startInBackground` calls `parseWorkflowScript` synchronously, and the saved-command handler catches the throw and calls `notify("/<cmd> failed: <message>", "error")`. No `pi-dynamic-workflows:progress` entry is appended. The seed's run `When`, which waits for a terminal progress entry, would wait 20 s and then fail. The refusals and lifecycle scenarios need a sibling `When` that reads Pi's notify records. A status `failed` with an `error` appears only for a script that throws while it runs (for example `throw new Error("Nope.")` gives `error: "Error: Nope."`). CONTEXT's phrase "ends the run as `failed`" is wrong for the caveat scripts.
2. **The `/reload` builtin is not reachable over RPC.** Pi 1.4.0 handles a `/reload` prompt only in interactive mode. Over RPC the text goes to the model, with disposition `started`. But RPC `new_session` builds a new runtime with a fresh `SettingsManager` and resource loader, and so does `AgentSession.reload()`. Both re-read `<agentDir>/settings.json` `packages`/`extensions`, and the engine registers saved workflows on every `session_start`. A Phase-7-owned `Given` writes the engine's package root into `<agentDir>/settings.json` `packages` (what `pi install <path>` records). The frozen `the user has started a new pi session` step then loads the engine into the same profile Pi, and the workflow becomes available with no reinstall. This was verified live.
3. **The upstream argument contract exists, and the engine diverges from it (FG-32).** In the 2.1.316 binary, a workflow command is a `type:"prompt"` command. `getPromptForCommand` trims the typed text and tells the model `Invoke: Workflow({ name: "<plugin>:<name>", args: "<the text as a JSON string>" })`, or `Workflow({ name })` when nothing was typed. So upstream `args` is the typed text as one string, or `undefined`. The engine gives `{"who":"Ada","_":"first second","_raw":"first second who=Ada"}`, and `{"_":"","_raw":""}` for no text. D-CF7-02's premise "upstream states no rule" is wrong. The shape is a divergence that a Pi-side gap licenses (the engine owns parsing, and the bridge has no hook), not a non-divergence.
4. **Upstream also skips the "installed with a caveat" scripts at load.** The 2.1.316 loader calls `hk(script, {validateBody:false})`. That parse returns an error when `meta` is not the first statement, when `meta` holds a reserved key (`__proto__`, `constructor`, `prototype`), or when `meta.description` is missing. The loader then logs `Plugin workflow <path> has invalid meta: <error> — skipping` and registers no command. The bridge installs these scripts, the engine registers the command, and the first run fails with an error notify. D-CF7-04 calls this an "admit-versus-run divergence", which is accurate against the engine but not against Claude Code. The recorded WGATE-03 decision still licenses it, but the ID text and the doc must say what upstream does. This is logged under Dubious Choices.
5. **The pre-commit fixer rewrites em dashes.** `texthooks fix-unicode-dashes` turns U+2014 into `--` in every non-`.planning/` file, `.feature` and `.ts` included. The engine's stale-command warning and its run-start notice both contain U+2014. A step that compares those messages must project U+2014 to `--` and must write the character as the escape `"—"` in TypeScript. A literal `—` in a feature file is rewritten at commit and the scenario breaks.

**Primary recommendation:** Build the phase on the frozen steps (`pi runs with the scripted model[ and these companions:]`, the generic `has the file {string} with this text:` fixture step, `the user has run`, `the user runs`, `the command reports these results:`, `the results list these marketplaces and plugins:`, `the user has started a new pi session`, `the user lists the slash commands pi offers`). Add three wave-1 shared steps in `workflow/listing.steps.ts`: a listing `Then` over the registry snapshot, a no-run `When`, and a notices `Then` that projects U+2014 to `--`. The companion-missing plan adds one `Given` that loads the engine through Pi user settings. No product bug was found that a scenario would expose. Fix the decision text (D-CF7-02, D-CF7-04) and the compatibility doc in wave 3.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Run approval (FG-31)

- **D-CF7-01 (no run approval; Pi gap):** Claude Code asks before it runs a
  plugin workflow by name in manual permission mode and relies on permission
  rules under `-p` (code.claude.com/docs/en/workflows, "Approve the plan
  before it runs"). The engine registers each saved workflow as a plain Pi
  command whose handler starts the run at once (engine 3.15.0
  `src/saved-commands.ts::registerSavedWorkflow`), and the bridge has no hook on
  that handler: it writes envelopes and the engine owns registration and runs.
  Record this as a Pi-gap divergence with the ID D-CF7-01. The run scenarios
  pin it: the run `When` already fails on any dialog (`select`, `confirm`,
  `input`, `editor`) during a run, so a passing run proves no approval was
  asked. No product change.

#### Arguments (FG-32)

- **D-CF7-02 (argument shape):** Accept and pin the engine's slash-path shape.
  The engine splits the typed text on whitespace; each `key=value` token (with
  `=` after the first character) becomes `args[key] = value`; the other tokens
  joined by one space become `args._`; the trimmed text becomes `args._raw`;
  `parameters` defaults fill missing keys (engine 3.15.0
  `src/saved-commands.ts::parseCommandArgs`). Upstream documents `args` only
  as the Workflow tool's input passed "verbatim" (2.1.316 binary prose) and
  states no rule for text typed after `/<plugin>:<name>`, so there is no
  upstream position to diverge from; the shape is recorded as an engine-owned
  behavior with an ID, not a divergence.
- **Observation:** a fixture script returns `JSON.stringify(args)`. The engine's
  progress entry carries a text result whole up to 2,000 characters
  (`src/workflow-progress.ts`, `PREVIEW_CHARS`), so the scenario compares the
  whole JSON text as a literal in the feature file. Key order is the engine's
  insertion order: the `key=value` keys first, then `_`, then `_raw` (for
  `/demo:echo first second who=Ada` the text is
  `{"who":"Ada","_":"first second","_raw":"first second who=Ada"}`). The
  researcher confirms this against a live run before the plan pins it.
- The Phase 1 seed (`run.feature`, no arguments) stays as is. The run `When`
  keeps failing on any scripted-model call: no fixture in this phase calls
  `agent()` (RM-03), so nothing needs relaxing.

#### Refused scripts (WFL-03)

- **Disposition coverage:** one scenario per install-time disposition the
  compatibility doc lists, each observing the `/claude:plugin install` result
  rows and, where a command exists, the run:
  - **Per-file refusal at install:** a script the determinism blocklist matches
    (`Date.now()`), and a script that does not parse. The rest of the plugin
    installs; the warning names the file.
  - **Per-file skip:** a script with no `meta` (a helper module), and a
    `meta.name` that is not a literal. Claude Code skips the same scripts
    ("has invalid meta -- skipping"), so this is upstream parity.
  - **Installed with a caveat, refused at run:** a `meta` that is not the first
    statement, and a `meta` that uses a reserved key name (`constructor`,
    `__proto__`, `prototype`; "reserved names" in WFL-03 means these engine
    reserved `meta` keys). The install warns with the gate name; running the
    command ends the run as `failed` with the engine's own message (for example
    `reserved key name not allowed in meta: constructor`). The researcher
    confirms the exact messages against engine 3.15.0.
- **D-CF7-03 (refused at install, not at run):** Claude Code's loader reads
  only `meta` at load (`validateBody: false`) and registers the command, so a
  nondeterministic or unparseable script fails when it runs. The bridge refuses
  both at install (documented as W5/W6 in the research). Keep the bridge's
  behavior: it writes executable code into another extension's storage and a
  refused file costs nothing to fix; record the timing difference as a
  divergence with the ID D-CF7-03.
- **D-CF7-04 (admitted with a caveat):** the six engine checks the bridge warns
  about instead of refusing (`meta-not-first-export`, `meta-not-const-export`,
  `meta-not-sole-declarator`, `meta-not-named-meta`, `meta-not-pure-literal`,
  `meta-fields-invalid`) install with a warning and fail at the engine on the
  first run. This is the documented admit-versus-run divergence; it gets the ID
  D-CF7-04 so the scenarios and the doc can cite it.
- Fixture workflows are never named after Pi reserved commands (`new`,
  `compact`, ...), and every fixture script is a statement body ending in a
  `return`, never `export default` (ROADMAP Phase 7 note).

#### Companion missing (WFL-04)

- **Severity (WDEP-02, existing decision):** the standalone install without the
  engine reports the plugin row with `{requires pi-dynamic-workflows}` at
  `warning`; `list` reports the same marker at `info`. Pin both values as
  literals. No new ID.
- **Recovery:** after the install without the engine, a Pi that loads the
  engine offers `/<plugin>:<name>` with no reinstall, because the engine
  registers saved envelopes on `session_start`. If the frozen harness can load
  the engine into a running Pi and `/reload` it, the scenario does that; if it
  can only start a new Pi with the engine (Pi loads extensions at start, the
  same thing `/reload` does after `pi install`), the scenario starts the
  engine Pi and the plan records the substitution as a dubious choice. The
  researcher checks which one the frozen `companion.steps.ts` and
  `features/lib/companions.ts` support.
- `shared/concerns/soft-dep.ts` is edited only in the engine's arm, and only if
  a scenario exposes a bug there.

#### Lifecycle (WFL-05)

- **Uninstall:** the result row carries `{stale workflow command}` (WLIF-06,
  existing); running the lingering command in the same session gets the
  engine's warning (`/<name> is not available in this project — reload the
  session to drop the stale command.`, engine 3.15.0
  `src/saved-commands.ts`); a new session no longer offers it.
- **Disable and enable:** disable retires the command as uninstall does (the
  WLIF-06 verbs); enable brings it back in a new session and it runs.
- **Update:** an update to a new plugin version whose script returns a new
  value runs the new script in a new session (the engine reloads the envelope
  at invocation, so the researcher checks whether the same session already
  runs the new script and the scenario pins what the engine does).
- Each scenario observes Pi (`get_commands`, the run's progress entries, the
  `/claude:plugin` result), never the envelope files.

### Claude's Discretion

- Feature file split inside the wave template: `listing.feature` (wave 1, with
  the shared workflow steps in `workflow/listing.steps.ts`), then
  `refusals.feature`, `run.feature`, `companion-missing.feature`,
  `lifecycle.feature` (wave 2, one plan and one step module each), then wave 3
  docs and the gate.
- Step wording, fixture writer extensions in `features/lib/workflow-files.ts`
  (a script body other than a plain return: `JSON.stringify(args)`, a statement
  before `meta`, a reserved key, `Date.now()`, a syntax error, no `meta`), and
  the negative controls (one per feature file).
- Whether the listing reads RPC `get_commands` (source `extension`) or the
  registry probe; whichever reports the description.

### Deferred Ideas (OUT OF SCOPE)

- Workflows that call `agent()`, `parallel()`, `pipeline()` (RM-03).
- A bridge-side run approval (would need an engine hook; D-CF7-01).

### Research corrections to the locked decisions (evidence below; see Dubious Choices)

- **Recovery (WFL-04):** neither branch of the CONTEXT's "if/else" applies. The frozen harness cannot `/reload` over RPC and cannot start a second profile Pi (`usePiWithProfile` throws `a profile Pi already started in this scenario`). It can load the engine into the same Pi through Pi's user settings and a new session. That is the closest honest observation, and it is what `pi install <path>` followed by `/reload` does.
- **Caveat scripts at run:** no run starts and no progress entry is written. The engine shows an error notify `/<cmd> failed: <message>`. They do not "end the run as `failed`".
- **Install warning wording:** the warning names the engine's check by number and paraphrase (`the engine refuses at its check 8 -- ...`), not by gate ID (`meta-not-pure-literal`).
- **D-CF7-02 premise:** upstream does state a rule (see Upstream evidence U2).
- **D-CF7-04 premise:** upstream skips these scripts at load. It does not admit them and then fail at run (U3).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WFL-01 | With the workflow engine loaded, each bridged workflow is the command `/<plugin>:<meta.name>` with its description | Q6: the registry snapshot lists engine commands with `source: "extension"` and the engine entry as `path`. `acme` + `acme-audit` in `zzz.workflow.js` is offered as `/acme:audit` "Audits the code.", and `/acme:acme-audit` is not a command. The file name plays no part. |
| WFL-02 | Running the command completes, and its run records the arguments in the engine's shape (FG-32) and the script's result | Q2: exact `resultPreview` literals for three inputs; key order measured. The existing run `When`/`Then` work unchanged. |
| WFL-03 | Scripts the engine refuses (meta shape, determinism, reserved names) are reported as upstream or a recorded divergence, and the missing run approval is recorded (FG-31) | Q1/Q4: exact install rows and warning lines for the seven fixtures, exact engine refusal notifies, the no-run behavior, and upstream evidence U1/U3. |
| WFL-04 | Without the engine, the install shows `{requires pi-dynamic-workflows}` at the decided severity, and loading the engine then reloading makes the workflows available with no reinstall | Q3: install `warning` / list `info` rows, measured; the settings `packages` plus new session path, verified live. |
| WFL-05 | Disable, uninstall, and update remove or replace the workflow, including the lingering-command notice (WLIF-06) | Q5: exact rows for uninstall, disable, enable, a same-name update, and a name-retiring update; same-session and new-session behavior measured. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md and the milestone brief)

- Never commit to `main`. Commit only to `features/component-features-phase-7`. Update by merge only; never rebase, amend, force-push, or use `--no-verify`. Commit titles follow `.agents/skills/committing/SKILL.md` and carry no phase, plan, or wave ID.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it, with the red proof recorded. Scenarios observe what Pi or a companion reports, never the files the bridge wrote. Expected values are whole literals in the feature file, each feature file has a negative control, and every table lists all rows.
- Frozen after Phase 1, read-only here: `features/support/world.ts`, `features/lib/{pi-process,pi-commands,run-tokens,published-marketplace,companions}.ts`, the scripted model, the registry probe, and the step modules `command`, `session`, `config`, `git-host`, `mcp-configuration`, `model`, `companion`, `plugin/publishing`, `marketplace/publishing`. Also frozen: `test/e2e/_rpc.ts`, `cucumber.json`, `scripts/check-features.mjs`, `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `platform/pi-api.ts`, `.agents/skills/cucumber/**`, and `.fallowrc.json`. A needed change becomes a SUMMARY "Parent line".
- Phase 7 owns `features/workflow/**`, `features/step_definitions/workflow/**`, `features/lib/workflow-files.ts`, `extensions/pi-claude-marketplace/bridges/workflows/**`, `platform/workflow-home.ts`, `domain/workflow-script.ts`, `docs/workflows-compatibility.md`, `test/bridges/workflows/**`, and `test/integration/workflows-*`. The existing integration test is `test/integration/workflow-kind-inversion.test.ts`, singular, which the `workflows-*` glob does not match. Treat it as Phase 7's, and say so in the SUMMARY.
- Never edit `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions, or `BACKLOG.md`. List those lines under "Parent lines".
- Append-only closed sets (notification `Reason`, `notification-wire.ts`, `notify-reasons.ts`, `docs/output-catalog.md` counters, and others): prefer an existing reason. No new reason is needed for this phase, since `requires pi-dynamic-workflows` and `stale workflow command` exist.
- In `shared/concerns/soft-dep.ts`, edit only the engine arm, and only on a scenario-exposed bug. No such bug was found.
- Upstream parity is the default. A divergence needs a recorded decision ID or a Pi capability gap (AGENTS.md "Upstream parity").
- Gates: run `npm run check` (it now includes `test:cucumber`), `npm run test:modules`, and `npm run test:cucumber` at the phase gate, with the root-container wrapper (`npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`).
- Every plan `SUMMARY.md` includes `## Threat Flags`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Turning a plugin `workflows/*.js` into a saved envelope (admit / skip / refuse / caveat) | Extension bridge (`bridges/workflows/**`, `domain/workflow-script.ts`) | Install orchestrators (rows, reasons, diagnostics) | The bridge decides each file's disposition at install, and the orchestrators render it |
| Registering `/<plugin>:<name>` and running it | Companion engine (`@quintinshaw/pi-dynamic-workflows`) | Pi host (command registry, RPC) | The engine reads envelopes on `session_start`, registers the commands, and runs them. The bridge has no hook on this path |
| Argument parsing (`{_, _raw, key=value}`) | Companion engine (`parseCommandArgs`) | -- | Engine-owned. The bridge cannot change it without editing script bytes |
| Lingering command after removal | Pi host (no `unregisterCommand`) and engine (re-reads the envelope at invocation) | Extension (`{stale workflow command}` reason) | A Pi gap that the extension reports |
| Loading the engine later | Pi host (settings `packages`, new runtime on `new_session` and on `reload`) | Engine (`session_start` registration) | No extension code is involved |
| Observation in tests | Cucumber harness (`features/step_definitions/workflow/**`) | Frozen shared steps and the registry probe | Scenarios read RPC records, progress entries, notifies, and the registry snapshot |

## Standard Stack

No new library. Everything is already in the repository.

| Component | Version (verified) | Purpose |
|-----------|--------------------|---------|
| `@earendil-works/pi-coding-agent` | 1.4.0 [VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json] | Host Pi under RPC |
| `@quintinshaw/pi-dynamic-workflows` | 3.15.0 [VERIFIED: node_modules/.cache/optional-peers/.../package.json "version": "3.15.0"] | Workflow engine (optional peer, peer cache) |
| `@cucumber/cucumber` | repo devDependency | Behavioral runner (`cucumber.json`: random order, parallel 8) |
| Claude Code | 2.1.316 [VERIFIED: `/opt/claude-code/bin/claude --version` -> `2.1.316 (Claude Code)`] | Upstream reference |

**Installation:** none. `node scripts/install-test-peers.mjs` (also run by `npm run test:cucumber`) installs the peer cache.

## Package Legitimacy Audit

No external package is installed by this phase. There is nothing to audit.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Evidence by research question

### Q1. Progress entries and refused runs (engine 3.15.0, live)

**A successful run** (`/demo:echo first second who=Ada`). The records Pi printed, in order, from the prompt on [VERIFIED: live probe]:

1. `extension_ui_request` `method: "notify"`, `notifyType: "info"`: `/demo:echo running in the background (echo-<id>) — check progress with /workflows status echo-<id>; the result is posted here when it finishes.` The run id is random and the message contains U+2014.
2. `entry_appended` custom `pi-dynamic-workflows:progress`: `{"version":1,"runId":"echo-…","name":"echo","status":"running","cwd":"<sandbox>/project","agentCount":0,"runningCount":0,"doneCount":0,"errorCount":0,"agentIds":[],"agents":[]}`. `name` is `meta.name` (`echo`), not the command name `demo:echo`.
3. `response` `{"disposition":"handled"}`.
4. Sometimes, depending on timing: notify `warning` `[workflow-delivery] delivery for <runId> deferred: endpoint for session <uuid> has no thenable send function`. It appeared in some runs and not in others, and also appears at the next `new_session`. This is the known RPC delivery limitation (spike 028, WOUT-01).
5. `entry_appended` progress with `"status":"completed"`, `"tokens":0`, `"cost":0`, `"durationMs":<n>`, `"resultPreview":"<text>"`.

**A runtime failure** (`throw new Error("Nope.");` in the body): the last progress entry is `status: "failed"`, `error: "Error: Nope."`, and no `resultPreview` [VERIFIED: live probe]. The existing result `Then` expects `error: undefined`, so it cannot state a failure. A failure `Then` would be new, but no phase requirement needs one.

**A parse-time refusal** (the caveat scripts). The engine source: `startInBackground` calls `parseWorkflowScript(script)` first, at `src/workflow-manager.ts:726-731` [VERIFIED: Read]:

```ts
  startInBackground(
    script: string,
    args?: unknown,
    exec: ExecOptions = {},
  ): { runId: string; promise: Promise<WorkflowRunResult> } {
    const parsed = parseWorkflowScript(script);
```

The command handler catches the throw at `src/saved-commands.ts` (inside `registerSavedWorkflow`) [VERIFIED: Read]:

```ts
        } catch (error) {
          ctx.ui.setStatus(`wf:${liveWorkflow.name}`, undefined);
          ctx.ui.notify(`/${liveWorkflow.name} failed: ${error instanceof Error ? error.message : error}`, "error");
        }
```

So no run id, no progress entry, and no terminal status. The live records for `/demo:late`, in order: `extension_ui_request` `method: "setStatus"`, `statusKey: "wf:demo:late"`, then `extension_ui_request` notify `error`, then `response` `{"disposition":"handled"}`. **The notify arrives before the response**, so `this.pi.request(...)` followed by `this.pi.recordsSince(from)` holds everything, and no waiting is needed.

Exact engine messages [VERIFIED: live probe and `src/workflow.ts:2517-2639` Read]:

| Fixture | Notify severity | Notify text |
|---------|-----------------|-------------|
| `meta` not first (`const greeting = "late";` then `export const meta = …`) | `error` | ``/demo:late failed: `export const meta = { name, description, phases }` must be the first statement in the script`` |
| reserved key (`{name:"reserved",description:"…",constructor:"x"}`) | `error` | `/demo:reserved failed: reserved key name not allowed in meta: constructor` |
| no `description` (`{name:"nodesc"}`) | `error` | `/demo:nodesc failed: meta.description must be a non-empty string` |

`src/workflow.ts` quotes, verbatim: `"`export const meta = { name, description, phases }` must be the first statement in the script"`; ``throw new Error(`reserved key name not allowed in ${path}: ${key}`)`` for `key === "__proto__" || key === "constructor" || key === "prototype"`; `throw new Error("meta.description must be a non-empty string")`.

**Does the existing run `When` work for a failing run?** No. For a parse refusal it waits `WORKFLOW_RUN_TIMEOUT_MS = 20_000` for a terminal progress entry that never comes, and then fails. A sibling `When` is needed (see Pattern 2). For a runtime throw it works, and only the `Then` would differ.

### Q2. Argument shape (live, engine 3.15.0)

Fixture (generic file step, `workflows/echo.js`):

```js
export const meta = {name:"echo",description:"Echoes its arguments."};

return JSON.stringify(args);
```

| Typed command | Final `resultPreview` [VERIFIED: live probe] |
|---------------|-----------------------------------------------|
| `/demo:echo first second who=Ada` | `{"who":"Ada","_":"first second","_raw":"first second who=Ada"}` |
| `/demo:echo` | `{"_":"","_raw":""}` |
| `/demo:echo   a=1 b= =c x=y=z   tail  ` | `{"a":"1","b":"","x":"y=z","_":"=c tail","_raw":"a=1 b= =c x=y=z   tail"}` |

`JSON` is available in the engine realm. The key order is insertion order: the `key=value` keys in typed order, then `_`, then `_raw`. A `=` at position 0 is positional (`=c`). Only the first `=` splits (`x=y=z` gives `x: "y=z"`). `_raw` keeps the inner spacing and trims the ends. The CONTEXT literal is confirmed. A scenario `When` step with a multi-space argument works, but Gherkin keeps the spaces inside `"…"`, so keep the fixtures simple.

### Q3. Loading the engine later (WFL-04), and the companion-missing rows

**What the frozen harness allows** [VERIFIED: Read `features/support/world.ts:540-582`, `features/step_definitions/model.steps.ts:38-52`, `companion.steps.ts`]:

- `Given pi runs with the scripted model` starts a profile Pi with no companions and asserts that no command comes from the peer cache. Use it for "without the engine". A header-only companions table also works, but the dedicated step is clearer.
- A scenario can start only one profile Pi: `usePiWithProfile` throws `a profile Pi already started in this scenario`. "Install, then start a second Pi with the engine" is impossible.
- Pi 1.4.0 over RPC does not run the `/reload` builtin. `AgentSession.prompt` runs only extension commands (`_tryExecuteExtensionCommand`), and the builtin `reload` lives in interactive mode's slash-command table [VERIFIED: Read `dist/core/agent-session.js:1631-1720`, `dist/core/slash-commands.js:25`]. Live: prompting `/reload` gave `{"disposition":"started"}`, and a model turn ran (`agent_start` … `agent_settled`) [VERIFIED: live probe].
- RPC `new_session` -> `runtimeHost.newSession()` -> `createRuntime()` builds `SettingsManager.create(cwd, agentDir, …)` and new services with the `--extension` paths plus the settings resources [VERIFIED: Read `dist/main.js:590-640`, `dist/core/agent-session-runtime.js:147-173`, `dist/modes/rpc/rpc-mode.js:334-341`]. `AgentSession.reload()` likewise calls `settingsManager.reload()` and `_resourceLoader.reload()` and then emits `session_start` with `reason: "reload"` [VERIFIED: Read `dist/core/agent-session.js:2998-3031`]. The engine's `session_start` handler calls `registerAllSavedWorkflows` whatever the reason [VERIFIED: Read engine `src/pi-extension.ts:274-322`].
- `pi install <local path>` records the path, relative to the agent dir, in the user settings `packages` array (`addSourceToSettings` -> `normalizePackageSourceForSettings`) [VERIFIED: Read `dist/core/package-manager.js:615-650, 1160-1169`].

**Live result** (profile Pi without the engine, install, then `<agentDir>/settings.json` = `{"packages":["<peer cache>/@quintinshaw/pi-dynamic-workflows"]}`, then RPC `new_session`): `get_commands` lists `demo:hello` "Says hello." from the engine's `extensions/workflow.ts`, and `/demo:hello` runs to `completed` with `Hello from demo.` [VERIFIED: live probe]. `{"extensions":["<engine entry>"]}` worked the same way [VERIFIED: live probe]. The new session emitted no `claude-plugin` payload, so the frozen `Given the user has started a new pi session` (which requires all payloads to be info) passes.

**Recommended `Given`** (Phase 7, in `workflow/companion-missing.steps.ts`): "the user installs the pi-dynamic-workflows package" or similar. It resolves the engine with `resolveCompanion("pi-dynamic-workflows")` (exported from frozen `features/lib/companions.ts`, read-only import), writes `{"packages":[<root>]}` to `path.join(this.tokens.agentDir, "settings.json")` with `flag: "wx"`, registers `this.onRelease(() => rm(file, { force: true }))`, and asserts the written text. Then the scenario uses the frozen `Given the user has started a new pi session`. This is the closest honest observation of "loading the engine then `/reload`". The only substitution is `new_session` for `/reload`, the same mapping `features/lib/pi-commands.ts::startSession` documents ("as `/reload` does"). Do not delete `settings.json` if it existed. The sandbox agent dir holds only `trust.json` at that point, but `wx` makes a collision fail loudly.

**Rows without the engine** [VERIFIED: live probe, user scope]:

`When the user runs "/claude:plugin install demo@fixtures --scope user"`:

| kind | severity | needs reload | summary |
|------|----------|--------------|---------|
| cascade | warning | true | A plugin operation needs attention. |

| marketplace name | marketplace scope | id | name | status | reasons | scope | version |
|---|---|---|---|---|---|---|---|
| fixtures | user | demo@fixtures | demo | installed | requires pi-dynamic-workflows | user | 1.0.0 |

`When the user runs "/claude:plugin list"`: fields `kind cascade`, `severity info`, `needs reload false`, `tally label Plugin list`, `tally failures 0`, `tally warnings 0`, `tally success count 1`. Row: same as above with `status installed`, `reasons requires pi-dynamic-workflows`, `version 1.0.0`.

Because the install result is a warning, `Given the user has run …` (info-only) fails on it. Use `Given the user has run "…", which warned` for setup, or `When` plus the row steps when the install is the action. Without the engine, prompting `/demo:hello` gives `{"disposition":"started"}` and the scripted model is called. A negative control "pi offers no workflow commands" is cleaner than prompting.

The marker reads `requires pi-dynamic-workflows` in a row's `reasons` cell. The `{…}` braces are the TUI rendering, and tables show the bare reason.

### Q4. Refusal dispositions (live, engine present, user scope)

One plugin `demo` with eight scripts: `clock.js` (`return String(Date.now());`), `broken.js` (`return (;`), `helper.js` (no `meta`), `dyn.js` (`name:String("dyn")`), `late.js` (statement before `meta`), `reserved.js` (`constructor:"x"`), `nodesc.js` (`{name:"nodesc"}`), and `hello.js` (valid). Install results [VERIFIED: live probe]:

| kind | severity | needs reload | header | lines |
|---|---|---|---|---|
| cascade | info | true | | |
| diagnostic | warning | false | `Plugin "demo" [user] installed; 7 declared components have notes.` | (below, joined with `, ` by the field projection) |

Row: `fixtures | user | demo@fixtures | demo | installed | (no reasons) | user | 1.0.0`. With one note the header reads `… installed; 1 declared component has a note.` (seen in `features/plugin/staging-warnings.feature`).

The diagnostic lines, verbatim, in file-name order:

- `workflow script "broken.js" in "workflows" was refused: broken.js is not parseable JavaScript, so no name can be read from it`
- ``workflow script "clock.js" in "workflows" was refused: clock.js calls `Date.now`, which the workflow engine refuses as nondeterministic``
- ``workflow script "dyn.js" in "workflows" was not installed: dyn.js declares no string-literal `meta.name`, so there is no command to install``
- ``workflow script "helper.js" in "workflows" was not installed: helper.js declares no `meta`, so there is nothing to install``
- ``workflow script "late.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 3 -- `export const meta = ...` must be the first statement in the script``
- ``workflow script "nodesc.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 9 -- `meta.description` must be a non-empty string, and `meta.model` (a string) and `meta.phases` (an array of objects each carrying a string `title`) must match those shapes wherever they are declared``
- ``workflow script "reserved.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 8 -- every value inside `meta` must be a plain literal, so no spread, computed key, key written as anything but an identifier, string or number, method, accessor, reserved key name (`__proto__`, `constructor`, `prototype`), array hole, substituted template or computed expression``

The new session then offers `demo:hello` "Says hello.", `demo:late` "Declares its meta late.", `demo:nodesc` "Saved workflow: demo:nodesc" (the engine's fallback when the envelope has no description), and `demo:reserved` "Uses a reserved key.", in that order [VERIFIED: live probe]. `/claude:plugin info demo@fixtures` lists `plugin components workflows: demo:hello, demo:late, demo:nodesc, demo:reserved` and the same notes with "will be refused" / "will not be installed" / "would be installed but …" wording.

**Doc versus behavior:**

- The doc's "Install-time disposition" classes all match the behavior: refusal for `Date.now()` and unparseable, skip for no-`meta` and non-literal name, caveat for check 3/8/9.
- Mismatch 1 (wording, not behavior): the caveat line says "the engine will refuse to **load** it". The engine registers (loads) the command and refuses only when it is **run**. The doc's own text says "the command registers … the engine refuses the script at first invocation". The wording lives in `bridges/workflows/discover.ts:168,186` (Phase 7) but is pinned in tests Phase 7 does not own (`test/orchestrators/plugin/{install-flow-ledger,reinstall-flow,info}.test.ts`) and in `docs/output-catalog.md` (closed-set counters). Recommendation: do not change it in this phase. Pin it as is, and offer a parent line / backlog item. Logged as a dubious choice.
- Mismatch 2 (CONTEXT, not product): "the install warns with the gate name". It names the check number and paraphrase, not the gate ID.
- Mismatch 3 (upstream, a recorded divergence): see U3. Upstream skips the caveat scripts. The doc's Admit-versus-run table compares only against the engine and has no Claude Code column. It needs one row stating what Claude Code does.
- No product bug was found that a cucumber scenario would expose against a recorded decision. **No red-proof product fix is planned.** If wave 3 adds a Claude Code column to the doc, that is a doc change only.

### Q5. Lifecycle (live, engine present, user scope, one workflow `hello`)

| Verb | Result fields | Row (status / reasons / version) |
|------|---------------|----------------------------------|
| `uninstall demo@fixtures --scope user` | cascade, `warning`, needs reload `true`, summary `A plugin operation needs attention.` | `uninstalled` / `stale workflow command` / `1.0.0` |
| `disable demo@fixtures --scope user` | cascade, `warning`, `true`, same summary | `disabled` / `stale workflow command` / `1.0.0` |
| `enable demo@fixtures --scope user` (after disable plus a new session) | cascade, `info`, `true`, no summary | `installed` / (none) / `1.0.0` |
| `update demo@fixtures --scope user` (1.0.0 -> 1.1.0, same `meta.name`, new body and description) | cascade, `info`, `true` | `updated` / (none) / from `1.0.0` to `1.1.0` |
| `update` where 1.1.0's script declares `meta.name` `greet` instead of `hello` | cascade, `warning`, `true`, summary | `updated` / `stale workflow command` / from `1.0.0` to `1.1.0` |

[VERIFIED: live probe for all five]

Same session versus new session:

- After uninstall, disable, or a name-retiring update, running `/demo:hello` in the **same session** gives disposition `handled` and exactly one record before the response: notify `warning` `/demo:hello is not available in this project — reload the session to drop the stale command.` (U+2014). No setStatus record and no progress entry. In a **new session** `get_commands` no longer lists `demo:hello`, and prompting it goes to the model (`started`). The name-retiring update's new session lists `demo:greet` "Greets.".
- After enable in the **same session** (the disable was followed by a new session), `/demo:hello` is not a command (`started`, model). In a new session it is listed and runs to `completed` with the old result.
- After a same-name update, the **same session already runs the new script**: the result was `Hello 2.`, because the engine re-reads the envelope at invocation (`loadWorkflow()` in the handler). But `get_commands` in that session still shows the **old description** ("Says hello."), because Pi cannot replace a registered command's metadata. In a new session the description is new ("Says hello again.") and the run returns `Hello 2.`. Recommended pin: the new session run plus the new description through the listing `Then`. Optionally a second scenario pins the same-session new result (engine-owned behavior; it reads well as "the update takes effect at once for runs").

**Publishing a new version in the harness** [VERIFIED: Read `features/skill/lifecycle.feature`, `features/step_definitions/plugin/publishing.steps.ts:329-340`, `features/lib/published-marketplace.ts:698-720`]: `Given the marketplace "fixtures" offers these plugins:` with `| demo | 1.1.0 |`, then `Given the published plugin "demo" of the marketplace "fixtures" has the file "workflows/hello.js" with this text:`. The generic file step replaces an existing file (`writePublishedPluginFiles`). The workflow Given (`publishWorkflow`) uses `flag: "wx"` and cannot overwrite. So write version 1.0.0 through the generic file step, or through the workflow Given and then overwrite with the generic file step. The Phase 2 skill lifecycle uses the same `offers` plus file pattern.

### Q6. Listing (live)

`get_commands` and the registry snapshot both report an engine command as `name: "demo:echo"`, `description: "Echoes its arguments."`, `source: "extension"`, and path `<repo>/node_modules/.cache/optional-peers/node_modules/@quintinshaw/pi-dynamic-workflows/extensions/workflow.ts` (`get_commands` adds `sourceInfo: {source:"cli", scope:"temporary", origin:"top-level"}`) [VERIFIED: live probe]. The engine also registers its own commands from the same path: `workflows`, `workflows-models`, `deep-research`, `adversarial-review`, `code-review`, `multi-perspective`, `codebase-audit`, `effort`, `ultracode`, `workflows-trigger`, `workflows-progress`. Pi's order puts bridged commands among them, sorted by the engine's `list()` (`localeCompare`).

The elision is confirmed: plugin `acme`, file `workflows/zzz.workflow.js`, `meta.name` `acme-audit` gives `/acme:audit` "Audits the code.", and the run progress `name` is `acme-audit` with result `audited`. `/acme:acme-audit` is not a command. The prompt went to the model (`started`) [VERIFIED: live probe].

The shared `When the user lists the slash commands pi offers` stores `this.registrySnapshot` (a public world field). The shared `Then pi offers these slash commands from prompt templates:` filters `source === "prompt"`, so it cannot be used. Phase 7 needs its own `Then` (Pattern 1).

### Q7. Upstream (Claude Code 2.1.316, offline, no credentials)

**U1 -- Run approval (FG-31).** The docs page "Approve the plan before it runs" says: in Manual / accept-edits mode the prompt appears on every run unless the user chose "Yes, and don't ask again for `<name>` in `<path>`", which is offered "when you run a bundled, saved, or plugin workflow by name". `claude -p` and the Agent SDK never prompt and apply permission rules (`Workflow`, `Workflow(<name>)`) [CITED: code.claude.com/docs/en/workflows, fetched 2026-11-01]. The binary shows why: a workflow command is a `type:"prompt"` command whose prompt asks the model to call the Workflow tool, so approval sits on the tool's permission path (`src`: the `getWorkflowCommands` module, `function m(o){return{type:"prompt",…,kind:"workflow",…,async getPromptForCommand(n,t){…}}}`) [VERIFIED: binary 2.1.316, offset ~299,367,634]. The engine's handler starts the run with no model and no tool permission, so D-CF7-01's Pi-gap license stands. **Grade: HIGH** (docs and binary agree).

**U2 -- Text typed after `/<plugin>:<workflow>` (FG-32).** Verbatim from the 2.1.316 binary:

```js
async getPromptForCommand(n,t){let s=o.phases?`\n\nPhases:\n`+…:"",e=n.trim(),i=_(o.name),
a=e?`{ name: ${i}, args: ${_(e)} }`:`{ name: ${i} }`,…;
return[{type:"text",text:`Run the "${o.name}" workflow.\n\n${o.description}…${s}\n\nInvoke: Workflow(${a})${l}`}]}
```

`_` is imported from the same chunk as the `_(w,null,2)` call that serializes the insights JSON, so it is a JSON stringifier [VERIFIED: binary 2.1.316]. So `/demo:echo first second who=Ada` sends the model `Invoke: Workflow({ name: "demo:echo", args: "first second who=Ada" })`, and with no text `Invoke: Workflow({ name: "demo:echo" })` (args `undefined`, which matches the docs' "If `args` is omitted, the global is `undefined`"). The tool passes `args` "verbatim" (binary Workflow tool prose). **Grade: HIGH** for the instruction text; **MEDIUM** for the value the script finally receives, because the model makes the call and could reshape it. Consequence: the engine's `{_, _raw, key=value}` object (and `{"_":"","_raw":""}` for no text) **diverges** from upstream's string-or-`undefined`. A script written for upstream that does `args.split(...)` or tests `args === undefined` behaves differently here. The bridge cannot change this without editing script bytes (it promises a verbatim copy) or the engine. The license is a Pi-side gap (the engine's command path has no argument hook), so record D-CF7-02 as a **divergence**.

**U3 -- What upstream does with the caveat scripts at load.** The plugin loader [VERIFIED: binary 2.1.316]:

```js
let s=wPe(e),n=hk(s,{validateBody:!1});
if("error"in n)return t(`Plugin workflow ${o} has invalid meta: ${n.error} — skipping`,{level:"warn"}),null;
let u=`${a}:${n.meta.name}`;
```

`hk` with `validateBody:false` first tries a fast path that needs `export const meta = {` at the start (after whitespace and comments), parsed by a hand-written literal parser that returns nothing for a reserved key (`y=new Set(["__proto__","constructor","prototype"])`). It then requires `M(meta)` to pass: `meta.name must be a non-empty string`, `meta.description must be a non-empty string`. When the fast path fails, it acorn-parses the **whole** script and returns `{error:"`export const meta = { name, description, phases }` must be the FIRST statement in the script"}` or `{error:"meta must be a pure literal: reserved key name not allowed in meta: constructor"}`, or `M`'s error. So upstream **skips** `late.js`, `reserved.js`, and `nodesc.js` with a warning and registers no command. The docs agree: "keep `export const meta` as the first statement, and keep it a plain object literal with a `name` and a `description`. If it contains anything other than literal values … Claude Code drops `/<name>` from `/` autocomplete" [CITED: code.claude.com/docs/en/workflows]. Upstream registers `clock.js` (`Date.now()`) and `broken.js` (a body syntax error after a valid leading `meta`), because the fast path never parses the body. They fail at run: "Claude Code makes `Date.now()` … throw inside the script" and "If the body has a syntax error, Claude Code reports it when you run the workflow" [CITED: docs]. Also in the binary is a launch-time `"workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable (breaks resume)…"` check. This confirms D-CF7-03's premise exactly. **Grade: HIGH.**

Comparison:

| Script | Claude Code 2.1.316 | This bridge plus engine 3.15.0 | License |
|--------|---------------------|--------------------------------|---------|
| `Date.now()` in body | registered; fails at run | refused at install, no command | D-CF7-03 (recorded) |
| body syntax error | registered; fails at run | refused at install | D-CF7-03 |
| no `meta` / non-literal `name` | skipped with warning | skipped with warning | parity |
| `meta` not first | **skipped** with warning | installed with caveat; command registered; run fails with error notify | WGATE-03 / D-CF7-04 (recorded, but its text says "admit-versus-run") |
| reserved `meta` key | **skipped** | same as above | same |
| no `meta.description` | **skipped** | same as above; description shown as `Saved workflow: demo:nodesc` | same |
| typed text after command | `args` = trimmed string, or `undefined` | `{…k=v, _, _raw}` object | D-CF7-02, should say divergence (Pi gap) |
| run approval | prompt (manual), rules (`-p`) | none | D-CF7-01 (Pi gap) |
| `<plugin>-` prefix elision | not elided (`acme:acme-audit`) | elided (`acme:audit`) | WNAM-06 (recorded) |

### Q8. Existing tests (what a product change must keep green; what not to duplicate)

- Unit pairs, Phase 7 owned: `test/bridges/workflows/{discover,index,stage,types,unstage}.test.ts`; `test/domain/workflow-script.test.ts` (1,526 lines: dispositions, reasons, gates, determinism classes); `test/platform/workflow-home.test.ts`. Also present: `test/domain/workflow-project-key.test.ts`. Each source-test pair must keep 100% direct coverage (`npm run test:coverage:direct:all`).
- Architecture (`npm run test:unpaired`): `test/architecture/{no-probe-in-workflows-bridge,no-write-in-workflows-staging-scan,workflows-marker-coverage,workflows-single-parse,workflows-update-placed-names}.test.ts`, and `notify-closed-set-locks.test.ts` and `cross-surface-reason-parity.test.ts`, which cover `requires pi-dynamic-workflows` and `stale workflow command`.
- Orchestrator tests outside Phase 7 that pin workflow wording: `test/orchestrators/plugin/{install-flow-ledger,reinstall-flow,info,uninstall,enable-disable,update-cascade,workflows-staging-gc}.test.ts` and `install-flow.test.ts`, which compares the envelope bytes written with and without the engine. Changing the caveat wording or any reason touches these. Avoid it.
- Integration: `test/integration/workflow-kind-inversion.test.ts` (WINV-02 / WBRG-01 envelope materialization, RECON-05, WCONV-01/02). It runs under `npm run test:integration`.
- Live UAT (manual, not in CI): `test/live-uat/workflow-storage-canary.mjs` and `workflow-agent-failure-canary.mjs`.
- Cucumber: only `features/workflow/run.feature` (the seed, no arguments) touches the engine. `features/plugin/component-directories.feature` covers the declared `workflows` path replacing `workflows/` (D-CF1-06) and needs no duplicate. The CI behavioral shard already includes `features/workflow` (`ci.yml:152`), so new files are picked up automatically.

## Architecture Patterns

### System Architecture Diagram

```text
feature step (When)                Pi 1.4.0 (RPC, profile Pi)                         pi-dynamic-workflows 3.15.0
--------------------               ---------------------------                         ---------------------------
"/claude:plugin install" --prompt--> pi-claude-marketplace ext --writes envelope--> <agentDir>/workflows/saved/<plugin>:<name>.json
        |                              |  (admit/skip/refuse/caveat; rows+diagnostic as claude-plugin custom entries)
        v                              v
the command reports these results <- entry_appended (claude-plugin)
"the user has started a new pi session" --new_session--> createRuntime(): settings packages/extensions + --extension paths
                                                  |                     \
                                                  v                      --> engine session_start --> registerAllSavedWorkflows (list())
"the user lists the slash commands pi offers" --/pi-registry-probe--> registry snapshot (source "extension", path = engine entry)
"/<plugin>:<name> args" --prompt--> engine handler: loadWorkflow() (re-reads envelope)
                                          |-- envelope gone ---------> notify warning "... is not available ... — reload ..."  (no run)
                                          |-- parseWorkflowScript throws -> setStatus + notify error "/<cmd> failed: <msg>" (no run)
                                          '-- ok -> startInBackground(parseCommandArgs) -> notify info "running in the background"
                                                     -> progress entries running ... completed|failed (resultPreview / error)
```

### Recommended file layout (all Phase 7 owned)

```text
features/workflow/
  listing.feature            # wave 1: WFL-01 (Feature: Workflow listing)
  run.feature                # wave 2: WFL-02, seed kept plus the argument scenario (Feature: Workflow run)
  refusals.feature           # wave 2: WFL-03 (Feature: Workflow refusals)
  companion-missing.feature  # wave 2: WFL-04 (Feature: Workflow companion missing)
  lifecycle.feature          # wave 2: WFL-05 (Feature: Workflow lifecycle)
features/step_definitions/workflow/
  listing.steps.ts           # wave 1: shared steps (listing Then, no-run When, notices Then)
  runs.steps.ts              # seed module, owned by the run plan
  refusals.steps.ts          # only if refusals needs its own steps (probably none)
  companion-missing.steps.ts # the engine-loading Given
  lifecycle.steps.ts         # only if needed
features/lib/workflow-files.ts  # optional extensions; the generic file step may suffice
```

`npm run check:features` requires each feature title to be `<function> <capability>` from the file name (`Workflow listing`, `Workflow companion missing`, …), rejects catch-all module names, rejects `And`/`But`, and fails on any unused, undefined, or ambiguous step.

### Pattern 1: listing `Then` over the registry snapshot (wave 1)

Reuse the frozen `When the user lists the slash commands pi offers`. Add a `Then` (example wording: `pi offers these workflow commands:` with `| command | description |`) that keeps the snapshot commands whose `source === "extension"` and whose `path` equals the engine entry (`(await resolveCompanion("pi-dynamic-workflows")).entry`), minus the engine's own commands. Recommended filter: keep names containing `:`. Every bridged command is `<plugin>:<name>`, and none of the engine's eleven built-ins has a colon. Then compare the whole table, in Pi's order. Add a companion step, `pi offers no workflow commands`, for the negative controls (companion missing, after uninstall in a new session). A table with only a header row is not allowed. Without the engine, the engine-path filter yields an empty set, so this step proves "no command" whether or not the engine is loaded.

The step must call no world marker: the snapshot has no compared-marker. Make sure every scenario that lists also states the result.

### Pattern 2: the no-run `When` and the notices `Then` (wave 1)

```ts
// Sketch (names illustrative). It sends the command, which the engine
// answers before Pi's response, so no wait is needed (verified live).
When("the user runs the workflow command {string}, which starts no run",
  async function (this: ScenarioWorld, text: string) {
    const harness = this.profileHarness();
    const from = this.pi.recordCount();
    const lengths = await readLogLengths(harness);
    const command = expandTokens(text, this.tokens);
    const { response } = await this.pi.request({ type: "prompt", message: command });
    assert.strictEqual(promptDisposition(response), "handled", JSON.stringify(response));
    const records = this.pi.recordsSince(from);
    // A run would append a progress entry; this command must start none.
    assert.deepStrictEqual(records.filter(isProgress), []);
    const logs = await readLogLinesSince(harness, lengths);
    assert.deepStrictEqual(modelCallsOf(logs), [], "the command called the model");
    this.recordTurn({ prompt: command, disposition: "handled", records, logs });
  });

// | severity | message | : every notify record of the turn, in order.
// Pre-commit's texthooks fix-unicode-dashes rewrites U+2014 as "--" in
// committed files, so the actual text is projected the same way.
const EM_DASH = "—";
Then("pi shows these notices:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.requireTurn().records
    .filter((r) => r.type === "extension_ui_request" && r.method === "notify")
    .map((r) => [String(r.notifyType), String(r.message).replaceAll(EM_DASH, "--")]);
  assert.deepStrictEqual([["severity", "message"], ...rows], table.raw());
  this.markTurnCompared();
});
```

Feature literals then read, for example:

```gherkin
    Then pi shows these notices:
      | severity | message                                                                                       |
      | warning  | /demo:hello is not available in this project -- reload the session to drop the stale command. |
```

```gherkin
    Then pi shows these notices:
      | severity | message                                                                                                 |
      | error    | /demo:late failed: `export const meta = { name, description, phases }` must be the first statement in the script |
```

Keep the `setStatus` record out of the table (it is not a notice), or state it in a separate step if the plan wants it whole. Fallow dupes flagged the seed `When` for cloning `session.steps.ts`'s prompt step (01-08 deviation 2). Order the statements differently, or share small helpers, so the new `When` does not form a clone group with `runs.steps.ts`. Run `npx fallow dupes` after writing it.

### Pattern 3: fixtures through the generic file step

Use the frozen `Given the published plugin {string} of the marketplace {string} has the file {string} with this text:` with a doc string for every non-trivial script (the reserved key, the late `meta`, `JSON.stringify(args)`, `Date.now()`, syntax error, no `meta`, a non-literal name, and the v1.1.0 replacement). The reader then sees the script in the feature file, and `features/lib/workflow-files.ts` needs no change. Keep the existing workflow `Given` for plain-return workflows.

### Pattern 4: the companion-missing scenario shape (verified live)

```gherkin
  Scenario: Loading the engine after the install offers the workflow with no reinstall
    Given pi runs with the scripted model
    Given the marketplace "fixtures" is published as a dir source
    Given the marketplace "fixtures" offers these plugins:
      | name | version |
      | demo | 1.0.0   |
    Given the published plugin "demo" of the marketplace "fixtures" has the workflow "hello" described as "Says hello." that returns "Hello from demo."
    Given the marketplace "fixtures" is added to the user scope
    Given the user has run "/claude:plugin install demo@fixtures --scope user", which warned
    Given the user installs the pi-dynamic-workflows package       # Phase 7 step: settings packages entry
    Given the user has started a new pi session
    When the user runs the workflow command "/demo:hello"
    Then the workflow run ends with the status "completed" and the result "Hello from demo."
```

A second scenario pins the rows (`When the user runs "/claude:plugin install …"` plus fields plus rows, `warning`), and a third pins `list` at `info`. The negative control: without the package step, a new session offers no workflow commands.

### Anti-Patterns to Avoid

- **Waiting for a progress entry after a parse refusal or a stale command.** None comes, and the step times out after 20 s.
- **Prompting a missing command to prove it is gone.** It starts a model turn on the scripted model, with no script steps. Prove absence through the listing `Then`, or with `the scripted model plays these steps:` plus `the model receives these calls:`, as the Phase 2 skill lifecycle does.
- **Comparing the run-start notice.** It carries a random run id, and the deferred-delivery warning appears only sometimes. Never put either in a notices table for a successful run.
- **A literal `—` in a `.feature` or `.ts` file.** The pre-commit fixer rewrites it as `--`.
- **Returning an object from a fixture.** `resultPreview` becomes `Structured result`. Return text (`JSON.stringify`).
- **Reading envelope files** under `<agentDir>/workflows/saved/`. It violates the observation rule.
- **Writing `settings.json` without `onRelease` cleanup.** Each worker's sandbox persists across scenarios, and a stale `packages` entry would load the engine into the shared Pi at its next `new_session`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Starting Pi without or with the engine | a new spawn helper | `pi runs with the scripted model` / `… and these companions:` | frozen, asserts what loaded |
| Loading the engine later | a second Pi or a restart | settings `packages` entry plus the frozen new-session step | one profile Pi per scenario, and `/reload` does not work over RPC |
| Locating the engine | a hard-coded path | `resolveCompanion("pi-dynamic-workflows")` | floor check and `pi.extensions` entry, as Pi loads it |
| Listing commands | own `get_commands` parsing | the frozen registry-probe `When` plus a Phase 7 `Then` on `this.registrySnapshot` | the shared listing pattern |
| Writing scripts | new lib writers | the generic plugin file step | the script stays visible in the feature |
| Result rows | own payload readers | `the command reports these results:`, `the results list these marketplaces and plugins:`, `the result lists these plugins:` | frozen, whole-value comparisons with markers |

## Common Pitfalls

### Pitfall 1: Parse refusals look like runs that never end
**What goes wrong:** The seed `When` waits 20 s and fails. **Why:** `parseWorkflowScript` throws inside the command handler before a run exists. **How to avoid:** use the no-run `When`. **Warning sign:** a timeout in `waitForRecord`.

### Pitfall 2: The em dash
**What goes wrong:** The feature literal is rewritten at commit and the scenario fails. **Why:** `texthooks fix-unicode-dashes` maps U+2014 to `--` (`DEFAULT_DOUBLE_HYPHEN_CODEPOINTS` includes `"2014"`) for all files outside `.planning/` [VERIFIED: Read `/root/.cache/pre-commit/repo96nm61ss/src/texthooks/fix_unicode_dashes.py`; `.pre-commit-config.yaml:33-44`]. **How to avoid:** project U+2014 to `--` in the step, and write `"—"` in TypeScript.

### Pitfall 3: `the user has run` requires info
**What goes wrong:** Setup fails on the no-engine install (warning), the uninstall or disable of a workflow plugin (warning, `stale workflow command`), the refusal install (info cascade plus warning diagnostic), and a name-retiring update (warning). **How to avoid:** use `…, which warned` only when every payload is a warning (no-engine install, uninstall, disable). For the mixed refusal install, use a `When`.

### Pitfall 4: The same-session description after update
**What goes wrong:** A listing in the same session after an update shows the old description. **Why:** Pi cannot replace command metadata. **How to avoid:** list in a new session, and pin the same-session run result separately if wanted.

### Pitfall 5: The deferred-delivery warning
`[workflow-delivery] … has no thenable send function` appears in some runs and at the next `new_session`. It is harmless to the run `When` (which rejects only extension errors and dialogs) and to `startSession` (which rejects only extension errors and dialogs, and requires info `claude-plugin` payloads). Never state it in a table.

### Pitfall 6: Profile Pi start time
Cold jiti compile takes 13-27 s. The frozen Givens have a 90 s timeout. Each new scenario costs one profile Pi. Group lifecycle checks sensibly, but keep one behavior per scenario (cucumber rule).

### Pitfall 7: Random order, parallel 8
Each scenario must be independent. Settings files and published marketplaces are per-scenario and cleaned by the release hooks. Do not depend on another scenario's engine storage. Before() empties the sandbox home, and the workflow storage root follows `PI_CODING_AGENT_DIR` (engine 3.14+).

## Code Examples

Engine argument parser, `src/saved-commands.ts` (engine 3.15.0) [VERIFIED: Read]:

```ts
export function parseCommandArgs(raw: string, parameters?: SavedWorkflow["parameters"]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const positional: string[] = [];
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const eq = token.indexOf("=");
    if (eq > 0) out[token.slice(0, eq)] = token.slice(eq + 1);
    else positional.push(token);
  }
  out._ = positional.join(" ");
  out._raw = raw.trim();
  for (const [key, spec] of Object.entries(parameters ?? {})) {
    if (out[key] === undefined && spec.default !== undefined) out[key] = spec.default;
  }
  return out;
}
```

Stale command and failure notifies, same file (verbatim): `` `/${wf.name} is not available in this project — reload the session to drop the stale command.` `` with `"warning"`; `` `/${liveWorkflow.name} failed: ${error instanceof Error ? error.message : error}` `` with `"error"`.

Progress entry type, `src/workflow-progress.ts` [VERIFIED: Read]: `PREVIEW_CHARS = 2000`; `resultPreview(value)` returns the clipped string for a string, `String(value)` for null, number, or boolean, and `"Structured result"` otherwise. Entries are appended as `pi.appendEntry("pi-dynamic-workflows:progress", { ...header, agents: changed })`, and on deletion as `{ version: 1, runId, deleted: true }`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Envelope storage under `~/.pi/workflows/` only | follows `PI_CODING_AGENT_DIR` | engine 3.14.0 (PR #238) | the harness sandboxes engine storage; floor 3.15.0 |
| Result delivery pending with `--no-extensions -e` | fixed | engine 3.14.0 (PR #232) | over RPC a "deferred" warning still appears (no thenable send) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Upstream's model passes the typed text unchanged as `args` (the instruction says `args: "<text>"`; the model makes the call) | Q7 U2 | Low: the record would say "MEDIUM", and the divergence stands either way |
| A2 | A path in settings `packages` relative to the agent dir (the form `pi install` writes) resolves as well as the absolute path the probe used | Q3 | Low: use the absolute path, which was verified |
| A3 | No engine built-in command name contains `:`, so the `:` filter isolates bridged commands | Pattern 1 | Low: verified for 3.15.0's eleven built-ins; a future engine could add one |

## Open Questions

1. **Re-classify D-CF7-02 and reword D-CF7-04?** The evidence says upstream has a position for both (U2, U3). Recommendation: keep both behaviors (no product change), but record D-CF7-02 as a divergence licensed by a Pi-side gap. Record D-CF7-04 as "Claude Code skips these at load (`has invalid meta … skipping`); this bridge installs them under WGATE-03, the engine registers a command, and the first run fails with an error notify". Wave 3 updates `docs/workflows-compatibility.md` with a Claude Code column. Logged as dubious choices for the user.
2. **Caveat wording "will refuse to load it".** It is behaviorally inaccurate (the engine registers, then refuses to run). Fixing it touches non-owned tests and the output catalog. Recommendation: pin it as is, and add a backlog parent line.
3. **Should the run-time failure shape be pinned?** No requirement asks for it. Optional negative control in `run.feature`: a body that throws ends `failed` with `Error: Nope.`. It needs a new `Then`. Recommendation: skip, or add it only if the run plan wants a negative control beyond the no-argument seed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | ✓ | repo engines `^22.22.2 \|\| ^24.15.0 \|\| >=26` | -- |
| Pi CLI (repo devDependency) | profile Pi | ✓ | 1.4.0 | -- |
| Engine in peer cache | all workflow scenarios | ✓ | 3.15.0 | `node scripts/install-test-peers.mjs` |
| Claude Code binary | upstream evidence only | ✓ | 2.1.316 (`/opt/claude-code/bin/claude`) | docs |
| Root-safe wrapper `nondac-sh` | npm scripts and gates as root | ✓ (scratchpad) | -- | -- |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` (behavioral); `node:test` (unit, architecture, integration) |
| Config file | `cucumber.json` (random order, parallel 8; frozen) |
| Quick run command | `npx cucumber-js features/workflow/<file>.feature` (about 15-40 s per file; one profile Pi per scenario) |
| Full suite command | `npm run check` (static checks plus unpaired, integration, cucumber, and direct coverage), plus `npm run test:modules` and `npm run test:cucumber` at the phase gate, all with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WFL-01 | `/<plugin>:<meta.name>` with description; file name plays no part; `<plugin>-` elided | e2e (cucumber) | `npx cucumber-js features/workflow/listing.feature` | ❌ Wave 1 |
| WFL-02 | run completes; args shape `{"who":"Ada","_":"first second","_raw":"first second who=Ada"}`; no-args `{"_":"","_raw":""}`; seed kept; no dialog (D-CF7-01) | e2e | `npx cucumber-js features/workflow/run.feature` | ✅ seed; argument scenarios ❌ Wave 2 |
| WFL-03 | refusal / skip / caveat rows; caveat run gives error notify; no run approval | e2e | `npx cucumber-js features/workflow/refusals.feature` | ❌ Wave 2 |
| WFL-04 | install `warning` plus `requires pi-dynamic-workflows`; list `info`; engine via settings plus new session gives the command with no reinstall | e2e | `npx cucumber-js features/workflow/companion-missing.feature` | ❌ Wave 2 |
| WFL-05 | uninstall/disable `stale workflow command` warning; same-session stale notice; new session no command; enable back; update new result (and the retiring-name case) | e2e | `npx cucumber-js features/workflow/lifecycle.feature` | ❌ Wave 2 |
| all | feature and step rules | static | `npm run check:features` | ✅ |
| product (only if touched) | bridge and domain pairs | unit | `node --test test/bridges/workflows/<x>.test.ts`, `node --test test/domain/workflow-script.test.ts` plus `npm run test:coverage:direct:all` | ✅ |

### Sampling Rate
- **Per task commit:** `npx cucumber-js features/workflow/<file>.feature`, then `npm run check:features`. After a step-module change, also `npx fallow dupes` and a typecheck (`npx tsc --noEmit`). The commit hook runs `check:commit` (static checks, unpaired tests, staged pairs), not the full gate.
- **Per wave merge:** `npx cucumber-js features/workflow` (all files, three times with different random seeds, to catch order coupling), then `npm run check` in the main checkout.
- **Phase gate:** `npm run check`, `npm run test:modules`, `npm run test:cucumber` green (record seeds), before `/gsd-verify-work`.

### Wave 0 Gaps
- None. The harness, peer cache, and shared steps exist. Wave 1 adds `features/step_definitions/workflow/listing.steps.ts` and `features/workflow/listing.feature`.

### Red proofs (cucumber rule)
No product fix is planned, so no red proof is required. Each new scenario should still show red once, for example by removing the fixture `Given` or stating a wrong literal, and the plan should record it, as 01-08 did for the seed.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | partial | No run approval before third-party script execution (D-CF7-01, a Pi gap): recorded, not mitigated |
| V5 Input Validation | yes | Bridge-side static admission (`domain/workflow-script.ts`: parse-only, no eval; determinism and unparseable refusals; name safety); the engine's own `parseWorkflowScript` and its vm sandbox |
| V6 Cryptography | no | -- |
| V12 Files and Resources | yes | Path containment (NFR-10) for envelopes under `platform/workflow-home.ts`; the test step writes only inside the sandbox agent dir, with release cleanup |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Third-party script runs on a typed command with no confirmation | Elevation of privilege | Documented divergence D-CF7-01; the user typed the command; engine vm sandbox |
| Stale command runs a removed script | Tampering | Engine re-reads the envelope at invocation and refuses with a warning (verified live); `{stale workflow command}` reason |
| Test settings file leaks the engine into the shared Pi | Tampering (test isolation) | `flag: "wx"` plus `onRelease` removal; per-worker sandbox |
| Escape characters in messages | Spoofing (terminal) | `forMessage` in `domain/workflow-script.ts` escapes `\p{Cc}`/`\p{Cf}` in reasons (existing) |

## Sources

### Primary (HIGH confidence)
- Live probes this session (throwaway `features/workflow/zz-probe.feature` and `features/step_definitions/workflow/zz-probe.steps.ts`, since deleted): listing, arguments, refusals, companion missing with `packages` and `extensions`, uninstall, disable/enable, update, update retiring a name, `/reload` over RPC, runtime throw. Seed re-run: `npx cucumber-js features/workflow` gave 1 scenario passed, 11 steps passed.
- Engine 3.15.0 source: `src/saved-commands.ts`, `src/workflow-progress.ts`, `src/workflow-manager.ts:726-783`, `src/workflow.ts:2517-2639`, `src/workflow-saved.ts:80-320`, `src/pi-extension.ts:262-345`.
- Pi 1.4.0 dist: `main.js:585-700`, `core/agent-session.js:1631-1720, 2998-3031`, `core/agent-session-runtime.js:147-173`, `modes/rpc/rpc-mode.js:225-341`, `core/package-manager.js:615-650, 1160-1169`, `core/slash-commands.js:25`.
- Claude Code 2.1.316 binary (`/opt/claude-code/bin/claude`): workflow command module (`getWorkflowCommands`, `getPromptForCommand`), plugin workflow loader (`has invalid meta … skipping`), `hk` meta parser with the `y` reserved-key set and `M` validator, Workflow tool `args` prose.
- Repository: `features/support/world.ts`, `features/step_definitions/{command,session,companion,model}.steps.ts`, `features/step_definitions/workflow/runs.steps.ts`, `features/lib/{companions,pi-commands,workflow-files,result-rows,published-marketplace}.ts`, `domain/workflow-script.ts`, `bridges/workflows/discover.ts`, `docs/workflows-compatibility.md`, `.agents/skills/cucumber/**`, `.pre-commit-config.yaml`, texthooks `fix_unicode_dashes.py`.

### Secondary (MEDIUM confidence)
- code.claude.com/docs/en/workflows (fetched 2026-11-01): approval table, `args`, `meta` rules, syntax errors reported at run, `Date.now()` throws at run.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependency; versions read from manifests.
- Architecture and steps: HIGH -- every step shape and literal was observed in a live run.
- Pitfalls: HIGH -- each one was reproduced or read in source (texthooks fixer, RPC `/reload`, parse refusal).
- Upstream: HIGH for the loader, the command prompt text, and approval; MEDIUM for the value a script finally receives.

**Research date:** 2026-11-01
**Valid until:** 2026-12-01, or until the engine floor or the Pi version moves

## Dubious Choices

1. **WFL-04 recovery substitutes a settings `packages` entry plus RPC `new_session` for "load the engine then `/reload`".** Alternatives: a TUI-driven `/reload` (the `features/lib/pi-tui.ts` PTY driver exists, but the profile Pi is RPC-only and the TUI session runs the shared, model-less configuration); or editing frozen `world.ts` to allow a second profile Pi (needs a parent line). Why dubious: `new_session` is not literally `/reload`, and the session reason is `new`, not `reload`. Evidence: `/reload` over RPC went to the model (`disposition: "started"`); `new_session` and `reload()` both rebuild the settings and resource loader; the engine registers on every `session_start`; the live run passed. The harness already equates a new session with `/reload` (`pi-commands.ts::startSession` doc comment).
2. **D-CF7-02 should be recorded as a divergence, not "engine-owned behavior with no upstream position".** Alternative: keep the CONTEXT wording. Why dubious: the 2.1.316 binary shows upstream turns the typed text into `args: "<text>"` (string) or no `args`. The engine passes an object. Evidence: Q7 U2.
3. **D-CF7-04's "admit-versus-run" description misstates upstream.** Claude Code skips the meta-not-first, reserved-key, and no-description scripts at load. Alternatives: (a) keep installing them with a caveat and re-word the ID and doc (recommended, licensed by WGATE-03); (b) change those six gates to per-file skips for parity, a product change in `domain/workflow-script.ts` and `bridges/workflows/discover.ts` with wide test fallout in non-owned orchestrator tests and `docs/output-catalog.md`. Why dubious: under the user's standing instruction, parity is the default and WGATE-03's rationale (engine strictness may relax) is project-internal. Evidence: Q7 U3.
4. **The caveat wording "the engine will refuse to load it" is pinned as is.** It is inaccurate (the engine loads and registers, then refuses at run). Alternative: re-word it in this phase. Why dubious: a scenario will pin a misleading sentence. Reason to defer: the wording is locked in non-owned tests and the closed-set output catalog.
5. **The listing `Then` isolates bridged commands by "path is the engine entry and name contains `:`".** Alternative: subtract a hard-coded list of the engine's eleven built-in names. Why dubious: it is a heuristic. A bridge regression that dropped the `<plugin>:` prefix would vanish from the table rather than show up wrong. It still fails, because the expected row is missing, but the failure message is less direct.
6. **Notices are compared after projecting U+2014 to `--`.** Alternative: exclude `.feature` files from `fix-unicode-dashes` (an edit to `.pre-commit-config.yaml`, outside Phase 7 ownership), or compare with a run token (`run-tokens.ts` is frozen). Why dubious: the feature literal differs by one character class from what Pi shows. Evidence: the texthooks source maps `2014` to `--`.
7. **A refusal install is pinned as one cascade info plus one diagnostic warning, using `When`, not `which warned`.** This is a direct consequence of the measured severities. Listed only because it changes the CONTEXT's implied "install shows a warning" to "a warning diagnostic beside an info cascade".
