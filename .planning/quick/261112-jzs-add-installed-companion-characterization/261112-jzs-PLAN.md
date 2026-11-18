---
phase: quick-261112-jzs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - test/integration/pi-subagents-child-launch-conformance.test.ts
  - .planning/debug/artifacts/real-child-mcp-automation/README.md
autonomous: true
requirements:
  - PG-MCP-02
estimate:
  tokens: 18000
  raw_tokens: 18000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - The normal integration suite calls installed pi-subagents production launch code and passes while the two known ambient MCP suppression cases persist.
    - The same assertions fail when the real upstream patch clears the child environment for unrestricted and exclusion-only launches.
    - Explicit MCP grants, explicit tool restrictions, and capability ceilings have independent passing controls.
    - The positive detached-child acceptance runner remains available and must pass against a fixed companion before the known-gap assertions change.
    - Passing characterization tests do not close PG-MCP-02 acceptance or change the installed companion version.
  artifacts:
    - path: test/integration/pi-subagents-child-launch-conformance.test.ts
      provides: Installed-companion characterization and restriction controls in the existing integration suite
    - path: .planning/debug/artifacts/real-child-mcp-automation/README.md
      provides: Upstream PR, focused test command, patch-sensitivity evidence, and positive acceptance instructions
  key_links:
    - from: test/integration/pi-subagents-child-launch-conformance.test.ts
      to: test/integration/optional-peer.ts
      via: findCachedPeer and importPeerModule load the installed companion
    - from: test/integration/pi-subagents-child-launch-conformance.test.ts
      to: node_modules/.cache/optional-peers/node_modules/pi-subagents/src/runs/shared/child-launch.js
      via: buildInProcessChildLaunch with host runner
    - from: package.json
      to: test/integration/pi-subagents-child-launch-conformance.test.ts
      via: Existing test:integration glob, included in npm run check and CI
    - from: .planning/debug/artifacts/real-child-mcp-automation/README.md
      to: .planning/debug/artifacts/real-child-mcp-automation/run.mjs
      via: PG_COMPANION_INDEX selects the fixed companion for positive acceptance
---

<objective>
Make the installed pi-subagents ambient MCP defect visible in normal CI. The tests deliberately assert the current defect and turn red when the companion fixes it. Keep the positive acceptance checks for confirming the fix before changing those assertions.

Purpose: Detect dependency behavior changes without treating the current defect as intended behavior or closing PG-MCP-02. Preserve the suite version per D-PG1-02 and the separate live-child acceptance path per D-PG1-03.
Output: One focused integration test module and a surgical update to the existing reproduction README. The upstream fix is already proposed in https://github.com/nicobailon/pi-subagents/pull/3259.
</objective>

<execution_context>
@.codex/gsd-core/workflows/execute-plan.md
@.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@.planning/phases/01-companion-floors-and-mcp-defaults/01-CONTEXT.md
@.planning/debug/artifacts/real-child-mcp-automation/README.md
@.planning/debug/artifacts/real-child-mcp-automation/run.mjs
@test/integration/agents-adapter-grant-conformance.test.ts
@test/integration/optional-peer.ts
@test/platform/hermetic-environment.ts
@.agents/skills/local-verification/SKILL.md
@.agents/skills/typescript-unit-tests/SKILL.md
@.agents/skills/typescript-style/SKILL.md

The user authorized tests of the installed companion, with green assertions for its known defect and separate positive acceptance for the fix. No workaround, dependency upgrade, or production behavior change is in scope. Existing long-name grant characterization remains a separate defect and stays unchanged.

Discovery level 0: the repository already imports compiled optional-peer modules by file URL. No dependency or external service is added. CodeGraph supplied the existing peer loader, grant-conformance test, hermetic environment, and saved runner. The installed launch export and its declared input were read directly because the peer cache is outside the code index.

The actual installed module exports buildInProcessChildLaunch. Its input includes host, cwd, childAgentName, childIndex, sessionEnabled, inheritProjectContext, inheritGlobalContext, inheritSkills, tools, excludeTools, mcpDirectTools, requiredExtensions, and capabilityCeiling. Use host "runner", childIndex 0, false for session/context/skill flags, and requiredExtensions [] to avoid ambient extension-registration state. The relevant output is session.tools, session.excludeTools, session.ambientExtensions, and session.processEnv.MCP_DIRECT_TOOLS.

