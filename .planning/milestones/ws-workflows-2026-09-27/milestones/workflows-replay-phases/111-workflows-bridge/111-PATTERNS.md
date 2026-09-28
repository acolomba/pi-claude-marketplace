# Phase 111: Workflows bridge - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 10 (5 new owner tests, 3 extended tests, 1 config, 1 modified integration test)
**Analogs found:** 10 / 10
**Every analog path below is git-tracked source** (verified with `git ls-files`).

The five production files under `bridges/workflows/` are a verbatim port from
`features/workflow-port-wip`; they are NOT in this map because they are not
authored here. This map covers only the files this phase writes.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/bridges/workflows/discover.test.ts` (NEW) | test | file-I/O read | `tests/bridges/skills/discover.test.ts` | exact |
| `tests/bridges/workflows/stage.test.ts` (NEW) | test | file-I/O write + transactional | `tests/bridges/commands/stage.test.ts` | exact |
| `tests/bridges/workflows/unstage.test.ts` (NEW) | test | file-I/O delete | `tests/bridges/commands/unstage.test.ts` | exact |
| `tests/bridges/workflows/types.test.ts` (NEW) | test | type-only (no runtime) | `tests/bridges/commands/types.test.ts` | exact |
| `tests/bridges/workflows/index.test.ts` (NEW) | test | barrel re-export identity | `tests/bridges/commands/index.test.ts` | exact |
| `tests/persistence/locations.test.ts` (EXTEND) | test | config/derivation | itself (in-file cases) + `tests/platform/workflow-home.test.ts` for the `HOME` case | exact |
| `tests/shared/errors-bridges.test.ts` (EXTEND) | test | pure constructor | `AgentForeignContentError` case in the same file | exact |
| `tests/shared/extension-version.test.ts` (EXTEND) | test | constant | itself (one-line literal edit) | exact |
| `.fallowrc.json` (MODIFY) | config | static config | the `bridges-hooks` zone triple in the same file | exact |
| `tests/integration/workflow-kind-inversion.test.ts` (MODIFY) | test | integration | itself (invert one block, change fixture body) | n/a |

**Structural warning that overrides "copy the sibling":** the five
`tests/bridges/commands/*.test.ts` files predate the v1.19 unit-testing rule and
use flat top-level `test()` even for multi-entrypoint modules. Copy them
**case-for-case, not structurally**. Under the current rule:

- `discover.test.ts`, `unstage.test.ts` — single-entrypoint, cases at top level,
  **no** `describe()`.
- `stage.test.ts` — three entrypoints, one `describe()` per entrypoint.
- `index.test.ts` — one `describe()` per re-exported binding.
- `types.test.ts` — no `describe()`, no `test()`; it is a compile-time file.

The rule-conformant structural model to imitate is
`tests/domain/workflow-script.test.ts` (Phase 110, written under v1.19).

---

## Shared Patterns

These four apply to more than one of the new files. Apply them first.

### S1. Hermetic `$HOME` relocation — MANDATORY for every test that builds a `ScopedLocations`

**Source (the cleanest in the repo, and the one to copy):**
`tests/platform/workflow-home.test.ts:22-36`

```ts
async function hermeticHome(t: TestContext, label: string): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), `workflow-home-${label}-`));
  const previousHome = process.env.HOME;

  t.after(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  return home;
}
```

Three load-bearing details, all documented in that file's own docblock
(`tests/platform/workflow-home.test.ts:9-21`) — copy the docblock's reasoning
too:

1. `t.after()` is registered **before** `process.env.HOME` is assigned, so a
   failing assertion cannot leave the developer's environment relocated.
2. An absent variable is `delete`d, never reassigned — `process.env`
   stringifies, so restoring an absent var by assignment yields the literal
   string `"undefined"`.
3. The helper **returns** the new home; the caller never re-reads
   `process.env.HOME` (a read needs `?? ""` under `strictNullChecks`, which
   converts a broken precondition into a silent cwd-relative probe).

**Ordering rule:** call this **before** `locationsFor(...)`. `locationsFor`
evaluates `workflowHomeDir()` eagerly and `Object.freeze`s the result, so a
bundle built before the relocation points at the developer's real
`~/.pi/workflows/` and the test still passes while writing there.

**DO NOT COPY** `tests/bridges/hooks/event-router.test.ts:99-120`. Verified
still wrong as of this phase: it assigns `process.env.HOME` and
`process.env.PI_CODING_AGENT_DIR` at lines 101-102 and only registers `t.after`
at line 103. Phase 110's PATTERNS.md flagged this; the finding stands.

### S2. Relocating `process.platform` (for `discover.ts`'s `pathDedupKey` darwin/win32 arm)

**Source:** `tests/bridges/hooks/async-rewake/registry.test.ts:2170-2180`

```ts
function setCasePlatform(t: TestContext, platform: NodeJS.Platform): void {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  if (descriptor === undefined) {
    throw new Error("process.platform descriptor is unavailable");
  }

  t.after(() => {
    Object.defineProperty(process, "platform", descriptor);
  });
  Object.defineProperty(process, "platform", { ...descriptor, value: platform });
}
```

Same ordering rule as S1 — `t.after` before the mutation — and it captures the
**original descriptor** rather than reconstructing one. Its call sites mark the
test `{ concurrency: false }` (`registry.test.ts:2182-2184`); do the same for
any workflows case that relocates a process global, since the runner would
otherwise interleave it with a sibling case reading the same global.

### S3. Obtaining a `ScopedLocations` (branded type — no object literal will typecheck)

**Source:** `tests/bridges/commands/stage.test.ts:24-30`

```ts
async function createProjectLocations(t: TestContext, prefix: string): Promise<ScopedLocations> {
  const scopeRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", scopeRoot);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}
```

The workflows variant must interleave S1: `hermeticHome(t, …)` first, then
`mkdtemp` the scope root, then `locationsFor`. Note `maxRetries: 3` on the `rm`
— present in the commands/unstage/registry helpers, absent in
`skills/discover.test.ts`; prefer the retrying form.

`tests/persistence/locations.test.ts:113-120` shows how the brand is observed
rather than constructed:

```ts
const brandKeys = Object.getOwnPropertySymbols(locations);
assert.strictEqual(brandKeys.length, 1);
assert.strictEqual(Reflect.get(locations, brandKeys[0]!), true);
```

Because the brand is an **enumerable own symbol**, object spread copies it — so
RESEARCH §Pattern 3's override works as written and needs no cast:

```ts
{ ...locationsFor("project", cwd), workflowArtifactPath: custom }
```

That is the only reachable seam for `displacePreviousTargets` and the CR-01
restore-failure branch. There is no in-repo precedent for spreading a
`ScopedLocations` — this is new, and worth a short comment saying why the seam
exists.

### S4. Building a `ResolvedPluginInstallable` fixture

**Source:** `tests/bridges/skills/discover.test.ts:17-30` (shorter) and
`tests/bridges/commands/stage.test.ts:37-58` (parameterised).

```ts
function resolvedPlugin(pluginRoot: string, skills: readonly string[]): ResolvedPluginInstallable {
  return {
    installable: true,
    state: "installable",
    name: "acme",
    pluginRoot,
    supported: ["skills"],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [...skills], commands: [], agents: [], workflows: [] },
    mcpServers: {},
    defaultEnabled: true,
  };
}
```

For workflows: `supported: ["workflows"]` and populate
`componentPaths.workflows`. Note the `[...paths]` spread — the field is mutable
in the type and the fixture must not alias the caller's array.

### S5. The two mandatory style conventions

**`import-x/order`** — builtin → external → internal → parent → sibling → index
→ object → type; blank line between groups; alphabetized case-insensitively.
Real example, `tests/bridges/commands/stage.test.ts:1-19`:

```ts
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { abortPreparedCommands, /* … */ } from "…/bridges/commands/stage.ts";
import { locationsFor } from "…/persistence/locations.ts";
import { ManualRecoveryError } from "…/shared/errors.ts";

