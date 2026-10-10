---
phase: 07-docs-and-live-proof
verified: 2026-10-09T20:00:00Z
status: passed
score: 3/3 must-haves verified
covered_files:
  - ".github/workflows/ci.yml"
  - ".planning/phases/07-docs-and-live-proof/07-01-PLAN.md"
  - ".planning/phases/07-docs-and-live-proof/07-01-SUMMARY.md"
  - ".planning/phases/07-docs-and-live-proof/07-02-PLAN.md"
  - ".planning/phases/07-docs-and-live-proof/07-02-SUMMARY.md"
  - ".planning/phases/07-docs-and-live-proof/07-03-PLAN.md"
  - ".planning/phases/07-docs-and-live-proof/07-03-SUMMARY.md"
  - ".planning/phases/07-docs-and-live-proof/07-04-PLAN.md"
  - ".planning/phases/07-docs-and-live-proof/07-04-SUMMARY.md"
  - ".planning/phases/07-docs-and-live-proof/07-05-PLAN.md"
  - ".planning/phases/07-docs-and-live-proof/07-05-SUMMARY.md"
  - "CHANGELOG.md"
  - "README.es.md"
  - "README.md"
  - "docs/env-vars.md"
  - "docs/hooks-compatibility.md"
  - "docs/mcp-compatibility.md"
  - "docs/output-catalog.md"
  - "docs/prd/pi-claude-marketplace-prd.md"
  - "package.json"
  - "scripts/pi.sh"
  - "tests/architecture/peer-floor.test.ts"
  - "tests/bridges/mcp/adapter-entry.test.ts"
  - "tests/live-uat/README.md"
  - "tests/live-uat/fixtures/mcp-adapter-canary/legacy-v0.19.2.json"
  - "tests/live-uat/mcp-adapter-canary.mjs"
  - "tests/live-uat/openai-stub-server.mjs"
covered_digest: "v3:sha256:d80964d7157d76426cc7fe130d4ddd3587962234cc654e981e8d9312c8bd95b2"
re_verification: "scoped; baseline 51ebbc07; head 3df6309c"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 7: Docs and live proof Verification Report

