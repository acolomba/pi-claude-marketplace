# Phase 111: Non-Hook Component Bridges - Pattern Map

**Mapped:** 2026-08-30
**Files classified:** 31 mirrored owners plus 4 supplemental-suite files
**Analogs found:** 31 / 31 owner tests; supplemental cleanup is mapped separately

## Mapping Rule

Phase 111 is a test-ownership refactor. The production modules are the behavior authority,
but the current Phase-111 bridge tests and supplemental suites are migration inventories,
not structural templates. For every owner below:

1. Preserve the public behaviors already asserted by its current owner and assigned
   supplemental cases.
2. Copy case structure from the analog in this document: lowercase phases, local state,
   complete independently authored expectations, and cleanup registered by the case.
3. Run the mirrored owner alone and the direct-coverage carrier against its production
   source. Do not use a supplemental suite as coverage evidence.

No production edit is planned. If direct proof exposes dead code or a coherent production
testability defect, keep the edit pair-atomic and do not add a test-only export, reset hook,
state reader, test mode, or private access seam.

## File Classification

### Mirrored owners

| New/Modified File                                        | Role                            | Data Flow                   | Closest Structural Analog             | Match Quality        |
| -------------------------------------------------------- | ------------------------------- | --------------------------- | ------------------------------------- | -------------------- |
| `tests/bridges/agents/convert.test.ts`                   | test, transform owner           | transform                   | `tests/domain/components/mcp.test.ts` | role + flow          |
| `tests/bridges/agents/discover.test.ts`                  | test, discovery owner           | batch + file-I/O            | `tests/domain/plugin-root.test.ts`    | flow match           |
| `tests/bridges/agents/frontmatter.test.ts`               | test, parser/renderer owner     | transform                   | `tests/domain/components/mcp.test.ts` | role + flow          |
| `tests/bridges/agents/index-mutation.test.ts`            | test, index-policy owner        | transform                   | `tests/domain/components/mcp.test.ts` | role + flow          |
| `tests/bridges/agents/index.test.ts` (create)            | test, barrel owner              | binding                     | `tests/platform/pi-api.test.ts`       | exact pattern        |
| `tests/bridges/agents/marker.test.ts`                    | test, ownership owner           | request-response + file-I/O | `tests/domain/plugin-root.test.ts`    | flow match           |
| `tests/bridges/agents/stage.test.ts`                     | test, lifecycle owner           | transactional file-I/O      | `tests/persistence/state-io.test.ts`  | flow match           |
| `tests/bridges/agents/types.test.ts` (create)            | test, type-contract owner       | compile-time                | `tests/shared/types.test.ts`          | exact pattern        |
| `tests/bridges/agents/unstage.test.ts`                   | test, lifecycle owner           | transactional file-I/O      | `tests/persistence/state-io.test.ts`  | flow match           |
| `tests/bridges/commands/discover.test.ts`                | test, discovery owner           | batch + file-I/O            | `tests/domain/plugin-root.test.ts`    | flow match           |
| `tests/bridges/commands/index.test.ts` (create)          | test, barrel owner              | binding                     | `tests/platform/pi-api.test.ts`       | exact pattern        |
| `tests/bridges/commands/stage.test.ts`                   | test, lifecycle owner           | transactional file-I/O      | `tests/persistence/state-io.test.ts`  | flow match           |
| `tests/bridges/commands/types.test.ts` (create)          | test, type-contract owner       | compile-time                | `tests/shared/types.test.ts`          | exact pattern        |
| `tests/bridges/commands/unstage.test.ts`                 | test, lifecycle owner           | transactional file-I/O      | `tests/persistence/state-io.test.ts`  | flow match           |
| `tests/bridges/mcp/collision-slots.test.ts`              | test, collision-policy owner    | ordered batch + file-I/O    | `tests/platform/pi-api.test.ts`       | state-boundary match |
| `tests/bridges/mcp/index.test.ts` (create)               | test, barrel owner              | binding                     | `tests/platform/pi-api.test.ts`       | exact pattern        |
| `tests/bridges/mcp/marker.test.ts`                       | test, provenance owner          | transform                   | `tests/domain/components/mcp.test.ts` | role + flow          |
| `tests/bridges/mcp/parse.test.ts`                        | test, parser owner              | request-response + file-I/O | `tests/domain/components/mcp.test.ts` | role match           |
| `tests/bridges/mcp/safe-set.test.ts` (create)            | test, security utility owner    | transform                   | `tests/domain/components/mcp.test.ts` | role + flow          |
| `tests/bridges/mcp/stage.test.ts`                        | test, lifecycle owner           | transactional file-I/O      | `tests/persistence/state-io.test.ts`  | flow match           |
| `tests/bridges/mcp/substitute.test.ts`                   | test, recursive transform owner | transform                   | `tests/domain/components/mcp.test.ts` | role + flow          |
| `tests/bridges/mcp/types.test.ts` (create)               | test, type-contract owner       | compile-time                | `tests/shared/types.test.ts`          | exact pattern        |
| `tests/bridges/mcp/unstage.test.ts`                      | test, lifecycle owner           | transactional file-I/O      | `tests/persistence/state-io.test.ts`  | flow match           |
| `tests/bridges/skills/discover.test.ts`                  | test, discovery owner           | batch + file-I/O            | `tests/domain/plugin-root.test.ts`    | flow match           |
| `tests/bridges/skills/frontmatter-degrade.test.ts`       | test, degradation owner         | transform                   | `tests/domain/components/mcp.test.ts` | role + flow          |
| `tests/bridges/skills/frontmatter-scan.test.ts` (create) | test, scanner owner             | transform                   | `tests/domain/components/mcp.test.ts` | role + flow          |
| `tests/bridges/skills/index.test.ts` (create)            | test, barrel owner              | binding                     | `tests/platform/pi-api.test.ts`       | exact pattern        |
| `tests/bridges/skills/rewrite-frontmatter.test.ts`       | test, rewriter owner            | transform                   | `tests/domain/components/mcp.test.ts` | role + flow          |
| `tests/bridges/skills/stage.test.ts`                     | test, lifecycle owner           | transactional file-I/O      | `tests/persistence/state-io.test.ts`  | flow match           |
| `tests/bridges/skills/types.test.ts` (create)            | test, type-contract owner       | compile-time                | `tests/shared/types.test.ts`          | exact pattern        |
| `tests/bridges/skills/unstage.test.ts`                   | test, lifecycle owner           | transactional file-I/O      | `tests/persistence/state-io.test.ts`  | flow match           |

