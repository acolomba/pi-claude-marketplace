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
//       for `<verb> -` -- every catalog verb (derived from CATALOG_VERBS, so a
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
//       off the exported `KEEP_DATA_FLAG` constant instead (WR-01), which the
//       compiler covers; the pin still holds its per-verb set. Each pin row is
//       kept in canonical sorted order; only the catalog side is sorted, so
//       reordering a literal row also fails the equality.
//
//   (d) Help-text consistency: `TOP_LEVEL_USAGE` (edge/router.ts) is the block
//       printed for a bare `/claude:plugin` and for an unrecognized subcommand.
//       It documents per-verb extra flags, so it is a flag-documenting surface
//       and can drift from the catalog -- nothing in (a)-(c) reads it. Each
//       verb's complete=true names are partitioned here into the ones its usage
//       line documents and the ones it deliberately omits, so a new flag cannot
//       reach users without a conscious decision about its help text, and a
//       documented flag that leaves the catalog fails here.
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
  CATALOG_VERBS,
  completionFlagEntries,
  parseFlagNames,
} from "../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import { TOP_LEVEL_USAGE } from "../../extensions/pi-claude-marketplace/edge/router.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

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
  uninstall: ["--keep-data", "--local"],
  reinstall: ["--local"],
  fetch: [],
  enable: ["--local"],
  disable: ["--local"],
  pending: [],
  import: [],
  bootstrap: [],
};

test("catalog vs handlers: every verb's parse-set matches the ordered handler-accepted pin", () => {
  assert.deepEqual(
    sorted(Object.keys(HANDLER_ACCEPTED_PARSE_SETS)),
    sorted(CATALOG_VERBS),
    "HANDLER_ACCEPTED_PARSE_SETS must cover every catalog verb exactly.",
  );

  for (const verb of CATALOG_VERBS) {
    assert.deepEqual(
      sorted(parseFlagNames(verb)),
      HANDLER_ACCEPTED_PARSE_SETS[verb],
      `Parse-set drift for "${verb}": the catalog's parse bits no longer match what the handler accepts. Update the handler wiring and this pin in the same change.`,
    );
  }
});

// Reconciliation (d): how the top-level help block treats each verb's
// completable flags. `documented` names must appear in that verb's usage line;
// `omitted` names must NOT. The union must be the verb's complete-set exactly,
// which is what makes a newly-catalogued flag a red test until someone decides
// whether the help block should carry it.
//
// WR-02: the `omitted` rows are a record of today's help block, not an
// endorsement of it. `--keep-data` shipped absent from this surface while the
// operator's only other route to it was tab completion or a post-mortem usage
// error, so uninstall now documents both of its extra flags; the remaining
// rows stay as the block has them.
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
  uninstall: { documented: ["--keep-data", "--local"], omitted: [] },
  reinstall: { documented: [], omitted: ["--local"] },
  fetch: { documented: [], omitted: [] },
  enable: { documented: ["--local"], omitted: [] },
  disable: { documented: ["--local"], omitted: [] },
  pending: { documented: [], omitted: [] },
  import: { documented: [], omitted: [] },
  bootstrap: { documented: [], omitted: [] },
};

/**
 * The one `TOP_LEVEL_USAGE` line that describes `verb` -- the indented entry
 * whose first token is the verb itself. The header line and the trailing
 * `marketplace ...` line describe no catalog verb, so neither can match.
 */
function usageLineFor(verb: CatalogVerb): string {
  const lines = TOP_LEVEL_USAGE.split("\n").filter((line) => line.startsWith(`  ${verb} `));
  assert.equal(lines.length, 1, `TOP_LEVEL_USAGE must hold exactly one "${verb}" line.`);
  return lines[0] ?? "";
}

test("catalog vs help text: every completable flag is documented or deliberately omitted", () => {
  assert.deepEqual(
    sorted(Object.keys(TOP_LEVEL_USAGE_FLAGS)),
    sorted(CATALOG_VERBS),
    "TOP_LEVEL_USAGE_FLAGS must cover every catalog verb exactly.",
  );

  for (const verb of CATALOG_VERBS) {
    const { documented, omitted } = TOP_LEVEL_USAGE_FLAGS[verb];
    const catalogComplete = completionFlagEntries(verb).map((entry) => entry.name);

    assert.deepEqual(
      sorted([...documented, ...omitted]),
      sorted(catalogComplete),
      `Help-text drift for "${verb}": every completable flag must be listed as documented or omitted. Decide which the new flag is, in the same change.`,
    );

    const usageLine = usageLineFor(verb);
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
  }
});
