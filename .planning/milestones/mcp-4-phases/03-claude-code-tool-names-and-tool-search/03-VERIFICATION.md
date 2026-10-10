---
phase: 03-claude-code-tool-names-and-tool-search
verified: 2026-10-09T23:45:47Z
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
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
  - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - tests/bridges/mcp/adapter-entry.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/domain/mcp-resolution.test.ts
  - tests/domain/mcp-server-features.test.ts
  - tests/domain/name.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
covered_digest: "v3:sha256:36cf9b47e41302471a8bf5c850a76fd7630489006d3c8ff62ec2bebadb937b49"
re_verification: "scoped; baseline 1b1e39a3; head 3df6309c"
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

---

## Re-verification (2026-10-09)

**Scope:** scoped re-verification. Baseline `c492bbde`, head `51ebbc07`. `verification.status` read `stale` because later phases edited files in `covered_files`. The findings above stay as written. The review decisions in `human_verification` (WR-01..03 and the fallow audit) were settled by the operator and stay as they are; this pass does not reopen them. Status stays `passed`: every truth still holds as amended. The `score` line is the original one, kept unchanged (truths 3b and 5b rest on those operator decisions).

### Changed files since the baseline

| File | Commits (since `c492bbde`) | What changed |
| ---- | -------------------------- | ------------ |
| `docs/mcp-compatibility.md` | 20+ `docs(mcp)` commits, Phases 4, 5, 7 | Variable expansion, approval, migration, status, upgrade notes, grouped divergences, 5.2.0 floor |
| `bridges/mcp/adapter-entry.ts` | `0f4d7a8e` (Phase 4) | Translate first, then expand variables (AVAR-01..03); `stampServers` also returns `variableReports` |
| `bridges/mcp/stage.ts` | Phases 4 and 5 (`257483b6`, `c2291945`, `7a7d9783`, `c26007be`, ...) | Legacy `mcp.json` move and leftover removal (AMIG-01/02), variable and tool-rule notices, multi-file replace and rollback |
| `domain/mcp-server-features.ts` | Phases 4 and 5 (`00000855`, `2bbce472`) | `command ~` / `args ~` block (D-04-06); tool permission rules move from blocking to a warning (D-05-05) |

Not changed since the baseline (empty `git diff --stat`): `domain/name.ts`, `domain/components/hooks/matcher.ts`, `bridges/agents/convert.ts`, `bridges/mcp/unstage.ts`, `bridges/hooks/dispatch.ts`, `domain/mcp-resolution.ts`. Touched indirectly, so checked too: `orchestrators/plugin/info.ts` (Phase 6 status and Phase 4 variable lists) and `orchestrators/plugin/install-outcome.ts` (19-line AMIG-02 notice change in `mcpPhase`).

### Per-truth result