import type { ResolvedPluginInstallable } from "…/domain/resolver.ts";
import type { ScopedLocations } from "…/persistence/locations.ts";
```

Note `import { test, type TestContext }` — an inline `type` specifier stays in
the value import. A *separate* `import type { … }` statement goes in the trailing
type group. Both forms coexist in one file and both are correct.

The mixed inline-type-last-inside-the-braces form is
`tests/domain/source.test.ts:4-12` and `tests/domain/workflow-script.test.ts:4-17`
— value names first, `type X` names after, all inside the same braces,
alphabetized within each half:

```ts
import {
  admitWorkflowScript,
  assertNoWorkflowNameCollisions,
  fileStem,
  WORKFLOW_SCRIPT_EXTENSIONS,
  type AdmittedWorkflow,
  type NamedWorkflow,
  // …
} from "../../extensions/pi-claude-marketplace/domain/workflow-script.ts";
```

This is the form the owner tests should use, because the corresponding-test gate
requires every export — including type-only ones — to be imported by a
**relative specifier resolving to the source path**.

**`@stylistic/padding-line-between-statements`** — a blank line after every
block-like statement. Visible in every excerpt above; the sharpest examples are
the blank line after the `if (descriptor === undefined) { … }` guard in S2 and
after the `t.after(async () => { … })` call in S1. Also
`tests/platform/workflow-home.test.ts:31` — a blank line inside the `t.after`
callback, after the closing `}` of the `if/else`, before the `await rm(...)`.

---

## Pattern Assignments

### `tests/bridges/workflows/discover.test.ts` (test, file-I/O read)

**Analog:** `tests/bridges/skills/discover.test.ts` (406 lines) — closest by
size and by being single-entrypoint. Cross-check case coverage against
`tests/bridges/commands/discover.test.ts` (703).

**Structure:** flat top-level `test()`, no `describe()` (single entrypoint).
Two helpers only: `createPluginRoot` (S4's sibling at
`skills/discover.test.ts:11-15`) and `resolvedPlugin` (S4).

**Empty-result shape**, `tests/bridges/skills/discover.test.ts:32-42`:

```ts
test("returns no skills when the plugin declares no skill paths", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-empty-");
  const resolved = resolvedPlugin(pluginRoot, []);

  // act
  const discovery = await discoverPluginSkills({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, { discovered: [], warnings: [] });
});
```

Copy the whole-object `deepStrictEqual` — never assert
`discovery.discovered.length`.

**Symlink refusal / permission cases:** `skills/discover.test.ts` imports
`chmod` and `symlink` from `node:fs/promises` (line 2) for exactly the D-14 and
lstat-throw arms the workflows discover needs. Same import list applies.

**No `ScopedLocations` needed** — `discoverPluginWorkflows` takes
`{ pluginName, resolved }`. So this file does **not** need S1. It **does** need
S2 for the `pathDedupKey` darwin/win32 branch.

**Criterion-4 case:** assert the exact warning string for a stem-fallback
script, with `assert.deepStrictEqual(discovery.warnings, [expected])` on the
whole array, so an extra spurious row fails the case.

---

### `tests/bridges/workflows/stage.test.ts` (test, file-I/O write + transactional)

**Analog:** `tests/bridges/commands/stage.test.ts` (1,091 lines). This is the
single richest source in the map.

**Structure:** three `describe()` blocks — `prepareStageWorkflows`,
`commitPreparedWorkflows`, `abortPreparedWorkflows`. (The analog is flat; do
not copy that.)

**Helpers to lift:** `createProjectLocations` (S3, adapted with S1),
`createPluginRoot` (`stage.test.ts:32-36`), and `pathIsPresent`
(`stage.test.ts:60-65`):

```ts
async function pathIsPresent(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}
```

**Happy-path lifecycle shape** (`stage.test.ts:67-115`): arrange the plugin
tree, `prepareStage…`, `commitPrepared…`, then read the committed bytes, then
one block of assertions beginning `assert.strictEqual(prepared.kind, "staged")`
followed by a whole-object `assert.deepStrictEqual(prepared.result, {...})`.

For WBRG-01, RESEARCH says bytes are the contract — so at least one case must
`assert.strictEqual` the **complete file text**, including the two-space indent
and trailing newline, rather than `JSON.parse` it.

**Rollback assertion shape — "nothing left behind"**
(`stage.test.ts:620-634`). This is the exact shape for the workflows rollback
cases:

```ts
// act
const error = await commitPreparedCommands(prepared).then(
  () => undefined,
  (reason: unknown) => reason,
);
const alphaExists = await pathIsPresent(alphaTarget);
const stagingExists = await pathIsPresent(prepared.stagingRoot);
const blockerBytes = await readFile(path.join(betaTarget, "blocker.txt"), "utf8");

