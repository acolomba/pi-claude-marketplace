---
phase: quick-260804-gcs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - extensions/pi-claude-marketplace/domain/plugin-root.ts
  - tests/shared/plugin-path.test.ts
  - tests/domain/plugin-root.test.ts
autonomous: true
requirements: [PENV-01]

estimate:
  tokens: 45000
  raw_tokens: 30000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - A PATH carrying empty segments (leading `:`, trailing `:`, or `::`) survives a
      zero-plugin recompute byte-identical (PENV-01 non-interference contract).
    - Only ledger-owned entries are removed on recompute; every non-owned segment,
      empty or not, is preserved verbatim through split/join.
    - Appending a fresh bin dir to a previously-empty PATH does not introduce a
      spurious leading empty segment.
    - asAbsolutePluginRoot rejects a root containing path.delimiter, so a
      delimiter-bearing root can never enter the PI_CLAUDE_MARKETPLACE_PATH ledger
      and leak fragments on cleanup.
  artifacts:
    - extensions/pi-claude-marketplace/shared/session-env.ts (applyPathLedger preserves non-owned empty segments)
    - extensions/pi-claude-marketplace/domain/plugin-root.ts (delimiter rejection)
    - tests/shared/plugin-path.test.ts (empty-segment preservation tests)
    - tests/domain/plugin-root.test.ts (delimiter-rejection test)
  key_links:
    - applyPathLedger splits currentPath empty-preserving but the ledger empty-filtered
    - asAbsolutePluginRoot delimiter check feeds collectBinDirs' existing catch-and-drop
---

<objective>
Fix `applyPathLedger` so it stops mutating non-owned PATH content, and harden
`asAbsolutePluginRoot` so a delimiter-bearing plugin root cannot corrupt the
PATH ledger.

Two defects in the PENV-01 plugin-PATH seam, found by the Phase 90 code-review
refresh:

1. **Primary (empty-segment stripping).** `applyPathLedger`'s `split` helper
   filters `entry.length > 0`, so every empty PATH segment (a leading `:`,
   trailing `:`, or `::` — the POSIX implicit-current-directory form) is dropped
   when `base` is rebuilt and never restored. This fires on EVERY
   `resources_discover`, including the zero-plugin case, silently mutating
   content the ledger's own contract promises never to touch ("Remove exactly
   the prior-ledger entries from PATH (never touch a non-owned entry)").

2. **Secondary (delimiter round-trip).** The ledger is a single
   delimiter-joined string in `PI_CLAUDE_MARKETPLACE_PATH`. A plugin root
   containing `path.delimiter` (`:` is a legal POSIX filename character) cannot
   round-trip the join/split, so its stale entry cannot be matched-and-removed
   on the next recompute and leaks on the plugin's removal. `asAbsolutePluginRoot`
   guards empty/relative/null-byte/traversal roots but not an embedded delimiter.

