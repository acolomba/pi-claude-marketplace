# Phase 16: Renderer & Public API (Alongside V1) - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 3 source/test additions + 2 editorial (REQUIREMENTS.md, ADR)
**Analogs found:** 5/5 (all 5 in-scope files have direct analogs already in the codebase)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/shared/notify.ts` (ADDITIONS: `notify`, `notifyUsageError`, `renderMpHeader`, `renderPluginRow`) | shared (sanctioned notify boundary) | request-response (synchronous transform → `ctx.ui.notify`) | Same file (V1 wrappers at lines 56-106) + `presentation/compact-line.ts::renderRow` (switch/assertNever) + `presentation/cascade-summary.ts::cascadeSummary` (marketplace-header + 2-space-indented rows) | exact (in-file analogs) + role-match (cross-file analogs) |
| `tests/shared/notify-v2.test.ts` (NEW) | test (unit) | request-response (mock-ctx, mock-pi, string-equality assertions) | `tests/shared/notify.test.ts` (V1 wrapper test file) | exact |
| `.planning/REQUIREMENTS.md` (editorial: SNM-12 signature + SNM-15 wording) | requirements doc | n/a | Same file, neighboring SNM-* rows | exact |
| `docs/adr/v2-001-structured-notify.md` (editorial: Decision-snippet alignment if applicable) | ADR doc | n/a | Same file's Decision section (Phase 15 refresh) | exact |

All four `renderMpHeader` / `renderPluginRow` / `notify` / `notifyUsageError` additions live inside the existing `shared/notify.ts` module. The "closest analog" for the additions splits in two:

1. **In-file analog (severity-arg shape, IL-2 sole-sanctioned-site discipline, blank-line discipline):** the V1 `notifySuccess` / `notifyWarning` / `notifyError` / `notifyUsageError` wrappers at `shared/notify.ts:56-106`.
2. **Cross-file analog (discriminated-union switch + `assertNever`, icon constants, marketplace-header + indented-rows composition, soft-dep probe injection):** `presentation/compact-line.ts::renderRow` (switch idiom) and `presentation/cascade-summary.ts::cascadeSummary` (header + 2-space-indented body).

The grammar duplication mandated by D-16-04 / D-16-09 / D-16-12 / D-16-15 means Phase 16 **reads** the cross-file analogs to copy the byte-level token shapes but **does not import** from `presentation/*` -- every literal (icon glyphs, reload-hint trailer, soft-dep markers) is duplicated inline inside `shared/notify.ts` and lives there until Phase 21 deletes both `presentation/*` and the duplicates simultaneously.

---

## Pattern Assignments

### `extensions/pi-claude-marketplace/shared/notify.ts` ADDITIONS

**Role:** shared (the sole sanctioned `ctx.ui.notify` call site per D-07 / IL-2). Module-internal helpers (`renderMpHeader` / `renderPluginRow`) are file-private string composers; the public surface adds `notify()` and `notifyUsageError(ctx, UsageErrorMessage)`.

**Data flow:** synchronous request-response. `notify()` receives a `NotificationMessage` plus `pi: ExtensionAPI`, calls `softDepStatus(pi)` once, iterates `msg.marketplaces[]` and each `mp.plugins[]` (caller order), composes a single body string, computes severity + reload-hint, and emits via `ctx.ui.notify(body, severity?)`. No async, no I/O beyond the Pi-API probe and the notify emit.

**Analog #1 (in-file): V1 wrappers -- severity-arg shape, IL-2 discipline, blank-line composition**

File: `extensions/pi-claude-marketplace/shared/notify.ts`

Mirror these for the severity argument shape passed to `ctx.ui.notify`. The new `notify()` reuses the EXACT same `(message, severity?)` Pi-API surface; severity is computed from the payload but emitted identically (omit 2nd arg → info; `"warning"` / `"error"` magic strings → warning / error).

```typescript
// shared/notify.ts:56-65 -- info severity = omit 2nd arg
/** Default-severity notify -- success path. */
export function notifySuccess(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message);
}

/** Warning notify -- used for cleanup leaks, partial failures, soft-dep warnings. */
export function notifyWarning(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message, "warning");
}
```

```typescript
// shared/notify.ts:85-106 -- error severity + cause-chain trailer + UsageError pattern
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const trailer = cause === undefined ? "" : causeChainTrailer(cause);
  const body = trailer === "" ? message : `${message}\n\n${trailer}`;
  ctx.ui.notify(body, "error");
}

