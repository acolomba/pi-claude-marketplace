import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  appendLeakToError,
  GitCommandError,
  GitHubTransportsFailedError,
  HostedManifestHttpError,
  InvalidGitHubRepositoryError,
  PinnedCommitMissingError,
  StoredCredentialRejectedError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  classifyGitFailure,
  classifyGitHostFailure,
  classifyGitSourceAccessFailure,
  hostedFetchFailureReason,
  hostHttpFailureFrame,
} from "../../extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts";

import type { GitFailure } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

function hostedHttpFailure(statusCode: number): HostedManifestHttpError {
  return new HostedManifestHttpError("https://catalog.example.com/marketplace.json", statusCode);
}

function gitCommandFailure(failure: GitFailure): GitCommandError {
  return new GitCommandError(failure, { operation: "clone", exitCode: 128 });
}

const PLUGIN_CLONE_RULE = { notFound: "source missing" } as const;
const MARKETPLACE_ADD_RULE = { notFound: "source missing", missingRef: "source missing" } as const;
const MARKETPLACE_REFRESH_RULE = { notFound: "network error" } as const;
const UNKNOWN_RULE = { notFound: "source missing", unknown: "network error" } as const;
const REMOTE_URL = "https://git.example.com/acme/mp.git";

describe("classifyGitFailure", () => {
  for (const { title, createFailure, rule, remoteUrl, expected } of [
    ...([401, 403] as const).map((statusCode) => ({
      title: `D-PL5-10: classifies a hosted HTTP ${statusCode} as authentication required with no frame`,
      createFailure: () => hostedHttpFailure(statusCode),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "authentication required" },
    })),
    ...([404, 410] as const).flatMap((statusCode) => [
      {
        title: `D-PL5-10: classifies a hosted HTTP ${statusCode} as source missing under the source-missing rule`,
        createFailure: () => hostedHttpFailure(statusCode),
        rule: PLUGIN_CLONE_RULE,
        remoteUrl: undefined,
        expected: { reason: "source missing" },
      },
      {
        title: `D-PL5-10: classifies a hosted HTTP ${statusCode} as network error under the network-error rule`,
        createFailure: () => hostedHttpFailure(statusCode),
        rule: MARKETPLACE_REFRESH_RULE,
        remoteUrl: undefined,
        expected: { reason: "network error" },
      },
    ]),
    ...[400, 408, 418, 429, 500, 502, 503].flatMap((statusCode) => [
      {
        title: `D-PL5-10: classifies a hosted HTTP ${statusCode} as network error under the source-missing rule`,
        createFailure: () => hostedHttpFailure(statusCode),
        rule: PLUGIN_CLONE_RULE,
        remoteUrl: undefined,
        expected: { reason: "network error" },
      },
      {
        title: `D-PL5-10: classifies a hosted HTTP ${statusCode} as network error under the network-error rule`,
        createFailure: () => hostedHttpFailure(statusCode),
        rule: MARKETPLACE_REFRESH_RULE,
        remoteUrl: undefined,
        expected: { reason: "network error" },
      },
    ]),
    {
      title: "ADD-10: frames a hosted HTTP 404 as its status on the requested URL",
      createFailure: () => hostedHttpFailure(404),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "source missing", frame: "404 on https://git.example.com/acme/mp.git" },
    },
    {
      title: "UPD-11: frames a hosted HTTP 503 under the network-error rule",
      createFailure: () => hostedHttpFailure(503),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "network error", frame: "503 on https://git.example.com/acme/mp.git" },
    },
    {
      title:
        "GAUTH-04: classifies a stored credential the host rejected as authentication required",
      createFailure: () => new StoredCredentialRejectedError("git.example.com"),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "authentication required" },
    },
    {
      title: "INR-03: classifies a pin the fresh clone does not hold as source missing",
      createFailure: () => new PinnedCommitMissingError("0123abc"),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "source missing" },
    },
    ...[
      { label: "the plugin-clone rule", rule: PLUGIN_CLONE_RULE },
      { label: "the fetch rule", rule: UNKNOWN_RULE },
    ].flatMap(({ label, rule }) => [
      {
        title: `IN-A-01: classifies a refused github repository as unsupported source under ${label}`,
        createFailure: () => new InvalidGitHubRepositoryError("evil:x/ghp"),
        rule,
        remoteUrl: REMOTE_URL,
        expected: { reason: "unsupported source" },
      },
      {
        title: `IN-A-01, INR-02: classifies a refused github repository behind a cleanup leak under ${label}`,
        createFailure: () =>
          appendLeakToError(new InvalidGitHubRepositoryError("evil:x/ghp"), "staging leaked"),
        rule,
        remoteUrl: undefined,
        expected: { reason: "unsupported source" },
      },
    ]),
    {
      title: "INR-02: classifies and frames the host's answer behind a cleanup leak",
      createFailure: () =>
        appendLeakToError(
          gitCommandFailure({ kind: "network", httpStatus: 404 }),
          "staging leaked",
        ),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "source missing", frame: "404 on https://git.example.com/acme/mp.git" },
    },
    {
      title: "INR-02: classifies a hosted HTTP 502 behind a cleanup leak as network error",
      createFailure: () => appendLeakToError(hostedHttpFailure(502), "staging leaked"),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    {
      title: "INR-02: classifies a ref the remote does not have behind a cleanup leak",
      createFailure: () =>
        appendLeakToError(gitCommandFailure({ kind: "remote-ref-missing" }), "staging leaked"),
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title: "INR-02: classifies a missing pin behind a cleanup leak",
      createFailure: () =>
        appendLeakToError(new PinnedCommitMissingError("0123abc"), "staging leaked"),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title: "INR-02: classifies a refused stored credential behind a cleanup leak",
      createFailure: () =>
        appendLeakToError(new StoredCredentialRejectedError("git.example.com"), "staging leaked"),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "authentication required" },
    },
    {
      title: "leaves null unclassified",
      createFailure: () => null,
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    {
      title: "leaves an empty string unclassified",
      createFailure: () => "",
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    {
      title: "leaves an empty object unclassified",
      createFailure: () => ({}),
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    {
      title: "leaves undefined unclassified",
      createFailure: () => undefined,
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    {
      title: "leaves a thrown non-Error with an HTTP status unclassified",
      createFailure: () => ({ data: { statusCode: 500 } }),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: REMOTE_URL,
      expected: undefined,
    },
    {
      title: "leaves a filesystem error for the caller to classify",
      createFailure: () => Object.assign(new Error("permission denied"), { code: "EACCES" }),
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: REMOTE_URL,
      expected: undefined,
    },
    {
      title: "leaves a filesystem error for the caller under the unknown rule",
      createFailure: () => Object.assign(new Error("local filesystem failed"), { code: "ELOOP" }),
      rule: UNKNOWN_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    {
      title: "leaves a generic error unclassified",
      createFailure: () => new Error("clone corrupted"),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    {
      title: "leaves an error with an empty message unclassified",
      createFailure: () => new Error(""),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    {
      title: "classifies an unrecognized error as network error under the unknown rule",
      createFailure: () =>
        new Error("outer failure", {
          cause: Object.assign(new Error("inner failure"), { code: "ECONNRESET" }),
        }),
      rule: UNKNOWN_RULE,
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    {
      title: "classifies an error whose code is not an errno under the unknown rule",
      createFailure: () => Object.assign(new Error("unexpected answer"), { code: "BadAnswer" }),
      rule: UNKNOWN_RULE,
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    {
      title: "D-SG-07: classifies a git-missing failure as git missing",
      createFailure: () => gitCommandFailure({ kind: "git-missing", detail: "not-found" }),
      rule: UNKNOWN_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "git missing" },
    },
    {
      title: "D-SG-07: classifies a git-missing failure behind a cleanup leak as git missing",
      createFailure: () =>
        appendLeakToError(
          gitCommandFailure({ kind: "git-missing", detail: "macos-shim" }),
          "staging leaked",
        ),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "git missing" },
    },
    ...(
      [
        {
          label: "an https-auth no-credential",
          failure: { kind: "https-auth", detail: "no-credential" },
        },
        { label: "an https-auth rejected", failure: { kind: "https-auth", detail: "rejected" } },
        {
          label: "an ssh-auth publickey",
          failure: { kind: "ssh-auth", detail: "publickey" },
        },
        {
          label: "an ssh-auth unconfirmed",
          failure: { kind: "ssh-auth", detail: "unconfirmed" },
        },
        { label: "an ssh-host-key-unknown", failure: { kind: "ssh-host-key-unknown" } },
        { label: "an ssh-host-key-changed", failure: { kind: "ssh-host-key-changed" } },
      ] satisfies ReadonlyArray<{ label: string; failure: GitFailure }>
    ).map(({ label, failure }) => ({
      title: `SG-PRC-05: classifies ${label} failure as authentication required with no frame`,
      createFailure: () => gitCommandFailure(failure),
      rule: UNKNOWN_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "authentication required" },
    })),
    {
      title: "SG-PRC-05: classifies a timeout as network unreachable",
      createFailure: () => gitCommandFailure({ kind: "timeout", timeoutMs: 5000 }),
      rule: UNKNOWN_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "network unreachable" },
    },
    {
      title: "SG-PRC-05: classifies a network failure with no status as network unreachable",
      createFailure: () => gitCommandFailure({ kind: "network", curlCode: 7 }),
      rule: UNKNOWN_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "network unreachable" },
    },
    {
      title: "UPD-11: classifies a network HTTP 404 as source missing under the plugin-clone rule",
      createFailure: () => gitCommandFailure({ kind: "network", httpStatus: 404 }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title: "UPD-11: classifies and frames a network HTTP 404 under the refresh rule",
      createFailure: () => gitCommandFailure({ kind: "network", httpStatus: 404 }),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "network error", frame: "404 on https://git.example.com/acme/mp.git" },
    },
    {
      title: "UPD-11: classifies a network HTTP 410 as source missing under the plugin-clone rule",
      createFailure: () => gitCommandFailure({ kind: "network", httpStatus: 410 }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title: "ADD-10: classifies and frames a network HTTP 503 as network error",
      createFailure: () => gitCommandFailure({ kind: "network", httpStatus: 503 }),
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "network error", frame: "503 on https://git.example.com/acme/mp.git" },
    },
    {
      title:
        "D-PL7-02: classifies a missing repository as source missing under the plugin-clone rule",
      createFailure: () => gitCommandFailure({ kind: "repository-not-found" }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "source missing" },
    },
    {
      title: "D-PL7-02: classifies a missing repository as network error under the refresh rule",
      createFailure: () => gitCommandFailure({ kind: "repository-not-found" }),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    {
      title: "ADD-10: frames a missing repository's HTTP status on the fetched URL",
      createFailure: () => gitCommandFailure({ kind: "repository-not-found", httpStatus: 404 }),
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "source missing", frame: "404 on https://git.example.com/acme/mp.git" },
    },
    {
      title: "ADD-10: frames nothing for a missing repository's HTTP status without a URL",
      createFailure: () => gitCommandFailure({ kind: "repository-not-found", httpStatus: 404 }),
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title: "SG-PRC-05: classifies a remote error as network error",
      createFailure: () => gitCommandFailure({ kind: "remote-error" }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "network error" },
    },
    ...(["commit-missing", "pin-mismatch"] as const).map((kind) => ({
      title: `INR-03: classifies a ${kind} failure as source missing`,
      createFailure: () => gitCommandFailure({ kind }),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "source missing" },
    })),
    {
      title: "ADD-09: classifies a remote ref missing as source missing under the add rule",
      createFailure: () => gitCommandFailure({ kind: "remote-ref-missing" }),
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title:
        "SG-PRC-05: leaves a remote ref missing unclassified under a rule with no missing-ref answer",
      createFailure: () => gitCommandFailure({ kind: "remote-ref-missing" }),
      rule: UNKNOWN_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    {
      title: "SG-PRC-05: leaves a local ref missing unclassified under the add rule",
      createFailure: () => gitCommandFailure({ kind: "local-ref-missing" }),
      rule: { ...MARKETPLACE_ADD_RULE, unknown: "network error" as const },
      remoteUrl: undefined,
      expected: undefined,
    },
    ...(
      [
        "git-too-old",
        "aborted",
        "proxy-refused",
        "refused-input",
        "protocol-refused",
        "dubious-ownership",
        "not-a-repository",
        "no-stderr",
        "failed",
      ] as const
    ).flatMap((kind) => [
      {
        title: `SG-PRC-05: classifies a ${kind} failure as network error under the unknown rule`,
        createFailure: () => gitCommandFailure({ kind }),
        rule: UNKNOWN_RULE,
        remoteUrl: REMOTE_URL,
        expected: { reason: "network error" },
      },
      {
        title: `SG-PRC-05: leaves a ${kind} failure unclassified under the plugin-clone rule`,
        createFailure: () => gitCommandFailure({ kind }),
        rule: PLUGIN_CLONE_RULE,
        remoteUrl: REMOTE_URL,
        expected: undefined,
      },
    ]),
  ]) {
    test(title, () => {
      // arrange
      const failure = createFailure();

      // act
      const classification = classifyGitFailure(failure, rule, remoteUrl);

      // assert
      assert.deepStrictEqual(classification, expected);
    });
  }

  test("D-PL5-10: classifies a hosted HTTP status through the git host ladder", () => {
    // arrange
    const failure = new HostedManifestHttpError("https://example.com/m.json", 404);

    // act
    const classification = classifyGitFailure(failure, MARKETPLACE_ADD_RULE);

    // assert
    assert.deepStrictEqual(classification, { reason: "source missing" });
  });

  for (const { title, last, expected } of [
    {
      title:
        "OQ-8: classifies a both-failed GitHub clone whose SSH retry was refused as authentication required",
      last: gitCommandFailure({ kind: "ssh-auth", detail: "publickey" }),
      expected: { reason: "authentication required" },
    },
    {
      title:
        "OQ-8: classifies a both-failed GitHub clone whose last attempt was unreachable as network unreachable",
      last: gitCommandFailure({ kind: "network" }),
      expected: { reason: "network unreachable" },
    },
  ]) {
    test(title, () => {
      // arrange
      const failure = new GitHubTransportsFailedError("plugin", [
        {
          transport: "https",
          url: "https://github.com/acme/ghp.git",
          error: gitCommandFailure({ kind: "https-auth", detail: "no-credential" }),
        },
        { transport: "ssh", url: "git@github.com:acme/ghp.git", error: last },
      ]);

      // act
      const classification = classifyGitFailure(failure, PLUGIN_CLONE_RULE, REMOTE_URL);

      // assert
      assert.deepStrictEqual(classification, expected);
    });
  }

  test("OQ-8: frames a both-failed GitHub clone's HTTP status with the URL its last attempt sent", () => {
    // arrange
    const failure = new GitHubTransportsFailedError("marketplace", [
      {
        transport: "ssh",
        url: "git@github.com:acme/tools.git",
        error: gitCommandFailure({ kind: "ssh-auth", detail: "unconfirmed" }),
      },
      {
        transport: "https",
        url: "https://github.com/acme/tools.git",
        error: gitCommandFailure({ kind: "network", httpStatus: 503 }),
      },
    ]);

    // act
    const classification = classifyGitFailure(failure, MARKETPLACE_REFRESH_RULE, REMOTE_URL);

    // assert
    assert.deepStrictEqual(classification, {
      reason: "network error",
      frame: "503 on https://github.com/acme/tools.git",
    });
  });

  test("OQ-8: gives a both-failed GitHub clone no frame when the caller names no remote URL", () => {
    // arrange
    const failure = new GitHubTransportsFailedError("marketplace", [
      {
        transport: "ssh",
        url: "git@github.com:acme/tools.git",
        error: gitCommandFailure({ kind: "ssh-auth", detail: "unconfirmed" }),
      },
      {
        transport: "https",
        url: "https://github.com/acme/tools.git",
        error: gitCommandFailure({ kind: "network", httpStatus: 503 }),
      },
    ]);

    // act
    const classification = classifyGitFailure(failure, MARKETPLACE_REFRESH_RULE);

    // assert
    assert.deepStrictEqual(classification, { reason: "network error" });
  });
});

