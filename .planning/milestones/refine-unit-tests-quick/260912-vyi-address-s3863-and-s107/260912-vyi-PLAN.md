---
phase: 260912-vyi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - scripts/test-coverage-direct.pin.json
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - eslint.config.js
  - sonar-project.properties
autonomous: true
requirements: [D1, D2, D3]

estimate:
  tokens: 90000
  raw_tokens: 60000
  tasks: 6
  confidence: low

must_haves:
  truths:
    - "`npx eslint extensions` reports zero `@typescript-eslint/max-params` errors, with the rule committed at max 7 in `eslint.config.js` — so S107 is now falsifiable locally instead of only on a pull request (D2)."
    - "`node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` exits 0 against a re-measured pin reading — the S7737 hoist did not leave the direct-coverage pin stale (D3)."
    - "`npm run check` exits 0 at every one of the six commit boundaries."
    - "The `sonar.issue.ignore.multicriteria` block still names `typescript:S3863`, and the comment above it states the exclusion is committed but not in effect, cites the scanner-log evidence, and names the SonarCloud UI route (D1)."
    - "No `.ts` file under `extensions/` gained an `export` for a new options type or helper, so `tests/architecture/unowned-exports-census.test.ts` still reads its recorded census."
    - "Zero `fallow-ignore` markers and zero `health.thresholdOverrides` were added."
  artifacts:
    - eslint.config.js
    - sonar-project.properties
    - scripts/test-coverage-direct.pin.json
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  key_links:
    - "The rule lands LAST, after all three refactors. Enabling it first would make `npm run lint` — and therefore `npm run check` — red for three commits, which the green-at-every-boundary constraint forbids. The handoff's 'enable it first and let the failing lint define the work' is overridden by that constraint."
    - "`scripts/test-coverage-direct.pin.json` compares the WHOLE reading string by equality and fails on an improvement exactly as on a regression. The S7737 hoist adds one executed module-level statement to `install-outcome.ts`, so `lines 1034/1040` moves. The pin edit is part of that task, not a follow-up."
    - "`npm run check` does NOT run the direct-coverage pin — it runs `test:coverage:direct:negative` (the control), while the pin comparison lives in the `npm-coverage-direct` pre-commit hook. A green `npm run check` is therefore not evidence the pin holds; the single-path command is."
    - "The `prettier` pre-commit hook WRITES to `.js`/`.json`/`.ts` and the commit still succeeds with the unformatted bytes staged. `git status` after every commit; fix with a follow-up commit, never `--amend`."
---

<objective>
Close the three `typescript:S107` findings and the one `typescript:S7737` finding on PR #181 by
refactoring four module-private functions, then commit the local rule that makes S107 fail at lint
time instead of on a pull request. Separately, correct the `sonar-project.properties` comment so it
stops implying the committed `S3863` exclusion is active.

Purpose: two of these findings had no local equivalent, so they could only ever be found after a
push. Adding `@typescript-eslint/max-params` closes that gap permanently — the three fixes stop
being one-offs and become the first enforcement of a standing rule. The S3863 comment amendment
stops a reader from concluding a rule is suppressed when the measured evidence says it is not.

Output: six atomic Conventional Commits on `features/refine-unit-tests`, `npm run check` green at
each boundary.

## Ground truth measured while planning

Everything below was observed in this checkout at plan time. It supersedes the call-site counts in
the handoff and in CONTEXT.md section 1, which came from the Sonar API and are a guide, not edit
authority.

**Call sites — all four functions are module-private with exactly ONE caller each.** Verified by
`grep -rn '<name>' extensions tests scripts` and by CodeGraph's blast-radius report, which agree:

| Function | Declared | Sole call site | Exported? |
|---|---|---|---|
| `tryHydrateOnePlugin` | `bridges/hooks/event-router.ts:595` | same file, line 575 | no |
| `classifyDeclaredPlugin` | `orchestrators/reconcile/plan.ts:376` | same file, line 522 | no |
| `maybeBackfillPlugin` | `orchestrators/reconcile/backfill.ts:335` | same file, line 296 | no |
| `executeInstallLedger` | `orchestrators/plugin/install-outcome.ts:502` | same file, line 525 | no |

The handoff's "8 call sites" for `maybeBackfillPlugin` is wrong: `grep` finds one call and six
prose mentions in doc comments. The blast radius of all four edits is four files, no test file, no
exported surface.

**The rule reports exactly three.** Re-measured live, unpiped:

```
npx eslint extensions --rule '{"@typescript-eslint/max-params":["error",{"max":7}]}'
```

