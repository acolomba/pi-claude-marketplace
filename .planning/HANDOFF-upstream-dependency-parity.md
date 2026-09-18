# Handoff — upstream dependency parity (post-v1.20)

Written 2026-09-18 after the v1.20 review pass, when the context was cleared.
Self-contained: nothing here depends on a chat transcript.

## Where you are

| | |
|---|---|
| Worktree | `/home/acolomba/src/pi-claude-marketplace-manifest` |
| Branch | `features/manifest` (PR #198, open, base `main`) |
| PR head | `b11eda92` — CI green, SonarCloud PR gate OK (100% new coverage, 0 issues) |
| vs `origin/main` | 0 behind |
| Working tree | clean apart from per-machine codegraph wiring (`.mcp.json`, `.codex/config.toml`, `.claude/settings.json` hook, `.claude/CLAUDE.md`, `AGENTS.md`) and local `.planning/config.json` tweaks — never stage those |
| Milestone | v1.20 transitive-dependencies: audit passed, shipped as PR #198; `/gsd-complete-milestone` runs after the merge |

Nothing in this handoff is started. It is the input for planning the next
milestone.

## What this is

v1.20 implemented plugin `dependencies` from the Claude Code binary (2.1.251
at research time). The upstream docs now describe the feature end to end:

- https://code.claude.com/docs/en/plugin-dependencies ("Constrain plugin
  dependency versions") — declaration shapes, tag resolution, constraint
  intersection, enable/disable, `prune`, error codes
- https://code.claude.com/docs/en/plugins-reference — the `dependencies`
  row in the `plugin.json` schema and the "Default enablement" paragraph

A doc-vs-shipped comparison (verified against the installed binary
`~/.local/share/claude/versions/2.1.267` where the docs were silent) found the
divergences below. The operator's rule for this work: **align with upstream
unless Pi or this project's model gives a concrete reason not to; changing the
project's model is allowed.** The operator overrode two recommendations (#7,
#8) toward alignment and asked for #11 to be documented, not changed.

## Decisions

| # | Area | Upstream | Current | Decision |
|---|---|---|---|---|
| 1 | Cross-marketplace deps | Refused unless the root marketplace's `marketplace.json` lists the target in `allowCrossMarketplaceDependenciesOn` (`cross-marketplace` error). A manually installed dependency still satisfies. | Any added marketplace is allowed; fails only when the marketplace is not added (D-03-08). | **Align.** Parse the field; refuse with a closed-set reason naming the field; keep "already installed satisfies". |
| 2 | Path-source deps with a version constraint | For a relative-path plugin, tags are resolved on the *marketplace repository* (`{name}--v{version}`). No matching tag → install the marketplace's current copy and check the constraint at load. | Any non-wildcard constraint on a path source fails `{no matching version}` (`docs/dependency-resolution.md` §path source). | **Align.** Highest value: path sources are the common case, so constraints are unusable today. The marketplace clone is local, so tag listing stays offline (NFR-5). |
| 3 | `update` / `autoupdate` and constraints | A constrained dependency updates to the highest tag satisfying every installed dependent's range; if none, the update is skipped and reported, naming the constraining plugin. | `update-*.ts` and `marketplace/autoupdate.ts` never read constraints; an update can move a dependency out of range. | **Align.** |
| 4 | Reload installs missing declared deps | `/reload-plugins`, `marketplace add`, and autoupdate install any declared dependency not yet installed. | Reload keeps recorded dependencies (D-04-05) but never fetches a missing one. | **Align.** A desired plugin implies its dependencies; reuse the install cascade with provenance `dependency`. |
| 5 | Enable cascade / disable refusal | Enabling enables the dependencies at the same scope (transitively) and lists them. Disabling is refused while an enabled dependent needs it; the error names the dependents and gives a chained command. | `enable`/`disable` know nothing about plugin dependencies (`enable-disable.ts`'s "dependencies" are soft-dep companions). | **Align.** The dependency index (`orchestrators/plugin/dependency-index.ts`) already exists. |
| 6 | Enabling a disabled dependency on install/enable | Writes `true` for a dependency when a dependent installs or enables, flipping a disabled one on. | Leaves it disabled and warns `{already installed, dependency disabled}` (RESV-05; `docs/plugin-enablement.md` records this as a policy call). | **Align via the record, not the config.** Enable the dependency's record and report it on the row (a token such as `{dependency enabled}`). Keep D-04-02: the config never names dependencies. |
| 7 | Uninstall of a still-needed dependency | Allowed. The dependent is disabled at the next load with `dependency-unsatisfied: Install X or uninstall Y`. | Refused, names the dependents (PRUNE-05 / D-05-14..16); reload applies the same refusal. | **Align (operator decision).** Uninstall proceeds; the dependent becomes unsatisfied. The config may then describe a state that cannot be reached, and that is acceptable — reconcile reports it (#8), it does not oscillate. Retire PRUNE-05's refusal and the reload refusal in `docs/dependency-resolution.md` §138. |
| 8 | Load-time dependency check | A dependent is disabled at load when a dependency is missing, disabled, or out of range (`dependency-unsatisfied`, `dependency-version-unsatisfied`), with a remedy. | None. | **Align (operator decision).** Reconcile checks every installed plugin's declarations against the records; an unsatisfied dependent is disabled and reported with the upstream remedy shape. Design point to settle in planning: the disabled state is a *consequence* the config does not express, so reconcile must not re-enable it on the next pass while the dependency is still unsatisfied — only a satisfied dependency (installed / enabled / in range) lifts it. |
| 9 | Standalone `prune` | `claude plugin prune` with `--scope`, `--dry-run`, a confirmation prompt, `-y`. | Only `uninstall --prune`, no prompt. | **Align on `prune` and `--dry-run`; keep no prompt and no `-y`.** Pi reason: a slash command has no TTY confirm flow (REQUIREMENTS out-of-scope table); `--dry-run` covers the safety need. |
| 10 | Unresolvable dependency (marketplace not added, etc.) | Warn-and-degrade: the plugin installs, the dependent is disabled. | The whole cascade fails, nothing half-materialized (D-03-07). | **Keep.** NFR-1 / NFR-3. Already documented as a divergence in `docs/dependency-resolution.md`. |
| 11 | `sha` on a dependency element | Undocumented; the binary accepts it. | Refused with `{invalid manifest}` (D-03-36). | **Keep; document as a divergence** in `docs/dependency-resolution.md` (it currently explains the refusal but does not say upstream accepts the field). |
| 12 | String forms `name@mp`, `name@mp@^range` | Docs show bare string and object only. | Accepted (superset, from the binary). | **Keep.** |
| 13 | `claude plugin tag`, `--plugin-dir`, `command`/`npm`/`archive` sources | Author tooling / source kinds this extension does not support. | N/A | **Skip.** |

Already aligned, no work: `plugin.json` wins over the marketplace mirror;
already-installed dependencies are not reinstalled; `installed-unsatisfied`
fails the install; range intersection and `range-conflict`; `--keep-data` and
`--prune` on `uninstall`; pre-release exclusion; orphans survive a reload.

## Suggested phase grouping

Order matters because #7 depends on #8 (an allowed uninstall must be reported),
#6 and #5 share the enablement write, and #4 reuses the cascade #2 changes.

1. **Marketplace-repo tag resolution for path sources** (#2). Owner:
   `orchestrators/plugin/dependency-tag-probe.ts` (today probes the
   dependency's own source repo), `install-cascade.ts` (`probeMemberPin`),
   `docs/dependency-resolution.md` §"What a version constraint can say" and
   §path source. Tag listing on the local marketplace clone via
   `platform/git.ts` (isomorphic-git); the "no matching tag → current copy,
   check at load" fallback needs #8's load-time check to be meaningful.
2. **Load-time dependency check + allowed uninstall** (#8, #7). Owners:
   `orchestrators/reconcile/plan.ts` / `apply.ts` (new outcome kinds and
   rows; closed-set tokens in `shared/notification-types.ts` +
   `notify-reasons.ts` + `docs/output-catalog.md` + `tests/architecture/catalog-uat`),
   `orchestrators/plugin/uninstall.ts` (`assertNoDependents`, D-05-14..16),
   `dependency-index.ts` (reuse). Decide the "disabled as a consequence"
   persistence (a record flag reconcile respects) before planning the rows.
3. **Enablement parity** (#5, #6). Owners: `orchestrators/plugin/enable-disable.ts`,
   `install-outcome.ts` (RESV-05 arm), `docs/plugin-enablement.md` (rewrite
   the policy paragraph), new tokens.
4. **Constraint-aware update** (#3). Owners: `orchestrators/plugin/update-*.ts`,
   `orchestrators/marketplace/autoupdate.ts`, `domain/dependency-range.ts`
   (intersection already exists), `update.messaging.ts`.
5. **Reload installs missing dependencies** (#4). Owners:
   `orchestrators/reconcile/plan.ts` (a new bucket), `install-cascade.ts`.
6. **Cross-marketplace allowlist** (#1). Owners: `domain/manifest.ts`
   (schema field), `domain/dependency-closure.ts` (guard order — see the
   D-03-10 record-before-guard note), a new closed-set reason.
7. **Standalone `prune` + `--dry-run`** (#9). Owners: `edge/router.ts`,
   `edge/flag-catalog.ts` (FLAG-01 drift guard pins the uninstall flag set —
   amend deliberately), `orchestrators/plugin/uninstall.ts` (the sweep is
   `finalizePrunedMembers` / `domain/dependency-orphans.ts`).
8. **Docs**: #11 divergence paragraph; refresh every "Claude Code documents
   this for `disable`; this extension applies it to `uninstall`" sentence
   (`docs/dependency-resolution.md` §138) once #7 lands.

## Facts a planner needs

- Upstream error codes and messages (binary 2.1.267): `dependency-unsatisfied`
  (`Install "X" or uninstall "Y"` / `Enable "X" or uninstall "Y"`),
  `dependency-version-unsatisfied` (`Update "X" to satisfy R, or uninstall "Y"`),
  `range-conflict`, `no-matching-tag`, `installed-unsatisfied`,
  `cross-marketplace`; disable refusal text
  `X is still required by A, B. Disable those plugins first, or disable everything together: <chained command>`.
- Upstream never auto-adds a marketplace to resolve a dependency (D-03-08
  parity holds).
- `docs/plugin-enablement.md` §"Dependencies" quotes the upstream enablement
  paragraph verbatim and argues the current divergence; #6 reverses that
  argument, so rewrite rather than append.
- Every new user-visible token is a closed-set amendment: `REASONS` tuple,
  `notify-reasons.ts` header count, `docs/output-catalog.md` (state and byte
  counts pinned in `tests/architecture/catalog-uat/catalog-contract.test.ts`
  and `catalog-parser.test.ts`), `tests/architecture/notify-closed-set-locks.test.ts`.
- The direct-coverage CI gate requires every changed production module to be
  100% covered by its paired test unless pinned in
  `scripts/test-coverage-direct.pin.json`; ESLint and fallow both gate
  cognitive complexity at 15 and disagree on the score.
- BACKLOG `PRUNE-GUARD-MR-01` (`marketplace remove` bypasses the dependents
  guard) is affected by #7: if uninstall no longer refuses, the guard concept
  changes shape (report, not refuse). Re-triage it in phase 2.

## Skipped / debts

- No BACKLOG entries were written for these items; this handoff is the only
  record until a milestone is opened.
- `/gsd-complete-milestone` for v1.20 has not run (waiting on the PR merge).
- Five branch commit titles exceed 72 chars (nothing enforces it; the squash
  merge keeps the PR title).

## Resume

```text
cd /home/acolomba/src/pi-claude-marketplace-manifest
git status                      # only the per-machine files should show
gh pr view 198                  # merge when reviewed; then /gsd-complete-milestone
/gsd-new-milestone              # feed this file in as the milestone brief
```
