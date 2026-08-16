---
phase: 104-pre-install-read-surfaces
reviewed: 2026-08-15T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - tests/domain/resolver-default-enabled.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/shared/notify-not-installed-reasons.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/architecture/catalog-uat.test.ts
  - docs/output-catalog.md
  - docs/messaging-style-guide.md
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 104: Code Review Report

**Reviewed:** 2026-08-15
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The phase adds an entry-sourced `{installs disabled}` token to the two not-installed
candidate row families on `list` and `info`. The mechanics are sound and well gated:
`entryDeclaresInstallDisabled` uses the strict `=== false` comparison and is unit-pinned
on all four input classes; the `info` composer sits at the single not-installed consumer
behind a `satisfies Record<PluginInfoRow["status"], boolean>` total map, so a ninth info
status fails the compile rather than inheriting silence; the DFEN-08 no-op parity holds by
construction (`applyInstallDisabledRowShape` early-returns the same object, and the list
composer spreads an empty object). I independently ran `tsc --noEmit`, ESLint over all 13
source/test files, and the `architecture`, `shared`, `docs`, `list`, `info`, `catalog-uat`
and `resolver-default-enabled` suites — all green. The mutation tests do their job: the two
warm-clone tests fail the moment either surface starts honoring `plugin.json`, and the
resolver unit tests fail under both the `!entry.defaultEnabled` and the
`entry.defaultEnabled !== true` rewrites.

One correctness defect survives that scope: the claim is derived from the marketplace
entry ALONE, but the install path that the claim predicts checks the user's config
`enabled` declaration FIRST, and that declaration wins in both directions. A not-installed
plugin whose config already says `enabled: true` will install ENABLED while the row asserts
it installs disabled. This is a live over-claim on the one surface built to inform the
install decision, and it is not one of the phase's locked divergences — the CONTEXT
weighs entry vs. `plugin.json` and never mentions config precedence at all.

Secondary issues are traceability and comment hygiene: a GSD process reference slipped into
a production comment, the locked divergence is anchored to a requirement ID that owns a
different divergence, and the same six-sentence rationale is restated near-verbatim at ten
sites.

## Critical Issues

### CR-01: `{installs disabled}` ignores the config `enabled` declaration the install path checks first — the row over-claims

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:667-669`, `:746`, `:768`; `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1086-1093`

**Issue:**
The row asserts what an install WOULD do, but it models only one of the two inputs the
install decision actually reads. `orchestrators/plugin/install.ts:1680-1683` computes the
verdict as a three-way conjunction:

```ts
disabledInstall.landed =
  opts.applyDefaultEnabled === true &&
  declaredEnabled === undefined &&              // <-- the user's config opinion
  !result.installCtx.resolved.defaultEnabled;
```

`readDeclaredEnabled` (`install.ts:1478-1488`) reads `plugins["<plugin>@<marketplace>"].enabled`
across both physical config files, and the install comment states the rule explicitly:
"an explicit `enabled` wins in either direction and is never overwritten". Both install
entry points pass `applyDefaultEnabled: true` (`edge/handlers/plugin/install.ts:95`,
`orchestrators/reconcile/apply.ts:596`), so condition 1 always holds — condition 2 is the
one the new claim drops.

Reachable failure: a user hand-adds `"alpha@mp1": { "enabled": true }` to
`claude-plugins.json` for a plugin declared in the marketplace manifest with
`defaultEnabled: false`, and has not reloaded yet. No installation record exists, so
`availableRowMessage` builds the row and `list` prints:

```text
● mp1 [user]
  ○ alpha v1.0.0 (available) {installs disabled}
```

Running `install alpha@mp1` (or the next `/reload` reconcile) hits
`declaredEnabled === true`, so `disabledInstall.landed` is `false` and the plugin lands
ENABLED. The row predicted the opposite. `info` has the identical gap.

This is the failure mode the phase's own rationale claims to avoid — "Where the entry is
silent, the surfaces DECLINE to claim" is applied only to the `plugin.json` axis; the
config axis produces a positive claim that is false. Note the asymmetry with the accepted
under-claim: a silent entry over a `defaultEnabled: false` clone renders bare (safe,
locked), whereas this case renders a token that is wrong (unsafe, unconsidered).

The data is already in hand on both surfaces, so this is not an NFR-5 constraint:
`list.ts:1110-1117` already awaits `loadMergedScopeConfig` for both scopes, and
`info.ts:2331` already loads it per scope for `autoupdate`. Neither threads
`merged.plugins[key].entry.enabled` into the row builder.

**Fix:** Gate the token on the config declaration being absent, mirroring the install
predicate. In `list.ts`, thread the already-loaded merged view down to `availableRowMessage`
and replace the bare predicate:

```ts
// OUT-02 / DFEN-04 / DFEN-05: the install lands disabled only when the user has
// stated NO `enabled` opinion for this key -- an explicit declaration wins in
// either direction (install.ts::readDeclaredEnabled). A claim that ignores it
// predicts an outcome the install path will not produce.
const declaredEnabled = merged.plugins[`${manifestEntry.name}@${mpName}`]?.entry.enabled;
const claims = declaredEnabled === undefined && entryDeclaresInstallDisabled(manifestEntry);
const installsDisabledField: {
  readonly reasons?: NonNullable<PluginAvailableMessage["reasons"]>;
} = claims ? { reasons: ["installs disabled"] } : {};
```

and apply the same `declaredEnabled === undefined` conjunct in `info.ts`'s
`applyInstallDisabledRowShape` (pass the merged view or the resolved boolean down from
`buildBlock`, which already has `locations` and the scope in hand).

If the team prefers to ship the entry-only rule as-is, this must become an explicit,
recorded divergence with a pinning test (the same treatment the `plugin.json` divergence
received) — not an unstated gap. Silently shipping a token that contradicts the install
it predicts is worse than the warm/cold asymmetry the phase went to some length to avoid.

## Warnings

### WR-01: GSD process artifact in a production comment

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:689-690`