exits 1 with exactly the three functions above and nothing else. No fourth offender.

**Gate pins, each checked directly:**

- `tests/architecture/hooks-lifecycle.test.ts` — its only `[^{]*` signature regex is
  `/async function hydrateProjectScopeForCwdWith[^{]*\{([\s\S]*?)\n\}/` at line 292. It targets a
  DIFFERENT function, which this plan does not touch. There is no pin of any kind on
  `tryHydrateOnePlugin`. The signature is safe to change.
- `tests/architecture/unowned-exports-census.test.ts` — the census in `gate-targets.ts` records
  `createBeforeAgentStartHandler` for `event-router.ts` and `scanForceInstalledBackfills` for
  `backfill.ts`; `plan.ts` and `install-outcome.ts` have no census entry. The census measures
  exports with no production consumer, so it moves only if a new `export` is added. Every new type
  in this plan is module-private, which keeps it unmoved.
- `tests/index.test.ts` — its `deepStrictEqual` construction-string pins read
  `extensions/pi-claude-marketplace/index.ts` only, and match `createHooksRuntime()`,
  `createCompletionCache()`, `createHooksRouting(...)`, `createPluginUpdateOperations(...)` and
  `createHooksHydration(...)`. Neither `runPhases` nor `REAL_INSTALL_TRANSACTION` appears in that
  file. The S7737 hoist cannot move them.
- `tests/architecture/reconcile-planner-purity.test.ts` — greps comment-stripped `plan.ts` for
  `gitOps`, `notify`, `saveState`, `saveConfig`, `atomicWriteJson`, `withStateGuard`,
  `withLockedStateTransaction` and three `node:fs`/`platform/git` import forms. No field name
  introduced here collides with that list.
- `tests/architecture/eslint-effective-config.test.ts` — tracks `no-console` severity only. It
  carries no rule-count census, so adding a rule does not move it. The "217 rules" figure in the
  `eslint.config.js` comment and in CONVENTIONS.md counts the `sonarjs` spread, which is unchanged.
- `scripts/test-coverage-direct.pin.json` — pins `install-outcome.ts` at
  `branches 109/111, lines 1034/1040`. Re-measured live: the single-path command matches it exactly
  and exits 0 today. `assertPinnedReadingsUnmoved` compares the whole string, so this WILL move.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260912-vyi-address-s3863-and-s107/260912-vyi-CONTEXT.md
@.planning/HANDOFF-sonar-s107-s7737.md
@CLAUDE.md
@.planning/codebase/CONVENTIONS.md
@.agents/skills/typescript-google-style-review/SKILL.md
</context>

<house_rules>
These apply to every task. They are drawn from CLAUDE.md, CONVENTIONS.md, CONTEXT.md and the two
project review skills, and several have already cost time on this branch.

**Commits**
- Branch is `features/refine-unit-tests`. Never commit to main. Do NOT merge PR #181.
- This is a linked worktree, so `trufflehog` cannot run: prefix every commit `SKIP=trufflehog`.
- Run `pre-commit run --files <changed files>` BEFORE each `git commit`. Fix, restage, re-run until
  clean. Never `--no-verify`. Never `--amend` after a hook failure — a failed hook means the commit
  did not happen, so amending would rewrite the PREVIOUS commit.
- After each successful commit run `git status`. The `prettier` pre-commit hook writes to
  `.js`/`.json`/`.ts` files and the commit still succeeds with the pre-format bytes staged. If it
  rewrote anything, land a follow-up commit — do not amend.
- Conventional Commits. Title 5–72 chars. Body lines <= 80 chars. No milestone or phase references.
- No relative git anchors. Other sessions commit to this checkout, so capture an explicit SHA and
  use `$SHA^..$SHA` if a range is needed.

**Verification**
- Run every verify command UNPIPED. Piping through `tail`/`head` hands the chain the pipe's exit
  status and reports green on a failing command. That trap fired three times on this branch.
- `npm run check` must exit 0 at every commit boundary. Baseline: 5971 unit / 32 integration.

**Code**
- Do not add a `fallow-ignore` marker. Do not add a `health.thresholdOverrides` entry. The repo has
  zero of each and both counts are load-bearing facts in CONVENTIONS.md.
- Every extracted helper must satisfy BOTH complexity gates independently: fallow health
  (cyclomatic 20 / cognitive 15 / unit size 60) and ESLint (`sonarjs/cognitive-complexity` 15). The
  two tools use different algorithms and do not agree.
