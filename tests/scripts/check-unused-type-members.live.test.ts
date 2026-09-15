import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { TestContext } from "node:test";

// Regression controls for analyzer gaps found by reconciling the live
// population of this repository. Each case is a reduced, independently written
// fixture of a shape that really occurs in `extensions/pi-claude-marketplace/`,
// paired with a sibling or unrelated declaration that must stay unread. The
// live enumeration itself is never pasted in as an expectation: a fixture that
// only repeats what the analyzer currently reports proves nothing.
//
// The analyzer is a `.mjs` module, so it is loaded through a runtime specifier
// and read through the explicit interface below.

const analysisModuleUrl = new URL(
  "../../scripts/check-unused-type-members.analysis.mjs",
  import.meta.url,
).href;

interface WitnessSite {
  readonly path: string;
  readonly line: number;
  readonly column: number;
}

interface Witness extends WitnessSite {
  readonly kind: string;
  readonly origin: string;
  readonly syntax: string;
  readonly via?: WitnessSite;
}

interface MemberRecord {
  readonly id: string;
  readonly owner: string;
  readonly key: string;
  readonly status: string;
  readonly witnesses: readonly Witness[];
}

interface GateReport {
  readonly members: readonly MemberRecord[];
  readonly findings: readonly MemberRecord[];
}

interface AnalysisModule {
  analyzeProject(options: { readonly root: string }): GateReport;
}

const analysis = (await import(analysisModuleUrl)) as unknown as AnalysisModule;

const fixtureTsconfig = `${JSON.stringify(
  {
    compilerOptions: {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      noEmit: true,
      strict: true,
      target: "ES2022",
      lib: ["ES2022"],
      types: [],
    },
    include: ["extensions/**/*.ts", "tests/**/*.ts"],
  },
  undefined,
  2,
)}\n`;

const casesPath = "extensions/pi-claude-marketplace/cases.ts";

async function createRoot(
  t: TestContext,
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "unused-type-members-live-"));

  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });

  for (const [relativePath, text] of Object.entries({
    "tsconfig.json": fixtureTsconfig,
    ...files,
  })) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, text);
  }

  return root;
}

async function analyze(t: TestContext, production: string): Promise<GateReport> {
  const root = await createRoot(t, { [casesPath]: production });
  return analysis.analyzeProject({ root });
}

function memberFor(report: GateReport, owner: string, key: string): MemberRecord {
  const member = report.members.find((entry) => entry.owner === owner && entry.key === key);

  if (member === undefined) {
    throw new Error(`No candidate was inventoried for ${owner}.${key}`);
  }

  return member;
}

function statusFor(report: GateReport, owner: string, key: string): string {
  return memberFor(report, owner, key).status;
}

function witnessShapesFor(report: GateReport, owner: string, key: string): readonly string[] {
  return memberFor(report, owner, key).witnesses.map(
    (witness) => `${witness.kind}/${witness.syntax}/${witness.origin}`,
  );
}

// ──────────────────────────────────────────────────────────────────────────
// An async relay that hands back another promise
// ──────────────────────────────────────────────────────────────────────────

// Reduced from `orchestrators/plugin/reinstall-targets.ts`, where
// `resolveMarketplaceScope` is an async function whose body is
// `return resolvePluginMarketplaceScope(...)`, and from
// `orchestrators/marketplace/remove.ts`, where `resolveRemoveTargetOrSurface`
// relays `resolveScopeOrFailedOutcome(...)` the same way. A caller awaits the
// outer call and reads one member; the value it reads was produced under the
// inner annotation, so the inner annotation's member is read at run time.
//
// Line 21 holds the only property access and line 16 the relayed call, which
// is the source expression that carried the value into the outer result.
const asyncRelayCases = `export interface Inner {
  readonly relayed: string;
  readonly untouched: string;
}

export interface Outer {
  readonly relayed: string;
  readonly untouched: string;
}

async function inner(): Promise<Inner> {
  return { relayed: "value", untouched: "other" };
}

async function outer(): Promise<Outer> {
  return inner();
}

export async function reader(): Promise<string> {
  const held = await outer();
  return held.relayed;
}
`;

