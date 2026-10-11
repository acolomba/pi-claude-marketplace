---
phase: 04-wire-schema-and-json-strategy
fixed_at: 2026-10-04T13:35:00Z
review_path: .planning/phases/04-wire-schema-and-json-strategy/04-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-04T13:35:00Z
**Source review:** .planning/phases/04-wire-schema-and-json-strategy/04-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 3 (CR-02, WR-07, WR-08; IN-10 is Info and out of scope)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-02: A hand-edited `enabledPlugins` key leaks its URL password through the plugin row name in text and JSON

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts`, `tests/shared/notification-resolve.test.ts`, `tests/architecture/no-credential-leak.test.ts`
**Commit:** fbbacb2f
**Status:** fixed: requires human verification (the fix chooses a redaction rule)

**Applied fix:** `resolveRows` now redacts each row name through a new private helper, `redactRowName(name)`. The helper computes `redactCredentials(`${name}@`).slice(0, -1)`. A row names the plugin half of a `plugin@marketplace` subject, so the helper puts back the `@` that a last-`@` split removed. The row `foo@https://alice:s3cret` now displays as `foo@https://***`.

I fixed this at the chokepoint, not in the reconcile producer as the review suggested. The reasons:

- It is one line at the model chokepoint, which is where 04-06 put all subject redaction.
- It covers every row that comes from a last-`@` split. The producer fix covered only the two dangling-reference arms in `reconcile/notify.ts`. A declared-marketplace key such as `foo@https://alice:s3cret@mp` would still leak through pending and failed install rows.
- `parsePluginKey` and every planner lookup are unchanged, so the redaction affects display only.
- The edge's `splitPluginMarketplaceRef` splits at the first `@`, so a typed `install` ref was never affected.

Known trade-off, written in the helper's JSDoc: a row name that ends in `scheme://host:port` with no path is masked the same way. The redactor alone cannot tell that shape apart from userinfo.

**Evidence:**

- RED (before the source change):
  - New gate row `AUTH-09 / PMOD-04: neither strategy shows a credential planted in a plugin row name split from an enabledPlugins key` failed with `the presentation shows a planted credential` (`/tmp/claude-1000/rf04-cr01-red-gate.log`, EXIT=1, 37/38).
  - New owner test `PMOD-04 / D-07 redacts the userinfo a last-@ split leaves at the end of a row name` failed: `'foo@https://alice:s3cret'` against `'foo@https://***'` (`/tmp/claude-1000/rf04-cr01-red-resolve.log`).
- GREEN: gate 38/38, owner suites 117/117. The gate reads the presentation, `JSON.stringify(toWirePayload(...))` (row `name` and wire `id`), and the text, and it requires the `***` marker in both the payload and the text.
- Direct coverage for `notification-resolve.ts`: 108/108 branches, 23/23 functions, 628/628 lines.
- `lint:type-members` exit 0. Corpus `3143 baseline entries present, 0 extra`. `git diff --exit-code 4e6c568a -- docs/output-catalog.md` empty.
- `fallow audit` verdict `warn`, the same verdict as 04-06.

### WR-07: The `"name" in resolved` guard admits a non-string `name`, and `redactCredentials` throws in the diagnostic-row arm

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts`, `tests/shared/notification-resolve.test.ts`
**Commit:** a100e112
**Applied fix:** The guard now reads `const name: unknown = resolved.name;` and then tests `typeof name === "string"`. A widening annotation replaces the review's `as` cast, because `as` is not available in `extensions/`. A row without a string name keeps its shape.

**Evidence:** New owner test `keeps the shape of a diagnostic row whose name is undefined`. After CR-02 the old guard no longer threw. Instead it coerced the value to the string `'undefined'`, and the RED run caught that (`/tmp/claude-1000/rf04-wr01-red.log`). GREEN results:

- 156/156 across the resolve, present, and gate suites
- direct coverage 108/108 branches, 629/629 lines
- typecheck and ESLint clean
- corpus 3143 present, 0 extra
- catalog diff empty

### WR-08: The cascade subject-name gate rows do not read the production cascade text path, and their doc comment says they do

**Files modified:** `tests/architecture/no-credential-leak.test.ts`
**Commit:** cb18acb2
**Applied fix:** I took the faithful path. `probeCascadeSubject` became `probeReconcileAppliedSubject(marketplaces)`. It presents a `reconcile-applied-cascade` message, asserts that kind, and composes the text with `composeReconcileAppliedBody`, which is that kind's production text body (`formatPresentationBody`). The three subject rows moved to it: the block name of a failed add, the plugin row name, and the CR-02 split-key row. The doc comment now says what the probe does. The probe makes no notify call: the `\bnotify(` count stays at 4 and the corpus holds at 3143 present, 0 extra.

**Evidence:** Planted control: I temporarily replaced `notification-resolve.ts` with its pre-redaction version (`8f766751`). All three converted rows then failed for the intended reason (3 × `the presentation shows a planted credential`, `/tmp/claude-1000/rf04-wr02-control.log`). I restored the file with `git checkout --`. GREEN: 38/38.

## Verification

All gates ran in the **main checkout** (`/home/acolomba/src/pi-claude-marketplace-json`, branch `features/json`). No worktree was created. The orchestrator ordered sequential work in the main tree, even though `workflow.use_worktrees` is `true`. These numbers can be reproduced from this checkout.

Each commit was gated on `SKIP=trufflehog pre-commit run --files <exact files>` with `PC_EXIT=0`:

| Commit | Log | PC_EXIT |
| --- | --- | --- |
| fbbacb2f | `/tmp/claude-1000/rf04-cr01-precommit.log` | 0 |
| a100e112 | `/tmp/claude-1000/rf04-wr01-precommit.log` | 0 |
| cb18acb2 | `/tmp/claude-1000/rf04-wr02-precommit.log` | 0 |

The last run's `npm changed checks` hook (`check:changed`) used full scope: `npm run check` and `test:coverage:direct:all`. It ran on working-tree content identical to commit `cb18acb2` (tree `54213a99cada366921bf16fc86c9b83ff935a553`). The only additions were the two pre-staged planning files (`.planning/HANDOFF.json`, `.continue-here.md`), which are not part of any commit.

---

_Fixed: 2026-10-04T13:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
