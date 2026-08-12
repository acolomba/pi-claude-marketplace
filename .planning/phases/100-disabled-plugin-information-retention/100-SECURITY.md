---
phase: 100
slug: disabled-plugin-information-retention
verdict: SECURED
status: verified
# threats_open = count of OPEN threats at or above block_on severity (the blocking gate)
threats_open: 0
threats_verified: 16
asvs_level: 1
block_on: high
created: 2026-08-12
retroactive: true
---

# Phase 100 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified against the source tree at `d14393d9` (the last commit touching
> `extensions/` or `tests/`; planning HEAD `f961f6f8`), not against SUMMARY.md
> claims. Every "closed" verdict cites the read that produced it.

---

## Method

**This run is retroactive.** The phase completed, passed verification (13/13) and
passed human UAT (3/3) without its `verify:post` security step ever firing —
`workflow.security_enforcement` resolves to `true` by default, but it is absent
from `.planning/config.json`, and the verify-work run resolved the hook as
inactive on that basis. The gate was skipped, not waived. The v1.18 milestone
audit caught the divergence (five of six phases carried a SECURITY.md; this one
did not) and this file closes it.

Because the gate was skipped once, the ASVS L1 short-circuit was deliberately
NOT taken. At L1 with a plan-time register and no open threats, the workflow
permits stamping a clean file from grep-depth classification alone; a
self-classified clean result is exactly the false green worth avoiding here, so
the register was handed to `gsd-security-auditor` for mitigation verification
against the code. Verification went past L1 depth for the four threats whose
claim is about ordering or bypass rather than presence (T-100-01, -03, -12, -13).

