// tests/integration/skill-path-resolution.test.ts
//
// SC-2 resolver-contract coverage: proves the `skillPath` this extension
// emits (AGSK-06 / D-84-04) actually resolves the bridged skill through
// pi-subagents' own `resolveSkillsWithFallback`, and that the resolved
// skill never enters the parent/global catalog (invocation-private).
//
// pi-subagents is an OPTIONAL peer -- never a `dependencies` or
// `devDependencies` entry -- and its package.json `exports` map exposes
// only ".", "./background-work", and "./delegation". The resolver lives in
// the un-exported internal skills module, so it cannot be imported by a
// bare specifier subpath (that throws ERR_PACKAGE_PATH_NOT_EXPORTED even
// when the package is installed).
//
// It also cannot be imported directly from its installed location: Node
// refuses native TypeScript type-stripping for any file whose resolved
// path contains a `node_modules` segment
// (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), and an npm-installed
// package -- global or local -- always lives under one. This test copies
// the installed package's real, unmodified `src/` tree into a scratch
// directory outside node_modules and imports the internal module from
// there by an absolute file path via `pathToFileURL`. Every step is
// wrapped in try/catch, skipping gracefully on any failure so
// `npm run check` stays green in environments where the optional peer is
// absent.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { emitGeneratedAgentFile } from "../../extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

interface ResolvedSkillLike {
  readonly name: string;
}

interface DiscoveredSkillLike {
  readonly name: string;
}

interface PiSubagentsSkillsModule {
  readonly resolveSkillsWithFallback: (
    skillNames: string[],
    primaryCwd: string,
    fallbackCwd?: string,
    localSkillPaths?: string[],
    localBaseDir?: string,
  ) => { resolved: ResolvedSkillLike[]; missing: string[] };
  readonly discoverAvailableSkills: (cwd: string) => DiscoveredSkillLike[];
}

/**
 * Locates the installed pi-subagents package root. Checks an env override
 * first, then falls back to the conventional global npm install location
 * (`npm root -g`) so the test works across machines without hardcoding a
 * platform-specific path.
 */
function resolvePiSubagentsPackageRoot(): string | undefined {
  const override = process.env.PI_SUBAGENTS_ROOT;
  if (override) {
    return override;
  }

  try {
    const globalNodeModules = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    return globalNodeModules ? path.join(globalNodeModules, "pi-subagents") : undefined;
  } catch {
    // Global npm root lookup is best-effort; treated as "not reachable".
    return undefined;
  }
}

/**
 * Copies the installed package's real `src/` tree into `<scratchRoot>/pi-subagents-src`
 * (outside node_modules, sidestepping Node's node_modules type-stripping
 * restriction) and dynamically imports the internal skills module from
 * there by absolute file path. Returns undefined on ANY failure (package
 * not installed, internal module moved, copy failed, loader cannot strip
 * the external `.ts`) so callers can skip the test gracefully rather than
 * fail on absence.
 */
async function loadPiSubagentsSkillsModule(
  scratchRoot: string,
): Promise<PiSubagentsSkillsModule | undefined> {
  const packageRoot = resolvePiSubagentsPackageRoot();
  if (!packageRoot) {
    return undefined;
  }

  const installedSrcDir = path.join(packageRoot, "src");
  if (!existsSync(installedSrcDir)) {
    return undefined;
  }

  const scratchSrcDir = path.join(scratchRoot, "pi-subagents-src");
  try {
    await cp(installedSrcDir, scratchSrcDir, { recursive: true });
  } catch {
    return undefined;
  }

  const internalModulePath = path.join(scratchSrcDir, "agents", "skills.ts");
  if (!existsSync(internalModulePath)) {
    return undefined;
  }

  try {
    return (await import(pathToFileURL(internalModulePath).href)) as PiSubagentsSkillsModule;
  } catch {
    return undefined;
  }
}

