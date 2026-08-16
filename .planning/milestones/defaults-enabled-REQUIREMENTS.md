# Requirements Archive: defaults-enabled defaultEnabled Manifest Field

**Archived:** 2026-08-15
**Status:** SHIPPED

For current requirements, see `.planning/workstreams/defaults-enabled/REQUIREMENTS.md`.

---

# Requirements: defaults-enabled (milestone)

**Defined:** 2026-08-14
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.
**Driver:** BACKLOG.md DFEN-01 -- the `defaultEnabled` manifest field has no representation anywhere in the extension, so a plugin author cannot ship a plugin that installs disabled.

## Upstream contract (verified 2026-08-14 against code.claude.com/docs/en/plugins-reference)

- `defaultEnabled` is a boolean that may appear in `plugin.json` **and** in a marketplace entry; the marketplace entry value takes precedence. Default is `true`.
- Requires Claude Code v2.1.154+; earlier versions ignore it and enable on install.
- Consulted at **install and enable time only**. Changing it in a later plugin release does not flip a user who already installed.
- Two things override it: an existing `enabledPlugins` setting at any settings scope (persists across update and reinstall), and a dependency requirement from another active plugin (Claude writes `true` explicitly).

## Design anchor

Our analog of Claude's `enabledPlugins` setting is the per-plugin `enabled?: boolean` in `claude-plugins.json`, whose "absent means enabled" default lives in exactly one function, `isDeclaredEnabled` (`persistence/config-io.ts`). Install therefore **writes the disabled state through to config** rather than resolving it at consume time.

This is what Claude itself does when it writes `enabledPlugins`, and it is what makes the "a later release changing `defaultEnabled` does not flip an existing user" rule fall out for free instead of needing its own mechanism.

The alternative -- teaching `isDeclaredEnabled` the manifest value -- was rejected: reconcile's planner has no manifest access today, a manifest edit would flip a user's plugin off underneath them on reload, and it contradicts the upstream install-time-only timing.

**The hazard this closes.** Reconcile is a config-to-record convergence loop that reruns on every `/reload`, and desired enabled-state comes only from `claude-plugins.json` (`orchestrators/reconcile/plan.ts`, the `isDeclaredEnabled` call). Installing a `defaultEnabled: false` plugin as a disabled record while leaving its config entry `{}` would take the recorded-and-declared-enabled path into `acc.enable.push(...)` and silently re-enable the plugin at the next reload.

## v1 Requirements

### Manifest and Precedence

- [x] **DFEN-01**: `defaultEnabled` is an optional boolean on both the marketplace plugin entry and `plugin.json`, added once to the shared `PLUGIN_METADATA_FIELDS` group so `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA` both carry it. A non-boolean value fails validation the same way any other schema violation does; an unknown-key tolerance (D-09 lenient) is unchanged.
- [x] **DFEN-02**: When both declaration sites carry `defaultEnabled`, the marketplace entry value wins. Absent at both sites resolves to `true`.
- [x] **DFEN-03**: The resolver exposes the resolved value to the install path, so the precedence rule is evaluated in one place rather than re-derived per consumer.

### Install and Persistence

- [x] **DFEN-04**: Installing a plugin that resolves `defaultEnabled: false` records it disabled and writes `enabled: false` into that scope's `claude-plugins.json` plugin entry -- the first field the install write-back's currently-empty plugin patch has ever carried. The plugin's artifacts are not materialized, matching the terminal state of an ordinary disable.
- [x] **DFEN-05**: An `enabled` value already present in the config entry wins over `defaultEnabled` and is never overwritten, in either direction. This is the analog of Claude's "an existing `enabledPlugins` setting takes precedence and persists".
- [x] **DFEN-06**: The state produced by DFEN-04 is reconcile-stable: a `/reload` after installing a `defaultEnabled: false` plugin plans no action for it and does not re-enable it. Verified against the reconcile planner, not only at the install boundary.
- [x] **DFEN-07**: `update` and `reinstall` never re-apply `defaultEnabled` to an already-installed plugin, so a plugin release that changes the field does not flip a user's existing choice.
- [x] **DFEN-08**: `defaultEnabled: true` and an absent `defaultEnabled` produce byte-identical behavior and output to today, across install, update, reinstall, list, info, and reconcile.

### Read Surfaces

