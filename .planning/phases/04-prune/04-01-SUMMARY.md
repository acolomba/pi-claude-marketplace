---
phase: 04-prune
plan: "01"
subsystem: testing
tags: [cucumber, prune, ITMIG-08, ITSCOPE-01, D-05-13, D-12-01, PRN-03, D-02-05, D-05-04, D-05-07, D-04-03]

requires:
  - phase: 03-marketplace-layers-and-cross-scope-install
    provides: the break helper pattern and the red-proof SUMMARY record
provides:
  - twelve new prune scenarios (E01, M01, FL01, S01, C01, A01, P01, N02, U01, F01, F02, L01), four of them Outlines with 20 rows
  - the new verb module features/step_definitions/plugin/prune.steps.ts with three Givens (the stated preview, the record the prune cannot read, the repair of the skill directories a failed prune left)
  - test/integration/standalone-prune.test.ts trimmed to its two call-absence carriers under an ITSCOPE-01 header
  - the multi-edit break helper $D/break.sh that plan 04-02 reuses
affects: [04-02-backup-leak-fix, phase-08-internal-cases]

actuals:
  tokens: 13766
  tasks: 3
  commits: 3
plan_head_before: ee04e7ee5d6af34d91c4c8066c676cf139bda69c
plan_head_after: 17ee478e392c8f20ea938a2724467bbb3cf1531f

tech-stack:
  added: []
  patterns:
    - "A Given that runs a prune preview and states its rows, so a preview-then-prune scenario keeps to one When"
    - "A break file is a JSON array of [file, old, new] triples; the helper applies them in order and restores all of extensions/ in its EXIT trap"

key-files:
  created:
    - features/step_definitions/plugin/prune.steps.ts
  modified:
    - features/plugin/prune.feature
    - test/integration/standalone-prune.test.ts

key-decisions:
  - "K2 (an actual prune that saves an unchanged record with the same bytes) is the accepted survivor: a user sees no change, and the whole-scope step compares bytes, not mtimes (CONTEXT [Same-bytes save])"
  - "standalone-prune keeps the actual-prune and the --dry-run carriers for ITSCOPE-01: the throwing reconcile and missing-dependency seams, the git double, and the preview's mtime checks"

patterns-established:
  - "Prune step texts name prune (D-08) and live in features/step_definitions/plugin/prune.steps.ts"

requirements-completed: [ITMIG-08]

coverage:
  - id: D1
    description: "Each empty-scope form of prune and prune --dry-run, with and without --scope, reports prune-empty for its scope and changes no file; both forms report a record that is not valid JSON with the redacted state.json cause and no sandbox path"
    requirement: ITMIG-08
    verification:
      - kind: e2e
        ref: "features/plugin/prune.feature#Pruning a scope with nothing to remove reports the empty scope and changes no file of it (D-12-01)"
        status: pass
      - kind: e2e
        ref: "features/plugin/prune.feature#Pruning reports an installation record that is not valid json without its path and changes no file (PRN-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Held neighbours kept across alternating marketplaces, a prune that selects again after a stale preview, a failed member kept until a retry removes both, a preview with no project record, an unreadable declarer refused, a project-only prune, a dependent-first chain, and a legacy record preview"
    requirement: ITMIG-08
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/prune.feature (40 scenarios (40 passed))"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin --parallel 2 features/plugin/prune.feature (0 scenarios, DUAL-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "prune -y, --keep-data, --prune, --bogus, and an extra argument are refused with the prune usage line, both scopes unchanged"
    requirement: ITMIG-08
    verification:
      - kind: e2e
        ref: "features/plugin/prune.feature#Pruning refuses a flag or an argument it does not take before it selects any dependency (D-02-05)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 23 replaced integration cases are deleted after their breaks failed every replacing scenario and row; the two kept carriers pass"
    requirement: ITMIG-08
    verification:
      - kind: integration
        ref: "test/integration/standalone-prune.test.ts (2 of 2 pass)"
        status: pass
      - kind: other
        ref: "npm run check:static on 17ee478 (exit 0)"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-11-22
status: complete
---

# Phase 4 Plan 01: Prune scenarios and the standalone-prune trim Summary

