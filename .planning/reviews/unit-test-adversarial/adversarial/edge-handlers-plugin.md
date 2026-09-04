# Edge — plugin handlers — adversarial re-review

**Scope:** all 12 modules under `extensions/pi-claude-marketplace/edge/handlers/plugin/` and all 12 paired suites under `tests/edge/handlers/plugin/` (7,231 test lines, 1,125 production lines), plus the two shared fixtures the first pass declared out of scope (`tests/edge/notification-boundary.ts`, `tests/edge/handlers/marketplace-seed.ts`) and the one cross-area consumer of a production export in this tier (`tests/architecture/flag-catalog-drift.test.ts`).
**First-pass file:** `unit-test-findings/edge-handlers-plugin.md`
**Clean files attacked:** 8 listed (7 test + `bootstrap.ts`), plus the blanket "no findings in any of the 12 production modules" claim, plus the 2 unscored shared fixtures — 22 files probed in total.
**Existing findings graded:** 8

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 7 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

**Headline:** the first pass's "0 BLOCKER" verdict does not survive, but not because the
tests are weak — they are the strongest suites I have read in this sweep. It fails on two
counts the first pass never checked: the **export surface** of the production modules (two
exports exist only to be reached by a test, one of them feeding a gate that is
mathematically incapable of failing), and the **severity of the injection-seam gap**, which
this area logged as one grouped WARNING while the identical defect is 6 BLOCKERs next door.
Every mechanical check the first pass claimed is genuinely clean: zero `assert.ok`, zero
substring assertions, zero `any`/casts/`@ts-expect-error`, zero `only`/`skip`/`todo`, zero
process-wide `mock`, zero `t.mock.module`, zero `It.isAny()`/`anyTimes()`/`verifyAll()`,
zero `before`/`beforeEach`, and complete `// arrange` / `// act` / `// assert` discipline in
all 121 cases (verified by grep across all 12 files).

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts`

- **[BLOCKER] `BOOLEAN_FLAGS` is a production export that exists only for a test, and the test it feeds cannot fail** — `list.ts:81–82`

  The export carries the comment `// Export for potential reuse by completions provider.`
  There is no such consumer: `grep -rn BOOLEAN_FLAGS extensions/ tests/` returns exactly one
  importer, `tests/architecture/flag-catalog-drift.test.ts:48`. The doc comment names a
  consumer that does not exist — the "doc comments that lie" class.

  Worse, the gate it serves is a tautology. `list.ts:30` is
  `const BOOLEAN_FLAGS = parseFlagNames("list")`. The gate at
  `flag-catalog-drift.test.ts:103–114` asserts
  `sorted(BOOLEAN_FLAGS)` equals `sorted(parseFlagNames("list") minus "--local")`, and the
  test's own comment at line 104–105 states the catalog's list entry carries no `--local`,
  so the `delete` is a no-op. **Both sides of the assertion are the same expression.** No
  mutation of `flag-catalog.ts` and no mutation of `list.ts` can turn it red. Its stated
  purpose — pinning the catalog's list parse-set — is already discharged independently by
  the hand-written pin at `flag-catalog-drift.test.ts:130`
  (`list: ["--available", "--installed", "--partial", "--remote", "--unavailable"]`).

  **Sibling that does it right:** `info.ts:22` keeps `ACCEPTED_FLAGS = parseFlagNames("info")`
  module-private, and `flag-catalog-drift.test.ts:121` reaches the catalog directly instead
  of through the handler. `install.ts:38` and `update.ts:30` keep `PASS_THROUGH_FLAGS`
  private the same way. `list.ts` is the only one of the four that widened its surface.

  **Fix:** delete `list.ts:81–82` (the comment and the `export { BOOLEAN_FLAGS }`), delete
  the import at `flag-catalog-drift.test.ts:48`, and delete the whole
  `test("catalog vs handler: list BOOLEAN_FLAGS equals catalog list parse-set …")` at
  `flag-catalog-drift.test.ts:103–114`. Coverage of the catalog's list set is unaffected —
  line 130 already owns it.

### `extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts`

- **[BLOCKER] `parseFetchTarget` and `ParsedFetchTarget` are exported only so the paired test can reach them, and the resulting duplicate contract is proved twice** — `fetch.ts:32`, `fetch.ts:43`

  `grep -rn parseFetchTarget extensions/ tests/` shows two consumers: `fetch.ts:119` (its own
  module) and `tests/edge/handlers/plugin/fetch.test.ts`. No production module outside
  `fetch.ts` imports either symbol. The test file's own header (line 3–8) records the
  consequence rather than the cause: *"This is the only plugin shim that EXPORTS its parser,
  so the module carries two public contracts rather than one."*

  **Sibling that does it right:** `reinstall.ts:79` declares `function parseTarget(ref, ctx)`
  — the same three-form positional-to-target mapper, over the same `@`-prefix rules,
  returning the same discriminated union — and does **not** export it.
  `reinstall.test.ts` drives all three forms and all three rejections through
  `makeReinstallHandler` alone. `update.ts:55–75` inlines the identical logic.

  The cost is not theoretical. `describe("parseFetchTarget")` (`fetch.test.ts:174–334`,
  13 cases) and `describe("makeFetchHandler")` (`fetch.test.ts:336–433`, 6 cases) prove
  overlapping facts at two levels: `""`, `@<mkt>`, `<plugin>@<mkt>`, `--scope user`,
  `--scope project` and `--bogus` each appear on both sides. It is also why this file needs
  `describe()` at all — every sibling with one entrypoint uses none.

  **Fix:** drop `export` from `fetch.ts:32` and `fetch.ts:43`. Move the eight
  `parseFetchTarget` cases that have no handler-level twin (`no-at-sign`, `@`, `foo@`,
  `a@mp b@mp`, `a@mp b@mp c@mp`, `--scope user --local`, `a@mp --bogus`,
  `hello@mymkt --scope bogus`) up to `makeFetchHandler` as rejection cases — each is fully
  observable there as the boundary sized `(1, 0)` with no stated `cwd` plus the same
  hand-written notification list, exactly as `reinstall.test.ts:695–721` does for the same
  three malformed-reference shapes. Delete the remaining six as redundant with the handler
  block, and delete both `describe()` wrappers.

