# Phase 71: Partial Hook Force-Install - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 11 (7 source modified, 1 fixture-set added, plus test migrations)
**Analogs found:** 11 / 11 (every changed file has an in-repo analog; this is a pure refactor with no greenfield)

All paths absolute under repo root `/Users/acolomba/src/pi-claude-marketplace`.
Source root: `extensions/pi-claude-marketplace/`. Tests root: `tests/`.

Comment / test-title policy reminder (`.claude/rules/typescript-comments.md`):
use `D-71-NN` / `PHOOK-NN` / `NFR-N` IDs as traceability anchors. Never write
`Phase 71`, `Plan NN`, `Wave N`, or bare `Pitfall N` in code comments or test
titles. The "Phase 64 / 65 / 66 / 69" references in this document are
PLANNING context for the planner — they MUST NOT be copied into source.

## File Classification

| Changed File | Role | Data Flow | Closest Analog | Match Quality |
|--------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/domain/components/hooks.ts` | domain/component | transform (parse → partition) | self — `checkMatcherSupportability` reject-all loop becomes `partitionHooks` accumulator | self-refactor (exact) |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | service (resolver) | transform / verdict | `addUnsupportedKindNotes` (the `partial.unsupported` channel) + `applyHooksConfig` self | exact (mirror sibling in same file) |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | utility (render classifier) | transform | self — `narrowUnsupportedKinds` two-case → three-case | self-refactor (exact) |
| `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` | utility (renderer) | transform | self — `appendHooksBlock` lenient arm + `HookSummaryEntry` union | self-refactor (exact) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | orchestrator | request-response (read+project) | self — `readHookSummaryEntries` (strict) merging `readLenientHookSummary` detail | self-refactor (exact) |
| `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | bridge | file-I/O (atomic write) | self — `writeHookConfig` (NO change; writes handed value) | no-change (reference) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | orchestrator | file-I/O (re-parse + stage) | self — `hooksPhase` (NO logic change; `parsed.value` is now subset) | no-change (reference) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | orchestrator | file-I/O (re-parse + stage) | `install.ts::hooksPhase` (mirror; NO change) | no-change (reference) |
| `extensions/pi-claude-marketplace/shared/notify.ts` | config (closed set) | n/a | self — `REASONS` (NO change; `"unsupported hooks"` already member) | no-change (reference) |
| `tests/fixtures/<new partial-hook fixtures>` | test fixture | n/a | `tests/fixtures/hookify-hooks.json` (bucket-A-only shape to extend) | role-match |
| `tests/{domain,architecture,orchestrators,shared}/...` | test | n/a | named per-file in Test Migration section below | exact |

## Pattern Assignments

### `domain/components/hooks.ts` — `partitionHooks` (transform; the core change)

**Analog:** self. `checkMatcherSupportability` (805-821) is a reject-all loop that
`return`s on the FIRST trip. D-71-01 turns it into an accumulating partition.

**Existing reject-all loop to convert** (805-821):
```typescript
export function checkMatcherSupportability(config: HooksConfig): SupportabilityResult {
  for (const [eventName, groups] of Object.entries(config)) {
    if (!BUCKET_A_MEMBERS.has(eventName)) {
      return { ok: false, debugDetail: `(c) non-bucket-A event: ${eventName}` }; // P1 → push {kind:"event"}, skip event
    }
    const bucketAEvent = eventName as BucketAEvent;
    for (const group of groups) {
      const trip = tryGroupTrip(bucketAEvent, group); // P2..P6 → push DroppedHook, OMIT group/handler
      if (trip !== null) {
        return trip;
      }
    }
  }
  return { ok: true };
}
```

**The four trip helpers (689-803) carry the `cond` discriminants** — REUSE them; do
not rewrite the classification. Map each `debugDetail` prefix to a `DroppedHook.cond`:
- `tryToolEventTrip` (689-701): `(a) regex matcher` → `cond:"regex"` (P2); `(b) unmapped tool` → `cond:"unmapped-tool"` (P3). GROUP granularity.
- `tryNonToolEventTrip` (714-753): `(c) matcher on no-matcher-support event` → `cond:"no-matcher-support"` (P4); `(c) matcher value not in closed set` → `cond:"closed-set"` (P5). GROUP granularity. The `(c) missing closed-set entry` branch (728-743, X1) stays STRUCTURAL — signal it back as `{ok:false}` to `parseHooksConfig` (arch-test-guarded, keep loud).
- `tryHandlerTrip` (760-774): `(d) non-command handler` → `cond` HANDLER-level filter per research Q1 (filter `group.hooks`, drop group if empties).
- `tryGroupTrip` (781-803): the per-group composer — keep its structure; on a non-null trip, push the `DroppedHook` and OMIT this group from the supported subset instead of returning.