**Phase Goal:** The documentation describes what this milestone delivers and where it diverges from Claude Code, and a real pi-mcp-adapter 5 proves it accepts what we write.
**Verified:** 2026-10-09
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | README, `docs/env-vars.md`, `docs/hooks-compatibility.md` and the PRD/NFR-10 text describe adapter-file delivery, naming, tool search, variable rules and every documented divergence (ADOC-01) | VERIFIED | `docs/mcp-compatibility.md` has Server and tool names, Tool search, Project-scope servers, adapter settings, Variables (7 subsections), Upgrading, Server status in info, and a Divergences list grouped under Naming, Loading, Variables, Migration and Status; each new bullet names its license (requirement ID or Pi capability gap). Both READMEs name adapter 5.2.0 and gain one linking sentence (README.md:132, README.es.md:132). `docs/env-vars.md` carries the five expansion fields, `${VAR:-default}` vs plain `${VAR}`, `PI_CLAUDE_MARKETPLACE_EMPTY`, `AI_AGENT`, and the adapter-5.2.0 re-anchor; ENVDOC-01 is struck CLOSED in `.planning/BACKLOG.md:1651`. `docs/hooks-compatibility.md:82-83,110` states MCP literal and prefix matchers match plugin tools by Claude Code names on direct calls only. PRD: `mcp-adapter.json` in diagram/persistence/layout (lines 143, 167, 1022), MC-9, MC-10, MC-11 rows, SC-2 and NFR-10 keep `mcp.json` "until the migration window closes" (lines 534, 1054). The 4 changed lines in `mcp-compatibility.md` are the basis/intro/lifecycle/conformance paragraphs; none of the 18 pre-existing divergence bullets was removed or reworded (diff shows no `-` bullet lines). No decision ID (`D-0N-NN`) appears on any added line of the docs. |
| 2 | A live UAT in a sandboxed agent directory shows adapter 5 loading our entries, migrating a seeded legacy entry with the reloads counted, finding plugin tools through tool search, and `info` showing their status, including `status unknown` in a deferred session until first MCP use and a live state after (ADOC-02) | VERIFIED | I re-ran `tests/live-uat/mcp-adapter-canary.mjs` myself against pi-mcp-adapter 5.2.0 and Pi 1.0.0 in a sandbox under `TMPDIR=/var/tmp/mcp4-p7-verify` (not the real `~/.pi/agent`): exit 0, 14 PASS lines, `all assertions proven; exit 0`. Observed: M1 migration notice `echo -> plugin_echo_echo_ (echo) [user]`; M2 before reload adapter lists `echo` and info shows `(not loaded)`; M3 `mcp.json` has no marked entry, `mcp-adapter.json` holds `plugin_echo_echo_` with `toolPrefix "mcp"`, `directTools "search"`; I1 fresh install `plugin_ping_ping_`; `reloads ... : 1`; M4 both live after 1 reload; A1/B1 `(status unknown)` in a fresh deferred session; A2/B2 `mcp({ search })` and `tool_search` return `mcp__plugin_echo_echo__echo_canary` declared only after the search; A3/B3 tool call returns `echo-canary:hi` / `echo-canary:via-tool-search`; A4/B4 info shows `(connected)`. `--no-extensions` reading recorded (`no`, then `yes` with `-e builtin:tool-search`). The negative control (`--invert`) is recorded verbatim in `tests/live-uat/README.md:586-640` as exit 2 at A3 after A2 passed; the executors and the fixer ran it, and the README transcript matches the format of my run. Fixture `legacy-v0.19.2.json` is captured from 0.19.2, uses `@@SANDBOX@@` (12 uses) and holds no `/home`, `/tmp` or `/var/tmp` path. |
| 3 | CHANGELOG records the milestone, and a version bump is offered before the PR (ADOC-03) | VERIFIED | `CHANGELOG.md` `[Unreleased]` opens with grouped bullets: Pi 1.0 floor with pi-subagents 0.74.0; adapter 5.2.0 floor with GHSA-6qxp-vccf-f47h and the redirect side effect; `mcp-adapter.json` delivery with sub-bullets (names, tool search, variables and withheld credentials, partial installs, permission-rule warning, migration); status in info; the action-needed bullet linking `docs/mcp-compatibility.md#upgrading` (the `## Upgrading` heading exists at line 258); an `Internal:` bullet. Heading is still `## [Unreleased]`; `package.json` is 0.19.2, `sonar.projectVersion=0.19.2`. Per D-07-11 the bump is deliberately offered at PR time (recorded as an offer with five touch points in the 07-03 SUMMARY). The "offered before the PR" half is a PR-time act, not a phase artifact, and AGENTS.md "Versioning" already mandates it. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Plan-level must-haves spot-checked