**Twelve prune scenarios (28 new rows) and three prune Givens replace 23 cases of `standalone-prune`; 26 of 27 deliberate breaks failed their scenarios on an assertion, K2 survives as accepted, and the integration file keeps only its two ITSCOPE-01 call-absence carriers.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-11-22T01:09:58Z
- **Completed:** 2026-11-22T01:29:00Z
- **Tasks:** 3
- **Files modified:** 3 (one created)

## Accomplishments

- E01, M01, FL01, and U01 are Outlines with 7, 4, 5, and 4 rows. S01, C01, A01, P01, N02, F01, F02, and L01 are plain scenarios. All 40 scenarios of `prune.feature` pass under `adapter`; `builtin` selects none (DUAL-02).
- Every new scenario and every new row failed on an assertion under at least one break. No log holds a cucumber step timeout.
- The already-covered scenarios failed under their breaks: `state-lock.feature:331` and `:358` (K18), `prune.feature:15` and `:60` (K19), `:92` and `:122` (K20), `usage-errors.feature:135` (K21), `:102` (K22), and `:88` and `:91` (K29).
- `test/integration/standalone-prune.test.ts` keeps only "prune removes an orphan dependency through the registered command" and "prune --dry-run previews the orphan without writing current state", byte for byte, under a header that names ITSCOPE-01.

## Task Commits

1. **Task 1: preview Given, S01, tracer K8, the stale-preview case deleted** - `9d851be` (test)
2. **Task 2: the other eleven scenarios with the record and repair Givens** - `8744eae` (test)
3. **Task 3: break runs and the trim to the two carriers** - `17ee478` (test)

**Plan metadata:** the commit that adds this SUMMARY.

## Files Created/Modified

- `features/step_definitions/plugin/prune.steps.ts` - new verb module: `the user has previewed the prune with {string}, which listed these plugins:`, `the installation record of the {word} scope to prune is not valid json`, `the user has made the skills the prune could not remove in the {word} scope writable`, and the module-private `extensionRoot`. Bodies copied from RESEARCH "Code Examples"; the no-backup `Then` is left out for plan 04-02.
- `features/plugin/prune.feature` - twelve scenarios after line 292, in the order E01 (`:294`), M01 (`:321`), FL01 (`:351`), S01 (`:383`), C01 (`:415`), A01 (`:440`), P01 (`:497`), N02 (`:521`), U01 (`:545`), F01 (`:586`), F02 (`:617`), L01 (`:642`). No existing line changed (the diff from the plan base has no `-` line); no tag, no Background.
- `test/integration/standalone-prune.test.ts` - the stale-preview case deleted in Task 1; in Task 3 the other 21 replaced cases, the three `for` loops, `GraphPlugin`, `seedGraphScope`, `installedKeys`, and the `proper-lockfile` import deleted, and the header added. `pluginRecord`, `seedScope`, `scopeTree`, and `registeredCommand` are unchanged.

## Red proofs

- Scratch folder: `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/phase04-plan01` (`$D`). Every command script named below is kept there.
- Checkout root, the first line of every break log: `root=/home/user/pi-claude-marketplace/.claude/worktrees/agent-a701de1134e75b03c`.
- Plan base (`$D/plan-base`): `ee04e7ee5d6af34d91c4c8066c676cf139bda69c`. `git diff --stat c782fb1 HEAD -- extensions features test` printed nothing, so every site line of the plan holds.
- Helper: `$D/break.sh`, adapted from `phase03-plan03/break.sh`. Differences: its arguments are `<id> <profile> <edits file> <cucumber args...>`; the edits file is a JSON array of `[file, old, new]` triples relative to `extensions/pi-claude-marketplace/`, applied in order with `node`, each old text replaced only when it occurs exactly once (else exit 3, nothing run); the EXIT trap runs `git checkout -- extensions/` instead of one file; the run passes `--parallel 2`. Unchanged: it roots at `git rev-parse --show-toplevel` and logs `root=`, refuses a dirty `extensions/` (exit 4), appends `git diff -- extensions/`, runs `npm run --silent test:cucumber:profile` with the nondac prefix, and appends `exit=` and `restored=`. `bash -n` passed; `grep -c 'rev-parse --show-toplevel'` is 1; `grep -c '/home/user/pi-claude-marketplace'` is 0.
- Break files: the 27 files `research-04/brk/K*.json` copied to `$D/brk/` with `cp -p`; each parses with `JSON.parse`, and `cmp` with its source printed nothing.
- Green runs (adapter, `features/plugin/prune.feature`): `green-prune-1.log` `13 scenarios (13 passed)`, exit 0 (Task 1); `green-prune-2.log` `40 scenarios (40 passed)`, exit 0 (Task 2).
- Builtin run: `builtin.log` `0 scenarios`, exit 0 (DUAL-02).
- Every Task 3 break ran on the committed tree of `8744eae` with `bash "$D/break.sh" <id> adapter "$D/brk/<id>.json" features/plugin/prune.feature features/plugin/state-lock.feature features/plugin/usage-errors.feature` (driver `$D/run-breaks.sh`, progress in `$D/breaks-progress.txt`). Every log ran `171 scenarios`, ends with `restored=clean`, and holds no `function timed out`; `git status --porcelain -- extensions/` printed nothing after each. No run needed a rerun. Unless a bullet says otherwise, the first error line is `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`.

