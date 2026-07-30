# Phase 87: Bucket-A admission & platform floor - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 6 source + 6 test/fixture surfaces
**Analogs found:** 12 / 12 (this phase is a table-widening exercise — every new element has an in-file sibling precedent)

## File Classification

| File | Change | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `domain/components/hook-events.ts` | modified | config / closed-set tables | transform (parse-time classify) | its own `SessionStart`/`UserPromptSubmit` rows (in-file) | exact (self-analog) |
| `shared/concerns/hooks.ts` | modified | config / type union | transform | its own 8 `ClaudeHookEvent` literals (in-file) | exact (self-analog) |
| `bridges/hooks/dispatch-exec.ts` | modified (decouple only) | bridge / dispatch table | request-response | its own `Record<BucketAEvent>` tables (in-file) | exact (self-analog) |
| `bridges/hooks/async-rewake/registry.ts` | modified (decouple only) | bridge / dispatch table | event-driven | `dispatch-exec.ts` `TRANSLATORS` | exact |
| `package.json` | modified | config / manifest | n/a | prior floor bump (`>=0.74.0`) | exact |
| `tests/fixtures/hookify-hooks.json` | modified (restore Stop arm) | fixture | n/a | its own existing arms | exact |
| `tests/fixtures/ralph-wiggum-*.json` | new | fixture | n/a | `hookify-hooks.json` | exact |
| `tests/architecture/hooks-supportability.test.ts` | modified | test | n/a | its own 8-event pins | exact |
| `tests/architecture/hooks-translators.test.ts` | modified (Open Q1) | test | n/a | its own `Record<BucketAEvent>` tables | exact |
| `tests/domain/components/hooks.test.ts` | modified (re-point) | test | n/a | SessionStart closed-set cases | exact |
| `tests/domain/resolver-strict.test.ts` | modified (re-point + flip) | test | n/a | existing available/drop cases | exact |
| `tests/orchestrators/plugin/info.test.ts` | modified (re-point + list) | test | n/a | existing supported-listing cases | exact |

## Pattern Assignments

### `domain/components/hook-events.ts` (config, transform) — ADMIT-01

**Analog:** in-file siblings. `Stop` copies `UserPromptSubmit` (null sentinel); `StopFailure` copies `SessionStart` (non-null field + closed set).

**Tuple widening** (source lines 36-45). Append after `SessionEnd` for a deterministic lifecycle-tail order (turn-boundary events last):
```typescript
export const BUCKET_A_EVENTS = [
  "SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse",
  "PostToolUseFailure", "PreCompact", "PostCompact", "SessionEnd",
  "Stop", "StopFailure",
] as const satisfies readonly ClaudeHookEvent[];
```

**Null-sentinel disposition** — copy the `UserPromptSubmit` row (line 114) for `Stop`:
```typescript
export const NON_TOOL_EVENT_FIELDS: Readonly<Record<NonToolEvent, string | null>> = {
  SessionStart: "source", SessionEnd: "reason",
  PreCompact: "trigger", PostCompact: "trigger",
  UserPromptSubmit: null,
  Stop: null,           // no upstream matcher support (issue #103)
  StopFailure: "error", // matcher targets the classified error type
};
```
Note: `NON_TOOL_EVENT_FIELDS` is TOTAL over `NonToolEvent` (line 109 `Record<NonToolEvent, ...>`) — omitting `Stop`/`StopFailure` is a compile error. This is the intended forcing function.

**Closed-set disposition** — copy the `SessionStart` row (line 157) for `StopFailure`; `Stop` is OMITTED exactly like `UserPromptSubmit` (lines 166-167):
```typescript
export const NON_TOOL_EVENT_CLOSED_SETS: Readonly<
  Partial<Record<BucketAEvent, ReadonlySet<string>>>
> = {
  SessionStart: new Set(["startup", "resume"]),
  SessionEnd: new Set<string>([]),
  PreCompact: new Set<string>([]), PostCompact: new Set<string>([]),
  // Stop omitted — null sentinel is its disposition (UserPromptSubmit precedent).
  StopFailure: new Set([
    "rate_limit", "overloaded", "authentication_failed", "oauth_org_not_allowed",
    "billing_error", "invalid_request", "model_not_found", "server_error",
    "max_output_tokens", "unknown",
  ]),
};
```