- Do NOT create three near-identical options-object builder functions — `sonarjs/no-identical-functions`
  fires at 3. This plan avoids that entirely: it declares three plain interfaces and destructures,
  and adds no builder function at all.
- Do NOT extract a new module. `npm run check` runs `test:corresponding`, which would demand a
  paired test file for it. Every change here is in place.
- Do not `export` any new type or helper. See the census note in the objective.
- Comments cite durable spec IDs and rule keys, never GSD phase/plan/wave/milestone numbers.
</house_rules>

<tasks>

<task type="tracer">
  <name>Task 1: Hoist the install-ledger transaction default and re-measure its coverage pin</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts,
    scripts/test-coverage-direct.pin.json
  </files>
  <read_first>
    extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts lines 170–185
    (the `InstallLedgerTransaction` declaration) and 490–512 (the `executeInstallLedger` doc comment
    and signature). Also read `scripts/test-coverage-direct.pin.json` in full — it is 25 lines.
  </read_first>
  <action>
    Implements D3.

    This is the tracer: it is the smallest real code change in the set, and it exercises the entire
    delivery loop end to end — edit, focused coverage gate, full check chain, `pre-commit --files`,
    `SKIP=trufflehog` commit, post-commit `git status`. Prove that loop here before spending it on
    the three larger refactors.

    Step 1 — hoist the default. Immediately ABOVE the existing doc comment for
    `executeInstallLedger`, add one module-private frozen constant:

    a `const` named `DEFAULT_INSTALL_LEDGER_TRANSACTION`, typed `InstallLedgerTransaction`, whose
    value is `Object.freeze` applied to an object literal carrying the already-imported `runPhases`
    as its sole shorthand property. `Object.freeze` is the house idiom for this — it appears in
    `bridges/agents/stage.ts`, `bridges/commands/stage.ts` and six other bridge modules. Give it a
    short block comment stating that the default names an existing object rather than allocating a
    fresh one per call, and cite the rule key `typescript:S7737`.

    Then change the fifth parameter of `executeInstallLedger` so its default names that constant
    instead of an inline object literal. Change nothing else about the signature, and do not touch
    `runInstallLedger` — its `transaction` parameter is already optional and forwards through.

    Placement matters for churn: putting the constant just above `executeInstallLedger` leaves the
    pin's first cited branch (the `PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)` guard, currently
    422-426) unmoved, and shifts only the second (the `parseHooksConfig` re-parse `if (!parsed.ok)`
    guard, currently 818-820). Do not put it near the imports — that would move both.

    Step 2 — re-measure and update the pin. Run the single-path direct-coverage command (in
    `<verify>`). It will refuse with the newly measured reading for this module. Copy that reading
    string verbatim into the `reading` field of the `install-outcome.ts` row in
    `scripts/test-coverage-direct.pin.json`. Do not edit the row's `findingIds`, and do not add or
    remove rows — `assertPinMembership` refuses both directions.

    Step 3 — resync the two line numbers cited in that row's `reasons` prose. The validator does not
    check them, but a stale citation is exactly the drift this repo's gates exist to prevent. After
    the edit, `grep -n 'PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)'` and
    `grep -n 'const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate)'` against the file,
    and correct the `NNN-NNN (branch NNN)` prefixes in both reasons to the new locations. Leave the
    reasoning text itself untouched.
  </action>
  <verify>
    <automated>node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts</automated>
    <automated>npm run check</automated>
  </verify>
  <done>
    `install-outcome.ts` carries exactly one new module-private frozen constant and the parameter
    default at the former line 507 names it. The direct-coverage command exits 0 and prints
    "1 pinned shortfall(s) matched ... exactly". `npm run check` exits 0. Both `reasons` line
    citations in the pin row resolve to the guards they describe. Committed with `SKIP=trufflehog`
    after a clean `pre-commit run --files`, and `git status` is clean afterward.
  </done>
</task>

