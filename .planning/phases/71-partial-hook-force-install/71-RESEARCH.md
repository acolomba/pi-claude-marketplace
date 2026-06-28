# Phase 71: Partial Hook Force-Install - Research

**Researched:** 2026-06-28
**Domain:** TypeScript resolver/bridge refactor — convert hooks supportability gate from reject-all to a partition; route degradable hook drops through the existing `partial.unsupported` / three-way force-install channel.
**Confidence:** HIGH (all claims traced to live source; line numbers verified this session)

## Summary

This phase is a pure in-repo refactor — **no new dependencies**. The current
hooks pipeline treats ANY unsupportable handler as a structural defect:
`parseHooksConfig` calls `checkMatcherSupportability` (hooks.ts:805), folds its
first-failure verdict into the `{ok:false}` arm (hooks.ts:370-375), the resolver
wraps that as `malformed hooks.json:` and pushes it to `partial.notes` returning
`dirty=true` (resolver.ts:803-806, 986), and `decideResolution` sees
`structuralDirty` and returns `unavailable` (resolver.ts:1016-1017). The net
effect: a single `Stop` event (non-bucket-A) flips an otherwise-rich plugin
(skills+commands+agents) to `(unavailable) {unsupported hooks}` — force cannot
help, install is blocked.

The change has a clean single seam. `checkMatcherSupportability` becomes a pure
**partition** that returns `{ supported: HooksConfig (strict subset), dropped:
DroppedHook[] }`. `parseHooksConfig`'s success arm returns the **filtered**
subset as `value` plus the `dropped` enumeration. Structural failures (JSON.parse
at hooks.ts:343, `HOOKS_VALIDATOR.Check` at hooks.ts:356) stay `{ok:false}` →
`unavailable` exactly as today. The resolver routes a non-empty `dropped` to
`partial.unsupported` (kind `"hooks"`) instead of `dirty`, so `decideResolution`
returns `unsupported` (resolver.ts:1020-1021) — which the Phase 65
`requireForceInstallable` gate and Phase 69 severity wiring already handle with
zero new code. Because every materialize call site (install.ts:720,
reinstall.ts:1411, info.ts:328) **re-reads the source file and re-runs
`parseHooksConfig`**, and the partition is pure/deterministic, the bridge stages
the filtered `value` automatically — **no bridge change is required** beyond
ensuring `parseHooksConfig.value` IS the filtered subset.

**Primary recommendation:** Make `checkMatcherSupportability` → `partitionHooks`
the single source of truth for the supported subset. Have `parseHooksConfig`
return the filtered subset as `value` + a `dropped` enumeration. Route `dropped`
to `partial.unsupported` in `applyHooksConfig`; extend `narrowUnsupportedKinds`
to map kind `"hooks"` → the EXISTING `"unsupported hooks"` reason (REASONS stays
32). Extend the info `(unsupported)`-suffix renderer to matcher-group granularity
for the per-handler breakdown. Migrate the supportability/resolver/catalog tests
that assert "non-bucket-A => unavailable".

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-71-01..06 — do not reopen)

- **D-71-01:** `checkMatcherSupportability` (and the parse path it gates) must
  PARTITION a parsed `hooks.json` into supported vs unsupported handlers at BOTH
  granularities — drop whole non-bucket-A events AND drop individual unsupported
  matcher groups within an otherwise-supported event. It currently `return`s on
  the FIRST failure; that short-circuit becomes an accumulating partition.
- **D-71-02:** A supported event with a MIX of supportable and unsupportable
  matcher groups installs ONLY the supportable groups; the event survives
  partially (not "drop the whole event on any bad group").
- **D-71-03:** Supportability failures (non-bucket-A event, unsupported matcher)
  route the dropped-handler signal to `partial.unsupported` (force-degradable →
  plugin resolves `unsupported`) and KEEP the supported handlers in the
  materialization set. STRUCTURAL failures — unparseable JSON, malformed handler
  (`type:"command"` with no `command`) — still feed the structural `dirty`
  accumulator → `unavailable`. Split the current single `applyHooksConfig` →
  dirty verdict into these two outcomes. Structural precedence (D-64-07)
  preserved.
- **D-71-04:** The compact `list` row keeps a SINGLE aggregate `{unsupported
  hooks}` marker regardless of how many events/matchers were dropped — reuse the
  existing closed-set reason vocabulary (no new REASONS member, no tripwire
  change; REASONS stays 32). The marker renders identically across `list` and
  `info` and at the force-degrade severity.
- **D-71-05:** `/claude:plugin info` ENUMERATES the specific dropped hook
  handlers (which events / which matcher groups were skipped), mirroring how
  FSTAT-07 surfaces dropped-component detail. The aggregate marker stays on the
  list row; the per-handler breakdown lives in `info`.
- **D-71-06:** A direct `install --force` partial-hook degrade renders at **info**
  (no `Warning:`), consistent with SEV-01; without `--force` the plugin still
  blocks/errors via the SEV-02 `unsupported`-arm error + `--force` hint.

### Claude's Discretion (research-resolved below)

- The exact partition result TYPE → see "Partition Result Shape" (recommended
  `HooksPartition`).
- Where the filtered `HooksConfig` is produced/threaded → see "Filtered Config
  Threading" (recommend: `parseHooksConfig.value` becomes the filtered subset;
  bridge re-runs the partition implicitly via existing re-parse).
- The `info` detail wording → reuse the existing ` (unsupported)` suffix; extend
  to `event(matcher) (unsupported)` for matcher-group drops.
- **Open sub-decision for the planner:** drop granularity for a `(d)`
  non-command handler within a kept group — handler-level vs group-level. See
  Open Questions Q1.

