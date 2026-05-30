# Quick 260530-7pk: Fix PR #22 Review Findings Summary

One-liner: Reconciled stale CI test assertions to the V2 folded renderer
output, restored dropped error diagnostics (bootstrap IL-2 catch, marketplace
update/autoupdate cause-surfacing, AS-7 leaked-path naming), tightened
closed-set reason types, swept GSD-process comment-rot from the
error/transaction/notify/orchestrator core, and corrected the NFR-4 Node floor
to `>=20.19.0` -- all three CI gates GREEN.

## Final Green-Gate Results

| Gate                                       | Result | Counts          |
| ------------------------------------------ | ------ | --------------- |
| `npm run check` (typecheck+lint+format+test)| exit 0 | 1143 pass / 0 fail (incl. catalog-uat byte gate) |
| `npm run test:integration`                 | GREEN  | 4 pass / 0 fail |
| `PI_CM_E2E_REF=pinned npm run test:e2e`     | GREEN  | 14 pass / 0 fail |

The catalog-uat byte-equality gate (inside `npm run check`) stayed GREEN
end-to-end; no renderer files were modified for the test reconciliation.

## Task Commits

| Task | Group | Commit  | Title |
| ---- | ----- | ------- | ----- |
| 1    | A1    | 592a0e5 | reconcile fold/import asserts to V2 output (amended to fix lint) |
| 2    | A2    | e10aada | route bootstrap failure through notify (IL-2) |
| 3    | B1+B2 | 30e081b | surface dropped update/autoupdate causes |
| 4    | B3    | ba27c78 | name leaked paths on manual recovery (AS-7) |
| 5    | C1+C2+C5 | f271bc7 | tighten reasons types + dedup resolver |
| 6    | C3+C4 | 82fe59f | MAX_DEPTH cause-chain tests + migrate note |
| 7    | D.1   | f953b44 | comment-rot sweep (error/txn/notify core) |
| 8    | D.2   | 402d6df | fix reload-hint comments + dead refs |
| 9    | D.3   | ec77146 | comment-rot residual sweep (plan-touched) |
| 10   | E     | 3800371 | correct NFR-4 Node floor to >=20.19.0 (non-PRD) |
| 11   | E+F   | 015e8f6 | PRD NFR-4 floor + PU-4/AS-6 leak policy |
| 12   | gate  | (no-op) | final green-gate verification -- all three GREEN, no regression |

## What Changed

- **A1 (Task 1):** Reconciled `tests/integration/fold-adoption.test.ts`
  install-success check and three `tests/e2e/import-command.test.ts` tests to
  the V2 folded marketplace-header + indented-child output (captured byte-for-
  byte during execution). The V2 renderer output was confirmed correct (catalog
  UAT byte gate). No renderer change.
- **A2 (Task 2):** Wrapped `bootstrapClaudePlugin` in a handler-level catch that
  routes a thrown failure through `notify()` as a failed marketplace row;
  exported `BOOTSTRAP_MARKETPLACE_NAME`. Closes the IL-2 raw-stack-trace leak.
- **B1/B2 (Task 3):** `refreshOneMarketplace` and the autoupdate
  `!shouldCollectNotFound` branch now bind `err` and attach a synthetic
  `PluginFailedMessage` child carrying `cause: err`, so the underlying
  diagnostic (and the `StateLockHeldError` retry message) reaches the user
  instead of a bare `(failed)`.
- **B3 (Task 4):** `composePluginLines` walks the cause chain for a
  `ManualRecoveryError` and renders each leaked path as a `leaked: <path>`
  child row (AS-7); added two notify-v2 tests.
- **C1/C2/C5ii (Task 5):** `composeReasons` param/accumulator are
  `readonly Reason[]`; `narrowResolverReasons` dedups (first-seen order); the
  reinstall arm comment was corrected.
- **C3/C4 (Task 6):** Clarified the migrate.ts eslint override (the single IL-3
  load-time warn callsite trips BOTH rules); added four `causeChainTrailer`
  MAX_DEPTH=5 tests (6-deep truncates, exactly-5 no marker, self/2-node cycle
  terminates, undefined/null -> "").
- **D (Tasks 7-9):** Repo-wide comment-rot sweep on the review-flagged + plan-
  touched files; removed GSD process narration (`D-NN-NN`, `Plan NN`,
  `Phase NN`, `Wave N`, `CONTEXT line`, quick-task IDs), V1-vs-V2 history and
  tombstones (`GONE`/`REMOVED`/`RETIRED`/`FOLDED`), dead-module/dead-symbol refs
  (`presentation/*`, `shared/grammar/*`, `notifyError`, `renderManualRecovery`,
  `SoftDepProbe`, `renderRow`, `outcomeToCascadeRow`, `RowSpec`, retired
  `PluginListPayload` type), the stale `10-variant` count (-> 11), and the
  brittle `execute.ts:890` line ref. Retained requirement IDs. Highest-priority
  fix: the contradictory `shouldEmitReloadHint` comments in marketplace
  update.ts/autoupdate.ts that falsely claimed the `/reload` trailer fires on
  `mp.status === "updated"` -- corrected to describe the actual plugin-row-only
  trigger. `D-16-12` count across `extensions/` is now 0.
- **E (Tasks 10-11):** NFR-4 now states Node `>=20.19.0` in the PRD,
  CLAUDE.md (Constraints + Tech-Stack table; Developer Profile untouched),
  PROJECT.md, and the v1.3 milestone REQUIREMENTS, matching
  `package.json` engines (`>=20.19.0`).
