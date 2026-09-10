---
phase: "113"
slug: "update-enable-disable-reconcile"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-09-09"
---

# Phase 113 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Run retroactively. All five plans carried a `<threat_model>` block, so the
register is plan-time authored and complete.

This phase makes `update` **re-stage** executable envelopes and makes
`enable`/`disable` remove and re-materialize them, so the security-relevant
questions are about the re-stage window, about telling the user when a retired
command is still runnable, and about read-only surfaces staying read-only.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Read-only surface to plugin tree | `info` and `pending` run a discovery pass over a plugin root | Attacker-controlled declared paths and script files |
| Rendered warning to user | Soft-fail warnings can carry filesystem paths | Absolute paths, redacted at the composition site |
| Re-stage window | An update displaces previous envelopes, then places new ones | Envelope bytes and target names |
| Retired command to user | A dropped workflow stays registered until reload | A reason token on the outcome row |

---

## Threat Register

`T-113-SC` recurs once per plan; 22 `mitigate` and 5 `accept` across 27 rows.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-113-01 | Information disclosure | discovery pass from a read-only surface | high | mitigate | `discover.ts:423` — `assertPathInside` runs before `scanWorkflowsDirectory` at `:429`; `info.test.ts:7069` | closed |
| T-113-02 | Information disclosure | rendered soft-fail warning | medium | mitigate | `info.ts:790` — `redactAbsolutePaths` at the composition site; `info.test.ts:7284` asserts basename reduction **and** absence of the full path | closed |
| T-113-03 | Tampering | symlinked script entries on preview discovery | high | mitigate | `discover.ts:82` dirent `!isFile()` + `:90` `!isSymbolicLink()`, both on the single scan path; refusal is tense-independent because `tense` feeds only `outcomePhrase` (`:203-205`). Evidence caveat — see Divergences | closed |
| T-113-04 | Spoofing | generated workflow name on `info` | medium | mitigate | `info.ts:788` reads `verdict.generatedName` off the admitted verdict; record arm `:1298` reads `record.resources.workflows`. No directory listing on either arm | closed |
| T-113-SC (01) | Tampering | package-manager installs | low | accept | No `package.json`/`package-lock.json` change in `4195e77d..3531fea6` (47 commits, verified mechanically) | closed |
| T-113-05 | Tampering | rename over an existing target | high | mitigate | `stage.ts:418` `assertTargetsUnoccupied` over the whole set, after displacement `:416`, before the first rename `:420`; fed by `update.ts:1395`; `update.test.ts:9347` | closed |
| T-113-06 | DoS | envelopes stranded with nothing naming them | high | mitigate | Union window `update.ts:1615`, narrow `:1992-1994`; `update.test.ts:9030` reads the **persisted** file mid-window via `watchStateTransition` | closed |
| T-113-07 | Repudiation | update reporting success over previous-version code | high | mitigate | `update.ts:2266-2278` turns a leak return into a `phase: "workflows"` failure with `committed: true`; success fields gated on the empty aggregate `:2003`; `update.test.ts:9091` | closed |
| T-113-08 | Tampering | a name derived from prepare rather than commit | high | mitigate | `update.ts:2262` `onPlaced` → `:1994` reads `args.workflows.placedNames`; `update.test.ts:9433` asserts the persisted record and names the prepared pair as the value that must **not** appear. Promised gate absent — see Divergences | closed |
| T-113-SC (02) | Tampering | package-manager installs | low | accept | Same range evidence | closed |
| T-113-09 | Tampering | an enable renaming over a foreign file | high | mitigate | Same `stage.ts:418` pre-check reached through `runInstallLedger`; `enable-disable.test.ts:1590` plants a foreign file and asserts bytes unchanged plus the record unwidened | closed |
| T-113-10 | DoS | a load-time pass rewriting envelopes every reload | high | mitigate | `workflow-kind-inversion.test.ts:261` — inode + nanosecond mtime + byte snapshot, backdated, with a live negative control at `:308` | closed |
| T-113-11 | Repudiation | a disable leaving runnable envelopes behind | high | mitigate | `enable-disable.ts:400` `cascadeUnstagePlugin`; `enable-disable.test.ts:1271` asserts the saved dir is empty | closed |
| T-113-12 | Information disclosure | staged names reaching a rendered row | low | mitigate | `enable-disable.ts:357` spreads `stagedWorkflows: true` — a boolean only; no name reaches a row | closed |
| T-113-SC (03) | Tampering | package-manager installs | low | accept | Same range evidence | closed |
| T-113-13 | Repudiation | a retired command runnable with nothing saying so | high | mitigate | **7** stamp sites, each set-difference or reported-removal gated: `update.ts:2640`, `enable-disable.ts:367/428/466`, `uninstall.ts:755/790`, `reinstall.ts:1662`; a passing case for each, plus 6 catalog states | closed |
| T-113-14 | Spoofing | the load-time projection claiming the remedy | medium | mitigate | `enable-disable.ts:1069-1093` — the token is structurally absent from `freshOutcomeToTypedResult` on both arms; `enable-disable.test.ts:1504`, `:1528` assert the **whole** projection by `deepStrictEqual`, not by key absence | closed |
| T-113-15 | Tampering | reinstall replacing an adjacent plugin's envelope | high | mitigate | `reinstall.ts:1398` `onPlaced` + `:1412` removal set from the record, never a listing; `reinstall.test.ts:8190` | closed |
| T-113-16 | Repudiation | a partial disable cascade reporting nothing changed | high | mitigate | `enable-disable.ts:428` reads the identical operand as the clean arm `:466`; `enable-disable.test.ts:1474` asserts `(failed) {unreadable, stale workflow command}` at error severity | closed |
| T-113-SC (04) | Tampering | package-manager installs | low | accept | Same range evidence | closed |
| T-113-17 | Tampering | symlink planted at the staging segment | high | mitigate | `workflows-staging-gc.ts:267-271` anchors on `workflowsHomeDir`, one level above staging, resolved **before** `readDisplacedEnvelopes` `:276`; `workflows-staging-gc.test.ts:499`, sweep twin `:267` | closed |
| T-113-18 | Information disclosure | the rendered retained-tree line | medium | mitigate | `notify.ts:3364` interpolates a `readdir` basename and a count; the containing location is fixed literal text; catalog `output-catalog.md:2237,2283` carry no leading-slash path | closed |
| T-113-19 | Repudiation | recovery copies invisible to the operator forever | high | mitigate | `reconcile/pending.ts:257` — one call outside the per-scope loop, rendered on **both** arms; `pending.test.ts:627`, `:646`; catalog `:2228`, `:2273` | closed |
| T-113-20 | Tampering | a read-only surface creating or modifying the staging tree | high | mitigate | `scanRetainedWorkflowsStaging` (`workflows-staging-gc.ts:226-291`) contains zero write calls, scanned mechanically; `pending.test.ts:748` asserts `readdir(workflowsHomeDir)` rejects ENOENT. Promised gate absent — see Divergences | closed |
| T-113-21 | DoS | a scan failure becoming the command's outcome | medium | mitigate | The scan is **total** — every failure arm returns or continues (`gc.ts:232`, `:251`, `:272`, `:329`); `pending.test.ts:767`. Mechanism diverges from the plan — see Divergences | closed |
| T-113-22 | Tampering | a live staging root reported as abandoned | medium | mitigate | `gc.ts:240` reuses the exported `WORKFLOWS_STAGING_MAX_AGE_MS` **by name**, the same constant the sweep reads at `:117`; `workflows-staging-gc.test.ts:430` | closed |
| T-113-SC (05) | Tampering | package-manager installs | low | accept | Same range evidence | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

