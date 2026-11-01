/**
 * @fileoverview What the registry probe reports, and the reader a step uses
 * to take its report out of a request (D-CF1-17, HAR-04).
 *
 * The probe is a Pi extension that every profile Pi loads. When its command
 * runs, it appends one custom entry that holds every tool Pi has, the names
 * of the active tools, and every slash command Pi offers, in Pi's order. The
 * reader requires exactly one such entry among a request's custom entries and
 * validates all three fields, so an empty list is always an empty array that
 * a step compares, never a missing field read as empty.
 */

import { fileURLToPath } from "node:url";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import type { CustomEntry } from "../pi-process.ts";

/** The command that makes the probe report. No step text names it. */
export const REGISTRY_PROBE_COMMAND = "pi-registry-probe";

/** The custom entry type of the probe's report. */
export const REGISTRY_PROBE_ENTRY = "pi-registry-probe";

/** The probe extension, which a profile Pi loads with `--extension`. */
export const REGISTRY_PROBE_EXTENSION = fileURLToPath(new URL("extension.ts", import.meta.url));

const SNAPSHOT_SCHEMA = Type.Object(
  {
    allTools: Type.Array(
      Type.Object(
        { name: Type.String(), source: Type.String(), path: Type.String() },
        { additionalProperties: false },
      ),
    ),
    activeTools: Type.Array(Type.String()),
    commands: Type.Array(
      Type.Object(
        {
          name: Type.String(),
          description: Type.Union([Type.String(), Type.Null()]),
          source: Type.String(),
          path: Type.String(),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

const SNAPSHOT_VALIDATOR = Compile(SNAPSHOT_SCHEMA);

/**
 * One report of the probe: every tool with the source and path Pi records for
 * it, the names of the active tools, and every slash command with its
 * description (null when Pi has none), its kind (`extension`, `prompt`, or
 * `skill`), and the path Pi records for it. Each list keeps Pi's order.
 */
export type RegistrySnapshot = Type.Static<typeof SNAPSHOT_SCHEMA>;

/**
 * Returns the one probe report among `entries`, the custom entries of one
 * request. Fails when the request holds no report or more than one, or when
 * the report lacks a field or holds a field of the wrong shape.
 */
export function readRegistrySnapshot(entries: readonly CustomEntry[]): RegistrySnapshot {
  const reports = entries.filter((entry) => entry.customType === REGISTRY_PROBE_ENTRY);
  const [report] = reports;
  if (reports.length !== 1 || report === undefined) {
    throw new Error(`expected one registry probe report, got ${reports.length}`);
  }

  const { data } = report;
  if (!SNAPSHOT_VALIDATOR.Check(data)) {
    throw new Error(
      `the registry probe report is malformed: ${JSON.stringify([...SNAPSHOT_VALIDATOR.Errors(data)])}`,
    );
  }

  return data;
}
