# Orchestrators — plugin reinstall (slice B) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/reinstall.test.ts` lines 3649–7628 (SUB-02
delivery, WARN-01/WR-04/WR-09 degrade rows, the D-99-05b "rare failure arms"
block, ENBL/DFEN, D-141-03 discovery warnings, the enumeration-failure cases,
and the whole NFR-3 retry-proof chapter), read against
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (1613 lines,
read in full) and cross-checked against
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`,
`tests/orchestrators/plugin/reinstall.messaging.test.ts`,
`tests/orchestrators/plugin/scope-tree-inventory.ts`, the four bridge
`stage.ts`/`types.ts` modules, and `shared/vars.ts`.
**First-pass file:** `unit-test-findings/orchestrators-plugin-reinstall.md`
**Clean files attacked:** 1 (the first pass declared "the remaining ~7000 lines"
clean in prose rather than as a `### Clean files` bullet list; ~4000 of those
lines are in my range and are what I attacked)
**Existing findings graded:** 14 (8 unit-test + 6 production), plus the three
"Confirmed clean" production claims

> **Assignment correction.** The dispatch said my range "includes the later
> 'coverage gap' section where the first pass found 3 weak assertions and 3
> duplicates." It does not: the `GAP-01…GAP-19` block is lines 1515–2295, inside
> slice A. I read it anyway to grade those three BLOCKERs, and two of the three
> carry a **wrong fix instruction** — see the grading section. My own new
> findings are all inside 3649–7628 except two that I could only close by
> reading slice A, and those are labelled cross-slice.

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 5 |
| New WARNING (missed by first pass) | 11 |
| Existing CONFIRMED | 8 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 (1 "Confirmed clean" claim partially refuted) |
| Existing DUPLICATE-OF | 0 |
| Existing deferred to slice A (not verified) | 1 |

The headline: the first pass wrote *"No other correctness concerns were found
across the remaining ~7000 lines."* Roughly 4,000 of those lines are mine, and
they contain five mutations that survive every case in the file plus four more
duplicate pairs than the first pass recorded. The retry-proof chapter really is
as strong as advertised — the weaknesses are concentrated in the blocks it
silently superseded.

## New findings — from the clean list

### `tests/orchestrators/plugin/reinstall.test.ts`