### Deferred Ideas (OUT OF SCOPE)

- Expanding `BUCKET_A_EVENTS` to natively support `Stop` / `SubagentStop` /
  `Notification` (would make these plugins fully `installable`, no `--force`).
  Separate concern; only if Pi's hook bridge can dispatch those events. NOT this
  phase.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PHOOK-01 | `checkMatcherSupportability` partitions at event + matcher level instead of reject-on-first-failure | "Partition Result Shape" + the failure-mode classification table |
| PHOOK-02 | Parseable-but-unsupportable `hooks.json` with no structural defect resolves `unsupported`; drops surface via `partial.unsupported` not `dirty` | `applyHooksConfig` split + `decideResolution` routing (resolver.ts:797-826, 1010-1025) |
| PHOOK-03 | Structural precedence preserved — unparseable JSON / malformed handler stays `unavailable` | JSON.parse (hooks.ts:343) + `HOOKS_VALIDATOR.Check` (hooks.ts:356) stay `{ok:false}`; classification table STRUCTURAL rows |
| PHOOK-04 | `install --force` stages supported components + FILTERED `hooks.json`; dropped handlers never staged. No-force still blocks | `parseHooksConfig.value` = filtered subset re-derived at install.ts:720 / reinstall.ts:1411; FORCE-03/05 gate unchanged |
| PHOOK-05 | Dropped hooks render as `{unsupported hooks}` on the force-installed row at correct severity, identical across list/info; byte-exact catalog/notify tests reflect partial-hook rows | `narrowUnsupportedKinds` extension + info `(unsupported)`-suffix renderer; catalog-uat/notify migration |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Partition parsed hooks into supported subset + dropped enumeration | Domain — `domain/components/hooks.ts` | — | Pure classification; same module as `checkMatcherSupportability` today |
| Decide `unsupported` vs `unavailable` from the partition | Domain — `domain/resolver.ts` (`applyHooksConfig`, `decideResolution`) | — | Three-way state machine owner (Phase 64) |
| Stage the filtered `hooks.json` | Bridge — `bridges/hooks/stage.ts::writeHookConfig` (already) | Orchestrator re-parse (install/reinstall) | Bridge writes whatever `parseHooksConfig.value` yields; no new logic |
| Aggregate `{unsupported hooks}` list marker | Shared — `shared/probe-classifiers.ts::narrowUnsupportedKinds` | `shared/notify.ts` REASONS | Single render-time helper shared by list/info/install (RSTATE-05) |
| Enumerated dropped-handler `info` detail | Orchestrator — `orchestrators/plugin/info.ts` + `shared/concerns/hooks.ts::appendHooksBlock` | — | FSTAT-07 dropped-component detail lives on the info surface |
| Force gate + severity | Orchestrator — `orchestrators/plugin/install.ts` / `update.ts` (Phase 65/69) | — | `requireForceInstallable` + caller-stamped severity already wired; no change |

## Standard Stack

No external packages. This is an internal refactor on the existing stack
(TypeScript strict, typebox, `node:test`). The Package Legitimacy Audit and
Environment Availability sections are intentionally omitted — no install step.

Verification command for the test runner (used by the validation plan):
```bash
npm test          # node --test over tests/{architecture,domain,orchestrators,shared,...}
npm run check     # typecheck + lint + format:check + test + test:integration (NFR-6)
```

---

## Deliverable 1 — Partition Result Shape (PHOOK-01)

### Failure-mode classification table (THE load-bearing artifact)

Every current failure mode, its location, and its SUPPORTABILITY (degradable →
`partial.unsupported` → `unsupported`) vs STRUCTURAL (stays `dirty` →
`unavailable`) classification per D-71-03. Line numbers verified against live
source this session.

| # | Failure mode | Location (file:function:line) | Current verdict | New classification | Drop granularity | Rationale |
|---|--------------|-------------------------------|-----------------|--------------------|------------------|-----------|
| S1 | `JSON.parse` throws (invalid JSON) | `hooks.ts:parseHooksConfig:341-347` | `{ok:false}` → unavailable | **STRUCTURAL** (unchanged) | n/a | Broken bytes; force cannot help. D-71-03 explicit. Happens BEFORE the partition. |
| S2 | `HOOKS_VALIDATOR.Check` fails — top-level not object/array, event value not array, **`type:"command"` missing `command`** (schema `if/then`, hooks.ts:190-199) | `hooks.ts:parseHooksConfig:356-361` | `{ok:false}` → unavailable | **STRUCTURAL** (unchanged) | n/a | Malformed handler/shape per D-71-03. Schema gate runs BEFORE the partition. |
| P1 | Non-bucket-A event key (e.g. `Stop`, `Notification`, `SubagentStop`) | `hooks.ts:checkMatcherSupportability:807-809` (`(c) non-bucket-A event`) | first-fail `{ok:false}` → unavailable | **SUPPORTABILITY** | whole EVENT | "we don't support this event" — degradable. D-71-01 event-level drop. |
| P2 | Regex matcher on a tool event | `hooks.ts:tryToolEventTrip:692-694` (`(a) regex matcher`) | first-fail → unavailable | **SUPPORTABILITY** | matcher GROUP | Matcher applies to the whole group; unsupportable matcher → drop group. D-71-02. |
| P3 | Unmapped tool token on a tool event (`MultiEdit`/`WebFetch`/`Task`/Pi-form) | `hooks.ts:tryToolEventTrip:696-698` (`(b) unmapped tool`) | first-fail → unavailable | **SUPPORTABILITY** | matcher GROUP | No Pi reverse-map analog; degradable group drop. |
| P4 | Non-empty matcher on a no-matcher-support event (`UserPromptSubmit`, `NON_TOOL_EVENT_FIELDS[e]===null`) | `hooks.ts:tryNonToolEventTrip:720-725` (`(c) matcher on no-matcher-support event`) | first-fail → unavailable | **SUPPORTABILITY** | matcher GROUP | Drop the over-specified group; match-all groups on the same event survive. |
| P5 | Matcher value outside the closed set (`SessionStart source=clear`, `PreCompact trigger=manual`, any non-empty `SessionEnd`) | `hooks.ts:tryNonToolEventTrip:745-750` (`(c) matcher value not in closed set`) | first-fail → unavailable | **SUPPORTABILITY** | matcher GROUP | Unmappable matcher value; degradable group drop. |
| P6 | Non-command handler type within a group (`type:"http"` etc., well-formed shape) | `hooks.ts:tryHandlerTrip:764-771` (`(d) non-command handler`) | first-fail → unavailable | **SUPPORTABILITY** | HANDLER (recommend) — see Q1 | Handler is well-formed but unsupported type; not malformed (cf. S2). |
| X1 | Tables out of sync — `NON_TOOL_EVENT_FIELDS` declares a field but `NON_TOOL_EVENT_CLOSED_SETS` has no entry | `hooks.ts:tryNonToolEventTrip:728-743` (`(c) missing closed-set entry`) | first-fail → unavailable | **STRUCTURAL** (keep loud) | n/a — statically unreachable | Internal programmer-bug, NOT user input. Arch test `hooks-supportability.test.ts:191` red-fails CI if tables drift. Route to `unavailable` so it surfaces loudly rather than silently dropping. |

