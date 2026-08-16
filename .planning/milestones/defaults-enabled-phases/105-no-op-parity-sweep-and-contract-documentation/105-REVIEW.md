---
phase: 105-no-op-parity-sweep-and-contract-documentation
reviewed: 2026-08-15T23:07:04Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - docs/plugin-enablement.md
  - docs/output-catalog.md
  - docs/messaging-style-guide.md
  - README.md
  - README.es.md
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
findings:
  critical: 0
  warning: 7
  info: 4
  total: 11
status: issues_found
---

# Phase 105: Code Review Report

**Reviewed:** 2026-08-15T23:07:04Z
**Depth:** standard
**Files Reviewed:** 19 (plus `tests/domain/resolver-default-enabled.test.ts`, `tests/shared/notify-not-installed-reasons.test.ts`, `.planning/workstreams/defaults-enabled/REQUIREMENTS.md` read as context)
**Status:** issues_found

## Summary

This is a characterization + documentation phase. The production diff is one type
annotation (`installsDisabledField` retyped to `readonly ContentReason[]` in
`orchestrators/plugin/list.ts:681`) plus comment re-anchoring; everything else is
tests, `docs/`, and planning records. I re-verified that: no behavior changed,
`npx tsc --noEmit` is clean, `npx eslint` on every changed `.ts` is clean,
`mdformat` + `markdownlint` pass on every changed `.md`, and the full unit suite
(`npm test`) is green at 3551 passed / 1 skipped / 0 failed. No scope creep was
found — every production hunk is a comment or the one named retype.

I traced the new `docs/plugin-enablement.md` claim-by-claim against the shipped
code. The load-bearing claims hold: the three-input precedence
(`entryDeclaresInstallDisabled` / `rowClaimsInstallDisabled` /
`resolveDefaultEnabled` in `domain/resolver.ts`, `readDeclaredEnabled` +
the three-term conjunction at `orchestrators/plugin/install.ts:1680-1683`), the
write-through in both standalone and orchestrated modes
(`install.ts:1749-1805`), the unconditional reconcile opt-in
(`orchestrators/reconcile/apply.ts:596`), the `update`/`reinstall` source-level
guard (`tests/architecture/no-lifecycle-default-enabled-read.test.ts`), the
enable/disable dual write (`enable-disable.ts:621,694`), the `isDeclaredEnabled`
single-home claim (`persistence/config-io.ts:88`), and the dependency claim —
which correctly says "parsed and surfaced, never resolved"
(`normalizeDependencies`, `info.ts:342`, sole consumer at `info.ts:858`; the
`PI-13` "deps note" referenced in `install.ts` comments has no surviving
producer). The three new parity tests are genuinely falsifiable: each asserts a
whole-body byte literal *and* compares the declared-true row against the silent
row after name substitution, and each carries a control (version movement /
outcome partition / record enablement) so a fixture that never reached the path
under test cannot pass. The reconcile test correctly confines the parity claim
to the `true`/silent pair and asserts the `false` arm on its own terms. The
deleted `list.test.ts` probe removed no unique coverage — the sibling at
`tests/orchestrators/plugin/list.test.ts:617-627` probes with `stat` after the
call and asserts `ENOENT` rather than a hollow boolean.

What did not hold up: one doc edit turned a safe pointer into a demonstrably
false universal statement, one surviving test title now over-promises what its
body checks, the contract document omits a real mutating entry point (`import`)
and presents an unverifiable "quotation" from upstream, the rewritten
architecture-gate header mis-describes its own target set, and a few re-anchored
citations point at requirements that do not cover the claim they now anchor.
The DFEN-08 install surface is also weaker than the phase's scoping assumed.

## Warnings

### WR-01: The style-guide edit replaced a safe pointer with a false universal claim

**File:** `docs/messaging-style-guide.md:66`
**Issue:** The phase rewrote the tail of the `reasons` bullet from

> `Read notify.ts for which shapes declare the field; the variants that omit it cannot acquire one`

to

> `Every remaining variant omits the field entirely and cannot acquire one`