**Recommended return type** (research Deliverable 1, lines 166-185) — discriminated
`DroppedHook` union + `HooksPartition { supported, dropped }`. `BucketAEvent` is
imported from `domain/components/hook-events.ts:60`.

**`parseHooksConfig` success-arm change** — the structural/supportability seam.
Current (340-388): S1 `JSON.parse` (343) and S2 `HOOKS_VALIDATOR.Check` (356) both
`return {ok:false}` BEFORE the supportability gate. KEEP those two arms verbatim
(PHOOK-03). The supportability fold at 370-375 currently collapses to `{ok:false}`:
```typescript
const supportability = checkMatcherSupportability(candidate);
if (!supportability.ok) {
  const reason = `unsupported hooks: ${supportability.debugDetail}`;
  hookDebugLog(reason);
  return { ok: false, reason };          // <-- REMOVE: no longer a failure
}
```
Replace with `const partition = partitionHooks(candidate);` then return
`{ ok:true, value: partition.supported, dropped: partition.dropped, ifPredicates }`.

**`HookConfigParseResult` type to widen** (299-301):
```typescript
export type HookConfigParseResult<P> =
  | { ok: true; value: HooksConfig; ifPredicates: CompiledIfPredicateMap<P> }
  | { ok: false; reason: string };
```
Add `dropped: readonly DroppedHook[]` to the `ok:true` arm; `value` becomes the
FILTERED subset.

**Critical: build `ifPredicates` over the FILTERED subset.** `parseHooksConfig`
calls `buildIfPredicateMap(candidate, ...)` at 385 — change `candidate` →
`partition.supported`. `buildIfPredicateMap` (401-420) iterates `Object.entries(config)`
and assumes every key is a `BucketAEvent`; passing the subset preserves that
invariant AND prevents a dropped handler's `if` predicate leaking into dispatch
(research Pitfall: ifPredicates on full config).

---

### `domain/resolver.ts` — `applyHooksConfig` split + `partial.unsupported` routing

**Primary analog:** `addUnsupportedKindNotes` (927-942) — the EXACT degradable
channel to mirror. It pushes a kind to `partial.unsupported` (NOT `dirty`):
```typescript
async function addUnsupportedKindNotes(...): Promise<boolean> {
  let dirty = false;
  for (const kind of await collectUnsupportedKinds(entry, manifest, pluginRoot, ctx)) {
    partial.notes.push(`contains ${kind}`);
    partial.unsupported.push(kind);     // <-- the degradable signal (NOT dirty)
    dirty = true;
  }
  return dirty;
}
```
Note: `addUnsupportedKindNotes` returns `dirty` but its result is DISCARDED at the
call site (994: `await addUnsupportedKindNotes(...)` with no `dirty |=`). For hooks,
the `dropped` signal must likewise NOT feed the `dirty` accumulator (D-71-03).

**Self-analog to split:** `applyHooksConfig` (797-826) currently returns `true`
(structural dirty) on `!ok`, and on success pushes `"hooks"` to `partial.supported`:
```typescript
const hooksResult = await readStandaloneHooks(ctx, pluginRoot);
if (!hooksResult.ok) {
  partial.notes.push(hooksResult.reason);
  return true;                          // STRUCTURAL — KEEP for S1/S2/X1
}
if (hooksResult.value !== undefined) {
  partial.supported.push("hooks");
  if (hooksResult.relativePath !== undefined) {
    partial.hooksConfigPath = hooksResult.relativePath;
  }
  if (detectOrphanRewake(hooksResult.value)) {   // run on FILTERED subset
    partial.orphanRewake = true;
  }
}
return false;
```
**Change:** `readStandaloneHooks` (716-752) must surface `parsed.dropped` (it already
parses at 746 and returns `parsed.value`; add `dropped`). In `applyHooksConfig`, when
`dropped.length > 0`, push `"hooks"` into `partial.unsupported` and thread
`partial.droppedHooks = dropped`. Still keep the `partial.supported.push("hooks")` +
`hooksConfigPath` when `partition.supported` is non-empty (dual membership is
intentional — research Deliverable 3). Empty-subset edge (Q2): do NOT push
`"hooks"` to `supported`, do NOT set `hooksConfigPath`, do NOT stage; still route
to `unsupported` via `droppedHooks`.

