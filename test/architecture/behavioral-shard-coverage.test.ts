import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "./source-scan.ts";

// D-CF1-16, DUAL-03: CI runs the behavioral tests as path shards of each
// cucumber profile, while a local `npm run test:cucumber` runs every feature
// file under every profile. A feature file outside every shard of a profile
// passes locally and never runs under that profile on a pull request, and one
// inside two shards of a profile runs twice. A profile with no shard never
// runs in CI at all.

const CI_WORKFLOW_REL = ".github/workflows/ci.yml";
const CUCUMBER_CONFIG_REL = "cucumber.json";
const FEATURES_REL = "features";

// cucumber's own name for the profile a run without `--profile` uses, which
// repeats the adapter profile and gets no CI job of its own.
const DEFAULT_PROFILE = "default";

interface Shard {
  readonly profile: string;
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

// Each matrix item starts with its `- profile:` key and names its `shard:` and
// `paths:` below it.
function behavioralShards(workflow: string): readonly Shard[] {
  const lines = behavioralJobLines(workflow);
  const shards: Shard[] = [];
  let profile: string | undefined;
  let name: string | undefined;
  lines.forEach((line, index) => {
    const item = /^\s*- profile: (\S+)$/.exec(line);
    const shard = /^\s*shard: (\S+)$/.exec(line);
    if (item !== null) {
      profile = item[1];
      name = undefined;
    } else if (shard !== null) {
      name = shard[1];
    } else if (/^\s*paths:/.test(line) && profile !== undefined && name !== undefined) {
      shards.push({
        profile,
        name,
        paths: pathsValue(lines, index).split(/\s+/).filter(Boolean),
      });
    }
  });

  return shards;
}

async function cucumberProfiles(): Promise<readonly string[]> {
  const config: unknown = JSON.parse(
    await readFile(path.join(REPO_ROOT, CUCUMBER_CONFIG_REL), "utf8"),
  );
  assert.ok(
    typeof config === "object" && config !== null,
    `${CUCUMBER_CONFIG_REL} is not an object`,
  );
  return Object.keys(config)
    .filter((profile) => profile !== DEFAULT_PROFILE)
    .sort();
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

function shardsHolding(file: string, profile: string, shards: readonly Shard[]): readonly string[] {
  return shards
    .filter(
      (shard) => shard.profile === profile && shard.paths.some((dir) => file.startsWith(`${dir}/`)),
    )
    .map((shard) => shard.name);
}

test("D-CF1-16, DUAL-03: every feature file is in exactly one CI behavioral shard of each profile", async () => {
  // arrange
  const workflow = await readFile(path.join(REPO_ROOT, CI_WORKFLOW_REL), "utf8");
  const shards = behavioralShards(workflow);
  const profiles = await cucumberProfiles();
  const files = await featureFiles();

  // act
  const shardedProfiles = [...new Set(shards.map((shard) => shard.profile))].sort();
  const misplaced = profiles.flatMap((profile) =>
    files
      .map((file) => ({ profile, file, shards: shardsHolding(file, profile, shards) }))
      .filter((entry) => entry.shards.length !== 1),
  );

  // assert
  assert.ok(profiles.length > 0, `${CUCUMBER_CONFIG_REL} names no profile besides default`);
  assert.ok(files.length > 0, `${FEATURES_REL}/ holds no feature file`);
  assert.deepStrictEqual(
    shardedProfiles,
    profiles,
    `the behavioral matrix in ${CI_WORKFLOW_REL} must have shards for exactly the profiles of ${CUCUMBER_CONFIG_REL}`,
  );
  assert.deepStrictEqual(
    misplaced,
    [],
    `each feature file must be in exactly one shard of each profile in the behavioral matrix of ${CI_WORKFLOW_REL}`,
  );
});
