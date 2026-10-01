// tests/architecture/flag-catalog-drift.test.ts
//
// Exact-set drift guard for the per-verb CLI flag catalog
// (edge/flag-catalog.ts). The completion candidate list and the
// list/info/install/update parse gates derive from the catalog BY
// CONSTRUCTION; this guard closes the remaining gaps so the catalog's SSOT
// claim holds for every verb.
//
// Four reconciliations:
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
//       (reinstall/enable/disable accept only `--local`;
//       fetch/pending/import/bootstrap accept no extra flags) are pinned to
//       the exact sets their handlers accept. install/update/uninstall DO
//       consume the catalog for their long-flag gates, but install/update still
//       name their flags literally where they map them to an option field
//       (mapModel / partial in edge/handlers/plugin/shared.ts), so the pin makes
//       a catalog rename or addition fail here first. Uninstall maps `keepData`
//       and `prune` off the exported `KEEP_DATA_FLAG` and `PRUNE_FLAG` constants
//       instead (WR-01), which the compiler covers; the pin still holds its
//       per-verb set. Each pin row is kept in canonical sorted order; only the
//       catalog side is sorted, so reordering a literal row also fails the
//       equality.
//
//   (d) Help-text consistency: `TOP_LEVEL_USAGE` (edge/router.ts) is the block
//       printed for a bare `/claude:plugin` and for an unrecognized subcommand.
//       It documents per-verb extra flags, so it is a flag-documenting surface
//       and can drift from the catalog -- nothing in (a)-(c) reads it. Each
//       verb's complete=true names are partitioned here into the ones its usage
//       line documents and the ones it deliberately omits, one case per verb, so
//       a new flag cannot reach users without a conscious decision about its
//       help text, and a documented flag that leaves the catalog fails here.
//
// Closed-set tripwire: adding a flag to any verb requires updating
// edge/flag-catalog.ts, the handler wiring, and the pin table in the SAME
// change (mirrors the deliberate-bump discipline in
// notify-closed-set-locks.test.ts). RSTA-07 / FTCH-03 / LIST-01 /
// LIST-02 / AG-7 / DATA-01 are the requirements this catalog serves.

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
  MARKETPLACE_USAGE,
  TOP_LEVEL_SUBCOMMANDS,
  TOP_LEVEL_USAGE,
} from "../../extensions/pi-claude-marketplace/edge/router.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type { LocationsResolver } from "../../extensions/pi-claude-marketplace/edge/completions/data.ts";
import type { CatalogVerb } from "../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import type { MarketplaceStateRecordLike } from "../../extensions/pi-claude-marketplace/orchestrators/edge-deps.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

