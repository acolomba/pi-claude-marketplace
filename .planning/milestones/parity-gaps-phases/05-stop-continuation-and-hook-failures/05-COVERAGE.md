# Phase 5 — Probe Coverage Record

No external API integration: the phase changes how an existing Pi extension runs plugin hooks (the Stop event, a missing script, failure notices, a context limit, async timers) and adopts no new API, SDK, or service.

Pi is the host of the extension and Claude Code is the parity reference. Neither is a service that the phase integrates: the phase registers one more handler of Pi's existing extension interface and copies observable rules of Claude Code 2.1.323. The detector returned `detected: false` for the Phase 5 roadmap section. Over the plan bodies it returns `detected: true` on one surface cue, the words "Pi API" in a test case that runs with no Pi object; that is the host's own interface, so this declaration stands and no matrix row is written.

## Edge coverage (spec-less fallback)

No phase SPEC exists, so the plan-phase fallback ran the deterministic edge probe over the four requirement texts of `REQUIREMENTS.md`. It proposed 7 applicable rows, two of them unclassified. Each row is resolved here by the `--auto` rules: a row with a defensible acceptance criterion is resolved with explicit verification and lifted into `must_haves.truths` as a plain string; an unclassified row stays unresolved and becomes a flagged assumption. No row is dismissed, and no row needed a backstop.

