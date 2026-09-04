# Orchestrators — plugin reinstall

**Scope:** `tests/orchestrators/plugin/reinstall.test.ts` (7628 lines) paired with
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (1613 lines).
`reinstall.messaging.test.ts` was explicitly out of scope for this pass.
**Test files reviewed:** 1
**Production modules reviewed:** 1

## Summary

The suite is unusually rigorous: whole-value assertions on the discriminated
`ReinstallPluginOutcome`, real filesystem fixtures with `mkdtemp`/hermetic
`HOME`, `strong-mock`-free fakes for git/credential/device-flow ports that stay
fully in-memory, and a ~2100-line NFR-3 "retry proof" chapter that reruns the
same call twice and diffs on-disk trees, schedules, and bytes rather than
mocking collaborators. The four specific structural checks all come back
clean: reinstall.ts never imports `platform/git.ts`/`gitOps`/`DEFAULT_GIT_OPS`
(NFR-5 holds in both source and tests — every git double is bound through the
documented `ReinstallCloneCacheSeam`, and `boundary: "memory"` keeps every
clone/resolve call off the network); "reinstall always wins" over force
resolution is proven by two decisive tests (unconditional agent overwrite,
and reinstalling a plugin that needed `--force` to install without needing it
again) that a plausible inversion would fail; the `__deps`/seam types exported
from `reinstall.ts` match the project's own sanctioned DI-as-parameter
pattern, not a test-only hook; and composition of the bridge stage/replace
flow is verified end-to-end through disk state and outcomes, never by
mocking a bridge and counting its calls. The two things a fixing pass should
attack first: (1) three genuinely vacuous/weak assertions concentrated in the
later "Additional coverage tests for uncovered paths" (`GAP-*`) block — one of
them (`GAP-15`) asserts a claim that the module's own `D-19-01` comment and an
earlier sibling test (`PRL-12`) prove is false, and two others (`GAP-12`,
`GAP-14`) use a loose regex that a broken summary-tally implementation would
still satisfy; (2) the file's size is real, not just density — at least three
pairs of tests in the `GAP-*` block duplicate an existing test elsewhere in
the same file almost verbatim, and the underlying production module already
has an established convention (`discover-names.ts`, `git-source-probe.ts`
live beside it) for splitting a plugin-verb's leaf concerns into siblings,
which would let the test file split along the same seams instead of growing
as one unit.

## Unit test findings

### `tests/orchestrators/plugin/reinstall.test.ts`

