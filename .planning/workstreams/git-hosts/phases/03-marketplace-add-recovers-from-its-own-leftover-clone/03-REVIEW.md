---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
reviewed: 2026-09-27T16:48:01Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/domain/source.test.ts
  - tests/e2e/import-command.test.ts
  - tests/edge/types.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/platform/git-ops-contract.ts
  - tests/platform/git-ops-fake.test.ts
  - tests/platform/git-ops-fake.ts
  - tests/platform/git.test.ts
findings:
  critical: 1
  warning: 10
  info: 6
  total: 17
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-27T16:48:01Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the three deliverables as a unit: the new `platform/git.ts::listRemotes` primitive, the
`addGitClonedInGuard` step-4 recognize-remove-rename path, and the `ctx`-optional widening in
`orchestrators/auth-host.ts` plus its `update-preflight.ts` consumer.

Toolchain state at review time (verified, not assumed): `npm run typecheck` exit 0, `npm run lint`
exit 0, `npm run lint:type-members` exit 0 (4 recorded exceptions, none in this change),
`npm run fallow` exit 0 with no clone group or dead-code finding touching any reviewed file,
`node --test tests/platform/git.test.ts` 36/36, `node --test tests/orchestrators/marketplace/add.test.ts`
79/79.

The invariants the phase brief asked me to verify mostly hold:

- **`unwrapAddError` one-level contract holds.** Every path through `addGitClonedInGuard` passes
  through at most one `appendLeakToError` call. The clone-failure `catch` (step 1), the main
  `catch` (step 4-6), and `runAddInGuard`'s write-back `catch` are three disjoint `try` blocks that
  cannot compose, and `joinLeaks` correctly collapses the double fault into one string. The
  `MA-14 double fault` test is genuinely discriminating: a two-call implementation would both
  produce two `(additionally: ` markers and make the standalone arm re-throw raw.
- **The widened `ctx === undefined` guard does not mis-route any ctx-carrying caller.** All six
  other `buildCloneAuth`/`buildAuthForHost` call sites (`add.ts` x2, `update.ts` x2,
  `install-clone-probe.ts`, `reinstall-clone-probe.ts`, `fetch.ts`, `info.ts`) keep `ctx` declared
  REQUIRED in their own local options interface, so the optionality is confined to
  `update-preflight.ts`. On that path, `DirectThreePhaseArgs.ctx` is required and
  `CascadeThreePhaseArgs.ctx` is `?: never`, so the interactive `plugin update` still reaches the
  Device Flow and only the cascade declines. The three now-unconditional spreads are correct.
- **Recognition is not looser than the brief claims for the URL string itself.** For both source
  kinds `stripGitSuffix(networkCloneUrl(source)) === canonicalCloneUrl(source)` by construction,
  and the removal target is `locations.sourceCloneDir(derivedName)`, which already routes through
  `assertSafeName` + `assertPathInside` — a hostile `marketplace.json` `name` cannot escape
  `sources/`.

What the change does not survive is a `.git/config` that carries a `[remote "origin"]` section with
no `url` key. `listRemotes` claims `url: string` on its `origin` arm and delivers `undefined`, which
crashes the recovery path with a raw `TypeError` escaping past the orchestrator boundary (CR-01,
reproduced end to end below). That shape is exactly the truncated-config artifact the crash-window
feature exists to recover from, so the failure mode is reachable from the feature's own motivating
scenario.

The rest are maintainability and user-signal defects: a JSDoc block detached from its function, the
leftover-removal leak message computed and then discarded on the standalone command path, two
now-wrong doc claims introduced by the change, and four comment-policy violations against
`skills/typescript-comments/SKILL.md`'s "narration of code that no longer exists" rule.

## Critical Issues

### CR-01: `listRemotes` returns `url: undefined` on its `origin` arm and crashes `recognizeLeftover` with a raw `TypeError`

**File:** `extensions/pi-claude-marketplace/platform/git.ts:366-368`, consumed at
`extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:725`

**Issue:**

```ts
// platform/git.ts:366-368
const remotes = await git.listRemotes({ fs, dir: opts.dir });
const origin = remotes.find((r) => r.remote === "origin");
return origin === undefined ? { kind: "no-origin" } : { kind: "origin", url: origin.url };
```

`isomorphic-git`'s `_listRemotes` (`node_modules/isomorphic-git/index.cjs:13043-13053`) enumerates
remote SUBSECTIONS and then looks up each `remote.<name>.url` independently:

