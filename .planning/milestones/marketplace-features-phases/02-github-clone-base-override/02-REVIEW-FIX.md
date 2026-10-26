---
phase: 02-github-clone-base-override
fixed_at: 2026-10-15T00:00:00Z
review_path: .planning/phases/02-github-clone-base-override/02-REVIEW.md
iteration: 2
findings_in_scope: 10
fixed: 4
skipped: 6
status: partial
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-10-15
**Source review:** .planning/phases/02-github-clone-base-override/02-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 10. The orchestrator required CR-01, WR-01, and WR-02. The seven Info findings were triaged: fix only if plainly correct and trivial.
- Fixed: 4 (CR-01, WR-01, WR-02, IN-01). All three required findings are fixed.
- Skipped: 6 (IN-02..IN-07)

Work ran sequentially in the main checkout (`features/cucumber-behavioral-tests`), as the orchestrator directed. No worktree was created. All verification ran in the main checkout and can be reproduced from it. Every test run used a scratch `HOME` and `PI_CODING_AGENT_DIR`, or the suites' own hermetic environment.

## Fixed Issues

### CR-01: `marketplace add` never shows the fetched URL

**Files modified:** `extensions/pi-claude-marketplace/shared/errors.ts`, `extensions/pi-claude-marketplace/platform/git.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `tests/shared/errors.test.ts`, `tests/platform/git.test.ts`, `tests/orchestrators/marketplace/add.test.ts`, `tests/orchestrators/marketplace/add.messaging.test.ts`, `tests/orchestrators/import/execute.test.ts`, `tests/architecture/soft-dep-marker-policy.test.ts`, `README.md`, `README.es.md`
**Commits:** ae44cc91 (code), 12531c91 (README)
**Applied fix:** User ruling: option 1.
- `shared/errors.ts` adds `FetchedUrlCause` (a typed class with a `url` field) and `hasFetchedUrlCause(err)`, which walks the bounded cause chain with `instanceof`. `platform/git.ts` now attaches `new FetchedUrlCause(wireUrl)` in place of a plain `Error`.
- `add.ts` has a new `failedAddRow`. When the chain holds a `FetchedUrlCause`, the standalone row follows the `marketplace update` pattern: a bare `(failed)` header plus one synthetic failed child row that carries the reason and the cause. Otherwise the row is the existing bare `(failed) {<reason>}` row, unchanged (GHB-04). `ADD_CONTEXT` now declares a `failed` row policy.
- Import: `MarketplaceFailureOutcome` gains an optional `causeChain`. It is set only when the add outcome's error holds a `FetchedUrlCause`, and it is redacted like `pushUnexpectedFailure`'s chain. The failed marketplace block threads it onto its synthetic cause row through `failureCause`, which was `unexpectedFailureCause` widened to both outcome kinds.
- **Additional bug found and fixed:** `unwrapAddError` unwrapped one cause level for leak wrappers. Under the override it therefore returned the fetched-URL cause instead of the `HttpError`. Every rewritten clone failure then went unclassified: standalone `marketplace add` rethrew it raw, and orchestrated mode returned `unparseable`. The review's description of the current output (`(failed) {source missing}`) was therefore optimistic. `unwrapAddError` no longer unwraps a `FetchedUrlCause`.
- Tests:
  - add (standalone): asserts the full rendered row. `⊘ anthropics/claude-plugins-official [project] (failed)` / `⊘ … (failed) {source missing}` / `cause: HTTP Error: 404 -> fetched https://mirror.example/git/anthropics/claude-plugins-official.git`.
  - add (orchestrated): asserts the whole outcome (`source missing`, not `unparseable`).
  - import: asserts the whole result and the rendered `cause: HTTP Error: 404 -> fetched https://mirror.example/git/owner/mp.git`.
  - errors: covers `FetchedUrlCause` and `hasFetchedUrlCause`, including a lookalike `Error("fetched …")` that must not match.
  - git: the tests now assert `instanceof FetchedUrlCause` and its `url`.
  - The unset-variable output tests, including `add.test.ts` D-76-09, pass unchanged.
- README: after the fix, the sentence from 636b6467 was still false in two cases. `/claude:plugin bootstrap` keeps its causeless row, which was ruled accepted under SNM-10. A marketplace that `/reload` adds from `claude-plugins.json` renders `mp-add-failed` with a reason and no cause. Both READMEs now name these two exceptions, in the same commit.
**Status:** fixed: requires human verification. The `unwrapAddError` change is a classification-logic change. Tests pin it, but confirm the intended upstream-facing row shape.

### WR-01: Stale "always rethrows" contract comments

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `extensions/pi-claude-marketplace/shared/errors.ts`
**Commit:** 4b28d51e
**Applied fix:** These comments now state the condition: the error fails the whole command, unless the failure left a rollback partial or an MCP config rewrite (AFILE-04). In that case the error becomes the target's failed outcome, whose cause names the variable.
- `installPlugin`, the missing-dependency install, and `setPluginEnabled`.
- In `apply.ts`, the header and the install and toggle loop notes now say that the pass continues past such a target, and that a later target that reads the base ends it. The same applies to the import install catch in `execute.ts`.
- The `apply.ts` add-loop note was left as it was, because `addMarketplace` still rethrows unconditionally.
- `rethrowInvalidGitHubBaseUrl` now says "calls this before it composes a row that would hide the variable".

