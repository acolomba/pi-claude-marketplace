# Phase 112: Hook Runtime - Pattern Map

**Mapped:** 2026-08-30
**Source-test pairs classified:** 31
**Supplemental files classified:** 8 designated carrier files
**Explicit production edits:** 1 (`stage.ts`, conditional dead-branch removal)
**Owner analogs found:** 31 / 31

## Scope and pattern authority

Phase 112 changes the 31 mirrored owner tests. Ten owner tests are new. The other 21
owner tests require normalization and new proof, even when their direct-coverage baseline
is green.

Use each current hook owner and assigned supplemental suite only as a behavior inventory.
Copy test structure from completed Phases 109-111. Do not copy global setup, hidden state
readers, uppercase phase comments, impossible double casts, or duplicate owner cases.

The research names one expected production simplification. Pair 112-28 can remove the
unreachable `stack.pop()` guard in `bridges/hooks/stage.ts`. Other production changes need
pair-local public-behavior proof. They must not add a test-only export, reset hook, reader,
or mode.

## Analog families

The 31 owners use five pattern families. A family can have a primary and a supporting
file when the owner crosses two boundaries.

| ID  | Pattern family                            | Primary analog                                            | Supporting analog                                                                                              | Use for                                                                |
| --- | ----------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| A1  | Case-owned real file system               | `tests/bridges/skills/stage.test.ts:26-45,49-174,518-579` | `tests/shared/completion-cache.test.ts:110-130`                                                                | PID persistence, staged trees, router hydration                        |
| A2  | Process and timer boundary                | `tests/platform/git-credential.test.ts:153-205`           | `tests/platform/credential-process-fake.ts:64-160`; current `tests/bridges/hooks/dispatch-exec.test.ts:46-153` | Blocking spawn, async spawn, timers, stdin, terminal events            |
| A3  | Pure transform with complete expectations | `tests/bridges/agents/convert.test.ts:13-152`             | Current mirrored hook owner as behavior inventory                                                              | Payloads, matchers, adapters, spawn planning, timeout and wire parsing |
| A4  | Case-owned state and persistence          | `tests/shared/completion-cache.test.ts:110-180,737-915`   | `tests/bridges/skills/stage.test.ts:49-174`                                                                    | Routing state, settlement, registry and router lifecycle               |
| A5  | Type-only and barrel ownership            | `tests/bridges/agents/index.test.ts:1-110`                | `tests/bridges/agents/types.test.ts:20-269`                                                                    | Result unions, type negatives, public binding identity                 |

No completed Phase 109-111 test uses `PassThrough`. For byte behavior, combine A2's
event-control boundary with the locked `PassThrough` rule in `112-CONTEXT.md` D-12.

## File classification

The action column applies to the owner test. The paired production source remains the
behavior authority.

