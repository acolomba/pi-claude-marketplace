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
// -- notify.ts, info.ts, and output-catalog.md -- are NOT mis-detected as
// binary the way a recursive shell `grep` would):
//   - the extension tree `extensions/pi-claude-marketplace/**/*.ts`
//   - the user-facing doc `docs/output-catalog.md`
//   - the unit-suite tests `tests/**/*.ts`, RECURSIVELY, minus this file (it
//     necessarily spells every retired token in order to forbid it) and minus
//     the separately-scripted `tests/e2e` / `tests/integration` roots. A guard
//     that names the vocabulary of a suite it never opens reports success over
//     nothing, so `POLICED_TEST_ROOTS` below is asserted to have been reached
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

import { REPO_ROOT } from "./source-scan.ts";

const EXT_ROOT = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace");
const TEST_ROOT = path.join(REPO_ROOT, "tests");
const SELF = path.relative(REPO_ROOT, fileURLToPath(import.meta.url));

/**
 * The `tests/` subdirectories the ABSENCE checks police, each asserted below to
 * have contributed at least one file.
 *
 * Naming the roots rather than counting files is what makes the widening
 * checkable: a walk that silently stopped matching, or one pointed at the wrong
 * directory, still returns "a lot of files" but stops naming one of these.
 *
 * Every root here has to EXIST, because the clause below asserts each one
 * contributed a file. That is the opposite of an allow-list: the walk itself is
 * the whole of `tests/` minus the two separately-scripted roots, so a root that
 * is absent from this list is still read and still policed -- it simply has no
 * standing claim that it was reached.
 */
const POLICED_TEST_ROOTS = [
  "architecture",
  "bridges",
  "domain",
  "edge",
  "orchestrators",
  "persistence",
  "platform",
  "shared",
  "transaction",
] as const;

/**
 * The `tests/` roots this guard leaves alone: two separately-scripted suites
 * (`npm run test:e2e` / `npm run test:integration`) outside the unit suite the
 * guard serves.
 */
const UNPOLICED_TEST_ROOTS = ["tests/e2e/", "tests/integration/"];

/** Whether the repo-relative `rel` is a test source this guard reads. */
function isPolicedTestSource(rel: string): boolean {
  return rel !== SELF && !UNPOLICED_TEST_ROOTS.some((root) => rel.startsWith(root));
}

/** Read a set of files into a repo-relative-path -> content map. */
function readInto(files: Map<string, string>, absPaths: readonly string[]): void {
  for (const abs of absPaths) {
    files.set(path.relative(REPO_ROOT, abs), readFileSync(abs, "utf8"));
  }
}

/** Every `.ts` file under `root` that `include` accepts, by repo-relative path. */
function collectTreeSources(
  root: string,
  include: (rel: string) => boolean,
): ReadonlyMap<string, string> {
  const entries = readdirSync(root, { recursive: true, withFileTypes: true });
  const files = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    // `entry.parentPath` is the absolute directory.
    const abs = path.join(entry.parentPath, entry.name);
    if (include(path.relative(REPO_ROOT, abs))) {
      readInto(files, [abs]);
    }
  }

  return files;
}

/** Every `.ts` file under the extension tree, keyed by repo-relative path. */
function collectExtensionSources(): ReadonlyMap<string, string> {
  return collectTreeSources(EXT_ROOT, () => true);
}

/**
 * The full ABSENCE surface: the extension tree PLUS the output catalog and the
 * recursive unit-test tree (this guard file and the separately-scripted e2e and
 * integration roots excluded).
 */
function collectGuardedSources(): ReadonlyMap<string, string> {
  const files = new Map(collectExtensionSources());
  readInto(files, [path.join(REPO_ROOT, "docs", "output-catalog.md")]);
  for (const [rel, content] of collectTreeSources(TEST_ROOT, isPolicedTestSource)) {
    files.set(rel, content);
  }

  return files;
}

const EXT_SOURCES = collectExtensionSources();
const GUARDED_SOURCES = collectGuardedSources();

/** Masks only upstream's source sentinel, never a plugin-status homonym. */
function maskUpstreamSourceSentinel(file: string, content: string): string {
  if (
    file === "extensions/pi-claude-marketplace/domain/manifest.ts" ||
    file === "tests/domain/manifest.test.ts"
  ) {
    return content.replace('source: { source: "unsupported" }', "source: UPSTREAM_SENTINEL");
  }

  if (file === "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts") {
    return content.replace('source.source === "unsupported"', "IS_UPSTREAM_SENTINEL");
  }

  return content;
}

const STATUS_GUARDED_SOURCES = new Map(
  [...GUARDED_SOURCES].map(([file, content]) => [file, maskUpstreamSourceSentinel(file, content)]),
);

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

test("D-75-01 guard: the docs surface loaded (sanity)", () => {
  assert.ok(
    GUARDED_SOURCES.has("docs/output-catalog.md") &&
      GUARDED_SOURCES.has("tests/architecture/catalog-uat/catalog-contract.test.ts"),
    "expected the output catalog + the nested catalog-uat contract to be in the guarded surface",
  );
});

