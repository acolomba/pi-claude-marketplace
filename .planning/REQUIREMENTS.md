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

- [x] **ENA-01**: Enabling a disabled plugin makes a new session offer its skills again and keeps one installation record
- [x] **ENA-02**: Disabling an enabled plugin makes a new session offer none of its skills and keeps the plugin installed (`list` shows it disabled)
- [x] **ENA-03**: Enabling an enabled plugin, and disabling a disabled one, is skipped as a no-op with the matching reason
- [x] **ENA-04**: Enable and disable work in the user scope and the project scope, each changing only the named scope
- [x] **ENA-05**: Enabling a plugin whose dependencies are disabled enables them, and one whose dependency is absent is refused with `{dependency unsatisfied}` as Claude Code does; disabling a plugin that an enabled plugin depends on behaves as Claude Code does (refused or cascaded, matched to upstream)
- [x] **ENA-06**: Enable and disable of a plugin that is not installed fail with the not-installed reason

### install

- [x] **INS-01**: Installing a plugin that declares dependencies installs the whole closure in dependency order (order proven by the `RESV-01` unit tests) and reports each member
- [x] **INS-02**: A dependency closure that cannot be resolved (a missing dependency, an unsatisfiable version constraint) installs nothing
- [x] **INS-03**: Installing a partially available plugin (skills plus an unsupported component) fails without `--partial` and installs the supported part with `--partial`, and `info` reports the left-out part as `unsupported component`
- [x] **INS-04**: Installing into the user scope with no `--scope` and with `--scope user` records it in the user scope only, and a new session in any project offers its skills
- [x] **INS-05**: A plugin with a git, a github, or a url source installs from the loopback git host; a second install of the same pinned source reuses the clone and makes no request
- [x] **INS-06**: A plugin source the host refuses (404, 401, connection drop) fails with the matching reason and leaves no record, clone, or skill behind
- [x] **INS-07**: An install that fails partway (a phase cannot write its target) rolls back every artifact it wrote, and a retry succeeds once the cause is gone

### uninstall

- [x] **UNI-01**: Uninstalling removes the plugin data directory, and `--keep-data` keeps it with its contents
- [x] **UNI-02**: `uninstall --prune` also removes the dependencies that no other plugin needs, and keeps the ones another plugin still needs
- [x] **UNI-03**: Uninstalling a plugin installed from a git source removes its clone from `plugin-clones/` when no other installation uses it

### update

- [x] **UPD-01**: `update @<marketplace>` updates every outdated plugin of that marketplace and leaves the plugins of other marketplaces unchanged
- [x] **UPD-02**: Updating a git-source plugin fetches the new revision on a cache miss and makes no request when the cache already holds it
- [x] **UPD-03**: An update whose new version a dependent's version constraint does not accept is blocked and changes nothing
- [x] **UPD-04**: An update that fails partway keeps the installed version, its skills, and its record
- [x] **UPD-05**: `update --partial` updates a plugin whose new version became partially available; without the flag the update is not applied and is reported as a `partially-upgradable` warning

### reinstall

- [x] **REI-01**: Reinstalling one installed plugin rewrites its artifacts at the same version and reports it reinstalled
- [x] **REI-02**: Reinstalling a plugin whose skill files were deleted restores them, and a new session offers the skills again
- [x] **REI-03**: Reinstalling a plugin that is not installed fails with the not-installed reason

### list

- [x] **LST-01**: `list` shows installed, available, unavailable, and partially available plugins with their status and scope
- [x] **LST-02**: `--installed`, `--available`, `--unavailable`, and `--partial` each keep only their rows, and combined filters keep the union
- [x] **LST-03**: `list <marketplace>` keeps only that marketplace's plugins, and an unknown marketplace fails as not added
- [x] **LST-04**: `list --remote` filters to plugins from remote (git) sources (RSTA-07), and `list` makes no network request (NFR-5)
- [x] **LST-05**: `list --scope user` and `--scope project` keep only that scope's installations

### info

- [x] **INF-01**: `info` on an installed plugin shows its version, marketplace, scope, and the skills it provides
- [x] **INF-02**: `info` on an available but not installed plugin shows what installing it would provide
- [x] **INF-03**: `info` on a partially available or unavailable plugin names the reasons
- [x] **INF-04**: `info --fetch` reads the remote source and reports a newer revision, and `info` without it makes no request
- [x] **INF-05**: `info` on a plugin the marketplace does not offer fails as not in the manifest

### pending

