---
status: resolved
trigger: "Diagnose UAT issue phase 27 (UXG-05): `/claude:plugin marketplace update <name>` against a github-source marketplace ALWAYS renders `(updated)` even when nothing changed upstream. PATH-source no-op renders `(skipped) {up-to-date}` correctly. Find root cause, do not fix."
created: 2026-05-31T00:25:01Z
updated: 2026-05-31T10:16:29Z
resolution: |
  Closed by Plan 27-05 (commit 932e405) + code-review follow-up 57068f0. This
  session's intermediate conclusion (detector correct; user's clone merely behind)
  was SUPERSEDED by the code-verified root cause recorded in 27-HUMAN-UAT.md Test 3:
  the autoupdate-ON branch (then update.ts:705-714) emitted status "updated"
  unconditionally and never consulted `snapshot.changed`. 27-05 threads
  `!snapshot.changed && outcomes.every(o => o.partition === "unchanged")` into that
  branch so a true no-op renders `(skipped) {up-to-date}` (update.ts:746-751). The
  WR-02 hardening flagged here also landed (PRE-read inside refreshRecord's try;
  corrupt PRE manifest routes to `(failed)`). npm run check GREEN 1149/1149.
---

## Current Focus

hypothesis: CONFIRMED -- the change detector is logically correct end-to-end. The "ALWAYS (updated)" report is the user's clone being genuinely behind upstream (32 plugins), so each update pulled real content and (updated) was correct. A TRUE back-to-back no-op correctly renders (skipped) {up-to-date}. The only latent defect is WR-02: manifestContentKey's bare catch forces changed=true whenever the PRE manifest is unreadable for ANY reason (not just ENOENT).
test: Ran the FULL production orchestrator updateMarketplace() three times with REAL isomorphic-git against a hermetic clone seeded from the live (behind) clone.
expecting: If detector were broken, all three runs => (updated). If correct, RUN1=(updated), RUN2/3=(skipped).
next_action: DONE -- diagnosis complete. Return root-cause summary. No fix (diagnose-only).

reasoning_checkpoint:
  hypothesis: "The github change detector is NOT systematically broken; preKey!==postKey is true on RUN1 because upstream genuinely advanced (172 -> 204 plugins). Latent defect WR-02 (bare catch -> undefined PRE -> forced changed) only fires when the PRE manifest is unreadable, which is not the case for a present/valid clone."
  confirming_evidence:
    - "End-to-end updateMarketplace() x3 with real isomorphic-git: RUN1 (clone behind)=(updated); RUN2/3 (true no-op)=(skipped) {up-to-date} warning. Detector distinguishes correctly."
    - "Live clone manifest (1a2f18b, 172 plugins) vs current upstream (c7a3e2f, 204 plugins): +32 plugins, content NOT identical -- a real change."
    - "Read-twice of the same manifest, and isomorphic-git clone->checkout of the SAME commit, both yield byte-identical files and changed=false (no serialization volatility)."
    - "Both the 172-plugin and 204-plugin manifests pass MARKETPLACE_VALIDATOR.Check(); loadMarketplaceManifest does not throw -> PRE/POST both defined for a present clone."
  falsification_test: "If a true no-op (RUN2/RUN3) had rendered (updated), the detector would be broken. It rendered (skipped). Falsified the 'always broken' claim."
  fix_rationale: "No functional fix is required for the reported behavior -- it is correct. The only worthwhile change is the WR-02 hardening (narrow the PRE catch to ENOENT, or surface non-ENOENT PRE-read failures via (failed)) plus the WR-01 comment correction. Neither changes the no-op-vs-changed outcome for the reported scenario."
  blind_spots: "I could not capture the user's exact terminal session; I infer their clone was behind from the live state SHA (1a2f18b) vs upstream (c7a3e2f). If the user genuinely saw (updated) on a back-to-back no-op, that would require PRE=undefined, which only the WR-02 path produces and which I could not reproduce against the present, valid live clone."

## Symptoms

expected: An update that does not change the validated marketplace.json content renders `● <mp> [<scope>] (skipped) {up-to-date}` at warning severity (UXG-05 / Phase 27 SC-3). A genuine change renders `(updated)`. Source-kind-uniform across path + github.
actual: github-source `marketplace update claude-plugins-official` ALWAYS renders `● claude-plugins-official [user] (updated)` even when nothing changed upstream. PATH-source no-op correctly renders `(skipped) {up-to-date}`.
errors: none surfaced (it is a wrong-decision bug, not a crash)
reproduction: `/claude:plugin marketplace update claude-plugins-official` against the already-up-to-date github clone; observe `(updated)` instead of `(skipped) {up-to-date}`.
started: Phase 27 (UXG-05) introduced the changed/skipped distinction. github branch of the change detector. Review 27-REVIEW.md flagged WR-01/WR-02/WR-03.

