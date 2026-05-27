# Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 16 (7 source modifications + 5 orchestrator-test modifications + 1 lint-config modification + 2 already-V2 reference files + 1 V2 fixture file)
**Analogs found:** 16 / 16 -- no orchestrator-source migration analog exists yet (Phase 18 is the pilot wave), so V2 references are pulled from the catalog UAT fixtures (`tests/architecture/catalog-uat.test.ts`) and per-variant tests (`tests/shared/notify-v2.test.ts`) which already drive the V2 `notify(ctx, pi, NotificationMessage)` entry point end-to-end.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | orchestrator | request-response (V1 -> V2 notify migration; Wave 0 also adds `pi` to Options) | catalog UAT fixture `"/claude:plugin marketplace add <source>"` at `tests/architecture/catalog-uat.test.ts:1113-1149` (V2 payload shape); existing `remove.ts:105` (`readonly pi: ExtensionAPI` field pattern) | V2-payload: exact (catalog fixture); pi-plumbing: exact (sibling orchestrator) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | orchestrator | request-response (V1 -> V2 notify migration + Phase 17.1 5-state grammar) | catalog UAT fixture `"/claude:plugin marketplace autoupdate <enable|disable> <name>"` at `tests/architecture/catalog-uat.test.ts:1238-1292`; existing `remove.ts:105` (`readonly pi: ExtensionAPI`) | V2-payload: exact (5 fixtures cover every catalog state); pi-plumbing: exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` | orchestrator | request-response (V1 -> V2 notify migration; list-surface arm, `mp.status === undefined`) | catalog UAT fixture `"/claude:plugin marketplace list"` at `tests/architecture/catalog-uat.test.ts:1081-1108` (the only fixture using `details: { autoupdate, lastUpdatedAt? }`); existing `remove.ts:105` (`pi`) | V2-payload: exact; pi-plumbing: exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | orchestrator | request-response (V1 -> V2 notify migration; cascade restructure D-18-03; cleanup-leak drop D-18-01) | catalog UAT fixtures `"/claude:plugin marketplace remove <name>"` at `tests/architecture/catalog-uat.test.ts:1154-1184` (`clean` + `partial` shapes; `partial` shows per-plugin `cause?: Error` per D-16-08) | V2-payload: exact (covers both clean and partial cascade) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | orchestrator | request-response (V1 -> V2 notify migration; retry-hint drop D-18-02; cascade restructure) | catalog UAT fixtures `"/claude:plugin marketplace update <name>"` at `tests/architecture/catalog-uat.test.ts:1189-1233` (3 shapes: `autoupdate-off-manifest-refresh`, `mixed-outcomes`, `mp-failure-network`) | V2-payload: exact (all 3 update states) |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` | edge handler (thin shim) | request-response (factory signature extension) | `edge/handlers/marketplace/remove.ts` (already takes `pi: ExtensionAPI`) | exact |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` | edge handler (thin shim) | request-response (factory signature: `enable: boolean` -> `pi: ExtensionAPI, enable: boolean`) | `edge/handlers/marketplace/remove.ts` (factory takes `pi`) | role-match (compound arg signature; option-a recommended in 18-RESEARCH §Risks #10) |
| `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` | edge handler (thin function) | request-response (currently `handleMarketplaceList(args, ctx)`; needs factory wrapper to receive `pi`) | `edge/handlers/marketplace/remove.ts` (factory-emit pattern); compare to `edge/handlers/plugin/list.ts` (factory takes `pi`) | role-match (shape conversion: plain function -> factory) |
| `extensions/pi-claude-marketplace/edge/register.ts` | wiring (3-line touch) | request-response (passes `pi` into 3 handler factories) | `edge/register.ts:85` (`marketplaceRemove: makeRemoveHandler(pi)`) -- already passes `pi` to one marketplace handler | exact (mirror existing line on 3 sibling lines) |
| `tests/orchestrators/marketplace/add.test.ts` | test | byte-exact V2 assertions through real `notify()` | `tests/shared/notify-v2.test.ts:189-214` (per-variant baseline assertion form) + `makeCtx()` pattern at lines 25-36 (existing pattern preserved per D-18-06) | exact |
| `tests/orchestrators/marketplace/autoupdate.test.ts` | test | byte-exact V2 assertions (Phase 17.1 5-state grammar) | same as above; specifically `tests/shared/notify-v2.test.ts` skipped variant for the idempotent severity-warning shape | exact |
| `tests/orchestrators/marketplace/list.test.ts` | test | byte-exact V2 assertions (list-surface; already V2-shaped per 18-RESEARCH §Per-File Test Surface) | existing `tests/orchestrators/marketplace/list.test.ts:65-172` (current assertions already match V2 catalog) | exact (no flip needed for existing assertions; optional `<last-updated>` enrichment test addition) |
| `tests/orchestrators/marketplace/remove.test.ts` | test | byte-exact V2 assertions (cascade glyph + cause-chain per D-18-03; retry-anchor delete; reload-hint contract flip) | catalog UAT `"partial"` fixture at `tests/architecture/catalog-uat.test.ts:1162-1183` (4-space indent under failed plugin, no mp-level retry trailer) | exact |
| `tests/orchestrators/marketplace/update.test.ts` | test | byte-exact V2 assertions (cascade glyph flip ● -> ⊘ on `skipped`; retry-hint deletes D-18-02; mp.status=`updated` reload-hint contract change) | catalog UAT `"mixed-outcomes"` fixture at `tests/architecture/catalog-uat.test.ts:1197-1224` (⊘ glyph on `skipped`; `from`/`to` carry on `updated`) | exact |
| `eslint.config.js` (MSG-Block 1 + 1b narrowing) | config | additive `ignores:` entry on 2 blocks | `eslint.config.js:209-216` (MSG-Block 3 uses `files: + ignores:` pair); `eslint.config.js:231-245` (MSG-Block 4a Phase-16 bounded `ignores:` adding `shared/notify.ts`) | exact (mirror MSG-Block 4a's bounded-window precedent for Phase 16) |

## Pattern Assignments

### `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (orchestrator, request-response)

**Analog A (V2 payload shape):** `tests/architecture/catalog-uat.test.ts:1114-1132` (`path-source` and `github-source` fixtures).
**Analog B (`pi` plumbing pattern):** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:102-119` (already-V2-plumbed options interface).

**V1 pattern present today (lines 63 + 75-85 + 140-160):**

```typescript
// imports (line 63)
import { notifySuccess, notifyWarning } from "../../shared/notify.ts";

// options interface (lines 75-85) -- NO pi field
export interface AddMarketplaceOptions {
  readonly ctx: ExtensionContext;
  readonly scope: Scope;
  readonly cwd: string;
  readonly rawSource: string;
  readonly gitOps?: GitOps;
}

// cache-leak warning (line 141)
notifyWarning(
  opts.ctx,
  `Marketplace "${recordedName}" added; completion cache refresh deferred: ${errorMessage(err)}`,
);

