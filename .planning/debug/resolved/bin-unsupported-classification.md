# Debug: bin-shipping plugin blocked at install with misleading `{unsupported source}` reason

**Found during:** Phase 90 UAT (Test 2 setup, 2026-08-03). Gap G-90-3 in
`.planning/phases/90-session-environment-initialization/90-UAT.md`.

## Symptom

Installing `bin-tool@penv-uat-mkt` (a path-source plugin whose only payload is
`bin/hello-penv`) fails by default:

```
● penv-uat-mkt [user]
  ⊖ bin-tool (partially-available) {unsupported source}
    Re-run with --partial to install the supported components.
```

The source is a plain relative path (`./plugins/bin-tool`) — a fully supported
source kind — so `{unsupported source}` mislabels the actual problem.
`--partial` unblocks the install, and afterwards the PENV-01 PATH cycle works
end-to-end (bin dir appended, `hello-penv` resolves, uninstall + `/reload`
removes the entry cleanly).

## Root cause (two coupled halves)

1. **Stale classification.** `domain/resolver.ts:347-371` lists `bin` in
   `UNSUPPORTED_COMPONENT_KINDS`, with a convention probe on the `bin/` dir
   (`UNSUPPORTED_COMPONENT_CONVENTIONS.bin`). A bin-shipping plugin therefore
   resolves `partially-available`, and install's default gate blocks it with
   the `--partial` hint. This predates PENV-01; since PENV-01
   (`orchestrators/plugin-path.ts::collectBinDirs` +
   `shared/session-env.ts::applyPathLedger`) the runtime appends
   `<resolvedSource>/bin` for every enabled installed record — bin dirs are
   honored, so "unsupported" no longer reflects reality. Claude Code 2.1.212
   installs bin-shipping plugins without friction (verified in phase 90
   research), so this is also an upstream-parity gap.

2. **Reason-token collapse.** `shared/probe-classifiers.ts::kindToReason`
   (line 204) maps only `lspServers → lsp` and `hooks → unsupported hooks`;
   every other kind (`bin`, `monitors`, `themes`, `outputStyles`, `channels`,
   `userConfig`, `settings`) deliberately collapses to the generic
   `unsupported source` marker (TD-3 note). Install's
   `narrowResolverReasons` (`orchestrators/plugin/install.ts:2240`) inherits
   the same fallback, so the failure row lies about the axis of the problem.

## Fix directions (for gap-closure planning)

- Reclassify `bin` as a supported component kind: remove it from
  `UNSUPPORTED_COMPONENT_KINDS` + its convention probe so a bin-shipping
  plugin resolves `installable` (its bin/ needs no staging — PENV-01 PATH
  injection is derived from install state, not from a staged artefact).
  Ripple: list/info/install surfaces, resolver tests, PRD component-support
  matrix, T-02-25 closed-list audit note.
- Give non-carve-out unsupported kinds an accurate reason marker instead of
  the `unsupported source` fallback. New tokens are closed-set REASONS
  catalog amendments (docs/output-catalog.md) and must stay byte-identical
  across the install/list/info surfaces (SURF-01).

## Resolution

Fixed and confirmed live 2026-08-04. Both coupled halves of the root cause are
closed:

1. **Stale classification (90-02, D-90-06).** `bin` was reclassified out of
   `UNSUPPORTED_COMPONENT_KINDS` (with its convention probe removed), so a
   bin-shipping plugin now resolves `installable` and installs by DEFAULT — no
   `--partial` required — matching Claude Code 2.1.212 parity and the PENV-01
   runtime PATH injection.
2. **Reason-token collapse (90-02 D-90-05 + 90-03 SURF-01).** Dropped
   non-carve-out kinds now render the `{unsupported component}` token
   (D-90-05); and 90-03 made install's `narrowResolverReasons` arm-aware
   (`partialable` discriminant, WR-01 Option 2) so a `contains <kind>` note on
   the structural `unavailable` arm renders `{unsupported source}`
   byte-identically across install/list/info (SURF-01, D-64-07), while the
   partially-available per-kind `{unsupported component}` axis is unchanged.

Live-Pi retest (UAT Test 3, G-90-3) passed: bin-only plugin installs by
default; a non-carve-out kind renders `{unsupported component}` on
install/list/info; the both-defects case renders byte-identical
`{unsupported source}` across surfaces. G-90-3 marked resolved.
