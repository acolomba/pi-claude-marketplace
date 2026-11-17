# Phase 4 — Probe Coverage Record

No external API integration: the phase changes four local behaviors of an existing Pi extension (skill selection, sibling links, workflow references, an install note) and adopts no new API, SDK, or service.

The workflow engine and pi-subagents appear only as local companions of the test harness. The request to pi-dynamic-workflows is a draft file; nothing is sent.

## Edge coverage (spec-less fallback)

No phase SPEC exists, so the plan-phase fallback ran the deterministic edge probe over the four requirement texts of `REQUIREMENTS.md`. It proposed 11 applicable rows, one of them unclassified. Each row is resolved here by the `--auto` rules: a row with a defensible acceptance criterion is resolved with explicit verification and lifted into `must_haves.truths` as a plain string; an unclassified row stays unresolved and becomes a flagged assumption. No row is dismissed, and no row needed a backstop.

| Requirement | Category | Probe | Status | Verification | Acceptance criterion (the lifted truth) | Lifted to |
|---|---|---|---|---|---|---|
| PG-CORE-01 | adjacency | When two things are exactly equal or just touch, do they merge, collide, or separate? | resolved | explicit | Listing the plugin root or `skills/` on a root-source entry keeps the `skills/` folder and collects it once, and two spellings of one listed folder collect once. | 04-01 truths; owner cases in 04-01-01 |
| PG-CORE-01 | empty | What is the result for empty, single-element, or null input? | resolved | explicit | A root-source entry whose `skills` is absent, null, an empty string, or an empty list keeps the D-CF1-06 rule, and a single listed path selects that one folder. | 04-01 truths; owner cases in 04-01-01 |
| PG-CORE-01 | ordering | When elements compare equal, is output order specified and stable? | resolved | explicit | The collected skill paths keep the listed order after first-wins de-duplication, and the conventional `skills` folder comes last when the root is listed. | 04-01 truths; owner cases in 04-01-01 |
| PG-CORE-01 | idempotency | What happens if this runs twice on the same input? | resolved | explicit | A second `reinstall` of a converged root-source plugin leaves the staged skills directory and the recorded skill names unchanged. | 04-01 truths; scenario in 04-01-02 |
| PG-CORE-01 | concurrency | If interrupted or run in parallel, what is guaranteed? | resolved | explicit | The root-source rule is decided in the resolver, which writes nothing; a dropped skill is removed only inside the existing update and reinstall transaction under the state lock of the scope, and a load removes nothing. | 04-01 truths; acceptance criteria of 04-01-01 and 04-01-02 |
| PG-SKILL-04 | unclassified | unclassified, review manually | unresolved | none | None authored. The taxonomy could not classify the requirement. | Flagged assumption in 04-03 |
| PG-WF-01 | empty | What is the result for empty, single-element, or null input? | resolved | explicit | Content with no reference, an empty workflow list, and a token that names no staged workflow come back byte-identical. | 04-04 truths; owner cases in 04-04-01 |
| PG-WF-01 | encoding | Whose definition of length or equality applies: bytes, code points, grapheme clusters, or normalized form? | resolved | explicit | A reference is recognized only when it equals the generated name of a staged workflow as the name generator produces it for the platform, and only the ASCII slash directly before the token counts as its leading slash. | 04-04 truths; owner cases in 04-04-01 |
| PG-SEC-01 | empty | What is the result for empty, single-element, or null input? | resolved | explicit | A plugin with no workflow script, no agent, a script with no `agentType`, an empty `agentType`, or an agent whose `tools` and `disallowedTools` are absent or blank gives no note. | 04-05 truths; owner cases in 04-05-01 |
| PG-SEC-01 | encoding | Whose definition of length or equality applies: bytes, code points, grapheme clusters, or normalized form? | resolved | explicit | An `agentType` literal matches an agent name by exact string equality after JavaScript literal decoding, with no case folding or Unicode normalization, and control and format characters in the file name and the agent type are escaped in the note. | 04-05 truths; owner cases in 04-05-01 |
| PG-SEC-01 | concurrency | If interrupted or run in parallel, what is guaranteed? | resolved | explicit | The note is recomputed from the plugin files at every install, update, reinstall, and apply and is never written to `state.json`, so an interrupted or concurrent command leaves no stale note. | 04-05 truths; acceptance criteria of 04-05-02 and 04-05-03 |

