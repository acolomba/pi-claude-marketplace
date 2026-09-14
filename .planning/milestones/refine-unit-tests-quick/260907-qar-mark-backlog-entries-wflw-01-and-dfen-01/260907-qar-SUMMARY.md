---
quick_id: 260907-qar
status: complete
date: 2026-09-07
branch: features/backlog-close-shipped
commit: 32396cff
files_modified:
  - .planning/BACKLOG.md
---

# Summary: close two shipped backlog entries

## What was done

WFLW-01 and DFEN-01 in `.planning/BACKLOG.md` now read as closed. Both use
the file's existing `~~heading~~ -- CLOSED` convention, carry a closure
paragraph naming the commit and date, and keep their original report under
`Original report follows.`

| Entry | Shipped by | Date |
|---|---|---|
| WFLW-01 | `872b2d34` "feat: detect unsupported workflow components" (#154) | 2026-08-29 |
| DFEN-01 | `8992d850` "feat: honor defaultEnabled so a plugin can install disabled" (#130) | 2026-08-19 |

Both closures record that the shipped fix went past what the entry proposed.
That is the part worth keeping: a reader who trusts the "Direction for later"
paragraph alone would understate what is in the tree.

- **WFLW-01** got the closed-list entry it asked for
  (`domain/resolver.ts:388`), plus a conventional-path probe for a bare
  `<pluginRoot>/workflows/` directory (`:403`), plus a dedicated `workflows`
  token in the closed `REASONS` set (`shared/notify.ts:237`, D-106-04 /
  WDET-04) rather than the generic `{unsupported component}`, plus the schema
  field (`domain/components/plugin.ts:45`).
- **DFEN-01** got the whole precedence rule, not only the field.
  `resolveDefaultEnabled` (`domain/resolver.ts:751`) puts the marketplace
  entry over the manifest; `install.ts::readDeclaredEnabled` puts an explicit
  user `enabled` over both, in either direction. The resolved value is
  non-optional on the materializable arms (`:201`), and `list` / `info` share
  one `rowClaimsInstallDisabled` predictor.

## Deviations from plan

None on the task itself. One on the workflow: the planner and executor
subagents were not dispatched. The session forbids subagent dispatch without
an explicit request, and the task is a two-entry documentation edit, so it ran
inline. The artifacts the workflow expects (PLAN, SUMMARY, STATE row, atomic
commits, feature branch) were produced anyway.

`init.quick` returned `branch_name: null`, which would have left the work on
`main`. CLAUDE.md forbids that, so `features/backlog-close-shipped` was created
explicitly off `main`.

## Verification

- Every claim came from a source read, not from changelog prose:
  `resolver.ts:388`, `:403`, `:201`, `:692`, `:751`; `notify.ts:237`;
  `probe-classifiers.ts:216`; `plugin.ts:45`; `install.ts:1503`.
- `## ` heading count unchanged at 49. The diff is two hunks and 64
  insertions; the only two deleted lines are the two old headings. Both
  original "Direction for later" paragraphs are still present.
- `pre-commit run --files` clean. `.planning/**` is outside the mdformat and
  markdownlint hooks, so nothing reflowed.
- Only `.planning/BACKLOG.md` was staged. The three unrelated modified files
  in the working tree (`.claude/settings.json`, `.mdformat.toml`,
  `.pre-commit-config.yaml`) are untouched and still unstaged.

## Follow-on

Spot checks during the same sweep confirm these are genuinely still open, so
no further closures are pending: FMBOM-01 (no BOM strip at either read site),
GAUTH-01 (`NO_PROVIDER_CAUSE` still at one call site), PDEP-01
(`normalizeDependencies` still filters to strings), UDISP-01 (no
`--keep-data`), HKDIR-01 (`event-router.ts:744` still gates cross-scope).
