/**
 * @fileoverview A new revision of a plugin a git repository on the git host
 * holds, which writes one file into the plugin's directory, such as the
 * `.mcp.json` that gives it an MCP server (MREC-03, P3-DC-25).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { pushGitRepository } from "./git-marketplace.ts";
import { repositoryPluginRoot } from "./git-plugin.ts";
import { runGit } from "./hermetic-git.ts";

import type { GitPluginRepository } from "./git-plugin.ts";

/**
 * Writes `text` to `file` inside the directory of the plugin `pluginName` of
 * `repository`, commits it, and pushes the commit as a new revision. Refuses a
 * file outside the plugin directory, so the fixture writes only in the
 * scenario's own repository. Returns the repository with that revision
 * appended and the path of the file inside the repository.
 */
export async function pushPluginFile(
  repository: GitPluginRepository,
  pluginName: string,
  file: string,
  text: string,
): Promise<{ readonly repository: GitPluginRepository; readonly pushedPath: string }> {
  const pluginRoot = repositoryPluginRoot(repository, pluginName);
  const target = path.resolve(pluginRoot, file);
  const inPlugin = path.relative(pluginRoot, target);
  if (inPlugin === "" || inPlugin.startsWith("..") || path.isAbsolute(inPlugin)) {
    throw new Error(`${file} lies outside the plugin ${pluginName} of ${repository.name}`);
  }

  const { workTree, gitHome } = repository;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
  await pushGitRepository(workTree, gitHome);
  return {
    repository: {
      ...repository,
      revisions: [...repository.revisions, await runGit(workTree, gitHome, "rev-parse", "HEAD")],
    },
    pushedPath: path.relative(workTree, target).split(path.sep).join(path.posix.sep),
  };
}
