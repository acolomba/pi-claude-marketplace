# Phase 89: Documentation reconcile - Research

**Researched:** 2026-07-31
**Domain:** Documentation reconcile (docs-only; no production source changes)
**Confidence:** HIGH — every claim below is grounded in a source file:line in this repo, verified this session.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-89-01:** Remove milestone-version framing from `docs/hooks-compatibility.md`. Title/intro drops "in v1.13"; the `Pi v1.13` column headers become version-neutral (`Pi` or `Pi bridge`); body prose stops narrating which milestone introduced what. Do NOT replace v1.13 with v1.16 — no milestone version anywhere in the doc.
- **D-89-02:** Both `Stop` and `StopFailure` event rows flip to **✓** (not ⚠). ⚠ marks contract restrictions a hook author must code around; the timing shift is not hook-observable, so Stop meets the full hook-observable contract. A short dedicated subsection near the events table documents the one irreducible divergence, with a pointer to `docs/research/issue-103-stop-stopfailure-promotion.md`. The matcher table gains the StopFailure error-type row (closed 10-value set, exact-match charset: letters, digits, `_`, `|`) and notes Stop's no-matcher disposition (non-empty matcher = reported `no-matcher-support` drop, UserPromptSubmit precedent).
- **D-89-03:** No peer-floor mentions in user-facing docs. The `>=0.80.5` floor is extension-wide and declared in `package.json`; a per-event ">= 0.80.5" note would misrepresent a package-level constraint as per-event. README's hooks line stays as is.
- **D-89-04:** Full-doc audit of `docs/hooks-compatibility.md` against current code. Every table row verified against shipped v1.16 behavior, not just the DOC-04-named edits. (Known-stale items enumerated in the Stale-Claim Inventory below.)
- **D-89-05:** Amend `docs/research/claude-hooks-vs-pi-events.md` by correcting in place — no strikethrough, no preserved-history "superseded" relics. Edit so the doc is internally consistent after the corrections; only claims falsified by v1.16 shipping change. Update the date/status line. Add pointers to the issue-103 doc.
- **D-89-06:** Correct the issue-103 doc's `agent_settled` version attribution `0.80.4` → `0.80.5` at every mention (nuance: upstream CHANGELOG attributes it to 0.80.4 but npm has no 0.80.4 release; 0.80.3 → 0.80.5; typings first ship in 0.80.5).
- **D-89-07:** Re-point `docs/output-catalog.md`'s partial-hook example prose "a non-bucket-A event such as `Stop`" (~line 390) to a still-unsupported event (e.g. `Notification`). Keep edits minimal and byte-safe.

### Claude's Discretion

- Exact wording/placement of the timing-shift subsection and row notes.
- Whether the Stop no-matcher disposition gets its own matcher-table row or a note on the events row (match the doc's existing shape).
- Which still-unsupported event replaces Stop in the output-catalog example.
- How the research doc's amended date/status line is phrased.
- Row-level judgment calls during the full-doc audit (add vs annotate), keeping tables consistent with their existing column shapes.

### Deferred Ideas (OUT OF SCOPE)

- Full re-basing of the research doc's feasibility projections onto v1.16 (recounting every bucket total against today's 10 shipped events beyond what consistency requires) — only claims falsified by shipping are corrected; the doc remains a dated research note.
- `docs/research/claude-hook-config-syntax.md` refresh — cross-check only this phase.
- UPSTREAM-SETTLE (erasing the timing shift) — v2, tracked in REQUIREMENTS.md.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-04 | `docs/hooks-compatibility.md` reconciled with shipped behavior — Stop/StopFailure rows flip to supported (timing-shift caveat + StopFailure error-type matcher row); stale v1.13 hard-trip "Install-time disposition" section rewritten for the force-install partial-partition model. | Stale-Claim Inventory §A (full row-by-row map with source:line evidence); shipped-behavior ground truth from `settle.ts`, `hook-events.ts`, `stop.ts`, `stop-failure.ts`, `output-catalog.md`. |
| DOC-05 | `docs/research/claude-hooks-vs-pi-events.md` amended — naive-table "`agent_end` is observation-only" claim retired; `agent_settled` added to Pi event inventory; StopFailure's `after_provider_response` synthesis superseded by the `stopReason` protocol contract; pointers to the issue-103 doc. | Stale-Claim Inventory §B (falsified-claim map with line numbers). |
</phase_requirements>

## Summary

