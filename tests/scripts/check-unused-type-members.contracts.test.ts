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

// `HostEvent` declares `reason` as required and `note` as optional, at lines 10
// and 11. That difference is what separates an input mirror the host compels
// from one it merely happens to have.
const hostTypes = `export interface HostResult {
  payload?: unknown;
  unsent?: unknown;
}

export declare function register(handler: () => HostResult): void;

export interface HostEvent {
  kind: "discover";
  reason: "startup" | "reload";
  note?: string;
}

export declare function observe(handler: (event: HostEvent) => void): void;
`;

const hostTypesPath = "node_modules/external-host/index.d.ts";

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

// The three unique symbols are declared at lines 1, 3 and 5. `openBrand` is
// exported, so any module can spell its key; the other two cannot be reached
// from outside this file at all.
const brandCases = `declare const shapeBrand: unique symbol;

export declare const openBrand: unique symbol;

const scopeBrand: unique symbol = Symbol("scope");

export interface Branded {
  readonly [shapeBrand]: never;
  readonly ordinary?: string;
}

export interface Scoped {
  readonly [scopeBrand]: true;
}

export interface Opened {
  readonly [openBrand]: never;
}

export interface Faked {
  readonly __brand: never;
}

export interface Valued {
  readonly [shapeBrand]: string;
}
`;

function brandContract(line: number, key: string, owner: string, symbol: string): unknown {
  return {
    id: `${casesPath}:${line}:3`,
    owner,
    key,
    category: "nominal-brand",
    purpose: "Compile-time marker; the runtime value is the underlying shape.",
    symbol: `${casesPath}:${symbol}`,
  };
}

test("an ambient unique-symbol brand keeps its type-system role", async (t) => {
  // arrange
  const report = await analyzeWith(
    t,
    brandCases,
    documentWith(brandContract(8, "shapeBrand", "Branded", "1:15")),
  );

  // act & assert
  assert.strictEqual(memberFor(report, "Branded", "shapeBrand").status, "explicit-contract");
  assert.deepStrictEqual(memberFor(report, "Branded", "shapeBrand").reasons, [
    "nominal-brand: Compile-time marker; the runtime value is the underlying shape. " +
      `(unique symbol ${casesPath}:1:15 cannot be spelled outside its module)`,
  ]);
});

test("an object brand scoped by a module-private symbol keeps its role", async (t) => {
  // arrange
  const report = await analyzeWith(
    t,
    brandCases,
    documentWith(brandContract(13, "scopeBrand", "Scoped", "5:7")),
  );

  // act & assert
  assert.strictEqual(memberFor(report, "Scoped", "scopeBrand").status, "explicit-contract");
});

test("the ordinary sibling of a branded member is not covered", async (t) => {
  // arrange
  const report = await analyzeWith(
    t,
    brandCases,
    documentWith(brandContract(8, "shapeBrand", "Branded", "1:15")),
  );

  // act & assert
  assert.strictEqual(memberFor(report, "Branded", "ordinary").status, "unread");
  assert.ok(
    report.findings.some((finding) => finding.id === `${casesPath}:9:3`),
    "the ordinary sibling must still be reported",
  );
});

test("an ordinary property that merely looks branded is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, brandCases, documentWith(brandContract(21, "__brand", "Faked", "1:15"))),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:21:3 does not declare a computed unique-symbol key`,
    },
  );
});

test("a brand whose key symbol any module can spell is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, brandCases, documentWith(brandContract(17, "openBrand", "Opened", "3:22"))),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:17:3 key symbol openBrand is exported, so any module can mint this shape`,
    },
  );
});

test("a symbol-keyed member carrying a real value type is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, brandCases, documentWith(brandContract(25, "shapeBrand", "Valued", "1:15"))),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:25:3 declares type string, which an ordinary value can supply`,
    },
  );
});

test("a brand whose recorded symbol site has drifted is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, brandCases, documentWith(brandContract(8, "shapeBrand", "Branded", "3:22"))),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:8:3 key symbol is declared at ${casesPath}:1:15, not ${casesPath}:3:22`,
    },
  );
});

test("a brand entry carrying another category's key is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(t, brandCases, {
      schemaVersion: 1,
      contracts: [
        {
          ...(brandContract(8, "shapeBrand", "Branded", "1:15") as object),
          origin: `${casesPath}:8:3`,
        },
      ],
    }),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:8:3 carries unknown key origin`,
    },
  );
});

// The filter literal's own `status` is declared at line 14, column 31, and the
// selection that holds it starts at line 14, column 12. Nothing here is ever
// read at run time; the members exist to make the compiler choose a variant.
const selectionCases = `export interface Started {
  readonly status: "started";
  readonly at: string;
}

