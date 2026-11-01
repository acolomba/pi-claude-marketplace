// domain/components/hook-events.ts
//
// TOOL-02 bucket-A event closed-set + non-tool-event matcher target tables.

import type { ClaudeHookEvent } from "../../shared/concerns/hooks.ts";
// This module is the source of truth `checkMatcherSupportability` reads at
// parse time to trip TOOL-02 when a plugin's `hooks.json` declares hooks
// under any non-bucket-A event key, or carries a non-tool matcher value
// that has no Pi peer-dep analog.
//
// D-58-06 strict-supportability stance: a non-tool matcher value with no
// Pi peer-dep field or no admissible Pi-side counterpart trips TOOL-02
// (the matcher group drops and the plugin reads `(partially-available)
// {unsupported hooks}`, D-CF5-19) rather than silently translating to a
// no-op filter. A tool-name matcher's pipe-OR
// alternatives are classified independently (#217): an alternative with
// no Pi tool mapping is dropped from the alternative list and logged via
// `hookDebugLog`; only a matcher left with no supported alternative trips
// TOOL-02. Silent never-fires and silent over-fires are both failure
// modes -- strict trip is the load-bearing design choice.
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
 * under any other event key (an inapplicable event, `PreModelSwitch` or
 * `PostModelSwitch`, or `DirectoryAdded`, which Pi has no event for) trips
 * TOOL-02(c): the hooks of that event drop, the plugin reads
 * `(partially-available) {unsupported hooks}`, and info lists the event as
 * `<event> (unsupported)`, never silently (D-CF5-19).
 *
 * Order is a deterministic registration order for downstream consumers.
 * `Stop` and `StopFailure` are appended after `SessionEnd` as the
 * turn-boundary lifecycle tail (ADMIT-01) -- they close a turn where the
 * other events open/advance one. Both are admitted at the resolver layer
 * here; their matcher dispositions live in the tables below (`Stop`: the
 * `null` no-matcher sentinel like `UserPromptSubmit`; `StopFailure`: the
 * closed error-type set like `SessionStart`). Every admitted event currently
 * has a dispatch translator; each dispatch owner pins that invariant with an
 * exhaustive record keyed by `DispatchableEvent`.
 */
