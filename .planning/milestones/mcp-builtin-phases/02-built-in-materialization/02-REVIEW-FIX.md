---
phase: 02-built-in-materialization
fixed_at: 2026-11-04T16:35:01Z
review_path: .planning/phases/02-built-in-materialization/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-11-04T16:35:01Z
**Source review:** .planning/phases/02-built-in-materialization/02-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (WR-01 to WR-05, IN-01, IN-02; the orchestrator put both Info findings in scope)
- Fixed: 7
- Skipped: 0

Every fix ran in the main checkout (`/home/user/pi-claude-marketplace`, branch `features/mcp-builtin-phase-2`), with no worktree, so each result can be reproduced from this tree. Each commit went through the commit hook, and `npm run check:commit` passed for each one. That run covers `check:static`, `test:unpaired`, and direct coverage of the staged pairs. Each npm script ran under the non-DAC shell wrapper.

## Fixed Issues

### WR-01: The UF-1 containment check accepts either root for any record

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts`, `test/orchestrators/mcp/builtin-registration-step.test.ts`
**Commit:** e76bab8
**Status:** fixed: requires human verification (logic change)
**Applied fix:** Each record now has one owning root. The rule is D-PL2-23, which `installedCopyReadOptions` already applies. A record with `resolvedSha` whose root lies under `plugin-clones/` is bounded by its own clone entry `plugin-clones/<key>/`. The key must have the `pluginCloneKey` or `pluginMirrorKey` shape, and `locations.pluginCloneDir(key)` builds the path. Every other record is bounded by its marketplace root. For a marketplace whose source is not `path` (github, url, hosted), that root must itself lie inside the scope's `sources/<marketplace>/` checkout (`locations.sourceCloneDir`). Any refusal leaves the record uncontained, as before. The check stays in the step and not in the frozen `recorded-servers.ts`.
**Evidence:** The new cases are a record without a commit under `plugin-clones/`, a git record outside a well-formed clone entry, a cloned marketplace whose root lies outside its checkout, and a cloned marketplace's plugin inside its checkout. The git-record arm now needs `resolvedSha`. Against the old source, the three refusal cases failed (RED). They pass now, with 100% direct coverage of the step. The built-in profile passed for `sources`, `builtin-direct`, `builtin-trust`, `builtin-values`, and `builtin-status` (25/25).
**Residual:** The URL half of a clone key is not checked against the plugin's source URL. That check would need the manifest entry, and a tag-pinned path record's sha half can differ from `resolvedSha`. A git record is bounded by the one clone entry its root names.

### WR-02: Pi home-expands a value that resolves to a leading `~`

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts`, `extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts`, `features/mcp-server/builtin-status.feature`, `test/bridges/mcp/builtin-entry.test.ts`, `test/orchestrators/mcp/builtin-registration-step.test.ts`, `docs/mcp-compatibility.md`
**Commit:** 85a8f7a
**Status:** fixed
**Applied fix:** `builtinServerConfig` gives no config for a stdio server whose resolved `command` or any `args` element is `~`, starts with `~/`, or starts with `~` and `path.sep`. Pi 1.5.0 `expandHome` expands exactly these. The step logs `MCP server <name> not registered: Pi would not run it as Claude Code does` and registers the other servers. A bullet under the built-in "Other gaps" and a bullet under the built-in divergences in `docs/mcp-compatibility.md` record the difference.
**Evidence:** The unit rows cover `${PI_CM_TILDE}` resolving to `~`, an arg resolving to `~/conf`, and `${PI_CM_UNSET:-}~/a`. A kept row checks that `a~/b` and a resolved `~user` stay as written. New scenario: "Plugin info shows a server whose arg resolves to a leading ~ as not loaded (BLT-02)" (builtin profile). It is RED against the old bridge: info read `not connected`, because the server was registered with `~/conf`. It passes now. The integration conformance suite passes (63/63).

