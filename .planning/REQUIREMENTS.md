# Requirements: pi-claude-marketplace - Milestone v1.18 Manifest-Independent Installed Plugin Info

**Defined:** 2026-08-07
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact - atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** Installed plugins remain accurately visible, inspectable, and uninstallable when their entry disappears from a successfully loaded marketplace manifest, without new persisted orphan state or changed update behavior.

## v1 Requirements

### Installed Inventory

- [x] **INV-01**: In the default plugin list, an enabled fully supported installation record whose name is absent from a successfully loaded marketplace manifest appears under that marketplace as `● <plugin> v<recorded-version> (installed) {not in manifest}`.
- [x] **INV-02**: An enabled installation record with one or more persisted `compatibility.unsupported` kinds retains the existing `(partially-installed)` status and unsupported-kind reasons, with `not in manifest` added first. Manifest-absent partial records are already classified from `compatibility.unsupported` alone, which is manifest-independent, so they are neither flattened to `(installed)` nor omitted today; adding the reason is the only change. Pin the existing classification with a characterization test before touching it.
- [x] **INV-03**: `plugin list --installed` includes both fully installed and partially-installed manifest-absent records. This already holds; the requirement is regression coverage, not new behavior.
- [x] **INV-04**: A disabled installation record absent from a successfully loaded manifest remains `(disabled)` without a `{not in manifest}` reason. Scope is the canonical disabled shape only -- `enabled: false` with `compatibility.installable: true` -- because the partial-disabled shape is not recognized as disabled by any surface until ENBL-05 repairs the predicate in Phase 97. Do not pin the current partial-disabled rendering as correct here; ENBL-06 widens this coverage after the repair.
- [x] **INV-05**: The LLM tool surface forwards reasons for `installed` and `partially-installed` rows, joining the `unavailable` / `partially-available` / `upgradable` set already handled by `pluginReasons`. Without it, `{not in manifest}` renders on the slash command and silently vanishes from the tool payload. This also closes a pre-existing loss unrelated to manifest absence: `projectRowStatus` already flattens `installed`, `upgradable`, `partially-installed`, and `partially-upgradable` into a single `installed` tool status, so a degraded install is today indistinguishable from a clean one and its unsupported-kind reasons are discarded. `PluginPartiallyInstalledMessage.reasons` is required and drops in cleanly; `PluginInstalledMessage.reasons` is optional and needs an undefined guard before the length check. Adds no status token, reason token, glyph, state field, migration, or network path, so COMPAT-01 continues to hold. (Entered scope 2026-08-08 by operator decision at Phase 95 discuss, reversing the same-milestone exclusion; rationale D-95-06 / D-95-07.)

### Plugin Information

<!-- INFO numbering continues from v1.8 (INFO-01..08). -->

- [x] **INFO-09**: `plugin info` reports an enabled fully supported installation record absent from a successfully loaded manifest as `(installed) {not in manifest}`, using the version from the installation record.
- [x] **INFO-10**: `plugin info` preserves `(partially-installed)` and the reasons derived from persisted `compatibility.unsupported`, adding `not in manifest` first, when the manifest-absent installation record contains unsupported kinds. This governs the installation-record-backed arm only. `info` today derives `(partially-installed)` from the live resolver on the path-source arm and from the persisted record on every other source arm; v1.18 does not unify those two derivations, and the state-only arm follows the persisted record.
- [ ] **INFO-11**: `plugin info` reconstructs the installed component inventory from existing local installation data: skills from `resources.skills`, commands from `resources.prompts`, agents from `resources.agents`, MCP servers from `resources.mcpServers`, and hook entries from the materialized hook configuration associated with `resources.hooks`. The four name-list kinds render sorted; hook entries preserve materialized declaration order, which is the existing contract for that kind. Two fidelity limits apply and must be documented rather than engineered away: the names in `resources.*` are the Pi-generated installed names (`<plugin>-<skill>`, `<plugin>:<command>`, `pi-claude-marketplace-<plugin>-<agent>`) rather than the original source names a manifest-backed `info` renders, with MCP servers the sole exception because `resources.mcpServers` holds raw source keys; and the materialized `hooks.json` holds only the supported filtered subset, so displayed hooks are not the plugin's full declaration. Reading that file goes through the `assertPathInside` containment guard, because the slug is state-supplied data. Whether to render generated names or reverse-map them to source names is an open decision -- see the roadmap.
- [ ] **INFO-12**: Manifest-absent installation-record fallback is network-free, including when the caller supplies `info --fetch`; no missing manifest entry is fetched or synthesized. Today this holds only by construction: the early `not in manifest` return precedes every fetch-capable row builder. The Phase 96 reorder makes those builders reachable for the state-only arm, so this requirement becomes a guard that must be written and asserted against an injected clone/auth seam, not a property inherited for free.

