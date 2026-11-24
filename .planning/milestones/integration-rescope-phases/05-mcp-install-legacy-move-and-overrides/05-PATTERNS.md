# Phase 5: MCP Install, Legacy Move, and Overrides - Pattern Map

**Mapped:** 2026-11-22
**Files analyzed:** 17 (5 feature files, 4 step modules, 3 trimmed integration files, 5 deletions)
**Analogs found:** 17 / 17 (all analogs are git-tracked; the five deletions need none beyond the trim headers)

Validated ready-to-apply code for every step and scenario: `research-05/intree-final.diff` and `research-05/steps.diff` in the research scratchpad (05-RESEARCH.md "Ready-to-apply patch"). The patterns below say which existing code each addition copies, so an executor can check the patch against them.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/step_definitions/mcp-implementation.steps.ts` (S1, 05-01) | test step (Given) | profile Pi launch | same file `:48-54` ("pi runs with the scripted model and the mcp implementation") | exact |
| `features/step_definitions/session.steps.ts` (S2, 05-02) | test step (Given) | event (session start) | same file `:71-79` ("the user has started a new pi session") | exact |
| `features/step_definitions/mcp-server/legacy-move.steps.ts` (S3 + `mcpJsonText`, 05-02) | test step (Given) | file write | same file `:19-39` | exact (must share helper, fallow dupes) |
| `features/step_definitions/mcp-server/lifecycle.steps.ts` (S4, S5, 05-03) | test step (Given) | file read-modify-write | same file `:23-38`, `:49-61` | exact |
| `features/mcp-server/configuration.feature` (05-01) | behavioral scenario | request-response | same file `:10-60` (`@mcp`), `:63`/`:149` licensed pairs | exact |
| `features/mcp-server/options.feature` (05-01) | behavioral scenario | request-response | same file `:15-30` | exact |
| `features/mcp-server/legacy-move.feature` (05-02) | behavioral scenario | load event | same file `:7-30` | exact |
| `features/mcp-server/verdict-list.feature` (05-02) | behavioral scenario | request-response | same file `:14` / `:39` (MREC-03 `@adapter-only`/`@builtin-only` pair) | exact |
| `features/mcp-server/lifecycle.feature` (05-03) | behavioral scenario | request-response | same file; description `:3-30` needs an update | exact |
| `test/integration/mcp-migration.test.ts` (trim to `:749`) | integration test | fault injection | header of `test/integration/standalone-prune.test.ts:1-12` | role-match |
| `test/integration/mcp-verdict-migration.test.ts` (drop `:210`) | integration test | load | same | role-match |
| `test/integration/mcp-verdict-list.test.ts` (drop `:139`) | integration test | request-response | same | role-match |
| delete `test/integration/mcp-{home-path-partial,tool-rules,variable-expansion,legacy-sweep,override-lifecycle}.test.ts` | deletion | - | - | n/a |
| `05-0N-SUMMARY.md` (red proofs) | planning record | - | `.planning/phases/04-prune/04-01-SUMMARY.md` `## Red proofs` (`:127-170`), `## Case map` (`:171-190`), `## Checks` (`:194+`) | exact |

## Pattern Assignments

### `features/step_definitions/mcp-implementation.steps.ts` (S1)

**Analog:** same file. Imports `:19-29`:
```ts
import assert from "node:assert/strict";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { nameStandInServer } from "../lib/builtin-mcp-stand-in/servers.ts";
import { allowProjectServersForUser } from "../lib/mcp-configuration.ts";
import { mcpImplementationLaunch, waitForStubListing } from "../lib/mcp-implementation.ts";
import { expandTokens } from "../lib/run-tokens.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../support/world.ts";

import type { PiRestart, ScenarioWorld } from "../support/world.ts";
```
Add `import { rm } from "node:fs/promises";` (builtin group) and `PI_LAUNCH_ENVIRONMENT_EXTENSION`, `readAppliedLaunchEnvironments`, `writeLaunchEnvironment` from `../lib/pi-launch-environment.ts` (alphabetical, internal group).

