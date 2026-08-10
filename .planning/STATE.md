---
gsd_state_version: 1.0
milestone: v1.18
milestone_name: Manifest-Independent Installed Plugin Info
current_phase: 99
current_phase_name: post-audit-tech-debt-closure
status: executing
stopped_at: Completed 99-04-PLAN.md
last_updated: "2026-08-10T16:05:00.000Z"
last_activity: 2026-08-10
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 24
  completed_plans: 21
  percent: 88
last_activity_desc: "Phase 99 plan 04 complete — WR-12 / D-99-03 closed: the malformed-component degradation signal is threaded through the update verb, so a degraded update no longer renders a clean row while `list` one command later reports the record's real state. `PluginUpdateUpdatedOutcome` now inherits `LedgerDegradationSignals` DIRECTLY (no Pick, no Omit — the blocking constraint held, and typecheck passed on the first run after the edit, confirming 99-01 had removed the TS2430 collision). The plan named two render surfaces; a THIRD was found and threaded. Previous: plan 03 closed D-99-04: the version-less autoupdate cascade skip row gained a catalog state shipped in the same commit as its byte fixture, the description-bearing variant count was re-derived from the interfaces as nine, and the dangling anchor pair was dropped at SEVEN paired sites (research was right; CONTEXT and the 98-06 note both said six). The eight files where that identifier carries its own live meaning are untouched, and the extensions diff contains no non-comment line"
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10 after Phase 98)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.
**Current focus:** Phase 99 — close every debt item the v1.18 milestone audit
enumerated, then milestone close: version bump + PR. Phases 95-98 complete and
verified.

## Current Position

Phase: 99 (post-audit-tech-debt-closure) — EXECUTING
Plan: 4 of 7 complete (waves 1-2 done; next is 99-05, wave 3)
Status: Executing
Plan 99-04 closed WR-12 / D-99-03, the update-verb degradation gap. The signal
the skills and commands bridges already return is now collected at the
success-outcome site, carried on the updated outcome, and rendered — so a
plugin whose skill was written to disk in synthesized, non-model-invocable form
stops getting a clean `(updated)` row that `list` contradicts one command
later. The blocking constraint held: `PluginUpdateUpdatedOutcome extends
PluginUpdateBase, LedgerDegradationSignals` at `types.ts:163` is DIRECT
inheritance, with no `Pick` and no `Omit` anywhere in the file, and typecheck
passed on the first run after the edit — 99-01's rename had genuinely removed
the TS2430 collision. `install.ts`'s deliberate `Omit` was not touched.

Three findings worth carrying forward. **There is a third render surface**, not
the two the plan named: `orchestrators/marketplace/update.messaging.ts:69`, the
autoupdate cascade's own render map. Left unthreaded it failed exactly as the
plan's prohibition predicted — the composer raised severity while the row still
dropped the brace. **The two central `case "updated":` arms belong to different
unions**: `notify.ts:1745` is `renderMpHeader`'s marketplace header (no plugin,
no version arrow, no reasons — correctly untouched); `notify.ts:2237` is
`renderPluginRow`'s plugin row, which was passing `undefined`. **The tally was
deliberately not touched**: update's tally is an override counted by partition,
so a degraded update is still one update, unlike reinstall whose tally is the
default severity math and reports `1 warning`. That asymmetry lives in the
tally mechanism each verb already had, not in this change.

The composer keeps taking a caller-supplied `baseSeverity` rather than deriving
one, because the two cascades apply deliberately different policies (manual
raises on an absent companion per SEV-01; autoupdate stays silent per WR-01). A
self-deriving composer would have silently changed one of them. The malformed
raise is applied on top as an orthogonal axis. Gate green: 3394 unit + 18
integration, 0 fail.

Plan 99-03 closed D-99-04, the documentation-deferral group, without changing a
single code line — `git diff -U0 extensions/` filtered to non-comment lines is
empty. The version-less autoupdate cascade skip row now has the catalog state
`update-autoupdate-cascade-not-in-manifest`, shipped in the SAME commit as its
`catalog-uat` FIXTURES entry so neither direction of the gate could pass on a
half-landed pair. The description-bearing variant count was re-derived from the
nine plugin-row interfaces in `notify.ts` that declare `description?`, not
incremented: `MarketplaceInfoMessage` and `PluginInfoRowBase` also declare it
but are not list-surface plugin rows, so they stay excluded. The dangling
anchor pair is gone from SEVEN paired sites, not six — research was right and
both 99-CONTEXT and the 98-06 note undercounted; the two extra sites are both
in `shared/notify.ts` (the `PLUGIN_STATUSES` doc block and the parenthesised
one after `PL-4` in `composePluginLinesWith`). `grep -rn "RLD-04" extensions/`
now returns nothing, while `grep -rln "D-08"` returns exactly the eight
excluded files, none of which appears in the diff. Gate green: 3389 unit (1
pre-existing platform-conditional skip) + 18 integration, 0 fail.

