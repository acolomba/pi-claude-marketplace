---
phase: quick-261116-hk1
plan: 01
subsystem: workflows
tags: [workflows, naming, parity]
key-files:
  modified:
    - extensions/pi-claude-marketplace/domain/workflow-script.ts
    - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
    - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - features/workflow/collisions.feature
    - docs/workflows-compatibility.md
    - CHANGELOG.md
key-decisions:
  - D-PG8-07 locked by the maintainer review 2026-11-16, with E5 changed so the last of two scripts with one name is installed, silently, as in Claude Code 2.1.323.
  - E7 keeps its engine license (no remove-if-unchanged mode in the engine; script bytes stay verbatim, WBRG-01).
---

# Quick task 261116-hk1: keep the last workflow script with one name

## Upstream evidence (read in the binary, not run)

Claude Code 2.1.323 (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`),
offsets near 323988113:

```js
function y(o,a){if(!a||tCi(o.script))return!0;return t(`Workflow ${o.filePath??o.name} (${o.source}) would override ${o.name} but does not parse — keeping the ${a.source} copy`,{level:"warn"}),!1}
function D(o){let a=new Map;for(let s of o){if(!y(s,a.get(s.name)))continue;a.set(s.name,s)}return[...a.values()]}
```

`tCi(e)` is `!("error" in WA(e))`, the full parse with the body. The plugin
loader `S` pushes the default `workflowsPath` directory first, then each
`workflowsPaths` entry in order; a directory goes through `v`, which keeps the
`readdir` order (`Promise.all` over the entries). So the last script in that
order wins, unless it does not parse. A replaced script gets no message; the
keep-earlier branch logs through `t` at level `warn`.

## License finding

None. WNAM-05 is a requirement of the archived workflows milestone, not a
decision carried in PROJECT.md, and `docs/research/parity-gaps/workflows.md`
records that it was settled without the upstream rule. The engine saves one
`<name>.json` per name, so keeping one script fits it.

## Change

`keepLastWorkflowPerName` (domain) replaces `assertNoWorkflowNameCollisions`;
`discoverPluginWorkflows` applies it, so stage, `info`, and the generated-name
reads all see one script per name. `WorkflowNameCollisionError` is removed.
Within a directory the order is the sorted file order, because `readdir` order
is the file system's.

## Verification

- `features/workflow/collisions.feature`, "Of two workflow scripts with one
  name, a new session offers the last one, as in Claude Code": passes; with the
  production diff reverted it fails with the collision error.
- Paired unit tests: `test/domain/workflow-script.test.ts`,
  `test/bridges/workflows/{discover,stage}.test.ts`, `test/shared/errors.test.ts`,
  `test/orchestrators/plugin/install-flow-ledger.test.ts` (the WLIF-01 prepare
  failure now comes from a file where the staging directory belongs).
- `npm run check`: exit 0 on the combined tree before commit b35b86d1.

## Threat Flags

None -- no security-relevant surface outside the task's scope was introduced.
