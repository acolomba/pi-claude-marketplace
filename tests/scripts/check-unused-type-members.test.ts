import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

interface ExceptionRecord {
  readonly id: string;
  readonly owner: string;
  readonly key: string;
  readonly decision: string;
  readonly mechanism: string;
  readonly status: string;
}

interface GateReport {
  readonly schemaVersion: number;
  readonly status: string;
  readonly members: readonly MemberRecord[];
  readonly findings: readonly MemberRecord[];
  readonly exceptions: readonly ExceptionRecord[];
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

const testReadPath = "tests/edge/types.test.ts";

const testOnlyRead = `import { useDeps } from "../../extensions/pi-claude-marketplace/edge/types.ts";

import type { EdgeDeps } from "../../extensions/pi-claude-marketplace/edge/types.ts";

export function probe(deps: EdgeDeps): string {
  return useDeps(deps) + (deps.neverReadAnywhere ?? "");
}
`;

function memberById(report: GateReport, id: string): MemberRecord {
  const member = report.members.find((entry) => entry.id === id);

  if (member === undefined) {
    throw new Error(`The report has no member for ${id}`);
  }

  return member;
}

test("a member read only by a test is reported as test-only and does not fail the run", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [testReadPath]: testOnlyRead,
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 0);
  assert.deepStrictEqual(memberById(parseReport(run.stdout), `${typesPath}:3:3`), {
    id: `${typesPath}:3:3`,
    path: typesPath,
    line: 3,
    column: 3,
    owner: "EdgeDeps",
    key: "neverReadAnywhere",
    optional: true,
    category: "interface-member",
    status: "test-only-observed",
    witnesses: [
      {
        path: testReadPath,
        line: 6,
        column: 32,
        kind: "value-read",
        origin: "test",
        syntax: "property-access",
      },
    ],
    reasons: [],
  });
});

test("removing the only test read leaves the same member unread", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.strictEqual(memberById(parseReport(run.stdout), `${typesPath}:3:3`).status, "unread");
});

test("an independent production read is reported as runtime-observed", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: benignTypes,
    [testReadPath]: testOnlyRead,
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 0);
  assert.deepStrictEqual(
    memberById(parseReport(run.stdout), `${typesPath}:3:3`).witnesses.map(
      (witness) => `${witness.origin}:${witness.path}`,
    ),
    [`production:${typesPath}`, `test:${testReadPath}`],
  );
});

test("analysed source is parsed and never executed", async (t) => {
  // arrange
  const root = await createFixture(t, { "tsconfig.json": fixtureTsconfig });
  const sentinelPath = path.join(root, "executed.txt");
  await mkdir(path.dirname(path.join(root, typesPath)), { recursive: true });
  await writeFile(
    path.join(root, typesPath),
    `declare const require: (name: string) => {
  writeFileSync(target: string, text: string): void;
};

export interface EdgeDeps {
  readonly gitOps: string;
  readonly neverReadAnywhere?: string;
}

export function useDeps(deps: EdgeDeps): string {
  return deps.gitOps;
}

require("node:fs").writeFileSync(${JSON.stringify(sentinelPath)}, "executed");

throw new Error("analysed source must never run");
`,
  );

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(
    parseReport(run.stdout).findings.map((finding) => finding.id),
    [`${typesPath}:7:3`],
  );
  assert.strictEqual(existsSync(sentinelPath), false);
  assert.doesNotMatch(run.stderr, /analysed source must never run/);
});

test("an exhausted analysis budget fails instead of reporting a clean tree", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: benignTypes,
  });

  // act
  const run = runGate(["--root", root, "--json", "--budget", "5"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.strictEqual(run.stdout, "");
  assert.match(run.stderr, /Analysis budget of 5 nodes exhausted while walking /);
});

