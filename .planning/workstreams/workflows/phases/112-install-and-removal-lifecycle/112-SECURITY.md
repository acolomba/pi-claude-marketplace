---
phase: "112"
slug: "install-and-removal-lifecycle"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-09-09"
---

# Phase 112 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Run retroactively. All four plans carried a `<threat_model>` block, so the
register is plan-time authored and complete.

This phase wires the executable-writing bridge into the transactional install
ledger and into every removal path, so the security-relevant properties are
about **what survives a failure**.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Ledger undo to filesystem | A failed phase unwinds committed phases by removing artifacts | Names the ledger recorded, never names re-derived from the plugin |
| Cascade removal to filesystem | `cascadeUnstagePlugin` removes six bridges' artifacts | Recorded resource names off the install record |
| Staging sweep to `$HOME` | The GC recursively removes abandoned staging trees under the engine home | Directory entries under a user-writable root |
| Install record to disk | `resources.workflows` names what was written | Plugin-namespaced names |

---

## Threat Register

`T-112-SC` recurs once per plan; 22 unique IDs across 25 rows.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-112-01 | Tampering | `workflowsPhase.undo` (install) | high | mitigate | `install.ts:1264-1267` — payload is `c.stagedWorkflowNames` (the `onPlaced` report), never `prep.result.stagedNames`; `install.test.ts:10266` | closed |
| T-112-02 | Tampering | undo raising a containment refusal | high | mitigate | `phase-ledger.ts:89-91` and `:125-127` both re-throw `PathContainmentError`; bridge raises by class, `unstage.ts:56-71`, never folded into `failed[]`; `install.test.ts:10460` | closed |
| T-112-03 | Information disclosure | envelopes left after a failed install | high | mitigate | `install.ts:1217-1218` sentinel + empty name array set **before** the commit; undo gates on it `:1256`; `install.test.ts:10017` asserts `entriesOf(workflowsSavedDir) === []` as a filesystem fact | closed |
| T-112-04 | Repudiation | swallowed `failed[]` from undo | medium | mitigate | `install.ts:1272-1277` throws `WorkflowsUnstageFailureError`; `phase-ledger.ts:98-102` records the `RollbackPartial`; `install.test.ts:10364`, `:10446` | closed |
| T-112-05 | Tampering | `resources.workflows` on the record | medium | mitigate | `state-io.ts:123-127` required typebox member; `migrate.ts:138` default-fills **before** `STATE_VALIDATOR.Check`; `domain/name.ts:162` namespacing | closed |
| T-112-06 | Tampering | `workflowArtifactPath` composition | medium | transfer | Transfer target located: `locations.ts:362-378` runs `assertSafeName` then `assertPathInside`; every unlink routes through it (`unstage.ts:50`); `install.ts` composes no artifact path | closed |
| T-112-SC (01) | Tampering | package-manager installs | low | accept | `git log 1a478772..HEAD -- package.json package-lock.json` empty | closed |
| T-112-07 | Tampering | `cascadeUnstagePlugin` workflows slot | high | mitigate | `marketplace/shared.ts:403-406` passes the **recorded** names, never re-derived; `marketplace/shared.test.ts:740`, `:759` | closed |
| T-112-08 | Tampering | stale record after a partial cascade | high | mitigate | Both folds subtract the axis: `plugin/shared.ts:1248-1250`, `marketplace/remove.ts:344-347` | closed |
| T-112-09 | Information disclosure | envelopes surviving a removal | high | mitigate | Four verbs each assert ENOENT on disk: `uninstall.test.ts:349`, `enable-disable.test.ts:1047`, `marketplace/remove.test.ts:1221`, `marketplace/shared.test.ts:702` | closed |
| T-112-10 | Repudiation | a partial removal reported clean | medium | mitigate | `marketplace/shared.ts:409-419` typed error with structured `failedWorkflows[]`; the test asserts **both** blocked names, not just the first | closed |
| T-112-11 | Tampering | two removals racing one envelope | low | accept | `unstage.ts` treats ENOENT as success; `marketplace/shared.test.ts:775` | closed |
| T-112-SC (02) | Tampering | package-manager installs | low | accept | Same | closed |
| T-112-12 | Tampering | recovery removal after a post-commit failure | high | mitigate | `reinstall.ts:1451-1470` payload is `placedWorkflowNames` only; `reinstall.test.ts:8260` asserts a seeded foreign envelope is byte-unchanged | closed |
| T-112-13 | Information disclosure | envelopes surviving a failed reinstall | high | mitigate | `reinstall.ts:1393-1401`, `:1412`, `:1051-1054`; `reinstall.test.ts:8260` asserts ENOENT after a `saveState` rejection | closed |
| T-112-14 | DoS | a containment refusal destroying recovery | medium | mitigate | `reinstall.ts:1459-1469` — `unplaceWorkflows` catches everything and returns a leak; `reinstall.test.ts:8315` | closed |
| T-112-15 | Tampering | a record naming envelopes not written | medium | mitigate | `reinstall.ts:1593-1604` uses `resourcesFromHandles`, not the prepared handle; `reinstall.test.ts:8511` | closed |
| T-112-16 | Tampering | orphaned staging tree from a failed prepare | medium | mitigate | `reinstall.ts:1712-1714` — workflows arm is **first** in `abortPartialHandles`; `reinstall.test.ts:7946` | closed |
| T-112-SC (03) | Tampering | package-manager installs | low | accept | Same | closed |
| T-112-17 | Tampering | the sweep's recursive removal target | high | mitigate | `workflows-staging-gc.ts:156-160` — `assertPathInside(workflowsHomeDir, candidate)` anchored one level **above** the staging segment, resolved before any read through the candidate; `workflows-staging-gc.test.ts:230`, `:267` plant the symlink and assert both external trees survive. Mitigation SHAPE diverges — see Divergences | closed |
| T-112-18 | Tampering | a concurrent install's live staging root | high | mitigate | `workflows-staging-gc.ts:65-66` (24h max age) and `:133` mtime skip; `:121` executed green | closed |
| T-112-19 | Information disclosure | third-party code accumulating under `$HOME` | high | mitigate | Both lifecycle directions call it: `install.ts:1740-1744`, `uninstall.ts:478-482` | closed |
| T-112-20 | DoS | a sweep failure becoming the verb's outcome | medium | mitigate | `workflows-staging-gc.ts:177-183` per-entry swallow; both call sites wrap in bare `catch {}`; `install.test.ts:10586`, `uninstall.test.ts:4738` | closed |
| T-112-21 | Tampering | a non-directory entry in the staging dir | low | mitigate | `workflows-staging-gc.ts:127` `lstat` (unfollowed) and `:133` `!isDirectory()` skip; `:168` | closed |
| T-112-SC (04) | Tampering | package-manager installs | low | accept | Same | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

