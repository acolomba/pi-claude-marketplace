---
phase: 116-edge-surface
reviewed: 2026-09-03T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - tests/edge/args-schema.test.ts
  - tests/edge/args.test.ts
  - tests/edge/completions/data.test.ts
  - tests/edge/completions/normalize.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/flag-catalog.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/shared.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/pending.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/shared.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/edge/handlers/tools.test.ts
  - tests/edge/register.test.ts
  - tests/edge/router.test.ts
  - tests/edge/types.test.ts
  - tests/helpers/notification-boundary.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 116: Code Review Report

**Reviewed:** 2026-09-03
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

Thirty-five of the thirty-seven files are the deliverable test suite; two production files
(`edge/flag-catalog.ts`, `edge/handlers/tools.ts`) were changed under licence.

The suite is, on the whole, unusually disciplined. Headers name what they do *not* claim, ownership
boundaries are stated and largely respected, `strong-mock` strictness is used as the negative proof
rather than a `times(0)` that would be inert, and several suites explicitly delete inherited
assertions that could not fail for their module. No banned pattern (`as any`, `as unknown as`,
`@ts-ignore`, `eslint-disable`, any coverage-exception pragma, any planning-process reference)
appears anywhere in scope.

Two things do not hold up.

First, `edge/handlers/tools.ts` — one of the two production files this phase held open — carries two
live defects that its own owner suite ratifies rather than catches. The `pi_claude_marketplace_plugin_list`
tool can never emit a `remote` or a `partially-available` plugin row, and it silently drops the
`reasons` array off three of the row variants that declare one. Both are provable from the source; in
both cases the owner suite exercises the neighbouring shape and stops one fixture short of the one
that would fail.

Second, the phase split its own network proof two ways and left the weaker half in twelve suites.
`tests/edge/handlers/plugin/info.test.ts:43-49` records the measurement that the git transport opens
`https.request` and *never* `globalThis.fetch` — so a global-fetch spy "would record zero here
whatever the handler did". Seven suites act on that measurement. Twelve others still spy on
`globalThis.fetch`, call it "the process-wide transport", and four of them state in their header that
"the count is the proof". By the phase's own finding, that count cannot fail.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `pi_claude_marketplace_plugin_list` can never return a `remote` or `partially-available` plugin

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:235-251`, `285-307`, `454`

**Issue:**
`applyFilter` maps "the caller set no filter" onto `{ i: true, a: true, u: true }` (lines 240-244),
and `loadToolPluginPayload` spreads that into the orchestrator options as
`installed: true, available: true, unavailable: true` (lines 303-305). Because `applyFilter` never
returns all-false, **every** call this tool makes to `loadPluginListPayload` arrives with at least one
PL-1 filter set.

`orchestrators/plugin/list.ts:201-209` (`filtersPassive`) is therefore never true on this surface, so
`shouldShow` (list.ts:216-266) runs the union arms. Two buckets have no arm the tool can reach:

- `bucket === "remote"` needs `opts.remote === true` (list.ts:250);
- `bucket === "partially-available"` needs `opts.partial === true` (list.ts:259).

The tool exposes neither parameter and never sends either. Consequently no parameter combination the
LLM can supply will ever surface a not-installed git-source plugin (the `(remote)` bucket) or a
not-installed partially-available plugin. The `case "remote"` (tools.ts:177-181) and
`case "partially-available"` (tools.ts:184-188) arms of `projectRowStatus` are dead on the tool's own
execute path, and their doc comments ("install still offers it", "projects onto the coarse
`unavailable` tool bucket") describe behaviour the module cannot produce.

**What the owner suite would not catch:** `tests/edge/handlers/tools.test.ts` mentions `remote` and
`partially-available` on exactly two lines — 342 and 344 — both inside the direct `projectRowStatus`
table. No fixture in `versionCases`, `mixedMarketplace`, or any standalone case seeds a plugin that
resolves to either status. Deleting those two arms from `projectRowStatus` and letting the switch fall
through to the `throw` would leave the whole suite green, because no case ever drives a row of either
status through `registration.execute`. The direct unit table masks the fact that the arms are
unreachable from the surface they exist to serve.

**Fix:** Either send the two missing filters when the caller set none, or make the passive case
passive:

```ts
async function loadToolPluginPayload(...) {
  return loadPluginListPayload({
    ctx,
    pi,
    cwd: ctx.cwd,
    ...(params.scope !== undefined && { scope: params.scope }),
    ...(params.marketplace !== undefined && { marketplace: params.marketplace }),
    // Only narrow when the caller actually asked to narrow; an all-true bag is
    // NOT the same request as an empty bag (orchestrators/plugin/list.ts:201).
    ...(buckets.anyFilter && {
      ...(buckets.i && { installed: true }),
      ...(buckets.a && { available: true, remote: true }),
      ...(buckets.u && { unavailable: true, partial: true }),
    }),
  });
}
```

and add two owner cases seeding a cold git-source plugin and a not-installed partially-available
plugin, driven through `registration.execute` with `{}` params.

### CR-02: the tool payload drops the `reasons` of `disabled`, `available` and `remote` rows

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:338-359`

