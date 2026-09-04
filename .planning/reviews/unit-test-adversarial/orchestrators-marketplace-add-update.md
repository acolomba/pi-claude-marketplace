# Orchestrators — marketplace add and update (git-source paths)

**Scope:** `tests/orchestrators/marketplace/{add,update}.test.ts`,
`tests/orchestrators/marketplace/{add,update}.messaging.test.ts`, paired against
`extensions/pi-claude-marketplace/orchestrators/marketplace/{add,update}.ts` and
`{add,update}.messaging.ts`.
**Test files reviewed:** 4
**Production modules reviewed:** 4

## Summary

`add.test.ts` and the messaging suites are the strongest work in this area: hermetic
`mkdtemp` scopes, `strong-mock`-based `ctx`/`pi` doubles with `exactParams` and
`verify()`, whole-message `assert.deepStrictEqual`/exact-string checks, and thorough
coverage of every staging/rename/cleanup rollback branch in `add.ts` (duplicate-name,
stale-clone, invalid-manifest, post-rename state-mutation failure, config-write-back
failure, and `tx.save()` failure, each with its own case). `update.messaging.test.ts`
is exemplary: every `outcomeToCascadePluginMessage` partition and every
`UPDATE_CONTEXT.render` arm is checked against a hand-written full object/string,
with severity asserted every time. No test in either orchestrator file performs a
real clone or fetch.

`update.test.ts` (2963 lines, the largest file in this area) diverges from its
sibling in two systemic ways a fixing pass should attack first: (1) its `ctx`/`pi`
doubles are hand-rolled plain objects behind `as ExtensionContext`/`as ExtensionAPI`
casts instead of `strong-mock`, even though `notify()` is exactly the "public
behavior" interaction the project's own rules say must go through the sanctioned
mock library; and (2) from roughly its midpoint on, many cases assert only a
`assert.match`/`assert.doesNotMatch` fragment of the rendered notification instead
of the whole-message `deepStrictEqual` pattern used everywhere else in the file and
in `add.test.ts` — a handful of these cases have no other assertion at all. A third,
minor theme: three call sites (two in `update.test.ts`, one in `add.test.ts`) omit
`gitOps` entirely and fall through to the real `DEFAULT_GIT_OPS`; this is provably
safe today (the exercised code paths never reach a `GitOps` method) but is fragile
test hygiene given the project's explicit NFR-5 network-boundary concern.

## Unit test findings

### `tests/orchestrators/marketplace/add.test.ts`

- **[WARNING] One case falls through to the real `DEFAULT_GIT_OPS`** — `test('accepts a path marketplace through the offline default Git port')`, line 656.
  The call to `addMarketplace` omits `gitOps` entirely, so `opts.gitOps ?? DEFAULT_GIT_OPS`
  resolves to the real `platform/git.ts` implementation. It is safe today because a
  path-source add never calls any `GitOps` method — but if a future regression made
  the path branch reach `gitOps.clone`, this test would attempt a real network
  operation instead of failing cleanly against a fake. Inject `createGitOpsFake({boundary: "memory"})`
  explicitly here, the same as every other case in the file, even though the fake is
  expected to see zero calls.
- **[WARNING] Weak error-identity assertion in an orchestrated-mode duplicate of a covered scenario** — `test("RECON-03 orchestrated mode -- unsupported source returns { status: 'failed', reason: 'unsupported source' } with ZERO notify calls")`, lines 1421-1449.
  The only checks on the returned error are `assert.ok(outcome.error instanceof Error)`
  and a non-empty `cause` string. Compare with the stronger sibling pattern at lines
  568-590 (`rejects a marketplace-level ... source`), which builds the exact expected
  `UnsupportedSourceError` and does `assert.deepStrictEqual(outcome, {..., error: expectedError, ...})`.
  Rewrite this case the same way: construct the expected `UnsupportedSourceError` for
  the "git@github.com:foo/bar.git" scp-style source and compare the whole outcome
  object, so a wrong implementation that returns a different error class or message
  cannot pass.
