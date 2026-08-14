# Spike Manifest

## Idea

### GitLab plugin-marketplace parity (spikes 008-009)

Upstream Claude Code shipped a plugin-marketplace changelog entry: "bare
`gitlab.com` repo URLs (including nested subgroups) now clone like
`github.com` URLs, and clone auth-failure hints name your actual git host."
Since this repo intentionally tracks upstream's `/plugin` surface for parity,
the question is what our own source parser (`domain/source.ts`) and git-auth
registry (`domain/auth-registry.ts`, `orchestrators/auth-host.ts`) already do
with non-github git hosts, and what a parity fix would cost.

### Backward-compatibility removal (spikes 001-003)

Now that pi-claude-marketplace has a desired-state configuration file
(`claude-plugins.json`), do we still need field-level backward-compatibility
migration for every shape change to installed records (`state.json`) and to
the config file itself? Or can a version stamp + forced reinstall (using the
existing reinstall ledger) replace per-field migration code entirely, given
the project has few enough users that a forced reinstall on upgrade is an
acceptable cost?

### Claude plugin dependency support (spikes 004-005)

Do Claude Code plugins support declaring a dependency on another plugin? If
so, is that dependency actually _resolved_ (auto-installed) anywhere in the
pipeline -- upstream in Claude Code itself, or in this repo's own
`plugin.json`/`marketplace.json` handling -- or is it purely an informational
declaration the user must act on manually?

### Progress messages for long-running operations (spikes 006-007)

Long-running foreground operations -- cloning a marketplace, installing or
updating a plugin -- currently give the user no feedback while
`edge/handlers/plugin/*` await network I/O inside a `registerCommand`
handler. The idea: show a progress message that kicks in only after a short
interval (avoiding flicker on fast paths) and disappears when the operation
completes. Does `@earendil-works/pi-coding-agent`'s extension UI surface
(`ctx.ui`) support this natively, and if not, which of its primitives
(`setStatus`, `setWidget`, `ctx.ui.custom()` + `BorderedLoader`) is the
idiomatic vehicle for a hand-rolled delay-then-show/auto-clear helper?

## Requirements

### GitLab plugin-marketplace parity

- A GitLab (or any other host) `url`-kind source keeps using the existing
  opaque full-URL identity (`UrlSource.url`) -- no new host-specific type is
  needed for path/clone purposes, since arbitrary subgroup nesting is just
  more path segments to a generic URL (Spike 008).
- Any new "bare host/path" shorthand form reuses the generic `url` kind (or
  the existing `GitHubSource` for a `github.com/` bare prefix) after
  prefixing `https://`, not a new discriminated source kind (Spike 008).
- A GitLab Device Flow auth provider requires a real GitLab OAuth
  Application registered out-of-band first -- `clientId` is a compile-time
  literal (D-32-03) that has to come from somewhere; this is a human/infra
  prerequisite, not something a code change alone can satisfy (Spike 009).

### Backward-compatibility removal

- Any replacement for `migrate-config.ts` MUST NOT let "config file
  absent" collapse to "empty desired state" for a scope with a populated
  `state.json` -- that reads as "uninstall everything" to
  `reconcile/plan.ts`'s `buildUninstallBucket` (Spike 002).
- Staleness detection for `state.json` should reuse `STATE_VALIDATOR.Check()`
  on the raw un-migrated JSON rather than introducing a new per-record
  version stamp -- it already fails on every REQUIRED-field addition and
  covers plugin- and marketplace-level records in one check (Spike 003).
- The combination "stale state.json AND absent claude-plugins.json" MUST
  fail loud (notify + explicit recovery step), never silently wipe or
  silently auto-migrate (Spike 003, composing Spike 002's finding).
- The D-13 `autoupdate` legacy field is not worth actively scrubbing --
  it's provably inert (CLASSIFY-ONLY read, reconciled against config
  truth before any write) and structurally invisible to a
  Check()-based staleness gate (TypeBox tolerates extra properties).
  Leave it in place rather than keeping the 3-file scrub threading alive
  (Spike 003).

### Claude plugin dependency support

- Upstream Claude Code's `dependencies` field is a real, fully-resolved
  feature (auto-install, semver ranges, cross-marketplace guards,
  enable/disable cascade, `prune`) -- not informational. Any future work
  that assumes it's inert or purely advisory is working from a stale
  premise (Spike 004).
- pi-claude-marketplace's own `dependencies` handling is intentionally
  narrower (opaque field, no auto-resolution) -- that scope decision
  stands. But the "manual-install warning" that's supposed to compensate
  for the missing auto-resolution does not reliably reach the user today:
  it's dropped from `install`, never read by `list` for an installable
  plugin, and `info` -- the only surface left -- silently drops or omits
  the version-constrained object shape (`{name, version}`), which is the
  shape that matters most (Spike 005). A future fix here is a narrow
  display fix to `info.ts`'s `normalizeDependencies`, not a rebuild of
  upstream's resolution machinery.

### Progress messages for long-running operations