**Issue:**
`pluginReasons` handles `installed` (optional `reasons`, line 341-344) and the required-`reasons`
group `unavailable | partially-available | upgradable | partially-installed | partially-upgradable`
(lines 346-356), then returns `undefined` for everything else. Three list-surface variants that reach
this function declare a `reasons` slot and are silently dropped:

- `PluginDisabledMessage.reasons?` (`shared/notify.ts:784`). `orchestrators/plugin/list.ts:487` spreads
  `disabledReasonsField(notInManifest)` (list.ts:354-356), which sets `reasons: ["not in manifest"]`
  on a disabled row whose record the manifest no longer declares (ENBL-16 / D-100-07).
- `PluginAvailableMessage.reasons?` (`shared/notify.ts:821`) and `PluginRemoteMessage.reasons?`
  (`shared/notify.ts:850`). `orchestrators/plugin/list.ts:857` spreads
  `installsDisabledField(claimsInstallDisabled)` (list.ts:772-776), which sets
  `reasons: ["installs disabled"]`.

So a disabled plugin whose record has fallen out of its marketplace manifest renders as
`  [unavailable] alpha  1.0.0` on the tool surface with `details.plugins[0].reasons` absent, while the
human slash-command surface shows the `{not in manifest}` brace. The function's own doc comment
(lines 336-337) asserts the opposite: "every list-surface variant that carries typed reasons forwards
them here … an agent reading the tool payload sees the same facts a human reading the rendered row
sees." That claim is false for three of the ten variants.