**WR-04 desync guard (Pitfall):** `StopFailure` MUST land in BOTH `NON_TOOL_EVENT_FIELDS` (non-null) and `NON_TOOL_EVENT_CLOSED_SETS` in the same edit — a non-null field with no closed-set entry trips the `HooksTableDesyncError` structural throw (`hooks.ts:809-824`).

**Comment policy:** Per `.claude/rules/typescript-comments.md`, rewrite touched comments to drop "eight v1.13-supported" / "v1.13" version-history narration (lines 26-31, 27); keep `D-58-06`, `WR-04`, requirement-ID anchors.

---

### `shared/concerns/hooks.ts` (config, transform) — lockstep union widen

**Analog:** its own 8 literals (source lines 58-66). The `as const satisfies readonly ClaudeHookEvent[]` pin in `hook-events.ts:45` forces this edit at compile time.
```typescript
export type ClaudeHookEvent =
  | "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse"
  | "PostToolUseFailure" | "PreCompact" | "PostCompact" | "SessionEnd"
  | "Stop" | "StopFailure";
```
`HookSummaryEntry` (lines 70-78) and `appendHooksBlock` (line 100) need NO change — the non-tool arm renders any `Exclude<ClaudeHookEvent, _ToolEvent>` as a bare `<event>` automatically. `projectHookSummaryEntries` (`info.ts:376`) likewise auto-lists the two new events (lines 385-393 non-tool arm). This is why `plugin info` "just works" once the union widens.

---

### `bridges/hooks/dispatch-exec.ts` + `async-rewake/registry.ts` (bridge, dispatch) — DECOUPLE (D-87-04, Open Q1)

**Analog:** the three existing `Record<BucketAEvent, ...>` tables — `dispatch-exec.ts:108` (`TRANSLATORS`), `dispatch-exec.ts:221` (`REQUIRED_EVENT_FIELDS`), `async-rewake/registry.ts:96` (`TRANSLATORS`).

**The crux (Pitfall 1):** these tables are `Record<BucketAEvent, ...>` — TOTAL over the widened union. Growing `BUCKET_A_EVENTS` to 10 makes them a typecheck error demanding `Stop`/`StopFailure` translators (Phase 88 work).

**Pattern to apply (D-87-04 decouple):** introduce a `DISPATCHABLE_EVENTS` subset (the current 8) in `hook-events.ts` and re-key these three tables to that subset type, OR make them `Partial<Record<BucketAEvent, ...>>` with a defensive `undefined` guard in `buildPayload` (`dispatch-exec.ts:232`). The subset approach mirrors the existing `TOOL_EVENTS`/`ToolEvent` subset pattern already in `hook-events.ts:69-78` — a `readonly [...] as const satisfies readonly BucketAEvent[]` tuple with a derived `(typeof ...)[number]` type. Prefer the subset; it is the same house machinery. Phase 88 folds the subset back up to the full union when translators land (reversible).

Current table shape (do NOT add real Stop/StopFailure translators here):
```typescript
const TRANSLATORS: Record<BucketAEvent, (event: never, ctx: TranslationContext) => unknown> = {
  SessionStart: translateSessionStart, UserPromptSubmit: translateUserPromptSubmit,
  PreToolUse: translatePreToolUse, PostToolUse: translatePostToolUse,
  PostToolUseFailure: translatePostToolUseFailure, PreCompact: translatePreCompact,
  PostCompact: translatePostCompact, SessionEnd: translateSessionEnd,
};
```

---

### `package.json` (manifest) — FLOOR-01

**Analog:** the existing peer range at line 56.
```
"@earendil-works/pi-coding-agent": ">=0.74.0",   // → ">=0.80.5"
```
Change `>=0.74.0` → `>=0.80.5` (D-87-05: 0.80.4 was never published; `agent_settled` first ships in 0.80.5). Single-line edit; no test pins the floor value. devDep at line 15 is already `^0.82.1` (satisfies the floor) — no lockfile churn. Declarative only (D-87-01): no runtime version detection.

---

### `tests/fixtures/hookify-hooks.json` (fixture) — restore Stop arm (D-87-03)

**Analog:** the fixture's own existing `PreToolUse`/`PostToolUse`/`UserPromptSubmit` arms (top-level `hooks` object, command-handler shape). Add a `Stop` arm derived from real claude-plugins-official wire bytes, matching the existing handler shape:
```json
"Stop": [
  { "hooks": [ { "type": "command", "command": "python3 \"${CLAUDE_PLUGIN_ROOT}/hooks/stop.py\"", "timeout": 10 } ] }
]
```
(Confirm exact command/path against the real hookify `hooks.json`.)

