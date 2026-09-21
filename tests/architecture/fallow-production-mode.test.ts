/**
 * Calibrate production reachability against the installed Fallow analyzer.
 *
 * D-05 / D-08: every control below runs the shipping `.fallowrc.json` with ONE
 * field replaced -- the fixture entry -- and invokes the same no-production-flag
 * `dead-code` command the `fallow` npm script does. Production reachability
 * therefore arrives from the committed config, so a config that regressed off it
 * fails these controls rather than being masked by a local override of the very
 * setting under test.
 *
 * The two trailing cases are the other half of that claim: `deadCode` is the
 * only analysis moved to production scope, and `health` and `dupes` prove they
 * still discover the test tree from their own real reports, not from the config
 * text that requests it.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { findingIdentities, readAnalyzerReport } from "./fallow-report.ts";
import { FALLOW_CONTROL_TARGETS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

const ANALYZER = path.join(REPO_ROOT, "node_modules", "fallow", "bin", "fallow");
const [entry, helper, peer] = FALLOW_CONTROL_TARGETS;
const annotation =
  "// fallow-ignore-next-line unused-export -- Pi loads this default through the package manifest.\n";

interface AnalyzerControl {
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
  readonly expected: readonly string[];
}

const controls: readonly AnalyzerControl[] = [
  {
    name: "test-only export",
    files: {
      [entry]: "import { main } from './shared/errors.ts';\nmain();\n",
      [helper]: "export function main() { return 1; }\nexport function hidden() { return 2; }\n",
      "tests/helper.test.ts":
        "import { hidden } from '../extensions/pi-claude-marketplace/shared/errors.ts';\nhidden();\n",
    },
    expected: [`unused_exports|${helper}|hidden`],
  },
  {
    name: "production export consumer",
    files: {
      [entry]: "import { main, hidden } from './shared/errors.ts';\nmain(); hidden();\n",
      [helper]: "export function main() { return 1; }\nexport function hidden() { return 2; }\n",
      "tests/helper.test.ts":
        "import { hidden } from '../extensions/pi-claude-marketplace/shared/errors.ts';\nhidden();\n",
    },
    expected: [],
  },
  {
    name: "unused type",
    files: {
      [entry]: "import { main } from './shared/errors.ts';\nmain();\n",
      [helper]:
        "export interface Unused { value: string; }\nexport function main() { return 1; }\n",
    },
    expected: [`unused_types|${helper}|Unused`],
  },
  {
    name: "production type consumer",
    files: {
      [entry]:
        "import { main, type Unused } from './shared/errors.ts';\nconst item: Unused = { value: 'used' };\nmain(item.value);\n",
      [helper]:
        "export interface Unused { value: string; }\nexport function main(value: string) { return value; }\n",
    },
    expected: [],
  },
  {
    name: "unused file",
    files: {
      [entry]: "const ready = 1;\nvoid ready;\n",
      [helper]: "const hidden = 1;\nvoid hidden;\n",
    },
    expected: [`unused_files|${helper}`],
  },
  {
    name: "production file consumer",
    files: {
      [entry]: "import './shared/errors.ts';\n",
      [helper]: "const hidden = 1;\nvoid hidden;\n",
    },
    expected: [],
  },
  {
    name: "unused member",
    files: {
      [entry]: "import { Buffer } from './shared/errors.ts';\nnew Buffer().write();\n",
      [helper]: "export class Buffer { write() { return 1; } read() { return 2; } }\n",
    },
    expected: [`unused_class_members|${helper}|Buffer|read|class_method`],
  },
  {
    name: "production member consumer",
    files: {
      [entry]:
        "import { Buffer } from './shared/errors.ts';\nnew Buffer().write(); new Buffer().read();\n",
      [helper]: "export class Buffer { write() { return 1; } read() { return 2; } }\n",
    },
    expected: [],
  },
  {
    name: "duplicate live exports",
    files: {
      [entry]:
        "import { value as left } from './shared/errors.ts';\nimport { value as right } from './shared/markers.ts';\nleft(); right();\n",
      [helper]: "export function value() { return 1; }\n",
      [peer]: "export function value() { return 2; }\n",
    },
    expected: [`duplicate_exports|value|${helper}|${peer}`],
  },
  {
    name: "distinct live exports",
    files: {
      [entry]:
        "import { value as left } from './shared/errors.ts';\nimport { peerValue as right } from './shared/markers.ts';\nleft(); right();\n",
      [helper]: "export function value() { return 1; }\n",
      [peer]: "export function peerValue() { return 2; }\n",
    },
    expected: [],
  },
  {
    name: "entry annotation exact default",
    files: { [entry]: annotation + "export default function extension() { return 1; }\n" },
    expected: [],
  },
  {
    name: "entry annotation leaves sibling named export",
    files: {
      [entry]:
        annotation +
        "export default function extension() { return 1; }\nexport function stray() { return 2; }\n",
    },
    expected: [`unused_exports|${entry}|stray`],
  },
  {
    name: "entry annotation leaves unrelated default",
    files: {
      [entry]:
        "import { main } from './shared/errors.ts';\n" +
        annotation +
        "export default function extension() { return main(); }\n",
      [helper]:
        "export function main() { return 1; }\nexport default function unrelated() { return 2; }\n",
    },
    expected: [`unused_exports|${helper}|default`],
  },
  {
    name: "member annotation remains local",
    files: {
      [entry]:
        "import { Buffer } from './shared/errors.ts';\nimport { Peer } from './shared/markers.ts';\nnew Buffer().write(); new Peer().write();\n",
      [helper]:
        "export class Buffer {\n  write() { return 1; }\n  // fallow-ignore-next-line unused-class-member -- Finalization reads this buffer dynamically.\n  read() { return 2; }\n}\n",
      [peer]: "export class Peer { write() { return 1; } read() { return 2; } }\n",
    },
    expected: [`unused_class_members|${peer}|Peer|read|class_method`],
  },
  {
    name: "local member companion consumes sibling",
    files: {
      [entry]:
        "import { Buffer } from './shared/errors.ts';\nimport { Peer } from './shared/markers.ts';\nnew Buffer().write(); new Peer().write(); new Peer().read();\n",
      [helper]:
        "export class Buffer {\n  write() { return 1; }\n  // fallow-ignore-next-line unused-class-member -- Finalization reads this buffer dynamically.\n  read() { return 2; }\n}\n",
      [peer]: "export class Peer { write() { return 1; } read() { return 2; } }\n",
    },
    expected: [],
  },
];

/**
 * Write one fixture tree under `root`: the control's sources, a minimal
 * manifest, the shipping `.fallowrc.json` with the fixture entry, and every
 * rule pack that config names, copied verbatim.
 *
 * D-05 / D-08: the fixture entry is the ONLY field overridden. Production
 * mode, the boundary matrix, the rule pack and every threshold arrive from
 * the shipping config verbatim, so a regression in any of them lands in
 * these controls instead of hiding behind a local restatement of them.
 */
