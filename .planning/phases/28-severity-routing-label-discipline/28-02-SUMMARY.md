---
phase: 28-severity-routing-label-discipline
plan: 02
subsystem: notification-output
tags: [uxg-03, spike, upstream-finding, label-discipline, host-coupling, defer-with-finding]
requires:
  - "@earendil-works/pi-coding-agent host (read-only): notify(message, type?) surface"
provides:
  - "UXG-03 resolution: defer-with-finding (feasibility REFUTED)"
  - "tests/shared/snm-uxg03-label-color-spike.test.ts: reproducible host label/color-coupling evidence lock"
  - ".planning/phases/28-severity-routing-label-discipline/UXG-03-FINDING.md: in-repo upstream-tracked finding"
affects:
  - "REQUIREMENTS.md UXG-03 (Pending -> Complete, defer-with-finding)"
  - "v1.4-MILESTONE-UAT.md (UXG-03 defer-with-finding entry)"
  - "STATE.md (upstream_finding deferral row)"
tech-stack:
  added: []
  patterns:
    - "Read-only host evidence-lock test (resolve installed host root by walking node_modules; assert .d.ts signature + dist bundle coupling)"
    - "Upstream-tracked finding deliverable mirroring the SNM-39 / G-MIL-07 precedent (finding doc + UAT note + REQUIREMENTS note + STATE.md deferral row)"
key-files:
  created:
    - tests/shared/snm-uxg03-label-color-spike.test.ts
    - .planning/phases/28-severity-routing-label-discipline/UXG-03-FINDING.md
  modified:
    - .planning/v1.4-MILESTONE-UAT.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
decisions:
  - "UXG-03 feasibility REFUTED: the installed host couples notify label + color to the single `type` arg with no color-only param -> resolve as defer-with-finding, ship no colorless in-extension workaround (D-28-10/11/12)."
metrics:
  duration: "~12 min"
  completed: 2026-05-31
---

# Phase 28 Plan 02: UXG-03 Label-Discipline Spike & Resolution Summary

UXG-03 feasibility spike RUN against the installed `@earendil-works/pi-coding-agent@0.75.5`: confirmed the host couples the `Error:`/`Warning:` label and the severity color to the single `notify(message, type?)` arg with no color-only parameter and no severity-color-without-label path -- feasibility REFUTED, resolved as an upstream-tracked finding (defer-with-finding), no in-extension code shipped.

## What Was Built

**Task 1 -- Spike evidence lock** (`tests/shared/snm-uxg03-label-color-spike.test.ts`, GREEN, 4 tests):
A read-only `node:test` that resolves the installed host package root by walking `node_modules` upward (the host `exports` map only declares the ESM `import` condition, so `require.resolve(".../package.json")` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`), then asserts the host label/color coupling as reproducible evidence:

- `dist/core/extensions/types.d.ts:75` -- `notify(message: string, type?: "info" | "warning" | "error"): void;` carries no options/color-only/label-suppression parameter (asserted byte-for-byte + a defensive no-`color`/`label`/`options` token check).
- `dist/main.js:64-69` (`reportDiagnostics`) -- `color` (chalk.red/yellow/dim) and the `Error: `/`Warning: ` `prefix` are two ternaries over the SAME `diagnostic.type`.
- `dist/modes/interactive/interactive-mode.js:1771-1781/2944-2954` (`showExtensionNotify` -> `showError`/`showWarning`/`showStatus`) -- `showError`/`showWarning` bind the severity color AND the label literal in ONE `theme.fg(...)` call; the only label-free path `showStatus` (`:2438`) renders `dim` (no severity color).
- A verdict-lock test asserting feasibility = `refuted`, keyed to the captured host version.

The test is placed under `tests/shared/` so it runs inside `npm test` / `npm run check` (mirrors the SNM-37 placement rationale); a future host change that decoupled label from color would flip it RED and re-open UXG-03 deliberately.

**Task 2 -- Four-part resolution record** (mirrors the SNM-39 / G-MIL-07 precedent, D-28-12):

- `UXG-03-FINDING.md` (167 lines): truth, spike method + harness path, exact host line refs, root cause (label+color co-derive from the single `type`; forcing `info` rejected per D-28-11), DEFER-WITH-FINDING resolution (no colorless workaround per D-28-10; filing the upstream issue is the operator's call per D-28-12), and the contingent D-28-13 entrypoint-based label policy (`notify()` suppresses, `notifyUsageError()` keeps -- NOT a line-count test, since `notifyUsageError` at `shared/notify.ts:199` emits `message\n\n usage`).
- `v1.4-MILESTONE-UAT.md`: a `status: defer-with-finding` UXG-03 entry in the G-MIL-07 shape (truth / status / root_cause / artifacts / missing / contingent_policy / debug_session).
- `REQUIREMENTS.md`: UXG-03 annotated (spike RUN, feasibility REFUTED, links UXG-03-FINDING.md); traceability row flipped Pending -> Complete (matching how SNM-39's defer-with-finding closure was marked Complete).
- `STATE.md`: an `upstream_finding` deferral row with the host line refs, the defer-with-finding disposition, and the 2026-05-31 deferral date.

## Spike Outcome

Feasibility is **REFUTED** -- the strongly-evidenced expected outcome. The spike did NOT discover a color-only / label-suppression capability, so the resolution stays defer-with-finding (no follow-up implementation plan triggered). No colorless workaround was shipped regardless (D-28-10).

The ask for the operator's (optional) upstream issue: a way to render the severity color on a multi-line `notify()` cascade without the `Error:`/`Warning:` label prefix (e.g. a `notify` options param like `{ label: false }`, or a dedicated structured-notification mode).

## Deviations from Plan

None -- plan executed exactly as written. The only minor adaptation was internal to Task 1's harness: the installed-host root is resolved by walking `node_modules` (rather than `require.resolve` of the package.json) because the host `exports` map exposes only the ESM `import` condition; this is a within-discretion implementation detail of the "READS the host `types.d.ts` line + greps the host bundle" approach the plan prescribed (D-28 Claude's Discretion: spike harness design).

The plan/CONTEXT cited the `notifyUsageError` line as `notify.ts:169`; the actual current line is `notify.ts:199` (the file shifted). The finding doc and UAT note cite the accurate line (199), and the `notify()` cascade entrypoint as `notify.ts:1339`.

## Verification

- `tests/shared/snm-uxg03-label-color-spike.test.ts` GREEN under `node --test` (4/4).
- `UXG-03-FINDING.md` contains the exact host line ref `types.d.ts:75` (Task 2 automated grep `ref-exit:0`), the label-literal evidence, the root cause, the resolution, and the contingent D-28-13 policy; 167 lines (>= 30 min_lines).
- UAT + REQUIREMENTS + STATE.md all carry the defer-with-finding resolution (four-part record per D-28-12).
- `extensions/pi-claude-marketplace/shared/notify.ts` is UNMODIFIED (`git status` clean); no host file under `node_modules/` modified; no dependency added.
- `npm run check` GREEN end-to-end: 1156/1156 tests pass, 0 fail (typecheck + ESLint + Prettier + tests).

## Self-Check: PASSED

- FOUND: tests/shared/snm-uxg03-label-color-spike.test.ts
- FOUND: .planning/phases/28-severity-routing-label-discipline/UXG-03-FINDING.md
- FOUND: commit 7a00fb7 (Task 1, test)
- FOUND: commit 81ac01e (Task 2, docs)
- VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts unmodified
- VERIFIED: npm run check GREEN (1156/1156)
