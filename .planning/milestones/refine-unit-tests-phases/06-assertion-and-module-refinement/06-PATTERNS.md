# Phase 06: Assertion and Module Refinement - Pattern Map

**Mapped:** 2026-09-08
**Files analyzed:** 30 proposed production modules, 30 mirrored owner tests, 24 catalog artifacts, 7 legacy hubs/tests, and cross-cutting test/gate/documentation edits
**Analogs found:** 6 strong tracked analogs covering every file family

## Scope Interpretation

The names below are the research baseline, not a license to create arbitrary buckets. If the live graph makes one boundary cyclic, D-06-12 requires a smaller genuine leaf. It does not permit a forwarding seam. All production moves must migrate callers and the direct owner test atomically. The final move in each family deletes the old hub and old test.

The approved split families are resolver, notify, install, update, reinstall, list, and catalog. Uninstall, the independent plugin-info split, `tests/bridges/skills/stage.test.ts`, the unused-type-member gate, and Phase 8 index-loop work are out of scope.

## File Classification

| New/Modified File(s) | Role | Data Flow | Closest Tracked Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/domain/resolver-types.ts` | model/config | transform | `extensions/pi-claude-marketplace/domain/source.ts` | exact role |
| `domain/unsupported-components.ts` | domain utility | transform | `domain/source.ts` closed unions and exhaustive parsing | role + flow |
| `domain/component-paths.ts` | domain service | file-I/O + transform | `domain/manifest-cache.ts` | flow match |
| `domain/mcp-resolution.ts`, `domain/hooks-resolution.ts` | domain service | file-I/O + transform | `orchestrators/plugin/git-source-probe.ts` | flow match |
| `domain/plugin-resolver.ts` | domain service | request-response + transform | `orchestrators/plugin/git-source-probe.ts` | role + flow |
| `shared/notification-types.ts` | model/config | transform | `domain/source.ts` | exact role |
| `shared/notification-grammar.ts`, `shared/notification-summary.ts`, `shared/notification-info.ts` | shared utility/service | transform | `orchestrators/reconcile/apply-outcomes.ts` | role match |
| `shared/notification-dispatch.ts` | shared service | request-response | `edge/handlers/plugin/import.ts` plus `tests/edge/notification-boundary.ts` | flow match |
| `shared/redact-absolute-paths.ts`, `shared/compare-name-scope.ts` | utility | transform | `orchestrators/reconcile/apply-outcomes.ts` | role + flow |
| `orchestrators/plugin/install-{clone-probe,declared-enabled,disable-cascade,outcome}.ts` | orchestrator leaf/service | file-I/O + transform | `orchestrators/plugin/git-source-probe.ts` | role + flow |
| `orchestrators/plugin/install-flow.ts` | orchestrator | request-response + CRUD | `orchestrators/import/execute.ts` | role + flow |
| `orchestrators/plugin/update-{preflight,swap,cascade}.ts` | orchestrator leaf/service | file-I/O + CRUD/transform | `orchestrators/plugin/git-source-probe.ts` | role match |
| `orchestrators/plugin/update-flow.ts` | orchestrator | request-response + CRUD | `orchestrators/import/execute.ts` | role + flow |
| `orchestrators/plugin/reinstall-{targets,clone-probe,replace,record}.ts` | orchestrator leaf/service | CRUD + file-I/O + transform | `orchestrators/plugin/git-source-probe.ts` | role match |
| `orchestrators/plugin/reinstall-flow.ts` | orchestrator | request-response + CRUD | `orchestrators/import/execute.ts` | role + flow |
| `orchestrators/plugin/list-{installed-row,candidate-row,orphan-fold}.ts` | orchestrator leaf/utility | batch + transform | `orchestrators/reconcile/apply-outcomes.ts` | flow match |
| `orchestrators/plugin/list-flow.ts` | orchestrator | request-response + batch | current `orchestrators/plugin/list.ts` exact-output boundary | same responsibility |
| `tests/<production-relative-path>.test.ts` for all 30 production modules | test | matching owner flow | `tests/domain/manifest-cache.test.ts` and direct-pair scripts | exact convention |
| `tests/architecture/catalog-uat/catalog-parser.ts` | test utility | file-I/O + transform | parser in `tests/architecture/catalog-uat.test.ts` | exact responsibility |
| `tests/architecture/catalog-uat/catalog-parser.test.ts` | test | transform | planted-fixture architecture tests; current catalog parser | exact responsibility |
| `tests/architecture/catalog-uat/fixture-types.ts` | test model/config | transform | `CatalogFixture` / `FixtureMap` in old catalog test | exact responsibility |
| `tests/architecture/catalog-uat/mock-pi.ts` | test utility | request-response | `MockPi`, `makeCtx`, and probe helpers in old catalog test | exact responsibility |
| `tests/architecture/catalog-uat/fixtures/*.ts` (20 command-surface slices) | test data | transform | `fixtureMap` sections in old catalog test | exact responsibility |
| `tests/architecture/catalog-uat/catalog-contract.test.ts` | architecture test | batch + file-I/O | old catalog test driver plus `assertReportComplete` | exact responsibility |
| Exact-output producer owner tests, notably marketplace autoupdate/list and plugin install/update/reinstall/list | test | request-response | `tests/orchestrators/plugin/list.test.ts` and `tests/edge/notification-boundary.ts` | exact |
| Authorized patch-bearing tests: commands discover, hooks event-router, skills unstage, index, import execute, enable-disable, fetch, plugin info/install/reinstall, reconcile apply, path-safety | test | file-I/O/event-driven | `tests/domain/manifest-cache.test.ts`, `tests/orchestrators/plugin/install.test.ts` | behavior match |
| `scripts/check-corresponding-tests.mjs`, `scripts/test-coverage-direct.mjs`, relevant architecture scanners, `eslint.config.js`, `docs/output-catalog.md` | config/gate/docs | batch + file-I/O | their current mapping/scanning implementations | exact responsibility |

All abbreviated production paths above are rooted at `extensions/pi-claude-marketplace/`; all abbreviated test paths are rooted at `tests/`. Each proposed production file therefore has exactly one test at `tests/<relative production path>.test.ts`.

## Pattern Assignments

### Domain and shared type/policy leaves

**Apply to:** `resolver-types.ts`, `unsupported-components.ts`, `notification-types.ts`, and pure transform utilities.

**Analog:** `extensions/pi-claude-marketplace/domain/source.ts` (tracked)

**Closed, readonly public vocabulary** (lines 24-71):

```typescript
export interface PathSource {
  readonly kind: "path";
  readonly raw: string;
  readonly logical: string;
}

export type ParsedSource =
  PathSource | GitHubSource | UrlSource | GitSubdirSource | NpmSource | UnknownSource;
```

**Validation factory** (lines 517-526):

```typescript
export function pathSource(raw: string): PathSource {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Path source must be a non-empty string.");
  }
  return { kind: "path", raw, logical: raw };
}
```

Copy the discriminated, readonly shapes and exhaustive switches. Export only types/functions required by a production consumer and the paired owner test. Do not introduce a barrel merely to preserve an old import path.

### File-reading and resolver leaves

**Apply to:** `component-paths.ts`, `mcp-resolution.ts`, `hooks-resolution.ts`, `plugin-resolver.ts`, and clone/probe leaves.

**Primary analog:** `extensions/pi-claude-marketplace/domain/manifest-cache.ts` (tracked)

**Imports and narrow injectable contract** (lines 38-43, 58-76):

```typescript
import { stat } from "node:fs/promises";

interface ManifestCacheStat {
  readonly mtimeMs: number;
  readonly size: number;
}

export type ManifestLoader = (manifestPath: string) => Promise<unknown>;

export function createManifestCache(load: ManifestLoader): {
  load(manifestPath: string): Promise<unknown>;
} {
```

**Trace-preserving error handling** (lines 100-113):

```typescript
let outcome: ManifestLoadOutcome;
try {
  outcome = { ok: true, value: await load(manifestPath) };
} catch (err) {
  outcome = { ok: false, thrown: err };
}
// Re-stat after the load; a vanished file is a miss, not a false cache key.
```

**Secondary analog:** `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` (tracked), lines 200-234:

```typescript
export async function probeManifestEntry(
  entry: ManifestEntry,
  marketplaceRoot: string,
  locations: ScopedLocations,
): Promise<ManifestEntryClassification> {
  const parsedSource = parsePluginSource(entry.source);
  // classify explicit source kinds, build the real context, then fold only the
  // documented probe/resolve failure to "unavailable".
}
```

Use real filesystem state for ordinary behavior. Add a production-owned port only where Phase 5 classified an irreproducible fault, race, schedule, probe, rollback point, or hydration read.

### Notification grammar, summary, utilities, and dispatch

**Apply to:** every `shared/notification-*.ts` leaf, `redact-absolute-paths.ts`, and `compare-name-scope.ts`.

**Type/projection analog:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` (tracked), lines 258-294 and 305-349:

```typescript
export type SourceMismatchOutcome =
  | { readonly kind: "source-mismatch"; readonly cause: "source-mismatch"; /* ... */ }
  | { readonly kind: "source-mismatch"; readonly cause: "malformed-plugin-key"; /* ... */ };

