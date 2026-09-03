#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, "../../../../../..");
const REQUIRED = [
  "BASELINE.yaml",
  "TRANSFORMATIONS.yaml",
  "BEHAVIOR-CONTRACTS.yaml",
  "PUBLIC-SURFACE.yaml",
  "PERSISTENCE-CONTRACTS.yaml",
  "ORACLE-SCENARIOS.md",
  "ADAPTER-CONTRACTS.yaml",
  "DECISIONS.md",
  "REPLAY-PLAN.yaml",
  "COMPLETENESS-REPORT.md",
  "README.md",
  "DIRTY-CHECKPOINT.patch",
  "inputs/typescript-unit-testing-guidelines.md",
  "inputs/typescript-unit-testing-rule.md",
  "inputs/legacy-unit-tests-rule.md",
];
const ALLOWED_DISPOSITIONS = new Set(["replay", "reconsider", "drop"]);
const errors = [];
const facts = {};

function fail(message) {
  errors.push(message);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed: ${result.stderr.trim()}`);
    return "";
  }
  return result.stdout;
}

function git(...args) {
  return run("git", args);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function read(path) {
  const target = join(DIR, path);
  if (!existsSync(target)) {
    fail(`missing required artifact: ${path}`);
    return "";
  }
  return readFileSync(target, "utf8");
}

function data(path) {
  const text = read(path);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${path} is not JSON-compatible YAML: ${error.message}`);
    return {};
  }
}

function operationSignature(operation) {
  if (operation.path) return `${operation.status}\0${operation.path}`;
  return `${operation.status}\0${operation.similarity}\0${operation.old_path}\0${operation.new_path}`;
}

function parseNameStatus(text) {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const fields = line.split("\t");
      const status = fields[0];
      if (status.startsWith("R") || status.startsWith("C")) {
        return {
          status: status[0] === "R" ? "renamed" : "copied",
          similarity: Number(status.slice(1)),
          old_path: fields[1],
          new_path: fields[2],
        };
      }
      const names = { A: "added", D: "deleted", M: "modified", T: "type-changed" };
      return { status: names[status] ?? status, path: fields[1] };
    });
}

function sameSet(label, actual, expected) {
  const a = new Set(actual);
  const e = new Set(expected);
  const missing = [...e].filter((value) => !a.has(value));
  const extra = [...a].filter((value) => !e.has(value));
  if (missing.length || extra.length) {
    fail(`${label} differs: ${missing.length} missing, ${extra.length} extra`);
  }
}

function checkUnique(label, values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`${label} contains duplicate ${value}`);
    seen.add(value);
  }
}

function checkDisposition(label, records) {
  for (const [index, record] of records.entries()) {
    if (!ALLOWED_DISPOSITIONS.has(record.disposition)) {
      fail(`${label}[${index}] has invalid disposition ${String(record.disposition)}`);
    }
  }
}

