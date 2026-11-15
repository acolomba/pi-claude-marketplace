import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import {
  hookPathVars,
  prepareHookEnv,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { resolveOptions } from "../../../extensions/pi-claude-marketplace/domain/user-config.ts";
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
    options: resolveOptions(undefined),
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
      "catalog",
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
    options: resolveOptions(undefined),
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
      "catalog",
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

test("restores exact process properties after an unsafe plugin name is refused", async (t) => {
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
    options: resolveOptions(undefined),
  } satisfies RoutingEntry;
  const translationContext = {
    sessionId: "session-failure",
    transcriptPath: "/sessions/session-failure.jsonl",
    cwd: "/work/project-failure",
  } satisfies TranslationContext;
  const locations = locationsFor("project", "/scope/project-failure");
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
  assert.ok(environmentError instanceof Error);
  assert.strictEqual(
    environmentError.message,
    'pluginDataDir plugin name "../escape" "../escape" must not contain path separators.',
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

test("gives the three path values that the hook environment exports", async () => {
  // arrange
  const entry = {
    scope: "project",
    marketplace: "catalog",
    pluginId: "plugin-paths",
    resolvedSource: asAbsolutePluginRoot("/plugins/plugin-paths"),
    claudeEvent: "UserPromptSubmit",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "/bin/true", args: [] },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
    options: resolveOptions(undefined),
  } satisfies RoutingEntry;
  const translationContext = { sessionId: "session-paths", cwd: "/work/project-paths" };
  const locations = locationsFor("project", "/scope/project-paths");

  // act
  const vars = hookPathVars(entry, translationContext, locations);
  const environment = await prepareHookEnv(entry, translationContext, locations);

  // assert
  assert.deepStrictEqual(vars, {
    pluginRoot: "/plugins/plugin-paths",
    pluginData: path.join(
      "/scope/project-paths",
      ".pi",
      "pi-claude-marketplace",
      "data",
      "catalog",
      "plugin-paths",
    ),
    projectDir: "/work/project-paths",
  });
  assert.deepStrictEqual(
    {
      pluginRoot: environment.CLAUDE_PLUGIN_ROOT,
      pluginData: environment.CLAUDE_PLUGIN_DATA,
      projectDir: environment.CLAUDE_PROJECT_DIR,
    },
    vars,
  );
});

function optionEntry(options: RoutingEntry["options"]): RoutingEntry {
  return {
    scope: "project",
    marketplace: "catalog",
    pluginId: "plugin-options",
    resolvedSource: asAbsolutePluginRoot("/plugins/plugin-options"),
    claudeEvent: "UserPromptSubmit",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command: "/bin/true" },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
    options,
  };
}

function optionVariables(environment: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(environment).filter(([name]) => name.startsWith("CLAUDE_PLUGIN_OPTION_")),
  );
}

const OPTION_CONTEXT = { sessionId: "session-options", cwd: "/work/project-options" };

test("D-PG10-10: exports each option that has a default as CLAUDE_PLUGIN_OPTION_KEY", async () => {
  // arrange
  const entry = optionEntry(
    resolveOptions({
      mode: { type: "string", title: "Mode", description: "The mode.", default: "fast" },
      retries: { type: "number", title: "Retries", description: "The retries.", default: 3 },
      "dry-run": { type: "boolean", title: "Dry", description: "Dry run.", default: false },
      note: { type: "string", title: "Note", description: "A note." },
    }),
  );
  const locations = locationsFor("project", "/scope/project-options");

  // act
  const environment = await prepareHookEnv(entry, OPTION_CONTEXT, locations);

  // assert
  assert.deepStrictEqual(optionVariables(environment), {
    CLAUDE_PLUGIN_OPTION_MODE: "fast",
    CLAUDE_PLUGIN_OPTION_RETRIES: "3",
    CLAUDE_PLUGIN_OPTION_DRY_RUN: "false",
  });
});

test("D-PG10-10: exports no option variable for a plugin that declares no options", async () => {
  // arrange
  const entry = optionEntry(resolveOptions(undefined));
  const locations = locationsFor("project", "/scope/project-options");

  // act
  const environment = await prepareHookEnv(entry, OPTION_CONTEXT, locations);

  // assert
  assert.deepStrictEqual(optionVariables(environment), {});
});

test("D-PG10-10: gives two keys that differ only in letter case the later key's value", async () => {
  // arrange
  const entry = optionEntry(
    resolveOptions({
      mode: { type: "string", title: "Mode", description: "The mode.", default: "fast" },
      MODE: { type: "string", title: "Mode", description: "The mode.", default: "slow" },
    }),
  );
  const locations = locationsFor("project", "/scope/project-options");

  // act
  const environment = await prepareHookEnv(entry, OPTION_CONTEXT, locations);

  // assert
  assert.deepStrictEqual(optionVariables(environment), { CLAUDE_PLUGIN_OPTION_MODE: "slow" });
});

test("D-PG10-10: sets option variables over the process and under the lane and session", async (t) => {
  // arrange
  const mutatedKeys = ["CLAUDE_PLUGIN_OPTION_MODE", "CLAUDE_PLUGIN_OPTION_LEVEL"] as const;
  const priorEnvironment = mutatedKeys.map((key) => ({
    key,
    existed: Object.hasOwn(process.env, key),
    value: process.env[key],
  }));
  t.after(() => {
    for (const prior of priorEnvironment) {
      if (prior.existed) {
        process.env[prior.key] = prior.value;
      } else {
        Reflect.deleteProperty(process.env, prior.key);
      }
    }
  });
  process.env.CLAUDE_PLUGIN_OPTION_MODE = "process-mode";
  process.env.CLAUDE_PLUGIN_OPTION_LEVEL = "process-level";
  const entry = optionEntry(
    resolveOptions({
      mode: { type: "string", title: "Mode", description: "The mode.", default: "fast" },
      level: { type: "string", title: "Level", description: "The level.", default: "high" },
      root: { type: "string", title: "Root", description: "The root.", default: "/elsewhere" },
    }),
  );
  const locations = locationsFor("project", "/scope/project-options");

  // act
  const environment = await prepareHookEnv(entry, OPTION_CONTEXT, locations, {
    CLAUDE_PLUGIN_OPTION_LEVEL: "lane-level",
  });

  // assert
  assert.deepStrictEqual(
    {
      options: optionVariables(environment),
      pluginRoot: environment.CLAUDE_PLUGIN_ROOT,
      session: environment.CLAUDE_SESSION_ID,
    },
    {
      options: {
        CLAUDE_PLUGIN_OPTION_MODE: "fast",
        CLAUDE_PLUGIN_OPTION_LEVEL: "lane-level",
        CLAUDE_PLUGIN_OPTION_ROOT: "/elsewhere",
      },
      pluginRoot: "/plugins/plugin-options",
      session: "session-options",
    },
  );
});
