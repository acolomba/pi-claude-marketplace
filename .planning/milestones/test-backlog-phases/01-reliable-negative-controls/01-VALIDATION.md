---
phase: 01-reliable-negative-controls
status: passed
nyquist_compliant: true
wave_0_complete: true
---

# Phase 1 Validation

| Requirement | Control                                                          | Command                                                          |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| NEG-01      | Real invalid path, unmappable path, benign child, failed launch  | npm run test:coverage:direct:negative                            |
| NEG-02      | Sandbox versus ordinary execution and analogous assertions audit | Retained reproduction and summary                                |
| HIST-01     | Live import e2e and archived completed requirements              | env -u PI_CODING_AGENT_DIR node tests/e2e/import-command.test.ts |

Aggregate unit coverage is measured separately from the existing direct-pair pin.

## Independent verification

On 2026-09-14, the verifier ran `npm run test:coverage:direct:negative` on Node
v26.8.2. The command passed after exercising the benign child, deliberate failure,
missing executable, signal, wrong-status, missing-diagnostic, and both real CLI
mapping-refusal controls. The verifier also ran the import E2E command above. All
three cases passed.

The baseline records 63,345/63,349 production lines and 9,112/9,113 branches.
Those four lines and one branch in `bridges/agents/convert.ts` remain Phase 3 work.
This phase does not claim complete production coverage.
