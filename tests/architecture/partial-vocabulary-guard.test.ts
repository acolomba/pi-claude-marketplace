// tests/architecture/partial-vocabulary-guard.test.ts
//
// Surgical-completeness guard for the partial/partially-available vocabulary
// rename (D-75-01). This is the executable form of the RESEARCH section-4c
// symbol-level rule and the phase completion criterion: it reads file contents
// at test time (following the catalog-uat file-reading precedent) and asserts
// the rename is BOTH complete (in-scope retired tokens absent) AND surgical
// (out-of-scope homonyms preserved byte-for-byte).
//
// Scope of the ABSENCE checks (read as UTF-8 in Node so the glyph-bearing files
// -- notify.ts, info.ts, output-catalog.md, and the PRD -- are NOT mis-detected
// as binary the way a recursive shell `grep` would):
//   - the extension tree `extensions/pi-claude-marketplace/**/*.ts`
//   - the two user-facing docs `docs/output-catalog.md` + `docs/messaging-style-guide.md`
//   - the phase architecture tests `tests/architecture/*.ts` (this file excluded)
//   - the PRD `docs/prd/pi-claude-marketplace-prd.md`, scanned SEPARATELY because
//     it legitimately spells the stable `FORCE-NN` / `FSTAT-NN` requirement IDs
//     and the component-level `unsupported <kind>` homonyms, which an allowlist
//     mask preserves
//   - the completion `description:` string VALUES in edge/completions/{provider,
//     data}.ts (a plugin is never "unsupported"/"force"-anything to the user; the
//     component-level "unsupported components" homonym stays allowed)
//
// The checks cover the retired vocabulary in ALL of its written forms:
//   - user flags `--force` / `--unsupported`
//   - the double-quoted status literals + paren/backtick render tokens
//   - the renamed identifiers / constants / fields
//   - the force-family prose/backtick/label forms (`force-installed`,
//     `force-upgradable`, `force-installable`, `force-degradable`,
//     `force-materializable`, `force install`, `force path`, `force state`,
//     `force modifier`) -- these have NO out-of-scope homonym, so forbidding the
//     substring/verb forms cannot false-positive
//   - the resolver-verdict token in prose: the render `(unsupported)` and the
//     standalone `` `unsupported` `` (each with the minimal, explicit allowlist
//     documented at its assertion)
//
// It does NOT try to forbid the bare word `force` (it is the fs/git overwrite
// homonym `{ force: true }` and the ordinary verb "enforce"/"forces") nor the
// bare word `unsupported` (it is the component-level `compatibility.unsupported`
// / `"unsupported source"` / `"unsupported hooks"` / `narrowUnsupportedKinds`
// homonym). Those senses are the OUT-of-scope collision the presence assertions
// below protect.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXT_ROOT = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace");
const ARCH_DIR = path.join(REPO_ROOT, "tests", "architecture");
const SELF = path.relative(REPO_ROOT, fileURLToPath(import.meta.url));

/** Read a set of files into a repo-relative-path -> content map. */
function readInto(files: Map<string, string>, absPaths: readonly string[]): void {
  for (const abs of absPaths) {
    files.set(path.relative(REPO_ROOT, abs), readFileSync(abs, "utf8"));
  }
}

/** Every `.ts` file under the extension tree, keyed by repo-relative path. */
function collectExtensionSources(): ReadonlyMap<string, string> {
  const entries = readdirSync(EXT_ROOT, { recursive: true, withFileTypes: true });
  const files = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    // `entry.parentPath` is the absolute directory (Node >= 20.12).
    readInto(files, [path.join(entry.parentPath, entry.name)]);
  }

  return files;
}

/**
 * The full ABSENCE surface: the extension tree PLUS the two user-facing docs and
 * the phase architecture tests (this guard file excluded, since it necessarily
 * spells the retired tokens out to forbid them).
 */
