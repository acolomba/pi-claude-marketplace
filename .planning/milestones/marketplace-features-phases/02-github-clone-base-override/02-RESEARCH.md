# Phase 2: GitHub Clone-Base Override - Research

**Researched:** 2026-10-15
**Domain:** Production seam in a Pi extension (TypeScript strict, isomorphic-git 1.42.3), an ESLint gate, unit tests, docs
**Confidence:** HIGH for the code inventory and the isomorphic-git mechanism (read in source and checked with a live probe). MEDIUM for the recommended placement of the rewrite, which is a design choice inside the discretion area.

## Summary

Every GitHub network call goes through four functions in `platform/git.ts`: `clone`, `fetch`, `resolveRemoteRef`, and `listRemoteTags`. Every GitHub auth bundle gets its host from `GITHUB_HOST` / `hostFromCloneUrl` in `orchestrators/auth-host.ts`, or from the inline literal in `marketplace/update.ts:398-401`. A refresh does not send a computed URL. It fetches `remote: "origin"` and lets isomorphic-git read `remote.origin.url` from `.git/config`. isomorphic-git's `clone` records whatever URL it was given as `remote.origin.url`. Its `fetch` accepts an explicit `url`, which wins over the recorded remote and leaves `.git/config` untouched. A probe against a local `git http-backend` confirmed both behaviors (see Code Examples).

**Primary recommendation:** Put the env reader, the validation, and an `insteadOf`-style prefix rewrite (`https://github.com/` → `<base>/`) in a new `shared/github-base-url.ts`. Apply the rewrite inside the four `platform/git.ts` network functions. Do not apply it in `networkCloneUrl`.
- `clone` fetches from the rewritten URL, then sets `remote.origin.url` back to the URL it was given, which is the canonical `https://github.com/o/r.git`.
- `fetch` reads the recorded origin, rewrites it, and passes `url` only when the rewrite changed it.

Bind the auth host for GitHub sources to the override host through one auth helper. Under an active override, that helper returns a `stored-credential` bundle, so no Device Flow can run. `canonicalCloneUrl`, `networkCloneUrl`, `originMatchesSource`, the cache keys, state, and every recorded origin stay unchanged, as D-01 requires. When the variable is unset, the rewrite is the identity, and no `url` option or `setConfig` call is added. The unset path is therefore byte-identical by construction (GHB-04).

**Why not in `networkCloneUrl`:**
- A clone made from a rewritten `networkCloneUrl` would record the override URL as `origin`, which breaks D-01. Fixing that needs a third URL ("what to record") threaded through `materializePluginClone` and its 8 callers.
- The 4 fetch sites would each need an explicit URL: `update.ts`, `update-flow.ts`, `clone-cache.ts:153`, and `clone-cache.ts:315`.
- `networkCloneUrl` is also computed on warm-cache paths that touch no network, so the variable would be read and validated there too.

The platform placement covers all of these in 4 functions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read and validate `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, normalize the base, rewrite a `https://github.com/` URL, report the override host | `shared/` (new `github-base-url.ts`) | — | `shared` is the leaf that `platform`, `domain`, and `orchestrators` may all import (`.fallowrc.json`). It must not be `platform/git*`, because the BLOCK F regex is the bare substring `platform/git`. |
| Wire URL actually sent (clone, fetch, ls-refs) | `platform/git.ts` | `shared/github-base-url.ts` | The one isomorphic-git chokepoint. It is the only place that sees every network call and the clone's recorded origin. |
| Canonical identity: cache keys, recorded origin, leftover match | `domain/clone-key.ts` (unchanged) | — | D-01 keeps the identity in github.com terms. |
| Auth host binding and the Device Flow gate | `orchestrators/auth-host.ts` | `shared/github-base-url.ts` | It already owns host-keyed bundles (D-79-05). |
| Typed invalid-value error | `shared/errors.ts` | — | Convention: typed errors live in `shared/errors.ts`. |
| Literal gate (GHB-02) | `eslint.config.js` | — | D-06. |
| Display: `list`, `info`, `claude-plugins.json` | `domain/source.ts` (unchanged) | — | GHB-04: always github.com. |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Fetch-time rewrite, git `url.<base>.insteadOf` model. The clone identity stays `https://github.com/<owner>/<repo>`: `canonicalCloneUrl`, plugin-clone cache keys (`pluginCloneKey`, `pluginMirrorKey`), state records, and the recorded `origin` of every clone the extension creates all stay in github.com terms. Only the URL actually sent on each clone or fetch, and the auth host, are computed from the variable at the moment of the network call. — **Reversibility:** costly — switching later to an identity that follows the base would rehash every `plugin-clones/` directory and change recorded origins.
- **D-02:** Because refreshes today fetch `remote: "origin"` (`orchestrators/marketplace/shared.ts::refreshGitHubClone`), every GitHub fetch path must send the computed URL explicitly (or otherwise guarantee the wire URL comes from the seam), never the recorded origin's host. A clone created while the override is set records the canonical github.com origin, so `originMatchesSource` keeps recognizing leftovers whether the variable is set or not.
- **D-03:** The variable is read per network call, so a value changed after `add` takes effect on the next fetch — no re-add, no re-point step, no new notice kind. A failure (404, 401, 5xx, unreachable) names the URL actually fetched in its cause line, which is how a wrong base becomes visible. Results, `list`, `info`, and `claude-plugins.json` stay in github.com terms (GHB-04).
- **D-04:** README (and every localized copy, per the readme skill) presents it as an advanced setting that points GitHub sources at another https git host — a mirror, an air-gapped server, or a local test server — and states its limits plainly: Device Flow never runs for the override host, credentials come only from `git credential`, and output stays in github.com terms. It is marked as a divergence from Claude Code. CHANGELOG gets one bullet per the changelog skill.
- **D-05:** The base may carry a path prefix: `https://host/git` clones `https://host/git/<owner>/<repo>.git`; a trailing slash is normalized. Validation (GHB-03) still refuses a non-`https:` scheme, userinfo, a query, or a fragment, with a typed error naming the variable.
- **D-06:** The GHB-02 source-walk gate is an ESLint rule over `extensions/pi-claude-marketplace/**`: any string or template literal containing `github.com` fails `npm run lint`, except inside the seam module and at legitimate sites that carry `eslint-disable-next-line <rule> -- <reason>` (the parser's host comparisons, user-facing reason text, the github.com display string, the Device Flow endpoints in `domain/auth-registry.ts`). Comments are ignored. A new literal fails even inside an exempt file. Per CONVENTIONS.md, no committed negative control; plant once by hand.

### Claude's Discretion
- The seam module's name and API (research suggests `shared/github-base-url.ts`; it must not live under `platform/git*`, which ESLint BLOCK F matches), and whether the auth-host function replaces the `GITHUB_HOST` constant outright so the compiler lists every site.
- Exactly how each fetch path receives the explicit URL (isomorphic-git `url` option, or a seam helper), and which unit tests gain override cases (each affected owner test gets one, per success criterion 1).
- Which commands read the variable: only paths that reach the network for a GitHub source; `list`, `info`, `uninstall`, and path-source operations never read or validate it (NFR-5).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

Reviewed Todos (not folded): `2026-10-13-cucumber-rules-trial` (§3, upstream port of the cucumber skill and gates to blueprint-typescript): keyword match only; unrelated to the override.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim, `.planning/REQUIREMENTS.md:34-38`) | Research Support |
|----|-------------|------------------|
| GHB-01 | With `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set, GitHub sources (`owner/repo`, `https://github.com/o/r[.git][#ref]`) clone from `<base>/<owner>/<repo>.git` | Network inventory (Q1). Platform rewrite of `https://github.com/o/r.git` → `<base>/o/r.git` in `clone`/`fetch`/`listServerRefs` (Pattern 1). |
| GHB-02 | The override reaches every GitHub site through one seam: origin matching for leftover clones, marketplace update, and the auth host (bound to the override host, so Device Flow never runs against it); a source-walk gate fails on a new hard-coded `github.com` URL outside the seam | Canonical-origin proof (Pattern 2). Auth helper (Pattern 3). ESLint rule and inventory of the 10 literals (Pattern 4). |
| GHB-03 | A set but invalid override (not `https:`, carries userinfo, a query, or a fragment) fails with a typed error that names the variable | Validation table and WHATWG URL probe (Pattern 5). Redaction pitfall (Pitfall 4). Per-verb surfacing (Open Question 1). |
| GHB-04 | With the override unset, behavior is byte-identical to today, and `list`, `info`, and `claude-plugins.json` show GitHub sources in github.com terms either way | Identity rewrite when unset. No `url`/`setConfig` added when unset. Display code untouched. Lazy auth build in `update-flow` (Pitfall 2). |
| GHB-05 | The override is documented (README and CHANGELOG) as a divergence from Claude Code | `README.md` + `README.es.md` (readme skill), one CHANGELOG bullet (changelog skill). See "Documentation". |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- **Upstream parity:** a divergence needs a recorded decision. D-MF-01 licenses this one, and README/CHANGELOG must call it a divergence.
- **NFR-5:** `list`, `info`, `uninstall`, `marketplace remove`, and path-source operations must not touch the network. Under D-03 they must not read the variable either.
- **NFR-1:** all disk mutations are atomic. A post-clone `setConfig` happens inside a staging dir that is renamed into place after it, so the rename stays the atomic step.
- **NFR-2/NFR-3:** no throw may escape `resources_discover`/`session_start`. Operations must be safe to retry.
- **NFR-10 containment:** the variable changes no on-disk path. Keys come from `canonicalCloneUrl`, which is unchanged.
- **IL-2:** no `console`/stdout. All output goes through `notify`.
- **AUTH-09:** never interpolate a credential into an Error or notify. An override value with userinfo must never be echoed.
- **Quality bar:** `npm run check` must stay green: typecheck, ESLint `--max-warnings 0`, fallow (dead code, health `maxCognitive 15`/`maxCyclomatic 20`, dupes, boundaries, rule pack), Prettier, pairing, unit, integration, cucumber, and 100% direct coverage per pair.
- **Conventions:**
  - Typed errors `extends Error`, set `this.name`, carry readonly structured fields, and cite IDs in a doc comment.
  - Every exported function has an explicit return type.
  - Comments cite durable IDs (GHB-0x, D-MF-01, D-0x), never phase or plan numbers.
  - No comments on trivial code.
