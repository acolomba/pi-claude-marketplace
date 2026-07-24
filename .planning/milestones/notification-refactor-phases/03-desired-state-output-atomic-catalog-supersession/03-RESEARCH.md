# Phase 3: Desired-state output & atomic catalog supersession - Research

**Researched:** 2026-06-24
**Domain:** Notification rendering surface (TypeScript/ESM), byte-exact catalog UAT discipline
**Confidence:** HIGH (this is an in-repo investigation; every load-bearing claim is grounded in a file:line read or a green test run, not training data)

<user_constraints>
## User Constraints (from 03-CONTEXT.md)

### Locked Decisions (D-01..D-06 — authoritative, override any older wording)

- **D-01 FULL desired-state severity map.**
  - Idempotent already-at-state → `info`: `update` up-to-date, `enable` already-enabled, `disable` already-disabled, `autoupdate`/`noautoupdate` already-set, `bootstrap` already-bootstrapped, `marketplace update` up-to-date.
  - Create-style already-exists → `error`: `install` already-installed *(stated as a CHANGE from "today's info" — see Pitfall 1, this is already `error` in code)*, `marketplace add` duplicate-name *(keep)*.
  - Absent-target → `error` across the board: `uninstall` of not-installed (incl. the PU-5 silent-converge already-gone path), `reinstall` of not-installed, `update` of not-installed, `marketplace remove` not-added *(keep)*, marketplace-not-added preconditions *(keep)*.
  - Unchanged: genuine success → `info`; failed → `error`; manual recovery → `warning`.
  - `reasons` set stays CLOSED. Severity changes on EXISTING reason rows, stamped by each producer. The PU-5 silent path must now emit an ERROR row.

- **D-02 leading severity sentence exact format:** `[A|Some] <subject> operation[s] has/have failed | needs/need attention.` — `subject`=`plugin`|`marketplace`, `A`=1 / `Some`>1, `has/have failed` for error, `needs/need attention` for warning, terminal period. Error/warning only.

- **D-03 mixed-subject detected at RENDER TIME** (NOT a structural discriminant). Cascades spanning both plugin and marketplace subjects (load-time `reconcile`, `import`) drop the subject noun (`[A|Some] operation[s] …`) and use the operation name in the tally, counting all rows uniformly.

- **D-04 trailing tally bound to STRUCTURAL CARDINALITY** (Phase 1 tuple-vs-array): single 1-tuple omits tally (still shows leading sentence for error/warning); plural array emits `<Operation>: <n> failure(s), <n> warning(s), <n> success(es)` (pluralized, zero-count omitted, no terminal period). `<Operation>` = `CommandContext.Messaging.label`.

- **D-05 marketplace header ALWAYS rendered.**

- **D-06 ATOMIC CATALOG SUPERSESSION:** `docs/output-catalog.md` AND `catalog-uat` fixtures rewritten IN THE SAME TASK/COMMIT as each code change; `catalog-uat` GREEN at EVERY commit boundary. Catalog grammar `present`→`installed` collapse lands here. `reasons` set stays closed. No generation seam (MOD-06 floor).

### Claude's Discretion
- The exact render-time mixed-subject detection mechanism (D-03) and how leading-sentence + tally read it.
- How each producer stamps the D-01 severities; how the PU-5 silent-converge path is converted to an `error` row.
- Catalog supersession sequencing within the phase (which states rewrite in which task) — provided `catalog-uat` is green at every commit boundary.
- Exact wording of any catalog prose; the byte-compared fenced blocks are the contract.

### Deferred Ideas (OUT OF SCOPE)
- Concern-module extraction (hooks summary, soft-dep injection) and the ≤3-central-files / 0-`notify.ts`-edits open-closed proof → Phase 4 (MOD-04/05/06, GATE-03).
- Catalog generation/aggregation seam → explicitly OUT OF SCOPE (MOD-06 floor; catalog stays hand-authored).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUT-01 | Severity via `ctx.ui.notify(msg, "warning"\|"error")`, host label retained; info omits 2nd arg | Already wired — `emitWithSummary` (notify.ts:2938) is the sole seam and already does exactly this. No code change; only the leading sentence (OUT-02) changes the FIRST arg. |
| OUT-02 | Leading severity sentence keyed to max severity | `buildSummaryLine` (notify.ts:2321) + `buildSummaryLineForCascade` (notify.ts:2268) currently produce the OLD grammar; D-02 rewrites these. |
| OUT-03 | Trailing tally `<Operation>: <n> failure(s), …` | NEW — no tally exists today. Must be ADDED to the composition. Counts come from the existing `countRowsBySeverity` (notify.ts:2245). `<n> success(es)` is a NEW count (today only failure/warning are counted). |
| OUT-04 | Operation label = `CommandContext.Messaging.label`; single omits tally | `Messaging.label` exists (Phase 1) but is NOT currently threaded into `notify()`/`emitWithSummary`. Threading it is the main new plumbing. |
| OUT-05 | Marketplace header always rendered | Largely ALREADY satisfied — `renderMpHeader` (notify.ts:1466) runs once per marketplace block in every cascade path; the always-header form is already the catalog baseline. Verify no plugin-row-without-header path remains. |
| OUT-06 | Mixed-subject cascades drop subject noun, use operation name | NEW render-time detection (D-03). Reconcile-applied + import already produce mixed plugin+mp blocks (catalog `invalid-config-row-with-cause`, `partial-marketplace-remove`). |
| OUT-08 | Catalog + fixtures rewritten in lockstep; per-row grammar preserved except `present`→`installed`; reasons closed | `docs/output-catalog.md` (1847 lines, 117 catalog-states) + `catalog-uat.test.ts` FIXTURES map. The `present` token still appears in catalog PROSE (lines 73/131/132/289/318) — collapse it. |
| GATE-02 | catalog-uat byte runner green at every boundary | `catalog-uat.test.ts` is GREEN now (verified). Atomic supersession keeps it green per commit. |
</phase_requirements>

## Summary

Phase 3 changes rendered bytes for the first time. The architecture is already correct after Phase 2: `notify()` and the `emitContextCascade`/`emitReconcileAppliedContextCascade` adapter seams are dumb reducers that route through a single `emitWithSummary(ctx, message, body)` seam, which computes severity (`computeSeverity` → `cascadeSeverity`, a pure MAX over caller-stamped `row.severity`) and prepends a summary line at error/warning severity. **All Phase 3 changes funnel through `emitWithSummary` and `buildSummaryLine` for the leading sentence and through a NEW tally-composition step for the trailing tally.** No new reducer is needed.

