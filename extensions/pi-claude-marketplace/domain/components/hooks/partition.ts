import {
  BUCKET_A_EVENTS,
  NON_TOOL_EVENT_CLOSED_SETS,
  NON_TOOL_EVENT_FIELDS,
  TOOL_EVENTS,
  type BucketAEvent,
  type ToolEvent,
} from "../hook-events.ts";

import { parseMatcher } from "./matcher.ts";

import type { HookHandlerEntry, HooksConfig } from "./schema.ts";

export type DroppedHook =
  | { kind: "event"; event: string }
  | {
      kind: "group";
      event: BucketAEvent;
      matcher: string;
      cond: "regex" | "unmapped-tool" | "no-matcher-support" | "closed-set";
    }
  | { kind: "handler"; event: BucketAEvent; matcher: string; handlerType: string };

export interface HooksPartition {
  readonly supported: HooksConfig;
  readonly dropped: readonly DroppedHook[];
}

type MatcherCondition = Extract<DroppedHook, { kind: "group" }>["cond"];

const BUCKET_A_MEMBERS = new Set<string>(BUCKET_A_EVENTS);
const TOOL_EVENT_MEMBERS = new Set<string>(TOOL_EVENTS);

function toolMatcherCondition(rawMatcher: string): MatcherCondition | null {
  const matcher = parseMatcher(rawMatcher);
  if (matcher.kind === "regex") {
    return "regex";
  }

  if (matcher.kind === "unmapped") {
    return "unmapped-tool";
  }

  return null;
}

function nonToolMatcherCondition(
  event: Exclude<BucketAEvent, ToolEvent>,
  rawMatcher: string,
): MatcherCondition | null {
  if (NON_TOOL_EVENT_FIELDS[event] === null) {
    return "no-matcher-support";
  }

  const closedSetEvent = event as keyof typeof NON_TOOL_EVENT_CLOSED_SETS;
  return NON_TOOL_EVENT_CLOSED_SETS[closedSetEvent].has(rawMatcher) ? null : "closed-set";
}

function matcherCondition(event: BucketAEvent, rawMatcher: string): MatcherCondition | null {
  if (TOOL_EVENT_MEMBERS.has(event)) {
    return toolMatcherCondition(rawMatcher);
  }

  if (rawMatcher === "" || rawMatcher === "*") {
    return null;
  }

  return nonToolMatcherCondition(event as Exclude<BucketAEvent, ToolEvent>, rawMatcher);
}

function partitionHandlers(
  event: BucketAEvent,
  matcher: string,
  group: HooksConfig[string][number],
  dropped: DroppedHook[],
): HooksConfig[string][number] | undefined {
  const supportedHandlers: HookHandlerEntry[] = [];
  for (const handler of group.hooks) {
    if (handler.type === "command") {
      supportedHandlers.push(handler);
    } else {
      dropped.push({ kind: "handler", event, matcher, handlerType: handler.type });
    }
  }

  return supportedHandlers.length === 0 ? undefined : { ...group, hooks: supportedHandlers };
}

function partitionGroups(
  event: BucketAEvent,
  groups: HooksConfig[string],
  dropped: DroppedHook[],
): HooksConfig[string] {
  const supportedGroups: HooksConfig[string] = [];
  for (const group of groups) {
    const matcher = group.matcher ?? "";
    const condition = matcherCondition(event, matcher);
    if (condition !== null) {
      dropped.push({ kind: "group", event, matcher, cond: condition });
      continue;
    }

    const supportedGroup = partitionHandlers(event, matcher, group, dropped);
    if (supportedGroup !== undefined) {
      supportedGroups.push(supportedGroup);
    }
  }

  return supportedGroups;
}

/** Separate supported hook declarations from degradable declarations. */
export function partitionHooks(config: HooksConfig): HooksPartition {
  const supported: Record<string, HooksConfig[string]> = {};
  const dropped: DroppedHook[] = [];

  for (const [eventName, groups] of Object.entries(config)) {
    if (!BUCKET_A_MEMBERS.has(eventName)) {
      dropped.push({ kind: "event", event: eventName });
      continue;
    }

    const event = eventName as BucketAEvent;
    const supportedGroups = partitionGroups(event, groups, dropped);
    if (supportedGroups.length > 0) {
      supported[event] = supportedGroups;
    }
  }

  return { supported, dropped };
}
