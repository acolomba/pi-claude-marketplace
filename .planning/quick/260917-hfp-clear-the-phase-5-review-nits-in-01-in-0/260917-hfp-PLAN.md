---
quick_id: 260917-hfp
phase: quick-260917-hfp
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [PRUNE-03, PRUNE-05]
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - docs/output-catalog.md
  - .planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md

estimate:
  tokens: 100000
  raw_tokens: 100000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "An orchestrated `uninstallPlugin` call that carries `prune: true` removes only the named record and returns `{ status: \"uninstalled\" }`; a dependency-provenance orphan in the scope survives (D-05-08: reconcile never prunes, and the orchestrated outcome has no member rows to carry a sweep)"
    - "The `--prune` sweep on the standalone path is byte-for-byte unchanged: every existing D-05-01..13 / PRUNE-01..04 owner-suite case passes untouched"
    - "`dependency-index.ts` spells `ExtensionState[\"marketplaces\"][string]` exactly once (the exported alias) and `npm run fallow` stays at zero findings"
    - "A reconcile whose uninstall bucket holds a PU-5 converged entry beside a D-05-16 refused entry invokes the child uninstall operation exactly once per entry (one pass), reports the same refusal row, and leaves state unchanged"
    - "`docs/output-catalog.md` state `prune-partial-failure` attaches `shrunk ... or intact ...` to the failed member's record; the fenced example block is byte-identical and `catalog-contract.test.ts` still locks 213 states / 28,729 bytes"
    - "`05-REVIEW-FIX.md` records IN-01, IN-02, IN-03, IN-07, IN-08 as fixed (commit SHAs, files, applied change) and IN-04 as carried to BACKLOG `PRUNE-GUARD-MR-01`"
  artifacts:
    - "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts -- sweep gated on standalone mode; `prunedMembers` array replaces the wrapper object"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts -- exported `MarketplaceStateRecord` alias reused by `IndexedRecord`"
    - "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts -- `settled` counter ends the retry loop; `opts.uninstallPlugin ??` fallback"
    - "extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts -- `uninstallPlugin?: UninstallPluginOperation` on `ApplyReconcileOptions`"
    - "tests/orchestrators/plugin/uninstall.test.ts -- orchestrated-plus-prune negative case beside the D-05-08 case"
    - "tests/orchestrators/reconcile/apply.test.ts -- converged-beside-refused single-pass case beside the D-05-16 order case"
    - "docs/output-catalog.md -- reordered D-05-13 prose only"
    - ".planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md -- `## Info items settled (2026-09-17)` section"
  key_links:
    - "uninstall.ts closure: `if (opts.prune === true && !orchestrated)` -> `sweepOrphans` -> `prunedMembers` -> `finalizePrunedMembers` / `composeRemovalBlocks` (standalone only)"
    - "apply.ts::applyPlan -> applyPluginUninstalls(opts.uninstallPlugin ?? createNodeUninstallPlugin(...)) -> per-pass `settled` count -> return when `refused.length === 0 || settled === 0`"
    - "apply.test.ts: applyAfterSelectedStateRace(project, competing) + counting `UninstallPluginOperation` wrapper -> `calls` deep-equals one entry per bucket member"
---

<objective>
Clear the five remaining `05-REVIEW.md` Info nits that need a change (IN-01, IN-02, IN-03, IN-07, IN-08) and record IN-04 as carried. IN-05 and IN-06 are already settled by quick task `260917-cqc` and are not touched.

- IN-01: the `--prune` sweep in `uninstall.ts` is gated on `opts.prune === true` alone, so an orchestrated caller that set `prune` would remove records the orchestrated outcome cannot report. Gate it on standalone mode as well (D-05-08) and plant the case.
- IN-02: the `{ members: [] }` wrapper object around the sweep's members carries a false rationale; a plain array is the same reference inside and outside the closure.
- IN-03: `IndexedRecord` respells the `MarketplaceStateRecord` alias declared above it.
- IN-07: the catalog's D-05-13 paragraph has a dangling modifier (`shrunk ... or intact` reads as attaching to the kept dependency records).
- IN-08: the reconcile retry loop's no-progress test counts by length, so a PU-5 converged entry beside a refusal costs one extra guard walk. Count settled outcomes instead and plant the case.
- IN-04: no code change; carried to BACKLOG `PRUNE-GUARD-MR-01`.