Register origin: `register_authored_at_plan_time: true` — all five PLAN.md files
carry a parseable `<threat_model>` block. 16 distinct threats after
deduplication across the five plans (several recur, e.g. T-100-11 in plans 03
and 05). Scope was therefore mitigation verification, not threat discovery.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `state.json` → extension | Persisted installation records are state-supplied data. A hand-edited or corrupted record crosses this boundary on every load. | Install records incl. the new `hookEntries` key |
| `state.json` → filesystem path composition | `resources.hooks[i]` is used as a path component composing `<hooksDir>/<slug>/hooks.json`. | Slug strings (traversal candidates) |
| record → hook dispatch registry | The hydrate walk turns record content into registered, runnable hook handlers. | Event names, matchers, handler commands |
| `state.json` → rendered list/info output | Record fields, including the retained component inventory, render as an authoritative description of what is installed. | Names, versions, inventory, reasons |
| marketplace manifest → rendered output | The manifest lookup decides whether an absence claim may be made at all. | Declared-plugin entries |
| `info --fetch` → network | The fetch flag is the only path from this surface toward a remote; the disabled arm must not open it. | Clone + credential seams |
| catalog prose → future authors | `docs/output-catalog.md` is the authority later phases read; a false paragraph propagates into code. | Documented byte forms |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-100-01 | Tampering | hooks read-site path composition | high | mitigate | `assertPathInside` still runs ahead of `readFile` with an early return on throw — `event-router.ts:651` before `:675`, neither line touched by this phase. The record-wins branch composes no path at all (`info.ts:1126-1128` reads `record.hookEntries` directly), so the new key strictly reduces traversal surface. | closed |
| T-100-02 | Spoofing / Info disclosure | info read ladder; retained inventory; fixture purity | medium | mitigate | A tampered record can make `info` display false entries but cannot register a handler: `grep -rn "hookEntries" bridges/` returns **zero** matches — not "none outside comments", none at all. Status token holds first position (`notify.ts:2440-2447`, `:3276-3279`). Catalog fixtures are hand-authored literals (`catalog-uat.test.ts:708`, `:3066`), never synthesized from the code under test. | closed |
| T-100-03 | Elevation of privilege | `event-router.ts::hydrateScopeFromState` | high | mitigate | `event-router.ts:607` `if (isRecordedButDisabled(pluginRecord)) { continue; }` is the **first** statement of the per-plugin loop, ahead of the slug read (`:611`) and `tryHydrateOnePlugin` (`:621`); both hydrate entry points funnel through the guarded function (`:576`, `:766`). Protection is now explicit rather than incidental on file absence. Load-bearing — see Mutation Reasoning. | closed |
| T-100-04 | Denial of service | `state.json` growth from `hookEntries` | low | accept | Accepted; re-verified accurate. See Accepted Risks Log. | closed (accepted) |
| T-100-05 | Tampering | `PLUGIN_INSTALL_RECORD_SCHEMA` input validation | high | mitigate | `state-io.ts:112` places `hookEntries` inside the record schema (`:84`) → `MARKETPLACE_RECORD_SCHEMA:231` → `STATE_SCHEMA:240` → the single `STATE_VALIDATOR` (`:255`), checked on load (`:409`) and save (`:432`). One validation boundary, not a second. Element schema is two string fields (`:55-58`); no second parse path exists into the key. | closed |
| T-100-06 | Tampering | `shared.ts::removePluginRecord` | medium | mitigate | `shared.ts:774-787` builds a new root object, spreads `marketplaces` and `plugins`, and deletes on the **copy**; the caller's snapshot is untouched. Asserted at `shared.test.ts:257`. | closed |
| T-100-07 | Spoofing | `install.ts` cross-plugin conflict guard | medium | mitigate | Exclusion scoped to one record (`install.ts:878-882`). Name comparison is `Map.set`/`Map.get` on raw strings (`shared.ts:664-672`, `:687`) — no case folding, no Unicode normalization. Negative control at `shared.test.ts:191` still raises for a genuine cross-plugin collision, so the guard did not degrade to a no-op. | closed |
| T-100-08 | Information disclosure | persisted payload shape | medium | mitigate | Two-property element schema (`state-io.ts:55-58`). All three write sites feed from `projectHookSummaryEntries` (`install.ts:1100`, `update.ts:2001`, `reinstall.ts:1687`), which emits only `{event}` / `{event, matcher}`. The read boundary **rebuilds** objects field-by-field rather than spreading (`hooks.ts:1035-1041`). No command / args / env / timeout field exists anywhere on the path, so the record never becomes a durable copy of a plugin's shell commands. | closed |
| T-100-09 | Spoofing | `list.ts` absence derivation | high | mitigate | A failed manifest read returns `{ kind: "unverified" }` **before** `lookupDeclaredPlugin` is reachable (`list.ts:900-905`); `:407` sets `notInManifest` only on `kind === "absent"`; `:348-350` returns `{}` otherwise. A read failure therefore cannot render an absence claim as authority (BOUND-03). | closed |
| T-100-10 | Information disclosure | `notify.ts` disabled render arm | medium | mitigate | Both named leak sources stay structurally excluded: `notify.ts:2446` passes `composeReasons(p.reasons, false, false, probe)` with both soft-dep flags hard-coded, and `soft-dep.ts:56-62` returns `[]` when both are false; the list arm derives `declaresAgents`/`declaresMcp` **below** the disabled early return (`list.ts:429-451`); the info arm filters through the closed `DISABLED_ROW_REASONS` set (`info.ts:946-953`, applied `:997`), which admits no unsupported-kind or soft-dep token. Scope note below. | closed |
| T-100-11 | Tampering | `docs/output-catalog.md` and its byte fixture | medium | mitigate | Paired in both directions: `output-catalog.md:354` ↔ `catalog-uat.test.ts:708`, and `output-catalog.md:1739` ↔ `catalog-uat.test.ts:3066`. The gate is bidirectional — forward walk at `catalog-uat.test.ts:4634`, inverse orphan-fixture walk at `:4876` — so neither a state without a fixture nor a fixture without a state can land. | closed |
| T-100-12 | Spoofing | disabled status injection in the shared block builder | high | mitigate | `applyDisabledRowShape` is applied at **both** record-bearing arms of the sole block builder (`info.ts:832` manifest-absent, `:885` installed bucket), and the status override at `:996` beats every internal producer (`:1051`, `:1319`, `:1512`, `:1604`, `:1647` all return through those two call sites). The third arm returns at `:801` before a record is read, so no arm that can see an installation record is unprotected. Both cascade entry points route through `buildBlock` (`:2274`, `:2305`). Read through the shared predicate, not a twin. | closed |
| T-100-13 | Information disclosure | `info --fetch` on a rerouted disabled scope | high | mitigate | `info.ts:868` nulls the fetch context itself for a disabled record (`blockFetchCtx = isRecordedButDisabled(installed) ? undefined : fetchCtx`), with the conditional spread at `:879`; arm (b) is network-free by signature (`:1031-1039`). Zero-call proof at `info-manifest-absent.test.ts:1764-1843`. Load-bearing — see Mutation Reasoning. | closed |
| T-100-14 | Repudiation | fetch-skip note | medium | mitigate | `skipReason` is a producer-stamped field on `InfoBlock` (`info.ts:748-754`, stamped by `skipReasonFor` at `:1007-1016` from `:833`/`:886`) and is consumed by reading the field (`emitFetchSkip`, `:2183-2195`), never re-derived from the rendered row. Bytes pinned at `info-manifest-absent.test.ts:1335,1394,1490,1840`. | closed |
| T-100-15 | Repudiation | catalog prose accuracy | medium | mitigate | All named corrections present: the cascade-path claim is replaced and its byte form now points inside the info section (`output-catalog.md:1717-1723`), the mixed fetch-skip paragraph states the both-causes-one-scope rule (`:1670-1674`), and the severity-routing paragraph enumerates the new state by name alongside both warning states (`:1558`). | closed |
| T-100-SC | Tampering | npm/pip/cargo installs (supply chain) | low | accept | Accepted; zero dependency delta verified. See Accepted Risks Log. | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Mutation Reasoning

Two high-severity mitigations rest on a test being load-bearing rather than on
code presence alone. Both were reasoned structurally; neither suite was executed
during this audit (the phase's own verification ran them green at
2026-08-12T01:05Z, and no source commit postdates that run).

