import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import { registerSkillAliases } from "../../extensions/pi-claude-marketplace/edge/skill-aliases.ts";

import type {
  SkillInvocationOutcome,
  SkillInvocationRequest,
} from "../../extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  InputEventResult,
  SessionStartEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { AutocompleteProvider } from "@earendil-works/pi-tui";

type SessionListener = (event: SessionStartEvent, ctx: ExtensionContext) => void;
type InputListener = (
  event: InputEvent,
  ctx: ExtensionContext,
) => InputEventResult | Promise<InputEventResult>;
type ProviderFactory = Parameters<ExtensionContext["ui"]["addAutocompleteProvider"]>[0];
type SkillInvoker = (request: SkillInvocationRequest) => Promise<SkillInvocationOutcome>;
type PiCommand = ReturnType<ExtensionAPI["getCommands"]>[number];

const GREET_SKILL: PiCommand = {
  name: "skill:demo-greet",
  source: "skill",
  sourceInfo: {
    path: "/workspace/.pi/pi-claude-marketplace/resources/skills/demo-greet/SKILL.md",
    source: "extension",
    scope: "temporary",
    origin: "top-level",
  },
};

const GREET_BLOCK = '<skill name="demo-greet">\nGreet Ada.\n</skill>';

type AliasLoader = (pi: ExtensionAPI, cwd: string) => Promise<ReadonlyMap<string, string>>;

/** Registers the handlers on strict mocks and captures the input listener. */
function registerWithInvoker(
  invokeSkill: SkillInvoker,
  {
    createInvocationId = () => {
      throw new Error("an invocation that does not abort must not open a notification run");
    },
    loadAliases = () => {
      throw new Error("this input must not load skill aliases");
    },
  }: { createInvocationId?: () => string; loadAliases?: AliasLoader } = {},
): { pi: ExtensionAPI; input: ReturnType<typeof It.willCapture<InputListener>> } {
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const session = It.willCapture<SessionListener>("session");
  const input = It.willCapture<InputListener>("input");
  when(() => {
    pi.on("session_start", session);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", input);
  })
    .thenReturn()
    .times(1);
  registerSkillAliases(pi, loadAliases, invokeSkill, createInvocationId);
  return { pi, input };
}

/** A context whose session id an invocation reads once, and its directory `cwdReads` times. */
function invocationContext(cwdReads = 1): ExtensionContext {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const sessionManager = mock<ExtensionContext["sessionManager"]>({
    exactParams: true,
    name: "session manager",
  });
  when(() => ctx.cwd)
    .thenReturn("/workspace")
    .times(cwdReads);
  when(() => ctx.sessionManager)
    .thenReturn(sessionManager)
    .times(1);
  when(() => sessionManager.getSessionId())
    .thenReturn("session-1")
    .times(1);
  return ctx;
}

function greetRequest(args: string): SkillInvocationRequest {
  return {
    commands: [GREET_SKILL],
    generatedName: "demo-greet",
    typed: "/skill:demo-greet",
    args,
    cwd: "/workspace",
    sessionId: "session-1",
    thinkingLevel: "low",
  };
}

test("D-CF2-05: passes extension input through without invoking a skill", () => {
  // arrange
  const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const { pi, input } = registerWithInvoker(invokeSkill);

  // act
  const skill = input.value?.(
    { type: "input", text: "/skill:demo-greet Ada", source: "extension" },
    ctx,
  );
  const alias = input.value?.({ type: "input", text: "/demo:greet Ada", source: "extension" }, ctx);

  // assert
  assert.deepStrictEqual(skill, { action: "continue" });
  assert.deepStrictEqual(alias, { action: "continue" });
  verify(pi);
  verify(ctx);
  verify(invokeSkill);
});