export interface Stopped {
  readonly status: "stopped";
  readonly until: string;
}

export type Message = Started | Stopped;

export type Render<K extends Message["status"]> = (
  message: Extract<Message, { status: K }>,
) => string;

export type Both = Extract<Message, { status: "started" | "stopped" }>;
`;

// The same syntax over a union whose variants share one literal. The filter is
// still shaped like a selection and still selects nothing.
const flatCases = `export interface Started {
  readonly status: "same";
  readonly at: string;
}

export interface Stopped {
  readonly status: "same";
  readonly until: string;
}

export type Message = Started | Stopped;

export type Render<K extends Message["status"]> = (
  message: Extract<Message, { status: K }>,
) => string;
`;

const selectionContract = {
  id: `${casesPath}:14:31`,
  owner: "Render.message",
  key: "status",
  category: "type-selection",
  purpose: "Selects the message variant each render arm receives.",
  filter: `${casesPath}:14:12`,
};

test("a genuine selection literal keeps its type-system role", async (t) => {
  // arrange
  const report = await analyzeWith(t, selectionCases, documentWith(selectionContract));

  // act & assert
  assert.strictEqual(memberFor(report, "Render.message", "status").status, "explicit-contract");
  assert.deepStrictEqual(memberFor(report, "Render.message", "status").reasons, [
    "type-selection: Selects the message variant each render arm receives. " +
      `(filter ${casesPath}:14:12 selects by status)`,
  ]);
});

test("a discriminant the selection reads at run time is not covered by it", async (t) => {
  // arrange
  const report = await analyzeWith(t, selectionCases, documentWith(selectionContract));

  // act & assert
  assert.strictEqual(memberFor(report, "Started", "status").status, "unread");
  assert.strictEqual(memberFor(report, "Stopped", "status").status, "unread");
});

test("a filter over a union that does not discriminate on the key is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(analyzeWith(t, flatCases, documentWith(selectionContract)), {
    name: "AnalysisSetupError",
    message: `Invalid contract: ${casesPath}:14:31 filter ${casesPath}:14:12 selects over a type that does not discriminate on status`,
  });
});

test("a resolved filter that keeps the whole union refines nothing", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      selectionCases,
      documentWith({
        ...selectionContract,
        id: `${casesPath}:17:39`,
        owner: "Both",
        filter: `${casesPath}:17:20`,
      }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:17:39 filter ${casesPath}:17:20 selects the whole union, so it refines nothing`,
    },
  );
});

test("a member outside the named filter is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      selectionCases,
      documentWith({ ...selectionContract, id: `${casesPath}:2:3`, owner: "Started" }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:2:3 is not a member of the filter at ${casesPath}:14:12`,
    },
  );
});

test("a filter site that names no selection is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      selectionCases,
      documentWith({ ...selectionContract, filter: `${casesPath}:11:1` }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:14:31 filter ${casesPath}:11:1 is not a two-argument type selection`,
    },
  );
});

// The handler at line 10, column 11 is checked against the installed
// `observe` signature. Nothing in the body reads the event.
const inputCases = `import { observe } from "external-host";

export interface LocalEvent {
  readonly kind: "discover";
  readonly reason: "startup" | "reload";
  readonly note?: string;
}

export function watch(): void {
  observe((event: LocalEvent) => {
    void event;
  });
}
`;

// The same handler, reached only through an assertion. The compiler checks the
// assertion, not the function.
const assertedCases = `import { observe } from "external-host";

import type { HostEvent } from "external-host";

export interface LocalEvent {
  readonly kind: "discover";
  readonly reason: "startup" | "reload";
  readonly note?: string;
}

export function watch(): void {
  observe(((event: LocalEvent) => {
    void event;
  }) as (event: HostEvent) => void);
}
`;

// Adds an ordinary read of `LocalEvent.reason` at line 16, column 16.
const readInputCases = `${inputCases}
export function peek(event: LocalEvent): string {
  return event.reason;
}
`;

const inputContract = {
  id: `${casesPath}:5:3`,
  owner: "LocalEvent",
  key: "reason",
  category: "external-input",
  purpose: "The host always supplies this slot, and the handler signature must accept it.",
  upstream: `${hostTypesPath}:10:3`,
  necessity: `${casesPath}:10:11`,
};

