---
phase: 04-wire-schema-and-json-strategy
plan: "06"
subsystem: notifications
tags: [credential-redaction, presentation, json-strategy, auth-09, pmod-04, gap-closure]

requires:
  - phase: 04-wire-schema-and-json-strategy
    provides: redactCredentials, resolveRows, presentNotification, toWirePayload, and the AUTH-09 JSON-path probes (04-04)
provides:
  - resolveRows redacts every marketplace block name and every plugin row name
  - presentNotification redacts the marketplace-not-added name
  - three AUTH-09 subject-name rows, each proven to fail before its fix
affects: [04-verification, json-output]

actuals:
  tokens: 3211
  tasks: 2
  commits: 2
plan_head_before: 8f766751d4bd3c18802edee6508a5615f14cc4a9
plan_head_after: 5d988d7db5e165bdd0c58450d397873d96871970

tech-stack:
  added: []
  patterns:
    - "Subject names are redacted at the model chokepoints (resolveRows, presentNotification), never in a producer"
    - "AUTH-09 subject rows compose their text with formatEnvelopeArguments over the text strategy's grammar function, with no notify call, so the corpus gains no entry"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-present.ts
    - extensions/pi-claude-marketplace/shared/redact-credentials.ts
    - tests/shared/notification-resolve.test.ts
    - tests/shared/notification-present.test.ts
    - tests/architecture/no-credential-leak.test.ts

key-decisions:
  - "PMOD-04: block names and plugin row names are redacted in resolveRows, and the marketplace-not-added name in presentNotification; record-backed names and the scp subject pass through unchanged"
  - "PMOD-04: an out-of-band plugin row without a name keeps that shape; resolveRows redacts a row name only when the row carries one (the grammar's `\"name\" in row` idiom)"

patterns-established:
  - "probeComposedText / probeCascadeSubject / probeNotAddedSubject: AUTH-09 probes that read presentation, payload, and text without a notify call"

requirements-completed: [PMOD-04]

coverage:
  - id: D1
    description: "A failed marketplace add whose typed source carries URL userinfo shows https://***@gitlab.example.com/team/private-mp as its block name in the presentation, the JSON payload, and the text"
    requirement: PMOD-04
    verification:
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / PMOD-04: neither strategy shows a credential planted in the block name of a failed marketplace add"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#PMOD-04 / D-07 redacts the userinfo of a marketplace block name"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#keeps an scp-style marketplace block name unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "A plugin row name and the marketplace-not-added name carry only the redacted subject in presentation, payload, and text"
    requirement: PMOD-04
    verification:
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / PMOD-04: neither strategy shows a credential planted in a plugin row name"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / PMOD-04: neither strategy shows a credential planted in the marketplace-not-added name"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#PMOD-04 / D-07 redacts the userinfo of a plugin row name"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-present.test.ts#PMOD-04 / D-07 redacts the userinfo of a marketplace-not-added name"
        status: pass
    human_judgment: false
  - id: D3
    description: "No text byte changed: corpus 3143 present, 0 extra; catalog diff from 4e6c568a empty"
    requirement: PMOD-04
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check (plan wrapper) and git diff --exit-code 4e6c568a -- docs/output-catalog.md plus catalog-contract and catalog-wire suites"
        status: pass
    human_judgment: false

duration: 83min
completed: 2026-10-04
status: complete
---

# Phase 4 Plan 06: Redacted Subject Names Summary

**`resolveRows` now redacts every marketplace block name and plugin row name, and `presentNotification` redacts the marketplace-not-added name. A failed `marketplace add https://alice:s3cret@gitlab.example.com/team/private-mp` now shows `https://***@gitlab.example.com/team/private-mp` in the text and in the JSON payload. Three new AUTH-09 rows each failed before their fix and pass after it. The corpus (3143 present, 0 extra) and the catalog did not move.**

## Performance

- **Duration:** about 83 min
- **Started:** 2026-10-04T09:42:31Z
- **Completed:** 2026-10-04T11:05:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Block names: `resolveRows` sets `name: redactCredentials(mp.name)` after the `...mp` spread. Its three production callers are `presentCascade`, `presentUpdateNoOp`, and `presentReconcileApplied`. So every cascade, update no-op, and reconcile-applied presentation carries the redacted subject. The wire `id` is built from the redacted names.
- Plugin row names: `resolveRows` builds each returned row with `name: redactCredentials(resolved.name)`. The policy-less branch still adds `missingPolicy: true`. `floorMissingArmSeverity` still writes the producer's row before resolution.
- Not-added name: `presentNotification` carries `{ ...message, name: redactCredentials(message.name) }`. Scope, `presentInOtherScope`, the reason, and the envelope still read the input message.
- The redactor's JSDoc, the `resolveRows` JSDoc, and the presentation module header now name these subject sites.
- AUTH-09 has 18 planted-credential sites. The three new rows read the presentation, `JSON.stringify(toWirePayload(...))`, and the text that `formatEnvelopeArguments` composes from `composeReconcileAppliedBody` or `renderMarketplaceNotAdded`. They make no notify call, so the D-13 corpus lock holds.

