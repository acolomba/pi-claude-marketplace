# Roadmap: pi-claude-marketplace — defaults-enabled (defaultEnabled Manifest Field)

## Milestones

- ✅ **defaults-enabled defaultEnabled Manifest Field** — Phases 101-105 (shipped 2026-08-15) — full detail: `.planning/milestones/defaults-enabled-ROADMAP.md`
- ✅ **v1.18 Manifest-Independent Installed Plugin Info** — Phases 95-100 (shipped 2026-08-12, npm 0.14.0) — full detail: `.planning/milestones/v1.18-ROADMAP.md`

Earlier milestones (v1.0-v1.17, url-source, force-install, fetch-plugin,
agent-skill-preloads) are archived under `.planning/milestones/` and indexed in
`.planning/MILESTONES.md`.

## Phases

<details>
<summary>✅ defaults-enabled — defaultEnabled Manifest Field (Phases 101-105) — completed 2026-08-15</summary>

- [x] Phase 101: Manifest field and precedence resolution (3/3 plans) — completed 2026-08-14
- [x] Phase 102: Reason token, install write-through and notification (3/3 plans) — completed 2026-08-15
- [x] Phase 103: Reconcile stability and lifecycle non-reapplication (6/6 plans) — completed 2026-08-15
- [x] Phase 104: Pre-install read surfaces (5/5 plans) — completed 2026-08-15
- [x] Phase 105: No-op parity sweep and contract documentation (6/6 plans) — completed 2026-08-15

Full phase detail, requirement coverage and the milestone summary are archived in
`.planning/milestones/defaults-enabled-ROADMAP.md`. The requirements register for
this milestone is `.planning/milestones/defaults-enabled-REQUIREMENTS.md`, and the
close-out audit is `.planning/milestones/defaults-enabled-MILESTONE-AUDIT.md`.

</details>

## Outcome

A plugin author can ship a plugin that installs disabled (`defaultEnabled: false`),
and nothing later re-enables it behind the user's back — not the next `/reload`,
not an `update`, not a `reinstall`. `list` and `info` say so before the install is
run, offline. Plugins that declare `true`, or declare nothing, behave
byte-identically to before the milestone across all six surfaces.

The enablement contract, including the two divergences this milestone deliberately
does not close, is written down in `docs/plugin-enablement.md`.

All 15 requirements satisfied · 5/5 phases verified by mutation · 0 cross-phase
integration blockers · `npm run check` green.
