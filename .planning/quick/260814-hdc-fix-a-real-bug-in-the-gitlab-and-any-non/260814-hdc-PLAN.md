---
phase: quick-260814-hdc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - tests/domain/source.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/plugin/clone-cache.test.ts
autonomous: true
requirements: [MURL-01, PURL-09]

estimate:
  tokens: 40000
  raw_tokens: 40000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "`marketplace add https://gitlab.com/o/r` (no `.git`) issues a clone whose url ends in `.git` — the live 422 failure path is closed (MURL-01)."
    - "A source url that already ends in `.git` yields exactly one `.git` — never `.git.git` (matters for git-subdir, whose url is stored verbatim)."
    - "github-kind adds still clone `https://github.com/<owner>/<repo>.git`, byte-identical to today."
    - "`resolvePluginPin` still RETURNS the `.git`-less canonical `cloneUrl` while the `resolveRemoteRef` it issues carries the `.git`-suffixed network url (PURL-09)."
    - "`pluginCloneKey` / `pluginMirrorKey` still hash the `.git`-less canonical url, so no warm clone directory is invalidated and no re-clone storm is triggered."
    - "`parseUrlSource`, `stripUrlDecorations`, `sourceLogical` and `samePlannedSource` are unchanged — D-76-01 identity comparison behaves exactly as before."
  artifacts:
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - tests/domain/source.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/plugin/clone-cache.test.ts
  key_links:
    - "The suffix is applied ONLY at the `url:` field of a `gitOps.clone` / `gitOps.resolveRemoteRef` call. Applying it inside `canonicalCloneUrl` instead would rekey every `plugin-clones/` directory (pluginCloneKey / pluginMirrorKey hash that string) and break the D-SEED same-repo comparison at clone-cache.ts:449."
    - "`deriveMarketplaceUrl` reads the seeded clone's `.git/config` origin (which now carries `.git`) and reparses it through `parsePluginSource`, which re-strips `.git`. The D-SEED comparison therefore stays consistent ONLY because parse-time stripping is left untouched."
    - "`hostFromCloneUrl` runs on the unsuffixed url and is unaffected: appending `.git` changes the path, never the host, so the host-keyed auth bundle binds to the same provider."
---

<objective>
Ensure every git clone / remote-ref resolution issued for a `url`-kind or
`git-subdir`-kind source carries a `.git`-suffixed url, so a full
`https://gitlab.com/...` marketplace or plugin source clones instead of failing
with `422 Unprocessable Entity`.

Purpose: `domain/source.ts::stripUrlDecorations` strips a trailing `.git` at parse
time so `sourceLogical` / `samePlannedSource` treat `.../repo` and `.../repo.git`
as one source (D-76-01). That same stripped string is then handed to the network
as the literal clone url (D-76-06). GitLab's smart-HTTP endpoint 301-redirects the
`.git`-less `info/refs` request; `simple-get` (the transport behind
`isomorphic-git/http/node`) downgrades a redirected `POST git-upload-pack` to a
bodyless `GET`, and GitLab answers 422. Verified live today: the `.git`-less clone
fails in 760ms, the `.git`-suffixed clone of the identical repo succeeds in 651ms.
GitHub escapes the bug only because `add.ts:726` rebuilds its clone url with an
explicit `.git`, never routing through the parser.

Two locked decisions govern the fix and are NOT open for revisiting:
1. **Fix shape** — re-append `.git` at the clone/fetch call sites. Parse-time
   stripping and D-76-01 identity comparison stay exactly as they are.
2. **Fix breadth** — host-agnostic. Apply to every `url`-kind and `git-subdir`-kind
   source regardless of host, not scoped to `gitlab.com`.

Output: an exported `ensureGitSuffix` helper in `domain/source.ts`, applied at the
five network-url sites across `orchestrators/marketplace/add.ts` and
`orchestrators/plugin/clone-cache.ts`, with offline mock-gitOps regression coverage.
</objective>

