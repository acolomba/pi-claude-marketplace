---
quick_id: 260914-aer
status: complete
commit_status: committed
commit: de4a9424
---

# Upstream dependency rejection

Implemented the user's decision as D-01-35 and closed WR-01's design question.
Commit `de4a9424` includes this implementation and the coupled review fixes.
The operator approved whitespace-only `.mcp.json` formatting, which removed
the original blocker. GSD configuration remains uncommitted.

## Changes

- Reject a complete dependency declaration when its field is not an array or
  any element is unusable. Missing and empty declarations remain valid.
- Reject an invalid own plugin.json in both strict and loose resolution; a
  valid bare sibling or marketplace fallback cannot rescue it.
- Replace an invalid named marketplace entry with upstream's unsupported source
  stub. Drop an invalid unnamed entry. Preserve healthy siblings and on-disk bytes.
- Report rejection in info, including installed plugins, without changing the
  installation record. Preserve valid rendering and constraint metadata.
- Correct the version-pattern comment: object ranges are broader than the
  caret-only bare-string range syntax. Actual constraint resolution is Phase 3.
- Repair a successful-install test's invalid fixture and narrow the vocabulary
  guard at the two exact upstream source-marker sites. Its counterexample still
  rejects an obsolete status literal in the same file.

## Verification

- Negative controls reproduced marketplace rejection and strict/loose resolver
  failures before the implementation.
- Direct coverage passed for all four affected production modules: dependencies
  (39/39 branches), manifest (24/24), resolver (275/275), and info (378/378).
  Each also has 100% function and line coverage.
- Info coverage now includes actual candidate-file obstacles, corrupt mirror
  metadata, selected-manifest read failures and installed dependency rendering.
  The follow-up review-fix pass resolves the ENOTDIR disagreement under CR-02.
- All 5,389 unit tests passed. All 13 integration test files passed. These ran
  separately because npm run check stops at the unrelated format failure.
  Sandbox-denied subprocess/socket tests pass with the required permissions.
- Corresponding-test checks and their negative controls passed. Direct-coverage
  negative controls passed outside the sandbox.
- Typecheck, ESLint, fallow, changed-file formatting and filesystem secret scan
  were run. The scan found zero verified or unverified secrets.
- The original npm run check stopped at .mcp.json. The operator-approved format
  removed that blocker. The review-fix report records the final checks.

## Remaining work

The review-fix pass resolves the six follow-up findings.
Phase verification and roadmap updates remain open.
Keep `.planning/config.json` uncommitted. Do not reopen WR-01's choice.
