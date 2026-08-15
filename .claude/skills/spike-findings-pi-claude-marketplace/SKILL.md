---
name: spike-findings-pi-claude-marketplace
description: Implementation blueprint from spike experiments on pi-claude-marketplace -- backward-compat migration removal, Claude plugin dependency-declaration handling, progress-message UI for long-running operations, GitLab plugin-marketplace parity, and Fallow codebase-intelligence tooling adoption. Requirements, proven patterns, and verified knowledge for all five. Auto-loaded during implementation work on any of them.
---

<context>
## Project: pi-claude-marketplace

**Backward-compat removal:** investigated whether pi-claude-marketplace's
field-level backward-compat migration code (for `state.json` installed
records and for the `claude-plugins.json` desired-state config file) can
be replaced by detecting a stale record shape and forcing a full resync,
now that the project has a desired-state config file to rebuild from and
few enough users that a forced resync on upgrade is an acceptable cost.

**Claude plugin dependency support:** investigated whether Claude Code
plugins support declaring a dependency on another plugin, whether that
dependency is actually resolved anywhere -- upstream in Claude Code
itself, or in this repo's own `plugin.json`/`marketplace.json` handling --
or is purely informational.

**Progress messages for long-running operations:** investigated whether
Pi's extension UI (`ctx.ui`) supports a progress message that appears
only after a short delay (avoiding flicker on fast paths) and disappears
when the operation completes, for foreground commands like
`install`/`update`/`marketplace add` that await network I/O. Compared
three candidate UI primitives head-to-head in a live session.

**GitLab plugin-marketplace parity:** investigated whether this project's
source parser and git-auth registry already match an upstream Claude Code
changelog claim about bare GitLab URL support and host-named auth-failure
hints. Mostly retrospective -- GitLab Device Flow auth shipped via PR #128
the same day these spikes ran.

**Fallow codebase-intelligence adoption:** investigated whether `fallow`
(a free, open-source TypeScript/JavaScript static-analysis CLI) would
benefit this project across every free capability -- dead code, circular
deps, architecture boundaries, duplication, complexity/health, security
candidates, autofix safety, and CI overhead -- even where those overlap
this project's existing ESLint/SonarCloud tooling.

Spike sessions wrapped: 2026-08-13, 2026-08-15
</context>

<requirements>
## Requirements

### Backward-compat removal

- Any replacement for `migrate-config.ts` MUST NOT let "config file
  absent" collapse to "empty desired state" for a scope with a populated
  `state.json` -- that reads as "uninstall everything" to
  `reconcile/plan.ts`'s `buildUninstallBucket`.
- Staleness detection for `state.json` reuses `STATE_VALIDATOR.Check()` on
  the raw un-migrated JSON rather than a new per-record version stamp --
  it already fails on every REQUIRED-field addition and covers plugin-
  and marketplace-level records in one check.
- The combination "stale `state.json` AND absent `claude-plugins.json`"
  MUST fail loud (notify + explicit recovery step), never silently wipe
  or silently auto-migrate.
- Do not actively scrub the D-13 `autoupdate` legacy field -- it's
  provably inert and structurally invisible to a `Check()`-based gate
  anyway. Leave it in place.

### Claude plugin dependency support

- Upstream Claude Code's `dependencies` field is a real, fully-resolved
  feature (auto-install, semver, cross-marketplace guards, enable/disable
  cascade, `prune`) -- treat it as such, never as purely informational.
- pi-claude-marketplace's opaque, no-auto-resolution handling of
  `dependencies` is an intentional, still-valid scope decision -- do not
  build upstream's resolution engine here.
- The "manual-install warning" this project relies on to compensate for
  no auto-resolution MUST actually reach the user for every valid
  dependency shape, including the version-pinned object form -- it
  currently does not (see references/plugin-dependencies.md).

### Progress messages for long-running operations

- Live progress feedback is a foreground, user-initiated-command concern
  only (`install`, `update`, `marketplace add`, `marketplace update`) --
  never a background-autoupdate concern, since this project's autoupdate
  has no timer or session-start run to show progress for.
- Use `ctx.ui.custom()` + `BorderedLoader`, gated behind a ~1s
  delay-before-open helper, not `ctx.ui.setStatus`/`setWidget` -- those
  are for ambient, ignorable state, not a bounded operation the user is
  actively waiting on and might want to cancel (see
  references/progress-messages.md).

### GitLab plugin-marketplace parity

