# Orchestrators — plugin list — adversarial re-review

**Scope:** `tests/orchestrators/plugin/list.test.ts` (4,414 lines, 89 cases) and its paired
production module `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (1,575 lines).
The uninstall half of the first-pass file is agent B's; nothing here grades it.
**First-pass file:** `unit-test-findings/orchestrators-plugin-list-uninstall.md`
**Clean files attacked:** 1 (`list.ts` — the first pass's "Both production modules are otherwise
clean" claim is the only clean verdict in this area; the test-file clean list is literally "None")
**Existing findings graded:** 8 (5 unit-test + 2 production + 1 clean-list claim, list side only)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 7 |
| New WARNING (missed by first pass) | 15 |
| Existing CONFIRMED | 4 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 2 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 0 |

The first pass's diagnosis (substring assertions everywhere) is right about the *shape* and badly
short on the *consequence*. Three named requirement contracts — MSG-GR-3 marketplace ordering,
MSG-GR-3 in-block plugin ordering, and SC-6 scope narrowing — are provably unpinned: I can delete
`sortPluginsInBlock`, gut `compareMpForSort`, and delete the SC-6 filter, and all 89 cases stay
green. That is a different class of finding from "the assertion could be tighter."

## New findings — from the clean lists

### `tests/orchestrators/plugin/list.test.ts`

- **[BLOCKER] The whole in-block plugin sort can be deleted and every case stays green** —
  `list.ts:1440-1470`, no owning case.
  Mutation: replace `sortPluginsInBlock`'s body with `return plugins;`. I walked every case that
  renders more than one plugin row and, in all but one, **arrival order already equals sorted
  order**, so the sort is unobservable: `line 324` (installed `alpha` then manifest `beta`,
  `gamma`), `line 562` (`delta`, `epsilon`), `line 682` / `line 731` (`alpha`, `beta`, `gamma`),
  `line 854` (`bad/name`, `gone`), `line 1706` (`alpha`, `beta`), `line 2944` (`alpha`, `beta`,
  `gamma`), `line 3696` (`clean`, `degraded`). The single case whose arrival order differs from its
  sorted order is `line 1398` (arrival `fi[user], fu[user], fi[project], fu[project]`; sorted
  `fi, fi, fu, fu`) — and that case asserts four presence regexes (`lines 1497-1500`), never an
  order. Fix: convert the `line 1398` case to one `assert.equal(out, [...].join("\n"))` over the
  full six-line body, and add one case whose installed record sorts *after* a manifest-only entry
  (e.g. `installed: { zeta: ... }` with `manifest.plugins: [{ name: "alpha" }]`) asserted as a whole
  string. Those two changes pin the name-primary sort and the scope tie-break together.
- **[BLOCKER] The marketplace-block name sort can be deleted and every case stays green** —
  `list.ts:1422-1429`, no owning case.
  Mutation: `function compareMpForSort(a, b) { return SCOPE_SORT_RANK[a.scope] -
  SCOPE_SORT_RANK[b.scope]; }` (drop the `localeCompare` arm). Survivors: `line 1892` orders
  `p-mp[project]` before `u-mp[user]` — name order and scope order agree, so it cannot discriminate;
  `line 1931` is same-name cross-scope (scope arm only); `line 4299` is a case-tie
  (`Bravo`/`bravo`, comparator returns 0 either way); `line 4254` and `line 2125` each narrow with
  `marketplace:` down to a single block. **No case in the file ever renders two same-scope
  marketplaces with out-of-order names.** Fix: in the `line 4254` case drop the
  `marketplace: "alpha"` narrowing into a second sibling case that seeds `zeta` then `alpha` in
  project scope and asserts `deepStrictEqual(marketplaces, [alphaBlock, zetaBlock])`.
- **[BLOCKER] SC-6 scope narrowing is never proven to exclude anything** —
  `list.ts:1401-1402`, no owning case.
  Mutation: `const filtered = blocks;`. Every case that passes `scope:` seeds marketplaces in that
  scope only, and every case that seeds both scopes calls `listPlugins({ ctx, pi, cwd })` with no
  `scope` (`line 1398`, `line 1892`, `line 1931`, `line 1994`, and all seven
  `seedFoldedProjectClone` cases at `lines 3804-4187`). `line 1892` is titled "bare form … BOTH
  scopes" — it is the inclusion half only. Fix: add one case that seeds `u-mp` in user scope and
  `p-mp` in project scope, calls `listPlugins({ …, scope: "user" })`, and asserts the whole message
  equals the single `● u-mp [user]` block. The mirror with `scope: "project"` costs two more lines.
- **[BLOCKER] The orphan-fold `disabled` carry-over arm has no case, and its own comment names the
  regression** — `list.ts:1221-1228` (the `r.status === "disabled"` disjunct), no owning case.
  Mutation: delete `r.status === "disabled" ||` from the fold filter. Every fold case installs an
  enabled record: `line 1994` (installed), `line 1398` (partially-installed /
  partially-upgradable), `lines 3804-4187` (installed / upgradable via
  `seedFoldedProjectClone`, which hard-codes `enabled: true` at `line 3789`). The production
  comment at `list.ts:1191-1195` states the exact failure the arm prevents — "dropping it would
  both hide the row and let the user-side enumeration re-emit the plugin as a duplicate
  `(available)`" — and nothing plants it. Fix: give `seedFoldedProjectClone` an `enabled` parameter
  and add one case asserting the whole message is
  `["● mp1 [user]", "  ◍ alpha [project] v1.0.0 (disabled)"].join("\n")` with no
  `○ alpha … (available)` row. That single case also closes the two WARNINGs below (`scopeField` and
  `descriptionField` on the disabled arm).
- **[BLOCKER] Three cases whose titles promise a sort-arm proof assert only presence** —
  `line 1398` (`"…exercise the force scope-sort arms"`), `line 1513` (`"…exercise the unsupported
  scope-sort arm"`), `line 3325` (`"a `remote` row sorts by the marketplace scope when its name
  case-ties a sibling row"`).
  `line 1513`'s two rows are both `partially-available`, so `isScopeBearingListRow` is false for
  both and `scopeOf` returns `marketplaceScope` twice — the comparator returns 0 under *any*
  mutation of `scopeOf`; the case only proves two rows render (`line 1539` counts matches).
  `line 3325` is worse: `caseplug` is `available` and `CasePlug` is `remote`, both non-scope-bearing
  and both under a user marketplace, so mutating `scopeOf` to `return marketplaceScope;`
  unconditionally leaves it green — the case cannot observe the `p.scope ?? marketplaceScope`
  fallback its title names. These are coverage-driven cases: the arm executes, nothing checks its
  output. Fix: retitle them to what they actually prove, and move the real proof into the
  whole-message rewrite of `line 1398` described above.
