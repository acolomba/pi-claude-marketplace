import path from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { NOTIFICATION_PAYLOAD_SCHEMA } from "../extensions/pi-claude-marketplace/shared/notification-wire.ts";

/**
 * The schema document core (WIRE-09, D-03, D-11). `generate-wire-schema.mjs`
 * writes the document it builds, and the drift test compares the committed
 * file against a fresh build. Node strips the types of the wire module, so the
 * typebox union is the single source of the document.
 */

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/** The committed schema file, relative to the project root. */
export const WIRE_SCHEMA_PATH = "schema/claude-plugin.schema.json";

/**
 * Builds the JSON Schema document of every notification payload kind. The
 * union is cloned through JSON, so the document is plain data whatever typebox
 * attaches to its schema values. The title and description stay plain ASCII,
 * because the pre-commit text fixers rewrite typographic punctuation.
 */
export function buildWireSchemaDocument() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "claude-plugin session-entry notification payload",
    description:
      "One union of notification payloads, discriminated by kind and versioned by the integer schemaVersion.",
    ...JSON.parse(JSON.stringify(NOTIFICATION_PAYLOAD_SCHEMA)),
  };
}

/**
 * Formats `document` the way `format:check` expects the committed file, using
 * the Prettier configuration that applies to that file.
 */
export async function formatWireSchemaDocument(document) {
  const filepath = path.join(projectRoot, WIRE_SCHEMA_PATH);
  const options = await resolveConfig(filepath);
  return format(JSON.stringify(document), { ...options, filepath });
}
