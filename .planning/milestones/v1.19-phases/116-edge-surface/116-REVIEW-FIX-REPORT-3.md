---
phase: 116-edge-surface
kind: code-review-gap-closure
part: 3
date: 2026-09-03
licence: none — no production file modified
findings_closed: [WR-01]
findings_left_open: []
files_modified:
  - tests/edge/completions/data.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/tools.test.ts
  - tests/edge/register.test.ts
  - .planning/STATE.md
  - .planning/phases/116-edge-surface/.continue-here.md
---

# Code-review gap closure, part three: WR-01, the wrong door

One finding, twelve suites, three commits, no production change. `git diff --quiet -- extensions/`
exited 0 before every commit and again at the end, including after each of the five plants.

WR-01 was twice called false before this run. It is real, and the door split it rests on was
re-measured here before a line was edited.

## The measurement that settles it

`t.mock.method(globalThis, "fetch", …)` does not contain the literal string `globalThis.fetch`, so a
grep for that string finds prose and misses every spy installation. Grepping for the installation
form instead:

| Door installed | Edge suites |
|---|---|
| `t.mock.method(globalThis, "fetch", …)` | `completions/{data,provider}`, `handlers/marketplace/{add,info,list,remove,update}`, `handlers/plugin/{bootstrap,enable-disable,import}`, `handlers/tools`, `register` — **twelve** |
| `t.mock.method(https, "request", …)` | `handlers/plugin/{info,install,list,pending,reinstall,uninstall,update}` — **seven** |

Disjoint, as part two reported. The literal-string grep returns six lines, all of them comment prose
inside `https.request` suites, and none of them a spy.

**The control that proves the fetch door is inert.** A live dial-out was planted in
`edge/completions/data.ts` — `https.request("https://127.0.0.1:9/probe")` with an error handler, in
`getMarketplaceNamesAcrossScopes`, the review's own worked example:

- against the suite **as written**, watching `globalThis.fetch`: **66 of 66 GREEN**;
- against the same suite after the door moved to `https.request`: **5 RED**.

That is WR-01's central claim reproduced exactly, and its remedy measured on the same plant. The
production file was restored from a byte copy taken beforehand; md5 identical.

## The two questions, asked separately per suite

Reachability was measured, not argued. An import-closure walk over each module under test answers
the first question; the fixture answers the second.

| Suite | Fixture can reach a transport | Any input turns it on | Shape applied |
|---|---|---|---|
| `completions/data` | **No** — closure holds no HTTP client | no | hermeticity device |
| `completions/provider` | **No** — same closure | no | hermeticity device |
| `handlers/marketplace/info` | **No** — closure holds no HTTP client | no | hermeticity device |
| `handlers/marketplace/list` | **No** — closure holds no HTTP client | no | hermeticity device |
| `handlers/marketplace/remove` | No — path-source fixture | no | hermeticity device |
| `handlers/plugin/enable-disable` | No — path-source fixture | no | hermeticity device |
| `handlers/plugin/import` | No — mocked delegate; the one real run has an empty cascade | no | hermeticity device |
| `register` | No — path source, git injected and never invoked | no | hermeticity device |
| `handlers/tools` | **Yes** — `remote-mp` declares a cold git source | no | regression guard, stated |
| `handlers/marketplace/add` | Yes — url source really cloned, through the injected port | no input; **plant-falsifiable** | counted zero, planted |
| `handlers/plugin/bootstrap` | Yes — github source really cloned, through the injected port | no input; **plant-falsifiable** | counted zero, planted |
| `handlers/marketplace/update` | Yes — url sources really refreshed | no; **and the plant does NOT move the counter** | regression guard, stated |

The closure walk for the four "closure holds no HTTP client" rows is exact: `data.ts` and
`provider.ts` reach only `edge/router.ts`, `edge/flag-catalog.ts`, `platform/pi-api.ts`,
`shared/{atomic-json,completion-cache,errors,notify,types}.ts`, `shared/concerns/{hooks,soft-dep}.ts`
and four packages, none of them an HTTP client; `marketplace/info.ts` and `marketplace/list.ts`
likewise reach neither `platform/git.ts`, `isomorphic-git`, nor `node:https`. The other eight modules
DO carry the git door in their import graph, which is why each of them was answered on its fixture
rather than on its imports.

**Every one of the twelve now watches `https.request`. No `globalThis.fetch` spy remains anywhere
under `tests/edge/`.**

