---
phase: "06"
slug: "hook-inputs-and-events"
status: verified
threats_open: 0
threats_open_nonblocking: 0
threats_total: 31
threats_closed: 31
asvs_level: 1
block_on: high
created: "2026-11-15"
---

# Phase 06 — Security

All 31 declared threats are closed: 3 high (T-06-01, T-06-23, T-06-SC), 11 medium and 17 low. Of these, 23 are mitigated and 8 are accepted (T-06-03, T-06-10, T-06-13, T-06-15, T-06-21, T-06-22, T-06-24, T-06-26). The auditor read source and tests at `392e6ea2` and ran the owner suites of the phase in an isolated Pi home: 235 tests passed (hooks-lifecycle, child-root-session, mcp-server-table, typed-expansion, tool-batch, subagent-child; the phase cases of event-router, dispatch, runtime, settle, hook-env, translation-context; `test/index.test.ts`). The working tree was unchanged. No SUMMARY flagged an unregistered threat.

## Trust Boundaries

| Boundary | Description | Data crossing |
| --- | --- | --- |
| Pi session data to plugin hook stdin | The bridge copies Pi facts into a third-party hook's input | `tool_use_id`, `duration_ms`, `mcp_server`, `effort`, `model`, `session_title`, `custom_instructions`, the typed line |
| A pi-subagents child to its launching session | The child reads a variable and the launcher's session header to name the root session | `PI_SUBAGENT_PARENT_SESSION`, the first line of the launcher's session file |
| A typed line to the expansion of a command | An expansion hook decides whether a template or skill expands | Block, `continue: false`, context |
| The spike and the harness to the user's home | Launches that save sessions | `HOME`, `PI_CODING_AGENT_DIR`, session files |

## Threat Register

Paths without a prefix are relative to `extensions/pi-claude-marketplace/bridges/hooks/`.