Plan 99-02 closed D-99-02b, the second of the fragility trio, without touching
a production line. Three named non-global patterns join `INLINE_REDERIVATIONS`:
`DESTRUCTURED_ENABLED_BINDING`, `BRACKET_ENABLED_ACCESS` and
`BOOLEAN_ENABLED_COERCION`. The bracket and `Boolean()` forms flag the ACCESS
rather than the comparison — neither spelling has a legitimate use in the tree,
so an unconditional match is both simpler and stricter than enumerating every
negation someone might invent, and requiring the `.enabled` read inside the
parens leaves the nine `Type.Boolean()` typebox declarations untouched. The
destructuring form matches the BINDING, never a bare identifier, because
`!enabled` alone is indistinguishable from any unrelated local; `[^{}]*` plus a
required `=` after the closing brace keeps it off object literals. All three
were dry-run over the 202 stripped extension sources before the first edit —
zero hits, so no pattern was narrowed after the fact and no exemption was
needed. Each carries three assertions, not one: TRUE on its twin, FALSE on both
negative controls, and membership in the array the walk iterates (a deletion
probe confirmed the membership pin fires). Suite 35/35; lint, typecheck and
format 0.

Plan 99-01 closed D-99-02c, the first of the fragility trio. The two
`readonly string[]` staged-name pairs are renamed `stagedAgentNames` /
`stagedMcpServerNames` on BOTH outcome interfaces — `ReinstallReinstalledOutcome`
(the site D-99-02c names) and `PluginUpdateUpdatedOutcome` (the second site
research found). Renaming only reinstall would have left plan 99-04 blocked:
a `readonly string[]` member colliding with an optional `boolean` one makes
`PluginUpdateUpdatedOutcome extends LedgerDegradationSignals` a TS2430 error,
so the `Omit`/`Pick` workaround would have become permanent. Both producers
moved with their keys and every right-hand side is byte-identical, so no
rendered byte and no persisted key moved (NREG-01); the COMPAT-01 gate passes
unchanged. `install.ts:258`'s `Omit` was left in place — it records a
deliberate exclusion, not a collision workaround. One deviation: a
prettier re-wrap forced by the longer names. Carrier for 99-04: the inherited
booleans will need populating at `update.ts:1940` alongside the existing
`declaresAgents` / `declaresMcp` derivations.

### Phase 98 closure (previous)

