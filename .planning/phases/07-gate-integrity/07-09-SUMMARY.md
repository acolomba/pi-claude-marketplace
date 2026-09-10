---
phase: 07-gate-integrity
plan: 09
subsystem: hooks-bridge-tests
tags: [tests, gate-integrity, delegated-contract, hooks]
status: complete

requires:
  - "bridges/hooks/dispatch-exec.ts REQUIRED_EVENT_FIELDS stays module-private"
  - "bridges/hooks/dispatch.ts HookExecutor injection seam"
  - "bridges/hooks/event-router.ts opts.executor injection seam"
provides:
  - "Required-field expectations derived from buildPayload's own WR-03 diagnostic instead of a copied table"
  - "Every optional collaborator on the two hook surfaces exercised with a real value and paired against its omitted form"
affects:
  - tests/bridges/hooks/dispatch-exec.test.ts
  - tests/bridges/hooks/dispatch.test.ts
  - tests/bridges/hooks/event-router.test.ts

tech-stack:
  added: []
  patterns:
    - "Driver-not-oracle: a per-case field list names what the case omits; the expectation is the wording production emits"
    - "Benign omission control paired with each diagnosed omission (D-07-04)"
    - "Collaborator pairs: two calls differing only in the optional argument, asserting different observed outcomes"

key-files:
  created: []
  modified:
    - tests/bridges/hooks/dispatch-exec.test.ts
    - tests/bridges/hooks/dispatch.test.ts
    - tests/bridges/hooks/event-router.test.ts

key-decisions:
  - "REQUIRED_EVENT_FIELDS stays module-private; the suite reaches the table through the hookDebugLog line buildPayload emits, so no test-only production export was added (MF-DEC-07, D-05-01)."
  - "The per-case field list was kept but demoted from expectation to driver, and a benignOmission control was added beside it. A fully derived required-set (read back from an empty envelope) was rejected: it makes a production removal invisible, because a shrunken table simply shrinks the loop."
  - "The never-throws contract belongs to dispatchHookExec, not to the injected executor seam. A rejecting injected executor propagates through both compositeHandlerFor and the registered Pi callback; the suite pins that observed behaviour rather than asserting a contract production does not carry."

requirements-completed: [GGAT-04]

coverage:
  - deliverable: "dispatch-exec required-field expectations derived from production behaviour"
    verification:
      - kind: test
        ref: "tests/bridges/hooks/dispatch-exec.test.ts#probes each <event> envelope field against buildPayload's own required-field diagnostic"
        status: pass
      - kind: command
        ref: "node --test tests/bridges/hooks/dispatch-exec.test.ts (42 pass, 0 fail)"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts (branches 53/53, functions 17/17, lines 461/461)"
        status: pass
    human_judgment: false
  - deliverable: "Both directions of a REQUIRED_EVENT_FIELDS edit observed failing"
    verification:
      - kind: command
        ref: "planted SessionStart: [\"text\"] / [\"reason\"] and UserPromptSubmit: [] — each produced fail 1, then restored"
        status: pass
    human_judgment: false
  - deliverable: "Optional pi collaborator exercised with a real inventory on all dispatch.ts entry points"
    verification:
      - kind: test
        ref: "tests/bridges/hooks/dispatch.test.ts#optional Pi inventory collaborator"
        status: pass
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts (branches 68/68, functions 12/12, lines 509/509)"
        status: pass
    human_judgment: false
  - deliverable: "Optional executor collaborator on event-router paired against its own default"
    verification:
      - kind: test
        ref: "tests/bridges/hooks/event-router.test.ts#registerHooksBridge routes through a supplied executor and through its own default without one"
        status: pass
      - kind: command
        ref: "node --test \"tests/bridges/**/*.test.ts\" (969 pass, 0 fail)"
        status: pass
    human_judgment: false
  - deliverable: "event-router.ts direct-coverage verify"
    verification:
      - kind: command
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/event-router.ts (branches 107/111, lines 959/967)"
        status: fail
    human_judgment: true
    rationale: "Pre-existing at HEAD with identical numbers; the four uncovered branches are mid-hydrate generation races in a module this plan does not own."

