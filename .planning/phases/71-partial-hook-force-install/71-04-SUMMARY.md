---
phase: 71-partial-hook-force-install
plan: 04
subsystem: api
tags: [hooks, catalog-uat, byte-exact, force-install, strict-subset, severity, typescript]

# Dependency graph
requires:
  - phase: 71-partial-hook-force-install
    plan: 01
    provides: "partitionHooks + parseHooksConfig filtered subset (the staged strict subset)"
  - phase: 71-partial-hook-force-install
    plan: 02
    provides: "resolver verdict split: partial hooks resolve unsupported (force-degradable)"
  - phase: 71-partial-hook-force-install
    plan: 03
    provides: "narrowUnsupportedKinds hooks arm + info dropped-handler enumeration ({unsupported hooks})"
  - phase: 65-force-install
    provides: "requireForceInstallable gate + --force admit path"
  - phase: 69-force-path-severity
    provides: "SEV-01 (force degrade = info) / SEV-02 (no-force = error + --force hint)"
provides:
  - "PHOOK-04 strict-subset staging proof: install --force stages a hooks.json with the dropped event/matcher group ABSENT, supported group PRESENT (T-71-07 containment)"
  - "SEV-02 no-force-blocks proof + SEV-01 force-degrade-info proof for partial-hook plugins (no severity-layer source change, D-71-06)"
  - "Q3 catalog-uat audit: every {unsupported hooks} fixture classified; none flip (list/import/reinstall collapse to (unavailable); info unavailable = malformed-structural)"
  - "Reconciled docs/output-catalog.md: force-installed-inventory-hooks row carrying the aggregate {unsupported hooks} brace"
  - "list force-installed partial-hook row renders the single aggregate {unsupported hooks} marker"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The bridge stages parseHooksConfig.value (the pure filtered subset), so re-running the deterministic partition at materialize time yields a strict subset by construction -- no bridge/threading change needed for PHOOK-04"
    - "Force surfaces (list/info/force-installed success) source {unsupported hooks} via the typed narrowUnsupportedKinds path; the structural unavailable row sources it via narrowResolverNotes -- both render the same brace"

key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/list.test.ts

key-decisions:
  - "Q3 audit conclusion: NONE of the existing {unsupported hooks} catalog fixtures flip. All five render on surfaces (list / import / reinstall-cascade) that collapse resolver unsupported into the (unavailable) token (D-67-01), or (info unavailable-single-scope) carry componentsResolved:false -- i.e. the malformed-structural case. A force-degradable partial-hook plugin instead resolves unsupported/force-installed and is documented by the NEW force-installed-inventory-hooks row + the existing install failure-unsupported-features row. Recorded as a consolidated inline audit comment (Pitfall 4 / PHOOK-03)."
  - "PHOOK-04 proven with NO source change: install --force stages the bare events-map subset (parseHooksConfig unwraps the {hooks:{...}} wrapper); the dropped Stop event and dropped .* regex group are absent from the written file while the supported group survives."
  - "The no-force install FAILURE row renders the generic {unsupported source} (the hooks kind rides the typed unsupported[] list, not the structural notes path the failure composer reads). The plan's SEV-02 must-have only requires blocking with the --force hint -- satisfied. The cross-surface reason-token parity gap is logged to deferred-items.md (out of scope; would touch the resolver gate)."

requirements-completed: [PHOOK-04, PHOOK-05]

# Metrics
duration: 17min
completed: 2026-06-28
status: complete
---

# Phase 71 Plan 04: Byte-exact catalog reconcile + PHOOK-04 strict-subset proof Summary

**Locked the byte-exact partial-hook output contract and proved the security-relevant PHOOK-04 strict-subset property: an `install --force` on a partial-hook plugin stages a `hooks.json` with every dropped event / matcher group absent while the supported group survives; without `--force` it blocks at error severity with the `--force` hint (SEV-02), and the `--force` degrade renders at info as `(force-installed) {unsupported hooks}` with no summary line (SEV-01 / D-71-06) -- all with no severity-layer or bridge source change.**

## Performance

- **Duration:** ~17 min
- **Completed:** 2026-06-28
- **Tasks:** 2
- **Files modified:** 4 (2 test, 1 doc, 1 catalog-uat byte-driver)

## Accomplishments
- **Q3 audit (Task 1):** classified every `{unsupported hooks}` catalog-uat fixture by what now resolves `unavailable`. After the partial-hook partition, only a STRUCTURALLY malformed `hooks.json` (invalid JSON / `type:"command"` missing `command`) stays `unavailable`; the force-degradable non-bucket-A / unsupported-matcher case flips to `unsupported`/`force-installed`. All five existing fixtures render on surfaces whose token is `(unavailable)` for both buckets (list / import / reinstall-cascade collapse per D-67-01; info `unavailable-single-scope` carries `componentsResolved:false`), so NONE flip -- recorded as a consolidated inline audit comment (PHOOK-03 / Pitfall 4).
- **Catalog reconcile (Task 1):** added a `force-installed-inventory-hooks` catalog row + matching byte-driver fixture rendering `◉ hook-plugin v1.0.0 (force-installed) {unsupported hooks}` (the aggregate marker; D-71-04). Corrected the now-inaccurate info-`unavailable` prose (a parseable-but-unsupportable `hooks.json` no longer resolves `unavailable`).
- **PHOOK-04 strict-subset proof (Task 2):** `install --force` on a partial-hook plugin (supported `PostToolUse(Edit)` group + a `Stop` event) stages a `hooks.json` with `Stop` ABSENT and `PostToolUse` PRESENT; the intra-event matcher-mix case keeps only the supportable `Edit` group and drops the `.*` regex group. The bridge stages `parseHooksConfig.value`, so the strict subset holds by construction (T-71-07 containment).
- **Severity arms (Task 2):** no-force install blocks at `error` severity with the frozen `--force` hint trailer (SEV-02); `--force` degrades to an `info` `(force-installed) {unsupported hooks}` row whose body begins at the marketplace header (no summary line, SEV-01 / D-71-06 / FSTAT-07). No severity-layer source change.
- **list row (Task 2):** a force-installed partial-hook plugin (`compatibility.unsupported: ["hooks"]`) renders the single aggregate `{unsupported hooks}` marker via the shared `narrowUnsupportedKinds` helper.
- `npm run check` is fully green: typecheck + lint + format + 2489 unit (0 fail) + 16/16 integration (NFR-6). REASONS stays 32; closed-set counts unchanged (D-71-04).

