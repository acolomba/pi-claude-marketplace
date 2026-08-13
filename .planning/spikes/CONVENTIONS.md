# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes
follow these unless the question requires otherwise.

## Stack

For internal-architecture questions (no external library/API involved),
spikes run as plain `.ts` scripts executed directly via `node script.ts`
(Node 26 native TS stripping, matches the project's own no-build-step
convention). No test framework, no fixtures directory -- a spike script is
throwaway, not a permanent test.

## Structure

One spike = one directory `NNN-descriptive-name/` with a `README.md` and,
when the question warrants a runnable check, a flat script file
(`prototype.ts`, `dep-check.sh`) alongside it. No `src/`/`lib/` nesting for
single-file spikes.

## Patterns

**Audit method (grep, then verify the call graph):** for "is this code
still load-bearing / still legacy-only" questions, a broad `grep -rniE`
sweep always over-matches (comments mentioning the term, unrelated
subsystems reusing the word "legacy"/"migrat" for something else). Narrow
by reading each hit's actual call sites, not by trusting the comment next
to it. Confirm with a small shell script (`dep-check.sh` in spike 001) that
greps for callers of the specific function/constant in question, run from
the spike directory so the check is reproducible.

**Prototype against the real module, not a mock:** when validating a
detection mechanism (e.g. "does this validator reject this shape"), import
the actual production module (`STATE_VALIDATOR` from `state-io.ts` in
spike 003) rather than reimplementing its logic in the spike. A mock would
only prove the mock's own assumptions; importing the real export proves
the claim against what actually ships.

**Trace the "then what," not just the "is it dead":** an audit that stops
at "this code is unreachable from the live write path" (spike 001) is not
the same question as "is it *safe* to delete" (spike 002 found the
opposite answer for a structurally similar-looking file). Always trace one
step further: what does the calling code do on the path this code
currently prevents from being taken.

## Tools & Libraries

No new dependencies introduced. Spikes in this project import directly
from `extensions/pi-claude-marketplace/` using the same relative-path,
`.ts`-extension import style as `tests/`.