test("an async relay credits the member on the annotation that produced the value", async (t) => {
  // arrange
  const report = await analyze(t, asyncRelayCases);

  // act & assert
  assert.deepStrictEqual(memberFor(report, "Inner", "relayed").witnesses, [
    {
      path: casesPath,
      line: 21,
      column: 15,
      kind: "value-read",
      origin: "production",
      syntax: "value-transfer",
      via: { path: casesPath, line: 16, column: 10 },
    },
  ]);
  assert.strictEqual(statusFor(report, "Inner", "relayed"), "runtime-observed");
});

test("the relayed annotation keeps its own direct witness", async (t) => {
  // arrange
  const report = await analyze(t, asyncRelayCases);

  // act & assert
  assert.deepStrictEqual(memberFor(report, "Outer", "relayed").witnesses, [
    {
      path: casesPath,
      line: 21,
      column: 15,
      kind: "value-read",
      origin: "production",
      syntax: "property-access",
    },
  ]);
});

test("an async relay credits no sibling of the member that was read", async (t) => {
  // arrange
  const report = await analyze(t, asyncRelayCases);

  // act & assert
  assert.deepStrictEqual(witnessShapesFor(report, "Inner", "untouched"), []);
  assert.strictEqual(statusFor(report, "Inner", "untouched"), "unread");
  assert.deepStrictEqual(witnessShapesFor(report, "Outer", "untouched"), []);
  assert.strictEqual(statusFor(report, "Outer", "untouched"), "unread");
});

// A same-spelling declaration no relay ever hands back must stay unread, so the
// relay credit cannot be coming from the key's spelling.
const unrelatedRelayCases = `export interface Handed {
  readonly relayed: string;
}

export interface NeverHanded {
  readonly relayed: string;
}

async function source(): Promise<Handed> {
  return { relayed: "value" };
}

async function relay(): Promise<Handed> {
  return source();
}

export async function reader(): Promise<string> {
  const held = await relay();
  return held.relayed;
}
`;

test("a same-spelling declaration outside the relay chain earns nothing", async (t) => {
  // arrange
  const report = await analyze(t, unrelatedRelayCases);

  // act & assert
  assert.strictEqual(statusFor(report, "Handed", "relayed"), "runtime-observed");
  assert.deepStrictEqual(witnessShapesFor(report, "NeverHanded", "relayed"), []);
  assert.strictEqual(statusFor(report, "NeverHanded", "relayed"), "unread");
});

// A synchronous body that relays a promise was never placed at the awaited
// position, so this case states the behaviour the fix must leave alone.
const syncRelayCases = `export interface Produced {
  readonly carried: string;
  readonly dropped: string;
}

async function produce(): Promise<Produced> {
  return { carried: "value", dropped: "other" };
}

function relay(): Promise<Produced> {
  return produce();
}

export async function reader(): Promise<string> {
  const held = await relay();
  return held.carried;
}
`;

test("a synchronous relay of a promise still credits the produced member", async (t) => {
  // arrange
  const report = await analyze(t, syncRelayCases);

  // act & assert
  assert.strictEqual(statusFor(report, "Produced", "carried"), "runtime-observed");
  assert.strictEqual(statusFor(report, "Produced", "dropped"), "unread");
});

// An async body handing back a plain object must keep sitting at the awaited
// position: losing that would make every ordinary async return unreachable.
const plainAsyncCases = `export interface Direct {
  readonly carried: string;
  readonly dropped: string;
}

async function produce(): Promise<Direct> {
  return { carried: "value", dropped: "other" };
}

export async function reader(): Promise<string> {
  const held = await produce();
  return held.carried;
}
`;

test("an async body handing back a plain object still sits at the awaited position", async (t) => {
  // arrange
  const report = await analyze(t, plainAsyncCases);

  // act & assert
  assert.strictEqual(statusFor(report, "Direct", "carried"), "runtime-observed");
  assert.strictEqual(statusFor(report, "Direct", "dropped"), "unread");
});

// A relay chain two hops deep, with a distinct annotation at every hop. Each
// hop's own member is read, and each hop's sibling is not.
const deepRelayCases = `export interface Deepest {
  readonly passed: string;
  readonly held: string;
}

export interface Middle {
  readonly passed: string;
  readonly held: string;
}

export interface Surface {
  readonly passed: string;
  readonly held: string;
}

async function deepest(): Promise<Deepest> {
  return { passed: "value", held: "other" };
}

async function middle(): Promise<Middle> {
  return deepest();
}

async function surface(): Promise<Surface> {
  return middle();
}

export async function reader(): Promise<string> {
  const held = await surface();
  return held.passed;
}
`;

