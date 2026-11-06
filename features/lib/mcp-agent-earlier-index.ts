/**
 * @fileoverview Rewrites an agents index as a release before MGRT-01 wrote
 * it: no row records the grant form its agent file holds or the forms of
 * each MCP implementation. The agent files stay as they are.
 */

import { readFile, rename, writeFile } from "node:fs/promises";

// The row fields MGRT-01 added to the agents index.
const AGENT_GRANT_FORM_FIELDS: ReadonlySet<string> = new Set(["mcpImplementation", "mcpForms"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The agents index `indexFile` holds, with its rows as JSON objects, throwing
// when the file is not an agents index.
async function readIndex(indexFile: string): Promise<{
  readonly document: Record<string, unknown>;
  readonly rows: readonly Record<string, unknown>[];
}> {
  const document: unknown = JSON.parse(await readFile(indexFile, "utf8"));
  if (!isRecord(document) || !Array.isArray(document.agents)) {
    throw new Error(`${indexFile} is not an agents index`);
  }

  const rows = document.agents.map((row: unknown) => {
    if (!isRecord(row)) {
      throw new Error(`${indexFile} holds a row that is not a JSON object`);
    }

    return row;
  });
  return { document, rows };
}

/** The rows of the agents index at `indexFile`, each as a JSON object. */
export async function readAgentIndexRows(
  indexFile: string,
): Promise<readonly Record<string, unknown>[]> {
  return (await readIndex(indexFile)).rows;
}

/** Whether `row` holds a field MGRT-01 added. */
export function holdsAgentGrantForms(row: Record<string, unknown>): boolean {
  return Object.keys(row).some((field) => AGENT_GRANT_FORM_FIELDS.has(field));
}

/**
 * Reads the agents index at `indexFile`, drops the MGRT-01 fields from every
 * row, and writes the file back through a temporary file and a rename, so Pi
 * never reads a half-written file.
 */
export async function stripAgentGrantForms(indexFile: string): Promise<void> {
  const { document, rows } = await readIndex(indexFile);
  const stripped = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).filter(([field]) => !AGENT_GRANT_FORM_FIELDS.has(field)),
    ),
  );
  const temporary = `${indexFile}.${process.pid}.tmp`;
  const text = `${JSON.stringify({ ...document, agents: stripped }, null, 2)}\n`;
  await writeFile(temporary, text, { flag: "wx" });
  await rename(temporary, indexFile);
}
