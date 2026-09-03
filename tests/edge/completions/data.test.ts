// Owner suite for `edge/completions/data.ts`, the completion data layer: five
// pure token helpers plus three cache-backed accessors that reach scoped state
// and marketplace manifests through the injected `LocationsResolver` seam.
//
// The resolver is a declared parameter, so every case builds a typed fake and
// seeds it per case. Nothing here simulates a filesystem with a graph of stub
// functions -- the only real disk this module touches is the completion cache,
// which writes under a temporary root owned by the case.
//
// This surface is read-only and must never reach the network (NFR-5), so the
// cases that reach a collaborator -- the three cache-backed accessors -- install
// a context-owned fail-fast replacement for the process-wide transport and
// assert its call count is zero. The count is the proof; the thrown message
// never is.
//
// The five pure token helpers carry no such guard. Each is synchronous, takes no
// resolver and touches nothing outside its arguments, so a zero asserted over
// one of them could not have risen whatever the helper did.
//
// The status vocabulary seeded below is owned by
// `tests/shared/completion-cache.test.ts` and by
// `tests/orchestrators/plugin/plugin-state-classifier.test.ts`; every status
// here is a written-out literal, never a value this suite derives by re-running
// the classification it is checking. Likewise every expected candidate list is
// hand-authored, compared unsorted, and compared whole.
//
// D-116-01a: this pair lands one branch short of complete. The right-hand side
// of the nullish fallback at data.ts:188 -- the `?? ""` in
// `allTokens.at(-1) ?? ""` -- cannot be entered at runtime.
// `splitCompletionInput` has already returned for an empty input and for any
// input whose last character is whitespace, so every input reaching line 188
// ends in a non-whitespace character and the filtered token list is non-empty.
// The fallback exists only because the standard library types
// `Array.prototype.at()` as `T | undefined`; removing it needs a non-null
// assertion or a type assertion, both barred throughout `extensions/`.
//
// The claim is measured, not inspected: a brute force over all 65,536 BMP code
// points in five input shapes found zero inputs that reach the fallback, and a
// plant that replaced its value left all 66 cases green. The shortfall is
// pinned by its identity -- functions and lines complete, and exactly ONE
// uncovered branch -- never by an absolute branch pair, because the branch
// denominator tracks suite strength rather than the source. No coverage
// exception is added and no production file is changed.
//
// No exhaustiveness claim rides on this pair: `edge/completions/data.ts`
// contains no `switch` and no closed-union dispatch, so a deleted-arm plant has
// no target here.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  buildItem,
  extractPositionals,
  extractScope,
  getMarketplaceCompletions,
  getMarketplaceNamesAcrossScopes,
  getPluginRefCompletions,
  getPluginToMarketplacesMap,
  splitCompletionInput,
} from "../../../extensions/pi-claude-marketplace/edge/completions/data.ts";
import { resetCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type {
  LocationsResolver,
  MarketplaceStateRecord,
  PluginMapOptions,
  PluginRefCompletionMode,
} from "../../../extensions/pi-claude-marketplace/edge/completions/data.ts";
import type { PluginIndexRow } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

/** Marketplace records and manifest rows a single case makes visible per scope. */
interface ResolverSeed {
  readonly marketplaces?: Partial<Record<Scope, Record<string, MarketplaceStateRecord>>>;
  readonly manifests?: Partial<Record<Scope, Record<string, readonly PluginIndexRow[]>>>;
  /** Scopes whose state read rejects, so a propagation case can seed one side. */
  readonly stateFailures?: Partial<Record<Scope, Error>>;
}

interface SeededResolver {
  readonly resolver: LocationsResolver;
  /**
   * How many times the case reached the replaced process-wide transport.
   * Declared as a property rather than a method so a case can destructure it
   * without tripping the unbound-method rule.
   */
  readonly networkCallCount: () => number;
}

function refuseNetwork(): Promise<Response> {
  throw new Error("the completion data layer must not reach the network");
}

/**
 * Replace the process-wide transport with a fail-fast stub owned by the test
 * context, which restores it after the case. The returned counter is what every
 * case asserts against; a case never matches the refusal message.
 */
function installOfflineGuard(t: TestContext): () => number {
  const networkSpy = t.mock.method(globalThis, "fetch", refuseNetwork);
  return (): number => networkSpy.mock.callCount();
}

/**
 * One temporary cache root per case. Removal and the process-global
 * completion-cache reset are registered before the module under test runs, so an
 * early throw still unwinds them.
 *
 * No environment is substituted here. Neither `data.ts`, `shared/completion-
 * cache.ts` nor anything else in their import closure reads `process.env`,
 * `homedir()` or `getAgentDir()` -- every path this module touches arrives
 * through the injected resolver or through the cache path the resolver hands
 * back. A `HOME` substitution would change nothing observable, so this helper
 * does not carry one.
 */
async function seedResolver(
  t: TestContext,
  label: string,
  seed: ResolverSeed,
): Promise<SeededResolver> {
  resetCompletionCache();
  const cacheRoot = await mkdtemp(path.join(tmpdir(), `completions-data-${label}-cache-`));
  t.after(async () => {
    resetCompletionCache();
    await rm(cacheRoot, { recursive: true, force: true });
  });
  const networkCallCount = installOfflineGuard(t);

  const resolver = {
    marketplaceNamesCachePath: (scope: Scope): string =>
      path.join(cacheRoot, scope, "marketplace-names.json"),

    pluginCachePath: (scope: Scope, marketplace: string): Promise<string> =>
      Promise.resolve(path.join(cacheRoot, scope, "plugins", `${marketplace}.json`)),

    loadStateForScope: (
      scope: Scope,
    ): Promise<{ marketplaces: Record<string, MarketplaceStateRecord> }> => {
      const failure = seed.stateFailures?.[scope];
      if (failure !== undefined) {
        return Promise.reject(failure);
      }

      return Promise.resolve({ marketplaces: seed.marketplaces?.[scope] ?? {} });
    },

    loadManifestForMarketplace: (
      scope: Scope,
      marketplace: string,
    ): Promise<readonly PluginIndexRow[]> => {
      const rows = seed.manifests?.[scope]?.[marketplace];
      if (rows === undefined) {
        return Promise.reject(new Error(`no manifest seeded for ${scope}/${marketplace}`));
      }

      return Promise.resolve(rows);
    },
  } satisfies LocationsResolver;

  return { resolver, networkCallCount };
}

/** Every derived status the plugin-index cache can carry, in one marketplace. */
function everyStatusManifest(): readonly PluginIndexRow[] {
  return [
    { name: "held", status: "installed" },
    { name: "outdated", status: "upgradable" },
    { name: "held-partly", status: "partially-installed" },
    { name: "held-partly-outdated", status: "partially-installed-upgradable" },
    { name: "outdated-partly", status: "partially-upgradable" },
    { name: "fresh", status: "available" },
    { name: "not-fetched", status: "remote" },
    { name: "broken", status: "unavailable" },
    { name: "degraded", status: "partially-available" },
  ];
}

/** The five modes `getPluginToMarketplacesMap` routes to the installed inventory. */
const INSTALLED_INVENTORY_MODES: readonly PluginRefCompletionMode[] = [
  "uninstall",
  "update",
  "reinstall",
  "enable",
  "disable",
];

describe("buildItem", () => {
  for (const { argumentTextPrefix, itemText, appendSpace, expectedValue } of [
    { argumentTextPrefix: "", itemText: "install", appendSpace: true, expectedValue: "install " },
    { argumentTextPrefix: "", itemText: "install", appendSpace: false, expectedValue: "install" },
    {
      argumentTextPrefix: "install",
      itemText: "alpha@official",
      appendSpace: true,
      expectedValue: "install alpha@official ",
    },
    {
      argumentTextPrefix: "install",
      itemText: "alpha@",
      appendSpace: false,
      expectedValue: "install alpha@",
    },
  ]) {
    test(`replaces the whole argument text with ${JSON.stringify(expectedValue)}`, () => {
      // act
      const item = buildItem(argumentTextPrefix, itemText, appendSpace);

      // assert
      assert.deepStrictEqual(item, { label: itemText, value: expectedValue });
    });
  }
});

describe("splitCompletionInput", () => {
  for (const { input, tokens, current } of [
    { input: "", tokens: [], current: "" },
    { input: "inst", tokens: [], current: "inst" },
    { input: "install alph", tokens: ["install"], current: "alph" },
    { input: "install alpha@official ", tokens: ["install", "alpha@official"], current: "" },
    { input: "install   alpha@official", tokens: ["install"], current: "alpha@official" },
    { input: "   ", tokens: [], current: "" },
  ] satisfies readonly { input: string; tokens: string[]; current: string }[]) {
    test(`splits ${JSON.stringify(input)} into ${String(tokens.length)} finished token(s) and ${JSON.stringify(current)}`, () => {
      // act
      const split = splitCompletionInput(input);

      // assert
      assert.deepStrictEqual(split, { tokens, current });
    });
  }
});

describe("extractPositionals", () => {
  test("returns every token when no flag vocabulary is present", () => {
    // arrange
    const tokens = ["install", "alpha@official"];

    // act
    const positionals = extractPositionals(tokens);

    // assert
    assert.deepStrictEqual(positionals, ["install", "alpha@official"]);
  });

  for (const { position, tokens } of [
    { position: "leading", tokens: ["--scope", "project", "install", "alpha@official"] },
    { position: "interior", tokens: ["install", "--scope", "project", "alpha@official"] },
    { position: "trailing", tokens: ["install", "alpha@official", "--scope", "project"] },
  ] satisfies readonly { position: string; tokens: string[] }[]) {
    test(`recovers the same positionals with a ${position} scope flag pair`, () => {
      // act
      const positionals = extractPositionals(tokens);

      // assert
      assert.deepStrictEqual(positionals, ["install", "alpha@official"]);
    });
  }

  test("consumes the scope flag pair even when its value is missing", () => {
    // arrange
    const tokens = ["install", "--scope"];

    // act
    const positionals = extractPositionals(tokens);

    // assert
    assert.deepStrictEqual(positionals, ["install"]);
  });

  test("drops a declared boolean flag without consuming the token after it", () => {
    // arrange
    const tokens = ["install", "--partial", "alpha@official"];

    // act
    const positionals = extractPositionals(tokens, ["--partial"]);

    // assert
    assert.deepStrictEqual(positionals, ["install", "alpha@official"]);
  });

  test("keeps an undeclared flag-shaped token as a positional", () => {
    // arrange
    const tokens = ["install", "--undeclared"];

    // act
    const positionals = extractPositionals(tokens, ["--partial"]);

    // assert
    assert.deepStrictEqual(positionals, ["install", "--undeclared"]);
  });

  test("skips a hole left by a sparse token list", () => {
    // arrange
    const tokens: string[] = ["install"];
    tokens[2] = "alpha@official";

    // act
    const positionals = extractPositionals(tokens, ["--partial"]);

    // assert
    assert.deepStrictEqual(positionals, ["install", "alpha@official"]);
  });
});

describe("extractScope", () => {
  for (const { tokens, expectedScope } of [
    { tokens: ["--scope", "user"], expectedScope: "user" },
    { tokens: ["--scope", "project"], expectedScope: "project" },
  ] satisfies readonly { tokens: string[]; expectedScope: Scope }[]) {
    test(`reads the ${expectedScope} scope out of the token list`, () => {
      // act
      const scope = extractScope(tokens);

      // assert
      assert.strictEqual(scope, expectedScope);
    });
  }

  for (const { situation, tokens } of [
    { situation: "the flag is absent", tokens: ["install", "alpha@official"] },
    { situation: "the flag carries an unrecognised value", tokens: ["--scope", "local"] },
    { situation: "the flag has no value after it", tokens: ["install", "--scope"] },
  ] satisfies readonly { situation: string; tokens: string[] }[]) {
    test(`returns no scope when ${situation}`, () => {
      // act
      const scope = extractScope(tokens);

      // assert
      assert.strictEqual(scope, undefined);
    });
  }

  test("keeps scanning past an unrecognised value and reads a later valid one", () => {
    // arrange
    const tokens = ["--scope", "local", "--scope", "project"];

    // act
    const scope = extractScope(tokens);

    // assert
    assert.strictEqual(scope, "project");
  });
});

describe("getMarketplaceCompletions", () => {
  test("keeps only the prefix matches and terminates each with a space", () => {
    // arrange
    const names = ["official", "other", "internal"];

    // act
    const items = getMarketplaceCompletions(names, "o", "marketplace info");

    // assert
    assert.deepStrictEqual(items, [
      { label: "official", value: "marketplace info official " },
      { label: "other", value: "marketplace info other " },
    ]);
  });

  test("preserves the caller's order and repeats an equal name in place", () => {
    // arrange
    const names = ["zeta", "alpha", "zeta"];

    // act
    const items = getMarketplaceCompletions(names, "", "");

    // assert
    assert.deepStrictEqual(items, [
      { label: "zeta", value: "zeta " },
      { label: "alpha", value: "alpha " },
      { label: "zeta", value: "zeta " },
    ]);
  });

  test("matches the partial token case-sensitively, with no case folding", () => {
    // arrange
    const names = ["Official"];

    // act
    const lowerCaseMatches = getMarketplaceCompletions(names, "o", "");
    const exactCaseMatches = getMarketplaceCompletions(names, "O", "");

    // assert
    assert.deepStrictEqual(lowerCaseMatches, []);
    assert.deepStrictEqual(exactCaseMatches, [{ label: "Official", value: "Official " }]);
  });
});

describe("getMarketplaceNamesAcrossScopes", () => {
  test("unions both scopes in first-seen order and records a shared name once", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "names-union", {
      marketplaces: {
        user: { zeta: {}, shared: {} },
        project: { shared: {}, beta: {} },
      },
    });

    // act
    const names = await getMarketplaceNamesAcrossScopes(resolver);

    // assert
    assert.deepStrictEqual([...names], ["zeta", "shared", "beta"]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("returns the names when only one scope holds a marketplace", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "names-one-scope", {
      marketplaces: { project: { internal: {} } },
    });

    // act
    const names = await getMarketplaceNamesAcrossScopes(resolver);

    // assert
    assert.deepStrictEqual([...names], ["internal"]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("returns an empty union when neither scope has a marketplace", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "names-empty", {});

    // act
    const names = await getMarketplaceNamesAcrossScopes(resolver);

    // assert
    assert.deepStrictEqual([...names], []);
    assert.strictEqual(networkCallCount(), 0);
  });

  for (const failingScope of ["user", "project"] satisfies readonly Scope[]) {
    test(`propagates a ${failingScope} state read failure instead of a partial union`, async (t) => {
      // arrange
      const stateFailure = new Error(`state is unreadable for ${failingScope}`);
      const { resolver, networkCallCount } = await seedResolver(t, `names-fail-${failingScope}`, {
        marketplaces: { user: { zeta: {} }, project: { beta: {} } },
        stateFailures: { [failingScope]: stateFailure },
      });

      // act & assert
      await assert.rejects(
        () => getMarketplaceNamesAcrossScopes(resolver),
        (error: unknown) => {
          assert.strictEqual(error, stateFailure);
          return true;
        },
      );
      assert.strictEqual(networkCallCount(), 0);
    });
  }
});

describe("getPluginToMarketplacesMap", () => {
  test("install offers the not-yet-installed and not-yet-fetched rows of the default user scope", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-install", {
      marketplaces: { user: { official: {} } },
      manifests: { user: { official: everyStatusManifest() } },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("install", resolver);

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [
      ["fresh", ["official"]],
      ["not-fetched", ["official"]],
    ]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("install with the partial option trades the not-fetched row for the degraded one", async (t) => {
    // arrange
    const options = { partial: true } satisfies PluginMapOptions;
    const { resolver, networkCallCount } = await seedResolver(t, "map-install-partial", {
      marketplaces: { user: { official: {} } },
      manifests: { user: { official: everyStatusManifest() } },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("install", resolver, options);

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [
      ["fresh", ["official"]],
      ["degraded", ["official"]],
    ]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("install excludes a plugin already recorded in the target scope (CMP-7)", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-install-recorded", {
      marketplaces: { user: { official: { plugins: { held: {} } } } },
      manifests: {
        user: {
          official: [
            { name: "held", status: "available" },
            { name: "fresh", status: "available" },
          ],
        },
      },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("install", resolver);

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [["fresh", ["official"]]]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("a project install reads project marketplaces first and falls back to unshadowed user ones (CMP-8)", async (t) => {
    // arrange
    const options = { targetScope: "project" } satisfies PluginMapOptions;
    const { resolver, networkCallCount } = await seedResolver(t, "map-install-project", {
      marketplaces: {
        user: { official: {}, "user-only-mp": {} },
        project: { official: {} },
      },
      manifests: {
        user: {
          official: [{ name: "user-side", status: "available" }],
          "user-only-mp": [{ name: "extra", status: "available" }],
        },
        project: { official: [{ name: "project-side", status: "available" }] },
      },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("install", resolver, options);

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [
      ["project-side", ["official"]],
      ["extra", ["user-only-mp"]],
    ]);
    assert.strictEqual(networkCallCount(), 0);
  });

  for (const mode of INSTALLED_INVENTORY_MODES) {
    test(`${mode} offers the whole installed inventory and nothing outside it`, async (t) => {
      // arrange
      const { resolver, networkCallCount } = await seedResolver(t, `map-inventory-${mode}`, {
        marketplaces: { user: { official: {} } },
        manifests: { user: { official: everyStatusManifest() } },
      });

      // act
      const candidatesByPlugin = await getPluginToMarketplacesMap(mode, resolver);

      // assert
      assert.deepStrictEqual(Array.from(candidatesByPlugin), [
        ["held", ["official"]],
        ["outdated", ["official"]],
        ["held-partly", ["official"]],
        ["held-partly-outdated", ["official"]],
        ["outdated-partly", ["official"]],
      ]);
      assert.strictEqual(networkCallCount(), 0);
    });
  }

  for (const mode of INSTALLED_INVENTORY_MODES) {
    test(`the partial option narrows ${mode} to the rows with a newer candidate`, async (t) => {
      // arrange
      const { resolver, networkCallCount } = await seedResolver(
        t,
        `map-inventory-partial-${mode}`,
        {
          marketplaces: { user: { official: {} } },
          manifests: { user: { official: everyStatusManifest() } },
        },
      );

      // act
      const candidatesByPlugin = await getPluginToMarketplacesMap(mode, resolver, {
        partial: true,
      });

      // assert
      assert.deepStrictEqual(Array.from(candidatesByPlugin), [
        ["outdated", ["official"]],
        ["held-partly-outdated", ["official"]],
        ["outdated-partly", ["official"]],
      ]);
      assert.strictEqual(networkCallCount(), 0);
    });
  }

  test("an installed-inventory mode without an explicit scope reads project before user", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-inventory-both", {
      marketplaces: { user: { official: {} }, project: { internal: {} } },
      manifests: {
        user: { official: [{ name: "user-side", status: "installed" }] },
        project: { internal: [{ name: "project-side", status: "installed" }] },
      },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("uninstall", resolver);

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [
      ["project-side", ["internal"]],
      ["user-side", ["official"]],
    ]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("an explicit target scope narrows an installed-inventory mode to that scope alone", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-inventory-scoped", {
      marketplaces: { user: { official: {} }, project: { internal: {} } },
      manifests: {
        user: { official: [{ name: "user-side", status: "installed" }] },
        project: { internal: [{ name: "project-side", status: "installed" }] },
      },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("uninstall", resolver, {
      targetScope: "user",
    });

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [["user-side", ["official"]]]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("fetch offers the warm and warmable rows and ignores the partial option", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-fetch", {
      marketplaces: { user: { official: {} } },
      manifests: { user: { official: everyStatusManifest() } },
    });

    // act
    const withoutPartial = await getPluginToMarketplacesMap("fetch", resolver);
    const withPartial = await getPluginToMarketplacesMap("fetch", resolver, { partial: true });

    // assert
    assert.deepStrictEqual(Array.from(withoutPartial), [
      ["fresh", ["official"]],
      ["not-fetched", ["official"]],
      ["broken", ["official"]],
      ["degraded", ["official"]],
    ]);
    assert.deepStrictEqual(Array.from(withPartial), Array.from(withoutPartial));
    assert.strictEqual(networkCallCount(), 0);
  });

  test("an explicit target scope narrows fetch to that scope alone", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-fetch-scoped", {
      marketplaces: { user: { official: {} }, project: { internal: {} } },
      manifests: {
        user: { official: [{ name: "user-side", status: "remote" }] },
        project: { internal: [{ name: "project-side", status: "remote" }] },
      },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("fetch", resolver, {
      targetScope: "project",
    });

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [["project-side", ["internal"]]]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("info spans both scopes with no status filter and ignores the target scope", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-info", {
      marketplaces: { user: { official: {} }, project: { internal: {} } },
      manifests: {
        user: {
          official: [
            { name: "held", status: "installed" },
            { name: "broken", status: "unavailable" },
          ],
        },
        project: { internal: [{ name: "fresh", status: "available" }] },
      },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("info", resolver, {
      targetScope: "project",
      partial: true,
    });

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [
      ["held", ["official"]],
      ["broken", ["official"]],
      ["fresh", ["internal"]],
    ]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("a plugin carried by two marketplaces records both in visit order", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-two-marketplaces", {
      marketplaces: { user: { "mp-a": {}, "mp-b": {} } },
      manifests: {
        user: {
          "mp-a": [{ name: "shared", status: "installed" }],
          "mp-b": [{ name: "shared", status: "installed" }],
        },
      },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("uninstall", resolver);

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [["shared", ["mp-a", "mp-b"]]]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("a marketplace named in both scopes is recorded once for the same plugin", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-same-name-both-scopes", {
      marketplaces: { user: { official: {} }, project: { official: {} } },
      manifests: {
        user: { official: [{ name: "held", status: "installed" }] },
        project: { official: [{ name: "held", status: "installed" }] },
      },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("uninstall", resolver);

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [["held", ["official"]]]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("a marketplace whose manifest cannot be loaded contributes no candidates (TC-8)", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "map-manifest-soft-fail", {
      marketplaces: { user: { official: {}, "unreadable-mp": {} } },
      manifests: { user: { official: [{ name: "held", status: "installed" }] } },
    });

    // act
    const candidatesByPlugin = await getPluginToMarketplacesMap("uninstall", resolver);

    // assert
    assert.deepStrictEqual(Array.from(candidatesByPlugin), [["held", ["official"]]]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("a state read failure during the candidate sweep propagates (TC-9)", async (t) => {
    // arrange
    const stateFailure = new Error("state is unreadable for project");
    const { resolver, networkCallCount } = await seedResolver(t, "map-state-fail", {
      marketplaces: { user: { official: {} } },
      manifests: { user: { official: [{ name: "held", status: "installed" }] } },
      stateFailures: { project: stateFailure },
    });

    // act & assert
    await assert.rejects(
      () => getPluginToMarketplacesMap("uninstall", resolver),
      (error: unknown) => {
        assert.strictEqual(error, stateFailure);
        return true;
      },
    );
    assert.strictEqual(networkCallCount(), 0);
  });
});

describe("getPluginRefCompletions", () => {
  const twoMarketplaceSeed = (): ResolverSeed => ({
    marketplaces: { user: { "mp-a": {}, "mp-b": {} } },
    manifests: {
      user: {
        "mp-a": [
          { name: "solo", status: "installed" },
          { name: "shared", status: "installed" },
        ],
        "mp-b": [{ name: "shared", status: "installed" }],
      },
    },
  });

  test("the plugin half offers a fully qualified value for a plugin unique to one marketplace", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(
      t,
      "ref-unique",
      twoMarketplaceSeed(),
    );

    // act
    const items = await getPluginRefCompletions("update", "so", "update", resolver, {
      allowMarketplaceOnly: true,
    });

    // assert
    assert.deepStrictEqual(items, [{ label: "solo@mp-a", value: "update solo@mp-a " }]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("the plugin half stops at the separator for a plugin carried by two marketplaces", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "ref-multi", twoMarketplaceSeed());

    // act
    const items = await getPluginRefCompletions("update", "sh", "update", resolver, {
      allowMarketplaceOnly: true,
    });

    // assert
    assert.deepStrictEqual(items, [{ label: "shared@", value: "update shared@" }]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("the plugin half keeps every candidate in map order when the partial token is empty", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "ref-all", twoMarketplaceSeed());

    // act
    const items = await getPluginRefCompletions("update", "", "", resolver, {
      allowMarketplaceOnly: true,
    });

    // assert
    assert.deepStrictEqual(items, [
      { label: "solo@mp-a", value: "solo@mp-a " },
      { label: "shared@", value: "shared@" },
    ]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("the plugin half matches the partial token case-sensitively, with no case folding", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "ref-case", twoMarketplaceSeed());

    // act
    const upperCaseMatches = await getPluginRefCompletions("update", "SO", "update", resolver, {
      allowMarketplaceOnly: true,
    });
    const exactCaseMatches = await getPluginRefCompletions("update", "so", "update", resolver, {
      allowMarketplaceOnly: true,
    });

    // assert
    assert.deepStrictEqual(upperCaseMatches, []);
    assert.deepStrictEqual(exactCaseMatches, [{ label: "solo@mp-a", value: "update solo@mp-a " }]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("the marketplace half offers only the marketplaces that carry the named plugin", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(
      t,
      "ref-mp-half",
      twoMarketplaceSeed(),
    );

    // act
    const items = await getPluginRefCompletions("update", "shared@mp-", "update", resolver, {
      allowMarketplaceOnly: true,
    });

    // assert
    assert.deepStrictEqual(items, [
      { label: "shared@mp-a", value: "update shared@mp-a " },
      { label: "shared@mp-b", value: "update shared@mp-b " },
    ]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("the marketplace half narrows to the typed marketplace prefix", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(
      t,
      "ref-mp-half-narrow",
      twoMarketplaceSeed(),
    );

    // act
    const items = await getPluginRefCompletions("update", "shared@mp-b", "update", resolver, {
      allowMarketplaceOnly: true,
    });

    // assert
    assert.deepStrictEqual(items, [{ label: "shared@mp-b", value: "update shared@mp-b " }]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("the marketplace half offers nothing for a plugin no marketplace carries", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(
      t,
      "ref-mp-half-unknown",
      twoMarketplaceSeed(),
    );

    // act
    const items = await getPluginRefCompletions("update", "ghost@", "update", resolver, {
      allowMarketplaceOnly: true,
    });

    // assert
    assert.deepStrictEqual(items, []);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("the bare marketplace form lists each marketplace once when the mode allows it", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "ref-bare", twoMarketplaceSeed());

    // act
    const items = await getPluginRefCompletions("update", "@", "update", resolver, {
      allowMarketplaceOnly: true,
    });

    // assert
    assert.deepStrictEqual(items, [
      { label: "@mp-a", value: "update @mp-a " },
      { label: "@mp-b", value: "update @mp-b " },
    ]);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("the bare marketplace form narrows to the typed marketplace prefix", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(
      t,
      "ref-bare-narrow",
      twoMarketplaceSeed(),
    );

    // act
    const items = await getPluginRefCompletions("update", "@mp-b", "update", resolver, {
      allowMarketplaceOnly: true,
    });

    // assert
    assert.deepStrictEqual(items, [{ label: "@mp-b", value: "update @mp-b " }]);
    assert.strictEqual(networkCallCount(), 0);
  });

  // The mode is held at `update`, so this differs from the accepting case two
  // above it in the flag alone. Under `install` the seed's three installed rows
  // match no install-candidate status, the candidate map is empty, and the
  // result would be `[]` with the flag either way -- nothing would be measured.
  test("the bare marketplace form offers nothing when the mode does not allow it", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(
      t,
      "ref-bare-denied",
      twoMarketplaceSeed(),
    );

    // act
    const items = await getPluginRefCompletions("update", "@", "update", resolver, {
      allowMarketplaceOnly: false,
    });

    // assert
    assert.deepStrictEqual(items, []);
    assert.strictEqual(networkCallCount(), 0);
  });

  test("the plugin half honours the target scope and the partial option it is given", async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "ref-options", {
      marketplaces: { user: { official: {} }, project: { internal: {} } },
      manifests: {
        user: { official: everyStatusManifest() },
        project: { internal: [{ name: "project-side", status: "upgradable" }] },
      },
    });

    // act
    const items = await getPluginRefCompletions("update", "", "update", resolver, {
      allowMarketplaceOnly: false,
      targetScope: "user",
      partial: true,
    });

    // assert
    assert.deepStrictEqual(items, [
      { label: "outdated@official", value: "update outdated@official " },
      { label: "held-partly-outdated@official", value: "update held-partly-outdated@official " },
      { label: "outdated-partly@official", value: "update outdated-partly@official " },
    ]);
    assert.strictEqual(networkCallCount(), 0);
  });
});
