---
phase: 08-integration-suite-rescope
reviewed: 2026-11-23T05:58:01Z
depth: standard
iteration: 3
files_reviewed: 35
files_reviewed_list:
  - .agents/skills/cucumber/SKILL.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - .agents/skills/typescript-unit-tests/SKILL.md
  - .planning/codebase/TESTING.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - features/mcp-server/project-scope.feature
  - test/bridges/mcp/builtin-entry.test.ts
  - test/bridges/mcp/expansion-cases.ts
  - test/integration/adapter-expansion-conformance.test.ts
  - test/integration/adapter-tool-name-conformance.test.ts
  - test/integration/agents-adapter-grant-conformance.test.ts
  - test/integration/agents-builtin-grant-conformance.test.ts
  - test/integration/concurrent-install.test.ts
  - test/integration/hooks-result-boundary.test.ts
  - test/integration/load-reconcile-race.test.ts
  - test/integration/marketplace-add-seed-mirrors.test.ts
  - test/integration/marketplace-layer-remove.test.ts
  - test/integration/mcp-adapter-entry-conformance.test.ts
  - test/integration/mcp-builtin-encoding-conformance.test.ts
  - test/integration/mcp-server-records.test.ts
  - test/integration/mcp-status-conformance.test.ts
  - test/integration/mcp-verdict-migration.test.ts
  - test/integration/mcp-verdict-update.test.ts
  - test/integration/pi-subagents-child-launch-conformance.test.ts
  - test/integration/plugin-layer-verbs.test.ts
  - test/integration/provenance-invisibility.test.ts
  - test/integration/reconcile-plan-convergence.test.ts
  - test/integration/skill-path-resolution.test.ts
  - test/integration/standalone-prune.test.ts
  - test/integration/subagent-hook-ownership.test.ts
  - test/integration/transaction-lifecycle-cascade.test.ts
  - test/integration/workflow-engine-agent-registry.test.ts
  - test/integration/workflow-kind-inversion.test.ts
  - test/orchestrators/reconcile/plan.test.ts
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
  necessity: 0
status: issues_found
---

# Phase 8: Code Review Report (iteration 3)

**Reviewed:** 2026-11-23T05:58:01Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

This is the final re-review. The scope is every file changed since `17fca7a`, outside `.planning/phases/` and outside the Phase 6.1 files. `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` are planning files, so they are not in the review set. Since iteration 2 (`2f5a19b`), only the iteration-2 fix commits `79a6244..5dc96ce` changed files, so I looked for regressions in those diffs.

All nine iteration-2 findings are fixed:

- **WR-01.** `builtinRowInput(row)` (`test/bridges/mcp/expansion-cases.ts:59-65`) builds each title from the field, the raw value, and the session environment. The unit pair passed 47 of 47, and the spec reporter shows 22 `BLT-02: the <field> value ... is written as Claude Code's value ...` titles. The conformance file shows 30 `... comes out of Pi's resolver as Claude Code's value ...` titles. No title repeats in either run (`uniq -d` is empty). Each title names only the input and the value that the case asserts, so the P2-DC-03 `projectDir` row, the AVAR-02 row, and the deny-list rows no longer claim adapter behavior.
- **WR-02.** The header (`mcp-builtin-encoding-conformance.test.ts:11-15`) now names the three `VALID_SERVERS` configs and the refused url, and it says "No table row reaches the validator". That matches `:203-259`.
- **WR-03.** The title and the header bullet of the first-run race now claim only what the case asserts. See IN-02 for one leftover comment.
- **IN-01.** The new `@adapter-only` scenario at `features/mcp-server/project-scope.feature:200` follows the cucumber rules:
  - Its title names ASTAT-01, which licenses the tag. `node scripts/check-features.mjs` passes.
  - Every step is an existing step.
  - All `Given` steps come before the one `When`.
  - `the result has these fields:` lists every field of the result, the same 15 rows as its built-in twin `builtin-status.feature:191`.
  - The red proof is sound. `stampAdapterEntries` (`orchestrators/plugin/info-mcp-status.ts:156-170`) is the only code that writes `overridden by project scope` under the adapter. The adapter-report wait makes `answer !== "no-snapshot"` true, so an empty override set gives the snapshot's own `pending approval`, as the fix report says.
  - I ran it under the heavy lock: `npx cucumber-js --profile adapter features/mcp-server/project-scope.feature:200` passed (1 scenario, 15 steps).
  - The removed integration case and its helpers left no unused import. ESLint without a cache is clean.
  - See IN-01 for the case that stays in `mcp-status-conformance`.
- **IN-02, IN-03.** I took the charter bullets out of `cucumber/SKILL.md`, `typescript-unit-tests/SKILL.md`, and `TESTING.md` and compared them. All three have the same 10 bullets, word for word. `test/architecture/pi-tui-screen.test.ts` exists and imports `features/lib/pi-tui.ts`, as TESTING.md says. Every step and every writer function that `world-and-stand-ins.md:45` lists exists. Each sits in the step module the rule names:
  - `implementation-switch.steps.ts:37`
  - `legacy-move.steps.ts:101`, `:122`
  - `agent-grants.steps.ts:244`
  - `agent/listing.steps.ts:194`
  - `lifecycle.steps.ts:67`
  - the writer functions in `features/lib/{mcp-builtin-earlier-record,mcp-agent-earlier-index,agent-files,mcp-server-files}.ts`

  A grep for earlier-release step texts under `features/step_definitions` finds no writer that the list leaves out. See IN-03 for one sentence that the longer list makes untrue.