| Pair   | Production source                                                                  | Owner test and action                                                      | Role                           | Data flow                                 | Closest analog               | Match quality |
| ------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------- | ---------------------------- | ------------- |
| 112-01 | `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts`         | `tests/bridges/hooks/async-rewake/pid-table.test.ts` (modify)              | test, persistence owner        | CRUD, file-I/O                            | A1                           | role-match    |
| 112-02 | `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts`          | `tests/bridges/hooks/async-rewake/registry.test.ts` (create)               | test, registry/service owner   | event-driven, pub-sub, file-I/O           | A2 + A4                      | role-match    |
| 112-03 | `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts`       | `tests/bridges/hooks/async-rewake/ring-buffer.test.ts` (modify)            | test, store/utility owner      | streaming, transform                      | current owner + A3 structure | composite     |
| 112-04 | `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts`                  | `tests/bridges/hooks/dispatch-exec.test.ts` (modify)                       | test, process service owner    | request-response, streaming, event-driven | A2 + current owner           | composite     |
| 112-05 | `extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`                       | `tests/bridges/hooks/dispatch.test.ts` (create)                            | test, reducer/service owner    | event-driven, transform                   | A4                           | role-match    |
| 112-06 | `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`                 | `tests/bridges/hooks/event-adapters.test.ts` (create)                      | test, adapter/utility owner    | transform, event-driven                   | A3                           | exact-flow    |
| 112-07 | `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`                   | `tests/bridges/hooks/event-router.test.ts` (modify)                        | test, route/provider owner     | event-driven, file-I/O, request-response  | A4 + A1                      | role-match    |
| 112-08 | `extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts`                    | `tests/bridges/hooks/exec-result.test.ts` (create)                         | test, model/type owner         | transform                                 | A5                           | exact-flow    |
| 112-09 | `extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts`                     | `tests/bridges/hooks/exec-timer.test.ts` (modify)                          | test, timer utility owner      | event-driven                              | A2                           | role-match    |
| 112-10 | `extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts`                       | `tests/bridges/hooks/hook-env.test.ts` (create)                            | test, config/utility owner     | transform                                 | A4                           | role-match    |
| 112-11 | `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts`                  | `tests/bridges/hooks/if-field/bash.test.ts` (create)                       | test, parser utility owner     | transform                                 | A3                           | exact-flow    |
| 112-12 | `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts`                  | `tests/bridges/hooks/if-field/glob.test.ts` (create)                       | test, compiler utility owner   | transform                                 | A3                           | exact-flow    |
| 112-13 | `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts`                 | `tests/bridges/hooks/if-field/index.test.ts` (create)                      | test, predicate provider owner | transform, request-response               | A3 + A5                      | exact-flow    |
| 112-14 | `extensions/pi-claude-marketplace/bridges/hooks/index.ts`                          | `tests/bridges/hooks/index.test.ts` (create)                               | test, barrel owner             | transform                                 | A5                           | exact-flow    |
| 112-15 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts`          | `tests/bridges/hooks/payloads/post-compact.test.ts` (modify)               | test, translator owner         | transform                                 | A3                           | exact-flow    |
| 112-16 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts` | `tests/bridges/hooks/payloads/post-tool-use-failure.test.ts` (modify)      | test, translator owner         | transform                                 | A3                           | exact-flow    |
| 112-17 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts`         | `tests/bridges/hooks/payloads/post-tool-use.test.ts` (modify)              | test, translator owner         | transform                                 | A3                           | exact-flow    |
| 112-18 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts`           | `tests/bridges/hooks/payloads/pre-compact.test.ts` (modify)                | test, translator owner         | transform                                 | A3                           | exact-flow    |
| 112-19 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts`          | `tests/bridges/hooks/payloads/pre-tool-use.test.ts` (modify)               | test, translator owner         | transform                                 | A3                           | exact-flow    |
| 112-20 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts`           | `tests/bridges/hooks/payloads/session-end.test.ts` (modify)                | test, translator owner         | transform                                 | A3                           | exact-flow    |
| 112-21 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts`         | `tests/bridges/hooks/payloads/session-start.test.ts` (modify)              | test, translator owner         | transform                                 | A3                           | exact-flow    |
| 112-22 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts`          | `tests/bridges/hooks/payloads/stop-failure.test.ts` (modify)               | test, translator/type owner    | transform                                 | A3 + A5                      | exact-flow    |
| 112-23 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts`                  | `tests/bridges/hooks/payloads/stop.test.ts` (modify)                       | test, translator/type owner    | transform                                 | A3 + A5                      | exact-flow    |
| 112-24 | `extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts`    | `tests/bridges/hooks/payloads/user-prompt-submit.test.ts` (modify)         | test, translator owner         | transform                                 | A3                           | exact-flow    |
| 112-25 | `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts`                  | `tests/bridges/hooks/routing-state.test.ts` (modify)                       | test, store/provider owner     | CRUD, event-driven                        | A4                           | exact-flow    |
| 112-26 | `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`                         | `tests/bridges/hooks/settle.test.ts` (modify)                              | test, lifecycle service owner  | event-driven, request-response            | A4                           | role-match    |
| 112-27 | `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts`                  | `tests/bridges/hooks/spawn-helpers.test.ts` (create)                       | test, process utility owner    | transform                                 | A3 + A2                      | exact-flow    |
| 112-28 | `extensions/pi-claude-marketplace/bridges/hooks/stage.ts`                          | `tests/bridges/hooks/stage.test.ts` (modify); source can remove dead guard | test, file service owner       | CRUD, file-I/O                            | A1                           | exact-flow    |
| 112-29 | `extensions/pi-claude-marketplace/bridges/hooks/timeout.ts`                        | `tests/bridges/hooks/timeout.test.ts` (modify)                             | test, config utility owner     | transform                                 | A3                           | exact-flow    |
| 112-30 | `extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts`            | `tests/bridges/hooks/translation-context.test.ts` (modify)                 | test, model/utility owner      | request-response, transform               | A5                           | exact-flow    |
| 112-31 | `extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts`                  | `tests/bridges/hooks/wire-protocol.test.ts` (modify)                       | test, parser utility owner     | transform                                 | A3                           | exact-flow    |

Coverage by analog quality is 22 exact-flow, 7 role-match, and 2 composite assignments.

## Concrete analog excerpts

### A1: temporary root and exact file effects

**Source:** `tests/bridges/skills/stage.test.ts:26-45`

```typescript
async function allocateCasePaths(
  t: TestContext,
  prefix: string,
): Promise<{
  scopeRoot: string;
  pluginRoot: string;
  pluginDataDir: string;
  locations: ReturnType<typeof locationsFor>;
}> {
  const scopeRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", scopeRoot);

  return {
    scopeRoot,
    pluginRoot: path.join(scopeRoot, "plugin"),
    pluginDataDir: path.join(scopeRoot, "plugin-data"),
    locations,
  };
}
```

This helper only allocates fresh paths. It does not create a shared scenario or expected
value. Pair 112-01 and pair 112-28 must author each table entry, file byte string, path,
and expected error in the case.

**Source:** `tests/bridges/skills/stage.test.ts:518-579`

```typescript
test("cleans the partial staging tree when substituted frontmatter is invalid", async (t) => {
  // arrange
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths(
    t,
    "skills-stage-invalid-output-",
  );
  // Case-local tree and complete expected error are authored here.

  // act
  let prepareError: unknown;
  try {
    await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: "[unterminated",
      resolved,
    });
  } catch (error) {
    prepareError = error;
  }

  // assert
  assert.ok(prepareError instanceof Error);
  assert.deepStrictEqual(
    { name: prepareError.name, message: prepareError.message, cause: prepareError.cause },
    expectedPrepareError,
  );
  assert.deepStrictEqual(await readdir(locations.skillsStagingDir), []);
});
```

Use separate `// act` and `// assert` phases when the case examines an error plus disk
effects. Do not compress this form into `// act & assert`.

