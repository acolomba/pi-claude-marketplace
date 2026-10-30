# Phase 10: Lifecycle Test and Harness Gaps - Context

**Gathered:** 2026-10-27
**Status:** Ready for planning

Smart discuss ran autonomously (the parent session asked for an unattended run).
Every recommended answer below was taken; choices that a reviewer may want to
reverse are listed under "Uncertain choices (for user review)" at the end.

<domain>
## Phase Boundary

Every behavior lifecycle-coverage left without a scenario or unit case gets one
(or a recorded unit-only reason), the harness items are fixed, and the
cross-phase residue the wave-1 reviews carried forward is closed.

In scope: TST-01 (LCTEST-01), TST-02 (LCHARN-01), TST-03 (TEST-PHANTOMMP-01),
CAS-08, MIM-05, XPH-01, XPH-02.

Out of scope:

- The `install-flow.ts` split (Phase 11, CLN-02), LCCODE-01 dead code, docs and
  CHANGELOG (Phase 11). This phase adds no file under `docs/` except where a
  new output state needs its `docs/output-catalog.md` example (catalog states
  ship with the state, as Phase 3 did).
- `CHANGELOG.md`, `.planning/PROJECT.md`, `.planning/BACKLOG.md`: not edited.
  The last plan's SUMMARY carries `## CHANGELOG line`, `## Decision rows`,
  `## Backlog dispositions` for the parent to apply.
- Milestone closeout (`/gsd-audit-milestone`, `/gsd-complete-milestone`).

Coordination: Phase 11 runs in parallel and waits to split
`orchestrators/plugin/install-flow.ts` until this phase's `install-flow.ts`
edits land. All `install-flow.ts` edits go in the earliest waves; the
orchestrator messages the parent session once they are committed.

</domain>

<upstream_evidence>
## Claude Code evidence

Grepped from the installed binary, Claude Code 2.1.310
(`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`), and
the docs, on 2026-10-27.

### E1: plugin with only `yarn.lock` or `pnpm-lock.yaml`

- **Behavior:** no package manager runs and there is no npm fallback. The
  install finishes; the plugin is installed and enabled. At install time the
  refusal text goes to the debug log only:
  `if(h==="yarn-or-pnpm")return{ran:!1,error:"Skipped: yarn/pnpm lockfiles are not supported (...). Use bun or npm."}`
  → `t(\`Plugin dependency install warning for ${n}: ${dt.error}\`,{level:"warn"})`.
  At each later load the plugin loads with a warning note of type
  `dependencies-refused`: `{kind:"refused",reason:"it uses a yarn or pnpm lockfile, which plugin installs do not support"}`,
  rendered "The packages it lists were not installed, because it uses a yarn or
  pnpm lockfile, which plugin installs do not support", plus "If it needs those
  packages, parts of it may not work. Updating or reinstalling this version of
  the plugin will not install them while that is still true". It shows as a
  `Note:` line in `claude plugin list` (status stays loaded) and as a warning
  note in `/plugin`.
- **Conditions:** only when the plugin root is in the plugin cache, has no
  `node_modules`, and its `package.json` lists `dependencies`,
  `optionalDependencies`, `peerDependencies`, or `workspaces`. `update` never
  retries it.
- **Confidence:** high.

### E2: the official marketplace's fallback source

- **Behavior:** a fallback entry (`sourceIsFallback`) is up to date whenever
  its name is recorded, whatever source is recorded; it is never
  `sourceChanged`. An unrecorded name is `missing` and is added from
  `anthropics/claude-plugins-official`. Any explicit declaration replaces the
  fallback and is compared normally.
- **Evidence:** `if(!y)g.push(u);else if(f.sourceIsFallback)n.push(u);else if(!wn(m,y.source))o.push(...)`;
  `zF` returns `{...fallback, ...addDir, ...declared}`.
- **Confidence:** high.

### E3: a declared marketplace source change at startup

- **Behavior:** the reconciler re-adds the marketplace in place from the new
  source (`sourceChanged` → `CRn` → `Lle`): it rewrites the
  `known_marketplaces.json` entry and the clone, leaves installed plugins
  alone, and says "Plugins changed. Run /reload-plugins to activate." The
  clone and parse happen in a temp folder before the locked write, so a failed
  new source keeps the old record; it logs
  `[reconcile] failed to update marketplace '<n>'` and retries each startup.
