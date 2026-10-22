import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import {
  CREDENTIAL_BASE_URL_NAMES,
  matchesPlainNamePattern,
  matchesRemoteSinkNamePattern,
  PLAIN_DENIED_NAMES,
  REMOTE_SINK_DENIED_NAMES,
  valueCarriesCredential,
} from "../../extensions/pi-claude-marketplace/domain/claude-credential-denylist.ts";

// The SHA-256 of each set's names, sorted and joined with "\n", computed from
// the Claude Code 2.1.291 binary. A mismatch means the snapshot differs from
// that binary's lists.
function digestOf(names: ReadonlySet<string>): string {
  return createHash("sha256")
    .update([...names].sort().join("\n"))
    .digest("hex");
}

// Names Claude Code 2.1.291 expands toward every sink.
const EXPANDED_NAMES = [
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "HF_TOKEN",
  "INPUT_HF_TOKEN",
  "HUGGING_FACE_HUB_TOKEN",
  "HUGGINGFACEHUB_API_TOKEN",
  "GH_ENTERPRISE_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
  "PI_CLAUDE_MARKETPLACE_EMPTY",
  "CLAUDE_PROJECT_DIR",
  "CLAUDE_PLUGIN_ROOT",
  "CLAUDE_PLUGIN_DATA",
];

const PLAIN_PATTERN_NAMES = [
  "OTEL_EXPORTER_OTLP_HEADERS",
  "INPUT_OTEL_X",
  "CLAUDE_CODE_OTEL_DIAG_STDERR",
  "CLAUDE_CODE_ARTIFACT_SYNC_BASE_URL",
  "CLAUDE_CODE_MEMORY_API_TOKEN",
];

describe("PLAIN_DENIED_NAMES", () => {
  test("AVAR-05: holds the 64 plain names of Claude Code 2.1.291", () => {
    // act
    const digest = digestOf(PLAIN_DENIED_NAMES);

    // assert
    assert.deepStrictEqual(
      { size: PLAIN_DENIED_NAMES.size, digest },
      {
        size: 64,
        digest: "fe42c93c7a37ebe606d8c803cf940ff947a7686511346591f4ddafa9323bff5f",
      },
    );
  });

  test("AVAR-05: holds Claude's own credentials and secrets but not ANTHROPIC_API_KEY", () => {
    // act
    const membership = [
      "CLAUDE_CODE_OAUTH_TOKEN",
      "INPUT_MCP_CLIENT_SECRET",
      "ANTHROPIC_API_KEY",
    ].map((name) => PLAIN_DENIED_NAMES.has(name));

    // assert
    assert.deepStrictEqual(membership, [true, true, false]);
  });

  for (const name of EXPANDED_NAMES) {
    test(`AVAR-05: does not hold ${name}`, () => {
      // act
      const held = PLAIN_DENIED_NAMES.has(name);

      // assert
      assert.strictEqual(held, false);
    });
  }
});

describe("REMOTE_SINK_DENIED_NAMES", () => {
  test("AVAR-05: holds the 275 remote-sink names of Claude Code 2.1.291", () => {
    // act
    const digest = digestOf(REMOTE_SINK_DENIED_NAMES);

    // assert
    assert.deepStrictEqual(
      { size: REMOTE_SINK_DENIED_NAMES.size, digest },
      {
        size: 275,
        digest: "b4bd5ae4d4e6f7da74b3742b5fdacb94f943f60fff049fefaffea82dba1ae80d",
      },
    );
  });

  test("AVAR-05: holds ANTHROPIC_API_KEY, its INPUT_ variant and the uppercased https_proxy", () => {
    // act
    const membership = ["ANTHROPIC_API_KEY", "INPUT_ANTHROPIC_API_KEY", "HTTPS_PROXY"].map((name) =>
      REMOTE_SINK_DENIED_NAMES.has(name),
    );

    // assert
    assert.deepStrictEqual(membership, [true, true, true]);
  });

  for (const name of EXPANDED_NAMES) {
    test(`AVAR-05: does not hold ${name}`, () => {
      // act
      const held = REMOTE_SINK_DENIED_NAMES.has(name);

      // assert
      assert.strictEqual(held, false);
    });
  }
});

describe("CREDENTIAL_BASE_URL_NAMES", () => {
  test("AVAR-05: holds the 30 base-URL names of Claude Code 2.1.291", () => {
    // act
    const digest = digestOf(CREDENTIAL_BASE_URL_NAMES);

    // assert
    assert.deepStrictEqual(
      { size: CREDENTIAL_BASE_URL_NAMES.size, digest },
      {
        size: 30,
        digest: "6c45f696dc93362a9019b2f6ec4160547b3b45645c2a2dc8397f0dad815a3a58",
      },
    );
  });
});

describe("matchesPlainNamePattern", () => {
  for (const name of PLAIN_PATTERN_NAMES) {
    test(`AVAR-05: matches ${name}`, () => {
      // act
      const matched = matchesPlainNamePattern(name);

      // assert
      assert.strictEqual(matched, true);
    });
  }

  for (const name of ["OTELX", "CLAUDE_CODE_ARTIFACT_X", ...EXPANDED_NAMES]) {
    test(`AVAR-05: does not match ${name}`, () => {
      // act
      const matched = matchesPlainNamePattern(name);

      // assert
      assert.strictEqual(matched, false);
    });
  }
});

