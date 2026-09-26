---
phase: "109"
slug: "kind-inversion"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-09-09"
---

# Phase 109 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Run retroactively. This phase executed before the security capability produced a
per-phase artifact, but its five plans each carried a `<threat_model>` block, so
the register is plan-time authored and complete — the audit verified mitigations
rather than reconstructing threats from the implementation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Plugin manifest to resolver | A third party's `plugin.json` declares `componentPaths`, which the resolver reads and turns into filesystem paths | Attacker-controlled relative path strings |
| Convention directory probe | `<pluginRoot>/workflows/` is probed by `statKind` on the convention axis | Directory presence only; no file content read in this phase |
| Closed-set membership | Which resolver tuple holds `workflows` decides whether a plugin installs or degrades | No data; a control-flow decision with user-visible consequences |

---

## Threat Register

Threat IDs recur across plans. The parenthesised suffix is the owning plan, and
each row was audited independently — `T-109-07` carries a different disposition
in plan 02 (`accept`) than in plan 04 (`mitigate`).

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-109-01 (01) | Tampering / Repudiation | resolver closed sets | high | mitigate | Red slice moved no production byte — `git diff 85fecdba~1 67f27e5e -- extensions/` returns 0 files | closed |
| T-109-05 (01) | Repudiation | `docs/output-catalog.md` | medium | mitigate | Catalog and fixture turned in one commit `85fecdba`; states at `output-catalog.md:433,599,654` pair with `catalog-uat.test.ts:934,1295,1401` | closed |
| T-109-06 (01) | Repudiation | the five locking gates | medium | mitigate | All five edited, not deleted (`4a5c572c`, `6a4b2239`, `85fecdba`); RED captured in `109-01-SUMMARY.md` §§1-6, GREEN at HEAD | closed |
| T-109-04 (01) | Information disclosure | none | low | accept | No `extensions/` file in the plan-01 range | closed |
| T-109-SC (01) | Tampering | npm/pip/cargo installs | low | accept | No dependency change in range | closed |
| T-109-01 (02) | Tampering / Repudiation | `UNSUPPORTED_COMPONENT_KINDS` + both supported tuples | high | mitigate | One atomic commit `f23d964d` does the removal and both additions; `resolver.ts:359,369`, absent `:389-397`; pinned by `hooks-foundation.test.ts:199,214` | closed |
| T-109-02 (02) | Tampering | `validateComponentPath` / `assertPathInside` | medium | mitigate | `resolver.ts:1605` → `:1055` → `:1030` → `:963` → `assertPathInside:997`; reach proven at `resolver.test.ts:1832` | closed |
| T-109-07 (02) | Repudiation | stale `compatibility.unsupported` | low | accept | Fall-through at `probe-classifiers.ts:203-213` | closed |
| T-109-04 (02) | Information disclosure | none | low | accept | Resolver I/O is `statKind` + `readFileText` on manifest/mcp/hooks only | closed |
| T-109-SC (02) | Tampering | npm installs | low | accept | No dependency change | closed |
| T-109-01 (03) | Tampering / Repudiation | resolver closed sets | high | mitigate | `b2e2d712`, `b09c647a` touch `tests/` only | closed |
| T-109-08 (03) | Repudiation | widened fixture literals | medium | mitigate | All 71 widened literals take `workflows: []`; the one non-empty is a helper spread at `discover-names.test.ts:32` whose five call sites all pass `[]` | closed |
| T-109-04 (03) | Information disclosure | none | low | accept | Test fixtures only | closed |
| T-109-SC (03) | Tampering | npm installs | low | accept | No dependency change | closed |
| T-109-01 (04) | Tampering / Repudiation | resolver closed sets | high | mitigate | `f1a65bba`, `59932311`, `0b15f0ee` touch `tests/` only | closed |
| T-109-05 (04) | Repudiation | catalog to `catalog-uat` pairing | medium | mitigate | `59932311` turns the three fixture payloads; byte-equality runner green 24/24 | closed |
| T-109-07 (04) | Repudiation | stale `compatibility.unsupported` | low | mitigate | `probe-classifiers.test.ts:266` "WINV-03: a stray workflows kind in a legacy record falls through to unsupported component" | closed |
| T-109-04 (04) | Information disclosure | none | low | accept | Test fixtures only | closed |
| T-109-SC (04) | Tampering | npm installs | low | accept | No dependency change | closed |
| T-109-01 (05) | Tampering / Repudiation | resolver closed sets | high | mitigate | `e5ae373f` touches `tests/integration/` only; re-proved at `workflow-kind-inversion.test.ts:142-173` | closed |
| T-109-03 (05) | Repudiation | install row during the 109-111 window | medium | mitigate | `e5ae373f:146` asserted both halves at plan time. Superseded as designed — see Divergences | closed |
| T-109-09 (05) | Tampering | `HOME` override | low | mitigate | `withHermeticHome` at `workflow-kind-inversion.test.ts:58`; HOME set `:61`, restored in `finally` `:64-68` | closed |
| T-109-02 (05) | Tampering | `assertPathInside` | medium | mitigate | Same chokepoint; fixture declares no component path and creates `workflows/` by convention `:101`, exercising `resolver.ts:1058` | closed |
| T-109-04 (05) | Information disclosure | none | low | accept | Fixture writes `workflows/greet.js`; no phase-109 code opens it | closed |
| T-109-SC (05) | Tampering | npm installs | low | accept | No dependency change | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-109-01 | T-109-04 (all plans) | **Scoped to this phase, and no longer true at HEAD.** The acceptance rested on "no workflow script is read, parsed or evaluated", which held for phase 109 only. `domain/workflow-script.ts` and `bridges/workflows/` now read and parse workflow scripts. Those are phases 110 and 111, which carry their own registers and their own parser threats. Do not read this row as a standing property of the extension. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-109-02 | T-109-07 (plan 02) | A legacy record carrying a stray `workflows` kind falls through to the unsupported-component arm rather than being migrated. Plan 04 later re-dispositioned the same ID to `mitigate` and pinned the fall-through as a test. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-109-03 | T-109-SC (all plans) | No package was installed in this phase; `package.json` and `package-lock.json` are unchanged across the whole range, so no supply-chain surface was introduced. | gsd-security-auditor (retroactive) | 2026-09-09 |

