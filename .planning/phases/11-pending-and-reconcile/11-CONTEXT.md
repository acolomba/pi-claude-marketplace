# Phase 11: Pending and Reconcile - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous discuss; the run is non-interactive, so each recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Phase 11 covers two surfaces with cucumber scenarios: `/claude:plugin pending`
after a user edits a scope's configs by hand (PND-01, PND-02), and a new Pi
session that brings the scope in line with those edits (REC-01..REC-04). It
owns `features/plugin/pending.feature` and `features/plugin/reconcile.feature`
(both seeded by Phase 1) and, only if needed, `plugin/pending.steps.ts` and
`plugin/reconcile.steps.ts`. Test plugins carry skills only.

Phase 1 left five bug candidates for this phase. Each is decided below.

</domain>

<decisions>
## Implementation Decisions

### Scenarios
- **D-01:** No new step module. Every scenario uses Phase 1 steps: the config
  writers (`a config in scope {word} and layer {word}, with these plugins:`),
  the command and session steps, and the skill offer steps. A hand removal is a
  plugins table that leaves the removed plugin out, so the writer needs no
  empty-table form.
- **D-02:** PND-01 is one scenario whose single hand edit causes all four
  transitions at once (install, uninstall, enable, disable) over four plugins
  of one marketplace. It compares the whole result: the tally (success count 4)
  and the four rows `will install`, `will uninstall`, `will enable`,
  `will disable`. The Phase 1 empty-result seed stays as the agree case.
- **D-03:** PND-02 is two scenarios, one per `--scope` value. Both scopes carry
  a hand-declared plugin, so each scenario proves that the other scope's row is
  absent. Two variants do not justify a `Scenario Outline` (the features rule
  wants three or more).
- **D-04:** REC-01 keeps the two Phase 1 seeds (a hand-declared plugin, and a
  hand-declared marketplace with its plugin). REC-02 removes one of two
  installed plugins by hand; the session reports `uninstalled` and offers only
  the kept plugin's skill. REC-03 is two scenarios: a hand disable (row
  `disabled`, no skills offered) and a hand enable of a disabled plugin (row
  `installed`, as the standalone `enable` command reports it, skill offered).
- **D-05:** REC-04 declares a plugin the catalog offers beside one it does not
  (`ghost`). The session installs the first, reports the second `failed` with
  `not in manifest`, and offers the first plugin's skill.
- **D-06:** A lasting reconcile failure is reported once per RPC session
  binding, which is two results per new session (Phase 1 01-02 candidate 4,
  Pi RPC behaviour, not a product bug). Scenarios state both results, as
  `configuration.feature` already does.

### Bug candidates
- **D-07 (fix):** The reconcile `installed` row of a hand-declared plugin
  carries no `version`, while the standalone install row, and the reconcile
  `uninstalled`, `disabled`, enabled and dependency-installed rows, all carry
  it. `applyPluginInstalls` in `orchestrators/reconcile/apply.ts` drops
  `result.version` on the `plugin-installed` arm while its `landedDisabled` arm
  keeps it. Fix: copy `result.version` onto the `plugin-installed` outcome, pin
  it with a unit test, and state the version in the reconcile scenarios.
- **D-08 (no change):** `pending` lists `will install` for a plugin whose
  hand-declared marketplace source does not exist. Pending is read-only and
  offline by design (DIFF-01, NFR-5): it never reads a marketplace source.
  Claude Code has no `pending` verb, so there is no upstream contract to
  follow. Kept as designed.
- **D-09 (no change):** A marketplace source written as an unexpanded
  `{home}/...` path is reported as `unsupported source`. Claude Code 2.1.308
  rejects the same string with "Invalid marketplace source format. Try:
  owner/repo, https://..., or ./path" (grep of the installed binary). The
  product's token matches upstream's verdict. Kept.
- **D-10 (deferred):** A plugin that stays installed after its catalog drops
  it, or whose marketplace manifest is invalid, is reported `failed`
  `unreadable` on every new session, without a cause chain. The row comes from
  `reportUnreadableDeclarer` (D-05-07: the load-time dependency walk fails
  closed and names the declarer it could not read). Changing the reason or
  adding the walk's cause to the row changes the expected rows of
  `features/marketplace/update.feature` (untouched after Phase 1),
  `features/marketplace/remove.feature` (Phase 15),
  `features/plugin/uninstall.feature` (Phase 6) and
  `features/plugin/update.feature` (Phase 7). This phase may not edit those
  files, and the D-05-07 fail-closed posture is a recorded decision, so the
  candidate is deferred to the milestone audit with the evidence above.

### Claude's Discretion
- Plugin names in the multi-plugin scenarios (`alpha`, `beta`, `gamma`,
  `delta`), and which plugin plays which role.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` "### Phase 11" and the milestone rules (file ownership, bug policy)
- `.planning/REQUIREMENTS.md` PND-01, PND-02, REC-01..REC-04
- `.agents/skills/cucumber/SKILL.md` and `rules/features.md`
- `.planning/phases/01-suite-foundation/01-02-SUMMARY.md`, `01-09-SUMMARY.md`, `01-10-SUMMARY.md` (bug candidates)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (`applyPluginInstalls`, `reportUnreadableDeclarer`)

</canonical_refs>

<code_context>
## Existing Code Insights

- Measured with a throwaway probe feature (deleted): a combined hand edit gives
  a `cascade` with tally `Reconcile pending` success 4 and rows in the order
  install, uninstall, disable, enable. `pending` with no `--scope` lists both
  scopes' rows.
- The reconcile session for the same edit reports one
  `reconcile-applied-cascade` with rows `uninstalled 1.0.0`, `installed`
  (no version: D-07), `disabled 1.0.0`, and the enabled plugin as
  `installed 1.0.0`.

</code_context>

<deferred>
## Deferred Ideas

- D-10: the `unreadable` reconcile row for a plugin its catalog dropped, or
  whose manifest is invalid, and its missing cause chain.

</deferred>
