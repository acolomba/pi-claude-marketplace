---
milestone: url-source
audited: 2026-07-13T12:57:21Z
status: passed
scores:
  requirements: 20/20
  phases: 4/4
  integration: 9/9
  flows: 4/4
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 78-plugin-git-source-lifecycle
    items:
      - "Deferred (78-08): the `dangling reference` REASONS token is not yet listed in docs/output-catalog.md or docs/messaging-style-guide.md (confirmed absent by grep). Docs-only — the closed-set completeness proof (_ReasonsCoverageProof) is unaffected and passes. Add a `dangling reference` row with the reconcile render context in a follow-up docs pass."
  - phase: 76-marketplace-git-url-sources
    items:
      - "Integration-check WARNING (MURL-07): tests/e2e/import-command.test.ts has no URL-kind extraKnownMarketplaces scenario. The wiring (import/marketplaces.ts -> parsePluginSource -> reconcile plan) is unit-tested in tests/orchestrators/import/marketplaces.test.ts, but the command-level black-box path (import command -> URL marketplace -> state.json record) is unexercised."
---

# Milestone Audit: url-source (URL Sources)

**Audited:** 2026-07-13T12:57:21Z
**Status:** passed
**Milestone goal:** Everything that can be done for the current `github` and `path`
sources works for arbitrary git URL sources — for both marketplaces and plugins,
across every surface and lifecycle operation.

## Summary

All 4 phases (76–79) are complete with passing VERIFICATION.md reports. All 20 v1
requirements are satisfied across the 3-source cross-reference (phase VERIFICATION
tables, SUMMARY `requirements-completed` frontmatter, REQUIREMENTS.md traceability
checkboxes) with no orphans. The integration checker found all 9 cross-phase seams
wired, zero blockers, zero broken flows, and every git clone call site protected by
the Phase 79 auth registry. Two minor tech-debt items remain (one deferred docs row,
one E2E test-depth warning) — neither blocks milestone completion.

## Phase Verification Status

| Phase | Status | Score | Rounds | Notes |
|-------|--------|-------|--------|-------|
| 76 Marketplace git-URL sources | passed | 10/10 truths | 1 | No gaps; MURL-02 formally dropped in discussion (no upstream subdirectory-marketplace concept) |
| 77 Plugin clone cache + install | passed | 4/4 truths | 1 + human UAT | `human_needed` closed live 2026-07-11 (real clone/dedup/offline UAT — awslabs/agent-plugins trio) |
| 78 Plugin git-source lifecycle | passed | 4/4 truths | 3 | Two UAT gap-closure waves (78-07/78-08 cross-layer config removal; 78-09/78-10 completion parity + marketplace-remove clone GC); round-2 live UAT closed both carried-forward human items |
| 79 Provider-auth registry | passed | 5/5 truths | 1 | Byte-identity trio unmodified since before the phase; amended D-79-03 cause-line scoping verified |

## Requirements Coverage (3-source cross-reference)

Sources: (1) phase VERIFICATION.md requirements tables, (2) SUMMARY.md
`requirements-completed` frontmatter, (3) REQUIREMENTS.md traceability table.

| Requirement | Phase | Verification | Summary frontmatter | Traceability | Final |
|-------------|-------|--------------|---------------------|--------------|-------|
| MURL-01 | 76 | SATISFIED | 76-01, 76-02 | `[x]` Complete | satisfied |
| MURL-03 | 76 | SATISFIED | 76-02 | `[x]` Complete | satisfied |
| MURL-04 | 76 | SATISFIED | 76-02 | `[x]` Complete | satisfied |
| MURL-05 | 76 | SATISFIED | 76-03 | `[x]` Complete | satisfied |
| MURL-06 | 76 | SATISFIED | 76-01 | `[x]` Complete | satisfied |
| MURL-07 | 76 | SATISFIED | 76-03 | `[x]` Complete | satisfied |
| PURL-01 | 77 | SATISFIED | 77-02, 77-04 | `[x]` Complete | satisfied |
| PURL-02 | 77 | SATISFIED | 77-03, 77-04 | `[x]` Complete | satisfied |
| PURL-03 | 77 | SATISFIED | 77-02, 77-04 | `[x]` Complete | satisfied |
| PURL-04 | 77 | SATISFIED | 77-01, 77-03, 77-04 | `[x]` Complete | satisfied |
| PURL-09 | 77 | SATISFIED | 77-01, 77-04 | `[x]` Complete | satisfied |
| PURL-05 | 78 | SATISFIED | 78-01, 78-04, 78-07, 78-10 | `[x]` Complete | satisfied |
| PURL-06 | 78 | SATISFIED | 78-01, 78-06, 78-07, 78-08, 78-10 | `[x]` Complete | satisfied |
| PURL-07 | 78 | SATISFIED | 78-02, 78-05 | `[x]` Complete | satisfied |
| PURL-08 | 78 | SATISFIED | 78-03, 78-09 | `[x]` Complete | satisfied |
| PROV-01 | 79 | SATISFIED | 79-01 | `[x]` Complete | satisfied |
| PROV-02 | 79 | SATISFIED | 79-02, 79-03 | `[x]` Complete | satisfied |
| PROV-03 | 79 | SATISFIED | 79-03 | `[x]` Complete | satisfied |
| PROV-04 | 79 | SATISFIED | 79-02, 79-03 | `[x]` Complete | satisfied |
| PROV-05 | 79 | SATISFIED | 79-01 | `[x]` Complete | satisfied |

