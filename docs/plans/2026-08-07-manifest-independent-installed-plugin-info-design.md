# Manifest-Independent Installed Plugin Info Design

**Date:** 2026-08-07 **Status:** Approved for milestone planning **Milestone:** v1.18 Manifest-Independent Installed Plugin Info

## Goal

Keep installed plugins accurately visible, inspectable, and uninstallable after their entry disappears from a marketplace manifest, without adding persisted orphan state or changing update behavior.

## Problem

The extension already persists an installation record for each plugin in `state.json`. That record is sufficient to identify installed resources, retain compatibility results, and uninstall them, but the read surfaces still treat the current marketplace manifest as the sole plugin inventory:

- `plugin list` does not truthfully represent an enabled installation record whose manifest entry has disappeared.
- `plugin info` returns `(failed) {not in manifest}` before consulting the installation record.
- Uninstall is already ledger-driven and does not have this dependency.

A missing entry and an unreadable manifest are different conditions. The former can only be asserted after the manifest loads successfully; the latter must keep its existing read-failure classification.

## Public Contract

| Manifest result                 | Installation state                               | Read-surface result                                              |
| ------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Loads; entry exists             | Any                                              | Existing behavior                                                |
| Loads; entry absent             | Enabled; no recorded unsupported kinds           | `(installed) {not in manifest}`                                  |
| Loads; entry absent             | Enabled; one or more recorded unsupported kinds  | `(partially-installed) {not in manifest, <unsupported reasons>}` |
| Loads; entry absent             | Disabled (`enabled: false`, `installable: true`) | `(disabled)`                                                     |
| Loads; entry absent             | No record                                        | `(failed) {not in manifest}` for targeted info                   |
| Missing, unreadable, or invalid | Any                                              | Existing manifest-read failure behavior                          |

Additional invariants:

- `list --installed` includes enabled manifest-absent installation records.
- Other list filters do not reclassify the record as available, remote, partially available, or unavailable.
- Existing partial-install state is preserved from `compatibility.unsupported`; manifest absence composes with it rather than replacing it.
- `plugin update` and marketplace autoupdate retain `(skipped) {not in manifest}`.
- Uninstall remains successful from the ownership ledger.
- No new status, glyph, reason token, marker, or persistence field is added.

## Design

### 1. Installed inventory is the union of manifest and state

`orchestrators/plugin/list.ts` will build a marketplace inventory from:

1. entries in a successfully loaded marketplace manifest; and
2. plugin names in `mpRecord.plugins` that are absent from that manifest.

Manifest-backed rows continue through the current classifier unchanged. State-only rows bypass source resolution because no manifest entry exists to resolve. Their classification comes directly from the install record:

- enabled record with no unsupported kinds: the existing installed inventory row, with `reasons: ["not in manifest"]`;
- enabled record with unsupported kinds: the existing partially-installed inventory row, with `"not in manifest"` followed by the reasons derived from `compatibility.unsupported`;
- disabled record in the canonical disabled shape (`enabled: false` with `compatibility.installable: true`): the existing disabled inventory row, without the reason.

Most of this union already exists: the list path walks installation records first and manifest-only entries second, and partial, disabled, and `--installed` behavior already survive manifest absence. The single production change on this path is that the render map currently suppresses reasons on installed inventory rows, so the new reason cannot reach the renderer until that seam is opened. Soft-dependency markers compose after the caller's reasons and must keep doing so.

The state-only enabled row participates in the installed filter bucket. Existing sorting, scope folding, marketplace headers, severity, and no-reload behavior remain unchanged.

The union is constructed only after `loadMarketplaceManifest` succeeds. Its catch path remains untouched so ENOENT, permission, malformed JSON, and schema failures cannot be mislabeled as entry absence. The cross-scope orphan-fold path needs a matching change: it currently discards the load error, so an absent entry there is indistinguishable from a manifest that was never read, and a naive missing-entry check would assert something about a manifest's contents from a failure to read it. That path must thread the load error the way the primary path does.

### 2. Plugin info falls back to the existing installation record

`orchestrators/plugin/info.ts::buildBlock` will load the manifest first, as it does today. After a successful load it will obtain both:

- the matching manifest entry, if any; and
- `mpRecord.plugins[pluginName]`, if any.

The decision order becomes:

1. manifest read failure → existing failed read result;
2. manifest entry exists → existing installed/not-installed logic;
3. entry absent and enabled installation record exists → installation-record-backed installed or partially-installed row with `{not in manifest}` plus any recorded unsupported-kind reasons;
4. entry absent and no enabled installation record exists → existing `(failed) {not in manifest}` result.