Phase 98 closed 2026-08-10 with all gates green. Six plans landed the
four Phase-97 carriers (IN-07, WR-06, WR-02, WR-04), LIFE-04/05/06
characterization coverage, the COMPAT-01 no-expansion contract gate, and the
DOC-08 accuracy sweep. Plan 06 closed DOC-08 last, as sequenced, so the
documentation describes what the first five plans actually shipped: all ten
named defects corrected in place (none by deletion), the three additional
falsified PRD statements folded in, the section 5.3.1 flowchart REDRAWN to
the ManifestLookup decision path per D-98-07, and three further falsified
comments found and fixed at adjacent sites in `notify.ts`. The
three-iteration review fix loop finished all_fixed (14 findings: 13 fixed, 1
carried): the CR-01 stale-gate trailer now names a working remedy, the WR-01
narrowing made consent-free degradation of a clean disabled record
impossible, the WR-02 refresh row stopped claiming `{up-to-date}`, the
reinstall row composes its degradation reasons through one shared composer,
the COMPAT-01 gate's glyph clause and the source-scan helper both fail loud,
and the `Omit` drift channel got a compile-time completeness pin. The
WR-12 update-verb degradation gap is a backlog carrier
(2026-08-10-update-verb-drops-degradation-signals.md). Verification passed
5/5 roadmap criteria and 9/9 requirement IDs with independently re-run
suites; nyquist-compliant; threats_open 0. Final gate green (3386 unit + 18
integration, 0 fail). Three documentation-only deferrals recorded in
98-06-SUMMARY.md (autoupdate-cascade catalog state, stale variant count in
an untouched section, residual `RLD-04`/`D-08` anchors outside scope).
Phase 97 closed 2026-08-09 with all gates green. The five plans landed
ENBL-05..09: one `enabled`-keyed disabled-state predicate in
`persistence/state-io.ts` (CR-01 repro green), byte-exact disabled-partial
rendering on list/info with the two-axis-marker prose swept, a
partial-capable enable gate derived from the record's own availability
discriminant, a backfill scan that is a fixed point for disabled partials,
and a `refreshDisabledRecord` that derives its persisted availability
discriminant (mutation-proven) behind an on-disk no-stage short-circuit
pin. Plan 05's work landed as concurrent commits outside the paused
session's dispatch and was verified criterion-by-criterion at close-out.
The three-iteration review fix loop finished all_fixed: it repaired the
enable outcome row for partials (status derived like install's, severity
info per the operator's SEV-03 parity ruling, degradation signals threaded
through one shared `EnableDegradationSignals` shape), refreshed
`resolvedSha` beside the version pin, collapsed two more predicate twins
under a whole-tree drift gate, reached clone GC from the disabled update
arm, and disambiguated colliding finding-ID comment anchors. Verification
passed 6/6 roadmap criteria and 29/29 must-haves; nyquist-compliant;
threats_open 0. Carriers into Phase 98: WR-02/WR-04/WR-06 enable-surface
warnings, the IN-07 install-arm orphan-rewake asymmetry, and the DOC-08
stale-comment reconciliation; the stale-resolvedSource-on-unchanged-version
gap is a backlog todo.
Last activity: 2026-08-10 — Phase 99 plan 99-02 complete

## Roadmap Summary

- 4 sequential phases (95-98), continuing the global counter from Phase 94.
  All 21 v1 requirements map exactly once; no orphans.

- Eight requirements (INV-02/03/04, BOUND-01/02, LIFE-04/05/06) describe behavior
  the code already exhibits. They are carried as contracts the milestone must not
  break, and their deliverable is characterization and regression coverage. The
  net-new work is INV-01, BOUND-03, INFO-09..12, COMPAT-01, and DOC-08.

- **Phase 95 — Manifest-independent installed inventory** (INV-01..05, BOUND-03):
  COMPLETE 2026-08-08. Characterized the union behavior, opened the render-map
  seam (`{not in manifest}` on installed rows), threaded the manifest load error
  through the cross-scope fold, widened the LLM tool payload (INV-05), and — via
  the review fix loop — hardened absence into a `ManifestLookup` discriminated
  value judged against the record's own manifest, with both new row forms under
  the output-catalog byte gate.

- **Phase 96 — Installation-record-backed plugin info** (INFO-09..12,
  BOUND-01/02): COMPLETE 2026-08-09. The buildBlock arm split renders
  manifest-absent installations from the record; containment-guarded hooks
  reconstruction with truthful-split degradation; INFO-12 zero-call network
  guard; visible fetch-skip note (broadened to disabled scopes in review);
  own-manifest authority pinned and the catalog's open note closed. CR-01
  (disabled-partial predicate) carried to Phase 97.

- **Phase 97 — Disabled-state classification repair** (ENBL-05..09): COMPLETE
  2026-08-09. Collapsed every disabled-state predicate onto one `enabled`-keyed
  definition (whole-tree drift gate), restored list/info disabled-partial
  rendering byte-exactly, made enable partial-capable with a derived ledger
  gate, guarded the load-time backfill into a fixed point, and derived the
  update refresh's availability discriminant. Repairs ENBL-04 from v1.12; no
  state migration. The review fix loop additionally repaired the enable
  outcome row (derived status, SEV-03 info severity, threaded degradation
  signals), refreshed `resolvedSha`, and reached clone GC from the disabled
  update arm.

- **Phase 98 — Lifecycle regression and contract documentation** (LIFE-04..06,
  COMPAT-01, DOC-08 + the four folded Phase-97 carriers): COMPLETE 2026-08-10.
  Landed IN-07/WR-06/WR-02/WR-04 as code (shared `LedgerDegradationSignals`,
  soft-dep markers and remediation trailer on enable, disabled records
  reachable by update without `--partial` under a consent-preserving gate),
  pinned uninstall per-kind / update three-path / autoupdate non-regression,
  authored the COMPAT-01 enumeration-equality gate (mutation-proven), and
  reconciled the catalog, PRD (flowchart redrawn), and source comments. The
  review loop additionally repaired the reinstall row's dropped degradation
  reasons and hardened both scanning gates to fail loud.

