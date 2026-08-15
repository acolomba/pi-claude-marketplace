# Spike Manifest

## Idea

### Hooks circular-dependency removal

- The `bridges/hooks/` cycle knot is removable, and the cure is leaf
  extraction of shared state, not dependency inversion (Spikes 019a/019b).
- Any module-state relocation MUST convert every reassignment site to a
  named mutator: ESM imported bindings are read-only, so a `let` cell
  cannot move without its writes moving too (Spike 018).
- A leaf state module owns the state AND its pure accessors. Leaving a
  one-line reader like `getRoutingBucket` behind in the hub just re-creates
  the edge (Spike 019a).
- `--circular-deps` may only join the local gate in the same change that
  removes the cycles. Added alone it fails on the 8 inherited cycles at the
  first commit (Spike 020).
- The local gate MUST pass `--re-export-cycles` alongside `--circular-deps`.
  They are separate isolating flags, so a gate carrying only the latter
  leaves re-export cycles unchecked. Free to add today at 0 findings
  (Spike 020).
- Do not reach for `rules.<name>` severity to control the gate.
  `--fail-on-issues` exits 1 on warn-severity findings too; the flag, not
  the severity, decides what the gate sees (Spike 020).
- A captured spike diff is not the change. 019a's and 020's diffs swap
  module specifiers in place, which breaks `import-x/order` because
  `routing-state` sorts after the `event-router` it replaces, and neither
  diff creates the leaf module its own imports depend on. Run `eslint --fix`
  on the repointed importers and create the leaf first (implementation run,
  `cee12150`).
- Verify a new gate is non-vacuous, not merely green. The combined fallow
  gate was confirmed to exit non-zero with `8 circular dependencies` against
  the pre-change commit before its exit-0 on the fixed tree was believed
  (implementation run, `cee12150`).

**Shipped:** 018/019a/020 landed as `cee12150` on
`features/hooks-cycle-removal` -- cycles 8 -> 0, `npm run check` green, zero
test files touched. The green-check status recorded in the 019a and 020
rows below was **not** reproducible as captured; see each README's
Correction note and the blueprint's "Corrections to the spike record."

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

### Fallow codebase-intelligence adoption (spikes 010-017)

pi-claude-marketplace already enforces architecture boundaries, cycle-freedom,
complexity, and duplication through a hand-built stack: a 9-zone
`import-x/no-restricted-paths` config, custom grep-gate architecture tests
(`no-orchestrator-network`, `no-credential-leak`, `no-shell-out`, `notify-*`
coverage), `sonarjs/cognitive-complexity`, and SonarCloud (CPD, coverage,
quality gate). Fallow (`fallow-rs/fallow`, MIT, free static layer) claims to
cover the same ground plus whole-graph dead-code detection this repo has no
tooling for today. The question: explore every free Fallow capability against
the real codebase -- including ones that overlap existing tooling -- to
determine per-capability signal quality, false-positive risk from this
project's Pi-extension entry-point patterns, and whether adoption (as a
manual audit tool, a pre-commit gate, or a CI gate) is worth the cost.

**Answered and adopted** (quick task 260815-h7g, 2026-08-15): all three
roles, not one. Fallow is a pinned devDependency running at every point
ESLint runs -- the `npm-fallow` pre-commit hook, `npm run check`, and
`ci.yml` through that check -- plus a `fallow audit` job on pull
requests. The dead-code findings were acted on: 6 orphan files and 3
stale devDependencies removed. Two capabilities were deliberately left
unwired, `security` (131 candidates, all false positives here) and `fix`
(would delete load-bearing test seams). Two gaps are filed as
BACKLOG.md FLOW-01 and FLOW-02.

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

### Fallow codebase-intelligence adoption

- Zero-config Fallow is close to a no-op on this repo -- `dead-code`'s
  fallback entry-point heuristic autopromotes ~443 of 446 files to their
  own entry point because it doesn't recognize `pi.extensions` in
  `package.json` as the real entry. Any adoption MUST ship an explicit
  `.fallowrc.json` with `entry:
  ["extensions/pi-claude-marketplace/index.ts"]` -- `fallow recommend`'s
  own generated default (`src/index.ts`) is wrong for this project and
  would silently mislead an agent that accepts it uncritically (Spike 010).
- `production: true` dead-code findings correctly distinguish
  "unreachable from production" from "reachable only via tests," but this
  project's `^_`-prefixed test-injection-seam convention
  (`_setSpawnForTest` and siblings) is invisible to that distinction --
  every such export shows as "unused" and needs a manual filter pass before
  any finding is treated as safe to delete (Spike 010).
