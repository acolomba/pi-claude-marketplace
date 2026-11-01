import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "./source-scan.ts";

// D-CF1-16: CI runs the behavioral tests as path shards, while a local
// `npm run test:cucumber` runs every feature file. A feature file outside
// every shard passes locally and never runs on a pull request, and one inside
// two shards runs twice.

const CI_WORKFLOW_REL = ".github/workflows/ci.yml";
const FEATURES_REL = "features";

interface Shard {
  readonly name: string;
  readonly paths: readonly string[];
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

// The lines of the `behavioral` job, up to the next job.
function behavioralJobLines(workflow: string): readonly string[] {
  const lines = workflow.split("\n");
  const start = lines.indexOf("  behavioral:");
  assert.notEqual(start, -1, `${CI_WORKFLOW_REL} has no behavioral job`);
  const end = lines.findIndex((line, index) => index > start && /^ {2}\S/.test(line));
  return lines.slice(start + 1, end === -1 ? lines.length : end);
}

// A matrix `paths` value: inline, or a folded block on the lines indented under it.
function pathsValue(lines: readonly string[], index: number): string {
  const line = lines[index] ?? "";
  const value = line.slice(line.indexOf("paths:") + "paths:".length).trim();
  if (!/^[>|]-?$/.test(value)) {
    return value;
  }

  const block: string[] = [];
  for (const next of lines.slice(index + 1)) {
    if (indentOf(next) <= indentOf(line)) {
      break;
    }

    block.push(next.trim());
  }

  return block.join(" ");
}

function behavioralShards(workflow: string): readonly Shard[] {
  const lines = behavioralJobLines(workflow);
  const shards: Shard[] = [];
  let name: string | undefined;
  lines.forEach((line, index) => {
    const shard = /^\s*- shard: (\S+)$/.exec(line);
    if (shard !== null) {
      name = shard[1];
    } else if (/^\s*paths:/.test(line) && name !== undefined) {
      shards.push({ name, paths: pathsValue(lines, index).split(/\s+/).filter(Boolean) });
    }
  });

  return shards;
}

async function featureFiles(): Promise<readonly string[]> {
  const entries = await readdir(path.join(REPO_ROOT, FEATURES_REL), {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".feature"))
    .map((entry) =>
      path.relative(REPO_ROOT, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
    )
    .sort();
}

function shardsHolding(file: string, shards: readonly Shard[]): readonly string[] {
  return shards
    .filter((shard) => shard.paths.some((dir) => file.startsWith(`${dir}/`)))
    .map((shard) => shard.name);
}

test("D-CF1-16: every feature file is in exactly one CI behavioral shard", async () => {
  // arrange
  const workflow = await readFile(path.join(REPO_ROOT, CI_WORKFLOW_REL), "utf8");
  const shards = behavioralShards(workflow);
  const files = await featureFiles();

  // act
  const misplaced = files
    .map((file) => ({ file, shards: shardsHolding(file, shards) }))
    .filter((entry) => entry.shards.length !== 1);

  // assert
  assert.ok(shards.length > 0, `${CI_WORKFLOW_REL} names no behavioral shard`);
  assert.ok(files.length > 0, `${FEATURES_REL}/ holds no feature file`);
  assert.deepStrictEqual(
    misplaced,
    [],
    `each feature file must be in exactly one shard of the behavioral matrix in ${CI_WORKFLOW_REL}`,
  );
});
