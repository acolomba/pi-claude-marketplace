import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { TestContext } from "node:test";

// The audit is a `.mjs` command-line tool, so these cases drive it the way a
// consumer does: as a child process with an argv array and no shell. Every
// expected declaration identity below is counted by hand from the fixture text
// printed in this file -- never copied out of the report the audit is checking,
// which is the one oracle an instrument that checks a report may not borrow.

const auditPath = fileURLToPath(
  new URL("../../scripts/check-unused-type-members.audit.mjs", import.meta.url),
);

const gatePath = fileURLToPath(
  new URL("../../scripts/check-unused-type-members.mjs", import.meta.url),
);

const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url));

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
const testReadPath = "tests/edge/types.test.ts";
const foldPath = "extensions/pi-claude-marketplace/domain/fold.ts";
const ledgerName = "TRIAGE.md";

// Line 2 declares the production-read member, line 3 the member only a test
// reads and line 4 the member nothing reads. Each sits at column 3 behind two
// spaces of indent. Those three coordinates are the identities every case below
// states for itself.
const populationTypes = `export interface EdgeDeps {
  readonly gitOps: string;
  readonly probeOnly: string;
  readonly neverReadAnywhere?: string;
}

export function useDeps(deps: EdgeDeps): string {
  return deps.gitOps;
}
`;

// The same three declarations at the same three coordinates, with production
// code that now reads the third one as well. `probeOnly` stays the single
// member only a test reads.
const explainedTypes = `export interface EdgeDeps {
  readonly gitOps: string;
  readonly probeOnly: string;
  readonly neverReadAnywhere?: string;
}

export function useDeps(deps: EdgeDeps): string {
  return deps.gitOps + (deps.neverReadAnywhere ?? "");
}
`;

// One more declaration at line 5, read only by the same test file. Adding it
// moves the analysed source and introduces a candidate the recorded ledger
// cannot know about.
const grownTypes = `export interface EdgeDeps {
  readonly gitOps: string;
  readonly probeOnly: string;
  readonly neverReadAnywhere?: string;
  readonly grownLater: string;
}

export function useDeps(deps: EdgeDeps): string {
  return deps.gitOps;
}
`;

const testOnlyRead = `import type { EdgeDeps } from "../../extensions/pi-claude-marketplace/edge/types.ts";

export function probe(deps: EdgeDeps): string {
  return deps.probeOnly;
}
`;

const grownTestOnlyRead = `import type { EdgeDeps } from "../../extensions/pi-claude-marketplace/edge/types.ts";

export function probe(deps: EdgeDeps): string {
  return deps.probeOnly + deps.grownLater;
}
`;

// `reduce` is the container operation the analyzer deliberately does not model,
// so line 2 is an `unsupported-analysis` row rather than an unread one.
const unsupportedFold = `export interface Folded {
  readonly maybe?: string;
}

export function fold(items: Folded[], join: (total: string, item: Folded) => string): string {
  return items.reduce(join, "");
}
`;

const gitOpsId = `${typesPath}:2:3`;
const probeOnlyId = `${typesPath}:3:3`;
const neverReadId = `${typesPath}:4:3`;
const grownLaterId = `${typesPath}:5:3`;
const foldedMaybeId = `${foldPath}:2:3`;

interface LedgerFingerprint {
  readonly algorithm: string;
  readonly files: number;
  readonly digest: string;
}

interface LedgerCounts {
  readonly productionFiles: number;
  readonly candidates: number;
  readonly runtimeObserved: number;
  readonly testOnlyObserved: number;
  readonly explicitContract: number;
  readonly unread: number;
  readonly unsupportedAnalysis: number;
}

interface LedgerOwner {
  readonly owner: string;
  readonly candidates: number;
}

interface LedgerDisposition {
  id: string;
  readonly path: string;
  readonly owner: string;
  readonly key: string;
  status: string;
  disposition: string;
  note: string;
}

interface Ledger {
  readonly schemaVersion: number;
  readonly revision: string;
  readonly fingerprint: LedgerFingerprint;
  readonly counts: LedgerCounts;
  readonly owners: readonly LedgerOwner[];
  readonly dispositions: LedgerDisposition[];
}

interface AuditProblem {
  readonly category: string;
  readonly id: string;
  readonly message: string;
}

