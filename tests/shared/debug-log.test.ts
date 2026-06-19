import assert from "node:assert/strict";
import { test } from "node:test";

import { hookDebugLog } from "../../extensions/pi-claude-marketplace/shared/debug-log.ts";

/**
 * Env-gated emission contract for `shared/debug-log.ts` (OBS-01 / D-59-05).
 *
 * The seam exposes a single named export `hookDebugLog(detail: string): void`
 * whose ONLY runtime side effect is to forward `[hooks] ${detail}` to
 * `console.error` when `process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1"`. Any
 * other value -- including the natural truthy near-matches `"true"`,
 * `"yes"`, `"ON"`, `"01"`, and the whitespace-padded `" 1 "` -- MUST keep
 * the function silent. Locking the exact-equal `"1"` gate guards against a
 * future fuzzy-truthy refactor that would silently widen the operator-only
 * debug channel (T-59-01-01).
 */

function withDebugEnv(value: string | undefined, fn: () => void): void {
  const prior = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  if (value === undefined) {
    delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  } else {
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = value;
  }

  try {
    fn();
  } finally {
    if (prior === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = prior;
    }
  }
}

test('hookDebugLog: emits when PI_CLAUDE_MARKETPLACE_DEBUG === "1"', (t) => {
  withDebugEnv("1", () => {
    const captured: string[] = [];
    t.mock.method(console, "error", (msg: unknown) => {
      captured.push(String(msg));
    });

    hookDebugLog("sample detail");

    assert.equal(
      captured.length,
      1,
      `expected exactly one console.error call, captured: ${JSON.stringify(captured)}`,
    );
    assert.equal(captured[0], "[hooks] sample detail");
  });
});

test("hookDebugLog: silent when PI_CLAUDE_MARKETPLACE_DEBUG is unset", (t) => {
  withDebugEnv(undefined, () => {
    const captured: string[] = [];
    t.mock.method(console, "error", (msg: unknown) => {
      captured.push(String(msg));
    });

    hookDebugLog("unset detail");

    assert.equal(
      captured.length,
      0,
      `expected no console.error calls, captured: ${JSON.stringify(captured)}`,
    );
  });
});

test('hookDebugLog: silent on env values other than the literal "1"', (t) => {
  // T-59-01-01: lock the exact-equal "1" gate against a future fuzzy-truthy
  // widening. Each near-miss fixture exercises a distinct way an operator or
  // a future refactor might "obviously" truth-check the env var.
  const nonEmittingValues = ["0", "true", "", "yes", "ON", "01", " 1 "];

  for (const value of nonEmittingValues) {
    withDebugEnv(value, () => {
      const captured: string[] = [];
      const mock = t.mock.method(console, "error", (msg: unknown) => {
        captured.push(String(msg));
      });

      hookDebugLog(`detail for value ${JSON.stringify(value)}`);

      assert.equal(
        captured.length,
        0,
        `expected no console.error for env value ${JSON.stringify(value)}, captured: ${JSON.stringify(captured)}`,
      );

      mock.mock.restore();
    });
  }
});