- A GitLab (or any other host) `url`-kind source keeps using the existing
  opaque full-URL identity -- no new host-specific type is needed.
- A GitLab Device Flow auth provider needs a real, registered OAuth
  Application first -- satisfied; `GITLAB_PROVIDER` shipped in PR #128
  (see references/gitlab-parity.md).
- Don't re-open BACKLOG.md's withdrawn SRCP-01 without re-probing the
  real `claude` CLI against current upstream behavior first.

### Fallow codebase-intelligence adoption

- No new `package.json` dependency -- any usage runs via `npx fallow`.
- Any config MUST NOT be zero-config -- Fallow's defaults are close to a
  no-op on this codebase (no recognized entry point) and `fallow
  recommend`'s own proposal doesn't fit this project.
- `fallow fix` MUST run `--dry-run` first and MUST NOT run unattended
  without a pre-authored `ignoreExports` allowlist for this project's
  `_*ForTest`/`__test_*` test-seam convention -- see
  references/fallow-adoption.md for the full recipe.
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Backward-compat removal | references/backward-compat-removal.md | `STATE_VALIDATOR.Check()` on raw JSON is a complete, zero-new-code staleness detector; deletes `migrate.ts` outright, but `migrate-config.ts` needs a loud-failure guard, not a bare deletion |
| Claude plugin dependency support | references/plugin-dependencies.md | Upstream fully auto-installs declared dependencies (semver, prune, cascades); this repo stays opaque by design, but `info.ts`'s `normalizeDependencies` silently drops the version-pinned object form of a dependency, making it invisible on every command surface |
| Progress messages | references/progress-messages.md | `ctx.ui.custom()` + `BorderedLoader` behind a ~1s delay helper wins over `setStatus`/`setWidget` for foreground install/update progress -- human-verified head-to-head, backed by `docs/tui.md`'s own naming and competitor precedent |
| GitLab plugin-marketplace parity | references/gitlab-parity.md | Already at parity for full-scheme URLs and auth architecture (GitLab Device Flow shipped in PR #128); SRCP-01 (bare shorthand) confirmed withdrawn against real upstream CLI behavior; SRCP-02 (git-subdir shorthand) and GAUTH-01 (host-named hints on 4 more call sites) remain open |
| Fallow codebase-intelligence adoption | references/fallow-adoption.md | Zero-config is close to a no-op (no recognized entry point); with an explicit config it finds real whole-file dead code and one unlisted 4-file duplicate clone, matches/exceeds ESLint's architecture boundaries, and finds zero new security signal -- but `fallow fix --dry-run` would break the test suite if ever run unattended without a hand-authored allowlist for this project's test-seam convention |

## Source Files

Original spike source files are preserved in `sources/` for complete
reference -- including `sources/003-force-reinstall-on-version-mismatch/prototype.ts`,
a runnable proof against the real production `STATE_VALIDATOR`,
`sources/005-pi-cm-dependency-behavior/prototype.ts`, a runnable proof
against the real production `resolveStrict` and `getPluginInfo`,
`sources/006-delayed-status-progress/extension.ts` /
`sources/007-a-progress-modality-widget/extension.ts` /
`sources/007-b-progress-modality-bordered-loader/extension.ts`, three
runnable Pi extensions (`pi -e <path>`) exercising the delay/auto-clear
mechanism against the real `ctx.ui` API, `sources/008-gitlab-bare-source-parsing/probe.ts`,
a runnable prediction-then-verify probe against the real
`parsePluginSource`, and `sources/010-fallow-dead-code-signal/` /
`sources/012-fallow-boundary-fidelity/`, the exact `.fallowrc.json`
configs and reproduction script this project would need to adopt Fallow.
</findings_index>

<metadata>
## Processed Spikes

- 001-installed-record-backcompat-audit
- 002-config-file-backcompat-audit
- 003-force-reinstall-on-version-mismatch
- 004-claude-plugin-dependency-spec
- 005-pi-cm-dependency-behavior
- 006-delayed-status-progress
- 007-a-progress-modality-widget
- 007-b-progress-modality-bordered-loader
- 008-gitlab-bare-source-parsing
- 009-git-host-auth-hint-coverage
- 010-fallow-dead-code-signal
- 011-fallow-circular-deps
- 012-fallow-boundary-fidelity
- 013-fallow-duplication-detection
- 014-fallow-complexity-health
- 015-fallow-security-candidates
- 016-fallow-fix-autofix-safety
- 017-fallow-ci-overhead
</metadata>
