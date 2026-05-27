# Phase 19: Migration Wave 2 -- Plugin Orchestrator Family - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 11 (5 orchestrators + 5 tests + 1 lint config)
**Analogs found:** 11 / 11

Every Phase 19 file modification has a direct Phase 18 sibling analog landed
2026-05-27 on `gsd/v1.3-replan-catalog`. No new files are created. The pattern
stack is uniform across all 5 per-file plans (19-01..05); each plan substitutes
the orchestrator's specific discriminator set (uninstalled / installed /
updated / reinstalled / failed / skipped / manual-recovery / available /
unavailable / upgradable). Plan 19-06 (lint) is a 1-line additive extension
to the same `ignores: [...]` arrays Phase 18 introduced.

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | orchestrator (emission migration; Wave 1 pilot) | request-response single-shot + cause-chain | `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (pilot precedent) | exact -- both Wave 1 pilots with embedded recipe block-comment |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | orchestrator (emission migration; rollback-partial inline construction) | request-response single-shot + 5 dropped post-success warnings + structural rollback-partial | `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (partial-failure precedent with per-row `cause` + `reasons[]`) | role-match -- partial-failure shape transfers; rollback-partial is install.ts-specific |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | orchestrator (emission migration; list surface + dropped PROBE_FAILURES summary) | request-response read-only list surface | `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` | exact -- list surface variant set + reload-hint suppression |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | orchestrator (emission migration; cascade + manual-recovery anchor + dispatch ternary retirement) | request-response cascade (multi-plugin) | `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (CMC-31 cascade `plugins[]` mixing variants) | role-match -- cascade plugins[] construction transfers; manual-recovery row is reinstall.ts-specific |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | orchestrator (emission migration; cascade + version-arrow + dispatch ternary retirement + aggregate-failure direct paths) | request-response cascade (multi-plugin) + aggregate-failure direct-paths | `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` (cascade + dispatch retirement) | role-match -- cascade transfer; aggregate-failure direct-path is update.ts-specific Claude's-Discretion |
| `tests/orchestrators/plugin/uninstall.test.ts` | test (byte-exact V2 assertion rewrite) | unit-test request-response | `tests/orchestrators/marketplace/add.test.ts` | exact |
| `tests/orchestrators/plugin/install.test.ts` | test (byte-exact V2 assertion rewrite + dropped-warning deletion) | unit-test request-response | `tests/orchestrators/marketplace/add.test.ts` + `remove.test.ts` (partial-failure assertions) | role-match |
| `tests/orchestrators/plugin/list.test.ts` | test (byte-exact V2 assertion rewrite + dropped-PROBE_FAILURES deletion) | unit-test request-response | `tests/orchestrators/marketplace/list.test.ts` | exact |
| `tests/orchestrators/plugin/reinstall.test.ts` | test (byte-exact V2 cascade assertion rewrite + dropped-warning deletion) | unit-test cascade | `tests/orchestrators/marketplace/remove.test.ts` (cascade `notifications.length === 1` + severity=error) | role-match |
| `tests/orchestrators/plugin/update.test.ts` | test (byte-exact V2 cascade assertion rewrite + dropped-warning deletion) | unit-test cascade | `tests/orchestrators/marketplace/update.test.ts` | exact |
| `eslint.config.js` | config (lint narrowing -- additive `ignores` entry) | static config | `eslint.config.js` lines 160 + 185 (the entry introduced by Phase 18 Plan 18-06) | exact -- same array, 1 path string added |

## Pattern Assignments

### (a) Orchestrator Emission Migration -- Phase 18 `add.ts` Pilot Analog

**Applies to:** `orchestrators/plugin/{uninstall,install,list,reinstall,update}.ts`
**Analog source:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`

#### Imports pattern (add.ts lines 65-66, plus type imports throughout)

```typescript
import { notify } from "../../shared/notify.ts";
// V1 wrappers (notifySuccess / notifyWarning / notifyError) and any
// presentation/* composers (cause-chain, manual-recovery, rollback-partial,
// version-arrow, cascade-summary, reload-hint, compact-line, sort) -- all
// DROPPED from the import list per the per-file plan.

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
// Plus per-file variant types from shared/notify.ts as needed:
//   PluginUninstalledMessage, PluginInstalledMessage, PluginUpdatedMessage,
//   PluginReinstalledMessage, PluginFailedMessage, PluginSkippedMessage,
//   PluginManualRecoveryMessage, PluginAvailableMessage,
//   PluginUnavailableMessage, PluginUpgradableMessage
```

