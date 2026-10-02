# Phase 5: Prune on uninstall - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 05-prune-on-uninstall
**Areas discussed:** Orphan scan breadth, Who still counts as a declarer, Reconcile-path default, Reporting shape (PRUNE-04), Dependents guard (folded in)

Before the questions, upstream was checked: `code.claude.com/docs/en/plugin-dependencies` and `plugins-reference` (2026-09-16). Upstream's `uninstall --prune` scans the whole scope for orphaned auto-installed dependencies after the removal; a standalone `plugin prune` with `--dry-run` and a `-y` confirmation exist there. The installed Claude Code 2.1.267 binary carries no plugin prune yet.

---

## Orphan scan breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Whole-scope sweep | Every `"dependency"` record in the target scope nothing declares, including orphans from earlier removals (upstream parity) | ✓ |
| Only X's own dependency closure | Walk X's declarations and prune the now-undeclared members | |

| Option | Description | Selected |
|--------|-------------|----------|
| Iterate to a fixpoint | Removing D1 can orphan D2; repeat until stable | ✓ |
| One pass only | Second-order orphans wait for the next --prune | |

| Option | Description | Selected |
|--------|-------------|----------|
| No — prune only after X was removed | A failed primary uninstall prunes nothing | ✓ |
| Yes — prune is independent of X | The sweep runs regardless (a de-facto standalone prune) | |

| Option | Description | Selected |
|--------|-------------|----------|
| You decide | Dependents before dependencies, existing uninstall path | ✓ |
| Alphabetical by key | List order, graph-independent | |

**User's choice:** whole-scope sweep, fixpoint, gated on the primary removal, order at Claude's discretion.

---

## Who still counts as a declarer

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — installed is installed | A disabled record's declarations still hold its dependencies | ✓ |
| No — only ENABLED plugins hold | Prune when every declarer is disabled | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same scope only | Target scope's state.json is the declarer set (D-03-05, upstream per-scope) | ✓ |
| Both scopes hold | Either scope's declaration protects a record | |

| Option | Description | Selected |
|--------|-------------|----------|
| Read each installed plugin's manifest from its on-disk root | The Phase 1 offline read, as `info` does; no stored declarer list | ✓ |
| Re-run the install-time closure walk | Reuse `resolveDependencyClosure` over cached manifests | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fail closed: prune nothing it might hold | Any unreadable declarer skips the prune step and says so | ✓ |
| Treat unreadable as declaring nothing | Prune proceeds | |

**User's choice:** disabled counts, same scope, offline manifest read, fail closed.

---

## Reconcile-path default

| Option | Description | Selected |
|--------|-------------|----------|
| Never prune on reconcile | Flag-absent = no prune; orphans stay until an explicit --prune | first round: not selected; second round: ✓ |
| Always prune on reconcile | Reconcile sweeps orphans after every config-driven uninstall | first round: ✓; reversed |

Second round (after the consequences were laid out — two behaviors for one operation, wider promptless deletion, fail-closed firing on every reload for a user with a cold `(remote)` plugin):

| Option | Description | Selected |
|--------|-------------|----------|
| Never prune on reconcile | One behavior; upstream parity; no new promptless deletion | ✓ |
| Reconcile prunes only what ITS OWN uninstalls orphaned | Config-driven uninstall behaves as --prune for that plugin | |
| Standing sweep on every reload | Orphans never survive a reload; --prune = do it now + report | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — one flag, every removal | `--keep-data` covers pruned dependencies too | ✓ |
| No — keep-data covers only X | Pruned dependencies always lose their data directory | |

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestrator option `prune: true` on the Phase 2 seam | Sweep inside the same locked transaction after the primary removal | ✓ |
| Handler-level chaining | Edge handler calls the orchestrator once per orphan | |

**User's choice:** never prune on reconcile (reversed from the first pick), keep-data covers everything, option on the orchestrator seam.
**Notes:** The reversal is recorded in CONTEXT.md D-05-08 with the three consequences that drove it.

---

## Reporting shape (PRUNE-04)

| Option | Description | Selected |
|--------|-------------|----------|
| `(uninstalled) {dependency pruned}` rows | Ordinary uninstall rows with one new reason; `{dependency pruned, data kept}` under --keep-data | ✓ |
| Bare `(uninstalled)` rows, no reason | Zero catalog growth, no way to tell which removal the flag caused | |
| A summary line instead of rows | Trailer under the primary row | |

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing extra — the primary row alone | No orphans, no rows, no marker | ✓ |
| Mark the primary row | `{nothing to prune}` second token | |

| Option | Description | Selected |
|--------|-------------|----------|
| Its row fails; the rest stand | `(failed) {reason}` beside successes, block warning, no rollback | ✓ |
| Roll back the whole prune step | All-or-nothing like the install cascade | |

| Option | Description | Selected |
|--------|-------------|----------|
| UAT note only | Reinstall pre-milestone records to get true provenance; prune correctly declines | ✓ |
| Add a repair path | Re-derive provenance from config membership (new capability) | |

**User's choice:** per-row `{dependency pruned}`, silent when nothing qualifies, per-row failure, UAT note for the dev-tree residue.

---

## Dependents guard (folded in)

Raised by Claude as an un-listed gray area: `uninstall X` when installed Y still declares X.

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as is — note for backlog | Phase scope is pruning orphans | |
| Fold it in | `uninstall X` refuses and names the dependents | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse, name the dependents | Nothing removed; remedy is to uninstall the dependents first | ✓ |
| Cascade-remove the dependents too | apt-style; unbounded blast radius for a promptless command | |

| Option | Description | Selected |
|--------|-------------|----------|
| `(failed) {dependents remain}` + cause line naming them | New token in the `plugins remain` register; names on the cause line | ✓ |
| Reuse `plugins remain` | No new token; borrows a marketplace-subject meaning | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes to both — one behavior | A disabled declarer holds; reconcile refuses too and reports each reload | ✓ |
| Command only; reconcile removes X anyway | Config wins on reload; Y breaks | |

| Option | Description | Selected |
|--------|-------------|----------|
| PRUNE-05 in the PRUNE family | ROADMAP Phase 5 criterion 6 | ✓ |
| New family DEPS-01 | Separate heading in REQUIREMENTS.md | |

**User's choice:** fold in; refuse and name; `{dependents remain}` + cause line; same at both entry points; PRUNE-05.

---

## Claude's Discretion

- Removal order within the pruned set.
- Fixpoint computation strategy inside the lock.
- Which existing reason (if any) reports D-05-07's unreadable-declarer skip.
- One or two catalog-amendment commits for the two new members.

## Deferred Ideas

- Standalone `/claude:plugin prune` (`autoremove`) with `--dry-run`.
- `-y` / confirmation prompt (rejected by D-02-05 / FLAG-01).
- `list` / `info` marker for an orphaned dependency.
- Repair path for pre-milestone provenance records.
- Cascade-remove dependents on uninstall.
- Restated from Phase 4's backlog: ENBL-DEP-01, DEPS-STATUS-01.