```js
const remoteNames = await config.getSubsections('remote');
const remotes = Promise.all(remoteNames.map(async remote => {
  const url = await config.get(`remote.${remote}.url`);   // allValues.pop() -> undefined when absent
  return { remote, url }
}));
```

A `[remote "origin"]` section with no `url` key therefore yields `{ remote: "origin" }` — `url`
absent. `origin === undefined` is false, so the wrapper takes the `origin` arm and returns
`{ kind: "origin", url: undefined }`, violating its own declared
`{ readonly kind: "origin"; readonly url: string }`. The compiler cannot catch it because
isomorphic-git's `index.d.ts:2032-2034` declares `url: string` and the runtime does not honour it.

Reproduced against the real code (not the fake), with a `.git/config` holding only a `fetch` line
under `[remote "origin"]`:

```
listRemotes -> {"kind":"origin"} url typeof: undefined
THROWS: TypeError Cannot read properties of undefined (reading 'endsWith')
```

The throw comes from `add.ts:725`, `stripGitSuffix(remotes.url)`. Its consequences:

1. The `TypeError` propagates into `addGitClonedInGuard`'s `catch`, gets a staging cleanup and an
   `appendLeakToError` wrap, and reaches `classifyAddError`. It matches none of the four typed
   preconditions, carries no `code`, and `classifyGitSourceAccessFailure` returns `undefined` for a
   `TypeError`. So `handleAddFailure` hits `if (!orchestrated) { throw err; }` — a raw `TypeError`
   escapes past the orchestrator, which is exactly what the ATTR-07 discipline this file documents
   forbids. In orchestrated/reconcile mode it is silently mislabelled `"unparseable"` instead of
   `"stale clone"`.
2. The destination is left in place, so the leftover is neither recognized nor refused cleanly —
   every retry crashes the same way.

Reachability is not theoretical. isomorphic-git's clone writes `remote.origin.url` and
`remote.origin.fetch` through `GitConfigManager.save`, which rewrites the whole file; a crash or a
short write during that rewrite is precisely the interrupted-add artifact this phase set out to
recover from. A truncated config (`[remote "origin"]` with nothing after it) reproduces identically
— I verified both shapes.

**Fix:** treat a missing `url` as a non-recognizable tree at the platform boundary, so the type
contract the orchestrator relies on is true:

```ts
const remotes = await git.listRemotes({ fs, dir: opts.dir });
// isomorphic-git's declaration says `url: string`, but `_listRemotes` enumerates `[remote "..."]`
// SUBSECTIONS and resolves `remote.<name>.url` separately, so a section with no `url` key yields
// `{ remote: "origin" }` with `url` absent. A section that names no url identifies no remote.
const origin = remotes.find((r) => r.remote === "origin");
return origin === undefined || typeof origin.url !== "string" || origin.url === ""
  ? { kind: "no-origin" }
  : { kind: "origin", url: origin.url };
```

`no-origin` is the right arm: `recognizeLeftover` already refuses it as `StaleSourceCloneError`,
which is the conservative outcome (no removal, clean `{stale clone}` row, leftover preserved). Add
the paired coverage described in WR-10.

## Warnings

