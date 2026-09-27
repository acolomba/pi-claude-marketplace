# Phase 2: Endpoints that answer only at the verbatim URL - Research

**Researched:** 2026-09-26
**Domain:** Internal TypeScript refactor — URL derivation for git clone/fetch transport, no new external dependency
**Confidence:** HIGH (all claims below are `[VERIFIED: <path>:<lines>]` against files read this session, except where marked `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-2-01: clone verbatim; there is no retry and no fallback.** Claude Code appends `.git` only
  for `github.com` and `gitlab.com` `owner/repo` paths; every other host receives the URL as typed.
  Our unconditional `ensureGitSuffix` on the network path is the divergence, and removing it is the
  whole fix. A retry would send the known-bad URL, absorb a 404, and recover; not sending it is
  strictly better and deletes the retry's entire correctness surface (status gate, call-count
  ceiling, destination ownership).
  — Reversibility: costly.

- **D-2-02: the inverse case is accepted as no longer working.** A suffix-less URL against a host
  that serves only `/repo.git` succeeds today because the extension appends the suffix for the
  user; under D-2-01 it 404s. Verbatim means verbatim in both directions.
  — Reversibility: reversible.

- **`owner/repo.git` shorthand is not a supported form and needs no handling.** Leave it alone; do
  not add a strip, a reject, or a test asserting a contract upstream does not have.

- **D-2-03: `networkCloneUrl(source)` in `domain/clone-key.ts`, beside `canonicalCloneUrl`.** Same
  three-kind switch, one module, no new type member:
  - `github` → `canonicalCloneUrl(source)` + `.git` (unchanged behavior)
  - `url` → the verbatim form: `raw` with trailing slashes and a `#<ref>` fragment stripped, and the
    `.git` decision **preserved**
  - `git-subdir` → `source.url`, which `gitSubdirObjectSource` already takes verbatim from the
    manifest

  The four seam call sites take a `networkUrl` string alongside the `cloneUrl` they already pass.
  Every one of them either holds the parsed source or is called by something that computes
  `canonicalCloneUrl` from it, so no source object has to be threaded down into the clone seam.
  — Reversibility: reversible.

  **Rejected:** a new field on the parsed source (closed-set silent-omission risk, needs a
  `contracts.json` pin or a production read, and a `persistence/state-io.ts` schema mirror).
  **Rejected:** recomputing from `raw` at each call site (four copies, undoes D-77-06).
  **Rejected:** letting `url` be the verbatim form (dropping the parse-time `.git` strip) — would
  split cache identity and cold-miss every warm clone (D-76-01).

- **D-2-04: MURL-09 is re-aimed, not retired.** Rewrite it as: **the URL sent is exactly the one the
  user typed modulo decoration stripping, and exactly one network attempt is made per operation.**
  Provable by the call-count assertion SC3 already asked for, against `1` instead of `2`.

- **ROADMAP Phase 2 SC3/SC4 corrected** (already reflected in `ROADMAP.md` at commit `1f680673`):
  SC3 = call count of exactly one; SC4 dropped as vacuous. SC1, SC2, SC5 stand as written.

### Claude's Discretion

Naming beyond `networkCloneUrl`, the exact decoration-stripping helper shape in `domain/source.ts`
(a `stripUrlDecorations` variant, a parameter, or a second small function), test file layout, and
how the four seam signatures name the new parameter.

### Deferred Ideas (OUT OF SCOPE)

- The gitlab.com parity gap (our parser holds no gitlab literal; `https://gitlab.com/o/r` is a
  `url` kind and goes out suffix-less; gitlab.com serves both forms so nothing breaks).
- Shorthand vs URL cache-identity asymmetry (`owner/repo.git` shorthand keeps `.git` inside `repo`,
  a pre-existing D-76-01 hole, untouched here).
- Codex-layout manifest lookup (`.codex-plugin/plugin.json`) — excluded milestone-wide.
- Azure DevOps `/_git/` URLs — already handled by the generic `url` arm under D-2-03; no special
  case needed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MURL-08 | A user can add a `url` marketplace source whose smart-HTTP endpoint serves at the verbatim URL and returns 404 for the `.git`-suffixed form; both `clone` and `resolveRemoteRef` resolve it. | § The four call sites, § networkCloneUrl design — every seam that reaches the network is enumerated with its exact current line and its caller's available `source`. |
| MURL-09 (re-aimed per D-2-04) | The URL sent is exactly the one the user typed modulo trailing-slash/`#ref` stripping, and exactly ONE network attempt is made per operation. | § Call-count assertion capability (git-ops-fake.ts already records every call, including on the throw path) — no new instrumentation needed, just new assertions. |
</phase_requirements>

## Summary

This phase is a pure internal refactor with the design already locked in `02-CONTEXT.md`
(D-2-01..D-2-04): stop unconditionally appending `.git` to every clone/fetch URL, and instead
derive the wire URL per source kind through a new `networkCloneUrl(source)` in
`domain/clone-key.ts`. No new library, no new architecture pattern, no new package. The mechanical
work is: (1) add `networkCloneUrl` beside `canonicalCloneUrl`, backed by a new decoration-stripping
helper in `domain/source.ts` that stops short of stripping `.git`; (2) thread a `networkUrl`
parameter through the four `ensureGitSuffix` call sites and the ~9 upstream call sites that invoke
them; (3) update every test that currently asserts a `.git`-suffixed wire URL for a non-github host
— this set is larger than the four call sites alone and is enumerated below by file and line.

**Primary recommendation:** Add `networkCloneUrl(source: GitBackedSource): string` to
`domain/clone-key.ts` as a 3-arm `switch`/`if-else` (github / url / git-subdir), backed by a new
exported `stripSlashAndFragment` (or equivalent) helper extracted from `domain/source.ts`'s
existing `stripUrlDecorations`. Every call site that today does `ensureGitSuffix(cloneUrl)` already
has the parsed `GitBackedSource` in scope (directly or one frame up) and can call
`networkCloneUrl(source)` instead — no source object needs to be newly threaded anywhere. The
single largest execution risk is NOT the four call sites themselves (small, mechanical) but the
existing test suite: at least 3 files (`tests/orchestrators/marketplace/add.test.ts`,
`tests/orchestrators/plugin/fetch.test.ts`, `tests/edge/handlers/marketplace/add.test.ts`) contain
tests that name themselves after and assert the CURRENT `.git`-suffixed-for-non-github behavior
this phase reverses; those tests must be rewritten, not just left green by accident.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wire-URL derivation (`networkCloneUrl`) | Domain (`domain/clone-key.ts`) | — | Pure function of a `ParsedSource`; no I/O. `platform/` may not import `domain/` (D-11, ESLint `import-x/no-restricted-paths`), so the derivation cannot live in `platform/git.ts` even though that is where the URL is eventually consumed. |
| Decoration stripping (slash/fragment, `.git`-preserving variant) | Domain (`domain/source.ts`) | — | Sibling to the existing `stripUrlDecorations`/`ensureGitSuffix`, same module, same purity contract. |
| Seam call sites (`addGitClonedInGuard`, `materializePluginClone`, `materializeOrRefreshPluginMirror`, `resolvePluginPin`) | Orchestrators (`orchestrators/marketplace/add.ts`, `orchestrators/plugin/clone-cache.ts`) | — | These own the staging/clone/rename lifecycle and are the only orchestrator files legally allowed the git surface (NFR-5 `no-orchestrator-network` gate exempts them by name). |
| Transport (actual HTTP request) | Platform (`platform/git.ts`, isomorphic-git) | — | Unchanged this phase — receives whatever URL string the orchestrator passes; `ensureGitSuffix`/`networkCloneUrl` never execute here. |

## Standard Stack

No new library, package, or dependency. This phase adds one pure function and one helper to
existing domain modules. Package Legitimacy Audit is not applicable — skip that gate.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. No `npm view` / registry check
needed.

## Architecture Patterns

### System Architecture Diagram

```
marketplace add <url>                    plugin install / update / fetch / info --fetch / reinstall
        │                                                    │
        ▼                                                    ▼
orchestrators/marketplace/add.ts                orchestrators/plugin/{install-clone-probe,
  addUrlInGuard / addGithubInGuard                 reinstall-clone-probe,update-preflight,
        │  (has `source: UrlSource|GitHubSource`)   fetch,info}.ts
        │                                                    │  (each has `source`/`gitSource`
        ▼                                                    │   in scope at its own call site)
addGitClonedInGuard(args: { source, cloneUrl, ... })          ▼
        │                                        clone-cache.ts::{materializePluginClone,
        │  TODAY: url: ensureGitSuffix(cloneUrl)   materializeOrRefreshPluginMirror}(args:
        │  AFTER: url: networkCloneUrl(source)      { cloneUrl, networkUrl, ... })
        ▼                                                    │  TODAY: ensureGitSuffix(args.cloneUrl)
   gitOps.clone({ url, ... })                                │  AFTER: args.networkUrl
                                                              ▼
                                                    gitOps.clone / resolveRemoteRef({ url, ... })
                                                              │
                                                              ▼
                                              platform/git.ts → isomorphic-git → smart-HTTP
                                              (pastes url verbatim into info/refs?service=...)

domain/clone-key.ts (pure, no I/O)
  canonicalCloneUrl(source)  — cache-key IDENTITY (unchanged, `.git`-stripped)
  networkCloneUrl(source)    — NEW: wire URL (this phase)
       ├─ github     → canonicalCloneUrl(source) + ".git"
       ├─ url        → stripSlashAndFragment(source.raw)   [.git preserved]
       └─ git-subdir → source.url                          [already verbatim, raw === url]
```

### Recommended Project Structure

No new files. Edits land in:
```
extensions/pi-claude-marketplace/
├── domain/
│   ├── clone-key.ts        # + networkCloneUrl (new export)
│   └── source.ts           # + stripSlashAndFragment-style helper (new export);
│                            #   stripUrlDecorations refactored to call it internally
├── orchestrators/
│   ├── marketplace/add.ts              # addGitClonedInGuard: ensureGitSuffix → networkCloneUrl
│   └── plugin/
│       ├── clone-cache.ts              # 3 internal call sites: materializePluginClone,
│       │                               #   materializeOrRefreshPluginMirror, resolvePluginPin
│       ├── install-clone-probe.ts      # caller: compute + pass networkUrl (2 call sites)
│       ├── reinstall-clone-probe.ts    # caller: compute + pass networkUrl (1 call site)
│       ├── update-preflight.ts         # caller: compute + pass networkUrl (2 call sites)
│       ├── fetch.ts                    # caller: compute + pass networkUrl (2 call sites)
│       └── info.ts                     # caller: compute + pass networkUrl (2 call sites)
```

### Pattern: threading `networkUrl` alongside `cloneUrl` without a new source parameter

**What:** `materializePluginClone` and `materializeOrRefreshPluginMirror` currently accept
`cloneUrl: string` and derive the wire URL internally via `ensureGitSuffix(args.cloneUrl)`
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:184,266]. Under
D-2-03 they cannot derive `networkCloneUrl` internally because they no longer hold a `source`
object — only a `cloneUrl` string (the `url`/`git-subdir` verbatim derivation needs `source.raw`,
which is not recoverable from `cloneUrl` alone once `.git` has been stripped at parse time).

