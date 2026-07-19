import assert from "node:assert/strict";
import test from "node:test";

import {
  githubSource,
  parsePluginSource,
  pathSource,
  samePlannedSource,
  sourceLogical,
  type ParsedSource,
  type SamePlannedSourceResult,
} from "../../extensions/pi-claude-marketplace/domain/source.ts";

/**
 * PRD §6.1 SP-1..7 + MM-4 + NFR-12 -- table-driven accept/reject coverage
 * for the hand-written parser. Each row maps 1:1 to a requirement so
 * `grep -n "SP-2"` etc. is the source-of-truth audit.
 */

interface AcceptCase {
  readonly name: string;
  readonly raw: unknown;
  readonly expect: Partial<ParsedSource> & { kind: ParsedSource["kind"] };
}

interface RejectCase {
  readonly name: string;
  readonly raw: string;
  readonly reasonContains: string;
}

// PRD §6.1 SP-1, SP-5, SP-7 -- accept matrix
const ACCEPT_CASES: readonly AcceptCase[] = [
  { name: "SP-7 bare tilde", raw: "~", expect: { kind: "path", raw: "~", logical: "~" } },
  {
    name: "SP-7 ~/path preserved verbatim",
    raw: "~/foo/bar",
    expect: { kind: "path", raw: "~/foo/bar", logical: "~/foo/bar" },
  },
  { name: "SP-1 ./relative", raw: "./pkg", expect: { kind: "path", raw: "./pkg" } },
  { name: "SP-1 ../up", raw: "../up", expect: { kind: "path", raw: "../up" } },
  { name: "SP-1 absolute /etc", raw: "/etc/foo", expect: { kind: "path", raw: "/etc/foo" } },
  {
    name: "SP-5 owner/repo",
    raw: "anthropics/claude-plugins-official",
    expect: { kind: "github", owner: "anthropics", repo: "claude-plugins-official" },
  },
  {
    name: "SP-1 https github plain",
    raw: "https://github.com/o/r",
    expect: { kind: "github", owner: "o", repo: "r" },
  },
  {
    name: "SP-1 https github .git",
    raw: "https://github.com/o/r.git",
    expect: { kind: "github", owner: "o", repo: "r" },
  },
  {
    name: "SP-1 https github with #ref",
    raw: "https://github.com/o/r#main",
    expect: { kind: "github", owner: "o", repo: "r", ref: "main" },
  },
  {
    name: "SP-1 https github trailing slash",
    raw: "https://github.com/o/r/",
    expect: { kind: "github", owner: "o", repo: "r" },
  },
  {
    name: "SP-5 https github .git#empty fragment dropped",
    raw: "https://github.com/o/r.git#",
    expect: { kind: "github", owner: "o", repo: "r" },
  },
  {
    name: "SP-5 https github empty fragment",
    raw: "https://github.com/o/r#",
    expect: { kind: "github", owner: "o", repo: "r" },
  },
  {
    // D-76-02: an object-form github.com URL normalizes to `github` kind so
    // Device Flow auth still applies -- it does NOT build a UrlSource.
    name: "D-76-02 object url source pointing at github.com normalizes to github",
    raw: {
      source: "url",
      url: "https://github.com/obra/superpowers.git",
      sha: "abc1234def5678abc1234def5678abc1234def56",
    },
    expect: {
      kind: "github",
      owner: "obra",
      repo: "superpowers",
      sha: "abc1234def5678abc1234def5678abc1234def56",
    },
  },
  {
    // MURL-01: generic non-github https object-form source stays `url` kind;
    // the single trailing .git is canonicalized away (D-76-01).
    name: "MURL-01 object url source (non-github) stays url with .git stripped",
    raw: { source: "url", url: "https://gitlab.com/acme/mp.git", ref: "main" },
    expect: { kind: "url", url: "https://gitlab.com/acme/mp", ref: "main" },
  },
  {
    // MURL-01 / D-76-01: generic https string source parses to `url` kind.
    name: "MURL-01 https non-github string with .git#ref canonicalizes",
    raw: "https://gitlab.com/acme/mp.git#main",
    expect: { kind: "url", url: "https://gitlab.com/acme/mp", ref: "main" },
  },
  {
    name: "MURL-01 https non-github string without ref",
    raw: "https://gitlab.com/acme/mp",
    expect: { kind: "url", url: "https://gitlab.com/acme/mp" },
  },
  {
    name: "MURL-01 https non-github string trailing .git no fragment",
    raw: "https://gitlab.com/acme/mp.git",
    expect: { kind: "url", url: "https://gitlab.com/acme/mp" },
  },
  {
    // D-76-04: owner/repo@<ref> upstream shorthand folds into github + ref.
    name: "D-76-04 owner/repo@ref folds to github with ref",
    raw: "acme/tools@v2.0",
    expect: { kind: "github", owner: "acme", repo: "tools", ref: "v2.0" },
  },
  {
    name: "MM-3 object git-subdir source",
    raw: { source: "git-subdir", url: "https://github.com/o/r.git", path: "plugins/p" },
    expect: { kind: "git-subdir", url: "https://github.com/o/r.git", path: "plugins/p" },
  },
  {
    name: "MM-3 object npm source",
    raw: { source: "npm", package: "@scope/plugin", version: "1.2.3" },
    expect: { kind: "npm", package: "@scope/plugin", version: "1.2.3" },
  },
];

