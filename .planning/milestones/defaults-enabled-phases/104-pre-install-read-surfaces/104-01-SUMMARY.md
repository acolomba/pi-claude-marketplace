---
phase: 104-pre-install-read-surfaces
plan: 01
subsystem: ui
tags: [notify, list, resolver, reason-tokens, defaultEnabled, closed-set]

# Dependency graph
requires:
  - phase: 102-install-surface
    provides: "the `installs disabled` reason token and the `DECLARED_STATE_REASONS` group this plan reuses without minting a new member"
  - phase: 101-default-enabled-resolution
    provides: "`resolveDefaultEnabled` and its value-test discipline, which the new read-side predicate mirrors and sits above"
provides:
  - "`entryDeclaresInstallDisabled(entry)` — the exported one-parameter domain predicate that answers the install-disabled question from the marketplace entry alone"
  - "`PluginAvailableMessage.reasons?` — the optional reason field on the `(available)` list row"
  - "the list `available` render arm forwarding the row's own reasons into `composeReasons`"
  - "`installsDisabledField` — the conditional-spread stamp inside `availableRowMessage`, spread into the `installable` arm"
  - "two corrected `installs disabled` charter comments that distinguish an installed-record inventory row from a not-installed candidate row"
  - "`domain/resolver.ts` on the NFR-5 source-grep network gate"
affects: [104-02-remote-and-partial-arms, 104-03-info-surface, 104-04-behavioral-offline-proof, 105-parity-and-divergence-docs]

actuals:
  tokens: 4763
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "one-parameter predicate as a containment mechanism: the signature, not a convention, is what stops a later caller supplying a second value source"
    - "a pure-leaf domain predicate gets a direct per-concern unit test file (`tests/domain/resolver-default-enabled.test.ts`), not behavioral-only coverage"

key-files:
  created:
    - tests/domain/resolver-default-enabled.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/architecture/no-orchestrator-network.test.ts

key-decisions:
  - "D-104-01: the marketplace entry is the only source the read surfaces consult, and the predicate's one-parameter signature is the enforcement — there is no second parameter a later caller could feed a plugin manifest through"
  - "D-104-01 (silence rule): only a literal `false` claims; `true`, absent, and a non-boolean past the validator are all silent, mirroring the sibling precedence function's value-test discipline"
  - "D-104-02: reuse the existing `installs disabled` token; the closed reason sets grow by zero members, so COMPAT-01 and the closed-set locks stay untouched"
  - "D-104-03: the token rides not-installed candidate rows only; both `unavailable` arms are permanently excluded and every installed-record arm is untouched by construction rather than by a guard"
  - "The charter-comment corrections are the change's own obligation, not tidying — both comments asserted invariants this change falsifies"

patterns-established:
  - "Containment by signature: where a decision must consult exactly one source, express that as a one-parameter function rather than a documented convention on a wider one."
  - "Three-row byte-equal parity assertion: prove the positive claim and the no-op parity of the silent and opposite-declaring cases in one whole-body `assert.equal`, so a regression on either side fails the same test."

requirements-completed: [OUT-02, OUT-05]

coverage:
  - id: D1
    description: "A `/claude:plugin list` `(available)` row carries `{installs disabled}` when the plugin's marketplace entry declares the install-time default false, rendered offline with no clone materialized."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#OUT-02 / D-104-01: an entry declaring `defaultEnabled: false` puts `{installs disabled}` on its `(available)` row; a declared-true entry and a silent entry stay bare"
        status: pass
    human_judgment: false
  - id: D2
    description: "A `defaultEnabled: true` entry and an entry omitting the field both render exactly the pre-change bytes — the no-op parity every plugin that does not use the field is owed."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#OUT-02 / D-104-01: an entry declaring `defaultEnabled: false` puts `{installs disabled}` on its `(available)` row; a declared-true entry and a silent entry stay bare"
        status: pass
      - kind: unit
        ref: "npm test (3523 tests, 0 fail) — every pre-existing list/info/catalog byte assertion is itself this regression test"
        status: pass
    human_judgment: false
  - id: D3
    description: "The install-disabled question is answered by exactly one exported domain predicate taking exactly one parameter, and only a literal `false` claims; true, absent and non-boolean are silent."
    requirement: OUT-05
    verification:
      - kind: unit
        ref: "tests/domain/resolver-default-enabled.test.ts (4 cases, all pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The closed reason sets grow by zero members — membership, order and length are unchanged."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts + tests/architecture/compat-01-no-expansion.test.ts (18 tests, all pass)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`domain/resolver.ts` cannot acquire a git/network surface without a test failing (NFR-5 structural half)."
    requirement: OUT-05
    verification:
      - kind: unit
        ref: "tests/architecture/no-orchestrator-network.test.ts#NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface"
        status: pass
    human_judgment: false
  - id: D6
    description: "The two `installs disabled` charter comments describe the code as it now behaves, distinguishing an installed-record inventory row from a not-installed candidate row."
    verification: []
    human_judgment: true
    rationale: "Prose accuracy against a settled decision is a reading judgment; no automated check can assert that a comment and its code agree."

