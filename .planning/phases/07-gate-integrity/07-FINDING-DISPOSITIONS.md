# Finding Dispositions

Every finding the live evidence ledger routed to this phase, with the status it
carried when the phase opened, the status it carries now, and a command run this
cycle that establishes the claim.

`D-07-17` is the reason the evidence column exists. Three of these findings were
already closed by earlier work, and recording "closed" without a current
measurement is exactly the kind of claim this milestone spent a phase
revalidating. A row that says a defect is gone and cannot show it is not a
record — it is a hope.

Commands are run from the repository root. Output is quoted verbatim.

## Routed findings

| Finding | At phase start | Now | Closed by | Evidence |
| --- | --- | --- | --- | --- |
| `OMR-F01` | live | closed | `07-01` | `git grep -c "marketplace/autoupdate.ts\|marketplace/list.ts\|marketplace/remove.ts" -- tests/architecture/gate-targets.ts` → `6` (three targets, each named in two groups). |
| `OMRR-F004` | live (duplicate of `OMR-F01`) | closed | `07-01` | Same command, same output. `remove.ts` and `list.ts` are both `NETWORK_FREE_TARGETS` members. |
| `OPEF-F01` | live | closed | `07-01` | `tests/architecture/no-orchestrator-network.test.ts:72-75` carries the `dynamic import of platform/git` pattern beside the static `from` form. |
| `OPIB-F07` | live | closed | `07-11` | `git grep -c "tests/orchestrators" -- tests/architecture/partial-vocabulary-guard.test.ts` → `1`; the guard now walks the policed unit-test roots recursively and asserts it reached each one. |
| `DCORE-030` | live | closed | this plan | `grep -c "export const MARKETPLACE_VALIDATOR" extensions/pi-claude-marketplace/domain/manifest.ts` → `0`. The validator is module-private; `tests/domain/manifest.test.ts` drives every schema arm through `loadMarketplaceManifest`. |
| `SCN-F025` | live | closed | `07-08` | `git grep -ln "ClaudeHookEvent" -- tests/architecture` → `tests/architecture/closed-set-enrollment.test.ts`. Both closed sets are enrolled. |
| `HHD-027` | live | closed | `07-09` | `git grep -ln "REQUIRED_EVENT_FIELDS" -- tests/architecture tests/bridges/hooks` → `tests/bridges/hooks/index.test.ts`, where the only remaining mention asserts the barrel keeps it internal. The copied expectation table is gone. |
| `HHD-028` | live | closed | `07-09` | Eight optional-dependency parameter sites are now threaded with a real collaborator; recorded in that plan's summary. |
| `OPLU-A-F07` | mostly closed | closed, with a named residue | earlier work; residue pinned by this plan | `git grep -n "availableRowMessage" -- extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts` → `:69` imports it and `:366` calls it, so it has a real production consumer. Residue: see the `CandidateRow` note below. |
| `OPLU-B-F15` | closed | closed | earlier work | `git grep -c "resetCompletionCache" -- extensions tests` → no matching lines. `extensions/pi-claude-marketplace/shared/completion-cache.ts:374` exports `createCompletionCache()`, which owns its plugin-index memory privately. |
| `SHC-F046` | mostly closed | closed, residue pinned | earlier work; residue pinned by this plan | The three named test-owned exports went with `resetCompletionCache` (same command as above). The two remaining typebox schema constants are census members: `tests/architecture/gate-targets.ts:801` `MARKETPLACE_NAMES_CACHE_SCHEMA` and `:805` `PLUGIN_INDEX_CACHE_SCHEMA`. They are pinned, not excused. |
| `SHC-F047` | live | closed | `07-11` | `git grep -c "STATE_LOCK_HELD_PREFIX" -- tests/architecture/markers-snapshot.test.ts` → no matching lines. The byte pins live only in the module's owner test. |
| `OPEFR-F007` | live | closed | `07-11` | `git grep -n "resolveStrict" -- extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` → `:30` is a static `import { resolveStrict } from "../../domain/plugin-resolver.ts"`. The dynamic form is gone rather than documented. |
| `ABG-004` | live | closed | `07-07` | `git grep -ln "calculateConfigForFile" -- tests/architecture` → `tests/architecture/eslint-effective-config.ts`. The zone matrix is resolved through ESLint's own cascade instead of the first block that mentions the rule. |
| `AHG-014` | live | closed | `07-07` | `git grep -c "matchAll(/files:" -- tests/architecture/hooks-dispatch.test.ts` → no matching lines. The regex source-scrape is deleted, not left beside its replacement. |
| `ORA-F32` | live | instance closed; finding keeps its backlog identity | this plan | `grep -c "export function surfacePostCommitWarnings" extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` → `0`. See the split-disposition note below. |

