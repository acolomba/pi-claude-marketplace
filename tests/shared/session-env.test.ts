import assert from "node:assert/strict";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  ADAPTER_EMPTY_ENV,
  applyMcpAdapterEnv,
  applyPathLedger,
  applySessionEnv,
  claudeSessionEnvFor,
  PATH_LEDGER_ENV,
} from "../../extensions/pi-claude-marketplace/shared/session-env.ts";

describe("claudeSessionEnvFor", () => {
  test("returns the exact session environment triple", () => {
    // arrange
    const sessionId = "session-123";

    // act
    const sessionEnv = claudeSessionEnvFor(sessionId);

    // assert
    assert.deepStrictEqual(sessionEnv, {
      CLAUDECODE: "1",
      CLAUDE_CODE_SESSION_ID: "session-123",
      CLAUDE_SESSION_ID: "session-123",
    });
  });

  test("preserves an empty session identifier", () => {
    // arrange
    const sessionId = "";

    // act
    const sessionEnv = claudeSessionEnvFor(sessionId);

    // assert
    assert.deepStrictEqual(sessionEnv, {
      CLAUDECODE: "1",
      CLAUDE_CODE_SESSION_ID: "",
      CLAUDE_SESSION_ID: "",
    });
  });
});

describe("applySessionEnv", () => {
  test("writes only the session triple and preserves an unrelated key", (t) => {
    // arrange
    const previousClaudeCode = process.env.CLAUDECODE;
    const previousClaudeCodeSessionId = process.env.CLAUDE_CODE_SESSION_ID;
    const previousClaudeSessionId = process.env.CLAUDE_SESSION_ID;
    const previousSentinel = process.env.SENV_TEST_SENTINEL;
    t.after(() => {
      if (previousClaudeCode === undefined) {
        delete process.env.CLAUDECODE;
      } else {
        process.env.CLAUDECODE = previousClaudeCode;
      }

      if (previousClaudeCodeSessionId === undefined) {
        delete process.env.CLAUDE_CODE_SESSION_ID;
      } else {
        process.env.CLAUDE_CODE_SESSION_ID = previousClaudeCodeSessionId;
      }

      if (previousClaudeSessionId === undefined) {
        delete process.env.CLAUDE_SESSION_ID;
      } else {
        process.env.CLAUDE_SESSION_ID = previousClaudeSessionId;
      }

      if (previousSentinel === undefined) {
        delete process.env.SENV_TEST_SENTINEL;
      } else {
        process.env.SENV_TEST_SENTINEL = previousSentinel;
      }
    });
    process.env.CLAUDECODE = "0";
    process.env.CLAUDE_CODE_SESSION_ID = "old-code-session";
    process.env.CLAUDE_SESSION_ID = "old-session";
    process.env.SENV_TEST_SENTINEL = "keep-me";
    const environmentBefore = { ...process.env };

    // act
    applySessionEnv("session-123");

    // assert
    const environmentAfter = { ...process.env };
    const changedKeys = [
      ...new Set([...Object.keys(environmentBefore), ...Object.keys(environmentAfter)]),
    ]
      .filter((key) => environmentBefore[key] !== environmentAfter[key])
      .sort();
    assert.deepStrictEqual(changedKeys, [
      "CLAUDECODE",
      "CLAUDE_CODE_SESSION_ID",
      "CLAUDE_SESSION_ID",
    ]);
    assert.deepStrictEqual(
      {
        CLAUDECODE: process.env.CLAUDECODE,
        CLAUDE_CODE_SESSION_ID: process.env.CLAUDE_CODE_SESSION_ID,
        CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
        SENV_TEST_SENTINEL: process.env.SENV_TEST_SENTINEL,
      },
      {
        CLAUDECODE: "1",
        CLAUDE_CODE_SESSION_ID: "session-123",
        CLAUDE_SESSION_ID: "session-123",
        SENV_TEST_SENTINEL: "keep-me",
      },
    );
  });

  test("refreshes every owned key for the active session", (t) => {
    // arrange
    const previousClaudeCode = process.env.CLAUDECODE;
    const previousClaudeCodeSessionId = process.env.CLAUDE_CODE_SESSION_ID;
    const previousClaudeSessionId = process.env.CLAUDE_SESSION_ID;
    t.after(() => {
      if (previousClaudeCode === undefined) {
        delete process.env.CLAUDECODE;
      } else {
        process.env.CLAUDECODE = previousClaudeCode;
      }

      if (previousClaudeCodeSessionId === undefined) {
        delete process.env.CLAUDE_CODE_SESSION_ID;
      } else {
        process.env.CLAUDE_CODE_SESSION_ID = previousClaudeCodeSessionId;
      }

      if (previousClaudeSessionId === undefined) {
        delete process.env.CLAUDE_SESSION_ID;
      } else {
        process.env.CLAUDE_SESSION_ID = previousClaudeSessionId;
      }
    });
    process.env.CLAUDECODE = "stale";
    process.env.CLAUDE_CODE_SESSION_ID = "stale-code-session";
    process.env.CLAUDE_SESSION_ID = "stale-session";

    // act
    applySessionEnv("first-session");
    applySessionEnv("active-session");

    // assert
    assert.deepStrictEqual(
      {
        CLAUDECODE: process.env.CLAUDECODE,
        CLAUDE_CODE_SESSION_ID: process.env.CLAUDE_CODE_SESSION_ID,
        CLAUDE_SESSION_ID: process.env.CLAUDE_SESSION_ID,
      },
      {
        CLAUDECODE: "1",
        CLAUDE_CODE_SESSION_ID: "active-session",
        CLAUDE_SESSION_ID: "active-session",
      },
    );
  });
});

