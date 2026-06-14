// Architecture-level invariant pins for the TOOL-02 bucket-A event
// closed-set + non-tool-event matcher tables (D-58-06).
//
// Each test in this file pins one load-bearing decision that is a
// single textual diff away from regression:
//
//   - BUCKET_A_EVENTS is exactly the 8 documented events in locked
//     order (downstream registration iterates the tuple deterministically;
//     adding a 9th event or reordering an existing one red-fails CI).
//   - TOOL_EVENTS is the closed 3-tuple subset of bucket-A whose matcher
//     targets a Claude tool name (catches a future contributor who tries
//     to add a non-tool event to the tool-events partition).
//   - NON_TOOL_EVENT_FIELDS maps each non-tool bucket-A event to its
//     Claude-side matcher target field (or `null` for events with no
//     upstream matcher support, per D-58-06 strict-supportability stance).
//   - NON_TOOL_EVENT_CLOSED_SETS contents are locked per event so a
//     contributor who silently relaxes a closed-set under v1.13
//     (e.g. admitting `clear` to SessionStart without a Pi
//     `session_start.reason` value to back it) red-fails CI.
//   - UserPromptSubmit is absent from NON_TOOL_EVENT_CLOSED_SETS so the
//     null-sentinel disposition in NON_TOOL_EVENT_FIELDS is the sole
//     handler for the no-matcher-support case.
//
// If any of the five tests below red-fails CI, a future contributor
// inadvertently reverted a locked invariant.

import assert from "node:assert/strict";
import test from "node:test";

import {
  BUCKET_A_EVENTS,
  NON_TOOL_EVENT_CLOSED_SETS,
  NON_TOOL_EVENT_FIELDS,
  TOOL_EVENTS,
} from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

// ──────────────────────────────────────────────────────────────────────────
// Block 1: TOOL-02 bucket-A 8-event tuple (D-58-06)
// ──────────────────────────────────────────────────────────────────────────