**Rollup:** 11 applicable; 10 resolved, all with explicit verification; 0 backstop; 0 dismissed; 1 unresolved, which is the unclassified row.

**No-silent-drop equality:** 11 surfaced = 10 authored into `must_haves.truths` + 1 flagged assumption.

### Flagged assumption: PG-SKILL-04, unclassified

The row is not resolved and not dismissed. Plan 04-03 carries it as a flagged assumption and lists the edges its tasks cover by decision: a file at depth zero, one, and two; the skill directory variable prefix; a trailing slash; sentence punctuation after a path; a path into the own skill; a path outside every skill; a sibling that did not stage; a path that follows a path character; a path that continues with a dot segment; and a long adversarial line. The verifier reviews that list against D-PG4-04 to D-PG4-06 and keeps the flag if it finds an uncovered edge.

## Prohibition recall (spec-less fallback)

The two-stage recall ran in the planner for each requirement. Stage 1 asked what the feature could silently become that the author would not want and the decisions do not forbid. Stage 2 dropped routine engineering items and kept values, safety, and transparency items. A kept item that is canon security is not minted; it gets a breadcrumb.

| Requirement | Stage 1 candidates dropped as routine engineering | Canon breadcrumbs | Kept |
|---|---|---|---|
| PG-CORE-01 | Installing more or fewer skills than listed; touching another plugin's skills in a shared folder; leaving a removed skill invocable; removing a skill at load. Each is an explicit contract of D-PG4-01 to D-PG4-03 and a truth of plan 04-01. | Reading or listing outside the plugin root is path traversal: covered by T-04-01, T-04-03 and `/gsd-secure-phase`; not minted here. | none |
| PG-SKILL-04 | Rewriting text that is not a path; rewriting a path to an unstaged sibling; changing the plugin's source files. Each is an explicit contract of D-PG4-04 to D-PG4-06 and a truth of plan 04-03. | A crafted path that leaves the skills folder, and a pattern that backtracks, are canon: covered by T-04-04, T-04-05 and `/gsd-secure-phase`; not minted here. | none |
| PG-WF-01 | Changing the command or skill arm; losing the name elision; rewriting script bytes. Each is an explicit contract of D-PG4-08 and a truth of plan 04-04. | Injection through a rewritten reference is canon: covered by the threat model of plan 04-04 and `/gsd-secure-phase`; not minted here. | one, below |
| PG-SEC-01 | Refusing or degrading an install because of the note; a note for an unrestricted agent; persisting the note; filing the request. Each is an explicit contract of D-PG4-11 to D-PG4-15 and a truth of plans 04-05 and 04-06. | Line forgery and path disclosure in the note are canon: covered by T-04-09, T-04-11, T-04-13 and `/gsd-secure-phase`; not minted here. | none |

### Kept prohibition

| Requirement | Category | Statement | Status | Verification | Authored in |
|---|---|---|---|---|---|
| PG-WF-01 | safety, transparency | MUST NOT add text to a staged command, skill, or agent that tells the model the user opted in to workflows, or that counters the opt-in guidance of the workflow engine; the bridge only keeps the reference the author wrote. | resolved | judgment | `must_haves.prohibitions` of plan 04-04, with no wired-check descriptor |

The item is authored descriptor-less, so it disposes flagged and unverified for judgment review. No check path was fabricated, and nothing was auto-dismissed.

**No-silent-drop equality:** 1 kept = 1 authored into `must_haves.prohibitions`.

## Research assumptions that stay flagged

| ID | Assumption | Carried by |
|---|---|---|
| A1 | An entry `skills` of an empty string or null declares nothing under the root-source rule; Claude Code reads the empty string as the plugin root. | Plan 04-01 |
| A2 | The upstream path-traversal error covers both an absolute and an escaping listed path. | Plan 04-01 |
| A3 | The background `workflow` call settles inside the model turn; the new step waits for both orders. | Plan 04-04 |
| A4 | The position of the new note among other lines of the install diagnostic; the executor reads the actual rows once. | Plan 04-05 |
