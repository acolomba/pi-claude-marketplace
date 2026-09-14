import path from "node:path";

import { resolveContainedComponentPath } from "./component-paths.ts";
import { MCP_SERVERS_VALIDATOR } from "./components/mcp.ts";

import type { StatKindReader } from "./resolver-types.ts";

/** Mutable resolver fields owned by MCP resolution. */
export interface McpResolution {
  notes: string[];
  mcpServers: Record<string, unknown>;
}

interface McpResolutionDependencies {
  readonly statKind: StatKindReader;
  readonly readFileText: (path: string) => Promise<string>;
}

function applyMcpValue(resolution: McpResolution, mcp: unknown): boolean {
  if (mcp === undefined) {
    return false;
  }

  if (MCP_SERVERS_VALIDATOR.Check(mcp)) {
    resolution.mcpServers = mcp;
    return false;
  }

  const errorDetail = MCP_SERVERS_VALIDATOR.Errors(mcp)
    .slice(0, 1)
    .map((error) => error.message)
    .join("");
  resolution.notes.push(`malformed mcpServers: ${errorDetail}`);

  return true;
}

async function readStandaloneMcp(
  pluginRoot: string,
  dependencies: McpResolutionDependencies,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
  const mcpPath = path.join(pluginRoot, ".mcp.json");
  if ((await dependencies.statKind(mcpPath)) !== "file") {
    return { ok: true, value: undefined };
  }

  try {
    const raw = await dependencies.readFileText(mcpPath);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { ok: true, value: "mcpServers" in parsed ? parsed.mcpServers : parsed };
  } catch (error: unknown) {
    return {
      ok: false,
      reason: `malformed mcpServers (.mcp.json): ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function validateReferencePath(
  raw: string,
  pluginRoot: string,
): Promise<{ ok: true; absolutePath: string } | { ok: false; reason: string }> {
  const contained = await resolveContainedComponentPath(pluginRoot, raw, "mcpServers reference");
  if (!contained.ok && contained.cause === "absolute") {
    return {
      ok: false,
      reason: `malformed mcp reference: must be relative (got absolute "${raw}")`,
    };
  }

  if (!contained.ok) {
    return { ok: false, reason: `malformed mcp reference: escapes plugin root: "${raw}"` };
  }

  return contained;
}

async function readReferencedMcp(
  pluginRoot: string,
  raw: string,
  dependencies: McpResolutionDependencies,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
  const validated = await validateReferencePath(raw, pluginRoot);
  if (!validated.ok) {
    return validated;
  }

  if ((await dependencies.statKind(validated.absolutePath)) !== "file") {
    return { ok: false, reason: `malformed mcp reference: file not found: "${raw}"` };
  }

  const text = await dependencies.readFileText(validated.absolutePath);
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!("mcpServers" in parsed)) {
      return {
        ok: false,
        reason: `malformed mcp reference: missing top-level "mcpServers": "${raw}"`,
      };
    }

    return { ok: true, value: parsed.mcpServers };
  } catch (error: unknown) {
    return {
      ok: false,
      reason: `malformed mcp reference: invalid JSON in "${raw}": ${(error as SyntaxError).message}`,
    };
  }
}

/** Resolves strict inline, referenced, manifest, or standalone MCP declarations. */
export async function resolveStrictMcp(
  input: {
    readonly entry: { readonly mcpServers?: unknown };
    readonly manifest: { readonly mcpServers?: unknown } | null;
    readonly pluginRoot: string;
    readonly resolution: McpResolution;
  },
  dependencies: {
    readonly statKind: StatKindReader;
    readonly readFileText: (path: string) => Promise<string>;
  },
): Promise<boolean> {
  const declaredMcp = input.entry.mcpServers ?? input.manifest?.mcpServers;

  if (typeof declaredMcp === "string") {
    const referenced = await readReferencedMcp(input.pluginRoot, declaredMcp, dependencies);
    if (!referenced.ok) {
      input.resolution.notes.push(referenced.reason);
      return true;
    }

    return applyMcpValue(input.resolution, referenced.value);
  }

  const standalone =
    declaredMcp === undefined ? await readStandaloneMcp(input.pluginRoot, dependencies) : undefined;
  if (standalone?.ok === false) {
    input.resolution.notes.push(standalone.reason);
    return true;
  }

  return applyMcpValue(input.resolution, declaredMcp ?? standalone?.value);
}