## Eliminated

- hypothesis: (a) PRE read returns undefined because add-time manifestPath differs from update-time repointed path.
  evidence: add.ts L222/L240-241 sets manifestPath = sourceCloneDir(derivedName)/.claude-plugin/marketplace.json and marketplaceRoot = sourceCloneDir(derivedName). update.ts L288/L292 repoints to sourceCloneDir(name)/.claude-plugin/marketplace.json. sourceCloneDir (locations.ts L189-196) is deterministic path.join(sourcesDir, mp). For the same name they are IDENTICAL. Live state confirms manifestPath == sourceCloneDir/.claude-plugin/marketplace.json. validateManifestAtRoot only repoints if different (no-op here). So PRE and POST read the SAME file path.
  timestamp: 2026-05-31T00:30:00Z

## Evidence

- timestamp: 2026-05-31T00:27:00Z
  checked: domain/manifest.ts loadMarketplaceManifest (L48-61)
  found: Returns RAW JSON.parse(raw); only MARKETPLACE_VALIDATOR.Check(parsed), never .Parse(). Confirms WR-01 -- the update.ts L255-256 comment claiming ".Parse yields stable key order" is FALSE. JSON.stringify preserves the source file's exact key order + any unknown fields.
  implication: If the on-disk bytes change between PRE and POST (e.g. git checkout rewrites them), or if the parse value contains anything order/whitespace-volatile, the key diverges. But JSON.stringify of the same parsed object is stable for the same input.

