# Phase 2: GitHub Clone-Base Override - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning

<domain>
## Phase Boundary

With `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set, every network touch of a GitHub source (`owner/repo`, `https://github.com/o/r[.git][#ref]`) goes to the configured base through one seam in `shared/`: the clone URL, every later fetch (marketplace update, plugin clone refresh and probes), and the auth host. Unset, behavior is byte-identical to today (D-MF-01). Requirements: GHB-01..GHB-05.

This is a production change under `extensions/pi-claude-marketplace/` plus a lint gate, unit tests, README (and its localized copies), and CHANGELOG. Nothing under `features/` changes in this phase; Phase 10 drives GitHub scenarios through the override.

**Upstream parity (claude-code-compat-research evidence record):**
- Question: does Claude Code let a user override the GitHub clone base? No upstream position — Claude Code builds the literal `https://github.com/${repo}.git` and reads no base-URL variable (grep of the 2.1.296 binary, milestone research 2026-10-15, `.planning/research/SUMMARY.md` Sources). Confidence: high.
- Divergence: licensed by the recorded project decision D-MF-01 (PROJECT.md Key Decisions); it changes nothing for a user who never sets the variable, and README/CHANGELOG record it as a divergence (GHB-05).

</domain>

<decisions>
## Implementation Decisions

### Clone identity
- **D-01:** Fetch-time rewrite, git `url.<base>.insteadOf` model. The clone identity stays `https://github.com/<owner>/<repo>`: `canonicalCloneUrl`, plugin-clone cache keys (`pluginCloneKey`, `pluginMirrorKey`), state records, and the recorded `origin` of every clone the extension creates all stay in github.com terms. Only the URL actually sent on each clone or fetch, and the auth host, are computed from the variable at the moment of the network call. — **Reversibility:** costly — switching later to an identity that follows the base would rehash every `plugin-clones/` directory and change recorded origins.
- **D-02:** Because refreshes today fetch `remote: "origin"` (`orchestrators/marketplace/shared.ts::refreshGitHubClone`), every GitHub fetch path must send the computed URL explicitly (or otherwise guarantee the wire URL comes from the seam), never the recorded origin's host. A clone created while the override is set records the canonical github.com origin, so `originMatchesSource` keeps recognizing leftovers whether the variable is set or not.

### Override changed after add
- **D-03:** The variable is read per network call, so a value changed after `add` takes effect on the next fetch — no re-add, no re-point step, no new notice kind. A failure (404, 401, 5xx, unreachable) names the URL actually fetched in its cause line, which is how a wrong base becomes visible. Results, `list`, `info`, and `claude-plugins.json` stay in github.com terms (GHB-04).

### Who the variable is for
- **D-04:** README (and every localized copy, per the readme skill) presents it as an advanced setting that points GitHub sources at another https git host — a mirror, an air-gapped server, or a local test server — and states its limits plainly: Device Flow never runs for the override host, credentials come only from `git credential`, and output stays in github.com terms. It is marked as a divergence from Claude Code. CHANGELOG gets one bullet per the changelog skill.
- **D-05:** The base may carry a path prefix: `https://host/git` clones `https://host/git/<owner>/<repo>.git`; a trailing slash is normalized. Validation (GHB-03) still refuses a non-`https:` scheme, userinfo, a query, or a fragment, with a typed error naming the variable.

