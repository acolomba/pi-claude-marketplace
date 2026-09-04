# Phase 116: Edge Surface - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 30 test files (25 rewrites, 5 new)
**Analogs found:** 30 / 30 (7 groups, one worked excerpt each)

This document does **not** restate RESEARCH.md's `## Closest Analogs` or `## Don't Hand-Roll`
tables. Its value is the per-file mapping: which single existing owner each of the 30 plans
copies its shape from, and the one excerpt an executor lifts, so 30 separately-executed plans
land on one consistent file.

Every analog path below is git-tracked source, verified with `git ls-files`.

**Standing assumption for every excerpt:** `tests/helpers/notification-boundary.ts` has already
received its two wave-0 fixes — an optional `cwd` on the boundary and an explicit `toolProbes`
argument at every call site. Excerpts are written against that fixed version, not against HEAD.

## File Classification

Seven groups. The group is the unit of pattern reuse; the per-file delta column is the only
thing that varies inside a group.

| Group | Role | Data flow | Plans | Closest analog | Match |
|-------|------|-----------|-------|----------------|-------|
| **G1** | pure-function owner | transform (string → struct) | 116-01, -02, -04, -06 | `tests/orchestrators/import/refs.test.ts` | exact |
| **G2** | type-only owner | none (compile-time) | 116-30 | `tests/orchestrators/import/types.test.ts` + `tests/orchestrators/types.test.ts` | exact |
| **G3** | helper owner | transform + injected delegate | 116-12, -23, -26 | `tests/orchestrators/plugin/shared.test.ts` | exact |
| **G4** | handler owner **with** a seam | request-response, exact-arg delegation | 116-07, -13, -14, -17 | `tests/orchestrators/import/execute.test.ts:384-452` | exact |
| **G5** | handler owner **without** a seam | request-response, negative delegation proof | 116-08, -09, -10, -11, -15, -16, -18, -19, -20, -21, -22, -24, -25 | `tests/orchestrators/import/execute.test.ts` (boundary use only) | partial — see `## No Analog Found` |
| **G6** | read-only projection owner | file-I/O read + offline projection | 116-03, -05, -27 | `tests/orchestrators/edge-deps.test.ts:69-110` | exact |
| **G7** | registration / dispatch owner | event-driven wiring | 116-28, -29 | `tests/orchestrators/edge-deps.test.ts` (register) / `refs.test.ts` + `strong-mock` (router) | role-match |

### Per-file assignment

| Plan | Test file (under `tests/edge/`) | Group | New? |
|------|--------------------------------|-------|------|
| 116-01 | `args-schema.test.ts` | G1 | rewrite |
| 116-02 | `args.test.ts` | G1 | rewrite |
| 116-03 | `completions/data.test.ts` | G6 | rewrite |
| 116-04 | `completions/normalize.test.ts` | G1 | rewrite |
| 116-05 | `completions/provider.test.ts` | G6 | rewrite |
| 116-06 | `flag-catalog.test.ts` | G1 | **new** |
| 116-07 | `handlers/marketplace/add.test.ts` | G4 | rewrite |
| 116-08 | `handlers/marketplace/autoupdate.test.ts` | G5 | rewrite |
| 116-09 | `handlers/marketplace/info.test.ts` | G5 | rewrite |
| 116-10 | `handlers/marketplace/list.test.ts` | G5 | rewrite |
| 116-11 | `handlers/marketplace/remove.test.ts` | G5 | rewrite |
| 116-12 | `handlers/marketplace/shared.test.ts` | G3 | **new** |
| 116-13 | `handlers/marketplace/update.test.ts` | G4 | rewrite |
| 116-14 | `handlers/plugin/bootstrap.test.ts` | G4 | rewrite |
| 116-15 | `handlers/plugin/enable-disable.test.ts` | G5 | rewrite |
| 116-16 | `handlers/plugin/fetch.test.ts` | G5 | rewrite |
| 116-17 | `handlers/plugin/import.test.ts` | G4 | **new** (`git mv`, D-116-09) |
| 116-18 | `handlers/plugin/info.test.ts` | G5 | rewrite |
| 116-19 | `handlers/plugin/install.test.ts` | G5 | rewrite |
| 116-20 | `handlers/plugin/list.test.ts` | G5 | rewrite |
| 116-21 | `handlers/plugin/pending.test.ts` | G5 | rewrite |
| 116-22 | `handlers/plugin/reinstall.test.ts` | G5 | rewrite |
| 116-23 | `handlers/plugin/shared.test.ts` | G3 | **new** |
| 116-24 | `handlers/plugin/uninstall.test.ts` | G5 | rewrite |
| 116-25 | `handlers/plugin/update.test.ts` | G5 | rewrite |
| 116-26 | `handlers/shared.test.ts` | G3 | rewrite |
| 116-27 | `handlers/tools.test.ts` | G6 | rewrite |
| 116-28 | `register.test.ts` | G7 | rewrite |
| 116-29 | `router.test.ts` | G7 | rewrite |
| 116-30 | `types.test.ts` | G2 | **new** |

