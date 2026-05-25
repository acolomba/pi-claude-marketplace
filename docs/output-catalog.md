# Command Output Catalog

Per-command rendered output for each user-visible state, derived from the current spec (`docs/messaging-style-guide.md`) plus the orchestrator code as of branch `gsd/v1.3-consistent-messaging`. This document is intended to become a new requirements doc; the examples here are the user-facing contract that the renderers must satisfy.

## Conventions

### Glyphs

- `●` = filled circle. On plugin rows: plugin is installed. On marketplace rows: OK / success outcome.
- `○` = empty circle. On plugin rows: plugin is not installed and there is no error -- either `(available)` (declared but never installed) or `(uninstalled)` (explicitly removed).
- `⊘` = prohibited symbol. On plugin rows: error / blocked state -- `(failed)`, `(unavailable)`, or `(skipped)` cascade-failure child. On marketplace rows: failure / error outcome.

### Lists are flat

Lists never emit per-scope group-header lines (`project scope` / `user scope`). All list rows live at column 0.

### Scope brackets

- Marketplace headers / rows ALWAYS carry a single-scope bracket: `[project]` or `[user]`. Marketplaces are rendered PER SCOPE (no collapse).
- Plugin rows ALWAYS carry a single-scope bracket: `[project]` or `[user]`. Plugins are per-scope (no collapse).
- On the plugin list surface, `(available)` and `(unavailable)` rows OMIT the scope bracket (MSG-PL-6 carve-out -- they describe a manifest declaration, not an install location).
- The collapsed multi-scope form `[project, user]` is RESERVED as a passive rule: if a single record ever genuinely applies to both scopes simultaneously, the in-bracket order MUST be `project, user` (MSG-GR-3). No current surface in this catalog exercises this form -- marketplaces and plugins are both per-scope.

### Per-scope marketplace rendering & the fold rule

Since marketplaces are rendered per scope, the same marketplace name appears as TWO independent rows / headers when it exists in both scopes (e.g. `official [project]` and `official [user]` as two separate lines). Each per-scope marketplace carries its own state independently (autoupdate, plugins, last-updated).

**Plugin folding under marketplace headers** (plugin-list surface and any other surface that nests plugin rows under a marketplace header):

- Under a `<marketplace> [project]` header: list only that marketplace's PROJECT-scoped plugins.
- Under a `<marketplace> [user]` header: list that marketplace's USER-scoped plugins. ADDITIONALLY, if NO `<marketplace> [project]` header exists, the user-scope header ALSO folds in any orphan PROJECT-scoped plugins of that marketplace name (plugins that exist project-scope without a project-scope marketplace record).
- Symmetric edge case: a `<marketplace> [project]` header without a `<marketplace> [user]` counterpart does NOT fold user-scoped plugins. User-scope state always requires the user-scope marketplace record.

**Adoption rule**: when a project-scope marketplace is later added (via `marketplace add --scope project` or `bootstrap`) and there are orphan project-scoped plugins previously folded under the user-scope marketplace, those plugins are ADOPTED by the new project-scope marketplace at adoption time. Subsequent renders show them under `<marketplace> [project]` instead.

**Plugin scope on folded rows**: in the fold case, plugin rows may carry a DIFFERENT scope than their parent marketplace header. The plugin row's `[<scope>]` always reflects the plugin's actual install scope, not the header's scope. This is the only context in which the two diverge.

### Marketplace header rule (uniform across multi-plugin commands)

Any command that operates on **multiple plugins**, or that lists plugins under their owning marketplace, renders the marketplace as a HEADER line at column 0 with the plugin rows indented 2 spaces underneath:

```text
<icon> <marketplace> [<scope>] [<marker>] [(status)] [{reasons}]
  <icon> <plugin> [<scope>] [v<ver>] (<status>) [{reasons}]
  <icon> <plugin> [<scope>] [v<ver>] (<status>) [{reasons}]
```

- The `@<marketplace>` token is OMITTED from indented plugin rows -- the marketplace is already in the header.
- The marketplace header may carry its own status when relevant (e.g. `(added)` in import, `(updated)` in marketplace update). When the header is a pure label (e.g. plugin list), the status is omitted.
- The marketplace header carries `<scope>` singular (no collapse). When a marketplace exists in both scopes, two header lines are emitted, one per scope.

### Marketplace icon rule (uniform across header AND row forms)

Marketplace lines ALWAYS carry a leading icon -- both label-only header form (plugin list, marketplace update success) and standalone row form (marketplace list, marketplace add result). The icon signals the marketplace's outcome class (distinct from the plugin-row effective-state rule above):

- `●` (filled circle) -- OK / success / normal state (including `(removed)` -- the operation succeeded even though the marketplace is gone).
- `⊘` (prohibited symbol) -- failure / warning / error state (e.g. `(failed)`, `(unavailable)`, manifest unparseable).

**Single-plugin commands** (install, uninstall) do NOT use the marketplace-header form -- they keep `<plugin>@<marketplace>` inline because there is exactly one plugin row and no need for a group context.

**Marketplace-only commands** (marketplace list, marketplace add, marketplace autoupdate, bootstrap) do NOT use the header form either -- there are no plugin children; the marketplaces ARE the rows.

