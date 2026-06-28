---
phase: 70-spec-documentation-reconcile
reviewed: 2026-06-28T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/architecture/catalog-uat.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 70: Code Review Report

**Reviewed:** 2026-06-28
**Depth:** deep (cross-file, call-chain traced)
**Files Reviewed:** 5 source/test (docs excluded as spec text per scope)
**Status:** clean

## Summary

Phase 70 reconciles the shipped force-install/update design with the spec docs
and performs one behavioral change: `composeUnavailableMessage` in the install
orchestrator now unconditionally stamps `severity: "error"` on the structural
`unavailable` install-failure row (previously it stamped severity only on the
force-degradable `unsupported` arm). The remaining source edits are
comment-only rephrasings; the doc edits are spec text.

All four invariants the change was required to preserve hold:

1. **Frozen byte string (D-70-01)** — `FORCE_INSTALL_HINT_TRAILER` is byte-for-byte
   `Re-run with --force to install the supported components.` and appears
   identically (exactly once) in `notify.ts`, `docs/output-catalog.md`, and
   `docs/messaging-style-guide.md`. The freeze-claim comments are accurate.

2. **LIST surface stays info (D-70-02 per-row surgical)** — verified by call-chain
   trace: `composeUnavailableMessage` has exactly one caller (install.ts:1589).
   The LIST surface builds its `status: "unavailable"` rows independently
   (`list.ts:543` and `:579`) with NO `severity` field, so they default to info
   via `countRowsBySeverity`'s `?? "info"` fallback. The error stamp does not bleed
   into LIST.

3. **Closed-set token counts unchanged (22/17/7)** — `status` remains
   `"unavailable"`; no new status token is introduced. `catalog-token-closure`
   test passes.

4. **No forceHint on the structural arm** — `severity: "error" as const` is
   unconditional; `forceHint: true` is spread only under
   `entityErrorRow.forceable === true`. The two are independent; the structural
   arm gets error severity with no hint, exactly as specified.

The severity-aggregation path was traced end-to-end: the reducer
(`countFailedRows` -> `countRowsBySeverity` over stamped `severity === "error"`)
now counts the unavailable row, so the leading summary line
`A plugin operation has failed.` correctly fires — matching the flipped
`PI-4` / `SEV-02` test expectations and the `failure-structural-unavailable`
catalog fixture (`expectedSeverity: "error"`).

The SEV-02 reducer-inertness test (`notify-inert-fields.test.ts:171`) that
synthetically stamps an `unavailable` row with `severity:"info"` is unaffected:
it exercises the reducer directly, not `composeUnavailableMessage`, and the
reducer's status-inert contract is unchanged.

Verification run: `node --test` on `install.test.ts` + `catalog-uat.test.ts`
(79 pass / 0 fail), plus `notify-inert-fields` + `catalog-token-closure`
(6 pass / 0 fail).

No bugs, security issues, or quality defects found. The change is surgical and
every edited line traces to the reconcile goal.

---

_Reviewed: 2026-06-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