describe("classifyGitHostFailure", () => {
  test("D-PL7-02: classifies a host HTTP 404 as source missing", () => {
    // arrange
    const failure = gitCommandFailure({ kind: "network", httpStatus: 404 });

    // act
    const reason = classifyGitHostFailure(failure);

    // assert
    assert.strictEqual(reason, "source missing");
  });

  test("D-SG-07: classifies a git-missing failure as git missing", () => {
    // arrange
    const failure = gitCommandFailure({ kind: "git-missing", detail: "not-found" });

    // act
    const reason = classifyGitHostFailure(failure);

    // assert
    assert.strictEqual(reason, "git missing");
  });

  test("SG-PRC-05: leaves a remote ref missing unclassified", () => {
    // arrange
    const failure = gitCommandFailure({ kind: "remote-ref-missing" });

    // act
    const reason = classifyGitHostFailure(failure);

    // assert
    assert.strictEqual(reason, undefined);
  });

  test("IN-A-01: classifies a refused github repository as unsupported source", () => {
    // arrange
    const failure = new InvalidGitHubRepositoryError("evil:x/ghp");

    // act
    const reason = classifyGitHostFailure(failure);

    // assert
    assert.strictEqual(reason, "unsupported source");
  });
});

describe("classifyGitSourceAccessFailure", () => {
  test("ADD-09: classifies a remote ref missing as source missing", () => {
    // arrange
    const failure = gitCommandFailure({ kind: "remote-ref-missing" });

    // act
    const reason = classifyGitSourceAccessFailure(failure);

    // assert
    assert.strictEqual(reason, "source missing");
  });

  test("IN-A-01: classifies a refused github repository as unsupported source", () => {
    // arrange
    const failure = new InvalidGitHubRepositoryError("evil:x/ghp");

    // act
    const reason = classifyGitSourceAccessFailure(failure);

    // assert
    assert.strictEqual(reason, "unsupported source");
  });
});

describe("hostHttpFailureFrame", () => {
  test("ADD-10: frames a host HTTP answer as its status on the fetched URL", () => {
    // arrange
    const failure = gitCommandFailure({ kind: "network", httpStatus: 500 });

    // act
    const frame = hostHttpFailureFrame(failure, "https://git.example.com/acme/mp.git");

    // assert
    assert.strictEqual(frame, "500 on https://git.example.com/acme/mp.git");
  });
});

describe("hostedFetchFailureReason", () => {
  for (const { failure, reason } of [
    { failure: "network", reason: "network unreachable" },
    { failure: "unreadable", reason: "unreadable" },
  ] as const) {
    test(`D-PL5-10: maps a ${failure} hosted download failure to ${reason}`, () => {
      // act
      const mapped = hostedFetchFailureReason(failure);

      // assert
      assert.strictEqual(mapped, reason);
    });
  }
});
