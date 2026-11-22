# Requirements: integration-rescope -- Integration Test Rescope

**Defined:** 2026-11-20
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Input:** [research/INTEGRATION-OVERLAP.md](research/INTEGRATION-OVERLAP.md), the per-file overlap audit of the 45 integration test files against the 149 feature files. Its verdicts come from reading code, not from mutation tests, so each phase checks a verdict again before it deletes an integration case.

## Rules for every migration requirement

Each ITMIG requirement is met only when all of these hold:

1. Each new scenario follows the `cucumber` skill and passes under both the `adapter` and the `builtin` profile.
2. Each new scenario fails when the behavior in its title is broken on purpose. The phase records how it broke the behavior and that the scenario failed, then reverts the break.
3. The integration cases that the new scenarios replace are deleted. A file left with no case is deleted.
4. A product bug that a new scenario exposes is fixed in the phase when the fix is small. Otherwise it is recorded in `.planning/BACKLOG.md`, and the integration case that guards it stays.

## Milestone Requirements

### Duplicates (ITDUP)

- [x] **ITDUP-01**: `test/integration/hooks-spawn-end-to-end.test.ts` is deleted, after the phase confirms that the hook scenarios cover the SessionStart side effect and a `CLAUDE_PLUGIN_ROOT` outside the extension directory (HOOK-E2E-05).
- [x] **ITDUP-02**: A scenario covers a pi-subagents child of an agent with an empty body, and the failing read in the ordinary launch case. Then `test/integration/pi-subagents-child-identity.test.ts` is deleted.

### Migration to cucumber (ITMIG)

- [x] **ITMIG-01**: Scenarios cover the 12 LAYER-04 cases: install, uninstall, enable, disable, update, and reinstall each refuse, in both layer directions, when the other layer's config cannot be read, and change nothing.
- [x] **ITMIG-02**: Scenarios cover the plugin-layer consistency cases: the user-scope local gap, a legacy local layer from an earlier `--local` install kept byte for byte, `pending` before the first-run migration, a malformed key such as `demo@` reported as a source mismatch, a base layer that declares a plugin without its marketplace stopping the reload and changing no file, and a dangling reference row beside a declared plugin that still installs.
- [x] **ITMIG-03**: Scenarios cover plugin names that are `Object.prototype` members: a plugin named `constructor` installs, lists, shows, disables, enables, updates, and uninstalls, imports, and goes when its marketplace is removed; `__proto__` lists as unavailable; and a reload that declares `hello@constructor` records nothing.
- [x] **ITMIG-04**: Scenarios cover the unfiltered `list` fold: a project install from a user marketplace is listed under the user marketplace header with a `[project]` row, and an independently added project marketplace gets its own header and no duplicate row.
- [x] **ITMIG-05**: Scenarios cover the marketplace layer cases: D-09, a marketplace recorded in state but declared by no layer, for a named and an unnamed autoupdate flip; CFG-03 for a non-local flip when the local config cannot be read; a re-declaration and a same-repo url plugin install that make no git request; a named remove of a recorded but undeclared marketplace; LAYER-02 refusing a remove when the other layer cannot be read; a base-layer remove of a url marketplace that removes its clone and data directory; a refused remove with an installed plugin that changes no state and no skill; and LAYER-03 keeping a url-source dependency, its clone, and its data while the scope still converges.
- [x] **ITMIG-06**: Scenarios cover a project install that adds a user marketplace to the project: WR-07 (a plugin not in the manifest fails before the project clones), MA-12 (a leftover clone is replaced), MA-13 (a foreign tree is refused and kept), D-MF-04 (dependencies are read from the fresh project clone, not the stale user clone), and a dependency's user git marketplace added to the project with a clone in each scope.
- [ ] **ITMIG-07**: A step publishes a marketplace repository with a tag, and scenarios cover a path-source dependency installed from the tag its constraint selects while the marketplace HEAD has moved past it, plus the TAGS-02 fallback to the current checkout.
- [x] **ITMIG-08**: Scenarios cover the uncovered `prune` cases that a user can see: the remaining empty-scope variants, a malformed state file, held neighbours across marketplaces, an actual prune after a stale preview, a failed member that keeps its dependency until a retry, a preview with no project state, an unreadable declarer manifest, the flags `-y`, `--keep-data`, and `--prune`, a project-only prune, and a dependent-first chain whose preview matches the actual prune.
- [x] **ITMIG-09**: Scenarios cover the MCP install refusals and warnings: a literal `~/` in stdio args refused as `{unsupported mcp}` and left out under `--partial`, the warning that tool permission rules are not enforced, AVAR-04 notices on update, reinstall, and enable, AVAR-05 (a deny-listed credential withheld with a notice), `${CLAUDE_PROJECT_DIR}`, `!` escaped to `!!`, a secret value kept out of `mcp-adapter.json`, and D-PG10-11 entries holding a reference and no option value in all five fields.
- [x] **ITMIG-10**: Scenarios cover the legacy `mcp.json` move: the install-time sweep (AMIG-02) of marked entries, old-name stubs, and direct-tools copies, with the user's own servers kept; one notice for both scopes with project rows first; the AMIG-04 unowned-entry warnings; undeclared, unsupported, and malformed entries; a plugin that lists as partially installed after the move; a load with a cold clone cache; the stub notice; the user-scope stub removed from the project file; a user-scope install that leaves the project `mcp-adapter.json` alone; and the `list` row of a legacy record with no MCP trace.
- [x] **ITMIG-11**: Scenarios cover the pi-mcp-adapter override cases: a project install that keeps a user stub and writes it back on uninstall, a user plugin disabled in the project, an `/mcp-adapter enable` that survives, an update that drops a server and a later version that restores its choice, `openUi` and trace kept on reinstall, carried fields written back with the values the entry holds at uninstall, the ANAME-07 stub timeout, a foreign `serverChoices` key left alone, and an emptied stub removed.
- [x] **ITMIG-12**: Scenarios cover the hook cases: hook plugins in both scopes still run after an `apply` and after a load, a reload before the first prompt drops buffered SessionStart context, and a hook dispatch creates no `.pi` directory in a project that had none.
- [x] **ITMIG-13**: Scenarios cover the auth cases: a print-mode `marketplace add` that needs a sign-in refuses and leaves no staging behind, and a host that rejects the stored credential leads to the credential being evicted and a new Device Flow sign-in.