| Requirement | Category | Probe | Status | Verification | Acceptance criterion (the lifted truth) | Lifted to |
|---|---|---|---|---|---|---|
| PG-HOOK-02 | unclassified | unclassified, review manually | unresolved | none | None authored. The taxonomy could not classify the requirement. | Flagged assumption in 05-01 |
| PG-HOOK-23 | concurrency | If interrupted or run in parallel, what is guaranteed? | resolved | explicit | The rule is decided for each hook run alone from that run's exit code, stdout, and stderr: a missing-script hook beside a hook that blocks leaves that block in force, and a run that a signal or the hook's own timeout ended is never a missing-script run. | 05-03 truths; owner cases in 05-03-01 and 05-03-02 |
| PG-HOOK-14 | adjacency | When two things are exactly equal or just touch, do they merge, collide, or separate? | resolved | explicit | A context string of exactly 10,000 units passes unchanged, one of 10,001 units is saved, and two hooks that each give 6,000 characters both pass. A notice line of exactly 200 characters shows whole and a longer one is cut. Equal notices of one hook across the pairs of one edit show once, and two hooks that fail with the same text show two notices. | 05-04 truths (limit, strings measured alone); 05-02 truths (the 200-character line, equal notices); owner cases in 05-04-01, 05-02-01, and 05-02-02 |
| PG-HOOK-14 | empty | What is the result for empty, single-element, or null input? | resolved | explicit | A hook with no stderr shows `No stderr output`. A `continue: false` with no `stopReason` shows `Operation stopped by hook` on `UserPromptSubmit`, `Execution stopped by hook` in the `PreToolUse` notice, and nothing on `Stop`. An empty or absent context adds nothing and writes no file. | 05-02 truths; 05-03 truths; 05-04 truths; owner cases in 05-02-01, 05-03-02, 05-03-03, and 05-04-01 |
| PG-HOOK-14 | encoding | Whose definition of length or equality applies: bytes, code points, grapheme clusters, or normalized form? | resolved | explicit | Length is the JavaScript string length for the 10,000 limit, the 2,000-character preview, and the 200-character notice line. A string of 10,000 units passes whatever its byte size, and no cut of the cap splits a surrogate pair. The saved file holds the whole string as UTF-8. | 05-04 truths; 05-02 truths (the notice line counts string units, as upstream's renderer does); owner cases in 05-04-01 and 05-02-01 |
| PG-HOOK-14 | ordering | When elements compare equal, is output order specified and stable? | resolved | explicit | Failure notices show in routing order after the event's `systemMessage` notices and block notices; an equal notice of one hook shows at the place of the first. The texts of one `async` answer are capped and sent in their order, `systemMessage` first. | 05-02 truths; 05-04 truths; owner cases in 05-02-01, 05-02-02, and 05-04-02 |
| PG-HOOK-21 | unclassified | unclassified, review manually | unresolved | none | None authored. The taxonomy could not classify the requirement. | Flagged assumption in 05-05 |

**Rollup:** 7 applicable; 5 resolved, all with explicit verification; 0 backstop; 0 dismissed; 2 unresolved, which are the unclassified rows.

**No-silent-drop equality:** 7 surfaced = 5 rows authored into `must_haves.truths` + 2 flagged assumptions.

### Flagged assumption: PG-HOOK-02, unclassified

The row is not resolved and not dismissed. Plan 05-01 carries it as a flagged assumption and lists the edges its tasks cover by decision: a block; context alone; two hooks; a `continue: false` beside a block; an empty bucket; a `length` and an `error` ending at the boundary; an abort inside the boundary and an abort that skips it; a second `agent_settled` with no `agent_end`; a stale generation at entry and after the bucket; a rejected mode; an executor that rejects; the ninth block; each reset of the count; a wake inside and outside the boundary; a child session. The verifier reviews that list against D-PG5-01 to D-PG5-07 and keeps the flag if it finds an uncovered edge.

### Flagged assumption: PG-HOOK-21, unclassified

The row is not resolved and not dismissed. Plan 05-05 carries it as a flagged assumption and lists the edges its tasks cover by decision: a declared, an absent, and an unusable `timeout`; a hook with both flags; an `asyncRewake` hook with and without a `timeout`; the exit, close, and error of a plain child; a reload; a reap after a crash; an unrecorded child. The verifier reviews that list against D-PG5-17 and D-PG5-18 and keeps the flag if it finds an uncovered edge.

## Prohibition recall (spec-less fallback)

The two-stage recall ran in the planner for each requirement. Stage 1 asked what the feature could silently become that the author would not want and the decisions do not forbid. Stage 2 dropped routine engineering items and kept values, safety, and transparency items. A kept item that is canon security is not minted; it gets a breadcrumb.

| Requirement | Stage 1 candidates dropped as routine engineering | Canon breadcrumbs | Kept |
|---|---|---|---|
| PG-HOOK-02 | Continuing a run the user aborted; running `Stop` twice for one ending; cancelling another extension's continuation; a continuation with no label or plugin id; a loop with no limit; running `Stop` in a child. Each is an explicit contract of D-PG5-01 to D-PG5-07 and a truth of plan 05-01. A notice for a blocking `Stop` hook is a deferred idea of 05-CONTEXT.md, not a gap. | A Stop or rewake loop without bound is denial of service: covered by T-05-01, T-05-02 and `/gsd-secure-phase`; not minted here. | none |
| PG-HOOK-23 | Applying the rule on a tool event; dropping a block when the hook printed stdout; downgrading without a notice; a remedy that reinstalls another plugin or scope. Each is an explicit contract of D-PG5-08, D-PG5-09, and D-PG5-11 and a truth of plan 05-03. | A deliberate block that the rule turns off is a control bypass: covered by T-05-09 and `/gsd-secure-phase`; not minted here. | none |
| PG-HOOK-14 | A failure text sent to the model; a notice for a hook that decided through JSON; a stop notice where nothing stopped; a `stopReason` added to the conversation; a cap after a join; a text over the limit after the cap. Each is an explicit contract of D-PG5-10 to D-PG5-16 and a truth of plans 05-02, 05-03, and 05-04. | Terminal escape injection, notice flooding, a write or a removal through a link, and disk fill are canon: covered by T-05-06, T-05-07, T-05-12, T-05-13, T-05-15 and `/gsd-secure-phase`; not minted here. | one, below |
| PG-HOOK-21 | A new way to stop or signal a hook; a timer kept for the plain lane; a lost timer for `asyncRewake`; a late exit that writes more than today. Each is an explicit contract of D-PG5-17 and D-PG5-18 and a truth of plan 05-05. That the page must say nothing stops such a hook outside Linux is D-PG5-18 itself. | A background process with no bound is denial of service: covered by T-05-18 and `/gsd-secure-phase`; not minted here. | none |

### Kept prohibition

| Requirement | Category | Statement | Status | Verification | Authored in |
|---|---|---|---|---|---|
| PG-HOOK-14 | privacy, transparency | MUST NOT keep hook output in files without telling the user: the compatibility page names the folder of each scope, says that a project-scope folder lies inside the project directory, and states the 30-day removal. | resolved | judgment | `must_haves.prohibitions` of plan 05-06, with no wired-check descriptor |

D-PG5-15 decides where the file lives and how long it stays, and D-PG5-19 asks the page to say that an over-limit string is saved to a file. Neither says that the user must learn the folder, that a project-scope folder sits in the working tree, or the retention. A saved file can hold a prompt, a file, or a secret that the hook read, so the item is kept. It is authored descriptor-less, so it disposes flagged and unverified for judgment review. No check path was fabricated, and nothing was auto-dismissed.

**No-silent-drop equality:** 1 kept = 1 authored into `must_haves.prohibitions`.

## Research assumptions that stay flagged

| ID | Assumption | Carried by |
|---|---|---|
| A1 | A follow-up typed while a `Stop` hook runs loses its `UserPromptSubmit` context when the Stop hooks do not continue the run. Read from Pi's source, not run. | Plan 05-06: the page marks it as not measured; a parent line asks for a BACKLOG item. Open question 4: not fixed in this phase. |
| A2 | A `SessionStart` context that a compaction adds just before a `Stop` block reaches the model at the next user prompt. Source read only. | Plan 05-06: the page marks it as not measured. |
| A3 | Whether Claude Code gives an `async` hook's answer to the model call that follows a `Stop` block is unknown. | Plan 05-06: the page states the bridge's behavior only; a parent line asks for a BACKLOG item. Open question 7: `async` answers stay on `nextTurn`. |
| A4 | dash exits 2 for a script file that does not exist. dash is not installed on the planning machine. | Plan 05-03: its fixture is a script hook that exits 2, never a shell run on a missing path. |
| A5 | The terminal shows no working indicator while a `Stop` hook runs. Seen in two snapshots on Pi 1.5.0. | Plan 05-06: the page words it as one measurement. |
| A6 | The probes ran on Linux only. | Plan 05-01. |
| A7 | How Claude Code cuts the head in its write-failure text was not read; the surrogate rule is this project's. | Plan 05-04. |
| A8 | The ASVS labels follow the GSD template and were not checked against a release. | The threat models of all six plans: labels only. |
| A9 | Node 24 words a spawn `ENOENT` as `spawn <file> ENOENT`, as Node 22.22.2 and Node 26.13.1 do. Planning measured the two; CI runs Node 24. | Plan 05-02: the start-failure scenario pins the redacted text; the fallback is an error token. |
