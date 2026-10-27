---
phase: quick-261027-9nh
plan: 01
status: complete
subsystem: marketplace-autoupdate
tags: [autoupdate, background-update, abort, parity, cucumber]
requires: [AUP-01, AUP-02, AUP-03]
provides:
  - domain/official-marketplaces.ts (isOfficialMarketplaceName, effectiveMarketplaceAutoupdate)
  - platform/git.ts runWithGitAbortSignal (AsyncLocalStorage abort scope)
  - BackgroundGate.waitForStep (30 000 ms cap with abort); beginStep resolves with the step's AbortSignal
  - BackgroundPassDeps.runWithAbortSignal
affects: [marketplace list, marketplace info, plugin info, plugin list, marketplace update, marketplace autoupdate/noautoupdate, bootstrap, background pass, background gate, session shutdown]
tech-stack:
  added: []
  patterns: [AsyncLocalStorage abort scope at the git HTTP client, capped gate wait that aborts the in-flight step]
key-files:
  created:
    - extensions/pi-claude-marketplace/domain/official-marketplaces.ts
    - test/domain/official-marketplaces.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - features/marketplace/background-update.feature
decisions:
  - D-PL8-07 reversed (official-name default on)
  - D-PL8-02 mode half reversed (tui only)
  - D-PL8-19..D-PL8-25
metrics:
  completed: 2026-10-27
actuals:
  tokens: 38816
  tasks: 3
  commits: 7
plan_head_before: 1edf335b1bddfbe6e2df5a3ea761abc7efc265a0
plan_head_after: 238b15840193e39ddb35c9bbcc601fba1c5c58ba
---

# Quick 261027-9nh: Phase 8 background autoupdate follow-ups Summary

Official Claude Code marketplace names default to autoupdate on at every reader, only a tui session arms the background update, the notice names each plugin once, a not-run update is skipped, and a command or runtime switch waits at most 30 s for a background step, whose git transfer is then aborted through an AsyncLocalStorage scope in `platform/git.ts`.

## Commits

| Commit | Subject |
| -------- | ----------------------------------------------------------------------- |
| 2f52b459 | feat(marketplace): turn autoupdate on by default for official names |
| a2b89be4 | fix(marketplace): report a background update never run as skipped |
| df2ecc2e | fix(marketplace): name each plugin once in the background update notice |
| de5d89c1 | feat(marketplace): run the background update in tui sessions only |
| 0011957a | fix(marketplace): stop a background step that holds a command past 30s |
| be78f527 | docs: record the background autoupdate follow-up decisions |
| 238b1584 | test(marketplace): expect bootstrap to keep the official default |

Commits measured with `git rev-list --count 1edf335b..HEAD` = 7.

## Files touched

