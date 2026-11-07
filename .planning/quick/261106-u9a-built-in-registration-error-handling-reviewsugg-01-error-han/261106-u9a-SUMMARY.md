---
phase: quick-261106-u9a
plan: 01
quick_id: 261106-u9a
subsystem: mcp-builtin-registration
status: complete
tags: [mcp, builtin-mcp, registration, info, debug-log, cucumber]
requires: []
provides:
  - "One built-in registration per Pi namespace, decided in declaration order as a fresh session decides (same name: the later server in place; another -/_ spelling: the first server keeps it)"
  - "BuiltinServerOwner.server, the declared server name; info compares it in ownedElsewhere"
  - "One mcp-channel debug line per left-out registration, per failed mcp.json read or parse, and per failed description source read or parse"
  - "Owners noted only after syncBuiltinRegistrations returns"
affects:
  - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
  - extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-description.ts
tech-stack:
  added: []
  patterns:
    - "a mutable slot per namespace, so a left-out registration is logged against the final holder with no unreachable undefined branch"
    - "a candidate read that carries its failure reason; only the deciding candidate is traced"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
    - extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-registration.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-description.ts
    - test/orchestrators/mcp/builtin-registration-step.test.ts
    - test/platform/mcp-builtin-status.test.ts
    - test/orchestrators/plugin/info-mcp-status.test.ts
    - test/bridges/mcp/builtin-registration.test.ts
    - test/bridges/mcp/builtin-overrides.test.ts
    - test/bridges/mcp/builtin-description.test.ts
    - features/mcp-server/builtin-status.feature
    - docs/mcp-compatibility.md
decisions:
  - "Same registered name: the server declared later registers in the earlier one's place (D-MB-13, D-MB-23, Claude Code's Object.assign merge)"
  - "Names that differ only by - and _: the server declared first keeps the Pi namespace, as Pi's clash check decides at a fresh session (ANAME-03)"
  - "A left-out spelling gets its holder as owner in the owner map, so info reads it as not loaded"
  - "Owners are noted after the sync returns (ASTAT-01); a failed unregister stays debug-only and is retried by the next sync (D-MB-12, confirmed, no code change)"
  - "mcp.json and description read or parse failures leave one mcp-channel debug line with a fixed phrase for parse failures; a missing file stays silent"
metrics:
  duration: "about 95 minutes"
  completed: 2026-11-07
actuals:
  tokens: 25000
  tasks: 3
  commits: 3
plan_head_before: abfecc956bf961be4e59a4e65b974a553e587853
plan_head_after: 08bcd3e589519c5c04b8610ee8aca10e93d16c14
---

# Quick 261106-u9a: Built-in registration error handling Summary

Under Pi's built-in MCP, the registration step now registers one server per Pi namespace in declaration order, as a fresh session would. It logs each server it leaves out, and info reads that server as `not loaded`. Owners are noted only after a sync that reached Pi's registry. The `mcp.json` reader and the description reader now leave one debug line per swallowed read or parse failure, and the line never quotes the file.

- Worktree: `/home/user/pi-claude-marketplace/.claude/worktrees/agent-ad1dd433f93c12e4a`
- Branch: `worktree-agent-ad1dd433f93c12e4a`
- BASE: `abfecc956bf961be4e59a4e65b974a553e587853` (`features/mcp-builtin` head after u95 to u99 merged; the worktree was created from `main` and fast-forwarded with `git merge --ff-only abfecc9`)

## Commits

| Task | Commit    | Title                                                         |
| ---- | --------- | ------------------------------------------------------------- |
| 1    | `9622e20` | fix(mcp): register one built-in server per name, the later one |
| 2    | `bd42787` | fix(mcp): keep one built-in server per Pi tool namespace      |
| 3    | `08bcd3e` | fix(mcp): log failed reads of mcp.json and description sources |

Each commit's pre-commit stage ran `npm run check:commit` and passed. The "(no files to check) Skipped" lines in the same output come from the commit-msg stage.

