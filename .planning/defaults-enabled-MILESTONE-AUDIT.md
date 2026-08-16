---
milestone: defaults-enabled
milestone_name: defaultEnabled Manifest Field
audited: 2026-08-15
status: tech_debt
scores:
  requirements: 15/15
  phases: 5/5
  integration: 15/15 wired
  flows: 1/1 end-to-end flow traced
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: cross-cutting
    items:
      - "5 of 23 SUMMARY files carry no `requirements-completed` frontmatter (102-01/02/03, 105-01/02). Bookkeeping only -- all five requirements were manually cross-checked against the phase VERIFICATION tables and are SATISFIED with evidence."
  - phase: 104-pre-install-read-surfaces
    items:
      - "Two catalog blocks are paired with a different renderer than the rest of their section: the list-surface `available` / `remote` fixtures drive `notifyWithContext(..., LIST_CONTEXT, ...)` rather than plain `notify()`, because the central `renderPluginRow` arms deliberately drop `reasons`. Guarded by a drop assertion in `notify-not-installed-reasons.test.ts`, but not by the catalog."
  - phase: 105-no-op-parity-sweep-and-contract-documentation
    items:
      - "`docs/plugin-enablement.md` is ungated. `docs/output-catalog.md` is the only byte-gated document in the repo and `tests/docs/` does not exist despite appearing in the `npm test` glob. The contract is defended by review alone."
      - "`docs/messaging-style-guide.md` still names a `present` / `PluginPresentMessage` variant that no longer exists in `PLUGIN_STATUSES`. Pre-existing; left under the surgical-changes rule."
      - "Adjacent archived decision IDs remain cited beside the re-anchored ones (`D-80-*`, `D-95-*`, `D-100-*`, `D-102-06`, and others). They resolve today but carry the same long-run risk the sweep addressed. `RSTA-01` itself lives in an archived requirements file."
  - phase: integration
    items:
      - "Asymmetric manifest-side source: `install` resolves from the entry OR `plugin.json`; `list` / `info` read the entry alone. A plugin whose `plugin.json` declares false with a silent marketplace entry installs disabled with no prior warning. Argued and accepted in `docs/plugin-enablement.md`; required by NFR-5."
      - "`maybeWritePluginConfigBack` (`orchestrators/plugin/shared.ts`) targets the base file unless `--local`. Harmless today because the patch carries no field and the local entry replaces the base entry wholesale, so the merged view never moves -- but it relies on merge semantics rather than on targeting."
---

# Milestone Audit: defaults-enabled — defaultEnabled Manifest Field

**Audited:** 2026-08-15
**Status:** `tech_debt` — all requirements satisfied, no blockers, accumulated
deferred items warrant review before the close.

## Definition of Done

A plugin author can ship a plugin that installs disabled (`defaultEnabled: false`),
and nothing later re-enables it behind the user's back.

**Met.** The end-to-end flow was traced in live code, not inferred from summaries:
an author declares the field (101 makes it readable and resolves precedence in one
place) → `install` records it disabled, writes `enabled: false` through to config,
and reports it (102) → `/reload` plans no action (103) → `update` / `reinstall`
never re-apply the declaration (103) → and `list` / `info` said so beforehand
(104). Phase 105 proved the whole thing inert for plugins declaring `true` or
nothing.

## Requirements Coverage (3-source cross-reference)

All 15 requirements **satisfied**. No orphans: both phases whose plans span
several requirements state explicitly in their VERIFICATION files that
`REQUIREMENTS.md` maps no ID to them that a plan does not claim.

| ID | Phase | VERIFICATION | SUMMARY frontmatter | REQUIREMENTS | Final |
|----|-------|--------------|---------------------|--------------|-------|
| DFEN-01 | 101 | passed | listed | `[x]` | satisfied |
| DFEN-02 | 101 | passed | listed | `[x]` | satisfied |
| DFEN-03 | 101 | passed | listed | `[x]` | satisfied |
| DFEN-04 | 102 | passed | **missing** | `[x]` | satisfied (manually verified) |
| DFEN-05 | 102 | passed | **missing** | `[x]` | satisfied (manually verified) |
| DFEN-06 | 103 | passed | listed | `[x]` | satisfied |
| DFEN-07 | 103 | passed | listed | `[x]` | satisfied |
| DFEN-08 | 105 | passed | **missing** | `[x]` | satisfied (manually verified) |
| OUT-01 | 102 | passed | **missing** | `[x]` | satisfied (manually verified) |
| OUT-02 | 104 | passed | listed | `[x]` | satisfied |
| OUT-03 | 104 | passed | listed | `[x]` | satisfied |
| OUT-04 | 102 | passed | **missing** | `[x]` | satisfied (manually verified) |
| OUT-05 | 104 | passed | listed | `[x]` | satisfied |
| DOC-01 | 105 | passed | listed | `[x]` | satisfied |
| DOC-02 | 105 | passed | listed | `[x]` | satisfied |

