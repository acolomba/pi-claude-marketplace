---
phase: 03-claude-code-tool-names-and-tool-search
verified: 2026-10-06T21:00:00Z
status: passed
score: 5/7 must-haves verified
covered_files:
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-01-PLAN.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-01-SUMMARY.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-02-PLAN.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-02-SUMMARY.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-03-PLAN.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-03-SUMMARY.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-04-PLAN.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-04-SUMMARY.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-05-PLAN.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-05-SUMMARY.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-06-PLAN.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-06-SUMMARY.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-07-PLAN.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-07-SUMMARY.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-08-PLAN.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-08-SUMMARY.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-09-PLAN.md
  - .planning/phases/03-claude-code-tool-names-and-tool-search/03-09-SUMMARY.md
  - docs/mcp-compatibility.md
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - extensions/pi-claude-marketplace/domain/name.ts
covered_digest: "v3:sha256:419727aea0923bb98aebb8a5f7ed47b723d439637aed8e0ea62373490c88d173"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "A real Pi 1.0 + pi-mcp-adapter 5.0.0 loads the entries this extension writes, and the model reaches the tools through search under the Claude names"
    addressed_in: "Phase 7"
    evidence: "Phase 7 success criterion 2 (ADOC-02): 'A live UAT in a sandboxed agent directory shows adapter 5 loading our entries ... finding plugin tools through tool search'. 03-VALIDATION.md lists it as manual-only."
human_verification:
  - test: "Decide WR-03: make the same-plugin key clash refuse before the ledger runs, or amend the wording"
    expected: "Either (a) a pre-check before `transaction.runPhases` makes a plugin with a skill plus two colliding servers refuse before the skill directory is ever created, or (b) ROADMAP SC3, D-03-12 and `docs/mcp-compatibility.md:27` say 'refuses and leaves nothing behind' instead of 'before it writes anything'"
    why_human: "The refusal happens in the fifth ledger phase (`mcpPhase`) after skills, commands, agents and hooks have committed; the ledger then rolls them back. D-03-12 says 'same handling as a cross-plugin collision (D-02-03)', which also refuses in the mcp phase, so this is a project-semantics call, not a mechanical check"
  - test: "Decide WR-02: write `auth: \"oauth\"` for a remote server that carries `oauth` (and `headers`), or record the divergence"
    expected: "Either the translator derives `auth: \"oauth\"` from Claude's `oauth` object so OAuth stays active with `headers`, or a recorded decision or a documented Pi capability gap licenses the divergence"
    why_human: "pi-mcp-adapter's `supportsOAuth` returns false when `headers` is non-empty and `auth` is unset (mcp-auth-flow.ts:1263-1264). Observed in a spot check: `{type:'sse', headers, oauth:{callbackPort}}` translates to an entry with `headers` and `oauth` but no `auth`. Claude Code keeps OAuth on such a server. AGENTS.md says a divergence needs a recorded decision or a Pi capability gap, and neither exists for this case"
  - test: "Decide WR-01: fix the TR-03 accounting for a server present in both `mcp-adapter.json` and legacy `mcp.json`"
    expected: "After a failed legacy-file write on uninstall, `dropped.mcpServers` omits a declared name that `mcp.json` still serves, and the install record keeps it"
    why_human: "Reproduced by code reading: the `stillOwned` filter in `bridges/mcp/unstage.ts:166-176` compares raw file keys, but the adapter file now holds `plugin_<p>_<s>_` and the legacy file holds `<s>`, so it never matches. The path needs a double state (legacy plus adapter entry) and a failed second write. Decide whether to fix now or carry to Phase 5 with a recorded reason"
  - test: "Run `npx fallow audit --base $(git merge-base origin/main HEAD)` before opening the PR"
    expected: "Verdict `pass`. I re-ran it: verdict is `warn` with 14 clone groups, including the `plugin-info.ts` fixtures (WR-05). The Lint workflow fails a pull request on `warn`"
    why_human: "Not a Phase 3 goal failure (the clone groups come from an earlier ADET-01 commit on this branch), but it will fail CI on the PR. Decide whether to fix the fixture duplication in this phase or in a ship-prep task"
---

# Phase 3: Claude Code tool names and tool search Verification Report

**Phase Goal:** A plugin's MCP tools reach the model under the exact names Claude Code gives them, load on demand through Pi's tool search, and carry the manifest's description and transport options into the adapter entry.
**Verified:** 2026-10-06T21:00:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

