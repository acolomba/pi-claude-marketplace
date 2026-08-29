import assert from "node:assert/strict";
import test from "node:test";

import { classifyGitTransportFailure } from "../../extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts";

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
