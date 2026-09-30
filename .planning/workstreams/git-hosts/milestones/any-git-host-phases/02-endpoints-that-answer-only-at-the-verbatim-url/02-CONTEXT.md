# Phase 2: Endpoints that answer only at the verbatim URL - Context

**Gathered:** 2026-09-26
**Status:** Ready for planning
**Mode:** Interactive discuss (autonomous run)

<domain>
## Phase Boundary

A Pi user can add a `url` marketplace source whose smart-HTTP endpoint serves at the URL they typed,
because the extension sends that URL and nothing else. The conventional `.git` suffix is appended
only where Claude Code appends it — a `github.com` `owner/repo` path — and a repository that is
genuinely missing or genuinely forbidden fails as itself because there is no second attempt to
confuse it with.

In scope: the four `ensureGitSuffix` call sites that build a network URL
(`orchestrators/marketplace/add.ts::addGitClonedInGuard`,
`orchestrators/plugin/clone-cache.ts::materializePluginClone` /
`materializeOrRefreshPluginMirror` / `resolvePluginPin`), a new `networkCloneUrl` in
`domain/clone-key.ts`, and the ROADMAP / REQUIREMENTS text that describes the retry this phase
decided not to build.

Out of scope: Codex-layout manifest lookup (`.codex-plugin/plugin.json`) — PR #153 items 1 and 2,
excluded milestone-wide. `marketplace add` leftover-clone adoption (Phase 3). Any change to
`ensureGitSuffix` itself, which survives for the github arm and for Phase 3's same-origin compare.

</domain>

<decisions>
## Implementation Decisions

### The suffix rule

- **D-2-01: clone verbatim; there is no retry and no fallback.** Claude Code appends `.git` only
  for `github.com` and `gitlab.com` `owner/repo` paths; every other host receives the URL as typed.
  Our unconditional `ensureGitSuffix` on the network path is the divergence, and removing it is the
  whole fix. A retry would send the known-bad URL, absorb a 404, and recover; not sending it is
  strictly better and deletes the retry's entire correctness surface (status gate, call-count
  ceiling, destination ownership).
  — **Reversibility:** costly — reinstating a retry means re-deriving both URL forms at all four
  seam sites and re-adding the status classification and cleanup discipline this decision removed.

- **D-2-02: the inverse case is accepted as no longer working.** A suffix-less URL against a host
  that serves only `/repo.git` (the `git http-backend` + nginx-alias shape) succeeds today because
  the extension appends the suffix for the user; under D-2-01 it 404s. Verbatim means verbatim in
  both directions. The failure names the URL that was sent, so the remedy is visible without a
  fallback. Claude Code's own reject text teaches the same thing: "use the full https:// clone URL
  from your host (typically ending in .git — some hosts like Azure DevOps omit it)."
  — **Reversibility:** reversible — it is the absence of a behavior, recoverable by a later
  decision without unwinding anything.

- **`owner/repo.git` shorthand is not a supported form and needs no handling.** Claude Code's
  shorthand validator admits it (the repo half is `[A-Za-z0-9._-]+`) and then builds
  `https://github.com/owner/repo.git.git` — it neither strips nor rejects. Our shorthand arm keeps
  `.git` inside `repo` and `ensureGitSuffix` no-ops, which happens to produce a working single-suffix
  URL. Leave it alone; do not add a strip, a reject, or a test asserting a contract upstream does not
  have.

### Where the derivation lives

