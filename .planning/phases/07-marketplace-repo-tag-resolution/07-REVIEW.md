---
phase: 07-marketplace-repo-tag-resolution
reviewed: 2026-09-19T19:24:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/release-tag.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/marketplace-tag-probe-offline.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/domain/release-tag.test.ts
  - tests/integration/path-source-tag-install.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/marketplace-tag-probe.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 3
  warning: 11
  info: 3
  total: 17
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-09-19T19:24:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The phase adds a local, network-free release-tag probe for `path`-source dependencies
(`marketplace-tag-probe.ts`), extracts the shared selection evaluator (`domain/release-tag.ts`),
materializes a marketplace-local tag into the plugin-clone cache (`materializeMarketplaceTagClone`),
threads a `path` pin through the resolver, and adds the `{dependency current copy}` fallback
token. `npx tsc --noEmit` is green; the four focused test modules I ran pass (26 cases).

Three defects survive that gate. The tag-materialization construction copies the marketplace
*working tree* rather than extracting the tag, so the "tag content" it caches can contain
untracked and gitignored files and can collide with a pristine clone under the same
content-addressed key. Two tests assert something other than what their titles promise and
would stay green against the failure they exist to catch — one of them guards a line of
production code that is unreachable-in-effect.

Beyond those, the pin plumbing is one-directional: a `path` install now persists a
`resolvedSha` that only the install verb understands, the advertised `tagMemo` is never
wired by any production caller, and the new local probe has no injection point on the
install entry point (unlike its network sibling). The module comments also carry
GSD phase/plan references that `skills/typescript-comments/SKILL.md` forbids.

## Critical Issues