Outline rows by line: E01 `:313` `prune`, `:314` `prune --scope user`, `:315` `prune --scope project`, `:316` `prune --dry-run`, `:317` `prune --scope user --dry-run`, `:318` `prune --dry-run --scope project`, `:319` `prune --scope project --dry-run`; M01 `:346` `prune`, `:347` `prune --dry-run`, `:348` `prune --scope project`, `:349` `prune --scope project --dry-run`; FL01 `:377` `-y`, `:378` `--keep-data`, `:379` `--prune`, `:380` `--bogus`, `:381` `lib@tools`; U01 `:581` `prune`, `:582` `prune --dry-run`, `:583` `prune --scope project`, `:584` `prune --scope project --dry-run`.

- **K8, tracer** (`K8-tracer-adapter.log`, Task 1, tree with S01 only): `orchestrators/plugin/prune.ts:235`, `:242`, `:291`: `+  let cached: Awaited<ReturnType<typeof buildScopeDeclarationIndex>> | undefined;` before `return async (options)`, `+        cached = snapshot;` after the preview's `buildScopeDeclarationIndex`, and `-          const snapshot = await buildScopeDeclarationIndex({ state: tx.state, locations });` / `+          const snapshot = cached ?? (await buildScopeDeclarationIndex({ state: tx.state, locations }));`. Command: `bash "$D/break.sh" K8-tracer adapter "$D/brk/K8.json" features/plugin/prune.feature`. `13 scenarios (12 passed, 1 failed)`, `exit=1`. Failed: S01 `prune.feature:294` at `Then the result lists these plugins:`, the row reads `old@tools old ... 1.1.0` for `fresh@tools fresh ... 1.2.0`. None of the twelve existing scenarios failed.
- **K1** (`K1-adapter.log`): `prune.ts:236`, `-    const scope = options.scope ?? "user";` / `+    const scope = options.scope ?? "project";`. `171 scenarios (161 passed, 10 failed)`, `exit=1`. Failed: `prune.feature:60` "Pruning without a scope prunes the user scope alone" at `Then the result lists these plugins:` (row `project mid@tools` for `user lib@tools`); E01 `:313`, `:316` at `Then the result has these fields:`; M01 `:346`, `:347` at `Then the result has these fields:`; U01 `:581`, `:582` at `Then the result lists these plugins:`; S01 `:383` and C01 `:415` at the preview Given, first error `AssertionError [ERR_ASSERTION]: expected a cascade, reconcile-applied-cascade, or plugin-info-cascade result, got {"schemaVersion":1,"kind":"prune-empty",...,"scope":"project"}`; L01 `:642` at `Then the result has these fields:`.
- **K2, the accepted survivor** (`K2-adapter.log`): `prune.ts:325`, `-            if (members.length > 0) {` / `+            if (members.length >= 0) {`. `171 scenarios (171 passed)`, `exit=0`. An actual prune that removes nothing saves the unchanged record with the same bytes. A user sees no change, and `the files of the {word} scope are unchanged` compares bytes, not mtimes; the deleted empty-scope cases compared mtimes. CONTEXT [Same-bytes save] accepts it; the shared step is unchanged.
- **K3** (`K3-adapter.log`): `prune.ts:107`, `-      : (redactCauseChain(error) ?? new Error(errorMessage(error)));` / `+      : error;`. `171 scenarios (167 passed, 4 failed)`, `exit=1`. Failed: M01 `:346`, `:347`, `:348`, `:349`, each at `Then the result lists these plugins:` (the cause chain is the unredacted one).
- **K4** (`K4-adapter.log`): `prune.ts:275`, `-        notifyOperationFailure(options, scope, error);` / `+        notify(options.ctx, options.run, { kind: "prune-empty", scope });`. `171 scenarios (169 passed, 2 failed)`, `exit=1`. Failed: M01 `:347`, `:349` at `Then the result has these fields:`.
- **K5** (`K5-adapter.log`): `edge/handlers/shared.ts:151`, `-  return token.startsWith("-");` / `+  return token.startsWith("--");`. `171 scenarios (170 passed, 1 failed)`, `exit=1`. Failed: FL01 `:377` (`-y`) at `Then the result has these fields:`.
- **K6** (`K6-adapter.log`): `edge/flag-catalog.ts:200`, `-  prune: [DRY_RUN_FLAG_ENTRY],` / `+  prune: [DRY_RUN_FLAG_ENTRY, KEEP_DATA_FLAG_ENTRY],`. `171 scenarios (170 passed, 1 failed)`, `exit=1`. Failed: FL01 `:378` (`--keep-data`) at `Then the result has these fields:`.
- **K7** (`K7-adapter.log`): `edge/flag-catalog.ts:200`, `+  prune: [DRY_RUN_FLAG_ENTRY, PRUNE_FLAG_ENTRY],`. `171 scenarios (170 passed, 1 failed)`, `exit=1`. Failed: FL01 `:379` (`--prune`) at `Then the result has these fields:`.
- **K8** (`K8-adapter.log`): the three edits of the tracer. `171 scenarios (168 passed, 3 failed)`, `exit=1`. Failed: S01 `:383` at `Then the result lists these plugins:`; A01 `:440` at `Then the installation record of the project scope holds these plugins:`; C01 `:415` at `Then the user scope has no installed plugins`.
- **K9** (`K9-adapter.log`): `orchestrators/plugin/uninstall.ts:1011`, `-    if (result.removed) {` `-      gone.add(member.key);` `-    }` / `+    gone.add(member.key);`. `171 scenarios (169 passed, 2 failed)`, `exit=1`. Failed: F01 `:586` and F02 `:617`, each at `Then the result lists these plugins:`.
- **K10** (`K10-adapter.log`): `uninstall.ts:942`, `+  Object.assign(member.record, { provenance: "explicit" });` after the failure cause. `171 scenarios (170 passed, 1 failed)`, `exit=1`. Failed: F02 `:617` at `Then the result has these fields:`.
- **K11** (`K11-adapter.log`): `orchestrators/plugin/dependency-index.ts:485`, `-      index.set(key, new Set(read.declared.map(declarationKey)));` / `+      index.set(key, new Set(record.enabled ? read.declared.map(declarationKey) : []));`. `171 scenarios (168 passed, 3 failed)`, `exit=1`. Failed: `prune.feature:194` "Pruning keeps a dependency that only a disabled plugin needs" at `Then the result has these fields:`; `:217` "Pruning removes a disabled dependency that nothing needs and what only it needs" at `Then the result lists these plugins:`; A01 `:440` at the preview Given.
- **K12** (`K12-adapter.log`): `prune.ts:248`, `-        const marketplaces = order.flatMap((key) =>` / `+        const marketplaces = [...order].reverse().flatMap((key) =>`. `171 scenarios (169 passed, 2 failed)`, `exit=1`. Failed: C01 `:415` and A01 `:440`, each at the preview Given.
- **K13** (`K13-adapter.log`): `prune.ts:236`, `+    const scope = options.dryRun === true ? (options.scope ?? "user") : "user";`. `171 scenarios (154 passed, 17 failed)`, `exit=1`. Failed: P01 `:497` at `Then the result lists these plugins:`; M01 `:348`; U01 `:583` (`Then the result lists these plugins:`); E01 `:315`; F01 `:586`; F02 `:617` at `Given the user has run "/claude:plugin prune --scope project", which warned`; A01 `:440`; existing `prune.feature:7`, `:15`, `:34`, `:152`, `:171`, `:194`, `:217`, `:240`, `:261`; `state-lock.feature:331`. Unless named, at `Then the result has these fields:`.
- **K14** (`K14-adapter.log`): `prune.ts:240`, `+        await (await import("node:fs/promises")).mkdir(locations.extensionRoot, { recursive: true });` before the preview's `loadState`. `171 scenarios (170 passed, 1 failed)`, `exit=1`. Failed: N02 `:521` at `Then the files of the project scope are unchanged`.
- **K15** (`K15-adapter.log`): `dependency-index.ts:480`, `-        return read;` / `+        continue;`. `171 scenarios (167 passed, 4 failed)`, `exit=1`. Failed: U01 `:581`, `:582`, `:583`, `:584`, each at `Then the result has these fields:`.
- **K16** (`K16-adapter.log`): `prune.ts:240`, `{ persistMigration: false }` / `{ persistMigration: true }`. `171 scenarios (170 passed, 1 failed)`, `exit=1`. Failed: L01 `:642` at `Then the files of the user scope are unchanged`.
- **K18** (`K18-adapter.log`): `prune.ts:120`, `+  } else if (error instanceof StateLockHeldError && process.env.NEVER_SET === "x") {`. `171 scenarios (169 passed, 2 failed)`, `exit=1`. Failed: `state-lock.feature:331` "Pruning the project scope while another process holds its state lock fails as lock held" and `:358` "Pruning the user scope while another process holds its state lock fails as lock held", each at `Then the result lists these plugins:`.
- **K19** (`K19-adapter.log`): `uninstall.ts:926`, `+    // args.transaction.commitPluginRemoval(member.marketplace, { plugin: member.plugin });`. `171 scenarios (160 passed, 11 failed)`, `exit=1`. Failed: `prune.feature:15` "Pruning a scope uninstalls a dependency that no installed plugin needs" at `Then the project scope has no installed plugins`; `:60` at `Then the user scope has no installed plugins`; `:34`, `:217`, `:240` at `Then the project scope has no installed plugins`; F01 `:586`, A01 `:440`, S01 `:383` at the record step; P01 `:497`, C01 `:415` at the no-installed-plugins step; F02 `:617` at `Then the result lists these plugins:`.
- **K20** (`K20-adapter.log`): `prune.ts:260`, `-                  needsReload: false,` / `+                  needsReload: true,`. `171 scenarios (169 passed, 2 failed)`, `exit=1`. Failed: `prune.feature:92` "Previewing a prune of the user scope lists only its dependency and removes nothing" and `:122` (project), each at `Then the result has these fields:`.
- **K21** (`K21-adapter.log`): `edge/handlers/plugin/prune.ts:39`, `-      if (parsed.positional.length > 0) {` / `+      if (parsed.positional.length > 1) {`. `171 scenarios (169 passed, 2 failed)`, `exit=1`. Failed: `usage-errors.feature:135` "A plugin subcommand rejects more arguments than it takes" and FL01 `:381` (`lib@tools`), each at `Then the result has these fields:`.
- **K22** (`K22-adapter.log`): `edge/handlers/plugin/prune.ts:30`, `+    if (scanned.local && process.env.NEVER_SET === "x") {`. `171 scenarios (170 passed, 1 failed)`, `exit=1`. Failed: `usage-errors.feature:102` "A plugin subcommand rejects a flag it does not accept" at `Then the result has these fields:`.
- **K24** (`K24-adapter.log`): `prune.ts:243`, `-          notifyUnreadable(options, scope, snapshot.declarer, snapshot.cause);` / `+          notify(options.ctx, options.run, { kind: "prune-empty", scope });`. `171 scenarios (169 passed, 2 failed)`, `exit=1`. Failed: U01 `:582`, `:584` at `Then the result has these fields:`.
- **K25** (`K25-adapter.log`): `prune.ts:173`, `{ kind: "prune-empty", scope }` / `{ kind: "prune-empty", scope: "user" }` in the actual run. `171 scenarios (166 passed, 5 failed)`, `exit=1`. Failed: E01 `:315`; existing `prune.feature:7`, `:152`, `:171`, `:194`; all at `Then the result has these fields:`.
- **K26** (`K26-adapter.log`): `prune.ts:273`, the same change in the preview. `171 scenarios (168 passed, 3 failed)`, `exit=1`. Failed: E01 `:318`, `:319`; N02 `:521`; all at `Then the result has these fields:`.
- **K27** (`K27-adapter.log`): `edge/handlers/shared.ts:80`, `-      skipValue = false;` deleted. `171 scenarios (162 passed, 9 failed)`, `exit=1`. Failed: E01 `:317`, `:319`; M01 `:349`; N02 `:521`; U01 `:584`; existing `prune.feature:92`, `:122`; all at `Then the result has these fields:`; A01 `:440` at the preview Given (first error `AssertionError [ERR_ASSERTION]: {"schemaVersion":1,...,"severity":"error",...,"kind":"usage-error","message":"Too many arguments.",...}`); `prune.feature:240` at `Given the user has run "/claude:plugin disable lib@tools --scope project --local"`.
- **K28** (`K28-adapter.log`): `edge/handlers/plugin/prune.ts:48`, `+        ...(parsed.scope !== undefined && { scope: parsed.scope === "user" ? "project" : parsed.scope }),`. `171 scenarios (167 passed, 4 failed)`, `exit=1`. Failed: E01 `:314`, `:317`; `state-lock.feature:358`; all at `Then the result has these fields:`; `prune.feature:92` at `Then the result lists these plugins:`.
- **K29** (`K29-adapter.log`): `edge/handlers/shared.ts:101`, `+    if (isRejected(tok) && process.env.NEVER_SET === "x") {`. `171 scenarios (165 passed, 6 failed)`, `exit=1`. Failed: FL01 `:377`, `:378`, `:379`, `:380`; `usage-errors.feature:88` and `:91` "A plugin subcommand rejects a flag it does not accept"; all at `Then the result has these fields:`.

