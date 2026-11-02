# Phase 7: Workflows - Pattern Map

**Mapped:** 2026-11-01
**Files analyzed:** 12 (5 features, 5 step modules, 1 fixture lib, 1 doc)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/workflow/listing.feature` (new, wave 1) | test (feature) | request-response (registry probe) | `features/skill/listing.feature`, `features/workflow/run.feature` | exact |
| `features/workflow/run.feature` (modify: add args scenario) | test (feature) | event-driven (progress entries) | itself (seed, lines 1-20) | exact |
| `features/workflow/refusals.feature` (new) | test (feature) | request-response (rows + notices) | `features/plugin/staging-warnings.feature` + run.feature | role-match |
| `features/workflow/companion-missing.feature` (new) | test (feature) | request-response | run.feature + RESEARCH Pattern 4 | role-match |
| `features/workflow/lifecycle.feature` (new) | test (feature) | request-response | `features/skill/lifecycle.feature` | exact |
| `features/step_definitions/workflow/listing.steps.ts` (new, wave 1, shared topic module) | step module | request-response | `session.steps.ts` lines 122-170 (listing When + prompt-template Then) | exact |
| `features/step_definitions/workflow/runs.steps.ts` (modify only if needed) | step module | event-driven | itself | exact |
| `features/step_definitions/workflow/refusals.steps.ts` (probably none) | step module | -- | `skill/listing.steps.ts` | role-match |
| `features/step_definitions/workflow/companion-missing.steps.ts` (new) | step module | file-I/O (write settings + onRelease) | `git-host.steps.ts` lines 168-187, `claude-code-settings.steps.ts` 33-45 | exact |
| `features/step_definitions/workflow/lifecycle.steps.ts` (only if needed) | step module | -- | -- | n/a |
| `features/lib/workflow-files.ts` (modify: shared helpers) | fixture lib | transform | itself + `features/lib/companions.ts` | exact |
| `docs/workflows-compatibility.md` (modify, wave 3) | doc | -- | `docs/mcp-compatibility.md` (D-CF1-13 citation style, line 426) | exact |

## Module-sharing rules (binding, from `.agents/skills/cucumber/rules/layout.md`)

- Line 45: "When several verbs of one function share steps, a topic module under `step_definitions/<function>/` holds the shared steps". `workflow/listing.steps.ts` is that topic module (CONTEXT discretion). Note the rule "A shared topic module never takes the name of a verb (D-08)" -- `listing` is the WFL-01 capability name used by skill/slash-command phases too, so it is accepted precedent (`skill/listing.steps.ts` header: "Steps every skill feature shares").
- Line 46: two verb modules never define the same step text; when a second module needs a step, move it to the topic module in its own commit.
- Line 122: "A library module registers nothing and never imports a step module." Step modules importing each other is not sanctioned anywhere; no existing step module imports another (verified: every step module imports only `../../lib/*`, `test/e2e/_rpc.ts`, `support/world.ts`). **Treat step->step imports as disallowed.**
- Line 124: "A small helper private to one step module may stay in it; once a second module needs it ... it moves to `features/lib/`." The only `features/lib/` file Phase 7 may edit is `workflow-files.ts` (line 83 freezes every other lib except the six fixture writers). So **shared helpers (`progressOf`, `isRecord`, `PROGRESS_ENTRY`, `isRunFault`/`DIALOG_METHODS`, em-dash projection) move into `features/lib/workflow-files.ts`**, not into another step module. Mind that rule-of-name: no `helpers`/`shared`/`common` module.
- Line 111: a step a phase adds names its kind in its text ("workflow"), so the new steps must say "workflow" (e.g. `pi offers these workflow commands:`, `pi offers no workflow commands`, `the user runs the workflow command {string}, which starts no run`). `pi shows these notices:` does NOT name the kind -- rename to e.g. `the workflow engine shows these notices:`.
- Frozen (read-only): `command`, `session`, `companion`, `model`, `plugin/publishing` step modules; `features/lib/{companions,turn-records,pi-commands,pi-process,run-tokens,result-rows,published-marketplace}.ts`, `scripted-model/`, `pi-registry-probe/`. Import them; never edit.

## Duplication risk (fallow dupes fails on any clone group)

1. **No-run `When` vs `runs.steps.ts` lines 95-111 and `session.steps.ts` lines 69-98.** The RESEARCH Pattern 2 sketch is line-for-line the seed `When` minus `waitForRecord` (`profileHarness` / `recordCount` / `readLogLengths` / `expandTokens` / `request` / `promptDisposition` assert / `recordsSince` / `readLogLinesSince` / `modelCallsOf` assert / `recordTurn`). That is a guaranteed clone group (01-08 already had to reorder the seed against session.steps.ts). Mitigation: extract the prompt-and-collect body into one exported function in `features/lib/workflow-files.ts` (e.g. `promptWorkflowCommand(world-ish inputs, { waitFor?: predicate })`) used by both the seed `When` and the no-run `When`, so `runs.steps.ts` is refactored in the same commit. Note `features/lib` must not import `support/world.ts` as a value (type-only import is fine; `runs.steps.ts` already does `import type { ScenarioWorld }`). Run `npx fallow dupes` after.
2. **`progressOf`/`isRecord`/`endsRun` (runs.steps.ts 37-71).** The no-run `When` needs `progressOf` to assert "no progress entry"; the lifecycle stale-command check too. Move to `workflow-files.ts` rather than copy.
3. **Listing `Then` vs `session.steps.ts` 153-170** (`snapshot === undefined` -> `assert.fail`, filter/map, deepStrictEqual with header). A near-copy will cluster. Keep the filter predicate different (`source === "extension"` + `path === entry` + `name.includes(":")`) and put the snapshot-guard+projection in one function in listing.steps.ts used by both `pi offers these workflow commands:` and `pi offers no workflow commands`.
4. **companion-missing settings `Given` vs `git-host.steps.ts` 176-186 / `claude-code-settings.steps.ts` 36-40** (writeFile `wx` + `onRelease(rm)` + readback assert). Short; differing statements (resolveCompanion, JSON) should keep it under the token threshold, but check with `npx fallow dupes`.
5. Fixture feature literals: fallow does not scan `.feature`, so Background reuse is free.

## Pattern Assignments

### `features/step_definitions/workflow/listing.steps.ts` (shared topic module)

**Analog:** `features/step_definitions/session.steps.ts` (frozen; reuse its `When the user lists the slash commands pi offers`, lines 122-134, which sets `this.registrySnapshot`).

**Imports/header pattern** (`skill/listing.steps.ts` lines 1-13):
```ts
/**
 * @fileoverview Steps every workflow feature shares: ...
 */
