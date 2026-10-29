# Phase 2: Apply Ordering and Installed Declarations - Pattern Map

**Mapped:** 2026-10-26
**Files analyzed:** 22 source files modified (0 new source files), 6 feature files, ~16 paired test files
**Analogs found:** 22 / 22 (every change lands in an existing file; analogs are sibling functions in the same or adjacent file)

Paths below are relative to `extensions/pi-claude-marketplace/` unless they start with `features/` or `test/`. All are git-tracked.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `orchestrators/reconcile/apply.ts` (`applyPlan`, `convergeScope`, `refreshTogglePlan`, new `createScopeDependencyInstall`) | orchestrator driver | batch / request-response | same file: `applyPlan` 1128-1145, `convergeScope` 1165-1217, `applyDependencyInstalls` 657-737, `createApplyReconcile` 1921-1927 | exact |
| `orchestrators/reconcile/convergence.ts` (shared planner, `releaseOnLandedMoves`, `installedCopyDeclarations` root) | service (planner) | transform | `pending.ts` `withPlannedInstallsLanded` 321-350 (moves here); `judgePlannedScope` 814-872 (`scheduled` computation 838-842) | exact |
| `orchestrators/reconcile/dependency-verdict.ts` (`scheduled` option, `releasableDependents`, comment 35-42) | service (verdict) | transform | same file `judgeFinalScope` 587-594 / `propagateUnsatisfied` 299-328 | exact |
| `orchestrators/reconcile/read-pass.ts` (shared planner; narrow bucket read export) | service (locked read) | request-response | same file `readPassForScope` replan at 238 | exact |
| `orchestrators/reconcile/pending.ts` (consume shared planner) | orchestrator | request-response | own lines 512-539 | exact |
| `orchestrators/reconcile/notify.ts` (pending row order) | renderer/projection | transform | `buildReconcilePendingNotification` 715-770, `pushConvergence` 315-340 | exact |
| `orchestrators/reconcile/types.ts` (`ScopeReadResult.enablesAfterInstalls`) | types | — | `deferredEnables` field, `PlannedDependencyInstall` 189-197, `ScopeReadResult` 424-449 | exact |
| `orchestrators/plugin/dependency-index.ts` (installed-first reader + detail walk, D-PL2-12 root, D-PL2-05 comments) | service (reader) | file-I/O | same file `readRecordDeclarations` 249-297, `readInstalledCopy` 304-319, `buildScopeDeclarationDetail` 360-377 | exact |
| `orchestrators/plugin/dependency-declaration-read.ts` (manifest symlink check D-PL2-13, doc) | utility (containment) | file-I/O | same file `isInsideAnyRoot` 347-362, `readInstalledCopyDeclaration` 373-388 | exact |
| `orchestrators/plugin/update-constraint-gate.ts` (`REAL_UPDATE_CONSTRAINT_SEAM`) | seam binding | request-response | own 82-86 | exact |
| `orchestrators/plugin/enable-disable.ts` (`enableCascadeLookup` reader swap only) | orchestrator helper | file-I/O | own 632-660 | exact |
| `orchestrators/types.ts` (new `ScopeDependencyInstallFn`) | types (seam) | — | `PluginUpdateFn` 600-611, `UpdateDependencyRow` 330-334 | exact |
| `orchestrators/marketplace/add.ts` (optional seam option + call after settle) | orchestrator ledger | request-response | own `AddMarketplaceOptions` 186-216, settle/notify 1094-1122 | exact |
| `orchestrators/marketplace/add.messaging.ts` (`installed` row policy) | messaging config | — | `orchestrators/marketplace/update.messaging.ts` 35-42 (`UPDATE_CONTEXT`) | exact |
| `orchestrators/marketplace/update.ts` (seam after `cascadeAutoupdates`) | orchestrator ledger | batch | own `cascadeAutoupdates` 566-600 + `pluginUpdate` option 187/224/333 | exact |
| `orchestrators/plugin/bootstrap.ts` (thread seam into `addOptions`) | composer | request-response | own 97-110 (`gitOps` threading) | exact |
| `edge/types.ts` (`EdgeDeps` member) | types (DI) | — | `applyReconcile` / `beginPluginUpdateRun` members 36-49 | exact |
| `edge/register.ts` | wiring | — | `makeMarketplaceUpdateHandler({...})` 141-145 | exact |
| `edge/handlers/marketplace/add.ts` | edge handler | request-response | own `Pick<EdgeDeps, "completionCache" \| "gitOps">` 29-52 | exact |
| `edge/handlers/marketplace/update.ts` | edge handler | request-response | own 37, 59-80 (`pluginUpdate` threading) | exact |
| `edge/handlers/plugin/bootstrap.ts` | edge handler | request-response | `edge/handlers/marketplace/add.ts` Pick pattern | exact |
| `index.ts` | composition root | — | own 90-91 (`createApplyReconcile`) and 211-222 (`registerClaudePluginCommand` deps) | exact |