| Plan | Must-have | Status | Evidence |
|------|-----------|--------|----------|
| 07-01 | Peer is `>=5.2.0 <6`, optional, never a dep | VERIFIED | `package.json:61`; `package-lock.json:44` root mirror; `peerDependenciesMeta.optional` true; no adapter lock package entry |
| 07-01 | Gates and vendored citations pin 5.2.0 and the shasum | VERIFIED | `tests/architecture/peer-floor.test.ts:93,122`; `adapter-entry.test.ts:13,54,1047,1073` cite `9950f0b4...`; `node --test tests/architecture/peer-floor.test.ts` exit 0 |
| 07-01 | CI installs `pi-mcp-adapter@5.2.0` | VERIFIED | `.github/workflows/ci.yml:121` |
| 07-01 | `pi.sh` pins 5.2.0 and passes `-e builtin:tool-search`, built-in MCP stays off | VERIFIED | `scripts/pi.sh:112,234`; no `-e builtin:mcp`. Extension source changes are comment-only (`adapter-doc.ts`, `mcp-status.ts`). |
| 07-02 | Canary is operator-run outside `npm run check` with `fallow-ignore-file`, sandboxed env | VERIFIED | I ran it; sandbox under the given TMPDIR, no leftover sandbox directory. Review fix WR-02 added SIGINT/SIGTERM teardown. |
| 07-03 | Version files untouched, `[Unreleased]` heading kept | VERIFIED | see Truth 3 |
| 07-05 | README/README.es named 5.2.0 and one linking sentence each; catalog adds the `not loaded` sentence, no block changes | VERIFIED | README.md:40,132; README.es.md:40,132; `docs/output-catalog.md:2607` |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| ADOC-01 | 07-01, 07-03, 07-05 | README, env-vars, hooks-compatibility, PRD/NFR-10 describe delivery, naming, tool search, variable rules, divergences | SATISFIED | Truth 1 |
| ADOC-02 | 07-01, 07-02, 07-04 | Live UAT in a sandboxed agent dir proves adapter loads entries, migration with reload count, tool search, status in info | SATISFIED | Truth 2, re-run by verifier, exit 0 |
| ADOC-03 | 07-03 | CHANGELOG records milestone; bump offered before PR | SATISFIED | Truth 3 |

All three IDs in ROADMAP/REQUIREMENTS for Phase 7 appear in plan frontmatter. No orphaned requirements.

### Review findings

`07-REVIEW.md` findings (WR-01, WR-02, IN-01 to IN-06) are recorded as fixed in `07-REVIEW-FIX.md`. I spot-checked the fixes in the tree: the project-scope servers bullets in `docs/mcp-compatibility.md:81-92` (restart-until-allow, headless exception via `settings.projectServers`), the added unreadable-`mcp.json` row, the narrowed update-changes-entry sentence, and the signal teardown covered by the canary header and README. One sub-item of IN-06 (absolute path in output) was knowingly skipped, and it affects only operator-run output.

### Anti-Patterns Found

None. No `TBD`, `FIXME` or `XXX` on any line added by the phase in docs, scripts or live-UAT files. Production source changes are comments only.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Peer-floor gate pins `>=5.2.0 <6` | `node --test tests/architecture/peer-floor.test.ts` | exit 0 | PASS |
| Live canary against adapter 5.2.0 | `node tests/live-uat/mcp-adapter-canary.mjs` (sandboxed) | exit 0, 14 PASS | PASS |
| Full gate | `npm run check` with `PI_MCP_ADAPTER_ROOT` set | not re-run; supplied evidence says exit 0 after the plans and after the review fixes. Commits since that run touch docs and the live-UAT driver only | accepted |

### Human Verification Required

None. The live canary is an executed live UAT, and I reproduced it.

### Gaps Summary

No gaps. Notes for the PR step, not blockers: the version bump to 0.20.0 (`package.json`, lock, `EXTENSION_VERSION`, `sonar-project.properties`, `CHANGELOG.md` heading) is still to be offered by the operator before the PR, as D-07-11 states; the canary requires a 5.2.0 scratch install via `PI_MCP_ADAPTER_ROOT` and is not part of CI.

---

_Verified: 2026-10-09_
_Verifier: Claude (gsd-verifier)_

## Re-verification (2026-10-10)

**Scope:** baseline `51ebbc07` (last commit that wrote this report) to head `3df6309c`. The fingerprint went stale because Phase 8 (clear milestone debt) edited covered files: `README.md`, `README.es.md`, `docs/mcp-compatibility.md`, `docs/output-catalog.md`, `scripts/pi.sh`, `tests/bridges/mcp/adapter-entry.test.ts` and `tests/live-uat/openai-stub-server.mjs`. Phase 8 also changed extension source that the docs describe (`bridges/mcp/*`, `domain/mcp-server-features.ts`, `orchestrators/reconcile/mcp-migration.ts`, `shared/notification-dispatch.ts`, `shared/session-env.ts`), so I judged each doc claim against the code at HEAD. The original findings are the contract.

