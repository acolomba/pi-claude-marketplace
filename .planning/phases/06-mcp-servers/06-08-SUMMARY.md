---
phase: 06-mcp-servers
plan: 08
subsystem: docs
tags: [docs, mcp, pi-mcp-adapter, pi-subagents, fg-30]

requires:
  - phase: 06-mcp-servers
    provides: "measured 7.0.0 literals from 06-01..06-06 (names, search, configuration, sources, calls, agent refusal, project trust, lifecycle, overrides)"
provides:
  - "docs/mcp-compatibility.md re-measured on pi-mcp-adapter 7.0.0 on Pi 1.4.0, with every run-time statement citing a scenario, a 2026-11-01 run, or the 7.0.0 source"
  - "a new Server sources section (D-CF6-01), the D-CF6-02 invalid-config rule, and the rewritten divergence list (D-CF6-01 residual, D-CF6-03, D-CF6-10)"
affects: [06-09]

actuals:
  tokens: 7000
  tasks: 3
  commits: 3
plan_head_before: 20c882a4be1d384d7a7f05aee324c2b0886a65d2
plan_head_after: b0f52790e36af5afc84a94d6ffe7dc6a8f210a6b

tech-stack:
  added: []
  patterns:
    - "A doc row names the evidence it rests on: a features/mcp-server scenario, a dated run, or 'checked in the 7.0.0 source'"

key-files:
  created: []
  modified:
    - docs/mcp-compatibility.md

key-decisions:
  - "MCP_DIRECT_TOOLS was re-measured outside the harness: an unnamed server gets a per-server tool mcp__plugin_<p>_<s>_ and deferred tools under mcp__plugin_<p>_<s>___<tool>; __none__ registers no deferred tool and keeps a proxy call inside mcp"
  - "The deferred three-underscore name is recorded as a Naming divergence (Pi capability gap), because tool_search and codemode then miss the Claude Code name"
  - "The hooks paragraph states only the adapter fact (Pi reports the mcp call and a nested call under the real name) and points to hooks-compatibility.md for matcher behavior; the reconcile is a parent line"
  - "The canary version stays only in Further reading; the header names the canary run without its adapter version, per the plan's step 6"

patterns-established:
  - "Run-time doc statements cite the scenario file in parentheses"

requirements-completed: [MCP-03]

coverage:
  - id: D1
    description: "The doc basis names pi-mcp-adapter 7.0.0 on Pi 1.4.0, the Claude Code 2.1.316 binary, and the features/mcp-server scenarios; MCP_DIRECT_TOOLS and --no-extensions rows restated from a 2026-11-01 run"
    requirement: MCP-03
    verification:
      - kind: other
        ref: "grep -c 'pi-mcp-adapter 7.0.0 on Pi 1.4.0' docs/mcp-compatibility.md (2); grep -c 'The live canary measured both cases on Pi 1.0.0' (0)"
        status: pass
      - kind: manual_procedural
        ref: "scratch probe exec-06-08/probe.ts (not committed), records below"
        status: pass
    human_judgment: true
    rationale: "Doc prose accuracy against the probes and the 7.0.0 source is a reading judgment; plan 06-09 checks the text against the merged behavior"
  - id: D2
    description: "Every FG-30 checklist row states the 7.0.0 fact with its evidence, including the new 7.x facts"
    requirement: MCP-03
    verification:
      - kind: other
        ref: "grep gates: 'reaches hooks as tool .mcp.' 0; D-CF6-10 1+; lazy-keep-alive 1; claudePlugins 1+; appendStructuredContent 1+; mcp-project-servers 2"
        status: pass
    human_judgment: true
    rationale: "Per-row correctness is a reading judgment; the per-row account below lists the evidence of each row"
  - id: D3
    description: "Server sources section, D-CF6-02 invalid-config rule, bundle row, narrowed migration rows, and the rewritten divergence list"
    requirement: MCP-03
    verification:
      - kind: other
        ref: "grep gates: stale malformed and hooks items 0; '^## Server sources$' 1; D-CF6-02 2; D-CF6-01 3; 'shows an error, and loads the other servers' 0; pre-commit (mdformat, markdownlint) clean"
        status: pass
    human_judgment: true
    rationale: "The D-CF6-02 text documents the rule that plan 06-07 builds in parallel; plan 06-09 must check it against the merged resolver"

