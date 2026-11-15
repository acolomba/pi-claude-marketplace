import assert from "node:assert/strict";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import { createPluginNamesCache } from "../../extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts";
import { createTypedExpansionResolver } from "../../extensions/pi-claude-marketplace/orchestrators/typed-expansion.ts";
import { captureDebugLog } from "../platform/debug-log-capture.ts";

import type { TypedExpansion } from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import type {
  PluginNames,
  PluginNamesCache,
} from "../../extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type Command = ReturnType<ExtensionAPI["getCommands"]>[number];
type Scope = Command["sourceInfo"]["scope"];

const CWD = "/work";

function command(name: string, source: Command["source"], scope: Scope = "user"): Command {
  return {
    name,
    source,
    sourceInfo: { path: `/files/${name}.md`, source: "local", scope, origin: "top-level" },
  };
}

const BRIDGED_COMMANDS: readonly Command[] = [
  command("demo:cmd", "prompt", "temporary"),
  command("skill:demo-status", "skill", "temporary"),
  command("skill:demo-legacy", "skill", "temporary"),
];

const NAMES: PluginNames = {
  aliases: new Map([
    ["demo:status", { kind: "skill", generatedName: "demo-status" }],
    ["demo:legacy", { kind: "skill", generatedName: "demo-legacy" }],
    ["demo:fancy", { kind: "command", name: "demo:cmd" }],
  ]),
  skills: new Map([["demo-status", "demo:status"]]),
  commands: new Set(["demo:cmd"]),
};

/** Pi, answering `getCommands()` once with `commands`. */
function piWith(commands: readonly Command[]): ExtensionAPI {
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  when(() => pi.getCommands())
    .thenReturn([...commands])
    .times(1);
  return pi;
}

/** A context whose directory and project trust the table lookup reads `reads` times. */
function contextReading(reads = 1): ExtensionContext {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  when(() => ctx.cwd)
    .thenReturn(CWD)
    .times(reads);
  when(() => ctx.isProjectTrusted())
    .thenReturn(true)
    .times(reads);
  return ctx;
}

/** A cache over a stub load that gives `names` for the context's directory once trusted. */
function cacheOf(pi: ExtensionAPI, names: PluginNames = NAMES): PluginNamesCache {
  return createPluginNamesCache(pi, (_pi, cwd, projectTrusted) => {
    assert.deepStrictEqual({ cwd, projectTrusted }, { cwd: CWD, projectTrusted: true });
    return Promise.resolve(names);
  });
}

/** A cache whose table must not be read. */
const UNREAD_CACHE: PluginNamesCache = {
  get: () => {
    throw new Error("this line must not read the plugin names");
  },
  clear: () => {
    throw new Error("the resolver must not clear the cache");
  },
};

