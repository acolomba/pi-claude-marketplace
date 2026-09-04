# Orchestrators — plugin info (slice B) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/info.test.ts` lines 2279–4197 (D-96-03 degradation
matrix, disabled/manifest-absent skip accounting ENBL-16/ENBL-17 D-100-03/07, MSG-GR-3
mixed runs, INFO-12/NFR-5 zero-network arms 3070–3418, D-96-04 reported-not-carried-out
`--fetch`, SURF-01/D-63-04 through the ADMIT-02 block), plus the arms of
`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` those cases exercise
(`buildBlock` arm (b), `buildStateOnlyInstalledRow`, `composeStateOnlyComponents`,
`readStateOnlyHookEntries`, `parseHooksForInfo`, `applyDisabledRowShape`,
`DISABLED_ROW_REASONS`, `skipReasonFor`, `wrapBlock`, `buildFetchSkipBlock`,
`autoupdateDetails`, `emitFetchSkip`, and the `getPluginInfo` notify sequencing).
Supporting context read: test-file helpers (1–700), the D-100-03 ladder cases
(2052–2278), the h/h2 failed-row pins (920–960, 6312–6353), the seam helper
(5036–5043), `shared/probe-classifiers.ts` in full, the `PluginEntry` schema, and
`persistence/state-io.ts::isRecordedButDisabled`.
**First-pass file:** `unit-test-findings/orchestrators-plugin-info.md`
**Clean files attacked:** 0 declared (the first pass listed no clean files for this
area); instead every production arm the slice exercises was attacked with the mutation
catalogue directly.
**Existing findings graded:** 8 (4 test + 4 production)

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 6 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the mutation attack

### `tests/orchestrators/plugin/info.test.ts`

- **[BLOCKER] The skip-note-before-failed-block ordering is never tested; reordering
  `emitFetchSkip` past the failed loop survives every case** — `info.ts:2363–2373`,
  no covering case anywhere in the 6,980-line file.
  `getPluginInfo`'s two-scope path promises: info cascade first, then the fetch-skip
  note, then each failed block (`emitFetchSkip(opts, scopes, built)` at 2368 runs
  BEFORE the `for (const failure of failedBlocks)` loop at 2371, and the comment at
  2363–2367 declares the order load-bearing). A run that produces all three exists:
  both scopes hold `mp`; project scope seeds `manifest: { plugins: [] }` plus an
  enabled installed record (skip source under `--fetch`), user scope seeds
  `manifest: { plugins: [] }` with no record (BOUND-02 `(failed)`). That run emits
  THREE notifications — but `grep` shows zero `makeCtx(3)` and zero
  `notifications[2]` in the whole file. Swapping lines 2368 and 2370–2373 leaves the
  entire suite green: the mixed-run cases (2996, 3713) have no failed block, and the
  h2 fan-out case (6312) has no skip note. Add one case with the fixture above,
  `makeCtx(3)`, and `assert.deepEqual(notifications, [...])` pinning all three
  messages and severities in order (the exact literals are all already written in
  sibling cases: `STATE_ONLY_BLOCK`, the skip note, and the 6344–6350 failed block).