- timestamp: 2026-05-31T00:29:00Z
  checked: Live persisted state.json (user + project scope) for claude-plugins-official
  found: source = {kind: github, raw: anthropics/claude-plugins-official, owner, repo} -- NO `ref` field (source.ref === undefined). manifestPath/marketplaceRoot point at sourceCloneDir/.claude-plugin/marketplace.json. Clone dir + 95K manifest exist on disk, git status clean, on branch main up-to-date with origin/main (commit 1a2f18b). autoupdate flag UNSET (=> autoupdate-OFF manifest-only path, the bug's path).
  implication: source.ref undefined => refreshGitHubClone takes the storedRef===undefined branch (shared.ts L150-168). Manifest present + valid => readable at PRE time.

- timestamp: 2026-05-31T00:35:00Z
  checked: Real 97K (172-plugin) live manifest through loadMarketplaceManifest + manifestContentKey; read twice (no-op).
  found: Check() passes; preKey defined (len 78806); read-twice preKey===postKey TRUE. JSON.stringify of same parse is stable.
  implication: Disproves "PRE Check fails -> undefined" and the "raw JSON.parse retains a volatile field" sub-theory for a same-bytes read.

- timestamp: 2026-05-31T00:40:00Z
  checked: isomorphic-git clone (mimics add) then isomorphic-git checkout of the SAME commit; also system-git clone copied then isomorphic-git re-checkout of same HEAD.
  found: working-tree marketplace.json byte-identical before/after in BOTH cases; changed=false.
  implication: Disproves hypothesis (b) -- git fetch/checkout does NOT rewrite the manifest bytes (no line-ending/smudge volatility), even cross-tool (system-git clone -> isomorphic-git checkout).

- timestamp: 2026-05-31T00:45:00Z
  checked: Two consecutive faithful refreshGitHubClone cycles on a copy of the live clone: RUN1 fetch advances 1a2f18b->c7a3e2f, RUN2 fetch is a true no-op (same SHA).
  found: RUN1 preKey!==postKey => changed=true. RUN2 preKey===postKey => changed=false.
  implication: Detector correctly distinguishes a real advance from a true no-op.

- timestamp: 2026-05-31T00:48:00Z
  checked: Live clone manifest (1a2f18b) vs current upstream (c7a3e2f) plugin sets.
  found: 172 vs 204 plugins (+32 added: apollo-skills, appwrite, buildkite, ...); JSON content NOT identical. Both manifests pass MARKETPLACE_VALIDATOR.Check().
  implication: The user's clone was genuinely behind upstream. An update of it is a REAL change -> (updated) is CORRECT, not a bug.

- timestamp: 2026-05-31T00:52:00Z
  checked: DEFINITIVE -- full production orchestrator updateMarketplace() x3 with REAL DEFAULT_GIT_OPS (isomorphic-git) end-to-end through withStateGuard/loadState/saveState, hermetic project scope, clone seeded from the live (behind) clone.
  found: RUN1 => "● claude-plugins-official [project] (updated)". RUN2 => "● claude-plugins-official [project] (skipped) {up-to-date}" (warning). RUN3 => same (skipped).
  implication: The change detector is CORRECT end-to-end. It does NOT always render (updated). The reported "ALWAYS updated" is the legitimate "follow-upstream" result of a clone that was 32 plugins behind; a true back-to-back no-op renders (skipped) {up-to-date}.

- timestamp: 2026-05-31T00:54:00Z
  checked: WR-02 mechanism in isolation -- manifestContentKey(absentPath) vs manifestContentKey(realPath).
  found: PRE(absent)=undefined, POST(real)=defined => changed=true.
  implication: CONFIRMS the only way github yields a spurious (updated) is when the PRE manifest is UNREADABLE (ENOENT/EACCES/corrupt/schema-invalid). The bare catch (update.ts L268) collapses all of these to undefined PRE => forced changed. This is a real LATENT defect (WR-02) but does NOT fire for a present, valid clone, so it is not the cause of the reported observation.

## Resolution

root_cause: |
  Two-part finding.

  PRIMARY (explains the observation): The github change detector is FUNCTIONALLY
  CORRECT. The reported "ALWAYS (updated)" was the user's clone being genuinely
  behind upstream. Live state shows the clone pinned at commit 1a2f18b (172
  plugins) while anthropics/claude-plugins-official upstream is at c7a3e2f (204
  plugins, +32). source.ref is undefined, so each `marketplace update` does
  fetch + checkout of origin/HEAD and pulls the 32 new plugin entries -- a REAL
  marketplace.json content change. preKey (172-plugin manifest) != postKey
  (204-plugin manifest) => changed=true => (updated) is the CORRECT output.
  End-to-end production-orchestrator reproduction (updateMarketplace x3, real
  isomorphic-git): RUN1 (behind)=(updated); RUN2/RUN3 (true no-op)=(skipped)
  {up-to-date} warning. The detector is source-kind-uniform and works; the PATH
  no-op renders (skipped) for the same reason a github no-op does. The user's
  hypothesis ("it can't tell when we picked new changes") is inverted -- it CAN
  tell, and it was correctly reporting that real new content arrived each run.

  SECONDARY (latent, not the reported cause): WR-02. manifestContentKey
  (update.ts:262-271) wraps loadMarketplaceManifest in a bare `try { ... }
  catch { return undefined }`. preKey is read off record.manifestPath BEFORE the
  refresh (update.ts:285). If that PRE read fails for ANY reason -- ENOENT
  (clone/manifest absent), EACCES, malformed JSON, or schema-invalid content --
  preKey becomes undefined while postKey (read after a successful
  validateManifestAtRoot) is defined, so `preKey !== postKey` (update.ts:308) is
  forced true and the refresh ALWAYS renders (updated). This is a real
  asymmetry-prone defect: a github clone's working tree is the only manifest
  source that could plausibly be transiently absent/rewritten between sessions,
  whereas a path source points at a stable user directory -- which is why this
  defect, if it fired, would manifest specifically on the github branch. It does
  NOT fire for the user's present/valid clone (verified: both 172- and 204-plugin
  manifests pass Check()), so it is not the cause of THIS observation, but it is
  the genuine code smell behind the report's framing.

  Exact responsible lines:
    - update.ts:285  preKey = await manifestContentKey(record)  // PRE read
    - update.ts:262-271 manifestContentKey  // bare catch -> undefined on any failure (WR-02)
    - update.ts:308  const changed = preKey !== postKey  // undefined PRE => always changed
    - domain/manifest.ts:48-61 loadMarketplaceManifest  // returns raw JSON.parse (WR-01); throws on Check fail
  No path-vs-github asymmetry exists in refreshRecord beyond the PRE-read
  source: validateManifestAtRoot + sourceCloneDir are deterministic and
  add.ts:240-241 persists manifestPath == sourceCloneDir/.claude-plugin/
  marketplace.json == the exact path update repoints to.