## Task Commits

1. **Task 1: reconcile partial-hook catalog rows + Q3 audit** - `d5f3df26` (test)
2. **Task 2: PHOOK-04 strict-subset staging + severity arms + list row** - `2551fd26` (test)

## Files Created/Modified
- `docs/output-catalog.md` - new `force-installed-inventory-hooks` catalog block (`(force-installed) {unsupported hooks}`); corrected info-`unavailable` prose to scope `{unsupported hooks}`-on-`unavailable` to the malformed-structural case (D-71-03 / PHOOK-03).
- `tests/architecture/catalog-uat.test.ts` - matching `force-installed-inventory-hooks` byte-driver fixture; consolidated Q3 audit comment classifying every `{unsupported hooks}` fixture.
- `tests/orchestrators/plugin/install.test.ts` - PHOOK-04 event-level + matcher-group strict-subset staging tests; SEV-01/SEV-02/FSTAT-07/D-71-06 no-force-blocks + force-degrade-info test.
- `tests/orchestrators/plugin/list.test.ts` - force-installed partial-hook row renders the aggregate `{unsupported hooks}` marker (PHOOK-05 / D-71-04).

## Decisions Made
- **Q3 audit -> no fixture flips.** The byte form `(unavailable) {unsupported hooks}` is correct for the malformed-structural case (via `narrowResolverNotes` on the `malformed hooks.json:` note) AND is what the collapsing surfaces (list/import/reinstall) render for a force-degradable candidate. So the existing fixtures stay; the force-degradable case is documented by the new `force-installed-inventory-hooks` row and the existing install `failure-unsupported-features` row. This honors Pitfall 4 (do not reclassify a structural fixture as degradable).
- **No source change for PHOOK-04.** The partition is pure/deterministic and `parseHooksConfig.value` is already the filtered subset, so the materialize re-parse stages the strict subset automatically. The tests read the written file and assert the dropped handlers are absent -- the security-relevant containment proof (V5 / T-71-07).
- **No-force reason token left as `{unsupported source}`.** The install FAILURE composer reads the structural `notes` path; the `hooks` kind rides the typed `unsupported[]` list (no `contains hooks` note), so the no-force row renders the generic token. The plan's SEV-02 must-have (block + `--force` hint) is satisfied; the cross-surface parity gap is logged to `deferred-items.md` rather than fixed (it would touch the resolver gate, beyond this plan's scope).

## Deviations from Plan

### Fewer files touched than listed

The plan's `files_modified` listed `docs/messaging-style-guide.md`, `tests/shared/notify-v2.test.ts`, `tests/shared/snm37-behavioral-smoke.test.ts`, and `tests/shared/snm38-indent-ladder.test.ts` as candidate edits "for the new rows". None required changes: the new `force-installed` + `{unsupported hooks}` row introduces NO new status token or reason literal (both pre-exist), so the indent-ladder, notify-v2 reason, and smoke suites stay green unchanged, and `messaging-style-guide.md` already documents the D-70-02 no-force unavailable/unsupported `--force`-hint split. Verified by running all four suites + the full `npm run check` green.

### Auto-fixed Issues

None - no bugs or blocking issues. The two initial test failures were author-side assertion mismatches (asserted a `{hooks:{...}}` wrapper on the staged file, which the parser unwraps to a bare events map; and asserted `{unsupported hooks}` on the no-force row, which renders `{unsupported source}`); both were corrected in the test code before commit, not via source change.

## Deferred Issues

- **Cross-surface reason-token parity on the no-force install failure row** -> `deferred-items.md`. The no-force `(unavailable)` row renders `{unsupported source}` instead of `{unsupported hooks}`; list/info/force-installed-success all render `{unsupported hooks}` correctly. Out of scope (resolver-gate change); SEV-02 block + hint is satisfied.

## Issues Encountered
- The anticipated catalog-uat byte-fixture FAILURE (flagged as a Plan 03 -> 04 hand-off) did not materialize: the existing fixtures' rendered bytes are unchanged because the affected surfaces collapse `unsupported` into `(unavailable)`. Task 1 was therefore additive (new force-installed-hooks row + audit comment) rather than a reconcile of broken fixtures.

## Next Phase Readiness
- Phase 71 is complete: PHOOK-01..05 all closed. Partial-hook plugins blocked solely by a `Stop` event (or unsupported matcher) are now force-installable, staging a strict-subset `hooks.json`, with byte-exact `{unsupported hooks}` rendering across list / info / force-installed surfaces.
- One follow-up logged (no-force reason-token parity); no blockers.

## Self-Check: PASSED

- Files: `71-04-SUMMARY.md`, `deferred-items.md`, `docs/output-catalog.md`, and the three test files all present and committed.
- Commits `d5f3df26`, `2551fd26` present on `features/force-install`.
- `npm run check` green: typecheck + lint + format + 2489 unit (0 fail) + 16/16 integration. REASONS unchanged (32); closed-set counts unchanged (D-71-04).

---
*Phase: 71-partial-hook-force-install*
*Completed: 2026-06-28*
