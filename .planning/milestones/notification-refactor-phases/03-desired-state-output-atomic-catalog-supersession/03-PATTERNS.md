# Phase 3: Desired-state output & atomic catalog supersession - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 8 touched files (1 composition surface, ~4 producer emit sites, 1 closed-reason data file, 2 byte-fixture/coverage tests, 1 catalog prose) + the catalog doc
**Analogs found:** 8 / 8 (this is a MODIFY phase — every edit has an in-file or sibling-file analog already present)

> **Reading note for the planner/executor.** This phase changes rendered bytes
> for the first time. Almost nothing is built from scratch: each edit either
> *extends an existing idiom in the same file* (the summary-line rewrite, the
> tally) or *mirrors a sibling producer's existing stamp* (the severity flips).
> The analog excerpts below are the idioms to mirror — do NOT invent a new shape.

---

## File Classification

| Touched file | Role | Data flow | Closest analog | Match quality |
|--------------|------|-----------|----------------|---------------|
| `shared/notify.ts` — `buildSummaryLine`/`buildSummaryLineForCascade` (D-02 leading sentence) | composition surface (renderer) | transform (rows → string) | `buildSummaryLineForCascade` itself (notify.ts:2268) + `operationPhrase` (2294) | exact (extend in place) |
| `shared/notify.ts` — NEW tally composer (D-04/OUT-03/04) | composition surface (renderer) | transform (counts → string) | `countRowsBySeverity` (2245) + `operationPhrase` (2294) pluralizer idiom | role-match (new fn, mirror existing pluralizer + counter) |
| `shared/notify.ts` — thread `Messaging.label` through `emitContextCascade`/`emitReconcileAppliedContextCascade` → `emitWithSummary` | composition surface (plumbing) | request-response (param pass-through) | the existing `renderPluginRowBody` param already threaded through both seams (notify.ts:3091/3137) | exact (add a sibling param the same way) |
| `shared/notify.ts` — `countRowsBySeverity` widen to count `info`/success | composition surface (counter) | transform | `countRowsBySeverity` (2245) itself — add `"info"` target | exact (widen the `target` union) |
| `orchestrators/plugin/reinstall.ts` — not-installed → `error` (D-01) | producer emit site | event-driven (outcome → stamped row) | the same file's `skipped` arm (reinstall.ts:854-866) + uninstall.ts:220-237 error stamp | exact (same arm, flip the stamp) |
| `orchestrators/plugin/update.ts` — not-installed → `error` (D-01) | producer emit site | event-driven | update.ts `skipped` arm (1549-1567) + the sibling `unchanged`→info hard-stamp (1537-1548) | exact (same arm, flip the stamp) |
| `orchestrators/plugin/uninstall.ts` — PU-5 silent-converge → `error` row (standalone) | producer emit site | event-driven | `emitCascadeFailure` (uninstall.ts:220-237) — the failed-row + `notifyWithContext` template IN THE SAME FILE | exact (copy this shape into the `alreadyGone` standalone arm) |
| `shared/notify-reasons.ts` — closed reason groups | closed-reason data | — | (no edit — confirmation only; `not installed`/`not found`/`not added` already present) | n/a (no change) |
| `docs/output-catalog.md` — summary-grammar prose + status-token table + per-command fenced blocks | catalog prose + byte fixture | byte contract | `enable-not-installed` block (catalog L1602-1609) for absent-target states; "Summary line" section (L112-123) for the D-02 prose | exact (per-state fence) |
| `tests/architecture/catalog-uat.test.ts` — `FIXTURES` map + driver | byte fixture | byte-equality | `enable-not-installed` fixture (catalog-uat.test.ts:2569-2592) | exact (key/shape mirror) |
| `tests/architecture/notify-producer-wire-coverage.test.ts` — add absent-target wire fixtures | byte fixture (severity gate) | severity gate | the FAILURE `WireFixture` (test:202-216) | exact (add 3 sibling entries) |

---

## Pattern Assignments

### `shared/notify.ts` — D-02 leading-sentence rewrite (composition surface, transform)

**Analog:** the in-file `buildSummaryLineForCascade` (notify.ts:2268-2288) + `buildSummaryLine` cascade tail (2354-2371) + `operationPhrase` (2294-2296).