duration: 30min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 08: MCP compatibility doc re-measured on pi-mcp-adapter 7.0.0 Summary

**`docs/mcp-compatibility.md` now rests on pi-mcp-adapter 7.0.0 on Pi 1.4.0: each run-time statement cites a `features/mcp-server/` scenario, a 2026-11-01 run, or the 7.0.0 source. Two rows were re-measured with a scratch RPC session (`MCP_DIRECT_TOOLS`, which changed with adapter 6.0, and `--no-extensions`). The doc gains a Server sources section (D-CF6-01), the file-versus-inline invalid-config rule (D-CF6-02), and a divergence list without the two stale items.**

## Performance

- **Duration:** about 30 min
- **Started:** 2026-11-01T16:28Z
- **Completed:** 2026-11-01T16:57Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- The header names pi-mcp-adapter 7.0.0 on Pi 1.4.0, the Claude Code 2.1.316 binary for the source and invalid-config rows, and the cucumber scenarios as the run-time basis. It names the two statements that still rest on older runs (name lengths, the extra `/reload` after an upgrade).
- Every adapter row states the 7.0.0 fact with its evidence. New 7.x facts got rows or notes: Pi deferred tools for `tool_search` and `codemode`, `lazy-keep-alive`, `pi --mcp-project-servers allow`, the SSE fallback of `type: "http"` and the optional `GET` stream, the `--mcp-config` exception, `appendStructuredContent` and `roots`, `protocolVersion`, and the opt-in `claudePlugins` loader.
- "Hooks and agents" states that a proxy call runs as a nested Pi tool call under the real name since adapter 6.0, measured, and records the measured foreground pi-subagents refusal as the D-CF6-10 gap.
- "Server sources", the bundle row, the D-CF6-02 rules, the narrowed migration rows, and the divergence list match the phase decisions.

## Task Commits

1. **Task 1: re-measure the two run-time rows and restate the basis (tracer)**: `b325597` (docs)
2. **Task 2: rewrite every adapter row of the FG-30 checklist**: `0e1d6ed` (docs)
3. **Task 3: server sources, invalid configs, divergence list**: `b0f5279` (docs)

Tracer gate: interactive, `end-of-phase`, automated-only verify. The verify re-ran after Task 1 (`grep -c 'pi-mcp-adapter 7.0.0 on Pi 1.4.0'` printed 1), so the plan expanded.

## Probe records (scratch, not committed)

The script was `/tmp/claude-0/-home-user-pi-claude-marketplace/5aec957e-dc04-5dcd-ad24-f2ccbabeb40f/scratchpad/exec-06-08/probe.ts`. It builds the Pi arguments with `piArguments` from `test/e2e/_rpc.ts` and spawns Pi 1.4.0 in RPC mode with the allowlist environment (`HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE=1`, `PATH`, `TMPDIR`) plus the variable under test. Each case gets a fresh sandbox under the scratch folder: a path marketplace `fixtures` with plugin `demo` 1.0.0, whose `.mcp.json` declares the frozen stub `features/lib/mcp-stub-server.ts` as server `stub`. A first Pi with only the real extension runs `/claude:plugin marketplace add <dir> --scope user` and `/claude:plugin install demo@fixtures --scope user`. The written entry was `plugin_demo_stub_` with `directTools: "search"` and `toolPrefix: "mcp"`. A second Pi loads the real extension, the scripted model, the registry probe, and pi-mcp-adapter 7.0.0 from the peer cache, sets `faux/faux-1`, waits for the stub's `tools/list` plus 2.5 s, reads the probe, and plays `mcp {"search":"echo"}`, `mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}`, `mcp {}`, `Done.`. Run with `nondac-sh -c 'NODE_OPTIONS=--max-old-space-size=6144 node probe.ts direct'` and `... node probe.ts noext`.