This is a docs-only reconcile phase with no production source changes. Phases 87 and 88 shipped the `Stop`/`StopFailure` promotion (bucket-A admission, the `agent_settled` settle dispatcher, full Stop decision control, the observation-only StopFailure arm). Three documentation files still describe pre-promotion behavior and must be brought into line with what the code now does. The research deliverable that matters most is a **row-by-row stale-claim inventory** — every doc claim falsified by shipped v1.16 behavior, paired with a source:line pointer to the current truth — so the planner can produce a precise edit list rather than re-deriving the ground truth.

The most consequential finding for planning is the **test-coupling map**: neither `docs/hooks-compatibility.md`, `docs/research/claude-hooks-vs-pi-events.md`, nor `docs/research/issue-103-stop-stopfailure-promotion.md` is read by any test in the suite — DOC-04, DOC-05, and the D-89-06 rider carry **zero byte-test risk**. Only `docs/output-catalog.md` is test-coupled (three tests read it), and the D-89-07 edit is prose-only, outside every byte-pinned fenced block, and introduces no guarded vocabulary — so it is byte-safe. `format:check` (prettier) gates only `{js,json,ts}`, not markdown, so no doc edit risks the format gate.

**Primary recommendation:** Execute the two edit-target rewrites (DOC-04 full-doc audit, DOC-05 correct-in-place) as prose-only edits with no test-byte concern, then land the two riders. For D-89-07, change the single prose token `Stop` → `Notification` at `output-catalog.md:390` (the codebase already uses `Notification` as the canonical unsupported-event example per D-87-06); it sits outside the byte-pinned fenced block, so `npm run check` stays green. Reuse the near-final timing-shift wording from the issue-103 doc's "The one irreducible divergence" section rather than re-deriving it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compatibility reference (`hooks-compatibility.md`) | Documentation | — | User-facing feature-by-feature reference; describes the bridge contract, not code |
| Research feasibility note (`claude-hooks-vs-pi-events.md`) | Documentation | — | Dated research note; corrected-in-place, not re-based |
| Design authority (`issue-103-*.md`) | Documentation | — | Design authority + a D-89-06 edit target (version rider) |
| Output catalog (`output-catalog.md`) | Documentation (test-coupled) | Test tier | Byte-pinned by catalog-uat / hooks-cap-notify; prose scanned by partial-vocabulary-guard |

## Standard Stack

Not applicable — docs-only phase, no external packages, libraries, or runtime dependencies introduced. No `npm install`, no Package Legitimacy Audit, no Environment Availability audit needed (no external tools beyond the already-present `node --test` gate).

## Ground-Truth Source Map (shipped v1.16 behavior)

The authoritative code the reconcile must reflect. Every claim in the Stale-Claim Inventory traces to one of these.

| Concern | Source | What it establishes |
|---------|--------|---------------------|
| Bucket-A admission (10 events) | `extensions/pi-claude-marketplace/domain/components/hook-events.ts:40-51` | `BUCKET_A_EVENTS` includes `Stop` and `StopFailure` [VERIFIED: hook-events.ts:40-51] |
| Stop no-matcher disposition | `hook-events.ts:182-190` (`NON_TOOL_EVENT_FIELDS.Stop = null`) | Stop carries the `null` no-matcher sentinel like UserPromptSubmit; non-empty matcher = `no-matcher-support` drop [VERIFIED: hook-events.ts:187,226-229] |
| StopFailure closed 10-value set | `hook-events.ts:259-270` | `rate_limit, overloaded, authentication_failed, oauth_org_not_allowed, billing_error, invalid_request, model_not_found, server_error, max_output_tokens, unknown`; exact whole-string membership, no pipe-OR splitting [VERIFIED: hook-events.ts:259-270] |
| Settle dispatcher + stopReason gate | `bridges/hooks/settle.ts:156-193` | one `agent_settled` subscriber; `stop`→Stop, `error`/`length`→StopFailure, `aborted`/`toolUse`→no-op [VERIFIED: settle.ts:175-191] |
| Stop decision control | `settle.ts:231-280` | block re-entry (STOP-03), exit-2 rides block arm (STOP-04), additionalContext-without-block (STOP-05), continue:false aggregate precedence (STOP-06) [VERIFIED: settle.ts:253-279] |
| Stop loop protection | `settle.ts:49,69-71,332-351` | `stop_hook_active` flag (cleared only on genuine `input`), 8-consecutive-re-entry cap (block AND additionalContext share the counter, D-88-08), one-shot notify [VERIFIED: settle.ts:49,338-347] |
| Stop stdin payload | `bridges/hooks/payloads/stop.ts:14-21` | `session_id, transcript_path, cwd, hook_event_name, last_assistant_message, stop_hook_active`; `background_tasks`/`session_crons` omitted [VERIFIED: stop.ts:14-21] |
| StopFailure arm (observation-only) | `settle.ts:293-315` | fires on `error`/`length`, runs every hook then discards outcomes; never touches sendMessage/stop_hook_active/counter [VERIFIED: settle.ts:304-314] |
| StopFailure stdin payload | `bridges/hooks/payloads/stop-failure.ts:14-22` | `session_id, transcript_path, cwd, hook_event_name, error, error_details?, last_assistant_message` [VERIFIED: stop-failure.ts:14-22] |
| StopFailure classifier | `stop-failure.ts:1-10` (D-88-02) | `errorMessage`-only classification into the closed vocab; `unknown` fallback; `length`→`max_output_tokens` deterministic [VERIFIED: stop-failure.ts:6-10] |
| Install-time disposition (partial-partition) | `docs/output-catalog.md:390,1489` + `shared/probe-classifiers.ts::narrowUnsupportedKinds` | parseable-but-unsupportable hooks → `(partially-available)` + per-entry drops; SINGLE aggregate `{unsupported hooks}` brace (D-71-04); per-handler `event(matcher) (unsupported)` breakdown on `info` (D-71-05); STRUCTURAL malformed `hooks.json` → distinct `(unavailable)` arm via `narrowResolverNotes` [VERIFIED: output-catalog.md:390,1489] |

