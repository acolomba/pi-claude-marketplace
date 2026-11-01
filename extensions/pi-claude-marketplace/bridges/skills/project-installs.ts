// bridges/skills/project-installs.ts
//
// D-CF2-13: the project-scope skills this user installed, kept outside the
// project. A project's `.pi/pi-claude-marketplace/` tree lives in the
// repository, so a clone can carry a staged `SKILL.md` and a `state.json`
// that names it, and Pi trusts a project that holds only that tree without
// asking. Claude Code 2.1.316 keeps its installed plugins in
// `installed_plugins.json` under the user's config directory, each
// project-scope entry tagged with its `projectPath`, and drops a plugin that
// only the repository's own files name (`not_installed_here`).
//
// This ledger is the same anchor, kept under the USER scope root, which a
// repository cannot write: one file per project, named by the SHA-256 of the
// canonical project path. It lists each skill that this user's install staged
// into the project, with its plugin and the digest of the staged skill
// directory (WR-03): every file and symbolic link under it, so a helper script
// that a `!` command runs is covered as well as `SKILL.md`. A project skill
// runs its `!` commands and claims an alias only when the ledger lists it for
// the current project with the digest of the directory as it is now.
//
// IN-06: one file per project means a write for one project never rewrites
// another project's entries. Every write for a project runs inside an
// operation that holds that project's state lock (`withStateGuard`), so two
// writes for one project never interleave, and a removed entry cannot come
// back from a stale read.

import { createHash } from "node:crypto";
import { readdir, readFile, readlink, realpath, rm } from "node:fs/promises";
import path from "node:path";

import Type from "typebox";
import { Compile } from "typebox/compile";

import { getAgentDir } from "../../platform/pi-api.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { ProjectSkillLedgerError } from "../../shared/errors-bridges.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { Dirent } from "node:fs";

const LEDGER_SCHEMA = Type.Object({
  version: Type.Literal(1),
  project: Type.String(),
  skills: Type.Record(Type.String(), Type.Object({ plugin: Type.String(), sha256: Type.String() })),
});

const LEDGER_VALIDATOR = Compile(LEDGER_SCHEMA);

/** One staged skill of a project: its plugin and the digest of its staged directory. */
export interface LedgerSkill {
  readonly plugin: string;
  readonly sha256: string;
}

/** The skills one project's ledger lists: each generated skill name maps to its entry. */
type ProjectSkills = Readonly<Record<string, LedgerSkill>>;

/** A change to the skills the ledger lists for one project. */
export interface ProjectSkillLedgerChange {
  /** The project directory, the parent of the project scope root. */
  readonly projectPath: string;
  /** Generated names the project no longer holds from this install. */
  readonly forget: readonly string[];
  /** Generated names of the skills this install staged, with their entries. */
  readonly remember: ReadonlyMap<string, LedgerSkill>;
}

/** Writes the ledger of project-scope skills. */
export interface ProjectSkillLedger {
  readonly update: (change: ProjectSkillLedgerChange) => Promise<void>;
}

/** `<agentDir>/pi-claude-marketplace/project-installs/`, inside the user scope (NFR-10). */
function projectInstallsRoot(agentDir: string): string {
  return path.join(agentDir, "pi-claude-marketplace", "project-installs");
}

/**
 * The directory of the ledger of the project whose canonical path is
 * `project`: `<root>/<SHA-256 of the path>/`, which holds `skills.json`.
 */
function projectLedgerDir(agentDir: string, project: string): string {
  return path.join(projectInstallsRoot(agentDir), sha256Hex(project));
}

/**
 * One entry of a staged skill directory: its path relative to the directory,
 * with `/` separators, and the SHA-256 of a file's bytes or of a symbolic
 * link's target. Directories carry no entry of their own.
 */
export interface SkillTreeEntry {
  readonly path: string;
  readonly kind: "file" | "symlink";
  readonly sha256: string;
}

/** Lists the entries of the staged skill directory `dir`. */
export type SkillTreeLister = (dir: string) => Promise<readonly SkillTreeEntry[]>;

