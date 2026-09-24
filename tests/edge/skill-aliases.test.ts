import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import { registerSkillAliases } from "../../extensions/pi-claude-marketplace/edge/skill-aliases.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  InputEventResult,
  SessionStartEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { AutocompleteProvider } from "@earendil-works/pi-tui";

type SessionListener = (event: SessionStartEvent, ctx: ExtensionContext) => void;
type InputListener = (event: InputEvent, ctx: ExtensionContext) => InputEventResult;
type ProviderFactory = Parameters<ExtensionContext["ui"]["addAutocompleteProvider"]>[0];

test("transforms a loaded marketplace skill alias while retaining its arguments", () => {
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
  when(() => ctx.cwd)
    .thenReturn(cwd)
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
    ])
    .times(1);
  const images: NonNullable<InputEvent["images"]> = [
    { type: "image", data: "a", mimeType: "image/png" },
  ];

  // act
  registerSkillAliases(pi);
  const response = input.value?.(
    { type: "input", text: "/skill-creator build it", source: "interactive", images },
    ctx,
  );

  // assert
  assert.deepStrictEqual(response, {
    action: "transform",
    text: "/skill:skill-creator build it",
    images,
  });
  verify(pi);
  verify(ctx);
});

test("leaves a command collision and RPC input unchanged", () => {
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
  when(() => ctx.cwd)
    .thenReturn(cwd)
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
    ])
    .times(1);

  // act
  registerSkillAliases(pi);
  const rpc = input.value?.({ type: "input", text: "/skill-creator", source: "rpc" }, ctx);
  const collision = input.value?.(
    { type: "input", text: "/skill-creator", source: "interactive" },
    ctx,
  );

  // assert
  assert.deepStrictEqual(rpc, { action: "continue" });
  assert.deepStrictEqual(collision, { action: "continue" });
  verify(pi);
  verify(ctx);
});

test("offers the bare completion for a loaded marketplace skill", async () => {
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
    ])
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
  registerSkillAliases(pi);
  session.value?.({ type: "session_start", reason: "startup" }, ctx);
  const suggestions = await factory
    .value?.(base)
    .getSuggestions(["/skill-creator"], 0, 14, { signal: new AbortController().signal });

  // assert
  assert.deepStrictEqual(suggestions, {
    items: [{ value: "skill-creator", label: "skill-creator" }],
    prefix: "/skill-creator",
  });
  verify(pi);
  verify(ctx);
  verify(ui);
});

test("creates a bare completion when Pi returns no native suggestion", async () => {
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
    ])
    .times(1);
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
  registerSkillAliases(pi);
  session.value?.({ type: "session_start", reason: "startup" }, ctx);
  const provider = factory.value?.(base);
  const suggestions = await provider?.getSuggestions(["/skill-creator"], 0, 14, {
    signal: new AbortController().signal,
  });
  const completion =
    suggestions === null || suggestions === undefined
      ? undefined
      : provider?.applyCompletion(
          ["/skill-creator"],
          0,
          14,
          suggestions.items[0]!,
          suggestions.prefix,
        );

  // assert
  assert.deepStrictEqual(suggestions, {
    items: [{ value: "skill-creator", label: "skill-creator" }],
    prefix: "/skill-creator",
  });
  assert.deepStrictEqual(completion?.lines, ["/skill-creator "]);
  assert.strictEqual(provider?.shouldTriggerFileCompletion?.(["/skill-creator"], 0, 14), true);
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

test("keeps native suggestions when no marketplace alias matches", async () => {
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
        name: "skill:foreign",
        source: "skill",
        sourceInfo: {
          path: path.join(cwd, ".pi/skills/foreign/SKILL.md"),
          source: "project",
          scope: "project",
          origin: "top-level",
        },
      },
    ])
    .times(2);
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
  registerSkillAliases(pi);
  session.value?.({ type: "session_start", reason: "startup" }, ctx);
  const provider = factory.value?.(base);
  const other = await provider?.getSuggestions(["/other"], 0, 6, {
    signal: new AbortController().signal,
  });
  const missing = await provider?.getSuggestions(["/missing"], 0, 8, {
    signal: new AbortController().signal,
  });

  // assert
  assert.deepStrictEqual(other, native);
  assert.strictEqual(missing, null);
  verify(pi);
  verify(ctx);
  verify(ui);
});