const ADMITTED_EVENT_NAMES = [
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
 * SCN-F025 / GGAT-04 completeness proof for the reverse direction described
 * on `BucketAEvent` below. `Exclude<ClaudeHookEvent, BucketAEvent>` is `never` only
 * when the tuple registers the whole union; an unregistered member leaves a
 * non-`never` type, which violates `_AssertNever`'s constraint and is a
 * TS2344 build failure. The public registration tuple consumes the private
 * proof in its actual satisfies contract, with no runtime footprint.
 */
type _AssertNever<T extends never> = T;
type _UnregisteredHookEvent = Exclude<ClaudeHookEvent, (typeof ADMITTED_EVENT_NAMES)[number]>;
type _BucketAEventsCoverageProof = _AssertNever<_UnregisteredHookEvent>;

/** Complete admitted event tuple, checked against the shared event vocabulary. */
export const BUCKET_A_EVENTS = ADMITTED_EVENT_NAMES satisfies readonly Exclude<
  ClaudeHookEvent,
  _BucketAEventsCoverageProof
>[];

/**
 * Literal union of bucket-A event names. Derived from the tuple above so
 * the source of truth lives in exactly one place.
 *
 * SURF-02 / D-63-06: `BucketAEvent` is a structural duplicate of the
 * `ClaudeHookEvent` literal-union declared in `shared/concerns/hooks.ts`. The
 * two declarations sit on opposite sides of the `shared/` <- `domain/`
 * import-direction fence (`import-x/no-restricted-paths`), and holding them
 * in step takes one mechanism per direction:
 *
 *   - The `as const satisfies readonly ClaudeHookEvent[]` assertion above
 *     proves every `BUCKET_A_EVENTS` member is a `ClaudeHookEvent`. A tuple
 *     entry outside the union fails at that assertion site.
 *   - `_BucketAEventsCoverageProof` above proves every `ClaudeHookEvent` is
 *     a `BUCKET_A_EVENTS` member. A union member left unregistered fails
 *     there.
 *
 * SCN-F025 / GGAT-04: `satisfies readonly T[]` constrains the tuple against
 * the union and not the union against the tuple, so the reverse proof is what
 * makes an unregistered event a compile error rather than an event the
 * resolver admits and no dispatch translator routes.
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
 * Compatibility name for the exact admitted event union and the key domain
 * for the dispatch/rewake/translator tables (D-87-04). Both dispatch owners
 * accept the admitted union directly and index exhaustive records without a
 * runtime membership guard. `Stop` / `StopFailure` are dispatched by the
 * settle handler off `agent_settled` rather than a per-Pi-event composite.
 */
// D-87-04: the alias is structurally equal to `BucketAEvent` today but names a
// different concept -- the key domain of the dispatch/rewake/translator tables.
// `Record<DispatchableEvent, ...>` at three table literals states which set the table
// must be total over; collapsing it to `BucketAEvent` would erase that at 24 call
// sites to satisfy a structural rule.
// eslint-disable-next-line sonarjs/redundant-type-aliases -- see the note above
export type DispatchableEvent = BucketAEvent;

/**
 * Literal union of non-tool bucket-A event names. The complement of
 * `ToolEvent` within `BucketAEvent`. Keying the matcher-disposition tables on
 * this (rather than `Partial<Record<BucketAEvent, ...>>`) makes them TOTAL: a
 * non-tool event added to `BUCKET_A_EVENTS` without a matcher disposition is a
 * compile error at the table literal.
 */
type NonToolEvent = Exclude<BucketAEvent, ToolEvent>;

/**
 * Claude-side matcher target field per non-tool bucket-A event. The value
 * is the Claude `hooks.json` field name a matcher value compares against
 * (e.g. SessionStart matchers compare to the Claude-side `source` field).
 * A `null` sentinel marks events where Claude has no upstream matcher
 * support; per D-58-06 strict-supportability stance, any non-empty
 * matcher on such an event trips TOOL-02.
 *
 * | Claude event     | Claude field   | Pi peer-dep field, mapped to the Claude values               |
 * | ---------------- | -------------- | ------------------------------------------------------------ |
 * | SessionStart     | `source`       | `SessionStartEvent.reason`: `startup` -> `startup`,          |
 * |                  |                | `new` -> `clear`, `resume` -> `resume`, `fork` -> `fork`,    |
 * |                  |                | `reload` -> no run; `compact` from `session_compact`         |
 * | SessionEnd       | `reason`       | `SessionShutdownEvent.reason`: `new` -> `clear`,             |
 * |                  |                | `resume` / `fork` -> `resume`, `quit` -> `prompt_input_exit` |
 * |                  |                | in the terminal, `other` elsewhere, `reload` -> no run       |
 * | PreCompact       | `trigger`      | `SessionBeforeCompactEvent.reason`: `manual` -> `manual`,    |
 * |                  |                | `threshold` / `overflow` -> `auto`                           |
 * | PostCompact      | `trigger`      | `SessionCompactEvent.reason`: `manual` -> `manual`,          |
 * |                  |                | `threshold` / `overflow` -> `auto`                           |
 * | UserPromptSubmit | (none -- null) | (none -- no upstream matcher support)                        |
 * | Stop             | (none -- null) | (none -- no upstream matcher support)                        |
 * | StopFailure      | `error`        | `stopReason` error-type classification                       |
 *
 * D-CF5-01, D-CF5-02, D-CF5-03, D-CF5-04, D-CF5-21: dispatch compares a
 * matcher with the mapped value, never with Pi's own value.
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
export const NON_TOOL_EVENT_FIELDS = {
  SessionStart: "source",
  SessionEnd: "reason",
  PreCompact: "trigger",
  PostCompact: "trigger",
  UserPromptSubmit: null,
  Stop: null,
  StopFailure: "error",
} as const satisfies Readonly<Record<NonToolEvent, string | null>>;

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
 * The SessionStart `source` vocabulary of Claude Code (D-CF5-01, D-CF1-10,
 * D-CF1-11, D-CF1-12). Single source of truth: the matcher closed set below is
 * built from this tuple, and the bridge's one mapping site
 * (`claudeSessionStartSource` in `bridges/hooks/payloads/session-start.ts`)
 * returns `SessionStartSource`, so the value a hook receives and the value its
 * matcher is compared with cannot drift apart without a compile error.
 */
const SESSION_START_SOURCES = ["startup", "resume", "clear", "compact", "fork"] as const;

/** Literal union of SessionStart `source` values, derived from the tuple above. */
export type SessionStartSource = (typeof SESSION_START_SOURCES)[number];

/**
 * The SessionEnd `reason` vocabulary of Claude Code (D-CF5-02, D-CF1-10).
 * Single source of truth, as for SessionStart: the matcher closed set below
 * is built from it, and `claudeSessionEndReason` in
 * `bridges/hooks/payloads/session-end.ts` returns `SessionEndReason`.
 * `logout` is admitted though no Pi event maps to it, as upstream admits it
 * and never sends it from a plugin's session.
 */
const SESSION_END_REASONS = ["clear", "resume", "logout", "prompt_input_exit", "other"] as const;

/** Literal union of SessionEnd `reason` values, derived from the tuple above. */
export type SessionEndReason = (typeof SESSION_END_REASONS)[number];

/**
 * Closed set of Claude-side matcher values admissible per non-tool
 * bucket-A event. A value not in the set (or an entry not
 * present here at all) trips TOOL-02 at parse time per D-58-06.
 *
 * Per-event derivation:
 *
 *   - **SessionStart** (D-CF5-01, D-CF1-10..12): Claude values `startup |
 *     resume | clear | compact | fork`, all admitted. The bridge maps Pi's
 *     `SessionStartEvent.reason` once: `startup` and `resume` keep their
 *     name, `new` is `clear`, `fork` is `fork`, and Pi `reload` runs no
 *     SessionStart (D-CF5-03). `compact` comes from the compaction handler
 *     (D-CF5-04). Dispatch compares a matcher with the mapped value.
 *
 *   - **SessionEnd** (D-CF5-02, D-CF1-10): Claude values `clear | resume |
 *     logout | prompt_input_exit | other`, all admitted. The bridge maps Pi's
 *     `SessionShutdownEvent.reason` once, with the session's mode: `new` is
 *     `clear`, `resume` and `fork` are `resume`, `quit` is
 *     `prompt_input_exit` in the terminal and `other` elsewhere, and Pi
 *     `reload` runs no SessionEnd (D-CF5-03). `logout` never fires, as
 *     upstream. Dispatch compares a matcher with the mapped value.
 *
 *   - **PreCompact** / **PostCompact** (D-CF5-04, PDEF-08): Claude values
 *     `manual | auto`, both admitted. Pi `SessionBeforeCompactEvent` and
 *     `SessionCompactEvent` carry a `reason` of `manual`, `threshold`, or
 *     `overflow`; `compactTrigger` in `bridges/hooks/payloads/compact-trigger.ts`
 *     maps `manual` to `manual` and the other two to `auto`. Dispatch
 *     compares a matcher with the mapped trigger.
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
export const NON_TOOL_EVENT_CLOSED_SETS = {
  // D-CF5-01 / D-CF1-10..12: Claude Code's whole SessionStart `source`
  // vocabulary, built from the `SESSION_START_SOURCES` single source of truth.
  SessionStart: new Set<string>(SESSION_START_SOURCES),
  // D-CF5-02 / D-CF1-10: Claude Code's whole SessionEnd `reason` vocabulary,
  // built from the `SESSION_END_REASONS` single source of truth.
  SessionEnd: new Set<string>(SESSION_END_REASONS),
  // D-CF5-04 / PDEF-08: Pi's compact `reason` projects onto Claude's complete
  // trigger vocabulary: `manual` remains manual, while `threshold` and
  // `overflow` both project to `auto`.
  PreCompact: new Set(["manual", "auto"]),
  PostCompact: new Set(["manual", "auto"]),
  // UserPromptSubmit and Stop intentionally omitted -- the null sentinel in
  // NON_TOOL_EVENT_FIELDS is their no-matcher-support disposition.
  // SFAIL-03: the closed error-type vocabulary for StopFailure, built from
  // the `STOP_FAILURE_ERROR_TYPES` single source of truth above. Exact
  // whole-string membership only -- no pipe-OR splitting (a pipe compound is
  // a single string absent from this set and trips `closed-set`).
  StopFailure: new Set<string>(STOP_FAILURE_ERROR_TYPES),
} satisfies Readonly<
  Record<Exclude<NonToolEvent, "UserPromptSubmit" | "Stop">, ReadonlySet<string>>
>;