**Conditional header-form commands** (marketplace remove): use the bare-row form on clean success; use the marketplace-header form when the cascade has plugin-unstage failures (the failed plugin rows indent under the marketplace's failure-row header).

### Plugin row icon rule (effective install state)

Plugin row icons answer three orthogonal questions: "is the plugin installed?" and "is there an error?":

- `●` -- plugin is installed. Covers `(installed)`, `(reinstalled)`, `(updated)`, `(upgradable)`, and `(skipped)` no-ops where the plugin remains installed (`{up-to-date}`, `{already installed}`).
- `○` -- plugin is not installed AND there is no error. Covers `(available)` (declared but not installed) and `(uninstalled)` (explicitly removed). Neither is an error condition; the plugin is simply absent.
- `⊘` -- error or blocked state, regardless of install state. Covers `(failed)`, `(unavailable)`, and `(skipped)` rows that are failure-cascade children (`{source mismatch}` and similar).

The three icons are independent of the operation outcome. A successful uninstall is `○` because the plugin is now gone (no error). A failed install is `⊘` because something went wrong. A skipped no-op on an already-installed plugin is `●` because the plugin is still installed.

Marketplace icons follow a separate outcome-class rule (see "Marketplace icon rule" below).

### Row sort order

- Within a marketplace block (multi-plugin commands), plugin rows are sorted alphabetically by name regardless of status (`localeCompare` with `sensitivity: 'base'`).
- The marketplace-list surface sorts by name (case-insensitive `localeCompare`, `sensitivity: 'base'`); same-name rows tie-break by scope (project before user).
- The plugin-list surface emits marketplace blocks by the same key: name primary, scope tie-breaker (project before user).

### Reload hint

- Trailing `/reload to pick up changes` (one blank line above) appears exactly once at the end of the body when any resource changed (MSG-RH-1).
- Pure no-op cascades (e.g. all plugins `up-to-date` or `already installed`) omit the trailer.

### Reasons rendering

- Reasons render inside a single `{}` block, comma-separated. Each reason is 1-3 words lowercase, hyphenated where natural (`{up-to-date}`, `{rollback partial}`, `{not in manifest}`). Manifest field names render verbatim as the sole carve-out (`{hooks}`, `{lspServers}`) (MSG-GR-4).
- **Soft-dep reasons**: `{requires pi-subagents}`, `{requires pi-mcp}` -- emitted on installed / updated / reinstalled rows when the plugin declares the corresponding resource AND the companion extension is unloaded. NOT emitted on uninstalled rows (see uninstall section for the rationale).
- **Outcome reasons**: `{up-to-date}`, `{already installed}`, `{rollback partial}`, `{manual recovery}`, `{permission denied}`, `{network unreachable}`, `{unparseable}`, `{not in manifest}`, `{source mismatch}`, `{plugins remain}`, etc.
- **Unsupported-feature reasons**: rendered as bare Claude manifest field names: `{hooks}`, `{lspServers}`, `{hooks, lspServers}` -- NEVER "contains hooks" prose; NEVER quoted; NEVER prefixed. The reason names match the manifest field names from the Claude plugin schema verbatim.

### Autoupdate marker

Marketplaces carry a dedicated **marker** slot -- distinct from both status tokens (`(...)`) and reasons (`{...}`) -- that surfaces the marketplace's autoupdate state. The marker is enclosed in angle brackets:

- `<autoupdate>` -- autoupdate is ON.
- `<no autoupdate>` -- autoupdate is OFF.

**Emission rules:**

- The marker is OPTIONAL and emitted only when an autoupdate state is meaningful to surface:
  - When a marketplace has autoupdate ON: emit `<autoupdate>` on every marketplace row / header in every surface (marketplace list, marketplace add / remove / update / bootstrap, plugin list marketplace headers, reinstall / update / import marketplace headers).
  - When a marketplace has autoupdate OFF: emit NOTHING -- the absence of the marker means autoupdate is off. No `<no autoupdate>` token leaks into normal output.
  - **Exception** -- the `<no autoupdate>` token appears in exactly one place: as the result row of `marketplace autoupdate disable`, where it announces that autoupdate was just turned off for the named marketplace. This is the only context in which it surfaces.
- `<autoupdate>` is also the result row of `marketplace autoupdate enable`, where it announces that autoupdate was just turned on.

**Marker position in the grammar:**

For marketplace rows and marketplace header lines, the marker sits between the scope bracket and the status token:

```text
<icon> <marketplace> [<scope>] [<marker>] [(status)] [{reasons}]
```

For the `marketplace autoupdate enable|disable` command, the marker is the sole outcome indicator -- no status token is emitted on that row:

```text
<icon> <marketplace> [<scope>] <marker> [{reasons}]
```

In every other context the marker (when present) precedes the status token. Plugin rows do NOT carry the marker -- autoupdate is a marketplace-level property only.

### Status tokens with reasons

`(unavailable)` rows always carry a reasons block naming the manifest fields that block install. `(failed)` rows carry reasons for the failure class (e.g. `{permission denied}`, `{rollback partial}`) and optionally a `cause:` trailer for the underlying Error chain.

## Severity routing

| Pattern                                                       | Wrapper                                                 | Trigger                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Single-shot success                                           | `notifySuccess`                                         | one record, no failure                                                                    |
| Single-shot failure                                           | `notifyError` (severity `error`)                        | one record, failed; carries `cause:` trailer                                              |
| Cascade all-success                                           | `notifySuccess`                                         | every row's partition is success-class                                                    |
| Cascade with failures                                         | `notifyWarning` (severity `warning`, **never** `error`) | at least one partition contains a failed or non-trivial skipped row (MSG-SR-5 / MSG-SR-6) |
| Cascade all-trivial (only `up-to-date` / `already installed`) | `notifySuccess`                                         | Pitfall 4: `unchanged` folds into Skipped but does NOT flip severity                      |
| Manual recovery                                               | `notifyWarning`                                         | standalone anchor; appended after the trigger emission                                    |
| Usage error                                                   | `notifyError`                                           | unknown subcommand, bad args                                                              |

## Status token reference

| Token                                | Icon  | Where it appears                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(installed)`                        | ●     | plugin install single-shot, plugin list, import plugin rows                                                                                                                                                                                                                                                                                                     |
| `(reinstalled)`                      | ●     | plugin reinstall cascade rows                                                                                                                                                                                                                                                                                                                                   |
| `(uninstalled)`                      | ○     | plugin uninstall single-shot -- `○` per effective-state rule (plugin no longer installed, no error)                                                                                                                                                                                                                                                             |
| `(updated)`                          | ●     | plugin update / marketplace update plugin cascade rows; carries version transition `v<from> → v<to>`                                                                                                                                                                                                                                                            |
| `(upgradable)`                       | ●     | plugin list only (advisory)                                                                                                                                                                                                                                                                                                                                     |
| `(available)`                        | ○     | plugin list only -- NO scope bracket per MSG-PL-6                                                                                                                                                                                                                                                                                                               |
| `(unavailable)`                      | ⊘     | plugin list (NO scope bracket per MSG-PL-6) AND install / reinstall / import surfaces (KEEPS scope bracket). Covers any "cannot install this plugin from this manifest" condition: unsupported manifest features (`{hooks, lspServers}`), plugin name not declared in the manifest (`{not in manifest}`), etc. ALWAYS carries a reasons block naming the cause. |
| `(added)`                            | ●     | marketplace add, marketplace headers in import, marketplace list                                                                                                                                                                                                                                                                                                |
| `(removed)`                          | ●     | marketplace remove single-shot                                                                                                                                                                                                                                                                                                                                  |
| `(skipped)`                          | ● / ⊘ | cascade no-op cases. Plugin rows: `●` when the plugin remains installed (`{up-to-date}`, `{already installed}`); `⊘` when the skip is a failure-cascade child and the plugin is NOT installed (`{source mismatch}`). Marketplace rows: `●`.                                                                                                                     |
| `(failed)`                           | ⊘     | failure rows, single-shot failures; optional `cause:` trailer + indented rollback-partial children                                                                                                                                                                                                                                                              |
| `(manual recovery)`                  | ⊘     | standalone recovery anchor with `{<reason>}`                                                                                                                                                                                                                                                                                                                    |
| `(no plugins)` / `(no marketplaces)` | bare  | empty list -- MSG-ER-1                                                                                                                                                                                                                                                                                                                                          |

______________________________________________________________________

## `/claude:plugin list`

Multi-plugin command. Each marketplace renders as a header at column 0; plugins indent 2 spaces beneath.

### Empty

<!-- catalog-state: empty -->

```text
(no plugins)
```

### Single marketplace, mixed plugin statuses (user scope)

<!-- catalog-state: single-mp-mixed -->

```text
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (installed)
    Short description of alpha.
  ● beta [user] v0.5.0 → v1.0.0 (upgradable)
    Long description that exceeds the col-66 width budget will be tru…
  ⊘ delta (unavailable) {hooks}
    Free-text description; renders verbatim under 66 cols.
  ⊘ epsilon (unavailable) {hooks, lspServers}
  ○ gamma v2.0.0 (available)
    Free-text description; renders verbatim under 66 cols.
```

Notes:

- Plugins inside a marketplace are sorted alphabetically by name regardless of status.
- `(installed)` / `(upgradable)` rows carry `[<scope>]`; `(available)` / `(unavailable)` rows OMIT it (MSG-PL-6).
- Description truncates at 66 Unicode code points with `…` suffix (MSG-PL-1).
- `(unavailable) {hooks}` -- manifest declared a `hooks` field, which Pi does not support; the reason names the offending manifest field. Multiple unsupported features render as `{hooks, lspServers}` etc.

### Same plugin installed in BOTH scopes (per-scope marketplace headers, per-scope plugin rows)

<!-- catalog-state: same-plugin-both-scopes -->

```text
● official [project] <autoupdate>
  ● alpha [project] v0.9.0 (installed)
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (installed)
```

Both marketplaces and plugins are per-scope. `official` renders twice -- once per scope -- each with its own autoupdate marker. The plugin row sits under its matching marketplace header.

### Project-scope plugins folded under user-scope marketplace (no project marketplace exists)

<!-- catalog-state: project-orphan-folded -->

```text
● official [user] <autoupdate>
  ● alpha [project] v0.9.0 (installed)
  ● alpha [user] v1.0.0 (installed)
```

Here `official` exists in user scope only. The project-scoped `alpha` plugin (an orphan from the project-scope perspective -- no `official [project]` record) folds into the user-scope marketplace's plugin list. When the operator later adds `official` in project scope, the project-scoped `alpha` is ADOPTED by the new `official [project]` header.

### Soft-dep markers on installed rows when companion extensions are unloaded

<!-- catalog-state: soft-dep-on-installed -->

```text
● official [user] <autoupdate>
  ● dual [user] v0.5.0 (installed) {requires pi-subagents, requires pi-mcp}
  ● helper [user] v1.0.0 (installed) {requires pi-subagents}
  ● mcp-tool [user] v2.0.0 (installed) {requires pi-mcp}
```

### Marketplace whose manifest is UNPARSEABLE

When a marketplace's manifest fails to parse, the marketplace renders as a failure-status header carrying `(failed) {unparseable}` with the parse error in the `cause:` trailer. The marketplace icon flips to `⊘` (the failure/warning glyph):

<!-- catalog-state: unparseable-mp -->

```text
● other-mp [user] <autoupdate>
  ● helper [user] v1.0.0 (installed)
⊘ unparseable-mp [user] (failed) {unparseable}
  cause: JSON parse error at line 3
```

The unparseable marketplace appears in the per-marketplace listing (alphabetically among the other marketplaces); no separate `warning:` line at the top.

### Marketplace whose manifest declares ZERO plugins

A marketplace with a valid manifest declaring no plugins renders with the `(no plugins)` body -- distinct from the unparseable-manifest case above:

<!-- catalog-state: zero-plugin-mp-block -->

```text
● empty-mp [project]
  (no plugins)
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (installed)
```

### Multiple marketplaces

<!-- catalog-state: multiple-mps -->

```text
● official [project] <autoupdate>
  ● alpha [project] v0.9.0 (installed)
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (installed)
  ○ beta v2.0.0 (available)
● zeta-mp [user]
  ● tool [user] v1.0.0 (installed) {requires pi-subagents}
```

Marketplace headers sort by name (case-insensitive `localeCompare`, `sensitivity: 'base'`). Same-name rows tie-break by scope: `[project]` before `[user]`.

______________________________________________________________________

## `/claude:plugin install <plugin>@<marketplace>`

**Single-plugin command** -- keeps `@<marketplace>` inline; no marketplace header.

### Success

<!-- catalog-state: success -->

```text
● helper@official [user] v1.0.0 (installed)

/reload to pick up changes
```

### Success with soft-dep reasons

<!-- catalog-state: success-with-soft-dep -->

```text
● helper@official [user] v1.0.0 (installed) {requires pi-subagents, requires pi-mcp}

/reload to pick up changes
```

### Failure -- unsupported features in manifest

<!-- catalog-state: failure-unsupported-features -->

```text
⊘ helper@official [user] (unavailable) {hooks, lspServers}
```

The manifest declares Claude features Pi doesn't support; the reason names the offending fields by their manifest name. No `cause:` trailer -- the reason tells the whole story.

### Failure -- runtime error with Error.cause chain

<!-- catalog-state: failure-runtime-with-cause -->

```text
⊘ helper@official [user] (failed)
  cause: state.json at /path/to/state.json is not valid JSON: Unexpected token n in JSON at position 0
```

Multi-link cause chains use `->` between links per MSG-CC-1, chain bounded to depth 5 with `(truncated)` suffix on the last link if deeper.

### Failure with rollback-partial children

<!-- catalog-state: failure-rollback-partial -->

```text
⊘ helper@official [user] (failed) {rollback partial}
  [phase3a] failed to remove staged agent: EACCES
  [phase3b] orphan path: /.../helper.bak
  cause: orchestrator failed mid-staging
```

______________________________________________________________________

## `/claude:plugin uninstall <plugin>@<marketplace>`

**Single-plugin command** -- keeps `@<marketplace>` inline; no marketplace header.

### Success

<!-- catalog-state: success -->

```text
○ helper@official [user] v1.0.0 (uninstalled)

/reload to pick up changes
```

The `○` icon reflects the plugin's post-op state: it is no longer installed on disk, and there is no error (effective-state icon rule).

### Success when the plugin declared soft-dep resources

<!-- catalog-state: success-soft-dep-omitted -->

```text
○ helper@official [user] v1.0.0 (uninstalled)

/reload to pick up changes
```

Soft-dep reasons are NOT surfaced on uninstall rows. Install / update / reinstall ADD or REFRESH content that the soft-dep would activate, so the marker is useful there. Uninstall REMOVES the content; the soft-dep would only describe a no-op state for the operator (no agents/MCP left to need pi-subagents/pi-mcp), so the marker is omitted.

### Failure

<!-- catalog-state: failure-permission-denied -->

```text
⊘ helper@official [user] (failed) {permission denied}
  cause: EACCES: permission denied, unlink '/path/to/file'
```

______________________________________________________________________

## `/claude:plugin reinstall` (multi-plugin cascade)

Renders one marketplace header per affected marketplace; plugin rows indent 2 spaces underneath without `@<marketplace>`.

### Single marketplace, all reinstalled

<!-- catalog-state: single-mp-all-reinstalled -->

```text
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (reinstalled)
  ● beta [user] v0.5.0 (reinstalled)

/reload to pick up changes
```

### Success with soft-dep reasons

<!-- catalog-state: success-with-soft-dep -->

```text
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (reinstalled) {requires pi-subagents, requires pi-mcp}

/reload to pick up changes
```

### Single marketplace, mixed outcomes (reinstalled + skipped + failed)

<!-- catalog-state: single-mp-mixed-outcomes -->

```text
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (reinstalled)
  ● beta [user] (skipped) {up-to-date}
  ⊘ delta [user] (failed) {source missing}

/reload to pick up changes
```

Rows within the marketplace block are alphabetical across all partition outcomes. Severity: `notifyWarning` (cascade with non-trivial partitions per MSG-SR-5).

### Single marketplace, all failed

<!-- catalog-state: single-mp-all-failed -->

```text
● official [user] <autoupdate>
  ⊘ alpha [user] (failed) {source missing}
  ⊘ beta [user] (failed) {unreadable manifest}
```

No `/reload` trailer -- nothing changed on disk, so MSG-RH-1's "any resource changed" condition does not fire. Severity is still `notifyWarning`, never `notifyError` per MSG-SR-6.

### Single marketplace, plugin became unavailable after install (manifest now declares unsupported features)

<!-- catalog-state: plugin-became-unavailable -->

```text
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (reinstalled)
  ⊘ delta [user] (unavailable) {hooks}

/reload to pick up changes
```

### Across multiple marketplaces (bare `reinstall` form)

<!-- catalog-state: bare-multi-mp -->

```text
● local-mp [project]
  ● helper [project] v0.5.0 (reinstalled)
  ● tool [project] v1.0.0 (reinstalled)
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (reinstalled)
  ● beta [user] (skipped) {up-to-date}
  ⊘ delta [user] (failed) {source missing}

/reload to pick up changes
```

Marketplace blocks render alphabetically by marketplace name.

### Same marketplace name in both scopes (cross-scope tie-break)

<!-- catalog-state: same-mp-both-scopes -->

```text
● official [project]
  ● alpha [project] v1.0.0 (reinstalled)
● official [user]
  ● beta [user] v1.0.0 (reinstalled)

/reload to pick up changes
```

When the same marketplace name is installed in both scopes, the project-scope cascade block renders before the user-scope block (MSG-GR-3: name primary case-insensitive, scope secondary project-before-user via `compareByNameThenScope`). Each scope renders its own header line and its own indented plugin rows; the marketplaces never collapse.

______________________________________________________________________

## `/claude:plugin update` (multi-plugin cascade)

Same shape as reinstall: marketplace header + indented plugin rows. Version transitions use `v<from> → v<to>` per MSG-PL-3.

### Single marketplace, mixed

<!-- catalog-state: single-mp-mixed -->

```text
● official [user] <autoupdate>
  ● alpha [user] v0.5.0 → v1.0.0 (updated)
  ● beta [user] (skipped) {up-to-date}
  ⊘ delta [user] v1.0.0 → v1.4.0 (failed) {network unreachable}

/reload to pick up changes
```

### Failed with rollback-partial cause chain

<!-- catalog-state: failed-with-rollback-partial -->

```text
● official [user] <autoupdate>
  ⊘ delta [user] v1.0.0 → v1.4.0 (failed) {rollback partial}
    [phase3a] failed to remove staged agent: EACCES
    [phase3b] orphan path: /.../delta.bak
    cause: orchestrator failed mid-staging
```

The `cause:` trailer sits 2 spaces under the failure row it belongs to (here, the indented plugin row -- so cause is at column 4, aligned with the rollback-partial children).

### All up-to-date (no-op cascade)

<!-- catalog-state: all-up-to-date-noop -->

```text
● official [user] <autoupdate>
  ● alpha [user] (skipped) {up-to-date}
  ● beta [user] (skipped) {up-to-date}
```

Trivial-only outcomes route via `notifySuccess` (Pitfall 4); no reload-hint trailer since nothing changed.

### Across multiple marketplaces (bare `update` form)

<!-- catalog-state: bare-multi-mp -->

```text
● local-mp [project]
  ● helper [project] v0.5.0 → v1.0.0 (updated)
● official [user] <autoupdate>
  ● alpha [user] v0.5.0 → v1.0.0 (updated)
  ● beta [user] (skipped) {up-to-date}
  ⊘ delta [user] v1.0.0 → v1.4.0 (failed) {network unreachable}

/reload to pick up changes
```

### Same marketplace name in both scopes (cross-scope tie-break)

<!-- catalog-state: same-mp-both-scopes -->

```text
● official [project]
  ● alpha [project] v0.9.0 → v1.0.0 (updated)
● official [user]
  ● beta [user] v0.5.0 → v1.0.0 (updated)

/reload to pick up changes
```

When the same marketplace name is installed in both scopes, the project-scope cascade block renders before the user-scope block (MSG-GR-3 via `compareByNameThenScope`). Same lock as the reinstall surface.

______________________________________________________________________

## `/claude:plugin import`

Multi-marketplace + multi-plugin cascade. Each marketplace carries its own status on the header line (the marketplace was just added, or skipped because already added); plugin rows indent underneath without `@<marketplace>`.

### Fresh import of Claude settings (mixed outcomes across both scopes)

<!-- catalog-state: fresh-mixed-both-scopes -->

```text
Claude plugin import summary

● claude-plugins-official [project] <autoupdate> (added)
  ● official-plugin [project] (installed)
● claude-plugins-official [user] <autoupdate> (added)
  ● official-plugin [user] (installed)
● directory-marketplace [project] (added)
  ● local-plugin [project] (installed)
● directory-marketplace [user] (skipped) {already installed}
  ● local-plugin [user] (installed)
  ● preinstalled-plugin [user] (skipped) {already installed}
  ⊘ unavailable-plugin [user] (unavailable) {hooks}
● github-marketplace [project] <autoupdate> (added)
  ● github-plugin [project] (installed)
● github-marketplace [user] <autoupdate> (added)
  ● github-plugin [user] (installed)

/reload to pick up changes
```

Notes:

- The `Claude plugin import summary` preamble + blank line is the only top-level label.
- Marketplace headers carry their own outcome status (`(added)`, `(skipped)`, `(failed)`); plugin rows are indented children.
- Marketplaces never collapse -- a marketplace touching both scopes renders as TWO header lines (one per scope) with plugins listed under the matching scope's header. Each per-scope header carries its own marker independently.
- Plugin rows within a marketplace block are alphabetical across all partition outcomes.
- Plugin rows that fail because of unsupported manifest features render `(unavailable) {hooks}` etc., keeping the scope bracket. The MSG-PL-6 no-bracket carve-out applies only to the plugin-list surface, not to install / reinstall / import.

### `import --scope project` (narrows writes to project scope only)

<!-- catalog-state: scope-project-narrow -->

```text
Claude plugin import summary

● claude-plugins-official [project] <autoupdate> (added)
  ● official-plugin [project] (installed)
● directory-marketplace [project] (added)
  ● local-plugin [project] (installed)
● github-marketplace [project] <autoupdate> (added)
  ● github-plugin [project] (installed)

/reload to pick up changes
```

### `import` with source-mismatch on an existing marketplace

<!-- catalog-state: source-mismatch -->

```text
Claude plugin import summary

● claude-plugins-official [project] <autoupdate> (added)
  ● official-plugin [project] (installed)
⊘ directory-marketplace [project] (failed) {source mismatch}
  Existing marketplace source ./mismatched-directory-marketplace does not match Claude settings source ./directory-marketplace.
  ⊘ local-plugin [project] (skipped) {source mismatch}
● github-marketplace [project] <autoupdate> (added)
  ● github-plugin [project] (installed)

/reload to pick up changes
```

The marketplace header carries `(failed) {source mismatch}` with an indented diagnostic line; dependent plugins under it are skipped with the same reason. (Note: the example shows `--scope project` only, so each marketplace touches a single scope -- the multi-scope split is illustrated in the "Fresh import" example above.)

### Per-row soft-dep markers on import cascade rows

<!-- catalog-state: soft-dep-markers -->

```text
Claude plugin import summary

● claude-plugins-official [project] (added)
  ● agent-only-plugin [project] (installed) {requires pi-subagents}
  ● dual-plugin [project] (installed) {requires pi-subagents, requires pi-mcp}

/reload to pick up changes
```

Notes:

- Each `(installed)` cascade row carries its own `{requires pi-…}` reason when the plugin declares the corresponding resource AND the companion extension is unloaded (MSG-SD-1 / MSG-SD-2). The agents-only row fires `{requires pi-subagents}`; the dual-plugin row fires both reasons inside a single `{}` block.
- Combined-row ordering is closed-set: `pi-subagents` precedes `pi-mcp`, joined by a literal comma-space inside the `{}` block (MSG-SD-1 closed grammar, mirrored on adjacent surfaces).
- `(uninstalled)` rows never carry these markers -- uninstall removes the content that would have needed the companion, so the marker has no actionable meaning (MSG-SD-2 carve-out, MSG-SD-3).

### Same marketplace name in both scopes (cross-scope tie-break)

<!-- catalog-state: same-mp-both-scopes -->

```text
Claude plugin import summary

● official [project] (added)
  ● alpha [project] (installed)
● official [user] (added)
  ● beta [user] (installed)

/reload to pick up changes
```

When the same marketplace name is added to both scopes during an import, the project-scope cascade block renders before the user-scope block (MSG-GR-3 via `compareByNameThenScope`). Same lock as the reinstall and update surfaces.

______________________________________________________________________

## `/claude:plugin bootstrap`

Single-shot setup of `anthropics/claude-plugins-official` in user scope with autoupdate enabled. Idempotent. Single-marketplace command -- no marketplace header form needed.

### Fresh bootstrap

<!-- catalog-state: fresh -->

```text
● claude-plugins-official [user] <autoupdate> (added)

/reload to pick up changes
```

Bootstrap explicitly enables autoupdate, so the `<autoupdate>` marker is present.

### Re-run when already bootstrapped

<!-- catalog-state: already-bootstrapped -->

```text
● claude-plugins-official [user] <autoupdate> (skipped) {already installed}
```

______________________________________________________________________

## `/claude:plugin marketplace list`

Marketplace-only command -- no plugin children, so no header form.

### Empty

<!-- catalog-state: empty -->

```text
(no marketplaces)
```

### Mixed scopes -- pure alphabetical sort, per-scope rendering

<!-- catalog-state: mixed-scopes -->

```text
● alpha [project] <autoupdate>
● alpha [user]
● beta [user]
● zeta [project] <autoupdate>
```

Notes:

- List rows are pure label rows -- no status token. The marketplace's outcome on `add` is announced by `marketplace add`; the list surface just enumerates what is configured. The `<autoupdate>` marker (when present) is the sole per-row signal beyond name and scope.
- Sort by name (case-insensitive `localeCompare`, `sensitivity: 'base'`); same-name rows tie-break by scope (project before user). This is a name-primary, scope-secondary sort -- NOT a lexicographic compare of the full `<name> [<scope>]` label.
- Marketplaces are listed per scope -- a marketplace in both scopes renders as TWO rows. Each row carries its own autoupdate state independently (e.g. above, `alpha [project]` has autoupdate on while `alpha [user]` has autoupdate off).

______________________________________________________________________

## `/claude:plugin marketplace add <source>`

Single-marketplace command -- no marketplace header form.

### Success -- path source

<!-- catalog-state: path-source -->

```text
● local-mp [user] (added)

/reload to pick up changes
```

Path-source marketplaces default to autoupdate OFF -- no `<autoupdate>` marker emitted.

### Success -- GitHub source

<!-- catalog-state: github-source -->

```text
● claude-plugins-official [user] <autoupdate> (added)

/reload to pick up changes
```

GitHub-source marketplaces default to autoupdate ON -- the `<autoupdate>` marker is present.

### Failure

<!-- catalog-state: failure-unreachable -->

```text
⊘ unreachable-mp [user] (failed)
  cause: fatal: unable to access 'https://...': Could not resolve host
```

______________________________________________________________________

## `/claude:plugin marketplace remove <name>`

Single-marketplace command that cascades plugin unstaging. The marketplace itself is the primary subject; when the cascade hits plugin-unstage failures, render them as indented children under the marketplace header.

### Clean removal (no plugin-unstage failures)

<!-- catalog-state: clean -->

```text
● local-mp [user] (removed)

/reload to pick up changes
```

### Partial removal (some plugins unstaged, others failed)

<!-- catalog-state: partial -->

```text
⊘ local-mp [user] (failed) {plugins remain}
  ○ helper [user] v1.0.0 (uninstalled)
  ⊘ tool [user] (failed) {permission denied}
    cause: EACCES: permission denied

/reload to pick up changes

Fix the underlying issue and retry.
```

The marketplace header carries `(failed) {plugins remain}`; plugin rows indent 2 spaces underneath without `@<marketplace>` and reflect mixed outcomes -- successful unstages render `(uninstalled)` with `○` (plugin no longer installed, no error), failed unstages render `(failed)` with `⊘` and a `cause:` trailer.

When at least one plugin successfully unstaged, BOTH trailers fire (one blank line between each): `/reload to pick up changes` (MSG-RH-1, a resource changed) AND `Fix the underlying issue and retry.` (recovery anchor). The reload hint sits above the retry anchor.

If every plugin in the cascade failed to unstage (no resources changed), the `/reload` trailer is omitted and the retry anchor stands alone. Severity in either case: `notifyWarning`.

______________________________________________________________________

## `/claude:plugin marketplace update <name>` (single marketplace, multi-plugin cascade)

Renders the marketplace as the header with `(updated)` status; plugin outcomes indent underneath. The `Updated marketplace "X" in <scope> scope.` summary line is RETIRED -- the marketplace header carries the same information.

### Autoupdate off -- manifest refresh only (no plugins to evaluate)

<!-- catalog-state: autoupdate-off-manifest-refresh -->

```text
● local-mp [user] (updated)
```

A `marketplace update` invocation runs whether or not autoupdate is on. When autoupdate is off (as here, on the path-source `local-mp`), no `<autoupdate>` marker is emitted; the operation is just a manual refresh.

### Mixed plugin outcomes

<!-- catalog-state: mixed-outcomes -->

```text
● official [user] <autoupdate> (updated)
  ● alpha [user] v0.5.0 → v1.0.0 (updated)
  ● beta [user] (skipped) {up-to-date}
  ⊘ delta [user] v1.0.0 → v1.4.0 (failed) {network unreachable}

/reload to pick up changes
```

The marketplace header at column 0 doubles as the outcome row -- the marketplace WAS updated (manifest refresh completed). The command runs whether triggered manually or by autoupdate. Plugin rows indent 2 spaces underneath and are alphabetical across all partitions.

### Marketplace update failed (manifest unreachable)

<!-- catalog-state: mp-failure-network -->

```text
⊘ official [user] <autoupdate> (failed) {network unreachable}
  cause: fatal: unable to access 'https://...': Could not resolve host
```

When the marketplace-level update itself fails, no plugin children are evaluated; this is effectively single-shot at the marketplace level.

______________________________________________________________________

## `/claude:plugin marketplace autoupdate <enable|disable> <name>`

Multi-marketplace flag flip. Marketplaces are the only resources affected -- no plugin children -- so this command renders as flat marketplace rows, not a header+children form. No reload-hint trailer (autoupdate is a config flag, not a resource change).

### Enable across multiple marketplaces (one already enabled)

<!-- catalog-state: enable-mixed -->

```text
● local-mp [user] <autoupdate>
● github-mp [project] <autoupdate>
● claude-plugins-official [user] <autoupdate> {already enabled}
```

The `<autoupdate>` marker is the outcome (no status token on these rows -- the marker IS the announcement that autoupdate is now ON). Marketplaces that were already enabled carry `{already enabled}` as the reason.

### Disable

<!-- catalog-state: disable-mixed -->

```text
● local-mp [user] <no autoupdate>
● some-mp [user] <no autoupdate> {already disabled}
```

The `<no autoupdate>` marker only appears here -- as the outcome row of `marketplace autoupdate disable`. In every other surface, autoupdate-off is conveyed by the ABSENCE of the `<autoupdate>` marker.

### Failure (marketplace not found)

<!-- catalog-state: failure-not-found -->

```text
⊘ missing-mp [user] (failed) {not found}
```

______________________________________________________________________

## Manual recovery anchors

When state is unrecoverable mid-operation, a separate top-level `manual-recovery` line follows the triggering emission (§7 MSG-MR-1).

Example (triggered by a failing `install`):

<!-- catalog-state: install-failure-with-anchor -->

```text
⊘ official-plugin@official [user] (failed)
  cause: bridge: agent staging conflict

⊘ agent index (manual recovery) {unreadable}
  /path/to/agents-index.json
  /path/to/another-agent.md
```

- The manual-recovery line is a SEPARATE top-level emission -- NOT a continuation of the failure.
- For system-level resources (agent index, state.json), the resource name goes directly in the name slot -- no `@<marketplace>` token, no scope brackets (MSG-MR-2).
- Internal programmatic-discriminator prefixes (`internal:bridge-manual-recovery:`, `internal:transaction-rollback-partial:`) are stripped before delivery to the user.

______________________________________________________________________

## Empty / no-op surfaces

| Surface                                                                                            | Output                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Empty plugin list                                                                                  | `(no plugins)`                              |
| Empty marketplace list                                                                             | `(no marketplaces)`                         |
| List filtered to non-existent scope                                                                | empty token form per above                  |
| Marketplace block with no plugins inside it (e.g. plugin list when a marketplace has zero plugins) | `● <marketplace> [<scope>]\n  (no plugins)` |

______________________________________________________________________

## Usage errors

Routed via `notifyError` (severity `error`):

```text
Usage: /claude:plugin <subcommand> [args]
Subcommands: install, uninstall, update, reinstall, list, bootstrap, import, marketplace
```

Exact wording is renderer-specific; the contract is `notifyError` routing and a help-style body.

______________________________________________________________________

## Resolutions to apply to `docs/messaging-style-guide.md`

These items are decided in this catalog and need corresponding edits in the source-of-truth spec:

### Resolved (consistency-review pass)

- **Plugin row icon rule** (NEW): icons reflect effective install state, not operation outcome. `●` installed, `○` not installed (no error: `(uninstalled)`, `(available)`), `⊘` error / blocked (`(failed)`, `(unavailable)`, failure-cascade `(skipped)`). Update MSG-IC-\* in `messaging-style-guide.md` to codify the three-icon split.
- **Reasons format** (LOOSENED): MSG-GR-4 currently reads "two-word-lowercase." Change to "1-3 words lowercase, hyphenated where natural; manifest field names render verbatim as the sole carve-out." Justifies existing reasons: `{unparseable}` (one word), `{not in manifest}` (three words), `{hooks}` / `{lspServers}` (manifest fields).
- **`(unavailable)` scope-bracket scope**: MSG-PL-6 (no scope bracket on `(available)` / `(unavailable)`) is plugin-LIST-only. Install / reinstall / import surfaces ALWAYS keep the scope bracket on `(unavailable)` rows.
- **Sort order**: name primary (case-insensitive `localeCompare`, `sensitivity: 'base'`), scope as tie-breaker (project before user). NOT a full-label lexicographic compare. Applies to marketplace list, plugin-list marketplace blocks, and any other sorted marketplace surface.
- **Reload-hint emission**: MSG-RH-1 fires only when a loaded resource actually changed. All-failed cascades with no successful row do NOT emit the hint. A bare manifest refresh (no plugins) does NOT emit the hint.
- **Reload + retry anchor coexistence**: on `notifyWarning` recovery surfaces (marketplace remove partial failure), `/reload` and the retry anchor BOTH fire when applicable -- reload above retry, one blank line between. If no resource changed, the reload trailer is omitted and the retry anchor stands alone.
- **Soft-dep reason naming**: catalog form wins. Rename `{pi-subagents required}` → `{requires pi-subagents}` and `{pi-mcp required}` → `{requires pi-mcp}` in `messaging-style-guide.md §4` closed reasons list.
- **Autoupdate marker grammar slot**: adopt `<…>` as a new grammar slot, parallel to status `(…)` and reasons `{…}`. Closed set `<autoupdate>`, `<no autoupdate>`. Position: `<icon> <marketplace> [<scope>] [<marker>] [(status)] [{reasons}]`. Emission rules: `<autoupdate>` always when ON; nothing when OFF; `<no autoupdate>` only as the result-row marker of `marketplace autoupdate disable`. Extend MSG-GR-1.

### Other spec additions still pending

- **Marketplace icon rule**: marketplace lines (header AND row form) ALWAYS carry a leading icon (`●` OK / `⊘` failure-warning), outcome-class semantic distinct from the plugin-row effective-state rule. Promote the icon from optional to required on marketplace grammar in `messaging-style-guide.md §1` (MSG-GR-1).
- **Marketplace header grammar**: marketplace HEADER lines carry a marker slot even when they have no status token.
- **`(failed) {plugins remain}` reason**: introduced for marketplace-remove partial-failure header rows. Add to closed `reasons` set.
- **`(failed) {unparseable}` reason**: introduced for marketplace whose manifest fails to parse (plugin list surface). Add to closed `reasons` set.
- **`(unavailable) {not in manifest}` reason**: introduced for the broadened `(unavailable)` scope (plugin name not declared in marketplace manifest). Add to closed `reasons` set.
- **Unsupported-feature reasons**: closed `reasons` set in `messaging-style-guide.md §4` should enumerate the manifest-field-name carve-out (`{hooks}`, `{lspServers}`, …) per the loosened MSG-GR-4 above.

### New display semantics (need implementation)

- **No marketplace collapse**: marketplaces are rendered per scope. The same marketplace name appears as two independent rows / headers when it exists in both scopes. The `[project, user]` collapsed form is dormant.
- **Plugin folding under marketplace headers**: under `<marketplace> [user]`, fold in orphan project-scoped plugins of that marketplace IF no `<marketplace> [project]` header exists. Implementation needs to know how to detect orphan project-scoped plugins.
- **Adoption rule**: when a project-scope marketplace is later added, orphan project-scoped plugins previously folded under the user-scope header MUST move under the new project-scope header. This is a state mutation at marketplace-add time, not just a rendering change.

### Possible future features

- **`uninstall` cascade form**: this catalog shows uninstall as single-plugin (single-shot). If bulk-uninstall (e.g. `uninstall @<marketplace>`) is desired, it would use the marketplace-header form like reinstall/update.
- **Marketplace versions**: NOT surfaced. Marketplaces have no `version` field in the data model. Could add `hash-<12hex>` for GitHub-source marketplaces (mirroring plugin PI-7) -- would need a schema migration.

### Style-guide alignment

- **Import marketplace-header outcome statuses**: this catalog shows `(added)` / `(skipped)` / `(failed)` on import marketplace headers. Confirm with the existing standalone-marketplace-add status grammar.
- **Plugin-list marketplace block empty case**: this catalog uses `● <marketplace> [<scope>]\n  (no plugins)` for marketplaces with zero plugins. Confirm this is the desired shape vs. omitting the block.

______________________________________________________________________

## Cross-references

- Source-of-truth spec: `docs/messaging-style-guide.md` (status_tokens, reasons, markers, pattern_classes frontmatter; MSG-GR-1..5, MSG-IC-1..3, MSG-SR-1..7, MSG-CC-1, MSG-RH-1, MSG-SD-1..3, MSG-MR-1..2, MSG-RP-1, MSG-PL-1..6, MSG-NC-1..2, MSG-ER-1, MSG-LC-1..2)
- Originating PRD: `docs/prd/pi-claude-marketplace-prd.md`
- Recent UX evolution: planning artifacts at `.planning/quick/260518-va9-*`, `.planning/quick/260519-8v0-*`, `.planning/quick/260519-aje-*`, `.planning/quick/260519-bga-*`
