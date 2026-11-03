---
phase: 03-slash-commands
verified: 2026-11-03T12:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/03-slash-commands/03-01-PLAN.md"
  - ".planning/phases/03-slash-commands/03-01-SUMMARY.md"
  - ".planning/phases/03-slash-commands/03-02-PLAN.md"
  - ".planning/phases/03-slash-commands/03-02-SUMMARY.md"
  - ".planning/phases/03-slash-commands/03-03-PLAN.md"
  - ".planning/phases/03-slash-commands/03-03-SUMMARY.md"
  - ".planning/phases/03-slash-commands/03-04-PLAN.md"
  - ".planning/phases/03-slash-commands/03-04-SUMMARY.md"
  - ".planning/phases/03-slash-commands/03-05-PLAN.md"
  - ".planning/phases/03-slash-commands/03-05-SUMMARY.md"
  - ".planning/phases/03-slash-commands/03-06-PLAN.md"
  - ".planning/phases/03-slash-commands/03-06-SUMMARY.md"
  - ".planning/phases/03-slash-commands/03-07-PLAN.md"
  - ".planning/phases/03-slash-commands/03-07-SUMMARY.md"
  - ".planning/phases/03-slash-commands/03-08-PLAN.md"
  - ".planning/phases/03-slash-commands/03-08-SUMMARY.md"
  - ".planning/phases/03-slash-commands/03-09-PLAN.md"
  - ".planning/phases/03-slash-commands/03-09-SUMMARY.md"
  - "extensions/pi-claude-marketplace/bridges/commands/command-record.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/discover.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/staged-command.ts"
  - "extensions/pi-claude-marketplace/domain/component-paths.ts"
  - "extensions/pi-claude-marketplace/edge/command-invocation.ts"
  - "extensions/pi-claude-marketplace/edge/command-tool.ts"
  - "extensions/pi-claude-marketplace/orchestrators/command-invocation.ts"
  - "features/plugin/project-locality.feature"
  - "features/plugin/project-trust.feature"
  - "features/slash-command/aliases.feature"
  - "features/slash-command/frontmatter.feature"
  - "features/slash-command/invocation.feature"
  - "features/slash-command/lifecycle.feature"
  - "features/slash-command/listing.feature"
  - "features/slash-command/manifest-forms.feature"
  - "features/slash-command/model-runs.feature"
covered_digest: "v4:sha256:7e8386a49979249f38ffaafacf3f1bbdb079212c3a78eabc1a6c7b183605a9ab"
behavior_unverified: 0
overrides_applied: 3
overrides:
  - must_have: "03-06 truths: a project-scope install, update, reinstall, or enable lists each committed command in the user's ledger of that project; a ledger write failure keeps the ledger; removal forgets the names; cleanup before the ledger write; NODE_PROJECT_SKILL_LEDGER passed by the orchestrator (D-CF3-07)"
    reason: "User decision D-LOC-01 of 2026-11-02 (DUBIOUS-CHOICES DC-41; PROJECT.md:1797 'Reverses D-CF2-13, D-CF2-14, D-CF2-15, D-CF2-16, and D-CF3-07'; PROJECT.md:1829 D-CF3-07 marked 'Reversed 2026-11-02 (user, DC-41)'). The user called the user-folder ledger 'backwards security' and chose Pi's project trust as the only gate. 5ecd962 removed bridges/commands/project-ledger.ts and features/slash-command/project-provenance.feature. None of CMD-01..05 or the ROADMAP criteria requires the ledger. The trust gate that replaced it is pinned by features/plugin/project-trust.feature and features/plugin/project-locality.feature."
    accepted_by: "acolomba"
    accepted_at: "2026-11-02T15:52:30Z"
  - must_have: "03-07 truths: a project-scope command runs only when the user's ledger lists its name with the SHA-256 of the staged file, else aborts naming /claude:plugin reinstall; the check digests the text it fills; a project command runs after the named reinstall, an update, and disable plus enable (D-CF3-07)"
    reason: "Same user decision D-LOC-01 (DC-41), which reverses D-CF3-07. The invocation now refuses a listed project command only when Pi does not trust the project (orchestrators/command-invocation.ts:246-252), and an untrusted session never discovers it (index.ts:211). provenProjectSkills and commandFileDigest no longer exist."
    accepted_by: "acolomba"
    accepted_at: "2026-11-02T15:52:30Z"
  - must_have: "03-09 truth: npx cucumber-js features/slash-command --dry-run lists the six slash-command features listing, frontmatter, invocation, manifest-forms, lifecycle, and project-provenance"
    reason: "project-provenance.feature was deleted with the ledger under the user's D-LOC-01 decision (DC-41). features/slash-command now holds listing, frontmatter, invocation, manifest-forms, lifecycle, aliases (A.1 item 2) and model-runs (A.1 item 4); all 77 scenarios pass."
    accepted_by: "acolomba"
    accepted_at: "2026-11-02T15:52:30Z"
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Claude Code's <command-message> tag block before a typed command's body"
    addressed_in: "D-CF1-01 residual (BACKLOG CMDTAG-01)"
    evidence: "03-CONTEXT Deferred and 03-03-SUMMARY; BACKLOG.md:4667 is still open. Not part of CMD-01..05."