#### Options-interface `pi` field (add.ts lines 76-95)

```typescript
export interface AddMarketplaceOptions {
  readonly ctx: ExtensionContext;
  /**
   * Factory `pi` reference. Plumbed in Plan 18-00 (Wave 0) so subsequent
   * Wave 1/2 migrations can swap V1 notify-wrappers for V2
   * `notify(ctx, pi, message)` calls without re-touching this signature
   * or `edge/register.ts`.
   */
  readonly pi: ExtensionAPI;
  readonly scope: Scope;
  // ... rest of options ...
}
```

**Phase 19 specifics:** Every plugin orchestrator already accepts
`readonly pi: ExtensionAPI` (RESEARCH.md verification line 559-564). No
Wave 0 plumbing plan needed; signatures are untouched.

#### Pilot recipe block-comment (add.ts lines 160-169)

```typescript
// NotificationMessage construction recipe (Plan 18-01 pilot; Wave 2 mirrors).
// - One MarketplaceNotificationMessage per outcome, emitted via one
//   notify(opts.ctx, opts.pi, ...) call; `plugins: []` is required.
// - Discriminator here: `mp.status === "added"` (github + path collapse
//   to one V2 shape; V1 `<autoupdate>` marker moved to the list surface).
// - Severity (info; no 2nd arg) and `/reload to pick up changes` are
//   computed by notify() per D-16-11 + D-16-12; callers MUST NOT compose.
// - Reference: catalog UAT `path-source` + `github-source` fixtures at
//   tests/architecture/catalog-uat.test.ts:1113-1133. Per D-18-08-amend,
//   Wave 2 (18-02..05) mirrors this with its own mp.status values.
```

**Phase 19 Plan 19-01 substitution (pilot for plugin family):** rewrite the
recipe to describe plugin-cascade construction. Header reads
`NotificationMessage cascade recipe (Plan 19-01 pilot; Wave 2 mirrors).`;
discriminator section enumerates the per-file plugin status set
(uninstalled / installed / updated / reinstalled / failed / skipped /
manual-recovery / available / unavailable / upgradable); reference points
to `docs/output-catalog.md:340-378` (plugin uninstall fixtures). Wave 2
plans (19-02..05) locate it via
`grep -n "NotificationMessage cascade recipe" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`.

#### Single-`notify()`-call construction pattern (add.ts lines 170-179)

```typescript
notify(opts.ctx, opts.pi, {
  marketplaces: [
    {
      name: recordedName,
      scope: opts.scope,
      status: "added",
      plugins: [],
    },
  ],
});
```

**Single-shot plugin variant** (Plan 19-01 success case, mirrors structure):

```typescript
notify(opts.ctx, opts.pi, {
  marketplaces: [
    {
      name: marketplaceName,
      scope: opts.scope,
      // status: omitted -- marketplace header is a bare label row
      // per docs/output-catalog.md:340-348 (plugin uninstall success).
      plugins: [
        {
          status: "uninstalled",
          name: pluginName,
          ...(version !== undefined && { version }),
        },
      ],
    },
  ],
});
```

#### Cascade-with-mixed-variants pattern (remove.ts lines 296-326)

The partial-failure cascade in `marketplace/remove.ts` is the structural
analog for Plans 19-02 (install.ts -- failure path with rollback-partial),
19-04 (reinstall.ts -- cascade `plugins[]` mixing reinstalled / skipped /
failed / manual-recovery), and 19-05 (update.ts -- cascade `plugins[]`
mixing updated / skipped / failed):

