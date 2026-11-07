---
phase: "5"
slug: "hook-tool-names"
status: verified
threats_total: 17
threats_closed: 17
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
verdict: SECURED
asvs_level: 1
block_on: high
created: "2026-11-04"
---

# Phase 5 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register comes from the `<threat_model>` blocks of `05-01-PLAN.md` to
> `05-04-PLAN.md`: T-05-01 to T-05-13, and one `T-05-SC` row (supply chain) per
> plan, so the register has 17 rows. The gsd-security-auditor verified each row
> at ASVS level 1 on 2026-11-04 against `features/mcp-builtin-phase-5` (HEAD
> `1d638d7`), reading the phase diff
> `git diff 640419724c48a60c7bb469acf0fde6f3a6ea7852 -- . ':!.planning'`.
> Line numbers refer to that HEAD.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin hooks config to hooks bridge | Matcher and `if` text come from an installed plugin | untrusted matcher and `if` strings |
| Pi tool registry to hooks bridge | `getAllTools()` is Pi's data, but any loaded extension can register tools | tool names, `sourceInfo.path`, namespace aliases |
| model tool call to hooks bridge | The model chooses the tool name and the input | tool name, input (a string `tool` is model-controlled) |
| loaded extensions to the run snapshot | The active MCP implementation comes from Pi's command and tool inventory | command and tool lists |
| hooks bridge to hook process | The bridge decides which hook runs and what its stdin holds; a guard hook can block or rewrite | hook-facing tool name, Pi's `input` and `content` objects |
| scenario harness to sandbox | A step writes Pi's `mcp.json` in the sandbox agent directory and starts a local stdio process | `mcp.json` text, JSON-RPC over stdio |
| documentation to plugin authors | Authors write matchers from the doc | which spelling fires under each implementation |
| executor to parent session | The executor records gate evidence; the session pushes the phase branch; the parent merges it | branch head, gate record, red proofs |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Evidence | Status |
|-----------|----------|-----------|----------|-------------|------------|----------|--------|
| T-05-01 | Spoofing | `bridges/hooks/mcp-tool-view.ts` identify | medium | mitigate | Built-in only when `sourceInfo.path` is exactly `builtin:mcp` and the namespace has an alias; another source with an alias keeps Pi's name | `mcp-tool-view.ts:30` (constant), `:61-77` (`hookToolFor` exact compare at `:65`); `test/bridges/hooks/mcp-tool-view.test.ts:116-120` (other-source alias row), `:134-146` (asserts `builtinServer: undefined`) | closed |
| T-05-02 | Elevation of privilege | matcher and `if` comparison | medium | mitigate | Claude's form always fires; only a folded server segment stops firing; the scenario's `folded` hook pins it; the doc states it (see note N-1) | `domain/components/hooks/builtin-mcp-tool-names.ts:81-104`; `dispatch.ts:147-160`; `if-field/index.ts:506,549-553`; `features/hook/mcp-tool-names.feature:17` (`folded` hook, no row in `:29-33`), `:43-44,56-57` (folded tool segment fires); `test/domain/components/hooks/builtin-mcp-tool-names.test.ts:40-41,121-155,177`; `test/bridges/hooks/dispatch.test.ts:4201-4244`; `docs/hooks-compatibility.md:119` | closed |
| T-05-03 | Tampering | hook-facing event copy in `dispatch.ts` | high | mitigate | Shallow copy only for a renamed tool; `input` and `content` stay Pi's objects; a rewrite lands on Pi's input; Pi's event keeps Pi's name | `dispatch.ts:945-955` (copy at `:954`); `test/bridges/hooks/dispatch.test.ts:4238-4242` (same `input`, Pi's event unchanged), `:4277-4304` (`updatedInput` lands on Pi's event, Pi's name kept), `:4504-4514` (same `input` and `content` on tool results) | closed |
| T-05-04 | Denial of service | literal and prefix matching | low | mitigate | String equality, `startsWith`, and `includes` only; no regular expression built from plugin text | `builtin-mcp-tool-names.ts:26` (the one module-constant `/\W/g`, applied to text, never built from it), `:81-104`; no `RegExp` construction in the phase diff under `extensions/` | closed |
| T-05-05 | Tampering | red proof restore of Phase 1 product files (05-01..05-03) | medium | mitigate | Restore only after the task commit, on a clean tree, no commit until `git restore --source=HEAD` and an empty `git status --porcelain` | `05-01-SUMMARY.md:166`, `05-02-SUMMARY.md:152`, `05-03-SUMMARY.md:117`; auditor check: `git status --porcelain` empty at HEAD, and no commit in `851126e..HEAD` holds the Phase 1 `dispatch.ts` blob or lacks `mcp-tool-view.ts` / `builtin-mcp-tool-names.ts` | closed |
| T-05-06 | Elevation of privilege | proxy check in `dispatch.ts` | high | mitigate | A proxy-shaped call is skipped only when `proxyRuleApplies()` reports the adapter; under built-in or none every call runs its hooks | `dispatch.ts:949` (both entry points: PreToolUse via `:747`/`:963`, tool result via `:799`); old unconditional `isProxiedToolCall` removed; `mcp-tool-view.ts:101-105` (true only on a positive `"adapter"` snapshot; a failed read reads as not loaded, so it fails toward running hooks); `features/hook/tool-use.feature:385` (D-P5-10 cut-name scenario); `test/bridges/hooks/dispatch.test.ts:3223-3245,3247-3353`; `test/bridges/hooks/mcp-tool-view.test.ts:204-236` | closed |
| T-05-07 | Elevation of privilege | adapter and built-in MCP loaded together | low | accept | A built-in cut-name tool called with a string `tool` while the adapter is active is still skipped (P5-DC-15); hardening proposed as a BACKLOG parent line | AR-05-01; `DUBIOUS-CHOICES.md:214` (P5-DC-15); `05-02-SUMMARY.md:212`; `05-04-SUMMARY.md:224` | closed |
| T-05-08 | Denial of service | Pi inventory reads per tool event | low | mitigate | The implementation is read once per generation and only for a proxy-shaped call; probe counts and the factory-time ban stay green | `mcp-tool-view.ts:102` (`??=`); `dispatch.ts:949` (shape check first); `event-router.ts:1196-1210` (one view per generation); `test/bridges/hooks/event-router.test.ts:2696,2721,2752`; `test/bridges/hooks/dispatch.test.ts:3355,3380,4402,4432,4574`; `test/index.test.ts`, `test/bridges/hooks/settle.test.ts`, `test/architecture/no-factory-time-probe.test.ts` unchanged by the phase and passing (auditor run: 517/517) | closed |
| T-05-09 | Tampering | the `mcp.json` step and `features/lib/hook-mcp-tool-server.ts` | low | mitigate | Writes only `{agent dir}/mcp.json` with `wx`; removed on release; `Before()` empties the sandbox; the stub speaks stdio only and exits when stdin closes | `features/step_definitions/hook/tool-use.steps.ts:130-135` (sandbox `agentDir`, `flag: "wx"`, `onRelease` rm); `features/support/pi-process.ts:210-232` (`Before()` empties every sandbox directory); `features/lib/hook-mcp-tool-server.ts:17` (only import `node:url`), `:91-107` (stdin/stdout only, exit on `end`) | closed |
| T-05-10 | Repudiation | `docs/hooks-compatibility.md` | medium | mitigate | Built-in naming statements cite the scenario files; the folded-server case is stated outright (see note N-2) | `docs/hooks-compatibility.md:119` ("A name with the server segment changed that way does not fire"), `:148` (cites `features/hook/mcp-tool-names.feature`), `:150` (cites `features/hook/tool-use.feature`) | closed |
| T-05-11 | Tampering | red sweep restore (05-04) | medium | mitigate | Sweep starts and ends with an empty `git status --porcelain`, restores the working tree only, no commit between the two restores | `05-04-SUMMARY.md:140` (procedure), `:236`; 05-04 Task 1 made no commit (`05-04-SUMMARY.md:181`); same auditor history check as T-05-05 | closed |
| T-05-12 | Repudiation | the gate record | low | mitigate | Every part runs on one recorded sha with exit status and seeds; a flake rerun is recorded beside the first run (see note N-3) | `05-04-SUMMARY.md:111-126` (sha `cd5c7b4`, 8 parts, exit 0, durations, seeds), `:105` (no flake, nothing rerun), red-sweep seeds 734317 / 801401; `cd5c7b4` is an ancestor of HEAD | closed |
| T-05-13 | Tampering | the phase branch | low | transfer | The executor never pushes; the session pushes only `features/mcp-builtin-phase-5`; the parent merges with a merge commit | `.planning/ROADMAP.md:86-91,299-302` (push and merge procedure); `AGENTS.md` Git section (no rebase, never push `main`); `05-04-SUMMARY.md:236` (executor did not push); merges in range are merge commits | closed |
| T-05-SC (05-01) | Tampering | npm installs | low | accept | No package added; `npm ci --no-audit --no-fund` from the committed lock | AR-05-02; `package.json` and `package-lock.json` unchanged in the phase diff | closed |
| T-05-SC (05-02) | Tampering | npm installs | low | accept | No package added | AR-05-02; same evidence | closed |
| T-05-SC (05-03) | Tampering | npm installs | low | accept | No package added; the stub imports only Node built-ins | AR-05-02; `hook-mcp-tool-server.ts:17`; the only non-Node imports in the diff are existing dev dependencies in tests (`strong-mock`, type-only Pi peer) | closed |
| T-05-SC (05-04) | Tampering | npm installs | low | accept | No package added | AR-05-02; same evidence | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Note N-1 (advisory, T-05-02).** The 05-01 mitigation text says the folded tool
segment fires too. Review finding WR-01 showed that this is false when Pi ends
the name with a hash: Pi hashes the original tool name, so only Claude Code's
full name fires. The behavior did not change. Commit `043b98e` fixed the doc
(`docs/hooks-compatibility.md:119,148`), the `toolLiteralNames` JSDoc
(`builtin-mcp-tool-names.ts:69-80`), and added unit rows
(`builtin-mcp-tool-names.test.ts:132-155`). The guard-hook guarantee holds: a
Claude Code spelling always fires (verified by the reviewer's 200,000-pair fuzz,
and by the unit rows above).

**Note N-2 (advisory, T-05-10).** The doc cites scenarios once per paragraph,
not on every row. The scenario cites are at `:148` and `:150`, and the literal
row `:119` points to them. The prefix row `:120`, the sentence at `:144`, and
the `if` rows `:167-168` cite no scenario. The `a__b` prefix sentence that the
IN-02 fix added (`:120`) is pinned by no scenario and no unit row. Its behavior
follows from the equality check at `builtin-mcp-tool-names.ts:100-104`. The
plan's own acceptance criteria check the cites as a whole, and the folded-server
statement is present. A later doc pass can add per-row cites.

**Note N-3 (advisory, T-05-12).** The gate record is for `cd5c7b4`. Six
review-fix commits came after it (`043b98e`..`657afba`), and two of them change
product code (`2326f73`, `657afba`). `05-REVIEW-FIX.md:70-77` records
`check:static` and 804 hooks unit tests for those commits, but no full
`npm run check` and no cucumber profiles on HEAD. The auditor re-ran the
phase's unit pairs plus the T-05-08 guard tests on HEAD (517/517 pass). The next
full verdict is the ROADMAP post-merge gate (`npm run check` plus both cucumber
profiles).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-07 | Needs both MCP implementations loaded, a name cut inside the namespace, and a model-chosen `tool` key; hardening goes beyond D-P5-06 and is a BACKLOG parent line (P5-DC-15) | plan 05-02 register, autonomous run | 2026-11-04 |
| AR-05-02 | T-05-SC (05-01..05-04) | No package added; installs come from the committed lock | plan registers, autonomous run | 2026-11-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-04 | 17 | 17 | 0 | gsd-security-auditor (ASVS 1, block on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-04 (autonomous run; user review pending)
