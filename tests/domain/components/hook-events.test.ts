import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import ts from "typescript";

import {
  BUCKET_A_EVENTS,
  NON_TOOL_EVENT_CLOSED_SETS,
  NON_TOOL_EVENT_FIELDS,
  TOOL_EVENTS,
  type BucketAEvent,
  type DispatchableEvent,
  type StopFailureErrorType,
  type ToolEvent,
} from "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";

import type { ClaudeHookEvent } from "../../../extensions/pi-claude-marketplace/shared/concerns/hooks.ts";

void ("SessionStart" satisfies BucketAEvent);
// @ts-expect-error Events outside bucket A are not admitted.
void ("Notification" satisfies BucketAEvent);
void ("PreToolUse" satisfies ToolEvent);
// @ts-expect-error A non-tool event is not a ToolEvent.
void ("SessionStart" satisfies ToolEvent);
void ("StopFailure" satisfies DispatchableEvent);
// @ts-expect-error Events outside bucket A are not dispatchable.
void ("Notification" satisfies DispatchableEvent);
void ("rate_limit" satisfies StopFailureErrorType);
// @ts-expect-error Error types use the closed vocabulary.
void ("timeout" satisfies StopFailureErrorType);

// Both directions are checked against the public event contract.
type BucketAEventsCoverageProofIsExact = [Exclude<ClaudeHookEvent, BucketAEvent>] extends [never]
  ? [Exclude<BucketAEvent, ClaudeHookEvent>] extends [never]
    ? true
    : false
  : false;
void (true satisfies BucketAEventsCoverageProofIsExact);

for (const { label, omittedLine, expectedDiagnostics } of [
  { label: "complete registration", omittedLine: "", expectedDiagnostics: [] },
  {
    label: "missing SessionStart registration",
    omittedLine: '  "SessionStart",\n',
    expectedDiagnostics: [
      { code: 2344, message: `Type '"SessionStart"' does not satisfy the constraint 'never'.` },
    ],
  },
]) {
  test(`checks the actual event coverage contract with ${label}`, async (t) => {
    // arrange
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "hook-event-coverage-"));
    t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
    const eventSource = await readFile(
      new URL(
        "../../../extensions/pi-claude-marketplace/domain/components/hook-events.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const sharedSource = await readFile(
      new URL(
        "../../../extensions/pi-claude-marketplace/shared/concerns/hooks.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const eventFile = ts.createSourceFile("events.ts", eventSource, ts.ScriptTarget.Latest, true);
    const sharedFile = ts.createSourceFile("shared.ts", sharedSource, ts.ScriptTarget.Latest, true);
    const expectedNames = [
      "ADMITTED_EVENT_NAMES",
      "_AssertNever",
      "_UnregisteredHookEvent",
      "_BucketAEventsCoverageProof",
      "BUCKET_A_EVENTS",
      "BucketAEvent",
    ];
    const contractStatements = eventFile.statements.filter((statement) => {
      if (ts.isTypeAliasDeclaration(statement)) {
        return expectedNames.includes(statement.name.text);
      }

      return (
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) =>
            ts.isIdentifier(declaration.name) && expectedNames.includes(declaration.name.text),
        )
      );
    });
    const sharedContract = sharedFile.statements.find(
      (statement) =>
        ts.isTypeAliasDeclaration(statement) && statement.name.text === "ClaudeHookEvent",
    );
    assert.strictEqual(contractStatements.length, expectedNames.length);
    assert.ok(sharedContract !== undefined);
    const completeContract =
      'import type { ClaudeHookEvent } from "./shared.ts";\n' +
      contractStatements.map((statement) => statement.getText(eventFile)).join("\n");
    await writeFile(
      path.join(temporaryRoot, "events.ts"),
      completeContract.replace(omittedLine, ""),
    );
    await writeFile(path.join(temporaryRoot, "shared.ts"), sharedContract.getText(sharedFile));
    const program = ts.createProgram([path.join(temporaryRoot, "events.ts")], {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      types: [],
      allowImportingTsExtensions: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
    });

    // act
    const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    }));

    // assert
    assert.deepStrictEqual(diagnostics, expectedDiagnostics);
  });
}

describe("BUCKET_A_EVENTS", () => {
  test("publishes every admitted event in registration order", () => {
    // arrange
    const expectedEvents = [
      "SessionStart",
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "PostToolUseFailure",
      "PreCompact",
      "PostCompact",
      "SessionEnd",
      "Stop",
      "StopFailure",
    ] as const;

    // act
    const events = BUCKET_A_EVENTS;

    // assert
    assert.deepStrictEqual(events, expectedEvents);
  });
});

describe("TOOL_EVENTS", () => {
  test("publishes the complete tool-event subset", () => {
    // arrange
    const expectedEvents = ["PreToolUse", "PostToolUse", "PostToolUseFailure"] as const;

    // act
    const events = TOOL_EVENTS;

    // assert
    assert.deepStrictEqual(events, expectedEvents);
  });

  test("retains tool events in their admitted-event relative order", () => {
    // arrange
    const expectedEvents = ["PreToolUse", "PostToolUse", "PostToolUseFailure"] as const;
    const toolEventMembers: ReadonlySet<string> = new Set(TOOL_EVENTS);

    // act
    const events = BUCKET_A_EVENTS.filter((event) => toolEventMembers.has(event));

    // assert
    assert.deepStrictEqual(events, expectedEvents);
  });
});

describe("DispatchableEvent", () => {
  test("matches the admitted event set exactly", () => {
    // arrange
    const dispatchableEvents: readonly DispatchableEvent[] = BUCKET_A_EVENTS;

    // act
    const events = dispatchableEvents;

    // assert
    assert.deepStrictEqual(events, BUCKET_A_EVENTS);
  });
});

describe("NON_TOOL_EVENT_FIELDS", () => {
  test("publishes every non-tool matcher field", () => {
    // arrange
    const expectedFields = {
      SessionStart: "source",
      SessionEnd: "reason",
      PreCompact: "trigger",
      PostCompact: "trigger",
      UserPromptSubmit: null,
      Stop: null,
      StopFailure: "error",
    } as const;

    // act
    const fields = NON_TOOL_EVENT_FIELDS;

    // assert
    assert.deepStrictEqual(fields, expectedFields);
  });
});

describe("NON_TOOL_EVENT_CLOSED_SETS", () => {
  test("publishes every closed matcher vocabulary", () => {
    // arrange
    const expectedClosedSets = {
      SessionStart: new Set(["startup", "resume"]),
      SessionEnd: new Set(),
      PreCompact: new Set(["manual", "auto"]),
      PostCompact: new Set(["manual", "auto"]),
      StopFailure: new Set([
        "rate_limit",
        "overloaded",
        "authentication_failed",
        "oauth_org_not_allowed",
        "billing_error",
        "invalid_request",
        "model_not_found",
        "server_error",
        "max_output_tokens",
        "unknown",
      ]),
    };

    // act
    const closedSets = NON_TOOL_EVENT_CLOSED_SETS;

    // assert
    assert.deepStrictEqual(closedSets, expectedClosedSets);
  });
});