## Milestone Context

v1.18 starts from a derived-state design: after a marketplace manifest loads
successfully, an enabled plugin present only in `state.json` is still installed
and renders with the existing `{not in manifest}` reason. Records carrying
persisted unsupported kinds retain `(partially-installed)` and their existing
reason markers. `plugin info` reconstructs installed components from the
persisted resources plus materialized hooks config while compatibility metadata
preserves unsupported kinds. Disabled records, unknown non-installed names,
manifest-read failures, update/autoupdate behavior, and the installation-record-
driven uninstall path retain their existing semantics. No persisted orphan
marker, schema migration, status, or reason token is added.

The feature branch is `features/manifest-independent-plugin-info` in the managed
worktree `.worktrees/manifest-independent-plugin-info`. Baseline `npm run check`
is green when `PI_SUBAGENTS_ROOT` points at Pi's active managed `pi-subagents`
0.42.1. The unqualified local fallback finds stale global 0.24.3, below the
project's `>=0.35.0` optional-peer floor; CI has no global peer and skips those
two integration checks.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260802-v2z | amend v1.17 env-parity planning docs per validation findings | 2026-08-02 | 1ce8f203 | [260802-v2z-amend-v1-17-env-parity-planning-docs-per](./quick/260802-v2z-amend-v1-17-env-parity-planning-docs-per/) |
| 260804-gcs | Fix applyPathLedger non-owned PATH stripping | 2026-08-04 | aeef0882 | [260804-gcs-fix-applypathledger-non-owned-path-strip](./quick/260804-gcs-fix-applypathledger-non-owned-path-strip/) |
| 260807-q0v | amend v1.18 planning docs per two-review validation findings | 2026-08-07 | d76b4f6 | [260807-q0v-amend-v1-18-planning-docs-per-two-review](./quick/260807-q0v-amend-v1-18-planning-docs-per-two-review/) |
| 260807-ur3 | bring disabled-partial classification repair into v1.18 scope | 2026-08-07 | d543f74 | [260807-ur3-bring-disabled-partial-classification-re](./quick/260807-ur3-bring-disabled-partial-classification-re/) |
| 260808-dhm | amend v1.18 requirements for LLM tool-surface reason widening | 2026-08-08 | 74df349 | [260808-dhm-amend-v1-18-requirements-for-llm-tool-su](./quick/260808-dhm-amend-v1-18-requirements-for-llm-tool-su/) |

## Decisions

- Do not add `orphaned` or `orphaned-installed`: fully supported records keep
  `(installed)`, while records with persisted unsupported kinds retain the
  existing `(partially-installed)` status and reason markers.

- Reuse `{not in manifest}` and emit it only after a successful manifest load
  whose plugin lookup misses.

- Reconstruct installed components from existing resource fields and retain
  unsupported kinds from `compatibility.unsupported`; do not persist a manifest
  snapshot or orphan flag.

- Keep disabled, unknown-name, manifest-read, update/autoupdate, and uninstall
  semantics unchanged.

- The disabled-plus-partial classification defect is IN scope for v1.18 as
  Phase 97 (operator decision 2026-08-07, reversing the same-day exclusion).
  It repairs ENBL-04, shipped in v1.12 and silently broken by partial installs.
  INV-04 still covers the canonical disabled shape only, because the partial
  shape is not recognized as disabled until Phase 97 lands; ENBL-06 widens it.