// assert
assert.ok(error instanceof Error);
assert.strictEqual(alphaExists, false);
assert.strictEqual(stagingExists, false);
assert.strictEqual(blockerBytes, "keep blocker\n");
```

Note the `.then(() => undefined, (reason: unknown) => reason)` idiom: it
captures the rejection **without** ending the act block, so post-failure
filesystem observations can be made before any assertion runs. Prefer it over
`assert.rejects` whenever the case also inspects the disk.

**Rename-failure injection via a property getter** (`stage.test.ts:657-672`) —
the house technique, and the only lever into the rollback branches:

```ts
const alphaPair = prepared._renamePairs.find((pair) => pair.to.endsWith("acme:alpha.md")) as
  { from: string; to: string } | undefined;
assert.ok(alphaPair);
const actualFrom = alphaPair.from;
let fromReads = 0;
delete (alphaPair as Partial<typeof alphaPair>).from;
Object.defineProperty(alphaPair, "from", {
  configurable: true,
  enumerable: true,
  get() {
    fromReads += 1;
    return fromReads === 1 ? actualFrom : rollbackBlocker;
  },
});
```

`_renamePairs` is a frozen **array** whose elements are plain mutable objects,
so `Object.defineProperty` on an element works.

⚠ The analog's *other* injection — "make the target a non-empty directory"
(`stage.test.ts:654-656`) — does **not** transfer.
`commitPreparedWorkflows` runs `assertTargetsUnoccupied` before its first
rename, so a directory at a target yields `WorkflowTargetOccupiedError`, not a
rename failure. Use the getter on `to` (read once by the occupancy check, again
by the rename loop) or on `from`.

**Leak-vs-manual-recovery discrimination** (`stage.test.ts:680-686`): asserts
`assert.notStrictEqual(error.name, "ManualRecoveryError")` plus an
`assert.match` on the leak suffix. The leak-string half is the one sanctioned
message-substring assertion in the file; class-and-field assertions are the rule
everywhere else.

---

### The WR-06 refusal — "the failure happened BEFORE the write"

This is the pattern the phase most needs and the one with the weakest in-repo
precedent. The closest real analog is `tests/bridges/commands/stage.test.ts:704-716`
("propagates a non-missing previous-prompt removal failure"), which asserts the
error **and** that the pre-existing bytes survived:

```ts
// act
const error = await commitPreparedCommands(prepared).then(
  () => undefined,
  (reason: unknown) => reason,
);
const abortLeak = await abortPreparedCommands(prepared);
const childBytes = await readFile(path.join(blockedPreviousTarget, "child.txt"), "utf8");

