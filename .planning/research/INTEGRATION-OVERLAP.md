# Integration and cucumber overlap audit

**Date:** 2026-11-20. **Milestone:** integration-rescope.

**Method:** Three read-only agents compared each of the 45 files in
`test/integration/` with the 149 feature files in `features/` and their step
definitions. They ran nothing. "Covered" means a scenario looks like it would
fail on the same bug. No mutation test proved it, so a planner must check
each verdict again before deleting an integration case.

**Verdicts:** 2 duplicated, 29 partial, 14 unique.

- **DUPLICATED:** every case has a scenario that would fail on the same bug.
- **PARTIAL:** some cases are covered; the rest are listed.
- **UNIQUE:** no scenario is equivalent; the reason is given.

Each uncovered case is marked as *user-visible* (it belongs in cucumber under
the behavioral-test rule in `AGENTS.md`) or *internal* (stored fields no step
reads, state shapes that only older releases wrote, fault injection, or calls
that were not made).

Feature paths are relative to `features/`.

## Suite facts

- `npm run check` runs `test:integration` (Node's test runner, through
  `scripts/install-test-peers.mjs` and `scripts/isolated-pi-home.mjs`). CI
  runs it in the `integration` job, which has a 10-minute timeout.
- Integration tests add nothing to the Sonar coverage gate.
  `sonar.javascript.lcov.reportPaths` names only `coverage/direct.lcov`.
- Cucumber drives a real headless Pi with the real extension and the real
  optional peers, under the `adapter` and `builtin` MCP profiles.
- Only two integration files import from `features/lib`:
  `subagent-hook-ownership.test.ts` and `pi-subagents-child-identity.test.ts`.
  No feature file or step imports from `test/`.
- The expansion table in `test/bridges/mcp/expansion-cases.ts` (68 rows plus
  `OPTION_FIELD_CASES`) is used only by the integration tests.

## Group A: peer conformance and multi-process tests