That universal is false. The bullet lists `reasons` as REQUIRED only on
`partially-available | unavailable | upgradable | skipped | failed | manual recovery`
and OPTIONAL on six others — but `PluginPartiallyInstalledMessage`
(`shared/notify.ts:970-973`) and `PluginPartiallyUpgradableMessage`
(`shared/notify.ts:993-996`) both declare `readonly reasons: readonly ContentReason[]`
as REQUIRED and appear in neither list. The old sentence deferred to the source
and was therefore safe under that pre-existing list gap; the new sentence
converts the gap into an assertion the source contradicts. `docs/messaging-style-guide.md`
is one of only two docs enrolled in an automated guard, and nothing checks this
sentence.
**Fix:** Either restore the pointer, or extend the REQUIRED list:

```markdown
- `reasons: readonly Reason[]` REQUIRED only on `partially-available | partially-installed |
  partially-upgradable | unavailable | upgradable | skipped | failed | manual recovery` (D-15-01).
  ... Every remaining variant omits the field entirely and cannot acquire one, so
  `(uninstalled) {up-to-date}` is a compile error.
```

### WR-02: A surviving test title promises a guarantee its body no longer checks

**File:** `tests/orchestrators/plugin/list.test.ts:2965`
**Issue:** The phase correctly deleted the hollow NFR-5 probe (it `readFile`'d a
directory and ran before the call), but left the test named:

> `RSTA-01 / NFR-5: list renders an uninstalled git plugin (remote) with no plugin-clones dir on disk (no clone, no network)`

The body now asserts only `assert.match(out, /◌ gplug v1\.0\.0 \(remote\)/)`.
Nothing in it inspects `plugin-clones/`, so the title claims a network-free
guarantee the test does not verify. A stale title that over-claims is the same
failure mode as the probe that was removed — a future maintainer reading the
suite index will believe this case gates NFR-5.
**Fix:** Rename to what it now proves, e.g.
`test("RSTA-01: list renders an uninstalled git plugin as (remote) with no clone materialized", ...)`,
and drop `NFR-5` from the title — the sibling at `list.test.ts:617-627` owns that
guarantee and cites it correctly.

### WR-03: The contract document omits the `import` surface, and its install row implies universality

**File:** `docs/plugin-enablement.md:21` (surface table), `:19-25`
**Issue:** The install row says the disable fires when "the caller passed the
install-time opt-in (`applyDefaultEnabled`, **passed by the real entry points**)".
Exactly two call sites pass it: `edge/handlers/plugin/install.ts:95` and
`orchestrators/reconcile/apply.ts:596`. The bulk `import` cascade
(`orchestrators/import/execute.ts:695`) deliberately does NOT — `install.ts`'s own
comment records this as `D-102-03` ("so `import` never reaches here"). The
surface table has no `import` row and the divergences section does not mention
it, so a reader of the *durable home of the enablement contract* is left to
assume import behaves like the other install entry points. The outcome happens
to be identical today only because an imported ref always carries an explicit
`enabled` value — a fact the document never states, so the reader cannot derive
it either.
**Fix:** Add a table row (or one sentence under the install row):

```markdown
| Import cascade (`orchestrators/import/execute.ts`) | the user's configuration value only | The install-time opt-in is deliberately NOT passed (D-102-03), so the resolved declaration is never applied on this path. It changes no outcome, because every imported ref carries an explicit `enabled` value derived from Claude Code's `enabledPlugins`, which would outrank the declaration anyway. |
```

### WR-04: An unverifiable sentence is presented as a verbatim upstream quotation

**File:** `docs/plugin-enablement.md:39`
**Issue:** The divergence section reads: *"Claude Code's second override, quoted
from the upstream plugins reference: `"when a plugin is required by another one
that is active, Claude Code writes true for it at install or enable time. That
gives it an explicit setting, so its own default no longer applies."`"* The
sentence reads as paraphrase, not as upstream prose, and nothing in the
repository pins the source text. This is the only claim in the document that
depends entirely on an external artifact, and the document's whole premise is
"claims here are transcribed from the shipped sources named at each claim" —
which does not apply to this one. If the wording is not verbatim, the document
puts words in the upstream doc's mouth in the one section a reader is most
likely to cite.
**Fix:** Either paste the exact upstream sentence with its retrieval date, or
demote to a paraphrase and drop the quotation marks:

```markdown
Claude Code's second override, paraphrased from [the upstream plugins reference](https://code.claude.com/docs/en/plugins-reference) (retrieved 2026-08-15): a plugin required by another *active* plugin is written `true` at install or enable time, which gives it an explicit setting so its own default no longer applies.
```

### WR-05: The rewritten network-gate header mis-describes its own target set

**File:** `tests/architecture/no-orchestrator-network.test.ts:14-18`
**Issue:** The phase replaced an accurate per-file list with a prose summary:

> "What the gate covers, in general terms: the network-free modules. Those are
> the read-only plugin and marketplace orchestrators, the reconcile
> pending/planner/projection family, and one file OUTSIDE the orchestrator layer
> -- the resolver."

Three of the ten targets contradict "read-only … orchestrators":
`orchestrators/plugin/install.ts` and `orchestrators/plugin/enable-disable.ts`
are mutating ledgers, and `orchestrators/plugin/fetch.ts` is the one verb whose
whole purpose is materializing a clone through the `clone-cache.ts` seam. The
old per-file block was verbose but true; the summary that replaced it is
shorter and false, which is a worse trade for a comment whose job is to tell a
maintainer why a file is (or is not) in the list.
**Fix:** State the actual membership rule rather than a category:

```ts
 *   What the gate covers: every module that must not name a git surface of its
 *   own -- the read-only plugin/marketplace orchestrators, the reconcile
 *   pending/planner/projection family, the two mutating verbs that reach git
 *   only through the `clone-cache.ts` seam (`install.ts`, `fetch.ts`),
 *   `enable-disable.ts` (re-materializes from cache), and one file outside the
 *   orchestrator layer -- the resolver -- whose obligation is inherited from
 *   the two read surfaces it answers for.
```

### WR-06: Two re-anchored citations point at requirements that do not cover the claim

**File:** `tests/shared/notify-not-installed-reasons.test.ts:141`, `:1-3`
**Issue:** The central-renderer drop test for the **`(available)`** row was
re-anchored `D-104-06` → `OUT-05 / RSTA-01`:

```ts
test("OUT-05 / RSTA-01: the CENTRAL row renderer drops a stamped reason on the `(available)` row", ...)
```

`RSTA-01` reads (archived `fetch-plugin-REQUIREMENTS.md:26`): *"User sees
`(remote)` — a new closed-set plugin status for a not-installed git-source plugin
… Plugin rows only; never applies to installed plugins."* It says nothing about
the `(available)` row and nothing about the central renderer dropping a reasons
field; `OUT-05` is the network-free read requirement, which also does not cover
the drop. The file header applies the same pair to both rows. This is the exact
defect the previous phase's review caught — a citation that no longer covers its
claim reads as traceability while providing none. The sibling `(remote)` test
(`:145`) is fine, since `RSTA-01` genuinely owns that row.
**Fix:** Anchor the `(available)` case on `OUT-02` (which after this phase's own
amendment owns the `(available)` pre-install token) and keep `RSTA-01` on the
`(remote)` case only; if the *drop* itself has no requirement-level home, say so
in the comment rather than borrowing an ID.

### WR-07: DFEN-08's install surface has no declared-true vs silent parity pair