Measured against installed 0.88.0: unrestricted and exclusion-only launches have no session.tools, keep ambientExtensions true, and write MCP_DIRECT_TOOLS="__none__". An exclusion-only launch also preserves its exact excludeTools list. Explicit tools ["read"], tools [], and a ceiling allowing only read also write "__none__". A configured short grant plugin_demo_stub_/echo writes that selector and supplies session.tools ["mcp__plugin_demo_stub__echo"].

The built child-launch.js at companion commit 1e79b864159430cc124783a7d7c9e4e5daa2a7bf differs from the installed module by only the two-line ambient branch. It assigns an owned environment key with value undefined when tools is undefined and there is no ceiling. The companion's applyProcessEnv deletes keys with undefined values. The saved runner already proves positive behavior with real detached children from that build.

A planning probe ran the existing grant-conformance module successfully on Node v26.13.0. Every new automated command uses the same root-relative isolated-home preload. The new test path is created by Task 1. The existing integration glob discovers it without package.json or CI edits. This task changes no user-visible command behavior, so it adds no cucumber scenario.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Characterize the installed unrestricted child launch</name>
  <files>test/integration/pi-subagents-child-launch-conformance.test.ts</files>
  <read_first>Read the installed companion's src/runs/shared/child-launch.js and child-launch.d.ts, the existing optional-peer loader, and agents-adapter-grant-conformance.test.ts. Follow the TypeScript case, boundary, comment, and title rules.</read_first>
  <action>
Create one node:test integration module that imports the real installed buildInProcessChildLaunch through findCachedPeer("pi-subagents") and importPeerModule. Define only the narrow local TypeScript input/output interfaces needed to call that export. Report the installed version with t.diagnostic, using the peer loader's normal fail-loud behavior when the cache is missing or wrong. Keep package ranges, suite versions, and loaders unchanged per D-PG1-02.

Add one independently named test for the known upstream gap: a runner child with no tools, no MCP selectors, and no ceiling suppresses ambient adapter tools. Use a fresh createHermeticEnvironment or withHermeticEnvironment for the case. Call the production export, then deep-compare its relevant session contract: tools and excludeTools are undefined, ambientExtensions is true, the processEnv object owns MCP_DIRECT_TOOLS, and that key equals "__none__". Preserve undefined values in the assertion rather than serializing them away. This is a launch-contract test; do not claim it proves an actual tool call.

Use a plain behavior title that explicitly says this is a known upstream gap. Put https://github.com/nicobailon/pi-subagents/pull/3259 in the assertion message and a concise rationale comment. The failure message must tell the maintainer to run the positive acceptance instructions in the saved README before changing the expected value. Use no version-based skip, alternate accepted behavior, copied companion implementation, or source-text assertion. The test must execute the companion export.
  </action>
  <verify>
    <automated>node --import ./test/platform/isolated-pi-home.ts --test test/integration/pi-subagents-child-launch-conformance.test.ts</automated>
  </verify>
  <done>The installed 0.88.0 launch export runs in a hermetic case and the known-gap test passes with an exact "__none__" assertion. The normal integration glob reaches the new file.</done>
</task>

<task type="auto">
  <name>Task 2: Cover exclusion-only children and restriction controls</name>
  <files>test/integration/pi-subagents-child-launch-conformance.test.ts</files>
  <action>
Add a second independently named known-gap test for an exclusion-only child. Leave tools and MCP selectors absent. Set excludeTools to the existing positive fixture's exact long adapter name, mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c. Assert the same suppression contract as Task 1 and the complete preserved exclusion list. Keep that exclusion identity intact per D-PG1-10. The test title and assertion message must make clear that suppression of every adapter tool is the known upstream defect, not successful selective exclusion.

