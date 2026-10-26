# Phase 6: Marketplace Update and C-10 Fix - Pattern Map

**Mapped:** 2026-10-18
**Files classified:** 18 likely new/modified files, including the conditional manifest pair
**Analogs found:** 18 / 18 for file structure; the durable manifest baseline is new behavior

All existing analog paths below were verified with `git ls-files`. Paths are relative to the repository root. Line numbers describe the pre-implementation tree. New filenames are proposals, not existing files. This map is part of the active phase-planning workflow; it changes no implementation or tests.

## File Classification

The prefix `extensions/pi-claude-marketplace/` is abbreviated as `extensions/` only in this table.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
| --- | --- | --- | --- | --- |
| `extensions/orchestrators/marketplace/update.ts` | controller | request-response, file-I/O, batch | Same file: `snapshotAfterRefresh`, `refreshOneMarketplace` | exact |
| `tests/orchestrators/marketplace/update.test.ts` | test | file-I/O, batch | Same file: local-source seeds, AFILE-04, ordered all-target update | exact |
| `extensions/orchestrators/marketplace/add.ts` | controller | request-response, file-I/O | Same file: `addPathInGuard` and git record creation | exact |
| `tests/orchestrators/marketplace/add.test.ts` | test | file-I/O | Same file: direct manifest and tilde source cases | exact |
| `extensions/orchestrators/marketplace/info.ts` | controller | request-response | Same file: `buildBlock` | exact |
| `tests/orchestrators/marketplace/info.test.ts` | test | request-response, file-I/O | Same file: `writeMarketplaceJson`, path-source projections | exact |
| `extensions/persistence/state-io.ts` | model, service | file-I/O | Same file: optional reconciliation stamp and marketplace schema | exact |
| `tests/persistence/state-io.test.ts` | test | file-I/O | Same file: legacy and optional-field load contract | exact |
| `extensions/domain/manifest.ts` (if raw snapshot seam changes) | service | file-I/O, transform | Same file: validated loader and dependency normalization | exact |
| `tests/domain/manifest.test.ts` (paired with preceding row) | test | file-I/O, transform | Same file: raw extras and normalized dependency entries | exact |
| `features/marketplace/update.feature` | test | request-response, batch | Same file: complete ordered bare-update results | exact |
| `features/marketplace/file-source-update.feature` (proposed new) | test | request-response, file-I/O | `features/marketplace/update.feature` | role-match |
| `features/marketplace/info.feature` | test | request-response | Same file: source identity Outline | exact |
| `features/step_definitions/marketplace/update.steps.ts` (new if needed) | test | file-I/O, request-response | `features/step_definitions/marketplace/publishing.steps.ts` | role-match |
| `features/step_definitions/marketplace/publishing.steps.ts` | test | file-I/O | Same file: kind-aware publication and cleanup | exact |
| `features/step_definitions/command.steps.ts` | test | request-response, transform | Same file: full envelopes and all-row assertions | exact |
| `features/lib/published-marketplace.ts` | utility | file-I/O | Same file: kind dispatch and `PublishedMarketplace` | exact |
| `features/lib/path-marketplace.ts` | utility | file-I/O, transform | Same file: manifest writers and version-bearing skills | exact |

Do not create all proposed files mechanically. The update step module is only needed for update-specific setup/actions that do not belong to publication. Keep the C-10 file-only behavior in its own feature; the proposed title is `Feature: Marketplace file source update`, which gives the kebab-case filename above. General update behaviors remain in `update.feature` with source-kind Outlines.

## Pattern Assignments

### Update orchestrator and its paired owner test

**Files:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `tests/orchestrators/marketplace/update.test.ts`.

**Analog:** the existing update transaction/cascade flow; preserve it while replacing source selection and comparison. CodeGraph traced `makeMarketplaceUpdateHandler` to `updateMarketplace` / `updateAllMarketplaces`, then `refreshOneMarketplace` → `snapshotAfterRefresh` → `refreshRecord`. The post-save path reaches `cascadeAutoupdates`, notification composition, then MCP notices.

