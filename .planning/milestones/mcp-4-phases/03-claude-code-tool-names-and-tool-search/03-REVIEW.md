---
phase: 03-claude-code-tool-names-and-tool-search
reviewed: 2026-10-06T00:00:00Z
depth: standard
files_reviewed: 70
files_reviewed_list:
  - docs/hooks-compatibility.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
  - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - README.es.md
  - README.md
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-info.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/catalog-uat/fixtures/plugin-list.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/cross-surface-reason-parity.test.ts
  - tests/architecture/integration-materialization-gate.test.ts
  - tests/architecture/mcp-config-notices.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/bridges/agents/convert.test.ts
  - tests/bridges/agents/stage.test.ts
  - tests/bridges/hooks/dispatch.test.ts
  - tests/bridges/hooks/if-field/index.test.ts
  - tests/bridges/mcp/adapter-doc.test.ts
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/bridges/mcp/marker.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/domain/components/hooks/matcher.test.ts
  - tests/domain/components/hooks/partition.test.ts
  - tests/domain/mcp-resolution.test.ts
  - tests/domain/mcp-server-features.test.ts
  - tests/domain/name.test.ts
  - tests/domain/plugin-resolver.test.ts
  - tests/e2e/install-soft-deps.test.ts
  - tests/integration/mcp-override-lifecycle.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/shared/errors-bridges.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-types.test.ts
  - tests/shared/probe-classifiers.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-06
**Depth:** standard
**Files Reviewed:** 70
**Status:** issues_found

## Summary

I reviewed the phase diff (`93a83942..HEAD`) for the name builder, the closed MCP translation table, the classifier, the carry-forward and write-back rules, the folded collision walk, the hooks prefix matcher, the agent `mcp:` mapping, the info breakdown, and the docs. I checked the adapter and pi-subagents behavior against their installed sources (`~/.cache/pi-cm-phase3-research/rt/node_modules/{pi-mcp-adapter,pi-subagents}`), and the Claude Code side against the 2.1.291 binary.

The core pieces hold up. The key builder matches Claude's `Cn` rule, including astral code units. The D-03-04/D-03-05 carry-forward and write-back rules hold for all four cases (stub only, plugin stops setting a field, user edits a live entry, uninstall). Matcher parsing and dispatch are consistent, and `tool-set` has only one consumer, so `toolPrefixes` cannot be ignored anywhere. The classifier matches the E1 schemas within the recorded D-03-18 strictness.

I found five warnings:

1. The ANAME-01 key change breaks the TR-03 accounting for a server that is in both `mcp-adapter.json` and the legacy `mcp.json`. I reproduced this with a test.
2. The translator drops OAuth for any remote server that also has `headers`.
3. A same-plugin key clash refuses only after four phases have already committed. The doc says "before it writes anything", and the test cannot detect the difference.
4. A per-tool agent `mcp:` entry for a tool name the server does not report exactly makes pi-subagents fail the whole launch. The doc understates this.
5. CI will fail: the fallow audit verdict is `warn`, and the Lint job fails a pull request on `warn`. The clone groups come from an earlier phase's commit.

## Structural Findings (fallow)

Source: `fallow audit` with the project's `.fallowrc.json`, base `000be227` (merge-base with `origin/main`). Verdict: **warn**. Complexity introduced: 0. Dead code introduced: 0.

| # | Type | Introduced | Instances |
|---|------|-----------|-----------|
| S-1 | duplicate_block | yes | `tests/architecture/catalog-uat/fixtures/plugin-info.ts:8-26`, `:31-49`, `:55-73` |
| S-2 | duplicate_block | yes | `tests/architecture/catalog-uat/fixtures/plugin-info.ts:31-50`, `:55-80` |
| S-3 | duplicate_block | no | `tests/architecture/catalog-uat/fixtures/plugin-list.ts:93`, `:270` |
| S-4 | duplicate_block | no | `extensions/pi-claude-marketplace/domain/plugin-resolver.ts:428`, `:470` |
| S-5 | duplicate_block | no | `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2117`, `:2223` |
| S-6 | duplicate_block | no | `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:79`, `install.messaging.ts:108` |