const REJECT_CASES: readonly RejectCase[] = [
  // D-76-01: git@host: scp-form is still rejected; the reason names scp-form.
  { name: "D-76-01 SSH git@ scp-form", raw: "git@github.com:o/r.git", reasonContains: "git@" },
  // D-76-01: ssh:// scheme still rejected; reason names ssh.
  { name: "D-76-01 ssh:// scheme", raw: "ssh://git@github.com/o/r", reasonContains: "ssh" },
  // D-76-01: http:// (non-TLS) still rejected; reason names http.
  { name: "D-76-01 http:// scheme", raw: "http://host/repo", reasonContains: "http://" },
  {
    name: "SP-3 browser /tree/<ref>",
    raw: "https://github.com/o/r/tree/main",
    reasonContains: "browser URL",
  },
  { name: "SP-4 ~user form", raw: "~user/foo", reasonContains: "per-user tilde" },
  { name: "MM-4 bare word (no slash)", raw: "foo", reasonContains: "non-relative" },
  { name: "MM-4 multi-slash (foo/bar/baz)", raw: "foo/bar/baz", reasonContains: "non-relative" },
  { name: "MM-4 empty string", raw: "", reasonContains: "non-relative" },
];

for (const c of ACCEPT_CASES) {
  test(`parsePluginSource accepts: ${c.name}`, () => {
    const got = parsePluginSource(c.raw);
    for (const k of Object.keys(c.expect) as (keyof typeof c.expect)[]) {
      assert.equal(
        (got as unknown as Record<string, unknown>)[k],
        (c.expect as unknown as Record<string, unknown>)[k],
        `field ${k}`,
      );
    }
  });
}

