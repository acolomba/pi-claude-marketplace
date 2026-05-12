// bridges/agents/discover.ts
//
// AG-1 / AG-6: discover and parse <pluginRoot>/agents/*.md (non-recursive).
// Carries V1's discoverPluginAgents (was co-located in agent/convert.ts) and
// hoists into a dedicated module so convert.ts stays pure.
//
// sourceHash is computed over RAW BYTES (not utf8 text) so the digest
// survives BOM and line-ending normalization. This is one of V1's
// "got right" properties (RESEARCH.md "What V1 got right" #5).
//
// T-03-27 mitigation: lstat + isSymbolicLink() skip on every .md entry
// before reading, plus dotfile skip. Refuses symlinked .md files outright
// rather than following them (consistent with PS-1).
//
// D-07 (COMP-01): signature flips from `agentsDir: string` to `agentsDirs:
// readonly string[]` for symmetry with the skills/commands bridges. The
// inner read loop is unchanged. First-wins dedup by generated agent name
// across array elements; the second occurrence surfaces in `warnings[]`.
// RN-4 cross-marketplace agent ownership conflicts remain enforced in
// `bridges/agents/stage.ts::prepareStagePluginAgents` (NOT duplicated
// here -- that's the wrong layer; this module knows nothing about
// marketplace ownership).

import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedAgentName } from "../../domain/name.ts";

import { parseFrontmatter } from "./frontmatter.ts";

import type { DiscoveredAgent } from "./types.ts";
import type { Dirent } from "node:fs";

/** D-07 return shape: `{ discovered, warnings }`. */
export interface DiscoverPluginAgentsResult {
  readonly discovered: readonly DiscoveredAgent[];
  readonly warnings: readonly string[];
}

async function readEntriesGracefully(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw err;
  }
}

async function isAgentFile(dir: string, entry: Dirent): Promise<boolean> {
  if (entry.name.startsWith(".") || !entry.isFile() || !entry.name.endsWith(".md")) {
    return false;
  }

  const stat = await lstat(path.join(dir, entry.name));
  return !stat.isSymbolicLink();
}

function duplicateWarning(sourceName: string, agentsDir: string, generatedName: string): string {
  return (
    `agent source "${sourceName}" in "${agentsDir}" elides to generated name ` +
    `"${generatedName}" already produced by an earlier componentPaths.agents entry; ` +
    `ignoring duplicate.`
  );
}

/**
 * AG-1 / AG-6: discover plugin's agent files (flat, non-recursive).
 *
 * - ENOENT (or ENOTDIR) on any agentsDir element -> skipped, others continue.
 * - Skips dotfiles, non-.md files, and symlinks (T-03-27).
 * - Sorts by filename for determinism within each dir.
 * - sourceHash over raw bytes for BOM/line-ending tolerance.
 * - sourceName = frontmatter `name:` field if present, else filename stem.
 * - D-07: first-wins dedup by generated agent name across array elements;
 *   the second occurrence surfaces as a warning, NOT a throw.
 */
export async function discoverPluginAgents(input: {
  pluginName: string;
  agentsDirs: readonly string[];
}): Promise<DiscoverPluginAgentsResult> {
  const { pluginName, agentsDirs } = input;

  const seenByGenerated = new Map<string, DiscoveredAgent>();
  const warnings: string[] = [];

  for (const agentsDir of agentsDirs) {
    const entries = await readEntriesGracefully(agentsDir);

    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sorted) {
      const sourcePath = path.join(agentsDir, entry.name);
      // T-03-27: refuse symlinks before reading the file. lstat-based check
      // (does NOT follow). Symlinks discovered here are skipped silently
      // (V1 behavior); a malicious plugin can't escape via symlink.
      if (!(await isAgentFile(agentsDir, entry))) {
        continue;
      }

      // Hash raw bytes (not utf8 text) so the digest survives BOM and
      // line-ending normalization (RESEARCH "What V1 got right" #5).
      const bytes = await readFile(sourcePath);
      const sourceHash = createHash("sha256").update(bytes).digest("hex");
      const text = bytes.toString("utf8");

      const { raw, body } = parseFrontmatter(text);
      const stem = entry.name.slice(0, -3);
      const sourceName = raw.name ?? stem;
      assertSafeName(sourceName, `agent name in ${sourcePath}`);

      const generatedName = generatedAgentName(pluginName, sourceName);

      // D-07 first-wins dedup across array elements; within-dir
      // collisions on generated name are caught later by
      // `assertNoAgentCollisions` (hard error).
      if (seenByGenerated.has(generatedName)) {
        warnings.push(duplicateWarning(sourceName, agentsDir, generatedName));
        continue;
      }

      seenByGenerated.set(generatedName, {
        sourceName,
        generatedName,
        sourcePath,
        sourceHash,
        raw,
        body,
      });
    }
  }

  return {
    discovered: Object.freeze([...seenByGenerated.values()]),
    warnings: Object.freeze(warnings),
  };
}