- **Git:** never commit to main. Commit per the committing skill. Do not commit in this research step (caller instruction).
- **Tests:** never touch the real `~/.pi/agent`. Tests that mutate `process.env` save the old value and register the restore with `t.after()` before acting.

## Standard Stack

No new dependency. Everything needed is already installed.

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| isomorphic-git | 1.42.3 (`node_modules/isomorphic-git/package.json`) [VERIFIED: node -p require(...).version] | `clone`, `fetch`, `listServerRefs`, `setConfig`, `getConfig` | `fetch({ url })`, `setConfig`, and `getConfig` all exist (Code Examples). |
| WHATWG `URL` (Node built-in) | Node 26.11.1 local, CI Node 24 | Parse and normalize the base | Behavior probed (Pattern 5). |
| ESLint flat config | `^10.4.0` (STACK.md) | D-06 rule | An inline local plugin rule is recommended (Pattern 4). |

## Package Legitimacy Audit

No external packages are installed by this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Q1 — Complete inventory of GitHub network touches

All lines below were read this session. Every network call ends in one of four `platform/git.ts` functions. `clone` is at `:362-390`, with `url: opts.url` at `:381`. `fetch` is at `:392-405`. `resolveRemoteRef` is at `:451-485`, with `url: opts.url` at `:458`. `listRemoteTags` is at `:533-570`, with `url: opts.url` at `:540`. [VERIFIED: platform/git.ts]