---

# Phase 3: Slash Commands Verification Report

**Phase Goal:** A bridged command looks to Pi the way Claude Code defines it: listed as a prompt template under its qualified name, its arguments expanded as decided, its frontmatter and manifest forms honored or licensed as a divergence, and the plugin lifecycle reflected in a new session.
**Verified:** 2026-11-03 (first verified 2026-11-01)
**Status:** passed
**Re-verification:** Yes. This run rechecks every criterion at `03f9a45` after the locality redesign (D-LOC-01) and the later command changes. See "Re-verification 2026-11-03" below.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A new session lists each bridged command as `/<plugin>:<name>`, nested directories colon-joined, with its description (CMD-01) | VERIFIED | `features/slash-command/listing.feature` (7 scenarios incl. outline rows): description listed, A2e fallback rows (heading, 60-char cut, `Plugin command`, empty `""`), unparseable frontmatter degraded, `build/web` -> `/demo:build:web`, CM-2 elision `demo-lint` -> `/demo:lint` (D-141-01), dotfile skip (CM-4). The fallback is written by `bridges/commands/staged-command.ts::stagedFrontmatter` (`descriptionFallback(body, "Plugin command")`), so Pi's 60-char rule never applies. Unchanged since 2026-11-01. I ran `npx cucumber-js features/slash-command`: 77 scenarios, 906 steps, all passed (seed 704779). |
| 2 | Invoking a command through the scripted model sends the model its body with `$ARGUMENTS`, positional arguments, and the appended-arguments rule per FG-01..FG-03; the model call log shows the whole message (CMD-02) | VERIFIED | `invocation.feature` (10): body + `\n\nARGUMENTS: Ada` append; outline rows for named, `$0`/`$1`, `$ARGUMENTS[1]`, missing index (`$2` kept + append), raw `$ARGUMENTS`, no-args empty; session id/effort filled at invocation; path variables (`:88`); `!` injection run once after substitution; failing `!` reports Claude Code's message as a `usage-error` and sends nothing; typed `!` argument arrives escaped and runs nothing; user-authored command keeps Pi's own 1-based expansion (D-CF1-03); stale file after uninstall refused; and (added after 2026-11-01, b48e1e4) a body that starts with another command reaches the model as it is. Code path: `edge/command-invocation.ts` (input handler, `projectTrusted: ctx.isProjectTrusted()` at `:63`, registered at `index.ts:286`) -> `orchestrators/command-invocation.ts::invokeStagedCommand` (`:274`) -> `prepareCommand` (trust refusal `:246-252`) -> argument substitution + `expandContextInjections` (`:219`). `features/plugin/project-locality.feature` "A project command runs its context command with no record of the install in the user scope" shows a trusted project command runs with no ledger. |
| 3 | `argument-hint`, `description`, path variables, `!` injection (FG-05), model invocation (FG-11), `user-invocable` (FG-12) each behave as upstream or carry a recorded divergence ID (CMD-03) | VERIFIED | `frontmatter.feature` (7): dropped-fields line `[deploy] dropped fields: model, effort` and the full ordered set (D-CF3-09, D-CF1-05); honored or own-decision fields report nothing; `user-invocable: false` stays listed and runnable (D-CF3-02); the system prompt lists no bridged command; `argument-hint` shown in the TUI menu (D-CF3-10). Path variables and injection in `invocation.feature`. **Model invocation (refreshed):** since 2026-11-01 the model can run a described command through the `run_plugin_command` tool (cd3b5b1, A.1 item 4). `model-runs.feature` (4): the tool lists described commands and leaves out `disable-model-invocation: true`; a run returns the filled body with `!` not run; the tool refuses a user-only command; a new session after the commands are gone offers no tool (LOC-04 guard, b9f40ad). The divergences from upstream (list in the tool description, body as the tool result) are recorded in DUBIOUS-CHOICES DC-39 item 3. The model sees commands as upstream intends, by a different channel, so FG-11 now behaves as upstream with recorded differences. PROJECT.md's D-CF3-01 row still describes the earlier gap (see Anti-Patterns). |
| 4 | A plugin with the object-map `commands` form and a plugin with a custom command directory install and list as FG-13 and FG-14 decide (CMD-04) | VERIFIED | `manifest-forms.feature` (22 scenarios/outlines), unchanged since 2026-11-01: declared file path, array of files and directories, non-`.md` file skipped with a warning (D-CF3-05); marketplace-entry paths ADD to `commands/` (D-CF3-04); manifest path REPLACES `commands/` with the shadowed-folder note (D-CF1-06); object map lists keys with manifest descriptions, source/content, both/neither -> unavailable, bad keys skipped, directory source walked, duplicate source keeps first, inline content kept and invokable, manifest `model` reported dropped, `argumentHint` in TUI, entry-map `content` dropped with warning. Code: `bridges/commands/discover.ts` and the commands arm of `domain/component-paths.ts`. |
| 5 | After disable, uninstall, or update a new session drops or replaces the command; after enable it offers it again (CMD-05) | VERIFIED | `lifecycle.feature` (6, unchanged): disable -> no templates; a disabled plugin's `/demo:greet` reaches the model as typed text; enable restores the listing; uninstall -> none; update shows the new description and sends the new body. `invocation.feature:191` pins the stale-file refusal between uninstall and `/reload`. The 10 `project-provenance.feature` scenarios that the 2026-11-01 report also cited here were deleted with the ledger (D-LOC-01). They covered ledger bookkeeping, not the listing transition this criterion asks for. |

