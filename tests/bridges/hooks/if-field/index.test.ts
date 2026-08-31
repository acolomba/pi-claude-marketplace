import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bashSubcommandFires as definingBashSubcommandFires,
  parseBashSubcommands as definingParseBashSubcommands,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts";
import {
  compileBashGlob as definingCompileBashGlob,
  compilePathGlob as definingCompilePathGlob,
  type CompiledBashGlob as DefiningCompiledBashGlob,
  type CompiledPathGlob as DefiningCompiledPathGlob,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts";
import {
  bashSubcommandFires as exportedBashSubcommandFires,
  compileBashGlob as exportedCompileBashGlob,
  compileIfPredicate,
  compilePathGlob as exportedCompilePathGlob,
  ifFires,
  MATCH_ALL_IF,
  parseBashSubcommands as exportedParseBashSubcommands,
  type CompiledBashGlob as ExportedCompiledBashGlob,
  type CompiledPathGlob as ExportedCompiledPathGlob,
  type CompileIfPredicateContext,
  type IfPredicate,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";

import type { BucketAEvent } from "../../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type { PiToolName } from "../../../../extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts";
import type {
  ExtensionContext,
  ToolCallEvent,
} from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
interface ExpectedCompileIfPredicateContext {
  readonly homedir: string;
  readonly cwd: string;
  readonly projectRoot: string;
}
type ExpectedIfPredicate =
  | { readonly kind: "match-all"; readonly reason?: string }
  | { readonly kind: "bash"; readonly bashGlob: DefiningCompiledBashGlob }
  | {
      readonly kind: "path-tool";
      readonly piEvents: ReadonlySet<PiToolName>;
      readonly pathGlob: DefiningCompiledPathGlob;
    }
  | { readonly kind: "mcp-literal"; readonly toolName: string }
  | { readonly kind: "mcp-server-prefix"; readonly serverPrefix: string };

void (true satisfies Same<CompileIfPredicateContext, ExpectedCompileIfPredicateContext>);
void (true satisfies Same<IfPredicate, ExpectedIfPredicate>);
void (true satisfies Same<ExportedCompiledBashGlob, DefiningCompiledBashGlob>);
void (true satisfies Same<ExportedCompiledPathGlob, DefiningCompiledPathGlob>);
void (true satisfies Same<typeof exportedCompileBashGlob, typeof definingCompileBashGlob>);
void (true satisfies Same<typeof exportedCompilePathGlob, typeof definingCompilePathGlob>);
void (true satisfies Same<
  typeof exportedParseBashSubcommands,
  typeof definingParseBashSubcommands
>);
void (true satisfies Same<typeof exportedBashSubcommandFires, typeof definingBashSubcommandFires>);

const typeEvidenceBashGlob = {
  raw: "git *",
  tokens: [],
  trailingWordBoundary: true,
  isCommandNameOnly: true,
  test: (_subcommand: string): boolean => true,
} satisfies DefiningCompiledBashGlob;
const typeEvidencePathGlob = {
  raw: "src/**",
  anchor: { kind: "cwd" },
  absoluteBase: "/workspace/plugin",
  tokens: [],
  testAbsolute: (_absolutePath: string): boolean => true,
} satisfies DefiningCompiledPathGlob;

void ({ kind: "match-all", reason: "fall open" } satisfies IfPredicate);
void ({ kind: "bash", bashGlob: typeEvidenceBashGlob } satisfies IfPredicate);
void ({
  kind: "path-tool",
  piEvents: new Set<PiToolName>(["read"]),
  pathGlob: typeEvidencePathGlob,
} satisfies IfPredicate);
void ({ kind: "mcp-literal", toolName: "mcp__files__read" } satisfies IfPredicate);
void ({ kind: "mcp-server-prefix", serverPrefix: "mcp__files__" } satisfies IfPredicate);

// @ts-expect-error match-all predicates do not carry Bash metadata
void ({ kind: "match-all", bashGlob: typeEvidenceBashGlob } satisfies IfPredicate);
// @ts-expect-error Bash predicates require their compiled glob
void ({ kind: "bash" } satisfies IfPredicate);
void ({
  kind: "path-tool",
  // @ts-expect-error path-tool predicates reject names outside Pi's tool vocabulary
  piEvents: new Set(["delete"]),
  pathGlob: typeEvidencePathGlob,
} satisfies IfPredicate);
// @ts-expect-error MCP literal predicates require toolName rather than serverPrefix
void ({ kind: "mcp-literal", serverPrefix: "mcp__files__" } satisfies IfPredicate);
// @ts-expect-error MCP server-prefix predicates require serverPrefix rather than toolName
void ({ kind: "mcp-server-prefix", toolName: "mcp__files__read" } satisfies IfPredicate);
// @ts-expect-error the predicate vocabulary has exactly five discriminants
void ({ kind: "unknown" } satisfies IfPredicate);

test("compiles and evaluates a Read path declaration", () => {
  // arrange
  const declaration = "Read(src/**)";
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const toolEvent = {
    type: "tool_call",
    toolCallId: "call-read-source",
    toolName: "read",
    input: { path: "src/runtime.ts", offset: 2, limit: 4 },
  } satisfies ToolCallEvent;
  const extensionContext = { cwd: compileContext.cwd } satisfies Pick<ExtensionContext, "cwd">;
  const expectedOutcome = {
    predicate: {
      kind: "path-tool",
      piEvents: ["read", "grep", "find", "ls"],
      pathGlob: {
        raw: "src/**",
        anchor: { kind: "cwd" },
        absoluteBase: "/workspace/plugin",
        tokens: [{ kind: "literal", text: "src" }, { kind: "slash" }, { kind: "globstar" }],
      },
    },
    fires: true,
  };

  // act
  const predicate = compileIfPredicate(declaration, "PreToolUse", compileContext);
  const fires = ifFires(predicate, toolEvent, extensionContext as ExtensionContext, "PreToolUse");

  // assert
  if (predicate.kind !== "path-tool") {
    assert.fail(`expected path-tool predicate, received ${predicate.kind}`);
  }

  assert.deepStrictEqual(
    {
      predicate: {
        kind: predicate.kind,
        piEvents: [...predicate.piEvents],
        pathGlob: {
          raw: predicate.pathGlob.raw,
          anchor: predicate.pathGlob.anchor,
          absoluteBase: predicate.pathGlob.absoluteBase,
          tokens: predicate.pathGlob.tokens,
        },
      },
      fires,
    },
    expectedOutcome,
  );
});

test("compiles known Bash and path-tool prefixes in stable row order", () => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const rows = [
    { declaration: "Bash(git *)", event: "PreToolUse" },
    { declaration: "Read(src/**)", event: "PreToolUse" },
    { declaration: "Edit(src/**)", event: "PostToolUse" },
    { declaration: "Write(src/**)", event: "PostToolUseFailure" },
  ] as const satisfies ReadonlyArray<{
    readonly declaration: string;
    readonly event: BucketAEvent;
  }>;
  const expected = [
    {
      declaration: "Bash(git *)",
      kind: "bash",
      piEvents: undefined,
      raw: "git *",
      trailingWordBoundary: true,
      isCommandNameOnly: true,
    },
    {
      declaration: "Read(src/**)",
      kind: "path-tool",
      piEvents: ["read", "grep", "find", "ls"],
      raw: "src/**",
      trailingWordBoundary: undefined,
      isCommandNameOnly: undefined,
    },
    {
      declaration: "Edit(src/**)",
      kind: "path-tool",
      piEvents: ["edit", "write"],
      raw: "src/**",
      trailingWordBoundary: undefined,
      isCommandNameOnly: undefined,
    },
    {
      declaration: "Write(src/**)",
      kind: "path-tool",
      piEvents: ["write"],
      raw: "src/**",
      trailingWordBoundary: undefined,
      isCommandNameOnly: undefined,
    },
  ];

  // act
  const actual = rows.map(({ declaration, event }) => {
    const predicate = compileIfPredicate(declaration, event, compileContext);
    if (predicate.kind === "bash") {
      return {
        declaration,
        kind: predicate.kind,
        piEvents: undefined,
        raw: predicate.bashGlob.raw,
        trailingWordBoundary: predicate.bashGlob.trailingWordBoundary,
        isCommandNameOnly: predicate.bashGlob.isCommandNameOnly,
      };
    }

    if (predicate.kind === "path-tool") {
      return {
        declaration,
        kind: predicate.kind,
        piEvents: [...predicate.piEvents],
        raw: predicate.pathGlob.raw,
        trailingWordBoundary: undefined,
        isCommandNameOnly: undefined,
      };
    }

    return { declaration, kind: predicate.kind };
  });

  // assert
  assert.deepStrictEqual(actual, expected);
});

test("partitions empty, non-tool, unknown-prefix, and MCP boundary declarations", () => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const rows = [
    { declaration: "  \t ", event: "PreToolUse", reason: "empty" },
    { declaration: "Bash(git *)", event: "SessionStart", reason: "non-tool event" },
    { declaration: "Grep(src/**)", event: "PreToolUse", reason: "unknown prefix" },
    { declaration: "plain", event: "PreToolUse", reason: "unrecognized shape" },
    { declaration: "mcp____tool", event: "PreToolUse", reason: "underscore server prefix" },
    { declaration: "mcp__server__", event: "PreToolUse", reason: "trailing underscore prefix" },
    { declaration: "mcp__bad.server__tool", event: "PreToolUse", reason: "invalid server" },
    { declaration: "mcp__server__bad.tool", event: "PreToolUse", reason: "invalid tool" },
    { declaration: "mcp__", event: "PreToolUse", reason: "empty server prefix" },
    { declaration: "mcp__bad.server", event: "PreToolUse", reason: "invalid server prefix" },
  ] as const satisfies ReadonlyArray<{
    readonly declaration: string;
    readonly event: BucketAEvent;
    readonly reason: string;
  }>;
  const expected = [
    { declaration: "  \t ", event: "PreToolUse", reason: "empty", predicate: MATCH_ALL_IF },
    {
      declaration: "Bash(git *)",
      event: "SessionStart",
      reason: "non-tool event",
      predicate: MATCH_ALL_IF,
    },
    {
      declaration: "Grep(src/**)",
      event: "PreToolUse",
      reason: "unknown prefix",
      predicate: MATCH_ALL_IF,
    },
    {
      declaration: "plain",
      event: "PreToolUse",
      reason: "unrecognized shape",
      predicate: MATCH_ALL_IF,
    },
    {
      declaration: "mcp____tool",
      event: "PreToolUse",
      reason: "underscore server prefix",
      predicate: { kind: "mcp-server-prefix", serverPrefix: "mcp____tool__" },
    },
    {
      declaration: "mcp__server__",
      event: "PreToolUse",
      reason: "trailing underscore prefix",
      predicate: { kind: "mcp-server-prefix", serverPrefix: "mcp__server____" },
    },
    {
      declaration: "mcp__bad.server__tool",
      event: "PreToolUse",
      reason: "invalid server",
      predicate: MATCH_ALL_IF,
    },
    {
      declaration: "mcp__server__bad.tool",
      event: "PreToolUse",
      reason: "invalid tool",
      predicate: MATCH_ALL_IF,
    },
    {
      declaration: "mcp__",
      event: "PreToolUse",
      reason: "empty server prefix",
      predicate: MATCH_ALL_IF,
    },
    {
      declaration: "mcp__bad.server",
      event: "PreToolUse",
      reason: "invalid server prefix",
      predicate: MATCH_ALL_IF,
    },
  ];

  // act
  const actual = rows.map(({ declaration, event, reason }) => ({
    declaration,
    event,
    reason,
    predicate: compileIfPredicate(declaration, event, compileContext),
  }));

  // assert
  assert.deepStrictEqual(actual, expected);
  assert.strictEqual(actual[0]?.predicate, MATCH_ALL_IF);
  assert.strictEqual(actual[1]?.predicate, MATCH_ALL_IF);
  assert.strictEqual(actual[2]?.predicate, MATCH_ALL_IF);
  assert.strictEqual(actual[3]?.predicate, MATCH_ALL_IF);
  assert.strictEqual(actual[6]?.predicate, MATCH_ALL_IF);
  assert.strictEqual(actual[7]?.predicate, MATCH_ALL_IF);
  assert.strictEqual(actual[8]?.predicate, MATCH_ALL_IF);
  assert.strictEqual(actual[9]?.predicate, MATCH_ALL_IF);
});

