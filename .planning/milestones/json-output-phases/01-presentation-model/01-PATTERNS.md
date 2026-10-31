# Phase 1: Presentation Model - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 17 (new + modified; the ~40 orchestrator call-site files of Plan 05 are grouped as one row)
**Analogs found:** 16 / 17

All analog paths below are git-tracked source (verified with `git ls-files`).
Prefix `E=` means `extensions/pi-claude-marketplace/`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/notify-corpus.mjs` (NEW) | utility (CLI gate tool) | batch / file-I/O | `scripts/check-workflow-install-scripts.mjs` | role-match |
| `scripts/notify-corpus.hook.mjs` (NEW) | utility (`--import` preload) | transform | none in repo; RESEARCH "Capture preload" example | no analog |
| `scripts/notify-corpus.negative.mjs` (NEW) | test (negative control) | batch | `scripts/check-workflow-install-scripts.negative.mjs` | exact |
| `.planning/phases/01-presentation-model/notify-corpus/*.jsonl` + meta (NEW) | config/data | file-I/O | none (ASCII-escaped `.jsonl` per RESEARCH Pitfall C) | n/a |
| `E/shared/notification-resolve.ts` (NEW) | service (pure resolve) | transform | `E/shared/notification-summary.ts` + `E/shared/concerns/soft-dep.ts` (`softDepMarkers`) | role-match |
| `E/shared/notification-run.ts` (NEW, Plan 05) | model + factory | request-response | `E/platform/pi-api.ts` `softDepStatus` / `SoftDepStatus` | role-match |
| `E/shared/notification-dispatch.ts` (MOD) | service (sole sink) | request-response | itself (`emitCascadeWith` :372-405) | exact |
| `E/shared/notification-grammar.ts` (MOD) | utility (text strategy) | transform | itself | exact |
| `E/shared/notification-summary.ts` (MOD) | utility | transform | itself | exact |
| `E/shared/notify-context.ts` (MOD) | model (CommandContext, RenderFn, dispatchRow) | transform | itself :43-67, :339-367 | exact |
| `E/shared/errors.ts` (MOD) | utility (cause walk) | transform | itself `causeChainTrailer` :149-167, `manualRecoveryLeaks` :598 | exact |
| `E/orchestrators/**/*.messaging.ts` (19 contexts, MOD) | config (per-verb context data) | transform | `E/orchestrators/plugin/uninstall.messaging.ts` :36-60 | exact |
| `E/edge/register.ts`, `E/edge/router.ts`, `E/index.ts` (MOD, Plan 05) | route / lifecycle root | request-response | `register.ts:129-131`, `router.ts:26-58`, `index.ts:116` | exact |
| orchestrators + edge handlers passing `pi` to notify family (~40 files, MOD, Plan 05) | controller/service | request-response | `E/orchestrators/plugin/install-flow.ts:406` (severity probe) | exact |
| `tests/shared/notification-resolve.test.ts`, `tests/shared/notification-run.test.ts` (NEW) | test (owner) | — | `tests/shared/notify-reasons.test.ts` | exact |
| `tests/architecture/<marker-policy>.test.ts` (NEW, SC-5) + new case in `workflows-marker-coverage.test.ts` | test (architecture) | — | `tests/architecture/workflows-marker-coverage.test.ts:501-527` | exact |
| `tests/edge/notification-boundary.ts`, `tests/architecture/catalog-uat/catalog-contract.test.ts`, SC-3 case in `tests/edge/register.test.ts` (MOD) | test helper / test | — | `tests/edge/notification-boundary.ts` header :1-24 | exact |

## Pattern Assignments

### `scripts/notify-corpus.mjs` (utility CLI, batch)

**Analog:** `scripts/check-workflow-install-scripts.mjs` (98 lines)

**Imports + header doc** (lines 1-13): only `node:` built-ins, then a `/** ... */` block explaining why the script exists and naming its `.negative.mjs` companion.
```js
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fails any workflow that installs npm packages without `--ignore-scripts`. ...
 * Its companion `.negative.mjs` plants a violation and proves the gate flags it.
 */
const defaultProjectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
```

**Pure exported core** (lines 38-54): the negative imports this; export `diffCorpus(baseline, capture)` the same way.
```js
export function checkWorkflowInstallScripts(projectRoot = defaultProjectRoot) {
  const violations = [];
  ...
  return violations;
}
```

**CLI main + exit code + guarded entry** (lines 69-98) -- copy verbatim shape (`process.exitCode = 1`, never `process.exit`; stdout on pass, stderr per violation naming the file):
```js
function main() {
  const projectRoot = parseProjectRoot(process.argv.slice(2));
  const violations = checkWorkflowInstallScripts(projectRoot);
  if (violations.length === 0) {
    process.stdout.write("Workflow install-scripts gate passed.\n");
    return;
  }
  for (const violation of violations) {
    process.stderr.write(`missing ${ignoreScriptsFlag}: ${violation.path}:${violation.line}: ...\n`);
  }
  process.exitCode = 1;
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
```

**Suite-glob discovery** -- copy from `tests/architecture/unit-suite-glob-completeness.test.ts:50-75` (`pathsMatchedByScript`): parse `package.json` `scripts.test` / `scripts["test:integration"]`, take quoted args via `/"([^"]*)"/g`, keep `tests/`-prefixed globs, throw on foreign or empty.

**Capture/normalize/diff specifics:** RESEARCH "Normalizers that made two runs identical" (tmp path -> `<TMPPATH>`, UUID -> `<UUID>`, `(\.json)\.\d{4,}` -> `$1.<N>`, plus `os.homedir()`/`process.cwd()`), per-file `Map<key,count>` multiset, refuse `capture.total < baseline.total`, record `process.version` in meta.

---

### `scripts/notify-corpus.negative.mjs` (negative control)

**Analog:** `scripts/check-workflow-install-scripts.negative.mjs` (62 lines) -- exact.
```js
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { checkWorkflowInstallScripts } from "./check-workflow-install-scripts.mjs";

const fixtureRoot = await mkdtemp(path.join(tmpdir(), "workflow-install-scripts-gate-"));
try {
  // The plant: ... the violation.
  await writeFile(workflowPath, workflow("npm ci"));
  assert.deepStrictEqual(checkWorkflowInstallScripts(fixtureRoot), [ { path: ..., line: 8, text: ... } ]);
  // The same line with the flag: the gate must go quiet, so a green run means something.
  ...
  process.stdout.write("Workflow install-scripts negative controls passed.\n");
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
```
Plants for this phase (D-04): one-byte message drift -> missing entry naming the file; removed entries -> count refusal; benign reorder + one added entry -> pass with extra listed; plus a tiny end-to-end capture over one small test file asserting >= 1 entry.

Note: `tests/scripts/` owns tests for `check-unused-type-members*`, but `scripts` is a non-corresponding root (`scripts/check-corresponding-tests.mjs:9`), so no `tests/scripts/notify-corpus*.test.ts` is required. Tool is removed at milestone close (D-01); do not add it to `npm run check` (D-03).

---

### `scripts/notify-corpus.hook.mjs` (preload, transform)

**No repo analog.** Use RESEARCH.md "Capture preload (measured shape)" verbatim (`module.registerHooks({ load })`, never `module.register` -- Pitfall J). Rewrite regex `/\b([A-Za-z_$][\w$]*)\.ui\.notify\(/g` -> `globalThis.__corpusNotify($1.ui, `; record only when `process.argv[1]` ends in `.test.ts`. Style (imports order, `node:` built-ins only) follows `check-workflow-install-scripts.mjs` lines 1-3; ESLint block for `scripts/**/*.mjs` is `eslint.config.js:414-431`.

---

### `E/shared/notification-resolve.ts` (NEW, pure resolve)

**Analogs:** `E/shared/concerns/soft-dep.ts:48-77` (pure-given-probe function style) and the logic it absorbs from `notification-summary.ts` (`summaryPhrase`/`buildSummaryLine` :303-416, `composeTally` :472-538, `shouldEmitReloadHint` :575-626) and `notification-grammar.ts` (`composeReasons` :500-515, `partialHintTrailerFor` :1591-1605, `notAddedReasonFor` :1398-1406). Move, do not copy (dupes gate; "every decision already has exactly one implementation").