### `extensions/pi-claude-marketplace/edge/handlers/plugin/{list,install,update,reinstall,fetch,info,pending}.ts`

- **[WARNING] The long-flag classification boundary is untested at exactly one character** — `list.ts:52`, `shared.ts:75`, `reinstall.ts:50`, `fetch.ts:59`, `info.ts:43`, `pending.ts:40` (6 sites, 7 handlers)

  Every one reads `token.startsWith("--")` to separate an unknown long flag from a
  positional. `parseArgs` (`edge/args.ts:49–51`) pushes any non-`--scope` token onto
  `positional` verbatim, so a single-dash token reaches these loops. Mutating
  `startsWith("--")` to `startsWith("-")` at **any** of the six sites leaves all 121 cases in
  the tier green: no case in any file drives a `-x`-shaped token. Today
  `/claude:plugin list -x` calls `listPlugins({ marketplace: "-x" })` and
  `/claude:plugin pending -x` emits `Too many arguments.`; under the mutation both emit
  `Unknown option: "-x"`. Nothing pins which is intended.

  **Fix:** add one row per handler driving a single-dash token, asserting the behavior that
  is actually intended. For `list.test.ts` add `{ args: "-x", … }` to the
  narrowing family at line 450 with an expected block set proving it was taken as a
  marketplace positional; for `pending.test.ts` add `{ args: "-x", label: "single-dash" }`
  to the too-many-arguments family at line 358; mirror in `install`, `update`, `reinstall`,
  `fetch` and `info` in whichever family the measured behavior lands.

### `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts`

- **[WARNING] The handler takes the whole `EdgeDeps` and reads one member of it** — `bootstrap.ts:37` (`deps: EdgeDeps`), read at `bootstrap.ts:67` only

  `EdgeDeps` (`edge/types.ts:23`) declares `gitOps`, `pluginUpdate` and
  `importClaudeSettings`. `bootstrap.ts` reads `deps.gitOps` and nothing else — the module's
  only other mention of `pluginUpdate` is absent entirely. This is META-FINDINGS item 1
  (over-wide context parameters) in the handler tier, and it has a measurable test cost: all
  nine cases in `bootstrap.test.ts` construct
  `mock<PluginUpdate>({ exactParams: true, name: "plugin update" })` and call
  `verify(pluginUpdate)` purely to satisfy the parameter type (lines 277, 299, 320, 350,
  378, 401 and their `verify` partners).

  **Sibling that does it right, in the same directory:** `import.ts:14` declares its own
  narrow consumer-side port `ImportHandlerDeps { gitOps, importClaudeSettings? }`, and
  `register.ts:91` still passes the full `EdgeDeps` at the call site — the widening is
  absorbed by structural typing, not by the parameter declaration.

  **Fix:** change `bootstrap.ts:37` to
  `deps: Pick<EdgeDeps, "gitOps">` (or declare a `BootstrapHandlerDeps` interface beside
  `ImportHandlerDeps`). `register.ts:80` continues to compile unchanged. Then delete the nine
  `pluginUpdate` mock constructions and their `verify()` calls from `bootstrap.test.ts` —
  the "does not touch that port" proof becomes structural rather than behavioral, which is
  strictly stronger.

### `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts`

- **[WARNING] Inlines `errorMessage()` instead of importing it, which is the sole source of this pair's documented uncovered branch** — `import.ts:31`

  `import.ts:31` reads `err instanceof Error ? err.message : String(err)`. That expression is
  byte-identical to the body of `errorMessage` (`shared/errors.ts:3–5`), which **every** other
  module in the tier imports and calls: `bootstrap.ts:44`, `shared.ts:119`, `shared.ts:195`,
  `fetch.ts:53`, `reinstall.ts:44`, `enable-disable.ts:67`. `import.ts` is also the only
  module in the tier with no file-header comment.

  `import.test.ts:44–54` spends eleven lines of header documenting that this exact ternary
  leaves the pair one branch short of complete under D-116-01a, and records a brute-force
  measurement proving the `String(err)` arm is unreachable. **Importing `errorMessage`
  deletes the branch from this pair entirely** — it moves to `shared/errors.ts`, whose own
  pair owns it — so the documented shortfall, and the eleven lines justifying it, both go
  away.

  **Fix:** add `import { errorMessage } from "../../../shared/errors.ts";` and replace
  `import.ts:31` with `message: errorMessage(err),`. Delete `import.test.ts:44–54`.

### `tests/edge/handlers/plugin/*.test.ts` (11 files)

