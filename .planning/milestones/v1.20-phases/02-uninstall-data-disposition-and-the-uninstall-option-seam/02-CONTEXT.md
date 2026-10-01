# Phase 2: Uninstall data disposition and the uninstall option seam - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `uninstall --keep-data` so a user can remove a plugin's artifacts and
installation record while preserving its persistent data. Without the flag,
uninstall deletes data without prompting, including when reconcile removes a
plugin dropped from configuration. Establish one uninstall option path that
Phase 5 can extend with `--prune`.

Requirements: DATA-01, DATA-02, DATA-03 and Phase 2's usage/completion criterion.

</domain>

<decisions>
## Implementation Decisions

### Output and help conventions

- **D-02-01:** Follow the existing option conventions for success output and
  help text. The user's instruction was: "keep output and help text in line
  with existing options". Preserve the current uninstall success format; do
  not introduce a separate retained-data report or path trailer.
- **D-02-02:** Add `--keep-data` to uninstall usage and completions using the
  same layout, concise descriptions, and flag-catalog conventions as existing
  options. Explain that the flag preserves plugin data. Document the default
  deletion behavior in the existing documentation style.

### Requirements already settled before this discussion

- **D-02-03:** `--keep-data` preserves the data directory and its contents;
  plugin artifacts and the installation record are still removed.
- **D-02-04:** Omitting the flag deletes data without confirmation. Reconcile
  takes this same default because it has no command line.
- **D-02-05:** Reject `--delete-data` and `-y` as unknown flags. Keep existing
  scope and write-target options. `--prune` belongs to Phase 5.
- **D-02-06:** Do not add cross-scope checks: data directories are already
  partitioned by scope. Retained-data garbage collection is outside this phase.

### Agent's Discretion

- Choose the smallest extension of existing option parsing and orchestration
  that gives Phase 5 a single place to add its uninstall option.
- Follow existing conventions for flag ordering, duplicate flags, errors,
  notifications, test structure, and documentation wording.
- Preserve existing post-commit cleanup failure behavior unless implementation
  uncovers a concrete conflict with DATA-01 through DATA-03.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents must read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and scope notes.
- `.planning/REQUIREMENTS.md` — DATA-01 through DATA-03, FLAG-01's Phase 5
  boundary, excluded flags, and reconcile planning notes.
- `.planning/BACKLOG.md` — UDISP-01 records the settled promptless default,
  upstream comparison, per-scope data layout, and deferred garbage collection.
- `docs/output-catalog.md` — existing uninstall output and usage contracts.
- `docs/messaging-style-guide.md` — existing notification grammar.
- `.planning/codebase/ARCHITECTURE.md` — layer boundaries and ownership.
- `.planning/codebase/CONVENTIONS.md` — implementation and test conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/edge/flag-catalog.ts` owns per-verb flag
  definitions and completion descriptions; uninstall currently includes the
  shared write-target flag.
- `extensions/pi-claude-marketplace/edge/handlers/shared.ts` owns the shared
  option scanner used by the uninstall handler.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` already
  has `UninstallPluginOptions` and post-commit data cleanup.

### Established Patterns

- Thin command handlers parse arguments and pass typed options to orchestrators.
- Notifications use shared typed output contracts; options do not justify an
  independent output mechanism.
- Data cleanup runs after durable uninstall state changes.

### Integration Points

- `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` — parse
  the flag, extend usage, and pass the option into uninstall.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` —
  condition the data deletion while preserving other uninstall cleanup.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` — retain
  the promptless default for config-driven removal.
- `extensions/pi-claude-marketplace/persistence/locations.ts` — existing
  per-scope data location and containment checks.

</code_context>

<specifics>
## Specific Ideas

The user wants output and help consistent with existing options. The core data
policy was already explicit in the roadmap and was not reopened.

</specifics>

<deferred>
## Deferred Ideas

- `--prune` remains Phase 5's responsibility.
- Garbage collection for data retained by `--keep-data` remains a follow-on.

### Reviewed Todos (not folded)

- `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md`
  matched generic planning words. It concerns a repository-wide unused-member
  gate and explicitly creates no work in this milestone; its prior deferred
  disposition remains in force.

</deferred>