## Pattern Assignments

### G1 — pure-function owner (116-01, 116-02, 116-04, 116-06)

**Analog:** `tests/orchestrators/import/refs.test.ts`

The whole file is four imports and a flat sequence of `test()` bodies. No `describe()`, no
fixture, no context, no helper. Copy the file's skeleton verbatim and change the imports.

**Imports** (`tests/orchestrators/import/refs.test.ts:1-7`):

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  extractEnabledPluginRefs,
  parseEnabledPluginRef,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/refs.ts";
```

**Core case shape** (`:9-25`) — one `// arrange` naming the raw input, one `// act`, one
`// assert` against a whole-value literal written out by hand (D-116-03):

```ts
test("parseEnabledPluginRef accepts one separator and preserves the verbatim raw input", () => {
  // arrange
  const raw = "frontend-design@claude-plugins-official";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: true,
    ref: {
      marketplace: "claude-plugins-official",
      plugin: "frontend-design",
      raw: "frontend-design@claude-plugins-official",
    },
  });
});
```

**Rejection shape** (`:44-56`) — a rejection is the same three phases with the diagnostic string
written out, never re-derived:

```ts
  // assert
  assert.deepEqual(result, {
    ok: false,
    reason: "Expected exactly one @ separator in plugin@marketplace ref.",
  });
```

**Per-file deltas:**

| Plan | Delta from the analog |
|------|-----------------------|
| 116-01 `args-schema` | `parseCommandArgs` routes failure to an **injected `onError` callback**, not a return value. Record calls with a `const errors: string[] = []` closure and assert the array whole-value; the double is a plain function, not a mock — it is the module's own declared parameter. |
| 116-02 `args` | Pure tokenizer, no callback. Closest to the analog with zero change. Two uncovered branches at HEAD (br 25/26, ln 86/89) — find them from the source, do not sample. |
| 116-04 `normalize` | Same as 116-02. Two uncovered branches (br 6/8). |
| 116-06 `flag-catalog` | **Does not use whole-value output assertions on catalog contents.** `tests/architecture/flag-catalog-drift.test.ts` already pins the per-verb flag sets exactly; restating them is the D-116-12 violation. Assert the *transformation* instead — order preservation, `description` present only when the entry has one, the scope-target exclusion in `passThroughFlagNames` — using the smallest discriminating verb per branch (`info` = one entry with a description, `fetch` = zero entries, `uninstall` = one entry without). |

**Exhaustiveness:** none of these four carries a claim. Each plan states that explicitly
(Pitfall 6).

---

### G2 — type-only owner (116-30)

**Analogs:** `tests/orchestrators/import/types.test.ts` for scale and file shape;
`tests/orchestrators/types.test.ts` for the two `@ts-expect-error` placements D-116-13 requires.