- **[BLOCKER] `DISABLED_ROW_REASONS` membership is untested beyond two of six members —
  a set-shrink mutation survives** — `info.ts:939–946`; covering cases exist only for
  `not in manifest` (`info.test.ts:2632` and siblings) and `source missing`
  (`info.test.ts:2784`).
  Shrinking the set to `{"not in manifest", "source missing"}` leaves all 129 cases
  green. Two of the four unpinned members are reachable by real input:
  a DISABLED record with a traversal hooks slug (the disabled twin of the enabled
  case at 2365) must render `{not in manifest, unreadable}`, and a disabled record
  whose materialized hooks file gets EACCES (the disabled twin of 2471, via
  `withFsPromiseFault`) must render `{not in manifest, permission denied}` — the
  test-file comment at 2749–2757 states this exact contract ("the failure class
  SURVIVES the disabled row's reason narrowing") but only the `source missing` cell
  of the matrix has a case. Add the two disabled twins with full-byte
  `assert.equal` pins, copying the enabled fixtures at 2365/2471 and adding
  `disabled: true`. (The other two members are unreachable — see Branch census.)

- **[WARNING] Fixture files read with cwd-relative paths; the sibling computes the
  path from `import.meta.url`** — `lines 4078, 4120`
  (`await readFile("tests/fixtures/ralph-wiggum-hooks.json", "utf8")` and the
  hookify twin). These are the only reads in the file whose resolution depends on
  the test process's working directory being the repo root. The sibling that does
  it right: `tests/domain/components/hooks.test.ts:19` derives
  `FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url))` and resolves
  `../../fixtures/hookify-hooks.json` from it. Propagate that form to both sites.

- **[WARNING] `console.error` replaced by direct assignment and `process.env`
  restored via `finally` instead of the test context** — `lines 2428–2434`
  (NFR-10 debug-log case). The case saves/restores correctly, but the replacement
  is a bare global assignment in a `test()` callback that takes no `t` parameter;
  the sanctioned tool is `t.mock.method(console, "error", ...)` (auto-restored) plus
  `t.after()` for the `PI_CLAUDE_MARKETPLACE_DEBUG` restore. Root cause is
  production: `shared/debug-log.ts::hookDebugLog` reads `process.env` and writes
  `console.error` with no injectable seam, so the test has nothing to inject —
  same shape as the `withFsPromiseFault` finding the first pass already logged.
  The seam belongs to the `shared/debug-log.ts` area; the test-side fix here is
  mechanical (`t.mock.method` + `t.after`).

- **[WARNING] `readStateOnlyHookEntries`' multi-slug discard semantics are untested** —
  `info.ts:487–529`; no case seeds `resources.hooks` with two slugs.
  The loop iterates "defensively for forward-compat" (D-57-03) and the doc comment
  promises "a failure returns immediately and discards entries collected from
  earlier slugs" (469–470). `state.json` is external input, so a two-slug record is
  reachable. Mutating the catch to `continue` (returning a half-listed block, the
  "worse lie" the comment names) survives every case. One case with
  `hooks: ["good", "bad"]`, a parseable file for `good` and none for `bad`,
  asserting the row renders `{not in manifest, source missing}` with NO `hooks:`
  block, pins both the discard and the failure precedence.

### `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`

- **[WARNING] A disabled row silently drops the `unparseable` hooks-read failure,
  contradicting the file's own "failure class survives" rule; the exclusion's
  rationale is factually wrong** — `lines 934–937` (rationale), `939–946` (set),
  `501` (the producer).
  `DISABLED_ROW_REASONS`' doc comment excludes `unparseable` because "both name a
  marketplace-manifest defect, and a block that could not read its manifest never
  reaches this shape (arm (a) returns first)". That is true for the
  manifest-`unparseable` but false for the hooks-container one:
  `readStateOnlyHookEntries` returns `{kind: "degraded", reason: "unparseable"}`
  for a malformed MATERIALIZED hooks file (line 501), which is a fact about disk in
  exactly the sense the ENBL-16/D-96-03 contract says must survive. Result: a
  disabled, manifest-absent record renders `{not in manifest, source missing}` when
  its container is MISSING (tested, 2758) but a bare `{not in manifest}` when the
  container is CORRUPT — silence reading as verified absence of hooks, the precise
  conflation the discriminated `StateOnlyHookRead` exists to prevent (its own
  comment, 461–465). Escalate to the operator: either add `unparseable` to
  `DISABLED_ROW_REASONS` (and add the disabled twin of the 2328 case), or keep the
  exclusion and rewrite the 934–937 rationale to truthfully document that a corrupt
  container is hidden on disabled rows. Do not leave the current comment.

- **[WARNING] Doc comment names a test file that does not exist** — `line 1124`.
  `buildStateOnlyInstalledRow`'s NFR-5 paragraph says the zero-call suite lives in
  `tests/orchestrators/plugin/info-manifest-absent.test.ts`. No such file exists
  (`ls tests/orchestrators/plugin/` — the cases live in `info.test.ts` 3091–3416).
  Two OTHER areas carry the same phantom reference:
  `tests/architecture/catalog-uat.test.ts:3532` and
  `tests/edge/handlers/marketplace-seed.ts:10` — evidently a planned/former split
  file that was merged into `info.test.ts`, leaving three stale pointers. Fix the
  path in all three comments (this file owns only line 1124; the other two belong
  to their areas). This matters doubly because the repo's source-walk gates and
  reviewers navigate by these names.

- **[WARNING] `JSON.parse.bind(JSON, "null")` where a plain arrow works** —
  `line 398` (`const noopCompileIf: () => null = JSON.parse.bind(JSON, "null");`).
  `.bind(` is on the google-style quick-scan list and has no stated justification;
  it also allocates a fresh bound function per `parseHooksForInfo` call, so there
  is no reuse rationale. Replace with `const noopCompileIf = (): null => null;`
  (clearer, and immune to the bound-`JSON.parse` quirk where an argument passed to
  the callback would be treated as a reviver).

## Export ownership census

`info.ts` has exactly three exports (`grep -n "^export"`):

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `info.ts` | `getPluginInfo` | 129 cases in `info.test.ts` | owned |
| `info.ts` | `GetPluginInfoOptions` (interface) | every case's call site (compile-time) | owned incidentally — acceptable for an options type consumed by the owned function |
| `info.ts` | `InfoCloneCacheSeam` (interface) | `info.test.ts:53` import + `fetchSeamWith` return type (5036) | owned |

No orphaned exports. The former `__test_narrowProbeError` re-export is gone (its
orphaned comment is the first pass's finding, confirmed below).

## Branch census

Production branches in the slice's arms, classified:

- **Reachable, untested:** the two `DISABLED_ROW_REASONS` members `unreadable` and
  `permission denied` on a disabled row (new BLOCKER above); the
  `readStateOnlyHookEntries` multi-slug discard path (new WARNING above); the
  combined skip+failed three-notify sequencing (new BLOCKER above); the disabled ×
  corrupt-container cell (`unparseable` filtered — behavior itself untested in
  either direction, tied to the production WARNING above).
- **Unreachable by real input:** `DISABLED_ROW_REASONS` members
  `network unreachable` and `authentication required` (`info.ts:944–945`). Both
  tokens are produced only by `foldFetchOrProbeError` (fetch-context paths), and a
  disabled installed record's fetch is declined at `info.ts:856`
  (`blockFetchCtx = isRecordedButDisabled(installed) ? undefined : fetchCtx`)
  before any probe runs; `narrowProbeError` (`shared/probe-classifiers.ts:37–66`)
  can never return them. They are dead set members — harmless, but the 924–946
  comment presents the set as the reachable reason vocabulary, which these two
  members are not. Candidate for removal or a one-line "defensively included"
  note when the operator rules on the `unparseable` question.
- **Compiler-forced:** none observed in the slice's arms. The exhaustive
  `switch (resolved.state)` returns (`buildNonInstallableRowFields`,
  `isLocallyResolvable`) are the repo's deliberate no-default exhaustiveness idiom,
  not gaps.

Well-covered branches (verified, see Still clean): all four `skipReasonFor`
combinations, both `wrapBlock` skip arms, the `emitFetchSkip` early return and
one-row-per-scope grouping, the `blockFetchCtx` disable gate, the
`composeStateOnlyComponents` record/file/empty-key ladder, the containment-refusal
path with debug log, and the EACCES→`permission denied` classification.

## Grading of first-pass findings

### `tests/orchestrators/plugin/info.test.ts`

- **UNDERSTATED** — *33 of 129 cases assert only a regex fragment* — real and
  correctly BLOCKER, but the list is incomplete: `line 3635`
  (`D-96-04: a --fetch run on a name in NEITHER manifest nor records emits NO skip
  note`) is a 34th member inside this slice — it asserts only
  `includes("(failed) {not in manifest}")` + a negative + severity, while the full
  expected literal is already written in the sibling at 940–951 (bare-info twin) and
  6344–6350. The two in-slice members of the original list (3776, 3920) were
  verified by reading: both are real (3776 pins only two rows of a two-scope
  cascade whose full bytes are computable; 3920 is match/doesNotMatch only).
- **CONFIRMED** — *`verify()` hidden in a shared `finally`* — verified at 238
  (module-scope array), 260–264 (push in `makeCtx`), 282–284 (drain in
  `withHermeticHome`'s `finally`). Aggravating in-slice instance worth adding to
  the fix list: the case at `lines 3623–3626` asserts only inside
  `for (const n of notifications)` — vacuous when `notifications` is empty — so its
  "exactly one notification" claim rests entirely on the hidden `verify(ui)`; when
  the verify moves inline (the first pass's fix), that case also needs an explicit
  `assert.equal(notifications.length, 1)`.
- **CONFIRMED** — *`startsWith` where full equality was cheap (3557–3560)* — the
  fixture is byte-identical to `STATE_ONLY_BLOCK` (3085); the proposed
  `assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK)` fix is correct.
- **CONFIRMED** — *lower-bound-only call-count assertions (5105, 5374, 5439–5440)* —
  out of this slice's line range but verified by reading those lines:
  `assert.ok(gitState.cloneCalls.length >= 1, ...)` shape confirmed at all four
  sites; a double-clone caching regression would pass.

### `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`

- **CONFIRMED** — *dangling comment for removed `__test_narrowProbeError` export
  (2376–2378)* — the comment is the file's last three lines; no export follows;
  repo-wide grep for the symbol returns nothing.
- **CONFIRMED** — *redundant `as Record<string, unknown>` casts (838, 845, 1319)* —
  schema verified: `PLUGIN_ENTRY_SCHEMA` declares `source: Type.Unknown()`,
  `dependencies: Type.Optional(Type.Unknown())`, and skills/commands/agents all
  `Type.Optional(Type.Unknown())` (`domain/components/plugin.ts:30–32, 66, 83`), so
  the casts add nothing.
- **CONFIRMED** — *`homedir()`/`process.cwd()` hidden reads in the hooks readers
  (397, 437)* — verified, including the sibling contrast (`readStateOnlyHookEntries`
  threads `cwd` at 499 while `readHookSummaryEntries` hardcodes `process.cwd()` at
  437 with an honest inertness comment).
- **CONFIRMED** — *no injectable fs port forces `withFsPromiseFault` global
  monkeypatching* — verified: direct `readdir`/`readFile` imports at line 27; the
  test helper at 72–105 rewires `fs.promises` via `Object.defineProperty` +
  `syncBuiltinESMExports`. The `InfoCloneCacheSeam` precedent (148–152) is the
  right in-file template for an `fsOps` seam.

### First-pass NFR-5 section

The behavioral-half analysis held up under attack: the in-slice zero-call cases
(3091, 3145, 3188, 3249, 3333) pin all five counters at zero AND the full rendered
bytes, so a guard that reached zero by emptying the block fails. The claim that
`no-orchestrator-network.test.ts` owns the wrong-import half was re-verified.

## Still clean after attack

Mutations the slice's cases genuinely catch (all verified against specific pins):

- `skipReasonFor` swaps and drops — `already disabled` vs `not in manifest` and the
  `manifestAbsent` flag are each pinned by exact skip-note bytes (2843, 2913, 3437)
  and by the no-note controls (2970, 3565, 3588, 3635).
- Removing the `blockFetchCtx` disable gate (`info.ts:856`) — the declared-disabled
  `--fetch` case (3333) pins zero clone/fetch/credential calls plus both messages.
- Threading `fetchCtx` into the state-only arm — the INFO-12 counter cases (3091,
  3145, 3188) go red; the signature-level guarantee is backed by assertions that
  can fail, exactly as the production comment claims.
- Skip-row multiplication or cause-grouping — 2843 counts `(skipped)` occurrences;
  2996 and 3713 pin whole multi-scope messages including project-first order.
- Autoupdate-marker drift between the info header and the skip-note header — 3480
  (ON, both headers `<autoupdate>`) and 3529 (OFF, bare note header) pin both halves.
- Pluralized summary line — "A plugin operation needs attention." vs "Some plugin
  operations need attention." pinned by 3437 vs 3713.
- Disabled row shape — status override and lsp-token suppression pinned with
  row-scoped negatives on top of full equality (2647, 2694); the declared-disabled
  control (2797) proves `{not in manifest}` derives from the lookup, not from
  disabled-ness.
- Hooks record/file precedence — the D-100-03 ladder (2062, 2113, 2159, just above
  the slice) seeds DIVERGENT record and file content, so "wrong source read"
  produces different bytes; the empty-`hookEntries` case kills the
  `undefined || length === 0` mutant.
- Containment refusal — 2365 (refused before read, block still renders, full pin)
  and 2415 (debug line named) catch both the guard removal and the log removal.
- Reason ordering — 2516 pins the three-reason `{not in manifest, lsp, source
  missing}` order.
- Hooks block placement and grammar — 3840 pins `commands:`/`hooks:`/`mcp:`
  ordering with declaration-order entries; ADMIT-02 (4058, 4100, 4148) pins
  Stop/StopFailure bare-supported rendering byte-for-byte.
- `makeMockGitOps`/`makeMockCredentialOps` naming is sanctioned by this repo's
  CONVENTIONS.md (`makeMock*` factory prefix) — not a finding despite the generic
  skill rule.

## Not covered

- Lines 1–2278 and 4198–6980 of `info.test.ts` belong to the sibling slices; I read
  the helpers (1–700), the D-100-03 ladder (2052–2278), and targeted spot checks
  (924–960, 5036–5112, 5370–5444, 6300–6420) but did not re-review those ranges
  case by case.
- `info.messaging.ts` / `info.messaging.test.ts` — out of scope per the area
  definition.
- `tests/platform/git-ops-fake.ts`, `credential-ops-fake.ts`,
  `tests/edge/handlers/marketplace-seed.ts` — read only at their surface where the
  slice depends on them; owned by other areas.
- No toolchain command was run (per brief); every claim is from reading plus
  read-only greps.

## Meta-findings impact

### New cross-cutting evidence

- **Stale references to a merged-away test file.** `info.ts:1124`,
  `tests/architecture/catalog-uat.test.ts:3532`, and
  `tests/edge/handlers/marketplace-seed.ts:10` all name
  `tests/orchestrators/plugin/info-manifest-absent.test.ts`, which does not exist.
  Three areas carry the same phantom path, so a repo-wide grep for comments naming
  `*.test.ts` files that do not exist is cheap and likely to find more (this repo's
  "source-walk gates follow code" lesson applies to comments too). The catalog-uat
  and edge-handlers areas should pick up their instances.
- **Maximum-notification-count coverage gap as a class.** This suite never
  exercises a run producing three notifications, so the promised ordering between
  the second and third (skip note before failed blocks) is unverifiable by any
  existing case. Other multi-notify orchestrator surfaces (update, install cascade,
  marketplace info fan-out) should be checked for the same shape: grep their test
  files for the highest `makeCtx(N)` / `notifications[N]` actually asserted and
  compare against the production notify sites.
- **Reason-set membership tables need member-level coverage or dead-member
  pruning.** `DISABLED_ROW_REASONS` has 6 members: 2 tested, 2 reachable-untested,
  2 unreachable — and one reachable token (`unparseable`) is excluded with a
  factually wrong rationale. `list.ts::disabledReasonsField` (named in the same doc
  comment) and any other `ReadonlySet<ContentReason>` tables deserve the same
  member census. This is the runtime-set cousin of the "restore exhaustiveness on
  closed-union switches" item already in META-FINDINGS (the file's own
  `INSTALL_DISABLED_ROW_STATUSES` comment at `info.ts:998–1007` explains precisely
  why sets, unlike total maps, fail silently).

### Corrections to META-FINDINGS.md

- "Ranked by leverage" item 3 cites `orchestrators/plugin/info.test.ts` as
  "33 of 129 cases" — the count is at least 34 (`line 3635` missed), and the more
  useful framing this slice confirms: the remaining ~95 cases already use the
  whole-string form, so for this file the fix is intra-file propagation, not
  importing the `*.messaging.test.ts` convention from outside.
- "Patterns to propagate" lists strict interaction mocking in
  `tests/orchestrators/**` as a reference implementation. Qualify it:
  `tests/orchestrators/plugin/info.test.ts` uses `strong-mock` with
  `exactParams: true` correctly but hides every `verify()` in a shared
  `withHermeticHome` finally (first-pass BLOCKER, confirmed) — the verify-placement
  half of the pattern must not be copied from this file.

### Confirmations

- The fragment-assertion cluster (leverage item 3) is confirmed from a second
  angle: concrete surviving mutations were re-derived for the in-slice members
  (3776 tolerates any reordering/duplication of unmatched cascade lines; 3920
  tolerates a dropped description line), and the fix target (the file's own
  majority convention) verified achievable for every member checked.
- META's caution that "clean verdicts are not reliable" is borne out here in a
  variant form: this area had no clean-file list, but the un-listed remainder of
  the reviewed file still yielded two BLOCKER-class gaps (three-notify ordering,
  reason-set matrix) that the first pass's case-by-case read did not surface —
  attention-exhaustion applies inside large files, not just across them.
- The repo memory "Resolver state: malformed vs degrade" and the notification
  tri-state model are consistent with the production behavior found here; the one
  divergence (disabled rows hiding `unparseable`) is filed above as the operator
  decision it needs.