**`detectOrphanRewake` (768-783) must run on the FILTERED subset**, not the full
parsed value (research Pitfall 2) — pass `partition.supported`.

**`PartialResolution` field-spread pattern** (240-255, 281-319) — add an optional
`droppedHooks?` mirroring `hooksConfigPath` / `orphanRewake` exactly:
```typescript
// PartialResolution interface (240-255)
hooksConfigPath?: string;
orphanRewake?: boolean;
// add: droppedHooks?: readonly DroppedHook[];

// installable() (281-298) AND unsupported() (302-319) — both arms spread identically:
...(partial.hooksConfigPath !== undefined && { hooksConfigPath: partial.hooksConfigPath }),
...(partial.orphanRewake !== undefined && { orphanRewake: partial.orphanRewake }),
// add: ...(partial.droppedHooks !== undefined && { droppedHooks: partial.droppedHooks }),
```
`emptyResolution` (257-268) leaves these absent (not `undefined`) per
exactOptionalPropertyTypes — follow that discipline for `droppedHooks`.

**`decideResolution` (1010-1025) needs NO change** — it already routes
`partial.unsupported.length > 0` → `unsupported()`. Routing `dropped` to
`partial.unsupported` makes it fire automatically:
```typescript
if (structuralDirty) {
  return unavailable(name, partial.notes);
}
if (partial.unsupported.length > 0) {     // <-- now true for partial-hook plugins
  return unsupported(name, pluginRoot, partial);
}
return installable(name, pluginRoot, partial);
```

---

### `shared/probe-classifiers.ts` — `narrowUnsupportedKinds` third case

**Analog:** self (146-160). Two-case map → three-case. `"unsupported hooks"` is
ALREADY a `REASONS` member (`notify.ts:98`), so no closed-set / tripwire change
(D-71-04).
```typescript
export function narrowUnsupportedKinds(
  unsupported: readonly string[],
): readonly ("lsp" | "unsupported source")[] {        // widen return type
  const out: ("lsp" | "unsupported source")[] = [];
  const seen = new Set<string>();
  for (const kind of unsupported) {
    const reason = kind === "lspServers" ? "lsp" : "unsupported source"; // add: kind === "hooks" → "unsupported hooks"
    if (!seen.has(reason)) {            // first-wins dedup keeps aggregate single (D-71-04)
      out.push(reason);
      seen.add(reason);
    }
  }
  return out;
}
```
Widen the return union to `("lsp" | "unsupported source" | "unsupported hooks")[]`;
verify the `ContentReason` typing at every call site still compiles (research lists
`reconcile/notify.ts:526`, `marketplace/update.ts:679`, list/info/install error
surface). The header comment (130-145) documents the `lspServers → lsp`, else-generic
mapping — extend it to name the `hooks → unsupported hooks` case.

---

### `shared/concerns/hooks.ts` — `appendHooksBlock` matcher-group `(unsupported)` suffix

**Analog:** self. `appendHooksBlock` (91-109) already owns the ` (unsupported)`
suffix convention via the `kind:"lenient"` arm:
```typescript
for (const entry of entries) {
  if ("kind" in entry) {
    lines.push(`      ${entry.event}${entry.supported ? "" : " (unsupported)"}`); // event-only today
  } else if ("matcher" in entry) {
    lines.push(`      ${entry.event}(${entry.matcher})`);
  } else {
    lines.push(`      ${entry.event}`);
  }
}
```
**Change (D-71-05):** the lenient arm renders at EVENT granularity only; extend it
(or add a matcher field / new arm) so matcher-group drops render
`event(matcher) (unsupported)` for P2-P5 and `event (unsupported)` for P1. The
`HookSummaryEntry` union (64-71) currently has the lenient arm as
`{ kind:"lenient"; event:string; supported:boolean }` — add an optional `matcher`
or a dropped-specific arm. Update the doc-comment arm description (78-89) to match.

---

### `orchestrators/plugin/info.ts` — strict path carries dropped detail (Pitfall 1)

**Analog:** self. After Phase 71, a partial-hook plugin RECORDS `hooksConfigPath`,
so info routes to the STRICT reader `readHookSummaryEntries` (316-334) instead of
the lenient bail reader `readLenientHookSummary` (363-405). The strict projector
`projectHookSummaryEntries` (276-298) emits ONLY supported entries — the
`(unsupported)` detail would silently vanish.