S-3 to S-6 already exist on main and are out of scope. S-1 and S-2 are assessed as WR-05 below.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: A legacy-write failure reports a server as dropped while `mcp.json` still holds it (TR-03 regression)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:377-387` (with `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts:166-176`)

**Issue:** `McpUnstagePartialError.removedNames` leaves out every name that an unwritten file still owns, by comparing raw file keys (`stillOwned`). Before this phase, a server had the same key in both files. Now the adapter file holds `plugin_<p>_<s>_` and the legacy `mcp.json` holds the declared `<s>`. The filter therefore never matches.

Take a plugin installed by an older release, so its entry `db` is in `mcp.json`. It is later updated or reinstalled by this code, so `plugin_sample_db_` is in `mcp-adapter.json`. Both files now hold `db` until the Phase 5 migration runs, or forever if that migration fails. If the uninstall's legacy write then fails:

- `removedNames` is `["plugin_sample_db_"]`.
- `droppedMcpServers` maps that key to `db` and reports `db` as dropped.
- The record subtraction (`orchestrators/plugin/shared.ts:1368`, `marketplace/remove.ts:409`) removes `db` from `resources.mcpServers`, although `mcp.json` still serves it.

I reproduced this. In a copy of the test "TR-03 / ANAME-01: cascadeUnstagePlugin maps the keys a failed legacy write still removed to declared names", I changed the legacy entry to `db` and the record to `["db"]`. The result is `dropped.mcpServers: ["db"]`, but the correct value is `[]`. The existing test uses two different servers (`db` in the adapter file, `legacy` in `mcp.json`), so it cannot see the overlap.

**Fix:** Let the partial error carry the names the unwritten files still own, and exclude a declared name when either its key or the name itself is still owned:
```ts
// unstage.ts: throw new McpUnstagePartialError(removed, notices, writtenFiles, { cause: err, stillOwned: [...stillOwned] })
function droppedMcpServers(plugin, declaredNames, removedNames, stillOwned: readonly string[] = []) {
  const removed = new Set(removedNames);
  const live = new Set(stillOwned);
  return declaredNames.filter((name) => {
    const key = generatedMcpServerKey(plugin, name);
    return (removed.has(key) || removed.has(name)) && !live.has(key) && !live.has(name);
  });
}
```
Add a test that puts the same declared server in both files.

### WR-02: A remote server with `headers` loses OAuth in pi-mcp-adapter, but keeps it in Claude Code

**File:** `extensions/pi-claude-marketplace/domain/mcp-server-features.ts:77-121, 147-149`

**Issue:** The translator writes `headers` and a mapped `oauth` object, but never writes `auth`. pi-mcp-adapter 5.0.0 `supportsOAuth` (`mcp-auth-flow.ts:1254-1268`) returns `false` when `auth` is undefined and `headers` is non-empty ("Configured custom headers take precedence over implicit OAuth auto-detection"). The server then connects with OAuth `disabled` (`server-manager.ts:1675-1680`), and a 401 never starts a sign-in.

Claude Code attaches its `authProvider` to every sse and http transport, together with the merged headers (binary: `authProvider:R,fetch:H,requestInit:{...F,headers:{...,...j}}`). So a plugin server that declares `headers: {"X-Team": "core"}` together with `oauth: {clientId, callbackPort}` signs in under Claude and can never authenticate under Pi.

The adapter's own translation of an explicit `oauth` object sets `auth: "oauth"` (`config.ts:1490-1492`). The phase test `ANAME-07: a plugin entry holding every ServerEntry and OAuthConfig key...` (`tests/bridges/mcp/adapter-entry.test.ts:742`) asserts exactly this headers + oauth output. No recorded decision licenses this divergence. D-03-07 forbids passing a plugin's own `auth` value through. It does not forbid deriving `auth: "oauth"` from Claude's `oauth` field.

**Fix:** When the remote server's Claude config carries an `oauth` object, or carries `headers` (Claude keeps OAuth in both cases), write `auth: "oauth"`. Document the mapping in the table in `docs/mcp-compatibility.md`:
```ts
function remoteOptions(server) {
  const oauth = oauthField(server.oauth);
  const explicitOAuth = isPlainObject(server.oauth) || isPlainObject(server.headers);
  return { ...(explicitOAuth ? { auth: "oauth" } : {}), ...oauth, ...remoteTimeoutField(server) };
}
```
If `auth: "oauth"` is judged too broad for header-authenticated servers, write it at least when `oauth` is present. Record the headers-only divergence as a Pi capability gap.

### WR-03: A same-plugin key clash refuses after skills, commands, agents and hooks are committed, despite "before any write"

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:228-249` (called from the `mcp` phase, `orchestrators/plugin/install-outcome.ts:964-977`)

