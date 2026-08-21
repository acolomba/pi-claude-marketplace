---
phase: 101-manifest-field-and-precedence-resolution
reviewed: 2026-08-14T15:32:06Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/components/plugin.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - tests/bridges/agents/stage.test.ts
  - tests/bridges/commands/discover.test.ts
  - tests/bridges/commands/stage.test.ts
  - tests/bridges/integration-foreign-content.test.ts
  - tests/bridges/integration-materialization-gate.test.ts
  - tests/bridges/integration.test.ts
  - tests/bridges/skills/discover.test.ts
  - tests/bridges/skills/stage.test.ts
  - tests/domain/manifest.test.ts
  - tests/domain/resolver-loose.test.ts
  - tests/domain/resolver-strict.test.ts
  - tests/domain/resolver.types.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/plugin-state-classifier.test.ts
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 101: Code Review Report

**Reviewed:** 2026-08-14T15:32:06Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Two production files changed: `domain/components/plugin.ts` adds an optional
`defaultEnabled` boolean to the shared `PLUGIN_METADATA_FIELDS` bag (so it lands
on both `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA`), and
`domain/resolver.ts` resolves the precedence rule once and threads the answer
through to the two materializable arms. The remaining 15 files are test-side.

I attacked the four things the phase brief asked to be scrutinized. Results:

1. **Single evaluation site — verified.** A whole-tree grep for `defaultEnabled`
   returns exactly one call to `resolveDefaultEnabled`, at
   `domain/resolver.ts:820` inside `preflightStages`. Every materializable
   result is built by `materializableFields`, which is reachable only through
   `installable()` / `partiallyAvailable()`, which are reachable only through
   `decideResolution`, which is called from exactly two places
   (`resolveStrict:1455`, `resolveLoose:1527`). Both destructure the value out of
   the shared preflight result. There is no early return, error arm, or
   git-source branch that constructs a materializable arm with a synthesized or
   defaulted value. The git-source path (`deriveSourcePluginRoot` →
   `materialized`) falls through to the same `readManifest` +
   `resolveDefaultEnabled` sequence against the clone-anchored root, which is
   correct.
2. **strict/loose parity — verified structurally, not just behaviorally.** The
   two modes cannot diverge because neither computes the value; both read it out
   of `preflightStages`, which runs before either mode's first mode-specific
   step. That is a stronger guarantee than the parity tests provide. See WR-03
   for a doc-contract consequence of this.
3. **Test honesty — one tautological test found (WR-02) and one arm left
   entirely unasserted (WR-01).** The rest of the new domain tests are
   mutation-sensitive: reverting `resolveDefaultEnabled` to a constant `true`,
   or inverting the entry/manifest precedence, fails multiple of them.
4. **Seeder knobs — correctly guarded.** Both new knobs in
   `install.test.ts` are `!== undefined`-gated and mutate the fixture objects
   only when supplied, so no pre-existing fixture shape changes. Naming is
   inconsistent with the existing pair, though (WR-06).

Verification run locally in the worktree: `npx tsc --noEmit` clean; `npx eslint`
on all 8 non-trivially-changed files clean; `node --test` green on
`tests/domain/*` (153), `tests/docs/` + `info.test.ts` +
`plugin-state-classifier.test.ts` (84), and `install.test.ts` (102).

No BLOCKER-class defect found in the production diff. The change is small,
correctly threaded, and type-enforced. The findings below are all test-quality
and contract-documentation issues, plus one deliberate-but-worth-recording risk.

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: The `partially-available` arm's `defaultEnabled` is never asserted by any test

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:1476` (assertion gap in `tests/domain/resolver-strict.test.ts:692-843`, `tests/domain/resolver-loose.test.ts:119-196`)

**Issue:** `decideResolution` forwards `defaultEnabled` on two branches:

```ts
if (partial.unsupported.length > 0) {
  return partiallyAvailable(name, pluginRoot, partial, defaultEnabled);  // line 1476
}

