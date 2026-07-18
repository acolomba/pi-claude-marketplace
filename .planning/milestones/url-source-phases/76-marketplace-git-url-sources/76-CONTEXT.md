# Phase 76: Marketplace git-URL sources - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

`marketplace add/update/remove/list/info` accept arbitrary public HTTPS git URLs
(`url` kind) by cloning `source.url` directly — no github.com URL reconstruction.
Config declarations (`claude-plugins.json`, MURL-06) and `import`
(`extraKnownMarketplaces`, MURL-07) map URL sources too. Public repos only:
provider auth is Phase 79; plugin-side URL sources (including `git-subdir`
plugin sources) are Phases 77/78.

**Requirements change decided in this discussion:** MURL-02 (git-subdir
*marketplace* sources) is DROPPED. Upstream Claude Code has no
subdirectory-marketplace concept anywhere — `/plugin marketplace add` has no
subdir syntax, `extraKnownMarketplaces` has no subdir shape, and
`.claude-plugin/marketplace.json` must sit at the repo root. `git-subdir`
remains a plugin-source concept only (Phase 77). ROADMAP success criterion 2
and the MURL-02 rows in REQUIREMENTS.md are removed accordingly.

</domain>

<decisions>
## Implementation Decisions

### Source acceptance & parsing (domain/source.ts)
- **D-76-01:** `url` marketplace sources accept **https:// only**, any host.
  `http://`, `ssh://`, and `git@host:` scp-form all reject with clean
  per-scheme reasons (SP-3 message updates; ssh already has one).
- **D-76-02:** github.com URLs **always normalize to `github` kind**,
  regardless of entry form — CLI string, config declaration, or object-form
  `{"source": "url", "url": "https://github.com/..."}`. One canonical identity
  per repo; Device Flow auth keeps working for private github repos declared
  as url-kind; object-form url entries funnel through the existing parser.
- **D-76-03:** URL sources support `#ref` pinning at add time
  (`marketplace add https://host/repo.git#main`), parsed into `UrlSource.ref`
  and cloned singleBranch — exact parity with github-source `#ref` handling
  and upstream's documented syntax. `update` re-fetches the pinned ref.
- **D-76-04:** **Upstream-parity fold-in:** `owner/repo@ref` GitHub shorthand
  (documented upstream as `acme/tools@v2.0`) now parses to `github` kind with
  `ref` set. The SP-2 reject-with-hint is retired.
- **D-76-05:** MURL-02 dropped — no marketplace-level `git-subdir` in any
  surface (CLI, config, import). `marketplace add` of a git-subdir object
  source keeps rejecting as `{unsupported source}`.

### Clone plumbing (add.ts / update.ts / platform/git.ts)
- **D-76-06:** url-kind sources clone `source.url` **verbatim** (direct
  clone); github-kind keeps the reconstructed
  `https://github.com/<owner>/<repo>.git`. `platform/git.ts` clone() doc
  contract widens beyond the github-only SP-3 wording.
- **D-76-07:** Phase 76 clones URL sources with **no auth bundle at all** —
  public repos only. No CredentialOps keychain fill for non-GitHub hosts, no
  provider flow. All non-GitHub auth wiring lands in Phase 79 in one place.
  GitHub-kind sources keep the existing hardcoded `host = "github.com"`
  Device Flow (the AUTH-D02 seams stay marked for Phase 79).

### Failure UX (closed-set catalog amendment)
- **D-76-08:** New REASONS member **`authentication required`** — a
  deliberate closed-set amendment (REASONS tuple in `shared/notify.ts`,
  tripwire count bump in `tests/architecture/notify-closed-set-locks.test.ts`,
  catalog + style-guide rows). Rendered when a clone hits an HTTP auth
  challenge (401/403 HttpError from isomorphic-git — not an errno, so it
  falls through `classifyAddError` unclassified today). Error severity;
  cause chain carries the HTTP detail at 4-space indent. Phase 79's PROV-04
  fail-clean case reuses this same token.

### Display (list/info surfaces)
- **D-76-09:** `marketplace info` renders a kind-labeled
  **`url: <url>[#<ref>]`** attribute line for url sources, matching the
  `github:`/`path:` label==kind convention. `#ref` suffix only when
  originally specified.
- **D-76-10:** The `last_updated:` gate in `marketplace info` widens from
  `sourceKind === "github"` to **all git-backed kinds** (github + url); path
  sources still never render it (INFO-01 amendment).
- **D-76-11:** `marketplace list` needs no change — list-surface headers
  carry no source line. Pre-name failure subjects render the verbatim
  user-typed URL, as add failures do today.

### Config & import (MURL-06 / MURL-07)
- **D-76-12:** With MURL-02 dropped, `MARKETPLACE_CONFIG_ENTRY_SCHEMA.source`
  stays `Type.String()` — a URL source is just a string
  (`"https://host/repo.git#ref"` with optional fragment). No object-form
  schema widening for marketplaces.
- **D-76-13:** `import` maps `extraKnownMarketplaces` entries with the
  upstream **url shape** (`{"source": {"source": "url", "url": ...,
  "ref"?, "sha"?}}`). The `file` shape (remote marketplace.json URL) stays
  out of scope and keeps its unmappable-marketplace diagnostic.

### Claude's Discretion
- `.git`-suffix identity: whether `https://host/repo.git` and
  `https://host/repo` compare equal in `samePlannedSource`/dedupe — pick the
  simplest truthful rule and document it.
- No pre-clone URL validation beyond scheme/shape parsing — the clone failure
  is the signal (fail-clean, NFR-3).
