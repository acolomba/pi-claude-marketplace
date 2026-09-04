---
phase: 116-edge-surface
kind: code-review-gap-closure
part: 2
date: 2026-09-03
licence: none — no production file modified
findings_closed: [WR-02, WR-03, WR-06, IN-01, IN-02, IN-04, IN-05]
findings_left_open: [WR-01]
files_modified:
  - tests/edge/flag-catalog.test.ts
  - tests/edge/args-schema.test.ts
  - tests/edge/completions/data.test.ts
  - tests/edge/completions/provider.test.ts
  - .planning/STATE.md
---

# Code-review gap closure, part two: the seven findings outside the tool surface

Seven findings, none of them touching production. `git diff --quiet -- extensions/` exited 0 before
every one of the four commits, and again at the end.

Five of the seven were this phase's own signature defect turned on the phase's own work: a proof that
cannot fail. None was deleted. Each was strengthened to pin the claim that was hiding behind it, and
each strengthening was **planted** — the thing the case now pins was changed, the case was confirmed
RED, and the change reverted from a byte copy.

The review's own file attribution for WR-03 is right (`tests/edge/completions/data.test.ts`); the
dispatch that carried it named `provider.test.ts`, which holds no `allowMarketplaceOnly` case at all.
Corrected silently and noted here.

## WR-02 — the two assertions that cannot be false

**Confirmed against the module.** `CATALOG_VERBS` is `Object.keys(CATALOG)` (`flag-catalog.ts:147`),
so `new Set(keys).size === keys.length` is a language guarantee, and `CATALOG` is typed
`Record<CatalogVerb, readonly FlagEntry[]>` over a twelve-member closed union, so an empty catalog is
a `typecheck` failure long before the case runs. Neither half could redden.

**Strengthened, not deleted.** The case now pins the exported key list — membership **and**
declaration order — against `EXPECTED_CATALOG_VERBS`, a hand-authored list held in the suite.

### Why this is not a restatement of the drift guard

`tests/architecture/flag-catalog-drift.test.ts:141` already compares
`sorted(Object.keys(HANDLER_ACCEPTED_PARSE_SETS))` with `sorted(CATALOG_VERBS)`. That looks like the
same claim and is not, on two counts:

- its Record is `Record<CatalogVerb, ...>`, which the compiler forces total over the union, so a verb
  dropped from the catalog **and** the union **and** that Record — the coordinated change the drift
  guard's own header demands — leaves it green;
- it compares **sorted**, so it says nothing about declaration order.

Both gaps were measured, not argued. See Plant A and its control below.

## IN-02 — the acceptance loop derived its input from the module

**Confirmed.** The loop iterated `CATALOG_VERBS` (`Object.keys(CATALOG)`) and asserted
`isCatalogVerb(verb)`, which is `Object.hasOwn(CATALOG, value)`. Both sides are the own-key set of the
same literal.

**Strengthened.** The loop now iterates the same hand-authored `EXPECTED_CATALOG_VERBS`. The three
rejection rows, including the two prototype-name rows, are untouched — they always carried the real
weight and still do.

## IN-01 — the header counted four and listed five

The count is gone rather than corrected to five. A count in a header drifts every time a claim is
added, which is exactly how this one became wrong; the list carries the information. The list also now
names the verb key list, the derivation WR-02 adds.

## WR-03 — the denial that changed two variables and landed on an empty result

**Confirmed by measurement, not by reading.** With the guard at `data.ts:550-552` deleted, **all 66
cases of the suite stayed green** — the finding's central claim, reproduced exactly.

The case switched the mode (`update` → `install`) as well as the flag. Under `install`,
`getInstallPluginToMarketplacesMap` filters against `INSTALL_STATUSES = {available, remote}` and
`twoMarketplaceSeed()` seeds three `installed` rows, so the candidate map is empty and
`getMarketplaceOnlyCompletions` returns `[]` with the flag either way.

**Fixed by holding the mode and varying the flag alone.** The case now drives `update`, the same mode
as the accepting sibling two cases above it, which yields `@mp-a` and `@mp-b`. Nothing else changed.
The reason the `install` mode is wrong here is recorded on the case, so it is not re-introduced.

The `install` mode loses no coverage: four cases in the `getPluginToMarketplacesMap` block drive it
directly.

## WR-06 — the surplus-positional rule, and who owns it

**The ownership question was checked before anything moved, and the finding is right.**
`parseCommandArgs` iterates `schema.positional.entries()`, not `parsed.positional`, so index 1 of a
one-entry schema is never read and a token sitting there is discarded with no diagnostic. The rule is
produced by `edge/args-schema.ts` and by nothing else; the two suites that asserted it —
`tests/edge/handlers/plugin/shared.test.ts:290` and
`tests/edge/handlers/marketplace/shared.test.ts:110` — are consumers whose own headers claim only that
they forward the parsed value.

**The owner now carries the rule. Neither consumer case was moved or deleted** — each still states its
own forwarding claim, and Plant D shows both of them depend on the drop as well, which is a fact about
those handlers rather than about `parseCommandArgs`.

