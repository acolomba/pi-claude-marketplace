#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "../../../../../..");
const BRANCH_BASE = "8bea2705cb1d57ad865027985fbff2b3abcb3568";
const ORACLE_HEAD = "acdfc07bd01bfb67144f003b3f2f0be9bba5f5d1";
const MAIN_AT_EXPORT = "06887215c8168ce9c6fe37914cfabd253396c048";
const MERGE_BASE_AT_EXPORT = "fb4216dfe93959c0f6e2bd70653d7ff13557aa24";
const ORACLE_CONTENT_BASE = MERGE_BASE_AT_EXPORT;
const PRODUCTION_ROOT = "extensions/pi-claude-marketplace";
const TEST_ROOT = "tests";
const DIRTY_CHECKPOINT_PATHS = [
  "extensions/pi-claude-marketplace/domain/version.ts",
  "extensions/pi-claude-marketplace/edge/completions/data.ts",
  "tests/domain/version.test.ts",
  "tests/edge/completions/data.test.ts",
];
const INPUTS = [
  {
    id: "new-guidelines",
    source: "/Users/acolomba/tmp/typescript-guidelines/typescript-unit-testing-guidelines.md",
    output: "inputs/typescript-unit-testing-guidelines.md",
  },
  {
    id: "new-rule",
    source: "/Users/acolomba/tmp/typescript-guidelines/typescript-unit-testing-rule.md",
    output: "inputs/typescript-unit-testing-rule.md",
  },
  {
    id: "legacy-rule",
    source: join(ROOT, ".claude/rules/unit-tests.md"),
    output: "inputs/legacy-unit-tests-rule.md",
  },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr}`);
  }
  return result.stdout;
}

function git(...args) {
  return run("git", args);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonYaml(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readRevisionFile(revision, path) {
  const result = spawnSync("git", ["show", `${revision}:${path}`], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) return undefined;
  return result.stdout;
}

function listRevisionFiles(revision, root) {
  return git("ls-tree", "-r", "--name-only", revision, "--", root)
    .split("\n")
    .filter((path) => path.endsWith(".ts"))
    .sort();
}

function lineCount(text) {
  if (text === undefined || text.length === 0) return 0;
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
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

function operationPaths(operation) {
  return operation.path ? [operation.path] : [operation.old_path, operation.new_path];
}

function moduleFamily(path) {
  const rel = path.replace(`${PRODUCTION_ROOT}/`, "").replace(`${TEST_ROOT}/`, "");
  const parts = rel.split("/");
  if (parts[0] === "orchestrators" && parts.length > 2) return parts.slice(0, 3).join("/");
  if (parts[0] === "bridges" && parts.length > 1) return parts.slice(0, 2).join("/");
  return parts[0] ?? "root";
}

function enrichOperations(operations, baseline, head, kind) {
  return operations
    .map((operation) => {
      const oldPath = operation.old_path ?? operation.path;
      const newPath = operation.new_path ?? operation.path;
      const before = operation.status === "added" ? undefined : readRevisionFile(baseline, oldPath);
      const after = operation.status === "deleted" ? undefined : readRevisionFile(head, newPath);
      return {
        ...operation,
        family: moduleFamily(newPath),
        kind,
        baseline_lines: lineCount(before),
        oracle_lines: lineCount(after),
        baseline_sha256: before === undefined ? null : hash(before),
        oracle_sha256: after === undefined ? null : hash(after),
        disposition: "reconsider",
        rationale:
          kind === "production"
            ? "Re-evaluate this path against the new module and unit-test design. Preserve its public behavior separately."
            : "Re-evaluate this test path against the new corresponding-test and case-isolation rules.",
      };
    })
    .sort((a, b) => operationPaths(a).join("\0").localeCompare(operationPaths(b).join("\0")));
}

function declarationName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  return undefined;
}

function declarationsForFile(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const rows = [];

  function add(node, kind, name = declarationName(node)) {
    if (!name) return;
    const normalized = node.getText(source).replace(/\s+/g, " ").trim();
    rows.push({
      path,
      name,
      kind,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      fingerprint: hash(normalized),
      normalized,
    });
  }

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)) add(statement, "function");
    else if (ts.isClassDeclaration(statement)) add(statement, "class");
    else if (ts.isInterfaceDeclaration(statement)) add(statement, "interface");
    else if (ts.isTypeAliasDeclaration(statement)) add(statement, "type");
    else if (ts.isEnumDeclaration(statement)) add(statement, "enum");
    else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        add(declaration, "variable");
      }
    }
  }
  return rows;
}

function revisionDeclarations(revision, root) {
  const rows = [];
  for (const path of listRevisionFiles(revision, root)) {
    const text = readRevisionFile(revision, path);
    if (text !== undefined) rows.push(...declarationsForFile(path, text));
  }
  return rows;
}

function tokens(text) {
  return new Set(
    text
      .replace(/["'`](?:\\.|[^"'`])*["'`]/g, " STRING ")
      .match(/[A-Za-z_$][A-Za-z0-9_$]*|=>|===|!==|\?\?|&&|\|\|/g) ?? [],
  );
}

