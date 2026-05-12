# transaction/

## Purpose

The Phase ledger primitive that install/update/uninstall reuse for atomic multi-phase rollback. `withStateGuard` (concurrency sentinel) lives here too. Phase 2 lands both primitives.

## Allowed Imports

`transaction/` may import from: `persistence/`, `shared/`. Imports from `edge/`, `orchestrators/`, `bridges/`, `domain/`, `presentation/`, `platform/` are forbidden.

## Planned Contents

- [ ] `phase-ledger.ts` -- N-phase atomic ledger with phase-ordered rollback (Phase 2)
- [ ] `with-state-guard.ts` -- concurrency sentinel for state.json mutations (Phase 2)
