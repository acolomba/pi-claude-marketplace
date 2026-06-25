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
 * The eight v1.13-supported Claude hook events (bucket A). Each entry is
 * directly dispatchable to a Pi event with 100% fidelity to the Claude
 * Code contract -- no synthesis, no loss modes. A plugin declaring hooks
 * under any other event key trips TOOL-02(c) and flips
 * `(unavailable) {unsupported hooks}`.
 *
 * Order matches the v1.13 milestone scope description in
 * `.planning/PROJECT.md` and is preserved as a deterministic registration
 * order for downstream consumers.
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
 *
 * Tool events (`PreToolUse` / `PostToolUse` / `PostToolUseFailure`) are
 * intentionally absent from this map -- their matcher targets a tool name
 * and is handled by the TOOL-01 reverse map in `hook-tool-names.ts`.
 */
export const NON_TOOL_EVENT_FIELDS: Readonly<Partial<Record<BucketAEvent, string | null>>> = {
  SessionStart: "source",
  SessionEnd: "reason",
  PreCompact: "trigger",
  PostCompact: "trigger",
  UserPromptSubmit: null,
};

/**
 * Closed set of Claude-side matcher values admissible per non-tool
 * bucket-A event under v1.13. A value not in the set (or an entry not
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
 *     mis-fire. Empty closed set under v1.13 -- every non-empty SessionEnd
 *     matcher trips TOOL-02. v1.14+ may relax if Pi exposes a matching
 *     value vocabulary.
 *
 *   - **PreCompact** / **PostCompact**: Claude values `manual | auto`.
 *     Pi `SessionBeforeCompactEvent` / `SessionCompactEvent` carry NO
 *     `trigger` field. No value is admissible; every non-empty matcher
 *     trips TOOL-02. Only match-all (`""` / `"*"`) is supportable.
 *
 *   - **UserPromptSubmit**: omitted entirely. Claude has no upstream
 *     matcher support for this event (Pitfall: a plugin author may write
 *     a matcher thinking it filters prompts); the `null` sentinel in
 *     `NON_TOOL_EVENT_FIELDS` marks the no-matcher-support disposition,
 *     and the absence here confirms it.
 */
export const NON_TOOL_EVENT_CLOSED_SETS: Readonly<
  Partial<Record<BucketAEvent, ReadonlySet<string>>>
> = {
  // D-58-06: Pi `SessionStartEvent.reason` exposes `startup` and `resume`
  // among the Claude SessionStart source values; `clear` and `compact`
  // are unmappable and trip TOOL-02.
  SessionStart: new Set(["startup", "resume"]),
  // D-58-06: Pi `SessionShutdownEvent.reason` shares no semantically
  // safe value with the Claude SessionEnd reason vocabulary under v1.13.
  // Empty set -- every non-empty matcher trips TOOL-02.
  SessionEnd: new Set<string>([]),
  // D-58-06: Pi compact events carry no `trigger` field. Empty set --
  // every non-empty matcher trips TOOL-02 (only match-all supportable).
  PreCompact: new Set<string>([]),
  PostCompact: new Set<string>([]),
  // UserPromptSubmit intentionally omitted -- null sentinel in
  // NON_TOOL_EVENT_FIELDS is the no-matcher-support disposition.
};