Features (cucumber) and tests are mapped in their own sections below.

## Pattern Assignments

### `orchestrators/reconcile/apply.ts` (driver reorder, D-PL2-01/16)

**Current order to change** (`applyPlan`, 1128-1145):
```typescript
  await applyPluginUninstalls(opts, plan, outcomes);
  await applyMarketplaceRemoves(opts, plan, outcomes);
  await applyMarketplaceAdds(opts, plan, outcomes);
  const installed = await applyPluginInstalls(opts, plan, outcomes);
  const satisfied = await applyDependencyInstalls(opts, plan, outcomes);   // <- moves into convergeScope
  const toggles =
    installed || satisfied ? await refreshTogglePlan(reader, opts, round1, outcomes) : round1;
  await applyToggleSteps(opts, toggles.plan, outcomes);
  outcomes.push(...sourceMismatchOutcomes(plan));
  return toggles.deferredEnables;
```
Keep the refresh trigger `installed` only (c06). Return `{ deferred, enablesAfterInstalls, dependencyInstalls }`.

**Insertion point** (`convergeScope`, 1196-1216): inside the `try`, after `await runCascade(...)`, call a NEW extracted helper (cognitive ceiling 15 — do not inline) that recomputes the bucket when `reports.length > 0`, runs `applyDependencyInstalls` into a LOCAL row list, then the post-install enables. Rows must render after `cascadeRows(...)` (pushed in `finally`) and before judgement leftovers; and `ran:` must become `reports.length > 0 || landed` (Pitfall 3):
```typescript
  try {
    await runCascade(opts, cascade, { scope, deferred, before: before.state, failed, reports });
  } finally {
    ...
      judgeScopeAfterCascade(reader, opts, scope, { cascade, before, failed,
        ran: reports.length > 0, ... }),
    outcomes.push(...cascadeRows(cascade, reports, { disabled: ..., enabledAtEnd }));
  }
```

**MISS-01 loop to reuse unchanged** (`applyDependencyInstalls`, 657-700): binds `createDependencyInstallOperation(opts.hooksRouting, opts.completionCache)`, loops `plan.pluginsToDependencyInstall` with `// eslint-disable-next-line no-await-in-loop -- each install locks the scope (retries: 0)`, maps `skipped`/`installed` (one `plugin-installed` outcome per `result.members` with `dependencyInstalled: true`)/`failed`.

**New seam factory** — copy `createApplyReconcile` shape (1921-1927):
```typescript
export function createApplyReconcile(
  reader: ReconcileStateReader,
): (opts: ApplyReconcileOptions) => Promise<void> {
  return async function applyReconcile(opts: ApplyReconcileOptions): Promise<void> {
    await applyReconcileWithReader(reader, opts);
  };
}
```
`createScopeDependencyInstall(reader)` returns a `ScopeDependencyInstallFn`; it runs the narrow read-pass bucket export, filters by `declarers`, runs `applyDependencyInstalls`, maps `PerEntryOutcome` → `UpdateDependencyRow`. Note the unit test at apply.test.ts:794 ("apply.ts exposes the reconcile factory and no composed value") — the new export must be a factory too, and that test's expectation updates.

---

### `orchestrators/reconcile/convergence.ts` + `pending.ts` (shared planner, D-PL2-02/14)

