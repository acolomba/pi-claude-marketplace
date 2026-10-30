---
phase: "8"
slug: "background-autoupdate"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
updated: "2026-10-29"
---

# Phase 8 — Validation

All four plans and summaries are complete. This stale-verification audit re-read the current merged implementation, the Phase 8 plans and gate artifacts, the later Phase 9-10 changes, and the Phase 6 diagnostic-redaction changes. Current code and tests cover AUP-01 through AUP-03 and the four roadmap truths. The post-phase decisions in 08-04-SUMMARY.md supersede the original RPC and default-off expectations: only TUI arms the pass; official marketplaces default on; the notice deduplicates by bare plugin name; a waiting command or shutdown aborts an in-flight step at the 30-second cap and then waits for that step to settle.

## Requirement map

| Requirement | Behavioral proof                                                                                                                                                                                                                                                                                                                                                         | Automated command                                                                                                                                                                                                                                                                        | Status |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AUP-01      | First input arms once in TUI after the injected random delay; RPC, JSON, and print do not arm. The input source is immaterial. A load alone does not update.                                                                                                                                                                                                             | `node --test test/orchestrators/marketplace/background-update.test.ts`; `npx cucumber-js --parallel 1 features/marketplace/background-update.feature`                                                                                                                                    | Green  |
| AUP-01      | The pass selects merged-config autoupdate marketplaces, project first; it reuses `updateMarketplace` with a silent load-origin run and yields at marketplace, plugin, and dependency-settlement boundaries. A foreground command aborts the current signal at the cap, waits for settlement, blocks the next step, and leaves concurrent foreground commands concurrent. | `node --test test/orchestrators/marketplace/background-pass.test.ts test/orchestrators/marketplace/background-gate.test.ts`; `npx cucumber-js --parallel 1 features/marketplace/background-update.feature`                                                                               | Green  |
| AUP-02      | Official-name defaults and explicit config precedence, corrupt-config fail-closed behavior, opt-outs with FORCE override, valid/invalid delay knobs including Node's maximum, unref'd timer, and non-quit shutdown settlement.                                                                                                                                           | `node --test test/orchestrators/marketplace/background-pass.test.ts test/orchestrators/marketplace/background-update.test.ts test/architecture/hermetic-git-environment.test.ts`                                                                                                         | Green  |
| AUP-03      | One passive aggregate info notice names the moved plugin(s) and `/reload`; bare names dedupe while installed rows retain both scopes; no-op and stopped passes are silent. An early failure after a move still notifies.                                                                                                                                                 | `node --test test/orchestrators/marketplace/background-pass.test.ts test/shared/notification-grammar.test.ts test/architecture/background-update-notice.test.ts test/architecture/pi-tui-notices.test.ts`; `npx cucumber-js --parallel 1 features/marketplace/background-update.feature` | Green  |
| AUP-03      | The load-origin wire payload retains one row per updated install, including duplicate bare names across marketplaces/scopes. Schema, JSON, and text strategies agree. TUI is the positive transport; RPC is an end-to-end negative control under D-PL8-20.                                                                                                               | `node --test test/shared/notification-resolve.test.ts test/shared/notification-json.test.ts test/shared/notification-wire.test.ts`; `npm run check`                                                                                                                                      | Green  |

## Review-fix backstops

- CR-01 and WR-01: the TUI feature updates one plugin in both scopes, checks the single deduplicated notice, and checks both installed versions. The TUI step asserts the exact visible notice array. The RPC message helper retains its quiet-window collection and exact payload-count assertion for the transport it drives.
- WR-02: the RPC helper asserts no plugin payload arrived in the prompt exchange. The scheduler owner test proves the pass begins after input; the real TUI feature drives the independent session.
- WR-03: the background-pass owner test moves a plugin, then throws an invalid GitHub base error and still expects one notice. The pass's finally path has direct coverage.
- WR-04: the pass owner test turns autoupdate off during a yield and proves the next plugin is not updated. It also covers a config layer becoming invalid mid-pass.
- T-08-17 / SEC-08-01 is closed by a distinct-name behavioral oracle, not by identical screen-write counting. The real PTY scenario updates `alpha` and `beta` across project/user marketplaces and requires exactly `Plugins updated: alpha and beta ...`; the architecture test proves two split notices cannot satisfy that assertion. The same-name scenario separately proves bare-name dedupe while both install rows remain. A mutation that emitted one notice per marketplace/plugin failed the distinct-name scenario.
- D-PL8-23 through D-PL8-25 have gate, pass, scheduler, and real TUI foreground-command tests. The PTY wait-cap scenario holds the git smart-HTTP `info/refs` response with a streaming heartbeat, so the hosted-manifest fetch's independent ten-second idle timeout cannot end the request. It proves the foreground command is still blocked after one second, completes only at 30-35 seconds, observes the git request as `dropped`, retains the old install rows, emits no update notice, and does not settle the newly declared dependency. Mutations that removed abort propagation or bypassed the foreground wait failed this scenario.
- No live ten-minute scheduling wait is needed: injected timers prove delay scheduling, and a zero-delay TUI scenario proves transport and lifecycle wiring.

## Verification result

The final-head focused owner and architecture command passed all 10 requested test files. Direct coverage passed for the five audited source/test pairs: `background-gate.ts`, `background-pass.ts`, `background-update.ts`, `notification-grammar.ts`, and `notification-dispatch.ts`. `npx cucumber-js --parallel 1 features/marketplace/background-update.feature` passed 6 scenarios and 88 steps, including PTY-backed TUI updates, same-name dedupe, the distinct-name aggregate oracle, streamed-git wait-cap cancellation before dependency settlement, and the RPC negative control. The sandboxed first attempt could not bind its hermetic loopback server (`listen EPERM`); the permitted identical rerun passed.

The exact full `npm run check` on integrated executable head `be0de0c3` exited 0: 1,145 scenarios, 11,777 steps, and 309 merged LCOV records. `git diff --quiet be0de0c3 -- . ':(exclude,glob).planning/**/*.md'` exits 0 on this audit tree, so the local-verification rule permits reusing that combined-tree result. This audit changes only this validation artifact.

## Sign-off

- [x] Every roadmap truth and AUP requirement has behavioral automated evidence.
- [x] All critical/warning review fixes have deterministic backstops.
- [x] Wire, docs, redaction, and transport checks are included.
- [x] The aggregate-notice oracle distinguishes split notices from terminal redraws.
- [x] The real wait-cap path reaches the gate's streamed git abort, not the hosted-fetch timeout.
- [x] No unresolved validation gap or missing Wave 0 fixture remains.

**Approval:** validated; Nyquist compliant.
