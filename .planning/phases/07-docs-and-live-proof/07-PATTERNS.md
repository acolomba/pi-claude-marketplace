# Phase 7: Docs and live proof - Pattern Map

**Mapped:** 2026-10-09
**Files analyzed:** 22 (5 new, 17 modified)
**Analogs found:** 21 / 22

All analog paths below are git-tracked (`git ls-files tests/live-uat` verified). Probe prototypes under `/var/tmp/mcp4-p7-research/probes/` are untracked scratch: copy their logic, never cite them as a path in source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/live-uat/mcp-adapter-canary.mjs` (new) | test (operator canary) | event-driven (RPC JSONL) | `tests/live-uat/stop-canary.mjs` (skeleton) + `tests/e2e/_rpc.ts` (RPC driver) | exact (combined) |
| `tests/live-uat/openai-stub-server.mjs` (modify: `STUB_SCRIPT` mode) | utility (HTTP stub) | request-response / streaming | itself + `/var/tmp/mcp4-p7-research/probes/stub-scripted.mjs` | exact |
| `tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json` (new, name at discretion) | test fixture | file-I/O (seed) | captured sandbox `/var/tmp/mcp4-p7-research/s1/agent/` | no in-repo analog (format in RESEARCH "Seed fixture format") |
| sandbox helper extension (written by canary at run time, `<sandbox>/helper/canary-helper.ts`) | extension (generated) | event-driven | `/var/tmp/mcp4-p7-research/probes/canary-reload.ts` | prototype only |
| stdio MCP server (written by canary into `<sandbox>/mkt/plugins/echo/server.mjs`) | fixture server | request-response (JSON-RPC stdio) | RESEARCH Pattern 4 | prototype only |
| `tests/live-uat/README.md` | docs | -- | its own "Engine agent() failure canary" + "Stop contract canary" sections | exact |
| `package.json`, `package-lock.json` | config | -- | prior floor raise (`261007-9a2-SUMMARY.md:140-142`) | exact |
| `scripts/pi.sh` (pin + `-e builtin:tool-search`) | config/script | -- | itself lines 110-114 | exact |
| `.github/workflows/ci.yml` | config | -- | itself lines 115-125 | exact |
| `tests/architecture/peer-floor.test.ts` | test | -- | itself lines 84-123 | exact |
| `tests/bridges/mcp/adapter-entry.test.ts` (lines 13, 54, 1047, 1073) | test | -- | itself | exact |
| `extensions/.../bridges/mcp/adapter-doc.ts:4`, `platform/mcp-status.ts:40` | source comment | -- | itself | exact |
| `tests/integration/mcp-override-lifecycle.test.ts:334,467` (optional) | test comment | -- | itself | exact |
| `docs/mcp-compatibility.md` | docs | -- | its own divergence list lines 228-249 | exact |
| `README.md`, `README.es.md` | docs | -- | existing "see [MCP compatibility](docs/mcp-compatibility.md)" sentences, line 40 | exact |
| `docs/env-vars.md` | docs | -- | `docs/mcp-compatibility.md` Variables section | role-match |
| `docs/hooks-compatibility.md` | docs | -- | its lines 82-83, 108-110 | exact |
| `docs/prd/pi-claude-marketplace-prd.md` | docs | -- | its SC-2 (530) / NFR-10 (1047) already-updated text | exact |
| `docs/output-catalog.md:2607` | docs (build input: `catalog-contract`) | -- | itself | exact |
| `CHANGELOG.md` | docs | -- | `[Unreleased]` grouped bullets (#246 bullet, lines 7-11) | exact |
| `.planning/REQUIREMENTS.md` PIFL-03, `.planning/ROADMAP.md` settled decision 5 | planning | -- | -- | n/a |

## Pattern Assignments

### `tests/live-uat/mcp-adapter-canary.mjs` (operator canary, event-driven)

**Analog A (skeleton):** `tests/live-uat/stop-canary.mjs`

**Header** (lines 1-10): copy verbatim, including the `fallow-ignore-file unused-file` marker (CONTEXT D-07-02), then the "imports only `../pi-runtime.ts`, nothing from a `tests/live-uat/` sibling" paragraph:
```js
// tests/live-uat/stop-canary.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
```
Then an honesty-contract block listing exit codes (stop-canary lines ~37-46): 0 proven, 1 `human_needed`, optional 2 regression.

**Imports** (lines 49-59) — keep only node builtins + `resolvePiRuntime`. Do NOT import `extensions/.../index.ts`, `locationsFor`, `loadState` (stop-canary does in-process install; RESEARCH anti-pattern: everything goes through the real Pi child; also adding them would add fallow-graph edges and leave the file runnable only with TS strip):
```js
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolvePiRuntime } from "../pi-runtime.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const EXTENSION_ENTRY = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace", "index.ts");
```

**Exit routing** (lines ~83-120): `UatExit` class + `liveRuntimeRequired(reason, detail)` printing `[<canary>] LIVE RUNTIME REQUIRED -- not proven, routing human_needed:` then `throw new UatExit(reason, EXIT_HUMAN_NEEDED)`; `pass(msg)` prints `[stop-canary] PASS: ${msg}` (line 242-244). Rename prefix to `[mcp-adapter-canary]`.

**Preconditions** (lines 247-310, `parseVersion`, `meetsFloor`, `assertPreconditions`): reuse `parseVersion`/`meetsFloor` and the `resolvePiRuntime(REPO_ROOT)` try/catch + `>= 1.0.0` check verbatim. Replace the `PI_CODING_AGENT_DIR`-inside-`tmp/pi-uat` check with: `PI_MCP_ADAPTER_ROOT` set, its `package.json` `version === "5.2.0"` (D-07-03), and `realpath(tmpdir())` outside `REPO_ROOT` (the `_rpc.ts` rule, lines 130-154; sandbox inside the repo triggers project-trust prompts).

**main/finally/top-level handler** (lines 519-633): copy the shape exactly — `const root = await mkdtemp(path.join(tmpdir(), "mcp-adapter-canary-"))`; all assertions inside `try`; `finally` kills stub + Pi process groups, then `rm(root, { recursive: true, force: true })`; tail:
```js
main().then(
  () => process.exit(0),
  (err) => {
    if (err instanceof UatExit) {
      process.exit(err.exitCode);
    }
    console.error(`\n[stop-canary] LIVE RUNTIME REQUIRED -- unexpected harness error:`);
    console.error(String(err?.stack ?? err));
    process.exit(1);
  },
);
```

**Negative control:** `tests/live-uat/workflow-storage-canary.mjs` line 51 and 233:
```js
const INVERT = process.argv.includes("--invert");
...
assert.equal(loaded.script === original, !INVERT, `${label} W2: ...`);
```
Flip exactly one expectation (e.g. the route-A echo text).

**Marketplace builder:** stop-canary `buildCanaryMarketplace(root, markerFile)` (line ~320) writes a path-source marketplace on disk; mirror it for the `echo` plugin (manifest from RESEARCH Pattern 4: `{"name":"echo","version":"1.0.0","mcpServers":{"echo":{"command":"node","args":["${CLAUDE_PLUGIN_ROOT}/server.mjs"]}}}`), matching the s1 capture layout (`mkt/plugins/echo/`).

**Analog B (RPC driver):** `tests/e2e/_rpc.ts` — port to plain JS inside the canary (the `.mjs` cannot import a sibling and `_rpc.ts` lacks event capture; RESEARCH Pitfall 4).

Child env allowlist (lines 156-163):
```ts
function childEnvironment(sandbox) {
  return { HOME: sandbox.home, PI_CODING_AGENT_DIR: sandbox.agentDir, PI_OFFLINE: "1", PATH: process.env.PATH ?? "" };
}
```
Arguments (lines 165-175): `[cliPath, "--mode", "rpc", "--offline", "--no-session", ...["--extension", p] for EXTENSION_ENTRY, $PI_MCP_ADAPTER_ROOT/index.ts, helper]`. Note `_rpc.ts` header (line 11): never pass `--no-extensions` in the main sessions; only the step-7 probe session uses it.
Other functions to mirror: `handleUiRequest` (205-220, notify capture from `extension_ui_request` `method: "notify"`, dialogs answered `{ type: "extension_ui_response", id, cancelled: true }`), `killProcessGroup` (259-271, `process.kill(-child.pid, "SIGKILL")`, spawn with `detached: true`), `armStops` (273-288 hard-stop timer), `advance`/`handleResponse` (182-203). Additions per RESEARCH Pattern 3: collect `tool_execution_end` events; advance a model prompt on `agent_settled`, not `response`; add wait steps (`/canary-wait`) for async startup notifies.

**Assertion targets:** verbatim strings in RESEARCH "What was observed live": `echo -> plugin_echo_echo_ (echo) [user]`, `mcp: plugin:echo:echo (not loaded)` / `(cached, connects on first use)` / `(status unknown)` / `(connected)`, `details.matches[0].tool === "mcp__plugin_echo_echo__echo_canary"`, result text `echo-canary:hi`, `tool_search` `details.loaded`.

---

### `tests/live-uat/openai-stub-server.mjs` (modify)

**Analog:** itself (91 lines). Keep header style (lines 1-17); extend the `Env:` line with `STUB_SCRIPT`. Keep `sendStream`/`sendCompletion` (lines 41-70) as the default `ready` path. Add a tool-call variant of each, from RESEARCH Pattern 1:
```js
const call = { index: 0, id: `call_${idx}`, type: "function",
  function: { name: step.tool, arguments: JSON.stringify(step.arguments) } };