**Issue:** D-03-12 says a same-plugin key clash refuses "before any write". `docs/mcp-compatibility.md` says "An install, update, or reinstall fails before it writes anything if the new key is equal to the key of another server." In the install ledger, though, `keyedServers` runs inside `prepareStageMcpServers` during the fifth phase. By then `commitPreparedSkills`, `commitPreparedCommands`, `commitPreparedAgents` and the hooks phase have already written to disk (`install-outcome.ts:792, 835, 883, 925`). The refusal depends on their rollback, and a rollback that fails part way leaves artifacts behind.

The clash depends only on the plugin's declared server names, so it can be found before the ledger runs. Meanwhile `list` and `info` show such a plugin as installable, although every install of it fails.

The test `ANAME-03: an install whose two servers share one key refuses before any write` (`tests/orchestrators/plugin/install-outcome.test.ts:1590`) seeds a plugin with only MCP servers. It asserts only that `mcp-adapter.json` is absent, so it cannot detect an earlier phase's write.

**Fix:** Check the keys before `transaction.runPhases` (`install-outcome.ts:1224`), with a pure helper exported from the mcp bridge or from `domain/`. Possibly also classify the plugin `unavailable` in the resolver, so `list`/`info` agree. Seed the test plugin with a skill and assert that the skill directory never appears:
```ts
// before runPhases:
assertDistinctMcpServerKeys(c.resolved.name, Object.keys(c.resolved.mcpServers)); // throws McpServerKeyCollisionError
```

