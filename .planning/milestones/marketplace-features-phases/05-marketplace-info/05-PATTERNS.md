# Phase 5: Marketplace Info - Pattern Map

**Mapped:** 2026-10-18
**Files classified:** 8 (7 implementation files and 1 conditional documentation file)
**Analogs found:** 7 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
| --- | --- | --- | --- | --- |
| `features/marketplace/info.feature` | test | request-response | Existing scenarios in the same file, lines 7-70 | exact |
| `features/step_definitions/marketplace/info.steps.ts` (new) | test | request-response | `features/step_definitions/command.steps.ts:116-121` and `features/step_definitions/marketplace/add.steps.ts:55-65` | role-match; source-aware comparison is new |
| `features/step_definitions/marketplace/publishing.steps.ts` | test | file-I/O | Existing allowance registration, lines 73-78 | exact |
| `features/lib/published-marketplace.ts` | utility | file-I/O | Existing `allowDependenciesOn`, lines 158-170 | exact |
| `features/lib/path-marketplace.ts` | utility | file-I/O | Existing `writeDependencyAllowance`, lines 110-118 | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` | service | request-response | Existing independent per-scope classification, lines 161-209 | exact, with an ordering defect to correct |
| `tests/orchestrators/marketplace/info.test.ts` | test | request-response | Existing mixed-scope case, lines 945-1005 | exact, with stronger order verification needed |
| `docs/output-catalog.md` (conditional) | config (documentation contract) | transform | No new implementation analog needed | no analog; edit only a verified affected statement |

The five core implementation analogs are command steps, publishing steps, the two fixture libraries, and the info orchestrator. The add step and owner test are targeted supporting excerpts, not invitations to broaden the change. Every existing path named as an analog above was verified with `git ls-files -- <path>`; no installed capability mirror is an analog.

## Pattern Assignments

### `features/marketplace/info.feature` (test, request-response)

**Analog:** its existing complete-result directory scenario, lines 14-23:

```gherkin
    Then the result has these fields:
      | kind                    | marketplace-info          |
      | name                    | tools                     |
      | scope                   | project                   |
      | details autoupdate      | false                     |
      | details last updated at | {scenario time}           |
      | source kind             | path                      |
      | source abs path         | {home}/marketplaces/tools |
      | severity                | info                      |
      | needs reload            | false                     |
```

Convert this scenario to one four-kind Outline. Keep `dir` and `file` in an untagged Examples block, and `url` / `github` in their tagged blocks. Both local kinds report the marketplace root as `source abs path`; the file source input includes `.claude-plugin/marketplace.json`, but its output path does not. State description explicitly after plugin-offering setup. Remote rows state a nonempty ref and all applicable identity fields but remain excluded from runtime execution.

Retain the unscoped miss and the exact `plugin-info` invalid-manifest shape (lines 57-70). Strengthen healthy fan-out with distinct autoupdate values. Add both directed scoped misses, both mixed-validity directions, and a nonalphabetical allowed-marketplace list. Repeated allowance setup already exists; `zebra` then `alpha` discriminates a sorting defect. Scope-miss reasons are `marketplace not added to project scope` / `marketplace not added to user scope`, not a fabricated cross-scope wire flag.

### `features/step_definitions/marketplace/info.steps.ts` (test, request-response)

**Analog:** `features/step_definitions/command.steps.ts:116-121`:

```typescript
Then("the result has these fields:", function (this: ScenarioWorld, table: DataTable) {
  const stated = table.raw().map(([name]) => String(name));
  const fields = envelopeFields(this.lastResult(), this.tokens);
  const rows = namesLike(stated, new Set(fields.keys())).map((name) => [name, fields.get(name)]);
  assert.deepStrictEqual(rows, table.raw());
});
```

Use this complete comparison structure, not its literal registration or private helper. Import public primitives from `features/lib/field-rows.ts`. The new step text must name info. Start with an ownership `@fileoverview`; export nothing; use an anonymous function with `this: ScenarioWorld`. Follow the publishing module's import pattern: Node imports, Cucumber imports, relative `.ts` library imports, then separate type imports.

The new adapter must require exactly one payload via `this.lastResult()`, require the marketplace-info kind, and compare the entire public projection as strings against the explicit table. Preserve the established exclusions of `schemaVersion` and `origin` only. Keep severity, reload flag, description, all details including timestamp, and all source fields. Normalize run tokens through the existing flattening helpers.

Define blank cells narrowly: only the known inapplicable source-member cells in this Outline mean absent. Select applicable source members from the expected source kind stated in the table, never from the actual payload. Reject unknown or duplicate field names and contradictory nonempty source cells. Remove only these explicitly inapplicable expected entries before whole-value comparison; unexpected actual fields must still fail. Do not globally change `namesLike` or `recordTable`, drop arbitrary empty fields, or whitelist actual fields to the scenario's list.

**Independent same-name fixture analog:** `features/step_definitions/marketplace/add.steps.ts:58-64`:

```typescript
    const { kind } = this.requirePublished(name);
    const root = await requireFreeRoot(this.marketplacesRoot, location, kind);
    this.onRelease(() => rm(root, { recursive: true, force: true }));
    // Not recorded: the world keys marketplaces by name, so it would replace the first.
    await publishMarketplaceIn(this.marketplacesRoot, location, name, kind, [
      { name: "formatter", version: "1.0.0" },
    ]);
