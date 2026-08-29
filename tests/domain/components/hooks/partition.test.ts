import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { partitionHooks } from "../../../../extensions/pi-claude-marketplace/domain/components/hooks/partition.ts";

describe("partitionHooks", () => {
  test("returns an empty partition for an empty configuration", () => {
    // arrange
    const config = {};

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, { supported: {}, dropped: [] });
  });

  test("keeps supported tool matchers in declaration order", () => {
    // arrange
    const config = {
      PreToolUse: [
        { matcher: "Edit", hooks: [{ type: "command", command: "edit" }] },
        { matcher: "mcp__github__issue", hooks: [{ type: "command", command: "issue" }] },
        { hooks: [{ type: "command", command: "all" }] },
      ],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {
        PreToolUse: [
          { matcher: "Edit", hooks: [{ type: "command", command: "edit" }] },
          { matcher: "mcp__github__issue", hooks: [{ type: "command", command: "issue" }] },
          { hooks: [{ type: "command", command: "all" }] },
        ],
      },
      dropped: [],
    });
  });

  test("drops regex and unmapped tool groups but keeps their supported sibling", () => {
    // arrange
    const config = {
      PostToolUse: [
        { matcher: "Edit.*", hooks: [{ type: "command", command: "regex" }] },
        { matcher: "MultiEdit", hooks: [{ type: "command", command: "unmapped" }] },
        { matcher: "Write", hooks: [{ type: "command", command: "write" }] },
      ],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {
        PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "write" }] }],
      },
      dropped: [
        { kind: "group", event: "PostToolUse", matcher: "Edit.*", cond: "regex" },
        {
          kind: "group",
          event: "PostToolUse",
          matcher: "MultiEdit",
          cond: "unmapped-tool",
        },
      ],
    });
  });

  test("drops an unknown event", () => {
    // arrange
    const config = {
      Notification: [{ hooks: [{ type: "command", command: "notify" }] }],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {},
      dropped: [{ kind: "event", event: "Notification" }],
    });
  });

  test("drops a matcher from an event without matcher support", () => {
    // arrange
    const config = {
      UserPromptSubmit: [{ matcher: "prompt", hooks: [{ type: "command", command: "prompt" }] }],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {},
      dropped: [
        {
          kind: "group",
          event: "UserPromptSubmit",
          matcher: "prompt",
          cond: "no-matcher-support",
        },
      ],
    });
  });

  test("keeps absent and star matchers on events without matcher support", () => {
    // arrange
    const config = {
      Stop: [
        { hooks: [{ type: "command", command: "absent" }] },
        { matcher: "*", hooks: [{ type: "command", command: "star" }] },
      ],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {
        Stop: [
          { hooks: [{ type: "command", command: "absent" }] },
          { matcher: "*", hooks: [{ type: "command", command: "star" }] },
        ],
      },
      dropped: [],
    });
  });

  test("keeps a closed-set value and drops values outside the set", () => {
    // arrange
    const config = {
      SessionStart: [
        { matcher: "startup", hooks: [{ type: "command", command: "start" }] },
        { matcher: "clear", hooks: [{ type: "command", command: "clear" }] },
      ],
      StopFailure: [
        { matcher: "rate_limit", hooks: [{ type: "command", command: "rate" }] },
        {
          matcher: "rate_limit|server_error",
          hooks: [{ type: "command", command: "compound" }],
        },
      ],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {
        SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "start" }] }],
        StopFailure: [{ matcher: "rate_limit", hooks: [{ type: "command", command: "rate" }] }],
      },
      dropped: [
        { kind: "group", event: "SessionStart", matcher: "clear", cond: "closed-set" },
        {
          kind: "group",
          event: "StopFailure",
          matcher: "rate_limit|server_error",
          cond: "closed-set",
        },
      ],
    });
  });

  test("drops a group when every handler is unsupported", () => {
    // arrange
    const config = {
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            { type: "http", command: "one" },
            { type: "prompt", command: "two" },
          ],
        },
      ],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {},
      dropped: [
        { kind: "handler", event: "PreToolUse", matcher: "Edit", handlerType: "http" },
        { kind: "handler", event: "PreToolUse", matcher: "Edit", handlerType: "prompt" },
      ],
    });
  });

  test("keeps command handlers around unsupported siblings", () => {
    // arrange
    const config = {
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            { type: "command", command: "first" },
            { type: "http", command: "drop" },
            { type: "command", command: "last" },
          ],
        },
      ],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {
        PreToolUse: [
          {
            matcher: "Edit",
            hooks: [
              { type: "command", command: "first" },
              { type: "command", command: "last" },
            ],
          },
        ],
      },
      dropped: [{ kind: "handler", event: "PreToolUse", matcher: "Edit", handlerType: "http" }],
    });
  });

  test("keeps repeated equal handlers in their input positions", () => {
    // arrange
    const config = {
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            { type: "command", command: "repeat" },
            { type: "command", command: "middle" },
            { type: "command", command: "repeat" },
          ],
        },
      ],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {
        PreToolUse: [
          {
            matcher: "Edit",
            hooks: [
              { type: "command", command: "repeat" },
              { type: "command", command: "middle" },
              { type: "command", command: "repeat" },
            ],
          },
        ],
      },
      dropped: [],
    });
  });

  test("orders rejected events, handlers, and groups by their input positions", () => {
    // arrange
    const config = {
      Notification: [{ hooks: [{ type: "command", command: "notify" }] }],
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            { type: "http", command: "drop-first" },
            { type: "command", command: "keep" },
            { type: "prompt", command: "drop-second" },
          ],
        },
        { matcher: "Edit.*", hooks: [{ type: "command", command: "regex" }] },
      ],
      SessionStart: [{ matcher: "clear", hooks: [{ type: "command", command: "clear" }] }],
    };

    // act
    const partition = partitionHooks(config);

    // assert
    assert.deepStrictEqual(partition, {
      supported: {
        PreToolUse: [
          {
            matcher: "Edit",
            hooks: [{ type: "command", command: "keep" }],
          },
        ],
      },
      dropped: [
        { kind: "event", event: "Notification" },
        { kind: "handler", event: "PreToolUse", matcher: "Edit", handlerType: "http" },
        { kind: "handler", event: "PreToolUse", matcher: "Edit", handlerType: "prompt" },
        { kind: "group", event: "PreToolUse", matcher: "Edit.*", cond: "regex" },
        { kind: "group", event: "SessionStart", matcher: "clear", cond: "closed-set" },
      ],
    });
  });
});