- Live progress feedback is a foreground, user-initiated-command concern
  (`install`, `update`, `marketplace add`, `marketplace update`), not a
  background-autoupdate concern -- this project's autoupdate is opt-in,
  timer-free, and runs only inside an explicit `marketplace update` call, so
  there is no background daemon to show progress for. Competitor research
  (`@nklisch/pi-plugins`) shows no live progress for its background
  autoupdate either; it stages silently and surfaces one static
  after-the-fact line (`"update staged -- live next start"`). A
  staged/decoupled-notification pattern for a _future_ background autoupdate
  is a separate product decision (already tracked in
  `docs/competitive-analysis/pi-plugins.md` recommendation #3), not a Pi
  UI-capability question, and is out of scope for these spikes.
- The delay-before-show interval is not arbitrary -- it should track
  Nielsen Norman Group's response-time thresholds (~0.1s instant, ~1.0s is
  where a delay becomes noticeable and earns feedback, ~10s is the
  attention-span limit). ~1 second is the industry-conventional
  delay-before-show threshold precisely to avoid flicker on fast paths.
- **Modality decision (spikes 006/007a/007b, human-verified head-to-head):**
  use `ctx.ui.custom()` + `BorderedLoader` (or a label-settable variant),
  gated behind a ~1s delay-before-open helper, for foreground
  install/update/marketplace-add progress -- not `ctx.ui.setStatus` or
  `ctx.ui.setWidget`. Those two are the right primitive for ambient,
  ignorable, non-blocking state (a persistent mode indicator, a batch-import
  checklist where the user isn't blocked on any single item) but are the
  wrong register for a single bounded operation the user is actively
  waiting on and might want to cancel. `docs/tui.md` names `BorderedLoader`
  for exactly this job, and `@nklisch/pi-plugins` -- our one real
  competitor -- mounts its whole interactive manager through the same
  `ctx.ui.custom()` primitive.
- `BorderedLoader` has no label-update method; a multi-phase operation
  (resolve source -> fetch -> checkout) needs its label to change mid-flight,
  which today means destroying and recreating the component. A real build
  should add a label setter to (or wrap) `BorderedLoader` rather than
  accept a recreate-per-phase cost silently.
- `ctx.ui.custom()` returns `undefined` when `ctx.hasUI` is false
  (json/print modes), despite its documented type signature being
  `Promise<T>` with no `| undefined`. Any real usage must guard on
  `ctx.hasUI` before calling it and fall back to plain `notify()`.
  `ctx.ui.setStatus`/`setWidget` degrade to a silent no-op outside TUI mode
  by design and need no such guard.

## Spikes

| #    | Name                                | Type       | Validates                                                                                                                                                                                                                                                                    | Verdict             | Tags                                                                     |
| ---- | ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| 001  | installed-record-backcompat-audit   | standard   | Given state.json/agent-marker backward-compat code, when audited against force-reinstall, then produce an exact removal inventory                                                                                                                                            | ✓ VALIDATED         | backward-compat, migration, state-json, audit                            |
| 002  | config-file-backcompat-audit        | standard   | Given claude-plugins.json's first-run migration, when audited for removability, then produce an exact inventory and flag any unsafe removal                                                                                                                                  | ⚠ PARTIAL           | backward-compat, migration, config-file, audit                           |
| 003  | force-reinstall-on-version-mismatch | standard   | Given a stale record, when STATE_VALIDATOR.Check() gates loading instead of field-by-field migration, then stale records are detected with no new plumbing, covering plugin- and marketplace-level records alike                                                             | ⚠ PARTIAL           | backward-compat, migration, force-reinstall, design, prototype           |
| 004  | claude-plugin-dependency-spec       | standard   | Given Anthropic's official Claude Code plugin/marketplace docs, when researched for a `dependencies` field, then determine whether it exists, its shape, and what Claude Code itself does with it at install time                                                            | ✓ VALIDATED         | claude-code, plugin-dependencies, upstream-spec, research                |
| 005  | pi-cm-dependency-behavior           | standard   | Given this repo's real resolver/install code, when a plugin entry declares `dependencies`, then observe end-to-end what actually happens on install                                                                                                                          | ⚠ PARTIAL           | claude-code, plugin-dependencies, resolver, info-command, prototype, bug |
| 006  | delayed-status-progress             | standard   | Given a `registerCommand` handler awaiting a simulated multi-second clone, when wrapped in a delay(~1s)->show->auto-clear helper over `ctx.ui.setStatus`, then the footer text appears only after the delay, live-updates mid-await, and clears in a `finally` even on error | ✓ VALIDATED         | pi-extension, ui, progress, tui                                          |
| 007a | progress-modality-widget            | comparison | Given the same delay/auto-clear helper, when mounted via `ctx.ui.setWidget` for a simulated multi-step clone, then observe the ambient, non-blocking feel                                                                                                                    | ✓ VALIDATED (loses) | pi-extension, ui, progress, tui, comparison                              |
| 007b | progress-modality-bordered-loader   | comparison | Given the same helper, when mounted via `ctx.ui.custom()` + `BorderedLoader` for the same simulated clone, then observe the modal, cancellable feel head-to-head against 007a                                                                                                | ✓ WINNER            | pi-extension, ui, progress, tui, comparison                              |
| 008  | gitlab-bare-source-parsing          | standard   | Given a bare (schemeless) `gitlab.com/group/.../project` string or a full `https://gitlab.com/...` URL with nested subgroups, when passed through `parsePluginSource`, then determine current classification                                                                | ⚠ VALIDATED (gap)    | source-parsing, gitlab, parity                                           |
| 009  | git-host-auth-hint-coverage         | standard   | Given a non-github git host clone/auth failure, when the credential/auth-host code emits a diagnostic, then determine whether it already names the actual host across all call sites, and whether Device Flow auth is architecturally pluggable per-host                     | ⚠ VALIDATED (gap)    | auth, git-credential, gitlab, parity                                     |
