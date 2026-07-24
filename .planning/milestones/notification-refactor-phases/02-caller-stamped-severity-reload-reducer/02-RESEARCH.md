# Phase 2: Caller-stamped severity & reload reducer - Research

**Researched:** 2026-06-24
**Domain:** TypeScript discriminated-union refactor of an in-repo notification reducer (`shared/notify.ts`), output-preserving relocation of severity/reload derivation from one central reducer to ~18 producers
**Confidence:** HIGH (all findings verified by direct codebase reads; no external library uncertainty)

## Summary

This phase is a pure internal-refactor of `extensions/pi-claude-marketplace/shared/notify.ts` (3383 lines) and its ~18 producers. It deletes the content-derived severity/reload ladders (`BENIGN_REASONS`, `allBenign`, `cascadeSeverity`, `reconcileAppliedSeverity`, the `computeSeverity` cascade branch, the `shouldEmitReloadHint` status-token trigger set + `disable-cascade` straddle) and replaces them with a dumb reducer: emission severity = numeric MAX over `row.severity` (info=0<warning=1<error=2), `/reload` trailer iff OR-reduce of `row.needsReload`, and row tallies by stamped facts. Every producer stamps `severity`/`needsReload` to **reproduce today's exact emitted bytes** — `catalog-uat` stays BYTE-IDENTICAL (D-01). No external dependencies, no new packages: there is no Standard Stack / Package Legitimacy / Environment Availability section to fill (the existing toolchain — Node>=20.19.0, TS strict, ESM, `node:test`, the `npm run check` gate — is unchanged).

Phase 1 already shipped the scaffolding this phase activates: `MessageBase.severity?`/`needsReload?` exist as **optional, inert** fields (notify.ts:606-609); the per-command `CommandContext` + render maps + `notifyWithContext`/`emitContextCascade` spine exist (`shared/notify-context.ts`); and `tests/shared/notify-inert-fields.test.ts` pins the fields as inert. This phase flips them live. The two enforcement risks are (1) the **type-level GATE-01 primary** — narrowing `severity`+`needsReload` to *required* on the transition message interfaces so a producer omitting them is a TS2741 compile error; and (2) the **D-05 architecture-test backstop** for the one producer family that builds rows by projection rather than through a command render map: `orchestrators/reconcile/notify.ts`.

**Primary recommendation:** Sequence as: (W1) introduce a `TransitionMessage` narrowing that makes `severity`/`needsReload` required on the 5 transition arms + flip the reducer to read the fields (max-severity / OR-needsReload / tally) while the producers still compile because every transition row gets stamped in the same wave; (W2) delete the dead content-ladder constructs and collapse `present`→`installed` + remove the `disable-cascade` kind; (W3) add the D-05 runtime arch-test backstop and supersede `notify-inert-fields.test.ts`. Gate every step on `catalog-uat` byte-equality + `npm run check`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (output-preserving):** Phase 2 stamps `severity`/`needsReload` to **reproduce today's exact emitted output** — `catalog-uat` stays **byte-identical**, no fixture rewrites. The relocation is mechanism-only.
- **D-02 (divergence deferred):** Divergent desired-state judgments that *change* output (install-already→`error`; update-up-to-date→`info`) are **deferred to Phase 3**, landing atomically with the catalog supersession. SEV-05's *capability* is established structurally here; its *exercise* is Phase 3.
- **D-03 (severity reproduction map):** Each producer stamps the severity the current content ladder would have computed:
  - `failed` (plugin or mp) → `error`
  - `manual recovery` → `warning`
  - `skipped` whose reasons are NOT all-benign → `warning`; `skipped` that is a benign idempotent no-op → `info` (the producer knows which — it replaces the deleted `BENIGN_REASONS`/`allBenign` content lookup with its own desired-vs-actual knowledge at the emit site)
  - all success/inventory rows → `info` (absent severity)
  - `notify()` emits the host `severity` arg as the numeric **max** over rows (`info=0 < warning=1 < error=2`), no reason/status inference (SEV-02).
- **D-04 (GATE-01 type-level primary):** `severity` and `needsReload` are made **required on the state-change (transition) message types** — omitting either on a transition row is a **compile error (TS2741-class)**. Non-transition (list/info inventory) rows keep the fields **optional** (absent severity defaults `info`, absent `needsReload` defaults `false`). Mechanically: the transition message interfaces redeclare the two base fields as required (interface narrowing over the optional `MessageBase`).
- **D-05 (architecture-test backstop):** A **thin architecture-test backstop** remains for projected/dynamic rows the type system can't reach — notably the reconcile-applied cascade projection in `reconcile/notify.ts`. The test asserts every cascade-producing orchestrator stamps both fields on its state-change rows.
- **D-06 (needsReload stamping):** **Only successful state transitions** stamp `needsReload: true`: `installed`, `uninstalled`, `updated`, `reinstalled`, and the realized enable/disable transitions. Everything else stamps `false`: `failed`, `skipped`, `manual recovery`, and all list/info inventory rows (`available`, `unavailable`, `upgradable`, list-surface `installed`, `disabled`). Reproduces today's reload-hint trigger set exactly.
- **D-07 (OR-reduce trailer + disable-cascade removal):** `notify()` emits the `/reload to pick up changes` trailer **iff the OR-reduce of `needsReload` over all rows is true** (RLD-02), no status-token inference. The `disable` command stamps `needsReload: true` on its realized rows directly — which lets the `disable-cascade` cascade *kind* be removed (RLD-05).
- **D-08 (present→installed collapse, RLD-04):** The `present` plugin status collapses into `installed`. Its reload-suppression role is now `needsReload: false` on the list-surface `installed` row. **RENDERED BYTES stay byte-identical** — a status-token/needsReload change, not a rendered-bytes change. (Catalog `present`→`installed` grammar collapse is Phase 3 / OUT-08; here the runtime status collapses but rendered bytes are preserved.)

