import path from "node:path";

/**
 * D-PL5-23: the name the e2e checkout of the official marketplace declares.
 * The add is a path source, and `marketplace add` refuses Claude Code's
 * reserved names from any source but the anthropics GitHub organization.
 */
export const E2E_MARKETPLACE_NAME = "upstream-e2e";

export type E2ETargetKind = "skills" | "commands" | "agents" | "mcp";

export interface E2ETarget {
  readonly plugin: string;
  readonly marketplace: typeof E2E_MARKETPLACE_NAME;
  readonly kind: E2ETargetKind;
  readonly sourceDirectory: string;
  readonly fixtureDirectory: string;
  readonly softDepMatrix: boolean;
  readonly rationale: string;
}

export const TARGETS: readonly E2ETarget[] = [
  {
    plugin: "frontend-design",
    marketplace: E2E_MARKETPLACE_NAME,
    kind: "skills",
    sourceDirectory: "plugins/frontend-design",
    fixtureDirectory: "plugins/frontend-design",
    softDepMatrix: false,
    rationale: "Local source tree with skills only, selected to prove SK-5 reload discovery.",
  },
  {
    plugin: "code-review",
    marketplace: E2E_MARKETPLACE_NAME,
    kind: "commands",
    sourceDirectory: "plugins/code-review",
    fixtureDirectory: "plugins/code-review",
    softDepMatrix: false,
    rationale: "Local source tree with prompt commands only, selected to prove CM-4 discovery.",
  },
  {
    plugin: "code-simplifier",
    marketplace: E2E_MARKETPLACE_NAME,
    kind: "agents",
    sourceDirectory: "plugins/code-simplifier",
    fixtureDirectory: "plugins/code-simplifier",
    softDepMatrix: true,
    rationale: "Local source tree with agents only, selected for the pi-subagents soft-dep matrix.",
  },
  {
    plugin: "context7",
    marketplace: E2E_MARKETPLACE_NAME,
    kind: "mcp",
    sourceDirectory: "external_plugins/context7",
    fixtureDirectory: "plugins/context7",
    softDepMatrix: true,
    rationale:
      "Local external plugin with MCP servers only, selected for the pi-mcp-adapter matrix.",
  },
] as const;

export function targetSourcePath(upstreamRoot: string, target: E2ETarget): string {
  return path.join(upstreamRoot, target.sourceDirectory);
}

export function targetByPlugin(plugin: string): E2ETarget {
  const target = TARGETS.find((candidate) => candidate.plugin === plugin);
  if (target === undefined) {
    throw new Error(`Unknown e2e target: ${plugin}`);
  }

  return target;
}