- **[WARNING] Narration comments mixed into the assert phase** — representative: lines 261-262, 275-277, 285-287, 439, 450-451, 604-605 (`// gitOps.clone called exactly once...`, `// State has the recorded marketplace...`, `// Exactly one notification, byte-for-byte...`), and similar single-line narrations immediately before `// assert` in roughly a dozen other cases. The unit-testing rule permits only `// arrange`/`// act`/`// assert` phase markers plus comments where "setup is not obvious" — these narrate what the following assertion already states in code. Most cite decision IDs and explain *why*, which is lower-priority than a bare restatement, so leave the ones that add rationale and delete the ones that only restate the next line (e.g. line 261 `// gitOps.clone called exactly once with correct URL.` directly above `assert.equal(state.cloneCalls.length, 1)`).

### `tests/orchestrators/marketplace/update.test.ts`

- **[WARNING] `ctx`/`pi` doubles are hand-rolled objects behind a type assertion instead of `strong-mock`** — `makeCtx()`, lines 177-190, used by essentially every one of the ~90 cases in the file.
  ```ts
  const ctx = {
    ui: { notify(message: string, severity?: Severity): void { notifications.push(...); } },
  } as ExtensionContext;
  const pi = { getAllTools: (): ReturnType<ExtensionAPI["getAllTools"]> => [] } as ExtensionAPI;
  ```
  `notify(...)` is exactly the kind of "public behavior" interaction (notifying) the
  testing rules and this project's own convention (`strong-mock` is "the sanctioned
  interaction-mock library") require a mock for, and `add.test.ts`'s `makeCtx` in the
  same directory already does this correctly with `mock<ExtensionContext>({exactParams: true, ...})`,
  `when()`, `.times(...)`, and `verify()`. The hand-rolled version here loses the
  `exactParams` guarantee (no proof `ctx.ui`/`pi.getAllTools()` aren't called with
  extra/wrong arguments or an unexpected number of times) and the `as ExtensionContext`
  / `as ExtensionAPI` casts are exactly the "broad cast hiding an invalid double" the
  Types section warns about. Port `add.test.ts`'s `makeCtx` into this file (or extract
  it to a shared test-support module beside the marketplace test concern) and use it
  here too.
- **[BLOCKER] Fragment/regex message assertions let a garbled message pass** — representative and worst cases:
  - `test("MU-9 + MSG-RH-1: success emits canonical reload hint trailer for updated plugins")`, lines 1733-1777: the *entire* assertion block is `assert.ok(first !== undefined)` plus `assert.match(first.message, /\/reload to pick up changes$/)`. Nothing checks the header, the per-plugin rows, or severity, even though the test seeds two plugins. A wrong implementation that renders the wrong header, drops a plugin row, or emits the wrong severity — as long as the string ends with the reload-hint substring — passes.
  - `test("SC-6 / MU-1: updateAllMarketplaces (no scope) processes user-scope marketplace")`, lines 2210-2256: asserts `notifications.length >= 1` (not an exact count), `combined.includes("user-mp")`, and "no error notification" — a wrong implementation emitting extra spurious rows, the wrong scope bracket, or the wrong status token for `user-mp` still passes.
  - `test("refreshRecord: unsupported source kind surfaces as notifyError (lines 219-222)")`, lines 2348-2396: checks `severity === "error"` and `message.includes("unsupported source kind")` only — the exact row shape and header text are unpinned.
  - Same weak-fragment shape recurs at lines 677-686, 711-712, 907-933, 936-963, 1006-1017, 1052-1055, 1150-1151, 1185-1186, 1219, 1257-1258, 1426, 1499, 1880-1886, 2080-2089, 2126-2128, 2161-2169, 2201-2205 — roughly twenty cases past the file's midpoint, versus the whole-message `assert.deepStrictEqual(notifications, [...])` pattern the first ~500 lines of this same file and all of `add.test.ts` use consistently.

  Fix: replace `assert.match`/`assert.doesNotMatch` fragments with
  `assert.deepStrictEqual(notifications, [{ message: "<hand-written full string>", severity: "..." }])`
  wherever the full message is a short, stable, single-marketplace row (most of the
  cases above render 1-3 lines total, so this is mechanical). Where a case
  legitimately only wants to prove one property in isolation (e.g. "no retry hint"),
  keep the negative `doesNotMatch` but add the positive full-message check alongside
  it rather than leaving the negative check as the only assertion.
