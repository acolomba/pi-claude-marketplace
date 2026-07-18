# Phase 76: Marketplace git-URL sources - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 11 (all modified; no new files)
**Analogs found:** 11 / 11 (all in-file github/path sibling arms — self-analog phase)

## Orientation

This is a **surface-widening phase**, not a new-file phase. Every file to touch
already contains a `github` (and usually `path`) arm; the work is to add a
sibling `url` arm that mirrors github, substituting `source.url` verbatim for
the reconstructed clone URL and **omitting the auth bundle** (public-only,
D-76-07). The single genuinely new artifact is the `authentication required`
REASONS token (D-76-08). No external deps, no new files, no state migration.

The closest analog for every modified file is therefore the `github` arm **in
that same file** — copy its shape, change two things (clone URL source; drop
auth), and mirror the `kind === "github"` gate to also admit `"url"`.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `domain/source.ts` | domain/parser | transform | github URL arm (same file, lines 269-338) | exact (sibling arm) |
| `orchestrators/marketplace/add.ts` | orchestrator | request-response + file-I/O | `addGithubInGuard` (same file, lines 581-687) | exact (sibling arm) |
| `orchestrators/marketplace/update.ts` | orchestrator | request-response + file-I/O | `refreshRecord` github arm (same file, lines 361-396) | exact (sibling arm) |
| `orchestrators/marketplace/remove.ts` | orchestrator | file-I/O | github clone-deletion gate (same file, line 722) | exact (sibling arm) |
| `orchestrators/marketplace/info.ts` | orchestrator | transform | `buildBlock` github projection (same file, lines 59-67) | exact (sibling arm) |
| `shared/notify.ts` | utility/renderer | transform | github info render case + REASONS tuple (same file) | exact (sibling arm) |
| `persistence/config-io.ts` | config | — | `MARKETPLACE_CONFIG_ENTRY_SCHEMA.source` (line 46) | no change (D-76-12) |
| `orchestrators/import/marketplaces.ts` | orchestrator | transform | `marketplaceSourceFromExtra` (same file, lines 33-48) | role-match (shape mismatch — see Open Q1) |
| `docs/output-catalog.md` | docs | — | github add/info byte forms | exact (sibling rows) |
| `docs/messaging-style-guide.md` | docs | — | REASONS closed-set contract | exact (sibling row) |
| `tests/architecture/notify-closed-set-locks.test.ts` | test | — | REASONS length tripwire (line 29-30) | edit (count 32→33) |

## Pattern Assignments

### `domain/source.ts` (parser, transform)

**Analog:** github URL arm + `parseGitHubUrl`, same file.

**String-parser insertion point** (lines 269-283, current) — github check is
FIRST and must STAY first (D-76-02 canonical identity), then a NEW generic
`https://` arm, then the SP-3 scheme rejects:
```typescript
// GitHub HTTPS URL
if (raw.startsWith("https://github.com/")) {
  return parseGitHubUrl(raw);
}
// SP-3: SSH and arbitrary URL schemes
if (raw.startsWith("git@") || raw.includes("://")) {
  return { kind: "unknown", raw, reason: unsupportedUrlReason(raw) };
}
// SP-2: owner/repo@<ref> reject with hint
const atIdx = raw.indexOf("@");
if (atIdx !== -1) {
  return { kind: "unknown", raw, reason: ownerRepoAtRefReason(raw, atIdx) };
}
```
Changes: insert a `raw.startsWith("https://")` arm BEFORE the `://` reject
(D-76-01), and retire the SP-2 `ownerRepoAtRefReason` reject in favor of
`owner/repo@ref` → `github` kind with `ref` (D-76-04). `unsupportedUrlReason`
message (line 83) must be updated to name the still-rejected schemes
(http/ssh/scp-form) — it is no longer truthful once url is accepted.

**`.git`-suffix + `#ref` canonicalization to copy** (from `parseGitHubUrl`,
lines 321-335) — apply the identical fragment-split + trailing-`.git`-strip to
the new url arm so `sourceLogical`/`samePlannedSource` compare canonically
(Pitfall 3 resolution):
```typescript
// optional #<ref> fragment (empty fragment dropped)
let ref: string | undefined;
const hashIdx = rest.indexOf("#");
if (hashIdx !== -1) {
  const frag = rest.slice(hashIdx + 1);
  rest = rest.slice(0, hashIdx);
  if (frag.length > 0) { ref = frag; }
}
// strip optional .git suffix
if (rest.endsWith(".git")) {
  rest = rest.slice(0, -".git".length);
}
```