**`MCP_DIRECT_TOOLS` (pi-mcp-adapter 7.0.0, Pi 1.4.0):**

| Case | `allTools` (plugin and MCP entries) | Active plugin tools | Call 1 tools after `mcp` | Search result starts with | Proxy call | Nested execution |
| --- | --- | --- | --- | --- | --- | --- |
| unset (baseline) | `mcp`, `mcp__plugin_demo_stub__echo`, `codemode`, `tool_search` | none before the search, `mcp__plugin_demo_stub__echo` after | (none) | `Activated as direct tools: mcp__plugin_demo_stub__echo.` | `echo:ping` | `<id> mcp`, `<id>/1 mcp__plugin_demo_stub__echo` |
| `__none__` | `mcp`, `mcp__plugin_demo_stub_`, `codemode`, `tool_search` | `mcp__plugin_demo_stub_` | `mcp__plugin_demo_stub_` | `Found 1 tool matching "echo":` (no activation) | `echo:ping` | only `mcp` calls |
| `plugin_other_api_` (not a plugin key) | `mcp`, `mcp__plugin_demo_stub___echo`, `mcp__plugin_demo_stub_`, `codemode`, `tool_search` | `mcp__plugin_demo_stub_` | `mcp__plugin_demo_stub_` | `Found 1 tool matching "echo":` (no activation) | `echo:ping` | not logged |
| `plugin_demo_stub_` (named) | `mcp`, `mcp__plugin_demo_stub__echo`, `codemode`, `tool_search` | `mcp__plugin_demo_stub__echo` from the start | `mcp__plugin_demo_stub__echo` | `Found 1 tool matching "echo":` | `echo:ping` | not logged |

In every case `mcp({})` returned `MCP: 1/1 servers, 1 tools\n\n✓ plugin_demo_stub_ (1 tools, legacy notification path)\n\nmcp(...)` and the stub logged `initialize, notifications/initialized, tools/list, initialize, notifications/initialized, tools/list, tools/call`. Research Pitfall 7 held: with an override that does not name the server, its cached tools become deferred tools under the three-underscore name. The research checklist's "likely breaks" verdict held: the old doc said an unnamed server gets "no tools from a search", but the search lists them (it activates none) and Pi registers deferred tools.

**`--no-extensions` (Pi 1.4.0, registry probe loaded with `--extension`, no adapter):**

| Arguments | Setting `defaultTools: ["+tool_search"]` | `allTools` | `activeTools` |
| --- | --- | --- | --- |
| `--no-extensions` | no | `read, bash, powershell, edit, write, grep, find, ls` | `read, bash, edit, write` |
| `--no-extensions` | yes | same, no `tool_search` | `read, bash, edit, write` |
| `--no-extensions -e builtin:tool-search` | no | `..., ls, tool_search` | `read, bash, edit, write` |
| `--no-extensions -e builtin:tool-search` | yes | `..., ls, tool_search` | `read, bash, edit, write, tool_search` |
| (no flag) | no | `..., ls, codemode, tool_search` | `read, bash, edit, write` |
| (no flag) | yes | `..., ls, codemode, tool_search` | `read, bash, edit, write, tool_search` |

The row holds on Pi 1.4.0, and `--no-extensions` also drops `codemode`.

## Per-row account of the FG-30 checklist

