---
schema: summary
quick_id: 260608-npa
slug: remove-readme-prose-reinstall-docs-test
date: 2026-06-08
status: complete
---

# Quick Task 260608-npa: Remove README-prose reinstall-docs test — Summary

## What changed

- **Removed** `tests/architecture/reinstall-docs.test.ts` — a docs-as-contract
  test that asserted 14 verbatim strings (exact example names + whole sentences)
  in `README.md`. It was brittle (broke on rewording) and had been red on the
  branch since the reinstall feature shipped (PR #14, 2026-05-16) because the
  README never grew the asserted section.
- **Re-tagged** `PRL-01` onto the existing behavior test that asserts the
  reinstall `Usage:` block: `tests/edge/handlers/plugin/reinstall.test.ts`
  (test title now prefixed `PRL-01:`). The other PRL IDs were already tagged on
  behavior tests; `PRL-01` was the only ID whose tag lived solely in the removed
  test.

## Why

Docs-as-contract testing is a legitimate, repo-wide pattern here (see
`catalog-uat` byte-binding `docs/output-catalog.md`), but it belongs on the
**spec doc + implementation**, not on README prose. The reinstall command's
forms, output bytes, and behavioral guarantees are already covered:

- behavior: `tests/orchestrators/plugin/reinstall.test.ts` (PRL-03/04/05/13/14/15)
- completion: `tests/edge/completions/provider.test.ts` (PRL-16)
- usage/registration: `tests/edge/handlers/plugin/reinstall.test.ts` (PRL-01) + `tests/edge/register.test.ts`
- output bytes: `docs/output-catalog.md` via `tests/architecture/catalog-uat.test.ts`

No new tests were authored — spec-based coverage already existed.

## Verification

- All 8 PRL IDs (01, 03, 04, 05, 13, 14, 15, 16) still resolve to a test file.
- `npm run check` exits 0 (1514 pass, 0 fail; typecheck + ESLint + Prettier +
  tests). Removing the test also cleared the only pre-existing red test on the
  branch.

## Self-Check: PASSED

- [x] `tests/architecture/reinstall-docs.test.ts` removed
- [x] `PRL-01` grep-able on the Usage-block behavior test
- [x] All 8 PRL IDs covered by spec/behavior tests
- [x] `npm run check` exits 0