<task type="auto">
  <name>Task 2: Group the reconcile planner's loop-invariant inputs into one object</name>
  <files>extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts</files>
  <read_first>
    `orchestrators/reconcile/plan.ts` lines 363–470 (the `DeclaredPluginAccumulator` interface and
    the whole `classifyDeclaredPlugin` body) and lines 471–530 (`diffPlugins`, which holds the sole
    call site at line 522).
  </read_first>
  <action>
    Implements D2, offender 1 of 3. Smallest blast radius first.

    **New signature — 8 parameters becomes 4:**

    ```
    classifyDeclaredPlugin(acc, inputs, key, declared): void
    ```

    The split is by lifetime, which is what the call site already reveals: `key` and `declared` vary
    per iteration of the `Object.entries(merged.plugins)` loop, `acc` is the output channel, and the
    remaining five — `scope`, `recordedKeys`, `declaredMarketplaces`, `marketplaceDiff`, `state` —
    are loop-invariant read-only context recomputed identically on every pass today.

    Declare a module-private interface for that context immediately below the existing
    `DeclaredPluginAccumulator` interface. Name it `DeclaredPluginInputs`. Give it five `readonly`
    fields: `scope: Scope`, `recordedKeys: ReadonlySet<string>`,
    `declaredMarketplaces: MergedConfig["marketplaces"]`, `marketplaceDiff: MarketplaceDiff`, and
    `state: ExtensionState`. Reuse the exact types the current parameters carry — do not widen or
    narrow any of them. Do NOT export it. Add a one-line doc comment saying it is the loop-invariant
    half of the classification, built once per diff pass.

    In `classifyDeclaredPlugin`, replace the five parameters with a single `inputs` parameter and
    destructure all five on the first line of the body. Keep the parameter order `acc, inputs, key,
    declared` so the accumulator still reads first. The rest of the body is unchanged, byte for
    byte — every identifier it already uses is bound by that destructure.

    In `diffPlugins`, build the object ONCE before the `for` loop, immediately after
    `const recordedKeys = buildRecordedKeys(state);`, and pass it into each call. Do not build it
    inside the loop; the whole point of grouping by lifetime is that it is allocated once. The
    `declaredMarketplaces` field takes `merged.marketplaces`, matching the current sixth argument.

    Naming note: do not call the parameter `ctx`. In this codebase `ctx` means the Pi extension
    context (`opts.ctx` in the sibling reconcile modules), and reusing it here would read as an
    effectful handle inside a module whose whole contract is purity.

    Purity guard: `tests/architecture/reconcile-planner-purity.test.ts` greps this file for
    `gitOps`, `notify`, `saveState`, `saveConfig`, `atomicWriteJson`, `withStateGuard` and
    `withLockedStateTransaction` as bare identifiers. None of the five field names collides, but do
    not rename any of them into that space.
  </action>
  <verify>
    <automated>npx eslint extensions --rule '{"@typescript-eslint/max-params":["error",{"max":7}]}'</automated>
    <automated>node --test "tests/orchestrators/reconcile/plan.test.ts" "tests/architecture/reconcile-planner-purity.test.ts"</automated>
    <automated>node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts</automated>
    <automated>npm run check</automated>
  </verify>
  <done>
    `classifyDeclaredPlugin` takes 4 parameters. The max-params probe no longer names it (it still
    exits 1 naming the other two — that is expected until Task 4). `DeclaredPluginInputs` is
    declared, not exported, and constructed exactly once in `diffPlugins`, outside the loop. The
    planner-purity test passes. The direct-coverage command for `plan.ts` exits 0 with no shortfall.
    `npm run check` exits 0. Committed with `SKIP=trufflehog`; `git status` clean afterward.
  </done>
</task>

