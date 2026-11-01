---
phase: 03-slash-commands
verified: 2026-11-01T23:59:00Z
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
  - "extensions/pi-claude-marketplace/bridges/commands/project-ledger.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/commands/staged-command.ts"
  - "extensions/pi-claude-marketplace/domain/component-paths.ts"
  - "extensions/pi-claude-marketplace/edge/command-invocation.ts"
  - "extensions/pi-claude-marketplace/orchestrators/command-invocation.ts"
  - "features/slash-command/frontmatter.feature"
  - "features/slash-command/invocation.feature"
  - "features/slash-command/lifecycle.feature"
  - "features/slash-command/listing.feature"
  - "features/slash-command/manifest-forms.feature"
  - "features/slash-command/project-provenance.feature"
covered_digest: "v4:sha256:cd999587f4e94d45c134e94be9259d5c8cb0f331e66dea815fc731e5bf309728"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "Command frontmatter `name` aliases (/<plugin>:<name> and bare /<name>), E9"
    addressed_in: "Backlog parent line (03-09-SUMMARY, group of parent lines)"
    evidence: "03-CONTEXT Deferred: 'deferred to a backlog line (parent line), P3-DC.' Not part of CMD-01..05."
  - truth: "Commands visible to and runnable by the model (FG-11 upstream behavior)"
    addressed_in: "Recorded Pi gap (D-CF3-01), RM-02 real-model proof, Pi gap report gap 4"
    evidence: "D-CF3-01 licenses the divergence; scenario 'The model's system prompt lists no bridged command' pins it."
  - truth: "Claude Code's <command-message> tag block, and E8 literal send of a body that starts with /<template>"
    addressed_in: "D-CF1-01 residual (BACKLOG CMDTAG-01); Pi gap report gap 6"
    evidence: "03-CONTEXT Deferred and 03-03-SUMMARY 'E8 residual'; two unit cases pin Pi's second expansion."
---

# Phase 3: Slash Commands Verification Report

**Phase Goal:** A bridged command looks to Pi the way Claude Code defines it: listed as a prompt template under its qualified name, its arguments expanded as decided, its frontmatter and manifest forms honored or licensed as a divergence, and the plugin lifecycle reflected in a new session.
**Verified:** 2026-11-01
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A new session lists each bridged command as `/<plugin>:<name>`, nested directories colon-joined, with its description (CMD-01) | VERIFIED | `features/slash-command/listing.feature` (7 scenarios incl. outline rows): description listed, A2e fallback rows (heading, 60-char cut, `Plugin command`, empty `""`), unparseable frontmatter degraded, `build/web` -> `/demo:build:web`, CM-2 elision `demo-lint` -> `/demo:lint` (D-141-01), dotfile skip (CM-4). Fallback is written by `bridges/commands/staged-command.ts::stagedFrontmatter` (`descriptionFallback(body, "Plugin command")`), so Pi's 60-char rule never applies. I ran `npx cucumber-js features/slash-command`: 78 scenarios, 939 steps, all passed (seed 800431). |
| 2 | Invoking a command through the scripted model sends the model its body with `$ARGUMENTS`, positional arguments, and the appended-arguments rule per FG-01..FG-03; the model call log shows the whole message (CMD-02) | VERIFIED | `invocation.feature`: body + `\n\nARGUMENTS: Ada` append; outline rows for named, `$0`/`$1`, `$ARGUMENTS[1]`, missing index (`$2` kept + append), raw `$ARGUMENTS`, no-args empty; session id/effort filled at invocation; path variables; `!` injection run once after substitution; failing `!` reports Claude Code's message as a `usage-error` and sends nothing; typed `!` argument arrives escaped and runs nothing; user-authored command keeps Pi's own 1-based expansion (D-CF1-03). Code path: `edge/command-invocation.ts` (input handler, `interactive`/`rpc` only, registered at `index.ts:274`) -> `orchestrators/command-invocation.ts::invokeStagedCommand` -> `substituteArguments` + `expandContextInjections`, transform text returned. Assertions compare whole message text in the call log. |
| 3 | `argument-hint`, `description`, path variables, `!` injection (FG-05), model invocation (FG-11), `user-invocable` (FG-12) each behave as upstream or carry a recorded divergence ID (CMD-03) | VERIFIED | `frontmatter.feature`: dropped-fields line `[deploy] dropped fields: model, effort` and the full ordered set (D-CF3-09, D-CF1-05); honored/own-decision fields (`allowed-tools`, `arguments`, `shell`, `argument-hint`, `user-invocable`, `disable-model-invocation`) report nothing; `user-invocable: false` stays listed and runnable (D-CF3-02); system prompt lists no bridged command (D-CF3-01, Pi gap); `argument-hint` shown in the TUI menu (`<environment> -- [t] Deploys the branch.`) (D-CF3-10). Path variables and injection in `invocation.feature`. Divergences carry D-CF3-01/02/09/10 and D-CF1-05 rows in 03-09-SUMMARY. |
| 4 | A plugin with the object-map `commands` form and a plugin with a custom command directory install and list as FG-13 and FG-14 decide (CMD-04) | VERIFIED | `manifest-forms.feature` (23 scenarios/outlines): declared file path, array of files and directories, non-`.md` file skipped with a warning (D-CF3-05); marketplace-entry paths ADD to `commands/` with no folder note (D-CF3-04); manifest path REPLACES `commands/` with the shadowed-folder note (D-CF1-06); object map lists keys with manifest descriptions, source/content, both/neither -> unavailable, bad keys skipped with warning, directory source walked, duplicate source keeps first, inline content frontmatter kept and invokable, manifest `model` reported as dropped, `argumentHint` in TUI, entry-map `content` dropped with warning. Code: `bridges/commands/discover.ts` (`discoverDeclaredPath`, `discoverMapSource`, `discoverMapContent`, `MAP_KEY_RULES`, first-wins `admitCommand`) and the commands arm of `domain/component-paths.ts`. |
| 5 | After disable, uninstall, or update a new session drops or replaces the command; after enable it offers it again (CMD-05) | VERIFIED | `lifecycle.feature` (6 scenarios): disable -> no templates; disabled plugin's `/demo:greet` reaches the model as typed text; enable restores listing; uninstall -> none; update shows new description (listing) and new body (model call log). `invocation.feature` pins the stale-file refusal between uninstall and `/reload`. `project-provenance.feature` (10 scenarios) pins ledger record/forget on install, update, disable/enable, and failed-ledger-write rollback (review fix 00714ec). |

