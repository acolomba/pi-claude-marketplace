# Closure Ledger

Every item the `refine-unit-tests` milestone's closure phase closed, the disposition
it carries now, and either a command run this cycle with its output or a
file-and-line citation a reader can follow.

The evidence column exists for the same reason `07-FINDING-DISPOSITIONS.md` has one.
A row that says an item is closed and cannot show it is not a record — it is a hope.
Three of the items below were settled by earlier phases, and recording "closed"
without a current citation is exactly the kind of claim this milestone spent nine
phases retiring.

The disposition vocabulary is a closed set of five words: `implemented`,
`evidence-only`, `superseded`, `deferred`, `unresolved`. Nothing outside it appears
in the `Disposition` column. `.planning/BACKLOG.md` and the pending todo file use the
same five words for the same items, which is what keeps the two records from drifting
apart.

One boundary, stated once and binding on every row below: **a complete coverage
reading is reachability evidence only — it says every arm ran under the owner test,
and it says nothing about whether that test asserted anything worth asserting.** No
row in this document uses a coverage reading to claim an assertion is strong.

Commands are run from the repository root. Output is quoted verbatim. Phase and plan
numbers appear in the `Carried by` column because this is a planning artifact; they
remain barred from source comments.

## Closed items

| Item | Kind | Disposition | Carried by | Evidence |
| --- | --- | --- | --- | --- |
| `GGAT-01` | requirement | implemented | seal change A, `da08a749` (plan 09-03) | `node scripts/revalidation.mjs scope-impact --check` → `Scope impact valid: 40 records.`, exit 0. Pinned, not unfinished: `.planning/phases/07-gate-integrity/07-VERIFICATION.md:142` reads `SATISFIED` in a report whose frontmatter is `status: passed`, 7/7. Control suite `node --test tests/architecture/revalidation.test.ts` → `pass 136 / fail 0`. |
| `GGAT-03` | requirement | implemented | seal change A, `da08a749` (plan 09-03) | Same `scope-impact --check` output. `07-VERIFICATION.md:143` `SATISFIED`, with `node --test tests/architecture/eslint-effective-config.test.ts` → 5/5 recorded there as a live re-run. |
| `GGAT-04` | requirement | implemented | seal change A, `da08a749` (plan 09-03) | Same `scope-impact --check` output. `07-VERIFICATION.md:144` `SATISFIED`, with `node --test tests/architecture/no-test-only-production-surface.test.ts` → 10/10 recorded there as a live re-run. |
| `RCOV-01` | requirement | implemented | seal change A, `da08a749` (plan 09-03) | Same `scope-impact --check` output. `09-02-SUMMARY.md` records `All-pair report written: 230 rows in 482.5s on v26.8.2 to coverage/all-pairs-report.ndjson` and `wc -l coverage/all-pairs-report.ndjson` → `230`, re-measured on the tree carrying the injected hooks read port. |
| `RCOV-02` | requirement | implemented | seal change A, `da08a749` (plan 09-03) | Same `scope-impact --check` output. The five reclassified modules read complete and the two retained shortfalls carry per-site reasons in `scripts/test-coverage-direct.pin.json`, regenerated in 09-02 from the fresh report's own `accepted-shortfall` enumeration and proved byte-identical (`git diff --exit-code scripts/test-coverage-direct.pin.json` → exit 0). |
| `RCOV-03` | requirement | implemented | seal change A, `da08a749` (plan 09-03) | Same `scope-impact --check` output. The gate is wired in both places: `.pre-commit-config.yaml:144-149` (local hook `npm-coverage-direct`) and `.github/workflows/ci.yml:140-206` (the `direct-coverage` job, `fetch-depth: 0`). The CI half's first real execution is still unproven — see the `direct-coverage` caveat row below. |
| `CLOSE-01` | requirement | implemented | seal change B, `d391d058` (plan 09-03) | The final-tree measurement in this plan, quoted verbatim below: `npm run check` exit 0 in 246s and `npm run test:coverage:direct:all` exit 0 over 230 pairs, both at `d83a6dc3`. |
| `CLOSE-02` | requirement | implemented | seal change B, `d391d058` (plan 09-03) | This document plus the eight terminal dispositions written in place by plan 09-05: `grep -n 'Disposition' .planning/BACKLOG.md` → lines 27, 101, 489, 637, 1779, 1936, 2547, and `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md:12`. |
| `TESTQ-01` | backlog | implemented | the milestone this item was cut from | `.planning/BACKLOG.md:2544` — closed in the house struck-through form, with a five-row table mapping the item's own numbered workstreams onto `PDEF-01..08` + `AUTH-01`, `RVAL-03`, `TREF-01..09`, the `GGAT` family, and `RCOV-03`. The entry states in a sentence that the route is assembled from clause text, not stated by a record. |
| `FLOW-09` | backlog | implemented | `TREF-05`, `TREF-06`, with `GGAT-04` holding the surface at zero | `.planning/BACKLOG.md:635` — quotes the three clause fragments that make the match and says explicitly that the route is derived from clause text rather than from a record naming `FLOW-09` against an ID. Its `NOT closed by the same change:` paragraph keeps the ~94 ordinary internal helpers visibly open. |
| `REASON-01` | backlog | implemented | `PDEF-03`, `PDEF-05` — terminal route only | `.planning/BACKLOG.md:25` — carries the verbatim `grep -n 'malformed' extensions/pi-claude-marketplace/shared/notification-types.ts` output (`44: "malformed mcp"`, `45: "malformed skill"`, `46: "malformed command"`) plus a `NOT closed by the same change:` paragraph naming both residual cases. Split disposition below. |
| `FLOW-07` | backlog | implemented | `GGAT-03`, whose clause names this item by ID | `.planning/BACKLOG.md:487`; `.planning/REQUIREMENTS.md` `GGAT-03` reads "`FLOW-07` varies effective config sources and broad overrides across the terminal ESLint/Fallow boundary gaps and proves target visitation"; `07-VERIFICATION.md:143` `SATISFIED`. This is the one route of the four that rests on a record rather than on inference. |
| `COV-01` | backlog | superseded | `RCOV-01`'s complete all-pair baseline, recorded as `RCOV-04` | `.planning/BACKLOG.md:99`; `.planning/REQUIREMENTS.md` §"Evidence and History" carries the same wording. Both named orchestrators are inside the 230-pair baseline and neither appears in `scripts/test-coverage-direct.pin.json`. No `sonar.coverage.exclusions` entry was added for either. |
| `AGCOL-01` | backlog | evidence-only | nothing — recorded as `GGAT-02`, formerly Phase 7 | `.planning/BACKLOG.md:1934`; `.planning/REQUIREMENTS.md` §"Evidence and History". `assertNoAgentCollisions` (`bridges/agents/convert.ts:605`) and its call site (`bridges/agents/stage.ts:133`) are both still in place; nothing in this milestone touched them. The entry says "It is not implemented." |
| `GAUTH-01` | backlog | deferred | nothing — routed forward, barred by `D-22` | `.planning/BACKLOG.md:1777`. Measured: `NO_PROVIDER_CAUSE(host)` is wired into exactly one of five auth-relevant call sites, `orchestrators/marketplace/update.ts:394`. Split disposition below. |
| unused-type-member todo | todo | deferred | nothing — deferred to v1.19 | `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md:12`. Its 2026-09-02 measurement stands: `npm run typecheck`, `npm run lint` and `npm run fallow` all exit 0 on a planted `readonly neverReadAnywhere?: string` member. It creates no implementation work in this milestone. |
| window entry 9 | window | unresolved | nothing — deliberately retained | `.planning/WINDOWS.md` JSON entry 9: `status: open`, `resolved_at: null`. Plan 09-04 edited its description only. Its own repaired text ends "This entry stays `open` deliberately, as the durable record of the residual risk rather than as a pending action. Resolution recorded in 115-VERIFICATION.md human_verification item 2." |
| window entry 19 | window | implemented | the production rewrite `RCOV-02` records; closed through `windows fixed 19` | `.planning/WINDOWS.md` JSON entry 19: `status: fixed`, `resolved_at: 2026-09-11T21:38:24.643Z`. Terminal evidence read from the source, not from the requirement prose: `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` now reads `const [first] = parsed.positional; if (first !== undefined)` with no nullish fallback. |
| window entry 21 | window | implemented | the production rewrite `RCOV-02` records; closed through `windows fixed 21` | `.planning/WINDOWS.md` JSON entry 21: `status: fixed`, `resolved_at: 2026-09-11T21:38:24.999Z`. `extensions/pi-claude-marketplace/edge/args.ts` now reads `for (const [index, token] of tokens.entries())`; no index-read guard survives at 34-37. |
| window entry 22 | window | implemented | the production rewrite `RCOV-02` records; closed through `windows fixed 22` | `.planning/WINDOWS.md` JSON entry 22: `status: fixed`, `resolved_at: 2026-09-11T21:38:25.338Z`. `extensions/pi-claude-marketplace/edge/handlers/shared.ts` now reads `for (const tok of tokens)`; no flag-scanner index guard survives at 53-55. |
| window entry 30 | window | implemented | one half fixed outright, one half accepted as superseded | `.planning/WINDOWS.md` JSON entry 30: `status: fixed`, `resolved_at: null`. The reproducibility half closed by `npm run test:coverage:direct:report` (commit `1495488b`); the accepted-shortfall-list half is barred in terms by `D-117-20` and was accepted as superseded on `117-VERIFICATION.md`. Split disposition below, including why `resolved_at` cannot be populated. |
| `discover.ts` pin claim, `288-290` | caveat | evidence-only | traced in this plan against the current source | `extensions/pi-claude-marketplace/bridges/commands/discover.ts:222,226,286,288`; `extensions/pi-claude-marketplace/shared/errors-bridges.ts:112-122`; `grep -rn "nameCommandInDir" extensions/ tests/ scripts/` returns only `discover.ts:222`, `discover.ts:287` and the pin's own text. Argument and residual below. |
| `install-outcome.ts` pin claims, `422-426` and `818-820` | caveat | evidence-only | traced in this plan against the current source | `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:413-426,811-820`; `domain/manifest.ts:28,40,70,79`; `domain/components/plugin.ts:89`; `domain/manifest-cache.ts:15-20`; `domain/components/hooks.ts:241-284`; `domain/hooks-resolution.ts:30,36,40,49`. Arguments and residuals below. |
| the `direct-coverage` CI job | caveat | unresolved | nothing — it has never executed | `.github/workflows/ci.yml:140-206` defines the job; `08-VERIFICATION.md:171` records that it had not executed on a real PR, push or tag event, and nothing since has changed that. What is unproven, and what would close it, is stated below. |