### A2: process double and test-context timer

**Source:** `tests/platform/credential-process-fake.ts:64-145`

```typescript
export function createCredentialProcessFake({
  onInput,
}: CreateCredentialProcessFakeOptions): CredentialProcessFake {
  const processes: CredentialProcessControl[] = [];

  const spawn: CredentialSpawn = (command, args, options) => {
    const subcommand = assertSpawnBoundary(command, args, options);
    const stdinErrorListeners: Array<(error: Error) => void> = [];
    const stdoutListeners: Array<(chunk: Buffer) => void> = [];
    const errorListeners: Array<(error: Error) => void> = [];
    const closeListeners: Array<(code: number | null) => void> = [];
    const signals: "SIGTERM"[] = [];
    let standardInput = "";
    let ended = false;

    const process: CredentialProcess = {
      stdin: {
        on: (_event, listener) => stdinErrorListeners.push(listener),
        write: (input) => {
          standardInput += input;
        },
        end: () => {
          ended = true;
          onInput(control);
        },
      },
      stdout: {
        on: (_event, listener) => stdoutListeners.push(listener),
      },
      kill: (signal) => {
        signals.push(signal);
        return true;
      },
      on: (event, listener) => {
        if (event === "error") errorListeners.push(listener as (error: Error) => void);
        else closeListeners.push(listener as (code: number | null) => void);
      },
    };

    processes.push(control);
    return process;
  };
```

Keep the boundary narrow. Each hook case still owns its expected command, arguments,
options, bytes, signals, event order, and outcome. Do not move those values into a helper.

**Source:** `tests/platform/git-credential.test.ts:171-186`