| # | Truth | Touched by | Result | Evidence at HEAD |
| - | ----- | ---------- | ------ | ---------------- |
| 1 | SC1 names, key `plugin_<p>_<s>_`, `toolPrefix: "mcp"`, one builder | Not touched: `name.ts` unchanged. `stage.ts` and `adapter-entry.ts` changed but still call the builder | VERIFIED | Spot check: `("acme","a😀b")` gives `plugin_acme_a__b_`, `("my-tools","db.x y")` gives `plugin_my-tools_db_x_y_`, `("acme","")` gives `plugin_acme__`. `translateMcpServer` still ends every entry with `directTools` and `toolPrefix: "mcp"`, and drops a plugin-declared `toolPrefix`. The replace regex appears only at `name.ts:251` (the other `[A-Za-z0-9_-]` hits are the matcher and `if:` segment validators and an unrelated skill-token regex). `stage.ts` imports `generatedMcpServerKey` and `foldedMcpServerKey` from `domain/name.ts`. Live: the Phase 7 canary shows `plugin_echo_echo_` with `toolPrefix "mcp"` and the tool `mcp__plugin_echo_echo__echo_canary` (07-VERIFICATION truth 2) |
| 2 | SC2 hook matcher, `if:`, agent `tools:` match delivered tools | Not touched: `matcher.ts`, `convert.ts`, `dispatch.ts` unchanged | VERIFIED | Targeted run below: matcher, dispatch and convert tests pass. The agent mapping reads the servers written by the install, whose key builder is unchanged |
| 3a | SC3 same-plugin, cross-plugin and `-`/`_`-folded key clash refused; no length check (amended by D-03-12, D-03-13, D-03-17) | `stage.ts` (touched). The `keyedServers` walk and the `foldedMcpServerKey` comparison are not in the diff | VERIFIED | The stage diff adds the legacy move, notices and rollback; it leaves the collision walk alone. Spot check: `foldedMcpServerKey("plugin_foo_my-db_") === foldedMcpServerKey("plugin_foo_my_db_")` is `true`. `stage.test.ts` collision cases and `install-outcome.test.ts` `ANAME` pass. No tool-name length check in `domain/` or `bridges/mcp/` (the only `length > 128` is the unrelated saved-workflow name gate, `name.ts:393`) |
| 3b | SC3 wording "before any write" | `stage.ts`, `install-outcome.ts` touched; ledger order not changed (`mcpPhase` is still the fifth phase) | VERIFIED as decided (WR-03 settled by the operator) | Behavior is the one the first report described: the refusal is raised in `mcpPhase`, and the ledger rolls the earlier phases back. Phase 5 makes that rollback restore both `mcp-adapter.json` and `mcp.json` (`restoreFiles`, `stage.ts`). `docs/mcp-compatibility.md:27` still says "fails before it writes anything". I did not reopen the WR-03 decision |
| 4 | SC4 `directTools: "search"`, `alwaysLoad` gives `true`, `lifecycle` unset, divergence documented | `mcp-server-features.ts` and docs touched; the `directTools` and `lifecycle` logic is not in the diff | VERIFIED | Spot check: `{command:"a", alwaysLoad:true}` gives `directTools: true`; an entry without it gives `"search"`; plugin `lifecycle`, `auth`, `toolPrefix` and `directTools` never reach the entry. Docs: `mcp-compatibility.md:36-44` (search and `alwaysLoad`), `:77-79` and `:339` (lazy `lifecycle`, divergence with reason ANAME-05). Live: the Phase 7 canary shows `directTools "search"` and a tool found only after `mcp({ search })` and `tool_search` |
| 5a | SC5 `description`, `sse` to `httpTransport`, timeout and OAuth callback port, `{unsupported mcp}` partial install (amended by D-03-10, then D-04-06 and D-05-05) | `mcp-server-features.ts` touched | VERIFIED as amended | Spot check: `{type:"sse", timeout:5000, oauth:{callbackPort:8080}, ...}` gives `httpTransport:"sse"`, `requestTimeoutMs:5000`, `oauth.redirectUri:"http://localhost:8080/callback"`, `description:"desc"`. `classifyMcpServer`: `ws`, `headersHelper` and `oauth.xaa` still `blocked`. Changed set, both decided: `command ~` and `args ~` now block (D-04-06, AVAR-03), and `tools[].permission_policy` / `toolPermissions` no longer block (D-05-05, which amends D-03-10 and D-03-20; the server installs with a `tool-rules-unenforced` notice). A valid remote server with `toolPermissions: {a:"allow"}` classifies `supported`. Malformed input (`command: ""`, `timeout: 0`, `url` with no `type`) is still `malformed`. The `--partial` and `info` behavior is covered by the `ANAME`/`AFILE` install-flow tests and the info tests below. ROADMAP SC5's `(ws, headersHelper, ...)` list is open-ended, so the amendments stay inside the criterion |
| 5b | ANAME-07 OAuth with `headers` | `mcp-server-features.ts` touched; `oauthField` not in the diff | VERIFIED as decided (WR-02 settled by the operator) | `oauthField` still maps `clientId`, `callbackPort`, `authServerMetadataUrl` and `scopes`, and the translated entry still sets no `auth`. I did not reopen the WR-02 decision |
| - | Docs: naming, search, length, lifecycle, divergences | `docs/mcp-compatibility.md` touched heavily | VERIFIED | The naming (`:15-17`), key table (`:19-23`), folding refusal (`:27`), tool search (`:36-44`), length (`:69`, Anthropic 128), lifecycle (`:77-79`), `{unsupported mcp}` partial install (`:158`) and `{malformed mcp}` (`:168`) sections are all present. Later phases added text; none contradicts a Phase 3 statement |
| - | `info` shows `plugin:<p>:<s>` and names each left-out server with its feature | `info.ts` touched (Phase 4 variable lists, Phase 6 status) | VERIFIED | `composeMcpEntries` still builds the name with `mcpServerDisplayName` and sets `unsupportedFeature` on each dropped server. `info.test.ts`, `edge/handlers/plugin/info.test.ts`, `info-mcp-status.test.ts` and `catalog-contract.test.ts` pass (274 tests) |
| - | A partial install writes only the supported servers | `install-outcome.ts` (+9 lines, notices only) | VERIFIED | `mcpPhase` still passes `c.resolved.mcpServers` (supported servers only); the diff only appends the legacy-removal notices after a `replaced` result |