| Threat ID | Category | Severity | Disposition | Mitigation evidence | Status |
| --- | --- | --- | --- | --- | --- |
| T-06-01 | Tampering | high | mitigate | Spike runner sets `HOME` and `PI_CODING_AGENT_DIR` under a `mktemp -d` folder and exits 99 if either lies elsewhere (06-S7-SPIKE.md:12,36-43); commit `9d6e4a74` touches no product file. | closed |
| T-06-02 | Information disclosure | low | mitigate | `--offline`, `PI_OFFLINE=1`, provider keys unset, faux model (06-S7-SPIKE.md:12-14). | closed |
| T-06-03 | Information disclosure | low | accept | 06-02 threat model; docs/hooks-compatibility.md:29,391. | closed |
| T-06-04 | Tampering | low | mitigate | `editPairToolUseId` (tool-batch.ts:126-132), used by the pre and result paths (dispatch.ts:1152, 1397); tool-batch.test.ts:154-171, dispatch.test.ts:1914, 5917-5925. | closed |
| T-06-05 | Tampering | low | mitigate | First-appearance tokens (features/lib/hook-run-tokens.ts:33-59); non-string ids print as JSON (runs.steps.ts:89); features/hook/tool-use.feature:885-888. | closed |
| T-06-06 | Tampering | low | mitigate | `readSessionLaunchFacts` reads only `getHeader()` and `getEntries()` in its own try (event-router.ts:193-208). | closed |
| T-06-07 | Tampering | medium | mitigate | Fork first, then `message` entries (payloads/session-start.ts:49-55); event-router.test.ts:3862-4020; features/hook/session.feature:428-515; a throwing read keeps `startup` and dispatches (0d07e530). | closed |
| T-06-08 | Tampering | medium | mitigate | `resolveRpcSandbox` refuses paths outside tmpdir or inside the repo (test/e2e/_rpc.ts:229-268); the release removes the sessions folder (features/support/world.ts:755-756). | closed |
| T-06-09 | Denial of service | low | mitigate | `takeToolDuration` deletes the mark (runtime.ts:524-531) before the bucket is read; `agentEndCacheHandler` and the reset clear marks (settle.ts:152, runtime.ts:358-366). | closed |
| T-06-10 | Information disclosure | low | accept | 06-04 threat model; docs/hooks-compatibility.md:392. | closed |
| T-06-11 | Tampering | low | mitigate | No mark, no field (dispatch.ts:1353-1360); `Math.max(0, Math.round(...))` (runtime.ts:530); runtime.test.ts:672-770. | closed |
| T-06-12 | Spoofing | medium | mitigate | Exact built-in name or whole key prefix; two claims give nothing (mcp-server-table.ts:57-82); mcp-server-table.test.ts:186-217. | closed |
| T-06-13 | Information disclosure | low | accept | 06-05 threat model; docs/hooks-compatibility.md:393. | closed |
| T-06-14 | Tampering | low | mitigate | Table rebuilt each hydrate, disabled records skipped, project table emptied before trust check (event-router.ts:746-787, 977-983; mcp-server-table.ts:44-53). | closed |
| T-06-15 | Information disclosure | low | accept | 06-06 threat model; docs/hooks-compatibility.md:395-397. | closed |
| T-06-16 | Tampering | low | mitigate | Values only as stdin JSON members (translation-context.ts:137-150, payloads/pre-compact.ts:41-42); 256 KB stdin cap (spawn-helpers.ts:20-22,82). | closed |
| T-06-17 | Spoofing | medium | mitigate | A value with a path separator is no id (platform/subagent-child.ts:49-52); a header id that differs gives no root (child-root-session.ts:86-88). | closed |
| T-06-18 | Denial of service | medium | mitigate | Absolute path, `O_NONBLOCK`, regular file, at most 65,536 bytes, first line, parse in try (child-root-session.ts:17,39-62); child-root-session.test.ts:168-216. | closed |
| T-06-19 | Tampering | medium | mitigate | `ownSessionId` keys the env file, the journal owner, and the identity guard (hook-env.ts:103-105, async-rewake/registry.ts:367, translation-context.ts:136-137); `TranslationContext` has no `ownSessionId`. | closed |
| T-06-20 | Spoofing | medium | mitigate | Root applied only with a known identity; child tool payloads always add `agent_id` (pre-tool-use.ts:58, post-tool-use.ts:84, post-tool-use-failure.ts:80). | closed |
| T-06-21 | Information disclosure | low | accept | 06-09 threat model; docs/hooks-compatibility.md:66-71. | closed |
| T-06-22 | Information disclosure | low | accept | 06-11 threat model; docs/hooks-compatibility.md:394; a throwing read gives no field (translation-context.ts:94-106). | closed |
| T-06-23 | Elevation of privilege | high | mitigate | Block and stop answer `handled` (event-adapters.ts:719-739, dispatch.ts:1435-1441); expansion handler registered after `UserPromptSubmit` and before the alias and command handlers (event-router.ts:1464-1487, index.ts:159-162,333-336); hooks-lifecycle.test.ts:386-401, index.test.ts:428-438; features/hook/prompt-expansion.feature:8-52. | closed |
| T-06-24 | Denial of service | low | accept | 06-08 threat model; a pattern that does not compile drops its group (partition.ts:52-55). | closed |
| T-06-25 | Tampering | low | mitigate | `withCappedContext` caps every result (dispatch-exec.ts:280-295,496; context-cap.ts:81-93). | closed |
| T-06-26 | Information disclosure | low | accept | 06-08 threat model; docs/hooks-compatibility.md:192-202. | closed |
| T-06-27 | Spoofing | medium | mitigate | Resolver reads the same `pi.getCommands()` and name cache as the alias handler with its precedence (typed-expansion.ts:141-164); typed-expansion.test.ts:179-260. | closed |
| T-06-28 | Elevation of privilege | medium | mitigate | Falls back to Pi's own names when the table fails (typed-expansion.ts:74-111); typed-expansion.test.ts:227. | closed |
| T-06-29 | Denial of service | low | mitigate | Table cached per trust state and directory (skill-alias-state.ts:359-388); resolver runs only with a routed hook (event-router.ts:1044-1050). | closed |
| T-06-30 | Repudiation | medium | mitigate | The page names the four residuals (docs/hooks-compatibility.md:39-51, 71, 121, 216-218). | closed |
| T-06-SC | Tampering | high | mitigate | No dependency file changed in `a1f54614..HEAD`; no new package import. | closed |

## Accepted Risks

| ID | Threat | Reason |
| --- | --- | --- |
| AR-06-01 | T-06-03, T-06-10, T-06-13, T-06-15, T-06-21, T-06-22, T-06-26 | Each field is Claude Code's own stdin field, sent to code of a plugin the user installed, which already sees the tool input and the typed line. The compatibility page lists each. |
| AR-06-02 | T-06-24 | The exposure of a `command_name` matcher equals that of a tool matcher (PG-HOOK-03). |

## Advisory Residuals (non-blocking)

- T-06-04: `editPairToolUseId` appends `#<n>` to any id, so a provider id that already ends in `#<n>` could equal another call's pair id.
- T-06-29: `createPluginNamesCache` keeps no failed load, so a table that keeps failing reloads on each typed slash line while an expansion hook is routed.
- T-06-17: when the launcher's file cannot be read, the variable's id is used unchecked (by design; docs/hooks-compatibility.md:71).

## Security Audit 2026-11-15

| Metric | Count |
|---|---|
| Threats found | 31 |
| Closed | 31 |
| Open | 0 |