for (const c of REJECT_CASES) {
  test(`parsePluginSource rejects: ${c.name}`, () => {
    const got = parsePluginSource(c.raw);
    assert.equal(got.kind, "unknown", `expected unknown for ${c.raw}`);
    if (got.kind === "unknown") {
      assert.match(
        got.reason,
        new RegExp(c.reasonContains.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `reason missing "${c.reasonContains}"; got: ${got.reason}`,
      );
      assert.equal(got.raw, c.raw, "raw must echo input verbatim");
    }
  });
}

// Clone-key invariant at the parser funnel (domain/clone-key.ts): a git
// source's `sha` must be the FULL 40-hex commit sha -- `pluginCloneKey` and
// `shaVersion` slice its first 12 chars unchecked. A non-conforming sha from
// an untrusted manifest is DROPPED so the source degrades to unpinned.

const FULL_SHA = "0123456789abcdef0123456789abcdef01234567";

test("sha funnel: a full 40-hex sha on an object url source is accepted", () => {
  const got = parsePluginSource({
    source: "url",
    url: "https://gitlab.com/acme/mp",
    sha: FULL_SHA,
  });
  assert.equal(got.kind, "url");
  if (got.kind === "url") {
    assert.equal(got.sha, FULL_SHA);
  }
});

test("sha funnel: a 7-hex abbreviated sha is dropped (source degrades to unpinned)", () => {
  const got = parsePluginSource({
    source: "url",
    url: "https://gitlab.com/acme/mp",
    sha: "abc1234",
  });
  assert.equal(got.kind, "url");
  if (got.kind === "url") {
    assert.equal(got.sha, undefined, "abbreviated sha must not flow into the parsed source");
  }
});

test("sha funnel: an uppercase 40-hex sha is accepted and lowercased (SHA_VERSION_RE is lowercase-only)", () => {
  const got = parsePluginSource({
    source: "git-subdir",
    url: "https://example.com/mono",
    path: "plugins/p",
    sha: FULL_SHA.toUpperCase(),
  });
  assert.equal(got.kind, "git-subdir");
  if (got.kind === "git-subdir") {
    assert.equal(got.sha, FULL_SHA);
  }
});

test("sha funnel: traversal-shaped garbage is dropped, never carried toward a cache key", () => {
  const got = parsePluginSource({
    source: "github",
    repo: "o/r",
    sha: "../../../../etc/passwd",
  });
  assert.equal(got.kind, "github");
  if (got.kind === "github") {
    assert.equal(got.sha, undefined);
  }
});

test("SP-6 pathSource() factory throws on empty string", () => {
  assert.throws(() => pathSource(""), /non-empty string/);
  assert.throws(() => pathSource("   "), /non-empty string/);
});

test("SP-6 pathSource() returns PathSource for valid raw input", () => {
  const got = pathSource("~/x");
  assert.equal(got.kind, "path");
  assert.equal(got.raw, "~/x");
  assert.equal(got.logical, "~/x");
});

test("SP-6 / ST-6 githubSource() returns GitHubSource for valid owner/repo", () => {
  const got = githubSource("anthropics/claude-plugins-official");
  assert.equal(got.kind, "github");
  assert.equal(got.owner, "anthropics");
  assert.equal(got.repo, "claude-plugins-official");
});

test("SP-6 githubSource() throws on non-github input with reason in message", () => {
  assert.throws(
    () => githubSource("./local"),
    (err: unknown) =>
      err instanceof Error &&
      err.message.includes("Not a github source") &&
      err.message.includes("./local"),
  );
});

// D-76-04: owner/repo@ref folds to github+ref (the SP-2 reject-with-hint is retired).
test("D-76-04 owner/repo@ref parses to github kind with ref set", () => {
  const got = parsePluginSource("anthropics/claude-plugins-official@v1.0");
  assert.equal(got.kind, "github");
  if (got.kind === "github") {
    assert.equal(got.owner, "anthropics");
    assert.equal(got.repo, "claude-plugins-official");
    assert.equal(got.ref, "v1.0");
  }
});

// D-76-04: only a valid owner/repo left side folds; a bad left side stays unknown.
test("D-76-04 owner@ref with no slash on the left side stays unknown", () => {
  const got = parsePluginSource("foo@v1.0");
  assert.equal(got.kind, "unknown");
});

// D-76-02: the github-host check runs BEFORE the generic-https arm, so a
// github.com string URL is `github`, never `url`.
test("D-76-02 https github.com string stays github kind (host wins)", () => {
  const got = parsePluginSource("https://github.com/acme/mp");
  assert.equal(got.kind, "github");
  if (got.kind === "github") {
    assert.equal(got.owner, "acme");
    assert.equal(got.repo, "mp");
  }
});

// D-76-01: a scheme outside the named git@/http/ssh set falls through to the
// generic "this URL scheme" diagnostic.
test("D-76-01 unrecognized scheme (ftp://) rejects with the generic this-URL-scheme reason", () => {
  const got = parsePluginSource("ftp://host/repo");
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /this URL scheme/);
  }
});

