/**
 * @fileoverview A mock Pi host for tests that load the real extension
 * factory: it records the commands and event handlers the factory registers,
 * answers the soft-dependency probes from the tools and slash commands a case
 * gives it, and collects what the extension notifies.
 */

import { createEventBus } from "@earendil-works/pi-coding-agent";

import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

export interface NotifyRecord {
  readonly message: string;
  readonly severity?: string;
}

export interface RegisteredCommand {
  readonly handler: (args: string, ctx: ExtensionContext) => Promise<void>;
}

export interface ResourceDiscoverResult {
  readonly skillPaths: readonly string[];
  readonly promptPaths: readonly string[];
}

export interface MockPiHarness {
  readonly pi: ExtensionAPI;
  readonly commands: Map<string, RegisteredCommand>;
  readonly events: Map<
    string,
    ((event: unknown, ctx: ExtensionContext) => Promise<ResourceDiscoverResult>)[]
  >;
}

/**
 * Builds a mock Pi whose soft-dependency probes read `tools` and
 * `slashCommands`. `getCommands` is always defined: an absent method would
 * throw inside the pi-mcp-adapter command arm, which reads a throw as "not
 * loaded" (ADET-02). `events` is Pi's own event bus, because the factory
 * subscribes to pi-mcp-adapter's status channel through it (ASTAT-01).
 */
export function makeMockPi(
  tools: readonly unknown[],
  slashCommands: readonly unknown[] = [],
): MockPiHarness {
  const commands = new Map<string, RegisteredCommand>();
  const events = new Map<
    string,
    ((event: unknown, ctx: ExtensionContext) => Promise<ResourceDiscoverResult>)[]
  >();

  const pi = {
    registerCommand: (name: string, command: RegisteredCommand): void => {
      commands.set(name, command);
    },
    registerTool: (): void => {
      // Not exercised by the e2e assertions.
    },
    on: (
      event: string,
      handler: (event: unknown, ctx: ExtensionContext) => Promise<ResourceDiscoverResult>,
    ): void => {
      const list = events.get(event) ?? [];
      list.push(handler);
      events.set(event, list);
    },
    getAllTools: (): readonly unknown[] => tools,
    getCommands: (): readonly unknown[] => slashCommands,
    events: createEventBus(),
  } as unknown as ExtensionAPI;

  return { pi, commands, events };
}

export function makeCtx(cwd: string): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    mode: "tui",
    cwd,
    // D-LOC-01: project plugins load only in a project Pi trusts, and these
    // cases install at project scope into a project the user trusts.
    isProjectTrusted: (): boolean => true,
    ui: {
      notify: (message: string, severity?: string): void => {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
      addAutocompleteProvider: (): void => {
        // session_start is not exercised in e2e tests.
      },
    },
  } as unknown as ExtensionContext;

  return { ctx, notifications };
}
