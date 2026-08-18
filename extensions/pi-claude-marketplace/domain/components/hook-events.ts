// domain/components/hook-events.ts
//
// TOOL-02 bucket-A event closed-set + non-tool-event matcher target tables.

import type { ClaudeHookEvent } from "../../shared/concerns/hooks.ts";
// This module is the source of truth `checkMatcherSupportability` reads at
// parse time to trip TOOL-02 when a plugin's `hooks.json` declares hooks
// under any non-bucket-A event key, or carries a non-tool matcher value
// that has no Pi peer-dep analog.
//
// D-58-06 strict-supportability stance: when a Claude-side matcher value
// has no Pi peer-dep field or no admissible Pi-side counterpart, the
// matcher trips TOOL-02 (plugin flips `(unavailable) {unsupported hooks}`)
// rather than silently translating to a no-op filter. Silent never-fires
// and silent over-fires are both failure modes -- strict trip is the
// load-bearing design choice.
//
// Two-tier shape: the `BUCKET_A_EVENTS` / `TOOL_EVENTS` tuples lock the
// event closed set + tool-event subset; the parallel
// `NON_TOOL_EVENT_FIELDS` / `NON_TOOL_EVENT_CLOSED_SETS` Records map each
// non-tool bucket-A event to (a) the Claude-side matcher target field
// name (`source` / `reason` / `trigger`) or a `null` sentinel for events
// with no upstream matcher support, and (b) the closed set of Claude-side
// matcher values that have a Pi peer-dep analog.

/**
 * The supported Claude hook events (bucket A). A plugin declaring hooks
 * under any other event key trips TOOL-02(c) and flips
 * `(unavailable) {unsupported hooks}`.
 *
 * Order is a deterministic registration order for downstream consumers.
 * `Stop` and `StopFailure` are appended after `SessionEnd` as the
 * turn-boundary lifecycle tail (ADMIT-01) -- they close a turn where the
 * other events open/advance one. Both are admitted at the resolver layer
 * here; their matcher dispositions live in the tables below (`Stop`: the
 * `null` no-matcher sentinel like `UserPromptSubmit`; `StopFailure`: the
 * closed error-type set like `SessionStart`). Whether an admitted event is
 * actually dispatchable is tracked separately by `DISPATCHABLE_EVENTS`.
 */
export const BUCKET_A_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "Stop",
  "StopFailure",
] as const satisfies readonly ClaudeHookEvent[];

/**
 * Literal union of bucket-A event names. Derived from the tuple above so
 * the source of truth lives in exactly one place.
 *
 * SURF-02 / D-63-06: `BucketAEvent` is a structural duplicate of the
 * `ClaudeHookEvent` literal-union declared in `shared/notify.ts`. The
 * `as const satisfies readonly ClaudeHookEvent[]` assertion above is the
 * single-source-of-truth pin -- adding/removing a value from
 * `BUCKET_A_EVENTS` here without the matching `ClaudeHookEvent` edit (or
 * vice versa) breaks the typecheck at that assertion site. The two
 * declarations exist on opposite sides of the `shared/` <- `domain/`
 * import-direction fence (`import-x/no-restricted-paths`).
 */
export type BucketAEvent = (typeof BUCKET_A_EVENTS)[number];

/**
 * The three bucket-A events whose matcher targets a Claude tool name
 * (translated to Pi form at parse time via the TOOL-01 reverse map in
 * `hook-tool-names.ts`). Every other bucket-A event is a non-tool event
 * whose matcher targets a `source` / `reason` / `trigger` field on the
 * Pi-side payload (or has no matcher support at all).
 */
export const TOOL_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
] as const satisfies readonly BucketAEvent[];

/**
 * Literal union of tool-event names. Subset of `BucketAEvent`.
 */
export type ToolEvent = (typeof TOOL_EVENTS)[number];

/**
 * The bucket-A events whose Pi-side payload translators are wired -- a
 * subset of `BUCKET_A_EVENTS` that the dispatch/rewake tables and the
 * translator-test tables key on. The subset is retained (rather than
 * collapsed back into `BucketAEvent`) because the two-step
 * admission-then-dispatch pattern is reused by future bucket promotions:
 * an event can be admitted at the resolver layer before its dispatch
 * translator exists (D-87-04). `Stop` / `StopFailure` are now folded in --
 * they are dispatched by the settle handler off `agent_settled` rather than
 * a per-Pi-event composite, so the subset currently equals the full
 * admission tuple.
 *
 * The `as const satisfies readonly BucketAEvent[]` pin makes "every
 * dispatchable event is an admitted bucket-A event" a compile-time
 * invariant -- same shape as the `TOOL_EVENTS` subset above. Order
 * matches `BUCKET_A_EVENTS` as a deterministic registration order for
 * downstream consumers.
 */