### CR-01: `materializeMarketplaceTagClone` caches the working tree, not the tag

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:662-677`
**Issue:** The construction is `cp(marketplaceRoot, staging, { recursive: true })` followed by
`gitOps.checkout({ dir: staging, ref: args.tagOid })`. A git checkout never removes untracked
or ignored files, so every file present in the marketplace checkout but absent from the tag
survives into `staging` and is promoted into `plugin-clones/<key>/`.

Two consequences, both provable from the code:

1. **The materialized tree is not the tag.** `docs/dependency-resolution.md:102` promises
   "the plugin's files come from the marketplace repository at that tag, not from the
   marketplace's current checkout." For a `path`-source marketplace the `marketplaceRoot` is
   the user's own working repository (see `tests/integration/path-source-tag-install.test.ts:188`,
   which adds `rawSource: marketplaceRoot` directly). Anything untracked under
   `plugins/<name>/` — a `.env`, a local skill file, build output — is copied verbatim into the
   plugin-clone cache and then staged by the bridges as part of the plugin. `node_modules/` and
   every other ignored tree in the repo is copied too.
2. **The cache key's content-equivalence invariant breaks.** The key is
   `pluginCloneKey(marketplaceUrl, tagOid)` (line 657) — the *same* key shape
   `materializePluginClone` (line 180) and `seedOnePluginMirror` (line 398) use for the same
   repo URL and commit. Every warm-cache short-circuit in this file justifies itself with
   "same key => same content" (lines 401-403, 660-661, 188). Here that is false: whichever
   producer writes the key first decides whether a later install gets a pristine clone of the
   commit or a polluted copy of someone's working tree. The outcome is order-dependent.

**Fix:** Do not seed the staging dir from the working tree. Either extract the tag's tree only
(copy `<marketplaceRoot>/.git` into `staging/.git` with an empty work tree, then check the tag
out into it), or clone the local repository into staging and check the tag out there:

```ts
// Copy ONLY the gitdir, so the checkout below writes the tag's tree into an
// empty work tree and no untracked working-tree file can ride along.
await mkdir(staging, { recursive: true });
await cp(path.join(args.marketplaceRoot, ".git"), path.join(staging, ".git"), {
  recursive: true,
});
await gitOps.checkout({ dir: staging, ref: args.tagOid });
```

If the copy-the-work-tree shape must be kept for another reason, the key must stop claiming
content equivalence with a pristine clone — give this producer its own key namespace.

### CR-02: the sha-divergence doc gate asserts a prose fragment that does not mention the divergence

**File:** `tests/architecture/dependency-doc-agreement.test.ts:334-347`
**Issue:** The case is titled "the plugin-declares section names the sha divergence from
upstream" and its only assertion is:

```ts
assert.ok(
  section.includes("Claude Code accepts a"),
  `${DOC_REL}: the "What a plugin declares" section never states that upstream accepts a sha field`,
);
```

The pinned stem is 21 characters of the 300-character sentence at
`docs/dependency-resolution.md:33` and contains neither `sha`, nor `pins`, nor the refusal this
extension makes. Rewriting the sentence to "Claude Code accepts a `marketplace` field on a
dependency element." deletes the entire divergence statement and keeps the gate green — the
exact prose-versus-code drift the file's own header (lines 23-31) says it exists to catch.

**Fix:** Assert the claim, not a stem. Pin the tokens that carry the fact and the consequence:

```ts
for (const claim of ["`sha`", "pins the dependency to that commit", "{invalid manifest}"]) {
  assert.ok(
    section.includes(claim),
    `${DOC_REL}: the "What a plugin declares" section no longer states ${claim}`,
  );
}
```

### CR-03: the memo-eviction case is vacuous, and the line it guards is unreachable-in-effect

**File:** `tests/orchestrators/plugin/marketplace-tag-probe.test.ts:167-186`,
`extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts:92-115`
**Issue:** `listMarketplaceCandidateTags` returns early when `memo.get(marketplaceRoot)` hits
(lines 92-95) and only calls `memo.set` *after* the listing and every peel succeed (line 107).
The `catch` therefore runs `memo?.delete(marketplaceRoot)` (line 110) against a key the same
call has just proven absent. Deleting it is a no-op on every single-threaded path.

The test named "a failed listing drops its memo entry so a later attempt re-lists instead of
replaying the error" passes identically with line 110 deleted: the second probe re-lists because
nothing was ever memoized, not because anything was dropped. It proves the memo's *miss*
behavior, which the preceding case already covers, and gives zero protection to the line it
names. The same shape exists in `dependency-tag-probe.ts:118-137` and was mirrored here.

There is one path on which line 110 is reachable, and it is harmful rather than helpful: two
`await`-interleaved probes sharing one memo both miss, the first succeeds and calls `set`, the
second fails and `delete`s the *successful* listing the first just stored.

**Fix:** Delete line 110 (and the doc sentence at lines 84-85 that asserts the behavior), or
make the claim true by memoizing an in-flight promise and evicting *that*:

```ts
// The memo holds an in-flight promise, so a concurrent member awaits the same
// listing and a rejection evicts exactly the entry that failed.
const inFlight = memo?.get(marketplaceRoot) ?? startListing();
memo?.set(marketplaceRoot, inFlight);
try {
  return { kind: "listed", tags: await inFlight };
} catch (err) {
  if (memo?.get(marketplaceRoot) === inFlight) {
    memo.delete(marketplaceRoot);
  }
  // ...
}
```

Either way the test must discriminate: assert that the second probe listed again *and* that a
concurrent success is not evicted.

## Warnings

### WR-01: a `path` install now persists `resolvedSha`, and `update` leaves it stale

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:497-511, 976-981`
**Issue:** `resolvePathPluginRoot` assigns `resolvedSha = result.resolvedSha` (line 507), and the
state phase writes it onto the record (line 980). The comment two lines above still reads "Path /
github-name installs omit it" — no longer true. `tests/integration/path-source-tag-install.test.ts:229`
asserts `formatterRecord.resolvedSha === tagOid`, confirming the new behavior.

No other verb understands that field on a `path` record:

- `deriveInstallVersion` (line 364) tests `kind === "url" | "git-subdir" | "github"`, so a `path`
  record's version comes from the ladder, not the sha — consistent, but only by accident of the
  kind test.
