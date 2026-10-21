# Phase 4: Marketplace Remove and List - Pattern Map

**Mapped:** 2026-10-18
**Files analyzed:** 4 planned modification targets; 3 conditional targets classified separately
**Analogs found:** 4 / 4 planned targets
**Scope:** Tests and the approved project decision record. Research found no production rewrite justified.

## File Classification

| New/Modified File                                    | Role                     | Data Flow                         | Closest Analog                                                                                                                           | Match Quality |
| ---------------------------------------------------- | ------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `.planning/PROJECT.md`                               | config (decision record) | transform                         | Existing D-MF-03/D-MF-04 rows in the same file, lines 1255-1256                                                                          | exact         |
| `features/marketplace/remove.feature`                | test                     | request-response, file-I/O        | Existing scenarios in the same file; source-kind shape in `features/marketplace/add.feature:7-34`                                        | exact         |
| `features/marketplace/list.feature`                  | test                     | request-response                  | Same-file empty case, lines 6-12; populated list in `features/marketplace/remove.feature:95-112`                                         | exact         |
| `tests/integration/marketplace-layer-remove.test.ts` | test                     | batch, file-I/O, request-response | Same-file injected cascade, lines 347-385; partial-continuation owner case in `tests/orchestrators/marketplace/remove.test.ts:1245-1418` | exact         |

The following paths are mentioned or implied upstream, but do not need speculative edits:

| Conditional File                                        | Role                        | Data Flow        | Closest Analog                                                  | Disposition                                                                                             |
| ------------------------------------------------------- | --------------------------- | ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                             | config (managed guidance)   | transform        | Its existing managed Project block, especially Scope model      | Synchronize the approved decision ID only if the PROJECT.md constraints carried into that block change. |
| `features/step_definitions/marketplace/remove.steps.ts` | utility (step registration) | request-response | `features/step_definitions/marketplace/add.steps.ts:1-23,37-42` | Create only for a used, removal-specific step that existing steps cannot express.                       |
| `features/step_definitions/marketplace/list.steps.ts`   | utility (step registration) | request-response | `features/step_definitions/marketplace/add.steps.ts:1-23,37-42` | Create only for a used, listing-specific step that existing steps cannot express.                       |

Reuse the existing publication, command, config, plugin, and session modules. Do not create a verb module merely because its feature grows. Keep the owner unit test as a reference; new multi-module partial-cascade behavior belongs in the integration file. No production source, notification schema, dependency, runner, or source-tag change is presently planned.

## Pattern Assignments

### `.planning/PROJECT.md` (config, transform)

**Analog:** Its decision table, lines 1253-1256. The table uses a stable ID, the decision, the reason/licensed divergence, and a status. D-MF-05 was absent when mapped.

**Existing decision excerpt** (line 1256, first clause):

> **D-MF-04 (marketplace-features): each scope owns its marketplace records and clones**

**Assignment:** Record D-MF-05 before pinning unscoped removal in scenarios. The approved decision must state all of the following:

- Without `--scope`, resolve a recorded project marketplace before a recorded user marketplace. If only user contains the name, select user.
- Select scope before checking the requested base/local layer. A project-local-only match refuses flagless removal; it does not fall through to user base.
- Report only the selected scope's removal row. Keep the other scope's declaration and record; add no warning or unchanged row for it.
- Explicitly identify the divergence from Claude Code 2.1.296's documented unscoped removal across every scope, as approved in Phase 4 D-01. Use the upstream evidence already recorded in RESEARCH.md; this map did not repeat that research.

Suggested decision-table wording, to adapt to the existing row format:

```markdown
| **D-MF-05 (marketplace-features, user decision 2026-10-18): unscoped marketplace removal selects project before user** — remove only the first recorded scope; use user when it is the sole match; resolve scope before the base/local layer and refuse a layer mismatch without falling through; report only the selected scope's result | Preserves the approved project-first behavior and independent scope ownership. Explicit divergence from Claude Code 2.1.296, whose unscoped remove removes declarations from every scope | — Pending |
```

