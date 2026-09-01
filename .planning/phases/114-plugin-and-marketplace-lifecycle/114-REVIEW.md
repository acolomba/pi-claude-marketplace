---
phase: 114-plugin-and-marketplace-lifecycle
reviewed: 2026-09-01T18:20:00Z
depth: standard
scope: gap-closure-delta
scope_note: >-
  Re-review limited to the Phase 114 retry-closure delta (commits 2323c894,
  d3d4f62c, 3331d23d; ~5,543 added lines across three test owners). The full
  29/35-file Phase 114 scope was reviewed at 2026-09-01T15:42:31Z and closed
  clean after one warning (WR-01, dynamic skips) was fixed in 84b147ec and
  recorded in 114-REVIEW-FIX.md. That earlier pass is superseded as an
  artifact, not as a result.
previous_pass:
  reviewed: 2026-09-01T15:42:31Z
  files_reviewed: 35
  status: clean
  resolved_findings: 1
  fix_commit: 84b147ec
  fix_report_commit: 98aa97ce
diff_base: 2323c894^
files_reviewed: 3
files_reviewed_list:
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
findings:
  critical: 1
  warning: 9
  info: 5
  total: 15
status: issues_found
---

# Phase 114: Code Review Report (gap-closure delta)

**Reviewed:** 2026-09-01T18:20:00Z
**Depth:** standard
**Files Reviewed:** 3 (delta only)
**Status:** issues_found

## Scope

This pass covers only the retry-closure delta:

| Commit     | Plan   | File                                          | Added lines |
| ---------- | ------ | --------------------------------------------- | ----------- |
| `2323c894` | 114-15 | `tests/orchestrators/plugin/install.test.ts`   | ~1,581      |
| `d3d4f62c` | 114-16 | `tests/orchestrators/plugin/reinstall.test.ts` | ~2,314      |
| `3331d23d` | 114-17 | `tests/orchestrators/plugin/uninstall.test.ts` | ~1,720      |

The remaining Phase 114 scope (35 files, including the three production
orchestrators these tests exercise) was reviewed on 2026-09-01T15:42:31Z and
closed **clean** after its single warning was fixed in `84b147ec`. Nothing in
this pass reopens that result; the artifact is replaced only because the review
path is shared.

No `<structural_findings>` block was supplied for this pass.

## Summary

The delta does what it set out to do at the structural level. Every one of the
40 new `retry proof:` cases makes two AST-visible calls to the same exported
workflow (`installPlugin`, `reinstallPlugin`, `reinstallPlugins`,
`uninstallPlugin`) over one case-owned `mkdtemp` root, repairs only the injected
fault between them, and asserts convergence from real filesystem bytes and real
`state.json` bytes. I re-ran the focused sets to confirm: uninstall 13/13 pass in
2.96 s, reinstall 14/14 pass in 4.09 s. No sleeps, no polling, no elapsed-time
assertions, no platform skips, no network, no `test.only`/`skip`/`todo` in either
call form. The `deepStrictEqual` tree inventories in reinstall and uninstall are
genuinely strong evidence.

The defects are in the *proof machinery*, not the plumbing. Three of them matter:

1. The two containment retry proofs — the only delta cases that cover the D-14
   symlink refusal — discriminate by loose message substring and then build the
   expected rendering out of the actual error. Neither can fail on a change to
   the refusal's type, text, or rendering. That is the exact "green run that
   checked nothing" class this project has shipped before (CR-01).
2. `observeReinstallSchedule` records events into a **set**, not a sequence. I
   proved empirically that this erases half of every rollback: with the dedupe
   removed, the four-replacement persistence case records six rollback entries
   where the case asserts three (WR-01).
3. The same observer suppresses `abort:` when a `replace:` is already present and
   `finalize:` when a `rollback:` is — it encodes the production semantics it is
   supposed to be observing, so an out-of-order staging cleanup is relabelled or
   dropped rather than failing (WR-02).

