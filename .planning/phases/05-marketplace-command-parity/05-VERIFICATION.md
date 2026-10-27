---
phase: 05-marketplace-command-parity
verified: 2026-10-27T00:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/05-marketplace-command-parity/05-01-PLAN.md
  - .planning/phases/05-marketplace-command-parity/05-01-SUMMARY.md
  - .planning/phases/05-marketplace-command-parity/05-02-PLAN.md
  - .planning/phases/05-marketplace-command-parity/05-02-SUMMARY.md
  - .planning/phases/05-marketplace-command-parity/05-03-PLAN.md
  - .planning/phases/05-marketplace-command-parity/05-03-SUMMARY.md
  - .planning/phases/05-marketplace-command-parity/05-04-PLAN.md
  - .planning/phases/05-marketplace-command-parity/05-04-SUMMARY.md
  - .planning/phases/05-marketplace-command-parity/05-05-PLAN.md
  - .planning/phases/05-marketplace-command-parity/05-05-SUMMARY.md
  - .planning/phases/05-marketplace-command-parity/05-06-PLAN.md
  - .planning/phases/05-marketplace-command-parity/05-06-SUMMARY.md
  - .planning/phases/05-marketplace-command-parity/05-07-PLAN.md
  - .planning/phases/05-marketplace-command-parity/05-07-SUMMARY.md
  - .planning/phases/05-marketplace-command-parity/05-08-PLAN.md
  - .planning/phases/05-marketplace-command-parity/05-08-SUMMARY.md
  - .planning/phases/05-marketplace-command-parity/05-09-PLAN.md
  - .planning/phases/05-marketplace-command-parity/05-09-SUMMARY.md
  - docs/json-output.md
  - eslint.config.js
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/domain/unsupported-components.ts
  - extensions/pi-claude-marketplace/domain/version.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - features/marketplace/add.feature
  - features/marketplace/autoupdate.feature
  - features/marketplace/failed-add.feature
  - features/marketplace/file-source-update.feature
  - features/marketplace/git-source.feature
  - features/marketplace/github-source.feature
  - features/marketplace/hosted-source-update.feature
  - features/marketplace/hosted-source.feature
  - features/marketplace/info.feature
  - features/marketplace/market-alias.feature
  - features/marketplace/remove.feature
  - features/marketplace/reserved-name.feature
  - features/marketplace/state-lock.feature
  - features/marketplace/unsupported-source.feature
  - features/marketplace/update.feature
  - features/marketplace/url-source-update.feature
  - rule-packs/architecture.json
covered_digest: "v4:sha256:a56dadd17a10a551aa256d94810811268b15f758881c54a0d5f9ad8ecbe1e257"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 5: Marketplace Command Parity Verification Report