**Pure-given-probe pattern** (`soft-dep.ts:48-77`) -- resolve calls this, never re-implements it:
```ts
export function softDepMarkers(
  declaresAgents: boolean,
  declaresMcp: boolean,
  declaresWorkflows: boolean,
  probe: SoftDepStatus,
): readonly Reason[] {
  const markers: Reason[] = [];
  if (declaresAgents && !probe.piSubagentsLoaded) { markers.push(SOFT_DEP_MARKER_AGENTS); }
  ...
  return markers;
}
```

**Marker merge to preserve byte-for-byte** (`notification-grammar.ts:507-514`): content reasons first, then markers; no sort, no dedupe (Pitfall G).
```ts
const composed: Reason[] = reasons === undefined ? [] : [...reasons];
composed.push(...softDepMarkers(declaresAgents, declaresMcp, declaresWorkflows, probe));
```

**Resolved-row typing:** RESEARCH Pattern 2 (distributive `Resolved<M>`, `ResolvedRowFacts` as an `interface`). Keep model interfaces in this file (avoids the pinned type-only exemption list at `eslint.config.js:389-408`). Carry only members the text strategy reads (Pitfall E).

---

### `E/shared/notification-run.ts` (NEW, Plan 05)

**Analog:** `E/platform/pi-api.ts:127-131, 201-207`
```ts
export interface SoftDepStatus {
  piSubagentsLoaded: boolean;
  piMcpAdapterLoaded: boolean;
  workflowEngineLoaded: boolean;
}

export function softDepStatus(pi: ToolInventory): SoftDepStatus {
  return {
    piSubagentsLoaded: hasLoadedPiSubagents(pi),
    ...
  };
}
```
New module: `interface NotificationRun { readonly softDeps: SoftDepStatus }` + `openNotificationRun(pi: ToolInventory): NotificationRun` calling `softDepStatus` once. Name must not be `mode` or sit under `notifications` (D-06). `shared -> platform` import is allowed by `.fallowrc.json`.

---

### `E/shared/notification-dispatch.ts` (MOD)

**Current probe sites to remove (Plan 05):** line 1 `import { softDepStatus } from "../platform/pi-api.ts";`, `:280` in `notify`, `:387` in `emitCascadeWith`, `:433` in `emitUpdateNoOpCascade`.

**Structure to keep (resolve -> format -> one notify):** `emitWithSummary` :90-105 is the single structured sink; argc 1 at info, 2 otherwise:
```ts
const notification = composeWithSummary(message, body);
if (notification.length === 1) {
  ctx.ui.notify(notification[0]);
} else {
  ctx.ui.notify(notification[0], notification[1]);
}
```
**Cascade body shape** (`emitCascadeWith` :387-404), including the `(no marketplaces)` sentinel which must NOT apply to `emitUpdateNoOpCascade` (:434-445 uses bare `blocks.join("\n\n")`) -- Pitfall H:
```ts
const blocks = message.marketplaces.map((mp) => {
  const lines: string[] = [renderMpHeader(mp, probe)];
  for (const p of mp.plugins) {
    lines.push(...composePluginLinesWith(p, probe, mp.scope, renderPluginRowBody));
  }
  return lines.join("\n");
});
const composed = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
const body = foldAdvisories(composed, advisories);
const withTally = foldTallyAndHint(body, composeTally(message), hint);
emitWithSummary(ctx, message, withTally);
```
Also update `eslint.config.js:132,143` message strings that say `notify(ctx, pi, NotificationMessage)`.

---

### `E/shared/notify-context.ts` (MOD)

**Current contract** (lines 43, 64-67):
```ts
export type RenderFn<M> = (row: M, probe: SoftDepStatus, mpScope: Scope) => string;

export interface CommandContext<Status extends string, Msg extends PluginNotificationMessage> {
  readonly Messaging: { readonly label: string };
  readonly render: { [K in Status]: RenderFn<Extract<Msg, { status: K }>> };
}
```
D-13: `RenderFn` drops `probe`, takes `Resolved<M>`. D-12: add `readonly markers: { readonly [K in Status]: boolean }`.

