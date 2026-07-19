---
status: resolved
trigger: "Bulk plugin fetch on claude-plugins-official rendered `⊘ 42crunch-api-security-testing (failed) {source missing}` with cause: Failed to checkout \"30287f5e3f122a646d1ac5ca3ab96e130c52a3ad\" because commit 30287f5e3f122a646d1ac5ca3ab96e130c52a3ad is not available locally."
created: 2026-07-18T17:58:13Z
updated: 2026-07-18T18:37:45Z
---

## Symptoms

expected: |
  Fetch/install of a sha-pinned git plugin materializes the pinned sha's content
  regardless of the manifest `ref` hint. Reference behavior verified empirically
  2026-07-18: `claude plugin install 42crunch-api-security-testing@claude-plugins-official`
  installs version 1.15.0 and records gitCommitSha 30287f5e — sha wins, ref ignored.
actual: |
  Our fetch renders `(failed) {source missing}`; install/update/reinstall would fail
  identically (same clone-cache seam). Parity gap with Claude Code.
errors: |
  CommitNotFetchedError: Failed to checkout "30287f5e3f122a646d1ac5ca3ab96e130c52a3ad"
  because commit 30287f5e3f122a646d1ac5ca3ab96e130c52a3ad is not available locally.
  Do a git fetch to make the branch available locally.
timeline: |
  First occurrence 2026-07-18 (user report). Code unchanged since fetch verb landed
  (fetch.ts single commit 53f39047; clone-cache pinned arm stable since 5e0da535).
  Trigger is new DATA: 42crunch is the only claude-plugins-official entry with a
  tag-style ref, and upstream recently moved its sha ahead of the stale tag.
reproduction: |
  materializePluginClone({ cloneUrl: "https://github.com/42Crunch-AI/claude-plugins.git",
  pin: "30287f5e3f122a646d1ac5ca3ab96e130c52a3ad", ref: "v1.5.5" }) throws the exact
  error (live repro 2026-07-18, scripts in session scratchpad:
  /tmp/claude-1000/-home-acolomba-pi-claude-marketplace/3773a38e-8cf3-4b8c-b68d-26c09147310e/scratchpad/).
  Hermetic shape: any fixture repo where the pinned sha is NOT in the ref-hint's history.

## Current Focus

hypothesis: |
  CONFIRMED ROOT CAUSE: materializePluginClone (extensions/pi-claude-marketplace/
  orchestrators/plugin/clone-cache.ts:83-89) clones with the ref hint
  (`clone({ ref, singleBranch: true })`) then `checkout(pin)`. The singleBranch fetch
  brings only closure(ref); when the manifest sha is outside the ref's history the
  checkout target objects were never fetched -> isomorphic-git CommitNotFetchedError ->
  classifyFetchFailure folds to `{source missing}`. Manifest data: claude-plugins-official
  pins 42crunch at { ref: "v1.5.5", sha: "30287f5e" }; tag v1.5.5 = faf53053 (v1.5.5
  content), sha 30287f5e = main tip (v1.15.0 content); tag IS ancestor of sha, sha NOT
  in tag closure. Upstream keeps sha current but left ref stale.
test: |
  Re-run the live repro (materializePluginClone with pin=30287f5e, ref=v1.5.5) OR build
  the hermetic fixture (repo with tag ref whose closure excludes the pinned sha) and
  assert CommitNotFetchedError pre-fix / success post-fix.
expecting: |
  Pre-fix: CommitNotFetchedError quoting the pin sha. Post-fix: clone materializes at
  the pin; url/github/path sources and consistent ref+sha entries byte-unchanged.
next_action: |
  NONE — RESOLVED. Human verification passed 2026-07-18 (user restarted Pi, re-ran the
  live test against the fresh claude-plugins-official manifest; 42crunch now materializes).
  Fix committed as 15b7a1c2 (fix(clone-cache): recover pinned checkout outside ref-hint
  history). Session archived to resolved/.

## Evidence

- timestamp: 2026-07-18T17:20:00Z
  checked: "User-scope manifest (stale, May 12): 42crunch entry { ref: v1.0.1, sha: 56273e0e }; upstream manifest TODAY: { ref: v1.5.5, sha: 30287f5e }"
  found: "Error sha 30287f5e == upstream manifest sha == main tip; NOT the stale local pin"
  means: "Failing run used a freshly-cloned marketplace manifest (today's upstream)"
- timestamp: 2026-07-18T17:30:00Z
  checked: "git ls-remote 42Crunch-AI/claude-plugins: refs/tags/v1.5.5 = faf53053 (lightweight, no ^{} peel); refs/heads/main = 30287f5e; merge-base checks in full clone"
  found: "sha NOT in tag closure; tag IS ancestor of sha (main moved ahead); v1.5.5 content = plugin version 1.5.5, sha content = version 1.15.0 (plugin renamed to 42crunch-api-security-testing there)"
  means: "Upstream manifest is internally inconsistent: sha field current, ref field stale"
- timestamp: 2026-07-18T17:40:00Z
  checked: "Live repro of every current-code arm against the real repo (real seam imports): pinned arm with the OLD consistent pin (56273e0e/v1.0.1) OK; mirror arms OK cold; pinned arm with TODAY's values (30287f5e/v1.5.5) THROWS"
  found: "CommitNotFetchedError reproduced byte-for-byte only with pin outside ref closure"
  means: "Root cause is the singleBranch ref-hint narrowing, not parse, not pin precedence, not warm state"
