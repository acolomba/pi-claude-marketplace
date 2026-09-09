# Phase 06 Catalog PRE-EDIT Ledger

Status: READY
Hub: tests/architecture/catalog-uat.test.ts
Legacy test: tests/architecture/catalog-uat.test.ts

Fresh evidence was captured on 2026-09-09 with:

```text
codegraph explore "PRE-EDIT catalog: trace every export, production caller, owner test, gate, document reference, dependency edge, and cycle for tests/architecture/catalog-uat.test.ts"
```

The result is stored at `/tmp/phase06-catalog-preedit-codegraph.txt` (629 lines,
25,049 bytes). CodeGraph found the legacy driver's parser, renderer, strict Pi
boundary, fixture, exact-byte, severity, and inverse-walk dependencies. It found
no unresolved dependency cycle. A tracked-root `git grep` then found references
that CodeGraph's symbol graph cannot see because they are path literals in prose
and scanner fixtures. Commit `371533c7` repointed every authorized reference;
the repeated tracked-root scan now finds only the legacy file's self-label.

## Ownership and dependency map

| Category | Current owner | Destination | Evidence |
| --- | --- | --- | --- |
| exported symbol | no runtime export; internal `FIXTURES` and driver helpers | `tests/architecture/catalog-uat/catalog-contract.test.ts` | New driver directly imports all 20 maps and owns merge, inverse completeness, ordering, render, byte, and severity checks. |
| production caller | legacy driver calls `notify()` | `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` through `catalog-contract.test.ts` | Fresh CodeGraph traces `checkCatalogExample -> notify -> render/dispatch` with no reverse edge. |
| production caller | list-specific fixture emit path | `tests/architecture/catalog-uat/fixtures/plugin-list.ts` | Fixture calls `notifyWithContext` with `LIST_CONTEXT`; contract invokes the fixture's `emit` seam. |
| production caller | update-specific no-op fixture emit path | `tests/architecture/catalog-uat/fixtures/plugin-update.ts` | Fixture calls `notifyUpdateNoOpWithContext` with `UPDATE_CONTEXT`; contract invokes the fixture's `emit` seam. |
| source-scanning gate | `scripts/check-phase-06-hub-ledger.mjs` legacy-hub inventory | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | Generic lifecycle target rotated to the next live hub in Plan 06-34 without changing exact-set validation. |
| source-scanning gate | `tests/scripts/check-phase-06-hub-ledger.test.ts` PRE-EDIT fixture | `tests/orchestrators/plugin/install.test.ts` | Companion fixture now names the Plan 06-34 hub/test pair and preserves positive plus fail-closed cases. |
| source-scanning gate | `tests/architecture/partial-vocabulary-guard.test.ts` guarded-source literal | `tests/architecture/catalog-uat/catalog-contract.test.ts` | The nested driver is explicitly loaded, so the vocabulary absence surface is unchanged. |
| documentation comment | `docs/adr/v2-001-structured-notify.md` lines 151 and 194 | `tests/architecture/catalog-uat/catalog-contract.test.ts` | Both prose references name the direct contract owner. |
| documentation comment | `docs/competitive-analysis/asermax-pi-cc-plugins.md` line 209 | `tests/architecture/catalog-uat/catalog-contract.test.ts` | The byte-exact gate reference names the direct contract owner. |
| documentation comment | `docs/competitive-analysis/pi-plugins.md` line 728 | `tests/architecture/catalog-uat/catalog-contract.test.ts` | The indent-ladder gate reference names the direct contract owner. |
| documentation comment | `docs/messaging-style-guide.md` lines 11 and 188 | `tests/architecture/catalog-uat/catalog-contract.test.ts` | Both prose/link references name the direct contract owner. |
| documentation comment | `docs/open-closed-proof.md` lines 24, 42, and 48 | `tests/architecture/catalog-uat/catalog-contract.test.ts` plus `tests/architecture/catalog-uat/fixtures/*.ts` | The proof now names the distributed fixture maps and inverse contract accurately. |
| documentation comment | `docs/output-catalog.md` lines 3, 59, 3003, 3029, and 3044 | `tests/architecture/catalog-uat/catalog-contract.test.ts` | Every current gate reference names the direct contract owner; bypass notes remain explicit. |
| documentation comment | `tests/orchestrators/plugin/list.test.ts` line 5 | `tests/architecture/catalog-uat/catalog-contract.test.ts` | The producer-owner comment names the direct byte-shape contract. |
| test ownership | catalog parser and malformed-boundary checks | `tests/architecture/catalog-uat/catalog-parser.test.ts` | Direct parser owner passes 12 cases and asserts the exact 190-record inventory. |
| test ownership | catalog orchestration and inverse completeness | `tests/architecture/catalog-uat/catalog-contract.test.ts` | Directly imports 20 fixture modules and passes duplicate, empty, absent, extra, order, bytes, and severity cases. |
| test ownership | XSURF-03 renderer parity | `tests/shared/notification-dispatch.test.ts` | Direct notification owner retains both update-decline and list-inventory public-byte cases. |
| test ownership | UGRM-02 update tally | `tests/orchestrators/plugin/update.test.ts` | Producer owner retains realized-transition and no-op full-body coverage. |
| test ownership | non-update plural success grammar | `tests/orchestrators/plugin/reinstall.test.ts` | Producer owner retains exact `Plugin reinstall: 3 successes` output. |
| completeness invariant | 20 fixture modules | `tests/architecture/catalog-uat/catalog-contract.test.ts` | Twenty direct named imports are assembled with duplicate-tuple and empty-section rejection. |
| completeness invariant | document to fixture | `tests/architecture/catalog-uat/catalog-contract.test.ts` | Each of 190 parsed catalog tuples requires one fixture. |
| completeness invariant | fixture to document | `tests/architecture/catalog-uat/catalog-contract.test.ts` | Each of 190 fixture tuples requires one parsed catalog annotation. |
| completeness invariant | exact public bytes | `tests/architecture/catalog-uat/catalog-contract.test.ts` and `docs/output-catalog.md` | Live parser measures 23,732 UTF-8 bytes; 17,455 omitted Plan 06-31's measured 6,277-byte slice. |
| completeness invariant | exact severity argument | `tests/architecture/catalog-uat/catalog-contract.test.ts` and `tests/architecture/catalog-uat/mock-pi.ts` | The strict boundary distinguishes one-argument info from exact warning/error second arguments. |
| completeness invariant | equal-key ordering | `tests/architecture/catalog-uat/catalog-contract.test.ts` | A negative case proves equal sets in a different order are rejected. |
| dependency edge | `docs/output-catalog.md` -> parser -> contract | `docs/output-catalog.md` -> `catalog-parser.ts` -> `catalog-contract.test.ts` | One-way test/document dependency; no production import of the document or fixtures. |
| dependency edge | 20 fixture modules -> fixture types/mock Pi/producer seams | `fixtures/*.ts` -> `fixture-types.ts`, `mock-pi.ts`, and two command-local emit seams | Fresh import scan and CodeGraph show no fixture-to-contract reverse edge. |
| dependency edge | contract -> parser/fixtures/notification dispatch | `catalog-contract.test.ts` -> named test owners and production public boundary | CodeGraph reports an acyclic graph with no reverse dependency. |

