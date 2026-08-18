# Spike Wrap-Up Summary

## Session: 2026-08-13 (backward-compat removal)

**Date:** 2026-08-13
**Spikes processed:** 3
**Feature areas:** Backward-compat removal (state.json + claude-plugins.json)
**Skill output:** `./.claude/skills/spike-findings-pi-claude-marketplace/`

### Processed Spikes

| #   | Name                                | Type     | Verdict     | Feature Area            |
| --- | ----------------------------------- | -------- | ----------- | ----------------------- |
| 001 | installed-record-backcompat-audit   | standard | ✓ VALIDATED | Backward-compat removal |
| 002 | config-file-backcompat-audit        | standard | ⚠ PARTIAL   | Backward-compat removal |
| 003 | force-reinstall-on-version-mismatch | standard | ⚠ PARTIAL   | Backward-compat removal |

### Key Findings

- `persistence/migrate.ts` (283 prod / 529 test LOC) is pure legacy-shape
  catchup with zero overlap with the live install/add write paths --
  clean deletion candidate.
- `persistence/migrate-config.ts` (197 prod / 570 test LOC) looks
  structurally similar but is NOT: it's the only thing preventing "config
  file absent" from being read as "uninstall everything" by
  `reconcile/plan.ts`. Deleting it requires a replacement guard, not a
  bare removal.
- The core "force reinstall on version mismatch" idea works, and more
  cheaply than expected: `STATE_VALIDATOR.Check()` on raw un-migrated JSON
  is already a complete staleness detector (proven against the real,
  unmodified validator in `prototype.ts`), so no new version-stamp field
  is needed. It covers plugin- and marketplace-level record staleness in
  one call.
- One gap: the D-13 `autoupdate` scrub (a stray-field cleanup, not a
  missing-field problem) is invisible to a `Check()`-based gate by
  construction (TypeBox tolerates extra properties). Recommendation:
  leave it, it's provably inert.
- `bridges/agents/marker.ts`'s legacy marker constant is a safety
  predicate, not a migration -- out of scope for this removal.
- Net estimated impact: ~480 prod LOC and ~1100 test LOC deleted, ~10-20
  LOC of new guard code added.

## Session: 2026-08-13 (Claude plugin dependency support)

**Date:** 2026-08-13
**Spikes processed:** 2
**Feature areas:** Claude plugin dependency support
**Skill output:** `./.claude/skills/spike-findings-pi-claude-marketplace/`

### Processed Spikes

| #   | Name                          | Type     | Verdict     | Feature Area                     |
| --- | ----------------------------- | -------- | ----------- | -------------------------------- |
| 004 | claude-plugin-dependency-spec | standard | ✓ VALIDATED | Claude plugin dependency support |
| 005 | pi-cm-dependency-behavior     | standard | ⚠ PARTIAL   | Claude plugin dependency support |

### Key Findings

- Upstream Claude Code plugins fully support declaring dependencies on
  other plugins via a `dependencies` array in `plugin.json` (bare string
  or `{name, version, marketplace}` object with semver ranges). It is not
  informational: `/plugin install` auto-resolves and auto-installs the
  whole tree, with git-tag-based version resolution, constraint
  intersection across installers, cross-marketplace guards, transitive
  enable/disable cascades, and orphan pruning (`claude plugin prune`).