import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import { resolveCompanion } from "../../lib/companions.ts";
import { projectTokens } from "../../lib/run-tokens.ts";
import { ... } from "../../lib/workflow-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";
```

**Listing Then to mirror** (`session.steps.ts` lines 151-170):
```ts
Then(
  "pi offers these slash commands from prompt templates:",
  function (this: ScenarioWorld, table: DataTable) {
    const snapshot = this.registrySnapshot;
    if (snapshot === undefined) {
      assert.fail("no step listed the slash commands pi offers");
    }

    const rows = snapshot.commands
      .filter((command) => command.source === "prompt")
      .map((command) => [
        projectTokens("command", `/${command.name}`, this.tokens),
        projectTokens("description", command.description ?? "", this.tokens),
      ]);
    assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
  },
);
```
Change the filter to `source === "extension" && path === (await resolveCompanion("pi-dynamic-workflows")).entry && name.includes(":")` (step becomes `async`). Registry snapshot has no compared-marker; do not call `markTurnCompared`.

**Notify records** -- shape verified in RESEARCH Q1: `record.type === "extension_ui_request" && record.method === "notify"`, fields `notifyType`, `message`. Records come from `this.requireTurn().records` (set by `this.recordTurn({...})` in the When). Notices Then (RESEARCH lines 493-500) ends with `this.markTurnCompared()` as the seed's result Then does (runs.steps.ts 129). Em dash: `const EM_DASH = "—";` (escape, never the literal), `.replaceAll(EM_DASH, "--")`.

**No-run When:** see Duplication risk 1. Assert disposition `handled`, no progress record, no model call, no `isRunFault` record (reuse moved helper), then `recordTurn`. Notify arrives before the response (RESEARCH Q1), so no `waitForRecord`.

---

### `features/step_definitions/workflow/runs.steps.ts` (seed, owned by run plan)

Full current file lines 1-131 (see above excerpts). Refactor only to consume helpers moved to `workflow-files.ts`; step texts unchanged (`the user runs the workflow command {string}`, `the workflow run ends with the status {string} and the result {string}`, the workflow Given). Args scenario needs no new step: `When the user runs the workflow command "/demo:echo first second who=Ada"` + result Then with `{"who":"Ada","_":"first second","_raw":"first second who=Ada"}`. The fixture script goes through frozen `plugin/publishing` generic file Given (`the published plugin {string} of the marketplace {string} has the file {string} with this text:`).

---

### `features/step_definitions/workflow/companion-missing.steps.ts`

**Analog:** `features/step_definitions/git-host.steps.ts` lines 168-187:
```ts
Given(
  "the user has stored a credential for the git host with the user {string} and the password {string}",
  async function (this: ScenarioWorld, user: string, password: string): Promise<void> {
    const config = path.join(this.tokens.home, ".gitconfig");
    ...
    await writeFile(config, configText, { flag: "wx" });
    this.onRelease(() => rm(config, { force: true }));
    ...
    assert.deepStrictEqual([await readFile(config, "utf8"), ...], [configText, ...]);
  },
);
```
Apply: `const file = path.join(this.tokens.agentDir, "settings.json")` (`agentDir` is a run token, `features/lib/run-tokens.ts:40`); `const { root } = await resolveCompanion("pi-dynamic-workflows")` (`companions.ts:106`, `Companion.root` = package root, line 26-27); text `JSON.stringify({ packages: [root] })`; `writeFile(..., { flag: "wx" })`; `onRelease` rm; readback assert. Step text names the kind, e.g. `the user adds the pi-dynamic-workflows package to pi's settings`. Then frozen `Given the user has started a new pi session` (`session.steps.ts`, info-only check).

