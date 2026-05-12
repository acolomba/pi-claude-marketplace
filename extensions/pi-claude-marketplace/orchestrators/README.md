# orchestrators/

## Purpose

Use-case logic. Marketplace lifecycle (`add`, `remove`, `list`, `update`, `autoupdate`/`noautoupdate`) lands in Phase 4; plugin lifecycle (`install`, `uninstall`, `update`, top-level `list`) lands in Phase 5. Orchestrators compose bridges, transaction primitives, and persistence to deliver user-visible behavior.

## Allowed Imports

`orchestrators/` may import from: `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`. Imports from `edge/` are forbidden -- orchestrators must not depend on the user-facing layer.

## Planned Contents

- [ ] `marketplace/{add,remove,list,update,autoupdate}.ts` -- Phase 4
- [ ] `plugin/{install,uninstall,update,list}.ts` -- Phase 5
