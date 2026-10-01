# Phase 2: Endpoints that answer only at the verbatim URL - Pattern Map

**Mapped:** 2026-09-26
**Files analyzed:** 2 modified domain files (new exports only) + 2 orchestrator files (existing seams, signature/body edits) + 5 caller files (new parameter) + ~6 test files (assertion rewrites, no new files)
**Analogs found:** 8 / 8 — this phase adds functions beside existing siblings in files that already exist; every "analog" is the sibling function in the SAME file, which is the strongest possible match.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `domain/clone-key.ts` (+`networkCloneUrl`) | utility (domain, pure) | transform | `canonicalCloneUrl` in the same file (lines 79-83) | exact (sibling function, same file, same signature shape) |
| `domain/source.ts` (+`stripSlashAndFragment` or equivalent) | utility (domain, pure) | transform | `stripUrlDecorations` in the same file (lines 411-433) | exact (extraction of an existing function's first two steps) |
| `orchestrators/marketplace/add.ts::addGitClonedInGuard` | orchestrator (seam) | request-response | itself, current body at line ~692 (`ensureGitSuffix(cloneUrl)` → `networkCloneUrl(source)`) | exact (in-place body edit, no signature change) |
| `orchestrators/plugin/clone-cache.ts::resolvePluginPin` | orchestrator (seam) | request-response | itself, current body at lines 541-546 | exact (in-place body edit, no signature change — already holds `source`) |
| `orchestrators/plugin/clone-cache.ts::materializePluginClone` | orchestrator (seam) | request-response | `resolvePluginPin` in the same file (post-change shape) | exact (same file, same module, becomes a pass-through of `args.networkUrl`) |
| `orchestrators/plugin/clone-cache.ts::materializeOrRefreshPluginMirror` | orchestrator (seam) | request-response | `resolvePluginPin` in the same file (post-change shape) | exact |
| `orchestrators/plugin/{install-clone-probe,reinstall-clone-probe,fetch,info,update-preflight}.ts` (9 call sites, add `networkUrl` to object literal) | orchestrator (caller) | request-response | each file's own existing call to `materializePluginClone`/`materializeOrRefreshPluginMirror` | exact (adding one field to an existing object literal already passing `cloneUrl`) |
| `tests/domain/clone-key.test.ts` (+`describe("networkCloneUrl", ...)`) | test | transform | `describe("canonicalCloneUrl", ...)` in the same file, lines 118-166 | exact |
| `tests/domain/source.test.ts` (+ direct-arm cases for new strip helper) | test | transform | existing `stripUrlDecorations`-exercising cases (e.g. "parses a generic URL with a Git suffix and reference", lines 159-186) | exact |
| `tests/orchestrators/marketplace/add.test.ts` (rewrite 2 titled tests + 2 assertions) | test | request-response | itself — existing MURL-01 test block at lines 2340-2417 | exact (in-place rewrite) |
| `tests/orchestrators/plugin/clone-cache.test.ts` (rewrite ~7 assertion sites) | test | request-response | itself — existing `resolvePluginPin`/materialize test blocks | exact (in-place rewrite) |
| `tests/orchestrators/plugin/fetch.test.ts` (rewrite 6 `networkUrl` locals) | test | request-response | itself — existing per-test `networkUrl` constant pattern, e.g. lines 481-529 | exact |
| `tests/edge/handlers/marketplace/add.test.ts` (rewrite `CLONE_URL`/`ALPHA_CLONE` fixture) | test | request-response | itself — existing `describeClone` reducer pattern, lines 106-134, 234-238 | exact |

No file in this phase has zero analog — every touched file already contains the sibling pattern to copy, because this phase is additive-within-existing-modules by design (D-2-03 explicitly rejected new files/types).

## Pattern Assignments

### `domain/clone-key.ts` — add `networkCloneUrl`

**Analog:** `canonicalCloneUrl`, same file, lines 79-83 (verified this session):
```typescript
export function canonicalCloneUrl(source: UrlSource | GitSubdirSource | GitHubSource): string {
  return source.kind === "github"
    ? `https://github.com/${source.owner}/${source.repo}`
    : source.url;
}
```

**Imports pattern** (lines 1-18): no new import needed for the function itself; only the new
`stripSlashAndFragment` export from `./source.ts` must be added to the existing
`import type { GitHubSource, GitSubdirSource, UrlSource } from "./source.ts";` — change to a mixed
type+value import since `stripSlashAndFragment` is a value, e.g.:
```typescript
import { stripSlashAndFragment } from "./source.ts";
import type { GitHubSource, GitSubdirSource, UrlSource } from "./source.ts";
```

**Core pattern (docstring + 3-arm switch)** — model the new function's docstring on
`canonicalCloneUrl`'s own docstring (lines 66-78), which explains the identity/wire split; RESEARCH.md's
recommended shape:
```typescript
export function networkCloneUrl(source: UrlSource | GitSubdirSource | GitHubSource): string {
  switch (source.kind) {
    case "github":
      return `${canonicalCloneUrl(source)}.git`;
    case "url":
      return stripSlashAndFragment(source.raw).base; // .git preserved, per D-2-03
    case "git-subdir":
      return source.url; // already verbatim; raw === url always
  }
}
```

**Error handling:** none — pure function, no I/O, same as `canonicalCloneUrl` (no try/catch anywhere
in this file).

**Placement:** immediately below `canonicalCloneUrl` (same "sibling, same module" convention the
file already uses for `pluginCloneKey`/`pluginMirrorKey`).

---

### `domain/source.ts` — extract `stripSlashAndFragment`, keep `stripUrlDecorations` calling it

**Analog:** `stripUrlDecorations` itself, lines 411-433 (verified this session, full text above).

**Core pattern (extraction):**
```typescript
// New export — first two steps of the existing stripUrlDecorations
export function stripSlashAndFragment(input: string): { base: string; ref: string | undefined } {
  let rest = input;
  while (rest.endsWith("/")) {
    rest = rest.slice(0, -1);
  }
  let ref: string | undefined;
  const hashIdx = rest.indexOf("#");
  if (hashIdx !== -1) {
    const frag = rest.slice(hashIdx + 1);
    rest = rest.slice(0, hashIdx);
    if (frag.length > 0) {
      ref = frag;
    }
  }
  return { base: rest, ref };
}