function collectGuardedSources(): ReadonlyMap<string, string> {
  const files = new Map(collectExtensionSources());
  readInto(files, [
    path.join(REPO_ROOT, "docs", "output-catalog.md"),
    path.join(REPO_ROOT, "docs", "messaging-style-guide.md"),
  ]);
  for (const entry of readdirSync(ARCH_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    const abs = path.join(ARCH_DIR, entry.name);
    if (path.relative(REPO_ROOT, abs) === SELF) {
      continue;
    }

    readInto(files, [abs]);
  }

  return files;
}

const EXT_SOURCES = collectExtensionSources();
const GUARDED_SOURCES = collectGuardedSources();

/** Files (repo-relative) in `sources` whose content contains `needle`. */
function filesContaining(needle: string, sources: ReadonlyMap<string, string>): string[] {
  const hits: string[] = [];
  for (const [rel, content] of sources) {
    if (content.includes(needle)) {
      hits.push(rel);
    }
  }

  return hits;
}

/** Files (repo-relative) in `sources` whose content matches `re`. */
function filesMatching(re: RegExp, sources: ReadonlyMap<string, string>): string[] {
  const hits: string[] = [];
  for (const [rel, content] of sources) {
    if (re.test(content)) {
      hits.push(rel);
    }
  }

  return hits;
}

test("D-75-01 guard: the extension tree is non-empty (sanity)", () => {
  assert.ok(
    EXT_SOURCES.size > 50,
    `expected the extension .ts tree to load; got ${EXT_SOURCES.size} files`,
  );
});

test("D-75-01 guard: the docs + arch-test surfaces loaded (sanity)", () => {
  assert.ok(
    GUARDED_SOURCES.has("docs/output-catalog.md") &&
      GUARDED_SOURCES.has("docs/messaging-style-guide.md") &&
      GUARDED_SOURCES.has("tests/architecture/catalog-uat.test.ts"),
    "expected the docs + phase architecture tests to be in the guarded surface",
  );
});

// ---------------------------------------------------------------------------
// ABSENCE: the in-scope force/unsupported vocabulary is gone from EVERY guarded
// surface (extension tree + docs + phase architecture tests), in every written
// form -- code literal, identifier, render token, comment, backtick prose, doc
// label, and fixture KEY. Reads are UTF-8 so the ⊖/◉ glyph files are not skipped.
// ---------------------------------------------------------------------------

// The retired user flags (breaking rename to `--partial`, no alias). `--force`
// is also the retired reinstall overwrite flag, which reinstall now rejects as
// an unknown flag -- neither literal survives.
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

// The user-visible render tokens in their double-quoted plugin-row form and the
// bare paren form. The verdict `"(unsupported)"` is checked double-quoted so it
// does NOT collide with the OUT-of-scope component-level ` (unsupported)`
// hook-event suffix in shared/concerns/hooks.ts (leading space inside quotes).
const ABSENT_RENDER_TOKENS = [
  '"(unsupported)"',
  "(force-installed)",
  "(force-upgradable)",
  "(will force install)",
];

// The renamed identifiers, constants, and fields. `ICON_*` names change while
// the glyph CHARACTERS (`◉` / `⊖`) stay; the hint-trailer const names change
// with their `--partial` bodies; the degrade-plumbing symbols were renamed in
// the flag wave; `forceInstalledRow` is the SOLE row composer, renamed to
// `partiallyInstalledRow`.
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
  test(`D-75-01 guard: absent everywhere (code + docs + arch tests) -- ${token}`, () => {
    const hits = filesContaining(token, GUARDED_SOURCES);
    assert.equal(
      hits.length,
      0,
      `in-scope token ${JSON.stringify(token)} must be ABSENT after the rename; found in:\n  ${hits.join("\n  ")}`,
    );
  });
}

