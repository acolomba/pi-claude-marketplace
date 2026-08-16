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

**Predict before running, for hand-written parsers:** for a character-level
cascade parser (`domain/source.ts`'s `parsePluginSource`, deliberately
hand-written per D-06 -- TypeBox is not a fit for that job), read the whole
function end to end and write down a branch-by-branch prediction for each
probe input BEFORE running anything, then confirm/refute against that
prediction. A `grep`-first approach reliably misses branch-order
interactions in a cascade like this (spike 008).

**Architecture-vs-wiring split:** when a spike question turns out to be "is
the underlying mechanism generic, or is a specific integration point just
not wired up yet," say so explicitly and size the two halves separately --
they are usually different-sized follow-ups. Spike 009: the auth-provider
lookup mechanism was already fully host-generic (a same-day fix), while the
host-named hint string was wired into only one of five call sites (a
separate, still-open follow-up, BACKLOG.md GAUTH-01).

**External CLI-tool spikes run against the real repo root, never a
fixture:** for "would we benefit from tool X" questions (spikes 010-017,
`fallow`), install nothing into `package.json` -- run via `npx <tool>`
with `-r`/`--root` and `-c`/`--config` pointing at the actual project, and
write outputs into the spike directory (`-o <path>`, or a shell `>`
redirect when a subcommand's `-o` flag turns out not to work -- spike 016
found `fallow fix --dry-run --format json -o <path>` silently wrote a
0-byte file while every other subcommand's `-o` worked correctly). The
real codebase is the fixture; a synthetic one only proves the tool works
on toy input, not on this project's actual entry points, naming
conventions, and known-accepted exceptions.

**Verify a detection mechanism's negative case, not just its positive
one, by planting a deliberate temporary violation and reverting with `git
checkout --`:** a clean run alone doesn't prove a detector works -- it
might be silently misconfigured or scoped narrower than intended. Spike
012 (`fallow` boundary config): a first attempt at planting a violation in
a *new, unreferenced* file produced a false "no issues" because the
checker only examines the entry-point-reachable subgraph; only planting
the same violation inside an already-reachable file proved the config
actually worked. Always revert with `git checkout -- <file>` immediately
after the check, before moving to the next probe.

**A tool's zero-config defaults will silently miss whatever the project's
own conventions changed:** before trusting any finding from a newly
adopted static-analysis tool, check its default entry-point/reachability
model, dependency assumptions (e.g. `node_modules` presence), and naming
conventions against what the project actually does. Spike 010: zero-config
`fallow` couldn't see this project's `pi.extensions` custom entry point and
fell back to autopromoting nearly every file to its own entry, making
dead-code detection close to a no-op until an explicit `entry` config was
authored by hand. Spike 016: applying the same tool's autofix suggestions
unattended would have deleted dozens of `_*ForTest`/`__test_*` test-seam
exports the tool has no way to recognize as intentional. This generalizes
the existing "audit method" pattern above (verify by reading the call
graph, not by trusting a claim) to third-party tool output specifically,
not just internal legacy-code audits.

## Tools & Libraries

No new dependencies introduced. Spikes in this project import directly
from `extensions/pi-claude-marketplace/` using the same relative-path,
`.ts`-extension import style as `tests/`.

**External CLI tools evaluated via spike are run through `npx`, never
added as a `package.json` dependency** -- even a favorable verdict (spikes
010-017, `fallow` v3.16.0) doesn't warrant adding the tool until a real
adoption decision is made outside the spike process.
