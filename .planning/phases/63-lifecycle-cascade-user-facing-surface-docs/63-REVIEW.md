---
phase: 63-lifecycle-cascade-user-facing-surface-docs
reviewed: 2026-06-16T22:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
  - tests/bridges/hooks/symlink-escape.test.ts
  - tests/bridges/hooks/stage.test.ts
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - tests/domain/components/hooks.test.ts
  - tests/fixtures/hookify-hooks.json
  - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
  - tests/orchestrators/marketplace/cascade.test.ts
  - tests/transaction/lifecycle-cascade.test.ts
  - README.md
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 63 Re-Review (post-63-08 gap closure)

**Reviewed:** 2026-06-16
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found
**Scope:** Re-review of the three files touched by plan 63-08 — CR-01 gap
closure for the symlink-escape walker. The full Phase 63 surface (30 files)
was already reviewed in the prior pass; only delta and regressions are
covered here.

## Summary

Plan 63-08 closes CR-01 from the prior review. The walker in
`assertNoSymlinkEscapeInHooksSubtree` has been rewritten from a single
`readdir({ recursive: true, withFileTypes: true })` call to a hand-rolled
explicit stack walk that calls `readdir` ONE LEVEL at a time and uses
`lstat` to classify each entry. Symlink entries are never pushed onto the
walk stack, so the walker provably never issues an `fs` call against a
path outside `<pluginRoot>/hooks/`. The `SymlinkRefusedError` rejection
contract (D-17 / PI-14, subclass of `PathContainmentError`, narrower
discriminator preserved) is unchanged — `assertSymlinkEntryContained`
still routes through `assertPathInside` and translates a bare
`PathContainmentError` to a `SymlinkRefusedError` carrying the in-tree
`linkPath` as both label-subject and `linkPath` field. The new Case A
test in `symlink-escape.test.ts` actively asserts both halves of the
guarantee: (i) the rejection SUBJECT is the in-tree path
`<pluginRoot>/hooks/sub/escape`, and (ii) no externalDir-resident
sentinel filename leaks into the error message — proving the walker
never enumerated the external tree. The `HOOKS_VALUE` fixtures in both
test files have also been corrected to the schema-valid top-level
event-keys shape (WR-05 from the prior review is resolved as a
side-effect — see "Resolved findings" below).

Two warnings remain after the rewrite. The walker introduces a mid-walk
ENOENT propagation hazard (a concurrent file removal between `readdir`
and `lstat` crashes `writeHookConfig` instead of degrading cleanly), and
the inline duplication of the `readSymlinkTarget` helper drifts from the
single-source-of-truth pattern in `shared/path-safety.ts`. One info
finding flags that `assertSymlinkEntryContained`'s reliance on
`assertPathInside`'s `PathContainmentError`-to-`SymlinkRefusedError`
translation is load-bearing on macOS (where `mkdtemp` produces a
`/var/folders/.../` symlink to `/private/var/folders/.../`) but the
translation path is not directly covered by a test, so a future
refactor of `assertPathInside` could silently regress it.

## Resolved findings from prior review

### CR-01 — CLOSED

**Prior finding:** `assertNoSymlinkEscapeInHooksSubtree` follows symlinks
to directories before rejecting; `readdir({ recursive: true })` enumerates
external tree contents before reaching the symlink-entry rejection point.

**Verification:**
- `stage.ts:67-108` — the walker now uses an explicit `stack: string[]`
  seeded with `hooksRoot`, calls `readdir(dir, { withFileTypes: true })`
  one level at a time via `readEntriesOrSkip`, and classifies each entry
  with `lstat` (not `stat`). Symlink entries are handed to
  `assertSymlinkEntryContained` and then `continue`'d past — they are
  never pushed onto `stack`, so the walker has no code path that
  descends through a symlink. Only entries whose `lstat` reports
  `isDirectory() && !isSymbolicLink()` (the `isDirectory()` check on a
  `Stats` from `lstat` reports `false` for symlinks-to-directories
  natively, so the symlink-first `if` branch is technically redundant
  for the non-descent guarantee — but it is the right shape for
  clarity and for the rejection short-circuit).