**Key boundary:** S1/S2 are detected in `parseHooksConfig` BEFORE
`checkMatcherSupportability` is ever called (hooks.ts:340-361). They keep the
`{ok:false}` arm verbatim. The partition only ever processes a config that has
already passed JSON.parse + schema validation — so the partition function
**cannot** encounter a structural defect (except the unreachable X1). This makes
the structural-vs-supportability split fall on the existing
`parseHooksConfig`-internal stage boundary, not a new branch.

### Recommended return type

Replace `SupportabilityResult` + `checkMatcherSupportability` with a pure
partition:

```typescript
// domain/components/hooks.ts — replaces the reject-all checkMatcherSupportability

/** One dropped hook handler/group/event, for info enumeration + reason. */
export type DroppedHook =
  | { kind: "event"; event: string }                          // P1 (non-bucket-A)
  | { kind: "group"; event: BucketAEvent; matcher: string;    // P2..P5
      cond: "regex" | "unmapped-tool" | "no-matcher-support" | "closed-set" }
  | { kind: "handler"; event: BucketAEvent; matcher: string;  // P6 (see Q1)
      handlerType: string };

/** Strict subset + enumeration. `supported` is a deterministic subset of the
 *  input (same key order, same group order); `dropped` is in encounter order. */
export interface HooksPartition {
  readonly supported: HooksConfig;     // possibly {} when everything drops
  readonly dropped: readonly DroppedHook[];
}

export function partitionHooks(config: HooksConfig): HooksPartition;
```

- `partitionHooks` accumulates instead of returning on first failure: iterate
  every event; non-bucket-A → push `{kind:"event"}` and skip the event; else
  iterate groups, run the existing `tryGroupTrip` per group but on a trip push
  a `DroppedHook` and OMIT the group from `supported` (keep clean groups);
  within a kept group, filter `(d)` non-command handlers per Q1.
- The per-condition debugDetail strings (`(a)`/`(b)`/`(c)`/`(d)`) collapse into
  the `cond` discriminant — the architecture test that pins those prefixes
  (`hooks-supportability.test.ts:221`) migrates to assert the `cond` mapping.
- `partitionHooks` stays **pure and total** (the current invariant) — this is
  what makes re-running it at materialize time safe (Deliverable 2).

### parseHooksConfig success-arm change

```typescript
export type HookConfigParseResult<P> =
  | { ok: true; value: HooksConfig;          // <-- now the FILTERED subset
      dropped: readonly DroppedHook[];        // <-- new
      ifPredicates: CompiledIfPredicateMap<P> }
  | { ok: false; reason: string };            // <-- STRUCTURAL only (S1/S2/X1)
```

- After `HOOKS_VALIDATOR.Check` passes (hooks.ts:356), call `partitionHooks`.
- Set `value = partition.supported` (the filtered subset), `dropped =
  partition.dropped`.
- **Build `ifPredicates` over the FILTERED subset**, not `candidate`
  (hooks.ts:383-385 currently passes `candidate`). Dropped handlers must not
  have their `if` predicates compiled/dispatched.
- The X1 unreachable case: have `partitionHooks` signal it (e.g. a `structural:
  true` flag or throw a tagged internal error) so `parseHooksConfig` can return
  `{ok:false}` for it. Keep it loud; it is arch-test-guarded.

---

## Deliverable 2 — Where the filtered config is produced & threaded (PHOOK-04)

### The seam map (verified line numbers)

