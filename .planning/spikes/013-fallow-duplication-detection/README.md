---
spike: 013
name: fallow-duplication-detection
type: standard
validates: "Given SonarCloud's configured CPD, when `npx fallow dupes` runs, then compare findings for overlap, false positives, and anything Sonar misses"
verdict: VALIDATED
related: [010]
tags: [fallow, static-analysis, duplication, tooling]
---

# Spike 013: Fallow Duplication Detection

## What This Validates

`sonar-project.properties` excludes exactly 3 files from SonarCloud's CPD
gate (`bridges/agents/stage.ts`, `bridges/commands/stage.ts`,
`orchestrators/plugin/shared.ts`), implying the team already made a
deliberate call that some duplication is architecturally acceptable and
not worth flagging. Does `fallow dupes` reproduce that same signal, and
does it find anything Sonar's configured gate currently misses?

## Research

`fallow dupes --help` documents detection modes (`strict`/`mild` default/
`weak`/`semantic`), `--min-tokens`/`--min-lines`/`--min-occurrences`
thresholds, and `--ignore-imports` (on by default -- module wiring doesn't
count as a clone). No config authored for this spike; ran with defaults
against the real repo.

## How to Run

```bash
npx --yes fallow dupes --format human --top 20
```

## What to Expect

3.6% duplication, 66 clone groups across 59 files, including the 3
Sonar-excluded files plus several groups Sonar's exclusion list doesn't
mention.

## Investigation Trail

**Zero-config `fallow dupes` run:** 51 clone families, 66 clone groups,
2,240 duplicated lines, 3.6% duplication rate. Notably: "skipped 229 files
matching default duplicates ignores" -- consistent with Sonar-style
default test-file exclusion, not investigated further (out of scope; the
comparison target is Sonar's *production*-code CPD gate).

**Cross-checked against Sonar's 3 excluded files:** both
`bridges/agents/stage.ts ↔ bridges/commands/stage.ts` (26-line clone) and
`orchestrators/plugin/shared.ts` (19-line self-clone) appear in Fallow's
top-ranked groups. Independent confirmation the Sonar exclusion list
targets real, verifiable duplication -- not an arbitrary carve-out.

**Found duplication Sonar's exclusion list does NOT cover, and verified
it by reading the actual source (not just trusting the tool's line
numbers):**
- `install.messaging.ts:95-104` vs `list.messaging.ts:124-133` -- read
  both: **verbatim identical**, including an inline `MSG-PL-6 / SNM-11`
  comment reproduced word-for-word in both files. A 4-instance clone family
  spans `execute.messaging.ts`, `fetch.messaging.ts`,
  `install.messaging.ts`, `list.messaging.ts` at 10 lines each, plus a
  3-instance and a 2-instance group covering overlapping spans in the same
  files. This is the exact same "per-verb sibling file, same shape"
  pattern as the Sonar-excluded `bridges/*/stage.ts` pair -- `*.messaging.ts`
  files are architecturally the messaging counterpart to bridges'
  stage/commit/unstage triplet (`ARCHITECTURE.md`) -- but they aren't in
  the exclusion list. Either genuine unreviewed duplication debt, or the
  exclusion list is simply stale relative to the project's own "structurally
  parallel per-verb code is fine" precedent.
- `edge/handlers/plugin/{info,list,pending}.ts:` a 13-line, 3-instance
  clone -- same per-verb-handler pattern, one layer up.
- `persistence/migrate.ts` self-duplication (13 lines, two spans in the
  same file).
- `shared/notify.ts` self-duplication (15 lines, lines 3669-3681 vs.
  3733-3747 -- confirmed real by `wc -l` (file is 3,932 lines; both
  ranges exist) then read both blocks directly. **This one is a false
  positive for "extract shared function":** the two blocks build a
  cascade-notification body almost identically, but one applies a
  `blocks.length === 0 ? "(no marketplaces)" : ...` sentinel and the other
  deliberately does not, with an inline comment explaining why ("Empty
  cascade -> "" (NOT the `(no marketplaces)` sentinel): the no-op headline
  alone is the never-silent output"). Fallow's "Extract shared function"
  suggestion (in the Clone Families section) would erase a documented,
  intentional behavioral difference if followed blindly.

## Results

**Verdict: VALIDATED.** `fallow dupes` reproduces Sonar's existing CPD
signal (independently re-finding both files behind its 3 exclusions) and
surfaces real, verified duplication Sonar's exclusion list doesn't mention
-- most notably a verbatim 4-file clone across `*.messaging.ts` siblings
that mirrors an already-accepted pattern one directory over. That's
genuine value: either extract the shared block, or extend the exclusion
list deliberately instead of by omission.

The `notify.ts` self-duplication case is an important caution, not just a
one-off: Fallow's clone detector works on structural/token similarity and
cannot see that a project comment marks two near-identical blocks as
*intentionally* different. Every "Extract shared function" suggestion
needs a human read of the surrounding comments before acting, exactly like
Spike 010's `_*ForTest` seams needed a convention-aware filter before
trusting "unused."