---

## Divergences

Recorded because they matter more than the tally: in each case the mitigation
holds, but its stated text no longer describes HEAD.

1. **T-109-03's mitigation text is superseded, by design.** The plan declared
   "Phase 111 inverts the second half", and it did. The test is now
   `WINV-02 / WBRG-01: … and the bridge materializes its script as an envelope`
   (`workflow-kind-inversion.test.ts:142`), so the absent-artifact assertion is
   now an envelope-written assertion (`a3939034`, `d02db74b`, `cc951616`). The
   flag-free-success half is intact at `:165-173`. Not a gap — a closed window.

2. **T-109-01 says "both supported tuples"; only one is directly pinned.**
   `SUPPORTED_COMPONENT_KINDS` is exported and asserted by exact tuple at
   `hooks-foundation.test.ts:199`. `SUPPORTED_COMPONENT_PATH_KINDS`
   (`resolver.ts:369`) is module-private with no membership or length pin — its
   membership is proven behaviorally by `resolver.test.ts:1726` / `:1813`.
   Adequate at L1 and behaviorally adequate at L2. Named because a future edit
   dropping `workflows` from the private tuple turns those behavioral tests red
   rather than tripping a closed-set guard.

3. **T-109-02 has no `workflows`-specific containment-escape case.** The escape
   test is `skills: '../outside'` (`resolver.test.ts:1608`). `workflows` shares
   the identical code path and is proven to reach `validateComponentPath`
   (`:1832` asserts that function's own message), so the chokepoint genuinely
   covers it. Closed at L1; a `workflows: '../outside'` row would make it
   explicit.

4. **Three of five summaries carry no `## Threat Flags` section.**
   `109-01`, `109-04` and `109-05` have none; `109-02` and `109-03` declare
   "None." The auditor did not treat absence as evidence of no new surface — it
   inspected the phase diff directly, and all five touched production files map
   to registered threats. A reporting-discipline gap, not a substantive one.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 25 | 25 | 0 | gsd-security-auditor (retroactive, opus) |

Register parse: 25 rows across 5 plans — 5 / 5 / 4 / 5 / 6. Matches the
orchestrator's independent mechanical count, so no plan was audited as a subset.

Gates run read-only during the audit: `hooks-foundation.test.ts` +
`probe-classifiers.test.ts` (50 pass, 0 fail); `catalog-uat.test.ts` +
`compat-01-no-expansion.test.ts` + `notify-closed-set-locks.test.ts`
(24 pass, 0 fail).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-09
