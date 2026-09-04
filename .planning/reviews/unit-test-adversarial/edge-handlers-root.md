# Edge — handler shared helpers and MCP tools

**Scope:** `tests/edge/handlers/shared.test.ts`, `tests/edge/handlers/tools.test.ts`,
`tests/edge/handlers/marketplace-seed.ts`, paired against
`extensions/pi-claude-marketplace/edge/handlers/shared.ts` and
`extensions/pi-claude-marketplace/edge/handlers/tools.ts` (the only two `.ts`
files directly in `edge/handlers/`).
**Test files reviewed:** 3
**Production modules reviewed:** 2

## Summary

`shared.test.ts` is a clean, well-scoped scanner suite: whole-value
`deepStrictEqual` assertions, correct `strong-mock` usage via the shared
`createNotificationBoundary` factory, one sibling `test()` per data row, no
weak assertions, no stray comments. `tools.test.ts` is large (53 cases) but
disciplined — real `strong-mock` boundaries with `exactParams`/`verify()`,
hermetic `mkdtemp`/`HOME` isolation, an offline `https.request` regression
guard, and a compile-time exhaustiveness proof (`Record<UndrivenStatus,
never>`) tying the two `projectRowStatus` data tables to the full status
union. The one real gap in this area: both registered tools have
inconsistent, partly-untested error handling for a corrupt `state.json` —
`registerListMarketplacesTool` has no `try`/`catch` at all, and
`registerListPluginsTool` only guards the payload load, not the
marketplace-existence pre-check, and no case exercises either unguarded path.
`marketplace-seed.ts` earns a placement finding (it serves three concern
trees, not one) and a real type-safety gap (a double-cast that erases
structural checking on every seeded fixture 15 test files depend on). A
fixing pass should prioritize: (1) closing the untested/unguarded
`state.json`-failure paths in `tools.ts`, (2) removing the `as unknown as`
cast in `marketplace-seed.ts` in favor of the already-typed pattern
`tools.test.ts` itself demonstrates, and (3) relocating/renaming the seed
file to reflect its real, cross-layer consumer set.

## Unit test findings

### `tests/edge/handlers/tools.test.ts`

- **[BLOCKER] No case exercises a corrupt/unreadable `state.json` for
  `registerListMarketplacesTool`, and no case exercises it for
  `registerListPluginsTool` when a `marketplace` filter is also set** —
  `describe("registerListMarketplacesTool", ...)` (lines 440–552) and the
  `marketplace`-narrowing cases in `describe("registerListPluginsTool", ...)`
  (e.g. lines 1280–1409). The only corrupt-state case in the whole suite is
  `"reports a tool error when the recorded state declares an unknown schema"`
  (lines 1478–1506), and it calls `execute` with `{}` params, so
  `params.marketplace` is never set. This leaves two real code paths
  completely unexercised: `registerListMarketplacesTool`'s single
  `await loadVisibleMarketplaces(...)` call (`tools.ts:89`), which has no
  `try`/`catch` anywhere in the function, and `registerListPluginsTool`'s
  `marketplaceExists(...)` pre-check (`tools.ts:521`), which runs before the
  function's only `try` block (`tools.ts:540`). A wrong implementation that
  turns an unhandled rejection into a thrown, uncaught error on either path
  would still pass every case in this file. Add: (a) a case for
  `registerListMarketplacesTool` that seeds an unreadable `state.json` (mirror
  the existing `writeFile(locations.stateJsonPath, JSON.stringify({schemaVersion:
  3}), "utf8")` fixture) and asserts what `execute` actually returns/throws;
  (b) a case for `registerListPluginsTool` with `params.marketplace` set
  against the same corrupt state, to prove whether the pre-check surfaces the
  same graceful `isError: true` shape or an unhandled rejection. Whichever the
  correct contract turns out to be, pin it — right now nothing does.

- **[WARNING] `ctx.cwd` exact read-count turns a stub into a mock** —
  `createToolBoundary` (lines 326–353, the `cwd.reads` parameter) and every
  call site that supplies `{ value: scope.cwd, reads: N }` (representative:
  lines 479–485, 512–518, 954–957, 978–981, 1293–1296 with `reads: 2`).
  `ctx.cwd` plays a stub role here — it feeds the current working directory
  into the tool, it is not itself a promised interaction like a notification
  or a write — yet `strong-mock`'s default "each call expected exactly once"
  behavior combined with an explicit `.times(cwd.reads)` makes every read of
  it a verified call-count promise, which the skill's test-double table
  flags directly: "a stub with call-count assertions has been turned into a
  mock." Every case in this file also asserts the handler's actual public
  result (`assert.deepStrictEqual(listed, expectedResult)`), so this does not
  make any case vacuous — it is additive brittleness, not a missing
  assertion. Because the two-vs-one read counts are already fully and
  correctly exercised across the marketplace-narrowing cases, this is a
  structural note rather than a call to strip the counts outright: if the
  goal is specifically "prove this rejection path never reads `cwd`," give
  that its own named assertion/comment instead of threading an exact count
  through every unrelated case that happens to reuse `createToolBoundary`.

