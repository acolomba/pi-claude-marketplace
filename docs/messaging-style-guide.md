---
version: 1.0
status_tokens:
  - installed
  - updated
  - reinstalled
  - uninstalled
  - added
  - removed
  - available
  - unavailable
  - upgradable
  - skipped
  - failed
  - rollback failed
  - manual recovery
  - no marketplaces
  - no plugins
reasons:
  - up-to-date
  - not found
  - already installed
  - not installed
  - not in manifest
  - invalid manifest
  - no longer installable
  - unsupported source
  - hooks
  - lspServers
  - requires pi-subagents
  - requires pi-mcp
  - rollback partial
  - unreadable
  - unparseable
  - unreadable manifest
  - source mismatch
  - plugins remain
  - concurrently uninstalled
  - concurrently updated
  - stale clone
  - duplicate name
  - lock held
  - already enabled
  - already disabled
  - permission denied
  - source missing
  - network unreachable
markers:
  - autoupdate
  - no autoupdate
pattern_classes:
  - success
  - failure
  - cascade-row
  - cascade-summary
  - list-rendering
  - reload-hint
  - soft-dep
  - manual-recovery
  - rollback-partial
  - usage
  - empty
  - legacy-migrate
inventory_row_count: 83
---

# Messaging Style Guide

**Guide version:** 1.0 **Status:** Normative -- supersedes PRD section 6.12 ES-5 marker strings (see section 15) **Audience:** Engineers authoring or reviewing `ctx.ui.notify` callsites and the single sanctioned `console.warn`

## Table of Contents

