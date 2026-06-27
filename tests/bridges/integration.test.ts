// tests/bridges/integration.test.ts
//
// Multi-bridge happy-path end-to-end test.
//
// Exercises all four bridges (skills, commands, agents, MCP) in sequence
// against the full-plugin fixture: every supported artefact lands at its
// PRD-specified path with the correct generated name and
// ${CLAUDE_PLUGIN_ROOT} / ${CLAUDE_PLUGIN_DATA} substituted in bodies. Also
// exercises idempotency (re-stage produces the same on-disk state).
//
// Per D-01 each bridge's PreparedXxx handle is a distinct discriminated union;
// composition is exercised here only by calling each bridge's prepare/commit
// pair in turn, NOT by passing one bridge's prepared handle to another.
//
// REQ-IDs covered (assertion messages reference each ID for grep traceability):
//   SK-1, SK-2, SK-3, SK-4
//   CM-1, CM-2, CM-3
//   AG-1, AG-2, AG-3, AG-5
//   MC-5, MC-6
//   AS-8, AS-9 (cross-bridge symmetry; full noop end-to-end coverage in
//               integration-materialization-gate.test.ts)

import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  commitPreparedAgents,
  prepareStagePluginAgents,
} from "../../extensions/pi-claude-marketplace/bridges/agents/index.ts";
import {
  commitPreparedCommands,
  prepareStageCommands,
} from "../../extensions/pi-claude-marketplace/bridges/commands/index.ts";
import {
  commitPreparedMcp,
  prepareStageMcpServers,
  resolvePluginMcpServers,
} from "../../extensions/pi-claude-marketplace/bridges/mcp/index.ts";
import {
  commitPreparedSkills,
  prepareStageSkills,
} from "../../extensions/pi-claude-marketplace/bridges/skills/index.ts";
import { loadAgentsIndex } from "../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ResolvedPluginInstallable } from "../../extensions/pi-claude-marketplace/domain/resolver.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PLUGIN = path.resolve(HERE, "_fixtures", "test-plugin");
const PLUGIN_NAME = "acme";
const MARKETPLACE_NAME = "test-mp";

/**
 * Synthesize a ResolvedPluginInstallable for the integration tests.
 *
 * The resolver is not exercised here -- by D-01 each bridge accepts the
 * resolved record directly, and the integration tests construct it from the
 * fixture path so the test surface remains "bridges only". Skills and agents
 * bridges read absolute paths from `componentPaths.*`; the commands bridge
 * resolves `componentPaths.commands` against `pluginRoot`.
 */
function makeResolved(): ResolvedPluginInstallable {
  return {
    state: "installable",
    name: PLUGIN_NAME,
    pluginRoot: FIXTURE_PLUGIN,
    supported: ["skills", "commands", "agents"],
    unsupported: [],
    notes: [],
    // D-07: componentPaths.* are `readonly string[]`.
    componentPaths: {
      skills: [path.join(FIXTURE_PLUGIN, "skills")],
      commands: ["commands"],
      agents: ["agents"],
    },
    mcpServers: {},
  };
}

