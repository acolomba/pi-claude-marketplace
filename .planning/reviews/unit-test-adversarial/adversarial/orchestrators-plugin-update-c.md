# Orchestrators — plugin update (slice C) — adversarial re-review

**Scope:** `tests/orchestrators/plugin/update.test.ts` lines 7270–8502 (SUB-02, the
WARN-01/WR-12/D-99-03 degraded-row section, and the D-99-05b rare-failure-and-rollback
section — 22 cases), plus the production arms of
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` those cases exercise
(`handleEnumerateFailure`, `notifyBareFormEnumerateFailure`, `narrowDirectFailReason`,
`markUpdateInProgress`, `abortHandles`, `refreshDisabledRecord`/`runDisabledRecordRefresh`,
`commitUpdatePhase3a`, `surfaceUpdateDiscoveryWarnings`, `collectUpdateWarnings`,
`collectDegradedKinds`, the success-outcome spreads). Sections outside the range
(1591–2060, 2705–3400, 5834–6500) were read only to settle whether a sibling case
already kills a mutation this range's cases survive.
**First-pass file:** `unit-test-findings/orchestrators-plugin-update.md`
**Clean files attacked:** 1 (the first pass's "Clean files" claim for this file is a
prose blanket over the remainder of both files; this pass attacked the assigned slice
of it — 22 test cases and the ~15 production functions they reach)
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 1 |
| New WARNING (missed by first pass) | 4 |
| Existing CONFIRMED | 8 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

## New findings — from the clean lists

### `tests/orchestrators/plugin/update.test.ts`

- **[BLOCKER] The disabled-pin acceptance race asserts only a notification COUNT — an error outcome passes it** — `test('a disabled update accepts a concurrent writer that already stored the next pin', ...)`, lines 8217–8275
  The case's whole promise is *acceptance*: the in-transaction projection-equality
  guard in `refreshDisabledRecord` (`update.ts:1695`) sees the racing writer already
  stored the identical pin and returns `false` without writing. But the assertions are
  `notifications.length === 1` (line 8264) plus four record-field checks — the message
  and severity are never read. Two plausible wrong implementations pass unchanged:
  (a) `refreshDisabledRecord` throwing on the projection-equal path (any throw —
  `StateLockHeldError`, a bad comparison) routes through `updatePlugins`' catch to
  `notifyDirectFailure`, which emits exactly one **error** notification and leaves
  the record untouched — every assertion green while the behavior is the opposite of
  "accepts"; (b) deleting the `next.projection === current → return false` guard
  (`update.ts:1695–1697`) rewrites the record with identical values — only
  `updatedAt` moves, and `updatedAt` is unasserted. Fix: assert the rendered row the
  way siblings 8159/8206 do (`assert.match(notifications[0]?.message ?? "",
  /gp \(skipped\) \{already disabled\}/)` and `assert.equal(notifications[0]?.severity,
  undefined)`), and add `assert.equal(record.updatedAt, "2026-01-01T00:00:00.000Z")` —
  the seeded stamp survives iff the no-write guard held, which is the RECON-05 property
  the case exists to prove.

- **[WARNING] The scope-fallback defaults in both enumerate-failure emitters are pinned only on their default side** — `handleEnumerateFailure` (`update.ts:554`, `explicitScope ?? "project"`) and `notifyBareFormEnumerateFailure` (`update.ts:2968`, `scope ?? "user"`); cases at lines 7778, 7813, 7842
  Mutating `update.ts:554` to hardcode `"project"` (dropping the `explicitScope`
  pass-through) survives all three cases: 7813 passes no scope (exercises the
  default), and 7842 passes `scope: "project"` — indistinguishable from the
  hardcoded default. Symmetrically, mutating `update.ts:2965–2969` to always
  stamp `"user"` survives 7778, which passes no scope. Add one case per emitter on
  the non-default side: a `plugin`/`marketplace` target with `scope: "user"` and a
  truncated **user-scope** `state.json` under the hermetic HOME asserting
  `/● mp \[user\]/`, and a bare-form case with `scope: "project"` asserting
  `/● \(update\) \[project\]/`.

- **[WARNING] WR-12 trio: only the first case pins the notification count** — lines 7512 vs. 7558 and 7603
  `test('WR-12: ... skill will not parse ...')` asserts `notifications.length === 1`
  (line 7512); its two siblings (`command` at 7532, `BOTH kinds` at 7574) assert only
  `notifications[0]?.message`. A mutation that emits a second spurious notification
  after the row (a duplicated notify, or a leaked diagnostic) passes the two siblings
  and is caught only by the first. Propagate `assert.equal(notifications.length, 1)`
  to both, matching line 7512.

- **[WARNING] The D-03 fail-continue case drops three assertions its direct-path phase-3a siblings all carry** — `test('D-03 fail-continue: a hooks write that cannot land is aggregated, ...')`, lines 7872–7931
  The siblings on the same production path (`update.test.ts:1746–1748`, `1801–1803`,
  `1853–1855`) each assert `notifications.length === 1`, `severity === "error"`, and
  the `\{rollback partial\}` reason token. This case asserts none of the three — its
  message checks are `/hooks/` (which the EISDIR cause path
  `<hooksDir>/hello/hooks.json` satisfies even if the failing phase were misattributed;
  only the state-side `resources.hooks` check catches that) and the recovery-hint
  regex. A mutation replacing `reasonOverride: "rollback partial"` with another token,
  or double-emitting the failure, passes here and fails only in the earlier sections.
  Propagate the three sibling assertions (count, severity, `/⊘ hello \(failed\)
  \{rollback partial\}/`).

- **[WARNING] The rare-failure-arm section asserts by unanchored fragments while the degraded-row section beside it compares whole messages** — grouped; representative lines 7798–7805, 7833–7834, 7862–7864, 8113–8114, 8159, 8206
  Every failure/race case at 7778–8215 uses independent unanchored `assert.match`
  regexes; the WR-12/CR-01/NREG-01 cases at 7482–7770 compare the complete rendered
  message byte-for-byte. A garbled message with the header and row lines swapped, or
  a dropped headline, passes each regex individually. Intra-trio drift compounds it:
  7778 asserts the cause chain, 7813/7842 do not. The cause tail carries a
  Node-version-variant `SyntaxError` text, so a full byte compare may be unstable —
  pin what is stable instead: assert the message *starts with* the exact
  headline + `● <mp> [<scope>]` + row lines (computable from the arranged input and
  the output catalog), keeping a regex only for the cause tail, and add the cause
  assertion to 7813/7842 to match 7778. This is the repo-wide fragment class
  (META-FINDINGS item 3) surfacing in a file whose first pass described its
  assertions as "overwhelmingly whole-value" — true for the happy/degraded sections,
  not for this one.

## Export ownership census

`update.ts` has five exports; all are owned, none only incidentally.

| Module | Export | Owning case(s) | Status |
| --- | --- | --- | --- |
| `update.ts` | `updatePlugins` | ~110 cases file-wide; in range: 7281–8120, 8298, 8425 | owned |
| `update.ts` | `updateSinglePlugin` | in range: 8344, 8473; earlier: 1591, 1642, 3116 | owned |
| `update.ts` | `UpdatePluginsTarget` (type) | every `target:` literal | owned (type-only, exercised structurally) |
| `update.ts` | `UpdatePluginsOptions` (interface) | every `updatePlugins` call | owned (type-only, exercised structurally) |
| `update.ts` | `UpdateCloneCacheSeam` (interface) | `seamWith` (6234), `capturingUpdateSeam` (289), `seamMutatingStateMidUpdate` (7939) | owned |

## Branch census

Branches in the production arms this range owns, classified:

- `abortHandles` (`update.ts:1410–1416`) — **reachable, tested for state only.** Four
  cases reach it (3116-adjacent `prepare-handles-fail` reaches the partial variant;
  7963, 8023, and — missed by the first pass's count — 8077 reach the full variant).
  No case anywhere in the file lists a staging directory after the abort (grep:
  the only `readdir` calls are on `pluginClonesDir`, lines 6564/6696). First-pass
  BLOCKER stands; see grading.
- `appendLeaks` non-empty-leak branch on the **abort** paths (`update.ts:1366, 2297`) —
  **reachable-untested.** Leak *reporting* is proven on the commit path
  (1868/1936, chmod-forced), never on the abort path. Forcing it needs the same
  chmod trick applied before an ST-9-style intent-mark failure. Low priority once
  the staging-cleanup BLOCKER fix lands (the same new case can cover it).
- `handleEnumerateFailure` — all three arms reachable and tested
  (`MarketplaceNotAddedSignal` at 2705–2807, bare at 7778, marketplace/plugin at
  7813/7842); the scope pass-through inside two arms is undiscriminated (new
  WARNING above).
- `narrowDirectFailReason` — in-range arms covered: fallback `"unreadable manifest"`
  (7778/7813/7842/8077), `"concurrently updated"` (7963), `"concurrently
  uninstalled"` (8023). The errno / `not found` / `rollback` / `network` / `invalid`
  arms belong to earlier sections and were not re-audited here.
