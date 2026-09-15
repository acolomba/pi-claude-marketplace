import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { TestContext } from "node:test";

// The model is a `.mjs` module, so it is loaded through a runtime specifier and
// read through the explicit interface below. That interface is the test-facing
// contract: the compiler cannot check a `.mjs` import, so the shape the cases
// rely on is written out here instead of being assumed.

const modelModuleUrl = new URL("../../scripts/check-unused-type-members.model.mjs", import.meta.url)
  .href;

interface Candidate {
  readonly id: string;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly owner: string;
  readonly key: string;
  readonly keyKind: string;
  readonly optional: boolean;
  readonly category: string;
}

interface Witness {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly kind: string;
  readonly origin: string;
  readonly syntax: string;
}

interface ProjectProgram {
  readonly program: unknown;
  readonly checker: unknown;
  readonly projectRoot: string;
}

interface CandidateInventory {
  readonly candidates: readonly Candidate[];
  readonly byDeclaration: unknown;
}

interface ObservationResult {
  readonly witnesses: ReadonlyMap<string, readonly Witness[]>;
  readonly unsupported: ReadonlyMap<string, readonly string[]>;
}

interface ModelModule {
  createProjectProgram(options: { readonly root: string }): ProjectProgram;
  collectCandidates(input: ProjectProgram): CandidateInventory;
  collectObservations(
    input: ProjectProgram & { readonly byDeclaration: unknown },
  ): ObservationResult;
}

const model = (await import(modelModuleUrl)) as unknown as ModelModule;

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

const casesPath = "extensions/pi-claude-marketplace/cases.ts";
const testCasesPath = "tests/cases.test.ts";

interface Inspection {
  readonly candidates: readonly Candidate[];
  readonly witnesses: ReadonlyMap<string, readonly Witness[]>;
  readonly unsupported: ReadonlyMap<string, readonly string[]>;
}

async function inspect(t: TestContext, production: string, testText?: string): Promise<Inspection> {
  const root = await mkdtemp(path.join(tmpdir(), "unused-type-members-model-"));

  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  const files: Record<string, string> = {
    "tsconfig.json": fixtureTsconfig,
    [casesPath]: production,
  };

  if (testText !== undefined) {
    files[testCasesPath] = testText;
  }

  for (const [relativePath, text] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, text);
  }

  const project = model.createProjectProgram({ root });
  const { candidates, byDeclaration } = model.collectCandidates(project);
  const { witnesses, unsupported } = model.collectObservations({ ...project, byDeclaration });
  return { candidates, witnesses, unsupported };
}

function idFor(inspection: Inspection, owner: string, key: string): string {
  const candidate = inspection.candidates.find(
    (entry) => entry.owner === owner && entry.key === key,
  );

  if (candidate === undefined) {
    throw new Error(`No candidate was inventoried for ${owner}.${key}`);
  }

  return candidate.id;
}

function witnessesFor(inspection: Inspection, owner: string, key: string): readonly Witness[] {
  return inspection.witnesses.get(idFor(inspection, owner, key)) ?? [];
}

/** The classification of every observation of one member, in the order they were found. */
function shapesFor(inspection: Inspection, owner: string, key: string): readonly string[] {
  return witnessesFor(inspection, owner, key).map(
    (witness) => `${witness.kind}/${witness.syntax}/${witness.origin}`,
  );
}

function gapsFor(inspection: Inspection, owner: string, key: string): readonly string[] {
  return inspection.unsupported.get(idFor(inspection, owner, key)) ?? [];
}

test("a same-spelling member on an unrelated type earns no witness", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Kept {
  readonly shared: string;
}

export interface Other {
  readonly shared?: string;
}

export function readKept(kept: Kept): string {
  return kept.shared;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Kept", "shared"), [
    "value-read/property-access/production",
  ]);
  assert.deepStrictEqual(shapesFor(inspection, "Other", "shared"), []);
});