- [Phase 95]: Gate the {not in manifest} claim on a SUCCESSFUL manifest read (loadError === undefined) so no row states a fact about a manifest never parsed (BOUND-03 / D-95-05)
- [Phase 95]: Thread the whole ScopedManifest bundle into enumerateMarketplacePlugins rather than a parallel manifestLoaded boolean (D-95-04)
- [Phase 95]: INV-05: pluginReasons forwards reasons on both installed-family arms; the installed arm guards on undefined and empty so a clean row keeps no reasons key (D-95-06)
- [Phase 95]: projectRowStatus left byte-unchanged: the tool-payload widening adds information inside the installed bucket rather than re-partitioning it
- [Phase 95 fix loop]: Absence is judged against the manifest the record itself names — `ScopedManifest` is a discriminated union (`{ok,manifest}|{ok:false,loadError}`) and `ManifestLookup` (`declared`/`absent`/`unverified`) is the single value flowing into the row builder, making "entry present + absence claimed" unrepresentable (WR-05/06/07)
- [Phase 95 fix loop]: `pluginReasons` covers all four flattened installed-family arms incl. `partially-upgradable` (CR-01); the two new manifest-absent row forms are catalog states under the byte-equality gate (WR-03)
- [Phase 96]: INFO-09/10: a manifest-absent installation record is described from the record (installed/partially-installed with 'not in manifest' as a reason), not reported as a failure; severity for that input moves error -> info
- [Phase 96]: The state-only row builders are synchronous and take no locations: require-await (strictTypeChecked) and noUnusedParameters reject the planned async + threaded-unused-param shape; the hooks read converts both in one edit
- [Phase 96]: derivePersistedInstalledStatus extracted so the persisted installed/partially-installed derivation has one copy shared by the non-path and state-only info rows
- [Phase 96]: State-only hooks degradation reuses the existing narrowProbeError reason ladder at row level; no new closed-set token
- [Phase 96]: info's cascade render map widens to skipped so a --fetch the state-only arm cannot carry out is reported as its own warning note (D-96-04)
- [Phase 96]: INFO-12 is asserted as zero call counts on injected clone and credential seams, not read off the control flow
- [Phase 96]: D-96-02 ratified — a folded row reads its OWN record's manifest for absence, upgradable and description alike, all three from one ManifestLookup value
- [Phase 96]: BOUND-01's wholesale non-render under a failed owning manifest is contract, not a defect: the bare (failed) header suppresses folded rows the fold already computed
- [Phase 97]: ENBL-05: the sole disabled-state predicate lives in persistence/state-io.ts beside toDisabledRecord, keyed only on `enabled`; reconcile/plan.ts deliberately does NOT re-export it
- [Phase 97]: The disabled-state drift gate asserts an absence (no conjunctive twin in any former definition site) plus a presence (each imports the one predicate), replacing the name-keyed body-shape pin
- [Phase 97]: D-97-01 anchor 1 resolved toward parity: a disabled PARTIAL row renders bare, byte-identical to the canonical (disabled) row -- no catalog amendment
- [Phase 97]: ENBL-06 is pinned as a contrast pair in one rendered block (disabled partial vs enabled partial), asserted as a single byte-exact join so the status tokens, the brace asymmetry, and the row order are all frozen together
- [Phase 97]: The enable branch's ledger gate is derived from the record's availability discriminant, not hard-coded, so a fully-installable record keeps the strict gate
- [Phase 97]: ENBL-08 backfill guard reads record.enabled directly rather than isRecordedButDisabled: apply.ts is not a drift-gate site and the guard is a scan filter symmetric with the availability filter above it
- [Phase 97]: ENBL-09: the derive landed in refreshDisabledRecord, not runThreePhaseUpdate, so the edit adds no pressure to an already complexity-suppressed function; suppression count in update.ts unchanged at 6
- [Phase 97]: A persisted discriminant is proven derived only by a counter-case pair — the degraded assertion alone is satisfied by hard-coding the opposite constant; the promotion case on the same fixture excludes both
- [Phase 97]: The update short-circuit's no-stage claim is asserted on disk (the generated skill absent from the skills target dir), not by the record's empty resource arrays, because re-staging is the defect and unrecorded files would still satisfy a state-only check
- [Phase 97 fix loop]: Operator ruling — the degraded ENABLE row stamps info for row-level consistency with install --partial and the backfilled partial arm (SEV-03 parity); the shortfall predates the enable. A malformed-frontmatter degrade still raises warning (WARN-01 parity with install)
- [Phase 97 fix loop]: Enable's degradation signals are one exported EnableDegradationSignals shape intersected into both outcome arms, so a fourth signal cannot be dropped on one consumer
- [Phase 97 fix loop]: The disabled-state drift gate walks the whole extension tree instead of a definition-site allowlist, making the state-io "SOLE predicate" claim structurally true
- [Phase 98]: IN-07/WR-06 carriers share one LedgerDegradationSignals shape in orchestrators/plugin/shared.ts — install.ts and enable-disable.ts both intersect it, so the next signal asymmetry is a compile error (the reverse import direction would close a module cycle)
- [Phase 98]: The reconcile enable projection keeps the malformed-only severity rule: its enable arm now agrees with its install arm, which never applied the companion raise; the standalone enable verb owns the SEV-01 composition. Marker is the shared fact, severity stance is per surface.
- [Phase 98]: LIFE-04 coverage asserts one resource kind per case (D-98-12) so a single bridge-arm regression turns exactly one case red; the shared (uninstalled) row constant makes "the kind mix does not move the row" structural rather than six coincidences
- [Phase 98]: An ownership-scoped removal is proven by seeding a differently-owned neighbour and asserting it survives — asserting only the owned key's absence would pass under a document-clobbering rewrite
- [Phase 98]: The manifest-absent property of every uninstall fixture is now asserted explicitly before each call rather than left incidental, so a future fixture that starts writing a marketplace.json fails loudly instead of silently weakening the coverage
- [Phase 98]: WR-04 lands via direction 2: preflightUpdate derives the candidate gate's partial argument from the disabled-record predicate, leaving classifyInstalledRecord and every completion consumer untouched
- [Phase 98]: The stale-gate enable narrowing keys on PluginShapeError shape kind not-installable (the install-op gate), not no-longer-installable as planned
- [Phase 98]: Enumeration equality over count pins for closed-set gates: notify-closed-set-locks owns lengths, compat-01-no-expansion owns membership
- [Phase 98]: Architecture gates delegate a clause through a shared non-test helper (tests/helpers/source-scan.ts), never by importing another *.test.ts module
- [Phase 98]: PLUGIN_INSTALL_RECORD_SCHEMA is exported as a test-only widening so the COMPAT-01 gate reads the record key set off the schema rather than a hand-maintained list
- [Phase 98]: The bulk enumeration bodies carry the plural-cardinality tally line the targeted body omits; the skip row itself is byte-identical across all three update targets.
- [Phase 98]: The end-to-end autoupdate case uses user scope with a hermetic home, because the single-plugin update reads the process working directory itself.
- [Phase 98]: DOC-08 counts are re-derived from the message interfaces: 9 reason-bearing and 4 dep-bearing variants of the 19 plugin statuses, each stated with its runtime constant and the gate that pins it
- [Phase 98]: The list decision flowchart is redrawn around the ManifestLookup discriminant, with a note that the unverified arm is reachable only on the cross-scope fold
- [Phase 98]: The PRD's non-member (present) token was replaced by (remote) rather than deleted, and PL-6 names where the never-silently-disappear guarantee now lives (INV-01) so the rewrite reads as a relocation, not a shrink

