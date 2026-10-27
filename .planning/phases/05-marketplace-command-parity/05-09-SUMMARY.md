---
phase: 05-marketplace-command-parity
plan: 09
subsystem: marketplace
tags: [marketplace-update, marketplace-remove, marketplace-info, hosted-catalog, phase-gate, cucumber]
status: complete

requires:
  - phase: 05-marketplace-command-parity
    provides: "05-02 the shared cascade fold in remove.ts; 05-07 hosted-catalog.ts (HostedManifestFetch, DEFAULT_HOSTED_MANIFEST_FETCH), the hosted error classes, and the hosted stand-in; 05-08 marketplaceFailureRows sets marketplaceSubject"
provides:
  - "hosted-catalog.ts: refreshHostedCatalog({ url, manifestPath, locations, fetchCatalog, removalOps }): download, stage under sources-staging/<uuid>/, validate, rename over the stored catalog"
  - "update.ts: hostedManifestFetch on UpdateMarketplaceOptions and UpdateAllMarketplacesOptions (optional) and RefreshOneArgs (resolved once); the hosted arm of refreshRecord; refreshRemoteUrl; hostedDownloadReason"
  - "remove.ts: `hosted` in RecordedSourceKind, its narrowing, and the sources/<name>/ footprint removal"
  - "info.ts: a hosted record shown as { sourceKind: \"url\", url }"
  - "add.ts: surfaceLockHeldAdd passes marketplaceFailureRows as built"
  - "features/marketplace/hosted-source-update.feature (2 scenarios); 2 new hosted-source.feature scenarios (remove, info)"
  - "The phase records below for the parent session"
affects: [marketplace update, autoupdate cascade, marketplace remove, marketplace info, marketplace add lock-held row]

actuals:
  tokens: 17000
  tasks: 3
  commits: 2
plan_head_before: 3fdf77f406be299a15f6f293ed6ab4218fdcd394
plan_head_after: 6e83b1a573413ef43e4c8f8a963250bdd017b2ca

tech-stack:
  added: []
  patterns:
    - "A hosted refresh is download, stage, validate, rename: the stored catalog changes only by an atomic same-filesystem rename of a validated file"

key-files:
  created:
    - features/marketplace/hosted-source-update.feature
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - features/marketplace/hosted-source.feature
    - test/orchestrators/marketplace/hosted-catalog.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/marketplace/remove.test.ts
    - test/orchestrators/marketplace/info.test.ts

key-decisions:
  - "refreshHostedCatalog refuses a recorded manifest path outside the scope's sources/ before any request (NFR-10), so a tampered state record cannot aim the rename elsewhere"
  - "A staging cleanup that leaks after a successful swap does not fail the refresh: the catalog is in place and the staging directory is empty. A leak on a failed refresh is appended to the error (MA-9)"
  - "The hosted fetch port is optional on the two public option bags and required on RefreshOneArgs, resolved once at each entry point, as gitOps is"
  - "A hosted record's info is the url projection, so notification-types, notification-json, the grammar, and the published schema are unchanged"

requirements-completed: [MKT-02, MKT-04, MKT-06]

duration: ~50min
completed: 2026-10-27
---

# Phase 5 Plan 09: Hosted marketplace refresh, remove, and info, plus the phase records Summary

`marketplace update` and the autoupdate cascade now download a hosted catalog again and swap it in only after it validates. `marketplace remove` deletes a hosted marketplace's stored catalog, and `marketplace info` shows it as a url source with its catalog URL. Neither sends a request. The combined Phase 5 tree passes `npm run check`.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | `1cf601f4` | feat(marketplace): refresh a hosted marketplace on marketplace update |
| 2 | `6e83b1a5` | feat(marketplace): remove and show a hosted marketplace |
| 3 | (this SUMMARY commit) | docs: record the hosted marketplace lifecycle and phase summary |

## What changed

