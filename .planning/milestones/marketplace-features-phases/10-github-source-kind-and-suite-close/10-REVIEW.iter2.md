---
phase: 10-github-source-kind-and-suite-close
reviewed: 2026-10-21T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - .agents/skills/cucumber/rules/features.md
  - .agents/skills/cucumber/rules/steps.md
  - .agents/skills/cucumber/SKILL.md
  - CHANGELOG.md
  - cucumber.json
  - docs/json-output.md
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - features/lib/git-marketplace.ts
  - features/lib/https-git-host/cgi.ts
  - features/lib/https-git-host/server.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/add.feature
  - features/marketplace/github-source.feature
  - features/marketplace/git-source.feature
  - features/marketplace/info.feature
  - features/marketplace/remove.feature
  - features/marketplace/unsupported-source.feature
  - features/marketplace/url-source.feature
  - features/plugin/install.feature
  - features/step_definitions/marketplace/git-host.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/support/pi-process.ts
  - tests/architecture/hermetic-git-environment.test.ts
  - tests/architecture/https-git-host-cgi.test.ts
  - tests/architecture/https-git-host-server.test.ts
  - tests/domain/source.test.ts
  - tests/e2e/_rpc.ts
  - tests/orchestrators/marketplace/update.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Structural Findings (fallow)

The structural pre-pass found nothing: 0 unused exports, 0 unused files, 0 duplicate blocks, and 0 circular dependencies.

## Narrative Findings (AI reviewer)

## Summary

The review covered the diff from `f495d387` to HEAD: the `owner/repo#ref` shorthand parse (D-12), the github `marketplace update` 401 cause line (D-13), the github arms of the published-marketplace fixture, the `stable` branch fixture, the GitHub base override passed to Pi, the git host fixes (EPIPE, decoded-path arms, dropped vs 500 logging, BeforeAll/AfterAll cleanup), and the new and changed feature files.

The targeted unit suites pass when run alone: `tests/domain/source.test.ts`, the three `tests/architecture/https-git-host-*` and hermetic tests (188 pass), and the five new `update.test.ts` cases. No BLOCKER was found. I checked the new github scenarios against plausible wrong implementations. The ref Outline proves the ref by content, the spelling Outline proves the wire path through the request log, and the 401 Outlines compare whole cause chains. Under the override, no scenario reaches github.com or the Device Flow.

The main concerns:
- The new github update cause line also fires when the host rejects a stored credential that was sent. In that case the text "no credential was obtained" is false.
- The GAUTH-04 predicate now has two hand-kept copies.
- The IN-07 fix is incomplete: the run's scratch root still leaks on an early `BeforeAll` failure, and the new comment says it does not.

Recorded decisions D-MF-07 and D-01..D-14, and the carry-overs WINDOWS #100, #101, #102-109, and ROWID-01, are not re-reported.

## Warnings

