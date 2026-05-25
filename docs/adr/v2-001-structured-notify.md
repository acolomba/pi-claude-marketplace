# ADR-v2-001: Structured `notify` payload with typed wrappers

- **Status:** Proposed (v2 target)
- **Date:** 2026-05-25
- **Supersedes:** D-CMC-11 (no structured-payload arg)

## Context

V1 ships a stringly-typed user-output surface: `notifySuccess/Warning/Error(ctx, message: string)` accepts a fully-assembled compact-line string. Every call site independently makes two choices that must stay consistent:

1. **Severity wrapper** (`notifySuccess` vs `notifyWarning` vs `notifyError`)
2. **Message body** (icon glyph + status token + scope bracket + grammar slots + reasons)

These two choices are coupled by `docs/messaging-style-guide.md` -- e.g. a SUCCESS-class status token like `(installed)` MUST flow through `notifySuccess`, never `notifyWarning`. The coupling is enforced by **34 custom ESLint rules** under `tests/lint-rules/` (MSG-SR-1..7 severity routing, MSG-IC-1..3 icon discipline, MSG-GR-1..5 grammar, MSG-PL-1..6 plugin-row conventions, MSG-CC-1 cause-chain, MSG-MR-1..2 manual-recovery, MSG-RP-1 rollback-partial, MSG-RH-1 reload-hint, MSG-SD-1..3 soft-dep, MSG-NC-1..2 entity-error/usage, MSG-ER-1 empty-token, MSG-LC-1..2 console discipline) plus the 4-way registry parity test plus the byte-equality catalog UAT runner. The presentation layer (`presentation/compact-line.ts:247`) already carries a discriminated `RowSpec` union with 9 variants -- but it produces `string` and hands it to the caller, who then picks the wrapper.

This works but accrues cost: every new notify surface needs a new lint glob; the typed `PluginShapeError` refactor (quick task 260525-aub) had to thread typed dispatch separately from message routing; the recent code review surfaced two known MSG-GR-3 drift sites outside the lint glob (`shared/types.ts:20`, `edge/completions/provider.ts:70`); and the lint rules themselves require RuleTester suites -- the linter has become a parallel codebase. The 34 custom rules + 34 RuleTester suites exist *because* the API is unstructured; they would not exist if grammar were enforced by types.

## Decision

Introduce a single structured implementation seam fronted by typed `notify*` wrappers.

### Public surface

One typed wrapper per outcome variant, all in the existing `notify*` namespace. Past-participle naming matches the status-token vocabulary ("tell the user that X happened"):

```ts
export function notifyPluginInstalled(ctx, args: PluginInstalledArgs): void;
export function notifyPluginUpdated(ctx, args: PluginUpdatedArgs): void;
export function notifyPluginFailed(ctx, args: PluginFailedArgs): void;
export function notifyMarketplaceAdded(ctx, args: MarketplaceAddedArgs): void;
export function notifyCascade(ctx, args: CascadeArgs): void;
export function notifyManualRecovery(ctx, args: ManualRecoveryArgs): void;
export function notifyRollbackPartial(ctx, args: RollbackPartialArgs): void;
export function notifyUsageError(ctx, args: UsageErrorArgs): void;
// ...one per kind
```

Each wrapper is two lines with zero formatting logic -- it tags the payload and delegates:

```ts
export function notifyPluginInstalled(ctx, args: PluginInstalledArgs): void {
  notify(ctx, { kind: "plugin-installed", ...args });
}
```

### Implementation seam

One private entrypoint where all formatting and severity routing live:

```ts
function notify(ctx: ExtensionContext, payload: NotifyPayload): void {
  switch (payload.kind) {
    case "plugin-installed":
      ctx.ui.notify(`${ICON_INSTALLED} ${payload.subject.name} [${payload.scope}] (installed)${reasonsBlock(payload.reasons)}`);
      return;
    case "plugin-updated":
      ctx.ui.notify(`${ICON_INSTALLED} ${payload.subject.name} [${payload.scope}] v${payload.from} → v${payload.to} (updated)`);
      return;
    case "plugin-failed":
      ctx.ui.notify(/* ... */, "error");
      return;
    // ...
    default:
      assertNever(payload);
  }
}
```

The switch is the *only* place that knows the grammar. `assertNever(payload)` makes "added a variant without a case arm" a compile error.

