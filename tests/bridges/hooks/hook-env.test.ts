import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { prepareHookEnv } from "../../../extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { TranslationContext } from "../../../extensions/pi-claude-marketplace/bridges/hooks/translation-context.ts";

test("applies every SessionStart environment precedence layer", async (t) => {
  // arrange
  const mutatedKeys = [
    "CLAUDE_PROJECT_DIR",
    "CLAUDE_PLUGIN_ROOT",
    "CLAUDE_PLUGIN_DATA",
    "PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH",
    "CLAUDECODE",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_SESSION_ID",
    "CLAUDE_ENV_FILE",
    "CLAUDE_CODE_REMOTE",
    "P112_HOOK_ENV_INHERITED",
  ] as const;
  const priorEnvironment = mutatedKeys.map((key) => ({
    key,
    existed: Object.hasOwn(process.env, key),
    value: process.env[key],
  }));
  const restoreEnvironment = (): void => {
    for (const prior of priorEnvironment) {
      if (prior.existed) {
        process.env[prior.key] = prior.value;
      } else {
        delete process.env[prior.key];
      }
    }
  };
  t.after(restoreEnvironment);

  process.env.CLAUDE_PROJECT_DIR = "process-project";
  process.env.CLAUDE_PLUGIN_ROOT = "process-plugin-root";
  process.env.CLAUDE_PLUGIN_DATA = "process-plugin-data";
  process.env.PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH = "process-marker";
  process.env.CLAUDECODE = "process-claudecode";
  process.env.CLAUDE_CODE_SESSION_ID = "process-code-session";
  process.env.CLAUDE_SESSION_ID = "process-session";
  process.env.CLAUDE_ENV_FILE = "process-env-file";
  delete process.env.CLAUDE_CODE_REMOTE;
  process.env.P112_HOOK_ENV_INHERITED = "inherited-value";
  const processInput = { ...process.env };
  const entry = {
    scope: "project",
    marketplace: "catalog",
    pluginId: "plugin-alpha",
    resolvedSource: asAbsolutePluginRoot("/plugins/plugin-alpha"),
    claudeEvent: "SessionStart",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "/bin/true" },
    declarationIndex: 4,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const translationContext = {
    sessionId: "session-alpha",
    transcriptPath: "/sessions/session-alpha.jsonl",
    cwd: "/work/project-alpha",
  } satisfies TranslationContext;
  const locations = locationsFor("project", "/scope/project-alpha");
  const extra = {
    PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH: "extra-marker",
    CLAUDECODE: "extra-claudecode",
    CLAUDE_CODE_SESSION_ID: "extra-code-session",
    CLAUDE_SESSION_ID: "extra-session",
    CLAUDE_ENV_FILE: "extra-env-file",
    P112_HOOK_ENV_EXTRA: "extra-only-value",
  } satisfies NodeJS.ProcessEnv;
  const expectedEnvironment = {
    ...processInput,
    CLAUDE_PROJECT_DIR: "/work/project-alpha",
    CLAUDE_PLUGIN_ROOT: "/plugins/plugin-alpha",
    CLAUDE_PLUGIN_DATA: path.join(
      "/scope/project-alpha",
      ".pi",
      "pi-claude-marketplace",
      "data",
      "plugin-alpha",
    ),
    PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH: "extra-marker",
    CLAUDECODE: "1",
    CLAUDE_CODE_SESSION_ID: "session-alpha",
    CLAUDE_SESSION_ID: "session-alpha",
    CLAUDE_ENV_FILE: path.join(
      "/scope/project-alpha",
      ".pi",
      "pi-claude-marketplace",
      "data",
      "_shared",
      "claude-env-session-alpha.env",
    ),
    P112_HOOK_ENV_EXTRA: "extra-only-value",
  } satisfies NodeJS.ProcessEnv;

  // act
  const environment = await prepareHookEnv(entry, translationContext, locations, extra);
  restoreEnvironment();

  // assert
  assert.deepStrictEqual(environment, expectedEnvironment);
  assert.strictEqual(Object.hasOwn(environment, "CLAUDE_CODE_REMOTE"), false);
  assert.deepStrictEqual(
    mutatedKeys.map((key) => ({
      key,
      existed: Object.hasOwn(process.env, key),
      value: process.env[key],
    })),
    priorEnvironment,
  );
});
