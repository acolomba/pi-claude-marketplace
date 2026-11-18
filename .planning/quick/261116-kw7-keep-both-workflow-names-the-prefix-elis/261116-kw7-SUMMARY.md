---
phase: quick-261116-kw7
plan: 01
status: complete
subsystem: workflows
tags: [workflows, naming, parity]
key-files:
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/domain/workflow-script.ts
    - extensions/pi-claude-marketplace/domain/skill-tokens.ts
    - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
    - features/workflow/collisions.feature
    - docs/workflows-compatibility.md
    - CHANGELOG.md
key-decisions:
  - D-PG8-18 (maintainer decision 2026-11-16, amends WNAM-06): two different meta.names that the prefix elision would give one name both install; the prefixed script keeps its full name. Only identical meta.names fall to D-PG8-07's keep-last rule.
---

# Quick task 261116-kw7: keep both workflow names the prefix elision would merge

## Change

`unelidedWorkflowName` (domain/name.ts) builds `<plugin>:<meta.name>` with the
same screens as `generatedWorkflowName`. `unelideClashingWorkflowNames`
(domain/workflow-script.ts) gives every `meta.name` in a group of two or more
different `meta.name`s with one name its full name, and repeats until no such
group is left; the result depends only on the set of `meta.name`s. A full name
that fails the screens (over 128 characters) is not used. `discoverPluginWorkflows`
applies it before `keepLastWorkflowPerName`, so stage, `info`, discover-names
(the generated-name reads), update, and reinstall all see the same names.
`rewriteMarkdownReferences` tries the full workflow name before the elided one,
so `demo:demo-scan` in a skill stays on the full name.

## Precedent

None to follow: the commands bridge keeps the first of two sources that elide
to one name, with a warning (D-07); D-PG11-01's `claudeName` is an alias of an
installed command, not a second installed name.

## Verification

- `features/workflow/collisions.feature`, "A new session offers both workflows
  when one name is the other with the plugin prefix": passes; with HEAD's
  `discover.ts` it fails, offering only `/demo:scan`.
- Paired unit tests with 100% direct coverage: `test/domain/name.test.ts`,
  `test/domain/workflow-script.test.ts`, `test/domain/skill-tokens.test.ts`,
  `test/bridges/workflows/discover.test.ts`.
- `npm run check`: exit 0 on the tree of commit 3488bf29.

## Threat Flags

None -- no security-relevant surface outside the task's scope was introduced.