**Strict reader to extend** (316-334) — feed it `dropped`:
```typescript
async function readHookSummaryEntries(pluginRoot, hooksConfigPath) {
  const raw = await readFile(path.join(pluginRoot, hooksConfigPath), "utf8");
  const ifCtx = { homedir: homedir(), cwd: process.cwd(), projectRoot: process.cwd() };
  const noopCompileIf = (): null => null;
  const parsed = parseHooksConfig(raw, ifCtx, noopCompileIf, { skipIfMap: true });
  if (!parsed.ok) {
    return undefined;
  }
  return projectHookSummaryEntries(parsed.value);   // supported only
}
```
`parseHooksConfig` now also returns `parsed.dropped` — merge those into the
projected entries as lenient/dropped `(unsupported)` arms (declaration order), OR
read the threaded `resolved.droppedHooks` (research recommends threading as
authoritative). The lenient reader's `kind:"lenient"` entry shape (397-401) is the
template for the dropped arms. The INFO-05 canary tests (`info.test.ts:1966`, `:2004`)
currently exercise the BAIL path and must keep rendering the SAME `Stop (unsupported)`
line via the strict path post-change.

---

### `bridges/hooks/stage.ts` — `writeHookConfig` (NO CHANGE; reference only)

**Analog:** self (199-210). Stages whatever `hooksValue` it is handed via
`atomicWriteJson` (NFR-1). Because `parseHooksConfig.value` is now the filtered
subset, the staged file becomes a strict subset BY CONSTRUCTION — no bridge change
(PHOOK-04 "never stage a dropped handler" holds via the pure partition):
```typescript
export async function writeHookConfig(input: WriteHookConfigInput): Promise<WriteHookConfigResult> {
  const { locations, pluginName, pluginRoot, hooksValue } = input;
  assertSafeName(pluginName, "hooks bridge plugin name");
  await assertNoSymlinkEscapeInHooksSubtree(pluginRoot);
  const target = hookConfigPathFor(locations, pluginName);
  await assertPathInside(locations.hooksDir, target, "hooks bridge write target");
  await atomicWriteJson(target, hooksValue);          // writes the handed (now filtered) value
  return { written: true, path: target };
}
```

---

### `orchestrators/plugin/install.ts` + `reinstall.ts` — re-parse seams (NO LOGIC CHANGE)

**Analog:** `install.ts::hooksPhase` (707-740). Re-reads source, re-runs
`parseHooksConfig`, hands `parsed.value` to `writeHookConfig`. Because the partition
is pure/deterministic, the re-parse yields the identical subset — `parsed.value` is
now filtered with zero call-site change:
```typescript
const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate);   // value is now the subset
if (!parsed.ok) {
  throw new Error(`hooks.json re-parse failed: ${parsed.reason}`);
}
await writeHookConfig({ ..., hooksValue: parsed.value });           // stages subset
```
`reinstall.ts:1405-1418` is the mirror (same `parseHooksConfig` + `writeHookConfig`
pattern, confirmed at `reinstall.ts:1409,1414,1418`). Both are reference-only — they
inherit the filtered subset automatically. One watch-item: any destructure of
`parsed` that newly references `parsed.dropped` must compile; `parsed.value` usage
is unchanged.

## Shared Patterns

### Degradable-signal routing (the load-bearing cross-cut)
**Source:** `domain/resolver.ts::addUnsupportedKindNotes` (927-942) +
`decideResolution` (1010-1025).
**Apply to:** the new `applyHooksConfig` split.
**Rule:** a supportability failure pushes its kind into `partial.unsupported` and
MUST NOT increment the structural `dirty` accumulator. Structural failures (S1/S2/X1)
keep the `partial.notes.push(reason); return true` path. Structural precedence
(D-64-07) means a plugin with BOTH a structural defect and dropped hooks resolves
`unavailable`.

### Optional resolver-field spread (exactOptionalPropertyTypes)
**Source:** `domain/resolver.ts` `installable`/`unsupported` arms (281-319).
**Apply to:** the new `droppedHooks` field.
**Pattern:** `...(partial.X !== undefined && { X: partial.X })` in BOTH arms;
`emptyResolution` leaves the field absent, not `undefined`.

### Render-time closed-set marker
**Source:** `shared/probe-classifiers.ts::narrowUnsupportedKinds` (146-160);
closed set in `shared/notify.ts::REASONS` (89-130, `"unsupported hooks"` at 98).
**Apply to:** list / info / install-error aggregate marker. Single shared seam
guarantees cross-surface parity (RSTATE-05 / SURF-01). First-wins dedup keeps the
`{unsupported hooks}` marker single regardless of N drops (D-71-04). Add NO new
REASONS literal.

