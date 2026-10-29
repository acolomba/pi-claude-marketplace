# Phase 7: Git Errors and Lock Discipline - Pattern Map

**Mapped:** 2026-10-26
**Files analyzed:** 22 (production + paired tests + 5 feature files)
**Analogs found:** 22 / 22. Every change is an edit to an existing file. The one exception is `collectPluginClonesLocked`, a new export in an existing file.

RESEARCH's call-site map is authoritative for production line numbers. This map adds the **analogs to copy**, mainly for tests. CONTEXT D-PL7-11..18 override RESEARCH:
- keep the thin wrappers (`classifyGitHostFailure`, `classifyGitSourceAccessFailure`, `hostHttpFailureFrame`), so the five foreign callers need no edit
- export `upgradeCandidate` from `list-installed-row.ts`; there is no new module
- the cascade attaches a cause on every arm
- `planCloneSweep`'s "before" listing also runs under the lock
- a frame goes on every HTTP status on plugin rows, 404 included

## File Classification

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `shared/git-failure-classifiers.ts` | utility (classifier) | transform | itself (private bodies become `classifyGitFailure`) | exact |
| `test/shared/git-failure-classifiers.test.ts` | test | transform | itself: table-driven `for … of [...] as const) { test(title, …) }` at :75-92 | exact |
| `orchestrators/plugin/clone-gc.ts` (`collectPluginClonesLocked`) | service | file-I/O under lock | `with-state-guard.ts::withExistingScopeLock` :147-174; `update-preflight.ts` `probeUnpinned` | exact |
| `test/orchestrators/plugin/clone-gc.test.ts` | test | file-I/O | itself :96-130 (`seedState` + `seedCloneDirectories` + `cloneEntries`) + lock holder from `fetch.test.ts:2325` | exact |
| `uninstall.ts`, `marketplace/remove.ts`, `reconcile/apply.ts`, `dependency-bindings.ts`, `update-flow.ts`/`reinstall-flow.ts` bindings | orchestrator call sites | event (post-lock cleanup) | existing `try/catch + hookDebugLog` GC sites (D-19-01) | exact |
| `update-preflight.ts` (tag-copy lock, frame) | orchestrator | request-response | `probeUnpinned` in the same file | exact |
| `test/orchestrators/plugin/update-preflight.test.ts` | test | — | itself :2459-2490 (held lock -> `StateLockHeldError`) | exact |
| `update-swap.ts` (`nextUpdateStamp`) | orchestrator | CRUD (state record) | itself :641-734, :995 | exact |
| `test/orchestrators/plugin/update-swap.test.ts` | test | — | itself: `t.mock.timers.enable` :55/:333/:440; ST-9 overlap :362-424 | exact |
| `clone-cache.ts` (`resolveFetchedRefOffline` tag fallback) | seam | file-I/O (local git) | `marketplace-tag-probe.ts:23-37` (frozen default seam over `resolveTagOid`) | exact |
| `fetch.ts`, `test/.../fetch.test.ts` | orchestrator + test | request-response under lock | `fetch.test.ts:2325-2366` (GIT-03) | exact |
| `info.ts` fetch path, `test/.../info.test.ts` | orchestrator + test | request-response under lock | same as fetch; the `readTextFile` reader seam (`info.ts:193-198`) | role-match |
| `update-flow.ts` (shared ladder, sync frame) | orchestrator | request-response | `marketplace/update.ts:415-416,504` (frame via `MarketplaceUpdateError`) | exact |
| `orchestrators/edge-deps.ts` + test | service | transform | `list-installed-row.ts::upgradeCandidate` (export it, D-PL7-16) | exact |
| `git-source-probe.ts` (+test) | deletion | — | — | n/a |
| `dependency-tag-probe.ts` | seam | request-response | the classifier call at :137 | exact |
| `marketplace/{shared,update}.ts` | orchestrator | transform | RESEARCH table rows | exact |
| `operations.ts:188` (`NODE_FETCH_STATUS`) | wiring | — | itself | exact |
| features `fetch`, `info`, `update`, `update-rollback`, `git-source-update` | cucumber | — | `fetch.feature:124-164`, `update-rollback.feature:8-32` | exact |
| `docs/output-catalog.md` | docs | — | prose only (D-PL7-18) | n/a |

## Pattern Assignments

### `clone-gc.ts` — `collectPluginClonesLocked` (GLK-03)

The module imports only fs, `loadState`, and `errorMessage` today (`clone-gc.ts:18-25`). Add `import { withExistingScopeLock } from "../../transaction/with-state-guard.ts";` in the internal group. The `orchestrators` zone may import `transaction` (precedent `uninstall.ts:91`, `fetch.ts:52`). Lock primitive signature (`transaction/with-state-guard.ts:147-150`):

```ts
export async function withExistingScopeLock<T>(
  locations: ScopedLocations,
  body: (assertLockHeld: () => void) => Promise<T>,
): Promise<T> {
```

