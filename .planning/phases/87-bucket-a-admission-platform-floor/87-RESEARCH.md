# Phase 87: Bucket-A admission & platform floor - Research

**Researched:** 2026-07-29
**Domain:** Hook-event admission (resolver/supportability gate) + peer-dependency floor bump; TypeScript strict, node:test, TypeBox
**Confidence:** HIGH (all findings verified against in-repo source with file:line evidence and against the npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-87-01 (FLOOR-01 semantics):** The floor is **declarative only** — bump `package.json` `peerDependencies` `@earendil-works/pi-coding-agent` to `>=0.80.4`. No runtime version detection, no load-time probe, no environment-conditional admission. The resolver's supportability verdict stays static per config bytes (byte-stable list/info outputs across Pi versions). Below the floor is off-contract, exactly like every prior floor bump. "Stay unsupported rather than degrading" means the floor-bump design was chosen INSTEAD of a runtime-degrade path — do not build capability detection.
- **D-87-02 (Doc surface):** **No doc edits in Phase 87.** package.json's peer range is the entire user-facing declaration surface. Do NOT touch `README.md` (§ Prerequisites keeps its unversioned Pi bullet) and do NOT touch `docs/hooks-compatibility.md` (its Stop/StopFailure reconcile is Phase 89, DOC-04). FLOOR-01's "user-facing docs" clause is satisfied by the peer-range declaration itself. **Success criterion 4's "user-facing docs" clause is deliberately overridden by this decision.**
- **D-87-03 (ADMIT-02 verification):** **Unit fixtures, offline.** Restore the Stop arm slimmed out of `tests/fixtures/hookify-hooks.json` and add a ralph-wiggum fixture (Stop-only `hooks.json`, derived from real wire bytes). Assert at the resolver partition level (plugins resolve available, no `{unsupported hooks}` drop for these events) and at the `plugin info` supported-events listing. Everything runs in `npm run check` — no network. Live resolution against the real marketplace stays a milestone-audit/UAT concern.

### Claude's Discretion
- Tuple placement of the two new events in `BUCKET_A_EVENTS` (append vs lifecycle order) — pick and document a deterministic registration order.
- `ClaudeHookEvent` lockstep widening in `shared/concerns/hooks.ts` (the `satisfies readonly ClaudeHookEvent[]` pin forces it at compile time).
- Doc-comment updates in `hook-events.ts` (the "eight v1.13-supported" prose, per-event derivation notes) and any other stale "8 events" comment the widening touches. **Comment policy applies: drop version-history narration ("v1.13"), keep decision/requirement IDs.**
- ralph-wiggum fixture derivation details (fetch real bytes vs transcribe from the marketplace repo — match the hookify fixture precedent).
- Whether `StopFailure`'s closed-set values need pipe-OR (`|`) splitting at the existing non-tool matcher validation seam — verify how the SessionStart closed-set check tokenizes matchers and keep StopFailure consistent (SFAIL-03's charset: letters, digits, `_`, `|`). **→ RESOLVED by this research — see Pitfall 3.**