test("compiles MCP literals and both server-prefix forms exactly", () => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const declarations = ["mcp__files__read", "mcp__files", "mcp__files__*"] as const;
  const expected = [
    { kind: "mcp-literal", toolName: "mcp__files__read" },
    { kind: "mcp-server-prefix", serverPrefix: "mcp__files__" },
    { kind: "mcp-server-prefix", serverPrefix: "mcp__files__" },
  ];

  // act
  const actual = declarations.map((declaration) =>
    compileIfPredicate(declaration, "PreToolUse", compileContext),
  );

  // assert
  assert.deepStrictEqual(actual, expected);
});

test("falls open when Bash predicate compilation throws", (t) => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const originalEndsWith = Object.getOwnPropertyDescriptor(String.prototype, "endsWith")?.value as (
    this: string,
    searchString: string,
    endPosition?: number,
  ) => boolean;
  t.mock.method(
    String.prototype,
    "endsWith",
    function throwsForBashPattern(this: string, searchString: string, endPosition?: number) {
      if (this === "git *") {
        throw new Error("case-owned Bash compiler failure");
      }

      return Reflect.apply(originalEndsWith, this, [searchString, endPosition]);
    },
  );

  // act
  const predicate = compileIfPredicate("Bash(git *)", "PreToolUse", compileContext);

  // assert
  assert.strictEqual(predicate, MATCH_ALL_IF);
});