| file | tests | verdict | evidence |
|---|---|---|---|
| adapter-expansion-conformance | 19 static, about 90 expanded | UNIQUE (small overlap) | Cucumber has only a few env values (`mcp-server/configuration.feature` "A server's env value reaches it as Claude Code expands it") plus `options.feature` "...home path is left out" and `legacy-move.feature:218`. Not covered: the 68-row table over every field, the bounded-exhaustive adversarial property, marker-forming attacks (AVAR-05, D-CF1-13), the deny-listed credential check, the `PI_CLAUDE_MARKETPLACE_EMPTY` split token, and the drift guard that pins the adapter's call sites. |
| adapter-tool-name-conformance | 11 | PARTIAL | Covered: a cut inside the server segment (`mcp-server/listing.feature` "A server whose tool names pass 64 characters gets the cut tool names of pi-mcp-adapter...") and an exact 64-character name (`hook/mcp-tool-names.feature`). Not covered: 65 characters, dots, empty or one-character tool, already-prefixed name, non-ASCII, the 65 UTF-16 / 64 code point edge, and the screenshot-name drift guard. |
| agents-adapter-grant-conformance | 1 | UNIQUE | Pins a pi-subagents capability gap (AGTLONGNAME-01): its resolver names a long granted tool uncut. `mcp-server/agent-grants.feature` covers only the exclude side. |
| agents-builtin-grant-conformance | 3 | PARTIAL | Covered: a per-tool built-in grant resolves in a real child (`agent/frontmatter.feature` "Explicit background and MCP grants keep a child in the background"). Not covered: a whole-server selector with a hyphen fold, a long tool, and adapter selectors staying unresolved under the built-in MCP. |
| mcp-adapter-entry-conformance | 3 | PARTIAL | D-08-04 clean header covered (`mcp-server/configuration.feature` "Under the OAuth entry of D-08-04..."). Not covered: `supportsOAuth=false` and the resolver throw for an unset header variable; D-08-02, the adapter loading a file that holds `_piClaudeMarketplace.serverChoices` after an uninstall. |
| mcp-builtin-encoding-conformance | 9 static, about 100 expanded | PARTIAL, mostly UNIQUE | A few env and option values and an unset url variable are covered. Not covered: the full table through Pi's `resolveConfigValueOrThrow`, the 8 Pi-syntax cases, and the validator same-JSON checks (no reconnect). |
| mcp-status-conformance | 3 | PARTIAL | ASTAT-01 covered in both scopes (`mcp-server/companion-missing.feature`, `mcp-server/project-scope.feature:179`). Not covered: the ASTAT-02 shutdown snapshot, and the channel, version, and status-union drift guard. |
| provenance-invisibility | 11 | PARTIAL | Covered: the child's system prompt is the body, a description block, quoted values. Not covered: injected `name:` and `---` lines in the block, `|`, `|-`, `>`, `>-` descriptions, `#1 and #2`, `@reviewer`, a name or alias with a colon. |
| skill-path-resolution | 1 | PARTIAL | Resolution covered (`agent/invocation.feature` "An agent that preloads a plugin skill..."). Not covered: the skill stays out of pi-subagents' `discoverAvailableSkills` catalog. |
| workflow-engine-agent-registry | 17 expanded | PARTIAL | Three values covered in `workflow/agent-steps.feature`. Not covered: `#`, `@`, and quoted descriptions, a lone CR, 7 other provenance values, and the source names `'reader`, `@reader`, `Reviewer: code`. |
| pi-subagents-child-launch-conformance | 11 | PARTIAL | Agent fan-out, inherit model, and a short MCP grant covered. Not covered: ambient adapter tools for unrestricted and exclusion-only runners, suppression by an explicit read, an empty list, or a read-only ceiling, `MCP_DIRECT_TOOLS` ownership, an exclude name removing a tool. |
| hooks-result-boundary | 6 | PARTIAL | Three `hook/tool-use.feature` scenarios cover redaction and replacement. Not covered: `structuredContent` and `isError` kept on block feedback, and the file-result echo as an exact no-op. |
| concurrent-install | 2 | UNIQUE | A real two-process race. `plugin/state-lock.feature` only checks a held lock. |
| load-reconcile-race | 3 | PARTIAL | The single-process D-13 case is duplicated by `plugin/config-migration.feature` "The first load after an upgrade from release 0.4.3...". The two race tests (RECON-06, concurrent first-load migration) are UNIQUE. |
| subagent-hook-ownership | 2 | PARTIAL | Test 1 matches `plugin/subagent-child.feature` "Loading and stopping a child leaves parent and sibling hooks running", plus journal byte checks. Test 2 (a main load reaps a dead child's hook and keeps a live sibling's) is UNIQUE. |
| pi-subagents-child-identity | 4 (2 run under both profiles) | DUPLICATED (near) | `plugin/subagent-child.feature` "A real background child runs its plugin tool hooks and completes" and "Concurrent companion children keep separate hook identities"; `agent/frontmatter.feature` "A call with no launch override runs the ordinary agent..." and "Explicit background and MCP grants...". Gaps: an empty agent body, and the failing read in the ordinary case. |
| auth-e2e | 7 | PARTIAL | AUTH-01 and AUTH-02/08 covered (`marketplace/device-flow.feature`). UNIQUE: the 4 print-mode refusal and staging-cleanup tests (no feature runs Pi in print mode), and AUTH-07 reject, evict, and sign in again (`marketplace/git-source.feature` stops at the failure). |

## Group B: MCP and hooks orchestrator tests

No step reads `compatibilityBasis`, `mcpServerConfigs`,
`resources.mcpServers`, `keptOverride`, or `serverChoices`. Those fields
appear only in Given steps that strip them
(`step_definitions/mcp-server/implementation-switch.steps.ts:37`,
`legacy-move.steps.ts:44`, `lib/mcp-builtin-earlier-record.ts`).