## Task Commits

Plan base (`/tmp/gsd-04-06-plan-base`): `8f766751d4bd3c18802edee6508a5615f14cc4a9`.

1. **Task 1 (tracer): a failed marketplace add's block name is redacted in both strategies.** Commit `c8a45a9b` (fix). TASK_BASE `8f766751d4bd3c18802edee6508a5615f14cc4a9`.
1. **Task 2: plugin row names and the marketplace-not-added name are redacted at the same chokepoints.** Commit `5d988d7d` (fix). TASK_BASE `c8a45a9b1df5152bc92361a271a21083948b267d`.

Each task is one commit with its owner tests and gate rows. The full-check pre-commit rejects a failing RED commit, so RED was observed locally (the logs below) and not committed. This is the 03-01 precedent.

## RED and GREEN Evidence

### Task 1

RED gate (`/tmp/gsd-04-06-t1-red-gate.log`, run while `extensions/` equalled the plan base):

```text
EXIT=1
# fail 1
not ok 34 - AUTH-09 / PMOD-04: neither strategy shows a credential planted in the block name of a failed marketplace add
  error: 'AUTH-09 / PMOD-04: the presentation shows a planted credential'
```

RED owner (`/tmp/gsd-04-06-t1-red-resolve.log`):

```text
EXIT=1
# fail 1
    not ok 10 - PMOD-04 / D-07 redacts the userinfo of a marketplace block name
```

The scp negative case (`ok 11 - keeps an scp-style marketplace block name unchanged`) passed in RED as well, as expected.

GREEN gate (`/tmp/gsd-04-06-t1-green-gate.log`):

```text
EXIT=0
# fail 0
ok 34 - AUTH-09 / PMOD-04: neither strategy shows a credential planted in the block name of a failed marketplace add
```

Tracer gate: interactive run, `human_verify_mode` end-of-phase, and the tracer's `<verify>` holds only `<automated>` commands. Every verify command passed after the commit, so execution expanded into Task 2 with no checkpoint.

### Task 2

RED gate (`/tmp/gsd-04-06-t2-red-gate.log`, run while `extensions/` equalled the Task 2 base):

```text
EXIT=1
# fail 2
not ok 35 - AUTH-09 / PMOD-04: neither strategy shows a credential planted in a plugin row name
not ok 36 - AUTH-09 / PMOD-04: neither strategy shows a credential planted in the marketplace-not-added name
```

`grep -c -F "error: 'AUTH-09 / PMOD-04: the presentation shows a planted credential'"` reported `2`.

RED owners:

```text
/tmp/gsd-04-06-t2-red-resolve.log
EXIT=1
# fail 1
    not ok 12 - PMOD-04 / D-07 redacts the userinfo of a plugin row name

/tmp/gsd-04-06-t2-red-present.log
EXIT=1
# fail 1
    not ok 18 - PMOD-04 / D-07 redacts the userinfo of a marketplace-not-added name
```

Both owner diffs differ only in `name` (`'https://alice:s3cret@github.com/o/r.git'` actual against `'https://***@github.com/o/r.git'` expected).

GREEN gate (`/tmp/gsd-04-06-t2-green-gate.log`): `EXIT=0`, `# fail 0`, and 3 `ok` lines for the three subject sites.

## Verification

- Task 1 verify: typecheck clean, 574/574 tests across the 11 named suites. Direct coverage 100% for `notification-resolve.ts` (105/105 branches) and `redact-credentials.ts` (7/7). ESLint clean, `lint:type-members` exit 0 with no re-pin, `npm run fallow` exit 0. `fallow audit` verdict `warn`.
- Task 2 verify: typecheck clean, 799/799 tests across the 15 named suites. Direct coverage 100% for `notification-resolve.ts` (107/107 branches), `notification-present.ts` (35/35), and `redact-credentials.ts` (7/7). ESLint clean, `lint:type-members` exit 0 with no re-pin, `npm run fallow` exit 0. `fallow audit` verdict `warn`.
- Corpus wrapper after each task: `Corpus: 3143 present, 0 extra` (no `missing in` or `extra in` line).
- Catalog after each task: `git diff --exit-code 4e6c568a -- docs/output-catalog.md` empty. `catalog-contract.test.ts` and `catalog-wire.test.ts` pass 18/18.
- Placement: the plan-base diff under `extensions/` lists exactly `notification-present.ts`, `notification-resolve.ts`, and `redact-credentials.ts`. `add.ts`, `tools.ts`, and every other producer are unchanged.
- Gate hygiene: the count of lines matching `\bnotify\(` in the gate file is the same as at the plan base. `"extensions/pi-claude-marketplace/` does not appear in it (D-07-06). The `comm -23` title check printed nothing for the gate, the resolve test, and the present test.
- Task 1: focused task verification passed; full phase/PR verification pending.
- Task 2: focused task verification passed; full phase/PR verification pending.

### Full-check evidence

