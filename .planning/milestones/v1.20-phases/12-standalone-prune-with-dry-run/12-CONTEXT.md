# Phase 12: Standalone prune with dry-run - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `/claude:plugin prune` to remove the target scope's orphaned
dependency-installed plugins without naming or removing a primary plugin.
`prune --dry-run` previews the same fixpoint without mutating state or disk.
Only `--dry-run` is added beside the shared scope flag; there is no prompt or
`-y`. The `{orphaned}` marker proposed for `list` and `info` is excluded.

</domain>

<decisions>
## Implementation Decisions

### Preview and empty result

- **D-12-01:** Each dry-run candidate uses Pi's pending removal status and
  carries the existing prune reason: `(will uninstall) {dependency pruned}`.
  The actual command uses `(uninstalled) {dependency pruned}`. The preview
  must identify the same members in the same removal order and never imply a
  removal has happened. This is a user-visible row contract.
- **D-12-02:** Both `prune` and `prune --dry-run` emit a normal, informational
  `Nothing to prune` message when no record qualifies. Include the selected
  scope and a short reason that no orphaned dependency installs were found.
  Do not use a failed row or a warning for this outcome.

### Backlog disposition

- **D-12-03:** Close `PRUNE-CMD-01` when the standalone command and dry-run
  ship. Drop its proposed `{orphaned}` marker for `list` and `info`; the
  preview command supplies the orphan inventory and Claude Code shows no
  marker on those surfaces. Do not re-file the marker as a separate backlog
  item.

### Carried decisions and fixed requirements

- **D-05-01/02/04/05/06/07:** Reuse the whole-scope, same-scope, offline,
  fail-closed fixpoint over dependency provenance. Disabled declarers still
  hold their dependencies. An unreadable declarer stops the entire sweep.
- **D-05-11/13:** Actual removals retain the ordinary uninstall rows and
  per-member failure reporting. A failed member still holds its dependencies.
- **FLAG-02 / D-02-05:** The standalone verb accepts only `--dry-run` beyond
  shared scope selection. Pi's slash command has no confirmation prompt or
  `-y`; the dry-run is the explicit preview path.

### Agent Discretion

- Choose the exact no-orphans sentence after `Nothing to prune`, while naming
  the selected scope and reason.
- Reuse existing row and message types where practical. Keep the preview
  status and reason locked as stated above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract and prior decisions

- `.planning/ROADMAP.md` §"Phase 12: Standalone prune with dry-run" — goal,
  success criteria, and owner notes.
- `.planning/REQUIREMENTS.md` §"Prune" and §"Uninstall flag surface" —
  PRUNE-06, PRUNE-07, and FLAG-02.
- `.planning/phases/05-prune-on-uninstall/05-CONTEXT.md` — D-05-01..13,
  including the fixpoint, declaration rules, and actual removal rows.
- `.planning/HANDOFF-upstream-dependency-parity.md` — the standalone prune
  parity decision and the no-prompt Pi divergence.
- `.planning/BACKLOG.md` §"PRUNE-CMD-01" — item to close, with the inventory
  marker explicitly dropped by D-12-03.

### Output and usage contracts

- `docs/output-catalog.md` — closed-set row and reason contracts.
- `docs/messaging-style-guide.md` — message grammar and severity.
- `docs/dependency-resolution.md` — user-facing dependency and prune behavior.
- `README.md` — command usage surface.

### Upstream primary reference

- https://code.claude.com/docs/en/plugin-dependencies §"Remove orphaned
  auto-installed dependencies" — standalone prune, normal empty result,
  dry-run listing, and confirmation behavior (retrieved 2026-09-23).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/dependency-orphans.ts::pruneOrphans` computes a sorted fixpoint over
  dependency provenance and declarations without mutating its inputs.
- `orchestrators/plugin/uninstall.ts::sweepOrphans` already removes eligible
  members under one state transaction and rechecks failed-member holds.
- `shared/notification-types.ts::PluginWillUninstallMessage` and the shared
  renderer provide an existing pending-removal status for preview rows.

### Established Patterns

- The edge flag catalog owns parse and completion names. Its architecture
  drift test pins each verb's accepted set.
- Plugin operations report through `ctx.ui.notify` and the closed output
  catalog. The existing `dependency pruned` reason belongs to actual rows;
  its use on preview rows needs an explicit catalog amendment.
- Uninstall reads declarations offline and fails closed before the sweep.

### Integration Points

- `edge/router.ts` and `edge/handlers/plugin/` add the command and usage;
  `edge/flag-catalog.ts` and completions expose `--dry-run`.
- Extract or parameterize the uninstall sweep so standalone `prune` can call
  it with no primary removal, while dry-run calls the same predicate through
  a read-only path without taking a write lock.
- Update the command docs and close `PRUNE-CMD-01` while dropping its marker
  proposal.

</code_context>

<specifics>
## Specific Ideas

**Upstream evidence (2026-09-23, high confidence):** Claude Code's official
dependency guide says `prune --dry-run` lists what would be removed and that
an empty sweep prints `Nothing to prune` with a reason as a normal result.
It documents a confirmation prompt and `-y`; D-02-05 and the Pi slash-command
capability gap license this project's no-prompt divergence. The guide does not
specify exact preview row bytes, so D-12-01 follows Pi's existing pending-row
grammar. No unresolved upstream behavior blocks planning.

</specifics>

<deferred>
## Deferred Ideas

None. The old `{orphaned}` inventory marker was dropped, not deferred.

</deferred>

---

*Phase: 12-standalone-prune-with-dry-run*
*Context gathered: 2026-09-23*