- Orphaned requirements: none — every traceability-table REQ-ID appears in at least
  one VERIFICATION.md requirements table and one SUMMARY frontmatter list.
- Unsatisfied requirements: none.
- The stale-checkbox notes recorded in the 77/78/79 verification reports were
  housekeeping lag at verification time; the traceability table is now fully
  checked and marked Complete for all 20 IDs.
- MURL-02 (marketplace-level `git-subdir`) was formally dropped during Phase 76
  discussion and moved to the Out of Scope table with rationale (no upstream
  subdirectory-marketplace concept) — a documented requirements-set change, not
  an unaddressed requirement.

## Cross-Phase Integration (integration checker report)

**Result: 9/9 seams wired, 0 orphaned exports, 0 missing connections, 0 broken
flows, 0 unprotected clone call sites.**

| Seam | Status |
|------|--------|
| Source parse (76) → resolver classification → clone-cache key (77): `url`/`git-subdir`/`github` kinds flow into `ResolveContext.resolveGitPluginRoot`; install's clone probe and list/edge-deps' fs-only presence probe share the same `pluginCloneKey(canonicalUrl, sha)` derivation | WIRED |
| Clone cache (77) → lifecycle ops (78): install/update/reinstall all call the single shared `resolveGitSubdirRoot`; `clone-gc.ts::deriveLiveCloneKeys` reads `resolvedSha`/source the same way install/update/reinstall record it | WIRED |
| git-source-probe (78) shared by `list.ts` and `edge-deps.ts` completion bucketizer (parity, schemaVersion 5) | WIRED |
| Auth threading (79): `buildAuthForHost` called from marketplace add (github + url arms), marketplace update (refresh + re-add cascade), plugin install/update/reinstall; `resolveRemoteRef` receives auth where relevant; no clone call site bypasses it | WIRED |
| NFR-5 network policy: `no-orchestrator-network.test.ts` gates list/install/reinstall; only update.ts permitted gitOps (S-9); uninstall imports only fs-only clone-gc | WIRED |
| NFR-10 containment: single `resolveGitSubdirRoot` implementation is the sole containment anchor across install, reinstall, and update | WIRED |
| Config-reconcile URL declarations: `samePlannedSource` consumed identically by `reconcile/plan.ts` and `import/execute.ts`; gated by `reconcile-planner-purity.test.ts` | WIRED |
| Import flow: `import/marketplaces.ts` maps `extraKnownMarketplaces` URL entries into the same `parsePluginSource`/reconcile pipeline | WIRED (unit-tested; see WARNING) |
| PROV-05 gate: `no-credential-leak.test.ts` covers all 4 provider files (auth-registry.ts, github-auth.ts, git-credential.ts, auth-host.ts) plus both marketplace orchestrators and with-state-guard.ts | WIRED |

### E2E User Flows

| Flow | Status |
|------|--------|
| marketplace add `<url>` → plugin install (git-source) → list → update (sha bump) → uninstall with GC | COMPLETE (sha-bump update + cross-layer removal confirmed live in 78-UAT.md round 2) |
| Config-declared URL marketplace reconciles at load | COMPLETE |
| Import from Claude settings (`extraKnownMarketplaces` URL entries) | COMPLETE at unit level; command-level E2E scenario missing (WARNING, MURL-07) |
| Auth-required private host with / without registered provider | COMPLETE (provider flow host-keyed via CredentialOps; no-provider fails clean, no retry loop) |

## Tech Debt (non-blocking)

| # | Phase | Item | Affects |
|---|-------|------|---------|
| 1 | 78 (78-08) | `dangling reference` REASONS token missing from `docs/output-catalog.md` and `docs/messaging-style-guide.md` (recorded in the phase's deferred-items.md; confirmed still absent). Docs-only; no test gates these files. | Output catalog completeness |
| 2 | 76/import | No URL-kind `extraKnownMarketplaces` scenario in `tests/e2e/import-command.test.ts`; MURL-07 verified at the unit level only. Wiring is intact — this is test depth, not a broken connection. | MURL-07 |

## Nyquist Compliance

Skipped — no active `validate-phase` step hook at `verify:post` (capability
inactive). Informational: VALIDATION.md exists for all 4 phases; 77/78/79 are
`nyquist_compliant: true` / approved, 76 is `draft` / `nyquist_compliant: false`.
Not audit-affecting while the capability is inactive.

## Verdict

**passed** — all 20 requirements satisfied, all 4 phases verified (including
three rounds of live human UAT on phases 77/78), all cross-phase seams wired,
and no critical gaps. The two tech-debt items above are candidates for a
follow-up docs pass and an E2E test addition; neither blocks
`/gsd-complete-milestone url-source`.

---
*Audited: 2026-07-13T12:57:21Z*
*Auditor: Claude (gsd-audit-milestone)*
