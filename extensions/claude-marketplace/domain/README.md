# domain/

## Purpose

Pure logic with zero I/O. Source parsing (`pathSource`/`githubSource`), manifest schemas (TypeBox), plugin compatibility resolver (the discriminated `installable: true | false` union), and resource naming rules (`<plugin>-<skill>`, `<plugin>:<command>`, `claude-marketplace-<plugin>-<agent>`). Phase 2 lands the bulk; Phase 3 adds resource-specific naming helpers.

## Allowed Imports

`domain/` MUST NOT import upward from any extension folder. The only allowed sibling import is `shared/` (markers, errors, types). Pure-logic discipline; no `node:fs`, no network, no `ctx`.

## Planned Contents

- [ ] `source/{path,github,parse}.ts` -- Phase 2
- [ ] `manifest/{schema,parse}.ts` -- Phase 2
- [ ] `resolver/{installable,unavailable}.ts` -- Phase 2
- [ ] `naming/{skills,commands,agents,mcp}.ts` -- Phases 2-3

Note: the `Scope` type is currently planned for `shared/types.ts` (Phase 2) so `edge/` can import it without crossing the D-11 boundary. See Phase 1 SUMMARY follow-up note.