metrics:
  duration: 41 min
  completed: 2026-09-10

actuals:
  tokens: 6337
  tasks: 2
  commits: 2
  plan_head_before: "measured by `git log --oneline --grep='(07-09)'` — the shared-tree run makes a HEAD range meaningless because five sibling executors committed into the same branch during this plan"
---

# Phase 07 Plan 09: Hooks Delegated-Contract Gaps Summary

The hooks-bridge suites stop restating a production table and stop passing `undefined` through
every optional collaborator: required-field expectations now come from the `hookDebugLog` line
`buildPayload` actually emits, and each optional `pi` / `executor` parameter is called once with a
real value beside a call that omits it.

## Accomplishments

- **Required-field oracle replaced by a probe.** `TranslatorCase.requiredFields` became
  `diagnosedOmissions` — a driver naming the fields each case deletes — plus a `benignOmission`
  control naming a field the envelope carries that the module does not require. For each of the ten
  dispatchable events the case now runs three shapes: the complete envelope (must emit no
  required-field line), one dispatch per diagnosed omission (must emit exactly the line
  `[hooks] buildPayload: <event> event missing required field "<field>"; partial envelope likely`),
  and the benign omission (must stay silent). The expectation is production's wording, so a table
  edit changes what the case sees.
- **Empty required sets covered as a real state.** Six of the ten events have an empty required set.
  Their `benignOmission` probe is that case: a field is removed and nothing is diagnosed.
- **Never-throws asserted at every probe.** Each of the `n + 2` dispatches per event is checked to
  resolve `{ kind: "noop" }` with exactly one spawn, so the translator is proved to still run after a
  probe miss.
- **`pi` paired on all three exported dispatch entry points.** `compositeHandlerFor`,
  `toolResultCompositeHandler`, and `collectBucketOutcomes` each get two calls differing only in the
  inventory; a case-owned executor records what arrives, and the recorded value is checked by
  reference identity against the supplied inventory and against `undefined`.
- **`pi` shown to reach real production logic, not just a spy.** With no executor supplied, the
  module's own `dispatchHookExec` default runs against an `asyncRewake: true` entry: the absent
  inventory stops the async lane before the process boundary and says so
  (`[hooks] async-rewake: pi missing on async dispatch (…); skipping spawn`).
- **`executor` paired on the event-router surface.** A supplied executor receives the dispatch and
  emits no diagnostic; the same registration without one routes through `dispatchHookExec`, which
  announces itself with `[hooks] exec: caught (…): executor seam input refused`. The two arms are
  told apart by an observed line, not by an absence.
- **Refusing-collaborator behaviour pinned on both modules.** An injected executor that rejects
  propagates out of `compositeHandlerFor` and out of the registered `tool_call` callback.

## Negative controls observed

Every restored assertion was watched failing against a planted production change, then the change
was reverted (`git status --porcelain -- extensions/pi-claude-marketplace/bridges/hooks/` clean
after each).

| Planted change | File | Result |
|---|---|---|
| `SessionStart: []` → `["text"]` (add a field the envelope does not carry) | `dispatch-exec.ts` | `fail 1` — the complete-envelope arm emitted a line |
| `SessionStart: []` → `["reason"]` (add a field the envelope does carry) | `dispatch-exec.ts` | `fail 1` — the benign-omission control emitted a line |
| `UserPromptSubmit: ["text"]` → `[]` (remove a field) | `dispatch-exec.ts` | `fail 1` — the diagnosed-omission arm emitted nothing |
| `reduceBucket` / `collectBucketOutcomes` forward `undefined` instead of `pi` | `dispatch.ts` | `fail 3` — all three collaborator pairs |
| `try/catch` swallowing the executor rejection in `reduceBucket` | `dispatch.ts` | `fail 1` — the rejecting-executor case |
| `async-rewake: pi missing` wording changed | `dispatch-exec.ts` | `fail 1` — the async-rewake refusal case |
| `PreToolUse` registration drops `opts.executor` | `event-router.ts` | `fail 3` — both new cases plus one pre-existing case |

