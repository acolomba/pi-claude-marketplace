# Deferred Items

Out-of-scope findings surfaced while executing phase 05 plans. Each entry names
the owner file so a later bounded plan can pick it up; none is a gate failure.

- Comments in non-owned persistence files still name `CONFIG_VALIDATOR.Check` /
  `STATE_VALIDATOR.Check`
  status: open
  **What:** plan 05-12 changed `loadConfig`, `saveConfig`, `loadState` and
  `saveState` to take validity and the diagnostic from the compiled validator's
  first `Errors` entry, so neither module calls `Check` any more. Six comments
  outside the plan's declared owner set still name the `Check` call by method:
  `persistence/config-write-back.ts:61`, `persistence/migrate-config.ts:12`, and
  `persistence/migrate.ts` lines 122, 159, 175 and 201.
  **Why it is deferred:** the behavioural claim each comment makes is still true
  -- `saveConfig` and `saveState` still refuse an invalid in-memory value before
  any byte reaches disk, through the same compiled schema. Only the method name
  drifted. Those three files belong to other owners in the phase's disjoint-file
  wave structure, and 05-CONTEXT's execution rules forbid editing an owner a
  plan does not declare.
  **Suggested fix:** rename the call in each comment, or drop the method name and
  keep the behavioural sentence, in whichever later plan next owns those files.

- The archived force-reinstall spike prototype imports the now-private
  `STATE_VALIDATOR`
  status: open
  **What:**
  `.planning/spikes/003-force-reinstall-on-version-mismatch/prototype.ts:17`
  imports `STATE_VALIDATOR` from `persistence/state-io.ts`. Plan 05-12 made that
  binding module-private, so the prototype no longer resolves.
  **Why it is deferred:** the file is an archived planning artifact. It is outside
  `tsconfig.json`'s `include`, inside ESLint's ignored paths, absent from fallow's
  entry graph, and run by no npm script, so nothing in the gate chain reads it.
  D-09 preserves historical evidence, and rewriting a recorded experiment would
  falsify the record it exists to hold.
  **Suggested fix:** none required. If the spike is ever re-run, copy the schema
  into the prototype rather than re-exporting the validator.

- The new plugin operations owner is not named by the network-free
  architecture gate
  status: open
  **What:** `tests/architecture/no-orchestrator-network.test.ts` gates a NAMED
  list of orchestrator modules (`NETWORK_FREE_TARGETS` in
  `tests/architecture/gate-targets.ts`) against `platform/git.ts` / `gitOps` /
  `DEFAULT_GIT_OPS` / `refreshGitHubClone`. The new
  `orchestrators/plugin/operations.ts` composes install, which is on that list,
  but the new module itself is not.
  **Why it is deferred:** `gate-targets.ts` is the parent-owned shared census
  pin and every task in this plan forbids editing it. The module is clean today
  -- it imports only `transaction/`, `install-flow.ts`, and two type-only
  modules -- so nothing is currently unguarded; only the future regression is.
  **Suggested fix:** add
  `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts` to
  `NETWORK_FREE_TARGETS` during a wave reconciliation, or in whichever later
  plan next owns the composition module (05-16 through 05-18 all extend it).

- Comments in non-owned files still name the four closed-set tuples by their
  retired identifiers
  status: open
  **What:** `REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES` and
  `MARKETPLACE_STATUSES` are no longer declarations of any kind -- the four
  vocabularies are now the literal unions `Reason`, `StatusToken`,
  `PluginStatus` and `MarketplaceStatus`. Fourteen files outside plan 05-23's
  declared owner set still name the retired identifiers in comments or a test
  title: `orchestrators/marketplace/autoupdate.ts:38`,
  `orchestrators/plugin/fetch.messaging.ts:26,27,81`,
  `orchestrators/plugin/fetch.ts:327,427,529`,
  `orchestrators/plugin/info.ts:1541`,
  `orchestrators/plugin/install.messaging.ts:355`,
  `orchestrators/plugin/reinstall.messaging.ts:435`,
  `orchestrators/plugin/shared.ts:217,219,1285`,
  `orchestrators/plugin/uninstall.ts:203`,
  `orchestrators/reconcile/apply-outcomes.ts:176`,
  `orchestrators/reconcile/notify.ts:124,182,474,475,482,487`,
  `orchestrators/reconcile/reconcile.messaging.ts:151`,
  `shared/concerns/soft-dep.ts:15,33`,
  `shared/git-failure-classifiers.ts:54`,
  `shared/probe-classifiers.ts:69,88`,
  `tests/architecture/catalog-uat/fixtures/plugin-install.ts:60`,
  `tests/architecture/scope-fences-63.test.ts:18,144,215,220,253`,
  `tests/orchestrators/marketplace/update.test.ts:711` and
  `tests/orchestrators/plugin/update-flow.test.ts:7153`.
  **Why it is deferred:** every claim each comment makes is still true -- the
  vocabularies hold the same members and the same order, and "a new REASONS
  member" still names the same closed set the reader has to amend. Only the
  identifier drifted. The `scope-fences-63.test.ts` clause is a live gate and is
  unaffected: it asserts the owner's source contains `"unsupported hooks"`,
  which it does. 05-CONTEXT's execution rules forbid editing an owner a plan
  does not declare.
  **Suggested fix:** rename the identifier in each comment to the union it
  became, in whichever later plan next owns those files.

- Two comments name `ICON_PARTIALLY_AVAILABLE` from outside its module
  status: open
  **What:** `orchestrators/plugin/fetch.messaging.ts:67` and
  `orchestrators/plugin/list.messaging.ts:118` describe the row they compose by
  naming the glyph constant, which plan 05-23 made module-private to
  `shared/notification-grammar.ts`.
  **Why it is deferred:** both comments also spell the glyph itself (`⊖`) and
  the `(partially-available)` token, so the sentence still identifies the row
  correctly without the constant. Neither file is in 05-23's owner set.
  **Suggested fix:** drop the constant name and keep the glyph and token, in
  whichever later plan next owns those files.
