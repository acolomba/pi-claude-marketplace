// tests/bridges/hooks/timeout.test.ts
//
// Unit tests for bridges/hooks/timeout.ts -- where a hook handler's `timeout`
// is resolved against its lane and event.
//
// This file pins what THIS module decides: seconds in, seconds out; the
// per-event defaults Claude Code documents for a turn-blocking handler; the
// flat 600 s a background handler keeps; and degradation to that default for a
// value the schema admits but this module cannot use.
//
// It deliberately does NOT pin the surrounding chain. The architecture tests in
// `tests/architecture/hooks-exec.test.ts` and
// `tests/architecture/hooks-async-rewake.test.ts` pin the net conversion factor
// at each call site -- which is what would catch a second `* 1000` creeping in,
// though nothing greps for one. `tests/domain/components/hooks.test.ts` pins
// that a handler carrying a quoted number survives schema validation and the
// drop partition, which is what makes this module's non-number arms reachable.

import assert from "node:assert/strict";
import test from "node:test";

import { resolveTimeoutSeconds } from "../../../extensions/pi-claude-marketplace/bridges/hooks/timeout.ts";

test("preserves a positive integer timeout", () => {
  // arrange
  const options = {
    raw: 75,
    event: "PreToolUse",
    pluginId: "integer-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 75);
});

test("preserves a positive fractional timeout", () => {
  // arrange
  const options = {
    raw: 0.25,
    event: "SessionEnd",
    pluginId: "fractional-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 0.25);
});

test("defaults a blocking UserPromptSubmit timeout to 30 seconds", () => {
  // arrange
  const options = {
    raw: undefined,
    event: "UserPromptSubmit",
    pluginId: "prompt-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 30);
});

test("defaults a blocking SessionEnd timeout to 1.5 seconds", () => {
  // arrange
  const options = {
    raw: undefined,
    event: "SessionEnd",
    pluginId: "session-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 1.5);
});

test("defaults another blocking event timeout to 600 seconds", () => {
  // arrange
  const options = {
    raw: undefined,
    event: "PostToolUse",
    pluginId: "tool-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 600);
});

test("defaults a background event timeout to 600 seconds", () => {
  // arrange
  const options = {
    raw: undefined,
    event: "SessionEnd",
    pluginId: "background-plugin",
    lane: "background",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 600);
});

test("defaults a declared zero timeout and reports the unusable value", (t) => {
  // arrange
  const hadDebug = Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (hadDebug) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnosticLines: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]): void => {
    diagnosticLines.push(args.join(" "));
  });
  const options = {
    raw: 0,
    event: "PreToolUse",
    pluginId: "zero-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 600);
  assert.strictEqual(diagnosticLines.length, 1);
  assert.match(diagnosticLines[0] ?? "", /^\[hooks\]/);
  assert.match(diagnosticLines[0] ?? "", /unusable timeout 0/);
  assert.match(diagnosticLines[0] ?? "", /zero-plugin\/PreToolUse \(blocking\)/);
  assert.match(diagnosticLines[0] ?? "", /600s default/);
});

test("defaults a declared negative timeout and reports the unusable value", (t) => {
  // arrange
  const hadDebug = Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (hadDebug) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnosticLines: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]): void => {
    diagnosticLines.push(args.join(" "));
  });
  const options = {
    raw: -5,
    event: "UserPromptSubmit",
    pluginId: "negative-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 30);
  assert.strictEqual(diagnosticLines.length, 1);
  assert.match(diagnosticLines[0] ?? "", /^\[hooks\]/);
  assert.match(diagnosticLines[0] ?? "", /unusable timeout -5/);
  assert.match(diagnosticLines[0] ?? "", /negative-plugin\/UserPromptSubmit \(blocking\)/);
  assert.match(diagnosticLines[0] ?? "", /30s default/);
});

test("defaults a declared string timeout and reports the unusable value", (t) => {
  // arrange
  const hadDebug = Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (hadDebug) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnosticLines: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]): void => {
    diagnosticLines.push(args.join(" "));
  });
  const options = {
    raw: "2",
    event: "SessionEnd",
    pluginId: "string-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 1.5);
  assert.strictEqual(diagnosticLines.length, 1);
  assert.match(diagnosticLines[0] ?? "", /^\[hooks\]/);
  assert.match(diagnosticLines[0] ?? "", /unusable timeout "2"/);
  assert.match(diagnosticLines[0] ?? "", /string-plugin\/SessionEnd \(blocking\)/);
  assert.match(diagnosticLines[0] ?? "", /1\.5s default/);
});

