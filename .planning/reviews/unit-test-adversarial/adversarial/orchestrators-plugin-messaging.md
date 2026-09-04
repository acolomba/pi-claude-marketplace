# Orchestrators — plugin messaging modules — adversarial re-review

**Scope:** all 8 `extensions/pi-claude-marketplace/orchestrators/plugin/*.messaging.ts`
modules and all 8 paired `tests/orchestrators/plugin/*.messaging.test.ts` files, read in
full (4,872 lines), plus the `shared/notify.ts` composers they call
(`pluginRow`, `installedLikeRow`, `partiallyInstalledRow`, `render*Row`,
`renderScopeBracket`, `composeReasons`, `renderPluginRow`), `shared/errors.ts`
(`PluginShapeErrorShape`), `orchestrators/marketplace/shared.ts`
(`cascadeUnstagePlugin`, `narrowCascadeFailure`), `orchestrators/plugin/uninstall.ts`
(`narrowCascadeFailure`), `orchestrators/plugin/list.ts` (the row builder), and
`tests/architecture/notify-producer-wire-coverage.test.ts`.
**First-pass file:** `unit-test-findings/orchestrators-plugin-messaging.md`
**Clean files attacked:** 10 (4 test + 6 production)
**Existing findings graded:** 6

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 4 |
| New WARNING (missed by first pass) | 8 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 0 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area was **directionally right and materially
incomplete**. Its four findings all hold, but it reviewed each module against itself and
so never asked whether the modules agree with the shared composers they claim to be
byte-identical to. Two of the six "clean" production modules carry defects that only show
up when you read them against a sibling: one is a live user-visible mislabel.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` (first pass: clean)

- **[BLOCKER] `narrowDisableFailure` mislabels an AG-5 foreign-content unstage failure as
  `{unreadable}`; no case feeds it that error** — production `line 201`, test gap in
  `tests/orchestrators/plugin/enable-disable.messaging.test.ts` (cases at lines 318–377)

  `narrowDisableFailure` dispatches only on `isErrnoException(cause)` and falls through to
  `["unreadable"]`. Both sibling narrowers it claims parity with dispatch on
  `AgentsUnstageFailureError` first and return `"source mismatch"`:
  `orchestrators/plugin/uninstall.ts:168-175` and
  `orchestrators/marketplace/shared.ts:613-620` (whose comment reads "Aligned with
  uninstall.ts's mapping … so the two cascade-failure narrowers do not drift").
  `narrowDisableFailure`'s own doc comment at `enable-disable.messaging.ts:196-199` states
  the invariant it violates: *"The full taxonomy is duplicated locally … the two should
  drift together."* They have not.

  This is reachable, not theoretical. `enable-disable.ts:357` calls
  `cascadeUnstagePlugin`; that function throws `AgentsUnstageFailureError`
  (`marketplace/shared.ts:345`) on AG-5 foreign agent content and its own catch converts
  the throw into `{ ok: false, cause: <that error> }` (`marketplace/shared.ts:375-386`);
  `enable-disable.ts:1317` feeds exactly that `cause` to `narrowDisableFailure`. So
  `/claude:plugin disable` renders `⊘ <plugin> (failed) {unreadable}` where `uninstall`
  and `marketplace remove` render `{source mismatch}` for the identical condition — the
  precise falsehood ATTR-09 / D-47-B exists to prevent ("could not read it" when it was
  read and found to be owned by someone else).

  **Fix (production):** add, as the first arm of `narrowDisableFailure`,
  `if (cause instanceof AgentsUnstageFailureError) { return ["source mismatch"]; }`, and
  import `AgentsUnstageFailureError` from `../marketplace/shared.ts`. Better: delete all
  three copies and have `enable-disable.messaging.ts`, `uninstall.ts` and
  `marketplace/shared.ts` call one exported narrower (the `marketplace/shared.ts` one,
  which already lives beside the error class for exactly this reason — see its header at
  `marketplace/shared.ts:597-602`), with `narrowDisableFailure` reduced to
  `[narrowCascadeFailure(cause)]`.

  **Fix (test):** add a case to `enable-disable.messaging.test.ts` following the shape of
  `narrowDisableFailure classifies EACCES as permission denied` (line 318):
  arrange `new AgentsUnstageFailureError("Failed to remove 1 agent(s): reviewer: foreign", [])`,
  act `narrowDisableFailure(cause)`, assert
  `assert.deepStrictEqual(reasons, ["source mismatch"])`.

- **[WARNING] The duplicated cascade-failure taxonomy is the root cause, and its own doc
  comment names it** — `line 196-199`. Three copies of the errno ladder exist
  (`enable-disable.messaging.ts:201`, `uninstall.ts:168`, `marketplace/shared.ts:613`),
  two of which have already diverged. Fold them into the single exported
  `narrowCascadeFailure` as above; the comment promising manual lockstep is what failed.

### `tests/orchestrators/plugin/enable-disable.messaging.test.ts` (first pass: only the `actual` naming WARNING)

- **[BLOCKER] `staleGateDropped ignores a non-partialable structural failure` does not
  discriminate `partialable`** — `lines 503–518`

  Surviving mutation: delete the `cause.shape.partialable` conjunct from
  `enable-disable.messaging.ts:156`. All six `staleGateDropped` cases stay green. This
  case is the only one that claims to guard that conjunct, and its fixture also carries
  `unsupportedKinds: []` (line 510), so the `undefined` it asserts is produced by the
  empty-narrowing arm at `enable-disable.messaging.ts:167` regardless of `partialable`.
  The other five cases are non-`PluginShapeError`, wrong `kind`, or `partialable: true`.

  **Fix:** change the fixture at line 505-511 to
  `{ kind: "not-installable", plugin: "delta", reasons: ["contains lspServers"], partialable: false, unsupportedKinds: ["lspServers"] }`.
  `PluginShapeErrorShape` (`shared/errors.ts:514-531`) permits that combination, and it
  makes `partialable` the sole discriminator: with the conjunct present the case returns
  `undefined`; with it deleted it returns `["lsp"]`.

### `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` (first pass: clean) and `tests/orchestrators/plugin/list.messaging.test.ts` (first pass: clean)

- **[BLOCKER] The `partially-installed` arm bypasses the SOLE composition site, and the
  test pins the divergence** — production `lines 124–125`, test `lines 222–256`

  `list.messaging.ts` composes its `(partially-installed)` row with
  `pluginRow(ICON_PARTIALLY_INSTALLED, p, mpScope, "(partially-installed)", probe)`.
  Every other producer of that row calls `partiallyInstalledRow`: the central switch
  (`shared/notify.ts:2669`), `install.messaging.ts:121`, `update.messaging.ts:74`,
  `enable-disable.messaging.ts:85`, `marketplace/update.messaging.ts:89`,
  `reconcile.messaging.ts:202`. `partiallyInstalledRow`'s own doc calls itself the "SOLE
  composition site for the `(partially-installed)` row" (`shared/notify.ts:2246`) and
  `tests/architecture/partial-vocabulary-guard.test.ts:183-186` repeats the claim. The
  claim is false as of `list.messaging.ts:124`.

  The behavioural delta: `partiallyInstalledRow` threads `p.dependencies` into
  `composeReasons`, so `{requires pi-subagents}` / `{requires pi-mcp}` can append;
  `pluginRow` hard-codes both flags `false` and drops them.
  `PluginPartiallyInstalledMessage` declares `dependencies?`
  (`shared/notify.ts:991`), so the divergence is structurally live. It is **latent today**
  — `list.ts:552-561` builds the row without `dependencies` — but the list test at line
  224-232 constructs exactly the row `list.ts` cannot produce (`dependencies: ["agents",
  "mcp"]`, probe both `false`) and asserts the markers are absent (line 251-254). That
  case therefore *fails* if the arm is converged onto `partiallyInstalledRow`, so the test
  actively blocks restoring the invariant.

  Also: the arm's comment at `list.messaging.ts:123` ("Body lifted verbatim from the
  central renderPluginRow arm") is now untrue, and is a lineage narration
  `.claude/rules/typescript-comments.md` forbids.

  **Fix:** change the arm to `"partially-installed": (p, probe, mpScope) => partiallyInstalledRow(p, mpScope, probe)`;
  drop `ICON_PARTIALLY_INSTALLED` from the import if it becomes unused; replace the
  comment with a present-tense statement of what the arm does. Then delete
  `dependencies: ["agents", "mcp"]` from the test fixture at line 227 and from the
  post-act `deepStrictEqual` literal at line 246 — the expected bytes on line 252-253 stay
  identical, because the row `list.ts` actually produces has no dependencies.

- **[WARNING] No gate proves any command render map agrees with the central
  `renderPluginRow` switch** — all 8 module headers
  (`install.messaging.ts:35`, `reinstall.messaging.ts:36`, `update.messaging.ts:21`,
  `uninstall.messaging.ts:15`, `enable-disable.messaging.ts:26`, `list.messaging.ts:83`,
  `fetch.messaging.ts:51`, `info.messaging.ts:59`) assert their arms are "byte-identical
  to" / "lifted VERBATIM from" that switch. Nothing checks it — no test imports both
  `renderPluginRow` and a `*_CONTEXT`, and `notify-producer-wire-coverage.test.ts:1-6`
  explicitly scopes itself to severity/reload parity, disclaiming row bytes. The finding
  above is the first proven divergence. **Fix:** add one architecture case that, for each
  status a command map and the central switch both handle, renders the same message
  literal through both and compares the strings — a real parity assertion, not a comment.

### `tests/orchestrators/plugin/reinstall.messaging.test.ts` (first pass: only the `REINSTALL_CONTEXT` WARNING)

- **[BLOCKER] The CMC-21 per-scope no-collapse grouping key is unpinned** — the grouping
  loop at `reinstall.messaging.ts:159-171`, cases at test `lines 518, 532, 609`

  Surviving mutation: change `const key = ` `${outcome.scope}:${outcome.marketplace}` to
  `outcome.marketplace`. Every case stays green. `renderReinstallPartitionAndNotify` is
  the sole consumer and this file is its sole test (grep: no other test file references
  it). The documented contract at `reinstall.messaging.ts:150-151` — "Two different scopes
  for the same marketplace name render as two separate marketplace blocks (CMC-21:
  per-scope rendering, no collapse)" — has no discriminating case, because the only
  multi-block fixture (line 555-598) uses three *distinct* marketplace name strings
  (`"acme"`, `"Acme"`, `"Beta"`). Dropping `scope` from the key leaves those three keys
  distinct.

  **Fix:** add a case beside the sort case at line 532. Arrange two outcomes with the
  identical marketplace string `"official"`, one `scope: "project"` and one
  `scope: "user"`, and expect a message containing two blocks,
  `● official [project]` and `● official [user]`, each with its own row. Written that
  way, dropping `scope` from the key collapses them into one block and the case fails.

- **[WARNING] `narrowReasons` returns a frozen array on one path and a mutable one on the
  other; the test asserts frozen-ness on exactly the three paths where it holds** —
  production `reinstall.messaging.ts:383-392`, test `lines 441-454`

  The early return at line 384 is a bare `return []`; the loop path returns
  `Object.freeze(reasons)` (line 392). `narrowReasons preserves every exact known note…`
  (line 477), `…applies cached-manifest…fallbacks` (line 499) and `…preserves duplicates…`
  (lines 514-515) each assert `Object.isFrozen(...) === true`; the empty-input case at
  line 441 asserts `deepStrictEqual` and identity but conspicuously omits the frozen
  check — the one place it would fail. **Fix:** make the contract uniform in production
  (`return Object.freeze([]);` at line 384, matching `dependenciesFromOutcome`'s
  `Object.freeze` at line 366), then add `assert.equal(Object.isFrozen(absent), true)` and
  the same for `empty` at line 452.

- **[WARNING] `toolInfo` and the `toolNames` parameter are dead test support, and the
  companion-loaded path is never exercised** — `lines 62-74`, `line 78`

  `createNotifyHarness`'s `toolNames` defaults to `[]` and no call site passes it (lines
  520, 534, 611), so `toolInfo` never executes and the `typebox` / `ToolInfo` imports
  (lines 5, 25) exist only for it. Every case therefore runs with
  `pi.getAllTools() === []`, i.e. both companions unloaded
  (`platform/pi-api.ts:129-135`), which is why line 539 expects
  `{requires pi-subagents, requires pi-mcp}`. **Fix:** either delete `toolInfo`, the
  `toolNames` parameter and the two imports, or — better — add one case passing
  `["subagent", "mcp"]` and expecting the same `(reinstalled)` row with **no** soft-dep
  brace, which is the assertion that makes `toolInfo` earn its keep.

- **[WARNING] The cascade cases assert notify's reducer output, which a sibling file
  owns** — `lines 535-553, 612-617`. The expected literals include the severity summary
  line, the `Plugin reinstall: 1 failure, 1 warning, 3 successes` tally and the
  `/reload to pick up changes` trailer — all computed by `notifyWithContext` /
  `shared/notify.ts`, not by `reinstall.messaging.ts`.
  `tests/architecture/notify-producer-wire-coverage.test.ts:1-6` declares itself the owner
  of exactly that ("Command-local labels, render arms, and exact row bytes belong to the
  corresponding mirrored presenter owners"). This is defensible as an integration
  assertion, but it should be a deliberate choice, not an accident: either keep it and
  note in the file header that these cases intentionally pin the wire form, or trim the
  expectations to the block-and-row lines this module composes.

### `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` (first pass: clean)

- **[WARNING] `UninstallMsg` is the only command-local message union not exported, so its
  test types fixtures against the central shapes instead** — production `line 31`, test
  `tests/orchestrators/plugin/uninstall.messaging.test.ts:7-10`

  Seven siblings export theirs (`ListMsg`, `InstallMsg`, `UpdateMsg`, `ReinstallMsg`,
  `FetchMsg`, `EnableMsg`/`DisableMsg`, `PluginInfoCascadeMsg`) and their tests
  `satisfies` against it. `uninstall.messaging.test.ts` instead imports
  `PluginUninstalledMessage` and `PluginFailedMessage` from `shared/notify.ts` (lines
  7-10), so nothing in the pair pins uninstall's own union. **Fix:** add `export` to line
  31 and retype the two fixtures (lines 35, 70) as `satisfies UninstallMsg`, matching
  `update.messaging.test.ts:73`.

### `tests/orchestrators/plugin/install.messaging.test.ts` (first pass: clean)

- **[WARNING] The documented load-bearing arm order between the `"source"` substring arm
  and the errno arm is unpinned** — production `install.messaging.ts:555-560`, test
  `describe("narrowResolverReasons")`, `lines 732-863`

  Surviving mutation: move the `errnoReasonFromNote` block (line 559) above the
  `reason.includes("source")` block (line 555). All 22 cases stay green, because no
  fixture note contains both an errno token and the substring `source`
  (`"ENOENT: no such file"`, `"ENOTDIR: path component is not a directory"`,
  `"source directory does not exist"`). `narrowResolverReasons`'s doc (lines 563-585)
  numbers these arms 2 and 3 and `classifyResolverReason`'s doc (line 511) says "Arm order
  is load-bearing".

  The file already knows how to pin an ordering: `gives malformed MCP precedence over an
  embedded parse-error phrase` (line 797) uses a note matching *both* arms. **Fix:** add a
  sibling case with a note matching both, e.g.
  `"ENOENT: no such file or directory, open '/plugins/source/plugin.json'"`, asserting
  `["unsupported source"]`.

- **[WARNING] No `@ts-expect-error` structural negatives on `InstallMsg` /
  `EntityErrorRow`** — whole file. `list.messaging.test.ts:11-26` (3),
  `update.messaging.test.ts:11-42` (3), `info.messaging.test.ts:11-22` (2) and
  `reinstall.messaging.test.ts:27-49` (2) all open with `satisfies` negatives that pin the
  union's exclusions. `install.messaging.test.ts`, `enable-disable.messaging.test.ts`,
  `fetch.messaging.test.ts` and `uninstall.messaging.test.ts` carry none. **Fix (all
  four):** add the two highest-value negatives per union — one for a required field
  omitted, one for a field the variant structurally excludes — copying the form at
  `update.messaging.test.ts:20-42`.

### `tests/orchestrators/plugin/fetch.messaging.test.ts` (first pass: only the `actual` naming WARNING)

- **[WARNING] The only file in the set that never re-asserts the row after `act`; its six
  existence checks assert the fixture, not the module** — `lines 50, 71, 91, 111, 133, 156`

  `assert.equal(Object.hasOwn(row, "needsReload"), false)` is trivially true: `row` is an
  `as const` literal declared four lines above that never had a `needsReload` key, and no
  render arm writes to its input. Seven siblings follow the arranged literal with
  `assert.deepStrictEqual(row, { …literal… })` (e.g. `list.messaging.test.ts:72-78`,
  `update.messaging.test.ts:84-92`), which proves non-mutation *and* subsumes every
  `Object.hasOwn` check. **Fix:** replace the six `Object.hasOwn` lines with the sibling
  post-act `deepStrictEqual` against the hand-written literal. The same replacement
  applies to the `Object.hasOwn` lines that sit *beside* a `deepStrictEqual` in
  `list.messaging.test.ts` (lines 80, 151, 219, 255, 286, 315, 347, 378),
  `update.messaging.test.ts` (93, 94, 203), `enable-disable.messaging.test.ts` (64-66,
  102, 135, 209-211, 283, 314-315) and `uninstall.messaging.test.ts` (54-55) — there they
  are redundant rather than vacuous, so this is a cleanup, not a defect.

### Grouped across the area

- **[WARNING] `assert.equal` / `assert.deepEqual` in 5 of 8 files (62 sites) where 3
  siblings use the explicit strict forms** — `enable-disable.messaging.test.ts` (24),
  `fetch.messaging.test.ts` (15), `update.messaging.test.ts` (10),
  `uninstall.messaging.test.ts` (9), `reinstall.messaging.test.ts` (4).

  **This is not a correctness defect and must not be filed as one.** Every file imports
  `node:assert/strict`, under which `assert.equal === assert.strictEqual` and
  `assert.deepEqual === assert.deepStrictEqual` (verified:
  `node -e "const a=require('node:assert/strict'); a.equal===a.strictEqual"` → `true`).
  It is a readability drift from `install.messaging.test.ts`,
  `list.messaging.test.ts` and `info.messaging.test.ts`, which use the explicit forms
  exclusively and match the skill's wording. **Fix:** mechanical rename of the 62 call
  sites to `strictEqual` / `deepStrictEqual`.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `install.messaging.ts` | `INSTALL_CONTEXT` | `install.messaging.test.ts:22` + 6 render cases (46–187) | owned |
| `install.messaging.ts` | `InstallMsg` (type) | `install.messaging.test.ts:57,84,107,129,152,176` (`satisfies`) | owned |
| `install.messaging.ts` | `EntityErrorRow` (type) | `install.messaging.test.ts:203,238,278,310,346,380,411` | owned |
| `install.messaging.ts` | `composeInstallFailureMessage` | `install.messaging.test.ts:191–573` (12 cases) | owned |
| `install.messaging.ts` | `formatOrchestratedCause` | `install.messaging.test.ts:577,588` | owned |
| `install.messaging.ts` | `classifyEntityShapeError` | `install.messaging.test.ts:606–729` (5 cases) | owned |
| `install.messaging.ts` | `narrowResolverReasons` | `install.messaging.test.ts:751–862` (22 cases) | owned |
| `install.messaging.ts` | `classifyInstallFailure` | `install.messaging.test.ts:866,885` | owned |
| `reinstall.messaging.ts` | `REINSTALL_CONTEXT` | — (transitive only, via `renderReinstallPartitionAndNotify` at 532/609) | incidental — see grading |
| `reinstall.messaging.ts` | `ReinstallMsg` (type) | `reinstall.messaging.test.ts:33,40` | owned |
| `reinstall.messaging.ts` | `renderReinstallPartitionAndNotify` | `reinstall.messaging.test.ts:518,532,609` | owned |
| `reinstall.messaging.ts` | `reinstalledRowFromOutcome` | `reinstall.messaging.test.ts:102,131,163,192` | owned |
| `reinstall.messaging.ts` | `outcomeToPluginMessage` | `reinstall.messaging.test.ts:221–439` (9 cases) | owned |
| `reinstall.messaging.ts` | `narrowReasons` | `reinstall.messaging.test.ts:441,456,480,502` | owned |
| `enable-disable.messaging.ts` | `ENABLE_CONTEXT` | `enable-disable.messaging.test.ts:17` + 4 render cases | owned |
| `enable-disable.messaging.ts` | `DISABLE_CONTEXT` | `enable-disable.messaging.test.ts:17` + 3 render cases | owned |
| `enable-disable.messaging.ts` | `EnableMsg` / `DisableMsg` (types) | `enable-disable.messaging.test.ts:45,81,115,157,190,225,262,295` | owned |
| `enable-disable.messaging.ts` | `staleGateDropped` | `enable-disable.messaging.test.ts:453–546` (6 cases) | owned, 1 weak (BLOCKER above) |
| `enable-disable.messaging.ts` | `narrowEnableFailure` | `enable-disable.messaging.test.ts:379–451` (5 cases) | owned |
| `enable-disable.messaging.ts` | `narrowDisableFailure` | `enable-disable.messaging.test.ts:318–377` (5 cases) | owned, 1 arm missing in production |
| `list.messaging.ts` | `LIST_CONTEXT` | `list.messaging.test.ts:28` + 10 render cases | owned |
| `list.messaging.ts` | `ListMsg` (type) | `list.messaging.test.ts:11-26` + every fixture | owned |
| `update.messaging.ts` | `UPDATE_CONTEXT` | `update.messaging.test.ts:44` + 5 render cases | owned |
| `update.messaging.ts` | `UpdateMsg` (type) | `update.messaging.test.ts:11-42` + every fixture | owned |
| `fetch.messaging.ts` | `FETCH_CONTEXT` | `fetch.messaging.test.ts:11` + 6 render cases | owned |
| `fetch.messaging.ts` | `FetchMsg` (type) | `fetch.messaging.test.ts:39,60,80,100,122,145` | owned |
| `info.messaging.ts` | `PLUGIN_INFO_CONTEXT` | `info.messaging.test.ts:24,39,64,92` | owned |
| `info.messaging.ts` | `PluginInfoCascadeMsg` (type) | `info.messaging.test.ts:11-22,45,72,100` | owned |
| `uninstall.messaging.ts` | `UNINSTALL_CONTEXT` | `uninstall.messaging.test.ts:12,26,58` | owned |
| `uninstall.messaging.ts` | `UninstallMsg` (type) | — | **NOT EXPORTED** (WARNING above) |

No export in the area is unowned. The one incidental entry (`REINSTALL_CONTEXT`) is
covered byte-exactly through the cascade, which is why the first pass's finding about it
is graded OVERSTATED below.

## Branch census

**Reachable and untested — findings:**

- `enable-disable.messaging.ts` — the `AgentsUnstageFailureError` arm **does not exist**
  and its condition is reachable from `enable-disable.ts:1317`. BLOCKER above.
- `enable-disable.messaging.ts:156` — the `cause.shape.partialable` conjunct is reachable
  but not discriminated by any case. BLOCKER above.
- `reinstall.messaging.ts:160` — the `outcome.scope` half of the grouping key is
  reachable but not discriminated. BLOCKER above.
- `install.messaging.ts:555 vs 559` — the ordering between the two arms is reachable
  (a note carrying both an errno token and `source`) and untested. WARNING above.
- `list.messaging.ts:124` — the `dependencies`-bearing `partially-installed` row is
  reachable through the type (`shared/notify.ts:991`) though not through `list.ts` today.
  BLOCKER above.

**Unreachable by real input (production, defensive, tested anyway):**

- `enable-disable.messaging.ts:167` — `narrowed.length > 0 ? narrowed : undefined`. The
  comment states it is unreachable today and explains why the contract is enforced rather
  than assumed; `enable-disable.messaging.test.ts:453,470` exercise it through an empty /
  absent `unsupportedKinds`. Correctly handled — do not delete.
- `install.messaging.ts:493-507` `errnoReasonFromNote` — documented as a defensive
  fallback for notes already serialised by deeper helpers; all four arms are tested at
  `install.messaging.test.ts:744-749`. Correctly handled.
- `reinstall.messaging.ts:443` `narrowReason`'s `"unreadable"` last resort — reachable and
  tested (`reinstall.messaging.test.ts:297`).

**Compiler-forced, not removable (D-116-01a class):**

- `install.messaging.ts:409` — the implicit `undefined` return after
  `classifyEntityShapeError`'s exhaustive `switch`. Under `tsconfig.json`'s
  `noImplicitReturns: true`, adding a `PluginShapeErrorShape` member makes that path
  reachable and raises TS7030. Not testable, not a gap.
- `reinstall.messaging.ts:345` — the same shape for `outcomeToPluginMessage`'s
  `switch (outcome.partition)`, whose return type is the non-nullable `ReinstallMsg`.
- `install.messaging.ts:465` — `narrowUnsupportedKinds([token])[0]` is
  `ContentReason | undefined` solely because of `noUncheckedIndexedAccess`; the detection
  gate two lines above admits only `"lspServers"`, which always maps to `"lsp"`.

## Grading of first-pass findings

### `tests/orchestrators/plugin/enable-disable.messaging.test.ts`

- **CONFIRMED** — Placeholder variable name `actual` — the 25 enumerated line numbers are
  all correct and complete; only the stated total is off by one (the finding says "24
  occurrences" but lists 25, and `grep -c 'const actual'` returns 25). The proposed split
  (`row` for the 8 render outputs, `reasons` for the 17 narrower results) is the right
  one.

### `tests/orchestrators/plugin/fetch.messaging.test.ts`

- **CONFIRMED** — Placeholder variable name `actual` — 6 sites, verified.

### `tests/orchestrators/plugin/uninstall.messaging.test.ts`

- **CONFIRMED** — Placeholder variable name `actual` — 2 sites, verified.

### `tests/orchestrators/plugin/reinstall.messaging.test.ts`

- **OVERSTATED** — `REINSTALL_CONTEXT` is never imported or asserted directly. Real, but
  the recorded remedy buys nothing. The three assertions it proposes are all already
  guaranteed or already covered: `Object.keys(REINSTALL_CONTEXT.render)` cannot deviate
  from `ReinstallStatus`, because `REINSTALL_RENDER` is annotated
  `{ [K in ReinstallStatus]: RenderFn<…> }` (`reinstall.messaging.ts:70-72`) — a missing
  key is TS2741 and an extra key is an excess-property error on the literal; the
  `Messaging.label` string *is* asserted, appearing verbatim as
  `Plugin reinstall: 1 failure, 1 warning, 3 successes` at
  `reinstall.messaging.test.ts:549`; and all four render arms are asserted byte-for-byte
  at lines 539-547 and 616. Correct severity: **informational, no action**. The same
  compiler argument applies to the seven sibling "exports the complete … context" cases —
  their only non-redundant assertion is the label. Do not propagate this pattern.

### `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`

- **CONFIRMED (WARNING), with a correction to the stated rationale** — `switch` on a
  closed union has no `default` group, `line 366`. The Google-style rule is real and the
  fix as written is correct (`assertNever` is exported from `shared/errors.ts:26`). But
  the *risk* framing must not be inherited from META-FINDINGS §5: this omission is **not**
  the silent-omission class. `tsconfig.json:11` sets `noImplicitReturns: true`, so adding
  a `PluginShapeErrorShape` member makes the post-switch fall-through reachable and the
  build fails with TS7030 — the same mechanism the repo already recorded in
  "Missing switch arm fails under noImplicitReturns". Fix it for style consistency, not
  because a union member could be added silently.

### `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`

- **CONFIRMED (WARNING), same correction** — `switch` on a closed union has no `default`
  group, `line 276`. `outcomeToPluginMessage` returns the non-nullable `ReinstallMsg`, so
  a new `partition` member is a compile error before it is a runtime gap.

## Still clean after attack

- `tests/orchestrators/plugin/info.messaging.test.ts` — the strongest file in the set for
  its size. Mutations it catches: swapping `ICON_UNINSTALLABLE` for any other glyph (line
  61); changing the `(skipped)` label; dropping `p.reasons` from `composeReasons` (line
  89); passing `p.scope` instead of `undefined` — both scope-bracket branches are pinned,
  the fold at line 79 (`scope: "project"`, `mpScope: "project"` → no bracket) and the
  emission at line 107 (`project` vs `user` → `[project]`); breaking hash-version
  rendering (`hash-2ea95f85703d` → `v#2ea95f8`, line 117); emitting a `{}` brace for an
  empty reasons array (line 61); and mutating the input row (post-act
  `deepStrictEqual` plus an exact `Object.keys` check at line 60).
