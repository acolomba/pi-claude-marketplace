/**
 * test/architecture/integration-suite-charter.test.ts -- the integration
 * suite keeps the shape its charter states (ITSCOPE-01..03).
 *
 * The charter is the `## Where a test goes` list. It must read the same in the
 * `typescript-unit-tests` skill, the `cucumber` skill, and
 * `.planning/codebase/TESTING.md`, where it is nested under
 * `**Integration Tests:**`. Each integration test file must open with a
 * comment that names its own path, cites ITSCOPE-01, and names one of the
 * charter's classes. Each support module in `test/integration/` must have an
 * importer, so a moved or deleted case leaves no orphan behind.
 */

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "./source-scan.ts";

const INTEGRATION_DIR = "test/integration";

const CLASS_PHRASES = [
  "peer conformance",
  "multi-process",
  "internal",
  "fault injection",
  "calls that must not happen",
  "known bug",
] as const;

async function readRepoFile(rel: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, rel), "utf8");
}

function leadingCommentBlock(src: string): string {
  const lines: string[] = [];

  for (const line of src.split("\n")) {
    if (!line.startsWith("//")) {
      break;
    }

    lines.push(line.replace(/^\/\/ ?/, ""));
  }

  return lines.join("\n");
}

function charterItems(markdown: string, startMarker: string, endMarker: string): string[] {
  const start = markdown.indexOf(startMarker);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  const end = markdown.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing ${endMarker} after ${startMarker}`);

  return markdown
    .slice(start + startMarker.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

void test("every integration test file opens with a header that names its path and class", async () => {
  const names = (await readdir(path.join(REPO_ROOT, INTEGRATION_DIR))).filter((name) =>
    name.endsWith(".test.ts"),
  );
  assert.ok(names.length > 0);

  const problems: string[] = [];

  for (const name of names) {
    const rel = `${INTEGRATION_DIR}/${name}`;
    const header = leadingCommentBlock(await readRepoFile(rel));
    const firstLine = header.split("\n")[0] ?? "";
    const lowered = header.replaceAll(/\s+/g, " ").toLowerCase();

    if (firstLine !== rel) {
      problems.push(`${rel}: first comment line is ${JSON.stringify(firstLine)}`);
    }

    if (!header.includes("(ITSCOPE-01)")) {
      problems.push(`${rel}: header does not cite (ITSCOPE-01)`);
    }

    if (!CLASS_PHRASES.some((phrase) => lowered.includes(phrase))) {
      problems.push(`${rel}: header names no charter class`);
    }
  }

  assert.deepEqual(problems, []);
});

void test("every integration support module has an importer", async () => {
  const names = await readdir(path.join(REPO_ROOT, INTEGRATION_DIR));
  const helpers = names.filter(
    (name) => !name.endsWith(".test.ts") && (name.endsWith(".ts") || name.endsWith(".json")),
  );
  const sources = await Promise.all(
    names
      .filter((name) => name.endsWith(".ts"))
      .map(async (name) => ({ name, src: await readRepoFile(`${INTEGRATION_DIR}/${name}`) })),
  );

  const orphans = helpers.filter(
    (helper) => !sources.some(({ name, src }) => name !== helper && src.includes(helper)),
  );

  assert.deepEqual(orphans, []);
});

void test("the charter reads the same in both skills and TESTING.md", async () => {
  const unit = charterItems(
    await readRepoFile(".agents/skills/typescript-unit-tests/SKILL.md"),
    "## Where a test goes",
    "\n## ",
  );
  const cucumber = charterItems(
    await readRepoFile(".agents/skills/cucumber/SKILL.md"),
    "## Where a test goes",
    "\n## ",
  );
  const [testingIntro, ...testing] = charterItems(
    await readRepoFile(".planning/codebase/TESTING.md"),
    "**Integration Tests:**",
    "\n**E2E Tests:**",
  );

  assert.ok(testingIntro?.startsWith("- `test/integration/`"));

  assert.equal(unit.length, 10);
  assert.deepEqual(cucumber, unit);
  assert.deepEqual(testing, unit);
});
