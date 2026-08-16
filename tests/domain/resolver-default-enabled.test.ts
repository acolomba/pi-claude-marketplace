// tests/domain/resolver-default-enabled.test.ts
//
// The contract `entryDeclaresInstallDisabled` freezes: exactly ONE value on a
// marketplace entry claims that installing the plugin would leave it disabled,
// and every other value is SILENT.
//
// The sibling precedence function the predicate sits above has no direct unit
// test anywhere in this tree -- it is covered only behaviorally, through the
// install and enable/disable suites, and structurally through
// `tests/architecture/no-lifecycle-default-enabled-read.test.ts`. This file
// deliberately does not follow that precedent; it establishes the opposite one.
// The predicate is the read surfaces' single source of truth for a claim the
// user SEES on a row, so its silence rule is pinned here directly rather than
// inferred from rendered bytes. A rule observed only through a renderer is a
// rule whose boundary nobody has actually tested.
//
// The predicate itself is module-private, so the silence cases reach it through
// `rowClaimsInstallDisabled(entry, undefined)`. That is the predicate and
// nothing else: the wrapper is `declaredEnabled === undefined &&
// entryDeclaresInstallDisabled(entry)`, so pinning `undefined` reduces it to the
// entry-only rule exactly. This is still a direct domain-function assertion, not
// an observation through a renderer.

import assert from "node:assert/strict";
import test from "node:test";

import { rowClaimsInstallDisabled } from "../../extensions/pi-claude-marketplace/domain/resolver.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

test("OUT-05 / DOC-02: `defaultEnabled` set to the false literal is a declaration", () => {
  const entry = { name: "alpha", source: "./alpha", defaultEnabled: false } as PluginEntry;
  assert.equal(rowClaimsInstallDisabled(entry, undefined), true);
});

test("OUT-05 / DOC-02: `defaultEnabled` set to the true literal is silent", () => {
  const entry = { name: "alpha", source: "./alpha", defaultEnabled: true } as PluginEntry;
  assert.equal(rowClaimsInstallDisabled(entry, undefined), false);
});

test("OUT-05 / DOC-02: an entry omitting `defaultEnabled` is silent -- absence is not a declaration", () => {
  // The negating form of the predicate (`!entry.defaultEnabled`) passes both
  // cases above and fails HERE, claiming on every silent entry in the corpus.
  // That is the whole reason this case exists.
  const entry = { name: "alpha", source: "./alpha" } as PluginEntry;
  assert.equal(rowClaimsInstallDisabled(entry, undefined), false);
});

test("OUT-05 / DOC-02: a non-boolean `defaultEnabled` is silent -- a value past the validator degrades, it never claims", () => {
  // PLUGIN_ENTRY_VALIDATOR types the field `boolean | undefined`, so this shape
  // is unreachable in production and a deliberate cast is the only way to reach
  // the case at all. What is pinned here is therefore the DEGRADATION RULE, not
  // a validation behavior: a value smuggled past the validator is silent --
  // never an error, and never a claim. The not-equal-to-true form of the
  // predicate (`entry.defaultEnabled !== true`) fails exactly here.
  const entry = {
    name: "alpha",
    source: "./alpha",
    defaultEnabled: "false",
  } as unknown as PluginEntry;
  assert.equal(rowClaimsInstallDisabled(entry, undefined), false);
});

// ──────────────────────────────────────────────────────────────────────────
// The two-input rule the read surfaces actually render.
// ──────────────────────────────────────────────────────────────────────────

test("DFEN-04 / DFEN-05: a declaring entry claims only when the user has stated NO `enabled` opinion", () => {
  const entry = { name: "alpha", source: "./alpha", defaultEnabled: false } as PluginEntry;
  // Silent user -> the entry answers.
  assert.equal(rowClaimsInstallDisabled(entry, undefined), true);
  // An explicit declaration wins in EITHER direction, so the entry's default
  // never applies and the row must not predict it. `true` is the case that
  // makes a one-input rule state a falsehood: `install` reads the declaration
  // first, and the plugin lands ENABLED.
  assert.equal(rowClaimsInstallDisabled(entry, true), false);
  assert.equal(rowClaimsInstallDisabled(entry, false), false);
});

test("DFEN-04: a silent entry claims nothing whatever the user's config says", () => {
  const entry = { name: "alpha", source: "./alpha" } as PluginEntry;
  assert.equal(rowClaimsInstallDisabled(entry, undefined), false);
  assert.equal(rowClaimsInstallDisabled(entry, true), false);
  assert.equal(rowClaimsInstallDisabled(entry, false), false);
});
