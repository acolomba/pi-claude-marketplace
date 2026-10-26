# Phase 24: Import Reasons - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous discuss; the orchestrating session asked for an
autonomous, non-interactive run, so every recommended answer below was
accepted without a prompt.

<domain>
## Phase Boundary

`/claude:plugin import` reports the same reasons and statuses that `install`
and reconcile report for the same fact (IMP-08, IMP-09, IMP-10), and the
import suite gains the held-dependency case Phase 19 left uncovered. The phase
owns `orchestrators/import/*`, `test/orchestrators/import/*`, and
`features/plugin/import.feature`. Phases 20-23 run in parallel, so shared
files get one-word changes at most (an `export` keyword).

Upstream has no `import` command, so the reference rows are this project's own
`install` (fresh install) and reconcile (re-enable), which import already
delegates to (Phase 19 D-01).

</domain>

<decisions>
## Implementation Decisions

### IMP-08: the narrowed reason of a plugin that cannot be installed
- **D-01:** A `not-installable` or `no-longer-installable` `PluginShapeError`
  on the import path renders the reasons `install` renders: the resolver notes
  and unsupported kinds narrowed through install's own
  `narrowResolverReasons` (exported from `install.messaging.ts`, not copied),
  with the error's `partialable` flag. The `{no longer installable}` token
  leaves import. The warning outcome carries the narrowed `reasons`.
- **D-02:** The row keeps import's `(unavailable)` status at warning severity
  for both resolver arms. `install` renders a partialable plugin as
  `(partially-available)` with a `--partial` hint, but import has no
  `--partial` flag (`usage-errors.feature` rejects `import --local` and every
  other flag but `--scope`), so that hint would name a remedy import cannot
  take. The catalog's `fresh-mixed-both-scopes` state already shows
  `(unavailable) {unsupported hooks}`, which import can now produce.

### IMP-09: the unclassified failure
- **D-03:** An unclassified import failure renders the reasons `install`'s
  runtime-throw row renders (`install.messaging.ts` Branch 4): a git host's
  refusal maps through `classifyGitHostFailure` to `source missing`,
  `network unreachable`, `network error`, or `authentication required`;
  anything else carries no reason, so the row is a bare `(failed)` with its
  cause line. `{not in manifest}` then means only a plugin the marketplace
  does not list. The authentication row drops its cause line, as install's
  does.

### IMP-10: re-enabling a partially installed record
- **D-04:** Import's enable row is reconcile's: reconcile's
  `enabledRowFromOutcome` (`reconcile/notify.ts`) is exported and import feeds
  it the enable outcome's degradation signals, so a re-enabled partial record
  renders `(partially-installed)` with its dropped kinds, and the
  `{orphan rewake}` / `{malformed ...}` tokens and staged-companion markers
  follow the same rule. Import's row set gains `partially-installed`.
- **D-05:** The import outcome keeps its `plugin-installed` kind and its
  `reenabled` flag (the post-pass reads them); it gains an optional
  `enableSignals` field present only on the enable path, which selects
  reconcile's row builder.

### Held dependency coverage
- **D-06:** A unit case seeds a record that the load-time check holds down
  (`dependencyDisabled: true`, its dependency disabled by the user) under
  settings that enable it, and asserts import reports
  `(skipped) {already installed}`, leaves the record disabled, and never calls
  the enable operation.

### Claude's Discretion
- Test layout inside `execute.test.ts` and the scenario wording.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` "### Phase 24"
- `.planning/phases/13-plugin-import/13-REVIEW.md` WR-02, IN-01
- `.planning/phases/19-import-on-the-reconcile-path/19-VERIFICATION.md` "For the user"
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` (`classifyEntityShapeError`, `composeInstallFailureMessage`)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` (`enabledRowFromOutcome`)

</canonical_refs>

<deferred>
## Deferred Ideas

- Reconcile's own install failure still collapses both resolver arms to
  `{no longer installable}` (`reconcile/apply-outcomes.ts::classifyOrchestratorThrow`);
  the same narrowing would apply there, outside this phase's files.

</deferred>