### Claude's Discretion

- Exact TypeScript shape for narrowing the two base fields to required on transition interfaces (interface extension vs. `Required<>`-style utility vs. a transition base type), provided omission on a transition row is a compile error and non-transition rows keep them optional.
- The architecture-test mechanism (AST walk vs. runtime introspection of producer outputs vs. a typed registry of transition statuses) for the D-05 backstop.
- How each skip-emitting site determines benign-vs-actionable to reproduce today's severity (D-03) — the producer's own desired-vs-actual judgment replacing the deleted content lookup; `catalog-uat` byte gate catches any drift.

### Deferred Ideas (OUT OF SCOPE)

- **Divergent desired-state severities** (install-already→error, update-up-to-date→info, and any case where caller judgment differs from today's content ladder) → **Phase 3**, landing atomically with the catalog supersession (D-02).
- **Catalog markdown `present`→`installed` grammar collapse + fixture rewrites** → **Phase 3 / OUT-08** (this phase preserves rendered bytes).
- **Summary surface redesign** (leading severity sentence, trailing tally, header invariants) → **Phase 3**.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEV-01 | Every outcome row carries caller-stamped `severity`; absent defaults `info`. | `MessageBase.severity?` already present (notify.ts:606-609). D-04 narrows it to required on transitions; non-transitions keep optional+default. |
| SEV-02 | `notify()` derives emission severity as numeric MAX over rows; no content inference. | Rewrite `computeSeverity` cascade branch → `max(info=0,warning=1,error=2)` over `row.severity`; delete `cascadeSeverity` (notify.ts:2198-2237). |
| SEV-03 | Tri-state desired-state contract documented (info=at-desired, warning=fell-short, error=could-not). | Document in the reducer doc-comment + style guide; D-03 mapping reproduces today's outputs. |
| SEV-04 | `BENIGN_REASONS`, `allBenign`, content-derived `cascadeSeverity` removed; severity no longer reads `reasons`. | Delete notify.ts:150-168 (`BENIGN_REASONS`/`allBenign`) + 2198-2245 (`cascadeSeverity`/`reconcileAppliedSeverity`). |
| SEV-05 | Each command stamps from its own desired-vs-actual judgment (capability). | Structural capability established by per-producer stamping; *exercise* deferred to Phase 3 (D-02). |
| RLD-01 | Every row carries caller-stamped `needsReload` boolean. | `MessageBase.needsReload?` present; D-04/D-06 wire it live. |
| RLD-02 | `notify()` emits trailer iff OR-reduce of `needsReload` true. | Rewrite `shouldEmitReloadHint` (notify.ts:2507-2564) → `rows.some(r => r.needsReload === true)`. |
| RLD-03 | `shouldEmitReloadHint` status-token mapping removed. | Delete the `installed/updated/reinstalled/uninstalled` trigger loop + `disabledIsTransition` (notify.ts:2548-2561). |
| RLD-04 | `present` collapses into `installed`; reload suppression via `needsReload: false`. | D-08. Delete `PluginPresentMessage` (notify.ts:764-771) + `"present"` from PLUGIN_STATUSES; list emits `installed` with `needsReload:false`. Bytes preserved (renderer arm identical). |
| RLD-05 | `disable-cascade` cascade kind removed; disable stamps `needsReload:true`, list/info `false`. | D-07. Remove `"disable-cascade"` from the kind union (notify.ts:1057, notify-context.ts:137) + all references. |
| GATE-01 | Architecture test asserts every cascade-producing orchestrator stamps both fields on state-change rows. | D-04 type-level primary (transition interfaces required) + D-05 runtime backstop for `reconcile/notify.ts`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stamping caller intent (`severity`/`needsReload`) | Producer (orchestrators) | Type system (transition interfaces) | SEV-05/RLD-01: the command owns desired-vs-actual judgment at the emit site. |
| Reducing rows → emission severity + reload trailer | Reducer (`shared/notify.ts`) | — | SEV-02/RLD-02: `notify()` is the single dumb reducer. |
| Enforcing "transition rows must stamp both fields" | Type system (compile error) | Architecture test (runtime backstop) | D-04 primary + D-05 for projected rows the type checker can't reach. |
| Rendering row bytes | Per-command render maps + shared vocabulary | — | Unchanged from Phase 1; output-preserving. |
| Byte-equality verification | `catalog-uat` + `docs/output-catalog.md` | `npm run check` | GATE-02/GATE-03 — end-to-end correctness gate that stamps reproduce today's output. |

## Standard Stack

**Not applicable — no external packages introduced.** This is an in-repo refactor. The toolchain is fixed and unchanged from V1/Phase 1:

| Tool | Version (from package.json) | Role |
|------|------------------------------|------|
| TypeScript | strict mode, `tsc --noEmit` | Type-level GATE-01 (D-04) `[VERIFIED: package.json]` |
| `node:test` | bundled (Node>=20.19.0) | Test runner — `node --test` over `tests/{architecture,…}/**/*.test.ts` `[VERIFIED: package.json scripts.test]` |
| ESLint + Prettier | flat config | `npm run lint` / `format:check` `[VERIFIED: package.json]` |

No `## Package Legitimacy Audit`, no `## Environment Availability` — this phase installs nothing and depends on no external tool beyond the existing `npm run check` pipeline.

## Architecture Patterns

### System Architecture Diagram

```
                     PRODUCER TIER (~18 orchestrators)
                     ──────────────────────────────────
  install.ts ──┐
  update.ts  ──┤  build MarketplaceRows<Msg> object literals, each plugin row
  uninstall  ──┤  STAMPING severity + needsReload (D-03/D-06)         ┌── transition rows:
  reinstall  ──┤      { status:"installed", …, severity:"info",       │   required fields
  enable/dis ──┤        needsReload:true }                            │   (TS2741 if omitted)
  list.ts    ──┤      { status:"failed", …, severity:"error",         │
  add/remove ──┤        needsReload:false }                           └── list/info rows:
  autoupdate ──┤                                                          optional → defaults
  import     ──┤              │
  reconcile  ──┘              │ notifyWithContext(ctx,pi,CTX,rows)
       │ (projection)         │   OR raw notify(ctx,pi,message)
       │ builds rows directly │
       ▼                      ▼
  reconcile/notify.ts    shared/notify-context.ts
  (D-05 backstop:        (emitContextCascade)
   not render-map         │
   reached)               ▼
       └────────────►  shared/notify.ts :: notify()  ── THE DUMB REDUCER ──
                          │
                          ├─ computeSeverity:  MAX over row.severity  (info<warning<error)
                          ├─ reloadHint:       OR-reduce row.needsReload  → RELOAD_HINT_TRAILER
                          ├─ tally:            count rows by stamped severity
                          ▼
                       emitWithSummary → ctx.ui.notify(text, severity?)   (single IL-2 call)
                          ▼
                       BYTE-IDENTICAL to today  ◄── catalog-uat gate (D-01/GATE-02)
```

### Component Responsibilities

| File | Role in this phase |
|------|--------------------|
| `shared/notify.ts` | DELETE content ladders; REWRITE reducer to read stamped fields; narrow transition interfaces to required; collapse `present`; remove `disable-cascade` kind. The 5 transition interfaces (`PluginInstalledMessage`/`PluginUpdatedMessage`/`PluginReinstalledMessage`/`PluginUninstalledMessage`/`PluginDisabledMessage`) narrow the base fields. |
| `shared/notify-context.ts` | Remove `"disable-cascade"` from the `kind?` param union (notify-context.ts:137); `MarketplaceRows<Msg>` typing already carries required-field enforcement to producer call sites. |
| `orchestrators/*/​*.ts` (~18 producers) | Stamp `severity`+`needsReload` on every emitted row per D-03/D-06. |
| `orchestrators/reconcile/notify.ts` | The projection that builds `PluginNotificationMessage` rows directly — D-05 backstop target. |
| `tests/architecture/catalog-uat.test.ts` | UNCHANGED (byte gate). Must stay green. |
| `tests/shared/notify-inert-fields.test.ts` | SUPERSEDE — its premise (fields inert) is now false. |
| `tests/shared/notify-v2.test.ts` | UPDATE the severity/reload invariant tests (134 tests) that assert content-derived behavior. |

### Pattern 1: Transition-interface narrowing (D-04 primary mechanism)

**What:** Make `severity` + `needsReload` required on the 5 transition arms while keeping them optional on `MessageBase` (and thus on all list/info arms).
**When to use:** Any message interface whose status represents a realized state change.

The cleanest TS shape (Claude's discretion, D-04) — a dedicated narrowing base interface that the 5 transition arms extend instead of `MessageBase`:

```typescript
// Source: idiomatic TS interface narrowing; mirrors the codebase's existing
// `extends MessageBase` per-arm pattern (notify.ts:628-898).
export interface TransitionMessageBase extends MessageBase {
  readonly severity: "info" | "warning" | "error"; // narrowed: required
  readonly needsReload: boolean;                    // narrowed: required
}

// The 5 transition arms extend TransitionMessageBase instead of MessageBase:
export interface PluginInstalledMessage extends TransitionMessageBase {
  readonly status: "installed";
  // … existing fields unchanged …
}
```

A producer literal that omits either field on a transition arm becomes a TS2741 ("Property 'needsReload' is missing") **at the construction site**, because `MarketplaceRows<Msg>` narrows `plugins` to the command's `Msg` union (notify-context.ts:92-99) — the object literal is checked against the narrow `Msg`, NOT the post-widening broad union. The `as unknown as readonly MarketplaceNotificationMessage[]` widening cast inside `notifyWithContext` (notify-context.ts:145) happens *after* the call-site type check, so it does not defeat the gate.

**Why this shape over `Required<Pick<…>>`:** the codebase already uses plain `extends MessageBase` on every arm (16 plugin + 10 marketplace interfaces), so a sibling `TransitionMessageBase extends MessageBase` is the lowest-surprise edit and reads cleanly at each arm. A `Required<>` utility would obscure which two fields are required.

### Pattern 2: The dumb-reducer rewrite (SEV-02 / RLD-02)

**What:** Replace the content-derived ladders with field reads.

```typescript
// Source: replaces cascadeSeverity (notify.ts:2198) + computeSeverity cascade
// branch (notify.ts:2293-2294).
const SEVERITY_RANK = { info: 0, warning: 1, error: 2 } as const;

function maxSeverity(rows: readonly { severity?: "info"|"warning"|"error" }[]): ComputedSeverity {
  let rank = 0; // info
  for (const r of rows) {
    rank = Math.max(rank, SEVERITY_RANK[r.severity ?? "info"]);
  }
  // notify()'s host arg is undefined for info (no 2nd ctx.ui.notify arg),
  // "warning"/"error" otherwise — preserving today's contract.
  return rank === 0 ? undefined : rank === 1 ? "warning" : "error";
}

// replaces the shouldEmitReloadHint trigger loop (notify.ts:2548-2561):
function anyNeedsReload(rows: readonly { needsReload?: boolean }[]): boolean {
  return rows.some((r) => r.needsReload === true);
}
```

The reducer must reduce over the FLATTENED row set: marketplace rows AND their nested plugin rows both carry `severity`/`needsReload`. Today `cascadeSeverity` reads both `mp.status`/`mp.reasons` and `p.status`/`p.reasons`; the replacement reads `mp.severity` and `p.severity` over the same flattened iteration (notify.ts:2208-2236 shows the existing `marketplaces.some(mp => … mp.plugins.some(p => …))` traversal to mirror).

**The info-kind branch of `computeSeverity` PARTIALLY STAYS (D-03 nuance):** `marketplace-not-added` → `error`, `plugin-info` failed-row → `error`, the read-only info/cascade kinds → `info` (notify.ts:2274-2290). These are standalone (non-cascade) kinds whose rows do not flow through `MarketplaceRows<Msg>`. Per SEV-02 "no content inference," these should ALSO become stamped — but they are emitted via raw `notify(ctx,pi,message)` with inline literals (e.g. `marketplace/shared.ts:549`). The planner must decide whether to (a) stamp these standalone-kind rows too, or (b) keep their tiny hard-coded severity map for kinds that carry no row array. Recommendation: keep the standalone-kind severity map for the info kinds (they are not "transition" cascades and have no per-row severity to reduce), and document that the **cascade** branch is the dumb-reducer; this preserves bytes and matches D-03's "all success/inventory rows → info" scope. Flag as Open Question Q1.

### Pattern 3: Tally by stamped facts (SEV-02 tally)

`countFailedRows`/`countSkippedRows` (notify.ts:2323/2350) currently match `p.status === "failed"` / `p.status === "skipped" && !allBenign(p.reasons)`. Rewrite to tally by stamped `severity`:
- failure count = rows with `severity === "error"`
- warning count = rows with `severity === "warning"`

This is byte-identical because D-03 maps `failed`→error and actionable-`skipped`/`manual recovery`→warning, exactly the rows the status-based counters match today. The summary-line wording (`buildSummaryLineForCascade`, notify.ts:2372) consumes these counts and STAYS.

### Anti-Patterns to Avoid

- **Reading `MessageBase.severity` in the reducer before all producers stamp it.** If the reducer reads the field while a transition row still omits it (and the field defaults to `info`), severity silently drops from warning/error to info → catalog-uat goes red. Land the field-read and the producer stamps in the SAME wave so the type checker forbids the gap.
- **Confusing `MessageBase.severity` with `ImportDiagnostic.severity`.** `orchestrators/import/types.ts:15` declares a SEPARATE `severity: "warning"|"error"` on the import-diagnostics channel (refs.ts/settings.ts/marketplaces.ts/execute.ts:266 stamp it). That is NOT the MessageBase field and must NOT be touched or conflated. `[VERIFIED: codebase grep]`
- **Stamping `needsReload: true` on inventory `installed` rows.** After `present`→`installed` collapse (D-08), the list surface emits `installed` but must stamp `needsReload: false` — otherwise the list grows a spurious `/reload` trailer (the exact bug `present` was created to prevent, UAT G-21-01).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Byte-equality verification of stamped output | A new behavioral test suite | `catalog-uat.test.ts` (drives `notify()` over `docs/output-catalog.md` fixtures) | It is THE end-to-end gate (D-01/GATE-02); fixtures stay unchanged this phase. |
| Exhaustiveness of transition stamping | An AST walker from scratch | TS2741 compile error (D-04) + a thin runtime introspection test driving `buildReconcileAppliedCascade`/`buildReconcilePendingNotification` (D-05) | The type system already reaches every render-map producer; only the reconcile projection needs a runtime backstop. |
| Severity max / reload OR-reduce | Bespoke first-match ladders | A 3-rank `Math.max` and `Array.some` | The content ladders being deleted were the complexity; the replacement is trivially correct. |

**Key insight:** The hard part of this phase is NOT writing the reducer (it shrinks). It is proving the per-producer stamps reproduce today's exact bytes — which `catalog-uat` already does, for free, on every test run.

## Runtime State Inventory

Not a rename/data-migration phase in the OS/datastore sense — but the "what still carries the old shape after the source edit?" discipline applies to **status tokens and cascade kinds**:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `severity`/`needsReload` are render-time intent, never persisted. State records (`state.json`) carry no severity. Verified: no `severity`/`needsReload` in persistence/ writers. | None |
| Live service config | None — no external service stores notification severity. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None. | None |
| Build artifacts | None — `.ts` only, no compiled artifacts carry status tokens. | None |
| **Status-token references (`"present"`)** | 50+ references across notify.ts, list.ts/list.messaging.ts, edge/handlers/tools.ts (3×), AND tests (notify-v2, snm37/38, catalog-uat ~15 fixtures, list.test, inert-fields). `[VERIFIED: grep]` | D-08: collapse to `installed`+`needsReload:false`. Update ALL fixture references; rendered bytes preserved so catalog-uat fixtures stay byte-identical but their `status: "present"` literals become `status: "installed"`. **catalog-uat fixtures DO change their status literal even though expected bytes don't** — this is the one allowed fixture edit (status field, not expected output). |
| **`disable-cascade` kind references** | ~25 references across notify.ts (8), notify-context.ts (2), enable-disable.ts/.messaging.ts, AND tests (notify-v2 2 tests, enable-disable.test, catalog-uat 1 fixture). `[VERIFIED: grep]` | D-07/RLD-05: remove the kind; disable stamps `needsReload:true` directly. Update the 2 notify-v2 UAT-03 tests + the catalog-uat disable fixture (drop `kind:"disable-cascade"`, add `needsReload:true` on the disabled row). |

**The canonical question for this phase:** after the 5 transition interfaces are narrowed and the ladders deleted, what still relies on the old content-derived path? Answer: the ~18 producer literals (caught by TS2741), the reconcile projection (caught by D-05 backstop), the `notify-inert-fields` test (premise inverted — supersede), and ~10 `notify-v2` tests that assert content-derived severity (update to assert stamped-field-derived severity).

## Common Pitfalls

### Pitfall 1: The widening cast hiding a missing required field
**What goes wrong:** `notifyWithContext` casts `rows as unknown as readonly MarketplaceNotificationMessage[]` (notify-context.ts:145). One might fear this lets a producer skip a required field.
**Why it doesn't:** the cast operates on the already-type-checked `rows: readonly MarketplaceRows<Msg>[]` parameter. The producer's object literal is checked against `MarketplaceRows<Msg>` (whose `plugins: readonly Msg[]`) at the CALL SITE before the function body runs. Narrowing the transition arms makes that call-site check enforce the required fields.
**How to avoid:** Verify the gate with a deliberate compile-error probe during planning (omit `needsReload` on one install row, confirm `tsc --noEmit` errors). Warning sign: if `tsc` stays green with a field omitted, the narrowing didn't reach that arm.

### Pitfall 2: `present` collapse changing list bytes via the reasons brace
**What goes wrong:** The `present` render arm calls `installedLikeRow(…, undefined, …)` — it passes `undefined` reasons (list.messaging.ts:73-82). The `installed` render arm passes `p.reasons` (list.messaging.ts via INSTALL path / notify.ts:1930). If the list emits a real `installed` row carrying `reasons`, the orphan-rewake brace could appear on a steady-state inventory row.
**Why it happens:** `PluginInstalledMessage` allows optional `reasons?` (notify.ts:634); `PluginPresentMessage` structurally forbade it.
**How to avoid:** When the list surface emits `installed` instead of `present`, ensure its render path passes `undefined`/empty reasons (the list's `installedRowMessage` at list.ts:287-294 already omits reasons; keep it omitted). catalog-uat will catch any brace leak.

### Pitfall 3: Skip severity divergence at the producer
**What goes wrong:** D-03 requires the producer to stamp `info` for benign idempotent skips and `warning` for actionable skips, replacing the deleted `allBenign(reasons)` lookup. A producer that stamps the wrong one changes severity.
**Why it happens:** Today the benign/actionable judgment is centralized in `BENIGN_REASONS` (`up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`, `already enabled`, `already disabled`). Each producer must now know, at its emit site, whether its skip is one of these.
**How to avoid:** Map each skip emit site to the reason it emits and stamp accordingly. Verified skip sites and their reasons:
- `marketplace/update.ts:660-666` skip `up-to-date` → benign → `info`; `:868`/`:896` mp-skip `up-to-date` → benign → `info`; `:667-673` skip with `narrowSkipReason` → likely actionable → `warning` (verify the reason).
- `plugin/update.ts:1536`/`1548` skip → check reason.
- `marketplace/autoupdate.ts:555` skip `already autoupdate`/`already no autoupdate` → benign → `info`.
- `plugin/enable-disable.ts:762/767/904/911` skip (`not installed`, `already enabled`, `already disabled`) → `already enabled`/`already disabled` benign → `info`; `not installed` is NOT in BENIGN_REASONS → `warning`.
- `plugin/reinstall.ts:837` skip + `:360/:864` manual recovery → manual recovery always `warning`.
- `import/execute.ts:399` skip → check reason.
**Warning sign:** catalog-uat byte-equality failure on a skip fixture's severity arg. The catalog-uat driver asserts `expectedSeverity` per fixture (catalog-uat.test.ts:16-21), so a wrong stamp fails loudly.

### Pitfall 4: notify-v2 severity tests asserting the deleted ladder
**What goes wrong:** `tests/shared/notify-v2.test.ts` (134 tests) includes per-status severity/reload invariants and the UAT-03 disable-cascade tests (lines 3850, 3884). Deleting the ladder + the kind breaks these tests.
**How to avoid:** Plan to update (not delete wholesale) the affected notify-v2 tests so they assert the new stamped-field behavior. The `present`/`disable-cascade` fixtures in this file (notify-v2:897-981, 3850-3892) must migrate to `installed`+`needsReload` / drop-the-kind+`needsReload:true`.

## Code Examples

### Producer stamping (transition row — D-03/D-06)
```typescript
// Source: the install success row at orchestrators/plugin/install.ts:1370
// (notifyWithContext INSTALL_CONTEXT). Today:
//   { status: "installed", name, version, dependencies }
// After narrowing PluginInstalledMessage to TransitionMessageBase:
{ status: "installed", name, version, dependencies, severity: "info", needsReload: true }
// failed row (install.ts:1129):
{ status: "failed", name, reasons, severity: "error", needsReload: false }
```

### List inventory row (present→installed, D-08)
```typescript
// Source: orchestrators/plugin/list.ts:287-294 installedRowMessage. Today emits
// status:"present". After D-08:
{ status: "installed", name: pluginName,
  dependencies: dependenciesFromDeclares(declaresAgents, declaresMcp),
  version: record.version, ...scopeField, ...descriptionField,
  severity: "info", needsReload: false }   // needsReload:false = the old `present` suppression
// Renderer arm bytes unchanged (ICON_INSTALLED + "(installed)", no reasons brace).
```

### Disable transition (disable-cascade removal, D-07/RLD-05)
```typescript
// Source: orchestrators/plugin/enable-disable.ts:857-864. Today passes the
// "disable-cascade" kind to notifyWithContext. After RLD-05: drop the kind arg,
// stamp the disabled row directly:
//   composeOutcomeRow fresh-disable arm → { status:"disabled", …,
//                                            severity:"info", needsReload:true }
notifyWithContext(ctx, pi, DISABLE_CONTEXT,
  [{ name: marketplace, scope, plugins: [disableRow] }]);  // no 5th "disable-cascade" arg
```

### D-05 architecture-test backstop (runtime introspection — recommended mechanism)
```typescript
// Source pattern: mirrors catalog-uat.test.ts / notify-grammar-invariant.test.ts
// (programmatic fixtures + assertion over notify shapes), NOT the grep-style
// arch tests. Drive the reconcile projection and walk its rows.
import { buildReconcileAppliedCascade } from ".../reconcile/notify.ts";

test("GATE-01/D-05: reconcile-applied projection stamps both fields on every state-change row", () => {
  const msg = buildReconcileAppliedCascade(SAMPLE_OUTCOMES);
  for (const mp of msg.marketplaces) {
    for (const p of mp.plugins) {
      if (TRANSITION_STATUSES.has(p.status)) {
        assert.notEqual(p.severity, undefined, `${p.status} row missing severity`);
        assert.equal(typeof p.needsReload, "boolean", `${p.status} row missing needsReload`);
      }
    }
  }
});
```
A typed-registry alternative (`const TRANSITION_STATUSES = new Set(["installed","updated","reinstalled","uninstalled","disabled"])` derived from a `satisfies` pin) keeps the set drift-proof. Prefer runtime introspection over an AST walk: the projection's rows are plain data already exercised by tests, and the runtime check fails with a clear row-level diagnostic.

## State of the Art

| Old Approach (being deleted) | Current Approach (this phase) | Impact |
|------------------------------|-------------------------------|--------|
| `cascadeSeverity` 4-arm first-match content ladder reading `status`+`reasons` (notify.ts:2198) | `Math.max` over `row.severity` | Severity correctness moves from 1 reducer to ~18 producers; gated by D-04 type + D-05 test. |
| `shouldEmitReloadHint` status-token trigger set + `disable-cascade` straddle (notify.ts:2507) | `Array.some(r => r.needsReload)` | The `disable-cascade` kind is deleted (RLD-05). |
| `BENIGN_REASONS`/`allBenign` content lookup (notify.ts:150) | Producer's own desired-vs-actual judgment per skip site (D-03) | Severity no longer reads `reasons`. |
| `PluginPresentMessage` distinct status for reload suppression (notify.ts:764) | `installed` + `needsReload:false` (D-08) | One fewer status token; bytes preserved. |

**Deprecated/outdated after this phase:**
- `tests/shared/notify-inert-fields.test.ts` — premise inverted; supersede with a "fields are LIVE and reduce correctly" test (or fold into notify-v2).
- The "severity and reload-hint are INDEPENDENT ladders" doc-comments (notify.ts:2167-2168 etc.) — still true conceptually but now both derive from stamped fields, not content.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Standalone info-kind severity (marketplace-not-added→error, plugin-info failed→error) should KEEP a small hard-coded map rather than being stamped, because these kinds carry no per-row severity array. | Pattern 2 / Q1 | If the user wants these stamped too, the plan needs extra emit-site edits at `marketplace/shared.ts:549/563`, `marketplace/info.ts`, `plugin/info.ts`. Bytes unaffected either way; catalog-uat catches drift. |
| A2 | Every skip emit site's benign-vs-actionable reason is locally determinable (the producer knows its own reason literal). | Pitfall 3 | If a skip site's reason is data-dependent in a way the producer can't classify locally, stamping requires threading the classification — but the verified sites all emit a known reason literal. |
| A3 | `needsReload` defaults to `false` (not `undefined`) semantically for absent values; the OR-reduce treats absent as false. | Pattern 2 | Low — `r.needsReload === true` already handles `undefined` as falsy. |

## Open Questions (RESOLVED)

> Both questions were resolved during planning and are honored in the plans.
> Q1 — RESOLVED via `02-CONTEXT.md` "Claude's Discretion": KEEP the small
> kind→severity info-kind switch (it is a kind→severity map, not reason
> inference); only the cascade branch becomes the dumb reducer (locked in
> 02-01 Task 3). Q2 — RESOLVED via `02-CONTEXT.md` D-08: catalog-uat *input*
> literal edits (`status:"present"`→`"installed"`, drop `disable-cascade`,
> add `needsReload`) are in-scope and required; the byte-compared `expected`
> blocks stay byte-identical (honored in 02-02). Neither blocks execution.

1. **Standalone info-kind severity (Q1) — RESOLVED (keep the info-kind switch):** Should `marketplace-not-added`/failed-`plugin-info` standalone severity become stamped (`severity` on the inline literal), or keep the tiny `computeSeverity` info-kind switch (notify.ts:2274-2290)?
   - What we know: these are non-cascade kinds emitted via raw `notify()`; they have no `MarketplaceRows<Msg>` to reduce over.
   - What's unclear: whether SEV-02's "no content inference" intends to cover them.
   - Recommendation: keep the info-kind switch (it is a kind→severity map, not reason inference); document the cascade branch as the dumb-reducer. Confirm in discuss/planning. Byte-neutral either way.

2. **catalog-uat fixture status-literal edits (Q2) — RESOLVED (input-literal edits in-scope, expected bytes identical):** D-08/RLD-05 require changing `status:"present"`→`status:"installed"` and dropping `kind:"disable-cascade"` in ~16 catalog-uat fixtures, while expected output bytes stay identical.
   - What we know: D-01 says "no fixture rewrites" for *expected output*; the status literal is fixture *input*, not the byte-compared output.
   - Recommendation: treat input-literal edits (status field, add `needsReload`) as in-scope and required; only the `expected` fenced blocks must stay byte-identical. The planner should call this out explicitly so it isn't mistaken for a D-01 violation.

## Validation Architecture

> nyquist_validation: enabled (`workflow.nyquist_validation: true` in `.planning/config.json`). Section included. Anchored on the byte gate + type/arch enforcement, NOT new behavioral fixtures (the phase is output-preserving).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node>=20.19.0) `[VERIFIED: package.json]` |
| Config file | none — glob in `package.json` `scripts.test` |
| Quick run command | `node --test "tests/architecture/catalog-uat.test.ts"` (byte gate) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEV-01/02, RLD-01/02 | stamped fields reduce to byte-identical output | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` | ✅ |
| SEV-04, RLD-03 | deleted ladders no longer referenced | typecheck + grep | `npm run typecheck` (dead refs fail) | ✅ |
| SEV-05/D-04 | omitting severity/needsReload on a transition row is a compile error | type-level | `npm run typecheck` (probe with a deliberate omission) | ✅ |
| RLD-04 (present→installed) | list bytes unchanged | byte-equality | `node --test tests/architecture/catalog-uat.test.ts tests/orchestrators/plugin/list.test.ts` | ✅ |
| RLD-05 (disable-cascade) | disable still emits trailer; bytes unchanged | byte-equality + unit | `node --test tests/shared/notify-v2.test.ts tests/orchestrators/plugin/enable-disable.test.ts` | ⚠️ Wave 0 (update UAT-03 tests) |
| GATE-01 (D-05 backstop) | reconcile projection stamps both fields | runtime introspection | new `tests/architecture/notify-stamp-coverage.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/architecture/catalog-uat.test.ts` + `npm run typecheck`
- **Per wave merge:** `npm test` (full unit/arch suite)
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/architecture/notify-stamp-coverage.test.ts` — new D-05 runtime backstop driving `buildReconcileAppliedCascade`/`buildReconcilePendingNotification`, asserting transition rows stamp both fields (GATE-01).
- [ ] `tests/shared/notify-inert-fields.test.ts` — supersede (premise inverted): rewrite to assert the fields are LIVE and the reducer reads them.
- [ ] `tests/shared/notify-v2.test.ts` — update the ~10 severity/reload invariant tests + the 2 UAT-03 `disable-cascade` tests (lines 3850, 3884) + the `present` fixtures (897-981) to the stamped-field model.

## Security Domain

> `security_enforcement` not set in config → treated as enabled. This phase is an internal type/reducer refactor with **no new attack surface**: no auth, no network, no input parsing, no crypto, no data persistence change.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | Notification rows are internally constructed, not user-supplied; statuses are closed literal unions. |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path leakage in rendered output | Information disclosure | UNCHANGED — `redactAbsolutePaths` (notify.ts) stays central; this phase touches severity/reload only, not the redaction seam (NFR-9). |
| Raw `error.message` leaking into a row | Information disclosure | UNCHANGED — reconcile projection consumes `outcome.reason` only (reconcile/notify.ts:297-300); not modified here. |

No new security controls required. Confirm the redaction and output-channel (IL-2: single `ctx.ui.notify`) invariants stay intact — both are byte-gated by catalog-uat and the existing `no-credential-leak`/`no-orchestrator-network` arch tests.

## Project Constraints (from CLAUDE.md)

- Node >= 20.19.0; TypeScript strict; ESM-only (`"type": "module"`). `[VERIFIED: package.json]`
- All user-visible messages through `ctx.ui.notify(message, severity)` (IL-2); direct stdout/stderr forbidden. The reducer's single `ctx.ui.notify` call (notify.ts `emitWithSummary`) preserves this — do not add a second emission.
- `npm run check` must stay green (NFR-6 / GATE-03) at every phase boundary.
- No telemetry (IL-4), English-only (IL-1) — unaffected.
- Comment policy (`.claude/rules/typescript-comments.md`): use decision/requirement IDs (`D-04`, `SEV-02`, `RLD-05`) as anchors; NEVER write `Phase 2`/`Plan NN`/`Wave N` in code comments or test titles.
- Git: never commit to `main`; run `pre-commit run --files <changed>` before commit; worktree commits prefix `SKIP=trufflehog`. Squash-merge PRs only.

## Sources

### Primary (HIGH confidence — direct codebase reads, 2026-06-24)
- `extensions/pi-claude-marketplace/shared/notify.ts` (3383 lines) — MessageBase:606, transition interfaces:628-898, MpCommon/marketplace arms:911-1023, RELOAD_HINT_TRAILER:2144, BENIGN_REASONS/allBenign:150-168, cascadeSeverity:2198, reconcileAppliedSeverity:2244, computeSeverity:2248, count*Rows:2323/2350, shouldEmitReloadHint:2507, present renderer:1943, notify()/emitContextCascade dispatcher:3114-3269.
- `extensions/pi-claude-marketplace/shared/notify-context.ts` — CommandContext:62, MarketplaceRows<Msg>:92, notifyWithContext + widening cast:132-152, disable-cascade kind param:137.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` (495 lines) — the projection (`buildReconcileAppliedCascade`/`buildReconcilePendingNotification`) that builds rows directly (D-05 target).
- Producer emit sites verified: install.messaging.ts, list.messaging.ts, list.ts:287, update.ts:650/660, enable-disable.ts:820-893, plus the `notifyWithContext`/`notify(` call-site census across all orchestrators.
- `tests/architecture/catalog-uat.test.ts` (byte gate harness), `notify-grammar-invariant.test.ts` + `no-orchestrator-network.test.ts` (arch-test idioms), `tests/shared/notify-inert-fields.test.ts`, `tests/shared/notify-v2.test.ts` (134 tests).
- `package.json` (`scripts.check`/`.test`, engines, type), `.planning/config.json` (nyquist_validation:true).
- CONTEXT.md D-01..D-08, REQUIREMENTS.md SEV/RLD/GATE, ROADMAP §Phase 2.

### Secondary (MEDIUM — superseded line numbers)
- `research/MESSAGING-COUPLING.md` Part B.4 — the construct inventory is accurate but its line numbers predate Phase 1 (notify.ts was ~3119, now 3383). Use the Primary line numbers above, not the audit's.

### Tertiary
- None — no external/web sources needed for an in-repo refactor.

## Metadata

**Confidence breakdown:**
- Constructs to delete/rewrite + locations: HIGH — every line read directly this session.
- D-04 type mechanism reaching producers: HIGH — verified `MarketplaceRows<Msg>` narrows `plugins` to `Msg` and the widening cast is post-check.
- D-05 backstop scope: HIGH — `reconcile/notify.ts` is the sole projection building rows outside a render map; pending.ts also routes through it.
- Skip benign/actionable per-producer mapping: MEDIUM — the BENIGN_REASONS set is verified; a few skip sites (`narrowSkipReason`, import:399) need the planner to confirm the exact reason literal at the emit site.

**Research date:** 2026-06-24
**Valid until:** until the next edit to `shared/notify.ts` or `notify-context.ts` (the line numbers are the only volatile content; the architecture is stable).
