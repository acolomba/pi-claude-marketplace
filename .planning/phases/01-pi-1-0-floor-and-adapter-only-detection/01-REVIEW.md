---
phase: 01-pi-1-0-floor-and-adapter-only-detection
reviewed: 2026-10-02T00:00:00Z
depth: standard
files_reviewed: 137
files_reviewed_list:
  - .fallowrc.json
  - .github/workflows/lint.yml
  - AGENTS.md
  - README.es.md
  - README.md
  - docs/adr/v2-001-structured-notify.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - docs/research/claude-hooks-vs-pi-events.md
  - docs/workflows-compatibility.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - package.json
  - scripts/check-unused-type-members.contracts.json
  - scripts/pi.sh
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-info.ts
  - tests/architecture/catalog-uat/mock-pi.ts
  - tests/architecture/closed-set-enrollment.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/manifest-read-agreement.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-producer-wire-coverage.test.ts
  - tests/architecture/notify-will-reload-agreement.test.ts
  - tests/architecture/partial-vocabulary-guard.test.ts
  - tests/architecture/peer-floor.test.ts
  - tests/architecture/workflows-doc-pins.test.ts
  - tests/architecture/workflows-marker-coverage.test.ts
  - tests/e2e/_helpers.ts
  - tests/e2e/_rpc.ts
  - tests/e2e/adapter-detection-rpc.test.ts
  - tests/e2e/install-soft-deps.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/browse.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/pending.test.ts
  - tests/edge/handlers/plugin/prune.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/tools.test.ts
  - tests/edge/notification-boundary.ts
  - tests/edge/register.test.ts
  - tests/index.test.ts
  - tests/integration/marketplace-add-seed-mirrors.test.ts
  - tests/integration/pi-subagents-peer.ts
  - tests/integration/provenance-invisibility.test.ts
  - tests/integration/skill-path-resolution.test.ts
  - tests/live-uat/README.md
  - tests/live-uat/manifest-absence-canary.mjs
  - tests/live-uat/openai-stub-server.mjs
  - tests/live-uat/stop-canary.mjs
  - tests/live-uat/workflow-storage-canary.mjs
  - tests/orchestrators/import/execute.messaging.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.messaging.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
  - tests/orchestrators/plugin/list-flow.test.ts
  - tests/orchestrators/plugin/list.messaging.test.ts
  - tests/orchestrators/plugin/operations.test.ts
  - tests/orchestrators/plugin/prune.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall.messaging.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-cascade.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update.messaging.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
  - tests/orchestrators/reconcile/reconcile.messaging.test.ts
  - tests/platform/pi-api.test.ts
  - tests/platform/pi-inventory-seed.ts
  - tests/shared/concerns/soft-dep.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notification-types.test.ts
  - tests/shared/notify-context.test.ts
findings:
  critical: 1
  warning: 4
  info: 7
  total: 12
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-10-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 137
**Status:** issues_found

## Summary

I reviewed the Pi 1.0 floor move and the adapter-only MCP detection change at standard depth. I read the substantive files in full: the two-arm probe in `platform/pi-api.ts`, the companion mapping in `shared/concerns/soft-dep.ts`, the info `requires:` stamping in `orchestrators/plugin/info.ts`, the grammar and type changes, the RPC harness and its consumer, the shared seeds, the peer loader, the Stop canary, the stub server, `scripts/pi.sh` and `package.json`. I checked the mechanical edits (`PiInventory` rename, `requires pi-mcp-adapter` token, `createNotificationBoundary(..., probes)`) for consistency.

I checked the probe against Pi 1.0's real `getCommands()` (`agent-session.js:2645`): it lists extension commands under `invocationName` (`mcp-adapter:<n>` on a collision, `runner.js:564`), plus prompt templates and `skill:<name>` entries with their own `sourceInfo`. The name arm is correct. The source arm is not limited to extension commands (WR-01). I checked the RPC harness against Pi 1.0's `rpc-mode.js`: the `prompt` response for an extension command is sent only after the handler finishes (`agent-session.js:1490-1494`), so tagging notifies by `lastSentId` is sound. All five contract pins in `check-unused-type-members.contracts.json` match the current source and the installed `types.d.ts` (525:5, 533:5).

The main problem is in `scripts/pi.sh`. It now loads pi-mcp-adapter 5.0.0 against the developer's real Pi agent directory. The phase's own research says adapter 5 writes `"-builtin:mcp"` into that directory's `settings.json` (CR-01). The other findings are about the probe's false all-clear surface, vacuous assertions in the RPC test, and a test title that claims a check the test does not make.

## Structural Findings (fallow)