function revisionHasPath(revision, path) {
  const result = spawnSync("git", ["cat-file", "-e", `${revision}:${path}`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return result.status === 0;
}

function checkEvidencePaths(records, oracleHead) {
  for (const record of records) {
    for (const raw of record.evidence ?? record.current_evidence ?? []) {
      const path = raw.split("#")[0];
      if (!path.includes("/")) continue;
      const local = join(ROOT, path);
      const preserved = join(DIR, path);
      if (!existsSync(local) && !existsSync(preserved) && !revisionHasPath(oracleHead, path)) {
        fail(`${record.id ?? "record"} references missing evidence path ${path}`);
      }
    }
  }
}

function checkBaseline() {
  const baseline = data("BASELINE.yaml");
  facts.baseline = baseline;
  const revisions = baseline.revisions ?? {};
  for (const [name, record] of Object.entries(revisions)) {
    if (!record.commit || git("rev-parse", record.commit).trim() !== record.commit) {
      fail(`BASELINE.yaml revision ${name} is not available`);
    }
  }
  const head = git("rev-parse", "HEAD").trim();
  if (head !== revisions.oracle_head?.commit) {
    fail(`oracle HEAD changed: expected ${revisions.oracle_head?.commit}, found ${head}`);
  }
  for (const input of baseline.inputs ?? []) {
    const text = read(input.preserved_copy);
    if (hash(text) !== input.sha256) fail(`input hash mismatch: ${input.preserved_copy}`);
    if (Buffer.byteLength(text) !== input.bytes)
      fail(`input size mismatch: ${input.preserved_copy}`);
  }
  const patch = read(baseline.dirty_checkpoint?.patch ?? "DIRTY-CHECKPOINT.patch");
  if (hash(patch) !== baseline.dirty_checkpoint?.patch_sha256)
    fail("dirty checkpoint hash mismatch");
  facts.input_count = baseline.inputs?.length ?? 0;
}

function checkTransformations() {
  const baseline = facts.baseline ?? data("BASELINE.yaml");
  const value = data("TRANSFORMATIONS.yaml");
  const [contentBase, oracleHead] = String(value.source_range ?? "").split("..");
  if (contentBase !== baseline.revisions?.oracle_content_base?.commit)
    fail("transformation content base differs from baseline");
  if (oracleHead !== baseline.revisions?.oracle_head?.commit)
    fail("transformation oracle head differs from baseline");

  const productionExpected = parseNameStatus(
    git(
      "diff",
      "--name-status",
      "--find-renames=30%",
      value.source_range,
      "--",
      "extensions/pi-claude-marketplace",
    ),
  ).map(operationSignature);
  const testsExpected = parseNameStatus(
    git("diff", "--name-status", "--find-renames=30%", value.source_range, "--", "tests"),
  ).map(operationSignature);
  sameSet(
    "production path manifest",
    (value.production_path_operations ?? []).map(operationSignature),
    productionExpected,
  );
  sameSet(
    "test path manifest",
    (value.test_path_operations ?? []).map(operationSignature),
    testsExpected,
  );
  checkDisposition("production_path_operations", value.production_path_operations ?? []);
  checkDisposition("test_path_operations", value.test_path_operations ?? []);
  checkDisposition("production_symbol_moves", value.production_symbol_moves ?? []);
  checkDisposition("test_symbol_moves", value.test_symbol_moves ?? []);
  checkDisposition("intent_commits", value.intent_commits ?? []);
  checkUnique(
    "intent commits",
    (value.intent_commits ?? []).map((record) => record.commit),
  );

  for (const move of [
    ...(value.production_symbol_moves ?? []),
    ...(value.test_symbol_moves ?? []),
  ]) {
    const fromPath = move.from.replace(/:\d+$/, "");
    const toPath = move.to.replace(/:\d+$/, "");
    if (!revisionHasPath(contentBase, fromPath)) fail(`symbol move source is absent: ${move.from}`);
    if (!revisionHasPath(oracleHead, toPath)) fail(`symbol move target is absent: ${move.to}`);
  }
  facts.transformations = value.coverage;
}

function checkContracts() {
  const baseline = facts.baseline ?? data("BASELINE.yaml");
  const oracleHead = baseline.revisions?.oracle_head?.commit;
  const behavior = data("BEHAVIOR-CONTRACTS.yaml");
  const surface = data("PUBLIC-SURFACE.yaml");
  const persistence = data("PERSISTENCE-CONTRACTS.yaml");
  const adapters = data("ADAPTER-CONTRACTS.yaml");

  checkUnique(
    "behavior contract IDs",
    (behavior.contracts ?? []).map((record) => record.id),
  );
  checkUnique(
    "public surface IDs",
    (surface.surfaces ?? []).map((record) => record.id),
  );
  checkUnique(
    "persistence artifact IDs",
    (persistence.artifacts ?? []).map((record) => record.id),
  );
  checkUnique(
    "adapter contract IDs",
    (adapters.contracts ?? []).map((record) => record.id),
  );
  checkDisposition("behavior contracts", behavior.contracts ?? []);
  checkDisposition("public surfaces", surface.surfaces ?? []);
  checkDisposition("persistence artifacts", persistence.artifacts ?? []);
  checkDisposition("adapter contracts", adapters.contracts ?? []);
  checkEvidencePaths(behavior.contracts ?? [], oracleHead);
  checkEvidencePaths(surface.surfaces ?? [], oracleHead);
  checkEvidencePaths(persistence.artifacts ?? [], oracleHead);
  checkEvidencePaths(adapters.contracts ?? [], oracleHead);
  facts.contracts = {
    behavior: behavior.contracts?.length ?? 0,
    public_surfaces: surface.surfaces?.length ?? 0,
    persistence: persistence.artifacts?.length ?? 0,
    adapters: adapters.contracts?.length ?? 0,
  };
}

function checkOracles() {
  const text = read("ORACLE-SCENARIOS.md");
  const ids = [...text.matchAll(/^### (OR-\d+):/gm)].map((match) => match[1]);
  checkUnique("oracle IDs", ids);
  if (ids.length < 20) fail(`expected at least 20 oracle scenarios, found ${ids.length}`);
  facts.oracle_count = ids.length;
}

function checkReplay() {
  const value = data("REPLAY-PLAN.yaml");
  const steps = value.steps ?? [];
  const ids = steps.map((step) => step.id);
  const idSet = new Set(ids);
  checkUnique("replay step IDs", ids);
  checkDisposition("replay steps", steps);
  for (const step of steps) {
    for (const dependency of step.depends_on ?? []) {
      if (!idSet.has(dependency)) fail(`${step.id} depends on unknown replay step ${dependency}`);
    }
    for (const input of step.inputs ?? []) {
      if (!existsSync(join(DIR, input))) fail(`${step.id} references missing input ${input}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(steps.map((step) => [step.id, step]));
  function visit(id) {
    if (visiting.has(id)) {
      fail(`replay graph contains a cycle at ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.depends_on ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
  facts.replay_steps = steps.length;
}

function checkGenerated() {
  const result = spawnSync("node", [join(DIR, "generate-preservation-kit.mjs"), "--check"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) fail(`generated artifacts are stale: ${result.stderr.trim()}`);
}

function main() {
  for (const path of REQUIRED) {
    if (!existsSync(join(DIR, path))) fail(`missing required artifact: ${path}`);
    else if (statSync(join(DIR, path)).size === 0) fail(`empty required artifact: ${path}`);
  }

  checkBaseline();
  checkTransformations();
  const contractsOnly = process.argv.includes("--contracts");
  const oraclesOnly = process.argv.includes("--oracles");
  const replayOnly = process.argv.includes("--replay");
  if (!oraclesOnly && !replayOnly) checkContracts();
  if (!contractsOnly && !replayOnly) checkOracles();
  if (!contractsOnly && !oraclesOnly) checkReplay();
  checkGenerated();

  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`ERROR: ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify({ status: "passed", ...facts }, null, 2)}\n`);
}

main();
