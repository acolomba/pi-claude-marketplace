---
phase: 23-uninstall-and-prune-parity
status: all_fixed
findings_in_scope: 9
fixed: 7
skipped: 2
---

# Phase 23: Review Fix Report

| ID | Disposition | Change |
| -- | ----------- | ------ |
| CR-01 | fixed | `catalog-contract.test.ts` `EXPECTED_UTF8_BYTES` 47_525 → 47_615 (8 versioned rows + the lock path). |
| WR-01 | fixed | `withoutDisabledHolders` drops only records disabled by the user or a config (`!enabled && dependencyDisabled !== true`). A record the load-time check held down is still enabled in its config, which is what Claude Code reads, so it keeps holding. Unit case "a dependency a plugin the load-time check held down needs is refused (UNI-01)". |
| WR-02 | fixed | `docs/output-catalog.md` D-05-04 sentence on the uninstall success row and the two LAYER-08 needer sentences now say "enabled". |
| IN-01 | fixed (reconcile.messaging.ts) | Pending-row comment names the `will uninstall` version. The `enable-disable.ts` "Mirrors readDeclarers" comment is left: `enable-disable.ts` is not in this phase's file set and the comment still describes the composition it mirrors. |
| IN-02 | skipped | One shared "enabled declarers" helper would touch `enable-disable.ts` (parallel phases); left as tech debt. |
| IN-03 | skipped | `marketplace remove`'s layer refusal still counts disabled holders; out of the phase's three requirements. Reported to the user. |
| IN-04 | fixed | Bare `D-04` citations replaced by `PRN-02`. |
| IN-05 | fixed (mixed needer) | Added "an enabled plugin needs beside a disabled one is refused". Two-scope `recordedVersionEntries` and the `assert.ok` message left as is (the pending feature covers per-scope keys; the include check names the exact path). |
| IN-06 | fixed / no change | `pending.ts` import order alphabetized; `README.md` now says "enabled dependents". `README.es.md` has no counterpart sentence. `docs/json-output.md` needed no edit (its plugin-row `version` field is already optional for every status). |