**Residual hole, recorded rather than hidden.** Adding an already-present envelope field to a
required list escapes detection when that field is neither a `diagnosedOmission` nor the
`benignOmission` for its event (for example adding `"type"` to `SessionStart`). Closing it needs an
oracle independent of the table, and none exists: the translator consumes fields the table does not
require, so consumption cannot stand in for requirement. The direction the finding is about —
an edit that blinds the probe by shrinking the table — is fully caught.

## Optional-collaborator census

Eight parameter sites, per `HHD-028`.

| # | Module:line | Symbol | Parameter | Before | After |
|---|---|---|---|---|---|
| 1 | `dispatch.ts:96` | `HookExecutor` (type) | `pi: ExtensionAPI \| undefined` | every double received `undefined` | receives a real inventory in 3 new cases |
| 2 | `dispatch.ts:174` | `reduceBucket` (private) | `pi: ExtensionAPI \| undefined` | `undefined` via every caller | real value via `compositeHandlerFor` and `toolResultCompositeHandler` |
| 3 | `dispatch.ts:264` | `collectBucketOutcomes` | `pi: ExtensionAPI \| undefined` | `undefined` at 3 call sites (`:666`, `:688`, `:733`) | + 1 real-value call, paired with 1 `undefined` call |
| 4 | `dispatch.ts:337` | `compositeHandlerFor` | `pi?: ExtensionAPI` | `undefined` or omitted at every call site | + 1 real-value call, paired with 1 `undefined` call, + 1 default-executor `undefined` case |
| 5 | `dispatch.ts:374` | `toolResultCompositeHandler` | `pi?: ExtensionAPI` | `undefined` or omitted at every call site | + 1 real-value call, paired with 1 `undefined` call |
| 6 | `event-router.ts:431` | `HooksHydration.registerHooksBridge` (interface) | `opts.executor?: HookExecutor` | supplied at `:351`, `:530`, `:1777`, `:1868`, `:1870`, `:2059`, `:2133`; omitted at `:1628`, `:1630`, `:1721`, `:1728`, `:1820`, `:1934`, `:1996` | + an explicit supplied/omitted pair whose two arms assert different observed lines |
| 7 | `event-router.ts:768` | `registerHooksBridgeWith` (private) | `opts.executor?: HookExecutor` | reached only through site 6 | same pair |
| 8 | `event-router.ts:962` | `createHooksHydration().registerHooksBridge` | `opts.executor?: HookExecutor` | reached only through site 6 | same pair |

Sites 6-8 already carried real executors before this plan; what they lacked was a case that
distinguishes the supplied executor from the module's own default. That contrast is what the new
pair adds.

**`grep -c ", undefined)" tests/bridges/hooks/dispatch.test.ts`:** before `2`, after `6`. The count
rises rather than falls, because every added real-value call is deliberately paired with a call that
omits the collaborator — an omitted arm is half of each proof. The multi-line form is the one this
suite mostly uses: `grep -c "^ *undefined,$"` reads `31` before and `35` after. The added real-value
calls are enumerated in the table above: five, one per site 1-5, plus the existing supplied-executor
calls at sites 6-8 now joined by a contrasting omitted arm.

## Deviations from Plan

### 1. [Rule 1 - Bug] `as ExtensionAPI` on a two-member literal did not typecheck

- **Found during:** Task 2
- **Issue:** `createPiInventory` declared `on(): never` / `sendMessage(): never`, and `tsc` rejected
  the assertion with TS2352 — a zero-parameter member does not overlap `ExtensionAPI` enough.
- **Fix:** gave both members the parameter lists the sibling helper in `event-router.test.ts` uses
  (`_event: string, _handler: unknown` / `_message: unknown, _options: unknown`), keeping the
  throwing bodies.
