---
phase: 05-mcp-install-legacy-move-and-overrides
verified: 2026-11-22T14:30:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - ".planning/phases/05-mcp-install-legacy-move-and-overrides/05-01-PLAN.md"
  - ".planning/phases/05-mcp-install-legacy-move-and-overrides/05-01-SUMMARY.md"
  - ".planning/phases/05-mcp-install-legacy-move-and-overrides/05-02-PLAN.md"
  - ".planning/phases/05-mcp-install-legacy-move-and-overrides/05-02-SUMMARY.md"
  - ".planning/phases/05-mcp-install-legacy-move-and-overrides/05-03-PLAN.md"
  - ".planning/phases/05-mcp-install-legacy-move-and-overrides/05-03-SUMMARY.md"
  - "features/lib/installation-record.ts"
  - "features/lib/mcp-configuration.ts"
  - "features/mcp-server/configuration.feature"
  - "features/mcp-server/legacy-move.feature"
  - "features/mcp-server/lifecycle.feature"
  - "features/mcp-server/options.feature"
  - "features/mcp-server/verdict-list.feature"
  - "features/step_definitions/mcp-configuration.steps.ts"
  - "features/step_definitions/mcp-implementation.steps.ts"
  - "features/step_definitions/mcp-server/legacy-move.steps.ts"
  - "features/step_definitions/mcp-server/lifecycle.steps.ts"
  - "features/step_definitions/session.steps.ts"
  - "test/integration/mcp-migration.test.ts"
  - "test/integration/mcp-verdict-list.test.ts"
  - "test/integration/mcp-verdict-migration.test.ts"
covered_digest: "v4:sha256:546e0dff455f94098e9f6db3a2d62c364ae1a6f23ca4231af26f4747d1647470"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 5: MCP Install, Legacy Move, and Overrides Verification Report

