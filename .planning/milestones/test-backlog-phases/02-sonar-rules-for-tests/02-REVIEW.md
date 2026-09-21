---
phase: 02-sonar-rules-for-tests
reviewed: 2026-09-14
depth: standard
files_reviewed: 8
status: clean
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
---

# Sonar policy review

Reviewed inline by the parent after independent reviewer dispatch was refused
by the session's agent thread limit. Independent goal verification remains
separate; this is not presented as a second agent's review.

The test block deliberately adds only the three assertion rules. The later
seven-path override changes only `no-empty-test-file`, so runtime assertions
remain subject to the other two rules. Five single-line S2699 exceptions
preserve actual dynamic callback assertions and strict-mock verification;
none replaces a behavior check with a no-op.

The overload case places its `@ts-expect-error` assignment before runtime
narrowing, preserving the negative type proof. It additionally checks the
undefined result and complete notification payload.

The architecture controls load the real project config. Fatal parser errors
are rejected, and errors must identify the intended Sonar rule at severity 2.
Turning each rule off changes its offender outcome. Every type-only path has
an inverse control that forces the rule on and observes the empty-file error.
Unrelated lint diagnostics in planted snippets are intentionally outside
these rule-specific assertions; full repository ESLint remains a separate gate.

Cluster review checked all regex-performance, type-comparison, extra-argument,
undefined-argument, and misleading-sort findings. The two extra-argument
flags are Promise resolver reassignments; runtime shape assertions are
intentional. Sorting file inventories does not promise locale collation.
Fixture credentials and rejected insecure URLs are test inputs, not live
credentials or network choices. The complete policy preserves these
distinctions and records counts without calling all flags defects.

No concrete blocker or warning remains. Full lint/typecheck and the 13
controls passed. The full unit run passed 6,016 tests with exact production
coverage; that is regression evidence, not proof of assertion quality.