- `markUpdateInProgress` — all three throw arms plus the success path covered
  (8077 / 8023 / 7963 / happy cases). The intent-mark-before-commits ordering
  promise is proven by the `watchStateTransition` cases at 1693/1761/1813 (the
  racing corruption is triggered *by observing the mark write* and still affects the
  commit), so the reorder mutation I ran against the ST-9 cases is killed by those
  siblings — no finding.
- `refreshDisabledRecord` — `sMp === undefined` (8122), `sRecord === undefined`
  (8167), projection-equal no-write (8217 — weakly; new BLOCKER above), write path
  (6501 ENBL-09, out of range).
- `runDisabledRecordRefresh` GC arm (`wrote && resolvedSha !== undefined`,
  `update.ts:1750–1756`) — the in-range races all produce `wrote === false`;
  the `wrote === true` sweep is owned by the PURL/ENBL section (out of range,
  not re-verified — see Not covered).
- `commitUpdatePhase3a` — hooks catch covered (7872, 1693); skills/agents leak
  branches covered (1868/1936); mcp catch covered (2006). The **commands** catch
  (`update.ts:2099–2103`) has no case I could locate in the whole file —
  reachable-untested, flagged for the range-A/B owner to confirm.
- `surfaceUpdateDiscoveryWarnings` — loop-walks-every-outcome proven (8425),
  order-after-cascade proven (8298 asserts `notifications[1]`), the
  `partition !== "updated" || notes === undefined` skip guard proven from the
  clean side (8473 + 7736). The skip guard's *positive* side (a skipped outcome
  with notes must NOT emit) is only implicit; acceptable.
