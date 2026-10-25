# Phase 24: Review Fix

| ID | Severity | Outcome | Note |
| --- | --- | --- | --- |
| CR-01 | Critical | fixed | `execute.messaging.test.ts` and `soft-dep-marker-policy.test.ts` pin the five-key row policy map, `partially-installed` included. |
| WR-01 | Warning | fixed | The enable header, the cascade builder doc, and the `ImportStatus` doc name the new rows; the long line is rewrapped. |
| WR-02 | Warning | fixed | `docs/output-catalog.md` no longer says the fallthrough carries `{not in manifest}`. |
| WR-03 | Warning | fixed (partly) | An `InstallMarketplaceAddError` now carries its add reason, as on install's row (`runtimeReason`, renamed from `hostReason`); covered by the unclassified-failure case. A rollback-partial failure still reads a bare `(failed)`: import's outcome does not carry the partials, so this is left for the user. |
| IN-01 | Info | fixed | The messaging test's unavailable fixtures use `{unsupported hooks}`; a `partially-installed` render case is added. |
| IN-02 | Info | skipped | A named, unexported base interface trips fallow's private-type-leak rule; an exported one would be an unused export. The `Omit<Extract<...>>` return type stays. |
| IN-03 | Info | skipped | The `declares*` fields are required by the outcome contract (NFR-7) and the enable path derives both copies from one outcome in one place. |
| IN-04 | Info | fixed | `apply.ts` pins a one-export surface, so `degradationFromEnable` moved to `plugin/shared.ts` beside `LedgerDegradationSignals`, with a direct test. |
| IN-05 | Info | skipped | The held-dependency case drives the production enable operation; the unchanged disabled record plus the skip row prove the enable did not run, since a run re-enables the record. |