Unions: E01's 7 rows over K1, K25, K26, K27, K28 (`:313` to `:319`); FL01's 5 rows over K21 and K29 (`:377` to `:381`). Every K break's failures match the research's lists in `research-04/breaks-*.txt`.

## Case map

Lines at c782fb1 (the file at the plan base is identical there).

| Case at c782fb1 | Replaced by | Break |
|-----------------|-------------|-------|
| `:222-248` loop, "prune --dry-run reports malformed state without exposing its path" and "prune reports malformed state without exposing its path" | M01 (`prune.feature:321`, 4 rows) | K3 (4 rows), K4 (2 dry-run rows), K1 (2 user rows) |
| `:250` "prune reports a held state lock and leaves the scope intact" | already covered: `state-lock.feature:331`, `:358` | K18 |
| `:284` "prune removes an orphan dependency through the registered command" | kept, internal (ITSCOPE-01); `prune.feature:15` and `:60` show its user-visible half | K19 |
| `:317` "prune --dry-run previews the orphan without writing current state" | kept, internal (ITSCOPE-01, and it pins mtimes); `prune.feature:92` and `:122` show its user-visible half | K20 |
| `:351` "preview and actual prune select the same dependent-first fixpoint" | C01 (`:415`) | K12, K8 |
| `:417` "preview and actual preserve alternating marketplaces and held neighbors" | A01 (`:440`) | K11, K12, K8 |
| `:489` "actual prune reselects after a stale preview changes on disk" | S01 (`:383`), deleted in Task 1 | K8 |
| `:533` "failed actual member holds its dependency until a later retry" | F01 (`:586`) and F02 (`:617`) | K9, K10 |
| `:621` "repeated legacy previews normalize in memory without writing the scope" | L01 (`:642`) | K16 |
| `:670` "preview of a missing project state leaves both scope trees unchanged" | N02 (`:521`) | K14 |
| `:702-764` loop, 7 cases "<args> reports an empty <scope> scope without changing the scope" | E01 (`:294`, 7 rows) | K1, K25, K26, K27, K28 (K2 survives) |
| `:766` "project prune removes only the project orphan" | P01 (`:497`) | K13 |
| `:802` "an unreadable declarer refuses prune without changing either scope" | U01 (`:545`, 4 rows) | K15, K24 |
| `:845-877` loop, 5 cases "<args> rejects before selecting an installed orphan" | FL01 (`:351`, 5 rows); `usage-errors.feature:88` and `:135` also show `--bogus` and an extra argument | K5, K6, K7, K29, K21 |

