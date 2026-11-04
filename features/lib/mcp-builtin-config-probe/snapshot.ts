/**
 * @fileoverview What the built-in MCP config probe reports, and the reader a
 * step uses to take its report out of a request (BLT-02, P2-DC-17).
 *
 * OAuth, timeout, exposure, and description values never reach a server
 * process, so only Pi's registry shows them. The probe is a Pi extension that
 * a profile Pi loads through `extraExtensions` (P2-DC-24). When its command
 * runs, it appends one custom entry that holds every MCP server an extension
 * registered with Pi, each with its name and its whole config, in Pi's order.
 * The reader requires exactly one such entry among a request's custom entries
 * and validates its shape.
 */

import { fileURLToPath } from "node:url";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import type { CustomEntry } from "../pi-process.ts";

/** The command that makes the probe report. No step text names it. */
export const MCP_BUILTIN_CONFIG_PROBE_COMMAND = "pi-mcp-builtin-config-probe";

/** The custom entry type of the probe's report. */
export const MCP_BUILTIN_CONFIG_PROBE_ENTRY = "pi-mcp-builtin-config-probe";

/** The probe extension, which a profile Pi loads with `--extension`. */
export const MCP_BUILTIN_CONFIG_PROBE_EXTENSION = fileURLToPath(
  new URL("extension.ts", import.meta.url),
);

const REPORT_SCHEMA = Type.Array(
  Type.Object(
    { name: Type.String(), config: Type.Record(Type.String(), Type.Unknown()) },
    { additionalProperties: false },
  ),
);

const REPORT_VALIDATOR = Compile(REPORT_SCHEMA);

/**
 * One report of the probe: every MCP server an extension registered with
 * `pi.registerMcpServer()`, with its name and its config as Pi holds it, in
 * Pi's order.
 */
export type RegisteredConfigs = Type.Static<typeof REPORT_SCHEMA>;

/**
 * Returns the one probe report among `entries`, the custom entries of one
 * request. Fails when the request holds no report or more than one, or when
 * the report is not a list of named configs.
 */
export function readRegisteredConfigs(entries: readonly CustomEntry[]): RegisteredConfigs {
  const reports = entries.filter((entry) => entry.customType === MCP_BUILTIN_CONFIG_PROBE_ENTRY);
  const [report] = reports;
  if (reports.length !== 1 || report === undefined) {
    throw new Error(`expected one mcp config probe report, got ${reports.length}`);
  }

  const { data } = report;
  if (!REPORT_VALIDATOR.Check(data)) {
    throw new Error(
      `the mcp config probe report is malformed: ${JSON.stringify([...REPORT_VALIDATOR.Errors(data)])}`,
    );
  }

  return data;
}
