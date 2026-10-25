---
phase: 04-git-source-plugins
review: 04-REVIEW.md
fixed: [WR-01, WR-04, IN-02, IN-03, IN-04]
deferred: [WR-02, WR-03, IN-01]
fix_commit: c20afb40
status: complete
---

# Phase 4: Code Review Fix Report

| ID | Outcome | What changed |
| --- | --- | --- |
| WR-01 | fixed | `shared/git-failure-classifiers.ts` splits `classifyGitHostFailure` (transport ladder + host HTTP status) out of `classifyGitSourceAccessFailure`, which adds only the remote `NotFoundError` arm. Install uses the host ladder, so a `NotFoundError` from a read on a clone already on disk stays unclassified and keeps its cause. Unit cases in `test/shared/git-failure-classifiers.test.ts` and `test/orchestrators/plugin/install.messaging.test.ts`. |
| WR-04 | fixed | The refusal Outline in `features/plugin/git-source.feature` has a third row: 503 -> `network error`, cause `HTTP Error: 503 Service Unavailable, fetched https://{git host}/acme/ghp.git`. |
| IN-02 | fixed | Comments in the classifier header and docs, `handleInstallThrow` (`install-flow.ts`), and `fetch.ts` ("always refreshes") now match the code. |
| IN-03 | fixed (5xx) | A 503 composer unit case (`network error`, cause kept). A pinned commit the remote no longer has still fails with no reason; deferred with WR-02. |
| IN-04 | fixed | CHANGELOG names `{network error}` and says every command's first clone of an unpinned source is now one fetch. No PR number yet (the milestone PR adds it). |
| WR-02 | deferred | A dependency's refused clone in a cascade still has no reason (`handleCascadeThrow`), and shows `{unreadable}` on `/reload`. Outside INS-06 (the plugin the user installs); listed for the user. |
| WR-03 | deferred | `info --fetch` on a cold unpinned source still contacts the host twice (probe called directly and again through `resolveStrict`). `info --fetch` is Phase 10's surface; listed for the user. |
| IN-01 | deferred | When staging cleanup leaks, `appendLeakToError` drops the error `code`, so the reason is lost. Rare (cleanup must fail); listed for the user. |

Also fixed while running `npm run check`: `test/orchestrators/plugin/fetch.test.ts` ("materializes a cold unpinned URL mirror") expected the old refresh after a cold clone, and `test/orchestrators/plugin/install-flow.test.ts` expected an empty reason on `ENETUNREACH`; both now assert the new behavior.