- `collectUpdateWarnings` cascade/standalone split — both flip directions killed
  (8344's two halves, including the anchored positive control).
- No compiler-forced (D-116-01a) branches were needed anywhere in this range.

## Grading of first-pass findings

### `tests/orchestrators/plugin/update.test.ts`

- **CONFIRMED** — *`dropCache-fail` asserts nothing that discriminates the behavior it names* (BLOCKER) — verified against `update.ts:2448–2462`: the catch is empty per D-19-01, no `notifyWarning` exists; the test's assertions (3310–3316: zero errors, `>= 1` success, `/updated/`) pass with the whole `dropPluginCompletionCache` call deleted, and the comment's `(lines 690-696)` citation points at nothing.
- **CONFIRMED** — *`abortHandles`/`abortPartialHandles` proven only by state-record consequence* (BLOCKER) — grep confirms no `readdir`/`pathExists` on any `*StagingDir` after an abort anywhere in the 8,502 lines; the 1868/1936 chmod cases prove leak *reporting* on the commit path, not cleanup success on the abort path. One correction: a **fourth** case reaches `abortHandles` (`'a marketplace removed under an in-flight update...'`, 8077) and likewise omits the check — the fix case the finding prescribes should cover it too.
- **CONFIRMED** — *warm sha-pinned-cache offline proof checks only `cloneCalls`* (WARNING) — 6483 asserts one array; the sibling at 1232 asserts four. A spurious warm-path `fetch`/`checkout`/`resolveRemoteRef` survives.
- **UNDERSTATED** — *inconsistent AAA phase-comment discipline* (WARNING) — real and the severity fits, but the recorded scope ("concentrated in the earlier PUP-*-numbered section") is wrong: in this range 16 of 22 cases (7281–8473) are unlabeled while 6 (7813, 7842, 8077, 8122, 8167, 8217) are labeled — the drift runs to the end of the file. A fixer scoping the fix to the PUP section would leave most of it in place.
- **CONFIRMED** — *`makeCtx()` double-cast to full host interfaces* (WARNING) — verified at 225–241; correctly deferred to the repo-wide notify-parameter ticket (META-FINDINGS item 1), which owns the production fix.

### `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`

- **CONFIRMED** — *seven `as Error` casts on caught `unknown`* (WARNING) — all seven verified. Strengthening evidence for the prescribed fix: the direct boundary already normalizes via `instanceof` (`notifyDirectFailure`, 2836) **and has a test pinning that normalization** (`'syncClone-fail: a non-Error injected rejection is normalized at the direct boundary'`, 2935) — so the bare-form arm's cast at 534 is the one enumerate path where a non-Error would flow through unnormalized into a row `cause` typed `Error`.
- **CONFIRMED** — *`updateSinglePlugin` reads `process.cwd()`* (WARNING) — verified at 608; this range adds two more `process.chdir` dances (8358–8365, 8485–8493) to the 17 the first pass counted.
- **CONFIRMED** — *two inline `new Date().toISOString()` calls* (WARNING) — verified at 1713 (`refreshDisabledRecord`) and 1983 (`finalizeUpdateRecord`). Note the flip side: because the *seeded* `updatedAt` is a fixed literal, the new-BLOCKER fix above can assert no-write via the stamp without needing a clock seam.
- **CONFIRMED** — *`UpdatePluginsOptions` lacks a top-level doc comment* (WARNING) — verified at 225; `UpdateCloneCacheSeam` at 213 has one.

The first-pass module-split recommendation (preflight / swap / cascade seams) is
consistent with what this pass saw: the rare-failure arms and their tests would have
been materially easier to audit as a `update-swap` pair.

## Still clean after attack

Mutations this range's cases genuinely kill — do not spend fixing-pass time here:

- `tests/orchestrators/plugin/update.test.ts:7482/7532/7574` (WR-12 trio, message
  content) — dropped summary line, wrong glyph/token/grammar, reordered
  `{malformed skill, malformed command}` tokens, dropped warning raise: all fail the
  byte-exact `assert.equal` on the full message. The canonical emit order via
  `malformedReasonsForKinds` is pinned by the both-kinds case.
- `7736` + `8473` (NREG-01 pair) — unconditional `degradedKinds`/`orphanRewake`/
  `notes` spreads (the optional-field silent-omission class this repo has shipped
  three times) are killed from both the rendered side (byte-equal clean row) and the
  outcome-shape side (`!Object.hasOwn(outcome, "notes")`).
- `7678` (CR-01) — reintroducing the mapper short-circuit that picks
  `partially-installed` before reading the malformed axis fails the byte compare of
  the two-token brace; the warning raise on the malformed axis alone is pinned by
  the accompanying severity assertion and its rationale comment.
- `7619` (orphan rewake) — token presence, byte-exact row, and the
  stays-info promise (`severity === undefined`) are all asserted.
- `7963/8023` (ST-9) — removing either ST-9 guard flips the asserted record fields
  (`version`, `resolvedSha`, resurrection); the no-intent-mark-leak claim is pinned
  by `compatibility.notes` deep-equal `[]`. The commit-before-mark reorder mutation
  is killed by the `watchStateTransition` siblings at 1693/1761/1813, not here.
- `8077/8122/8167` — all three resurrection mutations (marketplace by
  `markUpdateInProgress`, marketplace and plugin by `refreshDisabledRecord`) fail
  the final-state deep-equals.
- `8298/8425/8344` (D-141-03) — diagnostic-before-row order swap, first-outcome-only
  iteration, and both directions of the cascade/standalone warning-split flip are
  each killed, the last with an explicitly anchored positive control whose comment
  even explains why it anchors on the row prefix rather than the singular/plural
  tail.
- `7281` (SUB-02) — per-bridge `cwd`-drop mutations fail the positive+negative
  substring pair per file; `${CLAUDE_SKILL_DIR}` over-substitution in commands and
  agents fails the literal-preservation asserts.
- `7383` (MENV-04) — re-deriving mcp.json from a stale read-back fails the
  `OLDROOT`-substring-must-not-survive check; the first-update positive control
  guards fixture rot.

## Not covered

- Lines 651–7269 of the test file belong to the A/B adversarial slices; I read
  1591–2060, 2705–3400, 5834–5878, and 6216–6500 only to settle whether sibling
  cases kill mutations my range survives, and did not grade those sections.
- The `commitUpdatePhase3a` commands-catch (`update.ts:2099–2103`) appears untested
  file-wide, but the authoritative check belongs to the slice that owns the phase-3
  sections — recorded above as reachable-untested pending their confirmation.
- The `runDisabledRecordRefresh` GC-sweep arm (`wrote === true`) is owned by the
  out-of-range PURL/ENBL-09 section; I did not verify whether that section asserts
  the sweep.
- No coverage tooling was run (diagnostic constraint); all branch claims are from
  reading.

## Meta-findings impact

### New cross-cutting evidence

- **Fragment assertions concentrate in rare-failure/race sections while the happy
  and degraded sections of the *same file* use byte-exact compares.** In this file:
  7778–8215 (all regex fragments) vs. 7482–7770 (all byte-exact). META item 3's file
  list is built per-file; this suggests the class is better hunted per-*section* —
  the failure arms of `install.test.ts`, `reinstall.test.ts`, and
  `enable-disable.test.ts` should be checked for the same concentration even where
  the file as a whole was described as strong.
- **Race/acceptance cases that assert only a notification count.** The 8217 shape —
  "accepts X" proven by `notifications.length === 1` with the message unread — is
  easy to write in any ST-9-style concurrency case. Areas with concurrency guards
  (install CR-01 lock cases, reinstall, marketplace add/update races) should be
  grepped for count-only assertions on acceptance-shaped titles.
- **Scope-fallback defaults pinned only on the default side.** `update.ts` mirrors
  `reinstall.ts`'s bare-form synthetic-row precedent (`"(reinstall)"`, per the
  comment at `update.ts:2935–2941`); if reinstall's emitter has the same
  `scope ?? ...` shape, its tests likely have the same one-sided pin. The
  edge-handlers areas that thread `--scope` into orchestrators are the other place
  this shape recurs.

