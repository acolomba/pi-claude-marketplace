# Phase 110: Domain and platform modules - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 10 (5 production — all ported verbatim, 5 tests — the real work)
**Analogs found:** 5 / 5 test files

> **This is a port, not a build.** The three production modules
> (`domain/workflow-script.ts`, `domain/workflow-project-key.ts`,
> `platform/workflow-home.ts`) plus the additive edits to `domain/name.ts` and
> `shared/errors.ts` are checked out verbatim from `features/workflow-port-wip`.
> Do **not** propose rewriting them. The only production edit this phase authors
> is the deletion of `setWorkflowHomeDirForTesting`.
> The pattern assignments below therefore cover the **five owner-test files**.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/platform/workflow-home.test.ts` | test (owner) | env-relocation / request-response | `tests/bridges/hooks/event-router.test.ts:99-120` (idiom) + `tests/index.test.ts:187-227` (structure) | role-match |
| `tests/domain/workflow-project-key.test.ts` | test (owner) | pure transform, table-driven | `tests/domain/clone-key.test.ts` | **exact** |
| `tests/domain/workflow-script.test.ts` | test (owner, large) | pure transform → discriminated verdict | `tests/domain/source.test.ts` (case-table + union) + `tests/shared/probe-classifiers.test.ts` (verdict assertions) | **exact** |
| `tests/domain/name.test.ts` (EXTEND) | test (owner) | pure transform | `describe("generatedSkillName")` at `tests/domain/name.test.ts:172-237` — same file | **exact** |
| `tests/shared/errors.test.ts` (EXTEND) | test (owner) | typed-error construction | `describe("CrossPluginConflictError")` at `tests/shared/errors.test.ts:668-700`; `describe("StaleSourceCloneError")` at `:408-461` | **exact** |
| `extensions/.../platform/workflow-home.ts` | platform (port + seam deletion) | host-env read | `platform/pi-api.ts::getAgentDir` (positional analog only) | port — do not rewrite |
| `extensions/.../domain/workflow-script.ts` | domain (port) | transform | — | port — do not rewrite |
| `extensions/.../domain/workflow-project-key.ts` | domain (port) | transform | `domain/clone-key.ts` (positional) | port — do not rewrite |
| `extensions/.../domain/name.ts` (ADDITIVE) | domain (port) | transform | `generatedSkillName` in the same file | port — do not rewrite |
| `extensions/.../shared/errors.ts` (ADDITIVE) | shared (port) | error class | `CrossPluginConflictError` in the same file | port — do not rewrite |

All analog paths verified git-tracked with `git ls-files`.

---

## Pattern Assignments

### `tests/platform/workflow-home.test.ts` (test, env-relocation)

**Analog:** `tests/bridges/hooks/event-router.test.ts` (cleanest small idiom) and
`tests/index.test.ts` (the fuller helper shape).

`tests/helpers/` no longer exists after the v1.19 refactor, so each file defines
its own relocation. That is the established pattern, not a smell.

**Cleanest model — inline save / `t.after()` / then mutate**
(`tests/bridges/hooks/event-router.test.ts:94-120`):

```ts
test(
  "reload resets lifecycle state before hydrating routes, reaping orphans, and registering handlers",
  { concurrency: false },
  async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "hooks-router-reload-"));
    const originalHome = process.env.HOME;
    const originalAgentRoot = process.env.PI_CODING_AGENT_DIR;
    process.env.HOME = path.join(root, "home");
    process.env.PI_CODING_AGENT_DIR = userAgentRoot;
    t.after(async () => {
      // ...
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    });
```

Note two things this file gets *wrong* for our purposes: it mutates `process.env`
**before** registering `t.after()`. The unit-testing rule (and RESEARCH §Q1) says
register restoration **first**. `tests/index.test.ts:203-226` does it in the
correct order — save, `t.after()`, then mutate:

```ts
// tests/index.test.ts:198-226 (abridged)
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const home = await mkdtemp(path.join(tmpdir(), `index-${label}-home-`));
  const previousCwd = process.cwd();
  const tracked = ["HOME", "PI_CODING_AGENT_DIR", "PATH", ...SESSION_ENV_KEYS];
  const saved = tracked.map((key) => {
    return { key, previous: process.env[key] };
  });
  t.after(async () => {
    process.chdir(previousCwd);
    for (const { key, previous } of saved) {
      restoreEnv(key, previous);
    }

    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  process.chdir(processRoot);
  return { cwd, home };
}
```

...paired with its module-level restore helper (`tests/index.test.ts:176-183`):

```ts
function restoreEnv(key: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = previous;
  }
}
```

**Use this composite:** `tests/index.test.ts`'s *ordering* (save → `t.after()` →
mutate) with `event-router.test.ts`'s *scale* (one small local helper, not a
five-variable scope object). RESEARCH §Pattern 1 already sketches exactly that.

**Hand the temp home to the caller, do not re-read the global.** From
`tests/integration/workflow-kind-inversion.test.ts:47-64`, with its rationale
comment worth carrying across:

```ts
/**
 * Hand the temp home to the callback rather than making it re-read the global
 * that was just written. A caller reading `process.env.HOME` back needs a
 * `?? ""` to satisfy `strictNullChecks`, and that fallback turns a broken
 * precondition into a silent cwd-relative probe instead of a failure.
 */