// The flag-completion branch never consults the resolver (it returns before any
// state/manifest load), so an empty stub resolver is sufficient.
const EMPTY_RESOLVER: LocationsResolver = {
  pluginCachePath(scope: Scope, marketplace: string): Promise<string> {
    return Promise.resolve(`/nonexistent/${scope}/${marketplace}.json`);
  },
  loadStateForScope(): Promise<{ marketplaces: Record<string, MarketplaceStateRecordLike> }> {
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
  "prune",
  "reinstall",
  "fetch",
  "enable",
  "disable",
  "pending",
  "import",
  "bootstrap",
  "browse",
  "help",
  "marketplace help",
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

    assert.deepStrictEqual(
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
  uninstall: ["--keep-data", "--local", "--prune"],
  prune: ["--dry-run"],
  reinstall: ["--local"],
  fetch: [],
  enable: ["--local"],
  disable: ["--local"],
  pending: [],
  import: [],
  bootstrap: [],
  // The documentation/navigation verbs parse no flag of their own, and
  // completions/provider.ts keeps the global `--scope` off them too.
  browse: [],
  help: [],
  "marketplace help": [],
  "marketplace add": ["--local"],
  "marketplace remove": ["--local"],
  "marketplace info": [],
  "marketplace list": [],
  "marketplace update": [],
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
    Array.from({ length: EXPECTED_CATALOG_VERBS.length }, () => true),
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

// Reconciliation (d): how the top-level help block treats each verb's
// completable flags. `documented` names must appear in that verb's usage line;
// `omitted` names must NOT. The union must be the verb's complete-set exactly,
// which is what makes a newly-catalogued flag a red test until someone decides
// whether the help block should carry it.
//
// WR-02: the `omitted` rows record today's help block. Uninstall documents every
// one of its extra flags (FLAG-01: `--keep-data`, `--local`, `--prune`) because
// tab completion and a usage error are the only other routes an operator has
// to them; the remaining rows stay as the block has them.
const TOP_LEVEL_USAGE_FLAGS: Record<
  CatalogVerb,
  { readonly documented: readonly string[]; readonly omitted: readonly string[] }
> = {
  install: { documented: [], omitted: ["--local", "--map-model", "--partial"] },
  update: { documented: [], omitted: ["--local", "--map-model", "--partial"] },
  list: {
    documented: [],
    omitted: ["--available", "--installed", "--partial", "--remote", "--unavailable"],
  },
  info: { documented: [], omitted: ["--fetch"] },
  uninstall: { documented: ["--keep-data", "--local", "--prune"], omitted: [] },
  prune: { documented: ["--dry-run"], omitted: [] },
  reinstall: { documented: [], omitted: ["--local"] },
  fetch: { documented: [], omitted: [] },
  enable: { documented: ["--local"], omitted: [] },
  disable: { documented: ["--local"], omitted: [] },
  pending: { documented: [], omitted: [] },
  import: { documented: [], omitted: [] },
  bootstrap: { documented: [], omitted: [] },
  browse: { documented: [], omitted: [] },
  help: { documented: [], omitted: [] },
  "marketplace help": { documented: [], omitted: [] },
  "marketplace add": { documented: [], omitted: ["--local"] },
  "marketplace remove": { documented: [], omitted: ["--local"] },
  "marketplace info": { documented: [], omitted: [] },
  "marketplace list": { documented: [], omitted: [] },
  "marketplace update": { documented: [], omitted: [] },
  "marketplace autoupdate": { documented: [], omitted: ["--local"] },
  "marketplace noautoupdate": { documented: [], omitted: ["--local"] },
};

/**
 * The one usage line that describes `verb` -- the indented entry whose first
 * token is the verb itself. A top-level verb reads `TOP_LEVEL_USAGE`; a
 * `marketplace <sub>` verb reads `MARKETPLACE_USAGE` by its sub-verb, except
 * `marketplace help`, which that block does not list and which `TOP_LEVEL_USAGE`
 * documents on its `help [marketplace]` line. The header lines describe no
 * catalog verb, so none can match.
 */
function usageLineFor(verb: CatalogVerb): string {
  const [block, head] =
    verb.startsWith("marketplace ") && verb !== "marketplace help"
      ? [MARKETPLACE_USAGE, verb.slice("marketplace ".length)]
      : [TOP_LEVEL_USAGE, verb === "marketplace help" ? "help" : verb];
  const lines = block
    .split("\n")
    .filter((line) => line === `  ${head}` || line.startsWith(`  ${head} `));
  assert.equal(lines.length, 1, `the usage block must hold exactly one "${verb}" line.`);
  return lines[0] ?? "";
}

for (const verb of EXPECTED_CATALOG_VERBS) {
  test(`catalog vs help text: every completable "${verb}" flag is documented or deliberately omitted`, () => {
    // arrange
    const { documented, omitted } = TOP_LEVEL_USAGE_FLAGS[verb];

    // act
    const catalogComplete = completionFlagEntries(verb).map((entry) => entry.name);
    const usageLine = usageLineFor(verb);

    // assert
    assert.deepEqual(
      sorted([...documented, ...omitted]),
      sorted(catalogComplete),
      `Help-text drift for "${verb}": every completable flag must be listed as documented or omitted. Decide which the new flag is, in the same change.`,
    );
    for (const flag of documented) {
      assert.ok(
        usageLine.includes(`[${flag}]`),
        `TOP_LEVEL_USAGE's "${verb}" line must document ${flag}: ${usageLine}`,
      );
    }

    for (const flag of omitted) {
      assert.ok(
        !usageLine.includes(flag),
        `TOP_LEVEL_USAGE's "${verb}" line documents ${flag}, which this pin calls omitted: ${usageLine}`,
      );
    }
  });
}