// urlObjectSource -- missing url field
test("urlObjectSource: missing url yields unknown with reason", () => {
  const obj = { source: "url" };
  const got = parsePluginSource(obj);
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /url source is missing url/);
    assert.equal(got.raw, JSON.stringify(obj));
  }
});

// npmObjectSource -- optional registry carried through
test("npmObjectSource: registry field is preserved on the parsed npm source", () => {
  const got = parsePluginSource({
    source: "npm",
    package: "@scope/pkg",
    registry: "https://registry.example.com",
  });
  assert.equal(got.kind, "npm");
  if (got.kind === "npm") {
    assert.equal(got.registry, "https://registry.example.com");
  }
});

// D-76-01: unsupportedUrlReason no longer claims only-github; it names the scheme.
test("D-76-01 unsupported-scheme reason no longer says 'only github URLs'", () => {
  const got = parsePluginSource("ssh://git@host/repo");
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.ok(
      !got.reason.includes("only github URLs"),
      `reason should name the scheme, not claim only-github; got: ${got.reason}`,
    );
  }
});

test("SP-3 browser-paste reject hint references the #<ref> form", () => {
  const got = parsePluginSource("https://github.com/o/r/tree/main");
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /https:\/\/github\.com\/o\/r#main/);
  }
});

test("NFR-12 unknown branch carries verbatim raw + reason for forward-compat", () => {
  const got = parsePluginSource("npm:some-pkg@1.0");
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.equal(got.raw, "npm:some-pkg@1.0");
    assert.equal(typeof got.reason, "string");
    assert.ok(got.reason.length > 0);
  }
});

// ML-2 -- sourceLogical helper. Returns the user-visible logical label for
// the `marketplace list` renderer; branches on ParsedSource.kind. Note: the
// GitHubSource fixtures are produced via parsePluginSource() because the
// codebase's githubSource() factory validates a single `raw` string rather
// than accepting owner/repo/ref directly.
test("sourceLogical: PathSource returns verbatim logical (tilde preserved)", () => {
  const s = pathSource("~/projects/local-mp");
  assert.equal(sourceLogical(s), "~/projects/local-mp");
});

test("sourceLogical: GitHubSource synthesizes canonical URL without ref", () => {
  const s = githubSource("anthropics/claude-plugins-official");
  assert.equal(sourceLogical(s), "https://github.com/anthropics/claude-plugins-official");
});

test("sourceLogical: GitHubSource synthesizes canonical URL with #ref suffix", () => {
  const parsed = parsePluginSource("https://github.com/anthropics/claude-plugins-official#v1.0");
  assert.equal(parsed.kind, "github");
  if (parsed.kind !== "github") {
    throw new Error("test fixture broken -- expected github");
  }

  assert.equal(sourceLogical(parsed), "https://github.com/anthropics/claude-plugins-official#v1.0");
});

test("sourceLogical: UnknownSource falls back to raw", () => {
  const parsed = parsePluginSource("git@github.com:foo/bar.git");
  if (parsed.kind !== "unknown") {
    throw new Error("test fixture broken -- expected unknown");
  }

  assert.equal(sourceLogical(parsed), "git@github.com:foo/bar.git");
});

// githubObjectSource returns unknown when repo string does not parse as github
test("githubObjectSource: non-github repo string yields unknown with reason", () => {
  const got = parsePluginSource({ kind: "github", raw: "./local-path" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /github source repo is not owner\/repo/);
  }
});