This is a proposed record of an already approved choice, not a new product decision. Imports, authentication and error handling do not apply to this documentation target.

### `features/marketplace/remove.feature` (test, request-response/file-I/O)

**Primary analog:** Existing removal feature. Keep its existing layer, dependency-retention and cross-scope cases.

**Clean removal envelope and row** (lines 14-21):

```gherkin
    When the user runs "/claude:plugin marketplace remove tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | project | removed |
```

Adapt this to an ordinary base-layer remove with no installed plugins. Assert the target declaration is gone and any control declaration remains. Use a source-kind Outline, preserving all four kinds and remote Examples exclusions.

**Source-kind Outline excerpt:** `features/marketplace/add.feature:21-34`:

```gherkin
    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |
```

If setup uses the existing `the marketplace "tools" is added to the project scope` step, the source-only Examples layout already exists in `remove.feature:328-341`. The publication step consumes `<source kind>`; the shared add step resolves that published source. An Outline has at least three total variants, counting excluded rows.

**Cascade children** (`remove.feature:153-160`):

```gherkin
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id          | name  | status      | reasons | scope   |
      | tools            | project           | removed            | alpha@tools | alpha | uninstalled |         | project |
      | tools            | project           | removed            | lib@tools   | lib   | uninstalled |         | project |
```

For ordinary cascade order, install at least three independent plugins in a deliberately nonalphabetical order. Keep an unrelated marketplace/plugin as a survivor witness. Compare every row without sorting.

**Failure and unchanged-state analogs:**

- Lines 44-59: full local-layer-only failure, including cause, empty leak/rollback cells, unchanged local declaration and absent base config. Add a user-base declaration to prove scope-before-layer refusal.
- Lines 189-215: a dependent blocks removal and both installed skills survive. Expand to two nonalphabetical blocked plugins and one otherwise removable plugin; assert every blocker in discovery order, no uninstalled row, no reload, and unchanged declarations/artifacts.
- Lines 29-42: removal as Given setup, a new session, then marketplace list and config absence. Apply to clean base-layer removal.
- Lines 307-326: full plugin-list envelope and rows after a removal. Use the shared empty-marketplace result assertion when the plugin list is completely empty, or assert all unrelated survivors.

**Persistence:** Use separate focused scenarios for new-session skills, plugin-list absence, and marketplace-list absence. `features/step_definitions/session.steps.ts:24-35` already registers session startup, full skill-table comparison, and `the session offers no skills`.

**Missing marketplace:** It is a standalone `marketplace-not-added` result, not a cascade. Pin the complete envelope for both explicit-scope absence directions, elsewhere-present variants, and bare absence. Explicit requested scope remains a wire field even when terminal wording differs; `presentInOtherScope` is conditional. Use the complete result step to distinguish absent fields from invented empty fields.

**Alias and precedence:** Add complete-result `rm`, both-scope project-first, and sole-user fallback cases. Existing layer cases are setup/analogs, not substitutes for those witnesses.

### `features/marketplace/list.feature` (test, request-response)

**Analog:** Empty-list seed in the same file, lines 6-12; populated-list shape in `features/marketplace/remove.feature:101-112`.

```gherkin
    When the user runs "/claude:plugin marketplace list"
    Then the result has these fields:
      | kind                | cascade          |
      | severity            | info             |
      | needs reload        | false            |
      | tally label         | Marketplace list |
      | tally failures      | 0                |
      | tally warnings      | 0                |
      | tally success count | 1                |
    Then the result lists these marketplaces:
      | name  | scope   | details autoupdate | details last updated at |
      | tools | project | false              | {scenario time}         |
```

**Assignment:** Expand the populated witness to several marketplaces per scope, inserted in nonalphabetical order, with project names sorting after user names. Expected rows put every project row first, preserving each scope's insertion order. Mix autoupdate values through public commands, including effective local overrides if needed; assert `{scenario time}` for every new record. List rows have no status field. Empty list has no tally; do not copy the populated envelope onto the existing empty case.

