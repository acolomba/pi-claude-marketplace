# Phase 10: Lifecycle Test and Harness Gaps - Pattern Map

**Mapped:** 2026-10-27
**Files classified:** 25 file families
**Strong analogs:** 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `features/lib/pi-tui.ts` | process driver | streaming, event-driven | `test/e2e/_rpc.ts`, `features/lib/pi-process.ts` | role + lifecycle |
| `features/support/world.ts` | scenario store/lifecycle | event-driven | its `usePiWith`/`onRelease` ownership | exact |
| `features/step_definitions/marketplace/background-update.steps.ts` | acceptance adapter | request-response | `features/lib/pi-commands.ts::sendMessage` | exact surface |
| completion step module selected by the planner | acceptance adapter | request-response | `test/edge/completions/provider.test.ts` | role match |
| `features/lib/git-clones.ts` | fixture projection | file I/O | its existing clone-tree walk | exact |
| `features/lib/run-tokens.ts` | fixture parser | transform | its existing closed token expansion | exact |
| `features/step_definitions/plugin/installation.steps.ts` | acceptance projection | file I/O, transform | its installation-record and clone projections | exact |
| `features/plugin/list-filters.feature` | behavior specification | batch | `features/plugin/list.feature` | extraction |
| `test/edge/handlers/plugin/browse.test.ts` | owner test | event-driven | deferred-promise tests in `background-gate.test.ts` | role match |
| shared marketplace test seeder (existing test-support location chosen by planner) | test fixture | file I/O | `test/orchestrators/plugin/uninstall.test.ts::seedDeclaringScope` | exact |
| `test/orchestrators/plugin/install-flow.test.ts` | owner test | batch transaction | existing install-plan/cascade cases | exact |
| `test/orchestrators/plugin/reinstall-flow.test.ts` | owner test | batch transaction | shared record-plus-manifest seeder above | role match |
| `orchestrators/plugin/install-flow.ts` | orchestration | batch transaction | its `InstallPlanResult` and `handleCaughtInstallFailure` carrier | exact |
| `orchestrators/plugin/install-cascade.ts` | domain orchestration | batch transform | `PlannedClosure` / `CascadeMemberOutcome` | exact |
| `orchestrators/plugin/install-cascade.messaging.ts` | presentation model builder | transform | existing rollback/member-row composition | exact |
| `orchestrators/plugin/update-cascade.ts` | orchestration carrier | batch transform | install-cascade carrier | role match |
| `orchestrators/reconcile/apply.ts` | reconciliation orchestration | batch transaction | `installFailedOutcomes` | exact |
| `orchestrators/reconcile/apply-outcomes.ts` | discriminated outcome model | transform | `SourceMismatchOutcome` | exact |
| `features/plugin/install-dependencies.feature` | behavior specification | request-response | existing dependency-failure scenarios in the file | exact |
| `features/plugin/apply.feature` | behavior specification | request-response | existing failed-install scenario | exact |
| `features/marketplace/background-update.feature` | behavior specification | event-driven | existing RPC-negative scenario | exact |
| `features/plugin/reinstall.feature` | behavior specification | request-response | existing reinstall rows | exact |
| `features/plugin/update-dependencies.feature` | behavior specification | request-response | existing update-cascade scenarios | exact |
| `features/plugin/fetch.feature` | behavior specification | request-response | existing marketplace-filtered continuation scenario | exact |
| `package.json` / `package-lock.json` | dependency config | build input | existing dev-dependency pins | exact |

All existing analog paths above are git-tracked. New paths must remain in the tracked `features/`, `test/`, or extension source trees, never a generated mirror.

## Pattern Assignments

### `features/lib/pi-tui.ts` and `features/support/world.ts`

**Analogs:** `test/e2e/_rpc.ts:65-119,402-430`, `features/lib/pi-process.ts:84-130`, and `features/support/world.ts:380-472`.

Keep transport-specific parsing in the driver but copy the RPC driver's containment and result ownership:

```typescript
export interface RpcSessionOptions {
  readonly sandbox: RpcSandbox;
  readonly steps: readonly RpcStep[];
  readonly hardStopMs?: number;
  readonly signal?: AbortSignal;
}

export async function runRpcSession(options: RpcSessionOptions): Promise<RpcSessionResult> {
  const sandbox = await resolveSandbox(options.sandbox);
  options.signal?.throwIfAborted();
  return collect(startSession(options, sandbox), options);
}
```

The TUI sibling should reuse the same resolved sandbox/realpath refusal, allowlisted environment, process-group hard stop, abort signal, and complete observation record. It must not copy JSONL parsing or pretend TUI notifications are RPC entries.

Scenario ownership follows the existing LIFO release stack:

```typescript
async release(): Promise<void> {
  const errors: unknown[] = [];
  for (const release of this.releases.splice(0).reverse()) {
    try {
      await release();
    } catch (error: unknown) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, "scenario releases failed");
  }
}
```

Register the PTY stop immediately after a successful start. The `After` hook must keep checking uncompared rows/notices/session results so a new TUI result kind cannot silently escape assertions.

### Background-update and completion acceptance adapters

**Analog:** `features/lib/pi-commands.ts:203-241`.

The current background helper records an observation window, requires the prompt response itself to contain no background payload, then waits for a stable quiet window:

```typescript
const before = (await readCustomEntries(pi)).length;
const exchange = await pi.request({ type: "prompt", message });
assertQuiet(exchange);
const deadline = Date.now() + BACKGROUND_RESULT_WINDOW_MS;
let payloads: readonly NotificationPayload[] = [];
let quietSince = Date.now();
```

