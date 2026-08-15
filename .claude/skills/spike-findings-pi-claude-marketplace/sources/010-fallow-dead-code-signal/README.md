---
spike: 010
name: fallow-dead-code-signal
type: standard
validates: "Given the real repo's Pi-extension entry points and barrels, when `npx fallow dead-code` runs, then determine signal-to-noise: real dead code vs. false positives from invisible entry points"
verdict: VALIDATED (gap)
related: []
tags: [fallow, static-analysis, dead-code, tooling]
---

# Spike 010: Fallow Dead-Code Signal

## What This Validates

Given the real pi-claude-marketplace repo -- a Pi extension with no bundler,
a custom `pi.extensions` package.json field as its real entry point, and
444 `node:test` files run directly (no recognized test-runner config) --
when `npx fallow dead-code` runs, then determine whether it produces real,
actionable dead-code findings or drowns in false positives/negatives from
entry points it can't see.

## Research

Fallow (`fallow-rs/fallow`, MIT, v3.16.0) is a Rust CLI installable via
`npx fallow` with no project changes required. `fallow dead-code` reports
unused files/exports/types/dependencies plus circular deps and boundary
violations in one pass. `fallow recommend` proposes a starter
`.fallowrc.json`; `fallow list --entry-points` shows what it resolved as
graph roots. No context7 entry exists for this tool; research came from
`fallow.tools/docs`, the `fallow-rs/fallow` GitHub README, and the shipped
`--help` output (the CLI's own `--help` turned out to be the most accurate
and complete source -- richer than either docs site).

## How to Run

```bash
bash .planning/spikes/010-fallow-dead-code-signal/run-dead-code.sh
```

## What to Expect

Two runs: a zero-config run (near-silent, ~13 issues) and an
explicit-entry-point run (307 issues), followed by ground-truth `grep`
checks against three of the flagged "unused files."

## Investigation Trail

**First run, zero config:** `fallow dead-code --summary` reported "444
entry points detected (443 plugin, 1 package.json)" and only 13 total
issues (2 unused files, 3 unused dev deps, 8 circular deps) across 446
discovered files. That entry-point count looked wrong for a project with
one real entry (`extensions/pi-claude-marketplace/index.ts`, wired via
`pi.extensions` in `package.json` -- not a field Fallow recognizes).

**Cross-checked against `fallow list --entry-points`:** it reported "Found
2 entry points" -- both `eslint.config.js` (via package.json script and
via the eslint plugin). This directly contradicts the "444" preamble from
`dead-code`. Conclusion: `dead-code`'s "443 plugin" entries are a
conservative fallback -- when no real entry graph exists, it appears to
autopromote nearly every file (443 of 446) to its own entry point so nothing
gets falsely called dead. That fallback makes the zero-config run nearly a
no-op: dead-code detection needs a real entry point to mean anything.

**Tried `fallow recommend`:** "Detected frameworks: none detected" --
proposed `src/index.{ts,tsx,js,jsx}` / `src/main.{ts,tsx,js,jsx}`, neither
of which exists in this repo. The tailored-config generator has no
Pi-extension framework plugin and would silently point an agent at
nonexistent files if accepted uncritically.

**Authored an explicit config by hand**
(`fallowrc-explicit-entry.json`: `entry:
["extensions/pi-claude-marketplace/index.ts"]`, `production: true`) and
reran. Entry-point count dropped to the honest "2" (1 manual + 1
package.json), and dead-code detection came alive: 307 issues (10 unused
files, 190 unused exports, 93 unused types, 1 unused class member, 5
duplicate exports, 8 circular deps).

**Ground-truthed a sample of the 307 by hand** (`grep` for actual import
statements, not just keyword mentions -- keyword grep on "rollback"
initially looked like a false positive until narrowed to real `from
".../rollback.ts"` imports):

- `domain/index.ts`, `edge/index.ts`, `orchestrators/**/index.ts`,
  `persistence/index.ts` (7 of the 10 "unused files") -- **confirmed real.**
  Zero importers anywhere, including tests. `ARCHITECTURE.md` documents
  `domain/index.ts` as "a barrel for the domain layer," but nothing
  actually imports it -- every consumer imports submodules directly.
- `transaction/index.ts` -- **confirmed real, and reveals doc/code drift.**
  Its own header comment claims "The install/update/uninstall orchestrators
  consume this module" (citing D-02), but `grep` of `install.ts`,
  `update.ts`, etc. shows they import `runPhases`/`withStateGuard` directly
  from `phase-ledger.ts`/`with-state-guard.ts`, never through the barrel.
  The comment is stale.
