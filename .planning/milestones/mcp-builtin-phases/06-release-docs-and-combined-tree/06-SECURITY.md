---
phase: "6"
slug: "release-docs-and-combined-tree"
status: verified
threats_total: 42
threats_closed: 42
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
verdict: SECURED
asvs_level: 1
block_on: high
created: "2026-11-05"
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register comes from the `<threat_model>` blocks of `06-01-PLAN.md` to
> `06-13-PLAN.md`: T-06-01 to T-06-29, plus one `T-06-SC` row (supply chain)
> per plan, so the register has 42 rows. The gsd-security-auditor verified
> each row at ASVS level 1 on 2026-11-05 against `features/mcp-builtin` (HEAD
> `4daf71c`), reading the phase diff `git diff a25cd35 HEAD -- . ':!.planning'`
> and running the nine test files that pin the code mitigations (560 tests,
> 560 passed, Node v24.22.1). Line numbers refer to that HEAD.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| installation records to the legacy MCP reader | A record's plugin root can be hand-edited; the reader re-resolves servers from it | plugin root path, marketplace manifest |
| completion cache file to completion lookups | The cache file is shared across Pi processes on one scope | cached rows and their implementation stamp |
| plugin manifests to the MCP field encoder and the built-in description reader | Plugin text reaches the built-in registration | field values, description links |
| Pi inventory to the run snapshot | Any loaded extension can register commands and tools | command and tool lists |
| scenario harness to sandbox | Stand-in processes start and must stop within the scenario | pid files, process lifetime |
| documentation to users and plugin authors | Users change their own Pi settings from the docs | turn-on steps, the privacy of resolved values |
| `--json` output to scripts | Scripts read closed token lists | `McpServerStatus`, `Companion` tokens |
| executor to parent session | Executors record gate evidence; the session pushes and dispatches CI | gate record, CI handoff, root log |
| npm registry to worktrees | Each worktree installs from the committed lock | `node_modules` |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Status | Evidence |
|-----------|----------|-----------|----------|-------------|--------|----------|
| T-06-01 | Repudiation | switch scenario's DUAL-04 claim | low | mitigate | closed | `features/mcp-server/implementation-switch.feature:82-94` (`58ab863`); red proof on `d1711fd` fails with `requires pi-mcp-adapter` (seed 57929) |
| T-06-02 | Tampering | user Pi settings during the switch | low | mitigate | closed | the scenario adds one read-only `/claude:plugin list` step and no settings step |
| T-06-03 | Denial of service | agent grants after an apply or autoupdate move | low | mitigate | closed | `orchestrators/plugin/update-swap.ts:498` reads the required `args.mcpImplementation` (`670f742`); `features/mcp-server/agent-grants.feature:146-147`; red proofs in 06-02-SUMMARY |
| T-06-04 | Elevation of privilege | grant selectors in agent files | low | accept | closed | AR-06-01 |
| T-06-05 | Tampering | completion cache rows across implementations | low | mitigate | closed | `shared/completion-cache.ts:79-91,217-229,283-356` (schema v7 stamp); all three reads pass the stamp (`edge/completions/data.ts:379,441,497`) |
| T-06-06 | Information disclosure | completion cache file path | low | mitigate | closed | path only from `locationsFor(...).pluginCacheFile` (`orchestrators/edge-deps.ts:245`, `persistence/locations.ts:389-396`); writes only through `atomicWriteJson` |
| T-06-07 | Denial of service | per-lookup inventory probe | low | accept | closed | AR-06-02 |
| T-06-08 | Tampering | `substituteAndInject` callers | low | mitigate | closed | `bridges/mcp/substitute.ts:211-215` requires the encoder (`c5445ba`); both callers name one |
| T-06-09 | Information disclosure | built-in description read | low | mitigate | closed | `bridges/mcp/builtin-description.ts:20-30` uses `domain/manifest-containment.ts`; `test/architecture/manifest-read-agreement.test.ts` fifth reader (`ec36113`) |
| T-06-10 | Denial of service | `assertStandInsStopped` | low | mitigate | closed | `features/lib/turn-records.ts:24-25,99-114` (10 s bound, 50 ms poll, same message; `230b60d`) |
| T-06-11 | Information disclosure | drafted upstream report | low | mitigate | closed | 06-05 took branch (a): no report was drafted or filed (see note N-2) |
| T-06-12 | Information disclosure | docs on resolved built-in values | low | mitigate | closed | `docs/mcp-compatibility.md:189,616` say the values are readable by every extension in the process |
| T-06-13 | Tampering | user instructions on Pi settings | low | mitigate | closed | `README.md:163`, `README.es.md:163`, `docs/mcp-compatibility.md:17-26`: the user edits settings; the extension never does (D-MB-01) |
| T-06-14 | Tampering | catalog byte contract | low | mitigate | closed | `7b04f94` changes the catalog, fixture and counter together; `catalog-contract.test.ts:21-22` (324 states, 54 553 bytes) |
| T-06-15 | Repudiation | `--json` consumers | low | mitigate | closed | `docs/json-output.md:951,955` token lists unchanged; no closed-set lock count changed |
| T-06-16 | Information disclosure | legacy reader re-resolution | medium | mitigate | closed | `orchestrators/mcp/recorded-servers.ts:186-199,252-255` refuses `uncontained` before the manifest load (`41bc6ae`); `LegacyServersSource.locations` is required, so every caller supplies it |
| T-06-17 | Tampering | legacy reader re-resolution | low | mitigate | closed | one `isPluginRootContained` rule for the reader and the registration step (`builtin-registration-step.ts:58-60,162`); refusal cases in `recorded-servers.test.ts:477-506` |
| T-06-18 | Information disclosure | `recordedMcpServers` debug line | low | mitigate | closed | `recorded-servers.ts:77-80` redacts absolute paths (`698a3a6`) |
| T-06-19 | Repudiation | fallow export exemptions | low | mitigate | closed | `.fallowrc.json:2` has one entry and no `ignoreExports` (`698a3a6`) |
| T-06-20 | Elevation of privilege | readers of the snapshot | low | mitigate | closed | `platform/pi-api.ts:171-178`; `piMcpAdapterLoaded` has no hit in `extensions/ test/ features/` (`aeb9c7e`) |
| T-06-21 | Denial of service | snapshot probe counts | low | mitigate | closed | `pi-api.ts:360-368`; `.times(3)` and `.times(1)` unchanged in `test/shared/notification-run.test.ts:134-166` (see note N-1) |
| T-06-22 | Repudiation | parent lines | low | mitigate | closed | `.planning/BACKLOG.md:4885-4951` (17 IDs); `06-PARENT-LINES.md` `## Dispositions` |
| T-06-23 | Information disclosure | drafted report in BACKLOG | low | mitigate | closed | no `RPCSESSION-01` entry; no absolute path in the phase's BACKLOG additions (see note N-2) |
| T-06-24 | Repudiation | codebase map counts | low | mitigate | closed | `.planning/codebase/CONVENTIONS.md:70` states 45 markers, measured 45 (7/7/5/1/25) |
| T-06-25 | Tampering | push of the gate commit | medium | transfer | closed | transferred to the parent session (`06-CI-HANDOFF.md:69`, AGENTS.md); every push of `features/mcp-builtin` was a fast-forward, and `main` was never pushed |
| T-06-26 | Repudiation | gate evidence reused across changed inputs | low | mitigate | closed | the build-input diff from `a7f73bf` to HEAD is empty outside `.planning/**/*.md`; CI run 41960058038 on `1bec91e` passed |
| T-06-27 | Information disclosure | root log copied from the scratchpad | low | mitigate | closed | token-shape scan run by 06-13 and re-run by the auditor: no match |
| T-06-28 | Repudiation | choices and parent lines | low | mitigate | closed | all 111 P6-DC IDs and the 12 High IDs are in the root log; 118 parent-line rows over 94 IDs with no empty cell; every cited sha and BACKLOG ID exists (see note N-3) |
| T-06-29 | Repudiation | e2e failure recorded as network-unavailable | low | mitigate | closed | no deferral: both e2e parts exited 0 locally, and CI's `pinned e2e tests (Node 24)` succeeded |
| T-06-SC (x13) | Tampering | npm installs, one row per plan | low | accept | closed | AR-06-03 |

