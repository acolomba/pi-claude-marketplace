# Orchestrators — plugin messaging modules

**Scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/*.messaging.ts` and their
paired tests under `tests/orchestrators/plugin/*.messaging.test.ts` (install, reinstall,
enable-disable, list, update, fetch, info, uninstall).
**Test files reviewed:** 8 (899+637+546+379+277+157+118+91 = 3104 lines)
**Production modules reviewed:** 8

## Summary

This is the healthiest area likely to turn up in this sweep. Every module's render map is
pinned total over its own status set at compile time (`as const satisfies
CommandContext<Status, Msg>`), every test file exercises its module's exported surface with
hand-written literal expected strings (never a value computed by calling the production
formatter on both sides), severity is always asserted as part of a whole-object
`deepStrictEqual` on the transition rows that carry it, and no render-time state probing
exists anywhere in these 8 modules — every render arm and every compose/narrow function is a
pure function of its explicit parameters. Row grammar (`<glyph> <name> [scope] v<version>
(status) {reasons}`) is followed exactly in every one of the ~60 hand-written expected
strings; no case ever puts a status token ahead of the subject, and no reason token outside
the closed `REASONS` catalog turned up (spot-checked `"network unreachable"` against
`shared/notify.ts`). The four smallest files (uninstall/info/fetch/update) each own their
full exported surface with no gaps — see the ownership table below.

Two real, narrow issues to fix:

1. **Naming**: three test files use the placeholder name `actual` for the value under test
   instead of a role-based name (`row`/`renderedRow`), where six of the eight sibling files
   in this exact set already use the correct pattern.
2. **Style**: two of the eight production modules have a `switch` on a closed discriminated
   union with no `default` group, unlike this same codebase's own established
   `assertNever`-in-default idiom (`shared/errors.ts::buildPluginShapeMessage`) and unlike
   the third module in this set (`enable-disable.messaging.ts`) that already has one.

There is also one coverage-symmetry gap worth calling out even though it is not a functional
defect: `reinstall.messaging.test.ts` never directly imports or asserts `REINSTALL_CONTEXT`'s
shape, unlike every other sibling file.

### Ownership audit (are the four smallest files testing their whole module?)

| Module | Exports | Statuses / functions | Test coverage |
| --- | --- | --- | --- |
| `uninstall.messaging.ts` (91-line test) | `UNINSTALL_CONTEXT` only | `uninstalled`, `failed` | Both arms rendered and asserted. Full ownership. |
| `info.messaging.ts` (118-line test) | `PLUGIN_INFO_CONTEXT`, `PluginInfoCascadeMsg` | one status, `skipped` | The only arm, rendered 2 ways (bare + folded scope) plus a context-shape test. Full ownership. |
| `fetch.messaging.ts` (157-line test) | `FETCH_CONTEXT`, `FetchMsg` | 6 statuses (`available`, `partially-available`, `unavailable`, `remote`, `skipped`, `failed`) | All 6 rendered and asserted, plus a context-shape test. Full ownership. |
| `update.messaging.ts` (277-line test) | `UPDATE_CONTEXT`, `UpdateMsg` | 5 statuses (`updated`, `partially-installed`, `skipped`, `partially-upgradable`, `failed`) | All 5 rendered and asserted (2 variants of `updated`), plus a context-shape test. Full ownership. |

No BLOCKER-class ownership gap exists in this area for any of the 8 modules.

## Unit test findings

### `tests/orchestrators/plugin/enable-disable.messaging.test.ts`

- **[WARNING] Placeholder variable name `actual`** — lines 52, 88, 122, 164, 197, 232, 269,
  302 (render outputs), 324, 336, 348, 360, 373 (`narrowDisableFailure` results), 387, 400,
  412, 425, 436, 447 (`narrowEnableFailure` results), 464, 480, 497, 514, 525, 542
  (`staleGateDropped` results) — 24 occurrences total. The skill's naming rule explicitly
  calls out a bare `actual` as a finding. Every sibling test in `install.messaging.test.ts`,
  `list.messaging.test.ts`, and `update.messaging.test.ts` names this same kind of value
  `row` (for a rendered string) or by the function's own vocabulary (`reasons`, `outcome`).
  Rename to `row` for the eight render-call sites and to `reasons` for the fourteen
  `narrowDisableFailure`/`narrowEnableFailure`/`staleGateDropped` sites (all three return
  `readonly ContentReason[] | undefined`).

### `tests/orchestrators/plugin/fetch.messaging.test.ts`

- **[WARNING] Placeholder variable name `actual`** — lines 46, 67, 87, 107, 129, 152 (6
  occurrences). Same finding and same fix as above: rename to `row` to match
  `list.messaging.test.ts`/`update.messaging.test.ts`'s convention for a rendered string.

### `tests/orchestrators/plugin/uninstall.messaging.test.ts`

- **[WARNING] Placeholder variable name `actual`** — lines 42, 77 (2 occurrences). Same
  finding; rename to `row`.

### `tests/orchestrators/plugin/reinstall.messaging.test.ts`

- **[WARNING] `REINSTALL_CONTEXT` is never imported or asserted directly** — whole file. All
  seven other files in this set import their `*_CONTEXT` constant and include a test
  asserting `Object.keys(CONTEXT)`, `CONTEXT.Messaging`, and `Object.keys(CONTEXT.render)`
  against a hand-written expected list (see `install.messaging.test.ts:21-44`,
  `enable-disable.messaging.test.ts:17-34`, `list.messaging.test.ts:28-52`,
  `update.messaging.test.ts:44-61`, `fetch.messaging.test.ts:11-30`,
  `info.messaging.test.ts:24-37`, `uninstall.messaging.test.ts:12-24`). This file has no
  equivalent test. Its four render arms (`reinstalled`, `skipped`, `failed`,
  `manual recovery`) are exercised only transitively, through the two
  `renderReinstallPartitionAndNotify` cascade tests (lines 532-637) — which do cover all four
  arms' rendered bytes, so this is not a coverage hole, but it means a label typo or an
  accidentally-renamed render key would not be caught by a direct, fast, isolated assertion
  the way it would in every sibling file. Add a test mirroring the pattern above: `assert
  .deepStrictEqual(Object.keys(REINSTALL_CONTEXT), ["Messaging", "render"])`, `assert
  .deepStrictEqual(REINSTALL_CONTEXT.Messaging, { label: "Plugin reinstall" })`, and `assert
  .deepStrictEqual(Object.keys(REINSTALL_CONTEXT.render).sort(), ["failed", "manual
  recovery", "reinstalled", "skipped"])`.

### Clean files

- `tests/orchestrators/plugin/install.messaging.test.ts`
- `tests/orchestrators/plugin/list.messaging.test.ts`
- `tests/orchestrators/plugin/update.messaging.test.ts`
- `tests/orchestrators/plugin/info.messaging.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`

- **[WARNING] `switch` on a closed union has no `default` group** — `line 366`
  (`classifyEntityShapeError`'s `switch (err.shape.kind)`, cases `already-installed` /
  `not-in-manifest` / `not-installable` / `no-longer-installable`, no `default`). The Google
  TS style guide requires every `switch` to end with a `default` group, even an empty one.
  This exact codebase already has the idiom for exhausting this very type:
  `shared/errors.ts::buildPluginShapeMessage` switches on the same `PluginShapeErrorShape`
  union and ends with `default: return assertNever(shape);`. Add `assertNever` to the
  existing `import { causeChainTrailer, errorMessage, PluginShapeError } from
  "../../shared/errors.ts";` at the top of the file, and add `default: return
  assertNever(err.shape);` as the last arm of the switch.

### `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`

- **[WARNING] `switch` on a closed union has no `default` group** — `line 276`
  (`outcomeToPluginMessage`'s `switch (outcome.partition)`, cases `reinstalled` / `skipped` /
  `failed`, no `default`). Same rule and same fix as above: add `import { assertNever } from
  "../../shared/errors.ts";` and a trailing `default: return assertNever(outcome);` arm.

### Clean files

- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` (its
  one `switch`, in `narrowDisableFailure`, already has a `default: break;` arm)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts`

## Not covered

Per the diagnostic-review brief, no build/test/lint command was run against this area (`node
--test`, `npm run check`, etc.) — review was by reading only. Everything above was verified
by static reading of all 16 files in full, plus targeted greps against the shared `REASONS`
catalog, `PluginShapeErrorShape`, and `ReinstallPluginOutcome` type definitions in
`shared/errors.ts`, `shared/notify.ts`, and `orchestrators/types.ts` to confirm the two
`switch` findings are genuine (both unions are closed to exactly the cases already handled)
and that the closed-set reason tokens used in tests are legitimate catalog members.