| Checklist row | Result | Evidence cited in the doc |
| --- | --- | --- |
| Header l.7 basis | rewritten | 7.0.0 on Pi 1.4.0, 2.1.316 binary, `features/mcp-server/`, the two older runs named |
| l.11 peer and SDK 2.3.1 | holds, one sentence added | 7.0.0 still ships client 2.3.1 |
| Names l.15-29 | holds, text added | `listing.feature` |
| `-`/`_` fold refusal | holds, text | 7.0.0 source `formatServerNamespace` |
| Collision source list | holds, unchanged | (research: config.ts:835-980 same order) |
| Tool search, `directTools: "search"` | holds, text | `listing.feature` (call 1 offers no plugin tool; search activates) |
| `alwaysLoad` -> `directTools: true` | holds | 7.0.0 source |
| `_meta["anthropic/alwaysLoad"]` | holds | 7.0.0 source reads no `alwaysLoad` |
| Pi `tool_search` off by default | holds, deferred-tools note and `codemode` row added | `listing.feature` (registered, inactive), 2026-11-01 run |
| `--no-extensions` / `-e builtin:tool-search` | re-measured, holds | 2026-11-01 run (above) |
| Name length | holds, kept the 2026-10-06 run and said so | 7.0.0 source: no cap on direct or search names; deferred names capped at 64 |
| Built-in MCP turned off | holds, `--mcp-config` exception added | 7.0.0 source (`pi-builtin-mcp.ts`, index.ts:1722) |
| Lifecycle `lazy` | holds, `lazy-keep-alive` added | `listing.feature`, `invocation.feature`, 7.0.0 source |
| Project trust bullets | holds, `--mcp-project-servers allow` added, D-CF6-03 cited | `project-scope.feature` texts, 7.0.0 source for the dialog and the flag |
| `PI_MCP_CONFIG_MODE=exclusive` | holds, unchanged | 7.0.0 source |
| `--mcp-config <file>` | holds, unchanged | 7.0.0 source |
| `MCP_DIRECT_TOOLS` | broke, rewritten; Naming divergence added | 2026-11-01 run |
| Translated fields | hold; SSE fallback and `GET` stream note added | 7.0.0 source (`shouldFallbackToSse`), `configuration.feature` |
| `auth: "oauth"` beside headers | holds, text | `configuration.feature` (D-08-04 scenario) |
| Dropped fields | `protocolVersion` added | 7.0.0 source (`types.ts`) |
| User overrides | stale, `appendStructuredContent` and `roots` added (D-CF1-14); `disabled` survival measured | `lifecycle.feature` |
| Invalid server configs and l.405 divergence | rewritten per D-CF6-02 as decided | 2.1.316 probes (research); plan 06-07 builds it |
| Hooks l.210-212 and l.404 | broke, rewritten; stale divergence removed | 2026-11-01 run (nested `<id>/1 mcp__plugin_demo_stub__echo`) |
| Agents l.222/238 | changed text, rewritten; D-CF6-10 recorded | `invocation.feature` |
| Variables section | holds; one scenario paragraph added | `configuration.feature`, the conformance test |
| `literalEnv` (AVAR-03) | holds, unchanged | (research: types.ts:511) |
| Status in info, `status/v1` | holds; measured statuses and the brief `status unknown` added | `companion-missing.feature`, `project-scope.feature`, 7.0.0 source |
| Upgrading (AMIG) | malformed bullet and Migration divergence narrowed to inline configs | D-CF6-02 |
| Further reading canary 5.2.0 | unchanged | parent line |
| New: `claudePlugins` loader | note added | 7.0.0 source (`claude-plugin-loader.ts`) |

## Files Created/Modified

- `docs/mcp-compatibility.md`: the MCP compatibility contract re-measured on pi-mcp-adapter 7.0.0 and Pi 1.4.0

## Decisions Made

