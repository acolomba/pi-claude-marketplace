import assert from "node:assert/strict";
import test from "node:test";

import {
  appendLeakToError,
  CrossOriginChallengeError,
  PinnedCommitMissingError,
  StoredCredentialRejectedError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  classifyGitHostFailure,
  classifyGitSourceAccessFailure,
  classifyGitTransportFailure,
  hostHttpFailureFrame,
  hostHttpStatus,
} from "../../extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts";

for (const { title, createFailure } of [
  {
    title: "leaves an empty string unclassified",
    createFailure: () => "",
  },
  {
    title: "leaves null unclassified",
    createFailure: () => null,
  },
  {
    title: "leaves an empty object unclassified",
    createFailure: () => ({}),
  },
  {
    title: "leaves undefined unclassified",
    createFailure: () => undefined,
  },
] as const) {
  test(title, () => {
    // arrange
    const failure = createFailure();

    // act
    const reason = classifyGitTransportFailure(failure);

    // assert
    assert.strictEqual(reason, undefined);
  });
}

for (const { title, statusCode, expectedReason } of [
  {
    title: "leaves HTTP 400 unclassified",
    statusCode: 400,
    expectedReason: undefined,
  },
  {
    title: "classifies HTTP 401 as authentication required",
    statusCode: 401,
    expectedReason: "authentication required",
  },
  {
    title: "classifies HTTP 403 as authentication required",
    statusCode: 403,
    expectedReason: "authentication required",
  },
  {
    title: "leaves HTTP 404 unclassified",
    statusCode: 404,
    expectedReason: undefined,
  },
  {
    title: "leaves HTTP 500 unclassified",
    statusCode: 500,
    expectedReason: undefined,
  },
  {
    title: "requires an exact integer authentication status",
    statusCode: 401.5,
    expectedReason: undefined,
  },
] as const) {
  test(title, () => {
    // arrange
    const failure = Object.assign(new Error("HTTP transport failure"), {
      code: "HttpError",
      data: { statusCode },
    });

    // act
    const reason = classifyGitTransportFailure(failure);

    // assert
    assert.strictEqual(reason, expectedReason);
  });
}

test("leaves an HTTP error without a status unclassified", () => {
  // arrange
  const failure = Object.assign(new Error("HTTP transport failure"), { code: "HttpError" });

  // act
  const reason = classifyGitTransportFailure(failure);

  // assert
  assert.strictEqual(reason, undefined);
});

for (const { title, createFailure } of [
  {
    title: "classifies a cancellation code as authentication required",
    createFailure: () =>
      Object.assign(new Error("The operation was canceled."), { code: "UserCanceledError" }),
  },
  {
    title: "classifies a cancellation name as authentication required",
    createFailure: () =>
      Object.assign(new Error("The operation was canceled."), { name: "UserCanceledError" }),
  },
  {
    title: "classifies matching cancellation code and name as authentication required",
    createFailure: () =>
      Object.assign(new Error("The operation was canceled."), {
        code: "UserCanceledError",
        name: "UserCanceledError",
      }),
  },
] as const) {
  test(title, () => {
    // arrange
    const failure = createFailure();

    // act
    const reason = classifyGitTransportFailure(failure);

    // assert
    assert.strictEqual(reason, "authentication required");
  });
}

test("classifies a challenge after a cross-origin redirect as authentication required", () => {
  // arrange
  const failure = new CrossOriginChallengeError("https://sso.example.com");

  // act
  const reason = classifyGitTransportFailure(failure);

  // assert
  assert.strictEqual(reason, "authentication required");
});

test("classifies a stored credential the host rejected as authentication required", () => {
  // arrange
  const failure = new StoredCredentialRejectedError("git.example.com");

  // act
  const reason = classifyGitTransportFailure(failure);

  // assert
  assert.strictEqual(reason, "authentication required");
});

test("classifies a cancellation name before a network code", () => {
  // arrange
  const failure = Object.assign(new Error("The operation was canceled."), {
    code: "ENETUNREACH",
    name: "UserCanceledError",
  });

  // act
  const reason = classifyGitTransportFailure(failure);

  // assert
  assert.strictEqual(reason, "authentication required");
});

test("falls through a non-auth HTTP status to a cancellation name", () => {
  // arrange
  const failure = Object.assign(new Error("The operation was canceled."), {
    code: "HttpError",
    data: { statusCode: 404 },
    name: "UserCanceledError",
  });

  // act
  const reason = classifyGitTransportFailure(failure);

  // assert
  assert.strictEqual(reason, "authentication required");
});

