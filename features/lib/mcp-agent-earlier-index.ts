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

// The agents index `indexFile` holds, throwing when it is not one.
async function readIndex(
  indexFile: string,
): Promise<{ readonly document: Record<string, unknown>; readonly rows: unknown[] }> {
  const document: unknown = JSON.parse(await readFile(indexFile, "utf8"));
  if (!isRecord(document) || !Array.isArray(document.agents)) {
    throw new Error(`${indexFile} is not an agents index`);
  }

  return { document, rows: document.agents };
}

/** The rows of the agents index at `indexFile`, each as a JSON object. */
export async function readAgentIndexRows(
  indexFile: string,
): Promise<readonly Record<string, unknown>[]> {
  const { rows } = await readIndex(indexFile);
  return rows.map((row) => {
    if (!isRecord(row)) {
      throw new Error(`${indexFile} holds a row that is not a JSON object`);
    }

    return row;
  });
}

/** Whether `row` holds a field MGRT-01 added. */
export function holdsAgentGrantForms(row: Record<string, unknown>): boolean {
  return Object.keys(row).some((field) => AGENT_GRANT_FORM_FIELDS.has(field));
}

/**
 * Reads the agents index at `indexFile`, drops the MGRT-01 fields from every
 * row, and writes the file back through a temporary file and a rename, so Pi
 * never reads a half-written file. Returns how many rows changed.
 */
export async function stripAgentGrantForms(indexFile: string): Promise<number> {
  const { document } = await readIndex(indexFile);
  const rows = await readAgentIndexRows(indexFile);
  const stripped = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).filter(([field]) => !AGENT_GRANT_FORM_FIELDS.has(field)),
    ),
  );
  const temporary = `${indexFile}.${process.pid}.tmp`;
  const text = `${JSON.stringify({ ...document, agents: stripped }, null, 2)}\n`;
  await writeFile(temporary, text, { flag: "wx" });
  await rename(temporary, indexFile);
  return rows.filter(holdsAgentGrantForms).length;
}