### Supplemental files with assigned writes

| File                                                     | Role                         | Data Flow              | Planned Disposition                                                                                   | Owning Plan                        |
| -------------------------------------------------------- | ---------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `tests/bridges/agents/convert-byte-identity.test.ts`     | duplicate supplemental test  | transform              | absorb all seven cases, then delete                                                                   | P111-01 agents/convert             |
| `tests/bridges/integration-foreign-content.test.ts`      | duplicate supplemental test  | transactional file-I/O | absorb foreign-target preservation and failed rows, then delete                                       | P111-07 agents/stage               |
| `tests/bridges/integration-materialization-gate.test.ts` | mixed supplemental test      | cross-module file-I/O  | P111-07 absorbs AS-9; P111-20 absorbs AS-8 and rewrites the remaining MCP-only isolation case locally | P111-07, then P111-20              |
| `tests/bridges/integration.test.ts`                      | duplicate multi-family suite | transactional file-I/O | four stage owners absorb their family cases; P111-29 deletes after all dependencies                   | P111-07, P111-12, P111-20, P111-29 |

## Pattern Assignments

### Pure transforms, parsers, scanners, and value-policy owners

**Apply to:** agents `convert`, `frontmatter`, and `index-mutation`; MCP `marker`,
`parse`, `safe-set`, and `substitute`; skills `frontmatter-degrade`,
`frontmatter-scan`, and `rewrite-frontmatter`.

**Analog:** `tests/domain/components/mcp.test.ts`

**Imports and exported-entrypoint grouping** (`tests/domain/components/mcp.test.ts:1-10`):

```typescript
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  MCP_SERVERS_SCHEMA,
  MCP_SERVERS_VALIDATOR,
} from "../../../extensions/pi-claude-marketplace/domain/components/mcp.ts";

describe("MCP_SERVERS_SCHEMA", () => {
  test("describes a string-keyed object with unknown values", () => {
```