### `(unsupported)` suffix convention
**Source:** `shared/concerns/hooks.ts::appendHooksBlock` (91-109), lenient arm.
**Apply to:** the info enumerated dropped-handler detail (D-71-05), extended to
matcher-group granularity.

### Pure re-parse for staging (no threaded filtered config)
**Source:** `install.ts::hooksPhase` (707-740), `reinstall.ts:1405-1418`,
`info.ts::readHookSummaryEntries` (316-334) — all re-read source + re-run
`parseHooksConfig`.
**Apply to:** making `partitionHooks` PURE and TOTAL. Do NOT thread a separate
filtered config for materialization (anti-pattern, research lines 451-455). Only the
`dropped` enumeration is threaded, for the verdict + info detail.

## Test Migration Map

Analog test files (all exist, confirmed). Migrate "non-bucket-A => unavailable"
assertions to the partition behavior; KEEP all structural (S1/S2) assertions.

| Test File (absolute under `tests/`) | What changes |
|--------------------------------------|--------------|
| `tests/domain/components/hooks.test.ts` | `:297-:436` migrate `(a)/(b)/(c)/(d)` reject cases → assert `partitionHooks` `{supported, dropped}` with `cond` discriminant + subset omits bad group/event, keeps clean ones. KEEP `:152/:161/:170` (S1/S2 structural). |
| `tests/architecture/hooks-supportability.test.ts` | `:221` migrate the `(a)/(b)/(c)/(d)` debugDetail-prefix pin → `DroppedHook.cond` mapping. Table tests `:42-:209` stay. X1 table-desync arch test stays loud. |
| `tests/domain/resolver-strict.test.ts` | KEEP `:174/:192` structural → unavailable (PHOOK-03). ADD: non-bucket-A hooks + supported skills → `state==="unsupported"`, `hooksConfigPath` recorded, `unsupported` includes `"hooks"`, `supported` includes `"hooks"`. |
| `tests/orchestrators/plugin/info.test.ts` | `:1966/:2004` Stop→`(unsupported)` rows flip from BAIL/lenient to STRICT path; assert SAME `Stop (unsupported)` line + new `event(matcher) (unsupported)` for group drops. |
| `tests/architecture/catalog-uat.test.ts` | `:279/:283/:584/:857/:1223/:1775/:2388` AUDIT each `{unsupported hooks}` fixture's bytes (Q3): non-bucket-A/unsupported-matcher → row flips to `unsupported` / `force-installed`; genuinely malformed → stays `unavailable`. Reconcile byte forms. |
| `tests/shared/probe-classifiers.test.ts` | Add `"hooks" → "unsupported hooks"` case. |
| `tests/orchestrators/plugin/install.test.ts` | Extend `:2941` (LIFE-01 bridge write): partial-hook `--force` stages a STRICT-SUBSET `hooks.json` (dropped event/group absent) — the PHOOK-04 verification. |
| `tests/shared/notify-v2.test.ts`, `snm37-behavioral-smoke.test.ts`, `snm38-indent-ladder.test.ts` | Byte-exact reason + indent ladder; add partial-hook rows. |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | list/info parity for the aggregate `{unsupported hooks}` token. |

### New fixtures
**Analog:** `tests/fixtures/hookify-hooks.json` — bucket-A-only
(`PreToolUse`/`PostToolUse`/`UserPromptSubmit`), NO `Stop`, currently resolves fully.
Add variants mirroring this shape plus an unsupportable element (synthetic — the
real hookify/ralph-loop/security-guidance plugins are NOT in the local checkout,
research A2):
- (a) `Stop`-only → empty-subset edge case (Q2).
- (b) `PostToolUse(Edit)` + `Stop` → partial (event-level drop).
- (c) `PreToolUse(Edit)` + `PreToolUse(.*regex)` → intra-event matcher-group
  partition (D-71-02).

## No Analog Gap

None. Every changed file is an in-repo self-refactor or a sibling-mirror; the
`partial.unsupported` channel, the render classifier, the suffix renderer, and the
atomic-write bridge all pre-exist. The only genuinely NEW artifact is the
`DroppedHook` / `HooksPartition` type, which is local to `hooks.ts` and modeled on
the existing `SupportabilityResult` (667) discriminated union.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,shared,bridges,orchestrators}`, `tests/`.
**Files scanned:** 9 source modules read (targeted ranges), 1 fixture, test-path confirmation.
**Pattern extraction date:** 2026-06-28
