/** Calibrate production reachability against the installed Fallow analyzer. */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

for (const control of controls) {
  test(`Fallow production mode: ${control.name}`, (t) => {
    // arrange
    const root = mkdtempSync(path.join(tmpdir(), "fallow-control-"));
    t.after(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const parsedConfig: unknown = JSON.parse(
      readFileSync(path.join(REPO_ROOT, ".fallowrc.json"), "utf8"),
    );
    assert.ok(
      typeof parsedConfig === "object" && parsedConfig !== null && !Array.isArray(parsedConfig),
    );
    for (const [relative, source] of Object.entries(control.files)) {
      const target = path.join(root, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, source);
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
        production: { deadCode: true, health: false, dupes: false },
      }),
    );

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
