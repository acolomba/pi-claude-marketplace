# Phase 3: `marketplace add` recovers from its own leftover clone - Research

**Researched:** 2026-09-27
**Domain:** git remote introspection (isomorphic-git), filesystem recovery/cleanup ordering, error-identity preservation through a leak-wrapping chain
**Confidence:** HIGH (every claim below is grounded in a direct `Read` of the pinned dependency's source, this repo's production code, or this repo's test infrastructure — no web search was used or needed; `brave_search`/`exa_search`/`firecrawl` are all `false` in `.planning/config.json`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-3-01: compare on the CANONICAL IDENTITY, not the wire form or the raw string.** Recognition
  runs `canonicalCloneUrl(source)` against the leftover's `origin` remote, normalized the same way.
  Identity is precisely the "is this the same repo" question: it is `.git`-insensitive and
  fragment-free by construction, and D-2-05 (Phase 2) just made it a fixed point, so the same source
  compares equal to itself no matter how the user typed it. The wire form was rejected because it is
  `.git`-sensitive — the same repo typed with and without `.git` would fail to match — and a
  match-either-form rule was rejected as a wider definition of "same source" than the refusal
  deserves.
- Recognition stays at the EXISTING refusal site, `orchestrators/marketplace/add.ts` step 4
  (currently lines 725-729). That position is forced, not chosen: `finalDir` derives from
  `parsed.name` in the staged manifest, so the destination is not knowable before the staging clone
  and manifest read. A retry therefore still pays one clone to discover it could reuse — accepted.
- **D-3-02: remove the leftover and rename the fresh staging clone into place.** The existing step-5
  atomic-rename path runs unchanged. The result is a known-good tree at a known ref, and the
  leftover's condition — dirty, partial, wrong ref — cannot leak into installed state. Reuse-in-place
  was rejected precisely because the WR-07 crash window that creates these directories is exactly
  when one is most likely to be partial; a conditional reuse-if-clean rule was rejected as a second
  recognition axis for no user-visible gain.
- MA-13's refusal is unchanged for every other case: not a git clone, unreadable, or an `origin`
  naming a different URL still throws `StaleSourceCloneError` and renders the `{stale clone}` row on
  the marketplace subject. Recognition must never widen into overwriting a directory the extension
  did not create.
- **MA-14 (SC3):** when a RECOGNIZED leftover cannot be fully removed, the add fails as stale with
  the cleanup leak appended per the existing MA-9 discipline (`cleanupStaging` +
  `appendLeakToError`), and state records no destination for the partially-removed tree.
- **D-3-03: `GitOps.listRemotes` returns a DISCRIMINATED VALUE, not a throw and not `undefined`.**
  "No origin", "not a git repo" and "unreadable" must be separate, inspectable outcomes so the MA-6
  refusal reads as an explicit branch rather than a catch, and so each arm is directly testable. This
  follows the codebase's own precedent for exactly this distinction — `ManifestLookup` (D-96-02) and
  the resolver's three-way state. `listRemotes` is the only `GitOps` member that does not throw on
  failure; the other seven do — deliberate, and should be stated where the member is declared.
- **D-3-04: FIX the autoupdate cascade (SC5) in this phase, do not file it.**
  `orchestrators/plugin/update-preflight.ts::buildBundle` returns `undefined` when
  `auth.ctx === undefined`, and `update-flow.ts::updateSinglePluginWith` never passes a `ctx`, so the
  cascade clones authless on every host. The fix is narrow because `buildAuthForHost`'s no-provider
  arm never reads `ctx` — only the Device Flow arm does — so the `ctx` requirement is real for
  github.com/gitlab.com and spurious everywhere else. This is PRE-EXISTING and host-agnostic, not a
  Phase 1 regression.

### Claude's Discretion

- The exact shape of the `listRemotes` discriminated value (field names, whether the failure arm
  carries an `errno`), and whether recognition lives inline in `addGitClonedInGuard` or in a named
  helper beside it.
- Whether the SC5 fix makes `ctx` optional on `buildAuthForHost` or threads a ctx through the
  cascade — whichever keeps the Device Flow arm's contract intact with fewer touched call sites.
- Plan/wave decomposition, subject to the one-edit-at-a-time constraint (the
  `scripts/check-unused-type-members.contracts.json` pins are line:col, so ROADMAP mandates one edit
  at a time through the shared `GitOps`/`platform/git.ts` seam).

### Deferred Ideas (OUT OF SCOPE)

- **Phase 1 and Phase 2's live canaries (SC6).** Both are deferred to the operator and recorded in
  `STATE.md` § Deferred Verification with resume commands. They block MILESTONE CLOSE only. Phase 3
  should carry them forward explicitly rather than attempt them; neither is closable on this machine
  (Phase 1 needs an operator PAT, Phase 2 needs a real verbatim-only smart-HTTP server).
- **The six Info findings from Phase 2's code review** (IN-01..IN-06) remain open by scope decision,
  recorded in `02-REVIEW-DISPOSITION.md`. Not this phase's work unless a plan touches the same lines.
- **Sweeping the orphaned `plugin-clones/` directory** left by D-2-05's one-time re-clone. Out of
  scope here — GC is derive-at-collection-time (D-77-03), and nothing actively removes the single
  stale directory, but nothing accumulates further either.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MA-12 | `marketplace add` succeeds when `sources/<name>/` already holds a leftover clone whose `origin` URL is the source being added | Architecture Patterns (Pattern 1/2, System Diagram), Common Pitfalls #1/#3, Code Examples (origin storage + `canonicalCloneUrl`), Validation Architecture requirement map |
| MA-13 | A leftover tree that is not a git clone, is unreadable, or whose `origin` names a different URL still refuses with `{stale clone}` | Common Pitfalls #1 (isomorphic-git never throws for these cases — the seam must probe fs directly), Pitfall #4 (fixture construction for each arm), Validation Architecture requirement map |
| MA-14 | When the leftover clone cannot be fully removed, the add fails as stale with the cleanup leak appended, and no partially-removed destination is recorded in state | Common Pitfalls #2 (the one-level `unwrapAddError`/`appendLeakToError` cause-chain constraint — the central risk for this requirement), Don't Hand-Roll (`cleanupStaging` reuse), Validation Architecture requirement map |
| GATE-01 | Every type member this milestone introduced is read by production code or recorded in the exceptions file; `npm run check` passes whole including 100% coverage | Common Pitfalls #6 (pin drift by file, and how SC5's two candidate fixes differ in pin blast radius), Validation Architecture Branch Enumeration (sizes the new-test burden), Gate exposure findings throughout |
</phase_requirements>

## Summary

Phase 3 hangs on one fact nobody had measured yet: **isomorphic-git 1.42.2's `listRemotes` does not throw for the failure modes D-3-03 names.** For a directory with no `.git`, a `.git/config` that cannot be read (permission denied), or a `.git` that is a stray file, `git.listRemotes({fs, dir})` resolves successfully with `[]` — indistinguishable, at that layer, from a genuine git repo with zero remotes configured. This is not a version quirk; it is architectural: `FileSystem.read` (isomorphic-git's internal fs wrapper) catches every error unconditionally and returns `null`, and `GitConfig(null)` parses to an empty config with no thrown diagnostic anywhere in the chain. D-3-03's three-arm ("no origin" / "not a git repo" / "unreadable") discriminated value therefore cannot be built by inspecting what isomorphic-git throws — `platform/git.ts::listRemotes` must do its own `fs.stat`/`fs.readFile` probing on `<dir>/.git` *before* delegating to isomorphic-git, and treat isomorphic-git's own call as authoritative only for the "how many remotes, and is one of them origin" question once existence and readability are independently established.