**When to use:** Add a `networkUrl: string` field to both functions' args, computed at the call
site (which always holds the `GitBackedSource`) via `networkCloneUrl(source)`, and use
`args.networkUrl` in place of `ensureGitSuffix(args.cloneUrl)`.

**Example — the pattern already exists once, in `resolvePluginPin`** (which already receives
`source` directly, so needs no signature change, only the internal derivation swapped):
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:541-546 (current)
const cloneUrl = canonicalCloneUrl(source);
// MURL-01 / PURL-09: `cloneUrl` is the cache-key identity and is what this
// function RETURNS; `networkUrl` is the same value `.git`-suffixed and is
// only ever sent to the remote.
const networkUrl = ensureGitSuffix(cloneUrl);
```
Becomes `const networkUrl = networkCloneUrl(source);` — no signature change to `resolvePluginPin`,
since it already takes `source: UrlSource | GitSubdirSource | GitHubSource`.

**Every call site of `materializePluginClone` / `materializeOrRefreshPluginMirror` already has the
source in scope**, confirmed by reading each:

| Caller file | Function | Source variable in scope | Evidence |
|---|---|---|---|
| `orchestrators/plugin/install-clone-probe.ts` | `probeInstallClone` | `options.source: GitBackedSource` (param) | [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts:24-33,54-81] |
| `orchestrators/plugin/reinstall-clone-probe.ts` | `probeReinstallClone` | `options.source: GitBackedSource` (param) | [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts:19-27,44-71] |
| `orchestrators/plugin/fetch.ts` | `materializeThroughSeam` | `gitSource: GitBackedSource` (param) | [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts:377-402] |
| `orchestrators/plugin/info.ts` | `makeFetchProbe`'s `probeUnpinned`/`probePinned` closures | `gitSource: GitBackedSource` (closure param) | [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1608-1648] |
| `orchestrators/plugin/update-preflight.ts` | `makeUpdateCloneProbe`'s `probeUnpinned`/`probePinned` | `gitSource: GitBackedSource` (closure param) | [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:148-220] |

So the fix is: at each of these 9 call sites (5 files × 1-2 calls each), add
`networkUrl: networkCloneUrl(source)` (or `gitSource`) to the object literal passed to
`materializePluginClone`/`materializeOrRefreshPluginMirror`, and inside `clone-cache.ts` swap
`ensureGitSuffix(args.cloneUrl)` for `args.networkUrl` in both functions
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:184,266]. No new
source object needs to cross a boundary it does not already cross.

### `addGitClonedInGuard` is the simplest of the four

`addGitClonedInGuard` already receives `source: GitHubSource | UrlSource` as a direct argument
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:391-398]. Its
`cloneUrl` parameter is used ONLY to build the wire URL (`ensureGitSuffix(cloneUrl)` at line 692)
— it is not stored in state or referenced again inside the function
[VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:640-702]. This call
site can drop the `.git` derivation entirely and use `networkCloneUrl(source)` directly, with no
signature change to `addGitClonedInGuard` at all — only its body changes. (Its own two callers,
`addGithubInGuard` and `addUrlInGuard`, still compute and pass `cloneUrl` for other purposes: the
former builds `` `https://github.com/${owner}/${repo}.git` `` at line 776 which is fed straight
through today, unaffected in shape; the latter passes `source.url` at line 838.)