res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }] })}\n\n`);
res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }], usage: USAGE })}\n\n`);
res.end("data: [DONE]\n\n");
```
Step index = count of `role:"tool"` messages after the last `role:"user"`; script chosen by a marker in the last user message; past the end of a script, reply `ready`. Full prototype: `/var/tmp/mcp4-p7-research/probes/stub-scripted.mjs`, scripts `script.json`/`script2.json`. `logRequest` (lines 35-39) already logs `tools` names, which the canary reads for the first-request / `--no-extensions` checks — do not change its shape. Keep the stop-canary default behavior (no `STUB_SCRIPT` => `ready`), so stop-canary's Observed result stays valid.

---

### Seed fixture (new JSON)

No in-repo analog. Use RESEARCH "Seed fixture format": wrapper `{ "$comment", "capturedWith", "captureCommand", "sandboxRoot": "@@SANDBOX@@", "files": { "mcp.json", "pi-claude-marketplace/state.json", "claude-plugins.json" } }`, built from `/var/tmp/mcp4-p7-research/s1/agent/`. Prettier formats `.json` (format:check covers json) — run prettier on it. No `/home/<user>` paths.

---

### `tests/live-uat/README.md`

**Analog:** its own sections. Table rows lines 5-10 (add a fifth row, "All four" -> "All five"). Section skeleton from "Engine `agent()` failure canary" (lines 61-150): `### Prerequisites` (two-column table; scratch install row text at line 69: `npm install --prefix /var/tmp/... <pkg>@<ver>`, prefix outside the repo, never in package.json), `### Run`, `### What it asserts (exit 0 conditions)`, `### What it routes to human_needed (exit non-zero)`, `### The negative control` (lines 101-111: bash block with `--invert`, "Expect exit 1 naming ..."), `### Observed result (<date>, adapter 5.2.0, pi 1.0.0)` with verbatim output in a `text` fence and the exit status appended by the shell (pattern at lines 381-400). Line ~301 stub description: add `STUB_SCRIPT`. Formatted by mdformat, not prettier.