**Imports:** update.ts lines 98-127 use Node imports first, relative `.ts` module imports, and the existing domain loader, state locations, typed errors, notification dispatch, and `withLockedStateTransaction`. Lines 148-157 keep type-only imports explicit. Add the Node comparator import here; no new equality package or separate generic utility is needed.

**Transaction and installed-record order**, update.ts lines 510-516:

```typescript
const changed = await refreshRecord(record, args);
await tx.save();
return {
  autoupdate,
  plugins: Object.keys(record.plugins),
  changed,
};
```

Place baseline advancement inside the successful refresh transaction. A validation failure must not save or invoke plugin updates. A save failure must leave the durable previous baseline intact and prevent the cascade. Completion-cache invalidation already happens after persistence and before the cascade, at lines 724-747; retain that order.

**Bare order**, update.ts lines 266 and 270-276:

```typescript
const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];
```

```typescript
for (const scope of scopes) {
  const locations = locationsFor(scope, opts.cwd);
  // eslint-disable-next-line no-await-in-loop -- at most two scopes, one state read each
  const state = await loadState(locations.extensionRoot);
  for (const name of Object.keys(state.marketplaces)) {
    targets.push({ scope, locations, name });
  }
}
```

The loop at lines 290-305 awaits each refresh. Ordinary refresh failures are rendered and returned from `refreshOneMarketplace` at lines 680-712, allowing later targets to continue. Keep the explicit `rethrowInvalidGitHubBaseUrl` behavior; D-12 does not authorize changing that separate configuration contract.

**Cascade order/failure continuation**, update.ts lines 532-538:

```typescript
const outcomes: PluginUpdateOutcome[] = [];
for (const plugin of snapshot.plugins) {
  try {
    // eslint-disable-next-line no-await-in-loop -- each update locks the scope (retries: 0)
    outcomes.push(await pluginUpdate(plugin, name, scope));
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
```

The catch converts ordinary failures into plugin outcomes and continues. Keep the marketplace header `updated` even when a child fails. Do not enumerate refreshed manifest entries for installation: the snapshot enumerates installed records only. Do not sort either collection.

**MCP notice adjacency**, update.ts lines 838-848:

```typescript
notifyWithContext(ctx, run, UPDATE_CONTEXT, cascadeRows, undefined, cardinality);
// AFILE-04: the notices of the cascade's updates, shown after the rows they
// explain. A failed update can carry them too: its MCP commit succeeded
// before a later bridge or the finalize failed. The no-op paths above have
// only `unchanged` outcomes, which carry none.
notifyMcpConfigNotices(
  ctx,
  run,
  outcomes.flatMap((o) =>
    o.partition === "updated" || o.partition === "failed" ? (o.mcpConfigNotices ?? []) : [],
  ),
);
```

**Do not copy the defect:** `validateManifestAtRoot` at lines 864-877 rebuilds `.claude-plugin/marketplace.json` and overwrites `record.manifestPath`. Keep root reconstruction for managed clone refresh where needed, but local refresh must read the authoritative recorded manifest path. Likewise `manifestContentKey` at lines 354-370 and the pre/post use at lines 391/451-452 are the replacement targets: two current reads cannot recover the last successful local content.

**Owner-test reuse:**

- Imports at update.test.ts lines 1-55 use `node:test`, `node:assert/strict`, the public orchestrator exports, `createJsonCapture`, notification-run seeds, hermetic environment, and existing port fakes.
- `withHermeticHome` at lines 209-213 wraps `withHermeticEnvironment("mp-update-", ...)`; `makeCtx` at lines 192-207 captures exact rendered notifications. Use `createJsonCapture` for complete structured payload and emission-order checks.
- `seedPathMarketplace` at lines 1613-1655 writes state and, when requested, autoupdate config. Autoupdate in state alone is insufficient. Add explicit baseline/source-identity seed options if needed; preserve dedicated absent-baseline cases.
- Existing local no-op case starts at line 1175; malformed/schema-invalid cases at 1657/1702; dropped catalog entry cases at 1955/2016; no-op collapse at 2376; AFILE-04 notice and no-notice cases at 2491/2576; all-target scope ordering at 3223; stale managed-root correction at 3604.
- The AFILE-04 case builds updated and failed outcomes carrying notices at lines 2511-2539, then deep-compares both notifications at lines 2555-2572. Extend its shape to two marketplaces to prove adjacency before the next primary result.