- **IN-04.** `docs/mcp-compatibility.md:826` cites `test/domain/claude-credential-denylist.test.ts`.
- **IN-05.** The `expansion-cases.ts` header and the `OPTION_FIELD_CASES` comment name the right test for each set of rows. The doc's 8-plus-6 option split matches the runs: 8 `D-PG10-12` conformance cases and 6 unit cases.
- **IN-06.** `PiResolvedField` and `isPiResolved` replace the secret names. No "secret" wording is left in the file's own text.

Focused runs:

- The three touched integration files passed 53 of 53 under `isolated-pi-home.mjs`.
- `eslint --no-cache --max-warnings 0` on the five touched TypeScript files exits 0.

I found no blocker and no warning. The four Info items below are text that claims slightly more than its code does. One of them is a case that the charter might send to the unit pair.

## Info

### IN-01: The ASTAT-02 case that stays in `mcp-status-conformance` runs no adapter code that the drift guard and the unit pair do not already cover

**File:** `test/integration/mcp-status-conformance.test.ts:4-8`, case at `:48-85`
**Issue:** The header says "Both cases need the adapter's own code". The ASTAT-02 case takes only two constants from the adapter, `MCP_STATUS_EVENT` and `MCP_STATUS_SNAPSHOT_VERSION`, and it builds both snapshots by hand (`:18-20` says so). The behavior it checks is in the unit pair: `test/platform/mcp-status.test.ts:185-199` ("ASTAT-02: the empty shutdown snapshot replaces an earlier valid snapshot") and `:43` (the tracker subscribes to the literal `pi-mcp-adapter/status/v1`). The drift guard at `:87-107` pins both adapter constants to those same literals. Iteration 2 used this reasoning to retire the old case 1. The one thing the case adds is Pi's real `createEventBus` in place of the unit test's capturing source. That is a run of Pi's code, but the header names the adapter, not Pi's bus.
**Fix:** Do one of these:
- If Pi's event bus is the reason to keep the case, say so in the header, for example: "ASTAT-02 runs the tracker on Pi's own `createEventBus` with the adapter's channel and version".
- Delete the case after a break shows `mcp-status.test.ts:188` failing, as the charter says.

### IN-02: A leftover comment in the first-run race still claims "no double-merge"

**File:** `test/integration/load-reconcile-race.test.ts:463-464`, `:471-474`
**Issue:** The comment reads "Exactly one marketplace entry (no double-merge)". `config.marketplaces` is a JSON object keyed by marketplace name, and the seeded state holds only `mp-legacy`. A double merge would write the same key again, so `Object.keys(...)` equals `["mp-legacy"]` in both cases. The assertion catches only an extra key, not a double merge. The next comment is wrapped oddly: "-- each process that wrote / the config wrote it from the in-memory state / record (...)". It is the reflow that 2b1d839 left.
**Fix:** Change the comment to "Exactly one marketplace entry, and no other key." Rewrap the next comment.

### IN-03: The writers that `world-and-stand-ins.md` now lists do not follow the sentence that opens the list

**File:** `.agents/skills/cucumber/rules/world-and-stand-ins.md:45`
**Issue:** The bullet starts: "Each writer cites its tag's schema lines in its doc comment, takes its root from the world's `scopeRoot`, and imports nothing from the product." Iteration 2 added six writers to the same bullet. Most of them do not meet that rule:
- `dropRecordedMcpServers` (`features/lib/mcp-builtin-earlier-record.ts:1-11`) and `stripAgentGrantForms` (`features/lib/mcp-agent-earlier-index.ts:1-5`) cite no tag or schema lines.
- The no-options writer has no doc comment. It is inline code in `legacy-move.steps.ts:101-112`.
- `replaceStagedAgentFile` (`features/lib/agent-files.ts:137-155`) takes `tokens`, not `scopeRoot`. It is a general file writer: only its step supplies the earlier text.
- `stripAgentGrantForms` takes a file path.

None of them imports from the product, so that part holds. A reader who adds a writer cannot tell which rule applies.
**Fix:** Limit the opening sentence to the writers it was written for. For example, start with "`rewriteStateAsRelease()` and `writeLegacyMcpConfig()` each cite their tag's schema lines ...". Or say that the six writers added later cite their decision ID, not a tag's schema lines.

### IN-04: The `env-builtin` titles use an internal field label

**File:** `test/bridges/mcp/expansion-cases.ts:64` (consumed at `test/integration/mcp-builtin-encoding-conformance.test.ts:148`)
**Issue:** `builtinRowInput` puts `row.field` into the title, so one case reads `BLT-02: the env-builtin value "${PI_CM_FOO}" with ... comes out of Pi's resolver ...`. `env-builtin` is the table's name for the injected `CLAUDE_PLUGIN_ROOT` key (`FIELD_SHAPES` at `:97-100`), not a field a reader knows. The title is true, but a reader cannot tell which value it means.
**Fix:** Map the label in `builtinRowInput`, for example `row.field === "env-builtin" ? "env CLAUDE_PLUGIN_ROOT" : row.field`. Or add a short label for each field to `ExpansionField`.

---

_Reviewed: 2026-11-23T05:58:01Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
