---
phase: 114
slug: plugin-and-marketplace-lifecycle
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-01
---

# Phase 114 — Security

> Plan-authored lifecycle threat mitigations verified against the completed implementation, direct owners, retained integrations, architecture carriers, and review-fix evidence.

## Audit Basis

- Register origin: plan-authored (`114-01-PLAN.md` through `114-14-PLAN.md`).
- Policy: OWASP ASVS Level 1; `workflow.security_block_on: high`.
- Register: 24 high-severity `mitigate` threats; no accepted or transferred risks.
- Current direct evidence: all 14 owner suites pass at 100 percent direct functions, lines, and branches.
- Current aggregate evidence: 886/886 owner cases, 75/75 absorbed single-owner cases, 7/7 retained integrations, and 9/9 architecture carriers.
- Repository evidence: the clean-worktree `npm run check` passed; typecheck, lint, fallow, formatting, 4,710 unit cases, and 28 integration cases are green.
- Bypass evidence: no test-only seam, coverage exception, impossible cast, or remaining `test.*`/`t.*` only, skip, or todo call exists in the Phase 114 owners and integrations.

## Trust Boundaries

| Boundary                                                      | Threats                                                                                        | Data crossing                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Marketplace source, Git, credential, and Device Flow boundary | T-114-01-A, T-114-06-A, T-114-08-A, T-114-09-B, T-114-10-A, T-114-12-A, T-114-14-B             | Source URLs, refs, credential requests/results, clone schedules, temporary roots, and redacted diagnostics                 |
| Scope configuration and public inventory boundary             | T-114-02, T-114-03, T-114-04, T-114-07-A, T-114-11                                             | User/project selection, config/state bytes, public rows, statuses, reasons, ordering, and immutable read-only state        |
| Mutation, transaction, cleanup, and retry boundary            | T-114-01-B, T-114-05-A, T-114-06-B, T-114-08-B, T-114-10-B, T-114-12-B, T-114-13-A, T-114-14-A | Phase commits, authoritative bytes/trees, rollback effects, partial outcomes, cleanup leaks/residue, and retry convergence |
| Offline and diagnostic disclosure boundary                    | T-114-05-B, T-114-07-B, T-114-09-A, T-114-13-B                                                 | Basename-safe messages, catalog diagnostics, external-call schedules, and credential/token absence                         |
| Generated update artifact boundary                            | T-114-14-C                                                                                     | Known generated skill names, staged agent artifacts, bridge conversion, and exported-workflow results                      |

## Threat Register