// assert
assert.ok(error instanceof Error);
assert.match(error.message, /(EISDIR|EPERM)/);
assert.strictEqual(abortLeak, undefined);
assert.strictEqual(childBytes, "keep child\n");
```

`tests/bridges/commands/unstage.test.ts:29-56` supplies the complementary
half — proving a directory holds **exactly** the expected entries and nothing
more:

```ts
assert.deepStrictEqual(await readdir(locations.promptsTargetDir), ["other:keep.md"]);
assert.strictEqual(await readFile(foreignPromptPath, "utf8"), "foreign bytes\n");
```

**No in-repo test asserts a callback stayed empty on a refusal.** That half of
WR-06 — `onPlaced` reports `[]` — is new. Compose the three:

1. class-and-field rejection (RESEARCH §Code Examples supplies the exact form,
   `error instanceof WorkflowTargetOccupiedError` + `error.targetPath`, never a
   message substring);
2. `onPlaced` recorded `[]` — capture calls into a local array and
   `assert.deepStrictEqual(placed, [[]])` so a *missing* call and an
   *empty-argument* call are distinguished;
3. `readdir` of `workflowsSavedDir` plus the foreign bytes read back
   byte-identical, per the unstage excerpt above.

Assertion (2) is the load-bearing one: WR-01/WR-02 say the caller's removal
payload comes from `onPlaced`, never from the error type.

---

### `tests/bridges/workflows/unstage.test.ts` (test, file-I/O delete)

**Analog:** `tests/bridges/commands/unstage.test.ts` (254 lines).

Flat top-level `test()` (single entrypoint — the analog's structure is correct
here). Its scope helper (`unstage.test.ts:16-27`) returns a small record so a
case can reach both the directory and the bundle:

```ts
interface CommandScope {
  readonly directory: string;
  readonly locations: ScopedLocations;
}