**Two surprises the planner must absorb (see Pitfalls):** (1) Most of D-01's *idempotent→info* map ALREADY landed in Phase 2 — `up-to-date`, `already enabled`, `already disabled`, `already autoupdate`, `already no autoupdate`, `already installed` are all in `IDEMPOTENT_REASONS` (notify-reasons.ts:30) and `skipSeverity()` already returns `info` for them; the producers already stamp `info`. (2) `install` already-installed is ALREADY an `error` row (`(failed) {already installed}`, install.ts:1572 → `severity:"error"`), contradicting the CONTEXT's "CHANGE from today's benign info." So the genuine *code* deltas for D-01 are NARROW: the absent-target cases (`not installed`/`not found` → `error`, today `warning`) and the PU-5 silent-converge path (today literal silence / `converged` outcome → must emit an `error` row). Everything else in D-01 is either already satisfied or a catalog-wording change only.

**Primary recommendation:** Thread `Messaging.label` into the cascade seams; rewrite `buildSummaryLine`/`buildSummaryLineForCascade` to the D-02 grammar with render-time mixed-subject detection (D-03); add a tally composer gated on structural cardinality (D-04); flip the handful of absent-target severity stamps and convert the PU-5 silent path to an error row; then rewrite catalog states + fixtures in lockstep, sequenced so `catalog-uat` is green at every commit (see Sequencing Strategy).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Caller-stamped severity (D-01) | Producer (orchestrator emit site) | — | Phase 2 relocated correctness to producers; severity is a stamped fact. |
| Severity MAX-reduce | Renderer (`cascadeSeverity`/`computeSeverity`) | — | Dumb reducer; reads only stamped facts. |
| Leading sentence (D-02) | Renderer (`buildSummaryLine`) | Renderer | Computed structurally from rows + max severity, NOT caller free text. |
| Trailing tally (D-04) | Renderer (NEW composer) | `Messaging.label` from CommandContext | Tally counts are renderer-derived; the label is the one horizontal datum (Phase 1). |
| Mixed-subject detection (D-03) | Renderer (render-time) | — | User's explicit choice: read the actual rows' subjects at render time, not a structural type. |
| Cardinality (tally trigger, D-04) | Type model (structural tuple-vs-array) | Producer call site | OUT-07 — structural, set at the call site. |
| Always-header (D-05) | Renderer (`renderMpHeader` per block) | — | Header is unconditional per marketplace block. |
| Catalog byte contract (D-06) | `docs/output-catalog.md` + `catalog-uat.test.ts` | — | Hand-authored; one section per rendered state (MOD-06 floor). |

## Standard Stack

No new packages. This phase edits existing in-repo TypeScript only. The project's stack (Node `node --test`, TypeScript strict, ESM-only, typebox) is unchanged — see CLAUDE.md. **No `npm install` in this phase**, so no Package Legitimacy Audit is required.

## Project Constraints (from CLAUDE.md)

- All user-visible messages MUST go through `ctx.ui.notify(message, severity)` (IL-2). The single sanctioned seam is `emitWithSummary` → `ctx.ui.notify` in `shared/notify.ts`. Exactly ONE `ctx.ui.notify` call per `notify()` invocation.
- ESM-only (`"type": "module"`); TypeScript strict.
- English only (IL-1) — the D-02 sentence + D-04 tally are English literals, fine.
- `npm run check` must stay green (typecheck + ESLint + Prettier + `npm test` + `npm run test:integration`) — GATE-03 at every boundary.
- No telemetry (IL-4).
- Comment policy (`.claude/rules/typescript-comments.md`): use requirement/decision IDs (`OUT-02`, `D-04`) as anchors; never `Phase N`/`Plan N`/`Wave N`. The existing notify.ts comments already follow this.

## Architecture Patterns

### Composition surface diagram (data flow)

```
producer emit site (orchestrators/**)              CommandContext (Phase 1)
  stamps row.severity / row.needsReload              .Messaging.label  ─┐
        │                                                               │
        ▼                                                               │
notifyWithContext(ctx, pi, CONTEXT, rows)  ──►  emitContextCascade ◄────┘ (NEW: thread label)
  (notify-context.ts)                              (notify.ts:3091)
        │                                                │
        │ legacy path: notify(ctx,pi,message)            │
        ▼                                                ▼
   per-block: renderMpHeader + per-row render      compose body string
        │                                                │
        └───────────────────►  emitWithSummary(ctx, message, body)  ◄──── (NEW: also pass label)
                                   (notify.ts:2938)
                                        │
                  severity = computeSeverity(message)  ── MAX over row.severity
                                        │
                   ┌────────────────────┴─────────────────────┐
              severity===undefined (info)            error / warning
                   │                                       │
            ctx.ui.notify(body)        ctx.ui.notify(
                                          `${buildSummaryLine(...)}\n\n${body}`,  ◄── OUT-02 (rewrite grammar)
                                          severity)
                                          + NEW: tally appended to body (OUT-03/04, plural only)
```

### Pattern 1: Single emission seam (preserve)
**What:** `emitWithSummary` is the ONLY place `ctx.ui.notify` is called for cascades (plus `notifyUsageError`/`notifyDiagnostic`/`notifyAsyncRewakeSummary` for out-of-band). Every Phase-3 change to the leading sentence and tally lands inside or just before this seam.
**Why:** GRAM-04 anti-divergence guarantee + IL-2 single-call discipline. Do NOT add a second `ctx.ui.notify` call.

### Pattern 2: Pure structural severity reduce (preserve)
`cascadeSeverity` (notify.ts:2121) is a pure MAX over `row.severity` (mp-level AND nested plugin rows), absent defaults to `info`. The leading sentence and tally MUST be derived from the same row traversal so they never disagree with the emitted severity arg.