**Move from `pending.ts` 321-350 into convergence.ts** (with `releasedDependents` 282-309, `independentlyDisabledKeys` 263-274):
```typescript
function withPlannedInstallsLanded(plan, verdict, state, replan): ReconcilePlan {
  if ((plan.pluginsToInstall.length === 0 && plan.pluginsToDependencyInstall.length === 0) || !verdict.ok) {
    return plan;
  }
  const installed = new Set([...plan.pluginsToInstall, ...plan.pluginsToDependencyInstall]
    .map((install) => `${install.plugin}@${install.marketplace}`));
  const released = releasedDependents(verdict.unsatisfied, installed, state);
  const fresh = replan({ ok: true, unsatisfied: verdict.unsatisfied.filter((e) => !released.has(e.dependent)) });
  return { ...plan, pluginsToEnable: fresh.pluginsToEnable,
    pluginsToDisable: fresh.pluginsToDisable, pluginsToDependencyDisable: fresh.pluginsToDependencyDisable };
}
```
`withoutDisabledDependents` (pending.ts:358-366) stays in pending.ts. D-PL2-14: `releasedDependents` must treat a record the plan enables as not independently disabled.

**`scheduled` set** — copy `judgePlannedScope` computation (convergence.ts:838-842) into `releaseOnLandedMoves` (879-903) and pass to `verdictAfterMoves` (see RESEARCH "Release loop with scheduled installs").

**Single-root containment (D-PL2-12)** at `installedCopyDeclarations` (436-455), replace:
```typescript
    ownerRoots: [mp.marketplaceRoot, input.locations.pluginClonesDir],
```
with `record.resolvedSha !== undefined ? [pluginClonesDir] : [mp.marketplaceRoot]`. Same change in dependency-index.ts:314-318; factor one helper (exported from dependency-index.ts or dependency-declaration-read.ts) to avoid a fallow clone group. `isPinnedCopy` (906-916) is the existing resolvedSha/plugin-clones analog.

---

### `orchestrators/reconcile/dependency-verdict.ts`

Add `readonly scheduled?: ReadonlySet<string>;` to `ScopeSatisfactionOptions` (70-83) with a `/** D-PL2-02: ... */` doc, forward it as `judgeFinalScope` does (587-594) into `propagateUnsatisfied(..., options.scheduled)`. `releasableDependents` (439-460) gains a `scheduled` argument so a `missing` entry naming a scheduled key does not block. Add `// D-PL2-05: ...` at the early return 576-579; rewrite comment 35-42 ("disables it on the next reload" is stale, APL-D1).

---

### `orchestrators/reconcile/notify.ts` (pending order, Pattern 1 E)

Today `pluginsToDependencyInstall` shares the install loop (722) that precedes `pushConvergence(byMp, convergence)` (768). Split: keep `plan.pluginsToInstall` in the loop; render dependency installs after the moves and before holds/declines. `pushConvergence` (315-340) has three loops (moves, holds, declines) — split it into `pushMoves` and `pushHoldsAndDeclines`, then call: installs → uninstalls → disables → enables → moves → dependency installs → `enablesAfterInstalls` → holds/declines. Row shape for install: `{ status: "will install", name: o.plugin, ...(force && { partial: true }) }`.

---

### `orchestrators/reconcile/types.ts`

Add `readonly enablesAfterInstalls: readonly PlannedPluginEnable[]` next to `deferredEnables` on `ScopeReadResult` (424-449) and on `MoveCascade` (convergence.ts:743-753). Follow the "Optional-field silent-omission" memory: prefer a required field so every constructor is forced to supply it.

---

### `orchestrators/plugin/dependency-index.ts` (installed-first reader, D-PL2-06/12/13)

**Analog — fallback target and record shape** (`readRecordDeclarations` 249-297 returns `RecordDeclarations` `{ ok: true, declared, delisted? }` or `unreadableDeclarer(key, reason, phrase)`). Map the installed copy's `found` arm the same way:
```typescript
  return {
    ok: true,
    declared: read.dependencies.map((dep) => ({ ...dep, marketplace: dep.marketplace ?? marketplace.name })),
    ...(declared.kind === "absent" && { delisted: true }),
  };
```
`unusable` → `unreadableDeclarer(key, "ownManifest" in read ? "unreadable manifest" : "invalid manifest", read.detail)`; `absent` → fall through to `readRecordDeclarations`.

**Walk to parametrize** (`buildScopeDeclarationDetail` 360-377):
```typescript
  for (const marketplace of Object.values(options.state.marketplaces)) {
    for (const name of Object.keys(marketplace.plugins)) {
      // eslint-disable-next-line no-await-in-loop -- the first unreadable record stops the index
      const read = await readRecordDeclarations(options, marketplace, name);
      if (!read.ok) { return read; }        // D-PL2-05 comment here
      declarations.set(`${name}@${marketplace.name}`, read.declared);
    }
  }
```
Make a private walk taking the per-record reader; export `buildScopeDeclarationDetail` and `buildInstalledScopeDeclarationDetail` over it (fallow dupes otherwise fails).