Transcribed here deliberately. The auditor noted that these five rows' rationale
lived only in the plan registers, and that an acceptance which is never carried
into a security artifact reverts to OPEN on the next audit.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-112-01 | T-112-11 | Two removals racing one envelope is harmless because `unstagePluginWorkflows` treats `ENOENT` as success rather than as a failure, so the loser of the race reports clean instead of inventing an error. Proven idempotent by `marketplace/shared.test.ts:775` ("removing twice reports no failure on the second pass"), not merely argued. | gsd-security-auditor (retroactive) | 2026-09-09 |
| R-112-02 | T-112-SC (plans 01-04) | No package-manager install occurs anywhere in this phase. Verified rather than assumed: `git log 1a478772..HEAD -- package.json package-lock.json` returns empty, so no supply-chain surface was introduced by any of the four plans. | gsd-security-auditor (retroactive) | 2026-09-09 |

---

## Verdict on the three load-bearing properties

**1. All-or-nothing materialization — pass.** `unstagePluginWorkflows` has
exactly three production call sites, each verified: `install.ts:1264` (ledger
undo), `marketplace/shared.ts:403` (cascade), `reinstall.ts:1460` (post-commit
recovery). Every removal verb funnels into one of them — `cascadeUnstagePlugin`
is reached from `uninstall.ts`, `enable-disable.ts:400` (disable),
`marketplace/remove.ts:703`, and `install.ts:1521` (pre-install converge). **No
unwind path omits the workflows arm.** The failure that matters — an orphaned
executable envelope whose owning record is gone — is closed on all four.

