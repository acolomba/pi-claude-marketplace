import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function readJsonObject(relativePath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readProjectFile(relativePath));

  assert.ok(typeof parsed === "object" && parsed !== null && !Array.isArray(parsed));
  return parsed as Record<string, unknown>;
}

test("maps the discuss workflow to the canonical compatibility skill", () => {
  // arrange
  const config = readJsonObject(".planning/config.json");
  const agentSkills = config["agent_skills"];
  assert.ok(typeof agentSkills === "object" && agentSkills !== null && !Array.isArray(agentSkills));

  // act
  const skillsByConsumer = agentSkills as Record<string, unknown>;

  // assert
  assert.deepStrictEqual(skillsByConsumer["gsd-discuss-phase"], [
    "skills/claude-code-compat-research",
  ]);
  assert.deepStrictEqual(skillsByConsumer["gsd-advisor-researcher"], [
    "skills/claude-code-compat-research",
  ]);
});

test("registers a thin discuss pre-hook for the orchestrator", () => {
  // arrange
  const capability = readJsonObject("gsd-capabilities/discuss-agent-skills/capability.json");

  // act
  const ownedSkills = capability["skills"];
  const contributions = capability["contributions"];

  // assert
  assert.deepStrictEqual(ownedSkills, []);
  assert.deepStrictEqual(contributions, [
    {
      point: "discuss:pre",
      into: "orchestrator",
      fragment: { path: "fragments/load-discuss-agent-skills.md" },
      produces: [],
      consumes: [],
      onError: "halt",
    },
  ]);
});

test("loads mapped skills before analysis and applies them through context writing", () => {
  // arrange
  const fragment = readProjectFile(
    "gsd-capabilities/discuss-agent-skills/fragments/load-discuss-agent-skills.md",
  );
  const orderedMarkers = [
    "1. Run `gsd_run query agent-skills gsd-discuss-phase`",
    "2. Read every `@<path>/SKILL.md`",
    "3. Apply the loaded skills",
    "Their research must inform question generation",
    "final `CONTEXT.md`",
  ];
  const workflowStages = [
    "`analyze_phase`",
    "`present_gray_areas`",
    "`discuss_areas`",
    "`write_context`",
  ];

  // act
  const markerPositions = orderedMarkers.map((marker) => fragment.indexOf(marker));

  // assert
  assert.deepStrictEqual(
    markerPositions.map((position) => position >= 0),
    [true, true, true, true, true],
  );
  assert.deepStrictEqual(
    markerPositions,
    [...markerPositions].sort((left, right) => left - right),
  );
  assert.deepStrictEqual(
    workflowStages.map((stage) => fragment.includes(stage)),
    [true, true, true, true],
  );
});

test("installs the project capability after GSD setup", () => {
  // arrange
  const setup = readProjectFile("scripts/init.sh");
  const forceStatuslineFlag = ["--", "force", "-statusline"].join("");
  const gsdInstaller = `npx --yes @opengsd/gsd-core@latest --install --local --claude --codex ${forceStatuslineFlag}`;
  const capabilityInstaller = `node .codex/gsd-core/bin/gsd-tools.cjs capability install \\
    ./gsd-capabilities/discuss-agent-skills \\
    --scope project \\
    --yes`;

  // act
  const gsdInstallerPosition = setup.indexOf(gsdInstaller);
  const capabilityInstallerPosition = setup.indexOf(capabilityInstaller);

  // assert
  assert.deepStrictEqual(
    [gsdInstallerPosition >= 0, capabilityInstallerPosition >= 0],
    [true, true],
  );
  assert.strictEqual(gsdInstallerPosition < capabilityInstallerPosition, true);
});

test("links upstream reference documentation for every bridged component kind", () => {
  // arrange
  const skill = readProjectFile("skills/claude-code-compat-research/SKILL.md");
  const bridgedKinds = readdirSync(
    path.join(projectRoot, "extensions/pi-claude-marketplace/bridges"),
    { withFileTypes: true },
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  // act
  const linkedKinds = bridgedKinds.filter((kind) =>
    skill.includes(`https://code.claude.com/docs/en/${kind}`),
  );

  // assert
  assert.deepStrictEqual(linkedKinds, bridgedKinds);
});
