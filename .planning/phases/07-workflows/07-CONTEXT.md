# Phase 7: Workflows - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning
**Mode:** autonomous (smart discuss; decisions made from upstream evidence and
the engine source, no user prompts). The user's standing instruction for this
run: "make decisions as you see fit, but when in doubt research how claude code
upstream operates, and try to maintain compatibility unless we need to deviate
for reasons specific to the implementation of this project." Every decision
below was **settled autonomously**; the ones a user might have decided
differently are logged in `DUBIOUS-CHOICES.md` in this directory (P7-DC-NN).

<domain>
## Phase Boundary

Phase 7 proves, with cucumber scenarios under `features/workflow/` that observe
only what Pi and the workflow engine (`@quintinshaw/pi-dynamic-workflows`
3.15.0) report, that a bridged workflow behaves as Claude Code 2.1.316 defines
it or as a recorded divergence says:

1. **Listing (WFL-01):** with the engine loaded, each bridged workflow is the
   command `/<plugin>:<meta.name>` with its description; the file name plays
   no part; the `<plugin>-` prefix is elided (WNAM-06, a recorded divergence).
2. **Runs (WFL-02):** running the command completes; the run reports the
   arguments in the engine's shape (FG-32) and the script's result. The Phase 1
   seed (`run.feature`, no arguments) stays and gains the argument scenario.
3. **Refused scripts (WFL-03):** each install-time disposition the bridge
   documents (per-file refusal, per-file skip, installed with a caveat) is
   pinned, and a caveat script fails at the engine with the engine's own
   refusal message; the missing run approval carries an ID (FG-31).
4. **Companion missing (WFL-04):** without the engine, the standalone install
   shows `{requires pi-dynamic-workflows}` at `warning` severity (WDEP-02);
   loading the engine and starting the session again makes the command
   available with no reinstall.
5. **Lifecycle (WFL-05):** disable, uninstall, and update remove or replace the
   workflow, with the `{stale workflow command}` notice (WLIF-06) on the verbs
   that retire a command, and the stale command gone in a new session.
6. **Decisions and docs (wave 3):** IDs for this phase's divergences in
   `docs/workflows-compatibility.md`, the SUMMARY "Parent lines", the phase
   gate.

**Out of scope:** workflows whose scripts call `agent()`, `parallel()`, or
`pipeline()` (RM-03, needs a real model); the engine's own `/workflows`
navigator UI; project-scope `.claude/workflows/` scripts outside a plugin; any
change to the frozen Phase 1 files (a needed change goes to the parent as a
parent line).

</domain>

<decisions>
## Implementation Decisions

### Run approval (FG-31)

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

### Arguments (FG-32)

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

### Refused scripts (WFL-03)

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

### Companion missing (WFL-04)

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

### Lifecycle (WFL-05)

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/workflow-files.ts` (`publishWorkflow`, `workflowScriptText`):
  the Phase 1 fixture writer; extend it with other script bodies.
- `features/step_definitions/workflow/runs.steps.ts`: the publish `Given`, the
  run `When` (waits for the terminal progress entry, fails on a dialog, an
  extension error, or a model call), and the result `Then` (`status`,
  `resultPreview`, `error` of the last progress entry).
- Shared frozen steps: `pi runs with the scripted model and these companions:`,
  `the user has run {string}`, `... which warned`, `the user runs {string}`,
  `the command reports these results:`, `the user has started a new pi
  session`, `the user lists the slash commands pi offers`.
- Engine 3.15.0 in the peer cache
  (`node_modules/.cache/optional-peers/node_modules/@quintinshaw/pi-dynamic-workflows/src/`):
  `saved-commands.ts` (registration, `parseCommandArgs`, the stale-command
  warning), `workflow-progress.ts` (progress entry shape), `workflow.ts`
  (`parseWorkflowScript`, the nine checks).

### Established Patterns
- Bridge: `bridges/workflows/{discover,stage,unstage,types,index}.ts`,
  `domain/workflow-script.ts` (meta extraction, gates, determinism),
  `platform/workflow-home.ts` (storage root).
- Install-time dispositions and gate names: `docs/workflows-compatibility.md`
  "Install-time disposition" and "Refusal-check classification".
- Markers: `{requires pi-dynamic-workflows}` (WDEP-02/03), `{stale workflow
  command}` (WLIF-06), in `shared/notification-types.ts`.

### Integration Points
- The engine registers `<plugin>:<name>` from each envelope on
  `session_start`; the command handler re-reads the envelope at invocation.
- Phase 7 owns `features/workflow/**`, `features/step_definitions/workflow/**`,
  `features/lib/workflow-files.ts`, `bridges/workflows/**`,
  `platform/workflow-home.ts`, `domain/workflow-script.ts`,
  `docs/workflows-compatibility.md`, `test/bridges/workflows/**`,
  `test/integration/workflows-*`.

</code_context>

<specifics>
## Specific Ideas

- Upstream evidence: code.claude.com/docs/en/workflows (approval, `args`,
  `meta` rules); the 2.1.316 binary's Workflow tool prose ("args: any -- the
  value passed as Workflow's `args` input, verbatim"); `.planning/research/FEATURES.md`
  section 6 (W1..W14).
- The engine shows an object result only as `Structured result` in its
  progress entry, so every fixture returns text (the args scenario returns
  `JSON.stringify(args)`).

</specifics>

<deferred>
## Deferred Ideas

- Workflows that call `agent()`, `parallel()`, `pipeline()` (RM-03).
- A bridge-side run approval (would need an engine hook; D-CF7-01).

</deferred>