- Whole-file, zero-importer dead code (unused barrels like
  `domain/index.ts`, orphaned modules like
  `orchestrators/marketplace/info.messaging.ts`) is Fallow's strongest,
  cleanest signal on this codebase -- every such finding in Spike 010 was a
  confirmed true positive, and it's a gap none of the existing tooling
  (ESLint's file-local `no-unused-vars`, SonarCloud) fills (Spike 010).
- Circular-dependency detection is config-independent (unlike dead-code) --
  identical results zero-config or with an explicit entry -- and found
  exactly the single already-documented `bridges/hooks/` cycle knot, no
  more, no less. Its value is as an automated regression guard on a fact
  today enforced only by prose plus a narrower orchestrators-only ESLint
  rule. It does NOT catch the one-directional "must not import" ban that is
  D-11's actual invariant (a one-way import without a full cycle) -- that
  needs boundary/zone config, not `--circular-deps` (Spike 011).
- Fallow's `boundaries` config is allow-based (`from: X, allow: [...]`)
  where the existing ESLint `no-restricted-paths` is deny-based (`target:
  X, from: [zones that must NOT import X]`) -- porting requires reading
  each ESLint zone's prose `message` field, not inverting the deny-lists,
  and is manual, error-prone work with no automatic converter. At matching
  8-zone granularity it reproduces the ESLint gate exactly (zero
  violations on the clean codebase, catches a planted violation in reachable
  code). A finer 12-zone variant (one zone per bridge kind) additionally
  enforces "cross-bridge imports forbidden" -- a rule this project's own
  ESLint message CLAIMS but nothing currently checks (confirmed: neither
  ESLint nor any architecture test catches
  `bridges/agents/` importing `bridges/mcp/`). Boundary checking inherits
  Spike 010's reachability gate, though -- a violation in dead code is
  invisible to Fallow but caught by ESLint's glob-based, reachability-blind
  rule. Fallow should complement, not replace, the existing ESLint gate
  (Spike 012).
- `fallow dupes` reproduces SonarCloud's existing CPD signal (independently
  re-finds duplication in both files behind Sonar's 3-file exclusion list)
  and surfaces real, verified duplication Sonar's exclusion list doesn't
  cover -- most notably a verbatim 4-file clone across `*.messaging.ts`
  sibling files, the same "per-verb parallel file" pattern as the
  already-excluded `bridges/*/stage.ts` pair. But clone detection is
  structural/token-based and blind to intent: a flagged `shared/notify.ts`
  self-duplication turned out to be two blocks a code comment explicitly
  marks as deliberately different behavior -- every "extract shared
  function" suggestion needs a human read of surrounding comments before
  acting (Spike 013).
- `fallow health`'s top complexity findings exactly match the 8 functions
  this project already knows are highly complex and has documented,
  ESLint-suppressed (`eslint-disable-next-line sonarjs/cognitive-complexity`)
  reasons for keeping that way (e.g. `installPlugin` at cognitive 49,
  "audited flow matching PI-1..15"). Not a gap -- Fallow just has no
  awareness of ESLint's suppression comments, so any adoption needs its own
  `fallow-ignore-next-line` suppression pass for those 8 or CI reports them
  as new forever. What IS new: this project's ESLint config has no
  cyclomatic-complexity rule at all, so cyclomatic complexity, function
  unit-size (434 functions over 60 lines), and file-level maintainability
  are entirely uncovered today. `--coverage-gaps` is a much weaker claim
  than it sounds (static test-reachability, not runtime line coverage) and
  CRAP/file-risk scores need real coverage data
  (`--coverage <coverage-final.json>`, Istanbul format) wired in -- this
  project emits `lcov`, so that's a real conversion cost, not a flag
  (Spike 014).
- `fallow security`'s 131 candidates on this codebase are 96%
  path-traversal, traced to the project's own already-hardened
  `path-safety.ts`/`locations.ts` chokepoints -- the pattern-matcher sees
  "non-literal `path.join()` argument" without knowing that IS the safety
  check. All 5 non-path-traversal candidates checked in depth were also
  false positives, 3 of them defended in code visible right next to the
  flagged line (regex-escaping in `vars.ts` and `convert.ts`, a
  hardcoded-provider-registry URL in `github-auth.ts`'s SSRF flags).
  SonarCloud's zero-open-hotspot state stands -- nothing here is new signal
  for this codebase. Low value as a gate here specifically because this
  codebase already documents its own safety invariants in comments; would
  likely be higher-value on a less-documented codebase (Spike 015).
- `fallow fix --dry-run` is NOT safe to apply unattended on this codebase:
  at least 39 of 172 proposed export removals (a lower-bound count from
  naming convention alone) are `_*ForTest`/`__test_*` test-injection seams
  or other test-only-consumed exports (e.g. `GITLAB_PROVIDER`) the test
  suite actively imports -- applying the list would break `node --test`
  immediately. `fix` inherits Spike 010's production-reachability blind
  spot and turns it into a destructive action, not just a report. It IS
  appropriately conservative elsewhere: it declined to auto-resolve Spike
  013's duplicate-export ambiguity, deferring to a config `ignoreExports`
  suppression instead of guessing, and in this run it never proposed
  removing whole files or `package.json` dependencies even though both
  categories had confirmed real findings in Spike 010. Any adoption needs
  a hand-authored `ignoreExports` allowlist for every test seam BEFORE the
  first unattended run (Spike 016).
- Wall-clock overhead is not a blocker: full baseline scans (dead-code +
  dupes + health, ~1.2s), a full security scan (~1.1s), and a PR-gate
  `fallow audit` run against a real 18-file branch diff (~2.5s) are all
  negligible next to this project's ~3m11s `npm run check`. `audit`'s
  new-vs-inherited attribution is real, not just documented: it correctly
  excluded Spike 010's 3 known-stale devDependencies from this branch's
  gate verdict as pre-existing (inherited from `main`), so adopting it as
  a required PR check would not create false-fail noise on unrelated
  findings. The blocking cost for adoption is entirely upfront
  configuration and convention-teaching (an `entry` field, a boundary
  config, an `ignoreExports` allowlist for test seams), not runtime
  (Spike 017).

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
| 010  | fallow-dead-code-signal             | standard   | Given the real repo's Pi-extension entry points and barrels, when `npx fallow dead-code` runs, then determine signal-to-noise: real dead code vs. false positives from invisible entry points                                                                                | ⚠ VALIDATED (gap)    | fallow, static-analysis, dead-code, tooling                              |
| 011  | fallow-circular-deps                | standard   | Given `import-x/no-cycle` (orchestrators-only) and the accepted `bridges/hooks/` cycle knot, when `npx fallow` checks the whole graph, then determine coverage beyond the narrower existing rule and whether the known knot can be accepted                                  | ✓ VALIDATED          | fallow, static-analysis, circular-deps, tooling                          |
| 012  | fallow-boundary-fidelity            | standard   | Given the 9-zone `no-restricted-paths` config plus custom grep-gate architecture tests, when the same rules are expressed in `.fallowrc.json`, then determine match, gap, or noise                                                                                            | ✓ VALIDATED          | fallow, static-analysis, boundaries, tooling                             |
| 013  | fallow-duplication-detection        | standard   | Given SonarCloud's configured CPD, when `npx fallow dupes` runs, then compare findings for overlap, false positives, and anything Sonar misses                                                                                                                                | ✓ VALIDATED          | fallow, static-analysis, duplication, tooling                            |
| 014  | fallow-complexity-health            | standard   | Given `sonarjs/cognitive-complexity: 15` (lint-time hard error), when `npx fallow health` runs, then compare its 0-100 scoring against cognitive-complexity findings for the same hotspots                                                                                    | ✓ VALIDATED          | fallow, static-analysis, complexity, tooling                             |
| 015  | fallow-security-candidates          | standard   | Given SonarCloud's security-hotspot view, when `npx fallow security` runs, then determine what it ranks and whether it surfaces anything Sonar doesn't                                                                                                                        | ⚠ VALIDATED (gap)    | fallow, static-analysis, security, tooling                               |
| 016  | fallow-fix-autofix-safety           | standard   | Given findings from spikes 010-015, when `npx fallow fix --dry-run` runs, then determine what it can safely auto-apply vs. what needs human judgment                                                                                                                          | ⚠ VALIDATED (gap)    | fallow, static-analysis, autofix, tooling                                |
| 017  | fallow-ci-overhead                  | standard   | Given the existing pre-commit/CI pipeline, when the full free `npx fallow audit` suite is added as a gate, then measure wall-clock cost and total redundant-vs-novel signal across spikes 010-015                                                                             | ✓ VALIDATED          | fallow, static-analysis, ci, tooling                                     |
| 018  | hooks-module-state-portability      | standard   | Given 4 module-level mutable cells in event-router.ts and 17 test files reaching its _*ForTest seams, when that state moves to a leaf module re-exported from the hub, then every seam still observes the same live state and the full check stays green | ✓ VALIDATED          | hooks, circular-deps, refactor, module-state, esm                        |
| 019a | hooks-cycle-leaf-extraction         | comparison | Given the 8-cycle bridges/hooks knot, when shared state and RoutingEntry move to a leaf and the five importers point at it, then all 8 cycles disappear and the full check stays green                                                                  | ✓ WINNER             | hooks, circular-deps, refactor, comparison                               |
| 019b | hooks-cycle-inversion               | comparison | Given the same knot, when event-router stops importing dispatch/settle/registry and they register handlers instead, then all 8 cycles disappear -- and at what cost relative to 019a                                                                    | ✗ LOSES              | hooks, circular-deps, refactor, comparison, dependency-inversion         |
| 020  | hooks-cycle-gate-closure            | standard   | Given zero cycles after 019a, when --circular-deps joins the local fallow gate, then boundary detection survives, cycles are newly caught, and npm run check stays green -- closing FLOW-02                                                             | ✓ VALIDATED          | hooks, circular-deps, tooling, gate, fallow                              |