Old test titles/comments sometimes claim alphabetical ordering or warning severity for a benign no-op. They are not the Phase 6 contract. Use D-08/D-11 insertion order and the measured `info` no-op envelope.

### Add, info, and persistence source/test pairs

**Files:** marketplace `add.ts` / `info.ts`, persistence `state-io.ts`, and their mirrored owner tests.

**Source identity analog**, add.ts lines 1202-1212:

```typescript
const onDiskPath = expandTildePath(source.logical);
const probe = await stat(onDiskPath);
let manifestPath: string;
let marketplaceRoot: string;
if (probe.isDirectory()) {
  marketplaceRoot = onDiskPath;
  manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
} else if (probe.isFile()) {
  manifestPath = onDiskPath;
  // Walk up two levels: <root>/.claude-plugin/marketplace.json -> <root>
  marketplaceRoot = path.dirname(path.dirname(manifestPath));
```

Preserve separate file identity and plugin-relative resolution root. Do not infer kind from a `.json` suffix, copy the source, or fall back to a conventional file after the original disappears. Relative/tilde inputs need a stable resolved identity using add's resolution context; the source's raw spelling remains available for config.

Both record construction sites must initialize the successful comparison baseline: git sources at add.ts lines 1111-1120 and local sources at lines 1231-1240. `newMarketplaceName` at lines 338-355 already loads/validates the manifest and rejects reserved or duplicate names. Reuse that domain boundary; if changing its result to carry comparison data, update both callers. Git add reads in staging then renames, so do not attempt a later read from the now-missing staging path.

**Additive persisted-field analog**, state-io.ts lines 331-338:

```typescript
// BFILL-02 / D-68-01: the last extension version that reconciled this state.
// OPTIONAL and additive -- NO schemaVersion bump. An absent stamp means
// scan-once (treated as version-changed) so an old doc without it loads
// unchanged and the next save writes it. It gates the load-time backfill
// scan, which only fires when this differs from EXTENSION_VERSION (the sole
// thing that can move the supported-kind boundary).
lastReconciledExtensionVersion: Type.Optional(Type.String()),
marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
```

Apply the optional additive-field convention to `MARKETPLACE_RECORD_SCHEMA` at lines 303-320, where `manifestPath`, `marketplaceRoot`, and optional `lastUpdatedAt` already live. The baseline is machine state, not user config. A serialized parsed snapshot avoids aliasing the manifest cache; its name and representation remain implementation choices. Do not turn it into a resolution source.

**Info projection:** `getMarketplaceInfo` → `collectMarketplaceRecordsByScope` → `buildBlock`. The current path arm at info.ts lines 78-80 emits `record.marketplaceRoot`; the later manifest read at lines 90-92 already uses `record.manifestPath`. Correct only the source identity projection for files, retaining directory projection and the read-only behavior. Info/list must never advance the baseline.

**Owner-test assignments:**

| Pair | Concrete starting point | Required extension |
| --- | --- | --- |
| add | add.test.ts lines 1796-1822: public `addMarketplace`, direct manifest fixture, persisted state read | Exact external/conventional file identity, relative/tilde handling, initial baseline; assert full relevant values rather than only record existence |
| info | info.test.ts lines 175-196: hermetic scope and explicit manifest writer; existing path projections | Conventional and external file path, directory unchanged, fresh source description; no state advancement |
| state-io | state-io.test.ts lines 243-275: table of legacy versions and optional reconciliation stamp | Missing optional baseline, present baseline round trip, chosen field validation, preserved nested content |

The state contract's assertion pattern is `assert.deepStrictEqual(loadedState, expectedState)` at line 274. Test the new baseline through `loadState`/`saveState`; do not export schema internals for tests.

### Manifest reader and comparison data