// success notification (lines 152-160)
const successRow: MarketplaceRow = {
  kind: "marketplace",
  name: recordedName,
  scope: opts.scope,
  status: "added",
  outcomeClass: "ok",
  ...(source.kind === "github" && { marker: "autoupdate" as const }),
};
notifySuccess(opts.ctx, renderRow(successRow, MARKETPLACE_LABEL_PROBE));
```

**V2 reference (catalog UAT fixture at `tests/architecture/catalog-uat.test.ts:1117-1118`, path-source case):**

```typescript
"path-source": {
  pi: piWithBothLoaded(),
  message: {
    marketplaces: [{ name: "local-mp", scope: "user", status: "added", plugins: [] }],
  },
},
```

**`pi` plumbing pattern (from `remove.ts:102-119`, exact mirror target):**

```typescript
export interface RemoveMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools()` for RH-5 soft-dep probes. */
  readonly pi: ExtensionAPI;
  readonly name: string;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly cascade?: typeof cascadeUnstagePlugin;
}
```

**Data flow:**
- **Inputs:** `opts.ctx`, `opts.pi` (NEW, Wave 0), `opts.scope`, `opts.rawSource`, `opts.gitOps?`, `recordedName` (post-guard).
- **Output payload (single `notify()` call replacing line 160):**
  ```typescript
  notify(opts.ctx, opts.pi, {
    marketplaces: [{
      name: recordedName,
      scope: opts.scope,
      status: "added",
      plugins: [],
    }],
  });
  ```
- **V2 byte form (both github + path):** `● <recordedName> [<scope>] (added)\n\n/reload to pick up changes` (reload-hint fires from mp.status `"added"` per D-16-12; `<autoupdate>` marker MOVES off the `(added)` arm).
- **Cache-leak warning (line 141):** DROP entirely per D-18-01 precedent extension (no V2 representation; `try/catch` retains the swallow).

**Imports to drop:**
- `import { renderRow } from "../../presentation/compact-line.ts";` (line 53)
- `import { MARKETPLACE_LABEL_PROBE } from "../../shared/constants/marketplace-label-probe.ts";` (line 55)
- `import { notifySuccess, notifyWarning } from "../../shared/notify.ts";` (line 63)
- `import type { MarketplaceRow } from "../../presentation/compact-line.ts";` (line 72)

**Imports to add:**
- `import { notify } from "../../shared/notify.ts";`
- `import type { NotificationMessage } from "../../shared/notify.ts";` (optional, only if the payload is hoisted to a variable; usually inline is fine)
- `import type { ExtensionAPI } from "../../platform/pi-api.ts";` (Wave 0 -- already exported alongside `ExtensionContext` at `platform/pi-api.ts:19`)

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` (orchestrator, request-response)

**Analog A (V2 payload shape, all 5 catalog states):** `tests/architecture/catalog-uat.test.ts:1238-1292`.
**Analog B (`pi` plumbing):** `remove.ts:102-119` (same template as add.ts).

**V1 pattern present today (lines 46 + 55-65 + 141-185):**

```typescript
// imports (line 46)
import { notifyError, notifySuccess } from "../../shared/notify.ts";

// options interface (lines 55-65) -- NO pi field
export interface AutoupdateOptions {
  readonly ctx: ExtensionContext;
  readonly name?: string;
  readonly enable: boolean;
  readonly scope?: Scope;
  readonly cwd: string;
}

// per-scope error path (line 141)
notifyError(opts.ctx, errorMessage(err), err);

// missingEverywhere path (line 155)
notifyError(opts.ctx, errorMessage(first.cause), first.cause);

// empty-scopes path (lines 162-167)
notifySuccess(
  opts.ctx,
  renderRow({ kind: "empty", token: "no marketplaces" }, MARKETPLACE_LABEL_PROBE),
);

// success path (lines 178-184) -- with alphabetic sort
const sorted = [...rows].sort((a, b) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
);
const lines = sorted.map((row) =>
  renderRow(buildAutoupdateRow(row, opts.enable), MARKETPLACE_LABEL_PROBE),
);
notifySuccess(opts.ctx, lines.join("\n"));
```

**V2 reference (catalog UAT fixtures at `tests/architecture/catalog-uat.test.ts:1239-1291`):**

```typescript
"enable-fresh": {
  pi: piWithBothLoaded(),
  message: {
    marketplaces: [{ name: "foo", scope: "user", status: "autoupdate enabled", plugins: [] }],
  },
},
"enable-idempotent": {
  pi: piWithBothLoaded(),
  expectedSeverity: "warning",
  message: {
    marketplaces: [
      {
        name: "foo",
        scope: "user",
        status: "skipped",
        reasons: ["already enabled"],
        plugins: [],
      },
    ],
  },
},
"failure-not-found": {
  pi: piWithBothLoaded(),
  expectedSeverity: "error",
  message: {
    marketplaces: [{ name: "missing-mp", scope: "user", status: "failed", plugins: [] }],
  },
},
```

**Data flow:**
- **Inputs:** `opts.ctx`, `opts.pi` (NEW, Wave 0), `opts.enable`, `opts.name?`, `opts.scope?`, `opts.cwd`; loop-collected `rows: AutoupdateRowInput[]` and `errors`.
- **Output payload (single `notify()` per terminal path):**
  - Per-scope error (line 141) + missingEverywhere (line 155): `{ marketplaces: [{ name, scope, status: "failed", plugins: [] }] }` -> severity `"error"`, no reload-hint.
  - Empty-scopes (line 163): `{ marketplaces: [] }` -> renders `(no marketplaces)`.
  - Fresh enable: `{ marketplaces: [{ name, scope, status: "autoupdate enabled", plugins: [] }] }` -> reload-hint fires (D-17.1-02).
  - Fresh disable: `{ marketplaces: [{ name, scope, status: "autoupdate disabled", plugins: [] }] }` -> reload-hint fires.
  - Idempotent enable: `{ marketplaces: [{ name, scope, status: "skipped", reasons: ["already enabled"], plugins: [] }] }` -> severity `"warning"`, no reload-hint.
  - Idempotent disable: `{ marketplaces: [{ name, scope, status: "skipped", reasons: ["already disabled"], plugins: [] }] }` -> severity `"warning"`, no reload-hint.
  - Multi-marketplace bare form: single `{ marketplaces: [...] }` payload with one entry per accumulated row; status/reasons per the above mapping.
- **D-16-06 caller-order:** drop the alphabetic sort at lines 178-180 (renderer honors caller order; SC-6 iteration order is project-then-user).
- **Drop local helpers `AutoupdateRowInput` (line 71) + `buildAutoupdateRow` (line 98-111):** direct construction of `MarketplaceNotificationMessage` per loop iteration is cleaner (no intermediate row type).

**Imports to drop:**
- `import { renderRow } from "../../presentation/compact-line.ts";` (line 43)
- `import { MARKETPLACE_LABEL_PROBE } from "../../shared/constants/marketplace-label-probe.ts";` (line 44)
- `import { notifyError, notifySuccess } from "../../shared/notify.ts";` (line 46)
- `import type { MarketplaceRow } from "../../presentation/compact-line.ts";` (line 52)

**Imports to add:**
- `import { notify } from "../../shared/notify.ts";`
- `import type { MarketplaceNotificationMessage } from "../../shared/notify.ts";` (if intermediate accumulator-typed)
- `import type { ExtensionAPI } from "../../platform/pi-api.ts";`

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` (orchestrator, request-response)

