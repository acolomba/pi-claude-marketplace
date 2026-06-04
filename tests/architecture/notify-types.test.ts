// tests/architecture/notify-types.test.ts
//
// Phase 15 / SNM-01..SNM-11 / D-15-10..D-15-12 -- closed-system compile-time
// proof of the v1.4 structured notification type model shipped by Plan 15-01
// in `extensions/pi-claude-marketplace/shared/notify.ts`.
//
// Type-level `_Assert_*` types resolve to `true` when the locked invariants
// hold and `never` when they break; the `export const _<short>: _Assert_* =
// true;` assignment is the load-bearing typecheck. (The `export` keyword is
// required because tsconfig.json sets `noUnusedLocals: true` -- bare `const`
// would fire TS6133 "_<short>' is declared but its value is never read". The
// exports are inert: nothing imports this file at runtime; node:test executes
// it directly.)
//
// Negative-presence assertions use `// @ts-expect-error` per RESEARCH §"Pitfall
// 3" / §"Pattern 3" so a future commit that mistakenly ADDS the absent field
// fires "Unused @ts-expect-error" at typecheck, surfacing the regression.
// The directive suppresses ONLY the immediately-following line; to keep the
// negative-presence indexed access on a single line below the directive (so
// the suppression actually catches the TS2339 it is meant to catch), we first
// extract per-variant `_VInstalled` / `_VUpdated` / ... aliases via `Extract`.
// Negative blocks then read `_VInstalled["cause"]` which fits on one line.
// Variant aliases are unused type aliases -- type aliases are NOT subject to
// `noUnusedLocals` (only values are).
//
// The trailing `test(...)` block with a trivial identity-assert body anchors
// the file to `node:test` so the runner counts it in `npm run check` output
// (D-15-10; mirrors `tests/architecture/grammar-frontmatter.test.ts`).
// Failures of the type-level `_Assert_*` blocks surface through `npm run
// typecheck` (the `check` script's first step), not through `node --test`.
//
// Drift-detection contract: editing `shared/notify.ts` so that the
// `PLUGIN_STATUSES` tuple and the variant `status` literals fall out of sync
// (e.g., typo `status: "instaled"` in `PluginInstalledMessage`) breaks the
// bidirectional `_Assert_PluginStatusForward` / `_Assert_PluginStatusBackward`
// round-trip and fails `npm run typecheck` (RESEARCH §"Pitfall 1").
//
// Discretion (CONTEXT.md "Claude's Discretion"):
//   - One named `_Assert_*` block per invariant (vs. a single conjunction
//     block) -- a single failing block names the broken variant for easier
//     diagnosis instead of a 6-level-deep nested `extends` chain.
//   - Per-variant `_V<Variant>` aliases extracted once at the top of the file
//     so that every `_NoXxx = _V<Variant>["xxx"]` negative-presence block
//     stays on a single line under its `// @ts-expect-error` directive.
//   - `Scope` and `Reason` referenced via inline `import("...").Scope` /
//     `import("...").Reason` type queries (instead of adding them to the
//     top-of-file named imports). Keeps the import block focused on the 11
//     SNM-01..SNM-11 surface symbols.

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEPENDENCIES,
  MARKETPLACE_STATUSES,
  PLUGIN_STATUSES,
  REASONS,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