The second load-bearing fact: `platform/git.ts::clone()` passes `opts.url` to `git.clone()` **verbatim** — isomorphic-git's `addRemote`-equivalent step inside `clone` stores exactly that string as `remote.origin.url` in the new repo's `.git/config`. Since `add.ts` calls `gitOps.clone({ url: networkCloneUrl(source), ... })`, a leftover's stored `origin` is always in **wire form** (`.git`-suffixed for github sources, whatever the user typed for url sources), never in the **identity form** `canonicalCloneUrl` produces. The two forms differ by exactly one thing — a trailing `.git` — so recognition reduces to a single normalization step (strip a trailing `.git` from the origin, then compare byte-for-byte to `canonicalCloneUrl(source)`), not a full re-parse of the origin as a new source.

Third: `orchestrators/marketplace/add.ts`'s own `unwrapAddError` helper already documents and handles the exact "leak wrapped a typed precondition error" shape MA-14 needs — but only for **one level** of `Error.cause`. If the new leftover-cleanup leak and the existing staging-cleanup leak both fire on the same failed add, chaining them through `appendLeaks` produces a two-level cause chain that `unwrapAddError` cannot see through, silently breaking the `{stale clone}` classification. This is a real, testable edge case, not a hypothetical.

Fourth, and previously unflagged: `tests/platform/git.test.ts` already carries `@ts-expect-error` negative controls asserting that `GitPlatform.listRemotes` and `GitPlatform.ListRemotesOptions` do **not** exist today (lines 895–899). Adding the real `listRemotes` export will make those two directives themselves fail to compile (an "unused `@ts-expect-error`" TS2578, exactly as this file's own neighboring comment describes for a sibling case). This file's edit is mandatory, not optional, and is exactly the "suite asserts the opposite of the goal" failure class this project has been burned by three times this milestone.

**Primary recommendation:** implement `listRemotes` in `platform/git.ts` with its own fs-level existence/readability probe ahead of any isomorphic-git call; compare origins in `add.ts` (orchestrator tier, which can import `domain/`) using a single exported `.git`-suffix-stripping leaf reused from `domain/source.ts`; keep the leftover-removal leak and the staging-removal leak from ever nesting two `Error.cause` levels deep; and budget explicit edits to `tests/platform/git.test.ts`'s negative controls, `tests/platform/git-ops-contract.ts`'s shared case list, and `tests/platform/git-ops-fake.ts`'s fake implementation as first-class phase work, not incidental cleanup.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read a directory's git remotes (`listRemotes`) | Platform (`platform/git.ts`) | — | Only file permitted to import isomorphic-git (D-13); must also do raw `fs` probing isomorphic-git itself won't do |
| Decide "is this the same source" (origin-vs-`canonicalCloneUrl` comparison) | Orchestrator (`orchestrators/marketplace/add.ts`) | Domain (`domain/source.ts` leaf) | `platform` zone may import only `shared` per `.fallowrc.json` boundaries — it cannot reach `domain/clone-key.ts::canonicalCloneUrl` or any `.git`-stripping helper, so the comparison cannot live in `platform/git.ts` |
| Remove a recognized leftover before rename (D-3-02) | Orchestrator (`add.ts`, via injected `RemovalOps`) | — | Reuses the existing `cleanupStaging` port; no new removal mechanism |
| Leak-append discipline on a failed removal (MA-14) | Orchestrator (`add.ts`) | Shared (`shared/errors.ts::appendLeakToError`/`appendLeaks`) | Existing MA-9 mechanism; MA-14 is a new caller, and the cause-chain depth constraint is enforced at the call site, not in `shared/errors.ts` |
| Cascade auth bundle construction (SC5) | Orchestrator (`orchestrators/auth-host.ts` + `orchestrators/plugin/update-preflight.ts`) | — | No platform-tier change needed; `ctx` optionality is a pure type/branch change |
| Test doubles for the new seam member | Test infra (`tests/platform/git-ops-fake.ts`, `tests/platform/git-ops-contract.ts`) | — | Both are shared across the fake and the real implementation's own test file |

## Standard Stack

No new external dependency is introduced by this phase. `isomorphic-git` is already pinned.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| isomorphic-git | `^1.41.8` pinned in `package.json`; `1.42.2` installed [VERIFIED: node_modules/isomorphic-git/package.json] | Provides `git.listRemotes({fs, dir, gitdir?})`, already exported at `index.js:18019` and typed at `index.d.ts:2028-2032` | Already the project's sole git implementation (D-18/D-19/D-21); adding `listRemotes` extends the existing wrapper, no new dependency |

**Version verification:** `node_modules/isomorphic-git/package.json` reports `"version": "1.42.2"` [VERIFIED: node_modules/isomorphic-git/package.json — `"version": "1.42.2"`], which satisfies the `^1.41.8` semver range already in `package.json`. `git.listRemotes` has existed in isomorphic-git's public API since well before this range; no version bump is required.

**Installation:** none required — `listRemotes` is already exported by the installed package; only the local wrapper `platform/git.ts` needs a new function.

## Package Legitimacy Audit

Not applicable. This phase adds zero external packages. The only "new" surface is a wrapper function around an already-installed, already-vetted dependency (`isomorphic-git`).

## Architecture Patterns

### System Architecture Diagram

```
 marketplace add <source>
        │
        ▼
 addGitClonedInGuard (orchestrators/marketplace/add.ts)
        │
        ├─1─▶ gitOps.clone(stagingDir, networkCloneUrl(source))         [existing]
        │
        ├─2─▶ loadMarketplaceManifest(stagingDir)  ──▶ derivedName      [existing]
        │
        ├─3─▶ MA-8 duplicate-name check                                [existing]
        │
        ├─4─▶ finalDir = locations.sourceCloneDir(derivedName)
        │     pathExists(finalDir)?
        │         │
        │         ├─ NO  ──▶ step 5 (rename) unchanged                  [existing]
        │         │
        │         └─ YES ─▶ gitOps.listRemotes({ dir: finalDir })  ◀── NEW SEAM MEMBER
        │                       │  (platform/git.ts; does its own fs.stat
        │                       │   probe on <finalDir>/.git BEFORE calling
        │                       │   isomorphic-git, because isomorphic-git
        │                       │   itself never throws for "not a repo" or
        │                       │   "unreadable" — see Common Pitfalls #1)
        │                       ▼
        │                4-arm discriminated result
        │                (origin url | no-origin | not-a-repo | unreadable)
        │                       │
        │            origin present?  strip trailing ".git", compare
        │            byte-for-byte to canonicalCloneUrl(source)          ◀── D-3-01 comparison,
        │                       │                                            lives in add.ts
        │            ┌──────────┴───────────┐                               (orchestrator tier;
        │            │                      │                                platform/ cannot
        │         MATCH                 NO MATCH /                          import domain/)
        │            │                  any other arm
        │            ▼                      ▼
        │   cleanupStaging(finalDir)   throw StaleSourceCloneError    [MA-13, existing
        │      (D-3-02 removal)         (finalDir, derivedName)        error type reused]
        │            │
        │      leak? ─┼─ NO  ──▶ step 5 (rename) proceeds normally     [MA-12]
        │            │
        │            └─ YES ─▶ throw StaleSourceCloneError with the
        │                       leak folded into ITS OWN construction,
        │                       NOT via a second appendLeakToError      [MA-14 — see
        │                       wrap (keeps cause-chain at ONE level     Common Pitfalls #2]
        │                       so unwrapAddError still classifies it
        │                       as {stale clone})
        │
        └─5─▶ mkdir + rename(stagingDir, finalDir)                      [existing, unchanged]
```

### Recommended Project Structure

No new files are required. Every touch point is an edit to an existing file:

```
extensions/pi-claude-marketplace/
├── orchestrators/marketplace/
│   ├── shared.ts          # GitOps interface gains an 8th member: listRemotes
│   └── add.ts             # addGitClonedInGuard step 4 becomes a 3-way branch;
│                           # new small comparison helper (inline or named, Claude's
│                           # discretion per CONTEXT.md)
├── orchestrators/plugin/
│   ├── update-preflight.ts  # makeUpdateCloneProbe's local buildBundle — SC5
│   └── auth-host.ts         # buildAuthForHost's `ctx` becomes optional — SC5
├── platform/
│   └── git.ts              # new listRemotes() implementation + CloneOptions-sibling
│                             # ListRemotesOptions / ListRemotesResult exported types
└── domain/
    └── source.ts            # stripGitSuffix (currently module-private) may need
                              # export, OR add.ts inlines an equivalent one-liner
                              # (Claude's discretion; see Common Pitfalls #3)

tests/platform/
├── git.test.ts              # MUST remove the listRemotes/ListRemotesOptions
│                             # @ts-expect-error negative controls (lines 895-899);
│                             # add real listRemotes cases (origin/no-origin/
│                             # not-a-repo/unreadable) using createGitTestDirectory
│                             # and createGitTestRepository
├── git-ops-contract.ts      # shared GIT_OPS_CASE_NAMES + gitOpsContractCases —
│                             # extend if listRemotes should be part of the
│                             # production/fake parity contract (recommended)
└── git-ops-fake.ts          # createGitOpsFake gains a listRemotes implementation
                              # (new GitOpsFakeOptions field to configure the
                              # canned discriminated result per test)

tests/orchestrators/marketplace/
└── add.test.ts              # new MA-12/MA-13/MA-14 cases; local createGitOps()
                              # wrapper needs to pass through the new fake option
```

### Pattern 1: fs-first, isomorphic-git-second existence probing

**What:** Before calling `git.listRemotes`, `platform/git.ts`'s new function must independently determine whether `<dir>/.git` exists and is readable, because isomorphic-git's own call will not distinguish these cases (see Common Pitfalls #1).

**When to use:** Any time isomorphic-git is asked to introspect a directory that is not guaranteed to be a git repository — which is exactly NFR-5's stated tolerance requirement for this new seam member ("the new seam must tolerate [a non-git directory] without violating the boundary" — CONTEXT.md, Established patterns).

**Example (sketch, not verbatim production code — the exact discriminant shape is Claude's discretion):**
```typescript
// platform/git.ts — sketch only; field names/shape are Claude's discretion (CONTEXT.md)
export type ListRemotesResult =
  | { readonly kind: "origin"; readonly url: string }
  | { readonly kind: "no-origin" }
  | { readonly kind: "not-a-repo" }
  | { readonly kind: "unreadable" };

export async function listRemotes(opts: { dir: string }): Promise<ListRemotesResult> {
  const gitDir = path.join(opts.dir, ".git");
  try {
    await fsPromises.access(gitDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { kind: "not-a-repo" };
    }
    return { kind: "unreadable" };
  }
  // .git exists and is at least stat-able; isomorphic-git's own read of
  // .git/config is what actually determines readability of the CONTENT —
  // and per Pitfall #1, isomorphic-git swallows that failure into [] too,
  // so an explicit content-level readFile check is likely still needed here.
  const remotes = await git.listRemotes({ fs, dir: opts.dir });
  const origin = remotes.find((r) => r.remote === "origin");
  return origin === undefined ? { kind: "no-origin" } : { kind: "origin", url: origin.url };
}
```

### Pattern 2: discriminated-value precedent (`ManifestLookup`)

**What:** `domain/manifest-lookup.ts::ManifestLookup` is the exact shape precedent D-3-03 cites. It bakes the caller's specific question ("does the manifest declare this plugin?") into the type itself, rather than returning a generic collection for the caller to search.

**When to use:** For `listRemotes`, this argues for baking "is there an origin, and what is its url" directly into the return type (as sketched above) rather than returning `Array<{remote, url}>` (isomorphic-git's own generic shape) and making every caller re-search for `"origin"`.

**Example:**
```typescript
// Source: domain/manifest-lookup.ts:32-35 (verbatim)
export type ManifestLookup =
  | { readonly kind: "declared"; readonly entry: ManifestPluginEntry }
  | { readonly kind: "absent" }
  | { readonly kind: "unverified" };
```

### Anti-Patterns to Avoid

- **Trusting isomorphic-git's `listRemotes` to throw on a bad directory:** it does not (verified below). Any implementation that wraps the isomorphic-git call alone in a `try/catch` and treats a thrown error as "not a repo" will never actually observe that branch — `fallow`'s branch-coverage-100% gate would then either force a dead/uncoverable catch clause or (worse) silently pass with the branch counted covered by an unrelated `assertParameter` failure that can't occur in practice.
- **Comparing origin URLs by re-parsing them through `parsePluginSource`:** tempting (it would reuse `samePlannedSource`'s machinery), but `parsePluginSource` is designed for user-typed manifest/CLI input, not for an arbitrary git-config `url =` value, and pulling it into the comparison risks accepting shorthand forms (`owner/repo`) or shapes the origin could never actually contain. The narrower, already-precedented move is reusing the single leaf primitive (`.git`-suffix strip) that both existing identity compositions already share (see `domain/source.ts:453-461`'s own comment: "Shared by the two parse-time identity compositions below").
- **Threading a `ctx` through the entire autoupdate cascade for SC5:** touches `orchestrators/types.ts::PluginUpdateFn`, its one implementor `update-flow.ts::updateSinglePluginWith`, and the `pluginUpdate` closure construction — and shifts two `check-unused-type-members.contracts.json` pins in `update-flow.ts` (lines 834, 915) that the narrower "make `ctx` optional" fix does not touch at all. See Common Pitfalls #5.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this leftover clone the same source" | A new URL-comparison helper from scratch | `domain/source.ts`'s existing (currently private) `stripGitSuffix` leaf, exported, composed with `canonicalCloneUrl` | The project already has a documented policy of sharing only LEAF primitives between identity compositions, never whole compositions (D-2-05's post-mortem: "a shared helper is what let a wire-side fix move the cache identity once already") — recognition is a natural third composition over the same leaf |
| Leftover removal | A bespoke rm/cleanup routine | `cleanupStaging` + the existing `RemovalOps` port (`shared/fs-utils.ts`) | Already ENOENT-tolerant, already returns a leak string instead of throwing, already the MA-9 discipline MA-14 explicitly reuses (CONTEXT.md: "SC3 is a new CALLER of an existing mechanism, not a new mechanism") |
| Stale-error classification after a leak wrap | A new error-unwrapping helper | `orchestrators/marketplace/add.ts::unwrapAddError` (already handles ONE level of `Error.cause`) | Built for exactly this shape; the risk is exceeding its one-level contract, not needing a replacement for it (see Common Pitfalls #2) |

**Key insight:** almost everything MA-12/13/14 need already exists in this codebase in a form built for a slightly different call site. The actual new work is narrow: one new `GitOps` member, one new fs-probing implementation, one new comparison call, and one new removal call ahead of the existing rename — wired together carefully enough not to violate two existing invariants (the one-level cause-chain contract, and the platform-tier's ban on importing `domain/`).

## Common Pitfalls

### Pitfall 1: isomorphic-git's `listRemotes` does not throw for the cases D-3-03 needs to distinguish

**What goes wrong:** A naive implementation wraps `git.listRemotes({fs, dir})` in a `try/catch` expecting a thrown error to mean "not a git repo" or "unreadable." It never fires.

**Why it happens:** Traced through the installed `node_modules/isomorphic-git/index.js` (1.42.2) source directly:
- `listRemotes({fs, dir, gitdir})` (`index.js:13059-13073`) calls `discoverGitdir({fsp, dotgit: gitdir})`.
- `discoverGitdir` (`index.js:5537-5564`) does `fsp._stat(dotgit).catch(() => ({isFile:()=>false, isDirectory:()=>false}))` — **every** stat error, including `EACCES`, is caught and treated as "neither a file nor a directory," which falls to the `else` branch returning `dotgit` unchanged. No throw.
- `_listRemotes({fs, gitdir})` (`index.js:13030-13042`) calls `GitConfigManager.get({fs, gitdir})`, which calls `fs.read(`${gitdir}/config`, {encoding: 'utf8'})` (`index.js:2027-2032`).
- `FileSystem.read` (`index.js:5316-5342`) wraps `_readFile` in a `try/catch` whose catch block is unconditional — `catch (err) { return null }` (`index.js:5340-5341`), with **no `err.code` filter of any kind**. ENOENT, ENOTDIR, EACCES, EPERM — all become `null`.
- `GitConfig.from(null)` (`index.js:1893-1895` calling the constructor at `1865-1891`) treats a falsy `text` as `parsedConfig = []` — an empty, valid config, not an error state.
- Net result: `git.listRemotes({fs, dir})` on a directory with no `.git`, an unreadable `.git/config`, or a `.git` that is a stray file all resolve to `[]` (no remotes found), identically to a real git repo with zero remotes. [VERIFIED: node_modules/isomorphic-git/index.js:5537-5564, 13030-13073, 5316-5342, 1865-1895, 2018-2032]

**How to avoid:** `platform/git.ts::listRemotes` must do its own filesystem-level probing (existence via `fs.stat`/`fs.access`, readability by attempting to actually read `<dir>/.git/config` and checking the caught error's `code`) **before or alongside** the isomorphic-git call, and use that probe — not isomorphic-git's return value or thrown errors — to populate the "not-a-repo" and "unreadable" arms of the discriminated result.

**Warning signs:** A `fallow health` / coverage run reporting the "not-a-repo" or "unreadable" branch of the new discriminated value as covered by a test that never actually removes or corrupts a `.git` directory — if the branch is reachable only via a stubbed/faked `GitOps`, it was never proven against the real isomorphic-git behavior this pitfall describes.

### Pitfall 2: `appendLeakToError` loses `instanceof` identity, and `unwrapAddError` only unwraps ONE level

**What goes wrong:** MA-14 needs a leak encountered while removing the recognized leftover to still render as `(failed) {stale clone}` with the leak appended. If that leak is folded in via `appendLeakToError(new StaleSourceCloneError(...), leak)`, the result is a **new plain `Error`** (per `shared/errors.ts:218-225`, `appendLeakToError` only returns the original object unchanged when `leak === undefined`; otherwise it constructs `new Error(..., {cause: baseError})`), which is **not** `instanceof StaleSourceCloneError`. The existing `unwrapAddError` (`add.ts:221-236`) exists precisely to see through ONE such wrap (its own doc comment: "The github guard's MA-9 catch wraps a precondition error via `appendLeakToError` when `cleanupStaging` itself leaks... Single level only -- a deeper chain is not an add-precondition shape this orchestrator produces").

The existing `addGitClonedInGuard` catch block (`add.ts:750-766`) ALSO runs on every thrown error, and when `!stagedAtFinal` (true for any throw before the rename — which includes both the existing MA-6 throw and the new MA-13/14 throws), it calls `cleanupStaging(removalOps, stagingDir, ...)` on the **freshly cloned staging directory** (a different directory from the recognized leftover) and appends **its own** leak via `appendLeakToError`. If the new leftover-removal leak is *also* appended via `appendLeakToError` at the point it is detected, and the bottom catch block appends the staging-cleanup leak on top of that, the result is a **two-level** `Error.cause` chain — which `unwrapAddError`'s documented single-level unwrap cannot see through, silently breaking `classifyAddError`'s `{stale clone}` routing and `addSubjectName`'s marketplace-name rendering. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:212-236, 245-253, 293-304, 750-766; extensions/pi-claude-marketplace/shared/errors.ts:218-225, 227-235]

**How to avoid:** Either (a) fold the leftover-removal leak directly into the thrown error's own construction (bypassing `appendLeakToError`'s cause-wrapping) so the bottom catch's single `appendLeakToError` call for the staging-cleanup leak is the only wrap that ever occurs, or (b) combine both leak messages into one string before a single `appendLeakToError` call. Do not let both leaks chain independently.

**Warning signs:** A test that makes BOTH the leftover-cleanup AND the fresh-staging-cleanup fail on the same add call (a double-fault scenario 100% branch coverage will force you to write) renders something other than `(failed) {stale clone}` — e.g. falls through to an unclassified generic error re-throw.

### Pitfall 3: the identity-vs-wire normalization leaf (`stripGitSuffix`) is not exported

**What goes wrong:** D-3-01 requires comparing the leftover's `origin` (always in wire form, per `domain/clone-key.ts::networkCloneUrl`'s doc comment and `platform/git.ts::clone`'s verbatim `git.clone({url: opts.url, ...})` call) against `canonicalCloneUrl(source)` (always in identity form — `.git`-stripped). The only function that does this exact strip, `stripGitSuffix` (`domain/source.ts:459-461`), is module-private (no `export` keyword), unlike its siblings `stripSlashAndFragment` and `ensureGitSuffix` which ARE exported.

**Why it happens:** `stripGitSuffix` was written as a shared leaf between `stripUrlDecorations` and `stripGitHubUrlDecorations` (both private, both compositions), not anticipating a THIRD consumer outside `domain/source.ts`.

**How to avoid:** Export `stripGitSuffix` (or a thin new one-line wrapper) from `domain/source.ts` for `add.ts` to import — consistent with the project's own precedent of sharing leaves, never compositions (D-2-05's post-mortem explicitly credits keeping compositions un-shared with letting a prior fix land safely). The alternative — inlining a duplicate one-liner in `add.ts` — works but diverges from the established "share the leaf" convention and would need its own justification comment.

**Warning signs:** A recognition comparison that does its own ad-hoc `.replace(/\.git$/, "")` inline in `add.ts` with no test proving it matches `domain/source.ts`'s definition byte-for-byte — a future edit to the canonical strip rule (e.g. a case-insensitivity fix) would silently diverge from recognition's copy.

### Pitfall 4: the test fixture for a "leftover clone" needs an actual `.git/config`, not just a marker file

**What goes wrong:** The existing MA-6 test (`tests/orchestrators/marketplace/add.test.ts:448`) simulates "leftover" by creating a bare directory with a marker file — no `.git` at all. That remains valid as a "not a git repo" MA-13 case after Phase 3 (recognition correctly still refuses it), but it is NOT sufficient to exercise the "origin matches" MA-12 success path, which needs a directory whose `GitOps.listRemotes` call actually reports an origin.

**How to avoid:** Since `GitOps` is entirely interface-mediated in tests (`createGitOpsFake`, never touching real git operations except the opt-in `cloneFixture`/`cp` path), the natural and consistent design is a new `GitOpsFakeOptions` field (e.g. `listRemotesResult`) that lets a test directly configure the canned discriminated-value response, rather than writing a real `.git/config` to disk for every add.test.ts scenario. For `platform/git.ts`'s OWN unit tests (`tests/platform/git.test.ts`), real fixtures ARE appropriate and cheap: `createGitTestDirectory` (a bare empty tmp dir, already exists at `tests/platform/git-test-repository.ts:32-41`) covers "not-a-repo"; `createGitTestRepository` (real `git.init`, already exists at lines 43+) plus `git.addRemote` covers "origin present"/"no-origin"; `chmod` on the `.git` directory or `.git/config` file (the project's own established pattern — see `add.test.ts:2242`'s `chmod(locations.scopeRoot, 0o555)`) covers "unreadable."

### Pitfall 5: the SC5 "make `ctx` optional" fix must not let the Device Flow arm crash on a missing `ctx`

**What goes wrong:** `orchestrators/auth-host.ts::buildAuthForHost`'s no-provider arm (lines ~172-186) never reads `ctx` — confirmed by direct read, it constructs `onAuthRequired` from `host` alone. But the PROVIDER-FOUND arm (lines 190-219) calls `makeRawNotifyFn(ctx)` (line 192) to build the Device Flow's notify callback, and `makeRawNotifyFn` (`shared/notification-dispatch.ts:347-357`) dereferences `ctx.ui.notify` inside its returned closure. If `ctx` is simply widened to `ctx?: NotificationContext` and passed through unchanged, a cascade retry against a plugin hosted on `github.com`/`gitlab.com` with no stored credential would reach the Device Flow arm with `ctx === undefined` and crash the first time `onAuthRequired` is actually invoked (a real, reachable path — plugins absolutely can be sourced from registry hosts).

**Why it happens:** `buildCloneAuth`'s and `buildAuthForHost`'s only two arms today assume ctx is ALWAYS real (every other call site — install/reinstall/fetch/info — does pass a real `ctx`); the cascade is the first caller that structurally cannot guarantee one.

**How to avoid:** When `ctx === undefined`, `buildAuthForHost` should behave like the no-provider arm **regardless of whether a provider is registered** — Device Flow is inherently interactive and the cascade is a silent background operation, so declining it (while still trying `credentialOps.fill` first, which needs no `ctx`) is the semantically correct behavior, not just a crash workaround. This also keeps the fix's footprint to `orchestrators/auth-host.ts` alone (plus `update-preflight.ts`'s local `buildBundle`, which can likely be deleted in favor of calling the shared `buildCloneAuth` once `ctx` is optional everywhere — `buildCloneAuth`'s own doc comment at `auth-host.ts:234-236` already anticipates this: "`update-preflight.ts` is the one git-plugin probe outside it: it keeps a local `buildBundle` because its cascade path may run with no `ctx` at all"). [VERIFIED: extensions/pi-claude-marketplace/orchestrators/auth-host.ts:163-219, 238-255; extensions/pi-claude-marketplace/shared/notification-dispatch.ts:347-357; extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:149-173]

**Warning signs:** A cascade-path test using a github.com/gitlab.com plugin source with an empty credential store passes today (because the whole path is authless / no Device Flow is ever attempted) and would need to be the FIRST thing re-run after the fix lands, before assuming the fix is safe — it is exactly the scenario the current code accidentally protects against by never reaching the Device Flow arm at all.

### Pitfall 6: `check-unused-type-members.contracts.json` pins will drift, and the amount differs sharply by design choice

**What goes wrong:** Pins are `line:col` (STATE.md, confirmed). `add.ts` holds two pins at `545:35`/`545:52` [VERIFIED: scripts/check-unused-type-members.contracts.json, entries with `id` containing `marketplace/add.ts`]. Since `addGitClonedInGuard` (the phase's edit target) starts at line 682 — below 545 — those two pins are safe from the STEP-4/5 branch edit itself, but WILL shift if any new import line is added near the top of `add.ts` (e.g. importing an exported `stripGitSuffix`). `update-preflight.ts` holds pins at `138:56`, `139:5` (above the `makeUpdateCloneProbe`/`buildBundle` edit at ~149-173, safe) and `349:63` (below it — will shift by the fix's net line delta). `update-flow.ts` holds pins at `834:42` and `915:42` [VERIFIED: scripts/check-unused-type-members.contracts.json, entries with `id` containing `update-flow.ts`] — these are UNTOUCHED if SC5 is fixed via the "make ctx optional" approach (no edit to `update-flow.ts` at all), but WOULD shift under the "thread ctx through the cascade" alternative (which necessarily edits `updateSinglePluginWith` at line 502, above both pins). `orchestrators/marketplace/shared.ts` and `platform/git.ts` hold **zero** pins today [VERIFIED: scripts/check-unused-type-members.contracts.json — no entries match either path], so the new `GitOps.listRemotes` interface member and its `platform/git.ts` implementation are free to land without any pin remap.

**How to avoid:** Run `npm run format` (not just `format:check`) immediately after each file edit and BEFORE computing/asserting pin coordinates, per the project's own established discipline (STATE.md: "Prettier invalidates type-member pins... format BEFORE lint:type-members; repin by shifting the LINE only"). Budget an explicit remap pass as its own step, the same way Phase 2 did three times.

**Warning signs:** `npm run lint:type-members` failing with a pin pointing at the wrong AST node after an edit — this is the exact recurring failure mode Phase 2's plans (01, 02, 03) each had to absorb.

## Code Examples

### Reading isomorphic-git's exported `listRemotes` signature

```typescript
// Source: node_modules/isomorphic-git/index.d.ts:2019-2032 (verbatim, installed 1.42.2)
export function listRemotes({ fs, dir, gitdir }: {
    fs: FsClient;
    dir?: string | undefined;
    gitdir?: string | undefined;
}): Promise<Array<{
    remote: string;
    url: string;
}>>;
```

### How an origin URL actually gets stored (wire form, not identity form)

```typescript
// Source: extensions/pi-claude-marketplace/platform/git.ts:140-168 (verbatim, relevant excerpt)
export async function clone(opts: CloneOptions): Promise<void> {
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  await git.clone({
    fs,
    http,
    dir: opts.dir,
    url: opts.url,                 // <-- stored as remote.origin.url VERBATIM
    ...(opts.ref !== undefined && { ref: opts.ref }),
    ...(opts.singleBranch !== undefined && { singleBranch: opts.singleBranch }),
    ...(authCbs !== undefined && {
      onAuth: authCbs.onAuth,
      onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
    }),
  });
}
```

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:696-701 (verbatim, relevant excerpt)
await gitOps.clone({
  dir: stagingDir,
  url: networkCloneUrl(source),   // <-- wire form: github → .git-suffixed;
                                   //     url-kind → source.raw, slash/fragment-stripped only
  ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
  auth,
});
```

```typescript
// Source: extensions/pi-claude-marketplace/domain/clone-key.ts:78-88 (verbatim)
export function canonicalCloneUrl(source: UrlSource | GitSubdirSource | GitHubSource): string {
  return source.kind === "github"
    ? `https://github.com/${source.owner}/${source.repo}`
    : source.url;
}
```

### The existing leak-append / one-level-unwrap contract MA-14 must respect

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:218-225 (verbatim)
export function appendLeakToError(err: unknown, leak: string | undefined): Error {
  const baseError = err instanceof Error ? err : new Error(String(err));
  if (leak === undefined) {
    return baseError;
  }

  return new Error(`${baseError.message} (additionally: ${leak})`, { cause: baseError });
}
```

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:221-236 (verbatim)
function unwrapAddError(err: unknown): unknown {
  if (
    err instanceof MarketplaceDuplicateNameError ||
    err instanceof StaleSourceCloneError ||
    err instanceof InvalidMarketplaceManifestError ||
    err instanceof UnsupportedSourceError
  ) {
    return err;
  }

  if (err instanceof Error && err.cause !== undefined) {
    return err.cause;
  }

  return err;
}
```

## State of the Art

Not applicable in the "library evolved" sense — this is an internal-codebase phase. The one relevant "state of the art" fact is that isomorphic-git's error-swallowing behavior in `FileSystem.read`/`GitConfigManager.get` has been stable across the installed version and is unlikely to change (it is foundational to how the library treats "no config file" as "empty config" everywhere, not a bug specific to `listRemotes`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact shape of `GitOpsFakeOptions`'s new field for configuring `listRemotes` in tests (single canned value vs. per-directory map) — recommended as a single canned value defaulting to `{kind: "not-a-repo"}` for unconfigured tests, since `addGitClonedInGuard` calls `listRemotes` at most once per add | Pitfall 4 / Recommended Project Structure | If a future test needs two different `listRemotes` results in one process (unlikely given one call site), the single-value design needs revisiting; low risk, easily extended later |
| A2 | Whether `check-unused-type-members.contracts.json`'s "coverage-pin files" (mentioned in STATE.md as "both coverage-pin files are unchanged") are the same artifact as `contracts.json` or a separate `test:coverage:direct`-owned file — not located during this research (searched, found none under that name) | Common Pitfalls #6 | Low risk — `npm run check`'s own failure output will name the exact file if one exists and is affected; the plan should not assume a silent second pin file that this research failed to locate |
| A3 | That `buildCloneAuth` (not just `buildAuthForHost`) should also gain an optional `ctx`, letting `update-preflight.ts`'s local `buildBundle` be deleted entirely in favor of calling the shared helper — presented as the recommended design in Pitfall 5, but the CONTEXT.md leaves the exact mechanism to Claude's discretion, and deleting `buildBundle` outright is a larger diff than merely widening its own local type | Pitfall 5 / Anti-Patterns | If the planner instead keeps `buildBundle` as a thin local wrapper (rather than deleting it), the fix is still correct, just slightly less minimal; no functional risk either way |

**Assumption A1 needs no user confirmation** — it is a test-infrastructure implementation detail within Claude's discretion band already granted by CONTEXT.md ("whether recognition lives inline... or in a named helper"). Assumption A2 is a research gap, not a design decision — the plan should treat it as "verify during execution," not something requiring a checkpoint. Assumption A3 is inside CONTEXT.md's explicitly granted discretion ("Whether the SC5 fix makes `ctx` optional on `buildAuthForHost` or threads a ctx through the cascade").

## Open Questions

1. **Does `git.addRemote` (isomorphic-git) validate the URL scheme, or store anything typed into it verbatim?**
   - What we know: `clone()`'s own remote-setting step is effectively an internal `addRemote` call; `platform/git.ts::clone` never validates `opts.url`'s scheme itself (that gate lives earlier, at parse time in `domain/source.ts`'s `https://`-only admission).
   - What's unclear: whether a MALFORMED leftover `.git/config` (hand-edited or corrupted by a crash mid-write) could contain a non-`https://` origin url (e.g. `git@host:owner/repo.git` SSH form, or a garbage string) that isomorphic-git's `listRemotes` would still happily return without validation.
   - Recommendation: not a blocker — the comparison in `add.ts` is a byte-equality check against `canonicalCloneUrl(source)` (always `https://`-form), so a malformed/SSH-form origin simply fails to match and correctly falls into the MA-13 refusal path. No special-casing needed, but worth one explicit test case ("origin is an ssh:// or garbage string" → refused, not crashed).

2. **Exact final shape of `ListRemotesOptions`/`ListRemotesResult` naming, and whether `errno` rides on the `unreadable` arm.**
   - What we know: CONTEXT.md explicitly leaves this to Claude's discretion ("whether the failure arm carries an `errno`").
   - What's unclear: nothing structurally — this is a genuinely open style choice, not a research gap.
   - Recommendation: follow the `ManifestLookup` precedent's naming economy (`kind` discriminant, minimal payload per arm) unless a specific downstream consumer needs the errno for a rendered message (none identified — MA-13's refusal message does not vary by WHY the leftover is foreign).

## Environment Availability

Not applicable — this phase has no new external tool/service/runtime dependency. `isomorphic-git` is already installed and pinned; all filesystem operations use Node's built-in `fs`, already in use throughout `platform/git.ts` and `shared/fs-utils.ts`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in `node:test` + `node:assert/strict`, with `--experimental-test-coverage` [VERIFIED: package.json `test:coverage:unit` script] |
| Config file | none — flags are inline in the `package.json` script |
| Quick run command | `node --test tests/orchestrators/marketplace/add.test.ts` (single file, no coverage gate) |
| Full suite command | `npm run check` (composes typecheck, lint, `lint:workflows`(+negative), `fallow`, `format:check`, `test:corresponding`(+negative), `test:coverage:direct:negative`, `test:coverage:unit`, `test:integration`, `lint:type-members`(+negative) — exact order per `package.json:77`) [VERIFIED: package.json line 77] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MA-12 | Leftover clone whose origin matches the fresh source recovers instead of refusing | unit (orchestrator) | `node --test tests/orchestrators/marketplace/add.test.ts` | ✅ file exists, new `test(...)` cases needed |
| MA-12 | `listRemotes` correctly reports `{kind:"origin", url}` for a real git dir with an origin remote | unit (platform) | `node --test tests/platform/git.test.ts` | ✅ file exists, new `describe("listRemotes", ...)` block needed |
| MA-13 | Leftover that is not a git clone still refuses (`{stale clone}`) | unit (orchestrator) | `node --test tests/orchestrators/marketplace/add.test.ts` | ✅ existing test at line 448 already covers this arm; confirm behavior unchanged, do not rename unless title is misleading |
| MA-13 | Leftover whose origin names a DIFFERENT url still refuses | unit (orchestrator) | `node --test tests/orchestrators/marketplace/add.test.ts` | ✅ file exists, new case needed — no existing test covers a real origin mismatch |
| MA-13 | Leftover that is unreadable still refuses, not crashes | unit (platform + orchestrator) | `node --test tests/platform/git.test.ts tests/orchestrators/marketplace/add.test.ts` | ✅ files exist, new cases needed in both |
| MA-14 | Recognized leftover that cannot be fully removed fails as stale with the cleanup leak appended, no destination recorded | unit (orchestrator) | `node --test tests/orchestrators/marketplace/add.test.ts` | ✅ file exists; pattern already established by the WR-07 test at line 2227 for a DIFFERENT failure point — new case needed for THIS failure point |
| GATE-01 | `listRemotes` is read by production code or recorded in `contracts.json` | static (gate) | `npm run lint:type-members` | ✅ enforced automatically once `add.ts` calls `gitOps.listRemotes(...)` |
| GATE-01 | 100% lines/functions/branches over `extensions/**`, including every arm of the new discriminated value and every branch of the 3-way refusal | coverage (gate) | `npm run test:coverage:unit` | ✅ enforced automatically; branch enumeration below sizes the new-test burden |
| SC5 | Cascade auth bundle actually authenticates instead of cloning authless on every host | unit (orchestrator) | `node --test tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/auth-host.test.ts` (exact files not enumerated this session — locate via `grep -rl buildAuthForHost tests/`) | not verified this session — locate and confirm during planning |

### Sampling Rate

- **Per task commit:** the single touched test file's quick run (`node --test tests/<file>.test.ts`)
- **Per wave merge:** `npm run test:coverage:unit` (the 100%-branch gate) plus `npm run fallow`
- **Phase gate:** full `npm run check` green before `/gsd-verify-work`, per GATE-01 and the milestone-wide constraint

### Branch Enumeration (sizing the 100%-coverage burden)

New production branches this phase introduces, each needing at least one direct test:

1. `platform/git.ts::listRemotes` — the fs-probe pre-check: exists-and-readable vs. ENOENT/ENOTDIR (not-a-repo) vs. other error code (unreadable) — **≥2 branches** (the not-a-repo/unreadable split), plus
2. the post-probe isomorphic-git origin lookup: origin found vs. no origin among remotes — **1 branch** (2 arms, one `if`)
3. `add.ts` step 4 becomes a switch/if-chain over the 4-arm `ListRemotesResult` — **4 arms**, only ONE of which (`origin` + url match) proceeds; the other 3 (`no-origin`, `not-a-repo`, `unreadable`) plus the `origin`-but-URL-MISMATCH sub-case all fall into refusal — **5 distinguishable branches total** if url-match/no-match is nested inside the `origin` arm
4. D-3-02/MA-14 leftover-removal leak branch — leak vs. no-leak on the pre-rename `cleanupStaging` call — **2 branches**
5. SC5's `buildAuthForHost`: `ctx` present vs. absent, crossed with provider-found vs. not-found — up to **3 reachable combinations** (no-provider-with-ctx [existing], no-provider-without-ctx [existing pattern, now also reachable via cascade], provider-found-with-ctx [existing], provider-found-without-ctx [NEW — the graceful-decline branch from Pitfall 5]) — **1 new branch** if the fix is scoped as recommended (decline Device Flow whenever `ctx` is absent, regardless of provider)

Total: roughly **10-11 new/newly-reachable branches**, each requiring a dedicated test case for the 100% gate. This is a meaningfully larger test-writing burden than the production-code diff size suggests, and the plan should size tasks accordingly (likely 2-3 plans: platform seam + tests, orchestrator recognition + tests, SC5 fix + tests — consistent with STATE.md's `total_plans_in_phase: 3` placeholder already recorded).

### Wave 0 Gaps

- [ ] `tests/platform/git.test.ts` — remove the `listRemotes`/`ListRemotesOptions` `@ts-expect-error` negative controls (lines 895-899) BEFORE adding the real implementation, or the file will not typecheck the moment `listRemotes` starts existing
- [ ] `tests/platform/git-ops-fake.ts` — add a `listRemotes` implementation (interface conformance is otherwise a compile error the moment `GitOps` gains the 8th member) and a configuration option for its canned result
- [ ] `tests/platform/git-ops-contract.ts` — decide whether `listRemotes` joins the shared production/fake parity contract (`GIT_OPS_CASE_NAMES` + `gitOpsContractCases`); recommended, since every other `GitOps` member is covered there
- [ ] Locate the SC5 test files (not enumerated this session — `grep -rl buildAuthForHost tests/` was not run; do so before planning the SC5 task)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (new) | Device Flow / credential-helper auth already shipped in Phase 1; SC5 only fixes WHICH bundle reaches the cascade, not the auth mechanism itself |
| V4 Access Control | yes | Path containment: `locations.sourceCloneDir` already routes every name through `assertPathInside` (`persistence/locations.ts:36-38`, "defending against an attacker-controlled marketplace name like `'../escape'`"), unaffected by this phase — recognition reuses the SAME `finalDir` this containment already produced, it does not compute a new path |
| V5 Input Validation | yes | `PLUGIN_ENTRY_SCHEMA`'s `source` field is `Type.Unknown()` [VERIFIED: extensions/pi-claude-marketplace/domain/manifest.ts:16,29 — `import { PLUGIN_ENTRY_SCHEMA }`, `plugins: Type.Array(PLUGIN_ENTRY_SCHEMA)`; extensions/pi-claude-marketplace/domain/plugin-resolver.ts:386 — `// Classify source. PluginEntry.source is Type.Unknown() per MM-3.`], so a manifest's declared source is attacker-controllable content — but both `url` and `raw` fields are funneled through `gatedUrlField`→`parseUrlSourceForm` (`domain/source.ts:185-190`), the same `https://`-only admission gate Phase 2's review closed the hole in. `canonicalCloneUrl(source)` (the value D-3-01 compares against) is therefore always computed from an ALREADY-GATE-VALIDATED source, not a raw attacker string |
| V12 File and Resources | yes | This phase's actual novel risk surface: the DECISION to `rm -rf` a directory (`finalDir`) is now conditioned on a string comparison rather than being unconditionally refused. Reasoned analysis: the comparison can only succeed if the leftover's REAL on-disk git origin (not attacker-suppliable at add-time — it was written by a PRIOR clone operation) equals the CURRENT gate-validated source's canonical url. An attacker cannot make an unrelated pre-existing directory's real `origin` match a source they are typing now unless they already controlled the prior clone that created it — which is exactly the "this is genuinely my own leftover" case the feature is meant to recognize. No new deletion authority is granted beyond what MA-6's existing unconditional refusal already implicitly permitted for a matched retry |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via attacker-controlled marketplace/plugin name | Tampering | `assertPathInside` in `persistence/locations.ts` (pre-existing, unaffected by this phase) |
| Race between recognition check and removal (TOCTOU on `finalDir`) | Tampering | Not a NEW risk this phase introduces — `pathExists`→listRemotes→cleanupStaging→rename is already a multi-step sequence with no lock across it in the EXISTING code (the current MA-6 refusal has the same `pathExists` TOCTOU shape); no evidence this phase widens the window beyond what already exists. Flag as an assumption if the planner wants a lock — not indicated by CONTEXT.md's decisions |
| Credential leakage into an Error or notification (AUTH-09) | Information Disclosure | `tests/architecture/no-credential-leak.test.ts`'s `CREDENTIAL_LEAK_TARGETS` already includes `add.ts`, `auth-host.ts`, and `platform/git.ts` [VERIFIED: tests/architecture/gate-targets.ts:401-418] — no new file registration needed, but new error/message code in this phase (the `unreadable` arm's optional errno, any new `StaleSourceCloneError` construction) must keep the existing discipline of never interpolating a credential field |

## Sources

### Primary (HIGH confidence — direct `Read` of installed dependency source or this repo's own code)
- `node_modules/isomorphic-git/index.js` (installed 1.42.2) — `listRemotes`, `_listRemotes`, `discoverGitdir`, `FileSystem.read`, `GitConfigManager.get`, `GitConfig` constructor: lines 1865-1895, 2018-2032, 5271-5342, 5537-5564, 13030-13073, 18019
- `node_modules/isomorphic-git/index.d.ts` — `listRemotes` type signature, lines 2019-2032
- `extensions/pi-claude-marketplace/platform/git.ts` — `clone()`, `CloneOptions`, full file (320 lines) read
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — `addGitClonedInGuard`, `unwrapAddError`, `classifyAddError`, `addSubjectName`, `appendLeaks` usage: lines 195-330, 682-767
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` — `GitOps` interface, `DEFAULT_GIT_OPS`: lines 104-234
- `extensions/pi-claude-marketplace/shared/fs-utils.ts` — `cleanupStaging`, `pathExists`, `RemovalOps`: full file read
- `extensions/pi-claude-marketplace/shared/errors.ts` — `appendLeakToError`, `appendLeaks`, `StaleSourceCloneError`
- `extensions/pi-claude-marketplace/domain/source.ts` — `stripGitSuffix`, `stripSlashAndFragment`, `stripUrlDecorations`, `stripGitHubUrlDecorations`, `ensureGitSuffix`, `samePlannedSource`, `sourceLogical`: lines 440-720
- `extensions/pi-claude-marketplace/domain/clone-key.ts` — `canonicalCloneUrl`, `networkCloneUrl`: full file read
- `extensions/pi-claude-marketplace/domain/manifest-lookup.ts` — `ManifestLookup` precedent: full file read
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` — `buildAuthForHost`, `buildCloneAuth`: lines 1-255
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` — `makeUpdateCloneProbe`, `buildBundle`: lines 140-190
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts` — `updateSinglePluginWith`, `PluginUpdateFn` wiring: lines 491-565, 961-998
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` — `makeRawNotifyFn`: lines 340-357
- `tests/orchestrators/marketplace/add.test.ts` — full test-title survey, `createGitOps` local helper, MA-6/WR-07 test bodies read in full
- `tests/platform/git-ops-fake.ts` — full file read
- `tests/platform/git-ops-contract.ts` — structure read (lines 1-80)
- `tests/platform/git-ops-fake.test.ts` — `GIT_OPS_CASE_NAMES` negative-control test read (lines 150-169)
- `tests/platform/git.test.ts` — imports and `@ts-expect-error` negative controls (lines 1-60, 857-920) read; confirms `listRemotes`/`ListRemotesOptions` are currently asserted ABSENT
- `tests/platform/git-test-repository.ts` — `createGitTestDirectory`, `createGitTestRepository` fixture helpers: lines 1-60
- `scripts/check-unused-type-members.contracts.json` — parsed programmatically, all 108 entries scanned for phase-relevant file paths
- `.fallowrc.json` — full file read, `boundaries.zones`/`boundaries.rules` confirm `platform` may import only `shared`
- `tests/architecture/gate-targets.ts` — `NETWORK_FREE_TARGETS`, `CREDENTIAL_LEAK_TARGETS`, `ZONE_REPRESENTATIVE_TARGETS` sections read
- `tests/architecture/no-orchestrator-network.test.ts` — full file read
- `extensions/pi-claude-marketplace/persistence/locations.ts` — `sourceCloneDir` containment doc comment: lines 1-43
- `extensions/pi-claude-marketplace/domain/manifest.ts`, `domain/plugin-resolver.ts` — `PLUGIN_ENTRY_SCHEMA`/`Type.Unknown()` confirmation
- `package.json` — `check`, `test:coverage:unit`, and related script definitions

### Secondary (MEDIUM confidence)
None used — every claim in this document traces to a direct `Read` this session.

### Tertiary (LOW confidence)
None used.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, installed version directly confirmed
- Architecture (listRemotes seam placement, tier boundaries): HIGH — confirmed against `.fallowrc.json`'s actual boundary rules, not inferred
- isomorphic-git failure-mode behavior: HIGH — traced through the actual installed source line-by-line, not assumed from documentation
- Pitfalls (cause-chain depth, negative-control breakage, SC5 crash risk): HIGH — each traced through actual code reads, not hypothesized
- SC5 exact fix mechanism: MEDIUM-HIGH — the recommended design (ctx-optional + graceful device-flow decline) is well-grounded, but the exact code shape is explicitly Claude's discretion per CONTEXT.md, and the SC5 test file locations were not enumerated this session (Open Question / Wave 0 gap)
- Coverage/branch-count arithmetic: MEDIUM — a careful enumeration, but the EXACT final shape of the discriminated value (Claude's discretion) could shift the count by 1-2 branches either way

**Research date:** 2026-09-27
**Valid until:** this phase's completion — the research is tied to the exact installed `isomorphic-git@1.42.2` behavior and the exact current line numbers of every cited file; any prior phase's edits after this date would need re-verification of line numbers (not behavior, which is a stable library property)
