---
phase: 99-post-audit-tech-debt-closure
reviewed: 2026-08-10T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/manifest-lookup.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/manifest-lookup-drift.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 99: Code Review Report

**Reviewed:** 2026-08-10
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Seven tech-debt items across two orchestrator verbs, one new domain module, three docs and five test files. The mechanical items land cleanly: the `stagedAgentNames` / `stagedMcpServerNames` rename (99-01) is complete at every producer and consumer; `lookupDeclaredPlugin` (99-05) is genuinely behavior-preserving and its drift gate walks the whole tree rather than an allowlist; the lock-nesting hazard flagged in the phase brief is a non-issue, because `withStateGuard` and `withLockedStateTransaction` both route through the same `withScopeLock`, and `cascadeAutoupdates` explicitly runs OUTSIDE the marketplace guard (`orchestrators/marketplace/update.ts:970`).

The substantive defect is in 99-04. `WR-12` threaded `degradedKinds` onto the `(updated)` row through a single composer, but the `(partially-installed)` arm of BOTH cascade mappers short-circuits ahead of that composer and drops the signal — so a `--partial` or autoupdate update that drops one kind AND degrades another renders the dropped kind and silently swallows the degrade, plus its `info -> warning` raise. The catalog paragraph shipped in the same change asserts the opposite in so many words. That is the same defect WR-12 exists to close, one branch over.

Secondary concerns: the `LedgerDegradationSignals` inheritance (99-04) hands `PluginUpdateUpdatedOutcome` four fields nobody populates, one of which makes an existing helper compile and silently return the wrong answer; 99-06 puts a `retries: 0` lock acquisition on a path that was previously lock-free; 99-03's anchor removal rests on a premise the repo contradicts; and 99-04 introduced a `marketplace/ -> plugin/` module edge that `orchestrators/types.ts`'s own header says it exists to prevent.

## Critical Issues

### CR-01: `degradedKinds` is discarded on the `(partially-installed)` arm, contradicting the catalog shipped with it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2274-2287`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:753-764`
**Bears on:** WARN-01 / WR-12 / D-99-03, FSTAT-07 / D-66-04

**Issue:** `runThreePhaseUpdate` builds a success outcome that can carry BOTH signals at once (`orchestrators/plugin/update.ts:2083` spreads `degradedKinds`, `:2096` spreads `partialDegrade`). Both cascade mappers test `partialDegrade` FIRST and return a `partially-installed` row composed inline, never reaching `updatedRowFromOutcome`. That inline row sets `reasons: narrowUnsupportedKinds(outcome.partialDegrade.kinds)` and stops there.

Concrete failure: `/claude:plugin update hello@mp --partial` where the candidate re-resolves `partially-available` (say it declares `lspServers`) and `plugins/hello/skills/tool/SKILL.md` carries frontmatter YAML cannot parse. The skills bridge writes the skill in synthesized form and reports `handles.skills.result.degraded.length > 0`, so `collectDegradedKinds` returns `["skill"]` and the outcome carries `degradedKinds: ["skill"]`. The rendered row is:

```text
● hello v1.0.0 (partially-installed) {lspServers}
```

at `info` severity. The `{malformed skill}` token is gone and the WARN-01 `info -> warning` raise never fires, so no summary line is emitted either. `list` renders the record's degraded state one command later over a row that just claimed a clean partial install — the exact contradiction WR-12 names as its motivation. The same path is reachable with no user flag at all through the autoupdate cascade, which sets `partial: true` unconditionally (`orchestrators/plugin/update.ts:584`).

The catalog section added in this phase states the opposite as contract:

> This is the MALFORMED-component axis, not the dropped-kind axis. ... The two axes are independent: an update can drop one kind and degrade another, and each names itself on the row its own axis owns.
> — `docs/output-catalog.md`, "Update with a degraded component (WARN-01 / D-86-03 / WR-12)"

`PluginPartiallyInstalledMessage` already carries a REQUIRED `reasons` array, so nothing structural blocks the fix.

