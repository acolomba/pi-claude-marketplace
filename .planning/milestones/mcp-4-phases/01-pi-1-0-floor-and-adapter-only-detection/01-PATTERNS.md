# Phase 1: Pi 1.0 floor and adapter-only detection - Pattern Map

**Mapped:** 2026-10-02
**Files analyzed:** 22 (new + modified groups)
**Analogs found:** 21 / 22

All paths are git-tracked source on `features/mcp-4`. Code on `features/mcp` is a
specification only (`git show features/mcp:<path>`); never cherry-pick (line:col
contract pins differ).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/platform/pi-api.ts` (probe, `ToolInventory` rename) | platform probe | request-response (read Pi inventory) | same file, `hasLoadedPiSubagents` / `hasLoadedWorkflowEngine` (lines ~152-199) | exact |
| `extensions/pi-claude-marketplace/shared/notification-grammar.ts` (info `requires:` line) | renderer | transform | same file, `appendDependenciesLine` (~1372-1385) and `notes` loop in `renderPluginInfo` (~1466-1513) | exact |
| `extensions/pi-claude-marketplace/shared/notification-types.ts` (info row field if orchestrator-stamped; `"requires pi-mcp"` -> `"requires pi-mcp-adapter"` at :27) | model (closed vocab) | n/a | `PluginInfoRowBase.notes` (~838-855) | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (only if the requires list is stamped by the orchestrator) | orchestrator | request-response | same file, `advisoryFields` (1040-1042) + its spread sites (1793, 2078, 2183) | exact |
| `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` (marker const :35) | utility | transform | `softDepMarkers` (lines 54-77) | exact |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (:108 partition) | model | n/a | in place | exact |
| `extensions/pi-claude-marketplace/shared/notify-context.ts` (:345-346 lint fix) | utility | transform | RESEARCH Pattern 2 (verified) | exact (in place) |
| `docs/output-catalog.md` (new info `catalog-state` blocks; marker rename; IN-03) | doc / contract | n/a | `<!-- catalog-state: installed-single-scope-with-dependencies -->` (~2578-2592) | exact |
| `tests/platform/pi-inventory-seed.ts` (NEW: `toolInfo`, adapter/builtin/foreign seeds, `emptyPiInventory`) | test support | n/a | `toolInfo` copies at `tests/architecture/workflows-marker-coverage.test.ts:97-109`, `list-flow.test.ts:78`, `reinstall.messaging.test.ts:62`; support-module shape of `tests/platform/hermetic-environment.ts` | role-match |
| `tests/edge/notification-boundary.ts` (`expectSoftDepProbes`) | test support | n/a | same file `toolProbes` block (~94-116); spec `features/mcp` `81d609b5`/`20e2bb16`/`284b1bad` | exact |
| `tests/e2e/_helpers.ts` (`makeMockPi` gains `commands`) | test support | n/a | same file `makeMockPi` (57-83) | exact |
| `tests/e2e/_rpc.ts` (NEW) | test harness | streaming (JSONL stdio) | `git show features/mcp:tests/e2e/_rpc.ts`; `tests/pi-runtime.ts`; `tests/platform/hermetic-environment.ts` | exact (spec) |
| `tests/e2e/adapter-detection-rpc.test.ts` (NEW, name discretionary) | e2e test | request-response | `git show features/mcp:tests/e2e/builtin-mcp-rpc.test.ts` (invert semantics) | exact (spec) |
| `tests/e2e/install-soft-deps.test.ts` | e2e test | n/a | in place (extend matrix, close `"{requires pi-mcp"` at :15-16) | exact |
| `tests/platform/pi-api.test.ts` | unit test | n/a | in place (fixtures at :307, :424) | exact |
| `tests/integration/pi-subagents-peer.ts` (NEW shared loader) | test support | file-I/O | duplicated loaders in `tests/integration/provenance-invisibility.test.ts` and `skill-path-resolution.test.ts` | role-match |
| `tests/architecture/peer-floor.test.ts` (Pi `>=1.0.0`, new pi-subagents + pi-mcp-adapter cases) | architecture test | file-I/O | same file FLOOR-01 cases (lines 1-40+) | exact |
| `tests/live-uat/openai-stub-server.mjs` (NEW) | live-UAT driver | request-response (HTTP) | `tests/live-uat/stop-canary.mjs` header (lines 1-6) | role-match |
| `tests/live-uat/stop-canary.mjs`, `tests/live-uat/README.md` | live-UAT | n/a | spec `4f82096f`, `0febc4ea`, `4460d902`, `e0ccc16e` | exact (spec) |
| Closed-set gates (`compat-01-no-expansion`, `notify-closed-set-locks`, `closed-set-enrollment`, `partial-vocabulary-guard`, `tests/shared/notification-types.test.ts`) | architecture test | n/a | in place amendments | exact |
| `package.json`, lock, `scripts/check-unused-type-members.contracts.json`, `scripts/pi.sh`, `.github/workflows/lint.yml`, `AGENTS.md`, `.planning/PROJECT.md`, PRD, READMEs, `docs/workflows-compatibility.md` | config / docs | n/a | RESEARCH Patterns 1, 8, 9 (exact edits listed) | n/a |
| info `requires:` catalog UAT fixtures | test | n/a | `tests/architecture/catalog-uat/catalog-contract.test.ts` byte-compare + `mock-pi.ts` | role-match |

## Pattern Assignments

### Info `requires:` line (D-01-18) — `notification-grammar.ts` (+ types/info.ts)

**Analog 1 — the trailing optional line** (`shared/notification-grammar.ts` ~1372-1385):
```ts
/**
 * Appends the optional `    dependencies: <list>` line. Both `renderPluginInfo`
 * arms end with this line, so it is LAST: after every per-kind line on the
 * resolved arm and after the `components: not resolved` marker on the
 * unresolved arm (INFO-02 / D-01-32).
 */