### WR-03: The status reader says `disabled` for a server whose config changed in the session

**Files modified:** `extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts`, `extensions/pi-claude-marketplace/bridges/mcp/builtin-registration.ts`, `extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts`, `test/platform/mcp-builtin-status.test.ts`, `test/bridges/mcp/builtin-registration.test.ts`, `docs/mcp-compatibility.md`
**Commit:** e3b1a8b
**Status:** fixed: requires human verification (status-mapping logic)
**Applied fix:** I checked Pi 1.5.0: neither the registry nor the tool list tells a `/mcp` disable apart from a re-registration. `saveConfig` keeps a session disable in the MCP extension's own entry, and `getMcpServers()` returns `structuredClone` copies. So the reliable cue is the extension's own sync. `syncBuiltinRegistrations` now reports each change that Pi accepts through an injected `notes` object. `replaced` marks a registration in place of a listed config of another shape. `fresh` marks any other registration or a removal. The step binds `notes` to `noteReplacedBuiltinRegistration` and `noteFreshBuiltinRegistration` in `platform/mcp-builtin-status.ts`. When every tool of a noted name is hidden, the reader answers `not-connected`. A fresh registration clears the note, and Pi starts each session with no registration. The docs' `/mcp` paragraph records this case, the remaining gap (a replaced server that the user then turns off reads `not connected`), and the server that stops offering every tool, which still reads `disabled`.
**Evidence:** New reader rows: a replaced name with only hidden tools reads `not-connected`. A replaced name with a visible tool reads `connected`. A fresh note after a replacement reads `disabled` again. A replacement of another name leaves this one `disabled`. The bridge tests now check every note, including the order of unregister, register, and note. Direct coverage of all three pairs is 100%. The built-in profile passed for `builtin-status` and `lifecycle` (15/15). No cucumber scenario was added: the case needs the old connection to list its tools between `session_start` and the post-load resync, a race the harness cannot order.