**2. Partial-cascade reporting — pass, and the ordering holds.**
`marketplace/shared.ts:407` assigns `dropped.workflows` **before** the throw at
`:409-419`; the catch at `:432` re-emits the frozen bundle. Pinned behaviorally
rather than structurally: the typed-failure test asserts `dropped.workflows` and
`dropped.hooks` on the **failing** path, so reordering the throw above line 407
turns it red.

**3. Lock re-entrancy — pass, structural rather than lucky.**
`enable-disable.ts` opens exactly one guard (`:803`) and calls the guard-free
`runInstallLedger` (`:311`) inside it; `install.ts:2210` calls
`runInstallLedgerBody` inside its own guard (`:2160`). The extraction is the
mechanism, documented at `install.ts:25-27` and `:827-832`. Neither
`bridges/workflows/**` nor `workflows-staging-gc.ts` imports `with-state-guard`
or `proper-lockfile`, so the sixth phase and the sweeper add no second lock
acquisition on any path.

---

## Divergences

1. **T-112-17's mitigation shape changed after the plan was written, and the
   in-source rationale now overstates what ships.** The plan says the assertion
   is resolved outside the swallowing `try` "so the refusal propagates." The
   shipped code resolves it outside the `rm` try but wraps it in a per-entry
   `try/catch` that records the refusal as a leak string
   (`workflows-staging-gc.ts:155-164`) — the WR-01 review fix. The **tampering**
   vector is fully closed either way: `rm` never runs on a refused entry, proven
   by both symlink tests asserting the external trees survive. What changed is
   observability, and it degrades further than the comment at `:148-154` claims
   ("still loud") — both call sites discard the leak array in a bare `catch {}`
   (`install.ts:1740-1744`, `uninstall.ts:478-482`), so a symlinked staging
   segment is refused **silently**, with no user-visible signal on either path.
   Not blocking: no register row claims a user-facing signal.

   Consequently stale, all asserting the superseded propagate behavior:
   `112-04-PLAN.md:389`, `112-04-SUMMARY.md:101`, and `112-VERIFICATION.md:32`'s
   citation of it.

2. **T-112-02 and T-112-14 are not in conflict.** The "propagate loudly"
   contract for `PathContainmentError` holds at the ledger boundary
   (`phase-ledger.ts:89-91`, `:125-127`) and is converted to a leak only in
   reinstall's recovery composer, which is already unwinding a different error.
   Both are separately registered and each matches its own code. Adjudicated at
   `112-03-SUMMARY.md:149`.

3. **The deferred WR-03 finding blocks nothing here.** No row in the register
   names `update.ts` as a component, and T-112-05's record-schema mitigation is
   satisfied by `state-io.ts` + `migrate.ts` independent of the update verb. The
   finding is also moot at HEAD — `update.ts:1385`, `:1394`, `:1451` show
   `prepareStageWorkflows` / `previousWorkflowNames` / `abortPreparedWorkflows`
   wired in.

4. **No summary carries a `## Threat Flags` section**, so the unregistered-flag
   cross-check was vacuous — absence of the section is not evidence that no new
   surface appeared. Mitigating factor: the phase's new surface was independently
   enumerated by two code-review iterations (CR-01, CR-02, WR-01..WR-08), and
   each of those findings maps onto a register row verified above.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 25 | 25 | 0 | gsd-security-auditor (retroactive, opus) |

Register parse: 25 rows across 4 plans — 7 / 6 / 6 / 6. Matches the
orchestrator's independent mechanical count, so no plan was audited as a subset.

Executed green at HEAD during the audit:
`tests/orchestrators/plugin/workflows-staging-gc.test.ts` (23/23) and
`tests/orchestrators/marketplace/shared.test.ts` (61/61).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-09