Transcribed here because the auditor flagged that these five rows had nowhere to
verify against on a re-run — their rationale lived only in the plan registers.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-113-01 | T-113-SC (plans 01-05) | No package-manager install occurs in this phase, so no supply-chain surface was introduced. Verified mechanically rather than assumed: no `package.json` or `package-lock.json` appears anywhere in `4195e77d..3531fea6`, a 47-commit range. | gsd-security-auditor (retroactive) | 2026-09-09 |

---

## Verdict on the three load-bearing items

**1. The re-stage window holds — structurally, now that the count-based proof is
gone.** The accepted override removed a grep threshold that required
`abortPreparedWorkflows` to appear three times, because the two-helper shape it
was written against was merged into one guarded `abortHandles`. The property that
threshold stood for survives without it: `update.ts` has exactly **one** unwind
implementation, `abortHandles(handles: Partial<PrepHandles>)` at `:1449`, whose
workflows arm at `:1451-1453` is unconditional. It has exactly **two** call sites
— the prepare catch `:1398` and the intent-mark catch `:2544` — and there is no
third unwind path in the file. After the intent mark, unwinding passes to the
commit, which is symmetric by construction.

Both window properties hold:

- *Cannot rename over content it does not own* — `assertTargetsUnoccupied`
  (`stage.ts:346-354`) checks the whole set after displacement and before the
  first rename, so a refusal provably leaves zero completed renames.
