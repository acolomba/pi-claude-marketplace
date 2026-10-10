# Deferred Items

- **DEP-07-03-01 — Existing brace-expansion advisory in the root Pi tree.**
  Found while generating the independent 0.86.1 fixture lock on 2026-10-10 UTC.
  Root `package-lock.json` already pins the same `brace-expansion@5.0.9`
  artifact through `minimatch@10.2.6`. npm reports two high-severity recursion
  denial-of-service advisories and one moderate CPU denial-of-service advisory.
  The fixture accepts no attacker-controlled glob patterns and runs bounded,
  isolated offline children, so its specific execution surface is mitigated.
  General root dependency remediation remains open and outside 07-03's scope;
  root dependencies must remain unchanged for this task. See
  [07-PEER-FLOOR-AUDIT.md](./07-PEER-FLOOR-AUDIT.md#transitive-dependency-advisory-disposition)
  for advisory links, versions, and the constrained-fixture assessment. This
  record does not claim that npm audit passes or waive general remediation.