export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void {
  ctx.ui.notify(`${message}\n\n${usageBlock}`, "error");
}
```

**What to copy verbatim:**
- The `(message, severity?)` Pi-API magic-string surface (`"warning"` / `"error"`; omit for info).
- The `${body}\n\n${trailer}` blank-line discipline (re-used for both per-plugin cause-chains and the reload-hint append).
- The IL-2 / D-07 "this is the only sanctioned `ctx.ui.notify` call site" discipline -- the V2 additions inherit the per-file ESLint override at `eslint.config.js` automatically because they live in the same module.

**What the V2 entry point adds on top of V1:**
- `notify()` ALSO accepts `pi: ExtensionAPI` (D-16-01 amends SNM-12's 2-arg literal wording) so it can run `softDepStatus(pi)` internally.
- `notify()` ALSO emits the reload-hint trailer at the body level (V1 had every caller append it manually via `presentation/reload-hint.ts::appendReloadHint`).
- `notifyUsageError(ctx, UsageErrorMessage)` takes a STRUCTURED 2-arg payload (`{message, usage}`) instead of V1's 3-arg `(ctx, msg, usage)` form. The on-the-wire string remains `${message}\n\n${usage}` byte-equal to V1's line 105.

---

**Analog #2 (cross-file): `presentation/compact-line.ts::renderRow` -- discriminated-union switch + `assertNever`**

File: `extensions/pi-claude-marketplace/presentation/compact-line.ts`

The `renderRow(row, probe)` top-level switch is the canonical idiom for the two file-private helpers Phase 16 ships (`renderMpHeader` switches on `mp.status` over 4 + undefined values; `renderPluginRow` switches on `p.status` over 10 values). Same `assertNever` import from `shared/errors.ts`; same per-variant render delegation pattern.

```typescript
// presentation/compact-line.ts:56  -- assertNever import (shared/ -> shared/, D-11-safe)
import { assertNever } from "../shared/errors.ts";

