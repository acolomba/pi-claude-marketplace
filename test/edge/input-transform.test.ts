import assert from "node:assert/strict";
import { test } from "node:test";

import { finishedTransform } from "../../extensions/pi-claude-marketplace/edge/input-transform.ts";

import type {
  InputEvent,
  InputEventResult,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const IMAGE = { type: "image", data: "aGk=", mimeType: "image/png" } as const;

for (const { title, text, event, expected } of [
  {
    title: "prefixes a text that starts with a slash with one zero-width space",
    text: "/demo:deploy production",
    event: { type: "input", text: "/demo:ship", source: "interactive" },
    expected: { action: "transform", text: "\u200B/demo:deploy production" },
  },
  {
    title: "keeps a text that does not start with a slash",
    text: '<skill name="demo-greet">\n/demo:deploy\n</skill>',
    event: { type: "input", text: "/skill:demo-greet", source: "rpc" },
    expected: { action: "transform", text: '<skill name="demo-greet">\n/demo:deploy\n</skill>' },
  },
  {
    title: "carries the images of the typed input",
    text: "Deploy.",
    event: { type: "input", text: "/demo:ship", source: "interactive", images: [IMAGE] },
    expected: { action: "transform", text: "Deploy.", images: [IMAGE] },
  },
] satisfies { title: string; text: string; event: InputEvent; expected: InputEventResult }[]) {
  test(`E8: ${title}`, () => {
    // act
    const transform = finishedTransform(text, event);

    // assert
    assert.deepStrictEqual(transform, expected);
  });
}
