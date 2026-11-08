# Phase 15: Marketplace State Lock - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the user asked for the recommended answer on every question, so each decision below is the recommendation, auto-accepted.

<domain>
## Phase Boundary

Phase 15 adds the cucumber scenarios that pin how the five marketplace verbs that change a scope (`marketplace add`, `remove`, `update`, `autoupdate`, and `noautoupdate`) treat the scope's state lock. A lock that another live process holds makes each verb fail as `lock held` and change nothing (MLOCK-01 for `autoupdate` and `noautoupdate`; `add`, `remove`, and `update` are already pinned). A lock that a process left when it died blocks no verb: each completes as it would with no lock (MLOCK-02). The two cases differ only in the lock's staleness.

All scenarios go into `features/marketplace/state-lock.feature`, which this phase owns. The phase may fix a bug that a scenario exposes in `orchestrators/marketplace/autoupdate.ts`, `edge/handlers/marketplace/autoupdate.ts`, or `transaction/with-state-guard.ts`, with their unit pairs. The discuss-step probes found no such bug, so no product change is planned.

</domain>

<decisions>
## Implementation Decisions

### Lock contract and upstream parity (D-BG-1501 to D-BG-1503)

- **D-BG-1501: the product keeps D-06; the feature names it.** Claude Code 2.1.319 also locks marketplace writes with proper-lockfile: it locks `known_marketplaces.json` through `<file>.lock` with `realpath: false`, 5 retries at 100 to 1000 ms, and proper-lockfile's default 10-second stale window. When it cannot take the lock, it logs `Failed to acquire known_marketplaces.json lock, writing without it` and writes anyway (grepped from `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude` on 2026-11-08, high confidence for the options, medium for the full call graph). This project's D-06 instead takes the lock with `retries: 0` and fails the verb as `lock held`, changing nothing. D-06 is a recorded project decision, so it licenses the divergence. The feature description names D-06, and the MLOCK-01 scenarios pin the D-06 behavior.
- **D-BG-1502: the stale rule matches upstream's default.** The product locks with `stale: 10_000, update: 2_000` (`transaction/with-state-guard.ts`). proper-lockfile reads a lock directory whose mtime is older than `stale` as free, removes it, and takes the lock on its one try, with no process check. Claude Code's bundled proper-lockfile has the same rule with the same 10-second default. D-BG-11 settled the fixture: a lock directory with a 60-second-old mtime. No change to `with-state-guard.ts`.
- **D-BG-1503: a takeover of a stale lock reports nothing.** A verb that takes over a stale lock reports exactly what it reports with no lock: no extra notice, reason, or warning. proper-lockfile and Claude Code take the lock over silently too. Each stale scenario pins the whole no-lock result, so an extra row or notice fails it.

### Which verbs and forms the scenarios cover (D-BG-1504 to D-BG-1506)

- **D-BG-1504: the verbs are the five that change a scope.** `marketplace add`, `remove`, `update`, `autoupdate`, and `noautoupdate` each take the scope's state lock (`withLockedStateTransaction` in `orchestrators/marketplace/{add,remove,update,autoupdate}.ts`). `marketplace list` and `info` take no lock, so they are out of scope.
- **D-BG-1505: MLOCK-01 covers the named flip with `--scope`, for both verbs and both scopes.** One Scenario Outline has four rows (verb `autoupdate` or `noautoupdate`, scope `project` or `user`). Each row first sets the marketplace's base-config value to the opposite of what the verb asks for, so that without the lock the verb would write. The row then checks the whole failed result: the `(failed)` marketplace header and its failed child with reason `lock held` and the retry-hint cause chain. It also checks the base config's `autoupdate` value, and that the config and installation record bytes of the scope are unchanged.
- **D-BG-1506: the unnamed flip and the cross-scope flip get no scenario.** Without a name, a flip under a held lock reports the `(unknown)` aggregate subject. Without `--scope`, it writes the project scope and then fails on a held user lock (D-06 partial outcome). Unit tests in `test/orchestrators/marketplace/autoupdate.test.ts` pin both outputs on purpose. A scenario would set that wording in place for good, and the requirement names neither form. They go to Deferred Ideas.

### Scenario shape: twins (D-BG-1507 to D-BG-1509)

- **D-BG-1507: every stale-lock scenario is the twin of a live-holder scenario.** Each stale scenario has the same `Given` steps as its live twin. Only the lock step differs: `a process that died left the state lock of the <scope> scope` in place of `another process holds the state lock of the <scope> scope`. The live twin fails as `lock held`. The stale twin completes with the whole result that the verb gives with no lock, so staleness is the only difference (MLOCK-02, success criterion 3). The twins are:
  - `marketplace remove` in the project scope and in the user scope, with `demo` installed, as the existing live scenarios set it up. The result is `removed`, and the cascade uninstalls `demo`.
  - `marketplace update` in the project scope and in the user scope, with `demo` installed. The result is `skipped {up-to-date}`.
  - `marketplace add`: one Outline over the same Examples blocks as the live add Outline (the scopes `project` and `user`; the local kinds `dir` and `file`, plus `@url` and `@github`). The result is `added`. Each row also checks the scope's config and record.
  - `marketplace autoupdate` and `noautoupdate`: one Outline over the same four rows as the MLOCK-01 Outline. The result is `autoupdate enabled` or `autoupdate disabled`, and the base config holds the new value.