**Extend, don't replace.** The OLD grammar is composed by selecting a verb, counting plugin-vs-mp rows, and stitching with `operationPhrase`. The D-02 rewrite keeps this exact three-step skeleton (verb-select → count → stitch) and only changes the literals.

**Current OLD grammar to rewrite** (notify.ts:2268-2288):
```typescript
function buildSummaryLineForCascade(
  marketplaces: readonly MarketplaceNotificationMessage[],
  severity: "error" | "warning",
): string {
  const verb = severity === "error" ? "failed" : "skipped";
  const counts =
    severity === "error" ? countFailedRows(marketplaces) : countSkippedRows(marketplaces);

  const pluginPhrase = operationPhrase(counts.plugins, "plugin");
  const marketplacePhrase = operationPhrase(counts.marketplaces, "marketplace");

  if (counts.plugins > 0 && counts.marketplaces > 0) {
    return `${pluginPhrase} and ${marketplacePhrase} ${verb}.`;
  }
  if (counts.marketplaces > 0) {
    return `${marketplacePhrase} ${verb}.`;
  }
  return `${pluginPhrase} ${verb}.`;
}
```

**Pluralizer idiom to mirror** for the D-02 `[A|Some]` + `operation[s]` + `has/have` (notify.ts:2294):
```typescript
function operationPhrase(count: number, kind: "plugin" | "marketplace"): string {
  return `${count} ${kind} ${count === 1 ? "operation" : "operations"}`;
}
```
The D-02 form `[A|Some] <subject> operation[s] has/have failed | needs/need attention.` is the SAME `count === 1 ? singular : plural` ternary idiom — keep one small helper that maps count→`{article, operationWord, verbPhrase}`, exactly as `operationPhrase` maps count→operationWord today. Verb-phrase map: error → `has/have failed`, warning → `needs/need attention`.

