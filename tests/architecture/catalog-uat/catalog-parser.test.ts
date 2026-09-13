import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadCatalogExamples } from "./catalog-parser.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CATALOG_PATH = path.join(REPO_ROOT, "docs/output-catalog.md");

test("loadCatalogExamples preserves exact section, state, and output bytes", () => {
  const catalog = [
    "# Output catalog",
    "",
    "## `/claude:plugin list`",
    "",
    "<!-- catalog-state: empty -->",
    "```text",
    "first line",
    "",
    "third line  ",
    "```",
    "",
    "<!-- catalog-state: one -->",
    "```text",
    "single line",
    "```",
  ].join("\n");

  assert.deepStrictEqual(loadCatalogExamples(catalog), [
    {
      section: "/claude:plugin list",
      state: "empty",
      expected: "first line\n\nthird line  ",
    },
    { section: "/claude:plugin list", state: "one", expected: "single line" },
  ]);
});

test("loadCatalogExamples maps the two non-command catalog sections exactly", () => {
  const catalog = [
    "## reconcile-applied-cascade",
    "<!-- catalog-state: applied -->",
    "```text",
    "applied bytes",
    "```",
    "## Manual recovery anchors",
    "<!-- catalog-state: recovery -->",
    "```text",
    "recovery bytes",
    "```",
  ].join("\n");

  assert.deepStrictEqual(loadCatalogExamples(catalog), [
    {
      section: "reconcile-applied-cascade",
      state: "applied",
      expected: "applied bytes",
    },
    {
      section: "manual-recovery-anchors",
      state: "recovery",
      expected: "recovery bytes",
    },
  ]);
});

test("loadCatalogExamples parses all 190 independent catalog tuples", async () => {
  const catalog = await readFile(CATALOG_PATH, "utf8");

  const examples = loadCatalogExamples(catalog);

  assert.equal(examples.length, 190);
  assert.equal(new Set(examples.map(({ section }) => section)).size, 20);
  assert.deepStrictEqual(examples[0], {
    section: "/claude:plugin list",
    state: "empty",
    expected: "(no marketplaces)\n\nPlugin list: 0 successes",
  });
  assert.deepStrictEqual(examples.at(-1), {
    section: "manual-recovery-anchors",
    state: "per-plugin-manual-recovery",
    expected:
      "A plugin operation needs attention.\n\n● official [user]\n  ⊘ helper v1.0.0 (manual recovery) {unreadable}\n    cause: bridge: agent staging conflict",
  });
});

test("loadCatalogExamples rejects a fenced output with no state marker", () => {
  const catalog = ["## `/claude:plugin list`", "```text", "output", "```"].join("\n");

  assert.throws(
    () => loadCatalogExamples(catalog),
    new Error(
      'Catalog parse error at line 2: missing catalog-state marker before fenced output in section "/claude:plugin list".',
    ),
  );
});

test("loadCatalogExamples ignores annotated examples outside recognized sections", () => {
  const catalog = [
    "## Conventions",
    "<!-- catalog-state: empty -->",
    "```text",
    "output",
    "```",
  ].join("\n");

  assert.deepStrictEqual(loadCatalogExamples(catalog), []);
});

test("loadCatalogExamples rejects duplicate section and state tuples", () => {
  const catalog = [
    "## `/claude:plugin list`",
    "<!-- catalog-state: empty -->",
    "```text",
    "first",
    "```",
    "<!-- catalog-state: empty -->",
    "```text",
    "second",
    "```",
  ].join("\n");

  assert.throws(
    () => loadCatalogExamples(catalog),
    new Error(
      'Catalog parse error at line 6: duplicate catalog tuple "/claude:plugin list::empty".',
    ),
  );
});

test("loadCatalogExamples rejects adjacent state markers", () => {
  const catalog = [
    "## `/claude:plugin list`",
    "<!-- catalog-state: empty -->",
    "<!-- catalog-state: one -->",
    "```text",
    "output",
    "```",
  ].join("\n");

  assert.throws(
    () => loadCatalogExamples(catalog),
    new Error(
      'Catalog parse error at line 3: adjacent catalog-state marker "one" follows pending marker "empty" from line 2.',
    ),
  );
});

test("loadCatalogExamples rejects an empty state marker", () => {
  const catalog = ["## `/claude:plugin list`", "<!-- catalog-state: -->"].join("\n");

  assert.throws(
    () => loadCatalogExamples(catalog),
    new Error("Catalog parse error at line 2: empty catalog-state marker."),
  );
});

test("loadCatalogExamples rejects a malformed state marker", () => {
  const catalog = ["## `/claude:plugin list`", "<!-- catalog-state: Bad_State -->"].join("\n");

  assert.throws(
    () => loadCatalogExamples(catalog),
    new Error(
      'Catalog parse error at line 2: malformed catalog-state marker "<!-- catalog-state: Bad_State -->".',
    ),
  );
});

test("loadCatalogExamples rejects an empty fenced output", () => {
  const catalog = [
    "## `/claude:plugin list`",
    "<!-- catalog-state: empty -->",
    "```text",
    "```",
  ].join("\n");

  assert.throws(
    () => loadCatalogExamples(catalog),
    new Error(
      'Catalog parse error at line 4: empty fenced output for tuple "/claude:plugin list::empty".',
    ),
  );
});

test("loadCatalogExamples rejects a marker that has no following fence", () => {
  const catalog = ["## `/claude:plugin list`", "<!-- catalog-state: empty -->"].join("\n");

  assert.throws(
    () => loadCatalogExamples(catalog),
    new Error(
      'Catalog parse error at end of input: marker "empty" from line 2 has no following fenced output.',
    ),
  );
});

test("loadCatalogExamples rejects an unclosed fenced output", () => {
  const catalog = [
    "## `/claude:plugin list`",
    "<!-- catalog-state: empty -->",
    "```text",
    "output",
  ].join("\n");

  assert.throws(
    () => loadCatalogExamples(catalog),
    new Error(
      'Catalog parse error at end of input: unclosed fenced output for tuple "/claude:plugin list::empty" opened at line 3.',
    ),
  );
});
