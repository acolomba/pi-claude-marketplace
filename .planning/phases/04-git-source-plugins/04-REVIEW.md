---
phase: 04-git-source-plugins
reviewed: 2026-10-23T09:14:53Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - features/plugin/git-source.feature
  - features/plugin/git-source-update.feature
  - CHANGELOG.md
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-23T09:14:53Z
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Scope: `git diff dc9a0aa1..HEAD`. That covers the two product fixes (D-05 and D-06), their paired unit tests, the two feature files, and the CHANGELOG entry. I traced callers across modules: `handleInstallThrow` / `handleCascadeThrow` in `install-flow.ts`, `install-cascade.messaging.ts`, `reconcile/apply-outcomes.ts`, `import/execute.ts`, `info.ts`, `fetch.ts`, `update-preflight.ts`. I also traced the isomorphic-git `_clone` / `_fetch` / `_checkout` paths in `node_modules`.

Both paired unit files pass when run on their own (`node --test`, 123/123). `info.test.ts --test-name-pattern=MIRR` also passes.

**D-05 (skip refresh after a fresh clone): correct.** I followed isomorphic-git `_clone`. It runs `_fetch` with `ref`/`singleBranch`, then `_checkout(ref || defaultBranch, remote)`. For a branch hint, that leaves HEAD as `ref: refs/heads/<ref>` at the remote tip. For a tag hint, it leaves a detached HEAD at the tag commit. With no hint, HEAD is on the default branch at `origin/HEAD`. `refreshGitHubClone` would have produced the same HEAD in each case: a forced update of `refs/heads/<ref>` to the same sha plus a checkout, or the `NotFoundError` fallback to a detached checkout of the tag. So a `ref`-hinted fresh clone does not leave HEAD at the wrong commit. `readMirrorHeadSha` (reinstall) reads the same loose ref either way. The `raced` and warm arms still refresh, and the unit tests pin both (`fetchCalls.length` 0 / 1). One related gap remains: `info --fetch` still contacts the host twice (WR-03).

**D-06 (classify install runtime throws): the main concern.** `composeInstallFailureMessage` is reached ONLY from `handleInstallThrow`, and only on the standalone path:

- Orchestrated callers (import, reconcile) get `classifyInstallFailure` and never see the new reasons.
- A cascade dependency's failure goes to `handleCascadeThrow` and never sees them either.
- `enable` has its own `enableFailedRow`.

So the new classification does not mislabel failures for those callers. It just does not reach them (WR-02). On the standalone path, the network errno arm and the `HttpError` arm only fire on transport-shaped errors, so a path-source install cannot produce them. The `NotFoundError` arm is different. It cannot tell a remote miss from a local ref read, and it labels a damaged warm mirror as `{source missing}` (WR-01).

No BLOCKER-class finding. In the feature files, every new `Then` compares whole records, because `recordTable` appends the unstated columns. So the auth row's missing `cause chain` column really asserts that there is no cause. The new update scenario's skill check proves both re-pins took effect.

## Warnings

### WR-01: A local isomorphic-git `NotFoundError` from a damaged warm mirror now renders as `{source missing}`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:229` (via `shared/git-failure-classifiers.ts:118-120,148-150`)
**Issue:** `classifyGitSourceAccessFailure` maps every throw with `code === "NotFoundError"` to `source missing`. Its doc comment justifies that as "a ref or object the remote does not have". Install, however, also reaches local isomorphic-git reads on a warm mirror: `refreshGitHubClone` → `fetch` / `resolveRef("refs/remotes/origin/HEAD")` / `checkout`, then `resolveRef({ ref: "HEAD" })` in `materializeOrRefreshPluginMirror`. A damaged mirror dir throws `NotFoundError: Could not find HEAD.` without contacting the host. `test/orchestrators/plugin/clone-cache.test.ts:1222-1249` ("MIRR-02: the default git surface fails locally on an invalid warm mirror") pins exactly this throw. The mirror is refreshed in place, so a refresh interrupted mid-write can produce such a mirror; it is not only manual damage.