`edge/types.ts` declares one 3-member interface, so the file is short: a type-only import block,
positive `satisfies` bindings, and the negatives. **No runtime cases, no `test()`, no
`node:test` import at all.**

**Positive binding + optional-member proof** (`tests/orchestrators/import/types.test.ts:46-51`):

```ts
const claudeSettingsReadOptions: ClaudeSettingsReadOptions = {
  cwd: "/work/project",
  claudeConfigDir: "/home/user/.claude",
} satisfies ClaudeSettingsReadOptions;
void claudeSettingsReadOptions;
void ({} satisfies ClaudeSettingsReadOptions);
```

The bare `void ({} satisfies …)` line is the positive proof that every member is optional. For
`EdgeDeps` the equivalent proof is that `{ gitOps, pluginUpdate }` satisfies it **without**
`importClaudeSettings`.

**Negative placement — single-line `satisfies`, marker goes ABOVE**
(`tests/orchestrators/types.test.ts:335-336`):

```ts
// @ts-expect-error an update outcome always carries its partition discriminant
void ({ declaresAgents: false, declaresMcp: false, name: "alpha" } satisfies PluginUpdateOutcome);
```

**Negative placement — multi-line `satisfies`, marker goes on the LAST PROPERTY LINE**
(`tests/orchestrators/types.test.ts:244-249`). This is the D-116-13 trap: the diagnostic lands
on the closing line, so a marker above the opening brace attaches to nothing and passes
silently.

```ts
void ({
  marketplace: "official",
  name: "alpha",
  notes: [],
  scope: "project",
  // @ts-expect-error a reinstall outcome always carries its partition discriminant
} satisfies ReinstallPluginOutcome);
```

**Readonly negatives — the function-parameter pattern** (`tests/orchestrators/types.test.ts:559-577`):

```ts
function proveReadonlyContracts(
  reinstall: ReinstallReinstalledOutcome,
  /* … */
): void {
  // @ts-expect-error reinstall outcome scalar fields are readonly
  reinstall.version = "3.0.0";
}

void proveReadonlyContracts;
```

`EdgeDeps` declares all three members `readonly`, so 116-30 carries this function with three
assignment negatives.

**Deltas / boundaries for 116-30:**

- Pin only `EdgeDeps`'s own required-vs-optional split. `GitOps` and `PluginUpdateFn` are
  imported from other pairs; `PluginUpdateFn`'s contract is already owned by
  `tests/orchestrators/types.test.ts:196-201,464-480`. Do not re-pin it.
- Do **not** enumerate the member set and do **not** assert the export surface (D-116-12).

---

### G3 — helper owner (116-12, 116-23, 116-26)

**Analog:** `tests/orchestrators/plugin/shared.test.ts`

This is the shape for a multi-export helper module: one flat import block naming every export
under test, module-local type aliases derived from the production types, small typed fixture
builders, and `describe()` blocks grouping cases per export.

