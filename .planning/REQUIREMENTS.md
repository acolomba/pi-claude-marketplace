# Requirements: pi-claude-marketplace - Milestone v1.18 Manifest-Independent Installed Plugin Info

**Defined:** 2026-08-07
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact - atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Installed plugins remain accurately visible, inspectable, and uninstallable when their entry disappears from a successfully loaded marketplace manifest, without new persisted orphan state or changed update behavior.

## v1 Requirements

### Installed Inventory

- [ ] **INV-01**: In the default plugin list, an enabled fully supported installation record whose name is absent from a successfully loaded marketplace manifest appears under that marketplace as `● <plugin> v<recorded-version> (installed) {not in manifest}`.
- [ ] **INV-02**: An enabled installation record with one or more persisted `compatibility.unsupported` kinds retains the existing `(partially-installed)` status and unsupported-kind reasons, with `not in manifest` added first, instead of being flattened to `(installed)` or omitted.
- [ ] **INV-03**: `plugin list --installed` includes both fully installed and partially-installed manifest-absent records.
- [ ] **INV-04**: A disabled installation record absent from a successfully loaded manifest remains `(disabled)` without a `{not in manifest}` reason.

### Plugin Information

<!-- INFO numbering continues from v1.8 (INFO-01..08). -->

- [ ] **INFO-09**: `plugin info` reports an enabled fully supported installation record absent from a successfully loaded manifest as `(installed) {not in manifest}`, using the version from the installation record.
- [ ] **INFO-10**: `plugin info` preserves `(partially-installed)` and the reasons derived from persisted `compatibility.unsupported`, adding `not in manifest` first, when the manifest-absent installation record contains unsupported kinds.
- [ ] **INFO-11**: `plugin info` reconstructs the installed component inventory from existing local installation data: skills from `resources.skills`, commands from `resources.prompts`, agents from `resources.agents`, MCP servers from `resources.mcpServers`, and hook entries from the materialized hook configuration associated with `resources.hooks`; every rendered component list retains the existing sorted-output contract.
- [ ] **INFO-12**: Manifest-absent installation-record fallback is network-free, including when the caller supplies `info --fetch`; no missing manifest entry is fetched or synthesized.

### Failure Boundaries

- [ ] **BOUND-01**: Missing, unreadable, malformed, or invalid marketplace manifests retain the existing manifest-read failure output on list and info; `{not in manifest}` is emitted only after a manifest loads successfully and its plugin lookup misses.
- [ ] **BOUND-02**: A targeted plugin name absent from both a successfully loaded manifest and the marketplace installation records remains `(failed) {not in manifest}`.

### Lifecycle Compatibility

<!-- LIFE numbering continues from v1.13 (LIFE-01..03). -->

- [ ] **LIFE-04**: A manifest-absent installed plugin remains fully uninstallable through its existing installation record, with every owned resource and the plugin record removed through the normal uninstall path.
- [ ] **LIFE-05**: Targeted and bulk plugin update retain their existing `(skipped) {not in manifest}` behavior for a recorded plugin whose entry is absent from the successfully loaded manifest.
- [ ] **LIFE-06**: Marketplace autoupdate retains its existing `(skipped) {not in manifest}` behavior for a recorded plugin whose entry is absent from the successfully loaded manifest.

### Compatibility and Documentation

- [ ] **COMPAT-01**: The feature introduces no manifest snapshot, orphan field, state-schema migration, status token, reason token, glyph, or new network path; it derives the read-surface condition from the valid manifest and existing installation record.
- [ ] **DOC-08**: `docs/output-catalog.md` and `docs/prd/pi-claude-marketplace-prd.md` document the manifest-independent list/info behavior, partial-install preservation, failure boundary, and unchanged lifecycle behavior.

## Future Requirements

None identified for this milestone.

## Out of Scope

| Feature | Reason |
| --- | --- |
| New `orphaned` or `orphaned-installed` status | Existing `(installed)` / `(partially-installed)` states remain truthful; manifest absence is expressed with the existing reason. |
| Persisted orphan flag or manifest-entry snapshot | The condition is derivable and persistence would introduce staleness plus migration work. |
| Exact dropped-component details that were never persisted | Existing records retain unsupported kinds, not every original declaration; inventing or snapshotting detail is outside this milestone. |
| Description or dependency reconstruction without a manifest entry | These are manifest-only metadata and must not be guessed from unrelated local state. |
| Update or autoupdate installation fallback | Mutation paths intentionally continue to skip when the current manifest does not declare the plugin. |
| Manifest-read recovery or error reclassification | A missing entry can only be asserted after a successful manifest load; existing read failures remain authoritative. |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
| --- | --- | --- |
| INV-01 | TBD | Pending |
| INV-02 | TBD | Pending |
| INV-03 | TBD | Pending |
| INV-04 | TBD | Pending |
| INFO-09 | TBD | Pending |
| INFO-10 | TBD | Pending |
| INFO-11 | TBD | Pending |
| INFO-12 | TBD | Pending |
| BOUND-01 | TBD | Pending |
| BOUND-02 | TBD | Pending |
| LIFE-04 | TBD | Pending |
| LIFE-05 | TBD | Pending |
| LIFE-06 | TBD | Pending |
| COMPAT-01 | TBD | Pending |
| DOC-08 | TBD | Pending |

**Coverage:**

- v1 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15

---

_Requirements defined: 2026-08-07_
_Last updated: 2026-08-07 after milestone scope confirmation_