- **D-BG-1508: the seed is rewritten as the remove twin.** The Phase 1 seed "Removing a marketplace while a process that died left the state lock of its scope removes it" installs no plugin (P1-DC-29). This phase rewrites it as the exact project-scope twin of the live remove scenario: `demo` installed, and the whole cascade result. The seed's lock step stays in use.
- **D-BG-1509: no `Rule:` blocks.** The live scenarios come first, as they do today, then the stale twins in the same verb order. Titles say "while another process holds" and "while a process that died left", so a reader pairs them without a `Rule:`.

### Footprint and proof (D-BG-1510 to D-BG-1512)

- **D-BG-1510: no verb step module.** Every step the scenarios need already exists in the shared modules: `scope-state.steps.ts` (both lock steps), `config.steps.ts` (the layer config `Given`, the declarations `Then` steps, and the remembered and unchanged bytes steps), `command.steps.ts`, `marketplace/publishing.steps.ts`, `marketplace/checkout.steps.ts`, and the installation record and staging steps. The phase creates `features/step_definitions/marketplace/state-lock.steps.ts` only if a needed step turns out to be missing. If it does, the step's text names its verb (D-08).
- **D-BG-1511: no product change is expected.** The discuss-step probes ran the current product under a live and a stale lock for all five verbs. Each verb behaves as MLOCK-01 and MLOCK-02 require. If a scenario still exposes a bug, the fix stays in this phase's three product files, and a fix anywhere else becomes a parent line.
- **D-BG-1512: red proofs by a temporary product mutation, reverted before the commit.** MLOCK-01: run the flip without the scope lock in `orchestrators/marketplace/autoupdate.ts`. Its scenarios then fail, because the flip writes. MLOCK-02: raise the `stale` window in `transaction/with-state-guard.ts` (for example to one hour). The stale twins then fail as `lock held`. Each plan SUMMARY records the command, the failing scenarios, and the revert.

### Claude's Discretion

- The exact scenario titles and the `Examples` column names, under `.agents/skills/cucumber/rules/features.md`.
- Whether the MLOCK-01 Outline also uses the remembered and unchanged bytes steps, beside the explicit `autoupdate` declarations (recommended: both).
- How many plans and tasks. All the work edits one feature file, so the recommendation is one plan in one wave.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/lib/state-lock-holder.ts` (frozen): `holdStateLock` runs a child process that holds the lock with the product's options. `leaveStaleStateLock` writes an empty lock directory with a 60-second-old mtime. `isStateLockHeld` checks the lock.
- `features/step_definitions/scope-state.steps.ts` (frozen): `another process holds the state lock of the {word} scope` and `a process that died left the state lock of the {word} scope`.
- `features/step_definitions/config.steps.ts` (frozen): `a config in scope {word} and layer {word}, with these marketplaces:` (a `| name | source | autoupdate |` table), `the {string} file of the {word} scope declares these marketplaces:`, `the config and installation record bytes of the {word} scope are remembered`, and `... are unchanged` (it compares `claude-plugins.json` and `state.json`).
- `features/step_definitions/marketplace/checkout.steps.ts`: `the {word} scope holds no marketplace record`, `the {word} scope holds no marketplace checkout`.

### Established Patterns

- The live-holder scenarios in `features/marketplace/state-lock.feature` check the whole failed result: the fields `cascade`, `error`, needs reload `false`, the summary `Some operations have failed.`, and one failed row with the columns `marketplace name | marketplace scope | marketplace status | id | name | status | reasons | scope | cause chain | cause truncated | leaks | rollback partial`. The cause chain names the scope's lock file through `{project dir}/.pi/...` or `{agent dir}/...`.
- Probe results (current product, 2026-11-08): a named flip under a held lock reports this failed row. A stale `add` reports `added`, info, no reload. A stale `update` with `demo` installed reports `skipped {up-to-date}`, info, no reload. A stale `remove` with `demo` installed reports `removed`, with `demo@fixtures` `uninstalled`, info, needs reload `true`. A stale named flip reports `autoupdate enabled`.
- `orchestrators/marketplace/autoupdate.ts` runs each scope's flip in `withLockedStateTransaction` and maps `StateLockHeldError` to `lock held` (`autoupdateFailedReason`).

### Integration Points

- `transaction/with-state-guard.ts` (`acquireStateLock`: `retries: 0`, `stale: 10_000`, `update: 2_000`, `realpath: false`, `onCompromised` recorded). Only Phase 15 may edit it.
- `npm run check:features` checks the feature-file rules (no `And`, lower-case steps, aligned tables, Outline rules, source-kind blocks).

</code_context>

<specifics>
## Specific Ideas

- The feature description already says what the feature protects. Extend it to name D-06, the divergence from Claude Code's lock-free fallback write, and to say that staleness is the only difference between the twins.
- A stale twin has no tag. None of these scenarios has an MCP surface, so each runs once, under the `adapter` profile (D-BG-04).

</specifics>

<deferred>
## Deferred Ideas

- An unnamed `marketplace autoupdate` or `noautoupdate` under a held lock reports the `(unknown)` aggregate subject (pinned by unit tests). It could name the recorded marketplaces, as an unnamed `marketplace update` does. That is a product wording change, so it is a candidate BACKLOG item for the parent.
- A flip without `--scope` that writes the project scope and then fails on a held user lock (the D-06 partial outcome) has no scenario.
- A lock left by a process that died less than 10 seconds ago still reads as held. A scenario for it would have to wait out the stale window.

</deferred>