```typescript
// NotificationMessage construction recipe (Plan 18-04; mirrors the
// Wave 1 pilot at orchestrators/marketplace/add.ts:160-169).
// - One MarketplaceNotificationMessage per outcome, emitted via one
//   notify(opts.ctx, opts.pi, ...) call; `plugins: []` is required.
// - V2 cascade per D-18-03: per-plugin `PluginFailedMessage.cause`
//   renders at 4-space indent via renderPluginRow (D-16-08). The V1
//   marketplace-level `causeChainTrailer(err)` body is GONE.
// - V1 `RETRY_ANCHOR` ("Fix the underlying issue and retry.") is
//   DROPPED per D-17-09 (already excluded by the Phase 17 catalog).
// - Severity (error on partial, info on clean) and `/reload to pick up
//   changes` are computed by notify() per D-16-11 + D-16-12; callers
//   MUST NOT compose.
// - Reference: catalog UAT `clean` + `partial` fixtures at
//   tests/architecture/catalog-uat.test.ts:1154-1183.
if (failedPlugins.length > 0) {
  notify(opts.ctx, opts.pi, {
    marketplaces: [
      {
        name: opts.name,
        scope: resolved.scope,
        status: "failed",
        plugins: [
          ...successfullyUnstaged.map(
            (name): PluginUninstalledMessage => ({
              status: "uninstalled",
              name,
            }),
          ),
          ...failedPlugins.map(
            ({ name, cause }): PluginFailedMessage => ({
              status: "failed",
              name,
              reasons: [narrowCascadeFailure(cause)],
              cause,
            }),
          ),
        ],
      },
    ],
  });
  return;
}
```

**Phase 19 Plan 19-04 (reinstall.ts) substitution:** replace
`PluginUninstalledMessage` mapping with `PluginReinstalledMessage` /
`PluginSkippedMessage` / `PluginManualRecoveryMessage` mappings derived from
each `ReinstallPluginOutcome[]`. The manual-recovery anchor variant slots into
the same `plugins[]` array (NOT a separate top-level emission per D-19-02).

**Phase 19 Plan 19-05 (update.ts) substitution:** add
`PluginUpdatedMessage` with required `from`/`to` per D-15-04.

**Phase 19 Plan 19-02 (install.ts) substitution:** the
`PluginFailedMessage.rollbackPartial` field (lines 424-427 of `shared/notify.ts`)
carries `readonly { phase: string; cause?: Error }[]` -- thread
`p.cause` directly from `RollbackPartial.cause?: Error` (the ledger already
exposes it; see Pitfall 1 in RESEARCH.md). No `new Error(p.msg)` synthesis.

#### Cause-chain pattern (no orchestrator-level composition)

The V1 `causeChainTrailer(err)` body is GONE. The renderer handles 4-space
indent cause-chain rendering from `PluginFailedMessage.cause?: Error` and
`PluginManualRecoveryMessage.cause?: Error` per D-16-08. Orchestrators set
the `cause` field directly; they MUST NOT compose token streams.

#### Error handling / dropped post-success warnings (add.ts lines 150-158)

```typescript
try {
  await invalidateMarketplaceNames(locations.marketplaceNamesCacheFile, opts.scope);
  await dropMarketplaceCache(
    await locations.pluginCacheFile(recordedName),
    opts.scope,
    recordedName,
  );
} catch {
  // D-18-01 precedent (Plan 18-01): cache-refresh failures are swallowed
  // silently in V2. The V1 cache-leak warning surface has no clean
  // MarketplaceNotificationMessage representation (it is neither a
  // failed marketplace nor a state-changing success), and emitting a
  // second `notify()` after the primary would double severity routing
  // without a catalog fixture to gate against. The state mutation
  // already succeeded; only the user-facing warning disappears.
}
```

**Phase 19 application (D-19-01 DROP precedent):** every post-success
secondary `notifyWarning` site in the plugin family follows this pattern.
The underlying side-effect call (`mkdir`, `dropMarketplaceCache`, bridge
maintenance, completion-cache refresh, PROBE_FAILURES drain) STAYS inside
the try/catch; only the user-visible `notifyWarning(ctx, msg)` line is
removed. Explanatory comment cites `D-19-01 precedent (D-18-01 lineage)`
and the specific dropped surface.

---

### (b) Test Migration -- Phase 18 `add.test.ts` Analog

**Applies to:** `tests/orchestrators/plugin/{uninstall,install,list,reinstall,update}.test.ts`
**Analog source:** `tests/orchestrators/marketplace/add.test.ts`

#### Imports pattern (add.test.ts lines 1-23)

```typescript
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { addMarketplace } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
// ... orchestrator-specific imports ...
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}
```

**Phase 19 carry-forward:** existing plugin test files already have this
exact import block plus a per-orchestrator `NotifyRecord` interface
(RESEARCH.md line 518-523 confirms `uninstall.test.ts:44-66`). No
restructuring needed; only V1-string assertions flip to V2 strings.

#### `makeCtx()` helper shape (add.test.ts lines 29-45)

```typescript
function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  // Plan 18-00: `pi` is required on every marketplace orchestrator's
  // `*Options` interface. Mirror the production wiring shape so tests
  // can pass the same value the edge layer would. The empty
  // `getAllTools()` mirrors the existing makeCtx pattern (D-18-06).
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (msg: string, sev?: string): void => {
        notifications.push(sev === undefined ? { message: msg } : { message: msg, severity: sev });
      },
    },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
}
```

**Phase 19 carry-forward (D-19-07 inherits D-18-06):** plugin test files
already use a structurally equivalent `makeCtx()` (RESEARCH.md notes the
plugin variant does NOT attach `pi` to `ctx.pi` -- this difference is
harmless because `notify(ctx, pi, message)` consumes `pi` from its second
positional arg; both forms work). Phase 19 preserves the existing form
verbatim; helper extraction deferred to Phase 21.

#### Byte-equality assertion pattern (add.test.ts lines 92-107)

```typescript
// Exactly one notification, V2 byte-for-byte; default severity (info; no
// 2nd arg per D-16-11).
assert.equal(notifications.length, 1);
const note = notifications[0];
assert.ok(note);
// Plan 18-01 / D-18-06: V2 catalog `<!-- catalog-state: github-source -->`
// collapses github + path source onto one `(added)` shape with the
// `/reload to pick up changes` trailer (D-16-12). The V1 `<autoupdate>`
// marker has moved off this surface onto the list-surface header.
assert.equal(
  note.message,
  "● valid-marketplace [project] (added)\n\n/reload to pick up changes",
);
assert.equal(note.severity, undefined);
// D-18-06 implicit consequence: reload-hint flips POSITIVE for github
// source under V2 (mp.status `"added"` is state-changing per D-16-12).
assert.equal(note.message.includes("/reload to pick up changes"), true);
```

**Phase 19 substitution:** byte strings come from `docs/output-catalog.md`
plugin sections (lines 133-568) or from `tests/shared/notify-v2.test.ts`
per-variant fixtures when an edge-case isn't in the catalog. The
`assert.equal(notifications.length, 1)` and severity-undefined / "error"
patterns transfer verbatim.

#### Dropped-warning count assertion pattern (remove.test.ts line 404)

```typescript
// Exactly ONE V2 notification, severity=error (any plugin/mp failed
// routes to error per D-16-11; the V1 free-text retry-anchor
// ("Fix the underlying issue and retry.") is DROPPED per D-17-09 /
// D-18-03 -- it has no V2 catalog representation).
assert.equal(notifications.length, 1, "exactly one V2 notification");
assert.equal(notifications[0]!.severity, "error", "severity must be error");
```

**Phase 19 application (D-19-07 test-count consequence of D-19-01):**
plugin tests with `notifications.length === 2` (success + dropped post-success
warning) flip to `notifications.length === 1`. Tests targeting a dropped
warning's CONTENT (e.g., "data dir creation deferred" string assertion) are
DELETED outright. The planner identifies these per-file by `grep`-ing for
the dropped surface's message fragment.

---

### (c) Lint Narrowing -- Phase 18 Plan 18-06 Entry

**Applies to:** `eslint.config.js`
**Analog source:** `eslint.config.js` lines 151-190 (the same file, same arrays)

#### Current state of MSG-Block 1 (line 160) -- inserted by Plan 18-06

```javascript
{
  // MSG-Block 1 (MSG-SR-1..6): cascade/severity routing -- orchestrators
  // surface. Every notify* call site lives under orchestrators/ (edge/
  // has the separate MSG-SR-7 usage-error variant in Block 2). MSG-GR-3
  // is wired separately below across BOTH surfaces (orchestrators/ and
  // edge/handlers/) since Phase 14.2-fix CR-01 surfaced a user-first
  // iteration literal in `edge/handlers/plugin/import.ts:45` that the
  // orchestrator-only glob missed.
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts"],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],  // line 160
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
```

#### Current state of MSG-Block 1b (line 185) -- inserted by Plan 18-06

```javascript
{
  // MSG-Block 1b (MSG-GR-3): per-scope rendering rule. Promoted out of
  // the meta-assertion bag in Phase 14.2 (D-14-2-08 supersedes D-14-09)
  // as an active AST check ...
  files: [
    "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
    "extensions/pi-claude-marketplace/edge/handlers/**/*.ts",
  ],
  ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"],  // line 185
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-gr-3-per-scope": "error",
  },
},
```

#### Plan 19-06 target state (D-19-08 -- additive 1 string per array)

```javascript
// MSG-Block 1 (line 160) -- extend ignores
ignores: [
  "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
  "extensions/pi-claude-marketplace/orchestrators/plugin/**",
],