describe("PATH_LEDGER_ENV", () => {
  test("uses the exact public ledger key", () => {
    // arrange
    const expectedLedgerKey = "PI_CLAUDE_MARKETPLACE_PATH";

    // act
    const ledgerKey = PATH_LEDGER_ENV;

    // assert
    assert.strictEqual(ledgerKey, expectedLedgerKey);
  });
});

describe("ADAPTER_EMPTY_ENV", () => {
  test("AVAR-03: uses the exact reserved empty-variable key", () => {
    // arrange
    const expectedEmptyKey = "PI_CLAUDE_MARKETPLACE_EMPTY";

    // act
    const emptyKey = ADAPTER_EMPTY_ENV;

    // assert
    assert.strictEqual(emptyKey, expectedEmptyKey);
  });
});

/** Restores each key the case touches; an absent key is deleted, not stringified. */
function restoreEnvAfter(t: TestContext, keys: readonly string[]): void {
  const saved = keys.map((key) => {
    return { key, previous: process.env[key] };
  });
  t.after(() => {
    for (const { key, previous } of saved) {
      if (previous === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = previous;
      }
    }
  });
}

describe("applyMcpAdapterEnv", () => {
  test("AVAR-01: sets the reserved empty variable and CLAUDE_PROJECT_DIR to the cwd", (t) => {
    // arrange
    restoreEnvAfter(t, ["PI_CLAUDE_MARKETPLACE_EMPTY", "CLAUDE_PROJECT_DIR"]);
    Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_EMPTY");
    process.env.CLAUDE_PROJECT_DIR = "/work/previous";

    // act
    const exported = applyMcpAdapterEnv("/work/project");

    // assert
    assert.strictEqual(exported, true);
    assert.deepStrictEqual(
      {
        PI_CLAUDE_MARKETPLACE_EMPTY: process.env.PI_CLAUDE_MARKETPLACE_EMPTY,
        CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
      },
      { PI_CLAUDE_MARKETPLACE_EMPTY: "", CLAUDE_PROJECT_DIR: "/work/project" },
    );
  });

  test("AVAR-03: overwrites a non-empty reserved value with the empty string", (t) => {
    // arrange
    restoreEnvAfter(t, ["PI_CLAUDE_MARKETPLACE_EMPTY", "CLAUDE_PROJECT_DIR"]);
    process.env.PI_CLAUDE_MARKETPLACE_EMPTY = "user-value";

    // act
    applyMcpAdapterEnv("/work/project");

    // assert
    assert.strictEqual(process.env.PI_CLAUDE_MARKETPLACE_EMPTY, "");
  });

  for (const cwd of ["/work/$env:HOME", "/work/{env:SECRET}"]) {
    test(`AVAR-01: does not export the cwd ${cwd} and still sets the reserved variable`, (t) => {
      // arrange
      restoreEnvAfter(t, ["PI_CLAUDE_MARKETPLACE_EMPTY", "CLAUDE_PROJECT_DIR"]);
      process.env.PI_CLAUDE_MARKETPLACE_EMPTY = "user-value";
      process.env.CLAUDE_PROJECT_DIR = "/work/previous";

      // act
      const exported = applyMcpAdapterEnv(cwd);

      // assert
      assert.strictEqual(exported, false);
      assert.deepStrictEqual(
        {
          PI_CLAUDE_MARKETPLACE_EMPTY: process.env.PI_CLAUDE_MARKETPLACE_EMPTY,
          CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
        },
        { PI_CLAUDE_MARKETPLACE_EMPTY: "", CLAUDE_PROJECT_DIR: "/work/previous" },
      );
    });
  }

  test("AVAR-01: leaves the session triple and an unrelated key unchanged", (t) => {
    // arrange
    const keys = [
      "PI_CLAUDE_MARKETPLACE_EMPTY",
      "CLAUDE_PROJECT_DIR",
      "CLAUDECODE",
      "CLAUDE_CODE_SESSION_ID",
      "CLAUDE_SESSION_ID",
      "SENV_TEST_SENTINEL",
    ];
    restoreEnvAfter(t, keys);
    process.env.CLAUDECODE = "1";
    process.env.CLAUDE_CODE_SESSION_ID = "session-1";
    process.env.CLAUDE_SESSION_ID = "session-1";
    process.env.SENV_TEST_SENTINEL = "sentinel";

    // act
    applyMcpAdapterEnv("/work/project");

    // assert
    assert.deepStrictEqual(
      keys.map((key) => process.env[key]),
      ["", "/work/project", "1", "session-1", "session-1", "sentinel"],
    );
  });
});