**Analog A (V2 list-surface payload -- the ONLY `mp.status === undefined` consumer in marketplace family):** `tests/architecture/catalog-uat.test.ts:1081-1108` (`empty` + `mixed-scopes`).
**Analog B (`pi` plumbing):** `remove.ts:102-119`.

**V1 pattern present today (lines 25 + 32-38 + 50-67):**

```typescript
// imports (lines 24-25)
import { renderMarketplaceList } from "../../presentation/marketplace-list.ts";
import { notifySuccess } from "../../shared/notify.ts";

// options interface (lines 32-38) -- NO pi field
export interface ListMarketplacesOptions {
  readonly ctx: ExtensionContext;
  readonly scope?: Scope;
  readonly cwd: string;
}

// list build + notify (lines 50-67)
const entry: MarketplaceListEntry = {
  name: record.name,
  scope: record.scope,
  source: record.source as ParsedSource,
  ...(record.autoupdate !== undefined && { autoupdate: record.autoupdate }),
};
allRecords.push(entry);
// ...
notifySuccess(opts.ctx, renderMarketplaceList(allRecords));
```

**V2 reference (catalog UAT fixture at `tests/architecture/catalog-uat.test.ts:1087-1107`):**

```typescript
"mixed-scopes": {
  pi: piWithBothLoaded(),
  message: {
    marketplaces: [
      {
        name: "alpha",
        scope: "project",
        details: { autoupdate: true, lastUpdatedAt: "2026-05-25T00:00:00Z" },
        plugins: [],
      },
      { name: "alpha", scope: "user", plugins: [] },              // details omitted -> bare row
      { name: "beta", scope: "user", plugins: [] },
      { name: "zeta", scope: "project", details: { autoupdate: true }, plugins: [] },
    ],
  },
},
```

**Data flow:**
- **Inputs:** `opts.ctx`, `opts.pi` (NEW, Wave 0), `opts.scope?`, `opts.cwd`; loop accumulates `MarketplaceNotificationMessage[]` (no longer `MarketplaceListEntry[]`).
- **Output payload:**
  ```typescript
  notify(opts.ctx, opts.pi, {
    marketplaces: allRecords.map((record) => ({
      name: record.name,
      scope: record.scope,
      // mp.status intentionally omitted -- list surface arm uses `mp.status === undefined`
      ...(record.autoupdate !== undefined || record.lastUpdatedAt !== undefined
        ? {
            details: {
              autoupdate: record.autoupdate ?? false,
              ...(record.lastUpdatedAt !== undefined && { lastUpdatedAt: record.lastUpdatedAt }),
            },
          }
        : {}),
      plugins: [],
    })),
  });
  ```