## Goal Achievement

The goal holds in the code and in the tests. No must-have truth is FAILED and no blocker anti-pattern exists. Two roadmap sub-claims cannot be marked VERIFIED without a developer decision (WR-03 and WR-02 below), so the status is `human_needed` and not `passed`.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: tools reach the model as `mcp__plugin_<plugin>_<server>__<tool>`; key `plugin_<plugin>_<server>_`, every code unit outside `[A-Za-z0-9_-]` becomes `_`; entry pins `toolPrefix: "mcp"`; one name builder in `domain/` | VERIFIED | `domain/name.ts:248` `generatedMcpServerKey`. Spot check: `("acme","a😀b")` gives `plugin_acme_a__b_`, `("my-tools","db.x y")` gives `plugin_my-tools_db_x_y_`, `("acme","")` gives `plugin_acme__`. `translateMcpServer` always writes `toolPrefix: "mcp"`, and a plugin-declared `toolPrefix` is dropped (spot check). `grep` finds the normalization regex nowhere else under `extensions/`. Live evidence: research runs A, B, D on Pi 1.0.0 + adapter 5.0.0 (03-RESEARCH.md "Measurement record") sent exactly `mcp__plugin_measure-plugin_fixture__echo` for that key shape |
| 2 | SC2: hook matcher, `if:` predicate or agent `tools:` entry naming the plugin's own MCP tools in Claude form matches the delivered tools | VERIFIED | `matcher.ts:28-39` parses `mcp__<segment>__.*` by string operations only (no RegExp); `dispatch.ts:109-121` fires on `toolName.startsWith(prefix)`. `convert.ts:225-293` maps `mcp__plugin_<p>_<s>__<tool>` to `mcp:plugin_<p>_<s>_/<tool>`, only for servers this install writes. 435 tests across name, features, matcher, adapter-entry, stage, convert and resolution all pass (my run) |
| 3a | SC3: install refuses with a clear reason when two servers' normalized keys collide, including `-`/`_` folding; no length check exists | VERIFIED | `stage.ts:227-249` `keyedServers` throws `McpServerKeyCollisionError` naming plugin, both servers and both keys, comparing `foldedMcpServerKey` (`name.ts:261`, the only fold). Cross-plugin, marker-less and nine-source folded clashes go through the same fold (`stage.ts:100-118`). No length check in `domain/` or `bridges/mcp/` (grep). `ANAME-03` test in `install-outcome.test.ts` passes. Measurement recorded in 03-RESEARCH.md and `docs/mcp-compatibility.md` (OpenAI 64, Anthropic 128) |
| 3b | SC3 wording: the refusal happens "before any write" | UNCERTAIN (WR-03) | The same-plugin check runs in `prepareStageMcpServers`, called from `mcpPhase.do` (`install-outcome.ts:964`), phase 5 of `[skills, commands, agents, hooks, mcp, workflows, state]` (`install-outcome.ts:1210-1218`). Skills, commands, agents and hooks have committed by then, and the ledger rolls them back. End state is clean when rollback works. The test at `install-outcome.test.ts:1590` seeds MCP servers only, so it cannot detect an earlier write. D-03-12 ties this to D-02-03's "today's bridge semantics", which has the same timing. Needs a decision: pre-check or reword |
| 4 | SC4: entries carry `directTools: "search"`; `alwaysLoad` gives `directTools: true`; `lifecycle` unset; divergence documented | VERIFIED | Spot check: `alwaysLoad: true` gives `directTools: true`, otherwise `"search"`; `lifecycle`, `auth` and plugin `directTools` never reach the entry. `CARRIED_FIELDS` keeps a user's own `lifecycle`. Live run B: search-mode tools absent from request 0, present after `mcp({search})`. Docs (`mcp-compatibility.md:35-47, 66-72, 157-158`) state that Pi's own `tool_search` is off by default and the model finds tools through the adapter's `mcp` tool. This is wording drift from "Pi's tool search" in ROADMAP SC4 and ANAME-04, documented as a Pi capability gap; the on-demand behavior holds |
| 5a | SC5: each entry carries the manifest `description`; `sse` becomes `httpTransport`; timeout and OAuth callback port translated; unhonored features make the plugin partially available with `{unsupported mcp}` | VERIFIED | Spot check: `{type:"sse", timeout:5000, oauth:{callbackPort:8080}}` gives `httpTransport:"sse"`, `requestTimeoutMs:5000`, `oauth.redirectUri:"http://localhost:8080/callback"`, `description` from the argument. `classifyMcpServer` returns `blocked` for `ws`, `oauth.xaa` and the other table features, and `malformed` for an empty `command`, `timeout: 0` or a `url` with no `type`. `role` and `discoveryCache` never block. install-flow `ANAME-0*/AFILE-0*` 29/29, update-flow 3/3, install-outcome 3/3 pass |
| 5b | ANAME-07: OAuth on a remote server that also declares `headers` stays active in the adapter | UNCERTAIN (WR-02) | The entry holds `headers` and `oauth` but no `auth`. Adapter 5.0.0 `supportsOAuth` (`mcp-auth-flow.ts:1263-1264`) returns false for non-empty `headers` with `auth` unset, so the sign-in never starts. Confirmed in the installed adapter source and in my spot check. The `oauth` fields are translated (as ANAME-07 literally requires) but are inert in this combination. No recorded decision licenses the gap |