| Stage | Site | Today | After Phase 71 |
|-------|------|-------|----------------|
| Resolve | `resolver.ts:readStandaloneHooks:746` calls `parseHooksConfig(raw,…,{skipIfMap:true})`; discards `value`, keeps `relativePath` | records `hooksConfigPath` (pointer to SOURCE) | also reads `parsed.dropped`; returns it to `applyHooksConfig` |
| Resolve verdict | `resolver.ts:applyHooksConfig:797-826` → returns `true` (dirty) on `!ok`; else pushes `"hooks"` to `supported` | reject-all → unavailable | split: `dropped.length>0` → push to `partial.unsupported` + thread `droppedHooks`; keep `supported` + `hooksConfigPath` |
| Materialize (install) | `install.ts:hooksPhase:714-730` re-reads SOURCE, re-runs `parseHooksConfig`, writes `parsed.value` | writes FULL config | writes FILTERED `parsed.value` automatically (value is now the subset) |
| Materialize (reinstall) | `reinstall.ts:1405-1418` same re-read + `writeHookConfig({hooksValue: parsed.value})` | writes FULL config | writes FILTERED subset automatically |
| Bridge write | `bridges/hooks/stage.ts:writeHookConfig:199-210` → `atomicWriteJson(target, hooksValue)` | writes whatever it's handed | **unchanged** — already writes the handed value |
| Info | `info.ts:readHookSummaryEntries:316-333` re-reads SOURCE, re-runs `parseHooksConfig`, projects `value` | projects FULL config | projects FILTERED subset; dropped detail from `parsed.dropped` (Deliverable 3) |

### Decision: bridge re-runs the partition (do NOT thread the filtered config for materialization)

**Recommendation: the resolver does NOT thread the filtered `HooksConfig` for
staging.** Every materialize site already re-reads the source file and re-runs
`parseHooksConfig` (install.ts:714-720, reinstall.ts:1405-1411,
info.ts:320-328). Because `partitionHooks` is pure and deterministic, re-running
it yields the **identical** filtered subset every time. So:

- `parseHooksConfig.value` becoming the filtered subset is the ENTIRE
  materialization change — `writeHookConfig` stages the subset with no new
  parameter, no new threading, no `hooksValue` plumbing change.
- This guarantees the staged file is a strict deterministic subset of source
  (PHOOK-04 "never stage a dropped handler") by construction: the same pure
  function that classified a handler as dropped at resolve time omits it at
  stage time.
- The resolver still records only `hooksConfigPath` (a SOURCE pointer) exactly as
  today (resolver.ts:751) — no parsed value persisted.

**What DOES get threaded:** only the `dropped` enumeration, for two reasons —
(a) `applyHooksConfig` reads `dropped.length` to choose `unsupported` vs
`installable`, and (b) info wants the per-handler breakdown (D-71-05). Add an
optional `droppedHooks?: readonly DroppedHook[]` to `PartialResolution`
(resolver.ts:240-255) and to the `installable`/`unsupported` arms
(resolver.ts:64-103) mirroring how `hooksConfigPath`/`orphanRewake` are spread
(resolver.ts:295-296, 316-317). Info MAY instead re-derive `dropped` from its own
re-parse (it re-reads anyway) — either works; threading is cheaper for info and
authoritative. Recommend threading.

### Per-event bridge routing (unaffected, for reference)

`bridges/hooks/event-router.ts` / `event-adapters.ts` / `dispatch.ts` consume
the staged `hooks.json` at dispatch time and the `ifPredicates` side-Map at
install time. Since the staged file is already the filtered subset and the
side-Map is built over the filtered subset, **the dispatch path needs no change**
— it only ever sees supportable handlers. The one correctness pin: ensure
`buildIfPredicateMap` (hooks.ts:401-420) iterates the filtered subset (see
Deliverable 1), otherwise a dropped handler's predicate could leak into the Map.

### Edge case: empty filtered subset

If EVERY handler drops (e.g. a plugin with only a `Stop` event),
`partition.supported === {}`. The planner must decide (Q2): do NOT add `"hooks"`
to `partial.supported`, do NOT set `hooksConfigPath`, do NOT stage an empty
`hooks.json`; still record `droppedHooks` + route to `unsupported`. This matches
the LSP-only precedent (force installs nothing for that kind). `detectOrphanRewake`
(resolver.ts:768-783) should run on the FILTERED subset so a dropped handler's
orphan field does not raise a false `{orphan rewake}`.

---

## Deliverable 3 — Reason + info plumbing (PHOOK-05)

### List row: single aggregate `{unsupported hooks}` (D-71-04)

The render-time marker family is `narrowUnsupportedKinds`
(`shared/probe-classifiers.ts:146-160`). It maps the resolver's typed
`unsupported: string[]` kind list → reasons: `lspServers → "lsp"`, everything
else → `"unsupported source"`. The shared helper is consumed by list, info, and
the install error surface (RSTATE-05 cross-surface parity), and by
reconcile/update notify (`reconcile/notify.ts:526`, `marketplace/update.ts:679`).

**Change:** extend `narrowUnsupportedKinds` with a third case:
`kind === "hooks" → "unsupported hooks"`. `"unsupported hooks"` is ALREADY a
REASONS member (`shared/notify.ts:98`) — so REASONS stays a closed set of 32,
no tripwire change (D-71-04). Then in `applyHooksConfig`, push the literal kind
`"hooks"` into `partial.unsupported` when `dropped.length > 0`. The return type
of `narrowUnsupportedKinds` widens to `"lsp" | "unsupported source" |
"unsupported hooks"`; verify the `ContentReason` typing at every call site still
compiles.

**Dual-membership note:** a partially-degraded plugin will have `"hooks"` in BOTH
`partial.supported` (line 809, kept handlers materialize) AND
`partial.unsupported` (dropped handlers). This is intentional and parallels a
mixed plugin. The planner must confirm no consumer asserts the two arrays are
disjoint (grep `supported.includes`/`unsupported.includes`). First-wins dedup in
`narrowUnsupportedKinds` (line 150-156) keeps the aggregate single even if
`"hooks"` appears once.