| file | tests | verdict | evidence |
|---|---|---|---|
| mcp-home-path-partial | 2 | UNIQUE (user-visible) | No scenario refuses a literal `~/` in stdio args with `{unsupported mcp}` and the `--partial` hint, or leaves that server out under `--partial`. `options.feature` and `builtin-status.feature` cover other `~` cases. |
| mcp-legacy-sweep | 4 | UNIQUE (user-visible) | The install-time sweep (AMIG-02) has no scenario: the legacy entry plus the old-name `{disabled}` stub removed with a warning, the direct-tools copy removed, the user's own old-name server kept, and a user-scope install leaving the project file alone. |
| mcp-migration | 14 | PARTIAL (2/14) | Covered in `mcp-server/legacy-move.feature`: the AMIG-01 move in both scopes and the silent second load. Not covered, all user-visible: one notice for both scopes with project rows first, the tool-rules warning, the AMIG-04 unowned-entry warnings, a cold clone cache, an undeclared or unsupported server, a malformed config or sibling, the stub notice, user-scope stub removal from the project, and recovery after a refused write between the two writes (fault injection). |
| mcp-override-lifecycle | 12 | PARTIAL (about 2/12) | User scope covered by `mcp-server/lifecycle.feature` (disabled choice survives disable and enable, and uninstall and install). Not covered: a project install absorbing a user stub and writing it back on uninstall, a user plugin disabled in the project, `/mcp-adapter enable` surviving, carried fields, the ANAME-07 stub timeout, an update that drops a server and later restores its choice, openUi and trace kept on reinstall, foreign `serverChoices`, an emptied stub removed. `keptOverride` and `serverChoices` checks are internal. |
| mcp-server-records | 6 | UNIQUE (internal) | Asserts `resources.mcpServers` and `mcpServerConfigs` order, unexpanded, blocked servers included, after install, update, enable, disabled update, reinstall, and import. |
| mcp-tool-rules | 1 | UNIQUE (user-visible) | No feature has the "MCP server tool rules not enforced" warning. |
| mcp-variable-expansion | 6 | PARTIAL (about 1.5/6) | The unset-variable warning on install and values reaching the server are covered. Not covered: `${CLAUDE_PROJECT_DIR}`, `!` to `!!` escaping, the secret value staying out of the file, AVAR-05 (deny-listed credential withheld with a notice), AVAR-04 notices after rows on update, reinstall, and enable, and D-PG10-11 for all five fields. |
| mcp-verdict-list | 3 | PARTIAL (1/3) | Case 2 covered by `mcp-server/verdict-list.feature`. Not covered: "writes nothing to state.json", the stored verdict (internal), and the list row of a legacy record with no MCP trace (user-visible). |
| mcp-verdict-migration | 4 | UNIQUE (mostly internal) | Needs released-build records. Not covered: a server only the built-in runs kept out of `mcp-adapter.json`, a ws server, a plugin listing as partially installed after the move (user-visible), a catalog past the record. |
| mcp-verdict-update | 4 | UNIQUE (internal) | The stored basis after update, reinstall, failed update, and disabled update, plus byte idempotency. |
| transaction-lifecycle-cascade | 1 | PARTIAL (near duplicate) | `hook/lifecycle.feature` covers update and uninstall; `hook/process.feature` covers reinstall. Left over: reinstall repairing a corrupted `hooks/<plugin>/hooks.json` (internal). |
| workflow-kind-inversion | 4 | PARTIAL (1/4) | Covered by `workflow/storage.feature`. Not covered: RECON-05 (two reconciles leave the envelope bytes alone) and WCONV (a record from a build where the kind was invisible, converged by apply); both internal. |
| hooks-additionalcontext-end-to-end | 2 | PARTIAL (1/2) | HOOK-E2E-03 covered by `hook/additional-context.feature`. HOOK-E2E-04, the buffer cleared on reload before the first prompt, is user-visible and uncovered. |
| hooks-cross-scope-reconcile | 1 | UNIQUE (user-visible) | No scenario installs hook plugins in both scopes and then applies. |
| hooks-dispatch-end-to-end | 7 | PARTIAL (5/7) | User and project SessionStart, D-PG10-23, D-PG10-25, and child tool payloads covered. Not covered: WR-05 (no `.pi` created in a project that had none, user-visible) and a throwing project hydrate not blocking dispatch (internal). |
| hooks-spawn-end-to-end | 2 | DUPLICATED | Every hook scenario spawns real hook processes; `plugin/session-start-hooks.feature` covers the SessionStart side effect, and dir-source scenarios cover a `CLAUDE_PLUGIN_ROOT` outside the extension directory (HOOK-E2E-05). |

## Group C: marketplace and plugin lifecycle tests

