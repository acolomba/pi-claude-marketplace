/**
 * D-99-02a drift gate: the manifest-membership rule has exactly one writing.
 *
 * `domain/manifest-lookup.ts::lookupDeclaredPlugin` decides whether a manifest
 * DECLARES a plugin name, and it is reachable only from a successful read. The
 * three surfaces that turn that answer into a rendered absence -- `list`
 * (INV-01), `info` (INFO-09 / INFO-10 / BOUND-02) and `update` (the
 * `{not in manifest}` rows) -- consume it as a value.
 *
 * The audit that produced this gate stated the hazard precisely: a FOURTH
 * surface copying the raw lookup idiom without the read-success guard would
 * reintroduce the BOUND-03 defect ungated. Exporting the rule removes the
 * duplication that exists; only a gate removes the duplication that would
 * exist tomorrow.
 *
 * Two halves, as the ENBL-05 gate established:
 *   - ABSENCE -- a WALK of the whole extension tree (not an allowlist of the
 *     sites that once held a copy, which is structurally blind to the next
 *     copy) asserting no file writes the raw idiom, except the module that
 *     owns the rule and the sites enumerated below that look an entry up for
 *     a purpose OTHER than judging absence-for-rendering.
 *   - PRESENCE -- the three surfaces import the derivation. An absence
 *     assertion alone would pass just as quietly on a file that deleted its
 *     membership check altogether.
 */

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT, stripComments } from "../helpers/source-scan.ts";

const EXTENSION_SOURCE_ROOT = "extensions/pi-claude-marketplace";

/**
 * The module that OWNS the rule. It is the one place the raw idiom may be
 * written, because writing it there IS the definition.
 */
const RULE_DEFINITION_SITE = "extensions/pi-claude-marketplace/domain/manifest-lookup.ts";

/** The three surfaces that render an absence claim and must consume the rule. */
const ABSENCE_JUDGING_SURFACES: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts",
];

/**
 * Sites that look a manifest entry up for a purpose OTHER than judging
 * absence-for-rendering. Each carries what it looks the entry up FOR: an
 * allowlist entry without a stated purpose is how a gate rots into a rubber
 * stamp, and the staleness clause below deletes an entry that stops matching.
 */
const NON_ABSENCE_LOOKUPS: ReadonlyArray<{ readonly rel: string; readonly purpose: string }> = [
  {
    rel: "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts",
    purpose:
      "fetches the entry it is about to INSTALL (the resolver's input). A miss throws PluginShapeError kind not-in-manifest; it renders no absence row.",
  },
  {
    rel: "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts",
    purpose:
      "fetches the entry it is about to REINSTALL from the cached manifest. A miss throws; it renders no absence row.",
  },
  {
    rel: "extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts",
    purpose:
      "fetches the entry a pending install would materialize. A miss means `not a candidate` (returns undefined) -- the scan emits nothing, so no claim is made about the record.",
  },
  {
    rel: "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts",
    purpose:
      "fetches the entry to resolve OFFLINE when re-materializing a recorded plugin. A miss returns undefined and the plugin is left alone.",
  },
  {
    rel: "extensions/pi-claude-marketplace/orchestrators/edge-deps.ts",
    purpose:
      "feeds the completion cache's upgrade-candidate compare (PL-5 version diff). A miss reads as `not upgradable`; the cache row carries no absence reason.",
  },
];

/**
 * The idiom in its arrow-EXPRESSION spelling, which is how every current
 * writing is spelled. `\(?` and the `\s*` joints cover the parenthesised and
 * bare parameter forms and inner whitespace; the match stops at `===`, so the
 * comparison target may be an identifier or a quoted literal.
 *
 * The leading `.plugins` anchor is what holds the pattern to the membership
 * axis: a find over any OTHER collection with a name predicate is a different
 * fact about a different object.
 */
const RAW_LOOKUP_ARROW = /\.plugins\s*\.find\s*\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.name\s*===/;