**D-03 mixed-subject detection lives here.** `buildSummaryLineForCascade` ALREADY computes `counts.plugins` and `counts.marketplaces` separately — the render-time mixed-subject signal is `counts.plugins > 0 && counts.marketplaces > 0` (the FIRST `if` branch above is the exact detection point). For D-03, that branch drops the subject noun (`[A|Some] operation[s] …`) instead of stitching both phrases. This is render-time by construction — it reads the live counts, not a structural discriminant (satisfies D-03's "detected at RENDER TIME from the actual rows' subjects").

**Two call paths share the grammar** (preserve the parity): `buildSummaryLine` (notify.ts:2321) delegates its `reconcile-applied-cascade` arm to `buildSummaryLineForCascade` (2336-2341), and its own cascade tail (2354-2371) duplicates the same stitch. Both must move to the D-02 grammar in lockstep (they are byte-compared together).

---

### `shared/notify.ts` — NEW trailing tally (composition surface, transform)

**Analog:** `countRowsBySeverity` (notify.ts:2245-2261) for the counts; `operationPhrase` (2294) for the pluralizer idiom.

**The counter to reuse / widen** (notify.ts:2245):
```typescript
function countRowsBySeverity(
  marketplaces: readonly MarketplaceNotificationMessage[],
  target: "warning" | "error",
): SummaryCounts {
  let plugins = 0;
  let mpCount = 0;
  for (const mp of marketplaces) {
    if ((mp.severity ?? "info") === target) {
      mpCount++;
    }
    plugins += mp.plugins.filter((p) => (p.severity ?? "info") === target).length;
  }
  return { plugins, marketplaces: mpCount };
}
```
OUT-03's `<n> success(es)` needs an `info` count that does not exist today (the `target` union is `"warning" | "error"` only). **Widen the `target` union to include `"info"`** — the `(x.severity ?? "info") === target` predicate already works for `"info"` with zero further change. This is the Don't-Hand-Roll directive from RESEARCH (extend the existing counter, do not build a new one).

**Tally format** (OUT-03): `<Operation>: <n> failure(s), <n> warning(s), <n> success(es)` — pluralized by count, zero-count categories omitted, no terminal period. `<Operation>` is the threaded `Messaging.label`. Mirror `operationPhrase`'s `count === 1 ? singular : plural` ternary for each of failure/warning/success.

**Placement** (per RESEARCH Open Question #3): tally goes after the cascade body, before the `RELOAD_HINT_TRAILER`. The existing fold in `notify()` (notify.ts:3058-3059) shows the body→hint composition idiom to extend:
```typescript
const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";
const withHint = hint === "" ? body : `${body}\n\n${hint}`;
```
The tally inserts between `body` and `hint` (`{body}\n\n{tally}\n\n{hint}`) — the catalog fenced block is the byte contract for the exact order; pin it there.

---

### `shared/notify.ts` — thread `Messaging.label` (composition surface, plumbing)

**Analog:** the `renderPluginRowBody` parameter ALREADY threaded through both cascade seams (notify.ts:3091-3117 and 3137-3160). Add the `label` the same way.

`emitContextCascade` (notify.ts:3091) takes `(ctx, pi, message, renderPluginRowBody)` and passes through to `emitWithSummary`. `notifyWithContext` (notify-context.ts:137-157) HAS the `context` (and thus `context.Messaging.label`) but currently passes only the render closure (notify-context.ts:154-156):
```typescript
emitContextCascade(ctx, pi, message, (p, probe, mpScope) =>
  dispatchRow(context, p, probe, mpScope),
);
```
**The change:** add `context.Messaging.label` as a new argument alongside the render closure, thread it through `emitContextCascade`/`emitReconcileAppliedContextCascade` into `emitWithSummary`, where the tally consumes it. The `CommandContext` shape that holds it (notify-context.ts:62-65):
```typescript
export interface CommandContext<Status extends string, Msg> {
  readonly Messaging: { readonly label: string };
  readonly render: { [K in Status]: RenderFn<Extract<Msg, { status: K }>> };
}
```
**Caution (RESEARCH Pitfall 3 / sequencing item 3):** threading the label must NOT shift any byte until the tally consumes it. If label-threading lands before the tally, keep it inert (unused) so the summary-grammar commit's catalog blocks don't move.

**The single emission seam to preserve** (notify.ts:2938) — IL-2, exactly one `ctx.ui.notify`:
```typescript
function emitWithSummary(ctx: ExtensionContext, message: NotificationMessage, body: string): void {
  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(body);                                       // info: no 2nd arg (OUT-01)
  } else {
    ctx.ui.notify(`${buildSummaryLine(message, severity)}\n\n${body}`, severity);
  }
}
```
Do NOT add a second `ctx.ui.notify`. The tally folds into `body` (or composes here off `message`+`label`); the leading sentence stays the `buildSummaryLine` prefix.

---

### `orchestrators/plugin/reinstall.ts` (producer emit site, event-driven) — not-installed → `error`

**Analog:** the SAME file's `skipped` arm (reinstall.ts:854-866) is where the flip lands; the error-stamp shape to copy is uninstall.ts:220-229.

**Current arm** (reinstall.ts:854-866) — stamps `skipSeverity(reasons)` which returns `warning` for `not installed`:
```typescript
case "skipped": {
  const reasons = narrowReasons(outcome.notes);
  const skipped: PluginSkippedMessage = {
    status: "skipped",
    name: outcome.name,
    reasons,
    ...(rowScope !== undefined && { scope: rowScope }),
    // D-03/D-06: benign idempotent skip -> info, actionable skip -> warning;
    // never reloads.
    severity: skipSeverity(reasons),
    needsReload: false,
  };
  return skipped;
}
```
**D-01 change (option A — severity-only flip, keep `skipped` token):** for the `not installed`/`not found` arm, stamp `severity: "error"` directly instead of `skipSeverity(reasons)`. Keep `status: "skipped"` so the catalog `(skipped) {not installed}` per-row grammar is preserved (D-06 preserves per-row grammar). Only the stamped severity arg + the summary line change. Do NOT route `not installed` into `skipSeverity` (it only knows info-vs-warning — see notify-reasons.ts:51) and do NOT add it to any "error reasons" set (keep severity a producer-stamped fact, SEV-04/05).

**Reference for the clean `error` stamp shape** (uninstall.ts:226-227): `severity: "error", needsReload: false`.

---

### `orchestrators/plugin/update.ts` (producer emit site, event-driven) — not-installed → `error`

**Analog:** the SAME-arm idiom — update.ts already hard-stamps `info` for its `unchanged` idempotent arm and `skipSeverity` for its `skipped` arm. The absent-target flip mirrors the `unchanged`→hard-stamp idiom but with `"error"`.

**The `unchanged`→info hard-stamp idiom to mirror** (update.ts:1537-1548):
```typescript
case "unchanged":
  return {
    status: "skipped",
    name: outcome.name,
    scope: target.scope,
    reasons: ["up-to-date"],
    // D-03/D-06: an `up-to-date` no-op is benign -> info, no reload.
    severity: "info",
    needsReload: false,
  };
```
**The `skipped` arm to flip** (update.ts:1549-1567) — currently `severity: skipSeverity(reasons)`. For the `not installed`/`not found` reasons, stamp `severity: "error"` directly (option A), preserving `status: "skipped"` and the `(skipped) {not installed}` per-row grammar — exactly the pattern shown for reinstall above.

---

### `orchestrators/plugin/uninstall.ts` (producer emit site, event-driven) — PU-5 silent-converge → `error` row

**Analog:** `emitCascadeFailure` IN THE SAME FILE (uninstall.ts:210-238) — the canonical "build a `PluginFailedMessage`, wrap it in a one-marketplace `notifyWithContext` call" template.

**The template to copy** (uninstall.ts:220-237):
```typescript
const failedRow: PluginFailedMessage = {
  status: "failed",
  name: plugin,
  reasons: [narrowCascadeFailure(cause)],
  ...(removedVersion !== undefined && { version: removedVersion }),
  cause,
  // D-03/D-06: a failed uninstall -> error, no reload (nothing changed).
  severity: "error",
  needsReload: false,
};
notifyWithContext(ctx, pi, UNINSTALL_CONTEXT, [
  {
    name: marketplace,
    scope,
    plugins: [failedRow],
  },
]);
return undefined;
```

**The site to change** (uninstall.ts:534-548) — the standalone `alreadyGone` arm currently returns `undefined` (literal silence):
```typescript
if (alreadyGone) {
  if (orchestrated) {
    return { status: "converged", name: plugin };   // KEEP silent — see caution below
  }
  return undefined;                                   // CHANGE: emit an error row instead
}
```
**D-01 change:** replace the standalone `return undefined` with the `emitCascadeFailure`-shaped block above, carrying `reasons: ["not installed"]`, `severity: "error"`, `needsReload: false`. Per RESEARCH option A you may keep the row `status: "skipped"` with `(skipped) {not installed}` grammar (severity-only) OR use a `failed` row — confirm against the new catalog block's chosen per-row glyph; option A (skipped token, error severity) keeps the smallest catalog blast radius.

**CAUTION — do NOT touch the orchestrated `converged` arm without resolving RESEARCH Open Question #2.** The orchestrated converge (consumed/dropped at apply.ts:512) exists for reconcile race-safety (WR-06 / NFR-2 — "never report an uninstall it did not perform"). Default: convert ONLY the standalone path; keep orchestrated converge silent.

**Security (preserve, do not introduce):** if the new error row carries a `cause`, route it through the existing `redactAbsolutePaths` basename-only seam (notify.ts:~202 region) — do not introduce a raw absolute path into the new error row (V7 info-disclosure).

---

### `shared/notify-reasons.ts` (closed-reason data) — CONFIRM ONLY, no edit

**No change.** Every D-01 case maps to an EXISTING reason: idempotent→info uses `IDEMPOTENT_REASONS` (notify-reasons.ts:30, already wired via `skipSeverity`); absent-target→error uses `not installed` / `not found` / `not added` (existing command-private reasons). The `reasons` set stays CLOSED (OUT-08); the `_ReasonsCoverage` compile-time proof (notify-reasons.ts:132) must stay green. Do NOT touch the `REASONS` tuple (notify.ts:82) — its order is byte-order-critical for catalog stability.

**The `skipSeverity` contract (do not extend it)** (notify-reasons.ts:51):
```typescript
export function skipSeverity(reasons: readonly Reason[] | undefined): "info" | "warning" {
  return reasons !== undefined && reasons.length > 0 &&
    reasons.every((r) => IDEMPOTENT_REASON_SET.has(r)) ? "info" : "warning";
}
```
It only knows info-vs-warning. The absent-target→error change is a PRODUCER-stamped `"error"`, never routed through here.

---

### `docs/output-catalog.md` (catalog prose + byte fixtures) — atomic supersession

**Analog for new/changed absent-target fenced blocks:** the `enable-not-installed` block (catalog L1602-1609):
```text
1 plugin operation skipped.

● claude-plugins-official [user]
  ⊘ foo-plugin (skipped) {not installed}
```
Each catalog state is `<!-- catalog-state: STATE -->` + a blank line + a ```` ```text ```` fence. The absent-target states (reinstall/update not-installed, the new uninstall PU-5 state) follow this exact shape — only the leading summary line changes to the D-02 grammar and `expectedSeverity` becomes `error`.

**Prose to rewrite for D-02** — the "Summary line (error / warning)" section (catalog L112-123). The OLD wording examples at L123 (`"1 plugin operation failed."`, `"1 plugin operation skipped."`) must move to the D-02 grammar. The byte-compared FENCED blocks are the binding contract; the prose is Claude's discretion (per CONTEXT D-06) but should not contradict the fences.

**`present`→`installed` grammar collapse (D-06):** PROSE/TABLE-only, no fenced-block byte change (no fence emits `(present)`). Edit the status-token reference table rows (catalog L131-132) — the `(installed) (via present discriminator)` table row collapses/merges — and the `present` prose at L73, L289-region, L318. The reload-hint trailer prose (L64-73) also still describes the OLD content-derived `disable-cascade` straddle — within scope only insofar as `present` is mentioned.

**Two-direction gate (the atomic enforcer):** every NEW catalog state needs a fixture in the SAME commit; every removed/renamed state needs its fixture removed in the same commit (catalog-uat forward + inverse walks). No orphans, ever.

---

### `tests/architecture/catalog-uat.test.ts` (byte fixture) — co-change pairing

**Analog:** the `enable-not-installed` fixture (catalog-uat.test.ts:2569-2592) — the exact keyed shape for an absent-target `(skipped) {not installed}` state:
```typescript
"enable-not-installed": {
  pi: piWithBothLoaded(),
  expectedSeverity: "warning",
  message: {
    marketplaces: [
      {
        name: "claude-plugins-official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            severity: "warning",
            needsReload: false,
            name: "foo-plugin",
            reasons: ["not installed"],
          },
        ],
      },
    ],
  },
},
```
**Fixture shape** (catalog-uat.test.ts:199-205): `{ message, pi, expectedSeverity? }`, keyed `FIXTURES[section][state]`. The new/changed absent-target fixtures are this shape with `expectedSeverity: "error"` and `severity: "error"` on the row. The NEW uninstall PU-5 state gets a brand-new `(section, state)` entry under the `/claude:plugin uninstall` section key.

**The byte-compare + severity-assert driver** (catalog-uat.test.ts:3079-3120) — fresh `ctx` per fixture, `notify()` called once, `mock.calls[0].arguments[0]` byte-compared to the catalog fence, `arguments[1]` asserted equal to `expectedSeverity` (or absent for info). This is why the summary-grammar rewrite reddens every summary-bearing fixture at once (the WHOLE first arg is compared) — bundle the D-02 grammar + all summary-bearing catalog blocks + fixtures in ONE atomic commit (RESEARCH sequencing item 3).

---

### `tests/architecture/notify-producer-wire-coverage.test.ts` (severity gate) — add absent-target fixtures

**Analog:** the FAILURE `WireFixture` (test:202-216):
```typescript
{
  label: "failure row (failed install)",
  context: INSTALL_CONTEXT,
  row: {
    status: "failed",
    name: "broken-plugin",
    reasons: [],
    scope: "user",
    cause: new Error("network unreachable"),
    severity: "error",
    needsReload: false,
  },
  expectedSeverity: "error",
  expectTrailer: false,
},
```
**`WireFixture` shape** (test:86-97): `{ label, context, row, expectedSeverity, expectTrailer }`. Add three sibling entries for the new D-01 absent-target rows — `reinstall not-installed → error/no-trailer` (context `REINSTALL_CONTEXT`), `update not-installed → error/no-trailer` (`UPDATE_CONTEXT`), `uninstall PU-5 already-gone → error/no-trailer` (`UNINSTALL_CONTEXT`) — each carrying the EXACT producer-stamped `severity: "error"`, `needsReload: false`, mirroring the producer flips in the same commit. The driver (test:219-253) routes the row through the real `notifyWithContext` wire and asserts `args[1]` severity + trailer presence. Update the top-of-file producer line-number doc-comment (test:34-37) if the flipped arms shift lines.

---

## Shared Patterns

### Producer severity stamp (apply to all D-01 emit sites)
**Source idiom:** every producer arm stamps a literal `severity` + `needsReload` with a `// D-03/D-06:` anchor comment, e.g. update.ts:1546-1547 (`severity: "info"`), uninstall.ts:226-227 (`severity: "error"`), enable-disable.ts:927 (`severity: "warning"`).
**Apply to:** reinstall.ts:863, update.ts:1564, uninstall.ts:534-548 — flip the absent-target arms to `severity: "error"` directly (option A), keep the comment-anchor convention (use requirement/decision IDs like `D-01`, never `Phase N` — `.claude/rules/typescript-comments.md`).