Use one top-level `describe()` per exported entrypoint only when the production module has
multiple entrypoints. A one-entrypoint owner keeps sibling `test()` calls at file scope.

**Data-row structure** (`tests/domain/components/mcp.test.ts:25-60`):

```typescript
describe("MCP_SERVERS_VALIDATOR", () => {
  for (const { description, servers, expectedServers } of [
    {
      description: "an empty record",
      servers: {},
      expectedServers: {},
    },
    {
      description: "a record with arbitrary values",
      servers: {
        nested: { command: "node", args: ["server.js"] },
        scalar: "opaque",
        list: [1, 2],
        disabled: false,
        nil: null,
      },
      expectedServers: {
        nested: { command: "node", args: ["server.js"] },
        scalar: "opaque",
        list: [1, 2],
        disabled: false,
        nil: null,
      },
    },
  ]) {
    test(`parses ${description}`, () => {
      // arrange
      const mcpServers = servers;
      const expectedMcpServers = expectedServers;

      // act
      const parsedMcpServers = MCP_SERVERS_VALIDATOR.Parse(mcpServers);

      // assert
      assert.deepStrictEqual(parsedMcpServers, expectedMcpServers);
    });
  }
```

Copy the visible row shape: each row supplies its promised outcome, and each generated
case still contains separate lowercase phases. Do not compute an expected bridge value by
calling a production formatter, normalizer, parser, serializer, marker builder, or
substitution helper.

**Structured error assertion** (`tests/domain/components/mcp.test.ts:71-95`):

```typescript
test(`rejects ${description}`, () => {
  // arrange
  const mcpServers = servers;

  // act
  const parseMcpServers = () => MCP_SERVERS_VALIDATOR.Parse(mcpServers);

  // assert
  assert.throws(parseMcpServers, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        constructorName: error.constructor.name,
        name: error.name,
        message: error.message,
      },
      {
        constructorName: "ParseError",
        name: "Error",
        message: "Parse",
      },
    );
    return true;
  });
});
```

Use this three-phase form when the action must be named or more than one expression is
involved. Use `// act & assert` only for one `assert.throws()` or `assert.rejects()`
expression, as shown later.

### Discovery, ownership, containment, and hostile-path owners

**Apply to:** agents `discover` and `marker`; commands `discover`; MCP
`collision-slots`; skills `discover`; and hostile-name/symlink rows in all four
`unstage` owners.

**Analog:** `tests/domain/plugin-root.test.ts`

**Case-owned filesystem and immediate cleanup** (`tests/domain/plugin-root.test.ts:15-27`):

```typescript
test("returns an absolute root resolved from relative segments", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "plugin-root-relative-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const absolutePath = path.resolve(directory, "plugins", "test-plugin");

  // act
  const pluginRoot: AbsolutePluginRoot = asAbsolutePluginRoot(absolutePath);

  // assert
  assert.strictEqual(pluginRoot, path.join(directory, "plugins", "test-plugin"));
  assert.strictEqual(path.relative(directory, pluginRoot), path.join("plugins", "test-plugin"));
});
```

Each bridge case must allocate its own root and write its complete distinguishing tree
inside `// arrange`. A small concern-local allocator may return fresh directory paths, but
it must not write the meaningful source document or return both an input scenario and its
expected output.

**Hostile-row proof with exact state** (`tests/domain/plugin-root.test.ts:145-173`):

```typescript
test(`rejects ${name} without creating filesystem content`, async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "plugin-root-invalid-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const unsafePluginRoot = makeUnsafePluginRoot(directory);
  const expectedErrorMessage =
    typeof errorMessage === "function" ? errorMessage(directory) : errorMessage;
  const containedPaths = makeContainedPaths(directory);

  // act
  const pluginRootError: unknown = (() => {
    try {
      asAbsolutePluginRoot(unsafePluginRoot);
      return undefined;
    } catch (error) {
      return error;
    }
  })();

  // assert
  assert.ok(pluginRootError instanceof Error);
  assert.strictEqual(pluginRootError.constructor, Error);
  assert.strictEqual(pluginRootError.message, expectedErrorMessage);
  assert.deepStrictEqual(
    containedPaths.map((containedPath) => path.relative(directory, containedPath)),
    containedRelativePaths,
  );
  assert.deepStrictEqual(await readdir(directory), []);
});
```