- **[BLOCKER] `GAP-15` asserts a claim its own module already disproves** —
  `test('GAP-15: reinstallPlugin with bridge warning emits notifyWarning
  before success', ...)` (lines 1986–2022). The test's comment claims
  "`bridgeWarnings` are emitted via `notifyWarning` before the success
  notification," but `reinstall.ts`'s own header comment (`IN-01 / D-19-01`,
  around line 384) states hygiene/bridge warnings are **not** surfaced on the
  standalone path, and the sibling test `PRL-12` (line 767, "cache and data
  cleanup failures are SILENTLY swallowed") already proves this with the same
  fault (`dropMarketplaceCache` rejection). `GAP-15`'s only assertions are
  `outcome.partition === "reinstalled"` and
  `notifications.some((n) => n.message.includes("reinstalled"))` — the latter
  is satisfied by the ordinary success row alone and would pass whether or
  not any warning notification is ever rendered. A plausible wrong
  implementation (including today's correct one, which renders no warning at
  all) passes this test for the wrong reason. Delete this test — it is fully
  superseded by `PRL-12` — or rewrite it to assert what the code actually
  does: `assert.equal(notifications.length, 1)` and that the single message
  contains no trace of `"cache-drop-warn"`.

- **[BLOCKER] Weak regex lets a broken summary tally pass** —
  `test('GAP-14: reinstallPlugins batch with only skipped outcomes emits
  skipped cascade', ...)` (lines 1931–1984) asserts only
  `assert.match(body, /skipped/)` (line 1979). Every skipped row already
  renders the literal substring `(skipped)`, so this regex is satisfied
  regardless of whether the batch-level summary/tally text the test's own
  comment describes ("`reinstallSummary` ... returns `'Plugin reinstall
  complete.'`") is present, correct, or wrong. Given the fixture forces the
  error-severity `not installed` reason (not an idempotent skip), the actual
  tally is very likely `Plugin reinstall: 1 failure`, contradicting the
  comment outright. Replace the regex with an exact `assert.equal(body,
  "...")` (or a tightly anchored regex on the tally line, following the
  pattern used by `DFEN-08` at line 4390) that would fail if the tally text
  regressed or the comment's claimed phrasing is wrong.

- **[BLOCKER] Weak regex lets a broken singular/plural branch pass** —
  `test('GAP-12: reinstallPlugins exactly-one-reinstalled emits singular
  summary', ...)` (lines 1871–1895) asserts only `assert.match(body,
  /hello.*reinstalled/)` (line 1890). The per-plugin cascade row alone
  (`● hello v1.0.0 (reinstalled)`) satisfies this regex; the test never
  inspects the singular-vs-plural tally line its own comment claims to prove
  (`reinstallSummary` returning `'Reinstalled plugin "<name>".'` for
  `reinstalledCount === 1`). A reversed or missing singular branch would
  still pass. Fix by asserting the exact tally text (`assert.match(body,
  /Reinstalled plugin "hello"\./)` or a full `assert.equal` on `body`).

- **[WARNING] Three duplicate test pairs add no discriminating power** —
  each pair exercises the identical branch and asserts the identical message
  shape, differing only in fixture literal names:
  - lines 643–677 (`PRL-10 / RINST-01: bare reinstall unconditionally
    overwrites foreign agent content across all bridges`) and lines
    1834–1869 (`GAP-11 / RINST-01: reinstallPlugin unconditionally overwrites
    agent foreign content`) — `GAP-11` is a strict subset of `PRL-10`.
  - lines 1086–1128 (`ATTR-03/SCOPE-01: explicit-scope-plugin reinstall of an
    other-scope-only target ...`) and lines 2143–2183 (`SCOPE-01: an
    explicit-scope plugin reinstall of an other-scope-only container ...`) —
    same target form, same asserted message, plugin name `"plug"` vs
    `"hello"` is the only difference.
  - lines 1130–1169 (`ATTR-03/SCOPE-01: explicit-scope-marketplace reinstall
    of an other-scope-only marketplace ...`) and lines 2185–2224 (`GAP-18:
    reinstallPlugins enumeration miss for an other-scope-only marketplace
    ...`) — same branch, marketplace name `"mp"` vs `"onlyuser"` is the only
    difference.
  Delete the second test of each pair (`GAP-11`, the line-2143 test, and
  `GAP-18`); none add coverage the first test in the pair does not already
  provide.

- **[WARNING] A fourth, lower-confidence near-duplicate** — `GAP-04` (lines
  1598–1639) and `GAP-17` (lines 2072–2111) both drive a `saveState`
  rejection to reach `errorWithManualRecovery`'s empty-leaks early-return
  branch (`GAP-04` via zero prepared handles, `GAP-17` via a clean rollback
  of one skill resource) and assert the same shape
  (`outcome.notes[0].includes(<message>)`). Confirm both branches are truly
  distinct at the source before keeping both; if they collapse to the same
  code path, consolidate.

- **[WARNING] Real-race test is unusually heavy and timing-sensitive** —
  `test('a marketplace removed between scope resolution and enumeration
  reports not added', ...)` (lines 4855–5017) spawns a real child process
  with an IPC readiness handshake and an `fs.watch`-driven rename race,
  bounded by 5–6 second hard timeouts, to reproduce a genuine TOCTOU window.
  The engineering is careful (readiness is synchronized before the race step
  fires), so this is not flagged as a hermeticity violation, but it is by far
  the heaviest and most CI-flakiness-prone case in the file. If `update.ts`
  or `uninstall.ts` tests already carry an equivalent harness, consider
  extracting it once into a shared per-verb-agnostic helper so the cost (and
  any future flake) is paid in one place, not three.

- **[WARNING] File-wide: split along the production module's own leaf-module
  seams** — see the "Production code findings" split recommendation below;
  the same 4 seams that recommendation names would let this test file split
  from one 7628-line file into a ~4400-line core plus three focused
  siblings, the largest of which (~2100 lines, the NFR-3 retry-proof chapter)
  is entirely about the `prepareAllHandles`/`replaceAll`/rollback/finalize
  machinery and already uses its own self-contained helper set
  (`observeReinstallSchedule`, `retryScheduleDirs`, `observeRetryDeps`,
  `retryCauseChain`) that would move cleanly.

- **[WARNING] `GAP-01`…`GAP-19` numbering is not a durable spec anchor** —
  the "Additional coverage tests for uncovered paths" banner (~line 1511)
  introduces an ad hoc `GAP-N` numbering that is not among this project's
  recognized durable-ID families (`D-NN`, `NFR-N`, `PRL-NN`, `ATTR-NN`, etc.
  per `.claude/rules/typescript-comments.md`). It does not violate the
  letter of the comment policy (it names none of the forbidden
  Phase/Plan/Wave/Task tokens), but it reads as a coverage-tracking artifact
  of the pass that added these tests — which is exactly the pass that also
  introduced the three duplicate pairs and three weak assertions above.
  Once those are resolved, fold the survivors into the surrounding
  requirement's own ID scheme (`PRL-NN`, `WR-NN`, etc.) rather than keeping a
  separate numbering.

### Clean files

No other correctness concerns were found across the remaining ~7000 lines:
naming, `test()`/no `describe()`/no committed `only`/`skip`, AAA structure,
`t.mock` (context-scoped, never the process-wide `node:test` `mock` import),
hermetic `HOME` and per-case `mkdtemp`, whole-outcome `deepStrictEqual`
assertions, structured-field error narrowing (`outcome.reasons`,
`outcome.failureClass`) rather than message-substring matching for the
module's own typed paths, and the git/credential/device-flow fakes (bound
`boundary: "memory"`, `makeMockGitOps` matching this project's own documented
`makeMock*` factory-naming convention) are all in good order.

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`

- **[WARNING] Two `switch` statements omit the required `default` group** —
  `rollbackReplacement` (lines 1542–1553) and `finalizeReplacement` (lines
  1568–1579) both switch on `entry.phase` (a 4-member union) with no
  `default` clause. TypeScript's control-flow exhaustiveness happens to make
  this compile safely today, but the typescript-google-style-review rule is
  unconditional: "every `switch` has a `default` group, last, even if
  empty." Add `default: return assertNever(entry.phase);` (there is already
  an `assertNever` precedent in `domain/resolver.ts`) to both, so a future
  `BridgePhase` member fails loudly instead of silently compiling into an
  `undefined` return only the type checker would have caught.

- **[WARNING] Unexplained cast from a partial to a fully-populated type** —
  `prepareAllHandles` (line 1251): `return handles as PreparedHandles;`
  promotes `PartialPreparedHandles` (all optional) to `PreparedHandles` (all
  required) with no comment. It is safe only because a throw during any of
  the four preceding assignments is caught and re-thrown two lines above,
  so control never reaches this line with a partially-populated `handles` —
  but that invariant is not visible at the assertion site itself. Per the
  style guide, `as`/`!` need "an obvious or commented reason"; add a one-line
  comment stating why the cast is sound (e.g. "safe: the catch above
  re-throws before this point on any partial failure").

- **[WARNING] Hidden dependency: `homedir()` read inline inside business
  logic** — `commitHooks` (line 1347) calls `homedir()` directly to build the
  hooks `if:`-predicate context (`ifCtx`). This is a live OS-boundary read
  with no injection seam; none of `ReinstallPluginOptions` /
  `ReinstallPluginDeps` allow overriding it, unlike the sibling
  `credentialOps`/`deviceFlowHttp`/`cloneCacheSeam` seams that already exist
  for exactly this purpose. Fix per the project's own sanctioned pattern:
  add a `homedir?: () => string` field to `ReinstallPluginDeps` defaulting to
  the real `os.homedir` at the call site, mirroring how `dropMarketplaceCache`
  and `removeDataDir` are already threaded.

- **[WARNING] Hidden dependency: `new Date()` read inline inside business
  logic** — `updateStateRecord` (line 1409) calls `new Date().toISOString()`
  directly to stamp `updatedAt`, with no injected clock. No test currently
  pins the literal timestamp, so this has not yet forced a test-side
  workaround, but it is the same class of hidden dependency the review is
  asked to hunt for. This is very likely a systemic pattern shared with
  `install.ts`/`update.ts`; a single `now: () => string` seam applied
  consistently across all three orchestrator-plugin verbs (rather than
  patching `reinstall.ts` alone) would be the more valuable fix.

- **[WARNING] The two primary exports lack their own doc comments** —
  `reinstallPlugin` (line 321) and `reinstallPlugins` (line 516) are the
  module's public entrypoints but carry no JSDoc block of their own; they
  rely entirely on the ~45-line file-header comment for their contract.
  Every other exported or module-private helper of comparable importance in
  this file (`handleSinglePluginFailure`, `surfaceReinstallDiscoveryWarnings`,
  `resolveMarketplaceReinstallScope`, `reasonsFromTypedError`) already has
  one. Add a short doc comment to each stating what it does and its return
  contract, per "every top-level export is documented ... method
  descriptions begin with a third-person verb phrase."

- **Confirmed clean — NFR-5**: no import of `platform/git.ts`, `gitOps`, or
  `DEFAULT_GIT_OPS` anywhere in the file; the only git-reaching surface is
  the documented `ReinstallCloneCacheSeam.materializePluginClone`, which
  defaults to the real `materializePluginClone` from `./clone-cache.ts` and
  is overridden only through the test-injected `__deps.cloneCacheSeam`.

- **Confirmed clean — force semantics**: `replaceAll`'s
  `replacePreparedAgents(handles.agents, { force: true })` (line 1278) is
  unconditional, and `resolveInstallable` gates through
  `requirePartialInstallable` (not `requireInstallable`), so a plugin that
  needed `--force` to install re-materializes on reinstall without any force
  flag existing on `reinstallPlugin`'s own options — "reinstall always wins"
  is structural, not a stateful flag, matching the project's documented
  derive-not-sticky model.

- **Confirmed clean — no test-only production surface**: `ReinstallPluginDeps`,
  `ReinstallCloneCacheSeam`, `RemoveDataDirFn`, and `DropMarketplaceCacheFn`
  are all exported to type the `__deps` parameter, which is read (never
  written) by production code and always defaults to the real
  implementation; this matches the project's own documented
  "dependency-injection-over-test-only-seams" convention rather than being a
  test-only export.

### Suggested module split

Given the file's size and the fact that `orchestrators/plugin/` already
splits per-verb leaf concerns into siblings (`discover-names.ts`,
`git-source-probe.ts`, `clone-cache.ts` are all imported by `reinstall.ts`
today), the same treatment applies to `reinstall.ts` itself:

1. **`reinstall-targets.ts`** — `enumerateReinstallTargets`,
   `enumerateAllReinstallTargets`, `enumerateMarketplaceReinstallTargets`,
   `resolveMarketplaceReinstallScope`, `sortReinstallTargets`,
   `installedTargetsForScope`. Pairs with a new
   `tests/orchestrators/plugin/reinstall-targets.test.ts` that would absorb
   the `ATTR-03`/`SCOPE-01` scope-resolution block (roughly lines
   1086–2295), after the duplicate pairs above are resolved.
2. **`reinstall-clone-probe.ts`** — `makeReinstallCloneProbe`,
   `resolveInstallable`. Pairs with
   `tests/orchestrators/plugin/reinstall-clone-probe.test.ts`, absorbing the
   `PURL-07`/`MIRR-06` git-source block (roughly lines 2764–3647 and
   5351–5486, ~1100 lines).
3. **`reinstall-replace.ts`** — `prepareAllHandles`, `replaceAll`,
   `commitHooks`, `rollbackReplacements`/`rollbackReplacement`,
   `finalizeReplacements`/`finalizeReplacement`,
   `abortHandles`/`abortPartialHandles`, `pushLeak`. Pairs with
   `tests/orchestrators/plugin/reinstall-replace.test.ts`, absorbing the
   entire NFR-3 retry-proof chapter (roughly lines 5488–7628, ~2100 lines,
   ~28% of the current file) which is already self-contained around its own
   `observeReinstallSchedule`/`retryScheduleDirs`/`observeRetryDeps` helpers.
4. **`reinstall-record.ts`** — `updateStateRecord`, `resourcesFromHandles`,
   `successOutcome`, `resourcesChanged`, `splitHandleWarnings`.

What remains in `reinstall.ts` (the lock-holding orchestration, the
single/bulk entrypoints, failure/notify wiring, and
`runPostSuccessMaintenance`) would drop to roughly 500–600 lines, and its
test file would drop to roughly 2500–3000 lines covering exactly that
surface — each of the four resulting pairs individually within the range the
rest of this codebase's orchestrator files already sit in.

### Clean files

- None — the one production module in scope, `reinstall.ts`, carries findings above.

## Not covered

- No line-by-line diff was performed against `install.test.ts` or
  `uninstall.test.ts` to hunt for cross-file duplication (both files are
  large; comparing them fully was out of budget for this pass). The
  duplication findings above are limited to what was found **within**
  `reinstall.test.ts` itself. Spot checks of scenarios that look like they
  could overlap with install's own contract (`SUB-02` substitution,
  `WR-04`/`WARN-01` degraded-kind aggregation) found each to be exercising
  reinstall's own independently-implemented wiring (documented explicitly in
  the `SUB-02` block's own header comment), not a copy of install's test.
- Byte-level formatting checks the linter would catch (blank lines at the
  start/end of a function body, brace placement) were not manually verified
  across the full 1613-line production file; `npm run check` was not run per
  the diagnostic-review constraints.
