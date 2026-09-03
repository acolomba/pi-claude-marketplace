// Owner suite for `edge/completions/provider.ts::getArgumentCompletions`, the
// single entry point Pi calls for every keystroke of `/claude:plugin`.
//
// The provider composes three settled surfaces: the subcommand vocabularies
// exported by `edge/router.ts`, the per-verb flag entries exported by
// `edge/flag-catalog.ts`, and the candidate maps built by
// `edge/completions/data.ts`. What this suite owns is the COMPOSITION -- which
// vocabulary appears at which cursor position, which head maps to which
// completion mode, and how each emitted item rebuilds the whole argument text.
// The contents of each source stay with that source's own owner:
//
//   - the tokenizer, the status filtering behind every candidate map, and the
//     `<plugin>@<marketplace>` split belong to
//     `tests/edge/completions/data.test.ts`;
//   - the per-verb completable flag SET is pinned exactly, per verb and for the
//     `ls` alias, by `tests/architecture/flag-catalog-drift.test.ts`, which
//     excludes the global scope flag. What stays here is that the provider
//     PREPENDS that global entry, where it lands, and what each item's value
//     and description are;
//   - the retired partial vocabulary is forbidden by
//     `tests/architecture/partial-vocabulary-guard.test.ts`.
//
// Every expected candidate list below is hand-authored, compared unsorted and
// whole, and never derived from the module under test or from a constant the
// module itself reads. That includes the scope value pair: the drift guard in
// `tests/architecture/scope-order-drift.test.ts` walks `extensions/` only, so
// it never reaches a test file, and re-reading `SCOPES` here would make the
// order claim circular.
//
// This surface is read-only and must never reach the network (NFR-5). Every
// case installs a context-owned fail-fast replacement for the process-wide
// transport and asserts its call count is zero. The count is the proof; the
// refusal message never is.
//
// Five heads -- uninstall, update, reinstall, enable and disable -- map to
// modes that share ONE candidate map in the data layer, so their lists are
// identical by construction. Each row's claim is the head-to-mode mapping, and
// it discriminates because install, fetch and info reach different maps: a head
// rerouted to any of those three changes its list. Each head is driven twice
// more, at an `@` cursor and with an explicit scope, because the rest of its
// branch configuration -- whether the bare `@<marketplace>` form is accepted,
// and whether an explicit scope reaches the candidate map -- is invisible at a
// plain plugin cursor.
//
// `pluginRefBranchConfig` switches on an open `string` peeled from raw user
// input and ends with a `default` arm, so this pair carries NO exhaustiveness
// claim. A deleted arm is a behavior change, not a compiler diagnostic, and a
// missing-arm plant has no target here.
//
// D-116-01a: this pair lands one branch short of complete. The empty-object
// side of the conditional at provider.ts:125 -- the `description === undefined`
// arm of `optionalDescription` -- cannot be entered at runtime. The only two
// producers of the entry list in `flagCompletions` are a written-out literal
// that carries a description and `completionFlagEntries`, whose every element
// is built from a `FlagEntry` whose `description` field is REQUIRED. The
// declared element type keeps `description` optional, so the guard must exist;
// nothing reachable through the module's single export can supply an entry
// without one. The reason is structural, not a compiler setting.
//
// The claim is measured, not inspected: a plant replacing the empty-object arm
// with a distinguishable description left every case green, and an independent
// route drove every top-level head, every marketplace subcommand and two
// unknown heads at a long-flag cursor and found every emitted item carrying a
// description. The shortfall is pinned by its identity -- functions and lines
// complete, exactly ONE uncovered branch -- never by an absolute branch pair,
// because the branch denominator tracks suite strength rather than the source.
// No coverage exception is added and no production file is changed.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { getArgumentCompletions } from "../../../extensions/pi-claude-marketplace/edge/completions/provider.ts";
import { resetCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";

import type {
  LocationsResolver,
  MarketplaceStateRecord,
} from "../../../extensions/pi-claude-marketplace/edge/completions/data.ts";
import type { PluginIndexRow } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

/** The shape of one emitted suggestion, written out rather than imported. */
interface Suggestion {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
}

interface SeededResolver {
  readonly resolver: LocationsResolver;
  /**
   * How often the case reached the replaced process-wide transport. Declared
   * as a property rather than a method so a case can destructure it without
   * tripping the unbound-method rule.
   */
  readonly networkCallCount: () => number;
}

/**
 * The user-scope marketplace. Its rows span the installed inventory, the two
 * not-yet-installed buckets install accepts, the degraded bucket only the
 * partial install accepts, and the broken bucket only fetch accepts.
 */
function hubManifest(): readonly PluginIndexRow[] {
  return [
    { name: "held", status: "installed" },
    { name: "outdated", status: "upgradable" },
    { name: "fresh", status: "available" },
    { name: "not-fetched", status: "remote" },
    { name: "degraded", status: "partially-available" },
    { name: "broken", status: "unavailable" },
  ];
}

/** The project-scope marketplace, so an explicit scope flag changes the list. */
function labManifest(): readonly PluginIndexRow[] {
  return [
    { name: "lab-held", status: "installed" },
    { name: "lab-fresh", status: "available" },
  ];
}

function marketplacesForScope(scope: Scope): Record<string, MarketplaceStateRecord> {
  return scope === "user" ? { hub: { plugins: {} } } : { lab: { plugins: {} } };
}

function manifestFor(scope: Scope, marketplace: string): readonly PluginIndexRow[] | undefined {
  if (scope === "user" && marketplace === "hub") {
    return hubManifest();
  }

  if (scope === "project" && marketplace === "lab") {
    return labManifest();
  }

  return undefined;
}

function refuseNetwork(): Promise<Response> {
  throw new Error("the completion provider must not reach the network");
}

/**
 * One temporary cache root and one temporary home per case, with the
 * agent-directory variable deleted so no ambient value can redirect a write.
 * Removal, both environment restores and the process-global completion-cache
 * reset are registered before the act, so an early throw still unwinds them.
 */
async function seedResolver(t: TestContext, label: string): Promise<SeededResolver> {
  resetCompletionCache();
  const cacheRoot = await mkdtemp(path.join(tmpdir(), `provider-${label}-cache-`));
  const home = await mkdtemp(path.join(tmpdir(), `provider-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(async () => {
    if (homeExisted) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    resetCompletionCache();
    await rm(cacheRoot, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  const networkSpy = t.mock.method(globalThis, "fetch", refuseNetwork);

  const resolver = {
    marketplaceNamesCachePath: (scope: Scope): string =>
      path.join(cacheRoot, scope, "marketplace-names.json"),

    pluginCachePath: (scope: Scope, marketplace: string): Promise<string> =>
      Promise.resolve(path.join(cacheRoot, scope, "plugins", `${marketplace}.json`)),

    loadStateForScope: (
      scope: Scope,
    ): Promise<{ marketplaces: Record<string, MarketplaceStateRecord> }> =>
      Promise.resolve({ marketplaces: marketplacesForScope(scope) }),

    loadManifestForMarketplace: (
      scope: Scope,
      marketplace: string,
    ): Promise<readonly PluginIndexRow[]> => {
      const rows = manifestFor(scope, marketplace);
      if (rows === undefined) {
        return Promise.reject(new Error(`no manifest seeded for ${scope}/${marketplace}`));
      }

      return Promise.resolve(rows);
    },
  } satisfies LocationsResolver;

  return { resolver, networkCallCount: (): number => networkSpy.mock.callCount() };
}

// ---------------------------------------------------------------------------
// TC-1: the top-level subcommand vocabulary.
// ---------------------------------------------------------------------------

test("TC-1 offers the whole top-level vocabulary at an empty prefix, in declaration order", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "top-level-empty");

  // act
  const suggestions = await getArgumentCompletions("", resolver);

  // assert
  assert.deepStrictEqual(suggestions, [
    { label: "bootstrap", value: "bootstrap " },
    { label: "install", value: "install " },
    { label: "uninstall", value: "uninstall " },
    { label: "update", value: "update " },
    { label: "fetch", value: "fetch " },
    { label: "reinstall", value: "reinstall " },
    { label: "list", value: "list " },
    { label: "ls", value: "ls " },
    { label: "info", value: "info " },
    { label: "pending", value: "pending " },
    { label: "enable", value: "enable " },
    { label: "disable", value: "disable " },
    { label: "import", value: "import " },
    { label: "marketplace", value: "marketplace " },
  ]);
  assert.strictEqual(networkCallCount(), 0);
});

for (const { prefix, expected } of [
  { prefix: "ins", expected: [{ label: "install", value: "install " }] },
  {
    prefix: "l",
    expected: [
      { label: "list", value: "list " },
      { label: "ls", value: "ls " },
    ],
  },
  { prefix: "INS", expected: [] },
  { prefix: "frob", expected: [] },
] satisfies readonly { prefix: string; expected: readonly Suggestion[] }[]) {
  test(`TC-1 narrows the top-level vocabulary to ${String(expected.length)} entr(ies) for ${JSON.stringify(prefix)}`, async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, `top-level-${prefix}`);

    // act
    const suggestions = await getArgumentCompletions(prefix, resolver);

    // assert
    assert.deepStrictEqual(suggestions, expected);
    assert.strictEqual(networkCallCount(), 0);
  });
}

// ---------------------------------------------------------------------------
// Exact-token promotion: an exact subcommand token advances the cursor to the
// next argument instead of re-offering the subcommand. The one-character-short
// partner is what makes the promotion observable.
// ---------------------------------------------------------------------------

test("a top-level token one character short still offers the subcommand vocabulary", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "promote-short");

  // act
  const suggestions = await getArgumentCompletions("marketplac", resolver);

  // assert
  assert.deepStrictEqual(suggestions, [{ label: "marketplace", value: "marketplace " }]);
  assert.strictEqual(networkCallCount(), 0);
});

test("TC-2 promotes an exact top-level token with no trailing space to the next argument", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "promote-exact");

  // act
  const suggestions = await getArgumentCompletions("marketplace", resolver);

  // assert
  assert.deepStrictEqual(suggestions, [
    { label: "add", value: "marketplace add " },
    { label: "remove", value: "marketplace remove " },
    { label: "rm", value: "marketplace rm " },
    { label: "list", value: "marketplace list " },
    { label: "ls", value: "marketplace ls " },
    { label: "info", value: "marketplace info " },
    { label: "update", value: "marketplace update " },
    { label: "autoupdate", value: "marketplace autoupdate " },
    { label: "noautoupdate", value: "marketplace noautoupdate " },
  ]);
  assert.strictEqual(networkCallCount(), 0);
});

test("TC-2 offers the marketplace vocabulary after the marketplace token and a space", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "marketplace-space");

  // act
  const suggestions = await getArgumentCompletions("marketplace ", resolver);

  // assert
  assert.deepStrictEqual(suggestions, [
    { label: "add", value: "marketplace add " },
    { label: "remove", value: "marketplace remove " },
    { label: "rm", value: "marketplace rm " },
    { label: "list", value: "marketplace list " },
    { label: "ls", value: "marketplace ls " },
    { label: "info", value: "marketplace info " },
    { label: "update", value: "marketplace update " },
    { label: "autoupdate", value: "marketplace autoupdate " },
    { label: "noautoupdate", value: "marketplace noautoupdate " },
  ]);
  assert.strictEqual(networkCallCount(), 0);
});

for (const { prefix, expected } of [
  {
    prefix: "marketplace r",
    expected: [
      { label: "remove", value: "marketplace remove " },
      { label: "rm", value: "marketplace rm " },
    ],
  },
  { prefix: "marketplace remov", expected: [{ label: "remove", value: "marketplace remove " }] },
  { prefix: "marketplace zz", expected: [] },
] satisfies readonly { prefix: string; expected: readonly Suggestion[] }[]) {
  test(`TC-2 narrows the marketplace vocabulary to ${String(expected.length)} entr(ies) for ${JSON.stringify(prefix)}`, async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "marketplace-narrow");

    // act
    const suggestions = await getArgumentCompletions(prefix, resolver);

    // assert
    assert.deepStrictEqual(suggestions, expected);
    assert.strictEqual(networkCallCount(), 0);
  });
}

test("TC-2 promotes an exact marketplace subcommand token to the name argument", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "promote-nested");

  // act
  const suggestions = await getArgumentCompletions("marketplace remove", resolver);

  // assert
  assert.deepStrictEqual(suggestions, [
    { label: "hub", value: "marketplace remove hub " },
    { label: "lab", value: "marketplace remove lab " },
  ]);
  assert.strictEqual(networkCallCount(), 0);
});

// ---------------------------------------------------------------------------
// TC-5: the marketplace-name argument.
// ---------------------------------------------------------------------------

for (const { prefix, expected } of [
  {
    prefix: "list ",
    expected: [
      { label: "hub", value: "list hub " },
      { label: "lab", value: "list lab " },
    ],
  },
  {
    prefix: "ls ",
    expected: [
      { label: "hub", value: "ls hub " },
      { label: "lab", value: "ls lab " },
    ],
  },
  {
    prefix: "marketplace remove ",
    expected: [
      { label: "hub", value: "marketplace remove hub " },
      { label: "lab", value: "marketplace remove lab " },
    ],
  },
  {
    prefix: "marketplace remove h",
    expected: [{ label: "hub", value: "marketplace remove hub " }],
  },
] satisfies readonly { prefix: string; expected: readonly Suggestion[] }[]) {
  test(`TC-5 offers marketplace names from both scopes for ${JSON.stringify(prefix)}`, async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "marketplace-names");

    // act
    const suggestions = await getArgumentCompletions(prefix, resolver);

    // assert
    assert.deepStrictEqual(suggestions, expected);
    assert.strictEqual(networkCallCount(), 0);
  });
}

test("TC-5 offers no name argument for a marketplace verb that takes none", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "marketplace-add");

  // act
  const suggestions = await getArgumentCompletions("marketplace add ", resolver);

  // assert
  assert.strictEqual(suggestions, null);
  assert.strictEqual(networkCallCount(), 0);
});

test("TC-5 offers nothing past the single marketplace name a list head accepts", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "list-surplus");

  // act
  const suggestions = await getArgumentCompletions("list hub ", resolver);

  // assert
  assert.strictEqual(suggestions, null);
  assert.strictEqual(networkCallCount(), 0);
});

// ---------------------------------------------------------------------------
// TC-4: the scope flag value list, offered after the scope flag and nowhere
// else. Every other position above and below compares its whole list, so the
// two scope values are asserted absent there by that comparison.
// ---------------------------------------------------------------------------

for (const { prefix, expected } of [
  {
    prefix: "install --scope ",
    expected: [
      { label: "user", value: "install --scope user " },
      { label: "project", value: "install --scope project " },
    ],
  },
  { prefix: "install --scope u", expected: [{ label: "user", value: "install --scope user " }] },
  {
    prefix: "--scope ",
    expected: [
      { label: "user", value: "--scope user " },
      { label: "project", value: "--scope project " },
    ],
  },
] satisfies readonly { prefix: string; expected: readonly Suggestion[] }[]) {
  test(`TC-4 offers the scope values after the scope flag for ${JSON.stringify(prefix)}`, async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "scope-values");

    // act
    const suggestions = await getArgumentCompletions(prefix, resolver);

    // assert
    assert.deepStrictEqual(suggestions, expected);
    assert.strictEqual(networkCallCount(), 0);
  });
}

test("TC-4 offers nothing for a scope flag pair that carries no subcommand", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "scope-only");

  // act
  const suggestions = await getArgumentCompletions("--scope user ", resolver);

  // assert
  assert.strictEqual(suggestions, null);
  assert.strictEqual(networkCallCount(), 0);
});

// ---------------------------------------------------------------------------
// TC-3: long-flag names. The per-verb SET is pinned by the flag-catalog drift
// guard; what these cases carry is the prepended global scope entry, its
// position, each item's rebuilt value, and the `ls` alias resolving to `list`.
// ---------------------------------------------------------------------------

test("TC-3 prepends the global scope flag before a verb's own completable flags", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "flags-install");

  // act
  const suggestions = await getArgumentCompletions("install -", resolver);

  // assert
  assert.deepStrictEqual(suggestions, [
    { label: "--scope", value: "install --scope ", description: "Scope: user or project" },
    {
      label: "--map-model",
      value: "install --map-model ",
      description: "Enable model field mapping in generated agents (default: omit)",
    },
    {
      label: "--partial",
      value: "install --partial ",
      description: "Install over collisions and unsupported components (not unavailable)",
    },
  ]);
  assert.strictEqual(networkCallCount(), 0);
});

test("TC-3 resolves the ls alias to the list flag entries", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "flags-ls");

  // act
  const suggestions = await getArgumentCompletions("ls -", resolver);

  // assert
  assert.deepStrictEqual(suggestions, [
    { label: "--scope", value: "ls --scope ", description: "Scope: user or project" },
    { label: "--installed", value: "ls --installed ", description: "Show installed plugins" },
    { label: "--available", value: "ls --available ", description: "Show available plugins" },
    { label: "--unavailable", value: "ls --unavailable ", description: "Show unavailable plugins" },
    {
      label: "--partial",
      value: "ls --partial ",
      description: "Show partially available plugins",
    },
    { label: "--remote", value: "ls --remote ", description: "Show remote plugins" },
  ]);
  assert.strictEqual(networkCallCount(), 0);
});

test("TC-3 offers the global scope flag alone for a head the catalog does not carry", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "flags-marketplace");

  // act
  const suggestions = await getArgumentCompletions("marketplace -", resolver);

  // assert
  assert.deepStrictEqual(suggestions, [
    { label: "--scope", value: "marketplace --scope ", description: "Scope: user or project" },
  ]);
  assert.strictEqual(networkCallCount(), 0);
});

test("TC-3 narrows the flag entries by the typed long-flag prefix", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "flags-narrow");

  // act
  const suggestions = await getArgumentCompletions("install --m", resolver);

  // assert
  assert.deepStrictEqual(suggestions, [
    {
      label: "--map-model",
      value: "install --map-model ",
      description: "Enable model field mapping in generated agents (default: omit)",
    },
  ]);
  assert.strictEqual(networkCallCount(), 0);
});

// ---------------------------------------------------------------------------
// TC-6: the plugin-reference argument. Each row names the completion mode its
// head maps to by hand. The seeded manifests carry rows eligible for one mode
// and not another, so a head rerouted to a different mode changes its list.
// ---------------------------------------------------------------------------

for (const { prefix, mode, expected } of [
  {
    prefix: "install ",
    mode: "install",
    expected: [
      { label: "fresh@hub", value: "install fresh@hub " },
      { label: "not-fetched@hub", value: "install not-fetched@hub " },
    ],
  },
  {
    prefix: "uninstall ",
    mode: "uninstall",
    expected: [
      { label: "lab-held@lab", value: "uninstall lab-held@lab " },
      { label: "held@hub", value: "uninstall held@hub " },
      { label: "outdated@hub", value: "uninstall outdated@hub " },
    ],
  },
  {
    prefix: "update ",
    mode: "update",
    expected: [
      { label: "lab-held@lab", value: "update lab-held@lab " },
      { label: "held@hub", value: "update held@hub " },
      { label: "outdated@hub", value: "update outdated@hub " },
    ],
  },
  {
    prefix: "fetch ",
    mode: "fetch",
    expected: [
      { label: "lab-fresh@lab", value: "fetch lab-fresh@lab " },
      { label: "fresh@hub", value: "fetch fresh@hub " },
      { label: "not-fetched@hub", value: "fetch not-fetched@hub " },
      { label: "degraded@hub", value: "fetch degraded@hub " },
      { label: "broken@hub", value: "fetch broken@hub " },
    ],
  },
  {
    prefix: "reinstall ",
    mode: "reinstall",
    expected: [
      { label: "lab-held@lab", value: "reinstall lab-held@lab " },
      { label: "held@hub", value: "reinstall held@hub " },
      { label: "outdated@hub", value: "reinstall outdated@hub " },
    ],
  },
  {
    prefix: "info ",
    mode: "info",
    expected: [
      { label: "held@hub", value: "info held@hub " },
      { label: "outdated@hub", value: "info outdated@hub " },
      { label: "fresh@hub", value: "info fresh@hub " },
      { label: "not-fetched@hub", value: "info not-fetched@hub " },
      { label: "degraded@hub", value: "info degraded@hub " },
      { label: "broken@hub", value: "info broken@hub " },
      { label: "lab-held@lab", value: "info lab-held@lab " },
      { label: "lab-fresh@lab", value: "info lab-fresh@lab " },
    ],
  },
  {
    prefix: "enable ",
    mode: "enable",
    expected: [
      { label: "lab-held@lab", value: "enable lab-held@lab " },
      { label: "held@hub", value: "enable held@hub " },
      { label: "outdated@hub", value: "enable outdated@hub " },
    ],
  },
  {
    prefix: "disable ",
    mode: "disable",
    expected: [
      { label: "lab-held@lab", value: "disable lab-held@lab " },
      { label: "held@hub", value: "disable held@hub " },
      { label: "outdated@hub", value: "disable outdated@hub " },
    ],
  },
] satisfies readonly { prefix: string; mode: string; expected: readonly Suggestion[] }[]) {
  test(`TC-6 completes plugin references for ${JSON.stringify(prefix)} through the ${mode} mode`, async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, `ref-${mode}`);

    // act
    const suggestions = await getArgumentCompletions(prefix, resolver);

    // assert
    assert.deepStrictEqual(suggestions, expected);
    assert.strictEqual(networkCallCount(), 0);
  });
}

// The other half of each head's branch configuration: whether the bare
// `@<marketplace>` form is accepted. It is invisible at a plain plugin cursor
// and is observable only at an `@` cursor, so each head is driven there too.
for (const { prefix, mode, expected } of [
  { prefix: "install @", mode: "install", expected: [] },
  { prefix: "uninstall @", mode: "uninstall", expected: [] },
  {
    prefix: "update @",
    mode: "update",
    expected: [
      { label: "@lab", value: "update @lab " },
      { label: "@hub", value: "update @hub " },
    ],
  },
  {
    prefix: "fetch @",
    mode: "fetch",
    expected: [
      { label: "@lab", value: "fetch @lab " },
      { label: "@hub", value: "fetch @hub " },
    ],
  },
  {
    prefix: "reinstall @",
    mode: "reinstall",
    expected: [
      { label: "@lab", value: "reinstall @lab " },
      { label: "@hub", value: "reinstall @hub " },
    ],
  },
  { prefix: "info @", mode: "info", expected: [] },
  { prefix: "enable @", mode: "enable", expected: [] },
  { prefix: "disable @", mode: "disable", expected: [] },
] satisfies readonly { prefix: string; mode: string; expected: readonly Suggestion[] }[]) {
  test(`TC-6 offers ${String(expected.length)} bare marketplace target(s) for ${JSON.stringify(prefix)}`, async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, `bare-${mode}`);

    // act
    const suggestions = await getArgumentCompletions(prefix, resolver);

    // assert
    assert.deepStrictEqual(suggestions, expected);
    assert.strictEqual(networkCallCount(), 0);
  });
}

// D-54-01 / ENBL-01 / ENBL-02: enable and disable carry an explicit scope into
// the same installed-inventory candidate map their siblings use. The info head
// is the one exception -- it forwards the scope and the data layer ignores it,
// which is the promise the info row below states.
for (const { prefix, mode, expected } of [
  {
    prefix: "install --scope project ",
    mode: "install",
    expected: [
      { label: "lab-fresh@lab", value: "install --scope project lab-fresh@lab " },
      { label: "fresh@hub", value: "install --scope project fresh@hub " },
      { label: "not-fetched@hub", value: "install --scope project not-fetched@hub " },
    ],
  },
  {
    prefix: "uninstall --scope user ",
    mode: "uninstall",
    expected: [
      { label: "held@hub", value: "uninstall --scope user held@hub " },
      { label: "outdated@hub", value: "uninstall --scope user outdated@hub " },
    ],
  },
  {
    prefix: "update --scope user ",
    mode: "update",
    expected: [
      { label: "held@hub", value: "update --scope user held@hub " },
      { label: "outdated@hub", value: "update --scope user outdated@hub " },
    ],
  },
  {
    prefix: "fetch --scope user ",
    mode: "fetch",
    expected: [
      { label: "fresh@hub", value: "fetch --scope user fresh@hub " },
      { label: "not-fetched@hub", value: "fetch --scope user not-fetched@hub " },
      { label: "degraded@hub", value: "fetch --scope user degraded@hub " },
      { label: "broken@hub", value: "fetch --scope user broken@hub " },
    ],
  },
  {
    prefix: "reinstall --scope user ",
    mode: "reinstall",
    expected: [
      { label: "held@hub", value: "reinstall --scope user held@hub " },
      { label: "outdated@hub", value: "reinstall --scope user outdated@hub " },
    ],
  },
  {
    prefix: "info --scope project ",
    mode: "info",
    expected: [
      { label: "held@hub", value: "info --scope project held@hub " },
      { label: "outdated@hub", value: "info --scope project outdated@hub " },
      { label: "fresh@hub", value: "info --scope project fresh@hub " },
      { label: "not-fetched@hub", value: "info --scope project not-fetched@hub " },
      { label: "degraded@hub", value: "info --scope project degraded@hub " },
      { label: "broken@hub", value: "info --scope project broken@hub " },
      { label: "lab-held@lab", value: "info --scope project lab-held@lab " },
      { label: "lab-fresh@lab", value: "info --scope project lab-fresh@lab " },
    ],
  },
  {
    prefix: "enable --scope user ",
    mode: "enable",
    expected: [
      { label: "held@hub", value: "enable --scope user held@hub " },
      { label: "outdated@hub", value: "enable --scope user outdated@hub " },
    ],
  },
  {
    prefix: "disable --scope user ",
    mode: "disable",
    expected: [
      { label: "held@hub", value: "disable --scope user held@hub " },
      { label: "outdated@hub", value: "disable --scope user outdated@hub " },
    ],
  },
] satisfies readonly { prefix: string; mode: string; expected: readonly Suggestion[] }[]) {
  test(`TC-6 carries an explicit scope into the ${mode} mode for ${JSON.stringify(prefix)}`, async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, `ref-scoped-${mode}`);

    // act
    const suggestions = await getArgumentCompletions(prefix, resolver);

    // assert
    assert.deepStrictEqual(suggestions, expected);
    assert.strictEqual(networkCallCount(), 0);
  });
}

for (const { prefix, mode, expected } of [
  {
    prefix: "install --partial ",
    mode: "install",
    expected: [
      { label: "fresh@hub", value: "install --partial fresh@hub " },
      { label: "degraded@hub", value: "install --partial degraded@hub " },
    ],
  },
  {
    prefix: "update --partial ",
    mode: "update",
    expected: [{ label: "outdated@hub", value: "update --partial outdated@hub " }],
  },
] satisfies readonly { prefix: string; mode: string; expected: readonly Suggestion[] }[]) {
  test(`TC-6 shifts the ${mode} candidate set when the partial flag precedes the reference`, async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, `ref-partial-${mode}`);

    // act
    const suggestions = await getArgumentCompletions(prefix, resolver);

    // assert
    assert.deepStrictEqual(suggestions, expected);
    assert.strictEqual(networkCallCount(), 0);
  });
}

test("TC-6 treats the partial flag as a positional for a head that does not accept it", async (t) => {
  // arrange
  const { resolver, networkCallCount } = await seedResolver(t, "ref-partial-reinstall");

  // act
  const suggestions = await getArgumentCompletions("reinstall --partial ", resolver);

  // assert
  assert.strictEqual(suggestions, null);
  assert.strictEqual(networkCallCount(), 0);
});

// ---------------------------------------------------------------------------
// The null sentinel: the Pi-tui contract requires null, not an empty list, so
// other providers still get a turn.
// ---------------------------------------------------------------------------

for (const prefix of ["pending ", "import ", "bootstrap ", "frobnicate ", "install alpha extra "]) {
  test(`offers nothing at the argument after ${JSON.stringify(prefix)}`, async (t) => {
    // arrange
    const { resolver, networkCallCount } = await seedResolver(t, "no-completion");

    // act
    const suggestions = await getArgumentCompletions(prefix, resolver);

    // assert
    assert.strictEqual(suggestions, null);
    assert.strictEqual(networkCallCount(), 0);
  });
}