test("TOOL-02: BUCKET_A_EVENTS is exactly the 8 documented events in locked order", () => {
  // Order matters: downstream registration in a later phase iterates the
  // tuple deterministically. A future contributor who reorders or adds a
  // 9th event (without going through a CONTEXT.md / ROADMAP amendment)
  // red-fails this assertion.
  assert.deepEqual(
    [...BUCKET_A_EVENTS],
    [
      "SessionStart",
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "PostToolUseFailure",
      "PreCompact",
      "PostCompact",
      "SessionEnd",
    ],
    "BUCKET_A_EVENTS is a public closed-set contract -- shape and order are locked",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 2: TOOL-02 tool-event subset (D-58-06)
// ──────────────────────────────────────────────────────────────────────────

test("TOOL-02: TOOL_EVENTS is the closed 3-tuple subset of bucket-A", () => {
  assert.deepEqual(
    [...TOOL_EVENTS],
    ["PreToolUse", "PostToolUse", "PostToolUseFailure"],
    "TOOL_EVENTS is a public closed-set contract -- shape and order are locked",
  );

  // Subset invariant: every TOOL_EVENTS member must also be a
  // BUCKET_A_EVENTS member. Catches a future contributor who adds a
  // tool-event literal that bypassed the bucket-A admission gate.
  const bucketAMembers = new Set<string>(BUCKET_A_EVENTS);
  for (const toolEvent of TOOL_EVENTS) {
    assert.ok(
      bucketAMembers.has(toolEvent),
      `TOOL_EVENTS member "${toolEvent}" must also be in BUCKET_A_EVENTS`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 3: D-58-06 non-tool-event Claude-side field-name map
// ──────────────────────────────────────────────────────────────────────────

test("D-58-06: NON_TOOL_EVENT_FIELDS maps each non-tool bucket-A event to its Claude-side matcher target", () => {
  // The four non-tool bucket-A events whose matcher targets a payload
  // field on the Pi-side event.
  assert.equal(
    NON_TOOL_EVENT_FIELDS.SessionStart,
    "source",
    "SessionStart matcher targets Claude `source` field (Pi `SessionStartEvent.reason`)",
  );
  assert.equal(
    NON_TOOL_EVENT_FIELDS.SessionEnd,
    "reason",
    "SessionEnd matcher targets Claude `reason` field (Pi `SessionShutdownEvent.reason`)",
  );
  assert.equal(
    NON_TOOL_EVENT_FIELDS.PreCompact,
    "trigger",
    "PreCompact matcher targets Claude `trigger` field (no Pi compact-event field exposes this)",
  );
  assert.equal(
    NON_TOOL_EVENT_FIELDS.PostCompact,
    "trigger",
    "PostCompact matcher targets Claude `trigger` field (no Pi compact-event field exposes this)",
  );

  // UserPromptSubmit: null sentinel marks "Claude has no upstream
  // matcher support". Any non-empty matcher on this event trips TOOL-02
  // per strict-supportability stance.
  assert.equal(
    NON_TOOL_EVENT_FIELDS.UserPromptSubmit,
    null,
    "UserPromptSubmit has no upstream matcher support -- null sentinel marks the disposition",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 4: D-58-06 non-tool-event Claude-side value closed sets
// ──────────────────────────────────────────────────────────────────────────

test("D-58-06: NON_TOOL_EVENT_CLOSED_SETS admits only Pi-peer-dep-mapped Claude values", () => {
  // SessionStart: Pi `SessionStartEvent.reason` exposes `startup` and
  // `resume` among the Claude SessionStart source values; `clear` and
  // `compact` are unmappable under v1.13 and trip TOOL-02.
  const sessionStartAllowed = NON_TOOL_EVENT_CLOSED_SETS.SessionStart;
  assert.ok(sessionStartAllowed !== undefined, "SessionStart must have a closed-set entry");
  assert.deepEqual(
    [...sessionStartAllowed].sort(),
    ["resume", "startup"],
    "SessionStart admissible matcher values must be {startup, resume}",
  );

  // SessionEnd: empty set under v1.13. The only literal overlap with Pi
  // `SessionShutdownEvent.reason` is `resume`, but Pi and Claude diverge
  // semantically -- strict trip on every non-empty matcher.
  const sessionEndAllowed = NON_TOOL_EVENT_CLOSED_SETS.SessionEnd;
  assert.ok(sessionEndAllowed !== undefined, "SessionEnd must have a closed-set entry");
  assert.deepEqual(
    [...sessionEndAllowed].sort(),
    [],
    "SessionEnd admissible matcher values must be the empty set under v1.13",
  );

  // PreCompact / PostCompact: empty set. Pi compact events carry no
  // `trigger` field -- only match-all (`""`/`"*"`) is supportable.
  const preCompactAllowed = NON_TOOL_EVENT_CLOSED_SETS.PreCompact;
  assert.ok(preCompactAllowed !== undefined, "PreCompact must have a closed-set entry");
  assert.deepEqual(
    [...preCompactAllowed].sort(),
    [],
    "PreCompact admissible matcher values must be the empty set (Pi has no trigger field)",
  );

  const postCompactAllowed = NON_TOOL_EVENT_CLOSED_SETS.PostCompact;
  assert.ok(postCompactAllowed !== undefined, "PostCompact must have a closed-set entry");
  assert.deepEqual(
    [...postCompactAllowed].sort(),
    [],
    "PostCompact admissible matcher values must be the empty set (Pi has no trigger field)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 5: D-58-06 UserPromptSubmit no-matcher-support disposition
// ──────────────────────────────────────────────────────────────────────────

test("D-58-06: UserPromptSubmit has no entry in NON_TOOL_EVENT_CLOSED_SETS", () => {
  // The null sentinel in NON_TOOL_EVENT_FIELDS is the disposition for
  // the no-matcher-support case; the absence here confirms it. Adding
  // a UserPromptSubmit entry without changing the null sentinel above
  // would create a contradiction (matcher values admissible under a
  // null-field event).
  assert.ok(
    !("UserPromptSubmit" in NON_TOOL_EVENT_CLOSED_SETS),
    "UserPromptSubmit must NOT have an entry -- null sentinel in NON_TOOL_EVENT_FIELDS is the disposition",
  );
});

// Plan 03 extends with checkMatcherSupportability invariants below this line.
