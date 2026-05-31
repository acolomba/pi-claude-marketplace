---
quick_id: 260515-tqx
type: quick
description: fix Phase 09 UAT gaps
created: 2026-05-15
---

# Quick Plan: Fix Phase 09 UAT gaps

## Goal

Close the actionable Phase 09 UAT gaps before milestone completion.

## Tasks

1. Add regression coverage for cross-scope reinstall marketplace source lookup and completion/docs expectations.
   - Files: `tests/orchestrators/plugin/reinstall.test.ts`, `tests/architecture/reinstall-docs.test.ts`, `tests/edge/completions/provider.test.ts`
   - Verify: focused tests fail before the implementation/docs changes and pass after.

2. Fix reinstall target enumeration so an explicit plugin install scope can use a marketplace source from another scope when needed.
   - Files: `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
   - Verify: focused reinstall orchestrator tests pass.

3. Document cross-scope marketplace source behavior and record quick-task summary/state.
   - Files: `README.md`, `.planning/quick/260515-tqx-fix-these-gaps/260515-tqx-SUMMARY.md`, `.planning/STATE.md`
   - Verify: docs test, focused Phase 9 tests, typecheck, and `npm run check` pass.

## Notes

- Install completion suggesting unavailable plugins is intentional per Phase 6 D-03 / future `--force`; do not change it in this quick fix.
- Unit coverage for `reinstall @` marketplace-only completion already passes. Add a prefix-specific regression for `reinstall @m` to pin the observed UAT case.
