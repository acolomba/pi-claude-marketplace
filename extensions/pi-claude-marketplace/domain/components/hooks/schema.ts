import Type from "typebox";
import { Compile } from "typebox/compile";

export interface HookHandlerEntry {
  type: string;
  command?: string;
  readonly if?: string;
  statusMessage?: unknown;
  once?: unknown;
  async?: unknown;
  shell?: unknown;
  args?: unknown;
  timeout?: unknown;
  asyncRewake?: unknown;
  rewakeMessage?: unknown;
  rewakeSummary?: unknown;
  [key: string]: unknown;
}

const HOOK_HANDLER_SCHEMA = Type.Unsafe<HookHandlerEntry>({
  type: "object",
  required: ["type"],
  properties: {
    type: { type: "string" },
    command: { type: "string" },
    if: { type: "string" },
    timeout: {},
    asyncRewake: {},
    rewakeMessage: {},
    rewakeSummary: {},
  },
  if: {
    type: "object",
    properties: { type: { const: "command" } },
    required: ["type"],
  },
  then: {
    type: "object",
    required: ["type", "command"],
    properties: { command: { type: "string" } },
  },
});

const HOOK_ENTRY_SCHEMA = Type.Object({
  matcher: Type.Optional(Type.String()),
  hooks: Type.Array(HOOK_HANDLER_SCHEMA),
  statusMessage: Type.Optional(Type.Unknown()),
  once: Type.Optional(Type.Unknown()),
  async: Type.Optional(Type.Unknown()),
  shell: Type.Optional(Type.Unknown()),
  args: Type.Optional(Type.Unknown()),
});

const HOOK_EVENT_ARRAY_SCHEMA = Type.Array(HOOK_ENTRY_SCHEMA);

/** Claude hook events mapped to their matcher groups. */
export const HOOKS_CONFIG_SCHEMA = Type.Record(Type.String(), HOOK_EVENT_ARRAY_SCHEMA);

export type HooksConfig = Type.Static<typeof HOOKS_CONFIG_SCHEMA>;

export const HOOKS_VALIDATOR = Compile(HOOKS_CONFIG_SCHEMA);