export function sourceMismatchOutcomeSubject(outcome: SourceMismatchOutcome): string {
  return outcome.cause === "malformed-plugin-key" ? outcome.rawKey : outcome.marketplace;
}
```

This is the pattern for moving closed message types before projections. Keep dependencies one-way: types → grammar → summary/info → dispatch. `notification-dispatch.ts` becomes the only sanctioned direct `ctx.ui.notify` owner, so the ESLint exception must move there when `shared/notify.ts` is deleted.

Structural cardinality remains producer data (`"single" | "plural"`). Never infer it from rendered row count. Plural tallies remain visible.

### Command-flow leaves and final flow owners

**Apply to:** install, update, reinstall, and list leaf families and `*-flow.ts` owners.

**Leaf analog:** `extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts` (tracked), lines 117-134 and 248-261:

```typescript
export function makePresenceProbe(
  locations: ScopedLocations,
): (source: UrlSource | GitSubdirSource | GitHubSource) => Promise<GitPluginRootResult> {
  // bind a real production location once; return a responsibility-specific operation
}

export async function probeUpgradeCandidate(/* ... */): Promise<ResolvedPlugin | undefined> {
  try {
    return await resolveStrict(entry, ctx);
  } catch {
    return undefined;
  }
}
```

**Flow/composition analog:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` (tracked), lines 132-181 and 206-230:

```typescript
export interface ClaudeImportExecutionResult {
  readonly addedMarketplaces: readonly MarketplaceAddedOutcome[];
  readonly installedPlugins: readonly PluginInstalledOutcome[];
  readonly changedResources: boolean;
}

export interface ImportDeps {
  readonly loadState?: (scope: Scope, cwd: string) => Promise<ExtensionState>;
  readonly installPlugin?: (opts: InstallPluginOptions) => Promise<InstallPluginOutcome>;
}
```

Copy responsibility-specific collaborators and readonly outcomes, not the broad optional `deps` shape wholesale. Phase 6 ports must be consumer-owned and already authorized; ordinary flow uses production defaults and real state.

For each family, extract leaves while the hub still owns genuine behavior. The final atomic change must:

1. Move remaining sequencing to `*-flow.ts`.
2. Move the old hub's remaining test blocks to the mirrored flow owner or a named leaf owner.
3. Update every production and test import directly.
4. Repoint source-scanning gates, documentation comments, test ownership, and completeness invariants.
5. Delete the legacy hub and legacy owner test.
6. Produce zero matches for its stale path across `extensions tests scripts docs eslint.config.js`.

No old-path re-export, overload, deprecated call form, adapter, or barrel is allowed.

### Mirrored direct owner tests

**Apply to:** all 30 new production modules and their 30 owner tests.

**Path gate analog:** `scripts/check-corresponding-tests.mjs` (tracked), lines 29-37 and 135-173:

```javascript
function expectedTestPath(sourcePath) {
  const relativePath = sourcePath.slice(`${productionRoot}/`.length, -3);
  return `${testRoot}/${relativePath}.test.ts`;
}

// The owner must directly import sourcePath. An import through a proxy is
// reported as proxy-owned; absent and wrong paths are separate violations.
```

**Direct coverage analog:** `scripts/test-coverage-direct.mjs` (tracked), lines 31-89 and 365-395:

```javascript
function sourceToTest(sourcePath) {
  const relativePath = sourcePath.slice(`${productionRoot}/`.length, -3);
  return `${testRoot}/${relativePath}.test.ts`;
}

// assertReportComplete checks one-to-one uniqueness, round-trip mapping,
// missing sources, and exact record count.
```

**Hermetic owner fixture:** `tests/domain/manifest-cache.test.ts` (tracked), lines 14-24:

```typescript
async function createManifestFile(t: TestContext, contents = "{}") {
  const directory = await mkdtemp(path.join(tmpdir(), "manifest-cache-"));
  t.after(async () => rm(directory, { force: true, recursive: true }));
  const manifestPath = path.join(directory, "marketplace.json");
  await writeFile(manifestPath, contents, "utf8");
  return { directory, manifestPath };
}
```

Every owner test directly imports its matching source, exercises the public contract, and proves complete observable result/state/tree/output. Tests may use narrow typed collaborators, but must not gain a production test-only export.

### Exact output and strict collaborator boundaries

**Apply to:** output-producing owner tests before redistribution and after each move.

**Analog:** `tests/edge/notification-boundary.ts` (tracked), lines 90-131:

```typescript
const notifications: Notification[] = [];
const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "extension context" });
const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
when(() => ui.notify)
  .thenReturn((message, severity) => {
    notifications.push(severity === undefined ? { message } : { message, severity });
  })
  .times(emissions);
// verify(ctx); verify(pi); verify(ui);
```

**Owner-local expected-byte analog:** `tests/orchestrators/plugin/list.test.ts` (tracked; exact plural case documented in research at lines 373-398):

```typescript
const expectedMessage = [
  "● mp1 [user]",
  "  ● alpha v1.0.0 (installed)",
  "  ○ beta v2.0.0 (available)",
  "  ⊘ gamma v3.0.0 (unavailable) {unsupported source}",
  "",
  "Plugin list: 3 successes",
].join("\n");

assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
```

Author zero/one/many complete strings locally in the producer owner test. Do not import or derive them from production or `docs/output-catalog.md`. Make dynamic values deterministic, compare the full final string byte-for-byte, and deep-compare the ordered notification records including severity. Keep the documented body-only list helper; its independent exact boundary cases are the protection against suffix loss.

### Authorized global-patch removal

**Apply to:** only the terminally authorized patch-bearing tests listed in File Classification.

**Real-state analogs:** `tests/domain/manifest-cache.test.ts` lines 14-24 and `tests/orchestrators/plugin/install.test.ts` lines 323-334 (both tracked):

```typescript
async function withHermeticHome<T>(fn: (owner: InstallTestOwner) => Promise<T>): Promise<T> {
  return withHermeticEnvironment("install-", () => {
    const hooksRuntime = createHooksRuntime();
    const hooksRouting = createHooksRouting(hooksRuntime);
    const completionCache = createCompletionCache();
    return fn({
      completionCache,
      hooksRouting,
      hooksRuntime,
      installPlugin: createNodeInstallPlugin(hooksRouting, completionCache),
    });
  });
}
```

Delete patch and restoration code together. Preserve public outcomes. A collaborator assertion may supplement, but never replace, final state/tree/output proof. The acceptance target is not repository-wide zero: the exact residual allowlist is `tests/bridges/skills/stage.test.ts` and `tests/orchestrators/plugin/uninstall.test.ts`, totaling 18 `syncBuiltinESMExports(` calls and 2 `createRequire(` calls.

### Catalog split

**Apply to:** parser, fixture types, mock Pi, 20 fixture modules, and contract driver.

**Analog:** `tests/architecture/catalog-uat.test.ts` (tracked)

**Parser loop** (lines 170-188):

```typescript
function loadCatalogExamples(catalog: string): readonly CatalogExample[] {
  const examples: CatalogExample[] = [];
  const st: CatalogScanState = { currentSection: null, pendingState: null, inFence: false, fenceBody: [] };
  for (const line of catalog.split("\n")) {
    if (st.inFence) scanInsideFence(line, st, examples);
    else scanOutsideFence(line, st);
  }
  return examples;
}
```

**Fixture contract** (lines 236-251):

