# Phase 9 (Legacy MCP Entry Move): Dubious Choices

The choices Phase 9 made without the user. Entries are numbered in the
milestone form `P{N}-DC-NN`, with N = 9.
Only the phase's child session writes this file: it copies each item from the
report of each step and from the `## Dubious Choices` section of each plan
SUMMARY.md. A subagent never edits this file. The parent merges it into the
root log `.planning/DUBIOUS-CHOICES.md` at the phase's merge.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
- **IDs.** `P{N}-DC-NN` is a choice of phase N; this log holds Phase 9's.

## Discuss step

The autonomous run took the recommended option at every discuss question; those answers are the decisions D-BG-901 to D-BG-907 in 09-CONTEXT.md. Three of them are judgment calls worth a review:

- **P9-DC-01 (Medium, open). "Byte for byte" read as the entries, not the file (D-BG-905).** Success criterion 2 says the user's own entries stay byte for byte. The move rewrites `mcp.json` as two-space JSON and drops comments (AFILE-04), so the scenario writes the user's servers in that form and pins each entry's content and place, not the original file's formatting.
- **P9-DC-02 (Low, open). A project-scope scenario beyond the criteria (D-BG-906).** The criteria name no scope; the phase adds one project-scope move scenario, because each scope keeps its own legacy file.
- **P9-DC-03 (Medium, open). "Servers still run" proven by the tool listing, not a model call (D-BG-904).** Under the builtin profile the extension serves the server from the record whatever the files hold, so the listing alone passes without the move there; the scenario adds the whole `mcp.json` text so it fails without the move under both profiles.

## Research step

- **P9-DC-04 (Medium, open). The unexpanded variable reference is `${ALPHA_HOME:-/srv/alpha}`.** The new Given expands `{home}` and `{agent dir}` through `expandTokens`, which throws on a plain `${NAME}`, so D-BG-905's "unexpanded `${VAR}`" uses the `${VAR:-default}` form that D-CF1-13 already uses.
- **P9-DC-05 (Low, open). Probes ran with `--parallel 1`** on the shared machine, so the measured times are single-worker times.

## Planning step

- **P9-DC-06 (Low, open). The project-scope scenario adds the marketplace to the project scope** instead of relying on the D-MF-04 adoption from the user scope; both gave the same rows and files.
- **P9-DC-07 (Low, open). The servers-run scenario does not pin the move's row.** No frozen step records a profile Pi's first session report, and the seed already pins the row.
- **P9-DC-08 (Low, open). Plan shape and checks.** One plan, three tasks in order (each edits the one feature file), one commit per task. The new Given checks its own text is two-space JSON with no marked server. One extra red proof (a move that also deletes the user's unmarked copy) runs under the adapter profile only. T-9-SC is rated low and accepted, because nothing is installed.
- **P9-DC-09 (Low, open). The pattern-mapper step was skipped,** because the research already mapped the harness with runs; the UI and AI-integration hooks did not apply.

## Execution

- **P9-DC-10 (Low, open). The new Given's wording** is `the mcp.json file of the {word} scope holds the user's own servers before the legacy move, in this text:`; it shares its opening words with the frozen release 0.19.2 step but matches no other step.
- **P9-DC-11 (Low, open). The Given's marker check uses `"_piClaudeMarketplace" in entry`** instead of the frozen step's `Object.hasOwn` filter, to avoid a `fallow dupes` clone group; for parsed JSON the two agree.
- **P9-DC-12 (Low, open). The red probe** used `if (input.scope !== ("never" as string)) return;` rather than a bare `return;`, so the rest of the function stays reachable for the type checker; it was never committed.

## Process

- **P9-DC-13 (Medium, open). Subagent dispatch.** The agent isolation guard reads the session's shared sentinel in the parent checkout, which other phases also write, so it refused `gsd-executor`. The executor ran as a `general-purpose` agent following `.claude/agents/gsd-executor.md`. Because a dispatched subagent runs asynchronously and stalls when the session's turn ends, the coordinator then had the child session do the code review, fixes, and verification inline, following `gsd-code-reviewer.md` and `gsd-verifier.md`. A second executor dispatched while the first still ran stopped without changing anything when it saw the first at work.