interface AuditResult {
  readonly command: string;
  readonly status: string;
  readonly counts: LedgerCounts;
  readonly dispositionRows: number;
  readonly problems: readonly AuditProblem[];
}

interface ProcessRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function createFixture(
  t: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "unused-type-members-audit-"));

  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  await writeFiles(root, files);
  return root;
}

async function writeFiles(root: string, files: Readonly<Record<string, string>>): Promise<void> {
  for (const [relativePath, text] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, text);
  }
}

function runProcess(script: string, args: readonly string[]): ProcessRun {
  const completed = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  return { status: completed.status ?? -1, stdout: completed.stdout, stderr: completed.stderr };
}

function runAudit(root: string, args: readonly string[]): ProcessRun {
  return runProcess(auditPath, [
    "--root",
    root,
    "--ledger",
    path.join(root, ledgerName),
    "--json",
    ...args,
  ]);
}

function parseAudit(stdout: string): AuditResult {
  return JSON.parse(stdout) as AuditResult;
}

function categoriesOf(result: AuditResult): string[] {
  return [...new Set(result.problems.map((problem) => problem.category))].sort();
}

function problemsOfCategory(result: AuditResult, category: string): AuditProblem[] {
  return result.problems.filter((problem) => problem.category === category);
}

/**
 * Reads the machine-readable ledger the audit embeds in its triage document.
 * The contract is the document's first fenced `json` block, which is what keeps
 * the artifact a readable markdown page and a checkable record at the same time.
 */
async function readLedger(root: string): Promise<Ledger> {
  const document = await readFile(path.join(root, ledgerName), "utf8");
  const block = /```json\n([\s\S]*?)\n```/u.exec(document);

  if (block?.[1] === undefined) {
    throw new Error(`The triage document at ${root} carries no ledger block`);
  }

  return JSON.parse(block[1]) as Ledger;
}

async function writeLedger(root: string, ledger: Ledger): Promise<void> {
  const ledgerPath = path.join(root, ledgerName);
  const document = await readFile(ledgerPath, "utf8");
  const replaced = document.replace(
    /```json\n[\s\S]*?\n```/u,
    `\`\`\`json\n${JSON.stringify(ledger, undefined, 2)}\n\`\`\``,
  );
  await writeFile(ledgerPath, replaced);
}

async function editLedger(root: string, edit: (ledger: Ledger) => void): Promise<void> {
  const ledger = await readLedger(root);
  edit(ledger);
  await writeLedger(root, ledger);
}

async function explainEvery(root: string, note: string): Promise<void> {
  await editLedger(root, (ledger) => {
    for (const row of ledger.dispositions) {
      row.disposition = "explained";
      row.note = note;
    }
  });
}

async function populationFixture(t: TestContext): Promise<string> {
  return createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: populationTypes,
    [testReadPath]: testOnlyRead,
  });
}

async function explainedFixture(t: TestContext): Promise<string> {
  return createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: explainedTypes,
    [testReadPath]: testOnlyRead,
  });
}

test("the inventory records every candidate and states it is not a clean verdict", async (t) => {
  // arrange
  const root = await populationFixture(t);

  // act
  const run = runAudit(root, ["--inventory"]);

  // assert
  assert.strictEqual(run.status, 0);
  const result = parseAudit(run.stdout);
  assert.strictEqual(result.command, "inventory");
  assert.strictEqual(result.status, "recorded");
  assert.deepStrictEqual(result.counts, {
    productionFiles: 1,
    candidates: 3,
    runtimeObserved: 1,
    testOnlyObserved: 1,
    explicitContract: 0,
    unread: 1,
    unsupportedAnalysis: 0,
  });
  assert.match(run.stderr, /This is an inventory, not a clean-gate verdict\./u);
});

test("the recorded ledger names the exact declarations that still need evidence", async (t) => {
  // arrange
  const root = await populationFixture(t);

  // act
  runAudit(root, ["--inventory"]);
  const ledger = await readLedger(root);

  // assert
  assert.deepStrictEqual(
    ledger.dispositions.map((row) => ({
      id: row.id,
      key: row.key,
      status: row.status,
      disposition: row.disposition,
    })),
    [
      { id: probeOnlyId, key: "probeOnly", status: "test-only-observed", disposition: "pending" },
      { id: neverReadId, key: "neverReadAnywhere", status: "unread", disposition: "pending" },
    ],
  );
  assert.strictEqual(
    ledger.dispositions.some((row) => row.id === gitOpsId),
    false,
  );
});