## `REASON-01` — a split disposition

The verdict is `implemented` for the terminal route only, and the item asked for more
than the terminal route.

What shipped: the `{malformed <feature>}` reason family exists and is closed-set —
`"malformed mcp"`, `"malformed skill"`, `"malformed command"` in
`extensions/pi-claude-marketplace/shared/notification-types.ts:44-46` — and each is
reached by a typed classification rather than by a message-substring test, which is
what `PDEF-03` and `PDEF-05` carried.

What did not ship: neither of the two cases the item named by hand was rerouted.

- Inline malformed `mcpServers` still reaches `{unsupported source}`. The note is
  emitted as `malformed mcpServers[: detail]` (`domain/mcp-resolution.ts:34,36`), and
  `classifyResolverNote` matches the full `malformed mcp reference` prefix
  deliberately — its own comment records that a bare `malformed mcp` match would also
  catch the inline note and silently reroute it.
- Malformed `hooks.json` still reaches `{unsupported hooks}`. The note is emitted as
  `malformed hooks.json: <reason>` (`domain/hooks-resolution.ts:42`) and matches
  `classifyResolverNote`'s `isHooksNote` arm. There is no `malformed hooks` member in
  the closed set for it to reach.

The `narrowResolverNotes` re-audit the item asked for was not performed. The one word
in the table would mislead without this section, which is why the section exists.

