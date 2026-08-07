# Requirements: pi-claude-marketplace - Milestone v1.18 Manifest-Independent Installed Plugin Info

**Defined:** 2026-08-07
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact - atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Installed plugins remain accurately visible, inspectable, and uninstallable when their entry disappears from a successfully loaded marketplace manifest, without new persisted orphan state or changed update behavior.

## v1 Requirements

### Installed Inventory

- [ ] **INV-01**: In the default plugin list, an enabled fully supported installation record whose name is absent from a successfully loaded marketplace manifest appears under that marketplace as `● <plugin> v<recorded-version> (installed) {not in manifest}`.
- [ ] **INV-02**: An enabled installation record with one or more persisted `compatibility.unsupported` kinds retains the existing `(partially-installed)` status and unsupported-kind reasons, with `not in manifest` added first. Manifest-absent partial records are already classified from `compatibility.unsupported` alone, which is manifest-independent, so they are neither flattened to `(installed)` nor omitted today; adding the reason is the only change. Pin the existing classification with a characterization test before touching it.
- [ ] **INV-03**: `plugin list --installed` includes both fully installed and partially-installed manifest-absent records. This already holds; the requirement is regression coverage, not new behavior.
- [ ] **INV-04**: A disabled installation record absent from a successfully loaded manifest remains `(disabled)` without a `{not in manifest}` reason. Scope is the canonical disabled shape only -- `enabled: false` with `compatibility.installable: true`. Records combining `enabled: false` with `compatibility.installable: false` are excluded; see Out of Scope.

### Plugin Information

<!-- INFO numbering continues from v1.8 (INFO-01..08). -->

- [ ] **INFO-09**: `plugin info` reports an enabled fully supported installation record absent from a successfully loaded manifest as `(installed) {not in manifest}`, using the version from the installation record.
- [ ] **INFO-10**: `plugin info` preserves `(partially-installed)` and the reasons derived from persisted `compatibility.unsupported`, adding `not in manifest` first, when the manifest-absent installation record contains unsupported kinds. This governs the installation-record-backed arm only. `info` today derives `(partially-installed)` from the live resolver on the path-source arm and from the persisted record on every other source arm; v1.18 does not unify those two derivations, and the state-only arm follows the persisted record.
- [ ] **INFO-11**: `plugin info` reconstructs the installed component inventory from existing local installation data: skills from `resources.skills`, commands from `resources.prompts`, agents from `resources.agents`, MCP servers from `resources.mcpServers`, and hook entries from the materialized hook configuration associated with `resources.hooks`. The four name-list kinds render sorted; hook entries preserve materialized declaration order, which is the existing contract for that kind. Two fidelity limits apply and must be documented rather than engineered away: the names in `resources.*` are the Pi-generated installed names (`<plugin>-<skill>`, `<plugin>:<command>`, `pi-claude-marketplace-<plugin>-<agent>`) rather than the original source names a manifest-backed `info` renders, with MCP servers the sole exception because `resources.mcpServers` holds raw source keys; and the materialized `hooks.json` holds only the supported filtered subset, so displayed hooks are not the plugin's full declaration. Reading that file goes through the `assertPathInside` containment guard, because the slug is state-supplied data. Whether to render generated names or reverse-map them to source names is an open decision -- see the roadmap.
- [ ] **INFO-12**: Manifest-absent installation-record fallback is network-free, including when the caller supplies `info --fetch`; no missing manifest entry is fetched or synthesized. Today this holds only by construction: the early `not in manifest` return precedes every fetch-capable row builder. The Phase 96 reorder makes those builders reachable for the state-only arm, so this requirement becomes a guard that must be written and asserted against an injected clone/auth seam, not a property inherited for free.

### Failure Boundaries

- [ ] **BOUND-01**: Missing, unreadable, malformed, or invalid marketplace manifests retain the existing manifest-read failure output on list and info; `{not in manifest}` is emitted only after a manifest loads successfully and its plugin lookup misses. The authoritative description of that existing output is `docs/output-catalog.md` and the current tests -- a bare `(failed)` marketplace header with no child rows. The PRD's PL-6 row describes the retired v1 renderer and is not authoritative; DOC-08 corrects it.
- [ ] **BOUND-02**: A targeted plugin name absent from both a successfully loaded manifest and the marketplace installation records remains `(failed) {not in manifest}`. This already holds; the requirement is regression coverage.
- [ ] **BOUND-03**: On the cross-scope orphan-fold path, a manifest that failed to load is distinguished from a manifest that loaded without the entry. The fold path currently discards the load error, so an absent manifest entry is indistinguishable from an unread manifest; it must thread the load error the way the primary path does. `{not in manifest}` is never emitted for a folded row whose manifest was never successfully read.