test("falls open when path predicate compilation throws", () => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    get cwd(): string {
      throw new Error("case-owned path compiler failure");
    },
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;

  // act
  const predicate = compileIfPredicate("Read(src/**)", "PreToolUse", compileContext);

  // assert
  assert.strictEqual(predicate, MATCH_ALL_IF);
});

test("falls open when a prefix match has no captured prefix or inner value", (t) => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const originalExec = Object.getOwnPropertyDescriptor(RegExp.prototype, "exec")
    ?.value as RegExp["exec"];
  const capturelessResult = Object.assign(["Bash(git *)"] as [string], {
    index: 0,
    input: "Bash(git *)",
  }) satisfies RegExpExecArray;
  t.mock.method(
    RegExp.prototype,
    "exec",
    function capturelessPrefix(this: RegExp, input: string): RegExpExecArray | null {
      if (this.source === "^([A-Za-z_]\\w*)\\((.*)\\)$") {
        return capturelessResult;
      }

      return Reflect.apply(originalExec, this, [input]);
    },
  );

  // act
  const predicate = compileIfPredicate("Bash(git *)", "PreToolUse", compileContext);

  // assert
  assert.strictEqual(predicate, MATCH_ALL_IF);
});

test("evaluates Bash matches, misses, and missing commands independently", () => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const extensionContext = { cwd: compileContext.cwd } as ExtensionContext;
  const predicate = compileIfPredicate("Bash(git push *)", "PreToolUse", compileContext);
  const rows = [
    { name: "known command", event: { toolName: "bash", input: { command: "git push origin" } } },
    { name: "non-matching command", event: { toolName: "bash", input: { command: "git status" } } },
    { name: "empty command", event: { toolName: "bash", input: { command: "" } } },
    { name: "missing command", event: { toolName: "bash", input: {} } },
    { name: "non-string command", event: { toolName: "bash", input: { command: 42 } } },
  ] as const;
  const expected = [
    { name: "known command", fires: true },
    { name: "non-matching command", fires: false },
    { name: "empty command", fires: false },
    { name: "missing command", fires: false },
    { name: "non-string command", fires: false },
  ];

  // act
  const actual = rows.map(({ name, event }) => ({
    name,
    fires: ifFires(predicate, event, extensionContext, "PreToolUse"),
  }));

  // assert
  assert.deepStrictEqual(actual, expected);
});