for (const source of ["interactive", "rpc"] as const) {
  test(`D-CF2-05 / D-CF2-06: sends a typed bridged skill from ${source} input through the invocation`, async () => {
    // arrange
    const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
    when(() => invokeSkill(greetRequest("Ada")))
      .thenResolve({ kind: "ok", text: GREET_BLOCK })
      .times(1);
    const ctx = invocationContext();
    const { pi, input } = registerWithInvoker(invokeSkill);
    when(() => pi.getCommands())
      .thenReturn([GREET_SKILL])
      .times(1);
    when(() => pi.getThinkingLevel())
      .thenReturn("low")
      .times(1);
    const images: NonNullable<InputEvent["images"]> = [
      { type: "image", data: "a", mimeType: "image/png" },
    ];

    // act
    const sent = await input.value?.(
      { type: "input", text: "/skill:demo-greet   Ada  ", source, images },
      ctx,
    );

    // assert
    assert.deepStrictEqual(sent, { action: "transform", text: GREET_BLOCK, images });
    verify(pi);
    verify(ctx);
    verify(invokeSkill);
  });
}

test("D-CF2-06: sends no images and empty arguments when the user typed neither", async () => {
  // arrange
  const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
  when(() => invokeSkill(greetRequest("")))
    .thenResolve({ kind: "ok", text: GREET_BLOCK })
    .times(1);
  const ctx = invocationContext();
  const { pi, input } = registerWithInvoker(invokeSkill);
  when(() => pi.getCommands())
    .thenReturn([GREET_SKILL])
    .times(1);
  when(() => pi.getThinkingLevel())
    .thenReturn("low")
    .times(1);

  // act
  const sent = await input.value?.(
    { type: "input", text: "/skill:demo-greet", source: "rpc" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(sent, { action: "transform", text: GREET_BLOCK });
  verify(pi);
  verify(ctx);
  verify(invokeSkill);
});

test("D-CF1-03: leaves a skill the invocation does not own to Pi's expansion", async () => {
  // arrange
  const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
  when(() => invokeSkill(greetRequest("Ada")))
    .thenResolve({ kind: "not-bridged" })
    .times(1);
  const ctx = invocationContext();
  const { pi, input } = registerWithInvoker(invokeSkill);
  when(() => pi.getCommands())
    .thenReturn([GREET_SKILL])
    .times(1);
  when(() => pi.getThinkingLevel())
    .thenReturn("low")
    .times(1);

  // act
  const sent = await input.value?.(
    { type: "input", text: "/skill:demo-greet Ada", source: "interactive" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(sent, { action: "continue" });
  verify(pi);
  verify(ctx);
  verify(invokeSkill);
});

const GREET_ALIASES: ReadonlyMap<string, string> = new Map([
  ["demo:greet", "demo-greet"],
  ["greet", "demo-greet"],
]);

// D-CF2-05: one table over both user sources, so an alias and `/skill:` reach
// the invocation the same way from interactive and RPC input.
for (const source of ["interactive", "rpc"] as const) {
  for (const token of ["demo:greet", "greet"]) {
    test(`D-CF2-05: sends the alias /${token} from ${source} input through the invocation`, async () => {
      // arrange
      const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
      when(() => invokeSkill({ ...greetRequest("Ada"), typed: `/${token}` }))
        .thenResolve({ kind: "ok", text: GREET_BLOCK })
        .times(1);
      const ctx = invocationContext(2);
      const { pi, input } = registerWithInvoker(invokeSkill, {
        loadAliases: () => Promise.resolve(GREET_ALIASES),
      });
      when(() => pi.getCommands())
        .thenReturn([GREET_SKILL])
        .times(1);
      when(() => pi.getThinkingLevel())
        .thenReturn("low")
        .times(1);

      // act
      const sent = await input.value?.({ type: "input", text: `/${token} Ada`, source }, ctx);

      // assert
      assert.deepStrictEqual(sent, { action: "transform", text: GREET_BLOCK });
      verify(pi);
      verify(ctx);
      verify(invokeSkill);
    });
  }
}

test("leaves text that is not a slash token to Pi without reading commands", () => {
  // arrange
  const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const { pi, input } = registerWithInvoker(invokeSkill);

  // act
  const plain = input.value?.({ type: "input", text: "hello /demo:greet", source: "rpc" }, ctx);

  // assert
  assert.deepStrictEqual(plain, { action: "continue" });
  verify(pi);
  verify(ctx);
  verify(invokeSkill);
});

test("D-CF2-05: leaves a token the alias table does not hold to Pi, loading the table once per directory", async () => {
  // arrange
  const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  when(() => ctx.cwd)
    .thenReturn("/workspace")
    .times(2);
  let loads = 0;
  const { pi, input } = registerWithInvoker(invokeSkill, {
    loadAliases: () => {
      loads++;
      return Promise.resolve(GREET_ALIASES);
    },
  });
  when(() => pi.getCommands())
    .thenReturn([GREET_SKILL])
    .times(2);

  // act
  const bare = await input.value?.(
    { type: "input", text: "/plugin-dev-agent-development build it", source: "interactive" },
    ctx,
  );
  const qualified = await input.value?.(
    { type: "input", text: "/demo:missing", source: "rpc" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(bare, { action: "continue" });
  assert.deepStrictEqual(qualified, { action: "continue" });
  assert.strictEqual(loads, 1);
  verify(pi);
  verify(ctx);
  verify(invokeSkill);
});

test("leaves a command collision unchanged", () => {
  // arrange
  const cwd = "/workspace";
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const session = It.willCapture<SessionListener>("session");
  const input = It.willCapture<InputListener>("input");
  when(() => {
    pi.on("session_start", session);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", input);
  })
    .thenReturn()
    .times(1);
  when(() => pi.getCommands())
    .thenReturn([
      {
        name: "skill:skill-creator",
        source: "skill",
        sourceInfo: {
          path: path.join(cwd, ".pi/pi-claude-marketplace/resources/skills/skill-creator/SKILL.md"),
          source: "project",
          scope: "project",
          origin: "top-level",
        },
      },
      {
        name: "skill-creator",
        source: "prompt",
        sourceInfo: {
          path: path.join(cwd, ".pi/skills/prompt.md"),
          source: "project",
          scope: "project",
          origin: "top-level",
        },
      },
      {
        name: "foo:bar",
        source: "prompt",
        sourceInfo: {
          path: path.join(cwd, ".pi/prompts/foo:bar.md"),
          source: "project",
          scope: "project",
          origin: "top-level",
        },
      },
    ])
    .times(2);

  // act
  registerSkillAliases(pi, () => {
    throw new Error("command input must not load skill state");
  });
  const collision = input.value?.(
    { type: "input", text: "/skill-creator", source: "interactive" },
    ctx,
  );
  const qualifiedCollision = input.value?.(
    { type: "input", text: "/foo:bar", source: "interactive" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(collision, { action: "continue" });
  assert.deepStrictEqual(qualifiedCollision, { action: "continue" });
  verify(pi);
  verify(ctx);
});

/** Arranges the inventory reads that opening a notification run makes. */
function expectNotificationRun(pi: ExtensionAPI): void {
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(3);
}

test("T-01-24: reports an aborted skill as a usage error entry over RPC and handles the prompt", async () => {
  // arrange
  const message = 'Shell command failed for pattern "!`exit 3`": partial';
  const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
  when(() => invokeSkill(greetRequest("Ada")))
    .thenResolve({ kind: "abort", message })
    .times(1);
  const ctx = invocationContext();
  when(() => ctx.mode)
    .thenReturn("rpc")
    .times(1);
  const { pi, input } = registerWithInvoker(invokeSkill, {
    createInvocationId: () => "invocation-1",
  });
  when(() => pi.getCommands())
    .thenReturn([GREET_SKILL])
    .times(2);
  when(() => pi.getThinkingLevel())
    .thenReturn("low")
    .times(1);
  expectNotificationRun(pi);
  when(() => {
    pi.appendEntry("claude-plugin", {
      schemaVersion: 1,
      kind: "usage-error",
      origin: { kind: "command", commandId: "skill", invocationId: "invocation-1" },
      severity: "error",
      needsReload: false,
      message,
      usage: "",
    });
  })
    .thenReturn()
    .times(1);

  // act
  const sent = await input.value?.(
    { type: "input", text: "/skill:demo-greet Ada", source: "rpc" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(sent, { action: "handled" });
  verify(pi);
  verify(ctx);
  verify(invokeSkill);
});

test("T-01-24: shows an aborted skill's message alone in the terminal UI and handles the prompt", async () => {
  // arrange
  const message = 'Shell command failed for pattern "!`exit 3`": partial';
  const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
  when(() => invokeSkill(greetRequest("Ada")))
    .thenResolve({ kind: "abort", message })
    .times(1);
  const ctx = invocationContext();
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "UI" });
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(1);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => {
    ui.notify(message, "error");
  })
    .thenReturn()
    .times(1);
  const { pi, input } = registerWithInvoker(invokeSkill, {
    createInvocationId: () => "invocation-1",
  });
  when(() => pi.getCommands())
    .thenReturn([GREET_SKILL])
    .times(2);
  when(() => pi.getThinkingLevel())
    .thenReturn("low")
    .times(1);
  expectNotificationRun(pi);

  // act
  const sent = await input.value?.(
    { type: "input", text: "/skill:demo-greet Ada", source: "interactive" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(sent, { action: "handled" });
  verify(pi);
  verify(ctx);
  verify(ui);
  verify(invokeSkill);
});

test("reports an invocation that fails unexpectedly as a usage error and handles the prompt", async () => {
  // arrange
  const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
  when(() => invokeSkill(greetRequest("Ada")))
    .thenReject(new Error("spawn failed"))
    .times(1);
  const ctx = invocationContext();
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "UI" });
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(1);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => {
    ui.notify("spawn failed", "error");
  })
    .thenReturn()
    .times(1);
  const { pi, input } = registerWithInvoker(invokeSkill, {
    createInvocationId: () => "invocation-1",
  });
  when(() => pi.getCommands())
    .thenReturn([GREET_SKILL])
    .times(2);
  when(() => pi.getThinkingLevel())
    .thenReturn("low")
    .times(1);
  expectNotificationRun(pi);

  // act
  const sent = await input.value?.(
    { type: "input", text: "/skill:demo-greet Ada", source: "interactive" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(sent, { action: "handled" });
  verify(pi);
  verify(ctx);
  verify(ui);
  verify(invokeSkill);
});

test("leaves a token to Pi when the alias table cannot be loaded", async () => {
  // arrange
  const invokeSkill = mock<SkillInvoker>({ exactParams: true, name: "skill invocation" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  when(() => ctx.cwd)
    .thenReturn("/workspace")
    .times(1);
  const { pi, input } = registerWithInvoker(invokeSkill, {
    loadAliases: () => Promise.reject(new Error("commands unavailable")),
  });
  when(() => pi.getCommands())
    .thenReturn([GREET_SKILL])
    .times(1);

  // act
  const sent = await input.value?.(
    { type: "input", text: "/demo:greet Ada", source: "interactive" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(sent, { action: "continue" });
  verify(pi);
  verify(ctx);
  verify(invokeSkill);
});

test("keeps Pi's native suggestions for a bare skill name", async () => {
  // arrange
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "UI" });
  const session = It.willCapture<SessionListener>("session");
  const input = It.willCapture<InputListener>("input");
  const factory = It.willCapture<ProviderFactory>("provider factory");
  when(() => {
    pi.on("session_start", session);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", input);
  })
    .thenReturn()
    .times(1);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => {
    ui.addAutocompleteProvider(factory);
  })
    .thenReturn()
    .times(1);
  const base = {
    getSuggestions: () =>
      Promise.resolve({
        items: [{ value: "skill:skill-creator", label: "skill:skill-creator" }],
        prefix: "/skill-creator",
      }),
    applyCompletion: (lines: string[]) => ({ lines, cursorLine: 0, cursorCol: 0 }),
  } satisfies AutocompleteProvider;

  // act
  registerSkillAliases(pi, () => {
    throw new Error("bare completion must not load skill aliases");
  });
  session.value?.({ type: "session_start", reason: "startup" }, ctx);
  const suggestions = await factory
    .value?.(base)
    .getSuggestions(["/skill-creator"], 0, 14, { signal: new AbortController().signal });

  // assert
  assert.deepStrictEqual(suggestions, {
    items: [{ value: "skill:skill-creator", label: "skill:skill-creator" }],
    prefix: "/skill-creator",
  });
  verify(pi);
  verify(ctx);
  verify(ui);
});

test("offers plugin-qualified completion without replacing native commands", async () => {
  // arrange
  const cwd = "/workspace";
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "UI" });
  const session = It.willCapture<SessionListener>("session");
  const input = It.willCapture<InputListener>("input");
  const factory = It.willCapture<ProviderFactory>("provider factory");
  when(() => {
    pi.on("session_start", session);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", input);
  })
    .thenReturn()
    .times(1);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => {
    ui.addAutocompleteProvider(factory);
  })
    .thenReturn()
    .times(1);
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .times(1);
  const base = {
    getSuggestions: () =>
      Promise.resolve({ items: [{ value: "foo:command", label: "foo:command" }], prefix: "/foo:" }),
    applyCompletion: (lines: string[]) => ({ lines, cursorLine: 0, cursorCol: 0 }),
  } satisfies AutocompleteProvider;

  // act
  registerSkillAliases(pi, () => Promise.resolve(new Map([["foo:bar", "foo-bar"]])));
  session.value?.({ type: "session_start", reason: "startup" }, ctx);
  const suggestions = await factory
    .value?.(base)
    .getSuggestions(["/foo:"], 0, 5, { signal: new AbortController().signal });

  // assert
  assert.deepStrictEqual(suggestions, {
    items: [
      { value: "foo:command", label: "foo:command" },
      { value: "foo:bar", label: "foo:bar" },
    ],
    prefix: "/foo:",
  });
  verify(pi);
  verify(ctx);
  verify(ui);
});

test("creates a plugin-qualified completion when Pi has none", async () => {
  // arrange
  const cwd = "/workspace";
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "UI" });
  const session = It.willCapture<SessionListener>("session");
  const input = It.willCapture<InputListener>("input");
  const factory = It.willCapture<ProviderFactory>("provider factory");
  when(() => {
    pi.on("session_start", session);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", input);
  })
    .thenReturn()
    .times(1);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => {
    ui.addAutocompleteProvider(factory);
  })
    .thenReturn()
    .times(1);
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .times(2);
  const base = {
    getSuggestions: () => Promise.resolve(null),
    applyCompletion: (
      lines: string[],
      line: number,
      col: number,
      item: { value: string },
      prefix: string,
    ) => {
      const updated = [...lines];
      updated[line] = `/${item.value} `;
      return {
        lines: updated,
        cursorLine: line,
        cursorCol: col - prefix.length + item.value.length + 2,
      };
    },
  } satisfies AutocompleteProvider;

  // act
  registerSkillAliases(pi, () => Promise.resolve(new Map([["foo:bar", "foo-bar"]])));
  session.value?.({ type: "session_start", reason: "startup" }, ctx);
  const provider = factory.value?.(base);
  const matched = await provider?.getSuggestions(["/foo:b"], 0, 6, {
    signal: new AbortController().signal,
  });
  const missing = await provider?.getSuggestions(["/foo:missing"], 0, 12, {
    signal: new AbortController().signal,
  });
  const completion =
    matched === null || matched === undefined
      ? undefined
      : provider?.applyCompletion(["/foo:b"], 0, 6, matched.items[0]!, matched.prefix);

  // assert
  assert.deepStrictEqual(matched, {
    items: [{ value: "foo:bar", label: "foo:bar" }],
    prefix: "/foo:b",
  });
  assert.strictEqual(missing, null);
  assert.deepStrictEqual(completion?.lines, ["/foo:bar "]);
  assert.strictEqual(provider?.shouldTriggerFileCompletion?.(["/foo:b"], 0, 6), true);
  verify(pi);
  verify(ctx);
  verify(ui);
});

test("leaves ordinary text and explicit skill completion to Pi", async () => {
  // arrange
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "UI" });
  const session = It.willCapture<SessionListener>("session");
  const input = It.willCapture<InputListener>("input");
  const factory = It.willCapture<ProviderFactory>("provider factory");
  when(() => {
    pi.on("session_start", session);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", input);
  })
    .thenReturn()
    .times(1);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => {
    ui.addAutocompleteProvider(factory);
  })
    .thenReturn()
    .times(1);
  const native = {
    items: [{ value: "skill:skill-creator", label: "skill:skill-creator" }],
    prefix: "/skill:",
  };
  const base = {
    getSuggestions: () => Promise.resolve(native),
    applyCompletion: (lines: string[]) => ({ lines, cursorLine: 0, cursorCol: 0 }),
    shouldTriggerFileCompletion: () => false,
  } satisfies AutocompleteProvider;

  // act
  registerSkillAliases(pi);
  session.value?.({ type: "session_start", reason: "startup" }, ctx);
  const provider = factory.value?.(base);
  const plain = await provider?.getSuggestions(["hello"], 0, 5, {
    signal: new AbortController().signal,
  });
  const empty = await provider?.getSuggestions([], 0, 0, { signal: new AbortController().signal });
  const explicit = await provider?.getSuggestions(["/skill:"], 0, 7, {
    signal: new AbortController().signal,
  });
  const argument = await provider?.getSuggestions(["/skill-creator task"], 0, 19, {
    signal: new AbortController().signal,
  });

  // assert
  assert.deepStrictEqual(plain, native);
  assert.deepStrictEqual(empty, native);
  assert.deepStrictEqual(explicit, native);
  assert.deepStrictEqual(argument, native);
  assert.strictEqual(provider?.shouldTriggerFileCompletion?.(["/skill:"], 0, 7), false);
  verify(pi);
  verify(ctx);
  verify(ui);
});