**Object-form url parser to guard** (`urlObjectSource`, lines 136-141) — add a
`https://github.com/` funnel to the github parser at the top (Pitfall 1,
D-76-02); today it builds a `UrlSource` unconditionally:
```typescript
function urlObjectSource(obj: Record<string, unknown>): ParsedSource {
  const url = optionalString(obj, "url");
  return url === undefined
    ? unknownObjectSource(obj, "url source is missing url")
    : withOptionalSourceFields({ kind: "url", raw: url, url }, obj);
}
```

**`samePlannedSource` url arm** (lines 432-436) — remove the `c8 ignore`, keep
the `sourceLogical`-equality path (already ref-aware, Pitfall 4). The github
arm (lines 425-428) is the parity reference (owner/repo/ref equality):
```typescript
/* c8 ignore next 3 -- callers only generate path/github sources today */
case "url":
case "git-subdir":
case "npm":
  return sourceLogical(planned) === sourceLogical(current) ? "same" : "different";
```

**`sourceLogical` url arm** (lines 461-464) — already correct and live once url
sources flow through; no change:
```typescript
case "url": {
  const refSuffix = source.ref === undefined ? "" : `#${source.ref}`;
  return `${source.url}${refSuffix}`;
}
```

---

### `orchestrators/marketplace/add.ts` (orchestrator, request-response + file-I/O)

**Analog:** `addGithubInGuard` (lines 581-687).

**S5b gate to widen** (lines 342-347) — admit `url`; keep the unknown reject
(S5a) and the git-subdir/npm rejects:
```typescript
// S5b: valid-but-unsupported kinds (url / git-subdir / npm).
if (source.kind !== "github" && source.kind !== "path") {
  throw new UnsupportedSourceError(
    `Cannot add marketplace from "${opts.rawSource}": unsupported source kind ${source.kind}`,
  );
}
```

**Clone-URL + auth divergence** (lines 592-625) — the crux of MURL-01 (Pattern
4). github reconstructs the URL and builds a full Device Flow auth bundle:
```typescript
const cloneUrl = `https://github.com/${source.owner}/${source.repo}.git`;
// ... host = "github.com"; onAuthRequired = initiateDeviceFlow(...); auth = { credentialOps, host, onAuthRequired };
await gitOps.clone({
  dir: stagingDir,
  url: cloneUrl,
  ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
  auth,
});
```
The new `addUrlInGuard` differs in EXACTLY two ways: `cloneUrl = source.url`
(verbatim, D-76-06) and **no `auth` bundle constructed or passed** (D-76-07).
Everything from line 633 onward (manifest read, MA-8 duplicate, MA-6 stale,
atomic rename, state mutation, MA-9 append-leak cleanup) is source-kind-uniform
and copies unchanged.

**Refactor decision (Open Q2):** the ~100-line body from line 633 is identical.
Research recommends extracting `addGitClonedInGuard(cloneUrl, auth?)` so the
MA-9 append-leak-not-mask discipline (lines 674-686) lives in one place. Weigh
against the surgical-change bias — present as a plan decision.

**`classifyAddError` HttpError arm** (lines 251-274) — add a new arm ABOVE the
errno ladder (D-76-08). The current ladder is errno-only, so a 401/403
`HttpError` (a `.code` string, not an errno) falls through to `unparseable`:
```typescript
if (err instanceof Error) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR") { return "source missing"; }
  if (code === "ENETUNREACH" || code === "ECONNREFUSED" || /* ... */) {
    return "network unreachable";
  }
}
```
Insert before the errno checks, duck-typed (D-13: orchestrator must NOT import
isomorphic-git — mirror the `isGitNotFoundError` name-check idiom):
```typescript
const statusCode = (err as { data?: { statusCode?: number } }).data?.statusCode;
if ((err as NodeJS.ErrnoException).code === "HttpError" &&
    (statusCode === 401 || statusCode === 403)) {
  return "authentication required";
}
```

---

### `orchestrators/marketplace/update.ts` (orchestrator, request-response + file-I/O)

**Analog:** `refreshRecord` github arm (lines 361-403).

**Kind branch to extend** (lines 361-403) — add a `url` arm between github and
path. github calls `refreshGitHubClone(cloneDir, source.ref, gitOps, cb, auth)`:
```typescript
if (source.kind === "github") {
  const cloneDir = await locations.sourceCloneDir(name);
  // host = "github.com"; onAuthRequired = initiateDeviceFlow(...); auth = {...};
  await refreshGitHubClone(cloneDir, source.ref, gitOps, () => { cloneAdvanced = true; }, auth);
  await validateManifestAtRoot(record, cloneDir);
} else if (source.kind === "path") {
  await validateManifestAtRoot(record, record.marketplaceRoot);
} else {
  throw new Error(`Cannot update marketplace "${name}": unsupported source kind "${source.kind}"`);
}
```
The url arm calls `refreshGitHubClone(cloneDir, source.ref, gitOps, cb)` with
**no `auth`** (MURL-03). `refreshGitHubClone` is clone-URL-agnostic — it fetches
via the existing on-disk `origin` remote, so the original clone URL is
irrelevant; only omit auth. (Consider renaming the helper to drop "GitHub".)

---

### `orchestrators/marketplace/remove.ts` (orchestrator, file-I/O)

**Analog:** github clone-deletion gate (line 722).

**`RecordedSourceKind` union to widen** (line 85):
```typescript
type RecordedSourceKind = "github" | "path" | "unknown";
```
Add `"url"`. Also admit it in the kind detection at line 513.

**Clone-deletion gate to widen** (lines 721-724) — Pitfall 2; both github and
url have a `sources/<name>/` clone, path never does:
```typescript
// MR-7: GitHub clone dirs retained when any plugin failed; here failedPlugins.length === 0.
if (sourceKindAtRecord === "github") {
  await removePath(locations.sourceCloneDir(opts.name));
}
```
Change to `=== "github" || sourceKindAtRecord === "url"`. Failing to widen
leaves an orphan clone → next add fails MA-6 `{stale clone}` forever (NFR-3).

---

### `orchestrators/marketplace/info.ts` (orchestrator, transform)

**Analog:** `buildBlock` github projection (lines 59-67).

**Source projection to extend** (lines 58-67) — today ALL non-github kinds
collapse to the `path` arm, which would wrongly render a url source as
`path: <clone dir>`. Add a `url` branch BEFORE the path fallback (D-76-09):
```typescript
const src = record.source as ParsedSource;
const source: MarketplaceInfoMessage["source"] =
  src.kind === "github"
    ? { sourceKind: "github", owner: src.owner, repo: src.repo, ...(src.ref !== undefined && { ref: src.ref }) }
    : { sourceKind: "path", absPath: record.marketplaceRoot };