Separately, the 114-15 SUMMARY overstates what install actually asserts: five of
its thirteen retry cases never pin the owned tree to a literal, and two never
compare the post-retry tree at all, against a claim of "exact tree inventories"
and "complete first tree and state bytes remain identical" (WR-04).

## Structural Findings (fallow)

None provided for this pass. No structural pre-pass payload accompanied the
prompt.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Both containment retry proofs are non-discriminating — they cannot fail on a wrong error type, a changed message, or a changed rendering

**Severity:** BLOCKER
**Files:**
- `tests/orchestrators/plugin/install.test.ts:9152-9180` (`retry proof: install: containment failure preserves the refused residue and succeeds after unlink`)
- `tests/orchestrators/plugin/uninstall.test.ts:4255-4262` (`retry proof: uninstall: a refused data-dir path escape propagates after the commit and the retry reports not installed`)

**Issue:**

Install asserts the refusal like this:

```ts
assert.ok(first.error instanceof Error);
assert.match(first.error.message, /contains symlink|escapes/);
...
assert.deepStrictEqual(notifications, [
  {
    message:
      "A plugin operation has failed.\n\n● mp [project]\n" +
      "  ⊘ retryable v0.0.1 (failed)\n" +
      `    cause: ${first.error.message}`,   // <- expected built from actual
    severity: "error",
  },
  ...
]);
```

Three independent problems compound here:

1. **The alternation matches both refusal classes.** `shared/path-safety.ts:13`
   gives `PathContainmentError` the message `"<label> escapes <parent> (resolved:
   <child>)."`; `:34` gives `SymlinkRefusedError` the message `"<label> contains
   symlink <link> -> <target> (parent: …, target: …)."`. `/contains
   symlink|escapes/` matches **either**. The case's fixture is a symlink
   (`await symlink("/tmp/retry-proof-decoy", skillTarget)`) and its whole point is
   the D-14 "refuse ALL symlinks" policy — yet it passes identically if the
   strict symlink arm is lost and the weaker string-containment arm fires
   instead. It also passes for any unrelated `Error` whose message happens to
   contain the word "escapes".
2. **The expected notification embeds the actual message.** The `cause:` line is
   whatever production produced. That assertion can never fail on the cause line.
3. **Convention violation.** `CONVENTIONS.md` is explicit: "callers narrow on
   `instanceof`, never on message substring matching or `error.name` string
   comparison", and the testing guidelines say "Assert a typed error class and
   its structured fields. Do not match a message substring when the error has a
   stable type and data." `SymlinkRefusedError` carries `parent`, `child`,
   `linkPath`, and `linkTarget` — all available, none asserted.

Uninstall's variant is looser still:

```ts
assert.ok(firstError instanceof Error);
assert.match(`${firstError.name} ${firstError.message}`, /symlink|contain/i);
```

`/contain/i` matches the class *name* `PathContainmentError`, so the message half
of that concatenation is not constrained at all. Any error named
`PathContainmentError` with an empty message passes.

**Fix:**

Import the typed classes and assert the class plus its structured fields; build
the expected notification from a literal derived from the case-owned fixture,
never from `first.error`.

```ts
import {
  SymlinkRefusedError,
} from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

// assert
assert.ok(first.error instanceof SymlinkRefusedError);
assert.strictEqual(first.error.name, "SymlinkRefusedError");
assert.strictEqual(first.error.linkPath, skillTarget);
assert.strictEqual(first.error.linkTarget, "/tmp/retry-proof-decoy");
assert.strictEqual(first.error.parent, locations.scopeRoot);

const expectedCause =
  `skill target contains symlink ${skillTarget} -> /tmp/retry-proof-decoy ` +
  `(parent: ${locations.scopeRoot}, target: ${skillTarget}).`;
assert.strictEqual(first.error.message, expectedCause);
assert.deepStrictEqual(notifications, [
  {
    message:
      "A plugin operation has failed.\n\n● mp [project]\n" +
      "  ⊘ retryable v0.0.1 (failed)\n" +
      `    cause: ${expectedCause}`,
    severity: "error",
  },
  { message: "● mp [project]\n  ● retryable v0.0.1 (installed)\n\n/reload to pick up changes" },
]);
```