test("keeps native suggestions outside qualified skill names", async () => {
  // arrange
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "UI" });
  const session = It.willCapture<SessionListener>("session");
  const input = It.willCapture<InputListener>("input");
  const factory = It.willCapture<ProviderFactory>("provider factory");
  when(() => {
    pi.on("session_start", session);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", input);
  })
    .thenReturn()
    .times(1);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => {
    ui.addAutocompleteProvider(factory);
  })
    .thenReturn()
    .times(1);
  const native = {
    items: [
      { value: "other", label: "other" },
      { value: "skill:foreign", label: "skill:foreign" },
    ],
    prefix: "/other",
  };
  const base = {
    getSuggestions: (lines: string[]) => Promise.resolve(lines[0] === "/other" ? native : null),
    applyCompletion: (lines: string[]) => ({ lines, cursorLine: 0, cursorCol: 0 }),
  } satisfies AutocompleteProvider;

  // act
  registerSkillAliases(pi, () => {
    throw new Error("unqualified completion must not load skill aliases");
  });
  session.value?.({ type: "session_start", reason: "startup" }, ctx);
  const provider = factory.value?.(base);
  const other = await provider?.getSuggestions(["/other"], 0, 6, {
    signal: new AbortController().signal,
  });
  const missing = await provider?.getSuggestions(["/missing"], 0, 8, {
    signal: new AbortController().signal,
  });
  const bareSkill = await provider?.getSuggestions(["/plugin-dev-agent-development"], 0, 29, {
    signal: new AbortController().signal,
  });

  // assert
  assert.deepStrictEqual(other, native);
  assert.strictEqual(missing, null);
  assert.strictEqual(bareSkill, null);
  verify(pi);
  verify(ctx);
  verify(ui);
});

