# Phase 11 Validation

## Gates

### Targeted unit/integration commands

Run these while executing the individual plans:

```bash
npm test -- tests/orchestrators/import/settings.test.ts tests/orchestrators/import/refs.test.ts tests/orchestrators/import/marketplaces.test.ts
npm test -- tests/orchestrators/import/execute.test.ts
npm test -- tests/edge/handlers/import.test.ts tests/edge/router.test.ts tests/edge/completions/provider.test.ts tests/edge/register.test.ts
npm test -- tests/e2e/import-command.test.ts
```

Exact test file names may be adjusted to match existing conventions, but Phase 11 must leave a targeted command for the new orchestrator, edge handler/router/completions, and rich e2e fixture.

### Full repository gate

```bash
npm run check
```

This is required before Phase 11 sign-off.

## Per-Plan Validation Map

| Plan | Primary tests | Required evidence |
| --- | --- | --- |
| `11-01-PLAN.md` | `tests/orchestrators/import/execute.test.ts`, existing import foundation tests | Idempotent existing marketplace/plugin skips, marketplace source mismatch skips dependent plugins, marketplace add failure skips only dependent plugins, install outcome classification, per-scope isolation, final warning aggregation, one reload hint at import end. |
| `11-02-PLAN.md` | `tests/edge/handlers/import.test.ts`, `tests/edge/router.test.ts`, `tests/edge/completions/provider.test.ts`, `tests/edge/register.test.ts` | `/claude:plugin import` routes; `--scope` accepts user/project at any position; omitted scope expands to both; usage errors use `ctx.ui.notify`; top-level completion includes `import`; registration wires handler with `pi` and `gitOps`. |
| `11-03-PLAN.md` | `tests/e2e/import-command.test.ts`, `npm run check` | Rich fixture covers official GitHub, extra-known directory, extra-known GitHub, local override disabling base plugin, already-installed skip, unavailable warning, both scopes, final summary, source mismatch. |

## Grep/Architecture Checks

Use source assertions in tests or direct CLI checks to confirm:

```bash
rg "process\.stdout|process\.stderr|console\.log|console\.error" extensions/pi-claude-marketplace/orchestrators/import extensions/pi-claude-marketplace/edge
rg "installPlugin\(" extensions/pi-claude-marketplace/orchestrators/import/execute.ts
rg "addMarketplace\(" extensions/pi-claude-marketplace/orchestrators/import/execute.ts
rg "import" extensions/pi-claude-marketplace/edge/router.ts extensions/pi-claude-marketplace/edge/completions/provider.ts extensions/pi-claude-marketplace/edge/register.ts
```

The first grep must not find forbidden output-channel writes. The remaining greps should demonstrate delegation and edge registration.

## Sign-Off Criteria

- All Phase 11 requirements appear in plan frontmatter across the three plans: IMP-01, IMP-02, IMP-03, IMP-09, IMP-10, IMP-11.
- Targeted Phase 11 tests pass.
- `npm run check` passes.
- User-visible import messages are delivered through `ctx.ui.notify` helpers only.
- Import remains retry-safe and idempotent for already-added marketplaces and already-installed plugins.