**Conditional files:** `extensions/pi-claude-marketplace/domain/manifest.ts`, `tests/domain/manifest.test.ts`.

**Analog:** same file's single filesystem/read/parse/validate boundary. CodeGraph reports many callers of `loadMarketplaceManifest`; preserve its resolver-facing normalized result unless the planner explicitly accounts for every consumer. A separate comparison view can share the same read and cache without widening every caller's return type.

**Validation/error pattern**, manifest.ts lines 112-124:

```typescript
let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (err: unknown) {
  throw new InvalidMarketplaceManifestError(
    `marketplace.json is not valid JSON: ${String(err)}`,
    {
      cause: err,
    },
  );
}

parsed = normalizeDependencyEntries(parsed);
```

The schema check at lines 125-134 returns the validated value, preserving normal unknown fields. However, `normalizeDependencyEntries` at lines 54-94 replaces malformed dependency entries with stubs or drops unnamed entries. A comparison snapshot captured only after this normalization loses tolerated original JSON fields. Preserve the complete parsed value before normalization for D-05 while retaining resolver isolation.

**Tests to copy:** manifest.test.ts lines 163-204 assert full raw extras, key order, and cache reference identity. Lines 222-252 assert normalized invalid-dependency behavior and unchanged source bytes. Extend both properties together: comparison sees changed unknown fields in tolerated malformed entries, resolver output remains normalized, disk source remains unchanged.

No existing durable structural-baseline implementation was identified. Use the research recommendation of two-argument `isDeepStrictEqual` over complete parsed JSON, not `JSON.stringify` string equality or a custom recursive sorter. Baseline serialization may use JSON text; compare the parsed values. Object keys/whitespace are insignificant; all array order and unknown fields are significant.

If the chosen read seam requires changes to `domain/manifest-cache.ts`, add its existing mirrored `tests/domain/manifest-cache.test.ts` to the plan and direct-coverage schedule. This is conditional, not a reason to redesign the cache. Fixtures must change byte length on every rewrite so the existing `(mtimeMs, size)` cache observes them without sleeps.

### Behavioral features, publication, and fixture libraries

**Files:** `features/marketplace/update.feature`, proposed `file-source-update.feature`, existing `info.feature`, marketplace publishing/update step modules, `published-marketplace.ts`, and `path-marketplace.ts`.

**Feature analog:** update.feature lines 7-24 already asserts both the envelope table and every marketplace row in emission order. Extend with reverse-lexical marketplace and installed-plugin insertion. The existing alpha/gamma project sequence cannot catch an accidental sort. Update info.feature line 34: its conventional-file expected source path currently equals the directory and conflicts with D-01.

**Step imports and world access**, publishing.steps.ts lines 15-32:

```typescript
import { type DataTable, Given } from "@cucumber/cucumber";

import {
  readOfferedPlugins,
  readOfferedPluginsWithDependencies,
} from "../../lib/path-marketplace.ts";
import { runCommand } from "../../lib/pi-commands.ts";
import {
  allowDependenciesOn,
  describeMarketplace,
  invalidateManifest,
  publishMarketplace,
  requireFreeRoot,
} from "../../lib/published-marketplace.ts";

import type { OfferedPlugin } from "../../lib/path-marketplace.ts";
import type { SourceKind } from "../../lib/published-marketplace.ts";
import type { ScenarioWorld } from "../../support/world.ts";
```

**Ownership/cleanup**, publishing.steps.ts lines 54-56:

```typescript
const root = await requireFreeRoot(this.marketplacesRoot, name, kind);
this.onRelease(() => rm(root, { recursive: true, force: true }));
this.recordPublished(name, await publishMarketplace(this.marketplacesRoot, name, kind, []));
```

The world owns published source kind and cleanup. Setup commands must assert success (publishing.steps.ts lines 88-97). Use typed anonymous `function (this: ScenarioWorld, ...)` steps, no exports, no implementation imports, and no module-level mutable state. Shared publication belongs in `publishing.steps.ts`; update-specific text belongs in `update.steps.ts`. Move any existing verb step to a shared topic in its own commit when a second verb needs it.