### Deferred Ideas (OUT OF SCOPE)
- Dispatch wiring, payload translators, wire-protocol arms, event-router subscription — **Phase 88** (`agent_settled` dispatcher, Stop contract & StopFailure).
- `docs/hooks-compatibility.md` + `docs/research/claude-hooks-vs-pi-events.md` reconcile — **Phase 89** (DOC-04, DOC-05).
- Any user-facing doc mention of the new peer floor — explicitly declined for Phase 87 (D-87-02).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIT-01 | `BUCKET_A_EVENTS` grows 8→10 with per-event matcher dispositions — `Stop` takes the `NON_TOOL_EVENT_FIELDS` `null` sentinel (non-empty matcher → `no-matcher-support` drop); `StopFailure` takes the SFAIL-03 closed set. | Change surface fully mapped (hook-events.ts tables; hooks.ts `tryNonToolEventTrip`). Null-sentinel and closed-set arms already exist — reuse (§ Don't Hand-Roll). WR-04 desync guard requires StopFailure land BOTH `NON_TOOL_EVENT_FIELDS` + `NON_TOOL_EVENT_CLOSED_SETS` entries together (Pitfall 4). |
| ADMIT-02 | Plugins declaring `Stop`/`StopFailure` alongside supported events resolve `available`; `plugin info` lists both as supported; `ralph-wiggum` (Stop-only) + `hookify` (Stop + bucket-A) fixtures flip to fully available. | Admission auto-follows the tuple (`BUCKET_A_MEMBERS = new Set(BUCKET_A_EVENTS)`, hooks.ts:759). Info auto-lists via `projectHookSummaryEntries` once the union widens (info.ts:376). Fixture + test flip surface enumerated (§ Common Pitfalls, § Validation Architecture). |
| FLOOR-01 | Peer floor rises `>=0.74.0` → `>=0.80.4` in `package.json` `peerDependencies`. | Single-line change at `package.json:56` (only encoding site). **VERIFIED DISCREPANCY: `0.80.4` was never published; `agent_settled` first ships in `0.80.5`** — see Open Question 2 + Assumptions Log A1. |
</phase_requirements>

## Summary

Phase 87 is described as an "admission-only" change: grow `BUCKET_A_EVENTS` from 8 to 10, give `Stop` and `StopFailure` their matcher dispositions, and bump the peer floor. The admission mechanics are genuinely small and reuse machinery that already exists (`null`-sentinel drop for no-matcher events, closed-set gate for enumerated-value events, `BUCKET_A_MEMBERS` derived automatically from the tuple). The `plugin info` supported-listing also follows automatically once the `ClaudeHookEvent` union widens.

**However, the phase is NOT isolated from dispatch, because `BUCKET_A_EVENTS` serves double duty.** Its derived `BucketAEvent` type is the *compile-time-total* key for three dispatch tables (`Record<BucketAEvent, …>` in `dispatch-exec.ts` ×2 and `async-rewake/registry.ts` ×1) plus three total test tables in `hooks-translators.test.ts`. Widening the union to 10 makes all six a hard typecheck error demanding `Stop`/`StopFailure` entries — i.e. translators, which are Phase 88 work. This is the central planning decision (Open Question 1). It must be resolved before any code lands, because it determines whether Phase 87 stays admission-only (decouple the dispatch key domain) or drags translator scaffolding forward.

Two other verified findings materially shape the plan: (1) the peer floor `>=0.80.4` references a **version that was never published** — `agent_settled` first appears in `0.80.5` (published 2026-07-09, the date the authority doc misattributes to 0.80.4); and (2) the non-tool closed-set gate is **exact whole-string membership with no pipe-OR splitting**, so StopFailure must follow SessionStart's exact-match behavior (a `rate_limit|server_error` matcher drops, consistent with precedent).

**Primary recommendation:** Before planning tasks, resolve Open Question 1 (admission-vs-dispatch coupling) — recommended resolution: decouple the three compile-time-total dispatch tables from the widened union (make them `Partial<Record<BucketAEvent, …>>` with a defensive guard, or introduce a `DISPATCHABLE_EVENTS` subset) so Phase 87 grows the tuple without demanding Stop/StopFailure translators. Then: add the two matcher dispositions (reusing the existing null-sentinel + closed-set arms), bump the floor at `package.json:56` (verify the target version — recommend `>=0.80.5`), restore/add the two fixtures, re-point every test that uses `Stop` as its canonical "non-bucket-A event" to a still-unsupported event (e.g. `Notification`), and update the three "exactly 8" drift-guard assertions to 10.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hook-event admission (bucket-A membership) | Domain (`domain/components/hook-events.ts`, `hooks.ts`) | — | Pure supportability verdict; no I/O, no dispatch. `BUCKET_A_MEMBERS` set derives from the tuple. |
| Matcher disposition (null sentinel / closed set) | Domain (`hooks.ts::partitionHooks`) | — | Parse-time classification of matcher values into `DroppedHook` or supported subset. |
| `plugin info` supported-event listing | Orchestrator (`orchestrators/plugin/info.ts`) | Shared render (`shared/concerns/hooks.ts::appendHooksBlock`) | Re-parses hooks.json from disk, projects to `HookSummaryEntry[]`; renderer is a dumb formatter. |
| Peer-floor declaration | Package manifest (`package.json`) | — | Declarative dependency contract; no runtime code (D-87-01). |
| Dispatch (translators, routing, agent_settled) | Bridge (`bridges/hooks/*`) | — | **OUT OF SCOPE — Phase 88.** But coupled to the tuple via `Record<BucketAEvent>` totality (Open Question 1). |

## Standard Stack

No new runtime or dev dependencies are introduced by this phase. The only dependency change is a peer-floor bump.

### Core (unchanged, in use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` (peer) | floor `>=0.74.0` → `>=0.80.4` (see Open Q2) | Extension host API; `agent_settled` event (consumed in Phase 88) | Required peer; floor bump is the entire FLOOR-01 surface |
| `typebox` | `^1.1.38` (dev) / `*` (peer) | hooks.json schema validation | Already the hooks parser's validator |
| `node:test` | bundled (Node ≥20.19) | Test framework | Repo standard; all suites use it |

### Installation
No `npm install` of new packages. FLOOR-01 is a single edited line in `package.json` `peerDependencies`. The dev dependency `@earendil-works/pi-coding-agent` is already `^0.82.1` (registry latest `0.83.0`), which satisfies any `>=0.80.x` floor, so `npm run check` runs against a compliant version with no lockfile churn required for the floor bump itself.

**Version verification (VERIFIED — npm registry, queried 2026-07-29):**
- `@earendil-works/pi-coding-agent` published versions include `0.80.1, 0.80.2, 0.80.3, 0.80.5 … 0.83.0`. **`0.80.4` is NOT published** (gap between 0.80.3 on 2026-06-30 and 0.80.5 on 2026-07-09). [VERIFIED: npm registry]
- Tarball inspection: `agent_settled` type references are **absent in 0.80.3** and **present (4 refs) in 0.80.5** (`package/dist/core/extensions/types.d.ts`). The first published version exposing `agent_settled` is **`0.80.5`**. [VERIFIED: npm registry tarball diff]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@earendil-works/pi-coding-agent` | npm | established (0.83.0 latest) | n/a (scoped host peer) | github.com/badlogic/pi-mono | OK | Pre-existing peer; only floor bumped |

No new packages are installed in this phase. The peer dependency already exists in the manifest and node_modules tree; the change is a semver-range floor. No SLOP/SUS packages.

## Architecture Patterns

### System Data Flow (admission path — the observable outcome of this phase)

```
plugin hooks.json  (Stop / StopFailure declared alongside bucket-A events)
        │
        ▼
parseHooksConfig (domain/components/hooks.ts)
        │  JSON.parse → HOOKS_VALIDATOR.Check (structural gate, {ok:false} on failure)
        ▼
partitionHooks (domain/components/hooks.ts)
        │  per event: BUCKET_A_MEMBERS.has(event)?  ── no ──▶ DroppedHook{kind:"event"}
        │  per group matcher:
        │     TOOL_EVENT_MEMBERS.has(event)? ──▶ tryToolEventTrip (regex/unmapped-tool)
        │     else non-empty matcher       ──▶ tryNonToolEventTrip
        │                                        ├─ NON_TOOL_EVENT_FIELDS[event]===null ▶ drop "no-matcher-support"   (Stop)
        │                                        └─ NON_TOOL_EVENT_CLOSED_SETS[event].has(raw)? no ▶ drop "closed-set" (StopFailure)
        ▼
{ supported: HooksConfig, dropped: DroppedHook[] }
        │
        ├──▶ resolver.ts: dropped empty ▶ state "available"; else "partially-available" {unsupported hooks}
        │                 supported non-empty ▶ record hooksConfigPath
        │
        └──▶ info.ts: readHookSummaryEntries → projectHookSummaryEntries
                       non-tool event ▶ bare "<event>"  (Stop, StopFailure list as supported)
```

### Recommended change footprint

```
extensions/pi-claude-marketplace/
├── domain/components/hook-events.ts     # ADMIT-01: +Stop,+StopFailure in BUCKET_A_EVENTS;
│                                          #   NON_TOOL_EVENT_FIELDS +Stop:null +StopFailure:<field>;
│                                          #   NON_TOOL_EVENT_CLOSED_SETS +StopFailure:Set(10 values)
├── shared/concerns/hooks.ts             # ClaudeHookEvent union += "Stop" | "StopFailure" (lockstep pin)
├── bridges/hooks/dispatch-exec.ts       # Open Q1: TRANSLATORS + REQUIRED_EVENT_FIELDS totality decision
├── bridges/hooks/async-rewake/registry.ts # Open Q1: TRANSLATORS totality decision
└── package.json                          # FLOOR-01: peerDependencies floor bump (line 56)

tests/
├── fixtures/hookify-hooks.json           # restore the slimmed Stop arm (D-87-03)
├── fixtures/ralph-wiggum-*.json (new)    # Stop-only real-wire-bytes fixture (D-87-03)
├── architecture/hooks-supportability.test.ts   # "exactly 8" → 10; +Stop/StopFailure disposition pins
├── architecture/hooks-translators.test.ts      # Open Q1: length===8, EVENT_TO_KEBAB/FIXTURES/EXPECTED_JSON totality
├── domain/components/hooks.test.ts             # re-point Stop-as-non-bucket-A examples
├── domain/resolver-strict.test.ts              # re-point Stop-as-drop examples; add Stop/StopFailure available cases
└── orchestrators/plugin/info.test.ts           # INFO-05 re-point; add Stop/StopFailure supported-listing
```

### Pattern 1: Null-sentinel no-matcher disposition (Stop)
**What:** An event with no upstream matcher support gets `NON_TOOL_EVENT_FIELDS[event] = null` and is *omitted* from `NON_TOOL_EVENT_CLOSED_SETS`.
**When to use:** `Stop` (exactly like `UserPromptSubmit`).
**Behavior:** `tryNonToolEventTrip` returns `{kind:"drop", cond:"no-matcher-support"}` for any non-empty matcher; match-all (`""`/`"*"`) short-circuits to admissible *before* this function is reached (`tryMatcherTrip`, hooks.ts:849).
```typescript
// Source: extensions/pi-claude-marketplace/domain/components/hooks.ts:803-806
const fieldName = NON_TOOL_EVENT_FIELDS[event];
if (fieldName === null) {
  return { kind: "drop", cond: "no-matcher-support" };
}
```

### Pattern 2: Closed-set exact-match disposition (StopFailure)
**What:** An event whose matcher targets an enumerated field gets `NON_TOOL_EVENT_FIELDS[event] = "<claude-field>"` (non-null) AND a `NON_TOOL_EVENT_CLOSED_SETS[event] = new Set([...])`. Both MUST land together (WR-04 desync guard).
**When to use:** `StopFailure` (exactly like `SessionStart`).
**Behavior:** exact whole-string membership — `!closedSet.has(rawMatcher)` → `{kind:"drop", cond:"closed-set"}`. **No pipe-OR splitting** (see Pitfall 3).
```typescript
// Source: extensions/pi-claude-marketplace/domain/components/hooks.ts:809-830
const closedSet = NON_TOOL_EVENT_CLOSED_SETS[event];
if (closedSet === undefined) {
  return { kind: "structural", detail: `(c) missing closed-set entry for non-tool event: ${event}` };
}
if (!closedSet.has(rawMatcher)) {
  return { kind: "drop", cond: "closed-set" };
}
```

### Anti-Patterns to Avoid
- **Adding pipe-OR tokenization to the non-tool closed-set gate.** The tool-event path splits on `|` (`parseMatcher`), but the non-tool path does exact whole-string `.has()`. Adding splitting for StopFailure would silently change SessionStart's behavior too and break its architecture pins. Keep StopFailure exact-match, consistent with SessionStart.
- **Building runtime version/capability detection for the floor.** D-87-01 forbids it — the floor is declarative only.
- **Editing README.md or hooks-compatibility.md.** D-87-02 forbids it; doc reconcile is Phase 89.
- **Adding Stop/StopFailure translators/dispatch in Phase 87.** That is Phase 88 (STOP-*/SFAIL-*). If Open Question 1 is resolved by "decouple," the dispatch tables must NOT gain real translators here.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| No-matcher-support drop for Stop | New drop path / new `cond` | Existing `null`-sentinel arm (`tryNonToolEventTrip`, hooks.ts:805) | `UserPromptSubmit` precedent; `cond:"no-matcher-support"` + `DroppedHook{kind:"group"}` already wired through resolver + info |
| Closed-set validation for StopFailure | Custom matcher parser | Existing `NON_TOOL_EVENT_CLOSED_SETS` gate (`tryNonToolEventTrip`, hooks.ts:809) | `SessionStart` precedent; exact-match membership already integrated |
| Admission membership | New "admitted events" set | `BUCKET_A_MEMBERS = new Set(BUCKET_A_EVENTS)` (hooks.ts:759) | Derives from the tuple automatically once it grows |
| info supported-listing | New projector | `projectHookSummaryEntries` (info.ts:376) + `appendHooksBlock` (concerns/hooks.ts:100) | Auto-lists non-tool events as bare `<event>` once the union widens |
| Compile-time totality enforcement | Manual audits | `Record<NonToolEvent, …>` for `NON_TOOL_EVENT_FIELDS` | Adding a non-tool event without a disposition is already a typecheck error at the table literal (hook-events.ts:109) |

**Key insight:** ADMIT-01/02 is almost entirely a *table-widening* exercise on machinery that already models both dispositions. The real engineering work is not the disposition logic — it is (a) resolving the dispatch-key coupling (Open Q1) and (b) the test/fixture refactor where `Stop` is currently used as the canonical "unsupported event" example.

## Common Pitfalls

### Pitfall 1: `BUCKET_A_EVENTS` is the compile-time-total key for dispatch machinery (THE crux)
**What goes wrong:** Growing the tuple to 10 breaks the typecheck at six `Record<BucketAEvent, …>` / `length===8` sites that demand `Stop`/`StopFailure` entries — translators that belong to Phase 88.
**Why it happens:** `BucketAEvent = (typeof BUCKET_A_EVENTS)[number]` (hook-events.ts:60) is reused as the dispatch-table key domain, not just the admission set.
**Compile-time-total consumers (typecheck errors on widening):**
- `bridges/hooks/dispatch-exec.ts:108` — `TRANSLATORS: Record<BucketAEvent, …>`
- `bridges/hooks/dispatch-exec.ts:221` — `REQUIRED_EVENT_FIELDS: Record<BucketAEvent, …>`
- `bridges/hooks/async-rewake/registry.ts:96` — `TRANSLATORS: Record<BucketAEvent, …>`
- `tests/architecture/hooks-translators.test.ts:69,104,146` — `EVENT_TO_KEBAB`, `EVENT_FIXTURES`, `EXPECTED_JSON` (all `Record<BucketAEvent>`)
- `domain/components/hook-events.ts:109` — `NON_TOOL_EVENT_FIELDS: Record<NonToolEvent, …>` (this one is *intended* — Stop/StopFailure are non-tool, so this correctly demands their dispositions)
**Runtime-total consumers (test failures on widening):**
- `tests/architecture/hooks-translators.test.ts:176` — `assert.equal(BUCKET_A_EVENTS.length, 8)` **and** the Block-A loop dynamically `import()`s `payloads/<kebab>.ts` for every event (would try to import nonexistent `stop.ts`).
- `tests/architecture/hooks-supportability.test.ts:42` — asserts the exact 8-tuple in order.
**How to avoid:** Resolve Open Question 1 first. Recommended: decouple the dispatch key domain from the admission tuple (Partial tables + defensive guard, or a `DISPATCHABLE_EVENTS` subset) so Stop/StopFailure are admitted without demanding translators.
**Warning signs:** `tsc --noEmit` errors "Property 'Stop' is missing in type" at the `Record<BucketAEvent>` literals.

### Pitfall 2: `agent_settled` was NOT introduced in `0.80.4` (phantom version)
**What goes wrong:** Setting the floor to `>=0.80.4` references a version that was never published; a reviewer verifying the floor against the registry finds no such release.
**Why it happens:** The authority doc (`issue-103-…md:8,21,37`) states "added 0.80.4 (2026-07-09)," but the registry shows 0.80.4 was skipped; **0.80.5** is the 2026-07-09 release and the first to expose `agent_settled`.
**How to avoid:** `>=0.80.4` is still *semver-valid* (resolves to 0.80.5+), so it functionally works — but recommend the accurate `>=0.80.5`. This touches the locked FLOOR-01/D-87-01 value → surface to the planner/user (Open Question 2), don't silently change.
**Warning signs:** `npm view @earendil-works/pi-coding-agent@0.80.4 version` → E404.

### Pitfall 3: The non-tool closed-set gate does NOT split on `|`
**What goes wrong:** Assuming `StopFailure` matcher `"rate_limit|server_error"` is admissible because SFAIL-03's charset lists `|`. It is not — the gate is exact whole-string `closedSet.has(rawMatcher)` (hooks.ts:826). A compound `|` matcher drops as `cond:"closed-set"`.
**Why it happens:** Only the *tool-event* path (`parseMatcher`, hooks.ts:686) tokenizes pipe-OR. The non-tool path (`tryNonToolEventTrip`) never calls `parseMatcher` and never splits. SessionStart (`Set(["startup","resume"])`) has the same behavior: `"startup|resume"` would drop today.
**How to avoid:** Give `StopFailure` a flat `Set` of the 10 exact values; a single value matches, anything else (including `|` compounds) drops. This is the "keep StopFailure consistent with SessionStart" resolution the CONTEXT discretion item asked for. The SFAIL-03 charset note describes what upstream *permits authoring*, not what the Pi gate tokenizes; document that `|` compounds drop (contract-legal per strict-supportability D-58-06).
**Warning signs:** A test expecting `"rate_limit|server_error"` to resolve available.

### Pitfall 4: WR-04 table-desync guard — StopFailure needs BOTH tables together
**What goes wrong:** Adding `StopFailure` to `NON_TOOL_EVENT_FIELDS` with a non-null field name but forgetting the matching `NON_TOOL_EVENT_CLOSED_SETS` entry throws `HooksTableDesyncError` (structural `{ok:false}` → resolves `unavailable`).
**Why it happens:** `tryNonToolEventTrip` (hooks.ts:809-824) treats "field declared, closed-set missing" as a programmer bug (X1).
**How to avoid:** Land both `NON_TOOL_EVENT_FIELDS.StopFailure = "<field>"` and `NON_TOOL_EVENT_CLOSED_SETS.StopFailure = new Set([...10 values])` in the same change. `Stop` (null sentinel) is *omitted* from the closed-set table like `UserPromptSubmit` — do NOT add a Stop closed-set entry.
**Note:** The architecture test `tests/architecture/hooks-supportability.test.ts` pins the two tables in sync; it will red-fail if they disagree.

### Pitfall 5: `Stop` is the codebase's canonical "non-bucket-A event" test example
**What goes wrong:** Many tests and two fixtures use `Stop` precisely *because* it was unsupported. After promotion they either flip behavior (now available) or become misleading. Missing one leaves a green test asserting stale behavior.
**Sites that flip / must be re-pointed (VERIFIED):**
- `tests/domain/resolver-strict.test.ts:251` (partial-with-Stop-drop), `:301` (Stop-only empty-subset → unavailable) — both flip to available; re-point to a still-unsupported event (e.g. `Notification`, `SubagentStop`).
- `tests/domain/components/hooks.test.ts:322,436,473,653,666-667` and the "REMOVED because Stop is not bucket-A" block (`:604-610,630`) — re-point.
- `tests/orchestrators/plugin/info.test.ts:2131+` (`INFO-05` "lenient reader lists `Stop (unsupported)`") — flips; the lenient-reader path needs a genuinely non-bucket-A event to still exercise `(unsupported)`.
- `tests/orchestrators/plugin/install.test.ts:2618` ("dropped Stop event must NOT be staged") — Stop now *is* staged; re-point.
- `tests/architecture/hooks-supportability.test.ts:251` (`{kind:"event", event:"Stop"}`) — re-point.
- `tests/shared/notify-v2.test.ts:3852-3871` — pure renderer unit test with a hand-set `supported:false` lenient `Stop` entry; still passes, but the example is now misleading — recommend swapping to a non-bucket-A event for clarity.
- Fixtures `tests/fixtures/hooks-stop-only.json` and `tests/fixtures/hooks-posttooluse-and-stop.json` describe Stop as "a single non-bucket-A Stop event" — these become wrong; either re-point to another event or repurpose (the *new* fixtures exercise Stop-as-supported).
**How to avoid:** Pick ONE still-deferred event as the new canonical unsupported example (v2 requirements list: `SubagentStart/Stop`, `FileChanged`, `CwdChanged`, `PostToolBatch`, `UserPromptExpansion`, `Notification`). `Notification` reads clearly.

### Pitfall 6: `pi.on` subscription pin is NOT a Phase 87 concern (avoid over-updating)
**What goes wrong:** Updating `tests/architecture/hooks-dispatch.test.ts:200-219` (asserts exactly 8 `pi.on` subscriptions) to add `agent_settled`.
**Why it happens:** Confusing the *Pi-event* subscription set (session_start, tool_call, …) with the *Claude-event* admission set. Phase 87 adds NO Pi subscription — `agent_settled` is subscribed in Phase 88.
**How to avoid:** Leave the 8 `pi.on` assertion untouched. `DISP-02` (`hooks-dispatch.test.ts:244`) compares the routing keyset to `BUCKET_A_EVENTS` *dynamically*, so it stays green when the tuple grows (the pre-seed loop at event-router.ts:406 creates the two new empty buckets); only its title mentioning "8 buckets" is cosmetically stale.

## Runtime State Inventory

This phase renames nothing and migrates no stored data — it widens a closed set and bumps a manifest floor. Explicit per-category verification:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore keys on event names; hooks are re-parsed from disk at resolve/info time (info.ts:462). | None |
| Live service config | None — no external service holds the bucket-A list. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None — floor bump touches `package.json` only; no env var encodes the peer version. | None |
| Build artifacts / installed packages | Installed peer in `node_modules` is `0.79.10` (stale vs devDep `^0.82.1`; consistent with the known global/stale-peer note). `npm run check` in CI runs against the resolved tree. **Verify the dev tree resolves ≥0.80.5 locally** or two integration tests that resolve a peer may behave unexpectedly (see Environment Availability). | Ensure `npm ci`/install brings the dev tree to a version satisfying the new floor before running `npm run check`. |

## Code Examples

### Widen the admission tuple (ADMIT-01) — deterministic order
```typescript
// Source: extensions/pi-claude-marketplace/domain/components/hook-events.ts:36-45 (pattern)
// Discretion D-87: pick placement. Lifecycle order suggests appending the
// turn-boundary events after SessionEnd (session lifecycle already ends the list):
export const BUCKET_A_EVENTS = [
  "SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse",
  "PostToolUseFailure", "PreCompact", "PostCompact", "SessionEnd",
  "Stop", "StopFailure",
] as const satisfies readonly ClaudeHookEvent[];
```

### Dispositions (ADMIT-01)
```typescript
// Source: hook-events.ts:109 + :151 (pattern). Stop = null sentinel (omit from closed sets);
// StopFailure = enumerated field + 10-value exact-match set (both tables together, WR-04).
export const NON_TOOL_EVENT_FIELDS = {
  SessionStart: "source", SessionEnd: "reason",
  PreCompact: "trigger", PostCompact: "trigger",
  UserPromptSubmit: null,
  Stop: null,                 // no upstream matcher support (issue #103)
  StopFailure: "error",       // matcher targets the classified error type (verify exact Claude field name)
} as const;

export const NON_TOOL_EVENT_CLOSED_SETS = {
  SessionStart: new Set(["startup", "resume"]),
  SessionEnd: new Set<string>([]), PreCompact: new Set<string>([]), PostCompact: new Set<string>([]),
  // Stop omitted (null sentinel is the disposition).
  StopFailure: new Set([
    "rate_limit", "overloaded", "authentication_failed", "oauth_org_not_allowed",
    "billing_error", "invalid_request", "model_not_found", "server_error",
    "max_output_tokens", "unknown",
  ]),
};
```
> **Verify the Claude-side field name** for the StopFailure matcher (`"error"` is inferred from the authority doc's "error type … used for matcher filtering"; confirm against <https://code.claude.com/docs/en/hooks>). The field name is used only for documentation/derivation here — the gate compares the raw matcher string to the closed set regardless of the field-name label — but keep it accurate for the derivation comment. [ASSUMED — field-name label]

### Lockstep union widening (Claude's Discretion)
```typescript
// Source: shared/concerns/hooks.ts:58-66 — add the two literals or tsc breaks
// at the `satisfies readonly ClaudeHookEvent[]` pin in hook-events.ts:45.
export type ClaudeHookEvent =
  | "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse"
  | "PostToolUseFailure" | "PreCompact" | "PostCompact" | "SessionEnd"
  | "Stop" | "StopFailure";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stop/StopFailure deferred (PAYL-V2-04/06) | Promoted to bucket-A admission | This milestone (v1.16) | ralph-wiggum + hookify flip to fully available; first-party 12/13 |
| Fire-point `agent_end` (issue #103 proposal) | `agent_settled` (Phase 88) | Pi 0.80.5 (2026-07-09) | Not this phase; floor exists to guarantee the primitive |

**Deprecated/outdated:**
- The authority doc's "`agent_settled` added 0.80.4" — off by one; actual is **0.80.5** (0.80.4 never published). [VERIFIED: npm registry]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Floor should target `0.80.5` (first published version exposing `agent_settled`); the locked `0.80.4` is a phantom version. | FLOOR-01 / Open Q2 | Low functional risk (`>=0.80.4` resolves to 0.80.5+ anyway), but a reviewer verifying against the registry finds the referenced version does not exist. Requires user confirmation whether to correct the locked value. |
| A2 | `StopFailure`'s Claude-side matcher field label is `"error"`. | Code Examples | Low — the label is only used in the derivation comment; the gate matches the raw string against the closed set regardless. Confirm against upstream hooks docs. |
| A3 | The new canonical "non-bucket-A event" for re-pointed tests is a still-deferred event such as `Notification`. | Pitfall 5 | Low — any genuinely non-bucket-A token works; pick one and use it consistently. |

## Open Questions (RESOLVED)

> All three questions were put to the user during planning and resolved as
> locked decisions in 87-CONTEXT.md: Q1 → **D-87-04** (decouple — `DISPATCHABLE_EVENTS`
> subset keys the dispatch tables), Q2 → **D-87-05** (floor is `>=0.80.5`),
> Q3 → **D-87-06** (defer output-catalog example to Phase 89 unless a test forces
> the lockstep edit).

1. **RESOLVED (D-87-04, option a — decouple).** Admission-vs-dispatch coupling — how is `BucketAEvent` totality reconciled with "dispatch not wired"?
   - What we know: `BUCKET_A_EVENTS`→`BucketAEvent` keys three production `Record<BucketAEvent>` dispatch tables (dispatch-exec.ts:108,221; async-rewake/registry.ts:96) and three test tables (hooks-translators.test.ts:69,104,146). Widening to 10 makes all six a typecheck error demanding Stop/StopFailure translators (Phase 88 work). The admission gate and info listing, by contrast, follow the tuple automatically with no new code.
   - What's unclear: whether the phase should (a) **decouple** the dispatch key domain from the admission tuple (make the three tables `Partial<Record<BucketAEvent, …>>` + a defensive `undefined` guard in `buildPayload`, or introduce a `DISPATCHABLE_EVENTS` subset the tables key on), keeping Phase 87 strictly admission-only; or (b) add real Stop/StopFailure translators now (pulls STOP-02/SFAIL-02 payload design into Phase 87, contradicting the phase boundary); or (c) keep the tables total but stub the two translators with placeholder round-trip fixtures (still Phase-88-shaped work, and `hooks-translators.test.ts` Block B byte-asserts round-trip JSON per event).
   - Recommendation: **Option (a) — decouple.** It is the only option that honors both "grow BUCKET_A_EVENTS 8→10" (locked in CONTEXT) and "dispatch not yet wired (Phase 88)." The dormant Stop/StopFailure routing buckets pre-seeded at event-router.ts:406 are harmless (no Pi event routes to them until Phase 88 subscribes `agent_settled`). Verify with the planner/user before task breakdown, because it changes dispatch-table types the plan-checker will inspect.

2. **RESOLVED (D-87-05 — `>=0.80.5`).** Floor version: `>=0.80.4` (locked) vs `>=0.80.5` (verified accurate)?
   - What we know: 0.80.4 was never published; 0.80.5 (2026-07-09) is the first version exposing `agent_settled`. `>=0.80.4` is semver-valid and resolves to 0.80.5+.
   - What's unclear: whether to honor the locked FLOOR-01/D-87-01 literal (`0.80.4`) or correct it to `0.80.5`.
   - Recommendation: bump to `>=0.80.5` and note the correction; if the user insists on the locked literal, `>=0.80.4` still works functionally. Surface the discrepancy explicitly (it touches a locked decision).

3. **RESOLVED (D-87-06 — defer to Phase 89 unless a test forces it).** `docs/output-catalog.md:390` uses `Stop` as its non-bucket-A example — fix now or defer to Phase 89?
   - What we know: D-87-02 forbids editing README.md and hooks-compatibility.md specifically; output-catalog.md is not named. Line 390 calls Stop "a non-bucket-A event," which becomes factually wrong. `tests/architecture/catalog-uat.test.ts` exists but does not appear to byte-assert this specific line against Stop.
   - Recommendation: verify whether catalog-uat byte-locks that phrase; if not, either swap the example event in-line (a comment-scoped, illustrative edit, not a compatibility claim) or defer to the Phase 89 doc reconcile. Lean toward deferring to Phase 89 to keep Phase 87 doc-clean per D-87-02's spirit, unless the stale example breaks a test.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@earendil-works/pi-coding-agent` (dev tree, for `npm run check`) | typecheck + tests | ✓ (devDep `^0.82.1`; node_modules currently `0.79.10` stale) | registry latest `0.83.0`; ≥0.80.5 satisfies new floor | Run `npm ci` to refresh the tree before `check` |
| npm registry (verification only) | Floor-version verification during research | ✓ | — | — |
| Network | Runtime admission/info | ✗ NOT required | — | Admission + info are fs-only (NFR-5); tests are offline (D-87-03) |

**Missing dependencies with no fallback:** none.
**Watch item:** two integration tests (`tests/integration/skill-path-resolution.test.ts`, `provenance-invisibility.test.ts`) reference `pi-coding-agent`; the known pi-subagents-style precedent is that integration tests resolving a global/stale peer can fail *locally* on version mismatch (environment, not a branch regression). The floor bump itself changes only the declared range — confirm the local dev tree resolves ≥0.80.5 so these do not report spurious failures during `npm run check`.

## Validation Architecture

nyquist_validation is not disabled in config (treated as enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node ≥20.19) |
| Config file | none (glob in `package.json` scripts) |
| Quick run command | `node --test "tests/domain/components/hooks.test.ts" "tests/architecture/hooks-supportability.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIT-01 | `BUCKET_A_EVENTS` == 10 in locked order; Stop null-sentinel; StopFailure 10-value closed set; tables in sync (WR-04) | unit/arch | `node --test tests/architecture/hooks-supportability.test.ts` | ✅ (update: 8→10, add Stop/StopFailure disposition pins) |
| ADMIT-01 | Stop non-empty matcher → `no-matcher-support` drop; StopFailure out-of-vocab matcher → `closed-set` drop; in-vocab → admitted | unit | `node --test tests/domain/components/hooks.test.ts` | ✅ (add Stop/StopFailure cases) |
| ADMIT-02 | hookify (Stop + bucket-A) resolves available; ralph-wiggum (Stop-only) resolves available; both list Stop/StopFailure supported in info | unit | `node --test tests/domain/resolver-strict.test.ts tests/orchestrators/plugin/info.test.ts` | ✅ (add available-flip cases; re-point Stop-as-unsupported examples) |
| ADMIT-02 | Fixtures: hookify Stop arm restored; ralph-wiggum fixture added (real wire bytes) | fixture | (consumed by the above) | ❌ Wave 0 — restore + add fixtures |
| FLOOR-01 | `package.json` peer floor == `>=0.80.4` (or `>=0.80.5` per Open Q2) | manual/inspection | `grep pi-coding-agent package.json` | n/a — no test pins the floor value (confirmed) |

### Sampling Rate
- **Per task commit:** quick run of the touched hooks/admission suites.
- **Per wave merge:** `npm run test` (unit + arch).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/fixtures/hookify-hooks.json` — restore the slimmed Stop arm (D-87-03).
- [ ] `tests/fixtures/ralph-wiggum-*.json` — new Stop-only fixture from real wire bytes (match hookify derivation provenance; document source in a fixture `description`).
- [ ] Re-point every `Stop`-as-non-bucket-A test to a still-deferred event (Pitfall 5 site list).
- [ ] Update the three "exactly 8" drift guards to 10 (hooks-supportability.test.ts:42, hooks-translators.test.ts:176 — the latter gated on Open Q1's resolution).

## Security Domain

`security_enforcement` is not disabled in config (treated as enabled). This phase adds no new external input surface, no auth, no crypto, no network. Assessment:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (indirect) | The widened closed set is *more* restrictive than accepting arbitrary matchers; StopFailure's exact-match gate rejects out-of-vocabulary values (D-58-06 strict-supportability). No new untrusted parse surface — hooks.json was already parsed. |
| V2/V3/V4 (auth/session/access) | no | Not touched. |
| V6 Cryptography | no | Not touched. |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/oversized matcher in hooks.json | Tampering / DoS | Existing schema validation + exact-set membership; regex catastrophic-backtracking already sidestepped in `parseMatcher` (S5852). No change needed. |

No new threats introduced. The floor bump reduces the risk of admitting events against a Pi runtime lacking the primitive (declarative gate, D-87-01).

## Sources

### Primary (HIGH confidence)
- In-repo source (VERIFIED by direct read): `domain/components/hook-events.ts`, `domain/components/hooks.ts`, `shared/concerns/hooks.ts`, `orchestrators/plugin/info.ts`, `bridges/hooks/event-router.ts`, `bridges/hooks/dispatch-exec.ts`, `bridges/hooks/async-rewake/registry.ts`, `package.json`, and the test suites under `tests/architecture/`, `tests/domain/`, `tests/orchestrators/plugin/`, `tests/shared/`.
- npm registry (VERIFIED, queried 2026-07-29): `@earendil-works/pi-coding-agent` version list + publish times; tarball type-def diff confirming `agent_settled` absent in 0.80.3, present in 0.80.5; `0.80.4` returns E404.
- `docs/research/issue-103-stop-stopfailure-promotion.md` — milestone design authority (matcher dispositions, closed-set vocabulary, floor rationale). Note the 0.80.4 attribution discrepancy vs the registry.
- `.planning/REQUIREMENTS.md` — ADMIT-01, ADMIT-02, FLOOR-01, SFAIL-03.

### Secondary (MEDIUM confidence)
- `.claude/rules/typescript-comments.md` — comment policy (drop version-history narration; keep D-/requirement IDs).
- Upstream contract <https://code.claude.com/docs/en/hooks> (cited by CONTEXT, verified 2026-07-28 there; not re-fetched this session — the StopFailure matcher field-name label A2 should be reconfirmed against it).

### Tertiary (LOW confidence)
- None load-bearing.

## Metadata

**Confidence breakdown:**
- Standard stack / change surface: HIGH — every edit site located with file:line evidence.
- Admission mechanics: HIGH — dispositions reuse verified existing arms.
- Dispatch coupling (Open Q1): HIGH on the finding (six total-key sites confirmed), the *resolution* is a planner decision.
- Floor version (Open Q2): HIGH — registry + tarball diff.
- Pitfalls: HIGH — each backed by a specific source line.

**Research date:** 2026-07-29
**Valid until:** ~2026-08-28 (stable; the registry version facts are permanent, the coupling is structural)
