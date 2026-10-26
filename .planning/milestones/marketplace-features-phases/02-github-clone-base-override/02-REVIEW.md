---
phase: 02-github-clone-base-override
reviewed: 2026-10-16T03:55:52Z
iteration: 3
depth: standard
files_reviewed: 53
files_reviewed_list:
  - CHANGELOG.md
  - README.es.md
  - README.md
  - eslint.config.js
  - extensions/pi-claude-marketplace/domain/auth-registry.ts
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/github-base-url.ts
  - tests/architecture/soft-dep-marker-policy.test.ts
  - tests/domain/clone-key.test.ts
  - tests/domain/source.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.messaging.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/clone-cache.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-clone-probe.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/platform/git.test.ts
  - tests/shared/errors.test.ts
  - tests/shared/github-base-url-environment.ts
  - tests/shared/github-base-url.test.ts
  - tests/shared/notification-command-error.test.ts
findings:
  critical: 1
  warning: 1
  info: 2
  total: 4
status: issues_found
---

# Phase 2: Code Review Report (re-review after fix iteration 2, final)

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 53
**Status:** issues_found

## Summary

This review checks the fixes in ae44cc91..912391fc (`git diff 0fe175f9..912391fc`) against the code at 912391fc. The scope is the 50 files from iteration 2, plus the three files that the fixes touched for the first time: `add.messaging.ts`, `add.messaging.test.ts`, and `soft-dep-marker-policy.test.ts`. To trace the callers, I also read `reconcile/notify.ts`, `reconcile/apply-outcomes.ts`, `plugin/install-cascade.messaging.ts`, `marketplace/shared.ts`, `shared/redact-absolute-paths.ts`, `shared/fs-utils.ts`, and `docs/output-catalog.md`.

The code fixes hold:

- **CR-01 code (option 1).** `FetchedUrlCause` is a typed class. `hasFetchedUrlCause` uses only `instanceof` over the bounded `causeChain` walk. A lookalike `Error("fetched …")` does not match, and a test pins that. `platform/git.ts` attaches the class only on a rewritten call. With the variable unset, nothing creates a `FetchedUrlCause`, so `failedAddRow`, `unwrapAddError`, and `fetchedUrlCauseChain` all take their old branch. The standalone row, the import row (`failureCause` → `new Error(o.cause)`), and the reconcile row are byte-identical to before.
- **The `unwrapAddError` change.** I traced every error shape that reaches `classifyAddError`, with the variable set and unset:

  | Shape | Unset | Set (after fix) |
  |---|---|---|
  | Raw `HttpError` or errno from the clone | classified at depth 0 | carries `FetchedUrlCause`, so it is not unwrapped and is classified at depth 0 (before the fix it unwrapped to the cause and was unclassified) |
  | `appendLeakToError` wrapper (staging cleanup leaked) | unwrap → `HttpError` | unwrap → `HttpError` (the wrapper's cause is the `HttpError`, not the `FetchedUrlCause`), so classified |
  | Error with a pre-existing cause (D-10 adds no tail) | unwrap → that cause | same as unset |
  | `InvalidGitHubBaseUrlError`, raw or leak-wrapped | unclassified → rethrown in both modes | same |
  | Typed preconditions (duplicate, stale, unreadable, manifest, unsupported) | returned directly | same |

  The callers behave as follows. Standalone `marketplace add` now renders a classified row and no longer rethrows raw. Import and reconcile get the real reason (for example `source missing`) and no longer get `unparseable`. Bootstrap passes `rethrowPreconditionErrors: true` and never reaches `handleAddFailure`, so the change does not affect it. `addSubjectName` and `removalAdvisories` use the same unwrap, and both remain correct.
- **Standalone row shape.** The row is a bare `(failed)` header, plus one failed child named after the subject, with the reason and `cause: error`. That is the shape `marketplace/update.ts::refreshOneMarketplace` renders (SNM-10). `ADD_CONTEXT.rowPolicies.failed` is `{ markers: false, contentReasons: true }`, which is the same as `UPDATE_CONTEXT` and the autoupdate contexts. The "Some operations have failed." summary matches update's.
- **Redaction.** The base URL rejects userinfo, so the wire URL carries no credential. The rendered causes also pass through `redactCredentials`. In import, `redactCauseChain` keeps the URL intact, and the import test asserts the rendered line. `hasFetchedUrlCause` runs before the redaction rebuilds the links, so the check does not lose the class identity.
- **WR-01 (comments).** Every listed comment now states the AFILE-04 condition. The `apply.ts` add-loop note was rightly left unchanged, because `addMarketplace` still rethrows without a condition.
- **WR-02 (lazy auth).** The new `info --fetch` and probe cases set an invalid base over a warm pinned clone. With eager construction, `buildCloneAuth` would read the base and throw, so each case would fail.
- **README sync.** The changed passage says the same thing in both copies.
- **Gates re-run here (scratch `HOME`/`PI_CODING_AGENT_DIR`).** The touched test files all pass: add, add.messaging, errors, import/execute, both probes, git, info, reconcile/apply, and soft-dep-marker-policy (353/353 for the last three). `npx fallow audit --base origin/main` returned `verdict: pass`, with no introduced dead code, complexity, or duplication.

Remaining problems: the README sentence that the fix narrowed is still false, because it leaves out the most common `/reload` case (CR-01). The output catalog still says that `marketplace add` has no child rows (WR-01).

Not raised again, per the earlier rulings: the WR-01 exception shape, the eager update-preflight auth, bootstrap's causeless row (SNM-10), README.es.md pre-existing drift, T-02-10, and T-02-13. The skipped Info items from iteration 2 (IN-02..IN-07) are unchanged by these fixes and are not repeated here.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The README's "two exceptions" list is incomplete, so the sentence is still false: `/reload` plugin installs and enables never show the fetched URL

**File:** `README.md:226`, `README.es.md:224`; behavior at `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:684-704`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:845-862` and `:984-997`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:273-276`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:427-438`

**Issue:** 12531c91 changed the sentence to: "When a fetch fails, the error names the URL that the command actually fetched … There are two exceptions: `/claude:plugin bootstrap`, and a marketplace that `/reload` adds from `claude-plugins.json`. Their errors show only the reason." The list leaves out the plugin rows of the same `/reload` pass:

- `applyPluginInstalls` builds a `plugin-install-failed` outcome. It attaches `cause` only when `result.error instanceof DependencyCascadeError` (apply.ts:699-701). `failedRowCause` (notify.ts:845-862) also renders a cause only for refused uninstalls and that one install shape. A root plugin whose own GitHub clone fails under the override reaches the row unwrapped, because `memberCause` returns `subject.error` when `subject.key === rootKey`. That row renders `⊘ p (failed) {source missing}` with no cause line and no URL.
- `PluginEnableFailedOutcome` has no `cause` field at all (apply-outcomes.ts:273-276). So an enable during `/reload` that has to re-clone shows only the reason. The reload-only missing-dependency install (`applyDependencyInstalls`) uses the same failure arm as `applyPluginInstalls`.
- By contrast, a dependency's failure under `/reload` does show the URL. `memberCause` wraps the failure in `DependencyCascadeError` and keeps `subject.error.cause`, which is the `FetchedUrlCause`. A blanket "`/reload` shows only the reason" would therefore also be wrong.

This is the main path where the base value changes after setup. D-03 says "a value changed after `add` takes effect on the next fetch", and the next fetch for a declared plugin is usually `/reload`. So a user who changes the base to a wrong value and reloads sees `{source missing}` with no URL, which is the failure D-03 exists to prevent. The README tells that user the opposite. The iteration-2 review blocked on this same kind of defect: a user-facing claim that the code does not meet. No test renders a reconcile plugin row under the override, which is how the omission was missed.

The sentence is also inaccurate about bootstrap. Bootstrap's row is `⊘ claude-plugins-official [user] (failed)` with no reason brace (`edge/handlers/plugin/bootstrap.ts:84-94`), so "their errors show only the reason" is not true there either.

**Fix:** The user's option-1 ruling limits the behavior change to add and import, so narrow the docs. Change both READMEs in the same commit (the README skill's translation rule), for example:

```text
… so a wrong value is easy to see. There are exceptions. `/claude:plugin bootstrap`
shows a bare failed row. When `/reload` adds a marketplace or installs or enables a
plugin from `claude-plugins.json`, the row shows only the reason. A dependency that
`/reload` installs still names the URL.
```

The other option needs a decision: carry the cause onto the reconcile rows only when the URL was rewritten, which keeps unset output byte-identical. In `apply.ts`, add `...(hasFetchedUrlCause(result.error) && { cause: redactCauseChain(result.error) })` beside the `DependencyCascadeError` arm. Widen `failedRowCause`, add the optional `cause` to `PluginEnableFailedOutcome`, and add one reconcile test that asserts the rendered `fetched` line. If you choose this, record it in 02-CONTEXT as an extension of the option-1 ruling.

## Warnings

### WR-01: `docs/output-catalog.md` still says `marketplace add` never renders a child row, and it has no state for the new override shape

**File:** `docs/output-catalog.md:2312` (section intro), `:2340-2351` ("Failure -- unreachable source" state and its note); code at `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:551-587`

**Issue:** The catalog is the project's output contract. It says: "Single-marketplace command. The marketplace header alone is the body -- no plugin children." Its note under "Failure -- unreachable source" also says that a cause can only be surfaced through a per-plugin failed row, which `marketplace add` does not build. After ae44cc91 both statements are false whenever the override rewrote the URL: the add renders a bare `(failed)` header plus a failed child that carries the reason and the `cause: … -> fetched <url>` line. The fix updated `add.messaging.ts`'s header comment and the policy-table test for the new `failed` policy, but did not update the catalog. A later change that trusts the catalog's "no plugin children" rule could remove the child row, and the catalog would back that change.

**Fix:** Qualify the intro sentence ("…no plugin children, except under the GitHub base override, GHB-01"). Add a catalog state, for example `<!-- catalog-state: add-github-base-override -->`, with the exact bytes that `add.test.ts` pins:

```text
Some operations have failed.

⊘ anthropics/claude-plugins-official [project] (failed)
  ⊘ anthropics/claude-plugins-official (failed) {source missing}
    cause: HTTP Error: 404 -> fetched https://mirror.example/git/anthropics/claude-plugins-official.git
```

The text should say that the shape mirrors the `marketplace update` failed refresh (SNM-10), and that unset output keeps the bare row (GHB-04).

## Info

### IN-01: Under the override, a clone failure whose staging cleanup also leaked repeats the head message and shows an unredacted absolute path

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:576-586` (child `cause: error`), `:913-917` (clone catch), `extensions/pi-claude-marketplace/shared/fs-utils.ts:124`

**Issue:** If `cleanupStaging` fails after a rewritten clone failure, `appendLeakToError` builds `Error("HTTP Error: 404 (additionally: failed to clean up marketplace clone staging at /home/u/.pi/agent/pi-claude-marketplace/sources-staging/<uuid>: …)", { cause: HttpError })`. `hasFetchedUrlCause` is true, so the child row's cause trailer renders `HTTP Error: 404 (additionally: … /home/u/…/<uuid>: …) -> HTTP Error: 404 -> fetched <url>`. The head appears twice, and the full staging path is printed. The same command reduces every absolute path to its last segment in its MA-14 leak advisory (NFR-9, `notification-summary.ts:433`). With the variable unset, this leak is not shown at all. No test covers this shape under the override. It is rare: the clone and the cleanup must both fail.

**Fix:** Pass `redactCauseChain(error) ?? error` as the child's `cause`, the same redaction that import applies. Alternatively, record that the leak path is accepted on the standalone row.

### IN-02: A `handleAddFailure` comment still describes only the `(failed) {<reason>}` header

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:637-639`

**Issue:** The comment "The `(failed) {<reason>}` header renders via the central renderMpHeader seam" sits right above `failedAddRow`. Under the override, that function now builds a bare `(failed)` header and moves the reason onto the child row.

**Fix:** Change it to "…renders the `(failed) {<reason>}` header, or the bare header plus a failed child under the GitHub base override (see `failedAddRow`)."

---

_Reviewed: 2026-10-16T03:55:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3_