test("SC-2 / AGSK-06: emitted skillPath resolves the staged skill via pi-subagents' resolveSkillsWithFallback and stays out of the global catalog", async (t) => {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const originalOffline = process.env.PI_OFFLINE;
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "skillpath-sc2-"));
  const runtimeCwd = path.join(tmpRoot, "runtime-cwd");
  const generatedName = `skillpath-sc2-${randomUUID().slice(0, 8)}`;

  try {
    const skillsModule = await loadPiSubagentsSkillsModule(tmpRoot);
    if (!skillsModule) {
      t.skip("pi-subagents resolver module not reachable in this environment");
      return;
    }

    const { resolveSkillsWithFallback, discoverAvailableSkills } = skillsModule;

    await mkdir(runtimeCwd, { recursive: true });

    // Hermetic PI_CODING_AGENT_DIR so both this extension's locationsFor and
    // pi-subagents' own getAgentDir() resolve inside the temp fixture,
    // mirroring the pattern in hooks-spawn-end-to-end.test.ts. PI_OFFLINE
    // skips pi-subagents' global-npm-package skill scan so the global
    // catalog assertion below is not influenced by unrelated installed
    // packages.
    process.env.PI_CODING_AGENT_DIR = path.join(tmpRoot, "agent");
    process.env.PI_OFFLINE = "1";

    const locations = locationsFor("user", runtimeCwd);

    // Produce the agent file through the real emitter (closing the loop
    // with the SC-1 emitter coverage) so the resolver call below exercises
    // the emitter's actual skillPath output, not a hand-copied string.
    const agentFileContent = emitGeneratedAgentFile({
      frontmatter: {
        name: "skillpath-sc2-agent",
        description: "SC-2 fixture agent exercising the real skillPath emitter output.",
        tools: ["Read"],
        skills: [generatedName],
        inheritSkills: false,
      },
      provenance: {
        pluginName: "skillpath-sc2-fixture",
        sourceName: "skillpath-sc2-source",
        sourcePath: "/fixtures/skillpath-sc2",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
      body: "SC-2 fixture agent body.",
    });

    await mkdir(locations.agentsDir, { recursive: true });
    const agentFilePath = path.join(locations.agentsDir, "skillpath-sc2-agent.md");
    await writeFile(agentFilePath, agentFileContent, "utf8");

    const writtenAgentFile = await readFile(agentFilePath, "utf8");
    assert.match(
      writtenAgentFile,
      /^skillPath: \.\.\/pi-claude-marketplace\/resources\/skills$/m,
      "the written agent file must carry the D-84-04 skillPath constant",
    );

    // Stage a real skill install at the production skillsTargetDir layout
    // (<extensionRoot>/resources/skills/<generatedName>/SKILL.md).
    const skillDir = path.join(locations.skillsTargetDir, generatedName);
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      [
        "---",
        `name: ${generatedName}`,
        "description: SC-2 fixture skill staged at the production skillsTargetDir layout.",
        "---",
        "",
        "SC-2 fixture skill body.",
        "",
      ].join("\n"),
      "utf8",
    );

    // localBaseDir = dirname(agent.filePath), mirroring pi-subagents' own
    // foreground/background call sites (0.35.1 execution.ts).
    const { resolved, missing } = resolveSkillsWithFallback(
      [generatedName],
      runtimeCwd,
      runtimeCwd,
      ["../pi-claude-marketplace/resources/skills"],
      path.dirname(agentFilePath),
    );

    assert.ok(
      resolved.some((skill) => skill.name === generatedName),
      "resolveSkillsWithFallback must resolve the generated skill by name via the emitted skillPath",
    );
    assert.ok(!missing.includes(generatedName), "the generated skill must not be reported missing");

    const globalCatalog = discoverAvailableSkills(runtimeCwd);
    assert.ok(
      !globalCatalog.some((skill) => skill.name === generatedName),
      "the resolved skill must stay invocation-private and never enter the global catalog",
    );
  } finally {
    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    if (originalOffline === undefined) {
      delete process.env.PI_OFFLINE;
    } else {
      process.env.PI_OFFLINE = originalOffline;
    }

    await rm(tmpRoot, { recursive: true, force: true });
  }
});
