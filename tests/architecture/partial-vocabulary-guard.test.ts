// tests/architecture/partial-vocabulary-guard.test.ts
//
// Surgical-completeness guard for the partial/partially-available vocabulary
// rename (D-75-01). This is the executable form of the RESEARCH section-4c
// symbol-level rule and the phase completion criterion: it walks the
// `extensions/pi-claude-marketplace/**/*.ts` tree at test time (reading file
// contents, following the catalog-uat file-reading precedent) and asserts the
// rename is BOTH complete (in-scope old tokens absent) AND surgical (out-of-scope
// homonyms preserved byte-for-byte).
//
// The in-scope standalone `"unsupported"` verdict literal co-occurs on the same
// lines as the OUT-of-scope `"unsupported source"` / `.unsupported[]` /
// `unsupportedKinds`; an over-rename would silently corrupt component-level
// supportability classification. The presence assertions below are the
// regression guard for that collision.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXT_ROOT = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace");

/** Every `.ts` file under the extension tree, keyed by repo-relative path. */
function collectExtensionSources(): ReadonlyMap<string, string> {
  const entries = readdirSync(EXT_ROOT, { recursive: true, withFileTypes: true });
  const files = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    // `entry.parentPath` is the absolute directory (Node >= 20.12).
    const abs = path.join(entry.parentPath, entry.name);
    files.set(path.relative(REPO_ROOT, abs), readFileSync(abs, "utf8"));
  }

  return files;
}

const SOURCES = collectExtensionSources();

/** Files (repo-relative) whose content contains `needle`. */
function filesContaining(needle: string): string[] {
  const hits: string[] = [];
  for (const [rel, content] of SOURCES) {
    if (content.includes(needle)) {
      hits.push(rel);
    }
  }

  return hits;
}

/** Files (repo-relative) whose content matches `re`. */
function filesMatching(re: RegExp): string[] {
  const hits: string[] = [];
  for (const [rel, content] of SOURCES) {
    if (re.test(content)) {
      hits.push(rel);
    }
  }

  return hits;
}

test("D-75-01 guard: the extension tree is non-empty (sanity)", () => {
  assert.ok(
    SOURCES.size > 50,
    `expected the extension .ts tree to load; got ${SOURCES.size} files`,
  );
});

// ---------------------------------------------------------------------------
// ABSENCE: the in-scope force/unsupported vocabulary is gone everywhere under
// `extensions/pi-claude-marketplace/`. Substring tokens catch comments too --
// the rename is total (no aliases, no stale prose).
// ---------------------------------------------------------------------------

// The retired user flags (breaking rename to `--partial`, no alias). `--force`
// is also the retired reinstall overwrite flag, which reinstall now rejects as
// an unknown flag -- neither literal survives in the extension code.
const ABSENT_FLAGS = ["--force", "--unsupported"];

// The quoted status literals (verdict + force-state family). The standalone
// `"unsupported"` uses a closing quote immediately after `unsupported`, so it
// does NOT match the OUT-of-scope `"unsupported source"` / `"unsupported hooks"`
// reason tokens (which have an interior space).
const ABSENT_STATUS_LITERALS = [
  '"unsupported"',
  '"force-installed"',
  '"force-upgradable"',
  '"force-installed-upgradable"',
];

// The user-visible render tokens. `(force-installed)` / `(force-upgradable)` /
// `(will force install)` have no component-level homonym, so the bare paren form
// is safe to forbid. The verdict render token is checked in its double-quoted
// plugin-row form `"(unsupported)"` so it does NOT collide with the OUT-of-scope
// component-level ` (unsupported)` hook-event suffix in shared/concerns/hooks.ts
// (which has a leading space inside the quotes).
const ABSENT_RENDER_TOKENS = [
  '"(unsupported)"',
  "(force-installed)",
  "(force-upgradable)",
  "(will force install)",
];

