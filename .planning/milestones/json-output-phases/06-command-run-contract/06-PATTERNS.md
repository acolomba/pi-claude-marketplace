# Phase 06: Command-Run Contract - Pattern Map

**Mapped:** 2026-10-09
**Scope:** Approved D-01 through D-10 in `06-CONTEXT.md`, with file owners inferred from `06-RESEARCH.md`. This is a bounded pattern map, not an implementation or another research pass.
**Files classified:** 31 candidate modification targets; no new source file is required by the research.
**Analog coverage:** 31 / 31 have an existing owner or reusable role pattern. The new command outcome/recovery state machine has no complete existing analog.

## File Classification

All paths below are repository-relative. Every existing source, test, and generator path named as an analog was checked with `git ls-files -- <path>` or equivalent batched pathspecs; none is an installed mirror. “Exact” means the current owner provides the same role and flow, not that the Phase 06 behavior already exists. Conditional files should change only if the chosen implementation needs them.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/shared/notification-run.ts` | model / utility | request-response | Same file, lines 7-38; assignment A | exact |
| `extensions/pi-claude-marketplace/edge/register.ts` | controller | request-response | Same file, lines 135-143; assignment B | exact |
| `extensions/pi-claude-marketplace/edge/router.ts` | route | request-response | Same file, lines 145-271; assignment B | exact |
| `extensions/pi-claude-marketplace/edge/types.ts` (conditional injection seam) | model | request-response | Same file, lines 24-36; assignment A | exact |
| `extensions/pi-claude-marketplace/shared/notification-types.ts` (conditional error input type) | model | transform | `extensions/pi-claude-marketplace/shared/notification-resolve.ts`, lines 598-627; assignment D | role-match |
| `extensions/pi-claude-marketplace/shared/notification-resolve.ts` | service | transform | Same file, lines 521-535 and 598-627; assignment D | exact |
| `extensions/pi-claude-marketplace/shared/notification-present.ts` (conditional presentation enrollment) | model / service | transform | `extensions/pi-claude-marketplace/shared/notification-resolve.ts`, lines 521-535; assignment D | role-match |
| `extensions/pi-claude-marketplace/shared/notification-wire.ts` | model | transform | Same file, lines 264-285 and 479-581; assignment C | exact |
| `extensions/pi-claude-marketplace/shared/notification-json.ts` | utility | transform | Same file, lines 46-55 and 124-171; assignment C | exact |
| `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` | service | event-driven | Same file, lines 383-405; assignment D | exact |
| `extensions/pi-claude-marketplace/index.ts` | controller | event-driven | Same file, lines 84-125; assignment B | exact |
| `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` | controller | event-driven | Same file, lines 154-158; assignment B | exact |
| `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` | service | event-driven | Same file, lines 428-446; assignment B | exact |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` (factory compatibility) | controller | request-response | `extensions/pi-claude-marketplace/shared/notification-run.ts`, lines 37-38; assignment A | partial: factory dependency |
| `schema/claude-plugin.schema.json` | config | transform | `scripts/generate-wire-schema.mjs`, lines 19-24; assignment C | partial: generated artifact |
| `tests/shared/notification-run.test.ts` | test | request-response | Same file, lines 20-61; assignment E | exact |
| `tests/edge/register.test.ts` | test | request-response | Same file, lines 424-522; assignment E | exact |
| `tests/edge/router.test.ts` | test | request-response | `tests/edge/register.test.ts`, lines 424-464; assignment E | role-match |
| `tests/shared/notification-types.test.ts` (conditional pair) | test | transform | `tests/shared/notification-dispatch.test.ts`, lines 59-99; assignment E | role-match |
| `tests/shared/notification-resolve.test.ts` | test | transform | `tests/shared/notification-dispatch.test.ts`, lines 59-99; assignment E | role-match |
| `tests/shared/notification-present.test.ts` (conditional pair) | test | transform | `tests/shared/notification-dispatch.test.ts`, lines 59-99; assignment E | role-match |
| `tests/shared/notification-wire.test.ts` | test | transform | `tests/edge/json-capture.ts`, lines 29-47; assignment E | partial: schema validation support |
| `tests/shared/notification-json.test.ts` | test | transform | `tests/shared/notification-dispatch.test.ts`, lines 59-99; assignment E | role-match |
| `tests/shared/notification-dispatch.test.ts` | test | event-driven | Same file, lines 59-178; assignment E | exact |
| `tests/index.test.ts` | test | event-driven | `tests/edge/register.test.ts`, lines 424-464; assignment E | role-match |
| `tests/bridges/hooks/settle.test.ts` | test | event-driven | `tests/shared/notification-dispatch.test.ts`, lines 103-178; assignment E | role-match |
| `tests/bridges/hooks/async-rewake/registry.test.ts` | test | event-driven | `tests/shared/notification-dispatch.test.ts`, lines 103-178; assignment E | role-match |
| `tests/edge/handlers/tools.test.ts` (conditional factory compatibility pair) | test | request-response | `tests/shared/notification-run.test.ts`, lines 20-61; assignment E | role-match |
| `tests/shared/notification-run-seeds.ts` | utility | transform | Same file, lines 4-13; assignment E | exact |
| `tests/edge/json-capture.ts` (reuse; edit only if necessary) | utility | event-driven | Same file, lines 18-49; assignment E | exact |
| `tests/edge/notification-boundary.ts` (conditional shared fixture propagation) | utility | event-driven | `tests/edge/json-capture.ts`, lines 18-49; assignment E | role-match |