test("defaults a declared NaN timeout and reports the serialized unusable value", (t) => {
  // arrange
  const hadDebug = Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (hadDebug) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnosticLines: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]): void => {
    diagnosticLines.push(args.join(" "));
  });
  const options = {
    raw: Number.NaN,
    event: "PostToolUse",
    pluginId: "nan-plugin",
    lane: "background",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 600);
  assert.strictEqual(diagnosticLines.length, 1);
  assert.match(diagnosticLines[0] ?? "", /^\[hooks\]/);
  assert.match(diagnosticLines[0] ?? "", /unusable timeout null/);
  assert.match(diagnosticLines[0] ?? "", /nan-plugin\/PostToolUse \(background\)/);
  assert.match(diagnosticLines[0] ?? "", /600s default/);
});

test("defaults a declared positive-infinity timeout and reports the serialized value", (t) => {
  // arrange
  const hadDebug = Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (hadDebug) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnosticLines: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]): void => {
    diagnosticLines.push(args.join(" "));
  });
  const options = {
    raw: Number.POSITIVE_INFINITY,
    event: "UserPromptSubmit",
    pluginId: "positive-infinity-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 30);
  assert.strictEqual(diagnosticLines.length, 1);
  assert.match(diagnosticLines[0] ?? "", /^\[hooks\]/);
  assert.match(diagnosticLines[0] ?? "", /unusable timeout null/);
  assert.match(diagnosticLines[0] ?? "", /positive-infinity-plugin\/UserPromptSubmit \(blocking\)/);
  assert.match(diagnosticLines[0] ?? "", /30s default/);
});

test("defaults a declared negative-infinity timeout and reports the serialized value", (t) => {
  // arrange
  const hadDebug = Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (hadDebug) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnosticLines: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]): void => {
    diagnosticLines.push(args.join(" "));
  });
  const options = {
    raw: Number.NEGATIVE_INFINITY,
    event: "SessionEnd",
    pluginId: "negative-infinity-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 1.5);
  assert.strictEqual(diagnosticLines.length, 1);
  assert.match(diagnosticLines[0] ?? "", /^\[hooks\]/);
  assert.match(diagnosticLines[0] ?? "", /unusable timeout null/);
  assert.match(diagnosticLines[0] ?? "", /negative-infinity-plugin\/SessionEnd \(blocking\)/);
  assert.match(diagnosticLines[0] ?? "", /1\.5s default/);
});

test("keeps an absent timeout quiet while applying its event default", (t) => {
  // arrange
  const hadDebug = Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (hadDebug) {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    } else {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnosticLines: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]): void => {
    diagnosticLines.push(args.join(" "));
  });
  const options = {
    raw: undefined,
    event: "PreToolUse",
    pluginId: "absent-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 600);
  assert.deepStrictEqual(diagnosticLines, []);
});

test("preserves a large valid positive timeout without an upper clamp", () => {
  // arrange
  const options = {
    raw: 3_600_000,
    event: "PreToolUse",
    pluginId: "large-timeout-plugin",
    lane: "blocking",
  } as const;

  // act
  const timeoutSeconds = resolveTimeoutSeconds(options);

  // assert
  assert.strictEqual(timeoutSeconds, 3_600_000);
});