return installable(name, pluginRoot, partial, defaultEnabled);           // line 1479
```

Every new precedence test asserts `r.state === "installable"` (or calls
`requirePartialInstallable` on a fixture that has no unsupported kinds, so it is
still `installable`). No test ever resolves a plugin to `partially-available`
and reads `r.defaultEnabled`. That means line 1476 could be edited to
`partiallyAvailable(name, pluginRoot, partial, true)` — hardcoding the default
on the partial arm — and the whole suite stays green, `tsc` stays green, and
ESLint stays green. This is exactly the arm phase 102 will consume when
`--partial` installs a `defaultEnabled: false` plugin, so the untested branch is
the one most likely to leak a wrong value later.

The `installable` arm is covered five times over; the partial arm zero times.
The asymmetry is the finding, not the absolute coverage number.

**Fix:** Add one strict-mode case that drives the plugin to the partial arm and
asserts the carried value. The existing `experimental` declaration is the
cheapest way to reach `partially-available` without a structural defect:

```ts
test("DFEN-02 partially-available arm carries the resolved defaultEnabled", async () => {
  const ctx = mockCtx(MP, {
    [ROOT("./local")]: "dir",
    [path.join(ROOT("./local"), ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1", themes: "./themes" }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local", defaultEnabled: false }), ctx);
  assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);
  requirePartialInstallable(r);
  assert.equal(r.defaultEnabled, false);
});
```

---

#### WR-02: `DFEN-01 entry declaring an unrelated unknown key -> still resolves` is tautological — it never touches the schema

**File:** `tests/domain/resolver-strict.test.ts:837-841`

**Issue:** The comment above the test states the intent explicitly: *"D-101-13 /
D-09: adding a named optional property to the schema must not have narrowed the
lenient unknown-key posture."* The test cannot verify that claim, for two
independent reasons:

1. `resolveStrict` never calls `PLUGIN_ENTRY_VALIDATOR`. It reads named fields
   off the entry and casts to `Record<string, unknown>` for everything else.
   Schema leniency is invisible to it.
2. The `basicEntry` helper (`tests/domain/resolver-strict.test.ts:81-83`) takes a
   `LooseEntry = Record<string, unknown>` and spreads it into a `PluginEntry`
   return, which suppresses TypeScript's excess-property check. So the unknown
   key is not even type-checked, let alone runtime-validated.

The test would pass unchanged if `PLUGIN_ENTRY_SCHEMA` were switched to
`additionalProperties: false` tomorrow. It asserts only "the resolver does not
crash on an extra object key", which was never in question.

The genuine D-09 coverage does exist — in `tests/domain/manifest.test.ts`, in
the two `vendorSpecificTelemetryKnob` tests that run the validators directly.
Those are the real proof; this one is decoration that reads like proof.

**Fix:** Either delete the test as redundant with the `manifest.test.ts` pair, or
retarget it at the validator so its title is true:

```ts
test("D-09 PLUGIN_ENTRY still tolerates unknown keys after defaultEnabled was added", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({ name: "p", source: "./local", zzzInventedKnob: "x" }),
    true,
  );
});
```

---

#### WR-03: `resolveLoose` now reads `plugin.json`, contradicting its own documented entry-only contract

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:9`, `:640-653`, `:1483-1485`

**Issue:** The module header states the mode split as an invariant:

```text
//   - resolveLoose  (MM-6/7): entry-only; manifest/standalone declarations conflict
```

and `resolveLoose`'s own doc repeats it: *"MM-6 / MM-7 loose: entry-only;
manifest or standalone declarations conflict."* After this change that is no
longer accurate. `resolveDefaultEnabled` is called from the shared
`preflightStages`, so in loose mode a `plugin.json`-declared `defaultEnabled`
with a silent entry is honored rather than treated as a conflict — while a
`plugin.json`-declared `skills` with a silent entry still produces
`component declarations conflict` and resolves `unavailable`. Two manifest
declarations, two opposite outcomes, from the same resolution mode.

I believe the behavior is intended (it is what `D-101-08` describes and what
`tests/domain/resolver-loose.test.ts:131` pins), and it is presently harmless
because `resolveLoose` has **no production caller** — a whole-tree grep finds it
only in `domain/index.ts`'s barrel and in tests. But the exception is recorded
*only* in a test comment. The next person reading the resolver header will
reasonably conclude loose mode is entry-only and either "fix" the metadata path
or build on a false premise when `strict: false` marketplaces get wired up.

**Fix:** Record the exception where the contract is stated, not only where it is
tested. Add to the `resolveLoose` doc comment and to `resolveDefaultEnabled`:

```ts
/**
 * MM-6 / MM-7 loose: entry-only for COMPONENT declarations; manifest or
 * standalone component declarations conflict. METADATA (description, version,
 * defaultEnabled) is not conflict material in either mode -- `defaultEnabled`
 * is resolved once in `preflightStages` and reads `plugin.json` in loose mode
 * exactly as it does in strict mode (D-101-08).
 */
```