fallow audit (changed since `64c94d78^`, project health config, CRAP off by design): verdict `warn`; 0 dead code, 0 complexity, 0 circular dependencies, 14 duplicate clone groups.

| # | File:line | Related file | Instances |
|---|-----------|--------------|-----------|
| 1 | `tests/live-uat/manifest-absence-canary.mjs:629` | `tests/live-uat/stop-canary.mjs` | 2 |
| 2 | `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts:92` | `orchestrators/plugin/enable-disable.messaging.ts` | 5 |
| 3 | `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:293` | same file | 2 |
| 4 | `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts:92` | `orchestrators/plugin/enable-disable.messaging.ts` | 3 |
| 5 | `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:398` | same file | 2 |
| 6 | `tests/architecture/catalog-uat/fixtures/plugin-info.ts:8` | same file | 3 |
| 7 | `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:311` | same file | 2 |
| 8 | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1628` | same file | 2 |
| 9 | `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:1698` | `orchestrators/plugin/install-flow.ts` | 2 |
| 10 | `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:79` | `orchestrators/plugin/install.messaging.ts` | 2 |
| 11 | `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts:371` | `orchestrators/reconcile/apply-outcomes.ts` | 2 |
| 12 | `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2071` | same file | 2 |
| 13 | `tests/architecture/catalog-uat/fixtures/plugin-info.ts:31` | same file | 2 |
| 14 | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:791` | `orchestrators/plugin/uninstall.ts` | 2 |

Group 1 relates to IN-06. Groups 6 and 13 are in a fixture file that this phase extended with the `requires:` catalog states. The other groups sit in production files where this phase made only mechanical type renames, so I treat them as inherited.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `scripts/pi.sh` runs pi-mcp-adapter 5.0.0 against the developer's real Pi settings

**File:** `scripts/pi.sh:99`, `scripts/pi.sh:195-197`
**Issue:** The pin moves from `pi-mcp-adapter@2.37.0` to `pi-mcp-adapter@5.0.0`, and the script still loads the adapter (`-e "$mcp_adapter_extension"`) even without `--home`. `pi_home` defaults to `""` (line 31), so without `--home` the script exports no `PI_CODING_AGENT_DIR`, and Pi uses the developer's real `~/.pi/agent/`. The phase's research says: "Adapter 5 on first start writes `\"-builtin:mcp\"` into Pi's **user** `settings.json`" (`.planning/research/PITFALLS.md:282`). The phase context says: "any run that loads the real adapter needs a sandboxed `PI_CODING_AGENT_DIR`" (`01-CONTEXT.md`, Specific Ideas). `01-RESEARCH.md:575` lists the `pi.sh` prefix with mitigation "none (auto-reinstall)". So the first plain `scripts/pi.sh` run after this change installs adapter 5 and changes the developer's global Pi configuration. That change turns off Pi's built-in MCP in every later normal Pi session, and it stays after the script exits. The script's help text says nothing about it. No other path in this phase writes outside a sandbox.
**Fix:** Sandbox by default, or refuse to run without a sandbox. For example:
```bash
# default the Pi home into the private prefix so the adapter's onboarding
# write (adapter 5 adds "-builtin:mcp" to settings.json) never reaches ~/.pi
if [[ -z "$pi_home" && -z "${PI_CODING_AGENT_DIR:-}" ]]; then
  pi_home="$prefix/home"
fi
```
Also document in `usage()` that the adapter edits `<agentDir>/settings.json`, and that `--home` (or the default sandbox) keeps the edit out of `~/.pi/agent`.

## Warnings

### WR-01: The command source arm counts prompt templates and skills, which can report the adapter loaded when it is not

**File:** `extensions/pi-claude-marketplace/platform/pi-api.ts:201-211`
**Issue:** `isAdapterCommand` checks `isAdapterSource(command.sourceInfo?.source)` before it checks `command.source === "extension"`. Pi 1.0's `getCommands()` also returns every prompt template (`source: "prompt"`) and every skill (`source: "skill"`), and each one carries its package's `sourceInfo` (`agent-session.js:2651-2662`). So any prompt or skill whose package source contains `pi-mcp-adapter` counts as the adapter being loaded. Two cases show this: a package whose extension is filtered off in settings while its skills or prompts stay on, and an unrelated skills-only package such as `npm:pi-mcp-adapter-recipes`. In both cases the `{requires pi-mcp-adapter}` marker goes away and the info line drops `(missing)`. That is the false all-clear that the house rule in `probeArm`'s comment ("never a false all-clear") forbids. The unit matrix covers the name arm for `prompt` and `skill` (`pi-api.test.ts`, "does not count a prompt template named mcp-adapter"). It has no case for a prompt or skill whose source names the adapter.
**Fix:** Limit both command signals to extension commands:
```ts
function isAdapterCommand(command: CommandInventoryItem): boolean {
  if (command.source !== "extension") {
    return false;
  }

  return (
    isAdapterSource(command.sourceInfo?.source) ||
    (typeof command.name === "string" && ADAPTER_COMMAND_NAME.test(command.name))
  );
}
```
Add matrix rows for `{ source: "prompt" | "skill", sourceInfo: { source: "npm:pi-mcp-adapter" } }` that expect `piMcpAdapterLoaded: false`. Update the RH-4 wording in the PRD ("any command or tool whose `sourceInfo.source`...") to match.