## `GAUTH-01` — a split disposition

The verdict is `deferred`, and it is the named prescription that is deferred, not the
whole family.

What exists, measured: the host-named diagnostic `NO_PROVIDER_CAUSE(host)`
(`orchestrators/auth-host.ts`) is host-generic and is wired into exactly one of five
auth-relevant call sites — `marketplace update`'s url-source refresh path
(`orchestrators/marketplace/update.ts:394`).

What the prescription asks for and did not get: the same cause line at the other four
call sites — `plugin install`, `plugin reinstall`, `plugin fetch` and
`marketplace add` — each of which still surfaces only the bare, host-less
`authentication required` token on a no-provider host.

It is not implemented, and it is not an open defect inside this milestone's boundary
either: it is a product change with no terminal finding inside the unit-test-quality
boundary, which is why `D-22` bars it from creating work here. Its sibling `GAUTH-02`
shipped separately, so the family is not an open pair.

## Window entry 30 — a split disposition, and an acceptance criterion left unsatisfied

The entry recorded two defects and they closed differently. The reproducibility half
was fixed outright by `npm run test:coverage:direct:report` (commit `1495488b`), which
regenerates every row from the gate's own enumeration and blocks nothing. The
reviewer's remedy for the other half — teach the script an accepted-shortfall list —
is barred in terms by `D-117-20` ("not by a ledger-keyed verdict (which would be
D-116-01a's banned pragma wearing a different hat)"), and that half was accepted as
superseded through an overrides entry on `117-VERIFICATION.md`. The entry reads
`fixed` because the fixable half was fixed and the other half has a recorded
acceptance, not because both halves were resolved the same way.

**Its `resolved_at` is `null` and cannot be populated.** `resolved_at` is a rendered
table column, and the ledger's drift guard compares the rendered table against the
fenced JSON byte-for-byte. Entry 30's table cell is empty, so writing a timestamp into
the JSON re-creates the exact drift plan 09-04's repair existed to clear — measured
both ways against a scratch copy: populated → exit 1 naming row 30; null → exit 0.
`markFixed` calls `assertOpen`, so re-closing the entry through the verb is not a
route either. Plan 09-04 left that acceptance criterion **unsatisfied and documented**
rather than satisfied in appearance. The closure date survives in prose: the entry's
description opens its final paragraph with `RESOLVED 2026-09-04 by operator decision:`.

## The `discover.ts` pin claim — the argument, and what it does not cover

The pin's reason for `288-290` says the `if (!(err instanceof CommandNameError)) { throw err; }`
arm is unreachable, and that the check still narrows the `unknown` catch binding, so
deleting it without a restructure breaks typing. Traced against the current source in
this plan rather than inherited:

- `nameCommandInDir` is **module-private**.
  `grep -rn "nameCommandInDir" extensions/ tests/ scripts/` returns exactly two source
  lines — the declaration at `discover.ts:222` and the call at `discover.ts:286` —
  plus the pin's own prose. No test and no sibling module reaches it.
- Its entire body is a `try`/`catch` whose catch clause unconditionally executes
  `throw new CommandNameError(sourceName, base, { cause: err })` (`discover.ts:226`).
  The only value the function can throw is a `CommandNameError`.
- The one remaining escape is the constructor throwing before the instance exists.
  `CommandNameError` (`shared/errors-bridges.ts:112-122`) performs a template-literal
  `super(...)` over two `string` parameters and three field assignments. Nothing there
  can throw for any input.

**Conclusion: no input reaches the arm.** Only a `Symbol.hasInstance` patch on the
class — which `TREF-08` forbids planting — or a cross-realm boundary would make
`instanceof` false for a genuine instance. The pin's reason is correct as written.

**Why it cannot simply be deleted.** The `if` is what narrows `err: unknown` to
`CommandNameError` for `badNameWarning(err: CommandNameError)` at `discover.ts:101`.
Neither a non-null assertion nor an `as` cast is available under this repository's
lint rules, so removing the arm requires restructuring the call site, not deleting
three lines.

**The residual.** This row is `evidence-only` and not `implemented` on purpose. The
argument is a reading, and a reading is what the standing caveat from `08-04` says a
`reasons` entry can only ever be checked by. Nothing in this repository can gate it;
if the class ever stops being the sole throw, or the helper stops being module-private,
the reason silently becomes false and no test goes red.

## The `install-outcome.ts` pin claims — two arguments, two residuals

### `422-426`, the manifest-entry re-check

The value under re-validation was traced back to the parse that produced it:

```
install-outcome.ts:413   loadCachedMarketplaceManifest(sourceMp.manifestPath)
install-outcome.ts:300   → loadMarketplaceManifest(manifestPath)      [domain/manifest.ts]
domain/manifest.ts:70        MARKETPLACE_VALIDATOR.Check(parsed)  — before the return at :79
domain/manifest.ts:40        MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA)
domain/manifest.ts:28        MARKETPLACE_SCHEMA.plugins = Type.Array(PLUGIN_ENTRY_SCHEMA)

install-outcome.ts:414   entryRaw = manifest.plugins.find(...)
install-outcome.ts:422   if (!PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)) { throw … }   ← the arm
domain/components/plugin.ts:89  PLUGIN_ENTRY_VALIDATOR = Compile(PLUGIN_ENTRY_SCHEMA)
```

The schema that accepted the array element and the schema the re-check applies are the
same `PLUGIN_ENTRY_SCHEMA` object, compiled twice. `entryRaw` is an element of an array
that schema already validated, in this process, from this parse. **The arm is
unreachable for any input.**

**The residual the pin's own text does not name.** `domain/manifest-cache.ts:15-20`
records decision D-03: cache hits return the loaded value **by reference**, and the
header states "The seam preserves the raw `JSON.parse` value, so callers MUST treat the
result as READ-ONLY." A caller that violated that contract and mutated a cached entry
between the validated load and this re-check would make the arm fire. That is a program
defect rather than an input, so the reachability claim stands as written — but it is
the precise shape of the thing the re-check is defense-in-depth against, and naming it
makes the pin a better record than its current text.

### `818-820`, the hooks re-parse guard

The pin says the only difference between the two `parseHooksConfig` calls is
`skipIfMap`, and that `D-61-02` keeps an `if`-field issue from producing a refusal.
Read against `domain/components/hooks.ts`, the argument is **stronger** than that:

- `domain/components/hooks.ts:243-247` — `JSON.parse` throws → `return { ok: false, … }`
- `domain/components/hooks.ts:257-261` — `!HOOKS_VALIDATOR.Check(candidate)` → `return { ok: false, … }`
- `domain/components/hooks.ts:282` — `options.skipIfMap` is consulted only on the
  success path, selecting an empty `Map` versus `buildIfPredicateMap(...)`.

Both `{ok:false}` returns occur **before** `skipIfMap` is read at all, so the option is
structurally incapable of changing the ok-or-not verdict for identical bytes. That
holds regardless of what `compileIf` does, which is a stronger claim than the pin's own
`D-61-02` argument.

**But the two calls read the file twice.** The resolver reads
`path.join(pluginRoot, "hooks", "hooks.json")` through its injected `readFileText`
(`domain/hooks-resolution.ts:30,36`); the ledger phase reads
`path.join(c.resolved.pluginRoot, c.resolved.hooksConfigPath)`
(`install-outcome.ts:811-814`), where `hooksConfigPath` is
`path.join("hooks", "hooks.json")` (`domain/hooks-resolution.ts:49`). Same path, two
separate reads at two different times.

**Conclusion: the arm is not input-reachable, but it is reachable by a filesystem
mutation between the two reads.** That is a genuine window inside the install, not a
phantom, and it is exactly what the guard is for. It is recorded here as such rather
than softened into "unreachable". No unit test can produce it deterministically without
patching `readFile`, which `TREF-08` bars — which is why this row is `evidence-only`.

## The `direct-coverage` CI job — the one thing this repository cannot settle

The job is defined at `.github/workflows/ci.yml:140-206` and **has never executed**.
`08-VERIFICATION.md:171` recorded that, and nothing since has changed it. Its first
real run is on the pull request that carries this milestone.

**What the local proxy does prove.** The gate the job invokes runs here, in full:
`npm run test:coverage:direct:all` exits 0 over all 230 pairs (quoted below);
`npm run test:coverage:direct:negative` exits 0 and names each planted fixture state it
refused; `selectBase()` walks its ordered candidate chain and prints the candidate it
chose; and `.pre-commit-config.yaml:144-149` runs the commit-scoped arm of the same
script. The gate's own logic, its fail-closed base selection and its pin comparator are
all exercised.

**What it cannot prove.** Whether `actions/checkout` at `fetch-depth: 0` creates
`refs/remotes/origin/main` on a `pull_request` event cannot be determined outside
GitHub Actions. That is precisely what the job's two `pull_request`-scoped assertion
steps exist to catch — `git rev-parse --verify origin/main^{commit}` and
`grep -qx 'Changed-pair base: origin/main' coverage-direct.log`. If the assumption is
wrong, the gate would otherwise fall through to `HEAD~1` and diff a single commit while
still reporting a resolved base. No local run can exercise that path, because the
condition being asserted is a property of GitHub's checkout on GitHub's event.

**A second thing lives outside every tracked file.** Whether `direct-coverage` is a
*required* status check is a protected-branch setting in the repository's GitHub
configuration. No file in this tree records it, so no gate here can assert it. The
`package` job's `needs: [check, integration-tests, e2e-tests, direct-coverage]` makes
the dependency real inside the workflow, which is not the same claim.

**What would close this row:** the job's first real run on a pull request, green, with
both assertion steps passing — and, separately, a look at the branch-protection
settings. Until then it is `unresolved`. It is not folded into a passing claim, and it
is not described as low risk.

## Window entry 9, and what stays open

Entry 9 is `unresolved` rather than `deferred`, and the difference is deliberate. A
`deferred` item is a pending action someone will take later. Entry 9's own repaired
text says the opposite: it "stays `open` deliberately, as the durable record of the
residual risk rather than as a pending action," with the operator's acceptance recorded
in `115-VERIFICATION.md` human_verification item 2. It is retained, not scheduled.

Nothing beyond entries 19, 21, 22 and the entry 30 desync repair was closed. Nineteen
entries remain open, distributed across phases as
`{86: 1, 88: 2, 115: 6, 116: 5, 117: 5}`. Phase **115** is the largest remaining group
at 6, with phases **116** and **117** tied behind it at 5 each — `09-04-SUMMARY.md`
calls phase 116 "still the largest group at 5", which is off by one group; the count of
5 for phase 116 is right and the superlative is not. Closing any of the nineteen on
narrative rather than terminal evidence is the defect class this milestone exists to
retire, and `D-22` bars it. Whether open windows should block `/gsd-ship` is the
operator's call at ship time.

## Process notes

Three commits in this phase carry phase-scoped commit scopes — `f0fa6adb` and
`3ef41e24` as `fix(09-04)`, `d7a7fe39` as `docs(09-04)` — against `CLAUDE.md`'s
instruction to avoid milestone and phase mentions in commit messages. The history
stands; this repository does not rewrite it. Every later commit in the phase uses a
semantic scope (`docs(backlog)`, `docs(requirements)`, `docs(closure)`).

`FLOW-07`'s backlog entry contains the word `implemented` twice. One is its verdict;
the other is the phrase "independently implemented gates" inside the entry's own
original text, preserved verbatim under `Original report follows.`. A verbatim-
preservation requirement and an exactly-one-occurrence grep cannot both hold when the
original text already contains the word. Preservation won.

## The final-tree measurement

Both commands were run from the repository root on commit
`d83a6dc32101aa89d828a029e2fbbc5ecf857a04` (`d83a6dc3`, "docs(backlog): close out the
terminal-disposition plan") on 2026-09-11. Neither figure is carried over from plan
09-02 or plan 09-03; those runs measured earlier trees and are correct statements
about those trees. This is the run `CLOSE-01` asserts over.

### `npm run check`

Exit status **0**. Wall clock **246s** (2026-09-11T21:54:31Z → 21:58:37Z).

```
> pi-claude-marketplace@0.18.1 check
> npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:negative && npm test && npm run test:integration
```

Unit suite (`npm test`):

```
ℹ tests 6007
ℹ suites 301
ℹ pass 6007
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 33591.414515
```

Integration suite (`npm run test:integration`):

```
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10475.317775
```

The intermediate gates in the chain, verbatim:

```
✓ No issues found (0.63s)
✗ 0 above threshold · 13016 analyzed · maintainability 91.8 (good) (0.23s)
✗ 915 lines (1.1%) duplicated across 38 files (0.19s)
Checking formatting...
All matched files use Prettier code style!
Corresponding-test gate passed.
Corresponding-test negative controls passed.
Direct-coverage negative controls passed.
1 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.
```

The two `✗` lines are fallow's informational `health` and `dupes` counts; both are
inside their configured thresholds and neither fails the run, which is why the chain
continued through them to the tests.

### `npm run test:coverage:direct:all`

Exit status **0**. Wall clock **480s** (2026-09-11T21:58:46Z → 22:06:46Z).

```
> pi-claude-marketplace@0.18.1 test:coverage:direct:all
> mkdir -p coverage && node scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl
```

Final two lines, verbatim:

```
2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.
All-pair run complete: 230 pairs in 480.1s (480121ms) on v26.8.2
```

`wc -l coverage/all-pairs.jsonl` → `230`, the gate's own per-pair record.

### What lands after the measurement

Only planning documents that no test reads: this ledger, the plan summary beside it,
and whatever the phase-close step writes to `.planning/STATE.md` and
`.planning/ROADMAP.md`. Nothing under `extensions/`, `tests/`, `scripts/`,
`package.json`, `eslint.config.js` or `.fallowrc.json` changes after the two runs
above. `node scripts/revalidation.mjs scope-impact --check` was re-run after this
ledger was committed and still prints `Scope impact valid: 40 records.`

### A note on the clean-tree precondition

`git status --porcelain` is not empty in this checkout and cannot be made empty by
this plan. It carries sixteen entries of pre-existing, session-external residue — the
operator's `.claude/settings.json`, `.codex/config.toml`, `.claude/CLAUDE.md`,
`.mcp.json`, `AGENTS.md`, an untracked `.codegraph/` index, and ten untracked review
documents under `.planning/phases/01-…` and `.planning/phases/08-…`. None of them is
under `extensions/`, `tests/`, `scripts/`, or any config file in the `npm run check`
chain, so none is on the surface either measurement reads. Plan 09-03 read the same
precondition the same way and recorded the same reason. The criterion is reported as
**unsatisfied and documented** rather than satisfied in appearance.