/**
 * The block-BODY spelling. A `{ return ... }` body pushes the predicate past
 * the arrow, where the expression pattern above cannot see it. The bridging
 * segment is bounded and lazy (no nested quantifier) so the pattern stays
 * linear on adversarial input.
 *
 * WR-05: the bridge is bounded but not scoped -- it can run past the end of the
 * `.find(` call and reach a `return <ident>.name ===` in unrelated code up to
 * 160 characters later, flagging a file that never re-derived the rule.
 * Deliberate: scoping it would need brace matching a regex cannot do, and for a
 * drift gate a false positive an author reads and dismisses costs less than a
 * copy that slips through. Same fail-closed trade as the ENBL-05 destructured
 * pattern (`tests/orchestrators/reconcile/plan.test.ts`).
 */
const RAW_LOOKUP_BLOCK_BODY = /\.plugins\s*\.find\s*\([\s\S]{0,160}?\breturn\s+\w+\.name\s*===/;

/**
 * The DESTRUCTURED spelling. `({ name }) => name === x` binds the key off the
 * entry, leaving no `<ident>.name` for either pattern above to anchor on.
 * `[^{}]*` never crosses a nested brace.
 */
const RAW_LOOKUP_DESTRUCTURED =
  /\.plugins\s*\.find\s*\(\s*\(?\s*\{[^{}]*\bname\b[^{}]*\}\s*\)?\s*=>/;

/**
 * Every pattern the walk consumes. Each member is non-global: a `/g` regex
 * carries `lastIndex` across `.test()` calls and would silently skip
 * alternating files in the walk.
 */
const RAW_MEMBERSHIP_LOOKUPS: ReadonlyArray<RegExp> = [
  RAW_LOOKUP_ARROW,
  RAW_LOOKUP_BLOCK_BODY,
  RAW_LOOKUP_DESTRUCTURED,
];

/**
 * The spellings a copier would naturally reach for, held as DATA rather than
 * described in prose so the proof below cannot be satisfied by comment text.
 * The walk proves no copy survives TODAY; it cannot prove the gate would see
 * one that lands tomorrow, which is what these literals stand in for.
 */
const PLANTED_TWINS: ReadonlyArray<{
  readonly label: string;
  readonly pattern: RegExp;
  readonly line: string;
}> = [
  {
    label: "parenthesised arrow parameter",
    pattern: RAW_LOOKUP_ARROW,
    line: "const entry = manifest.plugins.find((p) => p.name === pluginName);",
  },
  {
    label: "bare arrow parameter",
    pattern: RAW_LOOKUP_ARROW,
    line: "const entry = manifest.plugins.find(p => p.name === pluginName);",
  },
  {
    label: "quoted comparison target",
    pattern: RAW_LOOKUP_ARROW,
    line: 'const entry = manifest.plugins.find((p) => p.name === "hello");',
  },
  {
    label: "single-quoted comparison target with inner whitespace",
    pattern: RAW_LOOKUP_ARROW,
    line: "const entry = manifest.plugins.find( ( p ) =>  p.name  === 'hello' );",
  },
  {
    label: "block-bodied predicate",
    pattern: RAW_LOOKUP_BLOCK_BODY,
    line: "const entry = manifest.plugins.find((p) => { return p.name === pluginName; });",
  },
  {
    label: "destructured name binding",
    pattern: RAW_LOOKUP_DESTRUCTURED,
    line: "const entry = manifest.plugins.find(({ name }) => name === pluginName);",
  },
];

/** The shapes every pattern must LEAVE ALONE. */
const NON_LOOKUPS: ReadonlyArray<{ readonly label: string; readonly line: string }> = [
  {
    label: "legitimate call into the one rule",
    line: "const lookup = lookupDeclaredPlugin(manifest, pluginName);",
  },
  {
    label: "name predicate over a DIFFERENT collection",
    line: "const row = rows.find((r) => r.name === pluginName);",
  },
  {
    label: "plugins find on a different field",
    line: "const entry = manifest.plugins.find((p) => p.source === wanted);",
  },
];

/** The import the collapse requires of every absence-judging surface. */
const LOOKUP_IMPORT =
  /import\s*\{[^}]*\blookupDeclaredPlugin\b[^}]*\}\s*from\s+["'][^"']*domain\/manifest-lookup\.ts["']/;