- `tests/orchestrators/plugin/install.messaging.test.ts` — apart from the one arm-order
  gap above, it withstood every mutation I tried. Notably it catches the subject-identity
  mutation deliberately: `classifyEntityShapeError` fixtures set the thrown error's
  `plugin` to `"thrown-name"` while the context passes `"helper"` (lines 623-644), so
  reading `err.shape.plugin` instead of `ctx.plugin` fails. It also catches all four
  branch-precedence mutations in `composeInstallFailureMessage` (containment over
  rollback at line 191, rollback over entity at 229), the `authReason`-suppresses-`cause`
  rule (lines 435, 465 vs 493), non-`Error` wrapping in `classifyInstallFailure`
  (`deepStrictEqual` compares Error prototypes, so returning a plain `Error` for a
  `PluginShapeError` fails at line 878), and the `\n\n` join in `formatOrchestratedCause`
  (line 598). Its `narrowResolverReasons` block is a correct data-driven loop: one sibling
  `test()` per row, title interpolated, no conditional in the body.
- `tests/orchestrators/plugin/list.messaging.test.ts` — catches per-arm glyph and token
  swaps across all ten arms, `renderVersion`'s sha form (`sha-123456789abc` → `v#1234567`,
  line 189), soft-dep marker injection on the `installed` arm and its absence on the eight
  hard-coded-`false` arms, the same-scope fold (line 274, `scope: "user"` /
  `mpScope: "user"` → no bracket) against the cross-scope emission in five other cases,
  input non-mutation on every case, and render-map key **order** (line 51, unsorted). It
  survives the arm-swap mutation for every pair of arms sharing a composer.