- **Empty case:** `{ marketplaces: [] }` -> renders `(no marketplaces)` per D-16-17.
- **NEW enrichment:** thread `record.lastUpdatedAt` into `details.lastUpdatedAt` (the current orchestrator at line 58 doesn't pass it; catalog renders `<last-updated <iso>>` when defined).

**Imports to drop:**
- `import { renderMarketplaceList } from "../../presentation/marketplace-list.ts";` (line 24)
- `import { notifySuccess } from "../../shared/notify.ts";` (line 25)
- `import type { MarketplaceListEntry } from "../../presentation/marketplace-list.ts";` (line 29)

**Imports to add:**
- `import { notify } from "../../shared/notify.ts";`
- `import type { MarketplaceNotificationMessage } from "../../shared/notify.ts";`
- `import type { ExtensionAPI } from "../../platform/pi-api.ts";`

**Note:** `ParsedSource` import (line 27) becomes unused if the V2 payload doesn't carry `source`. Drop it. The catalog list fixture confirms no `source` field on `MarketplaceNotificationMessage`.

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (orchestrator, request-response + cascade restructure)

**Analog A (V2 clean shape):** `tests/architecture/catalog-uat.test.ts:1155-1160` (`clean` fixture).
**Analog B (V2 partial cascade shape with per-plugin `cause`):** `tests/architecture/catalog-uat.test.ts:1162-1183` (`partial` fixture).
**Analog C (`pi` plumbing):** `remove.ts:102-119` -- SELF (no Wave 0 change needed; interface already takes `pi`).

**V1 pattern present today (lines 80 + 299-303 + 341-355 + 363-408 + 411-422):**

```typescript
// imports (line 80)
import { notifySuccess, notifyWarning } from "../../shared/notify.ts";

// cache-cleanup leak warning (lines 298-303) -- DROP per D-18-01
notifyWarning(
  opts.ctx,
  `Marketplace "${opts.name}" removed; completion cache cleanup deferred: ${errorMessage(err)}`,
);

// post-state cleanup-leak warning (lines 341-355) -- DROP per D-18-01
if (cleanupLeaks.length > 0) {
  const aggregated = appendLeaks(
    new Error(`Marketplace removed but post-state cleanup failed for ${cleanupLeaks.length.toString()} path(s).`),
    cleanupLeaks,
  );
  const trailer = causeChainTrailer(aggregated);
  const body = trailer === "" ? errorMessage(aggregated) : `${errorMessage(aggregated)}\n\n${trailer}`;
  notifyWarning(opts.ctx, body);
  return;
}

// CMC-31 PARTIAL form (lines 363-408) -- REPLACE per D-18-03 cascade restructure
const headerRow: MarketplaceRow = {
  kind: "marketplace",
  name: opts.name,
  scope: resolved.scope,
  outcomeClass: "failure",
  status: "failed",
  reasons: ["plugins remain"],
};
const childRows: PluginCascadeRow[] = [
  ...successfullyUnstaged.map<PluginCascadeRow>((pluginName) => ({ kind: "plugin-cascade", name: pluginName, scope: resolved.scope, status: "uninstalled", declaresAgents: false, declaresMcp: false })),
  ...failedPlugins.map<PluginCascadeRow>((fp) => ({ kind: "plugin-cascade", name: fp.name, scope: resolved.scope, status: "failed", reasons: [narrowCascadeFailure(fp.cause)], declaresAgents: false, declaresMcp: false })),
];
const { message } = cascadeSummary({ marketplace: headerRow, rows: childRows, probe });
const removedSorted = [...removedPlugins].sort((a, b) => a.localeCompare(b));
const reloadTrailer = reloadHint(removedSorted);
let body = appendReloadHint(message, reloadTrailer);
body = `${body}\n\n${RETRY_ANCHOR}`;
notifyWarning(opts.ctx, body);
return;

// CMC-31 CLEAN form (lines 411-422)
const cleanRow: MarketplaceRow = {
  kind: "marketplace",
  name: opts.name,
  scope: resolved.scope,
  outcomeClass: "ok",
  status: "removed",
};
const removedSorted = [...removedPlugins].sort((a, b) => a.localeCompare(b));
const hint = reloadHint(removedSorted);
notifySuccess(opts.ctx, appendReloadHint(renderRow(cleanRow, probe), hint));
```

**V2 reference (catalog UAT `partial` fixture at `tests/architecture/catalog-uat.test.ts:1162-1183`):**

```typescript
partial: {
  pi: piWithBothLoaded(),
  expectedSeverity: "error",
  message: {
    marketplaces: [
      {
        name: "local-mp",
        scope: "user",
        status: "failed",
        plugins: [
          { status: "uninstalled", name: "helper", version: "1.0.0" },
          {
            status: "failed",
            name: "tool",
            reasons: ["permission denied"],
            cause: new Error("EACCES: permission denied"),  // D-18-03: per-plugin cause-chain; 4-space indent by renderPluginRow
          },
        ],
      },
    ],
  },
},
```

**Data flow:**
- **Inputs:** `opts.ctx`, `opts.pi` (existing), `opts.name`, `resolved.scope`, accumulated `successfullyUnstaged: string[]`, `failedPlugins: { name, cause }[]`, `removedPlugins: string[]`.
- **Output payload -- CLEAN (line 422 replacement):**
  ```typescript
  notify(opts.ctx, opts.pi, {
    marketplaces: [{
      name: opts.name,
      scope: resolved.scope,
      status: "removed",
      plugins: [],
    }],
  });
  ```
  V2 byte: `● <name> [<scope>] (removed)\n\n/reload to pick up changes` (reload-hint fires from mp-level `"removed"` even on empty marketplace -- contract change vs V1 per 18-RESEARCH §Risks #7).
- **Output payload -- PARTIAL (line 407 replacement) per D-18-03:**
  ```typescript
  notify(opts.ctx, opts.pi, {
    marketplaces: [{
      name: opts.name,
      scope: resolved.scope,
      status: "failed",
      plugins: [
        ...successfullyUnstaged.map((name): PluginUninstalledMessage => ({
          status: "uninstalled",
          name,
        })),
        ...failedPlugins.map(({ name, cause }): PluginFailedMessage => ({
          status: "failed",
          name,
          reasons: [narrowCascadeFailure(cause)],
          cause,  // D-18-03 / D-16-08: per-plugin cause-chain at 4-space indent
        })),
      ],
    }],
  });
  ```
  V2 byte form: `⊘ <name> [<scope>] (failed)\n  ○ <pname> v<ver> (uninstalled)\n  ⊘ <fname> (failed) {<reason>}\n    cause: <message>\n\n/reload to pick up changes`. Severity computed by renderer (any failed -> error).
- **Drops:** `RETRY_ANCHOR` literal (line 100) -- dead; `causeChainTrailer` usage at line 351 -- dead; `cleanupLeaks` accumulator (line 307) -- planner discretion to delete the array entirely OR keep `removePath()` calls and swallow leaks silently (the underlying `rm()` calls MUST stay).
- **`narrowCascadeFailure` (line 162):** KEEP as-is; reused inside `plugins[].map()` to populate `PluginFailedMessage.reasons[0]`.

**Imports to drop:**
- `import { softDepStatus } from "../../platform/pi-api.ts";` (line 73)
- `import { cascadeSummary } from "../../presentation/cascade-summary.ts";` (line 74)
- `import { causeChainTrailer } from "../../presentation/cause-chain.ts";` (line 75)
- `import { renderRow } from "../../presentation/compact-line.ts";` (line 76)
- `import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";` (line 77)
- `import { notifySuccess, notifyWarning } from "../../shared/notify.ts";` (line 80)
- `import type { MarketplaceRow, PluginCascadeRow, SoftDepProbe } from "../../presentation/compact-line.ts";` (lines 90-94)
- `appendLeaks` from `../../shared/errors.ts` (line 79) -- ONLY if cleanup-leak-aggregator code is fully deleted; if `cleanupLeaks` array retained for future-proofing, keep this import

**Imports to add:**
- `import { notify } from "../../shared/notify.ts";`
- `import type { PluginFailedMessage, PluginUninstalledMessage } from "../../shared/notify.ts";`
- No `ExtensionAPI` add needed (already imported at line 89 alongside `ExtensionContext`).

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` (orchestrator, request-response + cascade restructure + retry-hint drop)

**Analog A (V2 mp-level failure, bare):** `tests/architecture/catalog-uat.test.ts:1226-1232` (`mp-failure-network` fixture).
**Analog B (V2 manifest-refresh updated):** `tests/architecture/catalog-uat.test.ts:1190-1195` (`autoupdate-off-manifest-refresh`).
**Analog C (V2 cascade with mixed outcomes):** `tests/architecture/catalog-uat.test.ts:1197-1224` (`mixed-outcomes`).
**Analog D (`pi` plumbing):** `update.ts:143-171` already declares `readonly pi?: ExtensionAPI` (optional). Wave 0 makes it REQUIRED on both `UpdateMarketplaceOptions` (line 143) and `UpdateAllMarketplacesOptions` (line 164).

**V1 pattern present today (line 104 + 220 + 584-586 + 599-603 + 631 + 638-648):**

```typescript
// imports (line 104)
import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";

// updateAllMarketplaces empty-targets (line 220)
notifySuccess(opts.ctx, renderRow({ kind: "empty", token: "no marketplaces" }, NULL_PROBE));

// mp-level failure WITH retry-hint (line 584) -- D-18-02 DROPS retry-hint
if (err instanceof MarketplaceUpdateError && err.retryHint !== "") {
  notifyError(ctx, `${errorMessage(err)}\n${err.retryHint}`, err.cause);
} else {
  notifyError(ctx, errorMessage(err), err);
}

// cache-cleanup-leak warning (line 599) -- DROP per D-18-01 precedent
notifyWarning(
  ctx,
  `Marketplace "${name}" updated; completion cache refresh deferred: ${errorMessage(err)}`,
);

// autoupdate-OFF manifest-refresh (line 631)
if (!snapshot.autoupdate || pluginUpdate === undefined) {
  notifySuccess(ctx, renderRow(headerRow, probe));
  return;
}

// autoupdate-ON cascade (lines 638-648) -- ternary dispatch
const rows: PluginCascadeRow[] = outcomes.map((o) => outcomeToCascadeRow(o, scope));
const { message, severity } = cascadeSummary({ marketplace: headerRow, rows, probe });
const changedNames = outcomes.filter((o) => o.partition === "updated").map((o) => o.name);
const hint = reloadHint(changedNames);
const body = appendReloadHint(message, hint);
const dispatch = severity === "warning" ? notifyWarning : notifySuccess;
dispatch(ctx, body);
```

**V2 reference (catalog UAT `mixed-outcomes` at `tests/architecture/catalog-uat.test.ts:1197-1224`, mapping V1 `outcomeToCascadeRow` -> V2 per-plugin messages):**

```typescript
"mixed-outcomes": {
  pi: piWithBothLoaded(),
  expectedSeverity: "error",
  message: {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "updated",
        plugins: [
          { status: "updated", name: "alpha", from: "0.5.0", to: "1.0.0", dependencies: [] },
          { status: "skipped", name: "beta", reasons: ["up-to-date"] },
          { status: "failed", name: "delta", reasons: ["network unreachable"] },
        ],
      },
    ],
  },
},
```

**Data flow:**
- **Inputs:** `ctx`, `pi` (made REQUIRED in Wave 0), `name`, `scope`, `snapshot.autoupdate`, `outcomes: readonly PluginUpdateOutcome[]`.
- **Output payload -- empty targets (line 220):** `notify(opts.ctx, opts.pi, { marketplaces: [] })` -> `(no marketplaces)`.
- **Output payload -- mp-level failure (lines 584 + 586 collapse) per D-18-02:**
  ```typescript
  notify(ctx, pi, {
    marketplaces: [{ name, scope, status: "failed", plugins: [] }],
  });
  ```
  V2 byte: `⊘ <name> [<scope>] (failed)` alone. `err.retryHint` stays internal to `MarketplaceUpdateError`; no cause-chain (V2 confines `cause?: Error` to plugin variants per D-16-08).
- **Cache-cleanup-leak (line 599):** DROP entirely per D-18-01 precedent.
- **Output payload -- manifest-refresh (line 631):**
  ```typescript
  notify(ctx, pi, {
    marketplaces: [{ name, scope, status: "updated", plugins: [] }],
  });
  ```
  V2 byte: `● <name> [<scope>] (updated)\n\n/reload to pick up changes` (silent contract change: V1 emitted no reload-hint; V2 does per D-16-12).
- **Output payload -- cascade (line 647) per D-18-03 restructure:**
  ```typescript
  notify(ctx, pi, {
    marketplaces: [{
      name,
      scope,
      status: "updated",
      plugins: outcomes.map((o) => outcomeToCascadePluginMessage(o, scope)),
    }],
  });
  ```
  Replace the V1 `outcomeToCascadeRow` (line 408) with `outcomeToCascadePluginMessage` returning a discriminated `PluginNotificationMessage`. Per-outcome mapping:
  - `partition === "updated"` -> `PluginUpdatedMessage { status: "updated", name, from, to, dependencies }`
  - `partition === "unchanged"` -> `PluginSkippedMessage { status: "skipped", name, reasons: ["up-to-date"] }` (glyph flips ● -> ⊘ -- 18-RESEARCH §Risks #5)
  - `partition === "skipped"` -> `PluginSkippedMessage { status: "skipped", name, reasons: [<narrowed Reason>] }`
  - `partition === "failed"` -> `PluginFailedMessage { status: "failed", name, reasons: [<narrowed Reason>], cause? }` (per D-18-03)
- **Severity:** computed by `notify()` (D-16-11; ternary dispatch goes away).
- **Reload-hint:** computed by `notify()`; manual `reloadHint(changedNames)` composition is dead.

**Imports to drop:**
- `import { softDepStatus } from "../../platform/pi-api.ts";` (line 90)
- `import { cascadeSummary } from "../../presentation/cascade-summary.ts";` (line 91)
- `import { renderRow } from "../../presentation/compact-line.ts";` (line 93)
- `import { appendReloadHint, reloadHint } from "../../presentation/reload-hint.ts";` (line 94)
- `import { composeVersionArrow } from "../../presentation/version-arrow.ts";` (line 95) -- IF `outcomeToCascadeRow` is fully rewritten as `outcomeToCascadePluginMessage` carrying `from`/`to` directly (renderer composes arrow). Verify post-rewrite.
- `import { notifyError, notifySuccess, notifyWarning } from "../../shared/notify.ts";` (line 104)
- `import type { MarketplaceRow, PluginCascadeRow, SoftDepProbe } from "../../presentation/compact-line.ts";` (lines 119-122)
- `const NULL_PROBE` (lines 138-141) -- dead when `pi` is REQUIRED.

**Imports to KEEP (verify):**
- `import { composeErrorWithCauseChain } from "../../presentation/cause-chain.ts";` (line 92) -- still used at line 337 inside `cascadeAutoupdates` for `outcome.notes` composition (non-notify consumer). 18-RESEARCH §Risks #9 + Open Question 3.

**Imports to add:**
- `import { notify } from "../../shared/notify.ts";`
- `import type { PluginNotificationMessage, PluginFailedMessage, PluginUpdatedMessage, PluginSkippedMessage } from "../../shared/notify.ts";`
- No `ExtensionAPI` add needed (already imported at line 117).

---

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` (edge handler factory)

