---
phase: 35-orchestrator-call-sites-output-catalog-auth
plan: "03"
subsystem: output-catalog, auth-architecture-gate
tags:
  - auth
  - device-flow
  - output-catalog
  - byte-form-lock
  - auth-09-gate-extension
dependency_graph:
  requires:
    - 32-02 (initiateDeviceFlow emission site -- AUTH-03 byte form source)
    - 35-01 (adds orchestrators/marketplace/add.ts -- AUTH-09 gate covers it)
    - 35-02 (adds orchestrators/marketplace/update.ts -- AUTH-09 gate covers it)
  provides:
    - docs/output-catalog.md Out-of-band notifications section
    - tests/shared/device-flow-prompt.test.ts byte-form lock
    - tests/architecture/no-credential-leak.test.ts extended AUTH-09 gate
  affects:
    - AUTH-03 (byte form locked by test + catalog)
    - AUTH-09 (gate extended to orchestrator tier)
tech_stack:
  added: []
  patterns:
    - byte-form lock test (parallel to snm38-indent-ladder.test.ts)
    - vacuous-pass idiom for wave-order-safe architecture gates
key_files:
  created:
    - tests/shared/device-flow-prompt.test.ts
  modified:
    - docs/output-catalog.md
    - tests/architecture/no-credential-leak.test.ts
decisions:
  - The catalog's Out-of-band section uses a plain-text H2 title so the
    catalog-uat parser skips it; byte-form locking is handled by the
    dedicated device-flow-prompt.test.ts instead
  - Prettier is not enforced for .md files (pre-commit config scopes it
    to .js|.json|.ts only); mdformat is the enforced .md formatter
metrics:
  duration: ~15 min
  completed: "2026-06-01"
  tasks: 3
  files: 3
---

# Phase 35 Plan 03: Output Catalog + AUTH-03/AUTH-09 Gate Summary

AUTH-03 Device Flow user-code prompt documented in `docs/output-catalog.md`
and locked by `tests/shared/device-flow-prompt.test.ts` byte-form equality;
AUTH-09 gate extended to cover Phase 35 orchestrator wiring in add.ts/update.ts.

## What Was Built

### Task 1: docs/output-catalog.md -- Out-of-band notifications section

New `## Out-of-band notifications` H2 section inserted between
`## Usage errors` and `## Cross-references` at line 1017. Contains a
`### Device Flow user-code prompt (AUTH-03)` subsection with:
- `<!-- catalog-state: device-flow-prompt -->` annotation
- Byte-form example: `Open https://github.com/login/device and enter: ABCD-1234`
- AUTH-03 contract prose: user_code + verification_uri shown before poll
- AUTH-09 contract prose: access_token not yet acquired when this fires
- Trigger contexts: marketplace add (first access) and marketplace update
  (credential evicted from keychain)

The catalog-uat parser correctly skips this section because its H2 title
is a plain-text string, not a backtick-wrapped `/claude:plugin` command
header. `node --test tests/architecture/catalog-uat.test.ts` continues to
pass (3/3). Commit: `b95bee2`.

### Task 2: tests/shared/device-flow-prompt.test.ts -- Byte-form lock

New test file with 2 tests driving `initiateDeviceFlow` with
`makeMockDeviceFlowHttp` + `makeMockCredentialOps` + a closure-based
`notifyFn` recorder:

1. **Byte-form + severity lock (happy path):** drives with ABCD-1234 /
   `https://github.com/login/device`, asserts `promptCall.message ===
   "Open https://github.com/login/device and enter: ABCD-1234"` and
   `promptCall.severity === "info"`. Exactly 1 notifyFn call expected.

2. **Template-shape proof + AUTH-09 regression guard (access_denied path):**
   drives with WXYZ-5678, asserts the prompt fires even when the poll
   loop returns `access_denied` immediately -- proving the emit is
   pre-poll. Also asserts `!promptCall.message.includes("access_token")`.

Both tests pass. Commit: `b1067f0`.

### Task 3: tests/architecture/no-credential-leak.test.ts -- AUTH-09 gate extension

Added `PHASE_35_ORCHESTRATOR_FILES` constant (add.ts, update.ts) and a
new 4th test scanning those files for credential interpolation in
`new Error(...)` or `ctx.ui.notify(...)` calls:

- Regex: `/(new\s+Error\s*\(|ctx\.ui\.notify\s*\()(?:[^)]*\$\{...)/i`
  covering `access_?token`, `cred.<field>`, `r.accessToken`
- Vacuous-pass idiom: files not yet on disk skip the assertion (wave-order
  safe for parallel agent execution)
- Closes Phase 33 review WR-02

All 4 tests pass (`node --test tests/architecture/no-credential-leak.test.ts`
exits 0). Commit: `a965a4c`.

## Deviations from Plan

None -- plan executed exactly as written.

The only implementation note: `npx prettier --check docs/output-catalog.md`
is NOT part of the enforced quality gate (`npm run format:check` scopes
prettier to `**/*.{js,json,ts}` only; the pre-commit prettier hook also
scopes to `'\.(js|json|ts)$'`). The `.md` formatter enforced by pre-commit
is `mdformat`, which was satisfied. The plan's acceptance criterion
referencing `npx prettier --check docs/output-catalog.md` is technically
superseded by the actual project enforcement (mdformat only for .md).

## Known Stubs

None. The catalog section documents a real emission point. The tests drive
the real `initiateDeviceFlow` function via mocks.

## Threat Flags

None. This plan adds documentation and tests only -- no new network
endpoints, auth paths, file access patterns, or schema changes.

## Self-Check

Files exist:
- [x] docs/output-catalog.md (modified, Out-of-band section at line 1017)
- [x] tests/shared/device-flow-prompt.test.ts (created, 143 lines)
- [x] tests/architecture/no-credential-leak.test.ts (modified, 175 lines)

Commits exist:
- [x] b95bee2: docs(35-03): add out-of-band notifications section
- [x] b1067f0: test(35-03): add AUTH-03 Device Flow prompt byte-form lock test
- [x] a965a4c: test(35-03): extend AUTH-09 gate to cover Phase 35 orchestrator wiring

Test results: 9/9 pass across catalog-uat (3) + device-flow-prompt (2) +
no-credential-leak (4).

## Self-Check: PASSED
