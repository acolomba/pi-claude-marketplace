import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { prepareHookEnv } from "../../../extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { PathContainmentError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

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
        Reflect.deleteProperty(process.env, prior.key);
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

test("omits event-specific keys while preserving a user-scope inherited key", async (t) => {
  // arrange
  const mutatedKeys = [
    "PI_CODING_AGENT_DIR",
    "CLAUDE_PROJECT_DIR",
    "CLAUDE_PLUGIN_ROOT",
    "CLAUDE_PLUGIN_DATA",
    "CLAUDECODE",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_SESSION_ID",
    "CLAUDE_ENV_FILE",
    "CLAUDE_CODE_REMOTE",
    "P112_HOOK_ENV_UNKNOWN",
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
        Reflect.deleteProperty(process.env, prior.key);
      }
    }
  };

  t.after(restoreEnvironment);

  process.env.PI_CODING_AGENT_DIR = "/scope/user-agent";
  process.env.CLAUDE_PROJECT_DIR = "process-project";
  process.env.CLAUDE_PLUGIN_ROOT = "process-plugin-root";
  process.env.CLAUDE_PLUGIN_DATA = "process-plugin-data";
  process.env.CLAUDECODE = "process-claudecode";
  process.env.CLAUDE_CODE_SESSION_ID = "process-code-session";
  process.env.CLAUDE_SESSION_ID = "process-session";
  delete process.env.CLAUDE_ENV_FILE;
  delete process.env.CLAUDE_CODE_REMOTE;
  process.env.P112_HOOK_ENV_UNKNOWN = "inherited-unknown-value";
  const processInput = { ...process.env };
  const entry = {
    scope: "user",
    marketplace: "catalog",
    pluginId: "plugin-beta",
    resolvedSource: asAbsolutePluginRoot("/plugins/plugin-beta"),
    claudeEvent: "SessionEnd",
    matcher: { kind: "match-all" },
    rawMatcher: "shutdown",
    handlerDecl: { type: "command", command: "/bin/true" },
    declarationIndex: 7,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const translationContext = {
    sessionId: "session-beta",
    transcriptPath: "/sessions/session-beta.jsonl",
    cwd: "/work/project-beta",
  } satisfies TranslationContext;
  const locations = locationsFor("user", "/ignored/project-root");
  const expectedEnvironment = {
    ...processInput,
    CLAUDE_PROJECT_DIR: "/work/project-beta",
    CLAUDE_PLUGIN_ROOT: "/plugins/plugin-beta",
    CLAUDE_PLUGIN_DATA: path.join(
      "/scope/user-agent",
      "pi-claude-marketplace",
      "data",
      "plugin-beta",
    ),
    CLAUDECODE: "1",
    CLAUDE_CODE_SESSION_ID: "session-beta",
    CLAUDE_SESSION_ID: "session-beta",
  } satisfies NodeJS.ProcessEnv;

  // act
  const environment = await prepareHookEnv(entry, translationContext, locations);
  restoreEnvironment();

  // assert
  assert.strictEqual(environment["P112_HOOK_ENV_UNKNOWN"], "inherited-unknown-value");
  assert.deepStrictEqual(environment, expectedEnvironment);
  assert.strictEqual(Object.hasOwn(environment, "CLAUDE_ENV_FILE"), false);
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

test("restores exact process properties after containment failure", async (t) => {
  // arrange
  const mutatedKeys = ["CLAUDE_CODE_REMOTE", "P112_HOOK_ENV_FAILURE"] as const;
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
        Reflect.deleteProperty(process.env, prior.key);
      }
    }
  };

  t.after(restoreEnvironment);

  delete process.env.CLAUDE_CODE_REMOTE;
  process.env.P112_HOOK_ENV_FAILURE = "during-failure";
  const entry = {
    scope: "project",
    marketplace: "catalog",
    pluginId: "../escape",
    resolvedSource: asAbsolutePluginRoot("/plugins/plugin-invalid"),
    claudeEvent: "PreToolUse",
    matcher: { kind: "match-all" },
    rawMatcher: "Bash",
    handlerDecl: { type: "command", command: "/bin/true" },
    declarationIndex: 9,
    ifPredicate: { kind: "match-all" },
  } satisfies RoutingEntry;
  const translationContext = {
    sessionId: "session-failure",
    transcriptPath: "/sessions/session-failure.jsonl",
    cwd: "/work/project-failure",
  } satisfies TranslationContext;
  const locations = locationsFor("project", "/scope/project-failure");
  const expectedParent = path.join(
    "/scope/project-failure",
    ".pi",
    "pi-claude-marketplace",
    "data",
  );
  const expectedChild = path.join(
    "/scope/project-failure",
    ".pi",
    "pi-claude-marketplace",
    "escape",
  );
  let environmentError: unknown;

  // act
  try {
    await prepareHookEnv(entry, translationContext, locations, {
      P112_HOOK_ENV_FAILURE: "extra-failure",
    });
  } catch (error) {
    environmentError = error;
  }

  restoreEnvironment();

  // assert
  assert.ok(environmentError instanceof PathContainmentError);
  assert.deepStrictEqual(
    {
      name: environmentError.name,
      message: environmentError.message,
      parent: environmentError.parent,
      child: environmentError.child,
    },
    {
      name: "PathContainmentError",
      message: `CLAUDE_PLUGIN_DATA escapes ${expectedParent} (resolved: ${expectedChild}).`,
      parent: expectedParent,
      child: expectedChild,
    },
  );
  assert.deepStrictEqual(
    mutatedKeys.map((key) => ({
      key,
      existed: Object.hasOwn(process.env, key),
      value: process.env[key],
    })),
    priorEnvironment,
  );
});
