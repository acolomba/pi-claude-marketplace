---
phase: "6"
slug: "hooks-and-auth"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-22"
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness → product source | Deliberate breaks edited files under `extensions/` for one run each | Source text; must never be committed |
| Executor worktree → main checkout | Break helpers ran in two parallel agent worktrees; the review fixer's break runs ran in the main checkout, as instructed | Working-tree paths |
| Frozen plan inputs → executors | `plan-06/inputs/` copied by each executor | Checked by `SHA256SUMS` |
| Scenario → git host | One-shot (print/json) Pi runs with GitHub's requests routed to the stand-ins | Credentials, device codes, tokens |
| Harness → host processes | The hook-process release kills process groups that carry the scenario's dispatch marker | Signals to processes |

---

## Threat Register

Each plan registered the same classes for its own files (06-01: T-06-01..07, 06-02: T-06-08..14); T-06-SC is shared.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01, -08 | Tampering | break runs under `extensions/` | high | mitigate | `git diff 4a01e6d HEAD -- extensions` is empty; 25 of 25 plan break logs record `restored=clean` | closed |
| T-06-02, -09 | Tampering | break helper working directory | high | mitigate | Plan logs record `root=` of their own worktrees (`agent-a69ed2a184b8f653c`: 17, `agent-aed6bf1eea7d25897`: 8); the four main-checkout roots are the review fixer's runs, as instructed | closed |
| T-06-03, -10 | Tampering | copies of `plan-06/inputs/` | medium | mitigate | Each Task 1 checked `SHA256SUMS` (hash `4fe7d227…3490`); executors confirmed byte-identical copies | closed |
| T-06-04, -11 | Repudiation | red-proof records | medium | mitigate | `check-red.mjs` printed `RED-PROOFS OK` for both plans; the verifier re-parsed the logs and the failure lists match | closed |
| T-06-05 | Denial of service | F1 reads an unreaped hook process as gone | low | mitigate | Review WR-01/IN-02: a gone leader now triggers a `/proc` scan that kills a group whose members carry this sandbox's marker; unexpected read errors fail the release | closed |
| T-06-06 | Repudiation | F2 leaves a half-written log line for the next read | low | accept | See AR-06-01; review WR-01 (iter 2) made both readers agree and a never-finished line fail loudly | closed |
| T-06-07, -14 | Tampering | deletions and trims of integration files | medium | mitigate | Each deleted case failed its scenario under a break first; HOOK-E2E-04 restored on the user's parity decision (ea41268) | closed |
| T-06-12 | Information disclosure | a one-shot Pi reaching GitHub's real address | high | mitigate | `oneShotPiLaunch()` always passes the routed git environment and the GitHub redirect together, and throws if the redirect is missing (verifier) | closed |
| T-06-13 | Information disclosure | credential text in printed output; a stale credential kept | medium | mitigate | Review WR-04 added `no result of the command contains {string}` for both tokens (red under a leak break); AUTH-07 scenarios show the eviction | closed |
| T-06-SC | Tampering | package installs | high | mitigate | `package.json` and `package-lock.json` unchanged since `4a01e6d` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-06 | A line still unfinished after a 1 s wait fails the read; a line that starts after a turn's closing read belongs to no turn, the same as any line written between two steps | plan 06-01 threat model, review iteration 3 | 2026-11-22 |

---

## Security Audit

| Date | Threats found | Closed | Open | Method |
|------|---------------|--------|------|--------|
| 2026-11-22 | 16 | 16 | 0 | L1 evidence check by the orchestrator (plan-time register, ASVS 1, short-circuit); SUMMARY threat flags: none |
