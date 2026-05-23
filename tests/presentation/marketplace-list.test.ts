// tests/presentation/marketplace-list.test.ts
//
// Phase 13 Wave 2 sub-wave 2c (Plan 13-02c-01):
//
// CMC-03 / CMC-07 / CMC-10 / CMC-29 / MSG-GR-3 -- marketplace-list
// renderer rewritten on top of the Wave 1 MarketplaceRow + EmptyToken
// primitives and the compareByNameThenScope comparator.
//
//   - CMC-10  empty case via EmptyToken: bare `(no marketplaces)` token.
//   - CMC-29  flat list rendering: no `user scope marketplaces:` /
//             `project scope marketplaces:` group headers.
//   - MSG-GR-3 sort order: name primary (case-insensitive), scope
//             secondary (project before user).
//   - CMC-07  marketplace icon dispatch: `●` for ok outcome (list rows
//             are pure label rows -> outcomeClass: "ok").
//   - CMC-05 / MSG-GR-5  `<autoupdate>` marker present iff
//             `record.autoupdate === true`. List rows OMIT the
//             `<no autoupdate>` token (per messaging style guide §6:
//             absence of the autoupdate marker conveys autoupdate-off
//             in every surface except the `marketplace autoupdate
//             disable` result row).
//
// Catalog reference: docs/output-catalog.md lines 567-585.

import assert from "node:assert/strict";
import test from "node:test";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { renderMarketplaceList } from "../../extensions/pi-claude-marketplace/presentation/marketplace-list.ts";

import type { MarketplaceListEntry } from "../../extensions/pi-claude-marketplace/presentation/marketplace-list.ts";

function makeRecord(
  over: Partial<MarketplaceListEntry> & { name: string; scope: "user" | "project" },
): MarketplaceListEntry {
  return {
    name: over.name,
    scope: over.scope,
    source: over.source ?? pathSource("./local"),
    ...(over.autoupdate !== undefined && { autoupdate: over.autoupdate }),
  };
}

test("CMC-10 / MSG-ER-1: empty list emits bare `(no marketplaces)` EmptyToken", () => {
  assert.equal(renderMarketplaceList([]), "(no marketplaces)");
});

test("CMC-29 / MSG-GR-3: mixed-scope rows flatten (no group headers); sort is name-primary, project-before-user tie-break", () => {
  // Catalog reference (lines 575-580):
  //   ● alpha [project] <autoupdate> (added)
  //   ● alpha [user] (added)
  //   ● beta [user] (added)
  //   ● zeta [project] <autoupdate> (added)
  // (status `(added)` is the catalog's mp-add result -- list rows omit
  // status; the renderer emits a pure label row without the status slot.)
  const out = renderMarketplaceList([
    makeRecord({ name: "beta", scope: "user" }),
    makeRecord({ name: "zeta", scope: "project", autoupdate: true }),
    makeRecord({ name: "alpha", scope: "project", autoupdate: true }),
    makeRecord({ name: "alpha", scope: "user" }),
  ]);
  assert.equal(
    out,
    [
      "● alpha [project] <autoupdate>",
      "● alpha [user]",
      "● beta [user]",
      "● zeta [project] <autoupdate>",
    ].join("\n"),
  );
});

test("CMC-05 / MSG-GR-5: autoupdate=true emits `<autoupdate>` marker", () => {
  const out = renderMarketplaceList([
    makeRecord({ name: "auto-mp", scope: "user", autoupdate: true }),
  ]);
  assert.equal(out, "● auto-mp [user] <autoupdate>");
});

test("CMC-05 / MSG-GR-5: autoupdate=false omits the marker (absence = off)", () => {
  const out = renderMarketplaceList([
    makeRecord({ name: "manual-mp", scope: "user", autoupdate: false }),
  ]);
  assert.equal(out, "● manual-mp [user]");
});

test("CMC-05 / MSG-GR-5: autoupdate omitted (undefined) omits the marker", () => {
  const out = renderMarketplaceList([makeRecord({ name: "default-mp", scope: "project" })]);
  assert.equal(out, "● default-mp [project]");
});

test("CMC-29: no `user scope marketplaces:` / `project scope marketplaces:` group headers anywhere", () => {
  const out = renderMarketplaceList([
    makeRecord({ name: "u1", scope: "user" }),
    makeRecord({ name: "p1", scope: "project" }),
  ]);
  assert.equal(out.includes("scope marketplaces:"), false);
  assert.equal(out.includes("user scope"), false);
  assert.equal(out.includes("project scope"), false);
});

test("CMC-07: list rows use the ● icon (outcomeClass = 'ok' for label rows)", () => {
  const out = renderMarketplaceList([makeRecord({ name: "mp", scope: "user" })]);
  assert.equal(out.startsWith("● "), true);
  assert.equal(out.includes("⊘"), false);
});

test("MSG-GR-3: case-insensitive sort by name -- Alpha and alpha sort by base equality", () => {
  const out = renderMarketplaceList([
    makeRecord({ name: "Beta", scope: "user" }),
    makeRecord({ name: "alpha", scope: "user" }),
  ]);
  // localeCompare with sensitivity: 'base' folds case so 'alpha' < 'Beta'.
  assert.equal(out, ["● alpha [user]", "● Beta [user]"].join("\n"));
});