- `tests/orchestrators/plugin/update.messaging.test.ts` — catches `composeVersionArrow`
  argument transposition (line 83), the hash-pair arrow form (line 121), reasons ordered
  before soft-dep markers (line 121), the `partially-installed` arm's `dependencies`
  threading (line 159 — the marker fires, which is exactly the assertion `list` is
  missing), the same-scope fold on `skipped` (line 193) against cross-scope emission on
  three other arms, and per-row optional-field omission. One narrow gap: the `updated`
  arm's `mpScope` argument is never exercised in the fold direction (line 97's fixture is
  `scope: "project"` / `mpScope: "user"`, line 63's carries no `scope`), so hard-coding
  `"user"` there survives — low value, but a one-line fixture change closes it.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{fetch,info,update}.messaging.ts`
  — genuinely clean after attack. Every arm delegates to a shared composer with no local
  composition, and each surface's deliberate `undefined`-reasons decision is pinned by a
  case that arranges `reasons` and asserts they are dropped
  (`fetch.messaging.test.ts:38/49` for `available`, `99/110` for `remote`) — the strongest
  form of that assertion in the area.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts` — clean
  apart from the unexported union.

## Not covered

- No command was run against the tree beyond read-only `grep` / `wc` and one throwaway
  `node -e` in `/tmp` confirming the `node:assert/strict` aliases. Per-pair coverage was
  not measured; every coverage claim above is from reading plus mutation reasoning.