`notify()` is not exported. Tests exercise the wrappers and observe `ctx.ui.notify` via a mock `ctx` (matches V1's existing notification-recording test pattern).

### `NotifyPayload`

`NotifyPayload` is a discriminated union mirroring `presentation/compact-line.ts:RowSpec`, augmented with the data needed for trailers (cause chain, manual-recovery anchor, usage block):

```ts
type NotifyPayload =
  | { kind: "plugin-installed"; subject: PluginSubject; scope: Scope; reasons?: readonly Reason[] }
  | { kind: "plugin-updated"; subject: PluginSubject; scope: Scope; from: Version; to: Version }
  | { kind: "plugin-failed"; subject: PluginSubject; scope: Scope; reasons: readonly Reason[]; cause?: unknown }
  | { kind: "marketplace-added"; subject: MarketplaceSubject; scope: Scope }
  | { kind: "cascade"; outcome: CascadeOutcome; header: CascadeHeader; rows: readonly RowSpec[] }
  | { kind: "manual-recovery"; subject: PluginSubject; reason: Reason; cause?: unknown }
  | { kind: "rollback-partial"; subject: PluginSubject; phases: readonly RollbackPhase[]; cause?: unknown }
  | { kind: "usage-error"; message: string; usage: UsageBlock }
  // ...
```

`Scope`, `Reason`, `StatusToken`, `PluginSubject`, `MarketplaceSubject` carry over from V1. `UsageBlock` remains free-form Markdown -- it is not customer-grammar-bound and does not warrant a closed shape.

## Consequences

### Removed at compile time

No test or lint needed for any of:

- Severity routing -- wrapper choice derives from `kind`
- Icon glyph -- derives from `kind`
- Status token literal -- embedded in the switch arm
- Grammar slot order, scope brackets, scope ordering -- payload shape *is* the grammar
- Closed sets (status-tokens, reasons, markers) -- encoded in field types
- Soft-dep markers, reload-hint trailer, cause-chain trailer -- appended structurally inside `notify()`, not by caller

### Custom ESLint plugin deleted entirely

`tests/lint-rules/` (~4096 lines: 34 rules + 34 RuleTester suites + registry + helpers) is removed. The two surviving call-site policies are stock ESLint config:

```js
// eslint.config.js
"no-restricted-syntax": ["error", {
  selector: "CallExpression[callee.object.property.name='ui'][callee.property.name='notify']",
  message: "Call ctx.ui.notify only from shared/notify.ts; use a notify* wrapper.",
}],
"no-console": ["error", { allow: [] }], // overridden per-file in persistence/migrate.ts (IL-3)
```

`tests/architecture/msg-rule-registry.test.ts` is also deleted (no plugin to parity-check).

### Coverage moves to wrapper tests + the existing catalog UAT

Each wrapper gets a small unit test that calls it with a mock `ctx` and asserts on the string passed to `ctx.ui.notify`. The catalog UAT runner (`tests/architecture/catalog-uat.test.ts`) keeps its byte-equality role unchanged but is now fed by calling the typed wrappers with structured fixtures, instead of being handed pre-assembled strings. `docs/output-catalog.md` is the same human-readable user contract.

### Other consequences

- `messaging-style-guide.md` becomes the binding spec for the discriminated union (frontmatter still drives drift tests for status-tokens / reasons / markers / pattern-classes -- these are still closed sets, just embedded in the type)
- `presentation/` composers become module-internal helpers of `notify()`'s switch; the public surface shrinks to the `notify*` wrapper set
- Typed errors (`PluginShapeError`, the v1.3 outcome from quick task 260525-aub) integrate cleanly: `cause?: unknown` on failed/manual-recovery variants accepts the typed error directly, no message pre-formatting
- IDE autocomplete on `notify*` reveals the full outcome menu -- discoverability matches V1
- Per-wrapper JSDoc documents each outcome's user-visible contract independently
- Greppability preserved (each wrapper is a distinct symbol)

### Costs

- Migrating ~23 call sites (one per existing `notify*` invocation) -- mechanical but touches every orchestrator
- ~15-20 wrapper functions to write (each 2 lines, zero logic)
- Loss of "grep for the literal string" debugging affordance -- but structured fields are *more* greppable, just differently
- One-time deletion of `tests/lint-rules/` + `eslint.config.js` cleanup

### Net code delta

≈ +400 LoC (wrappers + notify switch + payload types) - ≈ 4500 LoC (deleted lint plugin + RuleTester suites) - ≈ 200 LoC (deleted registry parity test) = **~4300 LoC net removed**.

## Alternatives considered

1. **Keep V1 unchanged.** Cost is the 34 ESLint rules and the ongoing risk of drift sites outside lint globs. Diminishing returns as the surface grows.

2. **Single `notify(ctx, payload)` only, no typed wrappers.** Loses per-call-site autocomplete and adds `kind:` literal ceremony at every site. Rejected for ergonomics.

3. **Typed wrappers only, no shared `notify()` seam.** Each wrapper independently picks severity, formats the string, and calls `ctx.ui.notify`. Moves the drift surface from "string contents" to "what each wrapper renders" -- we'd be right back to needing lint rules to check that `notifyPluginUpdated` actually writes `(updated)` and not `(installed)`. The single switch + `assertNever` exhaustiveness gate is the whole point. Rejected.

4. **Expose `render(payload): string` as a separate pure function.** Tempting because it gives tests a side-effect-free entrypoint. Rejected because it adds a public symbol that callers can misuse (passing a payload through `render` then through their own `ctx.ui.notify` reintroduces every drift class the wrapper architecture removed), and the mock-`ctx` test pattern is already idiomatic in V1.

5. **Structured payload with a fallback string escape hatch** (`notify(ctx, payload | string)`). Reintroduces the drift problems wherever `string` is chosen. Rejected.

6. **Codegen the wrappers from `messaging-style-guide.md`'s YAML.** Moves the binding contract from spec→code into spec→codegen→code; adds a build step. Reject unless the union becomes unwieldy.

## Migration

Single-PR migration is feasible but risky given the lint-rule unwinding. Recommended phased rollout:

- **Phase v2.0:** introduce `notify(ctx, payload)` + typed `notify*` wrappers alongside V1 wrappers. Match V1 byte-equality. No call sites change. CI green.
- **Phase v2.1:** migrate one orchestrator family (e.g. `marketplace/*`) end-to-end; retire the corresponding MSG-\* rules' `files:` globs for that surface. Catalog UAT proves byte-equality is preserved.
- **Phase v2.2..v2.N:** repeat per orchestrator family.
- **Phase v2.final:** delete V1 wrappers (`notifySuccess/Warning/Error/UsageError`), delete `tests/lint-rules/` and `tests/architecture/msg-rule-registry.test.ts`, swap `eslint.config.js` MSG plugin wiring for stock `no-restricted-syntax` + `no-console` config.

## Open questions

- Cascade summary headers vs. rows -- is one payload variant per cascade-class enough, or do we need a richer "section" abstraction for surfaces like `plugin list` that nest plugin rows under marketplace headers?
- Should `notify()` validate `Scope` / `Reason` / `StatusToken` at runtime in addition to the compile-time check, or trust the type system end-to-end?