| Task | Log | Result | Scope | Node | Committed tree |
| --- | --- | --- | --- | --- | --- |
| 1 | `/tmp/gsd-04-06-t1-precommit2.log` | `PRECOMMIT_EXIT=0` | `full` (`npm run check`, `test:coverage:direct:all`) | v26.10.0 | `c8a45a9b` (tree `5d8b762c`) |
| 2 | `/tmp/gsd-04-06-t2-precommit.log` | `PRECOMMIT_EXIT=0` | `full` (`npm run check`, `test:coverage:direct:all`) | v26.10.0 | `5d988d7d` (tree `17999af6`) |

`npm run check:changed -- --list` reported `scope: full` before each run, because an architecture gate file is a shared input. Each run covered the exact code committed in its task. The only other working-tree differences were three planning files that no commit includes: `.planning/HANDOFF.json`, `.continue-here.md`, and `.planning/config.json`. Under the local-verification reuse rule, Task 2's run counts as the `npm run check` for `5d988d7d`, so plan verification step 1 reuses it.

## Planner Decision Evidence

- **Plugin row names (decision 3).** `parsePluginKey` (`orchestrators/reconcile/plan.ts:86-95`) splits a declared `enabledPlugins` key at its last `@` and does not validate either half. The install bucket pushes `{ status: "will install", name: o.plugin }` (`orchestrators/reconcile/notify.ts:426-441`). A dangling reference pushes a failed row named `mismatch.plugin` (`notify.ts:210-222`). So a hand-edited key `https://alice:s3cret@host/x@mp` reaches a row named `https://alice:s3cret@host/x`. The AUTH-09 row `a plugin row name` plants exactly that shape.
- **Not-added name.** `splitPluginMarketplaceRef` (`edge/handlers/plugin/shared.ts:29-39`) splits at the first `@`, so `foo@https://alice:s3cret@host/x` names the marketplace `https://alice:s3cret@host/x`. The dispatch formatter renders the not-added body from `presentation.message` (`notification-dispatch.ts` `formatPresentationBody`), so redacting the presented message covers text and JSON.
- **Info-kind names not redacted (decision 4).** `marketplace info` and `plugin info` report a miss as marketplace-not-added. Record names pass `assertSafeName`, which rejects `/`. So marketplace-info `name` and plugin-info `marketplaceName` and `plugin.name` cannot hold `scheme://` userinfo. No code was added for them.

## Decisions Made

- The planner's chokepoints were applied as written: block and row names in `resolveRows`, the not-added name in `presentNotification`. No producer moved.
- An out-of-band row without a `name` keeps that shape (deviation 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An unnamed out-of-band row crashed the row-name redaction**

- **Found during:** Task 2 (verify 1)
- **Issue:** Two existing cases feed `resolveRows` a frozen row with no `name` (`keeps a frozen row's severity and adds no name to its resolved copy` and `a frozen unnamed missing-arm row still precedes the adjacent present arm`). The planned `{ ...resolved, name: redactCredentials(resolved.name) }` passed `undefined` to the redactor, which threw `TypeError: Cannot read properties of undefined (reading 'replace')`. Unguarded, it would also have added a `name` key to that copy.
- **Fix:** The row is redacted only when it carries a name: `"name" in resolved ? { ...resolved, name: redactCredentials(resolved.name) } : resolved`. `formatPluginRow` uses the same idiom to read that row's name. A one-line comment states why. The planned expression and its acceptance grep are unchanged.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts`
- **Verification:** both cases pass. Direct coverage stays 100% (107/107 branches; the unnamed case covers the false branch).
- **Committed in:** `5d988d7d`

**2. [Rule 3 - Blocking] The first Task 1 pre-commit failed on `.planning/config.json` formatting**

- **Found during:** Task 1 (pre-commit)
- **Issue:** `format:check` inside `npm run check` rejected `.planning/config.json`. That file has an uncommitted edit made by the GSD tooling (the `_auto_chain_active` key), and the tooling had also expanded its arrays. Typecheck, lint, and fallow had passed before that step.
- **Fix:** `npx prettier --write .planning/config.json`. Its parsed JSON was byte-identical before and after (`cmp` of `JSON.stringify` output). The file was never staged or committed, and it still carries only the orchestrator's key change. The pre-commit was rerun and exited 0.
- **Files modified:** none committed
- **Committed in:** n/a

**Total deviations:** 2 (1 bug, 1 blocking). **Impact:** the bug fix keeps the defensive out-of-band path that Phase 01 established. The formatting fix touched no committed file.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Issues Encountered

- `fallow` is not on `PATH` in this shell, so `fallow audit` ran as `npx fallow audit ...`.
- `contracts.json` needed no change: `lint:type-members` passed with no pin moved after each task.

## Requirements

PMOD-04 was already checked in REQUIREMENTS.md and stays checked. This plan closes its subject-name gap.

## Next Phase Readiness

Phase 4 can be re-verified. SC3 / PMOD-04 now covers subject names. T-04-06 (the marketplace LLM tool's content line) keeps its 04-02 disposition, and T-04-21 (a name cut before its userinfo `@`) is accepted residual risk.

## Self-Check: PASSED

- FOUND: every file in `key-files.modified`
- FOUND: `c8a45a9b` and `5d988d7d` in `git log`
