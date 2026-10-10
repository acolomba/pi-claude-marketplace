---
phase: 01-pi-1-0-floor-and-adapter-only-detection
reviewed: 2026-10-03T01:05:49Z
iteration: 2
depth: standard
files_reviewed: 7
files_reviewed_list:
  - scripts/pi.sh
  - CONTRIBUTING.md
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - tests/platform/pi-api.test.ts
  - tests/e2e/adapter-detection-rpc.test.ts
  - tests/architecture/peer-floor.test.ts
  - docs/prd/pi-claude-marketplace-prd.md
findings:
  critical: 0
  warning: 0
  info: 11
  total: 11
status: clean
---

# Phase 1: Code Review Report (iteration 2)

**Reviewed:** 2026-10-03T01:05:49Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** clean

## Summary

This is a re-review after the iteration-1 fixes (`git diff 19b0cfd4..HEAD`: commits cd50c39b, d1e24ebd, 440968b4, c3488792). I checked each fix against the current source and against the installed Pi 1.0.0 and pi-mcp-adapter code. All five blocking findings (CR-01, WR-01..WR-04) are resolved. I found no new Critical or Warning issues. The seven prior Info findings are still open, and I add four new Info findings (IN-08..IN-11).

Resolution of the prior findings:

| ID | Status | Evidence |
|----|--------|----------|
| CR-01 | Resolved | `scripts/pi.sh:206-208` sets `pi_home="$prefix/home"` when neither `--home` nor `PI_CODING_AGENT_DIR` is set, and `:210-214` then exports `PI_CODING_AGENT_DIR` and `PI_CODING_AGENT_SESSION_DIR` below it. The emptiness test `-z "${PI_CODING_AGENT_DIR:-}"` matches Pi's own truthiness check (`config.js:451`, `if (envDir)`), so an empty exported value also gets the sandbox. pi-mcp-adapter resolves its agent directory from the same env var (`agent-dir.ts:14`), so the adapter's `settings.json` write follows the sandbox. Precedence: `--home` > explicit `PI_CODING_AGENT_DIR` > `<prefix>/home`. The usage text and `CONTRIBUTING.md:47` document the default and the opt-in route. |
| WR-01 | Resolved | `pi-api.ts:204-213` returns false unless `command.source === "extension"`, then accepts either the source or the `mcp-adapter[:n]` name signal. This matches Pi 1.0's `getCommands()` (`agent-session.js:2645-2665`), which tags extension commands `"extension"` and prompts/skills `"prompt"`/`"skill"`. New matrix rows (`pi-api.test.ts:483-502`) use non-adapter names, so they isolate the source signal. The PRD glossary, RH-4 row and §9.3 diagram now say "extension command". |
| WR-02 | Resolved | `assertCleanSession` (`adapter-detection-rpc.test.ts:228-231`) asserts that `get_commands` succeeded and that `/inventory-probe` was `handled`. `inventoryEntries` (`:277-279`) fails loudly when the probe did not notify. |
| WR-03 | Resolved | The sentinel PID read and its `t.after` SIGKILL now come first (`:367-374`). The stub PID read moved to the assert section, and a missing file becomes a named `assert.fail` (`:397-399`). See IN-09 for a remaining edge. |
| WR-04 | Resolved | `peer-floor.test.ts:76,81` asserts `peerDependenciesMeta["pi-subagents"]` deep-equals `{ optional: true }`. `package.json:68-70` satisfies it. |
| IN-01..IN-07 | Open | Re-checked against the current tree: none were in the fixer's scope, and each one still reproduces (details below). |

I checked the regressions the caller asked about:

- **pi.sh default home and env precedence:** correct as described above. Both the default and `--home` paths run `mkdir -p` before `exec`. The default sits after the prefix is canonicalized (`:149`), so it is absolute and does not depend on `--cd`.
- **Adapter detection after the WR-01 change:** the `mcp-adapter` and `mcp-adapter:<n>` extension commands are still detected (rows at `pi-api.test.ts:354-381`). A tool from the adapter is still detected through the tool arm, which is unchanged. A fork install (`forkAdapterCommand`, foreign source, `source: "extension"`) and a `disableProxyTool` adapter (command only) still count (`:334-352`). Pi's built-in MCP (`builtin:mcp` source, `mcp` name) still does not count.
- **Probe throws:** `probeArm` is unchanged. Both one-arm-throws tests (`:596-634`) and the both-throw test (`:813`) still hold, and a throw still degrades to not-loaded.

