# Fallow Codebase-Intelligence Adoption

Implementation blueprint for adopting `fallow` (`fallow-rs/fallow`, MIT,
v3.16.0 at spike time) in this project.

**Status: adopted.** Fallow is a pinned devDependency, `.fallowrc.json`
sits at the repo root, and the gate runs at every point ESLint runs --
the `npm-fallow` pre-commit hook, `npm run check`, `ci.yml` via that
check, and the `lint.yml` pre-commit job -- plus a `fallow audit` job on
pull requests. What follows is the reasoning behind that configuration,
not a proposal. Sections below that read as forward-looking ("if a
future session decides to") describe decisions already taken.

## Requirements

- Fallow is a pinned devDependency (`^3.16.0`), not an `npx --yes`
  invocation. The spike series ran it through `npx` under the "spikes
  introduce no new dependencies" convention and recorded the unpinned
  binary as an accepted risk; the adoption decision reversed that,
  because an unpinned `npx --yes` would fetch and execute a future
  fallow major on a CI runner with no review. Pinning also makes the
  pre-commit hook viable -- under `npx --yes` it would re-resolve the
  package on every commit.
- Any config or CI wiring MUST NOT be trusted zero-config -- Fallow's
  defaults are close to a no-op on this codebase (see below) and its own
  `fallow recommend` proposes a config that doesn't fit this project at
  all.
- Any `fallow fix` usage MUST run with `--dry-run` first and MUST NOT run
  unattended without a pre-authored `ignoreExports` allowlist -- it will
  otherwise delete load-bearing test-only exports.

## How to Build It

### 1. Author an explicit entry-point config first -- do not skip this

Zero-config `fallow dead-code` can't see this project's real entry point
(`package.json`'s `pi.extensions` field, pointing at
`extensions/pi-claude-marketplace/index.ts` -- not a field Fallow
recognizes). Without an explicit `entry`, it falls back to autopromoting
~443 of 446 files to their own entry point, which makes dead-code
detection close to a no-op (only 13 issues found zero-config vs. 307 with
the config below). `fallow recommend` doesn't fix this -- it proposes
`src/index.ts`, which doesn't exist here.

```json
{
  "entry": ["extensions/pi-claude-marketplace/index.ts"],
  "production": true
}
```

`production: true` excludes test files from being treated as entry
points, which is what surfaces real dead code instead of everything
looking "used" because a test imports it.

### 2. Triage `dead-code` findings by category before trusting any of them

Run `fallow dead-code -c <config> --format human` (or `--unused-files`
for the cleanest signal). Categorize before acting:

- **Whole unused FILES: trust these.** Every barrel/orphan file flagged
  in spike 010 (`domain/index.ts`, `edge/index.ts`,
  `orchestrators/{,import/,marketplace/,plugin/}index.ts`,
  `persistence/index.ts`, `transaction/{index,rollback}.ts`,
  `orchestrators/marketplace/info.messaging.ts`) was confirmed a true
  positive by grep -- zero real importers anywhere, including tests. This
  is the strongest, cleanest signal Fallow provides and the one gap none
  of this project's existing tooling (ESLint's file-local
  `no-unused-vars`, SonarCloud) fills at all.
- **Unused exports named `_*ForTest` or `__test_*`: false positives if
  acted on.** These are this project's own test-injection-seam
  convention. `production: true` correctly excludes test files from the
  *consumer* graph, so these show as "unused" -- but the test suite
  imports them directly. Before trusting an "unused export" finding,
  check the name against this pattern and grep its actual usage.
- **Unused exports with no naming tell (e.g. `GITLAB_PROVIDER`,
  `STATE_VALIDATOR`): same risk, no free signal.** Spike 016 confirmed
  `GITLAB_PROVIDER`'s only consumer is its own unit test file, with no
  naming convention to flag it. Every "unused export" needs a `grep` for
  real importers before it's treated as safe to remove -- the naming
  convention only catches some of them.
- **Unused devDependencies: trust these, they were confirmed real.**
  `memfs`, `yaml`, `@typescript-eslint/rule-tester` are listed in
  `package.json` but have zero real imports anywhere in `extensions/` or
  `tests/` -- confirmed by broad grep. This also revealed `STACK.md`
  (dated 2026-08-07) is stale where it describes `memfs`/`yaml` as
  actively used. Worth a follow-up doc fix, not done as part of this
  spike series.