**Import block + derived aliases** (`tests/orchestrators/plugin/shared.test.ts:1-50`, condensed):

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  applyPartialCascadeFold,
  assertNoCrossPluginConflicts,
  /* … every export, alphabetical … */
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];
```

**The injected-delegate case** — this is the whole reason D-116-07 puts the proof here. Both
`makeSingleNameMarketplaceHandler(pi, usage, run)` and `withParsedArgs(parse, usage, run)` take
`run` as a real parameter, so the exact-argument mock from G4 applies directly at this tier.
Use the G4 excerpt below, with the delegate type derived from the module's own signature:

```ts
type Run = Parameters<typeof makeSingleNameMarketplaceHandler>[2];
const run = mock<Run>({ exactParams: true, name: "marketplace run" });
```

**Per-file deltas:**

| Plan | Exports | Delta |
|------|---------|-------|
| 116-26 `handlers/shared` | 1 (`extractLocalFlag`) | No `describe()` needed — a single export means the G1 flat shape plus a `createNotificationBoundary(1, 0)` for the `notifyUsageError` rejection path. Must cover: the `--scope <value>` pair consumption without value validation, `SCOPE_TARGET_FLAG` recognition, pass-through preservation, unknown-`--`-flag rejection, removal of **every** `--local` token from `residualArgs`, and the `tok === undefined` guard. |
| 116-12 `marketplace/shared` | 3 | Two `describe()` blocks: `makeSingleNameMarketplaceHandler` (exact-arg mock on `run`) and `openMarketplaceCommand` (WB-01 ordering — `extractLocalFlag` first, then `parseCommandArgs`; the duplicate-usage case collapses to `"Missing required argument."`). |
| 116-23 `plugin/shared` | 7 | Largest new file. Five `describe()` blocks. `splitPluginMarketplaceRef` and `parseMapModelArgs` are G1-shaped; `withParsedArgs` is the exact-arg-mock shape. `parsePositionalsWithFlags` is module-private — reach it only through its exported callers, never by exporting it (the pair rule forbids exporting a symbol for a test). |

**Contract for the 19 handler owners that import these:** assert only that the helper was given
the right arguments and that its residual reached the next stage. Do not re-prove
flag-position independence or ref splitting in a handler owner.

---

### G4 — handler owner **with** a seam (116-07, 116-13, 116-14, 116-17)

**Analog:** `tests/orchestrators/import/execute.test.ts:384-452`

This is the one completed `strong-mock` + `when` + `verify` case in the repo that states a
**whole options object**. It is the literal D-116-05 shape.

**Derive every double's type from the module's own seam** (`tests/orchestrators/import/execute.test.ts:53-70`).
Copy this discipline, not just the mock call — it makes a seam change a compile error in the
suite instead of a silently stale hand-copied type:

```ts
// Every collaborator shape below is derived from the module's own `ImportDeps`,
// so a change to the injection seam is a compile error in this suite rather than
// a silently stale hand-copied type.
type GitOps = NonNullable<ImportClaudeSettingsOptions["gitOps"]>;
type InstallPlugin = NonNullable<ImportDeps["installPlugin"]>;
type InstallOptions = Parameters<InstallPlugin>[0];
```

**Exact-argument delegation case** (`:384-452`, condensed to the load-bearing lines):

```ts
test("records a marketplace the state does not carry and installs its declared plugin", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "add-and-install");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1);
  const installPlugin = mock<InstallPlugin>({ exactParams: true, name: "install plugin" });
  when(() =>
    installPlugin({
      ctx,
      cwd,
      marketplace: "mp",
      notifications: { mode: "orchestrated" },
      pi,
      plugin: "plugin",
      scope: "user",
    }),
  ).thenResolve(installedOutcome());

  // act
  const importResult = await importClaudeSettings({ /* … */ });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [{ message: "…" }]);
  verifyBoundary();
  verify(installPlugin);
});
```

The four load-bearing pieces to copy: `mock<T>({ exactParams: true, name })`, a `when()` stating
the **complete** options object (no `It.isAny()` — the verify grep bans it), `verifyBoundary()`,
and a trailing `verify(theMock)`.

**Per-file deltas:**

| Plan | Seam | Delta |
|------|------|-------|
| 116-17 `plugin/import` | **Group A** — `deps.importClaudeSettings?` is the orchestrator itself | The literal analog. `mock<NonNullable<ImportHandlerDeps["importClaudeSettings"]>>` + a `when()` stating `{ ctx, pi, cwd, selectedScopes, gitOps }` in full. The `?? importClaudeSettings` fallback is a **separate branch**: cover it by omitting the member and letting the real orchestrator run against a hermetic tree (G6's `createHermeticScope`). Carries the `git mv` in the same commit (Pitfall 3). |
| 116-07 `marketplace/add` | **Group B** — `deps.gitOps` | The proof available is that the handler forwards the *identical port object* into the orchestrator's options bag. Use `createGitOpsFake({ boundary: "memory" })` from `tests/platform/git-ops-fake.ts` and assert against its typed `calls` recorder; do not hand-roll a `{ clone, fetch }` literal. |
| 116-13 `marketplace/update` | **Group B** — `deps.gitOps`, `deps.pluginUpdate` | Same as 116-07, with the additional `pluginUpdate` port. Two orchestrator targets (`updateMarketplace` / `updateAllMarketplaces`) selected by arity — the selection itself is edge-owned and must be exhaustive. |
| 116-14 `plugin/bootstrap` | **Group B** — `deps.gitOps` | Same as 116-07. **Uses `createNotificationBoundary(emissions)` with the default `toolProbes`**, because `bootstrap.ts` calls `notify()`, which runs the soft-dependency probe (Pitfall 1). |

---

### G5 — handler owner **without** a seam (13 plans)

`marketplace/{autoupdate,info,list,remove}` and
`plugin/{enable-disable,fetch,info,install,list,pending,reinstall,uninstall,update}`.

**Analog:** `tests/orchestrators/import/execute.test.ts` for the boundary usage only. The
negative-delegation case itself has no compliant precedent — see `## No Analog Found`.

