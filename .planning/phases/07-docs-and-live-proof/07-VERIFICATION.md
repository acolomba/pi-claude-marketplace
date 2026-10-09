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
covered_digest: "v3:sha256:444459513fa07c18bafab4ff3ec198916eb06127964fcec85bb4710edd286010"
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