Purpose: leave the phase 5 review with every Info item settled in `05-REVIEW-FIX.md`, in the format the IN-05/IN-06 settlement (`fda3bc8e`) established.
Output: four production edits, two test additions, one docs edit, one planning record; four commits.
</objective>

<execution_context>
@/home/acolomba/src/pi-claude-marketplace-manifest/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/src/pi-claude-marketplace-manifest/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/home/acolomba/src/pi-claude-marketplace-manifest/CLAUDE.md
@/home/acolomba/src/pi-claude-marketplace-manifest/skills/typescript-comments/SKILL.md
@/home/acolomba/src/pi-claude-marketplace-manifest/skills/typescript-unit-testing/SKILL.md
@/home/acolomba/src/pi-claude-marketplace-manifest/skills/typescript-google-style-review/SKILL.md
@/home/acolomba/src/pi-claude-marketplace-manifest/skills/typescript-unit-testing-review/SKILL.md
@/home/acolomba/src/pi-claude-marketplace-manifest/.planning/phases/05-prune-on-uninstall/05-REVIEW.md
@/home/acolomba/src/pi-claude-marketplace-manifest/.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md
@/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
@/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
@/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
@/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts

**Execution environment (observed at planning time, HEAD `234ddbd9`, branch `features/manifest`):**
- Run everything in THIS checkout, `/home/acolomba/src/pi-claude-marketplace-manifest`. It has `node_modules`; a nested worktree would not. Do not create one. Never commit to `main`.
- No pre-commit hook is installed: run `SKIP=trufflehog pre-commit run --files <changed files>` by hand before each commit (`.git` here is a file, so `SKIP=trufflehog` is required). The hooks rewrite files (prettier, mdformat, whitespace fixers): restage and re-run until they exit 0 with no modifications. Never `--no-verify`, never `--amend`, never stash.
- The operator has UNCOMMITTED edits in `.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json` and untracked `.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`. Never stage those. Never `git add -A` / `git add -u`. Stage explicit paths only.
- Commit messages: Conventional Commits; title <= 72 chars; body lines <= 80 chars; CODE commit bodies cite D-05-xx / PRUNE-xx / PU-5 and never a GSD phase, plan, window, quick id, or review item id. The docs-record commit may say "phase 5 review". Write each message to a scratchpad file and commit with `git commit -F <file>` (a backticked token in `-m` is executed by the shell). Every commit ends with the two trailer lines:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01XCXpZ2LFkzGt8mXUcCvfu3`
- Comment policy (`skills/typescript-comments`): present-tense facts; no "no longer" / "used to" / "the former"; cite durable IDs only (D-05-08, D-05-13, D-05-16, PRUNE-03, PU-5, NFR-3). No `IN-NN`, no "review", no quick id, no phase/plan number in any file under `extensions/`, `tests/`, `docs/`. The pre-existing `IN-02:` comment near `uninstall.ts:1194` is an unrelated earlier finding: leave it alone.
- Gate per production file, before each commit: `npm run typecheck && npm run lint && npm run fallow && npm run format:check`, then `npm run test:coverage:direct:commit` (it diffs the working tree against `HEAD`, so run it BEFORE committing) and the touched suites with `node --test`. After the last code commit, `npm test` once. Do not re-run a suite that already passed unchanged.
- CHANGELOG decision: NO new bullet. `.claude/rules/changelog.md` is one entry per pull request; this branch has no PR yet and the milestone's ship step writes its entry. Do not touch `CHANGELOG.md`.

**Live mechanism notes the executor needs:**
- `uninstall.ts`: `orchestrated` is `opts.notifications?.mode === "orchestrated"` (line ~920). The sweep gate `if (opts.prune === true) {` sits at ~1082 inside the `withLockedStateTransaction` closure that starts at ~998 (fallow cognitive 6, ESLint cognitive 6; one `&&` adds 1). The wrapper `const prune = { members: [] as PrunedMember[] };` is at ~989 with its two-sentence comment; the wrapper's field is read at ~1083 (push), ~1169 (`finalizePrunedMembers`) and ~1220 (`composeRemovalBlocks`). The orchestrated arm at ~1202 returns `{ status: "uninstalled", name, version? }` only.
- The type-narrowing alternative for IN-01 was checked and rejected: `UninstallPluginOperation` is an overload pair (narrow orchestrated -> `Promise<UninstallPluginOutcome>`, wide -> `| undefined`). Adding `prune?: never` to the narrow overload makes an orchestrated call with `prune: true` fall through to the WIDE overload -- no compile error, and a silently widened return type. Making it a real compile error needs `UninstallPluginOptions` rebuilt as a discriminated union that `apply.ts`, `enable-disable.ts`'s docs and the owner-suite harness all mirror. The runtime gate is the direct fix and is testable.
- `dependency-index.ts`: `type MarketplaceStateRecord = ExtensionState["marketplaces"][string];` at line 60 is NOT exported; `IndexedRecord` (line 69) IS exported and imported by `uninstall.ts`. `.fallowrc.json` sets `"private-type-leaks": "error"`, so an exported interface referencing a private alias fails `npm run fallow`. Precedent: `edge/browser/plugin-browser.ts::BrowserTui` is exported for exactly this reason, with a doc comment saying so, and has no external importer (fallow does not flag it).
- `reconcile/apply.ts::applyPluginUninstalls` (line ~423, fallow cognitive 13 / cyclomatic 7, ESLint cognitive 12): builds `createNodeUninstallPlugin(opts.hooksRouting, opts.completionCache)` at ~428, then loops: `refused` collects `isRefusedUninstall` outcomes, `outcomes.push(outcome)` is the settled branch, `continue` on `undefined` is the PU-5 converge, and the exit test is `refused.length === 0 || refused.length === pending.length`. Termination after the fix: `pending.length === refused.length + settled + converged`, so `settled >= 1` implies `refused.length < pending.length` and the next `pending` is strictly shorter; `settled === 0` returns. A non-refused FAILED outcome still counts as settled, exactly as today (it was never "no progress" under the length test either); that semantics is not changed here.
- Seam finding for IN-08 (verified live): from `applyReconcile`, a refused or converged child call touches no injectable collaborator -- `hooksRouting` and `completionCache` are used only on the success arm (`dropCachedHooks`, `runPostUninstallCleanup`), `ctx`/`pi` only by standalone notify, and the `ReconcileStateReader` only in the read pass. The only observable that distinguishes one pass from two is the per-entry invocation count of the child uninstall operation. `ApplyReconcileOptions` already carries the D-12 `gitOps?` override for exactly this shape of proof ("production callers omit; tests inject"); `uninstallPlugin?` mirrors it. `reconcile/types.ts` already imports types from `../plugin/install-disable-cascade.ts` and `../marketplace/shared.ts`; `plugin/uninstall.ts` imports nothing from `reconcile/`, so `import type { UninstallPluginOperation } from "../plugin/uninstall.ts"` creates no cycle.
- `tests/orchestrators/reconcile/apply.test.ts` helpers: `applyAfterSelectedStateRace(locations, competing)` (line ~512) builds a reader that returns the planner's snapshot and then writes `competing` to disk, and passes `opts` through (`Omit<ApplyReconcileOptions, "completionCache" | "hooksRouting"> & Partial<Pick<...>>`), so a new optional `uninstallPlugin` flows through untouched; `writeMarketplaceSource`, `configBytes`, `seedState`, `marketplaceRecord`, `pluginRecord`, `createNotificationBoundary(emissions, toolProbes)` (two tool probes per emission), `createOfflineGitOps`. The two D-05-16 tests at ~1173 and ~1257 are the shape to copy. The converge arm: `emitAlreadyGone` returns `{ status: "converged" }` in orchestrated mode and `applyOnePluginUninstall` maps it to `undefined`.
- `tests/orchestrators/plugin/uninstall.test.ts`: `uninstallWithFreshOwner` (line ~155) is an overload-pair wrapper -- the pattern for implementing `UninstallPluginOperation` without a cast. The D-05-08 orchestrated no-prune case is at ~5487 and uses `seedDeclaringMarketplace(locations, "mp", { x: {}, o: { provenance: "dependency" } }, cwd)`, `makeCtx()`, `recordedInventory(locations)`.
- `docs/output-catalog.md` line 1163 is the paragraph; the `<!-- catalog-state: prune-partial-failure -->` marker and fenced block follow at 1165+. `tests/architecture/catalog-uat/catalog-contract.test.ts` pins `EXPECTED_STATE_COUNT = 213` and `EXPECTED_UTF8_BYTES = 28_729` over the fenced examples only; `tests/architecture/partial-vocabulary-guard.test.ts` scans the catalog prose for retired tokens, so reorder existing words and introduce no new vocabulary.
- `.planning/BACKLOG.md` line 3011 `## PRUNE-GUARD-MR-01` already states the `marketplace remove` bypass, the D-05-07 exit it must keep open, and the pick-up scope. Read it; no edit is expected.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Clear the four code nits (IN-01, IN-02, IN-03, IN-08) with two planted tests, in two commits</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts, extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts, extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts, extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts, tests/orchestrators/plugin/uninstall.test.ts, tests/orchestrators/reconcile/apply.test.ts</files>
  <behavior>
    - uninstall owner suite, new case beside the D-05-08 case: an orchestrated call with `prune: true` on scope `{ x: {}, o: { provenance: "dependency" } }` returns `{ status: "uninstalled", name: "x", version: "0.0.1" }`, emits no notification, and `recordedInventory` still holds `o@mp` (RED on current code: the sweep removes `o@mp` and the inventory is `{}`)
    - uninstall owner suite: every existing `--prune` case (standalone) passes unchanged
    - reconcile owner suite, new case beside the second D-05-16 case: state records `gone`, `orphan`, `keeper` in that order; config declares only `keeper@mp`; the competing state written after the planner's snapshot drops `gone`; the child operation is invoked exactly once for `gone@mp` and once for `orphan@mp` (RED on current code: `orphan@mp` is invoked twice); the notification is the single refusal block for `orphan` (`{dependents remain}`, `cause: required by keeper@mp`, `Reconcile: 1 failure`, severity error); state after holds `orphan` and `keeper`; no clone
    - reconcile owner suite: both existing D-05-16 cases pass unchanged (they cover `settled === 0` with only refusals, and `settled >= 1` followed by a converging retry)
  </behavior>
  <action>
Write the two tests first and run them against the unchanged code to record the red state (keep both as top-level `test()` calls so the TAP names are readable; save the raw TAP to the session scratchpad for the SUMMARY). Then make the four edits and go green.

1. IN-01 (`uninstall.ts`), per D-05-08. Change the sweep gate in the closure to require standalone mode: `opts.prune === true && !orchestrated`. Extend the comment above it (the `D-05-03 / D-05-10: the sweep runs on THIS arm only` block) with one sentence stating that the sweep runs only in standalone mode because the orchestrated outcome carries no member rows and the reconcile caller never sets the option (D-05-08). Update the `prune?: boolean` doc comment in `UninstallPluginOptions` to say the option is honoured in standalone mode only and ignored under `notifications.mode === "orchestrated"`, citing D-05-08. No other behaviour change.

2. IN-02 (`uninstall.ts`). Replace the wrapper declaration at ~989 with `const prunedMembers: PrunedMember[] = [];`, keep only the first sentence of its comment (`D-05-10: the sweep's members, carried out of the closure for the post-commit cleanup and the report.`) and delete the second sentence, and rewrite the three field accesses (push at ~1083, `members:` at ~1169 and ~1220) to use `prunedMembers`. Pure refactor; if any wrapper access is missed, `npm run typecheck` fails on the undefined identifier.

3. IN-03 (`dependency-index.ts`). Export the alias: `export type MarketplaceStateRecord = ExtensionState["marketplaces"][string];` with a one-line doc comment saying it is exported because the exported `IndexedRecord` references it (fallow private-type-leak rule), mirroring the `BrowserTui` comment in `edge/browser/plugin-browser.ts`. Then set `IndexedRecord.marketplace: MarketplaceStateRecord` and `IndexedRecord.record: MarketplaceStateRecord["plugins"][string]`. `readRecordDeclarations` already uses the alias; leave it. Pure type refactor; existing `dependency-index.test.ts` and `uninstall.test.ts` cover it.

4. IN-08 (`reconcile/types.ts` + `reconcile/apply.ts`), per D-05-16 and PU-5. In `types.ts`, add `readonly uninstallPlugin?: UninstallPluginOperation;` to `ApplyReconcileOptions` directly under `gitOps?`, with a doc comment in the same voice as the `gitOps` one: an injection seam for the uninstall child; production callers omit it and `createNodeUninstallPlugin(hooksRouting, completionCache)` applies; a test injects an observing wrapper around the real operation to prove how many passes the D-05-16 retry loop takes. Import the type with `import type { UninstallPluginOperation } from "../plugin/uninstall.ts";` in the type-import group (alphabetical: after `../plugin/install-disable-cascade.ts`). In `apply.ts::applyPluginUninstalls`, build the operation as `opts.uninstallPlugin ?? createNodeUninstallPlugin(opts.hooksRouting, opts.completionCache)`; declare `let settled = 0;` at the top of each pass beside `refused`, increment it on the `outcomes.push(outcome)` branch, and change the exit test to `refused.length === 0 || settled === 0`. Amend the D-05-16 header comment's last clause ("until a pass makes no progress") to say progress is an outcome settled in that pass -- a PU-5 converge is neither refused nor progress, because the record it found absent removed no declarer -- so a pass that only converges and refuses ends the loop. Fallow: the function is at cognitive 13 with a ceiling of 15 and the `??` may add 1; if `npm run fallow` flags it, hoist the `??` fallback into `applyPlan` and pass the operation as a fourth parameter instead.

5. Planted test for IN-01 (`tests/orchestrators/plugin/uninstall.test.ts`), directly after the `D-05-08: without the option an orphan survives ...` case: title `D-05-08: an orchestrated call carrying the prune option removes only the named plugin`; same arrange as that case plus `prune: true` on the call; assert the outcome `{ status: "uninstalled", name: "x", version: "0.0.1" }`, `notifications` deep-equals `[]`, and `recordedInventory(locations)` deep-equals `{ "o@mp": ["mp-o-skill"] }`. `// arrange` / `// act` / `// assert` markers, `withHermeticHome`, `mkdtemp` + `rm` in `finally`, as the neighbours do.

6. Planted test for IN-08 (`tests/orchestrators/reconcile/apply.test.ts`), directly after the `D-05-16: dropping a plugin and its dependent together converges in ONE pass ...` case: title `D-05-16 / PU-5: a converged entry beside a refusal is settled in one pass`. Arrange: `writeMarketplaceSource(cwd, "mp-src", "mp", { gone: { skill: "clean" }, keeper: { skill: "clean", dependencies: ["orphan"] }, orphan: { skill: "clean" } })`; config `plugins: { "keeper@mp": {} }`; recorded state with plugins in the order `gone`, `orphan`, `keeper` (so the planned bucket is `[gone, orphan]`); competing state identical but without `gone`. Build `hooksRouting` and `completionCache` explicitly, `const real = createNodeUninstallPlugin(hooksRouting, completionCache)`, and an observing wrapper implemented as an overload pair like `uninstallWithFreshOwner` in the uninstall suite (no `as` cast) that pushes `${opts.plugin}@${opts.marketplace}` onto a `calls` array and forwards to `real`. Act: one call through `applyAfterSelectedStateRace(project, competing)` passing `{ ctx, pi, cwd, scope: "project", gitOps, hooksRouting, completionCache, uninstallPlugin: wrapper }` with `createNotificationBoundary(1, 2)`. Assert, in this order: `calls` deep-equals `["gone@mp", "orphan@mp"]` (this is the one-pass proof; the current code yields `["gone@mp", "orphan@mp", "orphan@mp"]`), `notifications` deep-equals the single refusal block for `orphan` (copy the `refusal` literal from the first D-05-16 case), `Object.keys(state.marketplaces.mp.plugins)` deep-equals `["orphan", "keeper"]`, `clonedUrls()` is empty, `verifyBoundary()`.

7. Gate and commit in two steps. First commit (after step 1-3 edits and step 5 are green): stage `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts`, `tests/orchestrators/plugin/uninstall.test.ts`; title `fix(prune): sweep only in standalone mode and tidy the owners`; body names the D-05-08 gate, the array replacing the wrapper, and the alias reuse. Second commit (after step 4 and step 6 are green): stage `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`, `tests/orchestrators/reconcile/apply.test.ts`; title `fix(reconcile): stop retrying refusals when a pass settled nothing`; body explains the PU-5 converge is not progress and names the `uninstallPlugin` seam. Before EACH commit: `npm run typecheck && npm run lint && npm run fallow && npm run format:check`, `npm run test:coverage:direct:commit` (100% direct coverage on every changed production file; the pre-existing pinned shortfalls are the only accepted ones), the touched suites, then `SKIP=trufflehog pre-commit run --files <the staged paths>` until clean. Record both SHAs for Task 3.
  </action>
  <verify>
    <automated>cd /home/acolomba/src/pi-claude-marketplace-manifest && npm run typecheck && npm run lint && npm run fallow && npm run format:check && node --test tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/dependency-index.test.ts tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/reconcile/types.test.ts && test "$(grep -c 'ExtensionState\["marketplaces"\]\[string\]' extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts)" = "1" && grep -q 'opts.prune === true && !orchestrated' extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts && grep -q 'settled === 0' extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts</automated>
  </verify>
  <done>Red evidence recorded: on HEAD `234ddbd9` the two new cases are `not ok` (uninstall: inventory `{}` instead of `{ "o@mp": [...] }`; reconcile: `calls` has three entries instead of two) and every other case `ok`. Green: all four gates exit 0, the four suites pass, direct coverage is 100% on `uninstall.ts`, `dependency-index.ts`, `apply.ts`, `types.ts`, and two commits exist with the titles above and the two trailer lines. `git show --stat` of each lists only its three staged paths.</done>
</task>

<task type="auto">
  <name>Task 2: Reorder the catalog's D-05-13 prose (IN-07) without touching the byte lock, one commit</name>
  <files>docs/output-catalog.md</files>
  <action>
Per D-05-13 and PRUNE-03, edit ONLY the prose paragraph at `docs/output-catalog.md` line 1163 (state `prune-partial-failure`, heading `### Partial failure -- a pruned member could not be removed (D-05-13)`). Restructure it in the reviewer's suggested order so that `shrunk ... or intact ...` attaches to the failed member's record, and the kept-dependencies fact becomes its own sentence after it. Target text, keeping every existing token and adding no new vocabulary: `... and the state is saved exactly once with the failed member's record still present (NFR-3) -- shrunk to the artifacts still on disk when the cascade dropped some before failing, or intact when foreign content refused the unstage. That member is still an installed plugin that still declares its own dependencies, so the sweep keeps every dependency only it holds; those records render no row, exactly as the guard would refuse them if named directly (PRUNE-03). The failed member renders its own `failed` row ...` -- the rest of the paragraph is unchanged. Do not touch the `<!-- catalog-state: prune-partial-failure -->` marker, the fenced example block, or any other state. `docs/dependency-resolution.md` already phrases this correctly (line 160) and is not edited.

Confirm the lock: run `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` and `node --test tests/architecture/partial-vocabulary-guard.test.ts`; both must pass with the pinned 213 states / 28,729 bytes unchanged (do not edit the pins). Also `git diff --stat docs/output-catalog.md` must show exactly one changed line.

Commit: stage `docs/output-catalog.md` only; title `docs(catalog): attach the shrunk-or-intact clause to the failed member`; body cites D-05-13 and PRUNE-03 and says the example block and byte lock are unchanged. `SKIP=trufflehog pre-commit run --files docs/output-catalog.md` first (mdformat may rewrap; if it modifies the file, inspect that only the paragraph moved, restage, re-run). Record the SHA for Task 3.
  </action>
  <verify>
    <automated>cd /home/acolomba/src/pi-claude-marketplace-manifest && node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/partial-vocabulary-guard.test.ts && grep -q "still present (NFR-3) -- shrunk to the artifacts still on disk" docs/output-catalog.md && grep -q "That member is still an installed plugin that still declares its own dependencies, so the sweep keeps every dependency only it holds; those records render no row, exactly as the guard would refuse them if named directly (PRUNE-03). The failed member renders" docs/output-catalog.md && test "$(grep -c 'EXPECTED_UTF8_BYTES = 28_729' tests/architecture/catalog-uat/catalog-contract.test.ts)" = "1"</automated>
  </verify>
  <done>The paragraph reads in the new order, both architecture suites pass with the pins untouched, the fenced example is byte-identical, and one commit `docs(catalog): ...` contains exactly `docs/output-catalog.md`.</done>
</task>

<task type="auto">
  <name>Task 3: Record the six settlements in 05-REVIEW-FIX.md (IN-04 carried), one commit</name>
  <files>.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md</files>
  <action>
Append a new section to `.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md` AFTER the `### IN-06: accepted, no code change` block and BEFORE the closing `---` / `_Fixed: ..._` trailer, in the exact format of the `## Operator decisions settled (2026-09-17)` precedent (commit `fda3bc8e`): heading `## Info items settled (2026-09-17)`, one intro sentence naming the quick task `260917-hfp` and the six items, then one `### IN-NN: fixed` / `### IN-NN: carried, no code change` heading each, in order IN-01, IN-02, IN-03, IN-04, IN-07, IN-08. Do NOT change the frontmatter (`findings_in_scope`, `fixed`, `skipped`, `status`); the precedent left it alone and it describes iteration 1's scope. Do not touch the IN-05 / IN-06 blocks.

Per fixed item: `**Commit:** <sha> (<title>)`, `**Files modified:** ...`, `**Applied change:** ...` in one paragraph, factual, present tense. Content to state:
- IN-01: the sweep gate is `opts.prune === true && !orchestrated`; the option doc says standalone only (D-05-08); the runtime gate was chosen over narrowing the orchestrated overload because a `prune?: never` on the narrow overload falls through to the wide overload with no diagnostic; new owner-suite case named; commit = Task 1's first SHA.
- IN-02: `prunedMembers: PrunedMember[]` replaces the wrapper and the false-rationale sentence is gone; same commit.
- IN-03: `MarketplaceStateRecord` is now exported (fallow `private-type-leaks: "error"` forbids an exported `IndexedRecord` referencing a private alias -- the `BrowserTui` precedent) and both `IndexedRecord` members use it; same commit.
- IN-04: `**Carried to:**` `.planning/BACKLOG.md` § `PRUNE-GUARD-MR-01` (line ~3011), with one sentence that the entry already names the `marketplace remove` bypass, the D-05-07 two-stale-records exit it must keep open, and the pick-up scope (declaration index read before the removal, `dependents remain` row with a cause line); state explicitly that the BACKLOG entry was verified and not edited.
- IN-07: the reordered sentence; example block and 213 / 28,729 lock unchanged; `dependency-resolution.md` untouched; commit = Task 2's SHA.
- IN-08: `settled` counter and the `refused.length === 0 || settled === 0` exit; termination argument in one sentence; the `uninstallPlugin?` seam on `ApplyReconcileOptions` and why it was needed (no existing seam observes a refused or converged child call from `applyReconcile`); new reconcile case named; commit = Task 1's second SHA.

Close the section with one line: `CHANGELOG: no entry; the milestone's pull-request entry covers this branch.`

Commit: stage `.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md` only; title `docs(review): settle IN-01..04, IN-07, IN-08 from the phase 5 review`; body mirrors `fda3bc8e` (one short paragraph per group: fixed items with their SHAs, IN-04 carried). `SKIP=trufflehog pre-commit run --files .planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md` first. After this commit run `npm test` once (the full unit suite) and `SKIP=trufflehog pre-commit run --all-files` once; both must be clean. Then write the SUMMARY.
  </action>
  <verify>
    <automated>cd /home/acolomba/src/pi-claude-marketplace-manifest && F=.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md && grep -q '^## Info items settled (2026-09-17)' "$F" && for id in IN-01 IN-02 IN-03 IN-07 IN-08; do grep -q "^### $id: fixed" "$F" || exit 1; done && grep -q '^### IN-04: carried' "$F" && grep -q 'PRUNE-GUARD-MR-01' "$F" && test "$(grep -c '^### IN-05: fixed' "$F")" = "1" && TITLE="$(git log -1 --format=%s)" && test "$TITLE" = 'docs(review): settle IN-01..04, IN-07, IN-08 from the phase 5 review' && DIRTY="$(git status --porcelain -- CHANGELOG.md .planning/BACKLOG.md)" && test -z "$DIRTY"</automated>
  </verify>
  <done>The record section exists with six headings in order, frontmatter and the IN-05/IN-06 blocks are unchanged, CHANGELOG.md and BACKLOG.md are untouched, the fourth commit has the exact title, `npm test` and `pre-commit --all-files` are clean, and the operator's unrelated local edits are still uncommitted and unstaged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| orchestrated caller options -> `uninstallPlugin` sweep | an option the orchestrated outcome cannot report must not drive removals |
| `ApplyReconcileOptions.uninstallPlugin` -> reconcile apply | a new injection point for the child uninstall operation; only composition code and tests supply it |

## STRIDE Threat Register

The phase register lives in `.planning/phases/05-prune-on-uninstall/05-SECURITY.md`; rows below cover only what this task changes. ASVS level 1; no row reaches `high`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05-16 | Tampering | orchestrated `uninstallPlugin` with `prune: true` | medium | mitigate | the sweep is gated on `!orchestrated` (D-05-08), so no records can leave disk without a row that reports them; planted owner-suite case proves the orphan survives |
| T-05-17 | Elevation of privilege | `ApplyReconcileOptions.uninstallPlugin` seam | low | accept | production callers (`index.ts`) omit it and the `??` fallback builds the real operation; the seam mirrors the existing `gitOps?` override and only `tests/` and composition code can populate it; no user input reaches it |
| T-05-18 | Denial of service | reconcile retry loop | low | mitigate | `settled === 0` ends the loop after one pass when nothing progressed; termination argument recorded in the header comment (pending shrinks strictly or the loop returns) |
| T-05-SC | Tampering | npm/pip/cargo installs | n/a | n/a | this task installs no package; the package-legitimacy gate is not triggered |
</threat_model>

<verification>
- Red evidence: the two new cases fail on HEAD `234ddbd9` with the actual values named in Task 1's `<done>`; raw TAP quoted in the SUMMARY.
- Green: `npm run typecheck && npm run lint && npm run fallow && npm run format:check` exit 0 before every code commit; `npm run test:coverage:direct:commit` reports 100% direct coverage on `uninstall.ts`, `dependency-index.ts`, `apply.ts`, `types.ts`; `npm test` passes once after the last code commit; `SKIP=trufflehog pre-commit run --all-files` exits 0 at the end.
- Scope: `git diff 234ddbd9 --stat` after all four commits lists exactly the eight paths in `files_modified` (plus `scripts/test-coverage-direct.pin.json` only if a justified pin edit was unavoidable, stated in the SUMMARY); `CHANGELOG.md`, `.planning/BACKLOG.md`, `docs/dependency-resolution.md`, `install-flow.ts` are not in it; the operator's local edits and untracked files are in no commit.
- Catalog: `catalog-contract.test.ts` pins unchanged (213 / 28_729); `partial-vocabulary-guard.test.ts` passes.
- Comments: `grep -rn 'IN-0[1-8]\|260917\|review' <the six extensions/tests/docs paths>` shows no NEW hit (the pre-existing `IN-02:` comment near `uninstall.ts:1194` and any pre-existing `review` prose are the only allowed ones).
</verification>

<success_criteria>
- An orchestrated uninstall never sweeps, on the command surface's owner suite and therefore on the reconcile surface (D-05-08).
- The reconcile retry loop ends after one pass when a pass settles nothing; a converged entry beside a refusal costs one child call each.
- `dependency-index.ts` has one spelling of the marketplace record type; the catalog paragraph attaches its modifiers correctly with the byte lock intact.
- Four Conventional Commits with the required trailers; `05-REVIEW-FIX.md` records IN-01/02/03/07/08 fixed with SHAs and IN-04 carried to `PRUNE-GUARD-MR-01`; no CHANGELOG entry.
</success_criteria>

<output>
Write `/home/acolomba/src/pi-claude-marketplace-manifest/.planning/quick/260917-hfp-clear-the-phase-5-review-nits-in-01-in-0/260917-hfp-SUMMARY.md` when done. It must quote the raw red TAP `not ok` lines for the two planted cases verbatim, name all four commit SHAs, state the direct-coverage readings for the four production files, say whether `npm run fallow` needed the `applyPlan` hoist fallback for IN-08, and say explicitly that `CHANGELOG.md` and `.planning/BACKLOG.md` were not edited and why.
</output>