### Open decisions

Recorded 2026-08-07 by quick task 260807-q0v after validating two independent
reviews against the codebase. Full statements in ROADMAP.md. Resolved at the
Phase 95 discuss session on 2026-08-08 unless noted.

1. **RESOLVED (D-95-01/02/03)** — Installed inventory rows may carry reason
   braces, under a general rule: the orchestrator stamps reasons and
   `notify.ts` renders them, with no allowlist in the render path. Recorded
   guidance is durable-vs-transient. Note the premise was imprecise: there is
   no render-map suppression to reverse. `notify.ts:2180-2193` already composes
   reasons on the `installed` arm and `PluginInstalledMessage.reasons?` already
   exists; the omission is one orchestrator field at `list.ts:485-499`.

2. **DEFERRED to Phase 96 discuss (D-95-11)** — Whether the state-only info arm
   renders Pi-generated installed names or reverse-maps them to original source
   names. Re-gated: it governs no Phase 95 code, and Phase 96 discuss will have
   the `info.ts` reconstruction in front of it.

3. **RESOLVED (D-95-06/07)** — The LLM tool surface widens: `pluginReasons`
   forwards reasons for both `installed` and `partially-installed`, landing in
   Phase 95 beside INV-01. This reverses a REQUIREMENTS.md § Out of Scope row.
   Driven by two findings — `projectRowStatus` already flattens four statuses
   into `"installed"`, so a degraded install is today indistinguishable from a
   clean one in the tool payload; and `upgradable` already forwards reasons
   while also projecting to `"installed"`.

### Blockers

None. The D-95-10 requirement amendment landed as quick task 260808-dhm on
2026-08-08: INV-05 covers the LLM tool-surface reason widening, is mapped to
Phase 95 in the traceability table, appears in Phase 95's requirement list and
success criteria, and the superseded Out of Scope row is retired. Phase 95
planning is unblocked.

## Deferred Items