Per the locked O3 decision, these owners deliver **complete edge-side coverage** plus the
D-116-06 **negative** proof, and state the exact-argument gap in `must_haves`.

The paired source is uniformly shaped. `edge/handlers/plugin/uninstall.ts:18-42` is the
canonical instance — a `pi`-only factory, two early `undefined` returns, one orchestrator call
with two conditional spreads:

```ts
export function makeUninstallHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    const localFlag = extractLocalFlag(args, ctx, USAGE);
    if (localFlag === undefined) { return; }
    const parsed = parseRequiredPluginMarketplaceRef(localFlag.residualArgs, ctx, USAGE);
    if (parsed === undefined) { return; }
    await uninstallPlugin({ ctx, pi, /* … two conditional spreads … */ });
  };
}
```

**Worked excerpt — the D-116-06 negative case (the group's signature shape):**

```ts
test("rejects an unknown flag before the uninstall workflow runs", async () => {
  // arrange
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
  const handler = makeUninstallHandler(pi);

  // act
  await handler("alpha@official --bogus", ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Unknown flag: --bogus\n${USAGE}`, severity: "error" },
  ]);
  verifyBoundary();
});
```

Why this is a genuine "no state-changing workflow ran" proof, and not just an error assertion:
`createNotificationBoundary(1, 0)` sizes the boundary at exactly **one** emission. The handler's
own usage error consumes it. Any orchestrator notification would be a second `ctx.ui` access
past its `times(1)` count, which throws at the call site, and `verifyBoundary()` then fails with
`The following calls were unexpected`. The orchestrator cannot have run.

**Two mandatory arguments, both non-default:**

- `emissions = 1` for a single usage error. `toolProbes = 0` is required because
  `notifyUsageError` does **not** run the soft-dependency probe; the helper's `emissions * 2`
  default leaves an unmet `getAllTools()` expectation (Pitfall 1).
- `enable-disable.ts` is the one exception in this group: it calls `notify()`, so it keeps the
  **default** `toolProbes`.

**Positive-delegation minimal effect.** With no seam, observe delegation as one minimal
effect — the orchestrator's own notification through the same boundary, sized exactly. Do not
re-derive the orchestrator's outcome value; Phases 113-115 own it at 100 percent direct coverage
(D-116-05).

**Per-file deltas:**

| Plan | Delta |
|------|-------|
| 116-08 `marketplace/autoupdate` | Imports `extractLocalFlag`. Uncovered at HEAD: br 13/14, fn 3/4. |
| 116-09 `marketplace/info` | Built on `makeSingleNameMarketplaceHandler`; the delegation assertion targets the **helper's `run` parameter**, which 116-12 owns. Read-only — add `refuseNetwork` + `fetchCallCount() === 0` (SC-4). |
| 116-10 `marketplace/list` | Read-only — SC-4 offline proof required. |
| 116-11 `marketplace/remove` | Built on `makeSingleNameMarketplaceHandler`, same as 116-09. |
| 116-15 `plugin/enable-disable` | **Default `toolProbes`** (calls `notify()`). Two modes from one boolean factory argument — both arms exhaustively. |
| 116-16 `plugin/fetch` | 3 exports, not 1. |
| 116-18 `plugin/info` | Read-only — SC-4 offline proof required. |
| 116-19 `plugin/install` | Largest flag matrix in the group (`--map-model`, `--partial`, `--scope`, `--local`). |
| 116-20 `plugin/list` | Read-only — SC-4. `export { BOOLEAN_FLAGS }` at `:82` stays; record it as an observation for Phase 117 and take no action. Do not restate `scope-fences-63.test.ts`'s hook-column guard. |
| 116-21 `plugin/pending` | Read-only — SC-4. |
| 116-22 `plugin/reinstall` | Imports `extractLocalFlag`. |
| 116-24 `plugin/uninstall` | The canonical instance quoted above. Passes coverage today (Pitfall 4 — re-measure after the rewrite). |
| 116-25 `plugin/update` | Largest existing test (401 LOC, 18 cases) being replaced. |

**Exhaustiveness:** none of the 13 carries a claim. Each plan states the absence explicitly.

---

### G6 — read-only projection owner (116-03, 116-05, 116-27)

**Analog:** `tests/orchestrators/edge-deps.test.ts:69-110` for the hermetic scope and the
offline proof; `tests/shared/completion-cache.test.ts:24+` for `describe()` grouping over a
large data surface.

**File header stating what the suite does and does not own**
(`tests/orchestrators/edge-deps.test.ts:1-14`). Copy this convention — it is what keeps a large
owner from drifting into another pair's territory:

```ts
// Owner suite for `orchestrators/edge-deps.ts::makeLocationsResolver`, …
//
// The status vocabulary this suite pins is owned by
// `tests/orchestrators/plugin/plugin-state-classifier.test.ts`; every expected
// status here is a written-out literal, never a value this suite derives by
// re-running the production classification it is checking.
```

**Hermetic scope + offline proof** (`tests/orchestrators/edge-deps.test.ts:69-110`) — copy
whole, changing only the label prefix:

```ts
function refuseNetwork(): Promise<Response> {
  throw new Error("the completion resolver must not reach the network");
}

