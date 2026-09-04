# Edge — marketplace handlers

**Scope:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/*.ts` and
`tests/edge/handlers/marketplace/*.test.ts` (7 production modules, 7 test
modules; `tests/edge/handlers/marketplace-seed.ts` read for context only, not
reviewed — owned by another reviewer)
**Test files reviewed:** 7
**Production modules reviewed:** 7

## Summary

Test hygiene here is excellent by every mechanical measure: every case uses
`node:test` + `t.mock`, `strong-mock` for the one collaborator that has a real
injection seam, exact `assert.deepStrictEqual` on whole values, correct AAA
comments in order, per-case `mkdtemp` + `t.after()` cleanup, sandboxed
`HOME`/`PI_CODING_AGENT_DIR`, a `https.request` trap or counter in every case
that could plausibly reach git, no `test.only`/`.skip`, no hand-rolled
recorders, no `It.isAny()`/`anyTimes()`, no placeholder names, and unusually
precise decision-ID-anchored comments explaining exactly what each assertion
proves and why. Coverage of scope/`--local`/surplus-positional/rejection
branches is thorough and each row of every data-driven loop is its own
sibling `test()`.

The one structural theme worth a fixing pass: six of the seven production
modules (all but `shared.ts`) call their orchestrator through a direct static
import rather than an injected dependency. `shared.ts`'s
`makeSingleNameMarketplaceHandler` takes its `run` collaborator as a real
parameter, and `shared.test.ts` proves delegation exactly the way this
review's brief wants — a `strong-mock` with `exactParams: true`, a `when()`
stating the exact options bag, and `verify()` at the end. The other six
modules have no such seam, so their test suites cannot state that proof
against the orchestrator call and instead run the real orchestrator against a
hermetic filesystem plus a faked git port, reading back on-disk footprints and
exact notification text to infer that delegation happened correctly. That is
a well-reasoned, self-documented compromise (tracked in-file as decision
D-116-05's "Group A/B/C" split), not an oversight, and it still discriminates
a wrong implementation — but it couples six test modules to their
orchestrator's own message-rendering and state-mutation logic, which is
exactly the "hidden dependency" testability smell this review is asked to
prioritize. The fix is production-side: give each factory its orchestrator
call as an explicit parameter or `EdgeDeps` member, the same way `gitOps` and
`pluginUpdate` already are, and the same way `shared.ts` already does for
`run`. A smaller, second theme: one uncommented `as` cast (`shared.ts:131`)
and one data-driven loop with a conditional branch inside the generated test
body (`update.test.ts:349-407`).

## Unit test findings

### `tests/edge/handlers/marketplace/add.test.ts`

- **[WARNING] Delegation proved by running the real orchestrator, not by mocking it** —
  `lines 300-306`, `346-352`, `377-383`, `404-413`, `433-436` (representative;
  the pattern repeats in every case). `makeAddHandler` calls `addMarketplace`
  via a direct static import (`add.ts:16,38`), so no case can construct a
  `strong-mock` of the call itself. Instead every case runs the real
  `addMarketplace` against a hermetic filesystem, then asserts the exact
  rendered notification row (`USER_ADDED_ROW`/`PROJECT_ADDED_ROW`, e.g. `●
  seeded [user] (added)`) and the exact on-disk footprint
  (`state.json`/`claude-plugins.json`/`claude-plugins.local.json`
  existence). Both are `addMarketplace`'s own rendering and state-mutation
  contract, which `tests/orchestrators/marketplace/add.test.ts` should own; a
  change to that row grammar breaks this file even though `add.ts` itself
  did not change. Once `add.ts` takes `addMarketplace` as an explicit
  dependency (see the paired production finding), replace these footprint/row
  assertions with a `mock<typeof addMarketplace>({ exactParams: true })`
  stating the exact `{ ctx, pi, scope, cwd, rawSource, gitOps, local? }`
  argument and a `verify()` at the end, mirroring
  `shared.test.ts`'s `run` mock. The `git.state.calls.clone` and
  `networkCallCount()` assertions are correctly this module's own concern
  (proving `deps.gitOps` reached the workflow) and should stay.

### `tests/edge/handlers/marketplace/autoupdate.test.ts`

- **[WARNING] Delegation proved by running the real orchestrator, not by mocking it** —
  `lines 260-268`, `286-289`, `352-359`, `393-395`. Same root cause as
  `add.test.ts`: `setMarketplaceAutoupdate` is a direct static import
  (`autoupdate.ts:13,51`), so every delegating case runs the real workflow and
  asserts its exact rendered row (e.g. `● alpha [project] <autoupdate>`) plus
  the exact `claude-plugins.json`/`.local.json` byte content
  (`readConfigFootprint`), both of which are the orchestrator's own
  rendering/config-write-back contract. Fix alongside the `autoupdate.ts`
  production finding; once `setMarketplaceAutoupdate` is injected, assert the
  exact call instead of re-deriving its output shape.
- **[WARNING] Conditional branch inside a data-driven loop** — `lines 310-360`.
  The loop building `expectedProjectBase` differs between the `enable: true`
  row (no `plugins` key) and the `enable: false` row (`plugins: {}`) purely
  because the two rows exercise genuinely different orchestrator paths
  (no-op vs. real write-back). This is defensible as written since the
  difference is captured entirely in row data, not in a runtime `if` inside
  the test body — no action needed here; flagged only because it is the
  closest instance in this file to the loop-conditional anti-pattern and is
  worth a second look if the two rows' setup ever needs to diverge further
  (at that point split them into two named `test()`s instead of widening the
  row shape further).

### `tests/edge/handlers/marketplace/info.test.ts`

- **[WARNING] Delegation proved by running the real orchestrator, not by mocking it** —
  `lines 203`, `259`, `277-283`. `getMarketplaceInfo` is a direct static
  import forwarded into `makeSingleNameMarketplaceHandler` (`info.ts:10,21`),
  so `info.ts` itself has no seam a test can substitute. Every case runs the
  real workflow and asserts the exact rendered row, including the `path:`
  detail line, which is `getMarketplaceInfo`'s own projection logic. Fix
  alongside the `info.ts` production finding.

### `tests/edge/handlers/marketplace/list.test.ts`

- **[WARNING] Delegation proved by running the real orchestrator, not by mocking it** —
  `lines 152`, `174`, `197`, `216`. `listMarketplaces` is a direct static
  import (`list.ts:11,37`); every case runs the real workflow and asserts the
  exact rendered row set, which is `listMarketplaces`'s own rendering
  contract. Fix alongside the `list.ts` production finding.

### `tests/edge/handlers/marketplace/remove.test.ts`

- **[WARNING] Delegation proved by running the real orchestrator, not by mocking it** —
  `lines 256-257`, `294-295`, `334-335`, `354-355`. `removeMarketplace` is a
  direct static import (`remove.ts:16,37`); every case runs the real workflow
  and asserts the exact rendered row (including the multi-line `(failed)
  {invalid manifest}` abort message at line 82) and the exact
  `state.json` marketplace-name footprint, both owned by
  `removeMarketplace`. Fix alongside the `remove.ts` production finding.

### `tests/edge/handlers/marketplace/update.test.ts`

- **[WARNING] Delegation proved by running the real orchestrator, not by mocking it** —
  `lines 302-311`, `341-342`, `398-402`, `428-434`. `updateMarketplace` /
  `updateAllMarketplaces` are direct static imports (`update.ts:14-17,51,62`);
  every case runs the real workflow and asserts the exact rendered rows,
  which is the update workflow's own rendering contract. The
  `git.state.calls.fetch` and `networkCallCount()` assertions are correctly
  this module's own concern and should stay; only the notification-row
  assertions are the duplicated part. Fix alongside the `update.ts`
  production finding.
- **[WARNING] Conditional branch inside a data-driven loop** — `lines 349-407`.
  The `--scope <scope>` loop calls `when(() => pluginUpdate(...))` only
  `if (scope === "project")` (line 385), because the `user`-scope row never
  cascades a plugin update and the `project`-scope row always does. This is a
  genuine behavioral fork between the two rows, not incidental setup, so it
  reads as two different test shapes forced into one loop. Split this loop
  into two independently named `test()`s (`"updates the project scope alone
  ..."` / `"updates the user scope alone ..."`), each stating its own
  `pluginUpdate` expectation (or explicit absence of one) directly in the
  case body, per the rule that a conditional in a data-driven loop body
  belongs in separate named cases.

### Clean files

- `tests/edge/handlers/marketplace/shared.test.ts` — the one module in this
  area with a real injection seam (`run`), and its suite uses it exactly as
  the guidelines want: `strong-mock` with `exactParams: true`, an exact
  `when()` per case, and `verify()` after the result assertion. No findings.

## Production code findings

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts`

- **[BLOCKER] Orchestrator call is a hidden dependency, not an injected one** —
  `line 16` (`import { addMarketplace } from "../../../orchestrators/marketplace/add.ts";`),
  used at `line 38`. `add.ts` already injects `deps.gitOps` and
  `deps.pluginUpdate` through `EdgeDeps`, but the orchestrator function itself
  — the call this module exists to make — is a static import. That is the
  textbook hidden-dependency pattern: it is impossible for `add.test.ts` to
  state a `strong-mock` exact-argument proof against `addMarketplace` itself,
  forcing the test suite to run the real orchestrator instead (see the paired
  unit-test finding). Fix: add `addMarketplace` to the factory's parameters
  (either as a new `EdgeDeps` member or as an explicit third parameter to
  `makeAddHandler`, following the `run` parameter `shared.ts` already uses
  successfully), and call `deps.addMarketplace(...)` / the injected parameter
  instead of the module-level binding.

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts`

- **[BLOCKER] Orchestrator call is a hidden dependency, not an injected one** —
  `line 13` (`import { setMarketplaceAutoupdate } from "../../../orchestrators/marketplace/autoupdate.ts";`),
  used at `line 51`. Same defect and same fix as `add.ts` above: make
  `setMarketplaceAutoupdate` an explicit parameter/`EdgeDeps` member of
  `makeAutoupdateHandler`.

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts`

- **[BLOCKER] Orchestrator call is a hidden dependency, not an injected one** —
  `line 10` (`import { getMarketplaceInfo } from "../../../orchestrators/marketplace/info.ts";`),
  passed as the fixed `run` argument at `line 21`. `makeSingleNameMarketplaceHandler`
  itself accepts `run` as a real parameter, but `makeMarketplaceInfoHandler`
  hardcodes which function to supply, so a test of `info.ts` still cannot
  substitute a fake. Fix: take the delegate as a parameter of
  `makeMarketplaceInfoHandler(pi, getMarketplaceInfo)` (caller-supplied,
  mirroring how `edge/register.ts` already wires `pi`), so a test can pass a
  `strong-mock` in its place instead of the real orchestrator.

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts`

- **[BLOCKER] Orchestrator call is a hidden dependency, not an injected one** —
  `line 11` (`import { listMarketplaces } from "../../../orchestrators/marketplace/list.ts";`),
  used at `line 37`. Same defect and fix as `add.ts` above.

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts`

- **[BLOCKER] Orchestrator call is a hidden dependency, not an injected one** —
  `line 16` (`import { removeMarketplace } from "../../../orchestrators/marketplace/remove.ts";`),
  used at `line 37`. Same defect and fix as `add.ts` above.

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts`

- **[BLOCKER] Orchestrator calls are hidden dependencies, not injected ones** —
  `lines 14-17` (`import { updateAllMarketplaces, updateMarketplace } from "../../../orchestrators/marketplace/update.ts";`),
  used at `lines 51` and `62`. Same defect as `add.ts` above, for both
  exported orchestrator functions this module selects between. `gitOps` and
  `pluginUpdate` are already threaded through `EdgeDeps`; add both update
  functions the same way (or as explicit parameters) so a test can mock the
  selected call directly instead of running the real workflow end to end.

### `extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts`

- **[WARNING] Uncommented `as` cast** — `line 131`
  (`...(parsed as Readonly<Record<N, string>> & { readonly scope?: Scope }),`).
  The cast has a real reason — `parseCommandArgs`'s mapped return type,
  keyed by the generic `Entry["name"]` from a `Spec` inferred at the call
  site, does not automatically collapse to `Record<N, string>` across
  `openMarketplaceCommand`'s own `N` type parameter — but nothing in the
  function states that reason, so the assertion reads as unjustified. Add a
  one-line `//` comment directly above line 131 explaining that the cast
  bridges TypeScript's inability to unify the two generic scopes, per the
  style guide's rule that `as`/`!` need an obvious or commented reason.

### Clean files

(none additional — every production module in this area carries at least one
finding above)

## Not covered

- Coverage tooling (`node --test --experimental-test-coverage`,
  `npm run test:coverage:direct`) was not run, per this review's diagnostic
  constraint against running build/test commands. Branch/line coverage of
  each pair is asserted here only by reading the test bodies against the
  production control flow, not measured.
- `tests/edge/handlers/marketplace-seed.ts` and the cross-cutting test
  helpers it and these suites import (`tests/edge/handlers/notification-boundary.ts`,
  `tests/platform/git-ops-fake.ts`) were read for context but not reviewed —
  they are shared infrastructure outside this assignment's file list and, per
  the brief, owned by another reviewer.
