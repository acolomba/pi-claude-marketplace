import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  appendLeakToError,
  CrossOriginChallengeError,
  GitCommandError,
  HostedManifestHttpError,
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

function httpFailure(statusCode: unknown): Error {
  return Object.assign(new Error(`HTTP Error: ${String(statusCode)}`), {
    code: "HttpError",
    data: { statusCode },
  });
}

function gitCommandFailure(failure: GitFailure): GitCommandError {
  return new GitCommandError(failure, { operation: "clone", exitCode: 128 });
}

function remoteNotFound(): Error {
  return Object.assign(new Error("Could not find stable."), {
    code: "NotFoundError",
    name: "NotFoundError",
  });
}

const PLUGIN_CLONE_RULE = { notFound: "source missing" } as const;
const MARKETPLACE_ADD_RULE = { notFound: "source missing", missingRef: "source missing" } as const;
const MARKETPLACE_REFRESH_RULE = { notFound: "network error" } as const;
const UNKNOWN_RULE = { notFound: "source missing", unknown: "network error" } as const;
const REMOTE_URL = "https://git.example.com/acme/mp.git";

describe("classifyGitFailure", () => {
  for (const { title, createFailure, rule, remoteUrl, expected } of [
    {
      title: "classifies HTTP 401 as authentication required with no frame",
      createFailure: () => httpFailure(401),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "authentication required" },
    },
    {
      title: "classifies HTTP 403 as authentication required with no frame",
      createFailure: () => httpFailure(403),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "authentication required" },
    },
    {
      title: "classifies HTTP 404 as source missing under the source-missing rule",
      createFailure: () => httpFailure(404),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title: "classifies HTTP 404 as network error under the network-error rule",
      createFailure: () => httpFailure(404),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    {
      title: "classifies HTTP 410 as source missing under the source-missing rule",
      createFailure: () => httpFailure(410),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title: "classifies HTTP 410 as network error under the network-error rule",
      createFailure: () => httpFailure(410),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    ...[400, 408, 418, 429, 500, 502, 503].flatMap((statusCode) => [
      {
        title: `classifies HTTP ${statusCode} as network error under the source-missing rule`,
        createFailure: () => httpFailure(statusCode),
        rule: PLUGIN_CLONE_RULE,
        remoteUrl: undefined,
        expected: { reason: "network error" },
      },
      {
        title: `classifies HTTP ${statusCode} as network error under the network-error rule`,
        createFailure: () => httpFailure(statusCode),
        rule: MARKETPLACE_REFRESH_RULE,
        remoteUrl: undefined,
        expected: { reason: "network error" },
      },
    ]),
    {
      title: "frames HTTP 404 as its status on the fetched URL",
      createFailure: () => httpFailure(404),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "source missing", frame: "404 on https://git.example.com/acme/mp.git" },
    },
    {
      title: "frames HTTP 404 under the network-error rule",
      createFailure: () => httpFailure(404),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "network error", frame: "404 on https://git.example.com/acme/mp.git" },
    },
    {
      title: "frames HTTP 503 as its status on the fetched URL",
      createFailure: () => httpFailure(503),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "network error", frame: "503 on https://git.example.com/acme/mp.git" },
    },
    {
      title: "leaves an HTTP error without a status unclassified",
      createFailure: () =>
        Object.assign(new Error("HTTP transport failure"), { code: "HttpError" }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: undefined,
    },
    {
      title: "leaves an HTTP error with a string status unclassified",
      createFailure: () => httpFailure("500"),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: undefined,
    },
    {
      title: "classifies a ref the remote does not have as the rule's missing ref",
      createFailure: remoteNotFound,
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title: "leaves a ref the remote does not have unclassified when the rule sets none",
      createFailure: remoteNotFound,
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    ...(
      ["ENETUNREACH", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"] as const
    ).map((code) => ({
      title: `classifies ${code} as network unreachable`,
      createFailure: () => Object.assign(new Error("Git transport failure"), { code }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "network unreachable" },
    })),
    {
      title: "frames nothing for a network code with a URL",
      createFailure: () =>
        Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "network unreachable" },
    },
    {
      title: "classifies a challenge after a cross-origin redirect as authentication required",
      createFailure: () => new CrossOriginChallengeError("https://sso.example.com"),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "authentication required" },
    },
    {
      title: "classifies a stored credential the host rejected as authentication required",
      createFailure: () => new StoredCredentialRejectedError("git.example.com"),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "authentication required" },
    },
    {
      title: "classifies a cancellation code as authentication required",
      createFailure: () =>
        Object.assign(new Error("The operation was canceled."), { code: "UserCanceledError" }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "authentication required" },
    },
    {
      title: "classifies a cancellation name as authentication required",
      createFailure: () =>
        Object.assign(new Error("The operation was canceled."), { name: "UserCanceledError" }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "authentication required" },
    },
    {
      title: "classifies a pin the fresh clone does not hold as source missing",
      createFailure: () => new PinnedCommitMissingError("0123abc"),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "source missing" },
    },
    {
      title: "classifies and frames the host's answer behind a cleanup leak",
      createFailure: () => appendLeakToError(httpFailure(404), "staging leaked"),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "source missing", frame: "404 on https://git.example.com/acme/mp.git" },
    },
    {
      title: "classifies a host HTTP 502 behind a cleanup leak as network error",
      createFailure: () => appendLeakToError(httpFailure(502), "staging leaked"),
      rule: MARKETPLACE_REFRESH_RULE,
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    {
      title: "classifies a ref the remote does not have behind a cleanup leak",
      createFailure: () => appendLeakToError(remoteNotFound(), "staging leaked"),
      rule: MARKETPLACE_ADD_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
    },
    {
      title: "classifies a missing pin behind a cleanup leak",
      createFailure: () =>
        appendLeakToError(new PinnedCommitMissingError("0123abc"), "staging leaked"),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "source missing" },
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
      title: "leaves a thrown non-Error with an HTTP shape unclassified",
      createFailure: () => ({ code: "HttpError", data: { statusCode: 500 } }),
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
      title: "classifies a non-integer 401 status as network error, not authentication required",
      createFailure: () => httpFailure(401.5),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    {
      title: "classifies matching cancellation code and name as authentication required",
      createFailure: () =>
        Object.assign(new Error("The operation was canceled."), {
          code: "UserCanceledError",
          name: "UserCanceledError",
        }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "authentication required" },
    },
    {
      title: "classifies a cancellation name before a network code",
      createFailure: () =>
        Object.assign(new Error("The operation was canceled."), {
          code: "ENETUNREACH",
          name: "UserCanceledError",
        }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "authentication required" },
    },
    {
      title: "classifies a cancellation name before a non-auth HTTP status",
      createFailure: () =>
        Object.assign(new Error("The operation was canceled."), {
          code: "HttpError",
          data: { statusCode: 404 },
          name: "UserCanceledError",
        }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: REMOTE_URL,
      expected: { reason: "authentication required" },
    },
    {
      title: "classifies a direct network code on an error with a cause",
      createFailure: () =>
        Object.assign(new Error("outer failure", { cause: new Error("inner failure") }), {
          code: "ECONNRESET",
        }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "network unreachable" },
    },
    {
      title: "classifies an unrecognized outer error as network error",
      createFailure: () =>
        new Error("outer failure", {
          cause: Object.assign(new Error("inner failure"), { code: "ECONNRESET" }),
        }),
      rule: { ...PLUGIN_CLONE_RULE, unknown: "network error" as const },
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    {
      title: "leaves an unrecognized filesystem errno for the caller",
      createFailure: () => Object.assign(new Error("local filesystem failed"), { code: "ELOOP" }),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: undefined,
    },
    {
      title: "classifies an unrecognized git error code under the unknown rule",
      createFailure: () =>
        Object.assign(new Error("invalid smart-http response"), { code: "ParseError" }),
      rule: { ...PLUGIN_CLONE_RULE, unknown: "network error" as const },
      remoteUrl: undefined,
      expected: { reason: "network error" },
    },
    {
      title: "classifies a transport failure behind a cleanup leak",
      createFailure: () =>
        appendLeakToError(
          Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
          "staging leaked",
        ),
      rule: PLUGIN_CLONE_RULE,
      remoteUrl: undefined,
      expected: { reason: "network unreachable" },
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
        { label: "an ssh-auth", failure: { kind: "ssh-auth" } },
        { label: "an ssh-host-key-unknown", failure: { kind: "ssh-host-key-unknown" } },
        { label: "an ssh-host-key-changed", failure: { kind: "ssh-host-key-changed" } },
      ] satisfies ReadonlyArray<{ label: string; failure: GitFailure }>
    ).map(({ label, failure }) => ({
      title: `SG-PRC-05, D-SG-14: classifies ${label} failure as authentication required with no frame`,
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
});

describe("classifyGitHostFailure", () => {
  test("classifies HTTP 404 as source missing", () => {
    // arrange
    const failure = httpFailure(404);

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
});

describe("classifyGitSourceAccessFailure", () => {
  test("classifies a ref the remote does not have as source missing", () => {
    // arrange
    const failure = remoteNotFound();

    // act
    const reason = classifyGitSourceAccessFailure(failure);

    // assert
    assert.strictEqual(reason, "source missing");
  });

  test("ADD-09: classifies a remote ref missing as source missing", () => {
    // arrange
    const failure = gitCommandFailure({ kind: "remote-ref-missing" });

    // act
    const reason = classifyGitSourceAccessFailure(failure);

    // assert
    assert.strictEqual(reason, "source missing");
  });
});

describe("hostHttpFailureFrame", () => {
  test("frames a host HTTP answer as its status on the fetched URL", () => {
    // arrange
    const failure = httpFailure(500);

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
