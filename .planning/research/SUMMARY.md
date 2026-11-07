# Project Research Summary

**Project:** pi-claude-marketplace, milestone `mcp-builtin`
**Domain:** Pi extension that bridges Claude plugin MCP servers into either pi-mcp-adapter 7.x or Pi 1.5.0's built-in MCP
**Researched:** 2026-11-04
**Confidence:** HIGH for the Pi, adapter and pi-subagents facts (read from published tarballs and this tree); MEDIUM for the phase split, handler ordering and wording

## Executive Summary

This is a brownfield change to a layered, transactional Pi extension. Plugin MCP servers must run through pi-mcp-adapter when it is loaded and through Pi's built-in MCP when it is not. The two are equal implementations, and a switch must never need user action. Research confirms the brief's central claim: no single registration path serves both, because the adapter consumes `pi.registerMcpServer` registrations only as proxy-only servers and drops `directTools` (so `alwaysLoad` is lost). Each implementation therefore needs its own verdict table, translation, materialization, naming, status reader and agent-grant form.

The recommended approach has five parts. (1) Add no dependency. Bump Pi to 1.5.0 (a small mechanical change; the MCP code is byte-identical to 1.4.0). (2) Split the proposed `McpImplementation` interface by fallow zone: a pure profile in `domain/mcp-implementation.ts`, effects in `bridges/mcp` and `platform`, composition in a new `orchestrators/mcp/` directory. (3) Carry the active implementation (`adapter | builtin | none`) in the existing D-05 run snapshot (`SoftDepStatus.mcpImplementation`), not in a module global. (4) Persist the implementation-neutral, pre-substitution Claude form of every declared server in an optional additive `mcpServerConfigs` field, plus a neutral `compatibility`. Compute the effective verdict at read time. (5) Register built-in servers with `pi.registerMcpServer` from install records, twice per load (`session_start`, then after `loadReconcile`), only when built-in is the active implementation, gated on project trust, never handling `mcp_servers_change`.