Apply the same shape to the uninstall case (`assert.ok(firstError instanceof
SymlinkRefusedError)` plus `linkPath`/`linkTarget`/`parent`), replacing the
`name + message` concatenation match entirely.

## Warnings

### WR-01: `observeReinstallSchedule` records a set, not a sequence — every rollback loses half its evidence

**Severity:** WARNING
**File:** `tests/orchestrators/plugin/reinstall.test.ts:468-472`

**Issue:**

```ts
const record = (event: string): void => {
  if (!schedule.current.includes(event)) {
    schedule.current.push(event);
  }
};
```

`Array.includes` scans the whole array, so this is set semantics ordered by first
occurrence — not a schedule. `rollback:<bridge>` is emitted from two different
primitives (`rm` of the replaced target at `:511`, and `rename` of the backup back
at `:497`), and the dedupe collapses them into one entry.

I proved this empirically. Copying the file, replacing `record` with an
unconditional `push`, and running `retry proof: reinstall: a persistence failure
after four committed replacements unwinds them all in reverse` produces:

```
+ actual - expected
      'rollback:agents',
  +   'rollback:agents',
      'rollback:commands',
  +   'rollback:commands',
      'rollback:skills',
  +   'rollback:skills'
```

The case asserts three rollback entries; six operations actually occur. A
regression that ran an extra unwind pass, or that removed a replaced target twice,
would not move the asserted schedule at all. (The case's byte assertions —
`firstSkill === oldSkill` etc. — still catch a *missing* restore, so this is a
weakening rather than a hole; the schedule just proves less than its literal
suggests.)

The three files also use three different dedupe policies for the same job:
install's `recordOnce` (`install.test.ts:130-134`) dedupes only *consecutive*
events; uninstall's `record` (`uninstall.test.ts:2833-2835`) pushes
unconditionally; reinstall's dedupes globally.

**Fix:** Make reinstall's `record` an unconditional push, matching uninstall, and
update the four affected literal schedules to the real six-entry rollback
sequences. If a specific event genuinely needs collapsing, collapse it at the
call site with an explicit named reason, not globally.

### WR-02: The reinstall observer encodes the semantics it is supposed to be observing, so an out-of-order cleanup is relabelled instead of failing

**Severity:** WARNING
**File:** `tests/orchestrators/plugin/reinstall.test.ts:516-521`

**Issue:**

```ts
const phase = slot.backup ? "finalize" : "abort";
const suppressor = slot.backup ? `rollback:${slot.bridge}` : `replace:${slot.bridge}`;
if (!schedule.current.includes(suppressor)) {
  record(`${phase}:${slot.bridge}`);
}
```

The observer decides whether a staging removal is an `abort` or a `finalize` by
consulting what production already did earlier in the same call. Consequences:

- If reinstall regressed to abort (remove the staging root of) a bridge that had
  **already** been replaced, the event is suppressed entirely and the literal
  schedule still matches.
- If it removed a `backup-<uuid>` root after that bridge had already rolled back
  (a double-cleanup bug), same: suppressed.

An observer must record what happened; the case must decide what that means. As
written, the ledger launders exactly the ordering regressions the case names in
its title.

**Fix:** Record the raw event unconditionally — e.g. `staging-rm:<bridge>` and
`backup-rm:<bridge>` — and let each case's literal schedule express the expected
interleaving. The derived `abort`/`finalize` vocabulary can stay as a comment
mapping in the header block.

### WR-03: `assertRetryFailure` derives the expected `cause` from the actual `error.message`

**Severity:** WARNING
**File:** `tests/orchestrators/plugin/install.test.ts:231`, and inline copies at `:8347` and `:9030`