- A research trap along the way: an open GitHub feature-request issue
  (#9444, filed 2025-10-12) reads as "not supported" if found in
  isolation, but predates the shipped feature -- confirmed against a
  separate, closed docs-bug issue (#48864) and the official reference
  docs directly.
- pi-claude-marketplace's own handling matches its documented scope
  (opaque field, no auto-resolution, static "must be installed manually"
  note) -- but the note itself barely reaches the user in practice: it's
  dropped from `install` (D-19-01), never read by `list` for an
  installable plugin, and `info`'s `normalizeDependencies` silently drops
  the version-pinned object form of a dependency declaration. Confirmed
  live against the real resolver and `info` orchestrator, not by static
  reading alone.
- Net effect: a plugin declaring a version-pinned dependency -- the shape
  upstream documents as the primary use case -- is currently invisible to
  a pi-claude-marketplace user through every command surface. No crashes
  or correctness defects; purely a lost-information gap, fixable with a
  narrow change to `info.ts`.

## Session: 2026-08-13 (progress messages)

**Date:** 2026-08-13
**Spikes processed:** 3
**Feature areas:** Progress messages for long-running operations
**Skill output:** `./.claude/skills/spike-findings-pi-claude-marketplace/`

### Processed Spikes

| #    | Name                              | Type       | Verdict             | Feature Area      |
| ---- | --------------------------------- | ---------- | ------------------- | ----------------- |
| 006  | delayed-status-progress           | standard   | ✓ VALIDATED         | Progress messages |
| 007a | progress-modality-widget          | comparison | ✓ VALIDATED (loses) | Progress messages |
| 007b | progress-modality-bordered-loader | comparison | ✓ WINNER            | Progress messages |

### Key Findings

- `@earendil-works/pi-coding-agent`'s `ctx.ui` has no built-in
  delayed-show/auto-clear progress primitive; it has to be hand-rolled on
  top of `setStatus`, `setWidget`, or `ctx.ui.custom()` + `BorderedLoader`.
- The mechanism itself is sound: `setExtensionStatus()`/`renderWidgets()`
  in the shipped runtime call `this.ui.requestRender()` unconditionally,
  proven by reading the actual `.js` (not just the `.d.ts`), then
  confirmed live -- a `setTimeout` callback firing mid-`await` inside a
  `registerCommand` handler repaints the TUI correctly with no keystroke
  or LLM-stream tick involved.
- Human-verified head-to-head comparison: `ctx.ui.custom()` +
  `BorderedLoader` won over `setStatus`/`setWidget` for foreground
  install/update/marketplace-add progress. `docs/tui.md` names
  `BorderedLoader` for exactly this job ("operations that take time and
  should be cancellable"), and `@nklisch/pi-plugins` -- the one real
  competitor -- mounts its entire interactive manager through the same
  primitive. `setStatus`/`setWidget` are the right register for ambient,
  ignorable state instead (a mode indicator, a non-blocking batch
  checklist), not a single bounded wait.
- Two real gaps found by testing, not by reading docs: `ctx.ui.custom()`
  returns `undefined` when `ctx.hasUI` is false despite being typed
  `Promise<T>` with no `| undefined` (caught by an automated
  `--print`-mode smoke test before it could waste a human's time in the
  interactive checkpoint); and `BorderedLoader` has no label-update
  method, so a multi-phase operation's label change means destroying and
  recreating the component.
- Competitive research reframed scope before any code was written:
  `@nklisch/pi-plugins` shows no live progress for its own background
  autoupdate (silent staging + one after-the-fact "update staged" line),
  confirming this work is correctly scoped to foreground commands only --
  this project has no background autoupdate daemon to begin with.
- The ~1s delay-before-show interval traces to Nielsen Norman Group's
  classic response-time threshold, not an arbitrary guess.

## Session: 2026-08-14 (GitLab plugin-marketplace parity)

**Date:** 2026-08-14
**Spikes processed:** 2
**Feature areas:** GitLab plugin-marketplace parity
**Skill output:** `./.claude/skills/spike-findings-pi-claude-marketplace/`

### Processed Spikes

| #   | Name                         | Type     | Verdict              | Feature Area |
| --- | ----------------------------- | -------- | --------------------- | ------------- |
| 008 | gitlab-bare-source-parsing   | standard | ⚠ VALIDATED (gap)     | GitLab parity |
| 009 | git-host-auth-hint-coverage  | standard | ⚠ VALIDATED (gap)     | GitLab parity |

### Key Findings

- Full-scheme GitLab URLs (`https://gitlab.com/...`), at any subgroup
  depth, already parsed correctly with zero code changes -- the generic
  `url` source kind treats the whole path as one opaque string.
- The gap spike 008 initially confirmed (bare, schemeless host-prefixed
  URLs unrecognized for any host) turned out to be parity, not a bug:
  probing the real, installed `claude` CLI v2.1.232 directly showed
  upstream rejects the same bare form too. `BACKLOG.md`'s SRCP-01 is
  marked WITHDRAWN as a direct result -- a clean example of verifying an
  external product claim against the primary source (the shipped binary)
  rather than trusting a changelog line's first reading.
- The git-auth architecture (`hostFromCloneUrl` -> `findProviderForHost`
  -> `buildAuthForHost`) was already fully host-generic before GitLab was
  added -- zero `kind === "github"` gating anywhere on the auth path.
  Adding `GITLAB_PROVIDER` was "append a descriptor," not an architecture
  change, and shipped same-day.
- GitLab Device Flow auth (GAUTH-02) landed in production via PR #128 the
  same day these spikes ran -- this feature area is retrospective, not a
  forward build plan.
- Two real, smaller gaps remain open: SRCP-02 (the `git-subdir` source's
  `url` field doesn't expand the bare `owner/repo` GitHub shorthand
  upstream's own docs say it should accept) and GAUTH-01 (the host-named
  auth-failure hint is wired into 1 of 5 relevant call sites).

## Session: 2026-08-15 (Fallow codebase-intelligence adoption)

**Date:** 2026-08-15
**Spikes processed:** 8
**Feature areas:** Fallow codebase-intelligence adoption
**Skill output:** `./.claude/skills/spike-findings-pi-claude-marketplace/`

### Processed Spikes

| #   | Name                          | Type     | Verdict            | Feature Area    |
| --- | ------------------------------ | -------- | -------------------- | ---------------- |
| 010 | fallow-dead-code-signal        | standard | ⚠ VALIDATED (gap)   | Fallow adoption |
| 011 | fallow-circular-deps           | standard | ✓ VALIDATED         | Fallow adoption |
| 012 | fallow-boundary-fidelity       | standard | ✓ VALIDATED         | Fallow adoption |
| 013 | fallow-duplication-detection   | standard | ✓ VALIDATED         | Fallow adoption |
| 014 | fallow-complexity-health       | standard | ✓ VALIDATED         | Fallow adoption |
| 015 | fallow-security-candidates     | standard | ⚠ VALIDATED (gap)   | Fallow adoption |
| 016 | fallow-fix-autofix-safety      | standard | ⚠ VALIDATED (gap)   | Fallow adoption |
| 017 | fallow-ci-overhead             | standard | ✓ VALIDATED         | Fallow adoption |

### Key Findings

- Zero-config `fallow` is close to a no-op on this codebase: it can't see
  `package.json`'s custom `pi.extensions` entry point, so it autopromotes
  ~443 of 446 files to their own entry, and `fallow recommend`'s own
  proposed config points at a nonexistent `src/index.ts`. Real signal
  needed a hand-authored `entry` config.
- With that config, real, previously-unknown findings emerged that
  nothing in this project's ESLint/SonarCloud stack currently catches:
  7 orphaned barrel/dead files (`domain/index.ts` and siblings), one
  fully orphaned messaging module, 3 stale devDependencies that
  contradict this repo's own `STACK.md`, and a verbatim 4-file
  duplicate clone across `*.messaging.ts` siblings that mirrors an
  already-Sonar-excluded pattern one directory over.
- Fallow's architecture-boundary config matched this project's ESLint
  `no-restricted-paths` gate exactly at the same granularity, and a
  finer-grained variant caught a real enforcement gap: "cross-bridge
  imports forbidden" is claimed in an ESLint message string but nothing
  actually checks it today.
- Two real landmines if adopted carelessly: `fallow security`'s 131
  candidates on this codebase were 100% false positives on manual
  verification (mostly the project's own already-hardened path-safety
  layer), and `fallow fix --dry-run` proposed deleting at least 39 of
  172 exports that are test-injection seams the test suite actively
  imports -- running it unattended would break `node --test`.
- Performance is a non-issue: every command measured completed in 1-3
  seconds, negligible against this project's ~3m11s `npm run check`, and
  `fallow audit`'s new-vs-inherited attribution correctly excludes
  pre-existing findings from a PR's gate verdict.

## Session: 2026-08-15 (Hooks circular-dependency removal)

**Date:** 2026-08-15
**Spikes processed:** 4
**Feature areas:** Hooks circular-dependency removal
**Skill output:** `./.claude/skills/spike-findings-pi-claude-marketplace/`

### Processed Spikes

| #    | Name                           | Type       | Verdict      | Feature Area          |
| ---- | ------------------------------ | ---------- | ------------ | --------------------- |
| 018  | hooks-module-state-portability | standard   | ✓ VALIDATED  | Hooks cycle removal   |
| 019a | hooks-cycle-leaf-extraction    | comparison | ✓ WINNER     | Hooks cycle removal   |
| 019b | hooks-cycle-inversion          | comparison | ✗ LOSES      | Hooks cycle removal   |
| 020  | hooks-cycle-gate-closure       | standard   | ✓ VALIDATED  | Hooks cycle removal   |

### Key Findings

- The `bridges/hooks/` cycle knot comes out for **five one-line import
  swaps**, taking cycles 8 -> 0 with zero test files modified.
  `ARCHITECTURE.md` accepts the knot, Spike 011 recommended accepting it,
  and `BACKLOG.md` FLOW-02 judged untangling it "out of proportion to the
  gap." That judgment was wrong, and this series is the measurement that
  says so. Shipped as `cee12150`.

  This bullet used to read "...with a green `npm run check`." The swaps do
  need an `eslint --fix` pass for `import-x/order`, because `routing-state`
  sorts after the `event-router` it replaces -- five mechanical line moves,
  but the spike record's green-check claim was not reproducible as captured.
- The knot was never about orchestration. `event-router.ts` owned both the
  shared state and the handler wiring; moving the state down to a leaf turns
  the bidirectional edges one-directional, and the hub keeps importing
  `dispatch`/`settle`/`registry` untouched.
- ESM read-only imported bindings split the work cleanly and safely: the two
  `const` Maps cross a module boundary for free, the two `let` cells need
  their 6 reassignment sites converted to mutators, and every way the
  refactor can go wrong is a `tsc` error.
- Dependency inversion is not wrong, just more expensive. It reaches 0
  cycles too (graph-shape probe), but `compositeHandlerFor` is generic over
  three conditional types that are module-private to `dispatch.ts`, so a
  typed registry needs them exported and relocated -- 019a's work plus a
  registry plus a side-effect import barrel -- and it converts compile-time
  failures into load-order-dependent runtime ones on a Pi lifecycle event.
- FLOW-02 closes. `--circular-deps` and `--re-export-cycles` are separate
  isolating flags and must both join the gate; they union with
  `--boundary-violations` rather than override it. `.fallowrc.json` needs no
  change at all -- the `bridges-hooks` zone already covers the new leaf, and
  rule severity does not gate anything, since `--fail-on-issues` exits 1 on
  warn-severity findings too.
- Method finding worth more than any single result: **two false results this
  series came from probes that never modified the tree** -- a mangled regex
  that left imports in place and reported "8 cycles, unchanged", and a
  boundary probe run from the wrong directory that reported "No issues
  found". Neither surfaced as a failing command; both were caught by
  internal inconsistency. Recorded in CONVENTIONS.md as a standing check.
