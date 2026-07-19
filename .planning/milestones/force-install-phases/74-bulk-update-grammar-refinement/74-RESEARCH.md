# Phase 74: Bulk Update Grammar Refinement - Research

**Researched:** 2026-06-29
**Domain:** Notification grammar (bulk `update` cascade rendering + summary-line tally) for the pi-claude-marketplace extension
**Confidence:** HIGH (all findings verified by direct codebase read; no external dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**UGRM-01 — suppress up-to-date no-op rows (LOCKED by maintainer)**
- A bulk `update` does NOT emit a per-plugin `(skipped) {up-to-date}` row for each unchanged plugin. Show only the plugins it actually changed.
- The all-up-to-date case still communicates the no-op clearly via a single summary line (e.g. "nothing to update" / "N up-to-date") — never zero output that looks like a hang.
- This aligns with the existing UXG-02 benign-no-op suppression philosophy.

**UGRM-02 — headline counts updates only (LOCKED by maintainer)**
- The summary headline reports **operations performed (updates)**, not at-desired-state rows: `Plugin update: 1 updated` (not "5 successes").
- Up-to-date no-ops are excluded from the headline count (and suppressed per UGRM-01). The "count updates only" choice means the headline does not carry an up-to-date tally; the all-up-to-date no-op line (UGRM-01) is the place a "nothing to update / N up-to-date" message lives.
- The planner must reconcile UGRM-01 and UGRM-02 into a single coherent grammar: suppressed up-to-date rows + an updates-only headline + a clear all-up-to-date no-op line. Settle the exact strings (e.g. "Plugin update: 1 updated" vs pluralization, and the all-up-to-date wording) in the plan/spec and lock them in the catalog.

### Scope discipline (Claude's discretion within these bounds)
- Render/grammar change only — `update` orchestration logic (what gets updated) is unchanged. The plugins skipped as up-to-date are still skipped; only their *rendering* and the *count* change.
- Severity is unchanged (up-to-date no-ops stay info / benign).
- Narrow to the `update` operation. Do NOT broadly re-architect `summaryLine` / `countRowsBySeverity` / `composeTally`. The planner should confirm whether the count change can be update-local or needs a shared-helper parameter.

### Deferred Ideas (OUT OF SCOPE)
- Applying the same no-op-suppression / count refinement to install/reinstall/marketplace/import summaries is NOT in scope — narrow to `update`. If the cleanest implementation is a shared-helper change that incidentally benefits other ops, surface it but keep the requirement scoped to `update`.
- Force-install token/severity surfaces (Phase 73, XSURF-01..03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UGRM-01 | A bulk `update` does not emit a per-plugin `(skipped) {up-to-date}` row for every unchanged plugin; an all-up-to-date bulk update still communicates the no-op clearly. | Suppression site identified at `update.ts:1798-1817` (don't push the row) or `1663-1674` (return a sentinel). All-up-to-date no-op line: catalog `all-up-to-date-noop` + a new dedicated body line. See §Architecture Patterns and §Common Pitfalls. |
| UGRM-02 | The bulk-update summary line distinguishes "updated" from "already at desired state" so the headline count reflects operations performed; `docs/output-catalog.md` / `docs/messaging-style-guide.md` and the byte-exact update tests are reconciled. | `successes` derivation at `notify.ts:2572-2591` (`countRowsBySeverity(..., "info")`). Least-invasive fix: a per-message optional `tallyVerb`/count-override threaded through the existing `cardinality`/`label` envelope channel. See §Architecture Patterns Pattern 2. |
</phase_requirements>

## Summary

Phase 74 is a pure render/grammar refinement of the bulk `update` cascade. Two pre-existing behaviors (v1.5 UXG-05 update-no-op-renders-`(skipped)`, and the Phase 50 / v1.11 `N successes` summary tally) are revised so that (1) per-plugin `(skipped) {up-to-date}` rows are suppressed in the BULK update path, and (2) the headline reports operations-performed (`Plugin update: 1 updated`) rather than the info-severity row count (`5 successes`).

The data flows through three files: `orchestrators/plugin/update.ts` builds one `UpdateMsg` row per outcome via `outcomeToCascadePluginMessage` (the `unchanged` partition → `(skipped) {up-to-date}`), groups them by marketplace, and emits via `notifyWithContext`. `update.messaging.ts` holds the `UPDATE_CONTEXT` (label `"Plugin update"`) and the render map. `shared/notify.ts::composeTally` builds the `<label>: N successes` line from `countRowsBySeverity(message.marketplaces, "info")` — and this helper is SHARED across install/reinstall/marketplace/import. The summary-count change (UGRM-02) is the riskiest part precisely because `composeTally` is shared; the safe boundary is to thread an optional update-scoped count/verb override through the existing per-message envelope (`CascadeNotificationMessage` already carries optional `label`/`cardinality`) so install/reinstall/marketplace/import summaries are byte-untouched.

**Primary recommendation:** Suppress the unchanged rows at the orchestrator (the cleaner of two sites — don't push them into the `byMp` groups at `update.ts:1798-1817`), keep the single-plugin targeted path emitting its up-to-date skip row unchanged, and give `update` an updates-only headline via a new optional `tally` override field on the cascade envelope that `composeTally` reads when present and falls back to the existing `successes` math when absent. Lock the all-up-to-date no-op body line and the new `Plugin update: N updated` headline byte-exact in `docs/output-catalog.md`, then reconcile `tests/architecture/catalog-uat.test.ts` and `tests/orchestrators/plugin/update.test.ts` in lockstep.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decide which plugins are unchanged vs updated | Orchestrator (`update.ts`) | — | The partition (`updated`/`unchanged`/`skipped`/`failed`) is computed by the three-phase update logic; rendering must not re-derive it. |
| Suppress unchanged rows for the BULK path | Orchestrator (`update.ts`) | — | The orchestrator already knows `cardinality` and owns row-list construction; suppressing at the source keeps `notify` generic (it renders whatever rows it is given). |
| Build the per-row byte form | Messaging (`update.messaging.ts` render map) | Renderer (`notify.ts`) | The render map lifts the central `renderPluginRow` arms; unchanged here. |
| Build the headline tally | Renderer (`notify.ts::composeTally`) | Orchestrator (provides count/verb input) | The tally is rendered centrally but its *inputs* (label, cardinality, and — new — an updates-only count) are stamped by the orchestrator on the envelope. |
| Lock byte contract | Docs (`output-catalog.md`, `messaging-style-guide.md`) | Tests (`catalog-uat.test.ts`) | Catalog is the binding byte contract; the UAT test pairs each `<!-- catalog-state -->` with `notify()` output. |

## Standard Stack

No new packages. This is an internal grammar refinement using only already-present code paths.

| Component | Location | Role |
|-----------|----------|------|
| `outcomeToCascadePluginMessage` | `update.ts:1609-1674` | Maps each `PluginUpdateOutcome` partition to an `UpdateMsg` row; `unchanged` → `(skipped) {up-to-date}`. `[VERIFIED: codebase read]` |
| `renderUpdateCascadeAndNotify` | `update.ts:1778-1863` | Groups rows by `(scope, marketplace)`, sorts, emits via `notifyWithContext`. The row-suppression site for UGRM-01. `[VERIFIED: codebase read]` |
| `UPDATE_CONTEXT` | `update.messaging.ts:76-79` | `Messaging.label = "Plugin update"`; the tally prefix. `[VERIFIED: codebase read]` |
| `composeTally` | `notify.ts:2563-2612` | Builds `<label>: <n> failure(s), <n> warning(s), <n> success(es)` from `countRowsBySeverity`. SHARED across ops. `[VERIFIED: codebase read]` |
| `countRowsBySeverity` | `notify.ts:2391-2407` | Counts plugin+mp rows whose `severity ?? "info"` equals target. `[VERIFIED: codebase read]` |
| `CascadeNotificationMessage` | `notify.ts:1057-1072` | The cascade envelope; already carries optional `label` + `cardinality`. The natural home for a new optional updates-only count/verb. `[VERIFIED: codebase read]` |
| `notifyWithContext` | `notify-context.ts:139-175` | Stamps `label` + `cardinality` onto the envelope from `UPDATE_CONTEXT`; the threading seam for any new envelope field. `[VERIFIED: codebase read]` |

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. All work is internal to the existing extension.

## Architecture Patterns

### Data Flow Diagram

```
updatePlugins (update.ts)
  │  computes cardinality = target.kind === "plugin" ? "single" : "plural"   [update.ts:273]
  ▼
runThreePhaseUpdate / per-plugin → PluginUpdateOutcome { partition: updated|unchanged|skipped|failed }
  ▼
renderUpdateCascadeAndNotify(outcomes, cardinality)                          [update.ts:1778]
  │  for each outcome:
  │    row = outcomeToCascadePluginMessage(target, outcome, probe, cardinality)  [update.ts:1812/1815]
  │       └─ unchanged → { status:"skipped", reasons:["up-to-date"], severity:"info" }  [update.ts:1663-1674]
  │  ── UGRM-01 SUPPRESSION POINT: skip pushing the `unchanged` row when cardinality==="plural" ──
  │  group by (scope, marketplace) → marketplaces: Plural<MarketplaceRows<UpdateMsg>>
  ▼
notifyWithContext(ctx, pi, UPDATE_CONTEXT, marketplaces, undefined, cardinality)  [update.ts:1862]
  │  stamps { label:"Plugin update", cardinality } onto CascadeNotificationMessage  [notify-context.ts:166-171]
  │  ── UGRM-02: stamp an optional updates-only `tally` override here ──
  ▼
emitContextCascade → emitCascadeWith (notify.ts:3307)
  │  body  = per-mp blocks via render map
  │  tally = composeTally(message)                                           [notify.ts:3332 / 2563]
  │    └─ successes = countRowsBySeverity(mps,"info") - bareHeaders          [notify.ts:2574-2591]
  │    ── UGRM-02: when message carries the override, render "N updated" instead ──
  │  withTally = foldTallyAndHint(body, tally, hint)
  ▼
emitWithSummary → ctx.ui.notify(...)
```

### Pattern 1: UGRM-01 — suppress unchanged rows at the orchestrator (NOT the renderer)

**What:** For a BULK (`cardinality === "plural"`) update, do not include the `unchanged` partition's `(skipped) {up-to-date}` row in the rendered cascade. For a SINGLE (`cardinality === "single"`) targeted update, keep emitting the up-to-date skip row (a user who named one plugin deserves to see "it was already up-to-date").

**When to use:** Always, for the bulk path only.

**Where (two candidate sites — recommend the first):**

- **Site A (recommended): drop the row during group assembly.** `renderUpdateCascadeAndNotify` at `update.ts:1798-1817` constructs `byMp` by calling `outcomeToCascadePluginMessage` for every outcome. Add a guard: when `cardinality === "plural"` and `outcome.partition === "unchanged"`, skip it (do not push). This keeps `outcomeToCascadePluginMessage` a pure total mapper and isolates the BULK-only suppression in one place. A marketplace group that ends up with zero plugin rows after suppression must be dropped from `marketplaces` (do not render an empty `● mp [scope]` header).

- **Site B (alternative): make the mapper return `undefined`.** `outcomeToCascadePluginMessage` (`update.ts:1609`) already documents (lines 1593-1597) that it *could* return `undefined` to skip a row, but "currently none." Returning `undefined` for `unchanged` when `cardinality === "plural"` and filtering at the call site is viable but spreads the logic across the mapper signature + both push sites (1812, 1815). Site A is more surgical.

**Anti-pattern:** Filtering in `notify.ts` (the renderer). The renderer is generic and shared; teaching it "drop up-to-date update rows" couples it to one operation's grammar and risks affecting install/reinstall idempotent-skip rows. Suppress at the source.

### Pattern 2: UGRM-02 — updates-only headline via an optional envelope override (NOT a `composeTally` rewrite)

**What:** Give the `update` cascade a headline that counts only realized transitions (`updated` + `force-installed` rows) and renders the verb `updated`, e.g. `Plugin update: 1 updated`, while leaving install/reinstall/marketplace/import headlines (`N successes`) byte-identical.

**The shared-helper boundary (the riskiest design decision):** `composeTally` (`notify.ts:2563-2612`) computes `successes = successCount.plugins + successCount.marketplaces - bareHeaders` from `countRowsBySeverity(..., "info")`. Every plural op routes through it. Three options, least → most invasive:

- **(c) RECOMMENDED — new optional envelope field, read by `composeTally`.** Add `readonly tally?: { verb: string; count: number }` (or similar) to `CascadeNotificationMessage` (`notify.ts:1057-1072`) and `ReconcileAppliedCascadeMessage` is NOT touched. In `composeTally`, when `message.tally` is present, render `${label}: ${tallyCategory(count, verb, verb+"s")}` (or a precomputed string) and skip the `successes` math entirely; failures/warnings can still fold in if desired, but for update's updates-only grammar the override fully owns the line. `notifyWithContext` is extended to thread this field from a new optional arg, OR `renderUpdateCascadeAndNotify` computes the updated count (`outcomes.filter(o => o.outcome.partition === "updated").length`, which includes force-installed since those are the `updated` partition with `unsupportedKinds` — confirm at `update.ts:1634`) and passes it. This keeps every other op's call to `composeTally` on the exact existing code path (no `message.tally` → identical output). **Least blast radius on other ops; the override is opt-in per message.**

- **(b) per-Messaging count parameter.** Thread a `tallyVerb`/`countFn` through `CommandContext.Messaging`. More invasive: changes the `CommandContext` type that all migrated commands satisfy, and forces a decision for every op even though only `update` changes.

- **(a) update-local summary override (bypass `composeTally`).** Have `update` compose its own tally string and pass it as a precomputed value. Viable but duplicates the `${label}: ...` formatting and the fold-placement logic; option (c) reuses `foldTallyAndHint` placement for free.

**Deriving the updated count:** the realized-transition rows are partition `updated` (which covers both clean `(updated)` and degraded `(force-installed)` — see `update.ts:1619-1646`: force-installed is emitted from the `updated` partition arm). So `count = outcomes.filter(o => o.outcome.partition === "updated").length` at `update.ts:1799`. This is derivable at the orchestrator BEFORE row suppression, so it is independent of UGRM-01's filtering. `[VERIFIED: codebase read]`

### Pattern 3: the all-up-to-date no-op line (UGRM-01, never-silent)

**What today renders** (catalog `all-up-to-date-noop`, `docs/output-catalog.md:799-809`, fixture at `catalog-uat.test.ts:1514-1544`):

```text
● official [user]
  ⊘ alpha (skipped) {up-to-date}
  ⊘ beta (skipped) {up-to-date}

Plugin update: 2 successes
```

**After suppression**, all rows are dropped and the marketplace header would be empty — the result must NOT be zero/silent output (a perceived hang). The plan must define a dedicated no-op body line. Two coherent options to settle in the spec:

- A single info line such as `Plugin update: nothing to update` (mirrors the `reconcile-pending-empty` precedent at `notify.ts:3181-3186`, which hard-codes `"Pending: next reload will apply 0 actions."` to lock it byte-exact against the catalog).
- Or `Plugin update: 0 updated (N up-to-date)` to carry the up-to-date tally the headline otherwise omits.

The CONTEXT leaves the exact string to the planner; recommend the first (shorter, matches UXG-02 "benign no-op gets a single clear line" philosophy and the existing no-op precedent). This line is emitted at info severity, no reload-hint (no state-changing row), consistent with today's `all-up-to-date-noop` severity.

### Recommended approach summary

1. `update.ts` (orchestrator): compute `updatedCount` from outcomes; suppress `unchanged` rows when `cardinality === "plural"`; drop now-empty mp groups; when the cascade is entirely empty (all up-to-date), emit the dedicated no-op line; stamp the updates-only tally override on the envelope.
2. `notify.ts`: add the optional `tally` override field to `CascadeNotificationMessage`; `composeTally` reads it when present, else current math.
3. `notify-context.ts`: thread the override through `notifyWithContext` (new optional arg) OR have update build the envelope directly.
4. Docs + tests: relock `all-up-to-date-noop`, `single-mp-mixed`, `bare-multi-mp`, `same-mp-both-scopes` update states + the new no-op state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Counting updated plugins | A render-time scan of rows by status token | `outcomes.filter(o => o.outcome.partition === "updated")` at the orchestrator | The partition is the authoritative signal; deriving from rendered tokens re-implements classification and breaks if a row is suppressed. |
| Pluralizing the headline verb | Inline `count===1 ? ... : ...` | Existing `tallyCategory(count, singular, plural)` (`notify.ts:2545`) | Already the canonical pluralizer; reuse it for `updated`/`updated` (note: "updated" is the same singular/plural — confirm the spec wants `1 updated` / `3 updated`, no plural-s). |
| Placing the tally between body and reload-hint | New fold logic | Existing `foldTallyAndHint` (`notify.ts:2620`) | Keeps byte placement identical to every other op. |
| The all-up-to-date no-op body string | Ad-hoc string built at the call site | A hard-coded constant locked against the catalog (precedent: `reconcile-pending-empty` at `notify.ts:3181-3186`) | Prevents byte drift between code and `docs/output-catalog.md`. |

**Key insight:** Every byte the user sees is locked in `docs/output-catalog.md` and gate-tested by `catalog-uat.test.ts`. The cheapest correct path reuses the existing fold/pluralize/count helpers and changes only *what counts* and *which rows render*, never *how* the line is assembled.

## Runtime State Inventory

This is a render/grammar phase — no stored data, services, OS state, secrets, or build artifacts are touched.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified: the change is in render/count logic; no `state.json` / persisted record reads its output. (Confirmed prior: "notify.ts Does Not Consume compatibility.notes".) | none |
| Live service config | None — verified: no external service consumes the summary line. | none |
| OS-registered state | None — verified: no OS registration involved. | none |
| Secrets/env vars | None — verified: no secret/env name references. | none |
| Build artifacts | None — verified: no package/artifact rename. | none |

**The canonical question:** after the code change, the only "cached" representation of the old grammar is the byte-exact strings embedded in `docs/output-catalog.md`, `docs/messaging-style-guide.md`, and the two test files. Those are git-tracked source, updated in lockstep — not runtime state.

## Common Pitfalls

### Pitfall 1: Suppressing the row in the renderer instead of the orchestrator
**What goes wrong:** Teaching `notify.ts` to drop `up-to-date` skip rows leaks update-specific grammar into the shared renderer and can affect install/reinstall idempotent-skip rows (`{already installed}`, etc.).
**Why it happens:** The renderer is where rows become bytes, so it feels like the natural filter point.
**How to avoid:** Suppress at `renderUpdateCascadeAndNotify` (`update.ts:1798-1817`), gated on `cardinality === "plural"` and `partition === "unchanged"`.
**Warning signs:** A diff touching `composeMarketplaceBlock`, `composePluginLines`, or the central `renderPluginRow` switch.

### Pitfall 2: Empty marketplace header after suppression
**What goes wrong:** A marketplace whose plugins were ALL up-to-date becomes a bare `● mp [scope]` header with no children — visual noise, and in the all-up-to-date case a header with no body line at all.
**Why it happens:** Suppression removes plugin rows but not the enclosing mp group.
**How to avoid:** After filtering, drop mp groups with zero plugin rows; when ALL groups are empty, emit the dedicated no-op line instead of the cascade body.
**Warning signs:** Catalog output showing a header with no indented rows under it.

### Pitfall 3: Breaking install/reinstall/marketplace/import summaries via `composeTally`
**What goes wrong:** Changing the shared `successes` math (`notify.ts:2574-2591`) to mean "updated count" silently rewrites the headline for every plural op — the explicit OUT-OF-SCOPE in CONTEXT.
**Why it happens:** `composeTally` is the single tally builder for all ops.
**How to avoid:** Make the update-only count an OPT-IN override on the message envelope; the absence of the override must leave the existing `successes` path byte-identical. Add a regression assertion that reinstall's `Plugin reinstall: 2 successes` (`output-catalog.md:601`, fixtures at `catalog-uat.test.ts` reinstall block) is unchanged.
**Warning signs:** Any reinstall/install/import catalog fixture diff in the PR.

### Pitfall 4: Forgetting the single-plugin targeted path
**What goes wrong:** Suppressing on cardinality-blind logic would hide the up-to-date skip on a `update <plugin>@<mp>` the user explicitly named (cardinality `single`). The single path also does not render the tally at all (`composeTally` returns `""` for `cardinality !== "plural"`, `notify.ts:2568`).
**Why it happens:** The `unchanged → (skipped) {up-to-date}` mapping is cardinality-agnostic today.
**How to avoid:** Gate suppression strictly on `cardinality === "plural"`. The single-target up-to-date render at `update.test.ts:325-335` (`● mp [project]\n  ⊘ hello (skipped) {up-to-date}`) must stay byte-identical.
**Warning signs:** A single-plugin update test changing.

### Pitfall 5: The "updated" verb has no plural-s
**What goes wrong:** `tallyCategory(n, "updated", "updateds")` would produce a malformed plural.
**How to avoid:** Use `"updated"` for both singular and plural (`1 updated`, `3 updated`), or use a precomputed string. Settle the exact wording in the spec and lock it in the catalog.

## Code Examples

### Current unchanged-row mapping (the suppression target)
```typescript
// update.ts:1663-1674 — the `unchanged` partition arm
case "unchanged":
  // Catalog `all-up-to-date-noop`: unchanged renders as `(skipped) {up-to-date}`.
  return {
    status: "skipped",
    name: outcome.name,
    scope: target.scope,
    reasons: ["up-to-date"],
    severity: "info",
    needsReload: false,
  };
```

### Current group-assembly loop (Site A suppression point)
```typescript
// update.ts:1798-1817 — push every row; this is where to skip `unchanged` for plural
const byMp = new Map<string, MpGroup>();
for (const { target, outcome } of outcomes) {
  const key = `${target.scope}:${target.marketplace}`;
  const existing = byMp.get(key);
  if (existing === undefined) {
    byMp.set(key, {
      name: target.marketplace,
      scope: target.scope,
      plugins: [outcomeToCascadePluginMessage(target, outcome, probe, cardinality)],
    });
  } else {
    existing.plugins.push(outcomeToCascadePluginMessage(target, outcome, probe, cardinality));
  }
}
```

### Current shared tally success math (the UGRM-02 boundary)
```typescript
// notify.ts:2572-2591 — SHARED across all plural ops; do not change the default path
const errorCount = countRowsBySeverity(message.marketplaces, "error");
const warningCount = countRowsBySeverity(message.marketplaces, "warning");
const successCount = countRowsBySeverity(message.marketplaces, "info");
const failures = errorCount.plugins + errorCount.marketplaces;
const warnings = warningCount.plugins + warningCount.marketplaces;
const bareHeaders = message.marketplaces.filter(
  (mp) => mp.severity === undefined && mp.status === undefined,
).length;
const successes = successCount.plugins + successCount.marketplaces - bareHeaders;
```

### No-op-line byte-lock precedent (reconcile)
```typescript
// notify.ts:3181-3186 — hard-coded body line locked against the catalog
case "reconcile-pending-empty":
  body = "Pending: next reload will apply 0 actions.";
  break;
```

## State of the Art

| Old Approach | Current (this phase) | When Changed | Impact |
|--------------|----------------------|--------------|--------|
| v1.5 UXG-05: bulk update renders every up-to-date plugin as `(skipped) {up-to-date}` | UGRM-01: suppress those rows in the bulk path; single clear no-op line for the all-up-to-date case | Phase 74 | Less cascade noise; aligns with UXG-02 benign-no-op suppression |
| Phase 50 / v1.11: `Plugin update: N successes` counts info-severity rows (up-to-date inflates) | UGRM-02: `Plugin update: N updated` counts realized transitions only | Phase 74 | Headline reads as operations-performed, not at-desired-state |

**Deprecated/outdated for `update` only (other ops keep `N successes`):**
- The `all-up-to-date-noop` catalog state's current `Plugin update: 2 successes` byte form (`output-catalog.md:806`).
- The `single-mp-mixed` update state's `Plugin update: 1 failure, 2 successes` (`output-catalog.md:770`) — the up-to-date `beta` row is suppressed and the success count becomes updated-count; reconcile the exact byte form in the plan.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Force-installed rows (degraded `--force` update) are the `updated` partition, so `partition === "updated"` is the correct count predicate including them. | Pattern 2 | If force-installed were a separate partition, the count would undercount degraded updates. Mitigated: verified at `update.ts:1619-1646` the force-installed arm is inside `case "updated"`. LOW risk. |
| A2 | The exact no-op string and the `N updated` verb/pluralization are planner/spec decisions (CONTEXT explicitly defers them). | Pattern 3 / Pitfall 5 | Wrong wording is a catalog relock, not a logic error. LOW risk — caught by catalog UAT. |
| A3 | Only `update` catalog states need relocking; install/reinstall/marketplace/import states stay byte-identical because the tally override is opt-in. | Pitfall 3 | If `composeTally` is changed in the shared path, other ops break. Mitigated by the opt-in-override design + regression assertion. MEDIUM risk if option (a)/(b) chosen instead of (c). |

## Open Questions

1. **Exact no-op line wording and `N updated` pluralization.**
   - What we know: must be never-silent, info severity, no reload-hint; CONTEXT defers the string to the spec.
   - What's unclear: `Plugin update: nothing to update` vs `Plugin update: 0 updated (N up-to-date)`; `1 updated` vs `1 update`.
   - Recommendation: lock both in `docs/output-catalog.md` during planning before any test is written; prefer `nothing to update` and the verb form `N updated`.

2. **Whether the `single-mp-mixed` update state should still show the suppressed up-to-date row.**
   - What we know: it is a `cardinality: "plural"` fixture (`catalog-uat.test.ts:1446`) mixing `updated` + `up-to-date` + `failed`.
   - What's unclear: after suppression the `beta (skipped) {up-to-date}` row disappears and the headline becomes (e.g.) `Plugin update: 1 failure, 1 updated` — confirm the mixed failure+updated headline grammar in the spec.
   - Recommendation: define the mixed-headline grammar explicitly (does the override coexist with the failure count, or fully replace the line?).

## Environment Availability

Skipped — no external dependencies. This phase modifies TypeScript render/count logic and markdown docs only. The existing toolchain (`node --test`, `npm run check`) is already in use across the repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), TS via native strip / `tsx` |
| Config file | none — `npm run check` (typecheck + ESLint + Prettier + tests) per NFR-6 |
| Quick run command | `node --test tests/orchestrators/plugin/update.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UGRM-01 | Bulk update suppresses per-plugin `(skipped) {up-to-date}` rows | byte-exact unit | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ (existing mixed-cascade test at `update.test.ts:663-672` must change: `beta` row removed) |
| UGRM-01 | Single-target up-to-date still renders the skip row | byte-exact unit | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ (existing at `update.test.ts:325-335`; must stay byte-identical — regression guard) |
| UGRM-01 | All-up-to-date bulk update emits a single non-silent no-op line | byte-exact catalog UAT | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (relock `all-up-to-date-noop` fixture `catalog-uat.test.ts:1514-1544` + new catalog block) |
| UGRM-02 | Headline counts updates only (`Plugin update: N updated`) | byte-exact catalog UAT + unit | `node --test tests/architecture/catalog-uat.test.ts tests/orchestrators/plugin/update.test.ts` | ✅ (relock `single-mp-mixed` / `bare-multi-mp` / `same-mp-both-scopes` update fixtures + `update.test.ts:669`) |
| UGRM-02 | install/reinstall/marketplace/import summaries unchanged | regression | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (existing reinstall fixtures `output-catalog.md:601,635,690,708`; assert no diff) |

### Sampling Rate
- **Per task commit:** `node --test tests/orchestrators/plugin/update.test.ts tests/architecture/catalog-uat.test.ts`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps
- None — both test files exist and already cover the update cascade + catalog UAT byte-pairing. New cases are additions/edits to existing fixtures, not new infrastructure.

## Security Domain

Not applicable beyond the project's standing constraints. This phase has no auth, session, access-control, crypto, or external-input surface. The one relevant invariant (IL-2): all user-visible output continues to flow through `ctx.ui.notify(...)` via the existing `emitWithSummary` seam — the change adds no direct `process.stdout`/`process.stderr` writes. V5 input validation: no new input is parsed (the count is derived from already-validated outcomes).

## Sources

### Primary (HIGH confidence — direct codebase read, 2026-06-29)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` — `outcomeToCascadePluginMessage` (1609-1674), `renderUpdateCascadeAndNotify` (1778-1863), cardinality (273), notify call (1862).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts` — `UPDATE_STATUSES`, `UPDATE_RENDER`, `UPDATE_CONTEXT` (label "Plugin update").
- `extensions/pi-claude-marketplace/shared/notify.ts` — `composeTally` (2563-2612), `countRowsBySeverity` (2391-2407), `tallyCategory` (2545), `foldTallyAndHint` (2620), `CascadeNotificationMessage` (1057-1072), `notify`/`emitCascadeWith` (3216-3336), `reconcile-pending-empty` no-op precedent (3181-3186).
- `extensions/pi-claude-marketplace/shared/notify-context.ts` — `notifyWithContext` (139-175) envelope stamping.
- `docs/output-catalog.md` — update states: `single-mp-mixed` (760-775), `failed-with-rollback-partial` (779-795), `all-up-to-date-noop` (797-809); reinstall states (601-713).
- `docs/messaging-style-guide.md` — severity ladder + benign no-op rule (107-122).
- `tests/architecture/catalog-uat.test.ts` — update fixtures (1441-1544+), catalog-state pairing harness (89, 3569).
- `tests/orchestrators/plugin/update.test.ts` — single-target up-to-date render (325-335), bulk mixed-cascade byte form (663-672), reload-hint cases (688+).

### Secondary (MEDIUM confidence — project memory observations)
- "Summary Success Count Derived from Info-Severity Rows; Up-to-Date Skips May Inflate It" (2026-06-29) — corroborates the `composeTally` info-row inflation.
- "Phase 74: Exact Code Sites for Bulk-Update No-Op Suppression and Count Fix" (2026-06-29).

## Metadata

**Confidence breakdown:**
- Suppression site + mechanism (UGRM-01): HIGH — exact lines verified; two viable sites, one recommended.
- Tally-count mechanism (UGRM-02): HIGH on the math/boundary; MEDIUM on the chosen threading option (three valid, recommend (c) opt-in envelope override).
- Blast radius (docs/tests): HIGH — every affected catalog state and test fixture located by line.
- No-op string / verb pluralization: deferred by CONTEXT to the spec (A2/A3 in Assumptions).

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (stable internal grammar; revalidate only if `notify.ts` tally helpers or the update cascade are refactored before planning).