// presentation/compact-line.ts:270-293 -- the switch + assertNever idiom
export function renderRow(row: RowSpec, probe: SoftDepProbe): string {
  switch (row.kind) {
    case "plugin-inline":
      return renderPluginInline(row, probe);
    case "plugin-inline-uninstalled":
      return renderPluginInlineUninstalled(row);
    case "plugin-cascade":
      return renderPluginCascade(row, probe);
    case "plugin-list":
      return renderPluginList(row, probe);
    case "marketplace":
      return renderMarketplace(row);
    case "empty":
      return renderEmpty(row);
    case "manual-recovery":
      return renderManualRecovery(row);
    case "rollback-child":
      return renderRollbackChild(row);
    case "entity-error":
      return renderEntityError(row);
    default:
      return assertNever(row);
  }
}
```

**What to copy:**
- Top-level `switch (discriminant)` over closed literal union → per-variant file-private renderer.
- `default: return assertNever(<discriminant>);` for compile-time exhaustiveness (D-16-10).
- Pure-transform shape: no I/O, no side effects inside the switch.

**Two switches, not one:** Phase 16 uses TWO separate switches (one per discriminant -- `mp.status` and `p.status`) instead of one combined switch, because `renderMpHeader` consumes a `MarketplaceNotificationMessage` and `renderPluginRow` consumes a `PluginNotificationMessage`. Each owns its own `assertNever` default. (D-16-09.)

**Discriminant note:** `MarketplaceNotificationMessage.status?` is OPTIONAL (the list-surface case sets `details?` instead -- D-15-06). `renderMpHeader`'s switch therefore handles `"added" | "removed" | "updated" | "failed" | undefined` -- 5 arms total, not 4. The `undefined` arm consumes `mp.details` for the list-surface form (autoupdate marker + optional lastUpdatedAt). Use `assertNever(mp.status)` after handling all 5 explicit cases -- `mp.status` is `MarketplaceStatus | undefined` so the type narrows to `never` once `undefined` and all 4 literal members are exhausted.

**`renderPluginRow` switches on the full `PluginNotificationMessage` (not just `p.status`)** so the per-variant narrowing inside the switch gives free access to variant-specific fields (`from` / `to` only on `updated`, `cause?` only on `failed` / `manual recovery`, `dependencies` only on `installed` / `updated` / `reinstalled`, `rollbackPartial?` only on `failed`, `reasons` only on the 5 status-with-reasons variants). Use `default: return assertNever(p);` -- `p` narrows to `never` when all 10 cases are matched. (See `tests/architecture/notify-types.test.ts` for the per-variant `_VInstalled` / `_VUpdated` / ... aliases that prove the per-variant invariants; Phase 16's switch effectively re-derives those structures at runtime.)

---

**Analog #3 (cross-file): `presentation/cascade-summary.ts::cascadeSummary` -- marketplace-header + 2-space-indented plugin rows**

File: `extensions/pi-claude-marketplace/presentation/cascade-summary.ts`

This is the closest analog to Phase 16's body-composition strategy. V1's `cascadeSummary` composes the body as `[header, ...rows.map(r => "  " + renderRow(r))].join("\n")` where the leading marketplace header row provides the marketplace context and the 2-space-indented child rows are the per-plugin lines. Phase 16's `notify()` does the SAME thing -- marketplace header line + 2-space-indented plugin rows under each marketplace.

```typescript
// presentation/cascade-summary.ts:77-88 -- header + 2-space-indented rows + severity dispatch
export function cascadeSummary(input: CascadeSummaryInput): CascadeSummaryOutput {
  const lines: string[] = [renderRow(input.marketplace, input.probe)];
  const sorted = [...input.rows].sort(compareByNameThenScope);
  for (const r of sorted) {
    lines.push(`  ${renderRow(r, input.probe)}`);
  }

  return {
    message: lines.join("\n"),
    severity: cascadeSeverity(input.rows),
  };
}
```

```typescript
// presentation/cascade-summary.ts:55-67 -- severity computed from row contents
export function cascadeSeverity(rows: readonly PluginCascadeRow[]): CascadeSeverity {
  for (const r of rows) {
    if (r.status === "failed" || r.status === "rollback failed" || r.status === "unavailable") {
      return "warning";
    }

    if (r.status === "skipped" && !isTrivialUpToDate(r)) {
      return "warning";
    }
  }

  return "success";
}
```

**What to copy:**
- The `lines: string[]` accumulator pattern; `join("\n")` at the end.
- The 2-space indent prefix (`  ${...}`) on each per-plugin row (matches Phase 16's D-16-04 grammar).
- The "compute severity from row contents" idea -- Phase 16 extends it to the FULL D-16-11 ladder (failed → error; skipped/manual-recovery → warning; else success).

**Three deviations from `cascadeSummary` Phase 16 needs:**

1. **No internal sort.** V1's `cascadeSummary` sorts rows via `compareByNameThenScope` before rendering. Phase 16 does NOT sort (D-16-06: caller-supplied order). Iterate `mp.plugins` in the order provided.

2. **Multi-marketplace loop above this composition.** `cascadeSummary` composes ONE marketplace; Phase 16 iterates `msg.marketplaces[]` and joins blocks with `\n\n` between marketplaces (D-16-07: one blank line between marketplace blocks).

3. **Severity ladder extends to `error`.** `cascadeSummary` returns `"success" | "warning"` only (MSG-SR-6 forbids `notifyError` on cascade summaries). Phase 16's `notify()` DOES emit `"error"` when any `status === "failed"` is present (D-16-11). This is a deliberate V2 surface change -- severity routing replaces the at-a-glance summary.

---

**Analog #4 (in-file): icon constants, reasons-block composition, scope-bracket carve-out -- all DUPLICATED inline**

File: `extensions/pi-claude-marketplace/presentation/compact-line.ts` (READ-ONLY reference; Phase 16 duplicates the literals into `shared/notify.ts`).

Per D-16-04 / D-16-09 / D-16-15, Phase 16 duplicates these constants inside `shared/notify.ts` rather than importing from `presentation/*`. The duplication is intentional and ends when Phase 21 deletes both `presentation/*` and the duplicates simultaneously.

```typescript
// presentation/compact-line.ts:65-67 -- icon constants to DUPLICATE into shared/notify.ts
const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";
```

```typescript
// presentation/compact-line.ts:387-426 -- icon dispatch table for plugin rows (MSG-IC-1..3)
function iconForPluginRow(status: StatusToken, trivialSkip: boolean): string {
  switch (status) {
    case "installed":
    case "updated":
    case "upgradable":
    case "reinstalled":
      return ICON_INSTALLED;
    case "available":
    case "uninstalled":
      return ICON_AVAILABLE;
    case "skipped":
      return trivialSkip ? ICON_INSTALLED : ICON_UNINSTALLABLE;
    case "failed":
    case "rollback failed":
    case "manual recovery":
    case "unavailable":
      return ICON_UNINSTALLABLE;
    // ... (unreachable arms preserved for assertNever exhaustiveness)
  }
}
```

```typescript
// presentation/compact-line.ts:458-479 -- reasons-block composition with soft-dep injection
function composeReasons(
  reasons: readonly Reason[] | undefined,
  declaresAgents: boolean | undefined,
  declaresMcp: boolean | undefined,
  probe: SoftDepProbe,
): string {
  const composed: string[] = reasons === undefined ? [] : [...reasons];

  if (declaresAgents === true && !probe.piSubagentsLoaded) {
    composed.push("requires pi-subagents");
  }

  if (declaresMcp === true && !probe.piMcpAdapterLoaded) {
    composed.push("requires pi-mcp");
  }

  if (composed.length === 0) {
    return "";
  }

  return `{${composed.join(", ")}}`;
}
```

```typescript
// presentation/compact-line.ts:335-349 -- scope-bracket carve-out for available/unavailable (MSG-PL-6 / SNM-11)
function renderPluginList(row: PluginListRow, probe: SoftDepProbe): string {
  const reasons = composeReasons(row.reasons, row.declaresAgents, row.declaresMcp, probe);
  const icon = iconForPluginRow(row.status, false);
  // MSG-PL-6 carve-out: omit [<scope>] when status is (available) or (unavailable).
  const scopeSlot =
    row.status === "available" || row.status === "unavailable" ? "" : `[${row.scope}]`;
  return joinTokens([
    icon,
    row.name,
    scopeSlot,
    renderVersion(row.version),
    `(${row.status})`,
    reasons,
  ]);
}
```

**What to copy into the duplicated `renderPluginRow` inside `shared/notify.ts`:**

| Constant / pattern | Source | Where it lands in `shared/notify.ts` |
|--------------------|--------|--------------------------------------|
| `ICON_INSTALLED = "●"` | `compact-line.ts:65` | file-private const at module scope |
| `ICON_AVAILABLE = "○"` | `compact-line.ts:66` | file-private const at module scope |
| `ICON_UNINSTALLABLE = "⊘"` | `compact-line.ts:67` | file-private const at module scope |
| Per-status → icon table (MSG-IC-1..3) | `compact-line.ts:387-426` | inline inside `renderPluginRow` switch arms (or a private `iconForStatus(status)` helper) |
| `{<reason>, <reason>}` reasons-block format (MSG-GR-4) | `compact-line.ts:458-479` | inline inside `renderPluginRow` arms that emit reasons |
| Soft-dep marker literals: `"requires pi-subagents"` / `"requires pi-mcp"` | `compact-line.ts:467, 471` | file-private string constants; emitted inside reasons-block when D-16-15 conditions hit. Note these are stored INSIDE the brace block, NOT as separate markers. |
| Scope-bracket carve-out (no `[scope]` on available/unavailable per MSG-PL-6 / SNM-11) | `compact-line.ts:339-340` | inline inside the `available`/`unavailable` switch arms of `renderPluginRow` |
| Token-order grammar (MSG-GR-1: `icon name [scope] vVersion (status) {reasons}`) | `compact-line.ts:299-349` | each `renderPluginRow` switch arm composes its row by spreading these tokens in order |
| `joinTokens(parts).filter(p => p !== "").join(" ")` to suppress empty slots | `compact-line.ts:489-491` | file-private helper; same shape |
| `renderVersion(v)` prepending `v` prefix | `compact-line.ts:481-487` | file-private helper; same shape. Note: the `updated` variant uses `composeVersionArrow(from, to)` from `presentation/version-arrow.ts:33-50` for the `<from> → v<to>` form -- duplicate that helper too. |

**D-16-15 dependencies probe details:** `composeReasons` in V1 takes `declaresAgents: boolean` / `declaresMcp: boolean` (per-row predicate fields). The V2 payload model uses `dependencies: readonly Dependency[]` instead (SNM-06 / D-15-02). Adapt the predicate as `row.dependencies?.includes("agents")` / `row.dependencies?.includes("mcp")` (only on `installed` / `updated` / `reinstalled` variants -- the other 7 variants have no `dependencies` field per the type model). The marker injection condition then becomes:

```typescript
// inside renderPluginRow, for installed/updated/reinstalled arms only:
const composed: string[] = [...(p.reasons ?? [])];  // installed/updated/reinstalled have no reasons; ?? [] noop here
for (const dep of p.dependencies) {
  if (dep === "agents" && !probe.piSubagentsLoaded) composed.push("requires pi-subagents");
  if (dep === "mcp"    && !probe.piMcpAdapterLoaded) composed.push("requires pi-mcp");
}
const reasonsSlot = composed.length === 0 ? "" : `{${composed.join(", ")}}`;
```

---

**Analog #5 (cross-file): `presentation/reload-hint.ts` -- reload-hint literal + `${body}\n\n${hint}` append discipline (DUPLICATED inline)**

File: `extensions/pi-claude-marketplace/presentation/reload-hint.ts`

```typescript
// presentation/reload-hint.ts:21-22 -- the canonical literal to DUPLICATE
/** MSG-RH-1 canonical trailer (D-CMC-07: file-private; see header above). */
const RELOAD_HINT_TRAILER = "/reload to pick up changes";

