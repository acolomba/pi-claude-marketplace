# Manifest-Independent Installed Plugin Info Design

**Date:** 2026-08-07 **Status:** Approved for milestone planning **Milestone:** v1.18 Manifest-Independent Installed Plugin Info

## Goal

Keep installed plugins accurately visible, inspectable, and uninstallable after their entry disappears from a marketplace manifest, without adding persisted orphan state or changing update behavior.

## Problem

The extension already persists an installation ownership ledger in `state.json`. That ledger is sufficient to identify installed resources and uninstall them, but the read surfaces still treat the current marketplace manifest as the sole plugin inventory:

- `plugin list` does not truthfully represent an enabled installation record whose manifest entry has disappeared.
- `plugin info` returns `(failed) {not in manifest}` before consulting the installation record.
- Uninstall is already ledger-driven and does not have this dependency.

A missing entry and an unreadable manifest are different conditions. The former can only be asserted after the manifest loads successfully; the latter must keep its existing read-failure classification.

## Public Contract

| Manifest result                 | Installation record | Enabled | Read-surface result                            |
| ------------------------------- | ------------------- | ------- | ---------------------------------------------- |
| Loads; entry exists             | Any                 | Any     | Existing behavior                              |
| Loads; entry absent             | Present             | `true`  | `(installed) {not in manifest}`                |
| Loads; entry absent             | Present             | `false` | `(disabled)`                                   |
| Loads; entry absent             | Absent              | --      | `(failed) {not in manifest}` for targeted info |
| Missing, unreadable, or invalid | Any                 | Any     | Existing manifest-read failure behavior        |

Additional invariants:

- `list --installed` includes enabled manifest-absent installation records.
- Other list filters do not reclassify the record as available, remote, partially available, or unavailable.
- `plugin update` and marketplace autoupdate retain `(skipped) {not in manifest}`.
- Uninstall remains successful from the ownership ledger.
- No new status, glyph, reason token, marker, or persistence field is added.

## Design

### 1. Installed inventory is the union of manifest and state

`orchestrators/plugin/list.ts` will build a marketplace inventory from:

1. entries in a successfully loaded marketplace manifest; and
2. plugin names in `mpRecord.plugins` that are absent from that manifest.

Manifest-backed rows continue through the current classifier unchanged. State-only rows bypass source resolution because no manifest entry exists to resolve. Their classification comes directly from the install record:

- enabled record: the existing installed inventory row, with `reasons: ["not in manifest"]`;
- disabled record: the existing disabled inventory row, without the reason.

The state-only enabled row participates in the installed filter bucket. Existing sorting, scope folding, marketplace headers, severity, and no-reload behavior remain unchanged.

The union is constructed only after `loadMarketplaceManifest` succeeds. Its catch path remains untouched so ENOENT, permission, malformed JSON, and schema failures cannot be mislabeled as entry absence.

### 2. Plugin info falls back to the installation ledger

`orchestrators/plugin/info.ts::buildBlock` will load the manifest first, as it does today. After a successful load it will obtain both:

- the matching manifest entry, if any; and
- `mpRecord.plugins[pluginName]`, if any.

The decision order becomes:

1. manifest read failure → existing failed read result;
2. manifest entry exists → existing installed/not-installed logic;
3. entry absent and enabled installation record exists → ledger-backed installed row with `{not in manifest}`;
4. entry absent and no enabled installation record exists → existing `(failed) {not in manifest}` result.

Disabled records already take the disabled inventory path before `buildBlock` and remain unchanged.

For the ledger-backed installed row:

- `version` comes from the install record;
- `skills` comes from `resources.skills`;
- `commands` comes from `resources.prompts`;
- `agents` comes from `resources.agents`;
- `mcp` comes from `resources.mcpServers`;
- hooks are projected from the materialized `<extensionRoot>/hooks/<generatedName>/hooks.json` configuration associated with `resources.hooks`.

Every list is sorted before entering the renderer, preserving the existing `PluginInfoRow` contract. Manifest-only metadata such as description and upstream dependencies is omitted because it is no longer locally authoritative. No network fetch is attempted, including for `info --fetch`, because no source entry exists to identify or fetch.

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
- an install-time component summary beyond the existing resources ledger;
- a new schema version;
- a new status or reason.

This avoids stale state and migration work while preserving retry and `/reload` recovery guarantees.

## Error Handling

- Manifest load failures take precedence over state-only fallback.
- An unknown, non-installed plugin in a valid manifest context remains a targeted `(failed) {not in manifest}` result.
- Local component inspection uses existing filesystem/parser conventions; it must not invent upstream metadata or touch the network.
- The feature does not broaden write paths or containment boundaries.

## Test Strategy

Implementation follows TDD.

1. **List tests**
   - enabled state-only record in default list;
   - inclusion under `--installed` and exclusion from unrelated filters;
   - disabled state-only record remains `(disabled)`;
   - manifest read failures retain their current output;
   - byte-exact `(installed) {not in manifest}` rendering.
2. **Info tests**
   - enabled state-only record reports installed version and every persisted component kind;
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