**Fixture dispatch:** published-marketplace.ts lines 45-49 stores `kind`, `root`, `source`; lines 113-131 dispatch dir/file versus unimplemented remote kinds. Existing file publication always uses the conventional location. External-file support must retain the authoritative filename for later rewrite/removal and must not be silently reset by `publishMarketplace`/`offer`. Keep fixture source paths distinct from their cleanup roots.

**Rewrite pattern**, path-marketplace.ts lines 126-131:

```typescript
const manifest = JSON.parse(await readFile(manifestPath(root), "utf8")) as Record<
  string,
  unknown
>;
manifest.description = description;
await writeFile(manifestPath(root), JSON.stringify(manifest));
```

Adapt the target path for an external file; do not copy the private conventional-path helper into steps. Existing malformed/schema-invalid writers are at lines 140-155. Put exact-path rewrites, controlled removals, and repair operations in the fixture library. Use different byte lengths, including whitespace padding for semantic no-op examples. `writeMarketplace` regenerates the catalog, so use field-preserving rewrites when testing a single property.

**Observable plugin version:** path-marketplace.ts lines 64-80 creates each plugin's manifest and skill description naming its version. Reuse `features/step_definitions/session.steps.ts` lines 24-30:

```typescript
When("the user starts a new pi session", async function (this: ScenarioWorld) {
  this.skills = await startSession(this.pi);
});

Then("the session offers these skills:", function (this: ScenarioWorld, table: DataTable) {
  const rows = this.sessionSkills().map((skill) => [skill.command, skill.description]);
  assert.deepStrictEqual([["command", "description"], ...rows], table.raw());
});
```

Use public list/info and config assertions for installed versions/enabled state; do not introduce behavioral reads of the new private baseline. A new session checks the user-visible version. Owner tests must additionally prove durable baseline round trips and failure preservation, since the long-lived Pi process can retain its manifest cache across sessions.

For the MCP scenario, extend local plugin publication to include a declaration and arrange commented scope adapter config in a fixture library. `features/lib/layer-config.ts` lines 77-87 is a partial analog for scoped, field-preserving config fixture writes, but it owns plugin config only. Do not overload its parser or the narrowly allowed config-writing step with unrelated MCP behavior. If a separate MCP fixture/step module is necessary, name that vertical explicitly and add it to plan ownership; no MCP fixture exists in the inspected behavioral library. The MCP program must not need to run to observe config staging.

### Complete Cucumber results and the known rowless notice

**File/analog:** `features/step_definitions/command.steps.ts`.

**Envelope comparison**, lines 158-162:

```typescript
Then("the command reports these results:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = this.allResults().map((result) => envelopeFields(result, this.tokens));
  assert.deepStrictEqual(recordTable(stated, records), table.raw());
});
```

Keep this complete comparison. `envelopeFields` at lines 92-98 excludes only schema version, origin, and row arrays; notice contents therefore remain in the envelope table. List every cascade and every notice in exact order, including tally fields and the full notice array.

**Row comparison:** lines 167-180 currently fail for every non-cascade payload. Admit only the recognized rowless `mcp-config-notices` case with zero rows; reject unknown kinds. Continue flattening all cascades through `pluginRecords` (lines 52-60), deep-compare the full table, then call `markRowsCompared`. Do not filter all non-cascades, filter failed plugins, sort, deduplicate, or select only the last result.

`features/lib/pi-commands.ts` lines 66-80 already returns every validated payload in emission order. `features/support/world.ts` lines 82-108 enforces single-result cardinality and exposes complete results; lines 172-177 fail a passing scenario with uncompared rows. Reuse these guards unchanged.

## Shared Patterns