**Missing-arm fallback to relocate into resolve** (`dispatchRow` :339-367) -- preserve the guarded write so a frozen row stays info (Pitfall A, resolved question in CONTEXT):
```ts
try {
  (row as WritableRowSeverity).severity = "error";
} catch (err) {
  hookDebugLog(`dispatchRow: severity write rejected for frozen row: ${errorMessage(err)}`);
}
return `${"name" in row ? row.name : "?"} (failed) {internal: no render arm for "${row.status}"}`;
```
Pinned by `tests/shared/notify-context.test.ts:458-562`. The `:346` contract pin is removed from `scripts/check-unused-type-members.contracts.json` when this code moves.

---

### `E/orchestrators/**/*.messaging.ts` (19 contexts, MOD)

**Analog:** `E/orchestrators/plugin/uninstall.messaging.ts:36-60`
```ts
const UNINSTALL_RENDER: {
  [K in UninstallStatus]: RenderFn<Extract<UninstallMsg, { status: K }>>;
} = {
  uninstalled: (p, probe, mpScope) => renderUninstalledRow(p, probe, mpScope),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
};

export const UNINSTALL_CONTEXT = {
  Messaging: { label: "Plugin uninstall" },
  render: UNINSTALL_RENDER,
} as const satisfies CommandContext<UninstallStatus, UninstallMsg>;
```
Change: arms become `(p, mpScope) => ...` over resolved rows; add `markers: { uninstalled: false, failed: false }` beside `render`. Per-arm ON/OFF values come from RESEARCH "Per-verb soft-dep suppression table" (M only for installed/updated/reinstalled/partially-installed, except `LIST_CONTEXT.partially-installed` = false). Keep the `*_RENDER` annotation text unchanged so `lint:type-members` pins only shift lines (Pattern 2 / Pitfall D).

---

### `E/shared/errors.ts` (MOD)

**Analog:** itself, `causeChainTrailer` :149-167 and `manualRecoveryLeaks` :598-606.
```ts
const PREFIX = "cause: ";
const JOINER = " -> ";
const links = [...causeChain(err)];
const rendered = links.map(linkMessage);
if (hasOnwardCause(links.at(-1))) {
  rendered[rendered.length - 1] = `${rendered.at(-1)} (truncated)`;
}
return `${PREFIX}${rendered.join(JOINER)}`;
```
Add a structured export (`serializeCauseChain` -> `{ links, truncated }`) and rebuild `causeChainTrailer` on it (sketch in RESEARCH "Structured cause-chain walk"). `causeChainTrailer` keeps its other callers (`bridges/commands/discover.ts:102`, `install.messaging.ts:336`, `errors.ts:205`). `CAUSE_CHAIN_MAX_DEPTH = 5` (:30) stays single-sourced.

---

### `E/edge/register.ts`, `E/edge/router.ts`, `E/index.ts` (Plan 05 roots)

**Construction site** (`register.ts:129-131`):
```ts
pi.registerCommand("claude:plugin", {
  description: COMMAND_DESCRIPTION,
  handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx),
```
-> build `run = openNotificationRun(pi)` inside the arrow, pass as 4th arg. `SubcommandHandlers` (`router.ts:26-58`) members each gain `run`:
```ts
install: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
```
**Load root** (`index.ts:116`), inside the existing NFR-2 try/catch:
```ts
await applyReconcile({ ctx, pi, cwd: event.cwd, hooksRouting, completionCache });
```
Hooks get no run object in Phase 1.

---

### Orchestrator severity probes (Plan 05)

Switch to `run.softDeps`: `E/orchestrators/plugin/install-flow.ts:406` (`companionSeverity({...}, softDepStatus(pi))`), `update-cascade.ts:190` (`groupCascadeOutcomes(outcomes, softDepStatus(pi), cardinality)`), `enable-disable.ts:1347` (`probe: softDepStatus(pi)`). Option-bag fields `readonly pi: ToolInventory` / `ExtensionAPI` (inventory in RESEARCH "How `pi` reaches orchestrators") become `readonly run: NotificationRun`; `update-swap.ts:173-183` `pi?: never` discriminant moves with it.

---

### Owner tests `tests/shared/notification-resolve.test.ts`, `tests/shared/notification-run.test.ts`