---

### `orchestrators/plugin/dependency-declaration-read.ts` (D-PL2-13)

`isInsideAnyRoot` (347-362) uses `await assertPathInside(ownerRoot, pluginRoot, "installed plugin copy")` in a try/catch loop. Add, in the installed-copy path only, `assertPathInside(pluginRoot, candidate, ...)` for each `MANIFEST_CANDIDATES` entry (domain/manifest-path.ts:43-46) before `readOwnManifest`; a refusal answers `OWN_MANIFEST_REFUSAL` or `absent` (decide; both fail closed upstream of the walk). Update the JSDoc at 364-372 ("inside one of `ownerRoots`" → one owning root).

---

### `orchestrators/plugin/update-constraint-gate.ts`

Swap one member (82-86):
```typescript
const REAL_UPDATE_CONSTRAINT_SEAM: UpdateConstraintSeam = Object.freeze({
  buildScopeDeclarationDetail,          // -> buildInstalledScopeDeclarationDetail
  probeDependencyTags,
  probeMarketplaceTags,
});
```
Do NOT touch `constraint-fold.ts` (Phase 3).

### `orchestrators/plugin/enable-disable.ts`

One-line swap at 645: `readRecordDeclarations({ state, locations }, marketplace, subject.name)` → the installed-first reader. Keep the `isDelistedRead` root exemption (646-648) and the `EnableRefusedError("unreadable", read.cause.message)` throw.

---

### `orchestrators/types.ts` (seam type)

Copy `PluginUpdateFn` (600-611) form, doc-commented with the decision ID:
```typescript
/**
 * D-05 function-injection seam. ... `orchestrators/plugin/update-flow.ts`
 * ships the real composed operation; tests inject a mock. The
 * `index.ts` barrel performs the registration-time wiring.
 */
export type PluginUpdateFn = (
  plugin: string,
  marketplace: string,
  scope: Scope,
) => Promise<PluginUpdateOutcome>;
```
New: `export type ScopeDependencyInstallFn = (args: { ctx; run; scope; cwd; dependents?: (key: string) => boolean }) => Promise<readonly UpdateDependencyRow[]>;` reusing `UpdateDependencyRow` (330-334).

---

### `orchestrators/marketplace/add.ts` + `add.messaging.ts`

Option analog (186-216): each optional seam is `readonly gitOps?: GitOps;` with a decision-ID doc. Add `readonly installMissingDependencies?: ScopeDependencyInstallFn;`.

Call site: after `await settleAddedMarketplace({...})` (1097-1102), inside `if (!orchestrated)` before building `addedRows` (1104-1119); put returned rows into `plugins: []`:
```typescript
    const addedRows: Single<MarketplaceRows<never>> = [
      { name: recordedName, scope: opts.scope, status: "added", plugins: [] },
    ];
    notifyWithContext(opts.ctx, opts.run, ADD_CONTEXT, addedRows, undefined, "single");
```
The `MarketplaceRows<never>` type parameter widens to the row statuses added. Never on the `alreadyAdded` arm (1076-1092) nor inside `runAddInGuard` (lock rule CR-01).

`ADD_CONTEXT` (add.messaging.ts:18-23) — copy `UPDATE_CONTEXT`'s `installed: { markers: true, contentReasons: true }` and widen `CommandContext<"failed">` to `CommandContext<"failed" | "installed">` (plus `partially-installed`/`updated` if the seam can return them). Update the header comment (lines 10-14 say `failed` is the only status).

### `orchestrators/marketplace/update.ts`

Seam analog: `readonly pluginUpdate?: PluginUpdateFn;` on the three option interfaces (187, 224, 333) and `cascadeAutoupdates(snapshot, name, scope, pluginUpdate)` (566-600), which early-returns when `!snapshot.autoupdate || pluginUpdate === undefined`. Add the MISS-01 call after it (update.ts:815) with the same guard, `dependents` filtered to declarers in marketplace `name`; append rows to the cascade block's plugins (904-907).

### `orchestrators/plugin/bootstrap.ts`

Add `installMissingDependencies: opts.installMissingDependencies` (conditional spread) into `addOptions` (97-110) beside `gitOps: opts.gitOps`, and to `BootstrapOptions`.

---

### Edge wiring (`edge/types.ts`, `edge/register.ts`, handlers, `index.ts`)

