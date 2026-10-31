---
phase: quick-261027-ckr
plan: 01
status: complete
subsystem: marketplace
tags: [marketplace, hosted, resolver, plugin, parity, MKT-02, D-PL5-32, D-PL5-33]
requires: [D-PL5-04, D-PL5-05, D-15-01, XSURF-01, SRC-01, APL-D1, WR-02]
provides:
  - "a relative entry of a hosted marketplace is refused on install, list, info, update, reinstall, and the convergence planner"
  - "an https URL whose path ends in .json in any letter case adds as a hosted catalog"
affects:
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
tech-stack:
  added: []
  patterns:
    - "one optional ResolveContext member (the listing marketplace's recorded source) and one resolver arm; each surface adds one context member"
key-files:
  created:
    - features/marketplace/hosted-relative-entry.feature
  modified:
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - features/lib/published-marketplace.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/marketplace/hosted-source.feature
    - test/domain/resolver-types.test.ts
    - test/domain/plugin-resolver.test.ts
    - test/domain/source.test.ts
    - test/architecture/cross-surface-reason-parity.test.ts
    - test/persistence/state-io.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/list-flow.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/update-preflight.test.ts
    - test/orchestrators/reconcile/convergence.test.ts
    - .planning/phases/05-marketplace-command-parity/05-CONTEXT.md
decisions:
  - "D-PL5-32: a hosted marketplace's path entries are refused in the resolver, keyed on the record's parsed source; install reads (unavailable) {unsupported source}, list and info unavailable, update skips {no longer installable}, convergence plans no move"
  - "D-PL5-33: parseHostedManifestForm matches the .json suffix in any letter case; the rest of D-PL5-04 stands and stored url records keep their kind"
metrics:
  duration: "about 60 min"
  completed: 2026-10-27
actuals:
  tokens: 15800
  tasks: 3
  commits: 4
plan_head_before: 7ec095d3
plan_head_after: 475f2af6
---

# Quick 261027-ckr: Refuse hosted relative entries and match .json in any case

A hosted marketplace's relative plugin entries are now refused everywhere the resolver reads them, as Claude Code 2.1.310 refuses them, and a hosted catalog URL ending in `.JSON` or `.Json` is downloaded as a catalog instead of cloned as git.

## What changed

Commits (all through the hooks, by pathspec; `npm run check:commit` passed on each code commit):

| SHA | Title |
| --- | --- |
| `30617e3a` | fix(plugin): refuse a relative entry of a hosted marketplace on install |
| `02383da4` | fix(plugin): refuse hosted relative entries in list, info, and update |
| `5da2c316` | fix(marketplace): match a hosted catalog's .json suffix in any case |
| `475f2af6` | docs: record the hosted relative-entry and .json case decisions |

By surface:

- **Resolver (`domain/plugin-resolver.ts`, `domain/resolver-types.ts`).** `ResolveContext` gains the optional `marketplaceSource`. The path arm of `deriveSourcePluginRoot` refuses first when that source parses `hosted`, before the pinned-path callback and the NFR-10 escape check. The note is Claude Code's reason verbatim, kept in the module-private `HOSTED_PATH_ENTRY_NOTE` with the dash written as the `—` escape.
- **Install (`install-outcome.ts`; also enable, dependency members, `import`, `apply`).** `marketplaceSource: targetMp.source`. Result: `(unavailable) {unsupported source}`, nothing recorded or declared.
- **List (`list-flow.ts`, with `Pick` widened in `list-candidate-row.ts` and `list-candidate-version.ts`).** Available rows show `unavailable` / `unsupported source`.
- **Info (`info.ts`, both path arms).** Not installed: `⊘ ... (unavailable) {unsupported source}`. Installed: `● ... (installed) {unsupported source}`.
- **Update and reinstall (`update-preflight.ts`; also `apply`'s converge execution).** Skipped with `{no longer installable}`; the installed version stays.
- **Convergence planner (`reconcile/convergence.ts`).** No move, so `pending`, the load preview, and `apply` plan nothing.
- **`.json` suffix (`domain/source.ts`).** `parseHostedManifestForm` lower-cases the URL path before the suffix test; its doc comment now says the match ignores case (D-PL5-33).
- **Feature support.** `HostedPublication` carries its served `file`; `serveHostedManifest` serves under it. The hosted arm of `publishMarketplaceIn` and the new `publishHostedMarketplace` share the private `publishHosted`. New step: `the marketplace {string} is published as a hosted source served as {string}`.

## RED evidence (captured before each source change)

Task 1 (logs: `t1-red-cucumber.log`, `t1-red-unit.log`, `t1-red-tsc.log` in the session scratchpad):

- Outline `Installing a plugin that a hosted catalog lists by a relative path ...`: all 3 rows failed. `./plugins/demo` listed `source missing`; `./` and `./.claude-plugin` installed (severity `info`, needs reload `true`, no summary).
- Resolver: the 5 refused rows and the pinned-path case failed (6 of 6). The 4 unchanged-source guards, the hosted url entry, and the hosted npm entry passed before and after, as intended.
- Install-outcome `D-PL5-32: installing a relative entry of a hosted marketplace ...`: failed (the ledger installed).
- Parity row: **already passed before the change**; the read-only and install narrowers both map the new note to `unsupported source` through their catch-all. Kept as a pin.
- `npx tsc --noEmit` failed: `resolver-types.test.ts(144,3): 'marketplaceSource' does not exist in type 'ResolveContext'` (and the five resolver-test literals).

Task 2 (logs: `t2-red-cuc.log`, `t2-red-unit.log`):

- List scenario: `demo` read `source missing`, `root` read `available`.
- Info scenario: status `available`.
- Update scenario: the update ran (needs reload `true`), moving ghp onto the stored catalog tree.
- Pending scenario: kind `cascade` with `needs apply true` and one pending move, not `reconcile-pending-empty`.
- Unit: all 5 new cases failed (list-flow, info not installed, info installed, update-preflight, convergence).

Task 3 (logs: `t3-red-unit.log`, `t3-red-cuc.log`):

- Scenario `Adding a hosted marketplace whose URL ends in an uppercase .JSON downloads its catalog`: severity `error`, `A marketplace operation has failed.` (the URL went to the git clone arm).
- Source rows: the `.JSON` hosted row and the mixed-case `.Json` row failed (both parsed `url`).
- Guard rows passed before and after, as intended: `.JSONL` stays `url`; a query naming `m.JSON` stays `url`; state-io "a stored URL source whose path ends in an uppercase .JSON as a URL source" and "a legacy string URL whose path ends in an uppercase .JSON as a URL source".

## Verification

- Owner tests: Task 1 280/280, Task 2 500/500, Task 3 256/256 (`node --test` over each task's owner files).
- Direct coverage: `npm run test:coverage:direct` exit 0 for `plugin-resolver.ts`, `install-outcome.ts`, the six Task 2 sources, and `source.ts`.
- Cucumber: Task 1 neighbors (hosted-relative-entry, hosted-source, hosted-source-update, install, install-dependencies) 76/76; Task 2 fixture check (list, info, update, pending, reinstall, apply, hosted-source, hosted-source-update) 150/150; Task 3 (hosted-source, hosted-relative-entry, hosted-source-update, url-source, unsupported-source, add) 90/90. `npm run check:features` exit 0 after each task.
- Count gates: `marketplaceSource` resolver-types 1, install-outcome 2, info 2, update-preflight 2, list-flow 1, list-candidate-row 1, list-candidate-version 1, convergence 1; `url-catalog marketplace` and `tree — or` in plugin-resolver 1 each; hosted-relative-entry `Scenario` lines 5; hosted-source `Scenario` lines 12; `D-PL5-33` in source.ts and source.test.ts; `D-PL5-32` and `D-PL5-33` in 05-CONTEXT.md 3 each.
- **Full gate:** `npm run check > "$LOG" 2>&1; status=$?` (unpiped, run once in the background) exited **0** on HEAD `475f2af676bb56d1a8240c51621d17da4fad4be9`, Node `v26.12.1`. Scope: check:static (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), test:unpaired, test:integration, test:cucumber (969 scenarios, 9571 steps, all passed), and test:coverage:direct:all (merged `coverage/direct.lcov`, 293 records).

## Decisions as committed (05-CONTEXT.md, after D-PL5-31)

- **D-PL5-32 (hosted relative entries, user decision 5.12, 2026-10-27; closes review IN-06):** rule (every path entry of a record whose source parses `hosted` is refused; git, npm, unknown entries and non-hosted marketplaces unchanged); seam (`ResolveContext.marketplaceSource`, first check of the path arm, before the pinned callback and the escape check; the record, not the ownership marker, is the signal); wired surfaces; outcome per surface; wording (Claude Code's `entry-refused` reason verbatim, printed by no row per D-15-01); evidence R-1 to R-3; divergences (a) to (d).
- **D-PL5-33 (hosted .json suffix in any case, user decision 5.23, 2026-10-27; amends D-PL5-04):** rule; what stays of D-PL5-04; stored records (WR-02); evidence R-4.
- Appends: D-PL5-04 `Its .json match ignores case (D-PL5-33).`; the hosted relative-entry note `Reversed by D-PL5-32.`; Uncertain choice 1 `The suffix match ignores case (D-PL5-33, user decision 5.23).`; item 12 `Fixed by D-PL5-32 (user decision 5.12).`

## Upstream evidence (Claude Code 2.1.310 binary, docs retrieved 2026-10-27)

- **R-1:** install resolves each string entry through a location check that returns nothing for a `url` (hosted) marketplace whose install location is a file, so every relative entry, `./` included, throws `Cannot install <id>: <entry-refused reason>`.
- **R-2:** the loader, the enabled-plugin cache sync, and `plugin update` map the same refusal to `marketplace_entry_path_refused` (`Plugin source path refused: ...`).
- **R-3:** `plugins/host-marketplace.md`, `plugins/troubleshooting.md`, and `errors.md` on code.claude.com/docs describe the install failure and the load failure.
- **R-4:** the URL classifier has no `.json` test; any https URL that is not git-shaped is a catalog, so letter case never decides.

## Choices for user review

- **(a)** The install row reads `(unavailable) {unsupported source}`, not Claude Code's `Cannot install <id>: <reason>`. License: D-15-01 and XSURF-01. Alternative: a failed row with the sentence as its cause; it would split install from list and info.
- **(b)** `plugin update` skips with `{no longer installable}` (severity warning), where Claude Code fails with `marketplace_entry_path_refused`. License: SRC-01.
- **(c)** An installed plugin whose hosted entry later names a relative path keeps loading with no warning; Claude Code fails to load it. License: APL-D1; the missing warning is a choice.
- **(d)** Not gated: tab completion, the pending force-install preview, AMIG, the installed row's upgradable hint in `plugin list`, `plugin fetch`. A constrained dependency on a relative hosted entry fails earlier as `{no matching tag}`.
- **Pinned from the GREEN run, worth a look:** `plugin info` on the unavailable hosted entry reports `plugin components resolved: true`, because the unavailable path arm still enumerates components leniently under the derived root (the stored catalog directory, which holds none). The RED run showed the same value, so this is existing info behavior, not new.

## For the parent

- **Backlog:** HOSTED-REL-01 need not be added to BACKLOG.md; D-PL5-32 does it, and review IN-06 is closed.
- **Proposed backlog entries:** a load-time warning for an installed plugin whose hosted entry names a relative path (divergence c); the not-gated surfaces of divergence (d).
- **Proposed CHANGELOG sub-bullets** under the marketplace-parity entry:
  - "`plugin install` refuses a plugin that a hosted marketplace lists by a relative path, as Claude Code does, and `list`, `info`, and `update` report it as unavailable."
  - "A hosted marketplace URL whose path ends in `.json` in any letter case is downloaded as a catalog."

## Deviations from Plan

- **Install-outcome unit case uses the seed's default entry `./plugins/empty`, not `./`.** The seed has no entry-source option except `gitSource`, whose doc says it relocates the plugin tree; the default entry has a real plugin directory, so the case installed before the change, which is a stronger RED. The `./` and `./.claude-plugin` entries are covered by the resolver table and the install Outline.
- **List scenario table has no `scope` column.** A row set whose scope is empty everywhere omits the column, so the table names `version` after `reasons`, as the plan's "pin from GREEN" allowed.
- **Update scenario fields pinned from GREEN:** severity `warning` with `A plugin operation needs attention.` (the plan's draft said info). The installed version stays 1.0.0, and the git host receives no request.
- No fixture in an existing feature changed; no test-side fixes were needed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

Created files exist, and all 4 commits are ancestors of HEAD (`git rev-list --count 7ec095d3..HEAD` = 4).
