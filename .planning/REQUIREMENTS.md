# Requirements: pi-claude-marketplace — lifecycle-coverage

**Defined:** 2026-10-22
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Milestone goal:** The cucumber suite covers every `/claude:plugin` lifecycle command, so a regression in plugin install, enable, update, or any other lifecycle behavior fails a scenario named after it.

Each behavior requirement is met by at least one scenario under `features/`
that compares the whole command result (payload kind, status, reasons,
severity, needs-reload) and, where the command changes what a session offers,
what a new session offers. Scenarios follow the existing suite (the `cucumber`
skill, `features/plugin/*.feature`, `features/marketplace/*.feature`, and the
stand-ins in `features/lib/`). Test plugins carry skills only.

**Bug policy:** a scenario that exposes a product bug fixes it in the same
phase, with Claude Code's `/plugin` behavior as the reference. The run stops
for the user only when Claude Code plainly contradicts an established
pi-claude-marketplace principle and the precedent of other commands does not
settle which one wins (see PROJECT.md).

## v1 Requirements

### Suite foundation

- [x] **FND-01**: Step definitions and driver support that more than one later phase needs (plugin fixtures with dependencies, unsupported components, git-source plugins, hand-edited configs, an occupied state lock, a planted plugin data file) exist before the phases that use them, so each later phase adds only its own feature file and steps local to it
- [x] **FND-02**: The usage gate (`cucumber-js --dry-run --format usage`) stays green: no unused, undefined, or ambiguous step

### enable / disable

- [ ] **ENA-01**: Enabling a disabled plugin makes a new session offer its skills again and keeps one installation record
- [ ] **ENA-02**: Disabling an enabled plugin makes a new session offer none of its skills and keeps the plugin installed (`list` shows it disabled)
- [ ] **ENA-03**: Enabling an enabled plugin, and disabling a disabled one, is skipped as a no-op with the matching reason
- [ ] **ENA-04**: Enable and disable work in the user scope and the project scope, each changing only the named scope
- [ ] **ENA-05**: Enabling a plugin whose dependencies are disabled or absent enables or installs them; disabling a plugin that an enabled plugin depends on behaves as Claude Code does (refused or cascaded, matched to upstream)
- [ ] **ENA-06**: Enable and disable of a plugin that is not installed fail with the not-installed reason

### install

- [ ] **INS-01**: Installing a plugin that declares dependencies installs the whole closure in dependency order and reports each member
- [ ] **INS-02**: A dependency closure that cannot be resolved (a missing dependency, an unsatisfiable version constraint) installs nothing
- [ ] **INS-03**: Installing a partially available plugin (skills plus an unsupported component) fails without `--partial` and installs the supported part with `--partial`, and `info` names what was left out
- [ ] **INS-04**: Installing into the user scope with no `--scope` and with `--scope user` records it in the user scope only, and a new session in any project offers its skills
- [ ] **INS-05**: A plugin with a git, a github, or a url source installs from the loopback git host; a second install of the same pinned source reuses the clone and makes no request
- [ ] **INS-06**: A plugin source the host refuses (404, 401, connection drop) fails with the matching reason and leaves no record, clone, or skill behind
- [ ] **INS-07**: An install that fails partway (a phase cannot write its target) rolls back every artifact it wrote, and a retry succeeds once the cause is gone

### uninstall

- [ ] **UNI-01**: Uninstalling removes the plugin data directory, and `--keep-data` keeps it with its contents
- [ ] **UNI-02**: `uninstall --prune` also removes the dependencies that no other plugin needs, and keeps the ones another plugin still needs
- [ ] **UNI-03**: Uninstalling a plugin installed from a git source removes its clone from `plugin-clones/` when no other installation uses it

### update

- [ ] **UPD-01**: `update @<marketplace>` updates every outdated plugin of that marketplace and leaves the plugins of other marketplaces unchanged
- [ ] **UPD-02**: Updating a git-source plugin fetches the new revision on a cache miss and makes no request when the cache already holds it
- [ ] **UPD-03**: A dependency whose version constraint the new version breaks blocks the update and changes nothing
- [ ] **UPD-04**: An update that fails partway keeps the installed version, its skills, and its record
- [ ] **UPD-05**: `update --partial` updates a plugin whose new version became partially available, and fails without the flag