**Analog:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts:25-51` (already takes `pi: ExtensionAPI`).

**V1 pattern present today (lines 26-57):**

```typescript
export function makeAddHandler(
  deps: EdgeDeps,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // ... parsing ...
    await addMarketplace({
      ctx,
      scope: parsed.scope ?? "user",
      cwd: ctx.cwd,
      rawSource: parsed.source,
      gitOps: deps.gitOps,
    });
  };
}
```

**V2 reference (`edge/handlers/marketplace/remove.ts:25-51`, exact mirror):**

```typescript
export function makeRemoveHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // ... parsing ...
    await removeMarketplace({
      ctx,
      pi,                                    // <-- pass-through
      name: parsed.name,
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
```

**Data flow:**
- **Signature change:** `makeAddHandler(deps)` -> `makeAddHandler(pi, deps)` (Wave 0). Both arguments needed: `pi` for the orchestrator's `notify()` probe; `deps.gitOps` for the orchestrator's `gitOps` seam.
- **Imports to add:** `import type { ExtensionAPI } from "../../../platform/pi-api.ts";`
- **Body change:** add `pi` field to the `addMarketplace({...})` call.

---

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` (edge handler factory)

**Analog:** `edge/handlers/marketplace/remove.ts:25-51` (pi-arg factory shape).

**V1 pattern present today (lines 25-52):**

```typescript
export function makeAutoupdateHandler(
  enable: boolean,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  const usage = usageFor(enable);
  return async (args, ctx): Promise<void> => {
    // ... parsing ...
    await setMarketplaceAutoupdate({
      ctx,
      cwd: ctx.cwd,
      enable,
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
```

**V2 mirror (signature change per Risks #10, option-a recommended):**

```typescript
export function makeAutoupdateHandler(
  pi: ExtensionAPI,
  enable: boolean,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  // ... unchanged ...
  await setMarketplaceAutoupdate({
    ctx,
    pi,                                     // <-- pass-through
    cwd: ctx.cwd,
    enable,
    ...(parsed.name !== undefined && { name: parsed.name }),
    ...(parsed.scope !== undefined && { scope: parsed.scope }),
  });
}
```

**Data flow:**
- **Signature change:** `makeAutoupdateHandler(enable)` -> `makeAutoupdateHandler(pi, enable)` (Wave 0). Two register.ts call sites updated: lines 88-89 from `makeAutoupdateHandler(true)` / `makeAutoupdateHandler(false)` -> `makeAutoupdateHandler(pi, true)` / `makeAutoupdateHandler(pi, false)`.
- **Imports to add:** `import type { ExtensionAPI } from "../../../platform/pi-api.ts";`

---

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` (edge handler -- currently plain function)

**Analog:** `edge/handlers/marketplace/remove.ts:25-51` (factory pattern) OR `edge/handlers/marketplace/list.ts` ITSELF after Wave 0 conversion.

**V1 pattern present today (lines 17-40):**

```typescript
export async function handleMarketplaceList(
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  // ... parsing ...
  await listMarketplaces({
    ctx,
    cwd: ctx.cwd,
    ...(parsed.scope !== undefined && { scope: parsed.scope }),
  });
}
```

**V2 mirror (convert plain function -> factory pattern matching siblings):**

```typescript
export function makeMarketplaceListHandler(
  pi: ExtensionAPI,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (args, ctx): Promise<void> => {
    // ... parsing ...
    await listMarketplaces({
      ctx,
      pi,                                    // <-- pass-through
      cwd: ctx.cwd,
      ...(parsed.scope !== undefined && { scope: parsed.scope }),
    });
  };
}
```

**Data flow:**
- **Signature change:** `handleMarketplaceList(args, ctx)` -> `makeMarketplaceListHandler(pi)(args, ctx)`. `register.ts:86` mapping changes from `marketplaceList: handleMarketplaceList` -> `marketplaceList: makeMarketplaceListHandler(pi)`.
- **Imports to add:** `import type { ExtensionAPI } from "../../../platform/pi-api.ts";`
- **Naming convention:** follow `makeXHandler` pattern of siblings. The previous `handleMarketplaceList` symbol disappears; any test that imports it must update (verify by grep at plan-write time).

---

### `extensions/pi-claude-marketplace/edge/register.ts` (wiring, lines 84-89)

**Analog:** `register.ts:85` (`marketplaceRemove: makeRemoveHandler(pi)`).

**V1 pattern present today (lines 84-89):**

```typescript
marketplaceAdd: makeAddHandler(deps),
marketplaceRemove: makeRemoveHandler(pi),
marketplaceList: handleMarketplaceList,
marketplaceUpdate: makeMarketplaceUpdateHandler(deps),
marketplaceAutoupdate: makeAutoupdateHandler(true),
marketplaceNoautoupdate: makeAutoupdateHandler(false),
```

**V2 mirror (Wave 0 surgical edits to 3 lines: 84, 86, 88-89):**

```typescript
marketplaceAdd: makeAddHandler(pi, deps),                  // line 84 -- adds pi as 1st arg
marketplaceRemove: makeRemoveHandler(pi),                  // line 85 -- unchanged
marketplaceList: makeMarketplaceListHandler(pi),           // line 86 -- factory + pi
marketplaceUpdate: makeMarketplaceUpdateHandler(deps),     // line 87 -- unchanged (update.ts orchestrator already takes optional pi; Wave 0 makes it required and threads via deps OR pi-arg -- planner discretion)
marketplaceAutoupdate: makeAutoupdateHandler(pi, true),    // line 88
marketplaceNoautoupdate: makeAutoupdateHandler(pi, false), // line 89
```

**Note on line 87 `makeMarketplaceUpdateHandler`:** the existing factory at `edge/handlers/marketplace/update.ts:26-66` takes `deps: EdgeDeps` and constructs both `updateMarketplace({...})` and `updateAllMarketplaces({...})` calls. To thread `pi` for the orchestrator's `notify()` probe, EITHER (a) change the factory signature to `makeMarketplaceUpdateHandler(pi, deps)` and update line 87 in register.ts, OR (b) extend `EdgeDeps` with `pi: ExtensionAPI` and thread through `deps.pi`. Option (a) matches the established `pi-as-first-arg` factory pattern (`makeInstallHandler(pi)`, `makeRemoveHandler(pi)`); option (b) keeps register.ts minimal but invents a new `EdgeDeps.pi` shape. Recommend (a) for consistency.

**Data flow:** `register.ts:75` already receives `pi: ExtensionAPI` as parameter and threads it into 8 of the 13 handler factories today. Wave 0 extends the threading to the remaining 3 marketplace handlers (add, autoupdate, list) + makes the update handler factory `pi`-aware.

---

### `tests/orchestrators/marketplace/add.test.ts` (test, byte-exact V2 assertions)

**Analog:** existing test file's own `makeCtx()` pattern preserved per D-18-06; assertion form mirrors `tests/shared/notify-v2.test.ts:189-214` per-variant baselines.

**V1 pattern present today (lines 24-40 + 91 + 94 + 295 + 373):**

```typescript
interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (msg: string, sev?: string): void => {
        notifications.push(sev === undefined ? { message: msg } : { message: msg, severity: sev });
      },
    },
    pi: { getAllTools: (): unknown[] => [] },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}

// V1 byte assertion (line 91)
assert.equal(note.message, "● valid-marketplace [project] <autoupdate> (added)");

// V1 reload-hint negative assertion (line 94)
assert.equal(note.message.includes("/reload to pick up changes"), false);
```

**V2 reference (assertion form mirroring `tests/shared/notify-v2.test.ts:211-213`):**

```typescript
// V2 byte assertion (line 91 flip)
assert.equal(note.message, "● valid-marketplace [project] (added)\n\n/reload to pick up changes");

// V2 reload-hint POSITIVE assertion (line 94 flip per D-18-06 implicit consequence)
assert.equal(note.message.includes("/reload to pick up changes"), true);
```

**Data flow:**
- **Mock pi:** `ctx.pi: { getAllTools: () => [] }` already exists on the mock at line 37. The test must now pass `pi` into `addMarketplace({...})` -- either by destructuring `ctx.pi` from the mock or by constructing a separate `pi` reference.
- **Recommended pattern:** add `pi: ctx.pi` (or extract `const pi = ctx.pi as unknown as ExtensionAPI;`) into the call site:
  ```typescript
  const { ctx, notifications } = makeCtx();
  await addMarketplace({
    ctx,
    pi: (ctx as unknown as { pi: ExtensionAPI }).pi,  // mock-pi pass-through
    scope: "project",
    cwd,
    rawSource: "anthropics/claude-plugins-official",
    gitOps,
  });
  ```
- **Net change:** 4 byte-string flips + 1 boolean reload-hint flip + add `pi: ctx.pi` to every `addMarketplace({...})` call site (~13 sites per `grep -c "addMarketplace({"`).

---

### `tests/orchestrators/marketplace/autoupdate.test.ts` (test, V2 + Phase 17.1 5-state grammar)

**Analog:** same `makeCtx()` pattern; assertion form mirrors `tests/shared/notify-v2.test.ts` skipped variant for warning-severity rows.

**V2 byte flips (per 18-RESEARCH §Per-File Test Surface):**

| Line | V1 assertion | V2 assertion |
|------|--------------|--------------|
| 92 | `"● mp [project] <autoupdate>"` | `"● mp [project] (autoupdate enabled)\n\n/reload to pick up changes"` |
| 108 | `"● mp [project] <no autoupdate>"` | `"● mp [project] (autoupdate disabled)\n\n/reload to pick up changes"` |
| 124 | `"● mp [project] <autoupdate> {already enabled}"` | `"● mp [project] (skipped) {already enabled}"` + severity `"warning"` |
| 138 | `"● mp [project] <no autoupdate> {already disabled}"` | `"● mp [project] (skipped) {already disabled}"` + severity `"warning"` |
| 155 | `"● mp [project] <autoupdate>"` | `"● mp [project] (autoupdate enabled)\n\n/reload to pick up changes"` |
| 169 | `"● mp [project] <no autoupdate> {already disabled}"` | `"● mp [project] (skipped) {already disabled}"` + severity `"warning"` |
| 221 | `"● only [user] <autoupdate>"` | `"● only [user] (autoupdate enabled)\n\n/reload to pick up changes"` |

**New severity assertions (per D-18-05 ladder):**
- Idempotent flips: `assert.equal(note.severity, "warning")`.
- Fresh flips: `assert.equal(note.severity, undefined)` (info).
- Not-found errors: `assert.equal(note.severity, "error")`.

---

### `tests/orchestrators/marketplace/list.test.ts` (test)

**Analog:** SELF -- current assertions already match V2 catalog list-surface byte form per 18-RESEARCH §Per-File Test Surface.

**Net assertion change:** ~0 byte flips required. Optional: add a new test that constructs a record with `lastUpdatedAt` set, asserts the byte includes `<last-updated <iso>>` (catalog `tests/architecture/catalog-uat.test.ts:1094` reference). Add `pi: ctx.pi` to every `listMarketplaces({...})` call site.

---

### `tests/orchestrators/marketplace/remove.test.ts` (test)

**Analog:** catalog UAT `clean` + `partial` fixtures (`tests/architecture/catalog-uat.test.ts:1155-1183`).

**V2 byte flips (per 18-RESEARCH §Per-File Test Surface):**

| Line | V1 assertion | V2 assertion |
|------|--------------|--------------|
| 154 | `"● dup-name [project] (removed)"` | `"● dup-name [project] (removed)\n\n/reload to pick up changes"` (reload-hint fires from mp.status `"removed"`) |
| 187 | `"● user-only [user] (removed)"` | `"● user-only [user] (removed)\n\n/reload to pick up changes"` |
| 259 | `note.message.includes("/reload to pick up changes") === false` | `=== true` (contract change per D-16-12; test rename: "MR-2 + V2 D-16-12: empty marketplace removed cleanly emits success WITH mp-level reload-hint") |
| 262 | `"● empty [project] (removed)"` | `"● empty [project] (removed)\n\n/reload to pick up changes"` |
| 388 | `severity === "warning"` | `=== "error"` (cascade partial has mp.status=`failed`; any failed -> error per D-16-11) |
| 389-392 | `=~ /Fix the underlying issue and retry\.?$/` | DELETE assertion (retry-anchor dropped per D-17-09 / D-18-03) |

**Cleanup-leak tests:** none currently exist (cleanup-leak path was untested). No tests to delete.

---

### `tests/orchestrators/marketplace/update.test.ts` (test)

**Analog:** catalog UAT `mixed-outcomes` fixture (`tests/architecture/catalog-uat.test.ts:1197-1224`) for cascade shape; `mp-failure-network` for bare mp failure.

**V2 byte flips (per 18-RESEARCH §Per-File Test Surface):**

| Line | V1 assertion | V2 assertion |
|------|--------------|--------------|
| 163 | `assert.notEqual(first.severity, "error")` | KEEP + ADD `assert.equal(first.severity, undefined)` + `assert.match(first.message, /\/reload to pick up changes/)` (manifest-refresh now emits reload-hint per D-16-12) |
| 271 | `=~ /Retry the command\./` | DELETE + flip to `first.message === "⊘ rewritten [project] (failed)"` (D-18-02 drops retry-hint) |
| 291 | `includes("Retry the command.") === false` | DELETE + flip to `first.message === "⊘ offline [project] (failed)"` |
| 328 | `=~ /Retry the command\./` | DELETE + flip per line 271 pattern |
| 514-517 | `"  ● b [project]"`, `"  ● c [project]"` (unchanged outcomes) | flip to `"  ⊘ b [project]"`, `"  ⊘ c [project]"` (glyph flip ● -> ⊘ per D-18-03; V2 catalog mixed-outcomes shows `⊘ beta (skipped) {up-to-date}`) |
| 514 | `"  ● a [project]"` | needs new byte derived from catalog: `  ● alpha 0.5.0 → v1.0.0 (updated)` (version-arrow now rendered by V2 `renderPluginRow`) -- cross-reference `tests/shared/notify-v2.test.ts:267` for the authoritative form |
| 692-757 | `__test_outcomeToCascadeRow` unit tests | rewrite to assert against `__test_outcomeToCascadePluginMessage` returning `PluginNotificationMessage` (planner choice: rename + rewrite, or delete and re-derive in fresh tests) |

---

### `eslint.config.js` (MSG-Block 1 + 1b narrowing)

**Analog A (additive `ignores:` precedent):** `eslint.config.js:209-216` (MSG-Block 3 with `files: + ignores:` pair for `persistence/migrate.ts`).
**Analog B (bounded-window precedent landed Phase 16):** `eslint.config.js:231-245` (MSG-Block 4a adds `shared/notify.ts` to existing `ignores: []` array -- the exact narrowing shape Phase 18 extends, and the exact shape Phase 21 will reverse).

**V1 pattern present today (lines 151-188):**

```javascript
{
  // MSG-Block 1 (MSG-SR-1..6): cascade/severity routing -- orchestrators surface.
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-sr-1-success-routing": "error",
    "msg/msg-sr-2-warning-routing": "error",
    "msg/msg-sr-3-error-routing": "error",
    "msg/msg-sr-4-cascade-success": "error",
    "msg/msg-sr-5-cascade-warning": "error",
    "msg/msg-sr-6-no-cascade-error": "error",
  },
},
{
  // MSG-Block 1b (MSG-GR-3): per-scope rendering rule.
  files: [
    "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
    "extensions/pi-claude-marketplace/edge/handlers/**/*.ts",
  ],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-gr-3-per-scope": "error",
  },
},
```

**V2 mirror (insert `ignores:` between `files:` and `plugins:` in BOTH blocks):**

```javascript
{
  // MSG-Block 1 (MSG-SR-1..6): cascade/severity routing -- orchestrators surface.
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],  // <-- ADD
  plugins: { msg: msgPlugin },
  rules: { /* ... unchanged ... */ },
},
{
  // MSG-Block 1b (MSG-GR-3): per-scope rendering rule.
  files: [
    "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
    "extensions/pi-claude-marketplace/edge/handlers/**/*.ts",
  ],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],  // <-- ADD
  plugins: { msg: msgPlugin },
  rules: { /* ... unchanged ... */ },
},
```

**Data flow:**
- **Inputs:** one path glob (`orchestrators/marketplace/**`).
- **Effect:** MSG-Block 1's 6 severity-routing rules + MSG-Block 1b's per-scope rule stop firing on the migrated marketplace family. Other 6 MSG-Blocks (2, 3, 4a, 4b, 5, 6) are unaffected.
- **Net edit:** 2 lines inserted; ENTIRE eslint.config.js diff for Phase 18.

---

## Shared Patterns

### V2 `notify()` signature contract

**Source:** `extensions/pi-claude-marketplace/shared/notify.ts:1144-1175`
**Apply to:** Every Wave 1/Wave 2 orchestrator notify call.

```typescript
export function notify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  message: NotificationMessage,
): void {
  const probe = softDepStatus(pi);                                       // D-16-14: single probe per call
  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
  const body = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";
  const withHint = hint === "" ? body : `${body}\n\n${hint}`;
  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(withHint);
  } else {
    ctx.ui.notify(withHint, severity);
  }
}
```

**Discipline:**
- Construct the `NotificationMessage` payload structurally.
- Pass it to `notify(ctx, pi, message)` once per orchestration outcome.
- Renderer owns severity, reload-hint, soft-dep marker, indent, sort, blank-line discipline.

### `pi: ExtensionAPI` plumbing (Wave 0)

**Source pattern:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:102-119`
**Apply to:** `add.ts`, `autoupdate.ts`, `list.ts` Options interfaces; `update.ts` makes optional `pi?` -> required `pi`.

```typescript
export interface XOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- carries `getAllTools()` for RH-5 soft-dep probes. */
  readonly pi: ExtensionAPI;
  // ... other fields ...
}
```

Imports: `import type { ExtensionAPI } from "../../platform/pi-api.ts";` (orchestrator side) or `from "../../../platform/pi-api.ts"` (edge handler side).

### `MarketplaceNotificationMessage` construction recipes (Wave 1 pilot establishes)

**Source pattern:** `tests/architecture/catalog-uat.test.ts:1085-1292` (one fixture per `(section, state)` cell of the marketplace family).

**Recipe per surface:**

1. **State-change success (single mp, no plugins):**
   ```typescript
   { marketplaces: [{ name, scope, status: "<added|removed|updated>", plugins: [] }] }
   ```

2. **State-change with cascade (mp + per-plugin):**
   ```typescript
   {
     marketplaces: [{
       name, scope, status: "<added|updated|failed>",
       plugins: [
         { status: "<uninstalled|updated|skipped|failed>", name, ...payload },
         // ...
       ],
     }],
   }
   ```

3. **List surface (no `mp.status`; optional `details`):**
   ```typescript
   {
     marketplaces: allRecords.map(r => ({
       name: r.name, scope: r.scope,
       ...(r.autoupdate !== undefined || r.lastUpdatedAt !== undefined
         ? { details: { autoupdate: r.autoupdate ?? false, ...(r.lastUpdatedAt && { lastUpdatedAt: r.lastUpdatedAt }) } }
         : {}),
       plugins: [],
     })),
   }
   ```

4. **Empty sentinel:**
   ```typescript
   { marketplaces: [] }   // renders `(no marketplaces)`
   ```

5. **Idempotent skip (autoupdate.ts only, Phase 17.1):**
   ```typescript
   { marketplaces: [{ name, scope, status: "skipped", reasons: ["already enabled"|"already disabled"], plugins: [] }] }
   ```

### `makeCtx()` test helper (preserve verbatim per D-18-06)

**Source:** `tests/orchestrators/marketplace/add.test.ts:24-40`, `tests/orchestrators/marketplace/autoupdate.test.ts:20-36` (identical pattern).
**Apply to:** Every Phase 18 orchestrator test.

```typescript
interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi: { getAllTools: (): unknown[] => [] },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}
```

**Wave 0 consequence:** Every test call site of an orchestrator now needs `pi:` -- pass `ctx.pi` cast to `ExtensionAPI`, OR construct a separate `const pi = { getAllTools: () => [] } as unknown as ExtensionAPI` and pass both.

**Soft-dep edge cases:** for tests that need to flip the probe (e.g., a `requires pi-subagents` marker assertion), supply a non-empty `getAllTools()`: see `tests/shared/notify-v2.test.ts:154-178` (`piWithBothLoaded` / `piWithSubagentsLoaded` / `piWithMcpLoaded` / `piWithNothingLoaded` helpers).

### Bounded MSG-* lint narrowing precedent (Phase 16)

**Source:** `eslint.config.js:231-245` (MSG-Block 4a's bounded-window `shared/notify.ts` ignore for Phase 16 v1.4).
**Apply to:** Phase 18's plan 18-06 adds the same shape to MSG-Block 1 + 1b.

```javascript
// Phase 16 v1.4 bounded-window addition: shared/notify.ts is the V2 renderer
// chokepoint (SNM-12 / SNM-15 / D-16-09 / D-16-12) and houses the duplicated
// `RELOAD_HINT_TRAILER = "/reload to pick up changes"` literal consumed by its
// file-private `shouldEmitReloadHint`-gated append discipline inside the public
// `notify()` (plan 05). The duplication is intentional (D-16-04) and ends in
// Phase 21 when V1 wrappers + presentation/* composers are deleted together;
// this ignore can be removed at the same time as the reload-hint.ts entry above.
files: ["extensions/pi-claude-marketplace/**/*.ts"],
ignores: [
  "extensions/pi-claude-marketplace/presentation/manual-recovery.ts",
  "extensions/pi-claude-marketplace/presentation/rollback-partial.ts",
  "extensions/pi-claude-marketplace/presentation/reload-hint.ts",
  "extensions/pi-claude-marketplace/shared/notify.ts",
],
```

**Discipline:** the `ignores:` array is additive across phases. Phase 18 adds `orchestrators/marketplace/**` to MSG-Block 1+1b; Phase 19 will extend with `orchestrators/plugin/**`; Phase 20 with `orchestrators/edge/**` + removes MSG-Block 1b's `edge/handlers/**` glob; Phase 21 deletes the entire MSG-* plugin wiring.

### Catalog UAT byte-equality gate (Phase 17)

**Source:** `tests/architecture/catalog-uat.test.ts:1078-1292` (marketplace family fixtures).
**Apply to:** Phase 18's plan 18-06 verifies catalog UAT GREEN end-to-end after every wave.

**Discipline:** the catalog UAT is the BINDING USER-CONTRACT gate. Per-orchestrator tests (D-18-06) provide construction-bug detection with byte gates; catalog UAT provides renderer-bug detection and grammar drift detection. Both must stay GREEN.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | Every Phase 18 file modification has either a direct catalog-UAT V2 fixture analog OR a sibling-orchestrator pi-plumbing analog. The pilot status of Wave 1 means no already-migrated orchestrator source exists, but the catalog UAT fixtures (`tests/architecture/catalog-uat.test.ts:1085-1292`) are functionally equivalent V2-payload analogs since they drive the same `notify(ctx, pi, message)` entry point end-to-end. |

---

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{add,autoupdate,list,remove,update,shared}.ts`
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/{add,autoupdate,list,remove,update}.ts`
- `extensions/pi-claude-marketplace/edge/register.ts`
- `extensions/pi-claude-marketplace/shared/notify.ts` (lines 220-526, 965-1175 -- V2 contract surface)
- `extensions/pi-claude-marketplace/platform/pi-api.ts` (lines 15-25 -- ExtensionAPI re-export)
- `tests/orchestrators/marketplace/{add,autoupdate,list,remove,update}.test.ts`
- `tests/shared/notify-v2.test.ts` (lines 130-400 -- per-variant V2 byte assertion baselines)
- `tests/architecture/catalog-uat.test.ts` (lines 1078-1292 -- marketplace-family V2 fixture payloads)
- `eslint.config.js` (lines 145-265 -- MSG-Block 1/1b/3/4a structures)

**Files scanned:** 19

**Pattern extraction date:** 2026-05-26