test("a budget that is not a positive whole number is a setup failure", () => {
  // act
  const run = runGate(["--budget", "0"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.match(run.stderr, /Option --budget needs a positive whole number, not 0/);
});

test("members are reported in a deterministic order across files", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    "extensions/pi-claude-marketplace/shared/second.ts": `export interface Second {
  readonly later?: string;
}
`,
    "extensions/pi-claude-marketplace/edge/first.ts": `export interface First {
  readonly earlier?: string;
  readonly alsoEarlier?: string;
}
`,
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.deepStrictEqual(
    parseReport(run.stdout).members.map((member) => member.id),
    [
      "extensions/pi-claude-marketplace/edge/first.ts:2:3",
      "extensions/pi-claude-marketplace/edge/first.ts:3:3",
      "extensions/pi-claude-marketplace/shared/second.ts:2:3",
    ],
  );
});

test("the help text states the bounded claim the gate makes and the claims it does not", () => {
  // arrange
  const expectedScope = [
    "Scope: this is a bounded may-observe analysis. It reports that some run-time",
    "syntax could read a declared member: property and optional-chain access, element",
    "access under a literal or finite literal-union key, binding and assignment",
    "destructuring, compound and update expressions, and exact `in` presence tests.",
    "",
    "Whole-object operations read a shape all at once and are settled by the",
    "declaration the checker resolved, never by the callee's spelling: JSON",
    "serialization, object spread and rest, Object.assign, Object.values and",
    "Object.entries, and Node's deep comparisons. A local function earns the same",
    "summary only by passing one of its own parameters into one of those. A",
    "comparison credits only the operand whose value came out of production code, so",
    "a fixture a test wrote for itself proves nothing.",
    "",
    "It does not claim the reading branch ever executes, that the value influences",
    "behaviour, or that an asserting test is a useful one. Coverage, dead-code",
    "analysis and test review remain necessary. Declarations, type-only references",
    "and key enumeration are not reads. A whole-object operation credits the members",
    "it reaches on the operand's own declaration and traces the places that supplied",
    "them only for the operand itself; own-property eligibility is refused where an",
    "accessor or a class instance makes it unprovable, and a run-time replacer or a",
    "toJSON member leaves the serialized keys unresolved.",
  ].join("\n");

  // act
  const run = runGate(["--help"]);

  // assert
  assert.strictEqual(run.status, 0);
  assert.ok(
    run.stdout.includes(expectedScope),
    `The help text does not state the bounded claim:\n${run.stdout}`,
  );
});

// ---------------------------------------------------------------------------
// Recorded decisions (scripts/check-unused-type-members.exceptions.json).
//
// MEMBER-02: the list is the ONLY sanctioned residual form, so the cases below
// are written against the ways it could quietly become a mute button rather than
// against the way it is meant to be used. Each one plants the abuse and requires
// a refusal: a pattern instead of a coordinate, a count instead of a member, a
// word instead of a measured mechanism, an entry that outlived its finding, and
// an entry pointed at an `unsupported-analysis` verdict the analyzer never made.
// ---------------------------------------------------------------------------

const exceptionsPath = "scripts/check-unused-type-members.exceptions.json";

/** The member `offenderTypes` leaves unread, which the entries below name. */
const unreadId = `${typesPath}:3:3`;

/**
 * A mechanism long enough to state what was tried and what was observed. The
 * cases that check the floor shorten it; the ones that check anything else must
 * not trip the floor by accident, so they all share this one.
 */
const measuredMechanism =
  "Measured: the member is written by the rollback aggregation and read by nothing today, and deleting it would force a future consumer of the structured surface to re-parse the per-phase text back out of prose. Recorded rather than repaired.";

const recordedDecision = "A recorded decision in the plan that accepted this row.";

function exceptionsFile(entries: readonly Readonly<Record<string, unknown>>[]): string {
  return `${JSON.stringify({ schemaVersion: 1, exceptions: entries }, undefined, 2)}\n`;
}

/** One well-formed entry for the member `offenderTypes` leaves unread. */
function validEntry(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    id: unreadId,
    owner: "EdgeDeps",
    key: "neverReadAnywhere",
    decision: recordedDecision,
    mechanism: measuredMechanism,
    ...overrides,
  };
}

test("a recorded decision clears its own member without moving the population", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [exceptionsPath]: exceptionsFile([validEntry()]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);
  const report = parseReport(run.stdout);

  // assert
  assert.strictEqual(run.status, 0);
  assert.deepStrictEqual(report.findings, []);
  assert.deepStrictEqual(report.exceptions, [
    {
      id: unreadId,
      owner: "EdgeDeps",
      key: "neverReadAnywhere",
      decision: recordedDecision,
      mechanism: measuredMechanism,
      status: "unread",
    },
  ]);
  // The member is still unread in the population the record is built from: a
  // decision changes the exit status and nothing else.
  assert.strictEqual(memberById(report, unreadId).status, "unread");
  assert.match(run.stderr, /^excepted: .*:3:3 EdgeDeps\.neverReadAnywhere -- /m);
});