**Score:** 5/7 truths verified (2 uncertain, each routed to a developer decision; 0 failed)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | A live Pi 1.0 + adapter 5.0.0 run that loads the entries this extension itself writes, and reaches the tools through search | Phase 7 | ADOC-02, Phase 7 SC2: "adapter 5 loading our entries ... finding plugin tools through tool search". Research runs A-E used a hand-written entry of the same shape (key, `toolPrefix`, `directTools`, `description`, marker with `pluginSetFields` and `keptOverride`), not the production output |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `domain/name.ts` | `generatedMcpServerKey`, `foldedMcpServerKey`, `mcpServerDisplayName` | VERIFIED | Exists, substantive, imported by `stage.ts`, `convert.ts`, `shared.ts`, `info.ts` |
| `domain/mcp-server-features.ts` | closed `translateMcpServer` and `classifyMcpServer` | VERIFIED | 357 lines, used by `adapter-entry.ts` and `mcp-resolution.ts`; behavior spot-checked |
| `bridges/mcp/adapter-entry.ts` | stamp, carry-forward, plugin-set fields | VERIFIED | `stampServers` is called from `stage.ts`; marker carries `pluginSetFields` |
| `bridges/mcp/stage.ts` | keyed servers, folded collision walk | VERIFIED | Wired into `mcpPhase`; see WR-03 for timing |
| `bridges/mcp/marker.ts` | `pluginSetFields` read and write | VERIFIED | Tolerant parse; covered by `marker.test.ts` |
| `domain/components/hooks/matcher.ts`, `bridges/hooks/dispatch.ts` | server-prefix matcher | VERIFIED | `toolPrefixes` consumed in dispatch |
| `bridges/agents/convert.ts` | Claude to `mcp:` mapping | VERIFIED | Wired through `install-outcome.ts` written server names |
| `orchestrators/plugin/info.ts` | `plugin:<p>:<s>` display, left-out servers | VERIFIED | Uses `mcpServerDisplayName`; see IN-04 |
| `docs/mcp-compatibility.md`, `README.md`, `docs/hooks-compatibility.md` | naming, search, length, lifecycle, divergences | VERIFIED | Contents grepped; docs cite ANAME IDs, not D-03 IDs |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `install-outcome.ts` mcpPhase | `prepareStageMcpServers` | `servers: c.resolved.mcpServers` (supported servers only) | WIRED | line 964-975 |
| `adapter-entry.ts` | `translateMcpServer` | `translatedEntry` | WIRED | |
| `plugin-resolver` / `mcp-resolution.ts` | `classifyMcpServer` | `droppedMcpServers`, `{unsupported mcp}` | WIRED | `mcp-resolution.ts:54-56` |
| `shared.ts` cascade unstage | `generatedMcpServerKey` | `droppedMcpServers` mapping | WIRED, one defect | WR-01 |
| `dispatch.ts` | `matcher.toolPrefixes` | `startsWith` | WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `mcp-adapter.json` entry | translated fields | resolver `mcpServers` from the plugin manifest, through `substituteAndInject`, then `translateMcpServer` | Yes (e2e install tests assert the file bytes) | FLOWING |
| entry `description` | `c.resolved.description` | `plugin.json`, falling back to the marketplace entry | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Key builder, astral and empty names | node script importing `domain/name.ts` | `plugin_acme_a__b_`, `plugin_acme__` | PASS |
| Closed translation | node script importing `translateMcpServer` with hostile keys | `auth`, `lifecycle`, plugin `toolPrefix`, `clientSecret` dropped; `directTools:true` for `alwaysLoad` | PASS |
| Classifier | node script, 7 inputs | blocked/malformed/supported as specified | PASS |
| Name, features, matcher, entry, stage, convert, resolution tests | `node --test` on 7 files | 435 pass, 0 fail | PASS |
| install-flow, install-outcome, update-flow `ANAME`/`AFILE` tests | name-filtered `node --test` | 29, 3, 3 pass | PASS |
| info and catalog-contract tests | `node --test` on 2 files | 199 pass, 0 fail | PASS |
| Whole gate | evidence from the session: `npm run check` on d6029660, exit 0 | not re-run | PASS (carried) |

