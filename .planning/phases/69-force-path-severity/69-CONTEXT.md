# Phase 69: Force-Path Severity - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the force-path notifications to carry the correct DESIRED-STATE severities
on the existing caller-stamped notification model (per-row `severity?`,
`computeSeverity` MAX-reduces). This is the severity ladder SEV-01..05 that
Phases 65/66/68 deliberately deferred (emitting rows at sensible defaults):

- SEV-01: direct `install --force`/`update --force` degrade → **info** (no
  `Warning:`); `reinstall` manual-recovery + missing soft-dep companion →
  **warning**.
- SEV-02: install of `unsupported` without `--force` → **error** pointing at
  `--force`; install of `unavailable` (structural) → **error** with NO `--force`
  suggestion.
- SEV-03: auto-update of a force-upgradable plugin is taken automatically;
  **warning** only when it NEWLY degrades a previously-clean plugin, **info**
  when already degraded.
- SEV-04: targeted `update <plugin>@<marketplace>` declining a force-upgradable
  upgrade → **warning**; untargeted/bulk `update` skipping one → **info**.
- SEV-05: every row carries a factual `{reasons}` brace when reasons are
  present, including `installed`, `force-installed`, `force-upgradable` rows.

Builds on Phase 66 (the force rows whose severity is stamped) and the
notification-refactor workstream's caller-stamped, desired-state model.

Requirements SEV-01..05 and the five success criteria are locked by the
ROADMAP — discussion below is HOW (the detection mechanics), not WHAT.

</domain>

<decisions>
## Implementation Decisions

### 'Newly degrades' detection (SEV-03)
- **D-69-01:** Read the plugin's PERSISTED `compatibility` record BEFORE the
  auto-update applies: prior `unsupported` empty (clean/installed) and the update
  degrades it → NEWLY degraded → **warning**; prior `unsupported` non-empty
  (already force-installed) and still degraded → **info**. Reuses the same
  persisted force-state the Phase 66 deriver reads — no new tracking. (The
  force-upgradable auto-update is TAKEN automatically — no `(skipped) {no longer
  installable}` for the unsupported-component case.)

### Targeted vs bulk distinction (SEV-04)
- **D-69-02:** Thread the EXISTING invocation-shape signal the update
  orchestrator already has (a specific `<plugin>@<marketplace>` ref given =
  targeted; none = bulk/all) into the row severity stamp: targeted + declined
  force-upgradable → **warning**; bulk + skipped force-upgradable → **info**. No
  new detection; no inference from cascade shape.

### SEV-02 `--force` pointer message
- **D-69-03:** Branch the no-`--force` install error on the THREE-WAY resolver
  state (Phase 64 discriminant): `unsupported` arm → error message appends a
  `--force` hint (force can degrade-install it); `unavailable` arm → plain
  structural error with NO `--force` suggestion (force cannot help). The exact
  byte wording is reconciled in Phase 70; the conditioning logic + a clear hint
  land here. This is the message Phase 65 deferred (D-65-01).

### SEV-05 reasons-brace extension
- **D-69-04:** Route `installed` / `force-installed` / `force-upgradable` rows
  through the SAME reason-composition seam other rows use (the Phase 64
  render-time marker family `narrowUnsupportedKinds` + the existing brace
  composer), so a factual `{reasons}` brace renders whenever reasons are
  present. No new per-state mechanism. Rows without reasons stay brace-less
  (byte-identical to today).

### Claude's Discretion
- Where exactly the targeted/bulk flag and the prior-compatibility lookup are
  threaded in the update orchestrator — left to planning, provided behavior
  matches D-69-01..04.
- Exact byte wording of the SEV-02 `--force` hint and all severity-affected row
  text is reconciled against the catalog in Phase 70; this phase implements the
  severity stamping + conditioning and updates tests/catalog to keep
  `npm run check` green.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Severity model (the stamping seam)
- `extensions/pi-claude-marketplace/shared/notify.ts` — caller-stamped per-row
  `severity?` (~525), `computeSeverity` MAX-reduce (~509), the reason-brace
  composer, the row kinds for installed/force-installed/force-upgradable.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` —
  `narrowUnsupportedKinds` render-time marker family (Phase 64) reused for
  SEV-05 reasons.

### Orchestrators carrying the signals
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — the
  no-`--force` unsupported/unavailable error (SEV-02), force-degrade success
  severity (SEV-01).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — targeted
  vs bulk signal (SEV-04), prior-compatibility lookup (SEV-03).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` —
  auto-update of force-upgradable (SEV-03).
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — the persisted
  `compatibility` record read for prior-state comparison.

### Force foundation
- `.planning/phases/64-resolver-three-way-state/64-CONTEXT.md` — three-way
  discriminant used by SEV-02 conditioning.
- `.planning/phases/66-derived-force-state-glyphs/66-CONTEXT.md` — the derived
  force states whose rows are stamped.
- `.planning/phases/65-force-install-update/65-CONTEXT.md` — D-65-01 (the
  deferred SEV work this phase completes).

### Requirements & specs
- `.planning/REQUIREMENTS.md` — SEV-01..05.
- `.planning/ROADMAP.md` — Phase 69 goal + success criteria.
- `docs/output-catalog.md`, `docs/messaging-style-guide.md` — severity legend
  (byte-exact reconcile is Phase 70).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The caller-stamped `severity?` + `computeSeverity` MAX-reduce model — this
  phase stamps the right values, it does not change the model.
- The persisted `compatibility` record (Phase 66 deriver source) — reused for
  SEV-03 prior-state comparison (D-69-01).
- The three-way resolver discriminant (Phase 64) — drives SEV-02 conditioning
  (D-69-03).
- The reason-brace composer + `narrowUnsupportedKinds` — reused for SEV-05
  (D-69-04).

### Established Patterns
- Severity is desired-state and caller-stamped per row; cascades MAX-reduce.
- The update orchestrator already distinguishes targeted vs bulk invocation
  (D-69-02 threads the existing signal).
- Comment/test-title policy: D-69-NN / SEV-NN / NFR-N IDs, never GSD phase/plan
  references.

### Integration Points
- SEV-03 interacts with the Phase 68 backfill promotion rows (which emitted at a
  default severity, deferred to here) — confirm those rows get the right
  desired-state severity too.
- All severity-affected rows update tests + catalog in lockstep (matching the
  milestone's lockstep-docs pattern).

</code_context>

<specifics>
## Specific Ideas

The phase is pure severity wiring on an existing model — the SEV requirements
fix exact severity levels, so the only real design choices are the DETECTION
mechanics (prior-state comparison, invocation-shape signal, resolver-arm
conditioning), all of which reuse data the codebase already holds. The
desired-state principle: force is an explicit opt-in (info), declining/blocking
a force operation the user did not opt into is a warning, and structural failure
is an error.

</specifics>

<deferred>
## Deferred Ideas

- Byte-exact wording of the SEV-02 `--force` hint and all severity row text,
  plus the final PRD §11 reconcile and dropped-scope removal — Phase 70.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 69-force-path-severity*
*Context gathered: 2026-06-27*