test("D-75-01 guard: the recursive unit-test walk reached every policed root", () => {
  // act
  const testSources = [...GUARDED_SOURCES.keys()].filter((rel) => rel.startsWith("tests/"));
  const unreached = POLICED_TEST_ROOTS.filter(
    (root) => !testSources.some((rel) => rel.startsWith(`tests/${root}/`)),
  );

  // assert
  assert.ok(
    testSources.length > 0,
    `the guard read ${GUARDED_SOURCES.size} files and NONE of them was a test source, so every ABSENCE check below reports success over nothing`,
  );
  assert.deepStrictEqual(
    [...unreached],
    [],
    `the walk read ${testSources.length} test sources of ${GUARDED_SOURCES.size} guarded files but reached none under these roots, so their retired vocabulary is unpoliced:\n  ${unreached.join("\n  ")}`,
  );
  assert.strictEqual(
    testSources.includes(SELF),
    false,
    "this guard file must stay out of its own ABSENCE surface: it spells every retired token in order to forbid it",
  );
});

// ---------------------------------------------------------------------------
// Per-(file, token) waivers. A waiver says: this file spells this token for a
// reason the rename did not retire, so the ABSENCE check skips it HERE and
// nowhere else. Two categories, each narrow enough that a genuine
// regression in the same file still fails on every other token:
//
//   - `homonym`  -- the token names something other than this project's plugin
//                   verdict vocabulary (a Pi-side boundary value, or the live
//                   `compatibility.unsupported` component-kind field).
//   - `subject`  -- the file's case IS the proof that the retired token is
//                   rejected, so it cannot assert that without naming it. Same
//                   reason this guard file excludes itself.
//
// Every row is asserted below to be load-bearing, which is what stops a waiver
// from outliving the line it was written for.
// ---------------------------------------------------------------------------

interface TokenWaiver {
  readonly file: string;
  readonly token: string;
  readonly category: "homonym" | "subject";
  readonly why: string;
}

const TOKEN_WAIVERS: readonly TokenWaiver[] = [
  {
    file: "tests/platform/pi-api.test.ts",
    token: '"unsupported"',
    category: "homonym",
    why: "two `@ts-expect-error` boundary probes spell a deliberately-invalid Pi `AgentMessage` role and a deliberately-invalid Pi `StopReason`. Both name Pi-side values, not this project's resolver verdict.",
  },
  {
    file: "tests/persistence/state-io.test.ts",
    token: '"unsupported"',
    category: "homonym",
    why: "a legacy `state.json` fixture spells the persisted `compatibility.unsupported` component-kind KEY. The key survives the rename (the guard's own presence checks pin it), so the fixture must keep it byte-for-byte.",
  },
  {
    file: "tests/orchestrators/plugin/install-flow.test.ts",
    token: '"unsupported"',
    category: "homonym",
    why: '`Object.hasOwn(clean, "unsupported")` reads the SAME component-kind field as the fixture above, as a property key. NREG-01 needs the absent-key fact, which cannot be asserted without naming the key.',
  },
  {
    file: "tests/edge/handlers/plugin/reinstall.test.ts",
    token: "--force",
    category: "subject",
    why: 'RINST-01 / D-67-03: the case proves reinstall REJECTS the retired overwrite flag. Its input argument and the echoed `Unknown flag: "--force".` message must spell the retired flag or the case proves nothing.',
  },
];

/** The files waived for `token`. */
function waivedFor(token: string): string[] {
  return TOKEN_WAIVERS.filter((waiver) => waiver.token === token).map((waiver) => waiver.file);
}

/** Repo-relative files in `sources` that spell `token` without a waiver. */
function unwaivedHits(token: string, sources: ReadonlyMap<string, string>): string[] {
  const waived = waivedFor(token);

  return filesContaining(token, sources).filter((rel) => !waived.includes(rel));
}

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
// reason tokens (which have an interior space). The upstream marketplace source
// sentinel is a separate homonym, masked only at its two exact use sites.
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

// MSG-SD-1: the free-text soft-dependency warning sentences were replaced by
// the per-row `{requires pi-subagents}` / `{requires pi-mcp-adapter}` reason markers.
// The retired sentences have no homonym, so no guarded file may spell them.
const ABSENT_SOFT_DEP_PROSE = ["pi-subagents is not loaded", "pi-mcp-adapter is not loaded"];

const ABSENT_TOKENS = [
  ...ABSENT_FLAGS,
  ...ABSENT_STATUS_LITERALS,
  ...ABSENT_RENDER_TOKENS,
  ...ABSENT_IDENTIFIERS,
  ...ABSENT_SOFT_DEP_PROSE,
];

for (const token of ABSENT_TOKENS) {
  test(`D-75-01 guard: absent everywhere (code + docs + unit tests) -- ${token}`, () => {
    const hits = unwaivedHits(token, STATUS_GUARDED_SOURCES);
    assert.strictEqual(
      hits.length,
      0,
      `in-scope token ${JSON.stringify(token)} must be ABSENT after the rename; found in:\n  ${hits.join("\n  ")}`,
    );
  });
}

test("D-75-01 guard: every token waiver is load-bearing", () => {
  // arrange
  const declared = new Set(ABSENT_TOKENS);

  // act
  const inert = TOKEN_WAIVERS.filter(
    (waiver) =>
      !declared.has(waiver.token) ||
      !filesContaining(waiver.token, GUARDED_SOURCES).includes(waiver.file),
  );

  // assert
  assert.deepStrictEqual(
    inert.map((waiver) => `${waiver.file} -- ${waiver.token} (${waiver.category})`),
    [],
    "a waiver whose file no longer spells its token, or whose token is no longer forbidden, silences a check nobody needs silenced. Delete the row rather than leaving it to cover a future regression.",
  );
});

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
    assert.strictEqual(
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
  assert.strictEqual(
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
  assert.strictEqual(
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
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const description = match[1];
    if (description !== undefined) {
      out.push(description);
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

  assert.strictEqual(
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

  assert.strictEqual(
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