**Issue:**

```ts
assert.strictEqual(outcome.cause, `${outcome.error.message}\n\ncause: ${outcome.error.message}`);
```

The expected value is computed from the actual value. It still detects a change
to the doubling shape, but it cannot detect any change to the message itself —
and in the two inline copies (`:8347` rollback-partial, `:9030` containment) the
paired `assert.match` is deliberately loose (`/^ENOTDIR: not a directory, mkdir /`
and `/contains symlink|escapes/`), so nothing pins the text. The testing
guidelines list "read the adapter result and transform it into the expected
result" as a prohibited pattern.

Reinstall got this right — `retryCauseChain(message)` at `reinstall.test.ts:5486-5488`
takes a case-authored literal and builds the doubled form from it.

**Fix:** Port `retryCauseChain` into `install.test.ts` and change
`assertRetryFailure` to take the exact expected message as a string (not a
`RegExp`), building `cause` from that literal:

```ts
function retryCauseChain(message: string): string {
  return `${message}\n\ncause: ${message}`;
}

function assertRetryFailure(
  outcome: Awaited<ReturnType<typeof installPlugin>>,
  expectedMessage: string,
): void {
  assert.deepStrictEqual(Object.keys(outcome).sort(), ["cause", "error", "status"]);
  assert.strictEqual(outcome.status, "failed");
  assert.ok(outcome.error instanceof Error);
  assert.strictEqual(outcome.error.message, expectedMessage);
  assert.strictEqual(outcome.cause, retryCauseChain(expectedMessage));
}
```

For the two ENOTDIR call sites where the staging UUID is not knowable in advance,
keep a regex for the message but still build the expected `cause` from a captured
literal prefix plus the matched suffix, not from `outcome.error.message` verbatim.

### WR-04: Five install retry cases never pin the owned tree, contradicting the plan summary's "exact tree inventories" claim

**Severity:** WARNING
**File:** `tests/orchestrators/plugin/install.test.ts:3733`, `:3826`, `:7562`, `:7799`, `:7925`

**Issue:** The 114-15 SUMMARY's equivalence matrix promises "exact tree
inventories" per row and, for the safe-idempotence rows, "complete first tree and
state bytes remain identical". The reinstall and uninstall deltas deliver exactly
that — full `deepStrictEqual` literal inventories on both sides. Install does not:

| Case                                    | Tree evidence actually asserted                                             |
| --------------------------------------- | --------------------------------------------------------------------------- |
| completion-cache maintenance (`:3733`)  | `firstTree.includes("…/data/mp/hello/") === true`; **post-retry tree never read** |
| plugin-data-dir maintenance (`:3826`)   | `firstTree.includes(…) === false`; **post-retry tree never read**            |
| ordered bridge cleanup leaks (`:7562`)  | `retryTree(…) === firstTree` + a `filter(...).length === 3` spot check; `firstTree` never pinned to a literal |
| post-save hook-cache (`:7799`)          | `retryTree(…) === firstTree`; `firstTree` never pinned                       |
| disabled cascade (`:7925`)              | `retryTree(…) === firstTree`; `firstTree` never pinned                       |

For the first two, a second `installPlugin` that added or removed any owned
artifact other than `state.json` would go undetected. For the other three,
`firstTree` is only proven *stable*, never proven *correct*.

**Fix:** Add `assert.deepStrictEqual(await retryTree(locations.scopeRoot), firstTree)`
to the two maintenance cases, and pin `firstTree` to a literal inventory in all
five — the same form already used in the other eight install cases and throughout
reinstall/uninstall. If a case genuinely needs to tolerate UUID staging residue,
filter it out explicitly (the reinstall abort-leak case at `:5907-5909` shows the
pattern) rather than dropping the literal.

### WR-05: Two install retry cases omit the mandatory `// arrange` phase marker

**Severity:** WARNING
**File:** `tests/orchestrators/plugin/install.test.ts:3649`, `:3747`