### reinstall

- [ ] **REI-01**: Reinstalling one installed plugin rewrites its artifacts at the same version and reports it reinstalled
- [ ] **REI-02**: Reinstalling a plugin whose skill files were deleted restores them, and a new session offers the skills again
- [ ] **REI-03**: Reinstalling a plugin that is not installed fails with the not-installed reason

### list

- [ ] **LST-01**: `list` shows installed, available, unavailable, and partially available plugins with their status and scope
- [ ] **LST-02**: `--installed`, `--available`, `--unavailable`, and `--partial` each keep only their rows, and combined filters keep the union
- [ ] **LST-03**: `list <marketplace>` keeps only that marketplace's plugins, and an unknown marketplace fails as not added
- [ ] **LST-04**: `list --remote` reports plugins whose source has a newer revision on the git host, and `list` without it makes no request
- [ ] **LST-05**: `list --scope user` and `--scope project` keep only that scope's installations

### info

- [ ] **INF-01**: `info` on an installed plugin shows its version, scope, source, and the skills it provides
- [ ] **INF-02**: `info` on an available but not installed plugin shows what installing it would provide
- [ ] **INF-03**: `info` on a partially available or unavailable plugin names the reasons
- [ ] **INF-04**: `info --fetch` reads the remote source and reports a newer revision, and `info` without it makes no request
- [ ] **INF-05**: `info` on a plugin the marketplace does not offer fails as not in the manifest

### pending

- [ ] **PND-01**: `pending` lists the installs, uninstalls, enables, and disables a hand-edited config would cause, and is empty when config and records agree
- [ ] **PND-02**: `pending --scope` keeps only that scope's changes

### Reconcile on a new session

- [ ] **REC-01**: A plugin added to a config by hand is installed by the next session, which offers its skills
- [ ] **REC-02**: A plugin removed from a config by hand is uninstalled by the next session
- [ ] **REC-03**: A plugin set to enabled or disabled in a config by hand is enabled or disabled by the next session
- [ ] **REC-04**: A reconcile that cannot install a plugin reports it and leaves the other changes applied

### fetch

- [ ] **FET-01**: `fetch <plugin>@<marketplace>` refreshes the cached source of a git-source plugin from the host without installing a new version
- [ ] **FET-02**: `fetch @<marketplace>` and a bare `fetch` refresh every git-source plugin in scope, continuing after one fails
- [ ] **FET-03**: `fetch` of a path-source plugin makes no request and reports nothing to fetch

### prune

- [ ] **PRN-01**: `prune` removes orphaned dependencies and unused clones and reports each one
- [ ] **PRN-02**: `prune --dry-run` reports the same rows and removes nothing
- [ ] **PRN-03**: `prune` with nothing to remove reports an empty result

### import

- [ ] **IMP-01**: `import` reads the enabled plugins and extra known marketplaces from a Claude Code settings file in the sandbox, adds the marketplaces, and installs the plugins
- [ ] **IMP-02**: Running `import` again is a no-op
- [ ] **IMP-03**: An enabled plugin the marketplace cannot provide is reported unavailable and does not stop the rest
- [ ] **IMP-04**: `import --scope` limits the import to that scope's settings

### bootstrap, browse, help

- [ ] **BOO-01**: `bootstrap` adds the official marketplace to the user scope through the GitHub base override, and a second run is a no-op
- [ ] **BOO-02**: `bootstrap` with an argument or `--scope` is rejected with its usage
- [ ] **BRW-01**: `browse` outside the TUI is refused with a message that names `list`
- [ ] **HLP-01**: `help` shows the plugin usage, and `help <unknown topic>` is rejected

### Usage errors

- [ ] **USE-01**: Every plugin subcommand rejects a flag it does not accept, extra positional arguments, and a bad `--scope` value, matching the marketplace usage-error feature

### Failure behavior

