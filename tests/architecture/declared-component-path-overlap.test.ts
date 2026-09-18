/**
 * MANF-03 overlap gate: a declared component path and the additive
 * implicit-by-convention path can name the same directory on disk.
 *
 * The hazard: reading a plugin's bare `plugin.json` makes its declared
 * `skills` paths visible for the first time, and those paths sit under the
 * conventional `skills/` directory the resolver appends unconditionally. The
 * same skill directory is then enumerated twice, the generated names collide,
 * and the bridge warns -- so the manifest-read fix becomes a net output
 * regression on exactly the plugins it rescues. D-01-14 canonicalizes the
 * stored path, which collapses the two spellings only when they name the same
 * directory; D-01-21 closes the remaining case in the skills bridge, where the
 * two resolved directories can finally be compared.
 *
 * A resolver-only assertion on `componentPaths` would miss half of that, so
 * this gate plants a real tree and drives the real resolver into the real
 * bridge. It asserts BOTH halves of the fix: no spurious warning, and no lost
 * skill -- suppressing the convention path instead would silence the warning
 * by dropping undeclared sibling skill directories, which the third case
 * refuses.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { discoverPluginCommands } from "../../extensions/pi-claude-marketplace/bridges/commands/discover.ts";
import { discoverPluginSkills } from "../../extensions/pi-claude-marketplace/bridges/skills/discover.ts";
import {
  requireInstallable,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/plugin-resolver.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

test("overlapping declared and conventional command roots install each source once", async (t) => {
  // arrange
  const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "command-path-overlap-"));
  t.after(() => rm(marketplaceRoot, { recursive: true, force: true }));
  const pluginRoot = path.join(marketplaceRoot, "acme");
  await mkdir(path.join(pluginRoot, "commands", "git"), { recursive: true });
  await writeFile(path.join(pluginRoot, "plugin.json"), '{"commands":["./commands/git"]}');
  await writeFile(path.join(pluginRoot, "commands", "git", "commit.md"), "commit\n");
  await writeFile(path.join(pluginRoot, "commands", "top.md"), "top\n");

  // act
  const resolved = await resolveStrict({ name: "acme", source: "./acme" }, { marketplaceRoot });
  requireInstallable(resolved);
  const discovery = await discoverPluginCommands({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      {
        sourceName: "commit",
        generatedName: "acme:commit",
        commandFile: path.join(pluginRoot, "commands", "git", "commit.md"),
      },
      {
        sourceName: "top",
        generatedName: "acme:top",
        commandFile: path.join(pluginRoot, "commands", "top.md"),
      },
    ],
    warnings: [],
  });
});

/**
 * Plants a marketplace root holding one plugin whose manifest lives at the BARE
 * `<pluginRoot>/plugin.json` -- the location that makes these plugins
 * interesting -- plus one skill directory per name in `skillNames`, each under
 * the conventional `skills/` parent.
 */
async function plantPlugin(
  t: TestContext,
  pluginName: string,
  declaredSkills: readonly string[],
  skillNames: readonly string[],
): Promise<string> {
  const marketplaceRoot = await mkdtemp(path.join(tmpdir(), "declared-path-overlap-"));
  t.after(() => rm(marketplaceRoot, { recursive: true, force: true, maxRetries: 3 }));
  const pluginRoot = path.join(marketplaceRoot, pluginName);
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    path.join(pluginRoot, "plugin.json"),
    `${JSON.stringify({ name: pluginName, skills: declaredSkills })}\n`,
  );

  for (const skillName of skillNames) {
    const skillDirectory = path.join(pluginRoot, "skills", skillName);
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      `---\nname: ${skillName}\ndescription: The ${skillName} skill.\n---\n\nThe ${skillName} body.\n`,
    );
  }

  return marketplaceRoot;
}

/** Resolves the planted plugin against real disk and discovers its skills. */
async function discoverPlanted(
  marketplaceRoot: string,
  pluginName: string,
): Promise<{ generatedNames: string[]; warnings: readonly string[] }> {
  const entry: PluginEntry = { name: pluginName, source: `./${pluginName}` };
  const resolved = await resolveStrict(entry, { marketplaceRoot });
  requireInstallable(resolved);
  const discovery = await discoverPluginSkills({ pluginName, resolved });
  return {
    generatedNames: discovery.discovered.map((skill) => skill.generatedName),
    warnings: discovery.warnings,
  };
}

test("MANF-03 a declared skills parent over eight skill dirs warns not at all", async (t) => {
  // arrange
  const skillNames = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"];
  const marketplaceRoot = await plantPlugin(t, "ui5", ["./skills/"], skillNames);

  // act
  const discovery = await discoverPlanted(marketplaceRoot, "ui5");

  // assert
  assert.deepStrictEqual(discovery, {
    generatedNames: skillNames.map((skillName) => `ui5:${skillName}`),
    warnings: [],
  });
});

test("MANF-03 declared skill subdirs under a shipped skills parent warn not at all", async (t) => {
  // arrange
  const skillNames = ["ui-theme-designer-design-tokens", "ui-theme-designer-help"];
  const marketplaceRoot = await plantPlugin(
    t,
    "ui-theme-designer",
    ["./skills/ui-theme-designer-help", "./skills/ui-theme-designer-design-tokens"],
    skillNames,
  );

  // act
  const discovery = await discoverPlanted(marketplaceRoot, "ui-theme-designer");

  // assert
  assert.deepStrictEqual(discovery, {
    generatedNames: ["ui-theme-designer:help", "ui-theme-designer:design-tokens"],
    warnings: [],
  });
});

test("MANF-03 an undeclared sibling skill survives the overlap fix", async (t) => {
  // arrange
  const marketplaceRoot = await plantPlugin(
    t,
    "acme",
    ["./skills/declared"],
    ["declared", "undeclared"],
  );

  // act
  const discovery = await discoverPlanted(marketplaceRoot, "acme");

  // assert
  assert.deepStrictEqual(discovery, {
    generatedNames: ["acme:declared", "acme:undeclared"],
    warnings: [],
  });
});