- `update-preflight.ts:456-459` rewrites `record.resolvedSource = preflight.installable.pluginRoot`
  and only overwrites `resolvedSha` when the preflight produced one. For a `path` source the
  preflight produces none (`update-preflight.ts:235` has the same three-kind test), so after an
  update the record points `resolvedSource` back at the marketplace checkout while `resolvedSha`
  still names the old tag commit. The record contradicts itself.
- `reinstall-record.ts:131-132` preserves the old `resolvedSha` unconditionally, with the same
  result.
- `clone-gc.ts::deriveLiveCloneKeys` gates on `resolvedSha !== undefined` as its "this is a
  git-source record" test.

**Fix:** Make the field's meaning explicit for `path` records and close the loop in the re-verbs.
Minimum: clear `record.resolvedSha` when a path-source re-resolution produces no pin, so the
record never claims a commit it is not at.

```ts
record.resolvedSource = preflight.installable.pluginRoot;
if (preflight.resolvedSha === undefined) {
  delete record.resolvedSha;
} else {
  record.resolvedSha = preflight.resolvedSha;
}
```

Also correct the stale comment at `install-outcome.ts:978-981`.

### WR-02: `MarketplaceTagProbeOptions.tagMemo` is dead — no production caller passes it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts:52-58`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:582-590`
**Issue:** The option's doc promises "One cascade can reach the same marketplace clone for several
members, and this bounds that to one listing per root." The cascade's path branch
(`install-cascade.ts:586-590`) passes only `pluginName`, `marketplaceRoot` and `range`.
`MemberConstraintOptions` has a `tagMemo` field (line 272) but it is typed
`CascadeTagMemo = NonNullable<DependencyTagProbeOptions["tagMemo"]>` — a `Map<string, RemoteTag[]>`
keyed by URL, not by marketplace root, and it is threaded only into the network probe (line 611).
A `grep` over `extensions/` finds no other call site.

Two false claims follow from this. `path-source-tag-install.test.ts:346` comments "both members
pinned correctly off the one clone's one listing" — in fact the clone is listed twice, and every
tag is peeled twice. The only case that exercises the memo is
`marketplace-tag-probe.test.ts:155-165`, which constructs it by hand.

**Fix:** Either wire it (add a `marketplaceTagMemo: Map<string, readonly ReleaseTagCandidate[]>`
to `MemberConstraintOptions`, allocate one per run in `runInstallCascade` beside the URL memo, and
pass it at line 586-590), or delete the option and its doc paragraph and correct the integration
test comment.

### WR-03: the local probe has no injection point on `installPlugin`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1484`
**Issue:** `runInstallCascade` is handed `...(opts.tagProbe !== undefined && { tagProbe: opts.tagProbe })`
but nothing equivalent for `marketplaceTagProbe`, and `InstallPluginOptions` declares no such
field. `install-cascade.ts` exposes the seam (line 384) and `install-cascade.test.ts` uses it, but
no test that drives the real `installPlugin` can fake the local probe: it will always reach
`probeMarketplaceTags` and hit the real filesystem via `listTags`/`resolveTagOid`. That is why the
only end-to-end coverage of this arm is the integration test, which must build a real repository.
The asymmetry also means a future non-test consumer cannot substitute the probe.

**Fix:** Add `marketplaceTagProbe?: CascadeMarketplaceTagProbe` to `InstallPluginOptions` and
forward it next to `tagProbe`, mirroring the network probe exactly.

### WR-04: the "positive offline proof" gate does not prove what its header claims

**File:** `tests/architecture/marketplace-tag-probe-offline.test.ts:36-52, 59-72`
**Issue:** The header calls this "a POSITIVE proof that the local, network-free tag probe never
reaches the network" and says it is "stronger than a forbidden-substring scan". The
implementation is a regex over `import\s*\{([^}]*)\}\s*from\s*["'][^"']*platform/git[^"']*["']`.
It sees only brace-form named imports from a specifier containing `platform/git`. It cannot see:

- a namespace import added *alongside* the named one (`import * as gitAll from "../../platform/git.ts"`)
  — the named clause still yields exactly `["listTags","resolveTagOid"]` and the case passes while
  `gitAll.clone` is in scope;
- `await import("../../platform/git.ts")`;
- a network reach through any *other* module — nothing stops
  `marketplace-tag-probe.ts` importing `./dependency-tag-probe.ts`, `../auth-host.ts` or
  `./clone-cache.ts`, all of which touch the network.

**Fix:** Either downgrade the header's claim to what it checks (the named-import surface from one
module), or make the gate transitive: walk the module's import graph and assert that no reachable
module imports a network-touching `platform/git.ts` symbol.

### WR-05: the fallback row reports `info`, against the project's own severity precedent

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:215-223`
**Issue:** A member that fell back stamps `{dependency current copy}` but leaves severity to
`companionSeverity`, which returns `info` whenever both companions are loaded. So a constrained
install that did *not* honor its constraint — and, per D-07-07, did not even manage to read the
tag list — renders at the same severity as a clean install.

The sibling case in the same function decides the opposite way. `skipSeverity`
(`notify-reasons.ts:105-111`) raises a skip to `warning` the moment a non-idempotent reason joins
the brace, and the comment at `install-cascade.messaging.ts:229-235` justifies it precisely as
"the requesting plugin installed against a dependency that materialized nothing". The fallback is
the same shape: the requesting plugin installed against a dependency at an unverified version.
`docs/dependency-resolution.md:104` records the divergence from upstream (which warns here) and
defers to the load-time check — but that check does not run until the next reload, so the only
signal at install time is a row the operator has been trained to read as "nothing to do".

**Fix:** Raise the fallback row to `warning` (`severity: member.fellBackToCurrentCopy ? "warning"
: companionSeverity(...)`), or document in `notify-reasons.ts` why `dependency current copy` is
the one non-idempotent success marker that stays `info` so the next reader does not read it as an
oversight.

### WR-06: `resolveTagOid` can return a non-commit oid and nothing checks

**File:** `extensions/pi-claude-marketplace/platform/git.ts:404-451`
**Issue:** The docstring states "any other tagged type (`blob` / `tree`) is not a commit at all;
the current oid is returned and the caller is responsible for dropping a candidate that does not
resolve to a commit." No caller does. `listMarketplaceCandidateTags` pushes whatever comes back
(`marketplace-tag-probe.ts:103-104`), `selectHighestSatisfyingTag` copies it onto the pin
(`release-tag.ts:88`), and `materializeMarketplaceTagClone` hands it to
`gitOps.checkout({ ref: tagOid })` (`clone-cache.ts:670`). A blob- or tree-tag whose name happens
to match `<plugin>--v<semver>` produces a checkout failure that propagates as an install failure
with an isomorphic-git message rather than a clean no-match.

The `MAX_TAG_PEEL_HOPS` exhaustion path (line 450) has the same shape: it returns the last *tag
object's* oid, silently, with no signal that the peel never terminated.

**Fix:** Have `resolveTagOid` report the non-commit case instead of documenting a caller
obligation nobody honors — return `undefined` (or a discriminated arm) for a non-commit peel and
for hop exhaustion, and let `listMarketplaceCandidateTags` skip that candidate.

### WR-07: the pinned-`path` arm surfaces `git-subdir` wording for a `path` source

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:679`,
`extensions/pi-claude-marketplace/domain/plugin-resolver.ts:406-412`
**Issue:** `materializeMarketplaceTagClone` resolves the plugin root with
`resolveGitSubdirRoot(dest, args.pathSource.raw)`, whose failure details are hard-coded to
`git-subdir path "<subPath>" ...` (`shared/fs-utils.ts:330, 342`). `deriveSourcePluginRoot` puts
`r.detail` straight onto the `unavailable` notes (line 410). A user whose marketplace entry reads
`"source": "./plugins/formatter"` and whose tag tree lacks that directory is told
`git-subdir path "./plugins/formatter" does not exist in the plugin clone` — a source kind they
never used and a "plugin clone" they do not know exists.