<task type="auto">
  <name>Task 3: Give the hooks hydrate helper a target object, mirroring its sibling in the same file</name>
  <files>extensions/pi-claude-marketplace/bridges/hooks/event-router.ts</files>
  <read_first>
    `bridges/hooks/event-router.ts` lines 118–165 — the `ReadAndCachePluginHooksOptions` interface
    and `readAndCachePluginHooksWith`, which is the house pattern this task copies. Then lines
    547–672 — `hydrateScopeFromState` (sole call site, line 575) and the whole
    `tryHydrateOnePlugin` body.
  </read_first>
  <action>
    Implements D2, offender 2 of 3. The worst one at 10 parameters, and the one with an existing
    in-file precedent to copy.

    **New signature — 10 parameters becomes 4:**

    ```
    tryHydrateOnePlugin(reader, routingState, generationIsCurrent, target): Promise<void>
    ```

    Collaborators first, options object last. That is exactly the shape
    `readAndCachePluginHooksWith(reader, routingState, opts)` already uses forty lines earlier in
    this same file, so the two hydrate paths stay legible side by side. The seven remaining
    parameters all describe ONE plugin's hydration target and collapse into `target`.

    Declare a module-private interface named `HydrateOnePluginTarget` directly above
    `tryHydrateOnePlugin`. Seven `readonly` fields, keeping the current names and the current types
    exactly: `scope: Scope`, `marketplace: string`, `pluginId: string`, `resolvedSource: string`,
    `hooksJsonPath: string`, `hooksDir: string`, `cwd: string`. Do NOT export it.

    `resolvedSource` stays a plain `string`. Do not type it `AbsolutePluginRoot`. The function's
    contract is that `state.json` round-trips this field through an unconstrained `Type.String()`,
    so it brand-validates via `asAbsolutePluginRoot` inside the body and drops a corrupted record
    there. Typing the field as the brand would move that validation boundary out to the caller and
    defeat the guard. This is the one real difference from `ReadAndCachePluginHooksOptions`, whose
    `resolvedSource` is already branded — which is also why that interface cannot simply be reused
    here (it also carries `logPrefix`, lacks `hooksDir`, and names the field `plugin` not
    `pluginId`).

    In `tryHydrateOnePlugin`, replace the seven parameters with `target` and destructure all seven
    on the first line of the body. Everything below is unchanged — all seven identifiers stay bound
    under their current names, so the debug-log format strings, the `assertPathInside` call and the
    `setParsedConfig` payload all keep their current text.

    At the call site inside `hydrateScopeFromState`, pass the three collaborators positionally and
    an inline object literal for the target: `scope: loc.scope`, `marketplace: mpName`, `pluginId`,
    `resolvedSource: pluginRecord.resolvedSource`, `hooksJsonPath`, `hooksDir: loc.hooksDir`, `cwd`.
    The `if (!generationIsCurrent()) { return; }` check that follows the call stays exactly where it
    is.

    Regex-pin check, already performed at plan time and restated so it is not re-litigated: the only
    `[^{]*` signature regex in `tests/architecture/hooks-lifecycle.test.ts` is at line 292 and
    targets `hydrateProjectScopeForCwdWith`, a different function that this task does not touch.
    Nothing pins `tryHydrateOnePlugin`. Introducing a `{` into its parameter list is safe. Run the
    lifecycle test anyway — it is in `<verify>`.
  </action>
  <verify>
    <automated>npx eslint extensions --rule '{"@typescript-eslint/max-params":["error",{"max":7}]}'</automated>
    <automated>node --test "tests/bridges/hooks/event-router.test.ts" "tests/architecture/hooks-lifecycle.test.ts" "tests/bridges/hooks/index.test.ts" "tests/bridges/hooks/routing-state.test.ts"</automated>
    <automated>node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/event-router.ts</automated>
    <automated>npm run check</automated>
  </verify>
  <done>
    `tryHydrateOnePlugin` takes 4 parameters in the order collaborators-then-target, matching
    `readAndCachePluginHooksWith`. `HydrateOnePluginTarget` is declared, not exported, and its
    `resolvedSource` is still `string`. The max-params probe no longer names this function. The
    hooks lifecycle test passes. The direct-coverage command for `event-router.ts` exits 0 with no
    shortfall. `npm run check` exits 0. Committed with `SKIP=trufflehog`; `git status` clean after.
  </done>
</task>

