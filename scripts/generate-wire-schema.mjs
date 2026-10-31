import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildWireSchemaDocument,
  formatWireSchemaDocument,
  WIRE_SCHEMA_PATH,
} from "./wire-schema.mjs";

/**
 * Writes the committed JSON Schema of every notification payload kind
 * (WIRE-09, D-03). Run it through `npm run schema:generate` after any change to
 * the wire schema; the drift test fails until the committed file matches.
 */

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

async function main() {
  const schemaPath = path.join(projectRoot, WIRE_SCHEMA_PATH);
  const text = await formatWireSchemaDocument(buildWireSchemaDocument());
  mkdirSync(path.dirname(schemaPath), { recursive: true });
  writeFileSync(schemaPath, text, "utf8");
  process.stdout.write(`Wrote ${WIRE_SCHEMA_PATH}\n`);
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