- **[WARNING] The hermetic-workspace helper is copy-pasted 11 times, against an in-repo precedent that already de-duplicated the same shape once** — `install.test.ts:149–182`, `update.test.ts:178–212`, `list.test.ts:141–175`, `enable-disable.test.ts:157–188`, `fetch.test.ts:96–122`, `info.test.ts:110–144`, `pending.test.ts:136–171`, `reinstall.test.ts`, `uninstall.test.ts:136–170`, `bootstrap.test.ts:194–229`, `import.test.ts:146–173`

  Verified byte-for-byte: `diff` of `install.test.ts:150–172` against `update.test.ts:179–201`
  reports **only** the two `mkdtemp` prefix string literals as different. All eleven copies
  carry the same `Object.hasOwn(process.env, "HOME")` / `previousHome` /
  `Object.hasOwn(process.env, "PI_CODING_AGENT_DIR")` / `previousAgentDir` save-and-restore,
  the same `t.after` restore-and-`rm` block, the same `process.env.HOME = home` +
  `delete process.env.PI_CODING_AGENT_DIR` sequence, and a `t.mock.method(https, "request", …)`
  trap differing only in its throw message and whether the spy is returned.
  `readGeneratedAgents` plus `GeneratedAgentProjection` plus `MODEL_FIELD_PREFIX` is
  **byte-identical** between `install.test.ts:294–315` and `update.test.ts:407–428`
  (`diff` reports no differences). `readConfigLayer` is duplicated across `install`, `update`
  and `reinstall`.

  This is not a style nit — it is the exact duplication the repo already fixed once, one
  directory up. `tests/edge/notification-boundary.ts:3–9` records it: *"WR-08: four suites
  carried byte-identical copies of this factory and its four types… one shared definition
  breaks once instead of four suites drifting apart."* The same reasoning applies verbatim
  here, and drift is already the live risk: `list`, `update`, `pending`, `info`, `uninstall`
  and `reinstall` return the transport spy's call count under four different member names
  (`transportCalls`, `networkCalls`, `networkCallCount`, `networkCallCount()`), while
  `install`, `enable-disable`, `bootstrap` and `import` do not return it at all.

  **Fix:** add `tests/edge/handlers/plugin/hermetic-workspace.ts` beside the suites it serves
  (not under a generic `helpers/` directory) exporting one
  `createHermeticWorkspace(t, label, options)` returning
  `{ cwd, projectRoot, userRoot, transportCalls }` with the throw message taken as an option,
  plus the shared `readGeneratedAgents`/`readConfigLayer` projections. Have all eleven suites
  import it. Model the module header on `notification-boundary.ts`'s.

- **[WARNING] The shared `readGeneratedAgents` catch conflates "directory absent" with "read failed"** — `install.test.ts:298–301`, `update.test.ts:411–414`

  `try { files = (await readdir(agentsDir)).sort(); } catch { return []; }` returns the empty
  projection for **any** `readdir` failure. `install.test.ts:667` asserts `agents: []` for the
  `optout` plugin, and that assertion is reached through this catch (no `agents` directory is
  created for a disabled plugin) — so it would pass equally if `readdir` failed for a reason
  that had nothing to do with the module under test. The skill's standalone-negative rule
  applies: the case must assert what the value *is*, and here the value's provenance is
  unverified.

  **Fix:** in the extracted helper, narrow the catch to
  `catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") { throw error; } return []; }`
  — or, since assertions are barred in this tree, test
  `error instanceof Error && "code" in error && error.code === "ENOENT"` and rethrow otherwise.

### `tests/edge/handlers/plugin/info.test.ts`

- **[WARNING] The header advertises a positive control for its NFR-5 zero that no case asserts** — `info.test.ts:41–50` vs. `info.test.ts:259–285`

  The header claims the offline zero is falsifiable because *"a cold git-source plugin, whose
  sibling row with the flag supplied does reach that door"*. `networkCallCount()` is asserted
  exactly once in the file, at line 255 — the flag-**absent** case. The two flag-**supplied**
  cases (263–284), which the header names as the arm where the counter rises, assert only
  `notifications` and `verifyBoundary()`. The measurement that makes the zero meaningful
  lives in the author's notes, not in the suite.

  This is the pattern the repo's own convention forbids ("a gate wants a test that plants the
  violation, not one that reads the config"), and the in-repo model is in this same tier:
  `bootstrap.test.ts:156–168` documents its plant *and* asserts the counter on both arms.

  **Fix:** add `assert.strictEqual(workspace.networkCallCount(), N);` to the two cases at
  line 263, with `N` the count measured against the real module (one attempt per enumerated
  scope). That turns the file's prose measurement into a live assertion and makes line 255's
  zero falsifiable inside the suite.

### `tests/edge/handlers/plugin/enable-disable.test.ts`

- **[WARNING] Two cases pin contradictory omitted-scope answers with nothing recording why** — `enable-disable.test.ts:515` vs. `enable-disable.test.ts:600–608`

  Line 515 (`{ args: "alpha@mp", label: "scope-omitted" }`) proves that with no scope flag the
  **project** record flips and the **project** base config takes the declaration. Line 600
  (`{ args: "alpha@mp", … reported: "the user scope when no scope flag was supplied" }`)
  proves that when a throw escapes, the failure row is bracketed `[user]`.

  Both are correct against production: `orchestrators/plugin/enable-disable.ts:193` documents
  project-then-user precedence (CMP-5) for resolution, and line 909 of the same file
  (`const scope: Scope = requestedScope ?? "user"`) is the deliberate convention that a
  failure row which never got to resolve still carries a scope token.
  `edge/handlers/plugin/enable-disable.ts:66` mirrors that convention. But nothing in the
  test file says so, and a reader diffing the two cases sees a straight contradiction. A
  future maintainer "fixing" line 66 to match line 515 would be reverting a deliberate design
  choice.

  **Fix:** add one sentence to the file header naming the two facts and the production line
  that reconciles them: resolution defaults project-then-user (CMP-5), the failure row cannot
  know the resolved scope and stamps `requestedScope ?? "user"` per
  `orchestrators/plugin/enable-disable.ts:909`, so the two omitted-scope cases legitimately
  disagree.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `bootstrap.ts` | `makeBootstrapHandler` | `bootstrap.test.ts:272` + 8 more | owned |
