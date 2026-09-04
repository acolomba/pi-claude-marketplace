import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  hookSummaryEntriesFromPersisted,
  parseHooksConfig,
  projectHookSummaryEntries,
} from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";

const TEST_IF_CTX = {
  homedir: "/home/u",
  cwd: "/projects/p",
  projectRoot: "/projects/p",
} as const;

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));

test("parseHooksConfig accepts an empty bare configuration", () => {
  // arrange
  const raw = "{}";

  // act
  const result = parseHooksConfig(raw, TEST_IF_CTX, () => null);

  // assert
  assert.deepStrictEqual(result, {
    ok: true,
    value: {},
    dropped: [],
    ifPredicates: new Map(),
  });
});

test("parseHooksConfig unwraps an empty plugin configuration", () => {
  // arrange
  const raw = JSON.stringify({ description: "empty plugin", hooks: {} });

  // act
  const result = parseHooksConfig(raw, TEST_IF_CTX, () => null);

  // assert
  assert.deepStrictEqual(result, {
    ok: true,
    value: {},
    dropped: [],
    ifPredicates: new Map(),
  });
});

for (const { description, raw } of [
  { description: "a primitive", raw: "42" },
  { description: "null", raw: "null" },
  { description: "an array", raw: "[]" },
]) {
  test(`parseHooksConfig rejects ${description} instead of treating it as a plugin wrapper`, () => {
    // arrange

    // act
    const result = parseHooksConfig(raw, TEST_IF_CTX, () => null);

    // assert
    assert.deepStrictEqual(result, {
      ok: false,
      reason: "hooks.json failed schema validation: <root>: must be object",
    });
  });
}

test("parseHooksConfig rejects invalid JSON", () => {
  // arrange
  const raw = "not-valid-json";

  // act
  const result = parseHooksConfig(raw, TEST_IF_CTX, () => null);

  // assert
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /^hooks\.json is not valid JSON: /);
  }
});

for (const { description, raw, reason } of [
  {
    description: "a non-array handler group",
    raw: '{"PreToolUse":"not-an-array"}',
    reason: "hooks.json failed schema validation: /PreToolUse: must be array",
  },
  {
    description: "a command handler without its command",
    raw: '{"PreToolUse":[{"hooks":[{"type":"command"}]}]}',
    reason: 'hooks.json failed schema validation: /PreToolUse/0/hooks/0: must match "then" schema',
  },
]) {
  test(`parseHooksConfig rejects ${description}`, () => {
    // arrange

    // act
    const result = parseHooksConfig(raw, TEST_IF_CTX, () => null);

    // assert
    assert.deepStrictEqual(result, { ok: false, reason });
  });
}

test("parseHooksConfig keeps supported handlers, drops rejected groups and handlers, and compiles if fields", () => {
  // arrange
  const raw = JSON.stringify({
    PostToolUse: [
      {
        matcher: "Edit",
        hooks: [
          { type: "command", command: "/bin/edit", if: "tool == 'Edit'" },
          { type: "future-handler", if: "never compile" },
          { type: "command", command: "/bin/always" },
        ],
      },
      {
        matcher: ".*",
        hooks: [{ type: "command", command: "/bin/regex", if: "never compile" }],
      },
      {
        hooks: [{ type: "future-handler" }],
      },
    ],
  });

  // act
  const result = parseHooksConfig(raw, TEST_IF_CTX, (rawIf, event, ctx) => ({
    rawIf,
    event,
    cwd: ctx.cwd,
  }));

  // assert
  assert.deepStrictEqual(result, {
    ok: true,
    value: {
      PostToolUse: [
        {
          matcher: "Edit",
          hooks: [
            { type: "command", command: "/bin/edit", if: "tool == 'Edit'" },
            { type: "command", command: "/bin/always" },
          ],
        },
      ],
    },
    dropped: [
      {
        kind: "handler",
        event: "PostToolUse",
        matcher: "Edit",
        handlerType: "future-handler",
      },
      { kind: "group", event: "PostToolUse", matcher: ".*", cond: "regex" },
      {
        kind: "handler",
        event: "PostToolUse",
        matcher: "",
        handlerType: "future-handler",
      },
    ],
    ifPredicates: new Map([
      ["PostToolUse|0|0", { rawIf: "tool == 'Edit'", event: "PostToolUse", cwd: "/projects/p" }],
    ]),
  });
});

