# Requirements: Notification Refactor

**Defined:** 2026-06-24
**Workstream:** notification-refactor (unnumbered milestone — concurrency-friendly)
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact — atomically, recoverably, and with soft-dependency degradation that never blocks the install.

## Milestone Goal

Restructure the notification subsystem so that **commands own outcome intent and `notify()` becomes a dumb reducer.** Severity and reload-need become caller-decided (not inferred from status/reasons), user-visible output becomes desired-state / outcome-oriented, and the whole surface becomes open-closed: adding a command should touch its own vertical slice plus a minimum of central registration, with zero edits to a notification monolith.

The through-line: **caller owns intent (severity, reload-need, status, reasons, cause); renderer owns presentation + environment (soft-dep probe, formatting, reduction).**

Baseline established by `research/MESSAGING-COUPLING.md`: today a new command touches **5 central files** (no new grammar) or **9–11** (new status/reason, 6 of them inside the 3119-line `shared/notify.ts`). Target: **≤3 central files, 0 `notify.ts` edits.**

## Requirements

### Severity — caller-stamped (SEV)

- [x] **SEV-01**: Every outcome row (plugin-level and marketplace-level) carries a caller-stamped `severity` field with values `info | warning | error`; an absent severity defaults to `info`.
- [x] **SEV-02**: `notify()` derives the emission severity as the numeric max over all rows (`info=0 < warning=1 < error=2`); it performs no content/reason inference.
- [x] **SEV-03**: Severity semantics are desired-state: `info` = end state equals desired (genuine success or idempotent no-op); `warning` = operation carried out but end state falls short and needs attention; `error` = operation could not be carried out. This tri-state is the documented contract.
- [x] **SEV-04**: `BENIGN_REASONS`, `allBenign`, and the content-derived `cascadeSeverity` ladder are removed; severity no longer reads the `reasons` field.
- [x] **SEV-05**: Each command stamps severity from its own desired-vs-actual judgment, free to disagree with another command on an identical `(status, reasons)` pair (e.g. `install` of an already-installed plugin → `error`; `update` of an up-to-date plugin → `info`).

### Reload — caller-stamped (RLD)

- [x] **RLD-01**: Every outcome row carries a caller-stamped `needsReload` boolean (does this outcome change a Pi-visible resource such that `/reload` is required).
- [x] **RLD-02**: `notify()` emits the `/reload to pick up changes` trailer iff the OR-reduce of `needsReload` over all rows is true.
- [x] **RLD-03**: The status-token→reload mapping in `shouldEmitReloadHint` is removed; reload is no longer inferred from status tokens.
- [x] **RLD-04**: The `present` plugin status collapses into `installed` — its only role was reload suppression on the list surface, now handled by `needsReload: false`.
- [x] **RLD-05**: The `disable-cascade` cascade kind is removed — the disable command stamps `needsReload: true` on its rows directly; list/info surfaces stamp `false`.

### Output / summary model (OUT)

- [x] **OUT-01**: Severity reaches the user via the host `ctx.ui.notify(msg, "warning"|"error")` channel, retaining the host `Error:` / `Warning:` label and default color (fork A — the host couples label+color to the severity arg in `@earendil-works/pi-coding-agent` 0.79.x; confirmed from `showExtensionNotify`/`showError`/`showWarning`). Info omits the second arg.
- [x] **OUT-02**: Error/warning emissions carry a leading severity sentence keyed to the max severity: `[A|Some] <subject> operation[s] has/have failed | needs/need attention.` (`subject` = plugin|marketplace; `A`=1, `Some`>1; verb = `has/have failed` for error, `needs/need attention` for warning; sentence keeps its terminal period). The leading sentence prevents the host label from gluing onto a detail row.
- [x] **OUT-03**: Bulk operations carry a trailing tally line: `<Operation>: <n> failure(s), <n> warning(s), <n> success(es)` — counts pluralized by count, zero-count categories omitted, no terminal period.
- [x] **OUT-04**: The operation label in the tally is the command's human notification name (e.g. `Plugin install`, `Marketplace add`), supplied by the command (see MOD-01). Single-target operations omit the trailing tally (the row already embeds the outcome); the leading severity sentence still appears for single-target error/warning.
- [x] **OUT-05**: The marketplace header is always rendered; a plugin row never appears without its marketplace header.
- [x] **OUT-06**: Mixed-subject cascades (load-time `reconcile`, `import`) drop the subject noun in the leading sentence (`[A|Some] operation[s] …`) and use the operation name in the tally, counting all rows uniformly.
- [x] **OUT-07**: Cascade cardinality is structural in the type model (single marketplace/plugin vs. plural), not inferred by counting rows at render time.
- [x] **OUT-08**: `docs/output-catalog.md` and the `catalog-uat` byte fixtures are rewritten in lockstep for the new summary surfaces (atomic supersession); per-row grammar (icons, status tokens, reasons) is preserved except the `present`→`installed` collapse; the `reasons` set stays closed for output-grammar/catalog stability.

### Open-closed modularity (MOD)

