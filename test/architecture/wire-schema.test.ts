import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// The schema core is a `.mjs` module, so it is loaded through a runtime
// specifier and read through the explicit interface below. The compiler
// cannot check a `.mjs` import, so the shape these cases rely on is written
// out here instead of being assumed.

interface WireSchemaModule {
  readonly WIRE_SCHEMA_PATH: string;
  buildWireSchemaDocument(): Record<string, unknown>;
  formatWireSchemaDocument(document: Record<string, unknown>): Promise<string>;
}

interface PayloadMember {
  readonly required: readonly string[];
  readonly properties: {
    readonly kind: { readonly const: string };
    readonly schemaVersion: { readonly const: number };
  };
}

interface WireSchemaDocument {
  readonly $schema: string;
  readonly anyOf: readonly PayloadMember[];
}

interface PackageManifest {
  readonly files: readonly string[];
}

const wireSchemaModuleUrl = new URL("../../scripts/wire-schema.mjs", import.meta.url).href;
const wireSchema = (await import(wireSchemaModuleUrl)) as unknown as WireSchemaModule;
const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

async function committedSchemaText(): Promise<string> {
  return readFile(path.join(projectRoot, wireSchema.WIRE_SCHEMA_PATH), "utf8");
}

async function committedSchemaDocument(): Promise<WireSchemaDocument> {
  return JSON.parse(await committedSchemaText()) as WireSchemaDocument;
}

/** D-11: the committed document must deep-equal a fresh build after a JSON round trip. */
function assertMatchesSource(committed: unknown, built: Record<string, unknown>): void {
  assert.deepStrictEqual(committed, JSON.parse(JSON.stringify(built)));
}

test("the committed schema deep-equals a fresh build of the typebox union", async () => {
  // arrange
  const committed = await committedSchemaDocument();

  // act
  const built = wireSchema.buildWireSchemaDocument();

  // assert
  assertMatchesSource(committed, built);
});

test("building and formatting twice yields the committed bytes both times", async () => {
  // arrange
  const committedText = await committedSchemaText();

  // act
  const first = await wireSchema.formatWireSchemaDocument(wireSchema.buildWireSchemaDocument());
  const second = await wireSchema.formatWireSchemaDocument(wireSchema.buildWireSchemaDocument());

  // assert
  assert.strictEqual(first, second);
  assert.strictEqual(first, committedText);
});

test("the committed schema lists each payload kind in declared order with schemaVersion 1", async () => {
  // arrange
  const committed = await committedSchemaDocument();

  // act
  const members = committed.anyOf.map((member) => ({
    kind: member.properties.kind.const,
    schemaVersion: member.properties.schemaVersion.const,
  }));

  // assert
  assert.strictEqual(committed.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepStrictEqual(members, [
    { kind: "cascade", schemaVersion: 1 },
    { kind: "reconcile-applied-cascade", schemaVersion: 1 },
    { kind: "marketplace-info", schemaVersion: 1 },
    { kind: "plugin-info", schemaVersion: 1 },
    { kind: "marketplace-info-cascade", schemaVersion: 1 },
    { kind: "plugin-info-cascade", schemaVersion: 1 },
    { kind: "marketplace-not-added", schemaVersion: 1 },
    { kind: "reconcile-pending-empty", schemaVersion: 1 },
    { kind: "prune-empty", schemaVersion: 1 },
    { kind: "prune-committed-warning", schemaVersion: 1 },
    { kind: "usage-error", schemaVersion: 1 },
    { kind: "usage-info", schemaVersion: 1 },
    { kind: "autoapply-status", schemaVersion: 1 },
    { kind: "diagnostic", schemaVersion: 1 },
    { kind: "device-flow-prompt", schemaVersion: 1 },
    { kind: "async-rewake-summary", schemaVersion: 1 },
    { kind: "stop-override-cap", schemaVersion: 1 },
    { kind: "reconcile-aborted", schemaVersion: 1 },
    { kind: "plugin-path-skipped", schemaVersion: 1 },
    { kind: "mcp-config-notices", schemaVersion: 1 },
    { kind: "mcp-migration", schemaVersion: 1 },
    { kind: "internal-error", schemaVersion: 1 },
  ]);
});

test("the committed schema has exactly 22 payload members", async () => {
  // arrange
  const committed = await committedSchemaDocument();

  // act
  const memberCount = committed.anyOf.length;

  // assert
  assert.strictEqual(memberCount, 22);
});

test("a committed schema missing one payload kind fails the drift comparison", async () => {
  // arrange
  const committed = await committedSchemaDocument();
  const planted = { ...committed, anyOf: committed.anyOf.slice(1) };
  const built = wireSchema.buildWireSchemaDocument();

  // act & assert
  assert.throws(() => {
    assertMatchesSource(planted, built);
  }, assert.AssertionError);
});

for (const field of ["origin", "severity", "needsReload"] as const) {
  test(`the committed schema requires ${field} on all kinds and detects its removal`, async () => {
    // arrange
    const committed = await committedSchemaDocument();
    const built = wireSchema.buildWireSchemaDocument();

    // act
    const missing = committed.anyOf.filter((member) => !member.required.includes(field));
    const planted = {
      ...committed,
      anyOf: committed.anyOf.map((member) => ({
        ...member,
        required: member.required.filter((key) => key !== field),
      })),
    };

    // assert
    assert.deepStrictEqual(missing, []);
    assert.throws(() => {
      assertMatchesSource(planted, built);
    }, assert.AssertionError);
  });
}

test("package.json files lists the committed schema", async () => {
  // arrange
  const manifestText = await readFile(path.join(projectRoot, "package.json"), "utf8");

  // act
  const manifest = JSON.parse(manifestText) as PackageManifest;

  // assert
  assert.ok(
    manifest.files.includes(wireSchema.WIRE_SCHEMA_PATH),
    `files: ${JSON.stringify(manifest.files)}`,
  );
});
