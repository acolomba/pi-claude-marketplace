---
phase: 04-ssh-sources-and-transport-selection
plan: 19
subsystem: notification
tags: [system-git, ssh, notification, clone-note, gap-closure, parity]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "the D-SG-22 clone note (clone.note/url/retries), recordNote and resolveRows redaction, withOwnCloneNotes (04-02, 04-08, 04-14..04-17, review fixes A and B)"
provides:
  - "CloneNoteKind via-http (`Cloning via HTTP`) end to end: types, wire set, regenerated schema, grammar lead, docs, closed-set lock"
  - "one exported rule, writtenAddressNote, for the note of an address cloned as written, read by the marketplace plan and the plugin plan"
  - "an optional clone member on PluginUpdateSkippedMessage, PluginPartiallyUpgradableMessage, PluginManualRecoveryMessage, PluginDisabledMessage"
  - "an optional plugin label on CloneTransportNote (wire clone.plugin, text prefix `<plugin>: `), redacted with redactRowName"
affects: [04-20, 04-21, 04-22, 04-23, 04-24, 04-25, 04-26]

actuals:
  tokens: 14767
  tasks: 3
  commits: 3

plan_head_before: 373e8e6501e8de9b75e8d1fb608d3ec54fe07006
plan_head_after: dd5644de2c02cb7a91dfb7cb2576b8340f784e5a

tech-stack:
  added: []
  patterns:
    - "an address cloned as written takes its note from writtenAddressNote in domain/github-transport.ts, in both clone plans"
    - "a labelled clone note prefixes every one of its lines, lead and retries, with `<plugin>: ` after the indent"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/github-transport.ts
    - extensions/pi-claude-marketplace/domain/github-plugin-transport.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - schema/claude-plugin.schema.json
    - docs/json-output.md
    - docs/output-catalog.md
    - features/marketplace/url-source.feature
    - features/plugin/git-source.feature

key-decisions:
  - "The plugin plan's as-written note now follows the marketplace rule exactly: a git:// GitHub address has no note in either plan (it read via-https in the plugin plan before), because the two plans must not name one address two ways"
  - "writtenAddressNote stays module-private in the first commit and is exported in the second, when the plugin plan imports it, so fallow dead-code never sees an unused export"
  - "cloneTransport names an http: URL HTTP for both the failed and the retried attempt, so a retry line never calls plain http HTTPS"

patterns-established:
  - "Rows that can follow a clone carry `readonly clone?: CloneTransportNote` with the D-SG-22 doc line; PluginRemoteMessage and the base PluginSkippedMessage carry none (compile-time locks in notification-types.test.ts)"

requirements-completed: [SG-SSH-02, SG-SSH-04]

coverage:
  - id: D1
    description: "A marketplace added from an http:// GitHub address notes via-http / `Cloning via HTTP`, also while a transport is forced (D-SG-21)"
    requirement: SG-SSH-02
    verification:
      - kind: unit
        ref: "test/domain/github-transport.test.ts#IN-A-02, D-SG-21: keeps the via-http note of an http GitHub url source while base-override forces GitHub clones"
        status: pass
      - kind: unit
        ref: "test/shared/notification-grammar.test.ts#IN-A-02: renders the via-http note of a marketplace block under its header"
        status: pass
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a marketplace from an http:// github address names its clone as http"
        status: pass
    human_judgment: false
  - id: D2
    description: "A plugin cloned from an http:// GitHub address notes via-http, through the shared written-address rule"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/domain/github-plugin-transport.test.ts#OQ-1: clones the GitHub url source http://github.com/acme/ghp.git once as written, noted by its scheme"
        status: pass
      - kind: e2e
        ref: "features/plugin/git-source.feature#Installing a plugin from an http:// github address names its clone as http"
        status: pass
    human_judgment: false
  - id: D3
    description: "via-http is a closed wire member: schema, docs, closed-set lock, JSON projection"
    requirement: SG-SSH-02
    verification:
      - kind: unit
        ref: "test/shared/notification-wire.test.ts#D-SG-22, IN-A-02: accepts a clone note of kind via-http, with or without the plugin it names"
        status: pass
      - kind: unit
        ref: "test/architecture/notify-closed-set-locks.test.ts#D-SG-22, IN-A-02: CloneNoteKind is the closed 4-entry clone note set"
        status: pass
      - kind: other
        ref: "npm run --silent schema:generate && git diff --exit-code schema/"
        status: pass
    human_judgment: false
  - id: D4
    description: "The update/reinstall skipped, partially-upgradable, manual recovery, and disabled rows accept a clone note and render it in text and JSON; with no note their bytes are unchanged"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/shared/notification-grammar.test.ts#D-SG-22: renders the clone note of ... , and no note line without one (4 cases)"
        status: pass
      - kind: unit
        ref: "test/shared/notification-json.test.ts#D-SG-22: carries the clone note of a <status> row, and no clone member without one (4 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A clone note can name the plugin whose clone it reports: text prefix, JSON clone.plugin, redacted as a row name"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/shared/notification-grammar.test.ts#D-SG-22: starts each line of a labelled clone note with the plugin it names"
        status: pass
      - kind: unit
        ref: "test/shared/notification-json.test.ts#D-SG-22: carries the plugin a row's clone note names as clone.plugin"
        status: pass
      - kind: unit
        ref: "test/shared/notification-resolve.test.ts#PMOD-04, CR-A-01: redacts a clone note's plugin as the row name it names, and an http url"
        status: pass
    human_judgment: false

