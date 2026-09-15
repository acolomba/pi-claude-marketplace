import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { TestContext } from "node:test";

// The gate is a `.mjs` command-line tool, so these cases drive it the way every
// consumer does: as a child process with an argv array and no shell. The exit
// status and the `--json` report are the whole contract, which is why the cases
// assert both rather than trusting a zero status to mean "nothing found".

const cliPath = fileURLToPath(
  new URL("../../scripts/check-unused-type-members.mjs", import.meta.url),
);

const fixtureTsconfig = `${JSON.stringify(
  {
    compilerOptions: {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      noEmit: true,
      strict: true,
      target: "ES2022",
      types: [],
    },
    include: ["extensions/**/*.ts", "tests/**/*.ts"],
  },
  undefined,
  2,
)}\n`;

const typesPath = "extensions/pi-claude-marketplace/edge/types.ts";

// Line 2 declares the read member and line 3 the unread one; line 7 holds the
// only property access. The cases below pin those coordinates literally.
const offenderTypes = `export interface EdgeDeps {
  readonly gitOps: string;
  readonly neverReadAnywhere?: string;
}

export function useDeps(deps: EdgeDeps): string {
  return deps.gitOps;
}
`;

const benignTypes = `export interface EdgeDeps {
  readonly gitOps: string;
  readonly neverReadAnywhere?: string;
}

export function useDeps(deps: EdgeDeps): string {
  return deps.neverReadAnywhere ?? deps.gitOps;
}
`;

interface MemberWitness {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly kind: string;
  readonly origin: string;
  readonly syntax: string;
}

interface MemberRecord {
  readonly id: string;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly owner: string;
  readonly key: string;
  readonly optional: boolean;
  readonly category: string;
  readonly status: string;
  readonly witnesses: readonly MemberWitness[];
  readonly reasons: readonly string[];
}

interface GateReport {
  readonly schemaVersion: number;
  readonly status: string;
  readonly members: readonly MemberRecord[];
  readonly findings: readonly MemberRecord[];
  readonly diagnostics: readonly string[];
}

interface GateRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function createFixture(
  t: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "unused-type-members-"));

  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  for (const [relativePath, text] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, text);
  }

  return root;
}

function runGate(args: readonly string[]): GateRun {
  const completed = spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
  return { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr };
}

function parseReport(stdout: string): GateReport {
  return JSON.parse(stdout) as GateReport;
}

test("reports an unread optional member by its exact declaration identity", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(parseReport(run.stdout).findings, [
    {
      id: `${typesPath}:3:3`,
      path: typesPath,
      line: 3,
      column: 3,
      owner: "EdgeDeps",
      key: "neverReadAnywhere",
      optional: true,
      category: "interface-member",
      status: "unread",
      witnesses: [],
      reasons: [],
    },
  ]);
});

test("records the reading site for every member it accepts", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.deepStrictEqual(parseReport(run.stdout).members, [
    {
      id: `${typesPath}:2:3`,
      path: typesPath,
      line: 2,
      column: 3,
      owner: "EdgeDeps",
      key: "gitOps",
      optional: false,
      category: "interface-member",
      status: "runtime-observed",
      witnesses: [
        {
          path: typesPath,
          line: 7,
          column: 15,
          kind: "value-read",
          origin: "production",
          syntax: "property-access",
        },
      ],
      reasons: [],
    },
    {
      id: `${typesPath}:3:3`,
      path: typesPath,
      line: 3,
      column: 3,
      owner: "EdgeDeps",
      key: "neverReadAnywhere",
      optional: true,
      category: "interface-member",
      status: "unread",
      witnesses: [],
      reasons: [],
    },
  ]);
});

test("accepts the same declaration once a real read exists", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: benignTypes,
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 0);
  assert.deepStrictEqual(parseReport(run.stdout).findings, []);
});

test("an overlay changes the analyzed text without editing the project on disk", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: benignTypes,
    "overlay.json": JSON.stringify({ [typesPath]: offenderTypes }),
  });

  // act
  const run = runGate(["--root", root, "--json", "--overlay", path.join(root, "overlay.json")]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(
    parseReport(run.stdout).findings.map((member) => member.id),
    [`${typesPath}:3:3`],
  );
  assert.strictEqual(await readFile(path.join(root, typesPath), "utf8"), benignTypes);
});

test("a missing tsconfig is a setup failure, not a member finding", async (t) => {
  // arrange
  const root = await createFixture(t, { [typesPath]: offenderTypes });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.strictEqual(run.stdout, "");
  assert.match(run.stderr, /tsconfig\.json/);
});

test("an overlay path outside the project is a setup failure", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: benignTypes,
    "overlay.json": JSON.stringify({ "../escape.ts": "export const escaped = 1;\n" }),
  });

  // act
  const run = runGate(["--root", root, "--json", "--overlay", path.join(root, "overlay.json")]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.strictEqual(run.stdout, "");
  assert.match(run.stderr, /Overlay path is not an existing project file: \.\.\/escape\.ts/);
});

test("an unknown option is a setup failure", () => {
  // act
  const run = runGate(["--bogus"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.strictEqual(run.stdout, "");
  assert.match(run.stderr, /Unknown option: --bogus/);
});

test("a project with no production sources is a setup failure", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    "tests/only.test.ts": "export const onlyTest = 1;\n",
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.strictEqual(run.stdout, "");
  assert.match(run.stderr, /No production source files/);
});

test("importing the command-line module does not run the gate", () => {
  // arrange
  const specifier = JSON.stringify(pathToFileURL(cliPath).href);

  // act
  const completed = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${specifier});process.stdout.write("inert");`],
    { encoding: "utf8" },
  );

  // assert
  assert.strictEqual(completed.status, 0);
  assert.strictEqual(completed.stdout, "inert");
});