- **[BLOCKER] `withHermeticHome` does not neutralize `PI_CODING_AGENT_DIR`; the sibling that does is
  next door** — `lines 104-125`.
  `locationsFor("user", cwd)` resolves through `getAgentDir()`, which honours `PI_CODING_AGENT_DIR`
  (`extensions/pi-claude-marketplace/persistence/locations.ts:136`, `:145`). This helper saves and
  restores `HOME` only. With `PI_CODING_AGENT_DIR` set in the environment, every user-scope case in
  this file — which is nearly all 89 — writes `state.json`, `claude-plugins.json` and marketplace
  fixtures into the developer's real agent directory and reads whatever is already there. That is
  the "writes into … a fixed path / developer setup" hermeticity break the guidelines classify as
  BLOCKER. `tests/orchestrators/marketplace/list.test.ts:139-161` is the correct form: it captures
  `originalAgentDir`, `delete process.env.PI_CODING_AGENT_DIR` before acting, and restores in
  `finally`. Fix: copy those four lines. **Repo-wide split (see Meta-findings): all four
  `tests/orchestrators/marketplace/*` copies do this; all six `tests/orchestrators/plugin/*` copies
  and `tests/architecture/cross-op-convergence.test.ts` do not.**
- **[BLOCKER] The cross-surface parity guard `availableRowMessage`'s JSDoc names does not exist** —
  `list.ts:670-676`.
  The doc says the export exists "because it is a cross-surface contract, not because a test wanted
  in", and that "the output-parity drift guard in tests/orchestrators/edge-deps.test.ts feeds the
  SAME git-source manifest through this builder and through the completion bucketizer and asserts
  the two agree on the status bucket, which is what holds the list `(available)` versus completion
  `unavailable` divergence class closed." `tests/orchestrators/edge-deps.test.ts` does not import
  `availableRowMessage` (verified: repo-wide, the only importer is
  `tests/orchestrators/plugin/list.test.ts:40`). Its git-source row
  (`tests/orchestrators/edge-deps.test.ts:488-514`) exercises the bucketizer's
  `loadManifestForMarketplace` against an independently written expectation. **The two surfaces have
  two independent expectations and nothing compares them** — the divergence class the comment claims
  is closed is open. Fix: either write the parity case the comment describes (feed one git-source
  manifest entry through `availableRowMessage` and through `loadManifestForMarketplace`, assert the
  two `status`/bucket values agree), or delete the claim and the export. Do not leave the comment
  standing; it is the reason a reviewer marked the export legitimate.