---

#### WR-04: The install characterization tests pin only half of the "read but not acted on" contract

**File:** `tests/orchestrators/plugin/install.test.ts:789-825`, `:827-864`

**Issue:** The section comment states the contract as *"an install is recorded
`enabled: true` and its artifacts are materialized whatever the plugin
declares"*, and the two tests assert exactly that:

```ts
assert.equal(record.enabled, true);
assert.deepEqual([...record.resources.skills], ["hello-tool"]);
```

But the deliberate no-op has a second half that these tests leave unguarded: the
`claude-plugins.json` write-back. `install.ts:111` imports
`writeBatchedConfigEntries` and `install.ts:1408` writes the plugin entry back to
the user-authored config on every install. DFEN-04 explicitly describes that
entry's plugin patch as "currently-empty" and plans to make `enabled: false` its
first-ever field. So the config entry is the surface the next phase changes, and
it is the surface a premature change would silently land on — `state.json` could
stay `enabled: true` while the config gained an `enabled` key, and both tests
would still pass.

For a test whose entire job is to characterize "the value is read and
deliberately not acted on", asserting only one of the two write targets is a
real gap, not a nitpick.

**Fix:** Add a config assertion to both tests (or to one, if the seeder makes
this awkward for the manifest-declared case):

```ts
const cfg = JSON.parse(await readFile(locations.configPath, "utf8")) as {
  marketplaces?: Record<string, { plugins?: Record<string, object> }>;
};
assert.deepEqual(
  cfg.marketplaces?.["mp"]?.plugins?.["hello"],
  {},
  "DFEN-01: the resolved value must not reach the config write-back in this phase",
);
```

(adjust the accessor to the actual `claude-plugins.json` shape / `locations`
field name used by the neighbouring write-back tests.)

---

#### WR-05: Two ~45-line near-verbatim test duplications, one of which undermines its own claim

**File:** `tests/orchestrators/plugin/info.test.ts:407-458`, `tests/orchestrators/plugin/install.test.ts:789-864`

**Issue:** Two separate copy-paste pairs:

- `info.test.ts:407-458` duplicates `:361-405` line for line, differing only by
  the added `defaultEnabled: false` fixture field. The expected six-line message
  literal is copied verbatim. The test's title and comment assert the output is
  *byte-identical to the case above* — but because the expectation is duplicated
  rather than shared, a future renderer change that updates `:395-402` and not
  `:448-455` produces two tests disagreeing about the correct bytes, and the
  "same as above" claim silently stops being checked. The claim is precisely
  what a shared constant would have preserved.
- `install.test.ts:789-825` and `:827-864` differ only by `defaultEnabled: false`
  vs `pluginJsonDefaultEnabled: false` and the tmpdir prefix. Everything else —
  the hermetic-home wrapper, the seeder call, the error filter, the two
  assertions, the `finally` cleanup — is identical.

ESLint's `sonarjs/no-identical-functions` does not fire because the bodies differ
by one property, so nothing mechanical will catch the drift.

**Fix:** For the info pair, hoist the expectation:

```ts
const EXPECTED_FOO_INFO = [
  "● mp [user] <no autoupdate>",
  "  ● foo v1.2.3 (installed)",
  "    Foo plugin",
  "    agents: a1",
  "    commands: c1",
  "    skills: s1",
].join("\n");
```

and reference it from both tests, so "renders the same message" is enforced by
construction. For the install pair, drive both cases from one table:

```ts
for (const [label, knob] of [
  ["marketplace entry", { defaultEnabled: false }],
  ["plugin.json with a silent entry", { pluginJsonDefaultEnabled: false }],
] as const) {
  test(`DFEN-01: ${label} declares defaultEnabled false -> installs enabled with artifacts materialized`, async () => { /* ... */ });
}
```

---

#### WR-06: Seeder knob naming breaks the established entry-vs-plugin.json convention

**File:** `tests/orchestrators/plugin/install.test.ts:153`, `:159`

**Issue:** The helper already has a pair for the same entry-vs-manifest split,
and it names both sides:

```ts
pluginVersion?: string;            // MARKETPLACE entry.version
pluginJsonVersion?: string | null; // the plugin's OWN plugin.json version
```

