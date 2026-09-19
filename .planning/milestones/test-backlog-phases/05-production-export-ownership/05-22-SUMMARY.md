---
phase: 05-production-export-ownership
plan: "22"
status: complete
requirements-completed: []
plan_head_before: 80705c58
actuals:
  tasks: 3
---

# Containment ownership and retired errors

The complete injected containment policy lives in shared/path-containment.ts. Its real Node adapter imports the public factory and inspector contract, while preserving assertPathInside and both consumed error re-exports at shared/path-safety.ts. The lexical-traversal class is private; its complete observable failures remain covered through the public guard. This is one coherent policy and its filesystem adapter.

CodeGraph and source references reconfirmed no production readers for ConcurrentUninstallError, AgentForeignContentError or STATE_LOCK_HELD_PREFIX. Both unused classes and the unused prefix are retired with their exclusive constructor/constant checks. The agent stage comment now describes its existing soft-failure result; no stage implementation changes. StateLockHeldError remains the actual lock diagnostic, with unchanged complete message and concurrent behavior.

## Assertion ledger

- Complete injected policy implementation moves byte-for-byte except LexicalTraversalError export visibility; Node binding is its real production consumer.
- Two error-constructor cases move intact to policy owner. Ten real filesystem boundary cases remain at adapter owner and run through a freshly bound public policy factory at policy owner; all expected errors, unchanged external trees and bytes remain. Private lexical constructor is checked by exact name plus live public parent inheritance and full fields; no fabricated runtime access.
- Four explicit inspector scenarios move intact to policy owner. Lexical no-inspection error adds complete name/message to existing normalized fields; all inspection sequences/identity errors remain.
- ConcurrentUninstallError retires with its only constructor test: two inheritance assertions and complete name/message/plugin/cause. No production constructor/reader exists.
- AgentForeignContentError retires with two exclusive cases: three inheritance assertions; whole name/message/parent/child/targetPath/reason/cause; whole two adjacent targets/reasons. Its only residual production mention is a stale stage comment corrected to actual failed[] behavior. Live ownership/containment classes unchanged.
- STATE_LOCK_HELD_PREFIX has zero production readers, so declaration and its three private-only prefix assertions retire. Complete StateLockHeldError message remains in shared errors owner. Both integration regex checks use identical independent literal bytes; all race outcome/exit/state/staging/convergence assertions unchanged.
- Recovery prefix and every unrelated error/type/assertNever assertion remain byte-for-byte.
- Four-file isolated preparation passed native tests and100% lines/functions/branches for both source modules; checkout validation remains pending integration and explicit wave3 go.


## Checkout verification

All thirteen prepared baseline hashes matched before application. The two policy/adapter owners, two error owners, marker owner, two real concurrency integration suites and fifteen Sonar controls passed together: **138/138 checks**, zero failures, cancellations, skips or todos. Log: `/tmp/test-backlog-owner22-final.log`. The containment owners account for 26 real cases; the shared lock controls still discriminate actual refusal from setup or child-process errors.

Five direct owners passed the unchanged instrument (`/tmp/test-backlog-owner22-direct.log`): containment 191/191 lines, 11/11 functions, 33/33 branches; filesystem adapter 18/18, 2/2, 3/3; shared errors 755/755, 49/49, 130/130; bridge errors 92/92, 8/8, 9/9; marker 15/15, 0/0, 1/1 before final EOF normalization. Final stable-wave pair measurements supersede formatting-only line counts. Scoped lint passed for all thirteen files in `/tmp/test-backlog-wave3-parent-lint.log`.

Exactly five initial unused-export findings are expected to disappear: path-safety.createPathSafetyGuard and LexicalTraversalError, errors.ConcurrentUninstallError, errors-bridges.AgentForeignContentError, and markers.STATE_LOCK_HELD_PREFIX. The factory has a real production caller; the private lexical class remains live; the other three definitions have no callers and are retired. No new duplicate-export finding is introduced by the consumed error facades.

The isolated preparation result in the ledger is superseded by checkout verification above. Native aggregate coverage, complete direct sweep, independent review, calibrated census and full pre-commit remain parent integration gates. No skip, stub, fake production reader, threshold, pin or production exclusion was introduced. Actual token usage was not available; commits remain parent-owned.


## Final parent acceptance

Completed in `6a463603` with the five-plan stable wave. Earlier pending statements record executor handoff and are superseded by this acceptance. All 6,238 unit tests pass; each of 225 emitted production modules retains exact 100% coverage, totaling 62,680/62,680 lines, 1,835/1,835 functions and 9,065/9,065 branches. All 234 direct pairs pass, including nine type-only owners and the two unchanged existing pins. The complete census moves from 85 to 57 through exactly 28 reviewed removals, with zero additions; all 43 analyzer/census controls and fifteen Sonar controls pass. Independent review reports zero findings across the 56-file scope. Full mandatory pre-commit passes. See [wave verification](05-WAVE-3-VERIFICATION.md) for evidence and limits. Remaining export plans keep EXPORT-01 and EXPORT-02 open.