The unpinned arm three lines below produces the truthful `source path escapes marketplace root:
<raw>` wording, so the same failure now reads two different ways depending on whether a constraint
was present.

**Fix:** Parameterize the label (`resolveGitSubdirRoot(cloneRoot, subPath, label)`) or map the
detail at the `path` call site before it reaches the notes.

### WR-08: the doc never states that an unreadable tag listing also falls back

**File:** `docs/dependency-resolution.md:98-104`
**Issue:** The section enumerates the fallback triggers as "When no tag satisfies -- including
when the marketplace clone carries no tags at all, or none named for that plugin". The code takes
the same arm for `tag-listing-failed` (`install-cascade.ts:599-601`, D-07-07): a marketplace root
that is not a git repository, an unreadable `.git`, a corrupt refs directory. The user sees
`{dependency current copy}` and has no way to learn from the documentation that the tag list was
never read at all, which is the case where the installed version is least likely to satisfy the
constraint.

Note the failure-table half of `dependency-doc-agreement.test.ts` cannot catch this: the fallback
is not a failure arm, so no gate compares this prose to the code.

**Fix:** Add the case to line 102: "...or when the marketplace clone's tag list cannot be read at
all (for example the marketplace is not a git checkout)".

### WR-09: `readPinCandidate` is exported only for its test, with a gate exemption to match

**File:** `extensions/pi-claude-marketplace/domain/release-tag.ts:74`,
`tests/architecture/gate-targets.ts:650-656`
**Issue:** The allowlist entry states the problem in its own words: "`readPinCandidate` is exported
for parity with the moved shape (`selectHighestSatisfyingTag` calls it internally, in the SAME
file); no production caller reaches it directly." `skills/typescript-google-style-review`
requires every export to be used outside its module, and
`skills/typescript-unit-testing-review` classes "an export ... added for a test" as a production-design
finding — the production design changes, never the test's access. The unused-export gate was
amended to accommodate the export rather than the other way round.

`PinnedReleaseTag` (line 57) has the same problem without even an allowlist entry: `grep` over
`extensions/` and `tests/` finds no reference outside `release-tag.ts`.

**Fix:** Unexport both and drop the `gate-targets.ts` entry.
`readPinCandidate`'s three cases (`release-tag.test.ts:110-144`) are all expressible through
`selectHighestSatisfyingTag` with a one-element candidate list, which is what a caller actually
observes.

### WR-10: comment policy — GSD phase and plan references in source and test comments

**File:** multiple (see list)
**Issue:** `skills/typescript-comments/SKILL.md` forbids `Phase NN` / `Plan NN` / phase-directory
references in comments and test titles; decision and requirement IDs are the sanctioned anchors.
Fifteen violations were introduced or touched by this phase:

| File:line | Text |
| --- | --- |
| `domain/release-tag.ts:3` | `D-07-05 (07-marketplace-repo-tag-resolution)` |
| `domain/resolver-types.ts:138` | `D-07-06 (07-marketplace-repo-tag-resolution)` |
| `platform/git.ts:378` | `D-07-05 (07-marketplace-repo-tag-resolution)` |
| `platform/git.ts:408` | `verified for the remote path by Phase 3's live UAT` |
| `orchestrators/plugin/clone-cache.ts:613` | `D-07-01 / D-07-04 (07-marketplace-repo-tag-resolution)` |
| `orchestrators/plugin/clone-cache.ts:637` | `that is TAGS-02, plan 07-02's job` |
| `orchestrators/plugin/install-outcome.ts:183, 490` | `(07-marketplace-repo-tag-resolution)` |
| `orchestrators/plugin/install-cascade.ts:583` | `(07-marketplace-repo-tag-resolution plan 07-01)` |
| `tests/architecture/marketplace-tag-probe-offline.test.ts:2` | `(07-marketplace-repo-tag-resolution)` |
| `tests/architecture/gate-targets.ts:437, 651` | `(07-marketplace-repo-tag-resolution)` |
| `tests/architecture/dependency-doc-agreement.test.ts:23, 338` | `DIVG-01 (07-03)`, `the literal stem Task 1 commits to` |
| `tests/integration/path-source-tag-install.test.ts:3, 405` | `plan 07-01`, `Phase 6's load-time check` |