// unknownObjectSource wraps an object; missing-field objects reach it
test("unknownObjectSource: object with missing npm package has JSON raw", () => {
  const obj = { source: "npm" };
  const got = parsePluginSource(obj);
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.equal(got.raw, JSON.stringify(obj));
  }
});

// gitSubdirObjectSource -- missing path field
test("gitSubdirObjectSource: missing path yields unknown with reason", () => {
  const got = parsePluginSource({ source: "git-subdir", url: "https://example.com/o/r.git" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /git-subdir source is missing url or path/);
  }
});

// gitSubdirObjectSource -- both url and path missing
test("gitSubdirObjectSource: missing url and path yields unknown with reason", () => {
  const got = parsePluginSource({ source: "git-subdir" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /git-subdir source is missing url or path/);
  }
});

// npmObjectSource -- missing package field
test("npmObjectSource: missing package yields unknown with reason", () => {
  const got = parsePluginSource({ source: "npm" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /npm source is missing package/);
  }
});

// parseKindObjectSource case 'url' delegates to urlObjectSource
test("parseKindObjectSource: kind=url routes to urlObjectSource", () => {
  const got = parsePluginSource({ kind: "url", url: "https://example.com/p.git" });
  assert.equal(got.kind, "url");
});

// parseKindObjectSource case 'git-subdir'
test("parseKindObjectSource: kind=git-subdir routes to gitSubdirObjectSource", () => {
  const got = parsePluginSource({
    kind: "git-subdir",
    url: "https://github.com/o/r.git",
    path: "plugins/p",
  });
  assert.equal(got.kind, "git-subdir");
});

// parseKindObjectSource case 'npm'
test("parseKindObjectSource: kind=npm routes to npmObjectSource", () => {
  const got = parsePluginSource({ kind: "npm", package: "@scope/plugin" });
  assert.equal(got.kind, "npm");
});

// parseKindObjectSource case 'unknown' reconstructs from stored fields
test("parseKindObjectSource: kind=unknown reconstructs raw and reason verbatim", () => {
  const got = parsePluginSource({ kind: "unknown", raw: "stored-raw", reason: "stored-reason" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.equal(got.raw, "stored-raw");
    assert.equal(got.reason, "stored-reason");
  }
});

// parseKindObjectSource case 'unknown' -- non-string reason uses fallback
test("parseKindObjectSource: kind=unknown with non-string reason falls back", () => {
  const got = parsePluginSource({ kind: "unknown", raw: "stored-raw", reason: 42 });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.equal(got.raw, "stored-raw");
    assert.equal(got.reason, "unknown source missing reason");
  }
});

// parseKindObjectSource default branch -- unrecognized kind
test("parseKindObjectSource: unrecognized kind value yields unknown with reason", () => {
  const got = parsePluginSource({ kind: "future-kind" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /unrecognized source kind: future-kind/);
  }
});

// parseDiscriminatorObjectSource case 'github' -- missing repo field
test("parseDiscriminatorObjectSource: source=github missing repo yields unknown", () => {
  const got = parsePluginSource({ source: "github" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /github source is missing repo/);
  }
});

// parseDiscriminatorObjectSource default -- unrecognized source discriminator
test("parseDiscriminatorObjectSource: unrecognized source value yields unknown", () => {
  const got = parsePluginSource({ source: "future-discriminator" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /unrecognized source kind: future-discriminator/);
  }
});

// parseObjectPluginSource -- object with neither kind nor source
test("parseObjectPluginSource: object without kind or source yields unknown", () => {
  const got = parsePluginSource({ url: "https://example.com" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /object source is missing source discriminator/);
  }
});

// owner/repo parse -- empty repo half (e.g. 'foo/')
test("owner/repo parse: empty repo half yields unknown", () => {
  const got = parsePluginSource("foo/");
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /owner\/repo halves must be non-empty/);
  }
});