25 cases: 23 deleted, 2 kept.

## Checks

`node --version`: `v24.22.3`. Every command carried the prefix `npm_config_script_shell=$S/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`, and every verify command ran unchanged as a script under `$D` because the worktree's shell guard refuses one-line `git` inside `$(...)`.

| Command (script) | Tree | Exit | Result |
|---|---|---|---|
| green prune, adapter (`verify-t1-1.sh`) | Task 1 working tree | 0 | `13 scenarios (13 passed)` |
| K8 tracer log check (`verify-t1-2.sh`) | `9d851be` | 0 | S01 failed, `restored=clean` |
| integration (`verify-t1-3.sh`) | Task 1 working tree | 0 | `tests 24`, `pass 24`, `fail 0` |
| `npm run lint` (warm-up, `lint-warm.log`) | Task 1 working tree | 0 | |
| `check:static` (`verify-t1-4.sh`, `check-static-1.log`) | Task 1 working tree | 0 | all seven steps passed |
| green prune, adapter (`verify-t2-1.sh`) | Task 2 working tree | 0 | `40 scenarios (40 passed)` |
| builtin (`verify-t2-2.sh`) | Task 2 working tree | 0 | `0 scenarios` |
| `check:static` (`verify-t2-3.sh`, `check-static-2.log`) | Task 2 working tree | 0 | all seven steps passed |
| break rows (`verify-t3-1.sh`) | `8744eae` logs | 0 | |
| break scenarios (`verify-t3-2.sh`) | `8744eae` logs | 0 | |
| already-covered scenarios and K2 (`verify-t3-3.sh`) | `8744eae` logs | 0 | |
| integration (`verify-t3-4.sh`) | Task 3 working tree | 0 | `tests 2`, `pass 2`, `fail 0` |
| `check:static` (`verify-t3-5.sh`, `check-static-3.log`) | Task 3 working tree | 0 | all seven steps passed |
| `fallow audit --base <plan base>` (`verify-t3-6.sh`) | `17ee478` | 0 | `verdict=warn`, 0 dead code, 0 complexity, 0 clone groups, `risks=weakened-tests:test/integration/standalone-prune.test.ts` |
| changed files (`verify-files.sh`) | `9d851be`, `8744eae`, `17ee478` | 0 | only the three planned files; no `-` line in `prune.feature`; nothing under `extensions/`; clean `extensions/ features/ test/` |
| pre-commit fixers on the staged paths | before each commit | 0 | no fixer changed a file |