Copy the ownership shape, not its polling implementation: the TUI driver should wait on PTY data/prompt events and a bounded quiet window. Completion capture should call the registered completion callback or provider through a narrow public test adapter, then compare the complete completion set. Do not parse debug logs or reach into completion cache files.

### Shared marketplace record-plus-manifest seeder

**Analog:** `test/orchestrators/plugin/uninstall.test.ts:5763-5827`.

This helper establishes the required write order and a self-consistent record:

```typescript
const marketplaceRoot = path.join(cwd, marketplace);
const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
await mkdir(path.dirname(manifestPath), { recursive: true });
// build entries and plugin records together
await writeFile(manifestPath, JSON.stringify({ name: marketplace, plugins: entries }));
state.marketplaces[marketplace] = {
  name: marketplace,
  scope: locations.scope,
  source: pathSource(`./${marketplace}`),
  addedFromCwd: cwd,
  manifestPath,
  marketplaceRoot,
  plugins: pluginRecords,
};
await seedState(locations.extensionRoot, state);
```

Extract the smallest reusable helper that writes the manifest before returning/inserting the record. Replace the install and reinstall phantom fixtures; do not weaken the production fail-closed manifest read.

### CAS-08 failure carriers

**Analogs:** `orchestrators/plugin/install-flow.ts:3500-3690`, `orchestrators/plugin/install-cascade.ts:331-409,432-457`.

The planner currently compresses a failed graph to only an error and a subject:

```typescript
type InstallPlanResult =
  | Extract<DependencyPlan, { readonly ok: true }>
  | { readonly err: unknown; readonly cascadeFailure: CascadeFailureSink };

return plan.ok
  ? plan
  : {
      err: cascadeFailureCause(plan.subject, args.root.key),
      cascadeFailure: { subject: plan.subject, mcpConfigNotices: [] },
    };
```

Extend the discriminated carrier with the ordered resolved members already known at each failure seam. Preserve `PlannedClosure.members`/`alreadyInstalled` semantics; do not re-walk catalogs in a catch. The messaging layer should turn carried members into the same failed member-row shape once, preserving post-order and deduplication.

### MIM-05 apply rollback detail

**Analog:** `orchestrators/reconcile/apply.ts:576-637`.

Reuse the established split between the requested row and its failed dependency:

```typescript
const { dependency: own, others } = splitDependencyPartials(error.key, rollbackPartials);
const requested: PluginInstallFailedOutcome = {
  ...subject,
  reason: "dependency failed",
  ...(others.length > 0 && { rollbackPartials: redactedRollbackPartials(others) }),
  ...carriedMcpConfigNotices(result),
};
const dependency = dependencyRollbackOutcome(op.scope, error, redactedRollbackPartials(own));
```

MISS-01 should feed this same path with its existing install outcome. `apply-outcomes.ts` remains a closed discriminated model; add fields/arms explicitly and let the notification builder render the existing rollback grammar.

### Event-driven browse owner tests

**Analog:** `test/orchestrators/marketplace/background-gate.test.ts:12-32,70-87` and `test/bridges/hooks/event-router.test.ts:737-756`.

Replace fixed 50 ms waits with a deferred barrier controlled by the mock loader:

```typescript
interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value: T): void {
      if (resolvePromise === undefined) {
        throw new Error("the deferred operation was not initialized");
      }
      resolvePromise(value);
    },
  };
}
```

Have the loader resolve a separate `called` barrier before returning its result, await that barrier after Enter, then continue input. Do not replace 50 ms with a zero-duration timer: that still tests scheduling luck rather than the event.

## Shared Patterns

### Hermetic process boundary

- Every child HOME, agent directory, cwd, git config, registry, and marketplace lives under the scenario's temp root.
- Resolve real paths before spawning and refuse repository/real-home locations.
- Register cleanup immediately and aggregate cleanup errors.
- Use local stand-ins and offline flags; never contact public services.

### Complete-result assertions

- Feature tables list every row, not a sample.
- Preserve `uncomparedRows`, `uncomparedNotices`, and `uncomparedSessionResults` checks.
- For failure carriers, assert both the full ordered member rows and the root cause/rollback detail.

### Closed outcome models

- Add data at the orchestrator seam where it is known.
- Carry typed facts through discriminated unions.
- Redact absolute paths before presentation.
- Render once in messaging code; never reconstruct facts from strings.

### Verification pairing

- Changed extension source keeps its paired `test/` module at 100% direct coverage.
- User-visible behavior changes add a named Cucumber scenario that fails without the change.
- Shared Cucumber support changes require `npm run check:features` and the affected feature files before the full `npm run check` gate.

## No Close Analog

| File/Need | Reason | Planner Direction |
|---|---|---|
| real TUI PTY driver | repository has RPC process drivers and an interactive demo, but no automated PTY session | combine RPC containment/lifecycle with the official `node-pty` API from RESEARCH.md; keep the API Phase-10 narrow |
| package-process-tree Cucumber seam | strong unit coverage exists, but no accepted public-surface timeout seam | spike first; record a unit-only harness limit rather than add a production test knob if unreachable |
| total outbound-network guard | a Node preload cannot govern git/credential subprocesses | record the explicit decline unless a process-wide design covers every route |

## Metadata

**Search scope:** `features/`, `test/e2e/`, `test/edge/`, `test/orchestrators/`, plugin/reconcile orchestrators, completion providers, and Wave 1 artifacts.

**Method:** CodeGraph call paths and verbatim sources first, followed by targeted tracked-file searches. Pattern extraction date: 2026-10-27.