test("parseHooksConfig skips if compilation when the caller requests only the verdict", () => {
  // arrange
  const raw = JSON.stringify({
    PreToolUse: [
      {
        matcher: "Edit",
        hooks: [{ type: "command", command: "/bin/edit", if: "tool == 'Edit'" }],
      },
    ],
  });

  // act
  const result = parseHooksConfig(
    raw,
    TEST_IF_CTX,
    () => {
      throw new Error("compileIf must not be called");
    },
    { skipIfMap: true },
  );

  // assert
  assert.deepStrictEqual(result, {
    ok: true,
    value: {
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [{ type: "command", command: "/bin/edit", if: "tool == 'Edit'" }],
        },
      ],
    },
    dropped: [],
    ifPredicates: new Map(),
  });
});

test("projectHookSummaryEntries projects tool and non-tool groups with matcher defaults", () => {
  // arrange
  const parsed = {
    PreToolUse: [
      { matcher: "Edit", hooks: [{ type: "command", command: "/bin/edit" }] },
      { hooks: [{ type: "command", command: "/bin/all" }] },
    ],
    Stop: [{ matcher: "ignored", hooks: [{ type: "command", command: "/bin/stop" }] }],
  };

  // act
  const entries = projectHookSummaryEntries(parsed);

  // assert
  assert.deepStrictEqual(entries, [
    { event: "PreToolUse", matcher: "Edit" },
    { event: "PreToolUse", matcher: "" },
    { event: "Stop" },
  ]);
});

test("hookSummaryEntriesFromPersisted narrows tool and non-tool entries with matcher defaults", () => {
  // arrange
  const persisted = [
    { event: "PostToolUse", matcher: "Write" },
    { event: "PostToolUseFailure" },
    { event: "SessionStart", matcher: "ignored" },
  ];

  // act
  const entries = hookSummaryEntriesFromPersisted(persisted);

  // assert
  assert.deepStrictEqual(entries, [
    { event: "PostToolUse", matcher: "Write" },
    { event: "PostToolUseFailure", matcher: "" },
    { event: "SessionStart" },
  ]);
});

test("parseHooksConfig accepts the upstream hookify plugin wrapper", async () => {
  // arrange
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hookify-hooks.json"),
    "utf8",
  );

  // act
  const result = parseHooksConfig(raw, TEST_IF_CTX, () => null, { skipIfMap: true });

  // assert
  assert.deepStrictEqual(result, {
    ok: true,
    value: {
      PreToolUse: [
        {
          hooks: [
            {
              type: "command",
              command: 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/pretooluse.py"',
              timeout: 10,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          hooks: [
            {
              type: "command",
              command: 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/posttooluse.py"',
              timeout: 10,
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: "command",
              command: 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/stop.py"',
              timeout: 10,
            },
          ],
        },
      ],
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: 'python3 "${CLAUDE_PLUGIN_ROOT}/hooks/userpromptsubmit.py"',
              timeout: 10,
            },
          ],
        },
      ],
    },
    dropped: [],
    ifPredicates: new Map(),
  });
});

test("parseHooksConfig drops an unsupported event from the plugin wrapper", async () => {
  // arrange
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hooks-notification-only.json"),
    "utf8",
  );

  // act
  const result = parseHooksConfig(raw, TEST_IF_CTX, () => null, { skipIfMap: true });

  // assert
  assert.deepStrictEqual(result, {
    ok: true,
    value: {},
    dropped: [{ kind: "event", event: "Notification" }],
    ifPredicates: new Map(),
  });
});

test("parseHooksConfig keeps a supported event while dropping an unsupported sibling", async () => {
  // arrange
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hooks-posttooluse-and-notification.json"),
    "utf8",
  );

  // act
  const result = parseHooksConfig(raw, TEST_IF_CTX, () => null, { skipIfMap: true });

  // assert
  assert.deepStrictEqual(result, {
    ok: true,
    value: {
      PostToolUse: [
        {
          matcher: "Edit",
          hooks: [{ type: "command", command: "echo posttooluse" }],
        },
      ],
    },
    dropped: [{ kind: "event", event: "Notification" }],
    ifPredicates: new Map(),
  });
});

test("parseHooksConfig keeps a clean matcher group while dropping a regex group", async () => {
  // arrange
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hooks-pretooluse-matcher-mix.json"),
    "utf8",
  );

  // act
  const result = parseHooksConfig(raw, TEST_IF_CTX, () => null, { skipIfMap: true });

  // assert
  assert.deepStrictEqual(result, {
    ok: true,
    value: {
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [{ type: "command", command: "echo edit" }],
        },
      ],
    },
    dropped: [{ kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" }],
    ifPredicates: new Map(),
  });
});
