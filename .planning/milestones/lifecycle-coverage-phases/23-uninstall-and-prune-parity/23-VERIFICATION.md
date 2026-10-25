---
phase: 23-uninstall-and-prune-parity
status: passed
verified: 2026-10-23
requirements: [PRN-02, PRN-03, UNI-01]
---

# Phase 23: Uninstall and Prune Parity - Verification

## Success criteria

| # | Criterion | Status | Evidence |
| - | --------- | ------ | -------- |
| 1 | Every `will uninstall` row (prune `--dry-run`, pending, reconcile) shows the plugin's version (PRN-02) | VERIFIED | `PluginWillUninstallMessage.version`; layout `version: "single"`; `pluginVersion` / `wireVersion` return it. Producers: `prune.ts` dry-run (`candidate.record.version`), `reconcile/notify.ts` `willUninstallRow` for `pluginsToUninstall` and removed-marketplace rows, fed by `pending.ts` via `recordedVersionEntries`. Load-time reconcile emits no `will uninstall` rows (D-05). Scenarios: `prune.feature` dry-run, `pending.feature` (two scenarios, one new). Unit: prune, pending, notify (PRN-02 case), notification types/grammar/json; integration `standalone-prune.test.ts`; catalog fixtures + `docs/output-catalog.md`. |
| 2 | `prune` under a held lock prints the lock path as the other commands do (PRN-03) | VERIFIED | `prune.ts::notifyOperationFailure` passes `StateLockHeldError` unredacted. `state-lock.feature` prune scenarios assert `{project dir}/.pi/pi-claude-marketplace/.state-lock` and `{agent dir}/pi-claude-marketplace/.state-lock`, same form as uninstall. No recorded reason for the redaction existed (Phase 15 D-06 called it an inconsistency). |
| 3 | `uninstall` of a dependency whose only dependents are disabled behaves as Claude Code 2.1.30x (UNI-01) | VERIFIED | Upstream 2.1.309 binary: `Nfe` never refuses for dependents; `Z1t`/`Y` keep only `enabled` reverse dependents, so disabled-only dependents give a plain success. `uninstall.ts` reads an `enabledIndex` (holders disabled by user/config dropped; `dependencyDisabled` holders kept, D-13) for the dependents report and LAYER-08 walk. Scenario "Uninstalling a dependency whose only dependent is disabled uninstalls it"; unit cases for target layer, other layer, through a disabled undeclared holder, mixed enabled+disabled (still refused), held-down dependent (still refused). |
| 4 | `npm run check` stays green | VERIFIED | Full `npm run check` exit 0 in the worktree: static checks, unpaired, integration, 714/714 cucumber scenarios, direct coverage. |

## Code review

`23-REVIEW.md`: 1 critical, 2 warnings, 6 info. All critical and warning findings fixed; dispositions in `23-REVIEW-FIX.md`.

## For the user

- Upstream-parity question (recorded divergence kept): D-MF-03 still refuses a named uninstall of a dependency that an ENABLED declared plugin needs; Claude Code uninstalls it and appends `— warning: required by …`. Not reopened here.
- Judgment call (D-13): a dependent the load-time check held down (`dependencyDisabled`) still counts as enabled, because its config says enabled and Claude Code reads settings. Confirm if you prefer the record flag instead.
- Inconsistency left: `marketplace remove`'s layer refusal still counts disabled holders, unlike the named uninstall now (review IN-03); out of this phase's scope.
- Tech debt: two different "enabled declarers" filters exist (uninstall's `withoutDisabledHolders` and `enable-disable.ts`'s); a shared helper was skipped to avoid touching `enable-disable.ts` while other phases run (review IN-02).
- `will install` / `will enable` / `will disable` rows stay versionless (D-02); only `will uninstall` was in scope.
- PRN-02's upstream form (`name (version)`) was taken from the roadmap finding; not re-verified in the binary.
- Shared files touched (merge watch): `shared/notification-types.ts`, `notification-grammar.ts`, `notification-json.ts`, `docs/output-catalog.md`, and `test/architecture/catalog-uat/catalog-contract.test.ts` (`EXPECTED_UTF8_BYTES` 47_525 → 47_615; other phases changing the catalog will need to re-add their deltas).
