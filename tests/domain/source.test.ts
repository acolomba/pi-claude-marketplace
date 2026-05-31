import assert from "node:assert/strict";
import test from "node:test";

import {
  githubSource,
  parsePluginSource,
  pathSource,
  sourceLogical,
  type ParsedSource,
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
    name: "MM-3 object url source",
    raw: { source: "url", url: "https://github.com/obra/superpowers.git", sha: "abc123" },
    expect: { kind: "url", url: "https://github.com/obra/superpowers.git", sha: "abc123" },
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
  { name: "SP-3 SSH git@", raw: "git@github.com:o/r.git", reasonContains: "not supported" },
  { name: "SP-3 ssh:// scheme", raw: "ssh://git@github.com/o/r", reasonContains: "not supported" },
  { name: "SP-3 non-github https", raw: "https://gitlab.com/o/r", reasonContains: "not supported" },
  {
    name: "SP-3 browser /tree/<ref>",
    raw: "https://github.com/o/r/tree/main",
    reasonContains: "browser URL",
  },
  {
    name: "SP-2 owner/repo@<ref>",
    raw: "anthropics/claude-plugins-official@v1.0",
    reasonContains: "owner/repo@<ref>",
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

test("SP-2 reject hint references the corrected URL form", () => {
  const got = parsePluginSource("anthropics/claude-plugins-official@v1.0");
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /https:\/\/github\.com\/anthropics\/claude-plugins-official#v1\.0/);
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

// ML-2 -- sourceLogical helper. Per Plan 04-01, returns the user-visible
// logical label for the `marketplace list` renderer; branches on
// ParsedSource.kind. Note: the GitHubSource fixtures are produced via
// parsePluginSource() because the codebase's githubSource() factory
// validates a single `raw` string rather than accepting owner/repo/ref
// directly (plan-doc deviation noted in 04-01 SUMMARY).
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

// -- NEW COVERAGE: uncovered paths in source.ts --

// Lines 118-123: githubObjectSource returns unknown when repo string does not parse as github
test("githubObjectSource: non-github repo string yields unknown with reason", () => {
  const got = parsePluginSource({ kind: "github", raw: "./local-path" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /github source repo is not owner\/repo/);
  }
});

// Lines 132-134: unknownObjectSource wraps an object; missing-field objects reach it
test("unknownObjectSource: object with missing npm package has JSON raw", () => {
  const obj = { source: "npm" };
  const got = parsePluginSource(obj);
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.equal(got.raw, JSON.stringify(obj));
  }
});

// Lines 147-148: gitSubdirObjectSource -- missing path field
test("gitSubdirObjectSource: missing path yields unknown with reason", () => {
  const got = parsePluginSource({ source: "git-subdir", url: "https://example.com/o/r.git" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /git-subdir source is missing url or path/);
  }
});

// Lines 147-148: gitSubdirObjectSource -- both url and path missing
test("gitSubdirObjectSource: missing url and path yields unknown with reason", () => {
  const got = parsePluginSource({ source: "git-subdir" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /git-subdir source is missing url or path/);
  }
});

// Lines 156-157: npmObjectSource -- missing package field
test("npmObjectSource: missing package yields unknown with reason", () => {
  const got = parsePluginSource({ source: "npm" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /npm source is missing package/);
  }
});

// Lines 187: parseKindObjectSource case 'url' delegates to urlObjectSource
test("parseKindObjectSource: kind=url routes to urlObjectSource", () => {
  const got = parsePluginSource({ kind: "url", url: "https://example.com/p.git" });
  assert.equal(got.kind, "url");
});

// Lines 190: parseKindObjectSource case 'git-subdir'
test("parseKindObjectSource: kind=git-subdir routes to gitSubdirObjectSource", () => {
  const got = parsePluginSource({
    kind: "git-subdir",
    url: "https://github.com/o/r.git",
    path: "plugins/p",
  });
  assert.equal(got.kind, "git-subdir");
});

// Lines 193: parseKindObjectSource case 'npm'
test("parseKindObjectSource: kind=npm routes to npmObjectSource", () => {
  const got = parsePluginSource({ kind: "npm", package: "@scope/plugin" });
  assert.equal(got.kind, "npm");
});

// Lines 196-200: parseKindObjectSource case 'unknown' reconstructs from stored fields
test("parseKindObjectSource: kind=unknown reconstructs raw and reason verbatim", () => {
  const got = parsePluginSource({ kind: "unknown", raw: "stored-raw", reason: "stored-reason" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.equal(got.raw, "stored-raw");
    assert.equal(got.reason, "stored-reason");
  }
});

// Lines 196-200: parseKindObjectSource case 'unknown' -- non-string reason uses fallback
test("parseKindObjectSource: kind=unknown with non-string reason falls back", () => {
  const got = parsePluginSource({ kind: "unknown", raw: "stored-raw", reason: 42 });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.equal(got.raw, "stored-raw");
    assert.equal(got.reason, "unknown source missing reason");
  }
});

// Lines 203: parseKindObjectSource default branch -- unrecognized kind
test("parseKindObjectSource: unrecognized kind value yields unknown with reason", () => {
  const got = parsePluginSource({ kind: "future-kind" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /unrecognized source kind: future-kind/);
  }
});

// Lines 213-217: parseDiscriminatorObjectSource case 'github' -- missing repo field
test("parseDiscriminatorObjectSource: source=github missing repo yields unknown", () => {
  const got = parsePluginSource({ source: "github" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /github source is missing repo/);
  }
});

// Lines 229: parseDiscriminatorObjectSource default -- unrecognized source discriminator
test("parseDiscriminatorObjectSource: unrecognized source value yields unknown", () => {
  const got = parsePluginSource({ source: "future-discriminator" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /unrecognized source kind: future-discriminator/);
  }
});

// Lines 240-241: parseObjectPluginSource -- object with neither kind nor source
test("parseObjectPluginSource: object without kind or source yields unknown", () => {
  const got = parsePluginSource({ url: "https://example.com" });
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /object source is missing source discriminator/);
  }
});

// Lines 290-291: owner/repo parse -- empty repo half (e.g. 'foo/')
test("owner/repo parse: empty repo half yields unknown", () => {
  const got = parsePluginSource("foo/");
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /owner\/repo halves must be non-empty/);
  }
});