function materializeFixture(root: string, files: Readonly<Record<string, string>>): void {
  const parsedConfig: unknown = JSON.parse(
    readFileSync(path.join(REPO_ROOT, ".fallowrc.json"), "utf8"),
  );
  assert.ok(
    typeof parsedConfig === "object" && parsedConfig !== null && !Array.isArray(parsedConfig),
  );
  for (const [relative, source] of Object.entries(files)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, source);
  }

  // A pack path resolves against the analyzed root, so the shipping packs
  // must travel with the config or the analyzer refuses the fixture outright.
  const rulePacks = (parsedConfig as Record<string, unknown>).rulePacks;
  assert.ok(Array.isArray(rulePacks) && rulePacks.length > 0, "The config names no rule pack");
  for (const pack of rulePacks) {
    assert.ok(typeof pack === "string" && pack.length > 0);
    const target = path.join(root, pack);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(REPO_ROOT, pack), target);
  }

  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "fallow-control", private: true, type: "module" }),
  );
  writeFileSync(
    path.join(root, ".fallowrc.json"),
    JSON.stringify({
      ...parsedConfig,
      entry: [entry],
    }),
  );
}

for (const control of controls) {
  test(`Fallow production mode: ${control.name}`, (t) => {
    // arrange
    const root = mkdtempSync(path.join(tmpdir(), "fallow-control-"));
    t.after(() => {
      rmSync(root, { recursive: true, force: true });
    });
    materializeFixture(root, control.files);

    // act
    const report = readAnalyzerReport(
      process.execPath,
      [ANALYZER, "dead-code", "--no-cache", "--format", "json", "--fail-on-issues"],
      root,
    );

    // assert
    assert.deepStrictEqual(findingIdentities(report.findings), control.expected);
    assert.deepStrictEqual(
      {
        totalIssues: report.totalIssues,
        entryPointCount: report.entryPointCount,
        exitStatus: report.exitStatus,
      },
      {
        totalIssues: control.expected.length,
        entryPointCount: 1,
        exitStatus: control.expected.length === 0 ? 0 : 1,
      },
    );
  });
}