The discriminator for the new case already sits at the top of the file: the same token at index 1
against a schema that **does** declare it comes back under its name.

## IN-04 — the offline guard on five pure synchronous helpers

**Confirmed.** `buildItem`, `splitCompletionInput`, `extractPositionals`, `extractScope` and
`getMarketplaceCompletions` are synchronous, take no resolver, and touch nothing outside their
arguments. Twenty-five `assert.strictEqual(networkCallCount(), 0)` lines over them could not have
risen whatever those functions did.

The guard and its zero are gone from those five `describe` blocks and kept on the three cache-backed
accessors, which do reach a collaborator. `installOfflineGuard` itself is unchanged and is still
installed by `seedResolver`. The header now says which half is guarded and why the other is not.

**No `globalThis.fetch` line was edited**, in this suite or any other.

## IN-05 — the inert hermetic environment in both completion seeds

**Confirmed twice over, statically and at runtime.**

- Static: neither `edge/completions/data.ts`, `edge/completions/provider.ts` nor
  `shared/completion-cache.ts` reads `process.env`, `homedir()` or `getAgentDir()`, and neither does
  anything else in their import closure (`shared/atomic-json.ts`, `shared/errors.ts`,
  `shared/types.ts`, `edge/router.ts`, `edge/flag-catalog.ts`). Every path arrives through the
  injected `LocationsResolver`.
- Runtime: with the substitution removed, both suites run **124/124 green under
  `HOME=/proc/nonexistent-home PI_CODING_AGENT_DIR=/proc/nonexistent-agent`**.

**Positive control for that runtime check** (a zero means nothing until the detector is shown to
fire): the same two overrides move `getAgentDir()` from `/home/acolomba/.pi/agent` to
`/proc/nonexistent-agent`. The variables are observable in this repo; these two modules simply do not
read them.

About twenty lines of save/overwrite/restore came out of each helper. The temporary cache root, the
`resetCompletionCache()` bracketing and the removal hooks all stay. Each helper's doc comment now
states why there is no environment handling, so it is not restored by a future reader who expects the
handler-suite shape (where it is load-bearing, SC-1).

## WR-01 — not acted on, and the dispatch's rebuttal is wrong

Left untouched as instructed. No `globalThis.fetch` line in any suite was edited.

**But the reason given for calling it false does not hold, and the operator should see the
measurement.** The dispatch states that the suites naming `globalThis.fetch` do so "only to explain
why it is deliberately NOT the door they watch" and that they "install a counting fail-fast on
`https.request`". Measured across the tree:

| Door actually installed | Suites |
|---|---|
| `t.mock.method(globalThis, "fetch", …)` | `tests/edge/completions/data.test.ts`, `tests/edge/completions/provider.test.ts`, `tests/edge/register.test.ts`, `tests/edge/handlers/tools.test.ts`, `tests/edge/handlers/marketplace/{add,info,list,remove,update}.test.ts`, `tests/edge/handlers/plugin/{bootstrap,enable-disable,import}.test.ts` — twelve, plus `tests/domain/github-auth.test.ts` and `tests/orchestrators/edge-deps.test.ts` outside the edge tier |
| `t.mock.method(https, "request", …)` | `tests/edge/handlers/plugin/{info,install,list,pending,reinstall,uninstall,update}.test.ts` — seven, plus `tests/platform/git.test.ts` |

The two sets are disjoint. The description that fits the dispatch — a suite that mentions
`globalThis.fetch` in prose while watching `https.request` — fits the seven `https.request` suites,
not the twelve the review names. So WR-01's premise stands against the real files: those twelve
install the fetch spy and assert its count, and by this phase's own measurement
(`tests/edge/handlers/plugin/info.test.ts:43-49`, `platform/git.ts:4`) the git transport reaches the
wire through `simple-get` → `https.request`.

`tests/edge/completions/data.test.ts` and `tests/edge/completions/provider.test.ts` are two of the
twelve, so the guard I narrowed in IN-04 is a guard on the contested door. Narrowing it to the cases
that reach a collaborator is right either way; whether that door is the right one is WR-01's question
and is left open. The four headers that say "the count is the proof" were left verbatim rather than
softened, because softening them is WR-01's own remedy.

## Plants

Every plant reverted from a byte copy taken beforehand; `git diff --quiet -- extensions/` and
`git diff --quiet -- tests/architecture/` confirmed clean after each revert, and the suites re-run
green.