### Rescope (ITSCOPE)

- [ ] **ITSCOPE-01**: Every case left in `test/integration/` is one of these: peer conformance against a peer's own code, a multi-process race, or an internal case (stored record fields, state that only older releases wrote, fault injection, or calls that must not happen). Any other case moves to a unit test with its source pair, or is deleted when cucumber or a unit test already covers it.
- [ ] **ITSCOPE-02**: The header of each remaining integration file names its class and the behavior that cucumber does not cover.
- [ ] **ITSCOPE-03**: The suite's charter, what belongs in an integration test and what goes to cucumber or a unit test, is written in the `typescript-unit-tests` and `cucumber` skills and in `.planning/codebase/TESTING.md`.
- [ ] **ITSCOPE-04**: `npm run check` passes on the combined tree at the end of the milestone.

## Future Requirements

None.

## Out of Scope

| Item | Reason |
|------|--------|
| Rewriting the peer conformance tables as scenarios | The 68-row expansion table, the adversarial property, and the drift guards check a peer's own functions; through `/claude:plugin` they would cost one Pi run per row and could not pin the peer's source. |
| Removing the `integration` CI job or `test:integration` | The rescoped suite still holds the conformance, race, and internal cases. |
| Internal cases that need new fault-injection harness support in cucumber | They stay as integration cases under ITSCOPE-01 (for example the EACCES unstage cases in `marketplace-layer-remove` and the refused write in `mcp-migration`). |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ITDUP-01 | Phase 1 | Complete |
| ITDUP-02 | Phase 1 | Complete |
| ITMIG-01 | Phase 2 | Complete |
| ITMIG-02 | Phase 2 | Complete |
| ITMIG-03 | Phase 2 | Complete |
| ITMIG-04 | Phase 2 | Complete |
| ITMIG-05 | Phase 3 | Complete |
| ITMIG-06 | Phase 3 | Complete |
| ITMIG-07 | Phase 7 | Pending |
| ITMIG-08 | Phase 4 | Complete |
| ITMIG-09 | Phase 5 | Complete |
| ITMIG-10 | Phase 5 | Complete |
| ITMIG-11 | Phase 5 | Complete |
| ITMIG-12 | Phase 6 | Complete |
| ITMIG-13 | Phase 6 | Complete |
| ITSCOPE-01 | Phase 8 | Pending |
| ITSCOPE-02 | Phase 8 | Pending |
| ITSCOPE-03 | Phase 8 | Pending |
| ITSCOPE-04 | Phase 8 | Pending |

**Coverage:**
- Milestone requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-11-20*
*Last updated: 2026-11-20 after roadmap creation (8 phases)*