- **[WARNING] `descriptionField` is unasserted on three of the five installed-inventory arms** —
  `list.ts:557-559`, `:572-574`, `:484-486`.
  The PL-4 case (`line 2944`) covers `installed`, `available`, `unavailable` only. Deleting
  `...descriptionField` from the `disabled`, `partially-installed`, or `partially-upgradable`
  literal survives every case: `line 3659` (disabled, declared) and `line 3543`
  (partially-installed, declared) both use manifest entries with no `description`. Fix: add
  `description` to the manifest entry in the `line 3543` and `line 3659` fixtures and extend their
  existing whole-message literals by one `    <text>` line each.
- **[WARNING] `scopeField` is unasserted on the `disabled` arm** — `list.ts:484`.
  `[project]` is asserted for cross-scope `installed` (`line 3837`), `partially-installed` and
  `partially-upgradable` (`line 1498`, `line 1500`) and `upgradable` (`line 4045`), never for
  `disabled`. Closed by the new fold-disabled case above.
- **[WARNING] The `upgradable` guard is unproven for a manifest entry that omits `version`** —
  `list.ts:456-457`.
  Mutation: drop the `manifestEntry?.version !== undefined &&` conjunct. No case installs a record
  whose manifest entry has no `version` field (the only version-less entries in the file —
  `line 2732`, `line 2801`, `line 2919` — are not installed), so `undefined !== "1.0.0"` would
  silently render `(upgradable)` on a steady-state record and stay green. Fix: one case with
  `manifest.plugins: [{ name: "plug", source: "./plug" }]` and `installed: { plug: { version:
  "1.0.0" } }`, asserting `["● mp1 [user]", "  ● plug v1.0.0 (installed)"].join("\n")`.
- **[WARNING] No case declares both soft dependencies on one row** — `list.ts:306-317`.
  `line 3398` covers agents alone, `line 4223` covers mcp alone. Mutation:
  `if (declaresAgents) { return ["agents"]; }` before the mcp push — survives. The comment at
  `lines 1766-1770` names `{requires pi-subagents, requires pi-mcp}` as the exact leak shape and no
  case renders it. Fix: extend the `line 4223` fixture's `resources` with
  `agents: ["mcpplug-agent"]` and update its literal to
  `{not in manifest, requires pi-subagents, requires pi-mcp}`. (Array *order* inside
  `dependenciesFromDeclares` is not observable — `shared/notify.ts:2196` reduces it to two booleans
  before `softDepMarkers` — so do not spend a case on it.)
- **[WARNING] `probeFailureRow`'s filter bucket is unasserted** — `list.ts:944`.
  Mutation: `bucket: "available"`. Both probe-failure cases (`line 854`, `line 2906`) list
  passively, where the bucket is never consulted. The production comment at `list.ts:941-943`
  states "the `--unavailable` filter owns it". Fix: extend the `line 854` case with a second
  invocation under `unavailable: true` asserting the whole message still carries the
  `⊘ bad/name … {unreadable}` row, and a third under `available: true` asserting it does not.
- **[WARNING] The synthetic failure block's scope defaults but never varies** — `list.ts:1556`.
  Mutation: `scope: "user"`. `line 4333` passes no scope (covers the `??`) and `line 3085` passes
  `scope: "user"` (indistinguishable). Fix: add `scope: "project"` to a corrupt-state case and
  assert `● (list) [project]`.