- **Precedence:** one whole entry per name (`Hqt={...e,...n}`); managed >
  `--settings` > local > project > user.
- **Writes:** the reconcile writes no settings file. An explicit
  `marketplace add` writes `{source}` into the one file of its `--scope`.
- **Stale local declaration (inferred, medium):** upstream neither overwrites
  nor ignores a local-layer entry; it wins the merge, so the next startup
  re-adds the stale source. No upstream precedent exists for an import that
  removes it.

### E4: invalid manifest after a successful clone

- **Behavior:** no message suggests retrying. Marketplace add:
  `Failed to parse marketplace file at <path>: Invalid JSON in …` /
  `Invalid schema …`. Marketplace refresh: suggests
  `claude plugin marketplace remove <n>`. Plugin install/update:
  `Plugin <n> has a corrupt manifest file at <path>.` / `has an invalid manifest file …`.
  "Try again" appears only for transport or filesystem failures.
- **Confidence:** high.

### E5: an unrecognized network error

- **Behavior:** no shared user-facing classifier. Each surface shows the raw
  cause in its own frame (`Failed to clone repository: <stderr>`,
  `Failed to clone marketplace repository: <stderr>`,
  `Failed to download marketplace from <url>: <msg>`). Surfaces that share the
  clone machinery (plugin install and update) show the same text.
- **Confidence:** high.

</upstream_evidence>

<decisions>
## Implementation Decisions

Decision IDs are `D-PL10-NN`.

### Wave order and coordination

- **D-PL10-01:** every edit to `orchestrators/plugin/install-flow.ts` (CAS-08's
  three routes, XPH-02's root-cause redaction, cascade member warnings, and
  dependency-move warnings and notices) lands in wave 1 (and wave 2 at most).
  No later plan touches `install-flow.ts`. When those plans are merged and
  committed, the orchestrator messages the parent session.
- **D-PL10-02:** plans in one wave own disjoint files. Waves run sequentially
  in the one worktree when two plans would share a test file or a step module.
  Executors commit with the pathspec form (`git commit -F <msg> -- <paths>`),
  plan-scoped message files, and never `--no-verify`.
- **D-PL10-03:** every new user-visible behavior ships a cucumber scenario
  that fails without the change (AGENTS.md "Behavioral tests"). Every test
  runs under a hermetic home (`withHermeticHome` or a temp
  `PI_CODING_AGENT_DIR`); nothing reads or writes the real `~/.pi`.

### CAS-08: failure rows on the three routes

- **D-PL10-04:** on all three routes (the root's own ledger failure, a
  UPD-DEP-D1 plan-step failure, a catalog lookup that throws mid-walk), each
  closure member that resolved but did not install gets the D-PL3-15
  `{dependency failed}` row, in the same order and with the same moved-key
  rule (a moved key gets no second row) the walk, constraint, and member routes
  use. The row builder in `install-cascade.messaging.ts`
  (`unmaterializedRows`) is reused, not copied.
- **D-PL10-05:** root ledger failure: the cascade's `unmaterialized` list
  (every rolled-back dependency) reaches the standalone failure message; the
  root row keeps its current reason and its entity-shape and git-auth
  classification.
- **D-PL10-06:** plan-step failures: the members of the failed slice, of later
  steps, and of `plan.final` that resolved but never installed get rows;
  `dependency-bindings.ts`'s filter that keeps only rows with a cause no longer
  drops them. The update path (`materialize-latest.ts`, `update-cascade.ts`)
  shows the same rows.
- **D-PL10-07:** mid-walk throw: the keys the walk had declared before the
  throw are kept and rendered as rows; a throw from the dependency
  declaration read is caught at the same level as a `recordFor` throw. The
  root row keeps the parse error cause. The existing single-row scenario
  (`install-dependencies.feature:937-967`) is updated, not duplicated.
- **D-PL10-08:** one scenario per route in `install-dependencies.feature`
  (and `update-dependencies.feature` for the update side of plan steps).

### MIM-05: apply's missing-dependency rollback detail

