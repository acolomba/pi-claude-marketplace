// bridges/agents/discover.ts
//
// AG-1 / AG-6: discover and parse <pluginRoot>/agents/*.md (non-recursive).
// Lives in a dedicated module so convert.ts stays pure.
//
// sourceHash is computed over RAW BYTES (not utf8 text) so the digest
// survives BOM and line-ending normalization.
//
// T-03-27 mitigation: lstat + isSymbolicLink() skip on every .md entry
// before reading, plus dotfile skip. Refuses symlinked .md files outright
// rather than following them (consistent with PS-1).
//
// D-07 (COMP-01): the signature is `agentsDirs: readonly string[]` for
// symmetry with the skills/commands bridges. First-discovered exact source
// names win within and across directories; later duplicates surface with
// both full source paths in `warnings[]`. RN-4 ownership conflicts are
// enforced in `bridges/agents/stage.ts::prepareStagePluginAgents` (NOT
// duplicated here -- that's the wrong layer; this module knows nothing about
// marketplace ownership).

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedAgentName } from "../../domain/name.ts";
import { isPlainMarkdownFile, readDirEntriesTolerant } from "../../shared/fs-utils.ts";

import { parseFrontmatter } from "./frontmatter.ts";

import type { DiscoveredAgent } from "./types.ts";

/** D-07 return shape: `{ discovered, warnings }`. */
export interface DiscoverPluginAgentsResult {
  readonly discovered: readonly DiscoveredAgent[];
  readonly warnings: readonly string[];
}

function duplicateWarning(
  incumbent: DiscoveredAgent,
  sourceName: string,
  sourcePath: string,
): string {
  return (
    `agent source "${sourceName}" at "${sourcePath}" duplicates generated name ` +
    `"${incumbent.generatedName}" already produced by agent source "${incumbent.sourceName}" ` +
    `at "${incumbent.sourcePath}"; keeping first discovered source.`
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
 * - AG-12: first-discovered exact source names win within and across dirs;
 *   later duplicates warn with both full paths. Discovery owns this policy.
 */
export async function discoverPluginAgents(input: {
  pluginName: string;
  agentsDirs: readonly string[];
}): Promise<DiscoverPluginAgentsResult> {
  const { pluginName, agentsDirs } = input;

  const seenByGenerated = new Map<string, DiscoveredAgent>();
  const warnings: string[] = [];

  for (const agentsDir of agentsDirs) {
    const entries = await readDirEntriesTolerant(agentsDir);

    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sorted) {
      const sourcePath = path.join(agentsDir, entry.name);
      // T-03-27: refuse symlinks before reading the file. lstat-based check
      // (does NOT follow). Symlinks discovered here are skipped silently;
      // a malicious plugin can't escape via symlink.
      if (!(await isPlainMarkdownFile(agentsDir, entry))) {
        continue;
      }

      // Hash raw bytes (not utf8 text) so the digest survives BOM and
      // line-ending normalization.
      const bytes = await readFile(sourcePath);
      const sourceHash = createHash("sha256").update(bytes).digest("hex");
      const text = bytes.toString("utf8");

      const { raw, body } = parseFrontmatter(text);
      const stem = entry.name.slice(0, -3);
      const sourceName = raw.name ?? stem;
      assertSafeName(sourceName, `agent name in ${sourcePath}`);

      const generatedName = generatedAgentName(pluginName, sourceName);

      // Full-source generation preserves distinct names within this plugin.
      const incumbent = seenByGenerated.get(generatedName);
      if (incumbent !== undefined) {
        warnings.push(duplicateWarning(incumbent, sourceName, sourcePath));
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