test("a member outside the recorded decisions still fails the gate", async (t) => {
  // arrange
  const secondPath = "extensions/pi-claude-marketplace/shared/second.ts";
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [secondPath]: `export interface Second {
  readonly alsoNeverRead?: string;
}
`,
    [exceptionsPath]: exceptionsFile([validEntry()]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(
    parseReport(run.stdout).findings.map((finding) => finding.id),
    [`${secondPath}:2:3`],
  );
  assert.match(run.stderr, /Unused type member gate failed with 1 finding\(s\)\./);
});

test("a recorded decision that matches no finding refuses the run", async (t) => {
  // arrange: the member the entry names is read, so the entry outlived its row.
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: benignTypes,
    [exceptionsPath]: exceptionsFile([validEntry()]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.strictEqual(run.stdout, "");
  assert.match(run.stderr, /is not reported by this run/);
});

test("a recorded decision at drifted coordinates refuses rather than excusing what now sits there", async (t) => {
  // arrange: line 2 holds the member that IS read, so no finding sits there.
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [exceptionsPath]: exceptionsFile([validEntry({ id: `${typesPath}:2:3`, key: "gitOps" })]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.strictEqual(run.stdout, "");
  assert.match(run.stderr, /:2:3 EdgeDeps\.gitOps is not reported by this run/);
});

test("a recorded decision naming a different member at the right coordinates refuses the run", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [exceptionsPath]: exceptionsFile([validEntry({ owner: "SomethingElse" })]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.match(run.stderr, /SomethingElse\.neverReadAnywhere is not reported by this run/);
});

test("an unsupported finding can never be excused by a recorded decision", async (t) => {
  // arrange: a run-time replacer leaves the serialized keys unresolved, so the
  // analyzer reports that it could not decide rather than that nothing read it.
  const unresolvedPath = "extensions/pi-claude-marketplace/shared/unresolved.ts";
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [unresolvedPath]: `export interface Filtered {
  readonly kept: string;
}

export function write(filtered: Filtered): string {
  return JSON.stringify(filtered, (key: string, value: unknown) => (key === "" ? value : value));
}
`,
    [exceptionsPath]: exceptionsFile([
      validEntry({ id: `${unresolvedPath}:2:3`, owner: "Filtered", key: "kept" }),
    ]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.strictEqual(run.stdout, "");
  assert.match(run.stderr, /is unsupported-analysis, not unread/);
});

test("an identity carrying a pattern character is refused", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [exceptionsPath]: exceptionsFile([
      validEntry({ id: "extensions/pi-claude-marketplace/**/*.ts:3:3" }),
    ]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.match(run.stderr, /is not one exact member identity of the form path:line:column/);
});

test("an unknown field is refused, so a count or a threshold cannot be recorded", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [exceptionsPath]: exceptionsFile([validEntry({ maximumUnread: 6 })]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.match(run.stderr, /carries an unknown field maximumUnread/);
});

test("a mechanism too short to state what was measured is refused", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [exceptionsPath]: exceptionsFile([validEntry({ mechanism: "intentional" })]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.match(run.stderr, /states a 11-character mechanism/);
});

test("the same member listed twice is refused", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [exceptionsPath]: exceptionsFile([validEntry(), validEntry()]),
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.match(run.stderr, /is listed twice; one member carries one decision/);
});

test("a decision list declaring another schema version is refused", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
    [exceptionsPath]: `${JSON.stringify({ schemaVersion: 2, exceptions: [] })}\n`,
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.match(run.stderr, /declares schemaVersion 2 rather than 1/);
});

test("no decision list at all excuses no member", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: offenderTypes,
  });

  // act
  const run = runGate(["--root", root, "--json"]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(parseReport(run.stdout).exceptions, []);
  assert.deepStrictEqual(
    parseReport(run.stdout).findings.map((finding) => finding.id),
    [unreadId],
  );
});