- **[WARNING] Missing state-side assertion on a partial-refresh failure** — `test("MU-5: clone advances + manifest re-validation fails -- 'Retry the command.' retry hint")`, lines 966-1018.
  The scenario is specifically "the clone advanced, then validation failed" — a
  rollback-adjacent case — but the assertions only check the rendered notification.
  Add a `loadState` read after the call confirming `record.lastUpdatedAt` was **not**
  bumped (the throw happens before that assignment executes) and that the persisted
  record is otherwise unchanged, mirroring the rigor of the neighboring
  `"WR-02: corrupt pre-existing manifest routes to (failed)..."` case, which does not
  check this either but is the more natural place to add it if consolidating.
- **[WARNING] Two cases fall through to the real `DEFAULT_GIT_OPS`** — `test("CMC-10 + MU-1: bare form against empty scope succeeds...")` line 536, and `test("UXG-05: path-source refresh whose local manifest is UNCHANGED renders the no-op...")` line 798, plus the multi-line call at lines 2312-2319 in `test("updateAllMarketplaces forwards optional Device Flow and plugin cascade ports")`. All three omit `gitOps`; the first has no marketplaces to refresh and the other two are path-source, so no `GitOps` method is reached today, but nothing prevents a regression from reaching for the network. Inject `makeMockGitOps()` (or an explicit `createGitOpsFake`) in all three, matching the file's own convention everywhere else.
- **[WARNING] Non-durable ticket-style test-title prefix** — `test("260525-cjr B2: cascadeAutoupdates catch -> EACCES surfaces as ...")` line 2042, and its two siblings at lines 2093 and 2131. `260525-cjr` reads as a date-plus-initials ticket/session reference, not one of the project's durable spec-ID prefixes (`D-NN`, `WR-NN`, `CR-NN`, etc.) or a GitHub issue reference. Per `.claude/rules/typescript-comments.md` ("Any other phrasing whose only purpose is to record which planning artifact authored the line"), drop the `260525-cjr B2:` prefix and keep the descriptive remainder of each title.
- **[WARNING] Minor: bypasses the project's `platform/pi-api.ts` type wrapper** — line 45, `import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";`. `add.test.ts` and the rest of the codebase import these types through `extensions/pi-claude-marketplace/platform/pi-api.ts`, the sanctioned boundary that isolates the extension from the host package's specifics. Low priority, but worth aligning for consistency.

### Clean files

- `tests/orchestrators/marketplace/update.messaging.test.ts` — every `outcomeToCascadePluginMessage` partition (`updated` clean/degraded/newly-degraded, `unchanged`, every `skipped`/`failed` notes-fallback branch) and every `UPDATE_CONTEXT.render` arm is exercised with a hand-written expected object or string, `Object.hasOwn` checks confirm optional fields are truly absent (not `undefined`-valued), input immutability is checked after each render call, and severity is asserted on every outcome-projection case. No `describe()`, no data loop, no weak assertions found.
- `tests/orchestrators/marketplace/add.messaging.test.ts` — see the dedicated note below; this file is appropriately sized for the module it tests, not a stub.

## Note on `add.messaging.test.ts` size (33 lines)