A recorded decision in `.planning/STATE.md:571` still says "a command or tool sourceInfo.source". That file is outside this review's scope, but the recorded decision now disagrees with the code and the PRD.

## Narrative Findings (AI reviewer)

## Info

### IN-01: Doc comments still say the probe reads only `getAllTools()` (open, carried from iteration 1)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:115`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:171`, `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:140`, `tests/edge/handlers/plugin/uninstall.test.ts:23-26`
**Issue:** These comments say `pi` "carries `getAllTools()` for RH-3/RH-4", or call `pi.getAllTools` "the source of truth". RH-4 (ADET-02) now reads `getCommands()` first.
**Fix:** Change the wording to "carries `getAllTools()` and `getCommands()` for the soft-dependency probes (RH-3, ADET-02, WDEP-01)".

### IN-02: Live-UAT driver mocks do not define `getCommands` (open, carried from iteration 1)

**File:** `tests/live-uat/stop-canary.mjs:399`, `tests/live-uat/manifest-absence-canary.mjs:319`, `tests/live-uat/workflow-storage-canary.mjs:158`
**Issue:** These mocks still define only `getAllTools`. The adapter arm reaches "not loaded" only because `getCommands()` throws a `TypeError` that `probeArm` catches. That path would hide a real probe defect.
**Fix:** Add `getCommands: () => []` beside each `getAllTools` stub.

### IN-03: The README does not state the new pi-subagents floor (open, carried from iteration 1)

**File:** `README.md:137`, `README.es.md:137`
**Issue:** The README still says `excludeTools` "needs pi-subagents 0.62.0 or newer", but 0.62.0 is below the declared `>=0.74.0` floor.
**Fix:** Write "pi-subagents 0.74.0 or newer" in both READMEs, and drop or reword the 0.62.0 caveat.

### IN-04: The `dispatchRow` change removes the value's type before it casts (open, carried from iteration 1)

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:345-346`
**Issue:** The code still widens the render map to `Readonly<Record<string, unknown>>` and casts the lookup to `RenderFn<...> | undefined`. That cast accepts any value.
**Fix:** Widen only the key and keep the `RenderFn` value type. If the lint rule still fires, record why in a comment.

### IN-05: Three copies of a local `toolInfo` helper remain (open, carried from iteration 1)

**File:** `tests/orchestrators/plugin/install-flow.test.ts:292`, `tests/orchestrators/plugin/enable-disable.test.ts:118`, `tests/orchestrators/plugin/reinstall-flow.test.ts:178`
**Issue:** Each file still defines its own private `toolInfo(name): ToolInventoryItem`.
**Fix:** Export a `toolInventoryItem(name)` seed from `tests/platform/pi-inventory-seed.ts` and import it in all three files.

### IN-06: An unexplained clone between the two canary drivers replaces the explained one (open, carried from iteration 1)

**File:** `tests/live-uat/manifest-absence-canary.mjs:629`, `tests/live-uat/stop-canary.mjs:483-513`, `.fallowrc.json` (no `ignoredClones`)
**Issue:** The spawn and timeout clone between the drivers has no justification header, and `.planning/codebase/CONVENTIONS.md` still describes the removed `dup:cc950b18:2` entry.
**Fix:** Either add the justification header or make the two spawn blocks diverge. Also update CONVENTIONS.md.

### IN-07: The OpenAI stub server has no error handlers (open, carried from iteration 1)

**File:** `tests/live-uat/openai-stub-server.mjs:74-91`
**Issue:** The server has no `error` listener on the server or on `req`, so an `EADDRINUSE` or an aborted request can crash the stub without naming the cause.
**Fix:** Add a server `error` listener that names the stub and exits 1, and add `req.on("error", () => res.destroy())`.

### IN-08: The ADET-02 doc comment has an over-long line and a garbled clause (new)

**File:** `extensions/pi-claude-marketplace/platform/pi-api.ts:229-231`
**Issue:** The WR-01 edit rewrapped only part of the block. Line 231 is 98 characters, while the rest of the block wraps near 78. The clause "or an extension command or a tool `sourceInfo.source` contains" does not read correctly: it means "an extension command's or a tool's `sourceInfo.source`".
**Fix:**
```ts
/**
 * ADET-02: pi-mcp-adapter is loaded iff `pi.getCommands()` lists an extension
 * command named `mcp-adapter`, or the `sourceInfo.source` of an extension
 * command or of a tool contains "pi-mcp-adapter". The command is present with
 * `disableProxyTool` and in a fork. A bare tool named `mcp` does not count,
 * and neither does Pi's built-in MCP (`mcp__*` tools and an `mcp` command from
 * `builtin:mcp`). ...
 */