**Score:** 5/5 truths verified (0 present, behavior-unverified). The lifecycle and invocation truths are behavior-dependent (state transitions). Each has a passing cucumber scenario that exercises the transition, so none rests on symbol presence. Plan must-haves of 03-06, 03-07 and one of 03-09 are carried as PASSED (override) under the user's D-LOC-01 decision (3 overrides).

### Decision Compliance (D-CF3-01..13)

| Decision | Honored | Evidence |
|----------|---------|----------|
| D-CF3-01 model invocation (Pi gap) | Superseded in effect | No Skill staging, and the system prompt still lists no command. The model now runs described commands through `run_plugin_command` (A.1 item 4, DC-39 item 3; `model-runs.feature`). PROJECT.md:1823 was not updated. |
| D-CF3-02 `user-invocable: false` listed and runnable | Yes | frontmatter.feature two scenarios; the tool refuses it for the model (`model-runs.feature:80`) |
| D-CF3-03 object map | Yes | `discover.ts` map arm; manifest-forms scenarios |
| D-CF3-04 entry `commands` adds, never shadows | Yes | manifest-forms.feature `:33`, `:74`, `:345`, `:759` |
| D-CF3-05 declared file paths | Yes | `discoverDeclaredPath`, scenarios at `:7`, `:194`, `:238` |
| D-CF3-06 invocation wiring | Yes | `edge/command-invocation.ts` + `orchestrators/command-invocation.ts`. The E8 residual is fixed by the zero-width-space guard (b48e1e4, `invocation.feature:213`). |
| D-CF3-07 project provenance ledger | Reversed by the user (D-LOC-01, DC-41) | `bridges/commands/project-ledger.ts` and `project-provenance.feature` are deleted (5ecd962). Project commands, aliases and the command tool are gated on `ctx.isProjectTrusted()` alone: `command-invocation.ts:249,380`, `edge/command-tool.ts:116,132`, discovery `index.ts:211`. Pinned by `features/plugin/project-trust.feature` (untrusted command, alias, tool) and `project-locality.feature`. |
| D-CF3-08 description fallback | Yes | `stagedFrontmatter` + listing outline |
| D-CF3-09 dropped fields | Yes | `buildStagedCommand` returns `droppedFields`; frontmatter.feature |
| D-CF3-10 argument-hint, path variables | Yes | TUI scenario; `commandVariables` |
| D-CF3-11 lifecycle | Yes | lifecycle.feature |
| D-CF3-12 listing pins | Yes | listing.feature CM-2, CM-4, nested |
| D-CF3-13 ownership | Yes (at phase close) | Measured on 2026-11-01 against `0e360ca`. Later milestone work changed `index.ts` and the shared cores by design. |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `bridges/commands/staged-command.ts` | VERIFIED | Rebuilds frontmatter, read-back assertion, dropped-fields line; consumed by `stage.ts` |
| `bridges/commands/command-record.ts` | VERIFIED | Written at stage, read by `orchestrators/command-invocation.ts::commandVariables` |
| `bridges/commands/project-ledger.ts` | REMOVED (by decision) | Deleted under D-LOC-01. Covered by the 03-06 override. |
| `bridges/commands/discover.ts` | VERIFIED | Map, declared-path and directory arms all exercised |
| `edge/command-invocation.ts` | VERIFIED | Registered at `index.ts:286` after `registerSkillAliases` (`:283`) |
| `edge/command-tool.ts` | VERIFIED (added after phase close) | Registered at `index.ts:292`; `model-runs.feature` |
| `orchestrators/command-invocation.ts` | VERIFIED | Wired from the edge handler by default argument; unit-tested |
| `features/slash-command/*.feature` (7) + 4 step modules | VERIFIED | 77 scenarios pass |