for (const { title, text, commands, expected } of [
  {
    title: "a bridged command typed by its Pi name",
    text: "/demo:cmd first second",
    commands: BRIDGED_COMMANDS,
    expected: { commandName: "demo:cmd", commandArgs: "first second", commandSource: "plugin" },
  },
  {
    title: "a bridged skill typed as /skill:<generated name>",
    text: "/skill:demo-status a",
    commands: BRIDGED_COMMANDS,
    expected: { commandName: "demo:status", commandArgs: "a", commandSource: "plugin" },
  },
  {
    title: "a bridged skill typed by its alias",
    text: "/demo:status a",
    commands: BRIDGED_COMMANDS,
    expected: { commandName: "demo:status", commandArgs: "a", commandSource: "plugin" },
  },
  {
    title: "an alias of a bridged command",
    text: "/demo:fancy a",
    commands: BRIDGED_COMMANDS,
    expected: { commandName: "demo:cmd", commandArgs: "a", commandSource: "plugin" },
  },
  {
    title: "a bridged skill with no Claude-form name",
    text: "/demo:legacy a",
    commands: BRIDGED_COMMANDS,
    expected: { commandName: "demo-legacy", commandArgs: "a", commandSource: "plugin" },
  },
  {
    title: "the user's own template of Pi's user scope",
    text: "/notes x",
    commands: [command("notes", "prompt", "user")],
    expected: { commandName: "notes", commandArgs: "x", commandSource: "userSettings" },
  },
  {
    title: "the user's own template of Pi's project scope",
    text: "/notes x",
    commands: [command("notes", "prompt", "project")],
    expected: { commandName: "notes", commandArgs: "x", commandSource: "projectSettings" },
  },
  {
    title: "a temporary template",
    text: "/notes x",
    commands: [command("notes", "prompt", "temporary")],
    expected: { commandName: "notes", commandArgs: "x" },
  },
  {
    title: "the user's own skill",
    text: "/skill:mine",
    commands: [command("skill:mine", "skill", "project")],
    expected: { commandName: "mine", commandArgs: "", commandSource: "projectSettings" },
  },
  {
    title: "a line with no arguments",
    text: "/demo:cmd",
    commands: BRIDGED_COMMANDS,
    expected: { commandName: "demo:cmd", commandArgs: "", commandSource: "plugin" },
  },
  {
    title: "arguments with spaces around them",
    text: "/demo:cmd   first second  ",
    commands: BRIDGED_COMMANDS,
    expected: { commandName: "demo:cmd", commandArgs: "first second", commandSource: "plugin" },
  },
  {
    title: "a /name that nothing lists and no alias resolves",
    text: "/missing a",
    commands: BRIDGED_COMMANDS,
    expected: undefined,
  },
  {
    title: "a /skill:name that Pi does not list",
    text: "/skill:missing a",
    commands: BRIDGED_COMMANDS,
    expected: undefined,
  },
  {
    title: "a token that differs from a listed name in case only",
    text: "/DEMO:CMD a",
    commands: BRIDGED_COMMANDS,
    expected: undefined,
  },
] satisfies {
  title: string;
  text: string;
  commands: readonly Command[];
  expected: TypedExpansion | undefined;
}[]) {
  test(`D-PG6-18 / D-PG6-19: resolves ${title}`, async () => {
    // arrange
    const pi = piWith(commands);
    const ctx = contextReading();
    const resolve = createTypedExpansionResolver(pi, cacheOf(pi));

    // act
    const resolved = await resolve(text, ctx);

    // assert
    assert.deepStrictEqual(resolved, expected);
    verify(pi);
    verify(ctx);
  });
}

for (const text of ["hello /demo:cmd", "/", " /demo:cmd", ""]) {
  test(`PG-HOOK-06: the line ${JSON.stringify(text)} names nothing and reads no table`, async () => {
    // arrange
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
    const resolve = createTypedExpansionResolver(pi, UNREAD_CACHE);

    // act
    const resolved = await resolve(text, ctx);

    // assert
    assert.equal(resolved, undefined);
    verify(pi);
    verify(ctx);
  });
}

test("SK-6: a token that a Pi command of another source has names nothing and reads no table", async () => {
  // arrange
  const pi = piWith([...BRIDGED_COMMANDS, command("demo:cmd", "extension")]);
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const resolve = createTypedExpansionResolver(pi, UNREAD_CACHE);

  // act
  const resolved = await resolve("/demo:cmd a", ctx);

  // assert
  assert.equal(resolved, undefined);
  verify(pi);
  verify(ctx);
});

test("T-06-28: when the table cannot be loaded, a listed template and skill keep Pi's name and no source, and an alias names nothing", async (t) => {
  // arrange
  const diagnostics = captureDebugLog(t);
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  when(() => pi.getCommands())
    .thenReturn([...BRIDGED_COMMANDS])
    .times(3);
  const ctx = contextReading(3);
  const cache = createPluginNamesCache(pi, () => Promise.reject(new Error("state unreadable")));
  const resolve = createTypedExpansionResolver(pi, cache);

  // act
  const template = await resolve("/demo:cmd a", ctx);
  const skill = await resolve("/skill:demo-status a", ctx);
  const alias = await resolve("/demo:status a", ctx);

  // assert
  assert.deepStrictEqual(
    { template, skill, alias, diagnostics },
    {
      template: { commandName: "demo:cmd", commandArgs: "a" },
      skill: { commandName: "demo-status", commandArgs: "a" },
      alias: undefined,
      diagnostics: [
        "[skills] typed expansion without the plugin names: state unreadable",
        "[skills] typed expansion without the plugin names: state unreadable",
        "[skills] typed expansion without the plugin names: state unreadable",
      ],
    },
  );
  verify(pi);
  verify(ctx);
});

test("D-PG6-18: creating the resolver calls nothing on Pi", () => {
  // arrange
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });

  // act
  const resolve = createTypedExpansionResolver(pi, UNREAD_CACHE);

  // assert
  assert.equal(typeof resolve, "function");
  verify(pi);
});