## `ORA-F32` — a split disposition

The finding is recorded on the deferred backlog. Its **instance** closed here,
early, because it is the identical twin of `DCORE-030` — one defect with two
occurrences, and closing one while leaving the other is the split that lets a
class survive.

A reader who meets `ORA-F32` on the backlog later needs both halves of that
sentence. The instance is gone and the command above proves it; the finding was
not mis-triaged, and nothing about its backlog entry needs correcting. There is
simply nothing left in the tree for it to point at.

## `GGAT-03` — the Fallow half

The requirement's wording is "ESLint/Fallow", which is broader than its evidence.
Both terminal findings behind it (`ABG-004`, `AHG-014`) are ESLint-side, and both
are closed above.

There is no Fallow-side first-match weakness to close:

```
$ git grep -rln 'readFile(.*fallowrc\|\.fallowrc\.json"' -- tests scripts
(no matching lines)
```

No gate reads `.fallowrc.json` at all. The one Fallow-facing gate reads the npm
script string instead — `tests/architecture/import-boundaries.test.ts:166-180`
asserts the `fallow` script invokes `fallow dead-code` with no per-issue-class
filter appended. That is a token allow-list over one string, not a
first-block-wins scan of a cascading configuration, so the weakness `ABG-004`
describes has no analogue there.

Adding a Fallow-config gate would therefore be a new gate for a claim with no
terminal finding, which `D-22` forbids. Recorded as no action, with the
measurement that establishes it.

## What the census pin does and does not cover

The pin in `tests/architecture/gate-targets.ts` is measured by
`fallow dead-code --production --unused-exports`. That flag selects one issue
class. The same run with every class enabled reports more:

```
$ node_modules/fallow/bin/fallow dead-code --production --format json
total_issues 119 · unused_files 3 · unused_exports 100 · unused_types 11
             · unused_class_members 1 · duplicate_exports 4
```

So the pin holds the 100 **value** exports and leaves `unused_types` outside its
scope. `OPLU-A-F07`'s residue is one of those eleven:
`orchestrators/plugin/list-candidate-row.ts:28` still exports the `CandidateRow`
interface with no production consumer outside its own file, and it does not
appear in the census because a type export is a different class to the
instrument. This is a boundary of the pin, named here rather than left for
someone to discover when they wonder why a known-unowned symbol is missing from a
list that claims to be complete.

## Carried notes

- `07-11` recorded a measurement it deliberately did not act on: the three
  agents-bridge marker pins retained in `tests/architecture/markers-snapshot.test.ts`
  are the same duplication class `SHC-F047` describes, one module over. Dropping
  three user-contract pins is an operator decision, not an executor one, and it
  is unresolved. It is repeated here so it stays visible after that summary
  scrolls out of view.
- A namespace import does **not** blanket-satisfy the analyzer for every export
  of the imported module. `orchestrators/marketplace/shared.ts:37` does
  `import * as defaultGit from "../../platform/git.ts"` and accesses seven
  members; `listBranches`, `listRemotes`, and `buildAuthCallbacks` are not among
  them and are census members. Member access through a namespace import is
  tracked individually.
