import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { TestContext } from "node:test";

// The analyzer is a `.mjs` module, so it is loaded through a runtime specifier
// and read through the explicit interfaces below. Those interfaces are the
// test-facing contract: the compiler cannot check a `.mjs` import, so the shape
// these cases rely on is written out here instead of being assumed.
//
// These cases drive the contract engine through the composed analysis, because
// a contract that never reaches the report excuses nothing anybody can see. The
// tracer additionally runs the real command-line tool as a child process, which
// is the path a maintainer actually takes.

const analysisModuleUrl = new URL(
  "../../scripts/check-unused-type-members.analysis.mjs",
  import.meta.url,
).href;

const contractsModuleUrl = new URL(
  "../../scripts/check-unused-type-members.contracts.mjs",
  import.meta.url,
).href;

const cliPath = fileURLToPath(
  new URL("../../scripts/check-unused-type-members.mjs", import.meta.url),
);

interface MemberRecord {
  readonly id: string;
  readonly owner: string;
  readonly key: string;
  readonly status: string;
  readonly reasons: readonly string[];
}

interface GateReport {
  readonly status: string;
  readonly counts: { readonly explicitContract: number };
  readonly members: readonly MemberRecord[];
  readonly findings: readonly MemberRecord[];
  readonly diagnostics: readonly string[];
}

interface ContractDecision {
  readonly id: string;
  readonly reason: string;
}

interface ContractResult {
  readonly decisions: readonly ContractDecision[];
  readonly diagnostics: readonly string[];
}

// The analyzer supplies the context; these cases never build one, so the
// parameter is stated as `unknown` rather than mirroring the analyzer's own
// internal shape here.
type ContractEvaluator = (context: unknown) => ContractResult;

interface AnalysisModule {
  analyzeProject(options: {
    readonly root: string;
    readonly contractEvaluator?: ContractEvaluator;
  }): GateReport;
}

interface ContractsModule {
  createContractEvaluator(options: { readonly contractsPath: string }): ContractEvaluator;
}

const analysis = (await import(analysisModuleUrl)) as unknown as AnalysisModule;
const contractsModule = (await import(contractsModuleUrl)) as unknown as ContractsModule;

const casesPath = "extensions/pi-claude-marketplace/cases.ts";
const contractsPath = "scripts/check-unused-type-members.contracts.json";

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

// An installed package is what makes "external" mean something here: its
// declarations are the only ones in the fixture that no analysed root owns.
const hostManifest = `${JSON.stringify(
  { name: "external-host", version: "1.0.0", main: "index.js", types: "index.d.ts" },
  undefined,
  2,
)}\n`;

const hostTypes = `export interface HostResult {
  payload?: unknown;
  unsent?: unknown;
}

export declare function register(handler: () => HostResult): void;
`;

async function createRoot(
  t: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "unused-type-members-contracts-"));

  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  for (const [relativePath, text] of Object.entries({
    "tsconfig.json": fixtureTsconfig,
    "node_modules/external-host/package.json": hostManifest,
    "node_modules/external-host/index.d.ts": hostTypes,
    ...files,
  })) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, text);
  }

  return root;
}

function contractsFile(document: unknown): string {
  return `${JSON.stringify(document, undefined, 2)}\n`;
}

async function analyzeWith(
  t: TestContext,
  production: string,
  document: unknown,
): Promise<GateReport> {
  const root = await createRoot(t, {
    [casesPath]: production,
    [contractsPath]: contractsFile(document),
  });
  const contractEvaluator = contractsModule.createContractEvaluator({
    contractsPath: path.join(root, contractsPath),
  });
  return analysis.analyzeProject({ root, contractEvaluator });
}

function memberFor(report: GateReport, owner: string, key: string): MemberRecord {
  const member = report.members.find((entry) => entry.owner === owner && entry.key === key);

  if (member === undefined) {
    throw new Error(`No candidate was inventoried for ${owner}.${key}`);
  }

  return member;
}

// Lines 1 to 11. `Emitted.payload` is declared at line 9, column 3, and nothing
// in this prefix reads either interface.
const types = `import { register } from "external-host";

export interface Carried {
  readonly delivered: string;
  readonly ignored?: string;
}

export interface Emitted {
  readonly payload?: string;
  readonly unsent?: string;
}
`;

// Line 15 holds both the returned literal's `payload` slot (column 14) and the
// return statement itself (column 5).
const directCases = `${types}
export function emit(carried: Carried): void {
  register((): Emitted => {
    return { payload: carried.delivered };
  });
}
`;

// The literal is built at line 15 column 30 and reaches the line 16 return only
// through the initializer transfer the flow walk recorded.
const indirectCases = `${types}
export function emit(carried: Carried): void {
  register((): Emitted => {
    const built: Emitted = { payload: carried.delivered };
    return built;
  });
}
`;

// The return at line 14 leaves a local function. No external declaration ever
// sees it, so it is not a boundary.
const localCases = `${types}
export function emit(carried: Carried): Emitted {
  return { payload: carried.delivered };
}
`;

// The `payload` slot is built at line 14 and kept aside. The line 17 return is a
// genuine external boundary that this value never reaches.
const asideCases = `${types}
export function emit(carried: Carried): void {
  const aside: Emitted = { payload: carried.delivered };
  void aside;
  register((): Emitted => {
    return { unsent: carried.delivered };
  });
}
`;