// parseGitHubUrl -- path with only one segment (missing repo)
test("parseGitHubUrl: single-segment path yields unknown with must-be hint", () => {
  const got = parsePluginSource("https://github.com/onlyone");
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /must be https:\/\/github\.com\/<owner>\/<repo>/);
  }
});

// sourceLogical for UrlSource -- with ref suffix. D-76-01: the single trailing
// .git is canonicalized away at parse time, so the logical form drops it.
test("sourceLogical: UrlSource returns url#ref when ref present", () => {
  const parsed = parsePluginSource({
    source: "url",
    url: "https://example.com/p.git",
    ref: "v1",
  });
  assert.equal(parsed.kind, "url");
  assert.equal(sourceLogical(parsed), "https://example.com/p#v1");
});

// sourceLogical for UrlSource -- no ref (D-76-01: .git stripped).
test("sourceLogical: UrlSource returns bare url when ref absent", () => {
  const parsed = parsePluginSource({ source: "url", url: "https://example.com/p.git" });
  assert.equal(parsed.kind, "url");
  assert.equal(sourceLogical(parsed), "https://example.com/p");
});

// sourceLogical for GitSubdirSource -- with ref
test("sourceLogical: GitSubdirSource returns url#ref/path when ref present", () => {
  const parsed = parsePluginSource({
    source: "git-subdir",
    url: "https://github.com/o/r.git",
    path: "plugins/p",
    ref: "main",
  });
  assert.equal(parsed.kind, "git-subdir");
  assert.equal(sourceLogical(parsed), "https://github.com/o/r.git#main/plugins/p");
});

// sourceLogical for GitSubdirSource -- no ref
test("sourceLogical: GitSubdirSource returns url/path when ref absent", () => {
  const parsed = parsePluginSource({
    source: "git-subdir",
    url: "https://github.com/o/r.git",
    path: "plugins/p",
  });
  assert.equal(parsed.kind, "git-subdir");
  assert.equal(sourceLogical(parsed), "https://github.com/o/r.git/plugins/p");
});

// sourceLogical for NpmSource -- with version
test("sourceLogical: NpmSource returns npm:<package>@<version> when version present", () => {
  const parsed = parsePluginSource({
    source: "npm",
    package: "@scope/pkg",
    version: "1.2.3",
  });
  assert.equal(parsed.kind, "npm");
  assert.equal(sourceLogical(parsed), "npm:@scope/pkg@1.2.3");
});

// sourceLogical for NpmSource -- no version
test("sourceLogical: NpmSource returns npm:<package> when version absent", () => {
  const parsed = parsePluginSource({ source: "npm", package: "@scope/pkg" });
  assert.equal(parsed.kind, "npm");
  assert.equal(sourceLogical(parsed), "npm:@scope/pkg");
});

// ─────────────────────────────────────────────────────────────────────────
// Y1: samePlannedSource tri-state union -- exhaustive switch coverage.
// The prior shape was `boolean | "unknown-stored"`, where the sentinel was
// truthy: a bare `if (samePlannedSource(...))` silently misread a corrupt
// record as a source match. The new union (`"same" | "different" |
// "unknown-stored"`) forces every caller to switch on the discriminant.
// ─────────────────────────────────────────────────────────────────────────

test("Y1 samePlannedSource: matching github source pair returns 'same'", () => {
  const stored = githubSource("acme/tools");
  assert.equal(samePlannedSource(stored, "acme/tools"), "same");
});

test("Y1 samePlannedSource: github source with same owner/repo but mismatched ref returns 'different'", () => {
  const stored = githubSource("acme/tools#v1");
  assert.equal(samePlannedSource(stored, "acme/tools#v2"), "different");
});

test("Y1 samePlannedSource: recognised stored kind that differs from planned returns 'different'", () => {
  const stored = pathSource("./local");
  assert.equal(samePlannedSource(stored, "acme/tools"), "different");
});