### Key Links

| From | To | Status |
|------|----|--------|
| `index.ts` -> `registerCommandInvocation` | Pi `input` event | WIRED (`index.ts:286`) |
| `edge/command-invocation.ts` -> `invokeStagedCommand` | staged prompt file under either scope's `resources/prompts/` | WIRED (located by `pi.getCommands()` `sourceInfo.path`) |
| `stage.ts` -> `buildStagedCommand` -> record in frontmatter -> invocation `readCommandRecord` | `${CLAUDE_PLUGIN_ROOT}`/`DATA` for typed arguments | WIRED |
| commit/unstage -> project ledger -> `provenProjectSkills` in invocation | provenance refusal | REMOVED (by decision); replaced by the trust gate `command-invocation.ts:246-252` |
| `index.ts` -> `registerCommandTool` | `run_plugin_command` tool | WIRED (`index.ts:292`) |
| resolver `commandMap`/`commands` -> `discoverPluginCommands` | object-map and file-path forms | WIRED |

`gsd-tools query verify.artifacts` and `verify.key-links` pass for 03-01..05, 03-08 and 03-09. 03-06 (artifacts 0/2, links 1/3) and 03-07 (artifacts 0/2, links 0/2) fail only on the ledger files, the `NODE_PROJECT_SKILL_LEDGER` pattern, `provenProjectSkills(` and `commandFileDigest(`, all removed under D-LOC-01. These are covered by the overrides above.

### Data-Flow Trace

