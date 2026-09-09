---
phase: "116"
slug: "load-time-workflow-convergence"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-09"
---

# Phase 116 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Load-time scan → recorded plugin state | The widened backfill scan now reads every recorded plugin, not only partially-installed ones | Plugin records, including the `enabled` flag that carries an explicit user decision |
| Offline re-resolution → clone cache | `resolveRecordedPluginOffline` re-resolves a record with no clone-cache resolver injected | Marketplace manifest bytes from the local cache; NO network |
| Re-materialization → host engine storage | A promotion writes executable workflow envelopes under `~/.pi/workflows/` | Plugin-supplied script bodies |
| Reconcile row → user | The convergence token tells a user why commands appeared after a reload they did not initiate | Plugin-supplied names, escaped through the closed reason set |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-116-01 | Elevation of privilege | `backfillOnePluginIsolated` disabled-record filter | high | mitigate | `isRecordedButDisabled` left byte-identical (`backfill.ts:297`); reinstall's own refusal is the second layer (`reinstall.ts:927`). Deleting the filter reddens 2/34 | closed |
| T-116-02 | Tampering | `applyBackfillForScope` state-file-absent guard | high | mitigate | `hasForceInstalledPlugin` not touched (D-116-04, `backfill.ts:175-185`); the WR-01 control reddens if it is widened | closed |
| T-116-03 | Information disclosure | `resolveRecordedPluginOffline` → `reinstallPlugin` | high | mitigate | No clone-cache resolver passed (`backfill.ts:460`); `deriveSourcePluginRoot` returns `unavailable` for every git shape (`resolver.ts:812`) before any clone | closed |
| T-116-08 | Tampering | `alreadyTouched` dedupe (`backfill.ts:233-238`, `:303`) | high | mitigate | A record disabled by `applyPlan` in the same load is not re-materialized behind it; removing the dedupe reddens 2/34 | closed |
| T-116-SC | Tampering | npm/pip/cargo installs | high | accept | The phase adds, upgrades and removes no package; `git diff --stat` on `package.json`/`package-lock.json` across the phase is empty | closed |
| T-116-04 | Tampering | executable envelopes under `~/.pi/workflows/` | medium | mitigate | Strict superset (`backfill.ts:470-477`) plus the version gate (`:76`) bound re-materialization to one load, asserted on bytes, inode and mtime | closed |
| T-116-06 | Information disclosure | per-plugin failure row | medium | accept | `redactAbsolutePaths` is not in the phase diff; the failure arms carry only a closed `ContentReason`, never notes text | closed |
| T-116-07 | Repudiation | `backfilledRowFromOutcome` / the fully-promoted row | medium | mitigate | The convergence token leads the shared prelude (`notify.ts:623`) and both arms return it unconditionally; the arm's bytes are published and paired both directions | closed |
| T-116-12 | Repudiation | the phase's negative-control record | medium | mitigate | Four controls present as verbatim failing transcripts; four mutation classes independently re-run by the auditor, every count matching | closed |
| T-116-14 | Repudiation | dropped per-script admission-gate warnings on the backfill path | medium | accept | Pre-existing; tracked as `UPCASC-01` (`.planning/BACKLOG.md:1829`), partly compensated by the convergence token making the row non-silent | closed |
| T-116-05 | Denial of service | per-plugin fault isolation | low | accept | Pre-existing per-plugin try/catch (`backfill.ts:307-318`); healthy-sibling case green | closed |
| T-116-09 | Tampering | the doc-to-fixture byte pairing | low | mitigate | Forward walk (`catalog-uat.test.ts:5663`) and inverse walk (`:5809`), each exercised by control | closed |
| T-116-10 | Repudiation | the WCONV-01 population sentence | low | mitigate | Corrected at `REQUIREMENTS.md:55` and `ROADMAP.md:75`; no live site asserts the retired claim | closed |
| T-116-11 | Repudiation | ungated prose counts in the notification modules | low | mitigate | Zero `45-member`/`45-entry` hits remain; six sites read 46, locked at `notify-closed-set-locks.test.ts:62` | closed |
| T-116-13 | Denial of service | a permanently failing record holding the version gate open | low | mitigate | Cost re-measured by the code review (CR-01): a held gate is not an invisible repeated scan, it re-emits a user-visible `⊘ <plugin> (failed)` row per affected record on EVERY load, without end. `resolveRecordedPluginOffline` (`backfill.ts:485-495`) now answers a benign `undefined` for a record recorded `installable: true`, so the records the widened population added can neither emit that row nor hold the gate. Controlled both ways in `backfill.test.ts` ("converges over a clean record whose manifest cannot be read" / "still fails a degraded record under the same unreadable manifest") and at the entry point in `index.test.ts`. Residual: the pre-existing partially-installed case, unchanged by this phase | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-116-01 | T-116-SC | The phase touches no dependency manifest, so there is no install task for a legitimacy gate to precede. Any package addition invalidates this acceptance and requires the gate | Phase 116 plan set | 2026-09-09 |
| R-116-02 | T-116-06 | The redaction boundary is unchanged by this phase and the failure arm carries only a closed-set reason | Phase 116 plan set | 2026-09-09 |
| R-116-03 | T-116-14 | Pre-existing and tracked as `UPCASC-01`; named rather than silently inherited | Phase 116 plan set | 2026-09-09 |
| R-116-04 | T-116-05 | Pre-existing isolation, already covered from both sides by this suite | Phase 116 plan set | 2026-09-09 |
| R-116-05 | T-116-13 | **Amended 2026-09-09 after code review CR-01.** The original rationale ("the cost is a repeated offline scan, bounded by the version stamp") was wrong on both halves: the repeated scan emits a `(failed)` row per record per load, and a held gate is by definition NOT bounded by the version stamp. The widening's contribution is now mitigated rather than accepted. What stays accepted is narrower: for a record recorded `installable: false`, a permanently unreadable manifest still holds the gate open and re-emits its row each load. That is the population the SF-02 retry contract was designed for, it predates this phase, and changing it is a redesign of that contract rather than a fix to this one | Phase 116 plan set; amended by code review | 2026-09-09 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 15 | 15 | 0 | Claude (gsd-security-auditor) |