### `tests/fixtures/ralph-wiggum-*.json` (new fixture) — Stop-only (D-87-03)

**Analog:** `hookify-hooks.json` structure (top-level `description` + `hooks`). Derive from real wire bytes; document provenance in the `description` field (hookify precedent). Stop-only `hooks` object.

---

## Shared Patterns

### Null-sentinel no-matcher drop (Stop)
**Source:** `domain/components/hooks.ts:803-806` (`tryNonToolEventTrip`)
**Apply to:** `Stop` — reuse, do not reinvent. Non-empty matcher → `{kind:"drop", cond:"no-matcher-support"}`; match-all (`""`/`"*"`) short-circuits admissible at `tryMatcherTrip` (line 849) before this runs.
```typescript
const fieldName = NON_TOOL_EVENT_FIELDS[event];
if (fieldName === null) {
  return { kind: "drop", cond: "no-matcher-support" };
}
```

### Closed-set exact-match drop (StopFailure)
**Source:** `domain/components/hooks.ts:809-830`
**Apply to:** `StopFailure`. Exact whole-string `.has()` — NO pipe-OR splitting (Pitfall 3). A `"rate_limit|server_error"` compound matcher drops as `closed-set`, consistent with `SessionStart`. The `parseMatcher` `|`-tokenizer is tool-event-path only (line 769) and must not be added here.
```typescript
const closedSet = NON_TOOL_EVENT_CLOSED_SETS[event];
if (closedSet === undefined) {
  return { kind: "structural", detail: `(c) missing closed-set entry for non-tool event: ${event}` };
}
if (!closedSet.has(rawMatcher)) {
  return { kind: "drop", cond: "closed-set" };
}
```

### Admission auto-follows the tuple
**Source:** `domain/components/hooks.ts:759` — `const BUCKET_A_MEMBERS = new Set<string>(BUCKET_A_EVENTS);`
**Apply to:** nothing — informational. Once the tuple grows, admission (`partitionHooks` no longer emits `{kind:"event"}` drops for Stop/StopFailure) and `plugin info` listing follow with zero new code. This is why ADMIT-02's observable flip is emergent.

### Re-point `Stop`-as-unsupported test examples (Pitfall 5)
**Source:** `Stop` was the canonical "non-bucket-A event" across the suite.
**Apply to:** every site in the Pitfall 5 list. Pick ONE still-deferred event (`Notification` reads clearly) as the replacement. Sites: `resolver-strict.test.ts:251,301`; `hooks.test.ts:322,436,473,604-610,630,653,666-667`; `info.test.ts:2131+` (INFO-05 lenient reader); `install.test.ts:2618`; `hooks-supportability.test.ts:251`; `notify-v2.test.ts:3852-3871`; fixtures `hooks-stop-only.json`, `hooks-posttooluse-and-stop.json`. Test titles must follow comment policy (no phase/Pitfall-N tokens).

### Drift-guard count updates
**Source:** `hooks-supportability.test.ts:42` (asserts exact 8-tuple/order) and `hooks-translators.test.ts:176` (`length === 8`).
**Apply to:** update to 10. `hooks-translators.test.ts` count is gated on the Open-Q1 decouple resolution (if the translator tables key on a subset, the translator-count assertion stays 8 and a NEW admission-tuple-length assertion covers 10). Leave `hooks-dispatch.test.ts:200-219` (8 `pi.on` subscriptions) UNTOUCHED — Pi-event subscription set, not Claude admission set (Pitfall 6). DISP-02 at `hooks-dispatch.test.ts:244` compares dynamically and stays green.

## No Analog Found

None. Every new element has an in-repo sibling precedent — this phase is deliberately built on existing machinery (null-sentinel = UserPromptSubmit; closed-set = SessionStart; subset type = TOOL_EVENTS; floor bump = prior `>=0.74.0`; fixture = hookify).

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/domain/components/`, `shared/concerns/`, `bridges/hooks/`, `orchestrators/plugin/`, `tests/fixtures/`, `package.json`
**Files scanned:** hook-events.ts, hooks.ts (domain), hooks.ts (shared/concerns), dispatch-exec.ts, async-rewake/registry.ts, info.ts, package.json, hookify-hooks.json
**Pattern extraction date:** 2026-07-29
</content>
</invoke>