- `symlink-escape.test.ts:50-123` — Case A actively pins both halves of
  CR-01's claim: (i) `subjectMatch[1] === expectedInTreePath` (the
  rejection SUBJECT must be `<pluginRoot>/hooks/sub/escape`, NOT a
  path inside `externalDir`), and (ii) `msg` must NOT contain the
  sentinel filenames `sentinel-do-not-read-PROBE` or
  `deep-sentinel-PROBE` written into the externalDir tree. A walker
  that descended through the symlink would surface one of these in
  the error message via `entry.parentPath`-style enumeration.
- The Case A externalDir setup (one top-level sentinel + one nested
  directory containing a deep sentinel) exercises both the
  single-level and recursive-descent failure modes of the old
  `recursive: true` walker.

CR-01 is closed.

### WR-05 (HOOKS_VALUE fixture shape) — CLOSED

**Prior finding:** The bridge tests used `{ hooks: { PreToolUse: [...] } }`
which is not a valid `HOOKS_CONFIG_SCHEMA` (the schema is
`Record<string, HOOK_EVENT_ARRAY>` with event keys at the TOP level).

**Verification:**
- `stage.test.ts:40-42` now uses
  `{ PreToolUse: [{ matcher: "Bash", hooks: [...] }] }` — top-level
  event keys, parity with `cascade.test.ts` and `lifecycle-cascade.test.ts`.
- `symlink-escape.test.ts:43` uses `{}` (an empty record) which is also
  schema-valid (`Record<string, HOOK_EVENT_ARRAY>` accepts zero entries).
  Comment on line 41-42 documents the choice: "Rejection happens before
  the value is read, so an empty record is sufficient AND parse-valid."

Both fixtures are now schema-valid. WR-05 is closed.

> Note (re-review, 2026-06-16 gap-closure pass): WR-05 was subsequently
> REVERTED by design in 63-09 commit `02bb8ba` — the wire-format wrapper
> is now the canonical authoring shape per Claude Code SKILL.md, and the
> bridge `writeHookConfig` API receives the unwrapped inner record via
> `HOOKS_VALUE.hooks`. The fixtures match the new contract uniformly
> across the three test files (verified in the gap-closure section below).
> The "WR-05 is closed" verdict above remains correct as a description
> of plan 63-08; the subsequent 63-09 revert is an INTENTIONAL refactor
> tracked separately and is reviewed in the appended section.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Mid-walk ENOENT between `readdir` and `lstat` propagates as an unhandled crash

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:91`
**Issue:** Between the `readdir(dir, { withFileTypes: true })` snapshot
in `readEntriesOrSkip` and the per-entry `lstat(linkPath)` in the
inner loop, an entry can be removed by a concurrent process (e.g. a
build tool sweeping its own tempdir, or a plugin author running
`rm -rf` while `pi /claude:plugin install` is in flight). `lstat` will
throw `ENOENT`. The inner loop has no try/catch — the error escapes
`assertNoSymlinkEscapeInHooksSubtree`, escapes `writeHookConfig`, and
unwinds the orchestrator's hooks phase as a generic non-PI-14 throw.

The `readEntriesOrSkip` helper centralizes the ENOENT/ENOTDIR
translation for the top-level `readdir` call (so a missing `hooks/`
dir is a clean skip — Case E in the tests pins this). The per-entry
`lstat` and the eventual `realpath` in `assertSymlinkEntryContained`
have no equivalent translation. The pre-rewrite walker had the same
hazard (the symlink resolution inside `realpath` could race), so this
is not a NEW regression of the gap closure — but the explicit walk now
has TWO race windows where the old code had one, and the test suite
does not cover the race.

The orchestrator-side blast radius:
- `install.ts` / `reinstall.ts` / `update.ts` invoke `writeHookConfig`
  inside the ledger's hooks phase; an unhandled non-`PathContainmentError`
  throw triggers the rollback-partial path (per the prior WR-01 in the
  earlier review).
- A user sees `(failed) {rollback partial}` for a transient FS race that
  has nothing to do with the plugin's hooks config.

**Fix:** Wrap the per-entry `lstat` in the same `ENOENT/ENOTDIR → skip`
shape used by `readEntriesOrSkip`. The race is "the entry vanished
between enumeration and classification" — treating it as a clean
skip is correct because (a) a vanished entry cannot mount a
symlink-escape attack, (b) the subsequent `atomicWriteJson` will
write `hooks.json` from the in-memory parsed value regardless of
on-disk subtree state, and (c) idempotency (NFR-3) is preserved.

```ts
let stat: import("node:fs").Stats;
try {
  stat = await lstat(linkPath);
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR") {
    continue;
  }
  throw err;
}
```

Optionally apply the same shape to the `realpath` call inside
`assertSymlinkEntryContained` (symlink target could be removed between
`lstat` and `realpath`, with the same race-window logic).

### WR-02: `readSymlinkTargetSafe` duplicates a near-identical helper in `shared/path-safety.ts`

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:164-170`
**Issue:** `shared/path-safety.ts:139` already defines
`readSymlinkTarget(current)` which calls `readlink` and returns the
target (with its own error handling). The new helper in `stage.ts`
named `readSymlinkTargetSafe` does almost the same thing — calls
`readlink`, swallows any error, returns `<unreadable>`. The two
helpers diverge on the placeholder string (the path-safety version
returns the original path as a fallback; the stage.ts version
returns `<unreadable>`) and on what is caught (`SymlinkRefusedError`
construction in the path-safety call site uses a different fallback
shape).

