---
status: investigating
trigger: "right, do try to automate these tests before interrupting"
created: 2026-11-12
updated: 2026-11-12
---

## Current Focus

hypothesis: Confirmed upstream companion behavior: pi-subagents sets `MCP_DIRECT_TOOLS=__none__` for child agents without explicit MCP selectors, so pi-mcp-adapter registers zero direct MCP tools regardless of the adapter's `directTools:true` config or the agent's `excludeTools`.
test: Source trace (`pi-subagents/src/runs/shared/child-launch.js:48-62` and `pi-mcp-adapter/index.ts:766-768`) plus the detached child provider schemas and direct-call results.
expecting: An explicit short grant works; control and restricted agents without MCP selectors both lack direct tools, so the exclusion check cannot distinguish exclusion from blanket suppression.
next_action: Hand the source-backed one-pass/one-blocked result and retained repro artifact paths to the parent; do not change product code or force the child tool loadout to pass.

## Symptoms

expected: Automate both pending Phase 01 live-child acceptance checks before asking the user to test them.
actual: Phase 01 UAT is pending because existing behavioral coverage checks staged grants/exclusions, foreground behavior, and a stand-in child rather than the real detached child.
errors: No product failure observed yet; the claimed harness limitation has not been experimentally established in this session.
reproduction: See .planning/phases/01-companion-floors-and-mcp-defaults/01-UAT.md and 01-VERIFICATION.md; use the installed pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1.
started: Final Phase 01 verification, after all 11 plans and the review fix passed the combined suite.

## Evidence

- Phase 01 full npm run check passed: 1812 adapter scenarios, 155 built-in scenarios, 354 direct coverage pairs.
- The user explicitly requested automation attempts before interruption. This supersedes treating the existing manual-only labels as an instruction to stop without trying.
- Disposable fixture /tmp/pg1-live-bvydwvtq contains demo:runner (short grant), demo:restricted (long disallowed tool), demo:control (unrestricted), two local echo servers, and an empty isolated Pi home. Direct stub protocol smoke passed; no real child has run.
- Installed pi-subagents 0.88.0 `spawnRunner` starts a separate Node runner with inherited process environment; `subagent-runner.js` sets `PI_SUBAGENT_CHILD=1` before child sessions. Its runner child launch enables ambient extensions. The scripted provider writes the actual `tools` array from the model request to `<HOME>/harness/model-calls.jsonl`.
- An isolated RPC run with the local fixture returned real async run IDs and directories for runner, control, and restricted, but every child failed before a model call: `Model "faux/faux-1" not found`. Parent model calls continued and consumed the shared script steps, so the harness also needs separate parent/child script queues. No child MCP observation can yet be concluded.
- The RPC startup failure was environmental: sandboxed cucumber could not bind 127.0.0.1 (`EPERM`); running the isolated local harness with loopback permission started Pi and completed plugin install. This does not indicate an application defect.
- An ambient symlink experiment still ended with `Model "faux/faux-1" not found`. The child status recorded real runner PID 3259209, `disableAmbientExtensions:false`, no configured child extensions, and no provider call. The symlink experiment did not register the provider in that child.
- Explicit `extensions:` on the isolated staged agent produced configured child extension digests, yet faux/faux-1 still did not resolve. A fresh parent started with ambient extension symlinks also failed the same way. The repository already has a keyless OpenAI-compatible stand-in (`test/live-uat/openai-stub-server.mjs`) configured through isolated `models.json`, which avoids child extension provider registration and scripts each request by user-task marker.
- The keyless loopback provider through isolated `models.json` reached a real detached `demo:runner` child. PID 3261855 and its async status/transcript recorded a completed run; its actual provider schema held only `mcp__plugin_demo_stub__echo`, the MCP stub logged `tools/call` with `pg1-live-short`, and the child received `echo:pg1-live-short`. The first local server script stopped too early for other children; bounded status polling fixed that harness error.
- With the isolated adapter entries set to `directTools:true`, the parent provider request offered both exact names, including `mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c`. A real unrestricted control child (PID 3263943) offered `mcp` and namespace proxies, not that long direct name. `mcp({connect: longServer})` listed the exact long name, but its next provider request still omitted it; a direct call returned tool-not-found. Search produced the same result. This does not satisfy the unrestricted-child control acceptance criterion.
- A real restricted child (PID 3264825, asyncDir `/tmp/pg1-live-bvydwvtq/home/tmp/pi-subagents-uid-1000/async-subagent-runs/08ca46f2-df42-473b-900a-6ab9b547f479`) completed after connecting to the short server. Its actual provider schemas before and after connect omitted both exact direct tool names; a direct short call returned tool-not-found. Thus the short callable check also fails, and long absence cannot yet be attributed to the disallowedTools rule.
- Source trace identifies the suppressor: pi-subagents 0.88.0 `src/runs/shared/child-launch.js:48-62` unconditionally sets `MCP_DIRECT_TOOLS=__none__` for a child with no `mcpDirectTools` selectors. pi-mcp-adapter 7.0.1 `index.ts:766-768` returns no direct specs when this variable is `__none__`. `index.ts:820-887` then registers no direct tools. This is why `mcp connect` discovers metadata but leaves provider schemas unchanged. Pi's `createAgentSession` accepts the control's absent `tools` field and the restricted child's `excludeTools`; neither is the cause of the blanket suppression.
- Repeatable keyless repro: from this checkout, run `PG_AGENT=demo:control node /tmp/pg1-live-bvydwvtq/drive.mjs > /tmp/pg1-live-bvydwvtq/drive-control.out 2>&1` and `PG_AGENT=demo:restricted node /tmp/pg1-live-bvydwvtq/drive.mjs > /tmp/pg1-live-bvydwvtq/drive-restricted.out 2>&1` with loopback bind permission. The isolated HOME is `/tmp/pg1-live-bvydwvtq/home`, `PI_CODING_AGENT_DIR` is its `agent` directory, cwd is `/tmp/pg1-live-bvydwvtq/project`, and the only provider is a local OpenAI-compatible scripted stand-in (`apiKey: stub`). Exact provider requests and response schemas are in those output files; MCP server requests are in `/tmp/pg1-live-bvydwvtq/server-home/harness/mcp-stub-requests.jsonl`; detached status/transcripts remain in the two async directories cited here. The driver closes its Pi process and HTTP stand-in after each bounded run.
- Completed explicit-grant check: `demo:runner` with `tools: mcp:plugin_demo_stub_/echo` launched detached PID 3263124, asyncDir `/tmp/pg1-live-bvydwvtq/home/tmp/pi-subagents-uid-1000/async-subagent-runs/7e8c4b83-e5b8-4e47-b231-179d48b6ddda`. Both actual child provider schemas contained only `mcp__plugin_demo_stub__echo`; the local server logged `tools/call` with `text: pg1-live-short`, and the child output was `echo:pg1-live-short`. Retained runner log: `/tmp/pg1-live-bvydwvtq/drive.out`.
- Control child PID 3263943's three actual provider schemas each contained 11 tools: `read`, `bash`, `edit`, `write`, `bg_wait`, two marketplace tools, `mcp`, two namespace proxies, `contact_supervisor`. No exact short or long direct tool. Restricted child PID 3264825 had the same 11 names on all three requests. Both children returned tool-not-found on a direct call after `mcp connect`; only the explicit-grant runner produced the echo server call. The unrestricted long-tool control therefore fails, so long-tool exclusion cannot be accepted as verified.

