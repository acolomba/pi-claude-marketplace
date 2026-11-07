---
quick_id: 261106-u9b
phase: quick-261106-u9b
plan: 01
subsystem: mcp
status: complete
tags: [mcp, types, soft-dependency, debug-trace, parity]
requires: []
provides:
  - "RunEvery four-state type for McpDependency.runEvery (shared/concerns/soft-dep.ts)"
  - "AdapterMcpProfile and the profileFor(\"adapter\") overload (domain/mcp-implementation.ts)"
  - "readonly SoftDepStatus and the mcp-tag trace of a failed probe read (platform/pi-api.ts)"
  - "Claude Code object order for droppedMcpServers (domain/mcp-resolution.ts)"
affects: [orchestrators/plugin/mcp-verdict.ts, bridges/agents/grant-forms.ts, docs/messaging-style-guide.md]
tech-stack:
  added: []
  patterns: ["function overload for a narrower return type (resolutionFor precedent)", "module-level @ts-expect-error readonly proof"]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/domain/mcp-implementation.ts
    - extensions/pi-claude-marketplace/bridges/agents/grant-forms.ts
    - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
    - docs/messaging-style-guide.md
    - test/shared/concerns/soft-dep.test.ts
    - test/orchestrators/plugin/mcp-verdict.test.ts
    - test/platform/pi-api.test.ts
    - test/domain/mcp-implementation.test.ts
    - test/domain/mcp-resolution.test.ts
    - "33 test files and 4 catalog fixtures: runEvery values only"
decisions:
  - "McpDependency.runEvery is RunEvery (both | adapter | builtin | split); mcp-verdict.ts picks the state and soft-dep.ts indexes MCP_NAME_TABLE by it (D-P3-10, D-MB-07)"
  - "profileFor(\"adapter\") returns AdapterMcpProfile, whose toolNamePrefix returns string (ANAME-01, D-MB-13)"
  - "Each MCP read the soft-dependency probe swallows writes one [mcp] debug line (OBS-01, RECON-05)"
  - "recordMergedServers loops over Object.entries(Object.fromEntries(merge.servers)), so droppedMcpServers follows Claude Code's object order (D-CF6-01)"
metrics:
  duration: "about 1h45m"
  completed: 2026-11-07
estimate: null
actuals:
  tokens: 23000
  tasks: 3
  commits: 3
plan_head_before: abfecc956bf961be4e59a4e65b974a553e587853
plan_head_after: a0ee2385d8f0274d6cb4311644af61c62290bb43
---

# Quick 261106-u9b: MCP domain and soft-dependency types (REVIEWSUGG-01 types part) Summary

`McpDependency.runEvery` now holds one of four named states picked by its one producer. `SoftDepStatus` is read-only. The adapter profile's type promises a tool prefix. The agent stage handles `none` explicitly. A failed MCP probe read writes one `mcp` debug line. The neutral dropped-server list follows Claude Code's object-spread order. No user-visible change.

- BASE: `abfecc956bf961be4e59a4e65b974a553e587853` (the worktree started at `bdbb5f2` on `main` and was fast-forwarded to `abfecc9` before any work).
- Worktree: `/home/user/pi-claude-marketplace/.claude/worktrees/agent-ac97f2734f1ead9b0`, branch `worktree-agent-ac97f2734f1ead9b0`.

## Commits

| Task | Commit | Title |
|---|---|---|
| 1 | `d5841d8` | refactor(mcp): name the four runEvery states of an MCP dependency |
| 2 | `257aa76` | refactor(mcp): tighten the probe snapshot and the adapter profile types |
| 3 | `a0ee238` | fix(mcp): keep Claude Code's object order for dropped MCP servers |

## Red and green runs

### Task 1