async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `edge-deps-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `edge-deps-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(async () => {
    if (homeExisted) { process.env.HOME = previousHome; } else { delete process.env.HOME; }
    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  const fetchSpy = t.mock.method(globalThis, "fetch", refuseNetwork);
  return { cwd, home, fetchCallCount: () => fetchSpy.mock.callCount() };
}
```

Three details that are load-bearing and easy to lose: `t.after()` is registered **before** the
act (a `finally` leaks when the case throws early); `PI_CODING_AGENT_DIR` must be **deleted**,
because `getAgentDir()` reads it before `homedir()` so a hermetic `HOME` alone does not isolate;
and the offline assertion is `fetchCallCount() === 0`, never an error-message match.

**Per-file deltas:**

| Plan | Delta |
|------|-------|
| 116-03 `completions/data` | 610 LOC, 12 exports, worst function coverage in the phase (fn 25/31). `describe()` per export, `tests/shared/completion-cache.test.ts` shape. Constrained by `partial-vocabulary-guard.test.ts` — do not restate retired force/partial tokens. |
| 116-05 `completions/provider` | 1 export, 335 LOC, replacing a 1,670-line non-compliant file. `pluginRefBranchConfig` switches on open `string` with `default: return null` — **no exhaustiveness claim**; state its absence (Pitfall 6). Must not restate `flag-catalog-drift.test.ts`'s per-verb completion-label pins. |
| 116-27 `handlers/tools` | Carries the **entire D-116-14 obligation** (locked to this plan only). Plant a deleted arm in `projectRowStatus:161`, `statusLabel:210`, `statusKey:253` and confirm `npm run typecheck` goes RED. Plant the same in `pluginVersion:367` (`string \| undefined`), observe typecheck stays **GREEN**, and record that as the finding — then close the gap with a runtime case per reachable status value. Read-only: SC-4 offline proof required. |

---

### G7 — registration / dispatch owner (116-28, 116-29)

**116-28 `register.ts` — analog: `tests/orchestrators/edge-deps.test.ts`**

`register.ts` is registration glue built from `EdgeDeps`, the same category as `edge-deps.ts`.
Copy its file header convention and its hermetic scope (`register.ts` holds the one sanctioned
`process.cwd()` site, so the case must own its working directory). Uncovered at HEAD:
**fn 7/9** — two registered callbacks are never invoked; each must be captured off the
registration mock and called.

Do **not** assert that the `SubcommandHandlers` record has every key. That record is
compile-enforced at `register.ts:79-99` — a missing key fails to satisfy the interface, and
testing it is exactly what D-116-12 forbids.

**116-29 `router.ts` — analog: `tests/orchestrators/import/refs.test.ts` (G1) plus the G4
`strong-mock` verify**

`routeClaudePlugin` is a pure function over an injected `SubcommandHandlers` record, so the
seam is real and the G4 exact-argument shape applies directly: mock the handler record, state
`when(() => handlers.install(rest, ctx))`, `verify()`. The subcommand and alias matrix is the
G1 row-table shape.

Both `switch` sites (`router.ts:148`, `:197`) switch on `head`, which is open `string` peeled
from raw user input, and both have a `default:` arm. **There is no exhaustiveness guarantee to
prove or lose.** A planted "missing arm" here produces a behavior change, not a compiler
diagnostic — that is a normal runtime case. State the absence in the plan so a verifier does
not go hunting for a plant with no target.

## Shared Patterns

### Pi notification boundary

**Source:** `tests/helpers/notification-boundary.ts` (assume the wave-0 fixed version)
**Apply to:** every owner in G3, G4, G5, G6, G7 — roughly 25 of the 30 plans

```ts
import { createNotificationBoundary } from "../../helpers/notification-boundary.ts";

const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 0);
// … act …
assert.deepStrictEqual(notifications, [{ message: "…", severity: "error" }]);
verifyBoundary();
```

Never hand-roll `{ notify: (m, s) => notifications.push(...) } as unknown as ExtensionCommandContext`.
All 25 existing files do exactly that; it is the single largest source of the `as unknown as`
count the phase is removing, and a drifted copy weakens the IL-2 sizing proof silently.

`toolProbes`: `0` for `notifyUsageError` paths (the great majority), the default for the two
handlers that call `notify()` — `plugin/bootstrap.ts` and `plugin/enable-disable.ts`.

### Exact-argument interaction mock

**Source:** `tests/orchestrators/import/execute.test.ts:53-70, 384-452`
**Apply to:** G3 (all three helpers), G4 (all four handlers), G7 (router)

```ts
type Run = Parameters<typeof makeSingleNameMarketplaceHandler>[2];   // derive from the seam
const run = mock<Run>({ exactParams: true, name: "marketplace run" });
when(() => run({ /* the complete options object, every member stated */ })).thenResolve(…);
// … act …
verify(run);
```

`It.isAny()`, `anyTimes()`, and `verifyAll()` are all banned by the per-plan verify grep.

### Git port double

**Source:** `tests/platform/git-ops-fake.ts:76` — `createGitOpsFake({ boundary: "memory", … })`
**Apply to:** 116-07, 116-13, 116-14, 116-17 (the four handlers carrying `deps.gitOps`)

Already typed against the production `GitOps` and already records calls in a typed `calls`
recorder. Never a `{ clone: () => …, fetch: () => … }` object literal.

### Hermetic tree + offline proof

**Source:** `tests/orchestrators/edge-deps.test.ts:69-110`
**Apply to:** the eight read-only owners — 116-03, 116-05, 116-09, 116-10, 116-18, 116-20,
116-21, 116-27 — plus 116-17's real-orchestrator fallback branch and 116-28.

### Marketplace state seeding

**Source:** `tests/helpers/marketplace-seed.ts` — `buildInstalledPluginRecord`,
`mergeMarketplaceIntoState`, `seedAutoupdateConfig`, `materializeMarketplaceTree`
**Apply to:** any owner that must present a realistic state tree (116-03, 116-05, 116-27, and
116-17's fallback branch).

### Facts a gate already enforces — do not restate

**Apply to:** every plan. Each of these is a D-116-12 violation if written as a case.

| Fact | Gate that owns it | Affected plans |
|------|-------------------|----------------|
| No `process.stdout` / `process.stderr` / `console.*` writes | `eslint.config.js:94-140` BLOCK A + `.fallowrc.json` `boundaries.calls.forbidden` | all 30 |
| Per-verb flag catalog contents; completion labels per verb | `tests/architecture/flag-catalog-drift.test.ts` | 116-06, 116-05, 116-20 |
| No `/claude:plugin hooks` handler; no hook column on `list` | `tests/architecture/scope-fences-63.test.ts` | 116-20, 116-29 |
| Retired force/partial vocabulary absent | `tests/architecture/partial-vocabulary-guard.test.ts` | 116-03, 116-05 |
| No `["user","project"]` literal outside the canonical `SCOPES` | `tests/architecture/scope-order-drift.test.ts` | every owner that touches scope |
| `SubcommandHandlers` record completeness | the TypeScript compiler at `register.ts:79-99` | 116-28 |
| Unused export detection | `fallow dead-code` `unused-export` | 116-30 |
| Path containment (NFR-10) | Phase 109's owners | all handler plans |

## No Analog Found

| File group | Role | Data flow | Reason |
|------------|------|-----------|--------|
| **G5's negative-delegation case** (13 plans) | handler owner without a seam | request-response | No compliant precedent exists. The proof mechanism — `createNotificationBoundary(1, 0)` sizing the boundary so an orchestrator emission would be a second `ctx.ui` access past its `times(1)` count — was measured in research, not lifted from an existing owner. The worked excerpt under **G5** above is therefore **normative for this phase**: the first plan in wave 3 establishes it and the remaining twelve copy it verbatim. It needs its own D-116-04 plant (delete an early `return` in the handler, confirm the case goes RED). |
| `tests/helpers/notification-boundary.ts` wave-0 change | helper | — | The helper is its own precedent; the `cwd` option and explicit `toolProbes` are new. Wave 0 needs a negative control of its own, plus a re-run of every suite found by `grep -rl createNotificationBoundary tests/`. |

## Metadata

**Analog search scope:** `tests/orchestrators/**`, `tests/shared/**`, `tests/helpers/**`,
`tests/platform/**`, `tests/architecture/**`, `extensions/pi-claude-marketplace/edge/**`
**Analogs read in full or in targeted range:** 8 (`import/refs.test.ts`,
`import/types.test.ts`, `orchestrators/types.test.ts`, `import/execute.test.ts`,
`edge-deps.test.ts`, `plugin/shared.test.ts`, `completion-cache.test.ts`,
`helpers/notification-boundary.ts`), plus `tests/platform/git-ops-fake.ts`,
`edge/types.ts`, and `edge/handlers/plugin/uninstall.ts`
**Tracked-source gate:** all analog paths verified with `git ls-files`; no gitignored mirror
paths emitted
**Pattern extraction date:** 2026-09-02
