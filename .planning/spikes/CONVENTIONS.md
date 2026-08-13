# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes
follow these unless the question requires otherwise.

## Stack

For internal-architecture questions (no external library/API involved),
spikes run as plain `.ts` scripts executed directly via `node script.ts`
(Node 26 native TS stripping, matches the project's own no-build-step
convention). No test framework, no fixtures directory -- a spike script is
throwaway, not a permanent test.

**Deviation for Pi-extension-UI questions (spikes 006-007):** a question
about `ctx.ui` behavior (footer status, widgets, custom modal components)
cannot be answered by a plain `node script.ts` run -- there is no terminal
UI to observe outside a real interactive `pi` session. These spikes ship a
runnable extension file (`extension.ts`, loaded via `pi -e <path>`)
registering one or more `/spike-*` commands, plus two layers of
verification: an automated non-interactive smoke test
(`pi -e ./extension.ts --print --no-session --offline "/command args"`,
checking only exit code and stderr) to catch import/type/crash errors
before asking for a human's time, and a human-in-the-loop checkpoint in a
real `pi` session for the actual visual behavior. Load every related
`extension.ts` into one session with multiple `-e` flags (`pi -e a.ts -e
b.ts -e c.ts`) rather than asking the user to restart `pi` per spike.

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
the same question as "is it _safe_ to delete" (spike 002 found the
opposite answer for a structurally similar-looking file). Always trace one
step further: what does the calling code do on the path this code
currently prevents from being taken. Applies beyond dead-code audits too
-- spike 005 found a field silently dropped by one renderer, then traced
whether any _other_ surface (install, list) picked up the slack before
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

**For a host-API behavior question, read the shipped runtime, not just its
`.d.ts`:** `.d.ts` files document the intended contract, not what the code
actually does at every edge. Spike 006 needed to know whether
`ctx.ui.setStatus()` triggers a repaint from inside a bare `setTimeout`
callback with no keystroke or LLM-stream tick involved -- something no
`.d.ts` comment states either way. Grepping the actual shipped `.js` in
`node_modules/@earendil-works/pi-coding-agent/dist/` found
`setExtensionStatus()` calling `this.ui.requestRender()` unconditionally,
which settled the question before a human ever had to watch a terminal.
The same read caught a real type-signature lie: `ctx.ui.custom<T>()` is
typed `Promise<T>` with no `| undefined`, but resolves to `undefined` when
`ctx.hasUI` is false (json/print modes) -- only visible by testing the
non-interactive path, not by reading the type.

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
