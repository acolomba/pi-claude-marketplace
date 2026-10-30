# Phase 5: Marketplace Command Parity - Research

**Researched:** 2026-10-26
**Domain:** Pi extension TypeScript (marketplace orchestrators, source parser, edge router/completions, cucumber stand-ins)
**Confidence:** HIGH for the code map and the blast radius (read and typechecked this session); MEDIUM for the stand-in and fetch-module design (verified on Node, not yet built)

## Summary

The phase is mostly wiring. The upstream contract is already fixed in CONTEXT.md (E-1..E-6, D-PL5-01..19). Three things in the code need care:

1. **The hosted kind.** Adding `HostedManifestSource` to `ParsedSource` breaks the typecheck at exactly six sites. I added the kind in a scratch copy and ran `tsc`, so this is measured. Six more sites are not exhaustive switches. They must be found by reading the code and pinned by tests: `persistence/state-io.ts::normalizeStoredSource` (a hosted record would fail to load), `domain/source.ts::parseKindObjectSource` (a stored hosted record would re-parse as `unknown`), `update.ts::refreshRecord` (it would throw "unsupported source kind"), `remove.ts::RecordedSourceKind` and `removeMarketplaceFootprint` (the hosted `sources/<name>/` would never be deleted), `info.ts::buildBlock` (it would show `path:`), and `add.ts::parseAddableSource` (it would refuse the source).
2. **The reserved-name rule breaks other code.** Eight scenarios in four feature files publish `anthropic-plugin-directory` as a **dir** source and add it. So do the e2e helper (`test/e2e/_helpers.ts:166`, a path add of the upstream `claude-plugins-official` checkout) and the CI e2e job. Under D-PL5-01 every one of them is refused. The fix is test-side. The scenarios publish that marketplace under the git host's `anthropics` owner. The e2e helper stops path-adding a manifest that declares a reserved name.
3. **The hosted stand-in.** Node's global `fetch` trusts `NODE_EXTRA_CA_CERTS`. I verified this on Node 22.22.2 and 26.12.1 against a self-signed loopback https server. The cucumber Pi already gets that variable, pointing at the git host's certificate (`features/support/pi-process.ts:88`). So the existing loopback https git host can serve a static `marketplace.json`, and Pi's fetch trusts it with no new trust plumbing. The host needs a static-file route, a reset that clears it, and arm support. Its request log then proves which commands touched the network.

The fetch failures fit the existing classifiers with no new ladder. The fetch module can throw an isomorphic-git-shaped `HttpError` (`code: "HttpError"`, `data.statusCode`) for a non-2xx status, and errno-coded errors (`ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`) for connection failures. Then `classifyGitSourceAccessFailure`, `hostHttpStatus`, `hostHttpFailureFrame`, and update's `transportReason` already produce every D-PL5-10 token and the `{status} on {url}` frame. Only "body over cap / refused redirect → `unreadable`" needs one new `instanceof` arm in add and in update.

**Primary recommendation:** Land the domain kind first, with its six compile-forced arms and the three non-exhaustive parse/load arms, in one plan. Then the platform fetch module and its gates. Then add/update/remove/info. Then the cucumber stand-in and scenarios. Edge (`market`), the shorthand, the fold, and ROWID are independent and can run in parallel with the domain plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hosted-URL classification, shorthand split | domain (`domain/source.ts`) | — | Shared string funnel for config, state, reconcile, import (ST-6) |
| Reserved-name predicate + wording | domain (`domain/name.ts`) | orchestrators (`add.ts::newMarketplaceName`) | Pure predicate; the add reads the manifest name |
| HTTPS GET with timeout/cap/redirect policy | platform (new `platform/hosted-manifest*.ts`) | orchestrators (`marketplace/shared.ts` default port) | Only network boundary; rule-pack + BLOCK F gate it |
| Hosted add/refresh/remove lifecycle | orchestrators/marketplace (`add.ts`, `update.ts`, `remove.ts`) | persistence (`state-io.ts` revalidation) | Mirrors the git clone lifecycle under the state lock |
| `market` alias | edge (`router.ts`, `completions/provider.ts`) | edge (`handlers/plugin/help.ts`, optional) | Pure dispatch/identity |
| Bare marketplace JSON id | orchestrators (row builders set `marketplaceSubject`) | shared (`notification-json.ts` for plugin-info) | `rowId` already honors the marker |
| Exhaustive cascade fold | orchestrators/plugin (`shared.ts::applyPartialCascadeFold`) | orchestrators/marketplace (`remove.ts` caller) | One fold, compile-forced axis table |
| Behavioral proof | features (`features/lib/https-git-host`, steps, `.feature`) | test/architecture (`https-git-host-server.test.ts`) | Stand-ins live under `features/lib/` |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Reserved names (MKT-01)

- **D-PL5-01:** `marketplace add` refuses a manifest name in Claude Code's 19-name reserved set (E-1), compared lowercased, unless the source is `github` with owner `anthropics` (compared lowercased). Our `url` kind never names github.com (D-76-02 normalizes github.com URLs to `github`), so a `url`, `path`, or hosted source is never exempt. The check runs where the add already reads the manifest name (`newMarketplaceName` in `orchestrators/marketplace/add.ts`), before any state mutation, and covers every add caller: standalone, `bootstrap`, `apply`, `import`, and the D-MF-04 install-time add. The pure predicate lives in `domain/name.ts` beside `isReservedRecordKey` and returns the refusal sentence or `undefined`.
- **D-PL5-02:** Wording is Claude Code's, verbatim per source kind (E-1): the `github.com/anthropics/` sentence for `github` and `url` (git) sources, the `'anthropics' organization` sentence for `path` and hosted sources. The row is the failed-add row with one failed child row carrying the sentence as its cause (the shape `failedAddRow` already uses for a fetched-URL failure, `marketplaceSubject: true`), reason token `invalid manifest`, reusing the D-08-07 precedent that a reserved `__proto__` name is `invalid manifest`. No new reason token.
- **D-PL5-03:** Scope is the exact reserved set only. Look-alike/impersonation names, other spellings, `npm`/`pip`/`uv`/`cargo`/`github`/`gh`, the `claudeai-` prefix, the `<owner>-<repo>` folder rule, a refresh that renames a marketplace to a reserved name, and the load-time refusal of an already-registered reserved name from an untrusted source are deferred to a new backlog entry (proposed `MKTNAME-01`, see SUMMARY).
- `bootstrap` needs no change; `features/plugin/bootstrap.feature` stays green and proves it.

#### Hosted marketplace.json (MKT-02)