The research names `shared/errors.ts`, `shared/debug-log.ts`, and schema scripts as reuse dependencies, not required edits. Their exact tracked paths and excerpts follow. No change to dependencies, public documentation, alias vocabulary, text corpus, or persisted state is implied. New source files, if the planner chooses to split a responsibility, need their own direct test pair; no speculative filename is assigned here.

## Pattern Assignments

### A. Run factories and injection

**Apply to:** `shared/notification-run.ts`, conditional `edge/types.ts`, and factory compatibility in `edge/handlers/tools.ts` listed above.

**Analog:** `extensions/pi-claude-marketplace/shared/notification-run.ts`, lines 1-9:

```typescript
import { softDepStatus } from "../platform/pi-api.ts";

import { UnsupportedModeError } from "./errors.ts";

import type { ExtensionMode, SoftDepStatus, ToolInventory } from "../platform/pi-api.ts";

/** The host entry capability used by the notification dispatcher. */
export interface NotificationEntrySink {
  appendEntry(customType: string, payload: unknown): void;
}
```

Core factory, same file, lines 26-30 and 37-38:

```typescript
export interface NotificationRun {
  /** D-05: the one soft-dependency snapshot every emission of the run reads. */
  readonly softDeps: SoftDepStatus;
  readonly entrySink: NotificationEntrySink;
}
```

```typescript
export function openNotificationRun(pi: ToolInventory & NotificationEntrySink): NotificationRun {
  return { softDeps: softDepStatus(pi), entrySink: pi };
}
```

Retain the original sink and one inventory snapshot. Require explicit origin at real roots; generate command correlation once and retain it through delegated work. Mode belongs to the live context, not the snapshot. The current factory has neither metadata nor outcome state; adding those is new work.

Existing per-run dependency injection analog: `extensions/pi-claude-marketplace/edge/types.ts`, lines 27-33:

```typescript
  /**
   * Autoupdate-cascade injection seam, allocated per command invocation:
   * the marketplace update handler calls this once and passes the returned
   * function to the orchestrator, so the cascade's D-10-18 tag memos are
   * bounded by the run rather than by this binding's lifetime.
   */
  readonly beginPluginUpdateRun: () => PluginUpdateFn;
```

Use that allocation ownership pattern for an injectable invocation-ID generator if injection belongs in `EdgeDeps`; do not reuse the plugin-update factory itself. CodeGraph found additional factory consumers in `extensions/pi-claude-marketplace/edge/handlers/tools.ts`; direct search located calls at lines 120 and 487. Inspect those tool callbacks before changing the required factory arguments. They do not justify inventing a fourth wire origin or applying slash-command completion rules to tool results.

### B. Command and callback roots

**Apply to:** registration, routing, load root, settle root, and rewake root in the classification table.

**Command analog:** `extensions/pi-claude-marketplace/edge/register.ts`, lines 135-143:

```typescript
  pi.registerCommand("claude:plugin", {
    description: COMMAND_DESCRIPTION,
    // D-05 / D-07: one notification run per command invocation, opened
    // before routing, so every emission of the command reads one snapshot.
    // A usage error opens its run too.
    handler: (args, ctx) => {
      requireNotificationMode(ctx.mode);
      return routeClaudePlugin(args, handlers, ctx, openNotificationRun(pi));
    },
```