### Probe Execution

Step 7c: SKIPPED. No phase-declared probes and no `scripts/*/tests/probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| ANAME-01 | 03-01, 03-06 | Claude names via key + pinned `toolPrefix` | SATISFIED | Truth 1; `info` shows `plugin:<p>:<s>` |
| ANAME-02 | 03-02, 03-07 | Hook matchers and agent `tools:` match delivered tools | SATISFIED | Truth 2. WR-04 is a user-facing doc inaccuracy about a pi-subagents capability gap, not a failure of the mapping |
| ANAME-03 | 03-04, 03-05, 03-09 | Normalized-key collisions refused; length measured | SATISFIED, wording caveat | Truths 3a, 3b (WR-03) |
| ANAME-04 | 03-01, 03-03, 03-09 | `directTools: "search"` / `true` | SATISFIED | Truth 4 |
| ANAME-05 | 03-03, 03-09 | `lifecycle` unset, divergence documented | SATISFIED | Truth 4; `mcp-compatibility.md` |
| ANAME-06 | 03-03 | manifest `description` written | SATISFIED | Truth 5a |
| ANAME-07 | 03-03, 03-04, 03-06, 03-08 | transport translation; `{unsupported mcp}` partial | SATISFIED, one sub-case open | Truths 5a, 5b (WR-02) |

All seven IDs appear in plan frontmatter and in REQUIREMENTS.md (marked Complete, mapped to Phase 3). No orphaned requirement: REQUIREMENTS.md maps no other ID to Phase 3.

### Anti-Patterns Found

None blocking. `TBD|FIXME|XXX` and `TODO|HACK|PLACEHOLDER` find nothing in the 29 extension, docs and README files changed since 93a83942.

### Review Findings, Weighed

| Finding | Defeats a must-have or the goal? | Judgment |
| ------- | -------------------------------- | -------- |
| WR-01 TR-03 with legacy `mcp.json` entry | No. The partial-unstage truth holds literally, but its TR-03 intent fails in the overlap case | Real regression on a double-failure path in a transitional state. Fix is small and the review gives it. Decision item 3 |
| WR-02 OAuth with `headers` | Not the goal. It narrows ANAME-07's effective result for one field combination | Confirmed against adapter source. Needs a recorded decision or a fix. Decision item 2 |
| WR-03 "before any write" | Not the observable outcome, but the literal SC3 and doc wording are untrue for a plugin with other components | Decision item 1 |
| WR-04 per-tool `mcp:` entry fails the whole launch on a raw-name mismatch | No. The mapping is correct. The doc understates a pi-subagents capability gap | Doc and warning fix. Not a gate. Recommended before release |
| WR-05 fallow audit `warn` | No. Ship gate, not goal. Confirmed `warn` with 14 groups on a fresh run | Decision item 4 |
| IN-01 to IN-05 | No | Open, low impact. IN-01 (exemption skips the walk for a renamed key) is a small hole in ANAME-03 coverage worth fixing with WR-03 |

### Human Verification Required

See the `human_verification` list in the frontmatter. These are developer decisions, not manual test steps. Items 1 to 3 each have a concrete fix; items 1 and 2 can also close by recorded decision or rewording.

### Gaps Summary

No gaps block the phase goal. A plugin's MCP tools get the Claude Code key and pinned prefix, load on demand through search, and carry description, transport and timeout options. Hooks and agents reach the delivered names. Colliding keys refuse with a clear reason and no residue. The residual risks are two unlicensed or imprecise statements (WR-03 timing, WR-02 OAuth with headers), one narrow TR-03 regression (WR-01), and a CI-only fallow `warn` (WR-05). The live-adapter proof of the production entry shape is carried by Phase 7 ADOC-02.

---

_Verified: 2026-10-06T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