Disabled records already take the disabled inventory path before `buildBlock` and remain unchanged.

For the installation-record-backed row:

- status is `partially-installed` when `compatibility.unsupported` is non-empty, otherwise `installed`;
- reasons start with `not in manifest` and retain the existing unsupported-kind reasons through `narrowUnsupportedKinds`;
- `version` comes from the install record;
- `skills` comes from `resources.skills`;
- `commands` comes from `resources.prompts`;
- `agents` comes from `resources.agents`;
- `mcp` comes from `resources.mcpServers`;
- hooks are projected from the materialized `<extensionRoot>/hooks/<generatedName>/hooks.json` configuration associated with `resources.hooks`, read through the `assertPathInside` containment guard because the slug is state-supplied data.

The four name-list kinds are sorted before entering the renderer. Hook entries are not: they preserve materialized declaration order, which is the established contract for that kind and is pinned byte-exact by existing tests. Sorting is not even well defined for them, because a hook summary entry is an event-and-matcher tuple rather than a name.

Two fidelity limits are accepted and documented rather than engineered away. The names in `resources.*` are the Pi-generated installed names rather than the original source names a manifest-backed `info` renders, with MCP servers the sole exception; whether to render those or reverse-map them is an open decision. And the materialized `hooks.json` holds only the supported filtered subset, so displayed hooks are what survived install, not the plugin's full declaration.

Manifest-only metadata such as description and upstream dependencies is omitted because it is no longer locally authoritative. Exact dropped-component details that were never persisted cannot be reconstructed, but their unsupported kinds remain visible from the compatibility record.

No network fetch is attempted, including for `info --fetch`. This needs an explicit guard rather than an argument from absence: the installation record carries `resolvedSource`, so a source is identifiable, and today's network-free behavior on this path is an accident of the early `not in manifest` return sitting in front of every fetch-capable row builder. Reordering the lookup makes those builders reachable, so the guard must be written and asserted against injected clone and auth seams.

### 3. Lifecycle behavior stays ledger-driven

No uninstall production change is expected. Regression coverage will prove that removing a manifest entry does not prevent uninstall from removing all resources and the state record.

Update and marketplace autoupdate keep their current skip behavior. Tests will pin this to prevent the new read-surface fallback from leaking into mutation preflight logic.

### 4. Persistence remains unchanged

The condition is derived from two current facts:

```text
valid manifest lacks plugin name
AND
state marketplace record contains plugin installation
```

The design deliberately does not persist:

- an orphan flag;
- a copied manifest entry;
- an install-time component summary beyond the existing resources and compatibility fields;
- a new schema version;
- a new status or reason.

This avoids stale state and migration work while preserving retry and `/reload` recovery guarantees.

## Error Handling

- Manifest load failures take precedence over state-only fallback.
- An unknown, non-installed plugin in a valid manifest context remains a targeted `(failed) {not in manifest}` result.
- Local component inspection uses existing filesystem/parser conventions; it must not invent upstream metadata or touch the network.
- The feature does not broaden write paths or containment boundaries.

## Test Strategy

Implementation follows TDD. Because much of the approved matrix already holds, distinguish characterization tests, which pin current behavior before it is touched, from tests that drive new behavior. Write the characterization tests first.

1. **List tests**
   - enabled state-only record in default list;
   - inclusion under `--installed` and exclusion from unrelated filters;
   - disabled state-only record remains `(disabled)`;
   - manifest read failures retain their current output;
   - a folded row whose manifest failed to load is not labeled `{not in manifest}`;
   - soft-dependency markers still follow the new reason;
   - byte-exact fully installed and partially-installed manifest-absent rendering.
2. **Info tests**
   - enabled state-only record reports installed version and every persisted component kind;
   - recorded unsupported kinds retain `(partially-installed)` and their existing reason markers;
   - materialized hooks project into the existing hooks detail form;
   - unknown non-installed name remains failed;
   - disabled and manifest-read cases remain unchanged;
   - no network seam is invoked.
3. **Lifecycle regression tests**
   - uninstall succeeds after manifest entry removal and cleans the ledger-owned resources;
   - targeted update and marketplace autoupdate remain skipped with `{not in manifest}`.
4. **Contract tests and docs**
   - update `docs/output-catalog.md` byte examples;
   - amend the PRD list/info behavior;
   - keep closed status/reason sets unchanged.

## Success Criteria

- The approved public matrix is covered by automated tests.
- `npm run check` passes.
- List and bare info remain network-free.
- No state schema, closed-set status, or reason additions appear in the diff.
- An installed manifest-absent plugin can still be uninstalled cleanly.