- timestamp: 2026-07-18T17:55:00Z
  checked: "Reference behavior: claude plugin install 42crunch-api-security-testing@claude-plugins-official on this machine"
  found: "Installed version 1.15.0 snapshot; installed_plugins.json records gitCommitSha 30287f5e; ref ignored"
  means: "Parity requires the sha to be materializable regardless of ref reachability"

## Eliminated

- hypothesis: "Annotated-tag ref clone + peeled-sha checkout is broken in isomorphic-git"
  evidence: "clone(ref v1.0.1, singleBranch) + checkout(56273e0e peeled) succeeds against the live repo"
- hypothesis: "parsePluginSource drops sha/ref for git-subdir object sources"
  evidence: "Parse of the real manifest entry preserves both (withOptionalSourceFields)"
- hypothesis: "Stale warm mirror / detached-HEAD refresh path caused the failure"
  evidence: "No plugin-clones dir exists in any scope root; cold mirror arms reproduce clean; refreshGitHubClone(no-ref) self-heals via wildcard-refspec fetch"

## Notes

- SECONDARY LATENT FINDING (do NOT fix in this session unless trivial; record for follow-up):
  materializeOrRefreshPluginMirror on a tag ref leaves HEAD detached at the UNPEELED tag
  object (observed: 2f45fdb8, a tag object, as HEAD after the v1.0.1 mirror repro), so
  its resolvedSha can be a tag-object sha rather than a commit sha.
- Repo guards for the fix: pre-existing unstaged root-.planning deletions in the working
  tree — stage explicit literal paths only, NEVER git add -A/. ; plain git commits with
  pre-commit hooks run first (pre-commit run --files ...), no --no-verify, no gsd-tools
  commit verbs; Conventional Commits (title 5-72 chars, body lines <=80); comment policy
  .claude/rules/typescript-comments.md — requirement/decision IDs only (PURL-02, PURL-04,
  NFR-3, NFR-5, D-77-05, MA-9), no phase/plan/wave tokens in code or test titles.

## Resolution

root_cause: |
  materializePluginClone (orchestrators/plugin/clone-cache.ts) cloned with the ref
  hint (clone({ ref, singleBranch: true })) then checkout(pin). The singleBranch fetch
  brings only closure(ref); when the manifest sha is OUTSIDE the ref's history the
  pinned commit's objects were never fetched, so isomorphic-git's checkout throws
  CommitNotFetchedError, which classifyFetchFailure folds to `{source missing}`.
  Manifest data: claude-plugins-official pins 42crunch at { ref: v1.5.5, sha: 30287f5e };
  tag v1.5.5 (faf53053) IS an ancestor of the sha but the sha (main tip, v1.15.0) is NOT
  in the tag's closure. Upstream keeps the sha current but left the ref stale.
fix: |
  In materializePluginClone, wrap the post-clone checkout(pin) in an inner try/catch.
  On a CommitNotFetchedError-class failure (name-check predicate isGitCommitNotFetchedError,
  D-13 boundary; mirrors shared.ts::isGitNotFoundError) AND when a ref hint was given, run
  ONE full fetch on the staging clone (gitOps.fetch({ dir, remote: "origin" }), no ref) and
  retry checkout(pin) once. isomorphic-git's clone always writes the wildcard fetch refspec
  (+refs/heads/*:refs/remotes/origin/*) via _addRemote regardless of singleBranch, so a
  no-ref fetch wants every head and pulls the pin's commit into the object store; the retry
  then resolves it. auth threads into the recovery fetch (PROV-03). A no-ref clone already
  fetched every head, so its CommitNotFetchedError is a genuinely unreachable sha and is
  rethrown immediately (no wasted fetch). A still-unreachable sha throws the same class on
  the retry and falls through the outer catch's fail-clean fold (cleanupStaging +
  appendLeakToError, MA-9 / NFR-3 preserved). Pin precedence ("sha over ref") unchanged.
verification: |
  Seam re-validated against isomorphic-git source: CommitNotFetchedError name===code (index.cjs:3684),
  thrown at checkout analyze-fail (6958); _addRemote writes wildcard refspec (6494-6498) even for
  singleBranch; _fetch with no ref + singleBranch=false wants all heads (9895). Targeted
  `node --test tests/orchestrators/plugin/clone-cache.test.ts` = 29/29 pass (25 pre-existing +
  4 new: 42crunch-shape recovery, fast-path no-recovery-fetch guard, still-unreachable fail-clean,
  PROV-03 auth-threaded recovery fetch). Full `npm run check` green (typecheck + ESLint + Prettier +
  full suite, exit 0). LIVE HUMAN CONFIRMATION 2026-07-18: user restarted Pi (picking up the
  fix), re-ran against the fresh claude-plugins-official manifest (inconsistent v1.5.5 /
  30287f5e entry); 42crunch-api-security-testing now materializes instead of rendering the
  `(failed) {source missing}` row. Fix committed as 15b7a1c2.
files_changed:
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - tests/orchestrators/plugin/clone-cache.test.ts
