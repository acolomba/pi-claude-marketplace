/**
 * @fileoverview Steps about plugin updates, blocked skill targets, and the
 * repair each failed update names.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { writePublishedPluginFile } from "../../lib/published-marketplace.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the published plugin {string} of the marketplace {string} adds the skill {string} over a file in the {word} scope",
  async function (
    this: ScenarioWorld,
    plugin: string,
    marketplace: string,
    skill: string,
    scope: string,
  ) {
    const text = `---\nname: ${skill}\ndescription: The ${skill} skill.\n---\n\nThe ${skill} skill.\n`;
    const source = await writePublishedPluginFile(
      this.requirePublished(marketplace),
      plugin,
      path.join("skills", skill, "SKILL.md"),
      text,
    );
    const targetDirectory = path.join(
      this.scopeRoot(scope),
      "pi-claude-marketplace",
      "resources",
      "skills",
    );
    const target = path.join(targetDirectory, `${plugin}-${skill}`);
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(target, "User-owned skill notes.\n", { flag: "wx" });
    assert.strictEqual(await readFile(source, "utf8"), text);
    assert.strictEqual((await stat(target)).isFile(), true);
  },
);

// The plugin columns of a repair row, after its marketplace columns.
const REPAIR_PLUGIN_COLUMNS = [
  "id",
  "name",
  "status",
  "reasons",
  "scope",
  "from",
  "version",
  "repair",
  "cause truncated",
  "leaks",
  "rollback phases",
] as const;

// The rows of every cascade the command reported, in emission order. A block
// with no plugin rows still yields one row with empty plugin cells, so no
// block goes unseen.
Then("the failed update names these repairs:", function (this: ScenarioWorld, table: DataTable) {
  const marketplaces = this.resultsOf("command").flatMap((entry) =>
    entry.kind === "cascade" ? entry.marketplaces : [],
  );

  // D-SG-22: a block that names a marketplace re-clone adds its note and url,
  // so no clone goes unseen.
  const namesClone = marketplaces.some((marketplace) => marketplace.clone !== undefined);
  const repairs = marketplaces.flatMap((marketplace) => {
    const block = [
      marketplace.name,
      marketplace.scope,
      ...(namesClone ? [marketplace.clone?.note ?? "", marketplace.clone?.url ?? ""] : []),
    ];
    if (marketplace.plugins.length === 0) {
      return [[...block, ...REPAIR_PLUGIN_COLUMNS.map(() => "")]];
    }

    return marketplace.plugins.map((plugin) => [
      ...block,
      plugin.id,
      plugin.name,
      plugin.status,
      plugin.reasons.join(", "),
      plugin.scope ?? "",
      "from" in plugin ? (plugin.from ?? "") : "",
      "version" in plugin ? (plugin.version ?? "") : "",
      plugin.cause?.causeChain[0] ?? "",
      plugin.cause === undefined ? "" : String(plugin.cause.truncated),
      (plugin.leaks ?? []).join(", "),
      (plugin.rollbackPartial ?? []).map(({ phase }) => phase).join(", "),
    ]);
  });
  assert.deepStrictEqual(
    [
      [
        "marketplace name",
        "marketplace scope",
        ...(namesClone ? ["marketplace clone note", "marketplace clone url"] : []),
        ...REPAIR_PLUGIN_COLUMNS,
      ],
      ...repairs,
    ],
    table.raw(),
  );
  this.markRowsCompared();
});