**Phase Goal:** The marketplace commands match Claude Code on reserved names, hosted manifests, the `market` alias, shorthand parsing, row ids, and remove reporting.
**Verified:** 2026-10-27
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP Phase 5 success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | `marketplace add` refuses a reserved name with Claude Code's wording, and `bootstrap` still adds the official marketplace (MKT-01) | VERIFIED | `domain/name.ts::reservedMarketplaceNameRefusal` holds the 19-name set (14 official names plus 5 community and directory names), compares lowercased, exempts a `github` source whose owner is `anthropics`, and returns both upstream sentences verbatim (github/url form and the `'anthropics' organization` form). `orchestrators/marketplace/add.ts::newMarketplaceName` calls it before any state mutation, on every add path (standalone, apply, import, D-MF-04). `features/marketplace/reserved-name.feature` covers dir, file, url, and github sources (each refused with the exact sentence, no checkout and no config written), plus the `anthropics/claude-plugins-official` success case. `features/plugin/bootstrap.feature` still passes. Cucumber run: 87/87 scenarios pass across the Phase 5 features. |
| 2 | A scenario adds a marketplace from an https URL to a hosted `marketplace.json`, installs from it, and updates it, with the network amendment recorded (MKT-02) | VERIFIED | `domain/source.ts::parseHostedManifestForm` classifies an https `.json` URL as the `hosted` kind (github.com URLs stay on the github arm, fragment dropped, malformed URLs are `unknown`). `platform/hosted-manifest-fetch.ts` is the one new `fetch` caller (10 s timeout, 5 MiB cap, 5 redirects, https-only and local-address redirect refusal, userinfo refusal). `orchestrators/marketplace/hosted-catalog.ts` stages, marks, and renames the download; `update.ts` refreshes it. `features/marketplace/hosted-source.feature` (add, 404, 5xx, dropped connection, invalid JSON, install from it, list and info without a request, apply, remove) and `hosted-source-update.feature` (update plus 404) pass. Gate wiring: `rule-packs/architecture.json` `fetch-chokepoint` admits the module; `eslint.config.js` BLOCK F bans importing it from network-free modules. The amendment is recorded as D-PL5-08 / D-PL5-20 in `05-CONTEXT.md` and `05-09-SUMMARY.md`, with proposed NFR-5 text (see Advisory 1). |
| 3 | `market` works wherever `marketplace` does; failure rows carry the bare marketplace id; the shorthand rule is settled (MKT-03, MKT-04, MKT-05) | VERIFIED | Alias: `edge/router.ts` dispatches `market` to `selectMarketplaceRoute`, treats `help market` as the marketplace topic; `completions/provider.ts` rewrites a leading `market` to `marketplace`; help names `(alias: market)`. `features/marketplace/market-alias.feature` runs `market add`, `market list`, `market help`, `help market`, and bare `market`. Row ids: `marketplaceSubject: true` is set in `shared.ts::marketplaceFailureRows`, `update.ts`, `info.ts`, and `add.ts`; `notification-json.ts::rowId` and `wirePluginInfoRow` emit the bare name; `docs/json-output.md` says so; the feature cells moved from `<mp>@<mp>` to the bare id (the only `tools@tools` left is the negative unit case). Shorthand: `parseShorthandSourceForm` splits at the first `@` or `#` (`raw.search(/[@#]/)`); `github-source.feature` scenario `acme/tools@release@2026` clones ref `release@2026`; D-PL5-13 retires D-76-04's last-`@` rule. |
| 4 | `marketplace remove` reporting of stranded dependents is settled, and its fold covers the hooks axis through the shared exhaustive fold (MKT-06, MKT-08) | VERIFIED | MKT-06: D-PL5-14 (no stranded-dependents report, matching upstream, LOAD-03 reports unmet dependents later; PRUNE-GUARD-MR-01 closed as decided) is recorded in `05-CONTEXT.md` and `05-09-SUMMARY.md`. MKT-08: `orchestrators/plugin/shared.ts` has `DROPPED_AXIS_FIELDS ... satisfies Record<keyof UnstageOutcome["dropped"], keyof RecordResources>`; `applyPartialCascadeFold` iterates it; `marketplace/remove.ts:446` calls it (hand-rolled copy deleted). Unit test `D-PL5-15: a partial failure subtracts every dropped axis, hooks and workflows included` in `test/orchestrators/marketplace/remove.test.ts` passes. |
| 5 | `marketplace add` classifies a crash apart from a malformed manifest, handles a missing clone behind a record, and maps EISDIR (MKT-07) | VERIFIED | `add.ts::handleAddFailure` orchestrated catch-all now returns `narrowProbeError(...)` (the old unconditional `"unparseable"` is removed in the diff); `errorAddReason` uses the shared `fsErrnoReason` (EISDIR/EIO/EBADF read `unreadable`); `redeclareRecordedSource` plus `repairableSource` repair a recorded github/url/hosted record whose `sources/<name>/` is gone (keeping `plugins`) and fail a path record whose manifest is gone as `source missing`; the no-op arm returns `status: "unchanged"`, excluded from the orchestrated outcome type. Scenarios in `features/marketplace/add.feature` (restores a gone checkout, local manifest gone fails as source missing) and `failed-add.feature` (manifest is a directory fails as unreadable) pass. |