<execution_context>
@/Users/acolomba/src/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/Users/acolomba/src/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/rules/typescript-comments.md

@extensions/pi-claude-marketplace/domain/source.ts
@extensions/pi-claude-marketplace/domain/clone-key.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
@tests/helpers/git-mock.ts
</context>

<interface_context>
Verified by reading the source before planning — treat as ground truth, do NOT
re-derive. Line numbers are as of planning time; locate by identifier if they drift.

**The complete set of network-url sites above the `gitOps` seam.** Every other
orchestrator (`plugin/install.ts`, `update.ts`, `reinstall.ts`, `fetch.ts`,
`info.ts`, `git-source-probe.ts`, `marketplace/update.ts`) reaches the network only
through these, so fixing them covers the whole surface:

| # | File | Function | Line | Field |
|---|------|----------|------|-------|
| 1 | `orchestrators/marketplace/add.ts` | `addGitClonedInGuard` | 648 | `url: cloneUrl` in `gitOps.clone` |
| 2 | `orchestrators/plugin/clone-cache.ts` | `materializePluginClone` | 109 | `url: args.cloneUrl` in `gitOps.clone` |
| 3 | `orchestrators/plugin/clone-cache.ts` | `materializeOrRefreshPluginMirror` | 217 | `url: args.cloneUrl` in `gitOps.clone` |
| 4 | `orchestrators/plugin/clone-cache.ts` | `resolvePluginPin` (ref branch) | 494 | `url: cloneUrl` in `gitOps.resolveRemoteRef` |
| 5 | `orchestrators/plugin/clone-cache.ts` | `resolvePluginPin` (unpinned branch) | 500 | `url: cloneUrl` in `gitOps.resolveRemoteRef` |

- `add.ts:648` is the single clone funnel for BOTH marketplace kinds:
  `addGithubInGuard` (line 726) passes an already-`.git`-suffixed url,
  `addUrlInGuard` (line 788) passes `source.url` — which the parser stripped.
- `gitOps.fetch` takes `dir` + `remote` only; `FetchOptions` has no `url` field, so
  `refreshGitHubClone` (`marketplace/shared.ts:191`) needs no change. Its comment at
  line 187 confirms `add.ts` is the only caller of `clone` on the marketplace side.
- `platform/git.ts` exposes exactly two url-carrying options: `CloneOptions.url`
  (line 47, doc comment line 43-46) and `ResolveRemoteRefOptions.url` (line 92).

**Values that MUST stay `.git`-less (cache-key identity, not network identity):**
- `canonicalCloneUrl(source)` (`domain/clone-key.ts:74`) — `source.url` verbatim for
  url/git-subdir, `https://github.com/<owner>/<repo>` for github.
- `pluginCloneKey(args.cloneUrl, args.pin)` at `clone-cache.ts:94` and
  `pluginMirrorKey(args.cloneUrl)` at `clone-cache.ts:207`.
- The `cloneUrl` returned by `resolvePluginPin` at `clone-cache.ts:505`.
- The `canonicalCloneUrl(src) !== marketplaceUrl` comparison at `clone-cache.ts:449`.

**`git-subdir` confirmed affected, and differently from `url`:**
`gitSubdirObjectSource` (`domain/source.ts:189-197`) never calls
`stripUrlDecorations` — it stores the manifest's `url` verbatim. Pinned by
`tests/domain/source.test.ts:125-126`, where a `.git`-suffixed git-subdir url round-
trips unchanged. So a git-subdir url may arrive at the seam with OR without `.git`:
it needs the same add-if-missing treatment, and it is the kind that actually
exercises the idempotence guard in production. A `url`-kind source can never reach
the seam already `.git`-suffixed (the parser stripped it), so idempotence for that
kind is a unit-level property only.