- I did not review `shared/notify.ts` as a whole (it belongs to the `shared` area). I read
  only the ~400 lines of row composers this area calls, plus `renderPluginRow`'s switch.
- I did not verify whether the `AgentsUnstageFailureError` disable path is covered
  end-to-end by `tests/orchestrators/plugin/enable-disable.test.ts` (a different area). If
  it is, that suite is asserting the wrong reason token and should be corrected alongside
  the production fix.

## Meta-findings impact

### New cross-cutting evidence

**1. "SOLE composition site" doc claims in `shared/notify.ts` are unverified, and at least
two are already false.** This is a new instance of META-FINDINGS' "Gates that do not gate"
class, and of its "doc comments that lie" shape — but it sits in production, not in the
architecture suite.

- `partiallyInstalledRow` (`shared/notify.ts:2246`) calls itself the "SOLE composition
  site for the `(partially-installed)` row". `list.messaging.ts:124` composes that row
  with `pluginRow` instead.
- `installedLikeRow` (`shared/notify.ts:2287-2299`) calls itself the "SOLE composition
  site for the soft-dep-bearing `installed` / `updated` / `reinstalled` plugin rows" and
  says it "folds the 7 command-arm copies". The central `renderPluginRow` switch does
  **not** call it — its `installed` (2596), `updated` (2614) and `reinstalled` (2632) arms
  each inline their own `joinTokens([...])` block. Three live second copies.

