# Phase 3: `marketplace add` recovers from its own leftover clone - Pattern Map

**Mapped:** 2026-09-27
**Files analyzed:** 9 (all edits to existing files; no new files)
**Analogs found:** 9 / 9 (every file is its own best analog — this phase extends existing seams)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (`GitOps.listRemotes` 8th member + `DEFAULT_GIT_OPS` wiring) | service (interface + DI wiring) | request-response (fs probe, no network) | `GitOps.resolveRemoteRef` (same file, lines ~176-186) — the most recently added member (D-77-05), also the only other member with an optional-arm/non-standard shape | exact |
| `extensions/pi-claude-marketplace/platform/git.ts` (`listRemotes` impl + `ListRemotesOptions`/`ListRemotesResult` types) | service (platform-tier git wrapper) | file-I/O + request-response (fs probe layered ahead of an isomorphic-git call) | `resolveRemoteRef` (lines 228-262) for the "wraps one isomorphic-git call, returns a derived shape, throws on ambiguity" skeleton; `domain/manifest-lookup.ts::ManifestLookup` for the DISCRIMINATED RETURN shape itself | exact (skeleton) / exact (return-shape precedent) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (`addGitClonedInGuard` step 4 → 3-way branch; new comparison helper) | controller/orchestrator (workflow step) | CRUD (recognize-then-remove-then-rename) | the existing step 4/5/catch block in the SAME function (lines 682-766) — this is a same-function extension, not a cross-file copy | exact |
| `extensions/pi-claude-marketplace/domain/source.ts` (export `stripGitSuffix`) | utility (pure leaf) | transform | its own sibling exports `stripSlashAndFragment` / `ensureGitSuffix` (already exported, same file) — export-keyword-only change, no new code | exact |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` (`buildAuthForHost` — `ctx` optional; graceful Device-Flow decline) | service (auth bundle builder) | request-response | its own no-provider arm (lines ~172-186) — the SAME function already has the exact "decline gracefully, no notification" shape this fix generalizes | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` (`makeUpdateCloneProbe`'s local `buildBundle`) | service (auth bundle adapter) | request-response | `orchestrators/auth-host.ts::buildCloneAuth` (lines 234-255) — the shared helper this local copy should collapse into once `ctx` is optional | role-match → becomes exact once SC5 lands |
| `tests/platform/git.test.ts` (remove 2 `@ts-expect-error` negative controls; add `listRemotes` describe block) | test | request-response | its own existing `describe` blocks for `resolveRemoteRef`/`currentBranch` (same file) | exact |
| `tests/platform/git-ops-fake.ts` (`listRemotesResult` fake field/impl) | test (fake/double) | request-response | its own `resolveRemoteRefError`-style optional-override field + existing per-method fake impls (lines 1-40 shown) | exact |
| `tests/platform/git-ops-contract.ts` (extend `GIT_OPS_CASE_NAMES` + `gitOpsContractCases`) | test (shared contract) | request-response | its own existing cases, e.g. `"resolves the remote HEAD commit"` (same file) | exact |
| `tests/orchestrators/marketplace/add.test.ts` (new MA-12/13/14 cases) | test | CRUD | its own existing MA-6 test (line 448) and WR-07 test (line 2227) | exact |

## Pattern Assignments

### `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (interface member + DI)

**Analog:** same file, `GitOps.resolveRemoteRef` (declaration ~176-186) and its `DEFAULT_GIT_OPS` entry.

**Declaration-doc-comment pattern** (verbatim, lines ~176-186):
```typescript
/**
 * D-77-05 / PURL-09: resolve a remote ref (or the default-branch HEAD) to
 * its full commit SHA WITHOUT a full clone. Used by the plugin clone-cache
 * seam to pin an unpinned source at install time. An optional `auth` bundle
 * threads through to `listServerRefs` so an unpinned PRIVATE-repo HEAD
 * resolution can authenticate (PROV-03); omitted = public-only.
 */
resolveRemoteRef(opts: { url: string; ref?: string; auth?: GitAuthBundle }): Promise<string>;
```
Follow this doc-comment convention for `listRemotes`: cite `D-3-03`/`MA-12`/`MA-13`, and — per CONTEXT.md's explicit instruction — **state inline that this is the only `GitOps` member that does not throw on failure**, mirroring how this comment explains resolveRemoteRef's own divergent shape.

**Interface member header comment convention** (verbatim, lines ~135-152, for the interface-level summary that enumerates member count):
```typescript
/**
 * D-12, D-13: marketplace orchestrator git surface.
 *
 * Seven primitives. ... D-77-05 added a 7th -- `resolveRemoteRef` -- so the
 * plugin clone-cache seam can pin an unpinned source's remote HEAD to a SHA
 * without a full clone at install time.
 * ...
 */
export interface GitOps {
```
Update this running count/narrative to "Eighth primitive — `listRemotes`" with the same one-sentence justification style.

**`DEFAULT_GIT_OPS` delegation pattern** (verbatim):
```typescript
export const DEFAULT_GIT_OPS: GitOps = {
  clone: defaultGit.clone,
  fetch: defaultGit.fetch,
  forceUpdateRef: defaultGit.forceUpdateRef,
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
  currentBranch: defaultGit.currentBranch,
  resolveRemoteRef: defaultGit.resolveRemoteRef,
};
```
Add `listRemotes: defaultGit.listRemotes,` — one line, same bare-reference style (no wrapper).

---

### `extensions/pi-claude-marketplace/platform/git.ts` (`listRemotes` implementation)

**Analog for the wrapper skeleton:** `resolveRemoteRef` (lines 228-262) — wraps exactly one isomorphic-git call, derives a project-specific return shape from the raw result, throws only for genuine ambiguity (not for "not found").

**Analog for the discriminated-value shape:** `domain/manifest-lookup.ts::ManifestLookup` (verbatim, lines ~28-35):
```typescript
export type ManifestLookup =
  | { readonly kind: "declared"; readonly entry: ManifestPluginEntry }
  | { readonly kind: "absent" }
  | { readonly kind: "unverified" };
```
Mirror this exact `kind`-discriminant, minimal-payload style for `ListRemotesResult` (4 arms: `origin` | `no-origin` | `not-a-repo` | `unreadable`, per RESEARCH.md's sketch). Do not add an `errno` field unless a consumer needs it (RESEARCH.md Open Question 2 — no consumer identified).

**Doc-comment convention to copy** (verbatim style from `resolveRemoteRef`'s header, lines ~220-227):
```typescript
/**
 * D-14 step 2 (symbolic HEAD): force-set a local ref to a given SHA.
 * Wraps isomorphic-git's `writeRef({ force: true })`. The
 * orchestrators call this via the GitOps interface; exposing it here
 * keeps orchestrator-tier code from importing isomorphic-git directly
 * (D-13).
 *
 * Source: node_modules/isomorphic-git/index.d.ts -- writeRef({ fs, dir,
 * ref, value, force, symbolic? }).
 */
```
For `listRemotes`, this doc comment must additionally explain the fs-probe-before-isomorphic-git ordering and WHY (isomorphic-git swallows every fs error into `[]` — cite RESEARCH.md Pitfall 1's traced source lines so a future reader does not "simplify" the probe away).

**Error handling pattern** (note: `resolveRemoteRef` DOES throw on ambiguity — `not found` cases):
```typescript
if (head === undefined) {
  throw new Error(`remote ${opts.url} advertised no HEAD ref`);
}
```
`listRemotes` inverts this: per D-3-03 it must NEVER throw for its four arms — return `{kind: "unreadable"}` etc. instead. Flag this inversion explicitly in the new function's own doc comment (see above), since every sibling `platform/git.ts` function throws.

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (step 4 → 3-way branch)

**Analog:** the same function's existing step 4/5/catch (verbatim, lines 682-766) — reused wholesale as the surrounding scaffold; only step 4's body changes from a bare `pathExists` check into a `pathExists` + `listRemotes` + comparison chain.

**Current step 4 (to be replaced), verbatim:**
```typescript
// 4. MA-6: stale-clone refusal on the final destination.
finalDir = await locations.sourceCloneDir(derivedName);
if (await pathExists(finalDir)) {
  // Carry the derived name so the ATTR-07 entrypoint catch renders the
  // `(failed) {stale clone}` row on the marketplace SUBJECT (A2).
  throw new StaleSourceCloneError(finalDir, derivedName);
}
```
New version keeps the same `if (await pathExists(finalDir))` guard, then inside it calls `gitOps.listRemotes({dir: finalDir})`, switches on `.kind`, and only on `{kind:"origin"}` with a matching `stripGitSuffix(url) === canonicalCloneUrl(source)` does it fall through to step 5 instead of throwing.

**MA-9 leak-append discipline to reuse (verbatim), and the ONE-LEVEL constraint (RESEARCH.md Pitfall 2):**
```typescript
export function appendLeakToError(err: unknown, leak: string | undefined): Error {
  const baseError = err instanceof Error ? err : new Error(String(err));
  if (leak === undefined) {
    return baseError;
  }
  return new Error(`${baseError.message} (additionally: ${leak})`, { cause: baseError });
}
```
```typescript
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
**Critical constraint for MA-14 (D-3-02's removal-before-rename):** the bottom catch block (lines 750-766) already calls `cleanupStaging` + `appendLeakToError` once for whichever directory is relevant when `!stagedAtFinal`. If the NEW leftover-removal call (inside the recognized-match branch, before step 5) ALSO wraps its own leak via `appendLeakToError`, the two wraps chain into a 2-level `Error.cause` that `unwrapAddError` cannot see through. Fold the leftover-removal leak directly into `StaleSourceCloneError`'s own message/construction (bypass `appendLeakToError` for that specific leak), so the bottom catch's single wrap remains the only one that ever fires. Do not add a second `appendLeakToError` call for this leak.

**`StaleSourceCloneError` constructor to reuse unchanged (verbatim, `shared/errors.ts`):**
```typescript
export class StaleSourceCloneError extends Error {
  readonly absPath: string;
  readonly mpName?: string;
  constructor(absPath: string, mpName?: string) {
    super(`stale source clone at ${absPath}`);
    this.name = "StaleSourceCloneError";
    this.absPath = absPath;
    if (mpName !== undefined) {
      this.mpName = mpName;
    }
  }
}
```

---

### `extensions/pi-claude-marketplace/domain/source.ts` (export `stripGitSuffix`)

**Analog:** its own sibling private-turned-shared leaf pattern — `stripSlashAndFragment`/`ensureGitSuffix` are already `export`ed for exactly this "third composition needs the leaf" reason.

**Current (private), verbatim, lines ~453-461:**
```typescript
/**
 * D-76-01: strip one trailing `.git` from a URL path. Shared by the two
 * parse-time identity compositions below, so `https://host/o/r.git` and
 * `https://host/o/r` name one source; the wire form does not call it, because it
 * keeps the suffix decision the user's own input made (D-2-01).
 */
function stripGitSuffix(path: string): string {
  return path.endsWith(".git") ? path.slice(0, -".git".length) : path;
}
```
Change: add `export` and extend the doc comment's second sentence to note the third (recognition) consumer in `add.ts`, per the project's own precedent of documenting each new leaf consumer inline (see D-2-05's "share the leaf, not the composition" policy cited throughout RESEARCH.md).

---

### `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` (`buildAuthForHost` — SC5)

**Analog:** its own existing no-provider arm, which already has the "graceful decline, no notification, `evictOnFailure: false`" shape SC5 needs to generalize to "no ctx" regardless of provider (verbatim, lines ~168-183):
```typescript
const provider = findProviderForHost(host);
if (provider === undefined) {
  // D-1-02: a state producer, so no notification is raised from this seam --
  // the reason rides the caller's error cause chain instead.
  const onAuthRequired: OnAuthRequiredFn = () =>
    Promise.resolve<AuthAttemptResult>({
      ok: false,
      reason: NO_STORED_CREDENTIAL_CAUSE(host),
      authAttempted: true,
    });
  // AUTH-07 / GAUTH-04: this closure mints nothing, so evicting a
  // server-rejected credential here would destroy the host's only copy.
  return {
    credentialOps,
    host,
    onAuthRequired,
    evictOnFailure: false,
  } satisfies GitAuthBundle;
}
```
Widen the guard from `if (provider === undefined)` to `if (provider === undefined || ctx === undefined)` (making `ctx` optional on the signature), so a missing `ctx` reuses this exact same decline branch rather than reaching `makeRawNotifyFn(ctx)` in the provider-found arm below it, which would crash on `ctx === undefined` per RESEARCH.md Pitfall 5.

**Signature to widen (verbatim):**
```typescript
export function buildAuthForHost(args: {
  host: string;
  credentialOps: CredentialOps;
  ctx: NotificationContext;   // -> ctx?: NotificationContext
  deviceFlowHttp?: DeviceFlowHttp;
  authMemo?: Map<string, AuthAttemptResult>;
}): GitAuthBundle {
```

---

### `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` (local `buildBundle` — SC5)

**Analog:** the shared `buildCloneAuth` this local copy already duplicates (verbatim, lines ~234-255):
```typescript
export function buildCloneAuth(
  cloneUrl: string,
  kind: "url" | "git-subdir" | "github",
  auth: {
    readonly ctx: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  },
): GitAuthBundle {
  return buildAuthForHost({
    host: hostFromCloneUrl(cloneUrl, kind),
    credentialOps: auth.credentialOps,
    ctx: auth.ctx,
    ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
    ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
  });
}
```
Current local duplicate (verbatim, lines ~160-172):
```typescript
const buildBundle = (gitSource: GitBackedSource, cloneUrl: string) => {
  if (auth.ctx === undefined) {
    return undefined;
  }
  return buildAuthForHost({
    host: hostFromCloneUrl(cloneUrl, gitSource.kind),
    credentialOps: auth.credentialOps,
    ctx: auth.ctx,
    ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
    ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
  });
};
```
Once `buildAuthForHost`'s `ctx` is optional (this phase's SC5 fix), this local `buildBundle` becomes textually identical to `buildCloneAuth` minus the early `undefined` return (which is now unnecessary — `buildAuthForHost` itself declines gracefully). Per RESEARCH.md Assumption A3, either delete `buildBundle` and call `buildCloneAuth` directly (auth-host.ts's own doc comment at lines ~232-234 already anticipates this), or keep it as a thinner pass-through. Prefer deletion — it removes a comment (`"the cascade path may run with no ctx at all"`) that becomes stale prose the moment the fix lands, and CLAUDE.md's surgical-changes rule favors removing code your own change makes redundant.

## Shared Patterns

### Discriminated-value returns for "could not tell" distinctions
**Source:** `domain/manifest-lookup.ts::ManifestLookup` (verbatim above)
**Apply to:** `platform/git.ts::ListRemotesResult` — same `kind`-discriminant, minimal-payload-per-arm style, no generic collection returned to the caller.

### MA-9 leak-append + single-level-unwrap discipline
**Source:** `orchestrators/marketplace/add.ts::appendLeakToError` / `unwrapAddError` (verbatim above)
**Apply to:** MA-14's new leftover-removal leak — must fold into `StaleSourceCloneError`'s own construction, never a second independent `appendLeakToError` wrap layered on top of the bottom catch's existing one.

### "Share the leaf, not the composition" (D-2-05 precedent)
**Source:** `domain/source.ts` — `stripSlashAndFragment`/`ensureGitSuffix` already exported; `stripGitSuffix` about to join them.
**Apply to:** the D-3-01 origin-vs-`canonicalCloneUrl` comparison in `add.ts` — reuse the leaf, do not write an inline `.replace(/\.git$/, "")` duplicate (RESEARCH.md Pitfall 3's explicit warning).

### `GitOps` seam extension checklist (7th → 8th member precedent, D-77-05)
**Source:** `orchestrators/marketplace/shared.ts` (interface + `DEFAULT_GIT_OPS`), `tests/platform/git-ops-fake.ts`, `tests/platform/git-ops-contract.ts`
**Apply to:** every file touched when `resolveRemoteRef` was added as the 7th member is the same file touched for `listRemotes` as the 8th — interface declaration, `DEFAULT_GIT_OPS` entry, platform implementation, fake implementation + new `GitOpsFakeOptions` field, and (recommended) a new `GIT_OPS_CASE_NAMES` contract case.

**`GitOpsFakeOptions` field-addition pattern** (verbatim style, `tests/platform/git-ops-fake.ts` lines 8-24):
```typescript
export interface GitOpsFakeOptions {
  readonly boundary: "memory";
  readonly allowedRemoteUrls?: readonly string[];
  readonly initialOid?: string;
  readonly updatedOid?: string;
  readonly remoteHead?: string;
  readonly remoteRefs?: Readonly<Record<string, string>>;
  readonly localRefs?: Readonly<Record<string, string>>;
  readonly worktreeDir?: string;
  readonly cloneFixture?: { readonly boundary: "local"; readonly sourceDir: string };
  readonly cloneError?: Error;
  readonly fetchError?: Error;
  readonly checkoutError?: Error;
  readonly resolveRemoteRefError?: Error;
}
```
Add `readonly listRemotesResult?: ListRemotesResult;` (RESEARCH.md Assumption A1: single canned value, default `{kind: "not-a-repo"}`, is sufficient — `addGitClonedInGuard` calls `listRemotes` at most once per add).

**`GIT_OPS_CASE_NAMES` contract-case pattern** (verbatim style, `tests/platform/git-ops-contract.ts` lines 25-37):
```typescript
export const GIT_OPS_CASE_NAMES = [
  "clones the requested branch into the requested directory",
  "fetches updated remote state without moving the worktree",
  ...
  "rejects a missing remote ref",
] as const;
```
Append entries such as `"reports the origin remote url"`, `"reports no origin when none is configured"`, `"reports not-a-repo for a non-git directory"`, `"reports unreadable for a corrupted .git"` — one string per new `ListRemotesResult` arm, following the existing case-name grammar (verb phrase, no trailing period).

## No Analog Found

None. Every file this phase touches has a same-file or same-project precedent close enough to copy directly; RESEARCH.md's own "Don't Hand-Roll" table (source.ts §278-286) independently confirms this — the phase's entire job is extending seams that already exist in exactly this shape.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{orchestrators,platform,domain,shared}/`, `tests/platform/`, `tests/orchestrators/marketplace/` — the same files RESEARCH.md's Sources section already read in full; no additional Glob/Grep sweep was needed because RESEARCH.md's line-level citations already pin every analog location.
**Files scanned:** 9 target files + 5 analog source files (`shared.ts`, `platform/git.ts`, `manifest-lookup.ts`, `git-ops-fake.ts`, `git-ops-contract.ts`) read directly this session; `add.ts`, `errors.ts`, `auth-host.ts`, `update-preflight.ts`, `source.ts` excerpts confirmed against current line numbers.
**Pattern extraction date:** 2026-09-27