Chosen direction (aligned with the function's own contract): preserve non-owned
PATH content byte-identical through the split/filter/join round-trip — remove
only segments the ledger owns — and reject delimiter-containing roots at the
single validation choke point so `collectBinDirs`' existing catch-and-drop keeps
them out of the ledger.

Purpose: honor PENV-01's non-interference contract (the extension only ever
APPENDS its own absolute bin dirs and removes its own owned entries — it never
sanitizes or rewrites the user's PATH) and eliminate a ledger corruption vector.
Output: two surgical source changes plus tests pinning both contracts.

**Test-location note (deviation from the todo's literal filename):** the todo
says "pin both contracts in `tests/shared/session-env.test.ts`", but that file
is scoped to `applySessionEnv` only — the `applyPathLedger` contract tests all
live in `tests/shared/plugin-path.test.ts` and the `asAbsolutePluginRoot` tests
in `tests/domain/plugin-root.test.ts`. New tests are co-located with the
existing contract they extend rather than fragmenting the suite. This matches
"existing test conventions for this seam".
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/todos/pending/2026-08-04-fix-applypathledger-empty-segment-stripping-of-non-owned-pat.md

# Code under fix
@extensions/pi-claude-marketplace/shared/session-env.ts
@extensions/pi-claude-marketplace/domain/plugin-root.ts

# Existing contract tests (extend these, do not create new files)
@tests/shared/plugin-path.test.ts
@tests/domain/plugin-root.test.ts

# Comment policy — no phase/plan/wave/review-ID historical narrative in
# comments or test titles; requirement/decision IDs (PENV-01, D-90-*) are OK.
@.claude/rules/typescript-comments.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Preserve non-owned empty PATH segments in applyPathLedger</name>
  <files>extensions/pi-claude-marketplace/shared/session-env.ts, tests/shared/plugin-path.test.ts</files>
  <behavior>
    Add these tests to tests/shared/plugin-path.test.ts, alongside the existing
    applyPathLedger tests (import `delimiter` from node:path is already present):
    - Zero-plugin round-trip preserves `::`: applyPathLedger("/usr/bin::/bin", "", [])
      returns path === "/usr/bin::/bin" (byte-identical) and ledger === "".
    - Leading empty segment preserved: applyPathLedger(":/usr/bin", "", []) returns
      path === ":/usr/bin".
    - Trailing empty segment preserved: applyPathLedger("/usr/bin:", "", []) returns
      path === "/usr/bin:".
    - Owned entry removed while a neighboring empty segment survives:
      applyPathLedger("/usr/bin::/a/bin", "/a/bin", []) returns path === "/usr/bin:"
      (the empty segment stays, only the owned "/a/bin" is removed) and ledger === "".
    - Empty PATH string is zero entries, not one empty segment: applyPathLedger("", "",
      ["/a/bin"]) returns path === "/a/bin" (NOT ":/a/bin") and ledger === "/a/bin".
    - Empty segment preserved while appending a fresh dir:
      applyPathLedger("/usr/bin::/bin", "", ["/a/bin"]) returns
      path === "/usr/bin::/bin:/a/bin".
    Build the expected PATH strings with `delimiter` join where practical, mirroring
    the existing tests' style. Titles describe the behavior (empty-segment
    preservation); do not embed review/phase IDs — PENV-01 is an acceptable anchor.
  </behavior>
  <action>
    In applyPathLedger (extensions/pi-claude-marketplace/shared/session-env.ts),
    split the two inputs differently. Keep the empty-filter for the LEDGER only:
    build the `owned` set from priorLedger split on path.delimiter with the
    `entry.length > 0` filter — the ledger only ever records absolute, non-empty
    bin dirs, and this maps an empty ledger string to the empty owned-set. Split
    `currentPath` WITHOUT dropping empty segments, treating a whole-PATH empty
    string as zero entries: if currentPath === "" use an empty array, otherwise
    currentPath.split(path.delimiter); then filter out only entries present in
    `owned`. Because owned entries are always non-empty, an empty segment can
    never match and always survives, so `[...base, ...appended].join(path.delimiter)`
    reconstructs every non-owned segment byte-identical. Leave the fresh-dir dedupe
    (`seen`/`appended`) and the append-never-prepend behavior unchanged. Update the
    function's doc comment so it states that empty PATH segments are non-owned
    content preserved verbatim and that a whole-PATH empty string is treated as
    zero entries (so appending never introduces a spurious leading segment).
    Follow the comment policy: describe what/why, no phase/plan/review-ID narrative.
  </action>
  <verify>
    <automated>node --test tests/shared/plugin-path.test.ts</automated>
  </verify>
  <done>
    The six new behaviors pass and all pre-existing applyPathLedger /
    recomputePluginPath tests in the file still pass. A zero-plugin recompute
    over a PATH containing empty segments returns it byte-identical; owned entries
    are still removed; an empty PATH gains no leading empty segment on append.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Reject path.delimiter in asAbsolutePluginRoot</name>
  <files>extensions/pi-claude-marketplace/domain/plugin-root.ts, tests/domain/plugin-root.test.ts</files>
  <behavior>
    Add one test to tests/domain/plugin-root.test.ts alongside the existing
    asAbsolutePluginRoot throw tests. Import `delimiter` from node:path. Assert
    asAbsolutePluginRoot(`/tmp/a${delimiter}b`) throws with a message matching
    /delimiter/ (the path is absolute on both POSIX and Windows via a leading
    slash, and contains the platform delimiter — `:` on POSIX, `;` on Windows).
    Title describes the behavior (rejects a root containing the PATH delimiter);
    no review/phase IDs.
  </behavior>
  <action>
    In asAbsolutePluginRoot (extensions/pi-claude-marketplace/domain/plugin-root.ts),
    add a rejection for a root containing path.delimiter, placed after the null-byte
    check and before the isAbsolute check (both null-byte and delimiter are
    content checks independent of absoluteness). Throw a descriptive Error whose
    message names the delimiter and echoes the offending value, matching the style
    of the existing throws. This is consistent with the existing malformed-root
    family: both callers already catch-and-drop asAbsolutePluginRoot throws —
    collectBinDirs (orchestrators/plugin-path.ts) via its try/catch and the hooks
    hydrate site (bridges/hooks/event-router.ts) via its try/catch — so a
    delimiter-bearing root is dropped exactly like an empty/relative/null-byte one
    and can never enter the delimiter-joined PATH ledger. Extend the function's
    doc comment to list the new rejection reason and why (the delimiter-joined
    PI_CLAUDE_MARKETPLACE_PATH ledger cannot round-trip a segment containing the
    delimiter). Comment policy: what/why only, no planning-artifact narrative.
  </action>
  <verify>
    <automated>node --test tests/domain/plugin-root.test.ts</automated>
  </verify>
  <done>
    asAbsolutePluginRoot throws on a delimiter-bearing absolute path; all
    pre-existing plugin-root tests still pass. A delimiter-bearing resolvedSource
    is therefore dropped by collectBinDirs and by the hooks hydrate site.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| state.json → process.env.PATH | `resolvedSource` (only `Type.String()` on disk) composes bin dirs appended to the live PATH inherited by every bash child. |
| user/other-tool PATH → recompute | Pre-existing PATH content flows through applyPathLedger on every `resources_discover`. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-gcs-01 | Tampering | applyPathLedger (session-env.ts) | low | mitigate | Preserving a non-owned empty PATH segment is a byte-identical pass-through of pre-existing user content, not an entry the extension injects; the extension only ever APPENDS its own absolute bin dirs and removes its own owned entries. Fixes silent mutation of non-owned content. |
| T-gcs-02 | Tampering | asAbsolutePluginRoot (plugin-root.ts) | low | mitigate | Reject a root containing `path.delimiter` so a delimiter-bearing `resolvedSource` cannot corrupt the delimiter-joined ledger and leak a stale fragment onto PATH on cleanup; dropped consistently with the existing empty/relative/null-byte/traversal guards. |
</threat_model>

<verification>
- `node --test tests/shared/plugin-path.test.ts` and
  `node --test tests/domain/plugin-root.test.ts` both pass with the new cases.
- Full quality bar green: `npm run check` (typecheck + ESLint + Prettier +
  `npm test` + integration). No pre-existing applyPathLedger, recomputePluginPath,
  or asAbsolutePluginRoot test regresses.
- Comments and test titles carry no phase/plan/wave/review-ID historical narrative
  (per .claude/rules/typescript-comments.md); PENV-01 / D-90-* anchors are allowed.
</verification>

<success_criteria>
- applyPathLedger preserves non-owned empty PATH segments byte-identical through
  the split/join round-trip and treats a whole-PATH empty string as zero entries.
- Only ledger-owned entries are removed on recompute (existing cleanup /
  idempotency behavior unchanged).
- asAbsolutePluginRoot rejects a root containing `path.delimiter`, closing the
  ledger-round-trip leak; both callers drop such a root.
- Both contracts are pinned by tests co-located with their existing suites.
- `npm run check` is green.
</success_criteria>

<output>
Create `.planning/quick/260804-gcs-fix-applypathledger-non-owned-path-strip/260804-gcs-SUMMARY.md` when done.
</output>
