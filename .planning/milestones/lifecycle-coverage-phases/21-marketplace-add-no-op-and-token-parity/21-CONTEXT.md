# Phase 21: Marketplace Add No-Op and Token Parity - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous discuss; the orchestrating session asked for an
autonomous, non-interactive run, so every recommended answer below was
accepted without a prompt.

<domain>
## Phase Boundary

Phase 21 implements MPA-01..03. `marketplace add` (and `bootstrap`, which
composes it) treats a marketplace the scope already holds with the same
source as a no-op; the marketplace write commands (`add`, `update`) name a
manifest fault with the read commands' tokens; and `marketplace help` rejects
an unknown flag the way `help marketplace` does. Files:
`orchestrators/marketplace/add.ts`, `orchestrators/marketplace/update.ts`,
`orchestrators/plugin/bootstrap.ts`, `edge/router.ts` (the `marketplace help`
arm), their unit tests, the catalog fixtures, and
`features/marketplace/{add,update,help}.feature`,
`features/plugin/bootstrap.feature`. Phases 20 and 22-24 run in parallel:
`shared/probe-classifiers.ts` (phase 20) and `orchestrators/import/*`
(phase 24) are read, not edited.

</domain>

<decisions>
## Implementation Decisions

### Same-source re-add (MPA-01)
- **D-01:** The no-op is decided where the add already matches the typed
  source against the scope's records before any clone (LAYER-01
  `redeclareRecordedSource`, `samePlannedSource` plus `resolvesToRecord`).
  When exactly one record has the typed source and the target config layer
  already declares that name with a source that plans the same, the add
  changes nothing: no clone, no git call, no state save, no config write, no
  cache settle. It reports one marketplace header
  `<name> [<scope>] (skipped) {already added}` with no severity stamp, so the
  result is `info` and needs no reload. Upstream evidence: Claude Code
  2.1.309 `marketplace add` returns `Marketplace '<name>' is already added;
  nothing changed` for the same source.
- **D-02:** The reason is the existing shared `already added` `ContentReason`
  that Phase 19 introduced for `import` (D-05 there). No new vocabulary.
- **D-03:** A different source under a recorded name still fails
  `(failed) {duplicate name}`, as upstream's "is already added from a
  different source" does: a target layer that declares the name with another
  source, a path spelled another way (`~/x` for `/home/me/x`), and a clone
  whose manifest declares a recorded name all keep today's failure.
- **D-04:** Orchestrated adds (reconcile, import) never reach the redeclare
  path (WR-09), so `AddMarketplaceOutcome` is not widened; import's own
  already-added row stays its own (phase 24 owns that file).
- **D-05:** `bootstrap` no longer swallows `duplicate name`. A re-run gets the
  add's `(skipped) {already added}` row from `marketplace add` itself, then the
  autoupdate step's own row, so the two-result shape of a first run is kept.
  A different-source marketplace that declares `claude-plugins-official`
  fails `(failed) {duplicate name}` like any other add precondition and skips
  the autoupdate step, instead of silently turning on autoupdate for the
  wrong source.

### Manifest-fault tokens (MPA-02)
- **D-06:** `marketplace add` classifies a marketplace-manifest error with
  `narrowProbeError`, the classifier `list`/`info` and the stale-declarer row
  use (D-11): malformed JSON reads `{unparseable}`, a schema-invalid manifest
  `{invalid manifest}`, a missing manifest `{source missing}`. EACCES/EPERM
  reads `{permission denied}`; today it is not classified at all and
  `marketplace add` throws a raw error. An invalid scope config
  (`ConfigInvalidError`) keeps `{invalid manifest}`.
- **D-07:** `marketplace update` maps the same manifest error the same way, on
  the failed refresh row and the cascade. Its errno arms already read
  `{source missing}` / `{permission denied}`.
- **D-08:** `narrowProbeError`'s catch-all `unreadable` arm is not reused for
  `add`: an unknown error there stays an unclassified throw (D-48-C A3).

### Help flag (MPA-03)
- **D-09:** `marketplace help` with any `--` token reports the first one as
  `Unknown flag: "<flag>".` with its own usage
  (`Usage: /claude:plugin marketplace help`), as `bootstrap` does: a flag is
  checked before positionals, so `marketplace help extra --bogus` names the
  flag too. A positional with no flag keeps `marketplace help takes no
  arguments.`

### Claude's Discretion
- Internal shape of the redeclare result and the unit test layout.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` "### Phase 21"; `.planning/REQUIREMENTS.md` MPA-01..03
- `.planning/phases/19-import-on-the-reconcile-path/19-CONTEXT.md` D-05
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` `narrowProbeError`
- Claude Code 2.1.309 binary: "is already added; nothing changed",
  "is already added from a different source"

</canonical_refs>

<deferred>
## Deferred Ideas

None.

</deferred>