| # | Path (verb) | Call site | Primitive | URL sent today | Auth host today |
|---|-------------|-----------|-----------|----------------|-----------------|
| 1 | `marketplace add` github (also `import`, reconcile, `bootstrap`, which all call add) | `orchestrators/marketplace/add.ts:864-869` `gitOps.clone({ dir: stagingDir, url: networkCloneUrl(source), ... auth })` | clone | `networkCloneUrl` github arm = `ensureGitSuffix(canonicalCloneUrl(source))` → `https://github.com/o/r.git` (`domain/clone-key.ts:96-99`) | `const host = GITHUB_HOST;` `add.ts:974` → `buildAuthForHost` |
| 2 | `marketplace add` url | same clone, `add.ts:864` | clone | `stripSlashAndFragment(source.raw).base` (`clone-key.ts:100-101`) | `hostFromCloneUrl(source.url, "url")` `add.ts:1020` |
| 3 | `marketplace update` github (also the autoupdate cascade, which reuses `refreshOneMarketplace`) | `orchestrators/marketplace/update.ts:398-418` | `refreshGitHubClone` → `gitOps.fetch({ dir, remote: "origin", ... })` (`marketplace/shared.ts:252-264`, `remote: "origin"` at `:261`) | **the recorded origin** (isomorphic-git reads `remote.origin.url`) | `hostFromCloneUrl(\`https://github.com/${source.owner}/${source.repo}.git\`, "github")` at `update.ts:398-401`, which is the inline literal; it returns `GITHUB_HOST` |
| 4 | `marketplace update` url | `update.ts:423` → `refreshUrlClone` (`shared.ts:344-391`) → `refreshGitHubClone` `shared.ts:377` | fetch remote origin | recorded origin | `hostFromCloneUrl(source.url, "url")` `shared.ts:366` |
| 5 | `plugin update` marketplace sync (PUP-2) | `orchestrators/plugin/update-flow.ts:145-191`: github `:176`, url `:178` | fetch remote origin | recorded origin | `host: GITHUB_HOST` at `update-flow.ts:151`, **built eagerly at factory creation** (`:150-157`), even for path-only runs |
| 6 | Plugin pinned clone (install, reinstall, fetch, `info --fetch`, update preflight) | `orchestrators/plugin/clone-cache.ts:121-126` `cloneIntoStaging` via `materializePluginClone` `:200-237` | clone | caller-supplied `networkUrl` = `networkCloneUrl(source)` | `buildCloneAuth` → `hostFromCloneUrl` (`auth-host.ts:228-247`) |
| 7 | Pinned stale-ref refetch | `clone-cache.ts:153` `gitOps.fetch({ dir: stagingDir, remote: "origin", auth })` | fetch remote origin | recorded origin of the just-made staging clone | same bundle |
| 8 | Unpinned mirror cold clone | `clone-cache.ts:121` via `materializeOrRefreshPluginMirror` `:283-319` | clone | `networkUrl` | same |
| 9 | Unpinned mirror refresh (refresh-on-warm) | `clone-cache.ts:315` `refreshGitHubClone(mirrorRoot, ...)` | fetch remote origin | recorded origin (first writer's) | same |
| 10 | Pin resolution (unpinned HEAD / ref) | `clone-cache.ts:576-585` `resolvePluginPin` → `gitOps.resolveRemoteRef({ url: networkUrl })` | `listServerRefs` | `networkCloneUrl(source)` | caller's bundle; **none** from `info --fetch`'s `probePinned` (`info.ts` `fetchCtx.seam.resolvePluginPin({ source: gitSource })`) |
| 11 | Constrained dependency tag probe (D-03-03) | `orchestrators/plugin/dependency-tag-probe.ts:125` `seam.listRemoteTags({ url, auth })`, url from `:159` `networkCloneUrl(source)` | `listServerRefs` | `networkCloneUrl` | `buildCloneAuth(cloneUrl, source.kind, ...)` `:155` |
| 12 | Autoupdate update preflight | `orchestrators/plugin/update-preflight.ts:217-221` | clone/fetch via #6-#10 | as above | `buildStoredCredentialAuth(hostFromCloneUrl(cloneUrl, kind), ...)` (no notification context) |

These touch no network for GitHub, so leave them alone:
- `seedSameRepoPluginMirrors` (`clone-cache.ts`) copies the marketplace checkout, including `.git`, then runs a local checkout. The seeded mirror inherits the marketplace clone's recorded origin. That origin is canonical under this design, and later refreshes go through #9.
- `marketplace-tag-probe.ts` uses the local `listTags` and `resolveTagOid`.
- `readOriginRemoteUrl` (`clone-cache.ts:321-360`) reads a *path-source* checkout's origin.
- Bare `info`, `list`, `uninstall`, and `marketplace remove`.

**`networkCloneUrl` callers** [VERIFIED: rg this session]: `add.ts:866`, `clone-cache.ts:567`, `fetch.ts:402,414`, `dependency-tag-probe.ts:159`, `install-clone-probe.ts:65,84`, `update-preflight.ts:229,260`, `reinstall-clone-probe.ts:71`, `info.ts:2085,2098` (`info --fetch` only).

**`github.com` string/template literals in `extensions/`.** The AST walk used the prototype rule in Pattern 4 and found 10. [VERIFIED: prototype ESLint run this session]

| Site | Literal | Disposition |
|------|---------|-------------|
| `domain/auth-registry.ts:54` | `"github.com"` (`hostMatch: (host) => host === "github.com"`) | disable + reason (Device Flow provider) |
| `domain/auth-registry.ts:55` | `"https://github.com/login/device/code"` | disable + reason |
| `domain/auth-registry.ts:56` | `"https://github.com/login/oauth/access_token"` | disable + reason |
| `domain/clone-key.ts:83` | `` `https://github.com/${source.owner}/${source.repo}` `` | identity (D-01): import a canonical-origin constant from the seam, or disable + reason |
| `domain/source.ts:614` | `"github.com"` host fold comparison | disable + reason (parser host comparison) |
| `domain/source.ts:630` | `` `${raw} is a browser URL; use https://github.com/...` `` | disable + reason (user-facing reason text) |
| `domain/source.ts:644` | `` `${raw} must be https://github.com/<owner>/<repo>[.git][#<ref>]` `` | disable + reason |
| `domain/source.ts:762` | `` `https://github.com/${source.owner}/${source.repo}${refSuffix}` `` (`sourceLogical`) | disable + reason (display string, GHB-04) |
| `orchestrators/auth-host.ts:81` | `export const GITHUB_HOST = "github.com";` | **remove**. The seam owns the host, and the compiler lists every reader. |
| `orchestrators/marketplace/update.ts:399` | `` `https://github.com/${source.owner}/${source.repo}.git` `` | **remove** (use the GitHub auth helper) |

Comments mentioning github.com (for example `platform/git.ts:48` and `shared/redact-absolute-paths.ts:12`) are not AST literals and are ignored.

## Architecture Patterns

### System Architecture Diagram

```
user command (/claude:plugin marketplace add|update, install, reinstall, fetch, info --fetch, update, import, reload reconcile)
        |
        v
orchestrators (unchanged URL derivation)
  source --canonicalCloneUrl--> identity https://github.com/o/r  --> pluginCloneKey / pluginMirrorKey / state (D-01)
  source --networkCloneUrl----> https://github.com/o/r.git (canonical wire form, UNCHANGED)
  GitHub auth helper --reads seam--> override set?  yes: stored-credential bundle bound to <override host:port> (no Device Flow)
                                                    no : buildAuthForHost("github.com") (today, Device Flow allowed)
        |
        v  GitOps (DEFAULT_GIT_OPS -> platform/git.ts)
platform/git.ts  --gitHubWireUrl(url)--> shared/github-base-url.ts (reads + validates env per call; throws InvalidGitHubBaseUrlError)
  clone:  isomorphic clone(url = rewritten) --> if rewritten: setConfig remote.origin.url = canonical
  fetch:  getConfig remote.<remote>.url --rewrite--> fetch({ remote, url? })   (url only when rewritten)
  resolveRemoteRef / listRemoteTags: listServerRefs(url = rewritten)
        |
        v  HTTPS (onAuth host guard compares wire URL host with bundle host)
<base>/o/r.git   (or https://github.com/o/r.git when unset)

later: marketplace add leftover check --listRemotes--> origin https://github.com/o/r.git --originMatchesSource--> match (set or unset)
```

### Recommended file changes

```
extensions/pi-claude-marketplace/
├── shared/github-base-url.ts      # NEW: env reader, validation, normalization, prefix rewrite, override host
├── shared/errors.ts               # + InvalidGitHubBaseUrlError
├── platform/git.ts                # clone/fetch/resolveRemoteRef/listRemoteTags apply the rewrite
├── orchestrators/auth-host.ts     # GITHUB_HOST removed; hostFromCloneUrl github arm + GitHub auth helper
├── orchestrators/marketplace/add.ts      # addGithubInGuard uses the GitHub auth helper
├── orchestrators/marketplace/update.ts   # inline literal removed; GitHub auth helper
├── orchestrators/plugin/update-flow.ts   # GitHub auth helper, built lazily inside the github arm
├── domain/clone-key.ts            # optional: import the canonical-origin constant (literal gate)
├── domain/source.ts, domain/auth-registry.ts  # eslint-disable-next-line + reason only
eslint.config.js                   # D-06 rule
tests/shared/github-base-url.test.ts        # NEW pair
tests/shared/github-base-url-environment.ts # optional NEW support: set/clear the variable with t.after restore
README.md, README.es.md, CHANGELOG.md
```

### Pattern 1: insteadOf rewrite at the platform chokepoint (GHB-01, D-01, D-02)

**What:** `gitHubWireUrl(url)` returns `url` unchanged unless the variable is set (non-empty) and `url` starts with the exact prefix `https://github.com/`. In that case it returns `<normalized base>` + `url.slice("https://github.com".length)`. `https://github.com/o/r.git` with base `https://127.0.0.1:8443/git` becomes `https://127.0.0.1:8443/git/o/r.git` (D-05).

The seam reads the environment **only when the prefix matches**. A url-source operation with a broken variable is therefore unaffected (Claude's Discretion: only GitHub network paths read it).

**Where it runs:**
- `clone`: `const wire = gitHubWireUrl(opts.url)`. Clone with `url: wire`. If `wire !== opts.url`, call `git.setConfig({ fs, dir: opts.dir, path: "remote.origin.url", value: opts.url })`. A `setConfig` throw propagates, and the callers (`add.ts:870`, `clone-cache.ts:224`/`:302`) already clean the staging dir.
- `fetch`: `const remote = opts.remote ?? "origin"`. Read `git.getConfig({ fs, dir, path: \`remote.${remote}.url\` })`. If it is a string and `gitHubWireUrl(recorded) !== recorded`, spread `url: wire`. Otherwise pass nothing new (byte-identical).
- `resolveRemoteRef` / `listRemoteTags`: `url: gitHubWireUrl(opts.url)`. The two thrown messages in `resolveRemoteRef` (`remote ${opts.url} advertised no HEAD ref`, `remote ${opts.url} has no ref ...`) must name the wire URL (D-03). Unset, the wire URL equals `opts.url`, so the text is unchanged.

**Why this satisfies D-02:** every fetch path (#3-#5, #7, #9) goes through `platform/git.ts::fetch`. The host sent always comes from the seam, never from the recorded origin's host. The orchestrators need no fetch-site changes, and `refreshGitHubClone` keeps its signature.

### Pattern 2: canonical recorded origin, end to end (GHB-02 leftover matching)

Here is how "origin matching for leftover clones uses the configured base" holds:

1. Under the override, `clone` records `opts.url`. For a GitHub marketplace that is `networkCloneUrl(source)` = `https://github.com/o/r.git`, the same string an unset run records today.
2. `marketplace add`'s leftover guard reads it back with `listRemotes` (`platform/git.ts:735-761`, which returns the verbatim `remote.origin.url`). It then calls `originMatchesSource(remotes.url, source)` (`add.ts:811`).
3. `originMatchesSource` (`clone-key.ts:118-128`) parses that origin to the `github` kind and compares `canonicalCloneUrl` identities. The result is `https://github.com/o/r` on both sides, so it matches whether the variable is set or unset, or was changed between runs. It needs no change.

The alternative is to record the override URL and teach `originMatchesSource` about the base. That fails when the base changes between runs: a leftover from base A is "foreign" under base B, or under no override. That is why D-01 chose canonical origins.

A clone made outside this extension, with an origin under some other host, still reads as stale (MA-13). That is unchanged.

### Pattern 3: one GitHub auth helper (GHB-02 auth host, Device Flow)

**What isomorphic-git compares:** `discover` calls `onAuth(url)` with the URL it was given, minus userinfo (`node_modules/isomorphic-git/index.cjs:9431-9500`, `extractAuthFromUrl(_origUrl)` then `getAuth(url, ...)`) [VERIFIED: source read]. Under Pattern 1 that is the **rewritten wire URL**. `buildAuthCallbacks.onAuth` cancels unless `requested.protocol === "https:"` and `requested.host === opts.host` (`platform/git-auth-callbacks.ts:177-178`) [VERIFIED]. The bundle's host must therefore equal `new URL(<base>).host`, for example `127.0.0.1:8443`. `credentialOps.fill(host)` then emits `protocol=https` + `host=<override host:port>` (`platform/git-credential.ts:212`), so the helper is keyed to the host actually contacted.

**Device Flow:** `findProviderForHost` matches only `host === "github.com"` and `host === "gitlab.com"` (`domain/auth-registry.ts:54`, GitLab `hostMatch` below it). A loopback or mirror host gets `buildStoredCredentialAuth`, with no Device Flow, by construction (`auth-host.ts:180-183`).
- **Gap:** an override whose host *is* `github.com` or `gitlab.com` would still find a provider.
- **Recommendation:** while the override is set, the GitHub auth helper returns `buildStoredCredentialAuth(overrideHost, credentialOps)` unconditionally. That makes "Device Flow never runs for the override host" (D-04, GHB-02) true for every value.

**Recommended shape (illustrative, names are discretion):**
```typescript
// orchestrators/auth-host.ts
export function hostFromCloneUrl(cloneUrl: string, kind: "github" | "url" | "git-subdir"): string {
  if (kind === "github") {
    return gitHubHost();              // seam: override host, else "github.com"
  }
  return new URL(gitHubWireUrl(cloneUrl)).host;   // see Open Question 2 (git-subdir on github.com)
}

export function buildGitHubAuth(args: Omit<Parameters<typeof buildAuthForHost>[0], "host">): GitAuthBundle {
  const overrideHost = gitHubOverrideHost();   // seam: undefined when unset
  return overrideHost === undefined
    ? buildAuthForHost({ ...args, host: gitHubHost() })
    : buildStoredCredentialAuth(overrideHost, args.credentialOps);
}
```
Sites:
- `add.ts:974` (`addGithubInGuard`), `update.ts:398-408`, and `update-flow.ts:150-157` call `buildGitHubAuth`.
- `buildCloneAuth` routes `kind === "github"` to `buildGitHubAuth`.
- `update-preflight.ts:219` (the autoupdate branch) keeps `buildStoredCredentialAuth(hostFromCloneUrl(...))`, which now yields the override host.
- **Delete the `GITHUB_HOST` export** so `tsc` lists every remaining reader. Today those are `add.ts:95,974` and `update-flow.ts:79,151` [VERIFIED: rg].

### Pattern 4: D-06 literal gate as a local ESLint rule

**Recommendation: a local inline plugin rule, not `no-restricted-syntax`.** [VERIFIED: eslint.config.js:477-532 read this session]
1. **Flat config replaces options per rule; it does not merge them.** `no-restricted-syntax` is already set in two extension blocks: the APPEND_ENTRY block (`:477-482`, which *ignores* `shared/notification-dispatch.ts`) and BLOCK F (`:484-532`, which ignores `NETWORK_SEAMS`). BLOCK F's own comment says "this block replaces the earlier syntax rule options" (`:488-489`). A GitHub selector would have to be copied into both blocks. It would silently skip `notification-dispatch.ts` (APPEND ignore) and stay unchecked wherever a third block redefines the rule.
2. **A disable directive is per rule name.** `// eslint-disable-next-line no-restricted-syntax -- reason` on `clone-key.ts:83` or the `source.ts` lines, which are BLOCK F files, would also mute the NFR-5 identifier/string selectors and JOUT-01 on that line. A dedicated rule name (`<ns>/no-github-literal`) mutes only itself.

Prototype (run this session over `extensions/pi-claude-marketplace/**/*.ts` with the typescript-eslint parser; it found exactly the 10 sites above):
```javascript
// eslint.config.js (sketch)
const GITHUB_LITERAL = /github\.com/i;
const localPlugin = {
  rules: {
    "no-github-literal": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          found:
            "GHB-02: a github.com literal must come from shared/github-base-url.ts. Disable this line with a reason only at a parser comparison, reason text, the display string, or a Device Flow endpoint.",
        },
      },
      create(context) {
        return {
          Literal(node) {
            if (typeof node.value === "string" && GITHUB_LITERAL.test(node.value)) {
              context.report({ node, messageId: "found" });
            }
          },
          TemplateElement(node) {
            if (GITHUB_LITERAL.test(node.value.raw)) {
              context.report({ node, messageId: "found" });
            }
          },
        };
      },
    },
  },
};
// block A: files extensions/pi-claude-marketplace/**/*.ts, plugins: { "<ns>": localPlugin }, rules: { "<ns>/no-github-literal": "error" }
// block B: files ["extensions/pi-claude-marketplace/shared/github-base-url.ts"], rules: { "<ns>/no-github-literal": "off" }
```
Notes:
- Turn the rule off for the seam in a *later* block rather than using `ignores` in block A. With `ignores`, the plugin is not registered for the seam file, and any directive naming the rule there would error.
- `Literal` also covers string literal types (`TSLiteralType` wraps a `Literal`) and import specifiers. Comments are not AST nodes, so they are ignored (D-06).
- **Unused directives fail lint.** The probe showed ESLint reports "Unused eslint-disable directive", and `npm run lint` runs `--max-warnings 0`. Every disable must sit on a line that triggers the rule.
- The ESLint cache keys results to file content *and configuration*, so a config change re-lints everything (`.agents/skills/local-verification/rules/commands.md`) [CITED].
- **Negative control:** plant a literal by hand once, run `npx eslint <file>`, see the error, and revert. Do not commit a planted test (D-06, CONVENTIONS.md).

**Expected end state:** 7 justified disables (`auth-registry.ts` 54-56, `source.ts` 614/630/644/762). Add one more on `clone-key.ts:83` if it does not import a seam constant. The literals at `auth-host.ts:81` and `update.ts:399` are removed. `tests/` is out of scope for the rule.

### Pattern 5: reading and validating the variable (GHB-03, D-05)

Probed with Node 26.11.1 WHATWG `URL` this session [VERIFIED: node -e probe]:

| Input | `new URL()` result | Verdict |
|-------|-------------------|---------|
| unset or `""` | — | **unset** (recommended; matches `platform/workflow-home.ts`, where an empty value selects the default) [ASSUMED policy] |
| `https://127.0.0.1:8443`, `https://127.0.0.1:8443/` | origin `https://127.0.0.1:8443`, path `/` | base `https://127.0.0.1:8443` |
| `https://Host.Example:443/git/` | host `host.example` (default port dropped, lowercased), path `/git/` | base `https://host.example/git` |
| `https://h/git//` | path `/git//` | strip all trailing `/` → `https://h/git` |
| `http://h`, `ftp://h` | protocol not `https:` | **refuse** (scheme) |
| `https://user:tok@h` | username/password set | **refuse** (userinfo). Never echo the value (AUTH-09). |
| `https://h/x?a=1` | `search` = `?a=1` | **refuse** (query) |
| `https://h/?`, `https://h/#` | **`search` and `hash` are `""`**, but `href` keeps `?`/`#` | **refuse**: test `href.includes("?") \|\| href.includes("#")` after the userinfo check, not `search`/`hash` |
| `https://`, `https://h:0x`, `"   "` | throws `ERR_INVALID_URL` | **refuse** (not a URL) |
| `https://[::1]:9/` | host `[::1]:9` | accepted; host is `[::1]:9` |

**Normalization:** `base = u.origin + u.pathname.replace(/\/+$/, "")`. **Override host:** `u.host` (with port, as `onAuth` compares with `URL.host`). **No caching:** read on every call (D-03).

**Typed error** in `shared/errors.ts`: for example `InvalidGitHubBaseUrlError extends Error`, with `this.name` set and readonly `variable` and `problem` fields (`"scheme" | "userinfo" | "query" | "fragment" | "not-a-url"`). The message names `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` and the rule, but **not the value**, and contains **no `/` character** (Pitfall 4).

### Anti-Patterns to Avoid
- **Rewriting inside `networkCloneUrl`/`canonicalCloneUrl`:** this records the override origin (D-01 violation) or rehashes cache keys. It also makes warm-cache and `info --fetch` composition read the variable.
- **Teaching `originMatchesSource` about the base:** a leftover made under one base reads as foreign under another, or when the variable is unset.
- **Loosening the `onAuth` host guard** so GitHub 401s pass: this reopens the cross-host credential leak (GAUTH-06). Fix the bound host instead.
- **Naming the module `platform/github-*.ts`:** the BLOCK F `no-restricted-imports` regex `platform/git` (`eslint.config.js:501`) matches it and fails every network-free importer.
- **Echoing the variable's value** in an error, a row, or a debug log: it may carry userinfo.
- **Adding `no-restricted-syntax` selectors for the gate:** see Pattern 4.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parsing and normalization | regex host/port/path splitting | WHATWG `URL` (`origin`, `host`, `pathname`, `username`, `password`, `href`) | Default-port dropping, case folding, IPv6 brackets, dot segments (probed). |
| Fetching from a URL other than the recorded remote | init + addRemote + manual fetch/checkout | `git.fetch({ remote, url })` | isomorphic-git's `_fetch` takes `url` over `remote.<remote>.url` and still writes `refs/remotes/<remote>/*` (`index.cjs:10177-10210`, verified live). |
| Recording a canonical origin | reimplementing clone as init/addRemote/fetch/checkout | `git.clone({ url: wire })` then `git.setConfig({ path: "remote.origin.url", value: canonical })` | Verified live: the config shows only the canonical url afterwards. |
| Credential lookup for the override host | a custom credential path | the existing `buildStoredCredentialAuth` / `git credential fill` | Host-keyed already (GAUTH-03/04). |
| Literal gate | a `tests/architecture` source-walk | an ESLint rule (D-06) | It reports at the line and has a per-line justified disable. |

## Runtime State Inventory

This is not a rename phase. The checks below confirm that the design leaves runtime state untouched.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` stores parsed sources (`owner`/`repo`) and resolved shas, never a wire URL. `plugin-clones/<key>` keys hash `canonicalCloneUrl`, which is unchanged. | None. D-01 keeps both. |
| Live service config | None. The extension owns no external service config. | None |
| OS-registered state | None | None |
| Secrets/env vars | The new variable `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`. A credential for the override host is stored by the user under `host=<override host:port>`. | Document in README how to store it (`git credential approve` with that host). |
| Build artifacts | `.git/config` of every clone records `remote.origin.url`. Under this design it is always canonical. Existing clones are untouched. | None |

## Common Pitfalls

### Pitfall 1: The pinned-clone refetch and the mirror refresh fetch from the recorded origin
**What goes wrong:** with only the clone URL rewritten (the `networkCloneUrl` approach), `clone-cache.ts:153` and `:315` fetch `remote: "origin"`. If origin was set back to canonical, they hit real github.com. If it was not, D-01 breaks.
**How to avoid:** do the fetch rewrite in `platform/git.ts::fetch` (Pattern 1). Add a platform test that fetches with the override set and asserts the request URL.
**Warning signs:** a cucumber run under the override that logs no git-host request for `update`.

### Pitfall 2: `update-flow` builds the GitHub auth bundle eagerly
**What goes wrong:** `makeSyncCloneOnce` calls `buildAuthForHost({ host: GITHUB_HOST, ... })` at factory creation (`update-flow.ts:150-157`), before it knows any marketplace kind. If that becomes a seam read, every `plugin update` reads and validates the variable, including path-only runs. That violates the discretion rule (path sources never read it), and an invalid value fails unrelated updates.
**How to avoid:** build the GitHub bundle inside the `source.kind === "github"` arm (`:174-176`). Bundles are pure data, and the shared `authMemo` still caps the Device Flow (D-79-02).

### Pitfall 3: Device Flow for an override whose host is a registry host
**What goes wrong:** binding the host alone still finds `GITHUB_PROVIDER`/GitLab when the base is `https://github.com/...` or `https://gitlab.com/...`, so the README's "Device Flow never runs" would be false.
**How to avoid:** the GitHub auth helper returns a stored-credential bundle whenever the override is set (Pattern 3). Add an auth-host test with base `https://gitlab.com/mirror` asserting `kind: "stored-credential"`.

### Pitfall 4: The typed error message is redacted away in json/rpc output
**What goes wrong:** an unclassified throw reaches `notifyCommandError`. In `json`/`rpc` mode, `resolveCommandError` runs `redactCommandPaths`. That function treats any `/` outside a complete `http(s)://...` token as a filesystem path and redacts from there, possibly to `Command failure details omitted.` (`shared/notification-command-error.ts:47-59`). A message like "must be an `https://` URL" has `https://` followed by a space, which the URL alternative does not match, so it is redacted.
**How to avoid:** write messages without `/`: "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL must use the https scheme", "... must not contain a user name or password", "... must not contain a query or a fragment", "... is not a valid URL". Add a seam test asserting the exact messages.

### Pitfall 5: An invalid value under `marketplace update` renders as `{network unreachable}`
**What goes wrong:** `refreshOneMarketplace` folds any unclassified error to `reasons: typedReasons ?? ["network unreachable"]` (`update.ts:694`). The cause line would name the variable, but the reason token is wrong. See Open Question 1.

### Pitfall 6: A developer shell with the variable exported
**What goes wrong:** existing unit tests assume unset. The variable is project-prefixed, so a collision is unlikely, but tests would fail on a machine that exports it. The cucumber/e2e Pi child builds its env from scratch (research SUMMARY), so it is not affected.
**How to avoid:** override cases set the variable and register the restore with `t.after()` (workflow-home precedent). The seam's own "unset" cases delete it first with a restore.

### Pitfall 7: D-03's "the cause line names the URL actually fetched" is not true today
**What goes wrong:** isomorphic-git's `HttpError` message is `HTTP Error: ${statusCode} ${statusMessage}` (`index.cjs:3944-3947`), with no URL. Only connection errors (`connect ECONNREFUSED 127.0.0.1:8443`) name host:port. Adding the URL unconditionally would change unset output and break GHB-04.
**How to avoid:** see Open Question 3. The recommendation is that `platform/git.ts`, *only when the URL was rewritten*, attaches a tail cause such as `new Error("fetched <wire url>")` to a failure whose `cause` is undefined. This follows the D-1-02 precedent in `refreshUrlClone` (`shared.ts:379-389`). It keeps the code-bearing error at depth 0, so the classifiers are unaffected.

## Code Examples

### Live probe of the isomorphic-git mechanism (this session)
The probe ran against a local `git http-backend` (git 2.55.0) over loopback http, with isomorphic-git 1.42.3 from this repo's `node_modules`:
```
after clone origin: [ 'http://127.0.0.1:37145/o/r.git' ]          <- clone records the url it was given
after setConfig origin: [ 'https://github.com/o/r.git' ]          <- setConfig rewrites it
fetch requests: [ 'GET /o/r.git/info/refs', 'POST /o/r.git/git-upload-pack' ]   <- fetch({remote:"origin", url: WIRE}) hit the wire url
refs/remotes/origin/main == upstream: true                        <- tracking ref updated under "origin"
config unchanged after fetch: true                                <- fetch with url writes nothing to .git/config
listServerRefs HEAD ok: true
```
[VERIFIED: probe script in session scratchpad; isomorphic-git source `_clone` `index.cjs:10573-10603` calls `_addRemote({ remote, url })`, then `_fetch` without `url`. `_fetch` `:10204-10208`: `const url = _url || (await config.get(\`remote.${remote}.url\`))`.]

### Platform clone/fetch (sketch)
```typescript
// platform/git.ts -- sketch; keep the existing auth spread and comments
export async function clone(opts: CloneOptions): Promise<void> {
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  const wireUrl = gitHubWireUrl(opts.url);
  await git.clone({ fs, http, dir: opts.dir, url: wireUrl, /* ref, singleBranch, auth as today */ });
  if (wireUrl !== opts.url) {
    // D-01: the clone keeps its canonical identity; only the bytes came from the base.
    await git.setConfig({ fs, dir: opts.dir, path: "remote.origin.url", value: opts.url });
  }
}

export async function fetch(opts: FetchOptions): Promise<void> {
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  const recorded: unknown = await git.getConfig({
    fs,
    dir: opts.dir,
    path: `remote.${opts.remote ?? "origin"}.url`,
  });
  const wireUrl = typeof recorded === "string" ? gitHubWireUrl(recorded) : undefined;
  await git.fetch({
    fs,
    http,
    dir: opts.dir,
    ...(opts.remote !== undefined && { remote: opts.remote }),
    ...(wireUrl !== undefined && wireUrl !== recorded && { url: wireUrl }),
    /* ref, auth as today */
  });
}
```
Caveat: `opts.remote ?? "origin"` only decides which URL is read for the rewrite. isomorphic-git's own remote choice when `remote` is omitted (`branch.<ref>.remote`) is unchanged, because `remote` is still spread only when given. Every production caller passes `"origin"` (`shared.ts:261`, `clone-cache.ts:153`).

### Seam (sketch, API names are discretion)
```typescript
// shared/github-base-url.ts
export const GITHUB_BASE_URL_VARIABLE = "PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL";
const GITHUB_ORIGIN = "https://github.com";
const GITHUB_HOST = "github.com";

/** The normalized override base and host, or undefined when the variable is unset or empty. Throws InvalidGitHubBaseUrlError. */
function readOverride(): { readonly base: string; readonly host: string } | undefined { /* Pattern 5 */ }

export function gitHubOverrideHost(): string | undefined { return readOverride()?.host; }
export function gitHubHost(): string { return readOverride()?.host ?? GITHUB_HOST; }
export function gitHubWireUrl(url: string): string {
  if (!url.startsWith(`${GITHUB_ORIGIN}/`)) {
    return url;
  }
  const override = readOverride();
  return override === undefined ? url : `${override.base}${url.slice(GITHUB_ORIGIN.length)}`;
}
```
`fallow dead-code` fails on an unused export, so export only what production imports. An identity constant for `clone-key.ts:83` is optional.

### Env-var test pattern (workflow-home precedent)
```typescript
// tests/platform/workflow-home.test.ts:26-49 pattern: save, register restore, then mutate
const hadValue = Object.hasOwn(process.env, GITHUB_BASE_URL_VARIABLE);
const previous = process.env[GITHUB_BASE_URL_VARIABLE];
t.after(() => {
  if (hadValue && previous !== undefined) {
    process.env[GITHUB_BASE_URL_VARIABLE] = previous;
  } else {
    delete process.env[GITHUB_BASE_URL_VARIABLE];
  }
});
process.env[GITHUB_BASE_URL_VARIABLE] = "https://git.example.invalid/mirror";
```
Delete an absent variable on restore; never assign `undefined`, which stringifies (`workflow-home.test.ts:20-24`). Every test module runs in its own process, so mutations do not leak across files.

## Which commands read the variable

Rule: the variable is read only where a **GitHub URL meets the network** (`platform/git.ts`, prefix match) or where a **GitHub auth bundle is built** (`kind === "github"` arms).
- **Read:** `marketplace add` (github), `marketplace update` / autoupdate cascade (github), `plugin update` marketplace sync (github arm, after Pitfall 2), `install` / `reinstall` / `fetch` / `info --fetch` / `update` for github plugin sources, constrained dependency tag probes, `import`, and reload reconcile when it adds a github marketplace or installs a github plugin.
- **Caveat:** `buildCloneAuth` runs before `materializePluginClone`'s warm-cache check, so a warm github install still reads and validates the variable. That is acceptable under "paths that reach the network for a GitHub source", but list it in Open Question 1.
- **Never read:** `list`, bare `info`, `uninstall`, `marketplace remove`, `marketplace list/info`, path sources, url sources (no `https://github.com/` prefix), `marketplace autoupdate/noautoupdate` flag flips.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `GITHUB_BASE_URL` | `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` | 2026-10-15 amendment of D-MF-01 | Avoids the Terraform GitHub provider's API-URL variable. |
| `canonicalCloneUrl` follows the override (milestone research Pattern 4) | Identity stays github.com; only the wire URL and auth host follow (D-01) | 2026-10-15 discuss-phase | No cache rehash. Leftovers are recognized across base changes. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | An empty value means unset, not invalid | Pattern 5 | An empty export would be silently ignored instead of failing. Low. |
| A2 | git-subdir plugin sources whose `url` is `https://github.com/...` are also rewritten (insteadOf semantics), and their auth host follows | Pattern 3, Open Q2 | If the user wants only the `github` kind, the platform rewrite would need the kind, and the planner must restrict it. |
| A3 | Under an active override, GitHub auth is always `stored-credential`, even if the base host is github.com or gitlab.com | Pattern 3 | If the user wants Device Flow for `https://github.com` as base, the doc line changes. Low. |
| A4 | The rewrite matches the exact prefix `https://github.com/`, like git's `insteadOf`. A legacy clone origin spelled `https://GitHub.com/...` (pre-D-76-02 url-kind records) is not rewritten. | Pattern 1 | Such a clone would fetch from real github.com under the override. It only affects old clones and has no Phase 10 impact. |
| A5 | No new reason token is added to the closed vocabulary for an invalid override | Open Q1 | If the user wants a dedicated token, it ripples into `notification-types.ts`, the wire schema, the docs, and the closed-set gates. |

## Open Questions

1. **How does an invalid value surface per verb?** (GHB-03 "fails the command")
   - What we know:
     - `marketplace add` standalone rethrows unclassified errors (`add.ts:570-575`). `command-run.ts` then rethrows in `tui`/`print` (Pi shows the message) or emits an `internal-error` payload in `json`/`rpc` (`notification-dispatch.ts:152-176`). Both name the variable.
     - `marketplace update` folds it into a failed row with `{network unreachable}` (Pitfall 5).
     - Plugin verbs fold it into their own failure rows.
   - Recommendation: no new reason token (A5). Rethrow `InvalidGitHubBaseUrlError` past the per-target catch in `update.ts::refreshOneMarketplace` and the plugin verbs, so it becomes a command failure everywhere, consistent with `add`. Make sure the load-time reconcile still catches it (NFR-2). Planner: confirm with the user, or limit this phase to add/update plus the unit-level typed-error proof.
2. **Do git-subdir sources on github.com follow the override?** (A2) Under platform placement they do automatically. `hostFromCloneUrl`'s non-github arm must then use `new URL(gitHubWireUrl(cloneUrl)).host`, and `buildCloneAuth` must send those URLs through `buildGitHubAuth`. Otherwise a private git-subdir repo cancels at the `onAuth` guard, which fails safe with no leak. Recommendation: include it, as it matches "like `git config url.<base>.insteadOf`".
3. **D-03's cause line.** Recommendation: attach `fetched <wire url>` as a chain tail only when the URL was rewritten (Pitfall 7). Unset output stays byte-identical. Confirm the wording with the user, or drop it and correct D-03.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.11.1 local (CI Node 24) | — |
| isomorphic-git | platform | ✓ | 1.42.3 | — |
| git CLI | not needed by this phase (tests mock HTTP; only used for this session's probe) | ✓ | 2.55.0 | — |

**Missing dependencies:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock` (typescript-unit-tests skill) |
| Config file | none (npm scripts in `package.json:93-107`) |
| Quick run command | `node --test <owner test path>` |
| Pair coverage | `npm run test:coverage:direct -- <source or test path>` (100% line/branch/function) |
| Full suite command | `npm run check` (static + unpaired + integration + cucumber + direct coverage for all pairs) |

Measured owner-test runtimes this session: `clone-key` 0.5 s, `platform/git` 3.1 s, `marketplace/update` 4.1 s, `marketplace/add` 4.4 s, `auth-host` 4.6 s, `plugin/update-flow` 10.4 s. All pass on the current tree.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GHB-01 | Prefix rewrite with base, path prefix, trailing slash; identity when unset or not a github URL | unit | `node --test tests/shared/github-base-url.test.ts` | ❌ Wave 0 |
| GHB-01 | `clone` under the override hits `<base>/o/r.git` and records the canonical origin (`git.getConfigAll remote.origin.url`) | unit (mocked transport `installRepositoryTransport`, `tests/platform/git.test.ts:301-341`) | `node --test tests/platform/git.test.ts` | ✅ add cases |
| GHB-01 / D-02 | `fetch` (remote origin, canonical recorded) requests the wire URL and leaves the config unchanged. `resolveRemoteRef`/`listRemoteTags` request the wire URL. | unit | same | ✅ add cases |
| GHB-02 | `hostFromCloneUrl(_, "github")` returns the override host. `buildCloneAuth` github under the override returns `stored-credential`, also for a `gitlab.com` base. | unit | `node --test tests/orchestrators/auth-host.test.ts` | ✅ add cases |
| GHB-02 | `marketplace add` github under the override: the fake `gitOps.clone` gets canonical `url` and `auth.host` = override host, `kind: "stored-credential"`. A leftover with a canonical origin is recognized. | unit | `node --test tests/orchestrators/marketplace/add.test.ts` | ✅ add case |
| GHB-02 | `marketplace update` github under the override binds the override host (no inline literal) | unit | `node --test tests/orchestrators/marketplace/update.test.ts` | ✅ add case |
| GHB-02 | `plugin update` sync binds the override host in the github arm, and a path-only run never reads the variable (invalid value set → path update succeeds) | unit | `node --test tests/orchestrators/plugin/update-flow.test.ts` | ✅ add cases |
| GHB-02 / D-01 | `canonicalCloneUrl`, `networkCloneUrl`, and `originMatchesSource` are unchanged with the variable set | unit | `node --test tests/domain/clone-key.test.ts` | ✅ add case |
| GHB-02 | The literal gate fails a new `github.com` literal | lint | `npm run lint` (plant once by hand, not committed) | config change |
| GHB-03 | Each refused form throws `InvalidGitHubBaseUrlError` with `variable`/`problem` and a slash-free message naming the variable | unit | `node --test tests/shared/github-base-url.test.ts`, `tests/shared/errors.test.ts` | ❌ / ✅ |
| GHB-04 | Unset: rewrite is the identity and the existing platform/orchestrator suites pass unchanged (no `url`, no `setConfig`) | unit + full | `npm run check` | ✅ |
| GHB-04 | `list`/`info`/`claude-plugins.json` stay in github.com terms | covered by unchanged `domain/source.ts` and its existing tests. Phase 10 scenarios add end-to-end proof. | `npm run check` | ✅ |
| GHB-05 | README/README.es/CHANGELOG | manual review + `pre-commit run --files README.md README.es.md CHANGELOG.md` (mdformat, markdownlint) | — | docs |

Do not add tests that a gate already guards: the literal rule itself, the exported return types, and the zone boundaries (memory: "Don't test what a gate already guards").

### Sampling Rate
- **Per task commit:** the owner test(s) touched, plus `npm run test:coverage:direct -- <source>` for each changed source. The hook runs `npm run check:commit`.
- **Per wave merge:** `npm run check` (combined tree, about 73 s per project memory).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/shared/github-base-url.test.ts`: new pair for the seam (100% direct coverage needs every validation branch, the unset/empty/prefix-miss branches, and the override host).
- [ ] Optional `tests/shared/github-base-url-environment.ts`: set/clear helper with `t.after` restore, shared by owner tests. Staging a non-`.test.ts` file under `tests/` makes `check:commit` run all pairs.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Host-keyed `git credential fill`. Stored-credential only for the override host. No Device Flow under the override. |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | WHATWG `URL` + explicit checks (https, no userinfo, no `?`/`#` in `href`). Typed error. |
| V6 Cryptography | no (TLS by Node; https enforced) | — |
| V7 Error handling / logging | yes | Never echo the value. Slash-free messages (Pitfall 4). AUTH-09. |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A GitHub credential sent to the mirror host | Information disclosure | Bundle host = override host. `onAuth` guard (`git-auth-callbacks.ts:178`). Fill keyed to the override host. |
| Cleartext clone (`http://` base) | Information disclosure / Tampering | Refuse non-`https:` (GHB-03). |
| Token in the variable (`https://user:tok@host`) reaching rows or logs | Information disclosure | Refuse userinfo. The message never interpolates the value. |
| Device Flow to public github.com from a hermetic run | Spoofing / network leak | Stored-credential under the override (Pitfall 3). |
| Redirect from the mirror to another origin carrying a credential | Information disclosure | Existing GAUTH-06 `requestWithinOrigin` (`platform/git.ts:310-360`), unchanged. |

## Documentation (GHB-05)

- **README:** `README.md` and its only localized copy `README.es.md` change in the same commit (readme skill). Apply `simple-english` (Plain) and `humanizer`. Keep code, the variable name, and commands identical in both.
  - Placement: a short "advanced setting" subsection. Two suitable spots are after the GitHub `marketplace add` notes in "Command reference > Marketplace" (`README.md:200-235`), or a new section before "Command reference".
  - Content (D-04): what it does (GitHub sources clone and fetch from another https host, such as a mirror, an air-gapped server, or a local test server), an example with a path prefix, and the refused forms.
  - Limits: Device Flow never runs for the override host. Credentials come only from `git credential`, stored under the override's `host[:port]`. Output, `list`, `info`, and `claude-plugins.json` stay in github.com terms. A changed value applies on the next fetch.
  - Divergence: Claude Code has no such setting.
- **CHANGELOG:** one bullet under `## [Unreleased]`, newest first, 40 words or fewer, one sentence, verbatim backticks for the variable. The last token is `(#<PR>)`, which is unknown at plan time, so the PR step fills it. Run `pre-commit run --files CHANGELOG.md` (changelog skill, `rules/entries.md`).
- `docs/env-vars.md` documents variables *delivered to plugin components*, not configuration, so it is not the home for this variable.

## Sources

### Primary (HIGH confidence)
- In-repo source read this session: `domain/clone-key.ts:81-133`, `orchestrators/auth-host.ts:76-247`, `orchestrators/marketplace/shared.ts:131-391`, `orchestrators/marketplace/update.ts:370-470,600-710`, `orchestrators/marketplace/add.ts:280-322,440-475,563-607,780-900,955-1040`, `orchestrators/plugin/update-flow.ts:130-191,295-310`, `orchestrators/plugin/clone-cache.ts:1-603`, `orchestrators/plugin/dependency-tag-probe.ts:95-170`, `orchestrators/plugin/update-preflight.ts:200-265`, `orchestrators/plugin/info.ts:2055-2110`, `platform/git.ts:1-775`, `platform/git-auth-callbacks.ts:140-230`, `domain/auth-registry.ts:40-100`, `domain/source.ts:175-250,575-660,745-770`, `shared/notification-command-error.ts`, `shared/notification-dispatch.ts:150-200`, `edge/command-run.ts:40-100`, `eslint.config.js:1-700`, `.fallowrc.json:88-147`, `platform/workflow-home.ts`, `tests/platform/workflow-home.test.ts`, `tests/platform/git.test.ts:46-1080`.
- `node_modules/isomorphic-git/index.cjs` 1.42.3: `_fetch` `:10177-10260`, `_clone` `:10573-10650`, `GitRemoteHTTP.discover` `:9431-9500`, `HttpError` `:3938-3949`.
- Live probes: isomorphic-git clone, setConfig, and fetch-with-url against `git http-backend`; WHATWG URL normalization; the prototype ESLint literal rule.
- Skills: `.agents/skills/{readme,changelog,typescript-unit-tests,local-verification}`.

### Secondary (MEDIUM)
- `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS}.md` (milestone research; its Pattern 4 identity recommendation is superseded by D-01).

## Metadata

**Confidence breakdown:**
- Inventory: HIGH. Every call site was read and cross-checked with `rg`.
- isomorphic-git mechanism: HIGH. Source read and live probe.
- Recommended placement (platform rewrite): MEDIUM. It is within discretion, and it differs from CONTEXT's code-insight line that suggests `networkCloneUrl` follow the seam. The rationale is above.
- Pitfalls: HIGH for 1, 2, 4, 5, and 7 (read in code). MEDIUM for 3 and 6.

**Research date:** 2026-10-15
**Valid until:** 2026-11-14, or until `platform/git.ts`, `auth-host.ts`, or `eslint.config.js` change.