Before this change the row was `(failed)` with an empty brace and the cause. Now it says `{source missing}`, which claims the git host lacks the repository. That contradicts the project's rule to fail closed on corrupt local data with `{unreadable}`. The cause line still prints "Could not find HEAD.", so the row's brace and its cause disagree.
**Fix:** Classify `NotFoundError` as `source missing` only when the throw came from the network leg. One option is the `FetchedUrlCause` that `platform/git.ts::withFetchedUrlCause` already attaches to every clone/fetch/listServerRefs failure. Another is to apply the source-access layer only to the clone call in `cloneIntoStaging`. A minimal version at the composer:

```ts
// install.messaging.ts
const gitReason =
  isRemoteNotFoundShape(err) && !hasFetchedUrlCause(err)
    ? undefined // local ref read on a warm mirror: keep the cause-chain fallthrough
    : classifyGitSourceAccessFailure(err);
```

or narrow inside the classifier so `marketplace add` gets the same protection. Add a composer unit case: `NotFoundError` with no network cause → `reasons: []`.

### WR-02: The same git refusal still renders with no reason, or as `{unreadable}`, when it is not the standalone root install, and the CHANGELOG overclaims

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1001-1020,1640-1643`, `install-cascade.messaging.ts:451-461`, `reconcile/apply-outcomes.ts:612-633`, `CHANGELOG.md:5-9`
**Issue:** D-06 put the classification in the standalone composer, not at a shared seam. So the same 404 or dropped connection during the same install operation reports differently depending on who failed:

- **Root plugin, standalone:** `{source missing}` / `{network unreachable}` (new).
- **A git-source dependency** of the requested plugin: its member ledger throws, `unwrapCascade` sets `sink.subject = { kind: "member" }`, `handleCascadeThrow` → `failureFacts` gives `reasons: []`. The row has an empty brace, the old behavior.
- **`/reload` installing a declared git plugin:** `classifyOrchestratorThrow` → `narrowProbeError` gives `{unreadable}` for a 404, an `ECONNRESET`, and a 401.
- **Import:** `dispatchFailedOutcome` → `unexpected-failure` with no reason.

The CHANGELOG line "a failed install says why" and "An install fails as `{source missing}` when the git host answers 404" read as unconditional. No scenario covers the dependency case, so a plausible implementation that fixes only the root row (this one) passes the suite.
**Fix:** At minimum, apply the same ladder in `failureFacts`'s member arm:

```ts
// install-cascade.messaging.ts, member arm
const gitReason = classifyGitSourceAccessFailure(subject.error);
reasons: subject.rollbackPartials.length > 0
  ? ["rollback partial"]
  : gitReason !== undefined ? [gitReason] : [],
```

Then add a dependency-refusal scenario to `git-source.feature`. If reconcile and import stay out of scope, record them as a deferral with a carrier, and narrow the CHANGELOG sub-bullet to "`/claude:plugin install`".

### WR-03: `info --fetch` on a cold unpinned source still contacts the host twice, and its unit test now passes for a different reason

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2177-2186,2509-2539`, `test/orchestrators/plugin/info.test.ts:6239,6291-6297`
**Issue:** Both `info --fetch` row builders call `probe(gitSource)` and then pass the same `probe` to `resolveStrict` as `resolveGitPluginRoot`, which calls it again for the same source. Here is what happens with D-05 in place:

1. The first call clones the cold mirror and, correctly, skips the refresh.
2. The second call finds the mirror warm and refreshes it: a second upload-pack pair right after the clone.

D-05 removed exactly that symptom from install. Before the fix, this path made three pairs; now it makes two.

The test "FTCH-03 / MIRR-02: info --fetch on an UNPINNED not-installed source materializes AND refreshes the mirror" still asserts `fetchCalls.length >= 1`. Its comment reads "Cold mirror: materialized once, then refreshed in place". That holds now only because of the duplicate probe call. The test describes a contract `materializeOrRefreshPluginMirror` no longer has, and it would keep passing if the double contact grew.
**Fix:** Memoize the materializing probe per source inside `makeFetchProbe`, or reuse the first `presence` result for the resolver callback. Then change the test to assert the exact counts and fix its title and comment:

```ts
assert.equal(gitState.cloneCalls.length, 1);
assert.equal(gitState.fetchCalls.length, 0, "a just-cloned mirror is not fetched again");
```