- RED: `npm run typecheck`, exit 2:
  - `test/shared/concerns/soft-dep.test.ts(28,22): error TS2322: Type 'string' is not assignable to type 'readonly McpImplementationId[]'.` (the `"split"` proof; with `satisfies` on an object literal, TypeScript reports the field's TS2322 rather than TS1360)
  - `test/shared/concerns/soft-dep.test.ts(30,1): error TS2578: Unused '@ts-expect-error' directive.` (the list proof)
- GREEN:
  - `npm run typecheck`: exit 0.
  - `node --test` on the seven owner and consumer suites in the verify block: 417/417 pass.
  - `test:coverage:direct` for `soft-dep.ts` and for `mcp-verdict.ts`: exit 0 (100%).
  - `npm run test:modules`: exit 0. `npm run test:unpaired`: exit 0. `npm run test:integration`: exit 0.
  - Cucumber `verdict-markers`, `verdict-info`, and `companion-missing`: adapter 21/21 scenarios, builtin 15/15.
  - The grep checks pass, and `grep -rnF 'runEvery: [' extensions test features` finds 0 lines.
  - The commit hook (`check:commit`, every pair, because the commit stages fixtures) passed.
- Mapping: the fixed-string replace changed 139 values in 35 files: 26 `["adapter", "builtin"]` to `"both"`, 94 `["adapter"]` to `"adapter"`, 14 `["builtin"]` to `"builtin"`, and 5 `[]` to `"split"`. This matches the planner's count. No sibling added a list value.
- `fallow dead-code --type-aware --symbol-impact ...soft-dep.ts:McpDependency`: 11 production modules use the type. Only `mcp-verdict.ts` builds a value (`grep runEvery extensions`), and only `soft-dep.ts` reads `runEvery`.

### Task 2

- RED:
  - `npm run typecheck`, exit 2: TS2578 on each of the three readonly proof lines (`test/platform/pi-api.test.ts` 254, 256, 258), and `test/domain/mcp-implementation.test.ts(20,44): error TS1360: Type '(plugin: string, server: string) => string | undefined' does not satisfy the expected type '(plugin: string, server: string) => string'.`
  - `node --test --test-name-pattern OBS-01 test/platform/pi-api.test.ts`, exit 1: the four rows that expect lines fail; the no-line row passes.
- GREEN:
  - `npm run typecheck`: exit 0.
  - The seven suites of the verify block: 545/545 pass. `test/bridges/hooks/mcp-tool-view.test.ts`, which holds the R1, R2, and L1 read counts: 20/20 pass, with no count change, because the probe's reads are unchanged.
  - `test:coverage:direct` for `pi-api.ts`, `mcp-implementation.ts`, and `grant-forms.ts`: exit 0 each.
  - `npm run fallow` (dead code, cycles, health, dupes): exit 0. No cycle through `shared/errors.ts`.
  - ESLint on the five files: exit 0. All seven grep checks pass.
  - Cucumber `agent-grants` and `implementation-profiles`: adapter 18/18, builtin 7/7.
  - The commit hook passed.
- The lines, as the case pins them:
  - `getCommands()` throws: `[mcp] soft-dependency probe: pi.getCommands() failed: not ready`
  - `getAllTools()` throws: `[mcp] soft-dependency probe: the pi-mcp-adapter tool check failed: not ready`
  - Both throw: the `getCommands()` line, then the tool-check line.
  - A command whose `source` getter throws: `... the pi-mcp-adapter command check failed: source unreadable`, then `... the built-in MCP command check failed: source unreadable`.
  - Every read succeeds: no line, status `adapter`.

### Task 3

- RED: `node --test test/domain/mcp-resolution.test.ts` (the new case), exit 1. Only `dropped` differs: the actual order is `b`, `2` and the expected order is `2`, `b`.
- GREEN:
  - mcp-resolution, plugin-resolver, and recorded-servers suites: 302/302 pass.
  - `test:coverage:direct` for `mcp-resolution.ts`: exit 0.
  - `npm run typecheck`: exit 0. ESLint on both files: exit 0.
  - Cucumber `sources.feature`: adapter 7/7, builtin 10/10.
  - The commit hook passed.
- The first typecheck after GREEN failed: `emptyResolution()` does not type `droppedMcpServers`. The case now declares its local as `McpResolution` with a type-only import. No other case changed.

`git status` is clean after Task 3.

## Evidence record

- **Question:** In what order does Claude Code keep a plugin's merged MCP servers when some server names are integer-like?
- **Claude Code behavior:** It merges with object spread: `.mcp.json` first, then the manifest's `mcpServers` (`z={...z,...Ae}`, then `z={...z,...Ne}`). So it uses JS property order: integer-like names first in ascending order, then the other names in first-insertion order. A replaced name keeps its first position.
- **Evidence:**
  - `claude --version` gave `2.1.319 (Claude Code)` on 2026-11-07. `grep -oa '.\{0,160\}"\.mcp\.json",[a-zA-Z_$]\{1,4\},{confine.\{0,220\}' /opt/claude-code/bin/claude | head -2` matched:
    `Ae=ne||await jpt(e,".mcp.json",n)?null:await Wpt(e,".mcp.json",r,{confine:ke});if(Ae)z={...z,...Ae};if(e.manifest.mcpServers){let He=e.manifest.mcpServers;if(typeof He==="string")if(Ce(He)||await jpt(e,He,n));else if(mH(He)){let Ne=await t2n(e,He,n,Y,r,s);if(Ne)z={...z,...Ne}}else{let Ne=awai`
  - `.planning/milestones/component-features-phases/06-mcp-servers/06-RESEARCH.md` line 213 records the same merge for 2.1.316 (`G={...G,...Ee}`), and line 412 records that a replaced name keeps its first position.
- **Confidence:** high. The installed binary shows object spread, and ECMAScript fixes the property order that spread gives.
- **Unresolved:** none for the order. No sandboxed probe ran, because the binary text settles it.
- **Constraints:** none. The resolver already builds `Record`s, which follow the same order.
- **Divergence:** none. The neutral `droppedMcpServers` was the one list in `Map` order. It now follows the object order too.

### Order sites (each left as it is: it reads a `Record`, so it already has Claude Code's order)

- `domain/mcp-resolution.ts` `recordMergedServers`: `declaredMcpServers` and `mcpServers` were already in object order. `droppedMcpServers` is the one list aligned in this item.
- `persistence/state-io.ts` `mcpServerConfigsOf` (the saved `mcpServerConfigs`).
- `domain/plugin-resolver.ts` `resolutionFor` (it rebuilds the dropped list from `declaredMcpServers`).
- `orchestrators/mcp/recorded-servers.ts` (the legacy re-resolution, `Object.entries(resolved.declaredMcpServers)`).
- `orchestrators/plugin/install-outcome.ts` and `orchestrators/plugin/update-swap.ts` (the adapter server names an agent maps).
- `bridges/agents/grant-forms.ts` `serverNamesFor` (`Object.entries(declaredMcpServers)`).
- `orchestrators/plugin/info.ts` (info's server entries).
- Sites the grep adds that walk a plugin's servers:
  - `bridges/mcp/stage.ts` (`Object.entries` of the staged and keyed server maps)
  - `bridges/mcp/adapter-entry.ts` (`input.servers`)
  - `bridges/mcp/collision-slots.ts`
- Not a plugin's merged servers: `bridges/mcp/adapter-doc.ts` and `bridges/mcp/legacy.ts` walk the adapter document's entries, which are keyed `plugin_<plugin>_<server>` and so never integer-like. `bridges/mcp/builtin-overrides.ts` walks Pi's own `mcp.json`. `orchestrators/mcp/builtin-registration-step.ts` walks the marketplaces and plugins of the state.

## Backlog dispositions

| # | Point | Disposition | Commit |
|---|---|---|---|
| 1 | `McpDependency.runEvery` was a list that encoded four states | **fixed**: closed union `RunEvery`. `runEveryOf` in `mcp-verdict.ts` picks the state, and `MCP_NAME_TABLE[declaresMcp.runEvery]` reads it with no decoder. A list value fails typecheck. | `d5841d8` |
| 2 | `toolNamePrefix` returned `string \| undefined` for the adapter | **fixed**: `AdapterMcpProfile` and the overload `profileFor(id: "adapter"): AdapterMcpProfile` | `257aa76` |
| 3 | A `Record` reorders integer-like server names | **left**, for parity. Claude Code 2.1.319 merges by object spread, so its order is the `Record`'s order (evidence record above). The one list built outside a `Record`, the neutral `droppedMcpServers`, now follows the same order, and a D-CF6-01 case pins it. | `a0ee238` |
| 4 | `SoftDepStatus` fields were mutable | **fixed**: readonly members and the `proveSoftDepStatusReadonly` compile-time proof | `257aa76` |
| 5 | A new consumer can read `none` as the adapter | **fixed** in the agent stage: `bridges/agents/grant-forms.ts` `fileForm` names `none` and writes the adapter form (MGRT-01). The two `McpStatusLookup` reads (`orchestrators/plugin/info.ts` and `orchestrators/plugin/info-mcp-status.ts`) belong to 261106-u97. Its merged lookup already has an explicit `none` arm, per the coordinator, and this item did not touch either file. | `257aa76` |
| 6 | `mcpBundle` is `Type.Optional(Type.Literal(true))` | **left**. The schema is the saved `state.json` form, and `true` or absent is exactly that form. A boolean would let this release write `false`, which an earlier release refuses to load (`test/persistence/state-io.test.ts` accepts `true` and refuses `false`). Every reader already turns it into a `boolean`: `orchestrators/mcp/recorded-servers.ts` (two reads), `domain/plugin-resolver.ts`, and `orchestrators/plugin/update-preflight.ts` (two reads). | none |
| 7 | The probe swallowed a read error with no trace | **fixed**: each MCP read the probe swallows (`pi.getCommands()`, the pi-mcp-adapter command and tool checks, the built-in MCP command check) writes one `[mcp]` debug line through `hookDebugLog` and `errorMessage` | `257aa76` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The D-CF6-01 case's local needed the `McpResolution` type**
- **Found during:** Task 3, the typecheck after GREEN.
- **Issue:** `emptyResolution()` returns a type with no `droppedMcpServers`, so `resolution.droppedMcpServers` did not type-check.
- **Fix:** a type-only import of `McpResolution` and an annotation on the new case's local. The helper and the other cases did not change.
- **Files modified:** `test/domain/mcp-resolution.test.ts`
- **Commit:** `a0ee238`

**2. [Adaptation] The Task 2 `none` arm, after 261106-u95's rewrite**
- After u95, `grant-forms.ts` read `grantForms.active === "builtin" ? "builtin" : "adapter"` (line 60). The explicit arm is now `grantForms.active === "none" ? "adapter" : grantForms.active`, with a one-line MGRT-01 reason. Nothing else in the file changed.

Other notes:
- The comment on `IMPLEMENTATIONS` in `mcp-verdict.ts` now says that it is the order in which the profiles are asked about a server.
- `docs/output-catalog.md` line 69 still reads true for the states, so it is unchanged.
- A second title in `mcp-verdict.test.ts` ("runEvery keeps only the implementations ...") described list membership, so it now reads "runEvery names the one implementation that runs every server".

## Questionable choices

| Choice | Alternative not taken | Why questionable | Severity |
|---|---|---|---|
| 1. `RunEvery` uses the words the code already used (`both`, `adapter`, `builtin`, `split`), and the field keeps the name `runEvery` | Rename the field, for example to `runners` | `runEvery: "split"` reads a little oddly: no implementation runs every server | low |
| 2. The producer picks the state (`runEveryOf`, module-private in `mcp-verdict.ts`), and the reader indexes the table directly | Keep the list and decode it in `soft-dep.ts`; or use a closed tuple union | A tuple union keeps the list and its decoder, and `includes` does not type-check on a union that holds the empty tuple. Decoding at the producer puts the logic where the run sets are known. | low |
| 3. `toolNamePrefix` uses interface extension (`AdapterMcpProfile`) and an overload | A generic or conditional profile type (`ProfileOf<Id>`) | `rules/types.md` prefers interface extension and uses mapped or conditional types sparingly. No production reader uses the narrower type yet, so for now the type only states the guarantee. | low |
| 4. `SoftDepStatus` gets readonly members only, and the snapshot object is not frozen | `Object.freeze` the snapshot | A cast or a write through a mutable alias can still change it at run time. No code writes to one today. | low |
| 5. The `none` fix covers only `grant-forms.ts` | Also change the two `McpStatusLookup` reads | 261106-u97 owns those reads and rebuilt the lookup with a `none` arm. This item depends on that hand-off. | low |
| 6. The probe traces MCP reads only, on the `mcp` tag (`getCommands()` and the three MCP checks, through a `check` name on `probeArm`). The pi-subagents and workflow-engine checks keep silent catches. | Trace every probe catch, on its own tag | A `getAllTools()` failure is traced once, by the pi-mcp-adapter tool check, not three times. A failure in only the pi-subagents or workflow call, a case Pi does not produce for one read, leaves no line. | low |
| 7. `recordMergedServers` loops over `Object.entries(Object.fromEntries(merge.servers))` | Look each name up in the `Map` with `?.`; or sort the `Map` keys by hand | The loop builds an extra object. The `?.` form adds a branch no case reaches, which costs direct coverage. | low |
| 8. `mcpBundle` stays `Type.Optional(Type.Literal(true))`, and no shared writer is added | A boolean schema; or a shared presence-flag writer such as `replaceCompatibility` | A boolean would let this release save `false`, which an earlier release cannot load. A shared writer changes no type and touches three sibling-heavy orchestrator files. | low |
| 9. (executor) The trace text is `soft-dependency probe: the <check> check failed: <message>`, and `pi.getCommands() failed: <message>` for the shared read | The planner's scratch wording without "the" and "check" | Wording only. The unit case pins it, and no scenario reads it. | low |
| 10. (executor) The "a listed command cannot report its source" row uses a getter that throws | A `Proxy`; or a stubbed `some` | A getter on a plain object literal is the smallest double that makes both command checks throw while `getCommands()` succeeds | low |
| 11. (executor) The new D-CF6-01 case types its local as `McpResolution` (type-only import) | Widen `emptyResolution()` for every case | The narrow change touches only the new case | low |

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Cross-item notes

- The two `none`-to-adapter reads in `orchestrators/plugin/info.ts` and `orchestrators/plugin/info-mcp-status.ts` belong to 261106-u97. Per the coordinator, u97 already gave `McpStatusLookup` an explicit `none` arm. This item did not touch either file.
- No sibling added a list-form `runEvery` value. The 139 values at `abfecc9` were the four list spellings, each mapped to its state.
- 261106-u98's hooks-view read counts (R1, R2, L1 in `test/bridges/hooks/mcp-tool-view.test.ts`) are unchanged: the probe still reads `getCommands()` once and `getAllTools()` three times, and that suite passes 20/20.
- Post-merge check for the coordinator: `grep -rnF 'runEvery: [' extensions test features` must find nothing on the combined tree. It finds nothing on this branch.
- `npm run check` on the merged tree is the coordinator's gate. This item does not claim it.

## Parent lines

- `.planning/BACKLOG.md` REVIEWSUGG-01 (line 5013): 261106-u9b settles the types part. Points 1, 2, 4, and 7 are fixed. Point 5 is fixed in the agent stage, and its two status-lookup reads go to 261106-u97. Points 3 and 6 are left, with the reasons above.
- `.planning/milestones/mcp-builtin-phases/01-foundation-and-pi-1-5-0/01-FROZEN.md`:
  - Section 1 (lines 120-128 and 163-169): `AdapterMcpProfile` and the overload `profileFor(id: "adapter"): AdapterMcpProfile`, amended after the milestone (REVIEWSUGG-01).
  - Section 2 (lines 186-212): `SoftDepStatus` is readonly, and a throwing `getCommands()` or MCP check writes one `mcp` debug line (P1-DC-29 amended).
- No CHANGELOG line: no user-visible change.

## Self-Check: PASSED

- Files: `soft-dep.ts` contains `export type RunEvery`; `mcp-verdict.ts` contains `runEveryOf`; `pi-api.ts` contains `hookDebugLog(`; `mcp-implementation.ts` contains `export function profileFor(id: "adapter"): AdapterMcpProfile;`; `mcp-resolution.test.ts` contains `integer-like`.
- Commits `d5841d8`, `257aa76`, and `a0ee238` are ancestors of HEAD (`git rev-list --count abfecc9..HEAD` = 3).