**Score:** 5/5 truths verified (0 present, behavior-unverified). The lifecycle and invocation truths are behavior-dependent (state transitions); each has a passing cucumber scenario that exercises the transition, so none rests on symbol presence.

### Decision Compliance (D-CF3-01..13)

| Decision | Honored | Evidence |
|----------|---------|----------|
| D-CF3-01 model invocation (Pi gap) | Yes | No Skill staging; negative scenario on system prompt; `disable-model-invocation` not reported as dropped |
| D-CF3-02 `user-invocable: false` listed and runnable | Yes | frontmatter.feature two scenarios |
| D-CF3-03 object map | Yes | `discover.ts` map arm; 13 manifest-forms scenarios |
| D-CF3-04 entry `commands` adds, never shadows | Yes | manifest-forms.feature lines 33, 74, 345, 759 |
| D-CF3-05 declared file paths | Yes | `discoverDeclaredPath`, scenarios at 7, 194, 238 |
| D-CF3-06 invocation wiring | Yes | `edge/command-invocation.ts` + `orchestrators/command-invocation.ts`; E8 recorded as residual with unit tests (`test/orchestrators/command-invocation.test.ts:275`, `test/edge/command-invocation.test.ts:268`) |
| D-CF3-07 project provenance ledger | Yes | `bridges/commands/project-ledger.ts`, `unprovenRefusal` (digest of the one read text), 10 provenance scenarios; no `bridges/skills/` import from the commands bridge |
| D-CF3-08 description fallback | Yes | `stagedFrontmatter` + listing outline |
| D-CF3-09 dropped fields | Yes | `buildStagedCommand` returns `droppedFields`; frontmatter.feature |
| D-CF3-10 argument-hint, path variables | Yes | TUI scenario; `commandVariables` |
| D-CF3-11 lifecycle | Yes | lifecycle.feature |
| D-CF3-12 listing pins | Yes | listing.feature CM-2, CM-4, nested |
| D-CF3-13 ownership | Yes | `git diff 0e360ca HEAD --stat` on the frozen cores (`argument-substitution`, `shell-words`, `context-injection`, `description-fallback`, `invocation-frontmatter`, `platform/prompt-shell`), `index.ts`, and `features/lib/pi-tui.ts` is empty; `git log bf0b58f..HEAD` on Phase 2's skill files and `index.ts` is empty |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `bridges/commands/staged-command.ts` | VERIFIED | Substantive (rebuilds frontmatter, read-back assertion, dropped-fields line); consumed by `stage.ts` |
| `bridges/commands/command-record.ts` | VERIFIED | Written at stage, read by `orchestrators/command-invocation.ts::commandVariables` |
| `bridges/commands/project-ledger.ts` | VERIFIED | Digest helper used by invocation and by stage/unstage record paths |
| `bridges/commands/discover.ts` | VERIFIED | 764 lines; map, declared-path and directory arms all exercised |
| `edge/command-invocation.ts` | VERIFIED | Registered in `index.ts:274` after `registerSkillAliases` |
| `orchestrators/command-invocation.ts` | VERIFIED | Wired from the edge handler by default argument; unit-tested |
| `features/slash-command/*.feature` (6) + 4 step modules | VERIFIED | 78 scenarios pass |