fix: |
  DIAGNOSE-ONLY -- not applied. Minimal correct fix direction:
  (1) No functional change is needed to fix the reported behavior; it is correct.
      The right "fix" for the UAT is to confirm the clone has caught up and
      re-run update (the second run renders (skipped) {up-to-date}).
  (2) WR-02 hardening (recommended, defensive): narrow the manifestContentKey
      PRE-read catch so that only genuine "no manifest yet" (ENOENT) maps to the
      undefined/"changed" safe default, and let unexpected PRE-read failures
      (EACCES / malformed JSON / schema-invalid) propagate to the (failed) path
      that validateManifestAtRoot already uses for POST. This removes the
      always-(updated) failure mode for a corrupt/unreadable pre-existing clone.
  (3) WR-01 comment correction: update.ts:255-256 + :301-306 falsely claim
      typebox `.Parse` canonical key order; loadMarketplaceManifest returns the
      raw JSON.parse value (Check-only). Correct the comment so a future
      maintainer does not "optimize" loadMarketplaceManifest into `.Parse()`
      (which WOULD change the key and could silently flip the no-op
      classification).
  Intersection: the diagnosis directly intersects WR-02 (the PRE bare catch is
  the only spurious-(updated) mechanism) and WR-01 (the misleading comment on
  the very same comparison). It also vindicates WR-03's concern: the existing
  github no-op test (update.test.ts:144-180) proves the no-op via a mock checkout
  that never rewrites the working tree, so it would still pass even if the real
  byte-level comparison regressed; a test that rewrites a byte-identical manifest
  on checkout (and one that makes the PRE read fail) would close the gap.

verification: N/A -- diagnose-only mode; no fix applied. Root cause confirmed by end-to-end production-orchestrator reproduction (updateMarketplace x3) plus isolated mechanism tests.
files_changed: []

---

## SECOND INVESTIGATION (2026-05-31T03:10:00Z) -- reproduction against the REAL on-disk clones

The first investigation seeded a FRESH clone that was behind upstream and concluded "mechanism
correct." This second pass was tasked with reproducing against the user's ACTUAL persisted
artifacts (copied to a temp sandbox, live state NOT mutated). It CONFIRMS the first
investigation's conclusion and adds the decisive missing facts.

### What was actually on disk (live, read-only)

- **PI_CODING_AGENT_DIR is UNSET** -> user scope = `~/.pi/agent/`.
- **USER-scope** record `claude-plugins-official`: source.kind=github, source.ref ABSENT,
  manifestPath/marketplaceRoot = `~/.pi/agent/pi-claude-marketplace/sources/claude-plugins-official`,
  lastUpdatedAt = `2026-05-13T02:32:35Z`, autoupdate absent (OFF), record.plugins = 5 installed.
  Clone: HEAD == refs/heads/main == refs/remotes/origin/HEAD == **1a2f18b**, working tree CLEAN,
  manifest = **172 plugins**. Working-tree manifest mtime, .git/HEAD mtime, refs/heads/main mtime
  ALL frozen at **2026-05-12 22:32 local (= the 05-13 02:32 UTC lastUpdatedAt)** -- the clone has
  not been written since the original add/first-update ~16 days ago.
- **PROJECT-scope** record ALSO exists (`<repo>/.pi/pi-claude-marketplace/state.json`):
  same github source, source.ref absent, lastUpdatedAt = `2026-05-14T10:32:25Z`, clone frozen at
  **1a2f18b** (172 plugins), mtimes all at **2026-05-14 06:32 local**. `resolveScopeFromState`
  checks PROJECT before USER, so an unqualified `marketplace update claude-plugins-official` run
  from the repo cwd resolves to THIS project record, not the user one.
- Both clones are iso-git-made (no `.git/logs`, no `FETCH_HEAD`, no `packed-refs`; ~293-296
  loose remote refs). `.pi/` is gitignored, so branch/worktree switches do not reset it.

### The premise in the task brief is factually stale

`git ls-remote https://github.com/anthropics/claude-plugins-official.git HEAD refs/heads/main`
returns **`c7a3e2ffa047de2da799c2237475f024c83f4c4b`** RIGHT NOW. Upstream `main`/`HEAD` is at
**c7a3e2f**, NOT 1a2f18b. The "1a2f18b" the brief read off `refs/remotes/origin/HEAD` is the
LOCAL CACHED value from the clone's last (stale, ~16-day-old) fetch. **Upstream is genuinely
ahead of both of the user's clones by exactly the 172 -> 204 plugin delta the first investigation
saw.** A real fetch DOES bring new content.