function sha256Hex(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** The entries `dirent` stands for, named relative to `root`; a directory stands for its contents. */
async function direntEntries(
  root: string,
  dir: string,
  dirent: Dirent,
): Promise<readonly SkillTreeEntry[]> {
  const absolute = path.join(dir, dirent.name);
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (dirent.isDirectory()) {
    return treeEntries(root, absolute);
  }

  if (dirent.isFile()) {
    return [{ path: relative, kind: "file", sha256: sha256Hex(await readFile(absolute)) }];
  }

  if (dirent.isSymbolicLink()) {
    return [{ path: relative, kind: "symlink", sha256: sha256Hex(await readlink(absolute)) }];
  }

  throw new Error(`${absolute} is neither a file, a directory nor a symbolic link`);
}

/** The entries under `dir`, named relative to `root`; it never follows a symbolic link. */
async function treeEntries(root: string, dir: string): Promise<readonly SkillTreeEntry[]> {
  const dirents = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(dirents.map((dirent) => direntEntries(root, dir, dirent)));
  return nested.flat();
}

/**
 * WR-03: lists every file and symbolic link under the staged skill directory
 * `dir`. Any other kind of entry throws, so the check fails closed.
 */
export const NODE_SKILL_TREE_LISTER: SkillTreeLister = (dir) => treeEntries(dir, dir);

/**
 * WR-03: the digest of a staged skill directory. `skillFile` stands for the
 * entry `SKILL.md`, so the bytes the invocation parses and runs are the bytes
 * the digest covers. The entries are sorted by path, so the digest does not
 * depend on the order the directory lists them in, and an added, removed, or
 * changed entry changes it.
 */
export function skillTreeDigest(entries: readonly SkillTreeEntry[], skillFile: string): string {
  const covered = [
    ...entries.filter((entry) => entry.path !== "SKILL.md"),
    { path: "SKILL.md", kind: "file", sha256: sha256Hex(Buffer.from(skillFile, "utf8")) },
  ].sort((a, b) => (a.path < b.path ? -1 : 1));
  return sha256Hex(JSON.stringify(covered.map((entry) => [entry.path, entry.kind, entry.sha256])));
}

/**
 * The key of `projectPath`: its real path, so a symlinked checkout and its
 * target share one entry, or the resolved path when it does not exist.
 */
async function canonicalProjectPath(projectPath: string): Promise<string> {
  try {
    return await realpath(projectPath);
  } catch {
    return path.resolve(projectPath);
  }
}

/**
 * The skills the ledger `text` lists for `project`. Content that is not this
 * version's layout, or that names another project, lists nothing.
 */
function parseProjectSkills(text: string, project: string): ProjectSkills | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return LEDGER_VALIDATOR.Check(value) && value.project === project ? value.skills : undefined;
  } catch {
    return undefined;
  }
}

/**
 * D-CF2-13: the generated names of the skills this user installed into the
 * project at `projectPath`, each mapped to the digest its staged directory
 * had. A missing, unreadable or malformed ledger lists none, so every project
 * skill fails the check.
 */
export async function provenProjectSkills(
  agentDir: string,
  projectPath: string,
  read: (file: string) => Promise<string>,
): Promise<ReadonlyMap<string, string>> {
  const project = await canonicalProjectPath(projectPath);
  let text: string;
  try {
    text = await read(path.join(projectLedgerDir(agentDir, project), "skills.json"));
  } catch {
    return new Map();
  }

  const skills = parseProjectSkills(text, project) ?? {};
  return new Map(Object.entries(skills).map(([name, skill]) => [name, skill.sha256] as const));
}

/** The skills of one project after `change`. */
function changedSkills(current: ProjectSkills, change: ProjectSkillLedgerChange): ProjectSkills {
  const skills = Object.fromEntries(
    Object.entries(current).filter(([name]) => !change.forget.includes(name)),
  );
  for (const [name, skill] of change.remember) {
    skills[name] = { plugin: skill.plugin, sha256: skill.sha256 };
  }

  return skills;
}

/**
 * The skills the ledger `file` of `project` lists, for the writer. A missing
 * file lists nothing. Any other read failure, and content this version did
 * not write or that names another project, throws, so the write never drops
 * entries it could not read (WR-02).
 */
async function skillsToUpdate(file: string, project: string): Promise<ProjectSkills> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw new ProjectSkillLedgerError(file, "unreadable", { cause: err });
  }

  const skills = parseProjectSkills(text, project);
  if (skills === undefined) {
    throw new ProjectSkillLedgerError(file, "unknown-content");
  }

  return skills;
}

/**
 * D-CF2-13: the ledger under the user scope root of `agentDir()`, written
 * atomically (NFR-1) and only when a change alters what it lists. A project
 * whose last skill is forgotten loses its ledger directory.
 */
function createProjectSkillLedger(agentDir: () => string): ProjectSkillLedger {
  return {
    update: async (change) => {
      const project = await canonicalProjectPath(change.projectPath);
      const dir = projectLedgerDir(agentDir(), project);
      await assertPathInside(projectInstallsRoot(agentDir()), dir, "project skill ledger");
      const file = path.join(dir, "skills.json");
      const current = await skillsToUpdate(file, project);
      const skills = changedSkills(current, change);
      if (JSON.stringify(skills) === JSON.stringify(current)) {
        return;
      }

      if (Object.keys(skills).length === 0) {
        await rm(dir, { recursive: true, force: true });
        return;
      }

      await atomicWriteJson(file, { version: 1, project, skills });
    },
  };
}

/** The ledger of the Pi agent directory in use. */
export const NODE_PROJECT_SKILL_LEDGER: ProjectSkillLedger = createProjectSkillLedger(getAgentDir);