```typescript
test("terminates a timed-out fill and returns null", async (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const processes = manualCredentialProcess();
  const credentialOps = createCredentialOps({ spawn: processes.spawn, timeoutMs: 50 });

  // act
  const pendingCredential = credentialOps.fill("github.com");
  t.mock.timers.tick(50);
  const credential = await pendingCredential;

  // assert
  assert.strictEqual(credential, null);
  assert.deepStrictEqual(processes.process().terminations(), ["SIGTERM"]);
});
```

Pair 112-09 extends this pattern. It must tick to one millisecond before and exactly at
both deadlines. It must also prove `unref`, exact handle clearing, idempotent cancel, and
zero live timers.

### A3: pure transform and independent complete expectation

**Source:** `tests/bridges/agents/convert.test.ts:13-25`

```typescript
test("exposes the complete supported Claude-to-Pi model mapping", () => {
  // arrange
  const expectedModelMap = {
    sonnet: "anthropic/claude-sonnet-4-6",
    opus: "anthropic/claude-opus-4-7",
    haiku: "anthropic/claude-haiku-4-5",
  };

  // act
  const modelMap = { ...MODEL_MAP };

  // assert
  assert.deepStrictEqual(modelMap, expectedModelMap);
  assert.ok(Object.isFrozen(MODEL_MAP));
});
```

The hook payload owners use this whole-value form. Each case constructs a complete typed
input and a complete explicit expected envelope. Do not derive the expected envelope from
the input or actual result. Use `Object.hasOwn()` when absence is part of the contract.

### A4: case-owned state and cleanup before action

**Source:** `tests/shared/completion-cache.test.ts:110-130`

```typescript
test("rebuilds a cold cache and persists exact marketplace bytes", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "completion-names-cold-"));
  const cachePath = path.join(directory, "nested", "marketplace-names.json");
  const scope = "user";
  const expectedNames = ["alpha", "beta"];
  const expectedBytes =
    '{\n  "schemaVersion": 2,\n  "names": [\n    "alpha",\n    "beta"\n  ]\n}\n';
  t.after(async () => {
    await invalidateMarketplaceNames(cachePath, scope);
    await rm(directory, { recursive: true, force: true });
  });

  // act
  const names = await getMarketplaceNames(cachePath, scope, () => Promise.resolve(expectedNames));
  const bytes = await readFile(cachePath, "utf8");

  // assert
  assert.deepStrictEqual(names, expectedNames);
  assert.strictEqual(bytes, expectedBytes);
});
```

Pairs 112-02, 112-07, 112-25, and 112-26 must register cleanup before the action. They
must use existing lifecycle APIs and public effects. They must not reload the ESM cache or
depend on hidden state readers.

### A5: module-scope type evidence and barrel identity

**Source:** `tests/bridges/agents/index.test.ts:47-75`

```typescript
void (true satisfies Same<PreparedAgentsNoop["kind"], "noop">);
void (true satisfies Same<PreparedAgentsStaged["kind"], "staged">);
void ({
  kind: "noop",
  result: { stagedNames: [], recorded: [], warnings: [], failed: [] },
} satisfies BarrelPreparedAgentsStaging);

// @ts-expect-error an agent preparation handle has a closed discriminant set
void ({ kind: "missing" } satisfies BarrelPreparedAgentsStaging);
// @ts-expect-error the barrel does not export the internal marker prefix
void (true satisfies Same<typeof AgentsBarrel.GENERATED_AGENT_PREFIX, never>);
```

**Source:** `tests/bridges/agents/index.test.ts:79-100`

```typescript
describe("abortPreparedAgents", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedAbortPreparedAgents = definingAbortPreparedAgents;

    // act
    const agentsAbortPreparedAgents = abortPreparedAgents;

    // assert
    assert.strictEqual(agentsAbortPreparedAgents, expectedAbortPreparedAgents);
  });
});
```

Pair 112-08 keeps positive and negative result evidence at module scope. Pair 112-14
compares each of the seven intended runtime bindings with its defining binding. It also
proves that internal names are unavailable through the barrel. Neither pair adds a
production export.

## Per-owner pattern assignments

### Async rewake

