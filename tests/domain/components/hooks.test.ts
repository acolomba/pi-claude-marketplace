import assert from "node:assert/strict";
import test from "node:test";

import {
  HOOKS_VALIDATOR,
  parseHooksConfig,
} from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";

// ──────────────────────────────────────────────────────────────────────────
// HOOKS_CONFIG_SCHEMA accept matrix
// HOOK-03: additionalProperties: true at every nesting level (lenient).
// D-57-02: top-level event keys accepted as any string.
// ──────────────────────────────────────────────────────────────────────────

test("HOOKS accepts empty object (no events declared)", () => {
  assert.equal(HOOKS_VALIDATOR.Check({}), true);
});

test("HOOKS accepts a known event key with an empty array", () => {
  assert.equal(HOOKS_VALIDATOR.Check({ SessionStart: [] }), true);
});

test("HOOKS accepts the minimum bucket-A command-handler shape", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/false" }] }],
    }),
    true,
  );
});

test("HOOKS accepts all five HOOK-03 additive extensions on a hook entry", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            {
              type: "command",
              command: "/bin/false",
              statusMessage: "running",
              once: true,
              async: false,
              shell: "/bin/bash",
              args: ["-c", "x"],
            },
          ],
        },
      ],
    }),
    true,
  );
});

test("HOOKS accepts unknown extension field names (HOOK-03 forward-compat)", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            {
              type: "command",
              command: "/bin/false",
              futureField: 42,
              anotherFuture: { nested: 1 },
            },
          ],
        },
      ],
    }),
    true,
  );
});

test("HOOKS accepts unknown top-level event keys (D-57-02 lenient top-level)", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      FutureEventX: [{ hooks: [{ type: "command", command: "/bin/false" }] }],
    }),
    true,
  );
});

test("HOOKS rejects a type:'command' entry missing the required `command` field", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [{ hooks: [{ type: "command" }] }],
    }),
    false,
  );
});

test("HOOKS rejects a top-level value that is not an array", () => {
  assert.equal(HOOKS_VALIDATOR.Check({ PreToolUse: "not-an-array" }), false);
});

test("HOOKS rejects a top-level array (must be an object)", () => {
  assert.equal(HOOKS_VALIDATOR.Check([]), false);
});

test("HOOKS rejects null", () => {
  assert.equal(HOOKS_VALIDATOR.Check(null), false);
});

test("HOOKS accepts an unknown handler-type literal (schema does not gate on handler type)", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [{ type: "frobnicate", command: "/bin/false" }],
        },
      ],
    }),
    true,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// parseHooksConfig discriminated result (D-57-04 invalid-parse path)
// ──────────────────────────────────────────────────────────────────────────

test("parseHooksConfig returns {ok:true,value} for a syntactically + structurally valid payload", () => {
  const raw = JSON.stringify({
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  const result = parseHooksConfig(raw);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, JSON.parse(raw));
  }
});

test("parseHooksConfig returns {ok:false,reason} on invalid JSON", () => {
  const result = parseHooksConfig("not-valid-json");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.reason, "string");
    assert.notEqual(result.reason.length, 0);
  }
});

test("parseHooksConfig returns {ok:false,reason} on a structurally-malformed payload", () => {
  const result = parseHooksConfig('{"PreToolUse": "not-an-array"}');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.reason, "string");
    assert.notEqual(result.reason.length, 0);
  }
});

test("parseHooksConfig returns {ok:false,reason} when a type:'command' entry is missing the required `command` field", () => {
  const result = parseHooksConfig('{"PreToolUse": [{"hooks": [{"type": "command"}]}]}');
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.reason, "string");
    assert.notEqual(result.reason.length, 0);
  }
});
