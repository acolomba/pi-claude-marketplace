import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Writes the user's project ledger of `projectDir` under `agentDir`, listing
 * the staged hooks config of each slug with the digest of its bytes as they
 * sit under `hooksDir` now, as this user's install would have (D-CF2-13).
 * Entries the ledger already lists stay.
 */
export async function recordStagedProjectHooks(
  agentDir: string,
  projectDir: string,
  hooksDir: string,
  slugs: readonly string[],
): Promise<void> {
  const project = await realpath(projectDir);
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const bytes = await readFile(path.join(hooksDir, slug, "hooks.json"));
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      return [`hooks/${slug}`, { plugin: slug, sha256 }] as const;
    }),
  );
  const directory = path.join(
    agentDir,
    "pi-claude-marketplace",
    "project-installs",
    createHash("sha256").update(project).digest("hex"),
  );
  const file = path.join(directory, "skills.json");
  const listed = await readFile(file, "utf8").then(
    (text) => (JSON.parse(text) as { readonly skills: Record<string, unknown> }).skills,
    () => ({}),
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    file,
    JSON.stringify({ version: 1, project, skills: { ...listed, ...Object.fromEntries(entries) } }),
    "utf8",
  );
}

/**
 * Writes `text` as the staged hooks config of `plugin` in the project scope of
 * `projectDir`, lists it in the user's project ledger under `agentDir`, and
 * returns the staged file's path (D-CF2-13).
 */
export async function stageListedProjectHooks(
  agentDir: string,
  projectDir: string,
  plugin: string,
  text: string,
): Promise<string> {
  const hooksDir = path.join(projectDir, ".pi", "pi-claude-marketplace", "hooks");
  const hooksJsonPath = path.join(hooksDir, plugin, "hooks.json");
  await mkdir(path.dirname(hooksJsonPath), { recursive: true });
  await writeFile(hooksJsonPath, text, "utf8");
  await recordStagedProjectHooks(agentDir, projectDir, hooksDir, [plugin]);
  return hooksJsonPath;
}