describe("matchesRemoteSinkNamePattern", () => {
  for (const name of [
    ...PLAIN_PATTERN_NAMES,
    "GIT_CONFIG_PARAMETERS",
    "GIT_CONFIG_KEY_0",
    "INPUT_GIT_CONFIG_VALUE_12",
    "CARGO_REGISTRIES_MY_REG_TOKEN",
    "ORG_GRADLE_PROJECT_MAVEN_PASSWORD",
    "ORG_GRADLE_PROJECT_MAVEN_USER",
    "POETRY_HTTP_BASIC_MYREPO_PASSWORD",
    "CONAN_LOGIN_USERNAME_REMOTE",
    "BUNDLE_GEMS__EXAMPLE__COM",
  ]) {
    test(`AVAR-05: matches ${name}`, () => {
      // act
      const matched = matchesRemoteSinkNamePattern(name);

      // assert
      assert.strictEqual(matched, true);
    });
  }

  for (const name of [
    "GIT_CONFIG_COUNT",
    "CARGO_REGISTRIES_X",
    "ORG_GRADLE_PROJECT_VERSION",
    "INPUT_API_KEY",
    "BUNDLE_PATH__VENDOR",
    ...EXPANDED_NAMES,
  ]) {
    test(`AVAR-05: does not match ${name}`, () => {
      // act
      const matched = matchesRemoteSinkNamePattern(name);

      // assert
      assert.strictEqual(matched, false);
    });
  }
});

interface ValueRow {
  readonly title: string;
  readonly value: string;
  readonly carries: boolean;
}

const VALUE_ROWS: readonly ValueRow[] = [
  { title: "a credential-free URL", value: "https://api.example.test/v1", carries: false },
  { title: "URL userinfo user:pass@", value: "https://user:pass@api.example.test", carries: true },
  {
    title: "URL userinfo followed by text after a space",
    value: "https://user:pass@api.example.test and more",
    carries: true,
  },
  {
    title: "a token-shaped URL user",
    value: `https://ghp_${"a".repeat(36)}@host.test`,
    carries: true,
  },
  {
    title: "a long URL user with letters and digits",
    value: "https://abcdefghij0123456789@host.test",
    carries: true,
  },
  {
    title: "a long URL user with no digit",
    value: "https://abcdefghijklmnopqrstuvwxyz@host.test",
    carries: false,
  },
  { title: "a short URL user", value: "https://maintainer@example.test", carries: false },
  { title: "an @ in a URL path", value: "https://example.test/path@v2", carries: false },
  { title: "a :// with nothing before it", value: "://user:pass@host.test", carries: false },
  { title: "a :// after a space", value: "x ://user:pass@host.test", carries: false },
  {
    title: "a host:port path with a query before @",
    value: "https://host.test:8080/p?x@y",
    carries: false,
  },
  {
    title: "a host:port path before a version tag",
    value: "https://registry.test:8080/pkg@v1",
    carries: false,
  },
  {
    title: "a host:port path ending in / before @",
    value: "https://host.test:8080/@v",
    carries: false,
  },
  {
    title: "a host:port path before a non-host word",
    value: "https://host.test:8080/p@%%",
    carries: false,
  },
  {
    title: "a host:port userinfo before a domain",
    value: "https://host.test:8080/p@example.com",
    carries: true,
  },
  {
    title: "a host:port userinfo before a host name",
    value: "https://host.test:8080/p@xyz",
    carries: true,
  },
  { title: "a network-path //user:pass@", value: "//user:pass@host.test", carries: true },
  { title: "a bare user:pass@host", value: "user:pass@host.example", carries: true },
  { title: "a bare host:port path before @", value: "host.test:8080/p?x@y", carries: false },
  { title: "an npm coordinate", value: "npm:left-pad@1.3.0", carries: false },
  { title: "a mailto URI", value: "mailto:me@example.test", carries: false },
  { title: "a Windows drive path holding @", value: "C:\\Users\\me@corp\\file", carries: false },
  {
    title: "a Slack webhook URL",
    value: "https://hooks.slack.com/services/T0000/B0000/abcdefghijklmnop",
    carries: true,
  },
  {
    title: "a Discord webhook URL",
    value: "https://discord.com/api/webhooks/123/abcdefghijklmnopqr",
    carries: true,
  },
  {
    title: "a Teams webhook URL",
    value: "https://acme.webhook.office.com/webhookb2/abcdefghijklmnopqrstu",
    carries: true,
  },
  {
    title: "an Authorization header value",
    value: "Authorization: Bearer abcdefgh1234",
    carries: true,
  },
  { title: "a PEM private-key header", value: "-----BEGIN TEST PRIVATE KEY-----", carries: true },
  { title: "a sonar.login value", value: "sonar.login=abcdefgh12", carries: true },
  { title: "a Token value", value: "Token AbCdEfGh1234567890abcd", carries: true },
  { title: "a Bearer value", value: "Bearer abc123def456", carries: true },
  { title: "a secret-named assignment", value: "password=hunter2", carries: true },
  {
    title: "a credential inside the first 8192 characters",
    value: `${"x".repeat(8100)} password=hunter2`,
    carries: true,
  },
  {
    title: "a credential after the first 8192 characters",
    value: `${"x".repeat(8192)} password=hunter2`,
    carries: false,
  },
];

describe("valueCarriesCredential", () => {
  for (const { title, value, carries } of VALUE_ROWS) {
    test(`AVAR-05: ${title} ${carries ? "carries" : "carries no"} credential`, () => {
      // act
      const carried = valueCarriesCredential(value);

      // assert
      assert.strictEqual(carried, carries);
    });
  }
});