`add.messaging.ts` exports exactly one runtime value (`ADD_CONTEXT`, a literal
`{ Messaging: { label: "Marketplace add" }, render: {} }` with no functions) and one
compile-time-only type (`AddPrivateReason`). The 33-line test asserts the complete
`ADD_CONTEXT` object via `assert.deepEqual` against a hand-written literal, separately
enumerates its keys (`Messaging`, `render`) and sub-keys, and pins `AddPrivateReason`'s
membership with two `satisfies` positives and one `@ts-expect-error` negative. That is
exhaustive coverage of everything the module does — there is no logic left untested.
This is **not** a stub pair; it is proportionate to `add.messaging.ts` being a
near-data module (`marketplace add` always emits `plugins: []`, so its render map is
legitimately empty). `update.messaging.test.ts`'s 879 lines are proportionate in the
same sense to `update.messaging.ts` actually containing two narrowing functions and a
4-arm render map.

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`

- **[WARNING] Hidden `randomUUID()`/`new Date()` dependencies** — `randomUUID()` at line 646 (`addGitClonedInGuard`'s staging-dir name) and `new Date().toISOString()` at line 700 (the `lastUpdatedAt` stamp) are called inline inside business logic rather than taken as an injected dependency. Tests work around the UUID by reading the directory back off disk rather than asserting an exact name, and no test needs to control the timestamp here, so this is a design-hygiene note rather than an active test gap: make the ID generator and clock explicit parameters (or a small `dependencies` object) the next time this function's signature changes, per the "make the hidden dependency an explicit parameter" fix.
- **[WARNING] Undocumented `as { name: string }` casts** — lines 670 and 846, `(parsed as { name: string }).name`. Neither site has a comment explaining why `loadMarketplaceManifest`'s return type doesn't already expose a typed `name` field. Either add a one-line comment stating the reason (the validator returns the raw parsed JSON, not a narrowed type) or change `loadMarketplaceManifest`'s return type to carry the validated shape so the cast is unnecessary.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`

- **[WARNING] Hidden `new Date()` dependency** — line 472, `record.lastUpdatedAt = new Date().toISOString();`, same class of finding as `add.ts` above.
- **[WARNING] Undocumented `as ParsedSource` cast** — line 402, `const source = record.source as ParsedSource;`, no adjacent comment justifying why the persisted record's `source` field needs a cast to the domain union type.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`

- **[WARNING] Switch has no `default` and its own comment claims a safety net that isn't there** — `outcomeToCascadePluginMessage`, lines 129-215. The leading comment says "the switch exhausts all 4 partitions and ends with an assertNever so any future variant addition fails at compile time," but there is no `default` case and no `assertNever` call anywhere in the function — the exhaustiveness guarantee comes only from TypeScript's own control-flow narrowing over the closed `PluginUpdateOutcome["partition"]` union, which is real today but is not what the comment describes, and the Google TS style guide requires every `switch` to end with a `default` group (even an empty one) as defense-in-depth against a future 5th partition being added without updating this function. Add `default: return assertNever(outcome);` (the same helper the resolver module already uses elsewhere in the codebase) or correct the comment to stop claiming a mechanism that doesn't exist.

### Clean files

- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts`

## Not covered

- Did not run `npm run check`, `npm test`, `node --test`, or any coverage tool, per the diagnostic-review constraint in the review brief; all findings are from static reading.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (the `GitOps` interface, `refreshGitHubClone`, `resolveScopeOrNotifyNotAdded`, etc.) was read for context because both `add.ts` and `update.ts` depend on it, but it is out of this assignment's scope and has its own paired test file (`tests/orchestrators/marketplace/shared.test.ts`, reviewed elsewhere) — not scored here.
- `tests/platform/credential-ops-fake.ts`, `tests/domain/device-flow-fake.ts`, and `tests/platform/git-ops-fake.ts` were read only far enough to confirm they are genuine fakes (not real network) and to understand the collaborator contracts `add.test.ts`/`update.test.ts` inject; a full style review of those files was not performed (presumed owned by a different assignment area).
- The `_fixtures/valid-marketplace`, `_fixtures/invalid-manifest`, and `_fixtures/empty-marketplace` directories were treated as opaque static fixtures and not reviewed content-by-content.