test("fails open when Bash command parsing exceeds the recursion limit", () => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const extensionContext = { cwd: compileContext.cwd } as ExtensionContext;
  const predicate = compileIfPredicate("Bash(git push *)", "PostToolUse", compileContext);
  let nestedCommand = "echo";
  for (let depth = 0; depth < 16; depth++) {
    nestedCommand = `$(${nestedCommand})`;
  }

  const event = { toolName: "bash", input: { command: nestedCommand } };

  // act
  const fires = ifFires(predicate, event, extensionContext, "PostToolUse");

  // assert
  assert.equal(fires, true);
});

test("evaluates path membership, non-membership, absolute paths, and cwd fallback", () => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const extensionContext = { cwd: compileContext.cwd } as ExtensionContext;
  const sourcePredicate = compileIfPredicate("Read(src/**)", "PreToolUse", compileContext);
  const cwdPredicate = compileIfPredicate("Read(./**)", "PreToolUse", compileContext);
  const rows = [
    {
      name: "relative member",
      predicate: sourcePredicate,
      event: { toolName: "read", input: { path: "src/runtime.ts" } },
    },
    {
      name: "absolute member",
      predicate: sourcePredicate,
      event: { toolName: "grep", input: { path: "/workspace/plugin/src/runtime.ts" } },
    },
    {
      name: "path non-member",
      predicate: sourcePredicate,
      event: { toolName: "find", input: { path: "docs/runtime.md" } },
    },
    {
      name: "unknown tool",
      predicate: sourcePredicate,
      event: { toolName: "bash", input: { path: "src/runtime.ts" } },
    },
    {
      name: "missing tool",
      predicate: sourcePredicate,
      event: { input: { path: "src/runtime.ts" } },
    },
    {
      name: "non-string tool",
      predicate: sourcePredicate,
      event: { toolName: 42, input: { path: "src/runtime.ts" } },
    },
    {
      name: "missing path at cwd",
      predicate: cwdPredicate,
      event: { toolName: "ls", input: {} },
    },
    {
      name: "non-string path at cwd",
      predicate: cwdPredicate,
      event: { toolName: "ls", input: { path: 42 } },
    },
    {
      name: "missing path outside source pattern",
      predicate: sourcePredicate,
      event: { toolName: "grep", input: {} },
    },
  ] as const;
  const expected = [
    { name: "relative member", fires: true },
    { name: "absolute member", fires: true },
    { name: "path non-member", fires: false },
    { name: "unknown tool", fires: false },
    { name: "missing tool", fires: false },
    { name: "non-string tool", fires: false },
    { name: "missing path at cwd", fires: true },
    { name: "non-string path at cwd", fires: true },
    { name: "missing path outside source pattern", fires: false },
  ];

  // act
  const actual = rows.map(({ name, predicate, event }) => ({
    name,
    fires: ifFires(predicate, event, extensionContext, "PreToolUse"),
  }));

  // assert
  assert.deepStrictEqual(actual, expected);
});