Add independent positive controls for: an explicit short MCP grant, tools ["read"], tools [], and a capability ceiling with version 1, allowedTools ["read"], denyExtensions false, and sources ["test"]. Assert exact session.tools and MCP_DIRECT_TOOLS values for each. The explicit restrictions and ceiling remain "__none__". The short grant must be plugin_demo_stub_/echo with the exact offered tool mcp__plugin_demo_stub__echo. Build the grant's mcp-adapter.json and fresh mcp-cache.json in that case's isolated Pi home, following the existing grant-conformance test and the installed resolver's computeMcpServerHash. Use literal expected selector and tool names, not values returned by the implementation under test. A dummy local server definition and cache are sufficient; launch construction does not start a server.

Keep each case independent and clean up every temporary directory and changed environment value. Use stateless file-local helpers only where they remove repeated setup. Do not broaden the shared peer loader, production converters, existing long-name grant test, saved real-child harness, or cucumber files. These controls must stay green with both the current and fixed companion.
  </action>
  <verify>
    <automated>node --import ./test/platform/isolated-pi-home.ts --test test/integration/pi-subagents-child-launch-conformance.test.ts test/integration/agents-adapter-grant-conformance.test.ts</automated>
  </verify>
  <done>Six independent new cases pass: two explicitly identified known-gap cases and four restriction/grant controls. The existing separate long-grant characterization still passes.</done>
</task>

<task type="auto">
  <name>Task 3: Prove patch sensitivity and record the acceptance procedure</name>
  <files>.planning/debug/artifacts/real-child-mcp-automation/README.md</files>
  <action>
Use the already-built companion checkout identified in the README, containing source fix commit 1e79b864159430cc124783a7d7c9e4e5daa2a7bf. Later documentation-only commits are compatible with this proof. Set PG_FIXED_COMPANION_ROOT to that verified checkout root for these checks. Confirm its dist-pkg/src/runs/shared/child-launch.js still differs from the installed compiled module only by the ambient-clearing branch. This uses the actual upstream patch, not a handwritten replacement implementation.

Prove the new sentinel detects that patch without adopting a dependency change. Run the focused new module against the unchanged installed peer and save its passing result. With no other suite using that cache, save the exact installed child-launch.js bytes and hash, temporarily substitute the real fixed compiled module, and run the focused test in a fresh Node process. Use a single cleanup-protected driver with a finally block that restores the original bytes even if a child process fails. Assert that the patched run exits with a test failure and that exactly the two named known-gap assertions fail because the actual MCP_DIRECT_TOOLS value is undefined. Require all four controls to pass. An import error, missing fixture, timeout, or unrelated assertion failure is not evidence. After restoration, compare the original hash and rerun the focused module to prove it is green again. Save concise results in the quick-task summary; keep transient drivers and logs outside the tracked test suite.

Run the unchanged positive runner against the complete fixed build using PG_COMPANION_INDEX="$PG_FIXED_COMPANION_ROOT/dist-pkg/index.js" node .planning/debug/artifacts/real-child-mcp-automation/run.mjs. Preserve all existing positive assertions: the explicit short grant calls its tool, the unrestricted child receives and calls the long tool, and the exclusion-only child lacks that long tool while receiving and calling the allowed short tool. All three children must complete. This remains the separate live-child check per D-PG1-03. It is already automated with local stand-ins and needs no account or external network.

Update only the existing README's provenance/status paragraph and add a short section on the CI characterization and upgrade procedure. Link upstream PR 3259, correct the now-stale statement that no branch was pushed, and record the focused command, the installed-green/patched-red/restored-green outcome, and the fixed-build positive command. Explain that an upgrade-triggered sentinel failure calls for positive acceptance before changing the characterization to the corrected expectation. A passing known-gap test does not prove selective exclusion works in installed 0.88.0 and does not close PG-MCP-02. Retain existing patch hashes, runner hashes, historical logs, and unrelated failure disclosures. Do not mark the phase complete.

