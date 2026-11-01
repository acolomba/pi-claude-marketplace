import assert from "node:assert/strict";
import { test } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import { registerCommandInvocation } from "../../extensions/pi-claude-marketplace/edge/command-invocation.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  InputEventResult,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type InputListener = (
  event: InputEvent,
  ctx: ExtensionContext,
) => InputEventResult | Promise<InputEventResult>;

const SOURCES: readonly InputEvent["source"][] = ["interactive", "rpc", "extension"];

for (const source of SOURCES) {
  test(`D-CF1-01: passes a bridged command from the ${source} source through unchanged`, () => {
    // arrange
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
    const input = It.willCapture<InputListener>("input");
    when(() => {
      pi.on("input", input);
    })
      .thenReturn()
      .times(1);
    registerCommandInvocation(pi);

    // act
    const outcome = input.value?.({ type: "input", text: "/demo:greet Ada", source }, ctx);

    // assert
    assert.deepStrictEqual(outcome, { action: "continue" });
    verify(pi);
    verify(ctx);
  });
}