- **[WARNING] Stale vocabulary in titles and comments, three retired tokens** — `present`:
  `line 360`, `line 1994` (in the `test()` title itself: "carry-over filter must discriminate on
  `present`"), `lines 2004-2006`, `line 2956`; production emits `status: "installed"`
  (`list.ts:608`). `--unsupported` / `(unsupported)`: the section header at `lines 1152-1163` and
  the titles at `line 1165`, `line 1239`, `line 1281`, `line 1513`, `line 1547` all name a filter
  flag that does not exist — `ListPluginsOptions` declares `partial` (`list.ts:190`) and the token
  renders `(partially-available)`, which is what those same cases actually assert
  (`line 1197`, `line 1579`). Fix: rewrite the titles and the section header to the current flag
  and token names; this is the vocabulary-drift class the repo already guards elsewhere.
- **[WARNING] `gap:` / `Gap N` titles and comments cite a retired internal enumeration** —
  titles at `line 2755`, `line 2865`, `line 2906`, `line 3053`, `line 3085`; comments at
  `line 2753`, `line 2864`, `line 2901`, `line 3048`, `line 3082`. Titles must state public
  behavior; `Gap 2:`/`Gap 7:` is per-document numbering of the same kind `.claude/rules/
  typescript-comments.md` bans for `Pitfall N`. Fix: strip the prefix, keep the behavior clause.
  Also `line 3084` and `line 2905` cite line numbers ("lines 264-269", "lines 149-151") that no
  longer point anywhere in `list.ts` — delete them rather than re-derive.
- **[WARNING] AAA markers out of order in a handful of cases** — `line 2412` / `lines 2418-2421`
  (`// assert` sits *after* two assertions, immediately before `verify`), `line 1030` /
  `lines 1034-1035` (asserts with no preceding `// assert`), `line 2564` / `line 2567`. Counts are
  89 `// arrange`, 90 `// act`, 89 `// assert` for 89 cases, so this is placement drift, not
  absence. Fix: move the marker above the first assertion in each.
- **[WARNING] `withHermeticHome` is hand-copied into 13 test files; `marketplace-seed.ts` lives
  under another concern** — `lines 104-125`, and the import at `lines 48-52`.
  Thirteen files declare their own `withHermeticHome` (verified by grep for
  `function withHermeticHome`), and they have already diverged on `PI_CODING_AGENT_DIR` (BLOCKER
  above). Separately, this orchestrator suite imports its seeds from
  `tests/edge/handlers/marketplace-seed.ts` — support for one concern parked inside another's
  directory. Fix: one `withHermeticHome` beside the orchestrator tests, one import site per file;
  move `marketplace-seed.ts` to where its 15 consumers' concern lives.
- **[WARNING] `out` is a placeholder name, 67 sites** — representative `line 352`, `line 402`,
  `line 1090`. The value's production role is the rendered notification message. Fix as part of the
  whole-message rewrite: `const message = notifications[0]!.message;` — or, better, drop the local
  entirely and assert against `notifications` with `deepStrictEqual`, as `line 2303` and
  `line 4243` already do.

### `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`

- **[WARNING] `loadManifestSoftly` is an identity wrapper whose JSDoc describes error handling it
  does not perform** — `lines 271-279`.
  The body is `return loadMarketplaceManifest(manifestPath);`. The doc says it "Wraps
  `loadMarketplaceManifest` so a thrown error becomes a `(failed)`
  MarketplaceNotificationMessage" — nothing is wrapped; the `try`/`catch` lives in
  `loadMarketplaceManifestSoftly` (`lines 1113-1118`), which is the only caller. Fix: delete
  `loadManifestSoftly` and call `loadMarketplaceManifest` directly at `line 1114`; move the
  rationale sentence into `loadMarketplaceManifestSoftly`'s doc where the `catch` actually is.
- **[WARNING] `narrowProbeError` and `narrowListFailReason` are byte-identical delegates whose docs
  claim a distinction that does not exist in code** — `lines 631-633` and `lines 1489-1491`.
  Both are `return sharedNarrowProbeError(err);`. The second carries 18 lines of JSDoc
  (`lines 1472-1488`) arguing that using the first "conflated two failure surfaces" and that this
  one "returns closed-set Reasons accurate to the list-orchestration failure modes" — they return
  the same value for the same input, always. The distinction is naming only. Fix: keep one wrapper
  (or call the shared classifier at both sites) and rewrite the doc to say what is true: the two
  call sites mean different things by the same token, and the codomain is deliberately shared.
  Leaving it as-is means a future author "fixing" the divergence has no way to tell there is none.
- **[WARNING] `list.ts` re-implements the canonical `compareByNameThenScope` and thereby slips the
  drift gate built to prevent exactly that** — `lines 1167`, `1422-1429`, `1460-1469`.
  `shared/notify.ts:4185` is the canonical comparator, and its own header
  (`notify.ts:4158-4160`) claims "SINGLE source of that policy. Every list-rendering surface (mp
  list, **plugin list**, import / update / reinstall cascades) consumes this helper directly."
  The plugin list does not: it declares `SCOPE_SORT_RANK: Readonly<Record<Scope, number>> = {
  project: 0, user: 1 }` and hand-rolls both the `localeCompare(…, { sensitivity: "base" })` name
  arm and the rank subtraction, twice. Eight production modules import the shared comparator
  (`import/execute.ts`, `bridges/hooks/event-router.ts`, `reinstall.{ts,messaging.ts}`,
  `reconcile/{notify,pending}.ts`, `fetch.ts`, `update.ts`) — `list.ts` is the lone divergence.
  `tests/architecture/scope-order-drift.test.ts` exists to catch this, but its detector is
  `/===\s*"user"\s*\?\s*\d+\s*:\s*\d+/` (`:58`) — a ternary-shaped regex that a `Record` lookup
  walks straight past, and `list.ts` carries no `// scope-order: justified` marker. Fix: replace
  both comparators with `compareByNameThenScope`; that also deletes `SCOPE_SORT_RANK`. See
  Meta-findings for the gate half.
- **[WARNING] `BuiltMarketplace.emitScope` is always `mp.scope`** — `lines 1153-1156`, set at
  `line 1279` and `line 1317`, read at `line 1402`. Both construction sites assign `mpScope`, which
  is also `mp.scope`. Fix: delete the field and filter on `b.mp.scope`.

## Export ownership census

`extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`