**Fix:**

```ts
// orchestrators/plugin/update.ts, inside the partialDegrade branch
const malformed = malformedReasonsForKinds(outcome.degradedKinds);
if (outcome.partialDegrade !== undefined && outcome.partialDegrade.kinds.length > 0) {
  return {
    status: "partially-installed",
    name: outcome.name,
    scope: target.scope,
    version: outcome.toVersion,
    dependencies: outcomeDependencies(outcome.declaresAgents, outcome.declaresMcp),
    // WARN-01: the dropped-kind axis and the malformed axis are independent;
    // the row names both, in the kinds-then-malformed order composeReasons joins.
    reasons: [...narrowUnsupportedKinds(outcome.partialDegrade.kinds), ...malformed],
    severity: malformed.length > 0 ? "warning" : successSeverity,
    needsReload: true,
  };
}
```

Mirror it in `orchestrators/marketplace/update.ts:753` (whose base severity is `outcome.partialDegrade.newlyDegraded ? "warning" : "info"` — the malformed raise composes on top of that, not instead of it). Both forms need a catalog state plus a byte fixture, in both directions, per the closed-set discipline. Better still: extract the whole `updated`-partition projection (partial arm included) into `updatedRowFromOutcome` so a third axis cannot be added ahead of the composer again.

## Warnings

### WR-01: `LedgerDegradationSignals` inheritance adds four never-populated fields, one of which silently mis-types

**File:** `extensions/pi-claude-marketplace/orchestrators/types.ts:163`
**Bears on:** WR-12 / D-99-03, SEV-01 / D-98-02, SURF-05 / D-63-08

**Issue:** `PluginUpdateUpdatedOutcome extends PluginUpdateBase, LedgerDegradationSignals` inherits FOUR optional members, only one of which is populated or read. The producer at `orchestrators/plugin/update.ts:2072-2100` sets `degradedKinds` and nothing else; `updatedRowFromOutcome` (`:2388`) reads `degradedKinds` and nothing else.

Two concrete consequences:

1. **A compile-clean wrong answer.** `enableRowDependencies(signals: Pick<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">)` (`orchestrators/plugin/shared.ts:100`) now accepts a `PluginUpdateUpdatedOutcome` structurally, because both picked members are optional and inherited. It would return `[]` for every update outcome, since the update path spells the same facts `declaresAgents` / `stagedAgentNames`. The D-99-02c rename explicitly set out to make a name list and a presence flag unconfusable at a consumer site; the inheritance reintroduces a third spelling of the same subject on the same type.
2. **`orphanRewake` still silently misses on update.** `install.ts:1895` and `enable-disable.ts:299` both stamp it, and `enable-disable.ts:1016` / `reconcile/notify.ts:505` both render the `{orphan rewake}` token. `preflight.installable.orphanRewake` is available on the update path (`domain/resolver.ts:181`, carried on both `MaterializablePlugin` arms), but update sets it nowhere and `updatedRowFromOutcome` reads it nowhere. So an update that materializes a hook declaring `rewakeMessage` without `asyncRewake: true` renders a bare `(updated)` row. The doc comment justifying the inheritance claims the opposite:

> inheriting means a signal added to that shape reaches this outcome instead of silently missing from the one verb that redeclared it

That is true of the TYPE and false of the render path, and `orphanRewake` is the standing counter-example.

**Fix:** either populate and render the inherited signals on the update path (`...(installable.orphanRewake === true && { orphanRewake: true })` at the outcome, `...(outcome.orphanRewake === true ? (["orphan rewake"] as const) : [])` in `updatedRowFromOutcome`, matching `enable-disable.ts:1014-1017`), or narrow the inheritance to what the verb actually implements — `extends PluginUpdateBase, Pick<LedgerDegradationSignals, "degradedKinds" | "orphanRewake">` — and say why the other two are excluded, as `install.ts:239` already does for its own exclusion. Leaving all four inherited and two unimplemented is the shape that produces silent misses.

