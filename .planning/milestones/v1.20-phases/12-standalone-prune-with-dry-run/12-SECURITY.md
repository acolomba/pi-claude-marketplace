---
phase: "12"
slug: "standalone-prune-with-dry-run"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-24"
---

# Phase 12 — Security

The eight plans supplied a threat register before implementation. This ASVS
level 1 audit checks each planned mitigation against the implemented command,
tests, and final goal verification report. The configured blocking threshold is
high. No threat remains open at any severity.

## Trust Boundaries

| Boundary | Data Crossing |
| --- | --- |
| Command input to selected scope and removal operation | Scope, flags, and operands supplied by a user |
| Installed manifests to dependency selection | Cached, possibly unreadable declarations |
| Preview or actual result to scope files | State and plugin artifacts; preview must remain read-only |
| Operation result to notifications and docs | Removal status, failure causes, and command instructions |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation and evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-12-01 | Tampering | Scope selection | high | mitigate | Handler rejects extra inputs before operation; project and user scope trees are compared in registered-command integration tests. | closed |
| T-12-02 | Tampering | Declaration index and sweep | high | mitigate | Full offline index and locked sweep recheck holders after failures; failed-member retry and scope integration tests pass. | closed |
| T-12-03 | Information disclosure | Declarer failure output | medium | mitigate | Named declarer failure renders a fixed, path-free cause; exact emitted bytes are asserted in the unreadable-declarer integration test. | closed |
| T-12-04 | Tampering | Preview state read | high | mitigate | Preview uses a nonpersisting read; current, legacy, empty, and missing-state tests compare state bytes and scope trees and check for no lock. | closed |
| T-12-05 | Tampering | Preview to actual transition | high | mitigate | Both modes use the pure fixpoint selector; actual rebuilds selection under its lock. The stale-preview integration test changes state between invocations. | closed |
| T-12-06 | Repudiation | Pending prune row | medium | mitigate | Preview sends information-severity pending rows without a reload hint; notification and catalog contract tests pin the text. | closed |
| T-12-07 | Repudiation | Empty and catalog output | medium | mitigate | Four scoped empty results, actual and pending rows, and failure states are asserted against exact output bytes. | closed |
| T-12-08 | Information disclosure | Declarer catalog example | medium | mitigate | The catalog fixture pins a named failure and sanitized cause against the emitted notification. | closed |
| T-12-09 | Tampering | Handler and registration | high | mitigate | Parser refuses unsupported flags and operands before state access; registration tests verify scope reaches the operation. | closed |
| T-12-10 | Spoofing | Flag catalog and completion | medium | mitigate | Independent drift tests pin accepted flags, help, and completions to the same syntax. | closed |
| T-12-11 | Repudiation | User documentation | medium | mitigate | README and dependency guide describe actual and preview behavior; the doc-agreement test checks the dependency contract. | closed |
| T-12-12 | Tampering | Verification evidence | high | mitigate | Real scope-tree integration tests and direct source/test pairs assert destructive and read-only behavior; final verification reports 27/27 must-haves and passing gates. | closed |

## Accepted Risks Log

No accepted risks.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | ---: | ---: | ---: | --- |
| 2026-09-24 | 12 | 12 | 0 | Codex ASVS L1 artifact audit |

## Sign-Off

- [x] All threats have a disposition.
- [x] No risk acceptance is needed.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-09-24