## Eliminated

- hypothesis: Adding user-extension symlinks after the parent starts is sufficient to make the detached child resolve faux/faux-1.
  evidence: A real child launched with `disableAmbientExtensions:false` but its status still ended `Model "faux/faux-1" not found`, with no child provider call.
  timestamp: 2026-11-12
- hypothesis: Explicit child `extensions:` paths, or a fresh parent with ambient symlinks present before launch, make the faux provider resolvable in the detached runner.
  evidence: Both variants launched a real child; each status ended `Model "faux/faux-1" not found`, and neither produced a child provider call.
  timestamp: 2026-11-12
- hypothesis: A late adapter registration or child default active-tool selection alone omits direct MCP tools.
  evidence: pi-subagents explicitly sets child `MCP_DIRECT_TOOLS=__none__`; the adapter returns zero direct specs at its selection boundary before activation. Both unrestricted and restricted provider requests omit direct tools even after `mcp connect`.
  timestamp: 2026-11-12

## Resolution

root_cause: Installed pi-subagents 0.88.0 suppresses pi-mcp-adapter's direct MCP registration for child agents without explicit MCP selectors by injecting `MCP_DIRECT_TOOLS=__none__`. This masks the unrestricted control and the restricted child's permitted short tool, so the intended long-exclusion check is blocked at the upstream companion boundary.
fix: No product-code change; changing only the fixture's tool selection would bypass the real staged-agent contract. A companion/runtime change is needed before this exclusion check can be accepted.
verification: Explicit short grant passed on a real detached child with exact provider schema and server `tools/call`/echo result. The unrestricted long control and restricted short control both failed on real detached children with exact provider schemas and tool-not-found results; exclusion remains unverified. Permanent passing behavioral coverage for the blocked check is not feasible under the installed companion behavior.
files_changed: []