Keep this outer callback synchronous through mode preflight. Introduce the awaited command lifetime after that check. Existing owner tests use `assert.throws`, not `assert.rejects`, for unsupported modes and stale mode access. Root finalization must await routed work and machine failure/missing-outcome delivery before settling. Text exception behavior stays fixed.

**Alias/delegation analog:** `extensions/pi-claude-marketplace/edge/router.ts`, lines 189-203:

```typescript
    case "list":
    case "ls":
      return handlers.list(rest, ctx, run);
    case "info":
      return handlers.pluginInfo(rest, ctx, run);
    case "pending":
      return handlers.pending(rest, ctx, run);
    case "enable":
      return handlers.enable(rest, ctx, run);
    case "disable":
      return handlers.disable(rest, ctx, run);
    case "import":
      return handlers.import(rest, ctx, run);
    case "marketplace":
      return routeMarketplace(rest, handlers, ctx, run);
```

Reuse `peelToken` at lines 145-156 and the existing dispatch decisions; avoid a second independently maintained command parser. Canonicalize once: `ls` → `plugin list`, marketplace `rm` → `marketplace remove`, marketplace `ls` → `marketplace list`; bare input → `plugin browse`; invalid verbs → recognized parent; both help spellings → `marketplace help`. These are approved decisions, not questions. Keep passing the same run into nested handlers.

**Nested error boundary analog:** `extensions/pi-claude-marketplace/index.ts`, lines 106-112:

```typescript
    } catch (err) {
      try {
        notifyReconcileAborted(ctx, run, err);
      } catch (notifyErr) {
        hookDebugLog(`reconcile-abort notify failed: ${errorMessage(notifyErr)}`, "env");
      }
    }
```

Use the nested primary-operation / secondary-delivery boundary structure. Do not copy its raw debug interpolation into the new redacted command-error path. This load boundary is not a complete implementation of D-08: command recovery also needs one-attempt accounting, terminal suppression, and containment if debug logging throws.

Explicit non-command allocation seams are `extensions/pi-claude-marketplace/index.ts:88-89` (load), `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:154-158` (hook), and `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:440-446` (hook). Rewake excerpt:

```typescript
  if (entry.rewakeSummary !== undefined) {
    try {
      const run = openNotificationRun(pi);
      notifyAsyncRewakeSummary(ctx, run, entry.rewakeSummary);
    } catch (err) {
      hookDebugLog(`async-rewake: notify failed (${entry.pluginId}): ${errorMessage(err)}`);
    }
  }
```

Preserve each callback's existing containment. Load and hook emissions must never borrow an overlapping command's identity or satisfy its outcome requirement.

### C. Discriminated wire schema and format-only JSON

**Apply to:** wire schema, JSON formatter, generated schema, and their paired tests.

**Analog:** `extensions/pi-claude-marketplace/shared/notification-wire.ts`, lines 264-285:

```typescript
const ENVELOPE_FIELDS = {
  schemaVersion: Type.Literal(1),
  severity: SEVERITY,
  needsReload: Type.Boolean(),
  summary: Type.Optional(Type.String()),
};

/**
 * D-04: a cascade. `marketplaces: []` is the empty cascade. Exported for the
 * JSON strategy's cascade overload, which reads its static type.
 */
export const CASCADE_PAYLOAD_SCHEMA = Type.Object(
  {
    ...ENVELOPE_FIELDS,
    kind: Type.Literal("cascade"),
    tally: Type.Optional(TALLY),
    noOp: Type.Optional(Type.Literal(true)),
    marketplaces: Type.Array(MARKETPLACE_BLOCK),
    advisories: Type.Optional(Type.Array(Type.String())),
    retainedWorkflows: Type.Optional(Type.Array(RETAINED_WORKFLOW)),
  },
  { additionalProperties: false },
);
```

The raw envelope is separately defined at lines 479-483; both envelope paths need required metadata. The union at lines 562-581 enrolls every `kind`. Copy strict `Type.Object` and `Type.Union` composition for origin discrimination: command requires identity/correlation; load/hook omit command-only fields. Merely adding optional command fields to all origins does not enforce the contract. Exact nesting remains planner discretion.

Cause schema, same file, lines 185-189:

```typescript
/** D-11: one serialized `Error.cause` chain, head first. */
const CAUSE = Type.Object(
  { causeChain: Type.Array(Type.String()), truncated: Type.Boolean() },
  { additionalProperties: false },
);
```

**Formatter analog:** `extensions/pi-claude-marketplace/shared/notification-json.ts`, lines 124-131:

```typescript
    case "prune-committed-warning":
      return {
        schemaVersion: 1,
        kind: "prune-committed-warning",
        ...wireEnvelope(presentation.envelope),
        scope: presentation.scope,
        ...(presentation.cause === undefined ? {} : { cause: wireCause(presentation.cause) }),
      };
```

Copy explicit field projection and absent-optional-field handling. The formatter imports schema values through `import type` at lines 23-25 and returns `Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA>` at lines 49-55. Keep runtime validation in tests. Pass resolved metadata and error facts to formatting; do not mint IDs, serialize live errors, decide completion, or mutate run state there.

The current raw envelope hardcodes `needsReload: false` at lines 144-148. Do not use that constant for an internal error after reload-requiring output; resolve its reload value from command state first.

**Generated artifact analog:** `scripts/generate-wire-schema.mjs`, lines 19-24:

```javascript
async function main() {
  const schemaPath = path.join(projectRoot, WIRE_SCHEMA_PATH);
  const text = await formatWireSchemaDocument(buildWireSchemaDocument());
  mkdirSync(path.dirname(schemaPath), { recursive: true });
  writeFileSync(schemaPath, text, "utf8");
  process.stdout.write(`Wrote ${WIRE_SCHEMA_PATH}\n`);
```

The executor regenerates `schema/claude-plugin.schema.json` with the existing `npm run schema:generate`; do not hand-edit it or change the generator without a concrete need. Its CLI output is not a runtime notification pattern.

### D. Resolve causes before delivery; recover at the delivery boundary

**Apply to:** resolve, dispatch, and conditional input/presentation enrollment.

**Serializer analog:** `extensions/pi-claude-marketplace/shared/errors.ts`, lines 170-182:

```typescript
export function serializeCauseChain(err: unknown): SerializedCauseChain | undefined {
  if (err === undefined || err === null) {
    return undefined;
  }

  // The walk stops either because the chain ended or because it hit the depth
  // bound. Only the second case leaves the LAST yielded link still carrying an
  // onward cause, which is exactly the truncation condition.
  const links = [...causeChain(err)];
  return {
    causeChain: links.map((link) => redactCredentials(linkMessage(link))),
    truncated: hasOnwardCause(links.at(-1)),
  };
}
```

Reuse this serializer unchanged where possible. Its bound is `CAUSE_CHAIN_MAX_DEPTH = 5` at line 43. Nullish thrown values need a deliberate resolved fallback because the serializer returns no chain; do not JSON-stringify arbitrary thrown objects or expose stacks.

**Resolution analog:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts`, lines 521-535:

```typescript
function resolveFailure(
  cause: Error | undefined,
  rollbackPartial: NonNullable<PluginFailedMessage["rollbackPartial"]>,
): ResolvedFailure {
  const chain = serializeCauseChain(cause);
  return {
    ...(chain === undefined ? {} : { cause: chain }),
    leaks: manualRecoveryLeaks(cause).map((leak) => redactCredentials(leak)),
    rollbackPartial: rollbackPartial.map((entry) => {
      const phaseChain = serializeCauseChain(entry.cause);
      return phaseChain === undefined
        ? { phase: entry.phase }
        : { phase: entry.phase, cause: phaseChain };
    }),
  };
}
```

Copy the upstream serialization boundary, not rollback-specific fields into the new error. The same file's `resolveRawSurface` at lines 598-627 demonstrates a discriminated input converted to redacted plain output. Keep internal resolved types independent of TypeBox. Put the new input/resolved member in the existing model that actually consumes it; do not enroll unused transitional exports in both raw and structured models.

**Delivery analog:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`, lines 383-405, selects from `requireNotificationMode(ctx.mode)` on every emission. Its machine branch is:

```typescript
    case "json":
    case "rpc":
      run.entrySink.appendEntry("claude-plugin", toWirePayload(presentation));
      return;
```

Keep append ownership here. Track explicit outcome separately from entry count and severity. Track reload truth monotonically; preserve earlier entries. An append failure permits one internal-error attempt, followed by terminal suppression if that fails. A handler's broad catch must not create another retry loop. Neither retries of business work nor rollback nor an alternate user sink belongs in recovery.