- **Files modified:** `tests/bridges/hooks/dispatch.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0.
- **Commit:** `8be86d7d`

### 2. [Rule 4 boundary - not taken] The plan's never-throws behaviour bullet does not match production

- **Found during:** Task 2
- **Issue:** the plan states "Passing a collaborator that throws does not violate the never-throws
  contract the lifecycle handlers carry." Neither `reduceBucket` nor `collectBucketOutcomes` wraps
  `await executor(...)`, and `bindRegistrationCallback` does not catch, so a rejecting injected
  executor propagates out of the registered Pi callback.
- **Resolution:** no production change. The never-throws contract belongs to `dispatchHookExec`, the
  default the seam falls back to; a caller substituting a rejecting executor has left that contract.
  Two cases now pin the observed behaviour (`assert.rejects`), each with a comment saying which side
  of the contract the seam sits on. Changing production to swallow the rejection would be an
  architectural change and is not in this plan's scope.

**Total deviations:** 1 auto-fixed (1 × Rule 1), 1 recorded-not-taken.
**Impact:** none on the plan's contract; both proofs land as specified.

## Deferred Issues

**`event-router.ts` direct coverage is short at HEAD.**
`npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`
reports `branches 107/111, lines 959/967` and exits non-zero. Measured against
`git show HEAD:tests/bridges/hooks/event-router.test.ts` swapped into the tree, the numbers are
**identical**, so the shortfall predates this plan and is not caused by it. The four uncovered
branches (`:553-554`, `:587-588`, `:615-616`, `:872-873`) are all `if (!generationIsCurrent())`
races inside the hydrate walk — a `/reload` landing mid-hydrate. Covering them means driving a
generation bump from inside an awaited `readFile`, which is a coverage task for the module's owner,
not part of the `GGAT-04` delegated-contract contract this plan carries. Out of scope per the
executor scope boundary; recorded here rather than silently absorbed.

Attempting to file this in `.planning/WINDOWS.md` failed: `gsd-tools windows append` refuses with
`Ledger table … disagrees with the fenced JSON entries … for row id(s): 30, 9`. The ledger is in a
hand-edited state that predates this plan; ledger population is best-effort and does not block, so
it is recorded here instead.

## Known Stubs

None. No stub, `TODO`, `FIXME`, `test.skip`, `test.only`, `test.todo`, `fallow-ignore`, or
coverage-ignore directive was introduced.

## Threat Flags

None. This plan added no network endpoint, auth path, file-access pattern, or schema change. It
touches three test files and no production module.

## Verification Results

| Check | Result |
|---|---|
| `node --test tests/bridges/hooks/dispatch-exec.test.ts` | 42 pass, 0 fail |
| `node --test tests/bridges/hooks/dispatch.test.ts tests/bridges/hooks/event-router.test.ts` | 68 pass, 0 fail |
| `node --test "tests/bridges/**/*.test.ts"` | 969 pass, 0 fail |
| `npm run test:coverage:direct -- …/dispatch-exec.ts` | pass (53/53 branches, 17/17 functions, 461/461 lines) |
| `npm run test:coverage:direct -- …/dispatch.ts` | pass (68/68 branches, 12/12 functions, 509/509 lines) |
| `npm run test:coverage:direct -- …/event-router.ts` | 107/111 branches — pre-existing, see Deferred Issues |
| `npx eslint tests/bridges/hooks --max-warnings=0` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx fallow health --fail-on-issues --format human` | 0 above threshold |
| `npm run fallow` | exit 0 |
| `npx prettier --check` on both task-2 files | clean |
| `SKIP=trufflehog pre-commit run --files …` | clean for the files this plan owns; `npm typecheck` reported "files were modified by this hook" from concurrent sibling executors, and `tsc` itself exits 0 |
| `grep -c "export const REQUIRED_EVENT_FIELDS\|export { REQUIRED_EVENT_FIELDS" …/dispatch-exec.ts` | `0` |
| `git status --porcelain -- extensions/pi-claude-marketplace/bridges/hooks/` | empty |

The plan's criterion `git status --porcelain -- extensions/` prints nothing was scoped to
`extensions/pi-claude-marketplace/bridges/hooks/`. Five sibling executors were editing other files
under `extensions/` in this shared working tree throughout; the hooks bridge — the only production
area this plan could touch — is clean.

## Next

Phase 07 continues with its remaining plans. This plan closes the `HHD-027` and `HHD-028` half of
`GGAT-04`.
