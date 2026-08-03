import assert from "node:assert/strict";
import { test } from "node:test";

import { applySessionEnv } from "../../extensions/pi-claude-marketplace/shared/session-env.ts";

/**
 * Contract for `applySessionEnv` (SENV-01/02/03).
 *
 * The setter assigns exactly three keys onto `process.env`:
 *   - CLAUDECODE = "1"                    (SENV-01)
 *   - CLAUDE_CODE_SESSION_ID = sessionId  (SENV-02)
 *   - CLAUDE_SESSION_ID = sessionId       (SENV-03 pi-only shim)
 *
 * The values overwrite unconditionally so they track the active session
 * (SENV-02 freshness after a session switch / reload). Non-interference: no
 * key other than these three is added, removed, or changed -- the before/after
 * delta test is the mechanism that proves no host-identity/entrypoint var is
 * ever set (rather than grepping source).
 */

// Save/restore only the keys these tests manipulate (mirrors the targeted
// save/restore in tests/shared/debug-log.test.ts rather than snapshotting the
// whole environment). Restore uses literal-key deletes so the restore itself
// touches nothing else.
function restoreKey(
  key: "CLAUDECODE" | "CLAUDE_CODE_SESSION_ID" | "CLAUDE_SESSION_ID" | "SENV_TEST_SENTINEL",
  prior: string | undefined,
): void {
  if (prior === undefined) {
    switch (key) {
      case "CLAUDECODE":
        delete process.env.CLAUDECODE;
        break;
      case "CLAUDE_CODE_SESSION_ID":
        delete process.env.CLAUDE_CODE_SESSION_ID;
        break;
      case "CLAUDE_SESSION_ID":
        delete process.env.CLAUDE_SESSION_ID;
        break;
      case "SENV_TEST_SENTINEL":
        delete process.env.SENV_TEST_SENTINEL;
        break;
    }
  } else {
    process.env[key] = prior;
  }
}

function withEnvSnapshot(fn: () => void): void {
  const prior = {
    CLAUDECODE: process.env.CLAUDECODE,
    CLAUDE_CODE_SESSION_ID: process.env.CLAUDE_CODE_SESSION_ID,
    CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
    SENV_TEST_SENTINEL: process.env.SENV_TEST_SENTINEL,
  };
  try {
    fn();
  } finally {
    restoreKey("CLAUDECODE", prior.CLAUDECODE);
    restoreKey("CLAUDE_CODE_SESSION_ID", prior.CLAUDE_CODE_SESSION_ID);
    restoreKey("CLAUDE_SESSION_ID", prior.CLAUDE_SESSION_ID);
    restoreKey("SENV_TEST_SENTINEL", prior.SENV_TEST_SENTINEL);
  }
}

test("applySessionEnv: sets the three session keys to the given id", () => {
  withEnvSnapshot(() => {
    applySessionEnv("abc123");

    assert.equal(process.env.CLAUDECODE, "1");
    assert.equal(process.env.CLAUDE_CODE_SESSION_ID, "abc123");
    assert.equal(process.env.CLAUDE_SESSION_ID, "abc123");
  });
});

test("applySessionEnv: re-invoking overwrites both session-id keys (SENV-02 freshness)", () => {
  withEnvSnapshot(() => {
    applySessionEnv("abc123");
    applySessionEnv("def456");

    assert.equal(process.env.CLAUDECODE, "1");
    assert.equal(process.env.CLAUDE_CODE_SESSION_ID, "def456");
    assert.equal(process.env.CLAUDE_SESSION_ID, "def456");
  });
});

test("applySessionEnv: CLAUDE_CODE_SESSION_ID and CLAUDE_SESSION_ID are distinct keys, same value", () => {
  withEnvSnapshot(() => {
    applySessionEnv("shared-id");

    assert.equal(process.env.CLAUDE_CODE_SESSION_ID, process.env.CLAUDE_SESSION_ID);
    // Distinct keys: mutating one directly does not move the other.
    process.env.CLAUDE_SESSION_ID = "mutated";
    assert.equal(process.env.CLAUDE_CODE_SESSION_ID, "shared-id");
  });
});

test("applySessionEnv: touches exactly the three named keys and nothing else", () => {
  withEnvSnapshot(() => {
    // Seed a sentinel to prove pre-existing keys survive untouched.
    process.env.SENV_TEST_SENTINEL = "keep-me";
    // Clear the target keys first so the delta is measured from a known
    // baseline regardless of ambient env (a host that already exports
    // CLAUDECODE would otherwise mask the assignment).
    delete process.env.CLAUDECODE;
    delete process.env.CLAUDE_CODE_SESSION_ID;
    delete process.env.CLAUDE_SESSION_ID;

    const before = { ...process.env };
    applySessionEnv("abc123");
    const after = { ...process.env };

    const changed = new Set<string>();
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (before[key] !== after[key]) {
        changed.add(key);
      }
    }

    assert.deepEqual(
      [...changed].sort(),
      ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_SESSION_ID"].sort(),
      `expected exactly the three session keys to change, got: ${JSON.stringify([...changed])}`,
    );
    assert.equal(process.env.SENV_TEST_SENTINEL, "keep-me");
  });
});

test("applySessionEnv: empty input assigns empty string verbatim without throwing", () => {
  withEnvSnapshot(() => {
    applySessionEnv("");

    assert.equal(process.env.CLAUDECODE, "1");
    assert.equal(process.env.CLAUDE_CODE_SESSION_ID, "");
    assert.equal(process.env.CLAUDE_SESSION_ID, "");
  });
});