// The force-FAMILY prose/backtick/label forms. `force[- ]install` catches
// `force-installed` / `force-installable` / "force install"; the others catch
// `force-upgradable` / `force-degradable` / `force-materializable` / "force
// degrade" / "force state" / "force path" / "force modifier". None of these has
// an out-of-scope homonym (the fs/git overwrite is `{ force: true }` /
// `options?.force`; the ordinary verb is "enforce"/"forces"), so forbidding them
// as regex fragments cannot false-positive.
const ABSENT_FORCE_PROSE: readonly RegExp[] = [
  /force[- ]install/i,
  /force[- ]upgrad/i,
  /force[- ]degrad/i,
  /force[- ]materializ/i,
  /force[ -](state|path|modifier)/i,
];

for (const re of ABSENT_FORCE_PROSE) {
  test(`D-75-01 guard: force-family prose absent -- ${re.source}`, () => {
    const hits = filesMatching(re, GUARDED_SOURCES);
    assert.equal(
      hits.length,
      0,
      `retired force-family prose /${re.source}/ must be ABSENT after the rename; found in:\n  ${hits.join("\n  ")}`,
    );
  });
}

// The verdict RENDER token `(unsupported)` in backtick/prose form. The ONLY
// legitimate occurrence is the component-level hook-event suffix that info.ts
// documents (D-71-05: `event(matcher) (unsupported)`) and shared/concerns/
// hooks.ts renders -- allowlist orchestrators/plugin/info.ts for exactly this
// one token. Everywhere else the plugin-verdict render is `(partially-available)`.
test("D-75-01 guard: verdict render `(unsupported)` absent outside the info.ts component suffix", () => {
  const ALLOW = "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
  const hits = filesContaining("`(unsupported)`", GUARDED_SOURCES).filter((f) => f !== ALLOW);
  assert.equal(
    hits.length,
    0,
    `the verdict render \`(unsupported)\` must be ABSENT (renamed to \`(partially-available)\`) outside the allowlisted component-suffix docs in ${ALLOW}; found in:\n  ${hits.join("\n  ")}`,
  );
});

// The standalone backtick verdict `` `unsupported` `` in prose. The negative
// lookahead is the minimal, explicit allowlist for the two OUT-of-scope
// component homonyms that legitimately survive: `` `unsupported` array`
// (the component-kind array on the resolved plugin, shared/probe-classifiers.ts)
// and `` `unsupported` kind` (the typed component-kind list, output-catalog.md).
// Every other backtick `unsupported` was the resolver verdict, now
// `partially-available`.
test("D-75-01 guard: standalone backtick verdict `unsupported` absent (allowlist: array/kind homonyms)", () => {
  const re = /`unsupported`(?! (array|kind))/;
  const hits = filesMatching(re, GUARDED_SOURCES);
  assert.equal(
    hits.length,
    0,
    `the standalone backtick verdict \`unsupported\` must be ABSENT (renamed to \`partially-available\`), except the allowlisted \`unsupported\` array/kind component homonyms; found in:\n  ${hits.join("\n  ")}`,
  );
});

// ---------------------------------------------------------------------------
// PRESENCE: the OUT-of-scope homonyms survive byte-for-byte in the extension
// tree. An over-rename would delete one of these; the assertions name the
// surviving surface so a regression is diagnosable.
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
    const hits = filesContaining(token, EXT_SOURCES);
    assert.ok(
      hits.length > 0,
      `out-of-scope component token ${JSON.stringify(token)} must SURVIVE the rename (an over-rename would delete it)`,
    );
  });
}

test("D-75-01 guard: the component-level ` (unsupported)` hook-event suffix survives", () => {
  // shared/concerns/hooks.ts renders `<event> (unsupported)` (leading space) for
  // a dropped hook event -- the component sense, distinct from the plugin verdict.
  const hits = filesContaining(" (unsupported)", EXT_SOURCES);
  assert.ok(
    hits.some((f) => f.endsWith("shared/concerns/hooks.ts")),
    "the component-level ` (unsupported)` hook-event suffix must survive in shared/concerns/hooks.ts",
  );
});