### Deferred truth, closed by Phase 7

The original deferred item (a real Pi 1.0 with pi-mcp-adapter 5 loads the entries this extension itself writes, and the model reaches the tools through search under the Claude names) is closed. `.planning/phases/07-docs-and-live-proof/07-VERIFICATION.md`, truth 2 (ADOC-02, VERIFIED, status `passed`), records `tests/live-uat/mcp-adapter-canary.mjs` run against pi-mcp-adapter 5.2.0 on Pi 1.0.0 in a sandbox: exit 0, 14 PASS lines. It shows the production key `plugin_echo_echo_` with `toolPrefix "mcp"` and `directTools "search"`, the tool `mcp__plugin_echo_echo__echo_canary` declared only after the search, and a successful tool call. I did not re-run the canary (the task forbids it); the evidence is Phase 7's own run. The original `deferred` entry above stays as written.

### Commands run (repository root, hermetic)

`TMPDIR=/var/tmp/mcp4-reverify-p3`, `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter` (pi-mcp-adapter 5.2.0).

| Command | Exit | Result |
| ------- | ---- | ------ |
| `node --test tests/domain/name.test.ts tests/domain/mcp-server-features.test.ts tests/domain/components/hooks/matcher.test.ts tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts tests/bridges/mcp/marker.test.ts tests/bridges/agents/convert.test.ts tests/bridges/hooks/dispatch.test.ts tests/domain/mcp-resolution.test.ts` | 0 | 632 pass, 0 fail, 0 skipped |
| `node --test --test-name-pattern 'ANAME\|AFILE' tests/orchestrators/plugin/install-flow.test.ts` | 0 | 29 pass, 0 fail |
| `node --test --test-name-pattern 'ANAME' tests/orchestrators/plugin/install-outcome.test.ts` | 0 | 3 pass, 0 fail |
| `node --test --test-name-pattern 'ANAME\|AFILE' tests/orchestrators/plugin/update-flow.test.ts` | 0 | 9 pass, 0 fail (the baseline run used a narrower pattern and saw 3) |
| `node --test tests/orchestrators/plugin/info.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/edge/handlers/plugin/info.test.ts tests/orchestrators/plugin/info-mcp-status.test.ts` | 0 | 274 pass, 0 fail, 0 skipped |
| `node` spot-check scripts (key builder, fold, `translateMcpServer`, `classifyMcpServer`, `unenforcedToolRules`) | 0 | Outputs quoted in the table above |
| `git diff --stat c492bbde HEAD -- <covered files>` and `git log --oneline c492bbde..HEAD -- <4 files>` | 0 | Changed-file list above |
| `node .claude/gsd-core/bin/gsd-tools.cjs query verification.fingerprint <phase dir> <files>` | 0 | `covered_files` and `covered_digest` copied verbatim into the frontmatter |

Every test run was a single targeted `node --test` invocation with no flake and no re-run. No live canary, `pi` or `scripts/pi.sh` was run, so the real `~/.pi/agent` was not touched.

### Full-gate evidence

The orchestrator ran `npm run check` in this session on HEAD `51ebbc07` (clean tree), Node v26.11.0, `PI_MCP_ADAPTER_ROOT` = pi-mcp-adapter 5.2.0, `TMPDIR=/var/tmp/mcp4-check-tmp`: exit 0 across typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, test:unpaired, test:integration and test:coverage:direct:all (merged `coverage/direct.lcov`, 269 records). I did not re-run it.

### Notes