### Pattern 3: Tally gated on structural cardinality (D-04)
The tally appears iff the operation is plural. Phase 1 expresses this via `Single<Row> = readonly [Row]` vs `Plural<Row> = readonly Row[]` (notify-context.ts:77-78), but those aliases are NOT currently carried into the runtime payload — `CascadeNotificationMessage.marketplaces` is a flat `readonly MarketplaceNotificationMessage[]` and a single-target op is a 1-element array at runtime. **Open question for the planner (see Open Questions #1):** the tally trigger needs a runtime signal of "this command is single-target vs bulk." Options: (a) carry a `cardinality: "single" | "plural"` discriminant on the message/CommandContext; (b) infer from the command (single-target commands: install, uninstall, single enable/disable/reinstall/update of one plugin; bulk: list, import, reconcile, @marketplace cascades). Per D-04 "no separate render-time row-count heuristic," a row-count fallback is explicitly disallowed — the signal must be structural.

### Anti-Patterns to Avoid
- **Re-deriving severity from content in the summary path** — forbidden by SEV-04; read stamped facts only.
- **Counting rows to decide cardinality** — forbidden by D-04; cardinality is structural.
- **A second `ctx.ui.notify` call** — IL-2 violation; compose one string.
- **Touching the `REASONS` tuple** (notify.ts:82) — closed set, byte-order-critical for catalog stability (OUT-08). The D-01 changes are severity stamps on EXISTING reasons, never new reasons.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Severity reduce | A new max function | `cascadeSeverity` (notify.ts:2121) | Already pure-MAX over stamped facts. |
| Row tally by severity | A new counter | `countRowsBySeverity` (notify.ts:2245) | Already counts mp+plugin rows by stamped severity. Extend it to also count `info` (success) for OUT-03's `<n> success(es)`. |
| Pluralization | A new helper | Extend the existing `operationPhrase` (notify.ts:2294) pattern OR a small `pluralize(n, "failure")` | `operationPhrase` is "operation/operations"-specific; D-04 needs "failure(s)/warning(s)/success(es)". A tiny new pluralizer is fine; keep it local. |
| Idempotent-reason classification | Re-implement benign lookup | `skipSeverity` + `IDEMPOTENT_REASONS` (notify-reasons.ts) | Already classifies idempotent→info. The absent-target change is about reasons NOT in this set. |

**Key insight:** The reducer and counting machinery already exist and are correct. Phase 3 is (1) a grammar rewrite of the summary line, (2) a NEW tally string appended to the body, (3) threading the label, and (4) a few producer severity flips + the PU-5 conversion. Resist rebuilding the reducer.

## Runtime State Inventory

This is a rendered-output + catalog-doc refactor. No databases, OS registrations, or secrets are involved.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified: `notify.ts` and orchestrators read no datastore for rendering; severity is a stamped field, not persisted. | none |
| Live service config | None — no external service holds rendered strings. | none |
| OS-registered state | None. | none |
| Secrets/env vars | None. | none |
| Build artifacts | None — `.ts` is strip-run by `node --test`; no compiled output to regenerate. | none |

**The one "cached/registered string" analogue:** the catalog `docs/output-catalog.md` IS the externalized contract that holds the OLD rendered bytes. It is the "runtime state" that must be migrated in lockstep — exactly what D-06 / OUT-08 enforces. The `catalog-uat` byte runner is the migration verifier.

## Producer Inventory for D-01

The ~18 commands live under `orchestrators/{plugin,marketplace,import,reconcile}/`. Each has a `*.messaging.ts` (CommandContext + render map, lifted byte-verbatim) and an orchestrator (`*.ts`) that does the actual `severity:` stamping at emit sites. Below is the D-01-relevant emit-site map. **Status legend:** ✅ already correct (no code change) · 🔧 code change needed · 📝 catalog/fixture change only.

### Idempotent "already at desired state" → `info` (D-01) — MOSTLY ALREADY DONE

| Command | Reason stamped | Today | D-01 wants | Site | Status |
|---------|----------------|-------|-----------|------|--------|
| `update` up-to-date | `up-to-date` | `info` (via `skipSeverity`, in `IDEMPOTENT_REASONS`) | `info` | plugin/update.ts:1546 (`unchanged`→info hard-coded); :1564 (`skipped`→`skipSeverity`) | ✅ |
| `marketplace update` up-to-date | `up-to-date` | `info` | `info` | marketplace/update.ts:669 (`unchanged`→info) | ✅ (stale comment at update.ts:14-16 says "warning" — pre-Phase-2, ignore) |
| `enable` already-enabled | `already enabled` | `info` | `info` | plugin/enable-disable.ts:938 (`idempotent`→info) | ✅ |
| `disable` already-disabled | `already disabled` | `info` | `info` | plugin/enable-disable.ts:938 | ✅ |
| `autoupdate` already-set | `already autoupdate` | `info` | `info` | marketplace/autoupdate.ts:567 | ✅ |
| `noautoupdate` already-set | `already no autoupdate` | `info` | `info` | marketplace/autoupdate.ts:567 | ✅ |
| `bootstrap` already-bootstrapped | (delegates) | `info` | `info` | plugin/bootstrap.ts (delegates to add/install; no own severity stamp) | ✅ verify the delegated idempotent path renders info |

> **Mechanism:** `skipSeverity(reasons)` (notify-reasons.ts:51) returns `info` iff every reason is in `IDEMPOTENT_REASONS`. All six idempotent reasons above are already members (notify-reasons.ts:30-37). So Phase 2 already shipped the idempotent→info half of D-01. Phase 3's job for these is **catalog wording only** (if any prose calls them "warning") and confirming the fixtures' `expectedSeverity` is absent (info).

### Create-style "already exists" → `error` (D-01)

| Command | Reason | Today | D-01 wants | Site | Status |
|---------|--------|-------|-----------|------|--------|
| `install` already-installed | `already installed` | **`error`** (`(failed) {already installed}`) | `error` | install.ts:1572 (`classifyEntityShapeError` → `already-installed` kind → reasons `["already installed"]`) → Branch 3 → install.ts:1503 `severity:"error"` | ✅ code; 📝 confirm catalog. **CONTRADICTS CONTEXT** (see Pitfall 1). |
| `marketplace add` duplicate-name | `duplicate name` | `error` | `error` (keep) | marketplace/add.ts:485 (`severity:"error"`); classifyAddError → `duplicate name` (add.ts:236) | ✅ |

### Absent-target "can't operate" → `error` across the board (D-01) — THE REAL CODE DELTAS

| Command | Reason | Today | D-01 wants | Site | Status |
|---------|--------|-------|-----------|------|--------|
| `uninstall` not-installed (PU-5 already-gone) | (none — silent) | **literal silence** (standalone `return undefined`; orchestrated `{status:"converged"}`) | **`error` row** | uninstall.ts:534-548 | 🔧 **HIGH effort — see PU-5 section** |
| `reinstall` not-installed | `not installed` | `warning` (`skipSeverity(["not installed"])`) | `error` | reinstall.ts:854-866 (`skipped`→`skipSeverity`); synthesized phantom at reinstall.ts:1092 (`notes:["not installed"]`) | 🔧 |
| `update` not-installed | `not installed`/`not found` | `warning` (`skipSeverity`) | `error` | update.ts:1549-1566 (`skipped`→`skipSeverity`) | 🔧 |
| `marketplace remove` not-added | `not added` | `error` | `error` (keep) | remove.ts:271/329 (`severity:"error"`) | ✅ |
| marketplace-not-added preconditions (install/uninstall/update/reinstall) | `not added` | `error` (standalone `MarketplaceNotAddedMessage`) | `error` (keep) | install.ts (MarketplaceNotAdded), uninstall.ts:285 (`emitMarketplaceNotAdded`), reinstall/update via `MarketplaceNotAddedSignal` | ✅ |

> **Mechanical note on the not-installed → error change.** Both `reinstall` not-installed and `update` not-installed flow through `skipSeverity(reasons)` where `reasons === ["not installed"]`. Since `not installed` is NOT in `IDEMPOTENT_REASONS`, `skipSeverity` returns `warning` today. D-01 wants `error`. Two clean mechanical options (planner discretion, D-01 note):
> - **(A) Stamp `error` directly at the producer** for the absent-target outcome arm (replace `severity: skipSeverity(reasons)` with `severity: "error"` for the not-installed/not-found arm), keeping the row a `skipped` status (so the catalog `(skipped) {not installed}` grammar is preserved — only the severity arg + summary line change).
> - **(B) Promote the row to a `failed` status** carrying `not installed` (changes the per-row glyph/token grammar — heavier catalog blast radius; D-06 says preserve per-row grammar except `present`→`installed`, so **option A is preferred**).
> Either way the `reasons` set stays closed (`not installed` already exists). Recommend **A** — minimal per-row grammar change, severity-only flip, smallest catalog delta.

### The PU-5 silent-converge conversion (the hard one)

**Today (uninstall.ts:534-548):**
```
if (alreadyGone) {
  if (orchestrated) return { status: "converged", name: plugin };  // apply DROPS this (apply.ts:512)
  return undefined;                                                  // standalone: literal silence, NO notify call
}
```
**D-01 requires** this to report `error`. Mechanically:
- **Standalone path:** replace `return undefined` with a `notifyWithContext(ctx, pi, UNINSTALL_CONTEXT, [{ name: marketplace, scope, plugins: [failedRow] }])` where `failedRow` is a `PluginFailedMessage` (or a `skipped` row stamped `error`, option-A style) with `reasons: ["not installed"]`, `severity: "error"`, `needsReload: false`. Use the existing `emitCascadeFailure` shape (uninstall.ts:220) as the template.
- **Orchestrated path (reconcile apply):** the `"converged"` outcome arm (UninstallPluginOutcome, uninstall.ts:100) is consumed at apply.ts:512 where it is currently DROPPED (no row). D-01 says the already-gone case now reports error. **Caution (NFR/RECON):** the orchestrated converge exists specifically so a reconcile racing another process "never reports an uninstall it did not perform" (uninstall.ts:88-92 / WR-06). Flipping orchestrated converge to an error row could make load-time reconcile noisily report errors for benign races. **This is a real design tension the planner MUST resolve with the user/CONTEXT:** does D-01's "error across the board" apply to the load-time orchestrated converge, or only to the user-invoked standalone uninstall? The CONTEXT names "uninstall of a not-installed plugin" — read as the standalone user command. Recommend: convert the **standalone** path to error (unambiguous D-01), and FLAG the orchestrated converge as Open Question #2 (likely keep silent to preserve race-safety, but confirm). The `UninstallPluginOutcome` `"converged"` arm and apply.ts:512 are the exact sites.

### enable/disable not-installed — NOT in the D-01 absent-target list (gap to flag)

`enable`/`disable` of a not-recorded plugin stamps `warning` today (enable-disable.ts:927, reason `not installed`). D-01's absent-target list enumerates **uninstall / reinstall / update** explicitly — it does NOT mention enable/disable. Per the closed-world reading, enable/disable not-installed stays `warning`. **Flag for the planner:** confirm with CONTEXT whether the "absent-target → error across the board" intent extends to enable/disable, or whether the explicit enumeration is exhaustive. (The CONTEXT phrasing "the user named a target not in the state the command needs" arguably covers enable/disable too.) Default to the literal enumeration (stays warning) unless the user says otherwise.

## The Summary Composition Surface

All in `extensions/pi-claude-marketplace/shared/notify.ts`.

| Symbol | Line | Role | Phase 3 disposition |
|--------|------|------|---------------------|
| `emitWithSummary(ctx, message, body)` | 2938 | THE single emission seam; `severity===undefined → notify(body)`, else `notify(\`${buildSummaryLine}\n\n${body}\`, severity)` | EXTEND: pass `Messaging.label` through; tally is part of `body` (folded before this call) or composed here. Keep ONE notify call. |
| `computeSeverity(message)` | 2144 | Dumb reducer; info-kind switch + `cascadeSeverity` MAX | KEEP unchanged (pure MAX). |
| `cascadeSeverity(message)` | 2121 | Pure MAX over `row.severity` | KEEP. The leading sentence + tally read the same rows. |
| `buildSummaryLine(message, severity)` | 2321 | Builds OLD grammar `N plugin operation(s) failed/skipped.` | **REWRITE to D-02** `[A\|Some] <subject> operation[s] has/have failed \| needs/need attention.` + render-time mixed-subject detection (D-03). |
| `buildSummaryLineForCascade(mps, severity)` | 2268 | OLD grammar for cascade/reconcile arm | **REWRITE to D-02**; this is where D-03 mixed-subject detection naturally lives (it already inspects plugin-vs-mp counts via `countFailedRows`/`countSkippedRows`). |
| `operationPhrase(count, kind)` | 2294 | "N plugin operation(s)" pluralizer | Likely retired/replaced by the D-02 `[A\|Some] <subject> operation[s]` phrasing + a new `<n> failure(s)` pluralizer for the tally. |
| `countRowsBySeverity(mps, target)` | 2245 | Counts mp+plugin rows where stamped severity === target | EXTEND: add an `info`/success count for the tally's `<n> success(es)` (today only "warning"/"error" are valid targets — widen or add a sibling counter). |
| `countFailedRows` / `countSkippedRows` | 2218 / 2236 | Thin wrappers over `countRowsBySeverity("error"/"warning")` | Reuse for tally failure/warning counts. |
| `RELOAD_HINT_TRAILER` | 2088 | `/reload to pick up changes` literal | KEEP. Tally goes BETWEEN body and reload trailer, or after — define order in the catalog (see Open Question #3). |
| `emitContextCascade` | 3091 | Cascade adapter for `notifyWithContext` | THREAD `Messaging.label` from the CommandContext into `emitWithSummary`. Currently it has only `message` + `renderPluginRowBody`; the label is NOT passed. |
| `emitReconcileAppliedContextCascade` | 3137 | Reconcile-applied adapter | Same — thread label (reconcile's label) for the mixed-subject tally. |
| `notify(ctx, pi, message)` | 3006 | Legacy/standalone dispatcher | Routes standalone kinds + cascade. The standalone `marketplace-not-added`/`plugin-info` arms also use `buildSummaryLine` (hard-count-1 today) — these become D-02 single-subject sentences. |

**How the label reaches the seam.** `Messaging.label` lives on the `CommandContext` (notify-context.ts:63). `notifyWithContext`/`notifyReconcileAppliedWithContext` HAVE the context (they receive it as a param) but DROP the label before calling `emitContextCascade` (they only pass `message` + a render closure). **The plumbing change:** pass `context.Messaging.label` through `emitContextCascade`/`emitReconcileAppliedContextCascade` into `emitWithSummary`, so the tally can render `<Operation>: …`. The legacy `notify()` path has NO CommandContext — but by Phase 1's full migration (D-13, all 18 commands), the legacy `notify()` is only used for the standalone info/not-added kinds, whose tally is either absent (info) or single-subject (count-1, no tally). Confirm the legacy `notify()` cascade arm is dead post-migration (Phase 1 Plan 01-05 "remove legacy notify()").

**How D-03 mixed-subject detection reads rows.** `buildSummaryLineForCascade` already computes `counts.plugins` and `counts.marketplaces` separately (via `countFailedRows`/`countSkippedRows`). Mixed-subject = both `counts.plugins > 0` AND `counts.marketplaces > 0` across the union of severities present (not just the max-severity tier). **Recommended detection:** a row is "plugin-subject" if it is a nested plugin row, "marketplace-subject" if it is an mp-level row; iterate all rows once, collect the set of subjects seen. If the set has both → mixed → drop the noun. This is a render-time scan of `message.marketplaces[].{severity, plugins[].severity}`, consistent with D-03's "detected at RENDER TIME from the actual rows' subjects."

## The Catalog / Fixture Byte Contract (D-06 blast radius)

### Structure
- **`docs/output-catalog.md`** (1847 lines, **117 `<!-- catalog-state: STATE -->` annotations** across ~18 per-command `## H2` sections). Each annotation pairs with the NEXT fenced ```` ```text ```` block. Non-command H2s (Conventions, Severity routing, Status token reference) reset the section to `null` and their blocks are NOT extracted.
- **`tests/architecture/catalog-uat.test.ts`** (3220 lines): `loadCatalogExamples()` walks the catalog and yields `(section, state, expected)` tuples; the `FIXTURES` map (keyed `[section][state] → { message, pi, expectedSeverity? }`) supplies a programmatic `NotificationMessage`; the driver runs `notify(mockCtx, mockPi, message)` and **byte-compares `ctx.ui.notify.mock.calls[0].arguments[0]` against the catalog fenced block**, and asserts `arguments[1]` equals `expectedSeverity` (or is absent for info).
- **Two-direction gate:** forward walk (catalog→fixture, every annotation needs a fixture) + inverse walk (fixture→annotation, no orphan fixtures). Both must stay satisfied — **adding a catalog state REQUIRES adding a fixture in the same commit, and vice versa.** This is the structural enforcer of atomic supersession.

### Blast radius by change

| Change | Catalog states affected | Magnitude |
|--------|------------------------|-----------|
| (a) Leading sentence grammar (D-02) | EVERY error/warning fenced block. **69 occurrences** of `operation[s] (failed\|skipped).` in catalog (grep); roughly **40–50 distinct fenced blocks** carry a summary line. Each rewrites `N plugin operation failed.` → `A plugin operation has failed.` etc. | **LARGE — the dominant blast radius.** |
| (b) Trailing tally (D-04) | Every PLURAL error/warning/mixed block gains a new tally line; bulk info blocks may gain a tally too (D-04 says tally on plural — confirm whether info-severity plural ops show a tally; see Open Question #3). Sections: reinstall, update (cascade), import, reconcile-applied, marketplace update (cascade), list? | **MEDIUM — additive lines in cascade sections.** |
| (c) Always-header (D-05) | Audit: any state where a plugin row appears without a header. From the read, all cascade blocks already lead with `● <mp> [scope]`. Likely **0–few** changes; verify the standalone `marketplace-not-added`/`scope-mismatch` bare-row states (those are mp-subject rows with no plugin child, so no header is "missing"). | **SMALL.** |
| (d) `present`→`installed` grammar collapse | Catalog PROSE at lines 73, 131-132, 289, 318 references the `present` discriminator + status-token table row. No fenced ```` ```text ```` block emits the literal token `(present)` (the render was already byte-identical to `(installed)`). So this is a **prose + status-token-reference-table** edit, not a fixture-byte change. | **SMALL (prose/table only).** |
| (e) D-01 severity changes | Absent-target states: `reinstall` not-installed, `update` not-installed → fixture `expectedSeverity` flips `warning`→`error` AND the summary line changes; NEW `uninstall` not-installed/PU-5 state ADDED (new annotation + new fixture). enable-disable `enable-not-installed`/`disable-idempotent` states: re-verify severity. | **MEDIUM — a handful of states, plus 1 NEW.** |

### Which fixtures co-change with which code (the sequencing input)
- The leading-sentence rewrite (a) co-changes with the `buildSummaryLine`/`buildSummaryLineForCascade` edit. Because the byte gate compares the WHOLE first arg, **the moment you change `buildSummaryLine`, every summary-bearing fixture goes red until its catalog block is rewritten.** This is the "touching shared notify.ts breaks many fixtures at once" hazard. → Must bundle the grammar rewrite with ALL summary-bearing catalog blocks + fixtures in ONE commit, OR introduce the grammar behind the same change that updates them. There is no partial-green intermediate for the summary grammar.
- The tally (b) is additive: each cascade fixture's catalog block gains a tally line. Can be staged per-command-section IF the tally is introduced in a way that is off until the label is threaded — but realistically the tally composer + the cascade catalog blocks co-change in one commit per logical group.
- The D-01 absent-target flips (e) co-change with their specific fixtures only — these are independently commitable per command.

## The Wire-Coverage Test

`tests/architecture/notify-producer-wire-coverage.test.ts` (253 lines, GREEN verified). It asserts **producer→reducer→wire severity + reload-trailer presence** — NOT byte body. It hard-codes one `WireFixture` per standalone render-map arm (install/uninstall/update/reinstall/enable/disable SUCCESS + one benign skip + one failure), each carrying the EXACT producer-stamped `severity`/`needsReload` and the expected wire severity + trailer.

**What changes for Phase 3:**
- The existing 8 fixtures cover success/benign-skip/failure — **none of them is a D-01 absent-target case**, so they do NOT flip. The grammar/tally changes do NOT affect this test (it asserts `args[1]` severity and trailer substring, not the body).
- **ADD** wire fixtures for the new D-01 absent-target rows so the producer→wire path is gated: `reinstall not-installed → error/no-trailer`, `update not-installed → error/no-trailer`, `uninstall PU-5 already-gone → error/no-trailer` (the new error row). These additions are in lockstep with the producer severity flips (same commit).
- The doc-comment at the top cites producer line numbers (install.ts:1359 etc.); update those refs if the absent-target producers shift lines.

This test is the right gate to catch a producer regressing a not-installed stamp back to `warning`. Add the absent-target fixtures alongside the producer change.

## The Closed Reasons Set

`extensions/pi-claude-marketplace/shared/notify-reasons.ts` groups the closed `REASONS` (32 entries, declared in notify.ts:82-123) into typed views:
- `IDEMPOTENT_REASONS` (notify-reasons.ts:30): `up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`, `already enabled`, `already disabled`. These drive `skipSeverity → info`.
- `UNSUPPORTED_REASONS` (:64): soft-dep/unsupported topics.
- `FAILURE_REASONS` (:78): permission/source/network/manifest/lock/concurrency.
- Command-private (named only for the coverage proof, :113): `not found`, `not installed`, `plugins remain`, `stale clone`, `duplicate name`, `not added`, `orphan rewake`.
- `_ReasonsCoverage` compile-time proof (:132) asserts the partition is total — **adding a reason to `REASONS` without a home here is a compile error.**

**Confirmation for D-01:** every D-01 case maps to an EXISTING reason. Idempotent→info uses `IDEMPOTENT_REASONS` (already wired). Create-style→error uses `already installed` (already error via the failed-row path) and `duplicate name` (already error). Absent-target→error uses `not installed` / `not found` / `not added` (all existing command-private reasons). **No new reason is needed; the set stays closed (OUT-08).** The D-01 deltas are pure severity-stamp changes on existing reason rows. `skipSeverity`'s contract (info iff all-idempotent, else warning) does NOT auto-produce `error` — so the absent-target → error change must be stamped by the producer directly (option A above), NOT by extending `skipSeverity` (which only knows info-vs-warning). **Do not add `not installed`/`not found` to any "error reasons" set inside `skipSeverity`** — keep severity a producer-stamped fact (SEV-04/05).

**Flag:** there is NO existing "BENIGN_REASONS ladder" to return to — it was deleted in Phase 2. Confirmed: `skipSeverity` + `IDEMPOTENT_REASONS` is the replacement, and it is producer-local. Good.

## Atomic-Supersession Sequencing Strategy

The hard constraint: `catalog-uat` GREEN at EVERY commit boundary (and `npm run check` green — GATE-03). The dominant hazard is that **editing `buildSummaryLine`/`buildSummaryLineForCascade` reddens every summary-bearing fixture at once.** Sequencing must therefore bundle each shared-grammar edit with all the catalog blocks it affects.

Recommended ordering (each numbered item is one green commit boundary):

1. **D-01 absent-target severity flips (independent, low-blast).** Flip `reinstall`/`update` not-installed to `error` (option A: severity-only, keep `skipped` token). Rewrite the 2–3 affected catalog states (`reinstall not-installed-*`, `update not-installed-*`) — only the `expectedSeverity` and the summary line for those blocks change. Add the wire-coverage fixtures. *Note:* this changes the OLD summary grammar on those blocks; you can either (a) do this AFTER the grammar rewrite (item 3) to avoid a double-edit, or (b) do it first using the old grammar and re-touch in item 3. **Recommend doing absent-target flips together with item 3** to avoid touching the same catalog blocks twice. So treat item 1 as folded into item 3 unless the planner wants a pure severity-only commit first.

2. **PU-5 silent-converge → error row (standalone).** Convert the standalone `alreadyGone` path to emit a `failed`/`error` row. ADD a new catalog state (`uninstall` → `not-installed-already-gone` or similar) + its fixture + a wire-coverage fixture, in the same commit. Resolve Open Question #2 (orchestrated converge) before touching apply.ts. This is self-contained and green per commit.

3. **Leading sentence grammar (D-02) — THE BIG BUNDLE.** Rewrite `buildSummaryLine` + `buildSummaryLineForCascade` to the D-02 grammar with render-time mixed-subject detection (D-03 for the mixed cascades), and rewrite **all summary-bearing catalog fenced blocks + their fixtures** in the same commit. This is necessarily one large atomic commit (≈40–50 blocks) because the byte gate admits no partial state. Fold the item-1 absent-target summary-line updates here. Thread `Messaging.label` plumbing here only if the tally (item 4) needs it; otherwise keep label-threading minimal.

4. **Trailing tally (D-04/OUT-03/04) + label threading.** Add the tally composer, thread `Messaging.label` through `emitContextCascade`/`emitReconcileAppliedContextCascade` → `emitWithSummary`, gate on structural cardinality (resolve Open Question #1 first), and add the tally line to every PLURAL catalog block + fixture in the same commit. This is additive per cascade section, so it CAN be split per-command-section (reinstall, update, import, reconcile-applied, marketplace-update) into several green commits IF the tally machinery is introduced first in a way that emits the tally only for sections whose catalog already has it — but the simplest correct path is one commit covering the tally code + all plural catalog blocks. Mixed-subject tally (D-03) lands here for reconcile/import.

5. **`present`→`installed` catalog grammar collapse (D-06).** Prose + status-token-reference-table edit in `docs/output-catalog.md` (lines 73, 131-132, 289, 318) and any lingering `present` mention. No fixture byte change (the render was already `(installed)`). Low risk; can be its own small commit. Verify the status-token reference table row is removed/merged.

6. **D-05 always-header audit + cleanup.** Confirm no plugin-row-without-header path; if the audit finds none, this is a no-op commit (or folded into item 3's verification). Likely no code change.

**Ordering hazards to call out:**
- **Item 3 is unavoidably one large commit.** Do not attempt to land the grammar change with only some catalog blocks updated — the byte gate will be red. Plan for a single big atomic supersession commit for the leading sentence.
- **Threading `Messaging.label`** must not change any byte until the tally consumes it (item 4). If you thread the label in item 3, ensure it is unused/inert there so item 3's catalog blocks don't shift.
- **The two-direction fixture gate** means every NEW catalog state (PU-5, any new tally-bearing state) needs a fixture in the SAME commit, and removing/renaming a state needs the fixture removed in the same commit. No orphans, no missing fixtures — ever.
- **`npm run check` includes `npm run test:integration`** — slower; run the targeted `catalog-uat` + `notify-*` arch tests per commit, then the full `npm run check` at each commit boundary.

## Common Pitfalls

### Pitfall 1: The CONTEXT's "install already-installed: CHANGE from today's benign info" is WRONG against the code
**What goes wrong:** A plan that "changes install already-installed from info to error" will find the code already emits `(failed) {already installed}` at `error` severity (install.ts:1572 → Branch 3 → :1503). Implementing the "change" would be a no-op or could regress.
**Why it happens:** The CONTEXT/REQUIREMENTS narrative (SEV-05 example "install already-installed → error") describes the *desired-state intent*, but the v2 codebase already routes already-installed through the entity-shape failure classifier as an error. The "benign info" was a pre-v2 (or hypothetical) baseline.
**How to avoid:** Treat install already-installed as **already satisfied in code**; the Phase-3 work for it is confirming the catalog block/fixture severity is `error` and the summary line uses the D-02 grammar. Do NOT re-route it.
**Warning signs:** A plan task that edits `classifyEntityShapeError` or the install row to "downgrade then re-upgrade" severity.

### Pitfall 2: Most idempotent→info cases are already done — don't re-implement
**What goes wrong:** Re-stamping `up-to-date`/`already enabled`/etc. to `info` when they already are, possibly re-introducing a content lookup (violating SEV-04).
**Why:** Phase 2's `skipSeverity` + `IDEMPOTENT_REASONS` already covers them.
**How to avoid:** Verify via the existing fixtures (their `expectedSeverity` is absent = info). Phase 3 only touches catalog WORDING for these, not stamps.

### Pitfall 3: Editing `buildSummaryLine` reddens ~40-50 fixtures simultaneously
**What goes wrong:** A commit that changes the summary grammar but updates only some catalog blocks leaves `catalog-uat` red — violating GATE-02 atomic supersession.
**Why:** The byte gate compares the entire first arg; the summary line is a prefix on every error/warning block.
**How to avoid:** Land the D-02 grammar + ALL summary-bearing catalog blocks + fixtures in ONE atomic commit (sequencing item 3). Accept that this commit is large.
**Warning signs:** A wave that splits "rewrite grammar" from "rewrite catalog blocks."

### Pitfall 4: The PU-5 orchestrated converge has race-safety semantics — don't blindly flip it to error
**What goes wrong:** Converting the orchestrated `{status:"converged"}` arm (consumed at apply.ts:512) to an error row makes load-time reconcile report uninstall errors for benign races (another process completed first), contradicting NFR-2/WR-06's "never report work it did not perform."
**Why:** D-01 says "error across the board" but names the user command; the orchestrated converge is a load-time concern.
**How to avoid:** Resolve Open Question #2 with the user before touching apply.ts. Default: convert only the standalone path; keep orchestrated converge silent.

### Pitfall 5: Cardinality is structural, not row-count (D-04)
**What goes wrong:** Inferring "plural" by counting rows at render time → forbidden by D-04 ("no separate render-time row-count heuristic"), and wrong for a bulk op that happened to affect one plugin.
**How to avoid:** Carry a structural signal (see Open Question #1). A single-target install that affects 1 plugin must omit the tally; a bulk `reinstall @mp` affecting 1 plugin must still be "plural."

### Pitfall 6: Don't touch the `REASONS` tuple order or membership
**What goes wrong:** Reordering/adding to `REASONS` (notify.ts:82) breaks catalog stability (OUT-08) and the `_ReasonsCoverage` proof.
**How to avoid:** D-01 is severity stamps on existing reasons only. No `REASONS` edit.

## Code Examples

### The single emission seam (the contract to preserve)
```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:2938
function emitWithSummary(ctx: ExtensionContext, message: NotificationMessage, body: string): void {
  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(body);                                       // info: no 2nd arg (OUT-01)
  } else {
    ctx.ui.notify(`${buildSummaryLine(message, severity)}\n\n${body}`, severity);  // OUT-02 prefix
  }
}
```

### Current (OLD) summary grammar to be replaced by D-02
```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:2268 (buildSummaryLineForCascade)
const verb = severity === "error" ? "failed" : "skipped";
const counts = severity === "error" ? countFailedRows(marketplaces) : countSkippedRows(marketplaces);
// OLD: "N plugin operation(s) [and M marketplace operation(s)] failed|skipped."
// D-02: "[A|Some] <plugin|marketplace|(mixed: drop noun)> operation[s] has/have failed | needs/need attention."
```

### Idempotent→info already wired (do not re-implement)
```typescript
// Source: extensions/pi-claude-marketplace/shared/notify-reasons.ts:51
export function skipSeverity(reasons: readonly Reason[] | undefined): "info" | "warning" {
  return reasons !== undefined && reasons.length > 0 &&
    reasons.every((r) => IDEMPOTENT_REASON_SET.has(r)) ? "info" : "warning";
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node --test` (TS stripped natively) |
| Config file | none — globs in package.json `test` script |
| Quick run command | `node --test "tests/architecture/catalog-uat.test.ts" "tests/architecture/notify-producer-wire-coverage.test.ts" "tests/architecture/notify-grammar-invariant.test.ts" "tests/architecture/notify-stamp-coverage.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + `npm test` + `npm run test:integration`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUT-02 | Leading sentence byte form | byte-equality | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ |
| OUT-03/04 | Tally byte form + label | byte-equality | catalog-uat (new tally blocks) | ✅ (extend fixtures) |
| OUT-05 | Always-header | byte-equality | catalog-uat | ✅ |
| OUT-06 | Mixed-subject grammar | byte-equality | catalog-uat (reconcile-applied / import states) | ✅ |
| OUT-08/GATE-02 | Catalog+fixtures lockstep, two-direction gate | structural | catalog-uat forward + inverse walks | ✅ |
| D-01 absent-target | producer→wire severity | severity gate | `node --test "tests/architecture/notify-producer-wire-coverage.test.ts"` | ✅ (add fixtures) |
| D-01 reconcile projection | stamped severity on projected rows | runtime arch | `node --test "tests/architecture/notify-stamp-coverage.test.ts"` | ✅ |
| grammar invariants | per-status row grammar unchanged except `present`→`installed` | invariant | `node --test "tests/architecture/notify-grammar-invariant.test.ts"` | ✅ (check it for `present` assumptions) |

### Sampling Rate
- **Per task commit:** the Quick run command above (4 notify arch tests) — sub-second.
- **Per wave merge:** `npm test` (full unit/arch suite).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Add wire-coverage fixtures for the 3 new D-01 absent-target rows (reinstall/update not-installed, uninstall PU-5) — in `notify-producer-wire-coverage.test.ts`.
- [ ] Check `tests/architecture/notify-grammar-invariant.test.ts` (20K) for any assertion that depends on a `present` status token or the OLD summary grammar; update in lockstep.
- [ ] Add new catalog state(s) + fixtures for the PU-5 already-gone error row (forward+inverse gate requires both).

*(No framework install needed — infrastructure already exists.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Content-derived severity ladder (`BENIGN_REASONS`/`cascadeSeverity` content arm) | Caller-stamped `severity`, dumb MAX reduce | Phase 2 (this milestone) | Phase 3 reads stamped facts only; never re-derives. |
| `present` plugin status (reload-suppression role) | Collapsed into `installed` + `needsReload:false` | Phase 2 runtime; Phase 3 catalog grammar | `present` token gone at runtime; catalog prose/table still references it → collapse here. |
| OLD summary `N plugin operation(s) failed.` | D-02 `[A\|Some] <subject> operation[s] has/have failed.` + D-04 tally | Phase 3 (this phase) | Dominant rendered-byte change. |

**Deprecated/outdated:**
- The stale comment block at `marketplace/update.ts:14-16` describing `up-to-date` as `warning` — pre-Phase-2; the code at :669 is `info`. Don't trust the comment.
- The CONTEXT/SEV-05 example "install already-installed → error (CHANGE from info)" — already error in code (Pitfall 1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | install already-installed is already `error` (no code change needed) | Pitfall 1 / Producer Inventory | LOW — verified at install.ts:1503/1572; if a different code path emits a benign already-installed row, it would be missed. |
| A2 | The legacy `notify()` cascade arm is dead post-Phase-1-migration; only standalone kinds use it | Composition Surface | MEDIUM — if some command still routes its cascade through legacy `notify()`, its tally won't get a label. Verify Phase 1 Plan 01-05 removed the legacy cascade path. |
| A3 | enable/disable not-installed stays `warning` (not in D-01 absent-target enumeration) | Producer Inventory | MEDIUM — user may intend "error across the board" to include enable/disable. Confirm with CONTEXT (Open Question #4). |
| A4 | `present` collapse is prose/table-only (no fenced block emits `(present)`) | Catalog blast radius | LOW — grep found no `(present)` in fenced blocks; verify with the grammar-invariant test. |
| A5 | Tally on info-severity plural ops is undecided (OUT-03 says "bulk operations carry a trailing tally" — may include info) | Open Question #3 | MEDIUM — affects how many catalog blocks gain a tally line. |

## Open Questions

1. **Structural cardinality signal for the tally (D-04).**
   - What we know: cardinality is structural (Phase 1 `Single`/`Plural` aliases), tally appears iff plural, NO row-count heuristic allowed.
   - What's unclear: the `Single`/`Plural` aliases are type-only and not carried into the runtime `CascadeNotificationMessage`. The runtime needs a signal of single-vs-plural.
   - Recommendation: carry a `cardinality: "single" | "plural"` field on the message or thread it via the CommandContext (the command knows whether it is single-target). Planner to decide the cleanest shape; confirm with the user that a per-command structural flag is acceptable.

2. **PU-5 orchestrated converge (load-time reconcile) — error or stay silent?**
   - What we know: D-01 says "error across the board"; WR-06/NFR-2 says reconcile must never report work it didn't perform; the orchestrated `converged` outcome is dropped at apply.ts:512.
   - Recommendation: convert the **standalone** uninstall path to error (clear D-01); keep the **orchestrated** converge silent for race-safety. Confirm with the user before touching apply.ts.

3. **Tally placement + info-severity tally.**
   - What we know: leading sentence is error/warning only; tally is "bulk operations" (OUT-03).
   - What's unclear: (a) does the tally appear on info-severity bulk ops (e.g., a successful multi-plugin import)? (b) Where does the tally sit relative to the `/reload` trailer — before or after?
   - Recommendation: define both in the catalog explicitly (the byte block is the contract). Likely: tally after the body, before the reload trailer; tally shown whenever plural regardless of severity (so a successful bulk import shows `Plugin import: 3 success(es)`). Confirm.

4. **enable/disable not-installed severity (A3).** Confirm whether D-01's absent-target → error extends to enable/disable, or the explicit uninstall/reinstall/update enumeration is exhaustive.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node `node --test` | running gates | ✓ | (project Node ≥20.19) | — |
| `npm run check` | GATE-03 | ✓ | — | — |

No external services or tools. All work is in-repo TypeScript + markdown.

## Security Domain

`security_enforcement` is not configured for this workstream; this phase touches only rendered user-facing strings (no auth, crypto, input parsing, network, or filesystem mutation). One pre-existing security-relevant invariant must be PRESERVED, not introduced: **absolute-path redaction** in cause-chain trailers (`redactAbsolutePaths` / basename-only, notify.ts:202 region, e.g. catalog state `invalid-config-row` BASENAME-only). Any new error row (PU-5, absent-target) that carries a `cause` MUST route its diagnostic through the existing redaction seam — do not introduce a raw absolute path into the new error rows.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | no new input parsing |
| V7 Error Handling / Logging (info disclosure) | yes | preserve `redactAbsolutePaths` basename-only in any new cause-bearing error row |
| V6 Cryptography | no | — |

## Sources

### Primary (HIGH confidence — in-repo reads + green test runs)
- `extensions/pi-claude-marketplace/shared/notify.ts` — `emitWithSummary` (2938), `computeSeverity`/`cascadeSeverity` (2144/2121), `buildSummaryLine`/`buildSummaryLineForCascade` (2321/2268), `countRowsBySeverity` (2245), `operationPhrase` (2294), `renderMpHeader` (1466), `emitContextCascade`/`emitReconcileAppliedContextCascade` (3091/3137), `notify` (3006), `REASONS` (82), message-kind model (977-1299), `RELOAD_HINT_TRAILER` (2088).
- `extensions/pi-claude-marketplace/shared/notify-context.ts` — CommandContext/Messaging.label (63), Single/Plural (77-78), notifyWithContext (137).
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — IDEMPOTENT_REASONS (30), skipSeverity (51), closed-set coverage proof (132).
- Producers: install.ts (1359/1452-1520/1552-1572), uninstall.ts (88-100/534-548/220-237/625-639), reinstall.ts (854-866/1092), update.ts (1525-1566), marketplace/update.ts (662-700), marketplace/add.ts (236/485), marketplace/remove.ts (271/329), enable-disable.ts (914-1014).
- `docs/output-catalog.md` — 117 catalog-states; summary grammar at line 123; install/uninstall/reinstall/update/import/reconcile-applied sections; `present` references (73,131-132,289,318).
- `tests/architecture/catalog-uat.test.ts` — parser + FIXTURES + driver (forward+inverse walks). **GREEN verified.**
- `tests/architecture/notify-producer-wire-coverage.test.ts` — producer→wire severity/trailer gate. **GREEN verified.**
- `package.json` — `test`/`check` scripts (Node `node --test`).

### Secondary
- `.planning/workstreams/notification-refactor/{REQUIREMENTS,ROADMAP,STATE}.md` and phases 01/02/03 CONTEXT — requirement IDs, sequencing rationale, prior-phase decisions.

## Metadata

**Confidence breakdown:**
- Producer inventory / D-01 map: HIGH — every site read at file:line; the "already done vs needs-change" split is grounded in code, and the two CONTEXT contradictions (install-already-installed, idempotent-already-info) are surfaced.
- Composition surface: HIGH — all symbols located and their Phase-3 disposition mapped.
- Catalog/fixture blast radius: HIGH for structure/mechanics; MEDIUM for exact block count (≈40-50 summary-bearing of 117 states; grep gives 69 grammar occurrences incl. prose).
- Sequencing: MEDIUM — the atomic-bundle hazard is certain; the optimal sub-split of the tally commits depends on Open Question #1/#3 resolutions.

**Research date:** 2026-06-24
**Valid until:** 2026-07-24 (stable in-repo target; only changes if the notify surface is edited before planning)