### WR-01: `addGitClonedInGuard`'s JSDoc now documents `recognizeLeftover`'s position; the function itself is undocumented

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:689-714`

**Issue:** `recognizeLeftover` was inserted BETWEEN the existing `addGitClonedInGuard` doc block and
its function. The file now has two consecutive `/** ... */` blocks at lines 689-701 and 702-714,
with only the second one attached to a declaration:

```
689 /**
690  * Shared clone-into-guard body for git-cloned marketplace sources (github and
    ...  Owns everything from staging-dir creation through the clone, manifest
    ...  read, MA-8 duplicate check, MA-6 stale-clone check, atomic rename, ...
701  */
702 /**
703  * MA-12/MA-13 (D-3-01, D-3-02): recognize whether `finalDir` is ...
714  */
715 async function recognizeLeftover(
    ...
739 async function addGitClonedInGuard(args: {
```

The first block is now dead documentation: it describes `addGitClonedInGuard` (naming its staging
lifecycle, its MA-9 discipline, and the GAUTH-03 auth contract) but sits above `recognizeLeftover`,
and `addGitClonedInGuard` at line 739 has no doc comment at all. It also still says "MA-6
stale-clone check", which is no longer what step 4 does.

**Fix:** move `recognizeLeftover` (and its own block) ABOVE line 689, leaving the
`addGitClonedInGuard` block adjacent to its declaration, and update its step list to name the
recognize-remove-rename behaviour:

```ts
/** MA-12/MA-13 (D-3-01, D-3-02): recognize whether `finalDir` is ... */
async function recognizeLeftover(...) { ... }

/**
 * Shared clone-into-guard body for git-cloned marketplace sources (github and
 * url). Owns everything from staging-dir creation through the clone, manifest
 * read, MA-8 duplicate check, MA-6/MA-12/MA-13 leftover recognition, atomic
 * rename, state mutation, and the MA-9 append-leak-not-mask cleanup catch.
 * ...
 */
async function addGitClonedInGuard(args: { ... }) { ... }
```

### WR-02: the leftover-removal leak is computed, joined, attached, and then discarded on the standalone command path

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:818-820` and `522-533`

**Issue:** When `recognizeLeftover` half-removes a recognized leftover, `leftoverLeak` carries
`failed to clean up marketplace leftover clone <finalDir>: <errno>` and is joined onto the thrown
error by `appendLeakToError`. `appendLeakToError`'s own contract
(`shared/errors.ts:210-217`) is "so the user sees the original cause AND the manual-cleanup hint in
the same notification". That does not happen here. `handleAddFailure` builds the standalone row
from `{ name, scope, status, reasons, severity, plugins }` only, `MpFailed`
(`shared/notification-types.ts:542-547`) has no `cause` slot, and `notifyWithContext` is called with
`advisories` omitted. The phase's own test pins the loss:

```ts
assert.equal(
  note.message,
  "A marketplace operation has failed.\n\n⊘ valid-marketplace [project] (failed) {stale clone}",
);
```

Before this phase the only leak that could be lost this way was a `sources-staging/<uuid>` tree the
user never sees. Now the discarded message is the only signal that `sources/<name>` — the path the
`{stale clone}` row is implicitly telling the user to inspect — has been PARTIALLY DELETED by the
extension. A user who reads "stale clone" and deletes the directory themselves is fine; a user who
investigates will find a half-removed tree with no explanation.

**Fix:** surface the leak on the standalone path through the `advisories` seam
`notifyWithContext` already accepts (`shared/notify-context.ts:162`):

```ts
function handleAddFailure(opts, err, orchestrated): AddMarketplaceOutcome {
  ...
  if (!orchestrated) {
    const leakAdvisory = leakAdvisoryFor(err); // the "(additionally: ...)" tail, when present
    notifyWithContext(
      opts.ctx, opts.pi, ADD_CONTEXT, failedRows, undefined, "single",
      leakAdvisory === undefined ? undefined : [leakAdvisory],
    );
  }
```

and extend the MA-14 standalone assertion to pin the advisory line.

### WR-03: a user-placed clone of the same repository under `sources/<name>` is recognized and removed unconditionally

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:722-731`

**Issue:** Recognition asks one question — does `origin` byte-equal the canonical URL — and answers
"this is mine, remove it". It cannot distinguish the extension's own abandoned clone from a clone of
the same repository that a human put there. Both have the same `origin`: real `git clone
https://github.com/owner/repo.git` records `https://github.com/owner/repo.git`, which strips to the
canonical form and matches. A user who checked the marketplace repo out under `sources/<name>` to
edit `marketplace.json` locally loses uncommitted work on the next `marketplace add`, with no
prompt, no backup, and (per WR-02) no message. Before this phase that case refused and the work
survived.

Nothing in the removal path consults working-tree state: there is no dirty-worktree probe, no
untracked-file probe, no stash, and `cleanupStaging` is an unconditional
`rm(dir, { recursive: true, force: true })`.

I accept that D-3-02 records the decision that a matching `origin` under `sources/` is the
extension's own. The gap is that the decision is enforced with zero corroboration and zero
reversibility.

**Fix:** corroborate the claim before destroying the tree. The cheapest corroboration that needs no
new `GitOps` member is to require the destination to be structurally an extension clone — e.g. a
present `.claude-plugin/marketplace.json` and no additional top-level entries the extension never
writes — and to refuse (`StaleSourceCloneError`) otherwise. If a stronger guarantee is wanted, add a
`statusMatrix`-backed cleanliness probe to `GitOps` and refuse a dirty tree. Either way the refusal
arm already exists and is already tested, so the change is additive.

### WR-04: recognition resolves through a symlinked destination that the removal will not traverse

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:788-789`,
`extensions/pi-claude-marketplace/platform/git.ts:356`

**Issue:** The gate is `pathExists(finalDir)`, which is documented as `lstat`-based and deliberately
NOT symlink-following ("consistent with PS-1 refuse all symlinks", `shared/fs-utils.ts:126-129`). It
returns `true` for a symlink. `listRemotes` then does
`fs.promises.readFile(path.join(opts.dir, ".git", "config"))`, which DOES follow the symlink, so the
recognition verdict is read from whatever tree the link points at. `cleanupStaging`'s
`fs.rm(..., { recursive: true })` then `lstat`s the path, sees a non-directory, and `unlink`s the
link only — never the tree it was judged by.

So the decision surface and the removal surface are two different directories. Today the outcome is
benign (the link is removed, the fresh clone is renamed in, the target is untouched), but the
asymmetry is undocumented and one refactor away from being harmful: any future change that resolves
the link before removing, or that reuses `recognizeLeftover` on a path it then `rm -rf`s by realpath,
silently becomes an arbitrary-directory delete keyed on an attacker-choosable `origin`.

**Fix:** refuse a symlinked destination explicitly, before recognition, so PS-1 holds on this path
too:

```ts
finalDir = await locations.sourceCloneDir(derivedName);
const destination = await lstatOrUndefined(finalDir);
if (destination !== undefined) {
  // PS-1: recognition reads `<dir>/.git/config` through the link while removal only unlinks it,
  // so a symlinked destination is never a recognizable leftover.
  if (destination.isSymbolicLink()) {
    throw new StaleSourceCloneError(finalDir, derivedName);
  }

  leftoverLeak = await recognizeLeftover(finalDir, derivedName, source, gitOps, removalOps);
  ...
}
```

### WR-05: `GitOps`'s own JSDoc still says "Seven primitives" after `listRemotes` became the eighth

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:129`

**Issue:** The change updated the module header (line 5, "Eight primitives ... + listRemotes") but
left the `GitOps` interface doc contradicting itself: line 129 opens with "Seven primitives." and
lines 138-140 of the same block then say "D-3-03 added an 8th -- `listRemotes`". The count is the
first thing a reader checks against the member list.

**Fix:**

```ts
 * Eight primitives. The 5 base primitives (clone / fetch / forceUpdateRef
```

### WR-06: the `add.ts` module flow header still documents an unconditional pre-clone stale-clone refusal

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:13`

**Issue:** The header is the first thing a reader of this 997-line orchestrator reads, and it now
describes behaviour the file no longer has:

```
//       MA-6  stale-clone check on final sources/<derivedName>/  (BEFORE clone)
//       MA-8  duplicate-name check on state.marketplaces[<derivedName>]
//       gitOps.clone(stagingDir)
```

Two claims are false. The ordering was already wrong before this phase (the check is step 4, after
the clone and after the manifest read), but this phase made the second claim wrong too: MA-6 is no
longer a "check", it is a recognize-remove-rename that can DELETE the destination. The one line in
the file that tells a reader the destination may be destroyed is 773 lines below the summary that
says it is only inspected.

**Fix:**

```
//       gitOps.clone(stagingDir)                            // network -- gated by NFR-5
//       read + MARKETPLACE_VALIDATOR.Check(<staging>/.claude-plugin/marketplace.json)
//       MA-8   duplicate-name check on state.marketplaces[<derivedName>]
//       MA-6/MA-12/MA-13  recognize-remove-rename on final sources/<derivedName>/:
//              an `origin` matching canonicalCloneUrl(source) is removed; every
//              other arm throws StaleSourceCloneError
//       fs.rename(stagingDir, finalDir)                     // atomic, same-FS by D-09
```

### WR-07: four comments narrate code that no longer exists, against the project comment policy

**Files:**
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:149-155`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:786`
- `tests/orchestrators/plugin/update-preflight.test.ts:703`
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:177-178`

**Issue:** `skills/typescript-comments/SKILL.md` forbids "Narration of code that no longer exists...
drop `the former X`, `X used to ...`, `X no longer ...`, `Pre-fix, X ...`, `byte-identical to the
former X`", and separately forbids `not X but Y` framing. All four hits are new or newly edited in
this change:

1. `update-preflight.ts:149-155` — "No local builder is kept here: ... rather than needing its own
   undefined-returning wrapper" narrates the deleted `buildBundle` closure.
2. `add.ts:786` — "Every other outcome throws exactly as before (MA-13)" is the explicitly-named
   "byte-identical to what came before" shape; the policy says name the gate or say nothing.
3. `update-preflight.test.ts:703` — "instead of the pre-fix code's silent authless clone" is the
   literal `Pre-fix, X ...` form.
4. `auth-host.ts:177-178` — "Declining is the correct behaviour here, not a fallback" is negative
   parallelism.

**Fix:** restate each as a present-tense fact about the current code:

```ts
// update-preflight.ts
/**
 * `buildCloneAuth` (`auth-host.ts`) supplies the host-bound auth bundle for both arms below. It
 * accepts an absent notification context, which is the shape the cascade calls this probe with
 * (D-3-04).
 */

// add.ts:786
// state (D-3-02). Every other arm throws StaleSourceCloneError (MA-13).

// update-preflight.test.ts:703
// seam arms authenticate against a registry host with no notification context.

// auth-host.ts:177-178
// user code. The correct behaviour here is to decline.
```

### WR-08: `recognizeLeftover` takes five positional parameters against the file's args-object convention

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:715-721`

**Issue:** Every other multi-argument helper in this file takes a named args object
(`runAddInGuard(args: {...})`, `addGitClonedInGuard(args: {...})`, `addGithubInGuard(args: {...})`,
`addUrlInGuard(args: {...})`, `addPathInGuard(args: {...})`). The new function breaks that with five
positional parameters, the first two of which are adjacent same-typed strings
(`finalDir`, `derivedName`) threaded straight into a destructive `rm` and an error subject.
`skills/typescript-google-style-review/SKILL.md` also calls for a destructured options object when
several parameters have no natural order.

**Fix:**

```ts
async function recognizeLeftover(args: {
  finalDir: string;
  derivedName: string;
  source: GitHubSource | UrlSource;
  gitOps: GitOps;
  removalOps: RemovalOps;
}): Promise<string | undefined> {
  const { finalDir, derivedName, source, gitOps, removalOps } = args;
  ...
}
```

### WR-09: each MA-14 test runs two complete act/assert cycles in one case

**File:** `tests/orchestrators/marketplace/add.test.ts:700-783` and `785-887`

**Issue:** Both MA-14 cases call `addMarketplace` twice — once in standalone mode to pin the notify
row, once in orchestrated mode to pin the leak text — with a full assert block after each. Per
`skills/typescript-unit-testing-review/SKILL.md` a case marks `// arrange` / `// act` / `// assert`
once and in order; here the markers repeat, and a failure in the standalone half aborts before the
orchestrated half runs, so the two behaviours are not independently reported. The double-fault case
additionally carries inter-act repair logic (`await chmod(stagingRoot, 0o755)` between the two
invocations, because the first case's `onClone` left the tree read-only), which is state coupling
between two things that should be separate cases.

**Fix:** split each into two `test()` cases (standalone-row and orchestrated-outcome) sharing a
`seedUnremovableLeftover()` arrange helper, so each case has one act, one assert block, and no
cross-act repair step.

### WR-10: no test covers the `[remote "origin"]`-without-`url` config shape behind CR-01

**File:** `tests/platform/git.test.ts:856-911`, `tests/orchestrators/marketplace/add.test.ts:544-643`

**Issue:** The new `listRemotes` describe block covers four arms (`origin` with a url, `not-a-repo`,
`no-origin` via a repo with no remote, `unreadable` via `chmod 0o000`). None writes a `.git/config`
that declares `[remote "origin"]` without a `url` key, which is the one input that makes the wrapper
return a value its own type forbids. On the orchestrator side the MA-13 refusal table drives
`listRemotes` entirely through `createGitOpsFake`'s canned `listRemotesResult`, which is typed
`ListRemotesResult` and therefore cannot express `url: undefined` at all — the fake's type safety is
what hides the real adapter's type violation. The 100%-branch gate cannot help: the missing
behaviour is a missing branch, not an uncovered one.

**Fix:** add a real-filesystem case beside the existing four, written against the hand-authored
config rather than through `git.addRemote`:

```ts
test("reports no-origin for a remote section that declares no url", async (t) => {
  // arrange
  const repository = await createGitTestRepository(t, { boundary: "local" });
  await writeFile(
    path.join(repository.dir, ".git", "config"),
    '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
  );

  // act
  const remotes = await listRemotes({ dir: repository.dir });

  // assert
  assert.deepStrictEqual(remotes, { kind: "no-origin" });
});
```

## Info

### IN-01: the new permission-based tests pass vacuously as root

**File:** `tests/platform/git.test.ts:899`, `tests/orchestrators/marketplace/add.test.ts:715`, `:797`

**Issue:** `chmod(configPath, 0o000)` and `chmod(locations.sourcesDir, 0o555)` are the only levers
that produce the `unreadable` arm and the MA-14 leak arms. Root ignores both, so all three cases
assert their happy-path expectations against a run that never faulted, and they FAIL rather than skip
under a root container. The repo already has the guard idiom in two modules
(`tests/orchestrators/plugin/workflows-staging-gc.test.ts:76`,
`tests/orchestrators/reconcile/apply.test.ts:256`) and many other `0o000` tests without it, so this
matches the majority convention — but these three cases are the sole coverage for their branches.

**Fix:** guard the three cases with the existing idiom:

```ts
if (typeof process.getuid === "function" && process.getuid() === 0) {
  t.skip("root bypasses the permission fault this case needs");
  return;
}
```

### IN-02: `stripGitSuffix`'s parameter is named `path` although it takes a URL

**File:** `extensions/pi-claude-marketplace/domain/source.ts:462`

**Issue:** The function went from module-local to exported, so `stripGitSuffix(path: string)` is now
part of the published surface while its own JSDoc describes the argument as "a URL" and every caller
passes a full `https://` URL or a git `origin` value. `path` additionally collides with the
`node:path` namespace import that most callers of this function have in scope.

**Fix:** `export function stripGitSuffix(url: string): string`.

### IN-03: the MA-14 leak assertions check substrings rather than the whole value

**File:** `tests/orchestrators/marketplace/add.test.ts:764-773`, `:866-881`

**Issue:** `outcome.cause` is the whole promise of these cases, and it is asserted with three
`.includes()` probes plus a marker count instead of `assert.strictEqual`. The unit-testing policy
treats "asserting one property at a time when the whole value is the promise" as a finding. The
constraint is real — the staging path embeds a `randomUUID()` — but it is reducible: the staging
segment is the only unpredictable part.

**Fix:** capture the staging path (the fake already receives it in `onClone`) and compare the full
string, or normalize only the uuid segment before a `strictEqual`.

### IN-04: the `else if (finalDir !== undefined)` cleanup arm silently drops `leftoverLeak`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:821-828`

**Issue:** `leftoverLeak` is joined only in the `!stagedAtFinal` arm. That is correct today because a
non-undefined `leftoverLeak` always throws before `stagedAtFinal` is set, so the second arm is
unreachable with a leak pending — but nothing in the code says so, and the arm reads as a place where
a leak is simply forgotten. A future edit that moves the rename earlier, or that continues past a
leftover leak, loses the message with no compiler or test signal.

**Fix:** join unconditionally, so the invariant costs nothing to maintain:

```ts
} else if (finalDir !== undefined) {
  const leak = await cleanupStaging(removalOps, finalDir, `marketplace final clone ${finalDir}`);
  wrapped = appendLeakToError(wrapped, joinLeaks(leftoverLeak, leak));
}
```

### IN-05: a case-differing re-type of the same source cannot recognize its own leftover, and the row gives no hint

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:725`

**Issue:** Byte equality with no case folding (D-3-01) is the right default, and I am not asking for
folding. The consequence worth recording is that GitHub is case-insensitive, so `anthropics/Repo`
and `anthropics/repo` clone the same repository and derive the same marketplace name and the same
`sources/<name>` — yet a leftover from the first is unrecognizable to the second. The user then gets
`(failed) {stale clone}` on a directory the extension itself created, with nothing in the row or the
cause telling them that retrying with the original capitalization would recover. The MA-13 table pins
this as intended behaviour but not the diagnosability gap.

**Fix:** no behaviour change. Either record the limitation in the `recognizeLeftover` docstring
(current comment says only "after one trailing `.git` strip"), or extend `StaleSourceCloneError` with
the observed `origin` so the cause line can name both strings and let the user see the difference.

### IN-06: `pathExists` and `listRemotes` are two reads of the same destination

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:788-789`

**Issue:** `pathExists(finalDir)` and the `.git/config` read inside `listRemotes` are separate
syscalls, and `git.listRemotes` re-reads the same file a third time. A destination that disappears
between the first and second read classifies as `not-a-repo` and refuses with `{stale clone}` even
though the destination is now free, which is a spurious failure the user cannot act on. The per-scope
state lock serializes concurrent `marketplace add` calls, so the window is only against an external
actor.

**Fix:** none required; the outcome is conservative. If the spurious refusal is worth closing, have
`listRemotes` report `not-a-repo` and let the caller re-check emptiness once before refusing.

---

_Reviewed: 2026-09-27T16:48:01Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