| file | tests | verdict | evidence |
|---|---|---|---|
| fold-adoption | 2 | UNIQUE (user-visible) | Only filtered lists are covered (`plugin/list.feature`). Not covered: the unfiltered `list` folding `alpha [project]` under the `official [user]` header, and an independent project marketplace showing its own row with no duplicate. |
| marketplace-add-seed-mirrors | 6 | UNIQUE (mostly internal) | Mirror seeding on `marketplace add`, the mirror remote URL, an unreachable pin left unseeded, GC of an unreferenced mirror, no git or credential calls for a path marketplace. User-visible part: installing a same-repo url plugin after the add makes no git request ("the git host receives no request"). |
| marketplace-layer-autoupdate | 6 | PARTIAL | LAYER-02 and D-07 covered in `marketplace/autoupdate.feature`. Not covered, user-visible: both D-09 cases (recorded but declared by no layer) and CFG-03 for a non-local flip with an unreadable local config. |
| marketplace-layer-redeclare | 2 | PARTIAL | Test 1 is covered in `marketplace/add.feature` for the config files, but not for "no second clone, no git or credential call". Test 2 (recorded but undeclared, re-declared without git) is uncovered. |
| marketplace-layer-remove | 11 | PARTIAL | Covered: blockers reported, D-05-07, lock held. Partly covered: base-layer remove, refused remove changes nothing, LAYER-03. Not covered, user-visible: named remove of a recorded but undeclared url marketplace, LAYER-02 with the other layer unreadable. Internal: partial remove, failure-only, and PRUNE-03, which need an injected EACCES from `cascadeUnstagePlugin`. |
| path-source-tag-install | 4 | UNIQUE | Tag steps cover only plugin repositories. User-visible: a path-source dependency installed from the `formatter--v1.0.0` marketplace tag while HEAD has moved past it, and the TAGS-02 fallback. Borderline: CR-01 (untracked files kept out of the materialized clone). Internal: `.git/index` and `.git/HEAD` unchanged. |
| plugin-layer-consistency | 7 | PARTIAL | The local gap is covered (`plugin/configuration.feature`). Partly covered: the base gap and the dangling reference (pending only). Not covered, user-visible: the user-scope local gap, a legacy local layer kept byte for byte, pending before the first-run migration, and the malformed key `demo@` reported as `source mismatch`. |
| plugin-layer-verbs | 16 | PARTIAL | Both LAYER-08 cases covered (`plugin/reinstall.feature`, `plugin/update.feature`). Not covered, user-visible: all 12 LAYER-04 cases (install, uninstall, enable, disable, update, reinstall, in both directions, refused when the other layer is unreadable). Internal: both LAYER-06 cases, which tamper state.json to a future source kind. |
| project-install-adds-user-marketplace | 6 | PARTIAL | Covered: the project keeps the marketplace after a user-scope remove (`marketplace/remove.feature`). Partly covered: the dependency's marketplace added to the project (`plugin/cross-scope-install.feature`, dir source). Not covered: WR-07 (not-in-manifest fails before the project clones), MA-12 (leftover clone replaced), MA-13 (foreign tree refused and kept), and D-MF-04 (dependencies read from the fresh project clone), which is user-visible. |
| reconcile-plan-convergence | 10 | UNIQUE (internal) | Pure in-memory fixed-point checks of `buildConfigFromState`, `mergeScopeConfigs`, and `planReconcile`, including the D-09-14 non-fixpoint and alias resolution. Loose user-visible analogues exist in `plugin/config-migration.feature` and `plugin/configuration.feature`. |
| reserved-record-keys | 15 | UNIQUE (user-visible) | No scenario uses a plugin named `constructor` or `__proto__`. `marketplace/reserved-name.feature` refuses `constructor` only on `marketplace add`, not on a reload that declares `hello@constructor`. |
| standalone-prune | 25 | PARTIAL | Covered: lock, orphan removal, dry-run preview, usage errors. Partly covered: empty scope (1 of 7 variants), project-only prune, the dependent-first chain. Not covered: malformed state.json, alternating marketplaces, an actual prune after a stale preview, a failed member keeping its dependency until a retry, legacy previews, preview with missing project state, an unreadable declarer manifest, and the flags `-y`, `--keep-data`, `--prune`. Internal: prune never calls `applyReconcile` or `installMissingDependencies` and makes no git call. |

## Cheapest moves

Steps already exist for these:

- LAYER-04 (12 cases) and the plugin-layer-consistency user-scope, legacy, and
  malformed-key cases.
- Plugin names `constructor` and `__proto__`.
- D-09 recorded but undeclared marketplaces, through "a config in scope ...
  with this text".
- The re-declaration no-request check, through "the git host receives no
  request".

These need new harness support or are internal: the unstage fault injection
in layer-remove, marketplace-repo tags for path-source dependencies, mirror
seeding and GC, the LAYER-06 source-kind tampering, and the pure planner
fixed points.