async function createCommandScope(t: TestContext, prefix: string): Promise<CommandScope> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", directory);
  await mkdir(locations.promptsTargetDir, { recursive: true });
  return { directory, locations };
}
```

Adapt: interleave S1, and `mkdir(locations.workflowsSavedDir)`.

Three cases to carry over verbatim in shape:

- removal in recorded order + foreign bytes preserved (`:29-56`), asserting
  `Object.isFrozen(...)` on **both** returned arrays;
- empty recorded list → `{ removedNames: [], warnings: [] }` (`:58-72`);
- repeated unstaging is a missing-file fixed point (`:74-…`).

The workflows result carries a third field, `failed: UnstageWorkflowFailure[]`
(WLIF-03), so every `deepStrictEqual` gains that key — and the whole-object
comparison is what makes the extra field impossible to forget.

Imports `PathContainmentError` / `SymlinkRefusedError` from
`shared/path-safety.ts` (`unstage.test.ts:9-12`) for the containment arms.

---

### `tests/bridges/workflows/types.test.ts` (test, type-only)

**Analog:** `tests/bridges/commands/types.test.ts` (221 lines). Exact shape
match; there is no closer thing in the repo and no rule-era replacement — this
file has **no `test()` and no `describe()`** at all, and that is correct
(`scripts/test-coverage-direct.mjs` classifies `types.ts` as `type-only`, so no
coverage is owed; only the corresponding-test gate is).

**Three moves, all from the analog:**

1. One `import type { … }` block naming **every** type export (`:1-15`).
2. Per type, a `const x: T = {…} satisfies T;` followed by `void x;` (`:17-22`):

```ts
const discoveredCommand: DiscoveredCommand = {
  sourceName: "build/deploy",
  generatedName: "acme:build:deploy",
  commandFile: "/plugin/commands/build/deploy.md",
} satisfies DiscoveredCommand;
void discoveredCommand;
```

`undefined!` is the sanctioned stand-in for an opaque collaborator field
(`:25,30` use it for `locations` and `resolved`) — this keeps the type file from
importing runtime code.

3. Union membership and discriminant pins, then negative `@ts-expect-error`
cases (`:82-90`):

```ts
void (preparedCommandsNoop satisfies PreparedCommandsStaging);
void (preparedCommandsStaged satisfies PreparedCommandsStaging);
void (preparedCommandsNoop.kind satisfies "noop");
void (preparedCommandsStaged.kind satisfies "staged");

// @ts-expect-error a discovered command always records its command file
const discoveredCommandWithoutFile: DiscoveredCommand = { … };
```

Every `@ts-expect-error` carries a one-line prose reason on the same comment —
copy that discipline; a bare `@ts-expect-error` reads as a suppression.

---

### `tests/bridges/workflows/index.test.ts` (test, barrel)

**Analog:** `tests/bridges/commands/index.test.ts` (174 lines). Again the only
shape in the repo for this, and it is rule-conformant (`describe()` per binding).

Unlike `types.ts`, `index.ts` **does** owe 100% direct coverage — it transpiles
to real re-export statements. The analog proves it is reachable.

**Move 1 — import each runtime symbol twice, aliasing the defining one**
(`index.test.ts:4-23`): once from the barrel, once from `discover.ts` /
`stage.ts` / `unstage.ts` under a `defining…` alias. Then one `describe()` per
binding (`:70-80`):

```ts
describe("abortPreparedCommands", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedAbortPreparedCommands = definingAbortPreparedCommands;

    // act
    const commandsAbortPreparedCommands = abortPreparedCommands;

    // assert
    assert.strictEqual(commandsAbortPreparedCommands, expectedAbortPreparedCommands);
  });
});
```

Five bindings → five `describe()` blocks.

**Move 2 — type-identity pins via a `Same<>` helper** (`:25-46`):

```ts
import type * as CommandsBarrel from "…/bridges/commands/index.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