**T-100-03.** `event-router.test.ts:813-850` seeds a REAL `<hooksDir>/hooky/hooks.json`
and a record whose only varying axis is `enabled`. The disabled case (`:852`)
asserts `_parsedConfigCacheForTest().size === 0`; the enabled control (`:866`)
asserts the *same fixture* yields `size === 1`. Deleting `event-router.ts:607-609`
makes the disabled case take the control's path — cache size 1, assertion red.
File presence cannot mask the guard, which is the whole point: retention names a
slug whose file could be restored by any means.

**T-100-13.** The `:1764` case seeds a git-source, manifest-**declared**, disabled
record with no clone on disk, injects the clone-cache and credential seams, and
passes `fetch: true`. That input travels the manifest-backed arm where `fetchCtx`
*is* threaded, so removing the `:868` gate makes it clone and fetch for real and
five counters leave zero. A paired render assertion (`:1823-1842`) blocks a
vacuous pass from a dropped block. Worth recording precisely: every *other*
disabled `--fetch` case in that file routes to the signature-network-free arm and
is not load-bearing for this gate. The mitigation's proof rests on that one case.

---

## Scope Note — T-100-10

The plan-time claim was that the disabled row "stamps at most the single
manifest-absence member." What shipped admits **six** reasons on the info surface:
`not in manifest` plus the five failure-class tokens (`source missing`,
`unreadable`, `permission denied`, `network unreachable`, `authentication
required`), landed as review-fix WR-01 (`fc2232e8`).

This is a decided widening, not drift. `100-VERIFICATION.md` records it as an
operator ruling (truth #11: "disabled row hides unsupported-kind tokens but keeps
the five failure-class reasons"), and ENBL-16 supersedes INV-04 accordingly in
`.planning/REQUIREMENTS.md`. The threat is *unrelated reason sources leaking onto
the row*, and both named sources remain structurally excluded; the added tokens
are closed-set outputs of `narrowProbeError` describing a read this surface
actually performs, so no free text and no path reaches the row. The list surface
still carries the single member. **CLOSED** — the plan's wording was a bound on
leak sources, and that bound holds.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-100-01 | T-100-04 | `state.json` growth from `hookEntries` is bounded by the plugin's own manifest — one entry per (event, group), emitted only by `projectHookSummaryEntries` over the plugin's supported hooks config, the same order of magnitude as the existing skills inventory. Each write **replaces** rather than appends (`install.ts:1188` sets once, `update.ts:1756-1759` deletes or assigns, `reinstall.ts:1732` assigns), so no unbounded growth path exists. No explicit cap added, as declared at plan time. | Operator (plan-time disposition, re-verified 2026-08-12) | 2026-08-12 |
| AR-100-02 | T-100-SC | The phase installs no external package and adds no `package.json` entry, so the package-legitimacy gate has no input. Verified: `git diff --stat b5eb0f7a~1..HEAD -- package.json package-lock.json` is empty and `git log` over the same range for those paths is empty — zero dependency delta across the whole phase. Recorded rather than omitted so a later task adding an install cannot inherit silence. | Operator (plan-time disposition, re-verified 2026-08-12) | 2026-08-12 |

---

## Observations — not verdict items

Three findings outside the register. None blocks; each is recorded so it is not
rediscovered from scratch.

1. **No SUMMARY carries a `## Threat Flags` section.** All five use
   `## Threat Model Disposition` instead (`100-01-SUMMARY.md:220`, `-02:239`,
   `-03:239`, `-04:244`, `-05:235`). Those tables map onto the register with no
   unmapped entries, so nothing was lost — but the executor had no channel for
   reporting new attack surface discovered *outside* the register. This is a gap
   in the reporting channel, not in this phase's coverage.

2. **A second cache-population seam has no disabled predicate.**
   `event-router.ts:259` `readAndCachePluginHooks` reaches `addPluginConfigToCache`
   (`:290`) and is called from `install.ts:1492`, `reinstall.ts:1304`,
   `update.ts:1827`. It carries no `isRecordedButDisabled` guard — protection rests
   on those callers being enabling operations, and on the disabled-update path
   short-circuiting into `refreshDisabledRecord` (`update.ts:1549+`, which
   materializes nothing) before reaching `:1827`. Same elevation-of-privilege class
   as T-100-03, one seam over, currently guarded by control flow rather than by the
   predicate. Worth a register row the next time a branch there changes.

3. **Persisted schemas are deliberately lenient.** `Type.Object` without
   `additionalProperties: false` lets a hand-edited record carry unknown sibling
   keys past `STATE_VALIDATOR` and be rewritten by `saveState`. This is a house
   stance rather than an oversight — `tests/architecture/no-hooks-strict-additional-properties.test.ts`
   *forbids* the strict flag in the hooks schema (HOOK-03). T-100-08 is unaffected:
   its control is the read boundary, which rebuilds objects field-by-field
   (`hooks.ts:1035-1041`) rather than spreading them.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-12 | 16 | 16 (14 mitigated, 2 accepted) | 0 | gsd-security-auditor (retroactive; gate skipped at verify:post) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-12