### The single emission seam (preserve — never duplicate)
**Source:** `emitWithSummary` (notify.ts:2938).
**Apply to:** all composition changes (leading sentence, tally, label) — exactly ONE `ctx.ui.notify` per `notify()` invocation (IL-2). Compose one string; do not add a second emission.

### Pluralization idiom (apply to D-02 sentence AND D-04 tally)
**Source:** `operationPhrase` (notify.ts:2294) — the `count === 1 ? singular : plural` ternary.
**Apply to:** the D-02 `[A|Some]`/`operation[s]`/`has/have` selection and the tally's `failure(s)`/`warning(s)`/`success(es)`. Keep small local helpers in the same idiom; do not pull in a pluralization library.

### Atomic catalog-fixture pairing (apply to every byte change)
**Source:** the forward+inverse walk in catalog-uat.test.ts (3056-3120 / 3152+).
**Apply to:** every catalog edit — a new/changed/removed catalog state MUST have its fixture added/changed/removed in the SAME commit. `catalog-uat` green at every commit boundary (GATE-02). The summary-grammar rewrite is unavoidably one large atomic commit (RESEARCH sequencing item 3 / Pitfall 3).

### Path-redaction security seam (preserve on any new cause-bearing row)
**Source:** `redactAbsolutePaths` / basename-only (notify.ts:~202 region).
**Apply to:** the new PU-5 / absent-target error rows IF they carry a `cause` — route diagnostics through the existing redaction seam; never introduce a raw absolute path (V7 info-disclosure).