describe("applyPathLedger", () => {
  test("removes owned entries and appends fresh entries in stable order", () => {
    // arrange
    const delimiter = path.delimiter;
    const currentPath = `/system${delimiter}/owned-a${delimiter}/tools${delimiter}/owned-b`;
    const priorLedger = `/owned-a${delimiter}/owned-b`;
    const freshBinDirs = ["/plugin-b", "/plugin-a"];

    // act
    const pathUpdate = applyPathLedger(currentPath, priorLedger, freshBinDirs);

    // assert
    assert.deepStrictEqual(pathUpdate, {
      path: `/system${delimiter}/tools${delimiter}/plugin-b${delimiter}/plugin-a`,
      ledger: `/plugin-b${delimiter}/plugin-a`,
    });
  });

  for (const { name, currentPath, priorLedger, freshBinDirs, expectedPathUpdate } of [
    {
      name: "keeps empty inputs byte-empty",
      currentPath: "",
      priorLedger: "",
      freshBinDirs: [],
      expectedPathUpdate: { path: "", ledger: "" },
    },
    {
      name: "preserves a non-owned path when the ledger and fresh list are empty",
      currentPath: `/system${path.delimiter}/tools`,
      priorLedger: "",
      freshBinDirs: [],
      expectedPathUpdate: { path: `/system${path.delimiter}/tools`, ledger: "" },
    },
    {
      name: "appends one fresh entry to an empty path without a leading delimiter",
      currentPath: "",
      priorLedger: "",
      freshBinDirs: ["/plugin-a"],
      expectedPathUpdate: { path: "/plugin-a", ledger: "/plugin-a" },
    },
    {
      name: "deduplicates existing and repeated fresh entries",
      currentPath: `/system${path.delimiter}/plugin-a`,
      priorLedger: "",
      freshBinDirs: ["/plugin-a", "/plugin-b", "/plugin-b"],
      expectedPathUpdate: {
        path: `/system${path.delimiter}/plugin-a${path.delimiter}/plugin-b`,
        ledger: "/plugin-b",
      },
    },
    {
      name: "ignores a relative ledger entry beside an absolute owned entry",
      currentPath: `relative${path.delimiter}/owned${path.delimiter}/tail`,
      priorLedger: `relative${path.delimiter}/owned`,
      freshBinDirs: [],
      expectedPathUpdate: { path: `relative${path.delimiter}/tail`, ledger: "" },
    },
    {
      name: "preserves leading, interior, and trailing empty path segments",
      currentPath: `${path.delimiter}/system${path.delimiter}${path.delimiter}/owned${path.delimiter}`,
      priorLedger: "/owned",
      freshBinDirs: [],
      expectedPathUpdate: {
        path: `${path.delimiter}/system${path.delimiter}${path.delimiter}`,
        ledger: "",
      },
    },
    {
      name: "removes every occurrence of an owned entry without reordering survivors",
      currentPath: `/head${path.delimiter}/owned${path.delimiter}/middle${path.delimiter}/owned${path.delimiter}/tail`,
      priorLedger: "/owned",
      freshBinDirs: [],
      expectedPathUpdate: {
        path: `/head${path.delimiter}/middle${path.delimiter}/tail`,
        ledger: "",
      },
    },
  ]) {
    test(name, () => {
      // arrange
      const expectedUpdate = expectedPathUpdate;

      // act
      const pathUpdate = applyPathLedger(currentPath, priorLedger, freshBinDirs);

      // assert
      assert.deepStrictEqual(pathUpdate, expectedUpdate);
    });
  }

  test("is byte-idempotent across repeated recomputes", () => {
    // arrange
    const delimiter = path.delimiter;
    const expectedPathUpdate = {
      path: `/system${delimiter}/plugin-a${delimiter}/plugin-b`,
      ledger: `/plugin-a${delimiter}/plugin-b`,
    };

    // act
    const firstPathUpdate = applyPathLedger("/system", "", ["/plugin-a", "/plugin-b"]);
    const secondPathUpdate = applyPathLedger(firstPathUpdate.path, firstPathUpdate.ledger, [
      "/plugin-a",
      "/plugin-b",
    ]);

    // assert
    assert.deepStrictEqual(firstPathUpdate, expectedPathUpdate);
    assert.deepStrictEqual(secondPathUpdate, expectedPathUpdate);
  });
});