This is single-source-of-truth drift: the bridge re-implements a
helper the shared module already provides. If a future change tightens
the placeholder format in `path-safety.ts`
(`"<unreadable: ${code}>"` for diagnostic clarity, say), the
bridge-local helper will silently keep its old `<unreadable>` string
and the error formats will drift apart.

**Fix:** Either (a) export `readSymlinkTarget` from
`shared/path-safety.ts` and reuse it in `stage.ts`, or (b) standardize
on the bridge-local `<unreadable>` placeholder and document why the
two helpers exist independently (different error-message contracts).
Option (a) is the smaller change.

## Info

### IN-01: `assertSymlinkEntryContained`'s `PathContainmentError → SymlinkRefusedError` translation is not directly covered

**File:** `extensions/pi-claude-marketplace/bridges/hooks/stage.ts:142-161`
**Issue:** The translation block converts a bare
`PathContainmentError` thrown by `assertPathInside` (the
"string-level isPathInside returned false, no symlink in the walked
segments" case) into a `SymlinkRefusedError` so callers can
`instanceof`-discriminate the symlink-escape contract. On Linux,
`mkdtemp` returns `/tmp/...` directly and `realpath` of an external
symlink returns the same `/tmp/...` prefix, so `isPathInside` may
return false WITHOUT the inner lstat walk firing a
`SymlinkRefusedError` — the translation path is the one that runs.
On macOS, `mkdtemp` returns `/var/folders/...` which `realpath`
resolves to `/private/var/folders/...`; the same translation path
runs.

The test suite covers the "translation happens AND the resulting
error is a `SymlinkRefusedError`" assertion via `assert.rejects(..., err
=> err instanceof SymlinkRefusedError)`. It does NOT independently
cover the "raw `assertPathInside` returned a `PathContainmentError`
because the lstat walk completed without finding a symlink" branch
versus the "raw `assertPathInside` ALREADY threw a
`SymlinkRefusedError` from an intermediate macOS `/private/var`
segment" branch — both produce the same observable `instanceof
SymlinkRefusedError` outcome.

This means a future refactor of `assertPathInside` that drops the
`PathContainmentError` throw (e.g. by tightening the string-level
check to always lstat-walk first) would silently make the
translation block dead code. The block would still compile and
typecheck; only the comment on lines 142-149 would become a lie.

This is informational only — the current code is correct and the
comment explicitly names the macOS `/private/var` case. The note is
that the rejection-contract test set asserts the OUTCOME but not the
BRANCH, so the translation block's reason-for-existence relies on
prose discipline.

**Fix:** Optional. Add a unit test that constructs a synthetic
scenario where `isPathInside` returns false but `assertPathInside`
does NOT throw `SymlinkRefusedError` from its own walk (e.g. an
absolute symlink target on Linux pointing to `/var/tmp/...` from a
`pluginRoot` of `/tmp/...`), and asserts the translation produces a
`SymlinkRefusedError` (not a bare `PathContainmentError`). Or
extract the translation into a labeled helper with its own
docstring naming the branch contract so it survives future audits.

---

# Gap-Closure Re-Review (2026-06-16, plans 63-09 / 63-10 / 63-11)

**Reviewed:** 2026-06-16T22:00:00Z
**Depth:** standard
**Files reviewed:** 8 (2 prod, 6 test) plus README.md (advisory)
**Status:** `issues_found` — 0 Critical, 3 Warning, 3 Info

## Scope

This appended pass reviews the source + test changes landed by plans
63-09 / 63-10 / 63-11. Commits in scope:

- 63-09 (wrapper-format wire-contract fix):
  - `b78956b` test: pin parseHooksConfig against hookify upstream wire format
  - `714a6d4` test: slim hookify fixture to bucket-A events (defer Stop)
  - `5fa5543` fix: unwrap plugin-format hooks.json wrapper in parseHooksConfig
  - `02bb8ba` test: restore upstream wrapper form in hook test fixtures
- 63-10 (cross-surface classifier parity):
  - `b28b0f7` test: pin cross-surface REASONS parity for hooks.json notes
  - `4e5adf9` fix: mirror narrowResolverNotes hooks-prefix arm in install classifier
- 63-11 (docs / UAT closure):
  - `7967ea8` docs: add Hooks bullet to README Features list

Files reviewed:

| Role | File |
| --- | --- |
| Prod | `extensions/pi-claude-marketplace/domain/components/hooks.ts` |
| Prod | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` |
| Test | `tests/domain/components/hooks.test.ts` |
| Test | `tests/fixtures/hookify-hooks.json` |
| Test | `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` |
| Test | `tests/bridges/hooks/stage.test.ts` |
| Test | `tests/orchestrators/marketplace/cascade.test.ts` (line 166 seed) |
| Test | `tests/transaction/lifecycle-cascade.test.ts` (v1Hooks / v2Hooks) |
| Doc | `README.md` (advisory) |

