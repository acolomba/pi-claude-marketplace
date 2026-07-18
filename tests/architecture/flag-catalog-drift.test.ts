// tests/architecture/flag-catalog-drift.test.ts
//
// Exact-set drift guard for the per-verb CLI flag catalog
// (edge/flag-catalog.ts). The completion candidate list and the
// list/info/install/update parse gates derive from the catalog BY
// CONSTRUCTION; this guard closes the remaining gaps so the catalog's SSOT
// claim holds for every verb.
//
// Three reconciliations:
//
//   (a) Completion consistency: the labels emitted by `getArgumentCompletions`
//       for `<verb> -` -- every catalog verb (derived from CATALOG_VERBS, so a
//       new verb cannot be silently omitted) plus the `ls` alias -- with the
//       global `--scope` excluded, MUST equal the catalog's complete=true
//       names for that verb (exact set, sorted).
//
//   (b) Handler-accepted consistency: list's exported `BOOLEAN_FLAGS` (the
//       concrete parse-side hook) MUST equal the catalog's list parse-set with
//       `--local` excluded (BOOLEAN_FLAGS enumerates only the boolean FILTER
//       flags; `--scope` is consumed by parseArgs upstream and never in the
//       catalog). For `info`, whose accepted set is not exported, the catalog
//       parse-set MUST carry `--fetch` (FTCH-03).
//
//   (c) Exact per-verb parse-set pin: verbs whose handlers hard-reject unknown
//       long flags inline instead of consuming the catalog
//       (uninstall/reinstall/enable/disable accept only `--local`;
//       fetch/pending/import/bootstrap accept no extra flags) are pinned to
//       the exact sets their handlers accept. install/update DO consume the
//       catalog for their long-flag gates, but the mapModel/partial field
//       mapping in edge/handlers/plugin/shared.ts names the flags literally --
//       the pin makes a catalog rename or addition fail here first.
//
// Closed-set tripwire: adding a flag to any verb requires updating
// edge/flag-catalog.ts, the handler wiring, and the pin table in the SAME
// change (mirrors the deliberate-bump discipline in
// notify-closed-set-locks.test.ts). RSTA-07 / FTCH-03 / LIST-01 /
// LIST-02 / AG-7 are the requirements this catalog serves.

import assert from "node:assert/strict";
import test from "node:test";

import { getArgumentCompletions } from "../../extensions/pi-claude-marketplace/edge/completions/provider.ts";
import {
  CATALOG_VERBS,
  completionFlagEntries,
  parseFlagNames,
} from "../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import { BOOLEAN_FLAGS } from "../../extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts";
import { __resetCacheForTests } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type { LocationsResolver } from "../../extensions/pi-claude-marketplace/edge/completions/data.ts";
import type { CatalogVerb } from "../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

// The flag-completion branch never consults the resolver (it returns before any
// state/manifest load), so an empty stub resolver is sufficient.
const EMPTY_RESOLVER: LocationsResolver = {
  marketplaceNamesCachePath(scope: Scope): string {
    return `/nonexistent/${scope}/marketplace-names.json`;
  },
  pluginCachePath(scope: Scope, marketplace: string): Promise<string> {
    return Promise.resolve(`/nonexistent/${scope}/${marketplace}.json`);
  },
  loadStateForScope(): Promise<{ marketplaces: Record<string, { manifestPath?: string }> }> {
    return Promise.resolve({ marketplaces: {} });
  },
  loadManifestForMarketplace(): Promise<readonly never[]> {
    return Promise.resolve([]);
  },
};

// Every catalog verb (derived from CATALOG_VERBS -- a new verb cannot be
// silently omitted here) plus the `ls` completion alias, which maps to the
// `list` catalog key. The completion head is what the user types; the catalog
// key is what governs its per-verb flags.
const COMPLETION_HEADS: { head: string; verb: CatalogVerb }[] = [
  ...CATALOG_VERBS.map((verb) => ({ head: verb, verb })),
  { head: "ls", verb: "list" },
];

function sorted(values: Iterable<string>): string[] {
  return [...values].sort();
}

test("catalog vs completion: per-verb complete-set equals emitted labels (scope excluded)", async () => {
  for (const { head, verb } of COMPLETION_HEADS) {
    __resetCacheForTests();
    const items = await getArgumentCompletions(`${head} -`, EMPTY_RESOLVER);
    assert.ok(items !== null, `expected flag completions for "${head} -"`);

    // Exclude the global `--scope` base flag from both sides.
    const emitted = items.map((i) => i.label).filter((l) => l !== "--scope");
    const catalogComplete = completionFlagEntries(verb).map((e) => e.name);

    assert.deepEqual(
      sorted(emitted),
      sorted(catalogComplete),
      `Flag drift for "${head}": completion labels ${JSON.stringify(sorted(emitted))} != catalog complete-set ${JSON.stringify(sorted(catalogComplete))}. Update edge/flag-catalog.ts in the same change.`,
    );
  }
});

test("catalog vs handler: list BOOLEAN_FLAGS equals catalog list parse-set (--local excluded)", () => {
  // BOOLEAN_FLAGS enumerates the boolean FILTER flags; the catalog's list entry
  // carries no `--local`, so the two sets match exactly.
  const catalogListParse = parseFlagNames("list");
  catalogListParse.delete("--local");

  assert.deepEqual(
    sorted(BOOLEAN_FLAGS),
    sorted(catalogListParse),
    "list BOOLEAN_FLAGS and the catalog list parse-set have drifted -- update edge/flag-catalog.ts.",
  );
});

test("catalog vs handler: RSTA-07 list carries --remote; FTCH-03 info carries --fetch", () => {
  assert.ok(
    parseFlagNames("list").has("--remote"),
    "RSTA-07: list parse-set must include --remote",
  );
  assert.ok(parseFlagNames("info").has("--fetch"), "FTCH-03: info parse-set must include --fetch");
});

// Reconciliation (c): the exact flags each handler accepts today. The
// `Record<CatalogVerb, ...>` shape makes a new catalog verb a compile error
// here until its row is added.
const HANDLER_ACCEPTED_PARSE_SETS: Record<CatalogVerb, readonly string[]> = {
  install: ["--local", "--map-model", "--partial"],
  update: ["--local", "--map-model", "--partial"],
  list: ["--available", "--installed", "--partial", "--remote", "--unavailable"],
  info: ["--fetch"],
  uninstall: ["--local"],
  reinstall: ["--local"],
  fetch: [],
  enable: ["--local"],
  disable: ["--local"],
  pending: [],
  import: [],
  bootstrap: [],
};

test("catalog vs handlers: every verb's parse-set matches the handler-accepted pin", () => {
  assert.deepEqual(
    sorted(Object.keys(HANDLER_ACCEPTED_PARSE_SETS)),
    sorted(CATALOG_VERBS),
    "HANDLER_ACCEPTED_PARSE_SETS must cover every catalog verb exactly.",
  );

  for (const verb of CATALOG_VERBS) {
    assert.deepEqual(
      sorted(parseFlagNames(verb)),
      sorted(HANDLER_ACCEPTED_PARSE_SETS[verb]),
      `Parse-set drift for "${verb}": the catalog's parse bits no longer match what the handler accepts. Update the handler wiring and this pin in the same change.`,
    );
  }
});
