# Phase 1 — Review Disposition

One row per finding in `01-REVIEW.md` (2 critical, 5 warnings, 6 info).
Fix details and checks are in `01-REVIEW-FIX.md`.

| Finding | Severity | Disposition | Commit | Note |
|---------|----------|-------------|--------|------|
| CR-01 | critical | fixed | 2091dd3 | `PIN_FIELDS` derives from the refresh's field tuple; `restorePin` keeps absent fields absent |
| CR-02 | critical | fixed | 0089265 | built-in `toolNamePrefix` returns `undefined` above 55 characters; harness matches full names then |
| WR-01 | warning | fixed | 131b5a4 | legacy reader refuses `version-mismatch` |
| WR-02 | warning | fixed | 10d360e | `replaceCompatibility` clears `compatibilityBasis` in every writer |
| WR-03 | warning | fixed | 7d477a8 | `recordedMcpServers` logs an unreadable reader failure |
| WR-04 | warning | fixed | e301836 | built-in status reader takes `getAllTools` as well |
| WR-05 | warning | fixed | 973af0a | `stubPidsIn` treats a vanished pid file as an exited stub |
| IN-01 | info | deferred | — | tag-reason ID pattern; no scenario slips through today |
| IN-02 | info | deferred | — | three `configuration.feature` installs accept any non-error result (Phase 2 owns the file) |
| IN-03 | info | deferred | — | numeric server names lose merge order (JavaScript key order) |
| IN-04 | info | deferred | — | `readBuiltinTurnedOff` reads project settings regardless of trust |
| IN-05 | info | fixed | 13ce40a | stale fallow `ignoreExports` entries removed |
| IN-06 | info | deferred | — | the info handler's trust read cannot fail on a constant `true` (P1-DC-37) |