<task type="auto">
  <name>Task 4: Name the backfill target type the caller already builds and thread it through</name>
  <files>extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts</files>
  <read_first>
    `orchestrators/reconcile/backfill.ts` lines 208–235 (the `scanForceInstalledBackfills` loop that
    builds the target literal), 243–320 (`backfillOnePluginIsolated`, which already declares the
    target as an inline object type and holds the sole `maybeBackfillPlugin` call at line 296), and
    318–345 (the `StateMarketplaceRecord` / `StatePluginRecord` aliases and the
    `maybeBackfillPlugin` signature).
  </read_first>
  <action>
    Implements D2, offender 3 of 3. This one needs no invention: the caller already carries the
    right object.

    `backfillOnePluginIsolated` currently declares its second parameter as an inline object type
    with exactly the five fields `maybeBackfillPlugin` takes positionally — `scope`, `marketplace`,
    `mp`, `plugin`, `record` — destructures them, and then re-spreads them across an 8-argument
    call. Naming that inline type and passing the object straight through removes the re-spread.

    **New signature — 8 parameters becomes 4:**

    ```
    maybeBackfillPlugin(opts, target, reinstallPlugin, outcomes): Promise<boolean>
    ```

    Declare a module-private interface named `BackfillTarget` beside the existing
    `StateMarketplaceRecord` and `StatePluginRecord` type aliases, with five `readonly` fields
    carrying those exact names and types. Do NOT export it. TypeScript hoists type declarations, so
    placing it there is fine even though `backfillOnePluginIsolated` appears earlier in the file —
    that function's current inline literal already forward-references both aliases from the same
    position. Add a one-line doc comment: one scanned record's identity — which plugin, in which
    marketplace, in which scope, plus the two records the promotion needs.

    Replace `backfillOnePluginIsolated`'s inline object type annotation with `BackfillTarget`. Its
    parameter COUNT does not change (it is already 5, under the limit) and its existing
    `const { scope, marketplace, mp, plugin, record } = target;` destructure stays — the three
    guards below it read `record`, `marketplace` and `plugin` directly.

    Change the call at line 296 to pass `target` whole: `maybeBackfillPlugin(opts, target,
    reinstallPlugin, outcomes)`. Then in `maybeBackfillPlugin`, replace the five positional
    parameters with one `target: BackfillTarget` and destructure all five on the first line of the
    body. Everything below is unchanged — the `resolveRecordedPluginOffline(mp, plugin)` call, the
    `reinstallPlugin({...})` payload and all three `outcomes.push` shapes keep their current text.

    Do not change `scanForceInstalledBackfills`. Its inline literal
    `{ scope, marketplace, mp, plugin, record }` already structurally satisfies `BackfillTarget`
    and needs no annotation.

    Leave the six doc-comment mentions of `maybeBackfillPlugin` in this file alone. They describe
    the SF-01/SF-02 fault-isolation contract, which this task does not alter.
  </action>
  <verify>
    <automated>npx eslint extensions --rule '{"@typescript-eslint/max-params":["error",{"max":7}]}'</automated>
    <automated>node --test "tests/orchestrators/reconcile/backfill.test.ts"</automated>
    <automated>node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts</automated>
    <automated>npm run check</automated>
  </verify>
  <done>
    `maybeBackfillPlugin` takes 4 parameters. `BackfillTarget` is declared once, not exported, and
    annotates both it and `backfillOnePluginIsolated`. The max-params probe now exits 0 with no
    output at all — all three offenders are cleared, which is the precondition for Task 5. The
    backfill test passes. The direct-coverage command for `backfill.ts` exits 0 with no shortfall.
    `npm run check` exits 0. Committed with `SKIP=trufflehog`; `git status` clean afterward.
  </done>
</task>

<task type="auto">
  <name>Task 5: Commit @typescript-eslint/max-params at 7 over the extension tree</name>
  <files>eslint.config.js</files>
  <read_first>
    `eslint.config.js` — the "Sonar way, enforced locally" config block (its comment begins around
    line 297 and the block ends with the re-asserted `"sonarjs/cognitive-complexity": ["error", 15]`
    rule), and the `files: ["tests/**/*.ts"]` block that immediately follows it.
  </read_first>
  <precondition>
    `npx eslint extensions --rule '{"@typescript-eslint/max-params":["error",{"max":7}]}'` exits 0
    with no output. Tasks 2, 3 and 4 must all be committed first. Adding the rule while any offender
    remains turns `npm run lint` — and therefore `npm run check` — red, which the
    green-at-every-commit-boundary constraint forbids.
  </precondition>
  <action>
    Implements D2's enforcement half, and is the durable value of this work: it converts a
    pull-request-only finding into a lint-time one.

    Insert a NEW flat-config object between the Sonar-way block and the `tests/**/*.ts` block. Do
    not fold the rule into the Sonar-way block — that block's contract is "spread
    `sonarjs.configs.recommended.rules`, then re-assert the one rule the spread would have
    downgraded", and a hand-added non-`sonarjs` rule inside it would misrepresent what the spread
    contains.

    The new object has `files: ["extensions/pi-claude-marketplace/**/*.ts"]` and one rule:
    `"@typescript-eslint/max-params"` at `"error"` with `{ max: 7 }`. Mirror the Sonar-way block's
    scoping exactly — same glob, same reason.

    Write a comment above it recording three things a future reader needs:
    - `typescript:S107` has no `eslint-plugin-sonarjs` implementation at any severity, so the spread
      above does not carry it and the finding could only ever surface on a pull request. This rule
      is the local equivalent.
    - 7 is Sonar's own maximum for S107, so the two gates agree by construction rather than by
      coincidence.
    - The glob mirrors `sonar.sources` in `sonar-project.properties`. SonarCloud drops `tests/**`
      via `sonar.test.exclusions`, so enforcing there would gate code Sonar never grades.

    Do not touch the "217 rules at error / 62 off" figure in the Sonar-way comment. It counts the
    `sonarjs` spread, which this task does not change, so it stays accurate.

    Do not add the rule to the `tests/**/*.ts` or `scripts/` scope. `npm run lint` covers
    `extensions tests scripts eslint.config.js`, and widening the glob would surface offenders
    outside the measured set of three and outside what Sonar grades.
  </action>
  <verify>
    <automated>npm run lint</automated>
    <automated>node --test "tests/architecture/eslint-effective-config.test.ts" "tests/architecture/import-boundaries.test.ts"</automated>
    <automated>npm run check</automated>
  </verify>
  <done>
    `eslint.config.js` carries a dedicated block enabling `@typescript-eslint/max-params` at
    `["error", { max: 7 }]` scoped to `extensions/pi-claude-marketplace/**/*.ts`, placed between the
    Sonar-way block and the tests block, with the three-point comment. `npm run lint` exits 0.
    `npm run check` exits 0. Committed with `SKIP=trufflehog`; `git status` clean afterward (this
    file is `.js`, so the writing prettier hook can touch it — check).
  </done>