## Findings

| ID | Severity | File:line | Finding | Recommendation |
| --- | --- | --- | --- | --- |
| CR-01 | Warning | `extensions/pi-claude-marketplace/domain/components/hooks.ts:114-125, 349-354` | Silent-drop of sibling top-level event keys when wrapper-detection unwraps. A user config carrying BOTH `hooks: {...}` AND other top-level event keys (e.g. `{description, hooks: {PreToolUse: [...]}, SessionStart: [...]}`) is treated as the wrapper form — the outer `SessionStart` arm is silently discarded with no warning. The JSDoc on `isPluginWrapper` and `parseHooksConfig` document the two-arm contract but do not call out this ambiguity. Risk is low (real authoring of a mixed-shape config is unlikely), but the silent-drop violates the project's "loud failure" pattern (D-58-06 strict-supportability stance). | Either (a) tighten `isPluginWrapper` to also assert there are NO other top-level keys outside the wrapper key set (`description`, `hooks`) — any extra key flips to bare-arm validation, which loud-rejects the `hooks` field as a non-array value; or (b) extend the JSDoc on `isPluginWrapper` to explicitly call out the silent-drop case and confirm via comment that this is acceptable v1.13 scope (mixed-shape configs are not a real authoring pattern per upstream Claude Code SKILL.md). |
| CR-02 | Warning | `git log --format=%s 4e5adf9` (commit title 77 chars) | Commit `4e5adf9` (`fix(63-10): mirror narrowResolverNotes hooks-prefix arm in install classifier`) has a 77-char Conventional Commits title, exceeding the project's `CLAUDE.md` policy of "Titles must be at least 5 characters and no more than 72 characters." The body lines respect the 80-col limit. No `--no-verify` was used (confirmed via git log search), so the pre-commit hook either did not enforce title length or the hook does not gate on it. | Going forward, shorten code-change commit titles to ≤72 chars. Suggested rewrite: `fix(63-10): mirror probe hooks-prefix arm in install classifier` (62 chars). This is the only in-scope code commit that exceeds the limit; not blocking (the body is well-formed and the title is still readable), but it is a deviation from the project policy explicitly enumerated in `CLAUDE.md` Git guidelines. |
| CR-03 | Warning | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1697, 1715` | Tight string-coupling between the install classifier and the parser's reason strings. The four prefix tokens (`"hooks.json is not valid JSON:"`, `"hooks.json failed schema validation:"`, `"unsupported hooks:"`, `"malformed hooks.json:"`) are duplicated across `install.ts::narrowResolverReasons` AND `shared/probe-classifiers.ts::narrowResolverNotes` AND emitted at `domain/components/hooks.ts:344, 358, 372` AND wrapped at the resolver call site. The parity test (`cross-surface-reason-parity.test.ts`) pins consumer-consumer parity but does NOT pin emitter-consumer parity. If a future change in `hooks.ts` renames `"hooks.json failed schema validation:"` to `"hooks schema validation failed:"`, BOTH classifier sites silently demote to `"unsupported source"` AND the parity test stays GREEN (because both classifiers stay synchronized in their now-dead arms). | Extract the four prefix tokens to a single exported constant array in `domain/components/hooks.ts` (or `shared/probe-classifiers.ts`), and import it on the emit and both consume sides so a rename is enforced structurally. Add at least one regression test that runs `parseHooksConfig` against a malformed JSON / failed schema / supportability trip and asserts the resulting reason starts with one of the four canonical prefixes. Optional but increases confidence in the SURF-01 invariant the parity test exists to defend. |
| IN-01 | Info | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1694` | `eslint-disable-next-line sonarjs/cognitive-complexity` is added at `narrowResolverReasons`. The complexity bump (15→16) is real and the precedent at `installPlugin` (line 911 per the SUMMARY note) supports the disable. The function's flat for-loop of mutually exclusive arms is the right shape for the parity-with-probe contract; refactoring into helpers would obscure that contract. Acceptable as-is, but a future cleanup could lift the prefix-set check into a small named helper (e.g. `isHooksJsonPrefix(reason)`) that lives alongside the constant proposed in CR-03 — the helper would carry the parity comment and keep the loop body readable. | Defer. Tag for the proposed CR-03 cleanup so the helper extraction lands as a single refactor. |
| IN-02 | Info | `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts:18-37` | Parity-test coverage is correct but minimal. The six cases cover the four hooks-prefix families + `contains lspServers` + a generic catch-all. Missing positive-control cases: (a) a reason that LOOKS hooks-shaped but does not match a prefix (e.g. `"hooks.json"` alone, or `" hooks.json failed schema validation:"` with leading whitespace) to confirm the `startsWith` check is exact; (b) a multi-reason `["hooks.json is not valid JSON:", "contains lspServers"]` case to confirm both classifiers preserve the SAME order and DO NOT collapse to a single token. The parity test exists as a structural pin, so adding one or two adversarial cases would tighten the contract noticeably. | Optional. Add 1-2 adversarial cases: a near-miss prefix (no `:`) and a multi-reason note. Both classifiers currently dedupe (install dedupes via `new Set`; probe dedupes via `seen` set) — pin this in the parity test. |
| IN-03 | Info | `tests/domain/components/hooks.test.ts:586-624` | The wrapper-pin test exercises the wrapper-detection arm meaningfully — it loads the hookify fixture via `readFile`, parses with `skipIfMap: true`, asserts `result.ok` and asserts the THREE bucket-A event keys land in `result.value`. The docstring at lines 583-604 documents the fixture provenance (upstream hookify wire bytes, slimmed to drop `Stop`) and cites `BUCKET_A_EVENTS` + the upstream file path. Missing: a NEGATIVE assertion that `description` is NOT a key of `result.value` (proving the wrapper was actually unwrapped, not just that the parsed result happened to contain the three event arms). Currently the test would still PASS if `parseHooksConfig` was a no-op identity function (no wrapper unwrap, no validation) because the upstream fixture happens to include the three event keys inside the wrapper. | Add `assert.equal("description" in result.value, false)` and `assert.equal("hooks" in result.value, false)` to confirm the wrapper-unwrap actually happened. One-line addition. |