If info parity is out of scope for this phase, at least fix the test title, the comment, and the `>= 1` assertion, which now pass only by accident.

### WR-04: The refusal Scenario Outline has two variants; the suite rule requires three or more

**File:** `features/plugin/git-source.feature:106-136`
**Issue:** `.agents/skills/cucumber/rules/features.md` says: "A `Scenario Outline` is for three or more variants of one behavior". The `An install fails as <reason> when the git host <refusal> ...` Outline has two `Examples:` rows (404, dropped connection). D-03 planned three rows. The auth variant became a separate scenario because its row has no cause columns and needs a different arming step. That split is fine, but it leaves a two-row Outline. `npm run check:features` does not enforce the count, so no gate catches it.
**Fix:** Write the 404 and dropped-connection cases as two plain `Scenario`s. Or add a third variant with the same row shape, e.g. `answers 503` → `network error` with cause `HTTP Error: 503 Service Unavailable, fetched https://{git host}/acme/ghp.git`. The third variant would also cover the `network error` arm the composer comment claims (see IN-03).

## Info

### IN-01: A staging-cleanup leak hides the git classification

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:308-312` → `shared/errors.ts:276-283`
**Issue:** When `cleanupStaging` reports a leak, `appendLeakToError` returns a new `Error` with no `code` and no `data`, and puts the original under `cause`. `classifyGitSourceAccessFailure` reads only the top-level error, so the row loses its `{source missing}` / `{network unreachable}` / `{authentication required}`. In the auth case, the row also gains the cause line that D-79-03 says must not render. `marketplace update` already unwraps one level for this reason (`transportReason`).
**Fix:** In the composer, classify `err` and fall back to `err.cause` when `err` has no code, as `marketplace/update.ts` does.

### IN-02: Comments now contradict the new install behavior

**File:** `shared/git-failure-classifiers.ts:12-13,127-131`, `orchestrators/plugin/install-flow.ts:1562-1563`, `orchestrators/plugin/fetch.ts:341-342`
**Issue:**

- **The classifier header** still says "install's auth-only narrowing" stays a thin wrapper at its call site.
- **The `classifyGitSourceAccessFailure` doc** says the plugin verbs leave a missing ref unclassified. Install is a plugin verb and now uses the source-access layer.
- **The `handleInstallThrow` doc** still lists "Generic runtime error -- reasons: []".
- **`fetch.ts`** says `materializeOrRefreshPluginMirror` "always refreshes", which a cold mirror no longer does.

**Fix:** Update each comment to the new contract. Name D-06 / INS-06 where a decision is cited.

### IN-03: `network error` and `NotFoundError` arms of the new install classification have no composer test

**File:** `test/orchestrators/plugin/install.messaging.test.ts:475-530`
**Issue:** The Branch 4 comment lists four reasons: `source missing`, `network unreachable`, `network error`, `authentication required`. The new unit cases cover a 404 `HttpError` and an `ECONNRESET`. Two cases are missing:

- A 5xx `HttpError` → `network error`, with its cause kept.
- A `NotFoundError` → `source missing`, which is the arm WR-01 questions.

The shared classifier has its own tests, but a composer change that, for example, drops the cause for `network error` would pass this file. Also, a pinned install whose commit the remote no longer has throws `CommitNotFetchedError`, and that stays reason-less. That differs from `marketplace add`'s "object the remote does not have" definition of `source missing`.
**Fix:** Add the two composer cases. Decide explicitly whether `CommitNotFetchedError` maps to `source missing`.

### IN-04: CHANGELOG entry shape

**File:** `CHANGELOG.md:5-9`
**Issue:**

- **PR number:** the top-level bullet has no `(#N)`, which `rules/entries.md` requires as its last token. That is expected before the PR exists, but it is easy to forget.
- **Missing reason:** the sub-bullet lists only `{source missing}` and `{network unreachable}`. A refused clone with any other HTTP status now fails as `{network error}`.
- **Scope of the fix:** the "clones its repository once" line also changed `fetch`, `update`, and `info --fetch` on a cold mirror, not only install.

**Fix:** Add the PR number at PR time. Mention `{network error}`, or rephrase to "fails with the reason `marketplace add` reports".

---

_Reviewed: 2026-10-23T09:14:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
