---
phase: 260913-skt
plan: 01
subsystem: domain
tags: [naming, skills, claude-code-parity, windows, skill-in-skill]

# Dependency graph
requires:
  - "Quick task 260913-csn: the colon skill namespace (PR #180) — on POSIX an aligned reference maps to itself, which is what makes this rewrite a byte-identical no-op for aligned content."
provides:
  - "SKTK-01: staged skill content has same-plugin `<plugin>:<skill>` references retargeted onto the generated names the install materializes — the `.` form on Windows, the RN-1 elided form everywhere — outside fenced code blocks."
  - "`domain/skill-tokens.ts` (`rewriteSkillTokens`) — the token grammar shared with the agents skill-legend detector, mapped through `generatedSkillName`, gated on the discovered generated-name set."
  - "`shared/regexp.ts` (`escapeRegExp`) — hoisted from the agents bridge so domain and bridges share one copy."
affects: [skills-bridge, agents-bridge]

actuals:
  tasks: 3
  commits: 3
plan_head_before: "73574260"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Identity-safe rewriting: map every reference through the name generator and replace unconditionally — an aligned token is its own replacement, so correctness on the divergent platform never costs bytes on the aligned one."
    - "Fence-skip on in-place rewrites, fence-include on legends: D-82-07's legend scans fences because it mutates nothing; an in-place rewrite must leave fenced examples verbatim."

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/skill-tokens.ts
    - extensions/pi-claude-marketplace/shared/regexp.ts
    - tests/domain/skill-tokens.test.ts
    - tests/shared/regexp.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - tests/bridges/skills/stage.test.ts
    - CHANGELOG.md

key-decisions:
  - "D1 — in-place rewrite, not a legend: a legend cannot reach the frontmatter `description`, which is where the model's skill listing reads from; and the POSIX identity property means author bytes only change where they are wrong."
  - "D2 — both staging arms flow through the rewrite (parsed and degraded): a degraded skill's preserved body is prose too, and the rewrite runs before SK-4 substitution so the PARSE-02 backstop validates the final bytes."
  - "D3 — the known-names gate is the plugin's own discovered set: unknown and cross-plugin references stay verbatim (same rule as AGSK-02), and a candidate the generator rejects is skipped, never thrown."
  - "D4 — `escapeRegExp` moves to `shared/regexp.ts` rather than being duplicated into domain: fallow's dupes gate would flag a second identical 3-line function, and shared/ is importable from both zones."
  - "D5 — commands bridge left alone: command prompt bodies have the same Windows divergence, but rewriting them is its own decision (prompt files are invoked, not read as prose by the model in the same way); noted as a candidate follow-up, not smuggled in."

patterns-established: []

requirements-completed: [SKTK-01]

coverage:
  - id: SKTK-01
    description: "Same-plugin skill references in staged skill content resolve to installed names on every platform; fenced examples and unknown/cross-plugin references stay verbatim."
    requirement: "SKTK-01"
    verification:
      - kind: unit
        ref: "tests/domain/skill-tokens.test.ts — 12 cases: aligned identity, elision convergence, win32 dot rewrite (setCasePlatform), unknown/cross-plugin/embedded-word verbatim, generator-rejection skip, backtick and tilde fences, inline code, CRLF preservation, plugin-name regex escaping"
        status: pass
      - kind: unit
        ref: "tests/bridges/skills/stage.test.ts — SKTK-01 wiring cases for both arms: parsed (description + prose rewritten, fence verbatim, unknown kept) and degraded (synthesized block with rewritten body)"
        status: pass
      - kind: other
        ref: "direct coverage 100%: skill-tokens.ts branches 13/13 lines 69/69; regexp.ts 100%; stage.ts branches 79/79 lines 595/595; convert.ts branches 108/108 lines 620/620"
        status: pass
      - kind: other
        ref: "npm run check — full chain green (exit 0, captured unpiped)"
        status: pass
    human_judgment: false

# Metrics
completed: 2026-09-13
status: complete
---

# Quick Task 260913-skt: Skill-Token Rewrite Summary

## Commits

All on branch `features/skill-token-rewrite`, based on `73574260` (the pr-180 tip: PR #180 +
origin/main merge + suite repair). Pre-commit scoped run green except the structural trufflehog
worktree failure (SKIP'd, documented); substitute filesystem scan clean at
`verified_secrets: 0, unverified_secrets: 0`. Full `npm run check` green at 5991 unit / 32
integration before the first commit.

| Task | SHA | Title |
|---|---|---|
| 1 | `344e3a4d` | `feat(skills): rewrite sibling skill references to installed names` |
| 2 | `6551dfbf` | `docs: record the skill-reference rewrite` |
| 3 | (this commit) | `docs(quick): record the skill-token rewrite quick task` |

**Skill-in-skill references now survive the namespace translation on every platform: staged skill content maps same-plugin `<plugin>:<skill>` tokens through `generatedSkillName`, so Windows gets the `.` name it actually installs and elidable spellings converge — while on POSIX aligned content stays byte-identical because an aligned token is its own replacement.**

## Why in-place, when agents use a legend

D-82-07 chose legend-over-rewrite for agent bodies. Skills cannot take that route for the case
that matters most: the frontmatter `description` feeds the model's skill listing in the system
prompt, where a body legend never reaches. The identity property removes the usual cost of
in-place rewriting — author bytes change only where they name something that does not exist on
this machine. Fenced code blocks are the deliberate exception (upstream-syntax examples must
survive verbatim), which inverts the legend's fence rule for the inverse reason.

## Shape

- `domain/skill-tokens.ts::rewriteSkillTokens(content, pluginName, knownGeneratedNames)` — the
  agents-bridge token grammar (guarded lookbehind, dot-free candidate class), each candidate
  mapped through `generatedSkillName`, replaced only when the mapped name is one the install
  materializes. Rejections are skipped, fences toggle a skip state, CRLF survives.
- Wired in `prepareStageSkills` after the SK-3 name rewrite / degrade synthesis and before SK-4
  substitution, on both arms, using the discovered generated-name set already in hand.
- `escapeRegExp` hoisted to `shared/regexp.ts`; the agents bridge now imports it.
