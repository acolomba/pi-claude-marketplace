---
phase: 01-localized-type-model-command-context-spine
reviewed: 2026-06-24T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-24
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

This is an output-neutral type-model refactor: each command now owns a local
`CommandContext` (`Messaging.label` + a per-status render map), and `notify()`
is dispatched per-row through `context.render[status]` via the new
`notifyWithContext` / `emitContextCascade` spine. I traced every render-map arm
against the central `renderPluginRow` / `renderMpHeader` switches and confirmed
the lifted arm bodies are byte-faithful (same icon constants, same token order,
same `composeReasons`/`pluginRow` call shapes). I also traced all 41
`notifyWithContext` call sites to confirm that each one only ever constructs
plugin rows whose `status` is covered by the context's render map — they do,
**today**, by manual discipline.

No correctness or security defect that alters rendered bytes or breaks
discriminated-union exhaustiveness was found. The findings center on a
**type-safety gap in the new spine**: the contract that "rows passed to
`notifyWithContext` must only carry statuses the context's render map covers"
is NOT enforced by the type system, and a violation degrades from a TS2741
compile error (the design's stated guarantee, D-10) into an unguarded runtime
`TypeError`. The refactor leans on this gap at every call site, so it is a
maintainability/robustness risk worth closing before more commands are migrated
on top of it.

The exhaustiveness machinery that IS in place (`as const satisfies
CommandContext<Status, Msg>`, the `_ReasonsCoverage` proof, the central
`assertNever` tails) is correct and well-constructed.

## Warnings

### WR-01: `notifyWithContext` rows are unchecked against the context's render map — a status not covered becomes a runtime TypeError, not a compile error

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:108-121`, `153-161`

**Issue:** The spine's central exhaustiveness claim (D-10: "a command whose
const omits an arm for one of its own statuses is a TS2741 compile error") only
covers one direction — that the render map is *total over `Status`*. It does
NOT cover the other, equally load-bearing direction: that the *rows actually
passed* carry only statuses in `Status`. `notifyWithContext` types its rows
parameter as the broad `readonly MarketplaceNotificationMessage[]`, whose
nested `plugins` are the full `PluginNotificationMessage` union — `Status` /
`Msg` never constrain the rows:

```ts
export function notifyWithContext<Status extends string, Msg>(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  context: CommandContext<Status, Msg>,
  rows: readonly MarketplaceNotificationMessage[],   // <-- broad; not Msg-constrained
  kind?: "cascade" | "disable-cascade",
): void { ... }
```

`dispatchRow` then does an unchecked lookup and triple-cast:

```ts
const arm = context.render[p.status as Status] as unknown as RenderFn<PluginNotificationMessage>;
return arm(p, probe, mpScope);   // arm === undefined => "arm is not a function"
```

If any current or future call site constructs a row whose status the context
does not declare (e.g. `INSTALL_CONTEXT` only covers
`installed`/`failed`/`unavailable`, but a row with `status: "skipped"` is
pushed), `context.render[p.status]` is `undefined` and the call crashes at
runtime inside the sole sanctioned `notify` chokepoint — taking down the
user-visible output for that operation entirely. The 41 call sites are correct
only by manual audit; nothing prevents drift.

**Fix:** Constrain the rows to the context's `Msg` so a mismatch is the TS2741
error the design intends. Carry a marketplace-message generic that narrows
`plugins` to `Msg`, e.g.:

```ts
export interface MarketplaceRows<Msg> {
  readonly name: string;
  readonly scope: Scope;
  readonly status?: MarketplaceStatus;
  readonly reasons?: readonly ContentReason[];
  readonly details?: MarketplaceDetails;
  readonly plugins: readonly Msg[];
}

export function notifyWithContext<Status extends string, Msg extends { status: Status }>(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  context: CommandContext<Status, Msg>,
  rows: readonly MarketplaceRows<Msg>[],
  kind?: "cascade" | "disable-cascade",
): void { ... }
```

At minimum, if the broad parameter must stay for structural reasons, make
`dispatchRow` fail loudly and diagnosably instead of with a bare
`TypeError`: guard the lookup and `assertNever`-style throw a message naming the
offending status and the command label.

### WR-02: `dispatchRow` `as unknown as` double-cast silently erases the row/arm type relationship

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:159`

**Issue:** `context.render[p.status as Status] as unknown as
RenderFn<PluginNotificationMessage>` performs two unsafe casts in sequence. The
`p.status as Status` cast asserts (without proof) that the broad union status is
in the narrow set, and the `as unknown as RenderFn<...>` cast then widens the
arm's parameter from the command's narrow `Extract<Msg, {status: K}>` to the
full `PluginNotificationMessage`. Together they make the renderer accept a row
shape its arm body may not structurally handle (e.g. a `failed` arm reaching for
`p.from`/`p.to` if a malformed row were threaded). This is the mechanism by
which WR-01's runtime crash (or worse, a wrong-field read) becomes possible.
It is the single point where the otherwise-discriminated union loses its
guarantees.

**Fix:** Tie to WR-01's resolution. Once `rows` is `Msg`-constrained, the
`p.status as Status` cast is provable and the `as unknown as` can be replaced
with a checked narrowing or a single, documented cast whose precondition the
signature now enforces. If the broad parameter is retained, add a runtime guard:

```ts
const arm = context.render[p.status as Status] as RenderFn<PluginNotificationMessage> | undefined;
if (arm === undefined) {
  throw new Error(`notify dispatch: command "${context.Messaging.label}" has no render arm for status "${p.status}"`);
}
return arm(p, probe, mpScope);
```

### WR-03: `dependencies.includes(...)` gating duplicated verbatim across 6 render maps with no shared helper — drift risk on a byte-critical path

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:62-76`, `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:72-85`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts:49-62`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts:59-72`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:61-74`, `extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts:65-78` (and `reconcile.messaging.ts:149-162`)

**Issue:** The soft-dep-bearing render arms (`installed` / `present` /
`updated` / `reinstalled`) each repeat the exact 6-token `joinTokens([...,
composeReasons(reasons, p.dependencies.includes("agents"),
p.dependencies.includes("mcp"), probe)])` block. The refactor's stated rule is
that the shared presentation vocabulary stays central in `shared/notify.ts`
(D-11) and the arms are "lifted verbatim". These blocks are now duplicated 7+
times across command modules. They are byte-identical today (I verified each
against `renderPluginRow`), but because the duplication is hand-copied rather
than calling a shared primitive, a future edit to one (e.g. token reordering,
or a third dependency kind) can silently desynchronize one command's output
from the others and from the catalog — exactly the byte-drift class this phase
must not introduce. The phase intent flags "shared presentation vocabulary
stays central in notify.ts" as a rule to enforce; this is the one place the
lifted arms re-implement composition logic rather than calling it.

**Fix:** Export a shared `installedLikeRow(icon, p, mpScope, label, probe)`
primitive from `shared/notify.ts` (mirroring the existing `pluginRow` helper for
the reasons-bearing arms) that owns the `dependencies.includes(...)` +
`composeReasons` composition, and have the `installed` / `present` / `updated` /
`reinstalled` arms call it. This collapses the 7 copies to one byte source and
restores the D-11 "call, never duplicate" invariant for the soft-dep arms.

### WR-04: `RenderFn`'s `_probe` / `mpScope` params accepted-but-unused inconsistently across the no-soft-dep arms with no lint enforcement

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts:82-95` (pending arms ignore `_probe`) vs `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts:51-52` (failed arm uses `probe` via `pluginRow`)

**Issue:** The `RenderFn<M>` signature is fixed as `(row, probe, mpScope) =>
string`. Arms that don't emit soft-dep markers (the `will *` pending arms)
correctly mark the probe `_probe`, while structurally similar arms elsewhere
spell it `probe` because they forward it into `pluginRow`. This is benign for
output, but the convention is applied inconsistently and is not gate-enforced,
so a reviewer cannot tell at a glance whether a given arm *intends* to ignore
the probe or has a latent bug where it should have threaded it (e.g. forgetting
to pass `p.dependencies.includes(...)` into `composeReasons`). On a byte-critical
surface, "did this arm forget the soft-dep gate?" should be answerable
structurally.

**Fix:** Adopt one consistent rule (prefer `_`-prefix for genuinely unused
params, enforced by `@typescript-eslint/no-unused-vars`'s
`argsIgnorePattern`), and consider a brief per-arm comment on the no-soft-dep
arms stating "no `dependencies` field on this variant by construction" so the
absence is documented intent, not omission.

## Info

### IN-01: `notifyWithContext` threads `Messaging.label` but it is consumed nowhere this phase

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:59-62`, `108-121`

**Issue:** `CommandContext.Messaging.label` is declared and every command supplies
it, but `notifyWithContext` / `emitContextCascade` never read it (the summary
surface that would render it "lands later" per the file's own JSDoc). It is
currently dead-on-arrival data on the output path. This is intentional
scaffolding for a future phase, correctly documented, and inert (does not alter
bytes) — flagged only so the dead consumer is tracked and does not get mistaken
for a wired feature.

**Fix:** No action needed this phase; ensure the follow-up phase that renders the
summary line actually consumes `Messaging.label` so it does not remain
permanently unused.

### IN-02: `MessageBase.severity` / `needsReload` are inert universal fields with no test guarding the "reducer must not read them" rule

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:606-609`

**Issue:** Per the phase intent, `severity?` and `needsReload?` were added to
`MessageBase` but must remain INERT (the reducer must not read them) so output
stays byte-identical. The code correctly never reads them in
`computeSeverity` / `shouldEmitReloadHint` (those derive structurally from
`status`). However, the "must not read" rule is enforced only by convention —
there is no negative assertion preventing a future edit from wiring these in
and silently changing severity. Given the phase explicitly calls out this
invariant, a guard would harden it.

**Fix:** Add a comment anchor at the `computeSeverity` / `shouldEmitReloadHint`
sites noting the D-07 "INERT until a later phase" contract, and/or a test that
constructs a row with `severity: "error"` on an otherwise-info cascade and
asserts the emitted severity is still `undefined`.

### IN-03: Reconcile applied cascade depends on `reconcile/notify.ts` projecting `plugin-enabled` outcomes to the `installed` status — cross-file invariant outside this phase's files

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:762-771`, `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts:130-136`

**Issue:** `RECONCILE_APPLIED_CONTEXT` is total over
`installed`/`uninstalled`/`disabled`/`failed`. `apply.ts` accumulates
`plugin-enabled` / `plugin-disabled` outcomes that must be projected by
`buildReconcileAppliedCascade` (in `reconcile/notify.ts`, NOT in this phase's
file set) into rows whose status lands in that 4-member set (the messaging file
documents "a successful enable re-materializes via install, so it surfaces as
`installed`"). If that projection ever emits an `enabled` row status (which is
not even a `PluginStatus`), it would hit the WR-01 runtime crash. The
projection file is out of this phase's review scope but is a load-bearing
dependency of the context's totality assumption.

**Fix:** No change in-scope; ensure the WR-01 type fix (constraining rows to
`Msg`) also covers `notifyReconcileAppliedWithContext` so any projection drift
in `reconcile/notify.ts` surfaces as a compile error against
`RECONCILE_APPLIED_CONTEXT`'s `ReconcileAppliedMsg`.

### IN-04: `marketplace list` includes `details.lastUpdatedAt` while `plugin list` deliberately omits it — verified pre-existing, not a regression

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts:77-91` vs `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:563-565`

**Issue:** The two list surfaces build `details` differently (marketplace list
carries `lastUpdatedAt`; plugin list never does). `renderMpHeader`'s
`case undefined` arm does not render `lastUpdatedAt` on either surface (UXG-01),
so the difference is output-neutral today. Confirmed this asymmetry predates the
refactor and is intentional (the field is retained in state/type but not
rendered). Flagged only to document that the divergence was reviewed and is not
a refactor-introduced inconsistency.

**Fix:** None — documented intentional behavior.

### IN-05: Empty render maps (`render: {}`) on `ADD_CONTEXT` / marketplace `LIST_CONTEXT` / marketplace `INFO_CONTEXT` rely on those commands never emitting plugin rows

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts:58-61`, `extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts:23-26`, `extensions/pi-claude-marketplace/orchestrators/marketplace/info.messaging.ts:24-27`

**Issue:** These three contexts declare `render: {}` (total over `never`) because
their commands only ever emit `plugins: []`. I confirmed `add.ts`, marketplace
`list.ts`, and marketplace `info.ts` indeed never push a plugin row through
their context. This is correct and the `satisfies CommandContext<never, ...>`
pin makes adding a child-row status a compile error at the satisfies site.
However, it interacts with WR-01: if a row with any plugin were ever threaded
through one of these contexts, `dispatchRow` would crash on the empty map with
no compile-time signal (because the rows parameter is broad). Self-consistent
today; called out as the most fragile instance of the WR-01 gap.

**Fix:** Covered by WR-01's row-type constraint; no separate change.

---

_Reviewed: 2026-06-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