test("the owner groups account for every candidate the report holds", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: populationTypes,
    [testReadPath]: testOnlyRead,
    [foldPath]: unsupportedFold,
  });

  // act
  runAudit(root, ["--inventory"]);
  const ledger = await readLedger(root);

  // assert
  assert.deepStrictEqual(
    ledger.owners.map((owner) => owner.owner),
    ["domain", "edge"],
  );
  assert.strictEqual(
    ledger.owners.reduce((total, owner) => total + owner.candidates, 0),
    ledger.counts.candidates,
  );
  assert.strictEqual(ledger.counts.productionFiles, 2);
});

test("the check refuses an unread member the inventory happily recorded", async (t) => {
  // arrange
  const root = await populationFixture(t);
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "recorded during triage");

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  const result = parseAudit(run.stdout);
  assert.strictEqual(result.status, "problems");
  assert.deepStrictEqual(categoriesOf(result), ["unread"]);
  assert.deepStrictEqual(
    problemsOfCategory(result, "unread").map((problem) => problem.id),
    [neverReadId],
  );
});

test("the check refuses a member the analysis could not settle", async (t) => {
  // arrange
  const root = await createFixture(t, {
    "tsconfig.json": fixtureTsconfig,
    [typesPath]: explainedTypes,
    [testReadPath]: testOnlyRead,
    [foldPath]: unsupportedFold,
  });
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "recorded during triage");

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  const result = parseAudit(run.stdout);
  assert.deepStrictEqual(categoriesOf(result), ["unsupported"]);
  assert.deepStrictEqual(
    problemsOfCategory(result, "unsupported").map((problem) => problem.id),
    [foldedMaybeId],
  );
});

test("the check refuses a ledger that dropped a row it must account for", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "read by the probe case only");
  await editLedger(root, (ledger) => {
    ledger.dispositions.length = 0;
  });

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  const result = parseAudit(run.stdout);
  assert.deepStrictEqual(categoriesOf(result), ["missing"]);
  assert.deepStrictEqual(
    problemsOfCategory(result, "missing").map((problem) => problem.id),
    [probeOnlyId],
  );
});

test("the check refuses a ledger that names one declaration twice", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "read by the probe case only");
  await editLedger(root, (ledger) => {
    const [row] = ledger.dispositions;

    if (row === undefined) {
      throw new Error("The recorded ledger carries no disposition to duplicate");
    }

    ledger.dispositions.push({ ...row });
  });

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  const result = parseAudit(run.stdout);
  assert.deepStrictEqual(categoriesOf(result), ["duplicate"]);
  assert.deepStrictEqual(
    problemsOfCategory(result, "duplicate").map((problem) => problem.id),
    [probeOnlyId],
  );
});

test("the check refuses evidence recorded against source that has since moved", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "read by the probe case only");
  await writeFiles(root, { [typesPath]: `${explainedTypes}\n// a later edit\n` });

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  const result = parseAudit(run.stdout);
  assert.deepStrictEqual(categoriesOf(result), ["stale-source"]);
});

test("the check refuses a ledger row the current report no longer holds", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "read by the probe case only");
  await editLedger(root, (ledger) => {
    const [row] = ledger.dispositions;

    if (row === undefined) {
      throw new Error("The recorded ledger carries no disposition to copy");
    }

    ledger.dispositions.push({ ...row, id: `${typesPath}:99:3` });
  });

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  const result = parseAudit(run.stdout);
  assert.deepStrictEqual(categoriesOf(result), ["stale-record"]);
  assert.deepStrictEqual(
    problemsOfCategory(result, "stale-record").map((problem) => problem.id),
    [`${typesPath}:99:3`],
  );
});

test("the check refuses a candidate that appeared after the inventory was taken", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "read by the probe case only");
  await writeFiles(root, {
    [typesPath]: grownTypes.replace(
      "return deps.gitOps;",
      'return deps.gitOps + deps.neverReadAnywhere ?? "";',
    ),
    [testReadPath]: grownTestOnlyRead,
  });

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  const result = parseAudit(run.stdout);
  assert.deepStrictEqual(categoriesOf(result), ["missing", "stale-source"]);
  assert.deepStrictEqual(
    problemsOfCategory(result, "missing").map((problem) => problem.id),
    [grownLaterId],
  );
});