- [x] **MOD-01**: Each command co-locates its own notification vocabulary with its vertical slice (handler/orchestrator): its private status set, its owned reasons, its operation label (exposed via a `Messaging` member on the command's `CommandContext`), and its per-status render map — none of it hand-appended to central tuples in `notify.ts`. (Revised 2026-06-24: command-local ownership, no central "grammar" registry.)
- [x] **MOD-02**: There is no central status/reason registry. Each command owns its status set and message shapes locally, so value/type drift is caught at the command module — a command cannot construct a message whose status it did not declare. `notify()` receives the command's `CommandContext` and rows at the call site rather than unioning contributions centrally. The bidirectional `notify-types.test.ts` set-equality proofs are deleted (the central tuples they guarded are gone). (Revised 2026-06-24: intent preserved — no drift, proofs deleted — via command-local ownership instead of a central registry.)
- [x] **MOD-03**: Each command renders its own rows via a render map total over its OWN status set — omitting an arm for one of the command's statuses is a compile error — calling the shared presentation vocabulary (`ICON_*`, scope/version/reason composers) that stays central in `notify.ts`. The exhaustiveness guarantee is local per command; there is no central per-status `switch` + `assertNever` to keep in sync. (Revised 2026-06-24: missing-arm-is-a-compile-error preserved, relocated from a central `Record<Status,RenderFn>` to per-command render maps.)
- [ ] **MOD-04**: Cross-cutting concerns are extracted into concern-modules that contribute to the central composer: the hooks summary (`appendHooksBlock`) and soft-dep marker injection (`composeReasons` soft-dep branch + `DEPENDENCIES` + the host probe). `shared/notify.ts` slims to the envelope, the reducer spine, and the shared presentation vocabulary (`ICON_*`, scope/version/reason composers).
- [ ] **MOD-05**: Adding a command touches **≤3 central files** — router registration (interface field + tuple + switch + usage), `register.ts` wiring, and one catalog section — and **zero `notify.ts` edits**, measured against the `research/MESSAGING-COUPLING.md` baseline.
- [ ] **MOD-06**: The catalog floor is accepted for this milestone — one central catalog section per new rendered state, no generation/aggregation seam. Documented as the deliberate floor (generation deferred).

### Correctness preservation (GATE)

- [x] **GATE-01**: An architecture test asserts every cascade-producing orchestrator stamps both `severity` and `needsReload` on its state-change rows (no silent reliance on the `info` / `false` defaults for transitions), since correctness relocates from one audited reducer to ~18 producers.
- [x] **GATE-02**: The `catalog-uat` byte-equality runner remains the end-to-end gate that stamped values render correctly, green at every phase boundary.
- [ ] **GATE-03**: `npm run check` (typecheck + ESLint + Prettier + tests) stays green at every phase boundary (NFR-6).

## Out of Scope

| Feature | Reason |
|---------|--------|
| New commands or user-facing features | This is a structural refactor of the existing surface |
| Catalog generation/aggregation seam | Floor accepted (MOD-06); generation deferred to a future milestone |
| Host-side label/color decoupling | Fork A accepts the host's coupling; a `pi-coding-agent` change is a separate upstream effort |
| Per-row grammar changes beyond `present`→`installed` | Icons, status tokens, and `reasons` membership are preserved except where the summary redesign requires |
| Telemetry / metrics | IL-4 unchanged |
| i18n / message catalog | IL-1 unchanged — English-only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MOD-01 | Phase 1 | Complete |
| MOD-02 | Phase 1 | Complete |
| MOD-03 | Phase 1 | Complete |
| OUT-07 | Phase 1 | Complete |
| SEV-01 | Phase 2 | Complete |
| SEV-02 | Phase 2 | Complete |
| SEV-03 | Phase 2 | Complete |
| SEV-04 | Phase 2 | Complete |
| SEV-05 | Phase 2 | Complete |
| RLD-01 | Phase 2 | Complete |
| RLD-02 | Phase 2 | Complete |
| RLD-03 | Phase 2 | Complete |
| RLD-04 | Phase 2 | Complete |
| RLD-05 | Phase 2 | Complete |
| GATE-01 | Phase 2 | Complete |
| OUT-01 | Phase 3 | Complete |
| OUT-02 | Phase 3 | Complete |
| OUT-03 | Phase 3 | Complete |
| OUT-04 | Phase 3 | Complete |
| OUT-05 | Phase 3 | Complete |
| OUT-06 | Phase 3 | Complete |
| OUT-08 | Phase 3 | Complete |
| GATE-02 | Phase 3 | Complete |
| MOD-04 | Phase 4 | Pending |
| MOD-05 | Phase 4 | Pending |
| MOD-06 | Phase 4 | Pending |
| GATE-03 | Phase 4 | Pending |

**Coverage:**
- Requirements: 27 total (SEV ×5, RLD ×5, OUT ×8, MOD ×6, GATE ×3)
- Mapped to phases: 27 ✓
- Unmapped: 0 ✓

Note: GATE-02 (catalog-uat green) and GATE-03 (`npm run check` green) are per-phase
boundary requirements honored at every phase; they are anchored above to the phase
that owns their primary deliverable (GATE-02 → the catalog supersession in Phase 3,
GATE-03 → the milestone-close green gate in Phase 4).

---
*Requirements defined: 2026-06-24*
*Last updated: 2026-06-24 after roadmap creation (4 phases, 100% coverage)*
