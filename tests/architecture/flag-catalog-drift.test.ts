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
//       for `<verb> -` -- every catalog verb (from the independent EXPECTED_CATALOG_VERBS inventory, so a
//       new verb cannot be silently omitted) plus the `ls` alias -- with the
//       global `--scope` excluded, MUST equal the catalog's complete=true
//       names for that verb (exact set, sorted).
//
//   (b) Handler-accepted consistency: the catalog list parse-set MUST carry
//       `--remote` (RSTA-07), and the info parse-set MUST carry `--fetch`
//       (FTCH-03).
//
//   (c) Exact per-verb parse-set pin: verbs whose handlers hard-reject unknown
//       long flags inline instead of consuming the catalog
//       (uninstall/reinstall/enable/disable accept only `--local`;
//       fetch/pending/import/bootstrap accept no extra flags) are pinned to
//       the exact sets their handlers accept. install/update DO consume the
//       catalog for their long-flag gates, but the mapModel/partial field
//       mapping in edge/handlers/plugin/shared.ts names the flags literally --
//       the pin makes a catalog rename or addition fail here first. Each pin
//       row is kept in canonical sorted order; only the catalog side is sorted,
//       so reordering a literal row also fails the equality.
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
  isCatalogVerb,
  completionFlagEntries,
  parseFlagNames,
} from "../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import {
  MARKETPLACE_SUBCOMMANDS,
  TOP_LEVEL_SUBCOMMANDS,
} from "../../extensions/pi-claude-marketplace/edge/router.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type {
  LocationsResolver,
  MarketplaceStateRecord,
} from "../../extensions/pi-claude-marketplace/edge/completions/data.ts";
import type { CatalogVerb } from "../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

// The flag-completion branch never consults the resolver (it returns before any
// state/manifest load), so an empty stub resolver is sufficient.
const EMPTY_RESOLVER: LocationsResolver = {
  pluginCachePath(scope: Scope, marketplace: string): Promise<string> {
    return Promise.resolve(`/nonexistent/${scope}/${marketplace}.json`);
  },
  loadStateForScope(): Promise<{ marketplaces: Record<string, MarketplaceStateRecord> }> {
    return Promise.resolve({ marketplaces: {} });
  },
  loadManifestForMarketplace(): Promise<readonly never[]> {
    return Promise.resolve([]);
  },
};

// Every independently declared catalog verb (the router inventory check below
// detects any reachable command omitted here) plus the `ls` completion alias, which maps to the
// `list` catalog key. The completion head is what the user types; the catalog
// key is what governs its per-verb flags.
const EXPECTED_CATALOG_VERBS = [
  "install",
  "update",
  "list",
  "info",
  "uninstall",
  "reinstall",
  "fetch",
  "enable",
  "disable",
  "pending",
  "import",
  "bootstrap",
  "marketplace add",
  "marketplace remove",
  "marketplace info",
  "marketplace list",
  "marketplace update",
  "marketplace autoupdate",
  "marketplace noautoupdate",
] as const;

const COMPLETION_HEADS: { head: string; verb: CatalogVerb }[] = [
  ...EXPECTED_CATALOG_VERBS.map((verb) => ({ head: verb, verb })),
  { head: "ls", verb: "list" },
  { head: "marketplace ls", verb: "marketplace list" },
  { head: "marketplace rm", verb: "marketplace remove" },
];

function sorted(values: Iterable<string>): string[] {
  return [...values].sort();
}

test("catalog vs completion: per-verb complete-set equals emitted labels (scope excluded)", async () => {
  const completionCache = createCompletionCache();
  for (const { head, verb } of COMPLETION_HEADS) {
    const items = await getArgumentCompletions(`${head} -`, EMPTY_RESOLVER, completionCache);
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
  "marketplace add": ["--local"],
  "marketplace remove": ["--local"],
  "marketplace info": ["--local"],
  "marketplace list": ["--local"],
  "marketplace update": ["--local"],
  "marketplace autoupdate": ["--local"],
  "marketplace noautoupdate": ["--local"],
};

function assertFlagSet(observed: Iterable<string>, expected: readonly string[]): void {
  assert.deepStrictEqual(sorted(observed), expected);
}

for (const verb of EXPECTED_CATALOG_VERBS) {
  test(`catalog parse flags for ${verb} match the independent handler contract`, () => {
    // arrange
    const expected = HANDLER_ACCEPTED_PARSE_SETS[verb];

    // act
    const accepted = parseFlagNames(verb);

    // assert
    assertFlagSet(accepted, expected);
  });
}

test("catalog and alias completions cover the complete router inventory", () => {
  // arrange
  const routerHeads = [
    ...TOP_LEVEL_SUBCOMMANDS.filter((verb) => verb !== "marketplace"),
    ...MARKETPLACE_SUBCOMMANDS.map((verb) => `marketplace ${verb}`),
  ];

  // act
  const catalogHeads = COMPLETION_HEADS.map(({ head }) => head);

  // assert
  assert.deepStrictEqual(sorted(catalogHeads), sorted(routerHeads));
  assert.deepStrictEqual(
    sorted(Object.keys(HANDLER_ACCEPTED_PARSE_SETS)),
    sorted(EXPECTED_CATALOG_VERBS),
  );
  assert.deepStrictEqual(
    EXPECTED_CATALOG_VERBS.map((verb) => isCatalogVerb(verb)),
    Array.from({ length: 19 }, () => true),
  );
});

for (const { observed, label } of [
  { observed: [], label: "missing --local" },
  { observed: ["--bogus", "--local"], label: "unexpected --bogus" },
]) {
  test(`flag drift comparison rejects a planted ${label}`, () => {
    // arrange
    const expected = ["--local"];

    // act & assert
    assert.throws(
      () => {
        assertFlagSet(observed, expected);
      },
      (error: unknown) => {
        assert.ok(error instanceof assert.AssertionError);
        assert.deepStrictEqual(error.actual, observed);
        assert.deepStrictEqual(error.expected, ["--local"]);
        assert.strictEqual(error.code, "ERR_ASSERTION");
        return true;
      },
    );
  });
}

test("flag drift comparison accepts the benign complete set", () => {
  // arrange
  const observed = new Set(["--local"]);

  // act & assert
  assert.doesNotThrow(() => {
    assertFlagSet(observed, ["--local"]);
  });
});