## Fixture inventory

- `plugin-list.ts` owns `/claude:plugin list`.
- `plugin-install.ts` owns `/claude:plugin install <plugin>@<marketplace>`.
- `plugin-uninstall.ts` owns `/claude:plugin uninstall <plugin>@<marketplace>`.
- `plugin-reinstall.ts` owns `/claude:plugin reinstall`.
- `plugin-update.ts` owns `/claude:plugin update`.
- `plugin-fetch.ts` owns `/claude:plugin fetch`.
- `plugin-import.ts` owns `/claude:plugin import`.
- `plugin-bootstrap.ts` owns `/claude:plugin bootstrap`.
- `marketplace-list.ts` owns `/claude:plugin marketplace list`.
- `marketplace-add.ts` owns `/claude:plugin marketplace add <source>`.
- `marketplace-info.ts` owns `/claude:plugin marketplace info <name>`.
- `plugin-info.ts` owns `/claude:plugin info <plugin>@<marketplace>`.
- `plugin-pending.ts` owns `/claude:plugin pending`.
- `reconcile-applied.ts` owns `reconcile-applied-cascade`.
- `marketplace-remove.ts` owns `/claude:plugin marketplace remove <name>`.
- `marketplace-update.ts` owns `/claude:plugin marketplace update [<name>]`.
- `plugin-enable.ts` owns `/claude:plugin enable <plugin>@<marketplace>`.
- `plugin-disable.ts` owns `/claude:plugin disable <plugin>@<marketplace>` and
  `manual-recovery-anchors`.
- `marketplace-autoupdate.ts` owns the enable and bulk states in the combined
  autoupdate section.
- `marketplace-noautoupdate.ts` owns the two disable states in the combined
  autoupdate section.

## Resolved stale-path inventory

All 11 formerly out-of-scope references are now authorized and repointed: two
ADR references, one reference in each competitive analysis, two style-guide
references, three open/closed proof references, the vocabulary guard literal,
and the plugin-list owner comment. The five current catalog-document references
also name the inverse contract. The checker and companion test were rotated
atomically to the exact Plan 06-34 pair:
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` and
`tests/orchestrators/plugin/install.test.ts`.

Before deletion, the required exact-path scan returns one hit: line 1 of the
legacy hub itself. No caller, test, scanner, gate, or document retains the path.
Deleting the hub therefore makes the tracked-root inventory empty without a
facade or re-export.

## Gate result

Deletion is authorized. The fresh CodeGraph trace is acyclic; every symbol,
responsibility, caller, test, gate, document reference, inverse-completeness
check, and dependency edge has one named destination. The PRE-EDIT validator
and focused owner/checker suites must pass once more before the hub is removed.