| `enable-disable.ts` | `makeEnableDisableHandler` | `enable-disable.test.ts:324` + 8 more | owned |
| `fetch.ts` | `makeFetchHandler` | `fetch.test.ts:359`, `:394`, `:413` | owned |
| `fetch.ts` | `parseFetchTarget` | `fetch.test.ts:210` + 12 more | **owned, but no production consumer outside `fetch.ts` — new BLOCKER above** |
| `fetch.ts` | `ParsedFetchTarget` (type) | `fetch.test.ts:209` (`satisfies`) | **same; delete rather than document** |
| `import.ts` | `makeImportHandler` | `import.test.ts:175` + 5 more | owned |
| `import.ts` | `ImportHandlerDeps` (type) | `import.test.ts:83` (`NonNullable<…>` derivation) | owned |
| `info.ts` | `makePluginInfoHandler` | `info.test.ts:216` + 6 more | owned |
| `install.ts` | `makeInstallHandler` | `install.test.ts:455` + 9 more | owned |
| `list.ts` | `makeListHandler` | `list.test.ts:426` + 8 more | owned |
| `list.ts` | `BOOLEAN_FLAGS` | — *(only `tests/architecture/flag-catalog-drift.test.ts:110`)* | **NOT owned by its pair — new BLOCKER above** |
| `pending.ts` | `makePendingHandler` | `pending.test.ts:263` + 4 more | owned |
| `reinstall.ts` | `makeReinstallHandler` | `reinstall.test.ts:361` + 13 more | owned |
| `shared.ts` | `splitPluginMarketplaceRef` | `shared.test.ts:55`, `:69`, `:90` | owned |
| `shared.ts` | `parseMapModelArgs` | `shared.test.ts:104`–`:248` (11 cases) | owned |
| `shared.ts` | `parseRequiredPluginMarketplaceRef` | `shared.test.ts:252`–`:375` (9 cases) | owned |
| `shared.ts` | `withParsedArgs` | `shared.test.ts:379`–`:501` (5 cases) | owned |
| `shared.ts` | `PluginMarketplaceRef` (type) | `shared.test.ts:66`, `:80` (`satisfies`) | owned |
| `shared.ts` | `ParsedPluginMarketplaceRef` (type) | `shared.test.ts:263`, `:285`, `:306` | owned |
| `shared.ts` | `ParsedMapModelArgs` (type) | `shared.test.ts:47`, `:116`, `:169`, `:189`, `:207` | owned |
| `uninstall.ts` | `makeUninstallHandler` | `uninstall.test.ts:233` + 9 more | owned |
| `update.ts` | `makeUpdateHandler` | `update.test.ts:646` + 8 more | owned |

**Result: 22 exports, 20 cleanly owned, 2 defective — and both defects are the same rule
(a production export widened to serve a test).** No export is covered only incidentally: every
owned row has at least one case that asserts its result, not merely calls it.

## Branch census

I walked every branch of all 12 production modules against the cases that reach it.

**Fully covered, no reachable-untested branch:** `bootstrap.ts` (parse-throw / surplus-positional /
`--scope`-rejected / success / catch — all five, and the guard *order* is pinned by
`bootstrap.test.ts:337–363` and `:365–391`), `enable-disable.ts` (both `usageFor` arms, both
early returns, success, catch, and both arms of `parsed.scope ?? "user"`), `fetch.ts` (parse
throw, unknown flag, arity, all three `toFetchTarget` arms, malformed ref, both arms of the
scope ternary, handler short-circuit and delegation), `import.ts` (parse throw, positional
guard, both arms of `deps.importClaudeSettings ?? importClaudeSettings`, both arms of
`selectedScopes`), `info.ts` (accepted-flag arm, unknown-flag arm, positional arm, arity guard,
malformed ref, both `fetch`/`scope` spreads), `install.ts` (both scanner returns, arity guard,
malformed ref, all four downstream-flag spread combinations, `local` spread, scope default),
`list.ts` (recognized-filter arm, unknown-option arm, positional arm, arity guard, all five
filter spreads, marketplace spread, scope spread), `pending.ts` (both sentences of the
first-positional shape test, delegation, scope spread), `reinstall.ts` (both flag-rejection
stages, arity, all three `parseTarget` arms, malformed ref, scope and local spreads),
`shared.ts` (all arms of all four exports, including the `message === usage` collapse both
ways at `shared.test.ts:311` and `:330`), `uninstall.ts` (both early returns, delegation, both
spreads), `update.ts` (both scanner returns, arity guard, all three target forms, malformed
ref, all four downstream-flag combinations, scope and local spreads).

**Compiler-forced and not removable (D-116-01a category) — 3 sites, none a finding:**

- `install.ts:64` — `nonFlagPositionals.length !== 1 || positional === undefined`. The second
  disjunct is unreachable at runtime: `nonFlagPositionals` is a hole-free `string[]`, so a
  length of 1 guarantees index 0 is a string. It exists only because
  `noUncheckedIndexedAccess` types the read as `string | undefined`, and both `!` and `as` are
  barred in `extensions/`.