duration: 57min
completed: 2026-11-26
status: complete
---

# Phase 4 Plan 19: Clone note vocabulary for the D-SG-22 gap Summary

**`via-http` ("Cloning via HTTP") for a GitHub address written with http:// in both clone plans through one shared rule, a clone member on four more row types, and an optional `<plugin>@<marketplace>` label on a clone note, all redacted and schema-checked.**

## Performance

- **Duration:** 57 min
- **Started:** 2026-11-26T17:52:33Z
- **Completed:** 2026-11-26T18:49:57Z
- **Tasks:** 3
- **Files modified:** 20

PLAN_BASE: `373e8e6501e8de9b75e8d1fb608d3ec54fe07006`

## Accomplishments

- IN-A-02 closed: `marketplace add http://github.com/acme/tools.git` and a plugin url source `http://github.com/acme/ghp.git` both note `via-http` (`Cloning via HTTP: http://...`), never `Cloning via HTTPS`. The note holds while a transport is forced (D-SG-21).
- `writtenAddressNote(url, transport)` in `domain/github-transport.ts` is the one rule for an address cloned as written (`via-ssh` over ssh, `via-https` for `https:`, `via-http` for `http:`, none otherwise). `planMarketplaceClone`'s url arm and the plugin plan's `asWritten` both read it.
- A retry line calls a plain http attempt `HTTP` (`HTTP clone failed, retrying with ...`).
- `PluginUpdateSkippedMessage`, `PluginPartiallyUpgradableMessage`, `PluginManualRecoveryMessage`, and `PluginDisabledMessage` accept `clone`. No wire, JSON, resolve, or grammar change was needed for them: `PLUGIN_ROW` already had `clone` for every status, and `wireRow`, `rowCloneNote`, and `resolveRows` read any row that has the member (measured by the new unit cases).
- `CloneTransportNote.plugin` (wire `clone.plugin`): the text form starts each of the note's lines with `<plugin>: `, JSON copies it, and `redactCloneNote` redacts it with `redactRowName`. No producer sets it (04-25 does).

## Task Commits

1. **Task 1: http:// GitHub marketplace clone names its clone as http** - `a4ba4b1` (feat, RED and GREEN in one commit)
2. **Task 2: plugin http clone note and the clone member on four rows** - `f2a514f` (feat, RED and GREEN in one commit)
3. **Task 3: the plugin label of a clone note** - `dd5644d` (feat, RED and GREEN in one commit)

RED and GREEN share each commit because the commit hook runs typecheck and every architecture test, so a failing-test-only commit cannot pass it (the 04-08 precedent). Each RED was run locally first; the runs are below.

## TDD Gate Compliance (red runs)

**Task 1** (unit, before the source change): `node --import scripts/isolated-pi-home.mjs --test test/domain/github-transport.test.ts test/shared/notification-wire.test.ts test/shared/notification-json.test.ts test/shared/notification-grammar.test.ts test/architecture/notify-closed-set-locks.test.ts test/architecture/json-output-docs.test.ts` gave `tests 590, pass 580, fail 10`:

- `D-SG-22, OQ-3: clones the GitHub url source http://github.com/acme/tools once as written with the via-http note and no probe` (and the `.git` spelling)
- `IN-A-02, D-SG-21: keeps the via-http note of an http GitHub url source while base-override forces GitHub clones` (and `prefer-https`)
- `D-SG-22: names HTTP as the transport of a retry over http://git.example/acme/ghp.git` (and `HTTP://github.com/...`)
- `IN-A-02: renders the via-http note of a marketplace block under its header`
- `IN-A-02: renders the via-http note of a plugin row and names an http attempt HTTP in its retry`
- `IN-A-02: carries the via-http clone note of a block unchanged`
- `D-SG-22, IN-A-02: accepts a clone note of kind via-http`

Scenario RED (adapter), "Adding a marketplace from an http:// github address names its clone as http": `1 scenario (1 failed)`, clone note actual `via-https`, expected `via-http`.

**Task 2:** `tsc --noEmit` gave 12 `TS2353 'clone' does not exist in type ...` errors for the four row types (notification-types.test.ts, notification-grammar.test.ts, notification-json.test.ts). The unit run gave `tests 570, pass 567, fail 3`:

- `OQ-1: clones the GitHub url source http://github.com/acme/ghp.git once as written, noted by its scheme`
- `OQ-1, IN-A-02: clones the url source git://github.com/acme/ghp.git once as written with no note`
- `IN-A-02: clones an http GitHub git-subdir address once as written with the via-http note`

Scenario RED (adapter), "Installing a plugin from an http:// github address names its clone as http": `1 scenario (1 failed)`, clone note actual `via-https`, expected `via-http`.

**Task 3:** unit run `tests 703, pass 695, fail 8` (and `tsc` refused `plugin` on `CloneTransportNote`):

- `D-SG-22: starts each line of a labelled clone note with the plugin it names`
- `D-SG-22: carries the plugin a row's clone note names as clone.plugin`
- `PMOD-04, CR-A-01: redacts a clone note's plugin as the row name it names, and an http url`
- `D-SG-22, IN-A-02: accepts a clone note of kind <each of 4>, with or without the plugin it names` (4)
- `D-SG-22: rejects a clone note whose plugin is not a string` (failed on `additionalProperties`, not `type`)

All three GREEN runs: every named suite passed (`fail 0`); each scenario passed.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/github-transport.ts` - `writtenAddressNote`, exported; module header names the http note
- `extensions/pi-claude-marketplace/domain/github-plugin-transport.ts` - `asWritten` reads `writtenAddressNote`
- `extensions/pi-claude-marketplace/shared/notification-types.ts` - `via-http`, the four row members, `CloneTransportNote.plugin`
- `extensions/pi-claude-marketplace/shared/notification-wire.ts` - `CLONE_NOTE_KINDS` gains `via-http`; `CLONE` gains `plugin`
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` - `Cloning via HTTP` lead, `HTTP` transport, labelled note lines
- `extensions/pi-claude-marketplace/shared/notification-resolve.ts` - `redactCloneNote` keeps the redacted label
- `extensions/pi-claude-marketplace/shared/notification-json.ts` - `wireClone` copies `plugin`
- `schema/claude-plugin.schema.json` - regenerated (twice); drift check clean after each
- `docs/json-output.md` - `CloneNoteKind` list, `clone-note` fields table `plugin` row
- `docs/output-catalog.md` - the HTTP line and its sentence; the labelled-line and `clone.plugin` sentence
- Tests: `test/domain/github-transport.test.ts`, `test/domain/github-plugin-transport.test.ts`, `test/shared/notification-{types,wire,json,grammar,resolve}.test.ts`, `test/architecture/notify-closed-set-locks.test.ts`
- Scenarios: `features/marketplace/url-source.feature`, `features/plugin/git-source.feature`

## New and re-baselined scenarios

New (not re-baselines):

- `features/marketplace/url-source.feature`: "Adding a marketplace from an http:// github address names its clone as http"
- `features/plugin/git-source.feature`: "Installing a plugin from an http:// github address names its clone as http"