function jaccard(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.max(1, a.size + b.size - intersection);
}

function semanticMoves(baselineRows, oracleRows) {
  const oracleByKey = new Map();
  for (const row of oracleRows) {
    const key = `${row.kind}\0${row.name}`;
    const bucket = oracleByKey.get(key) ?? [];
    bucket.push(row);
    oracleByKey.set(key, bucket);
  }

  const result = [];
  for (const before of baselineRows) {
    const key = `${before.kind}\0${before.name}`;
    const candidates = (oracleByKey.get(key) ?? []).filter((row) => row.path !== before.path);
    const stayed = (oracleByKey.get(key) ?? []).some((row) => row.path === before.path);
    if (stayed || candidates.length === 0) continue;

    const ranked = candidates
      .map((after) => ({
        after,
        score:
          before.fingerprint === after.fingerprint
            ? 1
            : jaccard(before.normalized, after.normalized),
      }))
      .sort((a, b) => b.score - a.score || a.after.path.localeCompare(b.after.path));
    const best = ranked[0];
    const tied = ranked.length > 1 && Math.abs(ranked[1].score - best.score) < 0.01;
    if (best.score < 0.82 || tied) continue;
    result.push({
      symbol: before.name,
      declaration_kind: before.kind,
      from: `${before.path}:${before.line}`,
      to: `${best.after.path}:${best.after.line}`,
      evidence: best.score === 1 ? "exact-normalized-declaration" : "same-name-token-similarity",
      similarity: Number(best.score.toFixed(3)),
      confidence: best.score === 1 ? "high" : best.score >= 0.9 ? "medium" : "low",
      disposition: "reconsider",
    });
  }
  return result.sort((a, b) => a.from.localeCompare(b.from) || a.symbol.localeCompare(b.symbol));
}

