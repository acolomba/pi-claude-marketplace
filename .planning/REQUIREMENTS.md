# Requirements: pi-claude-marketplace v1.1 Reinstall Command

**Defined:** 2026-05-13
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## v1.1 Requirements

Requirements for the Reinstall Command milestone. Each maps to exactly one roadmap phase.

### Plugin Reinstall

- [ ] **PRL-01**: User can run `/claude:plugin reinstall` as a top-level plugin lifecycle command with a clear `Usage:` block
- [x] **PRL-02**: User can reinstall one installed plugin with `reinstall <plugin>@<marketplace>`
- [ ] **PRL-03**: User can reinstall every installed plugin in one marketplace with `reinstall @<marketplace>`
- [ ] **PRL-04**: User can reinstall every installed plugin in the selected scope set with bare `reinstall`
- [ ] **PRL-05**: User can pass `--scope user|project` at any argument position, with scope resolution matching `update`
- [x] **PRL-06**: Reinstall targets installed plugins only; empty target sets succeed with `No plugins installed.` and no reload hint
- [x] **PRL-07**: Reinstall uses cached marketplace manifests only and never performs network sync or Git operations
- [x] **PRL-08**: Reinstall preserves the installed record's existing version instead of recomputing or upgrading it
- [x] **PRL-09**: Reinstall prepares replacement resources before removing old resources
- [x] **PRL-10**: If reinstall preflight, preparation, replacement, or state save fails, the previously installed plugin state, resources, and data directory remain available
- [x] **PRL-11**: Reinstall deletes the plugin data directory only after replacement resources and state commit succeed
- [x] **PRL-12**: Plugin data-directory cleanup failure is reported as a warning without turning a successful reinstall into a failed reinstall
- [ ] **PRL-13**: Batch reinstall continues per plugin and reports deterministic success/skipped/failed partitions without corrupting other plugins
- [ ] **PRL-14**: Successful reinstall emits the existing `refresh` reload hint only when generated resources changed
- [ ] **PRL-15**: Successful reinstall includes existing soft-dependency warnings when agents or MCP servers are restaged and the relevant Pi companion plugin is unloaded
- [x] **PRL-16**: Tab completion includes `reinstall`, completes installed plugin refs, supports `@<marketplace>` form, and preserves existing completion failure semantics

## Future Requirements

Deferred to future milestones. Tracked but not in the current roadmap.

### Plugin Lifecycle Enhancements

- **PRL-F01**: User can preview reinstall effects with a dry-run mode
- **PRL-F02**: User can request structured JSON output for reinstall results
- **PRL-F03**: User can choose plugins to reinstall through an interactive selector
- **PRL-F04**: LLM tools can invoke mutating plugin lifecycle operations after an explicit safety design exists

## Out of Scope

Explicitly excluded for v1.1. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Installing absent plugins via `reinstall` | `reinstall` is installed-only; use `install` for absent plugins |
| Network refresh or Git sync during reinstall | Milestone requires cached manifests and recorded versions; use `update` / `marketplace update` for refresh semantics |
| Autoupdate cascade | Reinstall is an explicit user command, not a marketplace refresh side effect |
| Mutating LLM tool for reinstall | Current LLM tool surface remains read-only |
| Interactive selector / dry-run / JSON output | Useful future UX, but not required for atomic reinstall semantics |
| Claude `local` scope | No Pi equivalent; existing two-scope model remains unchanged |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| PRL-01 | Phase 9 | Pending |
| PRL-02 | Phase 8 | Complete |
| PRL-03 | Phase 9 | Pending |
| PRL-04 | Phase 9 | Pending |
| PRL-05 | Phase 9 | Pending |
| PRL-06 | Phase 8 | Complete |
| PRL-07 | Phase 8 | Complete |
| PRL-08 | Phase 8 | Complete |
| PRL-09 | Phase 8 | Complete |
| PRL-10 | Phase 8 | Complete |
| PRL-11 | Phase 8 | Complete |
| PRL-12 | Phase 8 | Complete |
| PRL-13 | Phase 9 | Pending |
| PRL-14 | Phase 9 | Pending |
| PRL-15 | Phase 9 | Pending |
| PRL-16 | Phase 9 | Complete |

**Coverage:**
- v1.1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-13 after v1.1 milestone requirements confirmation*
*Last updated: 2026-05-13 after roadmap creation*
*Last updated: 2026-05-14 after Phase 8 completion*