**Debug analog:** `extensions/pi-claude-marketplace/shared/debug-log.ts`, lines 22-26:

```typescript
export function hookDebugLog(detail: string, tag = "hooks"): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    console.error(`[${tag}] ${detail}`);
  }
}
```

Use already-redacted detail. This function does not contain a throwing console; terminal recovery must not assume it is infallible.

### E. Paired tests, run seeds, and JSON capture

**Apply to:** every test/support target in the classification table. Existing owner tests remain the home of each source module's direct behavior. Cross-owner examples below provide test mechanics, not a reason to move coverage into another module's suite.

**Imports and organization analog:** `tests/shared/notification-run.test.ts`, lines 1-10:

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { UnsupportedModeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  openNotificationRun,
  requireNotificationMode,
} from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
```

Lines 20-38 use arrange/act/assert, exact mock expectations, and `verify(pi)` to assert inventory reads. Copy this structure for one generator call per command and independent fresh runs; inject fixed IDs rather than normalizing random fields out of captures.

**Seed analog:** `tests/shared/notification-run-seeds.ts`, lines 4-13:

```typescript
/** Returns a fresh notification run whose snapshot is `softDeps`. */
export function runWithSoftDeps(softDeps: SoftDepStatus): NotificationRun {
  return {
    softDeps: { ...softDeps },
    entrySink: {
      appendEntry(): never {
        throw new Error("A text-only notification run cannot append entries");
      },
    },
  };
}
```

Keep each fixture's mutable accounting fresh. Propagate required metadata through these seeds first, then direct literals/captures found by typechecking. Do not share a mutable default run across tests or accidentally make old text fixtures machine-capable.

**Capture analog:** `tests/edge/json-capture.ts`, lines 29-47:

```typescript
      appendEntry(customType: string, payload: unknown): void {
        entries.push({ customType, payload });
        try {
          assert.strictEqual(customType, "claude-plugin");
          assertJsonValue(payload);
          assert.ok(PAYLOAD_VALIDATOR.Check(JSON.parse(JSON.stringify(payload))));
        } catch (error: unknown) {
          failures.push(error);
          throw error;
        }
      },
    },
    get ui(): NotificationUi {
      const error = new Error("Machine output must not access the notification UI");
      failures.push(error);
      throw error;
    },
    assertValid(): void {
      assert.deepStrictEqual(failures, []);
```

The ledger retains attempted entries and validation failures even when production catches the thrown append exception. Always call `capture.assertValid()` in ordinary success captures. For deliberate sink faults use a separate controlled failing sink so fault injection is not confused with malformed payloads. Preserve the JSON-value check and UI getter trap; do not weaken capture validation to accommodate new recovery behavior.

**Machine-mode test analog:** `tests/shared/notification-dispatch.test.ts`, lines 59-74:

```typescript
for (const mode of ["json", "rpc"]) {
  test(`appends complete usage payloads in ${mode} without UI access`, () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode,
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

    // act
    notifyUsageError(ctx, run, { message: "Invalid input.", usage: "Usage: command" });
    notifyUsageInfo(ctx, run, "Usage: command");
```

Lines 76-99 assert exact complete payloads and capture validity. Lines 103-178 test ordered duplicate entries, original sink identity, frozen inventory, and changing live modes. Extend exact payload expectations with origin/correlation; do not replace them with broad shape assertions.

**Registered callback analog:** `tests/edge/register.test.ts`, lines 442-447:

```typescript
    // act
    try {
      await Reflect.apply(registration.handler, undefined, ["list --scope project", ctx]);
    } catch {
      // The retained capture ledger below must expose caught delivery failures.
    }
```

Use the real registered callback and await it before inspecting complete captures. That existing catch is suitable for its capture-ledger test; new completion/containment tests must explicitly assert their expected settlement and not silently swallow unexpected rejection. Keep synchronous refusal assertions at lines 468-522 intact.

Recommended owner allocation:

- Run owner: deterministic IDs, one allocation, independent simultaneous runs, explicit origin discrimination.
- Router owner: all approved canonical identities, invalid-parent identities, both help spellings, delegation retains the outer identity.
- Register owner: deferred handler ordering, throw before/after output, missing outcome, no emission after promise settlement, unchanged text errors.
- Dispatch owner: live mode, prior reload preservation, one failing append then successful error delivery, twice-failing sink, no later emission or recursive fallback.
- Resolve owner: credential-redacted bounded cause chains, nullish/non-Error throws, no live Error or stack in resolved data.
- Wire/JSON owners: strict origin branches across every kind, missing required metadata rejected, command fields rejected on load/hook branches, valid empty outcomes, generated-schema agreement.
- Load/hook owners: explicit origins, overlap with command activity, existing callback containment.

## Shared Patterns

### Imports, validation, and guards

Use relative `.ts` imports and separate type imports, as in assignments A, C, and E. Production consumes the wire schema as types; capture compiles it for validation. There is no new authentication or authorization mechanism. The relevant guard is `requireNotificationMode` in `extensions/pi-claude-marketplace/shared/notification-run.ts:13-18`, accepting only exact `tui`, `print`, `json`, and `rpc` values and throwing otherwise.

### Outcome classification

Use the existing discriminated-kind switches in `extensions/pi-claude-marketplace/shared/notification-json.ts:58-171` and closed enrollment pattern in `extensions/pi-claude-marketplace/shared/notification-wire.ts:143-159` as the model for an exhaustive classifier with a real reader.

| Existing kinds | Command completion treatment |
|---|---|
| `cascade`, `marketplace-info`, `plugin-info`, `marketplace-info-cascade`, `plugin-info-cascade`, `marketplace-not-added` | Explicit outcomes when emitted by a command run |
| `reconcile-pending-empty`, `prune-empty`, `prune-committed-warning` | Explicit outcomes, including legitimate empty and committed-warning results |
| `usage-error`, `usage-info` | Explicit responses |
| `diagnostic`, `device-flow-prompt` | Non-outcomes; alone cannot satisfy normal command completion |
| `reconcile-applied-cascade`, `reconcile-aborted`, `plugin-path-skipped` | Load surfaces; cannot satisfy command completion |
| `async-rewake-summary`, `stop-override-cap` | Hook surfaces; cannot satisfy command completion |

`internal-error` is new terminal failure output. Do not fabricate generic success on return. Empty cascade arrays are valid; keep schema constraints on other result kinds intact.

### Preservation and verification ownership

Text formatting and argument counts remain unchanged. Machine delivery uses the original run sink and reads live mode per emission. Error resolution precedes both formatters. No new database, transaction, migration, network, or authentication pattern applies.

The executor must read the applicable TypeScript and unit-test skills before edits. The local-verification policy keeps owner-suite feedback separate from the required combined-tree `npm run check` gates. This mapping pass ran no tests, generator, formatter, or commit; it claims no passing implementation checks.

## No Analog Found

| Behavior / likely owner | Role | Data Flow | Gap |
|---|---|---|---|
| Command-only outcome/reload/terminal accounting in `extensions/pi-claude-marketplace/shared/notification-run.ts` and `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` | model / service | request-response / event-driven | Existing run stores snapshot and sink only; existing dispatcher directly appends |
| Awaited machine-error finalization in `extensions/pi-claude-marketplace/edge/register.ts` | controller | request-response | Current callback returns routing directly; load catch is only a structural analog |
| Origin-discriminated metadata and `internal-error` in `extensions/pi-claude-marketplace/shared/notification-wire.ts` | model | transform | Existing discrimination is by payload kind, not origin |

Use approved context and research for these semantics. In particular, focus implementation inspection on handler catches that could swallow delivery faults and returned promises that might omit detached work. This bounded map does not prove every handler's timing or catch behavior. Do not reopen approved identities or D-08's accepted delivery limit.

## Metadata

**Search scope:** notification shared modules, command registration/router, load and hook roots, owner test/support files, and schema generation.
**Search method:** CodeGraph first (two bounded queries), followed by targeted line-numbered reads and tracked-path checks.
**Strong pattern groups:** 5; additional paths are integration owners or supporting excerpts, not an exhaustive analog search.
**Candidate coverage:** 16 exact, 12 role-match, 3 partial; 0 candidate files without a reuse pattern. New behavior gaps are listed separately above.
**Limitations:** Owner test bodies beyond the quoted run/register/dispatch/capture support were not exhaustively inspected. Candidate fixture propagation is conditional and must follow actual compiler/caller evidence.
**Pattern extraction date:** 2026-10-09.