- **D-PL10-09:** `apply`'s MISS-01 failed row reads `result.rollbackPartials`
  and renders exactly what `apply`'s config-install failed row renders under
  D-PL6-05/D-PL6-12: `(failed) {rollback partial}`, per-phase
  `[<phase>] (rollback failed)` children, a dependency's own partial row,
  redacted phase causes. `installFailedOutcomes` is generalized to take a
  `PlannedDependencyInstall`; the `cross-marketplace` reason is kept. The stale
  comment "apply does not render them yet" (`install-flow.ts:3021-3023`) is
  updated in the same plan (wave 1, because it is `install-flow.ts`).

### XPH-02: babysit-review residue

- **D-PL10-10 (#1):** the `marketplace update` / autoupdate / apply-converge
  cascade failure row gives an `AgentTargetOccupiedError` no closed-set reason,
  as the direct path does (D-PL4-09); the cause names the file.
- **D-PL10-11 (#2):** `fetch` and `update` route an error that
  `classifyGitFailure` leaves unclassified through one shared fallthrough in
  `shared/git-failure-classifiers.ts`. A file-system errno keeps each verb's
  file reason (`unreadable manifest` / `source missing` as today for ENOENT and
  similar). An unclassified error with no file-system errno reads
  `network error` with its redacted raw cause, in both verbs (upstream shows
  the raw cause in one frame for both clone surfaces, E5).
- **D-PL10-12 (#3):** a dependency move during `update` or `apply` keeps its
  staging warnings (both halves, in the D-PL1-25 per-plugin diagnostic) and its
  MCP config notices, in the order they happened (dependency first). This
  amends D-PL1-16's "a dependency move's notices are not included".
- **D-PL10-13 (#4):** a forced reinstall never drops a foreign-preserved
  agents-index row silently. When the row's `generatedName` is staged but its
  `targetPath` is a different file, the row and the file are kept and a
  hygiene warning names the file (D-PL1-15: never delete a user-named file the
  current version does not replace).
- **D-PL10-14 (#5):** a failed install's root cause is redacted with
  `redactAbsolutePaths`, as its members' causes are, on the cascade and the
  standalone path. Lock-held causes stay unredacted (IMP-07).
- **D-PL10-15 (#6):** the commit-time occupied-agent refusal
  (`assertAgentCommitTargets`) throws `AgentTargetOccupiedError`, so it shows
  the file name only, as the preview refusal does. Unit tests that pin the full
  path change with it.
- **D-PL10-16 (#7):** an install-cascade member's discovery warnings (its
  package note included) are carried on its member outcome and rendered in the
  D-PL1-25 per-plugin diagnostic, on install, on `apply`'s MISS-01 install, and
  on import, following `dependency-move.ts`'s `withPackageNote`.
- **D-PL10-17 (#8):** a marketplace refresh whose clone advanced but whose new
  manifest is invalid no longer carries `Retry the command.`, and its row reads
  the invalid-manifest reason instead of "manifest could not be persisted"
  (E4). No new hint is added.
- **D-PL10-18 (#9):** parity for yarn/pnpm-only plugins (E1): the
  `package.json` listing check (`dependencies`, `optionalDependencies`,
  `peerDependencies`, `workspaces`) runs before the lockfile choice, so a
  plugin that lists nothing is silent; a plugin that lists packages and has
  only `yarn.lock` / `pnpm-lock.yaml` is installed with a warning that uses
  upstream's user-visible wording ("The packages it lists were not installed,
  because it uses a yarn or pnpm lockfile, which plugin installs do not
  support"). The note stays at install time (see Uncertain choices).

### XPH-01: wave-1 cross-phase residue

- **D-PL10-19 (2.30):** the add-time MISS-01 step's post-commit hygiene
  warnings travel on `ScopeDependencyInstallResult` and render through the
  tagged warning channel (`staging-diagnostics.ts`) in `marketplace add`,
  `bootstrap`, and the autoupdate step.
- **D-PL10-20 (5.27, 5.28):** `import`'s own marketplace failure row marks
  `marketplaceSubject: true` (bare JSON id, D-PL5-12); the D-76-04 citation in
  `orchestrators/import/marketplaces.ts:52` cites D-PL5-13.
- **D-PL10-21 (2.19, 7.16):** scenarios pin the git-revision post-move read in
  `apply` and the reinstall `{status} on {url}` frame.
- **D-PL10-22 (7.15):** completion after `market` is pinned by a scenario
  through the tui driver (D-PL10-26), which presses Tab and reads the
  completion list from the screen. If the researcher finds the driver cannot
  read completions reliably, the fallback is a test-only wrapper extension
  that captures `getArgumentCompletions` and exposes it over RPC; the choice
  is recorded in the plan.
- **D-PL10-23:** `apply` and the load re-add a marketplace in place on a
  declared source change, as `import` does under D-PL6-19 (E3): the plan
  emits a re-add step instead of a report-only `{source mismatch}` row;
  `pending` and a load without autoapply preview it (a load changes nothing,
  APL-D1); `apply` (and an autoapply load) runs it through `add.ts`'s
  `replaceRecorded` body. A failed new source keeps the old record and reports
  the failure; installed plugins are left for convergence. The one-to-one
  source-claim alias is replaced by the re-add only where import also
  re-adds (a declared path that does not exist, or a source recorded under
  another name, keeps import's D-PL6-19 exceptions).
- **D-PL10-24:** the official marketplace's fallback source reads as up to
  date whenever its name is recorded (E2), in `import`, `pending`, the load,
  and `apply`. No `{source mismatch}` row for it.
- **D-PL10-25:** a local-layer declaration of an old source no longer outlives
  an import re-add: when import re-adds a marketplace and the scope's
  `claude-plugins.local.json` declares that name with the old source, import
  rewrites that one local entry to the new source (other local entries are
  untouched). Divergence from upstream licensed by the requirement (E3 has no
  precedent); see Uncertain choices.
- **D-PL10-26:** a pty-backed `tui` cucumber driver drives Pi in interactive
  mode for the background autoupdate pass scenarios (the pass arms, its wait
  cap, and its notice dedupe) and the completion scenario. Constraints: no
  native-build dependency (no `node-pty` compile); runs on the Node 24 Ubuntu
  CI runner and locally; hermetic home and stand-ins as the RPC driver; one
  Pi per scenario, freed by the scenario's release hook. Recommended
  mechanism: a small `python3` `pty` bridge (python3 is on every runner)
  spawned by the driver, with a pure-JS headless terminal (`@xterm/headless`,
  devDependency) to read the screen; the researcher verifies and may pick a
  simpler equivalent. The delay knob `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS`
  (D-PL8-09) sets the pass delay to 0. The 30 000 ms wait cap is exercised at
  its real value (no new production knob); the scenario carries a tag the
  cucumber config runs in the normal suite.
- **D-PL10-27:** the package-install process-tree kill gets a scenario: the
  npm registry stand-in gains a stall arm, and the scenario uses the real
  60 s limit unless the researcher finds an existing knob; no new production
  environment variable. If the stall cannot make npm outlive the limit
  deterministically, the plan records the item unit-only with the measured
  reason (see Uncertain choices).

### TST-01 (LCTEST-01)

- **D-PL10-28:** each open item gets a scenario: the `, `-joined range on an
  update cause; a post-swap update failure (rollback partial plus the
  reinstall hint); an already-enabled root plus a missing dependency; a `list`
  row in `partially-upgradable`; prune keep-dependency checks
  `claude-plugins.json`; the failed-install apply edit that also carries an
  uninstall and a disable; a bare `fetch` that continues after one failure;
  `rm` / `ls` alias usage-error rows; the url invalid-JSON failed add's record
  check (a new step reading the state record) and retry; the migration before
  a base-file set (extend `features/lib/earlier-version-state.ts` to plugin
  records); the tag update's dependency closure (CR-04, now unblocked); and a
  no-op `apply` that writes nothing (a new file-unchanged step).
- **D-PL10-29:** load-time autoapply with stored credentials and no Device
  Flow stays unit-only, with the recorded reason "no Device Flow stand-in;
  building one is out of proportion to one negative" — unless a Device Flow
  stand-in already exists, in which case it gets a scenario.
- **D-PL10-30:** unit cases: the MPA-01 standalone skip checks the completion
  cache; the project-scope tokens case and the update raw-error cascade arm
  get cases if the researcher finds them still missing (CASCREASON-01 may have
  closed the arm). The import re-enable `{rollback partial}` case is already
  closed in wave 1 (`execute.test.ts:5468`, `import.feature:977`).

### TST-02 (LCHARN-01)

- **D-PL10-31:** fixed: `holds no git clones` also checks `sources-staging/`
  and `sources/` folders without `.git`; data- and agents-directory listings
  see empty folders and symlinks; `expandTokens` throws on an unknown run
  token; `rules/world-and-stand-ins.md:15` no longer contradicts
  `rules/features.md:41`; `holds these git clones:` prints the unpinned
  mirror's revision; the install-retry seed uses one `When`; the ten `list`
  scenarios move to `features/plugin/list-filters.feature` with a
  `Background:`; `browse.test.ts` waits on the `requestRender` event instead
  of 50 ms. The installation-record revision tokens half is already fixed.
- **D-PL10-32:** the network guard is recorded as declined: `PI_OFFLINE=1`,
  `--offline`, the base-URL override, and the NFR-5 lint rule already limit
  the network, and a socket-wrapping preload would not cover `git credential`
  child processes. Recorded as a decision row.

### TST-03

- **D-PL10-33:** a shared seeding helper under `test/` writes a marketplace
  record and its loadable manifest together (modeled on
  `uninstall.test.ts::seedDeclaringScope`); `conflictingMarketplaceRecord` in
  `install-flow.test.ts` and the PDEF-01 fixture in `reinstall-flow.test.ts`
  use it. No fixture builds a marketplace record without its manifest.

### Claude's Discretion

- Plan count and grouping inside the wave constraints; exact step wording;
  where new step definitions live (per `rules/layout.md`).

</decisions>

<code_context>
## Existing Code Insights

`ext/` = `extensions/pi-claude-marketplace/`. HEAD 4ce41525.
`ext/orchestrators/plugin/install-flow.ts` has 3816 lines.

### CAS-08 sites

- Row builder: `install-cascade.messaging.ts:601-626` (`unmaterializedOf`,
  `unmaterializedRows`), added by `composeCascadeFailureMessage` `:653-694`.
- Lists: `install-cascade.ts` `Unmaterialized` `:579-591`; walk and
  constraint arms `:1627-1633`, `:1661-1670` via `unmaterialized()`
  `:1821-1832` over `recordingLookup`'s `declared` map `:1800-1815`; member
  arm `failedCascade` `:1484-1503`.
- Passed on by `install-flow.ts` `unwrapCascade` `:1092-1153` and
  `handleCascadeThrow` `:1813-1860`.
- Route 1: `install-flow.ts:1136-1150` sets no subject when
  `cascade.key === rootKey`; then `handleCaughtInstallFailure` `:1773-1800`,
  `handleInstallThrow` `:1697-1759`, `composeInstallFailureMessage`
  (`install.messaging.ts:177`). Nearest unit case: MISS-02 at
  `install-flow.test.ts:16945`.
- Route 2: `install-flow.ts:3631-3634` → `failedMoveOutcome` `:3696-3739`;
  `dependency-settle.ts` `runDependencySteps` `:167-206`, `runStep`
  `:140-155`; `dependency-bindings.ts:187-202` (`:199` keeps only rows with a
  cause); `dependency-plan.ts:181-200` `unmovable`; update side
  `materialize-latest.ts:116-132`, `update-cascade.ts:172`.
- Route 3: `install-flow.ts:865-888` `catalogLookup` (`:875-880` subject with
  no `unmaterialized`); `lookupCascadeDependencies` `:818-834` throws outside
  the try; plan walk catch `:3691-3693`; `install-cascade.ts`
  `resolveCascade` `:1595-1679`.
- Scenarios: `install-dependencies.feature` `:72`, `:126`, `:148`, `:517`,
  `:546`, `:1289`; single-row routes pinned at `:937`, `:1045`, `:1257`.

### MIM-05

- `reconcile/apply.ts:882-893` (failed arm of `applyDependencyInstalls`
  `:817-897`) ignores `result.rollbackPartials`. Reuse `installFailedOutcomes`
  `:576-637`, `dependencyRollbackOutcome` `:510-525`, `showsFailedDependency`
  `:528-539`, `shared/redact-absolute-paths.ts:105`, `:122`.
  `reconcile/notify.ts:1252-1261` already renders `rollbackPartials`.
  Tests: `apply.test.ts` MISS-01 block `:6066-6287`, MIM-03 cases `:2436`,
  `:2499`, `:2563`, `:2636`. Scenario model `apply.feature:187-211`.

### XPH-02 sites

1. `update-flow.ts:868-901` `cascadeFailureOutcome` (`:900`), direct path
   `directFailReasons` `:1111-1126`.
2. `fetch.ts:602-624` `narrowFetchFailure` (fallback `:623`);
   `update-flow.ts:936-971`; `shared/git-failure-classifiers.ts:51-58`.
3. `dependency-move.ts:112-116`, `:326-336`; `dependency-settle.ts:140-146`
   (header `:27-30`); `apply.ts:646-663`; `orchestrators/types.ts:334`.
4. `bridges/agents/stage.ts:293-329` `partitionPreviousEntries`, index write
   `:467-470`; caller `update-swap.ts:1246`.
5. `install-cascade.messaging.ts:525-539` `memberCause` (root arm
   `:529-531`); `install.messaging.ts:177-226` (`:187`). IMP-07 lock path:
   `import/execute.ts:1016-1020`, `import.feature:515`.
6. `bridges/agents/stage.ts:341-360` `assertAgentCommitTargets`;
   `shared/errors-bridges.ts:54-70` `AgentTargetOccupiedError`;
   `bridges/agents/target-check.ts:29-50`; unit pins
   `test/bridges/agents/stage.test.ts:1066`, `:1802`, `:1941`.
7. `install-cascade.ts:1240-1261` `recordMaterializedMember`,
   `CascadeMemberOutcome` `:432`; `package-install.ts:594-612`;
   `install-flow.ts:2911-2916`; model `dependency-move.ts:235-252`.
8. `marketplace/update.ts:594-605` (`retryable`), `refreshFailureMessage`
   `:642-656`; pinned `features/marketplace/update.feature:139-148`,
   `test/orchestrators/marketplace/update.test.ts:1578-1626`.
9. `package-install.ts:111-114`, `chooseLockfile` `:269-280`, `detectInstall`
   `:322-372` (lockfile `:334` before listing check `:349`); pinned
   `package-dependencies.feature:127-147`.

### XPH-01 sites

- 2.30: `apply.ts:2422-2460` `createScopeDependencyInstall`,
  `ScopeDependencyInstallResult` `types.ts:665-672`, dropped warnings at
  `apply.ts:859-863`; consumers `marketplace/add.ts:1602-1641`,
  `bootstrap.ts:72-96`, `marketplace/update.ts:794`.
- 5.27: `import/execute.ts:949-956` (`blockToMarketplaceMessage`
  `:918-965`); `shared/notification-json.ts:476-483`; pinned
  `import.feature:515`, `:919`. 5.28: `import/marketplaces.ts:52`.
- 2.19: `apply.ts:1447-1483` `installAfterMoves`, `read-pass.ts:180-205`.
- 7.16: `update-preflight.ts:529-560`; model scenario
  `git-source-update.feature:305-338`.
- 7.15: `edge/completions/provider.ts:174-195`, `:298`;
  `edge/register.ts:184-185`; unit `test/edge/completions/provider.test.ts:955`.
  Pi RPC has no completion command (`RpcStep` supports `get_commands` and
  `prompt` only, `test/e2e/_rpc.ts:34-36`).
- Re-add: `reconcile/plan.ts:295-388` `diffMarketplaces` (`:345-355`
  source-mismatch, `:313-321` claim alias, `collectMarketplaceClaim`
  `:153-185`); `reconcile/notify.ts:239-266`, `:1159-1170`; import model
  `import/execute.ts:1648-1683`, `:1359-1390`; `marketplace/add.ts:287-294`,
  `:971-1080`, `:1761`.
- Fallback: `import/execute.ts:1662`, `import/marketplaces.ts:121-143`.
- Local layer: `import/execute.ts:1882-1945` (`:1895` base only).
- Background pass: arming `marketplace/background-update.ts:94-112`
  (`ctx.mode === "tui"`), delay knob `:67`; wait cap
  `background-gate.ts:24-25` (`BACKGROUND_WAIT_CAP_MS = 30_000`);
  `index.ts:84-86`, `:227-247`; dedupe `notification-grammar.ts:1322-1326`;
  `background-pass.ts:286-320`; `notification-dispatch.ts:265-278`. RPC
  negative: `features/marketplace/background-update.feature`.
- Harness: `_rpc.ts` spawns `node <cli> --mode rpc --offline --no-session
  --extension ...` with an allowlist env (`:190-224`, `:387-400`); shared Pi
  via `startRpcPi` `:440-445`, `features/lib/pi-process.ts`. Pi picks
  interactive mode only when stdin and stdout are TTYs
  (`pi-coding-agent/dist/main.js:81-92`). No pty package installed; `tmux`
  and `python3` exist locally.
- Tree kill: `platform/package-manager.ts:13-19`, `:120-122`, `:157-184`;
  constants `package-install.ts:123-126`; unit
  `test/platform/package-manager.test.ts:632-841`; npm stand-in
  `features/lib/npm-registry.ts`.

### TST-02 / TST-03 sites

- `features/lib/git-clones.ts:84-100`; `installation.steps.ts` `fileRows`
  `:144-163` (`:151`), clones step `:291-309` (`:297`);
  `features/lib/run-tokens.ts` `expandTokens` `:104-115`;
  `rules/world-and-stand-ins.md:15` vs `rules/features.md:41`;
  `install-rollback.feature:38-58` (`When` at `:47`, `:55`); `list.feature`
  scenarios at `:7`, `74`, `136`, `196`, `256`, `316`, `377`, `438`, `503`,
  `562`; `browse.test.ts:449`, `:511` (stub at `:434`, `:500`).
- `install-flow.test.ts:509-555` `conflictingMarketplaceRecord` (used at
  `:1146`, `:1293`, `:15793`); `reinstall-flow.test.ts:913-980`; model
  `uninstall.test.ts:5756-5837`; precedent commit `afa96ed2`.

### Established Patterns

- Cascade warnings: D-PL1-25 per-plugin diagnostic
  (`orchestrators/plugin/staging-diagnostics.ts`, `shared/staging-warnings.ts`).
- Rollback detail: D-PL6-03..05/11..13.
- Failure rows: D-PL3-15 `{dependency failed}`; marketplace rows
  `marketplaceSubject: true` (D-PL5-12).

</code_context>

<specifics>
## Specific Ideas

- Feature count today: 701 scenarios in 55 files (counted by `Scenario`
  lines); `npm run check` runs 1083 scenario executions including outlines.

</specifics>

<deferred>
## Deferred Ideas

- LCCODE-01 b3 is stale: the failed arm of `InstallMissingDependencyOutcome`
  already declares `rollbackPartials` (`install-flow.ts:3025`). Phase 11 owns
  the disposition.
- A load-time `Note:` line in `list` / `info` for refused package installs
  (E1's `dependencies-refused`), if the user picks that over the install-time
  note.

</deferred>

## Uncertain choices (for user review)

1. **D-PL10-11 unknown network error token.** Chosen: `network error` with the
   raw cause for both `fetch` and `update`. Alternative: a cause line with no
   closed-set reason (upstream has no category, E5).
2. **D-PL10-12 dependency-move notices.** Chosen: amend D-PL1-16 so a move's
   staging warnings and MCP notices are shown. No upstream analog.
3. **D-PL10-17 invalid manifest after refresh.** Chosen: drop the retry hint and
   add none. Alternative: suggest `/claude:plugin marketplace remove <n>` as
   upstream's refresh does (E4).
4. **D-PL10-18 yarn/pnpm note timing.** Chosen: keep the note at install time
   with upstream's wording, after the listing check. Upstream shows nothing at
   install and a `Note:` line at load in `list`. Alternative: move it to a
   `list` / `info` note.
5. **D-PL10-23 re-add in `apply`/load.** Chosen: a re-add step previewed by
   `pending`/load and run by `apply`, keeping import's D-PL6-19 exceptions.
6. **D-PL10-25 stale local declaration.** Chosen: import rewrites the one local
   entry. Upstream has no precedent and would let the stale local entry win
   (E3, inferred). Alternative: record the divergence and leave the local
   layer alone.
7. **D-PL10-26 tui driver mechanism and real 30 s wait cap.** Chosen: python3
   pty bridge plus `@xterm/headless`, real cap value. Alternative: `tmux`, or a
   new wait-cap knob.
8. **D-PL10-27 tree-kill scenario at the real 60 s limit**, or unit-only if
   the stall cannot be made deterministic.
9. **D-PL10-29 Device Flow negative stays unit-only.**
10. **D-PL10-32 network guard declined.**