```

Reuse the library seam in an info-owned setup registration. Keep distinct directory identity and shared manifest name explicit. A minimal scenario can leave the first fixture name-keyed, publish a second same-name fixture in another directory without replacing it, add each source through public commands, and invalidate only the first fixture after both adds. Swap which scope receives that first fixture to exercise both directions. No extra world map is required for this arrangement. Register release before publication; assert command setup succeeds. Never import a step module or reuse add-specific step text from an info scenario. If genuinely shared wording is promoted, move it to publishing in a separate commit per D-08.

### `features/step_definitions/marketplace/publishing.steps.ts` (test, file-I/O)

**Analog:** lines 73-78:

```typescript
Given(
  "the marketplace {string} allows dependencies on the marketplace {string}",
  async function (this: ScenarioWorld, name: string, target: string) {
    await allowDependenciesOn(this.requirePublished(name), target);
  },
);
```

Add reusable description setup here using the same name lookup and library dispatch pattern. Keep kind branching and manifest reads below steps. Existing `offer` (lines 33-43) republishes the manifest, so features must state description and allowance after offering plugins. Do not add a default description globally.

### `features/lib/published-marketplace.ts` (utility, file-I/O)

**Analog:** lines 158-170:

```typescript
export async function allowDependenciesOn(
  published: PublishedMarketplace,
  target: string,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      await writeDependencyAllowance(published.root, target);
      return;
    case "url":
    case "github":
      throw noStandIn(published.kind);
  }
}
```

Add the description operation beside this one. Dispatch local inputs to a path fixture writer and retain explicit remote errors until their stand-ins arrive. Use existing `publishMarketplaceIn` (lines 112-130) for independent directory/name identity; do not create a second publisher. Error handling is fail-fast: let fixture errors reach Cucumber rather than catching to log.

### `features/lib/path-marketplace.ts` (utility, file-I/O)

**Analog:** lines 110-118:

```typescript
export async function writeDependencyAllowance(root: string, target: string): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath(root), "utf8")) as {
    allowCrossMarketplaceDependenciesOn?: string[];
  };
  manifest.allowCrossMarketplaceDependenciesOn = [
    ...(manifest.allowCrossMarketplaceDependenciesOn ?? []),
    target,
  ];
  await writeFile(manifestPath(root), JSON.stringify(manifest));
}
```

Implement a small description writer that preserves the manifest's other members. This module already imports `readFile` and `writeFile` from `node:fs/promises` (line 13) and centralizes the manifest path (lines 60-62). These are scenario-owned fixture writes, not an expansion of production mutation permissions. Preserve allowance insertion order. Use `writeInvalidManifest` (lines 127-131), which writes schema-invalid valid JSON, for the invalid-manifest contract; malformed JSON is a different behavior.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` (service, request-response)

**Analog:** existing error classification, lines 182-188:

```typescript
  for (const f of found) {
    try {
      // eslint-disable-next-line no-await-in-loop -- at most two scopes, one manifest block each
      blocks.push(await buildBlock(f.record, f.autoupdate));
    } catch (err) {
      failures.push(buildManifestFailureMessage(f.record, narrowProbeError(err), f.autoupdate));
    }
  }
```

Retain per-scope isolation and the `narrowProbeError` / `buildManifestFailureMessage` conversion. Correct the separate success/failure collection: keep one ordered outcome per candidate. When any outcome fails, notify each outcome in candidate order. When all succeed, preserve the existing bare block for one success and marketplace-info cascade for two successes.

**Existing all-success shape:** lines 196-200:

```typescript
  const [first, ...remaining] = blocks;
  if (first !== undefined && remaining.length === 0) {
    notify(opts.ctx, opts.run, first);
  } else if (first !== undefined) {
    notify(opts.ctx, opts.run, { kind: "marketplace-info-cascade", blocks: [first, ...remaining] });
  }
```

Do not copy the later success-first/failure-last emission order. Keep the shared scope collector, notification transport, manifest failure kind, and absence logic. No new notification union arm, transport, network activity, or source module is needed. Trace callers and run the prescribed architecture guard before execution edits.

### `tests/orchestrators/marketplace/info.test.ts` (test, request-response)

**Analog:** mixed-scope owner case, lines 948-952:

```typescript
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    const projectManifestPath = path.join(projectLocations.extensionRoot, "mixed.json");
    const userManifestPath = path.join(userLocations.extensionRoot, "mixed.json");
    await writeMarketplaceJson(projectManifestPath, "mixed-mp");
```

Reuse hermetic environment, distinct manifests, `saveMarketplace`, config seeding, and full filesystem snapshot comparison. Invoke the exported `getMarketplaceInfo`; do not export private builders for tests. Existing lines 978-992 specify exact notification messages and severity, and lines 1002-1004 verify unchanged files and boundary expectations.

The current case creates a healthy project and missing user manifest. Add the reversed direction first and require it to fail on current code. Make notification order an explicit assertion: `multiNotificationBoundary` (lines 83-115) registers expected calls but does not visibly declare an ordered-call constraint. Do not assume registration order proves invocation order. Use an allowed ordered interaction facility or an explicit complete recorded-call sequence. Retain exact payload/message and severity checks, both healthy coverage, single failure coverage, and both-failed coverage needed for direct branches. Behavioral mixed cases should use schema-invalid manifests as D-01 requires.

## Shared Patterns

### Whole multi-result comparison

**Source:** `features/step_definitions/command.steps.ts:158-162`.
**Apply to:** both mixed-scope scenarios, without a new comparator.

```typescript
Then("the command reports these results:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = this.allResults().map((result) => envelopeFields(result, this.tokens));
  assert.deepStrictEqual(recordTable(stated, records), table.raw());
});
```

Each emitted result is one row, with every field across the sequence represented. Standalone marketplace-info and failed plugin-info have no row arrays, so this table alone compares the complete sequence. Healthy cascades still require both envelope and block comparisons; their row assertion calls `markRowsCompared()` after success.

### Scope, auth, and error boundaries

There is no new authentication mechanism. Explicit scope remains a scope-selection boundary; it must not fall back. Existing not-added construction retains optional requested scope and the cross-scope indication. Production failures retain scope, autoupdate, failed plugin row, and unresolved components. Fixture and assertion failures bubble naturally; do not add catches that hide bad setup.

### Verification ownership

Focused behavioral verification is `npm run test:cucumber -- features/marketplace/info.feature`; binding/layout verification is `npm run check:features`, including excluded remote rows. Production edits additionally run `node --test tests/orchestrators/marketplace/info.test.ts` and the paired `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`. Required combined-tree wave/phase gates remain `npm run check`. Follow `05-VALIDATION.md` for failure clauses and evidence recording. The feature is shared across all slices, so implementation tasks that edit it must execute sequentially even if listed in the same wave.

## No Analog Found

| File / concern | Role | Data Flow | Reason |
| --- | --- | --- | --- |
| New info step's source-aware adapter | test | transform | Existing whole-result primitive is reusable, but no current adapter represents explicitly absent members across four source kinds. Follow the narrow contract above. |
| `docs/output-catalog.md` (conditional) | config (documentation contract) | transform | Documentation correction, not a code pattern. Research identifies a stale scoped-miss example; inspect the precise passage before deciding to change it. |

Do not change `features/lib/field-rows.ts`, the world, generic command steps, remote stand-ins, or `cucumber.json` merely to support these cases. Existing public seams are sufficient.

## Metadata

**Analog search scope:** marketplace feature and step modules, fixture libraries, marketplace info orchestrator, mirrored owner test.
**Implementation/source files inspected:** 9, plus phase documents and project rules.
**Pattern extraction date:** 2026-10-18.
**Tracked-source gate:** all 9 inspected source/test paths and the conditional catalog path were returned by `git ls-files`.
**Planning provenance:** `05-CONTEXT.md`, `05-RESEARCH.md`, `05-VALIDATION.md`; CodeGraph used before source inspection. No source files changed by this mapping task.