- **Refresh (D-PL5-09).** `refreshHostedCatalog` checks the recorded manifest path is inside `sources/`, downloads, writes the bytes to `sources-staging/<uuid>/marketplace.json`, reads them through `loadMarketplaceManifestDocument` (NFR-8), and renames the file over the stored catalog. Any failure before the rename cleans the staging directory and leaves the stored file byte-identical.
- **Update wiring.** `refreshRecord` gains a hosted arm before the unsupported-kind throw. The shared tail compares and stamps as for git. `cloneAdvanced` stays false, so no retry hint. `refreshRemoteUrl` (an exhaustive switch) gives the hosted `url` for the `{status} on {url}` frame. `hostedDownloadReason` maps a wrapped `HostedManifestFetchError` to `network unreachable` or `unreadable`. `HostedManifestHttpError` takes the existing ladder: 401/403 `authentication required` via `transportReason`, any other status `network error` plus frame via `refreshFailureReasons` (UPD-11, D-PL5-21).
- **Remove (D-PL5-06, MR-7).** `hosted` joins `RecordedSourceKind`, the narrowing, and the `sourceCloneDir` removal.
- **Info (D-PL5-05).** A hosted record projects as `{ sourceKind: "url", url }`, so info renders `url:` and `last_updated:`.
- **Lock-held add (D-PL5-12).** `surfaceLockHeldAdd` no longer re-spreads `marketplaceSubject`; `marketplaceFailureRows` sets it since 05-08. The add.test.ts lock-held cases pass unchanged.
- **Autoupdate.** "Autoupdate" is the cascade after `marketplace update` (`cascadeAutoupdates`); `marketplace autoupdate` only flips the config flag. A changed hosted refresh with autoupdate on runs the plugin cascade (unit case).
- **D-PL5-22.** `plugin update`'s marketplace sync still reads the stored hosted catalog. No code change (Phase 7's file).

## Phase gate (Task 3)

