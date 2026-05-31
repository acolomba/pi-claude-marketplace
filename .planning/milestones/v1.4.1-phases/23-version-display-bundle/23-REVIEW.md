---
phase: 23-version-display-bundle
reviewed: 2026-05-29T11:59:54Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-29T11:59:54Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 23 lands two production changes: (23-01/SNM-34) a 3-tier `resolvePluginVersion`
precedence (plugin.json version -> marketplace entry.version -> PI-7 hash) via an
independent re-read of `<pluginRoot>/.claude-plugin/plugin.json` in a swallow-all
try/catch; and (23-02/SNM-35) a renderer-only `hash-<12hex>` -> `v#<7hex>` transform
in `notify.ts` routed through `renderVersion` and `composeVersionArrow`.

Both production changes are **correct**. I traced and adversarially probed each:

- The anchored regex `/^hash-[0-9a-f]{12}$/` was tested against trailing-newline,
  uppercase-hex, 11/13-hex, and leading-space inputs -- all correctly rejected. No
  ReDoS surface (fixed-length, no nested quantifiers). The `$` anchor does NOT leak
  on a trailing `\n` (verified empirically; JS non-multiline `$` matches only true
  end-of-string).
- `formatHashVersionForDisplay` slices an already-validated 12-hex string; the
  bounds are safe; non-hash strings pass through verbatim (SemVer preserved).
- `resolvePluginVersion`'s tier-1 read cannot throw (swallow-all catch); a top-level
  non-object JSON (`42`, `"x"`) yields `undefined` on `.version`, and `null` throws
  but is caught -- no crash path. The discriminated `ResolvedPluginInstallable` union
  (NFR-7) is NOT widened. The manifest path is built only from `installable.pluginRoot`
  + fixed literals (NFR-10 containment holds; read-only, no traversal from user input).
- IL-2 holds: no `console.*` / `process.stdout|stderr` added; notify.ts changes are
  pure string transforms with no new notify call sites.
- All affected tests pass (notify-v2: 54, catalog-uat: included, install: 41).

The defects are entirely in **test coverage** and **observability**, not in shipped
behavior. The central SNM-34 precedence rule (plugin.json wins over entry.version when
both are present) and the documented anchored-regex rejection rationale are asserted by
comments but never proven by a discriminating test.

## Warnings

### WR-01: SNM-34 precedence (plugin.json wins over entry.version) is never tested with conflicting values

**File:** `tests/orchestrators/plugin/install.test.ts:543-664` (and `680-685`, `1378-1383`)
**Issue:** The core behavioral change of 23-01 is D-23-01: "If also set in the
marketplace entry, `plugin.json` wins." No test seeds plugin.json and entry.version to
**different** values and asserts the plugin.json value is recorded. The existing tests
deliberately avoid this:
- PI-7(a) (`:543`) sets `pluginVersion: "1.2.3"` but `pluginJsonVersion: null` -> exercises
  tier 2 in isolation, not precedence.