async function withHermeticHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "workflow-inversion-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn(hermeticHome);
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

This is the `try/finally` variant (integration suite). For the **unit** owner
test prefer the `t.after()` variant — the rule names `t.after()` explicitly.

**Also pin the negative (WPTH-02):** assert `workflowHomeDir()` never returns a
`<cwd>/.pi/workflows/saved` path. A relocated `HOME` plus a distinct `cwd` makes
that observable rather than incidentally right — the same trick
`tests/index.test.ts` uses with its separate `processRoot`.

---

### `tests/domain/workflow-project-key.test.ts` (test, table-driven parity)

**Analog:** `tests/domain/clone-key.test.ts` — same shape (12-hex derived key
from a hashed input), same mutation-sensitivity requirement, same literal-only
expectations.

**Core pattern** (`tests/domain/clone-key.test.ts:1-24`):

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canonicalCloneUrl,
  pluginCloneKey,
  pluginMirrorKey,
} from "../../extensions/pi-claude-marketplace/domain/clone-key.ts";

describe("pluginCloneKey", () => {
  test("returns the same clone key for identical URL and SHA inputs", () => {
    // arrange
    const canonicalUrl = "https://github.com/o/r";
    const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    // act
    const cloneKeys = [
      pluginCloneKey(canonicalUrl, fullSha),
      pluginCloneKey(canonicalUrl, fullSha),
    ];

    // assert
    assert.deepStrictEqual(cloneKeys, ["97393e7e6b5a-a1b2c3d4e5f6", "97393e7e6b5a-a1b2c3d4e5f6"]);
  });
```

**Adjacent-input discrimination** — the same file's second and third cases prove
each half of the key moves independently, by pairing a canonical input with a
one-character neighbour and asserting **both literals in one
`deepStrictEqual` object** (`tests/domain/clone-key.test.ts:26-43`):

```ts
    // act
    const cloneKeys = {
      canonical: pluginCloneKey(canonicalUrl, fullSha),
      adjacent: pluginCloneKey(adjacentCanonicalUrl, fullSha),
    };

    // assert
    assert.deepStrictEqual(cloneKeys, {
      canonical: "97393e7e6b5a-a1b2c3d4e5f6",
      adjacent: "360941761bef-a1b2c3d4e5f6",
    });
```

Copy this literal-only discipline for the 13 rows in RESEARCH §Q6a. Every
expected key is a transcribed literal; **none** is recomputed by the test. That
is what makes criterion 6 ("fails if `.slice(0, 12)` changes") true by
construction.

For a case table use `tests/domain/source.test.ts:15-33`'s named-interface shape
rather than an anonymous inline array, since the rows carry explanatory names:

```ts
interface ParseCase {
  readonly name: string;
  readonly raw: unknown;
  readonly source: ParsedSource;
}

const PARSE_CASES: readonly ParseCase[] = [
  {
    name: "preserves a bare tilde path",
    raw: "~",
    source: { kind: "path", raw: "~", logical: "~" },
  },
```

**The `chdir` case** (Pitfall 3 / RESEARCH §Q6a option 2): `process.chdir()` in a
unit test already has precedent at `tests/index.test.ts:203,224` (saved as
`previousCwd`, restored first inside `t.after()`). Follow that exact
save-restore ordering.

---

### `tests/domain/workflow-script.test.ts` (test, discriminated-union verdicts)

**Analogs:** `tests/domain/source.test.ts` (case-table + discriminated result
type + type-only imports) and `tests/shared/probe-classifiers.test.ts`
(classifier verdict assertions). No acorn/AST-walking module exists in the tree,
so there is **no direct analog for the parser half** — take the structure from
these two and the case set from the spike draft.

**Import block to mirror** (`tests/domain/source.test.ts:1-13`) — note the
type-only imports last, inside the same braces, alphabetized after the runtime
names:

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ensureGitSuffix,
  githubSource,
  parsePluginSource,
  pathSource,
  samePlannedSource,
  sourceLogical,
  type ParsedSource,
  type SamePlannedSourceResult,
} from "../../extensions/pi-claude-marketplace/domain/source.ts";
```

This is exactly the shape the owner test needs to satisfy RESEARCH Pitfall 2:
**every** export imported by name, including `AdmittedWorkflow`,
`WORKFLOW_SCRIPT_EXTENSIONS` and `fileStem`, or `fallow dead-code` reports them
unused.

**Verdict assertion pattern** (`tests/shared/probe-classifiers.test.ts:13-24`) —
`satisfies readonly T[]` on the expectation pins the union arm at compile time,
and the assertion is `deepStrictEqual` on the discriminant, never a message
substring:

```ts
describe("narrowResolverNotes", () => {
  test("classifies an invalid hooks JSON note as unsupported hooks", () => {
    // arrange
    const notes = ["hooks.json is not valid JSON: Unexpected token n"];
    const expectedReasons = ["unsupported hooks"] satisfies readonly ResolverNoteReason[];

    // act
    const reasons = narrowResolverNotes(notes);

    // assert
    assert.deepStrictEqual(reasons, expectedReasons);
  });
```

Apply to `WorkflowVerdict`: assert `{ outcome, cause }` as an object against a
literal, `satisfies` the exported union type. Never assert the `reason` string —
`reason` is the only field that changes when wording is edited.

**Structure requirement (Pitfall 5):** the spike draft is 1089 flat lines with
`assert.equal` and no phase markers. Restructure to
`describe("admitWorkflowScript")` / `describe("assertNoWorkflowNameCollisions")` /
`describe("fileStem")`, one level deep, `strictEqual`/`deepStrictEqual` only,
`// arrange` / `// act` / `// assert` markers on every case — as every analog
above does. Also drop the spike's `readFile(<module source>)` case; source
scanning lives in `tests/architecture/` since v1.19.

**One file, not two.** `scripts/check-corresponding-tests.mjs` emits
`unexpected-test` for a second file. `tests/shared/errors.test.ts` at 1523 lines
is the in-repo precedent that a 1000+-line owner test is the accepted shape.

---

### `tests/domain/name.test.ts` (EXTEND — add `describe("generatedWorkflowName")`)

**Analog:** the sibling `describe("generatedSkillName")` block **in the same
file**, `tests/domain/name.test.ts:172-237`. Match it exactly — same `for`-over-
inline-array shape, same test-title template, same throw-assertion callback.

**Happy-path rows** (`tests/domain/name.test.ts:172-200`):

```ts
describe("generatedSkillName", () => {
  for (const { plugin, source, expectedSkillName } of [
    { plugin: "acme", source: "foo", expectedSkillName: "acme-foo" },
    { plugin: "acme", source: "acme-foo", expectedSkillName: "acme-foo" },
    { plugin: "ab", source: "abc", expectedSkillName: "ab-abc" },
    { plugin: "foo", source: "foo", expectedSkillName: "foo" },
  ]) {
    test(`generates ${JSON.stringify(expectedSkillName)} from ${JSON.stringify(source)}`, () => {
      // arrange
      const pluginName = plugin;
      const sourceName = source;

      // act
      const skillName = generatedSkillName(pluginName, sourceName);

      // assert
      assert.strictEqual(skillName, expectedSkillName);
    });
  }
```

The `acme` / `acme-foo` → `acme-foo` and `foo` / `foo` → `foo` rows are the
RN-1 prefix-elision cases WNAM-06 requires — carry the analogous pairs across for
the `<plugin>:<elided>` output.

**Rejection rows** (`tests/domain/name.test.ts:201-236`) — note the arrow-function
binding named after the call, and the three-part error callback (`instanceof`,
`constructor` identity, exact `message`):

```ts
  for (const { pluginName, sourceName, errorMessage } of [
    {
      pluginName: "ac/me",
      sourceName: "foo",
      errorMessage: 'Name "ac/me" must not contain path separators.',
    },
  ]) {
    test(`rejects plugin ${JSON.stringify(pluginName)} and source ${JSON.stringify(sourceName)}`, () => {
      // arrange
      const plugin = pluginName;
      const source = sourceName;

      // act
      const generateSkillName = () => generatedSkillName(plugin, source);

      // assert
      assert.throws(generateSkillName, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.constructor, Error);
        assert.strictEqual(error.message, errorMessage);
        return true;
      });
    });
  }
});
```

Add `generatedWorkflowName` (and `assertSafeSavedWorkflowName` if exported) to
the existing sorted import block at `tests/domain/name.test.ts:4-9`; place the
new `describe` after `describe("generatedAgentName")` at line 349 to keep file
order matching the module's declaration order.

---

### `tests/shared/errors.test.ts` (EXTEND — add `describe("WorkflowNameCollisionError")`)

**Analog:** `describe("CrossPluginConflictError")` at
`tests/shared/errors.test.ts:668-700` — the one existing error class carrying a
**readonly array** of structured entries, which is exactly
`WorkflowNameCollisionError.collisions`.

```ts
describe("CrossPluginConflictError", () => {
  test("exposes every conflict in caller order", () => {
    // arrange
    const conflicts = [
      'skill "alpha" already owned by plugin "first"',
      'agent "beta" already owned by plugin "second"',
    ];

    // act
    const error = new CrossPluginConflictError(conflicts);

    // assert
    assert.ok(error instanceof CrossPluginConflictError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        conflicts: error.conflicts,
        cause: error.cause,
      },
      {
        name: "CrossPluginConflictError",
        message:
          'Cross-plugin name conflict:\n  - skill "alpha" already owned by plugin "first"\n  - agent "beta" already owned by plugin "second"',
        conflicts: [
          'skill "alpha" already owned by plugin "first"',
          'agent "beta" already owned by plugin "second"',
        ],
        cause: undefined,
      },
    );
    assert.strictEqual(error.conflicts, conflicts);
```

Four things to copy verbatim:

1. **Both `instanceof` checks** — the class and `Error`.
2. **One `deepStrictEqual` over a projection object**, not N separate
   `strictEqual` calls. This is the house shape for "the complete value".
3. **`cause: undefined` is asserted**, not omitted — an accidental cause is
   caught.
4. **`assert.strictEqual(error.conflicts, conflicts)`** after the deep compare —
   pins reference identity, proving the constructor does not defensively copy.
   `WorkflowNameCollisionError.collisions` needs the identical pair.

**Optional-field variant** — if `WorkflowNameCollisionError` has an optional
field, mirror `describe("StaleSourceCloneError")` at
`tests/shared/errors.test.ts:437-460`, which asserts `Object.hasOwn` alongside
the `undefined` value so `exactOptionalPropertyTypes` behaviour is pinned:

```ts
    assert.deepStrictEqual(
      {
        name: error.name,
        mpName: error.mpName,
        hasMarketplaceProperty: Object.hasOwn(error, "mpName"),
      },
      {
        name: "StaleSourceCloneError",
        mpName: undefined,
        hasMarketplaceProperty: true,
      },
    );
```

Add the new class to the alphabetized import block at
`tests/shared/errors.test.ts:4-28` (it sorts between `UnsupportedSourceError`
and the end) and the `WorkflowNameCollision` interface as a `type` import.

---

## Shared Patterns

### Import order (`import-x/order`) — MANDATORY

**Source:** `tests/domain/source.test.ts:1-13`, `tests/shared/probe-classifiers.test.ts:1-11`
**Apply to:** all five test files.

Groups in order builtin → external → internal → parent → sibling → index →
object → type, blank line between groups, alphabetized case-insensitively within
each group, type-only imports last. Production imports carry an explicit `.ts`
extension.

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InvalidMarketplaceManifestError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  narrowProbeError,
  narrowResolverNotes,
  narrowUnsupportedKinds,
  type ResolverNoteReason,
  type UnsupportedReason,
} from "../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";
```

Note `type` members are placed **last inside the same braces**, after the
runtime names, not hoisted into a separate `import type` statement.

For a file that needs `TestContext` (i.e. `workflow-home.test.ts`), see
`tests/bridges/hooks/event-router.test.ts:1-10` — the builtin group is
alphabetized by module (`node:assert/strict`, `node:child_process`, `node:events`,
`node:fs`, `node:fs/promises`, `node:module`, `node:os`, `node:path`,
`node:stream`, `node:test`) and inline type imports ride along:

```ts
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";
```

### `@stylistic/padding-line-between-statements` — MANDATORY

**Source:** `tests/bridges/hooks/event-router.test.ts:104-116`,
`tests/integration/workflow-kind-inversion.test.ts:56-63`
**Apply to:** every `if`/`else`/`for`/`try` inside the new test bodies.

A blank line is required **after** every block-like statement. The `HOME`-restore
idiom is where this bites, because the `if/else` is immediately followed by the
`rm`:

```ts
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
                                    // <- this blank line is required
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
```

Same rule after each `for` loop body and after each `try/finally`.

### Phase markers and assertion vocabulary

**Source:** every analog above.
**Apply to:** all five files.

- `// arrange` / `// act` / `// assert` (or `// act & assert` when a `throws`
  fuses them — see `tests/domain/name.test.ts:203`) on **every** case.
- `assert.strictEqual` / `assert.deepStrictEqual` / `assert.ok` / `assert.throws`
  only. No `assert.equal` (the spike draft uses it; it must be converted).
- `describe()` one level deep, one per exported entrypoint.
- Test titles are behavioural sentences, not restatements of the function name
  ("returns the same clone key for identical URL and SHA inputs", "exposes every
  conflict in caller order").

### Review skills that will grade this work

- `.agents/skills/typescript-unit-testing-review/SKILL.md` — pairing, coverage,
  case structure, assertion style, test doubles, hermeticity, testable
  production design. This is the skill that Pitfall 5 (`describe()` structure)
  and the seam deletion (criterion 4) answer to.
- `.agents/skills/typescript-google-style-review/SKILL.md` — the style rules the
  toolchain does not enforce.

Note the SKILL name in the phase brief was given as
`typescript-google-style-review`; the on-disk directory is
`.agents/skills/typescript-google-style-review/` (CLAUDE.md's table calls the
same skill `google-typescript-style-review` — the directory listing is
authoritative).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| the acorn/AST-walk half of `tests/domain/workflow-script.test.ts` | test | AST transform | No module in the tree parses source with acorn or any AST library. Nearest kin are the typebox schema validators under `domain/components/` (declarative, not walked). Take the *case set* from the spike draft and Spike 026, and only the *structure* from `tests/domain/source.test.ts` + `tests/shared/probe-classifiers.test.ts`. |

The three production modules are also listed as "no analog" in the sense that
matters: they are **not to be written**. `git show features/workflow-port-wip:<path>`
is their source of truth.

## Metadata

**Analog search scope:** `tests/domain/`, `tests/platform/`, `tests/shared/`,
`tests/bridges/hooks/`, `tests/integration/`, `tests/index.test.ts`
**Files scanned:** 8 read, ~60 listed
**Tracked-source gate:** all analog paths confirmed via `git ls-files`
**Pattern extraction date:** 2026-09-04
