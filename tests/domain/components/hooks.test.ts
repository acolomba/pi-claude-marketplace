import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseHooksConfig } from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";

// MATCH-03: synthetic path-anchor triple + no-op compileIf callback
// consumed by parseHooksConfig. Fixture values are stable across every
// parseHooksConfig invocation in this file -- no test exercises an
// `if` field, so the ctx is effectively a no-op here.
const TEST_IF_CTX = {
  homedir: "/home/u",
  cwd: "/projects/p",
  projectRoot: "/projects/p",
} as const;
const TEST_COMPILE_IF = (): null => null;

// ──────────────────────────────────────────────────────────────────────────
// parseHooksConfig discriminated result (D-57-04 invalid-parse path)
// ──────────────────────────────────────────────────────────────────────────

test("parseHooksConfig returns {ok:true,value} for a syntactically + structurally valid payload", () => {
  const raw = JSON.stringify({
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, JSON.parse(raw));
  }
});

test("parseHooksConfig returns {ok:false,reason} on invalid JSON", () => {
  const result = parseHooksConfig("not-valid-json", TEST_IF_CTX, TEST_COMPILE_IF);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.reason, "string");
    assert.notEqual(result.reason.length, 0);
  }
});

test("parseHooksConfig returns {ok:false,reason} on a structurally-malformed payload", () => {
  const result = parseHooksConfig('{"PreToolUse": "not-an-array"}', TEST_IF_CTX, TEST_COMPILE_IF);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.reason, "string");
    assert.notEqual(result.reason.length, 0);
  }
});

test("parseHooksConfig returns {ok:false,reason} when a type:'command' entry is missing the required `command` field", () => {
  const result = parseHooksConfig(
    '{"PreToolUse": [{"hooks": [{"type": "command"}]}]}',
    TEST_IF_CTX,
    TEST_COMPILE_IF,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.reason, "string");
    assert.notEqual(result.reason.length, 0);
  }
});

// PHOOK-03 / D-71-03: parseHooksConfig success arm returns the FILTERED
// subset as `value` plus the `dropped` enumeration; structural S1/S2 still
// fail (asserted in the discriminated-result block above).
test("PHOOK-03: parseHooksConfig success arm returns the filtered subset as value plus dropped", () => {
  const raw = JSON.stringify({
    PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/edit" }] }],
    Notification: [{ hooks: [{ type: "command", command: "/bin/notification" }] }],
  });
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/edit" }] }],
    });
    assert.deepEqual(result.dropped, [{ kind: "event", event: "Notification" }]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// HOOK-03 / LIFE-01: upstream plugin-format wrapper acceptance (wire-format
// pin). Claude Code's `plugin-dev/skills/hook-development/SKILL.md` mandates
// that plugin `hooks/hooks.json` files use the WRAPPER form
// `{description?, hooks: {<event>: [...]}}`, distinct from user-settings
// `.claude/settings.json` which uses the BARE top-level-event-keys form.
//
// The fixture under `tests/fixtures/hookify-hooks.json` is derived from
// hookify@claude-plugins-official's hooks.json (`tmp/pi-uat/agent/
// pi-claude-marketplace/sources/claude-plugins-official/plugins/hookify/
// hooks/hooks.json`), carrying its full real wire bytes: the PreToolUse,
// PostToolUse, Stop, and UserPromptSubmit event arms. `Stop` is a member of
// `BUCKET_A_EVENTS` (see
// `extensions/pi-claude-marketplace/domain/components/hook-events.ts`), so
// every arm is admitted and the wrapper unwraps cleanly to the bare
// event-keys record.
//
// The fixture pins the parser's wrapper-detection arm against real upstream
// wire bytes; any future schema change that re-narrows the parser to the
// settings-format shape red-fails here.
// ──────────────────────────────────────────────────────────────────────────

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));

test("parseHooksConfig accepts the upstream plugin-format wrapper (hookify wire bytes)", async () => {
  const fixturePath = path.resolve(FIXTURE_DIR, "../../fixtures/hookify-hooks.json");
  const raw = await readFile(fixturePath, "utf8");

  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF, { skipIfMap: true });

  assert.equal(result.ok, true);
  if (result.ok) {
    // After the wrapper-unwrap arm, the parser's `value` is the bare
    // event-keys record sourced from the upstream wrapper's `hooks` field --
    // every bucket-A event key hookify ships, including the restored Stop arm.
    assert.ok("PreToolUse" in result.value);
    assert.ok("PostToolUse" in result.value);
    assert.ok("Stop" in result.value);
    assert.ok("UserPromptSubmit" in result.value);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PHOOK-01 / D-71-02 partial-hook fixtures. Synthetic configs mirroring the
// upstream plugin-format wrapper shape plus an unsupportable element, since
// the live validation-target plugins (hookify / ralph-loop /
// security-guidance) are not in the local checkout.
// ──────────────────────────────────────────────────────────────────────────

test("PHOOK-01: hooks-notification-only fixture partitions to the empty subset (Q2 edge)", async () => {
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hooks-notification-only.json"),
    "utf8",
  );
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF, { skipIfMap: true });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {});
    assert.deepEqual(result.dropped, [{ kind: "event", event: "Notification" }]);
  }
});

test("PHOOK-01: hooks-posttooluse-and-notification fixture keeps PostToolUse, drops Notification", async () => {
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hooks-posttooluse-and-notification.json"),
    "utf8",
  );
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF, { skipIfMap: true });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok("PostToolUse" in result.value);
    assert.ok(!("Notification" in result.value));
    assert.deepEqual(result.dropped, [{ kind: "event", event: "Notification" }]);
  }
});

test("D-71-02: hooks-pretooluse-matcher-mix fixture keeps the clean group, drops the regex group", async () => {
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hooks-pretooluse-matcher-mix.json"),
    "utf8",
  );
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF, { skipIfMap: true });
  assert.equal(result.ok, true);
  if (result.ok) {
    const groups = result.value.PreToolUse;
    assert.ok(groups !== undefined, "PreToolUse must survive the partition");
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.matcher, "Edit");
    assert.deepEqual(result.dropped, [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
    ]);
  }
});
