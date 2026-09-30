import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ensureGitSuffix,
  githubSource,
  parsePluginSource,
  pathSource,
  samePlannedSource,
  sourceLogical,
  stripGitSuffix,
  stripSlashAndFragment,
  type ParsedSource,
  type SamePlannedSourceResult,
  type UrlSource,
} from "../../extensions/pi-claude-marketplace/domain/source.ts";

interface ParseCase {
  readonly name: string;
  readonly raw: unknown;
  readonly source: ParsedSource;
}

interface UrlFixedPointCase {
  readonly name: string;
  readonly typed: string;
  readonly source: UrlSource;
}

interface SourceComparisonCase {
  readonly name: string;
  readonly stored: unknown;
  readonly plannedRaw: string;
  readonly sourceOutcome: SamePlannedSourceResult;
}

const FULL_SHA = "0123456789abcdef0123456789abcdef01234567";

const PARSE_CASES: readonly ParseCase[] = [
  {
    name: "preserves a bare tilde path",
    raw: "~",
    source: { kind: "path", raw: "~", logical: "~" },
  },
  {
    name: "preserves a home-relative path",
    raw: "~/foo/bar",
    source: { kind: "path", raw: "~/foo/bar", logical: "~/foo/bar" },
  },
  {
    name: "preserves a dot-relative path",
    raw: "./pkg",
    source: { kind: "path", raw: "./pkg", logical: "./pkg" },
  },
  {
    name: "preserves a parent-relative path",
    raw: "../up",
    source: { kind: "path", raw: "../up", logical: "../up" },
  },
  {
    name: "preserves an absolute path",
    raw: "/etc/foo",
    source: { kind: "path", raw: "/etc/foo", logical: "/etc/foo" },
  },
  {
    name: "parses an owner and repository shorthand",
    raw: "anthropics/claude-plugins-official",
    source: {
      kind: "github",
      raw: "anthropics/claude-plugins-official",
      owner: "anthropics",
      repo: "claude-plugins-official",
    },
  },
  {
    name: "parses an owner and repository shorthand with a reference",
    raw: "acme/tools@v2.0",
    source: {
      kind: "github",
      raw: "acme/tools@v2.0",
      owner: "acme",
      repo: "tools",
      ref: "v2.0",
    },
  },
  {
    name: "parses a GitHub URL",
    raw: "https://github.com/o/r",
    source: {
      kind: "github",
      raw: "https://github.com/o/r",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "removes the Git suffix from GitHub identity",
    raw: "https://github.com/o/r.git",
    source: {
      kind: "github",
      raw: "https://github.com/o/r.git",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "preserves a GitHub reference",
    raw: "https://github.com/o/r#main",
    source: {
      kind: "github",
      raw: "https://github.com/o/r#main",
      owner: "o",
      repo: "r",
      ref: "main",
    },
  },
  {
    name: "removes a trailing slash from GitHub identity",
    raw: "https://github.com/o/r/",
    source: {
      kind: "github",
      raw: "https://github.com/o/r/",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "drops an empty GitHub reference after a Git suffix",
    raw: "https://github.com/o/r.git#",
    source: {
      kind: "github",
      raw: "https://github.com/o/r.git#",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "drops an empty GitHub reference",
    raw: "https://github.com/o/r#",
    source: {
      kind: "github",
      raw: "https://github.com/o/r#",
      owner: "o",
      repo: "r",
    },
  },
  {
    name: "normalizes an object URL on github.com to a GitHub source",
    raw: {
      source: "url",
      url: "https://github.com/obra/superpowers.git",
      sha: "abc1234def5678abc1234def5678abc1234def56",
    },
    source: {
      kind: "github",
      raw: "https://github.com/obra/superpowers.git",
      owner: "obra",
      repo: "superpowers",
      sha: "abc1234def5678abc1234def5678abc1234def56",
    },
  },
  {
    name: "parses a generic object URL with a reference",
    raw: { source: "url", url: "https://gitlab.com/acme/mp.git", ref: "main" },
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp.git",
      url: "https://gitlab.com/acme/mp",
      ref: "main",
    },
  },
  {
    name: "parses a generic URL with a Git suffix and reference",
    raw: "https://gitlab.com/acme/mp.git#main",
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp.git#main",
      url: "https://gitlab.com/acme/mp",
      ref: "main",
    },
  },
  {
    name: "parses a generic URL without a reference",
    raw: "https://gitlab.com/acme/mp",
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp",
      url: "https://gitlab.com/acme/mp",
    },
  },
  {
    name: "removes the Git suffix from generic URL identity",
    raw: "https://gitlab.com/acme/mp.git",
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp.git",
      url: "https://gitlab.com/acme/mp",
    },
  },
  {
    name: "parses a Git subdirectory object",
    raw: { source: "git-subdir", url: "https://github.com/o/r.git", path: "plugins/p" },
    source: {
      kind: "git-subdir",
      raw: "https://github.com/o/r.git",
      url: "https://github.com/o/r.git",
      path: "plugins/p",
    },
  },
  {
    name: "parses an npm object",
    raw: { source: "npm", package: "@scope/plugin", version: "1.2.3" },
    source: {
      kind: "npm",
      raw: "@scope/plugin",
      package: "@scope/plugin",
      version: "1.2.3",
    },
  },
  {
    name: "preserves an npm registry",
    raw: {
      source: "npm",
      package: "@scope/pkg",
      registry: "https://registry.example.com",
    },
    source: {
      kind: "npm",
      raw: "@scope/pkg",
      package: "@scope/pkg",
      registry: "https://registry.example.com",
    },
  },
  {
    name: "parses a stored path from its raw field",
    raw: { kind: "path", raw: "./local" },
    source: { kind: "path", raw: "./local", logical: "./local" },
  },
  {
    name: "parses a stored path from its logical fallback",
    raw: { kind: "path", logical: "~/local" },
    source: { kind: "path", raw: "~/local", logical: "~/local" },
  },
  {
    name: "parses a stored GitHub source",
    raw: { kind: "github", raw: "o/r", ref: "main" },
    source: { kind: "github", raw: "o/r", owner: "o", repo: "r", ref: "main" },
  },
  {
    name: "parses a stored URL source",
    raw: { kind: "url", url: "https://example.com/p.git" },
    source: {
      kind: "url",
      raw: "https://example.com/p.git",
      url: "https://example.com/p",
    },
  },
  {
    name: "re-parses a stored URL source from its raw field, preserving the .git decision",
    raw: { kind: "url", raw: "https://example.com/p.git", url: "https://example.com/p" },
    source: {
      kind: "url",
      raw: "https://example.com/p.git",
      url: "https://example.com/p",
    },
  },
  {
    name: "parses a stored Git subdirectory source",
    raw: {
      kind: "git-subdir",
      url: "https://github.com/o/r.git",
      path: "plugins/p",
      ref: "main",
    },
    source: {
      kind: "git-subdir",
      raw: "https://github.com/o/r.git",
      url: "https://github.com/o/r.git",
      path: "plugins/p",
      ref: "main",
    },
  },
  {
    name: "parses a stored npm source",
    raw: { kind: "npm", package: "@scope/plugin" },
    source: { kind: "npm", raw: "@scope/plugin", package: "@scope/plugin" },
  },
  {
    name: "reconstructs a stored unknown source",
    raw: { kind: "unknown", raw: "stored-raw", reason: "stored-reason" },
    source: { kind: "unknown", raw: "stored-raw", reason: "stored-reason" },
  },
  {
    name: "parses a GitHub discriminator object",
    raw: { source: "github", repo: "o/r", sha: FULL_SHA },
    source: {
      kind: "github",
      raw: "o/r",
      owner: "o",
      repo: "r",
      sha: FULL_SHA,
    },
  },
  {
    name: "accepts a full lowercase commit SHA",
    raw: { source: "url", url: "https://gitlab.com/acme/mp", sha: FULL_SHA },
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp",
      url: "https://gitlab.com/acme/mp",
      sha: FULL_SHA,
    },
  },
  {
    name: "drops an abbreviated commit SHA",
    raw: { source: "url", url: "https://gitlab.com/acme/mp", sha: "abc1234" },
    source: {
      kind: "url",
      raw: "https://gitlab.com/acme/mp",
      url: "https://gitlab.com/acme/mp",
    },
  },
  {
    name: "lowercases a full uppercase commit SHA",
    raw: {
      source: "git-subdir",
      url: "https://example.com/mono",
      path: "plugins/p",
      sha: FULL_SHA.toUpperCase(),
    },
    source: {
      kind: "git-subdir",
      raw: "https://example.com/mono",
      url: "https://example.com/mono",
      path: "plugins/p",
      sha: FULL_SHA,
    },
  },
  {
    name: "drops a traversal-shaped commit SHA",
    raw: { source: "github", repo: "o/r", sha: "../../../../etc/passwd" },
    source: { kind: "github", raw: "o/r", owner: "o", repo: "r" },
  },
];