Body: `withExistingScopeLock(locations, () => garbageCollectPluginClones(locations, keep))`. Wrap `listUnreferencedPluginClones` the same way (D-PL7-13). GC's `loadState` passes `{ persistMigration: false }`. The `clone-gc.ts` header comment (:12-15) states the module is "fs-only". Update that wording so it allows the transaction import, and keep it free of git tokens (BLOCK F).

**Test analog** (`test/orchestrators/plugin/clone-gc.test.ts:96-130`). Copy the arrange shape:
```ts
const locations = await freshLocations(t);
await seedState(locations, { alpha: marketplace(locations, "alpha", { direct: pluginRecord({ resolvedSource: path.join(locations.pluginClonesDir, "alpha-live"), resolvedSha: SHA_ALPHA }) }) });
await seedCloneDirectories(locations, ["alpha-live", "gamma-stale"]);
```
Then add the second-holder block below, and assert that `collectPluginClonesLocked` rejects `StateLockHeldError` and that `cloneEntries` still lists `gamma-stale`. Write a free-run case: `gamma-stale` is gone and `lockfile.check(...)` returns false afterwards. In wave 3, move the `describe("garbageCollectPluginClones")` cases to the locked entry point and make the unlocked GC private.

### Shared: second lock holder (GLK-03/04/05 refusal tests)

**Source:** `test/orchestrators/plugin/fetch.test.ts:2325-2366` (GIT-03). Copy it verbatim. The seam methods `assert.fail` because a held lock must reach none of them:
```ts
const release = await lockfile.lock(locations.extensionRoot, {
  lockfilePath: locations.stateLockFile,
  realpath: false,
});
// act
try {
  await fetchPlugins({ cloneCacheSeam: seam, ctx: boundary.ctx, cwd, run: boundary.run, scope: "project", target: { … } });
} finally {
  await release();
}
// assert
assert.match(boundary.notifications[0]?.message ?? "", /locked \(failed\) \{lock held\}/);
assert.deepStrictEqual(await snapshotTree(locations.pluginClonesDir), []);
```
The rejecting variant is `test/orchestrators/plugin/update-preflight.test.ts:2459-2490`:
```ts
try {
  await assert.rejects(prepare(seed, { cloneCacheSeam, onRecord: … }), StateLockHeldError);
} finally {
  await release();
}
```
Use it for GLK-04 with `pathPinProbe` set to a probe that calls `assert.fail`.

### Shared: lock held during the work (GLK-04/05)

**Source:** `test/transaction/with-state-guard.test.ts:124-131`. Inside the injected seam (`pathPinProbe`, the `FetchStatus.resolveListCandidate` double, `PluginInfoReader.readTextFile`), push the observation:
```ts
lockObservations.push(
  await lockfile.check(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  }),
);
```
After the call, assert `lockObservations` deep-equals `[true]` and that `lockfile.check` returns false. For the pinned `fetch` arm, assert `[false]`: per D-PL7-07 that arm stays unlocked.

### `update-swap.ts` + test (GLK-06)

The production change is a module-private `nextUpdateStamp(previous)`, used at the mark (:677) and at finalize (:995). See RESEARCH Pattern 6.

**Test analog:** `test/orchestrators/plugin/update-swap.test.ts:55`. The Date mock belongs to the `TestContext`, so no reset hook is needed:
```ts
t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
```
Pair it with the ST-9 overlap test at :362-424. Make the frozen `now` equal the seeded `updatedAt`, so the old code writes an identical stamp. The second swap must reject `PluginUpdateConcurrencyError` (`kind: "plugin-updated"`). Add one case where `previous` does not parse and the stamp equals `now`, and one where finalize > mark.

### `git-failure-classifiers.ts` + test (GLK-01)

**Test analog:** the same test file at :75-92. It is table-driven, and the HttpError fixture shape is duck-typed. Copy:
```ts
] as const) {
  test(title, () => {
    // arrange
    const failure = Object.assign(new Error("HTTP transport failure"), {
      code: "HttpError",
      data: { statusCode },
    });
    // act
    const reason = classifyGitTransportFailure(failure);
    // assert
    assert.strictEqual(reason, expectedReason);
  });
}
```
Rewrite the table rows as `{ title, statusCode, rule, remoteUrl?, expected: { reason, frame? } | undefined }` and call `classifyGitFailure(failure, rule, remoteUrl)`. The rows must cover these cases:
- 401/403 gives auth and no frame, even with a URL
- 404/410 gives `rule.notFound`
- 5xx gives `network error`
- a URL gives the frame `"<status> on <wire url>"`
- an HttpError with no status (:97) is unclassified
- `NotFoundError` resolves only when `missingRef` is set
- errno codes give `network unreachable`
- a cleanup-leak wrapper is unwrapped

Wrapper tests stay only as long as the wrappers have production callers. Do not add tests for the wrappers' fixed rules beyond one row each.

### `clone-cache.ts` (GLK-08)