## What each shape means, and why the three differ

**Hermeticity device (eight suites).** The fail-fast `https.request` replacement stays; the call
count is gone, along with every `assert.strictEqual(…, 0)` that named it. A count over a subject that
cannot change is the exact defect WR-01 reports, and re-pointing it at the right door would not have
fixed it for these eight — it would only have moved it. What the replacement still buys is the
review's own scenario: if `data.ts` acquired a `DEFAULT_GIT_OPS` import and warmed a clone, the case
now fails where it happens. Each header says the replacement is a device and not a proof.

**Counted zero, planted (add, bootstrap).** Here the zero is a measurement, because the git work
really happens and the only question is which implementation performed it. Both were planted.

**Regression guard, stated (tools, update).** The zero is kept and labelled. `tools` because no
parameter either tool exposes turns materialization on; `update` because — measured — the plant that
should have moved its counter does not.

## Plants

Five plants. Four RED, one GREEN-and-therefore-a-finding. Every production plant reverted from a byte
copy taken beforehand, md5 confirmed, and `git diff --quiet -- extensions/` clean after each.

| Plant | Change | Result |
|---|---|---|
| A-control | Live `https.request` dial-out in `data.ts`'s `getMarketplaceNamesAcrossScopes`, against the suite **as written** (fetch door) | **GREEN, 66/66.** WR-01 reproduced exactly |
| A | The same dial-out against the **converted** suite (`https.request` door) | **RED, 5 of 66** — the whole `getMarketplaceNamesAcrossScopes` block |
| B | Delete `gitOps: deps.gitOps` from `edge/handlers/marketplace/add.ts`, so `addMarketplace` falls back to `DEFAULT_GIT_OPS` | **RED, 7 of 11.** The fail-fast fires from `simple-get` inside `isomorphic-git/http/node` — the measured chain, in the stack trace. The path-source row and the three rejecting rows stayed GREEN |
| C | Delete the `gitOps` forward on the bootstrap path, so the github source falls back to `DEFAULT_GIT_OPS` | **RED, 2 of 10**, on the empty clone recorder. Probed with the count assertion moved first, the counter reads **1** where the case asserts 0 |
| D | Delete both `gitOps: deps.gitOps` forwards from `edge/handlers/marketplace/update.ts` | **RED, 5 of 7 — but on the MESSAGE, not the counter.** See below |
| E | Live `https.request` dial-out in `edge/handlers/tools.ts`'s `loadToolPluginPayload` | **RED, 28 of 53** — every case that routes through the plugin-list tool body |

### Plant D is a finding, and it changed what `marketplace/update.test.ts` claims

The first draft of that suite's header said its zero could rise, by analogy with `add`. It cannot.
Under the plant the five delegating rows fail on their rendered message —

```text
⊘ alpha [project] (failed)
  ⊘ alpha (failed) {network unreachable}
    cause: Failed to update marketplace "alpha". -> The function requires a "remote OR url" parameter but none was provided.
```

— while the counter, probed directly by moving the count assertion ahead of the message comparison,
reports **`0 !== -1`**. The real `DEFAULT_GIT_OPS` refresh dies inside `isomorphic-git` on a staged
clone that carries no configured remote, one step before the transport. This is 116-25's measurement
reproduced on a different verb: having the git door in the import graph is not the same as having a
route that opens it.

The claim was corrected rather than kept. `marketplace/update.test.ts` now states that its zero is a
regression guard with no positive control, and that the fetch RECORDER beside it — not the zero — is
what carries the delegation claim.

### Plant E is why the `tools` limit is a fact about the tool, not about the instrument

`tools` has no positive control because no parameter turns materialization on. That is only worth
believing once the detector is shown to fire, which is what Plant E does inside the same suite: 28 of
53 cases redden on a planted dial-out. So the missing control is a property of the tool's parameter
space.

## The four "the count is the proof" sentences

All four are gone, replaced by what is true of each suite:

- `completions/data.test.ts` — "NO CASE ASSERTS A CALL COUNT AGAINST IT … a hermeticity device";
- `completions/provider.test.ts` — same;
- `handlers/marketplace/list.test.ts` — the "fail-fast replacement for the process-wide transport"
  sentence now names `https.request` and states no count is asserted;
- `handlers/tools.test.ts` — "an NFR-5 regression guard, NOT a discriminated proof", with the reason.