- [ ] **FLR-01**: A plugin command run while another process holds the scope's state lock fails with the lock-held reason and changes nothing
- [ ] **FLR-02**: `marketplace add`, `remove`, and `update` run while another process holds the state lock fail with the lock-held reason and change nothing
- [ ] **FLR-03**: A `marketplace add` that fails (404, invalid manifest, connection drop) leaves no clone directory and no record behind, and a retry succeeds once the cause is gone
- [ ] **FLR-04**: `marketplace remove` deletes the `plugin-clones/` entries of the git-source plugins it uninstalls, and keeps a clone another installation still uses

## Future Requirements

- Component-kind scenarios: commands, agents (with `--map-model`), MCP servers, hooks, and workflows -- the later component milestone.
- Missing optional peers (pi-subagents, pi-mcp-adapter) degrading an install -- only agents and MCP depend on a peer, so this moves with the component milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| `--map-model` | It changes only agent frontmatter; skills-only plugins cannot observe it |
| Interactive `browse` in the TUI | The suite drives Pi in RPC mode; the TUI component is not reachable |
| GitHub device-flow authentication | Needs a real GitHub OAuth endpoint; the stored-credential path is already covered |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| ENA-01 | Phase 2 | Pending |
| ENA-02 | Phase 2 | Pending |
| ENA-03 | Phase 2 | Pending |
| ENA-04 | Phase 2 | Pending |
| ENA-05 | Phase 2 | Pending |
| ENA-06 | Phase 2 | Pending |
| INS-01 | Phase 3 | Pending |
| INS-02 | Phase 3 | Pending |
| INS-03 | Phase 3 | Pending |
| INS-04 | Phase 3 | Pending |
| INS-05 | Phase 4 | Pending |
| INS-06 | Phase 4 | Pending |
| INS-07 | Phase 5 | Pending |
| UNI-01 | Phase 6 | Pending |
| UNI-02 | Phase 6 | Pending |
| UNI-03 | Phase 4 | Pending |
| UPD-01 | Phase 7 | Pending |
| UPD-02 | Phase 4 | Pending |
| UPD-03 | Phase 7 | Pending |
| UPD-04 | Phase 5 | Pending |
| UPD-05 | Phase 7 | Pending |
| REI-01 | Phase 8 | Pending |
| REI-02 | Phase 8 | Pending |
| REI-03 | Phase 8 | Pending |
| LST-01 | Phase 9 | Pending |
| LST-02 | Phase 9 | Pending |
| LST-03 | Phase 9 | Pending |
| LST-04 | Phase 9 | Pending |
| LST-05 | Phase 9 | Pending |
| INF-01 | Phase 10 | Pending |
| INF-02 | Phase 10 | Pending |
| INF-03 | Phase 10 | Pending |
| INF-04 | Phase 10 | Pending |
| INF-05 | Phase 10 | Pending |
| PND-01 | Phase 11 | Pending |
| PND-02 | Phase 11 | Pending |
| REC-01 | Phase 11 | Pending |
| REC-02 | Phase 11 | Pending |
| REC-03 | Phase 11 | Pending |
| REC-04 | Phase 11 | Pending |
| FET-01 | Phase 12 | Pending |
| FET-02 | Phase 12 | Pending |
| FET-03 | Phase 12 | Pending |
| PRN-01 | Phase 12 | Pending |
| PRN-02 | Phase 12 | Pending |
| PRN-03 | Phase 12 | Pending |
| IMP-01 | Phase 13 | Pending |
| IMP-02 | Phase 13 | Pending |
| IMP-03 | Phase 13 | Pending |
| IMP-04 | Phase 13 | Pending |
| BOO-01 | Phase 14 | Pending |
| BOO-02 | Phase 14 | Pending |
| BRW-01 | Phase 14 | Pending |
| HLP-01 | Phase 14 | Pending |
| USE-01 | Phase 14 | Pending |
| FLR-01 | Phase 15 | Pending |
| FLR-02 | Phase 15 | Pending |
| FLR-03 | Phase 15 | Pending |
| FLR-04 | Phase 15 | Pending |

**Coverage:**
- v1 requirements: 61 total
- Mapped to phases: 61
- Unmapped: 0

---
*Requirements defined: 2026-10-22*
*Last updated: 2026-10-22 after roadmap creation (15 phases)*
