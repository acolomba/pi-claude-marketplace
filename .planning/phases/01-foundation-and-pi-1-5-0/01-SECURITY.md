---
phase: "1"
slug: "foundation-and-pi-1-5-0"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-04"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register comes from the `<threat_model>` blocks of `01-01-PLAN.md` to
> `01-14-PLAN.md`. Each plan has its own `T-01-SC` row (supply chain), so the
> register has 45 rows. The gsd-security-auditor verified each row at ASVS
> level 1 on 2026-11-04 against `features/mcp-builtin`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry to repository | The Pi 1.5.0 trio and the peer-floor fixture enter the locks | package tarballs, integrity strings |
| Pi to extension | The inventory snapshot (`getCommands`, `getAllTools`) and Pi's MCP registry | command and tool lists, server lists |
| plugin manifest to install record | Declared MCP servers are copied into `state.json` as `mcpServerConfigs` | server configs before substitution (may name env variables, never their values) |
| cucumber harness to host filesystem | The harness edits Pi settings and the adapter onboarding file | sandbox files under the run root |
| workflow matrix to shell | CI matrix values reach `run:` steps | profile names, feature paths |
| executor to parent | The executor writes a CI handoff; the parent pushes and dispatches CI | branch head, job timings |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering | package-lock.json (Pi 1.5.0 trio) | high | mitigate | Lock integrity matches the registry; same repository and maintainers as 1.4.0; no install scripts; CI uses `npm ci --ignore-scripts` | closed |
| T-01-02 | Tampering | test/e2e/pi-peer-floor lock | medium | mitigate | Exact pin; `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` in CI | closed |
| T-01-03 | Elevation of privilege | trust behavior under Pi 1.5.0 | medium | mitigate | No trust code removed; 55/55 untrusted-profile scenarios pass | closed |
| T-01-04 | Repudiation | decision rows and cucumber contract | low | accept | Documentation only; grep gates pin each ID | closed |
| T-01-05 | Spoofing | `builtinMcpServerName` collisions | low | accept | Matches Claude Code naming; Phase 2 reports collisions (BLT-04) | closed |
| T-01-06 | Tampering | `effectiveMcpCompatibility` losing a block | medium | mitigate | `domain/mcp-implementation.ts` rule order; tests pin unreadable, malformed, bundle, neutral, and update-in-progress cases | closed |
| T-01-07 | Information disclosure | sha256 in built-in tool names | low | accept | Hash input is the public server and tool names only | closed |
| T-01-08 | Tampering | wire schema drift for the closed set | medium | mitigate | Schema regenerated in the same commit; `test/architecture/wire-schema.test.ts` deep-equality | closed |
| T-01-09 | Spoofing | built-in MCP detection | medium | mitigate | Requires an extension command `mcp` with `sourceInfo.path === "builtin:mcp"`; third-party `/mcp`, prompts, and skills read as `none` | closed |
| T-01-10 | Denial of service | throwing inventory read | low | mitigate | `probeArm` and `readCommands` catch and read as empty | closed |
| T-01-11 | Denial of service | step throw escaping `session_start` or `resources_discover` | medium | mitigate | Each MCP stage runs in its own try/catch in `session-materialize.ts` and `index.ts` | closed |
| T-01-12 | Elevation of privilege | registering before trust or under the adapter | high | mitigate | The registration step is a no-op seed; no `registerMcpServer` call exists in `extensions/` | closed |
| T-01-13 | Spoofing | factory-time probe | medium | mitigate | `test/architecture/no-factory-time-probe.test.ts` | closed |
| T-01-14 | Tampering | settings and onboarding edits outside the sandbox | high | mitigate | `runFile` realpath check against the `pi-cm-features-*` run root; `wx` or tmp+rename writes; `resolveRpcSandbox` refuses the repository and paths outside tmp | closed |
| T-01-15 | Denial of service | Pi or stub left running after a restart | low | mitigate | Restart and release assert the processes stopped | closed |
| T-01-16 | Repudiation | Pi running the wrong MCP implementation | medium | mitigate | Every start and every shared-Pi reset probes `get_commands` and fails on a mismatch | closed |
| T-01-17 | Information disclosure | `mcpServerConfigs` holding substituted secrets or paths | high | mitigate | Records copy the raw declaration with `structuredClone`; substitution never mutates it; integration test checks no root, data, or HOME path | closed |
| T-01-18 | Tampering | a server named `__proto__` | low | mitigate | `Object.entries` / `Object.fromEntries` keep it an own property; tests pin it | closed |
| T-01-19 | Tampering | hand-edited `mcpServerConfigs` | low | accept | A malformed config keeps the stored verdict | closed |
| T-01-20 | Tampering | adapter onboarding writes into settings | medium | mitigate | Seed written through `runFile`; child agent dir is the sandbox; each reset empties the sandbox | closed |
| T-01-21 | Denial of service | stubs outliving a scenario (builtin) | low | mitigate | Pids collected and waited on with a bound at each reset | closed |
| T-01-22 | Spoofing | the stand-in hiding a missing registration | medium | accept | Phase 2's own scenarios do not use the stand-in; the parent re-runs built-in scenarios after Phase 2 merges | closed |
| T-01-23 | Denial of service | stand-in stubs | low | mitigate | The stub exits when stdin closes; the release asserts the stand-ins stopped | closed |
| T-01-24 | Information disclosure | status read under the wrong naming | low | mitigate | The built-in seed answers `no-snapshot`; the body keeps adapter naming | closed |
| T-01-25 | Denial of service | status reader touching Pi at factory time | medium | mitigate | Strict-mock test; the factory probe ban passes | closed |
| T-01-26 | Tampering | legacy reader writing state or using the network | medium | mitigate | Root callbacks return the recorded root; no git import; outside `NETWORK_SEAMS`; tree-unchanged test | closed |
| T-01-27 | Information disclosure | path traversal through a declared MCP reference | low | mitigate | Reference containment in `mcp-resolution.ts`; root-mismatch refusal in `recorded-servers.ts` (see note UF-1) | closed |
| T-01-28 | Tampering | template injection in ci.yml | medium | mitigate | Matrix values reach the shell only through `env:`; zizmor in pre-commit | closed |
| T-01-29 | Repudiation | an MCP scenario running under one profile only | medium | mitigate | `scripts/check-features.mjs` tag rules in `check:static`; shard test | closed |
| T-01-30 | Tampering | push of the gate commit | medium | transfer | The parent session pushes only `features/mcp-builtin` and its mirror, never forcing (`01-CI-HANDOFF.md`, AGENTS.md) | closed |
| T-01-31 | Information disclosure | CI logs | low | accept | Suites run with hermetic homes and no stored credentials | closed |
| T-01-SC (01-01) | Tampering | npm installs | high | mitigate | Same evidence as T-01-01; automated legitimacy check (P1-DC-21) re-run by the auditor | closed |
| T-01-SC (01-02..01-14, 13 rows) | Tampering | npm installs | low | accept | These plans install no new package; installers keep `--ignore-scripts` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Note UF-1 (advisory, low, non-blocking).** `createLegacyServersReader` resolves
git records and tag-pinned path records at the recorded `resolvedSource`, so its
root-mismatch check cannot fail for those records, and nothing re-checks that
root against its owning clone root (NFR-10). The reader has no production caller
in Phase 1 and is read-only. When Phase 2 wires it in, it adds an
`assertPathInside` check of `resolvedSource` against `<scopeRoot>/pi-claude-marketplace/`
(the plugin clone for git records, the marketplace clone for path records), or
registers a threat for it.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-04 | Documentation only; grep gates pin each ID | plan 01-02 register, autonomous run | 2026-11-04 |
| AR-01-02 | T-01-05 | Same naming as Claude Code; Phase 2 reports collisions (BLT-04) | plan 01-03 register, autonomous run | 2026-11-04 |
| AR-01-03 | T-01-07 | The hash covers public names only | plan 01-03 register, autonomous run | 2026-11-04 |
| AR-01-04 | T-01-19 | A malformed hand edit keeps the stored verdict | plan 01-08 register, autonomous run | 2026-11-04 |
| AR-01-05 | T-01-22 | The stand-in steps aside for an existing name; Phase 2 scenarios do not use it | plan 01-10 register, autonomous run | 2026-11-04 |
| AR-01-06 | T-01-31 | CI logs come from hermetic homes with no credentials | plan 01-14 register, autonomous run | 2026-11-04 |
| AR-01-07 | T-01-SC (01-02..01-14) | No new package installed | plan registers, autonomous run | 2026-11-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-04 | 45 | 45 | 0 | gsd-security-auditor (ASVS 1, block on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-04 (autonomous run; user review pending)
