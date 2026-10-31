---
phase: 04-wire-schema-and-json-strategy
reviewed: 2026-10-06T14:43:09Z
depth: standard
diff_base: db6ce33a
reviewed_commit: bbbd9a1d7d2b5c0e1b54506b4c4ca8db75da2866
files_reviewed: 6
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notification-present.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/redact-credentials.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/shared/notification-present.test.ts
  - tests/shared/notification-resolve.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-06T14:43:09Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found — one carried Info item; no required code fixes

## Summary

Recovery of gap-fix review iteration 2, against the explicit six-file scope and
`db6ce33a` base. All six files were read in full. The review traced the relevant
producer, presentation, text, and JSON paths and checked commits `fbbacb2f`,
`a100e112`, and `cb18acb2` against the current checkout.

The prior CR-02, WR-07, and WR-08 are resolved. No new Blocker or Warning-tier
finding was established. IN-10 remains an informational display-policy note.
The accepted conservative masking of a trailing `scheme://host:port` row name
and hyphenated prose following `Bearer` is not reopened.

No structural pre-pass payload was supplied. The interrupted review's
`fallow review --base db6ce33a --brief` attempt failed with exit 2 because its
temporary worktree was unavailable; that attempt was not repeated. No
structural-analysis success is claimed.

## Info

### IN-10: SSH URL subjects mask a non-secret username

**Classification:** Info (outside the required fix set).

**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-resolve.ts:357`

**Related source:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/redact-credentials.ts:29-40`

**Issue:** A failed-add block named `ssh://git@github.com/o/r.git` is displayed
as `ssh://***@github.com/o/r.git`, while the scp-style
`git@github.com:foo/bar.git` stays unchanged. This preserves the prior review's
Info note about hiding a username that is not itself a secret. It does not
identify a credential leak or invalidate the three fixes.

The earlier note understated existing coverage:
`tests/shared/redact-credentials.test.ts:23-26` already pins SSH username
masking, and `tests/shared/notification-present.test.ts:613-649` pins it in an
info cascade. The subject-name tests in
`tests/shared/notification-resolve.test.ts:804-851` cover HTTPS userinfo and
scp-style preservation, but do not explicitly record this SSH subject case.

**Fix:** As an optional documentation follow-up, state that all scheme-qualified
userinfo, including a username-only SSH authority, is intentionally masked.
Add the SSH subject example beside the existing subject-name cases if that
distinction needs a local regression lock. No change to the redaction policy
is required by this review.

## Disposition of Required Findings from Iteration 1

| Prior finding | Fix | Current evidence |
| --- | --- | --- |
| CR-02: split-key password leak | Resolved by `fbbacb2f` | `notification-resolve.ts:372-389` restores the trailing `@` before redaction, then removes it. The split row `foo@https://alice:s3cret` becomes `foo@https://***`. The owner test at `notification-resolve.test.ts:883-900` asserts the complete resolved value; the AUTH-09 row at `no-credential-leak.test.ts:966-989` inspects the presentation, payload, and text. |
| WR-07: non-string diagnostic name | Resolved by `a100e112` | `notification-resolve.ts:371-375` reads the name as `unknown` and redacts only strings. The regression at `notification-resolve.test.ts:1023-1034` preserves `name: undefined` and `missingPolicy: true`. Additional runtime probes preserve `undefined`, `null`, and numeric names without throwing from production `notify`. |
| WR-08: mismatched test renderer | Resolved by `cb18acb2` | `no-credential-leak.test.ts:699-712` constructs and narrows a `reconcile-applied-cascade` before using `composeReconcileAppliedBody`. That matches production dispatch at `notification-dispatch.ts:316-317`; envelope formatting uses the same production grammar helper. |

The split-key behavior was also exercised through production `notify` for both
plain cascade and reconcile-applied cascade messages. Neither delivered text
nor serialized presentation/payload contained `s3cret`; the wire row name was
`foo@https://***` and its ID was
`foo@https://***@github.com/o/r.git`.
`notification-json.ts:269-274` builds both fields from the resolved names.

The ten removed device-code prompt controls are the intentional main-branch
policy retirement reconciled in `a1f9e4ba`. The production-file credential
scans and device-code allow-list checks remain in
`no-credential-leak.test.ts:252-338, 342-629`. Their removal is not reported
as a regression in this review.

## Validation

Commands ran on Node `v26.10.0`, commit
`bbbd9a1d7d2b5c0e1b54506b4c4ca8db75da2866`. Existing planning changes were
preserved. No source file was changed and no commit or worktree was created.

- **PASS, exit 0:** `node --test --test-reporter=spec` on the present, resolve,
  and redact-credentials owner suites, AUTH-09, catalog-contract, and
  catalog-wire. All six test files passed.
- **PASS, exit 0:** `npm run test:coverage:direct --` with the full production
  paths for `shared/notification-present.ts`,
  `shared/notification-resolve.ts`, and `shared/redact-credentials.ts`.
  Each pair met the command's 100% direct line/function/branch thresholds.
  An initial invocation using shortened paths was rejected by the CLI and was
  corrected; it is not counted as coverage evidence.
- **PASS, exit 0:** independent production-notify and wire probes for the
  split-key leak in both cascade kinds, plus non-string diagnostic names.
- **PASS, exit 0:** catalog comparison against merged-main commit `d7213bc2`.
  The comparison against the older `4e6c568a` base is **not empty**: one prose
  citation changes `D-11` to `D-notification-refactor-01-11`. This exact
  change came from main's `d7213bc2` (#236), outside these gap fixes; no output
  example changes in that diff.
- **INCOMPLETE, exit 1:** `node scripts/notify-corpus.mjs check` stopped before
  corpus comparison because four of its 347 replayed test files failed.
  Isolated reruns with `--test-isolation=none` exposed only sandbox permission
  failures: `spawnSync mkfifo EPERM` in state-fifo-pairing, reinstall-flow, and
  uninstall; `listen EPERM` for the Unix-domain-socket case in marketplace/add.
  These failures were reproduced without corpus instrumentation. The current
  checkout's 3143-entry corpus equality is therefore **not verified here**.
- The full `npm run check` gate was reserved for the parent workflow. This
  review does not replace that gate or reuse the prior session's gate result.

The parent workflow must rerun the corpus check in an environment permitting
the FIFO and socket fixtures, alongside its required combined-tree gate.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_

Gap-loop finding IDs were renumbered to CR-02, WR-07, WR-08, and IN-10
so the disposition ledger preserves the earlier review findings.
