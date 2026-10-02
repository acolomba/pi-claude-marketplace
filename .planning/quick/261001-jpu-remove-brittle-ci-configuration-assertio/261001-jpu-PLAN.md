---
quick_id: 261001-jpu
status: complete
description: Remove brittle CI configuration assertions and retain the separate Sonar workflow
---

# Remove CI configuration assertions

Delete `tests/architecture/ci-check-ownership.test.ts` as requested. The file
asserts workflow text, field order, job lists, and skipped-hook inventories.
It has no importers and no production module pairing. Its shared hook reader
still has another consumer, so retain that helper.

Keep the separate Sonar workflow, all CI configuration, the parallel coverage
implementation, and the worker-pool controls. Work inline on the existing
feature branch through the single-agent quick workflow.

Verify the removal with type checking, corresponding-test validation, suite-glob
completeness, workflow policy checks, applicable commit hooks, and Fallow audit.
The prior full check remains the baseline. A test-only deletion does not require
another full suite under the project's TypeScript test review guidance.

Commit the deletion, then record the outcome and quick-task registry entry in
a separate planning commit.

## Threat model

No runtime or workflow configuration changes. The requested deletion removes
configuration assertions only; workflow policy and security tools remain active.