// stripUrlDecorations becomes a thin wrapper adding the .git strip:
function stripUrlDecorations(input: string): { base: string; ref: string | undefined } {
  const { base, ref } = stripSlashAndFragment(input);
  let rest = base;
  if (rest.endsWith(".git")) {
    rest = rest.slice(0, -".git".length);
  }
  return { base: rest, ref };
}
```

**Docstring convention to copy:** `ensureGitSuffix`'s own docstring (lines 435-436+) explicitly
names itself "the network-side counterpart to `stripUrlDecorations`" — give
`stripSlashAndFragment` an equally explicit docstring naming what it does NOT do (does not strip
`.git`), so a future reader does not "fix" it.

**No error handling / no validation** — pure string transform, same as today.

---

### `orchestrators/marketplace/add.ts::addGitClonedInGuard`

**Analog:** itself, pre-change body around line 692 (`url: ensureGitSuffix(cloneUrl)`).

**Core pattern (before → after):**
```typescript
// before
url: ensureGitSuffix(cloneUrl),
// after — args.source already in scope (verified: add.ts:391-398)
url: networkCloneUrl(args.source),
```
No signature change. Drop the now-unused `ensureGitSuffix` import from this file only if it becomes
unused here (check other uses in the same file first — the file may still reference it elsewhere;
if not, remove the now-dead import per the "remove orphans your change created" rule).

**Imports pattern:** add `networkCloneUrl` to this file's existing `from "../../domain/clone-key.ts"`
import (or equivalent relative path) alongside whatever it already imports from that module
(likely `canonicalCloneUrl` is already imported here — confirm and add as a named sibling).

---

### `orchestrators/plugin/clone-cache.ts` — three internal seams

**Analog:** `resolvePluginPin`, same file, lines 541-546 (verified via RESEARCH.md):
```typescript
// before
const cloneUrl = canonicalCloneUrl(source);
// MURL-01 / PURL-09: `cloneUrl` is the cache-key identity and is what this
// function RETURNS; `networkUrl` is the same value `.git`-suffixed and is
// only ever sent to the remote.
const networkUrl = ensureGitSuffix(cloneUrl);

// after
const cloneUrl = canonicalCloneUrl(source);
// MURL-01 / PURL-09: `cloneUrl` is the cache-key identity and is what this
// function RETURNS; `networkUrl` is the verbatim wire form (D-2-03) and is
// only ever sent to the remote.
const networkUrl = networkCloneUrl(source);
```
Keep the comment (update its second sentence only — it currently names the retired `.git`-suffix
rule specifically).

**`materializePluginClone` / `materializeOrRefreshPluginMirror`** (lines 184, 266) — these do NOT
hold `source`, only `cloneUrl`. Add a `networkUrl: string` field to each function's `args` type and
replace the internal `ensureGitSuffix(args.cloneUrl)` call with `args.networkUrl`:
```typescript
// before (materializeOrRefreshPluginMirror, line 266)
const networkUrl = ensureGitSuffix(args.cloneUrl);
// after
const networkUrl = args.networkUrl;
```
Mirror this exact edit at `materializePluginClone`'s `ensureGitSuffix` call site.

**Error handling / validation:** unchanged — no new branch, no new failure mode; this is a
straight pass-through substitution.

---

### The 9 caller sites (`install-clone-probe.ts`, `reinstall-clone-probe.ts`, `fetch.ts`, `info.ts`, `update-preflight.ts`)

**Analog:** each file's own existing call site building the object literal passed to
`materializePluginClone`/`materializeOrRefreshPluginMirror` (each already passes `cloneUrl:
canonicalCloneUrl(source)` or equivalent, per RESEARCH.md's table).

**Core pattern:**
```typescript
// before (representative shape, e.g. install-clone-probe.ts)
await materializePluginClone({
  cloneUrl: canonicalCloneUrl(options.source),
  // ...other fields
});