// MSG-Block 1b (line 185) -- extend ignores identically
ignores: [
  "extensions/pi-claude-marketplace/orchestrators/marketplace/**",
  "extensions/pi-claude-marketplace/orchestrators/plugin/**",
],
```

**No other MSG-Block modifications.** Block 1b's `files: [..., "edge/handlers/**"]`
entry is untouched (Phase 20 territory). Blocks 2, 3, 4a, 4b, 5, 6 untouched.

**Verification commands (SC #2):**
```bash
grep -c "orchestrators/plugin/\*\*" eslint.config.js   # expect 2
grep -c "orchestrators/marketplace/\*\*" eslint.config.js   # expect 2 (unchanged)
```

---

### (d) Cascade-Construction Precedent -- Catalog UAT Fixture + Type Definition

**Applies to:** Plan 19-01 (uninstall pilot single-shot), Plan 19-02 (install
failure-path inline construction), Plan 19-04 (reinstall cascade), Plan 19-05
(update cascade). The Phase 18 marketplace family is single-shot per-marketplace;
the closest precedent for **plugin-cascade construction** is the catalog UAT
fixture map shape itself (which is effectively a reference implementation each
orchestrator can pattern-match against) plus the type definitions in
`shared/notify.ts`.

**Analog source A:** `tests/architecture/catalog-uat.test.ts` -- the FIXTURES
map (lines 216 onward) keyed by command + state, each entry a runnable
`NotificationMessage` that round-trips through `notify()` byte-equal to the
catalog block.

#### Plugin-uninstall single-shot success fixture (catalog-uat.test.ts lines 533-545)

```typescript
"/claude:plugin uninstall <plugin>@<marketplace>": {
  success: {
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [{ status: "uninstalled", name: "helper", version: "1.0.0" }],
        },
      ],
    },
  },