---

### Floor raise (D-07-07) — config/test/comment edits

Exact edits, all verified in RESEARCH "Every 5.1.0 hit, classified":
- `package.json:61` `">=5.1.0 <6"` -> `">=5.2.0 <6"`; lock via `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` (expect a 1-line diff at `package-lock.json:44`; leave `estraverse ^5.1.0`).
- `scripts/pi.sh:111` inside `pi_cm_pins=( ... )` -> `"pi-mcp-adapter@5.2.0"`. Optional `-e builtin:tool-search` beside the existing `-e` flags (RESEARCH recommendation); keep `builtin:mcp` off.
- `.github/workflows/ci.yml:121` `pi-mcp-adapter@5.1.0` -> `@5.2.0`; keep the `# zizmor: ignore[adhoc-packages]` tail and the comment block at 115-118.
- `tests/architecture/peer-floor.test.ts:84,93,122` — test title and two `assert.equal(..., ">=5.1.0 <6")`. Keep the AAA `// arrange // act // assert` layout.
- `tests/bridges/mcp/adapter-entry.test.ts:13,54,1047,1073` — label `5.2.0`, shasum `9950f0b4423371c7a7839d67d7e20cade3debc69`, range `>=5.2.0 <6`.
- `bridges/mcp/adapter-doc.ts:4`, `platform/mcp-status.ts:40` — version word only (no other change; keeps the source/test pair untouched).
- Leave: `tests/orchestrators/**` `toVersion: "5.1.0"` fixtures, PRD `5.1` section numbers, `docs/mcp-compatibility.md:57` dated measurement.

