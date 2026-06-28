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
import { partitionHooks } from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";

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

// ──────────────────────────────────────────────────────────────────────────
// Block 5b: WR-04 table-synchrony invariant for NON_TOOL_EVENT_FIELDS /
// NON_TOOL_EVENT_CLOSED_SETS.
// ──────────────────────────────────────────────────────────────────────────

test("WR-04: every NON_TOOL_EVENT_FIELDS event with a non-null field name has a NON_TOOL_EVENT_CLOSED_SETS entry", () => {
  // The two tables must stay synchronized. An event mapped to a Claude
  // field name (non-null string) declares "this event takes a matcher
  // value, and the admissible value set lives in NON_TOOL_EVENT_CLOSED_SETS";
  // an event mapped to `null` declares "this event has no matcher
  // support" and MUST NOT have a closed-set entry. A future contributor
  // adding a fifth non-tool event to NON_TOOL_EVENT_FIELDS with a string
  // target but forgetting the parallel closed-set entry would cause
  // `tryNonToolEventTrip` to fall into the WR-04 "missing entry" branch
  // at runtime; this test red-fails CI at compile time instead.
  const fieldEntries = Object.entries(NON_TOOL_EVENT_FIELDS);
  for (const [event, field] of fieldEntries) {
    if (field === null) {
      assert.ok(
        !(event in NON_TOOL_EVENT_CLOSED_SETS),
        `${event} has the null no-matcher-support sentinel -- it MUST NOT have a NON_TOOL_EVENT_CLOSED_SETS entry`,
      );
    } else {
      assert.ok(
        event in NON_TOOL_EVENT_CLOSED_SETS,
        `${event} declares matcher field "${field}" but has no NON_TOOL_EVENT_CLOSED_SETS entry -- the two tables fell out of sync`,
      );
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 6: PHOOK-01 partitionHooks DroppedHook discriminant contract
// ──────────────────────────────────────────────────────────────────────────

test("PHOOK-01: partitionHooks maps each unsupportable matcher to its DroppedHook discriminant", () => {
  // Locks the partition's per-condition discriminant so downstream consumers
  // (the info enumeration and the aggregate `{unsupported hooks}` reason in
  // `shared/probe-classifiers.ts`) have a stable token contract. A future
  // contributor who renames a `cond` literal or a `kind` arm red-fails this
  // assertion. The legacy `(a)/(b)/(c)/(d)` debugDetail prefixes collapse
  // into the `kind` + `cond` discriminants per D-71-01.

  // (a) -> kind:"group", cond:"regex".
  const regex = partitionHooks({
    PreToolUse: [{ matcher: "Edit.*", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  assert.deepEqual(regex.supported, {});
  assert.deepEqual(regex.dropped, [
    { kind: "group", event: "PreToolUse", matcher: "Edit.*", cond: "regex" },
  ]);

  // (b) -> kind:"group", cond:"unmapped-tool".
  const unmapped = partitionHooks({
    PreToolUse: [{ matcher: "MultiEdit", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  assert.deepEqual(unmapped.dropped, [
    { kind: "group", event: "PreToolUse", matcher: "MultiEdit", cond: "unmapped-tool" },
  ]);

  // (c) non-bucket-A event -> kind:"event".
  const nonBucketA = partitionHooks({
    Stop: [{ matcher: "", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  assert.deepEqual(nonBucketA.supported, {});
  assert.deepEqual(nonBucketA.dropped, [{ kind: "event", event: "Stop" }]);

  // (c) no-matcher-support -> kind:"group", cond:"no-matcher-support".
  const noMatcher = partitionHooks({
    UserPromptSubmit: [
      { matcher: "anything", hooks: [{ type: "command", command: "/bin/false" }] },
    ],
  });
  assert.deepEqual(noMatcher.dropped, [
    {
      kind: "group",
      event: "UserPromptSubmit",
      matcher: "anything",
      cond: "no-matcher-support",
    },
  ]);

  // (c) closed-set -> kind:"group", cond:"closed-set".
  const closedSet = partitionHooks({
    SessionStart: [{ matcher: "clear", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  assert.deepEqual(closedSet.dropped, [
    { kind: "group", event: "SessionStart", matcher: "clear", cond: "closed-set" },
  ]);

  // (d) non-command handler -> kind:"handler" (HANDLER granularity, Q1).
  const nonCommand = partitionHooks({
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "frobnicate", command: "/bin/false" }] }],
  });
  assert.deepEqual(nonCommand.dropped, [
    { kind: "handler", event: "PreToolUse", matcher: "Edit", handlerType: "frobnicate" },
  ]);
  // The group's only handler dropped, so the event is omitted entirely.
  assert.deepEqual(nonCommand.supported, {});
});
