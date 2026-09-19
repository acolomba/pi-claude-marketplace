# Phase 7: Reliable Coverage Metrics — Context

Recorded from the authorized FLOW-05 scope and measured producer/consumer research.

## Decisions

- **D-01:** Preserve the current native aggregate production unit coverage at exactly 100% in all three dimensions. Keep Sonar on `coverage/unit.lcov`. Integration/e2e reports and the direct-pair pin remain separate measurements.
- **D-02:** Capture raw V8 data from the same successful unit run as the native LCOV. Bind the report to immutable source/test/tool inputs and reject drift, failed runs, incomplete captures, empty production inventories, stale reports, and missing reports. Do not certify the exploratory capture made while files were changing.
- **D-03:** Promote only a converter that passes exact-coordinate and syntax-completeness controls. Never clamp negative coordinates, substitute null/Infinity, guess method names from suffixes, or accept Fallow's matching percentage as proof of one-to-one function identity.
- **D-04:** Use executed JavaScript and source-proven UTF-16 mappings. An explicit identity map includes each end-of-line coordinate. Restore producer-generated names only when the original AST declaration proves the source identity. Validate every production function and statement relationship independently of Fallow's nearest-function fallback.
- **D-05:** The unmodified researched converter is not accepted: it omits a nested callback in a logical expression. Prefer a corrected upstream release; otherwise use an explicitly maintained, version-specific, licensed producer patch only after the complete conformance corpus passes. Never silently mutate node_modules during ordinary test or gate execution.
- **D-06:** Add CRAP 30 after producer acceptance, preserving existing cyclomatic, cognitive, and unit-size limits. Research demonstrated an uncovered complexity-6 function scoring 42 and failing, and its covered counterpart scoring 6 and passing. Verify the threshold boundary itself. Reassess against certified production measurements before activation; do not hide a discrepancy by changing coverage.
- **D-07:** Different coverage models have different statement/function/branch denominators. Report faithful AST measurements honestly, including deficits, without calling them native unit-coverage regressions or claiming they are automatically false. Investigate their causes. The native 100% invariant remains binding throughout.
- **D-08:** Keep existing whole-tree health and duplication policy. Apply production coverage completeness and CRAP assertions to the production function population, without demanding fabricated coverage for test/script rows or excluding extension code from analysis.
- **D-09:** Validate nested/same-line/Unicode functions, partial and zero execution, methods with repeated names, logical-expression descendants, implicit branches, malformed coordinates, missing functions/statements, source changes, and missing/stale reports. Pair offenders with benign controls and test the shipping gate, not a bypass configuration.
- **D-10:** Integrate capture, validation, conversion, and consumption into the actual local/CI check order. Avoid duplicate unit runs when one current validated result suffices. Freshness is a checked content contract, not an assumed filename or modification time.

## Implementation discretion

Choose coherent scripts and dependency delivery after reviewing the measured APIs and upstream provenance. A version's recent publication alone is not evidence of a malicious package; assess its history and actual source. Keep the current CRAP setting disabled until all acceptance criteria hold, then enable the chosen additional gate. The research's one-line walker experiment is a lead, not proof that a patched producer is correct.

A substantive product or metric-policy conflict discovered during certified measurement must be raised in this session. No such conflict is established by the exploratory data.