### Failure Boundaries

- [x] **BOUND-01**: Missing, unreadable, malformed, or invalid marketplace manifests retain the existing manifest-read failure output on list and info; `{not in manifest}` is emitted only after a manifest loads successfully and its plugin lookup misses. The authoritative description of that existing output is `docs/output-catalog.md` and the current tests -- a bare `(failed)` marketplace header with no child rows. The PRD's PL-6 row describes the retired v1 renderer and is not authoritative; DOC-08 corrects it.
- [x] **BOUND-02**: A targeted plugin name absent from both a successfully loaded manifest and the marketplace installation records remains `(failed) {not in manifest}`. This already holds; the requirement is regression coverage.
- [x] **BOUND-03**: On the cross-scope orphan-fold path, a manifest that failed to load is distinguished from a manifest that loaded without the entry. The fold path currently discards the load error, so an absent manifest entry is indistinguishable from an unread manifest; it must thread the load error the way the primary path does. `{not in manifest}` is never emitted for a folded row whose manifest was never successfully read.

### Lifecycle Compatibility

<!-- LIFE numbering continues from v1.13 (LIFE-01..03). -->

- [ ] **LIFE-04**: A manifest-absent installed plugin remains fully uninstallable through its existing installation record, with every owned resource and the plugin record removed through the normal uninstall path. This already holds -- `uninstall` imports no manifest or resolver module -- so the requirement is regression coverage spanning all five resource kinds, including hooks and MCP cleanup.
- [ ] **LIFE-05**: Targeted and bulk plugin update retain their existing `(skipped) {not in manifest}` behavior for a recorded plugin whose entry is absent from the successfully loaded manifest. This already holds; coverage must span the targeted, marketplace-bulk, and global-bulk enumeration paths.
- [ ] **LIFE-06**: Marketplace autoupdate retains its existing `(skipped) {not in manifest}` behavior for a recorded plugin whose entry is absent from the successfully loaded manifest. This already holds; the skip originates in the shared update preflight and is re-narrowed by the cascade mapper, so cover the autoupdate-on-marketplace-update path explicitly.

### Enable/Disable State Classification

<!-- ENBL numbering continues from v1.12 (ENBL-01..04). -->

These repair a live violation of ENBL-04, which v1.12 shipped as "disabled status
renders distinct from soft-degraded `unavailable` on list/info surfaces (declared
/ enabled / available are orthogonal facts)." The disabled-state predicate
conjoins `compatibility.installable` with `!enabled`, and a partial install always
persists `installable: false`, so disabling a partially-installed plugin produces a
record no surface recognizes as disabled — coupling enabled-ness to
available-ness, which is exactly the orthogonality ENBL-04 asserts. Full
diagnosis: the `disabled-partial-record-unrecognized` debug session.

- [ ] **ENBL-05**: The disabled-state predicate depends only on the `enabled` field, never on `compatibility.installable`. It has one definition that every surface consumes, replacing the four copies that can drift independently. The textual drift-guard asserting the predicate body and the truth-table cell that currently pins the defective behavior as intended are both updated.
- [ ] **ENBL-06**: `plugin list` and `plugin info` render a disabled partially-installed record as `(disabled)`, distinct from an enabled partially-installed record, completing ENBL-04 for the partial case. This composes with INV-04: a manifest-absent disabled partial record is `(disabled)` with no `{not in manifest}` reason.
- [ ] **ENBL-07**: `plugin enable` re-materializes a disabled partially-installed record instead of reporting idempotent success, and `plugin disable` reports idempotent success on an already-disabled partial record instead of re-running the unstage cascade.
- [ ] **ENBL-08**: Load-time reconcile reaches steady state for a disabled partially-installed record: a config declaring the plugin disabled does not re-plan a disable on every pass.
- [ ] **ENBL-09**: `plugin update` leaves a disabled partially-installed record alone rather than re-staging its artifacts, matching the existing disabled-record short-circuit.