- Domain: `extensions/pi-claude-marketplace/domain/official-marketplaces.ts` (new), `domain/unsupported-components.ts`
- Orchestrators: `orchestrators/marketplace/{autoupdate,background-gate,background-pass,background-update,list,shared,update}.ts`, `orchestrators/plugin/{bootstrap,list-flow}.ts`, `orchestrators/scope-fanout.ts`
- Platform and shared: `platform/git.ts`, `shared/notification-grammar.ts`, `index.ts`
- Unit tests: `test/domain/official-marketplaces.test.ts` (new), `test/edge/register.test.ts`, `test/orchestrators/marketplace/{autoupdate,background-gate,background-pass,background-update,list,update}.test.ts`, `test/orchestrators/plugin/{bootstrap,list-flow}.test.ts`, `test/orchestrators/scope-fanout.test.ts`, `test/platform/git.test.ts`, `test/shared/notification-grammar.test.ts`
- Behavioral: `features/marketplace/{autoupdate,background-update}.feature`, `features/plugin/bootstrap.feature`, `features/step_definitions/session.steps.ts`, `features/lib/pi-commands.ts`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`
- Docs: `docs/env-vars.md`, `docs/output-catalog.md`, `docs/json-output.md`, `.planning/phases/08-background-autoupdate/08-CONTEXT.md`, `.planning/phases/08-background-autoupdate/08-04-SUMMARY.md`

No notification payload or wire schema changed, so `npm run schema:generate` was not needed.

## Decisions

| ID | Decision |
| ---------------------------- | -------- |
| D-PL8-07 (reversed 2026-10-27) | With no value in either config layer, a marketplace's autoupdate is Claude Code's default: on when its lowercased name is one of the 14 official names other than knowledge-work-plugins and first-party-plugins, off otherwise; every reader applies it. Claude Code's claudeai and pluginDirectory default-on sources stay a Pi capability gap. |
| D-PL8-02, mode half (reversed 2026-10-27) | Only tui arms the background update; rpc, json, and print never arm it; per-runtime re-arming unchanged. |
| D-PL8-19 | Bootstrap writes no autoupdate value; its autoupdate step reports (skipped) {already autoupdate} on every run unless a config layer set the value off. |
| D-PL8-20 | The cucumber suite drives Pi over RPC only (tui needs a TTY), so background-update.feature proves the RPC negative; the pass, the notice dedupe, and the wait cap are proven by unit tests; the background-update wire kind stays in the schema though no json or rpc session emits it. |
| D-PL8-21 (amends D-PL8-10) | The notice dedupes by bare plugin name in first-seen order; the JSON payload keeps one row per updated install. |
| D-PL8-22 | A plugin update the pass did not run (runtime stopped, or pass halted after an abort) is a skipped outcome with a note and an empty reason list; D-PL8-18's autoupdate-off outcome stays failed. |
| D-PL8-23 | runForeground and a reload/new/resume/fork shutdown wait at most 30 000 ms for the step in flight; at the cap the gate aborts the step's AbortSignal, logs one debug line, and waits for the step to end; quit unchanged; no environment knob. |
| D-PL8-24 | The abort reaches git through an AsyncLocalStorage scope in platform/git.ts (runWithGitAbortSignal) that aborts HTTP hops and response bodies, and fails a network call that the scope aborted while it ran; an aborted step fails like a network drop mid-request, fail-clean. |
| D-PL8-25 | After an aborted step the pass runs no further step in that runtime; an unfinished aborted plugin update is skipped; a finished one keeps its outcome; plugins moved before the abort are still named while the runtime is alive. |

D-PL8-23 closes the gate's "no timeout" known limit and review IN-04. 08-04 uncertain choices 1, 6, 10, 13, and 17 are settled.

## Verification

- Decision 2 (official default): `test/domain/official-marketplaces.test.ts`, one official-name case per reader's owner test, and the new `features/marketplace/autoupdate.feature` Outline and noautoupdate scenario, with the updated `features/plugin/bootstrap.feature` (part 1).
- Decision 3 (tui only): `background-update.test.ts` arms in tui and never in rpc, print, or json. `features/marketplace/background-update.feature` is now one RPC-negative scenario. RED check done: with rpc arming again in `background-update.ts`, the scenario failed at `Then the session reports no results` (1 failed, 3 skipped); the source was restored and `ctx.mode !== "tui"` confirmed.
- Decision 4 (dedupe): `notification-grammar.test.ts` rows "names a plugin of two marketplaces once" and "names each plugin once in first-seen order"; `test/architecture/background-update-notice.test.ts` still passes.
- Decision 5 (skipped not-run outcome): the stopped-runtime case in `background-pass.test.ts` (part 1). No user-visible surface: the pass's cascade output goes only to the debug log.
- Decision 1 (cap and abort): `background-gate.test.ts` (fresh signal per step; no timer with no step; ended before the cap: not aborted and timer cleared; at the cap: aborted, one debug line, command runs after the step ends; two waiters: one abort and one line; default cap 29 999 ms vs 30 000 ms), `background-update.test.ts` (a reload shutdown aborts at the cap), `background-pass.test.ts` (each step in its own scope; refresh abort ends the pass; aborted failed or thrown plugin update skipped; aborted finished update kept and named; a throw outside an abort passes through), `git.test.ts` `describe("runWithGitAbortSignal")` (9 cases), and `update.test.ts` "a refresh whose fetch is aborted leaves state.json, the clone, and the state lock as they were".
- Fail-clean proofs: the `update.test.ts` case above (refresh); the existing `clone-cache.test.ts` "MA-9: a clone failure cleans staging and rethrows" (interrupted plugin clone); `git.test.ts` "a fetch whose request never answers rejects with the abort reason and leaves the refs as they were" (interrupted fetch of an existing clone, header phase).
- Direct coverage at 100% for `platform/git.ts`, `background-gate.ts`, `background-pass.ts`, `background-update.ts`, and `notification-grammar.ts`; `npm run lint` and `npm run fallow` green before the code commit; every commit passed the hook (`npm run check:commit`).
- `npm run check` after the last commit (238b1584): **exit code 0** (906 cucumber scenarios passed; direct coverage merged 295 records). The first run, after be78f527, exited 1 on `test/edge/register.test.ts` (deviation 1b), which 238b1584 fixed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] A network call that the abort scope aborted while it ran now fails with the abort reason**
- **Found during:** Task 3, step 1
- **Issue:** isomorphic-git's pkt-line reader (`GitPktLine.streamReader`) catches a body read error and reports it as the end of the stream. An abort during a ref advertisement body would then read as a shorter, complete list: `listRemoteTags` could return a cut-short tag list as a success, and a discovery body cut before its first line raised `EmptyServerResponseError` instead of the reason.
- **Fix:** `platform/git.ts::networkCall` wraps the four network calls; its `finally` calls `gitAbortScope.getStore()?.throwIfAborted()`, so a call the scope aborted while it ran fails with the abort reason.
- **Proof:** `git.test.ts` "a tag listing whose tag list is cut off by the abort rejects instead of returning part of it".
- **Commit:** 0011957a

**1b. [Rule 1 - Bug] `test/edge/register.test.ts` still expected the pre-D-PL8-19 bootstrap output**
- **Found during:** the final `npm run check` (first run exit 1; only this pair failed, all 906 cucumber scenarios passed)
- **Issue:** part 1's bootstrap change did not update the registered-bootstrap case outside `files_modified`; the hook ran only the staged pairs, so it did not catch it.
- **Fix:** the case now expects `● claude-plugins-official [user] <autoupdate> {already autoupdate}` and a user `claude-plugins.json` with no autoupdate value and no `plugins: {}`.
- **Commit:** 238b1584

**2. [Minor] `Then the session reports no results` only asserts the empty result list**
- The plan said it also marks results and notices compared. With no results there is nothing to mark, so the step asserts and nothing else.

**3. [Minor] The gate keeps no private uncapped wait helper**
- Each waiter is woken by `endStep`, and the cap timer only aborts the step, so the wait after the cap is uncapped without a separate helper.

**4. [Minor] The git abort cases use `isomorphic-git/http/node` request mocks for the hop and body cases**
- The file's `installRemoteTransport` style lets a case hold a request or a body read. Only the stalled-pack case uses a socket-door double, because it asserts that the Node stream is destroyed.

**5. [Plan premise corrected] The stalled-pack case does not assert unchanged remote refs**
- isomorphic-git writes origin's remote-tracking refs before it reads the pack, so an abort during the pack transfer leaves them at the new oids. See uncertain choice N3.

**6. [Retired] The positive background Outline (dir, file, url, github) is gone**
- It cannot run under the RPC-only harness after decision 3. The feature file now holds the one RPC-negative scenario.

## Uncertain choices (for user review)

From part 1:

1. Bootstrap tables use `| name | source |`, because the config step drops an all-empty autoupdate column.
2. Bootstrap unit test: a fresh bootstrap no longer writes `plugins: {}`.
3. The inherited-default flip case uses a `marketplaces: {}` base.
4. The helpers are split into the skipped not-run builder (note "the background update stopped before this update ran") and `autoupdateOffOutcome` (still failed, D-PL8-18).
5. Bootstrap reports `{already autoupdate}` even when `claude-plugins.local.json` sets false (LAYER-02); the effective value is off either way.
6. The skipped not-run debug row reads `{unreadable manifest}` (WR-06 fallback, no new reason token). Alternatives: a new reason token, which needs a COMPAT-01 amendment across types, wire, schema, closed-set tests, and docs; or a dedicated outcome field the cascade mapper reads. The same applies to the aborted note (N4).
7. The default is judged by the lowercased name only; the claudeai and pluginDirectory sources are a Pi capability gap.
8. README left as is.

From the planner:

9. T-9nh-04, impersonation exposure: any source whose manifest names itself after an official Claude Code marketplace now gets unattended updates by default. Claude Code blocks that impersonation at add time; this milestone's MKT-01 reserved-name refusal (Phase 5) carries the same refusal here. Transferred to MKT-01.
10. After an abort at the cap, the waiter waits for the step to end with no second cap.
11. A hop aborted before its response arrives keeps its socket until the host answers or closes it; the late response's body is ended on arrival (T-9nh-03).
12. The abort scope is injected as `BackgroundPassDeps.runWithAbortSignal`, so the pass names no git module and stays outside BLOCK F's NETWORK_SEAMS.
13. No cucumber scenario for decisions 1 (wait cap) and 4 (dedupe): the harness drives Pi over RPC only, so they rest on unit and in-process tests (D-PL8-20).
14. 30 s cap and no environment knob (no `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_WAIT_CAP_MS`).
15. The `background-update` JSON kind stays in the schema although no json or rpc session can now emit it.

New in part 2:

- N1. `networkCall` (deviation 1) fails a call whose scope aborted while it ran even when the call itself completed; the step then counts as failed. For a fetch that completed just at the cap, the clone's remote refs have moved but the checkout and state.json have not; the next refresh fetches again.
- N2. Alternative abort mechanism found and not used: `isomorphic-git/http/node`'s `request` accepts a `signal`, and `simple-get` passes it to `https.request`, which would destroy the socket and close T-9nh-03. Not used, because Node then rejects with its own `AbortError` (the reason as `cause`), the late-response and body paths need the same race anyway, and proving the socket destroy needs a real-socket test the unit suite does not use.
- N3. isomorphic-git writes origin's remote-tracking refs before it reads the pack, so an abort during the pack transfer (like any network drop there) leaves them at oids whose objects are missing. The local branch, the checkout, and state.json are unchanged, and the next fetch skips a ref whose object is missing when it lists its haves, so it recovers.
- N4. The aborted skipped outcome's note is "the update ran past the background wait cap and was stopped"; its debug row also reads `{unreadable manifest}` (as choice 6).
- N5. An aborted plugin update that ended `unchanged` or `skipped` keeps that outcome; only `failed` and a throw become the aborted skipped outcome.
- N6. When a command and a shutdown both wait past the cap, the step is aborted once and one debug line is written.
- N7. The RPC-negative scenario's list row shows `upgradable` (the dir-source catalog already offers 1.10.0), which proves both that the update was available and that it was not applied. The scenario waits the full 20 s window, so it takes about 25 s.

## Phase 10 harness item

A pty-backed tui cucumber driver is needed so that the background pass, the 30 s wait cap, and the notice dedupe get behavioral scenarios. Today the harness spawns Pi with `--mode rpc` (`test/e2e/_rpc.ts`), Pi resolves tui only when stdin and stdout are TTYs, and only tui arms the background update (D-PL8-02 reversed), so no scenario can reach those behaviors.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: tampering | extensions/pi-claude-marketplace/platform/git.ts | An abort during a pack transfer leaves origin's remote-tracking refs at oids without objects (isomorphic-git ordering, N3). The checkout and state.json stay unchanged and the next fetch recovers; the plan's T-9nh-02 claim of unchanged refs holds only for an abort before the response. |

The other surfaces stay as the plan's `<threat_model>` records them (T-9nh-01 to T-9nh-05). No new network endpoint, auth path, or schema change.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/official-marketplaces.ts, test/domain/official-marketplaces.test.ts, features/marketplace/background-update.feature
- FOUND (ancestors of HEAD): 2f52b459, a2b89be4, df2ecc2e, de5d89c1, 0011957a, be78f527, 238b1584