| Data | Source | Real data | Status |
|------|--------|-----------|--------|
| Listed description | staged frontmatter written from the source file or fallback | yes (asserted against Pi's registry probe) | FLOWING |
| Message to the model | staged file read once at invocation, filled with typed args | yes (asserted in the scripted model's call log) | FLOWING |
| Tool description and tool result | staged commands of trusted scopes, filled body | yes (asserted in the model call's tool list and tool result) | FLOWING |
| Lifecycle state | `state.json` + staged dir after each verb | yes (asserted in a new session's probe) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 3 behavioral suite | `npx cucumber-js features/slash-command` | 77 scenarios, 906 steps passed (seed 704779) | PASS |
| Trust and locality (incl. untrusted command, alias, tool) | `npx cucumber-js features/plugin/autoapply.feature features/plugin/project-trust.feature features/plugin/project-locality.feature` | 42/42 scenarios (seed 513417) | PASS |
| Commands bridge, invocation, tool, resolver unit tests | `node --test test/bridges/commands/*.test.ts test/orchestrators/command-invocation.test.ts test/edge/command-invocation.test.ts test/edge/command-tool.test.ts test/domain/component-paths.test.ts` | 264 tests, 0 failed | PASS |
| Full gate (parent-measured, not re-run) | `npm run check` at `b9f40ad` | exit 0, cucumber 1537/1537; only 03d7c97 changed code after it, outside the commands path | PASS (reused) |

### Probe Execution

Step 7c: SKIPPED. No probe scripts declared by the plans.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| CMD-01 | 03-01, 03-09 | Lists `/<plugin>:<name>` with description | SATISFIED | listing.feature, `staged-command.ts` |
| CMD-02 | 03-03, 03-06, 03-07, 03-09 | Body with `$ARGUMENTS`, positional, append rule | SATISFIED | invocation.feature, `orchestrators/command-invocation.ts` |
| CMD-03 | 03-02, 03-03, 03-09 | Frontmatter and content variants or recorded divergence | SATISFIED | frontmatter.feature, model-runs.feature; D-CF3-02/09/10, DC-39 item 3 |
| CMD-04 | 03-04, 03-08, 03-09 | Object map and custom directories | SATISFIED | manifest-forms.feature, `discover.ts` |
| CMD-05 | 03-05, 03-06, 03-09 | Disable/uninstall/update/enable in a new session | SATISFIED | lifecycle.feature |

All five IDs appear in plan frontmatter and in REQUIREMENTS.md (lines 76-80, `[x]`; traceability rows 183-187, `Complete`). No orphaned requirement.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` in the phase's source or feature files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/PROJECT.md` | 1823 | D-CF3-01 still says the model has no way to run a bridged command and cites BACKLOG CMDMODEL-01 | ℹ️ Info | Record lag. `run_plugin_command` exists (README.md:115, DC-39 item 3). |
| `.planning/BACKLOG.md` | 4663, 4671 | CMDNAME-01 (command frontmatter-name aliases) and CMDMODEL-01 (commands for the model) are still open | ℹ️ Info | Both shipped (db5622a, cd3b5b1). The parent may close them. |

### Human Verification Required

None. Every success criterion is observed through cucumber against a real profile Pi.

### Gaps Summary

No gaps. Listing, argument expansion, frontmatter and manifest forms, and lifecycle are implemented, wired, and proven by behavioral scenarios. The project provenance ledger that plans 03-06 and 03-07 built is gone by the user's decision (D-LOC-01). None of the ROADMAP criteria needs it. Its plan must-haves are carried as overrides that cite that decision.

## Re-verification 2026-11-03

**What I rechecked:** all five ROADMAP criteria and CMD-01..05 at `03f9a45`. I ran `features/slash-command` (77/77), the trust, locality and autoapply features (42/42), and the command unit tests (264/264). I also ran the artifact and key-link checks on all nine plans.

**What changed since 2026-11-01:**

- **D-CF3-07 reversed (D-LOC-01, 5ecd962).** `bridges/commands/project-ledger.ts` and `features/slash-command/project-provenance.feature` (10 scenarios) no longer exist. I dropped them from `covered_files`. The old report cited them for SC5 and in the decision table as "Yes". They now show as reversed. Plans 03-06 and 03-07, and one 03-09 truth, describe the ledger. They are carried as three overrides that cite the user's decision. The overrides use the decision's date. They were not separately signed, so the parent should confirm them with the user.
- **Trust through Pi alone.** A listed project command in an untrusted project now refuses with "...which Pi does not trust. Trust the project folder, then run /reload" (`command-invocation.ts:249-252`). An untrusted session discovers no project command (`project-trust.feature`).
- **Added after phase close and now part of the evidence:** `aliases.feature` (command frontmatter-name aliases, db5622a), `model-runs.feature` (`run_plugin_command`, cd3b5b1; W4 guard b9f40ad), and the second-expansion fix (b48e1e4). These closed two of the three deferred items: frontmatter-name aliases and commands for the model. Only the `<command-message>` tag block (CMDTAG-01) stays deferred.
- Line references moved: `index.ts:286/292`, `command-invocation.ts:249,274,380`.
- Added to `covered_files`: `edge/command-tool.ts`, `features/slash-command/aliases.feature`, `features/slash-command/model-runs.feature`, `features/plugin/project-trust.feature`, `features/plugin/project-locality.feature`. The digest is recomputed.

**Verdict:** still passed, 5/5 roadmap criteria. No gap. Two Info items for the parent: stale D-CF3-01 row, and stale CMDNAME-01/CMDMODEL-01 backlog items.

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