**Score:** 5/5 truths verified (0 behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `domain/name.ts` | reserved-name predicate | VERIFIED | Substantive, wired from `add.ts` and `unsupported-components.ts` |
| `domain/source.ts` | `hosted` kind in the shared funnel, first-delimiter shorthand split | VERIFIED | Arms in `parsePluginSource`, `samePlannedSource`, `sourceLogical` |
| `platform/hosted-manifest-fetch.ts` | sole new fetch seam | VERIFIED | 293 lines; imported only through the injected port in `hosted-catalog.ts` |
| `orchestrators/marketplace/hosted-catalog.ts` | download, marker, refresh helpers | VERIFIED | Used by `add.ts`, `update.ts`, `remove.ts`, `info.ts` |
| `orchestrators/plugin/shared.ts` | exhaustive fold | VERIFIED | `satisfies` table, three further callers besides `remove.ts` |
| `persistence/state-io.ts` | hosted record revalidation | VERIFIED | Stored `url` records ending `.json` keep loading (review fix WR-02) |
| `edge/router.ts`, `completions/provider.ts`, `handlers/plugin/help.ts` | `market` alias | VERIFIED | |
| `rule-packs/architecture.json`, `eslint.config.js` | network chokepoints | VERIFIED | `fetch-chokepoint` lists the module; BLOCK F covers the port names |
| `docs/json-output.md` | bare id documented | VERIFIED | |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `add.ts::newMarketplaceName` | `name.ts::reservedMarketplaceNameRefusal` | direct call before state mutation | WIRED |
| `add.ts` / `update.ts` | `hosted-catalog.ts` -> `hosted-manifest-fetch.ts` | injected port with production default | WIRED |
| `remove.ts` | `plugin/shared.ts::applyPartialCascadeFold` | import and call at line 446 | WIRED |
| `shared.ts`/`update.ts`/`info.ts`/`add.ts` failure rows | `notification-json.ts::rowId` | `marketplaceSubject: true` | WIRED |
| `router.ts` `market` | `selectMarketplaceRoute` | `case "market"` | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 5 cucumber features (reserved-name, market-alias, hosted-source, hosted-source-update, github-source, remove) | `npx cucumber-js <6 features>` | 87 scenarios, 879 steps passed | PASS |
| Phase 5 domain, orchestrator, platform unit tests | `node --test test/domain/{name,source}.test.ts test/orchestrators/marketplace/{add,remove,hosted-catalog}.test.ts test/orchestrators/plugin/shared.test.ts test/platform/hosted-manifest-fetch.test.ts` | 824 pass, 0 fail | PASS |
| Edge, persistence, JSON, update/info/shared unit tests | `node --test test/edge/... test/persistence/state-io.test.ts test/shared/notification-json.test.ts test/orchestrators/marketplace/{update,info,shared}.test.ts` | 740 pass, 0 fail | PASS |
| Full gate | `npm run check` (reported by the caller, not re-run) | exit 0, 934 scenarios | accepted from caller |

### Probe Execution

Step 7c: SKIPPED. No probe scripts are declared in the plans or summaries.

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
| ----------- | -------------- | ------ | -------- |
| MKT-01 | 05-04, 05-07 | SATISFIED | Truth 1 |
| MKT-02 | 05-03, 05-05, 05-07, 05-09 | SATISFIED | Truth 2 |
| MKT-03 | 05-01 | SATISFIED | Truth 3 |
| MKT-04 | 05-08, 05-09 | SATISFIED | Truth 3 |
| MKT-05 | 05-03 | SATISFIED | Truth 3 |
| MKT-06 | 05-02, 05-09 | SATISFIED | Truth 4 (decision D-PL5-14) |
| MKT-07 | 05-06, 05-07 | SATISFIED | Truth 5 |
| MKT-08 | 05-02 | SATISFIED | Truth 4 |

All eight IDs appear in at least one PLAN frontmatter `requirements` field and in REQUIREMENTS.md. No orphaned requirement maps to Phase 5. (The REQUIREMENTS.md traceability table still reads `Pending`; the orchestrator's phase-complete step updates it.)

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX` markers in the 22 production files the phase changed.

### Advisories (not blocking)

1. **NFR-5 amendment text not yet applied to the canonical line.** D-PL5-08 and D-PL5-20 are recorded with IDs in `05-CONTEXT.md` and `05-09-SUMMARY.md` (with proposed wording), and the code gates cite D-PL5-07. The NFR-5 "Network policy" lines in `AGENTS.md` and `.planning/PROJECT.md`, and the `CHANGELOG.md` line, were deliberately handed to the parent (D-PL5-25). Apply them before the milestone PR (Phase 11 CLN-03 covers PROJECT.md decision rows; AGENTS.md is not named there). `.planning/codebase/ARCHITECTURE.md` also still names only the git identifiers in its Network boundary paragraph (review-fix WR-04 note).
2. **Open review items, decided as not fixed (05-REVIEW-FIX.md):** IN-06 (a hosted catalog entry with source `./` resolves to the stored tree; proposed backlog `HOSTED-REL-01`), IN-07 (a repair resets the update baseline; needs a user decision to reopen D-PL5-17), and the WR-03 residual (a DNS name that resolves to a loopback or metadata address passes the redirect check, because `node:dns` and undici hooks are banned by the rule pack). IN-02 and IN-05 are justified won't-fix.
3. **Known gaps carried to other phases:** D-PL5-22 (`plugin update` does not refresh a hosted catalog), import's own `<mp>@<mp>` failure row (Phase 6), `MKTNAME-01` (rest of the reserved-name rules).
4. **Backlog and state bookkeeping** (close MKTPAR-01, ROWID-01, SHORTREF-01, PRUNE-GUARD-MR-01, LCORCH-01 b1, LCCODE-01 b6, CASCADEAX-01; add MKTNAME-01 and HOSTED-REL-01) is listed in `05-09-SUMMARY.md` for the parent.

### Human Verification Required

None. The two review fixes flagged "requires human verification" (WR-02 record revalidation, WR-03 address classification) are covered by passing unit cases, which this verification re-ran.

### Gaps Summary

No gaps. Every ROADMAP success criterion is backed by source code, passing unit tests, and passing cucumber scenarios.

---

_Verified: 2026-10-27_
_Verifier: Claude (gsd-verifier)_
