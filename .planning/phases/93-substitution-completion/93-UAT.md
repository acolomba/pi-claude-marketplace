---
status: complete
phase: 93-substitution-completion
source: [93-01-SUMMARY.md, 93-02-SUMMARY.md]
started: 2026-08-05T01:33:54Z
updated: 2026-08-05T02:19:38Z
---

## Current Test

[testing complete]

## Tests

### 1. Skill ${CLAUDE_SKILL_DIR} substitution (SUB-01)
expected: Installing a plugin whose skill SKILL.md references ${CLAUDE_SKILL_DIR} materializes the installed skill file with every ${CLAUDE_SKILL_DIR} token replaced by the absolute path of that skill's own installed directory (the directory the installed SKILL.md sits in). No literal ${CLAUDE_SKILL_DIR} remains in the installed skill files, at either scope.
result: pass
note: "Verified live 2026-08-04 (user ran marketplace add + install in sandbox Pi from tmp/work; Claude inspected at user request). Fixture skill-probe@sub-uat-mkt, skill sub-probe. Project scope: tmp/work/.pi/pi-claude-marketplace/resources/skills/skill-probe-sub-probe/SKILL.md shows ${CLAUDE_SKILL_DIR} resolved to that exact dir in both body and frontmatter description. User scope: tmp/pi-uat/agent/.../skills/skill-probe-sub-probe/SKILL.md re-derived to the user-scope dir. No literal ${CLAUDE_SKILL_DIR} anywhere in either file."

### 2. Scope-gated ${CLAUDE_PROJECT_DIR} in skills (SUB-02 skills arm)
expected: A project-scope install substitutes ${CLAUDE_PROJECT_DIR} in installed skill files to the install cwd (the project root). The same plugin installed at user scope leaves the ${CLAUDE_PROJECT_DIR} token literal — untouched in the file, never replaced with an empty string.
result: pass
note: "Verified live 2026-08-04. Project scope: ${CLAUDE_PROJECT_DIR} resolved to tmp/work (the install cwd). User scope (same plugin, install --scope user): token still literal in the installed file — the only divergence between the two scope arms; not an empty string. ${CLAUDE_PLUGIN_DATA} re-derived per scope (tmp/work/.pi/... vs tmp/pi-uat/agent/...), ${CLAUDE_PLUGIN_ROOT} identical (path-source marketplace plugin dir)."

### 3. Unknown-token pass-through (no over-substitution)
expected: Tokens outside the four-variable set (e.g. ${CLAUDE_UNKNOWN} or ${SOME_OTHER_VAR}) survive installation byte-identical in materialized files; variables without a value pass through as literals rather than empty strings; substituted values are inserted verbatim in a single pass (no re-expansion artifacts).
result: pass
note: "Verified live 2026-08-04 in both scope arms: ${CLAUDE_UNKNOWN} and ${SOME_OTHER_VAR} byte-identical literals in both installed SKILL.md files; no empty-string substitutions anywhere; all substituted values inserted verbatim with no re-expansion artifacts. T-03-01 no-re-expansion additionally guarded by the automated placeholder-injection property test (tests/shared/vars.test.ts)."

### 4. 93-02 automated coverage confirmation (commands/agents/orchestrator threading)
expected: Confirm the automated coverage for plan 93-02 stands — all three deliverables are deterministically covered by passing tests, no live re-test required. D1 commands scope arms (tests/bridges/commands/stage.test.ts, 2 SUB-02 tests), D2 agent convertAgent projectDir arms (tests/bridges/agents/convert.test.ts), D3 end-to-end project-scope + user-scope install delivery into skill/command/agent files (tests/orchestrators/plugin/install.test.ts, 2 SUB-02 e2e tests).
result: pass
note: "User confirmed 2026-08-04 that the deterministic coverage stands (all refs status: pass in 93-02-SUMMARY coverage block). Live UAT Tests 1-3 independently exercised the shared substituteClaudeVars path end-to-end on the skills surface."

### 5. Project-scope command substitutes ${CLAUDE_PROJECT_DIR} to cwd; user-scope keeps it literal; ${CLAUDE_SKILL_DIR} stays literal in both scopes
expected: Project-scope command substitutes ${CLAUDE_PROJECT_DIR} to cwd; user-scope keeps it literal; ${CLAUDE_SKILL_DIR} stays literal in both scopes
result: pass
source: automated
coverage_id: D1

### 6. convertAgent substitutes ${CLAUDE_PROJECT_DIR} when projectDir set (project scope); leaves it literal when omitted (user scope); ${CLAUDE_SKILL_DIR} stays literal
expected: convertAgent substitutes ${CLAUDE_PROJECT_DIR} when projectDir set (project scope); leaves it literal when omitted (user scope); ${CLAUDE_SKILL_DIR} stays literal
result: pass
source: automated
coverage_id: D2

### 7. End-to-end: a project-scope install materializes skill/command/agent files with ${CLAUDE_PROJECT_DIR} replaced by the install cwd; user-scope leaves it literal
expected: End-to-end: a project-scope install materializes skill/command/agent files with ${CLAUDE_PROJECT_DIR} replaced by the install cwd; user-scope leaves it literal
result: pass
source: automated
coverage_id: D3

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
