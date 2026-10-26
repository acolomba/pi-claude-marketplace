---
phase: 22-install-failure-reasons
status: all_fixed
fixed: [WR-01, WR-02, WR-03, WR-04, WR-05, IN-01, IN-02, IN-05]
deferred: [IN-03, IN-04]
---

# Phase 22 Review Fix

| ID | Disposition | What changed |
| --- | --- | --- |
| WR-01 | fixed | `classifyGitTransportFailure` and `hostHttpStatus` classify the error behind a cleanup leak too, so `fetch`, `info --fetch`, update preflight and the marketplace paths keep the reason. Unit cases added. |
| WR-02 | fixed | A dependency whose marketplace add failed reads the `InstallMarketplaceAddError`'s own reason on its cascade row, and `classifyOrchestratorThrow` returns that reason on `/reload`. Unit cases added. |
| WR-03 | fixed (message) | `PinnedCommitMissingError` now says "A fresh clone from the git host does not hold the commit <sha>", which is what the clone proves (the ref-hint path fetches no tags, see VERIFICATION "For the user" 8). Fetching a sha no branch or tag reaches, as Claude Code does, is not added (listed for the user). Passing `tags: true` on the recovery fetch needs a `platform/git.ts` change; left as a follow-up. |
| WR-04 | fixed | `withoutCleanupLeaks` walks `causeChain` (depth-capped, self-reference safe). Unit case for the cap. |
| WR-05 | fixed | The new step compares with `assert.strictEqual(..., false)`. |
| IN-01 | fixed | `add.test.ts`'s two MA-14 cases expect `CleanupLeakError`; recorded in the summary. |
| IN-02 | fixed | `clone-cache.ts` header comment names `PinnedCommitMissingError`. |
| IN-03 | deferred | The `import/execute.ts` comment belongs to phase 24's file; listed for the user. |
| IN-04 | deferred | A space-joined range list containing `||` changes meaning; the contradictory-declarations arm already joined this way before this phase. Listed for the user. |
| IN-05 | fixed | Root-keyed member is unreachable for the git arm (a root ledger failure records no subject); the retry pass-through branch is covered by the shared `asPinnedCommitMissing` helper's EACCES case. No extra test needed beyond the new marketplace-add member case. |