- **Validation and errors:** use `loadMarketplaceManifest` and typed `InvalidMarketplaceManifestError`; update wraps refresh errors in `MarketplaceUpdateError` and renders a failed marketplace plus a synthetic failed child cause row. Missing original files must retain `source missing`, not a success against a decoy. No new authentication behavior is needed for this offline phase.
- **Persistence:** use the existing locked state transaction and atomic save. Baseline belongs to successful add/refresh. Invalid manifests, save failures, info/list reads, and plugin-cascade outcomes must not invent or advance a failed refresh baseline.
- **Notification ownership:** reuse `notifyWithContext` / `notifyMcpConfigNotices`; no direct stdout/stderr, aggregate marketplace failure replacement, or delayed notice collection across marketplaces.
- **Tests:** one owner test per changed production `.ts` file at the mirrored `tests/` path; 100% direct coverage per pair. No parallel test file or private test-only exports. Cucumber libraries and steps have no extra source-pair requirement.
- **Feature conventions:** two/three-line description, lowercase step text, `Given`/`When`/`Then` only, complete tables, `{home}` and `{scenario time}` tokens. Source-kind Outlines need at least three total rows; keep `@url`/`@github` blocks bound but excluded. File-only C-10 behaviors get a separate feature.
- **Checks:** focused owner/scenario checks during work, `npm run test:coverage:direct -- <source-path>` per changed pair, `npm run check:features` for all bindings/layout, `npm run check` at combined-tree wave/phase gates. Planning-only mapping did not run product tests.

## No Analog Found

Every primary file has an existing structural analog. These new behaviors have no complete existing implementation to copy:

| Concern | Role | Data Flow | Planning guidance |
| --- | --- | --- | --- |
| Durable last-successful whole-JSON baseline | model/service | file-I/O, transform | Combine the additive state-field convention with the existing refresh transaction; use research for equality and compatibility policy |
| External-manifest behavioral fixture | utility | file-I/O | Extend current local publication with exact-file identity; current file fixtures are conventional only |
| Commented MCP config behavioral fixture | utility/test | file-I/O | Reuse scenario scope/cleanup and local fixture conventions; choose a named MCP vertical if extracting a module |

## Planning Risks and Corrections

1. `06-VALIDATION.md` currently names nonexistent `features/step-definitions/marketplace.steps.ts`. The actual full-result owner is `features/step_definitions/command.steps.ts`. Fix plan/validation references, including the final C-10 feature filename and focused command.
2. Establishing a missing legacy local baseline as changed is the research recommendation, not a locked user decision. Name the chosen compatibility behavior and test it. Existing state seeds omit a baseline; deliberately distinguish fresh seeded baselines from legacy seeds so unrelated no-op cases retain their intended setup.
3. Capture raw comparison data before dependency normalization. Unknown fields on a tolerated invalid dependency entry must still affect comparison. Do not mutate the shared cache result or add an orchestrator filesystem-read shortcut.
4. `manifestPath` and `marketplaceRoot` are separate contracts. Exact-source info must include conventional files as well as external files. Retain managed-git stale-root correction and plugin containment semantics.
5. First capture a repository Cucumber red for C-10 before production edits. A refreshed info description alone is insufficient: info rereads the source even when update failed. Assert successful update plus refreshed content and exact source path.
6. Test failure continuation with an early failing plugin/marketplace followed by successful targets and reverse-lexical insertion order. Existing alphabetical fixture order and notices only at the end cannot prove the required ordering.
7. Preserve unchanged autoupdate collapse only when the manifest is unchanged and every plugin outcome is `unchanged`. A removed catalog entry produces its warning row and remains installed/enabled; a newly offered entry remains uninstalled.
8. Real-Pi startup failed inside the restricted environment during research; the approved isolated execution succeeded. Carry that execution distinction into red/green evidence. Do not replace behavioral proof with the temporary probe or weaken assertions.

## Metadata

**Analog search scope:** tracked marketplace orchestrators and paired tests; manifest/persistence boundaries; behavioral features, step modules, fixtures, driver, and world.
**Search method:** CodeGraph first for production call paths and step modules; targeted line reads for missing ranges and large owner tests; tracked-source checks with `git ls-files`.
**Primary pattern families:** refresh transaction/cascade, additive state/source identity, manifest validation, kind-aware fixtures, complete structured assertions.
**Coverage:** 16 exact existing-file assignments, 2 role-match new-file assignments, 0 primary files without a structural analog. Conditional MCP/cache files require explicit ownership if selected.
**Pattern extraction date:** 2026-10-18.
