---
created: 2026-08-10
source: 98-REVIEW.md WR-12
---

# The `update` verb drops the malformed-frontmatter signal, so a degraded update renders a clean `(updated)` row

`update` stages through the SAME skills and commands bridges as install, enable
and reinstall — `prepareStageSkills` at
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1170` and
`prepareStageCommands` at `:1181` — and those bridges return the same
`result.degraded` record list when a source `SKILL.md` / command frontmatter
cannot be parsed by Pi's own `parseFrontmatter`. Nothing in `update.ts` reads it.

The signal has nowhere to go even if it were read:

- `PluginUpdateUpdatedOutcome` (`orchestrators/types.ts:144`) has no
  `degradedKinds` field.
- `PluginUpdatedMessage` (`shared/notify.ts`) has no `reasons` field, so the
  `(updated)` arm is the ONE `installedLikeRow` caller that passes `undefined`
  (see the WR-13 note on `installedLikeRow`).

## Not to be confused with `partialDegrade`

`PluginUpdateUpdatedOutcome` DOES carry a degradation signal — `partialDegrade`
(FSTAT-07 / D-66-04 / SEV-03 / D-69-01) — and a reader skimming the type will
think this is already handled. It is a different axis:

| Axis | Meaning | Update coverage |
| --- | --- | --- |
| `partialDegrade.kinds` | Component kinds DROPPED because the resolver returned `partially-available` | Covered — flips the row to `(partially-installed)` |
| `degradedKinds` | Component kinds INSTALLED but short, because their source frontmatter would not parse (WARN-01 / D-86-03) | **Missing** |

A dropped kind is absent from disk. A malformed kind is present on disk in
degraded form. The second is the one nothing reports.

## Repro

1. Install a plugin carrying a well-formed `skills/<name>/SKILL.md`.
2. In the marketplace source, replace that file's frontmatter with something
   unparseable (e.g. `name: [unterminated`) and move the pin so an update
   applies.
3. Run `/claude:plugin update <plugin>@<mp>`.

Observed: `● <plugin> vA → vB (updated)` at `info`, no reasons brace, no
summary line — while the skills bridge has written the synthesized
`disable-model-invocation` stub (`bridges/skills/frontmatter-degrade.ts:51`) to
disk. The plugin's skill is no longer model-invocable and the row that reported
the transition says nothing about it. `list` renders the record's state one
command later, which is the same contradiction class WR-09 closed for
`reinstall`.

## Why deferred

Pre-existing — it predates this phase's fix rounds and was not introduced by
them. The fix is not comment-sized: it needs an optional `reasons` on a THIRD
transition message variant, which is a rendered-vocabulary change and therefore
drags its catalog state, its UAT fixture and the style-guide amendment along
with it. That is the full WR-09 shape of work, and it arrived after the review
loop cap for this phase.

Deferring is safe in the sense that nothing regresses by waiting: the behavior
today is the behavior yesterday. It is NOT safe in the sense that the row is
untruthful while it waits — worth doing early in the next cycle rather than
letting it age.

## Where it lands

The milestone ends with this phase, so this belongs to the next milestone's
discuss step or a backlog review — there is no `resolves_phase` for it.

Work items:

1. `orchestrators/types.ts` — add `degradedKinds?: readonly DegradeKind[]` to
   `PluginUpdateUpdatedOutcome`, ideally by inheriting the shared
   `LedgerDegradationSignals` subset the install and enable arms already share
   rather than declaring a fresh field.
2. `orchestrators/plugin/update.ts` — collect the kinds off
   `handles.skills.result.degraded` / `handles.commands.result.degraded` at the
   success-outcome site, exactly as `reinstall.ts::successOutcome` does off its
   prepared handles.
3. `shared/notify.ts` — add the optional `reasons` to `PluginUpdatedMessage` and
   thread it in the central `renderPluginRow` `updated` arm.
4. `orchestrators/plugin/update.messaging.ts` — thread `p.reasons` in the
   command-local render map. **Do not skip this one**: the command-context map
   is what actually renders the verb's output, and WR-09 showed that fixing the
   central arm alone raises the severity while still dropping the brace.
5. `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` — a
   `update-degraded-component` state and its byte fixture.
6. `docs/messaging-style-guide.md` — extend the optional-`reasons` bullet from
   two variants to three.
7. Byte assertions through the public verb for both the degraded and the clean
   row (the clean one is the NREG-01 guard).

`reinstalledRowFromOutcome` in `orchestrators/plugin/reinstall.ts` is the direct
analog to copy — including the decision to make it the SOLE composer for its
row, so the standalone and cascade surfaces cannot drift.

One thing to settle while doing it: the trailing tally counts by stamped
severity, so a degraded bulk update will read `N warnings` rather than
`N successes`, as reinstall now does. That fell out of WR-09 rather than being
chosen; if it is wrong, it is wrong for both verbs and the lever is the tally,
not the row.