// presentation/reload-hint.ts:51-53 -- the blank-line append discipline
export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n\n${hint}`;
}
```

**What to copy into `shared/notify.ts`:**
- The exact literal `"/reload to pick up changes"` as a file-private const inside `shared/notify.ts`.
- The `${body}\n\n${hint}` join discipline (one blank line between body and hint).
- The "compute first, then append iff non-empty" pattern.

**Phase 16's reload-hint trigger ladder (D-16-12, refining SNM-15):**
- Any plugin `status` ∈ `{"installed", "updated", "reinstalled", "uninstalled"}` → emit hint, OR
- Any marketplace `status` ∈ `{"added", "removed", "updated"}` (success-class only -- NOT `"failed"`) → emit hint.
- Otherwise: suppress (omit the trailing line entirely; emit body unchanged).

Compute this as a single first-match `.some()` traversal over `msg.marketplaces[]` and each `mp.plugins[]`; short-circuit on first trigger.

---

**Analog #6 (cross-file): `softDepStatus(pi)` probe call -- single invocation at entry**

File: `extensions/pi-claude-marketplace/platform/pi-api.ts`

The probe builder is already shipped. Phase 16's `notify()` calls it ONCE at the top of the function (D-16-14: no per-row re-probing).

```typescript
// platform/pi-api.ts:42-45 -- the probe result shape
export interface SoftDepStatus {
  piSubagentsLoaded: boolean;
  piMcpAdapterLoaded: boolean;
}

// platform/pi-api.ts:80-85 -- the probe builder
export function softDepStatus(pi: ExtensionAPI): SoftDepStatus {
  return {
    piSubagentsLoaded: hasLoadedPiSubagents(pi),
    piMcpAdapterLoaded: hasLoadedPiMcpAdapter(pi),
  };
}
```

**Existing call-site patterns to mirror** (these are READ-ONLY references; Phase 16 does NOT modify them, but they show how `softDepStatus(pi)` is threaded today):

```typescript
// orchestrators/plugin/uninstall.ts:220 (existing pattern)
const probe = softDepStatus(pi);
```

```typescript
// orchestrators/plugin/list.ts:771 (existing pattern)
const probe = softDepStatus(pi);
notifySuccess(ctx, renderPluginList(payload, probe));
```

**What to copy:**
- Single `const probe = softDepStatus(pi);` at the top of `notify()`, before any rendering loop.
- Thread the same `probe` value into every `renderPluginRow(p, probe)` invocation (no re-probing inside the loop -- D-16-14).

