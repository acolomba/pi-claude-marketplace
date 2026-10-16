---
phase: 02-github-clone-base-override
reviewed: 2026-10-15T00:00:00Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - CHANGELOG.md
  - README.es.md
  - README.md
  - eslint.config.js
  - extensions/pi-claude-marketplace/domain/auth-registry.ts
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/github-base-url.ts
  - tests/domain/clone-key.test.ts
  - tests/domain/source.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/platform/git.test.ts
  - tests/shared/errors.test.ts
  - tests/shared/github-base-url-environment.ts
  - tests/shared/github-base-url.test.ts
  - tests/shared/notification-command-error.test.ts
findings:
  critical: 2
  warning: 4
  info: 5
  total: 11
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-15
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Summary

The core design is sound. The seam (`shared/github-base-url.ts`) validates the value on each call. `platform/git.ts` rewrites only the wire URL and resets `remote.origin.url` to the canonical value after a rewritten clone. `fetch` sends the explicit URL beside the remote name, so tracking refs still update (checked against isomorphic-git `_fetch`). The auth bundle follows the same host. Clone identity, cache keys, and recorded origins stay in github.com terms, as D-01 and D-02 require.

There are two problems that must be fixed before shipping:

1. `/claude:plugin bootstrap` reaches the new typed error through `add.ts`, but its edge handler catches every error and shows a failed row with no cause. So GHB-03 does not hold for that command. It is the one GitHub network command whose edge layer was not updated.
2. The structural pre-pass found a duplicate block in `platform/git.ts` added by this phase. CI's `fallow-audit` job fails on that `warn` verdict, so it blocks the PR.

The warnings cover these problems:

- `rethrowInvalidGitHubBaseUrl` drops rollback-partial facts from the install and enable cascades.
- Three of the four network calls have no test for the D-10 `fetched <url>` cause.
- Warm-cache pinned operations read and validate the variable even though they never use the network.
- The ESLint literal gate can be bypassed with a regex literal or an escaped template.

Known items were not raised again: the README.es drift, the D-08 reconcile abort (T-02-10), and bulk commands that fail without rows for targets already committed (T-02-13).

## Structural Findings (fallow)