**Analog:** `orchestrators/plugin/marketplace-tag-probe.ts:23-37`, the default injection of the real git reader:
```ts
import { listTags, resolveTagOid } from "../../platform/git.ts";
export interface MarketplaceTagListingSeam {
  readonly listTags: typeof listTags;
  readonly resolveTagOid: typeof resolveTagOid;
}
const REAL_MARKETPLACE_TAG_LISTING_SEAM: MarketplaceTagListingSeam = Object.freeze({ listTags, resolveTagOid });
```
In `clone-cache.ts`, add `resolveTagOid?: typeof resolveTagOid` beside the existing `gitOps?` arg of `materializeOrRefreshPluginMirror`, and default it at the point of use. This follows the `gitOps ?? DEFAULT_GIT_OPS` precedent at :449. Handle a miss with `isGitNotFoundError` (:76-78), and treat an `undefined` result as a miss too. Unit tests should inject a fake `resolveTagOid` and a `createGitOpsFake` (`test/platform/git-ops-fake.ts`) whose fetch calls `assert.fail` on the warm-hit case.

### `update-flow.ts` (GLK-01 sync frame, GLK-02 ladder)

**Frame analog:** `marketplace/update.ts:415-416`. It computes `networkCloneUrl(source)` for github/url sources. Its line 504 builds the frame, and the code throws `MarketplaceUpdateError(frame, { cause: err })` (`shared/errors.ts:542-549`). The expected cause-line bytes come from `features/marketplace/url-source-update.feature:19`. The ladder shape is RESEARCH Pattern 2. Per D-PL7-12, the `cause: err` goes on every arm. Update the `test/orchestrators/plugin/update-flow.test.ts:4188` pin `["not in manifest"]` to `["unreadable manifest"]` and add a cause assertion.

### `edge-deps.ts` (GLK-07 completion)

Export `upgradeCandidate` from `list-installed-row.ts` (:87-104, a one-word edit). Call it from `classifyInstalledPluginRow` (:127-136). Delete `git-source-probe.ts::probeUpgradeCandidate` (:302-327) and its test block (`git-source-probe.test.ts:749-885`).

## Cucumber Patterns

**Analog for S1 (fetch 503) and the 404 row edit:** `features/plugin/fetch.feature:124-164`. Copy its Given block: `the git repository … holds these plugins:`, dir-source marketplace, `offers these plugins from git repositories:`, `is added to the project scope`, then `Given the git host answers 503 for the plugin "urlp"`. Copy the full-row `Then the result lists these plugins:` table. Per D-PL7-14, the 404 row at :154 changes its cause chain to `404 on https://{git host}/acme/ghp.git, HTTP Error: 404 Not Found, fetched https://{git host}/acme/ghp.git`. Use the url-kind `urlp` for the 503 scenario to avoid the doubled URL (RESEARCH Pitfall 4).

**Analog for "no request" (S5, S6):** `fetch.feature:212-226` (`Then the git host receives no request`). The step is defined at `features/step_definitions/git-host.steps.ts:148`, and the answer-code step at :66.

**Analog for S4 (GLK-02 twin):** `features/plugin/update-rollback.feature:8-32`. Reuse its Background. The direct row to match is:
```
| fixtures | project | demo@fixtures | demo | failed | unreadable | project | 1.0.0 | 1.1.0 | {mcp-adapter.json read error} | false | | |
```
The twin first runs `the user has run "/claude:plugin marketplace autoupdate fixtures --scope project"`, then `When the user runs "/claude:plugin marketplace update fixtures --scope project"`. Expect the same reason and cause chain.

**Edits to existing rows:** `git-source-update.feature:311,313` gain the frame (D-PL7-14).

Follow `.agents/skills/cucumber/rules/features.md`: lower-case steps, no `And`, full-row tables. Every step already exists.

## Shared Patterns

- **Hermetic home:** every new test uses the file's existing workspace helper. For example, `withWorkspace` in `fetch.test.ts`, `freshLocations(t)` in `clone-gc.test.ts`, and `seedUpdate` + `t.after(rm)` in `update-preflight.test.ts` all route through `test/platform/hermetic-environment.ts`.
- **Test layout:** `test()` cases with `// arrange / act / assert` comments. Use no reset hooks and add no test-only exports. Test titles cite GLK-xx / D-PL7-xx, as `"GIT-03: …"` does today.
- **Swallowed GC failure:** every GC site already wraps the call in `try/catch` + `hookDebugLog` (D-19-01), so a `StateLockHeldError` from the locked GC needs no new catch.
- **`proper-lockfile` in tests only:** production goes through `withExistingScopeLock` (fallow `proper-lockfile-chokepoint`). Tests import `lockfile` directly, as `fetch.test.ts` and `with-state-guard.test.ts` do.

## No Analog Found

None.

## Metadata

**Search scope:** `extensions/pi-claude-marketplace/{shared,transaction,orchestrators/plugin}`, `test/{shared,transaction,orchestrators/plugin}`, `features/plugin`, `features/step_definitions`.
**Pattern extraction date:** 2026-10-26