// The renamed identifiers, constants, and fields. `ICON_*` names change while
// the glyph CHARACTERS (`◉` / `⊖`) stay; the hint-trailer const names change
// with their `--partial` bodies; the degrade-plumbing symbols were renamed in
// the flag wave and must not regress.
const ABSENT_IDENTIFIERS = [
  "ICON_FORCE_INSTALLED",
  "ICON_UNSUPPORTED",
  "FORCE_INSTALL_HINT_TRAILER",
  "FORCE_UPDATE_HINT_TRAILER",
  "requireForceInstallable",
  "forceHint",
  "forceDegrade",
  "forceUpgradable",
  "FORCE_INSTALL_STATUSES",
  "FORCE_UPDATE_STATUSES",
  "forceInstalledRow",
];

for (const token of [
  ...ABSENT_FLAGS,
  ...ABSENT_STATUS_LITERALS,
  ...ABSENT_RENDER_TOKENS,
  ...ABSENT_IDENTIFIERS,
]) {
  test(`D-75-01 guard: absent under extensions/ -- ${token}`, () => {
    const hits = filesContaining(token);
    assert.equal(
      hits.length,
      0,
      `in-scope token ${JSON.stringify(token)} must be ABSENT after the rename; found in:\n  ${hits.join("\n  ")}`,
    );
  });
}

// ---------------------------------------------------------------------------
// PRESENCE: the OUT-of-scope homonyms survive byte-for-byte. An over-rename
// would delete one of these; the assertions name the surviving surface so a
// regression is diagnosable.
// ---------------------------------------------------------------------------

// Component-level reason tokens + `compatibility.*` component-kind arrays +
// the component-kind mappers. A plugin is *partially available* BECAUSE some
// component kinds are unsupported -- these describe the components, not the
// verdict, and are explicitly out of scope (section 4b).
const PRESENT_COMPONENT_TOKENS = [
  '"unsupported source"',
  '"unsupported hooks"',
  "compatibility.unsupported",
  "compatibility.supported",
  "narrowUnsupportedKinds",
  "unsupportedKinds",
];

for (const token of PRESENT_COMPONENT_TOKENS) {
  test(`D-75-01 guard: still present under extensions/ -- ${token}`, () => {
    const hits = filesContaining(token);
    assert.ok(
      hits.length > 0,
      `out-of-scope component token ${JSON.stringify(token)} must SURVIVE the rename (an over-rename would delete it)`,
    );
  });
}

test("D-75-01 guard: the component-level ` (unsupported)` hook-event suffix survives", () => {
  // shared/concerns/hooks.ts renders `<event> (unsupported)` (leading space) for
  // a dropped hook event -- the component sense, distinct from the plugin verdict.
  const hits = filesContaining(" (unsupported)");
  assert.ok(
    hits.some((f) => f.endsWith("shared/concerns/hooks.ts")),
    "the component-level ` (unsupported)` hook-event suffix must survive in shared/concerns/hooks.ts",
  );
});

test("D-75-01 guard: overwrite `force: true` semantics survive (rm / writeRef / staging)", () => {
  // node-fs `rm({ force: true })` and isomorphic-git `writeRef({ force: true })`
  // are a DIFFERENT `force` than the degrade flag; they must stay byte-identical.
  const rmForce = filesMatching(/force:\s*true/).filter((f) => f.includes("/bridges/"));
  assert.ok(
    rmForce.length > 0,
    "the bridge staging `force: true` overwrite must survive (an over-rename would corrupt it)",
  );

  const gitForce = filesContaining("force").filter((f) => f.endsWith("platform/git.ts"));
  assert.ok(
    gitForce.length > 0,
    "the isomorphic-git `writeRef` force semantics in platform/git.ts must survive",
  );

  // The agents-staging overwrite gate (`AgentStageOptions.force` -> `options?.force`).
  const stageForce = filesContaining("options?.force").filter((f) =>
    f.endsWith("bridges/agents/stage.ts"),
  );
  assert.ok(
    stageForce.length > 0,
    "the agents-staging overwrite `options?.force` gate must survive",
  );
});