- `03-REVIEW-DISPOSITION.md` still lists all ten findings as `open` (recorded 2026-10-06). The decisions for WR-01..03 and the fallow audit were relayed to this pass by the orchestrator; I found no later record of them in the repository. The disposition file is out of scope and I did not edit it.
- `docs/mcp-compatibility.md:27` still reads "fails before it writes anything", the wording WR-03 asked to either enforce or reword. This matches the operator decision as relayed; flagged only so the two stay visible together.

### Re-verification verdict

Status `passed`. No truth regressed. Truths 1 and 2 and their code (`name.ts`, `matcher.ts`, `convert.ts`, `dispatch.ts`) are untouched. Truths 3a, 4 and 5a rest on files that changed, and each still holds at HEAD with two decided amendments (D-04-06 adds a `~` block; D-05-05 moves permission rules from blocking to a warning).

_Re-verified: see `verified` in the frontmatter_
_Verifier: Claude (gsd-verifier)_

---

## Re-verification (2026-10-10)

**Scope:** scoped re-verification after Phase 8 (clear milestone debt). Baseline `1b1e39a3` (the commit that last wrote this report), head `3df6309c`. `verification.status` read `stale` because Phase 8 edited 8 source files, 5 test files and the docs page in `covered_files`. Earlier sections stay as written. Status stays `passed`.

### Changed files since the baseline

| File | What changed (Phase 8) |
| ---- | ---------------------- |
| `bridges/mcp/stage.ts` | Collision walk now exempts only an owned entry under the exact name (D-08, folded rename walks the other sources); required `env`; per-server choice store (`storedChoicesFor`, `withPluginServersKeepingChoices`); `override-restored` notices; shared `isPlainObject` |
| `bridges/mcp/adapter-entry.ts` | `openUi` and `trace` join the carried fields; `withOAuthDecision` keeps the table's `auth` only beside clean headers (D-08-04); `userCarriedFields` export |
| `bridges/mcp/unstage.ts` | The adapter file write keeps the removed entries' choices (D-08-02) |
| `domain/mcp-server-features.ts` | `authField` writes `auth: "oauth"` for a remote server whose `headers` hold no `Authorization` key (D-08-04); `authServerMetadataUrl` must parse as a URL, in both the translator and the classifier |
| `domain/name.ts` | Adds `isReservedRecordKey` (D-08-07); the key builders are untouched |
| `orchestrators/plugin/info.ts` | Own-key reads of records; the companion `requires` line counts only supported MCP servers |
| `orchestrators/plugin/install-outcome.ts` | Own-key record reads and writes; passes `env` to the mcp stage (D-08-06) |
| `docs/mcp-compatibility.md` | OAuth beside headers section, user choices, move remedies, rollback wording (line 27), pi-subagents `mcp:` entry note |
| 5 test files | Cover the changes above |

Not changed: `domain/components/hooks/matcher.ts`, `bridges/hooks/dispatch.ts`, `bridges/agents/convert.ts`, `domain/mcp-resolution.ts`.

### Per-truth result