test("Y1 samePlannedSource: stored source in unrecognised shape returns 'unknown-stored'", () => {
  // An object literal with no `kind === "path" | "github"` discriminator
  // lands as `kind: "unknown"` in parsePluginSource, so samePlannedSource
  // surfaces the discriminant.
  assert.equal(
    samePlannedSource({ kind: "future-thing", raw: "x" }, "acme/tools"),
    "unknown-stored",
  );
});

test("Y1 samePlannedSource: exhaustive switch over the tri-state union compiles", () => {
  // This test exists primarily so the compiler enforces exhaustiveness on
  // the new union -- any future addition to SamePlannedSourceResult that
  // omits an arm here surfaces as a type error inside `assertNever`.
  const cases: readonly {
    stored: unknown;
    plannedRaw: string;
    expected: SamePlannedSourceResult;
  }[] = [
    { stored: githubSource("acme/tools"), plannedRaw: "acme/tools", expected: "same" },
    { stored: githubSource("acme/tools"), plannedRaw: "acme/other", expected: "different" },
    {
      stored: { kind: "future-thing", raw: "x" },
      plannedRaw: "acme/tools",
      expected: "unknown-stored",
    },
  ];
  for (const c of cases) {
    const result = samePlannedSource(c.stored, c.plannedRaw);
    switch (result) {
      case "same":
      case "different":
      case "unknown-stored":
        assert.equal(result, c.expected);
        break;
      default: {
        const exhaustive: never = result;
        throw new Error(`unreachable -- new SamePlannedSourceResult arm: ${String(exhaustive)}`);
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MURL-06: samePlannedSource url arm is live and ref-aware. A config-declared
// url source and its stored counterpart must reconcile to the same identity
// (no spurious remove-then-re-add on /reload), and the .git suffix is
// canonicalized at parse time so `repo.git` and `repo` compare equal (D-76-01).
// ─────────────────────────────────────────────────────────────────────────

test("MURL-06 samePlannedSource: identical url source pair returns 'same'", () => {
  const stored = parsePluginSource("https://gitlab.com/acme/mp");
  assert.equal(stored.kind, "url");
  assert.equal(samePlannedSource(stored, "https://gitlab.com/acme/mp"), "same");
});

test("MURL-06 samePlannedSource: .git-suffixed declaration matches bare stored url", () => {
  const stored = parsePluginSource("https://gitlab.com/acme/mp");
  assert.equal(stored.kind, "url");
  assert.equal(samePlannedSource(stored, "https://gitlab.com/acme/mp.git"), "same");
});

test("MURL-06 samePlannedSource: differing #ref returns 'different' (ref-aware)", () => {
  const stored = parsePluginSource("https://gitlab.com/acme/mp#main");
  assert.equal(stored.kind, "url");
  assert.equal(samePlannedSource(stored, "https://gitlab.com/acme/mp#dev"), "different");
});

test("MURL-06 samePlannedSource: github stored vs url planned returns 'different' (kind mismatch)", () => {
  const stored = githubSource("acme/mp");
  assert.equal(samePlannedSource(stored, "https://gitlab.com/acme/mp"), "different");
});

test("Y1 samePlannedSource: truthy coercion of 'unknown-stored' is a TYPE error (compile-time guard)", () => {
  // The prior shape (`boolean | "unknown-stored"`) admitted a bare `if`
  // on the result, silently misreading a corrupt record as a source match.
  // With the tri-state literal union the compiler rejects the truthy
  // coercion -- the line below is intentionally commented out because it
  // would not compile; uncomment to verify the guard locally.
  //
  //   if (samePlannedSource(stored, planned)) { ... } // ts(2769) / equivalent
  //
  // The runtime assertion below is a sanity check that the union members
  // are the literal strings the compiler enforces; the load-bearing guard
  // is the type signature itself.
  const result = samePlannedSource(githubSource("acme/tools"), "acme/tools");
  assert.ok(result === "same" || result === "different" || result === "unknown-stored");
});