### WR-04: `overridden by project scope` is stamped for project servers that never register

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts`, `extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts`, `extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts`, `test/orchestrators/plugin/info-mcp-status.test.ts`, `test/platform/mcp-builtin-status.test.ts`, `test/orchestrators/mcp/builtin-registration-step.test.ts`, `docs/mcp-compatibility.md`
**Commit:** 4ebccfa
**Status:** fixed: requires human verification (status-mapping logic)
**Applied fix:** Info no longer guesses the override from the same-marketplace project record. At each sync, the registration step records the owner (scope, marketplace, plugin) of every name it registers, through `noteBuiltinServerOwners` in `platform/mcp-builtin-status.ts`. The owner is its own decision, after the profile filter, the containment check, the unreadable-record refusal, and the `builtinServerConfig` refusal. Under built-in, info reads `builtinServerOwner(name)` after the `mcp.json` check. A user row whose name a project record owns reads `overridden by project scope`, also when that record is another marketplace's plugin of the same name. A row whose name any other record owns reads `not loaded`: another user-scope marketplace, a plugin and server pair that folds to the same name, or a user record that holds a project row's name. Otherwise info reads the reader's answer. The adapter arm and `withMcpServerStatus`'s signature are unchanged. The docs table rows for `not loaded` and `overridden by project scope` say so.
**Evidence:** New info rows: a project owner of another marketplace gives `overridden by project scope`. A user owner of another marketplace, another plugin's folded name, and a user owner of a project row give `not loaded`, without asking the reader. A trusted project record that info passes, but whose name the step gave to the user record, gives the reader's answer (the old code said overridden). The `mcp.json` override still comes first. The step test asserts the owners of the P2-DC-14 case, plus a new case: a trusted project server that the built-in profile blocks leaves the name to the user server. Direct coverage of all three pairs is 100%, and `test/orchestrators/plugin/info.test.ts` passes (243/243). The built-in profile passed for `builtin-status`, `builtin-trust`, `project-scope`, and `lifecycle` (19/19). I tried a cross-marketplace scenario and dropped it. The project install of `demo@others` beside a user `demo@fixtures` fails with `Refusing to stage MCP server "plugin_demo_stub_": mcp-adapter.json already defines it`, so install cannot reach that state today. Unit tests cover it.

### WR-05: A `Then` step issues a Pi command

**Files modified:** `features/step_definitions/mcp-server/builtin-values.steps.ts`, `features/lib/mcp-builtin-config-probe/snapshot.ts`, `features/mcp-server/builtin-values.feature`
**Commit:** 7eea484
**Status:** fixed
**Applied fix:** A new step `When the user asks pi for the configs of the mcp servers registered with it` waits for the registry to settle (`settledRegistry`), runs the config probe, and checks the response and the report. The `Then` step now only reads `lastRegisteredConfigs(this.pi.recordsSince(0))`, a new lib reader that takes the last probe report the session printed. The world is frozen, so the report stays in the session's record log, not in a new world field. The five `builtin-values.feature` scenarios use the new `When` in place of `When the user lists the mcp tools pi offers`, whose snapshot their `Then` never read.
**Evidence:** `npm run check:static` passed, including `check:features`. `builtin-values.feature` passed under the built-in profile (5/5, 55 steps).

### IN-01: The step's debug log is not "names only"

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts`, `test/orchestrators/mcp/builtin-registration-step.test.ts`
**Commit:** 3537e8a
**Status:** fixed
**Applied fix:** The step's `debugLog` passes each line through `shared/redact-absolute-paths.ts`. The bridge's register and unregister refusals also log through it. The header now says each line names the server and the error message, never a config value, with each absolute path cut to its last segment. The frozen legacy reader still logs its own refusals unredacted. Its messages name the plugin and marketplace, not paths.
**Evidence:** The two NFR-2 state tests now expect `state.json at state.json`. A new case checks that Pi's `already registered by extension "/opt/pi/extensions/other.ts"` is logged as `"other.ts"`. Direct coverage of the step is 100%.

### IN-02: One throw while unregistering aborts the whole sync

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/builtin-registration.ts`, `test/bridges/mcp/builtin-registration.test.ts`
**Commit:** 5fbb195
**Status:** fixed
**Applied fix:** Each `unregisterMcpServer` call has its own try/catch. A throw is logged as `MCP server <name> not unregistered: <Pi's message>`, and the other removals and every registration still run. The doc comment says that a `getMcpServers` throw leaves nothing to compare, so it still skips the whole sync.
**Evidence:** New test: the first of two removals throws. The second removal and a registration still happen, the log gets the one line, and the notes list only the changes Pi accepted. Direct coverage of the bridge is 100%.

## Final verification (main checkout)

- `npm run check:static` passed after each fix.
- Built-in profile on `features/mcp-server`: 72 of 73 scenarios passed (seed 181937). The one failure is `companion-missing.feature:61`, "Plugin info names pi-mcp-adapter as a missing companion". It expects `status unknown` and gets `not loaded`. It fails the same way with the product code checked out at the review base `b6e88b2`, so these fixes did not cause it. Its feature text says it holds "only where the run's shared Pi has no pi-mcp-adapter, until MREC-05 rewrites them".
- Adapter profile on `features/mcp-server`: 71/71 passed (seed 221489).

## Parent lines

- The `companion-missing.feature:61` failure under the built-in profile predates these fixes (it fails at `b6e88b2`). That file is not one of this fix pass's files. Its owner should check it before the phase gate.
- P2-DC-10, P2-DC-13, and P2-DC-14 in `DUBIOUS-CHOICES.md` describe the old behavior: status by tool exposure only, containment against either root, and override from the project record. The orchestrator should amend them from the Dubious Choices below. Per the brief, this fix pass did not edit that file.

---

_Fixed: 2026-11-04T16:35:01Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