`domain/release-tag.ts:6-7` additionally narrates code that no longer exists ("Moved out of the
former so the local probe never imports a network leaf to reach it"), which the same rule forbids;
restate it as a present-tense fact about the current module.

**Fix:** Strip the parentheticals and plan/phase/task references, keeping the `D-07-xx` /
`TAGS-0x` / `DIVG-01` IDs, which are the sanctioned anchors. For `platform/git.ts:408`, name the
gate or the requirement that pins the `peeled ?? oid` preference instead of the UAT that once
observed it.

### WR-11: weak assertion in the peel-failure case

**File:** `tests/orchestrators/plugin/marketplace-tag-probe.test.ts:143-153`
**Issue:** The case asserts `result.kind === "tag-listing-failed"` and the `listTags` call count,
but never the `cause`. An implementation that swallowed the peel error and substituted a generic
`new Error("listing failed")` — losing the only diagnostic the arm carries — passes. Every sibling
case in the file compares the whole value with `deepStrictEqual`; this one does not.

**Fix:**

```ts
assert.deepStrictEqual(result, {
  kind: "tag-listing-failed",
  cause: new Error("cannot peel formatter--v1.0.0"),
});
assert.strictEqual(fake.listTagsCalls.length, 1);
```

## Info

### IN-01: the reason-count narrative contradicts itself

**File:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts:50-65`
**Issue:** The running arithmetic says `dependents unsatisfied` moved the count "(57 to 58)", then
that D-06-07's retirement means "the two cancel, which is why the count ends this phase where the
sentence before it left off" — i.e. 57 — and then that `dependency current copy` moved it "(58 to
59)". The tuple really holds 59 entries and `notify-closed-set-locks.test.ts:96` pins 59, so the
"two cancel" sentence is the wrong half. A reader adding the next member inherits an off-by-one
narrative in the file that calls itself the source of catalog truth.

**Fix:** Reword so the cancel sentence lands on 58, matching the lock test's own comment at
`notify-closed-set-locks.test.ts:86-92`.

### IN-02: test doubles named after their kind

**File:** `tests/orchestrators/plugin/marketplace-tag-probe.test.ts:24-55`
**Issue:** `FakeSeam`, `createFakeSeam`, `FakeSeamOptions` and the local `fake` name the double by
its construction rather than its role, which `skills/typescript-unit-testing-review` calls out
("no `mock`/`fake`/`stub` in the name; how it is created shows the kind"). The object is also a
hybrid: it carries `listTagsCalls` / `resolveTagOidCalls` recorders, making it a spy dressed as a
fake.

**Fix:** Rename to the role — `createTagListing` returning `{ listing, listTagsCalls, ... }` — and
keep the recorders only on the two cases that assert calls.

### IN-03: `listMarketplaceCandidateTags` duplicates `listCandidateTags`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts:87-116`
vs `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts:117-138`
**Issue:** Memo-hit short-circuit, try/listing, `memo.set`, catch/`memo.delete`, non-`Error`
wrapping — the two bodies are structurally identical and diverge only in the listing call and the
extra `classification` field. The module comment at lines 84-85 even says so ("mirroring
`dependency-tag-probe.ts::listCandidateTags`"), which is how CR-03's dead line was copied across.

**Fix:** Optional. If the duplication is kept deliberately (the two probes must stay
transport-independent), say that in the comment instead of pointing at the module that was copied.

---

_Reviewed: 2026-09-19T19:24:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