**Issue:** The completion-cache and plugin-data-dir retry cases carry only
`// act` and `// assert`. The guidelines' completion checklist makes this a hard
rule: "Every case marks its phases with `// arrange`, `// act`, and `// assert`;
`// act & assert` appears only for one throwing/rejection expression." All 38
other retry-proof cases in the delta comply (verified by scanning every
`retry proof:` case in all three files — these two are the only misses).

The plugin-data-dir case additionally has no blank line between its last arrange
statement (`const { ctx, notifications, pi } = makeCtx();`, `:3787`) and `// act`
(`:3788`); the completion-cache case at `:3693-3695` does have one.

**Fix:** Insert `// arrange` after the `try {` in both cases and add the missing
blank line before `// act` at `:3788`.

### WR-06: The uninstall cache-drop retry case leaves the process-lifetime completion cache populated

**Severity:** WARNING
**File:** `tests/orchestrators/plugin/uninstall.test.ts:3755-3761`

**Issue:**

```ts
resetCompletionCache();
const locations = locationsFor("project", cwd);
await seedFullPlugin(locations, "mp", "hello", cwd);
const targets = await retryTargets(cwd, "mp", "hello");
await getPluginIndex(targets.cacheFile, "project", "mp", () =>
  Promise.resolve([{ name: "hello", status: "installed" }]),
);
```

`shared/completion-cache.ts` holds process-lifetime state. The case resets it on
entry but never on exit, so it ends with `project:mp -> [{hello, installed}]`
still resident. The guidelines' repeatability rule is explicit: "A case leaves no
state behind … and passes in any order and in isolation." The sibling case in the
same file already demonstrates the correct discipline — it resets at `:901`
**and** at `:949`.

Today's blast radius is small (no later case in the file reads the cache), but the
ordering guarantee is what makes it small, and node:test does not promise it.

**Fix:** Register the teardown with the test context so it runs even on failure:

```ts
resetCompletionCache();
t.after(() => {
  resetCompletionCache();
});
```

(The case already takes `t`.) Do the same for `install.test.ts:3659`.

### WR-07: `retryTree` is copied near-verbatim into all three files, plus a second copy of production `pathExists`

**Severity:** WARNING
**Files:**
- `tests/orchestrators/plugin/install.test.ts:57` (`retryPathExists`), `:70` (`retryTree`)
- `tests/orchestrators/plugin/reinstall.test.ts:338` (`retryPathExists`), `:356` (`retryTree`)
- `tests/orchestrators/plugin/uninstall.test.ts:2743` (`retryTree`)

**Issue:** The three `retryTree` bodies are 25 lines each and differ by exactly
one token — the readdir binding (`filesystemPromises.readdir` /
`retryFs.readdir` / `retryReaddir`). The `.state-lock` filter, the
`localeCompare` sort, the trailing-slash convention, and the recursion are
identical. Separately, `retryPathExists` in install and reinstall reimplements
`shared/fs-utils.ts::pathExists`, which uninstall correctly imports and which
`reinstall.test.ts:39` **already imports** for other cases.

Three copies of a walker that defines the tree-inventory contract means three
places to update when that contract moves, and three places for them to silently
diverge — the uninstall copy already differs meaningfully (it captures
`retryReaddir` before any mock installs, `:2736`, which the other two do not).

**Fix:** Extract one `createScopeTreeInventory` module beside these tests —
`tests/orchestrators/plugin/scope-tree-inventory.ts` — exporting `retryTree(root)`
built on a module-load-time readdir binding, and delete both `retryPathExists`
copies in favour of the production `pathExists` import. This is the "keep test
support next to the test modules of the concern it serves" layout the guidelines
prescribe.

### WR-08: `D-13 / D-15 / D-16` header IDs are plan numbers dressed as decision IDs, and they collide with a real, unrelated decision family