- Exact HttpError-statusCode detection mechanics in `classifyAddError` (which
  isomorphic-git error shape/codes map to `authentication required`).
- Whether `samePlannedSource`'s currently-`c8 ignore`d url arm needs ref-aware
  comparison parity with the github arm (it should — mirror the github rule).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & phase definition
- `.planning/workstreams/url-source/ROADMAP.md` — Phase 76 goal + success criteria (criterion 2 removed per D-76-05)
- `.planning/workstreams/url-source/REQUIREMENTS.md` — MURL-01..07 (MURL-02 removed), NFR amendments, out-of-scope table
- `.planning/PROJECT.md` §"Current Milestone: url-source" — milestone framing, AUTH-D02 seam notes

### Upstream contract (researched 2026-07-11 from official docs)
- https://code.claude.com/docs/en/plugin-marketplaces.md — `/plugin marketplace add` accepts: `owner/repo` (+`@ref`), git URLs on any host (+`#ref`), remote marketplace.json URLs (out of scope for us), local paths. NO subdirectory-marketplace syntax exists. `extraKnownMarketplaces` source shapes: `github` (repo, ref?, sha?), `url` (url, ref?, sha?), `directory` (path), `file` (url).
- https://code.claude.com/docs/en/plugins-reference.md — plugin-source shapes incl. `git-subdir` (plugin-side, Phase 77); `sha` wins when both `ref` and `sha` set.

### Code seams (the phase's blast radius)
- `extensions/pi-claude-marketplace/domain/source.ts` — string parser (SP-2/SP-3 widening, D-76-01..05), `sourceLogical`, `samePlannedSource` url arm
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — S5b kind gate, `addGithubInGuard` clone-URL reconstruction, `classifyAddError` ladder (D-76-08)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` — mirrored kind gate + AUTH-D02 seam
- `extensions/pi-claude-marketplace/platform/git.ts` — clone() URL contract doc, auth bundle optionality (D-76-06/07)
- `extensions/pi-claude-marketplace/persistence/config-io.ts` — `MARKETPLACE_CONFIG_ENTRY_SCHEMA` stays string-source (D-76-12)
- `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts` — `marketplaceSourceFromExtra` widening for the upstream url shape (D-76-13); NOTE: current code reads `entry.directory` / `entry.github.repo`, which does not match the documented upstream nested `{source: {...}}` shape — researcher must verify which shapes exist in the wild and whether both must be read
- `extensions/pi-claude-marketplace/shared/notify.ts` — REASONS tuple amendment (D-76-08)
- `docs/output-catalog.md` — `marketplace add`/`info` byte forms to extend (url info lines, auth-required failure state)
- `docs/messaging-style-guide.md` — closed-set REASONS contract
- `tests/architecture/notify-closed-set-locks.test.ts` — REASONS count tripwire

### Authority spec
- `docs/prd/pi-claude-marketplace-prd.md` §5.1.1 (marketplace add), §MM-3 (source classification) — amended by this milestone's decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UrlSource` / `GitSubdirSource` variants already exist in `domain/source.ts`
  with `ref`/`sha` fields; object-form parsing already works — only the
  string-parser arm and consumers gate on kind.
- `sourceLogical` already renders url form (`<url>[#ref]`) — currently
  `c8 ignore`d/unreachable; becomes live.
- The clone-per-marketplace lifecycle (`sources/<mp>/`, staging + atomic
  rename, stale-clone refusal, manifest validation) is source-kind-agnostic
  after the clone URL is chosen — reuse unchanged, no new cache.
- `isomorphic-git` clone already takes an arbitrary URL; only the SP-3 doc
  contract and call-site gates restrict it to github.com.

### Established Patterns
- Closed-set REASONS/STATUS catalog with byte-equality UAT
  (`tests/architecture/catalog-uat.test.ts`) — every new render form needs
  catalog rows + UAT coverage in lockstep.
- Truthful attribution (v1.10 ATTR discipline) — reason tokens must name the
  real condition; that's why 401 gets a new token instead of reusing
  `network unreachable`.
- Notification severity tri-state: error = operation not carried out (the
  auth-required add failure is error severity).
- No-credential-leak architecture gate scans auth files by name — Phase 76
  adds no new auth files (public-only), so no gate expansion until Phase 79.

### Integration Points
- `add.ts` S5b gate (`kind !== "github" && kind !== "path"`) widens to admit
  `url`; the S5a unknown-kind reject and npm/git-subdir rejects stay.
- `update.ts` source-kind branch gains a url arm cloning `source.url`
  directly with the same atomic-swap semantics.
- `remove.ts` / state records are kind-agnostic (delete clone + state) —
  verify, expect no change.
- Load-time config reconcile (v1.12 `orchestrators/reconcile/`) consumes
  parsed sources downstream of the same parser — the parser widening should
  flow through; verify the reconcile planner's source-match path
  (`samePlannedSource` url arm).

</code_context>

<specifics>
## Specific Ideas

- Upstream syntax table is the alignment anchor for the add surface:
  `owner/repo[@ref]`, `https://host/repo.git[#ref]`, local paths. After this
  phase the only upstream add forms we reject are remote-marketplace.json
  URLs (out of scope) — everything else parses.
- Failure preview the user approved for auth-required:
  row `(failed) {authentication required}` + 4-space-indent HttpError cause
  chain + `1 marketplace operation(s) failed.` summary line.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope. (The one candidate,
  `owner/repo@ref` shorthand parity, was folded INTO this phase per D-76-04
  rather than deferred.)

</deferred>

---

*Phase: 76-marketplace-git-url-sources*
*Context gathered: 2026-07-11*