export const DISPATCHABLE_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "Stop",
  "StopFailure",
] as const satisfies readonly BucketAEvent[];

/**
 * Literal union of dispatchable event names. Subset of `BucketAEvent`;
 * the key domain for the dispatch/rewake/translator tables (D-87-04).
 */
export type DispatchableEvent = (typeof DISPATCHABLE_EVENTS)[number];

/**
 * Runtime membership set + type guard for the dispatchable subset. The
 * dispatch index sites (`dispatch-exec.buildPayload`,
 * `async-rewake/registry`) narrow a `BucketAEvent` to `DispatchableEvent`
 * before indexing the translator tables. Every admitted event is now
 * dispatchable, so the non-dispatchable arm those sites guard is a defensive
 * belt (debug-log + noop) that no live event reaches; the guard is retained
 * so a future admission that outruns its translator degrades to noop rather
 * than a type error (D-87-04).
 */
const DISPATCHABLE_MEMBERS: ReadonlySet<string> = new Set(DISPATCHABLE_EVENTS);

export function isDispatchableEvent(event: BucketAEvent): event is DispatchableEvent {
  return DISPATCHABLE_MEMBERS.has(event);
}

/**
 * Literal union of non-tool bucket-A event names. The complement of
 * `ToolEvent` within `BucketAEvent`. Keying the matcher-disposition tables on
 * this (rather than `Partial<Record<BucketAEvent, ...>>`) makes them TOTAL: a
 * non-tool event added to `BUCKET_A_EVENTS` without a matcher disposition is a
 * compile error at the table literal.
 */
export type NonToolEvent = Exclude<BucketAEvent, ToolEvent>;

/**
 * Claude-side matcher target field per non-tool bucket-A event. The value
 * is the Claude `hooks.json` field name a matcher value compares against
 * (e.g. SessionStart matchers compare to the Claude-side `source` field).
 * A `null` sentinel marks events where Claude has no upstream matcher
 * support; per D-58-06 strict-supportability stance, any non-empty
 * matcher on such an event trips TOOL-02.
 *
 * | Claude event       | Claude field   | Pi peer-dep field                      |
 * | ------------------ | -------------- | -------------------------------------- |
 * | SessionStart       | `source`       | `SessionStartEvent.reason`             |
 * | SessionEnd         | `reason`       | `SessionShutdownEvent.reason`          |
 * | PreCompact         | `trigger`      | (none -- SessionBeforeCompactEvent)    |
 * | PostCompact        | `trigger`      | (none -- SessionCompactEvent)          |
 * | UserPromptSubmit   | (none -- null) | (none -- no upstream matcher support)  |
 * | Stop               | (none -- null) | (none -- no upstream matcher support)  |
 * | StopFailure        | `error`        | `stopReason` error-type classification |
 *
 * Tool events (`PreToolUse` / `PostToolUse` / `PostToolUseFailure`) are
 * intentionally absent from this map -- their matcher targets a tool name
 * and is handled by the TOOL-01 reverse map in `hook-tool-names.ts`.
 *
 * `Stop` (ADMIT-01) has no upstream matcher support -- it carries the `null`
 * sentinel exactly like `UserPromptSubmit`; any non-empty matcher trips
 * TOOL-02 as a `no-matcher-support` drop.
 *
 * `StopFailure` (ADMIT-01 / SFAIL-03) matches against a closed error-type
 * vocabulary. [ASSUMED -- field-name label] the `"error"` label names the
 * Claude-side matcher target field; the label is
 * non-load-bearing (the gate compares the raw matcher string to the closed
 * set regardless of the label), and field-name confirmation against the
 * upstream contract is deferred. What is load-bearing is the closed set in
 * `NON_TOOL_EVENT_CLOSED_SETS.StopFailure` below.
 */
export const NON_TOOL_EVENT_FIELDS: Readonly<Record<NonToolEvent, string | null>> = {
  SessionStart: "source",
  SessionEnd: "reason",
  PreCompact: "trigger",
  PostCompact: "trigger",
  UserPromptSubmit: null,
  Stop: null,
  StopFailure: "error",
};

/**
 * The closed StopFailure error-type vocabulary (SFAIL-03, D-88-02). Single
 * source of truth: the matcher closed set below is built from this tuple,
 * and the settle-time classifier (`classifyStopFailure` in
 * `bridges/hooks/payloads/stop-failure.ts`) returns `StopFailureErrorType`,
 * so classifier output and matcher vocabulary cannot drift apart without a
 * compile error.
 */