### info: enumerated dropped detail (D-71-05)

Today the info surface has TWO readers (info.ts:502-505):
- `readHookSummaryEntries` (STRICT, info.ts:316) — used when the resolver
  recorded `hooksConfigPath`; projects via `projectHookSummaryEntries`
  (info.ts:276) — emits only supported entries, no `(unsupported)` tags.
- `readLenientHookSummary` (info.ts:363) — used ONLY when the resolver bailed
  (`hooksConfigPath === undefined`); tags non-bucket-A events with a
  ` (unsupported)` suffix at EVENT granularity via the `kind:"lenient"`
  `HookSummaryEntry` arm (`shared/concerns/hooks.ts:62-72`,
  `appendHooksBlock:103-104`).

**The flip:** after Phase 71, a partially-degraded plugin RESOLVES (records
`hooksConfigPath`), so info routes to the STRICT reader — which today loses the
dropped detail. The planner must move the `(unsupported)` enumeration onto the
strict path:

- Extend `HookSummaryEntry` (or the strict projection) so dropped events/groups
  render with the existing ` (unsupported)` suffix, now at **matcher-group**
  granularity: `event(matcher) (unsupported)` for P2-P5 group drops,
  `event (unsupported)` for P1 event drops. The current lenient arm is
  event-only (`supported: boolean`); add a matcher to it or add a new arm.
- Feed it from the threaded `droppedHooks` (or info's own re-derived
  `partition.dropped`) so the supported entries render plain and the dropped
  ones render suffixed, in declaration order. This mirrors FSTAT-07
  dropped-component detail.
- `appendHooksBlock` (`shared/concerns/hooks.ts:96-108`) already owns the
  `(unsupported)` suffix convention — extend its lenient/dropped arm to print the
  matcher.

The existing INFO-05 tests `info.test.ts:1966` and `:2004` (Stop event →
lenient reader → `Stop (unsupported)`) are the canary: they currently exercise
the BAIL path. Post-change those plugins resolve `unsupported` and must render
the SAME `Stop (unsupported)` line via the strict path. Migrate them (Deliverable
4).

### Severity (D-71-06) — no new code

Once a partial-hook plugin resolves `unsupported`, it flows through the Phase 65
`requireForceInstallable` gate (install.ts / update.ts orchestrators) and the
Phase 69 caller-stamped severity automatically: `install --force` degrade →
**info** (SEV-01); no-force install of `unsupported` → **error** + `--force`
hint (SEV-02). Confirm via the existing severity tests; expect no source change
in the severity layer, only new fixtures.

### REASONS closed set / tripwire (keep green)

No explicit `REASONS.length === 32` test was found; the closed set is enforced
behaviorally by the byte-exact catalog/notify tests and the membership assertions
in `tests/shared/notify-v2.test.ts` (e.g. line 4722 asserts `"orphan rewake"`
membership). `cross-surface-reason-parity.test.ts` asserts
`narrowResolverNotes`/`narrowUnsupportedKinds` emit the SAME closed-set token per
surface — extending `narrowUnsupportedKinds` to `"unsupported hooks"` must keep
this parity green. Because `"unsupported hooks"` is a pre-existing member, the
planner adds NO REASONS literal (D-71-04).

---

## Deliverable 4 — Existing tests / fixtures to migrate (PHOOK-01..05)

### Tests that assert "non-bucket-A / unsupportable matcher => unavailable" (MUST change)

| File | Cases | Current assertion | New behavior |
|------|-------|-------------------|--------------|
| `tests/domain/components/hooks.test.ts` | `:325` non-bucket-A `Stop` → `(c)`; `:339` UserPromptSubmit non-empty matcher → `(c)`; `:358` SessionStart `clear` → `(c)` closed-set; `:383` PreCompact `manual` → `(c)`; `:408` non-command `http` → `(d)`; `:297`/`:311` regex/unmapped → `(a)`/`(b)` | `checkMatcherSupportability`/`parseHooksConfig` return `{ok:false}` with `(a)`/`(b)`/`(c)`/`(d)` debugDetail | `partitionHooks` returns `{supported, dropped}`; assert the dropped entry's `cond` + that `supported` omits the bad group/event and KEEPS clean ones. `parseHooksConfig` returns `{ok:true, value: subset, dropped}` |
| `tests/domain/components/hooks.test.ts` | `:170` `type:"command"` missing `command` → `{ok:false}` | structural reject | **KEEP** — S2 stays `{ok:false}` (PHOOK-03) |
| `tests/domain/components/hooks.test.ts` | `:152` invalid JSON; `:161` shape mismatch | `{ok:false}` | **KEEP** — S1/S2 stay structural |
| `tests/architecture/hooks-supportability.test.ts` | `:221` pins `(a)/(b)/(c)/(d)` debugDetail prefixes via single `{ok:false; debugDetail}` | prefix contract | Migrate prefix contract to the `DroppedHook.cond` discriminants; the event/tool/closed-set table tests `:42-:209` stay |
| `tests/domain/resolver-strict.test.ts` | `:174`,`:192` malformed/shape-mismatch hooks → `unavailable` | KEEP (structural) | **KEEP** unchanged (PHOOK-03) |
| `tests/domain/resolver-strict.test.ts` / `resolver-loose.test.ts` | (none today assert non-bucket-A → unavailable at resolver level) | — | **ADD** cases: hooks.json with a `Stop` event (or unsupported matcher) + supported skills → `state === "unsupported"`, `hooksConfigPath` recorded, `unsupported` includes `"hooks"`, `supported` includes `"hooks"` |
| `tests/orchestrators/plugin/info.test.ts` | `:1966` `Stop (unsupported)` on a `(unavailable) {unsupported hooks}` row (lenient reader); `:2004` mixed `PostToolUse`+`Stop`, only `Stop` carries `(unsupported)` | row is `(unavailable)`, lenient path | Row becomes `unsupported`/force-installed; SAME `Stop (unsupported)` line must render via the STRICT path; matcher-group drops gain `event(matcher) (unsupported)` |
| `tests/architecture/catalog-uat.test.ts` | `:279`,`:1223` `delta`: `status:"unavailable", reasons:["unsupported hooks"]`; `:283`,`:857` `epsilon`: `["unsupported hooks","lsp"]`; `:584`,`:1775` unsupported-hooks rows; `:2388` info "old plugin declares hooks; not installable" | `unavailable` + `{unsupported hooks}` | **Audit each fixture's hooks.json shape:** if it is a non-bucket-A/unsupported-matcher case → row becomes `unsupported` (and `force-installed` after `--force`); if it is genuinely malformed JSON/handler → stays `unavailable`. Reconcile the byte forms accordingly |