**Type import path:** Phase 16's `notify()` declares `pi: ExtensionAPI` -- import `ExtensionAPI` from `../platform/pi-api.ts` (already re-exported there per the platform-boundary discipline; never import from `@earendil-works/pi-coding-agent` directly outside of `platform/pi-api.ts` per the Phase 07 lock-in).

---

**Analog #7 (cross-file): `causeChainTrailer(err)` -- per-plugin cause-chain rendering (D-16-08)**

File: `extensions/pi-claude-marketplace/shared/errors.ts`

```typescript
// shared/errors.ts:46-76 -- depth-5 walker (D-16-08 contract)
export function causeChainTrailer(err: unknown): string {
  if (err === undefined || err === null) {
    return "";
  }

  const PREFIX = "cause: ";
  const JOINER = " -> ";
  const MAX_DEPTH = 5;
  const links: string[] = [];
  let current: unknown = err;
  let truncated = false;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    links.push(linkMessage(current));
    if (current instanceof Error && current.cause !== undefined && current.cause !== current) {
      current = current.cause;
      if (depth === MAX_DEPTH - 1) {
        truncated = true;
      }
    } else {
      break;
    }
  }
  // ...
  return `${PREFIX}${links.join(JOINER)}`;
}
```

**Existing call-site pattern (read-only reference):**

```typescript
// orchestrators/marketplace/remove.ts:351-353 -- compose-with-cause-chain pattern
const trailer = causeChainTrailer(aggregated);
const body =
  trailer === "" ? errorMessage(aggregated) : `${errorMessage(aggregated)}\n\n${trailer}`;
```

```typescript
// shared/notify.ts:85-89 -- V1 notifyError's already-shipped trailer compose pattern
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const trailer = cause === undefined ? "" : causeChainTrailer(cause);
  const body = trailer === "" ? message : `${message}\n\n${trailer}`;
  ctx.ui.notify(body, "error");
}
```

**What to copy for Phase 16's per-plugin cause rendering (D-16-08):**
- Import `causeChainTrailer` from `../shared/errors.ts` directly (D-11-safe; `shared/notify.ts` already imports from `shared/errors.ts` at line 1). Avoids the `presentation/cause-chain.ts` re-export indirection consistent with D-16-04's no-presentation-coupling.
- For each `failed` / `manual recovery` plugin with `cause?: Error` set, compute the trailer via `causeChainTrailer(p.cause)` and emit it indented one level deeper than the plugin row (plugin rows are 2-space-indented under the marketplace header; cause-chain trailers are 4-space-indented under the plugin row per D-16-08).
- For `failed` plugins with `rollbackPartial?: readonly { phase: string; cause?: Error }[]`, emit each phase child as a 4-space-indented row under the parent plugin row, AND emit `causeChainTrailer(child.cause)` indented one level deeper (depth-5 indent) where `child.cause` is set.

**Indent shape (worked example for `failed` + `rollbackPartial` + `cause`):**

```
● claude-plugins-official [user] (added)
  ⊘ commit-commands [user] v1.0.0 (failed) {rollback partial}
    [skills] (rollback failed) {permission denied}
      cause: EACCES: permission denied -> EACCES: bridge undo failed
    cause: install failed at phase 3 -> EACCES: bridge undo failed
```