- **F (Task 11):** PRD PU-4 and AS-6 now record that post-commit cleanup leaks
  are intentionally NOT surfaced (cleanup runs after the durable atomic state
  save, so a leak cannot corrupt state; the warning was dropped to reduce
  noise). AS-7 left intact. No code/test change.

## Deviations from Plan

### [Rule 1 - Bug] Task 1 test assertions tripped ESLint (folded into Task 1)

- **Found during:** Task 2 (`npm run check`).
- **Issue:** The Task 1 test edits used regex forms with literal spaces that the
  project's `no-regex-spaces` / `prefer-includes` lint rules reject. The
  pre-commit `npm lint` hook does not run on test files (file-glob filter), so
  the original Task 1 commit passed its hook but `npm run check` (the green
  gate) caught the lint errors.
- **Fix:** Rewrote the assertions to use `String#includes` / `{2}` regex
  quantifiers; amended the Task 1 commit (`592a0e5`) since the hooks had passed
  and the work was unshared.

### [Plan divergence] Task 5 C5(i) -- rollbackPartial[].phase stays `string`

- **Plan instruction:** Tighten `PluginFailedMessage.rollbackPartial[].phase`
  to the closed `UpdatePhaseBridge` union (`"skills"|"commands"|"agents"|"mcp"`).
- **Reality found:** The field is fed by `transaction/phase-ledger.ts`
  `RollbackPartial.phase`, which is a free-form `string`. Two producers use
  DIFFERENT phase vocabularies: the install path emits `phase3a`/`phase3b`
  (and the catalog-uat fixtures assert those byte forms), while the update path
  emits bridge names. Narrowing to the 4-member union made `tsc` fail at
  `install.ts:1062` and the catalog fixtures.
- **Resolution:** Reverted the C5(i) narrowing; the renderer field correctly
  stays `string`. Added a comment documenting why. C1, C2, and C5(ii) shipped
  as planned. This is the only place where a planned "tightening" genuinely
  contradicted the V2 producer contract.

### [Plan refinement] Task 3 retry-hint surfacing

- The plan suggested the cause-chain trailer would carry
  `MarketplaceUpdateError.retryHint` "via its `.message`/cause". In fact
  `retryHint` is a SEPARATE field on `MarketplaceUpdateError`, not folded into
  `.message`. The synthetic-child cause chain surfaces the error's diagnostic
  message (the core value of B1 -- no more bare `(failed)`); the literal
  "Retry the command." anchor remains on `.retryHint` for programmatic
  inspection. The four affected tests were reconciled to assert the surfaced
  cause rather than the literal retry-hint string. No change to the error class.

### [Plan refinement] Task 4 chose approach (a) over (b)

- The plan offered approach (a) render-side or (b) embed-in-message. Chose (a)
  (render `err.leaks` at the notify boundary) because approach (b) would
  double-list leaks in the reinstall `errorWithManualRecovery` merge path
  (`reinstall.ts:1281` re-wraps an inner `ManualRecoveryError`'s message).
  Approach (a) keeps `.leaks` as the single structured source of truth. As a
  result, `shared/errors.ts` (listed in Task 4's `<files>`) was not modified.

### [Scope] D-16-12 sweep touched files outside Task 8's `<files>`

- Task 8's verify requires `grep -rn "D-16-12" extensions/` to return 0. To
  satisfy it, the `D-16-NN` decision-ID tokens were removed (comment-only) from
  add.ts, marketplace/list.ts, remove.ts, uninstall.ts, plugin/list.ts,
  import/execute.ts in addition to the Task-8 `<files>`. These are token-level
  removals, not full narration rewrites (the plan scopes the broader sweep out).

### [Verify-regex false positive] list.test.ts `loadPluginListPayload`

- The Task 8 verify regex forbids the substring `PluginListPayload`. The retired
  TYPE `PluginListPayload` is gone, but the live FUNCTION `loadPluginListPayload`
  is still referenced in a `tests/orchestrators/plugin/list.test.ts:449` comment
  that correctly describes current code. Left as-is (it describes the current
  symbol); the regex match is an overly-broad substring false positive.

### [Shared-file commit] Tasks 10 + 11 both edit the PRD

- Task 10 (NFR-4 PRD row) and Task 11 (PU-4/AS-6) both modify
  `docs/prd/pi-claude-marketplace-prd.md`. Git cannot split one file across two
  commits non-interactively, so the PRD changes for BOTH tasks landed in the
  Task 11 commit (`015e8f6`); the non-PRD Task 10 files (CLAUDE.md, PROJECT.md,
  milestone REQUIREMENTS) are in the Task 10 commit (`3800371`).

## write-file-atomic Engine Note

Not applicable to this task -- no dependency versions were changed. For the
record, the historical `write-file-atomic@^8` engine concern is already
resolved on `main`: `package.json` engines is `>=20.19.0` and the dependency
is pinned at `write-file-atomic@^7` (whose engine range is compatible). NFR-4
was corrected to match this `>=20.19.0` floor (Tasks 10/11).

## Self-Check: PASSED

- All 11 task commits present in `git log` (592a0e5, e10aada, 30e081b, ba27c78,
  f271bc7, 82fe59f, f953b44, 402d6df, ec77146, 3800371, 015e8f6).
- `npm run check` exit 0 (1143/1143); `npm run test:integration` GREEN (4/4);
  `PI_CM_E2E_REF=pinned npm run test:e2e` GREEN (14/14).
- `grep -rn "D-16-12" extensions/` returns 0.
- NFR-4 reads Node `>=20.19.0` in PRD/CLAUDE.md/PROJECT.md, matching
  `package.json` engines.