| Owner test                         | Pattern to copy                                              | Required Phase 112 adaptation                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `async-rewake/pid-table.test.ts`   | A1 temporary root, exact bytes, structured error and cleanup | Use a fresh root per case. Cover absent, malformed, stale, defensive-copy, atomic write/read, `ENOENT`, non-`ENOENT`, and scope separation. Absorb only PID-file cases from `hooks-async-rewake.test.ts`. |
| `async-rewake/registry.test.ts`    | A2 narrow spawn port plus A4 lifecycle cleanup               | Use `PassThrough` streams. Stage normal close, spawn error, duplicate terminal events, interleaved output, persistence snapshots, multi-child/scope isolation, orphan probes, and reload shutdown.        |
| `async-rewake/ring-buffer.test.ts` | Current owner behavior inventory with A3 phase structure     | Create a new buffer per case. Prove zero, exact, overflow, wrap, oversized chunks, raw bytes, chronological tail, latched truncation, and accepted UTF-8 boundary behavior.                               |

### Dispatch, adaptation, and routing

| Owner test               | Pattern to copy                                         | Required Phase 112 adaptation                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dispatch-exec.test.ts`  | A2 plus the current `makeMockChild` event-control shape | Replace byte-behavior streams with `PassThrough`. Keep a custom emitter only for unstageable terminal ordering. Assert the complete spawn, stdin, output, timer, listener, parse, and cleanup result. |
| `dispatch.test.ts`       | A4 case-owned state plus A3 whole-result assertions     | Prove matcher/`if` conjunction, sequential reduction, mutation visibility, first terminal result, async degradation, stale composite handling, tool-result split, and adaptation order.               |
| `event-adapters.test.ts` | A3 complete input/output transform                      | Prove all result arms, object guards, mutation whitelist, optional-key absence, routing-field preservation, SessionStart provenance, observation drops, and semantic diagnostics.                     |
| `event-router.test.ts`   | A4 lifecycle plus A1 real storage                       | Use case-owned router state and roots. Prove read/cache/rebuild/hydration failures, reload order, orphan reap order, pending context drain, and exactly 11 registrations.                             |

### Result, timer, environment, and helper leaves

| Owner test              | Pattern to copy                                     | Required Phase 112 adaptation                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exec-result.test.ts`   | A5 module-scope positive and negative evidence      | Cover all four union arms and three permission values. Keep only `assertNever` as runtime proof.                                                                                                                         |
| `exec-timer.test.ts`    | A2 current test-context timer                       | Normalize every runtime case to lowercase phases. Tick just before and at both legs. Assert two timers, exact delays, `unref`, exact clears, exit/cancel races, repeated cancel, late callbacks, and no remaining timer. |
| `hook-env.test.ts`      | A4 case-owned process state plus A3 complete object | Capture property existence and value before mutation. Register restoration first. Prove precedence, contained paths, SessionStart-only env file, inherited keys, and true remote-key absence.                            |
| `spawn-helpers.test.ts` | A3 exact transform plus A2 command boundary         | Prove exec form versus shell form and the full UTF-8 serialization boundary. Assert final bounded bytes, marker precedence, object/array/primitive truncation, wrapping, and source non-mutation.                             |
| `timeout.test.ts`       | A3 named partition rows                             | Keep each row's input and expected value complete. Cover positive, fractional, invalid, per-event defaults, background default, and diagnostic partitions. Do not test upper clamping here.                              |

### If-field compiler

| Owner test               | Pattern to copy                              | Required Phase 112 adaptation                                                                                                                                                        |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `if-field/bash.test.ts`  | A3 named pure-transform rows                 | Cover separators, quotes, escapes, substitutions, unmatched input, recursion/fail-open, wrappers, `xargs`, dedupe, direct glob, and specificity.                                     |
| `if-field/glob.test.ts`  | A3 named pure-transform rows                 | Cover token kinds, command/path boundaries, anchor precedence, containment, bare-name scanning, globstar, normalized bases, and complete compiled metadata.                          |
| `if-field/index.test.ts` | A3 transform plus A5 type/re-export evidence | Cover exact predicate arms, compile partitions, evaluate partitions, cwd fallback, MCP forms, fail-open, and exhaustive dispatch. Carry the final prune of `hooks-if-field.test.ts`. |

### Barrel and payload translators