# Metrics
duration: 47min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 01: Pre-install read surfaces — tracer Summary

**A `/claude:plugin list` `(available)` row now says `{installs disabled}` when the plugin's marketplace entry declares the install would land disabled — sourced from the entry alone, offline, with the silence rule pinned by a direct unit contract and the resolver added to the NFR-5 network gate.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-08-15T17:33:00Z (approx — first read)
- **Completed:** 2026-08-15T18:20:45Z
- **Tasks:** 3
- **Files modified:** 7 modified, 1 created

## Accomplishments

- The end-to-end path exists and is proven by bytes, not by inference: entry → predicate → conditional-spread stamp → message shape → render arm → `  ○ alpha v1.0.0 (available) {installs disabled}`.
- The architecture question the phase actually carries — *where does the claim come from, and does the same plugin render the same warm and cold* — is answered by the predicate's signature. It takes a `PluginEntry` and nothing else, so there is no parameter a later caller could feed a plugin manifest through.
- No-op parity is proven on the same run as the positive case: a `defaultEnabled: true` entry and a silent entry render byte-identically to the pre-change output.
- The closed reason sets grew by zero members. The `installs disabled` token was reused, so COMPAT-01's no-expansion gate and the closed-set length locks were never touched.
- Both charter comments that this change falsified now describe the code, with the installed-record/not-installed-candidate distinction and the durable-versus-transient rule that separates them written down where the next reader will find them.

## Task Commits

1. **Task 1 (tracer): end-to-end `(available)` arm** — `4ddabd3d` (feat)
2. **Task 2: correct the two charter comments** — `0131892e` (docs)
3. **Task 3: predicate unit contract + network gate target** — `4a33d8b7` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/resolver.ts` — new exported `entryDeclaresInstallDisabled(entry: PluginEntry): boolean`, placed immediately above the module-private precedence function it mirrors. Multi-paragraph doc covering the entry-only source, why the strict `=== false` comparison is the rule rather than a shorthand for it, the degrade-to-silent contract, why it is separate from the precedence function, and why the name leads with the source.
- `extensions/pi-claude-marketplace/shared/notify.ts` — `PluginAvailableMessage` gains `readonly reasons?: readonly ContentReason[]`; its doc's `no reasons` clause replaced with the four-part paragraph the sibling disabled shape established. Separately (Task 2), the `installs disabled` charter comment in the `REASONS` tuple corrected.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — the `DECLARED_STATE_REASONS` group charter's reached-state sentence corrected; the group now reads as one cause across two tenses.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` — the `available` arm forwards `p.reasons` into `composeReasons` instead of a hard-coded absent value; both soft-dep flags stay `false`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — `entryDeclaresInstallDisabled` added to the existing resolver import; `installsDisabledField` conditional spread added inside `availableRowMessage` and spread into the `installable` arm only.
- `tests/orchestrators/plugin/list.test.ts` — one three-row whole-body byte-equal assertion, placed beside the `(remote)` bare-row family.
- `tests/domain/resolver-default-enabled.test.ts` (NEW) — the predicate's four-case silence contract.
- `tests/architecture/no-orchestrator-network.test.ts` — `domain/resolver.ts` appended to `FORBIDDEN_TARGETS` with its rationale; patterns, test body and failure message untouched.

## Decisions Made

None beyond the plan — every design call was settled by CONTEXT or by the orchestrator before planning. Two judgment calls worth recording:

- **Import member order.** `entryDeclaresInstallDisabled` was added to `list.ts`'s existing resolver import as `{ entryDeclaresInstallDisabled, resolveStrict, type ResolveContext }`, which forced the single-line import to wrap. That matches the file's own convention (values alphabetical, type-only members last) rather than appending at the tail.
- **`actuals.tokens` scale.** Recorded as chars/4 over the realized diff (19,054 chars → 4,763), per the executor's stated method. The plan's `estimate.tokens: 75000` is plainly on a different scale — a read-plus-write context budget, not diff size; chars/4 over the full text of all eight touched files is 114,048. The estimate is not off by 15x; the two numbers measure different things, and a calibrator should treat this pair as unusable rather than as a miss.

## Mandated Checks

### Mutation check — the silence rule (Task 1)

Changed the predicate body to `return !entry.defaultEnabled;`, ran `node --test tests/orchestrators/plugin/list.test.ts`, then discarded the edit. **Two** tests failed, not one:

- The new test failed with `gamma` — the entry that omits the field entirely — acquiring a brace it must not have:
  ```
  '  ○ gamma v1.0.0 (available) {installs disabled}'
  ```
  `beta` (declared `true`) correctly stayed bare, because `!true` is `false`. So the negation form is caught specifically by the ABSENT case, which is exactly why that case is in the unit contract.
- `PL-1: no flags = every bucket` also failed, with its silent `beta` entry gaining the brace. That is the stronger signal: under the negation form, every silent entry in the whole corpus starts claiming, and the pre-existing byte assertions catch it. The suite returned to 76/76 after the revert.

### Mutation check — the network gate (Task 3)

Appended `const __mutation_probe = { gitOps: null };` to `domain/resolver.ts` outside any comment, ran the gate, then discarded via `git checkout --`. The gate failed and named the file:

```
NFR-5 / PI-2 / PL-3 / PRL-07 violation: gitOps surface detected in plugin orchestrator(s):
  extensions/pi-claude-marketplace/domain/resolver.ts matches forbidden gitOps reference: /\bgitOps\b/
```

Gate green again after the revert; `git diff --name-only -- extensions/` was empty for Task 3.

### Check-only reads (Task 2) — both found accurate, neither edited

- **`orchestrators/plugin/install.messaging.ts:37-57`, the `INSTALL_STATUSES` doc.** The clause under scrutiny is *"DFEN-04: `disabled` joins for the install that landed disabled because the plugin's own `defaultEnabled` declaration said so."* It is scoped to install's OWN status set, and this plan changes nothing about what install reads, emits, or when it emits `disabled`. **Accurate as written; not edited.**
- **`shared/notify.ts:774-815`, the `PluginDisabledMessage` doc block.** The clause under scrutiny is *"`reasons` is OPTIONAL here, exactly as on `PluginInstalledMessage`, `PluginUpdatedMessage` and `PluginReinstalledMessage`."* This plan adds a fourth carrier of the field, `PluginAvailableMessage`. That does not falsify the clause: it asserts a likeness ("optional here in the same way it is there"), not an exhaustive census of carriers, and the paragraph's subject throughout is which reasons the DISABLED shape admits — unchanged by this plan. **Accurate as written; not edited.** (Judgment call, borderline on the enumeration. If a later reader wants the list kept current, that is a widening of the comment's contract, not a correction of a false clause.)

## Deviations from Plan

None — plan executed exactly as written. No deviation rule was invoked, and no auto-fix was needed.

## Issues Encountered

- **The `trufflehog` pre-commit hook fails structurally in this worktree**, exactly as CLAUDE.md documents: `failed to read index file: .../.git/index: not a directory`. Handled by the sanctioned route — a `trufflehog filesystem` scan over the committed paths at `--results=verified,unknown --fail` before each commit (clean all three times: 0 verified, 0 unverified), then `SKIP=trufflehog` on that commit alone. Every other hook passed on every commit; no `--no-verify` anywhere.
- Nothing else. No blocked task, no auth gate, no package install.

## Known Stubs

None. Every code path this plan added is wired to a real data source and proven by a byte-level assertion. Nothing is placeholder, mocked-in-production, or awaiting a later plan to become functional.

Scope note, not a stub: the `remote` and `partially-available` arms do not carry the token yet, and the `info` surface is untouched. Both are the next plans' work by design (this plan is the deliberately-narrow tracer), not unfinished work left behind here.

## Verification Run

| Command | Result |
|---|---|
| `node --test tests/orchestrators/plugin/list.test.ts` | 76/76 pass |
| `node --test tests/domain/resolver-default-enabled.test.ts` | 4/4 pass |
| `node --test "tests/architecture/**/*.test.ts"` | 353 pass, 0 fail, 1 skip (pre-existing) |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm test` | 3523 tests, 3522 pass, 0 fail, 1 skip (pre-existing) |

`npm run check` was deliberately NOT run — a later plan owns that gate in its own wave. Its five constituents (typecheck, lint, format:check, test) all ran green here except `test:integration`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready. What the next plans inherit:

- The predicate exists, is exported from the module path (NOT the barrel — `domain/index.ts` was not touched), and both future consumers can import it from the same statement pattern `list.ts` now uses.
- `PluginAvailableMessage.reasons?` is live; `PluginRemoteMessage.reasons?` is still to be added, and its D-80-03 "NO `reasons`" doc clause will need the same narrowing this plan applied to the `available` shape.
- `installsDisabledField` is declared once inside `availableRowMessage` and spread into ONE arm. The next plan extends it to the cold-clone early return and the `partially-available` arm; the two `unavailable` arms and the probe-failure catch stay excluded permanently (D-104-03).
- The comment on `installsDisabledField` states the RULE (candidate rows whose install would happen; `unavailable` permanently excluded) rather than enumerating which arms currently spread it, so extending the spread does not require rewriting it.

One carried item for a later capture, deliberately not fixed here per the surgical-changes rule: the existing NFR-5 behavioral guard at `tests/orchestrators/plugin/list.test.ts` (the `readFile`-on-a-directory check near the file's tail) proves nothing — `readFile` on an existing directory throws `EISDIR`, so its boolean is unconditionally `false`, and it runs before `listPlugins` anyway. Plan `104-04` writes a correct sibling; leaving two guards where one is known hollow should not be the end state.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/resolver.ts` — FOUND (predicate present, 1 non-comment occurrence)
- `tests/domain/resolver-default-enabled.test.ts` — FOUND (created)
- Commit `4ddabd3d` — FOUND
- Commit `0131892e` — FOUND
- Commit `4a33d8b7` — FOUND
- `extensions/pi-claude-marketplace/domain/index.ts` — absent from `git diff --name-only` and `git status --porcelain` (barrel untouched, as required)
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — not among the touched files

---
*Phase: 104-pre-install-read-surfaces*
*Completed: 2026-08-15*