| # | Truth | Result | Evidence at HEAD |
| - | ----- | ------ | ---------------- |
| 1 | SC1 names and key, `toolPrefix: "mcp"`, one builder | VERIFIED | Spot check: `("acme","a😀b")` gives `plugin_acme_a__b_`, `("my-tools","db.x y")` gives `plugin_my-tools_db_x_y_`, `("acme","")` gives `plugin_acme__`. `translateMcpServer` still ends every entry with `directTools` and `toolPrefix: "mcp"` and drops a plugin `toolPrefix`. The replace regex is still only at `name.ts:260` |
| 2 | SC2 hook matcher, `if:`, agent `tools:` match delivered tools | VERIFIED | Matcher, dispatch and convert are unchanged and their tests pass inside the 755-test run |
| 3a | SC3 same-plugin, cross-plugin and folded key clash refused; no length check | VERIFIED | The `foldedMcpServerKey` comparison is unchanged (`plugin_foo_my-db_` and `plugin_foo_my_db_` fold equal). Phase 8 tightened the walk: an owned entry that only folds equal to the new name (a rename) no longer skips the other sources (IN-01 closed). `stage.test.ts` collision cases pass. The only length check in `domain/` is the unrelated saved-workflow name gate (`name.ts:402`) |
| 3b | SC3 wording "before any write" | VERIFIED, now consistent | `docs/mcp-compatibility.md:27` now says the install "fails ... and leaves nothing behind: the command rolls back every component that it already wrote" (option (b) of WR-03). Behavior and wording agree |
| 4 | SC4 `directTools`, `alwaysLoad`, `lifecycle` unset, divergence documented | VERIFIED | Spot check: `alwaysLoad: true` gives `directTools: true`, else `"search"`; plugin `lifecycle`, `auth: "bearer"`, `toolPrefix`, `directTools` do not reach the entry. Docs keep the search and `lifecycle` sections. The one change: the table itself may now write `auth: "oauth"` (truth 5b); a plugin's own `auth` is still dropped |
| 5a | SC5 `description`, `httpTransport`, timeout, OAuth port, `{unsupported mcp}` partial install | VERIFIED | Spot check: `{type:"sse", timeout:5000, oauth:{callbackPort:8080}}` gives `httpTransport:"sse"`, `requestTimeoutMs:5000`, `oauth.redirectUri:"http://localhost:8080/callback"`, `description`. Classifier: `ws`, `headersHelper`, `oauth.xaa` blocked; empty `command`, `timeout: 0`, `url` with no `type` malformed; `toolPermissions` supported. New: an `authServerMetadataUrl` that is not a URL is malformed. `install-flow` `ANAME`/`AFILE` 29, `install-outcome` 3, `update-flow` 9 pass |
| 5b | ANAME-07 OAuth beside `headers` | VERIFIED, WR-02 now fixed in code | Spot check: `{type:"sse", headers:{"X-Key":"k"}, oauth:{callbackPort:8080}}` translates to an entry with `headers`, `auth:"oauth"` and `oauth`; with an `authorization` header (any case) no `auth`. `withOAuthDecision` drops `auth` when a header value is empty or names an unset variable, matching the adapter's OAuth-mode refusal. This closes the gap that WR-02 and the 2026-10-09 section had settled by decision |
| - | Docs | VERIFIED | Naming, key table, folding refusal, search, length (128), lifecycle, `{unsupported mcp}` sections remain; added OAuth-beside-headers table and user-choices text do not contradict Phase 3 statements |
| - | `info` shows `plugin:<p>:<s>` and each left-out server with its feature | VERIFIED | `info` tests (275) pass; the `requires` line now counts supported servers only, so a partial install that leaves out every server no longer names the adapter |
| - | A partial install writes only the supported servers | VERIFIED | `mcpPhase` still passes `c.resolved.mcpServers`; the diff adds `env` and own-key reads only |

No truth lost support. Score line in the frontmatter is the original one, kept unchanged.

### Commands run

`TMPDIR=/var/tmp/mcp4-reverify-03`, `PI_MCP_ADAPTER_ROOT` = pi-mcp-adapter 5.2.0.

| Command | Exit | Result |
| ------- | ---- | ------ |
| `node --test` on `name`, `mcp-server-features`, `matcher`, `adapter-entry`, `stage`, `unstage`, `marker`, `adapter-doc`, `convert`, `dispatch`, `mcp-resolution` tests | 0 | 755 pass, 0 fail, 0 skipped |
| `node --test --test-name-pattern 'ANAME\|AFILE' tests/orchestrators/plugin/install-flow.test.ts` | 0 | 29 pass |
| `node --test --test-name-pattern 'ANAME' tests/orchestrators/plugin/install-outcome.test.ts` | 0 | 3 pass |
| `node --test --test-name-pattern 'ANAME\|AFILE' tests/orchestrators/plugin/update-flow.test.ts` | 0 | 9 pass |
| `node --test` on `info`, `catalog-contract`, `edge/handlers/plugin/info`, `info-mcp-status` tests | 0 | 275 pass |
| node spot-check script (key builder, fold, `translateMcpServer`, `classifyMcpServer`) | 0 | Outputs quoted above |
| `gsd-tools query verification.fingerprint` | 0 | `covered_digest` copied verbatim |

`npm run check` was not re-run (the orchestrator ran it on HEAD 6199bc53 or later: exit 0). No live canary, `pi` or `scripts/pi.sh` was run.

### Verdict

Status `passed`. No regression. Phase 8 closed two earlier open points in code: WR-02 (OAuth beside headers, D-08-04) and the WR-03 wording and IN-01 rename hole.
