import path from "node:path";

export type E2ETargetKind = "skills" | "commands" | "agents" | "mcp";

export interface E2ETarget {
  readonly plugin: string;
  readonly marketplace: "claude-plugins-official";
  readonly kind: E2ETargetKind;
  readonly sourceDirectory: string;
  readonly fixtureDirectory: string;
  readonly softDepMatrix: boolean;
  readonly rationale: string;
}

export const TARGETS: readonly E2ETarget[] = [
  {
    plugin: "frontend-design",
    marketplace: "claude-plugins-official",
    kind: "skills",
    sourceDirectory: "plugins/frontend-design",
    fixtureDirectory: "plugins/frontend-design",
    softDepMatrix: false,
    rationale: "Local source tree with skills only, selected to prove SK-5 reload discovery.",
  },
  {
    plugin: "code-review",
    marketplace: "claude-plugins-official",
    kind: "commands",
    sourceDirectory: "plugins/code-review",
    fixtureDirectory: "plugins/code-review",
    softDepMatrix: false,
    rationale: "Local source tree with prompt commands only, selected to prove CM-4 discovery.",
  },
  {
    plugin: "code-simplifier",
    marketplace: "claude-plugins-official",
    kind: "agents",
    sourceDirectory: "plugins/code-simplifier",
    fixtureDirectory: "plugins/code-simplifier",
    softDepMatrix: true,
    rationale: "Local source tree with agents only, selected for the pi-subagents soft-dep matrix.",
  },
  {
    plugin: "context7",
    marketplace: "claude-plugins-official",
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