`EdgeDeps` member analog (edge/types.ts):
```typescript
  /** APL-01: the reconcile apply step that `/claude:plugin apply` runs. */
  readonly applyReconcile: (opts: ApplyReconcileOptions) => Promise<void>;
```
Add `/** D-PL2-09: ... */ readonly installMissingDependencies: ScopeDependencyInstallFn;` (required, like `applyReconcile`).

Handler Pick (edge/handlers/marketplace/add.ts:29-52):
```typescript
export function makeAddHandler(
  deps: Pick<EdgeDeps, "completionCache" | "gitOps">,       // + "installMissingDependencies"
): SubcommandHandler {
  ...
    await addMarketplace({ ctx, run, scope: opened.scope ?? "user", cwd: ctx.cwd,
      rawSource: opened.source, completionCache: deps.completionCache, gitOps: deps.gitOps,
      ...(opened.local && { local: true }) });
```
Same for `edge/handlers/plugin/bootstrap.ts` and `edge/handlers/marketplace/update.ts` (Pick at 37; forwarded at 67 and 80 next to `pluginUpdate`).

register.ts (141-145) passes an explicit object, so add the member there:
```typescript
    marketplaceUpdate: makeMarketplaceUpdateHandler({
      completionCache: deps.completionCache,
      gitOps: deps.gitOps,
      beginPluginUpdateRun: deps.beginPluginUpdateRun,
    }),
```
`makeAddHandler(deps)` and `makeBootstrapHandler(deps)` (122, 137) receive full deps — no edit.

index.ts: next to line 90 `const applyReconcile = createApplyReconcile({ loadState });` add `const installMissingDependencies = createScopeDependencyInstall({ loadState });` and add it to the deps literal at 213-218 (`{ completionCache, mcpStatus, gitOps: DEFAULT_GIT_OPS, beginPluginUpdateRun: ..., applyReconcile }`). Extend the comment block 82-89.

## Cucumber Scenario Analogs

| New/changed scenario | File | Copy from |
|---|---|---|
| PENDMOVE-01 (pending == apply rows, second pending empty) | `features/plugin/apply.feature` | "Pending lists the disable of a plugin whose dependency a config drops, as apply makes it" (749-777): pending table then apply table then record table; dependency-cell fixture from "Apply moves a chain of three plugins..." (779+) using `lib@^2.0.0` |
| MISSORDER-01 | `features/plugin/apply.feature` | same two scenarios |
| RCN-03 retitle | `features/plugin/apply.feature:749` | — (mutation check only) |
| Enable follows installed copy (git) | `features/plugin/enable.feature` | "Enabling a plugin enables its disabled dependency too" (169-200) for the disable/enable steps and result tables; git fixture from update-dependencies.feature:164-198 (`the git repository "lib" holds these plugins:` + `the marketplace "tools" offers these plugins from git repositories:` `| name | source kind | repository | pinned |`) |
| Update held by installed holder range | `features/plugin/update-dependencies.feature` | 164-198 (git dependency move) and the `{dependents constrain}` cause-chain columns there |
| Autoupdate installs missing dependency after updates | `features/plugin/update-dependencies.feature` | "Autoupdating a marketplace installs the dependency a plugin's new version needs" (137-162): `the results list these marketplaces and plugins:` with `zcore@tools ... installed` row. Re-offer dependent at SAME version (RESEARCH fixture note) |
| `marketplace add` installs missing dep | `features/marketplace/add.feature` | Outline at 7 for add assertions; `the marketplace "X" allows dependencies on the marketplace "Y"` from features/marketplace/remove.feature:640 |
| bootstrap installs missing dep | `features/plugin/bootstrap.feature` | 7-25 (`published as the official marketplace`, `the command reports these results:`, `the results list these marketplaces and plugins:`) |

Rules: `.agents/skills/cucumber` (lower-case steps, Given/When/Then, whole-table compares, one behavior per scenario, `npm run check:features`). Expected rows for T1/T2 are in RESEARCH §Traces. No new step definitions are expected.

## Unit Test Analogs (source-test pairing, 100% direct coverage)

