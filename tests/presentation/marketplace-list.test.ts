import assert from "node:assert/strict";
import test from "node:test";

import { githubSource, pathSource } from "../../extensions/claude-marketplace/domain/source.ts";
import { renderMarketplaceList } from "../../extensions/claude-marketplace/presentation/marketplace-list.ts";

import type { MarketplaceListEntry } from "../../extensions/claude-marketplace/presentation/marketplace-list.ts";

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

test("ML-4: empty list returns 'No marketplaces configured.' byte-for-byte", () => {
  assert.equal(renderMarketplaceList([]), "No marketplaces configured.");
});

test("ML-1, ML-2: single user-scope path-source marketplace renders one line under user heading", () => {
  const out = renderMarketplaceList([
    makeRecord({ name: "local-mp", scope: "user", source: pathSource("~/projects/local-mp") }),
  ]);
  assert.equal(out, "user scope marketplaces:\n  ● local-mp (~/projects/local-mp)");
});

test("ML-2: github source renders canonical URL", () => {
  const out = renderMarketplaceList([
    makeRecord({
      name: "official",
      scope: "user",
      source: githubSource("https://github.com/anthropics/claude-plugins-official#v1.0"),
    }),
  ]);
  assert.equal(
    out,
    "user scope marketplaces:\n  ● official (https://github.com/anthropics/claude-plugins-official#v1.0)",
  );
});

test("ML-2: autoupdate flag appends ' [autoupdate]' suffix", () => {
  const out = renderMarketplaceList([
    makeRecord({
      name: "auto-mp",
      scope: "user",
      source: pathSource("./local"),
      autoupdate: true,
    }),
  ]);
  assert.equal(out, "user scope marketplaces:\n  ● auto-mp (./local) [autoupdate]");
});

test("ML-1: groups by scope with blank line between groups", () => {
  const out = renderMarketplaceList([
    makeRecord({ name: "u1", scope: "user", source: pathSource("./u1") }),
    makeRecord({ name: "p1", scope: "project", source: pathSource("./p1") }),
  ]);
  assert.equal(
    out,
    [
      "user scope marketplaces:",
      "  ● u1 (./u1)",
      "",
      "project scope marketplaces:",
      "  ● p1 (./p1)",
    ].join("\n"),
  );
});

test("ML-1: omits empty scope group entirely (no header for scope with zero entries)", () => {
  const out = renderMarketplaceList([
    makeRecord({ name: "u1", scope: "user", source: pathSource("./u1") }),
  ]);
  assert.equal(out.includes("project scope marketplaces"), false);
});