Use real local symlinks and malicious names to prove existing public guards. Assert the
complete returned rows, warning order, and filesystem effects; do not weaken containment
or export a private helper to reach coverage.

### Stage and unstage lifecycle owners

**Apply to:** agents `stage`/`unstage`, commands `stage`/`unstage`, MCP
`stage`/`unstage`, and skills `stage`/`unstage`.

**Structural analog:** `tests/persistence/state-io.test.ts`
**Behavior inventory:** each owner's current mirrored test plus only the supplemental
cases assigned in the disposition map.

**Fresh concern-local allocator** (`tests/persistence/state-io.test.ts:43-49`):

```typescript
async function createExtensionRoot(t: TestContext, prefix: string): Promise<string> {
  const scopeRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace");
  await mkdir(extensionRoot, { recursive: true });
  return extensionRoot;
}
```

This is the permitted factory boundary. It allocates fresh storage and paths; it does not
write the case's plugin components, build lifecycle handles, or derive expected bytes.

**Complete value in separate phases** (`tests/persistence/state-io.test.ts:63-77`):

```typescript
for (const { enabled, expectedDisabled } of [
  { enabled: true, expectedDisabled: false },
  { enabled: false, expectedDisabled: true },
]) {
  test(`reports enabled ${String(enabled)} as disabled ${String(expectedDisabled)}`, () => {
    // arrange
    const record = { enabled };

    // act
    const disabled = isRecordedButDisabled(record);

    // assert
    assert.strictEqual(disabled, expectedDisabled);
  });
}
```

Build an explicit lifecycle matrix for each stage owner through public handles:

- prepare `"noop"` and `"staged"`;
- abort cleanup and commit results;
- replacement `"noop"` and `"replaced"`;
- rollback exact restoration and finalize cleanup;
- malformed input, containment, foreign ownership, and filesystem failures belonging to
  that module.

Every case authors exact pre-operation bytes and exact expected post-operation bytes.
Never obtain expected bytes by parsing or transforming the actual result.

**Permitted combined phase** (`tests/persistence/state-io.test.ts:729-759`):

```typescript
test("rejects malformed JSON with its complete structured cause", async (t) => {
  // arrange
  const extensionRoot = await createExtensionRoot(t, "state-io-json-error-");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  await writeFile(stateJsonPath, "{");

  // act & assert
  await assert.rejects(
    () => loadState(extensionRoot),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error.cause instanceof SyntaxError);
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          cause: { name: error.cause.name, message: error.cause.message },
        },
        {
          name: "Error",
          message: `state.json at ${stateJsonPath} is not valid JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)`,
          cause: {
            name: "SyntaxError",
            message: "Expected property name or '}' in JSON at position 1 (line 1 column 2)",
          },
        },
      );
      return true;
    },
  );
});
```

The comment is lowercase and applies to exactly one rejection expression. A case that
performs setup-related actions in addition to the throwing call uses separate `// act`
and `// assert` phases instead.

### Environment-mutating owners

**Apply to:** MCP `collision-slots` and any stage/unstage case that changes
`PI_CODING_AGENT_DIR`.

**Analog:** `tests/platform/pi-api.test.ts`

**Restore before mutation** (`tests/platform/pi-api.test.ts:106-123`):

```typescript
test("returns the explicit Pi agent directory", (t) => {
  // arrange
  const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
  t.after(() => {
    if (previousAgentDirectory === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
    }
  });
  process.env.PI_CODING_AGENT_DIR = "/tmp/pi-api-agent";

  // act
  const agentDirectory = getAgentDir();

  // assert
  assert.strictEqual(agentDirectory, "/tmp/pi-api-agent");
});
```

Snapshot and register restoration before setting the variable. Do not place environment
mutation at file scope or rely on suite-level cleanup.

### Barrel owners

**Apply to:** `agents/index.test.ts`, `commands/index.test.ts`, `mcp/index.test.ts`, and
`skills/index.test.ts`.

**Analog:** `tests/platform/pi-api.test.ts`

**Direct binding identity** (`tests/platform/pi-api.test.ts:94-104`):

```typescript
describe("getAgentDir", () => {
  test("re-exports the peer binding", () => {
    // arrange
    const expectedGetAgentDir = peerGetAgentDir;

    // act
    const boundaryGetAgentDir = getAgentDir;

    // assert
    assert.strictEqual(boundaryGetAgentDir, expectedGetAgentDir);
  });
```