```

**Plan 19-01 pilot reference:** this is the shape the pilot's
`notify(opts.ctx, opts.pi, ...)` call must produce. Note that the
marketplace `status` field is OMITTED (no `status: "removed"` -- the
plugin-uninstall surface uses a bare label header per
`docs/output-catalog.md:340-348`), `plugins` carries exactly one
`PluginUninstalledMessage` variant, and the renderer derives severity
(info) + reload-hint from content per D-16-11 + D-16-12.

#### Plugin-uninstall failure-with-cause fixture (catalog-uat.test.ts lines 560-580)

```typescript
"failure-permission-denied": {
  pi: piWithBothLoaded(),
  expectedSeverity: "error",
  message: {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "helper",
            version: "1.0.0",
            reasons: ["permission denied"],
            cause: new Error("EACCES: permission denied, unlink '/path/to/file'"),
          },
        ],
      },
    ],
  },
},
```

**Plan 19-01 pilot reference (failure path at uninstall.ts:160):** the
direct-path failure constructs a `PluginFailedMessage` with `reasons:
readonly Reason[]` derived from the thrown error and `cause: err` threaded
directly. The renderer composes the 4-space cause-chain trailer below the
plugin row per D-16-08. `expectedSeverity: "error"` is the renderer's
content-derived classification per D-16-11 (any failed → error).

**Analog source B:** `extensions/pi-claude-marketplace/shared/notify.ts`
-- the binding type contract.

#### `MarketplaceNotificationMessage` (lines 502-509)

```typescript
export interface MarketplaceNotificationMessage {
  readonly name: string;
  readonly scope: Scope;
  readonly status?: MarketplaceStatus;
  readonly details?: MarketplaceDetails;
  readonly reasons?: readonly Reason[];
  readonly plugins: readonly PluginNotificationMessage[];
}
```

**Construction discipline (D-16-06 caller-order honored):** orchestrators
build `plugins[]` in display order. `notify()` does NOT sort `marketplaces[]`
or `plugins[]`. Existing alphabetic sorts via `compareByNameThenScope` move
into the orchestrator's payload-construction loop where present.

#### `PluginFailedMessage` (lines 417-428) -- carries the structural rollback-partial

```typescript
export interface PluginFailedMessage {
  readonly status: "failed";
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly cause?: Error;
  readonly rollbackPartial?: readonly {
    readonly phase: string;
    readonly cause?: Error;
  }[];
}
```

**Plan 19-02 install.ts mapping (D-19-03 -- `composeRollbackPartialBody`
retired entirely):**

```typescript
// In install.ts post-migration, replace composeRollbackPartialBody with inline:
rollbackPartial: failureRollbackPartials.map((p) => ({
  phase: p.phase,
  ...(p.cause !== undefined && { cause: p.cause }),
})),
```

`p.cause` is the `RollbackPartial.cause?: Error` field already on the ledger
(`transaction/phase-ledger.ts:56-60`). No `new Error(p.msg)` synthesis -- the
CONTEXT.md D-19-03 caveat is resolved in the simpler direction per RESEARCH.md
Finding 1.

#### `PluginManualRecoveryMessage` (lines 452-459) -- structural anchor for reinstall.ts

```typescript
export interface PluginManualRecoveryMessage {
  readonly status: "manual recovery";   // literal string WITH A SPACE
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly cause?: Error;
}
```

**Plan 19-04 reinstall.ts substitution:** the V1 "separate top-level
manual-recovery line below the cascade body" pattern at `reinstall.ts:509-532`
becomes a `PluginManualRecoveryMessage` entry in the SAME `plugins[]` array as
the reinstalled / skipped / failed siblings. Severity routing via
`computeSeverity` classifies the manual-recovery row as `warning` per D-16-11.
The status discriminator is the literal `"manual recovery"` (with a space)
per shared/grammar/status-tokens.ts:47.

---

## Shared Patterns

### Pattern: Renderer-as-spec discipline (D-16-04 inherited)

**Source:** all of `shared/notify.ts` -- the V2 grammar IS this file's
rendering behavior.
**Apply to:** every Phase 19 orchestrator emission.

Orchestrators MUST construct discriminated-union payloads that round-trip
through `notify()` byte-equal to catalog fixtures. NO orchestrator-level
composition of:

- token streams (`●`, `○`, `⊘` markers)
- severity argument (the V2 signature is `notify(ctx, pi, message)` -- 3 args,
  no severity)
- `/reload to pick up changes` trailer (renderer fires per D-16-12 trigger
  ladder from `plugins[]` content)
- `{requires pi-subagents}` soft-dep markers (renderer probes once per
  `notify()` call via `softDepStatus(pi)` per D-16-14)
- cause-chain indentation (renderer handles 4-space below plugin row, 6-space
  below rollback-child per D-16-08)

### Pattern: Single-`notify()`-call-per-orchestration (D-18-01 inherited; expanded by D-19-01)

**Source:** `orchestrators/marketplace/add.ts:170-179`,
`orchestrators/marketplace/remove.ts:300-340` (both single-shot per outcome).
**Apply to:** every Phase 19 orchestrator.

Each orchestration emits EXACTLY ONE `notify()` call with one complete
`NotificationMessage`. No SECOND notify after the primary. Post-success
"soft warnings" with no V2 representation are DROPPED entirely (9 sites
across plugin family per D-19-01: install.ts ×5, list.ts ×1, reinstall.ts
×2, update.ts ×1). Underlying side-effects stay inside their try/catch
blocks; only the `notifyWarning(ctx, msg)` line is removed.

### Pattern: Dropped V1 dispatch ternary (replaced by content-derived severity)

**Source:** the V1 `dispatch = aggregatedSeverity === "warning" ? notifyWarning : notifySuccess`
construct, retired in Phase 18 marketplace migration.
**Apply to:** Plan 19-04 (reinstall.ts:543), Plan 19-05 (update.ts:952).

The cascade dispatch ternary is REMOVED. `notify()`'s content-derived
severity per D-16-11 replaces it (any failed plugin → error; any
manual-recovery → warning; otherwise default/info). The orchestrator becomes
oblivious to severity classification.

### Pattern: Imports cleanup (drop now-orphaned `presentation/*` composers)

**Source:** add.ts diff (Phase 18 Plan 18-01 dropped V1 imports for
`compact-line`, `reload-hint` from add.ts -- visible by inspection of the
current add.ts import block at lines 49-74 -- only `notify` remains from the
notify-family).
**Apply to:** each per-file plan owns its own cleanup.

Per RESEARCH.md State of the Art table, after Phase 19 the following
`presentation/*` modules become orphan-imported (no remaining importers) and
will be deleted in Phase 21:

- `presentation/cause-chain.ts`
- `presentation/manual-recovery.ts`
- `presentation/rollback-partial.ts`
- `presentation/version-arrow.ts`

The following stay alive after Phase 19 (still have non-plugin importers,
notably `orchestrators/import/execute.ts:399`):

- `presentation/compact-line.ts`
- `presentation/reload-hint.ts`
- `presentation/sort.ts`
- `presentation/cascade-summary.ts`

Each Phase 19 per-file plan drops ITS OWN file's imports of the orphan-bound
composers and the cascade-summary composer (where present at reinstall.ts:496
and 1313, update.ts:929).

### Pattern: Test byte-string sourcing

**Source:** `docs/output-catalog.md` (binding user contract) + `tests/shared/notify-v2.test.ts`
(per-variant edge cases).
**Apply to:** every Phase 19 test file rewrite.

Byte strings come PRIMARILY from `docs/output-catalog.md` plugin sections:

| Surface | Catalog lines |
|---------|---------------|
| `/claude:plugin list` | 133-263 |
| `/claude:plugin install` | 265-332 |
| `/claude:plugin uninstall` | 336-377 |
| `/claude:plugin reinstall` | 380-486 |
| `/claude:plugin update` | 489-568 |

When an orchestrator's edge-case shape isn't in the catalog (e.g.
cascade-failure-cause-chain shapes specific to one orchestrator), the
test consults `tests/shared/notify-v2.test.ts` per-variant fixtures
(1141+ lines, 32+ tests).

## No Analog Found

None. Every Phase 19 file has a Phase 18 sibling analog. The minor gaps
(cascade construction not modeled by Phase 18 single-shot marketplace
orchestrators; rollback-partial inline construction unique to install.ts;
manual-recovery anchor unique to reinstall.ts; aggregate-failure direct-path
unique to update.ts) are filled by:

1. The catalog UAT FIXTURES map (`tests/architecture/catalog-uat.test.ts`),
   which is effectively a reference implementation.
2. The type definitions in `extensions/pi-claude-marketplace/shared/notify.ts`,
   which structurally constrain every payload.
3. The per-variant fixtures in `tests/shared/notify-v2.test.ts`.

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{add,remove,list,update,setautoupdate,bootstrap}.ts`
- `tests/orchestrators/marketplace/*.test.ts`
- `eslint.config.js` lines 145-200
- `tests/architecture/catalog-uat.test.ts` lines 200-1500
- `extensions/pi-claude-marketplace/shared/notify.ts` lines 1-550 (types + entry signature)

**Files scanned:** 7 (5 marketplace orchestrators read, 2 marketplace tests
read; 1 catalog UAT test read for FIXTURES shape; 1 eslint config read;
1 shared/notify.ts read for type contracts)

**Pattern extraction date:** 2026-05-27

**Phase 18 lineage commits referenced:**
- Plan 18-01 (marketplace/add.ts pilot recipe) -- the structural template for Plan 19-01
- Plan 18-04 (marketplace/remove.ts cascade with mixed variants) -- the structural template for Plans 19-02 / 19-04 / 19-05
- Plan 18-06 (lint narrowing additive `ignores` entry) -- the structural template for Plan 19-06
