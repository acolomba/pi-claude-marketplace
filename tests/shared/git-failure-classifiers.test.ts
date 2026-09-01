import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyGitSourceAccessFailure,
  classifyGitTransportFailure,
} from "../../extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts";

// Closed-set ladder coverage for the shared git transport-failure classifier:
// every arm (non-Error input, HttpError 401/403, HttpError with a non-auth
// status, UserCanceledError via `code` and via `name`, each network errno,
// unrecognized Error fallthrough) is pinned so the install / update / fetch
// surfaces keep classifying the SAME underlying failure onto the SAME
// closed-set REASON.

test("classifyGitTransportFailure returns undefined for a non-Error throw (string)", () => {
  assert.equal(classifyGitTransportFailure("disk exploded"), undefined);
});

test("classifyGitTransportFailure returns undefined for a non-Error throw (undefined)", () => {
  assert.equal(classifyGitTransportFailure(undefined), undefined);
});

test("classifyGitTransportFailure maps HttpError 401 to authentication required", () => {
  const err = Object.assign(new Error("HTTP Error: 401 Unauthorized"), {
    code: "HttpError",
    data: { statusCode: 401 },
  });
  assert.equal(classifyGitTransportFailure(err), "authentication required");
});

test("classifyGitTransportFailure maps HttpError 403 to authentication required", () => {
  const err = Object.assign(new Error("HTTP Error: 403 Forbidden"), {
    code: "HttpError",
    data: { statusCode: 403 },
  });
  assert.equal(classifyGitTransportFailure(err), "authentication required");
});

for (const [statusCode, reason] of [
  [404, "source missing"],
  [410, "source missing"],
  [408, "network unreachable"],
  [429, "network unreachable"],
  [500, "network unreachable"],
  [502, "network unreachable"],
  [503, "network unreachable"],
  [504, "network unreachable"],
] as const) {
  test(`classifyGitSourceAccessFailure maps HttpError ${statusCode} to ${reason}`, () => {
    const err = Object.assign(new Error(`HTTP Error: ${statusCode}`), {
      code: "HttpError",
      data: { statusCode },
    });
    assert.equal(classifyGitSourceAccessFailure(err), reason);
  });

  test(`classifyGitTransportFailure leaves HttpError ${statusCode} to caller fallthrough`, () => {
    const err = Object.assign(new Error(`HTTP Error: ${statusCode}`), {
      code: "HttpError",
      data: { statusCode },
    });
    assert.equal(classifyGitTransportFailure(err), undefined);
  });
}

test("classifyGitTransportFailure leaves an HttpError with no data payload unclassified", () => {
  const err = Object.assign(new Error("HTTP Error"), { code: "HttpError" });
  assert.equal(classifyGitTransportFailure(err), undefined);
});

test("classifyGitTransportFailure maps UserCanceledError (code) to authentication required", () => {
  const err = Object.assign(new Error("The operation was canceled."), {
    code: "UserCanceledError",
  });
  assert.equal(classifyGitTransportFailure(err), "authentication required");
});

test("classifyGitTransportFailure maps UserCanceledError (name only) to authentication required", () => {
  const err = new Error("The operation was canceled.");
  err.name = "UserCanceledError";
  assert.equal(classifyGitTransportFailure(err), "authentication required");
});

for (const code of [
  "ENETUNREACH",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
]) {
  test(`classifyGitTransportFailure maps ${code} to network unreachable`, () => {
    const err = new Error(`socket failure ${code}`) as NodeJS.ErrnoException;
    err.code = code;
    assert.equal(classifyGitTransportFailure(err), "network unreachable");
  });
}

test("classifyGitTransportFailure leaves an unrecognized Error unclassified (caller fallthrough)", () => {
  assert.equal(classifyGitTransportFailure(new Error("clone corrupted")), undefined);
});

test("classifyGitTransportFailure leaves fs errnos (EACCES) unclassified for the caller's own ladder", () => {
  const err = new Error("permission denied") as NodeJS.ErrnoException;
  err.code = "EACCES";
  assert.equal(classifyGitTransportFailure(err), undefined);
});