</task>

<task type="auto">
  <name>Task 6: Record that the committed S3863 exclusion is not in effect</name>
  <files>sonar-project.properties</files>
  <read_first>
    `sonar-project.properties` lines 17–36 — the `# Issue exclusions.` comment block and the three
    `sonar.issue.ignore.multicriteria*` property lines that follow it.
  </read_first>
  <action>
    Implements D1. This is a comment amendment only.

    Do NOT remove or edit the three `sonar.issue.ignore.multicriteria` property lines. Do NOT change
    `resourceKey`. Do NOT touch the 17 files' imports. The source-level fix — merging each value +
    type import pair into one statement with inline `type` specifiers — was considered and rejected
    by the operator, because it would break the documented convention that type-only imports are
    grouped last and `import-x/order` enforces.

    Keep the existing rationale paragraphs (why S3863 fires on a convention rather than a defect,
    and why there is no local equivalent to keep in step with). They are still true. ADD a paragraph
    recording the status, so no reader concludes the rule is currently suppressed. It must carry
    four facts, all measured on CI run `34733874521`, the `sonarcloud` job on the pull request:

    1. The exclusion is committed but NOT currently in effect. `typescript:S3863` still reports 34
       findings, which is the expected reading and not a regression.
    2. The scanner DOES read this file — the log names it as the project root configuration file,
       and echoes `sonar.exclusions` and `sonar.cpd.exclusions` from it back as
       "Excluded sources" lines.
    3. The scanner nonetheless drops `sonar.issue.ignore.*` silently: no log line mentions the issue
       exclusion at all, over the full 7970-line log. The analysis ran on the commit that added the
       exclusion, so the unchanged count is a fresh reading rather than a stale snapshot. Server
       settings carry no `sonar.issue.ignore.*` value of any kind and `sonar.autoscan.enabled` is
       false.
    4. The remaining route to activate it is the SonarCloud UI, under
       `Administration > General Settings > Analysis Scope`. Say this plainly, so the next reader
       knows what to do rather than re-diagnosing.

    Worth stating explicitly in the comment, because it is the trap: getting NO log line is a
    different failure from a wrong pattern. A `resourceKey` that matched nothing would still have
    produced an "Ignoring issues on multiple criteria"-class line with zero matches. So the
    hypothesis that the pattern should be `**/*.ts` rather than repeating the source root is not
    what the evidence points at, and retrying that is wasted effort.

    Keep every line at or under the width of the surrounding comment lines, and keep the `#` comment
    prefix on every added line. This file is not covered by prettier or by any npm pre-commit hook,
    so nothing will reflow it for you.
  </action>
  <verify>
    <automated>grep -c '^sonar\.issue\.ignore\.multicriteria' sonar-project.properties</automated>
    <automated>grep -F 'Administration > General Settings > Analysis Scope' sonar-project.properties</automated>
    <automated>grep -F 'sonar.issue.ignore.multicriteria.e1.ruleKey=typescript:S3863' sonar-project.properties</automated>
    <automated>pre-commit run --files sonar-project.properties</automated>
  </verify>
  <done>
    The first grep prints `3` — all three property lines survive untouched. The second and third
    exit 0. The comment above them states the exclusion is committed but not in effect, cites the
    scanner-log evidence and the unchanged count of 34 as expected, and names the UI route. A reader
    of this file cannot conclude S3863 is currently suppressed. `pre-commit run --files` is clean.
    Committed with `SKIP=trufflehog`. `npm run check` is unaffected: this file matches none of the
    npm pre-commit hooks' `files:` patterns and is read by no test.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `state.json` -> hooks hydrate | `resolvedSource` and the hooks slug are state-supplied data, re-read at load time by `tryHydrateOnePlugin` (Task 3). This is the only boundary any task in this plan touches. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-vyi-01 | Tampering | `tryHydrateOnePlugin` path containment | medium | mitigate | The `assertPathInside(hooksDir, hooksJsonPath, ...)` guard (NFR-10) must stay the FIRST statement after the destructure. Task 3 moves seven parameters into an object and changes nothing else in the body; `hooksDir` and `hooksJsonPath` keep their names and their `string` types, so the guard's inputs are unchanged. |