### WR-02: The RPC adapter-detection states pass even when their inventory evidence is missing

**File:** `tests/e2e/adapter-detection-rpc.test.ts:46`, `:229-231`, `:270-277`, `:474-479`
**Issue:** `assertCleanSession` checks dispositions only for `PLUGIN_STEP_IDS = ["add", "install", "list", "info"]`. It never checks that the `commands` (`get_commands`) step or the `inventory` (`/inventory-probe`) step succeeded. `listedCommands` returns `[]` for a failed or missing response. `inventoryEntries` falls back to `JSON.parse("{}")` and returns `[]` when no notify followed the `inventory` step. The "built-in MCP disabled" state expects `mcpCommands: []` and `mcpToolPaths: []`. Three of the four states expect `mcpToolPaths: []`. So if the probe fixture fails to load, or `get_commands` returns an error, those assertions still pass while proving nothing about the inventory they describe. The built-in-only case is not affected, because it asserts a non-empty `mcp__stub__echo` entry.
**Fix:** Assert both evidence steps before reading them:
```ts
assert.equal(run.responses.get("commands")?.success, true);
assert.equal(promptDisposition(run.responses.get("inventory")), "handled");
assert.ok(run.notifies.some((n) => n.after === "inventory"), "inventory probe did not notify");
```
Alternatively, add `"inventory"` to `PLUGIN_STEP_IDS`, and make `inventoryEntries` throw when the notify is missing instead of parsing `"{}"`.

### WR-03: The built-in RPC case registers sentinel cleanup only after a read that can throw

**File:** `tests/e2e/adapter-detection-rpc.test.ts:357-365`
**Issue:** `readPid(stubPidFile)` runs before `readPid(sentinelPidFile)` and before the `t.after` that kills the sentinel. Suppose the built-in MCP never starts the stub server, for example because Pi changes to lazy server start or the stub fails before it writes its PID file. Then `readPid` throws a raw `ENOENT`, which hides the clear assertions below it, and no cleanup is registered. If the case fails because the group kill regressed (the IN-05 property this test exists to prove), the sentinel (`setInterval(..., 1 << 30)`, about 12 days) leaks with no cleanup.
**Fix:** Read the sentinel PID and register its cleanup first. Then read the stub PID in a way that turns a missing file into a named assertion:
```ts
const sentinelPid = await readPid(sentinelPidFile);
t.after(() => { try { process.kill(sentinelPid, "SIGKILL"); } catch { /* gone */ } });
const stubPid = await readPid(stubPidFile).catch((error: unknown) => {
  assert.fail(`built-in MCP never started the stub server: ${String(error)}`);
});
```

### WR-04: The PIFL-02 peer test says it checks that pi-subagents is optional, but it does not

**File:** `tests/architecture/peer-floor.test.ts` ("package.json declares the optional pi-subagents peer at >=0.74.0 and the lock root mirrors it (PIFL-02)")
**Issue:** The test title claims the peer is optional, but the body checks only the range and the lock mirror. The pi-mcp-adapter sibling test asserts `peerDependenciesMeta[...]` deep-equals `{ optional: true }`, and this test has no such check. If someone removes `peerDependenciesMeta["pi-subagents"]`, npm 7+ will auto-install pi-subagents as a required peer in consumers' trees, and this test stays green.
**Fix:** Add the same check the adapter test has:
```ts
assert.deepStrictEqual(pkg.peerDependenciesMeta?.[SUBAGENTS_PEER], { optional: true });
```

## Info

### IN-01: Doc comments still say the probe reads only `getAllTools()`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:115`, `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:140`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:171`, `tests/edge/handlers/plugin/uninstall.test.ts:23-26`
**Issue:** These comments say `pi` "carries `getAllTools()` for RH-3/RH-4", or call `pi.getAllTools` "the source of truth". RH-4 (ADET-02) now reads `getCommands()` first. The renamed `PiInventory` type carries both methods.
**Fix:** Change the wording to "carries `getAllTools()` and `getCommands()` for the soft-dependency probes (RH-3, ADET-02, WDEP-01)".

