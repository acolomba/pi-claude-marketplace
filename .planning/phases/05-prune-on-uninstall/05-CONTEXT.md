# Phase 5: Prune on uninstall - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

`uninstall --prune <plugin>` removes the dependency-installed plugins that no
remaining installed plugin needs, and nothing else, and says which ones it
removed. `uninstall` refuses to remove a plugin that another installed plugin
still declares, and names the dependents (PRUNE-05, folded in by the operator
during this discussion). The uninstall flag surface closes at exactly
`--keep-data` and `--prune` (FLAG-01). Reconcile never prunes.

Not in this phase: a standalone `prune` / `autoremove` command, `--dry-run`,
a `-y` confirmation flag, a repair path for pre-milestone provenance, any
`list` / `info` marker for an orphaned dependency, cascade auto-enable of a
disabled dependency (`BACKLOG.md` ENBL-DEP-01), dependency status
propagation (`BACKLOG.md` DEPS-STATUS-01).

</domain>

<decisions>
## Implementation Decisions

Upstream reference for every decision below: Claude Code's
`claude plugin uninstall --prune` and `claude plugin prune`
(`docs/en/plugin-dependencies` § "Remove orphaned auto-installed
dependencies", retrieved 2026-09-16): "After removing the named plugin,
Claude Code scans for and removes any auto-installed dependencies that are
now orphaned. Plugins you installed yourself are never pruned." Where this
extension departs from upstream it is because FLAG-01 / D-02-05 close the
flag surface (no `-y`, no prompt) or because a standalone command is out of
scope.

### Orphan scan breadth

- **D-05-01: The prune step is a WHOLE-SCOPE sweep, not a walk of the removed
  plugin's own closure.** After the named plugin is removed, every record in
  the target scope with `provenance: "dependency"` that no remaining installed
  plugin in that scope declares is removed — including orphans left behind by
  earlier plain uninstalls or by config-driven (reconcile) removals. This is
  upstream's semantics and the only path that ever cleans reload orphans,
  because reconcile keeps them (D-04-05, D-05-08).
  — **Reversibility:** costly — narrowing to the removed plugin's closure
  later would strand every orphan that already accumulated, with no command
  to clean it.
- **D-05-02: The sweep iterates to a FIXPOINT.** Removing dependency D1 can
  orphan D1's own dependency D2; the orphan test repeats until nothing new
  qualifies. Mirrors the install cascade's transitive closure.
- **D-05-03: Prune runs ONLY after the named plugin was actually removed.** A
  primary uninstall that does not happen — not installed, permission denied,
  lock held, or refused by the dependents guard (D-05-13) — prunes nothing;
  the failure row stands alone. `uninstall <not-installed> --prune` is not a
  back door to a standalone prune.
- **Removal order (Claude's discretion):** dependents before their
  dependencies (the reverse of the install post-order), each through the
  existing per-plugin removal, rows rendered in that order.

### Who still counts as a declarer

- **D-05-04: A DISABLED installed plugin still holds its declared
  dependencies.** Installed is installed: a disabled record keeps its
  inventory and reservations (ENBL-18/19), and re-enabling it must find its
  dependencies still there. The orphan test is "no installed plugin declares
  it", never "no enabled plugin".
- **D-05-05: Same scope only.** The declarer set is the target scope's
  `state.json`; a plugin installed in the other scope never holds a record
  here and is never consulted. D-03-05 installs a dependency beside its root,
  and upstream prunes per `--scope`. Prune reads one state document.
- **D-05-06: Declarations are read OFFLINE from each remaining installed
  plugin's manifest at its on-disk root**, through the existing
  `orchestrators/plugin/dependency-declaration-read.ts::readDependencyDeclaration`
  (own manifest outranks the marketplace entry; entry answers only where the
  manifest is unreadable; fs + warm clone cache only, NFR-5). No stored
  declarer list exists or is added (D-04-01).
- **D-05-07: FAIL CLOSED on an unreadable declarer.** If any remaining
  installed plugin's declarations cannot be established — no readable
  manifest AND no marketplace entry to fall back to — the prune step removes
  NOTHING and reports it on that plugin's row (an existing reason such as
  `unreadable manifest` where it fits; the planner confirms which member the
  read's failure arm maps to). The primary uninstall still stands. Deleting
  on incomplete information is the one outcome this phase must never
  produce.
  — **Reversibility:** reversible — relaxing to "unreadable declares
  nothing" later is a one-line predicate change; the reverse direction
  cannot restore a wrongly pruned plugin.

### Reconcile-path default (ROADMAP open decision 4 — settled)

- **D-05-08: Reconcile NEVER prunes.** The flag's absent value is "no prune",
  and `applyPluginUninstalls()` takes that default exactly as it takes
  DATA-03's delete default — one behavior at both entry points. Orphaned
  `"dependency"` records survive `/reload` (D-04-05 stays unconditional; the
  D-04-05 exemption is what keeps them) and are removed only by an explicit
  `uninstall … --prune`. Upstream: auto-installed dependencies "stay on disk
  … in case you reinstall a dependent plugin."
  The operator first chose a standing sweep on every reload and reversed it
  once three consequences were laid out: (1) plain `uninstall` and `/reload`
  would disagree about orphans — the two-behaviors trap the ROADMAP names;
  (2) promptless deletion would extend to plugins never named in any command
  or config edit; (3) D-05-07's fail-closed rule would fire on every reload
  for any user with one cold `(remote)` git-source plugin, making the sweep
  a third behavior.
  — **Reversibility:** reversible — a later standing sweep is one call in
  `apply.ts` plus a doc change; nothing written to disk depends on it.
- **D-05-09: `--keep-data` covers EVERY plugin the command removes.** The flag
  is a disposition for the whole command; each pruned row renders
  `{dependency pruned, data kept}` exactly as the primary row renders
  `{data kept}`. A per-plugin split would need a flag FLAG-01 forbids.
- **D-05-10: The prune decision lives on the Phase 2 option seam.**
  `UninstallPluginOptions` gains `prune?: boolean` beside `keepData`; the
  orchestrator runs the sweep inside the SAME locked state transaction after
  the primary removal, reusing its own per-plugin removal path; the reconcile
  caller never sets it. One ledger, one report. The edge handler maps the
  catalog-owned `--prune` name onto the option the way `KEEP_DATA_FLAG` is
  mapped today (D-02-02 / WR-01).

### Reporting shape (PRUNE-04)

- **D-05-11: Each pruned plugin renders an ORDINARY uninstall row under its
  own marketplace header carrying a new closed-set reason `dependency pruned`**
  — in the register of `dependency promoted` / `dependency disabled`:
  `○ dep v1.0.0 (uninstalled) {dependency pruned}`, or
  `{dependency pruned, data kept}` under `--keep-data`. Same status, glyph,
  severity (`info`) and reload hint as the primary row; the brace is the only
  difference. One new `REASONS` member (appended at the tail — the tuple
  order is catalog-stable), one new catalog state, and the FULL closed-set
  amendment in one commit exactly as D-04-07 did: the member, its home in the
  command-private reason partition (not the idempotent group — a prune
  mutates state), the `notify-reasons.ts` count ledger, the emitting arm, the
  catalog section with its state anchor, the fixture, both catalog contract
  constants, the byte-length lock, both enumeration pins, and the
  `catalog-parser.test.ts` tuple count (the tenth surface 04-06 found).
  — **Reversibility:** one-way — a published catalog row is a user-visible
  contract; renaming the token later is a breaking output change.
- **D-05-12: Nothing to prune renders NOTHING extra.** When `--prune` was
  passed and no record qualified, the block is the primary row alone; no
  second token, no marker. Matches how `--keep-data` renders only where it
  changed something.
- **D-05-13: A pruned plugin that fails to remove renders its own
  `(failed) {reason}` row beside the successful ones**; the block computes
  `warning` (carried out but short); the named plugin's removal and the
  other prunes are NOT rolled back — each removal is its own committed step,
  as the cascade install reports per member. Uninstall has no ledger today
  and this phase does not add one.
- **Dev-tree residue (UAT note, no code):** records Phase 3 wrote on the
  operator's own trees were back-filled `"explicit"` by D-04-03, so `--prune`
  will correctly decline them there. The remedy is to uninstall and
  reinstall those plugins; carry this into `05-UAT.md` so it is not debugged
  as a prune defect (04-05-SUMMARY, Pitfall H).

### Dependents guard (PRUNE-05 — folded in by the operator)

- **D-05-14: `uninstall X` REFUSES when any remaining installed plugin in the
  same scope declares X, and names the dependents.** Nothing is removed. The
  remedy is to uninstall the dependents first (or `uninstall Y --prune`,
  which then sweeps X as an orphan). Upstream's `disable` shape ("X is still
  required by Y. Disable that plugin first…"); cascade-removing dependents
  was rejected as a promptless command with an unbounded blast radius.
  Same declarer rules as the prune sweep: a DISABLED declarer holds (D-05-04),
  same scope only (D-05-05), offline manifest read (D-05-06), and an
  unreadable declarer fails closed — the uninstall is refused rather than
  risked (D-05-07).
  — **Reversibility:** costly — once users rely on the refusal, relaxing it
  silently breaks dependents again; adding a cascade-remove later needs a
  confirmation story the flag surface forbids.
- **D-05-15: Rendered as `⊘ X v1.0.0 (failed) {dependents remain}` with a
  cause line naming them: `cause: required by Y@mp, Z@mp`.** One new
  closed-set reason in the `plugins remain` register (that token's documented
  subject is a marketplace and is not borrowed); the names ride the cause
  line, never the token, on the `dependency cycle` precedent. `error`
  severity (the operation was not carried out). Full closed-set amendment as
  in D-05-11; the two new members land in one amendment commit or two — the
  planner decides — but each lands in FULL.
  — **Reversibility:** one-way — published catalog row.
- **D-05-16: The guard holds on the RECONCILE path.** A config-driven
  uninstall of X while a remaining installed plugin still declares X is
  refused, and reconcile reports the same failed row on every reload until
  the config is fixed — truthful, and the fix is one config edit. One
  behavior at both entry points (the DATA-02 / DATA-03 principle).
  — **Reversibility:** reversible — the reconcile arm can be relaxed to
  "config wins" later without touching persisted state.
- **D-05-17: PRUNE-05 is the requirement ID**, added to the PRUNE family in
  `REQUIREMENTS.md`, and ROADMAP Phase 5 gains success criterion 6 for it.

### Flag surface (carried forward, not re-asked)

- `--prune` and `--keep-data` are the whole extra-flag set; `--local` and
  `--scope` unchanged (FLAG-01). No confirmation prompt and no `-y`: D-02-05
  rejected `-y`/`--yes`, DATA-02 set the no-prompt precedent, and Pi has no
  TTY prompt to honor. `edge/flag-catalog.ts` owns the `--prune` NAME the way
  it owns `KEEP_DATA_FLAG`; `flag-catalog-drift.test.ts`'s `uninstall`
  entries move from `["--keep-data", "--local"]` to include `--prune`, and
  the usage string documents it.

### Claude's Discretion

- Removal order within the pruned set (dependents before dependencies).
- How the fixpoint is computed (repeat-until-stable over the in-memory state
  snapshot inside the lock vs. a topological pass) — as long as D-05-01/02
  hold and the state is saved once.
- Which existing reason member (if any) carries D-05-07's "could not
  establish declarations" report, versus whether the failure arm of
  `readDependencyDeclaration` already yields a member; a NEW token for it
  needs the same full amendment and should be avoided if an existing one is
  truthful.
- Whether `dependents remain` and `dependency pruned` land in one catalog
  amendment commit or two.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upstream parity (retrieved 2026-09-16; scratch copies were fetched with `curl` from `code.claude.com/docs/en/<page>.md`)
- `https://code.claude.com/docs/en/plugin-dependencies.md` § "Remove orphaned auto-installed dependencies" — the semantics D-05-01/02/03 mirror: whole-scope scan after removal, "plugins you installed yourself are never pruned", orphans otherwise stay on disk; § "Enable or disable a plugin with dependencies" — the refusal shape D-05-14/15 mirror ("still required by … Disable that plugin first").
- `https://code.claude.com/docs/en/plugins-reference.md` § "plugin uninstall" / § "plugin prune" — the flag table (`--prune`, `-y`, `--json`, `--dry-run`); everything beyond `--prune` is out of scope here by FLAG-01.

### This milestone's contracts
- `.planning/REQUIREMENTS.md` — PRUNE-01..05, FLAG-01, DATA-01..03 (PRUNE-05 added by this discussion).
- `.planning/ROADMAP.md` § "Phase 5: Prune on uninstall" — goal, success criteria 1–6, the Notes on the handler's inline flag rejection and on the reconcile path; § "Open decisions" item 4 (settled by D-05-08).
- `.planning/phases/04-install-provenance/04-CONTEXT.md` — D-04-01 (mode-only provenance; prune re-derives declarers), D-04-02 (config names only what the user asked for), D-04-05 (reconcile's single exemption), D-04-07 (promotion; the closed-set amendment surfaces), D-04-08 (anchor on `D-NN-NN`, never a bare `PROV-NN`).
- `.planning/phases/04-install-provenance/04-REVIEW.md` § "Operator Decisions" and `04-REVIEW-FIX.md` — the rulings that shaped the shipped Phase 4 code (CR-01 retained-marketplace predicate `isRetainedRecorded`, promotion enables, import promotes) and the two backlogged items.
- `.planning/phases/04-install-provenance/04-06-SUMMARY.md` — the ten pinning surfaces of a closed-set amendment, measured.
- `.planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-CONTEXT.md` — D-02-01..06: the option seam, catalog-owned flag names, no-prompt delete, `-y` rejected.
- `.planning/phases/03-dependency-resolution/03-CONTEXT.md` — D-03-05 (a dependency lands in its root's scope), D-03-07 (install cascade is all-or-nothing — prune deliberately is NOT, D-05-13).
- `.planning/BACKLOG.md` — ENBL-DEP-01 and DEPS-STATUS-01 (out of scope), plus the new entries this discussion defers.

### Output contract
- `docs/output-catalog.md` § `/claude:plugin uninstall` — the rows D-05-11/15 extend; § "Reasons rendering" — the `REASONS` tuple is append-only and byte-stable; the `dependency cycle` state (cause-line precedent).
- `docs/dependency-resolution.md` and `docs/plugin-enablement.md` — user-facing prose this phase must extend (prune, the dependents guard) without contradicting Phase 4's statements.
- `.claude/rules/typescript-comments.md` — comment anchor policy.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/plugin/uninstall.ts` — `UninstallPluginOptions` (`keepData` seam, D-02), `buildUninstalledRow` (the row D-05-11 extends with a reason), the `withLockedStateTransaction` closure the sweep must run INSIDE (proper-lockfile is not re-entrant — never call the public `uninstallPlugin` from within itself; extract a guard-free per-plugin removal body the way `runInstallLedger` was extracted).
- `orchestrators/plugin/dependency-declaration-read.ts::readDependencyDeclaration` — the offline "what does this plugin declare" read (D-05-06); its not-readable arm is what D-05-07 keys on.
- `domain/dependencies.ts::parseDeclaredDependencies` / `DeclaredDependency` — the parsed declaration shape (name, optional marketplace, optional constraint); the orphan test matches on `plugin@marketplace` keys the way the cascade root and reconcile already do (exact string, no folding).
- `orchestrators/reconcile/plan.ts::isRetainedRecorded` / `holdsDependencyRecord` — the pure retention predicate reconcile uses; the sweep's "nothing declares it" test is the complementary question and must not be confused with it.
- `edge/flag-catalog.ts` (`KEEP_DATA_FLAG`, `passThroughFlagNames("uninstall")`) and `edge/handlers/plugin/uninstall.ts` (`CONSUMED_FLAGS`, the `consumedFlags.has(KEEP_DATA_FLAG)` mapping) — add `--prune` beside them; `tests/architecture/flag-catalog-drift.test.ts` pins both sides.
- `orchestrators/plugin/install.messaging.ts::PROMOTED_ROW_REASONS` / `composePromotedRow` and `shared/notify-reasons.ts` — the D-04-07 amendment as the template for the two new members.
- `orchestrators/marketplace/remove.messaging.ts` (`plugins remain`, `RemovePrivateReason`) — the command-private reason pattern D-05-15 follows.

### Established Patterns
- Closed-set amendment lands in FULL in one commit (D-04-07; ten surfaces enumerated in `04-06-SUMMARY.md`); markdown is formatted by mdformat via pre-commit, and the catalog byte-length lock is taken AFTER the hooks run.
- Severity is computed from the reason set, not asserted (`install-cascade.messaging.ts`); `notify` is a dumb renderer — the orchestrator stamps status/reasons/severity.
- Both cognitive-complexity ceilings are 15 (ESLint sonarjs and fallow, different algorithms); `uninstall.ts`'s lock closure and `plan.ts`'s `diffMarketplaces` (14) / `buildUninstallBucket` (13) are near them — extend with helpers, not branches.
- The `npm-typecheck` and `npm-coverage-direct` pre-commit hooks reject a red-test or half-swept commit, so a production change and the tests that keep its pair covered land together (04-04/05/06, review fix passes).
- No pre-commit hook is installed in this checkout; executors run `pre-commit run --files` themselves.

### Integration Points
- `orchestrators/reconcile/apply.ts::applyPluginUninstalls` — calls `uninstallPlugin` with no options; stays that way for prune (D-05-08) but must surface the D-05-16 refusal row (a `failed` outcome already renders there).
- `orchestrators/plugin/uninstall.messaging.ts` / catalog `/claude:plugin uninstall` section — new states: success-prune, success-prune-keep-data, prune-partial-failure, refused-dependents-remain (planner names them).
- `docs/dependency-resolution.md` § reload/provenance paragraphs and `docs/plugin-enablement.md` § "Where the two differ" — must not be contradicted by the prune/guard prose.
- `tests/architecture/no-orchestrator-network.test.ts` — `uninstall.ts` is "implicitly clean" today; adding the declaration read keeps it offline (the read module is fs-only) but the planner should confirm the gate's `FORBIDDEN_TARGETS` list and whether `uninstall.ts` should now be pinned explicitly.

</code_context>

<specifics>
## Specific Ideas

- Row bytes the operator agreed to: `○ dep v1.0.0 (uninstalled) {dependency pruned}`; `○ dep v1.0.0 (uninstalled) {dependency pruned, data kept}`; `⊘ X v1.0.0 (failed) {dependents remain}` + `cause: required by Y@mp, Z@mp`.
- "A plugin asked for by name is enabled" (Phase 4 ruling) is the operator's mental model for provenance: derived state, nothing remembered beyond the mode. Prune re-derives; it stores no declarer list.
- Reconcile is an enforcer of desired state, not a janitor: it never deletes what nothing asked it to delete (D-05-08), and it refuses what it cannot safely do (D-05-16).

</specifics>

<deferred>
## Deferred Ideas

- **Standalone `/claude:plugin prune` (`autoremove`) with `--dry-run`** — upstream has it; a new command surface, its own phase.
- **`-y` / confirmation prompt for prune** — rejected by D-02-05 / FLAG-01 for this milestone; Pi has no TTY prompt to honor anyway.
- **`list` / `info` marker for an orphaned dependency** (e.g. `{orphaned}`) — the only way a user could see what `--prune` would remove without running it; new closed-set token, new inventory semantics.
- **Repair path for pre-milestone provenance** (re-derive `"explicit"`/`"dependency"` from config membership for records Phase 3 wrote) — new capability; the UAT note covers the operator's tree.
- **Cascade-remove dependents on uninstall** (apt-style) — rejected in favor of the refusal (D-05-14); would need a confirmation story.
- Already backlogged from Phase 4, restated so the planner does not pick them up: **ENBL-DEP-01** (a cascade enables a disabled, already-installed dependency) and **DEPS-STATUS-01** (a plugin whose dependency is partially installed is itself partial).

### Reviewed Todos (not folded)
- `2026-09-02-detect-unused-code-and-type-members.md` — matched on the word "phase" only (score 0.2); unrelated tooling todo.

</deferred>

---

*Phase: 05-prune-on-uninstall*
*Context gathered: 2026-09-16*