// Adds an ordinary read of `Emitted.payload` at line 20, column 18.
const readCases = `${directCases}
export function peek(emitted: Emitted): string | undefined {
  return emitted.payload;
}
`;

const payloadContract = {
  id: `${casesPath}:9:3`,
  owner: "Emitted",
  key: "payload",
  category: "external-output",
  purpose: "Mirrors the host result slot the registered handler returns.",
  origin: `${casesPath}:15:14`,
  boundary: `${casesPath}:15:5`,
};

function documentWith(...contracts: readonly unknown[]): unknown {
  return { schemaVersion: 1, contracts };
}

test("an output member that reaches a resolved external return is accepted", async (t) => {
  // arrange
  const report = await analyzeWith(t, directCases, documentWith(payloadContract));

  // act & assert
  assert.strictEqual(memberFor(report, "Emitted", "payload").status, "explicit-contract");
  assert.strictEqual(report.counts.explicitContract, 1);
});

test("an accepted contract records the boundary it was proven against", async (t) => {
  // arrange
  const report = await analyzeWith(t, directCases, documentWith(payloadContract));

  // act & assert
  assert.deepStrictEqual(memberFor(report, "Emitted", "payload").reasons, [
    `external-output: ${payloadContract.purpose} (origin ${casesPath}:15:14 reaches boundary ${casesPath}:15:5)`,
  ]);
  assert.deepStrictEqual(report.diagnostics, [`contracts: 1 validated from ${contractsPath}`]);
});

test("an origin that reaches the boundary through a transfer is accepted", async (t) => {
  // arrange
  const report = await analyzeWith(
    t,
    indirectCases,
    documentWith({
      ...payloadContract,
      origin: `${casesPath}:15:30`,
      boundary: `${casesPath}:16:5`,
    }),
  );

  // act & assert
  assert.strictEqual(memberFor(report, "Emitted", "payload").status, "explicit-contract");
});

test("the unread sibling of a contracted member still fails", async (t) => {
  // arrange
  const report = await analyzeWith(t, directCases, documentWith(payloadContract));

  // act & assert
  assert.deepStrictEqual(
    report.findings.map((finding) => `${finding.owner}.${finding.key}`),
    ["Carried.ignored", "Emitted.unsent"],
  );
  assert.strictEqual(report.status, "findings");
});

test("a return no external declaration ever sees is not a boundary", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      localCases,
      documentWith({
        ...payloadContract,
        origin: `${casesPath}:14:12`,
        boundary: `${casesPath}:14:3`,
      }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:9:3 boundary ${casesPath}:14:3 is not a return to an external declaration`,
    },
  );
});

test("an origin that never reaches the named boundary is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      asideCases,
      documentWith({
        ...payloadContract,
        origin: `${casesPath}:14:28`,
        boundary: `${casesPath}:17:5`,
      }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:9:3 origin ${casesPath}:14:28 never reaches boundary ${casesPath}:17:5`,
    },
  );
});

test("a contract naming no declaration in this program is stale", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, directCases, documentWith({ ...payloadContract, id: `${casesPath}:99:3` })),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:99:3 names no declaration in this program`,
    },
  );
});

test("a contract whose owner and key contradict the declaration fails", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, directCases, documentWith({ ...payloadContract, owner: "Carried" })),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:9:3 declares Emitted.payload, not Carried.payload`,
    },
  );
});

test("two contracts for one declaration fail as a duplicate", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, directCases, documentWith(payloadContract, payloadContract)),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:9:3 is named by more than one contract`,
    },
  );
});

test("a wildcard target fails instead of covering a family of members", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      directCases,
      documentWith({ ...payloadContract, id: "extensions/pi-claude-marketplace/*.ts:9:3" }),
    ),
    {
      name: "AnalysisSetupError",
      message:
        "Invalid contract: id must be a project-relative path:line:column with no wildcard, not extensions/pi-claude-marketplace/*.ts:9:3",
    },
  );
});

test("an unknown schema key fails", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, directCases, documentWith({ ...payloadContract, allowSiblings: "yes" })),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:9:3 carries unknown key allowSiblings`,
    },
  );
});

test("a contract file written against another schema version fails", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, directCases, { schemaVersion: 2, contracts: [payloadContract] }),
    {
      name: "AnalysisSetupError",
      message: "Invalid contract: file states schema version 2, but this gate reads version 1",
    },
  );
});

test("a contract rendered redundant by a genuine read fails", async (t) => {
  // arrange & act & assert
  await assert.rejects(analyzeWith(t, readCases, documentWith(payloadContract)), {
    name: "AnalysisSetupError",
    message: `Invalid contract: ${casesPath}:9:3 is already read at ${casesPath}:20:18; remove the contract`,
  });
});

test("the command-line tool applies the contract file and still reports the sibling", async (t) => {
  // arrange
  const root = await createRoot(t, {
    [casesPath]: directCases,
    [contractsPath]: contractsFile(documentWith(payloadContract)),
  });

  // act
  const run = spawnSync(process.execPath, [cliPath, "--root", root, "--json"], {
    encoding: "utf8",
  });
  const report = JSON.parse(run.stdout) as GateReport;

  // assert
  assert.strictEqual(run.status, 1);
  assert.strictEqual(memberFor(report, "Emitted", "payload").status, "explicit-contract");
  assert.deepStrictEqual(
    report.findings.map((finding) => `${finding.owner}.${finding.key}`),
    ["Carried.ignored", "Emitted.unsent"],
  );
});