### `tests/edge/handlers/marketplace-seed.ts`

- **[BLOCKER] `mergeMarketplaceIntoState` erases structural type-checking on
  every seeded state record via a double-cast** — `line 95`:
  ```ts
  } as unknown as Parameters<typeof saveState>[1]);
  ```
  `buildInstalledPluginRecord` (line 50) is typed to return
  `Record<string, unknown>`, so the object handed to `saveState` — which
  expects a real `ExtensionState` — has to be forced through `unknown` to
  compile. This is a double assertion with no comment explaining why it is
  safe (Google style: "`as`/`!` only with an obvious or commented reason"),
  and because 15 test files across `edge/handlers/plugin/`,
  `edge/handlers/marketplace/`, and `orchestrators/plugin/` all seed their
  fixtures through this one function, a typo in a field name here (e.g. a
  renamed `compatibility` key) would compile clean and silently corrupt every
  consumer's fixture instead of failing at the seed's own call site. Fix by
  typing `buildInstalledPluginRecord` to return the real
  `ExtensionState["marketplaces"][string]["plugins"][string]` type (call it
  `PluginRecord`, derived the same way `tests/edge/handlers/tools.test.ts`
  already does: `type MarketplaceRecord = ExtensionState["marketplaces"][string];
  type PluginRecord = MarketplaceRecord["plugins"][string];`) and typing
  `mergeMarketplaceIntoState`'s `record`/`existing` accordingly, so
  `saveState` is called with a value TypeScript actually checked — no cast at
  all.