Repairing the predicate is a read-time change, so records already on disk in the
unrecognized shape are reclassified correctly on the next load with no state
migration, no schema-version bump, and no persisted change.

### Compatibility and Documentation

<!-- DOC numbering continues from v1.17 (DOC-06/07). -->

- [ ] **COMPAT-01**: The feature introduces no manifest snapshot, orphan field, state-schema migration, status token, reason token, glyph, or new network path; it derives the read-surface condition from the valid manifest and existing installation record. The network clause is already enforced for both `info` surfaces by the existing architecture gate. Any new source-scanning gate must read files directly rather than shelling out to `grep`: `orchestrators/plugin/info.ts` contains a literal NUL byte, so `grep` classifies it as binary and silently skips the one file this milestone changes most.
- [ ] **DOC-08**: `docs/output-catalog.md` and `docs/prd/pi-claude-marketplace-prd.md` document the manifest-independent list/info behavior, partial-install preservation, failure boundary, and unchanged lifecycle behavior. This also settles four known documentation defects: the PRD's PL-6 row and its section 5.3.1 flowchart still describe the retired v1 manifest-failure renderer; the output catalog's brace-bearing-variant count is stale; `(partially-installed)` is missing from the catalog's status-token reference table despite being a closed-set member; and the `notify-reasons.ts` header comments still describe a 37-entry reason set that now holds 38. The disabled-state repair is documented too: `(disabled)` now covers the partial case, and the reconcile comment asserting that only the disable orchestrator writes `enabled: false` is corrected.

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
| Full-fidelity hook reconstruction | The materialized `hooks.json` holds only the supported filtered subset, and the dropped-handler enumeration was never persisted. Displayed hooks are what survived install, not what the plugin declared. |
| An `info` tool on the LLM surface | No `info` tool exists today. INV-05 widens the existing `list` tool's reason projection only; adding a new tool is a separate surface change. |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
| --- | --- | --- |
| INV-01 | Phase 95 | Complete |
| INV-02 | Phase 95 | Complete |
| INV-03 | Phase 95 | Complete |
| INV-04 | Phase 95 | Complete |
| INV-05 | Phase 95 | Complete |
| INFO-09 | Phase 96 | Complete |
| INFO-10 | Phase 96 | Complete |
| INFO-11 | Phase 96 | Partial (four name-list kinds delivered; hooks kind pending in 96-02) |
| INFO-12 | Phase 96 | Pending |
| BOUND-01 | Phase 96 | Complete |
| BOUND-02 | Phase 96 | Complete |
| BOUND-03 | Phase 95 | Complete |
| ENBL-05 | Phase 97 | Pending |
| ENBL-06 | Phase 97 | Pending |
| ENBL-07 | Phase 97 | Pending |
| ENBL-08 | Phase 97 | Pending |
| ENBL-09 | Phase 97 | Pending |
| LIFE-04 | Phase 98 | Pending |
| LIFE-05 | Phase 98 | Pending |
| LIFE-06 | Phase 98 | Pending |
| COMPAT-01 | Phase 98 | Pending |
| DOC-08 | Phase 98 | Pending |

**Coverage:**

- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

Eight of the twenty-two -- INV-02, INV-03, INV-04, BOUND-01, BOUND-02, LIFE-04,
LIFE-05, LIFE-06 -- describe behavior the code already exhibits. They are carried
as requirements because they are contracts this milestone must not break, and
their deliverable is characterization and regression coverage rather than new
behavior. The net-new work is INV-01, INV-05, BOUND-03, INFO-09 through INFO-12,
ENBL-05 through ENBL-09, COMPAT-01, and DOC-08.

ENBL-05 through ENBL-09 are corrective rather than additive: they repair a
shipped requirement (ENBL-04) that the partial-install feature silently broke.
They entered scope on 2026-08-07 by operator decision, after being recorded as
out of scope earlier the same day.

---

_Requirements defined: 2026-08-07_
_Last updated: 2026-08-08 by quick task 260808-dhm: added INV-05 (LLM tool-surface
reason widening) per the Phase 95 discuss decision D-95-06, and replaced the
corresponding Out of Scope row with the narrower "no `info` tool" exclusion
(22/22 requirements mapped)_

_Previously: 2026-08-07 after two-review codebase validation (quick task
260807-q0v): added BOUND-03, narrowed INV-04, disambiguated INFO-10, and recorded
the INFO-11 fidelity limits_
