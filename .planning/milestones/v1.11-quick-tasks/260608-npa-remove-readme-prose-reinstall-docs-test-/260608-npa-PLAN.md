---
schema: plan
quick_id: 260608-npa
slug: remove-readme-prose-reinstall-docs-test
date: 2026-06-08
---

# Quick Task 260608-npa: Remove README-prose reinstall-docs test

## Objective

Delete the brittle README-prose contract test
`tests/architecture/reinstall-docs.test.ts` and rely on the already-existing
spec-based and behavior-based coverage. The test asserted 14 verbatim strings
(including exact example plugin/marketplace names and whole sentences) in
`README.md`, which couples the suite to documentation phrasing rather than
behavior. It had been red on the branch since the reinstall feature shipped
(PR #14, 2026-05-16) because the README never grew the asserted section.

## Why this is safe (coverage already exists)

The 8 requirements the README test claimed are covered elsewhere:

| Req | Covered by |
|-----|------------|
| PRL-03/04/05/13/14/15 | `tests/orchestrators/plugin/reinstall.test.ts` (behavior) |
| PRL-16 | `tests/edge/completions/provider.test.ts` (tab completion) |
| PRL-01 | `tests/edge/handlers/plugin/reinstall.test.ts` (Usage: block assertion) + `tests/edge/register.test.ts` (command wiring) |

The reinstall *output* forms are byte-bound in the spec doc
`docs/output-catalog.md` (`## /claude:plugin reinstall`) and verified by
`tests/architecture/catalog-uat.test.ts`. So command forms, output, and
behavioral guarantees (offline/cached, version-pinned, scope reporting,
atomic-replace ordering) are all tested against the spec and the
implementation — not README prose.

## Tasks

### Task 1: Tag PRL-01 onto the behavior test that asserts the Usage: block

`PRL-01` ("top-level command with a clear `Usage:` block") was only *tagged* in
the removed test. Add the `PRL-01:` prefix to the existing reinstall handler
test that already asserts `/Usage: \/claude:plugin reinstall/`, keeping the
requirement ID grep-able.

- File: `tests/edge/handlers/plugin/reinstall.test.ts`
- Acceptance: `grep -rln "PRL-01" tests/` returns the handler test.

### Task 2: Remove the README-prose contract test

- `git rm tests/architecture/reinstall-docs.test.ts`
- Acceptance: file gone; all 8 PRL IDs still resolve to a test; `npm run check`
  exits 0.

## must_haves

- truths:
  - `tests/architecture/reinstall-docs.test.ts` no longer exists.
  - Every `PRL-0{1,3,4,5}` / `PRL-1{3,4,5,6}` ID resolves to at least one test file.
  - `npm run check` exits 0.
- artifacts:
  - none created (test removal + one test-name retag).
- key_links:
  - reinstall behavior/forms → `tests/orchestrators/plugin/reinstall.test.ts`
  - reinstall output bytes → `docs/output-catalog.md` via `tests/architecture/catalog-uat.test.ts`