### WR-02: the disabled-record refresh now takes a `retries: 0` lock on a previously lock-free no-op

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1166`, `:1459-1465`, `:1540`
**Bears on:** D-99-05a, NFR-3

**Issue:** `preflightUpdate`'s short-circuit is now `if (toVersion === fromVersion && !isRecordedButDisabled(record))`. A disabled record at an unchanged version therefore falls through to `runDisabledRecordRefresh`, which unconditionally calls `refreshDisabledRecord` — and that now opens `withLockedStateTransaction`, which routes through `withScopeLock` and calls `lockfile.lock(..., { retries: 0 })` (`transaction/with-state-guard.ts:155-163`). The deep-equal projection guard prevents the WRITE, but only after the lock has already been acquired.

Failure scenario: a second Pi process holds the scope lock (mid-install, say). `/claude:plugin update` (bare form) over a scope containing one disabled plugin at a current version now throws `StateLockHeldError` out of `runThreePhaseUpdate`. `updatePlugins`'s catch fires `notifyDirectFailure` and `return`s — aborting the WHOLE batch (`orchestrators/plugin/update.ts:409-417`), including every target after the disabled one. Before this change that plugin returned `unchanged` from preflight without ever touching the lock, and the batch continued.

The cascade path is safe (`updateSinglePlugin` catches into a `failed` outcome), but it converts what was a `(skipped) {up-to-date}` row into `(failed)` under contention.

**Fix:** short-circuit before acquiring the lock when nothing can have moved. Compute the projection from `preflight` and the record already loaded in `preflightUpdate`, and only enter the transaction when it differs:

```ts
// runDisabledRecordRefresh
const next = disabledPinProjection(
  toVersion,
  preflight.installable.pluginRoot,
  preflight.resolvedSha ?? preflight.record.resolvedSha,
  nextCompatibilityFrom(preflight.installable),
);
const current = disabledPinProjection(
  preflight.record.version,
  preflight.record.resolvedSource,
  preflight.record.resolvedSha,
  preflight.record.compatibility,
);
const wrote = next === current ? false : await refreshDisabledRecord(args, preflight);
```

The in-transaction guard stays as the TOCTOU-safe authority; this one just avoids paying for the lock on the provably-idempotent path.

### WR-03: `marketplace/update.ts` now imports `plugin/update.ts`, the edge `orchestrators/types.ts` exists to prevent

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:124`
**Bears on:** D-11, D-05, D-06

**Issue:** `orchestrators/types.ts`'s own file header states its reason for existing:

> Sits at the ROOT of `orchestrators/` so marketplace/update.ts and plugin/update.ts both import from here without an orchestrators/marketplace ↔ orchestrators/plugin cycle.

`import { updatedRowFromOutcome } from "../plugin/update.ts";` is exactly that edge. It is acyclic today only by accident of the reverse direction landing on `marketplace/shared.ts` rather than `marketplace/update.ts` — a future `plugin/update.ts` needing anything from `marketplace/update.ts` closes the loop, and ESM circular initialization would surface as an `undefined` binding at module-eval time rather than a lint error.

It also drags the entire update ledger — `bridges/*`, `clone-cache.ts`, `clone-gc.ts`, `auth-host.ts` and transitively the git surface — into `marketplace/update.ts`'s module graph, for one 15-line pure function. The adjacent comment ("the plugin-update LEDGER stays behind the injected `pluginUpdate` seam -- this module still never calls it directly") is true about the CALL and misleading about the DEPENDENCY: the D-05 seam was there so `marketplace/update.ts` need not know the ledger module exists.

**Fix:** move `updatedRowFromOutcome` beside the outcome type it projects — either into `orchestrators/types.ts` (where `PluginUpdateUpdatedOutcome` already lives, and which both sides already import) or into a new leaf `orchestrators/plugin/update-row.ts` that imports only `../types.ts`, `../../shared/notify.ts` and `../../shared/notify-reasons.ts`. Both surfaces then import the composer without importing the ledger.

