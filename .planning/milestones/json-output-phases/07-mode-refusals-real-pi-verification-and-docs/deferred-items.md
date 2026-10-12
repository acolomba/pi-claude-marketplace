# Deferred Items

- **DEP-07-03-01 — Existing brace-expansion advisory in the root Pi tree.**
  Found while generating the independent 0.86.1 fixture lock on 2026-10-10 UTC.
  Root `package-lock.json` already pins the same `brace-expansion@5.0.9`
  artifact through `minimatch@10.2.6`. npm reports two high-severity recursion
  denial-of-service advisories and one moderate CPU denial-of-service advisory.
  The fixture accepts no attacker-controlled glob patterns and runs bounded,
  isolated offline children, so its specific execution surface is mitigated.
  07-03 left root dependencies unchanged. Lock commit `a12dfa16` later pinned
  the root `node_modules/brace-expansion` entry at 5.0.12.
  `npm audit --package-lock-only` still reports the copy that Pi's own
  `npm-shrinkwrap.json` pins at
  `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion`,
  and BACKLOG.md DEPADV-01 carries it. See
  [07-PEER-FLOOR-AUDIT.md](./07-PEER-FLOOR-AUDIT.md#transitive-dependency-advisory-disposition)
  for advisory links, versions, and the constrained-fixture assessment. This
  record does not claim that npm audit passes or waive general remediation.

- **TEST-07-06-01 — Existing optional pi-subagents resolver integration skip.**
  Both complete corpus captures and the strict comparison select
  `tests/integration/skill-path-resolution.test.ts:124`; its SC-2 / AGSK-06
  case skips with `pi-subagents resolver module not reachable in this environment`.
  The unchanged test deliberately skips when the optional companion's internal
  resolver cannot load. No dependency installation, test edit, mode change, or
  recorder suppression was used. The corpus reports retain 10,228 tests,
  10,227 passing, zero failed/cancelled/todo, and this one skip. All eight
  real-Pi current/floor tests passed separately with zero skips. Parent review
  must retain this coverage limitation. Shared tracking is parent-owned;
  suggested WINDOWS entry: kind `skipped-test`, phase `07`, description
  `[json-output] Existing optional pi-subagents resolver integration case skips because its module is unavailable; no new test skip was introduced.`
  The two resolver commits `3f20490a` and `9829a30e` make both resolver tests
  resolve the pi-subagents root before the hermetic HOME swap, so the SC-2 /
  AGSK-06 case runs where the global peer is installed; CI installs no global
  peer and still skips it; WINDOWS #89 records the disposition.
  status: acknowledged
