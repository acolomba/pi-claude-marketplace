# Phase 76: Marketplace git-URL sources - Research

**Researched:** 2026-07-11
**Domain:** Source-string parsing + git-clone plumbing + notification-catalog amendment (all in-tree TypeScript; no new external deps)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Source acceptance & parsing (`domain/source.ts`)**
- **D-76-01:** `url` marketplace sources accept **https:// only**, any host. `http://`, `ssh://`, and `git@host:` scp-form all reject with clean per-scheme reasons (SP-3 message updates; ssh already has one).
- **D-76-02:** github.com URLs **always normalize to `github` kind**, regardless of entry form — CLI string, config declaration, or object-form `{"source": "url", "url": "https://github.com/..."}`. One canonical identity per repo; Device Flow auth keeps working for private github repos declared as url-kind; object-form url entries funnel through the existing parser.
- **D-76-03:** URL sources support `#ref` pinning at add time (`marketplace add https://host/repo.git#main`), parsed into `UrlSource.ref` and cloned singleBranch — exact parity with github-source `#ref` handling and upstream's documented syntax. `update` re-fetches the pinned ref.
- **D-76-04:** **Upstream-parity fold-in:** `owner/repo@ref` GitHub shorthand (documented upstream as `acme/tools@v2.0`) now parses to `github` kind with `ref` set. The SP-2 reject-with-hint is retired.
- **D-76-05:** MURL-02 dropped — no marketplace-level `git-subdir` in any surface (CLI, config, import). `marketplace add` of a git-subdir object source keeps rejecting as `{unsupported source}`.

**Clone plumbing (`add.ts` / `update.ts` / `platform/git.ts`)**
- **D-76-06:** url-kind sources clone `source.url` **verbatim** (direct clone); github-kind keeps the reconstructed `https://github.com/<owner>/<repo>.git`. `platform/git.ts` clone() doc contract widens beyond the github-only SP-3 wording.
- **D-76-07:** Phase 76 clones URL sources with **no auth bundle at all** — public repos only. No CredentialOps keychain fill for non-GitHub hosts, no provider flow. All non-GitHub auth wiring lands in Phase 79 in one place. GitHub-kind sources keep the existing hardcoded `host = "github.com"` Device Flow (the AUTH-D02 seams stay marked for Phase 79).

**Failure UX (closed-set catalog amendment)**
- **D-76-08:** New REASONS member **`authentication required`** — a deliberate closed-set amendment (REASONS tuple in `shared/notify.ts`, tripwire count bump in `tests/architecture/notify-closed-set-locks.test.ts`, catalog + style-guide rows). Rendered when a clone hits an HTTP auth challenge (401/403 HttpError from isomorphic-git — not an errno, so it falls through `classifyAddError` unclassified today). Error severity; cause chain carries the HTTP detail at 4-space indent. Phase 79's PROV-04 fail-clean case reuses this same token.

**Display (list/info surfaces)**
- **D-76-09:** `marketplace info` renders a kind-labeled **`url: <url>[#<ref>]`** attribute line for url sources, matching the `github:`/`path:` label==kind convention. `#ref` suffix only when originally specified.
- **D-76-10:** The `last_updated:` gate in `marketplace info` widens from `sourceKind === "github"` to **all git-backed kinds** (github + url); path sources still never render it (INFO-01 amendment).
- **D-76-11:** `marketplace list` needs no change — list-surface headers carry no source line. Pre-name failure subjects render the verbatim user-typed URL, as add failures do today.

**Config & import (MURL-06 / MURL-07)**
- **D-76-12:** With MURL-02 dropped, `MARKETPLACE_CONFIG_ENTRY_SCHEMA.source` stays `Type.String()` — a URL source is just a string (`"https://host/repo.git#ref"` with optional fragment). No object-form schema widening for marketplaces.
- **D-76-13:** `import` maps `extraKnownMarketplaces` entries with the upstream **url shape** (`{"source": {"source": "url", "url": ..., "ref"?, "sha"?}}`). The `file` shape (remote marketplace.json URL) stays out of scope and keeps its unmappable-marketplace diagnostic.

