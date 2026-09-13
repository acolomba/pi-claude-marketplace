# Notification PRE-EDIT Ledger

Status: READY
Hub: extensions/pi-claude-marketplace/shared/notify.ts
Legacy test: tests/shared/notify.test.ts

Fresh CodeGraph evidence: `/tmp/phase06-notification-preedit-codegraph.txt` (24,970 bytes), generated immediately before this ledger from the exact Plan 06-27 query. The current hub and legacy test each export only an empty migration marker. No runtime or type symbol remains in either file, and no tracked production or test caller imports the hub.

| Category | Current owner | Destination | Evidence |
| --- | --- | --- | --- |
| exported symbol | `shared/notify.ts` empty `export {}` marker | Delete the marker; all closed tuples, unions, and message interfaces are in `shared/notification-types.ts` | Direct source inspection and fresh CodeGraph show zero behavior-bearing hub exports |
| exported symbol | Notification icons, tokens, row composers, and info/cascade renderers | `shared/notification-grammar.ts` | The named owner exports the complete rendering vocabulary and its direct test asserts exact bytes |
| exported symbol | Severity, tally, reload, cascade, and summary folding | `shared/notification-summary.ts` | The named owner exports the complete folding vocabulary and its direct test covers all public branches |
| exported symbol | `notify`, usage, diagnostic, hook, raw, info, and cascade entrypoints | `shared/notification-dispatch.ts` | The named owner exports every Pi-bound dispatch entrypoint and owns every direct `ctx.ui.notify` call |
| exported symbol | Absolute-path redaction | `shared/redact-absolute-paths.ts` | The security leaf is production-used and directly tested |
| exported symbol | `Sortable` and name/scope comparison | `shared/compare-name-scope.ts` | The utility leaf is production-used and directly tested |
| production caller | 40 direct `notification-types.ts` consumers under `extensions/` | `shared/notification-types.ts` | Fresh tracked import census maps every type and closed-vocabulary import directly to this owner |
| production caller | 20 direct `notification-grammar.ts` consumers under `extensions/` | `shared/notification-grammar.ts` | Fresh tracked import census maps every renderer and token import directly to this owner |
| production caller | `orchestrators/plugin/update.ts` plus the shared ownership README | `shared/notification-summary.ts` | The only production summary consumer imports the named owner directly |
| production caller | 42 direct `notification-dispatch.ts` consumers under `extensions/` | `shared/notification-dispatch.ts` | Fresh tracked import census maps every notification boundary call directly to this owner |
| production caller | `plugin/enable-disable.ts`, `plugin/shared.ts`, `reconcile/apply.ts`, and `reconcile/backfill.ts` | `shared/redact-absolute-paths.ts` | All four security consumers import the named owner directly |
| production caller | `hooks/event-router.ts`, import execution, fetch, reinstall, update, reconcile notify, and reconcile pending | `shared/compare-name-scope.ts` | All eight sorting consumers import the named owner directly |
| source-scanning gate | ESLint direct-output boundary | `shared/notification-dispatch.ts` | The sole exemption names only the dispatch owner; stdout, stderr, console, and direct UI notification remain forbidden elsewhere |
| source-scanning gate | Notification boundary and architecture gates | `tests/edge/notification-boundary.ts` plus notify closed-set, grammar, stamp, wire, scope, order, hook-cap, and hook-dispatch suites | The complete tracked gate census names current owners and contains no retired hub path |
| source-scanning gate | Generic Phase 6 PRE-EDIT fixture | `tests/architecture/catalog-uat.test.ts`, the live hub retained through 06-28 and deleted by 06-33 | The checker retains READY and fail-closed controls for absent categories, duplicate owners, invalid destinations, and cycles |
| documentation comment | ADR, competitive analysis, messaging guide, open/closed proof, output catalog, and PRD | The six named notification owners | All six normative documents name real owners and contain no retired hub path |
| documentation comment | Plugin info command-local ownership comments | `shared/notification-types.ts` and `shared/notification-grammar.ts` | Both comments now name the exact vocabulary owners without changing executable bytes |
| test ownership | Closed tuples, unions, message shapes, and discriminant exhaustiveness | `tests/shared/notification-types.test.ts` | Direct mirrored owner for `shared/notification-types.ts` |
| test ownership | Icons, rows, info rendering, and cascade grammar | `tests/shared/notification-grammar.test.ts` | Direct mirrored owner for `shared/notification-grammar.ts` |
| test ownership | Severity, tally, reload, cascade, and summary folding | `tests/shared/notification-summary.test.ts` | Direct mirrored owner for `shared/notification-summary.ts` |
| test ownership | Notify, usage, diagnostic, hook, raw, info, and cascade dispatch | `tests/shared/notification-dispatch.test.ts` | Direct mirrored owner for `shared/notification-dispatch.ts` |
| test ownership | Absolute-path redaction | `tests/shared/redact-absolute-paths.test.ts` | Direct mirrored owner for `shared/redact-absolute-paths.ts` |
| test ownership | Name/scope sorting | `tests/shared/compare-name-scope.test.ts` | Direct mirrored owner for `shared/compare-name-scope.ts` |
| completeness invariant | Six source/test pairs | The six named notification owner pairs above | All twelve paths are tracked, directly paired, and included in corresponding-test and direct-coverage gates |
| completeness invariant | Direct output surface | `shared/notification-dispatch.ts` | Exactly eight production `ctx.ui.notify` call expressions remain and all eight are in the dispatch owner |
| completeness invariant | Closed notification vocabulary | `shared/notification-types.ts` | Exact reason, status, plugin, marketplace, and notification-kind sets are asserted by the direct owner test |
| completeness invariant | Final repository path scan | Zero retired hub-path matches under `extensions`, `tests`, `scripts`, `docs`, and `eslint.config.js` | Full tracked-root census passed before hub deletion |
| dependency edge | `notification-types.ts` to lower shared/platform types only | `notification-grammar.ts` imports the notification vocabulary | One-way types-to-grammar edge confirmed by current imports |
| dependency edge | `notification-types.ts` and grammar to summary/dispatch composition | `notification-dispatch.ts` imports types, grammar, and summary | One-way composition ends at the sole Pi notification boundary |
| dependency edge | Redaction and comparator leaves | Direct production consumers only | Neither leaf imports the notification composition chain |
| dependency edge | Complete notification owner graph | Directed acyclic six-owner graph | Fresh CodeGraph evidence reports no back edge or unresolved caller |

## Readiness conclusion

- Export mapping: 100% — the legacy hub has zero behavior-bearing exports; every notification responsibility has one named source owner.
- Caller mapping: 100% — the tracked import census found zero hub callers and direct imports for all six owners.
- Test mapping: 100% — exactly six unique mirrored owner tests exist.
- Gate and document mapping: 100% — the sole-output boundary, architecture suites, generic PRE-EDIT fixture, and all normative documents name current owners.
- Completeness and dependency mapping: 100% — corresponding/direct coverage applies to all six pairs, the graph is one-way and acyclic, and the full tracked-root retired-path census is empty.

The evidence therefore authorizes atomic deletion of the empty hub and empty legacy test with no facade or re-export.
