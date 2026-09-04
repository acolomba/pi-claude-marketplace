# Clean-list repair report

Repairs the missing/incomplete `### Clean files` lists across
`unit-test-findings/*.md` so the second review pass has complete,
accurate input. Scope: files under `unit-test-findings/` only; no
`tests/` or `extensions/` files were touched, and no commands were run
beyond read-only `grep`/`sed`/`python3` inspection of this directory.

## Method

1. Confirmed the deficient-file list by counting `^### Clean files`
   headings in every reviewer file (excluding `_AUDIT.md` and
   `_ADVERSARIAL-BRIEF.md`). This reproduced exactly the 9 files named in
   the assignment: 2 with zero headings, 7 with one.
2. For each deficient file, reconstructed the missing list from the
   file's own `**Scope:**`/`**Test files reviewed:**`/`**Production
   modules reviewed:**` declarations and its per-file `###` finding
   blocks: clean set = declared scope minus files carrying a `[BLOCKER]`/
   `[WARNING]` finding or a "No findings"/"Clean." prose verdict was
   honored explicitly.
3. Ran an automated cross-check (path extraction + set arithmetic) over
   all 45 files to look for two failure modes beyond the given list:
   (a) a Clean-files total that doesn't reconcile with the declared
   scope count, and (b) a path appearing in both a finding heading and
   the Clean list. Investigated every flagged file by hand.

## Files repaired (the 9 known-deficient files)

| File | List added | Entries |
|---|---|---|
| `bridges-hooks-async-rewake.md` | Unit + Production (both were missing) | 1 + 1 (`ring-buffer.test.ts` / `ring-buffer.ts`, both already stated "Clean." in prose) |
| `transaction.md` | Unit + Production (both were missing) | 1 + 2 (`rollback.test.ts`; `phase-ledger.ts`, `rollback.ts` — all three already stated "No findings" in prose) |
| `architecture-state-drift-gates.md` | Unit (Production already present) | 1 (`compat-01-no-expansion.test.ts`, explicit "No findings — model for the rest of the area") |
| `bridges-commands.md` | Production (Unit already present) | 3 (`unstage.ts`, `types.ts`, `index.ts`, each explicit "Clean." in prose) |
| `bridges-hooks-dispatch.md` | Unit (Production already present) | 0 — all three reviewed test files carry a finding; recorded as `None — ...` with the three file names, following the existing "None" convention already used elsewhere in this corpus (see `orchestrators-plugin-list-uninstall.md`) |
| `bridges-hooks-if-field.md` | Unit (Production already present) | 0 — all three reviewed test files carry a finding; recorded as `None — ...` |
| `domain-components-hooks.md` | Unit (Production already present) | 0 — all three reviewed test files carry a finding; recorded as `None — ...`, also noting the extra cross-check file (`no-hooks-strict-additional-properties.test.ts`) also carries a finding |
| `orchestrators-plugin-install.md` | Production (Unit already present) | 0 — the one in-scope production module (`install.ts`) carries findings; recorded as `None — ...` |
| `orchestrators-plugin-reinstall.md` | Production (Unit already present) | 0 — the one in-scope production module (`reinstall.ts`) carries findings; recorded as `None — ...` |

Total new clean-file entries added across the 9 files: **9** (`ring-buffer.test.ts`,
`ring-buffer.ts`, `rollback.test.ts`, `phase-ledger.ts`, `rollback.ts`,
`compat-01-no-expansion.test.ts`, `unstage.ts`, `types.ts`, `index.ts`).
Four of the nine lists are legitimately empty (`None`) because every file
in that section's scope carries at least one finding — this is recorded
explicitly rather than left blank, matching the project's own existing
"None — ..." convention.

No file required a `## Not covered` addition for indeterminate status:
in every one of the 9 deficient files, each in-scope file's clean/not-clean
status was either stated explicitly in prose ("Clean.", "No findings") or
directly inferable from the presence/absence of a `[BLOCKER]`/`[WARNING]`
finding block, so no confidence gap arose.

## Accuracy fix found outside the known-deficient set

`edge-handlers-plugin.md` already had both `### Clean files` headings
(so it did not fail the heading-count check), but its Production
Clean-files list was factually wrong: `enable-disable.ts`, `uninstall.ts`,
`update.ts`, and `reinstall.ts` were listed as clean with no caveat, even
though the file's own `[WARNING]` finding ("Orchestrator reached by
direct import, not by an injected dependency") explicitly names all four
as carrying that finding. This is different from the "clean (aside from
the cross-cutting notes above)" caveat pattern used correctly elsewhere
in this corpus (e.g. `architecture-boundary-gates.md`,
`orchestrators-plugin-list-uninstall.md`) — here there was no caveat at
all, so the list was silently misleading. Removed the four wrong entries,
leaving only `bootstrap.ts` (the one file the finding explicitly excludes
as the comparison case of what the other nine should look like).

This is the only such silent contradiction found; the automated
cross-check's other flags (on `architecture-boundary-gates.md`,
`platform.md`, `orchestrators-plugin-list-uninstall.md`,
`orchestrators-reconcile-apply.md`, `bridges-hooks-adapters-state.md`,
`orchestrators-plugin-support.md`, and others) were investigated and
confirmed to be self-documenting, intentional "clean, aside from the
finding(s) already listed above" bullets, or artifacts of bare-filename
vs. full-path mentions inside prose — not real defects. Those files were
left untouched.

## Note on `META-FINDINGS.md`

This file was not present when the repair pass started enumerating
`unit-test-findings/*.md` (it appears to have finished writing partway
through this pass) and was not in the original file list. It is a
cross-cutting synthesis file ("Cross-cutting conclusions ... Nothing here
comes from a single reviewer"), not a per-area reviewer file — it has no
`**Scope:**`/`**Test files reviewed:**` header and no per-file `###`
finding blocks under `## Unit test findings`/`## Production code
findings`. It was left untouched, the same as `_AUDIT.md` and
`_ADVERSARIAL-BRIEF.md`.

## Files marked indeterminate

None. Every clean-list entry added or removed in this pass was backed by
an explicit statement in the source file (an existing finding block, or
explicit "Clean."/"No findings" prose) — no file's status required
guessing, so no `## Not covered` entries were introduced.