Items acknowledged and deferred at the v1.14 milestone close on 2026-07-23,
re-acknowledged unchanged at the v1.16 close on 2026-07-31, and re-acknowledged
at the v1.17 close on 2026-08-05 (override_closeout, known deferred artifacts: 6).
The one addition at the v1.17 close is the `async-rewake-lane-inert` debug
session — a concluded diagnose-only investigation (root cause confirmed: the
async-rewake lane is inert on Stop by design; no fix applied or intended).
None of the carryover items originate from v1.17 env-parity.

| Category | Item | Status |
|----------|------|--------|
| backlog | REASON-01 — unify all parse-error reasons under a `{malformed <feature>}` family | deferred |
| debug | async-rewake-lane-inert | diagnosed (diagnose-only; by design) |
| debug | knowledge-base | unknown |
| quick_task | 260621-kmm-add-explicit-enabled-boolean-field-to-pl | unknown |
| quick_task | 260718-tli-fix-pr-88-external-contribution-to-pass- | unknown |
| todo | 2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in | testing |
| seed | SEED-001-remote-plugin-status-fetch-verb | dormant (superseded by url-source/fetch-plugin) |

## Operator Next Steps

- Milestone lifecycle: audit v1.18, complete, cleanup. Run runtime UAT
  before archiving; skip the git tag at milestone close (tags track npm
  releases, not GSD milestones). All four phases are complete and verified;
  the five phase-98 carrier todos are closed; three backlog todos remain
  pending (rare-failure-arms sweep, stale-resolvedSource-on-unchanged-version,
  update-verb-drops-degradation-signals) for the next milestone's discuss.

- After close: version bump + PR per CLAUDE.md (package.json,
  sonar-project.properties, package-lock.json, CHANGELOG.md).

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |
| Phase 95 P01 | 30min | 3 tasks | 3 files |
| Phase 95 P02 | 25min | 2 tasks | 2 files |
| Phase 96 P01 | 25min | 3 tasks | 5 files |
| Phase 96 P02 | 31min | 3 tasks | 4 files |
| Phase 96 P03 | 40min | 3 tasks | 5 files |
| Phase 96 P04 | 25min | 2 tasks | 3 files |
| Phase 97 P01 | 22min | 2 tasks | 11 files |
| Phase 97 P02 | 35min | 3 tasks | 6 files |
| Phase 97 P03 | 25min | 2 tasks | 2 files |
| Phase 97 P04 | 30min | 2 tasks | 3 files |
| Phase 97 P05 | 25min | 2 tasks | 2 files |
| Phase 98 P01 | 50 | 3 tasks | 10 files |
| Phase 98 P02 | 20min | 3 tasks | 1 file |
| Phase 98 P03 | 55min | 2 tasks | 7 files |
| Phase 98 P04 | 30min | 2 tasks | 4 files |
| Phase 98 P05 | 16min | 3 tasks | 2 files |
| Phase 98 P06 | 27min | 3 tasks | 8 files |
| Phase 99 P01 | 12min | 2 tasks | 6 files |
| Phase 99 P02 | 12min | 2 tasks | 1 file |

## Session

**Last session:** 2026-08-10T11:37:37.555Z
**Stopped at:** Completed 99-02-PLAN.md
**Resume file:** .planning/phases/99-post-audit-tech-debt-closure/.continue-here.md
(retained until Phase 99 closes — it carries the 99-04 blocking constraint
against reintroducing the Pick/Omit workaround 99-01 lifted)

**Resumed:** 2026-08-10 — HANDOFF.json was stale (it named 99-02 as the next
dispatch, but 99-02 had already landed as `5481856c`/`07d4e31a`/`6bafbf30`
with its SUMMARY written). Reconciled and proceeding to
`/gsd-autonomous --interactive --from 99` (execute 99-03 onward, phase tail,
then v1.18 milestone close).

**Resumed again:** 2026-08-10 — pause handoff `f9dce10b` reconciled clean this
time: HANDOFF.json, `.continue-here.md`, STATE.md and `git log` all agree that
99-01 and 99-02 are complete with SUMMARYs on disk, the tree is clean, and no
async job is outstanding. HANDOFF.json consumed and removed (one-shot artifact);
`.continue-here.md` retained, since it still carries the 99-04 blocking
constraint. Proceeding to `/gsd-autonomous --interactive --from 99` — dispatch
99-03 (wave 1), then 99-04..99-07, the phase tail, and the v1.18 close.
