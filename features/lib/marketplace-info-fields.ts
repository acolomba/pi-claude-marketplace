/** @fileoverview Reads the expected fields of a marketplace-info result. */

import { fieldRecord } from "./field-rows.ts";

import type { DataTable } from "@cucumber/cucumber";

type InfoSourceKind = "path" | "url" | "github";

const SOURCE_FIELDS = [
  "source abs path",
  "source url",
  "source owner",
  "source repo",
  "source ref",
] as const;

const SOURCE_FIELDS_BY_KIND: Readonly<Record<InfoSourceKind, ReadonlySet<string>>> = {
  path: new Set(["source abs path"]),
  url: new Set(["source url", "source ref"]),
  github: new Set(["source owner", "source repo", "source ref"]),
};

const INFO_FIELDS = new Set([
  "kind",
  "name",
  "scope",
  "details autoupdate",
  "details last updated at",
  "source kind",
  ...SOURCE_FIELDS,
  "description",
  "allowed marketplaces",
  "severity",
  "needs reload",
]);

function infoSourceKind(value: string | undefined): InfoSourceKind {
  if (value === undefined) {
    throw new Error("expected source kind path, url, or github, got undefined");
  }

  switch (value) {
    case "path":
    case "url":
    case "github":
      return value;
    default:
      throw new Error(`expected source kind path, url, or github, got ${value}`);
  }
}

/** Reads a complete source-field table, omitting fields whose blank cells mean absence. */
export function expectedInfoFields(table: DataTable): Map<string, string> {
  const pairs = table.raw().map(([name, value]) => {
    if (name === undefined || value === undefined) {
      throw new Error("each marketplace info row must have a field name and value");
    }

    if (!INFO_FIELDS.has(name)) {
      throw new Error(`unknown marketplace info field "${name}"`);
    }

    return [name, value] as const;
  });

  const expected = fieldRecord(pairs);
  const applicable = SOURCE_FIELDS_BY_KIND[infoSourceKind(expected.get("source kind"))];

  for (const field of SOURCE_FIELDS) {
    const value = expected.get(field);
    if (value === undefined) {
      throw new Error(`the marketplace info table must state "${field}"`);
    }

    if (applicable.has(field)) {
      if (value === "" && field !== "source ref") {
        throw new Error(`the ${expected.get("source kind")} source requires "${field}"`);
      }
    } else if (value !== "") {
      throw new Error(`the ${expected.get("source kind")} source cannot state "${field}"`);
    }

    if (value === "") {
      expected.delete(field);
    }
  }

  return expected;
}