test("an input mirror the installed signature compels is accepted", async (t) => {
  // arrange
  const report = await analyzeWith(t, inputCases, documentWith(inputContract));

  // act & assert
  assert.strictEqual(memberFor(report, "LocalEvent", "reason").status, "explicit-contract");
  assert.deepStrictEqual(memberFor(report, "LocalEvent", "reason").reasons, [
    "external-input: The host always supplies this slot, and the handler signature must accept it. " +
      `(upstream ${hostTypesPath}:10:3 requires it at ${casesPath}:10:11)`,
  ]);
});

test("an unread input sibling is not covered by its neighbour's contract", async (t) => {
  // arrange
  const report = await analyzeWith(t, inputCases, documentWith(inputContract));

  // act & assert
  assert.deepStrictEqual(
    report.findings.map((finding) => `${finding.owner}.${finding.key}`),
    ["LocalEvent.kind", "LocalEvent.note"],
  );
});

test("an upstream slot the host declares as optional compels no mirror", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      inputCases,
      documentWith({
        ...inputContract,
        id: `${casesPath}:6:3`,
        key: "note",
        upstream: `${hostTypesPath}:11:3`,
      }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:6:3 upstream ${hostTypesPath}:11:3 declares note as optional, so no local mirror is compelled`,
    },
  );
});

test("an upstream site that no longer declares the member is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      inputCases,
      documentWith({ ...inputContract, upstream: `${hostTypesPath}:9:3` }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:5:3 upstream ${hostTypesPath}:9:3 does not declare reason in an installed declaration`,
    },
  );
});

test("a handler reached only through an assertion proves no external expectation", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      assertedCases,
      documentWith({
        ...inputContract,
        id: `${casesPath}:7:3`,
        necessity: `${casesPath}:12:12`,
      }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:7:3 necessity ${casesPath}:12:12 is reached only through an assertion, which checks nothing`,
    },
  );
});

test("an input contract a genuine read has made redundant is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(analyzeWith(t, readInputCases, documentWith(inputContract)), {
    name: "AnalysisSetupError",
    message: `Invalid contract: ${casesPath}:5:3 is already read at ${casesPath}:16:16; remove the contract`,
  });
});

// A selection whose source is a type parameter. The union it can stand for is
// its constraint, so that is where the discriminant lives. The filter literal's
// own `status` is declared at line 14, column 27, and the selection that holds
// it starts at line 14, column 12.
const boundSelectionCases = `export interface Started {
  status: "started";
  at: string;
}

export interface Stopped {
  status: "stopped";
  until: string;
}

export type Message = Started | Stopped;

export type Dispatch<Msg extends Message, K extends Msg["status"]> = (
  message: Extract<Msg, { status: K }>,
) => string;

export interface Flat {
  label: string;
}

export type Loose<Row extends Flat, K extends Row["label"]> = (
  row: Extract<Row, { label: K }>,
) => string;
`;

const boundSelectionContract = {
  id: `${casesPath}:14:27`,
  owner: "Dispatch.message",
  key: "status",
  category: "type-selection",
  purpose: "Selects the message variant each dispatch arm receives.",
  filter: `${casesPath}:14:12`,
};

test("a selection over a bounded type parameter keeps its type-system role", async (t) => {
  // arrange
  const report = await analyzeWith(t, boundSelectionCases, documentWith(boundSelectionContract));

  // act & assert
  assert.strictEqual(memberFor(report, "Dispatch.message", "status").status, "explicit-contract");
  assert.deepStrictEqual(memberFor(report, "Dispatch.message", "status").reasons, [
    "type-selection: Selects the message variant each dispatch arm receives. " +
      `(filter ${casesPath}:14:12 selects by status)`,
  ]);
});

test("a bounded selection leaves the variants' own discriminants alone", async (t) => {
  // arrange
  const report = await analyzeWith(t, boundSelectionCases, documentWith(boundSelectionContract));

  // act & assert
  assert.strictEqual(memberFor(report, "Started", "status").status, "unread");
  assert.strictEqual(memberFor(report, "Stopped", "status").status, "unread");
});

test("a type parameter bounded by a shape that discriminates nothing is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      boundSelectionCases,
      documentWith({
        ...boundSelectionContract,
        id: `${casesPath}:22:23`,
        owner: "Loose.row",
        key: "label",
        filter: `${casesPath}:22:8`,
      }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:22:23 filter ${casesPath}:22:8 selects over a type that does not discriminate on label`,
    },
  );
});