| Export | Kind | Owning case | Status |
| --- | --- | --- | --- |
| `listPlugins` | function | ~85 cases, e.g. `list.test.ts:299`, `:2276`, `:4333` | owned |
| `loadPluginListPayload` | function | `list.test.ts:4254`, `:4299` | owned; real production consumer at `edge/handlers/tools.ts:330` |
| `availableRowMessage` | function | `list.test.ts:4189` | **test-only export.** Zero production consumers repo-wide (three matches are prose in `edge-deps.ts:124`, `git-source-probe.ts:5`, `fetch.ts:426`). Only the `installable`/`available` arm is directly asserted; `remote`, `partially-available`, `unavailable` and every `bucket` value are reached only through `listPlugins` |
| `CandidateRow` | interface | — | no case; structurally required *only because* `availableRowMessage` is exported (private-type-leak). Falls with it |
| `FilterBucket` | type | — | **no consumer outside `list.ts`.** The `ToolFilterBuckets` in `edge/handlers/tools.ts:260` is an unrelated local interface. Violates "every export is used outside its module"; survives `fallow dead-code` only because it is reachable through the exported `CandidateRow.bucket` |
| `ListPluginsOptions` | interface | `list.test.ts:60-63` (`satisfies` pin + one `@ts-expect-error` negative) | structurally required as `listPlugins`' parameter type; the negative pins only the absence of a `gitOps` *option*, not of a git *import* |

## Branch census

**Reachable and untested** (each a finding above):

| Site | Branch |
| --- | --- |
| `list.ts:1401-1402` | SC-6 `blocks.filter(b => b.emitScope === opts.scope)` — never observed excluding a block |
| `list.ts:1423-1425` | `compareMpForSort`'s `byName !== 0` arm |
| `list.ts:1461-1463` / `:1466-1469` | `sortPluginsInBlock`'s name arm and scope tie-break |
| `list.ts:1224` | fold carry-over `r.status === "disabled"` |
| `list.ts:456` | `manifestEntry?.version !== undefined` guard (entry present, version absent) |
| `list.ts:484`, `:558`, `:573` | `scopeField` on `disabled`; `descriptionField` on `disabled` / `partially-installed` / `partially-upgradable` |
| `list.ts:311-314` | `dependenciesFromDeclares` with both flags true |
| `list.ts:944` | `probeFailureRow`'s `bucket: "unavailable"` |
| `list.ts:1556` | `opts.scope ?? "user"` with a non-user scope |

**Not observable by any input** (do not write cases for these):

- `list.ts:1444-1446` — `sortPluginsInBlock`'s `plugins.length === 0` early return is a
  micro-optimization; the sorted path returns the same value. Equivalent mutation.
- `list.ts:307-315` — the push *order* in `dependenciesFromDeclares`. `shared/notify.ts:2196`
  reduces the array to two booleans, so order cannot reach the rendered bytes.

**Compiler-forced, not removable** (D-116-01a category):

- `list.ts:851-889` — `resolvedCandidateRow`'s three-arm `switch` has **no `default`**, contrary to
  the style guide's "every `switch` has a `default` group". The doc at `lines 839-842` argues the
  explicit `CandidateRow` return type plus `noImplicitReturns` turns a fourth `ResolvedPlugin` arm
  into TS7030 at compile time, and the repo has independently recorded that TS7030 does fire in
  exactly this shape. All three arms are covered (`line 1165`, `:1239`, `:418`). Treat as
  justified, not as a fifth instance of META-FINDINGS item 5 — see Corrections below.

## Grading of first-pass findings

### `tests/orchestrators/plugin/list.test.ts`

- **UNDERSTATED** — *Row/list assertions use substrings and regexes instead of the whole rendered
  value*. The count is right (73 `assert.match` + 9 `assert.doesNotMatch` + 53 `.includes(` + 8
  `assert.ok`, against 28 multi-line `assert.equal` + 8 `deepStrictEqual`), the severity is already
  BLOCKER and cannot rise, but the recorded fix — "convert these cases to a full expected string" —
  is necessary and **not sufficient**, and the finding never says what is actually lost. Three
  named contracts have no proof at all and converting existing assertions will not create one,
  because in almost every multi-row case the arrival order already equals the sorted order: the
  in-block plugin sort, the marketplace-block name sort, and SC-6 exclusion each need a *new
  fixture* whose expected order differs from its input order. The three "sort-arm" cases
  (`line 1398`, `:1513`, `:3325`) are worse than weak — two of them are structurally incapable of
  observing the arm they name. Raise the fix instruction to include the three new fixtures.