- `info.ts:52` — the identical construct, identical reasoning.
- `pending.ts:39` — the `?? ""` fallback. Already measured and documented at
  `pending.test.ts:72–92`, including a brute force over 19,530 argument strings. That analysis
  holds and I found nothing that falsifies it.

**Unreachable-by-real-input production dead code:** none found. This tier does not carry the
defensive-branch problem META-FINDINGS records elsewhere, and no test in it monkeypatches a
global prototype to reach a branch.

## Grading of first-pass findings

### `tests/edge/handlers/plugin/info.test.ts`

- **CONFIRMED** — *Full orchestrator-rendered message duplicated across every case.* Real and
  correctly rated WARNING: `deepStrictEqual` still discriminates, and this file's header
  (lines 22–24) is **honest** about restating the grammar — it says the row grammar "rides
  along" and names `tests/orchestrators/plugin/info.test.ts` as the owner. The proposed
  remedy (project to name/version/scope/status, à la `list.test.ts`'s `projectListing()`) is
  workable here: the droppable surface is the glyph, `<no autoupdate>` and
  `components: not resolved`.

### `tests/edge/handlers/plugin/uninstall.test.ts`

- **UNDERSTATED** — *Full orchestrator-rendered message duplicated alongside the footprint
  proof.* The duplication is real, but the sharper defect is that the file's own header
  (`uninstall.test.ts:51–52`) states *"none re-derives the uninstall workflow's own row
  grammar, which tests/orchestrators/plugin/uninstall.test.ts owns"* — while
  `PROJECT_UNINSTALLED`/`USER_UNINSTALLED` (lines 92–98) are precisely that grammar, `/reload`
  trailer included. A header that disclaims a property the file does not have is worse than
  the duplication itself, because it stops the next reader from checking.
  **The recorded remedy is also wrong and must not be executed:** "dropping the message
  literal" would leave `notifications` unasserted while the boundary still counts one
  emission, so any garbled message would pass — the skill classes an assertion-weakening
  revision as a finding in its own right. Correct fix: rewrite lines 51–52 to state honestly
  that the grammar is restated and why (copy `fetch.test.ts:29–32`'s wording), and treat the
  duplication as dissolved by the injection seam, not by weaker assertions.

### `tests/edge/handlers/plugin/pending.test.ts`

- **UNDERSTATED** — *Full orchestrator-rendered message duplicated across every case.* Same
  shape: `pending.test.ts:34–36` claims *"The rendered pending grammar … is not re-derived
  here"*, and `PROJECT_BLOCK`/`USER_BLOCK` (lines 228–229) are that grammar. The duplication
  half is the *mildest* in the tier — two tokens, a glyph and `(will install)` — so a
  projection would buy almost nothing; the header correction is the whole fix. Rewrite lines
  34–36; leave the constants alone.

### `tests/edge/handlers/plugin/reinstall.test.ts`

- **CONFIRMED** — *Full orchestrator-rendered message duplicated, including success counts and
  reload hint.* Correctly rated, and the first pass already spotted the header contradiction
  at lines 92–93 — the only one of the three it caught. Note the same caveat as uninstall:
  the alternative remedy "drop the message assertion in favor of the footprint" weakens the
  suite; fix the header, or fix the seam.

### `tests/edge/handlers/plugin/fetch.test.ts`

- **CONFIRMED** — *Full orchestrator-rendered message duplicated, including reason trailers.*
  Real, correctly rated WARNING, and this file's header (lines 29–32) is honest about it — it
  is in fact the model wording the three lying headers should adopt. The first pass missed
  that this file's more serious defect is one directory over in `fetch.ts`'s export surface
  (new BLOCKER above).

### `extensions/pi-claude-marketplace/edge/handlers/plugin/{list,install,uninstall,update,reinstall,enable-disable,info,pending,fetch}.ts`

- **UNDERSTATED — should be BLOCKER** — *Orchestrator reached by direct import, not by an
  injected dependency.* META-FINDINGS §Calibration already flags this as the sweep's starkest
  severity split (6 BLOCKERs in `edge-handlers-marketplace.md`, 1 grouped WARNING here) and
  arbitrates for the marketplace reading. Reading the source independently, that arbitration
  is right, and the first-pass rationale here ("not urgent — the current tests are not weak,
  just heavier") understates the cost on three measurable counts:

  1. **Ownership.** These suites do not merely run the orchestrator — they *assert its
     outputs*. `install.test.ts:359–397` pins persisted `compatibility.installable`,
     `compatibility.unsupported`, `resources.skills` and `resources.agents`;
     `install.test.ts:371–381` pins `ScopeConfig` layer contents;
     `install.test.ts:306` parses generated agent frontmatter for the AG-7 `model:` line;
     `reinstall.test.ts:308–342` pins the orchestrator's success counters and `/reload`
     trailer. Those are the contracts of `orchestrators/plugin/install.ts`,
     `persistence/config-io.ts` and `bridges/agents/frontmatter.ts` — three layers below the
     module under test. Per the pairing rule, a handler pair may not own them.
  2. **The three lying headers are a direct consequence.** `reinstall`, `uninstall` and
     `pending` each disclaim re-deriving the orchestrator's grammar because the authors knew
     they should not — and each does it anyway, because with no seam there is nothing else to
     observe. Fix the seam and all three disclaimers become true.
  3. **The duplication finding above is also a consequence.** Eleven copies of a 23-line
     hermetic-`HOME` fixture, real `mkdtemp` trees, real `state.json` writes and an
     `https.request` trap exist in a tier whose modules are 42–132 lines of argument parsing.
     A `deps.<verb>?` seam replaces all of it with one `strong-mock` per case.

  **Fix (unchanged from the first pass, correctly identified there):** give each of the nine
  handlers an optional narrow port defaulting to the real function, exactly as
  `import.ts:16` does with `importClaudeSettings?`. Then every delegating case states the
  complete options bag with `exactParams: true` and ends in `verify()` — the shape
  `import.test.ts:187–195` already demonstrates. Sequence this with the
  `edge-handlers-marketplace.md` blockers as one ticket, not two.

### `extensions/pi-claude-marketplace/edge/handlers/plugin/{fetch,info,install,list,pending}.ts`

- **CONFIRMED** — *Factory JSDoc opens with a noun phrase, not a third-person verb phrase.*
  Verified at `fetch.ts:110–114`, `info.ts:24–28`, `install.ts:40–44`, `list.ts:32–37`,
  `pending.ts:27–30`. Mechanical WARNING, correctly rated. Note that `update.ts:32`,
  `uninstall.ts:17`, `reinstall.ts:28`, `enable-disable.ts:32`, `bootstrap.ts:35` and
  `import.ts:21` carry **no** factory JSDoc at all — so the fix is "drop the `Factory:` label
  and open with `Returns…`" on five, not "make all twelve match".

### `extensions/pi-claude-marketplace/edge/handlers/plugin/{shared,fetch,import}.ts`

- **CONFIRMED** — *Undocumented top-level exported interfaces.* Verified at `shared.ts:18`,
  `shared.ts:23`, `shared.ts:90`, `fetch.ts:32`, `import.ts:14`. Correctly rated WARNING with
  one correction: `ParsedFetchTarget` (`fetch.ts:32`) should be **deleted**, not documented —
  see the new BLOCKER above. Document the other four.

## Still clean after attack

These survived deliberate mutation. Naming the mutations they catch is the point — the fixing
pass should not spend time here.

- **`tests/edge/handlers/plugin/shared.test.ts`** — the strongest file in the tier. Catches:
  `indexOf` → `lastIndexOf` in `splitPluginMarketplaceRef` (the `alpha@official@mirror` case
  at line 69 is there precisely for this); `atIdx <= 0` → `atIdx < 0` (line 85 row);
  swapping the `plugin`/`marketplace` halves; swapping `mapModel`/`partial` (the
  partial-only row at line 128); reordering `nonFlagPositionals` (line 152 family);
  making the `scope` spread unconditional (`deepStrictEqual` distinguishes an absent key from
  a present-but-`undefined` one, so line 104's expectation fails); dropping the
  `message === usage` collapse (line 311); throwing a non-`Error` from `parse` (line 448);
  and swallowing a `run` rejection (line 476, which asserts error *identity*, not message).
  `withParsedArgs` is proved with a real `strong-mock`, `exactParams: true`, exact arguments,
  and `verify(run)` — and every rejection case states **no** expectation on `run`, which is
  the correct D-116-06 silence proof (`times(0)` would be no limit in `strong-mock`).
- **`tests/edge/handlers/plugin/install.test.ts`** — catches: dropping
  `applyDefaultEnabled: true` (the `optout` case at line 633 asserts both `enabled: false` and
  `plugins: { "optout@mp": { enabled: false } }`); flipping the `scope ?? "user"` default;
  making `mapModel`, `partial` or `local` unconditional (the four-cell matrix at line 403 and
  the layer family at line 551); swapping `marketplace`/`plugin`; loosening
  `length !== 1` to `< 1`. Most notably, **replacing `cwd: ctx.cwd` with any other expression
  fails**, because the boundary states `cwd: { value, reads: 1 }` and `verify(ctx)` reports the
  unmet read — a genuinely clever property of the shared fixture.
- **`tests/edge/handlers/plugin/list.test.ts`** — catches: renaming any one of the five filter
  members to a neighbour's (the fixture gives every bucket exactly one plugin, so a swap
  produces a different row set); dropping the marketplace or scope spread; loosening the arity
  guard; changing the unknown-option wording to the siblings' unknown-flag wording. The
  `projectListing()` reduction is safe: it *throws* on an unrecognised row or header
  (lines 326, 337, 351) rather than silently matching, and it pins `severity === undefined`.
- **`tests/edge/handlers/plugin/update.test.ts`** — catches: collapsing any of the three target
  forms into another (each expected footprint excludes something the other two include);
  `ref.slice(1)` → `ref.slice(0)`; dropping the scope spread (the no-scope case enumerates
  *both* roots, an outcome neither explicit value produces); all four downstream-flag cells.
- **`tests/edge/handlers/plugin/bootstrap.test.ts`** — the best plant in the tier. Deleting the
  `deps.gitOps` forward so the workflow falls back to `DEFAULT_GIT_OPS` turns the clone
  recorder empty *and* raises `networkCallCount()` from 0 to 1 — both asserted, both measured
  and documented (lines 160–168). Also catches: reordering the positional and `--scope` guards
  (lines 337–363 vs 365–391); every field of the hand-built failure row.
- **`tests/edge/handlers/plugin/import.test.ts`** — the tier's one literal exact-argument
  proof. Catches: any wrong member of the options bag, including a wrapped or substituted
  `gitOps`; a wrong `selectedScopes` order (line 192 pins `["project", "user"]`); and reaching
  the delegate at all on a rejection path (no stated expectation). The
  `deps.importClaudeSettings ?? importClaudeSettings` fallback arm is covered for real at
  line 243, not skipped.
- **`tests/edge/handlers/plugin/enable-disable.test.ts`** — catches: inverting `enable`;
  swapping `parsed.marketplace`/`parsed.plugin` in the failure row; changing the row's
  severity or status token; and — via `withUnreadableCwd`'s `Proxy` (line 196) — the
  non-`Error` throw arm. The `Proxy` plant is legitimate: it wraps the *case's own* context
  object, not a global.
- **`tests/edge/notification-boundary.ts`** *(unscored by the first pass)* — attacked and
  clean. The `emissions > 0` / `toolProbes > 0` / `cwd.reads > 0` guards are correct and the
  reasoning at lines 20–23 checks out: a `times(0)` would install a serving stub and verify
  green, so an unstated member is genuinely the stronger claim. `Notification` pushes
  `{ message }` versus `{ message, severity }` conditionally (line 105), which is what lets
  `deepStrictEqual` distinguish "no severity" from `severity: undefined`. It lives beside the
  suites it serves (`tests/edge/`), not in a generic dumping ground.
- **`info.test.ts`'s catalog-derived input** (`ACCEPTED_FLAGS = [...parseFlagNames("info")]`,
  line 88) — I attacked this as a possible "expected value computed by production code" and it
  is **safe**: the literal `--fetch` is independently pinned twice, at
  `tests/edge/flag-catalog.test.ts:85` and `tests/architecture/flag-catalog-drift.test.ts:131`,
  so a silent catalog rename fails there first. Not a finding.
- **`extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts`** — clean apart from
  the wide `EdgeDeps` parameter above. The bare `catch {}` at line 69 carries a six-line
  comment explaining why the error object is discarded (SNM-10 confines `cause` to
  plugin-level rows), which satisfies the empty-catch rule.

## Not covered

- I did not run `node --test`, `npm run test:coverage:direct`, or any gate — read-only sweep
  per the brief. Every coverage and branch claim above is from reading plus targeted `grep`
  and `diff`, not from measurement. In particular, the exact `toolProbes` counts each case
  states (2 vs. 4) are taken as the authors' measurements; I verified they are internally
  consistent with the emission paths described, not that they are the true runtime counts.
- `tests/edge/handlers/marketplace-seed.ts` was read only far enough to confirm the double
  cast META-FINDINGS names (`marketplace-seed.ts:95`,
  `as unknown as Parameters<typeof saveState>[1]`). Its full review belongs to
  `edge-handlers-marketplace.md` / `edge-handlers-root.md`.
- `extensions/pi-claude-marketplace/edge/handlers/shared.ts` (`extractLocalFlag`) is imported
  by six modules in this tier but is owned by `edge-handlers-root.md`; I did not review it.
- `update.test.ts:620–629` pins a behavior I could not fully explain from within this area:
  `@alpha` with no scope flag updates the project scope's `alpha` and leaves the user scope's
  `alpha` untouched, while the no-positional form enumerates both scopes. That may be correct
  marketplace-target resolution or an orchestrator quirk this pair has locked in. It belongs
  to `orchestrators-plugin-update-*`; flagging it here only so it is not lost.

## Meta-findings impact

### New cross-cutting evidence

1. **The export-ownership census is the check that finds what a first pass misses, and it
   should be run repo-wide.** This area was declared "the strongest tier reviewed so far" with
   zero blockers, and it is genuinely excellent on every assertion-quality axis. Both blockers
   I found came from one question the first pass never asked: *for each production export,
   who outside the module consumes it?* Two of 22 exports failed. That question costs one
   `grep` per export and is mechanically checkable across the whole tree — recommend running
   it against every production module in the sweep, not just this area. Likely-affected areas:
   anywhere a `tests/architecture/*` gate imports a production constant
   (`edge-completions`, `shared-core`, `domain-*`), since importing a constant *into a gate* is
   the standard pretext for widening a production export.

2. **META-FINDINGS' "Gates that do not gate" list should grow to six, and the sixth is a
   tautology, not merely a mis-aimed grep.**
   `tests/architecture/flag-catalog-drift.test.ts:103–114` compares `parseFlagNames("list")`
   against `parseFlagNames("list")` — the handler side is defined as the catalog call at
   `list.ts:30`, and the test's own comment confirms the `.delete("--local")` is a no-op. This
   is stronger than the "static config-string check" (item 4) and the "grep that can never
   fire" (item 2): those could fire under some input; this one cannot fire under any. Add it,
   and add the audit question it implies: *does any assertion in this gate have the same
   expression on both sides?*

3. **"Reduce the assertion to a projection" is the wrong remedy for the fragment/duplication
   cluster, and META-FINDINGS §3 risks propagating it.** In this tier the message assertions
   are already whole-value `deepStrictEqual` against hand-written strings — the *correct* form
   §3 recommends. The problem is ownership, not strength, and the remedies logged against
   `uninstall`/`reinstall`/`fetch` ("drop the message literal", "reduce to a minimal
   projection") would leave `notifications` unasserted while the boundary still counts an
   emission. The skill classes an assertion-weakening revision as a finding in its own right.
   Recommend META-FINDINGS state explicitly: **§3 (strengthen fragment assertions to whole
   values) and §4 (add injection seams) are the two remedies; "weaken a whole-value assertion
   to a projection" is never one.**

4. **A test-file header that disclaims a property the file does not have is a distinct,
   greppable defect class.** Three of twelve files here carry one
   (`reinstall.test.ts:92–93`, `uninstall.test.ts:51–52`, `pending.test.ts:34–36`, all of the
   form *"none re-derives X's own row grammar"* beside constants that are exactly that
   grammar), while their two honest siblings (`fetch.test.ts:29–32`,
   `info.test.ts:22–24`) say plainly that the grammar rides along. These headers are the most
   sophisticated documentation in the sweep, which makes a false claim in one *more* dangerous
   than no claim, not less. Recommend adding a check to the fixing pass: for every
   `none re-derives` / `none restates` / `none re-proves` clause in a test header, verify it
   against the file's own constants. Other areas whose files carry this header style —
   `orchestrators-plugin-*`, `bridges-*` — should be swept the same way.

5. **The WR-08 de-duplication was done once and never propagated.**
   `tests/edge/notification-boundary.ts` exists because four suites carried byte-identical
   copies of one factory. Eleven suites in this same tier now carry byte-identical copies of a
   *different* factory (the hermetic-`HOME`/agent-dir workspace), verified by `diff`. The same
   `mkdtemp` + `process.env.HOME` + `PI_CODING_AGENT_DIR` + `t.mock.method(https, "request")`
   block almost certainly appears in `tests/edge/handlers/marketplace/**` and
   `tests/orchestrators/**` too — every area that needs a hermetic scope root. Recommend one
   repo-wide count of that block before the fixing pass sizes the work; if it is above ~20
   copies it outranks several of the current leverage items.

### Corrections to META-FINDINGS.md

- **§Calibration, "Injection seam — 6 BLOCKERs vs. 1 grouped WARNING":** the arbitration is
  right and I confirm it from the source, but the recorded ratio understates the plugin side's
  scale. The marketplace file's 6 BLOCKERs cover 6 handlers; the plugin side's single grouped
  WARNING covers **9** handlers (`list`, `install`, `uninstall`, `update`, `reinstall`,
  `enable-disable`, `info`, `pending`, `fetch`). The consolidated item 4 count "15 handler
  modules" is correct in total, but planning that treats the plugin side as one ticket and the
  marketplace side as six will mis-size it. Recommend recording it as **15 handlers, one
  production change each, one ticket.**

- **§"Ranked by leverage" item 2, "Replace test-only hooks over module-global state":** the
  table lists four modules, all of them *reset functions over module-global state*. This area
  adds a second shape of the same rule that the table's framing would exclude — a
  **test-only export of an immutable value** (`list.ts:82`) and a **test-only export of a pure
  function** (`fetch.ts:43`). Neither is a reset hook and neither touches global state, but
  both are "an export … added for a test" under the same guideline clause, and the fix is the
  same (change the production design, not the test's access). Recommend broadening item 2's
  title from "test-only hooks over module-global state" to "test-only production exports",
  with the reset-hook table as its first sub-group.

- **§"Patterns to propagate", row *"Strict interaction mocking … `tests/edge/handlers/plugin/**`"*:**
  this row is only one-twelfth true. `tests/edge/handlers/plugin/import.test.ts` is a genuine
  reference implementation — a complete options bag stated with `exactParams: true`, no
  wildcard matcher, terminal `verify()`. But of the twelve files in that glob, exactly
  **three** use `strong-mock` for an interaction at all (`import`, `bootstrap`, `shared`), and
  the other nine cannot, because there is no seam. Recommend narrowing the reference to
  `tests/edge/handlers/plugin/import.test.ts` specifically, so the fixing pass does not go
  looking for a pattern that is absent from three quarters of the directory.

### Confirmations

- **`tests/edge/handlers/marketplace-seed.ts`'s double cast, confirmed from a second angle.**
  `marketplace-seed.ts:95` carries `as unknown as Parameters<typeof saveState>[1]`, exactly as
  recorded. New evidence on blast radius: **8 of the 12 suites in this tier** depend on it
  (`install`, `list`, `update`, `enable-disable`, `fetch`, `info`, `uninstall`, `reinstall`),
  and they use it to build the `state.json` that *is* their delegation proof — so the cast sits
  underneath the primary assertion of roughly 70 cases in this area alone. That raises its
  priority above "a fixture typing nit".

- **§"Gates that do not gate" is a real and under-counted workstream.** Independently confirmed
  from a sixth instance (item 2 above), found in a file the first pass had already reviewed and
  cleared as "not inert". `architecture-state-drift-gates.md:69` noticed that "two of its four
  tests reconcile two values both *derived from* production code" but excused it because a
  fourth test covers the gap. That excuse is correct about coverage and wrong about the gate:
  a tautological assertion should be deleted, not kept because something else compensates —
  especially when its existence is the sole justification for a production export. Recommend
  the audit ask not just "what does this gate scan?" but "can this assertion fail?"

- **The repo's own rule — *a gate wants a test that plants the violation* — is applied
  brilliantly where it is applied.** `bootstrap.test.ts:160–168` records a real measured plant
  (delete the `gitOps` forward → recorder empties, transport counter rises 0→1) and asserts
  both halves. `import.test.ts:44–54` records a brute force over 19,530 inputs to justify a
  single uncovered branch. `pending.test.ts:72–92` does the same. This is the strongest
  evidence in the sweep that the convention works when followed — which is why
  `info.test.ts`'s unasserted positive control and the `flag-catalog-drift` tautology stand out
  as the two places it lapsed.