## Per-file commentary

**`extensions/pi-claude-marketplace/domain/components/hooks.ts`** —
The `isPluginWrapper` predicate is structurally sound for the
documented wrapper shape. The shape predicate correctly admits the
upstream wrapper (`{description?, hooks: <obj>}`) and rejects arrays,
nulls, and non-object inner values. The backward-compat arm is
preserved — bare `{<event>: [...]}` inputs flow through unchanged
because `isPluginWrapper` requires the inner `hooks` to itself be a
non-null non-array object, and `Object.hasOwn` is the correct
own-property check (avoiding prototype-chain false positives that
`in` / direct property access would allow). JSDoc cites the
upstream `plugin-dev/skills/hook-development/SKILL.md` at five
distinct sites in the file (lines 31, 102, 229, 311, 350) — the
binding wire-format authority is well-documented. The wrapper-detection
silent-drop case for mixed-shape configs is CR-01 above.

**`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`** —
The new arm at lines 1710-1718 is correctly positioned at the head
of the per-reason loop body (after the empty-skip continue, before
the `manifestFieldTokenFromNote` carve-out and the
`reason.includes("source")` arm). The ordering is load-bearing: the
arm-ordering JSDoc at line 1680-1690 enumerates the new arm at
position 0 and explicitly cites "BEFORE the manifest-field carve-out
and the `source`-substring arm". The four `startsWith` checks at
1711-1714 mirror the probe-side classifier at
`shared/probe-classifiers.ts:93-97` verbatim — verified by direct
comparison. The closed-set REASONS token `"unsupported hooks"` IS a
member of `shared/notify.ts::REASONS` (line 81), confirmed by direct
inspection. The threat note T-63-10-FALLTHROUGH (a note like
`"hooks.json failed schema validation: /source: ..."` matching both
the new arm and the legacy `source`-includes arm) is correctly
disambiguated by the new arm's earlier position + `continue`
short-circuit. The `eslint-disable-next-line sonarjs/cognitive-complexity`
is IN-01 above (acceptable per the established precedent at
`installPlugin`, deferred).