test("DC-25: offers only plugin-qualified aliases in completion", async () => {
  // arrange
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "UI" });
  const session = It.willCapture<SessionListener>("session");
  const input = It.willCapture<InputListener>("input");
  const factory = It.willCapture<ProviderFactory>("provider factory");
  when(() => {
    pi.on("session_start", session);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("input", input);
  })
    .thenReturn()
    .times(1);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => {
    ui.addAutocompleteProvider(factory);
  })
    .thenReturn()
    .times(1);
  when(() => ctx.cwd)
    .thenReturn("/workspace")
    .times(1);
  const base = {
    getSuggestions: () => Promise.resolve(null),
    applyCompletion: (lines: string[]) => ({ lines, cursorLine: 0, cursorCol: 0 }),
  } satisfies AutocompleteProvider;

  // act
  registerSkillAliases(pi, () =>
    Promise.resolve(
      new Map([
        ["demo:fancy", "demo-review"],
        ["fancy", "demo-review"],
      ]),
    ),
  );
  session.value?.({ type: "session_start", reason: "startup" }, ctx);
  const provider = factory.value?.(base);
  const qualified = await provider?.getSuggestions(["/demo:f"], 0, 7, {
    signal: new AbortController().signal,
  });
  const bare = await provider?.getSuggestions(["/fan"], 0, 4, {
    signal: new AbortController().signal,
  });

  // assert
  assert.deepStrictEqual(qualified, {
    items: [{ value: "demo:fancy", label: "demo:fancy" }],
    prefix: "/demo:f",
  });
  assert.strictEqual(bare, null);
  verify(pi);
  verify(ctx);
  verify(ui);
});