**Severity:** WARNING
**Files:**
- `tests/orchestrators/plugin/reinstall.test.ts:327` — `// Retry-proof observation helpers (D-13/D-15/D-16)`
- `tests/orchestrators/plugin/reinstall.test.ts:5491` — `// D-13/D-15/D-16 failure-then-retry proof.`
- `tests/orchestrators/plugin/uninstall.test.ts:2705` — `// D-13 / D-15 retry proof.`
- `tests/orchestrators/plugin/reinstall.test.ts:6508` — `// WR-05: the hooks write is not on the replacement ledger …`

**Issue:** Every other `D-13-*`, `D-15-*`, `D-16-*` reference in these three files
is a real hyphenated decision ID from the v1.3/v1.4 messaging milestones —
`D-13-07` (soft-dep gating), `D-15-01`/`D-15-02`, `D-16-08`/`D-16-11`/`D-16-12`
(indent ladder, severity ladder, reload-hint ladder). None of those has anything
to do with retry closure. The bare `D-13`/`D-15`/`D-16` forms introduced by this
delta map instead to the plan numbers `114-13`/`114-15`/`114-16`, i.e. exactly the
"Plan N" process reference the comment policy bans — and they are actively
misleading because a reader who greps `D-16` lands in the notify grammar.

`// WR-05` at `:6508` has the same problem in a different namespace: `WR-NN` is
the per-phase code-review finding ID space, reused with entirely different
meanings in `103-REVIEW.md`, `105-REVIEW.md`, and `v1.13-ROADMAP.md`.