```
New middle arm: `src.kind === "url" ? { sourceKind: "url", url: src.url, ...(src.ref !== undefined && { ref: src.ref }) }`.

---

### `shared/notify.ts` (renderer, transform)

**Analog:** github info render case + REASONS tuple, same file.

**`MarketplaceInfoMessage["source"]` union to widen** (lines 1119-1126) — add
the url arm:
```typescript
readonly source:
  | { readonly sourceKind: "github"; readonly owner: string; readonly repo: string; readonly ref?: string }
  | { readonly sourceKind: "path"; readonly absPath: string };
```
Add `| { readonly sourceKind: "url"; readonly url: string; readonly ref?: string }`.

**`renderMarketplaceInfo` switch + `last_updated` gate** (research-cited lines
2896-2930) — add a `url:` case mirroring `github:`, and widen the
`last_updated:` gate from `sourceKind === "github"` to all git-backed kinds
(D-76-10): render for `sourceKind !== "path"`, path never renders it. Renderer
stays a dumb formatter (MEMORY: `buildBlock` decides projection).

**REASONS tuple amendment** (research-cited lines 89-130) — append
`"authentication required"` as the 33rd member (D-76-08). Truthful attribution:
a 401 is auth, NOT `network unreachable`. Error severity.

---

### `orchestrators/import/marketplaces.ts` (orchestrator, transform)

**Analog:** `marketplaceSourceFromExtra` (lines 33-48).

**Current FLAT-shape reader** (lines 33-48) — reads `entry.directory` and
`entry.github.repo`:
```typescript
function marketplaceSourceFromExtra(entry: unknown): string | undefined {
  if (!isPlainObject(entry)) { return undefined; }
  if (typeof entry.directory === "string") { return entry.directory; }
  const github = entry.github;
  if (isPlainObject(github) && typeof github.repo === "string") { return github.repo; }
  return undefined;
}
```
D-76-13 requires reading the upstream NESTED `{source: {source:"url", url,
ref?, sha?}}` shape and returning a URL string (`url` + optional `#ref`) the
parser accepts; keep the `file` shape unmappable.