/** One validated dead-code document from a run in `root`, and its exit status. */
function readDeadCodeDocument(
  root: string,
  args: readonly string[],
): { document: Record<string, unknown>; exitStatus: number } {
  const outputRoot = mkdtempSync(path.join(tmpdir(), "fallow-cycle-"));
  try {
    const reportPath = path.join(outputRoot, "report.json");
    const descriptor = openSync(reportPath, "w");
    let exitStatus: number | null = null;
    try {
      const execution = spawnSync(process.execPath, [ANALYZER, ...args], {
        cwd: root,
        stdio: ["ignore", descriptor, "ignore"],
      });
      assert.strictEqual(execution.error, undefined);
      assert.strictEqual(execution.signal, null);
      exitStatus = execution.status;
    } finally {
      closeSync(descriptor);
    }

    assert.ok(exitStatus === 0 || exitStatus === 1, `The analyzer exited ${exitStatus}`);
    const parsed: unknown = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.ok(typeof parsed === "object" && parsed !== null && !Array.isArray(parsed));
    const document = parsed as Record<string, unknown>;
    assert.strictEqual(document.kind, "dead-code");
    assert.strictEqual(document.schema_version, 9);
    return { document, exitStatus };
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
}

/**
 * Every circular-dependency finding of `document`, as its member file list.
 *
 * `readAnalyzerReport` cannot serve this census: its parser normalizes the five
 * symbol-level categories and requires every other summary count to be zero,
 * which is precisely the shape a reported cycle breaks. The two cycle counts
 * are read from the summary as well, so a run that reports a cycle under a
 * renamed category fails here naming itself.
 */
function cycleFileLists(document: Record<string, unknown>): string[][] {
  const rows = document.circular_dependencies;
  assert.ok(Array.isArray(rows), "The report carries no `circular_dependencies` category");
  return rows.map((row: unknown) => {
    assert.ok(typeof row === "object" && row !== null && !Array.isArray(row));
    const files = (row as Record<string, unknown>).files;
    assert.ok(Array.isArray(files) && files.length > 1);
    return files.map((file: unknown) => {
      assert.ok(typeof file === "string" && file.length > 0);
      return file;
    });
  });
}

/** One nonnegative integer count from a report's `summary` block. */
function summaryCount(document: Record<string, unknown>, field: string): number {
  const summary = document.summary;
  assert.ok(typeof summary === "object" && summary !== null && !Array.isArray(summary));
  const count = (summary as Record<string, unknown>)[field];
  assert.ok(
    typeof count === "number" && Number.isInteger(count) && count >= 0,
    `The report summary carries no \`${field}\` count`,
  );
  return count;
}

/**
 * D-05 / D-11: production reachability is a SCOPE choice, and a cycle outside
 * the entry graph is still a cycle -- so `npm run fallow` runs dead-code twice.
 *
 * This is the planted offender the second invocation exists for. The fixture
 * carries the shipping config, a production entry that reaches one module, and
 * a two-file cycle under `tests/` that the entry graph never reaches. The
 * production-scoped command reports nothing, which is the measured limitation
 * of scoping `deadCode` to production reachability; the `--no-production`
 * cycle command names the same two files and exits 1.
 *
 * The cycle run stays filtered to the two cycle classes on purpose: a bare
 * `--no-production` run also re-reads the production-mode suppressions as
 * stale, a finding of a different class that would mask this one.
 */
test("D-05: the whole-tree cycle run reports a cycle the production-scoped run cannot see", (t) => {
  // arrange
  const root = mkdtempSync(path.join(tmpdir(), "fallow-cycle-control-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  materializeFixture(root, {
    [entry]: "import { main } from './shared/errors.ts';\nmain();\n",
    [helper]: "export function main() { return 1; }\n",
    "tests/left.ts":
      "import { right } from './right.ts';\nexport function left() { return right(); }\n",
    "tests/right.ts":
      "import { left } from './left.ts';\nexport function right() { return typeof left; }\n",
    "tests/helper.test.ts": "import { left } from './left.ts';\nleft();\n",
  });

  // act
  const scoped = readDeadCodeDocument(root, [
    "dead-code",
    "--no-cache",
    "--format",
    "json",
    "--fail-on-issues",
  ]);
  const wholeTree = readDeadCodeDocument(root, [
    "dead-code",
    "--no-cache",
    "--no-production",
    "--circular-deps",
    "--re-export-cycles",
    "--format",
    "json",
    "--fail-on-issues",
  ]);

  // assert
  assert.deepStrictEqual(
    {
      cycles: cycleFileLists(scoped.document),
      circularDependencies: summaryCount(scoped.document, "circular_dependencies"),
      reExportCycles: summaryCount(scoped.document, "re_export_cycles"),
      totalIssues: summaryCount(scoped.document, "total_issues"),
      exitStatus: scoped.exitStatus,
    },
    {
      cycles: [],
      circularDependencies: 0,
      reExportCycles: 0,
      totalIssues: 0,
      exitStatus: 0,
    },
    "D-05: the production-scoped dead-code run is expected to miss a cycle outside the entry graph; if it now reports one, the second invocation's justification has changed",
  );
  assert.deepStrictEqual(
    {
      cycles: cycleFileLists(wholeTree.document),
      circularDependencies: summaryCount(wholeTree.document, "circular_dependencies"),
      totalIssues: summaryCount(wholeTree.document, "total_issues"),
      exitStatus: wholeTree.exitStatus,
    },
    {
      cycles: [["tests/left.ts", "tests/right.ts"]],
      circularDependencies: 1,
      totalIssues: 1,
      exitStatus: 1,
    },
    "D-11: `fallow dead-code --no-production --circular-deps --re-export-cycles` did not report the planted cycle under tests/, so the npm script's second invocation gates nothing",
  );
});

/** Every policy-violation finding of `document`, reduced to its stable identity. */
function policyViolationIdentities(
  document: Record<string, unknown>,
): { path: string; rule: string; matched: string }[] {
  const rows = document.policy_violations;
  assert.ok(Array.isArray(rows), "The report carries no `policy_violations` category");
  return rows.map((row: unknown) => {
    assert.ok(typeof row === "object" && row !== null && !Array.isArray(row));
    const finding = row as Record<string, unknown>;
    const { path: file, pack, rule_id: ruleId, matched } = finding;
    assert.ok(typeof file === "string" && file.length > 0);
    assert.ok(typeof pack === "string" && typeof ruleId === "string");
    assert.ok(typeof matched === "string" && matched.length > 0);
    return { path: file, rule: `${pack}/${ruleId}`, matched };
  });
}

/**
 * IL-2: a direct stdio write is rejected by the rule pack, and by nothing else.
 *
 * The ban used to be thirteen identical `boundaries.calls.forbidden` rows, one
 * per zone. The rule pack states it once for the whole extension tree, so the
 * control pins two facts together: the pack rejects the write, and the boundary
 * matrix no longer reports it. The benign controls above run the same pack over
 * clean sources and require its count to be zero.
 */
test("IL-2: the rule pack rejects a direct stdout write once, from the pack alone", (t) => {
  // arrange
  const root = mkdtempSync(path.join(tmpdir(), "fallow-stdio-control-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  materializeFixture(root, {
    [entry]: "import { main } from './shared/errors.ts';\nmain();\n",
    [helper]: "export function main() { process.stdout.write('x'); return 1; }\n",
  });

  // act
  const { document, exitStatus } = readDeadCodeDocument(root, [
    "dead-code",
    "--no-cache",
    "--format",
    "json",
    "--fail-on-issues",
  ]);

  // assert
  assert.deepStrictEqual(
    {
      violations: policyViolationIdentities(document),
      policyViolations: summaryCount(document, "policy_violations"),
      boundaryCallViolations: summaryCount(document, "boundary_call_violations"),
      totalIssues: summaryCount(document, "total_issues"),
      exitStatus,
    },
    {
      violations: [
        { path: helper, rule: "architecture/no-direct-stdio", matched: "process.stdout.write" },
      ],
      policyViolations: 1,
      boundaryCallViolations: 0,
      totalIssues: 1,
      exitStatus: 1,
    },
  );
});

for (const control of [
  { name: "empty report", script: "", error: SyntaxError },
  { name: "malformed report", script: 'process.stdout.write("not JSON");', error: SyntaxError },
  {
    name: "wrong report kind",
    script: 'process.stdout.write(JSON.stringify({kind:"health",schema_version:9}));',
    error: {
      name: "AssertionError",
      actual: "health",
      expected: "dead-code",
      operator: "strictEqual",
    },
  },
  {
    name: "wrong report schema",
    script: 'process.stdout.write(JSON.stringify({kind:"dead-code",schema_version:8}));',
    error: { name: "AssertionError", actual: 8, expected: 9, operator: "strictEqual" },
  },
]) {
  test(`The analyzer instrument rejects ${control.name}`, (t) => {
    // arrange
    const root = mkdtempSync(path.join(tmpdir(), "fallow-instrument-"));
    t.after(() => {
      rmSync(root, { recursive: true, force: true });
    });

    // act & assert
    assert.throws(
      () => readAnalyzerReport(process.execPath, ["-e", control.script], root),
      control.error,
    );
  });
}

/**
 * One non-dead-code analysis report from the real repository.
 *
 * Child stdout goes to a real file rather than a pipe: under the test runner a
 * nested pipe can drop the child's output entirely, and an empty read is
 * indistinguishable from a clean report. The envelope is checked before any
 * field is read, so a renamed analysis or a bumped schema fails here naming
 * itself instead of scoring zero discovered files.
 */
function readScopeReport(
  analysis: string,
  kind: string,
  schemaVersion: number,
): Record<string, unknown> {
  const outputRoot = mkdtempSync(path.join(tmpdir(), "fallow-scope-"));
  try {
    const reportPath = path.join(outputRoot, "report.json");
    const descriptor = openSync(reportPath, "w");
    try {
      const execution = spawnSync(
        process.execPath,
        [ANALYZER, analysis, "--no-cache", "--format", "json"],
        { cwd: REPO_ROOT, stdio: ["ignore", descriptor, "ignore"] },
      );
      assert.strictEqual(execution.error, undefined);
      assert.strictEqual(execution.signal, null);
    } finally {
      closeSync(descriptor);
    }

    const parsed: unknown = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.ok(typeof parsed === "object" && parsed !== null && !Array.isArray(parsed));
    const document = parsed as Record<string, unknown>;
    assert.strictEqual(document.kind, kind);
    assert.strictEqual(document.schema_version, schemaVersion);
    return document;
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
}

/** Every repository-relative path a report lists under `field`, via `read`. */
function reportedPaths(
  document: Record<string, unknown>,
  field: string,
  read: (record: Record<string, unknown>) => string[],
): string[] {
  const rows = document[field];
  assert.ok(Array.isArray(rows) && rows.length > 0, `The report listed no ${field} at all`);
  return rows.flatMap((row: unknown) => {
    assert.ok(typeof row === "object" && row !== null && !Array.isArray(row));
    return read(row as Record<string, unknown>);
  });
}

test("D-05: health analysis keeps its test-inclusive scope", () => {
  // arrange
  const document = readScopeReport("health", "health", 11);

  // act
  const scored = reportedPaths(document, "file_scores", (score) => {
    const scoredPath = score.path;
    assert.ok(typeof scoredPath === "string" && scoredPath.length > 0);
    return [scoredPath];
  });

  // assert
  assert.ok(
    scored.some((scoredPath) => scoredPath.startsWith("tests/")),
    "D-05: health scored no file under tests/, so its scope moved to production with dead code",
  );
  assert.ok(
    scored.includes(entry),
    "D-05: health scored no production entry module, so its scope is not the whole tree either",
  );
});

test("D-05: duplication analysis keeps its test-inclusive scope", () => {
  // arrange
  const document = readScopeReport("dupes", "dupes", 10);

  // act
  const cloned = reportedPaths(document, "clone_groups", (group) => {
    const instances = group.instances;
    assert.ok(Array.isArray(instances) && instances.length > 1);
    return instances.map((instance: unknown) => {
      assert.ok(typeof instance === "object" && instance !== null);
      const file = (instance as Record<string, unknown>).file;
      assert.ok(typeof file === "string" && file.length > 0);
      return file;
    });
  });

  // assert
  assert.ok(
    cloned.some((clonedPath) => clonedPath.startsWith("tests/")),
    "D-05: duplication reported no clone under tests/, so its scope moved to production",
  );
  assert.ok(
    cloned.some((clonedPath) => clonedPath.startsWith("extensions/")),
    "D-05: duplication reported no clone under extensions/, so its scope is not the whole tree",
  );
});

test("The analyzer instrument rejects a missing launcher", (t) => {
  // arrange
  const root = mkdtempSync(path.join(tmpdir(), "fallow-instrument-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const missingLauncher = path.join(root, "missing-launcher");

  // act & assert
  assert.throws(() => readAnalyzerReport(missingLauncher, [], root), {
    code: "ENOENT",
    syscall: `spawnSync ${missingLauncher}`,
    path: missingLauncher,
  });
});

test("The analyzer instrument rejects termination before a report", (t) => {
  // arrange
  const root = mkdtempSync(path.join(tmpdir(), "fallow-instrument-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // act & assert
  assert.throws(
    () =>
      readAnalyzerReport(process.execPath, ["-e", 'process.kill(process.pid, "SIGTERM");'], root),
    {
      name: "AssertionError",
      actual: "SIGTERM",
      expected: null,
      operator: "strictEqual",
    },
  );
});
