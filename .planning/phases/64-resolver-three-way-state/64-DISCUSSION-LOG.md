# Phase 64: Resolver Three-Way State - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 64-resolver-three-way-state
**Areas discussed:** Discriminant shape, Unsupported-reason modeling, Consumer migration, `unavailable` arm field set

---

## Discriminant shape

| Option | Description | Selected |
|--------|-------------|----------|
| String tag `state` | Add `state: "installable"\|"unsupported"\|"unavailable"` literal discriminant; drop the `installable` boolean. Clean TS narrowing, idiomatic TypeBox literal-tagged union. Revisits D-05. | ✓ |
| Two booleans | Keep `installable: true\|false`, add `degradable: true\|false`. Preserves D-05's letter but forces awkward two-field narrowing and a nonsensical combo. | |

**User's choice:** String tag `state`
**Notes:** D-05 mandated boolean only because the old state was binary; three-way naturally needs a string tag → superseded by D-64-01.

---

## Unsupported-reason modeling

| Option | Description | Selected |
|--------|-------------|----------|
| Derive at render | Keep structural reasons in the existing array; derive per-kind unsupported markers from the component lists at render time via a shared list/info helper. No new resolver type. | ✓ |
| Structured resolver type | Add a structured per-kind reason type (`{kind, reason}[]`) emitted by the resolver. More explicit, but pushes render concerns into the resolver and risks list/info divergence. | |

**User's choice:** Derive at render
**Notes:** Guarantees identical rendering across surfaces (criterion 5) by construction → D-64-02.

---

## Consumer migration

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-migrate, no shim | Update every `if (r.installable)` call site to switch on the new discriminant; compiler surfaces all sites. No back-compat helper. | ✓ |
| `isInstallable()` shim | Add a boolean helper so call sites compile unchanged; migrate incrementally. Leaves a boolean back-door weakening the three-way discipline. | |

**User's choice:** Hard-migrate, no shim
**Notes:** Tightest NFR-7 enforcement → D-64-03. Two gates `requireInstallable` / `requireForceInstallable` → D-64-04.

---

## `unavailable` arm field set

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal arm | Name + structural reasons + notes only; never `pluginRoot`. Drop `orphanRewake`/`hooksConfigPath`/component lists — meaningless when structure is broken. | ✓ |
| Symmetric fields | Keep all current symmetric fields (minus `pluginRoot`) for uniform consumer access. Carries empty/undefined fields for broken plugins. | |

**User's choice:** Minimal arm
**Notes:** `info.ts` keeps independent lenient path-source re-derivation (quick task 260618-qkz), so the minimal arm does not regress it → D-64-05.

## Claude's Discretion

- Internal helper names, the shared render-helper shape, and whether the internal arm-factory helpers split into three — deferred to planning.

## Deferred Ideas

- `--force` install/update behavior — Phase 65.
- Derived force states, glyphs, will-force preview tokens — Phase 66.
- List filters, completion, reinstall-as-repair — Phase 67.
- Load-time backfill — Phase 68.
- Force-path notification severities — Phase 69.