### WR-04: the `RLD-04` anchor was removed on a premise the repository contradicts

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:29`, `:104`, `:1102`, `:1203`; `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:37`; `extensions/pi-claude-marketplace/shared/notify.ts:459`, `:3766`
**Bears on:** RLD-04, `.claude/rules/typescript-comments.md`

**Issue:** 99-03 dropped the `RLD-04 / D-08` pair at seven sites. The recorded rationale (`.planning/ROADMAP.md:42`) is:

> the recorded rationale cites `RLD-04` / `D-08`, neither of which is defined in any surviving artifact — they appear only in source comments

`RLD-04` is defined in a surviving artifact — `.planning/milestones/notification-refactor-REQUIREMENTS.md:30` ("The `present` plugin status collapses into `installed` — its only role was reload suppression on the list surface, now handled by `needsReload: false`") — and it is cited in a LIVE test title:

```
tests/shared/notify-v2.test.ts:1299
test("RLD-04: list-shaped message with an installed inventory row (needsReload:false) emits NO /reload trailer ...
```

So the seven source sites the test guards no longer name the requirement the test names. `.claude/rules/typescript-comments.md` lists `RLD-NN`-class requirement IDs under "Allowed (and encouraged) as traceability anchors" — the policy that motivated the sweep does not ask for this removal.

Dropping `D-08` is defensible on its own: that token means four unrelated things elsewhere in the tree (`domain/source.ts:6` forward-compat tail, `shared/errors.ts:293` state-lock contention, `shared/vars.ts:4` substitution scope, `orchestrators/plugin/install.ts:7` install ordering), so pairing it with RLD-04 was genuinely ambiguous.

**Fix:** restore the bare `RLD-04` anchor at the seven sites (drop only the `/ D-08` half), so source and test cite the same requirement. If the intent really is to retire RLD-04, the test title must be retired with it in the same change.

### WR-05: `DESTRUCTURED_ENABLED_BINDING` has no record-axis anchor, contradicting its own contract comment

**File:** `tests/orchestrators/reconcile/plan.test.ts:751` (pattern), `:766-778` (contract comment), `:816-821` (controls)
**Bears on:** ENBL-05 / D-99-02b

**Issue:** The array's doc comment states the widening's safety property:

> which is why each widened pattern keeps its leading `.`, `[` or `Boolean(` anchor rather than matching a bare `enabled`

`BRACKET_ENABLED_ACCESS` and `BOOLEAN_ENABLED_COERCION` do keep such an anchor. `DESTRUCTURED_ENABLED_BINDING` — `/\{[^{}]*\benabled\b[^{}]*\}\s*=(?![=>])/` — does not. It matches ANY destructuring that binds an `enabled` key off ANY object, including the config-declaration axis the same comment promises to leave alone. A future `const { enabled } = entry;` in `persistence/config-io.ts` (the file the comment names as the different-object axis) fails the whole-tree walk with a message telling the author to call `isRecordedButDisabled` on a config entry — the wrong advice for that axis. A destructured function parameter (`function f({ scope, enabled }: Args = defaults)`) matches too.

The `NON_REDERIVATIONS` controls exercise only `entry.enabled !== false` and `isRecordedButDisabled(record)`, so neither the over-reach nor the claimed anchoring is proven for the destructured spelling — the gate self-tests exactly the property it does not have.

Secondary, same file: `RAW_LOOKUP_BLOCK_BODY` in the sibling gate (`tests/architecture/manifest-lookup-drift.test.ts:171`) bridges up to 160 arbitrary characters between `.plugins.find(` and `return <ident>.name ===`, so it can match ACROSS the end of the find call into unrelated following code.

**Fix:** anchor the destructured pattern to the record axis and add the matching control:

```ts
// require the destructured source to be a record-shaped identifier
const DESTRUCTURED_ENABLED_BINDING =
  /\{[^{}]*\benabled\b[^{}]*\}\s*=\s*(?:\w*[Rr]ecord\w*|\w*[Pp]lugin\w*)\b/;

const NON_REDERIVATIONS = [
  { label: "config-declaration axis", line: "if (entry.enabled !== false) {" },
  { label: "config-declaration destructure", line: "const { enabled } = entry;" },
  { label: "legitimate predicate call", line: "if (isRecordedButDisabled(record)) {" },
];
```

If the broad form is intentional (fail-closed by design), say so in the comment instead of claiming an anchor the pattern lacks, and add `const { enabled } = entry;` to `ESCAPING_TWIN_SPELLINGS` rather than to the controls.

## Info

### IN-01: the `Set` in `collectDegradedKinds` cannot deduplicate anything

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2111-2118`
**Issue:** The input is two disjoint singleton literals (`["skill"]` and `["command"]`, each present or absent), so `new Set(...)` is structurally incapable of removing a duplicate. This reads as if it mirrors `install.ts:1875`, where the `Set` IS load-bearing (it folds a per-degradation record list that can hold many entries of one kind).
**Fix:** drop the wrapper — `return [...(skills ? ["skill" as const] : []), ...(commands ? ["command" as const] : [])];` — or add one line saying the `Set` is kept only for shape parity with the install collector.

### IN-02: gating the clone GC on `wrote` narrows a global sweep to a per-run one

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1552`
**Issue:** `garbageCollectPluginClones` is a derive-not-persist sweep over ALL unreferenced clone keys, not just the one this run un-referenced. The new `if (wrote && preflight.resolvedSha !== undefined)` gate is correct about what this run orphaned, but it also removes the opportunistic reaping of orphans left by an earlier crashed or aborted run. The comment ("A refresh that wrote nothing un-referenced nothing, so it sweeps nothing either") is true of this run and not of the sweep's scope.
**Fix:** either keep the old `preflight.resolvedSha !== undefined` gate (the GC is already swallowed per D-19-01, so the cost is bounded), or note in the comment that opportunistic reaping was deliberately traded away and name the surface that still performs it.

### IN-03: `disabledPinProjection` is element-order-sensitive over three resolver-supplied lists

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1418-1438`
**Issue:** The comment defends against KEY ordering ("Positional, so no key ordering can make equal records compare unequal") but the projection still stringifies `compatibility.notes`, `.supported` and `.unsupported` in whatever order the resolver produced them. If any of the three ever becomes set-derived or gains a non-deterministic emit order, the RECON-05 no-write guard degrades silently into write-every-time — bumping `updatedAt` and `state.json`'s mtime on every update of every disabled plugin, which is precisely the failure the guard exists to prevent.
**Fix:** sort the three arrays inside the projection (`[...compatibility.notes].sort()` etc.). They are compared, never rendered, so ordering carries no information here.

### IN-04: three hand-rolled `(updated)` row compositions, only two cross-pinned

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2252`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts:66`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts:74`
**Issue:** The same `p.reasons` threading had to be applied by hand at all three sites (the two `.messaging.ts` comments say as much). The new `tests/orchestrators/marketplace/update.test.ts` case pins the marketplace surface against a hardcoded literal, and `tests/orchestrators/plugin/update.test.ts` pins the plugin surface against the same literal, but no gate pins the central `renderPluginRow` `updated` arm's reasons brace, and none pins the three against each other by construction. A fourth `(updated)` render map added later regresses silently.
**Fix:** the "lifted verbatim" duplication is an established repo pattern, so a full collapse is out of scope. Add the central arm to the byte-comparison set, or add an architecture test asserting the three `updated` compositions produce identical bytes for one fixture message.

### IN-05: `dependencies` derivation duplicated in the marketplace mapper

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:725-728`
**Issue:** After the composer extraction, the inline `dependencies` const duplicates `outcomeDependencies` (`orchestrators/plugin/update.ts:2409`) and is now consumed by the `partially-installed` arm alone. Two spellings of one derivation on the same code path.
**Fix:** export and reuse `outcomeDependencies` alongside `updatedRowFromOutcome` (or, if WR-03 is taken, both move to the shared leaf module together).

---

_Reviewed: 2026-08-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