## Stale-Claim Inventory

The core deliverable. Two subsections: §A `hooks-compatibility.md` (DOC-04, full-doc audit), §B `claude-hooks-vs-pi-events.md` (DOC-05, correct-in-place).

### §A `docs/hooks-compatibility.md` (DOC-04)

Each row: the stale doc location, the current truth, and the correction. No test reads this file (see Test-Coupling Map) — edits are byte-unconstrained.

| # | Doc line(s) | Stale claim | Current truth (source:line) | Correction |
|---|-------------|-------------|-----------------------------|------------|
| A1 | 1, 3, 7 | Title/intro says "in v1.13", "Pi v1.13 bridge sources"; version-history framing | House policy: no milestone-version narration | D-89-01: strip milestone framing; describe the current bridge; `Pi v1.13` headers → `Pi` / `Pi bridge` |
| A2 | 21 | `Stop` `✗` — "Pi end-of-turn is observation-only; cannot honor block-to-continue" | Stop is bucket-A with full decision control [settle.ts:231-280] | Flip to `✓`; note references the timing shift (D-89-02) |
| A3 | 22 | `StopFailure` `✗` — "Pi has no turn-ended-by-error event" | StopFailure fires on `error`/`length` via the settle dispatcher [settle.ts:179-187,293-315] | Flip to `✓`; observation-only note |
| A4 | 43-51 | "Event status classification" → "Deferred for engineering reasons" bucket lists `Stop` (line 46) and `StopFailure` (line 50) | Both shipped [hook-events.ts:40-51] | Remove Stop and StopFailure from the deferred bucket; `SubagentStart`/`SubagentStop` (line 51) stay deferred |
| A5 | — (new) | No timing-shift subsection exists | The one irreducible divergence [issue-103 § "The one irreducible divergence", lines 75-77] | Add a short subsection near the events table (D-89-02); reuse issue-103 wording; pointer to issue-103 doc |
| A6 | — (new) | No StopFailure error-type matcher row in the matcher table | Closed 10-value set [hook-events.ts:259-270] | Add matcher-table row: 10 values, exact-match charset (letters, digits, `_`, `\|`), no pipe-OR splitting |
| A7 | 77 | Regex matcher note: "trips `(unavailable) {unsupported hooks}`" | A parseable-but-unsupportable matcher group → `(partially-available)` + per-entry drop; only STRUCTURAL malformed → `(unavailable)` [output-catalog.md:1489] | Reconcile inline `(unavailable)` to the partial-partition model |
| A8 | 100 | Tool-name mapping prose: "the plugin will install with `(unavailable) {unsupported hooks}`" | Same partial-partition model | Reconcile to `(partially-available)` + per-entry drop; single aggregate `{unsupported hooks}` brace |
| A9 | 132-133 | Handler types: `http` → "plugin trips `(unavailable) {unsupported hooks}`"; `mcp_tool`/`prompt`/`agent` "unsupported" | Unsupportable handler alongside supported ones → `(partially-available)` per-entry drop, not whole-plugin trip | Reconcile to partial-partition model (whole-event/handler drop, not whole-plugin unavailable) |
| A10 | 167-168 | stdin/stdout: `additionalContext (SessionStart)` ✓; `additionalContext (other events)` ✗ "only the SessionStart capture path is wired" | Stop now supports `additionalContext`-without-block re-entry (STOP-05) [settle.ts:269-275] | Adjust the "other events" row so Stop is called out as supported; SessionStart path unchanged |
| A11 | — (new, per D-89-04) | No rows for `stop_hook_active`, `last_assistant_message`, or Stop decision-control arms | Stop payload fields [stop.ts:14-21]; block/exit-2/continue:false arms [settle.ts:253-279] | Add rows as the table shape warrants: `stop_hook_active`, `last_assistant_message`, Stop `decision:block`, exit-2, `continue:false` precedence |
| A12 | 209-232 | "Install-time disposition" — the "Hard install-time trip" model: plugin flips to `(unavailable) {unsupported hooks}` and none of its hooks run; "strict supportability over partial support" | Force-install partial-partition: per-entry drops, `(partially-available)`, single aggregate `{unsupported hooks}` (D-71-04); per-handler breakdown on `info` (D-71-05); structural malformed `hooks.json` = distinct `(unavailable)` arm [output-catalog.md:390,1489] | **Rewrite** the section for the three distinct arms (do not conflate): (1) parseable-but-unsupportable → partially-available per-entry drop; (2) structural malformed → unavailable; (3) silent fall-open / silent drop arms (lines 221-232) verify against code and keep where still accurate |
| A13 | 205-206 | Async/lifecycle "Parallel hooks... cross-handler permission-merge... `PermissionRequest` event is itself unsupported" | PermissionRequest still unsupported (not in BUCKET_A_EVENTS) | Verify: still accurate; no change expected |
| A14 | 174-197 | Env-var, handler-fields, config-surfaces tables | Not touched by Stop/StopFailure promotion | Audit per D-89-04; expected still accurate — verify each row against code, correct only if the audit finds drift |