Follow committing and local-verification scheduling: run focused tests while editing and the normal fixers/hooks for commits. The orchestrator runs npm run check once on the final combined tree after this task. The previous ce06beb3 full check cannot cover the new executable test. Include a Threat Flags section in the quick summary.
  </action>
  <verify>
    <automated>node --import ./test/platform/isolated-pi-home.ts --test test/integration/pi-subagents-child-launch-conformance.test.ts test/integration/agents-adapter-grant-conformance.test.ts</automated>
  </verify>
  <done>The real patch makes only the two known-gap assertions fail, the restored installed module passes, all three positive fixed-companion child checks pass, and the README links the PR and tells maintainers how to confirm a fix before changing expectations.</done>
</task>

</tasks>

<threat_model>
## Trust boundaries

| Boundary | Description |
| --- | --- |
| Test to companion environment/filesystem | The imported companion reads Pi configuration and builds a runner launch. |
| Temporary mutation to installed peer cache | The patch-sensitivity check temporarily replaces one compiled module. |
| Positive runner to local child processes | The saved runner starts isolated Pi children and loopback stand-ins. |

## STRIDE threat register

| Threat ID | Category | Component | Severity | Disposition | Mitigation plan |
| --- | --- | --- | --- | --- | --- |
| T-261112-jzs-01 | Tampering | Companion configuration and process environment | medium | mitigate | Use the isolated-home preload and a fresh hermetic environment per case; restore all modified variables and remove the case directory. |
| T-261112-jzs-02 | Tampering | Optional-peer cache during patch proof | medium | mitigate | Save exact bytes, restore in finally, compare hashes, use fresh test processes, and rerun the restored peer. Serialize this check with all other peer consumers. |
| T-261112-jzs-03 | Denial of service | Positive detached-child replay | low | mitigate | Reuse the existing bounded child driver and its owned local stand-ins; record child completion and cleanup results. |
| T-261112-jzs-SC | Tampering | Package inputs | high | mitigate | Use the existing cached peer and the verified fixed build. This plan performs no package installation or dependency change. |
</threat_model>

<verification>
- The focused new module passes against installed pi-subagents 0.88.0 with six cases and no skips.
- The actual patched compiled module fails exactly the two known-gap cases; four controls remain green.
- The cache is restored byte-for-byte and the focused tests pass again.
- The existing positive runner passes all three detached children against the fixed build.
- The orchestrator runs npm run check on the final combined tree, including the new module through test:integration, before reporting completion.
</verification>

<source_audit>
| Source | ID | In-scope obligation | Coverage |
| --- | --- | --- | --- |
| GOAL | Quick request | Put the current installed-companion defect under normal CI and detect its upstream fix | Tasks 1–3 |
| REQ | PG-MCP-02 | Expose the companion obstacle to real selective exclusion without falsely closing acceptance | Tasks 1–3; positive acceptance retained |
| RESEARCH | Saved companion diagnosis | Production child-launch environment sets __none__; the real fix writes an owned undefined value | Tasks 1 and 3 |
| RESEARCH | Existing integration patterns | Import actual optional-peer modules; use hermetic state and exact assertions | Tasks 1–2 |
| CONTEXT | D-PG1-02 | Suite continues to run installed 0.88.0 | Tasks 1 and 3 |
| CONTEXT | D-PG1-03 | Retain live real-child acceptance evidence separately | Task 3 |
| CONTEXT | D-PG1-10 | Preserve the exact adapter exclusion name | Task 2 |
| CONTEXT | User instruction | No workaround, dependency upgrade, production expansion, version skip, or acceptance of both behaviors | Tasks 1–3 |

Other Phase 1 requirements and decisions remain in their existing phase plans. This quick task does not replace or close them. No deferred idea is implemented.
</source_audit>

<success_criteria>
The repository has a fast, installed-companion sentinel that passes on the current defect, demonstrably fails on the real fix, and points to independently passing positive acceptance. Only the focused integration test and the existing reproduction README change. Required final verification remains with the orchestrator.
</success_criteria>

<output>
Create .planning/quick/261112-jzs-add-installed-companion-characterization/261112-jzs-SUMMARY.md with focused results, patch identity, cache restoration evidence, positive child results, commit-hook results, and the required Threat Flags section. Leave the final combined-tree npm run check to the orchestrator and keep phase acceptance open.
</output>