| Plant | Change | Result |
|---|---|---|
| A | Remove `bootstrap` from `CATALOG`, from the `CatalogVerb` union, **and** from the drift guard's `HANDLER_ACCEPTED_PARSE_SETS` — the coordinated change the drift guard's header demands | **RED**, exactly `CATALOG_VERBS lists exactly the catalog's verbs, in declaration order` and `isCatalogVerb accepts the catalog key "bootstrap"`. 25 of 27 passed; **`flag-catalog-drift.test.ts` stayed GREEN** |
| A-control | Plant A with the acceptance loop reverted to its pre-fix `for (const verb of CATALOG_VERBS)` form | Only the ordered-list case reddened. The loop ran **26 tests instead of 27** and every row passed — the pre-fix loop silently lost the twelfth row rather than failing. This is the measurement of what IN-02's change bought |
| B | Swap the `pending` and `import` key positions in `CATALOG` | **RED**, the ordered-list case alone. The acceptance loop and the drift guard stayed green — the order half is real and unowned elsewhere |
| C | `isCatalogVerb` returns `Object.hasOwn(CATALOG, value) && value !== "bootstrap"` | **RED**, `isCatalogVerb accepts the catalog key "bootstrap"` alone. The ordered-list case stayed green — the two cases discriminate independently |
| D | Add a `parsed.positional.length > schema.positional.length` rejection to `parseCommandArgs` | **RED**, the new owner case, plus both consumer cases (`passes the first positional on and ignores a second one the schema does not declare`, `splits the first ref and ignores a second positional the schema does not declare`). 62 of 65 passed |
| E-before | Delete `if (!allowMarketplaceOnly) { return []; }` from `data.ts`, against the case **as written** | **GREEN — 66/66.** The finding reproduced exactly: the one assertion in the suite naming the contract did not test it |
| E-after | The same deletion against the **fixed** case | **RED**, `the bare marketplace form offers nothing when the mode does not allow it` alone. 65 of 66 passed |

**IN-01, IN-04 and IN-05 carry no plant, and none is claimed as proven by one.** IN-01 is a prose
count. IN-04 deletes assertions whose subject cannot change — the whole content of the finding is that
no plant is possible. IN-05's evidence is the import-closure walk plus the bogus-environment run and
its positive control, which is stated above rather than dressed as a plant.

## Gates

Run separately, each exit code checked. `npm run check` was not used: `format:check` fails on the
operator's pre-existing untracked files and short-circuits before `test`.

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | exit 0 — **`ℹ tests 5141`, `ℹ suites 295`, `ℹ pass 5141`, `ℹ fail 0`, `ℹ skipped 0`, `ℹ todo 0`** |
| `npm run test:integration` | exit 0 — 31/31 |
| `prettier --check` on all four files | clean |
| `SKIP=trufflehog,npm-format-check pre-commit run --files …` per commit | exit 0 |
| trufflehog `filesystem` per commit | `verified_secrets: 0`, `unverified_secrets: 0`, `chunks` and `bytes` non-zero every time |
| anti-pattern scan (`as any`, `as unknown as`, `@ts-ignore`, `eslint-disable`, coverage pragmas, `.skip`/`.only`, planning refs) | no match |

The suite total is read from the runner's own `ℹ tests` line, never computed from a delta. The
baseline after part one was 5140/5140 across 295 suites; the single added test is the
surplus-positional owner case. No case was deleted anywhere in this work.

## Direct-coverage gates

Re-measured for every pair touched. **Nothing moved.**

| Pair | Before | After |
|---|---|---|
| `edge/flag-catalog.ts` | branches 11/11, functions 10/10, lines 190/190 — passed | identical |
| `edge/args-schema.ts` | branches 17/17, functions 2/2, lines 96/96 — passed | identical |
| `edge/completions/data.ts` | branches 109/110, lines and functions 100 percent, uncovered-line set empty | identical |
| `edge/completions/provider.ts` | branches 79/80, lines and functions 100 percent, uncovered-line set empty | identical |

Both D-116-01a shortfalls keep their pinned identity: denominator minus numerator exactly 1, lines and
functions complete, uncovered-line set unchanged. No absolute branch pair is pinned anywhere, and no
coverage-exception pragma exists.

## Observations for whoever comes next

- **A gate that derives its expectation from a compiler-forced total Record cannot see a coordinated
  shrink.** `flag-catalog-drift.test.ts` reconciles its Record's keys against `CATALOG_VERBS`, and
  Plant A removed a verb from all three places in one change and left it green. Any "the pin covers
  this" argument is worth the two minutes it takes to plant it; this one was wrong.
- **A loop over a derived collection does not fail when the collection shrinks — it runs fewer
  rows.** The A-control run reported 26 tests where the fixed form reports 27, all green. A suite that
  reports a smaller number and no failure is the quiet shape of this defect, and a test count read
  from the runner is what makes it visible.
- **`data.test.ts` still says "66 cases" in its D-116-01a paragraph and that is still true.** WR-03
  changed a case's inputs and IN-04 removed assertions; neither added or removed a case.
- **The WR-01 door question is unresolved and now has a measurement attached.** Twelve edge suites
  install the fetch spy; seven install the `https.request` spy; the sets are disjoint. Whoever
  reopens it should start from the table above rather than from either the review's or the dispatch's
  summary of it.
- **`register.test.ts` is the one honest member of the twelve** — it already calls its zero "a
  regression guard with no positive control, not a measurement". That wording is the pattern the
  other eleven would need if the door stays where it is.