**Status:** passed (score 3/3, 0 behavior-unverified). No truth lost support. Two advisories below.

### Changed files (covered files only)

| File | Change since baseline | Bearing on the truths |
|------|-----------------------|-----------------------|
| `README.md`, `README.es.md` | pi-subagents 0.74.0 floor named; cross-plugin key-collision example (`plugin:a_b:c` and `plugin:a:b_c`); per-tool `mcp:` entries fail the whole launch if the name is not exact; the "needs 0.62.0" caveat removed | Truth 1; the linking sentence is still at line 132 in both |
| `docs/mcp-compatibility.md` | New "OAuth beside headers" section and table, `auth` row, "User choices" divergence, `serverChoices` store text, `openUi`/`trace` carried fields, migration-cause rows, split-token character class, collision rollback sentence | Truth 1 (ADOC-01) |
| `docs/output-catalog.md` | Enable/import MCP-notice sentence (D-08-03), `serverChoices` sentence, `openUi`/`trace`, migration notice rows `source-outdated` and reworded `marketplace-unreadable` | Truth 1; the `not loaded` sentence (line 2607) is unchanged |
| `scripts/pi.sh` | Default home keeps an exported `PI_CODING_AGENT_SESSION_DIR`; usage text about login | Plan 07-01 `pi.sh` pin: still `5.2.0` and `-e builtin:tool-search`, no `-e builtin:mcp` |
| `tests/bridges/mcp/adapter-entry.test.ts` | New OAuth header rows, `userCarriedFields` tests, `openUi`/`trace` in the carried set | Plan 07-01 citation of the 5.2.0 shasum is intact |
| `tests/live-uat/openai-stub-server.mjs` | Request and server `error` handlers | Stub used by the canary; no change to the replayed tool-call list |
| `CHANGELOG.md`, `package.json`, `docs/env-vars.md`, `docs/hooks-compatibility.md`, PRD, `ci.yml`, `peer-floor.test.ts`, canary, fixture, live-UAT README | Unchanged | Truths 2 and 3 rest on these, so they hold as before |

### Per-truth result

| # | Truth | Result | Evidence at HEAD |
|---|-------|--------|------------------|
| 1 | Docs describe adapter-file delivery, naming, tool search, variable rules and every documented divergence (ADOC-01) | VERIFIED (advisory 1) | I checked each Phase 8 doc claim against the code. OAuth: `domain/mcp-server-features.ts` `authField` writes `auth: "oauth"` only for non-empty `headers` with no `Authorization` key in any case, and `adapter-entry.ts` `withOAuthDecision` drops it unless every value is a non-blank string whose references are set; each row of the `mcp-compatibility.md` table follows from that and from `OAUTH_HEADER_ROWS` in the test. Carried set: `CARRIED_FIELDS` is the 11 fields the docs list. `serverChoices`: `adapter-doc.ts` stores `{plugin, marketplace, fields}` per key under the top-level `_piClaudeMarketplace.serverChoices`, as the docs say. Split-token rule: `adapter-escape.ts` `MARKER_COMPLETION = /^(?:[\w}]|:\w)/`, and `\w` is ASCII, as the docs now state. Migration rows: the `source-outdated` and `marketplace-unreadable` strings in `notification-dispatch.ts:801,803` match the catalog and the table, and `git-source-probe.ts` / `reinstall-clone-probe.ts` fall back to the recorded-sha clone when a mirror HEAD cannot be read. Collision example: `generatedMcpServerKey("a_b","c")` and `("a","b_c")` both give `plugin_a_b_c_`. `/mcp-adapter disable` writes the project file: `commands.ts:831` calls `writeProjectServerDisabledOverride` in adapter 5.2.0. `session-env.ts` matches the `env-vars.md` text. No pre-existing divergence bullet was removed or reworded away; the earlier items are still present. |
| 2 | Live UAT proves adapter 5 loads the entries, migrates a legacy entry with the reloads counted, tool search finds the tools, `info` shows status (ADOC-02) | VERIFIED (not re-run) | The canary, its fixture, its README transcript and the pinned adapter are unchanged since the baseline run (14 PASS, exit 0, negative control recorded). I did not run it: this re-verification forbids live canaries. Phase 8 changed the entries it writes (`auth: "oauth"` beside headers, the `serverChoices` store, `openUi`/`trace`), but the canary seeds a stdio `echo` server, so none of those paths touch its assertions. The 5.2.0 loader reads `auth: "oauth"` as a plain string (`config.ts:76`) and the unit tests that vendor its entry keys pass. The first verification's live run is the evidence of record. |
| 3 | CHANGELOG records the milestone, a bump is offered before the PR (ADOC-03) | VERIFIED (advisory 2) | `CHANGELOG.md` is byte-identical to the baseline; `[Unreleased]` heading, `package.json` 0.19.2 and `sonar.projectVersion` are unchanged, and the bump is still a PR-time offer (D-07-11). |