- **D-2-03: `networkCloneUrl(source)` in `domain/clone-key.ts`, beside `canonicalCloneUrl`.** Same
  three-kind switch, one module, no new type member:
  - `github` → `canonicalCloneUrl(source)` + `.git` (Claude Code's github arm — unchanged behavior)
  - `url` → the verbatim form: `raw` with trailing slashes and a `#<ref>` fragment stripped, and the
    `.git` decision **preserved**
  - `git-subdir` → `source.url`, which `gitSubdirObjectSource` already takes verbatim from the
    manifest

  `domain/clone-key.ts` already owns the single URL reconstruction (D-77-06 / PURL-07) and
  `canonicalCloneUrl`'s docstring already names this split — it declines to fold the suffix in
  because doing so "would rehash every `plugin-clones/` directory and cold-miss every warm clone".
  The network URL is the sibling that docstring anticipates.

  The four seam call sites take a `networkUrl` string alongside the `cloneUrl` they already pass.
  Every one of them either holds the parsed source or is called by something that computes
  `canonicalCloneUrl` from it, so no source object has to be threaded down into the clone seam.
  — **Reversibility:** reversible — a new pure function plus one parameter per seam signature.

- **Rejected: a new field on the parsed source.** Storing the wire URL on `UrlSource` at parse time
  would be a new type member requiring a production read or a
  `scripts/check-unused-type-members.contracts.json` pin (GATE-01), would need revalidating in the
  `persistence/state-io.ts` schema and the load-time factories, and would have to be mirrored on the
  sibling kinds or the union diverges. Adding a member to a closed set compiles clean at every
  derivation site — the silent-omission class this repo has shipped three times in one milestone.

- **Rejected: recomputing from `raw` at each call site.** Four copies of the stripping logic, and it
  partly undoes the D-77-06 consolidation that put URL reconstruction in one place.

- **Rejected: letting `url` be the verbatim form (dropping the parse-time `.git` strip).** D-76-01's
  identity rule exists so `https://host/repo.git` and `https://host/repo` compare as the same source
  through `sourceLogical` / `samePlannedSource`, and `pluginCloneKey` / `pluginMirrorKey` hash `url`.
  Changing it would split identity and cold-miss every warm clone.

### Requirements and success criteria

- **D-2-04: MURL-09 is re-aimed, not retired.** Its three clauses — never masks a real failure,
  never retries on a status that does not mean "wrong path", never deletes a directory the caller
  owns — all presuppose a second attempt. Rewrite it as the assertion that survives: **the URL sent
  is exactly the one the user typed modulo decoration stripping, and exactly one network attempt is
  made per operation.** That keeps the ID traceable in the coverage table and is provable by the
  call-count assertion Phase 2's SC3 already asked for, against `1` instead of `2`.

- **ROADMAP Phase 2 success criteria must be corrected before planning.** SC3 becomes a call count
  of exactly one; SC4 (a failed first attempt leaves the caller's destination untouched) drops as
  vacuous — there is no first attempt to fail separately from the only attempt. SC1, SC2 and SC5
  stand as written. The planner reads ROADMAP success criteria as the spec, so this edit is a
  prerequisite, not a cleanup.

### The url identity is a fixed point

- **D-2-05: the `url` cache identity normalizes a trailing slash that sits immediately before a
  `#<ref>` fragment, so the identity is a FIXED POINT.** `https://gitlab.com/o/r/#main` and
  `https://gitlab.com/o/r.git/#main` both have the identity `https://gitlab.com/o/r`, on the first
  parse of the typed string and on every later re-parse of the persisted `{kind, raw, url}` record.
  A trailing slash sitting in front of a fragment carries no meaning in a clone URL, so the
  slash-less form is the canonical one.

  **Why this overrides the byte-identity gate two earlier passes held.** Pre-phase `130d68a9`
  contradicted itself on exactly this input shape: the first parse computed `.../o/r/` while every
  later reload computed `.../o/r`. So `add` stored one `plugin-clones/<hash>` and every subsequent
  operation recomputed a different one — the clone directory was orphaned and re-cloned forever,
  for any `url` source typed with a trailing slash immediately before a `#<ref>`. Preserving
  pre-phase bytes on BOTH paths preserves that bug; the two properties are mutually exclusive.
  Operator-decided 2026-09-27: buy the fix.

  **Accepted cost.** One re-clone for that input class on first use after upgrade — the same cost
  the byte-identity alternative carried, and it converges: a persisted record still holding the old
  `.../o/r/` value normalizes to `.../o/r` on its next reload and stays there.

  **Scope.** The normalization is the `url` kind only. A `github` source's identity is its
  `owner`/`repo` pair, and `parseGitHubUrl` keeps stripping slashes BEFORE the fragment split, so
  `https://github.com/o/r/#main` stays rejected with the canonical-form diagnostic rather than
  widening the accepted parse surface. `git-subdir` takes its `url` verbatim from the manifest and
  is untouched. D-2-01 / D-2-02 / D-2-03 / D-2-04 are unchanged: the WIRE form still derives from
  `raw` and still carries whatever `.git` decision the user typed.

  **Structure.** `domain/source.ts` keeps the wire composition (`stripSlashAndFragment`) and the two
  identity compositions (`stripUrlDecorations` for `url`, `stripGitHubUrlDecorations` for `github`)
  as separate named functions that share no composition, only the two leaf primitives. The `url`
  identity and the wire form now agree on ordering; they are NOT collapsed into one helper, because
  a shared helper is what let a wire-side correction move the cache identity once already.
  — **Reversibility:** costly — reverting the ordering re-orphans the clone directory for that input
  class and re-clones it a second time.

### Claude's discretion

Naming beyond `networkCloneUrl`, the exact decoration-stripping helper shape in `domain/source.ts`
(a `stripUrlDecorations` variant, a parameter, or a second small function), test file layout, and
how the four seam signatures name the new parameter.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap

- `.planning/workstreams/git-hosts/REQUIREMENTS.md` — MURL-08 and MURL-09. **MURL-09's text is
  superseded by D-2-04 above** and must be rewritten as part of this phase.
- `.planning/workstreams/git-hosts/ROADMAP.md` § Phase 2 — success criteria; SC3 and SC4 are
  corrected per D-2-04. § Milestone-wide constraints carries GATE-01, green at every phase boundary.
- `.planning/workstreams/git-hosts/phases/01-private-repos-on-any-git-host/01-CONTEXT.md` — D-1-01
  (every https host gets an auth bundle) and D-1-03 (`onAuth` compares `new URL(url).host` against
  the bundle's bound host). The verbatim URL is same-host by construction, so the host guard is
  unaffected; no auth change belongs in this phase.

### Upstream parity evidence

Claude Code 2.1.274 at `~/.local/share/claude/versions/2.1.274`. There is no doc page for the
suffix rule — the binary is the contract. Re-derive with `grep -oab '<marker>' <binary>` then
`tail -c +<offset> | head -c <n>`:

- Marketplace source parser, the `async function Tqe(` near byte 195895638. Three git arms:
  (1) `S.endsWith(".git") || S.includes("/_git/")` → `{source:"git", url}` **verbatim, any host**;
  (2) `ho(hostname)` where `Fs = "github.com"`, path matches `owner/repo` → append `.git`;
  (3) `fio(hostname)` where `dio = "gitlab.com"`, path is exactly `owner/repo` with `ye[0] !== "api"`
  and no hyphen segment → append `.git`; otherwise fall through to `{source:"url", url: S}`.
- Add dispatcher `xpt`'s switch near byte 198263463: `case"git"` calls
  `G0(e.url, D, r, e.ref, e.sparsePaths, n)` — the URL passes through untouched into
  `l1n(n, e, {...})`, verified no appending. `case"url"` writes `${ve}.json` and calls
  `iKn(e.url, D, ...)` — an HTTP fetch of a hosted `marketplace.json`, **never a clone**.
- The shorthand validator `BYe = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/` and
  the reject text that names the `.git` convention, in the same `Tqe` body.

### Transport mechanism

- `node_modules/isomorphic-git/index.cjs:9457` — `url: \`${proxifiedURL}/info/refs?service=${service}\``.
  The smart-HTTP ref advertisement pastes the repository URL in verbatim, so the `.git` suffix is
  part of the request path prefix. Neither isomorphic-git nor the `git` CLI appends it; every `.git`
  we send comes from `ensureGitSuffix`.

### Tier and gate constraints

- `tests/architecture/import-boundaries.test.ts` — `EXPECTED_FORBIDDEN[PLATFORM_ZONE]` names
  `DOMAIN_ZONE`. **`platform/` may not import `domain/`** (D-11, also enforced by ESLint
  `import-x/no-restricted-paths`). This is why the derivation cannot live inside `platform/git.ts`.
- `scripts/check-unused-type-members.contracts.json` — pins are `line:col` and shift under edits and
  merges. D-2-03 introduces no type member, so this file should need no change; if planning finds
  otherwise, say so rather than adding a pin silently.

</canonical_refs>

<code_context>
## Existing Code Insights

### The defect, traced

`marketplace add https://bifrost.nucleix.io/api/skills/serve/codex` (PR #153's motivating case):
`parseUrlSourceForm` (`domain/source.ts:331`) sends every non-`github.com` `https://` URL to
`parseUrlSource` with no path-shape restriction, yielding
`{kind:"url", raw: ".../codex", url: ".../codex"}`. `addUrlInGuard` passes `source.url` as
`cloneUrl` to `addGitClonedInGuard`, which sends `ensureGitSuffix(cloneUrl)` — so the ref
advertisement goes to `.../codex.git/info/refs?service=git-upload-pack` and 404s. Under D-2-03 it
goes to `.../codex/info/refs?service=git-upload-pack` and resolves.

Note the fix is parity on suffix handling layered on semantics that already exceed upstream: Claude
Code would classify that same URL as `{source:"url"}` — unknown host, no `.git` — and fetch it as a
hosted `marketplace.json` rather than cloning it. Our `url` kind is a clone source (MURL-01). Both
halves are needed for the case to work.

### The four call sites

All four already hold both URL forms as locals, so the fallback URL needs no new derivation at the
seam — only a correct one at the source:

| Site | Current line | Has the source? |
|---|---|---|
| `orchestrators/marketplace/add.ts::addGitClonedInGuard` | `url: ensureGitSuffix(cloneUrl)` (~692) | Yes — `args.source` |
| `orchestrators/plugin/clone-cache.ts::materializeOrRefreshPluginMirror` | `networkUrl = ensureGitSuffix(args.cloneUrl)` (266) | No — caller `update-preflight.ts::probeUnpinned` computes `canonicalCloneUrl(gitSource)` |
| `orchestrators/plugin/clone-cache.ts::resolvePluginPin` | `networkUrl = ensureGitSuffix(cloneUrl)` (545) | Yes — `args.source` |
| `orchestrators/plugin/clone-cache.ts::materializePluginClone` | `ensureGitSuffix` on `args.cloneUrl` | No — callers (`install-clone-probe`, `fetch`, `info`, `reinstall-clone-probe`) compute `canonicalCloneUrl` |

### Established patterns this phase must respect

- **`cloneUrl` is identity, `networkUrl` is transport.** `resolvePluginPin`'s comment states the
  invariant: `cloneUrl` "is the cache-key identity and is what this function RETURNS; `networkUrl`
  is the same value `.git`-suffixed and is only ever sent to the remote." D-2-03 changes what
  `networkUrl` is, not the invariant. No clone or mirror key changes, so no warm clone cold-misses.
- **`parseUrlSource` strips one trailing `.git`** via `stripUrlDecorations` (`source.ts:428-430`),
  after trailing slashes and a `#<ref>` fragment. The verbatim form must strip the first two and
  keep the third.
- **`git-subdir` is not parse-canonicalized.** `gitSubdirObjectSource` stores the manifest's `url`
  verbatim as both `raw` and `url`, so its verbatim form may already carry `.git`. Deriving from
  `raw` and from `url` give the same answer there; pick one and say which.

### The existing suite asserts the defect — this is the phase's main execution risk

**`npm run check` will go green having verified the opposite of SC4 unless these are rewritten
first.** The current `.git`-for-every-host behavior is not merely untested — it is pinned by name,
by suites that will keep passing after the production change lands because their expectations were
written against `ensureGitSuffix`. Verified counts of `.git"` wire literals, and the cases that name
the old contract in their own titles:

| Test file | `.git"` literals | Names the old contract |
|---|---|---|
| `tests/orchestrators/marketplace/add.test.ts` | 26 | **line 2344** — `MURL-01: url source clones source.url \`.git\`-suffixed with a bundle bound to its host`; comments at 2366, 2868, 2884 also assert `ensureGitSuffix` restores the suffix |
| `tests/orchestrators/plugin/clone-cache.test.ts` | 18 | **line 824** — `MURL-01 / PURL-09: resolvePluginPin sends a \`.git\`-suffixed url but returns the canonical suffix-less cloneUrl` |
| `tests/orchestrators/plugin/fetch.test.ts` | 16 | 21 `networkUrl` references carrying the suffixed form |
| `tests/orchestrators/plugin/install-flow.test.ts` | 8 | — |
| `tests/orchestrators/plugin/update-flow.test.ts` | 6 | — |
| `tests/orchestrators/plugin/info.test.ts` | 5 | — |
| `tests/edge/handlers/marketplace/add.test.ts` | 1 | — |

Not every literal is a wire-URL expectation; many are source-identity fixtures that stay correct.
The distinction the plan must make per file is **"is this asserting what we SEND, or what we
STORE?"** — the sent form changes under D-2-01, the stored/canonical form does not (D-76-01 is
untouched). Titles and comments naming `ensureGitSuffix` or "`.git`-suffixed ... on the wire" are the
reliable signal for the first kind.

Two of these are worse than stale: `add.test.ts:2344` and `clone-cache.test.ts:824` encode the old
rule in their test NAMES under the MURL-01 / PURL-09 IDs. Retitle them rather than editing the
assertion under an unchanged name — a suite whose case names still promise the old contract is how
the next reader concludes this phase never shipped.

**Plan obligation.** Treat the test rewrite as first-class task work with its own verification, not
as fallout from the production edit. A task that changes `networkCloneUrl` and leaves these suites
untouched produces a green run that checked nothing, which is exactly the failure SC3's call-count
assertion exists to catch — and the count assertion itself cannot catch a wrong URL, only a wrong
number of attempts. Assert the sent URL BY VALUE alongside the count.

### Integration points

- `ensureGitSuffix` keeps exactly one live consumer after this phase — the github arm inside
  `networkCloneUrl` — plus Phase 3's planned same-origin comparison, which normalizes both sides
  through it. Do not retire it.
- `marketplace update` for a `url` source runs `refreshUrlClone` → `refreshGitHubClone` → a `fetch`
  against the existing checkout, which uses the `origin` remote isomorphic-git wrote at clone time.
  It does not re-derive a URL, so already-added sources are unaffected by this change.
  `resolvePluginPin` **does** re-derive on every call, which is where a previously-working
  suffix-less-input source on a `.git`-only host would start failing (D-2-02, accepted).

</code_context>

<specifics>
## Specific Ideas

- Prove the suffix rule by value, not by shape. A test asserting "the URL sent contains no `.git`"
  passes on a URL that is wrong for other reasons; assert the exact string the seam received.
- SC3's call-count assertion is the load-bearing one under D-2-01. It must pin the count at exactly
  one, on both the success and the failure path — a regression that reintroduced a fallback would
  otherwise pass every end-state assertion.
- Cover the `.git`-carrying `url` input explicitly (`https://host/owner/repo.git`): it is the case
  that distinguishes "derive from `raw`" from "use the canonical `url`", and the one a naive
  implementation gets wrong in the opposite direction.

</specifics>

<deferred>
## Deferred Ideas

- **The gitlab.com parity gap.** Claude Code appends `.git` for `gitlab.com` `owner/repo` paths
  (arm 3); our parser holds no gitlab literal, so `https://gitlab.com/o/r` is a `url` kind and will
  go out suffix-less. gitlab.com serves both forms, so nothing breaks — this is parity for its own
  sake and was explicitly not adopted. Revisit only against evidence of a gitlab instance that
  needs it.
- **Shorthand vs URL cache-identity asymmetry.** `owner/repo.git` as a shorthand keeps `.git` inside
  `repo` and therefore hashes to a different clone identity than the same repo typed as a URL, which
  gets stripped. A pre-existing D-76-01 hole on the shorthand arm, untouched here.
- **Codex-layout manifest lookup** (`.codex-plugin/plugin.json`) — PR #153 items 1 and 2, excluded
  milestone-wide because Claude Code 2.1.274 contains zero references to `.agents/plugins/` or
  `.codex-plugin/`. Consequence to state plainly: after Phase 2 a Bifrost-style endpoint serving
  *Claude* layout clones and adds; one serving *Codex* layout clones and then fails at the manifest
  read, by decision.
- **Azure DevOps `/_git/` URLs.** Claude Code's arm 1 treats them as verbatim git sources. Ours
  reach the same outcome through the generic `url` arm under D-2-03, so no special case is needed —
  noted so a future reader does not add one.

</deferred>

---

*Phase: 02-endpoints-that-answer-only-at-the-verbatim-url*
*Context gathered: 2026-09-26*