**On the five "missing frontmatter" rows.** The status matrix scores
`passed + missing frontmatter` as *partial — verify manually*. That manual check
was performed against the authoritative VERIFICATION tables:

- Phase 102's VERIFICATION marks OUT-01, DFEN-04, DFEN-05 and OUT-04 each
  `✓ SATISFIED` with per-truth evidence, and records that no ID mapped to the
  phase is unclaimed.
- Phase 105's VERIFICATION marks DFEN-08 `✓ SATISFIED`, mutation-verified across
  all six named surfaces.

So the gap is bookkeeping in five SUMMARY files, not coverage. It is recorded as
tech debt rather than dismissed.

## Phase Verification

| Phase | Name | Plans | Verification |
|-------|------|-------|--------------|
| 101 | Manifest field and precedence resolution | 3/3 | passed |
| 102 | Reason token, install write-through and notification | 3/3 | passed |
| 103 | Reconcile stability and lifecycle non-reapplication | 6/6 | passed |
| 104 | Pre-install read surfaces | 5/5 | passed |
| 105 | No-op parity sweep and contract documentation | 6/6 | passed |

Every phase was verified by **mutation** — reverting the production code and
confirming the intended test goes red — rather than by reading. That discipline
paid twice: a code review found the read surfaces claiming `{installs disabled}`
from the marketplace entry alone while `install` also gates on the user's config
opinion (false on a reachable state; fixed in `3ff3f55d`), and a later review
found the case scoped as `install` parity was actually testing DFEN-05 precedence,
leaving one of six surfaces untested (fixed in `e094ba05`).

## Cross-Phase Integration

**0 blockers. 0 broken flows.** Every requirement has at least one live
cross-phase consumer; none is single-phase-isolated. The seams that carried real
risk:

- **101 → 102.** `resolveDefaultEnabled` is module-private with exactly one
  caller; the resolved value is threaded by explicit parameter, and `install.ts`
  is its sole consumer on the install path. Precedence is evaluated in one place,
  as DFEN-03 requires.
- **102 → 103 (the milestone's core hazard).** An un-stamped config entry would
  re-enable the plugin on every reload. Closed on **both** caller modes — the
  standalone batched write-back and the orchestrated `else if
  (disabledInstall.landed)` arm — and the value written is the value the reconcile
  planner reads. File targeting agrees across the seam, so a base-file stamp under
  a local declaration cannot go invisible.
- **104 ↔ 102.** The read surfaces' claim rule and install's own rule now share
  the same two conjuncts; the disagreement a review caught is gone.
- **`import` vs `reconcile`.** `import` never opts in and `reconcile` always does,
  matching the contract document's rows exactly.

## Nyquist Coverage

| Phase | VALIDATION.md | status | Classification |
|-------|---------------|--------|----------------|
| 101 | exists | validated / compliant | COMPLIANT |
| 102 | exists | validated / compliant | COMPLIANT |
| 103 | exists | validated / compliant | COMPLIANT |
| 104 | exists | validated / compliant | COMPLIANT |
| 105 | exists | validated / compliant | COMPLIANT |

**Overall: 5 compliant, 0 not-validated, 0 partial, 0 missing.**

The four `draft` files were reconciled at the close rather than accepted as debt.
`validate-phase` found **zero coverage gaps**: every row in every per-task map
already carried a green automated command, and the `draft` status meant only that
no run had ever promoted the files out of their planning-time seed. Two rows in
Phase 105 remain manual by nature — the `(available)` token-table cell and
`docs/plugin-enablement.md` — because prose has no behavior to sample; both were
verified by reading, and they are declared as manual-only rather than claiming a
green test.

## Quality Gate

`npm run check` exits 0 — typecheck, ESLint, Prettier, the full unit suite and the
integration suite. Independently re-run at the close: **3553 tests, 3552 pass,
0 fail, 1 pre-existing skip.**

## Verdict

No requirement is unsatisfied, no integration seam is broken, and no end-to-end
flow is interrupted. The debt above is real but none of it blocks shipping: two
items are documentation reach (an ungated contract document, a stale variant name
in a style guide), two are traceability hygiene (SUMMARY frontmatter, archived
decision IDs still cited), one is a validate-phase coverage TODO, and two are
deliberate, argued design costs already written into the contract.
