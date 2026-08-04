---
created: 2026-08-04T13:08:58.777Z
title: "Fix applyPathLedger empty-segment stripping of non-owned PATH"
area: general
severity: major
files:
  - extensions/pi-claude-marketplace/shared/session-env.ts:90-96
  - tests/shared/session-env.test.ts
---

## Problem

Found by the Phase 90 code review refresh (90-REVIEW.md, WARNING WR-01,
2026-08-04). `applyPathLedger` (extensions/pi-claude-marketplace/shared/
session-env.ts:90-96) strips empty PATH segments from NON-OWNED PATH content
on every recompute, contrary to its own contract of never touching a
non-owned entry. The strip fires unconditionally — including the zero-plugin
case — and recompute runs on every `resources_discover`, so any empty
segment a user (or another tool) had in PATH is silently dropped each
session. An empty PATH segment is meaningful on POSIX (it denotes the
current directory), so this is a real, if rare, user-visible mutation of
content the ledger does not own. Undocumented and untested either way.

Related (INFO IN-01, same seam, likely fixed together): the
delimiter-joined `PI_CLAUDE_MARKETPLACE_PATH` ledger cannot round-trip a
bin dir containing `path.delimiter`; `asAbsolutePluginRoot` does not reject
such a path, so an entry containing the delimiter would leak fragments on
cleanup.

## Solution

Either preserve empty segments through the split/filter/join round-trip
(treat them as non-owned content and pass them through byte-identical), or
keep the drop but promote it to an explicit, documented, and tested
hardening decision. While in the seam, consider rejecting
delimiter-containing bin dirs in `asAbsolutePluginRoot` to close IN-01.
Pin whichever contract is chosen in tests/shared/session-env.test.ts.