Re-baselined: none.

Rebaseline audit: `git diff -U0 373e8e6..HEAD -- features` filtered with `grep '^[-+][^-+]' | grep -v -i 'clone\|Cloning via\|retrying with\|SSH not configured'` printed only added lines of the two new scenarios (their steps, data rows, and the manifest doc string). No removed line and no line of any other scenario.

## Suite counts (final tree, `env -u GIT_CONFIG_COUNT`)

- `npm run --silent check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features)
- `npm run --silent test:modules`: passed (exit 0; the local reporter prints no count on a pass)
- `npm run --silent test:integration`: passed (exit 0)
- cucumber `--profile adapter features`: 2398 scenarios, 2393 passed, 5 failed. The 5 are the known fd-dependent Glob baselines in `features/hook/tool-use.feature` (lines 296, 355, 443, 1696, 1834).
- cucumber `--profile builtin features`: 260 scenarios, 260 passed
- Direct coverage at 100% for `domain/github-transport.ts`, `domain/github-plugin-transport.ts`, `shared/notification-{types,wire,grammar,resolve,json}.ts`

`npm run check` was not run here; the wave gate runs it on the merged tree.

## Decisions Made

- A `git://` GitHub url source has no note in the plugin plan now, as it already had none in the marketplace plan. The plan requires one rule for both plans ("no note for any other scheme").
- `writtenAddressNote` lands non-exported in Task 1 and is exported in Task 2, where the plugin plan imports it. Fallow's production dead-code run would otherwise fail the Task 1 commit on an unused export.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the CloneNoteKind exactness check in Task 1**
- **Found during:** Task 1
- **Issue:** `test/shared/notification-types.test.ts` pins `CloneNoteKind` with `IsExact`. Adding `via-http` breaks typecheck, so the Task 1 commit hook would fail. The file was listed only for Task 2.
- **Fix:** Added `via-http` to the exactness check in the Task 1 commit. The closed-set count lock in `notify-closed-set-locks.test.ts` moved from 3 to 4 too (same file the plan named).
- **Files modified:** test/shared/notification-types.test.ts, test/architecture/notify-closed-set-locks.test.ts
- **Committed in:** a4ba4b1

**2. [Rule 1 - Bug] The existing retry case `http://git.example/acme/ghp.git` expected `HTTPS`**
- **Found during:** Task 1
- **Issue:** The plan's behavior is that a plain http URL is named `HTTP`, so the old expectation was wrong under the decision.
- **Fix:** Changed that case to `HTTP` and added an upper-case `HTTP://github.com` case.
- **Files modified:** test/shared/notification-grammar.test.ts
- **Committed in:** a4ba4b1

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). **Impact:** both follow from the plan's own decision; no scope change.

## Issues Encountered

- The cucumber peer cache was empty in this worktree. `node scripts/install-test-peers.mjs` installed the declared test peers (pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, pi-dynamic-workflows 3.15.0) into `node_modules/.cache/optional-peers`. No package was added to the project.

## Known Stubs

None. The four row members and the note label have no producer yet by design (plan prohibition): the wave-2 and wave-3 plans and 04-25 set them, each with its scenario.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-60 is covered by the resolve case that redacts an http URL with userinfo and a label with userinfo. T-04-61 is covered by the closed-set lock, the `Record<CloneNoteKind, true>` enrollments, `additionalProperties: false`, and the schema drift check.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The vocabulary the call-site plans need exists: `via-http`, the clone member on the four row types, and the note label. 04-20 runs beside this plan and shares no file.

## Self-Check: PASSED

- All modified files exist; commits a4ba4b1, f2a514f, dd5644d are on this branch.
- Acceptance greps: `"via-http"` in types 1, wire 1, schema 8; `"Cloning via HTTP"` in grammar 1; `` `via-http` `` in json-output 1; url-source feature 1; `readonly clone?: CloneTransportNote` 14; `Cloning via HTTP: ` in output-catalog 1; git-source feature 1; `readonly plugin?: string` 1; `plugin: Type.Optional(Type.String())` 1; clone-note fields `plugin` row 1; `clone\.plugin` in output-catalog 1.
- Schema drift check clean after the final commit.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-26*