### WR-02: Nothing pins lazy auth in `info --fetch` and the probes

**Files modified:** `tests/orchestrators/plugin/info.test.ts`, `tests/orchestrators/plugin/install-clone-probe.test.ts`, `tests/orchestrators/plugin/reinstall-clone-probe.test.ts`
**Commit:** a2610a49
**Applied fix:**
- `info.test.ts`: runs `info --fetch` on an installed `{ source: "github", repo, sha }` plugin with a warm `pluginCloneDir(pluginCloneKey(...))`, an invalid base, and a throwing clone. It asserts the full rendered block (`● gplug v1.0.0 (installed)` / `skills: warm-skill`), `cloneCalls: []`, and `fetchCalls: []`.
- Each probe pair test: an invalid base, plus a seam double that returns a warm root without calling `resolveAuth`. The case asserts the whole outcome.
- Mutation-checked: each of the three cases fails when that module builds the bundle eagerly. All three sources were restored afterwards.

### IN-01: Bare `D-08` citation collides

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
**Commit:** 912391fc
**Applied fix:** Both comments now cite `GHB-03` alone. The new CR-01 comments and test titles also cite GHB IDs, not the colliding bare `D-10`.

## Skipped Issues

### IN-02: Assertion shape in the new cases

**File:** `tests/orchestrators/plugin/install-flow.test.ts:11083` and three more files
**Reason:** These are test-restructuring changes across four files: whole-outcome asserts, splitting the two-act enable case into rows, and the probe bundle assert. None is trivial, and the review notes they follow local precedent. Left for a dedicated test pass.
**Original issue:** NFR-5 cases assert only status. The enable case runs two acts. `assert.ok(options.resolveAuth() !== undefined)` is a standalone negative assertion.

### IN-03: Literal gate misses `[.]` / `\x2e`

**File:** `eslint.config.js:132-136`
**Reason:** The review marks it optional. The fix is a gate design choice: normalize the escapes, or document the gap.
**Original issue:** `/github[.]com/` and `/github\x2ecom/` pass the gate.

### IN-04: `withFetchedUrlCause` casts with `as Error`

**File:** `extensions/pi-claude-marketplace/platform/git.ts:373-393`
**Reason:** I tried the guard and rolled it back. A test that rejects the HTTP request with a non-Error showed that isomorphic-git itself assigns `err.caller` on whatever was thrown, and that turns a non-Error into a `TypeError` before `withFetchedUrlCause` sees it. So the `as Error` assumption holds, and the guard would handle a scenario that cannot happen, which no test can discriminate. The other half of the finding is that a cause-bearing error gets no tail. That is deliberate and pinned by "D-10: a rewritten failure keeps a cause it already carries".
**Original issue:** A non-object rejection would make the cause assignment throw, and an error that already has a cause gets no `fetched` tail.

### IN-05: `fetch()` without `remote` pins `origin`

**File:** `extensions/pi-claude-marketplace/platform/git.ts:471-497`
**Reason:** Making `remote` required changes a public port and its fakes and test calls. It is not trivial, and the problem is latent: every production caller passes `"origin"`.
**Original issue:** Under the override, an omitted `remote` pins `origin`, not the branch's tracking remote.

### IN-06: `buildCloneAuth` treats "rewritten" as "override set"

**File:** `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:274`
**Reason:** The fix changes auth behavior for a github.com base. That needs a decision, not a trivial fix.
**Original issue:** With the base set to `https://github.com`, a git-subdir source gets Device Flow while a `github` source gets the stored credential.

### IN-07: CHANGELOG PR number, and the duplicated `problem` union

**File:** `CHANGELOG.md:5`, `extensions/pi-claude-marketplace/shared/errors.ts:433-436`
**Reason:** The PR number does not exist yet. The type alias would have to be exported, because it is used in a public field of an exported class. Fallow would then report it as an unused type export. Unexported, fallow would report a private-type leak. Not trivial.
**Original issue:** The CHANGELOG bullet has no `(#NNN)`, and the `problem` union is written out twice.

## Verification

All checks ran in the main checkout on the final tree (HEAD 912391fc), each with `$?` captured directly:

- `npx fallow dupes`: exit 0
- `npx fallow dead-code`: exit 0
- `npm run lint`: exit 0
- `npm run typecheck`: exit 0
- Direct coverage (`npm run test:coverage:direct -- <source>`, scratch `HOME`/`PI_CODING_AGENT_DIR`), exit 0 for every touched pair: `shared/errors.ts`, `platform/git.ts`, `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/add.messaging.ts`, `orchestrators/import/execute.ts`, `orchestrators/plugin/install-flow.ts`, `orchestrators/plugin/enable-disable.ts`, `orchestrators/reconcile/apply.ts`, `orchestrators/plugin/info.ts`, `orchestrators/plugin/install-clone-probe.ts`, `orchestrators/plugin/reinstall-clone-probe.ts`
- `tests/architecture/soft-dep-marker-policy.test.ts`: 22 pass
- Each commit's pre-commit hook ran `npm run check:commit`, which passed. The hook skipped it for the README-only commit, where no build input was staged.

`npm run check` (the full gate) was not run. It remains for the phase gate.

---

_Fixed: 2026-10-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