**Analog:** `tests/shared/notify-reasons.test.ts:1-12`
```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  companionSeverity,
  ...
} from "../../extensions/pi-claude-marketplace/shared/notify-reasons.ts";

import type { Reason } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";
```
Rules: `test()`, `// arrange // act // assert`, 100% direct coverage alone, literal expected values (never build resolved rows by calling resolve -- Pitfall F), strong-mock `verify()`.

---

### SC-5 marker-policy test + `workflows-marker-coverage` third case

**Analog:** `tests/architecture/workflows-marker-coverage.test.ts:501-527` (tree scan + set equality both directions + explanatory failure message):
```ts
const DERIVATION_SHAPE =
  /\)\s*:\s*(?:readonly\s+)?Dependency\[\]\s*\{|:\s*Dependency\[\]\s*=\s*\[\s*\]/;

test("WDEP-04: the case list covers every Dependency[] derivation site", async () => {
  const discovered = await filesMatching("extensions/pi-claude-marketplace/orchestrators", DERIVATION_SHAPE);
  assert.deepEqual(discovered, [...SITE_CASES].map(({ site }) => site).sort(), "WDEP-04: ...");
});
```
New case: scan `extensions/pi-claude-marketplace/` for `softDepMarkers(` and assert equality with `["extensions/pi-claude-marketplace/shared/notification-resolve.ts"]`, plus a planted control (CONVENTIONS: "a gate wants a test that plants the violation"). Any new named path must be registered in `tests/architecture/gate-targets.ts` (D-07-06). SC-5 table test states all 19 contexts + default table as an independent literal and `deepStrictEqual`s each `context.markers`.

---

### `tests/edge/notification-boundary.ts` + catalog driver + SC-3

Header comment :1-24 states the per-emission probe contract ("`notify()` runs one soft-dependency probe per emission ... three times"); restate it as per-command (Pitfall I). Keep the "count of 0 states no expectation, not `times(0)`" rule. Catalog: build the run once per fixture inside `catalog-contract.test.ts`; fixtures untouched; `EXPECTED_STATE_COUNT = 205`, `EXPECTED_UTF8_BYTES = 26_619` unchanged.

## Shared Patterns

### Single sink (IL-2)
**Source:** `E/shared/notification-dispatch.ts:90-105` (`emitWithSummary`). **Apply to:** all dispatch/resolve changes -- no new `ctx.ui.notify` site; new `shared/*` modules must not need `no-console` off (`NO_CONSOLE_EXEMPT_TARGETS`, `gate-targets.ts:223-227`).

### Pure-given-snapshot functions
**Source:** `E/shared/concerns/soft-dep.ts:54-77`, `E/shared/notify-reasons.ts:84-97` (`companionSeverity`). **Apply to:** resolve and every severity stamp -- take `SoftDepStatus` as a parameter, never probe.

### `as const satisfies CommandContext<...>` data pin
**Source:** `uninstall.messaging.ts:56-59`. **Apply to:** all 19 contexts when adding `markers`.

### Single-sourced error walk
**Source:** `E/shared/errors.ts:30, 34-36, 149-167`. **Apply to:** failure serialization in resolve; grammar stops importing `errors.ts`.

### Script + negative pairing
**Source:** `scripts/check-workflow-install-scripts{,.negative}.mjs`. **Apply to:** corpus tooling.

### Gate hygiene per plan
Prettier -> `npm run lint:type-members` -> re-pin line only in `scripts/check-unused-type-members.contracts.json`; no export without a production reader (`UNOWNED_EXPORT_CENSUS = {}`, `PRODUCTION_FINDING_CENSUS` empty); `git diff --exit-code -- docs/output-catalog.md`; corpus re-diff.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/notify-corpus.hook.mjs` | preload | transform | No Node module hook exists in the repo; use RESEARCH "Capture preload (measured shape)" |
| `.planning/phases/01-presentation-model/notify-corpus/` | data | file-I/O | New artifact type; ASCII-escaped `.jsonl` sorted by file then message (RESEARCH Pitfall C) |

## Metadata

**Analog search scope:** `scripts/`, `extensions/pi-claude-marketplace/{shared,edge,orchestrators,platform}/`, `index.ts`, `tests/{shared,edge,architecture}/`
**Files scanned:** ~20
**Pattern extraction date:** 2026-09-28