## Adaptations to the merged siblings

- u96: `recordRegistrations` now calls `recordedMcpServers(legacyServersSourceFor(...), readLegacyServers)` and words the unreadable line from `recorded.reason`. This plan does not touch that function. `serverRegistrations` takes a record-level owner (`RecordOwner = Omit<BuiltinServerOwner, "server">`), and the call site in `recordRegistrations` was unchanged because the literal it passes already has that shape.
- u97: `info-mcp-status.ts` takes the `McpStatusLookup` union, and `builtinStatus` receives `lookup.reader` from the builtin arm. `ownedElsewhere` gained the `server` parameter in that shape. The info suite's `builtinLookup(t, reader, trusted)` returns `{ lookup, environment }`, and I-T1 uses it. u97's scenario ("status unknown when Pi's tool list cannot be read") was the last scenario of `builtin-status.feature`, so S1 and S2 come after it. The reader guard in `platform/mcp-builtin-status.ts` was kept. Only the owner type and its comment changed there.
- The plan's line numbers were stale after the merges. Every edit was made against the merged file.

## Claude Code parity record (Design 7)

Claude Code 2.1.319 (`/opt/claude-code/bin/claude --version` prints `2.1.319 (Claude Code)`), observed 2026-11-07:

- `grep -c 'function bQo(e,n,r,s,h=!1){let y={},S=E\$(n,r);for(let\[w,H\]of Object.entries(e)){let z=.plugin:\${S}:\${w}.' /opt/claude-code/bin/claude` printed `1`.
- `grep -c 'for(let kn of pt)if(kn)Object.assign(ne,kn)' /opt/claude-code/bin/claude` printed `1`.

Both greps still match. Claude Code keys each plugin server `plugin:<plugin>:<server>` and merges the plugins in order with `Object.assign`, so the later plugin's same-named server wins. Confidence: medium (minified code, one version). Claude Code keeps `-` and `.` in server names, so `my-api`/`my_api` and `my.api`/`my_api` both run there. Dropping one is a Pi capability gap.

## Red and green runs

### Task 1 (tracer), red on BASE

- `node --test --test-reporter=spec test/orchestrators/mcp/builtin-registration-step.test.ts test/platform/mcp-builtin-status.test.ts test/orchestrators/plugin/info-mcp-status.test.ts`: exit 1, 129 pass, 5 fail.
  - S-T1 "D-MB-13 / D-MB-23: a later server with the same registered name replaces...": logged `[]`, expected the one Design 3 line. The registration itself already went to `my_api`'s config, because the `new Map(...)` overwrite kept the later value.
  - The two P2-DC-14 owner cases failed on the missing `server` field (expected, after the literals gained `server`).
  - Owner table row "another server of the row's own record holds the name, the user row": the reader mock was called unexpectedly.
  - I-T1 "D-MB-13: under builtin a server whose name another server of its own record holds reads not loaded...": `Didn't expect mcp status.lookup("plugin_alpha_my_api") to be called` (both rows asked the reader).
- `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-status.feature --name 'a later server of the plugin takes'`: exit 1. `plugin components mcp` read `[{"name":"plugin:demo:my_api","status":"not connected"},{"name":"plugin:demo:my.api","status":"not connected"}]`. Every other field matched. Info lists `my_api` before `my.api`, so the expected row order was set from this run.

### Task 1, green

- The three suites: exit 0, 134 pass.
- `npm run test:coverage:direct` for the step, the platform status, and the info status pairs: all pass (100%).
- `npm run typecheck`: pass.
- `npm run check:features`: exit 0.
- `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-status.feature features/mcp-server/builtin-trust.feature features/mcp-server/project-scope.feature`: 17 scenarios, 17 passed.
- The plan's three greps (`readonly server: string`, `holds its Pi namespace`, `D-MB-13` in the feature) each match.

### Task 2, red on Task 1's tree (9622e20)