| T-vyi-02 | Tampering | `tryHydrateOnePlugin` brand validation | medium | mitigate | `resolvedSource` stays typed `string`, not `AbsolutePluginRoot`, so `asAbsolutePluginRoot` keeps validating it inside the function. Typing the new interface field as the brand would push validation to the caller and let a corrupted record reach `CLAUDE_PLUGIN_ROOT`. Task 3 states this as a hard constraint. |
| T-vyi-03 | Tampering | `sonar-project.properties` exclusion scope | low | accept | Task 6 is comment-only and explicitly forbids editing `resourceKey` or the rule key, so the exclusion's blast radius cannot widen. Accepted: the exclusion is measurably inert today, and the amendment's purpose is to say so. |

No task installs a package from npm, pip or cargo, so no package-legitimacy gate applies.
</threat_model>

<verification>
Run after the sixth commit, all UNPIPED.

1. `npx eslint extensions --rule '{"@typescript-eslint/max-params":["error",{"max":7}]}'` — exit 0,
   no output. This is the direct falsification of the D2 claim, independent of whether the committed
   config block is wired correctly.
2. `npm run lint` — exit 0. This is the same claim through the COMMITTED config, so 1 and 2 together
   distinguish "the code is clean" from "the rule is actually enabled". Both must pass.
3. `npm run check` — exit 0. Expect the 5971 unit / 32 integration baseline.
4. `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`
   — exit 0, printing "1 pinned shortfall(s) matched ... exactly". `npm run check` does NOT cover
   this; it runs the negative control instead.
5. `git status` — clean. Confirms the writing prettier pre-commit hook did not leave reformatted
   bytes behind on any of the six commits.
6. `grep -rn 'fallow-ignore' extensions tests scripts` — the count must equal 11, unchanged. And
   `.fallowrc.json` must still hold zero `thresholdOverrides` entries.
7. `grep -rn 'export interface HydrateOnePluginTarget\|export interface DeclaredPluginInputs\|export interface BackfillTarget' extensions`
   — exit 1, no match. Proves none of the three new types was exported, which is what keeps
   `unowned-exports-census.test.ts` unmoved.

The S3863 half has no local command and is verified by reading the committed comment.

After the branch is pushed, the finding counts are anonymously queryable and are the real proof for
S107 and S7737, which have no other local equivalent:

```
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=acolomba_pi-claude-marketplace&pullRequest=181&rules=typescript:S107,typescript:S7737"
```

Expect `"total": 0` once CI re-analyses. `typescript:S3863` stays at 34 by decision D1 — that is the
expected reading, not a regression. Do NOT merge PR #181; the operator is holding it open.
</verification>

<success_criteria>
- Six atomic commits on `features/refine-unit-tests`, each Conventional Commits, each prefixed
  `SKIP=trufflehog`, each preceded by a clean `pre-commit run --files`, `npm run check` exit 0 at
  every boundary.
- `@typescript-eslint/max-params` is committed at `["error", { max: 7 }]` scoped to
  `extensions/pi-claude-marketplace/**/*.ts`, and reports zero offenders.
- `classifyDeclaredPlugin` reads 4 parameters, `tryHydrateOnePlugin` 4, `maybeBackfillPlugin` 4.
- `executeInstallLedger`'s transaction default names a module-level frozen constant, and
  `scripts/test-coverage-direct.pin.json` carries the re-measured reading with resynced line
  citations.
- `sonar-project.properties` keeps its three exclusion lines and gains a status paragraph that makes
  the inertness, the evidence, and the UI route unmistakable.
- No new export, no new module, no new `fallow-ignore`, no new `thresholdOverrides`.
</success_criteria>

<output>
Create `.planning/quick/260912-vyi-address-s3863-and-s107/260912-vyi-SUMMARY.md` when done.

Record in it: the six commit SHAs; the before/after direct-coverage reading for `install-outcome.ts`
verbatim; the final parameter count of each of the three refactored functions; and confirmation that
the max-params probe and `npm run lint` both exit 0.
</output>
