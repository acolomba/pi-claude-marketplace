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
  parseBashSubcommands as exportedParseBashSubcommands,
  type CompiledBashGlob as ExportedCompiledBashGlob,
  type CompiledPathGlob as ExportedCompiledPathGlob,
  type CompileIfPredicateContext,
  type IfPredicate,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";

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