(Spaces shown here are illustrative -- Phase 16's PLAN.md mini-spec section MUST specify the exact byte indents per D-16-04..D-16-15.)

---

**Skeleton sketch of `notify()` (orientation only -- planner authors the final shape):**

```typescript
// shared/notify.ts -- new V2 entry point (per D-16-01, D-16-09, D-16-11, D-16-12, D-16-14)
export function notify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  message: NotificationMessage,
): void {
  const probe = softDepStatus(pi);  // D-16-14: single probe per invocation

  const blocks: string[] = [];
  for (const mp of message.marketplaces) {
    const lines: string[] = [renderMpHeader(mp)];
    for (const p of mp.plugins) {
      lines.push(`  ${renderPluginRow(p, probe)}`);
      // D-16-08: per-plugin cause-chain trailer at indent-4 for failed / manual recovery
      if ((p.status === "failed" || p.status === "manual recovery") && p.cause !== undefined) {
        lines.push(`    ${causeChainTrailer(p.cause)}`);
      }
      // D-16-08: rollbackPartial child rows at indent-4 + nested cause-chain at indent-6
      if (p.status === "failed" && p.rollbackPartial !== undefined) {
        for (const phase of p.rollbackPartial) {
          lines.push(`    [${phase.phase}] (rollback failed)`);  // exact bytes per planner mini-spec
          if (phase.cause !== undefined) {
            lines.push(`      ${causeChainTrailer(phase.cause)}`);
          }
        }
      }
    }
    blocks.push(lines.join("\n"));
  }
  const body = blocks.join("\n\n");  // D-16-07: one blank line between marketplace blocks

  // D-16-12: reload-hint trigger
  const hint = shouldEmitReloadHint(message) ? "/reload to pick up changes" : "";
  const withHint = hint === "" ? body : `${body}\n\n${hint}`;

  // D-16-11: severity ladder
  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(withHint);
  } else {
    ctx.ui.notify(withHint, severity);
  }
}
```

```typescript
// V2 UsageError entry point (D-16-02, mirrors V1 line 105 byte-equal)
export function notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void {
  ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error");
}
```

---

### `tests/shared/notify-v2.test.ts` (NEW FILE)

**Role:** test (unit). Per-status unit suite covering the v2 grammar -- ≥ 20 cases per D-16-17 -- using mock `ctx` + mock `pi`.

**Data flow:** request-response -- each test constructs a structured `NotificationMessage` / `UsageErrorMessage` payload, invokes `notify(ctx, pi, payload)` or `notifyUsageError(ctx, payload)`, then asserts the EXACT string + severity arg(s) passed to `ctx.ui.notify.mock.calls[0]!.arguments`.

**Analog: `tests/shared/notify.test.ts` (V1 wrapper tests)**

File: `tests/shared/notify.test.ts`

```typescript
// tests/shared/notify.test.ts:1-23 -- mock-ctx idiom + makeCtx helper
import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  notifyError,
  notifySuccess,
  notifyWarning,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

/**
 * Mock ExtensionContext is a small object literal `{ ui: { notify: mock.fn() } }`
 * using node:test's built-in mock surface (no third-party mocking framework).
 */
interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}
```

```typescript
// tests/shared/notify.test.ts:25-44 -- per-severity assertion shape
test("notifySuccess calls ctx.ui.notify with no severity arg (ES-1)", () => {
  const ctx = makeCtx();
  notifySuccess(ctx as never, "all good");
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["all good"]);
});

test("notifyWarning calls ctx.ui.notify with 'warning' severity (ES-2)", () => {
  const ctx = makeCtx();
  notifyWarning(ctx as never, "soft-dep unloaded");
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["soft-dep unloaded", "warning"]);
});

test("notifyError without cause calls ctx.ui.notify with 'error' severity and verbatim message (ES-2)", () => {
  const ctx = makeCtx();
  notifyError(ctx as never, "operation failed");
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["operation failed", "error"]);
});
```

```typescript
// tests/shared/notify.test.ts:82-90 -- cause-chain assertion shape (depth-5)
test("notifyError walks the depth-5 cause chain (MSG-CC-1)", () => {
  const ctx = makeCtx();
  const inner = new Error("inner", { cause: new Error("root") });
  notifyError(ctx as never, "outer", inner);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "outer\n\ncause: inner -> root",
    "error",
  ]);
});
```

**What to copy verbatim into `notify-v2.test.ts`:**

| Pattern | Source | What lands in `notify-v2.test.ts` |
|---------|--------|------------------------------------|
| Mock-ctx idiom: `{ ui: { notify: mock.fn() } }` | lines 17-23 | identical `MockCtx` interface + `makeCtx()` helper |
| `assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [...])` assertion shape | lines 29, 36, 43, 53-56 | every test ends with this assertion |
| Severity arg shape: `[message]` for info; `[message, "warning"]`; `[message, "error"]` | lines 29, 36, 43 | each Phase 16 test selects the matching shape per D-16-11's severity ladder |
| `\n\n` blank-line discipline (cause-chain trailer / reload-hint trailer / UsageError join) | line 56 (cause), line 88 (depth-5) | Phase 16 asserts the same `\n\n` joins for reload-hint and per-plugin cause-chain |
| Cause-chain depth-5 walker semantics | lines 82-90 | Phase 16 reuses the same Error-construction idiom (`new Error("...", { cause: ... })`) for `rollbackPartial` + multi-cause cascade tests |
| `ctx as never` cast | lines 27, 34, 41, ... | suppresses the structural mismatch between the test's MockCtx and the real ExtensionContext |
| `node:test`'s built-in `mock.fn()` + `mock.calls` surface -- no third-party framework | line 2 | Phase 16 inherits this |

**New idioms specific to Phase 16's tests:**

1. **Mock `pi` shape** (Phase 16 only; V1 tests don't need this):
```typescript
interface MockPi {
  getAllTools: () => { name?: string; sourceInfo?: { source?: string } }[];
}

// Probe-loaded helpers (specifics per the CONTEXT.md):
function piWithSubagentsLoaded(): MockPi {
  return { getAllTools: () => [{ name: "subagent" }] };
}
function piWithMcpLoaded(): MockPi {
  return { getAllTools: () => [{ name: "mcp" }] };
}
function piWithNothingLoaded(): MockPi {
  return { getAllTools: () => [] };
}
```
The mock target is `softDepStatus(pi)`'s `getAllTools()` inspection at `platform/pi-api.ts:53, 67`. Probe failures degrade to `false` (the existing `try { ... } catch { return false; }` blocks in `hasLoadedPiSubagents` / `hasLoadedPiMcpAdapter`); Phase 16's tests inherit that contract.

2. **Structured payload construction** -- each test builds its own `NotificationMessage` / `UsageErrorMessage` inline (D-16-18: no docs/output-catalog.md import). The fixtures Phase 16 invents seed Phase 17's catalog rewrite.

3. **Per-status iteration helpers** (optional, per Claude's Discretion): tests MAY iterate `PLUGIN_STATUSES` (re-exported from `shared/notify.ts:156-167`) and `MARKETPLACE_STATUSES` (line 177) to enumerate variants with a table-driven loop, OR enumerate each variant by hand. Either preserves the ≥ 20-case coverage target.

**Test taxonomy (D-16-17) -- minimum 20 cases:**

| Category | Count | Notes |
|----------|-------|-------|
| Per-plugin-status variants | 10 | one per `PluginNotificationMessage` discriminant |
| Per-marketplace-status values (incl. `mp.status === undefined`) | 5 | 4 literal members + 1 list-surface `details` case |
| Empty `plugins: []` | ≥ 1 | state-change path with no plugins emits header alone |
| Empty `marketplaces: []` | ≥ 1 | top-level empty → planner picks bytes (likely `(no marketplaces)` literal alone) |
| Single-plugin payload | ≥ 1 | 2-line output: header + indented row |
| Multi-plugin payload | ≥ 1 | header + N indented rows, caller order respected |
| Multi-marketplace payload | ≥ 1 | blank line between marketplace blocks; reload-hint appended at end if triggered |
| Orphan-fold (`plugin.scope !== marketplace.scope`) | ≥ 1 | planner picks the exact `[scope]` rendering -- recommended: inline `[<plugin.scope>]` bracket on the plugin row |
| `rollbackPartial` on `failed` | ≥ 1 | indent-4 child rows + indent-6 cause-chain per phase |
| Multi-cause cascade | ≥ 1 | 2+ failed plugins each with `cause?: Error`; each renders inline below its row |
| Severity routing | ≥ 3 | one per tier (info / warning / error); asserts the `[message]` / `[message, "warning"]` / `[message, "error"]` arg shape |
| Reload-hint trigger / suppression | ≥ 2 | one positive (state-changing status), one negative (failed-only payload -- hint suppressed) |
| `notifyUsageError` | ≥ 1 | `${message}\n\n${usage}` shape + `"error"` severity arg |
| **TOTAL** | **≥ 27** | comfortably above the 20 floor |

**File location:** `tests/shared/notify-v2.test.ts`. Same directory as `tests/shared/notify.test.ts` (the V1 file). Phase 21 deletes the V1 test file alongside the V1 wrappers; the `-v2` suffix signals the temporary bounded-duplication window.

---

### `.planning/REQUIREMENTS.md` (editorial: SNM-12 + SNM-15)

**Role:** requirements document (binding contract for Phase 16's success criteria).

**Data flow:** n/a (markdown).

**Analog:** the neighbouring SNM-* rows in the same file. The two edits are:

1. **SNM-12 signature update** (D-16-01). Add `pi: ExtensionAPI` as a second positional argument.
   - **Before:** `notify(ctx: ExtensionContext, message: NotificationMessage): void exported from shared/notify.ts. The single public entrypoint for state-change notifications.`
   - **After:** `notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void exported from shared/notify.ts. The single public entrypoint for state-change notifications. The pi argument is required for the render-time soft-dep probe (SNM-16); orchestrators already receive both ctx and pi separately.`

2. **SNM-15 wording refinement** (D-16-12). Constrain the marketplace-status trigger to state-changing values only.
   - **Before:** `notify() emits the reload-hint trailer (/reload to pick up changes) when contents indicate state change: any plugin status in {installed, updated, reinstalled, uninstalled} or any marketplace status set. No caller-supplied flag.`
   - **After:** `notify() emits the reload-hint trailer (/reload to pick up changes) when contents indicate state change: any plugin status in {installed, updated, reinstalled, uninstalled} or any state-changing marketplace status (added, removed, updated -- not failed). No caller-supplied flag.`

The exact byte shape of these edits is the planner's call; both anchored at existing locked file `.planning/REQUIREMENTS.md` lines 30 and 33 (verified above via grep). Both edits MUST land in Phase 16 -- either as a separate plan (small docs-only commit) or folded into the renderer plan (Claude's Discretion per D-16-01 footer).

---

### `docs/adr/v2-001-structured-notify.md` (editorial, conditional)

**Role:** ADR (Architecture Decision Record). Phase 15 refreshed it to Accepted; Phase 16 builds the renderer it specifies.

**Data flow:** n/a (markdown).

**Analog:** the ADR's Decision / Consequences sections. If the Decision snippet embeds a code excerpt of `notify()`'s signature, the signature update from D-16-01 may need to flow there too. The planner reads `docs/adr/v2-001-structured-notify.md` once during planning; if the signature is referenced, queue a one-line edit alongside the SNM-12 REQUIREMENTS.md edit.

If the ADR's Decision section does NOT embed a `notify()` signature snippet (only references it by name), no ADR edit is required.

---

## Shared Patterns

### Pattern A: Discriminated union + `switch + assertNever`

**Source:** `extensions/pi-claude-marketplace/presentation/compact-line.ts::renderRow` (lines 270-293).
**Apply to:** both file-private helpers (`renderMpHeader`, `renderPluginRow`) inside `shared/notify.ts`. The same `assertNever` import (`import { assertNever } from "./errors.ts";` -- note the relative path is `./errors.ts` because `notify.ts` is a sibling in `shared/`, not `../shared/errors.ts` like `compact-line.ts` uses).

```typescript
// import target (already imported by shared/notify.ts:1 alongside causeChainTrailer):
import { assertNever, causeChainTrailer } from "./errors.ts";
```

### Pattern B: Severity-arg shape (Pi API magic strings)

**Source:** `extensions/pi-claude-marketplace/shared/notify.ts:57-65, 88, 105` (V1 wrappers).
**Apply to:** every `ctx.ui.notify(body, severity?)` call inside the new `notify()` and `notifyUsageError()`. Omit 2nd arg for info; pass `"warning"` / `"error"` for the other two tiers.

```typescript
// inside the new notify():
if (severity === undefined) {
  ctx.ui.notify(withHint);
} else {
  ctx.ui.notify(withHint, severity);  // severity: "warning" | "error"
}
```

### Pattern C: Blank-line discipline (`${body}\n\n${trailer}`)

**Source:** `extensions/pi-claude-marketplace/shared/notify.ts:87, 105` (V1 wrappers) + `extensions/pi-claude-marketplace/presentation/reload-hint.ts:52`.
**Apply to:** three composition sites inside `notify()`:
1. Marketplace blocks: `blocks.join("\n\n")` (D-16-07).
2. Reload-hint trailer: `${body}\n\n${hint}` (D-16-13).
3. Per-plugin cause-chain (D-16-08, indented variant): cause-chain trailer at 4-space indent under its plugin row (no blank line -- it is a direct child line).

The first two are blank-line-separated; the third is NOT (cause chains are direct indented children of the parent plugin row per D-16-08, not separated trailers).

### Pattern D: Per-file ESLint override scopes the V2 additions automatically

**Source:** `eslint.config.js` per-file override for `shared/notify.ts` (the IL-2 / D-07 sole-sanctioned-site discipline).
**Apply to:** the new `notify()` and `notifyUsageError()` exports -- they live in the same file as the V1 wrappers and inherit the same `no-restricted-syntax` exemption. No new ESLint config changes needed. The 34-rule MSG-* lint plugin's `eslint.config.js` `files:` globs cover orchestrators / edge / presentation -- `shared/notify.ts` is already exempt. The V2 entry points stay invisible to the lint plugin until Phase 18-20 migrates call sites to invoke them; Phase 21 then deletes the MSG-* plugin entirely.

### Pattern E: D-11 layering boundary

**Source:** Phase 15 D-11 layering lock (recorded in CONTEXT.md "Established Patterns").
**Apply to:** every import inside the V2 additions. `shared/notify.ts` may import from:
- `./errors.ts` (sibling in `shared/`) -- for `assertNever` and `causeChainTrailer`.
- `./types.ts` (sibling) -- for `Scope`.
- `./grammar/reasons.ts` (sibling subdirectory) -- for `Reason` (already imported as a type-only import at line 3).
- `../platform/pi-api.ts` -- for `ExtensionContext`, `ExtensionAPI`, `softDepStatus`, `SoftDepStatus`.

Forbidden imports (would break D-11):
- `../presentation/*` -- Phase 16 DUPLICATES the literals instead (D-16-04 / D-16-09 / D-16-12 / D-16-15).
- `../persistence/*`, `../domain/*`, `../orchestrators/*`, `../edge/*` -- none needed; `notify()` is a pure transform.

---

## No Analog Found

None. Every file Phase 16 ships has a direct or close analog already in the codebase:

| Phase 16 file | Strongest analog | Why |
|---------------|------------------|-----|
| `shared/notify.ts` V2 additions | V1 wrappers in same file (in-file) + `compact-line.ts::renderRow` (cross-file) | Severity-arg shape from V1; discriminated-union switch from `renderRow`; header+indented-rows composition from `cascadeSummary`. |
| `tests/shared/notify-v2.test.ts` | `tests/shared/notify.test.ts` | Mock-ctx idiom, `mock.calls[0]!.arguments` assertion shape, `node:test` harness -- all reusable verbatim. |
| `.planning/REQUIREMENTS.md` SNM-12 / SNM-15 edits | Same file's neighboring SNM-* rows | Editorial only; same format / style / numbering as the existing 32 SNM-* rows. |
| `docs/adr/v2-001-structured-notify.md` | Same file's Phase 15 Decision section | Conditional one-line edit if the Decision embeds the signature. |

---

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/shared/` -- read full `notify.ts`, `errors.ts`, `types.ts`, `grammar/reasons.ts`
- `extensions/pi-claude-marketplace/platform/pi-api.ts` -- read fully
- `extensions/pi-claude-marketplace/presentation/` -- read `compact-line.ts`, `cascade-summary.ts`, `reload-hint.ts`, `cause-chain.ts`, `sort.ts`, `rollback-partial.ts` (head), `version-arrow.ts`, `marketplace-list.ts` (head)
- `extensions/pi-claude-marketplace/orchestrators/` -- grep for `softDepStatus` / `causeChainTrailer` call sites; read relevant slices of `plugin/uninstall.ts`, `plugin/list.ts`, `marketplace/remove.ts`
- `tests/shared/notify.test.ts` -- read fully
- `tests/architecture/notify-types.test.ts` -- read fully (Phase 15 compile-check; bounds Phase 16's runtime switch)

**Files scanned:** ~15 read-fully, ~5 grep-located + targeted-read.

**Pattern extraction date:** 2026-05-25.