Give each scope filter and populated `ls` alias a complete ordered expected inventory. Public command setup and existing publication steps suffice; no dedicated list step is currently required. The alphabetically arranged rendering example in `docs/output-catalog.md:2411-2427` is explicitly a presentation illustration, not the command's ordering oracle.

### `tests/integration/marketplace-layer-remove.test.ts` (test, batch/file-I/O/request-response)

**Primary analog:** Same-file real lifecycle plus injected failure, lines 347-385. **Secondary analog:** `tests/orchestrators/marketplace/remove.test.ts:1245-1418`, exact partial state and continuation/retry.

**Imports convention** (integration file lines 10-13):

```typescript
import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
```

Use existing concrete relative `.ts` imports and type-only imports. The file already has production add/remove/install functions, hermetic environment setup, a local git fake and real state/config readers. Its `projectScope` (lines 112-121), `addRepo` (123-144), and `installFrom` (147-168) exercise real persistence and staging.

**Failure injection** (lines 354-368):

```typescript
const failAlpha: typeof cascadeUnstagePlugin = (plugin, ...rest) =>
  plugin === "alpha"
    ? Promise.resolve({
        ok: false,
        dropped: {
          agents: [],
          commands: [],
          hooks: [],
          mcpServers: [],
          skills: [],
          workflows: [],
        },
        cause: Object.assign(new Error("alpha denied"), { code: "EACCES" }),
      })
    : cascadeUnstagePlugin(plugin, ...rest);
```

Use independent plugin names in an interleaved sequence such as success `zebra`, failure `yak`, success `amber`, failure `birch`. Delegate successful branches to the real cascade. This simultaneously distinguishes continuation, success/failure grouping, and within-group insertion order from alphabetic order. Add a separate failure-only case. Do not add environment failpoints, permission-dependent failures, or production exports.

**Real footprint** (lines 307-316):

```typescript
async function removeFootprint(scope: ProjectScope): Promise<readonly unknown[]> {
  const cloneDir = await scope.locations.sourceCloneDir("mp");
  return [
    await readFile(scope.locations.stateJsonPath, "utf8"),
    await readIfPresent(scope.locations.baseConfigJsonPath),
    await readIfPresent(scope.locations.localConfigJsonPath),
    await entriesOf(cloneDir),
    await readFile(path.join(cloneDir, ".claude-plugin", "marketplace.json"), "utf8"),
    await entriesOf(scope.locations.skillsTargetDir),
  ];
}
```

For failure-only removal, compare the full footprint before and after. For mixed removal, assert the complete surviving marketplace/plugin state, unchanged declaration bytes, retained clone and marketplace data, and the exact remaining staged skill directories. The owner case compares complete partial state at lines 1362-1398 and unchanged config bytes at line 1399. Do not assert that mixed removal leaves the whole footprint unchanged.

**JSON notification composition:** Reuse `createMachineNotificationBoundary("json")` from `tests/edge/notification-boundary.ts:142-162`:

```typescript
const capture = createJsonCapture();
const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
when(() => ctx.mode)
  .thenReturn(mode)
  .times(1);
const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
```

The factory returns `ctx`, `run`, `capture`, and `verifyBoundary`. Use the existing TUI boundary for setup, then call `removeMarketplace` directly with the machine boundary's `ctx` and `run` and the injected cascade. The local `removeMp` helper (lines 170-184) hardcodes `runWithNothingLoaded()`, so it cannot capture JSON just by receiving a different context. A direct call avoids changing a shared helper unnecessarily.

Compare **all** `capture.entries` to an independently written expected payload; call `capture.assertValid()` and both boundaries' verification methods. `tests/edge/json-capture.ts:28-47` validates the custom entry type, JSON values and published notification schema, retaining validation failures even if production handles an emission exception.

The mixed payload must contain a failed marketplace block, all successful children first in execution order, all failed children next in discovery order, error severity, summary, and envelope `needsReload: true`. The failure-only payload has no success child and `needsReload: false`. Child JSON rows do not have `needsReload` or severity fields: those are internal message stamps, while reload belongs to the wire envelope. Do not extend the closed schema.