- **CONFIRMED** — *Expected value computed by calling the production classifier under test*
  (`line 2419`, `lines 2566-2569`). Both call `narrowUnsupportedKinds` from
  `shared/probe-classifiers.ts`, the same function `partiallyInstalledReasons` (`list.ts:335`) and
  `resolvedCandidateRow` (`list.ts:571`) call internally. Tautological; the hand-written tokens are
  `{lsp}` and `{lsp, unsupported source}` and are already written literally at `line 1197`,
  `line 2304` and `line 3534`.
- **CONFIRMED** — *Header comment claims an in-file network source-grep that does not exist*
  (`lines 16-17`). Correct. One qualification the fixing pass needs: the risk is **not** live —
  `tests/architecture/no-orchestrator-network.test.ts:78` names
  `orchestrators/plugin/list.ts` explicitly in its target array, so a `gitOps` import into `list.ts`
  *is* gated, just not here. Fix the comment; do not duplicate the grep.
- **OVERSTATED** — *`DISABLED_BARE_ROW` module-level constant shared across two test cases*
  (`line 1771`). It is a frozen string literal, and the sharing is the point: `lines 1841-1844`
  compare two independently-rendered outputs against **one** literal so a divergence turns exactly
  one comparison red. Inlining it weakens the case. Downgrade to no-action.
- **CONFIRMED** — *`outcome.status === …` narrow-then-property-check / RSTA-07 multi-block
  fragments* (`lines 967-1007`). Real, and fully subsumed by the substring BLOCKER; do not track
  it separately.

### `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`

- **CONFIRMED** — *The module bundles three separable responsibilities.* The seam boundaries the
  first pass named are right, and the sibling precedent (`list.messaging.ts`,
  `plugin-state-classifier.ts`, `git-source-probe.ts`) is real. Sequence it before the test rewrite:
  the three new fixtures this review asks for land in whichever file owns the sort.
- **OVERSTATED** — *`catch {}` returning `undefined` without a comment at the call site*
  (`lines 393-397`). The first pass's own text concludes "No action required beyond noting it."
  The rationale occupies `lines 358-382` immediately above, and the style rule bans an *empty*
  catch without a comment — this one returns a value and is documented. Drop it; it is noise in a
  backlog.
- **REFUTED** — *Clean-files claim: "no export in either file exists solely to serve a test —
  `availableRowMessage`, `CandidateRow`, `FilterBucket`, and `loadPluginListPayload` all have real
  non-test production consumers or are structurally required by the type checker (verified against
  `edge/handlers/tools.ts` and `edge/handlers/plugin/*.ts`)".* Only `loadPluginListPayload` has a
  production consumer (`edge/handlers/tools.ts:40`). `availableRowMessage`'s sole importer
  repo-wide is `tests/orchestrators/plugin/list.test.ts:40`; `FilterBucket` has no importer at all
  (the `ToolFilterBuckets` at `edge/handlers/tools.ts:260` is a different, local symbol and is what
  a name-substring check would have hit); `CandidateRow` is required only as
  `availableRowMessage`'s return type. See the BLOCKER above on the JSDoc that made this claim
  look verified.

## Still clean after attack

`list.test.ts` catches all of the following. A fixing pass should not spend time here.

- **Double notification.** `makeCtx` (`lines 82-96`) constrains `ctx.ui` to `.once()`,
  `ui.notify` to `.once()` and `pi.getAllTools()` to `.twice()`, with `verify(ctx)`/`verify(pi)`/
  `verify(ui)` in all 89 cases (286 `verify` calls). A second `notifyWithContext` call throws on the
  unexpected read — which is why the absent `notifications.length` assertions in most cases are not
  a hole. The `line 4364` case proves the harness by *deliberately* widening to `.twice()`/
  `.times(4)` for the two-notify path.
- **Purity.** `line 2276` snapshots both trees base64-byte-for-byte before and after and compares
  with `deepStrictEqual` (`lines 2294-2309`); any state or cache write during list turns it red.
- **No-network on the cold path.** `line 614` `stat`s `locations.pluginClonesDir` *after* the render
  and asserts the caught `code === "ENOENT"`. A surface that quietly materialized a clone fails.
  The case's own comment (`lines 654-665`) reasons through both ways the probe could be vacuous —
  this is the best-designed case in the file.
- **Own-manifest authority for folded rows, in four independent directions.** `line 3804` (failed
  read ⇒ no brace), `:3846` (loaded-without-entry ⇒ brace), `:3948` and `:4002` (upgradable in both
  directions), `:4054` (description) each hold one axis constant and disagree the two manifests on
  the other. Mutating `manifestLookupFor` to read the user block's manifest fails four cases.
- **The CR-01 degrade.** `line 2460` plants a throwing candidate resolve beside a clean sibling and
  asserts the list is not blanked (`out.includes("(failed)") === false`). Removing the `try` in
  `probeUpgradeCandidate` fails it.