---

### `features/lib/workflow-files.ts` (fixture writer, Phase 7 owned)

Current: `PluginWorkflow`, `workflowScriptText`, `publishWorkflow` (lines 1-44, imports `writePublishedPluginFile` from `./published-marketplace.ts`). Pattern for new exports: JSDoc on each export, explicit return types (`explicit-module-boundary-types`), type-only imports last (`import type { RpcRecord } from "./pi-process.ts"`; `import type { ScenarioWorld } from "../support/world.ts"` only if the prompt helper takes the world). Registers no step. Update the `@fileoverview` to cover the progress/notice readers. Script-body variants: RESEARCH Pattern 3 recommends doc strings via the generic file step, so no new writers are required.

---

### Feature files

**Header/Background analog:** `features/workflow/run.feature` (lines 1-20) and `features/skill/lifecycle.feature` (Background + one behavior per scenario, new session for each change). Title must be `Workflow <capability>` from file name (`Workflow listing`, `Workflow refusals`, `Workflow companion missing`, `Workflow lifecycle`); only `Given/When/Then` keywords (no `And`/`But`); one negative control per file; full tables.

Profile Pi Given from seed:
```gherkin
    Given pi runs with the scripted model and these companions:
      | companion            |
      | pi-dynamic-workflows |
```
Without engine: `Given pi runs with the scripted model`. Warning setup: `Given the user has run "...", which warned` (command.steps.ts:70) only when all payloads warn (uninstall, disable, no-engine install); refusal install and rename-update use `When the user runs` + `the command reports these results:` / `the results list these marketplaces and plugins:` (command.steps.ts 124, 144). Version bump: `Given the marketplace "fixtures" offers these plugins:` `| demo | 1.1.0 |` + generic file Given overwriting `workflows/hello.js` (skill/lifecycle.feature lines 50-62 shape). Note `publishWorkflow` uses `wx`; overwrite only through the generic file step.

---

### `docs/workflows-compatibility.md` (wave 3)

Sections to touch: `### Admit-versus-run divergence` (line 54, add Claude Code column/row for D-CF7-04), `## Install-time disposition` (line 242, D-CF7-03 timing), `## Naming` (line 164), plus run approval (D-CF7-01) and args (D-CF7-02). Citation style analog `docs/mcp-compatibility.md:426`: "... Claude Code reads ... Reason: a Pi capability gap (D-CF1-13). <mechanism>." and in-doc `(D-CF1-06)` at `workflows-compatibility.md:38,50`. No em dashes (texthooks).

## Shared Patterns

- **Turn recording:** `this.recordTurn({ prompt, disposition, records, logs })` then a Then reads `this.requireTurn().records` and calls `this.markTurnCompared()` (runs.steps.ts 109, 118, 129).
- **Model-free check:** `modelCallsOf(await readLogLinesSince(harness, lengths))` must be `[]` (runs.steps.ts 100, 107-108).
- **Fixture Given readback:** every write Given asserts the file text it wrote (runs.steps.ts 85-88, skill/listing.steps.ts 27-30).
- **Cleanup:** `this.onRelease(() => rm(file, { force: true }))` immediately after the write.
- **Tables:** project to string rows with header, `deepStrictEqual(..., table.raw())` (steps.md line 70).

## No Analog Found

None. (`refusals.steps.ts`/`lifecycle.steps.ts` should likely not exist: research found all needed steps are shared or frozen; `check:features` fails on unused steps, so do not create empty modules.)

## Metadata

**Analog search scope:** `features/**`, `.agents/skills/cucumber/rules/*`, `docs/*-compatibility.md`
**Files scanned:** ~15
**All analog paths tracked:** yes (repo source, no mirrors)