**File:** `tests/orchestrators/plugin/install.test.ts:1231` (the case the phase
scoped as install coverage), `.planning/.../105-CONTEXT.md:39-40`
**Issue:** DFEN-08 claims byte-identical behavior and output across **six**
surfaces — install, update, reinstall, list, info, reconcile. The phase added new
parity pairs for three (update, reinstall, reconcile) and relies on pre-existing
gates for list/info (both of which *do* contain a real declared-true vs silent
byte pair, e.g. `list.test.ts:616` "a declared-true entry and a silent entry stay
bare"). For the standalone **install** surface, the cited case is
`"an explicit enabled: false is not rewritten by a defaultEnabled-true manifest (DFEN-08)"`
— but that case seeds an explicit `enabled: false`, so it exercises DFEN-05
precedence, never the silent-user arm, and it asserts records/artifacts rather
than the rendered notification row. No test compares the install notification of
a `defaultEnabled: true` entry against the silent-entry control. Given that
`install` is the one verb that legitimately reads the field, it is the surface
where a parity regression is most likely and the least covered.
**Fix:** Add the same three-arm fixture used in the update/reinstall tests to
`install.test.ts`, asserting the rendered row for `beta` (declared true) and
`gamma` (silent) against each other and against the literal:

```ts
assert.equal(betaRow.replaceAll("beta", "<plugin>"), gammaRow.replaceAll("gamma", "<plugin>"),
  "DFEN-08: the declared-true install row and the silent install row must COINCIDE");
```

## Info

### IN-01: GSD process vocabulary survived the sweep in three new comments

**File:** `tests/orchestrators/plugin/update.test.ts:3348`, `:3457`;
`tests/orchestrators/plugin/reinstall.test.ts:4006`
**Issue:** The new docblocks say *"what this milestone owes them"* and *"where the
pre-milestone tree read three"*. `.claude/rules/typescript-comments.md` forbids
process references whose purpose is to record which planning artifact authored
the line; this phase specifically swept for such survivors, so these are notable.
Mitigating: bare "milestone" already appears in pre-existing comments
(`enable-disable.test.ts:2483`, `list.test.ts:897`), so this matches local
precedent rather than introducing a new pattern.
**Fix:** Restate in durable terms — "what DFEN-08 owes them" and "where the
pre-`defaultEnabled` tree read three".

### IN-02: The surface table's short restatement of the entry-only rule is imprecise

**File:** `docs/plugin-enablement.md:24`
**Issue:** The read-surfaces row ends "The plugin's own `plugin.json` is never
read here." Taken literally that is false for a warm `(available)` row: the
resolver does read `plugin.json` on that path (`readManifest`, `domain/resolver.ts`)
to enumerate components, and `resolveDefaultEnabled` even computes a value from
it — the surfaces simply never *consult* that value for the claim, calling
`entryDeclaresInstallDisabled` instead. Line 43 states this precisely ("answer
the manifest side … from the MARKETPLACE ENTRY and nothing else"); the table's
compression loses the distinction.
**Fix:** "The plugin's own `plugin.json` never answers this claim, even where a
warm clone makes it readable."

### IN-03: The requirements this phase re-anchors onto were themselves rewritten in this phase

**File:** `.planning/workstreams/defaults-enabled/REQUIREMENTS.md:43`, `:51`
**Issue:** `OUT-02` (already marked `[x]` complete from a prior phase) and
`DOC-02` were both rewritten here to describe what shipped — `OUT-02` gained the
entry-only + user-precedence rule, and `DOC-02` was widened from "the dependency
divergence is documented" to "the enablement contract is written down in
`docs/plugin-enablement.md`, the durable home of two divergences … so source
comments citing that rule have a requirement-level anchor that does not archive".
The 73-citation re-anchoring is valid *because of* that edit, so the phase both
defines and satisfies its own anchor. The rewrite is recorded and defensible
(the original `OUT-02` wording was wrong about which side is read), but it should
be surfaced at milestone close rather than absorbed silently.
**Fix:** No code change. Note the amendment in the phase SUMMARY / milestone
record so the requirement's history is visible.

### IN-04: The new user-facing doc is not enrolled in the existing doc vocabulary guard

**File:** `tests/architecture/partial-vocabulary-guard.test.ts:84-88`
**Issue:** `collectGuardedSources()` hardcodes exactly two docs
(`docs/output-catalog.md`, `docs/messaging-style-guide.md`).
`docs/plugin-enablement.md` is a third user-facing doc that describes the same
row vocabulary and is not enrolled, so retired force/unsupported tokens could
reappear there undetected. It contains none today, so nothing is broken now.
(This is distinct from, and not an argument against, the deliberate decision that
the doc carries no byte-equality gate.)
**Fix:** Add `path.join(REPO_ROOT, "docs", "plugin-enablement.md")` to the
`readInto` list and to the sanity assertion at `:141`.

---

_Reviewed: 2026-08-15T23:07:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