- **[WARNING] Cross-cutting seed misplaced one level above the concern it
  implies, and misnamed for its real consumer set** — `marketplace-seed.ts`
  sits at `tests/edge/handlers/`, one level above both
  `tests/edge/handlers/marketplace/` and `tests/edge/handlers/plugin/`. Its
  name suggests marketplace-handler ownership, but it is imported by 15 test
  files across three different concern trees:
  `tests/edge/handlers/plugin/{fetch,info,list,update,enable-disable,uninstall,install,reinstall}.test.ts`
  (8 files — the heaviest consumer group), `tests/edge/handlers/marketplace/{list,update,info,remove,autoupdate}.test.ts`
  (5 files), and — crossing a top-level test-suite boundary entirely —
  `tests/orchestrators/plugin/{list,info}.test.ts` (2 files). Per the
  organization rule ("Fakes, seeds, contracts, and fixtures sit next to the
  tests of their concern... a generic dumping ground is a finding"), a file
  that already serves two sibling directories from their shared parent, and
  additionally reaches into a completely different layer's test tree
  (`tests/orchestrators/` importing test support from `tests/edge/`), has
  outgrown any single "concern" location. At minimum, stop the
  `tests/orchestrators/plugin/` imports (an orchestrator-layer test importing
  edge-layer test support inverts the same layering the production code
  enforces one level up); if the seed's job is really "build a
  `state.json`/`claude-plugins.json` fixture," it belongs near the layer
  whose shapes it encodes — e.g. `tests/persistence/marketplace-seed.ts` (it
  already imports only from `persistence/config-io.ts` and
  `persistence/state-io.ts`) — with all 15 current importers updated to the
  new path.

- **[WARNING] `SeededRecordInput` has no top-level doc comment** — `line 32`.
  Every field is individually documented but the interface itself is not;
  its sibling exports (`SeededResources`, and the four functions) all open
  with a one-line summary. Add one sentence above `export interface
  SeededRecordInput {` describing what it feeds (the raw shape
  `buildInstalledPluginRecord` turns into a persisted plugin record).

### Clean files

- `tests/edge/handlers/shared.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/edge/handlers/tools.ts`

- **[WARNING] Inconsistent, partly-absent error handling for `state.json`
  read failures across the two registered tools** — `registerListMarketplacesTool`
  (lines 76–123) has no `try`/`catch` anywhere in its `execute` body, so a
  `loadVisibleMarketplaces` throw (line 89, e.g. an unsupported schema
  version — the exact failure mode the sibling test at lines 1478–1506
  proves is reachable) propagates as an unhandled rejection instead of the
  graceful `{ content: [...], isError: true, ... }` shape the module's other
  tool produces for the same failure class. `registerListPluginsTool` (lines
  501–583) is only partly better: its `try` block starts at line 540, but
  the `marketplaceExists` pre-check at line 521 (which also calls
  `loadVisibleMarketplaces` under the hood) runs unguarded before it. Either
  document why these two paths are deliberately excluded from the graceful
  contract the payload-load path implements, or widen both to cover the
  marketplace-visibility read too, so "a state.json read fails" has one
  answer across the whole module instead of three different ones depending
  on which line of code hits it first.

- **[WARNING] `ToolFilterBuckets`'s single-letter fields are opaque to a new
  reader** — `lines 260–265` (`i`, `a`, `u`, threaded through `applyFilter`
  at lines 267–284, `statusKey` at lines 286–295, and
  `buckets[statusKey(status)]` at line 479). Nothing in the interface's own
  doc comment (lines 249–259) spells out that `i`/`a`/`u` stand for
  installed/available/unavailable — a reader has to reverse-engineer it from
  `loadToolPluginPayload`'s `buckets.i && { installed: true }` usage 80 lines
  away. Rename the fields (and `statusKey`'s return-type literals) to
  `installed`/`available`/`unavailable` for a mechanical, behavior-preserving
  readability fix.

- **[WARNING] Several exported/documented functions open their JSDoc with an
  imperative verb instead of the required third-person form** — `line 149`
  ("Project the `PluginNotificationMessage` status set..." on
  `projectRowStatus`), `line 353` ("Read `p.scope` defensively..." on
  `pluginScopeOrFallback`), `line 376` ("Read `p.reasons` defensively..." on
  `pluginReasons`), `line 426` ("Read `p.version`..." on `pluginVersion`).
  Google style: "Method descriptions begin with a third-person verb phrase."
  Reword to "Projects...", "Reads...".

- **[WARNING] Uncommented type assertion** — `line 106`:
  `const source = record.source as ParsedSource;`. `MarketplaceRecord.source`
  is typed `unknown` at its origin (`persistence/state-io.ts`'s
  `STATE_SCHEMA` declares `source: Type.Unknown()`), so this cast has no
  runtime check backing it at the call site and no comment explaining why it
  is safe. This is not unique to this file — the identical, identically
  uncommented cast appears in `orchestrators/marketplace/update.ts:402`,
  `orchestrators/marketplace/info.ts:59`, and
  `orchestrators/plugin/update.ts:295` — so a one-file fix here would be
  inconsistent with the rest of the codebase. Worth a comment at each site
  (or, better, a follow-up to type `loadState`'s returned `source` field as
  the validated `ParsedSource` once, at the loader) rather than five
  separate silent casts, but that is a cross-cutting change beyond this
  file.

### `extensions/pi-claude-marketplace/edge/handlers/shared.ts`

- **[WARNING] JSDoc opens with a noun phrase, not a third-person verb** —
  `line 28`: "Position-independent `--local` flag scanner. Walks the
  tokenised args, ...". Google style wants the description to begin with a
  third-person verb phrase (e.g. "Scans args for `--local`..."). Low-value
  fix but mechanical.

### Clean files

*(none beyond the note above — both files are otherwise sound: explicit
return types throughout, no hidden dependencies, no module-level mutable
state, no `!`/`as any`, correct `catch (err)` narrowing via `errorMessage()`
in `tools.ts`.)*

## Not covered

- Did not run `npm run check`, `node --test`, or `npm run test:coverage:direct`
  per the diagnostic-review constraint (tree must stay untouched); the
  coverage claims above (e.g. the untested `state.json`-failure paths) are
  based on static reading of every test case's `params`/fixture combination,
  not an instrumented coverage report.
- Did not verify, at the `@earendil-works/pi-coding-agent` host level,
  whether a rejected `execute()` promise from a registered tool is caught
  generically upstream and converted into a tool-error surface regardless of
  this module's own `try`/`catch` placement. If the host already does this,
  the production-code finding above is a message-consistency issue rather
  than an unhandled-rejection risk; the test-coverage BLOCKER stands either
  way, since no case currently proves the actual behavior.
- Did not review `tests/edge/notification-boundary.ts` as a first-class
  target (it is imported by `shared.test.ts` but lives one level above
  `tests/edge/handlers/`, outside this assignment's file list); its
  `createNotificationBoundary` factory was read only far enough to confirm
  `shared.test.ts` uses it correctly (`exactParams: true`, explicit
  `verify()` via `verifyBoundary()`, zero-count-as-unstated-expectation
  convention).