test("classifies a direct network code on an error with a cause", () => {
  // arrange
  const failure = Object.assign(new Error("outer failure", { cause: new Error("inner failure") }), {
    code: "ECONNRESET",
  });

  // act
  const reason = classifyGitTransportFailure(failure);

  // assert
  assert.strictEqual(reason, "network unreachable");
});

test("leaves a network code on an error cause for the caller to unwrap", () => {
  // arrange
  const cause = Object.assign(new Error("inner failure"), { code: "ECONNRESET" });
  const failure = new Error("outer failure", { cause });

  // act
  const reason = classifyGitTransportFailure(failure);

  // assert
  assert.strictEqual(reason, undefined);
});

for (const code of [
  "ENETUNREACH",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
] as const) {
  test(`classifies ${code} as network unreachable`, () => {
    // arrange
    const failure = Object.assign(new Error("Git transport failure"), { code });

    // act
    const reason = classifyGitTransportFailure(failure);

    // assert
    assert.strictEqual(reason, "network unreachable");
  });
}

for (const { title, createFailure } of [
  {
    title: "leaves a generic error unclassified",
    createFailure: () => new Error("clone corrupted"),
  },
  {
    title: "leaves an error with an empty message unclassified",
    createFailure: () => new Error(""),
  },
  {
    title: "leaves a filesystem error for the caller to classify",
    createFailure: () => Object.assign(new Error("permission denied"), { code: "EACCES" }),
  },
  {
    title: "leaves a ref the remote does not have to the caller",
    createFailure: () =>
      Object.assign(new Error("Could not find stable."), {
        code: "NotFoundError",
        name: "NotFoundError",
      }),
  },
] as const) {
  test(title, () => {
    // arrange
    const failure = createFailure();

    // act
    const reason = classifyGitTransportFailure(failure);

    // assert
    assert.strictEqual(reason, undefined);
  });
}

// `classifyGitSourceAccessFailure` extends the transport ladder above with the
// repository-absence and host-HTTP arms `marketplace add` needs. Its cases
// live here because both classifiers are exports of the same module.

for (const { statusCode, expectedReason } of [
  { statusCode: 404, expectedReason: "source missing" },
  { statusCode: 410, expectedReason: "source missing" },
  { statusCode: 408, expectedReason: "network error" },
  { statusCode: 429, expectedReason: "network error" },
  { statusCode: 500, expectedReason: "network error" },
  { statusCode: 503, expectedReason: "network error" },
  { statusCode: 418, expectedReason: "network error" },
] as const) {
  test(`classifies source-access HTTP ${statusCode} as ${expectedReason ?? "unclassified"}`, () => {
    // arrange
    const failure = Object.assign(new Error(`HTTP Error: ${statusCode}`), {
      code: "HttpError",
      data: { statusCode },
    });

    // act
    const reason = classifyGitSourceAccessFailure(failure);

    // assert
    assert.strictEqual(reason, expectedReason);
  });
}

for (const { title, createFailure, expectedReason } of [
  {
    title: "keeps the transport ladder's authentication verdict for a source access",
    createFailure: () =>
      Object.assign(new Error("HTTP Error: 401"), { code: "HttpError", data: { statusCode: 401 } }),
    expectedReason: "authentication required",
  },
  {
    title: "keeps the transport ladder's network verdict for a source access",
    createFailure: () => Object.assign(new Error("Git transport failure"), { code: "ENOTFOUND" }),
    expectedReason: "network unreachable",
  },
  {
    title: "classifies a ref the remote does not have as source missing",
    createFailure: () =>
      Object.assign(new Error("Could not find stable."), {
        code: "NotFoundError",
        name: "NotFoundError",
      }),
    expectedReason: "source missing",
  },
  {
    title: "leaves a non-Error source-access failure unclassified",
    createFailure: () => null,
    expectedReason: undefined,
  },
  {
    title: "leaves a source-access HTTP error without a status unclassified",
    createFailure: () => Object.assign(new Error("HTTP Error"), { code: "HttpError" }),
    expectedReason: undefined,
  },
  {
    title: "leaves a non-HTTP source-access error for the caller to classify",
    createFailure: () => Object.assign(new Error("permission denied"), { code: "EACCES" }),
    expectedReason: undefined,
  },
] as const) {
  test(title, () => {
    // arrange
    const failure = createFailure();

    // act
    const reason = classifyGitSourceAccessFailure(failure);

    // assert
    assert.strictEqual(reason, expectedReason);
  });
}