| Test file | Case shape to copy |
|---|---|
| `test/orchestrators/plugin/dependency-index.test.ts` | "DLS-01 / NFR-10: a delisted git-source record reads its copy under the scope's plugin clones" (893-917): `marketplaceRecord("mp", { app: { resolvedSource: clone } })`, `manifestLoader`, `ownManifests({ [path]: JSON.stringify({ dependencies: [...] }) })`, `// arrange // act // assert`, `assert.deepStrictEqual(read, {...})`. Pitfall 6: this fixture's record lacks `resolvedSha` and must gain it. Add RCN-08 fail-closed cases and installed-first found/unusable/absent arms here. Early-return pins at :596, :743 get the D-PL2-05 citation. |
| `test/orchestrators/plugin/dependency-declaration-read.test.ts` | single-root and symlinked-manifest refusal cases |
| `test/orchestrators/reconcile/apply.test.ts` | "MISS-02: a dependency whose closure fails reports on its own row and the dependent is held down" (5729-5790): `createHermeticScopes`, `writeMarketplaceSource`, `seedState`, `createNotificationBoundary(1)`, `createOfflineGitOps()`, `applyReconcile({ ctx, run: runWithNothingLoaded(), cwd, scope: "project", gitOps })`, whole-message `deepStrictEqual`. Rewrite 6163-6235 (Pitfall 4); keep NFR-5 call-count case 6691-6778 green; update 794 for the new factory. |
| `test/orchestrators/reconcile/convergence.test.ts` | receives the moved `withPlannedInstallsLanded`/`releasedDependents` coverage from pending.test.ts |
| `test/orchestrators/reconcile/pending.test.ts`, `notify.test.ts` | D-21 table; Pitfall 5 case "a dependency the user disabled, the config enables and the check holds down" changes per D-PL2-14 |
| `test/orchestrators/reconcile/dependency-verdict.test.ts` | `scheduled` cases; :999 early-return pin |
| `test/orchestrators/plugin/enable-disable.test.ts`, `update-constraint-gate.test.ts` | installed-copy reader cases |
| `test/orchestrators/marketplace/update.test.ts` | `const pluginUpdate: PluginUpdateFn = async (plugin, marketplace, scope) => { events.push(...); return {...} }` then `updateMarketplace({ ..., pluginUpdate })` and `assert.deepStrictEqual(events, [...])` (395-470) — copy for a fake `ScopeDependencyInstallFn` recording calls + ordering after updates |
| `test/orchestrators/marketplace/add.test.ts`, `test/orchestrators/plugin/bootstrap.test.ts` | same fake-seam style; add uses `strong-mock`, `createGitOpsFake`, `createJsonCapture`, `createHermeticEnvironment` (imports 1-67) |
| `test/edge/register.test.ts` (369-372), `test/edge/handlers/marketplace/update.test.ts` (92, 301), `.../add.test.ts`, `.../plugin/bootstrap.test.ts`, `test/index.test.ts` | add `installMissingDependencies: () => Promise.resolve([])` to every EdgeDeps literal, as `applyReconcile: (): Promise<void> => {...}` is |

## Shared Patterns

- **Injected seam over import** (BLOCK C + add→operations→install-outcome→add cycle): type in `orchestrators/types.ts`, factory in the owning orchestrator, composed once in `index.ts`, threaded `EdgeDeps` → handler `Pick` → orchestrator options as an optional member. Source: `PluginUpdateFn` / `beginPluginUpdateRun` path.
- **Sequential awaits under per-call locks**: `// eslint-disable-next-line no-await-in-loop -- <reason>` on every loop await (apply.ts:668, update.ts:579, dependency-index.ts:366).
- **Fail closed** (D-05-07 / D-PL2-05): readers return `{ ok: false }`/`unreadableDeclarer(...)` and walks return on first failure.
- **Containment**: `assertPathInside(root, path, label)` from shared path-safety; one owning root per record keyed on `resolvedSha`.
- **Output**: only `notifyWithContext(ctx, run, <CMD>_CONTEXT, rows, undefined, "single")`; row status policies per command in `*.messaging.ts`.
- **Conditional spreads for optionals** (`exactOptionalPropertyTypes`): `...(x !== undefined && { x })`.
- **Complexity**: `convergeScope`/`applyPlan` are near cognitive 15 in both ESLint and fallow — extract the post-cascade block into its own function.
- **Comments** cite D-PL2-NN / NFR IDs, never phase numbers.

## No Analog Found

None. Every change extends an existing function or mirrors a sibling seam.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{index.ts,edge,orchestrators}`, `features/{plugin,marketplace}`, `test/{orchestrators,edge}`
**Files scanned:** ~30
**Pattern extraction date:** 2026-10-26