### Byte-exact contract surfaces that MUST stay green (and gain new partial-hook rows)

- `tests/architecture/catalog-uat.test.ts` + `docs/output-catalog.md` — add the
  partial-hook `unsupported` / `force-installed` rows with the aggregate
  `{unsupported hooks}` brace; reconcile any fixture that flips from unavailable.
- `tests/shared/notify-v2.test.ts`, `tests/shared/snm37-behavioral-smoke.test.ts`,
  `tests/shared/snm38-indent-ladder.test.ts` — reason rendering + indent ladder.
- `tests/shared/probe-classifiers.test.ts` — `narrowUnsupportedKinds` extension
  (`"hooks" → "unsupported hooks"`).
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` — list/info
  parity for the new aggregate token.
- `tests/orchestrators/plugin/install.test.ts` (`:2941` LIFE-01 bridge write) /
  `list.test.ts` — partial-hook install writes a FILTERED `hooks.json`; assert
  the staged file omits the dropped event/group (strict-subset assertion is the
  PHOOK-04 verification).
- `docs/messaging-style-guide.md` — if it documents the unavailable→unsupported
  hooks transition.

### Fixtures

- `tests/fixtures/hookify-hooks.json` — verified: contains only bucket-A events
  (`PreToolUse`/`PostToolUse`/`UserPromptSubmit`), NO `Stop`. It currently
  resolves fully. To exercise the partition, **add a fixture variant** with a
  mixed shape: bucket-A supported groups + a `Stop` event (and/or an unsupported
  matcher group on a supported event). Recommended fixtures: (a) `Stop`-only →
  empty subset edge case (Q2); (b) `PostToolUse(Edit)` + `Stop` → partial; (c)
  `PreToolUse(Edit)` + `PreToolUse(.*regex)` → matcher-group partition within one
  event (D-71-02).

### Validation targets (real plugins this unlocks)

CONTEXT names hookify, ralph-loop, security-guidance from
`anthropics/claude-plugins-official`, all blocked today solely by a `Stop` hook.
**Verified: these are NOT in the local checkout.** `~/src/claude-plugins`
(MEMORY) is the USER'S OWN collection (apple-music, stocks, ebay, youtube, …) —
it does not contain hookify/ralph-loop/security-guidance, and there is no local
`anthropics/claude-plugins-official` checkout. **Implication for the planner:**
integration validation must use synthetic fixtures mirroring those shapes (a
single top-level `Stop` event alongside supported components), not a live
checkout. The `info.test.ts` comments already reference the "ralph-loop fixture
shape: a single top-level `Stop` event" (`:1981`) — reuse that pattern.

---

## Architecture Patterns

### Recommended change shape (data flow)

```
hooks.json (source bytes)
        │  JSON.parse            ── fail S1 ──► {ok:false} ─► resolver dirty ─► UNAVAILABLE
        ▼
   HOOKS_VALIDATOR.Check         ── fail S2 ──► {ok:false} ─► resolver dirty ─► UNAVAILABLE
        ▼
   partitionHooks(config)  ◄── PURE, DETERMINISTIC (re-run safe)
        │
        ├─ supported: HooksConfig (strict subset)  ──► parseHooksConfig.value
        │        └─► install/reinstall re-parse ─► writeHookConfig(subset)  [PHOOK-04]
        │        └─► buildIfPredicateMap(subset)  [dispatch only sees supportable]
        │
        └─ dropped: DroppedHook[]
                 ├─ length>0 ─► partial.unsupported += "hooks" ─► decideResolution ─► UNSUPPORTED  [PHOOK-02]
                 │        └─► narrowUnsupportedKinds("hooks") = "unsupported hooks"  ─► list/info aggregate  [PHOOK-05/D-71-04]
                 └─► threaded droppedHooks ─► info enumerates event(matcher) (unsupported)  [PHOOK-05/D-71-05]
```

### Anti-patterns to avoid

- **Threading a separate filtered config for staging.** Unnecessary — the
  materialize sites already re-parse; a pure partition makes re-derivation
  authoritative. Adding a second source of truth invites drift between the
  resolve-time and stage-time subset.
- **Adding a new REASONS member for hooks.** D-71-04 forbids it; `"unsupported
  hooks"` already exists. Adding one trips the closed-set/byte-exact tests.
- **Dropping the whole event on any bad group.** Violates D-71-02 — partition at
  group granularity within a supported event.