**Issue:**
```ts
// OUT-02 / OUT-05 / D-104-06: the cold row is the one that carries the
// phase's argument. Nothing is materialized here -- no clone, no
```

`.claude/rules/typescript-comments.md` forbids "any other phrasing whose only purpose is
to record which planning artifact authored the line". "the phase's argument" is exactly
that: it names the GSD phase as the referent, and once
`.planning/workstreams/defaults-enabled/phases/104-*` is archived a reader has no way to
resolve which argument is meant. The rest of the comment carries the reasoning on its own,
so the clause is pure process residue.

**Fix:**
```ts
// OUT-02 / OUT-05 / D-104-06: the cold row is the hardest case for the
// entry-only rule. Nothing is materialized here -- no clone, no
```

### WR-02: The locked divergence is anchored to a requirement ID that owns a different divergence

**File:** `tests/orchestrators/plugin/list.test.ts:920`, `tests/orchestrators/plugin/info.test.ts:3568`

**Issue:**
Both warm-clone tests — the load-bearing guards against a future "fix" that reopens the
warm/cold asymmetry — close with:

```ts
//    network-free requirement forbids. DOC-02 owns the written-up
//    divergence; the full argument lives there.
```

`DOC-02` in `.planning/workstreams/defaults-enabled/REQUIREMENTS.md:51` is a DIFFERENT
divergence: "the dependency-requirement override ... Claude writes an explicit `true` for a
plugin required by another active plugin, which we cannot do because plugin dependency
declarations are not honored at all (BACKLOG.md PDEP-01)". Nothing in DOC-02's text covers
the entry-vs-`plugin.json` read asymmetry, and DOC-02 is still `Pending` against Phase 105
(`REQUIREMENTS.md:90`), so the "full argument" a reader is sent to fetch does not exist yet
and will not be about this topic when it does.

Compounding it, `OUT-02` (`REQUIREMENTS.md:43`) still reads "a not-installed plugin whose
**resolved** `defaultEnabled` is `false`". The shipped rule is entry-only, so a warm clone
with a silent entry and `plugin.json: { defaultEnabled: false }` has a resolved value of
`false` and renders bare — the implementation contradicts the requirement's literal text.
The combination is the drift hazard the tests were written to prevent: the next reader sees
a requirement that says "resolved", follows the only in-source pointer, lands on an
unrelated requirement, and concludes the bare row is a bug.

**Fix:** Cite the anchors that actually own the rule and exist today — `D-104-01` (entry is
the sole source) and `OUT-05` (no fetch, no `plugin.json`) — in both test comments:

```ts
//    network-free requirement forbids. D-104-01 / OUT-05 own the rule;
//    do not "fix" this toward what install reads.
```

and amend `OUT-02` to `"...whose marketplace ENTRY declares defaultEnabled: false (the
entry-only carve-out is OUT-05 / D-104-01)"` so the requirement and the code agree. If
Phase 105 is genuinely meant to write this divergence up under DOC-02, DOC-02's requirement
text must be widened to cover it before the citation is accurate.