test("evaluates MCP literal equality, server membership, and wrong servers", () => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const extensionContext = { cwd: compileContext.cwd } as ExtensionContext;
  const literalPredicate = compileIfPredicate("mcp__files__read", "PreToolUse", compileContext);
  const prefixPredicate = compileIfPredicate("mcp__files__*", "PreToolUse", compileContext);
  const rows = [
    { name: "literal equality", predicate: literalPredicate, toolName: "mcp__files__read" },
    { name: "literal mismatch", predicate: literalPredicate, toolName: "mcp__files__write" },
    { name: "server member", predicate: prefixPredicate, toolName: "mcp__files__write" },
    { name: "wrong server", predicate: prefixPredicate, toolName: "mcp__search__read" },
  ] as const;
  const expected = [
    { name: "literal equality", fires: true },
    { name: "literal mismatch", fires: false },
    { name: "server member", fires: true },
    { name: "wrong server", fires: false },
  ];

  // act
  const actual = rows.map(({ name, predicate, toolName }) => ({
    name,
    fires: ifFires(predicate, { toolName, input: {} }, extensionContext, "PreToolUse"),
  }));

  // assert
  assert.deepStrictEqual(actual, expected);
});

test("dispatches all five predicate arms in stable row order", () => {
  // arrange
  const compileContext = {
    homedir: "/home/plugin-user",
    cwd: "/workspace/plugin",
    projectRoot: "/workspace/plugin",
  } satisfies CompileIfPredicateContext;
  const extensionContext = { cwd: compileContext.cwd } as ExtensionContext;
  const rows = [
    {
      name: "match-all",
      predicate: MATCH_ALL_IF,
      event: { reason: "startup" },
      eventName: "SessionStart",
    },
    {
      name: "bash",
      predicate: compileIfPredicate("Bash(git *)", "PreToolUse", compileContext),
      event: { toolName: "bash", input: { command: "git status" } },
      eventName: "PreToolUse",
    },
    {
      name: "path-tool",
      predicate: compileIfPredicate("Read(src/**)", "PreToolUse", compileContext),
      event: { toolName: "read", input: { path: "src/runtime.ts" } },
      eventName: "PreToolUse",
    },
    {
      name: "mcp-literal",
      predicate: compileIfPredicate("mcp__files__read", "PreToolUse", compileContext),
      event: { toolName: "mcp__files__read", input: {} },
      eventName: "PreToolUse",
    },
    {
      name: "mcp-server-prefix",
      predicate: compileIfPredicate("mcp__files__*", "PreToolUse", compileContext),
      event: { toolName: "mcp__files__write", input: {} },
      eventName: "PreToolUse",
    },
  ] as const satisfies ReadonlyArray<{
    readonly name: IfPredicate["kind"];
    readonly predicate: IfPredicate;
    readonly event: unknown;
    readonly eventName: BucketAEvent;
  }>;
  const expected = [
    { name: "match-all", predicateKind: "match-all", fires: true },
    { name: "bash", predicateKind: "bash", fires: true },
    { name: "path-tool", predicateKind: "path-tool", fires: true },
    { name: "mcp-literal", predicateKind: "mcp-literal", fires: true },
    { name: "mcp-server-prefix", predicateKind: "mcp-server-prefix", fires: true },
  ];

  // act
  const actual = rows.map(({ name, predicate, event, eventName }) => ({
    name,
    predicateKind: predicate.kind,
    fires: ifFires(predicate, event, extensionContext, eventName),
  }));

  // assert
  assert.deepStrictEqual(actual, expected);
});

test("rejects a predicate outside the exhaustive dispatch vocabulary", () => {
  // arrange
  const invalidPredicate = { kind: "unknown" } as unknown as IfPredicate;
  const extensionContext = { cwd: "/workspace/plugin" } as ExtensionContext;

  // act & assert
  assert.throws(
    () =>
      ifFires(invalidPredicate, { toolName: "read", input: {} }, extensionContext, "PreToolUse"),
    { name: "Error", message: /unreachable HookExecResult arm/ },
  );
});