- [x] **PND-01**: `pending` lists the installs, uninstalls, enables, and disables a hand-edited config would cause, and is empty when config and records agree
- [x] **PND-02**: `pending --scope` keeps only that scope's changes

### Reconcile on a new session

- [x] **REC-01**: A plugin added to a config by hand is installed by the next session, which offers its skills
- [x] **REC-02**: A plugin removed from a config by hand is uninstalled by the next session
- [x] **REC-03**: A plugin set to enabled or disabled in a config by hand is enabled or disabled by the next session
- [x] **REC-04**: A reconcile that cannot install a plugin reports it and leaves the other changes applied

### fetch

- [x] **FET-01**: `fetch <plugin>@<marketplace>` refreshes the cached source of a git-source plugin from the host without installing a new version
- [x] **FET-02**: `fetch @<marketplace>` and a bare `fetch` refresh every git-source plugin in scope, continuing after one fails
- [x] **FET-03**: `fetch` of a path-source plugin makes no request and reports nothing to fetch

### prune

- [x] **PRN-01**: `prune` removes orphaned dependencies and the clones of the dependencies it removes, and reports each one (as `claude plugin prune` does; clones of plugins that are not installed are a cache that clone cleanup deletes, decision 2026-10-23)
- [x] **PRN-02**: `prune --dry-run` reports the same rows and removes nothing
- [x] **PRN-03**: `prune` with nothing to remove reports an empty result

### import

- [x] **IMP-01**: `import` reads the enabled plugins and extra known marketplaces from a Claude Code settings file in the sandbox, adds the marketplaces, and installs the plugins
- [x] **IMP-02**: Running `import` again is a no-op
- [x] **IMP-03**: An enabled plugin the marketplace cannot provide is reported unavailable and does not stop the rest
- [x] **IMP-04**: `import --scope` limits the import to that scope's settings

### bootstrap, browse, help

- [x] **BOO-01**: `bootstrap` adds the official marketplace to the user scope through the GitHub base override, and a second run is a no-op
- [x] **BOO-02**: `bootstrap` with an argument or `--scope` is rejected with its usage
- [x] **BRW-01**: `browse` outside the TUI is refused with a message that names `list`
- [x] **HLP-01**: `help` shows the plugin usage, and `help <unknown topic>` is rejected

### Usage errors

- [x] **USE-01**: Every plugin subcommand rejects a flag it does not accept, extra positional arguments, and a bad `--scope` value, matching the marketplace usage-error feature

### Failure behavior

- [x] **FLR-01**: A plugin command run while another process holds the scope's state lock fails with the lock-held reason and changes nothing
- [x] **FLR-02**: `marketplace add`, `remove`, and `update` run while another process holds the state lock fail with the lock-held reason and change nothing
- [x] **FLR-03**: A `marketplace add` that fails (404, invalid manifest, connection drop) leaves no clone directory and no record behind, and a retry succeeds once the cause is gone
- [x] **FLR-04**: `marketplace remove` deletes the `plugin-clones/` entries of the git-source plugins it uninstalls, and keeps a clone another installation still uses

### Decisions applied (2026-10-23)

- [x] **GIT-01**: An unpinned git-source install gets its own copy at the commit it installs; `fetch` refreshes only the download cache, and installed code changes only through `update` or `reinstall`
- [x] **GIT-02**: Clone cleanup keeps every per-commit copy an installation uses and deletes unused clones, including caches `fetch` warmed for plugins that are not installed
- [x] **VER-01**: `install`, `info`, and `list` derive a plugin's version with one rule: the declared version (plugin.json, then the marketplace entry) first, and `sha-<12hex>` only for a git plugin that declares none; the full commit sha stays stored
- [x] **REC-05**: A plugin that stays installed after its marketplace's catalog drops it, or whose marketplace manifest is invalid, is reported at each new session as a `warning` with the real reason (`{not in manifest}` for a catalog drop; for a broken manifest the same token `list`/`info` use: `{unparseable}`, `{source missing}`, `{permission denied}`, or `{invalid manifest}`, decision D-11) and a cause chain
- [x] **REI-04**: `reinstall` installs whatever version the marketplace currently offers, the same or newer, and records and reports that version
- [x] **UPR-01**: `update` and `reinstall` materialize the latest known version through one shared code path, with no per-plugin version pinning
- [x] **IMP-05**: `import` applies the Claude Code settings through the same desired-state path as reconcile, and never reinstalls a plugin that is already installed
- [x] **IMP-06**: `import` reports a plugin it already has as `skipped {already installed}`, and a marketplace already added with the same source as a skipped no-op at `info` severity, not `(updated)`
- [x] **IMP-07**: `import` run while another process holds the state lock fails with the lock-held reason and changes nothing, instead of `unexpected-failure`

