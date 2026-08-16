---
spike: 016
name: fallow-fix-autofix-safety
type: standard
validates: "Given findings from spikes 010-015, when `npx fallow fix --dry-run` runs, then determine what it can safely auto-apply vs. what needs human judgment"
verdict: VALIDATED (gap)
related: [010, 013]
tags: [fallow, static-analysis, autofix, tooling]
---

# Spike 016: Fallow Autofix Safety

## What This Validates

Spike 010 found that this project's `_*ForTest`/`__test_*` test-injection
seams are correctly excluded from *production* reachability but are real,
load-bearing exports the test suite imports directly. Does `fallow fix
--dry-run` (the CLI's own auto-fix preview) know the difference before
proposing to delete them?

## Research

`fallow fix --help`: removes unused exports, dependencies, and enum
members; separately, adds `ignoreExports` rules to the fallow config for
findings it can't safely resolve as a source edit (used for the
duplicate-export category). `--dry-run` previews without writing;
`--yes` is required non-interactively. Never ran without `--dry-run` in
this spike -- no source files were modified at any point.

## How to Run

```bash
CFG=.planning/spikes/010-fallow-dead-code-signal/fallowrc-explicit-entry.json
npx --yes fallow fix -c "$CFG" --dry-run --yes --format human
```

## What to Expect

172 proposed export removals and 16 proposed config-suppression rules;
zero proposed file or dependency removals.

## Investigation Trail

**Ran `fix --dry-run` against Spike 010's explicit-entry config** (the
config that produced real signal, not the near-no-op zero-config run):
172 "Would remove export" lines.

**Counted how many are named with this project's own test-seam
convention:** 39 of 172 (23%) carry the literal `_*ForTest` or `__test_*`
naming pattern. Spot-checked one non-naming-convention example,
`GITLAB_PROVIDER` (`domain/auth-registry.ts:89`, also in the "Would
remove" list): `grep` confirms its only consumer outside the file that
defines it is `tests/domain/auth-registry.test.ts` -- the same
reachable-only-by-tests category as the named seams, just without the
naming tell. **The true "would break the test suite" count is higher than
the 23% the naming convention alone reveals.**

**None of this is hypothetical** -- `_setSpawnForTest` and
`_resetSpawnForTest` (`bridges/hooks/async-rewake/registry.ts`) are in the
172, and Spike 010 already confirmed by `grep` that
`tests/architecture/hooks-async-rewake.test.ts` and
`tests/bridges/hooks/dispatch-exec.test.ts` import and call them directly.
Applying this list unattended would delete functions the test suite
actively calls -- not a subtle risk, an immediate `node --test` failure.

**Checked what `fix` does NOT propose, despite Spike 010 confirming both
categories exist and are real:** zero "would remove file" lines (the 10
confirmed-dead barrel/orphan files from Spike 010, including
`domain/index.ts` and `orchestrators/marketplace/info.messaging.ts`, are
untouched) and zero dependency removals (the 3 confirmed-stale
devDependencies -- `memfs`, `yaml`, `@typescript-eslint/rule-tester` --
are untouched too), even though the CLI's own `--help` text describes
`fix` as handling "unused exports, dependencies, and enum members." This
run's scope was narrower than the help text's description; whether a
different flag combination unlocks file/dependency removal wasn't
explored further (would need a second pass to confirm, out of scope here).

**Checked how `fix` handles the ambiguous case instead of guessing:** for
Spike 013's duplicate-export findings in `bridges/hooks/` and its
`payloads/*.ts` siblings, `fix` did NOT attempt a source-level merge.
Instead it proposed appending 16 `ignoreExports` rules (each `"exports":
["*"]`) to the fallow config -- a conservative "I can't safely resolve
this as code, so suppress it structurally" move, in clear contrast to its
much more aggressive, unconditional handling of "unused" exports.

## Results

**Verdict: VALIDATED (gap).** `fallow fix --dry-run` is not safe to apply
unattended on this codebase. At minimum 39 of 172 proposed removals
(23%, undercounting since the convention-following name is a lower bound,
not the full set) are test-injection seams or test-only-consumed exports
that the test suite actively imports -- applying the list as shown would
break `node --test` immediately. This is the direct, concrete consequence
of Spike 010's finding: `fix` inherits `dead-code`'s
production-reachability model with no awareness of this project's test-seam
naming convention, and turns that blind spot into a destructive action
instead of just a report.

The tool isn't reckless everywhere, though: it correctly declines to
auto-resolve the duplicate-export ambiguity from Spike 013, deferring to a
config suppression instead of guessing which of several per-module
`translate` functions to keep. And within this run it never touched whole
files or `package.json` dependencies, even though both categories had
confirmed, real findings in Spike 010 -- a narrower blast radius than the
help text implies, though not verified across every possible flag
combination.

**Any real adoption of `fallow fix` here would need,** at minimum, an
`ignoreExports` allowlist covering every `_*ForTest`/`__test_*` seam (and
any un-prefixed test-only export like `GITLAB_PROVIDER`) authored and
verified *before* the first unattended run -- not generated by the tool
itself, which has no way to know the convention exists.

**Tooling footnote:** `fallow fix --dry-run --format json -o <path>`
wrote a 0-byte file in this version (v3.16.0) -- `-o`/`--output-file`
works for every other subcommand exercised in this spike series but not
this one. Worked around with a shell `>` redirect instead.