- **Reload-trailer suppression.** Setting `needsReload: true` on the inventory row
  (`list.ts:616`) adds the `/reload` trailer and fails every whole-message equality —
  `line 3389`, `:3459`, `:4245` among them.
- **Non-`Error` normalization.** `line 4364` throws a bare string through a generator and asserts
  the rendered `cause: ui unavailable`, covering `list.ts:1538`'s else-arm.
- **Reason composition order.** `line 805` pins degrade-token-then-author-token; `line 3534` pins
  absence-token-first; `line 3423` pins typed-reason-before-soft-dep-marker. Reordering any of the
  three fails.
- **`details` projection.** `line 4286`'s `deepStrictEqual` would fail if `lastUpdatedAt` leaked
  into the plugin-list surface.
- Not a defect, and worth recording so nobody churns it: the file imports `node:assert/strict`
  (`line 27`), so `assert.equal` and `assert.deepEqual` here **are** the strict variants. The loose
  comparison concern raised elsewhere in the sweep does not apply to this file.

## Not covered

- I did not run the suite, `tsc`, or coverage — diagnostic-only per the brief. Every "mutation
  survives" claim is from reading all 89 cases and tracing the fixtures, not from executing a
  mutant. The three sort/scope BLOCKERs are the ones I would execute first to confirm.
- `tests/orchestrators/plugin/list.messaging.test.ts` and `list.messaging.ts` were out of section.
  `LIST_CONTEXT` reaches this file only as an opaque argument at `list.ts:1518`.
- I read `tests/architecture/catalog-uat.test.ts` only enough to establish that it drives
  `notify()` with hand-built payloads and never calls `listPlugins` (its single "listPlugins"
  occurrence, `:820`, is prose). Its own quality is another area's.
- The uninstall half of the first-pass file — all seven of its findings and its production notes —
  is agent B's and is ungraded here.

## Meta-findings impact

### New cross-cutting evidence

1. **`PI_CODING_AGENT_DIR` is unneutralized in seven `withHermeticHome` copies, and the split is
   clean along directory lines.** Grep for `PI_CODING_AGENT_DIR` per file that declares its own
   `withHermeticHome`: `tests/orchestrators/marketplace/{list,autoupdate,info}.test.ts` = 4
   occurrences each, `marketplace/update.test.ts` = 1; and **zero** in
   `tests/orchestrators/plugin/{list,install,uninstall,info,reinstall,update,enable-disable}.test.ts`
   and `tests/architecture/cross-op-convergence.test.ts`. Every user-scope case in those seven
   files writes to the developer's real agent directory when that variable is set. The correct form
   is `tests/orchestrators/marketplace/list.test.ts:139-161`. **Check every plugin-orchestrator
   area file for this; it is a hermeticity BLOCKER that no first-pass area reported.** The root
   cause is the 13-way duplication of `withHermeticHome`, which belongs in the "cross-file
   duplicated helpers" cluster — this is the first evidence that those copies have *functionally*
   diverged, not just textually.
2. **A sixth "gate that does not gate", and this one has a named victim.**
   `tests/architecture/scope-order-drift.test.ts` exists to stop modules re-deriving the MSG-GR-3
   scope rank instead of importing `compareByNameThenScope`. Its detector is a ternary-shaped regex
   (`:57-58`). `orchestrators/plugin/list.ts:1167` re-derives the rank as
   `Readonly<Record<Scope, number>> = { project: 0, user: 1 }` and hand-rolls the whole comparator
   twice (`:1422-1429`, `:1460-1469`) — invisible to the gate, with no
   `// scope-order: justified` marker. Two further problems in the same file:
   (a) its header (`:4-6`, `:29-33`) says it "complements the runtime ESLint rule
   `msg-gr-3-per-scope` (scoped to `orchestrators/**` and `edge/handlers/**`)", and that rule does
   not exist in `eslint.config.js` — the planning record shows it was deleted, so the narrow regex
   is now the *whole* gate rather than the repo-wide half of a pair; (b) its `ALLOWLIST_FILES`
   comment (`:49-54`) documents `notify.ts` as canonical, which is right, while
   `notify.ts:4158-4160` claims "Every list-rendering surface (mp list, plugin list, …) consumes
   this helper directly" — false for the plugin list. **Add this to the gate audit and re-scan
   every zone for `Record`-shaped or `Map`-shaped scope-rank derivations, which the regex cannot
   see.**
