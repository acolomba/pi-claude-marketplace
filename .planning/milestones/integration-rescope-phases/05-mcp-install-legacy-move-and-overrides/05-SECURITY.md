---
phase: "5"
slug: "mcp-install-legacy-move-and-overrides"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-22"
---

# Phase 5 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Test harness → product source | Deliberate breaks edited files under `extensions/` for one run each | Source text; must never be committed |
| Executor worktree → main checkout | Break helpers ran in three parallel agent worktrees; the review fixers ran in the main checkout, as instructed | Working-tree paths |
| Frozen plan inputs → executors | `plan-05/inputs/` (break files, helper, checker) copied by each executor | Checked by `SHA256SUMS` |
| Extension → `mcp-adapter.json` / `mcp.json` | Secrets, deny-listed credentials, the user's own servers and overrides | Config text a user edits |

---

## Threat Register

Each plan registered the same classes for its own files (05-01: T-05-01..06, 05-02: T-05-07..12, 05-03: T-05-13..18); T-05-SC is shared.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01, -07, -13 | Tampering | breaks under `extensions/` | high | mitigate | `git diff 356f8bb HEAD -- extensions` is empty; 86 of 86 break logs record `restored=clean` | closed |
| T-05-02, -08, -14 | Tampering | break helper working directory | high | mitigate | Each plan's logs record `root=` of its own worktree (`agent-a1041c0489d90062b`: 24, `agent-a927d7afbe8373d83`: 38, `agent-a891ad8a4b8007c51`: 24) | closed |
| T-05-03, -09, -15 | Tampering | copies of `plan-05/inputs/` | medium | mitigate | Each Task 1 checked `SHA256SUMS` (hash `a339ce02…ba6`); executors report byte-identical copies | closed |
| T-05-04 | Information disclosure | AVAR-05 deny list and option references in `mcp-adapter.json` | medium | mitigate | Scenarios compare the whole file and the whole result payloads; a set token stays a `${...}` reference; `credentials-blanked` notice shown | closed |
| T-05-05, -11, -18 | Repudiation | red-proof records | medium | mitigate | `check-red.mjs` printed `RED-PROOFS OK` (exit 0) for all three plans; it rejects a failure only in a Given, a hook, a timeout, or 0 scenarios (plan-check revision) | closed |
| T-05-06 | Denial of service | a scenario reaching the network | low | mitigate | Drafts use `127.0.0.1:9` instead of the integration files' `example.test` URLs | closed |
| T-05-10 | Tampering | the user's own servers during the move | medium | mitigate | Whole `mcp.json` and `mcp-adapter.json` compared in every move scenario; review CR-02 added the warm-clone load scenario | closed |
| T-05-12 | Tampering | trims of `mcp-migration`, `mcp-verdict-migration`, `mcp-verdict-list` | medium | mitigate | Kept cases match CONTEXT [Kept cases]; trimmed files pass (1, 3, 2 tests) | closed |
| T-05-16 | Tampering | the user's overrides and choices in `mcp-adapter.json` | medium | mitigate | Whole-file checks; review CR-01 made the update publish changed args beside the kept override (break K1 red) | closed |
| T-05-17 | Spoofing | the stand-in for `/mcp-adapter enable` | low | accept | See AR-05-01 | closed |
| T-05-SC | Tampering | package installs | high | mitigate | `package.json` and `package-lock.json` unchanged since `356f8bb` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-17 | The harness has no driver for pi-mcp-adapter's command; the enable step reproduces pi-mcp-adapter 7.0.1's JSON rewrite and names the version, so a later adapter form is a one-place step change | plan 05-03 threat model | 2026-11-22 |

---

## Security Audit

| Date | Threats found | Closed | Open | Method |
|------|---------------|--------|------|--------|
| 2026-11-22 | 21 | 21 | 0 | L1 evidence check by the orchestrator (plan-time register, ASVS 1, short-circuit); SUMMARY threat flags: none |
