---
phase: 04-variable-expansion-at-claude-code-parity
reviewed: 2026-10-07T20:16:34Z
depth: standard
files_reviewed: 54
files_reviewed_list:
  - .github/workflows/ci.yml
  - README.es.md
  - README.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/domain/claude-credential-denylist.ts
  - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - package.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-info.ts
  - tests/architecture/integration-materialization-gate.test.ts
  - tests/architecture/mcp-config-notices.test.ts
  - tests/architecture/peer-floor.test.ts
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/bridges/mcp/adapter-escape.test.ts
  - tests/bridges/mcp/expansion-cases.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/substitute.test.ts
  - tests/domain/claude-credential-denylist.test.ts
  - tests/domain/claude-mcp-variables.test.ts
  - tests/domain/mcp-server-features.test.ts
  - tests/domain/plugin-resolver.test.ts
  - tests/index.test.ts
  - tests/integration/adapter-expansion-conformance.test.ts
  - tests/integration/mcp-home-path-partial.test.ts
  - tests/integration/mcp-override-lifecycle.test.ts
  - tests/integration/mcp-plugin-seed.ts
  - tests/integration/mcp-variable-expansion.test.ts
  - tests/integration/optional-peer.ts
  - tests/integration/pi-mcp-adapter-peer.ts
  - tests/integration/pi-subagents-peer.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/session-env.test.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-07T20:16:34Z
**Depth:** standard
**Files Reviewed:** 54
**Status:** issues_found

## Summary

I reviewed the phase diff `710289a0..HEAD` for the listed files. I checked the adapter-side facts against the real pi-mcp-adapter 5.1.0 source (`/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter`: `utils.ts`, `server-manager.ts`, `mcp-auth-flow.ts`, `mcp-auth-fetch.ts`). I checked the Claude-side facts against `04-EVIDENCE-claude-2.1.291.txt` (`uLo`, `oq`, `U4`, `ZEe`, `NDe`, `Fae`, `tn`, `v5t`). I also ran two probes from the scratchpad through the real `substituteAndInject`, `classifyMcpServer` and adapter functions.

The core escape is sound. The split token, the merged-run escape, the partial-trigger guard and `!!` all survive the adapter's three passes for every plugin-controlled literal I traced, including the cases across a split reference. The `oq` deny arms match the binary: a plain field blanks only a set name, a remote field always writes `""`, the warning fires only when the name is set, and `eRe` reads the install-time value. OAuth `clientSecret` is dropped by the translator, so no `oauth` value reaches the adapter's `!` path. No environment value is written to disk or put into a notice; notices carry only names that match `[A-Za-z_][A-Za-z0-9_]*`.

There are no blockers. The six warnings fall into four groups:

- Two gaps in the D-04-16 / D-04-06 mitigations, each confirmed with the real adapter. A cwd that ends with a partial trigger leaks a remote-sink credential into a header (WR-01). A reference that expands to empty before a `~/` passes the home classifier (WR-02).
- Two notice-accuracy defects. The new variable notices travel on a channel built for file facts, so they are still emitted for entries that were rolled back (WR-03). The "not set" wording is wrong for deny-listed names (WR-04).
- Two env-export robustness defects in `session-env.ts` / `index.ts` (WR-05, WR-06).

## Structural Findings (fallow)

All four duplicate groups come before this phase, or the phase only added an `env` argument inside a block that was already cloned. None is introduced by phase 4:

| Fingerprint location | Instances | Provenance |
| --- | --- | --- |
| `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:585-595` / `:631-641` | 2 | `git blame`: commit `553513a50` (2026-09-13), before this phase. The phase changed lines 247-396 only. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2164-2178` / `:2274-2288` | 2 | The two installable-arm `composeResolvedComponents` blocks were already there. The phase only threaded `env` into both. |
| `tests/architecture/catalog-uat/fixtures/plugin-info.ts:8-26` / `:31-49` / `:55-73` | 3 | Lines the phase did not touch. The phase added a fixture at line 558. |
| `tests/architecture/catalog-uat/fixtures/plugin-info.ts:31-50` / `:55-80` | 2 | Same as above. |

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The `CLAUDE_PROJECT_DIR` export guard misses a cwd that ends with a partial trigger, so a remote-sink credential reaches a remote header

**File:** `extensions/pi-claude-marketplace/shared/session-env.ts:86`, `:103`
**Issue:** D-04-16 (threat T4) skips the export only when the cwd *contains* `$env:` or `{env:`. At user scope, a kept `${CLAUDE_PROJECT_DIR}` is followed by plugin literal text. `adapter-escape.ts` guards a reference only against the text *before* it (`PARTIAL_TRIGGER_TAIL`), never against the reference's runtime value joining with the text *after* it. The adapter's pass 1 inserts the cwd, and pass 2 or pass 3 then reads the joined text. Probe result with the real 5.1.0 `interpolateEnvVars`:

- plugin header `"X-P": "${CLAUDE_PROJECT_DIR}:ANTHROPIC_API_KEY}"`, user scope, `ANTHROPIC_API_KEY` set
- written unchanged as `${CLAUDE_PROJECT_DIR}:ANTHROPIC_API_KEY}`, with no withheld report
- `applyMcpAdapterEnv("/home/u/{env")` returns `true` (exported)
- the adapter outputs `/home/u/sk-secret`, so the remote-sink credential goes to the remote server.

A cwd that ends in `$` (with following text `env:NAME`), `{` (`env:NAME}`), `$e`, `$en`, `$env`, `{e`, `{en` or `{env` does the same. The plugin controls the following text. The cwd must have an unusual name, so the chance is low. Even so, this is a deny-list bypass that the T4 mitigation set out to close. The docs repeat the incomplete rule ("If the directory name holds `$env:` or `{env:`").
**Fix:** Refuse any cwd that contains a trigger prefix anywhere or that ends with one, for example:
```ts
// A marker, or a tail the following entry text can complete into one.
const ADAPTER_MARKER = /\$env:|\{env:|[${](?:e(?:nv?)?)?$/;
if (ADAPTER_MARKER.test(cwd)) {
  return false;
}
```
Alternatively, the escape can insert `SPLIT_TOKEN` after every kept reference whose next text segment starts with a trigger suffix (`/^(?:e?n?v?:|\{)/`-style). That protects every kept reference, not only `CLAUDE_PROJECT_DIR`. Add a conformance row for the cwd-tail case, and update `docs/mcp-compatibility.md`.

### WR-02: The leading-`~` classifier misses a leading reference that expands to empty, so the adapter still home-expands the value

**File:** `extensions/pi-claude-marketplace/domain/mcp-server-features.ts:314-321`
**Issue:** `startsWithHomeMarker` tests only a raw leading `~` and a leading `${NAME:-~…}`. The adapter home-expands *after* interpolation, so any value whose written prefix expands to `""` before a `~/` is home-expanded too. Probe result (real `classifyMcpServer`, `substituteAndInject`, and adapter `expandHomePath(interpolateEnvVars(…))`):

| raw `args[0]` | classifier | written | adapter output | Claude output |
| --- | --- | --- | --- | --- |
| `${A:-}~/x` (A unset) | `supported` | `~/x` | `/home/acolomba/x` | `~/x` |
| `${MISSING}~/x` | `supported` | `${MISSING}~/x` | `/home/acolomba/x` | `${MISSING}~/x` |
| `${OTEL_X}~/x` (set, plain-denied) | `supported` | `~/x` | `/home/acolomba/x` | `~/x` |

D-04-06 / D-04-15 settled this divergence class with a partial install, and that remedy works here too. The docs list only the `${X:-}~/a` case as a "Pi capability gap" divergence. The missing-variable case and the deny-listed case are not documented. The code does not justify treating the empty-default case differently from `${X:-~/a}`, which is blocked.
**Fix:** Make the static check conservative over leading references, as D-04-15 asks:
```ts
// Zero or more leading references, then a home marker, or a reference whose
// default starts with one.
const LEADING_REFS = /^(?:\$\{[A-Za-z_]\w*(?::-[^}]*)?\})*/;
function startsWithHomeMarker(value: string): boolean {
  const rest = value.replace(LEADING_REFS, "");
  return LEADING_HOME.test(rest) || LEADING_HOME_DEFAULT.test(value);
}
```
Or decide to keep the divergence, and document all three forms in `docs/mcp-compatibility.md`.

### WR-03: Variable notices are emitted for entries that a rollback or a disabled landing removed

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:945`, `:1064`; `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1719`, `:1751-1765`, `:1974`
**Issue:** The new `variables-missing` and `credentials-blanked` notices travel on the `mcpConfigNotices` channel. That channel was built for *file* facts (`comments-dropped`, `override-kept`), which stay true after a rollback. A variable notice instead describes an entry's content. `recordMaterializedMember` pushes a member's stage notices into `run.mcpConfigNotices`. When a later member fails, the cascade `undo` runs `cascadeUnstagePlugin`, which removes that member's MCP entries, and appends its own notices to the same list (`:1064`). `member-failed` then returns the whole list, and `withMcpConfigNotices` (`install-flow.ts:1974`) shows it after the failure row. The user reads, for example, `Server "x" from dep … uses environment variables that are not set … pi-mcp-adapter reads them … when it starts the server`, but the server is no longer in `mcp-adapter.json`. The `landedDisabled` path (`:1751-1765`) does the same thing: it concatenates the stage notices with the disable cascade's notices after the disable unstaged the entries. Enable and reconcile paths that unwind on failure probably share this behavior.
**Fix:** Drop a server's variable notices when its entry is unstaged. The simplest way is to filter at the unstage seam. For example, the unstage result (or `recordMaterializedMember`'s undo) removes the `variables-missing` and `credentials-blanked` notices whose `plugin`/`scope` it just unstaged:
```ts
run.mcpConfigNotices = run.mcpConfigNotices.filter(
  (n) => !(isVariableNotice(n) && n.plugin === member.name && n.scope === options.locations.scope),
);
run.mcpConfigNotices.push(...(outcome.mcpConfigNotices ?? []));
```
Add an install-flow test with a failing dependency closure and one with a `landedDisabled` install. Each test must show that no variable notice is sent for the removed server.

### WR-04: "Not set" guidance is wrong for a deny-listed plain-field name that is written as literal text

**File:** `extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts:139`; `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:294-296`
**Issue:** `deniedSegment` writes an unset plain-denied name with no default as the *literal* text `${NAME}` (escaped as `${env:PI_CLAUDE_MARKETPLACE_EMPTY}{NAME}`; probe output `"X":"${env:PI_CLAUDE_MARKETPLACE_EMPTY}{CLAUDE_CODE_OAUTH_TOKEN}"`). It also pushes the name into `missing`. The `MCP server variables not set.` line then says `pi-mcp-adapter reads them from Pi's environment when it starts the server.` That is false for this name: by design (D-04-08) the adapter never reads it, so setting it later changes nothing. `/claude:plugin info` lists the same name under `unset`, which also suggests that setting it would help. Including the name follows Claude's `missingVars`, but the remedy text does not.
**Fix:** Keep the name in Claude's missing list, but do not put it under the "reads them" sentence. One option is to report deny-listed missing names separately (`withheld` with `set: false` in plain fields) and render them with neutral text. Another is to reword the catalog line so it makes no promise about runtime reads, for example: `… uses environment variables that were not set at install: A, B.` Either change is a closed-catalog amendment in `docs/output-catalog.md`.

### WR-05: Skipping the `CLAUDE_PROJECT_DIR` export leaves a stale or inherited value in place

**File:** `extensions/pi-claude-marketplace/shared/session-env.ts:101-108`; pinned by `tests/index.test.ts:1632`
**Issue:** When the cwd holds a marker, `applyMcpAdapterEnv` returns `false` and leaves `process.env.CLAUDE_PROJECT_DIR` alone ("any previous `CLAUDE_PROJECT_DIR` stays"). On `session_start` after a project switch, user-scope servers then expand `${CLAUDE_PROJECT_DIR}` to the *previous* project. At factory time, they expand it to a value Pi inherited from its parent process, for example a shell started under Claude Code, which exports it to MCP and hook children. An MCP server then works on the wrong project, and the user sees only a debug-log line. The test asserts the stale `/work/previous` as the expected result.
**Fix:** Clear the variable on the skip path, so the stale directory is not used. The adapter then sees an unset variable and refuses a `url`, or reads `""` elsewhere:
```ts
if (ADAPTER_MARKERS.some((marker) => cwd.includes(marker))) {
  Reflect.deleteProperty(process.env, "CLAUDE_PROJECT_DIR");
  return false;
}
```
Update the test so that it expects `undefined`.

### WR-06: The reserved empty variable is not reset when the cwd read throws, which breaks the documented "always set first" contract

**File:** `extensions/pi-claude-marketplace/index.ts:35-45`; `extensions/pi-claude-marketplace/shared/session-env.ts:101-102`; pinned by `tests/index.test.ts:1654-1675`
**Issue:** `applyMcpAdapterEnvFrom` calls `applyMcpAdapterEnv(readCwd())`, so `readCwd()` is evaluated first. If it throws (`process.cwd()` on a deleted directory at load, or a `ctx.cwd` getter that throws), `process.env.PI_CLAUDE_MARKETPLACE_EMPTY = ""` never runs. The JSDoc says "The reserved variable is always set to the empty string first", and the D-04-05 rationale says the split tokens and every `url` need it set. If the factory read fails, an inherited non-empty or unset value stays. Then every `url` with a split token is refused (unset), or every split token outputs that value (non-empty) and changes the values written for the server. The NFR-2 test asserts `"stale"` as the expected result, so the test keeps the defect in place.
**Fix:** Set the reserved variable before the cwd read, outside the fallible path:
```ts
function applyMcpAdapterEnvFrom(readCwd: () => string): void {
  process.env[ADAPTER_EMPTY_ENV] = "";
  try { /* read cwd, export CLAUDE_PROJECT_DIR */ } catch (err) { … }
}
```
Alternatively, split `applyMcpAdapterEnv` into `applyAdapterEmptyEnv()` and `applyProjectDir(cwd)`. Update the NFR-2 test so it expects `""`.

## Info

### IN-01: The CI conformance install has no lockfile, so the adapter's transitive dependencies float

**File:** `.github/workflows/ci.yml:121`
**Issue:** `npm install --prefix "$RUNNER_TEMP/pi-mcp-adapter" pi-mcp-adapter@5.1.0 --ignore-scripts --omit=peer` pins the top-level package only. The test imports `dist/mcp-auth-flow.js`, which loads the adapter's runtime dependency graph. That graph resolves fresh on each run, so an upstream transitive release can change or break the job, and third-party code that is not pinned runs inside CI. The `zizmor: ignore[adhoc-packages]` comment acknowledges the ad hoc install, but not the floating dependency tree.
**Fix:** Commit a small `tests/integration/pi-mcp-adapter-pin/package.json` and `package-lock.json`, and run `npm ci --ignore-scripts --prefix` against it. Or at least add `--prefer-dedupe` with an `overrides` pin for the modules the test loads.

### IN-02: Staging reads `process.env` implicitly, so orchestrator tests have to mutate global state

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:380` (`env: input.env ?? process.env`); `tests/orchestrators/reconcile/apply.test.ts:6153-6168`; `tests/orchestrators/import/execute.test.ts:1928-1943`
**Issue:** No orchestrator passes `env` down, so every staging path reads the global environment. The reconcile and import tests therefore set `ANTHROPIC_API_KEY` in `process.env` and restore it in `t.after`. That works under the current per-file sequential runner, but it conflicts with the "dependency injection over test-only seams" convention. It also leaks into anything that runs concurrently in the same process.
**Fix:** Thread a `ClaudeEnv` through the install-ledger context, as `createGetPluginInfo(reader, env)` already does, and inject it in the tests.

### IN-03: No orchestrator-level test shows that install, update, reinstall or enable route the new notices

**File:** `tests/orchestrators/plugin/install-flow.test.ts`, `update-flow.test.ts`, `reinstall-flow.test.ts` (diffs only delete MENV-03 assertions)
**Issue:** D-04-10 requires every staging path to report both notices. Only import (`execute.test.ts`) and reconcile (`apply.test.ts`) have end-to-end tests. The other paths depend on the existing `mcpConfigNotices` plumbing. A regression that filters notices by kind on one path, or the WR-03 rollback case, would not be caught.
**Fix:** Add one standalone-install test and one update test that assert the `MCP server variables not set.` warning after the row. Add a failure-path test for WR-03.

### IN-04: The `scanClaudeServerVariables` remote set includes `streamable-http`, which Claude's `uLo` does not expand

**File:** `extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts:230`
**Issue:** Claude's `uLo` expands `url`/`headers` for `sse`, `http` and `ws` only (evidence line 10). A `streamable-http` server falls through every case there. This has no effect today, because the resolver classifies such a server as unavailable, so `info` never scans it. If a later phase admits `streamable-http`, though, `info` would report variables that Claude never expands.
**Fix:** Use `["sse", "http"]` (`ws` is blocked), or add a comment that names the deferred `streamable-http` decision.

### IN-05: `SCAN_BUILTINS` replaces builtins with `""`, which can join text into a variable that the real expansion would not see

**File:** `extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts:228`
**Issue:** `info` replaces `${CLAUDE_PLUGIN_ROOT}` and the other builtins with `""` before it scans. So `$${CLAUDE_PLUGIN_ROOT}{FOO}` is scanned as `${FOO}`, and `info` lists `FOO` as unset. With the real absolute path, the text is `$/plugins/x{FOO}`, which has no reference. This is cosmetic and limited to `info`.
**Fix:** Use a non-empty placeholder that cannot form a trigger (for example `"/"`) for the scan builtins.

---

_Reviewed: 2026-10-07T20:16:34Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