// Lines 340-345: parseGitHubUrl -- path with only one segment (missing repo)
test("parseGitHubUrl: single-segment path yields unknown with must-be hint", () => {
  const got = parsePluginSource("https://github.com/onlyone");
  assert.equal(got.kind, "unknown");
  if (got.kind === "unknown") {
    assert.match(got.reason, /must be https:\/\/github\.com\/<owner>\/<repo>/);
  }
});

// Lines 400-402: sourceLogical for UrlSource -- with ref suffix
test("sourceLogical: UrlSource returns url#ref when ref present", () => {
  const parsed = parsePluginSource({
    source: "url",
    url: "https://example.com/p.git",
    ref: "v1",
  });
  assert.equal(parsed.kind, "url");
  assert.equal(sourceLogical(parsed), "https://example.com/p.git#v1");
});

// Lines 400-402: sourceLogical for UrlSource -- no ref
test("sourceLogical: UrlSource returns bare url when ref absent", () => {
  const parsed = parsePluginSource({ source: "url", url: "https://example.com/p.git" });
  assert.equal(parsed.kind, "url");
  assert.equal(sourceLogical(parsed), "https://example.com/p.git");
});

// Lines 405-407: sourceLogical for GitSubdirSource -- with ref
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

// Lines 405-407: sourceLogical for GitSubdirSource -- no ref
test("sourceLogical: GitSubdirSource returns url/path when ref absent", () => {
  const parsed = parsePluginSource({
    source: "git-subdir",
    url: "https://github.com/o/r.git",
    path: "plugins/p",
  });
  assert.equal(parsed.kind, "git-subdir");
  assert.equal(sourceLogical(parsed), "https://github.com/o/r.git/plugins/p");
});

// Lines 410-412: sourceLogical for NpmSource -- with version
test("sourceLogical: NpmSource returns npm:<package>@<version> when version present", () => {
  const parsed = parsePluginSource({
    source: "npm",
    package: "@scope/pkg",
    version: "1.2.3",
  });
  assert.equal(parsed.kind, "npm");
  assert.equal(sourceLogical(parsed), "npm:@scope/pkg@1.2.3");
});

// Lines 410-412: sourceLogical for NpmSource -- no version
test("sourceLogical: NpmSource returns npm:<package> when version absent", () => {
  const parsed = parsePluginSource({ source: "npm", package: "@scope/pkg" });
  assert.equal(parsed.kind, "npm");
  assert.equal(sourceLogical(parsed), "npm:@scope/pkg");
});