### Claude's Discretion
- `.git`-suffix identity: whether `https://host/repo.git` and `https://host/repo` compare equal in `samePlannedSource`/dedupe — pick the simplest truthful rule and document it.
- No pre-clone URL validation beyond scheme/shape parsing — the clone failure is the signal (fail-clean, NFR-3).
- Exact HttpError-statusCode detection mechanics in `classifyAddError` (which isomorphic-git error shape/codes map to `authentication required`).
- Whether `samePlannedSource`'s currently-`c8 ignore`d url arm needs ref-aware comparison parity with the github arm (it should — mirror the github rule).

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope. (The one candidate, `owner/repo@ref` shorthand parity, was folded INTO this phase per D-76-04 rather than deferred.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MURL-01 | `marketplace add` an arbitrary public HTTPS git URL (`url` kind); cloned directly from `source.url` (no github.com reconstruction) | `domain/source.ts` string parser gains an `https://` non-github arm (D-76-01); `add.ts` S5b gate admits `url`; new `addUrlInGuard` mirrors `addGithubInGuard` but sets `cloneUrl = source.url` and passes **no** `auth` bundle (D-76-06/07). `UrlSource` variant already exists. |
| MURL-03 | `marketplace update` re-fetches URL-sourced marketplaces with same atomic-swap semantics as GitHub | `update.ts::refreshRecord` gains a `url` arm calling `refreshGitHubClone(cloneDir, source.ref, gitOps, cb)` with **no** auth. The helper is clone-URL-agnostic (operates on an existing on-disk clone via `origin` remote) — rename it or reuse as-is. |
| MURL-04 | `marketplace remove` deletes URL-sourced clones and state | `remove.ts` `RecordedSourceKind` union (`"github" \| "path" \| "unknown"`) must admit `"url"`; the clone-deletion gate at `sourceKindAtRecord === "github"` must widen to `github \|\| url` (both have a `sources/<name>/` clone). |
| MURL-05 | `marketplace list` / `info` render URL sources with correct display | `list`: no change (D-76-11). `info`: `MarketplaceInfoMessage.source` union gains a `url` arm; `buildBlock` in `info.ts` adds a `url` branch (today ALL non-github kinds collapse to `path`); renderer `renderMarketplaceInfo` adds a `url:` case + widens the `last_updated:` gate (D-76-09/10). |
| MURL-06 | `claude-plugins.json` config declarations with URL sources reconcile at load time | Schema stays `Type.String()` (D-76-12). The reconcile planner (`orchestrators/reconcile/plan.ts`) already routes declared sources through `parsePluginSource` → `samePlannedSource`; the parser widening flows through automatically. The `samePlannedSource` `url` arm (currently `c8 ignore`d) becomes live and must mirror the github ref-aware rule. |
| MURL-07 | `import` maps `extraKnownMarketplaces` entries with URL sources | `orchestrators/import/marketplaces.ts::marketplaceSourceFromExtra` must read the upstream nested `{source: {source: "url", url, ref?, sha?}}` shape (D-76-13). See the schema-mismatch open question below. |
</phase_requirements>

## Summary

This is a **surface-widening phase, not a new-capability phase**. Every mechanism it needs already exists in the tree and works for `github` sources; the phase's job is to admit a fifth well-known source form (`url`) through gates that currently reject it and to render it on the info surface. The `UrlSource` discriminated-union variant, the object-form url parser (`urlObjectSource`), the `sourceLogical` url arm, the clone-per-marketplace staging/atomic-rename lifecycle, and the `isomorphic-git` clone/fetch primitives are all present and source-kind-agnostic once the clone URL is chosen. The blast radius is a set of `kind === "github"` gate-widenings plus one new closed-set REASONS token.

No external dependencies are added. `isomorphic-git@1.38.5` already accepts an arbitrary URL in `git.clone({url})`; the only reason it's restricted to github.com today is the string parser and the call-site gates, not the library. Confirmed: `platform/git.ts::clone()` passes `opts.url` straight through with no host inspection.

The one genuinely new artifact is the `authentication required` REASONS member (D-76-08). It exists because a public-only clone that hits a private/nonexistent repo receives an isomorphic-git `HttpError` (`.code === "HttpError"`, `.data.statusCode` 401/403), which is **not** an errno — so `classifyAddError`'s current errno-only ladder drops it through to the misleading `unparseable` fallback. VERIFIED against the installed library source: isomorphic-git throws `HttpError` with message `HTTP Error: 401 ...` and treats `statusCode === 401` (and 203 for Azure DevOps) as the access-denied signal.

**Primary recommendation:** Follow the existing `github` seam pattern verbatim for each surface, substituting `source.url` for the reconstructed clone URL and omitting the auth bundle. Add exactly one REASONS token and one `HttpError`-detection arm in `classifyAddError`. Mirror the github arm in every `kind ===` switch rather than inventing new control flow.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse `https://host/repo.git#ref` → `UrlSource` | `domain/source.ts` (pure parser) | — | The syntactic gate; character-level, no I/O. Already has the `UrlSource` type + object-form parser. |
| Choose clone URL (`source.url` verbatim vs github reconstruction) | `orchestrators/marketplace/{add,update}.ts` | `platform/git.ts` | Orchestrator selects the URL and auth policy; platform executes the clone. |
| Execute clone/fetch | `platform/git.ts` (isomorphic-git wrapper) | — | Only file allowed to import isomorphic-git (D-13). URL-agnostic already. |
| Classify clone failure → closed-set reason | `orchestrators/marketplace/add.ts::classifyAddError` | `shared/notify.ts` (REASONS) | Reason classification is orchestrator logic; the closed-set vocabulary lives in notify. |
| Render `url:` info line + `last_updated:` gate | `shared/notify.ts::renderMarketplaceInfo` | `orchestrators/marketplace/info.ts::buildBlock` | notify is a dumb renderer; `buildBlock` decides the source projection. |
| Reconcile config-declared url source | `orchestrators/reconcile/plan.ts` | `domain/source.ts::samePlannedSource` | Planner delegates identity comparison to the pure `samePlannedSource` helper. |
| Map `extraKnownMarketplaces` url entry | `orchestrators/import/marketplaces.ts` | `domain/source.ts` | Import projects the Claude-settings shape into a source string the parser accepts. |

## Standard Stack

No new libraries. This phase is entirely in-tree TypeScript against the already-pinned stack.

### Core (already installed — carry forward unchanged)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `isomorphic-git` | `1.38.5` | Pure-JS clone/fetch; already URL-agnostic | The `git.clone({url})` call already accepts any URL. No host gate in the library. `HttpError` carries `.data.statusCode` for the D-76-08 auth-challenge detection. [VERIFIED: node_modules/isomorphic-git/package.json + index.cjs:3740] |
| `typebox` | `^1.1.38` (peer) | Config schema validation | `MARKETPLACE_CONFIG_ENTRY_SCHEMA.source` stays `Type.String()` (D-76-12) — no schema change needed. [VERIFIED: persistence/config-io.ts:46] |
| `@earendil-works/pi-coding-agent` | `^0.79.0` | Extension host (notify) | Renderer output flows through `ctx.ui.notify`. [ASSUMED — from MEMORY.md pkg migration note; not load-bearing for this phase] |

**Installation:** None. `npm install` unchanged.

## Package Legitimacy Audit

Not applicable — this phase installs **no external packages**. The only dependency touched (`isomorphic-git`) is already a committed, in-use direct dependency (npm CLI-ecosystem standard git library, 1.38.5, widely used). No audit table required.

## Architecture Patterns

### System Data Flow (marketplace add of a URL source)

```
user: marketplace add https://gitlab.com/acme/mp.git#main
        │
        ▼
edge layer ──► addMarketplace(opts)
        │
        ▼
parsePluginSource("https://gitlab.com/acme/mp.git#main")
        │   (domain/source.ts — NEW arm: https:// non-github)
        ▼
   UrlSource{ kind:"url", url:"https://gitlab.com/acme/mp.git", ref:"main" }
        │
        ▼
runAddInGuard ──► S5b gate: kind ∈ {github, path, url}?  (WIDENED to admit url)
        │                              │ no → UnsupportedSourceError → (failed){unsupported source}
        ▼ (url)
withLockedStateTransaction
        │
        ▼
addUrlInGuard (NEW — mirrors addGithubInGuard):
        │   cloneUrl = source.url        ← D-76-06 verbatim, NOT reconstructed
        │   auth     = <omitted>          ← D-76-07 public-only, no bundle
        │
        ├─► gitOps.clone({ dir:staging, url:cloneUrl, ref?, singleBranch? })
        │        │ 401/403 HttpError ──► classifyAddError ──► "authentication required"  (D-76-08 NEW)
        │        │ ENETUNREACH/... ─────► "network unreachable"
        │        ▼ ok
        ├─► loadMarketplaceManifest(staging/.claude-plugin/marketplace.json) → derivedName
        ├─► MA-8 duplicate-name check; MA-6 stale-clone check
        ├─► rename(staging, sources/<derivedName>/)   ← atomic, same-FS
        ├─► state.marketplaces[derivedName] = { source: UrlSource, ... }
        └─► config write-back: source = rawSource verbatim
        │
        ▼
notify: ● <derivedName> [scope] (added)
```

### Pattern 1: Mirror the github arm, substitute URL + drop auth
**What:** For every `if (source.kind === "github")` branch touched by this phase, add a sibling `url` branch that differs in exactly two ways: (1) `cloneUrl = source.url` instead of `` `https://github.com/${owner}/${repo}.git` ``, and (2) **no** `auth` bundle constructed or passed.
**When to use:** `add.ts` (new `addUrlInGuard`), `update.ts::refreshRecord` (new `url` arm), `remove.ts` (widen clone-deletion gate).
**Example (add, distilled from `addGithubInGuard` at add.ts:581):**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:592-625 (github original)
// url variant: cloneUrl verbatim, no auth bundle (D-76-06 / D-76-07)
async function addUrlInGuard(args: { /* ctx, state, locations, source: UrlSource, gitOps, cwd */ }): Promise<string> {
  const stagingDir = await locations.sourcesStagingDir(randomUUID());
  const cloneUrl = source.url;               // D-76-06: verbatim, no reconstruction
  try {
    await gitOps.clone({
      dir: stagingDir,
      url: cloneUrl,
      ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
      // D-76-07: NO auth bundle — public-only in Phase 76.
    });
  } catch (err) {
    const leak = await cleanupStaging(stagingDir, "marketplace clone staging");
    throw appendLeakToError(err, leak);
  }
  // ... manifest read + MA-8 + MA-6 + atomic rename + state mutation:
  //     IDENTICAL to addGithubInGuard from this point on.
}
```

**Refactor note (recommended, not required):** `addGithubInGuard` and `addUrlInGuard` differ only in the `cloneUrl` computation and the auth bundle. Consider extracting a shared `addGitClonedInGuard(cloneUrl, auth?)` that both call, rather than copy-pasting the 100-line manifest/rename/state body. This keeps the MA-9 cleanup discipline (append-leak-not-mask) in one place. The planner should weigh this against the project's surgical-change bias.

### Pattern 2: `authentication required` is a new closed-set token, wired in three lockstep places
**What:** Adding a REASONS member is never a one-file change in this codebase — the closed-set catalog is gate-enforced.
**When to use:** D-76-08 only.
**The three lockstep edits (all in the same commit):**
1. `shared/notify.ts` — append `"authentication required"` to the `REASONS` tuple (currently 32 entries ending with `"orphan rewake"`). [VERIFIED: shared/notify.ts:89-130]
2. `tests/architecture/notify-closed-set-locks.test.ts` — bump `assert.equal(REASONS.length, 32)` → `33`. This assertion is the deliberate tripwire. [VERIFIED: notify-closed-set-locks.test.ts:29-30]
3. `docs/output-catalog.md` + `docs/messaging-style-guide.md` — add the catalog row + closed-set contract row.

### Pattern 3: `classifyAddError` needs an HttpError arm ABOVE the errno ladder
**What:** The current `classifyAddError` (add.ts:233) only inspects `(err as NodeJS.ErrnoException).code` for errno strings. An isomorphic-git auth challenge is an `HttpError` whose `.code === "HttpError"` (a string, not an errno) and whose `.data.statusCode` is 401/403 — it falls through to `undefined` → `unparseable` today.
**Example:**
```typescript
// Source: derived from isomorphic-git/index.cjs:3740 (HttpError shape) +
//         add.ts:251-274 (existing errno ladder). Place BEFORE the errno checks.
if (err instanceof Error) {
  // isomorphic-git HttpError: code === "HttpError", data.statusCode carries the HTTP status.
  const statusCode = (err as { data?: { statusCode?: number } }).data?.statusCode;
  if ((err as NodeJS.ErrnoException).code === "HttpError" &&
      (statusCode === 401 || statusCode === 403)) {
    return "authentication required";
  }
  // ... existing errno ladder (ENOENT, ENETUNREACH, ...) follows.
}
```
**Boundary note (D-13):** `classifyAddError` lives in the orchestrator tier, which must NOT import `isomorphic-git`. Detect via the string `code === "HttpError"` + duck-typed `.data.statusCode` — mirror the existing `isGitNotFoundError` name-check idiom in `shared.ts:159` (which matches `err.name === "NotFoundError"` without importing the library). [VERIFIED: shared.ts:159-161]

### Pattern 4: The github clone URL is reconstructed; the url clone URL is verbatim
**What:** `addGithubInGuard` builds `` const cloneUrl = `https://github.com/${source.owner}/${source.repo}.git` `` (add.ts:593) because `GitHubSource` stores `owner`/`repo`, not a URL. `UrlSource` stores `url` directly, so the url arm uses it verbatim (D-76-06). This is the single most important behavioral distinction and the crux of MURL-01.

### Anti-Patterns to Avoid
- **Reusing `network unreachable` for a 401.** Truthful-attribution discipline (v1.10 ATTR) forbids it — a 401 is an auth failure, not a network failure. That is exactly why D-76-08 mints a new token. The user reached the server; the server said "authenticate."
- **Constructing an auth bundle for url sources "to be safe."** D-76-07 is explicit: Phase 76 clones url sources with **no auth bundle at all**. Any `credentialOps`/`onAuthRequired` wiring for non-github hosts belongs to Phase 79. Adding it now would create dead auth paths and expand the no-credential-leak gate prematurely.
- **Widening `MARKETPLACE_CONFIG_ENTRY_SCHEMA` to an object.** D-76-12: a url marketplace source is just a string. Object-form schema widening was tied to the dropped MURL-02.
- **Collapsing url into the `path` arm in `info.ts::buildBlock`.** Today ALL non-github kinds fall into the `path` arm (info.ts:59-67) — that would render a url source as `path: <marketplaceRoot>` (a local clone dir), which is wrong. The url arm must render `url: <url>[#ref]` (D-76-09).
- **Normalizing github.com URLs to `url` kind.** D-76-02: github.com always normalizes to `github` kind regardless of entry form, so Device Flow keeps working. The parser's existing `raw.startsWith("https://github.com/")` branch (source.ts:270) already does this and must be checked BEFORE the new generic-https arm.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL scheme/host validation | A regex URL validator | The existing character-level parser arms + `new URL()` only if needed | The parser already distinguishes `git@`, `://`, `https://github.com/`, path forms. Add ONE arm for generic `https://`. |
| Clone-URL fetch/checkout for update | A url-specific update path | `refreshGitHubClone(cloneDir, ref, gitOps, cb)` unchanged | It operates on an existing on-disk clone via the `origin` remote — the original clone URL is irrelevant to the fetch. Only pass no `auth`. [VERIFIED: shared.ts:179-248] |
| Atomic clone-into-place | A new staging mechanism | The existing `sourcesStagingDir` + `rename` in `addGithubInGuard` | Same-FS staging + atomic rename already satisfies NFR-1. |
| Auth-challenge detection | Substring-matching the error message | `err.code === "HttpError"` + `err.data.statusCode` | isomorphic-git sets a stable `.code` string and structured `.data`; message text is not a contract. [VERIFIED: index.cjs:3740-3743] |

**Key insight:** Once the clone URL and auth policy are chosen, every downstream step (manifest validation, duplicate-name, stale-clone, atomic rename, state record, config write-back, remove, info) is already source-kind-uniform. The phase is a set of gate-widenings, not a re-implementation.

## Runtime State Inventory

> This is a feature-addition phase, not a rename/refactor/migration. No renamed strings, no re-keyed datastores, no OS-registered state. State records written by `add` carry the new `UrlSource` object shape (`kind:"url"`), which the `ST-6` factory funnel re-validates on load — but that is forward-only (new records), not a migration of existing records. Existing github/path records are untouched.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` gains marketplace records with `source.kind === "url"` for newly-added url marketplaces. Existing records unchanged. | None — forward-only write. No migration of existing state. |
| Live service config | None — no external service holds a renamed string. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — D-76-07 adds no credential storage (public-only). | None (Phase 79 will add host-keyed credentials). |
| Build artifacts | None. | None. |

**Nothing found in categories 2–5:** verified by grep — this phase writes only to `state.json`, `claude-plugins.json`, and the `sources/<name>/` clone dir, all already governed by NFR-10 containment.

## Common Pitfalls

### Pitfall 1: github.com URL entered as object-form `url` source not normalizing to `github`
**What goes wrong:** A config declaration `{"source": {"source": "url", "url": "https://github.com/acme/mp"}}` produces a `UrlSource` that clones without Device Flow, breaking private-github auth.
**Why it happens:** The object-form url parser (`urlObjectSource`, source.ts:136) builds a `UrlSource` unconditionally; it doesn't re-check for github.com.
**How to avoid:** D-76-02 requires `urlObjectSource` to detect `https://github.com/` and funnel through the github parser instead — one canonical identity per repo. Add the github-host check at the top of `urlObjectSource` (and the CLI-string arm already checks github FIRST, so string entry is safe).
**Warning signs:** A github.com marketplace added as url-kind can't refresh a private repo (no Device Flow trigger).

### Pitfall 2: `remove.ts` orphaning a url-source clone
**What goes wrong:** `marketplace remove` of a url marketplace deletes state but leaves the `sources/<name>/` clone on disk, causing the next `add` of the same repo to fail MA-6 `{stale clone}` forever (NFR-3 violation).
**Why it happens:** The clone-deletion branch gates on `sourceKindAtRecord === "github"` (remove.ts:722) and `RecordedSourceKind` (remove.ts:85) is `"github" | "path" | "unknown"` — a url record maps to `undefined` and skips deletion.
**How to avoid:** Widen `RecordedSourceKind` to include `"url"`, admit it in the detection at remove.ts:513, and change the deletion gate to `=== "github" || === "url"` (both have a clone; path sources never do).
**Warning signs:** Re-adding a removed url marketplace fails with `{stale clone}`.

### Pitfall 3: `.git`-suffix identity mismatch in reconcile/dedupe
**What goes wrong:** A config declares `https://host/repo` but state stored `https://host/repo.git` (or vice versa); `samePlannedSource` returns `"different"`, triggering a spurious remove-then-re-add on every load.
**Why it happens:** `sourceLogical` for a url source returns `` `${source.url}${refSuffix}` `` verbatim (source.ts:461) — `.git` is part of the string, so the two forms don't compare equal.
**How to avoid (Claude's Discretion resolution):** The **simplest truthful rule** is to normalize a single trailing `.git` at parse time in the url arm (mirror the github parser, which already strips `.git` at source.ts:333). Store the stripped form in `UrlSource.url` so `sourceLogical` and `samePlannedSource` compare canonically. Document the rule in the parser comment. This also makes the `samePlannedSource` url arm (currently `c8 ignore`d) correct and testable.
**Warning signs:** A url marketplace declared in config gets removed+re-added on every `/reload`.

### Pitfall 4: `samePlannedSource` url arm not ref-aware
**What goes wrong:** `https://host/repo#main` and `https://host/repo#dev` compare equal (both same repo), so a ref change in config doesn't reconcile.
**Why it happens:** The `c8 ignore`d url arm delegates to `sourceLogical` equality (source.ts:433-436), which DOES include the ref suffix — so it's actually ref-aware already **iff** `sourceLogical` is used. Verify the arm stays on the `sourceLogical`-equality path (it does today) and add a test.
**How to avoid (Claude's Discretion resolution):** Yes — mirror the github rule. The current `sourceLogical`-based comparison already gives ref-aware parity; just remove the `c8 ignore` and add coverage.
**Warning signs:** Changing `#ref` in `claude-plugins.json` for a url marketplace is a silent no-op on reconcile.

### Pitfall 5: `import` reading the wrong `extraKnownMarketplaces` shape
**What goes wrong:** `marketplaceSourceFromExtra` returns `undefined` for a url entry, emitting `unmappable-marketplace-source` even though the entry is valid.
**Why it happens:** The current code reads `entry.directory` (string) and `entry.github.repo` (nested) — a FLAT shape — but the documented upstream `extraKnownMarketplaces` uses a nested `{source: {...}}` shape. See Open Question 1.
**How to avoid:** D-76-13 requires adding a `source: {source:"url", url, ref?, sha?}` reader. Return a URL string (`url` + optional `#ref`) the parser accepts. Keep the `file` shape unmappable.
**Warning signs:** `import` skips a url marketplace that Claude settings declared.

## Code Examples

### info.ts: add the `url` source projection (D-76-09)
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts:58-67 (current)
// The current code collapses ALL non-github kinds into the `path` arm.
// NEW: branch url BEFORE the path fallback.
const src = record.source as ParsedSource;
const source: MarketplaceInfoMessage["source"] =
  src.kind === "github"
    ? { sourceKind: "github", owner: src.owner, repo: src.repo, ...(src.ref !== undefined && { ref: src.ref }) }
    : src.kind === "url"
      ? { sourceKind: "url", url: src.url, ...(src.ref !== undefined && { ref: src.ref }) }
      : { sourceKind: "path", absPath: record.marketplaceRoot };
```

### notify.ts: add the `url:` render case + widen last_updated gate (D-76-09 / D-76-10)
```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:2899-2923 (current switch)
switch (message.source.sourceKind) {
  case "github": {
    const refSuffix = message.source.ref === undefined ? "" : `#${message.source.ref}`;
    lines.push(`github: ${message.source.owner}/${message.source.repo}${refSuffix}`);
    break;   // last_updated moved out (see below)
  }
  case "url": {   // NEW (D-76-09)
    const refSuffix = message.source.ref === undefined ? "" : `#${message.source.ref}`;
    lines.push(`url: ${message.source.url}${refSuffix}`);
    break;
  }
  case "path":
    lines.push(`path: ${message.source.absPath}`);
    break;
  default:
    assertNever(message.source);
}
// D-76-10: last_updated renders for ALL git-backed kinds (github + url), NOT path.
if (message.source.sourceKind !== "path" && message.details.lastUpdatedAt !== undefined) {
  lines.push(`last_updated: ${message.details.lastUpdatedAt}`);
}
```
**Also required:** widen the `MarketplaceInfoMessage["source"]` union type (notify.ts:1114-1126) to add the `{ sourceKind: "url"; url: string; ref?: string }` arm.

### source.ts: the new generic-https parser arm (D-76-01)
```typescript
// Source: extensions/pi-claude-marketplace/domain/source.ts:269-277 (insertion point)
// github check FIRST (D-76-02 canonical identity), THEN generic https, THEN reject.
if (raw.startsWith("https://github.com/")) {
  return parseGitHubUrl(raw);           // existing — unchanged
}
if (raw.startsWith("https://")) {       // NEW (D-76-01): any non-github https host
  return parseUrlSource(raw);           // strip trailing .git, split off #ref → UrlSource
}
// SP-3: reject http://, ssh://, git@host: with per-scheme reasons (message updates).
if (raw.startsWith("git@") || raw.includes("://")) {
  return { kind: "unknown", raw, reason: unsupportedUrlReason(raw) };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `owner/repo@ref` rejected with SP-2 hint | Parses to `github` kind + `ref` | D-76-04 (this phase) | Upstream-parity fold-in; retire `ownerRepoAtRefReason` reject. |
| `url`/`git-subdir`/`npm` kinds all `(failed) {unsupported source}` on marketplace add | `url` admitted; `git-subdir`/`npm` still rejected | D-76-05 (this phase) | S5b gate widens to admit `url` only. |
| `last_updated:` on github info only | github + url info | D-76-10 (this phase) | Gate widens to all git-backed kinds. |

**Deprecated/outdated by this phase:**
- `unsupportedUrlReason` message (`"only github URLs and local paths are accepted"`, source.ts:83) — no longer truthful once url sources are accepted. Update to name the rejected schemes (http/ssh/scp-form) specifically.
- SP-2 `ownerRepoAtRefReason` reject path — retired by D-76-04.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@earendil-works/pi-coding-agent ^0.79.0` is the current host pkg | Standard Stack | Low — not load-bearing; notify surface is stable regardless of exact host version. Sourced from MEMORY.md, not re-verified this session. |
| A2 | Upstream `extraKnownMarketplaces` url entry uses nested `{source: {source:"url", url, ref?, sha?}}` shape | Open Q1 / MURL-07 | Medium — if the real Claude-settings shape differs, the import mapper reads the wrong keys. CONTEXT.md flags this explicitly for verification against real-world settings. Mitigated by D-76-13 citing the official docs. |

## Open Questions

1. **`extraKnownMarketplaces` shape: nested vs flat.**
   - What we know: CONTEXT.md canonical-refs cite `https://code.claude.com/docs/en/plugin-marketplaces.md` documenting `extraKnownMarketplaces` source shapes as `github` (repo, ref?, sha?), `url` (url, ref?, sha?), `directory` (path), `file` (url). The current `marketplaceSourceFromExtra` (import/marketplaces.ts:33) reads a FLAT shape: `entry.directory` and `entry.github.repo`. CONTEXT.md explicitly notes: *"current code reads `entry.directory` / `entry.github.repo`, which does not match the documented upstream nested `{source: {...}}` shape — researcher must verify which shapes exist in the wild and whether both must be read."*
   - What's unclear: Whether real Claude `settings.json` files use `{"mp-name": {"source": {"source": "github", "repo": "..."}}}` (nested) or `{"mp-name": {"github": {"repo": "..."}}}` (flat), or BOTH across versions. The existing code and the official docs disagree.
   - Recommendation: The planner should include a `checkpoint:human-verify` or a doc re-fetch task to confirm the shape against a real exported Claude `settings.json` before implementing MURL-07. Safest implementation reads BOTH the flat legacy shape (preserve current github/directory behavior) AND the nested `source:{...}` shape (add url + github + directory), so no existing import regresses. Per "verify upstream before design options" (MEMORY.md), re-fetch `code.claude.com/docs` during planning rather than guessing.

2. **Whether to extract a shared `addGitClonedInGuard` or copy the github body.**
   - What we know: `addGithubInGuard` and the new `addUrlInGuard` differ only in `cloneUrl` + auth bundle; ~100 lines of manifest/rename/state/MA-9-cleanup are identical.
   - What's unclear: Whether the project's surgical-change bias prefers a copy (localized, lower blast radius) or a shared helper (DRY, single MA-9 discipline).
   - Recommendation: Extract a shared helper parameterized by `(cloneUrl, auth?)`. The MA-9 append-leak-not-mask cleanup is subtle enough that duplicating it invites drift. Present as a plan decision.

## Environment Availability

> Skipped for external tooling — this phase adds no new external dependencies, tools, or services. `isomorphic-git@1.38.5` is already installed and in use. Node/TypeScript toolchain unchanged. Network is used only by the existing clone/fetch paths (already gated by NFR-5), now reaching non-github hosts.

## Validation Architecture

> nyquist_validation is enabled (config.json: `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` (TS via native strip) |
| Config file | none (globs in `package.json` scripts) |
| Quick run command | `node --test "tests/domain/source.test.ts"` (or the specific new test file) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MURL-01 | `https://host/repo.git#ref` parses to `UrlSource{url,ref}`; github.com stays `github` | unit | `node --test "tests/domain/source.test.ts"` | ✅ (extend) |
| MURL-01 | add clones `source.url` verbatim, no auth bundle | orchestrator | `node --test "tests/orchestrators/marketplace/add.test.ts"` | ✅ (extend) |
| MURL-03 | update re-fetches url source, atomic swap, no auth | orchestrator | `node --test "tests/orchestrators/marketplace/update.test.ts"` | ✅ (extend) |
| MURL-04 | remove deletes url clone + state | orchestrator | `node --test "tests/orchestrators/marketplace/remove.test.ts"` | ✅ (extend) |
| MURL-05 | info renders `url: <url>[#ref]` + last_updated; list unchanged | orchestrator + catalog UAT | `node --test "tests/orchestrators/marketplace/info.test.ts"` + `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ (extend) |
| MURL-06 | config-declared url source reconciles (no spurious remove/re-add); `.git`-suffix + ref parity | domain + reconcile | `node --test "tests/domain/source.test.ts"` (samePlannedSource url arm) + reconcile test | ✅ (extend; remove `c8 ignore`) |
| MURL-07 | import maps `extraKnownMarketplaces` url entry | import | `node --test "tests/orchestrators/import/*.test.ts"` | ✅ (extend) |
| D-76-08 | `authentication required` in closed set; count tripwire bumps to 33 | architecture | `node --test "tests/architecture/notify-closed-set-locks.test.ts"` | ✅ (edit) |
| D-76-08 | 401/403 HttpError classifies to `authentication required` (not `unparseable`/`network unreachable`) | orchestrator | `node --test "tests/orchestrators/marketplace/add.test.ts"` | ✅ (extend) |

### Sampling Rate
- **Per task commit:** the specific new/edited test file (e.g. `node --test "tests/domain/source.test.ts"`).
- **Per wave merge:** `npm test` (unit suite).
- **Phase gate:** `npm run check` fully green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Extend `tests/domain/source.test.ts` — generic-https parsing, github.com-normalizes-to-github (string + object form), `.git`-suffix canonicalization, `samePlannedSource` url arm (drop `c8 ignore`).
- [ ] Extend `tests/orchestrators/marketplace/add.test.ts` — url clone verbatim + no-auth + 401→`authentication required`.
- [ ] Extend `tests/orchestrators/marketplace/{update,remove,info}.test.ts` — url arms.
- [ ] Extend `tests/architecture/catalog-uat.test.ts` — `url-source` add fixture, `info` url byte form, `authentication required` failure fixture.
- [ ] Edit `tests/architecture/notify-closed-set-locks.test.ts` — bump REASONS length 32→33.
- [ ] Extend `tests/orchestrators/import/*.test.ts` — url `extraKnownMarketplaces` mapping (pending Open Q1 shape confirmation).

*A `git-source` mock-`GitOps` fixture and staging-dir harness already exist for the github tests; the url tests reuse them with a non-github URL and an omitted auth bundle.*

## Security Domain

> `security_enforcement` is not explicitly `false` in config → enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Phase 76 is **public-only** (D-76-07) — no credentials handled for non-github hosts. github Device Flow unchanged. Non-github auth is Phase 79. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No access-control surface added. |
| V5 Input Validation | **yes** | The url string is validated syntactically (`https://` only, D-76-01) then handed to `isomorphic-git` clone. Manifest content validated by `MARKETPLACE_VALIDATOR` (existing). |
| V6 Cryptography | no | No crypto in this phase (SHA hash-versions are a plugin-source concept, Phase 77). |
| V12 File / Resource | **yes** | Clone writes to `sources/<name>/` under scopeRoot — NFR-10 containment already enforced by the existing staging+rename path (source-kind-agnostic). No new write targets. |

### Known Threat Patterns for {git-URL clone of arbitrary public host}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF-ish clone of an internal `https://` host | Information disclosure | Out of Phase 76 scope to block (public-repo utility requires arbitrary hosts); `https://` only (D-76-01) blocks `file://`/`ssh://` local-resource reach. No pre-clone probe (fail-clean is the signal). |
| Credential leak in a clone error surfaced to the user | Information disclosure | D-76-07: no credentials handled at all in this phase → nothing to leak. The `authentication required` reason carries only the HTTP status detail (401/403 statusMessage), never a token. The no-credential-leak architecture gate needs **no** expansion (no new auth files) until Phase 79 — verify this stays true. |
| Malicious `marketplace.json` in a cloned repo | Tampering | Existing `MARKETPLACE_VALIDATOR.Check()` on the staged manifest before atomic rename — unchanged, source-kind-agnostic. |
| Path traversal via crafted repo contents | Tampering | NFR-10 `assertPathInside` + the clone landing in a fixed `sources/<derivedName>/` dir — unchanged. |

**No-credential-leak gate:** Phase 76 adds no file that interpolates a token into an error/notification (public-only). Confirm the `tests/architecture/no-credential-leak.test.ts` scan needs no new file entry. [CONTEXT.md code_context confirms: "Phase 76 adds no new auth files (public-only), so no gate expansion until Phase 79."]

## Project Constraints (from CLAUDE.md)

- **Runtime:** Node >= 20.19.0 (NFR-4). No new syntax requiring a higher floor.
- **TypeScript strict:** the `installable`/source discriminated unions must stay sound — the new `UrlSource` info arm and REASONS token must narrow via the discriminator, no casts beyond the existing `record.source as ParsedSource`.
- **All disk mutations atomic** (NFR-1): reuse the existing staging + rename. Do NOT introduce a non-atomic clone-into-place.
- **No Pi restart for recovery** (NFR-2) / **all ops idempotent-or-fail-clean** (NFR-3): the `.git`-suffix canonicalization (Pitfall 3) and the remove-clone-deletion widening (Pitfall 2) are both NFR-3 correctness fixes — a stale url clone must not permanently block re-add.
- **Network policy** (NFR-5): `list`, `info`, `remove`, path-source ops stay network-free. Only `add`/`update` of git-backed sources touch the network — url sources now reach non-github hosts, still gated identically.
- **Containment** (NFR-10): no new write targets beyond `sources/`, `state.json`, `claude-plugins.json[.local]`.
- **Output channel** (IL-2): all user-visible messages through `notify()` → `ctx.ui.notify`; the renderer stays a dumb renderer (MEMORY.md: notify.ts must not probe state — `buildBlock` decides the url projection, the renderer only formats it).
- **Quality bar** (NFR-6): `npm run check` green.
- **Comment policy** (`.claude/rules/typescript-comments.md`): tag new code with decision/requirement IDs (`D-76-01`, `MURL-01`, `NFR-5`), NEVER with `Phase 76`/`Plan`/`Wave` planning refs. Domain-word `phase` (e.g. transaction phases) is exempt.
- **Closed-set discipline** (MEMORY.md): `authentication required` is a catalog amendment — REASONS tuple + length tripwire + catalog rows + style-guide row in ONE commit. Reason token must be truthful (a 401 is auth, not network).
- **Git:** never commit to main; branch `features/*`; run `pre-commit run` before commit; `SKIP=trufflehog` prefix only inside a worktree.

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/domain/source.ts` — full parser, `UrlSource` type, `urlObjectSource`, `sourceLogical` url arm, `samePlannedSource` url arm (`c8 ignore`d). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — `addGithubInGuard` clone-URL reconstruction (line 593), S5b gate (line 343), `classifyAddError` errno-only ladder (line 233, no HttpError arm). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` — `refreshRecord` github/path arms (line 361/397), unsupported-kind throw (line 400). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` — `RecordedSourceKind` (line 85), kind detection (line 513), clone-deletion github gate (line 722). [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` — `buildBlock` non-github→path collapse (line 59-67). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` — `refreshGitHubClone` clone-URL-agnostic mechanics (line 179), `isGitNotFoundError` name-check idiom (line 159), `GitAuthBundle`/`GitOps` (line 76/103). [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/platform/git.ts` — `clone()` passes `opts.url` verbatim, no host gate (line 107); auth optional (line 121). [VERIFIED: read in full]
- `extensions/pi-claude-marketplace/shared/notify.ts` — REASONS 32-tuple (line 89-130), `MarketplaceInfoMessage.source` union (line 1114-1126), `renderMarketplaceInfo` switch + last_updated gate (line 2896-2930). [VERIFIED: read relevant regions]
- `extensions/pi-claude-marketplace/persistence/config-io.ts` — `MARKETPLACE_CONFIG_ENTRY_SCHEMA.source = Type.String()` (line 46). [VERIFIED: grep]
- `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts` — `marketplaceSourceFromExtra` flat-shape reader (line 33-48). [VERIFIED: read in full]
- `node_modules/isomorphic-git/index.cjs` — `HttpError` constructor (line 3740): message `HTTP Error: <status> <msg>`, `.data.statusCode`, `.code === "HttpError"`; 401/203 access-denied handling (line 9080-9082). [VERIFIED: grep]
- `tests/architecture/notify-closed-set-locks.test.ts` — `REASONS.length === 32` tripwire (line 29-30). [VERIFIED: grep]
- `.claude/rules/typescript-comments.md` — comment traceability policy. [VERIFIED: read in full]
- `.planning/config.json` — nyquist_validation enabled, commit_docs true. [VERIFIED: read]

### Secondary (MEDIUM confidence)
- `docs/output-catalog.md` — `marketplace add`/`info` byte forms and REASONS routing table (sections at line 1066+). [VERIFIED: grep structure]
- CONTEXT.md canonical-refs citing `code.claude.com/docs/en/plugin-marketplaces.md` for upstream `extraKnownMarketplaces` shapes. [CITED via CONTEXT.md — recommend re-fetch during planning per Open Q1]

### Tertiary (LOW confidence)
- MEMORY.md host-package migration note (`@earendil-works/pi-coding-agent ^0.79.0`). [ASSUMED — not load-bearing]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; isomorphic-git behavior verified against installed source.
- Architecture: HIGH — every seam read in full; the phase mirrors an existing, verified github pattern.
- Pitfalls: HIGH — each pitfall traced to a specific line and gate in the current code.
- Import mapping (MURL-07): MEDIUM — the `extraKnownMarketplaces` shape has a documented code/docs disagreement (Open Q1); flagged for planning-time verification.

**Research date:** 2026-07-11
**Valid until:** 2026-08-10 (stable in-tree domain; the only external drift risk is isomorphic-git's `HttpError` shape, pinned at 1.38.5).