- **D-PL5-04 (classification):** In the shared string funnel `parsePluginSource`, an `https://` input whose URL path (before `?` and `#`) ends in `.json` is a hosted manifest source. The arm runs after the github.com arm (D-76-02 stays first, so a github.com URL is never fetched as a catalog) and before the generic https `url` arm. The `#fragment` is dropped, as Claude Code drops it; the query string is kept. The object-field gate `gatedUrlField` (a manifest's `{source: "url", url}` plugin entry) does NOT classify `.json`, so plugin git URL objects keep their meaning. `http://` stays refused (D-76-01). This is narrower than Claude Code, which treats every non-`.git`, non-forge https URL as a hosted catalog (E-2): a suffix-less URL keeps cloning as git, which keeps MURL-01, D-76-01, and D-2-01/D-2-02 (recorded decisions, the divergence license).
- **D-PL5-05 (source kind):** `ParsedSource` gains `HostedManifestSource { kind: "hosted"; raw; url }` (`url` = `raw` without the fragment). It is reachable from the string arm above and from the persisted object form `{kind: "hosted", raw}` (state records re-parse through the same funnel, ST-6). Every exhaustive `kind` switch gets an explicit arm: marketplace-side consumers handle it; plugin-side consumers (`domain/plugin-resolver.ts`, `domain/version.ts`, `orchestrators/plugin/dependency-declaration-read.ts`, `orchestrators/plugin/info.ts`) treat it like `npm`, an unsupported plugin source. `samePlannedSource` compares hosted by `url`; `sourceLogical` renders the url. `persistence/state-io.ts` revalidates a stored hosted record. Every non-exhaustive `kind === ...` site that reads a marketplace record's source (mirror seeding, clone GC, `remove` footprint, `update` refresh, `info`/`list` labels) is audited so a hosted record takes the right branch, not a git branch by default.
- **D-PL5-06 (storage):** A hosted marketplace is stored like a clone so every existing reader works unchanged: `sources/<name>/.claude-plugin/marketplace.json` holds the downloaded bytes, `marketplaceRoot` is `sources/<name>/`, `manifestPath` points at the file. The add writes into a staging directory and renames it into place (NFR-1, MA-9 cleanup discipline), with an ownership marker of its own (there is no `.git/`) that records the source URL, so a leftover `sources/<name>/` is recognized and replaced when it is ours for the same URL and refused `{stale clone}` otherwise (MA-6, MA-12, MA-13 parity). `marketplace remove` deletes `sources/<name>/` for a hosted record as it does for a clone (MR-7).
- **D-PL5-07 (fetch seam):** A new platform module (proposed `platform/hosted-manifest-fetch.ts`) is the only new `fetch` caller: one GET with a 10 s timeout, a 5 MiB body cap, at most 5 redirects, every redirect `https://`, and a cross-origin redirect to a loopback, link-local, or metadata host refused (E-2). The orchestrators receive it as an injected port with a production default (the `GitOps` pattern), so tests inject a double and never touch the network. `rule-packs/architecture.json` `fetch-chokepoint` admits the module as a second sanctioned caller; `eslint.config.js` BLOCK F bans importing it from every `orchestrators/` and `domain/` module outside `NETWORK_SEAMS` (the default can live in `marketplace/shared.ts`, already a seam). No credentials or headers are sent (Claude Code's CLI add sends none).
- **D-PL5-08 (NFR-5 amendment):** Network is also required for `marketplace add` and `marketplace update` (and the autoupdate cascade, and an `apply` that adds or refreshes one) of a hosted-manifest marketplace, which download its `marketplace.json` over https. Installing from a hosted marketplace reads the stored copy (plugins still clone on cache miss only). `list`, `info`, `uninstall`, and `marketplace remove` stay network-free. Proposed wording for the NFR-5 line in AGENTS.md and PROJECT.md is in the SUMMARY decision rows.
- **D-PL5-09 (refresh):** `marketplace update` re-downloads a hosted manifest, validates it as a git refresh validates its checkout, and swaps the stored file atomically only after validation; the content-key comparison and the plugin cascade run unchanged. Autoupdate refreshes it through the same update path.
- **D-PL5-10 (failure vocabulary):** A hosted fetch failure reuses the add's source-access tokens: connection refused, DNS, or timeout -> `network unreachable`; HTTP 404/410 -> `source missing`; 401/403 -> `authentication required`; any other status -> `network error` with the `{status} on {url}` cause frame `marketplace add` and `update` already render; a body over the cap or a refused redirect -> `unreadable`; malformed JSON -> `unparseable`; schema-invalid -> `invalid manifest`.
- A relative-path plugin entry in a hosted marketplace gets no special case: its directory does not exist under `sources/<name>/`, and the resolver's existing missing-directory behavior applies (Claude Code also fails it at install, E-2).

#### `market` alias (MKT-03)

- **D-PL5-11:** `edge/router.ts` dispatches `market` exactly as `marketplace` (every subcommand, `help`, the missing-subcommand usage error), and `edge/completions/*` completes after `market` exactly as after `marketplace`. The plugin help names it the way it names `ls`: `marketplace <...> ...   (alias: market)`. First-token completion treats `market` the way it treats the top-level `ls` alias.

#### Row ids (MKT-04)

- **D-PL5-12:** Every marketplace-level failure row sets `marketplaceSubject: true` on its synthetic child, so `rowId` emits the bare marketplace name: `marketplaceFailureRows` in `marketplace/shared.ts` and the own-built rows in `marketplace/update.ts` and `marketplace/info.ts` (and `surfaceLockHeldAdd`, which can then drop its own spread). The pinned `<mp>@<mp>` cells in the feature files and unit tests change to the bare id; `docs/json-output.md` says so. This changes the published JSON payload, so it gets a CHANGELOG line.

#### Shorthand (MKT-05)

- **D-PL5-13:** Parity. `owner/repo` shorthand splits at the FIRST `@` or `#` (E-4), so `acme/tools@a@b` is `acme/tools` at ref `a@b`. This retires D-76-04's last-`@` rule; the D-MF-07 empty-`#` divergence stays. The owner/repo character-class check upstream applies is not adopted here (out of SHORTREF-01's scope). Test-first in `test/domain/source.test.ts`, plus a scenario.

#### Remove reporting and fold (MKT-06, MKT-08)

- **D-PL5-14:** `marketplace remove` does not name the dependents it strands in other marketplaces. Claude Code reports only the plugins it uninstalled (E-5), and LOAD-03 / D-06-07 already report each unmet dependent at the next load, `pending`, and `apply`. Refusing stays off the table (D-05-07). PRUNE-GUARD-MR-01 closes as decided; no code change.
- **D-PL5-15:** `applyPartialCascadeFold` in `orchestrators/plugin/shared.ts` becomes exhaustive: an axis table typed over `keyof UnstageOutcome["dropped"]` maps each dropped axis to its resource field (`commands -> prompts`), so a new axis fails `npm run typecheck` until it is mapped. `marketplace/remove.ts` deletes its hand-rolled copy and calls the shared fold, which adds the hooks axis it omitted. Only that function changes in `plugin/shared.ts` (Phase 1 edits the warning functions).

#### `marketplace add` classification (MKT-07)

- **D-PL5-16 (crash vs malformed):** In orchestrated mode the non-enumerated catch-all no longer collapses to `unparseable`. It narrows through `narrowProbeError` (the fallback `classifyOrchestratorThrow` already uses for every other apply operation), so `unparseable` means a malformed-JSON manifest only and an unforeseen throw reads `unreadable` (or its errno token). The typed `error` stays on the outcome for callers that narrow. Standalone mode still rethrows an unforeseen error.
- **D-PL5-17 (missing clone):** A standalone add whose typed source matches a recorded `github`, `url`, or hosted marketplace whose `sources/<name>/` directory is gone repairs it, as Claude Code re-fetches (E-6): it re-materializes the clone or download into `sources/<name>/` through the normal staging path, refreshes the record's manifest metadata, keeps its `plugins` map, writes the config declaration if the target layer lacks it, and reports `(added)`. If the re-materialized manifest declares a different name, the add fails `{source mismatch}` and keeps the record untouched. A recorded `path` marketplace whose manifest is gone fails `{source missing}` instead of reading as `already added`.
- **D-PL5-18 (EISDIR):** The add's errno mapping matches `list` and `info`: `EISDIR`, `EIO`, and `EBADF` read `unreadable` (one shared mapping with `narrowCascadeFailure`, not a third copy), so a manifest path that is a directory renders a failed row instead of a raw exception.
- **D-PL5-19 (no-op status):** The `already added` arm stops returning `status: "added"`. It returns a distinct no-op status. That arm is standalone-only (WR-09), so the orchestrated overload's return type excludes it and `apply`/`import` need no change.

### Claude's Discretion

- Exact module and type names (`HostedManifestSource`, the fetch module, the marker file), the hosted marker's location inside `sources/<name>/`, and how the redirect host-class check is written.
- How the plans split into waves, as long as each wave's plans own disjoint files.
- Scenario file names under `features/marketplace/` and the stand-in that serves a hosted `marketplace.json` from the existing loopback https host.

### Deferred Ideas (OUT OF SCOPE)

- `MKTNAME-01` (new): the rest of Claude Code's reserved-name rules (look-alike, other spelling, package-manager names, `claudeai-` prefix, `<owner>-<repo>` folder), the refresh-time check, and the load-time refusal of a reserved name registered from an untrusted source.
- Upstream's broader hosted-catalog classification (every non-`.git` non-forge https URL) — would reverse MURL-01 / D-2-01 / D-2-02; a user decision.
- `headers` / `headersHelper` for hosted catalogs (only reachable from a settings declaration upstream; Pi has no such declaration surface yet).
- The owner/repo character-class validation Claude Code applies to the shorthand.
- Import (Phase 6) mapping a Claude Code `{source: "url"}` declaration onto the hosted kind.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MKT-01 | `marketplace add` refuses Claude Code's reserved official marketplace names, with `bootstrap` still able to add the official marketplace | §Reserved names: predicate placement, `newMarketplaceName` signature change, `failedAddRow` child-row trigger, the fixture breakage list (8 scenarios, e2e helper) |
| MKT-02 | `marketplace add` accepts a plain https URL to a hosted `marketplace.json`, and `marketplace update` refreshes it | §Hosted kind blast radius (6 compile-forced + 6 non-exhaustive sites), §Fetch seam, §Storage, §Refresh, §Stand-in |
| MKT-03 | `/claude:plugin market` is an alias of `marketplace` | §`market` alias: 4 router sites, 4 completion sites, `flag-catalog-drift` gate, 3 help.feature cells + 2 unit pins |
| MKT-04 | Marketplace-level failure rows carry the marketplace as their JSON id | §ROWID: 3 builders + plugin-info wire id; 19 feature cells + 2 unit pins |
| MKT-05 | The `owner/repo@ref` shorthand splits as Claude Code splits it | §Shorthand: `parseShorthandSourceForm` rewrite; no existing test pins multi-`@`; branch-step scenario |
| MKT-06 | `marketplace remove` reporting of stranded dependents settled | D-PL5-14: decision only, no code; record PRUNE-GUARD-MR-01 closure |
| MKT-07 | add tells malformed from crash, repairs a missing clone, maps EISDIR, no-op status | §MKT-07: catch-all, errno helper (MPA-02 caveat), repair path, no-op typing without unreachable branches |
| MKT-08 | Cascade `dropped` fold exhaustive and used by `marketplace remove`, hooks axis included | §Fold: import legality proven (`fallow trace`: no path), axis-table shape |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- NEVER commit to `main`; branch `features/*`; commit per `.agents/skills/committing/SKILL.md`; never `--no-verify`; never rebase; merge only. [VERIFIED: AGENTS.md]
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario under `features/` that fails without the change (unit tests do not replace it). [VERIFIED: AGENTS.md "Behavioral tests"]
- Every production `.ts` under `extensions/pi-claude-marketplace/` has exactly one paired `test/<mirrored>.test.ts` with 100% line/function/branch direct coverage; no coverage ignores. [VERIFIED: .agents/skills/typescript-unit-tests/rules/pairing-and-design.md]
- `npm run check` = `check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) + `test:unpaired` + `test:integration` + `test:cucumber` + `test:coverage:direct:all`; it is the gate at wave merges, the phase gate, and the handoff. [VERIFIED: package.json:86-89]
- Two independent complexity ceilings (ESLint `sonarjs/cognitive-complexity: 15`, fallow `maxCognitive: 15` / `maxCyclomatic: 20`); fallow dupes fails on every clone group. [VERIFIED: .planning/codebase/CONVENTIONS.md]
- All disk mutations atomic (tmp + rename) — NFR-1; containment NFR-10; network only where NFR-5 allows (this phase amends it); output only through `notify()`/`notifyWithContext()` (IL-2); no telemetry (IL-4). [VERIFIED: AGENTS.md Constraints]
- Upstream parity is the default; divergence needs a recorded decision ID or a Pi capability gap. [VERIFIED: AGENTS.md "Upstream parity"]
- Comments cite durable IDs (D-PL5-NN, MKT-NN), never phase/plan numbers. [VERIFIED: CONVENTIONS.md "Comments"]
- Tests touching user scope must use a hermetic home (memory: a fixer test clobbered real `~/.pi/agent/state.json`). [CITED: user memory "Subagent tests must use hermetic home"]
- Production code: no `!` non-null and no `as` casts available for unreachable branches; an unreachable branch also fails 100% branch coverage. [CITED: user memory "Compiler-forced unreachable branches"]
- PR titles Conventional Commits, no GSD refs; CHANGELOG entries are milestone aggregates. [CITED: user memory]

## Standard Stack

No new dependencies. Everything uses what the repo already ships.

| Library / API | Version | Purpose | Why |
|---|---|---|---|
| Node global `fetch` (undici, built in) | Node `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | One GET for the hosted catalog | Already the sanctioned Device Flow transport (`domain/github-auth.ts`). `undici` import is banned (`no-network-modules`), so the global is the only route [VERIFIED: rule-packs/architecture.json `no-network-modules`, `fetch-chokepoint`] |
| `AbortSignal.timeout(10_000)` | built in | 10 s timeout | Rejects with `name === "TimeoutError"` [VERIFIED: probe this session, Node 26.12.1] |
| `redirect: "manual"` | built in | Per-hop redirect policy (https-only, host class, ≤5 hops) | Returns the 3xx with a readable `Location` [VERIFIED: probe this session, status 302, location `/m.json`] |
| `node:test` + `t.mock.method(globalThis, "fetch", …)` | built in | Unit-test the platform module offline | The project's sanctioned HTTP-adapter test pattern [VERIFIED: .agents/skills/typescript-unit-tests/rules/boundaries.md:17; precedent test/domain/github-auth.test.ts:110] |
| `@cucumber/cucumber` | 13.3.0 | Behavioral scenarios | [VERIFIED: `npx cucumber-js --version`] |
| fallow | 3.35.0 (local) | dead-code / dupes / health / rule pack | [VERIFIED: `npx fallow --version`] |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
 user types /claude:plugin market|marketplace add <src>
        |
        v
 edge/router.ts --(market == marketplace)--> edge/handlers/marketplace/add.ts
        |
        v
 add.ts runAddInGuard  --parseAddableSource--> domain/source.ts parsePluginSource
        |                                        path | github | url | hosted(.json https) | unknown
        |  withLockedStateTransaction(scope)
        |-- redeclareRecordedSource: same source recorded?
        |       |-- clone/download dir gone? --> repair (re-materialize, keep plugins)   [D-PL5-17]
        |       |-- path manifest gone?      --> {source missing}
        |       '-- else                     --> (skipped){already added} no-op status    [D-PL5-19]
        |-- path:   addPathInGuard -------------------------------\
        |-- github/url: addGitClonedInGuard (gitOps.clone) --------+--> newMarketplaceName(manifest, source)
        '-- hosted: addHostedInGuard (hostedFetch.get -> bytes) --/        |-- reserved name? -> refuse (D-PL5-01/02)
                         |                                                  '-- duplicate? -> {duplicate name}
                         v
                platform/hosted-manifest*.ts  -- fetch(https, timeout, cap, manual redirects)
                         |  errors: errno-coded | HttpError-shaped | Unreadable
                         v
        staging dir -> marker -> rename sources/<name>/ -> state record -> save -> config write-back
        |
        v
 catch -> classifyAddError (+ unreadable arm, errno helper) -> failedAddRow (child row for
          reserved / fetched-url / network error) -> notifyWithContext  | orchestrated outcome
```

### Pattern 1: Hosted-kind blast radius (measured)

I added `HostedManifestSource` to the `ParsedSource` union in a scratch copy and ran `npx tsc -p tsconfig.json --noEmit`. The output was exactly these 6 errors [VERIFIED: tsc output this session]:

```text
domain/plugin-resolver.ts(221,61): TS2366   classifySourceSupport          -> add "hosted" beside "npm" (rejected: unsupported source kind)
domain/source.ts(749,73): TS2366            samePlannedSource              -> compare by url
domain/source.ts(795,54): TS2366            sourceLogical                  -> return source.url
domain/version.ts(163,43): TS7030           sourcePin                      -> undefined (beside "npm")
orchestrators/plugin/dependency-declaration-read.ts(202,4): TS7030 resolvePluginRootFsOnly -> undefined (beside "npm")
orchestrators/plugin/info.ts(249,50): TS2366 isLocallyResolvable            -> false (beside "npm")
```

Ownership note: `dependency-declaration-read.ts` belongs to Phase 2 and `plugin/info.ts` to Phases 3 and 7. Each needs a one-line arm. They are compile-forced, so the arm must land in the same commit as the union change.

The sites below **are not compile-forced**. Each needs an edit and a test that fails without it:

| Site | File:line | Today with a hosted record | Required |
|---|---|---|---|
| `normalizeStoredSource` | `persistence/state-io.ts:357-388` | object `{kind:"hosted"}` hits `obj.kind !== "unknown"` → throws `state.json marketplace "<n>" has malformed source object (missing kind/raw)`, so **every state load of that scope fails** | add `obj.kind === "hosted"` arm: re-parse `obj.raw`, require kind `hosted`, else throw |
| `parseKindObjectSource` | `domain/source.ts:267-302` | `default:` → `unknown` "unrecognized source kind: hosted" → `samePlannedSource` returns `"unknown-stored"` | add `case "hosted"`: re-parse `raw` through the string funnel; non-hosted → unknown |
| string funnel | `domain/source.ts:449-462` | `.json` https parses as `url` (git clone) | new arm between path and URL arms; must self-exclude github.com via `gitHubUrlPath` (D-76-02 first) and must NOT be inside `parseUrlSourceForm`, because `gatedUrlField` (`:187-192`) calls that for plugin object fields |
| `parseAddableSource` | `orchestrators/marketplace/add.ts:545-565` | `S5b` refuses non-github/path/url → `{unsupported source}` | admit `hosted`; return type widens |
| `refreshRecord` | `orchestrators/marketplace/update.ts:409-470` | `else if (source.kind !== "path") throw … unsupported source kind` | add hosted arm; `remoteUrl` (`:415-416`) must be `source.url` for hosted so the `{status} on {url}` frame renders |
| `RecordedSourceKind` / footprint | `orchestrators/marketplace/remove.ts:123`, `:896-900`, `:1163-1173` | `sourceKind` becomes `undefined` → `sources/<name>/` never removed → re-add trips `{stale clone}` | add `"hosted"` to the type, the narrowing, and the `removePath(sourceCloneDir)` condition |
| `buildBlock` | `orchestrators/marketplace/info.ts:71-101` | falls to `else` → `sourceKind: "path", absPath: marketplaceRoot` (wrong label) | project hosted as `{ sourceKind: "url", url: src.url }` (recommended; keeps `notification-types.ts`/json/grammar/schema untouched; renders `url:` + `last_updated:`) |

These consumers need **no edit**. I traced each one:

- `orchestrators/plugin/clone-cache.ts:597-616` `deriveMarketplaceUrl`. Hosted falls through to `return undefined`, so mirror seeding is skipped. That is correct: there is no checkout. (This file is Phase 7's.)
- `orchestrators/plugin/update-flow.ts:191-215` (PUP-2 marketplace sync). Hosted falls into the path-like no-op. `plugin update` reads the stored catalog. See Open Question 3.
- `edge/handlers/tools.ts:146-148` and `edge/handlers/plugin/browse.ts:64-69`. Both call `sourceLogical`, which is forced in `source.ts`.
- `orchestrators/reconcile/plan.ts:145,317,339`. It goes through `samePlannedSource`/`sourceLogical`. The config stores the raw string, so a declared `https://…/marketplace.json` plans against a stored hosted record correctly once the string arm and the object arm both exist.
- `persistence/migrate-config.ts:156`. It reads `.raw`, which hosted has.
- `orchestrators/plugin/install-outcome.ts:577-605` (D-MF-04). It calls `parseAddableSource(rawSource)` and passes the result to `addMarketplaceToState`, so it compiles once those widen. It must get a `cloneDir` back for hosted so WR-07 removes it on rollback.
- `orchestrators/marketplace/list.ts`. It renders no source label.

`orchestrators/import/marketplaces.ts:42-49` maps a Claude `{source:"url",url}` declaration to `src.url (+#ref)`. After this phase, a `.json` URL there becomes hosted through the funnel without any import edit. That is an incidental behavior change for Phase 6 to know about. The same file's github mapping, `src.repo + "@" + ref`, starts handling refs that contain `@` correctly under D-PL5-13.

### Pattern 2: Hosted fetch seam

**Gates to edit** (exact current text):

- `rule-packs/architecture.json` rule `fetch-chokepoint` [VERIFIED: rule-packs/architecture.json, read this session]:
  `"callees": ["fetch", "globalThis.fetch"]`, `"files": ["extensions/pi-claude-marketplace/**"]`, `"exclude": ["extensions/pi-claude-marketplace/domain/github-auth.ts"]`, message `"IL-4 / NFR-5: only domain/github-auth.ts calls fetch, for the Device Flow endpoints."` → add the new module to `exclude` and reword the message. Also reword the `no-network-modules` message, which reads `"… Git traffic goes through platform/git.ts and Device Flow through domain/github-auth.ts."`.
- `eslint.config.js` BLOCK F (`:525-555`): `files` = `orchestrators/**/*.ts`, `domain/**/*.ts`; `ignores: NETWORK_SEAMS` (`:44-79`); `no-restricted-imports` `patterns: [{ regex: "platform/git", message: … }]`; plus `NETWORK_FREE_SYNTAX_SELECTORS` (`:81-106`), which match `ImportExpression[source.value=/platform\/git/]` and `TSImportType Literal[value=/platform\/git/]` [VERIFIED: eslint.config.js read this session]. To ban the new module, add a second `patterns` entry such as `{ regex: "platform/hosted-manifest", message: "NFR-5 / D-PL5-07: …" }`, and widen both syntax selectors to `/platform\/(?:git|hosted-manifest)/`. The regex `platform/git` does **not** match a module named `platform/hosted-manifest-fetch.ts`, so without the new entry nothing is banned.
- `NETWORK_SEAMS` already lists `orchestrators/marketplace/{add,shared,update}.ts`. The production default can live in `marketplace/shared.ts` beside `DEFAULT_GIT_OPS`. `install-outcome.ts` (not a seam) needs no new import, because `addMarketplaceToState` falls back to the default (`args.gitOps ?? DEFAULT_GIT_OPS` precedent, `add.ts:604`).
- `.fallowrc.json` boundaries: the `platform` zone pattern `extensions/pi-claude-marketplace/platform/**` already covers a new file. `orchestrators` may import `platform`, and `platform` may import only `shared`. No change [VERIFIED: .fallowrc.json zones/rules printed this session].
- `test/architecture/gate-targets.ts:149-` `CREDENTIAL_LEAK_TARGETS`: append the new module. PROJECT.md says the leak gate "MUST expand to every new provider file". It is cheap insurance, because a URL with userinfo appears in fetch's own error message (see Pitfall 6).

**Error shapes that reuse every existing classifier.** The shape mapping is my design and is untested; the facts about the existing classifiers are verified:

| Upstream condition | Throw | Existing classifier result |
|---|---|---|
| ECONNREFUSED / ENOTFOUND / EAI_AGAIN | `Error` with `code` copied from `err.cause.code` (fetch rejects `TypeError("fetch failed")` whose `cause.code` is the errno; [VERIFIED: probe: `ECONNREFUSED`, `ENOTFOUND`]) | `classifyGitTransportFailure` → `network unreachable` (`NETWORK_ERRNO_CODES` holds `"ENETUNREACH","ECONNREFUSED","ENOTFOUND","ETIMEDOUT","ECONNRESET","EAI_AGAIN"` [VERIFIED: shared/git-failure-classifiers.ts:27-34]) |
| timeout | catch `name === "TimeoutError"` → `Error` with `code: "ETIMEDOUT"` | `network unreachable` |
| HTTP 401/403 | `Error` with `code: "HttpError"`, `data: { statusCode }` | `classifyGitTransportFailure`: `code === "HttpError" && (statusCode === 401 \|\| statusCode === 403)` → `authentication required` [VERIFIED: :79-82] |
| HTTP 404/410 | same shape | add: `classifyGitHostFailure` → `source missing` (`SOURCE_MISSING_HTTP_STATUSES = new Set([404, 410])` [VERIFIED: :25]); update: `network error` (UPD-11, see Open Question 2) |
| other status | same shape | `network error`; `hostHttpFailureFrame(err, url)` → `` `${status} on ${gitHubWireUrl(url)}` ``, and `gitHubWireUrl` returns a non-github URL unchanged [VERIFIED: shared/github-base-url.ts:84-91] |
| body > 5 MiB, refused redirect, > 5 redirects | a new typed `…UnreadableError` exported by the platform module | needs one `instanceof` arm → `unreadable` in `add.ts::classifyAddError` and in `update.ts::reasonsFromCascadeError` |
| malformed JSON / schema-invalid | none from the fetcher: bytes are written, then `newMarketplaceName` reads them through `loadMarketplaceManifestDocument` | `narrowProbeError` → `unparseable` / `invalid manifest` |

**Upstream redirect rule (read from the 2.1.310 binary this session).** `EVs` refuses a redirect unless the target is same-origin with the start URL (`bfe`: `new URL(a).origin === new URL(b).origin`), or is `https:` and not `Ase(host)`. `Ase` is true for `""`, `localhost`, `*.localhost`, a metadata-host set, `instance-data.*.compute.internal`, IPv4 loopback/link-local/private ranges, and IPv6 `::`, `::1`, `fe80::/10`, `fd00:ec2::254`, and IPv4-mapped forms. The refusal text is `Marketplace catalog redirected to a disallowed URL and was refused — a server-chosen cross-origin redirect must use https:// and must not point at a loopback, link-local, or cloud-metadata host (only a hop that stays on the origin you started from is exempt): <url>`. Size cap `xBt=5242880`, timeout `1e4`, `User-Agent` `Claude-Code-Plugin-Manager`. The catalog `_l.get` call sets **no** `maxRedirects`, while the plugin-archive call sets `maxRedirects:5` [VERIFIED: binary strings at offsets 244677075, 244675256, 237795972]. **Implementation constraint:** `node:net` is banned (`no-network-modules`), so the host-class check must parse `new URL(target).hostname` by hand with string/number checks (no `net.isIP`, no `BlockList`, no DNS).

**Upstream stores the catalog re-serialized** (`Dn(n, _(S, null, 2))`, which is pretty-printed JSON). D-PL5-06 stores "the downloaded bytes". That difference is invisible to users, because `comparisonJson` is `JSON.stringify(parsed)`.

### Pattern 3: Storage + leftover discipline for the hosted add

Mirror `addGitClonedInGuard` (`add.ts:1215-1317`): `stagingDir = await locations.sourcesStagingDir(randomUUID())`, then fetch → `mkdir <staging>/.claude-plugin` → write the bytes to `<staging>/.claude-plugin/marketplace.json` → write the hosted ownership marker → `newMarketplaceName(…)` → `finalDir = await locations.sourceCloneDir(name)` → if it exists, recognize the leftover → `mkdir(dirname(finalDir))` → `rename(stagingDir, finalDir)` → `setOwn(state.marketplaces, name, {…, source, manifestPath: <finalDir>/.claude-plugin/marketplace.json, marketplaceRoot: finalDir, lastSuccessfulManifest: comparisonJson, plugins: {}})`. Keep the MA-9 catch (`cleanupStaging` + `appendLeakToError`, `joinLeaks`).

- **Marker:** the git marker is `ownershipMarkerPath(cloneDir) = path.join(cloneDir, ".git", OWNERSHIP_MARKER_FILE)` with `OWNERSHIP_MARKER_FILE = "pi-claude-marketplace.json"`, content `{ generatedBy: "pi-claude-marketplace" }` [VERIFIED: add.ts:1130-1146]. For hosted, put a marker at the tree root (for example `<dir>/.pi-claude-marketplace-hosted.json`) carrying `{ generatedBy, url }`. Write it with `assertPathInside` + `atomicWriteJson`, as the git marker is written.
- **Recognition:** marker present, `url` equals `source.url` → `cleanupStaging(removalOps, finalDir, …)` → a leak throws `UnremovableLeftoverCloneError`. Marker absent or a different url → `StaleSourceCloneError(finalDir, name)`. Marker unreadable (EACCES/EIO) → `UnreadableSourceCloneError(finalDir, name, "permission-denied" | "unreadable")`. Same shape as `recognizeLeftover` (`:1164-1199`).
- **Do not use `write-file-atomic`.** The rule pack bans it outside `shared/atomic-json.ts` plus three rollback files. Use `fs.writeFile` into the staging dir, then `rename` (NFR-1 tmp+rename).
- **Do not `readFile` the manifest.** `test/architecture/manifest-read-seam.test.ts` fails any `readFile(…marketplace.json)` outside `domain/manifest.ts`. Writing is fine. Validate through `loadMarketplaceManifestDocument` (`newMarketplaceName` already does).
- **De-duplicate with the git body.** fallow dupes fails on every clone group. Extract the shared tail (exists-check → recognize → rename → setOwn → MA-9 catch) into one helper that takes a `recognize` callback, rather than copying `addGitClonedInGuard`.
- **Return `cloneDir`** from `addMarketplaceToState` for hosted, as for github/url (`add.ts:630`). `runAddInGuard` (`:723-735`) and install-outcome's WR-07 cleanup then remove the final dir when the save fails.

### Pattern 4: Hosted refresh (`marketplace update`)

`snapshotAfterRefresh` (`update.ts:526-564`) runs `refreshRecord` inside the lock, saves, and returns `{autoupdate, plugins, changed}`. The cascade (`cascadeAutoupdates`, `:566-630`) runs outside the lock. For hosted, the new arm in `refreshRecord`:

1. Fetch to a staging file under `locations.sourcesStagingDir(uuid)` (same filesystem as `sources/`, D-09).
2. Validate with `loadMarketplaceManifestDocument(stagingFile)`. On failure, throw (the old file stays). `refreshRecord` wraps the failure in `MarketplaceUpdateError` and the existing reasons apply.
3. `rename(stagingFile, recordedManifestPath(record))` (atomic replace), then clean the staging dir.
4. Fall through to the shared tail: `loadMarketplaceManifestDocument(recordedManifestPath(record))` → `changed` via `isDeepStrictEqual(baseline, …)` → `record.lastSuccessfulManifest`, `lastUpdatedAt`.

The `preKey` baseline for hosted comes from `record.lastSuccessfulManifest`, which the add sets, or from `manifestContentKey(record)` (`:347-363`). `cloneAdvanced` stays `false`, so no "Retry the command." hint. Thread the port through `UpdateMarketplaceOptions`, `UpdateAllMarketplacesOptions`, and `RefreshOneArgs` as optional, with the default from `shared.ts`. "Autoupdate" in this codebase is the cascade after `marketplace update` (`cascadeAutoupdates`). `orchestrators/marketplace/autoupdate.ts` only flips the config flag and has "zero git surface" [VERIFIED: autoupdate.ts:1-69]. No other refresh caller exists (`grep refreshGitHubClone|refreshUrlClone|refreshRecord`).

### Pattern 5: Reserved names

- `newMarketplaceName(manifestPath, marketplaces, scope)` (`add.ts:387-407`) has no source today. Add a `source` parameter. Both callers have it: `addGitClonedInGuard` (`:1252`) and `addPathInGuard` (`:1404`). The new hosted body and the repair path pass theirs. Order: `isReservedRecordKey` → reserved refusal → duplicate check. The refusal comes before any state mutation and before the rename.
- Predicate in `domain/name.ts` beside `isReservedRecordKey` (`:66-68`, `return name === "__proto__";` [VERIFIED]). Signature: `reservedMarketplaceNameRefusal(name: string, source: { kind: string; owner?: string }): string | undefined`. Lowercase the name, test set membership, exempt `kind === "github" && owner.toLowerCase() === "anthropics"`, and return the E-1 sentence verbatim (github/url → `The name '<name>' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name.`; path/hosted → `The name '<name>' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization.`). `domain` may import `domain/source.ts` types (same zone).
- Throw a module-local `ReservedMarketplaceNameError extends InvalidMarketplaceManifestError` in `add.ts` (precedent: `ConfigInvalidError extends InvalidMarketplaceManifestError`, `add.ts:533-538`). It then classifies as `invalid manifest` everywhere with no edit: `classifyAddError` → `narrowProbeError` (no `SyntaxError` cause → `"invalid manifest"`), install-outcome's `recordAsInstallFailure` → `InstallMarketplaceAddError("invalid manifest", …)`, and apply/import via the outcome reason.
- `failedAddRow` (`add.ts:818-849`) emits the child row only when `hostFrame !== undefined || hasFetchedUrlCause(error)`. Add `|| error instanceof ReservedMarketplaceNameError`. The child gets `marketplaceSubject: true` and `cause: error`. Subject: `addSubjectName` returns `rawSource` for an invalid manifest (ATTR-07 A2). Keep that, because the reserved name already appears in the cause sentence.
- `bootstrap.ts` adds `rawSource: BOOTSTRAP_SOURCE` = `anthropics/claude-plugins-official` (github kind, owner `anthropics`) and is exempt with no edit [VERIFIED: orchestrators/plugin/bootstrap.ts:96-104]. Its scenarios (`features/plugin/bootstrap.feature:8,28,45`) publish through `publishOfficialMarketplace` under owner `anthropics` [VERIFIED: features/lib/published-marketplace.ts:225-262] and keep proving the exemption.

**Fixtures the refusal breaks** (verified by grep over `test/`, `features/`, `scripts/`). Only `claude-plugins-official` and `anthropic-plugin-directory` occur; `agent-skills` appears only in `scripts/init.sh` as a skill-install name:

| Where | What it does | Breaks? | Fix |
|---|---|---|---|
| `features/plugin/git-source.feature:422,440`; `install-dependencies.feature:390,419,443`; `update-dependencies.feature:324,354`; `apply.feature:1183` | `Given the marketplace "anthropic-plugin-directory" is published as a dir source` then `… is added to the project scope`, which runs `marketplace add <dir>` and asserts `severity === "info"` (`features/step_definitions/marketplace/publishing.steps.ts:141-151`) | **Yes, 8 scenarios** | Publish it under the git host's `anthropics` owner as a github source. Generalize `publishOfficialMarketplace` (today it throws for any name except `claude-plugins-official`) into a helper that publishes a named marketplace under `anthropics`, with a new step such as `the marketplace "<name>" is published by the anthropics organization`. Its plugins keep coming from git repositories. These files are shared with Phases 2, 3, and 4, so coordinate or land the change in one small commit. |
| `test/e2e/_helpers.ts:166` | `marketplace add ${env.upstreamRoot}` (a path checkout of `anthropics/claude-plugins-official`, manifest named `claude-plugins-official`) | **Yes**: every e2e using `installTarget`; the CI `e2e-tests` job (not in `npm run check`) | Rewrite the checkout's manifest `name` to a non-reserved name before the add and update `test/e2e/_targets.ts` (`marketplace: "claude-plugins-official"`) plus `install-soft-deps.test.ts:143,187`. Or add via `anthropics/claude-plugins-official`, which loses the pinned SHA. Planner/user choice (Open Question 4). |
| `test/e2e/import-command.test.ts`, `test/architecture/config-state-consistency.test.ts`, `test/orchestrators/plugin/bootstrap.test.ts`, `test/edge/handlers/plugin/bootstrap.test.ts`, `test/edge/register.test.ts:2015-2125`, `test/orchestrators/marketplace/add.test.ts:461,509,550` | add via `anthropics/claude-plugins-official` or `https://github.com/anthropics/…` (normalized to github) | No (exempt) | — |
| `test/orchestrators/reconcile/apply.test.ts:4634`, `install-flow.test.ts:16204`, `install-outcome.test.ts:1211`, `enable-disable.test.ts:1978`, `fetch.test.ts:1313`, `info.test.ts:373`, `test/integration/hooks-dispatch-end-to-end.test.ts:69,109` | seed `state.json` directly, no add | No | — |
| `test/architecture/catalog-uat/fixtures/*` | render-only payload fixtures | No | — |

### Pattern 6: ROWID (bare marketplace id)

`rowId` already honors the marker (`shared/notification-json.ts:456-462`):

```ts
function rowId(row: ResolvedRow, mp: ResolvedMarketplace): string {
  if ("marketplaceSubject" in row || row.name.includes("@")) {
    return row.name;
  }

  return `${row.name}@${mp.name}`;
}
```

Builders to change:

1. `marketplaceFailureRows` (`marketplace/shared.ts:1000-1023`): add `marketplaceSubject: true` to the child. That covers `remove.ts:1097`, `autoupdate.ts:279` (no edit in autoupdate.ts), and `add.ts:889`. `surfaceLockHeldAdd` (`add.ts:883-902`) then drops `block.plugins.map((row) => ({ ...row, marketplaceSubject: true as const }))`.
2. `refreshOneMarketplace`'s own `failedRow` (`update.ts:763-770`): add the marker.
3. `info.ts::buildManifestFailureMessage` (`:158-177`) builds a **`plugin-info`** message. Its wire id comes from `wirePluginInfoRow` (`shared/notification-json.ts:524-528`, `` id: `${plugin.name}@${message.marketplaceName}` ``), **not** `rowId`. A bare id there needs an optional `marketplaceSubject?: true` on `PluginInfoRowBase` (`shared/notification-types.ts:1087`, a file Phase 3 also edits) and a branch in `wirePluginInfoRow`, with a new case in `test/shared/notification-json.test.ts` for coverage. Name equality cannot stand in for the marker, because a plugin may share its marketplace's name. If the planner keeps both shared files out of scope, `info.feature:131,145,162` and `test/edge/register.test.ts:679` stay `tools@tools`/`demo@demo`, and D-PL5-12's info clause is unmet.

Pins to change [VERIFIED: python scan this session]: `features/marketplace/autoupdate.feature:236,253,528`; `file-source-update.feature:107`; `git-source.feature:210,242`; `info.feature:131,145,162`; `remove.feature:212,354,371,609`; `state-lock.feature:23,53,83,113`; `update.feature:127,928,1004`; `url-source-update.feature:19,44`; `test/edge/register.test.ts:679`; `test/orchestrators/marketplace/update.test.ts:3572`. Owner tests that deep-compare rows will also change: `test/orchestrators/marketplace/shared.test.ts:2326-` (`marketplaceFailureRows`) and the remove/update/autoupdate/add tests that compare notify payload objects.

Not on D-PL5-12's list, but the same id shape:

- `features/plugin/import.feature:515` `fixtures@fixtures` (import's own `setMarketplaceStatus` failure block, `orchestrators/import/execute.ts:497-517`, a Phase 6 file).
- `features/plugin/autoapply.feature:225,226,418,531,568` and `configuration.feature:77,91,92,115` (`claude-plugins.local.json@claude-plugins.local.json`, file-subject rows from `autoapply-setting.ts`, not marketplace rows).

See Open Question 5.

Docs: `docs/json-output.md:600` (cascade row `id`: "Qualified address, `<name>@<marketplace>` … When a failed `marketplace add` has a child row … its id is that name alone.") and `:681` (plugin-info row `id`: "Qualified address, `<name>@<marketplaceName>`."). `test/architecture/json-output-docs.test.ts` executes the guide's fenced examples with `jq`, so keep the example fences valid.

### Pattern 7: `market` alias

Router (`edge/router.ts`):

- `TOP_LEVEL_SUBCOMMANDS` (`:86-106`): add `"market"`. Completions import it, so first-token completion offers `market`, like `ls`.
- `selectClaudePluginRoute` switch (`:280-291`): `case "marketplace": case "market": return selectMarketplaceRoute(rest, handlers);`. The commandId stays `"marketplace <verb>"`, the canonical JSON identity.
- `TOP_LEVEL_USAGE` (`:148-167`): add `market` to the header spelling list and `(alias: market)` to the `marketplace <…> ...` line, matching how `list … (alias: ls)` is shown.
- `market help` already works through `selectMarketplaceRoute`'s `"help"` case. `help market` (topic) is `edge/handlers/plugin/help.ts:34` `if (topic === "marketplace")`, plus `isMarketplaceHelpTopic` (`router.ts:301-304`) for the commandId. Whether to add it is Open Question 6.

Completions (`edge/completions/provider.ts`): four spellings of `"marketplace"`. `CATALOG_ALIASES` + `catalogVerbForPositionals` (`:89-100`, flag completions); `promoteExactSubcommandToken` (`:158-172`, `tokens[0] === "marketplace"`); `marketplaceNameWanted` (`:174-183`); Branch 3 (`:310-316`). The cheapest correct change normalizes the head once (`market` → `marketplace`) before these checks. That avoids four parallel edits and a fallow clone group.

Gates and pins that change:

- `test/architecture/flag-catalog-drift.test.ts:210-232`: `routerHeads = [...TOP_LEVEL_SUBCOMMANDS.filter((verb) => verb !== "marketplace"), ...]` must also filter `"market"`. `COMPLETION_HEADS` (`:120-125`) should gain `market <verb>` alias heads so flag completion after `market add -` is proven.
- `features/plugin/help.feature:13,21,39`, `test/edge/router.test.ts:98,115`, `test/edge/register.test.ts:148,165`.
- `features/marketplace/help.feature` is unchanged (MARKETPLACE_USAGE is unchanged).

### Pattern 8: Shorthand (D-PL5-13)

Current code (`domain/source.ts:411-435`): the `#` arm runs only when no `@` precedes the first `#`. Otherwise `const atIdx = raw.lastIndexOf("@")` splits at the **last** `@`. Replace that with one first-delimiter split: `const idx = first index of '@' or '#'`. Left half → `parseOwnerRepo`. Ref = rest. An empty ref after `@` → unknown (unchanged). An empty ref after `#` → no ref (D-MF-07, unchanged). Existing cases stay green: `acme/tools#x@y` → ref `x@y`; `acme/tools@v1#x` → ref `v1#x` (`test/domain/source.test.ts:103-110`). No existing test or feature pins a multi-`@` shorthand [VERIFIED: regex scan this session]. Side effect: `a@b/c@d` used to parse as owner `a@b`. It now splits at the first `@`, the left half `a` fails `parseOwnerRepo`, and the result is `unknown` (parity with upstream's regex). Update the doc comments citing D-76-04 in `source.ts:405-410` and `:464-469` (`orchestrators/import/marketplaces.ts:51` cites it too, a Phase 6 file).

Scenario: in `features/marketplace/github-source.feature`, publish `tools` as a github source, add a branch `a@b` (existing step `the branch {string} of the marketplace {string} has the description {string}`), run `marketplace add acme/tools@a@b`, and assert the request log `GET /acme/tools.git/info/refs?service=git-upload-pack 200` / `POST /acme/tools.git/git-upload-pack 200` plus the info description or the recorded ref. Before the change the clone targets `/acme/tools@a.git` → 404, so the scenario fails without it.

### Pattern 9: MKT-07

- **D-PL5-16:** `handleAddFailure` (`add.ts:933-981`). Replace `reason: "unparseable"` (`:952-957`) with `narrowProbeError(withoutCleanupLeaks(err))` (`withoutCleanupLeaks` is in `shared/errors.ts`; `classifyOrchestratorThrow` uses the same pair, `reconcile/apply-outcomes.ts:771`). `add.ts` cannot import `classifyOrchestratorThrow`, because reconcile → marketplace is the wrong direction. Tests pinned to the old token: `test/orchestrators/marketplace/add.test.ts:3001`, `:3125` (that one also pins `prototypeReads, 3`, an `instanceof` count that the extra `narrowProbeError` call changes; LCCODE-01 already flags `:3063` `prototypeReads, 6`). Update the doc comment on `AddMarketplaceOutcome` (`:156-165`), which says the catch-all is `unparseable`.
- **D-PL5-18 (EISDIR):** today `readManifestDocument` rethrows a raw `EISDIR` (narrowProbeError → `unreadable` ≠ `permission denied`). `errorAddReason` (`:335-348`) maps only `ENOENT|ENOTDIR`, then `classifyGitSourceAccessFailure` → `undefined` → a standalone **raw rethrow** [VERIFIED by reading]. `narrowCascadeFailure` (`marketplace/shared.ts:838-876`) holds the switch: `EACCES|EPERM → permission denied`, `ENOENT|ENOTDIR → source missing`, `EBADF|EIO|EISDIR → unreadable`. Recommended de-duplication: extract that errno switch into one exported helper in `marketplace/shared.ts` (for example `fsErrnoReason(code)`), use it in `narrowCascadeFailure`, and have `errorAddReason` use its `source missing` and `unreadable` results. **Caveat:** do not apply its `permission denied` result to every add error. MPA-02 (`add.ts:350-355`) deliberately confines `permission denied` to the manifest read: "a refused state or config write keeps its own error". Scenario: a dir marketplace whose `.claude-plugin/marketplace.json` is a directory → `(failed) {unreadable}` (new `Given` in `features/step_definitions/marketplace/add.steps.ts`, next to the existing `the manifest of the marketplace {string} to add cannot be read`).
- **D-PL5-17 (missing clone):** `redeclareRecordedSource` (`:479-516`) returns `{name, alreadyAdded: true}` or writes the config, and never looks at disk. Add, before both branches, for the single matched record:
  - `github|url|hosted` and `!(await pathExists(record.marketplaceRoot))` → repair. Re-materialize through the same staging body with an "expected name" mode: skip the MA-8 duplicate check for that name, keep the reserved check, and require `derivedName === name` (else throw a typed error that `classifyAddError` maps to `"source mismatch"`; the record stays untouched). Replace the record's `manifestPath`/`marketplaceRoot`/`lastSuccessfulManifest`/`lastUpdatedAt`, keep `plugins`, save, write the config declaration if the target layer lacks it, then report `(added)` and settle.
  - `path` and `!(await pathExists(record.manifestPath))` → throw an `ENOENT`-coded error → `{source missing}` (via `errorAddReason`).

  The repair needs `gitOps`, auth, `removalOps`, and the hosted port inside the lock. `runAddInGuard` (`:643-739`) already has them through `opts` and `addMarketplaceToState`'s argument bundle. Scenario: add a url (or github) marketplace, install a plugin, delete `sources/tools/` (new `Given` in the add verb module), re-run the add → `(added)`, the installation record still holds the plugin, and the request log shows one clone.
- **D-PL5-19 (no-op status) without an unreachable branch:** `runAddOutcome` (`:1040-1122`) is declared `Promise<AddMarketplaceOutcome>` (the WR-01 compile proof). Widening it to include a no-op status and then filtering in `addMarketplace` creates a branch that orchestrated mode can never reach. That fails 100% branch coverage, and `!`/`as` are unavailable. Recommended: make the no-op unrepresentable in orchestrated mode by construction. Either split the body into standalone and orchestrated entry points that share a guard body, or give `runAddInGuard` a `redeclare` callback that the orchestrated path does not pass (its result type is then `never`). `bootstrap.ts` reads no outcome (standalone returns `undefined`), so Phase 2's file is untouched.

### Pattern 10: Exhaustive fold (CASCADEAX-01)

- Legality: `orchestrators/marketplace/remove.ts` → `orchestrators/plugin/shared.ts` is legal. BLOCK C forbids a marketplace file importing only `PLUGIN_LEDGERS` (`install-flow`, `update-flow`, `uninstall`, `reinstall-flow`, `enable-disable`), and `plugin/shared.ts` is not a ledger [VERIFIED: eslint.config.js:489-509]. fallow: both are in the `orchestrators` zone. Cycle: `npx fallow trace --path …/plugin/shared.ts …/marketplace/remove.ts` → `reachable: no`, `No import path` [VERIFIED: run this session]. `remove.ts` already imports `../plugin/clone-gc.ts` and `../plugin/dependency-index.ts`. No need to move the fold.
- Shape: `const DROPPED_AXIS_FIELD = { skills: "skills", commands: "prompts", agents: "agents", hooks: "hooks", mcpServers: "mcpServers", workflows: "workflows" } as const satisfies Record<keyof UnstageOutcome["dropped"], keyof PluginInstallRecord["resources"]>`. Iterate over a typed key list, not `Object.entries`, which loses the key type. `UnstageOutcome.dropped` axes [VERIFIED: marketplace/shared.ts:432-439]: `skills`, `commands`, `agents`, `hooks`, `mcpServers`, `workflows`. Resource fields [VERIFIED: persistence/state-io.ts:144-155]: `skills`, `prompts`, `agents`, `mcpServers`, `hooks`, `workflows`. `plugin/shared.ts` already imports from `../marketplace/shared.ts` (`:54`), so a type import of `UnstageOutcome` adds no edge.
- `remove.ts:444-461` (the five-axis copy, no `hooks`) becomes `applyPartialCascadeFold(plugin, outcome.dropped)` inside the existing `!(cause instanceof AgentsUnstageFailureError)` guard. Behavior change: a partially failed remove now also subtracts dropped hooks from the kept record. A retry is idempotent either way, so this is not user-visible. A unit case in `test/orchestrators/marketplace/remove.test.ts` proves it; no scenario (justify it in the plan).

### Anti-Patterns to Avoid

- **Putting the `.json` arm inside `parseUrlSourceForm`.** `gatedUrlField` routes plugin `{source:"url",url}` object fields through it, and D-PL5-04 forbids classifying those.
- **A new `sourceKind: "hosted"` on `MarketplaceInfoMessage`.** It drags in `notification-types.ts`, `notification-json.ts`, `notification-grammar.ts`, and the published schema. Project hosted info as `url`.
- **A third errno ladder** in `add.ts` (D-PL5-18 says one shared mapping).
- **Importing `node:net`/`node:dns`** for the redirect host check. The rule pack bans them.
- **Copy-pasting `addGitClonedInGuard`** for hosted. fallow dupes fails the gate.
- **A test-only `__` member** on options to swap the fetcher. `no-test-only-production-surface` forbids it. Use a normal optional port, as `gitOps` is.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Status/errno → reason for hosted fetch | a hosted-specific ladder | make the fetcher throw isomorphic-git-shaped `HttpError` / errno-coded errors; reuse `classifyGitSourceAccessFailure`, `hostHttpStatus`, `hostHttpFailureFrame`, update's `transportReason` | one classifier family (GITERR-01 direction, Phase 7) |
| Manifest parse/validate of downloaded bytes | parse in memory | write to staging, then `loadMarketplaceManifestDocument` | NFR-8 manifest-read seam gate; one validator |
| Credential redaction in causes | ad-hoc stripping | `shared/redact-credentials.ts` (already applied at every presentation site, PMOD-04) | userinfo → `***@` |
| Atomic placement | in-place writes | staging dir + `rename` (same FS: `sources-staging/` is a sibling of `sources/`, D-09) | NFR-1 |
| Leftover cleanup | `rm -rf` | `cleanupStaging(removalOps, dir, label)` + `appendLeakToError` / `UnremovableLeftoverCloneError` | MA-9 / MA-14 discipline |
| Fake HTTP in unit tests | a loopback server per case | `t.mock.method(globalThis, "fetch", async () => new Response(…))` | project rule (boundaries.md:17) |

## Common Pitfalls

### Pitfall 1: The hosted record makes `state.json` unloadable
**What goes wrong:** `normalizeStoredSource` throws for an object with `kind: "hosted"`, so every command in that scope fails.
**How to avoid:** add the arm together with the domain kind. A `state-io.test.ts` round-trip case (save a hosted record, then load it) catches this.
**Warning signs:** any scenario after a hosted add fails at load with `has malformed source object`.

### Pitfall 2: The reserved-name rule breaks 8 scenarios owned by other phases, and the e2e job
See the Pattern 5 table. Land the fixture migration in the same wave as the refusal, or the wave's `npm run check` (which includes `test:cucumber`) is red. The e2e job runs only in PR CI.

### Pitfall 3: `flag-catalog-drift` gate after adding `market`
`routerHeads` includes every `TOP_LEVEL_SUBCOMMANDS` entry except `marketplace`. A new top-level `market` with no completion head fails the gate's `deepStrictEqual`.

### Pitfall 4: Manifest cache keyed by (mtimeMs, size)
`createManifestCache` keys by path + `(mtimeMs, size)` (`domain/manifest.ts:151`). A hosted refresh that renames a same-size file into place within one mtime tick could serve the cached parse. On ext4 with sub-ms mtimes this is unlikely, and a fresh write gets a new mtime. If a unit test refreshes to a same-size catalog and asserts `changed`, make the sizes differ or check that the cache sees it.

### Pitfall 5: `fetch` rejects `bad port`s
undici refuses some ports (`Error: bad port`, for example port 1). The stand-in binds an ephemeral port (`listen(0)`; Linux range 32768-60999), which never hits the blocked list. Never hard-code a low test port.

### Pitfall 6: Userinfo in a hosted URL
`fetch("https://u:p@host/x.json")` throws `TypeError: Request cannot be constructed from a URL that includes credentials: https://u:p@host/x.json` [VERIFIED: probe]. The message embeds the credentials. Presentation redacts userinfo (`shared/redact-credentials.ts`), but the fetch module should refuse userinfo up front with a typed error whose message names the URL with userinfo stripped, and the state record keeps `raw` verbatim (as url sources do today). Add the module to `CREDENTIAL_LEAK_TARGETS`.

### Pitfall 7: Orchestrated catch-all tests pin `instanceof` counts
`add.test.ts:3125-3127` asserts `prototypeReads === 3`. Calling `narrowProbeError` adds reads. Update the count deliberately; do not delete the assertion.

### Pitfall 8: Shared-file merge contention
`marketplace/add.ts` (Phase 2: dependency step), `marketplace/{shared,update,remove}.ts` (Phase 7: git classification and clone cleanup), `plugin/shared.ts` (Phase 1: warning functions), `dependency-declaration-read.ts` (Phase 2), `plugin/info.ts` (Phases 3 and 7), `notification-types.ts` (Phase 3), and four feature files (Phases 2, 3, 4). Keep each edit to the named function or arm. Prefer new functions to rewriting existing ones in place.

### Pitfall 9: A scenario that does not prove the network boundary
D-PL5-08 says `list`/`info`/`install` from a hosted marketplace stay offline, apart from plugin clones on a cache miss. Use `Then the git host receives these requests:` (or `receives no request`) after each `When`. The hosted GET appears in the log once the stand-in serves it.

## Code Examples

### Hosted string arm (placement; illustrative)
```ts
// domain/source.ts -- the arm order is load-bearing (D-76-02 github first, D-PL5-04)
export function parsePluginSource(raw: unknown): ParsedSource {
  // ...
  return (
    parsePathSourceForm(raw) ??
    parseHostedManifestForm(raw) ?? // https, not github.com, path (before ? and #) ends ".json"
    parseUrlSourceForm(raw) ??
    parseShorthandSourceForm(raw)
  );
}
```
`gitHubUrlPath` (`:618-640`) already returns `undefined` for a non-github https URL, so `parseHostedManifestForm` returns `undefined` when `gitHubUrlPath(raw) !== undefined`.

### Fetch-mock unit-test pattern (project rule)
```ts
// Source: .agents/skills/typescript-unit-tests/rules/boundaries.md:17; precedent test/domain/github-auth.test.ts:110
t.mock.method(globalThis, "fetch", async () =>
  new Response('{"name":"tools","owner":{"name":"x"},"plugins":[]}', { status: 200 }),
);
```

### Proposed NFR-5 amendment text (D-PL5-08), for AGENTS.md line 58 and PROJECT.md
> … Network is required only for git-source and hosted-manifest `marketplace add`/`update` … A hosted-manifest marketplace (an `https://` URL to a `.json` catalog) downloads its `marketplace.json` on `marketplace add` and `marketplace update`, on an `apply` that adds or refreshes one, and on a project-scope install that adds it to the project through the `marketplace add` code (D-MF-04); installing from it reads the stored copy (D-PL5-08). …

The D-MF-04 clause is not in D-PL5-08's text, but the install-time add downloads too. See Open Question 1.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Shorthand split at last `@` (D-76-04) | first `@` or `#` (D-PL5-13, Claude Code `^([^#@]+)(?:[#@](.+))?$`) | this phase | `acme/tools@a@b` = ref `a@b`; import's `repo@ref` composition becomes correct for refs with `@` |
| `https://…/x.json` cloned as git | downloaded as a hosted catalog | this phase | adds network on add/update for that kind |
| marketplace failure row id `<mp>@<mp>` | bare `<mp>` | this phase | published JSON payload change (CHANGELOG) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A typed `HttpError`-shaped error (`code: "HttpError"`, `data.statusCode`) thrown by the new module flows through `classifyGitSourceAccessFailure`/`hostHttpStatus` unchanged | Pattern 2 | Low: the classifiers duck-type exactly those fields (read this session); worst case, a small adapter |
| A2 | Projecting hosted info as `sourceKind: "url"` is acceptable to the user | Pattern 1 | A hosted catalog shows `url:` like a git url source; a distinct kind would touch Phase 3's file and the schema |
| A3 | Upstream's catalog download follows up to axios's default redirect count, not 5 | Pattern 2 | The 2.1.310 binary passes no `maxRedirects` for the catalog (it passes 5 for plugin archives); D-PL5-07's "at most 5" may be a small divergence, harmless |
| A4 | The MKT-08 hooks-axis change is not user-visible, so a unit test suffices | Pattern 10 | If the planner judges it visible, a scenario needs a partial-failure remove, which is hard to stage |
| A5 | `.json` suffix match is case-sensitive | Pattern 1 | `https://x/M.JSON` would clone as git; trivial to widen |
| A6 | The hosted ownership marker at the tree root (not inside `.claude-plugin/`) does not collide with any reader | Pattern 3 | Readers open only `.claude-plugin/marketplace.json` and plugin dirs; low |

## Open Questions

1. **D-MF-04 install-time add of a hosted marketplace downloads over the network.** A project-scope install that needs a user-only hosted marketplace runs `addMarketplaceToState`, which fetches. D-PL5-08's text names add/update/apply only. Recommendation: include it in the NFR-5 wording (one clause), with no code change.
2. **The update-time 404 token.** D-PL5-10 lists "the add's source-access tokens" (404/410 → `source missing`). `marketplace update` maps a git host's 404 to `network error` by design (UPD-11), and the shared path gives hosted the same. Recommendation: keep each verb's existing rule (add: `source missing`; update: `network error` + frame) and confirm with the user. Otherwise update needs a hosted special case.
3. **`plugin update` (PUP-2) does not refresh a hosted catalog.** `update-flow.ts` syncs git marketplaces only, and that file is Phase 7's. Hosted falls into the no-op, so a plugin update reads the stored catalog. Recommendation: accept it and record it; widening it means a Phase 7 file edit and an NFR-5 wording change.
4. **The e2e helper path-adds `claude-plugins-official`.** Choose between rewriting the temp checkout's manifest name (deterministic, keeps the pinned SHA) and adding from GitHub (`anthropics/claude-plugins-official`, which loses the SHA pin). Recommendation: rename in the temp checkout.
5. **ROWID scope beyond D-PL5-12's list.** Import's marketplace failure block (`import.feature:515`, a Phase 6 file) also emits `<mp>@<mp>`. Recommendation: leave it to Phase 6 and file it in the SUMMARY. The autoapply/config file-subject rows are not marketplace rows and are out of scope.
6. **`help market`.** D-PL5-11 covers `market help`. Should `/claude:plugin help market` also show the marketplace topic? Recommendation: yes, a one-line edit in `help.ts` and `isMarketplaceHelpTopic` ("`market` works wherever `marketplace` does"). Flag it for the planner.
7. **CHANGELOG / PROJECT.md / docs ownership.** D-PL5-12 asks for a CHANGELOG line, and D-PL5-08 for PROJECT.md text, but Phase 11 owns `CHANGELOG.md`, `.planning/PROJECT.md`, and `docs/**` (except `docs/json-output.md`, which is on Phase 5's line). Recommendation: edit `docs/json-output.md` and the AGENTS.md NFR-5 line here, and record the CHANGELOG bullets and the PROJECT.md decision rows (D-PL5-01..19, PRUNE-GUARD-MR-01 closed as D-PL5-14, new MKTNAME-01) in the phase SUMMARY for Phase 11. `docs/output-catalog.md` states for the new rows are likewise deferred.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node | everything | ✓ | v26.12.1 (also `/usr/bin/node` v22.22.2) | — |
| npm | scripts | ✓ | 11.20.0 | — |
| git + `git-http-backend` | cucumber git host | ✓ | 2.56.0, `/usr/libexec/git-core/git-http-backend` | — |
| openssl | stand-in certificate | ✓ | 4.1.0 | — |
| `@cucumber/cucumber` | scenarios | ✓ | 13.3.0 | — |
| fallow | `npm run fallow` | ✓ | 3.35.0 | — |
| Network to github.com | e2e only (CI) | not probed | — | e2e is outside `npm run check` |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit/architecture/integration) + `@cucumber/cucumber` 13.3.0 (behavior) |
| Config file | `package.json` scripts; `cucumber.json` (`features/support/**/*.ts`, `features/step_definitions/**/*.steps.ts`, `order: random`, `parallel: 8`) |
| Quick run command | `node --test <owner test>`; one pair's coverage: `npm run test:coverage:direct -- <source-or-test-path>`; one scenario: `npx cucumber-js --name '<title>'`; one feature: `npx cucumber-js features/marketplace/<file>.feature` |
| Full suite command | `npm run check` (includes `check:features`, `test:cucumber`, all direct-coverage pairs) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MKT-01 | reserved predicate + sentences per kind; github `anthropics` exempt (case-folded) | unit | `node --test test/domain/name.test.ts` | ✅ (new cases) |
| MKT-01 | add refuses before mutation, child row with cause, `invalid manifest`; orchestrated reason | unit | `node --test test/orchestrators/marketplace/add.test.ts` | ✅ |
| MKT-01 | `Adding a marketplace whose manifest declares a reserved name fails with Claude Code's sentence` (Outline: dir/file untagged, `@url`, `@github` rows) | scenario | `npx cucumber-js features/marketplace/reserved-name.feature` | ❌ Wave 0 |
| MKT-01 | bootstrap still adds the official marketplace | scenario | `npx cucumber-js features/plugin/bootstrap.feature` | ✅ |
| MKT-02 | hosted parse/object round trip/`samePlannedSource`/`sourceLogical`; github.com `.json` stays github; plugin url object not hosted | unit | `node --test test/domain/source.test.ts` | ✅ |
| MKT-02 | stored hosted record loads | unit | `node --test test/persistence/state-io.test.ts` | ✅ |
| MKT-02 | fetcher: timeout, cap, redirect policy, status/errno shapes, userinfo refusal | unit | `node --test test/platform/<hosted-module>.test.ts` | ❌ Wave 0 (new pair) |
| MKT-02 | hosted add/leftover/marker; update refresh/swap/no-op; remove deletes `sources/<n>/`; info `url:` label | unit | `node --test test/orchestrators/marketplace/{add,update,remove,info}.test.ts` | ✅ |
| MKT-02 | compile-forced plugin-side arms | unit | `node --test test/domain/{plugin-resolver,version}.test.ts test/orchestrators/plugin/{dependency-declaration-read,info}.test.ts` | ✅ |
| MKT-02 | add from a hosted URL (request log shows one GET); install a git plugin from it (no catalog request); update after a changed catalog → `(updated)`; 404 → `source missing`; list/info make no request | scenario | `npx cucumber-js features/marketplace/hosted-source.feature` | ❌ Wave 0 |
| MKT-02 | stand-in serves static catalog, resets, arms | architecture | `node --test test/architecture/https-git-host-server.test.ts` | ✅ (new cases) |
| MKT-03 | `market` dispatch, usage, help text | unit | `node --test test/edge/router.test.ts test/edge/handlers/plugin/help.test.ts` | ✅ |
| MKT-03 | completions after `market` | unit | `node --test test/edge/completions/provider.test.ts` | ✅ |
| MKT-03 | router/catalog inventory gate | architecture | `node --test test/architecture/flag-catalog-drift.test.ts` | ✅ (edit) |
| MKT-03 | `market add` / `market list` work like `marketplace` | scenario | `npx cucumber-js features/marketplace/market-alias.feature` (or rows in an existing feature) | ❌ Wave 0 |
| MKT-04 | bare id on failure rows; plugin-info marker | unit | `node --test test/orchestrators/marketplace/shared.test.ts test/shared/notification-json.test.ts` | ✅ |
| MKT-04 | pinned cells now bare | scenario | `npx cucumber-js features/marketplace/{remove,update,autoupdate,info,state-lock,file-source-update,url-source-update,git-source}.feature` | ✅ (edit) |
| MKT-05 | first-`@`/`#` split table | unit | `node --test test/domain/source.test.ts` | ✅ |
| MKT-05 | `acme/tools@a@b` clones `acme/tools` at `a@b` | scenario | `npx cucumber-js --name '<title>'` in `features/marketplace/github-source.feature` | ✅ (new scenario) |
| MKT-06 | decision only (D-PL5-14) | — | none (existing remove scenarios unchanged) | — |
| MKT-07 | catch-all → narrowProbeError; EISDIR/EIO/EBADF → unreadable; repair; path manifest gone → source missing; no-op status | unit | `node --test test/orchestrators/marketplace/add.test.ts test/orchestrators/marketplace/shared.test.ts` | ✅ |
| MKT-07 | dir manifest is a directory → `{unreadable}`; re-add after clone deleted → `(added)`, plugin record kept | scenario | `npx cucumber-js features/marketplace/failed-add.feature` (or add.feature) | ✅ (new scenarios) |
| MKT-08 | axis-table fold (hooks included); remove partial failure subtracts hooks | unit | `node --test test/orchestrators/plugin/shared.test.ts test/orchestrators/marketplace/remove.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** owner tests + `npm run test:coverage:direct -- <changed source>`. The pre-commit hook runs `check:commit` (static + unpaired + staged pairs).
- **Per wave merge:** `npm run check` on the combined tree (includes cucumber).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`. Before the PR, the CI e2e job covers the `_helpers.ts` fix.

### Wave 0 Gaps
- [ ] `test/platform/<hosted-module>.test.ts`, the pair for the new platform module
- [ ] `features/lib/https-git-host/server.ts` static-catalog route, plus `features/lib/published-marketplace.ts` hosted publication and anthropics-owner publication, plus their steps
- [ ] `features/marketplace/hosted-source.feature`, `reserved-name.feature`, the `market` alias feature (names are the planner's; `Feature: Marketplace <capability>`)
- [ ] Migrate the 8 `anthropic-plugin-directory` dir-source scenarios and `test/e2e/_helpers.ts`

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no credentials sent, D-PL5-07) | — |
| V4 Access Control | yes (reserved names = trust boundary for "official" identity) | `domain/name.ts` predicate, github `anthropics` exemption only |
| V5 Input Validation | yes | `MARKETPLACE_VALIDATOR` via `loadMarketplaceManifestDocument`; https-only parse; userinfo refusal |
| V6 Cryptography | yes (TLS) | Node default certificate verification; never disable; tests trust via `NODE_EXTRA_CA_CERTS` |
| V12 Files/Resources | yes | 5 MiB cap; staging + rename; `assertPathInside` for marker; `sourceCloneDir` symlink refusal (PS-1) |
| V13/SSRF | yes | manual redirect loop: ≤5 hops, https only, cross-origin loopback/link-local/metadata refused (upstream `EVs`/`Ase`) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Redirect to cloud metadata / localhost | Information disclosure | per-hop host-class check without `node:net` |
| Oversized catalog | Denial of service | stream read with byte cap; abort past 5 MiB |
| Impersonating an official marketplace by name | Spoofing | reserved-name refusal (D-PL5-01) |
| Credential in URL leaked to rows/logs | Information disclosure | refuse userinfo; `redact-credentials.ts` at presentation; `CREDENTIAL_LEAK_TARGETS` |
| Partial write leaves a poisoned catalog | Tampering | validate the staged bytes before an atomic rename (D-PL5-09) |

## Sources

### Primary (HIGH confidence)
- Codebase files read this session (paths and lines cited inline): `domain/source.ts`, `domain/name.ts`, `domain/manifest.ts`, `domain/clone-key.ts`, `orchestrators/marketplace/{add,shared,update,remove,info,autoupdate}.ts`, `orchestrators/plugin/{shared,bootstrap,install-outcome,clone-cache,update-flow}.ts`, `orchestrators/import/{marketplaces,execute}.ts`, `orchestrators/reconcile/{apply,apply-outcomes}.ts`, `persistence/state-io.ts`, `shared/{probe-classifiers,git-failure-classifiers,notification-json,notification-types,github-base-url,redact-credentials}.ts`, `edge/router.ts`, `edge/completions/provider.ts`, `edge/handlers/plugin/help.ts`, `edge/handlers/marketplace/add.ts`, `rule-packs/architecture.json`, `eslint.config.js`, `.fallowrc.json`, `package.json`, `cucumber.json`
- `npx tsc` with a scratch hosted kind (6 errors listed); `npx fallow trace` (no import path plugin/shared → marketplace/remove)
- Node probes: fetch + `NODE_EXTRA_CA_CERTS` against a self-signed loopback server (Node 22.22.2 and 26.12.1); `redirect: "manual"`; errno shapes; userinfo TypeError
- Claude Code 2.1.310 binary: `$ut` (hosted download), `EVs` (redirect policy), `Ase` (host class), `xBt=5242880`
- Project skills: cucumber (`SKILL.md`, `rules/{layout,features,steps,world-and-stand-ins}.md`), typescript-unit-tests (`SKILL.md`, `rules/{pairing-and-design,boundaries}.md`), local-verification (`SKILL.md`, `rules/{commands,gates}.md`)

### Secondary (MEDIUM confidence)
- CONTEXT.md upstream evidence E-1..E-6 (collected in discuss-phase from the same binary and code.claude.com docs)

### Tertiary (LOW confidence)
- axios default `maxRedirects` (A3), from training knowledge

## Metadata

**Confidence breakdown:**
- Code map and blast radius: HIGH (typechecked and read)
- Fetch seam and stand-in design: MEDIUM (primitives verified on Node; module not yet written)
- Pitfalls: HIGH for gates and fixtures (read and grepped); MEDIUM for the manifest-cache timing

**Research date:** 2026-10-26
**Valid until:** about 2026-11-09. Eight sibling phases are editing shared files, so re-check the cited line numbers before execution.