- [x] **OUT-01**: A new closed-set reason token `installs disabled` is appended at the tail of the `REASONS` tuple (membership and order are catalog-stable per D-09 / OUT-08 -- new tokens append, existing entries never reorder) and is given a home in the `notify-reasons.ts` topic partition, whose compile-time completeness proof fails otherwise. Existing tokens stay byte-stable.
- [x] **OUT-02**: `plugin list` renders `{installs disabled}` on the row of a not-installed plugin whose MARKETPLACE ENTRY declares `defaultEnabled: false` and for which the user has stated no `enabled` value, following the established subject-first row grammar. The user's own value outranks the entry in either direction, so a config-chosen `enabled: false` also renders the row bare -- the token names the AUTHOR-declared cause only. The plugin's own `plugin.json` is deliberately never read on a read path; OUT-05 is the home of that carve-out.
- [x] **OUT-03**: `plugin info` reports that the plugin will install disabled, so a user can see it before committing to the install.
- [x] **OUT-04**: The install notification states that the plugin installed disabled and how to enable it. Severity is informational -- the desired state was reached (an install-disabled plugin is the author's declared intent, not a shortfall).
- [x] **OUT-05**: `list` and `info` stay network-free (NFR-5). The marketplace entry is always readable from the cached manifest, but `plugin.json` requires a materialized clone, so an unfetched `(remote)` plugin can only be judged from the entry. When the entry is silent, the surfaces must not claim `{installs disabled}` on a `plugin.json` value they cannot read, and must not fetch in order to read it.

### Documentation

- [x] **DOC-01**: `docs/output-catalog.md` is amended for the new token and the surfaces that emit it.
- [x] **DOC-02**: The enablement contract is written down in `docs/plugin-enablement.md`, the durable home of two divergences. First, the dependency-requirement override: Claude writes an explicit `true` for a plugin required by another active plugin, at install or enable time, which we cannot do because a plugin's own dependency declarations are schema-accepted opaquely and surfaced in string-shaped form on `info`, but are never resolved, never auto-installed and never consulted for enablement, so no code path can write that value on a plugin's behalf (BACKLOG.md PDEP-01). Second, the entry-only pre-install read rule: `list` and `info` answer the manifest side of `{installs disabled}` from the marketplace entry alone and decline to claim where only the unread `plugin.json` declares (OUT-02 / OUT-05), so source comments citing that rule have a requirement-level anchor that does not archive.

## v2 Requirements

### Dependency-Driven Enablement

- **DFEN-V2-01**: Honor Claude's second override -- a plugin required by another active plugin via `dependencies` gets an explicit `enabled: true`, so its own `defaultEnabled: false` no longer applies. Blocked on PDEP-01 (dependency declarations are surfaced on `info` but never resolved or consulted for enablement).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Honoring the dependency-requirement override | No mechanism exists -- plugin `dependencies` are schema-accepted opaquely and surfaced on `info`, but never resolved or consulted for enablement (PDEP-01). Documented as a divergence under DOC-02 instead of half-built. |
| Teaching `isDeclaredEnabled` the manifest value | Rejected design. Needs manifest access the reconcile planner lacks, lets a manifest edit flip a user's plugin off on reload, and contradicts upstream install-time-only timing. |
| Fetching a clone so `list` / `info` can read `plugin.json` `defaultEnabled` | Would make a documented network-free read path a network operation, violating NFR-5. OUT-05 declines to claim instead. |
| A user-facing setting or flag to override `defaultEnabled` at install time | Not in the upstream contract. Editing `claude-plugins.json` or running `enable` already covers it. |
| Any state schema migration | `defaultEnabled` is read at install time and lands in the existing `enabled` flag and config entry. No new persisted field, no migration. |

## Traceability

Populated at roadmap creation (2026-08-14). Full phase
definitions: `.planning/workstreams/defaults-enabled/ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DFEN-01 | Phase 101 | Complete |
| DFEN-02 | Phase 101 | Complete |
| DFEN-03 | Phase 101 | Complete |
| DFEN-04 | Phase 102 | Complete |
| DFEN-05 | Phase 102 | Complete |
| DFEN-06 | Phase 103 | Complete |
| DFEN-07 | Phase 103 | Complete |
| DFEN-08 | Phase 105 | Complete |
| OUT-01 | Phase 102 | Complete |
| OUT-02 | Phase 104 | Complete |
| OUT-03 | Phase 104 | Complete |
| OUT-04 | Phase 102 | Complete |
| OUT-05 | Phase 104 | Complete |
| DOC-01 | Phase 105 | Complete |
| DOC-02 | Phase 105 | Complete |

**Coverage:**

- v1 requirements: 15 total
- Mapped to phases: 15 (Phases 101-105)
- Unmapped: 0

## Open Questions for Discuss-Phase

- **Materialization path for an install-disabled plugin.** The install ledger is a fixed literal 6-phase array whose order is a contract ("never refactor to a dynamic builder"). Does a `defaultEnabled: false` install run the five materialization phases and then drop the artifacts, or skip them and write only the state phase? This changes the ledger's shape and its rollback story, and needs a design pass before planning.
- **Orchestrated-mode installs.** The config write-back is deliberately skipped in orchestrated mode, because reconcile derives desired state from the config and writing back would clobber a per-machine override. A cascade install (import, reconcile) of a `defaultEnabled: false` plugin therefore has no write-back seam, and its config entry already exists with `enabled` absent. Decide whether that pre-existing entry counts as the user's explicit setting (DFEN-05 wins, plugin enables) or as no setting at all (DFEN-04 applies).

---

*Requirements defined: 2026-08-14*
