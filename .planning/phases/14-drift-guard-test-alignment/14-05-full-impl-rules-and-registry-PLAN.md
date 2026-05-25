---
phase: 14-drift-guard-test-alignment
plan: 05
type: execute
wave: 3
depends_on:
  - 14-03-drift-guard-infrastructure
files_modified:
  - tests/lint-rules/msg-sr-1-success-routing.js
  - tests/lint-rules/msg-sr-1-success-routing.test.js
  - tests/lint-rules/msg-sr-2-warning-routing.js
  - tests/lint-rules/msg-sr-2-warning-routing.test.js
  - tests/lint-rules/msg-sr-3-error-routing.js
  - tests/lint-rules/msg-sr-3-error-routing.test.js
  - tests/lint-rules/msg-sr-4-cascade-success.js
  - tests/lint-rules/msg-sr-4-cascade-success.test.js
  - tests/lint-rules/msg-sr-5-cascade-warning.js
  - tests/lint-rules/msg-sr-5-cascade-warning.test.js
  - tests/lint-rules/msg-sr-6-no-cascade-error.js
  - tests/lint-rules/msg-sr-6-no-cascade-error.test.js
  - tests/lint-rules/msg-sr-7-usage-error-routing.js
  - tests/lint-rules/msg-sr-7-usage-error-routing.test.js
  - tests/lint-rules/msg-mr-1-manual-recovery-anchor.js
  - tests/lint-rules/msg-mr-1-manual-recovery-anchor.test.js
  - tests/lint-rules/msg-mr-2-manual-recovery-system.js
  - tests/lint-rules/msg-mr-2-manual-recovery-system.test.js
  - tests/lint-rules/msg-rp-1-rollback-partial.js
  - tests/lint-rules/msg-rp-1-rollback-partial.test.js
  - tests/lint-rules/msg-cc-1-cause-chain.js
  - tests/lint-rules/msg-cc-1-cause-chain.test.js
  - tests/lint-rules/msg-nc-1-entity-error.js
  - tests/lint-rules/msg-nc-1-entity-error.test.js
  - tests/lint-rules/msg-nc-2-usage-separator.js
  - tests/lint-rules/msg-nc-2-usage-separator.test.js
  - tests/lint-rules/msg-rh-1-reload-hint.js
  - tests/lint-rules/msg-rh-1-reload-hint.test.js
  - tests/lint-rules/msg-lc-1-console-warn-form.js
  - tests/lint-rules/msg-lc-1-console-warn-form.test.js
  - tests/lint-rules/msg-lc-2-eslint-discipline.js
  - tests/lint-rules/msg-lc-2-eslint-discipline.test.js
  - tests/lint-rules/msg-sd-1-soft-dep-reason.js
  - tests/lint-rules/msg-sd-1-soft-dep-reason.test.js
  - tests/lint-rules/msg-sd-2-soft-dep-predicate.js
  - tests/lint-rules/msg-sd-2-soft-dep-predicate.test.js
  - tests/lint-rules/index.js
  - tests/architecture/msg-rule-registry.test.ts
autonomous: true
requirements:
  - CMC-38

must_haves:
  truths:
    - "Exactly 18 full-impl rule files exist under tests/lint-rules/ -- one per MSG-* ID in the full-impl set per RESEARCH.md Pattern 2 §'Which MSG-* IDs are full-impl?': MSG-SR-1..7 (7) + MSG-MR-1..2 (2) + MSG-RP-1 (1) + MSG-CC-1 (1) + MSG-NC-1..2 (2) + MSG-RH-1 (1) + MSG-LC-1..2 (2) + MSG-SD-1..2 (2) = 18."
    - "MSG-ER-1 is NOT in this plan (it is meta-assertion family in Plan 04)."
    - "Each full-impl rule has a real AST visitor (CallExpression / TemplateLiteral / Literal / Comment as appropriate) that reports a violation with a messageId whose error message includes the MSG-* rule ID (SC #2)."
    - "Each rule has a RuleTester companion `.test.js` with the 4-line node:test shim + ≥1 `valid:` case + ≥1 `invalid:` case asserting the messageId byte-exactly."
    - "`tests/lint-rules/index.js` now imports + registers all 34 rules (16 meta from Plan 04 + 18 full-impl from this plan); `RULE_NAMES.length === 34`."
    - "`tests/architecture/msg-rule-registry.test.ts` exists with 4 assertions (D-14-12 registry parity): (a) every MSG-* ID found in `docs/messaging-style-guide.md` has a corresponding rule file name (slug-prefix match); (b) every rule name has a style-guide MSG-* anchor; (c) every rule name is registered in `eslint.config.js` -- GATED until Plan 06 lands; (d) total rule count equals 34."
    - "Assertion (c) is GATED behind a runtime check on eslint.config.js: if the file does not contain a `msg/` plugin namespace literal, the assertion is t.todo()'d / test.skip()'d with a 'pending: enabled by Plan 06 wiring' note. Plan 06 Task 2 removes the gate by adding the `import msgPlugin` line + 34 rule registrations; once that lands, assertion (c) becomes active and asserts 1:1 parity. **Option A (sanctioned RED commit) is forbidden** per D-14-03 'every wave green' invariant + NFR-6."
    - "All RuleTester companions and the registry test PASS under `node --test` at the Plan 05 commit (assertion (c) skips with todo marker until Plan 06)."
    - "`npm run check` is GREEN at the Plan 05 commit."
  artifacts:
    - path: tests/lint-rules/msg-sr-7-usage-error-routing.js
      provides: "MSG-SR-7: AST visitor detecting notifyError + USAGE concatenation"
      contains: "useNotifyUsageError"
    - path: tests/lint-rules/msg-rp-1-rollback-partial.js
      provides: "MSG-RP-1: AST visitor detecting hand-composed (failed) {rollback partial} literal outside the composer"
      contains: "rollback partial"
    - path: tests/architecture/msg-rule-registry.test.ts
      provides: "Registry parity test asserting MSG-* ID ↔ rule file ↔ eslint.config.js registration (assertion (c) gated until Plan 06)"
      contains: "RULE_NAMES"
  key_links:
    - from: tests/architecture/msg-rule-registry.test.ts
      to: tests/lint-rules/index.js
      via: "import { RULE_NAMES } from '../../tests/lint-rules/index.js'"
      pattern: "RULE_NAMES"
    - from: tests/architecture/msg-rule-registry.test.ts
      to: eslint.config.js
      via: "readFile text + gated regex match for `\"msg/<name>\":`"
      pattern: "msg/msg-"
