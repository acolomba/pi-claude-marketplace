// Unit tests for `buildTranslationContext` (D-60-06 / PAYL-01).
//
// The factory snapshots three dispatch-time fields a translator needs
// from a Pi `ExtensionContext`. Two cases pin the contract:
//
//   - `getSessionFile()` returns a string -> `transcriptPath` is that
//     string verbatim;
//   - `getSessionFile()` returns `undefined` -> `transcriptPath` is the
//     empty string fallback (the first `SessionStart` may fire before
//     Pi creates the session file).

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SessionManager } from "@earendil-works/pi-coding-agent";

import { buildTranslationContext } from "../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";

import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

function makeCtx(args: {
  sessionId: string;
  sessionFile: string | undefined;
  cwd: string;
}): ExtensionContext {
  // Minimal `ExtensionContext` stub. Only the three fields the factory
  // reads (`sessionManager.getSessionId`, `sessionManager.getSessionFile`,
  // `cwd`) need to be populated; the cast through `unknown` keeps the
  // stub focused on the contract under test.
  return {
    cwd: args.cwd,
    sessionManager: {
      getSessionId: () => args.sessionId,
      getSessionFile: () => args.sessionFile,
    },
  } as unknown as ExtensionContext;
}

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
    });
  } finally {
    await rm(sessionRoot, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 2: D-60-06 -- transcriptPath empty-string fallback
// ──────────────────────────────────────────────────────────────────────────

test("buildTranslationContext: transcriptPath falls back to empty string when getSessionFile returns undefined", () => {
  // Pi creates the session file lazily; the first `SessionStart` with
  // `reason: "startup"` may fire before any file exists. The empty
  // string is preferred over a synthesized fake path so a hook reading
  // `transcript_path` can defensively check for empty rather than
  // opening a nonexistent file.
  const ctx = makeCtx({
    sessionId: "sess-fresh",
    sessionFile: undefined,
    cwd: "/tmp/fresh-project",
  });

  const tc = buildTranslationContext(ctx);

  assert.equal(tc.sessionId, "sess-fresh");
  assert.equal(tc.transcriptPath, "");
  assert.equal(tc.cwd, "/tmp/fresh-project");
});