Core pattern `:48-54` (copy the timeout option and `usePiWithProfile` call; S1 spreads `launch` and appends the env extension):
```ts
Given(
  "pi runs with the scripted model and the mcp implementation",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile(mcpImplementationLaunch(this.mcpProfile));
  },
);
```
Comment convention: each Given has a one-to-three-line "why" comment above it citing an ID (`:37-39`, `:66-68`). S1's validated body is in RESEARCH.md Code Examples; it registers cleanup with `this.onRelease(() => rm(file, { force: true }))` and asserts the applied environment.

### `features/step_definitions/session.steps.ts` (S2)

**Analog:** `:71-79`; place S2 directly after it, before `When("the user starts a new pi session", ...)` (`:81`):
```ts
// startSession asserts that the session started; the setup keeps nothing on
// the world, and like a setup command it must report nothing but info.
Given("the user has started a new pi session", async function (this: ScenarioWorld) {
  const { payloads } = await startSession(this.pi);
  assert.deepStrictEqual(
    payloads.filter((payload) => payload.severity !== "info"),
    [],
  );
});
```
S2 flips to `severity !== "warning"` plus `assert.notDeepStrictEqual(payloads, [])`, mirroring the "which warned" naming of command setup steps. Pitfall 2: Pi reports a lasting load warning twice; the "session reports these results" Then (`:207-214`) states both rows.

### `features/step_definitions/mcp-server/legacy-move.steps.ts` (S3 + helper)

**Analog:** `:19-39` (the existing Given). Imports `:7-17` already hold everything except `mkdir` from `node:fs/promises`. The body `:26-36` is the 5+ line block fallow flagged; extract it into `mcpJsonText(world, scope, text)` returning `{ file, expanded, markedNames }` and make both Givens call it (exact code in RESEARCH.md Code Examples). Existing body to refactor:
```ts
    const file = path.join(this.scopeRoot(scope), "mcp.json");
    const expanded = expandTokens(text, this.tokens);
    const doc: unknown = JSON.parse(expanded);
    assert.strictEqual(expanded, `${JSON.stringify(doc, null, 2)}\n`);
    const servers: unknown = isPlainObject(doc) ? Reflect.get(doc, "mcpServers") : undefined;
    assert.ok(isPlainObject(servers), `the text for ${file} holds no mcpServers object`);
    const markedNames = Object.keys(servers).filter((name) => { ... "_piClaudeMarketplace" in entry; });
    assert.deepStrictEqual(markedNames, []);
    await writeScenarioFile(this, file, expanded);
```
Keep the existing Given's pretty-print assertion; S3 asserts `markedNames` non-empty instead. Update the `@fileoverview` (`:1-5`) to mention the release 0.19.2 marked entries.

### `features/step_definitions/mcp-server/lifecycle.steps.ts` (S4, S5)

**Analog:** `:23-38` (`isRecord`, disable step) and `:49-61` (written fields). Current imports `:10-21`: `readFile` only from fs, `writeMcpAdapterOverride`/`writeRelease0230McpAdapterEntry` from `../../lib/mcp-server-files.ts`. Add `mkdir`, `writeFile`; `expandTokens` (`../../lib/run-tokens.ts`); `writeScenarioFile` (`../../lib/scenario-file.ts`).
```ts
Given(
  "the user has disabled the mcp server {string} in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, { disabled: true });
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);
```
S4 copies the path/assert-back shape and reuses the local `isRecord` guard; its comment cites pi-mcp-adapter 7.0.1 `/mcp-adapter enable` (no real driver; RESEARCH "harness does not drive"). S5 copies the `writeScenarioFile` + `expandTokens` write from legacy-move `:37`. Extend `@fileoverview` (`:1-8`) with the enable choice and whole-file write.

### Feature files

**`@mcp` scenario shape** (`legacy-move.feature:7-30`, `configuration.feature:10-25`): Given marketplace published as dir source / offers table / declares server / added to scope; `When the user runs ...` or `When the user starts a new pi session`; Then tables `the command reports these results:` / `the session reports these results:` and whole-file `the mcp configuration file "<f>" of the <scope> scope holds this text:` doc strings. Loopback hosts only (`http://127.0.0.1:9/...`, `configuration.feature:19`). An `@mcp` scenario never names `pi-mcp-adapter` in a step or cell.