- **Compiling `if` predicates over the full (unfiltered) config.** Would dispatch
  a dropped handler's predicate. Build the side-Map over `partition.supported`.
- **Letting the X1 table-desync silently degrade.** Keep it `unavailable`
  (loud); it is a programmer bug, arch-test-guarded.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Aggregate `{unsupported hooks}` list marker | New marker plumbing | Extend `narrowUnsupportedKinds` (probe-classifiers.ts:146) | Single shared render seam; guarantees list/info parity (RSTATE-05) |
| Per-handler `(unsupported)` info detail | New renderer | Extend `appendHooksBlock` lenient arm (concerns/hooks.ts:96) | Already owns the `(unsupported)` suffix convention |
| Filtered-subset staging | New bridge param/threading | `parseHooksConfig.value` = subset, re-parsed at install.ts:720 | Bridge already writes the handed value atomically (NFR-1) |
| Force gate + severity for partial hooks | New severity branch | Resolve to `unsupported`; Phase 65/69 gates fire automatically | FORCE-01/03/05 + SEV-01/02 already cover the `unsupported` arm |

## Common Pitfalls

### Pitfall 1: The info reader path flips from lenient to strict
**What goes wrong:** After the resolver records `hooksConfigPath` for partial
plugins, info routes to `readHookSummaryEntries` (strict), which today drops the
`(unsupported)` enumeration. The `Stop (unsupported)` info line silently
disappears.
**How to avoid:** Move the `(unsupported)` enumeration onto the strict projection
(feed from `dropped`); keep the INFO-05 tests asserting the exact line.

### Pitfall 2: `ifPredicates` / `detectOrphanRewake` run on the full config
**What goes wrong:** A dropped handler's `if` predicate gets compiled into the
dispatch Map, or its orphan-rewake field raises a false `{orphan rewake}`.
**How to avoid:** Run `buildIfPredicateMap` (hooks.ts:401) and
`detectOrphanRewake` (resolver.ts:768) over `partition.supported`, not
`candidate`/full value.

### Pitfall 3: `"hooks"` in both supported and unsupported confuses a consumer
**What goes wrong:** Some surface assumes the two kind-arrays are disjoint.
**How to avoid:** Grep `supported`/`unsupported` consumers; the first-wins dedup
in `narrowUnsupportedKinds` keeps the aggregate single, but verify list/info/info
projection logic tolerates dual membership.

### Pitfall 4: Reclassifying a structural fixture as degradable
**What goes wrong:** A catalog-uat fixture whose hooks.json is genuinely
malformed (bad JSON / `type:"command"` no `command`) gets flipped to
`unsupported`, weakening PHOOK-03.
**How to avoid:** Audit each `{unsupported hooks}` fixture's actual bytes; only
non-bucket-A / unsupported-matcher cases become degradable. S1/S2 stay
`unavailable`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), `node --test`, TS via native strip |
| Config file | none — globs in `package.json` scripts |
| Quick run | `node --test tests/domain/components/hooks.test.ts` (partition unit) |
| Full suite | `npm run check` (typecheck + lint + format + test + integration) |

### Phase Requirements → Test Map
| Req | Behavior to prove | Type | Command | File exists? |
|-----|-------------------|------|---------|--------------|
| PHOOK-01 | `partitionHooks` partitions at event + group level; clean groups survive, bad ones drop; mixed event keeps supportable groups (D-71-02) | unit | `node --test tests/domain/components/hooks.test.ts` | ✅ migrate `:297-:436` |
| PHOOK-02 | Parseable-but-unsupportable hooks + supported skills → `state==="unsupported"`, `hooksConfigPath` set, `unsupported` includes `"hooks"` | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ ADD case |
| PHOOK-03 | Invalid JSON / `type:"command"` no `command` → `unavailable` (structural precedence) | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ `:174-:205` KEEP |
| PHOOK-04 | `install --force` stages a `hooks.json` that is a STRICT SUBSET — dropped event/group absent from the written file; no-force blocks | integration/orchestrator | `node --test tests/orchestrators/plugin/install.test.ts` + `tests/integration/hooks-*` | ✅ extend `:2941` |
| PHOOK-05 | list row = single `{unsupported hooks}`; info enumerates `event(matcher) (unsupported)`; byte-identical across surfaces; force degrade at info / no-force at error | byte-exact | `node --test tests/architecture/catalog-uat.test.ts tests/shared/notify-v2.test.ts tests/orchestrators/plugin/{info,list,cross-surface-reason-parity}.test.ts` | ✅ migrate |

