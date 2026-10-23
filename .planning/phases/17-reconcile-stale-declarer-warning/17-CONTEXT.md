# Phase 17: Reconcile Stale-Declarer Warning - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the orchestrating session asked for an autonomous, non-interactive run, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

REC-05: a plugin that stays installed after its marketplace catalog drops it,
or whose marketplace manifest is invalid, is reported at each new session as a
`warning` with the real reason (`{not in manifest}` or `{invalid manifest}`)
and a cause chain, and it keeps working.

Today `reportUnreadableDeclarer` (`orchestrators/reconcile/apply.ts`) pushes a
`plugin-disable-failed` outcome with the reason `unreadable`, which the applied
cascade renders as `⊘ <plugin> [<scope>] (failed) {unreadable}` at `error`
severity with no cause line, every session.

In scope: the load-time (reconcile) row only, the closed-set token the
declaration walk hands it, and the pinned feature rows in
`features/marketplace/update.feature`, `features/marketplace/remove.feature`,
`features/plugin/uninstall.feature`, `features/plugin/update.feature`,
`features/plugin/reinstall.feature`, plus new scenarios in
`features/plugin/reconcile.feature`.

Out of scope: the fail-closed shape of the declaration walk (D-05-07), the
`{unreadable}` rows that `uninstall`, `marketplace remove`, `update` and
`reinstall` render about their TARGET when a declarer cannot be read, and the
reconcile code that phase 19 changes (import on the reconcile path).

</domain>

<decisions>
## Implementation Decisions

### Upstream position
- **D-01:** Claude Code 2.1.309 reports this condition as a plugin load error,
  `Plugin ${id} not found in marketplace ${marketplace}` (`strings` of the
  installed binary, error type `plugin-not-found`), every time it loads the
  plugins. It does not escalate it to a failed operation. The user's
  2026-10-23 decision (ROADMAP Phase 17, STALE-DECLARER-01) fixes the
  severity here: a `warning`, emitted every session until the fault is fixed.

### Row shape
- **D-02:** The row keeps the `(failed)` status and drops to `warning`
  severity: `⊘ <plugin> [<scope>] (failed) {<reason>}` (the `failed` glyph) with the cause line,
  `needsReload: false`. What failed is the load-time dependency check of the
  plugin, not the plugin, and a `(failed)` row at `warning` severity is the
  house precedent for "a check fell short while the record stays installed"
  (`uninstall.ts` `buildMemberFailedRow`, D-05-13). `PluginFailedMessage`
  already admits `severity: "warning"` and a `cause`. An `(installed)` row
  was rejected: in the applied cascade `installed` is a realized transition
  that requests a reload, and `PluginInstalledMessage` has no cause slot.
- **D-03:** The row gets its own outcome kind, `plugin-declarer-unreadable`,
  instead of a severity flag on `plugin-disable-failed`. The disable-failed
  kind keeps meaning "a disable this pass attempted was refused", and the
  notify switches stay exhaustive over the new kind (WR-03).
- **D-04:** The cause line is the walk's own `cause` (`cannot read the
  dependencies of <key>: <fixed reason>`), forwarded unchanged. It is built
  from fixed phrases only and carries no chained raw message (T-05-04).

### Reason token
- **D-05:** The declaration walk's failure arm gains a required
  `reason` field with a closed-set token chosen by the same branch that picks
  the cause phrase, so no consumer classifies by message text:
  - marketplace manifest fails to load with `InvalidMarketplaceManifestError`
    → `invalid manifest`
  - the manifest does not list the plugin → `not in manifest`
  - the declaration read answers `unusable` because the parser rejected the
    `dependencies` value → `invalid manifest`
  - the plugin's own manifest is present but unusable (the read's typed
    `ownManifest` refusal; its cause says "cannot be read") → `unreadable manifest`
  - the marketplace manifest is missing or cannot be read → `unreadable manifest`
  (Revised after code review WR-01: the token must agree with the cause line.)
- **D-06:** Only the reconcile stale-declarer row renders that token. The
  `uninstall` / `marketplace remove` / `update` / `reinstall` rows are about
  their target, and the declarer's token would make a false claim about the
  target's manifest, so they keep `{unreadable}` with the cause chain
  (dependency-index header).
- **D-07:** Every failure reason renders at `warning`, not only the two the
  requirement names: the plugin stays installed and loading in all of them,
  and only the dependency check is lost.

- **D-11 (user, 2026-10-23, supersedes the marketplace-manifest arms of
  D-05 and the ROADMAP text that named only `{invalid manifest}`):** a
  marketplace manifest that fails to load takes the token of the shared
  classifier `shared/probe-classifiers.ts::narrowProbeError`, the one `list`
  and `info` use, so one fault reads the same on every surface: malformed JSON
  → `unparseable`, schema-invalid → `invalid manifest`, missing (ENOENT /
  ENOTDIR) → `source missing`, EACCES / EPERM → `permission denied`, anything
  else → `unreadable`. A catalog drop stays `not in manifest`; a rejected
  `dependencies` value stays `invalid manifest`; an unusable own manifest
  stays `unreadable manifest`. The cause phrases are unchanged. (Resolves code
  review WR-02.)

### Emission
- **D-08:** The row is still emitted every session while the fault lasts
  (LOAD-02 re-derives the verdict live; nothing is persisted). RECON-04
  single-emit is narrowed: a declarer this pass already reported as FAILED, or
  uninstalled, gets no second row; a success row (disabled, installed,
  enabled, backfilled) does not suppress the warning, and the report runs
  after the backfill step (revised after code review WR-03).
- **D-09:** The walk stays fail-closed on the first unreadable declarer
  (D-05-07), so a scope with several unreadable declarers reports the first
  one per session. Narrowing to per-record is the rest of STALE-DECLARER-01
  and is not part of the user's decision.

### Claude's Discretion
- Naming of the new outcome kind and the token type alias.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 17 (decision 2026-10-23)
- `.planning/BACKLOG.md` STALE-DECLARER-01
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` (failure arm, D-05-07)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts` (`ScopeSatisfactionVerdict`)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (`reportUnreadableDeclarer`)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` (`applyPluginOutcomeToBlock`)

</canonical_refs>

<deferred>
## Deferred Ideas

- STALE-DECLARER-01 remainder: per-record fail-closed instead of whole-scope,
  evaluated against both `buildScopeDeclarationDetail` and
  `buildScopeDeclarationIndex` (D-09).

</deferred>