| Owner test                               | Pattern to copy                                          | Required Phase 112 adaptation                                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.test.ts`                          | A5 direct binding identity and negative internal absence | Compare exactly seven runtime bindings. Import types through the barrel. Do not use key count, truthiness, or new exports.                        |
| `payloads/post-compact.test.ts`          | A3 complete transform                                    | Assert the complete five-key envelope, exact discriminator and trigger, context pass-through, and no extra keys.                                  |
| `payloads/post-tool-use-failure.test.ts` | A3 complete transform                                    | Assert the complete seven-key envelope, tool mapping, nested identity, and no extra keys. Malformed values stay in pair 112-04.                   |
| `payloads/post-tool-use.test.ts`         | A3 complete transform                                    | Assert the complete seven-key envelope, tool mapping, nested identity, and no extra keys. Malformed values stay in pair 112-04.                   |
| `payloads/pre-compact.test.ts`           | A3 complete transform                                    | Assert the complete five-key envelope, exact discriminator and trigger, complete typed input, and no extra keys.                                  |
| `payloads/pre-tool-use.test.ts`          | A3 complete transform                                    | Assert the complete six-key envelope, built-in/custom mapping, nested identity, and no extra keys.                                                |
| `payloads/session-end.test.ts`           | A3 complete transform                                    | Assert the complete five-key envelope and verbatim reason/context from an independently authored expectation.                                     |
| `payloads/session-start.test.ts`         | A3 complete transform                                    | Assert the complete five-key envelope and verbatim source/context. Additional-context routing stays in pairs 112-06 and 112-07.                   |
| `payloads/stop-failure.test.ts`          | A3 whole object plus A5 type negatives                   | Prove true optional omission, classifier/status/stop-reason precedence, exact envelope, and negative types. Routing discard stays in pair 112-26. |
| `payloads/stop.test.ts`                  | A3 whole object plus A5 type evidence                    | Prove the six-key envelope, text/active pass-through, no extra keys, and synthetic-event type contract. Re-entry stays in pair 112-26.            |
| `payloads/user-prompt-submit.test.ts`    | A3 complete transform                                    | Prove the five-key envelope, empty and non-ASCII prompt pass-through, context, and no extra keys.                                                 |

### State, settlement, storage, and wire

| Owner test                    | Pattern to copy                             | Required Phase 112 adaptation                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routing-state.test.ts`       | A4 case-owned public lifecycle              | Call every public state verb directly. Reset only case-owned state before and after the action. Do not export private cells.                                                                       |
| `settle.test.ts`              | A4 public-effects state proof               | Prove cache, every stop reason, observer discard, epoch guard, render, re-entry cap, notify, input reset, and send failure through outputs. Stop using hidden readers.                             |
| `stage.test.ts`               | A1 real tree, exact bytes and cleanup       | Use one root per case. Prove directory/symlink/containment/I/O/atomic-write/remove behavior. Pair-locally remove the unreachable pop guard. Delete `symlink-escape.test.ts` only after absorption. |
| `translation-context.test.ts` | A3 snapshot plus A5 readonly/type negatives | Use a complete typed context. Prove the exact snapshot, empty file fallback, readonly negatives, and barrel non-export.                                                                            |
| `wire-protocol.test.ts`       | A3 precedence rows                          | Prove exit, parse, primitive/null root, top-level/nested precedence, mutation conflicts, suppression, wrong-type omission, final noop, and semantic diagnostics.                                   |

## Process and stream double contract

The current `dispatch-exec.test.ts:67-119` helper is the closest event-order analog. It
uses one `EventEmitter` for child terminal events and exposes explicit `emitClose()` and
`emitError()` controls. Preserve that control shape for event ordering.

Do not copy its `Readable.push()` transport for byte proof. Use real streams:

```typescript
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

const events = new EventEmitter();
const stdin = new PassThrough();
const stdout = new PassThrough();
const stderr = new PassThrough();

const child = Object.assign(events, {
  stdin,
  stdout,
  stderr,
  exitCode: null,
  signalCode: null,
  kill(signal?: NodeJS.Signals): boolean {
    signals.push(signal ?? "SIGTERM");
    return true;
  },
});
```

Each case owns the three streams and settles them before completion. The case asserts
listener removal and timer cancellation after overflow or terminal settlement. A small
custom emitter is permitted only when `PassThrough` cannot stage the required ordering.