void (true satisfies Same<BarrelCommandsReplacement, DefiningCommandsReplacement>);
void (true satisfies Same<PreparedCommandsNoop["kind"], "noop">);
```

`Extract<BarrelPreparedCommandsStaging, { kind: "noop" }>` recovers the arms
the barrel deliberately does not export.

**Move 3 — prove the barrel keeps the internals private** (`:61-69`):

```ts
// @ts-expect-error the barrel keeps the staged implementation type private
void (true satisfies Same<CommandsBarrel.PreparedCommandsStaged, never>);
```

This is the assertion for the workflows barrel's stated non-re-export rule
(`PreparedWorkflowsNoop` / `PreparedWorkflowsStaged` are the two of thirteen
types the barrel withholds).

⚠ **Do not reach a module through the barrel in its own owner test** — the
corresponding-test gate has a `proxy-owned` verdict for exactly that. The double
import above is what keeps `index.test.ts` legal.

---

### `tests/persistence/locations.test.ts` (EXTEND)

**Analog:** itself. Two edits, both mechanical, plus one new case.

**Edit 1 — `LOCATION_KEYS`** (`locations.test.ts:11-38`) is an exhaustive
**ordered** `as const` array compared with
`assert.deepStrictEqual(Object.keys(locations), LOCATION_KEYS)` in both bundle
cases (`:115`). The port inserts three fields and one method; RESEARCH Pitfall 2
supplies the measured order (`workflowsHomeDir`, `workflowsSavedDir`,
`workflowsStagingDir` after `marketplaceNamesCacheFile`, and
`workflowArtifactPath` last).

**Edit 2 — leave `fixedLocationBundle()` (`:40-63`) alone.** It asserts
*values*, and the three new values are `$HOME`-derived; adding them would make
the two existing cases home-dependent. The existing cases keep working precisely
because that helper projects a fixed subset.

**New case:** a third, `HOME`-relocated case (S1) asserting the three new values
and the `workflowArtifactPath` composition. Model its env save/restore on the
in-file `restoreAgentDirectory` helper (`:65-71`), which pairs
`Object.hasOwn(process.env, …)` with the saved value so an absent variable is
restored as absent — the same hazard S1 handles for `HOME`.

RESEARCH §Q5 also asks for the EXDEV-guard invariant here: two bundles under one
relocated `HOME` with different `PI_CODING_AGENT_DIR` and different cwd, asserting
`workflowsStagingDir` is byte-identical across both and inside neither bundle's
`scopeRoot` / `extensionRoot`. Shape it as one whole-object `deepStrictEqual`
over a small named-boolean record, the way
`tests/platform/workflow-home.test.ts:66-74` does:

```ts
assert.deepStrictEqual(
  {
    underWorkingDirectory: workflowHome.startsWith(projectCwd),
    legacyProjectPath: workflowHome === path.join(projectCwd, ".pi", "workflows", "saved"),
  },
  { underWorkingDirectory: false, legacyProjectPath: false },
);
```

Named booleans, not bare `assert.strictEqual(x, false)` — the diff names which
invariant broke.

---

### `tests/shared/errors-bridges.test.ts` (EXTEND — `WorkflowTargetOccupiedError`)

**Analog:** the `AgentForeignContentError` block in the same file (`:22-55`).

```ts
describe("AgentForeignContentError", () => {
  test("exposes the complete foreign-content refusal", () => {
    // arrange
    const targetPath = "/scope/agents/foreign.md";
    const reason = "missing marker";

    // act
    const error = new AgentForeignContentError(targetPath, reason);

    // assert
    assert.ok(error instanceof AgentForeignContentError);
    assert.ok(error instanceof PathContainmentError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      { name: error.name, message: error.message, /* … */ cause: error.cause },
      { name: "AgentForeignContentError", message: "…", /* … */ cause: undefined },
    );
  });

  test("keeps adjacent target paths and reasons distinct", () => { /* … */ });
});
```

Three moves worth copying exactly: the `instanceof` ladder over the **whole**
prototype chain; one whole-object `deepStrictEqual` of every field including
`cause: undefined`; and a second "keeps adjacent … distinct" case using
near-miss inputs (`"/scope/agents/a.md"` vs `"/scope/agents/aa.md"`, `:58-60`)
to prove the message is composed rather than prefix-matched.

The file's header also shows the type-export pattern for this module (`:13-20`):
an `import type` plus a `satisfies` + `@ts-expect-error` pair, since the owner
test must consume every export.

---

### `tests/shared/extension-version.test.ts` (EXTEND — one literal)

**Analog:** itself (15 lines, read in full).

```ts
test("exports the checked-in extension version", () => {
  // arrange
  const expectedVersion = "0.18.1";
  // …
});
```

Change the one literal. Per the version-bump checklist the bump also touches
`package.json`, `package-lock.json`, `shared/extension-version.ts`,
`sonar-project.properties` `projectVersion` and `CHANGELOG.md`, and
`tests/architecture/extension-version-sync.test.ts` compares the constant to
`package.json`. **`pre-commit` does not run the suite that guards this literal**
(the four local hooks are lint/format/typecheck/fallow only) — re-run `npm test`
by hand after the bump.

---

### `.fallowrc.json` (MODIFY — the `bridges-workflows` zone)

**Analog:** the `bridges-hooks` triple in the same file — the newest sibling, and
the model to match byte-for-byte in structure. Three separate insertions, each
placed after its `bridges-skills`/`bridges-hooks` sibling:

1. **Zone** — after `.fallowrc.json:44-47`:

```json
{
  "name": "bridges-hooks",
  "patterns": ["extensions/pi-claude-marketplace/bridges/hooks/**"]
}
```

2. **Allow edge** — after `.fallowrc.json:109-112`:

```json
{
  "from": "bridges-hooks",
  "allow": ["domain", "persistence", "shared", "platform"]
}
```

Use the identical four-element allow-list for `bridges-workflows`. The minimum
needed is `["domain", "persistence", "shared"]`; the unused `platform` edge is
accepted without complaint and keeps all six bridges uniform. Because the
per-zone rule is an **allow-list naming no `bridges-*` zone**, cross-bridge
imports stay forbidden by construction — this is the only gate that sees them.

3. **`calls.forbidden`** — after `.fallowrc.json:164-167`:

```json
{
  "from": "bridges-hooks",
  "callee": ["process.stdout.*", "process.stderr.*"]
}
```

All thirteen existing zones carry one; omitting it fails nothing today but would
leave the sixth bridge as the one zone with no output-discipline guard (one of
two independent IL-2 enforcements).

**Do NOT add** `"bridges-workflows"` to the `orchestrators` allow-list
(`.fallowrc.json:80-90`) — no orchestrator imports it until Phase 112, so the
edge is unverifiable here.

Omitting the zone is loud, not silent: `boundaries.coverage.requireAllFiles: true`
makes `npm run fallow` exit 1 naming all five unzoned paths.

---

### `tests/integration/workflow-kind-inversion.test.ts` (MODIFY)

**Analog:** itself. Two edits, per RESEARCH §Q7 Option A:

- `:93-97` — the fixture body becomes
  `export const meta = { name: "greet", description: "greets" };`. Without this
  the script classifies `skipped`/`no-meta` and no envelope is ever written, in
  this phase or in Phase 112.
- `:179-183` — the `assert.rejects(stat(<HOME>/.pi/workflows), {code:"ENOENT"})`
  block is replaced by a direct bridge drive plus a whole-object envelope
  assertion. Keep `:143-177` verbatim, especially the `:163-177` positive
  precondition — it is the tautology guard, and under the inversion it becomes
  doubly meaningful (resolver admitted the kind; bridge acted on it).
- `:134` title and the `:14-18` header both name D-109-06's window and must be
  rewritten to name WBRG-01/WPTH-01.

`withHermeticHome` (`:20-65`) is this file's own S1 equivalent and stays.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| — (none) | | | Every file in this phase has a close in-repo analog. |

Two **sub-patterns** have no analog, and are called out inline above rather than
here:

1. Asserting a callback (`onPlaced`) stayed empty on a refusal — S/WR-06
   section. No in-repo test does this; compose it from the three excerpts given.
2. Spreading a real `ScopedLocations` to override one composer — the brand makes
   it legal (S3) but nothing in the repo does it yet. Comment the seam.

---

## Metadata

**Analog search scope:** `tests/bridges/{commands,skills,agents,mcp,hooks}/`,
`tests/persistence/`, `tests/platform/`, `tests/shared/`, `tests/domain/`,
`tests/integration/`, `.fallowrc.json`
**Files read:** 12
**Reviewing skills:** `.agents/skills/typescript-unit-testing-review/SKILL.md`,
`.agents/skills/google-typescript-style-review/SKILL.md`
**Pattern extraction date:** 2026-09-05