**`tests/domain/components/hooks.test.ts`** — The new wrapper-pin
test at lines 608-624 loads the slimmed hookify fixture, calls
`parseHooksConfig` with `skipIfMap: true`, and asserts on the three
bucket-A event keys post-unwrap. The docstring header at lines
583-604 properly cites upstream `plugin-dev/skills/hook-development/SKILL.md`
+ `BUCKET_A_EVENTS` and explains the Stop-arm slim. Edge case noted
in IN-03 (no negative assertion that `description` was unwrapped
out). The other 41 pre-existing tests in this file are unchanged
and still cover the bare-shape backward-compat arm via
`parseHooksConfig` calls that pass bare JSON literals (see lines 141-145,
161-167, 297-306, etc.). The two-arm parser is meaningfully
covered.

**`tests/fixtures/hookify-hooks.json`** — Verbatim wrapper-shape
fixture: top-level `description` + `hooks` object with three
bucket-A event arms (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`).
The Stop arm is correctly omitted per the Option A slim documented
in 63-09. Each event arm is a single hook group with a `command`-type
handler invoking a `python3` script under `${CLAUDE_PLUGIN_ROOT}`.
File is hermetic test data; no execution surface.

**`tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`** —
Six parity cases cover the four hooks-prefix families (lines 19-34)
+ `contains lspServers` (line 35) + a generic catch-all
(line 36). Test loop at lines 39-50 calls BOTH
`narrowResolverNotes` (probe) and `__test_narrowResolverReasons`
(install) on the same note and asserts both emit the expected
closed-set token. The synthetic construction is sound — no false
positives from unrelated arms (the `manifestFieldTokenFromNote`
carve-out is gated on the `contains ` prefix, and the
`source`-includes arm is gated on substring match; neither would
fire on the four hooks-prefix cases). Coverage gap noted in IN-02
(near-miss prefix + multi-reason note).

**`tests/bridges/hooks/stage.test.ts`** — `HOOKS_VALUE` at lines
47-51 is the wrapper shape; all 5 `writeHookConfig` invocations
pass `HOOKS_VALUE.hooks` (the unwrapped inner record) at lines 63,
84, 92, 110, 147. The single on-disk `deepEqual` at line 71
compares `onDisk` against `HOOKS_VALUE.hooks` — consistent with the
production caller contract documented in the file-level comment at
lines 37-46. The pluginRoot seed write at lines 57, 78, 104 writes
the FULL wrapper JSON to disk (the source plugin's
`<pluginRoot>/hooks/hooks.json`), which the parser then unwraps.
Internal consistency verified.

**`tests/orchestrators/marketplace/cascade.test.ts`** — Line 166
seed JSON literal flipped back to the wrapper form
`{ hooks: { PreToolUse: [...] } }`. The comment at lines 165-169
documents that this test does NOT compare on-disk bytes against
the seed (it only observes subtree removal), so no consumer
assertion adjustment was required. Verified by skim of the
surrounding test body.

**`tests/transaction/lifecycle-cascade.test.ts`** — `v1Hooks`
(lines 153-157) and `v2Hooks` (lines 191-195) restored to wrapper
form. The THREE on-disk `deepEqual` assertions at lines 178, 221-223,
245-248 all compare to `.hooks` (the unwrapped inner). The header
comment at lines 146-152 documents the contract uniformly. Internal
consistency verified against the bridge-side `writeHookConfig`
contract.

**`README.md`** (advisory) — Hooks bullet at line 28 slots between
Agents and MCP servers; matches the existing `## Hook support`
section's link target (`docs/hooks.md`). No functional review
needed.

## Cross-cutting verification

- **REASONS closed-set membership.** `unsupported hooks` is present
  in `shared/notify.ts::REASONS` (line 81). The new `out.push("unsupported hooks")`
  call typechecks correctly.
- **Verbatim prefix-set parity.** The four `startsWith` checks in
  `install.ts:1711-1714` are character-for-character identical to
  `probe-classifiers.ts:93-97`. Verified by direct comparison.
- **Arm ordering.** Confirmed the new arm runs BEFORE the
  manifest-field carve-out AND BEFORE the `reason.includes("source")`
  arm. The plan's stated requirement is satisfied.
- **CLAUDE.md policy.** No `--no-verify` mentions in any of the
  seven in-scope commit messages. Conventional Commits respected on
  all seven; one commit title (`4e5adf9`) exceeds the 72-char limit
  (CR-02 above). Body lines respect the 80-col limit on all seven.
- **Typescript-comments policy** (`.claude/rules/typescript-comments.md`).
  None of the in-scope source comments carry forbidden GSD planning
  references (`Phase NN`, `Plan NN`, `Wave N`, `Task N`, bare
  `Pitfall N`). The hooks.ts file carries decision/requirement IDs
  (D-57-02, D-57-04, HOOK-03, LIFE-01, MATCH-03, TOOL-02, etc.) which
  are the allowed traceability anchors. The install.ts JSDoc carries
  HOOK-03 / LIFE-01 / SURF-01 (allowed). Compliant.

## Net assessment

The gap-closure trio (63-09 / 63-10 / 63-11) is functionally sound.
Plan 63-09's two-arm wrapper-detection in `parseHooksConfig` correctly
admits the upstream PLUGIN-format wrapper while preserving the
backward-compat bare-shape arm. Plan 63-10's new arm in
`narrowResolverReasons` mirrors the probe-side classifier verbatim
and is correctly positioned in the per-reason loop. The parity test
pins the consumer-consumer SURF-01 contract structurally. The three
WR-05 reverts across the test files are internally consistent: every
`writeHookConfig` invocation passes the unwrapped inner record, every
on-disk `deepEqual` compares to the unwrapped inner record, and the
wrapper-shaped source seed writes match the production
`<pluginRoot>/hooks/hooks.json` contract. No critical issues. Three
warnings (silent-drop on mixed-shape configs, title-length policy
deviation on one commit, tight string-coupling between emitter and
consumers) are worth fixing or documenting but do not block merge.
Three info findings are deferable.

---

_Reviewed: 2026-06-16T22:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (gap-closure re-review of plans 63-09 / 63-10 / 63-11)_