### Reproduction against the REAL clones (sandbox copies, live state untouched)

Copied each live clone (preserving `.git`) into `/tmp` and ran the REAL production
`refreshGitHubClone` + the exact `manifestContentKey` (= `JSON.stringify(loadMarketplaceManifest(path))`)
PRE/POST, with the REAL `DEFAULT_GIT_OPS` (real iso-git fetch/resolveRef/currentBranch/
forceUpdateRef/checkout). Results IDENTICAL for both user-scope and project-scope clone copies:

| run | onFetch fired | fetch threw | file sha before -> after | bytes changed | preKey len | postKey len | changed | render |
|-----|---------------|-------------|--------------------------|---------------|------------|-------------|---------|--------|
| 1   | yes           | no          | 0c386a52 -> 9c09d9dc     | TRUE          | 78806      | 93995       | TRUE    | (updated) |
| 2   | yes           | no          | 9c09d9dc -> 9c09d9dc     | false         | 93995      | 93995       | FALSE   | (skipped) up-to-date |
| 3   | yes           | no          | 9c09d9dc -> 9c09d9dc     | false         | 93995      | 93995       | FALSE   | (skipped) up-to-date |

After RUN 1 the clone CONVERGED: HEAD advanced 1a2f18b -> c7a3e2f, working tree became the
204-plugin manifest, tree clean. **The mechanism is correct and self-healing: one genuine
`(updated)` for the real upstream advance, then `(skipped) up-to-date` forever after.** A further
5-back-to-back-refresh stability run on the at-tip clone produced `changed: false` every time,
identical keylen (93995), identical file sha -- NO flip-flop, NO key-order volatility, NO
byte-renormalization by `checkout`.

### The exact preKey vs postKey divergence (the only divergence that exists)

It is a REAL upstream content change, not a serialization artifact:
- preKey (len 78806) = `JSON.stringify` of the **172-plugin** manifest at 1a2f18b.
- postKey (len 93995) = `JSON.stringify` of the **204-plugin** manifest at c7a3e2f.
- `firstDiffIndex` lands inside the `plugins` array where the 32 new entries appear; the keys
  diverge because the array literally has 32 more elements. This is `preKey !== postKey` reporting
  truthfully.

### Hypotheses (a)-(d) from the task -- all RULED OUT against the real clone

- **(a) WR-01 / key-order:** RULED OUT. The on-disk file PRE and the file POST-checkout are
  byte-identical when the commit does not change (sha 9c09d9dc both sides, runs 2-5). isomorphic
  `git.statusMatrix` on the real clone returns `[1,1,1]` (HEAD==WORKDIR==STAGE) and
  `git.status` returns `"unmodified"`; system `git diff HEAD` and `diff-files` are empty.
  `checkout` of an already-current commit does NOT rewrite the working-tree bytes, so raw
  `JSON.parse`->`JSON.stringify` yields the same string both sides. The WR-01 comment at
  update.ts:255-256 (claiming typebox `.Parse` canonical order) is still FALSE/misleading
  (loadMarketplaceManifest only `.Check()`s and returns the raw parse), but it causes NO spurious
  change because the input bytes are stable.
- **(b) checkout rewriting bytes per invocation:** RULED OUT. file sha is invariant across
  runs 2-5; no line-ending/smudge volatility (iso-git checkout of the same SHA is a no-op write).
- **(c) staging / re-clone re-serialization:** RULED OUT. `update` never re-clones; it
  fetch+checkouts the existing clone in place. `sourceCloneDir(name)` ==
  `<extensionRoot>/sources/<name>` == `record.marketplaceRoot` == the dir PRE/POST reads
  (`add.ts:240-241` persists exactly that path). No directory indirection mismatch.
- **(d) any other preKey/postKey divergence:** the ONLY divergence observed is the genuine
  172->204 upstream advance.

### Why the clones are FROZEN on disk yet the code provably advances them