### Anti-Patterns to Avoid

- **Do not recompute the strip logic at each of the 9 call sites.** `networkCloneUrl` is the single
  source of truth (D-2-03's own stated rejection of this option — it "partly undoes the D-77-06
  consolidation").
- **Do not add a field to `UrlSource`/`GitSubdirSource`/`GitHubSource` to carry the wire form.**
  Rejected by D-2-03 explicitly — closed-set silent-omission risk (already shipped 3× in this
  milestone per project history) plus a `persistence/state-io.ts` schema mirror and a possible
  `contracts.json` pin.
- **Do not strip `.git` in the new decoration helper.** The whole point of D-2-03's `url` arm is to
  preserve whatever suffix decision the user's raw input made.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recording every clone/fetch/resolveRemoteRef call for the SC3 call-count assertion | A new spy/counter wrapper around `GitOps` | `tests/platform/git-ops-fake.ts`'s existing `state.calls.{clone,fetch,resolveRemoteRef,...}` arrays | Already records every call — including on the throw path, since `calls.clone.push(...)` executes BEFORE `requireRemote`/error-throwing logic runs [VERIFIED: tests/platform/git-ops-fake.ts:150-153,220-224]. No new instrumentation needed. |
| Simulating a 401/403/404/5xx failure with the exact original error identity | A new error-shape helper | `Object.assign(new Error("HTTP Error: 404"), { code: "HttpError", data: { statusCode: 404 } })` | This is the exact shape used across the existing suite (`tests/shared/git-failure-classifiers.test.ts:263`) that `classifyGitTransportFailure` already switches on. |

**Key insight:** The test scaffolding this phase needs (a URL-recording fake, an HTTP-error shape,
a hermetic edge-test harness) all already exist and are reused across dozens of existing test
files. The work is calling them with the new expected values, not building new infrastructure.

## The decoration-stripping design (`domain/source.ts`)

`stripUrlDecorations` currently does three things in sequence: strip trailing slashes, split off an
optional `#<ref>` fragment, then strip one trailing `.git`
[VERIFIED: extensions/pi-claude-marketplace/domain/source.ts:411-433]:
```
407  * Shared canonicalization tail for https sources (`parseUrlSource` /
408  * `parseGitHubUrl`): strip trailing slashes, split off an optional `#<ref>`
409  * fragment (SP-5: empty fragment dropped), then strip a single trailing
410  * `.git` suffix.
411  */
412 function stripUrlDecorations(input: string): { base: string; ref: string | undefined } {
413   let rest = input;
414
415   while (rest.endsWith("/")) {
416     rest = rest.slice(0, -1);
417   }
418
419   let ref: string | undefined;
420   const hashIdx = rest.indexOf("#");
421   if (hashIdx !== -1) {
422     const frag = rest.slice(hashIdx + 1);
423     rest = rest.slice(0, hashIdx);
424     if (frag.length > 0) {
425       ref = frag;
426     }
427   }
428
429   if (rest.endsWith(".git")) {
430     rest = rest.slice(0, -".git".length);
431   }
432
433   return { base: rest, ref };
434 }
```
(Line numbers above are 1-indexed from the file as displayed; verified this session.)

`networkCloneUrl`'s `url` arm needs exactly the first two steps (slash + fragment strip) applied to
`source.raw`, WITHOUT the third (`.git` strip). **Recommended shape** (Claude's discretion per
CONTEXT.md, but this is the cleanest option given the existing code): extract the first two steps
into a new exported function, e.g. `stripSlashAndFragment(input: string): { base: string; ref:
string | undefined }`, have `stripUrlDecorations` call it and then additionally strip `.git`, and
have the new `networkCloneUrl` `url` arm call `stripSlashAndFragment(source.raw)` directly and take
only `.base` (the `ref` half is discarded — for `networkCloneUrl` only the base URL matters; the
ref is handled separately by the caller as `source.ref`, already parsed).

**Why a split helper rather than a parameter:** `stripUrlDecorations` is NOT exported
[VERIFIED: extensions/pi-claude-marketplace/domain/source.ts:412 — no `export` keyword] and has no
direct unit test — it is only exercised indirectly through `parseUrlSource`/`parseGitHubUrl`
string-parse cases in `tests/domain/source.test.ts` (e.g. "parses a generic URL with a Git suffix
and reference", "removes the Git suffix from generic URL identity" at
tests/domain/source.test.ts:159-186). Splitting it into two functions is a zero-risk refactor: no
test imports `stripUrlDecorations` by name, so there is nothing to break by changing its internal
structure, only its two callers' (unchanged) external behavior to preserve. A boolean parameter
(`stripUrlDecorations(input, { stripGitSuffix: false })`) would work too but reads as an awkward
negative-default flag at both call sites; the split function reads as "the network-verbatim
counterpart" (mirroring how `ensureGitSuffix`'s own docstring already names itself "the network-side
counterpart to `stripUrlDecorations`" [VERIFIED: extensions/pi-claude-marketplace/domain/source.ts:435-436]).

### `git-subdir`'s raw-vs-url equivalence — confirmed byte-identical, always

`gitSubdirObjectSource` is the **only** factory that ever constructs a `GitSubdirSource`, at both
parse time (reading a marketplace manifest entry) and state-load time (there is no `git-subdir`
branch in `persistence/state-io.ts::normalizeStoredSource` — confirmed by
`grep -n "git-subdir" persistence/state-io.ts` returning zero matches, i.e. `git-subdir` plugin
sources are never persisted/revalidated separately; they are re-derived fresh from the manifest on
every read via `loadMarketplaceManifest` → `parsePluginSource(entry.source)` →
`gitSubdirObjectSource` every time). The factory itself:
```
189 function gitSubdirObjectSource(obj: Record<string, unknown>): ParsedSource {
190   const url = optionalString(obj, "url");
191   const subPath = optionalString(obj, "path");
192   if (url === undefined || subPath === undefined) {
193     return unknownObjectSource(obj, "git-subdir source is missing url or path");
194   }
195
196   return withOptionalSourceFields({ kind: "git-subdir", raw: url, url, path: subPath }, obj);
197 }
```
[VERIFIED: extensions/pi-claude-marketplace/domain/source.ts:189-197] — `raw` and `url` are
assigned the SAME `url` local variable in the same object literal. There is no code path in the
repository where they could diverge; deriving `networkCloneUrl`'s `git-subdir` arm from either
`source.raw` or `source.url` is provably byte-identical, not just empirically so in the cases
tested. Use `source.url` (matches `canonicalCloneUrl`'s own git-subdir arm at
`domain/clone-key.ts:79-82`, keeping the two functions symmetric).

## Test Surface

### Which files own each of the four call sites and `domain/clone-key.ts`

| Production file:function | Owning `test:corresponding` file | Additional integration coverage |
|---|---|---|
| `domain/clone-key.ts` (incl. new `networkCloneUrl`) | `tests/domain/clone-key.test.ts` (166 lines; `describe("canonicalCloneUrl", ...)` block at line 119 is the direct pattern to mirror) | `tests/orchestrators/plugin/clone-cache.test.ts` re-exercises it indirectly |
| `domain/source.ts` (incl. new strip helper) | `tests/domain/source.test.ts` (937 lines) | — |
| `orchestrators/marketplace/add.ts::addGitClonedInGuard` | `tests/orchestrators/marketplace/add.test.ts` | `tests/edge/handlers/marketplace/add.test.ts` (full-stack hermetic) |
| `orchestrators/plugin/clone-cache.ts::materializePluginClone` / `materializeOrRefreshPluginMirror` / `resolvePluginPin` | `tests/orchestrators/plugin/clone-cache.test.ts` (1575 lines) | `tests/orchestrators/plugin/{install-clone-probe,reinstall-clone-probe}.test.ts`, `tests/orchestrators/plugin/{fetch,info,update-preflight}.test.ts`, `tests/orchestrators/plugin/{install-flow,update-flow,reinstall-flow}.test.ts` |

`npm run test:corresponding` requires a 1:1 file mirror between `extensions/pi-claude-marketplace/**/*.ts`
and `tests/**/*.test.ts` [VERIFIED: scripts/check-corresponding-tests.mjs:8-33]. Since
`networkCloneUrl` and the new strip helper land in EXISTING files (`clone-key.ts`, `source.ts`)
whose corresponding test files already exist, **no new test file is required to satisfy
`test:corresponding`** — the gate is about file existence, not per-symbol coverage.

### How existing tests assert the URL a seam received

The recorder pattern already in use, `createGitOpsFake` (`tests/platform/git-ops-fake.ts`), snapshots
every call into `state.calls.{clone,fetch,checkout,resolveRef,resolveRemoteRef,forceUpdateRef,currentBranch}`
BEFORE any error is thrown [VERIFIED: tests/platform/git-ops-fake.ts:149-224 — `calls.clone.push(...)`
runs, THEN `requireRemote(...)` (which can throw), THEN `options.cloneError` (which can throw)].
This means **`state.calls.clone.length` is already correct on the failure path with zero changes** —
a call-count assertion for SC3 needs no new fake capability, only a new assertion in each phase-2
test (`assert.strictEqual(git.state.calls.clone.length, 1)` after a failing clone, in addition to
the existing end-state assertions).

The edge suites additionally use a `describeClone`/`describeFetch` reducer
(`tests/edge/handlers/marketplace/add.test.ts:234-238`, similarly named in
`tests/edge/handlers/marketplace/update.test.ts` and `tests/edge/handlers/plugin/bootstrap.test.ts`)
that substitutes a stable token for the randomUUID staging leaf and reduces an `auth` bundle to
`{ host }` so the whole call object stays comparable by `assert.deepStrictEqual`. This is the
"prove the suffix rule by value, not by shape" mechanism CONTEXT.md's Specific Ideas section calls
for — the recorded `url` field is asserted byte-for-byte, not pattern-matched.

### Existing tests that assert the CURRENT (pre-phase) `.git`-suffixed-for-non-github wire URL and will need rewriting

These are load-bearing tests today; under D-2-01 they assert the WRONG post-phase behavior and must
be updated as part of this phase's plan, not merely left to fail and be "fixed":

1. **`tests/edge/handlers/marketplace/add.test.ts:106-134`** — `URL_SOURCE =
   "https://gitlab.example.com/team/alpha#main"`, `CLONE_URL =
   "https://gitlab.example.com/team/alpha.git"`, and `ALPHA_CLONE.url = CLONE_URL`, deep-equal
   asserted against `git.state.calls.clone` at lines 300, 344, 373, 401
   [VERIFIED: tests/edge/handlers/marketplace/add.test.ts:106-134]. `gitlab.example.com` is not
   `github.com`, so under D-2-01 the wire URL must become `https://gitlab.example.com/team/alpha`
   (no `.git`). `CLONE_URL` (and therefore `ALPHA_CLONE` and `allowedRemoteUrls: [CLONE_URL]` at
   line 270) needs updating.

2. **`tests/orchestrators/marketplace/add.test.ts:2340-2417`** — a test literally titled `"MURL-01:
   url source clones source.url \`.git\`-suffixed with a bundle bound to its host"`, whose own
   comment reads "MURL-01: the parser canonicalized the trailing `.git` off for identity
   comparison, and `ensureGitSuffix` restores it for the wire," asserting
   `cloneCall.url === "https://gitlab.example.com/team/mp.git"`
   [VERIFIED: tests/orchestrators/marketplace/add.test.ts:2340-2373]. A sibling test at
   line ~2377 ("MURL-01: url source with a #ref clones at that ref...") asserts the same
   `.git`-suffixed url for a `#v1.0`-ref'd source. Both need the assertion changed to the
   non-`.git` verbatim form and probably a rename (their titles describe the behavior this phase
   reverses). Two more `.git`-suffixed `gitlab.example.com` clone-call assertions sit at
   lines 2331/2335 (a different test, MA-6/leftover-clone related) and line 2371.

3. **`tests/orchestrators/plugin/fetch.test.ts`** — six separate tests each declare a local
   `const networkUrl = "https://example.com/<name>.git";` and assert it as the recorded
   `git.schedule` clone URL: lines 485 ("materializes a cold pinned URL clone"), 559, 1349, 1519,
   1588, 2026 [VERIFIED: tests/orchestrators/plugin/fetch.test.ts:481-529 read in full for the
   first instance — `cloneUrl = "https://example.com/plugin"`, `networkUrl =
   "https://example.com/plugin.git"`, asserted at `clone ${networkUrl} ...` in `git.schedule`].
   Under D-2-01/D-2-03 each of these `networkUrl` constants must equal its `cloneUrl` sibling
   (no suffix), since `example.com` is neither github.com nor gitlab.com.

4. **`tests/orchestrators/plugin/clone-cache.test.ts`** — the direct unit-test file for the three
   `clone-cache.ts` functions under change. Concrete `.git`-suffixed-for-non-github assertions:
   lines 719, 757 (`resolveRemoteRefCalls`), 793, 836, 850-858 (`resolved.cloneUrl` AND
   `state.resolveRemoteRefCalls[0]?.url` both asserted `.git`-suffixed for `example.com`), 882, 940
   [VERIFIED: read via grep this session; exact surrounding context not fully read line-by-line —
   flagged here as the primary file the planner must audit test-by-test, since it is the direct
   owner of the functions changing]. Line 1573's `canonicalCloneUrl` assertion
   (`https://example.com/repo.git`) is UNAFFECTED — that is the cache-key identity, unchanged by
   this phase.

5. **`tests/orchestrators/plugin/install-flow.test.ts:8287`** — asserts a clone call
   `{ ref: "main", singleBranch: true, url: "https://example.com/org/repo.git" }` for what appears
   (given `allowedRemoteUrls` at lines 5988-5994 include both `.git`-suffixed and non-`.git` gitlab
   forms) to be a non-github `url`-kind source — needs the same audit.

**This list is not exhaustive** — the broader grep below found ~40 additional hits of
`example.com/....git` / `gitlab.example.com/....git` across `tests/orchestrators/plugin/{list-flow,
update-flow,reinstall-flow}.test.ts`, `tests/orchestrators/edge-deps.test.ts`, `tests/persistence/
state-io.test.ts`, `tests/shared/notification-dispatch.test.ts`, and others. **Most of these are
`source.url`/`source.raw` IDENTITY fixtures** (constructing a `UrlSource`/`GitSubdirSource` test
double, or asserting `sourceLogical`/list-rendering output) and are **unaffected** — they never flow
through `ensureGitSuffix`/`networkCloneUrl` because those tests don't exercise an actual
clone/fetch/resolveRemoteRef call. The five categories enumerated above are the ones confirmed this
session to assert an actual WIRE call (`git.state.calls.clone`, `git.schedule`, `resolveRemoteRefCalls`,
`cloneCall.url`). **The planner should budget a dedicated task to grep
`tests/orchestrators/plugin/clone-cache.test.ts` line-by-line** (it is the single highest-density
file) plus spot-check `list-flow`/`update-flow`/`reinstall-flow` for any clone-call (not just
source-identity) assertions before declaring the suite migrated.

### Call-count assertion for SC3

No new fake capability needed (see above). Recommended pattern per test: after the existing
end-state assertions, add:
```typescript
assert.strictEqual(git.state.calls.clone.length, 1); // or .resolveRemoteRef.length, per operation
```
on BOTH a success-path test and a new/existing failure-path test (e.g. a `cloneError` /
`resolveRemoteRefError` HttpError injection). The failure-path assertion is the actual regression
guard — a reintroduced retry would still pass every success-path end-state check.

### HTTP-error shape for SC2 (original error identity preserved)

Use the shape already established in `tests/shared/git-failure-classifiers.test.ts:263`:
```typescript
// Source: tests/shared/git-failure-classifiers.test.ts:263
Object.assign(new Error("HTTP Error: 401"), { code: "HttpError", data: { statusCode: 401 } })
```
Inject via `createGitOpsFake({ cloneError: ... })` or `{ resolveRemoteRefError: ... }`
[VERIFIED: tests/platform/git-ops-fake.ts:19-24 — both options exist on `GitOpsFakeOptions`], then
assert the thrown error's `message`/`data.statusCode` survives unchanged through the seam AND that
exactly one call was recorded.

## Gate Exposure

- **`scripts/check-unused-type-members.contracts.json`** — zero existing entries reference
  `clone-key.ts` or `source.ts` [VERIFIED: `grep -c "clone-key\|source.ts"
  scripts/check-unused-type-members.contracts.json` → `0`]. Adding `networkCloneUrl` (a function,
  not a type member) needs no pin, consistent with D-2-03's own claim.
- **`tests/architecture/gate-targets.ts`** — zero references to `clone-key` or `domain/source`
  [VERIFIED: grep returned no matches]. No named-file gate exposure.
- **`tests/architecture/import-boundaries.test.ts`** — `DOMAIN_ZONE` forbids imports FROM
  edge/orchestrators/bridges/transaction/persistence zones INTO domain; it does not forbid
  domain-to-domain imports [VERIFIED: tests/architecture/import-boundaries.test.ts:60-65]. A new
  export in `domain/source.ts` consumed by `domain/clone-key.ts` (already importing types from
  `source.ts` today) crosses no forbidden boundary.
- **`tests/architecture/partial-vocabulary-guard.test.ts`** — scoped to a DIFFERENT, unrelated
  rename (D-75-01 force/unsupported vocabulary); not implicated
  [VERIFIED: tests/architecture/partial-vocabulary-guard.test.ts:1-12].
- **`tests/architecture/no-stale-test-citations.test.ts`** — polices file-path citations in
  comments/docs, not test names or behavior; relevant only if a test FILE is deleted (this phase
  edits existing files, deletes none) [VERIFIED: tests/architecture/no-stale-test-citations.test.ts:1-14].
- **No vocabulary/source-walk gate found that names "retry", "ensureGitSuffix", or ".git"
  specifically** — this refactor is not source-scanned by any architecture gate beyond the ones
  above.

## The 100% coverage arithmetic

`npm run test:coverage:unit` requires 100% lines/functions/branches across the whole
`extensions/**` tree [VERIFIED: package.json line 99 — `--test-coverage-lines=100
--test-coverage-functions=100 --test-coverage-branches=100`]. `npm run test:coverage:direct` runs
each corresponding test file IN ISOLATION against its one source file and compares against a pin
file that is currently EMPTY (`rows: []`) [VERIFIED: scripts/test-coverage-direct.pin.json — `{
"version": 1, "rows": [] }`], meaning every module in the tree today achieves 100% direct coverage
with no exceptions. Adding `networkCloneUrl` as a 3-arm branch (github / url / git-subdir) means:

- **`tests/domain/clone-key.test.ts` alone must exercise all 3 arms** of `networkCloneUrl` for
  `domain/clone-key.ts` to keep hitting 100% when run in isolation — mirror the existing
  `describe("canonicalCloneUrl", ...)` 3-case block (lines 119-166) with an equivalent
  `describe("networkCloneUrl", ...)` block covering: a `github` source, a `url` source WITHOUT
  `.git` in raw, and a `url` source WITH `.git` in raw (the case CONTEXT.md's Specific Ideas
  section calls out as the one "a naive implementation gets wrong in the opposite direction"), plus
  a `git-subdir` source. That is a minimum of 4 direct test cases, not 3, because the `url` arm
  itself has two behaviorally distinct sub-cases (git-suffixed vs not) even though it is one
  `switch` arm.
- **No new pin row should be needed** if `clone-key.test.ts` covers all arms directly — adding one
  would be a red flag that direct coverage was not achieved and should prompt closing the gap
  rather than pinning around it (the empty `rows: []` state is itself evidence this codebase treats
  a new pin as exceptional, not routine).
- Similarly, the new `domain/source.ts` strip helper needs direct-arm coverage in
  `tests/domain/source.test.ts` for: trailing slash only, `#ref` only, both, neither, and (to prove
  the `.git` NON-strip) an input ending in `.git` that must NOT be touched.
- `orchestrators/plugin/clone-cache.ts`'s three functions are already covered by
  `tests/orchestrators/plugin/clone-cache.test.ts` at whatever branch density exists today; adding
  a `networkUrl` parameter does not add a new BRANCH inside `clone-cache.ts` itself (it's a
  straight pass-through), so no new direct-coverage arm is needed there beyond updating the
  existing assertions' expected values (see Test Surface above).

## Common Pitfalls

### Pitfall 1: Deriving the `url` arm from `source.url` instead of `source.raw`

**What goes wrong:** `source.url` is ALREADY `.git`-stripped at parse time (D-76-01 identity rule).
Deriving `networkCloneUrl`'s `url` arm from `source.url` would silently strip `.git` even when the
user's raw input had it, breaking SC4 ("a `url` source's wire URL preserves the suffix decision the
user's own input made").
**Why it happens:** `source.url` is the variable already in scope at most call sites (used for
`canonicalCloneUrl`/cache-key purposes), making it the easy but wrong reach.
**How to avoid:** `networkCloneUrl` must take the FULL `source` object (not a bare `cloneUrl`
string) precisely so it can read `source.raw` for the `url` arm. This is why D-2-03 requires
threading a `networkUrl` parameter through the seam rather than re-deriving inside
`clone-cache.ts` from the `cloneUrl` string alone.
**Warning signs:** A test with a `.git`-suffixed raw url (e.g.
`https://example.com/repo.git`) asserting the wire URL comes back suffix-less.

### Pitfall 2: Missing the `#ref`-embedded-in-raw case for object-form sources

**What goes wrong:** For a STRING-form source (`"https://gitlab.com/acme/mp.git#main"` typed
directly), `source.raw` includes the `#main` fragment
[VERIFIED: extensions/pi-claude-marketplace/domain/source.ts — `parseUrlSource` sets `raw: raw`
verbatim at line 477]. For an OBJECT-form source (`{ source: "url", url: "....git", ref: "main" }`),
`source.raw` does NOT include a `#ref` (the ref arrives as a separate JSON field and `urlObjectSource`
passes only the `url` string to `parseUrlSource`, so `.raw` is jjust that url string)
[VERIFIED: extensions/pi-claude-marketplace/domain/source.ts:170-187]. The new strip helper must
handle BOTH shapes of `raw` correctly — i.e., must still split on `#` even though in the object-form
case there will be nothing to split.
**How to avoid:** Test both forms directly (see coverage arithmetic above); the existing
`stripUrlDecorations` already handles both today for its own (`.git`-stripping) purpose, so the
extracted shared helper inherits this correctness for free if the split is done right.

### Pitfall 3: Test files pinned to the CURRENT wrong behavior look "already green"

**What goes wrong:** Tests like `tests/orchestrators/marketplace/add.test.ts`'s "MURL-01: url
source clones source.url `.git`-suffixed..." currently PASS and will continue to pass if the
implementation change is incomplete or reverted — because they assert the OLD behavior. A plan that
only adds new tests without touching these will ship with the regression these tests exist to
catch now inverted (green tests asserting the wrong thing).
**How to avoid:** Treat "update existing wire-URL assertions" as an explicit task in the plan, not
an afterthought of "add new tests." Search using the concrete line numbers in this document as a
starting checklist, then re-grep for `\.git"` in `tests/orchestrators/plugin/clone-cache.test.ts`
and `tests/orchestrators/plugin/fetch.test.ts` after the implementation change to confirm no
non-github stale assertion survives.

## Code Examples

### Recommended `networkCloneUrl` (illustrative — exact code is executor's to write; shape only)

```typescript
// domain/clone-key.ts — sibling to canonicalCloneUrl (source.ts:79-83)
export function networkCloneUrl(source: UrlSource | GitSubdirSource | GitHubSource): string {
  switch (source.kind) {
    case "github":
      return `${canonicalCloneUrl(source)}.git`;
    case "url":
      return stripSlashAndFragment(source.raw).base; // .git preserved, per D-2-03
    case "git-subdir":
      return source.url; // already verbatim; raw === url always (see proof above)
  }
}
```
(`stripSlashAndFragment` is the new export proposed in `domain/source.ts`, extracted from
`stripUrlDecorations`'s first two steps — see § The decoration-stripping design above.)

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase in the sense the inventory targets
(no stored-data key rename, no live-service config, no OS-registered state, no secret/env var
rename, no build artifact). Skipping per the template's own trigger condition.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exhaustive list of ~40 additional `.git`-suffixed non-github test fixtures outside the 5 confirmed categories are all source-identity fixtures unaffected by this phase (not wire-call assertions) | Test Surface § "This list is not exhaustive" | If one of the unaudited hits (e.g. in `list-flow.test.ts`, `update-flow.test.ts`, `reinstall-flow.test.ts`) is actually a clone-call assertion rather than a source-identity fixture, `npm run check` will fail after implementation and the plan will need an unplanned fix-up task. Mitigation already stated: planner should budget a dedicated audit task before declaring the suite migrated. |
| A2 | No architecture gate outside the ones checked (`gate-targets.ts`, `import-boundaries.test.ts`, `check-unused-type-members.contracts.json`, `partial-vocabulary-guard.test.ts`, `no-stale-test-citations.test.ts`) references `ensureGitSuffix`, `clone-key.ts`, or the specific strings this phase touches | Gate Exposure | A missed gate would surface as an unexpected `npm run check` failure; low risk since `check` is run at every phase boundary per project convention and would catch it before merge. |

## Open Questions

1. **Exact name and file organization of the new `domain/source.ts` strip helper.**
   - What we know: it must expose the slash+fragment strip without the `.git` strip, and
     `stripUrlDecorations` should be refactored to call it (not duplicated).
   - What's unclear: whether to export it as `stripSlashAndFragment` or fold it into
     `networkCloneUrl`'s own module as a private helper that imports raw string utilities instead
     (less clean, since `domain/source.ts` already owns URL-string parsing conventions).
   - Recommendation: export from `domain/source.ts` (keeps all URL-string manipulation in one
     module, matches the existing `ensureGitSuffix`-is-source.ts's-sibling precedent) — this is
     explicitly left to Claude's discretion in CONTEXT.md, so the planner should pick one and move
     on rather than treating it as a blocking decision.

2. **Whether `tests/orchestrators/plugin/clone-cache.test.ts` needs a full pass or can be
   patched incrementally.**
   - What we know: at least 7 line locations (719, 757, 793, 836, 850-858, 882, 940) assert
     `.git`-suffixed wire URLs for non-github hosts.
   - What's unclear: whether these are all independent test cases (patchable one at a time) or
     share a common fixture/constant that, once fixed, cascades correctly.
   - Recommendation: the planner should read this file in full during plan execution (not just
     grep-and-patch) given its size (1575 lines) and density of hits — treat it as its own task.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no external test framework) |
| Config file | none — behavior driven by `npm run test` / `test:coverage:unit` script flags in `package.json` (lines 88, 99) |
| Quick run command | `node --test tests/domain/clone-key.test.ts tests/orchestrators/plugin/clone-cache.test.ts` |
| Full suite command | `npm run check` (typecheck, lint, fallow, format, test:corresponding, test:coverage:direct, test:coverage:unit at 100%, test:integration, lint:type-members) [VERIFIED: package.json:77] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MURL-08 | `networkCloneUrl` derives the correct wire URL per source kind (github/url/git-subdir, `.git`-present and `.git`-absent url sub-cases) | unit | `node --test tests/domain/clone-key.test.ts` | ✅ (existing file, new `describe` block) |
| MURL-08 | The four/nine call sites pass the derived `networkUrl` (not `ensureGitSuffix(cloneUrl)`) to `gitOps.clone`/`resolveRemoteRef` | unit/integration | `node --test tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/marketplace/add.test.ts` | ✅ (existing files, assertions need updating — see Test Surface) |
| MURL-08 | End-to-end: add/install/update/fetch against a verbatim-only endpoint succeeds | integration/edge | `node --test tests/edge/handlers/marketplace/add.test.ts tests/orchestrators/plugin/fetch.test.ts` | ✅ (existing, needs new `.git`-only-serves-verbatim fixture case) |
| MURL-09 (re-aimed) | Exactly one network call per operation, success AND failure path | unit | `assert.strictEqual(git.state.calls.clone.length, 1)` added to existing + one new failure-path test per seam | ⚠️ Wave 0 gap — assertion not yet written anywhere (fake already supports it) |
| MURL-09 (re-aimed) | A 401/403/404/5xx keeps its original error identity/message (no rewrite to not-found/generic) | unit | HttpError-shaped injection via `createGitOpsFake({ cloneError / resolveRemoteRefError })`, asserted through `classifyGitTransportFailure`-consuming callers | ✅ pattern exists (`tests/shared/git-failure-classifiers.test.ts`), needs new cases wired through the seam |

### Sampling Rate
- **Per task commit:** `node --test <the one or two files touched by that task>`
- **Per wave merge:** `npm run test:coverage:direct && npm run test:coverage:unit`
- **Phase gate:** `npm run check` green before `/gsd-verify-work` (matches the milestone-wide GATE-01 constraint, enforced at every phase boundary per ROADMAP.md § Milestone-wide constraints)

### Wave 0 Gaps
- [ ] No test file currently asserts a call-count of exactly one for any clone-cache seam on the
      FAILURE path — every existing failure-path test asserts only the thrown error, not
      `git.state.calls.*.length`. This is the SC3 regression guard and must be added, not assumed
      to already exist.
- [ ] No existing fixture simulates a host that serves ONLY the verbatim (non-`.git`) path and
      404s the `.git` form — today's `createGitOpsFake` `allowedRemoteUrls` mechanism can express
      this directly (allowlist the verbatim URL only, omit the `.git` form), so no new fake
      capability is needed, only a new test case per the affected seam.
- [ ] Framework install: none — `node:test` is already the project's sole framework.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged this phase — Phase 1 (GAUTH-03..06) owns all auth-bundle wiring; this phase only changes which URL STRING is sent, not how credentials attach to the request. |
| V3 Session Management | no | Not applicable — no session concept in this extension. |
| V4 Access Control | no | Unchanged — host-binding guard (`onAuth` comparing `new URL(url).host` against the bundle's bound host, D-1-03) is untouched; the verbatim URL is same-host by construction (CONTEXT.md canonical_refs), so the guard's invariant still holds. |
| V5 Input Validation | yes | `domain/source.ts::parseUrlSourceForm` already restricts accepted URLs to `https://` scheme only (D-76-01); this phase does not loosen that gate — it only changes how much of the ALREADY-VALIDATED string's trailing decoration is stripped before the string reaches the wire. No new untrusted-input path is introduced. |
| V6 Cryptography | no | Not applicable — no crypto surface touched (the `createHash("sha256")` calls in `domain/clone-key.ts` are unchanged, used only for cache-key derivation, not security). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via attacker-controlled clone URL | Tampering/Info Disclosure | Out of scope for this phase specifically — the URL still must pass `parseUrlSourceForm`'s `https://`-only scheme gate before it ever reaches `networkCloneUrl`; this phase does not touch that gate. `[ASSUMED]` no new SSRF surface is opened, since the change is confined to suffix stripping on an already-scheme-validated string — not independently re-verified against the parser this session beyond confirming the gate's location (`domain/source.ts:325-340`). |
| Credential leak across hosts via URL confusion | Info Disclosure | Already mitigated by Phase 1's GAUTH-06 (`onAuth` host-compare, D-1-03) and unaffected by this phase — the verbatim URL is same-host by construction per CONTEXT.md's own canonical_refs note. |

## Sources

### Primary (HIGH confidence — read this session)

- `extensions/pi-claude-marketplace/domain/clone-key.ts` (full file) — canonicalCloneUrl / pluginCloneKey / pluginMirrorKey
- `extensions/pi-claude-marketplace/domain/source.ts` (full file) — ParsedSource union, stripUrlDecorations, ensureGitSuffix, parseUrlSourceForm
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` — materializePluginClone, materializeOrRefreshPluginMirror, resolvePluginPin
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — addGitClonedInGuard, addGithubInGuard, addUrlInGuard
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install-clone-probe,reinstall-clone-probe,fetch,info,update-preflight}.ts` — all 9 upstream call sites
- `extensions/pi-claude-marketplace/persistence/state-io.ts` — normalizeStoredSource (confirms no git-subdir branch)
- `tests/domain/clone-key.test.ts`, `tests/domain/source.test.ts` (partial) — existing test patterns
- `tests/platform/git-ops-fake.ts` (full file) — call-recording fake, confirms calls recorded before throw
- `tests/edge/handlers/marketplace/add.test.ts`, `tests/orchestrators/marketplace/add.test.ts`, `tests/orchestrators/plugin/fetch.test.ts` (relevant sections) — load-bearing tests requiring rewrite
- `scripts/check-corresponding-tests.mjs`, `scripts/test-coverage-direct.mjs`, `scripts/test-coverage-direct.pin.json`, `package.json` (gate scripts) — gate mechanics
- `tests/architecture/{import-boundaries,gate-targets,partial-vocabulary-guard,no-stale-test-citations}.test.ts` — gate exposure checks
- `.planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-CONTEXT.md` — locked design decisions (D-2-01..D-2-04), upstream parity evidence (accepted, not re-verified this session per research-emphasis instruction)
- `.planning/workstreams/git-hosts/REQUIREMENTS.md`, `.planning/workstreams/git-hosts/ROADMAP.md` (Phase 2 section), `.planning/workstreams/git-hosts/STATE.md`

### Secondary (MEDIUM confidence)

- None — no web/docs lookups were needed; this is a pure in-repo mechanical refactor with the
  design already locked upstream in CONTEXT.md.

### Tertiary (LOW confidence)

- The ~40 additional `.git`-suffixed test hits outside the 5 confirmed categories (grep results
  only, not individually read this session) — see Assumptions Log A1.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new dependency
- Architecture: HIGH — every call site read and its caller traced this session
- Test surface / blast radius: HIGH for the 5 confirmed categories (read directly); MEDIUM for the
  broader grep-only list (Assumption A1)
- Gate exposure: HIGH — every named gate file checked by grep/read this session

**Research date:** 2026-09-26
**Valid until:** No expiry concern — this is a snapshot of the current repository state, not an
external API/library surface that drifts. Re-verify only if the codebase changes materially before
planning executes (e.g., another phase lands first and touches the same files).