**Superseded by decision 4:** research proposed a `-builtin:mcp` settings cleanup (decision 1: FEATURES T13, the P-Settings / Phase 6 proposals, the settings lock and atomic-write exemptions, the onboarding-state authorship questions, and the "one extra reload" cleanup gap). The user replaced it. The extension never edits Pi settings and NFR-10 is not amended. When neither implementation is active (no adapter, built-in MCP off, for example from the adapter's leftover `-builtin:mcp`), plugins with MCP servers are partially available because they require MCP support. The user turns on Pi's built-in MCP or installs pi-mcp-adapter. This removes the two hardest research problems and one whole phase.

The main risks: variable encoding (Pi expands only `env`, `headers` and `oauth.clientSecret`, treats `$NAME` and a leading `!` specially, and has no `:-default`; unescaped plugin values can execute commands), name divergence (`-` folds to `_`; names over 64 characters get a hash), project-trust weakness (`isProjectTrusted()` auto-trusts a repo whose `.pi/` has no protected entry), the dual-profile cucumber harness silently running one implementation, and parallel children colliding in shared files. Each has a concrete mitigation below, and the serial foundation phase exists mainly to neutralize the last two.

## Key Findings

### Recommended Stack

No new runtime or dev dependency. Built-in MCP is driven through the Pi peer's `ExtensionAPI`; Pi's own client connects. Do not add an MCP SDK. Detail: `.planning/research/STACK.md`.

**Core technologies:**

- `@earendil-works/pi-coding-agent` dev `^1.5.0`, peer `>=1.5.0`: host API and the built-in MCP itself. 1.5.0 adds `clientRegistration: "auto"` and fixes `isProjectTrusted()` ignoring a saved "Do not trust".
- `@earendil-works/pi-ai` exact `1.5.0`: keep exact so the cucumber faux provider shares Pi's pi-ai instance. `pi-tui` dev `^1.5.0`.
- Pin sites to bump: `package.json`, lock, `test/architecture/peer-floor.test.ts` literals, `test/e2e/pi-peer-floor/` package and lock, `test/e2e/pi-json-output.test.ts`, and the stale peer line in PROJECT.md Constraints.
- Optional peers unchanged (`pi-subagents >=0.84.0`, `pi-mcp-adapter >=7.0.0 <8`, workflows). pi-subagents 0.84.0 already resolves `mcp:` selectors against built-in MCP, and registered servers work only in background (`async: true`) children.
- Probe: built-in is active when `getCommands()` has `mcp` with `sourceInfo.path === "builtin:mcp"`; adapter-first precedence. `--no-mcp` simulates "none" in the harness.
- `platform/pi-api.ts` (NFR-11 chokepoint) gains `McpServerConfig`, `RegisteredMcpServer`, `PiMcpRegistry`, `hasLoadedBuiltinMcp`, and `path`/`exposure`/`namespace` inventory fields.

### Expected Features

T1-T16 in FEATURES.md are all requirements except T13. Detail: `.planning/research/FEATURES.md`.

**Must have (table stakes):**

- Pi 1.5.0 bump (T1) and the active-implementation snapshot `adapter | builtin | none` (T2).
- Implementation-neutral Claude-shaped install records with legacy fallback (T3); read-time verdicts per implementation on list, info, install, update, enable, pending, apply (T4, T5).
- Built-in translation table (T6): extension-side expansion for `url`, `command`, `args`; `$$`/`$!` escaping in `env`/`headers`; `timeout` ms to seconds; `callbackPort` to `callbackUrl http://localhost:<port>/callback`; `scope`; `description`; `exposure` (`deferred`, or `direct` for `alwaysLoad`). Never write `cwd` (not a Claude field) or Pi-only powers.
- Built-in materialization (T7); naming `plugin_<plugin>_<server>` with collision check (T8); markers and `requires:` per implementation (T9); built-in status reader (T10); agent grants per implementation (T11); adapter entries written at install under every implementation, so no reconcile step is needed (T12); hooks proxy special case made adapter-only (T14); dual-profile cucumber (T15); docs (T16).
- New verdicts: `sse` blocked under built-in (Pi rejects it); `bareElicitationCapability` supported under built-in; leading `~` and `headersHelper` blocked as with the adapter.

**Should have (differentiators):**

- D1 hook server-segment restoration (`-` restored in the matcher): P1 if the user rules that parity applies (the default under the parity rule).
- D2 immediate register and unregister on install, uninstall, enable, disable. D5 re-test of background agents under built-in.

**Defer:**

- D3 deny rules to `toolExposure: "hidden"`; persisted `/mcp` choices for built-in (Pi sessions only); `oauth.clientName` parity until the user rules.

**Dropped (superseded by decision 4):** T13 settings cleanup, its notice and its cucumber scenarios.

### Architecture Approach

Split by zone: the entry may import neither `domain` nor `bridges-mcp`, and bridge zones may not import each other. The pure profile (`id`, `classify`, `serverName`, `toolNamePrefix`, `grantSelector`, plus `effectiveMcpCompatibility`) lives in `domain/mcp-implementation.ts` and is frozen after the foundation. Effects sit in their own zones. `orchestrators/mcp/session-materialize.ts` runs ordered, individually try/caught steps from `session_start`. Detail: `.planning/research/ARCHITECTURE.md`.

**Major components:**

1. `domain/mcp-implementation.ts` and `mcp-builtin-features.ts`: pure profile, per-implementation verdict tables, naming, effective compatibility.
2. `bridges/mcp/builtin-{entry,escape,registration}.ts`: translation, Pi value encoding, idempotent sync over `PiMcpRegistry`. Adapter files stay as they are and keep writing `mcp-adapter.json` at install under every implementation (built-in never reads it).
3. `orchestrators/mcp/*`: `session-materialize`, `recorded-servers` (legacy fallback re-resolves read-only from `record.resolvedSource`), and step modules for built-in registration and agent grants.
4. `platform/mcp-builtin-status.ts`: status from `getMcpServers()` plus `getAllTools()`. Pi has no status channel, so only `connected` / `not connected` / `disabled` / `overridden by mcp.json` / `project not trusted` are derivable.
5. `bridges/agents/convert.ts` and the agents index: grant form per implementation, rewritten at load when the recorded implementation differs.

Key rule: stored compatibility is neutral and effective compatibility is computed at read time. `--partial` consent is asked only at user-initiated install and update against the effective value. Re-materialization (enable, cascade, convergence, reinstall, import) checks the neutral value, so a switch never asks for consent.

### Critical Pitfalls

1. **Variable encoding.** Pi expands only `env`, `headers`, `oauth.clientSecret`; supports `$NAME`; has no `:-default`; runs a leading `!` as a shell command; fails the connection on an unset variable. Expand Claude variables ourselves at registration, apply the AVAR-05 deny-list, then escape `$` to `$$` and a leading `!` to `$!`. Never persist resolved values.
2. **Double serving and extension errors.** Never register while the adapter is active (it connects registrations proxy-only and drops `alwaysLoad`), and never when nothing connects (each registration becomes an extension error). Register per server in try/catch. Do not subscribe to `mcp_servers_change`.
3. **Names.** Built-in folds `-` to `_`, cuts names over 64 characters with an 8-hex hash, and an `mcp.json` entry with the same folded name wins. Reusing `generatedMcpServerKey` (trailing `_`) gives triple-underscore tool names. Naming belongs to the profile; collisions are detected at read time in a fixed order (project over user).
4. **Record reshape.** Record the Claude form before substitution (absolute paths and tokens must not enter `state.json`), as an optional additive field with no schema bump. An absent field must never mean "no servers".
5. **Harness and parallel conflicts.** Profiles that silently run one implementation, and children editing frozen shared files. Freeze harness, contract, closed sets and wiring in the serial foundation; assert the active implementation in every profile Pi; add an architecture test for tags and a profile axis to the shard test.

Also carry: project trust (gate per registration on `ctx.isProjectTrusted()` in every runtime); detection read before `session_start` or by an earlier handler (ban factory-time probes); legacy `mcp.json` entries that built-in reads before AMIG-01 moves them; timeout units; CI time with a second profile.

## Implications for Roadmap

ARCHITECTURE.md's split (serial foundation, then parallel phases) is the base, because it assigns disjoint files. PITFALLS.md labels map onto it:

| PITFALLS label | Lands in                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-Foundation   | Phase 1                                                                                                                                                                     |
| P-Records      | producer in Phase 1 (additive, no output change); readers, consent split and migration readers in Phase 3                                                                  |
| P-Builtin      | Phase 2                                                                                                                                                                     |
| P-Adapter      | no separate phase: the adapter keeps writing at install, so no reconcile step; AMIG-01 reader change in Phase 3; legacy-entry ordering concern in Phase 2                 |
| P-Agents-Hooks | split into Phase 4 (agents) and Phase 5 (hooks), because their files are disjoint                                                                                          |
| P-Settings     | dropped by decision 4                                                                                                                                                       |
| P-Close        | no phase: the `docs/mcp-compatibility.md` built-in column belongs to Phase 2; CHANGELOG, README and PROJECT.md decision lines are parent lines applied at merge            |

### Phase 1: Foundation (serial, one session; everything below freezes after it)

**Rationale:** Every parallel phase needs the same types, harness, closed set and wiring. Landing them first removes the merge conflicts. No visible behavior change, so the phase stays green.

**Delivers (internal waves):**

1. Wave 1, Pi 1.5.0: dev and peer pins, lock, `peer-floor.test.ts`, e2e floor fixture and lock, `pi-json-output` asserts, `pi-api.ts` type fixes, PROJECT.md peer line. Re-run the untrusted-profile scenarios (the `isProjectTrusted()` fix may flip them).
2. Wave 2, in parallel: (a) domain seam: `mcp-implementation.ts`, split of `classifyMcpServer` into a Claude-shape check and per-profile scanners, `"sse"`, `mcp-builtin-features.ts`, `builtinMcpServerName`; (b) one closed-set commit adding the reason `"requires MCP support"` (wording per the messaging style guide, telling the user to turn on built-in MCP or install pi-mcp-adapter) across `notification-types.ts`, `REASONS`, `notify-reasons.ts`, the lock test, `docs/json-output.md`, catalog counters; (c) cucumber harness: `cucumber.json` `adapter` and `builtin` profiles over `@mcp`, world parameter, shared "MCP implementation" step, `--no-mcp` for `none` in `piArguments`, `check-features.mjs` tags (`@adapter-only`, `@builtin-only`), shard test with a `(profile, path)` axis, `ci.yml` matrix, a profile assertion, an architecture test that no `@mcp` scenario names the adapter literally, and the MCP-07 agent scenario split into `agent-grants.feature`.
3. Wave 3: `platform/pi-api.ts` (snapshot field `mcpImplementation`, `hasLoadedBuiltinMcp`, `PiMcpRegistry`, MCP config types); `persistence/state-io.ts` `mcpServerConfigs?`; resolver producer `declaredMcpServers`; `statePhase` writes the field; `orchestrators/mcp/{session-materialize,recorded-servers}.ts` with no-op step seeds (`builtin-registration-step`, `agent-grants-step`); `platform/mcp-builtin-status.ts` seed; `EdgeDeps.mcpStatus {adapter, builtin}`; `index.ts` wiring (session_start order and the second sync after `loadReconcile`); a ban on factory-time probes.
4. Wave 4: `npm run check`, both cucumber profiles, decisions, parent lines. Features that fail under built-in are tagged `@adapter-only` until their owning phase removes the tag.

**Frozen files:** `package.json`, lock, `ci.yml`, `cucumber.json`, `scripts/check-features.mjs`, `scripts/install-test-peers.mjs`, `test/e2e/_rpc.ts`, `features/support/**`, the shared `features/lib/*` and step modules, `platform/pi-api.ts`, `domain/mcp-implementation.ts`, `mcp-server-features.ts`, `mcp-builtin-features.ts`, `domain/name.ts` MCP functions, `persistence/state-io.ts`, `orchestrators/mcp/{session-materialize,recorded-servers}.ts`, `index.ts`, `edge/register.ts`, the closed-set reason files, `.fallowrc.json`, `rule-packs/architecture.json`. Under decision 4 no rule-pack or `persistence/locations.ts` settings change is needed.

**Frozen cross-phase interfaces:** `McpImplementationProfile`, `ActiveMcpImplementation`, `profileFor`, `effectiveMcpCompatibility`; `SoftDepStatus.mcpImplementation` with adapter, builtin, none precedence; `mcpServerConfigs?: {name, config}[]` (pre-substitution Claude form) and `recordedMcpServers(record, reader)`; `resolved.declaredMcpServers`; step contracts (`builtinRegistrationStep`, `resyncBuiltinRegistrations`, `agentGrantsStep`, each `Promise<void>` and never throwing); `PiMcpRegistry` and `McpStatusReader.lookup(serverName)`; `EdgeDeps.mcpStatus`; the world parameter, tags and step wording; the reason literal.

**Avoids:** pitfalls 3, 4 (seed), 8, 12, 13, 19, 20, 21.

### Phase 2: Built-in materialization (parallel; `features/mcp-builtin-phase-2`)

**Rationale:** The core user value: servers actually connect under built-in.

**Delivers:** `domain/mcp-builtin-translation.ts`; `bridges/mcp/builtin-{entry,escape,registration}.ts`; `substitute.ts` encoder parameter; `orchestrators/mcp/builtin-registration-step.ts`; per-registration trust gating; decision-2 exposure; collision and override reporting; legacy `mcp.json` entries reported as overridden (the AMIG-01 move runs too late for the first built-in session); the `docs/mcp-compatibility.md` built-in column.

**Owns:** the files above plus `features/mcp-server/{listing,configuration,sources,project-scope,lifecycle,invocation}.feature` and steps, new `implementation-switch.feature`, `features/lib/mcp-server-*`. It removes the `@adapter-only` tags on those files.

**Must not touch:** resolver, compatibility readers, agents, hooks, frozen files.

**Avoids:** pitfalls 4, 5, 6, 7, 14, 15, 17 (register at `session_start` only, so the ledger stays disk-only).

### Phase 3: Read-time verdicts, markers, list and info (parallel; `features/mcp-builtin-phase-3`)

**Rationale:** The semantic change touching the most shared orchestrator files. Start it first, merge it last.

**Delivers:** neutral stored state, effective compatibility, the split consent gate, markers and `requires:` per implementation (`none` shows `requires MCP support`), the built-in status reader and tokens, `info-mcp-status.ts`, `companionSeverity`, convergence and `mcp-migration.ts` made profile-explicit.

**Owns:** `domain/mcp-resolution.ts`, `plugin-resolver.ts`, `resolver-types.ts`; the `install-outcome.ts` gate at `:840` only; `update-preflight.ts:514-516`; `list-installed-row.ts`; `plugin-state-classifier.ts`; `info.ts` compatibility functions; `info-mcp-status.ts`; `platform/mcp-builtin-status.ts`; `shared/concerns/soft-dep.ts` MCP arm; `shared/notify-reasons.ts`; the `partial` sites (`enable-disable`, `install-cascade`, `install-flow-results`, `update-swap`, `import/execute`, each in its own function); `reconcile/{convergence,mcp-migration}.ts`; `features/mcp-server/{companion-missing,invalid-configs}.feature`.

**Must not touch:** `bridges/**`, `orchestrators/mcp/*` steps, frozen files.

**Avoids:** pitfalls 8, 9.

### Phase 4: Agent grants (parallel; `features/mcp-builtin-phase-4`)

**Rationale:** Disjoint from Phases 2, 3 and 5; needs only the profile's `grantSelector`.

**Delivers:** grant selector and async warning per implementation in `bridges/agents/convert.ts`; optional `mcpImplementation` per agents-index row; `agent-grants-step.ts` rewriting changed rows from `sourcePath` under the scope's state lock, skipping untrusted projects and doing nothing under `none`; `agentsPhase` only in `install-outcome.ts` (`:1300-1330`).

**Owns:** `bridges/agents/convert.ts`, `persistence/agents-index-schema.ts` (and `agents-index-io.ts` if needed), `orchestrators/mcp/agent-grants-step.ts`, unit pairs, `features/mcp-server/agent-grants.feature`.

**Must not touch:** `bridges/mcp/**`, `bridges/hooks/**`, verdict readers.

**Avoids:** pitfall 10 (write only when bytes differ, skip on `StateLockHeldError`, stage then commit, compute grants from servers that actually registered).

### Phase 5: Hook and tool naming (parallel; `features/mcp-builtin-phase-5`; small, may share Phase 4's session)

**Rationale:** Touches only `bridges/hooks/dispatch.ts`.

**Delivers:** `isMcpProxyCall` gated on the adapter; hooks on built-in tool names (`mcp__plugin_<p>_<s>__<t>`); the `-` divergence recorded and pinned by a scenario; D1 server-segment restoration if the user rules parity applies.

**Owns:** `bridges/hooks/dispatch.ts` (proxy function and callers), `docs/hooks-compatibility.md` MCP row, `features/hook/mcp-tool-names.feature` and steps.

**Avoids:** pitfall 7 (hook half).

### Phase Ordering Rationale

- One serial phase freezes shared files and interfaces; the parallel phases then own disjoint files. Maximum concurrency is 4 child sessions (3 if Phase 5 joins Phase 4). Dropping the settings phase cut one session and the riskiest write path.
- The record producer is in Phase 1 (additive, no output change) because Phases 2 and 3 both need records that hold every server.
- Merge order, lowest conflict first: 5, 4, 2, then 3 last. After Phase 3 merges, re-verify Phase 2's switch scenario. Rerun `npx fallow dupes` after merging Phase 2 (the built-in and adapter entry and escape modules are likely clone pairs needing reviewed markers).
- Children never edit `CHANGELOG.md`, READMEs, PROJECT.md decisions or `BACKLOG.md`; they list "Parent lines". Closed sets are append-only. Every user-visible change ships a cucumber scenario that fails without it, under the profile(s) where it applies. Phase gates run `npm run check` plus both cucumber profiles. Every child brief carries the environment facts from PITFALLS 18 (root DAC wrapper, warm ESLint, worktree hook caveat).

### Research Flags

Needs deeper research or a user ruling during planning:

- **Phase 2:** how Claude Code resolves `cwd` and variables for plugin stdio servers; write `${VAR}` references or values (secrets visible via `getMcpServers()`); ms-to-s rounding; whether built-in lists deferred tools in `getAllTools()` before `tool_search` (status reader); first-session legacy `mcp.json` ordering.
- **Phase 3:** the meaning of `none` (see Gaps); the status-token set.
- **Phase 4:** how to detect a pi-subagents background child so it never rewrites agents; whether subagent launches re-read agent files or use the session snapshot.
- **Phase 1:** the 64-character tool-name hash rule in the naming module; the profile-tag architecture test.

Standard patterns (skip research-phase): Phase 5 (one function, existing hooks tests); Phase 1 waves 1 and 2(b) (mechanical bump and closed-set commit).

## Confidence Assessment

| Area         | Confidence    | Notes                                                                                                                                                                              |
| ------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH          | Read from the 1.5.0, adapter 7.0.0 and subagents 0.84.0 tarballs and diffed against 1.4.0. Handler ordering between our `session_start` and Pi's is inferred (both orders are safe). |
| Features     | HIGH / MEDIUM | Field and transport verdicts from the Claude Code 2.1.318 binary and package sources (HIGH). Wording and switch UX are recommendations with no upstream counterpart (MEDIUM).      |
| Architecture | HIGH / MEDIUM | Integration map and Pi event order read from source (HIGH). The phase split is judgment built on the component-features precedent (MEDIUM).                                       |
| Pitfalls     | HIGH          | Primary-source reads; pi-subagents behaviors rest on docs not run (MEDIUM). The Claude `cwd` rule is LOW; the compat-research skill was not run for Claude claims.                |

**Overall confidence:** HIGH for what to build; MEDIUM for how the parallel phases will merge.

### Gaps to Address

The decision-1 gaps are closed by decision 4. Remaining open questions for the user (carry into requirements and phase discuss steps):

- **APL-D1 amendment:** may a load rewrite generated agent files (Phase 4)? Without it, the rewrite must be an `apply` or reload-time-only step. Record a decision ID, like AMIG-01.
- **What is recorded:** research recommends the Claude form before substitution (derive `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR` at materialization), not "after substitution" as the brief says. Confirm the deviation.
- **`--partial` consent at read time:** ask only at user-initiated install and update (effective value), never on enable, convergence or reinstall. Confirm.
- **The "none" verdict rule:** decision 4 says plugins are partially available because they require MCP. FEATURES recommended the union rule (blocked only if neither implementation can run the server) with an install allowed under a marker. Decide whether `install` under `none` needs `--partial`, and whether `list` shows `(partially-available)` or only a marker.
- **Hook matchers (D1):** restore `-` in the server segment under built-in? The extension owns that half, so only the tool segment is licensed as a Pi gap.
- **Project-trust weakness:** `isProjectTrusted()` auto-trusts a repository whose `.pi/` has none of Pi's protected entries, so a committed project `state.json` could launch stdio commands with no prompt. Accept, or add a stronger gate.
- **Background subagent children:** they load the extension and run its `session_start` steps. Confirm that a child never rewrites agents and registers only for itself (trust-gated).
- **Registration timing:** register at `session_start` and again after `loadReconcile` (recommended; keeps the ledger disk-only and the reload hint uniform), or also immediately on install (D2).
- **OAuth client name:** set `oauth.clientName: "Claude Code (<server>)"` for parity? No license covers leaving it unset.
- **Smaller:** a load warning row per plugin that becomes partial after a switch; reduced built-in status tokens; the AMIG notice for legacy entries needs a built-in variant; marker wording; CHANGELOG must record the `{requires pi-mcp-adapter}` reason removal (breaking JSON output).

## Sources

### Primary (HIGH confidence)

- `@earendil-works/pi-coding-agent@1.5.0` tarball (docs `mcp.md`, `extensions.md`, `settings.md`, `security.md`; `dist/core/{mcp-servers,resolve-config-value,agent-session,resource-loader,package-manager}.*`; `dist/core/extensions/{runner,loader,types}`; `dist/extensions/mcp/*`) and installed 1.4.0 (diffed).
- `pi-mcp-adapter@7.0.0` (`index.ts`, `pi-builtin-mcp.ts`, `onboarding-state.ts`), `pi-subagents@0.84.0` (`docs/agents.md`, `CHANGELOG.md`), `@earendil-works/pi-mcp@1.5.0`, `pi-ai`/`pi-tui@1.5.0`.
- Claude Code 2.1.318 binary strings (FEATURES CC-1..CC-10).
- This tree: `index.ts`, `platform/pi-api.ts`, `domain/{mcp-server-features,mcp-resolution,plugin-resolver,name}.ts`, `bridges/{mcp,agents,hooks}/*`, `persistence/state-io.ts`, `.fallowrc.json`, `cucumber.json`, `test/e2e/_rpc.ts`.
- `.planning/inputs/mcp-builtin/BRIEF.md` (including Amendments) and `.planning/PROJECT.md` (Current Milestone, decisions 1-4).

### Secondary (MEDIUM confidence)

- Precedent: `.planning/milestones/component-features-ROADMAP.md` and `.planning/CHILD-SESSION-BRIEF.md`.
- pi-subagents docs (not run).

### Tertiary (LOW confidence)

- Adapter `[Unreleased]` changelog via WebFetch; the Claude Code `cwd` rule for stdio servers; codemode skipping hooks.

---

*Research completed: 2026-11-04*
*Ready for roadmap: yes*
