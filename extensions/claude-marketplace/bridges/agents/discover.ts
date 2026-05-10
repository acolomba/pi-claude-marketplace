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

import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedAgentName } from "../../domain/name.ts";

import { parseFrontmatter } from "./frontmatter.ts";

import type { DiscoveredAgent } from "./types.ts";
import type { Dirent } from "node:fs";

/**
 * AG-1 / AG-6: discover plugin's agent files (flat, non-recursive).
 *
 * - ENOENT (or ENOTDIR) on agentsDir -> [] (plugin has no agents component).
 * - Skips dotfiles, non-.md files, and symlinks (T-03-27).
 * - Sorts by filename for determinism.
 * - sourceHash over raw bytes for BOM/line-ending tolerance.
 * - sourceName = frontmatter `name:` field if present, else filename stem.
 */
export async function discoverPluginAgents(input: {
  pluginName: string;
  agentsDir: string;
}): Promise<readonly DiscoveredAgent[]> {
  const { pluginName, agentsDir } = input;

  let entries: Dirent[];
  try {
    entries = await readdir(agentsDir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw err;
  }

  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const discovered: DiscoveredAgent[] = [];

  for (const entry of sorted) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.endsWith(".md")) {
      continue;
    }

    const sourcePath = path.join(agentsDir, entry.name);
    // T-03-27: refuse symlinks before reading the file. lstat-based check
    // (does NOT follow). Symlinks discovered here are skipped silently
    // (V1 behavior); a malicious plugin can't escape via symlink.
    const stat = await lstat(sourcePath);
    if (stat.isSymbolicLink()) {
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

    discovered.push({
      sourceName,
      generatedName: generatedAgentName(pluginName, sourceName),
      sourcePath,
      sourceHash,
      raw,
      body,
    });
  }

  return discovered;
}