### Corrections to META-FINDINGS.md

- META item 3's table ("Replace fragment assertions on rendered messages") does not
  list `orchestrators/plugin/update.test.ts`; this pass found ~8 in-range cases in
  the class (representative: 7798–7805, 7833–7834, 8113–8114). Add it with the
  section qualifier above — the fix is again propagation from the byte-exact
  siblings 30 lines up, not invention.
- No other META claim is contradicted. Its caution that "clean verdicts are not
  reliable" is validated in the small: the first pass's blanket "none of the
  remaining structure has findings" for this file concealed one BLOCKER and four
  WARNINGs in a 1,232-line slice.

### Confirmations

- **META item 2 (test-only reset hooks over module-global state)** — confirmed from
  a second angle: `resetRoutingState()` is dynamically imported and called at the
  top of five cases in this file (5514, 5623, 5693, 5772, 7630) because production
  `rebuildRoutingTables()` (via `refreshHooksCacheAfterUpdate`) leaks routing state
  across cases; the reset-at-start convention is the workaround META's
  factory-owned-state fix would delete.
- **META item 1 (over-wide ctx/pi parameters force casts)** — confirmed: the single
  `makeCtx()` helper (225–241) double-casts object literals to `ExtensionContext`/
  `ExtensionAPI` and every one of the file's 132 cases flows through it.
- **META "Patterns to propagate" (whole-message assertion)** — confirmed and
  extended: the WR-12/CR-01/NREG-01 cases are model in-orchestrator instances of the
  byte-exact form (not only `*.messaging.test.ts`), and NREG-01's rendered+shape
  pairing (7736 + 8473) is a ready-made template for killing the repo's
  optional-field silent-omission class.