test("D-75-01 guard: overwrite `force: true` semantics survive (rm / writeRef / staging)", () => {
  // node-fs `rm({ force: true })` and isomorphic-git `writeRef({ force: true })`
  // are a DIFFERENT `force` than the degrade flag; they must stay byte-identical.
  const rmForce = filesMatching(/force:\s*true/, EXT_SOURCES).filter((f) =>
    f.includes("/bridges/"),
  );
  assert.ok(
    rmForce.length > 0,
    "the bridge staging `force: true` overwrite must survive (an over-rename would corrupt it)",
  );

  const gitForce = filesContaining("force", EXT_SOURCES).filter((f) =>
    f.endsWith("platform/git.ts"),
  );
  assert.ok(
    gitForce.length > 0,
    "the isomorphic-git `writeRef` force semantics in platform/git.ts must survive",
  );

  // The agents-staging overwrite gate (`AgentStageOptions.force` -> `options?.force`).
  const stageForce = filesContaining("options?.force", EXT_SOURCES).filter((f) =>
    f.endsWith("bridges/agents/stage.ts"),
  );
  assert.ok(
    stageForce.length > 0,
    "the agents-staging overwrite `options?.force` gate must survive",
  );
});

// ---------------------------------------------------------------------------
// PRD surface (docs/prd/pi-claude-marketplace-prd.md). The PRD prose was the
// last holdout of the retired plugin-level force/unsupported vocabulary. It is
// scanned SEPARATELY from GUARDED_SOURCES because it legitimately spells two
// OUT-of-scope homonyms an allowlist must preserve:
//   - the stable requirement/decision IDs `FORCE-01..05` / `FSTAT-01..07`
//     (incl. the `01a` / `03a` suffixed rows) -- identifiers, not vocabulary;
//   - the component-level `unsupported <kind>` reasons (`unsupported source`,
//     `unsupported hooks`, `unsupported component(s)`, `settings (unsupported)`)
//     -- a plugin is *partially-available* BECAUSE some component kinds are
//     unsupported (section 4b).
// ---------------------------------------------------------------------------

const PRD_REL = "docs/prd/pi-claude-marketplace-prd.md";
const PRD_CONTENT = readFileSync(path.join(REPO_ROOT, PRD_REL), "utf8");

// Mask the OUT-of-scope homonyms above so the retired-token checks below cannot
// false-positive on them. Everything left is fair game for the ABSENCE checks.
function maskPrdAllowlist(text: string): string {
  return text
    .replace(/\b(?:FORCE|FSTAT)-\d+[a-z]?/g, "")
    .replace(/UNSUPPORTED component/g, "")
    .replace(/unsupported[ -]components?/gi, "")
    .replace(/unsupported (?:source|hooks)/gi, "")
    .replace(/settings \(unsupported\)/g, "");
}

const MASKED_PRD = maskPrdAllowlist(PRD_CONTENT);

// The retired plugin-level flag / verdict / status / render / symbol tokens.
// None is an ID or a component homonym, so none survives the mask after the
// rename. The standalone backtick verdict `` `unsupported` `` cannot collide
// with the component reasons (those keep an interior space, e.g.
// `unsupported source kind: github`).
const PRD_ABSENT_TOKENS = [
  "--force",
  "--unsupported",
  "force-installed",
  "force-upgradable",
  "force-degradable",
  "(force-installed)",
  "(force-upgradable)",
  "Re-run with --force",
  "requireForceInstallable",
  "`unsupported`",
];

for (const token of PRD_ABSENT_TOKENS) {
  test(`D-75-01 guard: PRD retired plugin-level token absent -- ${token}`, () => {
    assert.ok(
      !MASKED_PRD.includes(token),
      `retired plugin-level token ${JSON.stringify(token)} must be ABSENT from ${PRD_REL} after the rename (FORCE-/FSTAT- IDs and component-level unsupported homonyms are allowlisted)`,
    );
  });
}