**Licensed pair** (`verdict-list.feature:14` and `:39`): same title stem, suffix ", under pi-mcp-adapter (MREC-03)" / ", under Pi's built-in MCP (MREC-03)", tagged `@adapter-only` / `@builtin-only`. No existing scenario uses a `#` comment line (grep found none), so the licensing ID goes in the title parentheses as here and in the Feature description; the MCPMIG-01 note on the e15 scenario is a `  # ...` comment line directly above its tag (new convention, keep it one line naming `.planning/BACKLOG.md` MCPMIG-01).

**Descriptions:** each Feature description lists the IDs it covers and what stands in for real things (`legacy-move.feature:3-5`, `verdict-list.feature:3-12`). 05-02 adds AMIG-02..04 to legacy-move and MREC-02, D-P3-16 to verdict-list; 05-03 rewrites `lifecycle.feature:6-8` ("exist only for pi-mcp-adapter") because the moved override scenarios are `@mcp`.

**Unchanged claims:** whole-scope `the files of the {word} scope are remembered` / `... are unchanged` (`scope-state.steps.ts:64`, `:71`), never key samples.

### Integration trims

**Analog header:** `test/integration/standalone-prune.test.ts:1-12`:
```ts
// test/integration/standalone-prune.test.ts
//
// Two cases of `/claude:plugin prune` through the registered command, kept
// for the calls that must not happen (ITSCOPE-01). ... Everything a
// user can see of prune is in `features/plugin/prune.feature`,
// `features/plugin/state-lock.feature`, and
// `features/plugin/usage-errors.feature`.
```
Replace the current headers (`mcp-migration.test.ts:1-5`, `mcp-verdict-migration.test.ts:1-7`, `mcp-verdict-list.test.ts:1-5`) with: path line, blank `//`, what cases are kept and why they are internal (refused write between the two writes = fault injection, ITSCOPE-01; released-build record internals for Phase 8), then the feature files that hold the user-visible behavior. Remove helpers/imports listed in RESEARCH.md "Helpers after the trim" (tsc `noUnusedLocals`); keep `mcp-plugin-seed.ts`, `test/platform/mcp-status-seed.ts`, `test/chmod-denial.ts`.

## Shared Patterns

### Red proofs in SUMMARY.md
**Source:** `.planning/phases/04-prune/04-01-SUMMARY.md:127-190`
**Apply to:** every Phase 5 plan SUMMARY
- Bullets: scratch folder `$D`, `root=` worktree line, plan base sha, helper `break.sh` (roots at `git rev-parse --show-toplevel`, refuses dirty `extensions/`, EXIT trap `git checkout -- extensions/`, logs `exit=`/`restored=`), green runs per profile with scenario counts.
- One bullet per break: `**ID** (log)`: `file:line`, `-old` / `+new`, `N scenarios (x passed, y failed)`, `exit=1`, failed scenarios by `file:line` and the failing Then step. Accepted survivors stated explicitly.
- `## Case map` table: `Case at <sha> | Replaced by | Break`, with "kept, internal (...)" rows.
- `## Checks` table: `Command (script) | Tree | Exit | Result`.
- Phase 5 adds both profiles per break (`@mcp`), and the `fallow audit` `weakened-tests` warn for each deleted/trimmed file, recorded and not acted on.
- `## Threat Flags` section required (AGENTS.md).

### Step module conventions
`@fileoverview` block, ID-citing comment above each step, `import type { ScenarioWorld }` last, every new step used by a scenario (`check:features`), `npm run fallow` after any step change (Pitfall 5).

## No Analog Found

None. The `# MCPMIG-01` comment line above a scenario tag has no precedent in `features/mcp-server/`; keep it to one line.

## Metadata

**Analog search scope:** `features/mcp-server/`, `features/step_definitions/{,mcp-server/}`, `test/integration/`, `.planning/phases/04-prune/`
**Files scanned:** 14
**Pattern extraction date:** 2026-11-22