Import each runtime binding through the barrel and separately from its defining module,
then compare identity with `assert.strictEqual()`. Repeat for every intended runtime
export. Import exported types through the barrel so the compiler proves them. Do not add
production exports, and do not replace binding identity with `typeof`, key-count, or
truthiness assertions.

### Type-only owners

**Apply to:** `agents/types.test.ts`, `commands/types.test.ts`, `mcp/types.test.ts`, and
`skills/types.test.ts`.

**Analog:** `tests/shared/types.test.ts`

**Positive and targeted negative evidence** (`tests/shared/types.test.ts:4-11`):

```typescript
import { SCOPES, type Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

void ("user" satisfies Scope);
void ("project" satisfies Scope);
// @ts-expect-error Scope intentionally excludes the Claude Code local scope
void ("local" satisfies Scope);
// @ts-expect-error Scope excludes unrelated scope names
void ("workspace" satisfies Scope);
```

The four Phase-111 type owners contain compile-time expressions only unless their source
also has a genuine runtime export. Do not add `test("types exist")`, fake assertions,
phase comments, or production constants mirroring unions. Positive expressions cover
public records and every lifecycle discriminant; each negative directive sits immediately
above one independently selected invalid shape.

### MCP `safeSet` security owner

**Apply to:** `tests/bridges/mcp/safe-set.test.ts`.

Use the pure-owner imports and three-phase structure above. The required special case is
implementation-specific and has no existing mirrored analog: pass literal `"__proto__"`,
assert that `Object.getPrototypeOf(accumulator)` remains `Object.prototype`, and compare
the full property descriptor independently:

```typescript
test("copies __proto__ as an own data property without changing the prototype", () => {
  // arrange
  const accumulator: Record<string, unknown> = {};
  const expected = { owned: true };

  // act
  safeSet(accumulator, "__proto__", expected);

  // assert
  assert.equal(Object.getPrototypeOf(accumulator), Object.prototype);
  assert.deepEqual(Object.getOwnPropertyDescriptor(accumulator, "__proto__"), {
    value: expected,
    enumerable: true,
    writable: true,
    configurable: true,
  });
});
```

Also prove an ordinary key. Do not create the expected descriptor through `safeSet` or
copy a production constant.

## Supplemental-Suite Disposition

| Sequence | Required Write                                                                                                                                                                                                                                       | Why This Owner Owns It                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| P111-01  | Move all seven byte-identity cases from `agents/convert-byte-identity.test.ts` into `agents/convert.test.ts`; normalize phases and delete the supplemental file.                                                                                     | Only `agents/convert.ts` creates those bytes.                                                                                               |
| P111-07  | Move foreign-target preservation and failed-row assertions from `integration-foreign-content.test.ts` into `agents/stage.test.ts`, then delete that suite. Move AS-9 and the agent-family block from the two integration suites into the same owner. | Only the agent lifecycle owns its index, foreign target, no-op materialization, and commit rows.                                            |
| P111-12  | Move the command-family staging assertions from `integration.test.ts` into `commands/stage.test.ts`.                                                                                                                                                 | Only the command lifecycle owns prompt materialization and command substitution.                                                            |
| P111-20  | Depend on P111-07; move AS-8 and the MCP-family staging assertions into `mcp/stage.test.ts`. Rewrite `integration-materialization-gate.test.ts` to one case-local MCP-only isolation case.                                                           | MCP no-op and merge behavior are single-owner; absence of all three sibling targets after invoking only MCP remains genuinely cross-module. |
| P111-29  | Depend on P111-07, P111-12, and P111-20; move the skill-family staging assertions into `skills/stage.test.ts`, then delete `integration.test.ts`.                                                                                                    | This is the final writer after all four family cases have accountable owners.                                                               |

The retained supplemental contract is exact: invoking MCP staging alone materializes the
MCP output and cannot create agents-index, agents, prompts, or skills targets. Its case
must build a complete local plugin tree and complete independent expectations. It does
not contribute direct coverage for `mcp/stage.ts`.