test("indexed-access types, keyof and type queries read nothing", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Shape {
  readonly named?: string;
}

export type Named = Shape["named"];
export type Keys = keyof Shape;
export const shape: Shape = {};
export type ShapeOf = typeof shape;

export function use(named: Named, keys: Keys, other: ShapeOf): unknown {
  return [named, keys, other];
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Shape", "named"), []);
});

test("binding destructuring reads the source member through renames, defaults and nesting", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Source {
  readonly plain: string;
  readonly renamed: string;
  readonly withDefault?: string;
  readonly nested: { readonly inner: string };
}

export function pull(source: Source): string {
  const { plain, renamed: local, withDefault = "", nested: { inner } } = source;
  return plain + local + withDefault + inner;
}
`,
  );

  // act & assert
  for (const key of ["plain", "renamed", "withDefault", "nested"]) {
    assert.deepStrictEqual(shapesFor(inspection, "Source", key), [
      "value-read/binding-destructuring/production",
    ]);
  }

  assert.deepStrictEqual(witnessesFor(inspection, "Source.nested", "inner"), [
    {
      path: casesPath,
      line: 9,
      column: 62,
      kind: "value-read",
      origin: "production",
      syntax: "binding-destructuring",
    },
  ]);
});

test("assignment destructuring reads the source member", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Target {
  readonly picked: string;
  readonly ignored?: string;
}

export function assign(target: Target): string {
  let picked = "";
  ({ picked } = target);
  return picked;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Target", "picked"), [
    "value-read/assignment-destructuring/production",
  ]);
  assert.deepStrictEqual(shapesFor(inspection, "Target", "ignored"), []);
});

test("a simple write and a delete are not reads", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Mutable {
  written: string;
  removed?: string;
}

export function mutate(mutable: Mutable): void {
  mutable.written = "x";
  delete mutable.removed;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Mutable", "written"), []);
  assert.deepStrictEqual(shapesFor(inspection, "Mutable", "removed"), []);
});

test("compound assignment and update expressions keep the read of the old value", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Counter {
  total: number;
  label: string;
}

export function bump(counter: Counter): void {
  counter.total += 1;
  counter.label ||= "x";
  counter.total++;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Counter", "total"), [
    "value-read/compound-assignment/production",
    "value-read/update-expression/production",
  ]);
  assert.deepStrictEqual(shapesFor(inspection, "Counter", "label"), [
    "value-read/compound-assignment/production",
  ]);
});

test("writing a nested member still reads the receiver that holds it", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Outer {
  readonly inner: { value: string };
}

export function write(outer: Outer): void {
  outer.inner.value = "x";
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Outer", "inner"), [
    "value-read/property-access/production",
  ]);
  assert.deepStrictEqual(shapesFor(inspection, "Outer.inner", "value"), []);
});

test("literal and finite-union element access read the exact members they can reach", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Keyed {
  readonly first: string;
  readonly second: string;
  readonly third: string;
  readonly fourth?: string;
}

export function pick(keyed: Keyed, key: "first" | "second"): string {
  return keyed["third"] + keyed[key];
}
`,
  );

  // act & assert
  assert.deepStrictEqual(witnessesFor(inspection, "Keyed", "third"), [
    {
      path: casesPath,
      line: 9,
      column: 16,
      kind: "value-read",
      origin: "production",
      syntax: "element-access",
    },
  ]);
  assert.deepStrictEqual(shapesFor(inspection, "Keyed", "first"), [
    "value-read/element-access/production",
  ]);
  assert.deepStrictEqual(shapesFor(inspection, "Keyed", "second"), [
    "value-read/element-access/production",
  ]);
  assert.deepStrictEqual(shapesFor(inspection, "Keyed", "fourth"), []);
});