### Sampling Rate
- **Per task commit:** `node --test <touched test file>` + `npm run typecheck`.
- **Per wave merge:** `npm test` (unit + architecture + orchestrator + shared).
- **Phase gate:** `npm run check` green (adds lint/format + `test:integration`)
  before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/fixtures/` — add mixed partial-hook fixtures (Stop-only edge case;
  bucket-A + Stop; intra-event matcher-group mix). None exist today.
- [ ] `tests/domain/resolver-strict.test.ts` / `resolver-loose.test.ts` — add
  non-bucket-A → `unsupported` cases (none today).
- [ ] No framework install needed — `node:test` already in use.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as
enabled). This phase is an internal TS refactor with no auth/session/crypto
surface. The one relevant control is **V5 Input Validation / output containment**:
the filtered `hooks.json` MUST be a strict deterministic subset of the source —
the bridge must never stage a handler the partition dropped (PHOOK-04). This is a
correctness/containment property, verified by the PHOOK-04 strict-subset
assertion, not a new security mechanism. Existing LIFE-03 symlink-escape
containment in `stage.ts:67-108` and NFR-10 path containment are unaffected.

| ASVS | Applies | Control |
|------|---------|---------|
| V5 Input Validation | yes | `HOOKS_VALIDATOR` (typebox) gates shape; `partitionHooks` gates supportability; staged subset is a pure projection of validated input |
| V2/V3/V4/V6 | no | no auth/session/access-control/crypto surface in this phase |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `(d)` non-command handler should drop at HANDLER granularity (filter the group's `hooks` array), not whole-group | Deliverable 1, Q1 | If group-level is required, a kept group with one bad handler drops entirely — fewer handlers install. Low risk; either honors D-71-03 |
| A2 | Validation targets (hookify/ralph-loop/security-guidance) are NOT locally available; synthetic fixtures required | Deliverable 4 | If a checkout is added later, real-plugin integration is possible but not required |

*All other claims are VERIFIED against live source this session (line numbers
checked) or CITED from CONTEXT.md/REQUIREMENTS.md.*

## Open Questions

1. **Q1 — `(d)` non-command handler drop granularity.** D-71-01/02 specify event
   + matcher-group granularity; a handler is below group level. PHOOK-04 says
   "never stage a dropped handler" which literally implies handler granularity.
   - Recommendation: drop at HANDLER level (filter the group's `hooks` array);
     if a group empties, drop the group; if an event empties, drop the event.
     Maximizes installed surface and matches "strict subset, drop only the
     unsupportable." Flag for the planner to lock as a D-71 sub-decision.
2. **Q2 — Empty filtered subset (all handlers drop).** Recommend: do not add
   `"hooks"` to `supported`, do not set `hooksConfigPath`, do not stage an empty
   file; still route to `unsupported` with `droppedHooks`. Matches LSP-only
   precedent. Planner confirms.
3. **Q3 — catalog-uat `delta`/`epsilon` fixture bytes.** The plan's first task
   should grep each `{unsupported hooks}` fixture's hooks.json to classify
   structural (stay unavailable) vs supportability (become unsupported) before
   editing byte forms.

## State of the Art

| Old approach | Current approach | When | Impact |
|--------------|------------------|------|--------|
| Hooks reject-all: any unsupportable handler → `unavailable` (`checkMatcherSupportability` first-fail) | Partition: drop unsupportable, keep supportable → `unsupported` (force-degradable) | This phase | Plugins blocked solely by a `Stop` hook become force-installable |

## Sources

### Primary (HIGH confidence — live source, line numbers verified this session)
- `domain/components/hooks.ts` — `parseHooksConfig:334-388`, `checkMatcherSupportability:805-821`, `tryGroupTrip:781-803`, `tryToolEventTrip:689-701`, `tryNonToolEventTrip:714-753`, `tryHandlerTrip:760-774`, `buildIfPredicateMap:401-420`, `BUCKET_A_MEMBERS:680`.
- `domain/components/hook-events.ts` — `BUCKET_A_EVENTS:36-45`, `TOOL_EVENTS:69-73`, `NON_TOOL_EVENT_FIELDS:109-115`, `NON_TOOL_EVENT_CLOSED_SETS:151-168`.
- `domain/resolver.ts` — `readStandaloneHooks:716-752`, `applyHooksConfig:797-826`, `decideResolution:1010-1025`, `addUnsupportedKindNotes:927-942`, `unsupported/installable/unavailable:273-319`, `PartialResolution:240-255`, arm schemas `:64-128`.
- `bridges/hooks/stage.ts` — `hookConfigPathFor:34-36`, `writeHookConfig:199-210`.
- `orchestrators/plugin/install.ts` — `hooksPhase:707-740`, state record `:825`.
- `orchestrators/plugin/reinstall.ts` — `:1399-1418`.
- `orchestrators/plugin/info.ts` — `readHookSummaryEntries:316-334`, `readLenientHookSummary:363-405`, `projectHookSummaryEntries:276-294`, `composeResolvedComponents:461-514`.
- `shared/notify.ts` — `REASONS:89-130` (32 members; `"unsupported hooks":98`).
- `shared/probe-classifiers.ts` — `narrowUnsupportedKinds:146-160`.
- `shared/concerns/hooks.ts` — `HookSummaryEntry:62-73`, `appendHooksBlock:96-108`.
- Tests: `tests/domain/components/hooks.test.ts`, `tests/domain/resolver-strict.test.ts`, `tests/architecture/hooks-supportability.test.ts`, `tests/architecture/catalog-uat.test.ts:279/283/584/1223/1775/2388`, `tests/orchestrators/plugin/info.test.ts:1966/2004`, `tests/orchestrators/plugin/install.test.ts:2941`.
- `tests/fixtures/hookify-hooks.json` (bucket-A only, no Stop); `~/src/claude-plugins` (user's own collection — validation targets absent).

### Secondary (project decisions)
- `.planning/phases/71-partial-hook-force-install/71-CONTEXT.md` (D-71-01..06).
- `.planning/REQUIREMENTS.md` (PHOOK-01..05, RSTATE/FORCE/FSTAT/SEV foundation).

## Metadata

**Confidence breakdown:**
- Partition shape + classification table: HIGH — every failure mode traced to a
  specific line and classified against D-71-03.
- Filtered-config threading: HIGH — all three re-parse seams verified; bridge
  writes the handed value unchanged.
- Reason/info plumbing: HIGH — shared render helpers identified; one extension
  point each; REASONS member pre-exists.
- Test migration catalog: HIGH — grepped and line-referenced; fixture absence
  confirmed.

**Research date:** 2026-06-28
**Valid until:** stable (internal source) — re-verify line numbers if the hooks
or resolver modules are edited before planning.