---

## No Analog Found

None. Every edit in this phase extends an existing in-file idiom or mirrors a sibling producer/fixture already present in the codebase.

| File | Role | Data flow | Reason |
|------|------|-----------|--------|
| — | — | — | All touched files have an exact or role-match analog. |

---

## Already-Satisfied (no code change — confirm-only, per RESEARCH)

These were flagged in RESEARCH as already correct; the executor must NOT "re-implement" them (re-stamping risks a SEV-04 content-inference regression):

| Case | Status | Evidence |
|------|--------|----------|
| `install` already-installed → `error` | already error in code | install.ts → `(failed) {already installed}`, severity `"error"` (RESEARCH Pitfall 1) |
| idempotent `up-to-date`/`already enabled`/`already disabled`/`already autoupdate`/`already no autoupdate` → `info` | already wired | `skipSeverity` + `IDEMPOTENT_REASONS` (notify-reasons.ts:30/51); producers stamp `info` (reinstall.ts:863 via `skipSeverity`, enable-disable.ts:938, update.ts:1546) |
| `marketplace add` duplicate-name / `marketplace remove` not-added → `error` | already error | add.ts:485, remove.ts:271/278 (`status: "failed", reason: "not added"`) |
| enable/disable not-installed → `warning` | NOT in D-01 absent-target enumeration | enable-disable.ts:927 stamps `warning`; RESEARCH Open Question #4 — default keep `warning` unless CONTEXT extends the enumeration |
| always-header (D-05) | largely satisfied | `renderMpHeader` runs once per block in every cascade seam (notify.ts:3104/3150); audit-only |

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/shared/{notify.ts,notify-context.ts,notify-reasons.ts}`, `extensions/pi-claude-marketplace/orchestrators/plugin/{reinstall,update,uninstall,enable-disable}.ts` + `*.messaging.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`, `tests/architecture/{catalog-uat,notify-producer-wire-coverage}.test.ts`, `docs/output-catalog.md`.
**Files scanned:** 11 (read at file:line) — every excerpt above is grounded in a direct read.
**Pattern extraction date:** 2026-06-24
