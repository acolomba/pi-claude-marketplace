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
import test from "node:test";

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

test("buildTranslationContext: snapshots sessionId / transcriptPath / cwd from ExtensionContext", () => {
  const ctx = makeCtx({
    sessionId: "sess-abc-123",
    sessionFile: "/home/user/.pi/agent/sessions/2026-06-14/sess-abc-123.jsonl",
    cwd: "/home/user/project",
  });

  const tc = buildTranslationContext(ctx);

  assert.equal(tc.sessionId, "sess-abc-123");
  assert.equal(tc.transcriptPath, "/home/user/.pi/agent/sessions/2026-06-14/sess-abc-123.jsonl");
  assert.equal(tc.cwd, "/home/user/project");
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
