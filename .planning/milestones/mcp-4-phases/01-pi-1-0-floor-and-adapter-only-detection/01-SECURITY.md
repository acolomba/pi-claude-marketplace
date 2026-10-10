---
phase: "1"
slug: "pi-1-0-floor-and-adapter-only-detection"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-09"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Written retroactively from the nine plan-time `<threat_model>` blocks and
the SUMMARY threat flags. Every mitigation was checked at `24d2d904` by
grep and read only.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → repository | The devDependency bump set and scratch peer installs | package code and install scripts |
| Pi host → extension | Command and tool inventory the adapter probe reads | untyped metadata (`unknown` fields) |
| Test harness → Pi child process | e2e RPC sessions on a real Pi 1.0 | environment variables, sandbox paths |
| Live canary → agent directory | Operator-run Stop and engine canaries | files under a sandboxed `PI_CODING_AGENT_DIR` |
| Canary → model stub | Keyless OpenAI-compatible stub on localhost | request metadata only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-SC (01-01) | Tampering | `npm install -D` of the bump set | high | mitigate | All eight D-01-21 packages pinned in `package-lock.json` at approved versions, none with `hasInstallScript`; checks recorded in 01-01-SUMMARY | closed |
| T-01-01 | Elevation of privilege | package.json dependency blocks | medium | mitigate | pi-mcp-adapter only an optional peer (`package.json:58-71`); `tests/architecture/peer-floor.test.ts:97-111` | closed |
| T-01-02 | Tampering | lint gate integrity | low | mitigate | Code fix in `shared/notify-context.ts:345-346`; no `no-unsafe-*` disable anywhere | closed |
| T-01-03 | Repudiation | strict Pi doubles | low | mitigate | Exact `.times()` with `exactParams` and `verify()` (`tests/edge/notification-boundary.ts:64-150`); no `anyTimes`/`It.isAny` in tests | closed |
| T-01-04 | Spoofing | `findPiSubagentsPackage` evidence | medium | mitigate | `readOptionalPeer` name/version checks (`tests/integration/optional-peer.ts:48-62`) | closed |
| T-01-05 | Elevation of privilege | dynamic import from the override path | low | accept | Test-only variable; see Accepted Risks | closed |
| T-01-06 | Repudiation | test assertions on the marker | medium | mitigate | Closed `{requires pi-mcp-adapter}` literals; marker typed `Reason` (`shared/concerns/soft-dep.ts:67`) | closed |
| T-01-07 | Spoofing | `hasLoadedPiMcpAdapter` | medium | mitigate | Tool arm requires an adapter source (`platform/pi-api.ts:244-249`); unit, mock-Pi e2e and real-Pi RPC rows | closed |
| T-01-08 | Spoofing | `hasLoadedPiMcpAdapter` command arm | low | accept | Impostor only changes markers, never writes; see Accepted Risks | closed |
| T-01-09 | Denial of service | probe arms | low | mitigate | Each arm wrapped by `probeArm` (`pi-api.ts:227-248`); throw rows in `pi-api.test.ts` | closed |
| T-01-10 | Tampering | untyped Pi metadata | low | mitigate | `unknown` inventory fields with `typeof` guards (`pi-api.ts:144-219`) | closed |
| T-01-11 | Repudiation | info `requires:` line | medium | mitigate | One `softDepStatus` snapshot feeds markers and the line (`orchestrators/plugin/info.ts:3089-3090`) | closed |
| T-01-12 | Information disclosure | info `requires:` line | low | accept | Closed three-literal `Companion` union; see Accepted Risks | closed |
| T-01-13 | Information disclosure | `runRpcSession` child env | medium | mitigate | Env built from scratch with four keys (`tests/e2e/_rpc.ts:155-162`), `--offline` | closed |
| T-01-14 | Tampering | sandbox locations | medium | mitigate | Realpath, in-repo and outside-tmp refusals (`_rpc.ts:112-151`); refusal tests for missing and in-repo | closed |
| T-01-15 | Denial of service | Pi process group | low | mitigate | `detached: true` plus group SIGKILL on stop, abort and exit (`_rpc.ts:259-326`) | closed |
| T-01-16 | Tampering | stop-canary.mjs / engine canaries | medium | mitigate | Separator-anchored containment (`stop-canary.mjs:272-296`, `engine-scratch.mjs:98-114`); negative controls recorded | closed |
| T-01-17 | Information disclosure | openai-stub-server.mjs | low | mitigate | Binds `127.0.0.1`; logs time, URL, stream flag and tool names only | closed |
| T-01-18 | Repudiation | README evidence | medium | mitigate | Verbatim transcripts ending in exit lines (`tests/live-uat/README.md`) | closed |
| T-01-19 | Repudiation | e2e matrix assertions | low | mitigate | Whole closed `{…}` block compared; install and list compared per row | closed |
| T-01-SC (01-02, 01-04..01-08) | Tampering | npm/pip/cargo installs | low | accept | These plans install nothing; see Accepted Risks | closed |
| T-01-SC (01-03) | Tampering | scratch `npm install pi-subagents@0.74.0` | medium | mitigate | `--prefix /var/tmp/... --ignore-scripts`; manifests unchanged; prefix removed | closed |
| T-01-SC (01-09) | Tampering | scratch engine 3.13.1 install | medium | mitigate | Scratch prefix, Pi peer checked, prefix removed; engine absent from manifests | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Later changes kept every mitigation: the adapter peer moved to `>=5.2.0 <6`
(D-04-12, D-07-07), the engine pin to 3.14.0 (PR #248), and main's #236
removed `lint:type-members`.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-05 | `PI_SUBAGENTS_ROOT` is read only by tests (absent from `extensions/` and `scripts/`); the operator controls the path (01-03-PLAN) | plan-time threat model | 2026-10-02 |
| AR-01-02 | T-01-08 | A foreign `mcp-adapter` command can only flip a marker or severity; no install write reads it (D-01-05, 01-05-PLAN) | plan-time threat model | 2026-10-02 |
| AR-01-03 | T-01-12 | The `requires:` line prints only a closed companion name plus `(missing)` (01-07-PLAN) | plan-time threat model | 2026-10-02 |
| AR-01-04 | T-01-SC (01-02, 01-04..01-08) | These plans install no package; the manifests are unchanged across them | plan-time threat model | 2026-10-02 |
| AR-01-05 | — (`scripts/pi.sh` pin bump, not in the register) | The operator launcher installs companions into an operator cache prefix with install scripts enabled, by design and predating this phase (`scripts/pi.sh:182-188`); CI installs with `--ignore-scripts` | retroactive audit | 2026-10-09 |

Informational: transitive packages under pi-coding-agent (`@google/genai`,
`esbuild`, `protobufjs`) and `unrs-resolver` carry install scripts. They
fall outside T-01-SC's eight-package scope; every CI install uses
`npm ci --ignore-scripts`, enforced by `scripts/check-workflow-install-scripts.mjs`.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-09 | 23 | 23 | 0 | gsd-security-auditor (retroactive, ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-09
