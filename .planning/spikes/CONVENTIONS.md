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
currently prevents from being taken. Applies beyond dead-code audits too
-- spike 005 found a field silently dropped by one renderer, then traced
whether any *other* surface (install, list) picked up the slack before
concluding the information was lost entirely.

**Read the schema before hand-building a fixture, don't guess-and-fail:**
when a live prototype needs an on-disk `state.json`/`marketplace.json`
fixture, read the actual TypeBox schema (`*_SCHEMA` constants in
`persistence/state-io.ts` / `domain/components/*.ts`) for the exact
required-field set and nested shapes first. Guessing a plausible-looking
shape (spike 005 initially guessed `{ type, path }` for a marketplace
`source`, and omitted several `MARKETPLACE_RECORD_SCHEMA` required fields)
costs a run-fail-read-schema-retry cycle per wrong guess; reading the
schema first is strictly faster once a spike exercises persistence, not
just domain logic.

**Verify external research claims from primary sources, not search
summaries:** for spikes researching an external product's current
behavior (spike 004, the first spec-research spike in this project), an
auto-generated WebSearch summary can conflate an old, superseded
feature-request issue with a newer bug-fix issue and produce a confidently
wrong answer. Fetch the actual doc pages and, for any GitHub issue used as
corroborating evidence, its full body + state (open/closed) + date --
dates alone can resolve an apparent contradiction between two issues.
Prefer the official reference docs as the authoritative source; treat
issues/trackers as corroborating signal only.

## Tools & Libraries

No new dependencies introduced. Spikes in this project import directly
from `extensions/pi-claude-marketplace/` using the same relative-path,
`.ts`-extension import style as `tests/`.