test("every hop of a relay chain is credited for the member that flowed through it", async (t) => {
  // arrange
  const report = await analyze(t, deepRelayCases);

  // act & assert
  assert.strictEqual(statusFor(report, "Surface", "passed"), "runtime-observed");
  assert.strictEqual(statusFor(report, "Middle", "passed"), "runtime-observed");
  assert.strictEqual(statusFor(report, "Deepest", "passed"), "runtime-observed");
  assert.deepStrictEqual(
    report.findings.map((finding) => `${finding.owner}.${finding.key}`).sort(),
    ["Deepest.held", "Middle.held", "Surface.held"],
  );
});

// ──────────────────────────────────────────────────────────────────────────
// A relay whose result is a union of a success shape and a failure shape
// ──────────────────────────────────────────────────────────────────────────

// Reduced from `orchestrators/marketplace/remove.ts`, where
// `resolveRemoveTargetOrSurface` relays `resolveScopeOrFailedOutcome` and the
// caller destructures the success arm after an `in` guard. Only one arm of the
// union declares the key, so the value that was read can only have come from
// that arm: there is nothing for the credit to be ambiguous between.
const uniqueArmCases = `export interface Failure {
  readonly status: "failed";
  readonly cause: string;
}

async function decide(ok: boolean): Promise<{ readonly picked: string; readonly spare: string } | Failure> {
  if (ok) {
    return { picked: "value", spare: "other" };
  }

  return { status: "failed", cause: "no" };
}

async function relay(ok: boolean): Promise<{ readonly picked: string; readonly spare: string } | Failure> {
  return decide(ok);
}

export async function reader(ok: boolean): Promise<string> {
  const held = await relay(ok);

  if ("status" in held) {
    return held.cause;
  }

  const { picked } = held;
  return picked;
}
`;

test("a read through a union relay credits the only arm that declares the key", async (t) => {
  // arrange
  const report = await analyze(t, uniqueArmCases);

  // act & assert
  assert.strictEqual(statusFor(report, "relay", "picked"), "runtime-observed");
  assert.strictEqual(statusFor(report, "decide", "picked"), "runtime-observed");
});

test("a union relay credits no sibling of the member that was read", async (t) => {
  // arrange
  const report = await analyze(t, uniqueArmCases);

  // act & assert
  assert.deepStrictEqual(witnessShapesFor(report, "decide", "spare"), []);
  assert.strictEqual(statusFor(report, "decide", "spare"), "unread");
  assert.deepStrictEqual(witnessShapesFor(report, "relay", "spare"), []);
  assert.strictEqual(statusFor(report, "relay", "spare"), "unread");
});

// Two arms spelling the same key leave it unsettled which one supplied the
// value, so neither is credited. Under-crediting is the safe direction: a
// member stays a finding rather than being excused by its neighbour.
const ambiguousArmCases = `export interface Absent {
  readonly missing: string;
}

async function decide(pick: number): Promise<Absent | { readonly shared: string } | { readonly shared: number; readonly spare: string }> {
  if (pick === 0) {
    return { missing: "none" };
  }

  if (pick === 1) {
    return { shared: "text" };
  }

  return { shared: 2, spare: "other" };
}

async function relay(pick: number): Promise<Absent | { readonly shared: string } | { readonly shared: number; readonly spare: string }> {
  return decide(pick);
}

export async function reader(pick: number): Promise<string> {
  const held = await relay(pick);

  if (!("shared" in held)) {
    return held.missing;
  }

  return String(held.shared);
}
`;

test("two arms spelling one key leave both uncredited through the relay", async (t) => {
  // arrange
  const report = await analyze(t, ambiguousArmCases);

  // act & assert
  assert.strictEqual(statusFor(report, "decide", "shared"), "unread");
  assert.strictEqual(statusFor(report, "decide", "spare"), "unread");
  assert.strictEqual(statusFor(report, "Absent", "missing"), "runtime-observed");
});