describe("integration: full-plugin staging", () => {
  let scopeRoot: string;
  let locations: ReturnType<typeof locationsFor>;
  let pluginDataDir: string;

  before(async () => {
    scopeRoot = await mkdtemp(path.join(tmpdir(), "integration-full-"));
    locations = locationsFor("project", scopeRoot);
    pluginDataDir = await locations.pluginDataDir(MARKETPLACE_NAME, PLUGIN_NAME);
  });

  after(async () => {
    await rm(scopeRoot, { recursive: true, force: true });
  });

  test("SK-1/SK-2/SK-3/SK-4: skills bridge stages every SKILL.md with frontmatter rewrite + var substitution", async () => {
    const resolved = makeResolved();
    const prep = await prepareStageSkills({
      locations,
      marketplaceName: MARKETPLACE_NAME,
      pluginName: PLUGIN_NAME,
      pluginRoot: FIXTURE_PLUGIN,
      pluginDataDir,
      resolved,
    });
    assert.equal(prep.kind, "staged", "SK-5: skills discovered -> staged variant");
    await commitPreparedSkills(prep);

    // SK-2: helper -> "acme-helper"; acme-knowledge starts with "acme-"
    // so the source prefix is elided to "acme-knowledge".
    const recordedNames = [...prep.result.recorded.map((r) => r.generatedName)].sort();
    assert.deepEqual(recordedNames, ["acme-helper", "acme-knowledge"], "SK-2: name elision rule");

    // SK-1: per-skill target dir created with full source-tree contents.
    const lookupPath = path.join(
      locations.skillsTargetDir,
      "acme-knowledge",
      "resources",
      "lookup.json",
    );
    assert.equal((await stat(lookupPath)).isFile(), true, "SK-1: ancillary file copied");

    // SK-3: SKILL.md frontmatter `name:` rewritten to generated name.
    const skillMd = await readFile(
      path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"),
      "utf8",
    );
    assert.match(skillMd, /^name: acme-knowledge$/m, "SK-3: name field rewritten in frontmatter");

    // SK-4: ${CLAUDE_PLUGIN_ROOT} substituted in body; placeholder absent post-substitution.
    assert.ok(
      !skillMd.includes("${CLAUDE_PLUGIN_ROOT}"),
      "SK-4: ${CLAUDE_PLUGIN_ROOT} placeholder substituted",
    );
    assert.ok(skillMd.includes(FIXTURE_PLUGIN), "SK-4: pluginRoot substituted with absolute path");
    assert.ok(
      !skillMd.includes("${CLAUDE_PLUGIN_DATA}"),
      "SK-4: ${CLAUDE_PLUGIN_DATA} placeholder substituted",
    );
    assert.ok(skillMd.includes(pluginDataDir), "SK-4: pluginData substituted");
  });

  test("CM-1/CM-2/CM-3: commands bridge stages every <plugin>:<command>.md with var substitution", async () => {
    const resolved = makeResolved();
    const prep = await prepareStageCommands({
      locations,
      marketplaceName: MARKETPLACE_NAME,
      pluginName: PLUGIN_NAME,
      pluginRoot: FIXTURE_PLUGIN,
      pluginDataDir,
      resolved,
    });
    assert.equal(prep.kind, "staged", "CM-4: commands discovered -> staged variant");
    await commitPreparedCommands(prep);

    // CM-1 + CM-2: both commands land at <ext>/resources/prompts/<plugin>:<cmd>.md
    // (acme-deploy elides because the source name already starts with the
    // plugin prefix; status takes the unelided <plugin>:<source> form).
    const recordedNames = [...prep.result.recorded.map((r) => r.generatedName)].sort();
    assert.deepEqual(recordedNames, ["acme:deploy", "acme:status"], "CM-2: name elision rule");

    const deployFile = path.join(locations.promptsTargetDir, "acme:deploy.md");
    assert.equal((await stat(deployFile)).isFile(), true, "CM-1: command file present at target");

    // CM-3: ${CLAUDE_PLUGIN_ROOT} substituted in body.
    const deployBody = await readFile(deployFile, "utf8");
    assert.ok(!deployBody.includes("${CLAUDE_PLUGIN_ROOT}"), "CM-3: var substituted in body");
    assert.ok(deployBody.includes(FIXTURE_PLUGIN), "CM-3: pluginRoot substituted");

    const statusBody = await readFile(
      path.join(locations.promptsTargetDir, "acme:status.md"),
      "utf8",
    );
    assert.ok(!statusBody.includes("${CLAUDE_PLUGIN_DATA}"), "CM-3: pluginData substituted");
    assert.ok(
      statusBody.includes(pluginDataDir),
      "CM-3: pluginData substituted with absolute path",
    );
  });

  test("AG-1/AG-2/AG-3/AG-5: agents bridge stages with marker discipline, partitions index by (mp, plugin)", async () => {
    const resolved = makeResolved();
    const prep = await prepareStagePluginAgents({
      locations,
      marketplaceName: MARKETPLACE_NAME,
      pluginName: PLUGIN_NAME,
      pluginRoot: FIXTURE_PLUGIN,
      pluginDataDir,
      resolved,
      agentsSourceDir: path.join(FIXTURE_PLUGIN, "agents"),
      knownSkills: ["acme-helper", "acme-knowledge"],
    });
    assert.equal(prep.kind, "staged", "agents discovered -> staged variant");
    await commitPreparedAgents(prep);

    // AG-1: every staged file basename starts with pi-claude-marketplace-.
    const agentsDirContents = await readdir(locations.agentsDir);
    assert.ok(agentsDirContents.length > 0, "AG-1: at least one agent file landed");
    for (const name of agentsDirContents) {
      assert.match(
        name,
        /^pi-claude-marketplace-/,
        `AG-1: agent file basename "${name}" starts with pi-claude-marketplace-`,
      );
    }

    // AG-5 marker discipline: every staged body contains the verbatim
    // HTML-comment marker emitted by frontmatter.ts.
    for (const name of agentsDirContents) {
      const body = await readFile(path.join(locations.agentsDir, name), "utf8");
      assert.ok(
        body.includes("generated by pi-claude-marketplace"),
        `AG-5: agent file "${name}" body contains generated marker`,
      );
    }

    // AG-2: agents-index.json schemaVersion locked at 1; AG-3: rows
    // partitioned by (marketplace, plugin) ownership.
    const idx = await loadAgentsIndex(locations);
    assert.equal(idx.schemaVersion, 1, "AG-2: agents-index schemaVersion 1");
    const ourEntries = idx.agents.filter(
      (e) => e.marketplace === MARKETPLACE_NAME && e.plugin === PLUGIN_NAME,
    );
    assert.equal(ourEntries.length, 2, "AG-3: two rows for (test-mp, acme)");

    // recorded[] names match index entries we just owned.
    const recordedNames = [...prep.result.recorded.map((r) => r.generatedName)].sort();
    const indexNames = ourEntries.map((e) => e.generatedName).sort();
    assert.deepEqual(
      recordedNames,
      indexNames,
      "AG-2: recorded[] matches index for our (mp,plugin)",
    );

    // AG-1 elision: bot -> pi-claude-marketplace-acme-bot (prefix added);
    // acme-helper -> pi-claude-marketplace-acme-helper (no double-prefix).
    assert.deepEqual(
      recordedNames,
      ["pi-claude-marketplace-acme-bot", "pi-claude-marketplace-acme-helper"],
      "AG-1: prefix added with no double-prefix",
    );
  });

  test("MC-5/MC-6: mcp bridge merges declared servers into mcp.json with _piClaudeMarketplace marker", async () => {
    const resolved = await resolvePluginMcpServers({
      entry: {},
      manifest: {},
      pluginRoot: FIXTURE_PLUGIN,
    });
    // The fixture .mcp.json declares one server; resolver returns wrapped form.
    assert.equal(resolved.source, "standalone", "MC-1: standalone .mcp.json source");
    assert.ok(Object.keys(resolved.servers).length > 0, "MC-1: at least one server resolved");

    const prep = await prepareStageMcpServers({
      locations,
      cwd: scopeRoot,
      marketplaceName: MARKETPLACE_NAME,
      pluginName: PLUGIN_NAME,
      servers: resolved.servers,
    });
    assert.equal(prep.kind, "staged", "MC-6: servers present -> staged variant");
    const result = await commitPreparedMcp(prep);

    // MC-5: each entry carries _piClaudeMarketplace marker.
    const mcpJson = JSON.parse(await readFile(locations.mcpJsonPath, "utf8")) as {
      mcpServers: Record<
        string,
        { _piClaudeMarketplace?: { plugin: string; marketplace: string } }
      >;
    };
    for (const [name, entry] of Object.entries(mcpJson.mcpServers)) {
      assert.deepEqual(
        entry._piClaudeMarketplace,
        { plugin: PLUGIN_NAME, marketplace: MARKETPLACE_NAME },
        `MC-5: server "${name}" carries _piClaudeMarketplace marker`,
      );
    }

    assert.ok(result.recorded.length > 0, "MC-6: at least one server recorded");
    assert.equal(
      result.recorded[0]!.targetPath,
      locations.mcpJsonPath,
      "MC-6: recorded targetPath is scoped mcp.json",
    );
  });

  test("idempotency: second prepare->commit cycle on same plugin produces same on-disk state", async () => {
    const resolved = makeResolved();
    // Re-stage skills -- pass previous names so commit removes-and-renames cleanly.
    const prep2 = await prepareStageSkills({
      locations,
      marketplaceName: MARKETPLACE_NAME,
      pluginName: PLUGIN_NAME,
      pluginRoot: FIXTURE_PLUGIN,
      pluginDataDir,
      resolved,
      previousSkillNames: ["acme-helper", "acme-knowledge"],
    });
    assert.equal(prep2.kind, "staged", "idempotency: re-stage produces staged variant");
    await commitPreparedSkills(prep2);

    // Files still there, identical names; no exceptions thrown.
    const files = await readdir(locations.skillsTargetDir);
    assert.deepEqual(files.sort(), ["acme-helper", "acme-knowledge"], "idempotency: same names");

    // SKILL.md still has substituted body (re-stage path produces same content).
    const skillMd = await readFile(
      path.join(locations.skillsTargetDir, "acme-knowledge", "SKILL.md"),
      "utf8",
    );
    assert.ok(
      !skillMd.includes("${CLAUDE_PLUGIN_ROOT}"),
      "idempotency: re-stage produces substituted body",
    );
  });
});