This is the genuine open anomaly, and it is NOT in `refreshRecord`. Both clones' working-tree +
.git mtimes are frozen ~16 days old; lastUpdatedAt likewise frozen. Yet running the real code
against copies of them advances them in one run and stamps+persists lastUpdatedAt (verified through
the real `loadState`/`saveState`). Therefore, in the user's live Pi sessions the persisted advance
is not happening. Given the code is correct, the surviving explanations are environmental, not a
detector bug:
  1. The update never actually executed against these specific (scope, record) pairs since the
     original add -- e.g. the user observed `(updated)` from a DIFFERENT ephemeral cwd/project
     scope where a brand-new clone was created at 172 and advanced (each fresh-cwd run would then
     show exactly ONE `(updated)`, which a user repeating the command from fresh dirs could
     misread as "always updated"); or
  2. iso-git's bundled HTTP transport intermittently failed in the user's session (observed: one
     cold-start `getRemoteInfo` TIMEOUT here, though 5/5 subsequent attempts succeeded in <200ms).
     But a fetch THROW renders `(failed)` (verified: throwing `gitOps.fetch` propagates as
     `MarketplaceUpdateError` -> `(failed)`, with `cloneAdvanced=false` suppressing the retry
     hint), NOT `(updated)` -- so a hard fetch failure does NOT match the reported `(updated)`.

There is NO code path in which a no-op github refresh against an at-tip clone renders `(updated)`.

### Files inspected (no source modified)

- orchestrators/marketplace/update.ts (refreshRecord L273-324, manifestContentKey L262-271,
  validateManifestAtRoot L730-744, the `changed = preKey !== postKey` at L308)
- orchestrators/marketplace/shared.ts (refreshGitHubClone L137-204; storedRef===undefined branch
  L150-168)
- orchestrators/marketplace/add.ts (github clone -> manifestPath/marketplaceRoot persist L235-244)
- domain/manifest.ts (loadMarketplaceManifest L48-61 -- raw JSON.parse + `.Check`, WR-01)
- platform/git.ts (iso-git checkout/fetch/resolveRef/currentBranch/forceUpdateRef wrappers)
- persistence/locations.ts (sourceCloneDir L189-196)
- transaction/with-state-guard.ts (save-on-no-throw)

### Final root-cause statement (this pass)

The UXG-05 github change detector is FUNCTIONALLY CORRECT and source-kind-uniform. Reproduced
against BOTH of the user's REAL on-disk clones with the REAL iso-git fetch: it renders `(updated)`
exactly ONCE for the genuine upstream advance (1a2f18b/172 -> c7a3e2f/204) and `(skipped)
up-to-date` on every subsequent no-op, stably and without flip-flop. The reported "ALWAYS
(updated)" is NOT reproducible against the real clones; the task brief's "upstream == 1a2f18b,
fetch brings nothing" premise is stale (upstream is c7a3e2f). The only `preKey !== postKey`
divergence that exists is the real 172->204 plugin-array delta, reported truthfully by
`update.ts:308`.

The single genuine code finding remains the latent **WR-02** asymmetry (manifestContentKey's bare
`catch { return undefined }` at update.ts:268 forces `changed=true` whenever the PRE manifest is
UNREADABLE -- ENOENT/EACCES/malformed/schema-invalid), plus the misleading **WR-01** comment at
update.ts:255-256. Neither fires for a present, valid clone, so neither explains the observation.

### Minimal correct fix direction (NOT implemented; diagnose-only)

1. **Most robust for github sources: compare the git commit SHA, not manifest bytes.** For a
   github source, capture `resolveRef('HEAD')` (or origin/HEAD) PRE and POST and treat
   `changed = preSha !== postSha`. This is O(1), immune to any serialization/key-order question,
   and aligns with the "follow upstream blindly" contract. Manifest-content compare stays the
   right primitive for PATH sources (no git).
2. **If keeping the content compare:** canonicalize before stringifying -- run the parsed value
   through typebox `.Parse` (or a stable key-sorting serializer / `JSON.stringify(parsed,
   Object.keys(parsed).sort())` deep variant) so the key is order-stable regardless of source
   byte order. This makes WR-01's comment true in fact.
3. **WR-02 hardening (independent of the above):** narrow the manifestContentKey PRE catch so only
   genuine "no manifest yet" (ENOENT) maps to the undefined/"changed" safe default; let
   EACCES/malformed/schema-invalid PRE-read failures route to the existing `(failed)` path instead
   of silently forcing `(updated)`.
4. **WR-03 test gap:** add a regression test that runs the github no-op against a clone whose
   `checkout` rewrites a byte-identical manifest AND a test that makes the PRE read fail, so a
   future regression of the byte-level compare or the WR-02 catch is caught.
