# Edge — marketplace handlers — adversarial re-review

**Scope:** all 7 production modules under
`extensions/pi-claude-marketplace/edge/handlers/marketplace/` and all 7 paired
test modules under `tests/edge/handlers/marketplace/` (read in full, 3,249
lines total), plus the collaborators needed to run the mutation test:
`edge/args.ts`, `edge/args-schema.ts`, `edge/handlers/shared.ts`,
`edge/types.ts`, `edge/register.ts`, `persistence/locations.ts`,
`orchestrators/marketplace/{add,update,shared}.ts`,
`tests/edge/notification-boundary.ts`, `tests/edge/handlers/marketplace-seed.ts`,
`tests/platform/git-ops-fake.ts`, `tests/persistence/locations.test.ts`.
**First-pass file:** `unit-test-findings/edge-handlers-marketplace.md`
**Clean files attacked:** 1 (`tests/edge/handlers/marketplace/shared.test.ts` —
the only entry on either clean list; the production clean list was empty)
**Existing findings graded:** 15

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 6 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 6 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the clean lists

### `tests/edge/handlers/marketplace/shared.test.ts`

- **[BLOCKER] No case proves the handler awaits its delegate** — `lines 48–65`
  (and the five sibling `makeSingleNameMarketplaceHandler` cases at 68, 90, 111,
  130, 151).
  Mutating `shared.ts:69` from `await run({...})` to `void run({...})` leaves all
  six cases green. `verify(run)` only records that the call was made; the call is
  made synchronously inside the handler either way. `notifications` is `[]` in
  both worlds, and `verifyBoundary()` still passes because `ctx.cwd` is read
  synchronously in the options literal before `run` is invoked, so its
  `times(1)` expectation is met. In production this mutation makes
  `/claude:plugin marketplace info` resolve before `getMarketplaceInfo` has
  finished and turns any orchestrator rejection into an unhandled rejection
  instead of a value Pi's dispatcher can see.
  This gap is unique to this file: the same mutation goes red by accident in all
  six Group-A/C suites, because those await real filesystem work and would read
  an empty `notifications` array at assert time.
  Fix — add one case to the `makeSingleNameMarketplaceHandler` describe:
  ```ts
  const failure = new Error("delegate failed");
  when(() => run({ ctx, cwd: "/work/project", name: "official", pi })).thenReject(failure);
  const handler = makeSingleNameMarketplaceHandler(pi, INFO_USAGE, run);
  await assert.rejects(async () => handler("official", ctx), (error) => error === failure);
  ```
  Assert by identity, not by message substring. Keep `verifyBoundary()` and
  `verify(run)` after it.

- **[WARNING] The two exports in this file disagree about unknown long flags and
  only one side is stated** — `line 261` states the rejecting side; nothing
  states the accepting side.
  `openMarketplaceCommand` runs `extractLocalFlag` first, so
  `openMarketplaceCommand("official --bogus", …)` returns `undefined` and emits
  `Unknown flag: "--bogus".` (case at 261). `makeSingleNameMarketplaceHandler`
  does **not** call `extractLocalFlag`, so `handler("official --bogus", ctx)`
  drops `--bogus` as an undeclared second positional and delegates normally, and
  `handler("--scope project --local", ctx)` delegates with `name: "--local"`.
  Neither behaviour is stated here. The only case in the repo that pins it is
  `info.test.ts:263–285`, which proves it by round-tripping through
  `getMarketplaceInfo`'s `A marketplace operation has failed.\n\n⊘ --local
  [project] (failed) {marketplace not added}` grammar — another module's
  contract, reached through a 3-marketplace filesystem fixture, to state a fact
  about this file's parse.
  Fix — add two cases here and delete `info.test.ts:263–285`:
  ```ts
  when(() => run({ ctx, cwd: "/work/project", name: "--local", pi, scope: "project" }))
    .thenResolve(undefined);
  await handler("--scope project --local", ctx);
  ```
  and a sibling driving `handler("official --bogus", ctx)` against
  `when(() => run({ ctx, cwd: "/work/project", name: "official", pi }))`. Title
  them so the divergence from `openMarketplaceCommand` is explicit
  (`"delegates with an unknown long flag dropped as a surplus positional"`).

- **[WARNING] A case names its second handler after `remove`, which does not use
  this factory** — `lines 151–177` (`removeRun`, `removeHandler`, both built with
  `INFO_USAGE`).
  `makeSingleNameMarketplaceHandler` has exactly one production call site,
  `info.ts:21`; `remove.ts` uses `openMarketplaceCommand`. The case is about
  per-factory `pi` capture, not about the remove command, so the names describe a
  production role that does not exist (see the paired `shared.ts` doc finding
  below, which is the root cause). Rename to `secondRun` / `secondHandler`, or —
  better — build the second handler with a genuinely different usage string and
  add `assert` coverage that each handler emits its own usage block, which is the
  fact the name was reaching for.

## New findings — production modules

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts`