### IN-02: Live-UAT driver mocks do not define `getCommands`

**File:** `tests/live-uat/stop-canary.mjs:399`, `tests/live-uat/manifest-absence-canary.mjs:319`, `tests/live-uat/workflow-storage-canary.mjs:158`
**Issue:** These in-process mock Pis define only `getAllTools`. Every soft-dependency snapshot now calls `getCommands()`, which throws `TypeError` here. `probeArm` catches the error and reports "not loaded". The result happens to match what the drivers intend, but they now reach it through the error path, and they would hide a real probe defect. The same pattern is in several out-of-scope test mocks (`tests/integration/*.test.ts`, `tests/orchestrators/plugin/uninstall.test.ts:178`).
**Fix:** Add `getCommands: () => []` beside each `getAllTools` stub.

### IN-03: The README does not state the new pi-subagents floor

**File:** `README.md:39`, `README.md:137`; `README.es.md:39`
**Issue:** The prerequisites now give floors for Pi (1.0.0) and pi-mcp-adapter (5.0.0), but not for pi-subagents, which `package.json` now requires at `>=0.74.0`. Line 137 still says `excludeTools` "needs pi-subagents 0.62.0 or newer. Older versions ignore the field". That statement no longer matters, because 0.62.0 is below the declared floor.
**Fix:** Write "pi-subagents 0.74.0 or newer" in both READMEs, and drop or reword the 0.62.0 caveat.

### IN-04: The `dispatchRow` change removes the value's type before it casts

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:345-346`
**Issue:** To satisfy `no-unsafe-enum-assignment` (PIFL-05), the code widens the render map to `Readonly<Record<string, unknown>>`, then casts the `unknown` lookup to `RenderFn<...> | undefined`. The old cast started from a `RenderFn`-typed member. This one accepts any value, so a non-function entry in a render map would no longer fail to compile at this site. The risk is low because `CommandContext.render` is typed at the producers.
**Fix:** Widen only the key: `const render: Readonly<Record<string, RenderFn<Extract<Msg, { status: Status }>> | undefined>> = context.render;`. If the rule still fires, record why in a comment.

### IN-05: Three copies of a local `toolInfo` helper remain after the IN-03 consolidation

**File:** `tests/orchestrators/plugin/install-flow.test.ts:292`, `tests/orchestrators/plugin/enable-disable.test.ts:118`, `tests/orchestrators/plugin/reinstall-flow.test.ts:178`
**Issue:** D-01-13 moved the `ToolInfo` seed into `tests/platform/pi-inventory-seed.ts`. These three files still each define a private `toolInfo(name): ToolInventoryItem`, two of them byte-identical. The next change to the inventory item shape will have to touch all three.
**Fix:** Export a `toolInventoryItem(name)` seed from `pi-inventory-seed.ts` and import it in all three files.

### IN-06: An unexplained clone between the two canary drivers replaces the explained one

**File:** `.fallowrc.json:150` (removed `ignoredClones`), `tests/live-uat/manifest-absence-canary.mjs:629`, `tests/live-uat/stop-canary.mjs:483-513`
**Issue:** The `dup:cc950b18:2` ignore entry and its justification header were removed from both drivers. That makes sense, because the epilogues now differ. fallow still reports a 2-instance clone between the same two drivers: the `pi -p` drive spawn and timeout block (structural finding 1). The project convention keeps a justification beside every retained clone, and this one now has none. `.planning/codebase/CONVENTIONS.md` still describes the removed entry.
**Fix:** Either add the old justification (standalone drivers, no sibling import) for the new clone, or make the two spawn blocks diverge. Also update the `ignoredClones` paragraph in CONVENTIONS.md.

### IN-07: The OpenAI stub server has no error handlers

**File:** `tests/live-uat/openai-stub-server.mjs:74-91`
**Issue:** The server has no `error` listener (for example on `EADDRINUSE` when `STUB_PORT` is taken), and `req` has no `error` listener (for a client that aborts mid-body). Either case can crash the stub with a stack trace. The next canary run then fails as "provider unreachable" instead of naming the stub. This is low impact for an operator-run driver.
**Fix:** Add `.on("error", (e) => { console.error(\`openai-stub: ${e.message}\`); process.exit(1); })` to the server, and add `req.on("error", () => res.destroy())`.

---

_Reviewed: 2026-10-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