function appendDependenciesLine(
  lines: string[],
  dependencies: readonly string[] | undefined,
): void {
  if (dependencies !== undefined && dependencies.length > 0) {
    lines.push(`    dependencies: ${dependencies.join(", ")}`);
  }
}
```

**Analog 2 — line order inside `renderPluginInfo`** (~1466-1513). Current order:
row line -> description -> per-kind components (or `components: not resolved`) ->
`dependencies:` -> `note:` lines. The row brace is
`composeReasons(plugin.reasons, false, false, false, probe)` — all declares-flags
false, so info never emits `{requires …}` (keep: D-01-18 says no brace on the
info row). Note `probe: SoftDepStatus` is ALREADY threaded into
`renderPluginInfo` and documented "unused on the info path" — the doc comment
(~1453-1463, "info messages NEVER emit soft-dep markers", "`probe` ... unused")
must be restated when the requires line consumes it.
```ts
  switch (plugin.componentsResolved) {
    case true:
      appendResolvedComponentLines(lines, plugin.components, plugin.dependencies);
      break;
    case false:
      lines.push("    components: not resolved");
      appendDependenciesLine(lines, plugin.dependencies);
      break;
  }
  for (const note of plugin.notes ?? []) {
    lines.push(`    note: ${note}`);
  }
```
Planner choice (record it): (a) render-time — derive kinds from
`plugin.components.{agents,mcp,workflows}` + `probe` in the grammar, mirroring how
`softDepMarkers` (`shared/concerns/soft-dep.ts:54-77`) computes markers at render
time from declares-flags + probe (the established soft-dep precedent); or (b)
orchestrator-stamped field on `PluginInfoRowBase`, mirroring `notes`. (a) is the
house pattern for soft-dep facts (never persisted, one probe per emission in
`notification-dispatch.ts:230`); on the unresolved arm there are no components, so
(a) naturally omits the line there. Names per D-01-01: `pi-subagents`,
`pi-mcp-adapter`, `pi-dynamic-workflows`; `(missing)` suffix when not loaded.

**Analog 3 — optional field spread** (`orchestrators/plugin/info.ts:1040-1042`, used at 1793/2078/2183), only if option (b):
```ts
function advisoryFields(notes: readonly string[]): { notes?: readonly string[] } {
  return notes.length > 0 ? { notes } : {};
}
```
(`exactOptionalPropertyTypes` forces the conditional spread.)

**Analog 4 — type field with doc comment** (`shared/notification-types.ts` `PluginInfoRowBase.notes`, ~838-855): readonly optional array, doc states precondition (pre-sorted by composer; renderer does not sort — see "SORT PRECONDITION" at grammar ~1460).

**Catalog analog** (`docs/output-catalog.md` ~2576-2592):
````markdown
### Success -- installed single scope with dependencies

Same as above but with a `dependencies: ...` line emitted LAST ... Severity `info`.

<!-- catalog-state: installed-single-scope-with-dependencies -->

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands v1.2.0 (installed)
    Helpful git commit commands for everyday use.
    agents: review-bot
    commands: c1, c2
    skills: commit-summary
    dependencies: helper@utils-mp
```
````
New states: one with all companions loaded, one with `(missing)`, one combined with
`dependencies:`/`note:` to pin relative order. Catalog UAT
(`tests/architecture/catalog-uat/catalog-contract.test.ts`) byte-compares blocks;
its probe double is `tests/architecture/catalog-uat/mock-pi.ts` (lines 70,75,91
plant `{ name: "mcp" }` and must switch to the adapter-command seed).