import type {
  CascadeNotificationMessage,
  Dependency,
  MarketplaceDetails,
  MarketplaceInfoCascadeMessage,
  MarketplaceInfoMessage,
  MarketplaceNotificationMessage,
  MarketplaceStatus,
  NotificationMessage,
  PluginInfoCascadeMessage,
  PluginInfoMessage,
  PluginInfoRow,
  PluginNotificationMessage,
  PluginStatus,
  UsageErrorMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// ============================================================================
// Per-variant aliases (used throughout the file; see file header for why)
// ============================================================================

type _VInstalled = Extract<PluginNotificationMessage, { status: "installed" }>;
type _VUpdated = Extract<PluginNotificationMessage, { status: "updated" }>;
type _VReinstalled = Extract<PluginNotificationMessage, { status: "reinstalled" }>;
type _VUninstalled = Extract<PluginNotificationMessage, { status: "uninstalled" }>;
type _VAvailable = Extract<PluginNotificationMessage, { status: "available" }>;
type _VUnavailable = Extract<PluginNotificationMessage, { status: "unavailable" }>;
type _VUpgradable = Extract<PluginNotificationMessage, { status: "upgradable" }>;
type _VFailed = Extract<PluginNotificationMessage, { status: "failed" }>;
type _VSkipped = Extract<PluginNotificationMessage, { status: "skipped" }>;
type _VManualRecovery = Extract<PluginNotificationMessage, { status: "manual recovery" }>;
// UAT G-21-01 / 21-04-REVIEW.md WR-01: PluginPresentMessage is the 11th
// variant (list-only inventory token introduced to close the reload-hint
// misfire). Its per-variant invariants mirror the `_VInstalled` blocks
// verbatim (dependencies REQUIRED, version OPTIONAL, scope OPTIONAL; no
// cause / rollbackPartial / reasons / from / to).
type _VPresent = Extract<PluginNotificationMessage, { status: "present" }>;

// Cross-module type aliases used in positional `extends` checks below.
type _Scope = import("../../extensions/pi-claude-marketplace/shared/types.ts").Scope;
type _Reason = import("../../extensions/pi-claude-marketplace/shared/notify.ts").Reason;

// ============================================================================
// Closed-set membership (SNM-03, SNM-04, SNM-05, SNM-06, D-15-11)
// ============================================================================

// SNM-04 round-trip: `PluginStatus` IS exactly `PluginNotificationMessage["status"]`.
// BOTH directions are load-bearing -- dropping either side silently allows the
// `PLUGIN_STATUSES` tuple and the variant `status` literals to drift apart
// (RESEARCH §"Pitfall 1").
type _Assert_PluginStatusForward = PluginStatus extends PluginNotificationMessage["status"]
  ? true
  : never;
export const _pf: _Assert_PluginStatusForward = true;

type _Assert_PluginStatusBackward = PluginNotificationMessage["status"] extends PluginStatus
  ? true
  : never;
export const _pb: _Assert_PluginStatusBackward = true;

// D-15-11: PLUGIN_STATUSES tuple length is exactly 11.
// UAT G-21-01: tuple grew from 10 to 11 entries with the addition of the
// list-only `"present"` inventory token (SNM-15 surface tightening).
type _Assert_PluginStatusesLen = (typeof PLUGIN_STATUSES)["length"] extends 11 ? true : never;
export const _l1: _Assert_PluginStatusesLen = true;

// D-17.1-01 (supersedes D-15-07) + D-15-11: MARKETPLACE_STATUSES tuple length is exactly 7.
type _Assert_MarketplaceStatusesLen = (typeof MARKETPLACE_STATUSES)["length"] extends 7
  ? true
  : never;
export const _l2: _Assert_MarketplaceStatusesLen = true;

// SNM-06 + D-15-11: DEPENDENCIES tuple length is exactly 2.
type _Assert_DependenciesLen = (typeof DEPENDENCIES)["length"] extends 2 ? true : never;
export const _l3: _Assert_DependenciesLen = true;

// SNM-03 + D-15-11: `PluginStatus` is EXACTLY the 11 expected literals (no
// more, no fewer). Bidirectional `extends` proves set-equality. UAT G-21-01:
// the trailing `"present"` literal is the list-only inventory token
// introduced to close the reload-hint misfire on `/claude:plugin list`.
type _PluginStatusExpected =
  | "installed"
  | "updated"
  | "reinstalled"
  | "uninstalled"
  | "available"
  | "unavailable"
  | "upgradable"
  | "failed"
  | "skipped"
  | "manual recovery"
  | "present";
type _Assert_PluginStatusValues = _PluginStatusExpected extends PluginStatus
  ? PluginStatus extends _PluginStatusExpected
    ? true
    : never
  : never;
export const _psv: _Assert_PluginStatusValues = true;

// SNM-05 + D-17.1-01 (supersedes D-15-07): `MarketplaceStatus` is EXACTLY the 7 expected literals.
type _MarketplaceStatusExpected =
  | "added"
  | "removed"
  | "updated"
  | "failed"
  | "autoupdate enabled"
  | "autoupdate disabled"
  | "skipped";
type _Assert_MarketplaceStatusValues = _MarketplaceStatusExpected extends MarketplaceStatus
  ? MarketplaceStatus extends _MarketplaceStatusExpected
    ? true
    : never
  : never;
export const _msv: _Assert_MarketplaceStatusValues = true;

// SNM-06: `Dependency` is EXACTLY "agents" | "mcp".
type _DependencyExpected = "agents" | "mcp";
type _Assert_DependencyValues = _DependencyExpected extends Dependency
  ? Dependency extends _DependencyExpected
    ? true
    : never
  : never;
export const _dv: _Assert_DependencyValues = true;

// ============================================================================
// Top-level shape proofs (SNM-01, SNM-02, SNM-07, SNM-08, D-15-05, D-15-06)
// ============================================================================

// SNM-01 (Phase 42 amendment): `NotificationMessage` is the discriminated
// union `CascadeNotificationMessage | MarketplaceInfoMessage |
// PluginInfoMessage`. The cascade arm preserves the SNM-01 single-shape
// envelope contract (`marketplaces: readonly MarketplaceNotificationMessage[]`
// and an optional `kind?: "cascade"` discriminator per Phase 42 / RESEARCH
// Migration Strategy #2). Lock the cascade arm's shape exactly here; the
// new info-surface arms are locked further down.
interface _CascadeMessageExpected {
  readonly kind?: "cascade";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
}
type _Assert_CascadeMessageShape = CascadeNotificationMessage extends _CascadeMessageExpected
  ? _CascadeMessageExpected extends CascadeNotificationMessage
    ? true
    : never
  : never;
export const _nms: _Assert_CascadeMessageShape = true;

// Phase 42 / Migration Strategy #2 backward-compat proof: a value with
// `{ marketplaces: [...] }` and NO `kind` field MUST still type-check as a
// `NotificationMessage`. This locks the optional-`kind?`-on-cascade
// discipline so v1.0-v1.7 call sites (90+ orchestrator / test / fixture
// sites that construct `{ marketplaces: [...] }`) continue to compile
// without migration after the discriminated-union conversion.
type _Assert_CascadeNoKind = {
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
} extends NotificationMessage
  ? true
  : never;
export const _l6: _Assert_CascadeNoKind = true;

// SNM-01: CascadeNotificationMessage has NO `severity` field (severity is
// computed structurally by the Phase 16 renderer; never embedded as a field
// per PRD §6.12 ES-2).
// @ts-expect-error -- SNM-01: CascadeNotificationMessage has NO severity field
export type _NoSeverityOnNotificationMessage = CascadeNotificationMessage["severity"];

// SNM-01: CascadeNotificationMessage has NO top-level `trailer` field
// (reload hint is computed; per-plugin causes live on PluginFailedMessage /
// PluginManualRecoveryMessage per SNM-10).
// @ts-expect-error -- SNM-01: CascadeNotificationMessage has NO trailer field
export type _NoTrailerOnNotificationMessage = CascadeNotificationMessage["trailer"];

// SNM-02 + D-15-06 + Phase 17.1 D-17.1-01 reasons? amendment:
// `MarketplaceNotificationMessage` carries name + scope + optional status +
// optional details + optional reasons + plugins. `status?`, `details?`, and
// `reasons?` are independent optionals.
interface _MarketplaceMessageExpected {
  readonly name: string;
  readonly scope: _Scope;
  readonly status?: MarketplaceStatus;
  readonly details?: MarketplaceDetails;
  readonly reasons?: readonly _Reason[];
  readonly plugins: readonly PluginNotificationMessage[];
}
type _Assert_MarketplaceMessageShape =
  MarketplaceNotificationMessage extends _MarketplaceMessageExpected ? true : never;
export const _mms: _Assert_MarketplaceMessageShape = true;

// SNM-07 + D-15-05: `MarketplaceDetails` has EXACTLY autoupdate (required)
// and lastUpdatedAt? (optional). No `source`, no `version`, no other entries.
interface _MarketplaceDetailsExpected {
  readonly autoupdate: boolean;
  readonly lastUpdatedAt?: string;
}
type _Assert_MarketplaceDetailsShape = MarketplaceDetails extends _MarketplaceDetailsExpected
  ? _MarketplaceDetailsExpected extends MarketplaceDetails
    ? true
    : never
  : never;
export const _mds: _Assert_MarketplaceDetailsShape = true;

// SNM-08: `UsageErrorMessage` has EXACTLY message + usage (both required).
interface _UsageErrorMessageExpected {
  readonly message: string;
  readonly usage: string;
}
type _Assert_UsageErrorMessageShape = UsageErrorMessage extends _UsageErrorMessageExpected
  ? _UsageErrorMessageExpected extends UsageErrorMessage
    ? true
    : never
  : never;
export const _ues: _Assert_UsageErrorMessageShape = true;

// SNM-08: UsageErrorMessage has NO `cause` field (the usage-error path is
// non-cause-bearing; cause chains belong to PluginFailedMessage.cause /
// PluginManualRecoveryMessage.cause per SNM-10).
// @ts-expect-error -- SNM-08: UsageErrorMessage has NO cause field
export type _NoCauseOnUsageError = UsageErrorMessage["cause"];

// SNM-08: UsageErrorMessage has NO `severity` field (severity is always
// "error" -- structural, not a field per PRD §6.12 ES-2).
// @ts-expect-error -- SNM-08: UsageErrorMessage has NO severity field
export type _NoSeverityOnUsageError = UsageErrorMessage["severity"];

// ============================================================================
// Per-variant: cause? (SNM-10 + D-15-12)
//
// Present ONLY on `failed` / `manual recovery`. Absent on the other 8 variants.
// ============================================================================

type _Assert_CauseOnFailed = _VFailed["cause"] extends Error | undefined ? true : never;
export const _cf: _Assert_CauseOnFailed = true;

type _Assert_CauseOnManualRecovery = _VManualRecovery["cause"] extends Error | undefined
  ? true
  : never;
export const _cmr: _Assert_CauseOnManualRecovery = true;

// @ts-expect-error -- SNM-10: installed has NO cause field
export type _NoCauseOnInstalled = _VInstalled["cause"];
// @ts-expect-error -- SNM-10: updated has NO cause field
export type _NoCauseOnUpdated = _VUpdated["cause"];
// @ts-expect-error -- SNM-10: reinstalled has NO cause field
export type _NoCauseOnReinstalled = _VReinstalled["cause"];
// @ts-expect-error -- SNM-10: uninstalled has NO cause field
export type _NoCauseOnUninstalled = _VUninstalled["cause"];
// @ts-expect-error -- SNM-10: available has NO cause field
export type _NoCauseOnAvailable = _VAvailable["cause"];
// @ts-expect-error -- SNM-10: unavailable has NO cause field
export type _NoCauseOnUnavailable = _VUnavailable["cause"];
// @ts-expect-error -- SNM-10: upgradable has NO cause field
export type _NoCauseOnUpgradable = _VUpgradable["cause"];
// @ts-expect-error -- SNM-10: skipped has NO cause field
export type _NoCauseOnSkipped = _VSkipped["cause"];
// @ts-expect-error -- SNM-10: present has NO cause field (UAT G-21-01)
export type _NoCauseOnPresent = _VPresent["cause"];

// ============================================================================
// Per-variant: rollbackPartial? (SNM-09 + D-15-12)
//
// Present ONLY on `failed`. Absent on the other 9 variants.
// ============================================================================

type _Assert_RollbackOnFailed = _VFailed extends {
  rollbackPartial?: readonly { phase: string; cause?: Error }[];
}
  ? true
  : never;
export const _rb: _Assert_RollbackOnFailed = true;

// @ts-expect-error -- SNM-09: installed has NO rollbackPartial field
export type _NoRollbackOnInstalled = _VInstalled["rollbackPartial"];
// @ts-expect-error -- SNM-09: updated has NO rollbackPartial field
export type _NoRollbackOnUpdated = _VUpdated["rollbackPartial"];
// @ts-expect-error -- SNM-09: reinstalled has NO rollbackPartial field
export type _NoRollbackOnReinstalled = _VReinstalled["rollbackPartial"];
// @ts-expect-error -- SNM-09: uninstalled has NO rollbackPartial field
export type _NoRollbackOnUninstalled = _VUninstalled["rollbackPartial"];
// @ts-expect-error -- SNM-09: available has NO rollbackPartial field
export type _NoRollbackOnAvailable = _VAvailable["rollbackPartial"];
// @ts-expect-error -- SNM-09: unavailable has NO rollbackPartial field
export type _NoRollbackOnUnavailable = _VUnavailable["rollbackPartial"];
// @ts-expect-error -- SNM-09: upgradable has NO rollbackPartial field
export type _NoRollbackOnUpgradable = _VUpgradable["rollbackPartial"];
// @ts-expect-error -- SNM-09: skipped has NO rollbackPartial field
export type _NoRollbackOnSkipped = _VSkipped["rollbackPartial"];
// @ts-expect-error -- SNM-09: manual recovery has NO rollbackPartial field
export type _NoRollbackOnManualRecovery = _VManualRecovery["rollbackPartial"];
// @ts-expect-error -- SNM-09: present has NO rollbackPartial field (UAT G-21-01)
export type _NoRollbackOnPresent = _VPresent["rollbackPartial"];

// ============================================================================
// Per-variant: dependencies (SNM-06 + D-15-02 + D-15-12)
//
// REQUIRED on `installed` / `updated` / `reinstalled`. Absent on the other 7.
// ============================================================================

type _Assert_DepsRequiredInstalled = _VInstalled["dependencies"] extends readonly Dependency[]
  ? true
  : never;
export const _drI: _Assert_DepsRequiredInstalled = true;

type _Assert_DepsRequiredUpdated = _VUpdated["dependencies"] extends readonly Dependency[]
  ? true
  : never;
export const _drU: _Assert_DepsRequiredUpdated = true;

type _Assert_DepsRequiredReinstalled = _VReinstalled["dependencies"] extends readonly Dependency[]
  ? true
  : never;
export const _drR: _Assert_DepsRequiredReinstalled = true;

// REQUIRED (not optional): `undefined` must NOT be assignable to the
// dependencies field type. Optional `dependencies?: readonly Dependency[]`
// would resolve `undefined extends readonly Dependency[] | undefined` to
// `true` -- this assertion would then return `never` and fail.
type _Assert_DepsNotOptionalInstalled = undefined extends _VInstalled["dependencies"]
  ? never
  : true;
export const _dnI: _Assert_DepsNotOptionalInstalled = true;

type _Assert_DepsNotOptionalUpdated = undefined extends _VUpdated["dependencies"] ? never : true;
export const _dnU: _Assert_DepsNotOptionalUpdated = true;

type _Assert_DepsNotOptionalReinstalled = undefined extends _VReinstalled["dependencies"]
  ? never
  : true;
export const _dnR: _Assert_DepsNotOptionalReinstalled = true;

// UAT G-21-01 (21-04-REVIEW.md WR-01): PluginPresentMessage carries REQUIRED
// `dependencies: readonly Dependency[]` so the soft-dep marker injection
// (D-16-15) still applies on list-surface inventory rows. The renderer arm
// for `present` is byte-identical to the `installed` arm, which structurally
// depends on the dependencies field being required.
type _Assert_DepsRequiredPresent = _VPresent["dependencies"] extends readonly Dependency[]
  ? true
  : never;
export const _drP: _Assert_DepsRequiredPresent = true;

type _Assert_DepsNotOptionalPresent = undefined extends _VPresent["dependencies"] ? never : true;
export const _dnP: _Assert_DepsNotOptionalPresent = true;

// @ts-expect-error -- D-15-02: uninstalled has NO dependencies field
export type _NoDepsOnUninstalled = _VUninstalled["dependencies"];
// @ts-expect-error -- D-15-02: available has NO dependencies field
export type _NoDepsOnAvailable = _VAvailable["dependencies"];
// @ts-expect-error -- D-15-02: unavailable has NO dependencies field
export type _NoDepsOnUnavailable = _VUnavailable["dependencies"];
// @ts-expect-error -- D-15-02: upgradable has NO dependencies field
export type _NoDepsOnUpgradable = _VUpgradable["dependencies"];
// @ts-expect-error -- D-15-02: failed has NO dependencies field
export type _NoDepsOnFailed = _VFailed["dependencies"];
// @ts-expect-error -- D-15-02: skipped has NO dependencies field
export type _NoDepsOnSkipped = _VSkipped["dependencies"];
// @ts-expect-error -- D-15-02: manual recovery has NO dependencies field
export type _NoDepsOnManualRecovery = _VManualRecovery["dependencies"];

// ============================================================================
// Per-variant: reasons (D-15-01 + D-15-12)
//
// REQUIRED on the 5 status-with-{reason} variants: `unavailable` / `upgradable`
// / `skipped` / `failed` / `manual recovery`. Absent on the other 5:
// `installed` / `updated` / `reinstalled` / `uninstalled` / `available`.
// ============================================================================

type _Assert_ReasonsRequiredUnavailable = _VUnavailable["reasons"] extends readonly _Reason[]
  ? true
  : never;
export const _rrUna: _Assert_ReasonsRequiredUnavailable = true;

type _Assert_ReasonsRequiredUpgradable = _VUpgradable["reasons"] extends readonly _Reason[]
  ? true
  : never;
export const _rrUpg: _Assert_ReasonsRequiredUpgradable = true;

type _Assert_ReasonsRequiredSkipped = _VSkipped["reasons"] extends readonly _Reason[]
  ? true
  : never;
export const _rrSk: _Assert_ReasonsRequiredSkipped = true;

type _Assert_ReasonsRequiredFailed = _VFailed["reasons"] extends readonly _Reason[] ? true : never;
export const _rrF: _Assert_ReasonsRequiredFailed = true;

type _Assert_ReasonsRequiredManualRecovery = _VManualRecovery["reasons"] extends readonly _Reason[]
  ? true
  : never;
export const _rrMR: _Assert_ReasonsRequiredManualRecovery = true;

// REQUIRED (not optional) -- mirrors the dependencies-not-optional pattern.
type _Assert_ReasonsNotOptionalUnavailable = undefined extends _VUnavailable["reasons"]
  ? never
  : true;
export const _rnUna: _Assert_ReasonsNotOptionalUnavailable = true;

type _Assert_ReasonsNotOptionalUpgradable = undefined extends _VUpgradable["reasons"]
  ? never
  : true;
export const _rnUpg: _Assert_ReasonsNotOptionalUpgradable = true;

type _Assert_ReasonsNotOptionalSkipped = undefined extends _VSkipped["reasons"] ? never : true;
export const _rnSk: _Assert_ReasonsNotOptionalSkipped = true;

type _Assert_ReasonsNotOptionalFailed = undefined extends _VFailed["reasons"] ? never : true;
export const _rnF: _Assert_ReasonsNotOptionalFailed = true;

type _Assert_ReasonsNotOptionalManualRecovery = undefined extends _VManualRecovery["reasons"]
  ? never
  : true;
export const _rnMR: _Assert_ReasonsNotOptionalManualRecovery = true;

// @ts-expect-error -- D-15-01: installed has NO reasons field
export type _NoReasonsOnInstalled = _VInstalled["reasons"];
// @ts-expect-error -- D-15-01: updated has NO reasons field
export type _NoReasonsOnUpdated = _VUpdated["reasons"];
// @ts-expect-error -- D-15-01: reinstalled has NO reasons field
export type _NoReasonsOnReinstalled = _VReinstalled["reasons"];
// @ts-expect-error -- D-15-01: uninstalled has NO reasons field
export type _NoReasonsOnUninstalled = _VUninstalled["reasons"];
// @ts-expect-error -- D-15-01: available has NO reasons field
export type _NoReasonsOnAvailable = _VAvailable["reasons"];
// @ts-expect-error -- D-15-01: present has NO reasons field (UAT G-21-01)
export type _NoReasonsOnPresent = _VPresent["reasons"];

// ============================================================================
// Per-variant: scope? (SNM-11 + D-15-12)
//
// Present (optional) on 8 variants. Absent on `available` / `unavailable`
// (MSG-PL-6 carve-out: the list surface does not emit [<scope>] brackets for
// those rows).
// ============================================================================

type _Assert_ScopeOnInstalled = _VInstalled["scope"] extends _Scope | undefined ? true : never;
export const _scI: _Assert_ScopeOnInstalled = true;

type _Assert_ScopeOnUpdated = _VUpdated["scope"] extends _Scope | undefined ? true : never;
export const _scU: _Assert_ScopeOnUpdated = true;

type _Assert_ScopeOnReinstalled = _VReinstalled["scope"] extends _Scope | undefined ? true : never;
export const _scR: _Assert_ScopeOnReinstalled = true;

type _Assert_ScopeOnUninstalled = _VUninstalled["scope"] extends _Scope | undefined ? true : never;
export const _scUn: _Assert_ScopeOnUninstalled = true;

type _Assert_ScopeOnUpgradable = _VUpgradable["scope"] extends _Scope | undefined ? true : never;
export const _scUpg: _Assert_ScopeOnUpgradable = true;

type _Assert_ScopeOnFailed = _VFailed["scope"] extends _Scope | undefined ? true : never;
export const _scF: _Assert_ScopeOnFailed = true;

type _Assert_ScopeOnSkipped = _VSkipped["scope"] extends _Scope | undefined ? true : never;
export const _scSk: _Assert_ScopeOnSkipped = true;

type _Assert_ScopeOnManualRecovery = _VManualRecovery["scope"] extends _Scope | undefined
  ? true
  : never;
export const _scMR: _Assert_ScopeOnManualRecovery = true;

// UAT G-21-01 (21-04-REVIEW.md WR-01): PluginPresentMessage carries OPTIONAL
// `scope?: Scope` mirroring PluginInstalledMessage; the orphan-fold rule
// (D-16-17 / D-13-18) emits the cross-scope `[<scope>]` bracket when the
// plugin's actual scope differs from the owning marketplace block's scope.
type _Assert_ScopeOnPresent = _VPresent["scope"] extends _Scope | undefined ? true : never;
export const _scP: _Assert_ScopeOnPresent = true;

// @ts-expect-error -- SNM-11: available has NO scope field (MSG-PL-6 carve-out)
export type _NoScopeOnAvailable = _VAvailable["scope"];
// @ts-expect-error -- SNM-11: unavailable has NO scope field (MSG-PL-6 carve-out)
export type _NoScopeOnUnavailable = _VUnavailable["scope"];

// ============================================================================
// Per-variant: from / to (D-15-04 + D-15-12)
//
// REQUIRED ONLY on `updated` (mirrors v1.3 `v1.0 → v1.2` arrow rendering).
// Absent on the other 9 variants.
// ============================================================================

type _Assert_FromOnUpdated = _VUpdated["from"] extends string ? true : never;
export const _frU: _Assert_FromOnUpdated = true;

type _Assert_ToOnUpdated = _VUpdated["to"] extends string ? true : never;
export const _toU: _Assert_ToOnUpdated = true;

// REQUIRED -- `undefined` must NOT be assignable.
type _Assert_FromNotOptionalUpdated = undefined extends _VUpdated["from"] ? never : true;
export const _fnU: _Assert_FromNotOptionalUpdated = true;

type _Assert_ToNotOptionalUpdated = undefined extends _VUpdated["to"] ? never : true;
export const _tnU: _Assert_ToNotOptionalUpdated = true;

// @ts-expect-error -- D-15-04: installed has NO from field
export type _NoFromOnInstalled = _VInstalled["from"];
// @ts-expect-error -- D-15-04: reinstalled has NO from field
export type _NoFromOnReinstalled = _VReinstalled["from"];
// @ts-expect-error -- D-15-04: uninstalled has NO from field
export type _NoFromOnUninstalled = _VUninstalled["from"];
// @ts-expect-error -- D-15-04: available has NO from field
export type _NoFromOnAvailable = _VAvailable["from"];
// @ts-expect-error -- D-15-04: unavailable has NO from field
export type _NoFromOnUnavailable = _VUnavailable["from"];
// @ts-expect-error -- D-15-04: upgradable has NO from field
export type _NoFromOnUpgradable = _VUpgradable["from"];
// @ts-expect-error -- D-15-04: failed has NO from field
export type _NoFromOnFailed = _VFailed["from"];
// @ts-expect-error -- D-15-04: skipped has NO from field
export type _NoFromOnSkipped = _VSkipped["from"];
// @ts-expect-error -- D-15-04: manual recovery has NO from field
export type _NoFromOnManualRecovery = _VManualRecovery["from"];
// @ts-expect-error -- D-15-04: present has NO from field (UAT G-21-01)
export type _NoFromOnPresent = _VPresent["from"];

// @ts-expect-error -- D-15-04: installed has NO to field
export type _NoToOnInstalled = _VInstalled["to"];
// @ts-expect-error -- D-15-04: reinstalled has NO to field
export type _NoToOnReinstalled = _VReinstalled["to"];
// @ts-expect-error -- D-15-04: uninstalled has NO to field
export type _NoToOnUninstalled = _VUninstalled["to"];
// @ts-expect-error -- D-15-04: available has NO to field
export type _NoToOnAvailable = _VAvailable["to"];
// @ts-expect-error -- D-15-04: unavailable has NO to field
export type _NoToOnUnavailable = _VUnavailable["to"];
// @ts-expect-error -- D-15-04: upgradable has NO to field
export type _NoToOnUpgradable = _VUpgradable["to"];
// @ts-expect-error -- D-15-04: failed has NO to field
export type _NoToOnFailed = _VFailed["to"];
// @ts-expect-error -- D-15-04: skipped has NO to field
export type _NoToOnSkipped = _VSkipped["to"];
// @ts-expect-error -- D-15-04: manual recovery has NO to field
export type _NoToOnManualRecovery = _VManualRecovery["to"];
// @ts-expect-error -- D-15-04: present has NO to field (UAT G-21-01)
export type _NoToOnPresent = _VPresent["to"];

// ============================================================================
// Per-variant: version? (D-15-04 + D-15-12)
//
// OPTIONAL on 9 variants. The `updated` variant uses from/to instead of
// version (covered above).
// ============================================================================

type _Assert_VersionOnInstalled = _VInstalled["version"] extends string | undefined ? true : never;
export const _vI: _Assert_VersionOnInstalled = true;

type _Assert_VersionOnUninstalled = _VUninstalled["version"] extends string | undefined
  ? true
  : never;
export const _vUn: _Assert_VersionOnUninstalled = true;

type _Assert_VersionOnReinstalled = _VReinstalled["version"] extends string | undefined
  ? true
  : never;
export const _vR: _Assert_VersionOnReinstalled = true;

type _Assert_VersionOnAvailable = _VAvailable["version"] extends string | undefined ? true : never;
export const _vAv: _Assert_VersionOnAvailable = true;

type _Assert_VersionOnUnavailable = _VUnavailable["version"] extends string | undefined
  ? true
  : never;
export const _vUna: _Assert_VersionOnUnavailable = true;

type _Assert_VersionOnUpgradable = _VUpgradable["version"] extends string | undefined
  ? true
  : never;
export const _vUpg: _Assert_VersionOnUpgradable = true;

type _Assert_VersionOnFailed = _VFailed["version"] extends string | undefined ? true : never;
export const _vF: _Assert_VersionOnFailed = true;

type _Assert_VersionOnSkipped = _VSkipped["version"] extends string | undefined ? true : never;
export const _vSk: _Assert_VersionOnSkipped = true;

type _Assert_VersionOnManualRecovery = _VManualRecovery["version"] extends string | undefined
  ? true
  : never;
export const _vMR: _Assert_VersionOnManualRecovery = true;

// UAT G-21-01 (21-04-REVIEW.md WR-01): PluginPresentMessage carries OPTIONAL
// `version?: string` mirroring PluginInstalledMessage (the installed record's
// version is captured at install time and carries through to the inventory row).
type _Assert_VersionOnPresent = _VPresent["version"] extends string | undefined ? true : never;
export const _vP: _Assert_VersionOnPresent = true;

// ============================================================================
// Phase 42 / INFO-04 / INFO-08: REASONS closed-set extension + length lock
//
// The REASONS tuple grew from 28 to 29 entries with the addition of the new
// `"not added"` literal that the new info-surface variants emit on the
// `--scope` mismatch row (INFO-04). The length-lock + closed-set membership
// proof catch the two drift modes the atomic-supersession commit must not
// regress: (i) accidental removal / rename / reorder of the new entry, and
// (ii) silent shrinkage of the tuple back to 28 entries.
//
// Pattern: mirrors the existing `_l1` / `_l2` / `_l3` length-lock blocks
// above (PLUGIN_STATUSES at 11, MARKETPLACE_STATUSES at 7, DEPENDENCIES at
// 2) -- those re-stated drift guards remain byte-identical; Phase 42 added
// `_l4` / `_l4b` here and `_l5..._l9` for the new info variants below.
// ============================================================================

type _Assert_ReasonsLen = (typeof REASONS)["length"] extends 29 ? true : never;
export const _l4: _Assert_ReasonsLen = true;

type _Assert_NotAddedMember = "not added" extends (typeof REASONS)[number] ? true : never;
export const _l4b: _Assert_NotAddedMember = true;

// ============================================================================
// Phase 42 / SC#1: 3-arm discriminated `NotificationMessage` union reachable
//
// The exported `NotificationMessage` type alias is now a 3-arm discriminated
// union (`CascadeNotificationMessage | MarketplaceInfoMessage |
// PluginInfoMessage`); the two new info-surface arms are reachable by their
// `kind` discriminator via `Extract<NotificationMessage, { kind: "..." }>`.
// SC#1 wording: "MarketplaceInfoMessage / PluginInfoMessage reachable from
// NotificationMessage via the kind discriminator." This proof is the
// load-bearing reach test.
// ============================================================================

type _Assert_NotifKinds =
  Extract<NotificationMessage, { kind: "marketplace-info" }> extends never
    ? never
    : Extract<NotificationMessage, { kind: "plugin-info" }> extends never
      ? never
      : true;
export const _l5: _Assert_NotifKinds = true;

// ============================================================================
// Phase 42 / SC#1: MarketplaceInfoMessage shape proof
//
// Bidirectional `extends` proves set-equality between the exported variant
// type and an `_MarketplaceInfoExpected` literal mirroring the six fields
// from the variant interface. Both source-kind sub-shapes (github with
// optional ref, path) are covered by the union in `source`. Mirrors the
// existing `_MarketplaceDetailsExpected` pattern above.
// ============================================================================

interface _MarketplaceInfoExpected {
  readonly kind: "marketplace-info";
  readonly name: string;
  readonly scope: _Scope;
  readonly details: MarketplaceDetails;
  readonly source:
    | {
        readonly sourceKind: "github";
        readonly owner: string;
        readonly repo: string;
        readonly ref?: string;
      }
    | { readonly sourceKind: "path"; readonly absPath: string };
  // Phase 42 / WR-04: no parallel top-level `lastUpdated?` field. The ISO
  // timestamp lives ONLY on `details.lastUpdatedAt` (single source of truth
  // mirroring persistence/state-io.ts); the renderer reads it from there
  // on the github-source arm.
  readonly description?: string;
}
type _Assert_MarketplaceInfoShape = MarketplaceInfoMessage extends _MarketplaceInfoExpected
  ? _MarketplaceInfoExpected extends MarketplaceInfoMessage
    ? true
    : never
  : never;
export const _l7: _Assert_MarketplaceInfoShape = true;

// ============================================================================
// Phase 42 / SC#1: PluginInfoMessage + PluginInfoRow discriminated-shape proof
//
// `PluginInfoMessage` carries `marketplaceName` / `marketplaceScope` /
// `marketplaceDetails` plus a `plugin: PluginInfoRow` whose
// `componentsResolved: true | false` discriminator drives the renderer's
// switch. Each arm has the EXACT field set documented in the variant
// interface JSDoc -- the resolved arm carries the four optional per-kind
// component arrays + optional `dependencies`; the unresolved arm has NO
// `components` property (and the `keyof` exclusion proof below locks that).
// ============================================================================

interface _PluginInfoBaseExpected {
  readonly status: "installed" | "available" | "unavailable" | "failed";
  readonly name: string;
  readonly version?: string;
  readonly scope?: _Scope;
  readonly description?: string;
  readonly reasons?: readonly _Reason[];
}
interface _PluginInfoExpected {
  readonly kind: "plugin-info";
  readonly marketplaceName: string;
  readonly marketplaceScope: _Scope;
  readonly marketplaceDetails: MarketplaceDetails;
  readonly plugin: PluginInfoRow;
}
type _Assert_PluginInfoShape = PluginInfoMessage extends _PluginInfoExpected
  ? _PluginInfoExpected extends PluginInfoMessage
    ? true
    : never
  : never;
export const _l8: _Assert_PluginInfoShape = true;

// Per-arm proofs of the PluginInfoRow `componentsResolved` discriminator.
// Extract each arm via the discriminator literal so the per-arm field set
// is locked individually -- mirrors the per-variant `_VInstalled` /
// `_VFailed` / etc. extraction pattern used above for
// PluginNotificationMessage.
type _RowResolved = Extract<PluginInfoRow, { componentsResolved: true }>;
type _RowUnresolved = Extract<PluginInfoRow, { componentsResolved: false }>;

// Both arms share the `PluginInfoRowBase` field set.
type _Assert_RowResolvedBase = _RowResolved extends _PluginInfoBaseExpected ? true : never;
export const _l8a: _Assert_RowResolvedBase = true;
type _Assert_RowUnresolvedBase = _RowUnresolved extends _PluginInfoBaseExpected ? true : never;
export const _l8b: _Assert_RowUnresolvedBase = true;

// Resolved arm: components carries the four optional per-kind arrays, plus
// optional dependencies. Locks the "renderer assumes pre-sorted input"
// precondition's shape (the precondition itself is enforced by Phase 44's
// orchestrator -- see RESEARCH Pitfall 5).
interface _ComponentsExpected {
  readonly agents?: readonly string[];
  readonly commands?: readonly string[];
  readonly mcp?: readonly string[];
  readonly skills?: readonly string[];
}
type _Assert_RowResolvedComponents = _RowResolved["components"] extends _ComponentsExpected
  ? _ComponentsExpected extends _RowResolved["components"]
    ? true
    : never
  : never;
export const _l8c: _Assert_RowResolvedComponents = true;

type _Assert_RowResolvedDependencies = _RowResolved["dependencies"] extends
  | readonly string[]
  | undefined
  ? true
  : never;
export const _l8d: _Assert_RowResolvedDependencies = true;

// Unresolved arm: NO `components` property at all (the INFO-05 marker
// carries no component data -- the renderer emits the `components: not
// resolved` line and short-circuits). The `keyof` exclusion proof locks
// the negative: the literal `"components"` is NOT a key of the unresolved
// arm.
type _Assert_RowUnresolvedNoComponents = "components" extends keyof _RowUnresolved ? never : true;
export const _l8e: _Assert_RowUnresolvedNoComponents = true;
// @ts-expect-error -- INFO-05: componentsResolved:false arm has NO components field
export type _NoComponentsOnUnresolved = _RowUnresolved["components"];

// ============================================================================
// Phase 43 / INFO-03 / SC#1: MarketplaceInfoCascadeMessage variant proofs
//
// The `NotificationMessage` union now exposes a fourth variant --
// `MarketplaceInfoCascadeMessage` -- emitted by `getMarketplaceInfo` when no
// `--scope` is supplied and the requested marketplace name is present in
// BOTH scopes. The fan-out wrapper carries one or more
// `MarketplaceInfoMessage` blocks in caller order; `notify()` joins their
// per-block bodies with `\n\n`. Three proofs:
//
//   - `_l9`  -- the union exposes the new arm via Extract on the kind
//                discriminator (non-`never`).
//   - `_l9a` -- bidirectional shape proof: the variant carries EXACTLY
//                `kind: "marketplace-info-cascade"` and
//                `blocks: readonly MarketplaceInfoMessage[]`.
//   - `_l9b` -- union arity proof: the four arms (cascade |
//                marketplace-info | plugin-info | marketplace-info-cascade)
//                are simultaneously reachable. Any future regression that
//                drops one of the four arms from the union (e.g. an
//                accidental `Omit`) collapses the conjunction to `never`.
// ============================================================================

type _Assert_CascadeInfoKind =
  Extract<NotificationMessage, { kind: "marketplace-info-cascade" }> extends never ? never : true;
export const _l9: _Assert_CascadeInfoKind = true;

interface _MarketplaceInfoCascadeExpected {
  readonly kind: "marketplace-info-cascade";
  readonly blocks: readonly [MarketplaceInfoMessage, ...MarketplaceInfoMessage[]];
}
type _Assert_MarketplaceInfoCascadeShape =
  MarketplaceInfoCascadeMessage extends _MarketplaceInfoCascadeExpected
    ? _MarketplaceInfoCascadeExpected extends MarketplaceInfoCascadeMessage
      ? true
      : never
    : never;
export const _l9a: _Assert_MarketplaceInfoCascadeShape = true;

// Union arity: prove all FOUR arms are simultaneously reachable. The
// cascade arm is reached via its structural `marketplaces` field (its
// `kind?` is OPTIONAL so Extract on `{ kind: "cascade" }` does not narrow
// it -- the cascade arm permits absent kind for the v1.0-v1.7 migration
// path). The three info arms are reached via their REQUIRED `kind`
// discriminator literals. Any future regression that drops one of the four
// arms from the union collapses the conjunction to `never`.
type _Assert_NotifFourArms =
  Extract<NotificationMessage, { marketplaces: readonly unknown[] }> extends never
    ? never
    : Extract<NotificationMessage, { kind: "marketplace-info" }> extends never
      ? never
      : Extract<NotificationMessage, { kind: "plugin-info" }> extends never
        ? never
        : Extract<NotificationMessage, { kind: "marketplace-info-cascade" }> extends never
          ? never
          : true;
export const _l9b: _Assert_NotifFourArms = true;

// ============================================================================
// Phase 44 / INFO-02 / INFO-03: PluginInfoCascadeMessage variant proofs
//
// The `NotificationMessage` union now exposes a fifth variant --
// `PluginInfoCascadeMessage` -- emitted by `getPluginInfo` when no
// `--scope` is supplied and the requested `<plugin>@<marketplace>` pair
// is present in BOTH scopes. The fan-out wrapper carries one or more
// `PluginInfoMessage` blocks in caller order; `notify()` joins their
// per-block bodies with `\n\n` (mirrors Phase 43's
// `MarketplaceInfoCascadeMessage` and the install-cascade
// `composeMarketplaceBlock` join). Three proofs:
//
//   - `_l10`  -- the union exposes the new arm via Extract on the kind
//                 discriminator (non-`never`).
//   - `_l10a` -- bidirectional shape proof: the variant carries EXACTLY
//                 `kind: "plugin-info-cascade"` and
//                 `blocks: readonly PluginInfoMessage[]`.
//   - `_l10b` -- union arity proof: all FIVE arms (cascade |
//                 marketplace-info | plugin-info | marketplace-info-cascade
//                 | plugin-info-cascade) are simultaneously reachable.
//                 Any future regression that drops one of the five arms
//                 from the union collapses the conjunction to `never`.
// ============================================================================

type _Assert_PluginInfoCascadeKind =
  Extract<NotificationMessage, { kind: "plugin-info-cascade" }> extends never ? never : true;
export const _l10: _Assert_PluginInfoCascadeKind = true;

interface _PluginInfoCascadeExpected {
  readonly kind: "plugin-info-cascade";
  readonly blocks: readonly [PluginInfoMessage, ...PluginInfoMessage[]];
}
type _Assert_PluginInfoCascadeShape = PluginInfoCascadeMessage extends _PluginInfoCascadeExpected
  ? _PluginInfoCascadeExpected extends PluginInfoCascadeMessage
    ? true
    : never
  : never;
export const _l10a: _Assert_PluginInfoCascadeShape = true;

// Union arity: prove all FIVE arms are simultaneously reachable. The
// cascade arm is reached via its structural `marketplaces` field; the
// four info arms via their REQUIRED `kind` discriminator literals.
type _Assert_NotifFiveArms =
  Extract<NotificationMessage, { marketplaces: readonly unknown[] }> extends never
    ? never
    : Extract<NotificationMessage, { kind: "marketplace-info" }> extends never
      ? never
      : Extract<NotificationMessage, { kind: "plugin-info" }> extends never
        ? never
        : Extract<NotificationMessage, { kind: "marketplace-info-cascade" }> extends never
          ? never
          : Extract<NotificationMessage, { kind: "plugin-info-cascade" }> extends never
            ? never
            : true;
export const _l10b: _Assert_NotifFiveArms = true;

// The `CascadeNotificationMessage` arm declares `kind?: "cascade"` as
// OPTIONAL (back-compat for v1.0-v1.7 call sites that construct cascades
// without a `kind` field). Because `kind?: "cascade"` is NOT assignable
// to `kind: "cascade"` (the optional field could be `undefined`),
// `Extract<NotificationMessage, { kind: "cascade" }>` evaluates to
// `never` -- it CANNOT be used to narrow to the cascade arm. Callers
// must narrow via the structural `marketplaces` field instead (see
// `_l9b` / `_l10b` above). This lock makes the pitfall loud: a future
// contributor who "fixes" the union by promoting `kind` to required
// would start matching this Extract and the assertion would flip from
// `true` to `never`, surfacing the breaking change.
type _Assert_ExtractCascadeByOptionalKindIsNever =
  Extract<NotificationMessage, { kind: "cascade" }> extends never ? true : never;
export const _l11: _Assert_ExtractCascadeByOptionalKindIsNever = true;

// ============================================================================
// Phase 42 drift guards (re-stated explicitly -- the pre-existing length-locks
// `_l1` / `_l2` / `_l3` above remain byte-identical at 11 / 7 / 2).
//
// Verified at Phase 42 commit time:
//   - PLUGIN_STATUSES.length === 11 (UAT G-21-01; unchanged since `present`
//     was added in Phase 21).
//   - MARKETPLACE_STATUSES.length === 7 (D-17.1-01; unchanged since Phase 17.1
//     supersession landed the autoupdate flip discriminators).
//   - DEPENDENCIES.length === 2 (SNM-06; unchanged since Phase 15).
//
// Phase 42 only extends REASONS (28 → 29 via the `"not added"` addition);
// the other three closed sets are untouched.
// ============================================================================

// ============================================================================
// node:test anchor
//
// The type-level `_Assert_*` assignments above carry the proof; this body
// exists so node:test counts the file in `npm run check` output (D-15-10;
// mirrors `tests/architecture/grammar-frontmatter.test.ts` precedent).
// Failures of the type assertions surface through `npm run typecheck`, not
// through this trivial runtime assert.
// ============================================================================

test("Phase 15 / SNM-01..SNM-11 / D-15-12: notify type model invariants hold at compile time", () => {
  assert.equal(1, 1);
});
