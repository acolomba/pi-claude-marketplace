---
phase: "8"
slug: "background-autoupdate"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
updated: "2026-10-28"
---

# Phase 8 — Validation

All four plans and summaries are complete. Current code and tests cover AUP-01 through AUP-03 and the four roadmap truths. The post-phase decisions in 08-04-SUMMARY.md supersede the original RPC and default-off expectations: only TUI arms the pass; official marketplaces default on; the notice deduplicates by bare plugin name; a waiting command or shutdown aborts an in-flight step at the 30-second cap.

## Requirement map

| Requirement | Behavioral proof | Automated command | Status |
| --- | --- | --- | --- |
| AUP-01 | First input arms once in TUI after the injected random delay; RPC, JSON, and print do not arm. The input source is immaterial. A load alone does not update. | `node --test test/orchestrators/marketplace/background-update.test.ts test/index.test.ts`; `npx cucumber-js features/marketplace/background-update.feature` | Green |
| AUP-01 | The pass selects merged-config autoupdate marketplaces, project first; it reuses updateMarketplace with a silent load-origin run, yields between plugin steps, and stops after shutdown or abort. A command waits for the current step and blocks the next; concurrent commands remain concurrent. | `node --test test/orchestrators/marketplace/background-pass.test.ts test/orchestrators/marketplace/background-gate.test.ts test/edge/register.test.ts`; `npx cucumber-js features/marketplace/background-update.feature` | Green |
| AUP-02 | Official-name default and config precedence, corrupt-config fail-closed rule, opt-outs with FORCE override, valid/invalid delay knob including Node's maximum, unref'd timer, and non-quit shutdown wait. | `node --test test/orchestrators/marketplace/background-pass.test.ts test/orchestrators/marketplace/background-update.test.ts test/architecture/hermetic-git-environment.test.ts` | Green |
| AUP-03 | One aggregate info notice names the moved plugin(s) and /reload; bare names dedupe while installed rows retain both scopes; no-op and stopped passes are silent. Early failure after a move still notifies. | `node --test test/orchestrators/marketplace/background-pass.test.ts test/shared/notification-grammar.test.ts test/architecture/background-update-notice.test.ts`; `npx cucumber-js features/marketplace/background-update.feature` | Green |
| AUP-03 | Load-origin wire payload, schema, JSON docs, catalog examples, and credential redaction agree. TUI uses the text transport; RPC has an end-to-end negative scenario under D-PL8-20. | `node --test test/shared/notification-resolve.test.ts test/shared/notification-json.test.ts test/shared/notification-wire.test.ts test/architecture/wire-schema.test.ts test/architecture/no-credential-leak.test.ts`; `npm run check` | Green |

## Review-fix backstops

- CR-01 and WR-01: the TUI feature updates one plugin in both scopes, checks the single deduplicated notice, and checks both installed versions. The TUI step asserts the exact notice array. The RPC message helper retains its quiet-window collection and exact payload-count assertion for the transport it drives.
- WR-02: the RPC helper asserts no plugin payload arrived in the prompt exchange. The scheduler owner test proves the pass begins after input; the real TUI feature drives the independent session.
- WR-03: the background-pass owner test moves a plugin, then throws an invalid GitHub base error and still expects one notice. The pass's finally path has direct coverage.
- WR-04: the pass owner test turns autoupdate off during a yield and proves the next plugin is not updated. It also covers a config layer becoming invalid mid-pass.
- The later D-PL8-23 through D-PL8-25 wait-cap/abort behavior has gate, pass, scheduler, and real TUI foreground-command tests. No live ten-minute wait is needed: injected timers prove delay scheduling, and a zero-delay TUI scenario proves transport and lifecycle wiring.

## Verification result

The focused owner and architecture run passed 618/618 tests. `npx cucumber-js features/marketplace/background-update.feature` passed 5 scenarios and 64 steps, including PTY-backed TUI updates, cross-scope notice deduplication, in-flight foreground abort, and the RPC negative control.

The parent's full `npm run check` at implementation/test commit `3a8c7e1c` exited 0: 1,124 scenarios, 11,462 steps, and 309 merged LCOV records. The diff since that commit contains only planning Markdown, so the local-verification rule permits reusing that combined-tree result for this validation-only change. No test or implementation input changed in this audit.

## Sign-off

- [x] Every roadmap truth and AUP requirement has behavioral automated evidence.
- [x] All five critical/warning review fixes have deterministic backstops.
- [x] Wire, docs, redaction, and transport checks are included.
- [x] No unresolved validation gap or missing Wave 0 fixture remains.

**Approval:** validated; Nyquist compliant.