---

### `platform/pi-api.ts` probe (ADET-02)

**Analog (same file, sibling arms):**
```ts
function hasLoadedWorkflowEngine(pi: ToolInventory): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "workflow_control");
  } catch {
    return false;
  }
}
```
Current interfaces to extend/rename (keep name <=15 chars, e.g. `PiInventory`, to avoid Prettier rewrapping 98-char imports at `install-flow.ts:84`, `update-cascade.ts:21`, `enable-disable.ts:122`):
```ts
export interface ToolInventoryItem {
  readonly name?: unknown;
  readonly sourceInfo?: { readonly source?: unknown };
}
export interface ToolInventory {
  getAllTools(): readonly ToolInventoryItem[];
}
```
Target shape: RESEARCH Pattern 3 (two independently guarded arms, both always run,
`/^mcp-adapter(?::\d+)?$/`, `unknown` + `typeof` narrowing). Doc comments cite
`ADET-02` (replace the `RH-4` comment). Pins on lines 100,106,107,108,124 — keep
line counts stable above them; re-derive `types.d.ts` pins in the bump commit
(406->525, 414->533).
Spec diff: `git show features/mcp:extensions/pi-claude-marketplace/platform/pi-api.ts` — features/mcp detects built-in MCP (abandoned design); main keeps adapter-only semantics.

---

### `tests/platform/pi-inventory-seed.ts` (NEW, D-01-13)

**Analog to consolidate** (`tests/architecture/workflows-marker-coverage.test.ts:97-109`; identical copies in `list-flow.test.ts:78-90`, `reinstall.messaging.test.ts:62-74`; `ToolInventoryItem`-typed variants in `enable-disable.test.ts:116`, `install-flow.test.ts:290`, `reinstall-flow.test.ts:176`):
```ts
function toolInfo(name: string): ToolInfo {
  return {
    name,
    description: `test tool ${name}`,
    parameters: Type.Object({}),
    sourceInfo: {
      origin: "top-level",
      path: `/test/tools/${name}.ts`,
      scope: "temporary",
      source: "test",
    },
  } satisfies ToolInfo;
}
```
Add `exposure: "direct"`. Seeds return fresh values. Built-in values come from the
captured run (RESEARCH Pattern 4: tool `mcp__stub__echo`, exposure `deferred`,
`sourceInfo {path:"builtin:mcp", source:"builtin", scope:"temporary", origin:"top-level"}`; command `mcp`, `source:"extension"`). Support-module conventions: named exports, explicit return types, type-only imports last (see `tests/platform/hermetic-environment.ts` lines 1-12). Not `*.test.ts`, so no corresponding-test pairing.

### `tests/edge/notification-boundary.ts` — `expectSoftDepProbes`

**Analog** (same file ~94-116):
```ts
  if (toolProbes > 0) {
    when(() => pi.getAllTools())
      ...
      .times(toolProbes);
```
New helper states `getAllTools()` `times(probes * 3)` and `getCommands()` `times(probes)`; zero states nothing (strong-mock `times(0)` = unlimited). Header comment (lines 6-14, 61-76) explains reads-vs-emissions and must be restated in probe units.

### `tests/e2e/_helpers.ts` — `makeMockPi`

**Analog** (57-83): add `commands` parameter and always define `getCommands: () => commands` beside `getAllTools: (): readonly unknown[] => tools` (an absent method throws inside the arm and silently reads "not loaded").

### `tests/e2e/_rpc.ts` + RPC test (NEW, D-01-14)

