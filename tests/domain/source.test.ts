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