## Timer schedule contract

All scheduling cases use the current `TestContext`. The canonical case shape is:

```typescript
test("sends both escalation signals at their exact deadlines", (t) => {
  // arrange
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = makeSpyChild();
  const ladder = installTimerLadder(child, 1, "plugin/PreToolUse");
  t.after(() => ladder.cancel());

  // act
  t.mock.timers.tick(999);

  // assert
  assert.deepStrictEqual(child.killCalls, []);

  // act
  t.mock.timers.tick(1);

  // assert
  assert.deepStrictEqual(child.killCalls, ["SIGTERM"]);

  // act
  t.mock.timers.tick(4_999);

  // assert
  assert.deepStrictEqual(child.killCalls, ["SIGTERM"]);

  // act
  t.mock.timers.tick(1);

  // assert
  assert.deepStrictEqual(child.killCalls, ["SIGTERM", "SIGKILL"]);
});
```

Each row still needs separate phases. Do not hide the schedule in a shared helper.

## Case-owned process state

Use exact existence and value restoration when a process-wide mutation is unavoidable:

```typescript
// arrange
const key = "CLAUDE_CODE_REMOTE";
const hadKey = Object.hasOwn(process.env, key);
const previousValue = process.env[key];
t.after(() => {
  if (hadKey) process.env[key] = previousValue;
  else delete process.env[key];
});
delete process.env[key];

// act
const env = prepareEnv(input);

// assert
assert.strictEqual(Object.hasOwn(env, key), false);
```

Serialize only cases that mutate the same process-wide key. Prefer injected probes for
platform, PID, or liveness input.

## Supplemental carrier assignments

Each file has one final carrier. Prerequisite owner plans absorb their cases first. The
carrier then prunes or removes the file in the same pair-atomic commit.

| Supplemental file                                              | Role                        | Data flow                                 | Final carrier | Required action                                                                                                                    |
| -------------------------------------------------------------- | --------------------------- | ----------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `tests/architecture/hooks-async-rewake.test.ts`                | mixed supplemental test     | event-driven, streaming, file-I/O         | 112-02        | Absorb registry/PID/ring/timer/dispatch owner behavior. Retain only named cross-lane env parity and bridge-reload lifecycle proof. |
| `tests/architecture/hooks-exec.test.ts`                        | duplicate supplemental test | request-response, streaming, event-driven | 112-04        | Absorb direct spawn/env/timer/wire behavior, then remove the duplicate suite. Real install-to-child proof remains in integration.  |
| `tests/architecture/hooks-reducer.test.ts`                     | duplicate supplemental test | event-driven, transform                   | 112-05        | Absorb all reducer, order, and adaptation behavior, then remove the file.                                                          |
| `tests/architecture/hooks-adapters.test.ts`                    | duplicate supplemental test | transform, event-driven                   | 112-06        | Absorb guards, whitelist, and adapter arms, then remove the file.                                                                  |
| `tests/bridges/hooks/session-start-additional-context.test.ts` | mixed supplemental test     | event-driven, CRUD                        | 112-07        | Pairs 112-06, 112-07, and 112-25 absorb their parts. Pair 112-07 removes the file after those dependencies.                        |
| `tests/architecture/hooks-dispatch.test.ts`                    | mixed supplemental test     | event-driven, request-response            | 112-07        | Move owner behavior to 112-05 and 112-07. Retain only repository-wide OBS-01 static logging constraints.                           |
| `tests/architecture/hooks-if-field.test.ts`                    | mixed supplemental test     | transform                                 | 112-13        | Pairs 112-11 and 112-12 absorb leaf truth tables. Pair 112-13 retains only a unique config side-map to `RoutingEntry` chain.       |
| `tests/bridges/hooks/symlink-escape.test.ts`                   | duplicate supplemental test | file-I/O                                  | 112-28        | Absorb all real-tree symlink cases into `stage.test.ts`, then remove the file.                                                     |

This matches the Phase 111 pair-atomic pattern in
`.planning/phases/111-non-hook-component-bridges/111-PATTERNS.md:469-475`: prerequisite
owners absorb behavior before one final writer edits or removes the shared supplemental
file.

### Retained supplemental contracts

Do not absorb these cross-module contracts into one owner:

| File or family                                                     | Distinct retained contract                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/architecture/hooks-translators.test.ts`                     | Cross-module translator-table completeness and shared tool-name mapping only. Plan 112-04 removes the byte-equal round-trip block and its `EVENT_FIXTURES`/`EXPECTED_JSON` after owners 112-15 through 112-24. |
| `tests/architecture/hooks-lifecycle.test.ts`                       | Orchestrator cache and rebuild lockstep.                                                                                                           |
| `tests/architecture/hooks-foundation.test.ts`                      | Resolver and schema foundations across modules.                                                                                                    |
| `tests/architecture/hooks-cap-notify.test.ts`                      | Code-to-documentation notification bytes.                                                                                                          |
| `tests/architecture/no-hooks-strict-additional-properties.test.ts` | Repository-wide schema policy.                                                                                                                     |
| Four `tests/integration/hooks-*.test.ts` suites                    | Install/register/real-spawn, lazy project hydration, cross-scope reconcile, and additional-context end-to-end chains.                              |

Plan 112-04 is the sole late carrier for pruning `hooks-translators.test.ts` after pairs
112-15 through 112-24. Parallel payload plans must not edit it; 112-04 retains only the
translator-module completeness and shared tool-name mapping contracts.

## Shared patterns

### Imports

- Runtime owners import `node:assert/strict` and `test` or `describe` from `node:test`.
- File owners import only the exact `node:fs/promises`, `node:os`, and `node:path` members.
- Byte-process owners import `PassThrough` from `node:stream`.
- Type-only imports stay separate with `import type`.
- Production imports use explicit `.ts` extensions and repository-relative paths.

### Lowercase runtime phases

Every runtime case uses this exact order and spacing:

```typescript
// arrange
const input = completeInput;

// act
const actual = operation(input);

// assert
assert.deepStrictEqual(actual, completeExpectedValue);
```

Use lowercase `// act & assert` only when one `assert.throws()` or `assert.rejects()`
expression is the complete action and assertion. Data rows also use separate phases.

### Validation and error handling

- Compare complete objects and exact stable bytes.
- Assert optional-key absence with `Object.hasOwn()` or a complete key list.
- Assert stable error type, name, message, cause, contract fields, and public side effects.
- Assert diagnostics by category, plugin/event context, relevant text, and destination.
- Do not freeze incidental punctuation or a complete debug-log sentence.

### Pair-atomic delivery

- One plan owns one source-test pair and one focused direct-coverage command.
- A production edit stays in the same pair commit as its owner proof.
- One final carrier owns each supplemental file.
- A carrier depends on every owner that first absorbs cases from that file.
- No other plan edits the same supplemental file in parallel.

### Verification commands

For every owner:

```text
node --test <owner-test-path>
npm run test:coverage:direct -- <owner-test-path>
```

The direct command must report 100% functions, lines, and branches for the paired source.
After a carrier edit, run the carrier and every prerequisite owner that absorbed a case.
The phase gate is:

```text
npm run test:corresponding
npm run test:coverage:direct:all
npm run check
```

## No exact completed analog

| Concern                                                               | Closest available pattern                                                      | Planner instruction                                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real `PassThrough` streams inside a controllable child double         | A2 process boundary plus current `dispatch-exec.test.ts:67-119` event controls | Follow D-12 and the Process and stream double contract in this map. Do not copy the current `Readable.push()` transport for byte proof.                  |
| Two-leg SIGTERM-to-SIGKILL exact boundary with full handle inspection | A2 one-leg timer case plus current `exec-timer.test.ts` spy shape              | Follow D-14 through D-17 and the Timer schedule contract. Keep the current test context and add exact handle, `unref`, clear, race, and leak assertions. |

These gaps do not require a production test seam or another package.

## Metadata

**Analog search scope:** completed Phase 109-111 owners, current hook owners as behavior
inventories, and eight designated supplemental suites
**Primary directories:** `tests/{bridges,platform,shared,architecture,integration}` and
`extensions/pi-claude-marketplace/bridges/hooks`
**Primary analog files read:** 9
**Pattern extraction date:** 2026-08-30
**Code discovery:** CodeGraph first, then non-overlapping targeted reads
**Deferred ideas used:** none