**Spec:** `git show features/mcp:tests/e2e/_rpc.ts` (header + imports, lines 1-25):
```ts
import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
...
import { resolvePiRuntime } from "../pi-runtime.ts";

import type { ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const EXTENSION_ENTRY = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace", "index.ts");
const DEFAULT_HARD_STOP_MS = 60_000;
```
Deltas vs spec: IN-04 (`realpath` failure -> "sandbox location X does not exist"), IN-05 (`killProcessGroup` on normal exit), reject sandbox inside `REPO_ROOT`; IN-02 rename. Consumer: `git show features/mcp:tests/e2e/builtin-mcp-rpc.test.ts`, inverted per RESEARCH Pattern 4 state table. Sandbox via `tests/platform/hermetic-environment.ts::enterHermeticEnvironment`.

### `tests/integration/pi-subagents-peer.ts` (NEW)

Analog: the two duplicated loaders in `tests/integration/provenance-invisibility.test.ts` and `tests/integration/skill-path-resolution.test.ts` (spec commits `5b1d8ef6`, `dac3a245`, `69e0870a`). Use `semver.minVersion` + `semver.lt` (runtime dep) reading `package.json` peer range; explicit `PI_SUBAGENTS_ROOT` fails loudly.

### `tests/architecture/peer-floor.test.ts`

**Analog (same file):**
```ts
const PEER = "@earendil-works/pi-coding-agent";

test("package.json peerDependencies pins the pi-coding-agent floor at >=0.86.1 (FLOOR-01)", async () => {
  const raw = await readFile(path.join(REPO_ROOT, PACKAGE_JSON_REL), "utf8");
  const pkg = JSON.parse(raw) as PackageJson;
  const range = pkg.peerDependencies?.[PEER];
  assert.ok(range, `peerDependencies["${PEER}"] is missing`);
  assert.equal(range, ">=0.86.1", ...);
});
```
plus the lock-root sync case. Copy for `pi-subagents` (`>=0.74.0`) and `pi-mcp-adapter` (`>=5.0.0`, optional in `peerDependenciesMeta`, absent from `devDependencies` and from lock `packages`). Paths come from `./gate-targets.ts` (D-07-06: gate files may not name unregistered production paths).

### `tests/live-uat/openai-stub-server.mjs` (NEW, D-01-15)

**Analog header** (`tests/live-uat/stop-canary.mjs:1-6`, identical line 6 in all four drivers):
```js
// tests/live-uat/stop-canary.mjs
//
// Standalone operator-run UAT driver: an engineer invokes it from the command
// line and no module ever imports it, so being unreachable from the import
// graph is its intended shape, not a defect.
// fallow-ignore-file unused-file -- standalone operator-run UAT driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
```
Note: adding a marker raises the repo-wide `fallow-ignore` count (CONVENTIONS.md says 11); update that count if a doc/test pins it. Bind `127.0.0.1` only. Watch Pitfall 8: the `dup:cc950b18:2` retained-clone header paragraph (stop-canary.mjs lines 8-21) must be revisited after IN-10 edits.

## Shared Patterns

### Closed-vocabulary amendment (marker rename)
**Source:** `shared/notification-types.ts:27`, `shared/notify-reasons.ts:108` (`_UncoveredReason`/`_ExtraReason` make a one-sided rename a compile error), `shared/concerns/soft-dep.ts:35`.
**Apply to:** all three in one commit, same union position (COMPAT-01 reads order); gate tests amended in place; comment-only sites renamed without rewrapping (contract pins, RESEARCH Pitfall 1). Assertions pin the full token `{requires pi-mcp-adapter}` (D-01-02).

### Probe threaded once per emission
**Source:** `shared/notification-dispatch.ts:230` (`renderPluginInfo(message, probe)`); `softDepMarkers` in `shared/concerns/soft-dep.ts:54-77`.
**Apply to:** the info `requires:` line and any new soft-dep rendering — never re-probe in the renderer.

### Throw means not loaded
**Source:** every `hasLoaded*` in `platform/pi-api.ts` (`try { ... } catch { return false; }`).
**Apply to:** each MCP arm separately.

### Comments
Cite `ADET-01`/`ADET-02`/`PIFL-0N`, never `D-01-NN` (collides with v1.20 IDs already in source), no phase/plan refs, no "renamed from" narration.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Info `(missing)` companion tagging | renderer | transform | No existing info line carries soft-dep state; combine `appendDependenciesLine` shape with `softDepMarkers` logic |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{platform,shared,orchestrators/plugin}`, `tests/{platform,edge,e2e,architecture,integration,live-uat}`, `docs/output-catalog.md`, `features/mcp` branch (spec only)
**Files scanned:** ~20
**Pattern extraction date:** 2026-10-02