test("leaves a ref the clone on disk does not have unclassified for the host ladder", () => {
  // arrange
  const failure = Object.assign(new Error("Could not find HEAD."), {
    code: "NotFoundError",
    name: "NotFoundError",
  });

  // act
  const reason = classifyGitHostFailure(failure);

  // assert
  assert.strictEqual(reason, undefined);
});

for (const { title, createFailure, expectedReason } of [
  {
    title: "classifies a pin the fresh clone does not hold as source missing",
    createFailure: () => new PinnedCommitMissingError("0123abc"),
    expectedReason: "source missing",
  },
  {
    title: "classifies the host's answer behind a cleanup leak",
    createFailure: () =>
      appendLeakToError(
        Object.assign(new Error("HTTP Error: 404"), {
          code: "HttpError",
          data: { statusCode: 404 },
        }),
        "staging leaked",
      ),
    expectedReason: "source missing",
  },
  {
    title: "classifies a missing pin behind a cleanup leak",
    createFailure: () =>
      appendLeakToError(new PinnedCommitMissingError("0123abc"), "staging leaked"),
    expectedReason: "source missing",
  },
] as const) {
  test(title, () => {
    // arrange
    const failure = createFailure();

    // act
    const reason = classifyGitHostFailure(failure);

    // assert
    assert.strictEqual(reason, expectedReason);
  });
}

test("classifies a transport failure behind a cleanup leak", () => {
  // arrange
  const failure = appendLeakToError(
    Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
    "staging leaked",
  );

  // act
  const reason = classifyGitTransportFailure(failure);

  // assert
  assert.strictEqual(reason, "network unreachable");
});

test("reads the host HTTP status behind a cleanup leak", () => {
  // arrange
  const failure = appendLeakToError(
    Object.assign(new Error("HTTP Error: 502"), { code: "HttpError", data: { statusCode: 502 } }),
    "staging leaked",
  );

  // act
  const status = hostHttpStatus(failure);

  // assert
  assert.strictEqual(status, 502);
});

test("classifies a ref the remote does not have behind a cleanup leak for a source access", () => {
  // arrange
  const failure = appendLeakToError(
    Object.assign(new Error("Could not find stable."), {
      code: "NotFoundError",
      name: "NotFoundError",
    }),
    "staging leaked",
  );

  // act
  const reason = classifyGitSourceAccessFailure(failure);

  // assert
  assert.strictEqual(reason, "source missing");
});

for (const { title, createFailure, expectedStatus } of [
  {
    title: "reads the status of a host HTTP answer",
    createFailure: () =>
      Object.assign(new Error("HTTP Error: 502"), { code: "HttpError", data: { statusCode: 502 } }),
    expectedStatus: 502,
  },
  {
    title: "leaves the 401/403 auth challenge to the transport ladder",
    createFailure: () =>
      Object.assign(new Error("HTTP Error: 403"), { code: "HttpError", data: { statusCode: 403 } }),
    expectedStatus: undefined,
  },
  {
    title: "reads no status from an HTTP error that carries none",
    createFailure: () =>
      Object.assign(new Error("HTTP Error"), { code: "HttpError", data: { statusCode: "500" } }),
    expectedStatus: undefined,
  },
  {
    title: "reads no status from a connection failure",
    createFailure: () => Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" }),
    expectedStatus: undefined,
  },
  {
    title: "reads no status from a thrown non-Error",
    createFailure: () => ({ code: "HttpError", data: { statusCode: 500 } }),
    expectedStatus: undefined,
  },
] as const) {
  test(title, () => {
    // arrange
    const failure = createFailure();

    // act
    const status = hostHttpStatus(failure);

    // assert
    assert.strictEqual(status, expectedStatus);
  });
}

test("frames a host HTTP answer as its status on the fetched URL", () => {
  // arrange
  const failure = Object.assign(new Error("HTTP Error: 500"), {
    code: "HttpError",
    data: { statusCode: 500 },
  });

  // act
  const frame = hostHttpFailureFrame(failure, "https://git.example.com/acme/mp.git");

  // assert
  assert.strictEqual(frame, "500 on https://git.example.com/acme/mp.git");
});

test("frames nothing for a failure without a host HTTP status", () => {
  // arrange
  const failure = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });

  // act
  const frame = hostHttpFailureFrame(failure, "https://git.example.com/acme/mp.git");

  // assert
  assert.strictEqual(frame, undefined);
});
