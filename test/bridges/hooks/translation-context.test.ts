// Unit tests for `buildTranslationContext` and `childHookIdentityOf`
// (D-60-06 / PAYL-01, D-PG6-09, D-PG6-01..03).
//
// The factory snapshots the dispatch-time fields a translator needs
// from a Pi `ExtensionContext`:
//
//   - `getSessionFile()` returns a string -> `transcriptPath` is that
//     string verbatim;
//   - `getSessionFile()` returns `undefined` -> `transcriptPath` is the
//     empty string fallback (the first `SessionStart` may fire before
//     Pi creates the session file);
//   - the active model's id and the session's name are copied when Pi has
//     them and left out when it has none;
//   - a known child's root, when it has one, gives the hook-facing session
//     fields, and `ownSessionId` stays the child's own (D-PG6-01, D-PG6-03).

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import {
  buildTranslationContext,
  childHookIdentityOf,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";

import type { TranslationContext } from "../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";
import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

interface SessionFacts {
  readonly model?: NonNullable<ExtensionContext["model"]>;
  readonly sessionName?: string;
  /** A folder for a saved session, whose file Pi names before it writes it. */
  readonly sessionDir?: string;
}

function inMemoryContext(
  sessionId: string,
  cwd: string,
  facts: SessionFacts = {},
): ExtensionContext {
  const sessionManager =
    facts.sessionDir === undefined
      ? SessionManager.inMemory(cwd, { id: sessionId })
      : SessionManager.create(cwd, facts.sessionDir, { id: sessionId });
  if (facts.sessionName !== undefined) {
    sessionManager.appendSessionInfo(facts.sessionName);
  }

  return {
    get ui(): ExtensionContext["ui"] {
      throw new Error("buildTranslationContext must not read ui");
    },
    mode: "print",
    hasUI: false,
    cwd,
    sessionManager,
    get modelRegistry(): ExtensionContext["modelRegistry"] {
      throw new Error("buildTranslationContext must not read modelRegistry");
    },
    model: facts.model,
    scopedModels: [],
    isIdle(): never {
      throw new Error("buildTranslationContext must not call isIdle");
    },
    isProjectTrusted(): never {
      throw new Error("buildTranslationContext must not call isProjectTrusted");
    },
    signal: undefined,
    abort(): never {
      throw new Error("buildTranslationContext must not call abort");
    },
    hasPendingMessages(): never {
      throw new Error("buildTranslationContext must not call hasPendingMessages");
    },
    shutdown(): never {
      throw new Error("buildTranslationContext must not call shutdown");
    },
    getContextUsage(): never {
      throw new Error("buildTranslationContext must not call getContextUsage");
    },
    compact(): never {
      throw new Error("buildTranslationContext must not call compact");
    },
    getSystemPrompt(): never {
      throw new Error("buildTranslationContext must not call getSystemPrompt");
    },
  } satisfies ExtensionContext;
}

const SONNET_MODEL = {
  id: "sonnet-5",
  name: "Sonnet 5",
  api: "anthropic-messages",
  provider: "anthropic",
  baseUrl: "https://models.example.invalid",
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  reasoning: false,
  contextWindow: 200_000,
  maxTokens: 8_192,
} satisfies NonNullable<ExtensionContext["model"]>;

const typedTranslationContext: TranslationContext = {
  sessionId: "session-type",
  transcriptPath: "/sessions/session-type.jsonl",
  cwd: "/workspace/type-contract",
} satisfies TranslationContext;
void typedTranslationContext;

// @ts-expect-error translation-context session identities are readonly
typedTranslationContext.sessionId = "session-changed";
// @ts-expect-error translation-context transcript paths are readonly
typedTranslationContext.transcriptPath = "/sessions/changed.jsonl";
// @ts-expect-error translation-context working directories are readonly
typedTranslationContext.cwd = "/workspace/changed";

void ({
  // @ts-expect-error translation-context session identities must be strings
  sessionId: 42,
  transcriptPath: "/sessions/typed.jsonl",
  cwd: "/workspace/typed",
} satisfies TranslationContext);
void ({
  sessionId: "session-typed",
  // @ts-expect-error translation-context transcript paths must be strings
  transcriptPath: 42,
  cwd: "/workspace/typed",
} satisfies TranslationContext);
void ({
  sessionId: "session-typed",
  transcriptPath: "/sessions/typed.jsonl",
  // @ts-expect-error translation-context working directories must be strings
  cwd: 42,
} satisfies TranslationContext);

describe("buildTranslationContext", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Block 1: PAYL-01 happy path -- all three fields populated
  // ──────────────────────────────────────────────────────────────────────────

  test("snapshots the complete session identity and working directory", async () => {
    // arrange
    const sessionRoot = await mkdtemp(join(tmpdir(), "translation-context-"));
    const transcriptPath = join(sessionRoot, "session-owned.jsonl");
    const cwd = "/workspace/translation-context";
    await writeFile(
      transcriptPath,
      `${JSON.stringify({
        type: "session",
        version: 3,
        id: "session-owned",
        timestamp: "2026-08-31T12:00:00.000Z",
        cwd,
      })}\n`,
    );

    try {
      const sessionManager = SessionManager.open(transcriptPath, sessionRoot);
      const extensionContext = {
        get ui(): ExtensionContext["ui"] {
          throw new Error("buildTranslationContext must not read ui");
        },
        mode: "print",
        hasUI: false,
        cwd,
        sessionManager,
        get modelRegistry(): ExtensionContext["modelRegistry"] {
          throw new Error("buildTranslationContext must not read modelRegistry");
        },
        model: undefined,
        scopedModels: [],
        isIdle(): never {
          throw new Error("buildTranslationContext must not call isIdle");
        },
        isProjectTrusted(): never {
          throw new Error("buildTranslationContext must not call isProjectTrusted");
        },
        signal: undefined,
        abort(): never {
          throw new Error("buildTranslationContext must not call abort");
        },
        hasPendingMessages(): never {
          throw new Error("buildTranslationContext must not call hasPendingMessages");
        },
        shutdown(): never {
          throw new Error("buildTranslationContext must not call shutdown");
        },
        getContextUsage(): never {
          throw new Error("buildTranslationContext must not call getContextUsage");
        },
        compact(): never {
          throw new Error("buildTranslationContext must not call compact");
        },
        getSystemPrompt(): never {
          throw new Error("buildTranslationContext must not call getSystemPrompt");
        },
      } satisfies ExtensionContext;

      // act
      const translationContext = buildTranslationContext(extensionContext);

      // assert
      assert.deepStrictEqual(translationContext, {
        sessionId: "session-owned",
        transcriptPath,
        cwd: "/workspace/translation-context",
        ownSessionId: "session-owned",
      });
    } finally {
      await rm(sessionRoot, { recursive: true, force: true });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Block 2: D-60-06 -- transcriptPath empty-string fallback
  // ──────────────────────────────────────────────────────────────────────────

  test("uses an empty transcript path for an in-memory session", () => {
    // arrange
    const cwd = "/workspace/empty-session";
    const sessionManager = SessionManager.inMemory(cwd, { id: "session-empty" });
    const extensionContext = {
      get ui(): ExtensionContext["ui"] {
        throw new Error("buildTranslationContext must not read ui");
      },
      mode: "print",
      hasUI: false,
      cwd,
      sessionManager,
      get modelRegistry(): ExtensionContext["modelRegistry"] {
        throw new Error("buildTranslationContext must not read modelRegistry");
      },
      model: undefined,
      scopedModels: [],
      isIdle(): never {
        throw new Error("buildTranslationContext must not call isIdle");
      },
      isProjectTrusted(): never {
        throw new Error("buildTranslationContext must not call isProjectTrusted");
      },
      signal: undefined,
      abort(): never {
        throw new Error("buildTranslationContext must not call abort");
      },
      hasPendingMessages(): never {
        throw new Error("buildTranslationContext must not call hasPendingMessages");
      },
      shutdown(): never {
        throw new Error("buildTranslationContext must not call shutdown");
      },
      getContextUsage(): never {
        throw new Error("buildTranslationContext must not call getContextUsage");
      },
      compact(): never {
        throw new Error("buildTranslationContext must not call compact");
      },
      getSystemPrompt(): never {
        throw new Error("buildTranslationContext must not call getSystemPrompt");
      },
    } satisfies ExtensionContext;

    // act
    const translationContext = buildTranslationContext(extensionContext);

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "session-empty",
      transcriptPath: "",
      cwd: "/workspace/empty-session",
      ownSessionId: "session-empty",
    });
  });

  test("copies a matching child identity into the current session snapshot", () => {
    // arrange
    const context = inMemoryContext("child-session", "/workspace/child");
    const identity = { agentType: 'review&"<agent>', sessionId: "child-session" };

    // act
    const translationContext = buildTranslationContext(context, identity);
    identity.agentType = "changed";

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "child-session",
      transcriptPath: "",
      cwd: "/workspace/child",
      ownSessionId: "child-session",
      childIdentity: { agentType: 'review&"<agent>', sessionId: "child-session" },
    });
  });

  test("omits a child identity from another session", () => {
    // arrange
    const context = inMemoryContext("current-session", "/workspace/child");

    // act
    const translationContext = buildTranslationContext(context, {
      agentType: "reviewer",
      sessionId: "stale-session",
    });

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "current-session",
      transcriptPath: "",
      cwd: "/workspace/child",
      ownSessionId: "current-session",
    });
    assert.strictEqual(Object.hasOwn(translationContext, "childIdentity"), false);
  });

  test("copies the active model's bare id and the session's name (D-PG6-09)", () => {
    // arrange
    const context = inMemoryContext("named-session", "/workspace/named", {
      model: SONNET_MODEL,
      sessionName: "Release prep",
    });

    // act
    const translationContext = buildTranslationContext(context);

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "named-session",
      transcriptPath: "",
      cwd: "/workspace/named",
      ownSessionId: "named-session",
      model: "sonnet-5",
      sessionTitle: "Release prep",
    });
  });

  test("leaves out the model and the title when Pi has no model and no session name (D-PG6-09)", () => {
    // arrange
    const context = inMemoryContext("unnamed-session", "/workspace/unnamed");

    // act
    const translationContext = buildTranslationContext(context);

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "unnamed-session",
      transcriptPath: "",
      cwd: "/workspace/unnamed",
      ownSessionId: "unnamed-session",
    });
    assert.strictEqual(Object.hasOwn(translationContext, "model"), false);
    assert.strictEqual(Object.hasOwn(translationContext, "sessionTitle"), false);
  });

  test("leaves out the title of a session whose name is empty (D-PG6-09)", () => {
    // arrange
    const context = inMemoryContext("cleared-session", "/workspace/cleared", {
      model: SONNET_MODEL,
      sessionName: "",
    });

    // act
    const translationContext = buildTranslationContext(context);

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "cleared-session",
      transcriptPath: "",
      cwd: "/workspace/cleared",
      ownSessionId: "cleared-session",
      model: "sonnet-5",
    });
    assert.strictEqual(Object.hasOwn(translationContext, "sessionTitle"), false);
  });

  test("names the launching session for a known child with a root (D-PG6-01)", async (t) => {
    // arrange
    const sessionDir = await mkdtemp(join(tmpdir(), "translation-context-root-"));
    t.after(() => rm(sessionDir, { recursive: true, force: true }));
    const context = inMemoryContext("child-session", "/workspace/child", { sessionDir });
    const identity = {
      agentType: "reviewer",
      sessionId: "child-session",
      root: { sessionId: "main-session", transcriptPath: "/sessions/main-session.jsonl" },
    };

    // act
    const translationContext = buildTranslationContext(context, identity);

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "main-session",
      transcriptPath: "/sessions/main-session.jsonl",
      cwd: "/workspace/child",
      ownSessionId: "child-session",
      childIdentity: { agentType: "reviewer", sessionId: "child-session" },
    });
  });

  test("sends an empty transcript path for a root with no file (D-PG6-02)", async (t) => {
    // arrange
    const sessionDir = await mkdtemp(join(tmpdir(), "translation-context-root-"));
    t.after(() => rm(sessionDir, { recursive: true, force: true }));
    const context = inMemoryContext("child-session", "/workspace/child", { sessionDir });

    // act
    const translationContext = buildTranslationContext(context, {
      agentType: "reviewer",
      sessionId: "child-session",
      root: { sessionId: "main-session", transcriptPath: "" },
    });

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "main-session",
      transcriptPath: "",
      cwd: "/workspace/child",
      ownSessionId: "child-session",
      childIdentity: { agentType: "reviewer", sessionId: "child-session" },
    });
  });

  test("keeps the own session of a known child with no root (D-PG6-02)", async (t) => {
    // arrange
    const sessionDir = await mkdtemp(join(tmpdir(), "translation-context-root-"));
    t.after(() => rm(sessionDir, { recursive: true, force: true }));
    const context = inMemoryContext("child-session", "/workspace/child", { sessionDir });
    const ownFile = context.sessionManager.getSessionFile();
    assert.ok(ownFile !== undefined);

    // act
    const translationContext = buildTranslationContext(context, {
      agentType: "reviewer",
      sessionId: "child-session",
    });

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "child-session",
      transcriptPath: ownFile,
      cwd: "/workspace/child",
      ownSessionId: "child-session",
      childIdentity: { agentType: "reviewer", sessionId: "child-session" },
    });
  });

  test("ignores the root of an identity captured for another session (D-PG6-03)", async (t) => {
    // arrange
    const sessionDir = await mkdtemp(join(tmpdir(), "translation-context-root-"));
    t.after(() => rm(sessionDir, { recursive: true, force: true }));
    const context = inMemoryContext("current-session", "/workspace/child", { sessionDir });
    const ownFile = context.sessionManager.getSessionFile();
    assert.ok(ownFile !== undefined);

    // act
    const translationContext = buildTranslationContext(context, {
      agentType: "reviewer",
      sessionId: "stale-session",
      root: { sessionId: "main-session", transcriptPath: "/sessions/main-session.jsonl" },
    });

    // assert
    assert.deepStrictEqual(translationContext, {
      sessionId: "current-session",
      transcriptPath: ownFile,
      cwd: "/workspace/child",
      ownSessionId: "current-session",
    });
  });
});

describe("childHookIdentityOf", () => {
  test("gives no identity to a main session", () => {
    // act
    const identity = childHookIdentityOf({ kind: "main" });

    // assert
    assert.strictEqual(identity, undefined);
  });

  test("gives no identity to a child whose identity is unavailable", () => {
    // act
    const identity = childHookIdentityOf({ kind: "unavailable" });

    // assert
    assert.strictEqual(identity, undefined);
  });

  test("gives a known child's agent and own session", () => {
    // act
    const identity = childHookIdentityOf({
      kind: "known",
      agentType: "reviewer",
      childId: "child-session",
    });

    // assert
    assert.deepStrictEqual(identity, { agentType: "reviewer", sessionId: "child-session" });
  });

  test("gives a known child's root with its identity (D-PG6-02)", () => {
    // act
    const identity = childHookIdentityOf({
      kind: "known",
      agentType: "reviewer",
      childId: "child-session",
      root: { sessionId: "main-session", transcriptPath: "/sessions/main-session.jsonl" },
    });

    // assert
    assert.deepStrictEqual(identity, {
      agentType: "reviewer",
      sessionId: "child-session",
      root: { sessionId: "main-session", transcriptPath: "/sessions/main-session.jsonl" },
    });
  });
});