---

### `docs/mcp-compatibility.md`

**Analog:** its own divergence bullets (lines 228-249). Every bullet: one-sentence behavior, the Claude Code contrast, then `Reason: a project decision (<REQ-ID>).` or `Reason: a Pi capability gap.` plus one explanatory sentence. Example (line 230):
```markdown
- Servers start lazily. pi-mcp-adapter stops a server when it is not in use, and Claude Code keeps it connected for the session. Reason: a project decision (ANAME-05). This extension leaves `lifecycle` to you, so you can change it for each server.
```
Regroup under `###` subheadings (naming, loading, variables, migration, status) without rewording existing bullets. Version line 226 and basis line 7 per RESEARCH table. New sections (Upgrading, Server status in info, adapter settings) use `##` and the same plain active-voice style; quote catalog text from `docs/output-catalog.md` verbatim.

### `README.md` / `README.es.md`
Line 40 version, Spanish twin `5.1.0 o una versión 5.x posterior`. Linking sentence pattern: ends in "see [MCP compatibility](docs/mcp-compatibility.md)". Edit both in the same commit.

### `docs/env-vars.md`, `docs/hooks-compatibility.md`, PRD, `docs/output-catalog.md`
Line-level fix lists in RESEARCH "Docs gap inventory" are the pattern; PRD SC-2 (line 530) and NFR-10 (line 1047) already carry the target wording and are the model for the overview/7.2/9.2/App. B edits. `output-catalog.md:2607` is a `catalog-contract` build input: change the version word only.

### `CHANGELOG.md`
**Analog:** `[Unreleased]` lines 3-11 — top-level `- ` bullet, sentence-style, PR number in parentheses at the end, blank line between bullets, two-space-indented sub-bullets:
```markdown
- More plugins with components that Pi cannot install are now partially available. Pass `--partial` to install the components that Pi supports. (#246)

  - A hooks module (a non-empty `modules` array in a hooks file) makes its plugin partially available. ...
```
Replace line 5 (the 5.1.0 bullet). Leave the main-side bullets untouched. Version heading format for the later bump: `## [0.19.2] - 2026-09-24` (line 72).

## Shared Patterns

### Canary honesty contract
**Source:** `tests/live-uat/stop-canary.mjs` lines 37-46, 83-120, 519-633. **Apply to:** the new canary. Never a false pass; teardown in `finally`; exit code never read through a pipe; `--invert` negative control run before trusting PASS.

### Sandbox containment
**Source:** `tests/e2e/_rpc.ts` lines 109-154 (`isInside`, `resolveLocation`, `resolveSandbox`, refuse outside `realpath(tmpdir())` and inside the repo). **Apply to:** canary sandbox; run with `TMPDIR=/var/tmp/<dir>`.

### Scratch companion install
**Source:** `tests/live-uat/README.md:69`. **Apply to:** canary Prerequisites (`npm install --prefix /var/tmp/... pi-mcp-adapter@5.2.0`, `PI_MCP_ADAPTER_ROOT=<prefix>/node_modules/pi-mcp-adapter`, same env var the integration conformance tests read).

### Divergence license wording
**Source:** `docs/mcp-compatibility.md:228-249`. **Apply to:** every new divergence in mcp-compatibility, env-vars, hooks docs. Cite requirement IDs, never `D-07-NN`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| seed fixture JSON | fixture | file-I/O | no captured-legacy fixtures exist under `tests/live-uat/`; use RESEARCH format + `/var/tmp/mcp4-p7-research/s1` |
| helper extension + stdio MCP server | generated at run time | event-driven / JSON-RPC | only untracked probes (`probes/canary-reload.ts`, RESEARCH Pattern 4); write them as string templates inside the canary, not as tracked files |

## Metadata

**Analog search scope:** `tests/live-uat/`, `tests/e2e/`, `tests/architecture/`, `scripts/`, `.github/workflows/`, `docs/`, `CHANGELOG.md`
**Files scanned:** 12
**Pattern extraction date:** 2026-10-09