- The `MCP_DIRECT_TOOLS` deferred-tool name is a Naming divergence with a Pi-gap reason, as the research suggested.
- The hooks paragraph states the adapter fact only. Matcher behavior stays in `hooks-compatibility.md` (Phase 5).
- REQUIREMENTS.md is not edited here. MCP-03 is shared with plan 06-02, and the orchestrator marks it after the merge, as with the wave-2 plans.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The scratch folder and the guarded commands**
- **Found during:** Task 1
- **Issue:** The plan names the scratch folder `.../scratchpad/06-08/`, and the parent's rules name `.../scratchpad/exec-06-08/`. The sandbox also refused compound shell lines that name git or `pre-commit` with an `env -u` prefix.
- **Fix:** Used `exec-06-08/` (the parent's rule). Ran `SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md` and `git commit` as plain commands, without `env -u GH_TOKEN -u GITHUB_TOKEN`. zizmor had no file to check, so the token did not matter.
- **Files modified:** none
- **Committed in:** n/a

**2. [Rule 2 - Accuracy] Rows beyond the checklist got citations**
- **Found during:** Task 2
- **Issue:** The truth asks every run-time statement to cite its evidence. Some rows the checklist marked "keep" (OAuth beside headers, Variables, Status) made run-time claims with no 7.0.0 citation.
- **Fix:** Each got a short sentence that names its scenario file.
- **Files modified:** `docs/mcp-compatibility.md`
- **Committed in:** `0e1d6ed`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 accuracy).
**Impact on plan:** None on scope. Only `docs/mcp-compatibility.md` changed (`git diff --stat 20c882a..HEAD` lists that file only).

## Issues Encountered

- The worktree had no peer cache. `node scripts/install-test-peers.mjs` installed pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, and pi-dynamic-workflows 3.15.0 into `node_modules/.cache/optional-peers`, as the parent's rules say.
- Inside the worktree, the hook prints "(no files to check)" for mdformat, markdownlint, and prettier. So each commit followed a manual `pre-commit run --files` (mdformat reformatted twice), `npx prettier --check docs/mcp-compatibility.md`, and `npm run check:static` (passed three times).

## Handed-over fix

None. No product break was measured. The `MCP_DIRECT_TOOLS` change is adapter behavior under a user setting, recorded as a divergence.

## Verification

- Task 1: `grep -c 'pi-mcp-adapter 7.0.0 on Pi 1.4.0'` = 2 (>= 1); `grep -c 'The live canary measured both cases on Pi 1.0.0'` = 0.
- Task 2: `grep -c 'reaches hooks as tool .mcp.'` = 0; `D-CF6-10` = 1; `lazy-keep-alive` = 1; `claudePlugins` = 3; `appendStructuredContent` = 2; `mcp-project-servers` = 2.
- Task 3: `A malformed server makes the whole plugin unavailable` = 0; `Hooks do not see calls through the` = 0; `^## Server sources$` = 1; `D-CF6-02` = 2; `D-CF6-01` = 3 (>= 2); `shows an error, and loads the other servers` = 0.
- `SKIP=npm-check pre-commit run --files docs/mcp-compatibility.md`: clean on the second pass after each edit set. `npx prettier --check`: clean. `npm run check:static`: passed before each commit.
- Kept anchors: `#upgrading`, `#variables`, `#project-scope-servers`, `#server-status-in-info`, `#oauth-beside-headers`, `#partially-available-plugins`, `#divergences-and-documented-absences`, `#user-overrides` (headings unchanged).
- `git diff --stat 20c882a..HEAD`: `docs/mcp-compatibility.md` only.

## Next Phase Readiness

- Plan 06-09 must check "Invalid server configs", the Upgrading bullet ("the move treats that server as one that the plugin no longer declares"), and the Migration divergence against the merged 06-07 resolver.
- The parent lines below carry the cross-file reconciles.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-19 is mitigated: each rewritten row cites its scenario, run, or source line, and the per-row account above covers every checklist row. T-06-SC: no package was installed beyond the peer cache that `scripts/install-test-peers.mjs` fills at its declared floors.

## Parent lines