**Phase Goal:** Cucumber scenarios prove the MCP install refusals, warnings, and variable handling, the move of a legacy `mcp.json` with its notices, and the pi-mcp-adapter override cases, and the integration cases they replace are gone.
**Verified:** 2026-11-22T14:30:00Z
**Status:** passed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths (ROADMAP success criteria; the PLAN truths restate them in more detail)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1 / ITMIG-09: a `~/` stdio arg is refused with `{unsupported mcp}` and the `--partial` hint, `--partial` installs without that server, and tool permission rules warn. The scenarios pass under both profiles and fail under a break. `mcp-home-path-partial` and `mcp-tool-rules` are gone | VERIFIED | `configuration.feature:678` (`@mcp`: `partially-available`, `unsupported mcp`, `partial-install` hint, `the files of the project scope are unchanged`), `:699` (`partially-installed`, the whole `mcp-adapter.json` text without `home`), `:748` (`tool-rules-unenforced` naming both fields, whole file text). Both integration files are absent. I ran `:678` under adapter and builtin and both passed. The M1 and M2 break logs exit 1 under both profiles, and `red.log` prints `RED-PROOFS OK` |
| 2 | SC2 / ITMIG-09: AVAR-04 notices after the rows on update, reinstall, and enable; AVAR-05; `${CLAUDE_PROJECT_DIR}` expanded; `!` written as `!!`; no secret in `mcp-adapter.json`; D-PG10-11 five fields. Both profiles, a break for each, cases gone from `mcp-variable-expansion` | VERIFIED | `configuration.feature:789` (whole file: `{project dir}`, `"MODE": "!!fast"`, `${PI_CM_AVAR_TOKEN}` kept as a reference while Pi runs with the sentinel value set), `:848` (`credentials-blanked`, `"Authorization": "Bearer "`), `:894`, `:920`, `:943` (notices after the cascade row). `the command reports these results:` compares results in emission order (`command.steps.ts:191-203`), so the order is checked. Outline rows `:448`, `:449`, `:491`, and `options.feature:621` (all five fields hold a `${PI_CLAUDE_MARKETPLACE_OPTION_*}` reference). `mcp-variable-expansion.test.ts` is deleted whole. I ran `:894` under both profiles and both passed. Breaks M3 to M10, M3b, M3c, and M9b are logged |
| 3 | SC3 / ITMIG-10: the install sweep (AMIG-02) keeps the user's servers; one load notice for both scopes, project rows first; AMIG-04 unowned warnings; undeclared, unsupported, and malformed entries reported; a plugin that lists as partly installed. Both profiles, a break for each, cases gone from `mcp-legacy-sweep`, `mcp-migration`, and `mcp-verdict-migration` | VERIFIED | `legacy-move.feature` has 17 new `@mcp` scenarios (`:305` to `:1210`, including the review-added `:908`). They check whole `mcp.json`/`mcp-adapter.json` texts and whole-scope unchanged steps. `:629` lists the project row before the user row, `:686` and `:733` report `unowned`, `:968` reports `not-declared` and `unsupported-feature`, `:1031` and `:1072` report malformed (with the MCPMIG-01 comment at `:1070`), `:1129` reports the stub, `:1176` removes the user stub from the project file, and `:1210` covers a cold clone cache. `verdict-list.feature:304`/`:333` are a licensed `@adapter-only`/`@builtin-only` pair (partially installed under the adapter), and `:362` is the MREC-02 row. `mcp-legacy-sweep.test.ts` is absent. `mcp-migration.test.ts` keeps only the fault-injection case (`:113`), and `mcp-verdict-migration.test.ts` keeps only its three released-build record cases (`:120`, `:152`, `:202`), each under an ITSCOPE-01 header. I ran `:629`, `:686`, `:304`, `:333`, and `:362` under both profiles and all passed |
| 4 | SC4 / ITMIG-11: the override cases (a user stub kept and written back, a user plugin disabled in the project through install/update/reinstall/uninstall, `/mcp-adapter enable` surviving, an update dropping and then restoring a server's choice, `openUi`/`trace` kept on reinstall). Both profiles, a break for each, cases gone from `mcp-override-lifecycle` | VERIFIED | `lifecycle.feature` has 25 new `@mcp` scenarios (`:1149` to `:2298`) with whole-file `mcp-adapter.json` checks and `mcp.json does not exist` checks. They cover the stub kept and written back (`:1149`, `:1213`), the project disable through install, update, reinstall, and uninstall (`:1256`, `:1315`, `:1383`, `:1442`, plus `:2298`), the enable surviving (`:1480`, `:1514`, `:1570`), carried fields and the ANAME-07 timeout (`:1604` to `:1733`), dropped and restored choices (`:1985`, `:2030`), `openUi`/`trace` on reinstall (`:2096`), foreign `serverChoices` (`:2146`, `:2204`), and the emptied stub (`:2262`). `mcp-override-lifecycle.test.ts` is absent. I ran `:1149` and `:1985` under both profiles and all passed. Breaks O1 to O10 are logged, plus K1 from the review |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

**Tag deviation from the ROADMAP Notes (accepted by recorded decision):** the Notes ask for `@adapter-only` on the legacy-move and override scenarios. CONTEXT `[Tags, after research]` supersedes this with `@mcp`, because the extension writes `mcp-adapter.json` the same way under either implementation. Success criteria 3 and 4 require "pass under both profiles", and `@mcp` is what makes that true. The one case that differs between implementations (MREC-03) is a licensed pair. This is not a gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/mcp-server/configuration.feature` | 8 new scenarios and 3 Outline rows (ITMIG-09) | VERIFIED | Present, `@mcp`, whole-file checks |
| `features/mcp-server/options.feature` | D-PG10-11 five-field scenario | VERIFIED | `:621` |
| `features/mcp-server/legacy-move.feature` | sweep and move scenarios (ITMIG-10) | VERIFIED | 17 new scenarios |
| `features/mcp-server/verdict-list.feature` | VL1/VL2 pair and VL3 | VERIFIED | `:304`, `:333`, `:362` |
| `features/mcp-server/lifecycle.feature` | 25 override scenarios (ITMIG-11) | VERIFIED | `:1149` to `:2298` |
| `mcp-implementation.steps.ts` env-variable Given | starts the profile Pi with one variable set | VERIFIED (WIRED) | used 12 times in features |
| `legacy-move.steps.ts` release 0.19.2 `mcp.json` Given | writes the legacy text | VERIFIED (WIRED) | used 7 times |
| `session.steps.ts` "which warned" Given | setup session that warns | VERIFIED (WIRED) | used |
| `lifecycle.steps.ts` enable and whole-file Givens | the JSON rewrite of `/mcp-adapter enable`; whole-file write | VERIFIED (WIRED) | used 5 and 2 times. The enable Given asserts the precondition `disabled === true`, as the deleted integration case did |
| Five deleted integration files | absent | VERIFIED | `home-path-partial`, `tool-rules`, `variable-expansion`, `legacy-sweep`, and `override-lifecycle` are absent, and no reference to them remains outside `.planning` |
| Three trimmed integration files | only internal cases, with ITSCOPE-01 headers | VERIFIED | 1, 3, and 2 cases, matching CONTEXT [Kept cases] |

### Key Link Verification

There are no PLAN `key_links`. The links that matter are the step definitions behind the Then steps the scenarios rely on: `the command reports these results:` (emission order, `command.steps.ts:198`), `the files of the project scope are unchanged` (whole scope), and `the mcp configuration file ... holds this text:` (whole text). All three are wired, and they compare whole values.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| 9 scenarios across SC1 to SC4 (`configuration:678,:894`, `legacy-move:629,:686`, `verdict-list:304,:333,:362`, `lifecycle:1149,:1985`) under adapter | `node scripts/cucumber.mjs --profile adapter --parallel 2 <9 refs>` | `8 scenarios (8 passed)`, exit 0 (`:333` is `@builtin-only`, so the profile filters it out) | PASS |
| The same scenarios under builtin | `--profile builtin` | `8 scenarios (8 passed)`, exit 0 (`:304` is `@adapter-only`, so the profile filters it out) | PASS |
| Red-proof records | `tail red.log` in `phase05-plan0{1,2,3}/` | each prints `RED-PROOFS OK` and `exit=0`; the 86 break logs end `restored=clean` | PASS |
| No product code changed | `git diff --stat 356f8bb..HEAD -- extensions/` | empty | PASS |

Logs: `/tmp/claude-0/-home-user-pi-claude-marketplace/ba73c1d1-11d2-59e0-b5d6-895ae262ca9f/scratchpad/spot-adapter.log`, `/tmp/claude-0/-home-user-pi-claude-marketplace/ba73c1d1-11d2-59e0-b5d6-895ae262ca9f/scratchpad/spot-builtin.log`.

### Probe Execution

Not applicable: the phase declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ITMIG-09 | 05-01 | MCP install refusals, warnings, variable handling, D-PG10-11 | SATISFIED | Truths 1 and 2 |
| ITMIG-10 | 05-02 | legacy `mcp.json` sweep and move, notices, list rows | SATISFIED | Truth 3. Every item of the requirement maps to a scenario: cold cache `:1210`, stub notice `:1129`, user stub `:1176`, user-scope install `:552`, trace-less record `verdict-list:362` |
| ITMIG-11 | 05-03 | pi-mcp-adapter override cases | SATISFIED | Truth 4, including carried fields `:1656`/`:1733`, the ANAME-07 stub timeout `:1687`, foreign `serverChoices` `:2146`/`:2204`, and the emptied stub `:2262` |

No orphaned requirements: REQUIREMENTS.md maps only ITMIG-09, ITMIG-10, and ITMIG-11 to Phase 5, and the plans claim all three. Their traceability rows still read `Pending`. That bookkeeping is the orchestrator's to update.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| none | - | No TBD, FIXME, XXX, TODO, or HACK in the files this phase changed | - | - |
| `features/mcp-server/legacy-move.feature` | 686-731, 1210+ | The `unowned` and `source-unreadable` warnings are stated twice | Info | Documented harness behavior: Pi's RPC `new_session` binds the extension twice (RESEARCH Pitfall 2). It is not a product defect, and the table pins the count |
| `test/integration/mcp-verdict-migration.test.ts` | header | The kept cases still pin some rendered text that no scenario shows yet | Info | The ROADMAP keeps these cases for Phase 8, and the header says so honestly. Phase 8's rescope should decide them |

### Recorded Survivor and Accepted Findings

- V2 survives under the adapter profile and fails VL3 under builtin, so VL3 still has a must-fail proof under one profile. Plan 02's truths name this as the one recorded survivor. Not a gap.
- `fallow audit` reports `weakened-tests` on the deleted and trimmed integration files. The user decided on 2026-11-21 to accept these at PR review. Not a gap.

### Human Verification Required

None. Every truth is a behavior that cucumber scenarios exercise, those scenarios pass, and recorded breaks fail them.

### Gaps Summary

None. Each success criterion maps to substantive `@mcp` scenarios (or a licensed pair) that compare whole files or whole scopes and run under both profiles. Spot runs under both profiles passed, and each plan's red-proof checker passed. The five integration files the phase replaces are gone, and the three trimmed files keep only the internal cases the ROADMAP reserves for Phase 8. No file under `extensions/` changed.

One thing this report does not cover: the orchestrator's full gate on `80cced2`, which includes the iteration-2 harness fixes, was still running when this check ran. Nothing in this report depends on it beyond the spot runs above.

---

_Verified: 2026-11-22T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