### WR-01: A github update whose stored credential the host rejects is told no credential was obtained

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:381-411`
**Issue:** `lacksStoredCredential` fires on any `authentication required` classification for a `stored-credential` bundle. Take the case where the helper's `fill` returns a credential and the override host rejects it with 401 or 403. `platform/git-auth-callbacks.ts:227-237` (`onAuthFailure`, stored-credential arm) returns `{ cancel: true }`, isomorphic-git throws `UserCanceledError`, and `classifyGitTransportFailure` maps that to `authentication required`. `refreshGitHubSource` then puts `no credential was obtained for <host>; store one with: ... git credential approve` into the chain. The credential was obtained, and it was sent. The remedy tells the user to store a credential they already have, when the real fix is to replace it. `auth-host.ts:103-123` defines the line for "the helper was consulted and produced no usable credential" only, so this use breaks its own contract. The url arm in `shared.ts:381-392` has the same gap, but this phase extends it to every github update under the override. No scenario covers it: the stored-credential Outline in `git-source.feature` uses the correct password.
**Fix:** Make a fill miss distinct from a rejected credential before attaching the line. For example, have the stored-credential `onAuthFailure` throw a typed `StoredCredentialRejectedError(host)` (or set a flag on the bundle) instead of a bare cancel. Then attach `NO_STORED_CREDENTIAL_CAUSE` only on a miss:

```ts
function lacksStoredCredential(err: unknown, auth: GitAuthBundle): err is Error {
  return (
    err instanceof Error &&
    auth.kind === "stored-credential" &&
    !(err instanceof CrossOriginChallengeError) &&
    !(err instanceof StoredCredentialRejectedError) &&
    classifyGitTransportFailure(err) === "authentication required"
  );
}
```

Add a unit case where `fill` returns a credential and the fetch then fails with `UserCanceledError`. Add a scenario row whose stored password differs from the armed one.

### WR-02: The GAUTH-04 stored-credential predicate is now kept in two places

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:403-411`, `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:381-392`
**Issue:** `lacksStoredCredential` (module-private in `update.ts`) copies the condition inline in `refreshUrlClone`: `instanceof Error`, `auth.kind === "stored-credential"`, not `CrossOriginChallengeError`, and classified `authentication required`. Only the placement differs: the github copy inserts at depth 1, and the url copy attaches the tail only when `cause === undefined`. The PUP-2 github sync in `orchestrators/plugin/update-flow.ts:184` (WINDOWS #101) will need a third copy. A later change to the rule in one copy, such as WR-01's fix or excluding 403, will silently diverge from the others.
**Fix:** Export one helper from `orchestrators/marketplace/shared.ts` next to `refreshUrlClone` and call it from both sites. For example, `attachStoredCredentialCause(err, auth, { position: "before-fetched-url" | "tail" })`, or a shared `lacksStoredCredential` predicate plus the two placement lines.

### WR-03: An early `BeforeAll` failure still leaks the run root, and the new comment says it cannot

**File:** `features/support/pi-process.ts:70-108`, `features/support/pi-process.ts:140`
**Issue:** The IN-07 fix cleans up only when `PiProcess.start` rejects. If `mkdir` of the sandbox fails (line 78), or `HttpsGitHost.start` fails (line 79: openssl missing, `listen` failing), the `mkdtemp` root is left in `tmpdir()`. Once openssl has run, that root holds the host's private key `key.pem`. `piRun` stays `undefined`, so `AfterAll` returns early. Its new comment says "`BeforeAll()` failed, and it cleaned up after itself", which is false for these paths. The cucumber skill counts "a resource no release frees" as a finding. This one happens only on a failed run start, so it is a WARNING here, not a BLOCKER.
**Fix:** Put everything after `mkdtemp` in one guard:

```ts
const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-features-")));
let gitHost: HttpsGitHost | undefined;
try {
  // mkdir sandbox, start gitHost, start pi, assign piRun
} catch (error: unknown) {
  const failures = await settleInOrder([
    async () => gitHost?.close(),
    () => rm(root, { recursive: true, force: true }),
  ]);
  throw failures.length === 0 ? error : new AggregateError([error, ...failures], "the run failed to start");
}
```

### WR-04: The `git-source.feature` description no longer covers what the file protects

**File:** `features/marketplace/git-source.feature:3-5`
**Issue:** The description says "Listing, inspecting, and removing it read only local state". The file now also holds `Updating a git marketplace whose host now needs a credential fails as authentication required` (lines 197-227). That Outline fetches over the network and is the UPD-12 proof. `rules/features.md` requires the description to say what the feature protects. A reader of the description would not expect an update behavior in this file.
**Fix:** Name the update behavior. For example: "A git marketplace is cloned when it is added and fetched when it is updated, with the user's stored credential if the host asks for one, and fails without it. Listing, inspecting, and removing it read only local state."

## Info

### IN-01: The url kind's ref is echoed, never proven by content

**File:** `features/marketplace/info.feature:37-39`, `features/lib/git-marketplace.ts:34`
**Issue:** Each fixture's `stable` branch points at `main`'s commit, so the `@url` info row `#stable` proves only that `info` echoes the parsed ref. The content proof, `github-source.feature`'s ref Outline (`description | Stable tools`), runs for github sources only, and url sources take a separate parse arm (`parseUrlSource`). An implementation that checks the url ref exists but checks out the default branch passes every url scenario. The url `#missing` scenario catches an implementation that ignores the ref entirely.
**Fix:** Add a url row to a ref-by-content scenario, `https://{git host}/acme/tools.git#stable` with `the branch "stable" ... has the description "Stable tools"`, in `url-source.feature` or as an `@url` block.

### IN-02: After a branch diverges, republishing leaves the host half-updated

**File:** `features/lib/git-marketplace.ts:46-49`, `features/lib/git-marketplace.ts:57-69`
**Issue:** Once `pushGitBranch` moves `stable` past `main`, any later `changePublication` runs `git push origin main main:stable`. That push is not atomic. The host's `main` advances, `stable` is rejected, and the step fails with a raw git non-fast-forward error. The doc comments state the limit, but a scenario author who writes a branch `Given` before another publication `Given` gets a confusing failure and a host left half-updated.
**Fix:** Pass `--atomic` to both pushes, and/or have `pushGitRepository` refuse up front with "the branch stable moved away from main; publish branch changes last".

### IN-03: A comment line in `answer()` overruns the line width and breaks mid-sentence

**File:** `features/lib/https-git-host/server.ts:454-456`
**Issue:** The rewrite of this comment left one line of about 120 characters ("...cannot send. Nothing escapes, so no request can crash") followed by a one-line tail. Prettier does not reflow comments.
**Fix:** Reflow the three lines to the 100-column width.

### IN-04: In the `@` arm, the repo half can still contain `#`

**File:** `extensions/pi-claude-marketplace/domain/source.ts:411-433`, `extensions/pi-claude-marketplace/domain/source.ts:467-479`
**Issue:** With `#` now a ref separator, the last-`@` split (D-76-04) still sends a left side that contains `#` or `@` to `parseOwnerRepo`, which accepts it. Measured results: `acme/tools@x#y@z` parses to `repo: "tools@x#y", ref: "z"`, and `acme/tools@a@b` parses to `repo: "tools@a"`. A repo name holding `#` builds a clone URL whose fragment WHATWG parsing drops (`networkCloneUrl` -> `.../tools@x#y.git`). The doc comment also merges the new SRC-03 paragraph and the D-76-04 paragraph with no break. That makes it read as though both arms follow Claude Code 2.1.296's first-separator split, but the `@` arm does not.
**Fix:** In `parseOwnerRepo`, reject `#` and `@` in either half (GitHub owner and repo names cannot contain them). Put a blank line between the SRC-03 and D-76-04 paragraphs.

### IN-05: The CHANGELOG does not mention the empty `#` ref divergence

**File:** `CHANGELOG.md:5-7`
**Issue:** D-MF-07 accepts `owner/repo#` as no ref, where Claude Code refuses it. The entry describes `owner/repo#ref` only. Elsewhere the project names user-visible divergences in the CHANGELOG ("a setting that Claude Code lacks").
**Fix:** Optionally extend the sub-bullet: "An empty `#` adds `owner/repo` with no ref. Claude Code refuses it."

---

_Reviewed: 2026-10-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