// PRESENCE half: the allowlisted homonyms MUST survive byte-for-byte -- an
// over-rename would silently delete an ID row or a component reason.
test("D-75-01 guard: PRD keeps FORCE-/FSTAT- IDs and the component `unsupported` homonyms", () => {
  assert.ok(
    /\bFORCE-0\d/.test(PRD_CONTENT),
    "the FORCE-NN requirement IDs must survive in the PRD",
  );
  assert.ok(
    /\bFSTAT-0\d/.test(PRD_CONTENT),
    "the FSTAT-NN requirement IDs must survive in the PRD",
  );
  assert.ok(
    PRD_CONTENT.includes("unsupported source"),
    "the component-level `unsupported source` homonym must survive in the PRD",
  );
});

// ---------------------------------------------------------------------------
// Completion `description:` string VALUES (edge/completions/{provider,data}.ts
// and the edge/flag-catalog.ts single source of truth those completions derive
// from). A completion description is user-facing prose: the retired plugin-level
// verb "force" and the plugin-level noun "unsupported" (a PLUGIN is "partially
// available", never "unsupported") must not resurface there. The component-level
// "unsupported components/source/hooks/kinds" homonym stays allowed -- it names
// the dropped COMPONENTS, not the plugin.
// ---------------------------------------------------------------------------

const COMPLETION_DESCRIPTION_FILES = [
  "extensions/pi-claude-marketplace/edge/completions/provider.ts",
  "extensions/pi-claude-marketplace/edge/completions/data.ts",
  "extensions/pi-claude-marketplace/edge/flag-catalog.ts",
];

/** The double-quoted `description:` string values declared in `rel`. */
function completionDescriptions(rel: string): string[] {
  const content = EXT_SOURCES.get(rel);
  assert.ok(content !== undefined, `expected ${rel} in the extension sources`);
  const out: string[] = [];
  const re = /description:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const value = m[1];
    if (value !== undefined) {
      out.push(value);
    }
  }

  return out;
}

test("D-75-01 guard: completion descriptions carry no PLUGIN-level `unsupported`", () => {
  // "unsupported" is allowed ONLY when it immediately qualifies a COMPONENT noun
  // (component/source/hook/kind). A plugin-level "unsupported ... plugins" is the
  // retired verdict and must read "partially available".
  const pluginLevelUnsupported = /unsupported(?!\s+(?:component|source|hook|kind))/i;
  const offenders: string[] = [];
  for (const rel of COMPLETION_DESCRIPTION_FILES) {
    for (const desc of completionDescriptions(rel)) {
      if (pluginLevelUnsupported.test(desc)) {
        offenders.push(`${rel}: ${JSON.stringify(desc)}`);
      }
    }
  }

  assert.equal(
    offenders.length,
    0,
    `completion descriptions must not call a PLUGIN "unsupported" (use "partially available"); offenders:\n  ${offenders.join("\n  ")}`,
  );
});

test("D-75-01 guard: completion descriptions carry no retired `force` verb", () => {
  const offenders: string[] = [];
  for (const rel of COMPLETION_DESCRIPTION_FILES) {
    for (const desc of completionDescriptions(rel)) {
      if (/\bforce/i.test(desc)) {
        offenders.push(`${rel}: ${JSON.stringify(desc)}`);
      }
    }
  }

  assert.equal(
    offenders.length,
    0,
    `completion descriptions must not use the retired "force" verb (use a neutral verb like "install"); offenders:\n  ${offenders.join("\n  ")}`,
  );
});

// Sanity: the extractor actually finds the `--partial` completion descriptions it
// is meant to police -- guards against a silent zero-match pass if the
// `description:` shape ever changes. The `--partial` descriptions live in the
// flag-catalog single source of truth the completions derive from.
test("D-75-01 guard: completion-description extractor finds the --partial rows", () => {
  const catalog = completionDescriptions("extensions/pi-claude-marketplace/edge/flag-catalog.ts");
  assert.ok(
    catalog.some((d) => d.includes("partially available")) &&
      catalog.some((d) => d.includes("unsupported components")),
    "expected the partial list-filter and install/update completion descriptions to be extracted",
  );
});