**OPEN QUESTION 1 (flagged for planner):** the current code reads a FLAT shape
but the official docs document a NESTED `{source: {...}}` shape — they disagree.
The safest implementation reads BOTH (preserve flat github/directory, ADD
nested source:{url|github|directory}). Planner should re-fetch
`code.claude.com/docs/en/plugin-marketplaces.md` or add a
`checkpoint:human-verify` before implementing MURL-07 (per MEMORY "verify
upstream before design options"). Update the `unmappable-marketplace-source`
message (line 29) if the shape widens.

---

### `persistence/config-io.ts` (config) — NO CHANGE

`MARKETPLACE_CONFIG_ENTRY_SCHEMA.source` stays `Type.String()` (line 46). A url
marketplace source is just a string `"https://host/repo.git#ref"` (D-76-12).
Object-form schema widening was tied to the dropped MURL-02. Listed only to
prevent an over-eager schema edit (anti-pattern in RESEARCH).

## Shared Patterns

### Pattern: Mirror the github arm, substitute URL, drop auth
**Source:** `add.ts:592-625`, `update.ts:361-396`
**Apply to:** `add.ts` (new `addUrlInGuard`), `update.ts` (`refreshRecord` url
arm), `remove.ts` (clone-deletion gate).
Every touched `if (source.kind === "github")` gains a sibling `url` branch
differing in exactly two ways: (1) `cloneUrl = source.url` not the
reconstructed github URL; (2) **no** `auth` bundle. Do not invent new control
flow — the downstream body is already source-kind-uniform.

### Pattern: Closed-set REASONS amendment is three lockstep edits (one commit)
**Source:** `shared/notify.ts` REASONS tuple; `notify-closed-set-locks.test.ts:29-30`
**Apply to:** D-76-08 only.
1. `shared/notify.ts` — append `"authentication required"` to REASONS (32→33).
2. `tests/architecture/notify-closed-set-locks.test.ts` — bump the length
   assertion 32 → 33 (the deliberate tripwire).
3. `docs/output-catalog.md` + `docs/messaging-style-guide.md` — add the catalog
   row + closed-set contract row.
Reason token must be truthful (a 401 is auth, not network) — MEMORY ATTR
discipline.

### Pattern: Duck-typed git-error detection at the orchestrator boundary (D-13)
**Source:** `add.ts::classifyAddError` errno ladder (lines 251-274);
`shared.ts:159` `isGitNotFoundError` name-check idiom
**Apply to:** the new `HttpError` arm in `classifyAddError`.
The orchestrator tier must NOT import isomorphic-git. Detect the auth challenge
by the string `code === "HttpError"` + duck-typed `.data.statusCode` (401/403),
exactly as `isGitNotFoundError` matches `err.name === "NotFoundError"` without
importing the library.

### Comment traceability (project rule)
**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** all new code.
Tag with decision/requirement IDs (`D-76-01`, `MURL-01`, `NFR-5`) — NEVER with
`Phase 76`/`Plan`/`Wave`/`Pitfall N` refs. Domain-word `phase` is exempt.

## No Analog Found

None. Every file has a github/path sibling arm in-file that serves as an exact
analog. The one shape uncertainty is import (Open Q1) — the analog exists
(`marketplaceSourceFromExtra`) but the upstream data shape must be verified
before the url reader is written.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,orchestrators/marketplace,orchestrators/import,persistence,platform,shared}/`, `tests/architecture/`, `docs/`
**Files scanned/verified against research line numbers:** 8 source files (all research citations confirmed accurate)
**Pattern extraction date:** 2026-07-11