Before deleting any path under `tests/bridges/_fixtures/`, run a repository-wide exact-path
consumer search after the absorbing edits. Delete only paths with no legitimate remaining
supplemental, orchestrator, architecture, or later-phase consumer. Do not treat a fixture
directory as one deletion unit when individual children have different consumers.

## Direct-Coverage Commands

Each plan runs its focused test, exact direct carrier, and `npm run typecheck`. The exact
direct commands are:

```text
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/discover.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/index.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/marker.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/stage.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/types.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/unstage.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/discover.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/index.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/stage.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/types.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/unstage.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/index.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/marker.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/parse.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/stage.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/types.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/discover.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/index.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/stage.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/types.ts
npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/unstage.ts
```

The carrier must report 100 percent functions, lines, and branches. For the four genuinely
type-only sources, the accepted direct result is the carrier's transpilation-confirmed
`type-only` mode plus a passing `npm run typecheck`; no runtime case is added.

## Shared Patterns

### Imports

- Runtime owners import `node:assert/strict` and `test`/`describe` from `node:test`.
- Filesystem owners import only the exact `node:fs/promises`, `node:os`, and `node:path`
  functions they exercise.
- Each mirrored owner directly imports its one production source. Supplemental imports do
  not make another source part of that owner's direct-coverage obligation.

### Case structure

- Every runtime case uses lowercase `// arrange`, blank line, `// act`, blank line,
  `// assert`.
- Lowercase `// act & assert` is restricted to one `assert.throws()` or
  `assert.rejects()` expression.
- Every data row generates a sibling case with all three separate phases.
- Case titles state public behavior; plan, phase, and ticket labels do not substitute for
  behavior.

### Fixture ownership

- Every owner case constructs its complete source tree locally.
- A helper may allocate a fresh root or return fresh small values. It may not write the
  distinguishing document, compute expected output, or return a whole scenario oracle.
- Each case owns and restores its filesystem, environment, mocks, and other mutable state.

### Assertion and error handling

- Compare complete public records, warning arrays, generated bytes, property descriptors,
  and filesystem effects.
- Compare bytes before parsing or normalization when bytes are the contract.
- Assert errors by class and complete structured fields. Do not use message fragments as
  the sole error proof.
- Assert public result/state before any promised interaction.

### Security boundaries

- Use real temporary symlinks and hostile local names for containment proof.
- Preserve foreign content and prove exact prior bytes after rollback/failure.
- Prove literal `"__proto__"` is an own enumerable, writable, configurable data property
  without prototype mutation.
- Never point a test at a developer's actual Pi directory.

## No Exact Single Analog Found

| File/Concern                         | Reason                                                                                                                                   | Planner Instruction                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Four bridge stage owners             | No existing single test combines the complete public lifecycle matrix, Phase-111 case-local fixture rule, and final lowercase structure. | Use each current owner as behavior inventory and `tests/persistence/state-io.test.ts` as the structural/file-I/O analog.            |
| `tests/bridges/mcp/safe-set.test.ts` | The mirrored owner is missing and no other production concern owns literal `"__proto__"` copy semantics.                                 | Use the Phase-111-specific case above plus the pure-owner structure from `tests/domain/components/mcp.test.ts`.                     |
| Retained MCP-only isolation case     | The existing case is the contract seed but currently reads shared fixtures and mixes absorbed no-op evidence.                            | Rebuild only the named cross-module contract with a complete case-local tree after P111-07 and P111-20 absorb their owner evidence. |

## Anti-Patterns in Migration Inputs

Do not copy these properties from the current Phase-111 bridge or supplemental tests:

- `FIXTURE_*` roots under `tests/bridges/_fixtures/` as owner inputs;
- module-scope or suite-scope mutable temporary roots;
- helpers such as a complete conversion fixture that produce both scenario input and
  expected output;
- uppercase or missing phase comments;
- partial `length`, `includes`, `find`, or one-field assertions where a complete public
  value is promised;
- integration assertions left behind after their single owner absorbs them;
- coverage obtained only because another owner or supplemental suite invokes the source.

## Metadata

**Analog search scope:** `tests/domain`, `tests/persistence`, `tests/platform`,
`tests/shared`, `tests/bridges`, and the direct-coverage carrier
**Primary analog files read:** 5
**Phase-owner and supplemental inventories reviewed:** 31 owners and 4 supplemental files
**Pattern extraction date:** 2026-08-30