### Decisions applied, second round (2026-10-23)

- [x] **VER-02**: Path-source plugins follow the VER-01 version rule too: `list` and `info` candidate rows show plugin.json's declared version before the marketplace entry's
- [x] **SRC-01**: A path-source plugin whose directory is missing reads `{source missing}` in `info`, `install`, and `list`, not `{unsupported source}`
- [x] **MPA-01**: `marketplace add` and `bootstrap` of a marketplace already added with the same source succeed as a no-op, reported `(skipped) {already added}` at `info` (Claude Code: "already added; nothing changed")
- [x] **MPA-02**: `marketplace add` and `marketplace update` report a marketplace manifest fault with the same token `list`/`info` use (`{unparseable}`, `{source missing}`, `{permission denied}`, `{invalid manifest}`, D-11)
- [x] **MPA-03**: `marketplace help` with an unknown flag reports `Unknown flag: "<flag>".` as `help marketplace` does
- [x] **INR-01**: A dependency whose clone the git host refuses during an install cascade reports its reason (as a direct install does), in the command and on `/reload`
- [x] **INR-02**: A staging cleanup leak keeps the original failure's reason
- [x] **INR-03**: An install pinned to a commit the remote lacks fails with a reason
- [x] **INR-04**: Both `{version conflict}` causes print a version range in the same form
- [x] **PRN-02**: `prune --dry-run` (and every `will uninstall` row) shows the plugin's version, as Claude Code's preview prints `name (version)`
- [x] **PRN-03**: `prune` under a held lock prints the lock path in its cause the same way every other command does
- [x] **UNI-01**: `uninstall` of a dependency whose only dependents are disabled behaves as Claude Code does
- [x] **IMP-08**: A first-time `import` of a plugin that cannot be installed reports the same narrowed reason `install` reports
- [x] **IMP-09**: An unclassified `import` failure is not reported as `{not in manifest}`
- [x] **IMP-10**: `import` re-enabling a partially installed plugin reports `(partially-installed)`, as reconcile does
- [x] **UPR-02**: An `update` row whose declared version did not change shows the commits: `1.0.0 (abc1234) → 1.0.0 (def5678)`
- [x] **UPR-03**: `partially-installed` and `failed` update rows carry the version (and from/to where known) as `updated` and failed install rows do
- [x] **UPR-04**: `reinstall` of a plugin that is not installed reports `failed {not installed}`, as `uninstall` does
- [x] **GIT-03**: `fetch` and `info --fetch` refresh the mirror under the state lock, so an install never copies from a mirror mid-refresh
- [x] **GIT-04**: One copy-and-checkout helper serves per-commit copies and tag clones, and it handles a directory that holds only a symlink
- [x] **GIT-05**: `info --fetch` on a cold unpinned source contacts the git host once
- [x] **INR-05**: Every dependency-range cause (`{version conflict}`, `{no matching version}`) prints the declared ranges as Claude Code does: joined with `, `, unquoted
- [x] **INR-06**: A failed pinned-commit install's cause carries no git-library advice the user cannot act on, and a pin reachable only from a tag installs on the ref-hint clone path
- [x] **REC-06**: Reconcile's own failed install reports the narrowed resolver reasons `install` and `import` report, and `import` reports a rollback-partial install as `{rollback partial}` as `install` does
- [x] **MPR-01**: `marketplace remove`'s dependents refusal ignores disabled holders, as a named `uninstall` does
- [ ] **DLS-01**: A plugin its marketplace no longer lists (installed, `{not in manifest}`) does not make the scope's dependency walk unreadable: its dependencies are read from its installed copy, so `update`, `reinstall`, `uninstall`, `enable`, and the load-time backfill of other plugins proceed; only a record whose installed copy is also unreadable fails closed

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
| ENA-01 | Phase 2 | Complete |
| ENA-02 | Phase 2 | Complete |
| ENA-03 | Phase 2 | Complete |
| ENA-04 | Phase 2 | Complete |
| ENA-05 | Phase 2 | Complete |
| ENA-06 | Phase 2 | Complete |
| INS-01 | Phase 3 | Complete |
| INS-02 | Phase 3 | Complete |
| INS-03 | Phase 3 | Complete |
| INS-04 | Phase 3 | Complete |
| INS-05 | Phase 4 | Complete |
| INS-06 | Phase 4 | Complete |
| INS-07 | Phase 5 | Complete |
| UNI-01 | Phase 6 | Complete |
| UNI-02 | Phase 6 | Complete |
| UNI-03 | Phase 4 | Complete |
| UPD-01 | Phase 7 | Complete |
| UPD-02 | Phase 4 | Complete |
| UPD-03 | Phase 7 | Complete |
| UPD-04 | Phase 5 | Complete |
| UPD-05 | Phase 7 | Complete |
| REI-01 | Phase 8 | Complete |
| REI-02 | Phase 8 | Complete |
| REI-03 | Phase 8 | Complete |
| LST-01 | Phase 9 | Complete |
| LST-02 | Phase 9 | Complete |
| LST-03 | Phase 9 | Complete |
| LST-04 | Phase 9 | Complete |
| LST-05 | Phase 9 | Complete |
| INF-01 | Phase 10 | Complete |
| INF-02 | Phase 10 | Complete |
| INF-03 | Phase 10 | Complete |
| INF-04 | Phase 10 | Complete |
| INF-05 | Phase 10 | Complete |
| PND-01 | Phase 11 | Complete |
| PND-02 | Phase 11 | Complete |
| REC-01 | Phase 11 | Complete |
| REC-02 | Phase 11 | Complete |
| REC-03 | Phase 11 | Complete |
| REC-04 | Phase 11 | Complete |
| FET-01 | Phase 12 | Complete |
| FET-02 | Phase 12 | Complete |
| FET-03 | Phase 12 | Complete |
| PRN-01 | Phase 12 | Complete |
| PRN-02 | Phase 12 | Complete |
| PRN-03 | Phase 12 | Complete |
| IMP-01 | Phase 13 | Complete |
| IMP-02 | Phase 13 | Complete |
| IMP-03 | Phase 13 | Complete |
| IMP-04 | Phase 13 | Complete |
| BOO-01 | Phase 14 | Complete |
| BOO-02 | Phase 14 | Complete |
| BRW-01 | Phase 14 | Complete |
| HLP-01 | Phase 14 | Complete |
| USE-01 | Phase 14 | Complete |
| FLR-01 | Phase 15 | Complete |
| FLR-02 | Phase 15 | Complete |
| FLR-03 | Phase 15 | Complete |
| FLR-04 | Phase 15 | Complete |
| GIT-01 | Phase 16 | Complete |
| GIT-02 | Phase 16 | Complete |
| VER-01 | Phase 16 | Complete |
| REC-05 | Phase 17 | Complete |
| REI-04 | Phase 18 | Complete |
| UPR-01 | Phase 18 | Complete |
| IMP-05 | Phase 19 | Complete |
| IMP-06 | Phase 19 | Complete |
| IMP-07 | Phase 19 | Complete |
| VER-02 | Phase 20 | Complete |
| SRC-01 | Phase 20 | Complete |
| MPA-01 | Phase 21 | Complete |
| MPA-02 | Phase 21 | Complete |
| MPA-03 | Phase 21 | Complete |
| INR-01 | Phase 22 | Complete |
| INR-02 | Phase 22 | Complete |
| INR-03 | Phase 22 | Complete |
| INR-04 | Phase 22 | Complete |
| PRN-02 | Phase 23 | Complete |
| PRN-03 | Phase 23 | Complete |
| UNI-01 | Phase 23 | Complete |
| IMP-08 | Phase 24 | Complete |
| IMP-09 | Phase 24 | Complete |
| IMP-10 | Phase 24 | Complete |
| UPR-02 | Phase 25 | Complete |
| UPR-03 | Phase 25 | Complete |
| UPR-04 | Phase 25 | Complete |
| GIT-03 | Phase 26 | Complete |
| GIT-04 | Phase 26 | Complete |
| GIT-05 | Phase 26 | Complete |
| INR-05 | Phase 27 | Complete |
| INR-06 | Phase 27 | Complete |
| REC-06 | Phase 27 | Complete |
| MPR-01 | Phase 27 | Complete |
| DLS-01 | Phase 28 | Pending |

**Coverage:**
- v1 requirements: 96 total
- Mapped to phases: 96
- Unmapped: 0

---
*Requirements defined: 2026-10-22*
*Last updated: 2026-10-23 after adding the decision phases (16-19)*
