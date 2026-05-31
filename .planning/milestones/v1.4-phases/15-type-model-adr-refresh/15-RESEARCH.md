# Phase 15: Type Model & ADR Refresh - Research

**Researched:** 2026-05-25
**Domain:** Pure TypeScript type definitions + ADR refresh (zero runtime impact)
**Confidence:** HIGH

## Summary

Phase 15 is a pure-declaration phase. The design is fully locked by CONTEXT.md D-15-01..D-15-16 and REQUIREMENTS.md SNM-01..SNM-11 + SNM-21. Research focused on surfacing the concrete v1.3 reference artifacts the planner needs to convert "locked design" into "executable plans" -- exact file states, exact pattern templates, exact test-file shape, the ADR section-by-section diff plan, and the landmines that make this look easier than it is.

Three load-bearing reference patterns are already in the codebase:

1. `shared/grammar/status-tokens.ts` -- the canonical `as const` tuple + `(typeof X)[number]` literal-union template that D-15-11 instructs `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `DEPENDENCIES` to mirror byte-for-byte in shape.
2. `presentation/compact-line.ts` `RowSpec` -- a 9-variant discriminated union of named per-variant interfaces joined in one `export type` alias. Same `switch(x.kind)` + `assertNever(x)` pattern Phase 16 will replicate over `status`. The naming convention (`PluginInlineRow`, `PluginCascadeRow`, ...) is the precedent D-15-discretion allows.
3. `tests/architecture/grammar-frontmatter.test.ts` -- the established "one test() block per invariant; trivial assert body is OK" shape for `tests/architecture/notify-types.test.ts`.

**Primary recommendation:** Three atomic commits (types, compile-check, ADR), in that order, with `npm run check` GREEN between each. Each commit is one plan. The compile-check file is non-negotiable -- without it nothing in the type set is detectable as broken.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Per-variant field discipline (Reasons, Dependencies, Version)**

- **D-15-01:** `reasons: readonly Reason[]` is a REQUIRED field only on the 5 variants that emit a `{<reason>}` brace in v1.3 output: `unavailable`, `upgradable`, `skipped`, `failed`, `manual recovery`. Empty array allowed. The other 5 variants (`installed`, `updated`, `reinstalled`, `uninstalled`, `available`) omit the field entirely. Emitting `(installed) {up-to-date}` becomes a compile error.
- **D-15-02:** `dependencies: readonly Dependency[]` is REQUIRED only on `installed` / `updated` / `reinstalled` (per SNM-06). The other 7 variants do NOT carry the field. The Phase 16 renderer's per-dependency probe path is only reachable from those 3 switch arms.
- **D-15-03:** `Reason` is imported unchanged from `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- the 28-entry runtime array + drift test against `docs/messaging-style-guide.md` YAML frontmatter stay intact. Three entries (`rollback partial`, `requires pi-subagents`, `requires pi-mcp`) become structurally absorbed by `rollbackPartial[]` / `dependencies[]` probes and won't appear in any typed Reason field, but the runtime array is unchanged in Phase 15. Phase 21 (SNM-29) makes the survive/retire call.
- **D-15-04:** `version` field placement: optional `version?: string` on `installed` / `uninstalled` / `reinstalled` / `available` / `unavailable` / `upgradable` / `failed` / `skipped` / `manual recovery`. The `updated` variant carries REQUIRED `from: string; to: string` instead (mirrors v1.3's `v1.0 → v1.2` arrow rendering). Hash-version contract (PI-7 `hash-<12hex>`) remains a plain string -- no branded type.

**Marketplace-level shape**

- **D-15-05:** `MarketplaceDetails = { autoupdate: boolean; lastUpdatedAt?: string }`. `autoupdate` is REQUIRED boolean. `lastUpdatedAt?: string` is ISO timestamp matching `persistence/state-io.ts:70` exactly. No source field, no version field. Used on the `marketplace list` surface only.
- **D-15-06:** `MarketplaceNotificationMessage.status?: MarketplaceStatus` and `MarketplaceNotificationMessage.details?: MarketplaceDetails` are independent optionals (matches SNM-02 as written). The two never co-occur in practice -- Phase 16 renderer ignores `details` when `status` is set -- but the type does not structurally constrain that.
- **D-15-07:** `MarketplaceStatus = "added" | "removed" | "updated" | "failed"` -- 4 values, no `"skipped"`.
- **D-15-08:** Empty `plugins: []` IS the explicit `(no plugins)` rendering on the list surface. No separate `noPlugins` discriminator.
- **D-15-09:** Empty top-level `marketplaces: []` IS the explicit `(no marketplaces)` rendering. No top-level `noMarketplaces` discriminator.

**Compile-check + runtime const arrays**

- **D-15-10:** Compile-time proof lives at `tests/architecture/notify-types.test.ts` (standalone file). Uses `type _Assert_* = ...` blocks; node:test runner counts the file via a trivial `assert.equal(1, 1)` body.
- **D-15-11:** Ship runtime `as const` arrays in `shared/notify.ts`: `PLUGIN_STATUSES`, `MARKETPLACE_STATUSES`, `DEPENDENCIES`. Derive types via `(typeof X)[number]`.
- **D-15-12:** Compile-check file locks per-variant structural invariants beyond closed-set membership: `cause?` only on `failed` / `manual recovery`; `rollbackPartial?` only on `failed`; `scope?` on all variants except `available` / `unavailable`; `dependencies` only on `installed` / `updated` / `reinstalled`; `reasons` only on the 5 status-with-{reason} variants; `from` / `to` only on `updated`.

**ADR refresh**

- **D-15-13:** Full Decision / Consequences rewrite. Replace per-outcome wrapper code snippets with one `notify(ctx, payload)` snippet + discriminated-union shape. Flip status Proposed → Accepted with forward reference to Phase 15. Keep Context section intact.
- **D-15-14:** Resolve both "Open questions" inline and delete the section.
- **D-15-15:** Migration section rewritten to cite concrete phase numbers (Phase 16-21).
- **D-15-16:** Alternative 2 ("single `notify`, no typed wrappers") flipped from Rejected → ACCEPTED with rationale. Alternatives 1, 3, 4, 5, 6 stay rejected.

### Claude's Discretion

- Exact `type _Assert_*` formulation per invariant (multiple valid TypeScript idioms).
- Naming of per-variant interfaces (named per-variant interfaces vs. inline anonymous variants in one big union literal). `compact-line.ts` precedent uses named interfaces.
- Whether to re-export `Reason` (and `Marker` if used) from `shared/notify.ts` for a single-import surface.
- Commit granularity within Phase 15 (one commit per plan vs. one big commit).

### Deferred Ideas (OUT OF SCOPE)

- Branded `Version` type with `hash-<12hex>` / semver validation.
- `source?: ParsedSource` on `MarketplaceDetails`.
- Splitting `MarketplaceNotificationMessage` into discriminated `StateChange` vs. `ListEntry` variants.
- Pruning `Reason` to a v1.4-active subset.
- In-file `type _Assert = ...` block in `shared/notify.ts` as primary surface (discretion permits small in-file claims).
- Separate `v2-002-notify-single-entrypoint.md` ADR.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNM-01 | `NotificationMessage = { marketplaces: readonly MarketplaceNotificationMessage[] }`. No `severity`. No `trailer`. | New type added to `shared/notify.ts`; compile-check asserts shape via `_Assert_NotificationMessageShape`. |
| SNM-02 | `MarketplaceNotificationMessage = { name; scope; status?; details?; plugins }`. | New type; D-15-06 confirms `status?` / `details?` independent optionals. |
| SNM-03 | `PluginNotificationMessage` = 10-variant discriminated union on `status`. | Mirrors `RowSpec` pattern in `compact-line.ts:250-259`. Named per-variant interfaces recommended; planner discretion. |
| SNM-04 | `PluginStatus = PluginNotificationMessage["status"]` derived via indexed access. | D-15-11 ships runtime `PLUGIN_STATUSES` tuple too; `PluginStatus = (typeof PLUGIN_STATUSES)[number]` satisfies SNM-04 via indexed access on the tuple type. Compile-check round-trips both sides. |
| SNM-05 | `MarketplaceStatus = "added" \| "removed" \| "updated" \| "failed"`. | D-15-07; runtime `MARKETPLACE_STATUSES = [...] as const` per D-15-11. |
| SNM-06 | `Dependency = "agents" \| "mcp"`. Required `dependencies: readonly Dependency[]` on installed/updated/reinstalled. | D-15-02 + D-15-11; runtime `DEPENDENCIES = ["agents", "mcp"] as const`. |
| SNM-07 | `MarketplaceDetails` for list context (autoupdate, last-updated). | D-15-05; `lastUpdatedAt?: string` mirrors `state-io.ts:70`. |
| SNM-08 | `UsageErrorMessage = { message: string; usage: string }`. | New type; no `cause`, no `severity`. |
| SNM-09 | `failed` variant carries optional `rollbackPartial?: readonly { phase: string; cause?: Error }[]`. | D-15-12 locks "rollbackPartial only on failed" via compile-check. |
| SNM-10 | `failed` and `manual recovery` carry optional `cause?: Error`. Per-plugin, not top-level. | D-15-12 locks "cause only on failed / manual recovery". |
| SNM-11 | Orphan-fold `scope?` on all plugin variants except `available` / `unavailable`. | D-15-12 locks "scope only on 8 of 10 variants". |
| SNM-21 | ADR `docs/adr/v2-001-structured-notify.md` refreshed: Proposed → Accepted; reflect locked design. | D-15-13..D-15-16 governs section-by-section rewrite. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Type declarations + runtime const arrays | `shared/` (lowest layer) | -- | D-11 layering: `shared/notify.ts` may only import from `shared/types.ts` (`Scope`) and `shared/grammar/reasons.ts` (`Reason`). No other layer touched in Phase 15. |
| Closed-set membership + per-variant invariant proofs | `tests/architecture/` (test tier) | -- | Established precedent for "architectural drift guards" (`grammar-frontmatter`, `msg-rule-registry`, `no-legacy-markers`). Compile-check via `_Assert` types runs at typecheck time; trivial `assert.equal(1, 1)` body makes the node:test runner count the file. |
| ADR refresh | `docs/adr/` (docs tier) | -- | Pure documentation; no code import. SNM-21 closes here. |

**Tier-correctness note:** No call site references the new types in Phase 15 (success criterion #4). The type declarations are dead code at runtime in Phase 15 -- they become live only when Phase 16 ships the `notify(ctx, NotificationMessage)` consumer. This is intentional. The compile-check file is the only "consumer" in this phase.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` | `^6.0.3` (devDep) | Type-level proofs via `type _Assert_*` blocks | Already in `package.json` -- no install needed. Strict mode is already enabled. [VERIFIED: package.json] |
| `node:test` | bundled (Node ≥22) | Runs the architecture test file so failures surface in `npm run check` | Already used by every file under `tests/architecture/`. [VERIFIED: codebase] |

### Supporting

No new packages are introduced by Phase 15. All required tooling exists.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tests/architecture/notify-types.test.ts` separate file | In-file `type _Assert = ...` block at the bottom of `shared/notify.ts` | D-15-10 LOCKS the separate file as the primary surface, matching `grammar-frontmatter.test.ts` precedent. Discretion permits SMALL in-file claims (e.g., `PluginStatus extends PluginNotificationMessage["status"]` round-trip) if it reduces file-crossing complexity. |

### Installation

No new packages. No `npm install` invocation in this phase.

### Version verification

`typescript@^6.0.3` and `node>=20.19.0` already pinned in `package.json`. The Node version constraint (NFR-4 → `>=22` operational floor) covers `node:test` and `assert/strict` stability. No verification needed.

## Package Legitimacy Audit

Not applicable. Phase 15 installs zero external packages.

## Architecture Patterns

### System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────┐
│ Phase 15 -- Pure declarations + ADR refresh                   │
│                                                               │
│  ┌─────────────────────────────────────────────┐              │
│  │ shared/notify.ts (existing file -- APPEND)  │              │
│  │                                             │              │
│  │  [V1 wrappers -- UNCHANGED]                 │              │
│  │    notifySuccess  (line 48-50)              │              │
│  │    notifyWarning  (line 53-55)              │              │
│  │    notifyError    (line 76-80)              │              │
│  │    notifyUsageError 3-arg (line 95-97)      │              │
│  │                                             │              │
│  │  [NEW -- appended below V1 wrappers]        │              │
│  │    PLUGIN_STATUSES (as const)               │              │
│  │    MARKETPLACE_STATUSES (as const)          │              │
│  │    DEPENDENCIES (as const)                  │              │
│  │    PluginStatus = (typeof X)[number]        │              │
│  │    MarketplaceStatus = ...                  │              │
│  │    Dependency = ...                         │              │
│  │    MarketplaceDetails interface             │              │
│  │    UsageErrorMessage interface              │              │
│  │    PluginNotificationMessage union          │              │
│  │      (10 named per-variant interfaces)      │              │
│  │    MarketplaceNotificationMessage interface │              │
│  │    NotificationMessage interface            │              │
│  └─────────────────────────────────────────────┘              │
│             │                                                 │
│             │ imported by                                     │
│             ▼                                                 │
│  ┌─────────────────────────────────────────────┐              │
│  │ tests/architecture/notify-types.test.ts NEW │              │
│  │                                             │              │
│  │  type _Assert_PluginStatuses = ...          │              │
│  │  type _Assert_MarketplaceStatuses = ...     │              │
│  │  type _Assert_Dependencies = ...            │              │
│  │  type _Assert_FailedHasRollbackPartial = ... │             │
│  │  type _Assert_CauseOnlyOnFailedAndMR = ...  │              │
│  │  type _Assert_ScopeExclusion = ...          │              │
│  │  type _Assert_DependenciesOnly3Variants = ...│             │
│  │  type _Assert_ReasonsOnly5Variants = ...    │              │
│  │  type _Assert_FromToOnlyOnUpdated = ...     │              │
│  │  ... one per invariant from D-15-12 ...     │              │
│  │                                             │              │
│  │  test("...", () => assert.equal(1, 1))      │              │
│  └─────────────────────────────────────────────┘              │
│                                                               │
│  ┌─────────────────────────────────────────────┐              │
│  │ docs/adr/v2-001-structured-notify.md REFRESH│              │
│  │                                             │              │
│  │  Status: Proposed → Accepted (Phase 15 ref) │              │
│  │  Context: KEEP (lines 7-16)                 │              │
│  │  Decision: REWRITE (lines 18-91)            │              │
│  │  Consequences: REWRITE (lines 92-142)       │              │
│  │  Alternatives: PATCH (Alt-2 → Accepted)     │              │
│  │  Migration: REWRITE (Phase 16-21 refs)      │              │
│  │  Open questions: DELETE entirely (D-15-14)  │              │
│  └─────────────────────────────────────────────┘              │
│                                                               │
│  Verification: `npm run check` GREEN                          │
│   - typecheck: `_Assert_*` types compile                      │
│   - lint: no new ESLint rules; existing rules pass            │
│   - format: prettier-clean                                    │
│   - tests: notify-types.test.ts runs (trivial assert passes)  │
└───────────────────────────────────────────────────────────────┘

Data flow (Phase 15):
  none -- declarations + ADR text; no runtime call site reads from any new symbol.
  Phase 16 will introduce the first reader (the new `notify()` switch).
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── shared/
│   ├── notify.ts          # MODIFIED -- append new types + const arrays
│   ├── types.ts           # READ-ONLY (Scope source)
│   └── grammar/
│       ├── reasons.ts     # READ-ONLY (Reason source + REASONS array)
│       └── status-tokens.ts  # READ-ONLY (pattern template reference)
└── presentation/
    └── compact-line.ts    # READ-ONLY (RowSpec union pattern reference)

tests/architecture/
├── notify-types.test.ts                # NEW
├── grammar-frontmatter.test.ts         # pattern reference
├── msg-rule-registry.test.ts           # pattern reference
└── no-legacy-markers.test.ts           # pattern reference

docs/adr/
└── v2-001-structured-notify.md         # REFRESH end-to-end
```

### Pattern 1: `as const` tuple + indexed-access literal-union

**What:** Define a runtime tuple via `as const`, then derive the literal-union type by indexed access.
**When to use:** Closed-set vocabularies where downstream consumers need both the runtime list (for iteration in fixtures and drift tests) and the compile-time literal union (for narrowing).
**Example (canonical reference -- `shared/grammar/status-tokens.ts:34-52`):**

```typescript
// Source: extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts
export const STATUS_TOKENS = [
  "installed",
  "updated",
  // ...
  "no plugins",
] as const;

export type StatusToken = (typeof STATUS_TOKENS)[number];
```

**Phase 15 application (per D-15-11):**

```typescript
export const PLUGIN_STATUSES = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "available",
  "unavailable",
  "upgradable",
  "failed",
  "skipped",
  "manual recovery",
] as const;
export type PluginStatus = (typeof PLUGIN_STATUSES)[number];

export const MARKETPLACE_STATUSES = ["added", "removed", "updated", "failed"] as const;
export type MarketplaceStatus = (typeof MARKETPLACE_STATUSES)[number];

export const DEPENDENCIES = ["agents", "mcp"] as const;
export type Dependency = (typeof DEPENDENCIES)[number];
```

**Note on SNM-04 satisfaction:** SNM-04 requires `PluginStatus` derived from `PluginNotificationMessage["status"]` via indexed access. With D-15-11's runtime tuple approach, `PluginStatus = (typeof PLUGIN_STATUSES)[number]` -- this satisfies "derived via indexed access" because the tuple type itself is indexed by `number`. The compile-check file MUST round-trip the equivalence: `type _Assert_PluginStatusRoundTrip = PluginStatus extends PluginNotificationMessage["status"] ? PluginNotificationMessage["status"] extends PluginStatus ? true : never : never;` -- if either direction breaks, the type fails to resolve to `true`.

### Pattern 2: Discriminated union of named per-variant interfaces

**What:** Each variant gets its own `export interface` with a literal `kind`/`status` field; the public type is `export type X = A | B | C | ...`.
**When to use:** When variants have meaningfully different per-variant fields (e.g., `from`/`to` only on `updated`, `rollbackPartial?` only on `failed`).
**Example (canonical reference -- `compact-line.ts:96-259`):**

```typescript
// Source: extensions/pi-claude-marketplace/presentation/compact-line.ts:96-109
export interface PluginInlineRow {
  readonly kind: "plugin-inline";
  readonly name: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly version?: string;
  readonly status: Extract<StatusToken, "installed" | "updated" | "failed" | "rollback failed" | "unavailable">;
  readonly reasons?: readonly Reason[];
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}

// ... 8 more named interfaces ...

// Source: compact-line.ts:250-259
export type RowSpec =
  | PluginInlineRow
  | PluginInlineUninstalledRow
  | PluginCascadeRow
  | PluginListRow
  | MarketplaceRow
  | EmptyToken
  | ManualRecoveryLine
  | RollbackChild
  | EntityErrorRow;
```

**Phase 15 application (recommended; planner has discretion per CONTEXT):**

```typescript
export interface PluginInstalledMessage {
  readonly status: "installed";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly dependencies: readonly Dependency[];
}

export interface PluginUpdatedMessage {
  readonly status: "updated";
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly scope?: Scope;
  readonly dependencies: readonly Dependency[];
}

// ... 8 more named interfaces ...

export type PluginNotificationMessage =
  | PluginInstalledMessage
  | PluginUpdatedMessage
  | PluginReinstalledMessage
  | PluginUninstalledMessage
  | PluginAvailableMessage
  | PluginUnavailableMessage
  | PluginUpgradableMessage
  | PluginFailedMessage
  | PluginSkippedMessage
  | PluginManualRecoveryMessage;
```

**Discriminator note:** Phase 15 uses `status` (single literal per variant) instead of `compact-line.ts`'s `kind`. The `"manual recovery"` literal contains a space -- this is TypeScript-legal and matches v1.3's `STATUS_TOKENS` array entry (see `status-tokens.ts:47`). The renderer in Phase 16 will emit the literal verbatim into the `(<status>)` slot.

### Pattern 3: Architecture-test file with type-level proofs + trivial runtime assertion

**What:** Define `type _Assert_X = ...` blocks at the top of the file (they error at typecheck time if the invariant is broken), then a single `test()` block with `assert.equal(1, 1)` so node:test counts the file.
**When to use:** Compile-time-only proofs that need to be visible in `npm run check` output.
**Example (canonical reference -- `tests/architecture/grammar-frontmatter.test.ts`):**

```typescript
// Source: tests/architecture/grammar-frontmatter.test.ts:1-50
import assert from "node:assert/strict";
import test from "node:test";

import { STATUS_TOKENS } from "../../extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts";
// ... other imports ...

test("D-CMC-04 / D-14-10 / CMC-38: STATUS_TOKENS is set-equal to style-guide frontmatter status_tokens", () => {
  assert.deepEqual([...STATUS_TOKENS].sort(), [...STATUS_TOKENS_FRONTMATTER].sort(), `...`);
});
```

The above runs a real assertion. For Phase 15's compile-check file, the `type _Assert_*` blocks do the work; the runtime body is decorative. Recommended file shape:

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEPENDENCIES,
  MARKETPLACE_STATUSES,
  PLUGIN_STATUSES,
  type Dependency,
  type MarketplaceStatus,
  type PluginStatus,
  type PluginNotificationMessage,
  // ...
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

/* === Closed-set membership === */

// Round-trip: PluginStatus IS exactly the union of PluginNotificationMessage["status"]
type _Assert_PluginStatusRoundTrip = PluginStatus extends PluginNotificationMessage["status"]
  ? PluginNotificationMessage["status"] extends PluginStatus
    ? true
    : never
  : never;
const _t1: _Assert_PluginStatusRoundTrip = true;

// PLUGIN_STATUSES tuple length is exactly 10
type _Assert_PluginStatusesLen = (typeof PLUGIN_STATUSES)["length"] extends 10 ? true : never;
const _t2: _Assert_PluginStatusesLen = true;

// MARKETPLACE_STATUSES tuple length is exactly 4
type _Assert_MarketplaceStatusesLen = (typeof MARKETPLACE_STATUSES)["length"] extends 4 ? true : never;
const _t3: _Assert_MarketplaceStatusesLen = true;

/* === Per-variant structural invariants (D-15-12) === */

// `cause?` exists ONLY on `failed` / `manual recovery`
type _Assert_CauseOnlyOnFailedAndMR =
  Extract<PluginNotificationMessage, { status: "failed" }>["cause"] extends Error | undefined
    ? Extract<PluginNotificationMessage, { status: "manual recovery" }>["cause"] extends Error | undefined
      ? true
      : never
    : never;
const _t4: _Assert_CauseOnlyOnFailedAndMR = true;

// Negative case: `installed` variant must NOT have a `cause` field
// (TypeScript: indexing a key that does not exist in an interface yields an error,
//  which `// @ts-expect-error` then verifies)
// @ts-expect-error -- `cause` is not a field on the installed variant
type _Assert_NoCauseOnInstalled = Extract<PluginNotificationMessage, { status: "installed" }>["cause"];

// ... one block per invariant per D-15-12 ...

test("Phase 15: notify type model invariants hold at compile time", () => {
  // Body intentionally trivial; the type-level assertions above ARE the proof.
  // This test exists so node:test counts the file in `npm run check` output.
  assert.equal(1, 1);
});
```

### Anti-Patterns to Avoid

- **`Pick`/`Omit` on the union to express invariants** -- `Pick<PluginNotificationMessage, "status">` collapses across variants and loses the discrimination. Use `Extract<PluginNotificationMessage, { status: "X" }>` to isolate one variant before indexed-access.
- **Type-only imports without `type` keyword** -- the ESLint config likely enforces import discipline; use `import { type X }` or `import type { X }` consistently. Check `compact-line.ts:58-59` for the precedent (separate `import type` lines).
- **Forgetting `readonly` modifier on `Dependency[]` / `Reason[]` / sub-arrays** -- SNM-06 says `readonly Dependency[]`; missing `readonly` is a downstream API contract violation. `compact-line.ts:106` (`readonly reasons?: readonly Reason[]`) is the precedent.
- **Putting `_Assert` types inside `shared/notify.ts`** -- D-15-10 LOCKS them to a separate architecture-test file (small in-file claims are discretionary; the primary surface is the separate file).
- **Treating `PluginStatus` as derived from the tuple ONLY** -- SNM-04 says derived from `PluginNotificationMessage["status"]`. The D-15-11 tuple approach is fine BECAUSE the compile-check file rounds-trips the equivalence. If the round-trip type fails, the design is broken; fix the variant `status` literals to match the tuple exactly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compile-time closed-set membership proof | Custom validation function called at runtime | `type _Assert_* = X extends Y ? true : never; const _t: _Assert_* = true;` | The TypeScript compiler IS the validator. A runtime check is dead code. |
| Discriminator exhaustiveness | Manual `if (x.status === "installed") ... else if ...` chain in tests | `Extract<Union, { status: "X" }>` + `assertNever` in switch (Phase 16) | Phase 15 doesn't author a switch; Phase 16 does. `assertNever` is already exported from `shared/errors.ts:12`. |
| Re-declaring `Scope` or `Reason` | Local copies inside `shared/notify.ts` | `import type { Scope } from "./types.ts"; import type { Reason } from "./grammar/reasons.ts";` | D-11 layering + D-15-03 LOCKS this. |
| `lastUpdatedAt` field shape | Hand-rolling a `Date` type or branded ISO string | Plain `string` matching `state-io.ts:70` | D-15-05 locks the mirror; orchestrator passes through unchanged. |

**Key insight:** Phase 15 is "types only, mostly." The only code-flavored artifact is the three `as const` tuples and the eventual compile-check file. Everything else is pure interfaces / type aliases. The temptation to "add a helper function" or "add a validator" must be resisted -- Phase 16 owns runtime behavior.

## Runtime State Inventory

Phase 15 is a pure type-declaration phase. **No runtime state migration is required.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- no database, no on-disk format change. `state-io.ts` JSON schema is untouched. | None |
| Live service config | None -- no external service touched. | None |
| OS-registered state | None -- no daemon, no scheduled task. | None |
| Secrets/env vars | None -- no environment variable consumed by new code (no new code consumes anything). | None |
| Build artifacts | None -- TypeScript compilation produces no emitted artifacts (`tsc --noEmit` per package.json scripts:84). | None |

**Why nothing here:** Phase 15 adds type declarations and one test file. No persisted state is created or modified. No on-disk format changes. The success criterion #4 explicitly requires zero call-site references -- so even at runtime, nothing in the codebase reads the new types yet.

## Common Pitfalls

### Pitfall 1: SNM-04 indexed-access compliance with D-15-11 tuple approach

**What goes wrong:** SNM-04 says "`PluginStatus` derived from `PluginNotificationMessage["status"]` via indexed access." D-15-11 says "ship a runtime `PLUGIN_STATUSES as const` tuple and derive `PluginStatus = (typeof PLUGIN_STATUSES)[number]`." If the variant `status` literals drift from the tuple entries (e.g., typo `"installeed"` in one variant), `PluginStatus` (derived from tuple) and `PluginNotificationMessage["status"]` (derived from variants) become unequal types -- but typecheck still passes because both are valid types in isolation.

**Why it happens:** The discriminator literal lives in two places: the variant interface declaration AND the tuple. They must be kept in sync manually unless an explicit round-trip proof exists.

**How to avoid:** The compile-check file MUST contain BOTH directions:

```typescript
type _Assert_PluginStatusForward = PluginStatus extends PluginNotificationMessage["status"] ? true : never;
type _Assert_PluginStatusBackward = PluginNotificationMessage["status"] extends PluginStatus ? true : never;
const _f: _Assert_PluginStatusForward = true;
const _b: _Assert_PluginStatusBackward = true;
```

If either side fails, the value assignment to `true` errors at typecheck. This is the load-bearing assertion of the entire phase.

**Warning signs:** Adding a new variant without updating `PLUGIN_STATUSES` -- or vice versa -- makes one of the two `_Assert` constants fail to type-check.

### Pitfall 2: `"manual recovery"` discriminator literal with embedded space

**What goes wrong:** The status discriminator is literally `"manual recovery"` (with a space) per `status-tokens.ts:47`. Some IDE refactors auto-convert to `"manual-recovery"` or `"manualRecovery"`; some lint rules dislike spaces in string literals.

**Why it happens:** Token-form discriminators with spaces are uncommon in TypeScript codebases; tooling can mis-suggest renames.

**How to avoid:** Use exactly `"manual recovery"` in both the variant interface (`status: "manual recovery"`) and the tuple (`"manual recovery"`). The compile-check round-trip catches any drift. The Phase 16 renderer will emit the literal token verbatim into `(<status>)` -- changing the discriminator breaks the catalog UAT downstream.

**Warning signs:** Any place that says `manualRecovery` or `manual-recovery` is wrong.

### Pitfall 3: `cause?: Error` cross-variant existence proofs need negative cases too

**What goes wrong:** Asserting `cause?: Error` exists on `failed` and `manual recovery` is straightforward (`Extract<U, {status: "failed"}>["cause"] extends Error | undefined ? true : never`). But the inverse -- "`cause` does NOT exist on the other 8 variants" -- requires `// @ts-expect-error` directive comments because indexing a non-existent field is itself a type error.

**Why it happens:** Negative invariants ("field absent") are not naturally expressible in positive type expressions.

**How to avoid:** Use the `@ts-expect-error` idiom shown in the Pattern 3 example above. Caveat: if the field is mistakenly added, the directive fires "Unused @ts-expect-error" and ESLint surfaces it (Prettier won't). The `tsconfig.json` setting `reportUnusedDisableDirectives` (or its TypeScript equivalent for `@ts-expect-error`) governs visibility; it's worth confirming this is on (CONTEXT didn't surface it; the planner should check `tsconfig.json` and `eslint.config.js`).

**Warning signs:** A negative invariant test that passes after a field is mistakenly added is a silent failure; pin behavior with `@ts-expect-error` + a comment so a future commit that drops the directive surfaces the regression.

### Pitfall 4: ESLint `no-restricted-syntax` on `ctx.ui.notify` -- the new types don't trigger it

**What goes wrong:** v1.3 has a per-file ESLint override on `shared/notify.ts` disabling `no-restricted-syntax` for `ctx.ui.notify` calls (per the v1.3 D-07 design). Phase 15 adds type declarations (no `ctx.ui.notify` call), so the override is irrelevant. But the planner should NOT add a notify call as part of Phase 15 -- the V1 wrappers stay intact, and the new `notify(ctx, payload)` consumer ships in Phase 16.

**Why it happens:** The temptation to scaffold a `notify(ctx, payload)` stub "for completeness" is real. Resist it.

**How to avoid:** The file modification scope for Phase 15 is: append new exports below the existing V1 wrappers. Don't touch lines 47-97 of `notify.ts`.

**Warning signs:** A diff that shows `ctx.ui.notify` calls anywhere is wrong for Phase 15.

### Pitfall 5: Pre-commit hook & worktree handling

**What goes wrong:** Per `/home/acolomba/pi-claude-marketplace/CLAUDE.md`: commits from inside a worktree must prefix with `SKIP=trufflehog` because the trufflehog hook's auto-updater fails under the worktree sandbox. The repo runs `pre-commit run --all-files` before commit. Failing hooks abort commit -- iterating with `--amend` after the fact is wrong (the commit didn't happen).

**Why it happens:** Standard project guardrails; not Phase-15-specific but bites every phase that lands a commit.

**How to avoid:** Run `pre-commit run --files <changed files>` BEFORE `git commit`. Fix all failures. Re-stage. Re-run. Only then commit. If inside a worktree, prefix with `SKIP=trufflehog` and separately run `pre-commit run trufflehog --all-files` outside the commit to confirm the scan is clean.

**Warning signs:** A `git commit --amend --no-verify` invocation. Both flags are banned.

### Pitfall 6: ADR refresh -- preserve the Context section, rewrite everything else

**What goes wrong:** The current ADR's Context (lines 7-16) is still accurate post-pivot -- it describes the v1.3 problem (34 lint rules, the unstructured-API drift cost). D-15-13 LOCKS "keep Context section intact." A naive end-to-end rewrite loses this.

**Why it happens:** "Refresh the ADR" reads as "rewrite the whole document."

**How to avoid:** Preserve verbatim:
- Title line (header text stays)
- Status line: change "Proposed" → "Accepted"; add `(Phase 15, 2026-05-25)` annotation
- Date line (update to `2026-05-25`)
- Supersedes line (update if necessary)
- Context section (lines 7-16): UNCHANGED

Rewrite:
- Decision section (lines 18-91): single `notify(ctx, payload)` + discriminated union shape per D-15-13.
- Consequences section (lines 92-142): reflect new SNM-* requirements (computed severity, computed reload hint, per-plugin causes, always-marketplace-header, `Dependency` closed set, `PluginStatus`/`MarketplaceStatus` named enums, dropped top-level trailer).
- Alternatives section: Patch Alternative 2 from "Rejected" to "Accepted" with explanatory note per D-15-16. Keep Alternatives 1, 3, 4, 5, 6 rejected with their original reasoning.
- Migration section (lines 158-165): Rewrite to cite Phase 16 (renderer), Phase 17 (spec + catalog UAT), Phases 18-20 (call-site migration waves: marketplace / plugin / edge+UsageError), Phase 21 (V1 wrapper deletion + GREEN gate). The REQUIREMENTS.md traceability table is the drift mitigation per D-15-15.
- Open questions section (lines 167-170): DELETE entirely per D-15-14. Q1 (cascade-section abstraction) resolved by single `PluginNotificationMessage` union; Q2 (runtime validation) resolved by compile-enforced discriminated union + `assertNever`.

**Warning signs:** A diff that touches lines 7-16 of the current ADR is wrong.

### Pitfall 7: Net code delta budget for the milestone

**What goes wrong:** Milestone-level target is `~4300 LoC removed` overall. Phase 15 adds: ~120 LoC of types (10 variants × ~8 lines + 4 supporting types + 3 const arrays) + ~80 LoC of compile-check file. Net ~+200 LoC in Phase 15. This is fine; the deletion happens in Phase 21.

**Why it happens:** Misreading the milestone budget as a per-phase budget.

**How to avoid:** No action -- Phase 15 ADDS code. Net negative happens in Phase 21.

**Warning signs:** A reviewer flagging "Phase 15 grows the codebase" misunderstands the milestone shape.

## Code Examples

### Example 1: `PluginInstalledMessage` variant (SNM-03 + SNM-06 + SNM-11)

```typescript
// Source: synthesized from REQUIREMENTS.md SNM-03/06/11 + D-15-02/15-11
// File: extensions/pi-claude-marketplace/shared/notify.ts (appended after V1 wrappers)
import type { Scope } from "./types.ts";

export const DEPENDENCIES = ["agents", "mcp"] as const;
export type Dependency = (typeof DEPENDENCIES)[number];

export interface PluginInstalledMessage {
  readonly status: "installed";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly dependencies: readonly Dependency[];
}
```

### Example 2: `PluginUpdatedMessage` (SNM-03 + D-15-04 `from`/`to`)

```typescript
// Source: D-15-04 (from: string; to: string REQUIRED on `updated`)
export interface PluginUpdatedMessage {
  readonly status: "updated";
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly scope?: Scope;
  readonly dependencies: readonly Dependency[];
}
```

### Example 3: `PluginFailedMessage` (SNM-09 + SNM-10 + D-15-01)

```typescript
// Source: SNM-09 (rollbackPartial), SNM-10 (cause), D-15-01 (reasons required)
import type { Reason } from "./grammar/reasons.ts";

export interface PluginFailedMessage {
  readonly status: "failed";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons: readonly Reason[];
  readonly cause?: Error;
  readonly rollbackPartial?: readonly { readonly phase: string; readonly cause?: Error }[];
}
```

### Example 4: `MarketplaceDetails` (SNM-07 + D-15-05)

```typescript
// Source: D-15-05; mirrors state-io.ts:70 `lastUpdatedAt?: string`
export interface MarketplaceDetails {
  readonly autoupdate: boolean;
  readonly lastUpdatedAt?: string;
}
```

### Example 5: Compile-check file shape

```typescript
// File: tests/architecture/notify-types.test.ts
// Source: pattern lifted from grammar-frontmatter.test.ts; type-level proofs added per D-15-12
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEPENDENCIES,
  MARKETPLACE_STATUSES,
  PLUGIN_STATUSES,
  type Dependency,
  type MarketplaceStatus,
  type PluginNotificationMessage,
  type PluginStatus,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// === Closed-set membership ===

type _Assert_PluginStatusForward = PluginStatus extends PluginNotificationMessage["status"] ? true : never;
type _Assert_PluginStatusBackward = PluginNotificationMessage["status"] extends PluginStatus ? true : never;
const _pf: _Assert_PluginStatusForward = true;
const _pb: _Assert_PluginStatusBackward = true;

type _Assert_PluginStatusesLen = (typeof PLUGIN_STATUSES)["length"] extends 10 ? true : never;
type _Assert_MarketplaceStatusesLen = (typeof MARKETPLACE_STATUSES)["length"] extends 4 ? true : never;
type _Assert_DependenciesLen = (typeof DEPENDENCIES)["length"] extends 2 ? true : never;
const _l1: _Assert_PluginStatusesLen = true;
const _l2: _Assert_MarketplaceStatusesLen = true;
const _l3: _Assert_DependenciesLen = true;

// === Per-variant invariants (D-15-12) ===

// `cause?: Error` ONLY on `failed` and `manual recovery`
type _CausePresent = Extract<PluginNotificationMessage, { status: "failed" }>["cause"] extends Error | undefined
  ? Extract<PluginNotificationMessage, { status: "manual recovery" }>["cause"] extends Error | undefined
    ? true
    : never
  : never;
const _cp: _CausePresent = true;

// `rollbackPartial?` ONLY on `failed`
type _RollbackOnFailed = Extract<PluginNotificationMessage, { status: "failed" }> extends {
  rollbackPartial?: readonly { phase: string; cause?: Error }[];
}
  ? true
  : never;
const _rb: _RollbackOnFailed = true;

// `dependencies: readonly Dependency[]` REQUIRED on installed/updated/reinstalled
type _DepsRequired =
  Extract<PluginNotificationMessage, { status: "installed" }>["dependencies"] extends readonly Dependency[]
    ? Extract<PluginNotificationMessage, { status: "updated" }>["dependencies"] extends readonly Dependency[]
      ? Extract<PluginNotificationMessage, { status: "reinstalled" }>["dependencies"] extends readonly Dependency[]
        ? true
        : never
      : never
    : never;
const _dr: _DepsRequired = true;

// `scope?` absent on `available` and `unavailable` (SNM-11)
// (negative-presence requires `@ts-expect-error` to assert the property is genuinely absent)
// @ts-expect-error -- SNM-11: `available` variant has NO `scope` field
type _NoScopeAvailable = Extract<PluginNotificationMessage, { status: "available" }>["scope"];
// @ts-expect-error -- SNM-11: `unavailable` variant has NO `scope` field
type _NoScopeUnavailable = Extract<PluginNotificationMessage, { status: "unavailable" }>["scope"];

// `from` / `to` only on `updated`
type _FromToUpdated = Extract<PluginNotificationMessage, { status: "updated" }> extends {
  from: string;
  to: string;
}
  ? true
  : never;
const _ft: _FromToUpdated = true;

// ... add one block per D-15-12 invariant ...

test("Phase 15: notify type model invariants hold at compile time", () => {
  // Type-level _Assert_* assignments above carry the proof; this body exists
  // so node:test counts the file in `npm run check` output (matches the
  // grammar-frontmatter.test.ts precedent).
  assert.equal(1, 1);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-outcome typed wrappers (`notifyPluginInstalled`, `notifyPluginUpdated`, ...) per the original ADR | Single `notify(ctx, NotificationMessage)` entrypoint with discriminated union | v1.4 design pivot (between ADR draft and CONTEXT.md decisions) | Phase 15 ADR refresh documents the pivot (D-15-16 flip of Alternative 2 Rejected → Accepted) |
| Top-level `cause: Error` and trailer on `NotificationMessage` | Per-plugin `cause?: Error` on `failed` / `manual recovery` variants; no top-level trailer (computed reload-hint instead) | v1.4 SNM-10 | Cascade with multiple failures now surfaces each plugin's cause chain separately. Phase 16 implements; Phase 15 just declares the field. |
| Top-level `severity: "info" \| "warning" \| "error"` field | Computed from contents inside `notify()` switch | v1.4 SNM-14 | NotificationMessage has NO `severity` field (SNM-01 explicit). Phase 16 computes; Phase 15 omits the field. |
| `declaresAgents: boolean` / `declaresMcp: boolean` per-row booleans | `dependencies: readonly Dependency[]` closed-set array | v1.4 SNM-06 | Closed set forces compile-time exhaustiveness in Phase 16's per-dependency probe switch. |
| Separate `(rollback failed)` plugin status | Sub-state of `failed` via `rollbackPartial?: readonly {...}[]` | v1.4 SNM-09 | One fewer top-level discriminator; the rollback-children render-time concern stays in Phase 16's renderer. |

**Deprecated/outdated:**

- v1.3 `STATUS_TOKENS` array's `"rollback failed"` entry: still present in `shared/grammar/status-tokens.ts:46` -- Phase 21 (SNM-29) decides retire-or-keep for the entire `shared/grammar/` directory. Phase 15 leaves it alone.
- v1.3 `REASONS` array's `"rollback partial"`, `"requires pi-subagents"`, `"requires pi-mcp"` entries: still present per D-15-03; structurally absorbed by `rollbackPartial[]` / `dependencies[]` but not removed from the array in Phase 15.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tsconfig.json` has strict mode + `reportUnusedDisableDirectives` (or equivalent) enabled; otherwise `@ts-expect-error` in negative-invariant assertions may silently pass when the field IS added | Pitfall 3 | Negative invariants become weak; planner should verify in Plan 02 by inspecting `tsconfig.json` |
| A2 | `node:test` runs `tests/architecture/notify-types.test.ts` under the existing `npm test` script's glob pattern `tests/{architecture,...}/**/*.test.ts` -- the file naming convention `*.test.ts` is enforced by the package.json:76 script invocation | Code Examples §Example 5 | If filename pattern drifts (e.g., `notify-types.test.tsx`), the runner won't pick it up; the test would silently not run while typecheck still proves correctness. Plan 02's verification step should grep for the file in the test run output. |
| A3 | The current ADR commit hash `492d9c4` referenced in REQUIREMENTS.md is the right baseline; the Status/Date/Supersedes lines are still at lines 3-5 of `docs/adr/v2-001-structured-notify.md` | ADR refresh (Pitfall 6) | If the ADR has been touched between CONTEXT.md gathering and plan execution, the line numbers shift. Plan 03 should `git log -p docs/adr/v2-001-structured-notify.md` to confirm baseline. |
| A4 | The `package.json` `test` script glob (line 76) doesn't change between Phase 15 commits | Validation Architecture | If anyone modifies the glob during Phase 15, the compile-check file could fall out of the run silently. The plan-checker should flag any package.json change. |

## Open Questions

1. **Where does `Reason` get imported FROM in the new variants?**
   - What we know: D-15-03 says imported unchanged from `shared/grammar/reasons.ts`.
   - What's unclear: Whether `shared/notify.ts` should ALSO re-export `Reason` for a single-import surface, or callers import from both.
   - Recommendation: Re-export `Reason` (and possibly the runtime `REASONS` tuple) from `shared/notify.ts` -- it's a one-line addition (`export type { Reason } from "./grammar/reasons.ts";`) and reduces the number of imports a Phase 16 / Phase 18-20 call-site author needs to write. The drift test against the frontmatter still binds the runtime source. Discretionary per CONTEXT.

2. **Negative-invariant assertion idiom -- `@ts-expect-error` vs. conditional-typed never?**
   - What we know: The "field absent on variant X" assertion is hard to express purely positively.
   - What's unclear: Whether to use `@ts-expect-error` on a `["field"]` index access, OR use a conditional type like `Extract<U, {status: "X"}> extends {field?: unknown} ? never : true` (which fires `true` when the field IS absent).
   - Recommendation: Try the conditional-type idiom first; it's cleaner and self-documenting. Fall back to `@ts-expect-error` if the conditional flames out on overload resolution. Discretionary per CONTEXT.

3. **Should the compile-check file also assert the V1 wrappers are untouched (success criterion #4)?**
   - What we know: SC #4 says "zero call-site references to new types yet."
   - What's unclear: Whether to add a grep-based test in `notify-types.test.ts` that asserts no file in `extensions/` imports any of the new symbols.
   - Recommendation: Don't add the grep test to Phase 15. The criterion is true by construction (no other code is touched). Adding the grep test would be a maintenance burden once Phase 16 lands (the test would then need an ignore list). The `npm run check` GREEN is sufficient evidence; a Phase 15 verifier can do the grep manually.

## Environment Availability

Phase 15 introduces no new external dependencies. All required tooling is already installed and configured.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `typescript` (typecheck) | `_Assert_*` proofs | ✓ | `^6.0.3` | -- |
| `node:test` runner | architecture-test file count | ✓ | bundled (Node ≥22) | -- |
| `node` runtime | `npm run check` | ✓ | `>=20.19.0` per package.json:67 | -- |
| `eslint` (lint pass) | `npm run check` | ✓ | `^10.4.0` | -- |
| `prettier` (format check) | `npm run check` | ✓ | `^3.8.3` | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node ≥22) |
| Config file | none -- driven by `package.json` `test` script (line 76) |
| Quick run command (during dev) | `npx tsc --noEmit && node --test tests/architecture/notify-types.test.ts` |
| Full suite command | `npm run check` (= `npm run typecheck && npm run lint && npm run format:check && npm test`) |
| Sole load-bearing assertion | TypeScript compilation success of `_Assert_*` types (`true` value assignments to conditional types that resolve to `never` on invariant failure) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SNM-01 | `NotificationMessage = { marketplaces: readonly MarketplaceNotificationMessage[] }`, no `severity`, no `trailer` | typecheck (`_Assert` block) | `npm run typecheck` | ❌ Wave 0 (notify-types.test.ts new file) |
| SNM-02 | `MarketplaceNotificationMessage = { name; scope; status?; details?; plugins }` | typecheck (`_Assert` block) | `npm run typecheck` | ❌ Wave 0 |
| SNM-03 | `PluginNotificationMessage` = 10-variant discriminated union on `status` | typecheck round-trip `_Assert_PluginStatusForward/Backward` | `npm run typecheck` | ❌ Wave 0 |
| SNM-04 | `PluginStatus` derived via indexed access; round-trips with union | typecheck round-trip `_Assert_PluginStatusForward/Backward` | `npm run typecheck` | ❌ Wave 0 |
| SNM-05 | `MarketplaceStatus = "added" \| "removed" \| "updated" \| "failed"` | typecheck (`_Assert_MarketplaceStatusesLen`) + literal-match block | `npm run typecheck` | ❌ Wave 0 |
| SNM-06 | `Dependency = "agents" \| "mcp"`; required on installed/updated/reinstalled | typecheck (`_Assert_DepsRequired`) | `npm run typecheck` | ❌ Wave 0 |
| SNM-07 | `MarketplaceDetails = { autoupdate; lastUpdatedAt? }` | typecheck (`_Assert` shape) | `npm run typecheck` | ❌ Wave 0 |
| SNM-08 | `UsageErrorMessage = { message; usage }` | typecheck (`_Assert` shape) | `npm run typecheck` | ❌ Wave 0 |
| SNM-09 | `rollbackPartial?` only on `failed` | typecheck (`_Assert_RollbackOnFailed` + `@ts-expect-error` on other 9) | `npm run typecheck` | ❌ Wave 0 |
| SNM-10 | `cause?` only on `failed` and `manual recovery` | typecheck (`_Assert_CausePresent` + `@ts-expect-error` on other 8) | `npm run typecheck` | ❌ Wave 0 |
| SNM-11 | `scope?` on all variants EXCEPT `available` / `unavailable` | typecheck (`_Assert_ScopeOnVariants` + `@ts-expect-error` on `available`/`unavailable`) | `npm run typecheck` | ❌ Wave 0 |
| SNM-21 | ADR `docs/adr/v2-001-structured-notify.md` refreshed: Proposed → Accepted | manual-only (markdown content review) | grep `"Status: Accepted"` in ADR + manual review | ✗ manual-only |
| (cross) | `npm run check` stays GREEN | composite (typecheck + lint + format + tests) | `npm run check` | ✓ existing |
| (cross) | No call-site references new types in Phase 15 (Success Criterion #4) | manual grep | `grep -r "PluginNotificationMessage\|NotificationMessage\|MarketplaceNotificationMessage\|UsageErrorMessage\|PluginStatus\|MarketplaceStatus\|Dependency\|MarketplaceDetails" extensions/ \| grep -v shared/notify.ts \| grep -v tests/architecture/notify-types.test.ts` returns empty | ✓ existing (grep) |

### Sampling Rate

- **Per task commit:** `npm run typecheck` (~5-10s) -- catches every `_Assert_*` regression.
- **Per plan merge:** `npm run check` (full pipeline) -- typecheck + lint + format + node:test.
- **Phase gate (before `/gsd-verify-work`):** `npm run check` GREEN + ADR grep `Status: Accepted` + Success Criterion #4 grep returns empty.

### Wave 0 Gaps

- [ ] `tests/architecture/notify-types.test.ts` -- new file; covers SNM-01..SNM-11 via `_Assert_*` types + `assert.equal(1, 1)` body. Pattern reference: `tests/architecture/grammar-frontmatter.test.ts`.

(No other gaps -- TypeScript, node:test, ESLint, Prettier already configured; `npm run check` script already wired.)

### Manual-Only Justification

- **SNM-21 (ADR refresh)** is documentation content. While the `Status: Accepted` line can be grepped, the body refresh (Decision section rewrite, Alternative 2 flip, Migration phase references, Open questions removal) requires human review of prose against D-15-13..D-15-16. A `pre-commit` hook (markdownlint, vale, etc.) cannot validate semantic correctness of an architectural decision document.

## Security Domain

`security_enforcement` is absent in `.planning/config.json` (treated as enabled). However, Phase 15 introduces NO authentication, authorization, session management, input validation, or cryptography surface. All work is type declarations + a markdown ADR.

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | no | (Phase 16 may introduce a TypeBox runtime validator IF callers need it; Phase 15 does not) |
| V6 Cryptography | no | -- |

**Known threat patterns for this stack:** None applicable. The phase adds pure type declarations consumed only by typecheck. Supply-chain attacks via new packages: N/A (zero new packages). Prototype pollution via `as const` arrays: N/A (arrays are read-only at compile time and `Object.freeze`-equivalent semantically).

## Project Constraints (from CLAUDE.md)

- **Never commit to `main`.** Use `features/*` or `releases/*` branches. Current branch (`gsd/v1.3-replan-catalog`) needs verification before Phase 15 work begins -- if Phase 15 needs its own feature branch per the GSD workflow, the planner should create it.
- **Conventional Commits required.** Title 5-72 chars; body lines ≤80 chars.
- **Run `pre-commit run --files <changed files>` BEFORE `git commit`.** Don't iterate with `--amend` after hook failure.
- **Never use `--no-verify` or `--no-gpg-sign`.**
- **If committing from inside a worktree:** prefix with `SKIP=trufflehog`; run `pre-commit run trufflehog --all-files` separately to confirm the scan is clean.
- **Versioning:** Before creating a PR, offer to bump `project.json` and `sonar.properties`, and record in `CHANGELOG.md`. (Phase 15 in isolation may not need a version bump -- types are not user-visible yet; milestone-end is the natural bump point.)
- **GSD Workflow Enforcement:** Direct `Edit` / `Write` only after entering through a GSD command (`/gsd-execute-phase` for planned phase work). Phase 15 is the planned-phase path.

## Sources

### Primary (HIGH confidence)

- Codebase grep: `extensions/pi-claude-marketplace/shared/notify.ts` (current 97-line V1 wrapper file; locations of `notifySuccess` line 48, `notifyWarning` line 53, `notifyError` line 76, `notifyUsageError` line 95)
- Codebase grep: `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts:34-52` (canonical `as const` tuple + indexed-access pattern)
- Codebase grep: `extensions/pi-claude-marketplace/shared/grammar/reasons.ts:41-72` (`REASONS` array, 28 entries, `Reason` derived type, 3 structurally-absorbed entries inline-commented)
- Codebase grep: `extensions/pi-claude-marketplace/shared/types.ts:17-20` (`Scope = "user" | "project"` + `SCOPES` tuple)
- Codebase grep: `extensions/pi-claude-marketplace/persistence/state-io.ts:70` (`lastUpdatedAt: Type.Optional(Type.String())` ISO string shape)
- Codebase grep: `extensions/pi-claude-marketplace/presentation/compact-line.ts:96-259` (9-variant `RowSpec` discriminated-union with named per-variant interfaces; `Extract<StatusToken, "x"|"y">` carve-out idiom)
- Codebase grep: `extensions/pi-claude-marketplace/shared/errors.ts:12` (`assertNever` already exported for Phase 16 use)
- Codebase grep: `tests/architecture/grammar-frontmatter.test.ts:1-91` (architecture-test file shape; node:test import; `assert.deepEqual` invariant tests)
- Codebase grep: `tests/architecture/no-legacy-markers.test.ts:46-87` (constant-pinned literals + ALLOW_LIST pattern; not directly used but informs Pitfall 4 messaging)
- Codebase grep: `package.json:71-84` (`check`, `test`, `typecheck`, `lint`, `format:check` scripts; test glob `tests/{architecture,...}/**/*.test.ts`)
- Codebase grep: `.planning/REQUIREMENTS.md:14-27` (SNM-01..SNM-11 type-shape requirements; SNM-21 ADR refresh)
- Codebase grep: `.planning/phases/15-type-model-adr-refresh/15-CONTEXT.md` (locked decisions D-15-01..D-15-16, deferred ideas, claude's discretion areas)
- Codebase grep: `.planning/ROADMAP.md:82-99` (Phase 15 goal + 4 success criteria + requirement list)
- Codebase grep: `.planning/PROJECT.md:13-32` (v1.4 milestone goal + net-LoC-delta target + scope)
- Codebase grep: `docs/adr/v2-001-structured-notify.md:1-170` (current ADR; status `Proposed`, lines 7-16 Context section to preserve, lines 18-91 Decision to rewrite, lines 92-142 Consequences to rewrite, lines 144-156 Alternatives to patch, lines 158-165 Migration to rewrite, lines 167-170 Open questions to delete)
- CLAUDE.md (project) -- branch policy, commit conventions, pre-commit hook + worktree handling, versioning offer

### Secondary (MEDIUM confidence)

- TypeScript discriminated-union idioms (general knowledge, not version-specific): `Extract<U, { discriminator: "X" }>` for per-variant carve-outs; `@ts-expect-error` for negative-invariant assertions; `as const` tuple + `(typeof X)[number]` for derived literal unions. These are stable since TypeScript 4.x and require no version verification for TypeScript 6.x.

### Tertiary (LOW confidence)

None. Phase 15 is fully grounded in codebase precedent + locked CONTEXT.md decisions.

## Plan Granularity Recommendation

Three atomic plans (one commit each), each leaving `npm run check` GREEN:

| # | Plan | Files Touched | Commit Message Skeleton |
|---|------|---------------|-------------------------|
| 01 | Add type model + const arrays to `shared/notify.ts` | `extensions/pi-claude-marketplace/shared/notify.ts` (append below line 97) | `feat(notify): add v1.4 structured type model (SNM-01..SNM-11)` |
| 02 | Add compile-check architecture test | `tests/architecture/notify-types.test.ts` (new) | `test(notify-types): assert closed-set membership + per-variant invariants` |
| 03 | Refresh ADR end-to-end | `docs/adr/v2-001-structured-notify.md` (edit) | `docs(adr): refresh v2-001 -- single-notify locked design (SNM-21)` |

**Why this order:** Plan 01 ships the types without a consumer -- `npm run check` GREEN proves syntactic and ESM correctness. Plan 02 wires the compile-check; if `_Assert_*` types fail, Plan 02 catches the regression before any reviewer reads Plan 03. Plan 03 is documentation-only; merging it before Plan 02 risks shipping an "Accepted" ADR with a still-broken type model.

**Alternative:** Single large commit covering all three files. Acceptable per atomic-per-plan compliance (each plan is one commit) but loses bisectability and makes pre-commit hook failures harder to localize. The 3-commit shape is recommended.

**Branch:** Phase 15 needs a feature branch per CLAUDE.md ("never commit to main"). Current branch is `gsd/v1.3-replan-catalog`; planner should confirm with `git status` whether a new `features/v1.4-phase-15-type-model-adr` branch (or worktree under `.worktrees/`) is the right shape, OR whether Phase 15 lands on the v1.4 milestone branch.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- zero new packages; all tooling already in `package.json`.
- Architecture patterns: HIGH -- three direct in-codebase precedents (`status-tokens.ts`, `compact-line.ts` `RowSpec`, `grammar-frontmatter.test.ts`).
- Pitfalls: HIGH -- 6 of 7 pitfalls grounded in concrete codebase artifacts; Pitfall 7 (net code delta budget) is informational and unactionable but worth flagging to reviewers.
- ADR refresh diff plan: HIGH -- read the current ADR end-to-end; section line-numbers verified.
- Compile-check idioms: MEDIUM-HIGH -- the negative-invariant `@ts-expect-error` idiom is standard but project-specific tsconfig settings could affect behavior (logged as A1).

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (30 days; pure type/docs work has minimal exposure to ecosystem drift; the only concern would be a TypeScript 6.x patch that changed discriminated-union resolution -- unlikely on a 30-day horizon)
