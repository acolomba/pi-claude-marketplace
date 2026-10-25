---
phase: 27-install-and-reconcile-reason-residue
status: all_fixed
fixed: [CR-01, CR-02, WR-02, WR-03, WR-05, IN-02, IN-05]
deferred: [WR-01, WR-04, IN-01, IN-03, IN-04]
---

# Phase 27 Review Fix

| ID | Disposition | What changed |
| --- | --- | --- |
| CR-01 | fixed | `resolveOneMember` renders the effective ranges (root ranges included) once and passes them through `probeMemberPin` to `toMemberConstraintOutcome`, so a root's `{no matching version}` / tag-listing cause names the caller's range. Two root-range unit cases added. |
| CR-02 | fixed | `installFailureReasonFields` has cases for both resolver kinds, another shape kind, a non-shape throw, and a caller-held reason; direct coverage is 100%. |
| WR-01 | deferred | A dependency's rollback partial: import has only the root's `{dependency failed}` row (no member rows), so there is no row to carry it. Listed for the user. |
| WR-02 | fixed | Import's re-enable path passes `outcome.reason === "rollback partial"` to `dispatchFailedOutcome`. |
| WR-03 | fixed | Reconcile's missing-dependency failure arm uses `installFailureReasonFields(result.error, result.reason)`. |
| WR-04 | deferred | Reconcile's own install row does not show rollback-partial children; REC-06 names import only. Listed for the user. |
| WR-05 | fixed | `install-dependencies.feature` tables realigned. |
| IN-01 | deferred | The probe's `no-matching-tag.range` stays in the probe's result type (other probe callers). |
| IN-02 | fixed | `PinnedCommitMissingError` takes only the sha. |
| IN-03 | deferred | The missing-dependency outcome's undeclared `rollbackPartials`: harmless runtime extra on a structurally typed value. |
| IN-04 | deferred | IMP-09 comment placement: cosmetic. |
| IN-05 | fixed | CONTEXT D-05 now says `reason` stays `no longer installable`. |