`register.test.ts` was the honest one and stays honest: its "regression guard with no positive
control" wording was already right about the epistemics and wrong only about the door. It now names
`https.request` and drops its count, because on this module the count could not rise either.

The phrase "the process-wide transport" is gone from all twelve. It was the load-bearing error:
`globalThis.fetch` is not process-wide for git, and calling it that is what let eleven suites inherit
a zero nobody re-derived.

## Where WR-01's premise did not hold exactly

The review says to move all twelve to the `info.test.ts` door "and where a positive control exists
(`marketplace/add`, `marketplace/update`, `plugin/import`) assert the non-zero sibling too". Measured,
that list is wrong in two places and the correction is recorded rather than papered over:

- **`marketplace/update` has no positive control** — Plant D above.
- **`plugin/import` has none either**, and cannot: its delegating cases state the import delegate as
  a strict mock, so no workflow runs at all, and the single case that DOES run the real workflow owns
  a tree with no Claude settings in either scope, so its cascade is empty and nothing is ever
  resolved. It is in the hermeticity-device group.
- **`plugin/bootstrap` is a positive control the review did not list**, and it is the cleanest one of
  the three: its counter moves 0 → 1 under Plant C.

No non-zero sibling assertion was added anywhere. Asserting a non-zero count would mean asserting
that a case DOES dial out, which no case in this tier should do; what the plants establish is that
the zero can be made to fail, which is the property the review is actually asking for.

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
| `prettier --check` per commit | clean |
| `SKIP=trufflehog,npm-format-check pre-commit run --files …` per commit | exit 0 |
| trufflehog `filesystem` per commit | `verified_secrets: 0`, `unverified_secrets: 0`; chunks 21 / 7 / 5 and bytes 200171 / 71706 / 62545, all non-zero |

The suite total is read from the runner's own `ℹ tests` line. It is UNCHANGED at 5141 across 295
suites: no case was added or deleted anywhere in this work — only assertions were removed, and only
where their subject could not change.

## Direct-coverage gates

Every touched pair re-measured. **Nothing moved.**

| Pair | Verdict |
|---|---|
| `edge/completions/data.ts` | **branches 109/110**, lines 100.00, functions 100.00, uncovered-line set empty — pin holds |
| `edge/completions/provider.ts` | **branches 79/80**, lines 100.00, functions 100.00, uncovered-line set empty — pin holds |
| `edge/handlers/marketplace/update.ts` | branches 11/12, lines 100.00, functions 100.00 — the 116-13 pin, unchanged |
| `edge/handlers/plugin/import.ts` | branches 11/12, lines 100.00, functions 100.00 — the 116-17 pin, unchanged |
| the other eight pairs | gate exit 0, complete direct coverage |

Both D-116-01a shortfalls this work was asked to re-measure keep their pinned identity: denominator
minus numerator exactly 1, lines and functions complete, uncovered-line set unchanged. No absolute
branch pair is pinned anywhere and no coverage-exception pragma exists.

## Observations for whoever comes next

- **Grep for the spy INSTALLATION, never for the door's name.** `t.mock.method(globalThis, "fetch",
  …)` does not contain `globalThis.fetch`. Two reviews of this finding were decided on a grep that
  matched only comment prose, and both concluded the opposite of the truth.
- **A zero and a fail-fast are different instruments, and only one of them survives an unreachable
  subject.** Where the count cannot rise, the count is worthless and the throwing replacement is
  still worth keeping: it converts a future dial-out from silent to loud. Say which one a suite has.
- **"The module imports git" and "this fixture can reach git" and "some input turns git on" are three
  different questions.** Twelve suites here answered them in four different combinations. 116-25 said
  this first; Plant D is the second independent confirmation, on `marketplace/update`.
- **A port-forward plant does not always reach the wire.** `add` and `bootstrap` clone, so deleting
  the forward dials for real. `update` refreshes an existing clone, and the real implementation dies
  on the missing remote before the transport. Probe the counter directly — move the count assertion
  ahead of the message comparison and assert `-1` — rather than reading a red suite as proof the
  counter moved.
- **The four `https.request` suites this phase already had were right, and the twelve were the
  inheritance.** The precedent that spread the wrong door is
  `tests/orchestrators/edge-deps.test.ts`, which still watches `globalThis.fetch` and is outside the
  edge tier and outside this scope. `tests/domain/github-auth.test.ts` watches `fetch` correctly —
  the device flow IS the repo's one `fetch` caller. Anyone extending this to the orchestrator tier
  should start from those two facts.
