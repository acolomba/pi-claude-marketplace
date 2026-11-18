---
status: resolved
trigger: "right, do try to automate these tests before interrupting"
created: 2026-11-12
updated: 2026-11-16
---

## Current Focus

hypothesis: Confirmed locally: clearing MCP_DIRECT_TOOLS for ambient child plans restores adapter direct tool registration, and Pi's excludeTools removes only the named long tool.
test: The agent-authored regression fails before the patch, passes after it, fails again on revert, and passes on reapply; exact provider inventories and MCP calls pass on real detached children built from the local companion commit.
expecting: The patch can be reviewed and incorporated upstream or installed locally; published pinned 0.88.0 still fails this acceptance check.
next_action: None. Resolved 2026-11-16: the published pi-subagents 0.88.1 carries the fix, the real-child run of `.planning/phases/01-companion-floors-and-mcp-defaults/01-UAT.md` (tests 1 and 2, 2026-11-13) passes on it, and SEED-261112-81c is completed.

reasoning_checkpoint:
  hypothesis: "The companion's fallback writes MCP_DIRECT_TOOLS=__none__ for ambient children, causing the adapter to register zero direct tools despite directTools:true."
  confirming_evidence:
    - "Actual unrestricted and restricted detached provider requests both omitted short and long direct names; an explicit-grant child received and called the short name."
    - "Installed 0.88.0 and current upstream childProcessEnv both set __none__ in the no-selector fallback; adapter resolveCurrentDirectTools returns [] for that value."
    - "An agent-authored unit regression fails before the fix: ambient actual __none__, expected undefined."
  falsification_test: "If clearing MCP_DIRECT_TOOLS for only ambient children leaves the unrestricted detached child without both direct names, the hypothesis is incomplete or wrong."
  fix_rationale: "Clear the inherited adapter selector override for ambient children so adapter config selects direct tools; keep explicit tool lists and ceilings on the existing suppressing path, and let Pi apply excludeTools."
  blind_spots: "The locally patched package has not been distributed or verified in the user's eventual installed environment; published pinned 0.88.0 is unchanged."
  candidate_causes:
    - "code: companion childProcessEnv writes __none__ for ambient children"
    - "config: adapter directTools may be disabled or stale in child"
  and_gate: "Yes for the visible symptom: companion suppression acts when adapter directTools is enabled; adapter configuration alone is not the defect, as the parent and explicit-grant child both registered direct tools."

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
- The user has now explicitly approved a companion regression, fix, and real detached-child retest. The earlier no-companion-change direction is superseded; this session continues through a reviewable companion artifact.
- Companion checkout `/tmp/pi-subagents-mcp-fix` is on `features/ambient-mcp-direct-tools` at upstream `7e2794efba0b727af51d08c36614ea939f1a827b`; installed 0.88.0 tag is `c84d4a817db9e6e49179ec202ba6c619322eb767`. The `childProcessEnv` fallback is identical at both revisions. Companion AGENTS.md and VISION.md were read.
- An agent-authored unit regression in `test/unit/child-tool-plan.test.ts` failed before the source edit: `ambient.session.processEnv?.MCP_DIRECT_TOOLS` was `__none__`, expected `undefined`. `applyProcessEnv` deletes keys assigned undefined before loading child extensions, so the regression checks the actual adapter boundary.
- The minimal companion source change sets `MCP_DIRECT_TOOLS` to undefined only when `input.tools` is undefined and there is no capability ceiling or MCP selection. The previously red 25-test owner module is now green. `npm run typecheck` and `npm run build:pkg` exited 0 on the current branch.
- Fixed local package (`/tmp/pi-subagents-mcp-fix/dist-pkg/index.js`) passed the real detached-child driver with exit 0. Runner PID 3513455 offered only short and called it. Unrestricted control PID 3513499 offered both exact short and hash-suffixed long direct names on all three provider requests, then called long. Restricted PID 3513538 offered short and omitted long on all three provider requests, then called short. The MCP stub log has one `tools/call` for each matching text; all three child statuses are complete. Driver log: `/tmp/pg1-live-fixed-local/drive-fixed-all.out`. This proves the local build, not published pinned 0.88.0.
- A sequential full `npm run test:unit` run with loopback permission finished 4,416 passed, 3 failed, 16 skipped. The exact failures were package-agent precedence and disable in `agent-eject-disable.test.ts` (expected `package`, got `builtin`/`undefined`) and linked-worktree root in `agent-memory.test.ts` (expected null, got `/tmp`).
- Reverting only the companion source hunk made the new ambient regression fail again with `__none__` versus undefined. On that reverted source, the exact same three broad-unit assertions failed in standalone baseline modules. Reapplying the hunk restored 25/25 owner-module passes. These failures predate the patch under this checkout/environment.
- The adjacent async integration module exceeded a 120-second bound after its three MCP cases passed. The focused command `timeout 60s node --experimental-strip-types --import ./test/support/register-loader.mjs --test-name-pattern 'with Pi.*MCP|selected tools|extension-registered servers|project.*mcp.json' test/integration/async-execution.part-1.test.ts` exited 0 with 3/3 passes.
- Companion fix and regression were committed only in isolated checkout `/tmp/pi-subagents-mcp-fix` on `features/ambient-mcp-direct-tools`: `1e79b864159430cc124783a7d7c9e4e5daa2a7bf`, based on `7e2794efba0b727af51d08c36614ea939f1a827b`. No push or package publication occurred.
- Durable workspace artifact `.planning/debug/artifacts/real-child-mcp-automation/` contains `companion.patch.gz` (SHA-256 `f695741ccfaaf0a7c4da04a7c3b1e98182204b549b5fca68ed644cd1ea117358`; uncompressed patch SHA-256 `cfffdf01ad77fcb0a9a42e6a59d57cbd36c900f7cfa77fd600546577a6e258e1`), a self-contained `run.mjs` and fixture, the exact fixed and installed-package live logs, test logs, and replay instructions. The runner passed all three children from a fresh fixture `/tmp/pg1-live-companion-sLPPSp` against the locally built package.

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
fix: In companion commit `1e79b864159430cc124783a7d7c9e4e5daa2a7bf`, clear the child adapter override for ambient plans and retain explicit-list and capability-ceiling suppression. Agent-authored regression is in `test/unit/child-tool-plan.test.ts`. Workspace patch is `.planning/debug/artifacts/real-child-mcp-automation/companion.patch.gz` (SHA-256 `f695741ccfaaf0a7c4da04a7c3b1e98182204b549b5fca68ed644cd1ea117358`).
verification:
  target_test: { result: pass, evidence: "Red before fix and on revert; green 25/25 after fix and reapply" }
  mutation_check: { result: skipped, reason_if_skipped: "Stryker is not configured in companion package", manual_fallback_revert_killed: true }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false, evidence: "One conditional branch added; no behavior deleted" }
  adjacent_tests: { result: pass, suites_run: ["companion owner module 25/25", "focused async MCP integration 3/3"], full_unit_baseline: "3 identical failures on reverted source", full_adjacent_module: "120-second timeout after relevant MCP cases passed" }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  live_fixed_build: { result: pass, evidence: "All three detached children completed; exact provider inventories and one MCP echo call each; durable logs in workspace artifact" }
  published_pinned_package: { result: pass, evidence: "Published pi-subagents 0.88.1 passes the three real detached children (01-UAT.md tests 1 and 2, 2026-11-13); SEED-261112-81c completed" }
  guardrail_verdict: accepted
oracle_type: specified (ambient Pi tool plan plus excludeTools contract)
files_changed: ["companion:src/runs/shared/child-launch.ts", "companion:test/unit/child-tool-plan.test.ts"]
