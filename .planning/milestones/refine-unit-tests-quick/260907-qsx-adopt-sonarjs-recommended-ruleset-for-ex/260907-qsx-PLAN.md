---
quick_id: 260907-qsx
description: adopt SonarJS recommended ruleset for extensions
date: 2026-09-07
branch: features/backlog-and-sonar
---

# Quick Task 260907-qsx: enforce Sonar way locally

## Goal

Catch Sonar way violations at lint time instead of discovering them on the
SonarCloud pull-request gate.

## What the measurement established

| Fact | Value |
|---|---|
| Plugin | `eslint-plugin-sonarjs@4.2.0`, already a devDependency |
| Configs it ships | one, `recommended` — there is no "Sonar way" config |
| `recommended` | 279 rules: 217 at `error`, 62 `off` |
| SonarCloud profile for `ts` | stock **Sonar way**, 467 active rules |
| Overlap | 200 of the 217 are in Sonar way; 17 are extra |
| Violations, `extensions/` | 0 — matches SonarCloud green |
| Violations, `tests/` | 1021, of which 797 are `void-use` |

`sonar.sources=extensions/pi-claude-marketplace` and
`sonar.test.exclusions=tests/**`, so SonarCloud never reads the test tree.
Scoping the ruleset to `extensions/` therefore reproduces Sonar's verdict and
lands green.

## Tasks

1. Add one config block to `eslint.config.js`.
   - files: `eslint.config.js`
   - action: spread `sonarjs.configs.recommended.rules` scoped to
     `extensions/pi-claude-marketplace/**/*.ts`; re-assert
     `cognitive-complexity: ["error", 15]` after the spread; comment the
     scoping and both mechanics.
   - verify: `npm run lint` exits 0; `eslint --print-config` shows 217 error /
     0 warn.
   - done: block present, gate green.

2. Record it in `CONVENTIONS.md`.
   - files: `.planning/codebase/CONVENTIONS.md`
   - verify: the nested "Key rules" list stays contiguous.
   - done: one bullet added after the nested list.

## Constraints

- Stay on `features/backlog-and-sonar`. Do not create or switch branches.
- `tests/` behavior must be byte-identical. Capture the count first.
- Spread `.rules`; never add `recommended` as a config entry. It re-declares
  the `sonarjs` plugin (ESLint 10 rejects it) and has no `files` key.
- Three unrelated modified files stay unstaged. Never `git add -A`.