- SNM-34 (`:627`) sets plugin.json present, entry absent -> tier 1 in isolation.
- PI-9 (`:680`) and the row at `:1378` *align* both values ("Align the seeded plugin.json
  version with the entry so the rendered byte form stays v1.0.0"), so neither can reveal
  which tier won.

A regression that flipped the tier order (entry checked before plugin.json) would pass
the entire suite. The precedence is the feature; it is untested.

**Fix:** Add a discriminating test, e.g.:
```ts
test("SNM-34 D-23-01: plugin.json version WINS over a differing marketplace entry.version", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-snm34-precedence-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "9.9.9",     // marketplace entry.version (tier 2)
        pluginJsonVersion: "1.2.3", // plugin.json version (tier 1) -- must win
        skills: [{ sourceName: "tool" }],
      });
      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });
      const after = await loadState(locations.extensionRoot);
      assert.equal(after.marketplaces["mp"]?.plugins["hello"]?.version, "1.2.3");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
```

### WR-02: No negative test for the anchored-regex rejection of malformed pseudo-hashes

**File:** `tests/shared/notify-v2.test.ts:1668-1763`
**Issue:** The anchoring of `HASH_VERSION_RE` is justified in the source comment
(`notify.ts:748-753`) as: "Uppercase hex, wrong length, or a trailing/leading character
are all rejected so a malformed pseudo-hash is never silently rewritten into a misleading
short SHA (T-23-06)." No test named or tagged `T-23-06` exists. The three SNM-35 tests
cover: valid hash single-version, valid hash both-sided arrow, and SemVer pass-through.
None feed a `hash-`-prefixed-but-invalid string. A regression that loosened the regex to
`/^hash-/` (and produced a misleading `v#XXXXXXX` from `hash-2EA95F85703D` or
`hash-deadbeef`) would pass the suite.

**Fix:** Add a pass-through-on-rejection test, e.g.:
```ts
test("notify passes a malformed hash-prefixed version through UNCHANGED (anchored-regex rejection, SNM-35 T-23-06)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  // Uppercase hex is NOT a real PI-7 hash; must render verbatim, NOT v#...
  const msg: NotificationMessage = {
    marketplaces: [{ name: "demo", scope: "user", status: "added",
      plugins: [{ status: "installed", name: "p", version: "hash-2EA95F85703D", dependencies: [] }] }],
  };
  notify(ctx as never, pi as never, msg);
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (added)\n  ● p vhash-2EA95F85703D (installed)\n\n/reload to pick up changes`,
  ]);
});
```
(Also worth covering wrong-length `hash-2ea95f8` and a `hash-...EXTRA` suffix.)

### WR-03: Non-ENOENT plugin.json read errors silently degrade with no diagnostic

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:188-199`
**Issue:** The tier-1 try/catch swallows **every** error, not only the expected
"absent / unparseable / no usable version" cases named in the comment. A genuine
environmental fault -- `EACCES` on `plugin.json`, an I/O error, or a future programming
bug that throws a `TypeError` inside the block -- is indistinguishable from "file absent"
and silently degrades to a tier-2/tier-3 version. The user then sees a hash-version (or
the marketplace entry version) where a plugin.json version was expected, with zero signal
that a real read failure occurred. Per project constraints the silent fall-through is
intentional for the *absent/malformed* cases (D-23-02/D-23-03), but blanket-swallowing
genuine faults erodes diagnosability and could mask a real bug during future maintenance.

This is an observability/robustness concern, not a correctness defect (behavior is
fail-safe: it never throws, never writes garbage). Flagged because the catch is broader
than its documented intent.

**Fix:** Narrow the swallow to the expected conditions and let unexpected faults surface
(or at minimum scope the comment to acknowledge the broader swallow). Minimal option:
```ts
} catch (err) {
  // Expected, swallowed: ENOENT (no plugin.json), JSON parse error, no usable version.
  // A non-ENOENT fs error (EACCES, EIO) is unexpected -- it still falls through to keep
  // resolvePluginVersion non-throwing per D-23-02, but is at least distinguishable here
  // if a future maintainer wants to add a single sanctioned diagnostic.
  void err;
}
```
If the project explicitly wants total swallow (D-23-02), no code change is required --
this finding then stands as a documentation note that the catch is intentionally broader
than the four enumerated cases.

## Info

### IN-01: `"hash-".length` recomputed twice per call (literal arithmetic)

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:774`
**Issue:** `v.slice("hash-".length, "hash-".length + 7)` evaluates the string-literal
length twice and inlines the magic `7`. It is correct, but the prefix length and the
short-SHA width (7, matching `git --short=7`) are unnamed constants embedded in an
expression. A typo in either occurrence would silently shift the slice.
**Fix:** Hoist named constants for clarity and single-source-of-truth:
```ts
const HASH_PREFIX = "hash-";
const SHORT_SHA_LEN = 7; // git --short=7
// ...
return `#${v.slice(HASH_PREFIX.length, HASH_PREFIX.length + SHORT_SHA_LEN)}`;
```

### IN-02: catalog `hash-version-arrow` info-severity / no-`expectedSeverity` is correct (no action)

**File:** `tests/architecture/catalog-uat.test.ts:946-965`; `docs/output-catalog.md:580`
**Issue:** Recorded as a verification note, not a defect. The `hash-version-arrow` fixture
omits `expectedSeverity`, and the catalog prose states "Severity: info." This is consistent
with the severity ladder: an `updated` plugin status is neither `failed` nor
`skipped`/`manual recovery`, so `computeSeverity` returns `undefined` (info, no 2nd arg).
The catalog-uat driver's `else if (callArgs.length !== 1)` branch enforces the no-2nd-arg
shape. Verified correct; listed so the reviewer record shows the severity path was checked,
not assumed.

---

_Reviewed: 2026-05-29T11:59:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
