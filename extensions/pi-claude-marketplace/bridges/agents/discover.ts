// bridges/agents/discover.ts
//
// AG-1 / AG-6: discover and parse the agent files of a plugin. Lives in a
// dedicated module so convert.ts stays pure.
//
// D-CF4-01: each agents folder is walked recursively, as Claude Code walks a
// plugin's `agents/` folder. The folders between the agents folder and a file
// become the agent's namespace (`agents/review/security.md` is
// `<plugin>:review:security`). A file is an agent when its name ends in `.md`
// in any case; only a lower-case `.md` is cut from the name, so `UPPER.MD`
// stays `UPPER.MD`. Dotfiles and dot-folders are agents and namespaces like
// any other. A folder whose namespace already has 32 segments is not read.
//
// T-03-27: the walk descends only into entries `readdir` reports as folders
// and reads only entries it reports as regular files. A symlink is neither,
// so a symlinked file or folder inside the tree is skipped and a plugin
// cannot point the walk outside itself.
//
// A declared `agents` path that names a regular file ending in a lower-case
// `.md` is one agent with no namespace, as Claude Code keeps a listed file's
// bare name. Any other declared path is walked as a folder; the walk follows
// a symlinked agents folder itself, as Claude Code follows its scan root.
// Two residuals differ from Claude Code: a declared folder is walked,
// although Claude Code refuses a folder in `agents`, and a declared symlinked
// file installs nothing, although Claude Code follows it.
//
// sourceHash is computed over RAW BYTES (not utf8 text) so the digest
// survives BOM and line-ending normalization.
//
// D-07 (COMP-01): the signature is `agentsDirs: readonly string[]` for
// symmetry with the skills/commands bridges. First-discovered generated names
// win within and across paths; later duplicates surface with both full
// source paths in `warnings[]`. RN-4 ownership conflicts are enforced in
// `bridges/agents/stage.ts::prepareStagePluginAgents` (NOT duplicated here --
// that's the wrong layer; this module knows nothing about marketplace
// ownership).

import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedAgentName } from "../../domain/name.ts";
import { isErrnoException } from "../../shared/errors.ts";
import { readDirEntriesTolerant } from "../../shared/fs-utils.ts";

import { parseFrontmatter } from "./frontmatter.ts";

import type { DiscoveredAgent } from "./types.ts";

/** D-07 return shape: `{ discovered, warnings }`. */
export interface DiscoverPluginAgentsResult {
  readonly discovered: readonly DiscoveredAgent[];
  readonly warnings: readonly string[];
}

/** D-CF4-01: Claude Code does not read a folder this many segments deep. */
const MAX_AGENT_NAMESPACE_DEPTH = 32;

/** D-CF4-01: an agent file's extension, matched in any case. */
const AGENT_FILE_EXTENSION = /\.md$/iu;

/** One agent file the walk found, with the folders that lead to it. */
interface AgentFile {
  readonly path: string;
  readonly namespace: readonly string[];
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

// Yields the agent files under `dir` depth first, each folder's entries in
// `localeCompare` order with files and subfolders interleaved, so the AG-12
// winner of a shared generated name is fixed.
async function* agentFilesIn(
  dir: string,
  namespace: readonly string[],
): AsyncGenerator<AgentFile, void, undefined> {
  if (namespace.length >= MAX_AGENT_NAMESPACE_DEPTH) {
    return;
  }

  const entries = await readDirEntriesTolerant(dir);
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* agentFilesIn(entryPath, [...namespace, entry.name]);
    } else if (entry.isFile() && AGENT_FILE_EXTENSION.test(entry.name)) {
      yield { path: entryPath, namespace };
    }
  }
}

// Whether `file` is a regular file, not following a symlink. A path that is
// missing, or that runs through a file, is not one.
async function isRegularFile(file: string): Promise<boolean> {
  try {
    return (await lstat(file)).isFile();
  } catch (error: unknown) {
    if (isErrnoException(error) && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return false;
    }

    throw error;
  }
}

// Yields the agent files of one declared or default agents path: the path
// itself when it names a regular `.md` file, else the files of its walk.
async function* agentFilesAt(agentsPath: string): AsyncGenerator<AgentFile, void, undefined> {
  if (agentsPath.endsWith(".md") && (await isRegularFile(agentsPath))) {
    yield { path: agentsPath, namespace: [] };
    return;
  }

  yield* agentFilesIn(agentsPath, []);
}

// Reads one agent file and records it in `seenByGenerated`, unless an earlier
// file already produced its generated name (AG-12), which `warnings` reports.
async function collectAgentFile(
  pluginName: string,
  file: AgentFile,
  seenByGenerated: Map<string, DiscoveredAgent>,
  warnings: string[],
): Promise<void> {
  const sourcePath = file.path;
  const bytes = await readFile(sourcePath);
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const { raw, body } = parseFrontmatter(bytes.toString("utf8"));
  const fileName = path.basename(sourcePath);
  const stem = fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName;
  const sourceName = raw.name ?? stem;
  assertSafeName(sourceName, `agent name in ${sourcePath}`);

  const generatedName = generatedAgentName(pluginName, sourceName, file.namespace);
  const incumbent = seenByGenerated.get(generatedName);
  if (incumbent !== undefined) {
    warnings.push(duplicateWarning(incumbent, sourceName, sourcePath));
    return;
  }

  seenByGenerated.set(generatedName, {
    sourceName,
    generatedName,
    sourcePath,
    ...(file.namespace.length > 0 && { namespace: file.namespace }),
    sourceHash,
    raw,
    body,
  });
}

/**
 * AG-1 / AG-6 / D-CF4-01: discover a plugin's agent files.
 *
 * - A missing agents path, or one that runs through a file, gives no agent;
 *   the other paths still contribute.
 * - Walks each folder recursively in `localeCompare` order; skips symlinks
 *   and files whose name does not end in `.md` in any case (T-03-27).
 * - sourceHash over raw bytes for BOM/line-ending tolerance.
 * - sourceName = frontmatter `name:` field if present, else the file name
 *   without a lower-case `.md`; the folders become `namespace`.
 * - AG-12: first-discovered generated names win within and across paths;
 *   later duplicates warn with both full paths. Discovery owns this policy.
 */
export async function discoverPluginAgents(input: {
  pluginName: string;
  agentsDirs: readonly string[];
}): Promise<DiscoverPluginAgentsResult> {
  const { pluginName, agentsDirs } = input;

  const seenByGenerated = new Map<string, DiscoveredAgent>();
  const warnings: string[] = [];

  for (const agentsPath of agentsDirs) {
    // eslint-disable-next-line no-await-in-loop -- AG-12: the first-discovered name wins the shared map
    for await (const file of agentFilesAt(agentsPath)) {
      await collectAgentFile(pluginName, file, seenByGenerated, warnings);
    }
  }

  return {
    discovered: Object.freeze([...seenByGenerated.values()]),
    warnings: Object.freeze(warnings),
  };
}