*Status: open · closed*
*Severity: low · medium · high (only open threats at or above `block_on: high` count toward `threats_open`)*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Notes

- **N-1:** 06-09-SUMMARY says none of the four probe-count files changed. In fact
  `aeb9c7e` removed six `piMcpAdapterLoaded` lines from
  `test/shared/notification-run.test.ts`. Its `.times()` expectations did not
  change and the file passes, so only the record is wrong.
- **N-2:** T-06-11 and T-06-23 guarded a report that 06-05's branch (b) would
  have drafted. Branch (a) ran, so no report exists. The Pi 1.5.0 RPC
  `new_session` defect stays unreported (P6-DC-0503).
- **N-3:** T-06-28's working-log half compares against the session's scratchpad
  file, which is not in the repository; only the in-tree halves can be
  re-verified later.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-04 | The selector names only the plugin's own server in either form (ANAME-02); the change picks between two forms the bridge already renders and grants nothing new. | plan 06-02 register; auditor confirmed (`update-swap.ts:494-499`) | 2026-11-05 |
| AR-06-02 | T-06-07 | One snapshot per completion lookup is one `getCommands()` and three `getAllTools()` calls over in-memory lists, the probe hooks already read once per generation. | plan 06-03 register; auditor confirmed (`edge/register.ts:189-198`) | 2026-11-05 |
| AR-06-03 | T-06-SC (all 13 plans) | No package is added; installs come from the committed lock with `npm ci --ignore-scripts`, and the peer-floor fixture lock is unchanged. | plan registers; auditor confirmed (no change to `package.json`, `package-lock.json`, `test/e2e/pi-peer-floor/`) | 2026-11-05 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-05 | 42 | 42 | 0 | gsd-security-auditor (ASVS 1, block on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-05 (autonomous run; user review pending)