test("the check refuses a disposition nobody has explained yet", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  const result = parseAudit(run.stdout);
  assert.deepStrictEqual(categoriesOf(result), ["incomplete"]);
  assert.deepStrictEqual(
    problemsOfCategory(result, "incomplete").map((problem) => problem.id),
    [probeOnlyId],
  );
});

test("the check refuses an explanation that carries no evidence at all", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await editLedger(root, (ledger) => {
    for (const row of ledger.dispositions) {
      row.disposition = "explained";
      row.note = "   ";
    }
  });

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(categoriesOf(parseAudit(run.stdout)), ["incomplete"]);
});

test("the check refuses a disposition outside the vocabulary it accepts", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await editLedger(root, (ledger) => {
    for (const row of ledger.dispositions) {
      row.disposition = "waived";
      row.note = "upstream compatibility";
    }
  });

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(categoriesOf(parseAudit(run.stdout)), ["invalid"]);
});

test("the check refuses a recorded status that no longer matches the report", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "read by the probe case only");
  await editLedger(root, (ledger) => {
    for (const row of ledger.dispositions) {
      row.status = "explicit-contract";
    }
  });

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 1);
  assert.deepStrictEqual(categoriesOf(parseAudit(run.stdout)), ["stale-record"]);
});

test("the check accepts the fully explained counterpart", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "read by the probe case only");

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 0);
  const result = parseAudit(run.stdout);
  assert.strictEqual(result.status, "satisfied");
  assert.deepStrictEqual(result.problems, []);
  assert.strictEqual(result.dispositionRows, 1);
  assert.strictEqual(result.counts.unread, 0);
  assert.strictEqual(result.counts.unsupportedAnalysis, 0);
});

test("the audit reports the gate's verdict and never changes it", async (t) => {
  // arrange
  const root = await populationFixture(t);
  const before = runProcess(gatePath, ["--root", root, "--json"]);
  runAudit(root, ["--inventory"]);

  // act
  runAudit(root, ["--check"]);
  const after = runProcess(gatePath, ["--root", root, "--json"]);

  // assert
  assert.strictEqual(before.status, 1);
  assert.strictEqual(after.status, 1);
  assert.strictEqual(after.stdout, before.stdout);
});

test("the fingerprint follows the analysed source and ignores everything else", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  runAudit(root, ["--inventory"]);
  await explainEvery(root, "read by the probe case only");
  await writeFiles(root, { "README.md": "# not analysed\n" });

  // act
  const unrelated = runAudit(root, ["--check"]);
  await writeFiles(root, { [testReadPath]: `${testOnlyRead}\n// a later edit\n` });
  const analysed = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(unrelated.status, 0);
  assert.strictEqual(analysed.status, 1);
  assert.deepStrictEqual(categoriesOf(parseAudit(analysed.stdout)), ["stale-source"]);
});

test("a missing triage document is a setup failure, not a clean audit", async (t) => {
  // arrange
  const root = await explainedFixture(t);

  // act
  const run = runAudit(root, ["--check"]);

  // assert
  assert.strictEqual(run.status, 2);
  assert.strictEqual(run.stdout, "");
});

test("naming neither command is a setup failure", async (t) => {
  // arrange
  const root = await explainedFixture(t);

  // act
  const run = runAudit(root, []);

  // assert
  assert.strictEqual(run.status, 2);
  assert.match(run.stderr, /--inventory|--check/u);
});

test("importing the audit module does not run it", async (t) => {
  // arrange
  const root = await explainedFixture(t);
  const importerPath = path.join(root, "importer.mjs");
  await writeFile(
    importerPath,
    `import ${JSON.stringify(auditPath)};\nprocess.stdout.write("inert");\n`,
  );

  // act
  const run = runProcess(importerPath, []);

  // assert
  assert.strictEqual(run.status, 0);
  assert.strictEqual(run.stdout, "inert");
});

test("the package exposes the audit as a real executable entry", async () => {
  // arrange
  const manifest = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    readonly scripts: Readonly<Record<string, string>>;
  };

  // act
  const alias = manifest.scripts["lint:type-members:audit"];

  // assert
  assert.strictEqual(alias, "node scripts/check-unused-type-members.audit.mjs --check");
  assert.strictEqual(manifest.scripts.check?.includes("lint:type-members:audit"), false);
});