- **[BLOCKER] The user-scope SUB-02 case cannot tell a reinstall from leftover install output** —
  `line 3740`, `test('SUB-02: user-scope reinstall keeps ${CLAUDE_PROJECT_DIR} literal in skill, command, and agent files', …)`
  The fixture installs with `${CLAUDE_PROJECT_DIR}` in the bodies and never
  rewrites the source before reinstalling, so the three assertions at 3773, 3782
  and 3791 read exactly the bytes the **install** wrote. Mutation: make
  `replaceAll` (`reinstall.ts:1259`) return `{ replacements: [], hookEntries:
  undefined }` without calling any `replacePrepared*`. `updateStateRecord` still
  composes off the prepared handles, `tx.save()` still succeeds, the outcome is
  still `reinstalled`, and all three `includes("Project: ${CLAUDE_PROJECT_DIR}")`
  checks still pass against the untouched install output — nothing in this case
  fails. **Its own sibling 80 lines up already does it right:** line 3676–3682
  rewrites the plugin tree with a `"Reinstalled project: …"` marker and comments
  *"so the assertions prove the reinstall re-staged from source (not leftover
  install output)"*. Fix: insert the same `await writePluginTree(seeded.pluginRoot,
  "hello", { skill: "Reinstalled project: ${CLAUDE_PROJECT_DIR}", command: …,
  agent: … })` between the seed and the reinstall (capture `seeded` from
  `seedMarketplace`, which this case currently discards), and assert the staged
  bodies contain `Reinstalled project: ${CLAUDE_PROJECT_DIR}` literally.

- **[BLOCKER] The single-vs-plural cardinality mapping is unasserted; `cardinality = "plural"` survives the whole file** —
  `line 4531`, `test('D-141-03: a standalone reinstall surfaces a skills discovery warning after the row', …)`
  `reinstall.ts:543` maps `opts.target.kind === "plugin" ? "single" : "plural"`,
  and "single" is what suppresses the `Plugin reinstall: N …` tally
  (`reinstall.messaging.ts:196–201`). Mutation: hard-code `"plural"`. Every
  `kind: "plugin"` case in the file survives it — 4531 asserts only
  `notifications.length === 2` and then indexes `notifications[1]`, never looking
  at the cascade body; 4775 uses `.some(…)`; 5337 asserts nothing about the
  message; and in slice A, 1973 (`GAP-14`) asserts only `assert.match(body,
  /skipped/)` and 1113/2125/2165 assert reason braces, not the tally. The
  messaging module's own test proves `renderReinstallPartitionAndNotify` honours
  the flag (`reinstall.messaging.test.ts:518, 609`), so the *mapping* is the
  untested half and it belongs to `reinstall.test.ts`. Fix at 4531: add
  `assert.equal(notifications[0]?.message, "● mp [project]\n  ● hello v1.0.0
  (reinstalled)\n\n/reload to pick up changes");` — a whole-body literal with no
  `Plugin reinstall:` line, which pins the omission and the row at once. (The
  same assertion added to `GAP-14` at 1976–1979 would close it from slice A
  instead; do it in one place, not both.)

- **[BLOCKER] `resourcesChanged()` can return `true` unconditionally and no case fails** —
  cross-slice; owning case is `line 820` (slice A), symptom is visible in my range at `lines 5643, 5797, 6274`
  `successOutcome` (`reinstall.ts:1471`) calls `resourcesChanged(oldRecord.resources,
  resources)`, an 8-clause disjunction. Every assertion of the field anywhere in
  the file expects `true` (589, 5643, 5797, 6274). The one fixture that would
  produce `false` — the zero-resource plugin at 828–845 (`resources: {}`) — never
  asserts it; it checks only the `/reload` trailer. `reinstall.messaging.test.ts:110`
  covers a `resourcesChanged: false` *input* to the renderer, which does not
  exercise the derivation. Fix: at line 838, beside `assert.equal(noResource.partition,
  "reinstalled")`, add `assert.ok(noResource.partition === "reinstalled");
  assert.equal(noResource.resourcesChanged, false);`.

- **[BLOCKER] The `degradedKinds` order (`skill` before `command`) is never proven** —
  `lines 3805` and `3844`
  `successOutcome` builds the list skill-first and the production comment names
  that as the contract (*"Skill before command by collection order, matching the
  install emit order"*, `reinstall.ts:1445–1447`); the order reaches the user
  through `malformedReasonsForKinds` and the `{malformed skill, malformed
  command}` brace. No case in the file degrades both kinds: 3837 asserts
  `["skill"]`, 3874 asserts `["command"]`, 3996 asserts the field is absent.
  Mutation: swap the two spread clauses at `reinstall.ts:1450–1451` — all three
  cases stay green. Fix: add one case that breaks **both** frontmatters in the
  same fixture (`writeFile(skills/tool/SKILL.md, "---\nname: [unterminated\n---\n…")`
  **and** `writeFile(commands/deploy.md, "---\ntitle: A: B: C\n---\n…")`) and
  assert `assert.deepStrictEqual([...outcome.degradedKinds ?? []], ["skill",
  "command"])` plus the rendered brace on the row.

- **[BLOCKER] A standalone negative assertion stands in for the record check** —
  `line 5158`, `test('a post-save hook-cache read failure leaves the committed reinstall successful', …)`
  `assert.notDeepEqual(stateAfter, stateBefore)` passes for any value that is not
  byte-identical, which the review rules name explicitly ("a standalone negative
  assertion … passes for any value; the test must assert what the value *is*").
  The only positive field check beside it is `?.version === "1.0.0"`. Mutation:
  have `updateStateRecord` blank `resources` or drop `hookEntries` — the case
  passes. Worse, this assertion is currently the **only** thing in either paired
  test file that notices whether `updatedAt` moves at all (see the production
  grading below). Fix: replace it with the shape its own retry-chapter twin uses
  at 7230–7232 and 7249–7254 — assert `resources`, `hookEntries`, `installedAt`
  and `version` against literals, and drop `notDeepEqual` entirely.

- **[WARNING] Four more duplicate pairs: the "rare failure arms" block is superseded by the NFR-3 retry chapter** —
  `lines 4008, 5071, 5113, 5222` vs `lines 7007, 6199, 7133, 5866`
  Each pair drives the identical production arm; in every pair the retry-chapter
  member asserts a strict superset (exact `notes`, the full notification array,
  the fs schedule, and the whole `retryTree` inventory) while the earlier member
  asserts a fragment.
  - 4008 (`S5: a reinstall whose config write-back cannot parse …`) ⊂ 7007
    (`retry proof: … an invalid config write-back …`). 4008 uses four
    `assert.match` fragments; 7068 does `assert.deepStrictEqual(firstNotifications,
    [ … , … ])` over both whole messages.
  - 5071 (`a replacement failure aborts every prepared bridge …`) ⊂ 6199
    (`retry proof: … skills replacement refusal …`). Same foreign-`hello-fresh`
    fault. 5071's title promises abort behaviour it never asserts — it checks
    only `partition`, state bytes and one foreign file; 6199 pins the abort via
    `firstSchedule` and `firstTree`.
  - 5113 ⊂ 7133 (`retry proof: … a post-save hook-cache read failure …`).
  - 5222 (`an abort cleanup failure reports manual recovery …`) ⊂ 5866
    (`retry proof: … an abort cleanup leak …`), which additionally pins the leak
    string and does it deterministically (see the next finding).
  Fix rule: delete the earlier member of each pair; before deleting, move into
  the survivor the one thing the survivor lacks — for 5071 that is the
  four-bridge fixture (`agent`, `mcp` present), so give 6199 those resources and
  extend its `firstTree` literal.

- **[WARNING] `chmodSync(…, 0o000)` plus an `fs.watch` race where a deterministic in-file alternative exists** —
  `lines 5237–5247`, `test('an abort cleanup failure reports manual recovery through the exported workflow', …)`
  The case forces an `rm` refusal by chmod-ing a staging directory to `0o000`
  from inside an `fs.watch` callback. It is root-hostile (as root the chmod does
  not block, the reinstall succeeds, and `assert.equal(outcome.partition,
  "failed")` fails) and the watch delivery is not synchronised. `observeReinstallSchedule`'s
  `stagingRmFault` (5866, wired at 5870–5874 and 494–500) produces the same
  refusal deterministically and with no permission bits. Fix: delete this case in
  favour of 5866 per the duplicate rule above; if it is kept, drive the refusal
  through `stagingRmFault` instead of `chmodSync`.

- **[WARNING] `commitHooks`'s re-parse failure is reached but its message and reasons are never asserted** —
  `line 5166`, `test('a hooks source changed after resolve fails before state persistence', …)`
  `reinstall.ts:1349–1351` throws `` `hooks.json re-parse failed: ${parsed.reason}` ``.
  The case asserts `partition === "failed"` and two byte snapshots, never
  `outcome.notes` or `outcome.reasons`. Mutations that survive: change the
  message text, drop `parsed.reason` from it, or throw a bare `new Error("x")`.
  Every sibling in the retry chapter pins this (`assert.deepStrictEqual(first.notes,
  [retryCauseChain(…)])` at 5595, 6111, 6267, 6430, 6734, 6925). Fix: add
  `assert.deepStrictEqual(outcome.notes, [retryCauseChain('hooks.json re-parse
  failed: <reason>')])` using the same helper, and assert `outcome.reasons` is
  `undefined` (this arm has no typed reason).

- **[WARNING] Existence-only assertion where the config bytes are the promise** —
  `line 5344`, `test('a bulk local reinstall writes only the local configuration', …)`
  `assert.equal(await pathExists(locations.configLocalJsonPath), true)` passes if
  the file is `{}`, is empty, or names the wrong plugin. The correct form is 40
  lines' worth of the same file away, at 7085–7088:
  `assert.equal(await readFile(path, "utf8"), '{\n  "schemaVersion": 1,\n
  "plugins": {\n    "hello@mp": {}\n  }\n}\n')`. Fix: replace the `pathExists`
  check with that byte comparison against `configLocalJsonPath`.

- **[WARNING] The bulk discovery-diagnostic case pins neither ordering nor the emission count** —
  `line 4576`, `test('D-141-03: a bulk reinstall surfaces one diagnostic per plugin, singular and plural', …)`
  `surfaceReinstallDiscoveryWarnings`'s documented promise is that each
  diagnostic follows *"the cascade its row lives in — the user reads the row,
  then the detail that qualifies it"* (`reinstall.ts:573–575`). The case filters
  to `diagnostics`, asserts `length === 2` and two `.some(…)` predicates. It never
  asserts `notifications.length`, never asserts which index each diagnostic
  occupies, and never asserts that the cascade precedes them. Mutations that
  survive: reverse the loop at `reinstall.ts:590`; emit the diagnostics before
  `renderReinstallPartitionAndNotify` (swap lines 567 and 568); emit the cascade
  twice. Fix: assert `notifications.length === 3` and index the three messages
  positionally (cascade at 0, then `hello`, then `world`), the way the standalone
  sibling at 4553–4554 already does.

- **[WARNING] Fragment assertions on rendered messages where a whole-body literal is computable — 8 sites** —
  `lines 3690, 3701, 3712, 3721, 3730` (SUB-02), `4037–4039` (S5), `4276–4277`
  (bulk disabled cascade), `4559–4564` (standalone diagnostic), `4818`, `4848`
  (enumeration failures), `5309` (local S5 row).
  This is META-FINDINGS item 3; I log it once for this range rather than per
  site. The two enumeration cases are the weakest: `assert.match(notifications[0]
  ?.message ?? "", /\(reinstall\).*failed/s)` constrains neither the summary
  line, nor the reason brace, nor the severity — and the severity of an
  enumeration failure (`error`, `reinstall.ts:644`) is asserted nowhere. The
  correct form appears three times inside my own range: 5005–5008, 4391–4401 and
  7068–7077. Fix rule: replace each `assert.match`/`includes` on a notification
  body with `assert.equal(notifications[i]?.message, <hand-written literal>)` and
  add the paired `assert.equal(notifications[i]?.severity, …)`.

- **[WARNING] `declaresAgents` and `declaresMcp` can be swapped undetected** —
  `lines 5638–5639`, `5792–5793`
  The only assertions of these two fields in the file expect `false`/`false`, and
  the one case that exercises the true arm (slice A, 855–871) has **both** true,
  so it renders both `{requires pi-subagents}` and `{requires pi-mcp}` either
  way. Mutation: swap the two initialisers at `reinstall.ts:1469–1470` — nothing
  fails; an agents-only plugin would then render `{requires pi-mcp}`. Fix: in the
  retry case at 6031 (which already has agents and mcp) add `assert.equal(second
  .declaresAgents, true); assert.equal(second.declaresMcp, true);`, and add one
  agents-only fixture asserting `{ declaresAgents: true, declaresMcp: false }`.

- **[WARNING] The SUB-02 block's header comment states a falsehood as its own rationale** —
  `lines 3648–3658`
  It says `prepareAllHandles` *"threads `cwd` into every stage input by hand (an
  optional field the compiler cannot enforce). A refactor that drops the `cwd`
  line would compile."* It would not: `cwd` is `readonly cwd: string` — required —
  on all three of `bridges/{skills,commands,agents}/types.ts` (lines 48, 58, 94)
  and `cwd: string` on `bridges/mcp/stage.ts:124`. Dropping any of the four `cwd:`
  lines in `reinstall.ts:1212/1222/1235/1239` is a TS2741 error. The real
  silent-miss risk is passing the *wrong* cwd (e.g. `locations.scopeRoot`), which
  is what the cases actually guard. Fix: restate the rationale as "a refactor
  that passed the wrong cwd would compile", and note that the mcp arm
  (`reinstall.ts:1239`) is the one the block does **not** cover — the `.mcp.json`
  fixture in `writePluginTree` carries no `${CLAUDE_*}` token, so dropping mcp's
  project-dir substitution is invisible here.

- **[WARNING] Test-support patches the `node:fs/promises` builtin namespace through a loader trick** —
  `lines 337–346`, `437–513` (`observeReinstallSchedule`), used by 12 cases from 5555 to 7367
  `createRequire(import.meta.url)("node:fs/promises")` plus `syncBuiltinESMExports()`
  reaches into an already-imported ESM namespace so production's `rm`/`mkdir`/
  `rename` resolve to the doubles. The doubles themselves come from `t.mock.method`
  (correct), but the mechanism is the "custom loader" the rules forbid, and the
  ESM re-sync is restored only by the hand-rolled `restoreSchedule?.()` in each
  `finally`, not by `node:test`'s automatic mock restore or a `t.after()`.
  I am **not** recommending its removal: the schedule assertions it enables are
  the strongest evidence in this file, `node --test` gives each test file its own
  process so the patch cannot leak across files, and `retryRepairRm`/
  `scope-tree-inventory.ts` show the author thought carefully about self-observation.
  The honest framing is a production one: the four bridges have no fs port, so
  there is no injectable seam to observe. Log it against the same ticket as the
  `homedir()`/`new Date()` seams, and — cheap and immediate — register the
  restore with `t.after(restoreSchedule)` at creation instead of relying on 12
  hand-written `finally` blocks.

- **[WARNING] The four-bridge replace-failure case asserts none of what its title promises** —
  `line 5071`, `test('a replacement failure aborts every prepared bridge and preserves foreign content', …)`
  Covered above as one half of a duplicate pair, but the title/assertion mismatch
  is worth naming on its own: "aborts every prepared bridge" is asserted nowhere
  — no staging inventory, no schedule, no `failureClass`, no `notes`. (I checked
  whether deleting `abortHandles(handles)` from `reinstall.ts:1307` survives the
  suite: it does **not** — 6199's and 6361's `firstSchedule` literals end with the
  `staging-rm:*` sweep and would fail. So the arm is covered, just not here. The
  one branch with no observable coverage, `abortPreparedMcp`, is a documented
  no-op at `bridges/mcp/stage.ts:323–325` and is not a finding.) Fix: retitle to
  what it asserts, or delete per the duplicate rule.

- **[WARNING] White-box read-count coupling** — `lines 7176–7180, 7225, 7228`
  `test('retry proof: … a post-save hook-cache read failure …')` refuses the
  **third** read of the source hooks file and asserts `firstReads === 3` /
  `reads === 6`. The counts are the case's contract with an internal call
  sequence, not with public behaviour; adding a legitimate read anywhere in
  resolve/commit/hydrate turns this into a confusing red. It is self-checking
  (it fails loudly rather than silently) so this is a maintainability note, not a
  correctness one. Fix if touched: key the refusal on a marker the production
  code passes (the `logPrefix: "reinstall"` hydration call site) rather than on an
  ordinal.

## Export ownership census

`reinstall.ts` has two runtime exports and seven exported types. Ownership is
shared with slice A; the column below says which case in **my** range owns it.

| Module | Export | Owning case in 3649–7628 | Status |
| --- | --- | --- | --- |
| `reinstall.ts` | `reinstallPlugin` | 3660, 3805, 4008, 5071, 5555 … 7367 (≈30 cases) | owned |
| `reinstall.ts` | `reinstallPlugins` | 4247, 4300, 4531, 4576, 4794, 4825, 4855, 5316, 7481 | owned |
| `reinstall.ts` | `ReinstallPluginOptions` (type) | used at every call site | owned (compile-time) |
| `reinstall.ts` | `ReinstallPluginsOptions` (type) | used at every bulk call site | owned (compile-time) |
| `reinstall.ts` | `ReinstallPluginsTarget` (type) | 4266, 4549, 4811, 5337, 7531 | owned (compile-time) |
| `reinstall.ts` | `ReinstallPluginDeps` (type) | imported at 52, used 5501, 7517 | owned (compile-time) |
| `reinstall.ts` | `ReinstallCloneCacheSeam` (type) | imported at 51; `reinstallSeamWith` (slice A, ~2857) | owned via slice A |
| `reinstall.ts` | `RemoveDataDirFn` (type) | never imported by either paired test file | **NO CASE** (structurally exercised only through the `ReinstallPluginDeps.removeDataDir` literal at 5511/7518) |
| `reinstall.ts` | `DropMarketplaceCacheFn` (type) | never imported by either paired test file | **NO CASE** (same shape as above, via 5503) |
| `reinstall.ts` | `ReinstallPluginOutcome` (re-export) | asserted throughout | owned |

The two "NO CASE" rows are type aliases whose only purpose is to name a field on
`ReinstallPluginDeps`; they emit no JS, so this is not a coverage hole (see the
repo's own note that type-only modules never fire coverage). It is worth
recording only because it says the deps interface is exercised structurally, by
object literals, and never named.

## Branch census

Reachable and untested (findings, listed above): `resourcesChanged` false arm;
the `degradedKinds` both-kinds combination; the `cardinality === "single"`
consequence; `declaresAgents`/`declaresMcp` asymmetry.

Reachable and covered, listed here so the fixing pass does not re-derive them:

| Branch | Case |
| --- | --- |
| `handleEnumerationFailure` → `MarketplaceNotAddedSignal` arm | 4855 (whole-message literal at 5005) |
| `handleEnumerationFailure` → generic synthetic `(reinstall)` row | 4794, 4825 (fragment only — see grouped WARNING) |
| `resolveMarketplaceReinstallScope` bare form, non-`MarketplaceNotFoundError` rethrow | 4825 |
| `enumerateMarketplaceReinstallTargets` defensive `mp === undefined` throw | 4855 — genuinely reachable by the real race, **not** dead code |
| `reinstallPlugin` S5 `invalidConfigWriteBack` base-file arm | 4008, 7007 |
| … local-file arm (`opts.local === true`) | 5280 |
| `commitHooks` no-hooks → `removeHookConfig` | every retry schedule (`remove:hooks`) |
| `commitHooks` `!parsed.ok` throw | 5166 (message unasserted) |
| `makeReinstallCloneProbe` unpinned/mirror, subdir-miss, pinned-miss arms | 5351, 5399, 5441 |
| `reasonsFromTypedError` `PluginShapeError` | 4054 |
| … `ManualRecoveryError` | 5222, 5866 |
| … `EACCES` / `ENOENT` / unclassified | 5019–5069 data-driven rows |
| … `ENOTDIR` | 5628, 5783 |
| `rollbackReplacement` skills / commands / agents arms | 6285, 6448, 6755 (schedule) |
| `rollbackReplacement` mcp arm | 6664 — no schedule event (write-file-atomic), proven by `firstMcpBytes === mcpBytes` at 6742 |
| `finalizeReplacement` all four arms | forward `backup-rm:*` order in every success schedule |
| `abortPartialHandles` skills/commands/agents | 6031 firstSchedule |

Compiler-forced / not removable: none found in my range.

Unreachable-by-real-input: none found. Notably `reasonsFromTypedError`'s `EPERM`
and `ENOTDIR` clauses share arms with `EACCES`/`ENOENT`, so the untested literal
is a synonym, not a branch.

Not asserted anywhere but defensive-only, listed rather than filed: the four
`Object.freeze` calls (`reinstall.ts:569, 820, 1311, 1522, 1539, 1565`) — no case
mutates a returned array to prove the freeze.

## Grading of first-pass findings

### `tests/orchestrators/plugin/reinstall.test.ts`

- **CONFIRMED** — *`GAP-15` asserts a claim its own module already disproves* —
  verified at 1986–2022: the only assertions are `partition === "reinstalled"` and
  `notifications.some(n => n.message.includes("reinstalled"))`, which the ordinary
  success row satisfies. `reinstall.ts:384–394` is the D-19-01 comment that
  settles it. Owned by slice A.
- **CONFIRMED (finding) — but the recorded fix instruction is wrong** —
  *`GAP-14` weak regex lets a broken summary tally pass*. The weak regex is real.
  The rationale is not: the target at 1973 is `{ kind: "plugin" }`, so
  `reinstall.ts:543` yields `cardinality: "single"` and **the tally is omitted
  entirely** — the first pass's guess that "the actual tally is very likely
  `Plugin reinstall: 1 failure`" is wrong, and there is no `reinstallSummary`
  function anywhere in `reinstall.messaging.ts` (the tally is `composeTally` in
  `shared/notify.ts:3154/3179`, labelled from `REINSTALL_CONTEXT.Messaging.label`).
  The correct fix is a whole-body `assert.equal` **containing no `Plugin
  reinstall:` line**, which also closes my BLOCKER 2.
- **CONFIRMED (finding) — but the recorded fix instruction is wrong** —
  *`GAP-12` weak regex lets a broken singular/plural branch pass*. Verified at
  1871–1895. The prescribed replacement, `assert.match(body, /Reinstalled plugin
  "hello"\./)`, would produce a **red** test: the target is `{ kind: "all" }` →
  plural → the tally reads `Plugin reinstall: 1 success`, and line 1258 of the
  same file already asserts the `Reinstalled plugin "…"` phrasing is *absent*
  from a reinstall cascade. Fix instruction should be `assert.equal(body,
  "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\nPlugin reinstall: 1
  success\n\n/reload to pick up changes")`.
- **UNDERSTATED** — *Three duplicate test pairs add no discriminating power.*
  Four more pairs exist in my range alone (4008≈7007, 5071≈6199, 5113≈7133,
  5222≈5866), so the file carries **at least seven**. More importantly the shape
  is different from what was recorded: it is not three incidental copies inside
  the `GAP-*` block, it is a **whole chapter** — the D-99-05b "rare failure arms"
  block at 5019–5350 — that the later NFR-3 retry chapter silently superseded.
  Severity should rise to BLOCKER-adjacent for planning purposes because the
  weaker member is what a future editor will read and copy.
- **UNDERSTATED** — *Real-race test is unusually heavy and timing-sensitive*
  (4855–5017). Real, but the recorded remedy ("extract the harness if
  `update.ts`/`uninstall.ts` carry an equivalent") treats a symptom. The cause is
  a production gap: `enumerateReinstallTargets`, `enumerateAllReinstallTargets`,
  `installedTargetsForScope` and `resolveMarketplaceReinstallScope`
  (`reinstall.ts:652–812`) call the statically-imported `loadState` directly and
  never consult `opts.__deps` — unlike the transaction path, whose
  `stateTransaction.loadState` seam **this same test file already injects** at
  5051–5057 and 6866–6891. That absence is why the case needs a spawned child
  process, an IPC readiness handshake, an `fs.watch` rename race and a 16 MB
  padding file to widen the window. Fix: add a `loadState` member to
  `ReinstallPluginDeps` consumed by the enumerator, then rewrite this case as a
  ~30-line deps-injection test in the shape of 6866.
- **CONFIRMED** — *Split along the production module's leaf-module seams.* My
  range strengthens it: the NFR-3 chapter (5488–7628, 28% of the file) is already
  self-contained around `observeReinstallSchedule`/`retryScheduleDirs`/
  `observeRetryDeps`/`retryCauseChain` plus the **already-extracted**
  `tests/orchestrators/plugin/scope-tree-inventory.ts`, which is shared with the
  install, uninstall, bootstrap and reconcile proofs. Splitting would also expose
  the four duplicate pairs above, which are invisible today precisely because
  they sit 2,000 lines apart.
- **CONFIRMED** — *`GAP-01…GAP-19` numbering is not a durable spec anchor.* Slice
  A territory; `.claude/rules/typescript-comments.md` lists the sanctioned
  families and `GAP-N` is not among them.
- **Deferred (not verified)** — *`GAP-04`/`GAP-17` fourth near-duplicate.* Slice
  A; I did not trace the two `errorWithManualRecovery` empty-leaks paths.

### `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`

- **CONFIRMED** — *Two `switch` statements omit the required `default` group*
  (`rollbackReplacement` 1543–1552, `finalizeReplacement` 1569–1578). Matches
  META-FINDINGS item 5; `default: return assertNever(entry.phase);` is the fix.
- **CONFIRMED** — *Unexplained `return handles as PreparedHandles`* (1251). The
  invariant holds (the `catch` at 1247 re-throws before this line) but is not
  stated at the assertion site.
- **CONFIRMED, with a qualification** — *Hidden dependency: `homedir()` inline in
  `commitHooks`* (1347). Real. Worth recording that the hermeticity consequence is
  currently masked: `withHermeticHome` sets `process.env.HOME` (test file 85–102)
  and POSIX `os.homedir()` honours `$HOME`, so the cases are hermetic *by
  accident of platform*. On Windows `os.homedir()` ignores `$HOME`, so the same
  cases would read the developer's real profile. That makes the seam a
  portability fix as well as a testability one.
- **UNDERSTATED** — *Hidden dependency: `new Date()` in `updateStateRecord`*
  (1409). The recorded reason ("no test currently pins the literal timestamp, so
  this has not yet forced a test-side workaround") undersells it. `updatedAt` is
  asserted **nowhere** in `reinstall.test.ts` or `reinstall.messaging.test.ts` —
  the only two hits are fixture *inputs* at 3142 and 3486. The single thing that
  notices whether the field moves at all is the `assert.notDeepEqual` at 5158,
  which is itself a rule violation I am filing separately as a BLOCKER. So
  mutating line 1409 to `updatedAt: oldRecord.updatedAt` is caught by one
  accidental negative assertion and nothing else. An injected `now: () => string`
  seam plus a literal assertion should be one ticket, and the same seam is
  presumably needed in `install.ts`/`update.ts` (unverified — outside my area).
- **CONFIRMED** — *`reinstallPlugin`/`reinstallPlugins` lack their own doc
  comments* (321, 516).
- **CONFIRMED** — *Suggested module split.* Seam 3 (`reinstall-replace.ts`) is
  the right first cut; my range is almost entirely its test surface.

### First-pass "Confirmed clean" claims

- **CONFIRMED — NFR-5.** Independently verified: `reinstall.ts` imports nothing
  from `platform/git.ts`, names neither `gitOps` nor `DEFAULT_GIT_OPS`, and its
  only git-reaching surface is `ReinstallCloneCacheSeam.materializePluginClone`
  (234–236, 1115). The 5351/5399/5441 cases assert `gitState.cloneCalls` and
  `gitState.resolveRemoteRefCalls` are empty, which is the behavioural half.
- **CONFIRMED — force semantics.** `replacePreparedAgents(handles.agents, { force:
  true })` at 1278 is unconditional and `requirePartialInstallable(resolved,
  "install")` at 1187 is the gate; there is no force flag on
  `ReinstallPluginOptions` to make sticky.
- **PARTIALLY REFUTED — "no test-only production surface."** The substance is
  right (every `__deps` member defaults to the real implementation and production
  never writes it), and CONVENTIONS.md's "dependency injection over test-only
  seams" rule sanctions the *parameter* form. What is not sanctioned is the
  packaging: the field is named `__deps` (the Google naming rule this project
  adopts forbids `_` prefixes and suffixes outright) and is documented
  `@internal Test-only seams; production callers omit this` (210, 259) — which is
  a declared test mode, the thing the unit-testing rules name as a finding. The
  same interface already carries three collaborators in the correct first-class
  form on the same lines: `credentialOps`, `deviceFlowHttp`, `authMemo` (200–209),
  none prefixed, none labelled test-only. Fix: promote `stateTransaction`,
  `dropMarketplaceCache`, `removeDataDir` and `cloneCacheSeam` to sibling optional
  options and drop the `__` prefix. Low severity, but the first pass's "this
  matches the project's own documented convention" is only half true.

## Still clean after attack

The NFR-3 retry chapter (5488–7628, 13 cases) is the strongest test code I read
in this area. Mutations I tried against it that the cases **do** catch:

- **Skip a collaborator call.** Delete `abortHandles(handles)` from `replaceAll`'s
  catch (1307) → 6199 and 6361 lose the trailing `staging-rm:commands`/
  `staging-rm:skills` entries from their `firstSchedule` literals. Red.
- **Reorder two calls whose order is promised.** Swap `cacheDrop` and
  `removeDataDir` in `runPostSuccessMaintenance` (1595 vs 1605) → every success
  schedule's trailing `["drop:cache", "remove:data"]` flips. Red in 8 cases.
- **Reverse the unwind direction.** Drop `.reverse()` from `rollbackReplacements`
  (1533) → 6664's 20-entry `firstSchedule` reorders agents/commands/skills. Red.
- **Reverse the finalize direction.** Add `.reverse()` to `finalizeReplacements`
  (1559) → the `backup-rm:skills, staging-rm:skills, backup-rm:commands, …` order
  in every success schedule flips. Red.
- **Drop a structured error field.** Remove `failureClass` from the manual-recovery
  spread (511) → 5866's `assert.equal(first.failureClass, "manual-recovery")` and
  5222's both go red.
- **Drop the phase prefix from a leak string.** Remove `` `${phase}: ` `` from
  `pushLeak` (1583) → 5942's anchored regex on `leaked: skills: failed to clean
  up …` goes red.
- **Return early before a side effect.** Move `removeHookConfig` above the
  `hooksConfigPath === undefined` guard, or drop it → `remove:hooks` disappears
  from every schedule. Red.
- **Change one word in a rendered message.** Any edit to the reinstalled row, the
  tally, or the `/reload` trailer → red at 5948, 7070, 7563, 7570, 4391.
- **Delete a line from a multi-line message.** The cause-chain line in 7074 and
  the leak line in 5942 are both pinned.
- **Return a stale record.** `installedAt` preservation is pinned across the retry
  boundary at 7121, 7252, 7356, 7471, 7620; `version` at 5647, 6115, 6273 etc.
- **Leak a temporary directory.** Every retry case compares a complete
  `retryTree` inventory literal before **and** after, so any orphaned
  `<bridge>-staging/<uuid>` moves the list. 5866 goes further and asserts the
  deliberate leak *persists* across the retry.
- **Emit anything at all in `render: "none"` mode.** `assert.deepStrictEqual(notifications,
  [])` appears in 9 retry cases — the "silence proof" pattern META-FINDINGS names.

Two more things in my range that are genuinely well built and should be
propagated rather than fixed:

- `tests/orchestrators/plugin/scope-tree-inventory.ts` — one shared tree-inventory
  contract used by the install, reinstall, uninstall, bootstrap and reconcile
  proofs, with `readdir` bound at module load specifically so a walk cannot
  record itself into an observing case's schedule. This is the *opposite* of the
  hand-rolled-walker duplication META-FINDINGS reports in the architecture suite.
- The `readFailure` probe at 6056–6068: rather than hard-coding a Node errno
  message that changes between majors, the case reads the runtime's own message
  and pins the failure's **identity** with `assert.deepStrictEqual({ code, syscall },
  { code: "EISDIR", syscall: "read" })`. That is the right way to depend on a
  runtime string, and the comment explains exactly why.

## Not covered

- I did not re-derive slice A's findings beyond `GAP-12`, `GAP-14` and `GAP-15`,
  which I read in full because the dispatch named that cluster. `GAP-04`/`GAP-17`
  is left to slice A.
- I did not diff this file against `install.test.ts`, `update.test.ts` or
  `uninstall.test.ts` for cross-file duplication of the retry-proof harness. The
  shared `scope-tree-inventory.ts` header says four other suites use it, so the
  harness is at least partly shared already; whether `observeReinstallSchedule`
  itself is duplicated per verb is unchecked and worth one grep by the fixing
  pass (`grep -rn "syncBuiltinESMExports" tests/`).
- Direct per-pair coverage was not measured (the review is read-only by
  instruction). Every coverage statement above is from reading.
- I did not verify the `install.ts`/`update.ts` half of the `new Date()` /
  `homedir()` systemic claim; both are outside my area.

## Meta-findings impact

### New cross-cutting evidence

1. **"Superseded chapter" duplication is a distinct defect class from sibling
   drift, and META-FINDINGS does not name it.** In this file the D-99-05b "rare
   failure arms" block (5019–5350) and the NFR-3 retry chapter (5488–7628) test
   the same four production arms; the retry chapter asserts a strict superset of
   the earlier block in every pair. Neither block is *wrong*; the later one was
   added without deleting what it replaced, and the 2,000-line gap makes the
   overlap invisible to a reader. This is not "one file diverging from its
   siblings" — it is one file containing two generations of its own test
   strategy. **Any other file that grew a `retry proof:` chapter should be
   checked for the same shape**; the natural candidates are
   `tests/orchestrators/plugin/{install,uninstall}.test.ts` and
   `tests/orchestrators/plugin/bootstrap.test.ts`, all of which import the same
   `scope-tree-inventory.ts` retry harness. One grep locates them:
   `grep -rln "retry proof" tests/`.

2. **A missing injection seam shows up as an expensive test, not as a missing
   test.** The 163-line child-process race harness at 4855–5017 exists *only*
   because `enumerateReinstallTargets` reads `loadState` by static import while
   the transaction path next to it takes an injected `loadState`. The same file
   demonstrates the cheap form twice (5051, 6866). META-FINDINGS item 4 frames
   missing seams as "the test cannot mock the handler's promise so it asserts
   another module's contract"; this is a second, different symptom of the same
   root cause — **the test reaches for the operating system instead**. Worth
   adding to item 4, and worth a sweep for its signature:
   `grep -rn "spawn(process.execPath" tests/` and `grep -rn "fs.watch\|[^a-z]watch(" tests/`.

3. **Fixtures that do not change between the two calls of an idempotence pair are
   a silent-vacuity class.** The SUB-02 user-scope case (3740) and its
   project-scope sibling (3660) differ by exactly one `writePluginTree` call, and
   that one call is the difference between proving a reinstall and reading the
   install's leftovers. Every "reinstall/update/reconcile leaves X alone" case in
   the repo has this failure mode. Check rule for other areas: **if a case calls
   install-then-reinstall and asserts on staged bytes, the source must have been
   rewritten in between, or the assertion is about the install.**

### Corrections to META-FINDINGS.md

- META-FINDINGS lists this file only implicitly, under *"Decisions the fixing
  pass cannot make → 2. Module splits"* (`orchestrators/plugin/{install,update,
  reinstall,info}.ts`, "7k–9.4k test lines each"). That framing is right but
  incomplete for `reinstall`: the split is not only a size problem, it is the
  **mechanism that would surface the seven duplicate pairs**. Recommend
  re-ordering: for `reinstall.test.ts`, resolve the duplicates *before* the split
  (deleting four cases removes ~330 lines and makes the seams obvious), not after.
- Under *"Ranked by leverage → 5. Restore exhaustiveness on closed-union
  switches"*, `reinstall.messaging.ts` is listed as one of the two WARNING-rated
  omissions. I did not review `reinstall.messaging.ts`'s switch, but I can add
  that `reinstall.ts` itself carries **two more** un-defaulted switches at 1543
  and 1569 over the same `BridgePhase` union — so this file contributes three,
  not one, to that cluster.
- No claim in META-FINDINGS is contradicted by my range.

### Confirmations

- **"Whole-message assertion against hand-written strings — reference: any
  `*.messaging.test.ts`."** Confirmed from a second angle, and I can strengthen
  it: the correct form already exists **inside** the non-messaging orchestrator
  test too, at `reinstall.test.ts:4391–4401`, `5005–5008` and `7068–7077`. The
  fixing pass does not have to leave the file to find the target form — which
  makes the eight fragment sites I list pure propagation.
- **"Proving a module does not touch a port — silence proofs."** Confirmed:
  `assert.deepStrictEqual(notifications, [])` appears in nine `render: "none"`
  retry cases (5649, 5803, 6119, 6276, 6438, 6598, 6740, 6930, 7229). This is the
  same pattern META credits to `tests/orchestrators/reconcile/notify.test.ts`,
  applied here at scale and correctly.
- **"Cross-collaborator order proof via one shared log."** Confirmed and
  extended: `observeReinstallSchedule` is the strongest instance of this pattern
  I have seen in the repo — a single ordered string log spanning three fs
  primitives and two injected collaborators, compared whole against a literal in
  13 cases. It belongs in META's reference-implementation table alongside
  `tests/transaction/phase-ledger.test.ts`, with the caveat recorded in my
  WARNING above that it buys that power with a builtin-namespace patch.
- **"Direct per-pair coverage was never measured."** Confirmed as still true; I
  did not run it either, per the diagnostic-only instruction.