| Threat ID  | Category                           | Component                               | Mitigation verified                                                                                                       | Status |
| ---------- | ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| T-114-01-A | Spoofing / Information Disclosure  | marketplace add Git/auth boundary       | Fresh fail-fast memory fakes, explicit remote allowlists, exact credential and Device Flow schedules, no live credentials | closed |
| T-114-01-B | Tampering / Information Disclosure | add clone and persistence paths         | Contained roots, stale/escape refusal, exact bytes/trees, cleanup residue, and safe retry                                 | closed |
| T-114-02   | Tampering / Information Disclosure | autoupdate scope write-back             | Exact scope selection, before/after bytes, atomic-write failure, strict collaborators, and retry proof                    | closed |
| T-114-03   | Information Disclosure / Tampering | marketplace info projection             | Exact catalog bytes, basename-safe failures, exported-flow immutability, and no-network evidence                          | closed |
| T-114-04   | Information Disclosure / Tampering | marketplace list projection             | Exact rows, immutable state/tree, project-before-user traversal, and no-network evidence                                  | closed |
| T-114-05-A | Tampering / Repudiation            | marketplace removal partial state       | Exact per-plugin schedule, authoritative bytes/tree, real partial outcomes, cleanup residue, and retry convergence        | closed |
| T-114-05-B | Information Disclosure             | removal diagnostics and offline cleanup | Contained roots, basename-safe notifications, strict Pi/cascade verification, and no-network carrier                      | closed |
| T-114-06-A | Spoofing / Information Disclosure  | marketplace update Git/auth refresh     | Allowlisted memory ports, disabled network fallback, exact schedules, and no developer credentials                        | closed |
| T-114-06-B | Tampering / Repudiation            | marketplace batch partial state         | Per-target state/config/tree proof, retained earlier commits, structured failures/leaks, and retry convergence            | closed |
| T-114-07-A | Tampering / Elevation of Privilege | enabled-state and scope transition      | Exact two-scope bytes, direct/cascade parity, contained trees, and safe retry                                             | closed |
| T-114-07-B | Information Disclosure             | enable/disable external boundary        | Path/warm fixtures, strict connected collaborators, and no-orchestrator-network proof                                     | closed |
| T-114-08-A | Spoofing / Information Disclosure  | plugin fetch Git/auth boundary          | Fresh allowlisted fakes, disabled network fallback, exact calls, and no live credentials                                  | closed |
| T-114-08-B | Tampering                          | fetch clone cache and staging           | Case-owned roots, exact promotion/staging trees, collision/race behavior, cleanup, and retry                              | closed |
| T-114-09-A | Information Disclosure             | plugin info diagnostics                 | Exact catalog and basename-safe output, immutable local state, and no credential/token text                               | closed |
| T-114-09-B | Spoofing / Information Disclosure  | explicit info fetch                     | Allowlisted injected ports and fail-fast zero-call proof outside explicit fetch                                           | closed |
| T-114-10-A | Spoofing / Information Disclosure  | plugin install Git/auth boundary        | Fresh allowlisted memory ports, zero live credentials, exact calls, and offline warm/path proof                           | closed |
| T-114-10-B | Tampering / Repudiation            | install ledger and bridge artifacts     | Exact phase/undo/finalize schedules, contained bytes/tree, structured rollback partials, and retry                        | closed |
| T-114-11   | Information Disclosure / Tampering | plugin inventory projection             | Exact catalog bytes, fixed scope semantics, immutable exported flow, basename-safe reasons, and no-network carrier        | closed |
| T-114-12-A | Spoofing / Information Disclosure  | cold reinstall auth boundary            | Fresh allowlisted ports, no live credentials, exact schedules, and recorded-SHA warm zero-call proof                      | closed |
| T-114-12-B | Tampering / Repudiation            | reinstall replacement rollback/finalize | Contained roots, exact reverse order, bytes/tree/backup evidence, structured leaks, and retry convergence                 | closed |
| T-114-13-A | Tampering / Repudiation            | uninstall state and best-effort cleanup | Exact config/state/tree bytes, forward cascade→persistence→cleanup evidence, real partial state, and safe retry           | closed |
| T-114-13-B | Information Disclosure             | offline uninstall and phase aggregate   | Strict collaborators, exact catalog diagnostics, no-network proof, and all 14 direct records                              | closed |
| T-114-14-A | Tampering / Repudiation            | heterogeneous plugin update             | Exact bridge commit/undo/finalize schedules, authoritative bytes/trees, batch partials, and retry                         | closed |
| T-114-14-B | Spoofing / Information Disclosure  | plugin update Git/auth boundary         | Fresh allowlisted ports, no live credentials, exact schedules, and offline path/warm/recorded-SHA evidence                | closed |
| T-114-14-C | Tampering                          | generated agent skill preload           | Exported update workflows prove recorded generated skill names reach staged agent conversion artifacts                    | closed |

## Security Controls Verified

- **Containment:** every mutation uses case-owned scope roots and temporary trees; escape, stale destination, collision, and special-filesystem-kind partitions are explicit.
- **Credential isolation:** Git, credential, and Device Flow behavior uses fresh memory fakes or loopback-only fixtures with exact allowlists. No developer credential or live remote is used.
- **Atomicity fidelity:** tests prove the real mutation unit. They retain prior successful commits where the product does, expose partial outcomes and cleanup residue, and do not invent command-wide rollback.
- **Recovery:** failure cases assert authoritative post-failure bytes/tree state and a second invocation that safely converges.
- **Disclosure control:** messages are exact and basename-safe, causal failures are redacted as required, and credential/token text is absent.
- **Offline enforcement:** path, warm-cache, recorded-SHA, read-only, enable/disable, remove, and uninstall arms have zero-call proof plus architecture enforcement.
- **No bypass:** the WR-01 remediation removes environment-dependent permission skips. Deterministic case-owned `EACCES` faults run through exported `getPluginInfo`, restore the original filesystem descriptor, and leave zero skipped cases.

## Accepted Risks Log

No accepted risks.

## Audit Findings

- All 24 declared threats are closed by current executable evidence.
- No blocking or below-threshold open threat remains.
- No summary introduces an unregistered threat or accepted risk.
- CodeGraph-proven private simplifications narrow unreachable states; they do not widen public input, weaken validation, alter scope/transaction order, or add a test bypass.
- The Unix-domain-socket `EPERM` is a restricted-runner limitation, not a product mitigation gap. The unchanged fixture and full repository gate pass on the approved unsandboxed runner.

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks are documented (none).
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-09-01