**Mock seam for the offline regression test** (`tests/helpers/git-mock.ts`):
`makeMockGitOps()` returns `{ gitOps, state }`; `state.cloneCalls[]` records
`{ dir, url, ref?, singleBranch?, auth? }` and `state.resolveRemoteRefCalls[]`
records `{ url, ref?, auth? }`. Asserting on `.url` there is the required
network-free proof.

**Existing assertions that encode the OLD `.git`-less network url and must be
updated** (they are correct-by-old-behavior, not stale cruft):
- `tests/orchestrators/marketplace/add.test.ts:1255` — `"https://gitlab.example.com/team/mp"`, plus the comment above it at 1250-1251.
- `tests/orchestrators/marketplace/add.test.ts:~1290` — the `#ref` test's `deepEqual` url.
- `tests/orchestrators/marketplace/add.test.ts:1520` — `"https://GitHub.com/acme/mp"` (url-kind because the host case does not match the `https://github.com/` prefix).
- `tests/orchestrators/plugin/clone-cache.test.ts:575` — `[{ url: "https://example.com/repo" }]`.
- `tests/orchestrators/plugin/clone-cache.test.ts:612-614` — `[{ url: "https://example.com/repo", ref: "v1.0.0" }]`.

**Existing assertions that MUST stay unchanged** (they are the regression guard):
`add.test.ts:81`, `:125-132`, `:1405`, `tests/orchestrators/plugin/bootstrap.test.ts:186`
and `tests/edge/handlers/plugin/bootstrap.test.ts:132` all already expect
`https://github.com/anthropics/claude-plugins-official.git`;
`clone-cache.test.ts:525`, `:623`, `:640` assert the `.git`-less `resolved.cloneUrl`.
`clone-cache.test.ts:43-90` drive the mock directly, not production code.
</interface_context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Add ensureGitSuffix and close the reported marketplace-add failure end to end</name>
  <files>extensions/pi-claude-marketplace/domain/source.ts, extensions/pi-claude-marketplace/platform/git.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts, tests/domain/source.test.ts, tests/orchestrators/marketplace/add.test.ts</files>
  <behavior>
    - `ensureGitSuffix("https://gitlab.com/o/r")` returns that url with `.git` appended.
    - `ensureGitSuffix("https://gitlab.com/o/r.git")` returns its input unchanged.
    - `ensureGitSuffix("https://gitlab.com/o/r/")` trims the trailing slash first, so the
      result carries the suffix directly after the repo name, not after a slash.
    - `parsePluginSource("https://gitlab.com/o/r.git")` still yields `url` without the
      suffix, and `sourceLogical` of it is still the suffix-less string — the identity
      rule is untouched.
    - `addMarketplace` with `rawSource: "https://gitlab.example.com/team/mp"` records a
      single clone call whose url ends in `.git`, and still carries NO `auth` key
      (D-76-07 public-only path).
    - `addMarketplace` with `rawSource: "https://github.com/anthropics/claude-plugins-official#main"`
      records the same `https://github.com/anthropics/claude-plugins-official.git` url,
      ref `main`, `singleBranch: true` as before.
  </behavior>
  <action>
    In `extensions/pi-claude-marketplace/domain/source.ts`, add an exported function
    `ensureGitSuffix` taking `url: string` and returning `string`, placed immediately
    after `stripUrlDecorations` (it is that function's inverse and belongs beside it).
    Implementation, in this order: copy the argument into a mutable local; while that
    local ends with a forward slash, drop the last character; then return the local
    unchanged when it already ends with `.git`, otherwise the local with `.git`
    concatenated. Declare the return type explicitly
    (`@typescript-eslint/explicit-module-boundary-types`) and leave a blank line after
    the while block (`@stylistic/padding-line-between-statements`).

    Give it a JSDoc block stating exactly three things and nothing more: (1) it is the
    network-side counterpart to `stripUrlDecorations` — parse time strips the suffix so
    `sourceLogical` / `samePlannedSource` compare one canonical identity (D-76-01), and
    this restores it for the wire; (2) the reason it is host-agnostic — the suffix is a
    general git-hosting convention, and a host that 301-redirects the suffix-less
    smart-HTTP endpoint makes the transport downgrade the `POST git-upload-pack` to a
    bodyless `GET`, which the host then rejects (observed against gitlab.com as
    `422 Unprocessable Entity`); (3) the trailing-slash trim exists because a
    `git-subdir` source stores its `url` verbatim (`gitSubdirObjectSource`) and is not
    parse-canonicalized like a `url` source. Cite only durable IDs per
    `.claude/rules/typescript-comments.md` — `D-76-01`, `D-76-06`, `MURL-01` are the
    relevant ones; no phase, plan or milestone references.

    In `orchestrators/marketplace/add.ts`: add `ensureGitSuffix` to the existing value
    import from `../../domain/source.ts` at line 54, and wrap the `url:` field of the
    `gitOps.clone` call inside `addGitClonedInGuard` (line 648) so it passes
    `ensureGitSuffix(cloneUrl)`. Change nothing else in that function — the `cloneUrl`
    parameter, the `hostFromCloneUrl` call sites (lines 735 and 775), and the state
    mutation all keep the unsuffixed value. Then amend two now-inaccurate doc comments
    to describe the new behavior: the `addUrlInGuard` header block at line 754-763 and
    the inline note at line 390-391, each of which currently promises the url is cloned
    exactly as stored. Say instead that the stored url is the canonical identity form and
    the clone url is that value passed through `ensureGitSuffix`, keeping their existing
    `MURL-01` / `D-76-06` / `PROV-02/03/04` anchors.

    In `extensions/pi-claude-marketplace/platform/git.ts`, amend the `CloneOptions.url`
    doc comment (lines 43-46) the same way: url sources supply their canonical url
    passed through `domain/source.ts::ensureGitSuffix`, not the raw stored string. Touch
    no code in that file.

    In `tests/domain/source.test.ts`, add a test block for `ensureGitSuffix` covering the
    four behaviors above (append, idempotent, trailing-slash trim, and that a
    `git-subdir` url already carrying the suffix survives one pass unchanged), titled
    with the `MURL-01` / `D-76-01` anchors. Add one assertion in the same block that
    `parsePluginSource` on a `.git`-suffixed non-github https string still strips it, so
    a future change to the stripping side breaks here first.

    In `tests/orchestrators/marketplace/add.test.ts`, update the three assertions named in
    the interface context to expect the `.git`-suffixed url, and fix the stale explanatory
    comment above the first one so it describes the split (stored source keeps the
    canonical form; the clone url gains the suffix). Do NOT weaken any of them into a
    substring or `endsWith` check — keep exact-equality assertions. Do NOT touch the
    github-kind assertions at lines 81, 125-132 and 1405; they are the unchanged-behavior
    guard.
  </action>
  <reversibility rating="reversible">One pure helper plus one wrapped argument; reverting is a two-line edit and no persisted state encodes the suffix.</reversibility>
  <verify>
    <automated>cd /Users/acolomba/src/pi-claude-marketplace &amp;&amp; node --test tests/domain/source.test.ts tests/orchestrators/marketplace/add.test.ts tests/edge/handlers/marketplace/add.test.ts tests/orchestrators/marketplace/add-seed-mirrors.test.ts tests/orchestrators/plugin/bootstrap.test.ts tests/edge/handlers/plugin/bootstrap.test.ts &amp;&amp; grep -q 'export function ensureGitSuffix' extensions/pi-claude-marketplace/domain/source.ts &amp;&amp; grep -q 'ensureGitSuffix(cloneUrl)' extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts</automated>
  </verify>
  <done>All six suites pass. `ensureGitSuffix` is exported from `domain/source.ts` with its rationale documented; `add.ts` clones through it; the three url-kind add assertions expect the suffix and the github-kind assertions are untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Apply the suffix at the four plugin clone-cache network sites, keeping cache keys canonical</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts, extensions/pi-claude-marketplace/domain/clone-key.ts, tests/orchestrators/plugin/clone-cache.test.ts</files>
  <behavior>
    - `resolvePluginPin` for an unpinned `url` source records a `resolveRemoteRef` call
      whose url carries `.git`, while the returned `cloneUrl` does NOT — one call, two
      forms, key identity preserved.
    - `resolvePluginPin` for a `url` source with a ref records the same suffixed url plus
      the unmodified ref.
    - `resolvePluginPin` for a `git-subdir` source whose url ALREADY ends in `.git`
      records exactly one suffix, and still returns that url verbatim as `cloneUrl`.
    - `resolvePluginPin` for a github source records the suffixed
      `https://github.com/owner/repo.git` and still returns the suffix-less canonical url.
    - `materializePluginClone` records a clone whose url carries `.git`, and lands the
      tree at `pluginCloneDir(pluginCloneKey(unsuffixedUrl, pin))` — the key is derived
      from the suffix-less url, so a directory keyed before this change still hits warm.
    - `materializeOrRefreshPluginMirror` records a clone whose url carries `.git`, and
      lands at `pluginCloneDir(pluginMirrorKey(unsuffixedUrl))`.
  </behavior>
  <action>
    In `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`, add
    `ensureGitSuffix` to the existing value import from `../../domain/source.ts` at
    line 28, then apply it at exactly the four sites listed in the interface context:

    - `materializePluginClone`: introduce a `const networkUrl` bound to
      `ensureGitSuffix(args.cloneUrl)` after the existing `key` line, and pass it as the
      `url:` field of the `gitOps.clone` call. Leave the `pluginCloneKey(args.cloneUrl, args.pin)`
      call on the line above reading the unsuffixed argument.
    - `materializeOrRefreshPluginMirror`: same shape — a `const networkUrl` after the
      `mirrorRoot` line, used only as the `url:` field of `gitOps.clone`, with
      `pluginMirrorKey(args.cloneUrl)` still reading the unsuffixed argument.
    - `resolvePluginPin`: introduce a single `const networkUrl` bound to
      `ensureGitSuffix(cloneUrl)` directly after the existing `cloneUrl` line, and use it
      as the `url:` field of BOTH `gitOps.resolveRemoteRef` calls. The returned object
      keeps `cloneUrl`.

    Add one short comment at each of the three functions (not at each of the four call
    sites) recording why the two values differ: the key/identity half hashes the
    canonical url so a cache entry keyed before this change still hits, while the wire
    half carries the suffix. Anchor on `MURL-01` / `PURL-09` / `D-77-04`; keep it to a
    line or two each.

    In `extensions/pi-claude-marketplace/domain/clone-key.ts`, add one sentence to the
    `canonicalCloneUrl` doc block stating that its result is the cache-key identity and
    that a caller sending it to the network passes it through
    `domain/source.ts::ensureGitSuffix` first. This is the guard against a future reader
    "simplifying" the suffix into this function, which would rehash every
    `plugin-clones/` directory. Change no code in that file.

    In `tests/orchestrators/plugin/clone-cache.test.ts`: update the two `deepEqual`
    assertions at lines 575 and 612-614 to the suffixed url, keeping them as exact
    deep-equality checks. Then add tests for the behaviors above that are not yet
    covered — at minimum the url-kind split assertion (suffixed on the recorded call,
    unsuffixed on the returned `cloneUrl`), the git-subdir already-suffixed idempotence
    case, and one `materializePluginClone` case asserting both that
    `state.cloneCalls[0].url` ends in the suffix and that the returned clone root equals
    `locations.pluginCloneDir(pluginCloneKey(unsuffixedUrl, pin))`. Model the fixture and
    `locations` setup on the existing tests in the file. Title them with the
    `MURL-01` / `PURL-09` / `PURL-04` anchors. Leave the assertions at lines 525, 623 and
    640 exactly as they are — they already pin the `.git`-less `cloneUrl` return contract.

    Do NOT modify `orchestrators/plugin/install.ts`, `update.ts`, `reinstall.ts`,
    `fetch.ts`, `info.ts` or `git-source-probe.ts`: each reaches the network only through
    the seams changed here, and each is covered by the suites in this task's verify.
  </action>
  <verify>
    <automated>cd /Users/acolomba/src/pi-claude-marketplace &amp;&amp; node --test tests/orchestrators/plugin/clone-cache.test.ts tests/orchestrators/plugin/clone-cache-defaults.test.ts tests/orchestrators/plugin/clone-cache-seed.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/install-auth.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/fetch.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/mirror-head-read.test.ts tests/orchestrators/plugin/git-source-probe.test.ts tests/domain/clone-key.test.ts</automated>
  </verify>
  <done>All twelve suites pass. The four clone-cache network sites send a suffixed url; `pluginCloneKey`, `pluginMirrorKey` and the returned `cloneUrl` still read the canonical suffix-less value, proven by an explicit key-equality assertion.</done>
</task>

<task type="auto">
  <name>Task 3: Prove no network-url site was missed and run the full quality gate</name>
  <files>(no new edits expected — fix-only if a gate fails)</files>
  <action>
    Run the exhaustiveness gate and the repository quality bar (NFR-6).

    The gate collects a 5-line window after every `gitOps.clone(` / `gitOps.resolveRemoteRef(`
    call under `extensions/pi-claude-marketplace`, counts the `url:` fields inside those
    windows, and requires that every one of them names `ensureGitSuffix` or `networkUrl`
    (and that there are at least the five known sites). A failure here means either a
    site was missed or a new one appeared — fix the site, do not relax the gate.

    If `format:check` fails, run `npm run format` and re-run. If `lint` flags the new
    code, fix it in place; the likely candidates are
    `@typescript-eslint/explicit-module-boundary-types` on the new export and
    `@stylistic/padding-line-between-statements` after the while block.

    If a suite outside the eight files this plan touches fails, first check whether its
    assertion legitimately encodes the old suffix-less network url (the same class as the
    five already enumerated) — if so, update it to the suffixed form with an exact-equality
    assertion. If instead it fails on a cache key, a clone-directory path, a
    `sourceLogical` value or a `samePlannedSource` result, STOP and report: that means the
    suffix leaked into the identity half, which this plan explicitly forbids. Never fix a
    failure by weakening an assertion to a substring or `endsWith` check.
  </action>
  <verify>
    <automated>cd /Users/acolomba/src/pi-claude-marketplace &amp;&amp; W=$(grep -rn --include='*.ts' -A5 -E 'gitOps\.(clone|resolveRemoteRef)\(' extensions/pi-claude-marketplace) &amp;&amp; T=$(printf '%s\n' "$W" | grep -cE '^[^ ]+[-:][0-9]+[-:][[:space:]]*url:') &amp;&amp; M=$(printf '%s\n' "$W" | grep -E '^[^ ]+[-:][0-9]+[-:][[:space:]]*url:' | grep -cE 'ensureGitSuffix|networkUrl') &amp;&amp; [ "$T" -eq "$M" ] &amp;&amp; [ "$T" -ge 5 ] &amp;&amp; npm run check</automated>
  </verify>
  <done>The exhaustiveness gate passes (every network `url:` field routes through the helper, at least five sites) and `npm run check` exits 0 — typecheck, lint, format:check, unit, integration and e2e all green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local process -> remote git host | The constructed url decides which remote endpoint the clone/ref request reaches |
| url string -> host-keyed auth bundle | `hostFromCloneUrl` derives the host that selects the OAuth provider and the credential key |
| url string -> filesystem key | `pluginCloneKey` / `pluginMirrorKey` hash the url into a `plugin-clones/` directory name |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-hdc-01 | Tampering | `ensureGitSuffix` | medium | mitigate | The helper only trims trailing slashes and appends a fixed suffix — it never parses, rewrites or reassembles scheme, host or path, so it cannot redirect a clone to another origin. Task 1 pins the exact output string for four inputs with equality assertions. |
| T-hdc-02 | Tampering | redirected `POST git-upload-pack` | medium | mitigate | This is the bug being fixed: the suffix-less endpoint 301-redirects and the transport replays the request as a bodyless `GET`, so the pack negotiation is silently altered in transit. Ensuring the suffix avoids the redirect entirely. |
| T-hdc-03 | Spoofing | host-keyed auth bundle | low | accept | `hostFromCloneUrl` runs on the unsuffixed url and the suffix touches only the path, so the derived host — and therefore the provider and credential key — is identical. The existing add.test.ts auth-bundle assertions (`cloneCall.auth.host`) re-run unchanged in Task 1. |
| T-hdc-04 | Denial of service | `plugin-clones/` cache keys | high | mitigate | Applying the suffix inside `canonicalCloneUrl` would rehash every clone directory, cold-missing every warm cache and re-cloning every installed plugin over the network. Mitigated structurally: the suffix is applied only at the `url:` field, and Task 2 asserts the landed directory equals `pluginCloneDir(pluginCloneKey(unsuffixedUrl, pin))`. |
| T-hdc-05 | Tampering | D-SEED same-repo comparison | medium | accept | A seeded mirror's `.git/config` origin now carries the suffix, but `deriveMarketplaceUrl` reparses it through `parsePluginSource`, which re-strips it — the comparison at `clone-cache.ts:449` stays consistent so long as parse-time stripping is untouched, which the locked fix shape guarantees. `tests/orchestrators/plugin/clone-cache-seed.test.ts` and `add-seed-mirrors.test.ts` re-run in Tasks 1 and 2. |

No package-manager installs are introduced by this plan, so no `T-hdc-SC`
supply-chain checkpoint applies.
</threat_model>

<verification>
- `node --test tests/domain/source.test.ts` — helper semantics plus proof that parse-time stripping is unchanged.
- `node --test tests/orchestrators/marketplace/add.test.ts` — the reported failure path, offline through mock gitOps, with the github-kind rows as the unchanged-behavior guard.
- `node --test tests/orchestrators/plugin/clone-cache.test.ts tests/domain/clone-key.test.ts` — the key-versus-wire split for url, git-subdir and github sources.
- `node --test tests/orchestrators/plugin/clone-cache-seed.test.ts tests/orchestrators/marketplace/add-seed-mirrors.test.ts` — the D-SEED same-repo comparison survives suffixed origins.
- The Task 3 exhaustiveness gate — every `url:` field reaching `gitOps.clone` / `gitOps.resolveRemoteRef` routes through the helper.
- `npm run check` — full quality bar (NFR-6).
</verification>

<success_criteria>
- Every `gitOps.clone` / `gitOps.resolveRemoteRef` call in the extension sends a `.git`-suffixed url, for every source kind and every host.
- No url gains a doubled suffix; the git-subdir already-suffixed case is asserted.
- `pluginCloneKey`, `pluginMirrorKey`, `canonicalCloneUrl` and `resolvePluginPin`'s returned `cloneUrl` are byte-identical to before, so no warm clone directory is invalidated.
- `parseUrlSource`, `stripUrlDecorations`, `sourceLogical` and `samePlannedSource` have zero behavior change — verified by an untouched `tests/domain/source.test.ts` corpus plus one added stripping assertion.
- Exactly eight files changed: five source, three test. No refactors, no drive-by cleanup, no new dependency.
- `npm run check` exits 0.
</success_criteria>

<output>
Create `.planning/quick/260814-hdc-fix-a-real-bug-in-the-gitlab-and-any-non/260814-hdc-SUMMARY.md` when done.
</output>
