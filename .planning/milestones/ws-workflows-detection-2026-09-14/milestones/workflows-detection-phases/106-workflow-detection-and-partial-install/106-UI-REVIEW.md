# Phase 106 - UI Review

**Audited:** 2026-08-29 (re-audited after baseline correction)
**Baseline:** `106-UI-SPEC.md`
**Screenshots:** Not captured. This phase has no graphical frontend, and no dev server was available on ports 3000, 5173, or 8080.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | The exact workflow token, versionless rejection, summaries, and hints match the executable catalog. |
| 2. Visuals | 4/4 | The terminal row reuses the closed partial-state glyphs and adds no workflow-specific visual element. |
| 3. Color | 4/4 | The extension adds no color rule. Severity and adjacent status text preserve meaning without color. |
| 4. Typography | 4/4 | The renderer leaves typography to the host and adds no ANSI or markdown styling. |
| 5. Spacing | 4/4 | Shared composers preserve the 0/2/4/6-space ladder and blank-line contracts. |
| 6. Experience Design | 4/4 | Consent, rollback, retry, structural precedence, and cross-surface reason parity are covered through shared production seams. |

**Overall: 24/24**

---

## Top Priority Fixes

None. The corrected UI contract matches the implementation and the established unsupported-component behavior.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

**PASS:** The implemented vocabulary is precise. `workflows` is a dedicated tail member of `REASONS`, and the shared classifier maps only that typed kind to the exact lowercase plural token. `composeReasons` keeps all reasons in one comma-separated brace block. The catalog also preserves the existing install hint and error summary.

The rejection example is versionless. It now matches the executable catalog at `docs/output-catalog.md:624` and the early-rejection behavior used for other unsupported components.

### Pillar 2: Visuals (4/4)

**PASS:** This phase has no HTML, CSS, React, JSX, or TSX surface. The terminal renderer uses the existing `⊖` partially-available and `◉` partially-installed glyphs. It adds no workflow-specific icon, heading, prompt, or trailer. The status text and `{workflows}` reason make the degraded state distinct from a clean install.

### Pillar 3: Color (4/4)

**PASS:** No CSS, hard-coded color, ANSI escape, or workflow color token was added. The row carries a textual status and reason, so color is not the only state signal. The catalog fixtures pin info severity for inventory and partial success, and error severity for normal rejection.

### Pillar 4: Typography (4/4)

**PASS:** Font family, size, weight, and line height remain host-controlled. The implementation adds plain terminal text only. Workflow states use the same renderer and token composition as all other plugin states.

### Pillar 5: Spacing (4/4)

**PASS:** `notify.ts:2640` documents the byte grammar, including two-space plugin rows, four-space details, six-space nested details, and one blank line between blocks. `notify.ts:4035` and `notify.ts:4043` implement the plugin and hint indentation. The three workflow catalog states bind the inventory, rejection, and success bytes in both catalog walk directions.

### Pillar 6: Experience Design (4/4)

**PASS:** The implemented flow is coherent. Normal install rejects with an actionable `--partial` hint. Explicit partial consent installs only supported components. Structural defects still win, failed staging rolls back, retry succeeds, and workflow files never enter resources or reload discovery.

The shared classifier and cross-surface parity test cover the broader surface matrix. Existing generic update and autoupdate byte fixtures cover severity, hint, and reload rules. Workflow-specific copies are not required because no command has a workflow branch.

---

## Registry Safety

No `components.json` file exists, shadcn is not initialized, and the UI spec lists no third-party registries. The registry audit does not apply.

---

## Files Audited

- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-UI-SPEC.md`
- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-CONTEXT.md`
- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-01-PLAN.md`
- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-01-SUMMARY.md`
- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-02-PLAN.md`
- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-02-SUMMARY.md`
- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-03-PLAN.md`
- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-03-SUMMARY.md`
- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-04-PLAN.md`
- `.planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-04-SUMMARY.md`
- `extensions/pi-claude-marketplace/domain/components/plugin.ts`
- `extensions/pi-claude-marketplace/domain/resolver.ts`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts`
- `extensions/pi-claude-marketplace/shared/notify.ts`
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`
- `tests/shared/probe-classifiers.test.ts`
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`
- `tests/orchestrators/plugin/install.test.ts`
- `tests/architecture/catalog-uat.test.ts`
- `tests/architecture/notify-closed-set-locks.test.ts`
- `docs/output-catalog.md`