Plan-level must-haves re-spot-checked: peer `>=5.2.0 <6` (`peer-floor.test.ts` passes), shasum citations in `adapter-entry.test.ts`, `ci.yml` pin, `pi.sh` pins, README/README.es linking sentence and `not loaded` catalog sentence.

### Advisories (do not change the verdict)

1. **Decision IDs in user docs, with a clash.** The original evidence noted that no `D-0N-NN` ID appeared on lines the phase added. Phase 8 now cites `D-08-01`, `D-08-02`, `D-08-03` and `D-08-04` in `docs/mcp-compatibility.md` (lines 135, 196, 382, 396) and `D-08-02`/`D-08-03` in `docs/output-catalog.md`. The `Divergences` rule asks for a recorded ID as the license, and `REQUIREMENTS.md` records these IDs, so this is defensible. But `D-08-01..03` were already used by an earlier milestone (`PROJECT.md` line 1071, and `docs/output-catalog.md` still cites `D-08-03` for the enable cascade in the same section), so the same ID now means two things. Consider the requirement IDs (`MCPOVR-01`, `MCPROW-01`, ...) in the docs instead.
2. **CHANGELOG does not mention Phase 8 behavior.** `[Unreleased]` was not touched by Phase 8. Not covered: `auth: "oauth"` written beside headers with no `Authorization`; user choices kept in `mcp-adapter.json` across disable, uninstall and reinstall (and `openUi`/`trace` kept); enable and import reporting MCP notices as separate warnings; the new migration remedies. ADOC-03 asks that the changelog record the milestone, and the high-level bullets still do. Add these at the PR step, together with the version bump.

### Commands run

| Command | Result |
|---------|--------|
| `git diff --stat 51ebbc07 HEAD -- <covered files>` | 11 files changed: 7 covered files with edits that matter, 3 live-UAT stub/canary files (`manifest-absence-canary.mjs`, `stop-canary.mjs`, `workflow-storage-canary.mjs`, not in `covered_files`), and `07-REVIEW-DISPOSITION.md` |
| `TMPDIR=/var/tmp/mcp4-reverify-07 PI_MCP_ADAPTER_ROOT=... PI_SUBAGENTS_ROOT=... node --test tests/architecture/peer-floor.test.ts tests/bridges/mcp/adapter-entry.test.ts tests/architecture/mcp-migration-notice.test.ts tests/architecture/mcp-config-notices.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` | 109 tests, 109 pass, 0 fail |
| `node -e`-style call of `generatedMcpServerKey` on `("a_b","c")` and `("a","b_c")` | both `plugin_a_b_c_` |
| `node .claude/gsd-core/bin/gsd-tools.cjs query verification.fingerprint <phase_dir> <same covered files>` | digest `v3:sha256:d80964d7157d76426cc7fe130d4ddd3587962234cc654e981e8d9312c8bd95b2`; covered_files list unchanged |
| `npm run check`, live canary, `pi` | not run, by the brief |

_Re-verified: 2026-10-10_
_Verifier: Claude (gsd-verifier)_