The new pair only names one side:

```ts
defaultEnabled?: boolean;            // MARKETPLACE entry -- but the name says nothing
pluginJsonDefaultEnabled?: boolean;  // plugin.json
```

A bare `defaultEnabled` on a helper called `seedPathMarketplaceWithPlugin` reads
most naturally as "the plugin's `defaultEnabled`", which is the wrong one. The
doc comment compensates, but the next author adding a fixture will scan the
option list, not the prose — and the two knobs produce genuinely different
resolver paths (precedence winner vs. fallback), so picking the wrong one yields
a test that passes for the wrong reason.

**Fix:** Rename to match the existing pair:

```ts
/** DFEN-01: stamp `defaultEnabled` on the MARKETPLACE entry. */
entryDefaultEnabled?: boolean;
/** DFEN-01: stamp `defaultEnabled` on the plugin's own plugin.json. */
pluginJsonDefaultEnabled?: boolean;
```

(`entryDefaultEnabled` rather than `pluginDefaultEnabled` because `pluginVersion`
is itself ambiguous; the new pair is a chance to be unambiguous on both sides.)

---

### Info

#### IN-01: `resolveDefaultEnabled` runs on every resolve, including ones that end `unavailable`

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:820`

**Issue:** The value is computed in `preflightStages` and returned on the `ok`
arm, then discarded whenever `decideResolution` takes the `structuralDirty`
branch and returns `unavailable`. Since `list` and `info` resolve every plugin in
every recorded marketplace on every invocation, the helper runs far more often
than the install path needs it. It is two `typeof` checks over already-parsed
objects, so there is no measurable cost and no correctness consequence —
computing it in the one shared stage is what buys the mode-independence
guarantee, which is the better trade. Recorded only so the eagerness is a known
choice rather than an oversight.

**Fix:** None recommended. Keep as is.

---

#### IN-02: Non-boolean coverage stops at the string case; `null` is untested and is the likelier authoring mistake

**File:** `tests/domain/manifest.test.ts:360-365`, `:410-412`; `tests/domain/resolver-strict.test.ts:820-834`

**Issue:** Three tests pin `defaultEnabled: "false"` (string) as rejected, at the
entry schema, the manifest schema, and end-to-end through `readManifest`. No test
covers `null` or a number. `Type.Optional(Type.Boolean())` rejects `null` (only
`undefined` and `boolean` pass), so a `plugin.json` carrying
`"defaultEnabled": null` — a plausible output of a template or a codegen step —
downgrades the entire plugin to `unavailable` with a `malformed plugin.json`
note. That is consistent with the rest of the schema and almost certainly
correct, but it is the case a user is most likely to hit and the one nobody has
written down.

**Fix:** One line in each schema block:

```ts
test("DFEN-01 PLUGIN_MANIFEST rejects defaultEnabled as null", () => {
  assert.equal(PLUGIN_MANIFEST_VALIDATOR.Check({ name: "p", defaultEnabled: null }), false);
});
```

---

#### IN-03: A previously-tolerated key becomes fail-closed one phase before it becomes useful

**File:** `extensions/pi-claude-marketplace/domain/components/plugin.ts:25`

**Issue:** Not reported as a defect — DFEN-01 mandates this and the phase brief
calls it out as intentional. Recorded because of its *ordering*, which the
requirement does not address.

Before this change, `defaultEnabled` was an unknown key at both declaration
sites: tolerated everywhere, ignored everywhere. After it, a non-boolean value in
a marketplace entry throws `InvalidMarketplaceManifestError` for the **whole**
`marketplace.json` (pinned by `tests/domain/manifest.test.ts:307-345`, which
correctly documents that the valid sibling does not survive), taking down
`list`, `info`, `install`, `update`, and load-time reconcile for every plugin in
that marketplace; and a non-boolean in a `plugin.json` downgrades that plugin to
`unavailable`.

The precedent cited — a non-string `version` — is a field the extension actually
consumes. `defaultEnabled` is inert until phase 102. So for one phase the project
carries the full fail-closed blast radius with none of the benefit, against
third-party content it does not control.

**Fix:** No code change. Worth one line in `CHANGELOG.md` when this ships
(`CLAUDE.md` asks for changes to be recorded there before a PR anyway), so that
a marketplace author whose manifest suddenly stops loading has something to
match against.

---

_Reviewed: 2026-08-14T15:32:06Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