const STOP_FAILURE_ERROR_TYPES = [
  "rate_limit",
  "overloaded",
  "authentication_failed",
  "oauth_org_not_allowed",
  "billing_error",
  "invalid_request",
  "model_not_found",
  "server_error",
  "max_output_tokens",
  "unknown",
] as const;

/**
 * Literal union of StopFailure error-type names. Derived from the tuple
 * above so the vocabulary lives in exactly one place.
 */
export type StopFailureErrorType = (typeof STOP_FAILURE_ERROR_TYPES)[number];

/**
 * Closed set of Claude-side matcher values admissible per non-tool
 * bucket-A event. A value not in the set (or an entry not
 * present here at all) trips TOOL-02 at parse time per D-58-06.
 *
 * Per-event derivation:
 *
 *   - **SessionStart**: Claude values `startup | resume | clear | compact`.
 *     Pi `SessionStartEvent.reason` is `startup | reload | new | resume |
 *     fork`. The two-value overlap (`startup`, `resume`) is admissible;
 *     `clear` and `compact` have no Pi analog and trip TOOL-02 per
 *     strict-supportability stance.
 *
 *   - **SessionEnd**: Claude values `clear | resume | logout |
 *     prompt_input_exit | bypass_permissions_disabled | other`. Pi
 *     `SessionShutdownEvent.reason` is `quit | reload | new | resume |
 *     fork`. The only literal overlap is `resume`, but the Pi semantic
 *     ("session resumed elsewhere") vs the Claude semantic ("user resumed
 *     prior conversation") diverge enough that admitting it would silently
 *     mis-fire. Empty closed set -- every non-empty SessionEnd matcher
 *     trips TOOL-02; may relax if Pi exposes a matching value vocabulary.
 *
 *   - **PreCompact** / **PostCompact**: Claude values `manual | auto`.
 *     Pi `SessionBeforeCompactEvent` / `SessionCompactEvent` carry NO
 *     `trigger` field. No value is admissible; every non-empty matcher
 *     trips TOOL-02. Only match-all (`""` / `"*"`) is supportable.
 *
 *   - **UserPromptSubmit**: omitted entirely. Claude has no upstream
 *     matcher support for this event (a plugin author may write a matcher
 *     thinking it filters prompts); the `null` sentinel in
 *     `NON_TOOL_EVENT_FIELDS` marks the no-matcher-support disposition,
 *     and the absence here confirms it.
 *
 *   - **Stop**: omitted entirely, same disposition as UserPromptSubmit.
 *     Claude's `Stop` event has no upstream matcher support; the `null`
 *     sentinel in `NON_TOOL_EVENT_FIELDS` is the sole handler and the
 *     absence here confirms it (ADMIT-01).
 *
 *   - **StopFailure** (ADMIT-01 / SFAIL-03): the upstream error-type
 *     vocabulary is a closed 10-value set. Membership is exact whole-string
 *     byte-equality -- no case-folding, no normalization, and (unlike a
 *     tool matcher) no pipe-OR splitting: a compound `rate_limit|server_error`
 *     matcher is not tokenized, it is a single string absent from the set and
 *     therefore trips TOOL-02 as `closed-set`. Same table shape as
 *     SessionStart (D-58-06).
 */
export const NON_TOOL_EVENT_CLOSED_SETS: Readonly<
  Partial<Record<BucketAEvent, ReadonlySet<string>>>
> = {
  // D-58-06: Pi `SessionStartEvent.reason` exposes `startup` and `resume`
  // among the Claude SessionStart source values; `clear` and `compact`
  // are unmappable and trip TOOL-02.
  SessionStart: new Set(["startup", "resume"]),
  // D-58-06: Pi `SessionShutdownEvent.reason` shares no semantically
  // safe value with the Claude SessionEnd reason vocabulary.
  // Empty set -- every non-empty matcher trips TOOL-02.
  SessionEnd: new Set<string>([]),
  // D-58-06: Pi compact events carry no `trigger` field. Empty set --
  // every non-empty matcher trips TOOL-02 (only match-all supportable).
  PreCompact: new Set<string>([]),
  PostCompact: new Set<string>([]),
  // UserPromptSubmit and Stop intentionally omitted -- the null sentinel in
  // NON_TOOL_EVENT_FIELDS is their no-matcher-support disposition.
  // SFAIL-03: the closed error-type vocabulary for StopFailure, built from
  // the `STOP_FAILURE_ERROR_TYPES` single source of truth above. Exact
  // whole-string membership only -- no pipe-OR splitting (a pipe compound is
  // a single string absent from this set and trips `closed-set`).
  StopFailure: new Set<string>(STOP_FAILURE_ERROR_TYPES),
};