function commitClassification(subject) {
  if (/^fix(?:\(|:)/.test(subject) || /^feat(?:\(|:)/.test(subject)) return "replay";
  if (/direct.coverage|alignment|fallow|tracer|gate|mirrored.test|ownership/i.test(subject)) {
    return "drop";
  }
  return "reconsider";
}

function intentCommits() {
  const rows = git(
    "log",
    "--reverse",
    "--format=%H%x09%s",
    `${MAIN_AT_EXPORT}..${ORACLE_HEAD}`,
    "--",
    PRODUCTION_ROOT,
    TEST_ROOT,
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      return { commit: line.slice(0, tab), subject: line.slice(tab + 1) };
    });

  const movePattern =
    /refactor|split|partition|extract|move|carve|relocat|fan |fold|internal|narrow|consolidat|construct|inject|scope|mirror|ownership/i;
  return rows
    .filter(({ subject }) => movePattern.test(subject))
    .map(({ commit, subject }) => {
      const operations = parseNameStatus(
        git(
          "diff-tree",
          "--no-commit-id",
          "--name-status",
          "-r",
          "--find-renames=30%",
          commit,
          "--",
          PRODUCTION_ROOT,
          TEST_ROOT,
        ),
      );
      const paths = [...new Set(operations.flatMap(operationPaths))].sort();
      return {
        commit,
        subject,
        disposition: commitClassification(subject),
        production_paths: paths.filter((path) => path.startsWith(`${PRODUCTION_ROOT}/`)),
        test_paths: paths.filter((path) => path.startsWith(`${TEST_ROOT}/`)),
      };
    });
}

function revisionMetadata(revision) {
  const format = "%H%x00%P%x00%aI%x00%s";
  const [commit, parents, authored_at, subject] = git("show", "-s", `--format=${format}`, revision)
    .trimEnd()
    .split("\0");
  return { commit, parents: parents ? parents.split(" ") : [], authored_at, subject };
}

function dirtyCheckpoint() {
  const patch = git("diff", "--binary", "--", ...DIRTY_CHECKPOINT_PATHS);
  return {
    status: "unverified-work-in-progress",
    paths: DIRTY_CHECKPOINT_PATHS,
    patch: "DIRTY-CHECKPOINT.patch",
    patch_sha256: hash(patch),
    patch_bytes: Buffer.byteLength(patch),
    intent: [
      "Internalize or remove unused production surfaces in version and completion data modules.",
      "Route the corresponding tests through computeHashVersion and getPluginRefCompletions.",
    ],
  };
}

function inputRecords() {
  return INPUTS.map((input) => {
    const text = readFileSync(input.source, "utf8");
    return {
      id: input.id,
      source_at_export: input.source,
      preserved_copy: input.output,
      sha256: hash(text),
      bytes: Buffer.byteLength(text),
    };
  });
}

function build() {
  const actualHead = git("rev-parse", "HEAD").trim();
  if (actualHead !== ORACLE_HEAD) {
    throw new Error(`Expected oracle HEAD ${ORACLE_HEAD}, found ${actualHead}`);
  }

  const productionOperations = parseNameStatus(
    git(
      "diff",
      "--name-status",
      "--find-renames=30%",
      `${ORACLE_CONTENT_BASE}..${ORACLE_HEAD}`,
      "--",
      PRODUCTION_ROOT,
    ),
  );
  const testOperations = parseNameStatus(
    git(
      "diff",
      "--name-status",
      "--find-renames=30%",
      `${ORACLE_CONTENT_BASE}..${ORACLE_HEAD}`,
      "--",
      TEST_ROOT,
    ),
  );
  const baselineProductionDeclarations = revisionDeclarations(ORACLE_CONTENT_BASE, PRODUCTION_ROOT);
  const oracleProductionDeclarations = revisionDeclarations(ORACLE_HEAD, PRODUCTION_ROOT);
  const baselineTestDeclarations = revisionDeclarations(ORACLE_CONTENT_BASE, TEST_ROOT);
  const oracleTestDeclarations = revisionDeclarations(ORACLE_HEAD, TEST_ROOT);
  const patch = git("diff", "--binary", "--", ...DIRTY_CHECKPOINT_PATHS);
  const commits = intentCommits();

  const baseline = {
    schema_version: 1,
    purpose: "Immutable inputs for the unit-test refactor preservation kit.",
    future_restart_base: null,
    future_restart_base_note:
      "Select the future base in the new branch and milestone. This export does not select it.",
    revisions: {
      branch_start: revisionMetadata(BRANCH_BASE),
      oracle_content_base: revisionMetadata(ORACLE_CONTENT_BASE),
      oracle_head: revisionMetadata(ORACLE_HEAD),
      main_at_export: revisionMetadata(MAIN_AT_EXPORT),
      merge_base_at_export: revisionMetadata(MERGE_BASE_AT_EXPORT),
    },
    divergence_at_export: {
      oracle_only_commits: 630,
      main_only_commits: 7,
    },
    worktree: {
      path_at_export: ROOT,
      branch: "features/unit-tests-scope",
      production_root: PRODUCTION_ROOT,
      test_root: TEST_ROOT,
    },
    source_counts: {
      baseline_production_ts_files: listRevisionFiles(ORACLE_CONTENT_BASE, PRODUCTION_ROOT).length,
      oracle_production_ts_files: listRevisionFiles(ORACLE_HEAD, PRODUCTION_ROOT).length,
      baseline_test_ts_files: listRevisionFiles(ORACLE_CONTENT_BASE, TEST_ROOT).length,
      oracle_test_ts_files: listRevisionFiles(ORACLE_HEAD, TEST_ROOT).length,
      changed_production_paths: productionOperations.length,
      changed_test_paths: testOperations.length,
      intent_commits: commits.length,
    },
    inputs: inputRecords(),
    dirty_checkpoint: dirtyCheckpoint(),
    infrastructure_notes: [
      "Git-mode TruffleHog cannot read a linked-worktree index. Scan exact paths in filesystem mode before a commit.",
      "A sandbox can reject loopback listeners with EPERM. Re-run the unchanged test with listener permission before changing it.",
      "Use exact staging paths because the source worktree contains unrelated dirty files.",
    ],
  };

  const transformations = {
    schema_version: 1,
    purpose:
      "Semantic and file-level map of work performed between the branch start and the committed oracle head.",
    source_range: `${ORACLE_CONTENT_BASE}..${ORACLE_HEAD}`,
    history_range: `${MAIN_AT_EXPORT}..${ORACLE_HEAD}`,
    interpretation: {
      replay: "Carry the behavior or correction into the new design.",
      reconsider: "Keep the intent, but decide the implementation again under the new guidelines.",
      drop: "Do not carry this workstream-specific mechanism into the replacement design.",
    },
    coverage: {
      production_path_records: productionOperations.length,
      test_path_records: testOperations.length,
      exact_or_probable_production_symbol_moves: null,
      exact_or_probable_test_symbol_moves: null,
      intent_commit_records: null,
    },
    production_path_operations: enrichOperations(
      productionOperations,
      ORACLE_CONTENT_BASE,
      ORACLE_HEAD,
      "production",
    ),
    test_path_operations: enrichOperations(
      testOperations,
      ORACLE_CONTENT_BASE,
      ORACLE_HEAD,
      "test",
    ),
    production_symbol_moves: semanticMoves(
      baselineProductionDeclarations,
      oracleProductionDeclarations,
    ),
    test_symbol_moves: semanticMoves(baselineTestDeclarations, oracleTestDeclarations),
    intent_commits: commits,
    dirty_checkpoint: dirtyCheckpoint(),
    limitations: [
      "A symbol match is an automated candidate when its declaration text changed.",
      "Commit intent records preserve moves that cannot be reconstructed from final-tree hashes.",
      "Public behavior and persistence semantics are authoritative when a structural record conflicts with a contract manifest.",
    ],
  };
  transformations.coverage.exact_or_probable_production_symbol_moves =
    transformations.production_symbol_moves.length;
  transformations.coverage.exact_or_probable_test_symbol_moves =
    transformations.test_symbol_moves.length;
  transformations.coverage.intent_commit_records = transformations.intent_commits.length;

  const files = new Map([
    ["BASELINE.yaml", jsonYaml(baseline)],
    ["TRANSFORMATIONS.yaml", jsonYaml(transformations)],
    ["DIRTY-CHECKPOINT.patch", patch],
  ]);
  for (const input of INPUTS) files.set(input.output, readFileSync(input.source, "utf8"));
  return files;
}

function main() {
  const check = process.argv.includes("--check");
  const files = build();
  const mismatches = [];
  for (const [path, content] of files) {
    const target = join(SCRIPT_DIR, path);
    if (check) {
      if (!existsSync(target) || readFileSync(target, "utf8") !== content) mismatches.push(path);
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
  }
  if (check && mismatches.length > 0) {
    throw new Error(`Generated artifacts are stale or missing: ${mismatches.join(", ")}`);
  }
  const mode = check ? "checked" : "generated";
  process.stdout.write(`${mode} ${files.size} preservation artifacts\n`);
}

main();