### 3. Circular-dependency detection is free and config-independent -- add it as a regression guard

`fallow dead-code --circular-deps` gives identical results zero-config or
with the entry config above, and on this codebase it finds exactly the
single, already-documented `bridges/hooks/` cycle knot
(`ARCHITECTURE.md`'s own words: "event-router.ts ↔ dispatch.ts ↔
async-rewake/registry.ts"). No new discoveries, no false positives. Its
value is turning a fact currently enforced only by prose plus a narrower
`orchestrators/`-only ESLint rule into something a CI gate can actually
check: if the known knot ever grows, or a cycle appears anywhere else,
this catches it immediately.

As adopted, this is covered in CI but not locally. `fallow audit`
reports `circular_dependencies` and `re_export_cycles` under its default
`gate: new-only` attribution, so a newly introduced cycle fails a pull
request while the 8 inherited ones pass. The local `npm run fallow`
passes `--boundary-violations`, which isolates the run to boundaries and
therefore never looks at cycles. Gating them locally needs either a
baseline or an explicit acceptance of the existing knot -- see
BACKLOG.md FLOW-02.

It does NOT catch D-11's actual highest-value invariant -- a
one-directional "must not import" ban between the plugin and marketplace
ledgers, which doesn't require a full cycle. That needs boundary config
(next).

### 4. Boundary config: port by reading ESLint's `message` fields, not by inverting the deny-lists

Fallow's `boundaries` config is **allow-based**
(`{from: "zone", allow: ["zone", ...]}`); this project's
`import-x/no-restricted-paths` is **deny-based**
(`{target: "zone", from: ["zones that must NOT import target"]}`). Don't
try to mechanically invert the deny-lists -- read each ESLint zone's
`message` string instead, which already states the positive allow-list in
prose. An 8-zone config matching `eslint.config.js` 1:1 reproduces the
existing gate exactly (zero violations on the clean codebase; catches a
planted violation in reachable code -- verified by probe-and-revert, see
`sources/012-fallow-boundary-fidelity/`).

A **finer 12-zone variant** (one zone per bridge kind --
`bridges-agents`, `bridges-commands`, `bridges-mcp`, `bridges-skills`,
`bridges-hooks` -- instead of one `bridges` zone) additionally catches
"cross-bridge imports forbidden," a rule `eslint.config.js`'s own
`bridges` zone `message` field claims ("Cross-bridge imports are also
forbidden") but that nothing in this codebase's actual ESLint rules or
architecture tests enforces today -- confirmed by testing a planted
`bridges/agents/` → `bridges/mcp/` import against both ESLint (passes,
only an unrelated `import-x/order` warning) and the fine-grained Fallow
config (correctly caught). This is real, previously unknown enforcement
drift, worth closing.

**Boundary checking is reachability-gated** (inherits the same model as
dead-code) -- a violation in a file unreachable from `entry` is invisible
to Fallow but would still be caught by ESLint's glob-based,
reachability-blind rule. Fallow should complement the existing ESLint
gate, not replace it. See `sources/012-fallow-boundary-fidelity/` for
both configs (`fallowrc-boundaries.json`,
`fallowrc-boundaries-finegrained.json`).

### 5. Duplication and complexity: works out of the box, but needs the same false-positive discipline

`fallow dupes` (zero config needed) reproduces SonarCloud's existing CPD
signal (independently re-finds duplication in both files behind Sonar's
3-file `sonar.cpd.exclusions` list) and finds one real, verified,
unlisted clone: a verbatim 4-file duplicate across
`orchestrators/{plugin,import}/*.messaging.ts` siblings -- the same
"per-verb parallel file" pattern as the already-excluded
`bridges/*/stage.ts` pair, just never added to the exclusion list. But it
also flags things that are duplicated *by design*: a `shared/notify.ts`
self-duplication that a code comment explicitly marks as intentionally
different behavior. Read the surrounding comments before proposing any
"extract shared function" refactor from a dupes finding.

`fallow health` finds real, currently-uncovered metrics -- this project's
ESLint config has no cyclomatic-complexity rule at all (only cognitive
complexity, via `sonarjs/cognitive-complexity: 15`), so cyclomatic
complexity, function unit-size (434 functions over 60 lines in this
codebase), and file-level maintainability index are entirely new signal.
Its top complexity findings will exactly match the 8 functions this
project already has `// eslint-disable-next-line
sonarjs/cognitive-complexity` comments for (e.g. `installPlugin` at
cognitive 49, documented as an intentional "audited flow" per PI-1..15)
-- that's not a gap, Fallow just can't see ESLint's suppression comments,
so a real adoption needs its own `fallow-ignore-next-line` pass mirroring
those 8. `--coverage-gaps` is a materially weaker claim than it sounds
(static test-reachability, not runtime line coverage); CRAP/file-risk
scores need real coverage data wired in via `--coverage
<coverage-final.json>` (Istanbul format), which this project's `lcov`
output doesn't directly provide -- a real conversion step, not a flag.

### 6. Security: skip it for this codebase specifically

`fallow security`'s 131 candidates on this codebase were 96%
path-traversal, and every one manually verified (all 5 non-path-traversal
candidates plus a representative path-traversal case) was a confirmed
false positive -- 3 of them defended by code visible right next to the
flagged line (regex-escaping in `shared/vars.ts` and
`bridges/agents/convert.ts`, a hardcoded-provider-registry URL in
`domain/github-auth.ts`'s two SSRF flags). SonarCloud's zero-open-hotspot
state stands; nothing here is new signal. This is specific to how
well-documented this codebase's safety invariants already are in
comments -- the tool itself is honest about being unverified candidates,
not broken, it's just low-value here.

### 7. CI/performance: not a blocker at any point in this adoption

Every command measured (full combined scan ~1.2s, full security scan
~1.1s, `fallow audit --changed-since main` against a real 18-file branch
diff ~2.5s) is negligible against this project's ~3m11s `npm run check`.
`audit`'s new-vs-inherited attribution is real, not just documented: it
correctly excluded the 3 known-stale devDependencies from a branch's gate
verdict as pre-existing rather than failing the PR for them. The entire
adoption cost here is upfront configuration and convention-teaching, not
runtime.

## What to Avoid

- **Never run `fallow fix` without `--dry-run`, and never run it
  unattended without a pre-authored `ignoreExports` allowlist.** In a
  real run against the explicit-entry config, `fix --dry-run` proposed
  172 export removals; at least 39 (23%, a lower bound -- the true count
  is higher since some test-only exports like `GITLAB_PROVIDER` don't
  follow the naming convention) are test-injection seams or other
  test-only-consumed exports the suite actively imports. Applying that
  list would break `node --test` immediately.
- **Don't trust `fallow recommend`'s proposed config.** It detected "no
  framework" for this project and proposed `entry: ["src/index.ts",
  "src/main.ts"]`, neither of which exists here.
- **Don't treat a zero-config run as representative of anything except
  "is the CLI installed correctly."** The "444 entry points (443 plugin,
  1 package.json)" preamble on a zero-config `dead-code` run is a
  red flag, not a healthy signal, for a project without a bundler.
- **Don't run any command that needs `node_modules` from inside a linked
  git worktree without pointing `--root` at a checkout that has it** --
  `.worktrees/*` don't get their own `node_modules`, and some rules (not
  circular-deps, confirmed identical either way) print a "for accurate
  results" warning.

## Constraints

- Fallow's own docs site (`fallow.tools/docs`, `docs.fallow.tools`) was
  measurably less complete and occasionally inconsistent with the actual
  shipped CLI (e.g. the docs page couldn't say for certain whether
  `fallow security` is free or paid) -- `fallow --help` / `fallow <cmd>
  --help` / `fallow config-schema` were the more reliable sources
  throughout this spike series.
- `fallow fix --dry-run --format json -o <path>` silently wrote a 0-byte
  file in this version (v3.16.0); every other subcommand's `-o` worked.
  Use a shell `>` redirect for that one until/unless this is fixed
  upstream.
- No CSS files and no feature-flag code exist in this repo, so Fallow's
  design-system-drift and feature-flag-branch capabilities have nothing
  to analyze here -- not evaluated, not a gap, just not applicable to a
  CLI extension with no styling and no flags.

## Origin

Synthesized from spikes: 010, 011, 012, 013, 014, 015, 016, 017
Source files available in: `sources/010-fallow-dead-code-signal/`,
`sources/011-fallow-circular-deps/`, `sources/012-fallow-boundary-fidelity/`,
`sources/013-fallow-duplication-detection/`,
`sources/014-fallow-complexity-health/`,
`sources/015-fallow-security-candidates/`,
`sources/016-fallow-fix-autofix-safety/`, `sources/017-fallow-ci-overhead/`
