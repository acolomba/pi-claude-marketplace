# Orchestrators — marketplace add and update (git-source paths), update side — adversarial re-review

**Scope:** the update side of the area: `tests/orchestrators/marketplace/update.test.ts` (2,963 lines),
`tests/orchestrators/marketplace/update.messaging.test.ts` (879 lines), and their paired
production modules `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
and `update.messaging.ts`. The add side is owned by sub-agent a.
**First-pass file:** `unit-test-findings/orchestrators-marketplace-add-update.md`
**Clean files attacked:** 1 (`update.messaging.test.ts` — the only update-side entry on the
first pass's clean lists). Both production modules and `update.test.ts` additionally got a
full export-ownership and branch census even though they carried findings.
**Existing findings graded:** 9 (6 test-side, 3 production-side; add-side findings left to agent a)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 8 |
| Existing CONFIRMED | 8 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the clean lists

### `tests/orchestrators/marketplace/update.messaging.test.ts`

- **[BLOCKER] Each `UPDATE_CONTEXT.render` arm is exercised with exactly one argument
  combination, so three wiring mutations survive** — `test('renders an updated row with
  ordered reasons and both missing companions')` line 58, and the skipped/failed arm cases
  at lines 134 and 167.
  1. Swapping the two `.includes` calls at `update.messaging.ts:79-80`
     (`p.dependencies.includes("agents")` ↔ `p.dependencies.includes("mcp")`) leaves every
     case green: the only `render.updated` case sets `dependencies: ["agents", "mcp"]`
     (both flags true either way) with a both-false probe. No case in this file — or in
     `update.test.ts`, whose cascade fixtures all set `declaresAgents`/`declaresMcp` false —
     renders an updated row with exactly one dependency.
  2. Hardcoding the `mpScope` argument to `"user"` in the `skipped` and `failed` arms
     (`update.messaging.ts:90-91`) survives: both cases pass `mpScope === "user"` and a
     `"project"`-scoped plugin, so the fold direction is never varied per arm.
  3. On the `updated` arm the bracket-fold direction (`renderScopeBracket(p.scope, mpScope)`
     with `p.scope === mpScope`) is never exercised — only the partially-installed case
     covers a fold.
  This matters because the render map is a **verbatim copy** of the central
  `renderPluginRow` arms (the module's own comment, `update.messaging.ts:58-60`); drift
  between the copies is exactly what only this file can catch — `notify.test.ts` covers the
  central copy, not this one. Fix: add one `render.updated` case with
  `dependencies: ["agents"]`, a both-false probe, and `scope === mpScope` (kills mutations
  1 and 3 at once, expected string has `requires pi-subagents` but no `requires pi-mcp` and
  no bracket), and one folded-scope case each for `skipped` and `failed` (kills 2).
- **[WARNING] `cause` asserted by deep equality, not reference identity** —
  `test('prefers a typed failure reason and preserves its Error cause')`, line 648.
  `assert.deepStrictEqual` passes for a same-message clone (`new Error(cause.message)`),
  but the promise is the **original** error reference: the renderer walks the live
  `err.cause` chain for the 4-space trailer (`update.messaging.ts:120-123`), and a clone
  drops the chain. Add `assert.strictEqual(message.cause, cause)` after the deep compare.

## New findings — missed by the first pass in files that had findings

### `tests/orchestrators/marketplace/update.test.ts`

- **[BLOCKER] `updateAllMarketplaces` project-before-user iteration order is unpinned** —
  no case; mutation target `update.ts:240`.
  Flipping `["project", "user"]` to `["user", "project"]` leaves every case green. The four
  `updateAllMarketplaces` cases (lines 536, 2244, 2269, 2312) never populate both scopes at
  once: 536 and 2269 are empty-set, 2244 seeds user only, 2312 seeds project only. The
  order is a documented contract (`update.ts:238-239`, "project-first per MSG-GR-3 so
  same-name cross-scope stable-sort ties render project-before-user"). Add a case seeding
  one marketplace in each scope and `assert.deepStrictEqual(notifications, [projectRow,
  userRow])` against two hand-written full messages.
- **[BLOCKER] The `retryHint` ternary is asserted by nothing, anywhere** — cases at lines
  936 (`CR-05 / MU-5`) and 966 (`MU-5`); mutation target `update.ts:481`.
  Replacing `retryHint: cloneAdvanced ? "Retry the command." : ""` with `retryHint: ""`
  (or inverting it) leaves all cases green: both retry-hint cases assert only that the
  *notify bytes* lack the anchor text — true in every mutant, because the hint never
  renders (the tests' own comments at lines 958 and 1009 say so). The `cloneAdvanced`
  *message* ternary is pinned (line 1016 matches "clone advanced but manifest could not be
  persisted"), but the `retryHint` field is not, and `tests/shared/errors.test.ts` only
  tests the error class's field mechanics, not this producer. See the paired production
  finding below — the field has zero consumers, so the fix is a production decision first;
  if the field stays, the assertion requires either exposing the error to the caller or a
  seam, not a bytes check.
- **[WARNING] WR-02's "missing PRE manifest reads as changed" default is executed but
  never discriminated** — `test('validateManifestAtRoot: stale manifestPath and
  marketplaceRoot are corrected (lines 382-388)')`, line 2531; mutation target
  `update.ts:332-334`/`468`.
  This is the only case that reaches the ENOENT arm of `manifestContentKey` (the seeded
  `manifestPath` under `old-dir/` does not exist), and it asserts only "no error
  notification" plus the corrected paths. A mutant that makes an `undefined` PRE key
  compare as *unchanged* — rendering the lying `(skipped) {up-to-date}` when a manifest
  just materialized — passes. Add to this case:
  `assert.deepStrictEqual(notifications, [{ message: "● stale-mp [project] (updated)" }])`.
- **[WARNING] `reasonsFromCascadeError`'s direct `instanceof InvalidMarketplaceManifestError`
  disjunct is reachable but untested** — mutation target `update.ts:625`.
  Deleting the first disjunct leaves all cases green: the ATTR-10 cases (lines 1121, 1158)
  reach only the wrapped-cause disjunct (the error arrives inside `MarketplaceUpdateError`),
  and no cascade case rejects with a raw `InvalidMarketplaceManifestError`. Reachable —
  `cascadeAutoupdates` passes the raw thrown error. Add a cascade case whose `pluginUpdate`
  rejects with `new InvalidMarketplaceManifestError(...)` and assert the full
  `(failed) {invalid manifest}` row.
- **[WARNING] `refreshUrlClone`'s `err.cause === undefined` overwrite guard is untested** —
  mutation target `update.ts:389`.
  Every test HttpError carries no `cause`, so dropping the guard (clobbering a pre-existing
  cause with the no-provider line) survives. Reachable by a real isomorphic-git error
  carrying a cause. Add a 401 case whose thrown HttpError has `cause: new Error("inner")`
  and assert the trailer renders "inner", not the no-provider line.
- **[WARNING] Duplicated strip-and-reattach auth workaround, plus a fake-internals poke** —
  `makeMockGitOps`, lines 83-103.
  The `fetch` wrapper destructures `auth` off the options before delegating to
  `createGitOpsFake` and re-attaches it to the recorded call — the same workaround
  `add.test.ts:139-152` carries for `clone`, both existing because the shared fake
  `structuredClone`s options that can carry a function-bearing auth bundle
  (META-FINDINGS already names the root cause in `tests/platform/git-ops-fake.ts`). Fix the
  shared fake once; both wrappers shrink to pass-throughs. Separately, line 94's
  `Reflect.deleteProperty(git.state.localRefs, ...)` reaches into the fake's internal state
  to simulate "SHA not on remote" instead of seeding through the fake's contract — the fake
  wants a way to express that scenario.
- **[WARNING] fs.watch-based TOCTOU case is timing-dependent** — `test('silently stops when
  the marketplace vanishes after preflight')`, lines 2921-2963.
  The rename must land between lock acquisition and the guard's fresh `loadState`; a late
  watcher event makes `notifications` non-empty and the case **fails** (a flake), it does
  not falsely pass — so this is a determinism hazard, not a lying test. A deterministic
  version needs a state-io/guard seam that does not exist; record the tension rather than
  patching the test. Cleanup via `testContext.after` is correct.
- Note (duplicate, not counted): line 1939 calls `resetCompletionCache()` — a consumer of
  the known test-only production reset hook (META-FINDINGS leverage item 2, owned by the
  `shared/completion-cache` area). This file must be updated when that fix lands.

## Production code findings (new)

### `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`

- **[WARNING] `retryHint` is write-only and its comments claim a consumer that does not
  exist** — line 481; comments at lines 29, and test-side 925/958/1009.
  `grep` over `extensions/` finds no reader of `.retryHint` outside the error class's own
  constructor (`shared/errors.ts:219-223`). "remains on the error for programmatic
  inspection" describes nothing in the codebase. Either delete the stamp (and the errors.ts
  field, if nothing else uses it — check other producers first) or give it a real consumer
  (e.g. render it); then the BLOCKER above becomes assertable. This is the "doc comment
  that lies" category the adversarial brief names.
- **[WARNING] Undocumented `err as Error` cast in the failure row** — line 704,
  `cause: err as Error`. The catch receives `unknown`; a non-Error escaping
  `snapshotAfterRefresh` (e.g. from `loadMergedScopeConfig`) would be stamped into a field
  typed `Error`. Either narrow with `err instanceof Error ? err : new Error(String(err))`
  or add the one-line comment justifying why only Errors can reach here.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`

- **[WARNING] Observationally dead branch in `narrowFailReason`** — lines 299-303.
  `if (text.includes("unreadable")) { return "unreadable manifest"; }` is immediately
  followed by `return "unreadable manifest";` — both paths return the same value, so the
  conditional has no observable effect and no test can distinguish it (the cases at
  `update.messaging.test.ts:833` and `:857` pass with or without it). Delete the `if`; the
  fallthrough already covers it. (Reachable, but redundant — not the unreachable or
  compiler-forced categories.)

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `update.ts` | `updateMarketplace` | `update.test.ts:337` and ~35 further cases | owned |
| `update.ts` | `updateAllMarketplaces` | `update.test.ts:530, 2210, 2258, 2280` | owned (scope-order gap above) |
| `update.ts` | `UpdateMarketplaceOptions` (type) | structurally checked by every call literal | owned |
| `update.ts` | `UpdateAllMarketplacesOptions` (type) | structurally checked by every call literal | owned |
| `update.messaging.ts` | `UPDATE_CONTEXT` | `update.messaging.test.ts:39, 58, 97, 134, 167` | owned (arm-wiring gap above) |
| `update.messaging.ts` | `outcomeToCascadePluginMessage` | `update.messaging.test.ts:206-879` (26 cases) | owned |
| `update.messaging.ts` | `UpdateRowMsg` (type) | `satisfies` positives + 2 `@ts-expect-error` negatives, lines 13-37 | owned |

No orphan or incidentally-covered exports on the update side.

## Branch census

`update.ts` (paired cases named where covered):

- `manifestContentKey` ENOENT→`undefined`: **reachable, executed, consequence unasserted**
  (finding above). Non-ENOENT rethrow: covered (`WR-02` case, line 1020).
- `isAuthChallengeError` non-Error arm: covered (string-rejection case, line 403); 401/403/500
  discrimination: covered (lines 337, 370, 650).
- `refreshUrlClone` cause-overwrite guard: **reachable-untested** (finding above).
- `refreshRecord` github/url/path/else source arms: all covered (543, 585, 771, 2348).
  Catch message ternary: both sides covered (936, 966). `retryHint` ternary: **unasserted**
  (finding above). `lastUpdatedAt` stamp: covered byte-exact under mocked Date (2280-2346).
- The two `eslint-disable no-unnecessary-condition` directives (lines 476, 480): compiler-forced
  (callback-set `cloneAdvanced` defeats narrowing), commented, reasons hold — D-116-01a category,
  not findings.
- `snapshotAfterRefresh` TOCTOU record-undefined arm: covered by a real lock-file watcher
  (2921) — genuinely reached, end state asserted.
- `cascadeAutoupdates` gate and catch: covered (1262, 1317, 2042, 2093, 2131, 2173), including
  the non-Error rejection and the `typedReasons === undefined` spread omission.
- `reasonsFromCascadeError`: all four `PluginShapeError.shape.kind` arms covered by the
  data-driven loop (2766-2849) with full-message `deepStrictEqual`; direct
  `InvalidMarketplaceManifestError` disjunct **reachable-untested** (finding above); wrapped
  disjunct covered (1121, 1158); `transportReason` delegate covered (337, 370, 690, 1233,
  2042, 2093). EPERM and ENOTDIR share arms with tested EACCES/ENOENT — same-arm, not gaps.
- `refreshOneMarketplace`: catch/failed-row covered; silent-undefined return covered;
  cache-cleanup swallow covered both ways (1929 success, 2851 failure with residue+retry
  convergence); OFF no-op/changed covered (543, 716, 771); ON no-op gate covered in three
  directions (1779 both-hold, 1833 condition-B-fails, 1530 skipped-excluded via the real
  `updateSinglePlugin`); cascade-rows emission covered.
- `updateAllMarketplaces`: empty-targets covered (530, 2258); **scope enumeration order
  uncovered** (finding above).
- `validateManifestAtRoot` conditional repointing: covered (2531).

`update.messaging.ts`: every branch of both narrowers and all four switch arms covered;
the only uncovered "branch" is the observationally-dead `unreadable` conditional (production
finding above).

## Grading of first-pass findings

### `tests/orchestrators/marketplace/update.test.ts`

- **CONFIRMED** — hand-rolled `ctx`/`pi` doubles behind casts instead of `strong-mock` —
  verified at lines 177-190; the sibling pattern exists at `add.test.ts:186-218`
  (`mock<ExtensionContext>({ exactParams: true, ... })`). Sibling drift exactly as recorded.
- **UNDERSTATED** — fragment/regex message assertions (BLOCKER) — real, severity fits, but
  the cluster is larger than the recorded list. Add three cases the first pass missed:
  lines 1717-1729 (`CMC-26` — `indexOf` ordering checks leave the marketplace header and
  the reload trailer unpinned; dropping the header line survives), lines 2024-2031 (the
  newly-degraded envelope case — `indexOf("● auto-mp [project]")` matches regardless of the
  header's status token, so `(updated)` → `(skipped)` survives), and lines 2755-2762
  (`WR-12` — row bytes and severity pinned, header unpinned). ~23 cases, not ~20; same fix
  rule as recorded.
- **CONFIRMED** — missing state-side assertion in the MU-5 partial-refresh failure case
  (966-1018) — only notification bytes asserted; a `loadState` read pinning an unbumped
  `lastUpdatedAt` is missing exactly as recorded.
- **CONFIRMED** — two-plus-one cases fall through to the real `DEFAULT_GIT_OPS` (536, 798,
  2312-2319) — verified all three omit `gitOps` and provably reach no `GitOps` method today.
  Sharpen the fix: the file's own `makeForbiddenGitOps()` (line 137) is the right injection —
  it fails loudly on any unplanned git call, which is stronger than a permissive memory fake
  and is already this file's convention for its strongest cases (2823, 2866, 2942).
- **CONFIRMED** — `260525-cjr B2:` ticket-style title prefixes at 2042, 2093, 2131 —
  date-plus-initials, not a durable spec ID.
- **CONFIRMED** — direct `@earendil-works/pi-coding-agent` type import at line 45 bypassing
  `platform/pi-api.ts` — `add.test.ts` imports through the wrapper.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`

- **CONFIRMED** — hidden `new Date()` at line 472 — and the cost is visible: two cases
  (2280, 2851) must fake `Date` via `t.mock.timers` to pin state bytes, exactly the
  "faking Date where an injected clock would do" smell the guidelines name.
- **CONFIRMED** — undocumented `as ParsedSource` at line 402 — no adjacent comment justifies
  why the persisted record's `source` needs the cast.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`

- **CONFIRMED** — switch comment claims an `assertNever` that is not there (lines 133-135;
  no `default` arm in the function) — the exhaustiveness today rests solely on TS
  control-flow narrowing; comment and code disagree exactly as recorded.

## Still clean after attack

- `tests/orchestrators/marketplace/update.messaging.test.ts` — apart from the two findings
  above, this file kills every mutation I ran: label/key-order changes on `UPDATE_CONTEXT`
  (line 39 compares both, ordered); version-arrow operand swap (line 82's exact string);
  severity mutations on **every** projection arm (deepStrictEqual includes `severity` in all
  26 cases); optional-field deletion/addition (`Object.hasOwn` negatives for `version`,
  `from`, `to`, `cause`, `reasons` at 164, 233, 296, 424, 451, 657-659, 685); the
  typed-reason-over-notes precedence in both directions (427, 454, 629, 662); every
  notes-substring branch of both narrowers including the WR-06 empty-notes and
  unknown-note fallbacks; the partially-installed-vs-updated selection on empty
  `partialDegrade.kinds` (268); the `newlyDegraded` severity ternary both ways (299, 329);
  reason emit order orphan→malformed→dropped (359-399); and input immutability (post-render
  deepStrictEqual of the message at 84, 122, 155, 192).
- Strengths of `update.test.ts` worth protecting during the rewrite: the first ~700 lines
  and the late data-driven `PluginShapeError` loop (2766-2849) assert whole hand-written
  messages; the D-14 sequence and detached-HEAD cases pin exact `forceUpdateRef`/`checkout`
  arguments; `makeForbiddenGitOps` gives real silence proofs; state files are compared as
  whole objects byte-for-byte (2329-2345, 2890-2916); and the TOCTOU case reaches the
  guard-race branch with a real lock-file watcher rather than a seam.

## Not covered

- No test, coverage, or lint command was run (per the brief); all conclusions are from
  reading, plus read-only `grep`.
- The add side (`add.test.ts`, `add.messaging.test.ts`, `add.ts`, `add.messaging.ts`) —
  agent a's assignment. I read `add.test.ts:100-240` only to verify the sibling-drift and
  duplicated-workaround claims.
- `orchestrators/marketplace/shared.ts`, `tests/platform/git-ops-fake.ts`, and
  `orchestrators/plugin/update-row.ts` were read only far enough to settle contracts the
  update-side files depend on; not scored here.
- The `_fixtures/` directories were treated as opaque, as in the first pass.

## Meta-findings impact

### New cross-cutting evidence

- **`withHermeticHome` is hand-rolled in at least 12 unit-test files** (plus one
  integration file): `tests/orchestrators/{marketplace/{update,list,autoupdate,info},plugin/{install,update,uninstall,reinstall,info,list,enable-disable}}.test.ts` and
  `tests/architecture/cross-op-convergence.test.ts`. META-FINDINGS lists the
  `backfill`/`pending` duplicated helper but not this much larger duplication. One shared
  helper beside the orchestrators' test concern would delete ~12 copies; the copies have
  already drifted (this file's carries a macOS ENOTEMPTY retry comment others may lack).
- **The git-ops-fake auth strip-and-reattach workaround is duplicated, not singular.**
  META-FINDINGS records it only for `add.test.ts` (clone); `update.test.ts:83-103` carries
  the same workaround for `fetch`, and `makeMockGitOps` wrappers exist in 9 test files.
  Fixing `tests/platform/git-ops-fake.ts` to accept function-bearing `auth` pays off in at
  least two files immediately; the other 7 wrappers should be checked for the same shape.
- **Write-only structured error fields.** `MarketplaceUpdateError.retryHint` is stamped
  (`update.ts:481`), documented as "for programmatic inspection", and read by nothing.
  Other typed error classes' structured fields should be audited for zero-consumer fields —
  the same doc-comment-lies class META-FINDINGS records for reset hooks, now on error
  contracts.
- **`updateSinglePlugin` hides a `process.cwd()` read.** `update.test.ts:1434-1442`
  documents it at length and contorts two cases into user scope to dodge it. The
  orchestrators-plugin-update area should be checked for whether this hidden dependency is
  flagged; the sanctioned fix is an explicit `cwd` parameter, which would also let these
  two marketplace-side cases use project scope naturally.

### Corrections to META-FINDINGS.md

- The fragment-assertion table row "`orchestrators/marketplace/update.test.ts` — ~20 cases,
  several with no other check" is directionally right but low: the cluster is ~23 once the
  `indexOf`-ordering and unpinned-header cases (1717-1729, 2024-2031, 2755-2762) are
  included. A refinement, not a contradiction.

### Confirmations

- **Sibling drift `update.test.ts` vs `add.test.ts` (hand-rolled doubles vs `strong-mock`)**
  — confirmed at source: `update.test.ts:177-190` (`as ExtensionContext` casts) vs
  `add.test.ts:186-218` (`mock<...>({ exactParams: true })` with `when`/`verify`).
- **"Whole-message assertion — any `*.messaging.test.ts`" as the reference implementation**
  — independently confirmed from the attack side: `update.messaging.test.ts` survived
  every mutation class except two narrow wiring/identity gaps, which is the strongest
  clean-file result available. The propagation direction META-FINDINGS recommends is right.
- **"Offline fake that fails loudly on unplanned input" as a pattern to propagate** —
  this file already contains its own local version (`makeForbiddenGitOps`, line 137) and
  uses it in its strongest cases, which both confirms the pattern's value and gives the
  DEFAULT_GIT_OPS-fallthrough fix a zero-invention target.