**Fix:** Replace all four with the durable requirement IDs the behaviour actually
implements — NFR-3 ("All operations must be safe to retry — idempotent or
fail-clean") and NFR-2 for the reload-only recovery model. For `:6508`, drop the
`WR-05:` prefix and keep the sentence, which stands on its own:

```ts
// The hooks write is not on the replacement ledger, so the removed subtree
// cannot be restored. The record still claims the hook.
```

### WR-09: Stale `// Gap:` comment describes a fixture the rewrite deleted

**Severity:** WARNING
**File:** `tests/orchestrators/plugin/install.test.ts:3650-3653`

**Issue:**

```ts
test("retry proof: install: completion-cache maintenance failure stays installed and retry is idempotent", async (t) => {
  // Gap: dropMarketplaceCache try/catch in orchestrated mode -- EISDIR from
  // the unlink call is re-thrown by dropMarketplaceCache (not ENOENT), so the
  // catch appends the 'completion cache refresh deferred' string to
  // postCommitWarnings instead of firing notifyWarning.
```

The rewrite replaced the pre-created-directory/EISDIR fixture with a mocked
`unlink` that throws `new Error("cache maintenance denied")` (`:3675-3689`). There
is no EISDIR and no directory at the cache path any more, so the comment
misdescribes both the fault and the reason the catch fires. The asserted warning
string at `:3723` confirms it: `…completion cache refresh deferred: cache
maintenance denied`.

**Fix:** Rewrite to match the current mechanism, e.g.:

```ts
// The injected `unlink` refusal is not ENOENT, so dropMarketplaceCache
// re-throws and the orchestrator appends the deferral to postCommitWarnings
// instead of firing notifyWarning. Cache eviction is optimization-only, so
// the install stays committed and the retry is the already-installed arm.
```

The tmpdir prefixes for both rewritten maintenance cases (`install-orch-cache-`,
`install-orch-data-`) also still carry the pre-rewrite naming; renaming them to
`install-retry-cache-` / `install-retry-data-` would match the other eleven.

## Info

### IN-01: `.replaceAll("/", "\\/")` escapes a character that is not special in `RegExp(...)`

**File:** `tests/orchestrators/plugin/install.test.ts:8344`, `:8478`, `:8593`

**Issue:** `` new RegExp(`^ENOTDIR: … mkdir '${dir.replaceAll("/", "\\/")}\\/[0-9a-f-]+'$`) `` escapes forward slashes, which carry no meaning inside a `RegExp` constructor string (they only need escaping in a `/…/` literal). Meanwhile `.`, `+`, `(`, and `[` in the path are left unescaped. `mkdtemp(tmpdir())` currently yields `/tmp/<prefix>-<alnum>` so nothing bites, but the escaping is doing the opposite of what it appears to.

**Fix:** Drop the `replaceAll` and escape the metacharacters that matter:
`dir.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")`.

### IN-02: Hard-coded `/tmp/retry-proof-decoy` symlink target

**File:** `tests/orchestrators/plugin/install.test.ts:9116`

**Issue:** The containment fixture points a symlink at a fixed absolute system path shared by every concurrent test run and every user on the box. Nothing is written there and the target is never created, so today it is inert — and it mirrors the pre-existing `/tmp/decoy` at `:2845`. It is still a fixed system path in a suite that otherwise owns every path it touches, and on macOS `/tmp` is itself a symlink to `/private/tmp`.

**Fix:** Point the decoy at a path derived from the case-owned `escape` temp root, as `uninstall.test.ts:4218` already does with its `mkdtemp`-created escape directory.

### IN-03: Reinstall's retry proof runs through the `__deps` test-only seam

**File:** `tests/orchestrators/plugin/reinstall.test.ts` — 12 of 14 new cases pass `__deps: deps`

**Issue:** `orchestrators/plugin/reinstall.ts:208` documents `__deps` as `/** @internal Test-only seams; production callers omit this. */`. The seam predates this delta (introduced in v0.1.7, `887c29fb`) and the earlier full-scope review closed clean over it, so it is not a delta defect. Worth recording only because it bounds what the reinstall retry proof demonstrates: `dropMarketplaceCache`, `removeDataDir`, and `saveState` are injected test closures, so the proof covers the ledger, not the production wiring to those three collaborators. The post-save hook-cache case (the only new case that passes no `__deps`) correctly omits it and is the one case that exercises the default path end to end.

**Fix:** None required for this delta. If the seam is ever retired in favour of explicit collaborators (the pattern `CONVENTIONS.md` prescribes), these cases convert mechanically.

### IN-04: Pre-existing real 50 ms sleep

**File:** `tests/orchestrators/plugin/reinstall.test.ts:2270`

**Issue:** `await new Promise((r) => setTimeout(r, 50));` used to force an mtime delta. Outside the delta (the delta starts at `:5436`) and inside the earlier clean pass, so not a finding against these commits. Recording it because the hermeticity brief asked about sleeps, and because the delta's own mtime-stability assertions (`uninstall.test.ts:3377`, `:3671`) achieve the same goal without one.

**Fix:** Replace with the delta's own pattern — snapshot `mtimeMs` before and after and assert equality — or with `t.mock.timers`.

### IN-05: The install schedule vocabulary labels retry residue removal as `undo:`

**File:** `tests/orchestrators/plugin/install.test.ts:174` (and `:180`, `:196` for the sibling bridges), asserted at `:9059`, `:9063`, and `:9310`

**Issue:** `observeRetryBridgeSchedule` records `undo:skills` on any `rm` of the skill target, so the *second* call's removal of first-call residue before re-committing shows up as `undo:skills` inside an otherwise-successful schedule:

```ts
assert.deepStrictEqual(secondSchedule, [
  "prepare:skills",
  "undo:skills",     // actually: replace-residue removal, not a ledger undo
  "commit:skills",
  ...
]);
```

The assertion still discriminates; the vocabulary just says something the event does not mean, and a future reader will read a rollback into a clean retry.

**Fix:** Distinguish the two by position — record `replace-residue:skills` when the removal precedes a `commit:` for the same bridge, or record the raw `rm:<target>` and let the case's literal name it.

---

_Reviewed: 2026-09-01T18:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Scope: gap-closure delta (`2323c894^..HEAD`, 3 files). Prior full-scope pass 2026-09-01T15:42:31Z: 35 files, clean, 1 resolved finding._