### Key Links

| From | To | Status |
|------|----|--------|
| `index.ts` -> `registerCommandInvocation` | Pi `input` event | WIRED |
| `edge/command-invocation.ts` -> `invokeStagedCommand` | staged prompt file under either scope's `resources/prompts/` | WIRED (locate by `pi.getCommands()` `sourceInfo.path`) |
| `stage.ts` -> `buildStagedCommand` -> record in frontmatter -> invocation `readCommandRecord` | `${CLAUDE_PLUGIN_ROOT}`/`DATA` for typed arguments | WIRED |
| commit/unstage -> project ledger -> `provenProjectSkills` in invocation | provenance refusal | WIRED |
| resolver `commandMap`/`commands` -> `discoverPluginCommands` | object-map and file-path forms | WIRED |

### Data-Flow Trace

| Data | Source | Real data | Status |
|------|--------|-----------|--------|
| Listed description | staged frontmatter written from the source file or fallback | yes (asserted against Pi's registry probe) | FLOWING |
| Message to the model | staged file read once at invocation, filled with typed args | yes (asserted in the scripted model's call log) | FLOWING |
| Lifecycle state | `state.json` + staged dir after each verb | yes (asserted in a new session's probe) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 3 behavioral suite | `npx cucumber-js features/slash-command` | 78 scenarios, 939 steps passed, exit 0 | PASS |
| Commands bridge, invocation, resolver unit tests | `node --test test/bridges/commands/*.test.ts test/orchestrators/command-invocation.test.ts test/edge/command-invocation.test.ts test/domain/component-paths.test.ts` | 269 tests, 0 failed | PASS |
| Full gate (orchestrator-measured, not re-run) | `npm run check` on `a041d22` | exit 0, 1453 scenarios passed; `fallow dupes` exit 0 | PASS (reported) |

### Probe Execution

Step 7c: SKIPPED. No probe scripts declared by the plans; the registry probe in the cucumber harness was exercised through the scenarios above.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| CMD-01 | 03-01, 03-09 | Lists `/<plugin>:<name>` with description | SATISFIED | listing.feature, `staged-command.ts` |
| CMD-02 | 03-03, 03-06, 03-07, 03-09 | Body with `$ARGUMENTS`, positional, append rule | SATISFIED | invocation.feature, `orchestrators/command-invocation.ts` |
| CMD-03 | 03-02, 03-03, 03-09 | Frontmatter and content variants or recorded divergence | SATISFIED | frontmatter.feature; D-CF3-01/02/09/10 |
| CMD-04 | 03-04, 03-08, 03-09 | Object map and custom directories | SATISFIED | manifest-forms.feature, `discover.ts` |
| CMD-05 | 03-05, 03-06, 03-09 | Disable/uninstall/update/enable in a new session | SATISFIED | lifecycle.feature, project-provenance.feature |

All five IDs appear in plan frontmatter and in REQUIREMENTS.md (lines 76-80). No orphaned requirement: REQUIREMENTS.md maps only CMD-01..05 to Phase 3, and every one is claimed by at least one plan.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` in the phase's source or feature files. Code review (03-REVIEW.md, iteration 2) is clean (0 critical, 0 warning); WR-01/WR-02 fixed with red proofs (commits 00714ec, 0822dc3). Security (03-SECURITY.md): `status: secured`, `threats_open: 0`. Info items IN-01..IN-05 (for example, a list-form `argument-hint` dropped with no warning) were out of fix scope and do not touch a success criterion.

### Human Verification Required

None. Every success criterion is observed through cucumber against a real profile Pi. Items that need a person are deferred, not blocking:

- Real-model confirmation that Claude Code lists plugin commands to the model (RM-02, already owned elsewhere).
- Whether to file the Pi gap report (the draft is not posted by design, D-CF2-10).

### Gaps Summary

No gaps. The goal is achieved: listing, argument expansion, frontmatter/manifest forms and lifecycle are implemented, wired, and proven by behavioral scenarios, and every divergence (model invocation, `user-invocable`, E8 re-expansion, missing tag block, CM-2 elision, dotfile skip, map-key naming, warnings where upstream is silent) carries a decision ID.

Housekeeping for the parent (not gaps): REQUIREMENTS.md still shows CMD-01..05 as Pending and ROADMAP.md Phase 3 as unchecked; the 03-09 SUMMARY holds the D-CF3 rows and parent lines that the parent applies at merge.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_

## Dubious Choices

None by this verification. Observations the parent may want to weigh: (1) I did not re-run the full `npm run check`; I relied on the orchestrator's measurement for `a041d22` and re-ran only the slash-command cucumber features and the focused unit tests. (2) I judged D-CF3-04's install warning for a dropped marketplace-entry `content` entry (upstream is silent) as a licensed divergence, since it is recorded in the decision text.
