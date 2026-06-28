# Phase 71 -- Deferred Items

## Cross-surface reason-token parity on the no-force install FAILURE row

**RESOLVED** in commit 46bc0757 (`fix(71): IN-02 render typed unsupported
reason on no-force failure row`). The resolver now threads its typed
`unsupported[]` list onto the thrown `PluginShapeError` (`unsupportedKinds`),
and the install failure-row composer narrows it through the shared
`narrowUnsupportedKinds` helper FIRST, deduped against the note-derived
markers. A hooks-only unsupported plugin now renders `{unsupported hooks}`
(an lsp one `{lsp}`), byte-identical across the failure row, `list`, and
`info`. The `unavailable` (structural) arm carries an empty typed list, so
its notes-sourced reasons are unchanged. No new REASONS member required.

**Discovered during:** 71-04 Task 2 (PHOOK-04 / SEV-02 coverage).

**Observation:** A partial-hook plugin installed WITHOUT `--force` blocks with
the `(unavailable)` row + the `--force` hint (SEV-02, correct), but the reason
brace renders the generic `{unsupported source}`, not `{unsupported hooks}`. The
`hooks` kind rides the typed `unsupported[]` list (mapped via
`narrowUnsupportedKinds`), whereas the install FAILURE surface composes its
reason from the structural `notes` path (`narrowResolverReasons(r.notes)`), and
`hooks` is not in `UNSUPPORTED_COMPONENT_KINDS`, so it pushes no `contains hooks`
note. The list / info / force-installed-success surfaces all render the typed
`{unsupported hooks}` marker correctly; only the no-force failure row degrades to
the generic token.

**Why deferred:** Out of scope for Plan 04 -- the plan's SEV-02 must-have only
requires the no-force install to block with the `--force` hint (it does), and
Task 2 was scoped to `install.test.ts` / `list.test.ts` with "no source change
to install.ts / stage.ts expected". Closing the parity gap requires threading the
typed `unsupported[]` kinds into `requireInstallable`'s thrown reasons (or the
install-failure composer), which ripples to every unsupported-kind failure row
and touches the resolver gate -- a deliberate change beyond this final plan.

**Follow-up:** Route the install-failure reason composition through (or merge
with) `narrowUnsupportedKinds(resolved.unsupported)` so the no-force failure row
carries `{unsupported hooks}`, restoring full RSTATE-05 cross-surface parity. No
new REASONS member required (`unsupported hooks` already exists).