The commit hook ran gitlint and the fixers; inside the worktree it skipped `npm run check:commit` (no files to check), so `check:static` was run by hand before each commit. The wave's post-merge `npm run check` is the full verdict.

## Issues for the milestone

- `fallow audit` reports one `weakened-tests` `warn` on `test/integration/standalone-prune.test.ts` ("test cases: 14 -> 2"), as Phases 1 to 3 did for each trimmed file. User decision 2026-11-21: no `.fallowrc.json` or CI change; left to the milestone.
- K2 survives every scenario: an actual prune that removes nothing and saves the unchanged record writes the same bytes. Nothing pins it after the trim; CONTEXT [Same-bytes save] accepts it.

## Decisions Made

- The break helper restores all of `extensions/` rather than one file, because a break file may edit more than one site (K8 has three edits). This is safe because the helper refuses to start on a dirty `extensions/`.

## Deviations from Plan

None - plan executed exactly as written. Every expected value matched: no scenario needed a changed value or a strengthening, and no break left a "Must fail" scenario passing.

## Issues Encountered

- My first Task 2 green script replaced only the first occurrence of the log name, so the run wrote `green-prune-2.log` but appended its `exit=0` to `green-prune-1.log` and grepped the wrong log. I removed that appended line from `green-prune-1.log`, fixed the script to replace every occurrence, and reran it: `green-prune-2.log` `40 scenarios (40 passed)`, exit 0.

## Parent lines

- `CHANGELOG.md`: None. Plan 04-02 carries the CHANGELOG line of the backup fix.
- `.planning/BACKLOG.md`: None.
- Key Decisions table: None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 04-02 can reuse `$D/break.sh` and add its no-backup `Then` and F03 between F02 (`prune.feature:617`) and L01 (`:642`).

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: features/step_definitions/plugin/prune.steps.ts, .planning/phases/04-prune/04-01-SUMMARY.md
- FOUND: 9d851be, 8744eae, 17ee478 (ancestors of HEAD)