```

### IN-09: `readPid` accepts an empty or non-numeric PID file, and a missing sentinel file now pre-empts the clean-session diagnosis (new)

**File:** `tests/e2e/adapter-detection-rpc.test.ts:293-295`, `:367-377`
**Issue:** `readPid` returns `Number(contents)`. An empty file gives `0`, and the cleanup registered at `:368-374` would then run `process.kill(0, "SIGKILL")`, which signals the test runner's whole process group. This needs a sentinel PID file that is truncated but not yet written, which is very unlikely because the sentinel writes synchronously while its extension loads. Still, the WR-03 fix now registers that kill on more failure paths. A related issue: because `readPid(sentinelPidFile)` moved ahead of `assertCleanSession(run)`, a session where the sentinel extension failed to load now fails with a raw `ENOENT`. Before, `assertCleanSession` would have named the cause through `run.extensionErrors`.
**Fix:** Validate the PID, and make a missing sentinel file non-fatal before the clean-session check:
```ts
async function readPid(pidFile: string): Promise<number> {
  const pid = Number(await readFile(pidFile, "utf8"));
  assert.ok(Number.isInteger(pid) && pid > 0, `${pidFile} holds no PID`);
  return pid;
}
```
Then register the cleanup only when the read succeeds (`readPid(...).catch(() => undefined)`), and assert the PID after `assertCleanSession(run)`.

### IN-10: The pi.sh sandbox default has no regression guard, and the fresh home's missing credentials are not documented (new)

**File:** `scripts/pi.sh:202-214`, `CONTRIBUTING.md:47`
**Issue:** CR-01's safety property ("a plain `scripts/pi.sh` run never edits `~/.pi/agent/settings.json`") rests on four lines that no test exercises (`git grep pi.sh -- tests` finds only `tests/pi-runtime.ts` and a README). If a later edit moves or drops the default, the global settings write comes back without any test going red. Two smaller behavior changes are also not documented:
- The default home starts without `auth.json` and `models.json`. A developer who used to run `scripts/pi.sh` against their logged-in `~/.pi/agent` now has to `/login` again, and the new credentials land under the XDG cache prefix.
- The default overwrites an operator-exported `PI_CODING_AGENT_SESSION_DIR` when `PI_CODING_AGENT_DIR` is unset.
**Fix:** Add one sentence to `CONTRIBUTING.md` and `usage()`: the default home starts without credentials, so log in once or use provider env vars. Consider honoring a preset `PI_CODING_AGENT_SESSION_DIR` (`export PI_CODING_AGENT_SESSION_DIR="${PI_CODING_AGENT_SESSION_DIR:-$pi_home/sessions}"` in the default branch only). If a cheap harness is possible, add a `tests/scripts` case that runs the script with a seeded prefix and asserts that `PI_CODING_AGENT_DIR` resolves under the prefix.

### IN-11: Inventory and command readers still turn a shape change into an empty list (new, residual from WR-02)

**File:** `tests/e2e/adapter-detection-rpc.test.ts:284`, `tests/e2e/_rpc.ts:374-382`
**Issue:** After the WR-02 fix, a missing step fails loudly. A successful step with an unexpected payload shape still reads as `[]`: `inventoryEntries` when `tools` or `commands` is not an array, and `listedCommands` when `data.commands` is not an array. The "built-in MCP disabled" state expects `mcpCommands: []` and `mcpToolPaths: []`, so that state alone would pass vacuously. The sibling states expect non-empty `mcp` entries, so the suite as a whole would still go red.
**Fix:** In `inventoryEntries`, call `assert.fail` when `entries` is not an array, instead of returning `[]`.

---

_Reviewed: 2026-10-03T01:05:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