---

<objective>
Land the remaining 18 MSG-* drift-guard rules -- the full-impl subset that requires real AST coverage -- plus the registry parity test that ties the four moving parts together (style-guide body, rule files, eslint.config.js wiring, plugin module). Per D-14-09 (LOCKED), these rules implement AST visitors detecting specific code patterns the style guide forbids; their RuleTester companions include ≥1 planted-violation `invalid:` case per rule that asserts the messageId byte-exactly (SC #1 + SC #2).

**Locked count (per RESEARCH.md Pattern 2 enumeration):**

The 18 full-impl MSG-* IDs are: MSG-SR-1..7 (7) + MSG-MR-1..2 (2) + MSG-RP-1 (1) + MSG-CC-1 (1) + MSG-NC-1..2 (2) + MSG-RH-1 (1) + MSG-LC-1..2 (2) + MSG-SD-1..2 (2) = **18**. MSG-ER-1 is NOT in this plan -- it lives in Plan 04 as meta-assertion (the structural enforcement is `EmptyToken.token: Extract<StatusToken, "no marketplaces" | "no plugins">`). Total split: 16 meta (Plan 04) + 18 full-impl (Plan 05) = 34.

**Per-rule detection targets (from RESEARCH.md Pattern 2 §"Which MSG-* IDs are full-impl?"):**
- MSG-SR-1..7: notifySuccess / notifyWarning / notifyError / notifyUsageError callsite routing -- AST `CallExpression` visitor inspecting callee identifier + arguments.
- MSG-MR-1..2: manual-recovery anchor emission -- detect any string literal matching `MANUAL RECOVERY REQUIRED:` outside the renderer.
- MSG-RP-1: rollback-partial composition -- detect hand-composed `(failed) {rollback partial}` strings outside `presentation/rollback-partial.ts`. After Plan 06's `transaction/rollback.ts` refactor, this rule fires only on planted tests.
- MSG-CC-1: cause-chain trailer -- detect manual `Cause:` / `cause:` string composition outside `presentation/cause-chain.ts`.
- MSG-NC-1: entity-shaped non-cascade errors -- detect literal `unicode-block-icon <name>` patterns outside the renderer.
- MSG-NC-2: blank-line separator between message and USAGE block -- detect `notifyError(ctx, msg + "\n" + USAGE)` patterns (overlaps MSG-SR-7's detection; MSG-SR-7 is the canonical implementation, MSG-NC-2 cites it via a near-identical visitor or shares the AST visitor logic via a small helper).
- MSG-RH-1: reload-hint trailer -- detect literal `Run /reload` and `/reload to <verb>` strings outside `presentation/reload-hint.ts`.
- MSG-LC-1: console.warn sentence form -- detect any `console.warn` outside `persistence/migrate.ts:178`.
- MSG-LC-2: eslint discipline -- detect any `eslint-disable*` comment touching `no-restricted-syntax` or `no-console` outside the single migrate.ts callsite.
- MSG-SD-1..2: soft-dep emission predicate -- detect hand-composed `{requires pi-subagents}` / `{requires pi-mcp}` strings outside `presentation/compact-line.ts::composeReasons`.

Purpose: Closes the remaining 18 of 34 MSG-* drift-guard rules; ships the registry parity test asserting 1:1:1 across style-guide body ↔ rule files ↔ plugin registration (D-14-12 LOCKED). Failure of any rule produces the MSG-* ID embedded in the message -- satisfies SC #1 ("intentional planted violation makes npm run check fail with clear, locatable error") + SC #2 ("failure includes MSG-* rule ID"). Per D-14-09 (LOCKED meta vs. full split) + D-14-12 (LOCKED body-scan registry test).
Output: All 34 rules exist; registry test exists with assertion (c) gated until Plan 06 wiring lands; per-rule planted-violation tests pass; `npm run check` GREEN at the Plan 05 commit.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md
@.planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md
@docs/messaging-style-guide.md
@docs/output-catalog.md
@tests/lint-rules/lib/frontmatter.js
@tests/lint-rules/index.js
@extensions/pi-claude-marketplace/shared/notify.ts
@extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts
@extensions/pi-claude-marketplace/presentation/compact-line.ts
@extensions/pi-claude-marketplace/presentation/reload-hint.ts
@extensions/pi-claude-marketplace/persistence/migrate.ts

<interfaces>
<!-- Key templates the executor consumes verbatim. -->

From RESEARCH.md Pattern 1 (Custom ESLint rule template -- msg-sr-7-usage-error-routing.js, canonical):
- ESM imports: `import { ESLintUtils } from "@typescript-eslint/utils";`
- `const createRule = ESLintUtils.RuleCreator(...);`
- Default export: `createRule({ name, meta: { type: "problem", docs, messages: { <messageId>: "MSG-X-N: <message text with rule ID embedded>" }, schema: [] }, defaultOptions: [], create(context) { return { <ESTree node>: (node) => { /* detect; if violation, context.report({ node, messageId }); */ } }; } });`
- The `messageId` text is the user-visible failure message; per SC #2 it MUST contain the MSG-* rule ID literal (e.g., "MSG-SR-7: ...").

From RESEARCH.md Pattern 5 (RuleTester full-impl template -- has both `valid:` and `invalid:`):
- 4-line node:test shim (same as Plan 04).
- `ruleTester.run("<name>", rule, { valid: [...], invalid: [{ code: <planted violation source>, errors: [{ messageId: "<messageId from rule>" }] }] });`
- The `invalid:` case's `code` field is the planted violation -- assert the AST visitor produces a report with the expected messageId.

From RESEARCH.md Pattern 6 (Registry parity test template -- full code in research file):
- ESM TypeScript test (`.ts`) under `tests/architecture/`.
- Imports `RULE_NAMES` from `../../tests/lint-rules/index.js` (the plugin entry).
- Reads `docs/messaging-style-guide.md` via `node:fs/promises::readFile`.
- Extracts MSG-* IDs via `/MSG-[A-Z]+-[0-9]+/g`; dedupes; expects 34 unique IDs.
- 4 assertions: (a) every style-guide MSG-* ID has a rule file (slug-prefix match in RULE_NAMES); (b) every rule name has a style-guide anchor; (c) every rule name is registered in eslint.config.js (text-grep for `"msg/<name>":`) -- GATED behind a Plan 06 detection check; (d) total count is 34 on both sides.

From extensions/pi-claude-marketplace/shared/notify.ts:
- 4 wrappers: notifySuccess, notifyWarning, notifyError, notifyUsageError (lines 48-97 -- already verified)
- MSG-SR-1..7 rules detect callsite routing patterns: e.g., MSG-SR-7 detects `notifyError(ctx, msg)` where `msg` references `USAGE` (template literal or binary `+` operator with USAGE on either side).

From extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts:
- `STATUS_TOKENS_FRONTMATTER` (loaded via tests/lint-rules/lib/frontmatter.js) classifies tokens into success/info/warning at rule-author time. **MSG-SR-1..3 rules read the frontmatter loader to extract the closed-set tokens; the success/info/warning classification is hard-coded in those rules per the style-guide §10 normative text** (executor authors the rule against a fixed classification list -- see Task 1 prose for the pinned classifications).

From extensions/pi-claude-marketplace/presentation/compact-line.ts (the renderer):
- File-private icon constants at lines 62-64; the icon dispatch function is the single emission point.
- MSG-MR-1..2 / MSG-NC-1 / MSG-RH-1 detect literal text patterns OUTSIDE the canonical composer files; rules use ESLint `ignores:` arrays in Plan 06 to exclude the composer files themselves.

From RESEARCH.md Pattern 4 (eslint.config.js block -- for context only; this plan does NOT modify eslint.config.js):
- Plan 06 adds per-rule `files:` blocks with appropriate `ignores:` for composer files.
- Registry test assertion (c) text-greps `"msg/<name>":` literal in eslint.config.js. **Per D-14-03 "every wave green" invariant**, this plan MUST NOT commit a state where `npm run check` fails. Assertion (c) is therefore GATED behind a Plan-06-detection check (Task 3 below).

PER D-14-03 SEQUENCING (LOCKED): the milestone gate is `npm run check` green at every wave. Wave 3's ordering inside this plan: 04 + 05 + 06 land sequentially with green commits. The registry test in this plan keeps assertion (c) pending (skipped / todo'd) until Plan 06's eslint.config.js wiring lands; Plan 06 Task 2 removes the gate by adding the 34 `"msg/<name>":` registrations + the corresponding acceptance criterion that asserts the registry test now passes all 4 assertions.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author 18 full-impl rule files with real AST visitors</name>
  <files>
    tests/lint-rules/msg-sr-{1,2,3,4,5,6,7}-*.js,
    tests/lint-rules/msg-mr-{1,2}-*.js,
    tests/lint-rules/msg-rp-1-rollback-partial.js,
    tests/lint-rules/msg-cc-1-cause-chain.js,
    tests/lint-rules/msg-nc-{1,2}-*.js,
    tests/lint-rules/msg-rh-1-reload-hint.js,
    tests/lint-rules/msg-lc-{1,2}-*.js,
    tests/lint-rules/msg-sd-{1,2}-*.js
  </files>
  <read_first>
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 1 (canonical full-impl rule template -- msg-sr-7-usage-error-routing.js is the worked example with `sourceReferencesUsage` recursive helper for BinaryExpression + TemplateLiteral)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 2 §"Which MSG-* IDs are full-impl?" (per-rule detection target -- LOCKED 18-entry set)
    - docs/messaging-style-guide.md (relevant §section per rule -- used in `meta.docs.description` and `messages.<id>` text)
    - docs/messaging-style-guide.md §10 (MSG-SR-1..7 routing rules; cross-reference the STATUS_TOKENS frontmatter classification of success/info/warning tokens to pin the rule's detection sets)
    - extensions/pi-claude-marketplace/shared/notify.ts (the four wrappers -- the surface MSG-SR-1..7 rules visit)
    - extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts (the closed-set status_tokens used by MSG-SR-1..3 detection)
    - extensions/pi-claude-marketplace/persistence/migrate.ts (the single sanctioned console.warn callsite -- MSG-LC-1/MSG-LC-2 rules narrow to this file via `files:` + `ignores:` in Plan 06)
    - extensions/pi-claude-marketplace/presentation/reload-hint.ts (the canonical reload-hint composer -- MSG-RH-1 detects literal `Run /reload` patterns OUTSIDE this file)
    - extensions/pi-claude-marketplace/presentation/manual-recovery.ts, rollback-partial.ts, cause-chain.ts (the canonical composer files; the rules detect their characteristic literals OUTSIDE these files via Plan 06's `ignores:` lists)
    - tests/lint-rules/lib/frontmatter.js (Plan 03 -- consumed by MSG-SR-1..3 rules for the closed-set status_tokens; the rule files import `STATUS_TOKENS_FRONTMATTER` at module-load time)
  </read_first>
  <action>
    Create exactly 18 `.js` rule files under `tests/lint-rules/` -- one per MSG-* ID in the full-impl set. **MSG-ER-1 is NOT in this plan; that file lives in Plan 04 (meta-assertion).** Each follows RESEARCH.md Pattern 1 with a real AST visitor that detects the specific code pattern the rule's style-guide §section forbids.

    **Token classification for MSG-SR-1..3 (pinned by RESEARCH.md Pattern 2 §10 + status-tokens.ts):**

    Status-tokens are classified by severity per the style guide §10 normative text. The MSG-SR-1..3 rules import `STATUS_TOKENS_FRONTMATTER` from `tests/lint-rules/lib/frontmatter.js` to enumerate the closed set, and apply this hard-coded classification (verify against docs/messaging-style-guide.md §10 + status-tokens.ts at rule-authoring time; pin the classification in a const inside each rule file -- do not let the executor reclassify):
    - **SUCCESS-class tokens (MSG-SR-1):** `(installed)`, `(reinstalled)`, `(updated)`, `(uninstalled)`, `(enabled)`, `(disabled)`, `(added)`, `(removed)`, `(autoupdate enabled)`, `(autoupdate disabled)` -- emissions carrying these tokens MUST route through `notifySuccess`, NEVER through `notifyError` / `notifyWarning`.
    - **INFO-class tokens (MSG-SR-2):** `(skipped)`, `(unchanged)`, `(no marketplaces)`, `(no plugins)` -- informational outcomes route through `notifyInfo` (or `notifySuccess` per style-guide §10 normative text -- confirm against the guide; pin to the guide's normative wrapper at authoring time).
    - **WARNING-class tokens (MSG-SR-3):** `(failed)`, `(partial)`, `(manual recovery)`, `(rollback partial)` -- error/warning outcomes MUST NOT route through `notifySuccess` / `notifyInfo`.

    The executor verifies these against `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` (the 15-entry `STATUS_TOKENS` literal-union) and `docs/messaging-style-guide.md` §10 at authoring time. If the style guide diverges from the classification above, the style guide's §10 text wins -- pin the classification accordingly.

    **Per-rule detection targets and AST patterns:**

    **MSG-SR-1 (msg-sr-1-success-routing.js)** -- Style guide §10. AST pattern: `CallExpression[callee.name=/^notify(Error|Warning|Info)$/]` where the first string-literal arg (or a TemplateLiteral whose quasis contain a literal) includes any SUCCESS-class token from the pinned list. Report messageId `useNotifySuccess` with message `"MSG-SR-1: success-class status token (<token>) routed through wrong wrapper; use notifySuccess."`.

    **MSG-SR-2 (msg-sr-2-warning-routing.js)** -- Symmetrical. AST pattern: `CallExpression[callee.name=/^notify(Success|Error)$/]` where the first string-literal arg includes any INFO-class token. Report messageId `useNotifyInfoOrSuccess` (confirm correct wrapper name per style-guide §10) with message `"MSG-SR-2: info-class status token (<token>) routed through wrong wrapper; use notifyInfo (or notifySuccess per §10)."`.

    **MSG-SR-3 (msg-sr-3-error-routing.js)** -- AST pattern: `CallExpression[callee.name=/^notify(Success|Info)$/]` where the first string-literal arg includes any WARNING-class token. Report messageId `useNotifyWarningOrError` with message `"MSG-SR-3: warning-class status token (<token>) routed through wrong wrapper; use notifyWarning or notifyError."`.

    **MSG-SR-4..6 (cascade-success / cascade-warning / no-cascade-error)** -- Detect cascade-summary emissions through the wrong wrapper. The cascade composer (`presentation/cascade-summary.ts`) returns a string + severity tag; orchestrators dispatch via `notifySuccess` (when severity=success) or `notifyWarning` (when severity=warning), NEVER `notifyError` (per MSG-SR-6). Detection: visit `CallExpression` of `notifyError` whose first arg is a TemplateLiteral / string that contains text identifying a cascade body (e.g., presence of `\n\n` joiner + multiple `(status)` tokens). MSG-SR-6 is the canonical "never notifyError for cascades" rule with the simplest detector: any `notifyError(ctx, msg)` where `msg` references a `cascadeSummary` identifier or a function call to `composeCascadeSummary` / `cascadeSummary`.

    **MSG-SR-7 (msg-sr-7-usage-error-routing.js)** -- VERBATIM from RESEARCH.md Pattern 1. Visit `CallExpression` whose callee is `notifyError` and check whether the message argument (BinaryExpression / TemplateLiteral) references `USAGE`. Report with messageId `useNotifyUsageError` and message text including "MSG-SR-7:". The `sourceReferencesUsage` recursive helper handles Identifier / TemplateLiteral / BinaryExpression node shapes.

    **MSG-MR-1 (msg-mr-1-manual-recovery-anchor.js)** -- Style guide §7: manual-recovery anchor is a separate top-level compact line. Detect any string literal in the codebase containing `MANUAL RECOVERY REQUIRED:` (the legacy prefix). Visit `Literal` and `TemplateLiteral` nodes; check the value/quasi for the legacy prefix. Report messageId `legacyManualRecoveryPrefix` with text `"MSG-MR-1: legacy MANUAL RECOVERY REQUIRED prefix detected; emit a ManualRecoveryLine via renderManualRecovery instead."`. The canonical composer `presentation/manual-recovery.ts` is excluded via Plan 06's `ignores:`.

    **MSG-MR-2 (msg-mr-2-manual-recovery-system.js)** -- Style guide §7: system-level manual-recovery (e.g., agent index, state.json) goes in the name slot -- no `@<marketplace>` or `[<scope>]`. The ManualRecoveryLine interface (compact-line.ts:212-217) has no marketplace/scope fields, so the TYPE system already enforces the schema. Defensive AST check: detect `ObjectExpression` literals with property `kind: "manual-recovery"` (system-level form) where `resource` is a TemplateLiteral containing `@` or `[`. Report messageId `manualRecoverySystemHasMarketplace` with text `"MSG-MR-2: system-level manual-recovery line MUST NOT include @<marketplace> or [<scope>] in resource slot."`. The rule's value is the defensive-against-AST-construction-paths backstop; if no AST literal construction is found in scope, the rule's planted-violation test (Task 2) is the proof the AST visitor works.

    **MSG-RP-1 (msg-rp-1-rollback-partial.js)** -- Style guide §8: rollback-partial uses the `(failed) {rollback partial}` parent + indented children form via `presentation/rollback-partial.ts`. Detect any string literal containing the substring `(failed) {rollback partial}` outside `presentation/rollback-partial.ts`. Visit `Literal` (raw string value) and `TemplateLiteral` (joined quasis); flag matches. Report messageId `handComposedRollbackPartial` with text `"MSG-RP-1: hand-composed (failed) {rollback partial} body detected; route through renderRollbackPartial composer."`. After Plan 06's transaction/rollback.ts refactor, this rule fires only on planted-violation tests.

    **MSG-CC-1 (msg-cc-1-cause-chain.js)** -- Style guide §9: cause-chain trailer renders as `cause: <link1> -> <link2> -> ...` via `presentation/cause-chain.ts` and `shared/errors.ts::causeChainTrailer`. Detect manual `Cause:` / `cause:` string composition outside those canonical files. Visit `Literal` and `TemplateLiteral`; flag any literal matching `/\bcause:\s/i` (case-insensitive). Report messageId `handComposedCauseChain` with text `"MSG-CC-1: hand-composed cause-chain literal detected; route through causeChainTrailer."`.

    **MSG-NC-1 (msg-nc-1-entity-error.js)** -- Style guide §12: entity-shaped non-cascade errors render via the renderer (`RowSpec` `EntityErrorRow` variant) not via hand-composed strings. Detect hand-composed compact-line patterns: visit `Literal` / `TemplateLiteral`; flag any text matching `/(?:⊘|⊕|✓)\s+\S+@/` (icon + entity + `@`) outside `presentation/compact-line.ts`. Report messageId `handComposedEntityError`.

    **MSG-NC-2 (msg-nc-2-usage-separator.js)** -- Style guide §12: blank-line separator between message and USAGE block is `\n\n`. Detect `notifyError(ctx, msg + "\n" + USAGE)` -- overlaps MSG-SR-7. Independent detection: visit `CallExpression` of `notifyError` and check the message arg for a `BinaryExpression` where one operand is a string literal `"\n"` (single newline) or a TemplateLiteral quasi containing `\n` followed by an identifier `USAGE`. Report messageId `missingBlankLineSeparator`. The two rules can produce overlapping reports; Plan 06's `files:` scopes them to the same surface so the overlap is acceptable.

    **MSG-RH-1 (msg-rh-1-reload-hint.js)** -- Style guide §5: reload-hint trailer renders via `presentation/reload-hint.ts::reloadHint`. Detect literal `Run /reload` or `/reload to <verb>` strings in source outside `presentation/reload-hint.ts`. Visit `Literal` / `TemplateLiteral`; flag any text matching `/\/reload(?:\s+to\b)?/`. Report messageId `handComposedReloadHint`.

    **MSG-LC-1 (msg-lc-1-console-warn-form.js)** -- Style guide §14.1: the sanctioned `console.warn` at `persistence/migrate.ts:178` uses sentence-form wording (terminal period, no compact-grammar tokens). The rule's job is to detect any `console.warn` callsite (Plan 06's `files:` scope is narrowed to `persistence/migrate.ts` for this rule). Visit `CallExpression` whose callee is `MemberExpression` `console.warn`; if the file is migrate.ts AND the call is outside the inline eslint-disable region, report. For RuleTester purposes, the planted code is `console.warn("some warning");` and the rule fires on it. Report messageId `extraConsoleWarn`.

    **MSG-LC-2 (msg-lc-2-eslint-discipline.js)** -- Style guide §14.1: the single sanctioned `eslint-disable-next-line` comment for `no-restricted-syntax, no-console` lives at `persistence/migrate.ts:178`. Detect any OTHER `eslint-disable*` comment in the codebase that mentions `no-restricted-syntax` or `no-console`. Visit `Program` for the comment array; visit comments via `sourceCode.getAllComments()`; flag matches outside the single sanctioned line. Report messageId `extraEslintDisable`.

    **MSG-SD-1 (msg-sd-1-soft-dep-reason.js)** -- Style guide §6: `{requires pi-subagents}` and `{requires pi-mcp}` reasons live in the closed REASONS set and are emitted via the renderer's per-row predicate. Detect hand-composed string literals matching `/\{requires pi-(?:subagents|mcp)\}/` outside `presentation/compact-line.ts::composeReasons`. Report messageId `handComposedSoftDepReason`.

    **MSG-SD-2 (msg-sd-2-soft-dep-predicate.js)** -- Style guide §6: soft-dep predicate emission is governed by `declaresAgents` / `declaresMcp` fields on the row spec. Detect hand-composed soft-dep emission patterns: visit `Literal` / `TemplateLiteral` for strings containing the literal predicate text outside the renderer. Report messageId `handComposedSoftDepPredicate`.

    **General per-rule requirements (uniform):**

    1. Each rule's `messages.<messageId>` text starts with the MSG-* ID literal (e.g., `"MSG-SR-7: ..."`) to satisfy SC #2.
    2. Each rule's `meta.docs.description` cites the style-guide §section and (when applicable) the canonical composer file.
    3. Use `ESLintUtils.RuleCreator` per RESEARCH.md Pattern 1.
    4. Avoid sharing AST visitor code across rules unless duplication exceeds ~10 lines; if shared, factor a small helper module under `tests/lint-rules/lib/ast-helpers.js`.

    NEVER place fenced code blocks in this action; RESEARCH.md Pattern 1 contains the canonical worked example (msg-sr-7).
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # File count must be exactly 18 (deviation is a planning failure):
      ls tests/lint-rules/msg-sr-*.js tests/lint-rules/msg-mr-*.js tests/lint-rules/msg-rp-*.js tests/lint-rules/msg-cc-*.js tests/lint-rules/msg-nc-*.js tests/lint-rules/msg-rh-*.js tests/lint-rules/msg-lc-*.js tests/lint-rules/msg-sd-1*.js tests/lint-rules/msg-sd-2*.js 2>/dev/null | grep -v '.test.js' | wc -l
      # Expect: 18
      # MSG-ER-1 is NOT created here (Plan 04 owns it):
      # No new file matching msg-er-* in THIS plan's file list:
      ls tests/lint-rules/msg-er-*.js 2>/dev/null | grep -v '.test.js' | wc -l
      # Expect: 1 (the file from Plan 04 already exists; this plan adds none)
      # Each has a messageId containing the MSG-* ID literal:
      grep -l 'MSG-SR-' tests/lint-rules/msg-sr-*.js | grep -v '.test.js' | wc -l
      # Expect: 7
      # Real AST visitor (not just `Program: () => {}`):
      grep -lE 'CallExpression|Literal|TemplateLiteral|BinaryExpression' tests/lint-rules/msg-sr-*.js tests/lint-rules/msg-mr-*.js tests/lint-rules/msg-rp-*.js tests/lint-rules/msg-cc-*.js tests/lint-rules/msg-nc-*.js tests/lint-rules/msg-rh-*.js tests/lint-rules/msg-lc-*.js tests/lint-rules/msg-sd-1*.js tests/lint-rules/msg-sd-2*.js 2>/dev/null | grep -v '.test.js' | wc -l
      # Expect: 18 (every full-impl rule has at least one real visitor)
      # ESLint still green (rules exist but unregistered):
      npm run lint 2>&1 | tail -3
    </automated>
  </verify>
  <done>
    1. Exactly 18 full-impl rule files exist under `tests/lint-rules/` matching the locked family/number split.
    2. Each rule's `messages.<messageId>` text contains the MSG-* ID literal (e.g., "MSG-SR-7:") per SC #2.
    3. Each rule's `create()` returns a real ESTree visitor (`CallExpression`, `Literal`, `TemplateLiteral`, `BinaryExpression`, or `Program`-with-source-code-walk) -- not a bare no-op.
    4. MSG-ER-1 is NOT in this plan (Plan 04 owns it).
    5. `npm run lint` green (rules exist as JS source but are not yet registered in eslint.config.js -- that's Plan 06).
  </done>
</task>

<task type="auto">
  <name>Task 2: Author 18 RuleTester companions with planted-violation `invalid:` cases</name>
  <files>
    tests/lint-rules/msg-sr-{1,2,3,4,5,6,7}-*.test.js,
    tests/lint-rules/msg-mr-{1,2}-*.test.js,
    tests/lint-rules/msg-rp-1-rollback-partial.test.js,
    tests/lint-rules/msg-cc-1-cause-chain.test.js,
    tests/lint-rules/msg-nc-{1,2}-*.test.js,
    tests/lint-rules/msg-rh-1-reload-hint.test.js,
    tests/lint-rules/msg-lc-{1,2}-*.test.js,
    tests/lint-rules/msg-sd-{1,2}-*.test.js
  </files>
  <read_first>
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 5 (RuleTester full-impl template with the canonical msg-sr-7 `invalid:` example covering two planted violation shapes)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 1 (the 4-line node:test shim)
    - tests/lint-rules/msg-sr-7-usage-error-routing.js (from Task 1 -- the rule under test for the canonical worked example)
  </read_first>
  <action>
    For each of the 18 full-impl rules from Task 1, create a sibling `*.test.js` file with the 4-line node:test shim + `valid:` cases + `invalid:` planted-violation cases.

    Per-test structure (verbatim from RESEARCH.md Pattern 5):
    1. 4-line node:test shim (REQUIRED -- Pitfall 1).
    2. `new RuleTester()` then `ruleTester.run("<rule-name>", rule, { valid: [...], invalid: [...] })`.
    3. `valid:` cases: ≥1 example showing code that does NOT violate the rule. Conservative: include the canonical correct usage (e.g., for msg-sr-7, `notifyUsageError(ctx, msg, USAGE)` is canonical valid).
    4. `invalid:` cases: ≥1 (preferably ≥2) per rule -- the planted violation cases. Each case has:
       - `code:` the planted source.
       - `errors:` an array of `{ messageId: "<exact messageId from rule's meta.messages>" }`.

    **Per-rule planted violations (canonical):**

    - **msg-sr-1**: invalid case plants `notifyWarning(ctx, "(installed) ...")` (SUCCESS-class token routed through warning wrapper). Expected messageId from Task 1: `useNotifySuccess`.
    - **msg-sr-2**: invalid case plants `notifyError(ctx, "(skipped) ...")` (INFO-class token routed through error wrapper). Expected messageId: `useNotifyInfoOrSuccess`.
    - **msg-sr-3**: invalid case plants `notifySuccess(ctx, "(failed) ...")` (WARNING-class token routed through success wrapper). Expected messageId: `useNotifyWarningOrError`.
    - **msg-sr-4..6**: cascade-style messages routed through the wrong wrapper. e.g. `notifyError(ctx, composeCascadeSummary(...))`.
    - **msg-sr-7**: per RESEARCH.md Pattern 5 -- 2 invalid cases (BinaryExpression `msg + "\n" + USAGE`; TemplateLiteral `\`${msg}\\n${USAGE}\``). Both expect messageId `useNotifyUsageError`.
    - **msg-mr-1**: plant a string literal `const msg = "MANUAL RECOVERY REQUIRED: /path/to/file";` -- expect messageId `legacyManualRecoveryPrefix`.
    - **msg-mr-2**: plant a `ManualRecoveryLine` literal where `resource` contains `@`: `const line = { kind: "manual-recovery", resource: "name@mp", reasons: [] };` -- expect messageId `manualRecoverySystemHasMarketplace`.
    - **msg-rp-1**: plant `const body = "(failed) {rollback partial}";` -- expect messageId `handComposedRollbackPartial`.
    - **msg-cc-1**: plant `const trailer = "cause: " + err.message;` -- expect messageId `handComposedCauseChain`.
    - **msg-nc-1**: plant `const line = "⊘ name@mp [scope] (failed) {not found}";` -- expect messageId `handComposedEntityError`.
    - **msg-nc-2**: plant `notifyError(ctx, msg + "\n" + USAGE);` -- expect messageId `missingBlankLineSeparator`. May share the planted `code` shape with msg-sr-7 but with msg-nc-2's messageId.
    - **msg-rh-1**: plant `const trailer = "Run /reload to refresh extensions";` -- expect messageId `handComposedReloadHint`.
    - **msg-lc-1**: plant `console.warn("some warning");` -- expect messageId `extraConsoleWarn` (the rule scoped via `files:` to migrate.ts in Plan 06; RuleTester's planted code IS the violation regardless of file path).
    - **msg-lc-2**: plant `// eslint-disable-next-line no-restricted-syntax` outside the sanctioned callsite -- expect messageId `extraEslintDisable`.
    - **msg-sd-1**: plant `const r = "{requires pi-subagents}";` -- expect messageId `handComposedSoftDepReason`.
    - **msg-sd-2**: plant a similar predicate-side hand-composed literal; expect messageId `handComposedSoftDepPredicate`.

    Each test asserts the messageId byte-exactly (SC #2 enforcement). The `errors:` array can also include `line` / `column` if precision is desired (not required for SC #2 -- messageId alone suffices).

    All test files MUST include the 4-line shim. Tests under `tests/lint-rules/**/*.test.js` are picked up by the extended `package.json:test` glob from Plan 03.

    NEVER place fenced code blocks; RESEARCH.md Pattern 5 contains the canonical worked example.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # 1:1 pairing rule ↔ test for full-impl rules (count must be 18 each):
      RULE_COUNT=$(ls tests/lint-rules/msg-sr-*.js tests/lint-rules/msg-mr-*.js tests/lint-rules/msg-rp-*.js tests/lint-rules/msg-cc-*.js tests/lint-rules/msg-nc-*.js tests/lint-rules/msg-rh-*.js tests/lint-rules/msg-lc-*.js tests/lint-rules/msg-sd-1*.js tests/lint-rules/msg-sd-2*.js 2>/dev/null | grep -v '.test.js' | wc -l)
      TEST_COUNT=$(ls tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js 2>/dev/null | wc -l)
      echo "rules: $RULE_COUNT; tests: $TEST_COUNT"
      # Expect: rules: 18; tests: 18
      # Every test has the node:test shim and ≥1 invalid case:
      grep -c 'RuleTester.afterAll = test.after' tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js
      # All non-zero
      grep -c 'invalid:' tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js
      # All non-zero
      # Run all the full-impl tests:
      node --test tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js 2>&1 | tail -15
      # Expect: all pass; invalid case planted source produces the expected messageId
    </automated>
  </verify>
  <done>
    1. Each of the 18 full-impl rules has a sibling `*.test.js` (test count: 18).
    2. Each test file has the 4-line node:test shim and ≥1 `invalid:` case with a `messageId` assertion containing the MSG-* ID literal.
    3. All full-impl RuleTester tests pass under `node --test`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Populate index.js with full-impl rules + author msg-rule-registry.test.ts with assertion (c) GATED behind Plan 06 detection</name>
  <files>tests/lint-rules/index.js, tests/architecture/msg-rule-registry.test.ts</files>
  <read_first>
    - tests/lint-rules/index.js (after Plan 04 -- 16 meta-assertion rules registered; this plan adds the remaining 18 to reach 34 total)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pattern 6 (registry parity test -- full code template)
    - .planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md D-14-12 (LOCKED body-scan + 34-rule count assertion)
    - .planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md D-14-03 (LOCKED "every wave green" invariant -- this constrains assertion (c) to be GATED, not active-and-failing)
    - tests/lint-rules/lib/frontmatter.js (consumed indirectly -- the registry test scans docs/messaging-style-guide.md directly via readFile, not via the loader; but the loader's existence is a sibling pattern for context)
    - docs/messaging-style-guide.md (the body that the registry test scans for `/MSG-[A-Z]+-[0-9]+/g`)
  </read_first>
  <action>
    Two operations in this task:

    **A. Extend `tests/lint-rules/index.js`** to import + register the 18 full-impl rule modules from Task 1:
    1. Add ESM named imports at the top -- one per full-impl rule file (18 imports).
    2. Append to `RULE_NAMES`: extend the existing 16-entry meta-assertion list (from Plan 04) with the 18 full-impl names. Final array length: 34. Order: family-then-numeric, with meta-assertion rules first (GR, IC, SD-3, PL, ER) then full-impl rules (SR, MR, RP, CC, NC, RH, LC, SD-1, SD-2).
    3. Append to `default.rules` dict: each full-impl rule's name → its imported default.
    4. Re-freeze `RULE_NAMES` so the new list is immutable.

    Final shape: `RULE_NAMES.length === 34`, `Object.keys(default.rules).length === 34`. The plugin is now complete; Plan 06 wires the per-rule `files:` patterns in eslint.config.js to make the rules actually run during `npm run lint`.

    **B. Create `tests/architecture/msg-rule-registry.test.ts`** per RESEARCH.md Pattern 6 with assertion (c) GATED behind a Plan-06-detection check (Option B; Option A is forbidden by D-14-03 + NFR-6):

    1. ESM TypeScript test (`.ts` so it joins the existing `tests/architecture/*.test.ts` family + runs under the original `package.json:test` glob without needing the lint-rules glob extension).
    2. Imports `RULE_NAMES` from `../../tests/lint-rules/index.js`. (NOTE: `.ts` test importing from `.js` plugin module -- this works under ESM because `.js` files are first-class modules; verify the import resolution by running the test once after authoring.)
    3. Reads `docs/messaging-style-guide.md` and `eslint.config.js` via `node:fs/promises::readFile` at top of describe block.
    4. Extracts MSG-* IDs from the markdown body via `/MSG-[A-Z]+-[0-9]+/g`; dedupe; sort.

    5. **Four assertions:**

       **(a) Style-guide MSG-* IDs ↔ rule files**: every MSG-* ID found in the style-guide body has a corresponding rule file name (slug-prefix match in `RULE_NAMES`). Assert: for every styleGuideId, there exists a name in RULE_NAMES such that `name.startsWith(styleGuideId.toLowerCase() + "-")`. **ACTIVE** at the Plan 05 commit.

       **(b) Rule files ↔ style-guide anchors**: every rule name in `RULE_NAMES` has a corresponding style-guide MSG-* anchor. Assert: for every name in RULE_NAMES, the MSG-* prefix (e.g., `MSG-GR-1` extracted from `msg-gr-1-line-grammar` via regex `/^msg-([a-z]+)-([0-9]+)-/`) appears in styleGuideIds. **ACTIVE** at the Plan 05 commit.

       **(c) Rule files ↔ eslint.config.js registration**: every rule name in `RULE_NAMES` is registered in `eslint.config.js` via the literal `"msg/<name>":`. **GATED** behind a Plan-06-detection check. Implementation:
       - Read eslint.config.js text once at test setup.
       - Detect Plan 06 wiring by checking for the presence of the `msg/` plugin namespace literal in the config text. Specifically: if `eslintConfigText.includes('"msg/msg-')` evaluates to false, Plan 06 has not yet landed -- the assertion is gated.
       - When gated: use `t.todo("pending: enabled by Plan 06 wiring (eslint.config.js must register 34 'msg/...' rule entries)")` so the test is REPORTED but not FAILING.
       - When Plan 06 has landed (the gate flips to active): assert that for every `name` in `RULE_NAMES`, the substring `"msg/${name}":` appears in `eslintConfigText`. Run this loop only when the gate is active.
       - Plan 06 Task 2 acceptance criterion (added by the revision per blocker BLOCKER-3) asserts the gate is open and all 4 assertions are active at the Plan 06 commit.

       **(d) Count parity**: assert `RULE_NAMES.length === 34` AND the deduplicated styleGuideIds count `=== 34`. **ACTIVE** at the Plan 05 commit.

    6. Tests use the `node:test` + `node:assert/strict` style matching the existing `tests/architecture/*.test.ts` family. Use `test.todo("...")` (or `t.todo(...)` inside a `test(...)` callback) for the gated assertion (c) per Node 22's stable test-runner API.

    7. Top-of-file JSDoc cites: D-14-12 (LOCKED body-scan + 34-rule count), D-14-03 (LOCKED "every wave green" invariant that drives the assertion-(c) gate), Plan 06 dependency (the gate flips when Plan 06's `import msgPlugin` + 34 `"msg/<name>":` registrations land in eslint.config.js).

    NEVER place fenced code blocks; RESEARCH.md Pattern 6 contains the canonical worked example.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # index.js complete (34 rules):
      node -e "import('./tests/lint-rules/index.js').then(m => { console.log('RULE_NAMES count:', m.RULE_NAMES.length); console.log('rules keys count:', Object.keys(m.default.rules).length); });"
      # Expect: 34, 34
      # Registry test exists:
      ls -la tests/architecture/msg-rule-registry.test.ts
      # Run the registry test:
      node --test tests/architecture/msg-rule-registry.test.ts 2>&1 | tail -15
      # Expect: assertions (a), (b), (d) PASS; assertion (c) reported as TODO/pending (NOT failing). Overall test exit code: 0.
      # Assertion count present in file:
      grep -cE 'test\(|t\.todo\(' tests/architecture/msg-rule-registry.test.ts
      # Expect: ≥4 (4 assertions, with (c) using t.todo when gated)
      # Verify the gate detection logic exists:
      grep -c 'msg/msg-' tests/architecture/msg-rule-registry.test.ts
      # Expect: ≥1 (the gate-detection literal)
      # All Plan 05 individual rule tests pass:
      node --test tests/lint-rules/msg-sr-*.test.js tests/lint-rules/msg-mr-*.test.js tests/lint-rules/msg-rp-*.test.js tests/lint-rules/msg-cc-*.test.js tests/lint-rules/msg-nc-*.test.js tests/lint-rules/msg-rh-*.test.js tests/lint-rules/msg-lc-*.test.js tests/lint-rules/msg-sd-1*.test.js tests/lint-rules/msg-sd-2*.test.js 2>&1 | tail -10
      # Expect: all pass
      # Plan 05 milestone gate -- MUST be green per D-14-03:
      npm run check 2>&1 | tail -10
      # Expect: SUCCESS
    </automated>
  </verify>
  <done>
    1. `tests/lint-rules/index.js` now imports + registers all 34 rules (16 meta from Plan 04 + 18 full-impl); `RULE_NAMES.length === 34`.
    2. `tests/architecture/msg-rule-registry.test.ts` exists with 4 assertions per D-14-12: (a) every style-guide MSG-* has a rule file -- ACTIVE; (b) every rule name has a style-guide anchor -- ACTIVE; (c) every rule name is registered in eslint.config.js -- GATED via t.todo() pending Plan 06 wiring; (d) count is 34 -- ACTIVE.
    3. All 18 full-impl RuleTester tests pass.
    4. `npm run check` is GREEN at the Plan 05 commit (no sanctioned RED commit per D-14-03 + NFR-6).
    5. Plan 06 Task 2 inherits the contract: removing the gate (assertion (c) becomes active) and asserting all 4 pass once 34 `"msg/<name>":` registrations are present in eslint.config.js.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ESLint AST visitor input (project source code) | Input is the project's own committed source code; no untrusted-input attack surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14-07 | Tampering | RuleTester planted-violation `invalid:` cases | mitigate | Each invalid case asserts the messageId byte-exactly; the rule's messages dict embeds the MSG-* ID literal -- a typo in either side fails the RuleTester test (caught at Plan 05 verify). |
| T-14-08 | Repudiation | msg-rule-registry.test.ts text-grep on eslint.config.js | accept | Text-grep is brittle to format reflow; mitigated by keeping rule registrations in stable double-quoted form per RESEARCH.md Pattern 6 recommendation. If Prettier reflows registrations, registry test fails and prompts re-grep adjustment. |
</threat_model>

<verification>
- Exactly 18 full-impl rule files exist; each has a real AST visitor; each has a messageId containing the MSG-* ID literal.
- Exactly 18 RuleTester companions exist; each has the node:test shim + ≥1 invalid case with byte-exact messageId assertion.
- `tests/lint-rules/index.js` registers all 34 rules (16 + 18).
- `tests/architecture/msg-rule-registry.test.ts` exists with 4 assertions; assertion (c) is GATED via t.todo() pending Plan 06.
- `node --test tests/lint-rules/msg-*.test.js` passes for all full-impl rules.
- `npm run check` is GREEN at the Plan 05 commit (D-14-03 "every wave green" invariant respected).
</verification>

<success_criteria>
1. Final 18 MSG-* drift-guard rules ship with real AST coverage per D-14-09.
2. Every MSG-* rule's failure carries the MSG-* ID literal in its message -- SC #2 satisfied across all 34 rules.
3. Registry parity test exists with assertion (c) gated until Plan 06; ties style-guide body ↔ rule files ↔ plugin module ↔ (pending) eslint.config.js wiring (D-14-12).
4. Per-rule planted-violation RuleTester tests pass -- SC #1 ("intentional planted violation makes `npm run check` fail with clear, locatable error") satisfied structurally for every rule.
5. Plugin module is complete; Plan 06 owns the eslint.config.js per-rule `files:` wiring + WARNING-level closures + flipping the assertion (c) gate.
6. `npm run check` GREEN at the Plan 05 commit (D-14-03 + NFR-6).
</success_criteria>

<output>
Create `.planning/phases/14-drift-guard-test-alignment/14-05-SUMMARY.md` when done.
</output>
</content>
</invoke>