---

## What the audit did beyond an L1 grep

The register was authored at plan time and the level is L1, so the workflow permits
closing on grep depth. It was not closed that way. Each of the five high-severity
threats was **mutation-controlled** against a hardlink-free copy: the mitigation was
removed and the resulting redness counted, so a mitigation that happened to be
unreachable would have been caught. Three items had been flagged for extra scrutiny
because a green result there could have been hollow.

**T-116-01 — the only threat that can reverse an explicit user decision.** The pre-existing
case titled `ENBL-08: skips a disabled record whose supported set grew` does NOT gate the
filter it names: deleting `isRecordedButDisabled` leaves it green, because reinstall's own
refusal produces a `skipped` partition either way. That is a guard whose title claims more
than it checks, and it is carried as an open window rather than quietly relied on. What
closes the threat is the NEW measured-zero case, which does redden. With BOTH layers
removed the audit reproduced the actual elevation:

```text
actual: [ { kind: 'plugin-backfilled', scope: 'project', marketplace: 'mp', plugin: 'hello',
            version: '1.0.0', dependencies: [], installable: false, unsupported: [Array] } ]
expected: []
```

A disabled plugin's hooks, MCP servers and PATH entries restored at load time with no
command. Both layers are live and each has at least one case that fails when it alone is
removed.

**T-116-02 — a control whose success condition is "nothing changed"** is the weakest kind,
so it was checked rather than accepted. Widening `hasForceInstalledPlugin` makes the stamp
write bring an unsolicited `state.json` into existence and reddens exactly one case: the
named WR-01 control. It is live, not inert.

**T-116-03 — structural, not incidental.** The empty clone list is not an artifact of an
unreached path. Every git source shape is rejected at `deriveSourcePluginRoot` before any
clone is attempted, and the test's records are seeded at a set that WOULD grow — swapping
them to path sources yields two promotion rows, so the case cannot be green for a
no-growth reason.

## Findings recorded rather than fixed

- **No `## Threat Flags` section exists in any of the four SUMMARY files.** The absence of
  new attack surface is inferred from `116-04-SUMMARY.md` §6-§7 rather than declared. Not
  blocking, but the executor contract asks for the section.
- **`116-04-SUMMARY.md` §6.2 carries no threat ID** — "scan cost is now proportional to
  every recorded plugin, in both scopes" is phase-introduced resource surface, adjacent to
  but distinct from T-116-13 and T-116-05. Bounded by the version stamp. Register it if a
  follow-up phase touches the gate.
- **Two citation-drift errors**, documentation only; the mitigations were verified at their
  true locations. T-116-02's mitigation and `116-04-SUMMARY.md` §7 cite the WR-01 control at
  `backfill.test.ts:529`; it is at `:557`. `.planning/WINDOWS.md` entry 41 cites `:1445` for
  the `ENBL-08` case; it is at `:1582`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] Every high-severity threat mutation-controlled, not closed on grep depth

**Approval:** verified 2026-09-09