| Type | Location | Related | Note |
| --- | --- | --- | --- |
| duplicate_block (INTRODUCED) | `extensions/pi-claude-marketplace/platform/git.ts:520` | `platform/git.ts:608` | `resolveRemoteRef` vs `listRemoteTags` (lines 520-526 / 608-614). `fallow audit --base origin/main` returns `warn`, and the CI `fallow-audit` job fails on `warn`. Raised as CR-02 below. |
| duplicate_block (inherited) | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1700` | -- | Pre-existing. |
| duplicate_block (inherited) | `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2192` | -- | Pre-existing. |
| duplicate_block (inherited) | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:842` | `orchestrators/plugin/uninstall.ts` | Pre-existing. |

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `bootstrap` swallows `InvalidGitHubBaseUrlError` into a causeless failed row (GHB-03 unmet)

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts:70-89` (reached from `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:574`)
**Issue:** `bootstrapClaudePlugin` adds the GitHub source `anthropics/claude-plugins-official` (`orchestrators/plugin/bootstrap.ts:56`). With an invalid variable, `buildGitHubAuth` throws. `handleAddFailure` then rethrows the typed error (`add.ts:574`), and `bootstrapClaudePlugin` rethrows every non-duplicate error (`bootstrap.ts:120-128`). After that, the edge handler's bare `catch {` (`edge/handlers/plugin/bootstrap.ts:70`) discards it and shows `claude-plugins-official [user] (failed)`. That row is marketplace-level, so it carries no cause (SNM-10). The user never sees the variable named, which breaks GHB-03 ("fails with a typed error that names the variable") and D-08 ("fails the whole command"). Phase research (02-RESEARCH.md row 1) lists `bootstrap` as a consumer of add, but no test runs bootstrap with the variable set. The same catch also hides the D-10 `fetched <url>` cause when a valid override points at a mirror without the repository. In that case the user gets an opaque `(failed)` with no hint that the base is wrong.
**Fix:** Rethrow the typed error before the row is rendered, as the enable/disable edge handler already does, and add a test to `tests/edge/handlers/plugin/bootstrap.test.ts`:
```ts
} catch (err) {
  rethrowInvalidGitHubBaseUrl(err);
  notify(ctx, run, { marketplaces: [ /* existing failed row */ ] });
}
```

### CR-02: Introduced duplicate block in `platform/git.ts` fails the CI fallow-audit gate

**File:** `extensions/pi-claude-marketplace/platform/git.ts:520-526` and `:608-614`
**Issue:** `resolveRemoteRef` and `listRemoteTags` both now open with the same sequence: `const wireUrl = gitHubWireUrl(opts.url); const refs = await withFetchedUrlCause(wireUrl, opts.url, () => git.listServerRefs({ http, url: wireUrl, protocolVersion: 2, ...`. Fallow reports it as a clone group introduced by this phase. `lint.yml`'s `fallow-audit` job fails on a `warn` verdict, so this blocks the PR even though local `npm run check` (full `fallow dupes`, threshold-based) passed.
**Fix:** Move the shared prefix into one helper so each caller passes only its distinct options:
```ts
async function listServerRefsAt(
  opts: { readonly url: string; readonly auth?: GitAuthBundle },
  extra: { readonly symrefs?: true; readonly prefix?: string },
): Promise<{ wireUrl: string; refs: git.ServerRef[] }> {
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  const wireUrl = gitHubWireUrl(opts.url);
  const refs = await withFetchedUrlCause(wireUrl, opts.url, () =>
    git.listServerRefs({
      http, url: wireUrl, protocolVersion: 2, peelTags: true, ...extra,
      ...(authCbs !== undefined && {
        onAuth: authCbs.onAuth,
        onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
      }),
    }),
  );
  return { wireUrl, refs };
}
```
Then run `fallow audit --base origin/main` and confirm the verdict is `pass`.

## Warnings

### WR-01: Rethrowing the bare typed error discards cascade rollback partials

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1968` (with `unwrapCascade` at `:727-739`); `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:2756`, `:2976`
**Issue:** `rethrowInvalidGitHubBaseUrl` throws the chain link it found, not the head error, and it runs before any failure handling. Consider an install cascade whose first member is a url-source or path-source dependency (no GitHub read, so it commits) and whose later member is a GitHub source. The later member throws the typed error, `runPhases` runs the earlier member's undo, and an undo that does not finish is recorded in `cascade.rollbackPartials`. `unwrapCascade` copies those into `capture.rollbackPartials` and throws `cascade.error`. The catch at `:1968` then rethrows the bare `InvalidGitHubBaseUrlError`. The partials, the `rollback partial` reason, and the AFILE-04 MCP notices (`cascadeFailure.mcpConfigNotices`) are all lost. State is not saved, so the artifacts that were not unstaged stay on disk with no record and no notice. `enableFailedRow` (`:2976`) does the same: it rethrows before it reads `outcome.rollbackPartials` (`:2977`). That breaks the "rollback failures are surfaced, never swallowed" contract (ARCHITECTURE "Error Propagation & Rollback").
**Fix:** Rethrow only when nothing was left behind. Otherwise fall through to the normal failure row. Its cause chain already renders the variable-naming message, so GHB-03 still shows:
```ts
} catch (err) {
  if (capture.rollbackPartials.length === 0) {
    rethrowInvalidGitHubBaseUrl(err);
  }
  ...
```
In `enableFailedRow` and `outcomeToTypedResult`, guard on `(outcome.rollbackPartials ?? []).length === 0` the same way. Add a cascade test that injects an undo failure under an invalid base.

### WR-02: D-10 `fetched <url>` cause is tested only for `fetch`; three of four call sites are unpinned

**File:** `tests/platform/git.test.ts:1001-1023` (clone), `:1297-1324` (resolveRemoteRef), `:2089-2106` (listRemoteTags); production `extensions/pi-claude-marketplace/platform/git.ts:411`, `:522`, `:610`
**Issue:** The only assertion on the `fetched ${REMOTE_URL}` cause is the `fetch` case (`git.test.ts:1172`). The clone test "D-10: a rewritten failure keeps a cause it already carries" checks only that an existing cause is kept. It would still pass if `clone` called `git.clone` without `withFetchedUrlCause`. Nothing tests a failing `resolveRemoteRef` or `listRemoteTags` under the override. Direct coverage stays at 100% because the helper is shared, so the gate does not catch it. Plausible wrong code passes: removing the wrapper from any of those three functions loses the D-03/D-10 diagnostic for clones (install, add) and tag probes, and no test fails.
**Fix:** Add one case per function. Use `installFailedDiscoveryTransport` with `setGitHubBaseUrl(t, \`https://${HOST}\`)` and a `GITHUB_REMOTE_URL` input, then assert `error.cause.message === \`fetched ${REMOTE_URL}\`` and that the code-bearing error stays at depth 0, as the fetch case does.

### WR-03: Warm-cache pinned install/reinstall now fails on an invalid variable without touching the network

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts:59`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts:67` (via `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:274-275`)
**Issue:** `buildCloneAuth` is called before `materializePluginClone`, and for a `github` source it now calls `gitHubOverrideHost()`, which validates the variable. For a sha-pinned plugin whose `plugin-clones/<key>/` already exists, `materializePluginClone` returns at `clone-cache.ts:212` without a network call (NFR-5 "warm sha-pinned cache operations stay offline"). Even so, an invalid value now fails `install`/`reinstall` (and a `/reload` reconcile that installs from the warm cache). This contradicts 02-CONTEXT "Which commands read the variable: only paths that reach the network for a GitHub source." It also reverses the offline-tolerance property: a typo in a variable the user set for a mirror breaks operations that never contact the mirror. `git.ts` already reads the variable lazily, at the wire, so only the eager auth construction causes this.
**Fix:** Build the bundle lazily. Pass `() => buildCloneAuth(...)` into `materializePluginClone`/`materializeOrRefreshPluginMirror` and resolve it only on the cold path, before `cloneIntoStaging` or `refreshGitHubClone`. Or document the stricter behavior as an accepted decision in 02-CONTEXT and the README. Add a warm-cache install test under an invalid base that pins whichever behavior is chosen.

### WR-04: The `local/no-github-literal` gate misses regex literals and escaped template text

**File:** `eslint.config.js:129-140`
**Issue:** The `Literal` visitor checks only `typeof node.value === "string"`. A regex literal such as `/^https:\/\/github\.com\//` has a `RegExp` value and passes silently. A host-matching regex is exactly the kind of "parser host comparison" D-06 means to force through a justified waiver. The `TemplateElement` visitor tests `value.raw`, so `` `https://github\x2ecom/${o}` `` (raw text `github\x2ecom`) also passes. A gate that is expected to be sound gives a false green on both forms.
**Fix:**
```js
Literal(node) {
  const text = typeof node.value === "string" ? node.value : node.regex?.pattern;
  if (text !== undefined && GITHUB_LITERAL.test(text.replaceAll("\\.", "."))) {
    context.report({ node, messageId: "found" });
  }
},
TemplateElement(node) {
  if (GITHUB_LITERAL.test(node.value.cooked ?? node.value.raw)) {
    context.report({ node, messageId: "found" });
  }
},
```
Plant both forms by hand once (no committed negative control, per CONVENTIONS).

## Info

### IN-01: `withFetchedUrlCause` relies on an unchecked `as Error` cast

**File:** `extensions/pi-claude-marketplace/platform/git.ts:384-391`
**Issue:** The code assumes every rejection is an `Error`. If a rejection is a primitive (for example, a string), `failure.cause = ...` throws a `TypeError` in ESM strict mode, and that `TypeError` replaces the real failure. If the value is `null`, reading `.cause` throws. Separately, a failure that already has a cause gets no `fetched` tail, so D-10's diagnostic is missing for that class of error.
**Fix:** Guard with `if (error instanceof Error && error.cause === undefined) { error.cause = ... }` and rethrow `error` unchanged otherwise. You could also append the tail at the end of an existing chain.

### IN-02: Under the override, `fetch()` with `remote` omitted fetches `origin` instead of the branch's tracking remote

**File:** `extensions/pi-claude-marketplace/platform/git.ts:443-459`
**Issue:** With `opts.remote` undefined, isomorphic-git chooses `branch.<ref>.remote || "origin"`. The new code reads `remote.origin.url` and, when the URL is rewritten, passes `remote: "origin"` explicitly. Unset and set then fetch different remotes for a branch that tracks a non-origin remote. Every production caller passes `remote: "origin"` (`clone-cache.ts:153`, `marketplace/shared.ts:261`), so this is latent only.
**Fix:** Make `remote` required in `FetchOptions`, or resolve `branch.<ref>.remote` the way isomorphic-git does before reading its URL.

### IN-03: `buildCloneAuth` uses "URL was rewritten" as a proxy for "override is set"

**File:** `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:274`
**Issue:** With a base of `https://github.com` (or `https://github.com/`), `gitHubWireUrl(cloneUrl) === cloneUrl`. A github.com git-subdir source then gets `buildAuthForHost(github.com)`, which includes Device Flow, while a `github` source gets the stored-credential-only bundle from `buildGitHubAuth`. The behavior differs between kinds for the same configuration, and the D-04 test (`auth-host.test.ts`, "starts no Device Flow for a https://github.com/mirror base") does not cover the no-path case.
**Fix:** Branch on `kind === "github" || (cloneUrl.startsWith(\`${GITHUB_ORIGIN}/\`) && gitHubOverrideHost() !== undefined)`.

### IN-04: README says command output always stays in github.com terms; failures under the override name the wire URL

**File:** `README.md:226`, `README.es.md:224`
**Issue:** "`list`, `info`, `claude-plugins.json`, and command output keep showing `https://github.com/...` URLs." Under the override, failure output names the mirror on purpose: the `fetched <wire url>` cause (D-10) and `remote <wireUrl> advertised no HEAD ref` / `has no ref` (`git.ts:539`, `:550`). The README does not mention the D-03 diagnostic that shows a wrong base.
**Fix:** Say that results and listings stay in github.com terms, and that a failed fetch names the URL actually fetched. Update both copies (readme skill sync rule).

### IN-05: CHANGELOG bullet lacks the PR token; error `problem` union is written out twice

**File:** `CHANGELOG.md:5`; `extensions/pi-claude-marketplace/shared/errors.ts:433-436`
**Issue:** `.agents/skills/changelog/rules/entries.md` requires each top-level bullet to end with `(#NNN)`. The new bullet has none, so add it when the PR exists. Separately, the `problem` literal union appears twice and can drift from the keys of `INVALID_GITHUB_BASE_URL_RULES`.
**Fix:** Add the PR number at PR time. Declare `type InvalidGitHubBaseUrlProblem = keyof typeof INVALID_GITHUB_BASE_URL_RULES;` and use it in both positions.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