- `docs/hooks-compatibility.md` line 110 (Phase 5): it says a call through the `mcp` proxy "reaches hooks as tool `mcp`" and that the plugin's MCP matchers do not fire. Since pi-mcp-adapter 6.0, Pi reports the `mcp` call and a nested call under the real name (`<id>/1 mcp__plugin_demo_stub__echo`, measured on 7.0.0). Under `MCP_DIRECT_TOOLS=__none__`, only the `mcp` call. Reconcile the paragraph and its Pi-gap reason with what the hooks bridge does with the nested call.
- `test/live-uat/mcp-adapter-canary.mjs`, its README section, and the Further reading line of `docs/mcp-compatibility.md`: raise the canary from 5.2.0 to 7.0.0, then update the line's version.
- `docs/output-catalog.md` lines 148, 736, 3395 (closed-set file): the prose lists a missing file, malformed JSON, and a wrapper-less reference as a broken `mcpServers` reference. After D-CF6-01 a wrapper-less file loads, and after D-CF6-02 a missing or unparseable file source is skipped silently. Only an inline-invalid map or an absolute or escaping path gives `{malformed mcp}`.
- PRD `docs/prd/pi-claude-marketplace-prd.md`: MC-1 and MC-3 (lines 477-479, also the flowchart near line 501) are superseded by D-CF6-01 and D-CF6-02. MC-4 (line 480) says "pi-mcp-adapter 5's nine config sources"; the order holds on 7.0.0.
- `extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts` line 3 and `collision-ancestors.ts` line 3 comments say "pi-mcp-adapter 5's": optional text fix for plan 06-09 (a Phase 6 product file, not this plan's).
- `CHANGELOG.md`: the MCP compatibility doc is re-measured on pi-mcp-adapter 7.0.0 and Pi 1.4.0, and documents the server-source merge and the silent skip of bad file sources.
- REQUIREMENTS.md: MCP-03 not marked here (shared with 06-02); the orchestrator decides.

## Self-Check: PASSED

- FOUND: `docs/mcp-compatibility.md` (modified)
- FOUND commits on this branch: `b325597`, `0e1d6ed`, `b0f5279` (3, measured `git rev-list --count 20c882a..HEAD`)
- Acceptance criteria of all three tasks re-run: all PASS (see Verification)

## Dubious Choices

1. **`MCP_DIRECT_TOOLS` recorded as a Naming divergence.** Alternatives: describe it only in the settings row, as ADOC-01 treats the other adapter settings; or hand it over as a product fix. Dubious because the variable is the user's own setting, and the existing ADOC-01 item already covers "settings change plugin servers". A second item may read as double-counting.
2. **The hooks paragraph does not say whether plugin matchers fire for a proxied call.** Alternative: claim the matchers now fire, which no Phase 6 run measured, or keep the old claim, which the 7.0.0 run contradicts. Dubious because a reader of this doc alone cannot tell how a plugin hook behaves until the Phase 5 reconcile lands.
3. **The header names the canary run without its adapter version** (plan step 6 says to name 5.2.0 only in Further reading), with a pointer there. Alternative: name 5.2.0 in the header too, which the plan's must-have about stating the old basis seems to want. Dubious because the two plan statements pull in opposite ways.
4. **The Upgrading bullet says the move treats a file-source server that is skipped as one the plugin no longer declares.** This follows from AMIG-01 reusing `resolveStrict`, read from the research, not run. Plan 06-07 builds the skip in parallel. Alternative: say nothing about the file-source case. Dubious because the removal reason a user sees is inferred.
5. **"In Claude Code, a subagent granted a plugin MCP tool calls it in the foreground."** This follows MCP-07's wording, and no 2.1.316 probe ran a subagent. Alternative: drop the upstream sentence from the gap item. Dubious because it states an upstream behavior without a recorded probe.
6. **The Migration divergence item stays, reworded.** With D-CF6-02, Claude Code also refuses such a plugin, so the item now differs from upstream only in that this extension removes old entries. Alternative: delete the item. Dubious because it may no longer be a real divergence.
7. **Citations of scenario file names in a user-facing doc.** Alternative: keep evidence only in the header and in this SUMMARY. Dubious because the citations make the doc denser for readers who never open `features/`.
8. **`--mcp-config` wording: "Pi still does not run its built-in MCP support, because pi-mcp-adapter owns the `/mcp` command."** This rests on the adapter's own source comment, not on a run. Alternative: state only that the adapter skips the settings write.
