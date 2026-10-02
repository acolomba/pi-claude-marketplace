// tests/integration/skill-path-resolution.test.ts
//
// SC-2 resolver-contract coverage: proves the `skillPath` this extension
// emits (AGSK-06 / D-84-04) actually resolves the bridged skill through
// pi-subagents' own `resolveSkillsWithFallback`, and that the resolved
// skill never enters the parent/global catalog (invocation-private).
//
// pi-subagents is an optional peer -- never a `dependencies` or
// `devDependencies` entry. The resolver lives in its internal skills module,
// which the package's `exports` map does not expose, so the test imports the
// compiled `src/agents/skills.js` in place through the shared loader in
// pi-subagents-peer.ts.
//
// The test skips when the peer is not installed, so `npm run check` stays
// green there. It also skips when the installed version is below the declared
// peer floor, because a pass there proves nothing about a supported version.
// An at-or-above-floor package whose module is missing or fails to import
// fails the test, and so does a `PI_SUBAGENTS_ROOT` that names no
// pi-subagents package. A run reports the proven version as a diagnostic.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { emitGeneratedAgentFile } from "../../extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import {
  findPiSubagentsPackage,
  isBelowPeerFloor,
  loadPiSubagentsModule,
  readPeerFloor,
} from "./pi-subagents-peer.ts";

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

test("SC-2 / AGSK-06: emitted skillPath resolves the staged skill via pi-subagents' resolveSkillsWithFallback and stays out of the global catalog", async (t) => {
  // Find the peer before the hermetic HOME hides the operator's npm config,
  // which can move the `npm root -g` prefix.
  const peer = await findPiSubagentsPackage();
  const belowFloor = peer !== undefined && (await isBelowPeerFloor(peer.version));
  const originalOffline = process.env.PI_OFFLINE;
  const { root: tmpRoot } = await createHermeticEnvironment(t, "skillpath-sc2-");
  const runtimeCwd = path.join(tmpRoot, "runtime-cwd");
  const generatedName = `skillpath-sc2-${randomUUID().slice(0, 8)}`;

  try {
    if (!peer) {
      t.skip("pi-subagents is not installed in this environment");
      return;
    }

    if (belowFloor) {
      t.skip(
        `pi-subagents ${peer.version} at ${peer.root} is below the peer floor ${await readPeerFloor()}`,
      );
      return;
    }

    t.diagnostic(`pi-subagents ${peer.version} at ${peer.root}`);
    const skillsModule = await loadPiSubagentsModule<PiSubagentsSkillsModule>(peer, "skills");

    const { resolveSkillsWithFallback, discoverAvailableSkills } = skillsModule;

    await mkdir(runtimeCwd, { recursive: true });

    // The hermetic PI_CODING_AGENT_DIR makes both this extension's locationsFor
    // and pi-subagents' own getAgentDir() resolve inside the temp fixture.
    // PI_OFFLINE skips pi-subagents' global-npm-package skill scan so the
    // global catalog assertion below is not influenced by unrelated installed
    // packages.
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

    // localBaseDir = dirname(agent.filePath), mirroring how pi-subagents
    // resolves an agent's skills for both foreground and background runs.
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
    if (originalOffline === undefined) {
      delete process.env.PI_OFFLINE;
    } else {
      process.env.PI_OFFLINE = originalOffline;
    }
  }
});