**Important persistence distinction:** Partial removal keeps desired config declarations, so a later reload may reinstall a successful removal. Assert immediate persisted partial state here; use clean removals for RM-03/RM-04 session persistence. Command-wide rollback would violate D-04.

## Shared Patterns

### Whole results and ordered rows

**Source:** `features/step_definitions/command.steps.ts:116-139`. **Apply to:** both feature files; reuse these registrations unchanged.

```typescript
Then("the result lists these marketplaces:", function (this: ScenarioWorld, table: DataTable) {
  const [stated = []] = table.raw();
  const records = marketplaceRecords(this.lastResult(), this.tokens);
  assert.deepStrictEqual(recordTable(stated, records), table.raw());
  this.markRowsCompared();
});
```

The plugin counterpart at lines 123-132 carries marketplace fields into every child and rejects non-cascade payloads. Marketplace-only comparison rejects hidden plugin children (lines 79-86). The envelope excludes only schema/origin and separately asserted row arrays (lines 30-39, 92-98). Reuse it; do not add subset assertions, row sorting, or field-dropping projections.

### Exact time-window validation

**Source:** `features/lib/run-tokens.ts:25-29`. **Apply to:** list timestamps.

```typescript
function isScenarioTime(value: string, startedAt: number): boolean {
  const at = Date.parse(value);
  return (
    !Number.isNaN(at) && new Date(at).toISOString() === value && at >= startedAt && at <= Date.now()
  );
}
```

The `{scenario time}` token already rejects stale, future and malformed timestamps. No sleeps or time-existence assertions are needed.

### Setup, isolation and guards

**Source:** `features/step_definitions/command.steps.ts:101-104`:

```typescript
Given("the user has run {string}", async function (this: ScenarioWorld, command: string) {
  const payload = await runCommand(this.pi, expandTokens(command, this.tokens));
  assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
});
```

Setup commands fail immediately when their precondition fails. The world owns scenario resources; integration cases use the existing case-owned environment. Authentication is not a new surface here. The relevant guards are scope/layer selection, dependency preflight, local fixture containment and schema validation. Let assertion and fixture exceptions propagate; do not log and swallow them.

### Verification assignment

- Feature editing feedback: `npm run test:cucumber -- features/marketplace/remove.feature features/marketplace/list.feature` and `npm run check:features`.
- Integration editing feedback: `node --test tests/integration/marketplace-layer-remove.test.ts`.
- Combined-tree wave and phase gates: `npm run check`, per local-verification. A commit hook or focused run is not a full gate.
- Preserve random scenario order and the existing `@url`/`@github` exclusions. The feature gate checks excluded Examples too.

This mapping ran no tests and claims no new passing runtime evidence. The research's focused baseline remains historical evidence for its unchanged inputs.

## No Analog Found

None for the four planned targets. There is no demonstrated portable real-Pi input that deterministically fails midway through a cascade; that is a fixture limitation, addressed by the existing integration injection seam. It does not justify new production hooks.

## Metadata

**Analog search scope:** `features/marketplace/`, marketplace and shared step modules, existing feature token helper, marketplace removal integration/owner tests, notification test boundaries, `.planning/PROJECT.md`.
**Strong code analogs selected:** 5 — remove feature, list feature, add Outline, removal integration, removal owner case. Decision-table and cross-cutting helpers were inspected separately.
**Tracked-source gate:** All analog and shared-pattern source paths named above were verified with `git ls-files -- <path>`; no installed capability mirror is used.
**Discovery:** CodeGraph was queried first for code discovery; targeted reads filled its omitted sections. Large owner test was located by search and read only around the partial case.
**Pattern extraction date:** 2026-10-18.
**Skills applied:** Cucumber layout/features/steps/world rules, TypeScript test pairing/cases/doubles/boundaries, TypeScript style conventions, and local-verification commands/gates.