3. **Ordering contracts are the sweep's blind spot, and it is structural.** Substring assertions do
   not merely under-constrain content — they silently delete *every* ordering guarantee, and a
   whole-message rewrite does not restore them, because most fixtures are built in already-sorted
   order. `list.ts` alone loses three (marketplace name sort, in-block plugin sort, SC-6
   exclusion) and carries three cases whose titles claim to prove sort arms they cannot observe.
   **Every area with a `compareByNameThenScope` call site or a `.sort(` in an orchestrator should
   be asked one question: does any case exist whose expected order differs from its arrival
   order?** Candidates from my greps: `reinstall.ts:822`, `update.ts:2727`, `fetch.ts:190`,
   `reconcile/{notify,pending}.ts`, `import/execute.ts:510`, `bridges/hooks/event-router.ts:321`.
   `tests/orchestrators/plugin/reinstall.test.ts:1353` is the in-repo example of doing it right —
   it asserts a header index comparison with a diagnostic message.
4. **Doc comments that name a nonexistent test are more dangerous than doc comments that lie about
   status.** `list.ts:670-676` names a specific parity guard in a specific file as the reason an
   export is legitimate and as the thing holding a divergence class closed. The guard does not
   exist, and a first-pass reviewer recorded the export as verified-clean on the strength of that
   sentence. **Any comment of the form "the guard at `<path>` asserts X" should be checked by
   opening `<path>`, in every area.** The reference implementation for the honest form is
   `tests/architecture/no-orchestrator-network.test.ts`, whose target array is the authoritative
   list and says so.
5. **One-line delegate pairs with divergence-claiming docs.** `list.ts:631` and `:1489` are
   identical bodies with 18 lines of JSDoc arguing they differ. `fallow dupes` has
   `threshold: 3`, so single-line clones are structurally invisible to it. Worth a targeted sweep
   for `function narrow*(err: unknown)` wrappers elsewhere.

### Corrections to META-FINDINGS.md

- **"Ranked by leverage" item 3, the `orchestrators/plugin/list.test.ts | ~130+ sites` row.** The
  count is accurate but the leverage estimate is wrong in one direction the plan depends on. The
  row implies the fix is mechanical propagation of the `*.messaging.test.ts` convention ("The
  correct form already exists next door… copying the sibling convention, not designing one"). For
  this file that is only half true: converting the ~140 fragment assertions to whole-string
  equality does **not** recover the three ordering/narrowing contracts, because the existing
  fixtures are built in sorted order. Budget three new fixtures on top of the conversion. The
  same caveat probably applies wherever a list-rendering surface sorts.
- **"Ranked by leverage" item 5, "Restore exhaustiveness on closed-union switches".** The section
  names four modules and frames the missing-`default` shape as uniformly a defect.
  `orchestrators/plugin/list.ts:851-889` is a fifth `switch` over a closed union with no `default`
  — and it is **correctly justified**: `lines 839-842` state the reasoning, the explicit
  `CandidateRow` return type plus `noImplicitReturns` makes a fourth `ResolvedPlugin` arm a
  TS7030 compile error, and the repo has separately confirmed TS7030 fires in this shape. The item
  should distinguish "no `default`, no compile-time backstop" (the real defect) from "no
  `default`, return-type-forced exhaustiveness, documented" (`list.ts`), or a fixing pass will add
  an unreachable `assertNever` arm that `fallow dead-code` then flags.
- **"Real defects found outside the test layer" and "Gates that do not gate" both understate the
  gate problem by one instance.** `scope-order-drift.test.ts` makes six, and unlike the other
  five it has a *demonstrated* escapee (`list.ts`), not just a theoretical bypass.

### Confirmations

- **"Clean verdicts are not reliable."** Confirmed hard. This area's only clean verdict — "Both
  production modules are otherwise clean … no export in either file exists solely to serve a
  test" — is refuted by three exports on the list side, and the sentence that made it look verified
  was a production doc comment naming a test that does not exist.
- **"The dominant shape: sibling drift."** Confirmed twice from a second angle, both times with the
  correct sibling in hand: `list.ts` is the only list-rendering orchestrator of nine that does not
  import `compareByNameThenScope`, and `tests/orchestrators/plugin/list.test.ts`'s
  `withHermeticHome` is the plugin-side copy of a helper the marketplace-side copies fixed.
- **"Strict interaction mocking … `tests/orchestrators/**` top level" as a reference
  implementation.** Confirmed. `list.test.ts:82-96` is a genuinely good `strong-mock` harness:
  `exactParams: true`, named mocks, exact call counts (`.once()`/`.twice()`), and
  `verify(ctx)/verify(pi)/verify(ui)` in all 89 cases. It is what makes the missing
  `notifications.length` assertions harmless. It is also, notably, the sibling
  `uninstall.test.ts` should copy — which is what the first pass's uninstall BLOCKER says.
- **"Direct per-pair coverage was never measured."** Confirmed and worth sharpening: several
  branches in `list.ts` are *executed* by cases that never assert their output (the fold
  carry-over statuses, `scopeOf`, `probeFailureRow`'s bucket). Line coverage on this pair would
  read high while the mutations above all survive. Do not treat the outstanding
  `test:coverage:direct` run as a substitute for the mutation questions.