### Literal gate
- **D-06:** The GHB-02 source-walk gate is an ESLint rule over `extensions/pi-claude-marketplace/**`: any string or template literal containing `github.com` fails `npm run lint`, except inside the seam module and at legitimate sites that carry `eslint-disable-next-line <rule> -- <reason>` (the parser's host comparisons, user-facing reason text, the github.com display string, the Device Flow endpoints in `domain/auth-registry.ts`). Comments are ignored. A new literal fails even inside an exempt file. Per CONVENTIONS.md, no committed negative control; plant once by hand.

### Settled after research (orchestrator, within D-01..D-06; 2026-10-15)
- **D-07:** The rewrite lives where the bytes leave: the four GitHub network calls in `platform/git.ts` (`clone`, `fetch`, `resolveRemoteRef`, `listRemoteTags`) rewrite an exact `https://github.com/` prefix to `<base>/` via the `shared/` seam, and `clone` sets `remote.origin.url` back to the canonical URL. This supersedes the `<code_context>` note that suggested making `networkCloneUrl` follow the seam: that placement would record the override URL as origin and break D-01 (see 02-RESEARCH.md).
- **D-08:** An invalid set value fails the whole command with the typed error naming the variable (GHB-03), rethrown past per-target catches as `add` already does; no new reason token. The message must avoid a bare `/` path shape, which the json/rpc cause redaction would swallow (02-RESEARCH.md pitfall).
- **D-09:** Insteadof semantics apply to every `https://github.com/` URL the extension sends, git-subdir sources included; the auth host follows the same rewrite. An empty value counts as unset; the prefix match is exact (no case folding), like git.
- **D-10:** D-03's "names the URL actually fetched" is realized as a `fetched <wire url>` cause tail added only when the URL was rewritten, so unset output stays byte-identical (GHB-04).

### Claude's Discretion
- The seam module's name and API (research suggests `shared/github-base-url.ts`; it must not live under `platform/git*`, which ESLint BLOCK F matches), and whether the auth-host function replaces the `GITHUB_HOST` constant outright so the compiler lists every site.
- Exactly how each fetch path receives the explicit URL (isomorphic-git `url` option, or a seam helper), and which unit tests gain override cases (each affected owner test gets one, per success criterion 1).
- Which commands read the variable: only paths that reach the network for a GitHub source; `list`, `info`, `uninstall`, and path-source operations never read or validate it (NFR-5).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and decisions
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, research flag
- `.planning/REQUIREMENTS.md` — GHB-01..GHB-05
- `.planning/PROJECT.md` — D-MF-01 in Key Decisions; Constraints (NFR-1..NFR-11, upstream parity rule)

### Research
- `.planning/research/SUMMARY.md` — decisions taken after research (variable name, full seam), open questions
- `.planning/research/ARCHITECTURE.md` — Pattern 4 (one production seam), Anti-Patterns 2 and 5, the `NETWORK_SEAMS` note
- `.planning/research/PITFALLS.md` — partial override wiring, credential-helper leakage

### Code sites
- `extensions/pi-claude-marketplace/domain/clone-key.ts` — `canonicalCloneUrl` (identity, stays github.com), `networkCloneUrl` (wire URL, follows the seam), `originMatchesSource`
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` — `GITHUB_HOST`, `hostFromCloneUrl`, `buildAuthForHost`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:386-420` — the inline host literal and the github refresh
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts::refreshGitHubClone` — fetches `remote: "origin"`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:145-191` — `makeSyncCloneOnce` (auth host from `GITHUB_HOST`)
- `extensions/pi-claude-marketplace/domain/source.ts` — github.com parsing and display (stays github.com)
- `extensions/pi-claude-marketplace/domain/auth-registry.ts` — Device Flow endpoints (stay github.com)
- `eslint.config.js` — BLOCK F precedent for line-level rules with justified disables

### Skills
- `.agents/skills/readme/SKILL.md`, `.agents/skills/changelog/SKILL.md`, `.agents/skills/typescript-unit-tests/SKILL.md`, `.agents/skills/typescript-style/SKILL.md`, `.agents/skills/claude-code-compat-research/SKILL.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `networkCloneUrl` is the single wire-URL derivation with 18 callers; it keeps producing the canonical github.com URL (D-07 moves the rewrite into `platform/git.ts`).
- `buildAuthForHost` already falls back to stored-credential auth when no provider matches the host, so an override host gets `git credential` auth and no Device Flow by construction.
- `platform/workflow-home.ts` is the precedent for an env-var reader with per-test restore (`t.after()`), per research.

### Established Patterns
- Typed errors in `shared/errors.ts`, `extends Error`, `this.name`, structured fields (CONVENTIONS.md).
- 100% direct coverage for every source-test pair; a new `shared/` module gets a paired `tests/shared/*.test.ts`.
- NFR-5: read-only and path-source operations must not touch the network or, by D-03, read the variable.

### Integration Points
- Every GitHub fetch path that currently relies on the clone's recorded origin (marketplace update, plugin clone refresh, tag probes).
- `eslint.config.js` for the D-06 rule; README.md and README.*.md; CHANGELOG.md.

</code_context>

<specifics>
## Specific Ideas

- The mental model to document and test: "like `git config url.<base>.insteadOf https://github.com/` — nothing recorded changes; only where the bytes come from."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
- `2026-10-13-cucumber-rules-trial` (§3, upstream port of the cucumber skill and gates to blueprint-typescript): keyword match only; unrelated to the override.

</deferred>

---

*Phase: 02-github-clone-base-override*
*Context gathered: 2026-10-15*