/** Every `.ts` file under the extension source tree, repo-relative. */
async function extensionSourceFiles(): Promise<readonly string[]> {
  const out: string[] = [];
  const walk = async (rel: string): Promise<void> => {
    const entries = await readdir(path.join(REPO_ROOT, rel), { withFileTypes: true });
    for (const entry of entries) {
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(childRel);
      } else if (entry.name.endsWith(".ts")) {
        out.push(childRel);
      }
    }
  };

  await walk(EXTENSION_SOURCE_ROOT);
  return out;
}

test("D-99-02a: no surface re-derives the manifest-membership lookup -- the whole source walk (drift gate)", async () => {
  // Comments are stripped FIRST: the surviving prose in `manifest-lookup.ts`
  // and in this gate's subjects legally describes the idiom while explaining
  // why it lives in one place.
  const allowed = new Set(NON_ABSENCE_LOOKUPS.map((entry) => entry.rel));
  const offenders: string[] = [];
  const matchedAllowed = new Set<string>();

  for (const rel of await extensionSourceFiles()) {
    if (rel === RULE_DEFINITION_SITE) {
      continue;
    }

    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    for (const re of RAW_MEMBERSHIP_LOOKUPS) {
      if (!re.test(stripped)) {
        continue;
      }

      if (allowed.has(rel)) {
        matchedAllowed.add(rel);
        continue;
      }

      offenders.push(
        `${rel} re-derives the manifest-membership lookup (${String(re)}) -- call lookupDeclaredPlugin from domain/manifest-lookup.ts instead, or, if it judges the entry for something other than absence-for-rendering, add it to NON_ABSENCE_LOOKUPS WITH its purpose`,
      );
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `D-99-02a violation: a local manifest-membership twin survives:\n  ${offenders.join("\n  ")}`,
  );

  // An allowlist entry that no longer matches is an exemption nobody needs,
  // and the next reader would take it as evidence the site still holds a copy.
  const stale = NON_ABSENCE_LOOKUPS.map((entry) => entry.rel)
    .filter((rel) => !matchedAllowed.has(rel))
    .sort((a, b) => a.localeCompare(b));

  assert.deepEqual(
    stale,
    [],
    `D-99-02a: these allowlist entries no longer write the idiom and must be deleted:\n  ${stale.join("\n  ")}`,
  );
});

test("D-99-02a: the gate flags every spelling a copier would reach for, and over-reaches onto none", () => {
  for (const twin of PLANTED_TWINS) {
    assert.ok(
      twin.pattern.test(twin.line),
      `D-99-02a: ${String(twin.pattern)} does not flag the ${twin.label} twin -- ${twin.line}`,
    );
  }

  for (const control of NON_LOOKUPS) {
    assert.ok(
      !RAW_MEMBERSHIP_LOOKUPS.some((re) => re.test(control.line)),
      `D-99-02a: a pattern over-reaches onto the ${control.label} -- ${control.line}`,
    );
  }
});

test("D-99-02a: every proven pattern reaches the source walk, and no pattern is global", () => {
  // A pattern proven against its twin but left out of the array is a gate that
  // passes its own self-test while seeing nothing.
  for (const twin of PLANTED_TWINS) {
    assert.ok(
      RAW_MEMBERSHIP_LOOKUPS.includes(twin.pattern),
      `D-99-02a: the ${twin.label} pattern is proven but never reaches the source walk`,
    );
  }

  for (const re of RAW_MEMBERSHIP_LOOKUPS) {
    assert.equal(
      re.global,
      false,
      `D-99-02a: ${String(re)} is global -- lastIndex carries across .test() calls and would skip alternating files in the walk`,
    );
  }
});

test("D-99-02a: list, info and update each import the one derivation", async () => {
  // The other half of the collapse: the absence walk proves no surface
  // re-derives the rule, this proves the three CONSUME it rather than having
  // dropped the membership check altogether.
  const offenders: string[] = [];
  for (const rel of ABSENCE_JUDGING_SURFACES) {
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    if (!LOOKUP_IMPORT.test(stripped)) {
      offenders.push(`${rel} does not import lookupDeclaredPlugin from domain/manifest-lookup.ts`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `D-99-02a violation: an absence-judging surface dropped the one derivation:\n  ${offenders.join("\n  ")}`,
  );
});