**Audit stance (D-89-04):** rows A13/A14 and the remainder of the doc are expected to still match code (the promotion touched only turn-boundary events and the disposition model). The planner should include a verification task that walks the remaining rows against source, correcting anything found stale, but the load-bearing edits are A1-A12.

### §B `docs/research/claude-hooks-vs-pi-events.md` (DOC-05)

Correct-in-place per D-89-05; only falsified claims change; the historical feasibility analysis stays intact where still accurate. No test reads this file.

| # | Doc line(s) | Falsified claim | Correction |
|---|-------------|-----------------|------------|
| B1 | 3 | Date/status line "Date: 2026-06-12. ... not yet reviewed." | Update to reflect the amendment (D-89-05; phrasing is Claude's discretion) |
| B2 | 7 | "Pi has 30 extension events" | Pi inventory becomes 31 with `agent_settled`; update the count. (Claude's 30 count is upstream, unchanged.) |
| B3 | 13-14 | Executive summary: "`Stop` is the single biggest correctness risk... it's a bucket-D lossy synthesis"; "The bridge's preservation of the `{"decision": "block"...}` contract on `Stop` is a load-bearing test case" | Stop is now shipped bucket-A with full decision control, not a bucket-D synthesis; retire the "lossy synthesis" framing for Stop; point to issue-103 doc |
| B4 | 84-115 | Pi event inventory table (30 rows) omits `agent_settled` | Add `agent_settled` as row #31 (Trigger: "agent run fully settled — no retry/compaction/queued continuation will run"; Control: Observation, carries no payload). `agent_end` row (98) stays accurate for `agent_end` itself |
| B5 | 139 | Cross-mapping `Stop` → `agent_end`: "Pi's `agent_end` is observation-only. Bridge cannot honor `decision: "block"` to force continuation." | Retire: Stop is dispatched off `agent_settled` with full decision control (block re-entry via `sendMessage(followUp, triggerTurn)`); point to issue-103 doc [settle.ts:231-280] |
| B6 | 140 | Cross-mapping `StopFailure` → `after_provider_response (partial)`: "Pi exposes HTTP status... but has no 'turn ended by error' terminal event" | Replace with the `stopReason` protocol contract: `error`/`length` endings surface as the final assistant message's `stopReason`; classification from `errorMessage`; point to issue-103 doc [settle.ts:179-187, stop-failure.ts:6-10] |
| B7 | 158-164 | "Summary by fidelity (naive 1:1 view)": `Stop` in both ● and ◐ rows; `StopFailure` in the ◐ row; the note (164) about two Stop intents | Correct the buckets falsified by shipping (Stop/StopFailure no longer lossy); keep the naive-view framing as a dated artifact but correct the falsified cells |
| B8 | 178 | Pi-events-with-no-Claude-analog: `after_provider_response` — "closest is `StopFailure` error-type matcher" | Touch up: StopFailure no longer synthesizes from `after_provider_response` (D-89-05 explicit) |
| B9 | 195-211 | Perfect-fidelity feasibility table + totals: bucket A = 8, bucket D = 5 (includes "Stop (block-to-continue)" and "StopFailure"); "14 events shippable today via A+B+D" | Correct the cells falsified by shipping (Stop/StopFailure are now direct/shipped, not bucket-D synthesis). Deferred: wholesale re-count of every bucket total — only correct what shipping falsifies |
| B10 | 234-242 | Bucket-D synthesis table rows: "`Stop` (block-to-continue)" synthesis via `sendUserMessage` "on the next idle... Timing shift"; "`StopFailure`" synthesis via `after_provider_response` HTTP-status tracking | Correct: shipped Stop uses the `agent_settled` settle dispatcher (the timing shift persists but is documented); shipped StopFailure uses the `stopReason` gate + `errorMessage` classifier, not HTTP-status synthesis. Point to issue-103 doc |
| B11 | 304-308 | Path forward: "V1 bridge ships buckets A+B+D"; "`Stop` is the load-bearing test case... bucket-D synthesis for `Stop` MUST round-trip..." | Correct the Stop-as-bucket-D framing; point to issue-103 doc for the shipped design |
| B12 | 316-388 | Marketplace coverage: "Stop → D" verdicts for `ralph-wiggum`, `hookify`, `security-guidance` (354,361,367); "Stop is the highest-risk supported event" | Judgment call (D-89-05): these are historical audit findings; correct the bucket labels falsified by shipping where consistency requires, but do not re-run the audit. `ralph-wiggum`/`hookify` "flip to fully available" is confirmed shipped [issue-103:13] |

**Note on B10 and the issue-103 doc's own StopFailure prose:** the issue-103 doc (line 73) describes StopFailure classification as `errorMessage`-based "optionally firmed by HTTP status tracked via `after_provider_response`." The **shipped** classifier is `errorMessage`-only (D-88-02) [stop-failure.ts:6-10]. This sits inside the issue-103 doc's "optionally" envelope, so it is not strictly falsified and a full audit of the issue-103 doc's design prose is out of scope (only the D-89-06 version rider touches that doc). Flagged as an observation, not a required edit — see Open Questions.

## Riders (carried in from Phase 87)

### D-89-06: issue-103 doc `0.80.4` → `0.80.5`

Four mentions in `docs/research/issue-103-stop-stopfailure-promotion.md`, all verified this session:

| Line | Context | Current text |
|------|---------|--------------|
| 8 | Executive summary | "Pi added `agent_settled` in `@earendil-works/pi-coding-agent` 0.80.4 (2026-07-09)" |
| 12 | Cost line | "peer floor bump `>=0.74.0` → `>=0.80.4`" |
| 21 | Sources table | "`agent_settled` introduction ... CHANGELOG -- 0.80.4 (2026-07-09)" |
| 37 | Pi API surface | "Carries no payload; added 0.80.4." |

[VERIFIED: grep `0\.80\.4` across `docs/` returns exactly these four lines, all in the issue-103 doc] Correct each to `0.80.5`. Preserve the nuance (D-89-06): the upstream CHANGELOG attributes `agent_settled` to 0.80.4, but the npm registry has no 0.80.4 release (0.80.3 → 0.80.5) and the typings first ship in 0.80.5 — so `>=0.80.5` is the correct, installable floor (matches `package.json` peerDependencies and FLOOR-01). The `>=0.74.0` in the cost line is a prior floor and stays as the "from" side of the bump.

**Consistency touch (within D-89-06's pass):** the issue-103 doc's § "Stale-doc inventory" (lines 98-101) enumerates the two DOC-04/DOC-05 targets in future tense ("the `Stop`/`StopFailure` rows flip to supported..."). After this phase those edits are done; the section should read as reconciled, not leave dangling future-tense claims (CONTEXT integration point).

### D-89-07: output-catalog.md Stop-as-unsupported example re-point

Target: `docs/output-catalog.md:390`, prose inside the `partially-installed-inventory-hooks` catalog-state block:

> "...declares an unsupportable event (a non-bucket-A event such as `Stop`) or matcher group..."

[VERIFIED: output-catalog.md:390] `Stop` is now bucket-A, so it is the wrong example for an unsupportable event. Re-point to a still-unsupported event — `Notification` is the recommended choice: the codebase and test suite already use `Notification` as the canonical non-bucket-A drop example everywhere (D-87-06), e.g. `hooks-supportability.test.ts:303`, `hooks.test.ts:317`, `resolver-strict.test.ts:323`, `info.test.ts:2271`, `install.test.ts:2586`. Aligning the catalog prose with the suite's canonical example is the low-surprise edit.

**Byte-safety analysis (verified this session):**
- The `Stop` token at line 390 is in the **prose paragraph**, not inside the fenced ` ```text ` block (which contains only `● official [user] <autoupdate>` / `◉ hook-plugin v1.0.0 (partially-installed) {unsupported hooks}` — no `Stop`).
- `catalog-uat.test.ts` extracts **only fenced block bodies** paired with `<!-- catalog-state: -->` markers [catalog-uat.test.ts:5-10,77-90] — it never reads prose. The prose edit cannot break it.
- `hooks-cap-notify.test.ts` reads **only** the `stop-override-cap` fenced block [hooks-cap-notify.test.ts:9-11,36-43] — a different block; unaffected.
- `partial-vocabulary-guard.test.ts` scans `output-catalog.md` for the retired **force/`(unsupported)`-verdict** vocabulary (D-75-01 rename) [partial-vocabulary-guard.test.ts:11-14,86]. `Stop`→`Notification` introduces none of the guarded tokens (both are event names, not verdict/force tokens). Unaffected.

Conclusion: the D-89-07 prose edit is byte-safe against all three tests. Keep it a single-token prose change.

**Do NOT touch** the `stop-override-cap` fenced block (`output-catalog.md:~2264`) — it is byte-pinned by `hooks-cap-notify.test.ts` and describes shipped cap behavior correctly (STOP-07/D-88-01); it is not a D-89 edit target.

## Test-Coupling Map (which doc edits are gated by `npm run check`)

`npm run check` = `typecheck && lint && format:check && test && test:integration` [package.json:77].

| Doc | Read by any test? | Edit risk | Notes |
|-----|-------------------|-----------|-------|
| `docs/hooks-compatibility.md` | **NO** [grep: NONE] | Zero byte-test risk (DOC-04) | Not a guarded source; not read by any `*.test.ts` |
| `docs/research/claude-hooks-vs-pi-events.md` | **NO** [grep: NONE] | Zero byte-test risk (DOC-05) | — |
| `docs/research/issue-103-stop-stopfailure-promotion.md` | **NO** [grep: NONE] | Zero byte-test risk (D-89-06) | — |
| `docs/output-catalog.md` | **YES** | Fenced blocks byte-pinned; prose scanned | Read by `catalog-uat.test.ts` (fenced blocks), `hooks-cap-notify.test.ts` (`stop-override-cap` block), `partial-vocabulary-guard.test.ts` (vocabulary scan). D-89-07 edit is prose-only → byte-safe |

**`format:check` scope:** prettier runs on `**/*.{js,json,ts}` only [package.json:78-79] — markdown is **not** gated. No `.md` edit in this phase risks the format gate. (The docs happen to be prettier-clean today, but that is not enforced.)

**Net:** for a docs-only phase, the only `npm run check` surface that can react to a doc edit is the test suite reading `output-catalog.md`, and the one edit there (D-89-07) is verified byte-safe. The plan should still run the full gate (NFR-6) as a green-bar confirmation, but no doc edit is expected to require a paired test update.

## Reusable Wording

The timing-shift caveat exists nearly final in `docs/research/issue-103-stop-stopfailure-promotion.md`:
- **§ "The one irreducible divergence"** (lines 75-77): "Upstream, a blocked stop folds the continuation into the same turn... Under Pi, by the time the bridge can decide, the agent has settled; re-entry starts a new turn... Hook scripts cannot tell the difference; the transcript shows an extra turn boundary."
- **Executive summary bullet** (line 11): same content, one-sentence form.

Adapt this for the `hooks-compatibility.md` timing-shift subsection (A5) rather than re-deriving. Keep the "invisible to hook scripts (same payload, flag cadence, and 8-block cap); transcript shows an extra turn boundary" framing that CONTEXT D-89-02 specifies.

## Common Pitfalls

### Pitfall 1: Replacing v1.13 with v1.16 in hooks-compatibility.md
**What goes wrong:** Mechanically swapping the version string keeps milestone-version narration the doc is supposed to shed.
**Why it happens:** "Reconcile to current" reads like "bump the version."
**How to avoid:** D-89-01 is explicit — no milestone version anywhere; version-neutral headers (`Pi` / `Pi bridge`); git carries lineage. Matches the house source-comment policy (`.claude/rules/typescript-comments.md`).
**Warning signs:** Any `v1.1x` string in the reconciled `hooks-compatibility.md`.

### Pitfall 2: Conflating the three install-time disposition arms
**What goes wrong:** Rewriting the "Hard install-time trip" section into a single "partially-available" story that swallows the structural-malformed arm.
**Why it happens:** Both arms end in a `{...}` brace and look similar.
**How to avoid:** Keep three distinct arms (A12): (1) parseable-but-unsupportable event/matcher/handler → `(partially-available)` + per-entry drop + single aggregate `{unsupported hooks}`; (2) STRUCTURAL malformed `hooks.json` (invalid JSON, schema failure) → `(unavailable)` via `narrowResolverNotes`; (3) the silent fall-open / silent-drop `if`-field and payload arms (still accurate — verify, keep). Authority: `output-catalog.md:1489` spells the two-arm distinction precisely.
**Warning signs:** The rewrite says a malformed `hooks.json` resolves `(partially-available)`, or drops the `narrowResolverNotes` vs `narrowUnsupportedKinds` distinction.

### Pitfall 3: Over-editing the research doc (DOC-05)
**What goes wrong:** Re-basing the whole feasibility analysis onto today's 10 shipped events, recounting every bucket.
**Why it happens:** The naive-view buckets look stale end-to-end once Stop/StopFailure ship.
**How to avoid:** D-89-05 + Deferred Ideas — correct ONLY claims falsified by shipping; the doc stays a dated research note; the still-accurate historical analysis (E/F/G/H buckets, soft-dep audit, marketplace coverage for non-Stop events) is preserved.
**Warning signs:** Edits to bucket-E/F/G/H rows, the pi-subagents/pi-mcp-adapter audit, or `FileChanged`/`CwdChanged` synthesis prose — none of which shipping falsifies.

### Pitfall 4: Touching a byte-pinned fenced block in output-catalog.md
**What goes wrong:** Editing inside a `<!-- catalog-state: -->` fenced block breaks `catalog-uat.test.ts` or `hooks-cap-notify.test.ts`.
**How to avoid:** D-89-07 is a prose-only single-token change; the `Stop` token at line 390 is outside the fenced block. Do not touch any fenced block.
**Warning signs:** A diff hunk that includes ` ```text ` lines.

## Runtime State Inventory

Docs-only phase — no rename/migration of runtime state. Per the trigger check (rename/refactor/migration only), a light inventory for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore holds any string this phase changes | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None — markdown docs are not compiled or packaged | None |

**Nothing found in any category:** verified — the phase edits four `.md` files only; no code, no config, no state.

## Validation Architecture

`workflow.nyquist_validation: true` [.planning/config.json:19] — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) |
| Config file | none — glob in `package.json` `test` script |
| Quick run command | `node --test "tests/architecture/catalog-uat.test.ts" "tests/architecture/hooks-cap-notify.test.ts" "tests/architecture/partial-vocabulary-guard.test.ts"` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-04 | `hooks-compatibility.md` reconciled | manual review | n/a — no test reads this doc | n/a |
| DOC-05 | `claude-hooks-vs-pi-events.md` amended | manual review | n/a — no test reads this doc | n/a |
| D-89-07 | `output-catalog.md:390` prose re-point, byte-safe | regression (no-break) | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/partial-vocabulary-guard.test.ts` | ✅ |
| D-89-06 | issue-103 doc `0.80.4`→`0.80.5` | manual review | n/a — no test reads this doc | ✅ (file) |

**Interpretation:** DOC-04/DOC-05/D-89-06 have no automated byte-gate — their verification is human review against the Stale-Claim Inventory (this is the UAT surface for the phase). D-89-07's automated gate is a *no-regression* assertion: the three `output-catalog.md`-reading tests must stay green after the prose edit.

### Sampling Rate
- **Per task commit:** the three `output-catalog.md`-reading tests (quick run) after any `output-catalog.md` edit; no-op for the other three docs.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- None — existing test infrastructure covers the only test-coupled doc. No new test files needed (the DOC-04/DOC-05 docs are intentionally not byte-pinned; adding byte-pins for narrative reference docs would be brittle and is out of scope).

## Security Domain

`security_enforcement` absent → treated as enabled. Docs-only phase with no attack surface: no input parsing, no auth, no crypto, no data flow, no network, no filesystem writes outside four markdown files. No ASVS category applies. No STRIDE threat pattern is introduced or altered by editing documentation prose. Section included for completeness; no controls required.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Notification` is the best still-unsupported event to replace `Stop` in the output-catalog example | D-89-07 | LOW — Claude's discretion allows any still-unsupported event; `Notification` merely matches the suite's canonical example. Any non-bucket-A event works |

**All other claims are `[VERIFIED]` against source:line this session** — the stale-claim inventory, the test-coupling map, the four `0.80.4` mention sites, and the byte-safety analysis were each confirmed by reading the referenced files. No `[ASSUMED]` compliance/retention/security claims exist in this phase.

## Open Questions

1. **issue-103 doc StopFailure classifier prose (line 73) vs shipped `errorMessage`-only classifier**
   - What we know: the doc says classification is `errorMessage`-based "optionally firmed by HTTP status via `after_provider_response`"; shipped is `errorMessage`-only (D-88-02) [stop-failure.ts:6-10].
   - What's unclear: whether the planner wants to tighten the "optionally firmed by HTTP status" phrasing in the issue-103 doc while already editing it for D-89-06.
   - Recommendation: leave it — it sits inside the doc's "optionally" envelope (not falsified), and a full issue-103 design-prose audit is out of scope (Deferred Ideas). Note it in the plan so the reviewer isn't surprised.

2. **Depth of the D-89-04 full-doc audit for rows A13/A14**
   - What we know: env-var, handler-fields, config-surfaces, and async/lifecycle rows are not touched by the Stop/StopFailure promotion and are expected accurate.
   - What's unclear: whether any of these drifted from code in an unrelated earlier phase.
   - Recommendation: include one verification task walking the remaining rows against source; correct only on found drift. Load-bearing edits remain A1-A12.

## Sources

### Primary (HIGH confidence — read this session, source:line verified)
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` — BUCKET_A_EVENTS (10), NON_TOOL_EVENT_FIELDS, StopFailure closed set
- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts` — settle dispatcher, stopReason gate, decision control, loop protection, StopFailure arm
- `extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts` + `stop-failure.ts` — Stop/StopFailure stdin payloads, classifier
- `docs/output-catalog.md:390,1489,~2264` — partial-partition disposition model, D-89-07 target, stop-override-cap byte-pin
- `docs/research/issue-103-stop-stopfailure-promotion.md` — design authority, timing-shift wording, four `0.80.4` sites, stale-doc inventory
- `docs/hooks-compatibility.md` — DOC-04 edit target (full read)
- `docs/research/claude-hooks-vs-pi-events.md` — DOC-05 edit target (full read)
- `tests/architecture/catalog-uat.test.ts`, `hooks-cap-notify.test.ts`, `partial-vocabulary-guard.test.ts` — doc-byte coupling verification
- `package.json:77-90` — `check` gate composition, prettier scope
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `89-CONTEXT.md` — requirement texts, shipped decisions, locked decisions

### Secondary
- `.claude/rules/typescript-comments.md` — house no-version-narration policy (informs D-89-01)

### Tertiary
- None

## Metadata

**Confidence breakdown:**
- Stale-claim inventory: HIGH — every row traces to a source:line read this session
- Test-coupling map: HIGH — grep-verified NONE for the three narrative docs; extraction logic read for the coupled doc
- Rider byte-safety (D-89-07): HIGH — prose-vs-fenced-block boundary and all three test extractors verified
- D-89-06 mention count: HIGH — grep returns exactly four sites

**Research date:** 2026-07-31
**Valid until:** ~2026-08-30 (stable — internal docs/code; only invalidated by further edits to the four target files or the three coupled tests)