| Field | Value |
| ----- | ----- |
| Command | `npm run check` (foreground, unpiped; exit read from `$?`) |
| Exit status | **0** |
| Commit SHA | `6e83b1a573413ef43e4c8f8a963250bdd017b2ca` (the combined tree after 05-01..05-09 code) |
| Node | v26.12.1 |
| Scope | full: `check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), `test:unpaired`, `test:integration`, `test:cucumber` (932 scenarios, 9249 steps, all passed), `test:coverage:direct:all` (293 records merged) |
| Fixes needed | none. Wave 3 (05-07, 05-08) had not had a combined full check; it passed with no change. |

`npm run test:e2e` (github.com reachable): exit **0** on the same tree, after installing the peer-floor fixture's committed lockfile (`npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts`; the directory is git-ignored). The first run failed only the four `peer floor` tests with `Missing peer floor`, the environment gap 05-04 reported. The upstream-checkout tests, which use the D-PL5-23 `upstream-e2e` rename, passed on both runs.

## Verification (Tasks 1 and 2)

- `node --test test/orchestrators/marketplace/hosted-catalog.test.ts test/orchestrators/marketplace/update.test.ts`: 139/139.
- `node --test test/orchestrators/marketplace/{remove,info,add}.test.ts`: 259/259.
- `npm run test:coverage:direct` for hosted-catalog.ts, update.ts, remove.ts, info.ts, add.ts: exit 0 (100%).
- `npx cucumber-js features/marketplace/hosted-source-update.feature features/marketplace/update.feature features/marketplace/url-source-update.feature`: 98 scenarios pass. `npx cucumber-js features/marketplace/hosted-source.feature features/marketplace/remove.feature features/marketplace/info.feature features/marketplace/state-lock.feature`: 89 pass.
- ESLint `--max-warnings 0` on every changed file, `npx fallow health --fail-on-issues --quiet`, `npx fallow dupes --fail-on-issues`, `npm run check:features`: exit 0.
- Both commit hooks ran `npm run check:commit`: Passed.
- Acceptance greps: `export async function refreshHostedCatalog` 1; `refreshHostedCatalog(` in update.ts 1; `"hosted"` in remove.ts 3; `src.kind === "hosted"` in info.ts 1; `marketplaceSubject: true as const` in add.ts 0. `git diff --name-only -- CHANGELOG.md .planning/PROJECT.md .planning/BACKLOG.md AGENTS.md` lists nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Containment] The refresh checks the recorded manifest path first**
- **Found during:** Task 1
- **Issue:** the rename target comes from the state record. A record that points outside the scope would let a refresh write there (NFR-10).
- **Fix:** `assertPathInside(locations.sourcesDir, manifestPath, ...)` runs before the download; a unit case proves no request is sent.
- **Commit:** `1cf601f4`

**2. [Rule 1 - Test pin] The forward-compatible remove case reads `kind` once more**
- **Found during:** Task 2
- **Issue:** the remove narrowing compares one more kind (`hosted`), so `retains the source clone when a forward-compatible recorded kind is unavailable` counted 15 reads, not 14.
- **Fix:** the pin is 15. The case still proves the clone is kept. This is the read budget the orchestrator's `d134cb49` raised for 05-03.
- **Commit:** `6e83b1a5`

### Other choices

- `RefreshOneArgs.hostedManifestFetch` is required, resolved once at each entry point, like `gitOps`. The plan lists it as optional there; the public option bags keep it optional.
- No per-kind dispatch helper was extracted: `refreshRecord` stays under both complexity gates with one more `else if` arm, and the remote-URL ternary moved into `refreshRemoteUrl`.
- Extra unit cases beyond the plan list: a 403 refresh (`authentication required`), a staging-cleanup leak, the containment refusal, and a bare `updateAllMarketplaces` refresh with the injected port.
- The hosted info scenario lists no `description` field: the published catalog has none, and the step compares the whole field set.

**Total deviations:** 2 auto-fixed. No scope creep.

## CHANGELOG line

For the parent session to apply at merge (`.agents/skills/changelog`):

- `/claude:plugin marketplace` now behaves more like Claude Code's. (#PR)

  - `marketplace add` refuses Claude Code's reserved official marketplace names unless the source is a GitHub repository of the `anthropics` organization.
  - `marketplace add` accepts an https URL to a hosted `marketplace.json` and downloads it. `marketplace update` downloads it again. `info`, `list`, `remove`, and installs read the stored copy.
  - `/claude:plugin market` works as an alias of `marketplace`.
  - The `owner/repo@ref` shorthand splits at the first `@` or `#`, so `acme/tools@a@b` adds `acme/tools` at the ref `a@b`.
  - Adding a marketplace again restores its checkout when the checkout is gone. A manifest that is a directory reads `unreadable`.
  - In JSON output, marketplace-level failure rows and a failed `marketplace info` use the marketplace name alone as their `id`.

## Decision rows

For PROJECT.md Key Decisions. Evidence: Claude Code 2.1.310 binary and docs, 05-CONTEXT.md E-1..E-6.

| ID | Decision | Rationale | Evidence |
| -- | -------- | --------- | -------- |
| D-PL5-01 | `marketplace add` refuses a manifest name in Claude Code's 19-name reserved set (lowercased) unless the source is `github` with owner `anthropics`; checked in `newMarketplaceName` before any write, for every add caller | Upstream parity; one check covers standalone, bootstrap, apply, import, and the D-MF-04 install-time add | E-1 |
| D-PL5-02 | The refusal uses Claude Code's sentence per source kind and the reason `invalid manifest` on the failed-add row shape | Verbatim upstream text; reuses the D-08-07 precedent, no new token | E-1 |
| D-PL5-03 | Only the exact reserved set is enforced; look-alike, spelling, package-manager, `claudeai-`, folder, refresh-time, and load-time rules are deferred (MKTNAME-01) | MKT-01 names the reserved names; the rest is a separate surface | E-1 |
| D-PL5-04 | An `https://` input whose path ends in `.json` is a hosted catalog; the github.com arm stays first; the fragment is dropped; `http://` stays refused; plugin `{source:"url"}` objects are unchanged | Narrower than upstream, which keeps MURL-01, D-76-01, D-2-01/02 (recorded decisions license the divergence) | E-2 |
| D-PL5-05 | `ParsedSource` gains `hosted { raw, url }`; plugin-side consumers treat it as unsupported, like `npm`; state revalidates it; info shows it as a `url` source | One funnel that config, state, reconcile, and import already use | E-2 |
| D-PL5-06 | A hosted catalog is stored like a clone at `sources/<name>/.claude-plugin/marketplace.json`, staged and renamed, with the marker `sources/<name>/.pi-claude-marketplace-hosted.json` recording the URL; remove deletes `sources/<name>/` | Every reader works unchanged; MA-6/9/12/13 and MR-7 parity | E-2 |
| D-PL5-07 | `platform/hosted-manifest-fetch.ts` is the only new `fetch` caller: one GET, 10 s timeout, 5 MiB cap, at most 5 redirects, https only, cross-origin hops refused to loopback, link-local, private, and metadata hosts; no headers or credentials; an injected port with a production default | Upstream fetch contract and the GitOps seam pattern | E-2 |
| D-PL5-08 | NFR-5 amendment: hosted `marketplace add` and `update` (and autoupdate and an `apply` that adds or refreshes one) download the catalog; installs read the stored copy; `list`, `info`, `uninstall`, `marketplace remove` stay network-free | Required by the hosted kind | E-2 |
| D-PL5-09 | `marketplace update` downloads a hosted catalog again, validates it, and swaps it atomically; the content-key compare and the cascade run unchanged; autoupdate refreshes through the same path | Upstream refresh re-downloads | E-2 |
| D-PL5-10 | A hosted add failure uses the add's tokens: no connection or timeout `network unreachable`, 404/410 `source missing`, 401/403 `authentication required`, other status `network error` plus frame, oversized or refused redirect `unreadable`, malformed `unparseable`, schema-invalid `invalid manifest` | One vocabulary with the git add | E-2 |
| D-PL5-11 | `market` routes, completes, and helps exactly as `marketplace`; help shows `(alias: market)` | Upstream parser has `case "marketplace": case "market":` | E-3 |
| D-PL5-12 | Every marketplace-level failure row marks its child `marketplaceSubject: true`, so the JSON `id` is the bare name | Rows stand for the marketplace, not a plugin | ROWID-01 |
| D-PL5-13 | The shorthand splits at the first `@` or `#`; D-76-04's last-`@` rule is retired; D-MF-07 stays; no owner/repo character check | Upstream regexp `^([^#@]+)(?:[#@](.+))?$` | E-4 |
| D-PL5-14 | `marketplace remove` does not name dependents it strands; refusing stays off the table (D-05-07); PRUNE-GUARD-MR-01 closes as decided | Upstream reports only uninstalled plugins; LOAD-03 / D-06-07 report unmet dependents | E-5 |
| D-PL5-15 | `applyPartialCascadeFold` maps every dropped axis through a `satisfies`-typed table; remove.ts uses it, which adds the hooks axis | A new axis fails the typecheck until mapped | CASCADEAX-01 |
| D-PL5-16 | The orchestrated add catch-all narrows through `narrowProbeError`, so `unparseable` means malformed JSON only and a crash reads `unreadable` or its errno token | `apply`/`import` can tell a crash from a broken manifest | LCORCH-01 |
| D-PL5-17 | Re-adding a recorded github, url, or hosted marketplace whose `sources/<name>/` is gone repairs it and keeps its plugins; a different declared name fails `{source mismatch}`; a path record whose manifest is gone fails `{source missing}` | Upstream re-fetches a missing cache | E-6 |
| D-PL5-18 | The add's errno mapping is `list`'s and `info`'s (`fsErrnoReason`): EISDIR, EIO, EBADF read `unreadable` | One mapping, not three | LCORCH-01 |
| D-PL5-19 | The `already added` arm returns its own `unchanged` status, which the orchestrated outcome type excludes | No false `added` | LCCODE-01 |
| D-PL5-20 | D-PL5-08 covers the D-MF-04 install-time add: it downloads a hosted catalog once, as it clones a git one | The install-time add runs the add code | research OQ-1 |
| D-PL5-21 | `marketplace update` and autoupdate keep UPD-11: a hosted 404 on refresh reads `network error` with its frame; D-PL5-10 applies to add | Each verb classifies hosted as it classifies git | research OQ-2 |
| D-PL5-22 | `plugin update`'s marketplace sync does not refresh a hosted catalog; known gap | That code is Phase 7's file | research OQ-3 |
| D-PL5-23 | Fixtures that add a reserved name from a non-`anthropics` source publish under the `anthropics` owner; the e2e helper renames its checkout's marketplace to `upstream-e2e` | Keeps the pinned SHA and every scenario's Then tables | E-1 |
| D-PL5-24 | `help market` shows the marketplace help | Alias parity | E-3 |
| D-PL5-25 | `docs/json-output.md` is edited in the phase; the NFR-5 wording, CHANGELOG line, and decision rows go to the parent; import's own `<mp>@<mp>` row is left to Phase 6 | File ownership across phases | -- |
| D-PL5-26 | `PluginInfoRowBase` gains `marketplaceSubject?: true`, read by `wirePluginInfoRow` and never serialized | `marketplace info` rows lacked the marker | -- |
| PRUNE-GUARD-MR-01 | Closed as decided by D-PL5-14; no code change | See D-PL5-14 | E-5 |

### Proposed NFR-5 amendment text (D-PL5-08 + D-PL5-20)

For the network-policy line in AGENTS.md and PROJECT.md, after the D-MF-04 sentence:

> Network is also required for `marketplace add` and `marketplace update` of a hosted-manifest marketplace (an https URL to a `.json` catalog), which download its `marketplace.json`, including the autoupdate cascade, an `apply` that adds or refreshes one, and a project-scope install that adds it to the project through the `marketplace add` code (D-MF-04, D-PL5-08, D-PL5-20). Installing from a hosted marketplace reads the stored copy. `list`, `info`, `uninstall`, and `marketplace remove` stay network-free.

Also add D-PL5-08 to the line's "amended by" list.

## Backlog dispositions

| Entry | Disposition |
| ----- | ----------- |
| MKTPAR-01 | b1 (reserved names, MKT-01), b2 (hosted `marketplace.json`, MKT-02), b3 (`market` alias, MKT-03) fixed -> close |
| ROWID-01 | fixed (D-PL5-12) -> close. Import's own `<mp>@<mp>` block (`orchestrators/import/execute.ts`, `features/plugin/import.feature:515`) is left to Phase 6 (D-PL5-25) |
| SHORTREF-01 | fixed (D-PL5-13 retires D-76-04's last-`@` rule; D-MF-07 stays) -> close |
| PRUNE-GUARD-MR-01 | closed as decided (D-PL5-14), no code change |
| LCORCH-01 | b1 (`marketplace add` outcome classification: crash vs malformed, missing clone, EISDIR) fixed by D-PL5-16/17/18 -> mark b1 done |
| LCCODE-01 | b6 (`marketplace add`'s no-op returns `added`) fixed by D-PL5-19 -> mark b6 done |
| CASCADEAX-01 | fixed (D-PL5-15) -> close |
| MKTNAME-01 (new) | The rest of Claude Code's reserved-name rules (look-alike and impersonation names, other spellings, `npm`/`pip`/`uv`/`cargo`/`github`/`gh`, the `claudeai-` prefix, the `<owner>-<repo>` folder rule), the refresh-time check (a hosted or git refresh that renames a marketplace to a reserved name), and the load-time refusal of a reserved name registered from an untrusted source (D-PL5-03, T-05-06) |
| New: hosted catalog in `plugin update` | `plugin update`'s marketplace sync (`orchestrators/plugin/update-flow.ts`, PUP-2) does not refresh a hosted catalog; it reads the stored copy. Widening it is a Phase 7 file edit and an NFR-5 wording change (D-PL5-22) |
| Notes for Phase 6 | A `.json` `{source:"url"}` import declaration now parses as hosted through the funnel. `orchestrators/import/marketplaces.ts:52` still cites the retired D-76-04. Import's own marketplace failure row still emits `<mp>@<mp>` |

## Files touched outside the ROADMAP Files line

The Files line names `domain/source.ts`, `domain/name.ts`, `edge/router.ts`, `edge/completions/*`, `orchestrators/marketplace/{add,add.messaging,remove,remove.messaging,shared,update,info}.ts`, `orchestrators/plugin/shared.ts` (fold only), the hosted fetch seam, `rule-packs/architecture.json`, `eslint.config.js`, and `docs/json-output.md`. Production files outside it:

- `edge/handlers/plugin/help.ts` (05-01): the `help market` topic (D-PL5-24).
- `domain/unsupported-components.ts` (05-04): imports the moved reserved-name list, so one list serves both checks.
- `domain/plugin-resolver.ts`, `domain/version.ts` (05-03): compile-forced `hosted` arms (unsupported plugin source).
- `orchestrators/plugin/dependency-declaration-read.ts` (Phase 2's file), `orchestrators/plugin/info.ts` (Phases 3 and 7) (05-03): one compile-forced `hosted` case label each.
- `persistence/state-io.ts` (05-03): hosted revalidation on state load (Pitfall 1).
- `shared/errors.ts` (05-07): `HostedManifestHttpError`, `HostedManifestFetchError`.
- `orchestrators/marketplace/hosted-catalog.ts` (new, 05-07; extended here by `refreshHostedCatalog`): the hosted lifecycle helpers and the port.
- `shared/notification-types.ts` (Phase 3 also edits it), `shared/notification-json.ts` (05-08): the `PluginInfoRowBase.marketplaceSubject` field and its bare-id branch (D-PL5-26).

Test infrastructure and tests outside it:

- Stand-in and fixtures (05-05, 05-04, 05-06): `features/lib/https-git-host/server.ts`, `features/support/pi-process.ts`, `test/architecture/https-git-host-server.test.ts`, `features/lib/published-marketplace.ts`, `features/support/source-kind.ts`, `features/step_definitions/git-host.steps.ts`, `features/step_definitions/marketplace/{add,checkout,update,publishing}.steps.ts`.
- Skill rules (05-05; Phase 10 also edits them): `.agents/skills/cucumber/rules/features.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`.
- Feature files owned by other phases (05-04 reserved-name fixtures, 05-01 usage cells): `features/plugin/{git-source,install-dependencies,update-dependencies,apply,help}.feature`.
- Gate files (05-07): `test/architecture/gate-targets.ts`, `test/architecture/no-credential-leak.test.ts`.
- e2e (05-04, committed as `91042493`): `test/e2e/_helpers.ts`, `test/e2e/_targets.ts`, `test/e2e/install-soft-deps.test.ts`.
- Regression and expected-token fixes: `test/orchestrators/plugin/bootstrap.test.ts` (05-06), `test/integration/auth-e2e.test.ts` (05-06), `test/edge/register.test.ts` (05-08), and the orchestrator's `d134cb49` plus this plan's 15-read pin in `test/orchestrators/marketplace/remove.test.ts`.
- New owner tests and features: `test/orchestrators/marketplace/hosted-catalog.test.ts`, `test/platform/hosted-manifest-fetch.test.ts`, `features/marketplace/{market-alias,reserved-name,hosted-source,hosted-source-update}.feature`.

## Uncertain choices (for user review)

From 05-CONTEXT.md:

1. Hosted classification is `.json`-suffix only (D-PL5-04), narrower than upstream, which keeps MURL-01 / D-2-01 / D-2-02.
2. Reserved-name scope is the exact 19-name set (D-PL5-03).
3. The reserved-name reason token is `invalid manifest`, not a new token (D-PL5-02).
4. Hosted is a new `ParsedSource` kind in the shared funnel (D-PL5-05), at the cost of four plugin-side `npm`-like arms.
5. An orchestrated add crash narrows to `unreadable` (D-PL5-16).
6. A missing clone is repaired on re-add, not refused (D-PL5-17).
7. `market` is shown in the help as `(alias: market)` (D-PL5-11).
8. `marketplace remove` does not report stranded dependents (D-PL5-14).

Planning-time and execution choices:

9. A hosted URL with userinfo is refused as `unreadable` before any request, with the message `Marketplace URL must not contain a user name or password: <url with ***@>` (D-PL5-07 sends no credentials; Claude Code's own wording was not available).
10. Hosted info shows `source kind url` (D-PL5-05, research A2), not a distinct kind.
11. The `.json` suffix match is case-sensitive (research A5): `https://x/M.JSON` clones as git.
12. The e2e marketplace is renamed `upstream-e2e` in the temp checkout (D-PL5-23).
13. The hosted ownership marker is `sources/<name>/.pi-claude-marketplace-hosted.json` (D-PL5-06, research A6).
14. The hosted download follows at most 5 redirects; Claude Code's catalog call sets no limit of its own (research A3).
15. 05-07 refuses more cross-origin hop targets than the research list: `0.0.0.0/8` and IPv6 `fc00::/7`.
16. 05-06: in orchestrated mode an unclassified EACCES/EPERM now reads `permission denied`, the literal D-PL5-16 reading; standalone mode still rethrows. An install-time marketplace add that hits EISDIR, EIO, or EBADF now fails as `InstallMarketplaceAddError("unreadable")` instead of a raw error.
17. 05-08: import's own `<mp>@<mp>` row is left to Phase 6.
18. 05-03: `orchestrators/import/marketplaces.ts:52` still cites the retired D-76-04 (a Phase 6 file).
19. This plan: a staging-cleanup leak after a successful hosted swap does not fail the refresh (the catalog is in place and the leftover directory is empty). A refresh does not check that the downloaded catalog still declares the record's name, as a git refresh does not; a rename to a reserved name on refresh is MKTNAME-01.
20. The orchestrator's `d134cb49` raised the stored-source read budget in remove.test.ts for 05-03's hosted arm; this plan raised the same case's count from 14 to 15 for the remove narrowing.

## Notes for the codebase map

- The `fetch-chokepoint` rule admits two files: `domain/github-auth.ts` and `platform/hosted-manifest-fetch.ts`.
- `NETWORK_SEAMS` in `eslint.config.js` has 18 entries (adds `orchestrators/marketplace/hosted-catalog.ts`).
- New modules: `orchestrators/marketplace/hosted-catalog.ts` and `platform/hosted-manifest-fetch.ts`.
- The repo-wide `fallow-ignore` marker count is 42 (05-07 added one `unused-class-member` for `HostedManifestHttpError.code`).
- `ParsedSource` has a `hosted` kind; `HostedManifestSource { kind, raw, url }`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-18 is mitigated: the staged download is validated before a same-filesystem rename, and every failure leaves the stored catalog byte-identical (hosted-catalog.test.ts and the update.test.ts failure table). The containment check before the download adds to it. T-05-19 is mitigated: remove deletes only `sourceCloneDir(name)` and the data directory, both under `assertPathInside`. T-05-20 is mitigated by the 05-07 fetch module, which the refresh reuses unchanged.

## Self-Check: PASSED

- Commits `1cf601f4` and `6e83b1a5` are ancestors of HEAD.
- `features/marketplace/hosted-source-update.feature` and every modified file listed above exist.
- `npm run check` exit 0 at `6e83b1a5` (Node v26.12.1); `npm run test:e2e` exit 0.