- **[BLOCKER] The collapse arm at line 41 is unreachable dead code, holding the
  pair below 100% branch coverage** — `line 41`
  (`message: message === USAGE ? "Missing required argument." : message`).
  `parseCommandArgs` (`edge/args-schema.ts:81`) passes `schema.usage` to
  `onError` **only** from the required-positional branch; this schema declares
  its sole positional `required: false` (`update.ts:34`), so the callback is only
  ever reached from `parseArgsOrNotify` with one of the two tokenizer diagnostics
  in `edge/args.ts:45,47`, neither of which can equal `USAGE`. The true arm is
  therefore unreachable through this module's exports — category (b),
  reachable-by-nothing production dead code, not compiler-forced.
  `update.test.ts:50–68` already measured this ("170 argument shapes produced no
  notification beginning `Missing required argument.`") and chose to document the
  shortfall rather than remove the code. The unit-testing rules say the opposite:
  "dead code is removed or covered through public behavior," and "direct pair
  coverage below 100%" is a BLOCKER.
  Fix — delete the ternary, leaving
  ```ts
  (message) => {
    notifyUsageError(ctx, { message, usage: USAGE });
  },
  ```
  which is byte-for-byte what the two siblings that also declare an optional or
  empty positional already do (`list.ts:29–31`, `autoupdate.ts:43–45`). Then
  delete the 19-line D-116-01a block at `update.test.ts:50–68`. The collapse is
  correct and live in `shared.ts:60` and `shared.ts:121`, which declare **required**
  positionals; only `update.ts` carries it without needing it.

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts`

- **[WARNING] Two doc comments describe a wiring that no longer exists** —
  `lines 3–8` and `lines 21–24`.
  The file header says the factory serves "the single-`<name>`-positional
  marketplace edge handlers (`info` / `remove`)" and that "Both shims ... delegate
  to their orchestrator with `{ ctx, pi, name, cwd, scope? }`".
  `makeSingleNameMarketplaceHandler` has exactly one call site — `info.ts:21`.
  `remove.ts:29` uses `openMarketplaceCommand` and delegates with an additional
  `local?` member. The `SingleNameMarketplaceRun` JSDoc repeats the error:
  "Delegate shape shared by `getMarketplaceInfo` and `removeMarketplace`" —
  `removeMarketplace` is never passed through this type.
  This is the class `.claude/rules/typescript-comments.md` bans outright
  ("narration of code that no longer exists"), and it has already propagated into
  the test file (`shared.test.ts:154–176`, previous finding).
  Fix — rewrite the header to name `info` as the sole consumer and to describe
  `openMarketplaceCommand` (which serves `add` and `remove`, and which the
  header currently does not mention at all); rewrite the type's JSDoc to
  "Delegate shape `getMarketplaceInfo` satisfies," dropping the
  `RemoveMarketplaceOptions` sentence.

- **[WARNING] Unknown long flags behave three different ways across the six
  marketplace subcommands and no comment or case states the split** —
  `openMarketplaceCommand` (`shared.ts:108`) and `autoupdate.ts:32` reject with
  `Unknown flag: "--x".`; `makeSingleNameMarketplaceHandler` (`shared.ts:52`, so
  `marketplace info`) and `list.ts:23` silently drop the token and run the
  command; `update.ts:31` takes it as the marketplace name and reports
  `{marketplace not added}`.
  Only the rejecting third has a case (`add.test.ts:463`,
  `remove.test.ts:359`, `autoupdate.test.ts:203`); the two surprising behaviours
  are the untested ones. Nothing prevents a later consolidation — routing `info`
  through `openMarketplaceCommand`, which is the obvious next step now that
  `remove` already does — from silently changing user-facing behaviour with a
  green suite.
  Fix — pin the accepting side at the seam that owns it (the two
  `shared.test.ts` cases in the previous finding) and add a `//` note on
  `makeSingleNameMarketplaceHandler` stating that it deliberately does not scan
  flags, so `--local` and unknown long flags reach it as positionals.

### All six handler factories

- **[WARNING] Six of the seven exported factories carry no JSDoc, while their
  plugin-tier siblings all do** — `add.ts:25`, `autoupdate.ts:26`, `info.ts:18`,
  `list.ts:19`, `remove.ts:25`, `update.ts:26`.
  Each module has a good file header but nothing on the export itself, so the
  style rule "every top-level export is documented" is unmet six times in one
  directory. `shared.ts:38` and `shared.ts:79` are the in-directory reference,
  and `edge/handlers/plugin/{fetch,info,install,list,pending}.ts` all document
  theirs.
  Fix — add one third-person verb-phrase line above each factory, e.g.
  `/** Returns the handler for \`marketplace add\`, closed over \`pi\` and the injected git port. */`.
  Do **not** copy the plugin tier's `/** Factory: returns ... */` opener —
  `edge-handlers-plugin.md` already logged that noun-phrase form as a finding.

### Five test modules (grouped)

- **[WARNING] The scope-landing claim is measured with the same production
  function that produced the fixture** — `add.test.ts:198–217`,
  `info.test.ts:147`, `list.test.ts:121`, `remove.test.ts:166–220`,
  `update.test.ts:225–227`.
  Each of these files seeds and/or reads its footprint through
  `locationsFor(scope, cwd)`, so both sides of the "which scope did the command
  land in" assertion go through `persistence/locations.ts`. Concretely: swap the
  two arms of `locations.ts:145`
  (`scope === "user" ? getAgentDir() : path.join(cwd, ".pi")`) and
  `remove.test.ts`, `info.test.ts` and `list.test.ts` stay green, because seed and
  read move together. That contradicts the headers, which state the footprint
  read makes scope "a measurement rather than a re-derivation of the path the
  workflow computed" (`autoupdate.test.ts:29–32`).
  `autoupdate.test.ts` is the in-area reference implementation that gets it
  right: it hand-authors `<cwd>/.pi` for the project root and pins the user root
  through `PI_CODING_AGENT_DIR` (`lines 114–141`), and it goes **red** under that
  same mutation.
  Severity is WARNING, not BLOCKER, on the evidence that no defect currently
  hides behind the circularity: `tests/persistence/locations.test.ts:127–140`
  and `:83–87` hand-author and assert both scope roots independently, so the
  swap is caught by the pair that owns it.
  Fix — propagate `autoupdate.test.ts`'s `HermeticWorkspace` shape into the other
  five: hand-author `projectRoot = path.join(cwd, ".pi")` and
  `userRoot = process.env.PI_CODING_AGENT_DIR`, then compose the four leaf paths
  literally (`<root>/pi-claude-marketplace/state.json`,
  `<root>/claude-plugins.json`, `<root>/claude-plugins.local.json`,
  `<root>/pi-claude-marketplace/sources/<name>`). Note that adding the injection
  seam (existing finding, below) dissolves this finding entirely, because
  "which scope landed" then becomes a `scope` member inside an asserted options
  bag rather than a filesystem inference — sequence the seam first.

## Export ownership census

Every export in the area has an owning case. No orphans, no incidental-only
coverage.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `marketplace/shared.ts` | `SingleNameMarketplaceRun` (type) | `shared.test.ts:40` (`Parameters<typeof makeSingleNameMarketplaceHandler>[2]`) | owned at compile time; exported to avoid a private-type leak in the factory signature — correct, not a dead export |
| `marketplace/shared.ts` | `makeSingleNameMarketplaceHandler` | `shared.test.ts:48, 68, 90, 111, 130, 151` | owned |
| `marketplace/shared.ts` | `openMarketplaceCommand` | `shared.test.ts:185, 206, 223, 239, 261, 283, 305` | owned |
| `marketplace/add.ts` | `makeAddHandler` | `add.test.ts:285, 331, 362, 389, 418, 441, 463, 485` | owned |
| `marketplace/autoupdate.ts` | `makeAutoupdateHandler` | `autoupdate.test.ts:203, 224, 246, 272, 291, 331, 379, 403, 423` | owned; both `enable` arms driven (203/224 rows, 331 rows) |
| `marketplace/info.ts` | `makeMarketplaceInfoHandler` | `info.test.ts:189, 208, 225, 245, 263` | owned |
| `marketplace/list.ts` | `makeMarketplaceListHandler` | `list.test.ts:138, 160, 183, 202, 220` | owned |
| `marketplace/remove.ts` | `makeRemoveHandler` | `remove.test.ts:242, 262, 280, 319, 340, 359, 377` | owned |
| `marketplace/update.ts` | `makeMarketplaceUpdateHandler` | `update.test.ts:282, 321, 371, 409, 441` | owned; both arity arms driven (282 = all, 321 = named) |

`usageFor` (`autoupdate.ts:20`) is module-private and reached through both arms
of the exported factory — correct, no separate case wanted.

## Branch census

Exactly **one** uncovered branch exists in the whole area.

| Module | Branch | Verdict |
| --- | --- | --- |
| `shared.ts:60` | `message === usage` true / false | both covered (`shared.test.ts:90` / `:130`) |
| `shared.ts:65` | `parsed === undefined` early return | covered (`:90`, `:130`) |
| `shared.ts:74` | `parsed.scope !== undefined` true / false | both covered (`:68` loop / `:48`) |
| `shared.ts:109` | `localFlag === undefined` early return | covered (`:261`) |
| `shared.ts:121` | `message === opts.usage` true / false | both covered (`:239`, `:305` / `:283`) |
| `shared.ts:126` | `parsed === undefined` early return | covered (`:239`, `:283`, `:305`) |
| `shared.ts:132` | `local` true / false | both covered (`:185` / `:223`) |
| `add.ts:34` | `opened === undefined` early return | covered (`add.test.ts:441, 463, 485`) |
| `add.ts:41` | `opened.scope ?? "user"` present / absent | both covered (`:331` loop / `:285`) |
| `add.ts:45` | `opened.local &&` true / false | both covered (`:362` loop / `:285`) |
| `autoupdate.ts:21` | `enable ? … : …` | both covered (`autoupdate.test.ts:203` loop) |
| `autoupdate.ts:33` | `localFlag === undefined` | covered (`:203`) |
| `autoupdate.ts:47` | `parsed === undefined` | covered (`:224`) |
| `autoupdate.ts:56` | `parsed.name !== undefined` true / false | both covered (`:272` / `:246`) |
| `autoupdate.ts:57` | `parsed.scope !== undefined` true / false | both covered (`:379` / `:246`) |
| `autoupdate.ts:58` | `localFlag.local &&` true / false | both covered (`:403` / `:246`) |
| `info.ts` | — | no branches |
| `list.ts:33` | `parsed === undefined` | covered (`list.test.ts:220`) |
| `list.ts:41` | `parsed.scope !== undefined` true / false | both covered (`:183` / `:138`) |
| `remove.ts:34` | `opened === undefined` | covered (`remove.test.ts:262, 359, 377`) |
| `remove.ts:42` | `opened.scope !== undefined` true / false | both covered (`:242` rows / `:242` first row) |
| `remove.ts:43` | `opened.local &&` true / false | both covered (`:319` rows) |
| `update.ts:41` | `message === USAGE` **true** | **unreachable by real input — production dead code** (BLOCKER above) |
| `update.ts:41` | `message === USAGE` false | covered (`update.test.ts:441`) |
| `update.ts:46` | `parsed === undefined` | covered (`:441`) |
| `update.ts:50` | `parsed.name === undefined` true / false | both covered (`:282` / `:321`) |
| `update.ts:57` | `parsed.scope !== undefined` (all arm) | both covered (`:371` loop / `:282`) |
| `update.ts:69` | `parsed.scope !== undefined` (named arm) | both covered (`:409` / `:321`) |

No branch in this area falls into category (c), compiler-forced-and-unremovable
(D-116-01a). The single uncovered branch is category (b) and is removable in one
line.

## Which side of the seam should own each case

The assignment asked this directly. Working through the six non-`shared` suites
case by case:

| Claim asserted today | Where it is asserted | Correct owner once the delegate is injected |
| --- | --- | --- |
| this handler's usage string reaches the flag scan | handler suite (unknown-flag case) | **handler suite** — the emission is the handler's own `notifyUsageError` call |
| this handler's usage string reaches the positional parse | handler suite (missing/invalid-scope cases) | **handler suite** |
| a rejected command never reaches the workflow | handler suite, via absent footprint + unstated `cwd` | **handler suite**, as a `strong-mock` with no expectation (the D-116-06 silence proof already used for `pluginUpdate`) |
| the exact options bag (`name`/`cwd`/`scope`/`local`/`rawSource`/`enable`) | inferred from on-disk effects | **handler suite**, as `when(() => run({…})).thenResolve()` + `verify` — this is the whole point of the seam |
| arity selection between `updateAllMarketplaces` and `updateMarketplace` | inferred from the fetch recorder's length | **handler suite** — which of two mocks was called |
| the rendered row grammar (`● alpha [project] <autoupdate>`, `path:` lines, `(failed) {…}`) | asserted here **and** in `tests/orchestrators/marketplace/*.test.ts` (verified: 5–20 `●` assertions per orchestrator suite) | **orchestrator suite only** — delete from the handler suites |
| the on-disk `state.json` / `claude-plugins*.json` footprint | asserted here **and** in the orchestrator suites | **orchestrator suite only** |
| the injected git port really carried the work (`clone`/`fetch` recorder) | handler suite | **orchestrator suite** — the handler only needs to assert `gitOps` is a member of the options bag it forwarded |
| which scope the command landed in | inferred through `locationsFor` on both sides (WARNING above) | **handler suite**, as the `scope` member of the asserted options bag |

So the seam moves five of the nine claims off these suites entirely and converts
two more from inference to direct assertion. `add.test.ts` and `update.test.ts`
shrink hardest — the whole `createHermeticScope` / `installNetworkCounter` /
`createGitOpsFake` apparatus becomes unnecessary in the handler tier, because
NFR-5 at the edge is then a statement about an argument, not about a socket.

## Grading of first-pass findings

### `tests/edge/handlers/marketplace/add.test.ts`

- **CONFIRMED** — *Delegation proved by running the real orchestrator* — the
  cited lines are current; `assert.deepStrictEqual(notifications, [{ message: USER_ADDED_ROW }])`
  at 300/346/377/404/433 restates a row that `tests/orchestrators/marketplace/add.test.ts`
  also asserts. Severity WARNING is right: the cases do discriminate (I confirmed
  four handler mutations they catch, below).

### `tests/edge/handlers/marketplace/autoupdate.test.ts`

- **CONFIRMED** — *Delegation proved by running the real orchestrator* — same
  shape, same severity.
- **REFUTED** — *Conditional branch inside a data-driven loop (lines 310–360)* —
  there is no conditional. The two rows differ only in the values
  `expectedProjectBase` and `expectedMessage` carry, which is exactly the
  sanctioned data-driven form ("one sibling `test()` per row via a `for` loop
  over typed rows"). The finding's own body concedes "no action needed here",
  which makes it a note filed as a WARNING — the kind of entry the brief asks
  reviewers not to emit.

### `tests/edge/handlers/marketplace/info.test.ts`

- **UNDERSTATED** — *Delegation proved by running the real orchestrator* — should
  rise to the top of this cluster, and the recorded version misses two things.
  (1) `info.ts` is a three-line factory whose entire body is one `return`; its
  suite is 285 lines that seed three marketplaces, write manifests, mutate two
  environment variables and patch `https.request`, to prove which two constants
  the factory supplies. It is the largest cost-to-promise ratio in the area and
  the cheapest seam to add (`makeMarketplaceInfoHandler(pi, getMarketplaceInfo)`,
  wired from `register.ts:95`).
  (2) Three of its five cases (`:208`, `:225`, `:245`) restate parse behaviour its
  own header (lines 6–10) says belongs to `shared.test.ts`, and a fourth
  (`:263`) is the *only* statement anywhere of a `shared.ts` contract — so this
  file duplicates `shared.test.ts` as well as `orchestrators/marketplace/info.test.ts`.
  After the seam plus the two `shared.test.ts` cases proposed above, this file
  should reduce to roughly two cases.

### `tests/edge/handlers/marketplace/list.test.ts`

- **CONFIRMED** — *Delegation proved by running the real orchestrator* — cited
  lines current; `tests/orchestrators/marketplace/list.test.ts` carries 7 `●`
  assertions over the same grammar.

### `tests/edge/handlers/marketplace/remove.test.ts`

- **CONFIRMED** — *Delegation proved by running the real orchestrator* — cited
  lines current, including the multi-line abort row at line 82.

### `tests/edge/handlers/marketplace/update.test.ts`

- **CONFIRMED** — *Delegation proved by running the real orchestrator* — and the
  first pass's carve-out is right: the fetch recorder at 307–311 / 342 / 402 is
  a genuine whole-value comparison against the complete `GitOpsFakeCalls["fetch"]`
  element shape (`{dir, remote?, ref?, auth?}`), so an unexpected credential
  bundle would fail it. Only the row literals are duplicated surface.
- **CONFIRMED** — *Conditional branch inside a data-driven loop (349–407)* — the
  `if (scope === "project")` at line 385 is a real branch in the generated body,
  and the two rows make structurally different promises (one states a
  `pluginUpdate` expectation, the other relies on its absence as a silence
  proof). Severity WARNING is right; split into two named `test()`s rather than
  widening the row shape with a fifth field.

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/{add,autoupdate,info,list,remove,update}.ts`

- **OVERSTATED** ×6 — *Orchestrator call is a hidden dependency, not an injected
  one* — real design findings, correct fix, wrong severity and wrong
  granularity. Neither skill's BLOCKER definition reaches them: the style skill
  reserves BLOCKER for violations that "can produce incorrect behavior or hide a
  defect" (assertions without reason, fall-through `case`, empty `catch`,
  non-`Error` throws, global modification) and a static import is none of those;
  the unit-testing skill's BLOCKER list covers a *test-only hook added to
  production code*, which is the opposite direction. Its own text files hidden
  dependencies as "design findings" without a severity.
  Correct severity: **WARNING**, and **one grouped finding**, not six —
  `add.ts:16`, `autoupdate.ts:13`, `info.ts:10`, `list.ts:11`, `remove.ts:16`,
  `update.ts:14–17`, one rule for all of them.
  The consequence the first pass logged separately as six test-side WARNINGs is
  the part worth prioritising, and it is worth more than its label suggests: the
  six suites hand-write roughly thirty expected row strings that
  `tests/orchestrators/marketplace/*.test.ts` also assert (verified: 5–20 `●`
  assertions in each of the six orchestrator suites), so one row-grammar change
  breaks twelve files. Fix the production side first — the change is mechanical
  and `register.ts:79–99` is already the composition module the rules want real
  adapters wired from — but book it once, as a production task, not as six
  blockers.

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts`

- **CONFIRMED** — *Uncommented `as` cast (line 131)* — the cast is genuinely
  needed (`parseCommandArgs`'s key-remapped return type does not reduce across
  `openMarketplaceCommand`'s own deferred `N`), and nothing in the function says
  so. Severity WARNING is right. Suggested comment: `// TypeScript does not
  reduce parseCommandArgs's key-remapped return type across this function's own
  deferred N, so the two generic scopes need bridging by hand.`

## Still clean after attack

- `tests/edge/handlers/marketplace/shared.test.ts` — survives every value,
  message, interaction and control-flow mutation I could construct except the
  dropped-`await` and the two coverage gaps recorded above. Specifically it
  catches: dropping `cwd`, `pi`, or `name` from the delegate options (exact-param
  mismatch → unexpected call); **adding `scope: undefined` when the flag is
  absent** — I verified strong-mock 9.2.2 resolves `concreteMatcher` to
  `deepEquals` with `strict: true` over `lodash/isEqualWith`, and
  `isEqual({a:1},{a:1,b:undefined})` is `false`, so an absent key and an explicit
  `undefined` are distinguished; calling the delegate twice (a second call has no
  matching expectation); inverting or removing either side of the MSG-NC-2
  collapse (cases at 90 and 130 pin both directions); hardcoding `local`;
  swapping `extractLocalFlag` and `parseCommandArgs` (the WB-01 placement rows at
  206 fail); and emitting anything at all on a delegating path
  (`createNotificationBoundary(0, 0, …)` states no `ctx.ui` expectation, so the
  first emission throws where it happens).
- `tests/edge/handlers/marketplace/add.test.ts` — catches: `scope: opened.scope ?? "project"`
  (footprint rows at 312–330); always-`local` (`USER_BASE_CONFIG` at 301 fails);
  hardcoding `rawSource` (the path-source case at 418 and the url cases disagree);
  deleting the `gitOps` forward (measured red on seven rows, per the file's own
  header); reading `process.cwd()` instead of `ctx.cwd` (`ctx.cwd` `times(1)`
  goes unmet and `verifyBoundary()` reports it); and an unexpected credential
  bundle on the clone (`ALPHA_CLONE` is a complete `GitOpsFakeCalls["clone"]`
  element, so a stray `auth` key fails `deepStrictEqual`).
- `tests/edge/handlers/marketplace/autoupdate.test.ts` — catches: hardcoding
  `enable` (the `declared-on-{autoupdate,noautoupdate}` rows at 310 disagree on
  both the row and the config bytes); pinning `usageFor` to one arm (the
  unknown-flag rows at 189); dropping the `name` forward (272 vs 246); dropping
  the `local` forward (`PROJECT_OVERRIDE_ONLY` at 403); and parsing before
  scanning (the `--local alpha` row at 399).
- `tests/edge/handlers/marketplace/update.test.ts` — catches: swapping the two
  arity arms; dropping either `pluginUpdate` forward (`verify(pluginUpdate)`
  reports the unmet expectation); dropping the `scope` forward on either arm — I
  traced the named arm through `resolveScopeOrNotifyNotAdded`
  (`orchestrators/marketplace/shared.ts:517–557`) and confirmed the absent-scope
  path emits a row without the `[user]` bracket, so `update.test.ts:428–434`
  discriminates it.
- `tests/edge/handlers/marketplace/remove.test.ts` — catches: dropping `scope`
  (`USER_ALPHA_GONE` at 340), dropping `local` (the CFG-03 abort rows at 299),
  and reaching the workflow on a rejection (the unstated `cwd` carries a
  pending-call proxy into `locationsFor`).

Note also what the whole tier gets right and should not be "fixed": the shared
`createNotificationBoundary` (`tests/edge/notification-boundary.ts`) is a
correctly-built strict boundary whose zero-count convention is a real silence
proof rather than a `times(0)` that proves nothing, and every case in this area
uses it consistently. `add.test.ts`'s `describeClone` UUID substitution is the
right way to compare a whole recorder containing one non-literal value.

## Not covered

- No test, coverage, lint or build command was run, per the brief. Every coverage
  and mutation claim above is from reading the source and the collaborators, plus
  two throwaway `node -e` checks against `node_modules/lodash` and
  `node_modules/strong-mock/dist/index.js` that wrote nothing.
- `tests/edge/notification-boundary.ts`, `tests/edge/handlers/marketplace-seed.ts`
  and `tests/platform/git-ops-fake.ts` were read in full to reason about this
  area but were not reviewed — they are shared support owned by other areas.
  (The first-pass file cites the boundary at `tests/edge/handlers/notification-boundary.ts`;
  its actual path is `tests/edge/notification-boundary.ts`.)
- I did not audit `tests/orchestrators/marketplace/*.test.ts` for assertion
  quality. I verified only that each of the six carries `●`-row assertions
  (5–20 per file), which is what the duplication claim needs.
- `edge/handlers/plugin/shared.ts:152` carries the same collapse expression as
  `update.ts:41`. I did not check whether its positional is required, so I make
  no claim about whether it is dead there too — worth one grep during the fix.

## Meta-findings impact

### New cross-cutting evidence

1. **A dead branch documented instead of deleted, with the measurement already
   done.** `update.ts:41` is provably unreachable, `update.test.ts:50–68` says so
   in nineteen lines citing 170 measured argument shapes and two plant
   experiments, and the code stayed. This is a *fourth* category alongside
   META's "Decisions the fixing pass cannot make" item 1 (unreachable branches
   and prototype surgery): not a branch reached by patching a global prototype,
   and not compiler-forced (D-116-01a), but simply removable in one line with two
   sibling files already showing the removed form. **No operator decision is
   needed for this shape** — it should be separated from item 1's genuinely hard
   cases before that decision is escalated. Other areas should be grepped for the
   same signature: a test-file header that argues at length why a branch cannot
   be covered. Start with `tests/edge/handlers/shared.test.ts`,
   `tests/edge/completions/{data,provider}.test.ts`,
   `tests/edge/handlers/plugin/{pending,import}.test.ts` — the other five files
   citing D-116-01a.

2. **Fixture-address circularity in scope proofs.** Five suites in this area seed
   and read their scope footprints through `locationsFor(scope, cwd)`, so the
   claim "this landed in the project scope" is measured with the function that
   chose the address. `autoupdate.test.ts:114–141` hand-authors both roots and
   says why. Any suite that proves a scope-routing claim by reading a path
   `locationsFor` computed has the same shape — worth checking across
   `tests/orchestrators/**` and `tests/bridges/**`, where scope routing is
   asserted far more often than here.

3. **Doc comments that misdescribe a module's consumers survive refactors that
   move the consumer.** `shared.ts:3–8` and `:21–24` still name `remove` as a
   consumer of `makeSingleNameMarketplaceHandler`; `remove.ts` moved to
   `openMarketplaceCommand` when `--local` support landed. This is a third
   instance of META's "doc comments cut both ways" observation, and unlike the
   two already recorded (`completion-cache.ts` honest, `routing-state.ts` false)
   this one has already propagated into a test file's variable names
   (`shared.test.ts:154–176`). Suggests the check is cheap and worth running
   repo-wide: for every doc comment naming a caller, grep for that caller.

### Corrections to META-FINDINGS.md

1. **"This is the sweep's starkest severity split: 6 BLOCKERs in
   `edge-handlers-marketplace.md`, 1 grouped WARNING in `edge-handlers-plugin.md`,
   for the identical flaw."** — The 6-versus-1 comparison is not a severity
   split; it is a granularity difference. `edge-handlers-plugin.md:49` groups
   **nine** handlers into one production WARNING, exactly as the sweep brief
   instructs ("Group repeated instances"). `edge-handlers-marketplace.md` split
   six instances of the same finding into six entries. The only genuine
   disagreement is the label on one finding: BLOCKER versus WARNING. Both files
   *also* log the test-side consequence separately (marketplace: 6 WARNINGs;
   plugin: 5 WARNINGs at lines 17–33), so the two areas agree on that half
   completely.

2. **"The marketplace reviewer's reading is the stronger one."** — I read both
   the source and both skills, and I disagree. Neither skill's BLOCKER definition
   reaches a static import; the unit-testing skill files hidden dependencies as
   "design findings" with no severity, and the style skill's BLOCKER list is a
   closed enumeration a static import is not in. The plugin reviewer's own
   assessment — "not urgent — the current tests are not weak, just heavier and
   ... duplicative" — matches what I measured: I ran the mutation catalogue over
   all six marketplace handlers and every handler-level mutation is caught. The
   correct entry is **one WARNING-severity production task, ranked high on
   leverage** (which is where META already puts it, at "Ranked by leverage" #4).
   Ranking it by leverage is right; calling it six blockers is not.

3. **"Direct per-pair coverage was never measured. ... Running the direct-coverage
   gate is a distinct, still-outstanding task."** — True as stated about the
   sweep, but it understates what the repo already has. `package.json:76` shows
   `npm run check` already chains `test:corresponding`,
   `test:corresponding:negative` and `test:coverage:direct:negative`
   (`scripts/check-corresponding-tests.mjs`, `scripts/test-coverage-direct*.mjs`),
   and `test:coverage:direct:all` exists to report every pair to
   `coverage/all-pairs.jsonl`. The outstanding task is therefore
   *running one existing script*, not building measurement — and its output would
   settle every branch-census claim in this sweep mechanically.

4. **"`tests/edge/handlers/notification-boundary.ts`"** (cited in this area's
   first-pass "Not covered") — the file is at `tests/edge/notification-boundary.ts`,
   moved there by commit `50296404`. Minor, but the fixing pass will look in the
   wrong place.

### Confirmations

1. **`tests/platform/git-ops-fake.ts`'s `structuredClone` hazard has a second
   independent workaround site.** META records `tests/orchestrators/marketplace/add.test.ts`
   carrying a strip-and-reattach workaround. `tests/edge/handlers/marketplace/add.test.ts:15–20`
   works around the same defect a *different* way, and says so explicitly: every
   fixture is forced onto `https://gitlab.example.com/...` because "a github
   source resolves the GitHub provider and attaches a credential bundle whose
   functions make the fake's `structuredClone` recorder throw." Two suites now
   shape their fixtures around one fake's bug. Raises confidence and raises
   priority: fixing the fake once removes a constraint on what both suites can
   test (neither can currently drive a github source at all).

2. **`tests/edge/handlers/marketplace-seed.ts`'s double cast is load-bearing
   here.** META records it as stripping structural type checking from fixtures 15
   test files depend on. Five of this area's seven suites (`autoupdate`, `info`,
   `list`, `remove`, `update`) route every fixture through
   `mergeMarketplaceIntoState`, whose `as unknown as Parameters<typeof saveState>[1]`
   at line 95 means a change to the persisted marketplace-record shape is not a
   compile error in any of them. Since those five suites' entire delegation proof
   is "the orchestrator consumed this fixture and produced that effect", the cast
   sits directly under the load path, not off to the side.

3. **The "gate wants a planted violation" principle holds in this area, and the
   tier applies it well.** `add.test.ts:28–38` and `update.test.ts:129–153` both
   record having *measured* whether their NFR-5 zero can rise — add's can (seven
   rows go red with the `gitOps` forward deleted), update's cannot (the refresh
   dies inside `isomorphic-git` before the transport) — and each says which it
   is. That is the strongest form of the principle I have seen in this sweep: a
   gate that documents its own positive control, including when it has none.
   Worth adding to META's "Patterns to propagate" table as the reference for
   *offline / no-network* proofs, alongside `tests/orchestrators/plugin/fetch.test.ts`'s
   allow-listed git fake.