### WR-04: A per-tool `mcp:` entry for a tool the server does not report exactly fails the whole agent launch; the doc understates this

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:248-264, 283-293`; `docs/mcp-compatibility.md:151`; `README.md` ("Customizing generated agents")

**Issue:** `matchMcpGrant` turns `mcp__plugin_<p>_<s>__<tool>` into `mcp:plugin_<p>_<s>_/<tool>`, where `<tool>` is the Claude-normalized name. pi-subagents compares that part with the raw tool name in the adapter's cache (`mcp-direct-tool-grant.js`: `toolFilter.has(tool.name)`). A selector that matches no tool is reported as unresolved, and `child-tool-plan.js:218-222` then throws, so the launch fails.

Three cases trigger this:

- A server reports a tool whose name holds `.`, which MCP tool names allow, or any other character that Claude replaces.
- A server version renames or removes a tool.
- An agent `tools:` list holds a typo.

Claude Code treats an unmatched allowlist name as harmless. After this conversion, the whole agent can no longer launch.

`docs/mcp-compatibility.md:151` says only that "the agent cannot get the tool through its Claude Code name", and the converter emits no warning for per-tool entries. `MCP_ASYNC_WARNING` covers the foreground and uncached-server failures, but not this one. The strict allowlist is a pi-subagents capability gap, but the user-facing statement of that gap is inaccurate.

**Fix:** Correct the doc and the README to say that the launch fails when the server reports no tool with exactly that raw name. Add a conversion warning for each per-tool `mcp:` entry, for example: `tools entry mcp__plugin_p_s__x maps to mcp:plugin_p_s_/x; pi-subagents fails the launch if the server reports no tool named exactly "x"`. Alternatively, offer the whole-server form as the documented workaround.

### WR-05: The pull request's `fallow-audit` CI job will fail on the reshaped `plugin-info.ts` clone groups

**File:** `tests/architecture/catalog-uat/fixtures/plugin-info.ts:8-80` (structural findings S-1, S-2)

**Issue:** The fallow audit verdict against main is `warn`. The Lint workflow's `fallow-audit` job fails a pull request on `warn` (STACK.md, CONVENTIONS.md). The three `commit-commands` info fixtures at lines 8, 31 and 55 existed on main as a non-reported clone. Commit `2502cbf3` ("feat(info): name required companions on the info row", ADET-01, an earlier phase of this branch, before this phase's base `93a83942`) added the same `requires:` line to each block, and that turned them into two introduced clone groups. This phase's commit `fb0b06b5` edited the same file only at lines 100-131 and 528+. It did not cause the groups, but it did not fix them either. The duplication itself is harmless fixture data. The gate failure, however, blocks the pull request.

**Fix:** Build the shared row once and spread it into each fixture, for example `const COMMIT_COMMANDS_INSTALLED = { status: "installed", name: "commit-commands", ..., requires: [...] } as const;`, then `plugin: { ...COMMIT_COMMANDS_INSTALLED, dependencies: [...] }`. Do not use an `ignoredClones` key: by the project convention, a `-rN` handle is not a stable key. Re-run `npx fallow audit --base origin/main` and check that the verdict is `pass`.

## Info

### IN-01: Folding broadens the self-replace exemption so that it skips the walk of the other sources for a renamed key

**File:** `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:156-161`
**Issue:** The exemption now applies when `ours` holds any key that folds equal to the new key, not only the exact key. Example: a new version renames server `a-b` to `a_b`. The new key `plugin_p_a_b_` was never checked against the other eight sources, but `continue` skips the walk for it. A user server `plugin_p_a_b_` in `.pi/mcp-adapter.json` or `.mcp.json` would then go undetected.
**Fix:** Apply the exemption only to the exact key: `Object.hasOwn(check.ours, name) && foldedMatches(Object.keys(check.theirs), name).length === 0`.

### IN-02: `translatedEntry`'s two warnings are unreachable in production after D-03-18

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:86-98`
**Issue:** Since D-03-18, `classifyMcpServer` rejects a non-object server and a stdio `env` that is not a string record as `malformed`, so the plugin resolves `unavailable` and never stages. Both warnings now fire only from tests that call `stampServers` directly. The comment still presents them as user-facing behavior.
**Fix:** Either delete them, or document them as defense-in-depth for callers that bypass the resolver.

### IN-03: `authServerMetadataUrl` is accepted on the `https://` prefix alone; Claude also requires a valid URL

**File:** `extensions/pi-claude-marketplace/domain/mcp-server-features.ts:112, 217`
**Issue:** Claude's schema is `o().url().startsWith("https://")` (E1). A value such as `"https://"` or `"https://bad host"` passes this extension's pattern and is copied to the adapter. Claude rejects such a server as malformed, and D-03-18 would make the plugin `unavailable`.
**Fix:** Add `URL.canParse(value)` to the check in both `oauthField` and the classifier (for example `Type.String({ pattern: "^https://", format: "uri" })` plus `URL.canParse`).

### IN-04: `info` prints `requires: pi-mcp-adapter` for a plugin whose MCP servers are all left out

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1006-1010, 2889-2893`
**Issue:** `composeMcpEntries` puts the dropped servers into `components.mcp`, and `withCompanionRequirements` derives the MCP companion from `components.mcp.length > 0`. So a plugin whose only server is `ws` shows `requires: pi-mcp-adapter`, although no install of it (normal or `--partial`) ever writes a server. The install surface derives the companion from the record (`install-flow.ts:1062`), so the two surfaces disagree.
**Fix:** Count only entries without `unsupportedFeature` when deriving `declaresMcp`.

### IN-05: The docs overstate key uniqueness across plugins

**File:** `README.md` ("Two plugins can use the same server name, because each key holds the plugin name"); `docs/mcp-compatibility.md:30`
**Issue:** `plugin:a_b:c` and `plugin:a:b_c` both normalize to `plugin_a_b_c_`. The same happens for any server name that holds `:` or another replaced character. The second install is refused by the collision walk, which is correct, but the docs say that the keys always differ.
**Fix:** Say instead that the keys usually differ, and that a pair which normalizes to the same key is refused like any other collision.

---

_Reviewed: 2026-10-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