Both claims are load-bearing: the whole `*.messaging.ts` design rests on "call, never
duplicate" (D-11). **Other areas to check for the same shape:**
`orchestrators/marketplace/*.messaging.ts`, `orchestrators/reconcile/reconcile.messaging.ts`
(the other `partiallyInstalledRow` callers), and the `shared` area, which should own the
`installedLikeRow` half. Recommend one architecture case that renders each shared status
through both the command map and `renderPluginRow` and compares the strings — the same
"plant the violation, don't read the config" rule the repo already states.

**2. A duplicated-taxonomy comment that asks for manual lockstep is a reliable predictor of
drift.** `narrowDisableFailure`'s comment says "the two should drift together"; it has
three copies and two of them already diverged, producing a user-visible wrong reason token.
`marketplace/shared.ts:597-602` describes the same failure mode in the past tense ("a
narrower kept apart from the error it narrows is how two cascade-failure mappings drift").
**Worth a repo-wide grep** for comments of the form "duplicated locally", "kept in step",
"must follow in lockstep", "mirrors … verbatim" — `install.messaging.ts:473-476` carries
another one (`isHooksResolverNote` vs `shared/probe-classifiers.ts::narrowResolverNotes`),
though that one *is* gated, by
`tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`. The distinguishing
question is whether a named test enforces the pairing; where none is named, expect drift.

**3. A weak case can be created by an over-specified fixture, not only by a weak
assertion.** `staleGateDropped ignores a non-partialable structural failure` has a
`deepStrictEqual`-grade assertion and a precise title, and still fails to discriminate,
because its fixture satisfies a *second* rejection path. This shape is invisible to a
"look for `assert.ok`" sweep. **Suggested check for other areas:** for every case whose
title says "ignores X" / "rejects X" / "gives Y precedence", confirm the fixture differs
from a passing fixture in exactly the one field named in the title.

### Corrections to META-FINDINGS.md

**Correction 1 — §"Ranked by leverage" item 1 overstates the cause.** The claim is:
> "Because no test can construct a full SDK object, every caller fakes one and forces it
> past the compiler."

`tests/orchestrators/plugin/reinstall.messaging.test.ts:80-82` constructs
`mock<ExtensionContext>({ exactParams: true })`, `mock<ExtensionAPI>(…)` and
`mock<ExtensionContext["ui"]>(…)` with **no casts at all**, and drives the real
`notifyWithContext`. So does `tests/architecture/notify-producer-wire-coverage.test.ts:53-55`,
and ten-plus other files (`grep -n "mock<ExtensionContext>" tests/ -r`). Constructing the
wide type is not the blocker — `strong-mock` handles it. The 187 `as never` casts in
`tests/shared/notify.test.ts` (measured; the file says 178) come from that file choosing
hand-rolled object literals over `strong-mock`, which is a different and cheaper fix.
**Correction:** keep the narrowing recommendation (it is still right), but drop the
"no test can construct it" justification and add the alternative remedy — convert
`notify.test.ts` to the `strong-mock` harness its two siblings already use. That may
dissolve the largest single cluster without touching production at all.

**Correction 2 — §"Ranked by leverage" item 5 misclassifies two of its four members.** It
says the missing `default`/`assertNever` arms are "the silent-omission class: adding a
member to a closed set compiles clean at every derivation site." For
`orchestrators/plugin/install.messaging.ts:366` and
`orchestrators/plugin/reinstall.messaging.ts:276` that is false. `tsconfig.json:11` sets
`noImplicitReturns: true`; both switches are the last statement of a value-returning
function with no trailing `return`, so a new union member makes the fall-through reachable
and the build fails with TS7030 — the mechanism the repo already recorded under
"Missing switch arm fails under noImplicitReturns". These two are style-consistency
findings, correctly rated WARNING by the first pass. The two `reconcile` BLOCKERs may or
may not share the property; **check whether each of those switches is the terminal
statement of a value-returning function before planning them together with these two.**

### Confirmations

- **"The correct form already exists next door … every `*.messaging.test.ts` file compares
  whole hand-written strings against the same message catalogue" (§3).** Confirmed
  independently and strongly: across all 8 files in this area I found **zero**
  `.includes()` / `.startsWith()` / partial-regex content checks, and ~60 hand-written
  expected row strings. The cascade cases in `reinstall.messaging.test.ts:535-553` extend
  this to a full 16-line multi-line message. This area is a valid reference
  implementation for the fragment-assertion fix.
- **"Strict interaction mocking (`exactParams: true`, exact args, explicit `verify()`)"
  reference row.** Confirmed for `tests/orchestrators/plugin/reinstall.messaging.test.ts`:
  every mock is created inside `createNotifyHarness` with `exactParams: true` and a role
  name, every expectation carries a definite count (`.once()` / `.twice()`), there is no
  `It.isAny()` / `anyTimes()` / `verifyAll()`, and all three mocks are verified at the end
  of the case after the act. Add this file to that row.
- **"The dominant shape: sibling drift."** Confirmed as the dominant shape here too, and
  it accounts for 10 of my 12 new findings. In this area the drift is one-file-against-
  seven in every instance (list's composer, uninstall's unexported union, fetch's missing
  post-act assertion, four files missing type negatives, five files using the non-explicit
  assert aliases), which makes each fix a copy from a named sibling rather than a design
  decision.
