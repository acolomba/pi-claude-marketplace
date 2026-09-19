# Phase 2: Sonar Rules for Tests — Context

<domain>Adopt useful test assertion rules and disposition other SWTEST-01 clusters.</domain>
<decisions>
- Enable the three assertion rules, not the entire preset.
- Preserve compile-time-only proofs in the seven type-only owner files.
- Strict strong-mock verification and dynamically selected contract cases are real assertions;
  justify narrow analyzer limitations instead of adding vacuous runtime assertions.
- The standalone overload test actually executes production code; assert its real result and
  notification alongside its existing compiler negative, without weakening any other case.
- Other rule clusters require current measurements and explicit rationale.
</decisions>
<code_context>
The current three-rule override scan reports seven no-empty-test-file type-only
owners and six assertions-in-tests sites. Three sites explicitly verify strict mocks;
two dispatch asserting contract functions; one executes only a compile-time proof
following a real asynchronous operation. No no-trivial-assertions findings.
</code_context>