const UNKNOWN_PARSE_CASES: readonly ParseCase[] = [
  {
    name: "rejects a Git scp-form source",
    raw: "git@github.com:o/r.git",
    source: {
      kind: "unknown",
      raw: "git@github.com:o/r.git",
      reason:
        "git@github.com:o/r.git is not supported; git@host: scp-form URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects an SSH URL",
    raw: "ssh://git@github.com/o/r",
    source: {
      kind: "unknown",
      raw: "ssh://git@github.com/o/r",
      reason:
        "ssh://git@github.com/o/r is not supported; ssh:// URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects an HTTP URL",
    raw: "http://host/repo",
    source: {
      kind: "unknown",
      raw: "http://host/repo",
      reason:
        "http://host/repo is not supported; http:// URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects an unsupported URL scheme",
    raw: "ftp://host/repo",
    source: {
      kind: "unknown",
      raw: "ftp://host/repo",
      reason:
        "ftp://host/repo is not supported; this URL scheme URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects a GitHub browser tree URL with a canonical hint",
    raw: "https://github.com/o/r/tree/main",
    source: {
      kind: "unknown",
      raw: "https://github.com/o/r/tree/main",
      reason:
        "https://github.com/o/r/tree/main is a browser URL; use https://github.com/o/r#main instead",
    },
  },
  {
    name: "rejects a per-user tilde path",
    raw: "~user/foo",
    source: {
      kind: "unknown",
      raw: "~user/foo",
      reason: "per-user tilde (~user/...) is not supported; use ~/...",
    },
  },
  {
    name: "rejects a bare word",
    raw: "foo",
    source: {
      kind: "unknown",
      raw: "foo",
      reason: "non-relative string source foo cannot be classified",
    },
  },
  {
    name: "rejects a shorthand with several slashes",
    raw: "foo/bar/baz",
    source: {
      kind: "unknown",
      raw: "foo/bar/baz",
      reason: "non-relative string source foo/bar/baz cannot be classified",
    },
  },
  {
    name: "rejects an empty string",
    raw: "",
    source: {
      kind: "unknown",
      raw: "",
      reason: "non-relative string source  cannot be classified",
    },
  },
  {
    name: "rejects a shorthand with an empty repository",
    raw: "foo/",
    source: {
      kind: "unknown",
      raw: "foo/",
      reason: "foo/ owner/repo halves must be non-empty",
    },
  },
  {
    name: "rejects an incomplete GitHub URL",
    raw: "https://github.com/onlyone",
    source: {
      kind: "unknown",
      raw: "https://github.com/onlyone",
      reason: "https://github.com/onlyone must be https://github.com/<owner>/<repo>[.git][#<ref>]",
    },
  },
  {
    name: "rejects a reference without an owner and repository pair",
    raw: "foo@v1.0",
    source: {
      kind: "unknown",
      raw: "foo@v1.0",
      reason: "non-relative string source foo@v1.0 cannot be classified",
    },
  },
  {
    name: "rejects an object URL without a URL field",
    raw: { source: "url" },
    source: {
      kind: "unknown",
      raw: '{"source":"url"}',
      reason: "url source is missing url",
    },
  },
  {
    name: "rejects a Git subdirectory object without a path",
    raw: { source: "git-subdir", url: "https://example.com/o/r.git" },
    source: {
      kind: "unknown",
      raw: '{"source":"git-subdir","url":"https://example.com/o/r.git"}',
      reason: "git-subdir source is missing url or path",
    },
  },
  {
    name: "rejects a Git subdirectory object without a URL or path",
    raw: { source: "git-subdir" },
    source: {
      kind: "unknown",
      raw: '{"source":"git-subdir"}',
      reason: "git-subdir source is missing url or path",
    },
  },
  {
    name: "rejects an npm object without a package",
    raw: { source: "npm" },
    source: {
      kind: "unknown",
      raw: '{"source":"npm"}',
      reason: "npm source is missing package",
    },
  },
  {
    name: "rejects a stored path without raw or logical text",
    raw: { kind: "path" },
    source: {
      kind: "unknown",
      raw: '{"kind":"path"}',
      reason: "path source is missing raw",
    },
  },
  {
    name: "rejects a stored GitHub source without raw text",
    raw: { kind: "github" },
    source: {
      kind: "unknown",
      raw: '{"kind":"github"}',
      reason: "github source is missing raw",
    },
  },
  {
    name: "rejects a stored GitHub source whose raw text is a path",
    raw: { kind: "github", raw: "./local-path" },
    source: {
      kind: "unknown",
      raw: "./local-path",
      reason: "github source repo is not owner/repo",
    },
  },
  {
    name: "preserves the parser reason for an invalid stored GitHub shorthand",
    raw: { kind: "github", raw: "not-a-source" },
    source: {
      kind: "unknown",
      raw: "not-a-source",
      reason: "non-relative string source not-a-source cannot be classified",
    },
  },
  {
    name: "uses the stored unknown reason fallback",
    raw: { kind: "unknown", raw: "stored-raw", reason: 42 },
    source: {
      kind: "unknown",
      raw: "stored-raw",
      reason: "unknown source missing reason",
    },
  },
  {
    name: "uses the complete object as a stored unknown raw fallback",
    raw: { kind: "unknown", raw: 42, reason: "stored-reason" },
    source: {
      kind: "unknown",
      raw: '{"kind":"unknown","raw":42,"reason":"stored-reason"}',
      reason: "stored-reason",
    },
  },
  {
    name: "rejects an unrecognized stored source kind",
    raw: { kind: "future-kind" },
    source: {
      kind: "unknown",
      raw: '{"kind":"future-kind"}',
      reason: "unrecognized source kind: future-kind",
    },
  },
  {
    name: "rejects a GitHub discriminator without a repository",
    raw: { source: "github" },
    source: {
      kind: "unknown",
      raw: '{"source":"github"}',
      reason: "github source is missing repo",
    },
  },
  {
    name: "rejects an unrecognized source discriminator",
    raw: { source: "future-discriminator" },
    source: {
      kind: "unknown",
      raw: '{"source":"future-discriminator"}',
      reason: "unrecognized source kind: future-discriminator",
    },
  },
  {
    name: "rejects an object without a source discriminator",
    raw: { url: "https://example.com" },
    source: {
      kind: "unknown",
      raw: '{"url":"https://example.com"}',
      reason: "object source is missing source discriminator",
    },
  },
];

const INVALID_INPUT_CASES: readonly ParseCase[] = [
  {
    name: "rejects null at the exported parse boundary",
    raw: null,
    source: {
      kind: "unknown",
      raw: "null",
      reason: "source must be a string or object",
    },
  },
  {
    name: "rejects a boolean at the exported parse boundary",
    raw: true,
    source: {
      kind: "unknown",
      raw: "true",
      reason: "source must be a string or object",
    },
  },
  {
    name: "rejects a number at the exported parse boundary",
    raw: 42,
    source: {
      kind: "unknown",
      raw: "42",
      reason: "source must be a string or object",
    },
  },
  {
    name: "rejects an unstructured object at the exported parse boundary",
    raw: {},
    source: {
      kind: "unknown",
      raw: "{}",
      reason: "object source is missing source discriminator",
    },
  },
  {
    name: "rejects an empty array at the exported parse boundary",
    raw: [],
    source: {
      kind: "unknown",
      raw: "",
      reason: "source must be a string or object",
    },
  },
  {
    name: "rejects a non-empty array at the exported parse boundary",
    raw: ["source"],
    source: {
      kind: "unknown",
      raw: "source",
      reason: "source must be a string or object",
    },
  },
];

/**
 * D-2-03: the parse-time `url` is the exact string `pluginCloneKey` and
 * `pluginMirrorKey` hash, so every expected value below names a
 * `plugin-clones/<hash>` directory. Each row is an input whose answer depends on
 * the ORDER in which `domain/source.ts` strips trailing slashes and splits the
 * `#<ref>` fragment. D-2-05: the `url` arm splits the fragment off first, so a
 * path slash sitting in front of one comes off and the identity is a fixed point
 * across a persist-and-reload round trip (`URL_FIXED_POINT_CASES`). The github
 * arm strips slashes first, so that slash survives into the owner/repo
 * validation and the three-part `o/r/` it produces is rejected. Changing an
 * expected value here cold-misses every warm clone for that input.
 */
const URL_IDENTITY_CASES: readonly ParseCase[] = [
  {
    name: "strips a path slash that precedes a #<ref> fragment from the url identity",
    raw: "https://gitlab.com/o/r/#main",
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r/#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "strips a path slash that precedes an empty #fragment from the url identity",
    raw: "https://gitlab.com/o/r/#",
    source: { kind: "url", raw: "https://gitlab.com/o/r/#", url: "https://gitlab.com/o/r" },
  },
  {
    name: "strips a .git suffix behind a path slash that precedes a #<ref> fragment",
    raw: "https://gitlab.com/o/r.git/#main",
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r.git/#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "strips a trailing slash from the url identity when no #<ref> fragment follows it",
    raw: "https://gitlab.com/o/r/",
    source: { kind: "url", raw: "https://gitlab.com/o/r/", url: "https://gitlab.com/o/r" },
  },
  {
    name: "strips a trailing slash from a #<ref> fragment in the url identity",
    raw: "https://gitlab.com/o/r#main/",
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r#main/",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "strips a .git suffix behind a trailing slash from the url identity",
    raw: "https://gitlab.com/o/r.git/",
    source: { kind: "url", raw: "https://gitlab.com/o/r.git/", url: "https://gitlab.com/o/r" },
  },
  {
    name: "rejects a github url whose path slash precedes a #<ref> fragment",
    raw: "https://github.com/o/r/#main",
    source: {
      kind: "unknown",
      raw: "https://github.com/o/r/#main",
      reason:
        "https://github.com/o/r/#main must be https://github.com/<owner>/<repo>[.git][#<ref>]",
    },
  },
  {
    name: "rejects a github url whose .git suffix and path slash precede a #<ref> fragment",
    raw: "https://github.com/o/r.git/#main",
    source: {
      kind: "unknown",
      raw: "https://github.com/o/r.git/#main",
      reason:
        "https://github.com/o/r.git/#main must be https://github.com/<owner>/<repo>[.git][#<ref>]",
    },
  },
];

/**
 * D-76-01: the object form passes the same https-only scheme gate as the string
 * form. `PLUGIN_ENTRY_SCHEMA` types a manifest entry's source as `unknown`, so a
 * third-party marketplace controls every field of the object, and the two fields
 * `urlObjectSource` reads reach different consumers: `url` becomes the cache
 * identity `canonicalCloneUrl` returns, and `raw` becomes the wire url
 * `networkCloneUrl` hands to `gitOps.clone`. Each rejected scheme is therefore
 * listed twice, once per field: a gate on only one of them leaves the other as a
 * way to reach the network with an unvalidated string. T-2-10: a `raw` that
 * passes the scheme gate must still parse to the identity `url` names, because
 * `url` picks the credential host and the shared clone directory while `raw`
 * picks what is fetched; D-2-05's decorations are the only difference admitted.
 */
const URL_OBJECT_GATE_CASES: readonly ParseCase[] = [
  {
    name: "rejects an http:// identity url in the object form",
    raw: { source: "url", url: "http://evil.example/x" },
    source: {
      kind: "unknown",
      raw: "http://evil.example/x",
      reason:
        "http://evil.example/x is not supported; http:// URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects an http:// raw url in the object form",
    raw: { source: "url", raw: "http://evil.example/x", url: "https://gitlab.com/o/r" },
    source: {
      kind: "unknown",
      raw: "http://evil.example/x",
      reason:
        "http://evil.example/x is not supported; http:// URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects an ssh:// identity url in the object form",
    raw: { source: "url", url: "ssh://git@evil.example/x" },
    source: {
      kind: "unknown",
      raw: "ssh://git@evil.example/x",
      reason:
        "ssh://git@evil.example/x is not supported; ssh:// URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects an ssh:// raw url in the object form",
    raw: { source: "url", raw: "ssh://git@evil.example/x", url: "https://gitlab.com/o/r" },
    source: {
      kind: "unknown",
      raw: "ssh://git@evil.example/x",
      reason:
        "ssh://git@evil.example/x is not supported; ssh:// URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects a git@host: scp-form identity url in the object form",
    raw: { source: "url", url: "git@evil.example:o/r.git" },
    source: {
      kind: "unknown",
      raw: "git@evil.example:o/r.git",
      reason:
        "git@evil.example:o/r.git is not supported; git@host: scp-form URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects a git@host: scp-form raw url in the object form",
    raw: { source: "url", raw: "git@evil.example:o/r.git", url: "https://gitlab.com/o/r" },
    source: {
      kind: "unknown",
      raw: "git@evil.example:o/r.git",
      reason:
        "git@evil.example:o/r.git is not supported; git@host: scp-form URLs are rejected -- only https:// URLs and local paths are accepted",
    },
  },
  {
    name: "rejects a relative identity path in the object form",
    raw: { source: "url", url: "./local/path" },
    source: {
      kind: "unknown",
      raw: '{"source":"url","url":"./local/path"}',
      reason: "non-relative string source ./local/path cannot be classified",
    },
  },
  {
    name: "rejects a relative raw path in the object form",
    raw: { source: "url", raw: "./local/path", url: "https://gitlab.com/o/r" },
    source: {
      kind: "unknown",
      raw: '{"source":"url","raw":"./local/path","url":"https://gitlab.com/o/r"}',
      reason: "non-relative string source ./local/path cannot be classified",
    },
  },
  {
    name: "rejects a github browser identity url in the object form",
    raw: { source: "url", url: "https://github.com/o/r/tree/main" },
    source: {
      kind: "unknown",
      raw: "https://github.com/o/r/tree/main",
      reason:
        "https://github.com/o/r/tree/main is a browser URL; use https://github.com/o/r#main instead",
    },
  },
  {
    name: "rejects a github browser raw url in the object form",
    raw: {
      source: "url",
      raw: "https://github.com/o/r/tree/main",
      url: "https://gitlab.com/o/r",
    },
    source: {
      kind: "unknown",
      raw: "https://github.com/o/r/tree/main",
      reason:
        "https://github.com/o/r/tree/main is a browser URL; use https://github.com/o/r#main instead",
    },
  },
  {
    name: "rejects an owner/repo identity shorthand in the object form",
    raw: { source: "url", url: "o/r" },
    source: {
      kind: "unknown",
      raw: '{"source":"url","url":"o/r"}',
      reason: "non-relative string source o/r cannot be classified",
    },
  },
  {
    name: "rejects an owner/repo raw shorthand in the object form",
    raw: { source: "url", raw: "o/r", url: "https://gitlab.com/o/r" },
    source: {
      kind: "unknown",
      raw: '{"source":"url","raw":"o/r","url":"https://gitlab.com/o/r"}',
      reason: "non-relative string source o/r cannot be classified",
    },
  },
  {
    name: "accepts an https object-form url and keeps its .git decision on raw",
    raw: { source: "url", url: "https://gitlab.com/o/r.git" },
    source: { kind: "url", raw: "https://gitlab.com/o/r.git", url: "https://gitlab.com/o/r" },
  },
  {
    name: "drops the raw field of a github object url, whose wire form never reads it",
    raw: { source: "url", url: "https://github.com/o/r", raw: "http://evil.example/x" },
    source: { kind: "github", raw: "https://github.com/o/r", owner: "o", repo: "r" },
  },
  {
    name: "rejects a raw url on another host than the identity url in the object form",
    raw: { source: "url", raw: "https://evil.example/o/r", url: "https://gitlab.com/o/r" },
    source: {
      kind: "unknown",
      raw: '{"source":"url","raw":"https://evil.example/o/r","url":"https://gitlab.com/o/r"}',
      reason:
        "url source raw https://evil.example/o/r does not name the same repository as url https://gitlab.com/o/r",
    },
  },
  {
    name: "rejects a github raw url behind a non-github identity url in the object form",
    raw: { source: "url", raw: "https://github.com/evil/x", url: "https://gitlab.com/o/r" },
    source: {
      kind: "unknown",
      raw: '{"source":"url","raw":"https://github.com/evil/x","url":"https://gitlab.com/o/r"}',
      reason:
        "url source raw https://github.com/evil/x does not name the same repository as url https://gitlab.com/o/r",
    },
  },
  {
    name: "rejects a raw url on the identity host with another path in the object form",
    raw: { source: "url", raw: "https://gitlab.com/evil/x", url: "https://gitlab.com/o/r" },
    source: {
      kind: "unknown",
      raw: '{"source":"url","raw":"https://gitlab.com/evil/x","url":"https://gitlab.com/o/r"}',
      reason:
        "url source raw https://gitlab.com/evil/x does not name the same repository as url https://gitlab.com/o/r",
    },
  },
  {
    name: "rejects a raw url on another host than the identity url in a kind-tagged object",
    raw: { kind: "url", raw: "https://evil.example/o/r", url: "https://gitlab.com/o/r" },
    source: {
      kind: "unknown",
      raw: '{"kind":"url","raw":"https://evil.example/o/r","url":"https://gitlab.com/o/r"}',
      reason:
        "url source raw https://evil.example/o/r does not name the same repository as url https://gitlab.com/o/r",
    },
  },
  {
    name: "admits a raw url that differs from the identity url only by decoration in the object form",
    raw: { source: "url", raw: "https://gitlab.com/o/r.git/", url: "https://gitlab.com/o/r" },
    source: { kind: "url", raw: "https://gitlab.com/o/r.git/", url: "https://gitlab.com/o/r" },
  },
];

/**
 * D-2-03: the reload half of the identity table above. A persisted `UrlSource`
 * is re-parsed as an object, and `canonicalCloneUrl` reads the `url` these rows
 * pin, so each expected `url` names a `plugin-clones/<hash>` directory exactly
 * as the string rows do. The identity derives from the stored `url`, so the
 * three rows whose stored `url` carries a path slash strip it again and reach
 * the value the string table's first-parse rows produce -- D-2-05's fixed point,
 * which the fourth row then holds. `raw` is carried over verbatim in every row,
 * because `networkCloneUrl` reads it and the wire form keeps the `.git` decision
 * the user typed.
 */
const URL_RELOAD_IDENTITY_CASES: readonly ParseCase[] = [
  {
    name: "re-strips a path slash that precedes a #<ref> fragment from a reloaded url identity",
    raw: {
      kind: "url",
      raw: "https://gitlab.com/o/r/#main",
      url: "https://gitlab.com/o/r/",
      ref: "main",
    },
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r/#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "re-strips a path slash that precedes an empty #fragment from a reloaded url identity",
    raw: { kind: "url", raw: "https://gitlab.com/o/r/#", url: "https://gitlab.com/o/r/" },
    source: { kind: "url", raw: "https://gitlab.com/o/r/#", url: "https://gitlab.com/o/r" },
  },
  {
    name: "re-strips a .git suffix behind a path slash from a reloaded url identity",
    raw: {
      kind: "url",
      raw: "https://gitlab.com/o/r.git/#main",
      url: "https://gitlab.com/o/r.git/",
      ref: "main",
    },
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r.git/#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "reloads a url source whose identity is already stripped to a fixed point",
    raw: {
      kind: "url",
      raw: "https://gitlab.com/o/r.git/#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r.git/#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "reloads a url source whose #<ref> fragment follows no path slash",
    raw: {
      kind: "url",
      raw: "https://gitlab.com/o/r#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
];

/**
 * D-2-05: the `url` identity is a FIXED POINT. Each row's expected source is
 * written out once and asserted twice -- against the parse of the typed string,
 * and against the re-parse of the persisted `{kind, raw, url}` record that
 * source serializes to. `canonicalCloneUrl` reads `url`, so one literal
 * satisfying both is the statement that an add and every later operation hash
 * the same `plugin-clones/<hash>` directory, whatever slash, `.git` suffix or
 * `#<ref>` fragment the user typed.
 */
const URL_FIXED_POINT_CASES: readonly UrlFixedPointCase[] = [
  {
    name: "holds one identity for a path slash before a #<ref> fragment across a reload",
    typed: "https://gitlab.com/o/r/#main",
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r/#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "holds one identity for a #<ref> fragment behind no path slash across a reload",
    typed: "https://gitlab.com/o/r#main",
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "holds one identity for a .git suffix behind a path slash across a reload",
    typed: "https://gitlab.com/o/r.git/#main",
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r.git/#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "holds one identity for a .git suffix before a #<ref> fragment across a reload",
    typed: "https://gitlab.com/o/r.git#main",
    source: {
      kind: "url",
      raw: "https://gitlab.com/o/r.git#main",
      url: "https://gitlab.com/o/r",
      ref: "main",
    },
  },
  {
    name: "holds one identity for a path slash before an empty #fragment across a reload",
    typed: "https://gitlab.com/o/r/#",
    source: { kind: "url", raw: "https://gitlab.com/o/r/#", url: "https://gitlab.com/o/r" },
  },
  {
    name: "holds one identity for a .git suffix with no fragment across a reload",
    typed: "https://gitlab.com/o/r.git",
    source: { kind: "url", raw: "https://gitlab.com/o/r.git", url: "https://gitlab.com/o/r" },
  },
  {
    name: "holds one identity for a trailing slash with no fragment across a reload",
    typed: "https://gitlab.com/o/r/",
    source: { kind: "url", raw: "https://gitlab.com/o/r/", url: "https://gitlab.com/o/r" },
  },
  {
    name: "holds one identity for a bare url across a reload",
    typed: "https://gitlab.com/o/r",
    source: { kind: "url", raw: "https://gitlab.com/o/r", url: "https://gitlab.com/o/r" },
  },
];

/**
 * D-76-02: an `https://` url whose authority folds to `github.com` is a `github`
 * source, whatever case, leading `www.` labels or explicit `:443` port the user
 * typed, and it keeps the typed `raw` verbatim. An authority carrying a
 * non-default port or userinfo, a host that only contains `github.com`, and a
 * host with no path after it stay generic `url` sources.
 */
const GITHUB_HOST_FOLD_CASES: readonly ParseCase[] = [
  {
    name: "folds a mixed-case GitHub host into a GitHub source",
    raw: "https://GitHub.com/acme/repo",
    source: { kind: "github", raw: "https://GitHub.com/acme/repo", owner: "acme", repo: "repo" },
  },
  {
    name: "folds an upper-case GitHub host and strips the Git suffix from its identity",
    raw: "https://GITHUB.COM/acme/repo.git",
    source: {
      kind: "github",
      raw: "https://GITHUB.COM/acme/repo.git",
      owner: "acme",
      repo: "repo",
    },
  },
  {
    name: "folds a www. label on the GitHub host into a GitHub source",
    raw: "https://www.github.com/acme/repo",
    source: {
      kind: "github",
      raw: "https://www.github.com/acme/repo",
      owner: "acme",
      repo: "repo",
    },
  },
  {
    name: "folds repeated www. labels on the GitHub host into a GitHub source",
    raw: "https://www.www.github.com/acme/repo",
    source: {
      kind: "github",
      raw: "https://www.www.github.com/acme/repo",
      owner: "acme",
      repo: "repo",
    },
  },
  {
    name: "drops an explicit :443 port from the GitHub host and keeps the reference",
    raw: "https://github.com:443/acme/repo#main",
    source: {
      kind: "github",
      raw: "https://github.com:443/acme/repo#main",
      owner: "acme",
      repo: "repo",
      ref: "main",
    },
  },
  {
    name: "folds an upper-case www. label, a mixed-case host and a :443 port together",
    raw: "https://WWW.GitHub.com:443/acme/repo",
    source: {
      kind: "github",
      raw: "https://WWW.GitHub.com:443/acme/repo",
      owner: "acme",
      repo: "repo",
    },
  },
  {
    name: "keeps a GitHub host with a non-default port as a generic URL source",
    raw: "https://github.com:8443/acme/repo",
    source: {
      kind: "url",
      raw: "https://github.com:8443/acme/repo",
      url: "https://github.com:8443/acme/repo",
    },
  },
  {
    name: "keeps a GitHub host with userinfo as a generic URL source",
    raw: "https://user@github.com/acme/repo",
    source: {
      kind: "url",
      raw: "https://user@github.com/acme/repo",
      url: "https://user@github.com/acme/repo",
    },
  },
  {
    name: "keeps a host that only ends in github.com as a generic URL source",
    raw: "https://notgithub.com/acme/repo",
    source: {
      kind: "url",
      raw: "https://notgithub.com/acme/repo",
      url: "https://notgithub.com/acme/repo",
    },
  },
  {
    name: "keeps a host that only starts with github.com as a generic URL source",
    raw: "https://github.com.evil/acme/repo",
    source: {
      kind: "url",
      raw: "https://github.com.evil/acme/repo",
      url: "https://github.com.evil/acme/repo",
    },
  },
  {
    name: "keeps a GitHub host with no path after it as a generic URL source",
    raw: "https://github.com",
    source: { kind: "url", raw: "https://github.com", url: "https://github.com" },
  },
  {
    name: "normalizes an object URL on a mixed-case GitHub host to a GitHub source",
    raw: { source: "url", url: "https://GitHub.com/acme/repo" },
    source: { kind: "github", raw: "https://GitHub.com/acme/repo", owner: "acme", repo: "repo" },
  },
  {
    name: "rejects a browser tree URL on a mixed-case GitHub host with a canonical hint",
    raw: "https://GitHub.com/acme/repo/tree/main",
    source: {
      kind: "unknown",
      raw: "https://GitHub.com/acme/repo/tree/main",
      reason:
        "https://GitHub.com/acme/repo/tree/main is a browser URL; use https://github.com/acme/repo#main instead",
    },
  },
];

describe("parsePluginSource", () => {
  for (const { name, raw, source } of [
    ...PARSE_CASES,
    ...URL_IDENTITY_CASES,
    ...URL_RELOAD_IDENTITY_CASES,
    ...URL_OBJECT_GATE_CASES,
    ...GITHUB_HOST_FOLD_CASES,
    ...UNKNOWN_PARSE_CASES,
    ...INVALID_INPUT_CASES,
  ]) {
    test(name, () => {
      // arrange
      const expectedSource = source;

      // act
      const parsedSource = parsePluginSource(raw);

      // assert
      assert.deepStrictEqual(parsedSource, expectedSource);
    });
  }

  for (const { name, typed, source } of URL_FIXED_POINT_CASES) {
    test(name, () => {
      // arrange
      const expectedSources = [source, source];
      const persistedSource = {
        kind: "url",
        raw: source.raw,
        url: source.url,
        ...(source.ref !== undefined && { ref: source.ref }),
      };

      // act
      const parsedSources = [parsePluginSource(typed), parsePluginSource(persistedSource)];

      // assert
      assert.deepStrictEqual(parsedSources, expectedSources);
    });
  }

  test("re-parsing an already-parsed URL source is idempotent on raw", () => {
    // arrange
    const expectedRaw = "https://example.com/p.git";

    // act
    const reparsedSource = parsePluginSource(parsePluginSource(expectedRaw));

    // assert
    assert.strictEqual(reparsedSource.raw, expectedRaw);
  });
});

describe("pathSource", () => {
  for (const invalidPath of ["", "   ", 42]) {
    test("rejects " + JSON.stringify(invalidPath) + " as an empty path", () => {
      // arrange
      const expectedError = {
        name: "Error",
        message: "Path source must be a non-empty string.",
      };

      // act
      const createPathSource = () => {
        Reflect.apply(pathSource, undefined, [invalidPath]);
      };

      // assert
      assert.throws(createPathSource, expectedError);
    });
  }

  test("returns a complete path source", () => {
    // arrange
    const expectedSource: ParsedSource = { kind: "path", raw: "~/x", logical: "~/x" };

    // act
    const parsedSource = pathSource("~/x");

    // assert
    assert.deepStrictEqual(parsedSource, expectedSource);
  });
});

describe("githubSource", () => {
  test("returns a complete GitHub source", () => {
    // arrange
    const raw = "anthropics/claude-plugins-official";
    const expectedSource: ParsedSource = {
      kind: "github",
      raw,
      owner: "anthropics",
      repo: "claude-plugins-official",
    };

    // act
    const parsedSource = githubSource(raw);

    // assert
    assert.deepStrictEqual(parsedSource, expectedSource);
  });

  for (const { raw, message } of [
    { raw: "./local", message: "Not a github source: ./local -- wrong kind: path" },
    {
      raw: "not-a-source",
      message:
        "Not a github source: not-a-source -- non-relative string source not-a-source cannot be classified",
    },
  ]) {
    test("rejects " + raw + " as a non-GitHub source", () => {
      // arrange
      const expectedError = { name: "Error", message };

      // act
      const createGithubSource = () => githubSource(raw);

      // assert
      assert.throws(createGithubSource, expectedError);
    });
  }
});

describe("samePlannedSource", () => {
  const comparisons: readonly SourceComparisonCase[] = [
    {
      name: "matches equal GitHub sources",
      stored: { kind: "github", raw: "acme/tools", owner: "acme", repo: "tools" },
      plannedRaw: "acme/tools",
      sourceOutcome: "same",
    },
    {
      name: "distinguishes GitHub references",
      stored: {
        kind: "github",
        raw: "acme/tools#v1",
        owner: "acme",
        repo: "tools",
        ref: "v1",
      },
      plannedRaw: "acme/tools#v2",
      sourceOutcome: "different",
    },
    {
      name: "matches equal path sources",
      stored: { kind: "path", raw: "./local", logical: "./local" },
      plannedRaw: "./local",
      sourceOutcome: "same",
    },
    {
      name: "distinguishes unequal logical paths",
      stored: { kind: "path", raw: "./plugins/b", logical: "./plugins/b" },
      plannedRaw: "./plugins/a",
      sourceOutcome: "different",
    },
    {
      name: "distinguishes adjacent path text",
      stored: { kind: "path", raw: "./plugins/a", logical: "./plugins/a" },
      plannedRaw: "./plugins/ab",
      sourceOutcome: "different",
    },
    {
      name: "distinguishes recognized source kinds",
      stored: { kind: "path", raw: "./local", logical: "./local" },
      plannedRaw: "acme/tools",
      sourceOutcome: "different",
    },
    {
      name: "matches canonical URL identities",
      stored: {
        kind: "url",
        raw: "https://gitlab.com/acme/mp",
        url: "https://gitlab.com/acme/mp",
      },
      plannedRaw: "https://gitlab.com/acme/mp.git",
      sourceOutcome: "same",
    },
    {
      name: "distinguishes URL references",
      stored: {
        kind: "url",
        raw: "https://gitlab.com/acme/mp#main",
        url: "https://gitlab.com/acme/mp",
        ref: "main",
      },
      plannedRaw: "https://gitlab.com/acme/mp#dev",
      sourceOutcome: "different",
    },
    {
      name: "distinguishes Git subdirectory sources from invalid planned text",
      stored: {
        kind: "git-subdir",
        raw: "https://example.com/repo.git",
        url: "https://example.com/repo.git",
        path: "plugins/a",
      },
      plannedRaw: '{"source":"git-subdir"}',
      sourceOutcome: "different",
    },
    {
      name: "distinguishes npm sources from shorthand text",
      stored: { kind: "npm", raw: "@scope/pkg", package: "@scope/pkg", version: "1.2.3" },
      plannedRaw: "npm:@scope/pkg@1.2.3",
      sourceOutcome: "different",
    },
    {
      name: "reports an unrecognized stored source",
      stored: { kind: "future-thing", raw: "x" },
      plannedRaw: "acme/tools",
      sourceOutcome: "unknown-stored",
    },
  ];

  for (const { name, stored, plannedRaw, sourceOutcome } of comparisons) {
    test(name, () => {
      // arrange
      const expectedOutcome = sourceOutcome;

      // act
      const comparison = samePlannedSource(stored, plannedRaw);

      // assert
      assert.strictEqual(comparison, expectedOutcome);
    });
  }
});

describe("sourceLogical", () => {
  const labels: readonly {
    name: string;
    source: ParsedSource;
    logical: string;
  }[] = [
    {
      name: "returns a path logical value",
      source: { kind: "path", raw: "~/projects/local-mp", logical: "~/projects/local-mp" },
      logical: "~/projects/local-mp",
    },
    {
      name: "builds a GitHub URL without a reference",
      source: { kind: "github", raw: "acme/tools", owner: "acme", repo: "tools" },
      logical: "https://github.com/acme/tools",
    },
    {
      name: "builds a GitHub URL with a reference",
      source: {
        kind: "github",
        raw: "acme/tools#v1",
        owner: "acme",
        repo: "tools",
        ref: "v1",
      },
      logical: "https://github.com/acme/tools#v1",
    },
    {
      name: "returns a URL without a reference",
      source: {
        kind: "url",
        raw: "https://example.com/p",
        url: "https://example.com/p",
      },
      logical: "https://example.com/p",
    },
    {
      name: "returns a URL with a reference",
      source: {
        kind: "url",
        raw: "https://example.com/p#v1",
        url: "https://example.com/p",
        ref: "v1",
      },
      logical: "https://example.com/p#v1",
    },
    {
      name: "builds a Git subdirectory label without a reference",
      source: {
        kind: "git-subdir",
        raw: "https://example.com/repo.git",
        url: "https://example.com/repo.git",
        path: "plugins/p",
      },
      logical: "https://example.com/repo.git/plugins/p",
    },
    {
      name: "builds a Git subdirectory label with a reference",
      source: {
        kind: "git-subdir",
        raw: "https://example.com/repo.git",
        url: "https://example.com/repo.git",
        path: "plugins/p",
        ref: "main",
      },
      logical: "https://example.com/repo.git#main/plugins/p",
    },
    {
      name: "builds an npm label without a version",
      source: { kind: "npm", raw: "@scope/pkg", package: "@scope/pkg" },
      logical: "npm:@scope/pkg",
    },
    {
      name: "builds an npm label with a version",
      source: { kind: "npm", raw: "@scope/pkg", package: "@scope/pkg", version: "1.2.3" },
      logical: "npm:@scope/pkg@1.2.3",
    },
    {
      name: "returns the raw text for an unknown source",
      source: { kind: "unknown", raw: "future-source", reason: "future source" },
      logical: "future-source",
    },
  ];

  for (const { name, source, logical } of labels) {
    test(name, () => {
      // arrange
      const expectedLogical = logical;

      // act
      const sourceLabel = sourceLogical(source);

      // assert
      assert.strictEqual(sourceLabel, expectedLogical);
    });
  }
});

describe("ensureGitSuffix", () => {
  // The only production caller is `networkCloneUrl`'s github arm, which passes
  // `canonicalCloneUrl(source)`. Both inputs below are values that arm produces:
  // `https://github.com/<owner>/<repo>` for a parsed github url, and the same
  // with `.git` inside `repo` for the `owner/repo.git` shorthand.
  for (const { url, cloneUrl } of [
    { url: "https://gitlab.com/o/r", cloneUrl: "https://gitlab.com/o/r.git" },
    { url: "https://gitlab.com/o/r.git", cloneUrl: "https://gitlab.com/o/r.git" },
  ]) {
    test("normalizes " + url + " for Git transport", () => {
      // arrange
      const expectedCloneUrl = cloneUrl;

      // act
      const normalizedCloneUrl = ensureGitSuffix(url);

      // assert
      assert.strictEqual(normalizedCloneUrl, expectedCloneUrl);
    });
  }
});

describe("stripSlashAndFragment", () => {
  for (const { name, input, expected } of [
    {
      name: "trims trailing slashes only",
      input: "https://gitlab.com/o/r///",
      expected: { base: "https://gitlab.com/o/r", ref: undefined },
    },
    {
      name: "splits off a #<ref> fragment",
      input: "https://gitlab.com/o/r#main",
      expected: { base: "https://gitlab.com/o/r", ref: "main" },
    },
    {
      name: "trims a trailing slash after the #<ref> fragment before splitting it off",
      input: "https://gitlab.com/o/r#main/",
      expected: { base: "https://gitlab.com/o/r", ref: "main" },
    },
    {
      name: "trims a trailing slash that precedes the #<ref> fragment",
      input: "https://gitlab.com/o/r/#main",
      expected: { base: "https://gitlab.com/o/r", ref: "main" },
    },
    {
      name: "returns the input unchanged when it carries neither",
      input: "https://gitlab.com/o/r",
      expected: { base: "https://gitlab.com/o/r", ref: undefined },
    },
    {
      name: "drops an empty #fragment and leaves ref undefined",
      input: "https://gitlab.com/o/r#",
      expected: { base: "https://gitlab.com/o/r", ref: undefined },
    },
    {
      name: "leaves a trailing .git suffix untouched",
      input: "https://gitlab.com/o/r.git",
      expected: { base: "https://gitlab.com/o/r.git", ref: undefined },
    },
    {
      name: "keeps a trailing .git suffix and trims a trailing slash",
      input: "https://gitlab.com/o/r.git/",
      expected: { base: "https://gitlab.com/o/r.git", ref: undefined },
    },
  ]) {
    test(name, () => {
      // arrange
      const expectedStripped = expected;

      // act
      const stripped = stripSlashAndFragment(input);

      // assert
      assert.deepStrictEqual(stripped, expectedStripped);
    });
  }
});

describe("stripGitSuffix", () => {
  for (const { name, input, expected } of [
    {
      name: "strips one trailing .git suffix",
      input: "https://github.com/o/r.git",
      expected: "https://github.com/o/r",
    },
    {
      name: "returns a url without the suffix unchanged",
      input: "https://github.com/o/r",
      expected: "https://github.com/o/r",
    },
    {
      name: "strips only the last of a doubled .git.git suffix",
      input: "https://github.com/o/r.git.git",
      expected: "https://github.com/o/r.git",
    },
    {
      name: "does not fold a differing case suffix",
      input: "https://github.com/o/r.GIT",
      expected: "https://github.com/o/r.GIT",
    },
  ]) {
    test(name, () => {
      // arrange
      const expectedStripped = expected;

      // act
      const stripped = stripGitSuffix(input);

      // assert
      assert.strictEqual(stripped, expectedStripped);
    });
  }
});