- `transaction/rollback.ts` -- **confirmed real under the "production
  reachability" definition.** Its only consumer besides the (also-dead)
  barrel is `tests/transaction/rollback.test.ts`. Fallow's `production:
  true` mode correctly separates "reachable from production" from
  "reachable including tests" -- this is the tool doing exactly what it
  claims, not a bug.
- `orchestrators/marketplace/info.messaging.ts` -- **confirmed real, and
  the most valuable single finding of this spike.** No file imports it. A
  genuinely orphaned messaging module, invisible to every existing gate
  (ESLint's `no-unused-vars` only checks within-file, and nothing in this
  project's tooling checks whole-graph reachability).
- **`_setSpawnForTest` / `_resetSpawnForTest`-family exports** (flagged
  under "unused exports" in `bridges/hooks/async-rewake/registry.ts`) --
  **false positive if acted on naively.** These are deliberate
  test-injection seams (the project's own `^_` unused-vars convention,
  extended here to exported test hooks), imported only by
  `tests/architecture/hooks-async-rewake.test.ts` and
  `tests/bridges/hooks/dispatch-exec.test.ts`. `production: true` excludes
  test files from the *consumer* graph but still flags exports whose only
  consumers were excluded -- correct as a "not needed in production" signal,
  but a naive "delete unused exports" pass would break the test suite.
  Fallow has no built-in convention-awareness for `_*ForTest` naming; a
  human/agent must filter these before acting.
- **Duplicate `_setSpawnForTest`/`_resetSpawnForTest` across
  `async-rewake/registry.ts` and `dispatch-exec.ts`** -- confirmed real
  (both files independently define functions with these exact names). Not
  necessarily a bug, but a genuine, previously-unknown duplication signal.
- **`translate` flagged as a duplicate export** between
  `post-compact.ts` and `post-tool-use-failure.ts` -- **false positive by
  design.** All 10 files in `bridges/hooks/payloads/` export a function
  named `translate` as a deliberate per-event-type interface (the same
  "one name, N sibling implementations" pattern `ARCHITECTURE.md` documents
  for the bridge stage/commit/unstage triplet). Fallow only surfaced one of
  the ~45 possible pairs, suggesting the rule dedupes somehow, but the
  underlying signal is architecturally intentional, not a collision to fix.
- **3 "unused devDependencies"**: `@typescript-eslint/rule-tester`,
  `memfs`, `yaml` -- **confirmed real, and the most surprising finding.**
  Broad `grep` across `extensions/` and `tests/` found zero real imports of
  any of the three; `yaml` appears only inside a *comment* in
  `platform/pi-api.ts`. This directly contradicts this repo's own
  `STACK.md` (dated 2026-08-07), which describes `memfs` as used "for
  platform/persistence tests" and `yaml` as used for "parsing Claude
  plugin/marketplace YAML manifests." Either both packages were removed
  from active use after that doc was written, or the doc was wrong when
  written -- either way, nothing in the existing toolchain (ESLint,
  SonarCloud) checks package.json against actual imports, so this went
  unnoticed. (Not fixed here -- out of scope for a spike -- but worth a
  follow-up.)

## Results

**Verdict: VALIDATED (gap).** Fallow's dead-code detection is genuinely
useful and found real issues nothing else in this project's stack catches
-- but only *after* manual correction of a zero-config default that is
close to a no-op on this codebase, and even then roughly 2 of every ~10
flagged files/exports in this run were false positives if interpreted as
"safe to delete" (deliberate test seams, an interface-name convention)
rather than "not reachable from a production entry point."

**Signal-to-noise breakdown (this run, 307 total findings):**
- **High-confidence real** (~10-15%): orphaned barrels
  (`domain/index.ts`, `transaction/index.ts`, 5 more), one fully orphaned
  messaging module (`info.messaging.ts`), 3 genuinely stale devDependencies.
- **True-but-needs-context** (majority of the 190 unused exports/93 unused
  types): reachable only from test files under `production: true` --
  correct as stated, but requires knowing that distinction before acting.
- **False positive by design** (small but real): `_*ForTest` seams,
  intentional same-name-per-module interfaces (`translate`).

**What would make this trustworthy for this project specifically:**
1. `entry` must be set explicitly in `.fallowrc.json` --
   `fallow recommend`'s zero-config default is actively wrong here (points
   at nonexistent `src/index.ts`).
2. `production: true` findings need a second pass distinguishing "no
   production consumer" from "test-only by design" -- this project's
   `^_`-prefixed test-seam convention isn't something Fallow knows about.
3. Barrel-file findings (`domain/index.ts` and siblings) are the strongest,
   cleanest signal: whole-file zero-importer dead code is exactly the gap
   ESLint's `no-unused-vars` can't fill, and every barrel flagged here was
   a true positive.