test("an unbounded computed key is an analysis gap for its own type only", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Dynamic {
  readonly one: string;
  readonly two: string;
}

export interface Untouched {
  readonly alone?: string;
}

export function read(dynamic: Dynamic & Record<string, string>, key: string): string {
  return dynamic[key];
}
`,
  );

  // act & assert
  assert.deepStrictEqual(gapsFor(inspection, "Dynamic", "one"), ["unbounded-computed-access"]);
  assert.deepStrictEqual(gapsFor(inspection, "Dynamic", "two"), ["unbounded-computed-access"]);
  assert.deepStrictEqual(gapsFor(inspection, "Untouched", "alone"), []);
  assert.deepStrictEqual(shapesFor(inspection, "Dynamic", "one"), []);
});

test("an exact existence test is a presence observation, not a value read", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Probe {
  readonly present?: string;
  readonly absent?: string;
}

export function has(probe: Probe): boolean {
  return "present" in probe;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Probe", "present"), [
    "presence/presence-test/production",
  ]);
  assert.deepStrictEqual(shapesFor(inspection, "Probe", "absent"), []);
});

test("key enumeration alone observes no member", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Listed {
  readonly one?: string;
  readonly two?: string;
}

export function listKeys(listed: Listed): string[] {
  return Object.keys(listed);
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Listed", "one"), []);
  assert.deepStrictEqual(shapesFor(inspection, "Listed", "two"), []);
});

test("an object initializer writes its destination and reads nothing of it", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Built {
  readonly made: string;
  readonly spelled?: string;
}

export function build(made: string, spelled: string): Built {
  return { made, spelled };
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Built", "made"), []);
  assert.deepStrictEqual(shapesFor(inspection, "Built", "spelled"), []);
});

test("the value operand of satisfies is traversed and its type operand is not", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Cast {
  readonly carried: string;
  readonly onlyTyped?: string;
}

export type CastKey = Cast["onlyTyped"];

export function cast(value: Cast): string {
  return (value satisfies Cast).carried as string;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Cast", "carried"), [
    "value-read/property-access/production",
  ]);
  assert.deepStrictEqual(shapesFor(inspection, "Cast", "onlyTyped"), []);
});

test("a test source contributes observations and never candidates", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `export interface Exported {
  readonly seen: string;
}
`,
    `import type { Exported } from "../extensions/pi-claude-marketplace/cases.ts";

interface TestLocal {
  readonly private: string;
}

export function readBoth(exported: Exported, local: TestLocal): string {
  return exported.seen + local.private;
}
`,
  );

  // act & assert
  assert.deepStrictEqual(shapesFor(inspection, "Exported", "seen"), [
    "value-read/property-access/test",
  ]);
  assert.deepStrictEqual(
    inspection.candidates.map((candidate) => `${candidate.owner}.${candidate.key}`),
    ["Exported.seen"],
  );
});

test("inventories type literals, methods, unique-symbol keys and anonymous shapes", async (t) => {
  // arrange
  const inspection = await inspect(
    t,
    `declare const brandKey: unique symbol;

export interface Branded {
  readonly [brandKey]: true;
  readonly plain: string;
}

export type Options = {
  readonly flag?: boolean;
  run(): void;
};

export function accept(input: { readonly passed: string }): { readonly returned: string } {
  return { returned: input.passed };
}
`,
  );

  // act & assert
  assert.deepStrictEqual(
    inspection.candidates.map((candidate) => ({
      owner: candidate.owner,
      key: candidate.key,
      keyKind: candidate.keyKind,
      optional: candidate.optional,
      category: candidate.category,
    })),
    [
      {
        owner: "Branded",
        key: "brandKey",
        keyKind: "unique-symbol",
        optional: false,
        category: "interface-member",
      },
      {
        owner: "Branded",
        key: "plain",
        keyKind: "literal",
        optional: false,
        category: "interface-member",
      },
      {
        owner: "Options",
        key: "flag",
        keyKind: "literal",
        optional: true,
        category: "type-literal-member",
      },
      {
        owner: "Options",
        key: "run",
        keyKind: "literal",
        optional: false,
        category: "type-literal-method",
      },
      {
        owner: "accept.input",
        key: "passed",
        keyKind: "literal",
        optional: false,
        category: "type-literal-member",
      },
      {
        owner: "accept",
        key: "returned",
        keyKind: "literal",
        optional: false,
        category: "type-literal-member",
      },
    ],
  );
});