### Lifecycle Compatibility

<!-- LIFE numbering continues from v1.13 (LIFE-01..03). -->

- [ ] **LIFE-04**: A manifest-absent installed plugin remains fully uninstallable through its existing installation record, with every owned resource and the plugin record removed through the normal uninstall path. This already holds -- `uninstall` imports no manifest or resolver module -- so the requirement is regression coverage spanning all five resource kinds, including hooks and MCP cleanup.
- [ ] **LIFE-05**: Targeted and bulk plugin update retain their existing `(skipped) {not in manifest}` behavior for a recorded plugin whose entry is absent from the successfully loaded manifest. This already holds; coverage must span the targeted, marketplace-bulk, and global-bulk enumeration paths.
- [ ] **LIFE-06**: Marketplace autoupdate retains its existing `(skipped) {not in manifest}` behavior for a recorded plugin whose entry is absent from the successfully loaded manifest. This already holds; the skip originates in the shared update preflight and is re-narrowed by the cascade mapper, so cover the autoupdate-on-marketplace-update path explicitly.

### Compatibility and Documentation

<!-- DOC numbering continues from v1.17 (DOC-06/07). -->

- [ ] **COMPAT-01**: The feature introduces no manifest snapshot, orphan field, state-schema migration, status token, reason token, glyph, or new network path; it derives the read-surface condition from the valid manifest and existing installation record. The network clause is already enforced for both `info` surfaces by the existing architecture gate. Any new source-scanning gate must read files directly rather than shelling out to `grep`: `orchestrators/plugin/info.ts` contains a literal NUL byte, so `grep` classifies it as binary and silently skips the one file this milestone changes most.
- [ ] **DOC-08**: `docs/output-catalog.md` and `docs/prd/pi-claude-marketplace-prd.md` document the manifest-independent list/info behavior, partial-install preservation, failure boundary, and unchanged lifecycle behavior. This also settles four known documentation defects: the PRD's PL-6 row and its section 5.3.1 flowchart still describe the retired v1 manifest-failure renderer; the output catalog's brace-bearing-variant count is stale; `(partially-installed)` is missing from the catalog's status-token reference table despite being a closed-set member; and the `notify-reasons.ts` header comments still describe a 37-entry reason set that now holds 38.

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
| Fixing the disabled-plus-partial classification defect | `isRecordedButDisabled` conjoins `compatibility.installable` with `!enabled`, and a partial install always persists `installable: false`, so disabling a partially-installed plugin produces a record no surface recognizes as disabled. The fallout reaches enable, disable, reconcile, update, and info, needs a drift-guard test updated, and is unrelated to manifest independence. Track separately; INV-04 is narrowed to the canonical disabled shape. |
| Full-fidelity hook reconstruction | The materialized `hooks.json` holds only the supported filtered subset, and the dropped-handler enumeration was never persisted. Displayed hooks are what survived install, not what the plugin declared. |
| Extending the LLM tool surface to carry the new reason | The tool projection forwards reasons only for `unavailable`, `partially-available`, and `upgradable`, and no `info` tool exists at all. Widening it is a separate surface change; pending the open decision, the new reason renders on the slash command only. |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
| --- | --- | --- |
| INV-01 | Phase 95 | Pending |
| INV-02 | Phase 95 | Pending |
| INV-03 | Phase 95 | Pending |
| INV-04 | Phase 95 | Pending |
| INFO-09 | Phase 96 | Pending |
| INFO-10 | Phase 96 | Pending |
| INFO-11 | Phase 96 | Pending |
| INFO-12 | Phase 96 | Pending |
| BOUND-01 | Phase 96 | Pending |
| BOUND-02 | Phase 96 | Pending |
| BOUND-03 | Phase 95 | Pending |
| LIFE-04 | Phase 97 | Pending |
| LIFE-05 | Phase 97 | Pending |
| LIFE-06 | Phase 97 | Pending |
| COMPAT-01 | Phase 97 | Pending |
| DOC-08 | Phase 97 | Pending |

**Coverage:**

- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

Eight of the sixteen -- INV-02, INV-03, INV-04, BOUND-01, BOUND-02, LIFE-04,
LIFE-05, LIFE-06 -- describe behavior the code already exhibits. They are carried
as requirements because they are contracts this milestone must not break, and
their deliverable is characterization and regression coverage rather than new
behavior. The net-new work is INV-01, BOUND-03, INFO-09 through INFO-12,
COMPAT-01, and DOC-08.

---

_Requirements defined: 2026-08-07_
_Last updated: 2026-08-07 after two-review codebase validation (quick task 260807-q0v): added BOUND-03, narrowed INV-04, disambiguated INFO-10, and recorded the INFO-11 fidelity limits (16/16 requirements mapped)_