- `node --test --test-reporter=spec test/orchestrators/mcp/builtin-registration-step.test.ts test/bridges/mcp/builtin-registration.test.ts`: exit 1, 47 pass, 3 fail.
  - S-T2a: logged `MCP server plugin_demo_s_t not registered: Didn't expect MCP registry.registerMcpServer("plugin_demo_s_t", ...)` instead of the Design 3 line (the step asked Pi for both spellings).
  - S-T2b: `The following calls were unexpected: MCP registry.registerMcpServer("plugin_demo_s_t", ...)` (the sync re-registered the listed spelling).
  - S-T2c: owner `plugin: 'demo'` instead of `'other'` (owners noted before the sync).
  - B-T2 "D-MB-12: a removal Pi refused is tried again by the next sync": passed. `bridges/mcp/builtin-registration.ts` is byte-identical between BASE and 9622e20, so this run is also its run on BASE. It pins the confirmed behavior of (b).
- S2 red on Task 1's tree: the step source was temporarily set back to the committed 9622e20 version, then restored. `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-status.feature --name 'a server declared before it holds'`: exit 1, `plugin components mcp` read `[{"name":"plugin:a-b:c","status":"not connected"}]` instead of `not loaded`. Every other field matched.

### Task 2, green

- The two suites plus the info and platform suites: exit 0, 148 pass.
- Direct coverage for the step and bridge pairs: pass. `npm run typecheck`: pass.
- The plan's checks: `foldedMcpServerKey` is used in the step, the awk check that the `noteBuiltinServerOwners(` call comes after the `syncBuiltinRegistrations(` call passes, `tries the removal again` is in the bridge, the feature has `ANAME-03` twice, and the docs have it six times.
- `npm run check:features`: exit 0.
- `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-status.feature features/mcp-server/lifecycle.feature features/mcp-server/builtin-trust.feature features/mcp-server/project-scope.feature`: 26 scenarios, 26 passed.

### Task 3, red on Task 2's tree (bd42787)

- `nondac-sh -c "node --test --test-reporter=spec test/bridges/mcp/builtin-overrides.test.ts test/bridges/mcp/builtin-description.test.ts"`: exit 1, 25 pass, 11 fail. Every case that expects a line failed with `logged` equal to `[]`: the three unparseable overrides rows, the credential case, the EISDIR case, the merged-files case, the unparseable plugin.json row, the EACCES case, the unreadable marketplace manifest, the marketplace manifest directory, and the ELOOP case. Every `[]` case passed.

### Task 3, green

- The two bridge suites plus the step and info suites (through `nondac-sh`, so the EACCES case holds as root): exit 0, 149 pass. The step and info suites gained no debug line.
- Direct coverage for both bridge pairs: pass. `npm run typecheck`: pass. The plan's three greps each match.

## S2 setup used

One scope, two marketplaces, with one change: the plan's plugin names `a_b` and `a-b` could not be used. Pi's skill name rule (`^[a-z0-9-]+$`, `dist/core/skills.js`) rejects the fixture skill `a_b-skill`, so the autoapply install of `a_b@first` failed with reason `unreadable`. A probe showed this: `a_b@first` read `available`, and the load listed `a_b@first failed unreadable`. The first S2 red run was therefore not valid. The scenario uses plugin `a` (server `b-c`, registered `plugin_a_b-c`) in marketplace `first` and plugin `a-b` (server `c`, registered `plugin_a-b_c`) in marketplace `second`. Both names fold to `plugin_a_b_c`. The probe feature file was deleted before any commit. The red and green runs above are the reworked scenario's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] S2 fixture plugin name rejected by Pi's skill rule**
- **Found during:** Task 2
- **Issue:** a plugin named `a_b` fails to install in the harness, so the scenario never reached the namespace collision.
- **Fix:** the namespace collision comes from the server names instead (`a`/`b-c` and `a-b`/`c`).
- **Files modified:** `features/mcp-server/builtin-status.feature`
- **Commit:** `bd42787`