**What the owner suite would not catch:** `tests/edge/handlers/tools.test.ts:893` ("forwards the
absence reason of an installed record the manifest omits") proves exactly this behaviour on the
*installed* path — it seeds `inManifest: false` with an install record and asserts
`reasons: ["not in manifest"]`. The `disabled` counterpart is a one-word change to that fixture
(`installed: { version: "1.0.0", disabled: true }`) and is absent. Likewise the `disabled-mp`
version case at line 590 seeds a disabled plugin that *is* in the manifest, so its `reasons` is
legitimately empty and the omission is invisible. Adding either arm to `pluginReasons` today would
change no assertion in the suite.

**Fix:**

```ts
function pluginReasons(p: PluginNotificationMessage): readonly string[] | undefined {
  if (
    p.status === "installed" ||
    p.status === "disabled" ||
    p.status === "available" ||
    p.status === "remote"
  ) {
    // Optional-`reasons` arms: omit the field rather than putting `[]` on a clean row.
    return p.reasons !== undefined && p.reasons.length > 0 ? p.reasons : undefined;
  }

  if (
    p.status === "unavailable" || /* … required-reasons arms unchanged … */
  ) {
    return p.reasons.length > 0 ? p.reasons : undefined;
  }

  return undefined;
}
```

and add an owner case seeding a disabled plugin absent from the manifest, plus one seeding a plugin
whose manifest entry declares installs-disabled.

## Warnings

### WR-01: twelve suites prove offline-ness against a door the phase measured as wrong

**Files:**
`tests/edge/completions/data.test.ts:10-13,88-99`,
`tests/edge/completions/provider.test.ts:31-35,141`,
`tests/edge/handlers/tools.test.ts:14-17,85,158`,
`tests/edge/register.test.ts:30-34,101,166`,
`tests/edge/handlers/marketplace/{add,info,list,remove,update}.test.ts`,
`tests/edge/handlers/plugin/{bootstrap,enable-disable,import}.test.ts`

**Issue:**
Each of these installs `t.mock.method(globalThis, "fetch", refuseNetwork)` and asserts
`fetchCallCount() === 0`, describing it as "the process-wide transport". The same phase recorded the
contrary measurement in `tests/edge/handlers/plugin/info.test.ts:43-49`:

> The watched door is `https.request`, measured to be the one the git transport opens:
> `isomorphic-git/http/node` goes through `simple-get`, which calls `https.request` and never
> `globalThis.fetch`, so a global-fetch spy would record zero here whatever the handler did.

That is confirmed by `extensions/pi-claude-marketplace/platform/git.ts:4`
(`import http from "isomorphic-git/http/node"`). Seven suites in this phase act on the measurement and
watch `https.request`; these twelve do not. Four of them go further and state the zero *is* the proof:

- `data.test.ts:12` — "asserts its call count is zero. The count is the proof"
- `provider.test.ts:32` — same sentence
- `marketplace/list.test.ts:24-25` — "The listing is read-only (NFR-5), so every case owns a
  fail-fast replacement for the process-wide transport"
- `tools.test.ts:14-17` — "every case replaces the process-wide transport with a fail-fast stub and
  asserts its call count is zero"

The count cannot rise, so it cannot fail. **Concretely:** if `edge/completions/data.ts` acquired an
`import { DEFAULT_GIT_OPS } from "../../platform/git.ts"` and warmed a clone on a cache miss, all 66
`assert.strictEqual(networkCallCount(), 0)` lines in `data.test.ts` would still pass. The same holds
for the tool bodies, the registration glue, and the marketplace handler shims.

`register.test.ts:30-34` is the honest one — it says the zero "is a regression guard with no positive
control, not a measurement" — but it still names `globalThis.fetch` "the process-wide transport",
which the phase's own measurement contradicts.

**Fix:** Move all twelve to the door `info.test.ts` measured, and where a positive control exists
(`marketplace/add`, `marketplace/update`, `plugin/import`) assert the non-zero sibling too:

```ts
import https from "node:https";
// …
const requestSpy = t.mock.method(https, "request", (): never => {
  throw new Error("this surface must not reach the network");
});
```

Where no positive control is possible (the pure completion helpers, the read-only tools), delete the
claim from the header and downgrade the comment to what it is: a regression guard, not a proof.

### WR-02: `CATALOG_VERBS carries at least one key and lists no key twice` asserts two facts that cannot be false

**File:** `tests/edge/flag-catalog.test.ts:157-167`

**Issue:** Both assertions are unfalsifiable at runtime.

- `assert.strictEqual(distinctVerbs.size, catalogVerbs.length)` — `CATALOG_VERBS` is
  `Object.keys(CATALOG)` (`flag-catalog.ts:149`). JavaScript object keys are unique by construction, so
  `new Set(Object.keys(x)).size === Object.keys(x).length` is a tautology for every possible `CATALOG`.
- `assert.ok(catalogVerbs.length > 0)` — `CATALOG` is typed `Record<CatalogVerb, readonly FlagEntry[]>`
  over a twelve-member closed union (`flag-catalog.ts:51-63,76`). Removing every entry is a
  `typecheck` failure long before this case runs; the test can only be reached in a state where it
  already passes.

No edit to `flag-catalog.ts` that leaves the file type-checking can turn this case red.

**Fix:** Either delete the case, or replace it with the claim that actually discriminates — that
`CATALOG_VERBS` is the same set the type union declares, maintained independently in the test:

```ts
test("CATALOG_VERBS lists exactly the twelve verbs the catalog indexes", () => {
  const expectedVerbs = [
    "install", "update", "list", "info", "uninstall", "reinstall",
    "fetch", "enable", "disable", "pending", "import", "bootstrap",
  ];
  assert.deepStrictEqual([...CATALOG_VERBS], expectedVerbs);
});
```

### WR-03: the `allowMarketplaceOnly: false` case changes two variables and lands on a vacuously empty result

**File:** `tests/edge/completions/data.test.ts:1005-1021`

**Issue:** The case titled "the bare marketplace form offers nothing when the mode does not allow it"
switches both the mode (`"update"` → `"install"`) and the flag (`allowMarketplaceOnly: true` → `false`)
relative to every sibling case, while reusing `twoMarketplaceSeed()`.

`twoMarketplaceSeed()` seeds three rows, all `status: "installed"`. Under mode `"install"`,
`getInstallPluginToMarketplacesMap` filters against
`INSTALL_STATUSES = new Set(["available", "remote"])` (`data.ts:64`), so the candidate map is **empty**.
`getMarketplaceOnlyCompletions` (`data.ts:542-562`) derives its offered set from that same map
(`Array.from(map.values()).flat()`), so with `allowMarketplaceOnly: true` the result would *also* be
`[]`.

**Concretely:** deleting the guard at `data.ts:550-552`

```ts
if (!allowMarketplaceOnly) {
  return [];
}
```

leaves this case green. The one assertion in the suite that names the `allowMarketplaceOnly` contract
does not test it.

**Fix:** Hold the mode fixed and vary only the flag:

```ts
test("the bare marketplace form offers nothing when the mode does not allow it", async (t) => {
  const { resolver, networkCallCount } = await seedResolver(t, "ref-bare-denied", twoMarketplaceSeed());

  // Same mode as the accepting sibling above, so the candidate map is non-empty
  // and the flag is the only difference between the two results.
  const denied = await getPluginRefCompletions("update", "@", "update", resolver, {
    allowMarketplaceOnly: false,
  });

  assert.deepStrictEqual(denied, []);
  assert.strictEqual(networkCallCount(), 0);
});
```

### WR-04: `projectRowStatus` and `pluginVersion` disagree about whether `failed` is reachable, and the guard sits outside the try

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:161-208`, `381-395`, `477-498`

**Issue:** Two switches over the same derived row union answer differently:

- `pluginVersion` (line 388) names `case "failed"` as a live arm that returns `p.version`.
- `projectRowStatus` (line 197) names `"failed"` in the group that `throw`s.

`ToolPluginRow` is derived from `loadPluginListPayload`'s return type (line 368), and `ListMsg`
(`orchestrators/plugin/list.messaging.ts:69-79`) includes `PluginFailedMessage`, so the type system
permits a `failed` row in the payload.

The comment on `projectRowStatus` (lines 152-159) justifies the throw with: "the failure path emits a
`failed` row in a synthetic `(list)` marketplace which never traverses this projection -- the tool's
try/catch short-circuits to its error branch before reaching here." Both halves are wrong:

1. The synthetic `(list)` failure row is built in `listPlugins`'s catch (`list.ts:1539-1546`), not in
   `loadPluginListPayload`, so it never enters the tool's payload at all — the try/catch has nothing
   to do with it.
2. `renderPluginPayload` — the only caller of `projectRowStatus` — runs at line 498, **outside** the
   `try` that ends at line 496. If a `failed` plugin row ever did arrive (a future list-orchestrator
   change is all it would take, and `pluginVersion` already anticipates one), the `throw` would escape
   `execute` as an unhandled rejection rather than reaching the `isError: true` branch the comment
   promises.

**Fix:** Make the two switches agree, and put the projection inside the guard that is supposed to
catch it:

```ts
let payload;
let rendered;
try {
  payload = await loadToolPluginPayload(pi, params, ctx, buckets);
  rendered = renderPluginPayload(payload, buckets);
} catch (err) {
  return { content: [{ type: "text", text: `Failed to load plugin list: ${errorMessage(err)}` }],
           isError: true, details: { plugins: [] } };
}

const { lines, rows } = rendered;
```

and either drop `case "failed"` from `pluginVersion` or add a `failed` arm to `projectRowStatus`, so
one file states one answer.

### WR-05: no case renders a marketplace block whose rows the filter emptied

**File:** `tests/edge/handlers/tools.test.ts:823-843` (`filterCases`), `extensions/pi-claude-marketplace/edge/handlers/tools.ts:403-435`

**Issue:** Every `filterCases` row selects at least one plugin from `mixedMarketplace`, and the
`skip-bucket` case (line 847) leaves one row standing. No case drives a filter that excludes **all**
rows of a non-empty marketplace.

That path is real: `renderPluginPayload` pushes the `Marketplace X (scope)` header at line 406, skips
the `(no plugins)` body because `mp.plugins.length !== 0` (line 411), then filters every row out at
line 418. The result is a bare header with no body line and `details.plugins: []` — a shape that
contradicts the "(no plugins)" convention the zero-plugin block establishes at line 412, and that the
comment at lines 408-410 claims is stabilised.

**Concretely:** driving `mixedMarketplace` with `{ installed: true }` after removing the `alpha`
record would emit `"Marketplace mixed-mp (project)"` and nothing else. No case pins that.

**Fix:** Add one case with a filter that excludes every row of a populated marketplace and assert the
whole rendered value, so whichever shape is intended becomes the pinned one.

### WR-06: `args-schema.test.ts` delegates the surplus-positional rule it owns

**File:** `tests/edge/args-schema.test.ts`, `extensions/pi-claude-marketplace/edge/args-schema.ts:76-89`

**Issue:** `parseCommandArgs` iterates `schema.positional`, not `parsed.positional`, so any positional
beyond the declared schema is discarded with no diagnostic — `parseCommandArgs("official alpha extra",
{ positional: [{ name: "marketplace" }] , …})` yields `{ marketplace: "official" }` and pushes nothing
to `onError`. That is user-visible: a typo'd surplus token is silently swallowed.

The phase's ownership map puts the positional schema with `tests/edge/args-schema.test.ts`, but that
file has no such case. The fact is instead asserted twice downstream, at
`tests/edge/handlers/plugin/shared.test.ts:290` ("splits the first ref and ignores a second positional
the schema does not declare") and `tests/edge/handlers/marketplace/shared.test.ts:110` ("passes the
first positional on and ignores a second one the schema does not declare"). That is the ownership
inversion the phase set out to remove: two consumer suites pin a producer's rule and the producer's
own owner does not.

**Fix:** Add the case to `args-schema.test.ts` and let the two downstream suites keep their own claim
(that they forwarded the parsed value), which is what their headers say they own.

## Info

### IN-01: the `flag-catalog.test.ts` header counts four derivations and lists five

**File:** `tests/edge/flag-catalog.test.ts:6-8`

**Issue:** "This owner therefore proves the module's four DERIVATIONS -- the complete-bit filter, the
description key carried through, catalog declaration order, the fresh parse-set, and the scope-target
exclusion" names five items after promising four.

**Fix:** Say "five", or drop the count.

### IN-02: `isCatalogVerb accepts the catalog key` derives its input from the same object the module reads

**File:** `tests/edge/flag-catalog.test.ts:127-135`

**Issue:** The loop iterates `CATALOG_VERBS`, which `flag-catalog.ts:149` derives as
`Object.keys(CATALOG)`, and asserts `isCatalogVerb(verb) === true`, which `flag-catalog.ts:153`
answers as `Object.hasOwn(CATALOG, verb)`. Both sides are the own-key set of the same literal, so the
positive half is near-tautological — it can only fail if `isCatalogVerb` were reimplemented against a
hand-copied list, which the file's own design forbids. The three rejection rows (including the
prototype-name pair) carry the real weight.

**Fix:** Keep the rejection rows; either drop the positive loop or drive it from a hand-written verb
list so it discriminates against a hand-copied implementation.

### IN-03: redundant conjunct in the empty-payload guard

**File:** `extensions/pi-claude-marketplace/edge/handlers/tools.ts:500`

**Issue:** `if (rows.length === 0 && payload.length === 0)`. `rows` is populated only inside
`for (const mp of payload)` (`renderPluginPayload`, lines 403-435), so `payload.length === 0` already
implies `rows.length === 0`. The first conjunct can never independently decide the branch.

**Fix:** `if (payload.length === 0)`.

### IN-04: the offline guard is installed on five pure synchronous helpers

**File:** `tests/edge/completions/data.test.ts:200-435`

**Issue:** `installOfflineGuard(t)` and `assert.strictEqual(networkCallCount(), 0)` are attached to
every case of `buildItem`, `splitCompletionInput`, `extractPositionals`, `extractScope` and
`getMarketplaceCompletions` — roughly twenty-five assertions on functions that are synchronous, take
no resolver, and perform no I/O of any kind (`data.ts:161-249`). The zero cannot change regardless of
what those functions do, and the noise obscures the cases where the guard is at least a regression
marker.

**Fix:** Scope the guard to the three cache-backed accessors that actually reach a collaborator, and
drop it from the pure-helper `describe` blocks.

### IN-05: the hermetic `HOME` substitution in both completion suites is inert

**File:** `tests/edge/completions/data.test.ts:117-140`, `tests/edge/completions/provider.test.ts:151-178`

**Issue:** Both `seedResolver` helpers save, overwrite and restore `HOME` and `PI_CODING_AGENT_DIR`
(about twenty lines, duplicated across the two files). Neither
`edge/completions/data.ts`, `edge/completions/provider.ts`, nor `shared/completion-cache.ts` reads
`process.env`, `homedir()`, or `getAgentDir()` — every path in these modules arrives through the
injected `LocationsResolver` or the resolver-supplied cache path. The substitution therefore changes
nothing observable and, unlike in the handler suites where it is load-bearing (SC-1), buys no
isolation here.

**Fix:** Drop the environment handling from these two `seedResolver` helpers and keep the temporary
cache root, or add a comment stating it is defence against a future resolver default rather than a
live requirement.

---

_Reviewed: 2026-09-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