// after — add one field, source already in scope per RESEARCH.md's verified table
await materializePluginClone({
  cloneUrl: canonicalCloneUrl(options.source),
  networkUrl: networkCloneUrl(options.source),
  // ...other fields
});
```
Apply the identical one-line addition at each of the 9 call sites (2 in `install-clone-probe.ts`,
1 in `reinstall-clone-probe.ts`, 2 in `fetch.ts`, 2 in `info.ts`, 2 in `update-preflight.ts`).
`networkCloneUrl` needs a new import in each of these 5 files (from `domain/clone-key.ts`,
alongside the existing `canonicalCloneUrl` import each file already has).

---

## Shared Patterns

### Pure-function-in-domain, no error handling
**Source:** `domain/clone-key.ts` and `domain/source.ts` conventions throughout.
**Apply to:** `networkCloneUrl`, `stripSlashAndFragment`. Both are total functions over
already-validated input (the `https://`-only gate runs earlier in `parseUrlSourceForm`); no
try/catch, no thrown errors, no validation — matches every existing function in both files.

### `cloneUrl` (identity) vs `networkUrl` (wire) naming and comment convention
**Source:** `orchestrators/plugin/clone-cache.ts::resolvePluginPin`, lines 541-546 (comment quoted
above).
**Apply to:** every one of the four seam sites and their callers — keep naming `cloneUrl` for the
cache-key/identity string and `networkUrl` for the wire string; do not introduce a third name.

### Call-count / recorded-call test assertion
**Source:** `tests/platform/git-ops-fake.ts:149-224` (`state.calls.clone.push(...)` recorded before
any throw).
**Apply to:** every new/rewritten test in `clone-cache.test.ts`, `add.test.ts`, `fetch.test.ts`
needing SC3 coverage:
```typescript
assert.strictEqual(git.state.calls.clone.length, 1); // or .resolveRemoteRef.length, per operation
```
Add this on both a success-path test and a failure-path test (HttpError injection) per seam.

### HTTP-error-shape injection for SC2
**Source:** `tests/shared/git-failure-classifiers.test.ts:263`.
```typescript
Object.assign(new Error("HTTP Error: 401"), { code: "HttpError", data: { statusCode: 401 } })
```
**Apply to:** any new failure-path test asserting the original error identity survives through the
seam, via `createGitOpsFake({ cloneError: ... })` / `{ resolveRemoteRefError: ... }`.

### Direct-coverage `describe` block per pure function
**Source:** `tests/domain/clone-key.test.ts`, `describe("canonicalCloneUrl", ...)`, lines 118-166
(full text captured above — 3 cases: github, url, git-subdir).
**Apply to:** the new `describe("networkCloneUrl", ...)` block in the same file — needs a minimum
of 4 cases (github; url without `.git` in raw; url WITH `.git` in raw — the case CONTEXT.md calls
out as the one a naive implementation inverts; git-subdir), to satisfy
`test:coverage:direct`'s 100% branch requirement on the new 3-arm switch (the `url` arm has two
behaviorally distinct sub-cases).

### `describeClone`/`describeFetch` byte-for-byte call comparison (edge tests)
**Source:** `tests/edge/handlers/marketplace/add.test.ts:234-238`.
**Apply to:** the rewritten `CLONE_URL`/`ALPHA_CLONE` fixture at lines 106-134 — keep using
`assert.deepStrictEqual` against the full reduced call object rather than a substring/pattern match,
per CONTEXT.md's "prove the suffix rule by value, not by shape" instruction.

## No Analog Found

None. Every file in this phase's scope is an existing file gaining a sibling function, an in-place
body edit at an existing seam, or a rewrite of existing test assertions — RESEARCH.md and CONTEXT.md
jointly foreclose introducing any new file, new type member, or new architectural pattern (D-2-03's
three explicit rejections). No `## No Analog Found` entries are expected or found.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/domain/`,
`extensions/pi-claude-marketplace/orchestrators/{marketplace,plugin}/`, `tests/domain/`,
`tests/orchestrators/{marketplace,plugin}/`, `tests/edge/handlers/marketplace/`. All analogs are
the pre-change version of the same file/function being modified (self-referential pattern search),
consistent with this phase being a same-module addition/extension per CONTEXT.md D-2-03.
**Files scanned:** `domain/clone-key.ts`, `domain/source.ts` (read in full or targeted this
session); `tests/domain/clone-key.test.ts` (lines 108-166 read this session); RESEARCH.md's own
verified excerpts for the remaining orchestrator/test files (already read and quoted with line
numbers in RESEARCH.md's Primary Sources — not re-read here to avoid duplicate reads of ranges
already in context via RESEARCH.md).
**Pattern extraction date:** 2026-09-26