- *Cannot end up owning an envelope it did not ship* — the intent-mark union
  excludes probed-foreign names (`update.ts:1614-1620` via
  `foreignOccupiedTargets`), and the failure arm records only
  `previous ∪ placedNames`, where `placedNames` comes from `onPlaced`, which on
  the throw path reports only `stranded` (`stage.ts:487`).

**2. The WLIF-06 extension holds** — all seven stamp sites exist and each has a
passing case. Every verb that can strand a registered command is covered:
uninstall clean and `(failed)`, disable clean and partial cascade, enable,
update, reinstall. One scoped observation, not a gap: an update whose phase 3
**failed** does not carry `{stale workflow command}`, because `update.ts:2640`
sits past the failure guard — but that row already carries `{rollback partial}`,
`[workflows] (rollback failed)`, the verbatim restore-leak text, and a
`plugin-uninstall + plugin-install` recovery hint. That is a stronger remedy than
a reload, and the register never claimed the token there.

**3. Withdrawn workflows are removed, not orphaned.**
`displacePreviousTargets` (`stage.ts:287`) moves **every** previous name into
`.previous/`; only the currently-admitted rename pairs come back out, and the
success-path `cleanupStaging` (`:492`) discards the rest. Pinned end-to-end on
update (`update.test.ts:8858`, and `:8899` for a rename), and on reinstall
(`reinstall.test.ts:8559`).

---

## Divergences

All property-preserving; recorded because the plan text no longer describes the
implementation.

1. **T-113-21's mechanism was swapped deliberately.** The plan says "the call
   site swallows, matching the sweep's call sites." The implementation has **no
   try/catch** at `pending.ts:152-157` and relies on the scan being total
   instead. Documented in `113-05-SUMMARY.md` — the wrapper was written,
   measured at `branches 37/38` unreachable, then removed rather than suppressed.
   Residual, `medium` and below threshold: a throw from `locationsFor` or
   `composeRetainedWorkflowsAdvisories` would still escape, because only the scan
   is total, not the wrapper.

2. **Two promised grep gates do not exist.** T-113-08's plan promises "a grep
   gate pins the callback's presence" — `grep -rn onPlaced tests/architecture/`
   returns 0. T-113-20's promises "a grep gate pins the absence of write calls in
   the module", which could not exist as literally worded, since the module also
   hosts the destructive sweep and imports `rm`. Both properties were verified by
   direct read and both carry stronger behavioral cases, so the threats are
   closed — but neither is guarded against reintroduction.

3. **T-113-03's symlink case runs at the wrong tense.** The plan promises a
   symlink case "on the preview path"; the case at `discover.test.ts:277` runs at
   `tense: "install"`, and no preview-tense symlink case exists. Closed on the
   structural argument that the refusal predates and ignores the tense
   (`tense` feeds only `outcomePhrase`).

4. **T-113-13's disposition was widened by accepted override** from four verbs to
   six, landing as seven stamp sites. Every added site is backed by a passing
   case.

5. **No summary carries a `## Threat Flags` section** — the section was not
   emitted at all rather than emitted empty. The executor-recorded deviations
   that belonged there (the `abortHandles` merge, the swallow removal, the extra
   stamp sites) are in `## Deviations from Plan` instead, and all three map onto
   registered threats.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-09 | 27 | 27 | 0 | gsd-security-auditor (retroactive, opus) |

Register parse: 27 rows across 5 plans — 5 / 5 / 5 / 5 / 7. Matches the
orchestrator's independent mechanical count, so no plan was audited as a subset.

Bypass scan clean: the phase's test delta adds zero `as any`, `as unknown as`,
`.skip(`, `.todo(`, `@ts-ignore`/`@ts-expect-error`, or coverage-ignore lines.

Live spot-checks run during the audit, all green: `workflows-staging-gc` +
`pending` + `bridges/workflows/{stage,discover}` (112/112), `enable-disable`
(77/77), `update` (160/160), 0 skipped, 0 todo.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-09