### WR-03: The same rationale is duplicated near-verbatim across ten sites

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:625-656`, `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:648-669` and `:689-697`, `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1007-1085`, `extensions/pi-claude-marketplace/shared/notify.ts:828-846` and `:855-881`, `tests/orchestrators/plugin/list.test.ts:903-921`, `tests/orchestrators/plugin/info.test.ts:3551-3569`, `docs/output-catalog.md:380`, `:415`, `:1752`

**Issue:**
The argument "the entry is the only source; reading `plugin.json` would make the same plugin
render differently warm and cold; closing the gap the other way needs a fetch OUT-05
forbids" is restated in full at five production sites, two test files and three doc blocks.
The two test blocks are literal copy-paste: `list.test.ts:903-921` and
`info.test.ts:3551-3569` differ only in two words ("everything else on the row staying put"
vs "the component lines and everything else staying put"). Likewise, "Absent `reasons`
renders the legacy brace-less row byte-for-byte: `composeReasons` returns `""` for an
undefined list and `joinTokens` collapses the empty slot" appears verbatim twice in
`notify.ts` alone.

The ratio is the concrete cost: `entryDeclaresInstallDisabled` is one statement under a
32-line docblock; `applyInstallDisabledRowShape` is six statements under 45 lines of
docblock plus a 33-line docblock on its status map. The project convention encourages
rationale comments, but ten copies of one argument is a drift surface — the next edit to the
rule will update some of them. CR-01 above is a live example of what divergent copies cost:
every one of the ten sites asserts "the entry is the only source" as if it were the whole
input, and none of them mentions the config precedence the install path applies first.

**Fix:** Keep the full argument in exactly one canonical home — the
`entryDeclaresInstallDisabled` docblock in `domain/resolver.ts`, which is where a reader
chasing the predicate lands — and reduce every call site and test to one sentence plus the
`D-104-01` anchor, e.g.:

```ts
// OUT-02 / D-104-01: entry-sourced only; see `entryDeclaresInstallDisabled`
// for why the plugin's own manifest is never consulted here.
```

Deduplicate the two identical test comment blocks the same way (one of them keeps the
argument, the other cites it).

## Info

### IN-01: The `(available)` token-table row was not updated alongside `(remote)`

**File:** `docs/output-catalog.md:139` (vs `:144`)

**Issue:** The `(remote)` row now documents that it admits the entry-derived
`{installs disabled}` token, but the `(available)` row's "Where it appears" cell is
unchanged even though `(available)` gained the same capability in the same change. A reader
scanning the table sees the token documented for one of the two candidate families.

**Fix:** Add a matching clause to the `(available)` cell, e.g. "...(no scope bracket per
MSG-PL-6 / SNM-11). Admits the entry-derived `{installs disabled}` install-time-state marker
(D-104-03)."

### IN-02: The network-free gate's docstring and failure message no longer describe its target set

**File:** `tests/architecture/no-orchestrator-network.test.ts:8-32`, `:101`

**Issue:** `FORBIDDEN_TARGETS` now includes `domain/resolver.ts`, but the header's
"Forbidden surface, by file:" enumeration lists only five orchestrator files (it already
omitted `reconcile/pending.ts`, `reconcile/plan.ts`, `reconcile/notify.ts`,
`enable-disable.ts` and `fetch.ts`), and the failure message still reads "gitOps surface
detected in plugin **orchestrator(s)**" — which will misdescribe a `domain/` offender. The
added entry is genuinely load-bearing (the `import-boundaries` gate does NOT forbid
`domain` -> `platform`, so this is the only structural guard for resolver.ts), which makes
the stale framing worth correcting rather than ignoring.

**Fix:** Add a `domain/resolver.ts` bullet to the header enumeration (and the five missing
orchestrator entries while there), and reword the failure message to "network-free
module(s)" so it stays true for a non-orchestrator target.

### IN-03: Out-of-scope doc edits bundled into the style-guide change

**File:** `docs/messaging-style-guide.md:66`

**Issue:** Two edits in this line are unrelated to the phase. "exactly three transition
variants" became "four ... and `disabled` (ENBL-16 / D-100-07)" — a correction of a
pre-existing doc error about `PluginDisabledMessage` (`notify.ts:818`), which no part of this
phase touched. And the enumerable closing clause "Every remaining variant omits the field
entirely" was replaced with "Read `notify.ts` for which shapes declare the field", which
trades a checkable spec statement for a pointer at the implementation. CLAUDE.md §3
(Surgical Changes) asks that every changed line trace to the request.

**Fix:** Keep the `available` / `remote` addition; revert the `disabled` correction into its
own commit (or leave it, but flag it in the summary rather than folding it in silently), and
restore the enumerable form: "Every remaining variant omits the field entirely, so
`(uninstalled) {up-to-date}` is a compile error."

### IN-04: `installsDisabledField` is typed off the wrong message shape for one of its two consumers

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:667-669`, spread at `:703`

**Issue:** The holder is typed `NonNullable<PluginAvailableMessage["reasons"]>` but is
spread into a `PluginRemoteMessage` literal at line 703 as well as the
`PluginAvailableMessage` literal at line 746. It compiles today because the two shapes
declare identical `reasons?: readonly ContentReason[]`, but the declaration reads as if the
value belongs to one shape only, and any future narrowing of either shape surfaces the
error at a site whose type annotation names the other one.

**Fix:** Type the holder against the intersection of the two consumers, or name it neutrally:

```ts
const installsDisabledField: { readonly reasons?: readonly ContentReason[] } =
  entryDeclaresInstallDisabled(manifestEntry) ? { reasons: ["installs disabled"] } : {};
```

---

_Reviewed: 2026-08-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