// An intersection that narrows a slot the rest of the intersection already
// declares. Line 7 holds the intersection at column 9, its `notifications`
// refinement at column 21, and the nested `mode` refinement at column 38.
// Nothing reads either: they exist so the compiler admits only one mode.
const refinementCases = `export interface Options {
  notifications: { mode: "standalone" | "orchestrated" };
  name: string;
}

export function orchestrate(
  opts: Options & { notifications: { mode: "orchestrated" } },
): string {
  return opts.name;
}

export function add(
  opts: Options & { extra: string },
): string {
  return opts.name;
}

export function same(
  opts: Options & { name: string },
): string {
  return opts.notifications.mode;
}
`;

const refinementContract = {
  id: `${casesPath}:7:21`,
  owner: "orchestrate.opts",
  key: "notifications",
  category: "type-refinement",
  purpose: "Admits only the orchestrated mode at this entry point.",
  refines: `${casesPath}:7:9`,
};

const nestedRefinementContract = {
  id: `${casesPath}:7:38`,
  owner: "orchestrate.opts.notifications",
  key: "mode",
  category: "type-refinement",
  purpose: "Names the one mode this entry point admits.",
  refines: `${casesPath}:7:9`,
};

test("an intersection that narrows an existing slot keeps its type-system role", async (t) => {
  // arrange
  const report = await analyzeWith(t, refinementCases, documentWith(refinementContract));

  // act & assert
  assert.strictEqual(
    memberFor(report, "orchestrate.opts", "notifications").status,
    "explicit-contract",
  );
  assert.deepStrictEqual(memberFor(report, "orchestrate.opts", "notifications").reasons, [
    "type-refinement: Admits only the orchestrated mode at this entry point. " +
      `(intersection ${casesPath}:7:9 narrows notifications)`,
  ]);
});

test("a refinement nested inside a refined slot is proved through its own path", async (t) => {
  // arrange
  const report = await analyzeWith(t, refinementCases, documentWith(nestedRefinementContract));

  // act & assert
  assert.strictEqual(
    memberFor(report, "orchestrate.opts.notifications", "mode").status,
    "explicit-contract",
  );
  assert.deepStrictEqual(memberFor(report, "orchestrate.opts.notifications", "mode").reasons, [
    "type-refinement: Names the one mode this entry point admits. " +
      `(intersection ${casesPath}:7:9 narrows notifications.mode)`,
  ]);
});

test("a refinement covers neither the slot it narrows nor its unrefined sibling", async (t) => {
  // arrange
  const report = await analyzeWith(t, refinementCases, documentWith(refinementContract));

  // act & assert
  assert.strictEqual(memberFor(report, "Options", "notifications").status, "runtime-observed");
  assert.strictEqual(memberFor(report, "orchestrate.opts.notifications", "mode").status, "unread");
});

test("an intersection that adds a slot of its own is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      refinementCases,
      documentWith({
        ...refinementContract,
        id: `${casesPath}:13:21`,
        owner: "add.opts",
        key: "extra",
        refines: `${casesPath}:13:9`,
      }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:13:21 refines ${casesPath}:13:9 adds extra, which the rest of the intersection does not declare`,
    },
  );
});

test("an intersection that restates a slot unchanged narrows nothing", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      refinementCases,
      documentWith({
        ...refinementContract,
        id: `${casesPath}:19:21`,
        owner: "same.opts",
        key: "name",
        refines: `${casesPath}:19:9`,
      }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:19:21 refines ${casesPath}:19:9 does not narrow name`,
    },
  );
});

test("a refines site that names no intersection is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      refinementCases,
      documentWith({ ...refinementContract, refines: `${casesPath}:1:1` }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:7:21 refines ${casesPath}:1:1 is not an intersection type`,
    },
  );
});

test("a member outside the named intersection is refused", async (t) => {
  // arrange & act & assert
  await assert.rejects(
    analyzeWith(
      t,
      refinementCases,
      documentWith({ ...refinementContract, refines: `${casesPath}:13:9` }),
    ),
    {
      name: "AnalysisSetupError",
      message: `Invalid contract: ${casesPath}:7:21 is not a member of the intersection at ${casesPath}:13:9`,
    },
  );
});
