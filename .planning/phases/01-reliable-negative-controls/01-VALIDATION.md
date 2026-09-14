---
phase: 01-reliable-negative-controls
status: draft
nyquist_compliant: false
wave_0_complete: true
---

# Phase 1 Validation

| Requirement | Control | Command |
| --- | --- | --- |
| NEG-01 | Real invalid path, unmappable path, benign child, failed launch | npm run test:coverage:direct:negative |
| NEG-02 | Sandbox versus ordinary execution and analogous assertions audit | Retained reproduction and summary |
| HIST-01 | Live import e2e and archived completed requirements | env -u PI_CODING_AGENT_DIR node tests/e2e/import-command.test.ts |

Aggregate unit coverage is measured separately from the existing direct-pair pin.