```typescript
interface CatalogFixture {
  readonly message: NotificationMessage;
  readonly pi: MockPi;
  readonly expectedSeverity?: "warning" | "error";
  readonly emit?: (ctx: MockCtx, pi: MockPi) => void;
}

type FixtureMap = Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>;
```

Split by 20 command-surface sections, not by an obsolete 18-section estimate. Each fixture module owns self-contained inputs, while documented bytes remain independently parsed from the catalog. The contract driver must inverse-walk both directions: every `(section,state)` in the catalog has exactly one fixture and every fixture key has exactly one catalog block. The `assertReportComplete` round-trip/count checks in `scripts/test-coverage-direct.mjs` lines 365-395 are the closest completeness analog.

## Shared Patterns

### Four-Part Repointing Gate

Before deleting any old hub, create a concrete ownership table containing these exact categories:

| Category | Required mapping |
|---|---|
| source-scanning gate | Every scanner, lint exception, path allowlist, or architecture assertion naming the old path → named new owner |
| documentation comment | Every docs link and source comment naming the old module/symbol → named new owner |
| test ownership | Every old test block and command-flow proof → exactly one new owner or retained end-to-end flow proof |
| completeness invariant | Every closed-set count, fixture key, exhaustive union, direct-pair rule, or inverse walk → named new owner |

Add a row for every exported symbol and every production caller. Verify named analogue paths are tracked with `git ls-files`. Then require an empty stale-path scan. “Imports compile” is insufficient evidence.

### Atomic Caller Migration

Use CodeGraph immediately before each extraction to enumerate current callers. Move the leaf, its direct test, all production/test imports, and any clearer replacement contract in one plan. Do not retain the old signature as an overload. If the move is too broad, stop and replan a smaller true leaf.

### Error and Security Preservation

Preserve thrown values when the contract is trace-preserving. Fold errors only at an existing, explicitly documented projection boundary. Keep resolver path containment and closed TypeBox/union validation. `redact-absolute-paths.ts` must stay production-used and directly tested; absolute paths must not enter notification outcomes. Repoint the sole direct-output lint exemption to `notification-dispatch.ts`.

### Verification Ladder

For every production move: focused owner test, direct coverage for the new source, and the retained command-flow proof. At each wave boundary: corresponding-test gate, affected architecture tests, typecheck, lint, and Fallow. At phase close: `npm run check`, exact residual patch census, and zero stale old paths.

## Legacy Hubs to Delete at Family Completion

| Old path | Replacement final owner | Required zero-stale token |
|---|---|---|
| `extensions/pi-claude-marketplace/domain/resolver.ts` and `tests/domain/resolver.test.ts` | `domain/plugin-resolver.ts` pair plus resolver leaves | `domain/resolver.ts` |
| `extensions/pi-claude-marketplace/shared/notify.ts` and `tests/shared/notify.test.ts` | `shared/notification-dispatch.ts` pair plus notification leaves | `shared/notify.ts` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` and paired test | `install-flow.ts` pair plus leaves | `orchestrators/plugin/install.ts` |
| `.../update.ts` and paired test | `update-flow.ts` pair plus leaves | `orchestrators/plugin/update.ts` |
| `.../reinstall.ts` and paired test | `reinstall-flow.ts` pair plus leaves | `orchestrators/plugin/reinstall.ts` |
| `.../list.ts` and paired test | `list-flow.ts` pair plus leaves | `orchestrators/plugin/list.ts` |
| `tests/architecture/catalog-uat.test.ts` | `catalog-uat/catalog-contract.test.ts` plus parser/fixtures | `tests/architecture/catalog-uat.test.ts` |

## No Analog Found

None at the family level. The exact responsibilities are new, but the repository already contains tracked patterns for closed unions, real filesystem ownership, narrow production factories, flow composition, exact notification capture, direct owner pairing, and inverse completeness checks.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace`, `tests`, `scripts`, `docs`, `eslint.config.js`
**Files in tracked search scope:** 518
**Strong analog files used:** 10 (6 primary pattern sources plus 4 gate/fixture sources)
**Tracked-source gate:** verified for every named analogue with `git ls-files`; no `.gsd` runtime mirror path is emitted
**Discovery:** CodeGraph 1.6.0 used before targeted `rg`/git inspection, per `AGENTS.md`
**Pattern extraction date:** 2026-09-08
