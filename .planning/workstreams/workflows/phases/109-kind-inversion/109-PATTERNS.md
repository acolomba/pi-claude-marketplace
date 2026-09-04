# Phase 109: Kind inversion - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 1 new + 5 edit archetypes covering ~30 modified files
**Analogs found:** 6 / 6 (every archetype has an in-repo analog; all paths git-tracked)

**Scope note.** The five production edits are NOT mapped here — RESEARCH.md
already specifies them to the line (`§Pattern 1`). This document covers the one
new file and the test/doc edit archetypes.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/integration/workflow-kind-inversion.test.ts` (NEW) | test (integration) | file-I/O + request-response | `tests/integration/transaction-lifecycle-cascade.test.ts` | exact |
| `tests/bridges/{agents,skills,commands}/*.test.ts`, `tests/orchestrators/plugin/*.test.ts` (60 literal sites) | test | transform (fixture literal) | `tests/bridges/agents/stage.test.ts:106` | exact |
| `tests/domain/resolver.test.ts`, `tests/orchestrators/plugin/{install,git-source-probe}.test.ts` (8 invisible sites) | test | transform (whole-arm assertion) | `tests/domain/resolver.test.ts:3346` | exact |
| `tests/architecture/{compat-01-no-expansion,notify-closed-set-locks,hooks-foundation}.test.ts`, `tests/shared/notify.test.ts` (5 closed-set pins) | test (architecture gate) | closed-set assertion | `tests/architecture/hooks-foundation.test.ts:207` | exact |
| `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` (3 states × 2 homes) | doc contract + gate | byte-pairing | `docs/output-catalog.md:431-442` ↔ `catalog-uat.test.ts:903-924` | exact |
| `tests/domain/resolver.test.ts` scenario-table row turn (strict + loose) | test | table-driven scenario | strict: `resolver.test.ts:1700-1721`; loose: `resolver.test.ts:3084-3098` | exact (two DIFFERENT analogs) |

______________________________________________________________________

## Pattern Assignment — the one new file

### `tests/integration/workflow-kind-inversion.test.ts` (test, file-I/O + request-response)

**Analog:** `tests/integration/transaction-lifecycle-cascade.test.ts` (301 lines,
git-tracked). Verified verbatim this session. `tests/helpers/` does NOT exist on
this branch (`ls tests/helpers` → ENOENT), so the analog declares every helper
locally — the new file must do the same, not import shared helpers.

**Imports pattern** (lines 1-14, verbatim):

```ts
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { installPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { reinstallPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";
import { uninstallPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import { updatePlugins } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
```

For the new file keep `assert`, `mkdir/mkdtemp/rm/writeFile`, `tmpdir`, `path`,
`test`, `pathSource`, `installPlugin`, `locationsFor`, and the two types. Drop
`reinstallPlugin` / `updatePlugins` / `uninstallPlugin` (unused → `noUnusedLocals`
+ `@typescript-eslint/no-unused-vars` error). **Add `stat`** to the `node:fs/promises`
import — the RESEARCH skeleton calls `stat(...)` but the analog imports `readFile`
only (see Drift D-1). Note `import type` is grouped last per `import-x/order`.

**Notification capture (`makeCtx`)** (lines 21-43, verbatim — copy as-is):

```ts
interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as ExtensionContext;
  const pi = {
    getAllTools: (): unknown[] => [],
  } as ExtensionAPI;
  return { ctx, pi, notifications };
}
```

**Hermetic HOME** (lines 45-60, verbatim — change only the mkdtemp prefix):

```ts
async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "lifecycle-cascade-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn();
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}
```

Use a distinct prefix (e.g. `"workflow-inversion-home-"`). Per RESEARCH Pitfall 8,
exactly ONE `test(...)` per hermetic-home block.

**Fixture seeder** (lines 62-125). Copy `seedHooksPlugin` and rename to
`seedWorkflowPlugin`, with two changes: drop the required `hooksJson` field from
the options object, and replace the hooks write (lines 89-90) with a workflows
write. The verbatim block to replace:

```ts
  await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
  await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(opts.hooksJson));
```

becomes a `<pluginRoot>/workflows/<name>.js` write. **Keep everything else**, in
particular the skill seed at lines 81-87 (its comment "Seed at least one skill so
the install path stages something visible" is exactly why RESEARCH says keep it):

```ts
  const pluginRoot = path.join(opts.marketplaceRoot, "plugins", pluginName);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName, version }),
  );

  // Seed at least one skill so the install path stages something visible.
  const skillDir = path.join(pluginRoot, "skills", "tool");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: tool\n---\n\nbody for ${pluginName} ${version}.\n`,
  );
```

**State seeding** (lines 92-124, verbatim — copy unchanged). Note the deliberate
dynamic `await import(...)` of `state-io.ts` inside the function body:

```ts
  await mkdir(path.join(opts.marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(opts.marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplaceName,
      plugins: [{ name: pluginName, source: `./plugins/${pluginName}`, version }],
    }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const { saveState, loadState } =
    await import("../../extensions/pi-claude-marketplace/persistence/state-io.ts");
  const state = await loadState(locations.extensionRoot);
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      ...state.marketplaces,
      [marketplaceName]: {
        name: marketplaceName,
        scope: "project",
        source: pathSource(`./${path.basename(opts.marketplaceRoot)}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot: opts.marketplaceRoot,
        plugins: {},
      },
    },
  });
```

**Install call + assertion shape** (lines 166-192, verbatim). This is the exact
call and summary idiom the RESEARCH skeleton abbreviates:

```ts
      {
        const { ctx, pi, notifications } = makeCtx();

        // act
        await installPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        });

        // assert
        const summary = notifications.map((n) => n.message).join("\n");
        assert.ok(!summary.includes("(failed)"), `install: expected clean; got: ${summary}`);
        assert.deepEqual(JSON.parse(await readFile(hooksPath, "utf8")), v1Hooks.hooks);
        // LIFE-02: install row + reload-hint trailer cascade.
        assert.ok(
          summary.includes("(installed)"),
          `install: expected (installed) row; got: ${summary}`,
        );
```

Note the analog's assertion-message convention: every `assert.ok` carries a
third-argument message interpolating `summary`. The RESEARCH skeleton passes bare
`summary` as the message — either satisfies the compiler, but the analog's
`` `install: expected (installed) row; got: ${summary}` `` form is the house style
and should be preferred.

**Test-body wrapper** (lines 136-145, structure to mirror):

```ts
test("LIFE-01 / LIFE-02 integration: install -> update -> reinstall -> uninstall all wire the hooks slot end-to-end", async () => {
  // arrange
  const { resetRoutingState } =
    await import("../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "lifecycle-cascade-"));
    try {
      resetRoutingState();
```

The `resetRoutingState()` dynamic import is hooks-specific and must NOT be copied
into the workflows test — no hooks routing state is engaged. Keep the
`withHermeticHome` → `mkdtemp` → `try/finally { rm }` skeleton. The analog's
`fileExists` helper (lines 127-134) is also unneeded; the window assertion uses
`assert.rejects(stat(...), { code: "ENOENT" })` per RESEARCH.

**Arrange/act/assert comment markers.** The analog labels every block `// arrange`,
`// act`, `// assert`. This is a project convention visible in every test read this
session (`resolver.test.ts:1700-1721`, `probe-classifiers.test.ts:262-275`). Keep them.

**Corresponding-test exemption confirmed:** `scripts/check-corresponding-tests.mjs`
exempts the `integration` root, so this file needs no production pair.

______________________________________________________________________

## Edit Archetypes (modified files)

### Archetype A — `componentPaths` object-literal widening (60 sites, 2 files)

**Measured site counts** (`grep -c 'componentPaths: {'`, this session — these are
EDIT sites, not the 131 `tsc` errors, which come in TS2741+TS2322 pairs):

| File | Literal sites |
|------|---------------|
| `tests/bridges/agents/stage.test.ts` | 31 |
| `tests/bridges/skills/stage.test.ts` | 29 |

**Before/after** (`tests/bridges/agents/stage.test.ts:106`, verbatim before):

```ts
      componentPaths: { skills: [], commands: [], agents: ["agents"] },
```

```ts
      componentPaths: { skills: [], commands: [], agents: ["agents"], workflows: [] },
```

The key goes LAST in these two files (they use `skills, commands, agents` order).
Enumerate with `npm run typecheck`, not grep — grep over-reports.

### Archetype A′ — the same widening in the 6 single-site files (8 sites, 6 files)

`tests/orchestrators/plugin/plugin-state-classifier.test.ts` (2, lines 58/73),
`tests/orchestrators/plugin/discover-names.test.ts` (2), `.../shared.test.ts` (1,
line 133), `tests/bridges/skills/discover.test.ts` (1, line 26),
`tests/bridges/commands/stage.test.ts` (1, line 50),
`tests/bridges/commands/discover.test.ts` (1, line 28).

`discover-names.test.ts` is the odd one and carries **two** sites, not one — a
`readonly` PARAMETER TYPE (lines 20-24) plus the spread construction (lines 27-31).
Both must widen. Verbatim:

```ts
  componentPaths: {
    readonly agents: readonly string[];
    readonly commands: readonly string[];
    readonly skills: readonly string[];
  },
): MaterializablePlugin {
  return {
    componentPaths: {
      agents: [...componentPaths.agents],
      commands: [...componentPaths.commands],
      skills: [...componentPaths.skills],
    },
```

Add `readonly workflows: readonly string[];` and `workflows: [...componentPaths.workflows],`
— alphabetical order in this file, so `workflows` still lands last.

### Archetype B — invisible `assert.deepStrictEqual` whole-arm payloads (8 sites, 3 files)

`tsc` types `deepStrictEqual`'s second argument as `unknown`, so these compile
clean and fail only under `npm test` with `+ workflows: []`.

**How to find them:** they are exactly the `componentPaths: {` hits that survive a
green typecheck. Measured line numbers, this session:

| File | Lines |
|------|-------|
| `tests/domain/resolver.test.ts` | 3346, 3372, 3421, 3617, 3762 |
| `tests/orchestrators/plugin/install.test.ts` | 7363 |
| `tests/orchestrators/plugin/git-source-probe.test.ts` | 492, 521 |

**Before** (`tests/domain/resolver.test.ts:3340-3349`, verbatim — note it sits
inside an `assert.deepStrictEqual(resolvedPlugin, { ... })` whole-arm payload):

```ts
    installable: true,
    name: "p1",
    pluginRoot: localRoot,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
    defaultEnabled: true,
  });
```

`install.test.ts:7363` uses alphabetical key order
(`{ agents: [], commands: [], skills: [] }`) — match the local order per file.

**Verification sequence for the executor:** typecheck green ≠ done. Run `npm test`
after Archetype A, then fix these. Cross-check with
`grep -rn 'componentPaths: {' tests/ | wc -l` → 76 total sites (60 + 8 + 8).

### Archetype C — closed-set tuple / length pins (5 files)

| File:line | Pin | Turn |
|-----------|-----|------|
| `tests/architecture/compat-01-no-expansion.test.ts:173` | `"workflows",` tail of the ordered `expected` array | delete the line |
| `tests/architecture/notify-closed-set-locks.test.ts:29` | test title `…closed 44-entry reason set` | → 43 |
| `tests/architecture/notify-closed-set-locks.test.ts:51` | `assert.equal(REASONS.length, 44);` | → 43 + ledger line |
| `tests/shared/notify.test.ts:5008` | second `assert.equal(REASONS.length, 44);` | → 43 |
| `tests/architecture/hooks-foundation.test.ts:199` | exact 4-tuple `deepEqual` | → 5-tuple |
| `tests/shared/probe-classifiers.test.ts:266` | `classifies workflows as the dedicated workflows reason` | turn to the `unsupported component` fallback |

**Ledger comment analog** (`notify-closed-set-locks.test.ts:49-51`, verbatim tail —
D-109-02 appends BELOW the WDET-04 line, which stays):

```ts
  // WDET-04 / D-106-04: +1 for the dedicated final `workflows` member
  // (43 -> 44).
  assert.equal(REASONS.length, 44);
```

The whole ledger (lines 30-51) is a running arithmetic derivation, ID-anchored,
never narrating shape — matching RESEARCH Pitfall 6.

**Tuple-pin analog** (`hooks-foundation.test.ts:199-212`, verbatim — the FIRST test
is the one that goes red; the SECOND is the precedent for the optional positive
`UNSUPPORTED_COMPONENT_KINDS does NOT contain 'workflows'` mirror):

```ts
test("HOOK-01: SUPPORTED_COMPONENT_KINDS is the closed 4-tuple [skills,commands,agents,hooks]", () => {
  assert.deepEqual(
    [...SUPPORTED_COMPONENT_KINDS],
    ["skills", "commands", "agents", "hooks"],
    "SUPPORTED_COMPONENT_KINDS is a public closed-set contract -- shape and order are locked",
  );
});

test("HOOK-01: UNSUPPORTED_COMPONENT_KINDS does NOT contain 'hooks'", () => {
  assert.ok(
    !(UNSUPPORTED_COMPONENT_KINDS as readonly string[]).includes("hooks"),
    `UNSUPPORTED_COMPONENT_KINDS must NOT contain "hooks": ${UNSUPPORTED_COMPONENT_KINDS.join(",")}`,
  );
});
```

Copy the second test verbatim with `hooks` → `workflows`, retagging `HOOK-01` →
`WINV-01`. Note the `as readonly string[]` cast — required, because after the
inversion `workflows` is not in the `UNSUPPORTED_COMPONENT_KINDS` union and
`.includes("workflows")` would be a type error without it.

**Classifier-test analog** (`probe-classifiers.test.ts:266-275`, verbatim before):

```ts
  test("classifies workflows as the dedicated workflows reason", () => {
    // arrange
    const kinds = ["workflows"];
    const expectedReasons = ["workflows"] satisfies readonly UnsupportedReason[];

    // act
    const reasons = narrowUnsupportedKinds(kinds);

    // assert
    assert.deepStrictEqual(reasons, expectedReasons);
  });
```

The `satisfies readonly UnsupportedReason[]` clause is what makes this a compile
error (TS2322 at line 269) after the member is retired.

### Archetype D — catalog state: fixture + paired doc block (3 states × 2 homes)

**Pairing is a pure string match on the id.** Both homes change in the SAME edit
(RESEARCH Pitfall 5 — an orphan fails the inverse walk).

| State | Doc heading | Doc id | Fixture key |
|-------|-------------|--------|-------------|
| 1 | `docs/output-catalog.md:431` | `:433` `workflow-partially-available-inventory` | `catalog-uat.test.ts:907` |
| 2 | `:565` | `:567` `workflow-partial-install-success` | `:1211` |
| 3 | `:618` | `:620` `workflow-install-rejection` | `:1316` |

**Doc-block form** (`docs/output-catalog.md:431-442`, verbatim before):

```markdown
### Workflow partially-available inventory row (WDET-04)

<!-- catalog-state: workflow-partially-available-inventory -->

```text
● official [user]
  ⊖ helper v1.0.0 (partially-available) {workflows}
```

A workflow-bearing plugin uses the existing partial status before installation. The row has info severity and no hint or reload trailer.

This state adds no workflow-specific glyph, heading, or wrapping rule.
```

Four things move per state: the `###` heading text + `(WDET-04)` → `(WINV-04)`
retag, the `catalog-state:` id, the fenced bytes, and the prose paragraph.

**Fixture form** (`catalog-uat.test.ts:903-924`, verbatim before — note the
comment block above the key is part of the pattern and must be retagged too):

```ts
    // WDET-04: a workflow-bearing plugin uses the existing partial inventory
    // grammar. The typed reason has info severity and adds no hint or reload
    // trailer before installation.
    "workflow-partially-available-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-available",
                name: "helper",
                version: "1.0.0",
                reasons: ["workflows"],
              },
            ],
          },
        ],
      },
    },
```

Post-inversion fixture payloads (all three) are given verbatim in RESEARCH
§*The three catalog states — exact post-inversion bytes*. Do not recompute them.
Leave `examples.length === 182` alone.

**Ordering (A-02):** doc blocks first → observe `catalog-uat` red → then fixtures
+ production. With production edited first, `catalog-uat` is red at `tsc` but
GREEN at runtime, so criterion 4's observed red never happens.

### Archetype E — resolver scenario-table row turn (strict and loose are NOT symmetric)

**The row** (`tests/domain/resolver.test.ts:101`, verbatim):

```ts
  { kind: "workflows", relativePath: "workflows", stat: "dir" },
```

It is consumed by TWO loops — `:855` (strict, `resolveStrict`) and `:3100`
(loose, `resolveLoose`) — both asserting `partially-available` + a
`contains ${scenario.kind}` note. Deleting the row removes it from both, so TWO
positive replacements are needed, from TWO DIFFERENT analogs.

**Strict analog** (`resolver.test.ts:1700-1721`, verbatim — the shape RESEARCH's
skeleton is modelled on; confirmed unchanged):

```ts
test("PR-4 implicit-by-convention populates componentPaths.skills when neither entry nor manifest declares it", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), "skills")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["skills"]);
    assert.ok(resolvedPlugin.supported.includes("skills"));
  }
});
```

The `if (resolvedPlugin.state === "installable")` guard is the discriminated-union
narrowing the codebase requires — `componentPaths` is unreadable without it.

**Loose analog** (`resolver.test.ts:3082-3098`, verbatim — a BETTER analog than
the strict one for the loose half, because it already asserts `installable` plus
an ABSENCE rather than a populated path):

```ts
// HOOK-01 loose regression guard: no declaration + no convention file ->
// installable: true and hooks NOT in supported.
test("HOOK-01 loose: no hooks declared and no hooks/hooks.json -> installable WITHOUT hooks in supported", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "installable");

  if (resolvedPlugin.state === "installable") {
    assert.ok(!resolvedPlugin.supported.includes("hooks"));
```

Follow this shape for the loose workflows test: assert `installable` and the
ABSENCE of a `contains workflows` note. Per RESEARCH Pitfall 1, do NOT assert a
populated `componentPaths.workflows` in the loose case — `collectLooseComponentKind`
never probes disk, so the measured value is `[]`.

______________________________________________________________________

## Shared Patterns

### Arrange / act / assert markers

**Source:** every test read this session (`resolver.test.ts:1700`,
`probe-classifiers.test.ts:262`, `transaction-lifecycle-cascade.test.ts:137`)
**Apply to:** the new integration test and every turned test block.
Literal `// arrange`, `// act`, `// assert` comments delimit the three sections.

### Assertion messages interpolate the observed value

**Source:** `tests/integration/transaction-lifecycle-cascade.test.ts:181`,
`tests/domain/resolver.test.ts:1712-1715`, `tests/architecture/hooks-foundation.test.ts:209`
**Apply to:** all new assertions.

```ts
assert.ok(!summary.includes("(failed)"), `install: expected clean; got: ${summary}`);
```

Never a bare `assert.ok(cond)` when a failure would be hard to diagnose.

### Test titles and comments carry requirement / decision IDs, never planning refs

**Source:** `HOOK-01:` / `PR-4` / `WDET-04 / D-106-04` prefixes throughout.
**Apply to:** every new or turned test. Use `WINV-01`..`WINV-05` and
`D-109-01`..`D-109-07`. No `Phase 109`, `Plan N`, `Wave N`, `Pitfall N`
(`.claude/rules/typescript-comments.md`).

### Local helper declaration, not shared imports

**Source:** `tests/integration/transaction-lifecycle-cascade.test.ts:26-134`
**Apply to:** the new integration test.
`tests/helpers/` does not exist on this branch and the `npm test` glob excludes it.
Every helper (`makeCtx`, `withHermeticHome`, the seeder) is declared in-file.

______________________________________________________________________

## Drift found between RESEARCH.md and the live tree

Four items. None invalidates RESEARCH; three are refinements the planner should
carry, one is a real omission.

- **D-1 (skeleton vs analog, minor).** RESEARCH's install-window skeleton calls
  `stat(...)` and `rm(...)`, but the analog's `node:fs/promises` import
  (line 2) is `{ mkdir, mkdtemp, readFile, rm, writeFile }` — no `stat`. The new
  file must add `stat` and may drop `readFile`. Copying the analog's import line
  verbatim produces a `tsc` error on the window assertion.
- **D-2 (site counts, refinement).** RESEARCH's "62 / 58" for
  `tests/bridges/agents/stage.test.ts` / `tests/bridges/skills/stage.test.ts`
  are `tsc` ERROR counts, not edit counts. Measured literal sites are **31** and
  **29** — each literal produces a TS2741 + TS2322 pair. Total literal sites
  across `tests/` is **76** (60 in the two bulk files + 8 single-site + 8 invisible).
  A planner sizing work off "120 sites" will over-scope by 2×.
- **D-3 (real omission).** `tests/orchestrators/plugin/discover-names.test.ts`
  carries **two** widening sites, not one: the `readonly` parameter type at
  lines 20-24 as well as the spread at 27-31. RESEARCH shows only the spread. The
  parameter type is what `tsc` reports; the spread is what makes it compile.
- **D-4 (count refinement).** RESEARCH says "~10" invisible `deepStrictEqual`
  sites; the measured set is exactly **8** (resolver ×5, install ×1,
  git-source-probe ×2), which matches its own enumerated list. Treat 8 as the
  number.

Everything else verified UNCHANGED against the live tree this session: the five
production edit line numbers, `resolver.test.ts:101`, the two consuming loops at
`:855` / `:3100`, `hooks-foundation.test.ts:199` / `:207`,
`notify-closed-set-locks.test.ts:29` / `:51`, `notify.test.ts:5008`,
`compat-01-no-expansion.test.ts:173`, `probe-classifiers.test.ts:266`, and all
three catalog-state ids in both homes (`docs/output-catalog.md:433/567/620`,
`catalog-uat.test.ts:907/1211/1316`).

## Metadata

**Analog search scope:** `tests/integration/`, `tests/architecture/`,
`tests/domain/`, `tests/bridges/`, `tests/orchestrators/`, `tests/shared/`,
`docs/output-catalog.md`
**Files scanned:** 14 read; ~30 enumerated by grep
**Tracked-source check:** all analog paths confirmed via `git ls-files`
**Pattern extraction date:** 2026-09-04