- [Messaging Style Guide](#messaging-style-guide)
  - [Table of Contents](#table-of-contents)
  - [0. Overview](#0-overview)
  - [1. Foundational Rule: Line Grammar](#1-foundational-rule-line-grammar)
  - [2. Status Icons](#2-status-icons)
  - [3. Status Tokens](#3-status-tokens)
  - [4. Reasons Enum](#4-reasons-enum)
  - [5. Reload Hint](#5-reload-hint)
  - [6. Soft-Dependency Markers](#6-soft-dependency-markers)
  - [7. Manual Recovery](#7-manual-recovery)
  - [8. Rollback Partial](#8-rollback-partial)
  - [9. Cause Chain](#9-cause-chain)
  - [10. Severity Routing](#10-severity-routing)
  - [11. Plugin List Rendering (PL-4 / PL-5 mapping)](#11-plugin-list-rendering-pl-4--pl-5-mapping)
  - [12. Non-Cascade Errors & Usage Errors](#12-non-cascade-errors--usage-errors)
  - [13. Empty Results](#13-empty-results)
  - [14. IL-3 console.warn (single sanctioned -- PRD section 6.13 IL-3, preserved)](#14-il-3-consolewarn-single-sanctioned----prd-section-613-il-3-preserved)
  - [15. ES-5 Replacement Table (PRD section 6.12 ES-5 supersession; MSG-04)](#15-es-5-replacement-table-prd-section-612-es-5-supersession-msg-04)
  - [16. Pattern Class Reference](#16-pattern-class-reference)
  - [17. Worked Examples Gallery](#17-worked-examples-gallery)
  - [18. Conventions](#18-conventions)
  - [19. Cross-References](#19-cross-references)

## 0. Overview

This guide governs every user-visible message emitted by `pi-claude-marketplace`. In practice that means every invocation of the four sanctioned `ctx.ui.notify` wrappers in `shared/notify.ts` (`notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`) plus the single sanctioned `console.warn` in `persistence/migrate.ts` (PRD section 6.13 IL-3). It defines the compact line grammar (section 1), the closed status-icon set (section 2), the closed status-token set (section 3), the closed reasons enum (section 4), the cause-chain trailer (section 9), severity routing (section 10), and the per-pattern conventions (sections 5-8, 11-17). Section 18 records the cross-cutting punctuation, tree-rendering, and identifier conventions all sections inherit.

The guide is consumed in two ways. Phase 13 reads it as the input contract for the mechanical conformance refactor that rewrites every `needs-rewording` / `replace-marker` row in `docs/messaging-inventory.md`. Phase 14 reads it as the drift-guard baseline that fails `npm run check` when a new callsite violates a rule. Engineers writing new callsites going forward MUST read sections 1-4 and 10 before composing a message. Section 15 ("ES-5 Replacement Table") records the five PRD section 6.12 ES-5 marker strings this guide supersedes -- that table is the contract change Phase 13 applies to `shared/markers.ts`.

______________________________________________________________________

## 1. Foundational Rule: Line Grammar

Every user-visible compact line emitted by `pi-claude-marketplace` MUST conform to the universal shape defined here. Sentence-form messages emitted via `notifyUsageError` and the single sanctioned `console.warn` are NOT compact lines and are governed by sections 12 and 14 instead.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-GR-1** | Every compact line MUST follow the universal shape `<icon> <name>[@marketplace] [scope(s)] [<marker>] [version] (status) {reason(s)}`. Token order is fixed: icon → name → optional `@marketplace` → scope(s) → optional marker → optional version → status → reason(s). The marker slot is angle-bracketed (`<autoupdate>` / `<no autoupdate>`) and appears only on marketplace rows (see MSG-GR-5). The version slot uses no surrounding delimiter (literal `v1.2.3` or `v1.2.3 → v1.4.0` for a transition per CONTEXT.md D-32 / D-33). Absent slots are omitted entirely; no placeholder text is rendered. (per CONTEXT.md D-01 + consistency-review marker slot)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **MSG-GR-2** | The `@<marketplace>` token MUST be rendered only on standalone single-plugin mentions (e.g. the result of `install <plugin>@<marketplace>` or a single-target error such as `⊘ unknown@claude-plugins-official (failed) {not found}`). On plugin rows inside a marketplace-headed cascade the `@<marketplace>` MUST be omitted -- those rows inherit the marketplace from the cascade header line. (per CONTEXT.md D-02)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **MSG-GR-3** | Scope rendering is PER-SCOPE on every surface: marketplaces AND plugins. When a plugin is installed in both scopes it MUST appear on two separate lines (one per scope). When a marketplace exists in both scopes it MUST ALSO appear as two separate header / row lines (one per scope), each carrying its own marker, status, and reasons independently. The collapsed multi-scope form `[project, user]` is RESERVED for the dormant case of a single record genuinely applying to both scopes simultaneously; no current surface exercises it. When the collapsed form IS emitted, the in-bracket order MUST be `project, user`. `list` rendering of BOTH the plugin surface (§11) AND the marketplace surface (§11.2 / `listRenderingMarketplaces`) MUST NOT emit per-scope group-header lines (e.g. `project scope` / `user scope`); both lists are FLAT. Row order is name-primary (case-insensitive `localeCompare` with `sensitivity: 'base'`), scope-secondary (project before user) as a tie-breaker -- NOT a lexicographic compare of the full `<name> [<scope>]` label. (per CONTEXT.md D-03 + quick 260519-bga and consistency-review pass: marketplace collapse retired in favor of per-scope rendering) |
| **MSG-GR-4** | Reasons MUST live inside a single `{}` block, comma-separated, 1-3 words lowercase, hyphenated where natural (`{up-to-date}`, `{rollback partial}`, `{not in manifest}`). Manifest field names render verbatim as the sole carve-out (`{hooks}`, `{lspServers}`). Example: `{requires pi-subagents, requires pi-mcp}`. The braces carry zero or more reasons. Absent `{}` means no reason applies -- the empty form `{}` MUST NOT be emitted. Each reason MUST be drawn from the closed enum in section 4. (per CONTEXT.md D-04 + consistency-review pass)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **MSG-GR-5** | Marketplace rows and marketplace header lines carry an optional `<marker>` slot in angle brackets, parallel to the parenthesised status slot and the brace-wrapped reasons slot. Closed set: `<autoupdate>` (autoupdate ON) and `<no autoupdate>` (autoupdate OFF). Emission rules: `<autoupdate>` MUST be emitted whenever a marketplace has autoupdate ON, on every surface that renders that marketplace (list, add, remove, update, bootstrap, plugin-list marketplace headers, etc.). When a marketplace has autoupdate OFF, the marker MUST be omitted -- the absence carries the OFF signal. The `<no autoupdate>` token MUST appear in exactly ONE place: as the outcome marker of `marketplace autoupdate disable`. Plugin rows MUST NOT carry the marker; autoupdate is a marketplace-level property. Position: between the scope bracket and the status token. (per consistency-review pass, derived from quick 260519-aje and follow-ups)                                                                                                                                                                                                                                                                   |

The universal shape, rendered literally:

```text
<icon> <name>[@marketplace] [scope(s)] [<marker>] [version] (status) {reason(s)}
```

Marketplace rows / headers use the marker slot; plugin rows skip it.

______________________________________________________________________

## 2. Status Icons

The compact-line grammar admits exactly three status icons. The icon is the first token on every compact line. For PLUGIN rows the icon reflects the plugin's effective install state on disk (NOT the operation's success / failure class). For MARKETPLACE rows and headers the icon reflects the operation's outcome class.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-IC-1** | The filled icon `●` (U+25CF) MUST be used on PLUGIN rows when the plugin is installed and in the requested state -- `(installed)`, `(updated)`, `(upgradable)`, and `(skipped)` no-ops where the plugin remains installed (`{up-to-date}`, `{already installed}`). On MARKETPLACE rows / headers, `●` signals an OK outcome class -- `(added)`, `(removed)`, `(updated)`, or a `(skipped)` no-op. (per CONTEXT.md D-05 + consistency-review pass)                                                                                                                                             |
| **MSG-IC-2** | The open icon `○` (U+25CB) MUST be used on PLUGIN rows when the plugin is NOT installed and there is no error -- `(available)` (declared in the manifest but not installed in this scope) and `(uninstalled)` (explicitly removed by the operator). Neither is an error condition; the plugin is simply absent. The open icon MUST NOT appear on marketplace rows. (per CONTEXT.md D-05 + consistency-review pass)                                                                                                                                                                            |
| **MSG-IC-3** | The blocked icon `⊘` (U+2298) MUST be used on PLUGIN rows for error or blocked states regardless of install state -- `(unavailable)`, `(failed)`, `(rollback failed)`, `(manual recovery)`, and `(skipped)` rows that are failure-cascade children (the parent failed and this row was blocked, e.g. `{source mismatch}`). On MARKETPLACE rows / headers, `⊘` signals a failure / error outcome class -- `(failed)`, `(unavailable)`, or any case where the marketplace itself could not be advanced (manifest unparseable, source mismatch). (per CONTEXT.md D-05 + consistency-review pass) |

The three icons are independent of the operation outcome. A successful uninstall is `○` because the plugin is now gone (no error). A failed install is `⊘` because something went wrong. A skipped no-op on an already-installed plugin is `●` because the plugin is still installed. A marketplace remove that succeeded is `●` because the operation succeeded, even though the marketplace is no longer present (marketplace icons follow outcome-class semantics, not effective-state).

Worked example -- filled icon (installed plugin in `list` output):

```text
● claude-md-management [user] v0.4.1 (installed) {requires pi-subagents}
```

Worked example -- open icon (available plugin in `list` output):

```text
○ serena v2.0.0 (available)
```

Worked example -- open icon (uninstalled plugin, post-op):

```text
○ commit-commands [user] v1.4.0 (uninstalled)
```

Worked example -- blocked icon (unavailable plugin in `list` output):

```text
⊘ hookify (unavailable) {hooks}
```

______________________________________________________________________

## 3. Status Tokens

Status tokens are a closed set of 15 values. Every compact line carries exactly one status token in parentheses. The table below enumerates the closed set in canonical order; this order MUST be byte-identical to the `status_tokens:` list in the frontmatter (frontmatter entries are unquoted plain text with no parentheses; rendered examples in this table show the literal in-grammar form with parentheses).

| Token               | Meaning                                                                                                                                                                                                                                                                                                           | Example render                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `(installed)`       | Plugin record is present in state and all staged resources are committed to disk.                                                                                                                                                                                                                                 | `● commit-commands [project] (installed)`                                      |
| `(updated)`         | Plugin record advanced from one version to another; staged resources replaced atomically.                                                                                                                                                                                                                         | `● commit-commands [user] v1.2.3 → v1.4.0 (updated)`                           |
| `(reinstalled)`     | Operation just ran: reinstall partition. Plugin record was atomically replaced in place (same version) on a reinstall cascade row; staged resources re-committed to disk.                                                                                                                                         | `● alpha [user] v1.0.0 (reinstalled)`                                          |
| `(uninstalled)`     | Plugin record removed from state and all staged resources cleaned from disk. Icon is `○` -- plugin no longer installed, no error.                                                                                                                                                                                 | `○ commit-commands [user] (uninstalled)`                                       |
| `(added)`           | Marketplace record added to state in the named scope; the source clone is present and the manifest validated.                                                                                                                                                                                                     | `● claude-plugins-official [user] <autoupdate> (added)`                        |
| `(removed)`         | Marketplace record removed from state in the named scope; the source clone and all installed-plugin records under it are gone.                                                                                                                                                                                    | `● claude-plugins-official [user] (removed)`                                   |
| `(available)`       | Plugin entry exists in a marketplace manifest and is installable in the current environment but is not installed.                                                                                                                                                                                                 | `○ serena (available)`                                                         |
| `(unavailable)`     | Plugin entry exists in a marketplace manifest but is not installable (declares unsupported components, an unsupported source, or is not declared in the manifest at all).                                                                                                                                         | `⊘ hookify (unavailable) {hooks}`                                              |
| `(upgradable)`      | Installed plugin's manifest version differs from the installed version (PL-5); a newer version is available. Implies installed.                                                                                                                                                                                   | `● commit-commands [user] v1.2.3 → v1.4.0 (upgradable)`                        |
| `(skipped)`         | Operation did not act on this target. Always carries a reason in `{}` explaining why (e.g. `{up-to-date}`, `{not in manifest}`, `{source mismatch}`). Icon is `●` when the plugin remains installed (trivial skip) and `⊘` when the skip is a failure-cascade child (the parent failed and this row was blocked). | `● commit-commands [user] (skipped) {up-to-date}`                              |
| `(failed)`          | Unforeseen or unexpected error prevented the operation. State did not advance for this target.                                                                                                                                                                                                                    | `⊘ commit-commands@claude-plugins-official [user] (failed) {rollback partial}` |
| `(rollback failed)` | Rollback of a partially-staged operation failed. The resource is in a partial state and requires manual recovery.                                                                                                                                                                                                 | `⊘ mcp (rollback failed) {EACCES /home/.../mcp.json}`                          |
| `(manual recovery)` | Operator intervention is required to resolve a partial or unreadable resource state. Anchors a separate top-level compact line.                                                                                                                                                                                   | `⊘ agent index (manual recovery) {unreadable}`                                 |
| `(no marketplaces)` | The targeted scope has no marketplaces configured. Renders as a bare compact token; no icon, name, or other slot is required.                                                                                                                                                                                     | `(no marketplaces)`                                                            |
| `(no plugins)`      | The targeted marketplace or scope has no installed plugins, or the cascade had no targets. Renders as a bare compact token.                                                                                                                                                                                       | `(no plugins)`                                                                 |

### 3.1 (failed) vs (skipped)

`(failed)` is reserved for unforeseen or unexpected errors -- paths the operator did not anticipate (cascade failures, atomic rollback failures, I/O errors). Routine "we could not perform the update but the previously installed version is still usable" outcomes MUST render as `(skipped) {<reason>}`, not `(failed)`. The discriminator is whether the post-operation state is known good and usable: a trivial `(skipped)` (`{up-to-date}`, `{already installed}`) carries the filled `●` icon because the plugin remains installed; a `(skipped)` row whose skip is a failure-cascade child (e.g. `{source mismatch}` -- the parent marketplace failed and this row was blocked) carries the blocked `⊘` icon because the plugin is NOT installed; `(failed)` lines carry the blocked `⊘` icon because state did not advance and the resource may be in an unknown state. (per CONTEXT.md D-07 + consistency-review pass)

### 3.2 Folding (unchanged) into (skipped)

Today's `update` partition emits a separate `unchanged` token for the "no work to do" outcome (plugin already at target version). This guide folds that case into `(skipped) {up-to-date}` -- `unchanged` is not a distinct status token. The single canonical render for a target that did not need updating is `● <plugin> [<scope>] (skipped) {up-to-date}`. Phase 13 re-derives `renderPartition` to emit this form instead of the legacy `unchanged` partition. (per CONTEXT.md D-08)

______________________________________________________________________

## 4. Reasons Enum

Reasons are a closed enum. Every reason that renders inside a `{}` block on a compact line MUST appear in this table. Phase 14's drift guard reads the frontmatter `reasons:` list (brace-stripped form of column 1) as the binding contract; the table below is the human-readable view with one-line definitions and one citing callsite per reason.

Audit changes relative to the D-09 starter set: drop `existing` (no emitting callsite); drop `manual recovery` (promoted to status-token-only per CONTEXT.md D-06); add `not installed`, `invalid manifest`, `unreadable manifest`, `concurrently uninstalled`, `concurrently updated`, `stale clone`, `duplicate name`, `lock held` based on the citing callsites inventoried in 12-RESEARCH.md "Reasons Enum Empirical Validation."

| Reason                       | Definition                                                                                                                                                                                                                                  | Example callsite                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `{up-to-date}`               | The target is already at the desired version; the operation had no work to perform.                                                                                                                                                         | `{up-to-date}` at `orchestrators/plugin/update.ts:750`                                 |
| `{not found}`                | The named entity (plugin, marketplace, or scope) does not exist in the resolved location.                                                                                                                                                   | `{not found}` at `orchestrators/plugin/install.ts:229`                                 |
| `{already installed}`        | The target plugin already has a state record in the same scope and marketplace; install refused.                                                                                                                                            | `{already installed}` at `orchestrators/plugin/install.ts:251`                         |
| `{not installed}`            | Update or uninstall targeted a plugin with no state record in the resolved scope; nothing to act on.                                                                                                                                        | `{not installed}` at `orchestrators/plugin/update.ts:359`                              |
| `{not in manifest}`          | The plugin record exists in state but the marketplace manifest no longer lists it.                                                                                                                                                          | `{not in manifest}` at `orchestrators/plugin/update.ts:369`                            |
| `{invalid manifest}`         | A manifest entry exists but failed schema validation (`PLUGIN_ENTRY_VALIDATOR.Check` rejected it).                                                                                                                                          | `{invalid manifest}` at `orchestrators/plugin/update.ts:378`                           |
| `{no longer installable}`    | Plugin was installable when first installed but the current manifest version declares unsupported components or an unsupported source.                                                                                                      | `{no longer installable}` at `domain/resolver.ts:785`                                  |
| `{unsupported source}`       | Plugin entry declares a source kind the extension does not support (e.g. `npm`, `github`).                                                                                                                                                  | `{unsupported source}` at `domain/resolver.ts:295`                                     |
| `{hooks}`                    | Plugin entry declares a `hooks` component; hook support is out of scope for V1. Manifest field name rendered verbatim (MSG-GR-4 carve-out).                                                                                                 | `{hooks}` at `domain/resolver.ts:140`                                                  |
| `{lspServers}`               | Plugin entry declares an `lspServers` component; LSP support is out of scope for V1. Manifest field name rendered verbatim (MSG-GR-4 carve-out). Renamed from `{lsp}` for consistency-review alignment with the Claude manifest field name. | `{lspServers}` at `domain/resolver.ts:141`                                             |
| `{requires pi-subagents}`    | Plugin declares agents that depend on the `pi-subagents` companion extension being loaded; the extension is currently not loaded.                                                                                                           | `{requires pi-subagents}` at `platform/pi-api.ts` (composed into `notifySuccess` body) |
| `{requires pi-mcp}`          | Plugin declares MCP servers that depend on the `pi-mcp-adapter` companion extension being loaded; the extension is currently not loaded.                                                                                                    | `{requires pi-mcp}` at `platform/pi-api.ts` (composed into `notifySuccess` body)       |
| `{rollback partial}`         | A multi-phase operation failed and the rollback could not fully reverse the prior phases; the resource is in a partial state.                                                                                                               | `{rollback partial}` at `transaction/rollback.ts` (`formatRollbackError`)              |
| `{unreadable}`               | A persisted state file (`agents-index.json` or `state.json`) could not be read or parsed; AS-7 manual-recovery anchor.                                                                                                                      | `{unreadable}` at `shared/path-safety.ts:144`                                          |
| `{unparseable}`              | A marketplace manifest exists but failed to parse (JSON syntax error). Distinct from `{unreadable manifest}` which is an I/O failure; this is a syntactic failure.                                                                          | `{unparseable}` at marketplace list rendering (consistency-review pass)                |
| `{unreadable manifest}`      | A marketplace manifest could not be read during `list` rendering (PL-6 surface); distinct from `{unreadable}` which pertains to state files.                                                                                                | `{unreadable manifest}` at `orchestrators/plugin/list.ts:239`                          |
| `{source mismatch}`          | `import` detected an existing marketplace with a different source than what Claude settings declares; the marketplace and its plugin children are blocked.                                                                                  | `{source mismatch}` at `orchestrators/plugin/import.ts` (consistency-review pass)      |
| `{plugins remain}`           | `marketplace remove` cascade could not unstage every installed plugin under the marketplace; the marketplace removal is partial and operator must resolve the per-plugin failures.                                                          | `{plugins remain}` at `orchestrators/marketplace/remove.ts` (consistency-review pass)  |
| `{concurrently uninstalled}` | TOCTOU race: another Pi process uninstalled this plugin between preflight and the locked transaction.                                                                                                                                       | `{concurrently uninstalled}` at `orchestrators/plugin/update.ts:513`                   |
| `{concurrently updated}`     | TOCTOU race: another Pi process updated this plugin between preflight and the locked transaction; the recorded version no longer matches.                                                                                                   | `{concurrently updated}` at `orchestrators/plugin/update.ts:518`                       |
| `{stale clone}`              | `marketplace add` refused because the target source-clone directory already exists from a previous failed add; operator must remove it manually.                                                                                            | `{stale clone}` at `orchestrators/marketplace/add.ts:184`                              |
| `{duplicate name}`           | `marketplace add` refused because a marketplace with the derived name already exists in the named scope (MA-8).                                                                                                                             | `{duplicate name}` at `orchestrators/marketplace/add.ts:266`                           |
| `{lock held}`                | Another `pi-claude-marketplace` operation in the same scope holds the per-scope `.state-lock` sentinel; this operation refused at preflight.                                                                                                | `{lock held}` at `shared/markers.ts:37` (`STATE_LOCK_HELD_PREFIX`)                     |
| `{permission denied}`        | A filesystem operation (rm, rename, write) was refused by the OS -- canonical reason for EACCES / EPERM failures on uninstall + marketplace-remove cascades. Catalog binding at uninstall failure + marketplace-remove partial child rows.   | `{permission denied}` at uninstall + marketplace-remove failure surfaces (Plan 13-03)  |
| `{source missing}`           | A plugin's marketplace source (clone directory or path-source root) is no longer present on disk -- canonical reason for reinstall partition failure rows when the source has been removed since the original install.                      | `{source missing}` at reinstall failure surfaces (Plan 13-03)                          |
| `{network unreachable}`      | A network operation (clone, fetch, head) failed because the remote host could not be contacted -- canonical reason for github-source marketplace update + plugin update network failures.                                                    | `{network unreachable}` at update + marketplace-update failure surfaces (Plan 13-03)   |

______________________________________________________________________

## 5. Reload Hint

The reload hint replaces the legacy ES-5 marker `Run /reload to <verb> …` (PRD section 6.12). The old composer at `presentation/reload-hint.ts` admitted three verbs (`load`, `refresh`, `drop`) selected by operation kind; under the new grammar a single canonical trailer covers every emission case.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-RH-1** | When the reload hint is emitted, the canonical trailer MUST be the literal string `/reload to pick up changes`, preceded by a blank line, appended after the compact-line body of the parent `notifySuccess` (or `notifyWarning` on a partial-failure recovery surface) message. Verb variation (`load`, `refresh`, `drop`) is RETIRED -- the single trailer covers every emission case. The PRD section 6.8 RH-1 emission semantic is PRESERVED unchanged: the trailer is emitted ONLY when the operation actually changed loaded resources (at least one skill, command, agent, or MCP entry was staged, advanced, or removed). All-failed cascades with no successful row do NOT fire the hint (nothing changed on disk). A bare marketplace-manifest refresh with no plugin children to evaluate does NOT fire the hint either (manifest contents are not a loaded resource). (per CONTEXT.md D-10 + consistency-review pass) |

The emission predicate is structural, not textual: when the operation's result payload reports zero changed resources (e.g. an uninstall against a plugin whose generated artefacts were already gone, an all-failed reinstall cascade, or a `marketplace remove` whose installed-plugin set was empty), the trailer MUST be omitted. The composer at `presentation/reload-hint.ts` collapses under D-10 to `reloadHint(names) → names.length > 0 ? "/reload to pick up changes" : ""` -- a single-branch helper. Phase 13 wires this collapse; Phase 12 documents only.

**Coexistence with recovery anchors.** On `notifyWarning` recovery surfaces (e.g. `marketplace remove` partial failure), `/reload to pick up changes` and the recovery-anchor sentence (`Fix the underlying issue and retry.`) BOTH fire when applicable. The reload trailer sits above the recovery anchor, with a blank line between each. If no loaded resource changed (every plugin in the cascade failed to unstage), the reload trailer is omitted and the recovery anchor stands alone. The two trailers govern two distinct actions (pick up partial state vs initiate manual recovery) and are not mutually exclusive.

Worked example -- successful single-plugin install on a plugin that staged at least one agent (the reload hint follows the compact line after a blank line):

```text
● commit-commands@claude-plugins-official [user] (installed)

/reload to pick up changes
```

______________________________________________________________________

## 6. Soft-Dependency Markers

Soft-dependency markers replace the legacy ES-5 markers `pi-subagents is not loaded; …` and `pi-mcp-adapter is not loaded; …` (PRD section 6.12). Under the new grammar the marker is a `{}` reason on the affected line rather than a sentence trailer.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-SD-1** | Soft-dependency status on a plugin's compact line MUST be surfaced as a `{}` reason: `{requires pi-subagents}` when the plugin declares agents and `pi-subagents` is the unloaded companion, `{requires pi-mcp}` when the plugin declares MCP servers and `pi-mcp-adapter` is the unloaded companion. The two reasons MAY co-occur on a single plugin's row inside the same `{}` block: `{requires pi-subagents, requires pi-mcp}`. (per CONTEXT.md D-11 + consistency-review rename)                                                                                                                                                                                                                                                                             |
| **MSG-SD-2** | The marker MUST be emitted ONLY when (a) the plugin's static manifest declares at least one agent (for `{requires pi-subagents}`) or at least one MCP server (for `{requires pi-mcp}`), AND (b) the corresponding companion extension is NOT currently loaded as probed via `hasLoadedPiSubagents(pi)` / `hasLoadedPiMcpAdapter(pi)`. When both predicates are false the `{}` block omits the marker (and may be empty, in which case `{}` itself is omitted per MSG-GR-4). The marker MUST NOT be emitted on `(uninstalled)` rows: uninstall REMOVES the content that would have needed the companion, so the marker has no actionable meaning post-uninstall. (per CONTEXT.md D-12 + consistency-review pass; preserves PRD section 6.8 RH-5 emission semantic) |
| **MSG-SD-3** | Emission SCOPE is broader than today's PRD section 6.8 RH-5 -- this is a deliberate behavioral contract expansion recorded by Plan 12-03 and wired by Phase 13. The marker MUST appear on every compact line where the plugin is mentioned and its soft-dep is needed but unloaded: (1) `list` rendering for `(available)` and `(installed)` rows; (2) per-row inside an `import` or `update` cascade; (3) the existing single-plugin install / update / reinstall success result. (per CONTEXT.md D-13)                                                                                                                                                                                                                                                          |

### 6.1 Contract expansion under D-13 (vs PRD section 6.8 RH-5)

> Today's PRD section 6.8 RH-5 emits a soft-dep warning ONLY on install / update success when staged resources require the companion extension. D-13 broadens emission to also fire on `list` rendering rows and on per-row cascade outputs. The emission PREDICATE (companion-unloaded + declares-resource, MSG-SD-2) is preserved unchanged from RH-5; the emission SCOPE (which surfaces the marker appears on) is broadened. The marker also shifts from a sentence trailer to a per-row `{}` reason -- D-11 supersedes RH-5's wording.

Phase 12 documents this contract expansion; Phase 13 wires the new probe sites in `orchestrators/plugin/list.ts` and the cascade renderers in `orchestrators/marketplace/update.ts` and `orchestrators/plugin/update.ts`. This requires extending `PluginListEntry` (or the orchestrator's pre-render payload) with `declaresAgents` / `declaresMcp` predicates so the renderer can probe per-row -- today's `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` composers fire once per operation, not per row. See 12-RESEARCH.md "Soft-Dep Emission Scope (D-13 Expansion)" for the full Phase 13 wiring sketch.

### 6.2 Per-row vs per-message emission

Today's RH-5 emits ONE aggregated soft-dep sentence at the end of a single-shot operation (e.g. `Installed plugin X. pi-subagents is not loaded; …`). Under D-11 / D-13 the soft-dep is a PER-ROW reason -- in a multi-plugin cascade each row that needs the dep gets its own `{requires pi-subagents}` and there is NO aggregated trailer. This is a structural change Phase 13's refactor implements; the audit surfaces it here so reviewers see it in the guide.

Worked example -- multi-plugin update cascade with per-row soft-dep markers (the cascade header carries the marketplace; per-row marketplace anchors are omitted per MSG-GR-2):

```text
● claude-plugins-official [user] <autoupdate> (updated)
  ● commit-commands [user] v1.2.0 → v1.4.0 (updated)
  ● claude-md-management [user] v0.4.0 → v0.4.1 (updated) {requires pi-subagents}
  ● serena [user] (skipped) {up-to-date}
  ⊘ hookify [user] (unavailable) {hooks}
```

The `{requires pi-subagents}` reason on the `claude-md-management` row is emitted because that plugin declares an agent and the `pi-subagents` companion is not currently loaded; the same row would carry `{requires pi-subagents, requires pi-mcp}` if the plugin also declared MCP servers and `pi-mcp-adapter` were also unloaded. Other rows omit the marker because either they do not declare the resource or the companion is loaded.

______________________________________________________________________

## 7. Manual Recovery

Manual recovery replaces the legacy ES-5 marker `MANUAL RECOVERY REQUIRED: …` (PRD section 6.12). The legacy form was a sentence prefix on the operation's failure message; under the new grammar manual recovery is a SEPARATE top-level compact line, independent of any triggering operation.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-MR-1** | Manual-recovery surfaces MUST render as a SEPARATE top-level compact line carrying `(manual recovery)` status, preceded by a blank line and independent of whatever operation triggered them (NOT a continuation of any prior failure message). The line carries a `{reason}` describing WHY recovery is needed (e.g. `{unreadable}`, `{rollback partial}`) and MAY carry indented child rows for orphan paths or per-resource detail per section 18.2 (tree rendering). This supersedes the PRD section 6.11 AS-7 sentence form `MANUAL RECOVERY REQUIRED: <path> (<reason>)`. (per CONTEXT.md D-14) |
| **MSG-MR-2** | When the affected resource is system-level (not anchored to a specific plugin or marketplace -- e.g. the agent index at `agents-index.json`, a corrupted `state.json`), the compact line MUST place the resource name DIRECTLY in the name slot rather than the plugin or marketplace name slot. Example: `⊘ agent index (manual recovery) {unreadable}`. No `@<marketplace>` token, no scope brackets. (per CONTEXT.md D-15)                                                                                                                                                                         |

The line is INDEPENDENT of the triggering operation: when a state-load preflight detects an unreadable `agents-index.json` mid-operation, the orchestrator emits its own operation result line (e.g. a `(failed)` line for the operation that was attempted) AND emits a separate top-level manual-recovery line. The two are not a parent / child pair -- they are sibling top-level lines, blank-line-separated.

Worked example -- orphan agent index entry detected during `list` rendering (the operation that triggered the detection completes with its own result; the manual-recovery line follows separately):

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands [user] v1.2.3 (installed)
  ○ serena (available)

⊘ agent index (manual recovery) {unreadable}
  orphan path: ~/.pi/agent/agents-index.json
  parse failure: unexpected end of JSON input at offset 247
```

The indented `orphan path:` and `parse failure:` children are free-form detail rows under section 18.2's tree-rendering rule -- they describe the partial state so the operator can correlate the recovery action with the filesystem.

______________________________________________________________________

## 8. Rollback Partial

Rollback-partial replaces the legacy ES-5 marker `(rollback partial: [<phase>] <msg>; …)` (PRD section 6.12). The parenthesised legacy form conflicts with the new grammar in section 1 -- `(...)` is now reserved for status tokens, not arbitrary error metadata.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-RP-1** | When a multi-phase operation fails and rollback could not fully reverse the prior phases, the failed-operation line MUST carry `(failed) {rollback partial}` when more than one phase rolled back partially, OR `(failed) {<phase>}` when exactly one phase is named and clearer (e.g. `{agents staging}`, `{mcp}`). Indented child rows per affected phase MUST follow on subsequent lines using the section 18.2 tree-rendering rule; each child row is its OWN compact line with its own status token (e.g. `agents staging (failed) {ENOENT /tmp/...}`, `mcp (rollback failed) {EACCES /home/.../mcp.json}`). The parenthesised legacy form is RETIRED. (per CONTEXT.md D-16) |

When the cause-chain trailer is also present (section 9, MSG-CC-1), it appears as a separate trailing line beneath the indented child rows. The parent failed-operation line, the per-phase child rows, and the `cause:` trailer compose into a three-layer structure -- compact parent, indented children, single-line cause trailer.

Worked example -- two-phase rollback (agents staging failed first, then the MCP-phase rollback also failed), with cause chain:

```text
⊘ commit-commands@claude-plugins-official [user] (failed) {rollback partial}
  agents staging (failed) {ENOENT /tmp/pi-claude-marketplace-staging-7a3f}
  mcp (rollback failed) {EACCES /home/user/.pi/agent/mcp.json}
cause: rollback partial -> agents-staging rename failed -> ENOENT: no such file or directory
```

The parent line carries `{rollback partial}` because more than one phase is involved. If only one phase had failed partially (say only the MCP-phase rollback), the parent line could read `(failed) {mcp}` -- the `{<phase>}` form -- and the single indented child row would carry the phase detail.

______________________________________________________________________

## 9. Cause Chain

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-CC-1** | When an `Error.cause` chain is present on the surfaced error, the compact line MUST carry a single trailing line of the form `cause: <link1> -> <link2> -> ...`. The literal `cause:` token is lowercase. Links are joined by `->` (space-arrow-space). Chain traversal is bounded to depth 5 per PRD section 6.12 ES-4; deeper chains are truncated and the depth-5 link is suffixed with a `(truncated)` marker. Lines without a chained cause MUST omit the trailer. Only each link's `.message` is surfaced -- stack traces and absolute paths are NOT included by this composer (NFR-9). The cause-chain trailer is emitted by `notifyError` via the upstream `formatErrorWithCauses` helper. |

Worked example -- failed install with a partial rollback whose root cause chains through the agents-staging phase:

```text
⊘ commit-commands@claude-plugins-official [user] (failed) {rollback partial}
  agents staging (failed) {ENOENT /tmp/...}
  mcp (rollback failed) {EACCES /home/.../mcp.json}
cause: agents staging failed -> ENOENT: no such file or directory -> open '/tmp/pi-...'
```

The indented child rows (`agents staging (failed) {...}` and `mcp (rollback failed) {...}`) are per-phase compact lines per section 8; the final `cause: ...` trailer is the cause-chain composer's output. Today's `notifyError` already walks `Error.cause` via `formatErrorWithCauses` (`orchestrators/plugin/install.ts:580`); Phase 13 restructures the rendered form into the single-line trailer shown here.

______________________________________________________________________

## 10. Severity Routing

`ctx.ui.notify(message, severity)` carries severity as a structural second argument. The four sanctioned wrappers in `shared/notify.ts` (`notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`) encode severity in the wrapper name; callers MUST choose the wrapper that matches the operation's outcome class. The message text MUST NOT embed `[error]` or `[warning]` prefixes (reaffirms PRD section 6.12 ES-2).

The rules below are organized by operation class: single-shot, cascade, and usage. Each rule cites at least one concrete callsite from the existing surface as the canonical anchor.

### 10.1 Single-shot operations

A single-shot operation acts on exactly one resource (one plugin install / update / uninstall / reinstall; one marketplace add / remove / update). Severity routes by whether the operation fully advanced state.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-SR-1** | When a single-shot operation fully advanced state without leaks or soft-dep markers, the orchestrator MUST call `notifySuccess` (severity `default`). The compact line carries the operation's success status token (`(installed)`, `(added)`, `(updated)`, `(uninstalled)`, `(removed)`). Anchor: `orchestrators/marketplace/add.ts:142` (`notifySuccess` after MA-11 commit).                                                                                                                                                  |
| **MSG-SR-2** | When a single-shot operation advanced state but produced post-commit leaks (cache-cleanup failure, post-commit `mkdir` failure, foreign-content preservation, soft-dep markers, or informational warnings), the orchestrator MUST call `notifyWarning` (severity `warning`) for each leak. The primary success line still uses `notifySuccess`; the per-leak warnings ride alongside as separate `notifyWarning` calls. Anchor: `orchestrators/plugin/install.ts:610` (post-commit data-dir `mkdir` deferred → `notifyWarning`). |
| **MSG-SR-3** | When a single-shot operation did not advance state (refused at preflight, threw and rolled back, or the locked transaction aborted), the orchestrator MUST call `notifyError` (severity `error`). The compact line carries `(failed)` status. Anchor: `orchestrators/plugin/install.ts:580` (`notifyError(ctx, cause, err)` after rollback on install failure).                                                                                                                                                                  |

### 10.2 Cascade operations

A cascade operation acts on multiple resources in a single batch (e.g. `marketplace update` updates every plugin in the marketplace; `plugin update` with no arg updates every installed plugin in scope). Cascades report a per-row partition plus a single summary notification at the end.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-SR-4** | When every row in a cascade partition is trivially-successful or trivially-skipped -- meaning each row is `(installed)`, `(updated)`, `(removed)`, or `(skipped) {up-to-date}` -- the cascade summary MUST be emitted via `notifySuccess` (severity `default`). An all-`(skipped) {up-to-date}` cascade is `default`, not `warning`: every row falls under the "trivial skip" branch because no actionable outcome occurred. Anchor: `orchestrators/marketplace/update.ts:359` (`notifySuccess` after MU-7 partition body).                                                               |
| **MSG-SR-5** | When any cascade row is a non-trivial `(skipped)` (skip reason other than `{up-to-date}`) or a `(failed)`, the cascade summary MUST be emitted via `notifyWarning` (severity `warning`). The cascade itself ran to completion and produced per-row data -- the warning signals that the operator should review the partition rows for individual outcomes. Anchor: `orchestrators/plugin/update.ts:732` (cascade-summary `notifySuccess` today; under D-19 Phase 13 adds the partition-walking predicate that routes to `notifyWarning` when any non-trivial skip or failure is present). |
| **MSG-SR-6** | A cascade summary MUST NEVER use `notifyError`, even when every row in the partition is `(failed)`. Cascades report at `notifyWarning` because the cascade itself ran to completion; aborting before all rows complete is a single-shot failure governed by MSG-SR-3 instead. This rule is consistent with today's PUP-9 / MR-3 cascade-vs-direct severity contract. Anchor: `orchestrators/marketplace/remove.ts:251` (aggregate failure summary uses `notifyWarning`, not `notifyError`).                                                                                               |

### 10.3 Usage errors

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-SR-7** | Argument-parsing and usage-validation failures MUST be emitted via `notifyUsageError` (severity `error`) with the relevant Usage block appended after a blank line: `${message}\n\n${usageBlock}`. The compact-line grammar is NOT coerced onto this surface; usage errors retain sentence form (see section 12 for full conventions). The blank-line separation between message and Usage block is part of the user contract. Anchor: `edge/router.ts:125` (`notifyUsageError(ctx, "Usage error.", TOP_LEVEL_USAGE)`). |

The four notify wrappers (`notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`) encode severity in the wrapper itself (per `shared/notify.ts`), not in the message text. Reaffirms PRD section 6.12 ES-2: no `[error]` / `[warning]` prefix embedding in user-visible strings. The wrapper choice IS the severity choice.

______________________________________________________________________

## 11. Plugin List Rendering (PL-4 / PL-5 mapping)

`list` rendering is the densest surface in the extension: every plugin or marketplace the user sees in the top-level `list` output goes through this surface, and the compact-line grammar of section 1 is supplemented here with version-slot rules, description-line rules, and the `(upgradable)` status-token. PRD section 5.3.1 PL-1..PL-7 defines the V1 list-rendering contract; the rules below preserve PL-4 and PL-5 verbatim and codify D-31..D-36 against the new grammar.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-PL-1** | Plugin descriptions (PRD section 5.3.1 PL-4) MUST be preserved VERBATIM from V1: a second indented line beneath the compact line, truncated at column 66 (counting from the column-0 left margin of the indented line). The description line is `list`-only -- install / update / import / uninstall result rows and cascade rows MUST NOT carry descriptions (the operator already knows what they acted on; cascade rows stay tight per section 18.2). Truncation appends the literal U+2026 (`…`) suffix to the truncated body. The 66-column budget is measured in Unicode code points from the first character of the description text (the 6-space indent does NOT count toward the budget). When the description fits within 66 code points verbatim, no suffix is appended. (per CONTEXT.md D-31) |
| **MSG-PL-2** | The optional version slot (MSG-GR-1) renders as the literal `v<version>` (lowercase `v`, e.g. `v1.2.3`) between the scope brackets and the status token. The slot is OMITTED when the underlying record has no version (free-text plugins lacking a manifest-declared version, marketplace headers, system-level resource lines per MSG-MR-2). (per CONTEXT.md D-32)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **MSG-PL-3** | Version TRANSITIONS render with an arrow: `v<from> → v<to>` (literal U+2192, space-padded). This shape applies to two surfaces: (a) `(updated)` rows (post-update result): the slot shows source-version → target-version so the user sees what advanced; (b) `(upgradable)` rows in `list` rendering (PL-5): the slot shows installed-version → manifest-version. All other rows render the single version `v<ver>` or omit the slot per MSG-PL-2. (per CONTEXT.md D-33)                                                                                                                                                                                                                                                                                                                                 |
| **MSG-PL-4** | `(upgradable)` is a status-token enum member (section 3) and IMPLIES `installed`. The status is COMPUTED per PRD section 5.3.1 PL-5 (manifest version differs from install record by string compare) and is RENDERED ONLY by `list` -- it is not an operation outcome and MUST NOT appear on install / update / uninstall result rows. (per CONTEXT.md D-34)                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **MSG-PL-5** | `hash-<12hex>` versions (PRD PI-7) render VERBATIM in the version slot, with or without the transition arrow. The 12 hex characters are NOT abbreviated in `list` rendering -- per 12-RESEARCH.md Open Question 1, conservative first-cut keeps the full hash visible so users can copy-paste it for `--force` or similar arguments. Display-abbreviation is a possible V1.4 enhancement; the V1 contract is full-hash verbatim. (per CONTEXT.md D-35)                                                                                                                                                                                                                                                                                                                                                    |
| **MSG-PL-6** | Version display for non-success states (audit discretion per CONTEXT.md D-36, resolved per 12-RESEARCH.md Open Question 2): SHOW the previously-installed version on `(uninstalled)` rows (`v1.2.3 (uninstalled)`); SHOW the target version on `(failed)` install rows; SHOW the transition on `(failed)` update rows (`v1.2.3 → v1.4.0 (failed)`); OMIT on `(removed)` marketplace lines (marketplaces have no version in the same sense as plugins). (per CONTEXT.md D-36)                                                                                                                                                                                                                                                                                                                              |

Scope bracket display in `list` rendering: `(installed)`, `(upgradable)`, and `(uninstalled)` rows MUST carry the `[<scope>]` bracket because those rows reference an actual install location (past or present). On THIS SURFACE ONLY, `(available)` and `(unavailable)` rows MUST OMIT the scope bracket because they describe a manifest declaration, not an install record. The no-bracket carve-out is PLUGIN-LIST-ONLY: on every other surface (install / reinstall / import / update result rows), `(unavailable)` rows MUST KEEP the scope bracket because the row anchors to a concrete attempted-install location.

The version slot interacts with PL-4 descriptions and per-row soft-dep markers (section 6) -- a fully-populated list row renders icon + name + scope + version + status + reasons on the compact line, with the description indented beneath.

The arrow-grammar of MSG-PL-3 applies to BOTH transition cases. The first worked example below shows `(upgradable)` rendering -- a list-time advisory: this plugin COULD be upgraded. The second worked example shows `(updated)` rendering -- a post-action confirmation: this plugin WAS upgraded. The two surfaces share the same arrow rendering but differ in operation context and severity routing (the `(upgradable)` row is part of a `list` payload routed via `notifySuccess` per section 10.1; the `(updated)` row is part of an `update` result also routed via `notifySuccess`, but in a single-shot or cascade context per section 10.2).

Worked example -- `(upgradable)` rendering inside a `list` output (demonstrates PL-4 descriptions, the version-transition arrow on an `(upgradable)` row, soft-dep marker, the three-icon set, the marketplace header's leading icon, and the `<autoupdate>` marker):

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands [user] v1.2.3 → v1.4.0 (upgradable)
    Curated set of commit, push, and PR helpers for terminal workflows.
  ● claude-md-management [user] v0.4.1 (installed) {requires pi-subagents}
    Audit, repair, and improve CLAUDE.md files across a repository.
  ○ serena v2.0.0 (available)
    Tooling for code symbol exploration and semantic edits.
  ⊘ hookify (unavailable) {hooks}
```

The example above demonstrates the plugin-list scope-bracket carve-out: the `(installed)` and `(upgradable)` rows carry their `[<scope>]` brackets, while the `(available)` and `(unavailable)` rows OMIT the bracket because they have no install location. The marketplace header line carries its leading icon (`●` per the marketplace outcome-class rule) AND its autoupdate marker (`<autoupdate>`, GitHub source defaults ON). The output is FLAT per MSG-GR-3 (no `user scope` / `project scope` group header lines).

Worked example -- `(updated)` rendering as a post-update result row (operation outcome, NOT a `list` rendering -- the arrow grammar from MSG-PL-3 applies here too, but the description line is omitted per MSG-PL-1's `list`-only rule):

```text
● commit-commands [user] v1.2.3 → v1.4.0 (updated)

/reload to pick up changes
```

The two examples show the same arrow grammar (MSG-PL-3) on two different surfaces: the `(upgradable)` advisory inside a `list` payload, and the `(updated)` confirmation as a single-shot update result. Phase 13's refactor wires both -- the renderer for `(upgradable)` rows reads PL-5's string-compare predicate from `PluginListEntry`; the renderer for `(updated)` rows reads the partition payload from `PluginUpdateOutcome`.

______________________________________________________________________

## 12. Non-Cascade Errors & Usage Errors

Non-cascade errors split into two categories based on whether the operation has an identifiable target entity: entity-shaped misses (e.g. `unknown@claude-plugins-official` was not found) use the compact form; argument-parsing and usage-validation failures (no anchor entity) stay in sentence form.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-NC-1** | Operations that target a missing or invalid entity with an identifiable entity shape (plugin / marketplace / scope) MUST render the failure as a compact line: `⊘ <name>[@<marketplace>] [scope] (failed) {<reason>}`. The blocked icon (MSG-IC-3) and the `(failed)` status token signal that state did not advance; the `{<reason>}` block names the specific failure (e.g. `{not found}`, `{not installed}`). Example: `⊘ unknown@claude-plugins-official (failed) {not found}`. (per CONTEXT.md D-21)                                           |
| **MSG-NC-2** | Argument-parsing failures and usage-validation failures (no anchor entity exists) MUST stay in sentence form and be emitted via `notifyUsageError` (severity `error`, routed per section 10.3 MSG-SR-7). The compact-line grammar MUST NOT be coerced onto this surface: there is no `<icon>`, no `<name>`, no `(status)`, no `{}` block. The wrapper appends the Usage block after a blank line per `${message}\n\n${usageBlock}` -- the blank-line separation between message and Usage block is part of the user contract. (per CONTEXT.md D-22) |

Worked example -- entity-shaped non-cascade error (`install` against a plugin that does not exist in the named marketplace; routed via `notifyError` because the operation did not advance state, per section 10.1 MSG-SR-3):

```text
⊘ unknown@claude-plugins-official [user] (failed) {not found}
```

Worked example -- sentence-form usage error (e.g. `/claude:plugin instal commit-commands`, a typo; routed via `notifyUsageError` per MSG-SR-7):

```text
Usage error.

Usage:
  /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model]
  /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]
  /claude:plugin update [<plugin>@<marketplace>] [--scope user|project]
  /claude:plugin list [<marketplace>] [--scope user|project]
  /claude:plugin marketplace <add|remove|list|update> [...]
```

The first line of the usage block is the error message (`Usage error.`); the blank line is mandatory; the Usage block follows verbatim. Sentence-form preserves the terminal period (section 18.3). Note that NO `[error]` prefix is embedded -- severity is delivered structurally via the wrapper choice per PRD section 6.12 ES-2 (reaffirmed in section 10).

______________________________________________________________________

## 13. Empty Results

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-ER-1** | Empty list / cascade target sets MUST render as a bare compact token: `(no marketplaces)` for empty marketplace listings (no marketplaces configured in the resolved scope), `(no plugins)` for empty plugin listings or empty cascade target sets (no installed plugins to enumerate; no plugins to update). The line carries ONLY the status token in parentheses -- no icon, no name slot, no scope brackets, no reasons block. The legacy sentence forms `No marketplaces configured.` and `No plugins installed.` are RETIRED. The bare-token form is routed via `notifySuccess` (severity `default`) -- an empty result is not a failure. (per CONTEXT.md D-23) |

Worked example -- `(no marketplaces)` empty result (e.g. `/claude:plugin marketplace list` against a scope with no marketplaces configured):

```text
(no marketplaces)
```

Worked example -- `(no plugins)` empty result (e.g. `/claude:plugin update` against a scope with no installed plugins, or `/claude:plugin list` against a marketplace with no installed-or-available plugin entries):

```text
(no plugins)
```

The two empty-result tokens are members of the closed `status_tokens:` set in the frontmatter (section 3); Phase 14's drift guard reads that set and asserts no callsite emits a sentence-form empty result for these two cases.

______________________________________________________________________

## 14. IL-3 console.warn (single sanctioned -- PRD section 6.13 IL-3, preserved)

The single sanctioned `console.warn` lives at `persistence/migrate.ts:178` (PRD section 6.13 IL-3). It fires when the legacy-marketplace migration step (state-load preflight) computes a normalized successor state but fails to atomically persist it back to `state.json`. The call MUST stay sentence-form: no `ctx` is available at the call site (deep inside the state-load primitive), the user did not request the migration (it is a transparent backward-compat fix-up), and the channel is intentionally a developer-visible diagnostic that lands in Pi's log / stderr rather than a user-facing operation result.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MSG-LC-1** | The single sanctioned `console.warn` at `persistence/migrate.ts:178` (legacy-marketplace migration save-failure diagnostic) MUST stay SENTENCE FORM. The compact-line grammar of section 1 MUST NOT be coerced onto this surface: no `<icon>`, no `(status)`, no `{}` reasons, no `MANUAL RECOVERY REQUIRED:`-style prefix. Rewording is permitted under the guide's tone and punctuation rules (section 18.3 mandates a terminal period for sentence-form messages), but the structural shape is preserved. Phase 12 LANDED the new wording (below); the byte change at `persistence/migrate.ts:178` lives in the same Phase 12 PR (per CONTEXT.md D-CMC-14 / D-CMC-15). |
| **MSG-LC-2** | The eslint discipline at this call site MUST be preserved. The per-file `no-restricted-syntax` / `no-console` override for `shared/notify.ts` lives in `eslint.config.js` (config-file rule). The override for `persistence/migrate.ts:178` lives as an INLINE `eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail` comment on the line directly above the `console.warn(...)` call -- NOT a config-file rule. Phase 13 MUST NOT introduce additional `console.warn` callsites; Phase 14's drift guard reads the eslint surface as the binding contract for this rule. (per CONTEXT.md D-25)  |

### 14.1 Wording (Phase 12 landed)

Today's wording (verbatim from `persistence/migrate.ts:178`):

```text
pi-claude-marketplace: failed to persist migrated state to <path> (<errMsg>); continuing with in-memory normalized state. Original state.json is unchanged.
```

Proposed replacement under the guide's tone and punctuation rules (single complete sentence per section 18.3, no compact-grammar tokens, no all-caps prefix, no `MANUAL RECOVERY REQUIRED:` form -- this is a developer diagnostic, not an operator action item):

```text
Legacy marketplace migration could not be persisted to <path>; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: <errMsg>.
```

The wording above is the binding text shipped at `persistence/migrate.ts:178` in Phase 12 per D-CMC-14. It satisfies the structural constraints of MSG-LC-1 (sentence form, terminal period, no compact-grammar tokens, no severity prefix). The IL-3 inline `eslint-disable-next-line` comment is preserved verbatim above the call per D-CMC-16 / MSG-LC-2.

### 14.2 The IL-3 boundary is single-call-site

PRD section 6.13 IL-3 declares this `console.warn` is the ONLY sanctioned out-of-channel emission in the extension. The eslint chokepoint enforces this structurally: `no-restricted-syntax` forbids every `console.*` call across the codebase except where an inline `eslint-disable-next-line` comment names IL-3 explicitly. The guide reaffirms IL-3: no Phase 13 refactor MAY introduce a second `console.warn` site, and no replacement wording for the existing site MAY widen the eslint surface (the inline disable must keep its `-- IL-3:` rationale comment).

______________________________________________________________________

## 15. ES-5 Replacement Table (PRD section 6.12 ES-5 supersession; MSG-04)

This section formally supersedes PRD section 6.12 ES-5 ("stable user-contract strings"). The PRD section 6.12 ES-5 row REMAINS in the PRD as historical baseline but is NO LONGER the canonical contract for these five user-facing surfaces -- this guide is. Phase 13 will edit `shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts` + PRD section 6.12 in a single atomic three-file commit per 12-RESEARCH.md "Markers Snapshot Test Integration" (the snapshot test's prefix-extraction shape is structurally incompatible with the new tokenised forms, so the deferral is mandatory -- Phase 12 cannot keep the snapshot green while changing the markers). The replacements below are reproduced verbatim from CONTEXT.md D-30; the cross-reference column points at the section of THIS guide where the new wording's full grammar is documented.

| ES-5 marker                              | Replacement                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pi-subagents is not loaded; …`          | `{requires pi-subagents}` reason on the affected line (see section 6, MSG-SD-1)                               |
| `pi-mcp-adapter is not loaded; …`        | `{requires pi-mcp}` reason on the affected line (see section 6, MSG-SD-1)                                     |
| `Run /reload to <verb> …`                | `/reload to pick up changes` (single canonical trailer, blank line above) (see section 5, MSG-RH-1)           |
| `MANUAL RECOVERY REQUIRED: …`            | `⊘ <resource> (manual recovery) {<reason>}` as a separate top-level line (see section 7, MSG-MR-1 / MSG-MR-2) |
| `(rollback partial: [<phase>] <msg>; …)` | `{rollback partial}` reason on the failed line + per-phase indented children (see section 8, MSG-RP-1)        |

PRD section 6.13 IL-2 (single output channel via `ctx.ui.notify`) and IL-3 (single sanctioned `console.warn` at `persistence/migrate.ts:178`) are REAFFIRMED unchanged. The compact-line grammar of section 1 and the severity-wrapper rules of section 10 govern every emission via `ctx.ui.notify`; the legacy-migration `console.warn` retains sentence form per section 14. ES-1..ES-4 from PRD section 6.12 are also unchanged -- this supersession is scoped strictly to ES-5's five marker strings.

______________________________________________________________________

______________________________________________________________________

## 16. Pattern Class Reference

The 12 pattern classes enumerated in the frontmatter `pattern_classes:` block (D-28) cover every callsite in the extension's audit surface (88 rows; see 12-RESEARCH.md "Pattern Class Distribution"). Each subsection below defines one class: what it IS, which sanctioned wrapper emits it, the severity it routes at, and at least one worked example. Five classes -- `cascade-row`, `reload-hint`, `soft-dep`, `manual-recovery`, `rollback-partial` -- are FRAGMENT PRODUCERS: they describe what a composer outputs, and that output is folded into a parent `success` or `failure` row at notify time. The fragment-producer note inside each such subsection is the authoritative location for the class's documentation; Plan 12-05's cross-reference integrity check treats these five classes as satisfied by their §16 subsection presence rather than by inventory row occurrence (the inventory classifies the parent callsite as `success` or `failure`, not the fragment producer).

### 16.1 success

A `success` callsite reports that a single-shot operation fully advanced state without leaks or soft-dep markers, or that a cascade ran to completion with every row in the trivially-successful or trivially-skipped class (see section 10.2 MSG-SR-4 for cascade-vs-single-shot routing).

**Canonical wrapper:** `notifySuccess` -- severity `default`.

**When to use:**

- Single-shot operation fully advanced state. (`orchestrators/marketplace/add.ts:142`)
- Cascade where every row is `(installed)`, `(updated)`, `(removed)`, or `(skipped) {up-to-date}`. (`orchestrators/marketplace/update.ts:359`)
- `list` rendering payload -- the whole-tree render is reported as a `success`. (`orchestrators/plugin/list.ts:266`)

**Worked example:**

```text
● commit-commands@claude-plugins-official [user] (installed)

/reload to pick up changes
```

### 16.2 failure

A `failure` callsite reports that a single-shot operation did NOT advance state -- it was refused at preflight, threw and rolled back, or the locked transaction aborted (section 10.1 MSG-SR-3). State is unchanged or fully rolled back from the caller's perspective.

**Canonical wrapper:** `notifyError` -- severity `error`.

**When to use:**

- Install / update / uninstall / reinstall threw and the transaction rolled back. (`orchestrators/plugin/install.ts:580`)
- Marketplace add / remove / update threw at the locked phase. (`orchestrators/marketplace/update.ts:317`)
- Preflight refused (entity-shaped non-cascade error per MSG-NC-1).

**Worked example:**

```text
⊘ commit-commands@claude-plugins-official [user] (failed) {rollback partial}
  agents staging (failed) {ENOENT /tmp/pi-claude-marketplace-staging-7a3f}
  mcp (rollback failed) {EACCES /home/user/.pi/agent/mcp.json}
cause: rollback partial -> agents-staging rename failed -> ENOENT
```

### 16.3 cascade-row

A `cascade-row` is a single indented compact line inside a cascade body -- the per-row outcome of an `update` / `import` / `remove` cascade. Each row stands on its own compact form (icon + name + scope + version + status + reasons) under the cascade's marketplace-header line.

**Canonical wrapper:** `cascade-row` is a FRAGMENT PRODUCER -- it is rendered inside `renderPartition(...)` at `orchestrators/marketplace/shared.ts` and folded into the parent cascade's `notifySuccess` (per MSG-SR-4) or `notifyWarning` (per MSG-SR-5) message body. The parent's `pattern_class` is `cascade-summary` or `success` depending on outcome.

**When to use:**

- Per-plugin row inside a `marketplace update` partition (`renderPartition(...)` callers).
- Per-plugin row inside a `plugin update` cascade (no `<plugin>` arg = update-all).
- Per-plugin row inside an `import` cascade.

**Fragment-producer note:** This class describes the composer output rendered by `renderPartition(...)`; Phase 13's refactor changes the row's grammar (compact line per section 1; `(upgradable)` and version-transition arrows per MSG-PL-3) but the rendered text is composed into the parent `notify*` body, not emitted directly. The parent callsite's `pattern_class` in the inventory remains `success` or `cascade-summary`; this §16.3 subsection is the authoritative documentation for the row grammar.

**Worked example (a single cascade row, in isolation):**

```text
  ● commit-commands [user] v1.2.3 → v1.4.0 (updated)
```

### 16.4 cascade-summary

A `cascade-summary` callsite is the single notify message produced at the END of a cascade operation -- it carries the cascade's partition rendering (all rows together) plus an optional reload-hint trailer and optional aggregate soft-dep markers (see section 6.2 for the per-row vs per-message distinction).

**Canonical wrapper:** `notifySuccess` (severity `default`) when every row is trivially-successful or trivially-skipped per MSG-SR-4; `notifyWarning` (severity `warning`) when any row is non-trivially `(skipped)` or `(failed)` per MSG-SR-5. NEVER `notifyError` (MSG-SR-6).

**When to use:**

- `marketplace update` partition body. (`orchestrators/marketplace/update.ts:359`)
- `plugin update` partition body. (`orchestrators/plugin/update.ts:732`)
- `marketplace remove` aggregate-failure summary. (`orchestrators/marketplace/remove.ts:251`)

**Worked example:**

```text
● claude-plugins-official [user] <autoupdate>
  ● claude-md-management [user] v1.4.0 (installed)
  ● commit-commands [user] v1.2.0 → v1.4.0 (updated)
  ⊘ hookify [user] (failed) {not in manifest}
  ● serena [user] (skipped) {up-to-date}

/reload to pick up changes
```

Rows are sorted alphabetically by name (case-insensitive via `localeCompare(b, undefined, { sensitivity: 'base' })`); the per-row status token (`(installed)` / `(updated)` / `(skipped)` / `(failed)`) carries the partition signal. The marketplace-with-scope header (`● claude-plugins-official [user] <autoupdate>`) is the canonical §16.4 header form emitted by `cascadeSummary({ marketplace, scope, rows })`; the body itself contains NO partition-header lines. The header carries its leading icon (`●` / `⊘` per the marketplace outcome-class rule) and its optional `<marker>` slot (`<autoupdate>` when the marketplace has autoupdate ON, omitted when OFF).

**Marketplace-header rule (quick 260519-bga + consistency-review pass, supersedes the earlier "flat-cascade" approach from quick 260519-8v0):** Any command that operates on multiple plugins, or that lists plugins under their owning marketplace, renders the marketplace as a HEADER line at column 0 with the plugin rows indented 2 spaces underneath. The header carries its leading icon (`●` / `⊘` per the outcome-class rule for marketplaces), the scope bracket (`[project]` / `[user]` -- per-scope, no collapse), the optional `<marker>` slot (`<autoupdate>`), and an optional `(status)` token when relevant (e.g. `(added)` in import, `(updated)` in marketplace update; pure-label headers in plugin list omit the status). Plugin rows under the header OMIT the `@<marketplace>` token per MSG-GR-2. The per-partition `Reinstalled:` / `Updated:` / `Skipped:` / `Failed:` / `Installed plugins:` / `Skipped existing items:` / `Warnings:` / `Added marketplaces:` header lines are RETIRED; the per-row status token is the sole carrier of partition signal, and operators scan by row icon and the trailing `(<status>)` token. Single-plugin commands (`install`, `uninstall`) do NOT use the marketplace-header form -- they keep `<plugin>@<marketplace>` inline. Marketplace-only commands (`marketplace list`, `marketplace add`, `marketplace autoupdate`, `bootstrap`) do NOT use the header form either -- the marketplaces ARE the rows. `marketplace remove` is conditional: the bare-row form on clean success, the header form when the cascade has plugin-unstage failures.

### 16.5 list-rendering

A `list-rendering` callsite is a whole-tree render of marketplaces and their plugins -- the output of `/claude:plugin list` and `/claude:plugin marketplace list`. The render carries marketplace-header lines, indented per-plugin compact rows, and PL-4 description lines beneath each plugin row.

**Canonical wrapper:** `notifySuccess` -- severity `default`.

**When to use:**

- `/claude:plugin list` output. (`orchestrators/plugin/list.ts:266`)
- `/claude:plugin marketplace list` output. (`orchestrators/marketplace/list.ts:62`)

**Worked example:**

```text
● claude-plugins-official [project] <autoupdate>
  ● commit-commands [project] v1.2.3 → v1.4.0 (upgradable)
    Curated set of commit, push, and PR helpers for terminal workflows.
● claude-plugins-official [user] <autoupdate>
  ● commit-commands [user] v1.2.3 → v1.4.0 (upgradable)
    Curated set of commit, push, and PR helpers for terminal workflows.
  ○ serena v2.0.0 (available)
    Tooling for code symbol exploration and semantic edits.
```

### 16.6 reload-hint

A `reload-hint` is the single canonical trailer `/reload to pick up changes`, preceded by a blank line, appended after a parent operation's compact-line body. It is a FRAGMENT PRODUCER -- the composer at `presentation/reload-hint.ts` returns the literal string, and the orchestrator concatenates it onto a `notifySuccess` body.

**Canonical wrapper:** `reload-hint` is a FRAGMENT PRODUCER -- the trailer is rendered into the parent `notifySuccess` body. The parent's `pattern_class` is `success` (single-shot) or `cascade-summary` (cascade).

**When to use:**

- After any operation that staged, advanced, or removed at least one generated resource (skill / command / agent / MCP entry). Emission predicate is PRD section 6.8 RH-1 preserved (MSG-RH-1).

**Fragment-producer note:** Phase 13's refactor changes the composer's emission rule (single canonical trailer instead of three verbs) but the rendered text composes into the parent `notify*` body. The parent callsite's `pattern_class` in the inventory remains `success` or `cascade-summary`; this §16.6 subsection is the authoritative documentation for the trailer rule.

**Worked example (the trailer rendered after a parent success body):**

```text
● commit-commands@claude-plugins-official [user] (installed)

/reload to pick up changes
```

### 16.7 soft-dep

A `soft-dep` marker is a `{}` reason on a plugin's compact line indicating that the plugin's static manifest declares a resource (agents / MCP servers) whose companion extension (`pi-subagents` / `pi-mcp-adapter`) is not currently loaded. Per D-13 the marker fires on `list` rendering rows, cascade rows, and single-shot success rows.

**Canonical wrapper:** `soft-dep` is a FRAGMENT PRODUCER -- the marker is rendered into the parent compact line as a `{}` reason (per MSG-SD-1), and the parent line composes into the parent `notifySuccess` (for `list` rendering, `success`, `cascade-row`) message body. The parent's `pattern_class` in the inventory remains the parent's class.

**When to use:**

- Single-plugin install / update / reinstall success row when the plugin declares agents and `pi-subagents` is unloaded (or declares MCP and `pi-mcp-adapter` is unloaded). Today's emission site per `platform/pi-api.ts` (`subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded`).
- Per-row inside a cascade (D-13 expansion). Phase 13 wires.
- `list`-rendering rows for `(available)` and `(installed)` plugins (D-13 expansion). Phase 13 wires.

**Fragment-producer note:** The marker is a `{}` reason inside the parent compact line; the parent line's `pattern_class` (success / cascade-row / list-rendering) is what the inventory records. This §16.7 subsection is the authoritative documentation for the marker's emission predicate and wording.

**Worked example (a single-plugin success row with the soft-dep marker present):**

```text
● claude-md-management@claude-plugins-official [user] (installed) {requires pi-subagents}

/reload to pick up changes
```

### 16.8 manual-recovery

A `manual-recovery` line is a separate top-level compact line carrying `(manual recovery)` status (section 7, MSG-MR-1), independent of the triggering operation. It signals that operator intervention is required to resolve a partial or unreadable resource state.

**Canonical wrapper:** `manual-recovery` is a FRAGMENT PRODUCER -- the line is rendered as a top-level entry inside the parent operation's output (a separate top-level `notifyWarning` or appended to the operation's parent `notifyError`, depending on whether the operation itself succeeded or failed; the inventory classifies that parent callsite as `success` or `failure`).

**When to use:**

- Orphan agent index entry detected during state load (system-level resource per MSG-MR-2).
- Post-commit data-dir `mkdir` failure on install (the install succeeded but a follow-on artefact requires manual creation). (`orchestrators/plugin/install.ts:610`)
- Unreadable `state.json` requiring manual remediation before any operation can proceed.

**Fragment-producer note:** The line is a separate top-level compact line, but it composes into a parent notify message (an aggregate `notifyWarning` summarising completion + recovery, or a `notifyError` summarising failure + recovery). The inventory classifies the parent callsite as its parent class; this §16.8 subsection is the authoritative documentation for the manual-recovery line grammar.

**Worked example:**

```text
⊘ agent index (manual recovery) {unreadable}
  orphan path: ~/.pi/agent/agents-index.json
  parse failure: unexpected end of JSON input at offset 247
```

### 16.9 rollback-partial

A `rollback-partial` indication is a `{rollback partial}` or `{<phase>}` reason on a `(failed)` line, plus indented child rows per affected phase (section 8, MSG-RP-1). It signals that a multi-phase operation failed and rollback could not fully reverse the prior phases.

**Canonical wrapper:** `rollback-partial` is a FRAGMENT PRODUCER -- the rollback markup is rendered inside the parent `(failed)` line (composed by `formatRollbackError(...)` in `transaction/rollback.ts`) and the parent line composes into a `notifyError` body. The parent callsite's `pattern_class` is `failure`.

**When to use:**

- Install / update / uninstall / reinstall threw mid-rollback. (`orchestrators/plugin/install.ts:580` error path with rollback-partial cause)
- Any operation whose rollback path itself produced per-phase failures.

**Fragment-producer note:** The rollback indication is part of the parent `(failed)` line plus its indented children; the inventory classifies the parent callsite as `failure`. This §16.9 subsection is the authoritative documentation for the rollback-partial markup grammar.

**Worked example:**

```text
⊘ commit-commands@claude-plugins-official [user] (failed) {rollback partial}
  agents staging (failed) {ENOENT /tmp/pi-claude-marketplace-staging-7a3f}
  mcp (rollback failed) {EACCES /home/user/.pi/agent/mcp.json}
cause: rollback partial -> agents-staging rename failed -> ENOENT
```

### 16.10 usage

A `usage` callsite reports an argument-parsing or usage-validation failure (no anchor entity). The compact-line grammar is NOT coerced onto this surface; sentence form is preserved with the Usage block appended after a blank line (section 12, MSG-NC-2).

**Canonical wrapper:** `notifyUsageError` -- severity `error`.

**When to use:**

- Unknown subcommand at the top-level router. (`edge/router.ts:125`)
- Missing required positional argument. (`edge/handlers/plugin/import.ts:31`, `edge/handlers/plugin/list.ts:49`)
- Malformed flag value (e.g. `--scope invalid`).

**Worked example:**

```text
Usage error.

Usage:
  /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model]
  /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]
```

### 16.11 empty

An `empty` callsite reports an empty list or empty cascade target set as a bare compact token: `(no marketplaces)` or `(no plugins)` (section 13, MSG-ER-1). The line carries only the status token in parentheses -- no icon, no name, no scope brackets.

**Canonical wrapper:** `notifySuccess` -- severity `default`. An empty result is not a failure.

**When to use:**

- `/claude:plugin marketplace list` against a scope with no marketplaces configured. (`orchestrators/marketplace/autoupdate.ts:138`)
- `/claude:plugin update` against a scope with no installed plugins. (`orchestrators/marketplace/update.ts:175`, `orchestrators/plugin/update.ts:167`, `orchestrators/plugin/reinstall.ts:220`)
- `/claude:plugin list <marketplace>` against a marketplace with no plugin entries.

**Worked example:**

```text
(no marketplaces)
```

### 16.12 legacy-migrate

A `legacy-migrate` callsite is the single sanctioned `console.warn` at `persistence/migrate.ts:178` (PRD section 6.13 IL-3). It reports a legacy-marketplace migration save-failure as a sentence-form diagnostic on Pi's log / stderr. It is NOT a user-facing operation result.

**Canonical wrapper:** `console.warn` -- single sanctioned out-of-channel emission. Sentence form per section 14 MSG-LC-1.

**When to use:**

- ONLY at `persistence/migrate.ts:178`. No other callsite may use `console.warn` (enforced structurally by eslint `no-restricted-syntax` + `no-console` plus inline `eslint-disable-next-line` discipline per MSG-LC-2).

**Worked example (the call site's emission, in sentence form per section 14.1's proposed wording):**

```text
Legacy marketplace migration could not be persisted to /home/user/.pi/agent/state.json; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: EACCES: permission denied.
```

______________________________________________________________________

## 17. Worked Examples Gallery

This section collects six fully-rendered worked examples spanning the major operation classes. Every example exercises at least one rule from sections 1-14 and at least one pattern_class from section 16. The examples use real plugin names from `claude-plugins-official` (per 12-RESEARCH.md Open Question 3 recommendation) to keep the renderings concrete; the upstream marketplace may evolve, so the names are illustrative -- the grammar rules in sections 1-4 are normative, the example names are not.

Where an example exercises a rule, the cross-reference paragraph below the fence names the rule by ID so Phase 13 / Phase 14 reviewers can navigate from example back to rule.

### 17.1 claude-plugins-official listing

Whole-tree `list` rendering of the canonical upstream marketplace with one plugin already installed and upgradable, one installed with a soft-dep marker, one available, and one unavailable due to declared unsupported components. Exercises PL-4 descriptions (MSG-PL-1), the version-transition arrow on `(upgradable)` rows (MSG-PL-3 / MSG-PL-4), per-row soft-dep markers (MSG-SD-1 / MSG-SD-3), the three-icon set (MSG-IC-1..3), and the marketplace-header / per-plugin indentation pattern from section 18.2.

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands [user] v1.2.3 → v1.4.0 (upgradable)
    Curated set of commit, push, and PR helpers for terminal workflows.
  ● claude-md-management [user] v0.4.1 (installed) {requires pi-subagents}
    Audit, repair, and improve CLAUDE.md files across a repository.
  ○ serena v2.0.0 (available)
    Tooling for code symbol exploration and semantic edits.
  ⊘ hookify (unavailable) {hooks}
```

**Exercises:** §1 MSG-GR-1..5, §2 MSG-IC-1..3, §6 MSG-SD-1 / MSG-SD-3, §11 MSG-PL-1..6, §16.5 list-rendering, §16.7 soft-dep.

### 17.2 update cascade with mixed outcomes

`update` cascade against `claude-plugins-official` where one plugin advanced, one was already up-to-date, and one is no longer in the manifest. Exercises the cascade-row grammar (§16.3), the cascade-summary severity routing (MSG-SR-4: trivial-success + trivial-skipped routes via `notifySuccess`; here one row is non-trivially `(failed)` so the actual routing is `notifyWarning` per MSG-SR-5), the reload-hint trailer (MSG-RH-1), and the `(skipped) {up-to-date}` folding of legacy `unchanged` (D-08).

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands [user] v1.2.0 → v1.4.0 (updated)
  ● claude-md-management [user] (skipped) {up-to-date}
  ⊘ hookify [user] (failed) {not in manifest}

/reload to pick up changes
```

**Exercises:** §3 (skipped) / (failed) / (updated) tokens, §6 (no soft-dep present), §10.2 MSG-SR-5 (warning routing), §11 MSG-PL-3 (arrow grammar on `(updated)`), §16.4 cascade-summary, §16.3 cascade-row.

### 17.3 import block

`import` cascade of a multi-plugin import operation -- the operator named several plugins at once via `/claude:plugin import claude-plugins-official:commit-commands,claude-md-management,serena`. Exercises the cascade rendering for `import` (which mirrors `update` per section 16.4), per-row soft-dep markers (MSG-SD-3 expansion to cascade rows), and the post-cascade reload-hint trailer.

```text
● claude-plugins-official [user] <autoupdate> (added)
  ● commit-commands [user] (installed)
  ● claude-md-management [user] (installed) {requires pi-subagents}
  ● serena [user] (skipped) {already installed}

/reload to pick up changes
```

**Exercises:** §1 MSG-GR-2 (marketplace omitted on cascade rows), §3 (installed) / (skipped) tokens, §6 MSG-SD-3 (per-row soft-dep), §10.2 MSG-SR-5 (mixed-outcome warning routing), §16.4 cascade-summary, §16.3 cascade-row. (The previously-installed `serena` renders as `● (skipped) {already installed}` -- the plugin remains installed, so per the effective-state rule the icon is `●` and the status is the trivial skip, not `(failed)`.)

### 17.4 failed install with rollback partial

Single-shot install that threw mid-rollback: agents staging failed atomically; the rollback attempted to back out the staged MCP entries but the MCP rollback also failed (permission denied on `mcp.json`). Exercises the failure pattern (§16.2), the rollback-partial fragment producer (§16.9, MSG-RP-1), per-phase child rows under section 18.2 tree rendering, and the cause-chain trailer (§9, MSG-CC-1).

```text
⊘ commit-commands@claude-plugins-official [user] (failed) {rollback partial}
  agents staging (failed) {ENOENT /tmp/pi-claude-marketplace-staging-7a3f}
  mcp (rollback failed) {EACCES /home/user/.pi/agent/mcp.json}
cause: rollback partial -> agents-staging rename failed -> ENOENT: no such file or directory -> open '/tmp/pi-...'
```

**Exercises:** §1 MSG-GR-1 (compact line), §2 MSG-IC-3 (blocked icon), §3 (failed) / (rollback failed) tokens, §8 MSG-RP-1, §9 MSG-CC-1, §10.1 MSG-SR-3 (error severity), §16.2 failure, §16.9 rollback-partial, §18.2 tree rendering.

### 17.5 manual recovery (orphan agent index)

State-load preflight detected an unreadable `agents-index.json` while the operator was running `/claude:plugin list`. The list operation completed normally with its own result; the manual-recovery line follows as a SEPARATE top-level entry (MSG-MR-1). Exercises the system-level resource naming (MSG-MR-2 -- the resource name `agent index` goes directly in the name slot), the ES-5 supersession of `MANUAL RECOVERY REQUIRED:` (section 15), and free-form indented child detail rows.

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands [user] v1.2.3 (installed)
  ○ serena (available)

⊘ agent index (manual recovery) {unreadable}
  orphan path: ~/.pi/agent/agents-index.json
  parse failure: unexpected end of JSON input at offset 247
```

**Exercises:** §3 (manual recovery) token, §7 MSG-MR-1 / MSG-MR-2, §15 ES-5 supersession (`MANUAL RECOVERY REQUIRED:` → compact line), §16.5 list-rendering (the parent operation), §16.8 manual-recovery, §18.2 tree rendering.

### 17.6 PL-4 / PL-5 list rendering (focused on the version grammar)

A focused variant of §17.1 that emphasises the version slot and transition arrow without the soft-dep marker. Exercises MSG-PL-2 (literal `v<version>` slot), MSG-PL-3 (transition arrow on `(upgradable)`), MSG-PL-4 (`(upgradable)` implies installed and is `list`-only), MSG-PL-5 (hash-version verbatim), and MSG-PL-6 (version display on `(uninstalled)` rows -- shown here as an example of the audit-discretion-resolved version display).

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands [user] v1.2.3 → v1.4.0 (upgradable)
    Curated set of commit, push, and PR helpers for terminal workflows.
  ● claude-md-management [user] v0.4.1 (installed)
    Audit, repair, and improve CLAUDE.md files across a repository.
  ● local-experiment [user] hash-9a3f7b2e0c1d (installed)
    Personal scratchpad plugin pinned to a content hash.
  ○ serena v2.0.0 (available)
    Tooling for code symbol exploration and semantic edits.
```

**Exercises:** §11 MSG-PL-1..6, §3 (upgradable) / (installed) / (available) tokens, §16.5 list-rendering, §18.1 token reservations (the hash-version's `-` characters are not delimiter tokens; the literal renders verbatim).

The six examples above span the operation classes the audit identifies as the highest-value worked-reference set. Phase 13's refactor uses these examples as ground-truth renderings -- any callsite whose rendered output cannot be expressed in the grammar of these examples is a callsite whose `proposed_new_wording` cell in `docs/messaging-inventory.md` needs revisiting.

______________________________________________________________________

## 18. Conventions

Cross-cutting rules that apply across every section in this guide. These are not numbered with an `MSG-XX-N` ID because they govern how rules are written and rendered rather than what a callsite must emit; they bind authors and reviewers of the guide as much as authors of new callsites.

### 18.1 Token reservations

The compact-line grammar reserves the characters `[`, `]`, `(`, `)`, `{`, `}` as structural delimiters: square brackets enclose the scope list, parentheses enclose the status token, curly braces enclose the reasons block. These characters MUST NOT appear inside the name slot, the `@<marketplace>` token, the version slot, or any free-text payload that participates in the compact form.

The indented second list-render line per section 11 (PL-4 plugin description, truncated at column 66) is NOT subject to the compact-line grammar -- it is free-form text and MAY contain any of the reserved characters as natural punctuation. The compact line above the description is what the grammar binds; the description line is documentation.

### 18.2 Tree rendering

Tree-rendered output (cascade-row children, manual-recovery children, rollback-partial per-phase children) uses a leading two-space indent and NO separator punctuation between the parent line and its children. Each child row stands on its own as an independent compact line: it carries its own icon, its own status token, and its own optional reasons block. Children are NOT a continuation of the parent message; the parent's status token is complete on its own line.

### 18.3 Punctuation

Compact lines MUST NOT carry a trailing period -- they are not sentences. The line ends with the closing brace of the reasons block, or the closing paren of the status token if no reasons are present.

Sentence-form messages (every `notifyUsageError` payload and the single sanctioned `console.warn` in `persistence/migrate.ts`) MUST keep their terminal period. These surfaces are governed by sections 12 and 14, not by the compact-line grammar.

### 18.4 Identifier and backtick discipline

Backticks are reserved for code-like identifiers: function and method names (`notifySuccess`, `ctx.ui.notify`), file paths (`shared/markers.ts`), TypeScript type fragments (`installable: true | false`), and the literal in-grammar tokens this guide enumerates (`(installed)`, `{not found}`).

Normative section IDs (`MSG-GR-1`, `MSG-IC-1`, `MSG-SR-7`, `MSG-CC-1`) are bolded with double-asterisk inside table cells, NOT backtick-fenced. This matches the PRD convention (`**ES-1**`, `**MA-11**`) and keeps section IDs distinct from code identifiers when the guide is rendered as plain text.

______________________________________________________________________

## 19. Cross-References

The pointers below are navigation aids. The normative contract is THIS guide plus the companion `docs/messaging-inventory.md`; GSD planning artefacts are scaffolding around that contract and may evolve independently.

- **Phase 13 (Conformance Refactor) -- consumer:** `.planning/phases/13-conformance-refactor/` (slug; the directory does not yet exist at the time of authoring -- the path is the planned location). The stable anchor while Phase 13 has not yet been planned is `.planning/ROADMAP.md` "Phase 13" section. Phase 13 reads this guide as the input contract for the mechanical refactor that rewrites every `needs-rewording` / `replace-marker` row in `docs/messaging-inventory.md`. Phase 13 also owns the three-file atomic edit deferred from Phase 12 (PRD section 6.12 + `shared/markers.ts` + `tests/architecture/markers-snapshot.test.ts`); see section 15 above.

- **Phase 14 (Test Alignment & Drift Prevention) -- drift guard:** `.planning/phases/14-test-alignment-drift-prevention/` (slug; same caveat as Phase 13). Stable anchor: `.planning/ROADMAP.md` "Phase 14" section. Phase 14 reads this guide's YAML frontmatter (`status_tokens:`, `reasons:`, `markers:`, `pattern_classes:`, `inventory_row_count:`) plus the normative IDs (`MSG-GR-1..5`, `MSG-IC-1..3`, `MSG-SR-1..7`, `MSG-CC-1`, `MSG-RH-1`, `MSG-SD-1..3`, `MSG-MR-1..2`, `MSG-RP-1`, `MSG-PL-1..6`, `MSG-NC-1..2`, `MSG-ER-1`, `MSG-LC-1..2`) as the binding assertions for the drift-guard implementation.

- **PRD section 6.12 ES-5 -- historical baseline (superseded by §15):** [`docs/prd/pi-claude-marketplace-prd.md`](./prd/pi-claude-marketplace-prd.md). Section 6.12 ES-5 is the V1 stable user-contract string set; section 15 of THIS guide formally supersedes those five marker strings. Section 6.12 ES-1..ES-4 and section 6.13 IL-1..IL-5 (severity ladder, output channel, single sanctioned console.warn, no telemetry, English-only) are PRESERVED unchanged.

- **PRD section 6.8 RH-1..RH-5 -- reload hint semantics (preserved per D-10..D-13):** [`docs/prd/pi-claude-marketplace-prd.md`](./prd/pi-claude-marketplace-prd.md). RH-1's emission semantic ("emit only when generated resources actually changed") is preserved by MSG-RH-1; the verb-variation wording is superseded. RH-5's soft-dep emission predicate is preserved by MSG-SD-2; the SCOPE is broadened by MSG-SD-3 (D-13 contract expansion documented in section 6.1).

- **PRD section 6.11 AS-1..AS-9 -- atomic staging & rollback contracts (referenced):** [`docs/prd/pi-claude-marketplace-prd.md`](./prd/pi-claude-marketplace-prd.md). AS-7 specifically defines the manual-recovery emission cases that MSG-MR-1 / MSG-MR-2 reshape; the legacy `MANUAL RECOVERY REQUIRED: <path> (<reason>)` form is replaced by the section 7 compact line.

- **PRD section 5.3.1 PL-1..PL-7 -- list rendering (preserved per D-31..D-34):** [`docs/prd/pi-claude-marketplace-prd.md`](./prd/pi-claude-marketplace-prd.md). PL-4 (descriptions on second indented line, truncated at column 66) is preserved verbatim by MSG-PL-1. PL-5 (upgradable computed by manifest-vs-install version string compare) becomes the `(upgradable)` status token via MSG-PL-4.

- **Companion inventory:** [`docs/messaging-inventory.md`](./messaging-inventory.md). The 88-row callsite audit table is created by Plan 12-04. At the time of authoring this section, the file does not yet exist; the relative link is stable and resolves once Plan 12-04 commits.

Cross-references to GSD planning artefacts (`.planning/phases/...`, `.planning/ROADMAP.md`) are navigation only and may evolve as phases reorganise. The normative contract surface is this guide + the inventory; both are versioned per their respective frontmatter (`version: 1.0` each).