**2. [Rule 1 - Test data] S1 row order**
- **Found during:** Task 1
- **Issue:** info lists `plugin:demo:my_api` before `plugin:demo:my.api`; the plan's row listed them the other way.
- **Fix:** the expected `plugin components mcp` value follows the order info prints.
- **Commit:** `9622e20`

**3. [Rule 2 - Coverage] Every overrides and description case asserts its debug log**
- The plan named the table rows and some cases. The good-file cases, the merged-files case (its broken file now logs the fixed parse line), and the escaping-link, dangling-link, and directory description cases also capture the log and assert it, so no case can gain a line unnoticed. The no-server rows' titles now name their line count.

No other deviation. The plan never edits `recordRegistrations`, `builtinRecordedServers`, the lookup type, or `info.ts`, and none of them was edited.

## Backlog dispositions

REVIEWSUGG-01, error-handling part:

- "Two servers folding to one name overwrite silently": **fixed** (Design 1 to 3; `9622e20`, `bd42787`). Measured before the fix: for equal registered names, `new Map(...)` kept the later config with no trace, the owner map did the same, and info read the left-out server with the holder's state (S1 and I-T1 red). For names that differ only by `-` and `_`, both reached Pi. A fresh session refused the later one through Pi's clash check, but after a load whose autoapply installed the earlier-declared plugin, the later-declared server kept the namespace and Pi refused the earlier one (S2 red on Task 1's tree).
- "A failed unregister logs only to debug": **left as is, confirmed** (Design 5). The load stays silent (RECON-05, NFR-2; BLTNOTICE-01 holds the load notice idea). The next sync lists the name again and retries the removal; B-T2 pins this, and the `syncBuiltinRegistrations` doc comment says so.
- "Owners are noted before the sync": **fixed** (Design 4; `bd42787`, S-T2c).
- The `mcp.json` read (`builtin-overrides.ts`): **fixed** (Design 6; `08bcd3e`).
- The description read (`builtin-description.ts`): **fixed** (Design 6; `08bcd3e`).
- Belong to sibling items, not this one: the probe read (261106-u9b), the rewrite-probe read (261106-u95), the unguarded status lookup and the bare `not loaded` of an `undefined` config (261106-u97).

## Questionable choices

| # | Choice | Alternatives | Why questionable | Severity |
| - | ------ | ------------ | ---------------- | -------- |
| 1 | The same registered name keeps the server declared later | The first declared everywhere | This was not taken because it changes D-MB-23 across scopes and diverges from Claude Code's `Object.assign` merge. Still, "later wins" for equal names and "first wins" for `-`/`_` spellings are two rules a user must learn | medium |
| 2 | Another spelling in a held namespace keeps the server declared first | One later-wins rule for both kinds | First-wins is what Pi's clash check gives at a fresh session today; a later-wins rule would change which server a fresh session runs. The cost is the asymmetry of choice 1 | medium |
| 3 | A left-out spelling gets its holder as owner in the owner map | A separate left-out set in `platform/mcp-builtin-status.ts` | Overloads "owner" to mean "the server that holds this name's namespace". This was chosen because the owner map already answers that question, and a second set would add one more process-level structure | low |
| 4 | `BuiltinServerOwner.server`, the declared server name | Info compares the registered names of all the record's servers | Info does not have the registered names the step decided; the field adds one string per owner | low |
| 5 | A missing file stays silent in both readers, the marketplace manifest included | Trace a missing file too | Pi skips a missing `mcp.json`, and the step and info suites' fixtures have no marketplace manifest. A missing marketplace manifest with a still-recorded marketplace may hide a real problem | low |
| 6 | Parse failures use the fixed phrase `the file is not valid JSON` (and `it is not a valid marketplace manifest`) | Log the parser's message | V8's message quotes the start of the text, and `mcp.json` holds credentials. The fixed phrase loses the parse position | low |
| 7 | The `mcp.json` line does not say which scope's file | Label each file by scope | Paths are cut to their last segment, so user and project lines read the same. Labeling would change `readMcpJsonServerNamespaces`'s parameter and its caller in `info-mcp-status.ts` | low |
| 8 | Only the plugin manifest candidate that decides the walk is traced | Trace every candidate | Candidates are read in parallel; a later candidate's failure changes nothing (D-01-07), so tracing it would mislead | low |
| 9 | Shape mismatches stay silent (non-object top level or `mcpServers`, a manifest without a usable description) | Trace them too | They are not read or parse failures, and Pi reports `mcp.json` shape errors itself | low |
| 10 | (b) confirmed with no user notice | A load notice for a failed removal | RECON-05 keeps the load silent; BLTNOTICE-01 holds the deferred notice idea | low |
| 11 | (c) fixed although Pi 1.5.0 reaches it only from a stale or failed runtime | Leave the owner note before the sync | The owner map must describe only a sync that reached Pi; the fix costs nothing | low |
| 12 | S2 collides through server names (`a`/`b-c` and `a-b`/`c`), not plugin names | The plan's `a_b`/`a-b` plugin names; option 2 (two scopes, one marketplace) | Plugin names with `_` cannot install in the harness because of Pi's skill name rule, so the plan's fixture cannot be used. Option 2 has the same `a_b` problem | low |
| 13 | A mutable `Slot { holder }` per namespace, so each left-out registration is logged against the final holder | A second `Map.get` after the walk | That `get` has an `undefined` branch no input reaches, which would break 100% branch coverage or need a `!` assertion | low |
| 14 | `ELOOP` from a self-link proves the `unresolvable` description case | Another fixture | `locateManifestCandidate` answers `unresolvable` with `ELOOP: too many symbolic links encountered, realpath 'plugin.json'`, as the plan expected, so no other fixture was needed | low |

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-u9a-02 (no file text in a debug line) is pinned by the credential case and the fixed-phrase rows. T-u9a-03 (no throw) holds because both traces run inside the existing catch paths.

## Known Stubs

None.

## Parent lines

For the coordinator, who owns these files:

- `.planning/BACKLOG.md`, REVIEWSUGG-01: "Error-handling part closed by 261106-u9a: two plugin servers with one built-in name or one Pi namespace now register one server by declaration order (later for the same name, D-MB-23; first for a `-`/`_` spelling, ANAME-03), each left-out server is logged and reads `not loaded` in info; owners are noted after the sync (ASTAT-01); a failed unregister stays debug-only and is retried by the next sync (confirmed, D-MB-12); `mcp.json` and description read or parse failures leave one `mcp`-channel debug line. The probe read (261106-u9b), the rewrite-probe read (261106-u95), and the status lookup items (261106-u97) are tracked there."
- Proposed Key Decisions record (or DUBIOUS-CHOICES entry for the user's review): "D-MB-30: Under Pi's built-in MCP, the registration step registers one server per Pi namespace, decided in declaration order (user records, then the trusted project's; each scope in state order; each record in server order) as a fresh session decides. A server with the holder's registered name replaces it in place (D-MB-13, D-MB-23; Claude Code's merge keeps the later of two same-named plugin servers). A server whose name differs from the holder's only by `-` and `_` is left out, as Pi's clash check refuses it (ANAME-03). Each left-out server is debug-logged, its name is owned by the holder, and info reads it as `not loaded`, or `overridden by project scope` for a user row a project record replaced. Divergence: Claude Code runs both servers when their `plugin:<plugin>:<server>` names differ; Pi capability gap."
- D-MB-23 amendment note: "Info: a row whose registered name another server of its own record holds also reads `not loaded` (D-MB-13); the owner names the declared server."
- CHANGELOG bullet: "Under Pi's built-in MCP, two plugin servers that share a Pi name or tool namespace now run one server, chosen by declaration order, and `/claude:plugin info` shows the other as `not loaded`."

## Self-Check: PASSED

- FOUND: all 14 modified files exist.
- FOUND: `9622e20`, `bd42787`, `08bcd3e` are ancestors of HEAD.
- `git status` is clean after Task 3, apart from this SUMMARY.
