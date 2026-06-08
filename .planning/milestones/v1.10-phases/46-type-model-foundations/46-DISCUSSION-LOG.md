# Phase 46: Type-Model Foundations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 46-type-model-foundations
**Areas discussed:** New variant generality, Structural-reason encoding, Marketplace msg union shape, Phase 46 byte boundary, isInfoKind guard membership

---

## New variant generality (TYPE-01)

| Option | Description | Selected |
|--------|-------------|----------|
| General reusable variant | One `marketplace-not-added` message, cut once in 46, consumed by info now AND install/uninstall/reinstall/update/remove/autoupdate in 47-48. Aligns with the ROADMAP's "the Phase 46 variant" reuse framing. Renders today's bytes (byte-neutral in 46). | ✓ |
| Narrow info-only variant | BACKLOG #2's literal `plugin-info-scope-mismatch` (name/scope?), scoped to info. Phase 47 later widens/re-cuts → type touched twice. | |

**User's choice:** General reusable variant.
**Notes:** Confirmed mid-discussion that the current info `{not added}` renders as a bare
column-0 row `⊘ <name> [scope?] (failed) {not added}` with the marketplace name in the `name`
field -- so a general `{ kind, name, scope? }` variant is both byte-identical to today's info
output and exactly the marketplace-subject form Phases 47-48 want. Supersedes BACKLOG #2's
narrower proposal.

---

## Structural-reason encoding (TYPE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal Exclude | `type ContentReason = Exclude<Reason, "not added">`; row reason fields → `ContentReason[]`. `not added` reachable only via the variant's kind. REASONS stays one 29-tuple, length-lock untouched. | ✓ |
| Explicit two-set partition | Named `STRUCTURAL_REASONS` + `CONTENT_REASONS` tuples; `Reason = structural \| content`. More explicit axis, but the `REASONS.length === 29` lock must be reworked → ceremony. | |

**User's choice:** Minimal Exclude.
**Notes:** Keeps REASONS as the single length-locked tuple; the new variant already removes
`not added` from any row `Reason[]` field, so the illegal `["not added", "permission denied"]`
mix becomes a compile error rather than a render-time `length === 1` guard.

---

## Marketplace msg union shape (TYPE-04)

| Option | Description | Selected |
|--------|-------------|----------|
| 3-arm field-grouping | list (details) / skipped (reasons) / transition (neither). Maps 1:1 to SC4 wording, least boilerplate. | |
| Full per-status union | One arm per status (7) + list/inventory arm. Maximally uniform; adding a status = compile error at every site + renderer case. More boilerplate. | ✓ |

**User's choice:** Full per-status union.
**Notes:** Verified before asking that the renderer already confines mp-level `reasons` to the
skipped/autoupdate-idempotent arm and `details` to the list surface, and that `failed` mp rows
carry the reason on a child plugin row (not the mp header) -- so "reasons only on skipped" is
byte-neutral and forward-compatible with Phase 48. User chose the more rigorous per-status
split for maximal exhaustiveness (renderer switch narrows one arm per case + `assertNever`).

---

## isInfoKind guard membership (TYPE-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Inside one unified guard | `isInfoKind` covers all 5 standalone-rendered kinds (4 read-only info + marketplace-not-added). All 4 consumers route through the one guard; severity returns `error` for the new arm. Kills the add-a-branch-everywhere smell. | ✓ |
| Separate sibling category | Keep `isInfoKind` = 4 read-only kinds; marketplace-not-added gets its own explicit arm in each consumer. Semantically purer name, but reintroduces the parallel-branch smell B-7/TYPE-03 targets. | |

**User's choice:** Inside one unified guard.
**Notes:** Surfaced as a consequence of the general-variant + TYPE-03 choices. The 5-member
guard is documented as "standalone-dispatched kinds"; the name `isInfoKind` is kept per TYPE-03
wording. `computeSeverity` → `error` for the new arm; `buildSummaryLine` → `""`;
`shouldEmitReloadHint` → `false`; dispatch → `dispatchInfoMessage`.

---

## Phase 46 byte boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Strict byte-neutral foundation | Zero rendered-byte changes; only types + 3 info construction sites + re-keyed fixtures (same bytes). No new catalog states. ALL op corrections + new catalog states → 47-48. | ✓ |
| Foundation + anticipatory fixtures | Same + pre-add catalog/UAT fixtures for the 47-48 op output before any op emits it. Front-loads coverage but creates orphan-until-wired catalog states. | |

**User's choice:** Strict byte-neutral foundation.
**Notes:** Locks the 46↔47 line and guards against scope creep. The variant renderer is already
exercised by the re-keyed info states + notify-v2 unit tests, so anticipatory fixtures would be
largely redundant in 46.

---

## Claude's Discretion

- Exact internal interface names for the per-status marketplace arms and the variant type name.
- Whether `isInfoKind` exposes a dedicated `StandaloneKind` type alias or narrows inline.
- The precise `notify-types.test.ts` assert constants for the new shape/arity proofs.
- Whether to retire the legacy `_Assert_NotifFourArms` constant or keep it alongside the 6-arm assert.

## Deferred Ideas

- **Phase 47:** emission model for bulk/cascade ops -- standalone top-level `marketplace-not-added`
  message vs. embedded cascade row. Not decided in 46 (the variant is a top-level arm).
- **Audit B-4/B-5/B-6/B-8:** med/lo type foot-guns outside v1.10 TYPE-01..04 scope -- future hardening.
- **Phase 48:** `marketplace add` failed-with-reason rendering (child-row pattern vs union change).
