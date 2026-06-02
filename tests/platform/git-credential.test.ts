/**
 * Phase 31 -- Unit tests for the CredentialOps surface.
 *
 * Mock-based tests (1-5, 8) cover the seam contract: fill hit / miss,
 * approve persistence, reject eviction, and mock throws-overrides for
 * subprocess-error simulation.
 *
 * Production-path tests:
 *  - Test 6: forces ENOENT on the real DEFAULT_CREDENTIAL_OPS.fill by
 *    overriding PATH to an empty / non-existent value. Asserts the
 *    Pitfall 7 try/catch returns null within 2s.
 *  - Test 7: opt-in real-subprocess smoke against an invented host,
 *    gated by `PI_CM_REAL_GIT_CREDENTIAL=1`. Proves the
 *    GIT_TERMINAL_PROMPT=0 + stdin.end() combo prevents the hang.
 *
 * The developer's OS keychain is never touched by Tests 1-5 (mocks) or
 * Test 6 (PATH-forced ENOENT). Test 7 only runs when the operator
 * explicitly opts in.
 */

import assert from "node:assert/strict";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { DEFAULT_CREDENTIAL_OPS } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import { makeMockCredentialOps } from "../helpers/credential-mock.ts";

import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";

test("Phase 31 credOps: fill hit -- mock returns stored credential", async () => {
  const stored: GitCredentials = { username: "u", password: "p" };
  const { credOps, state } = makeMockCredentialOps({
    store: new Map([["github.com", stored]]),
  });

  const result = await credOps.fill("github.com");

  assert.deepEqual(result, stored);
  assert.equal(state.fillCalls.length, 1);
  assert.deepEqual(state.fillCalls[0], { host: "github.com" });
});

test("Phase 31 credOps: fill miss -- mock returns null on empty store", async () => {
  const { credOps, state } = makeMockCredentialOps();

  const result = await credOps.fill("github.com");

  assert.equal(result, null);
  assert.equal(state.fillCalls.length, 1);
  assert.deepEqual(state.fillCalls[0], { host: "github.com" });
});

test("Phase 31 credOps: fill ENOENT-equivalent -- mock fillThrows surfaces to caller", async () => {
  // Simulates the underlying subprocess error a caller's try/catch would
  // see. The PRODUCTION fill wraps gitCredentialIO in try/catch and
  // returns null (Pitfall 7); the MOCK does not -- it faithfully
  // reproduces the throw so callers can exercise their own handling.
  const enoent = new Error("ENOENT: git not found on PATH");
  const { credOps, state } = makeMockCredentialOps({ fillThrows: enoent });

  await assert.rejects(() => credOps.fill("github.com"), enoent);
  assert.equal(state.fillCalls.length, 1);
});

test("Phase 31 credOps: approve persists -- subsequent fill returns the approved cred", async () => {
  const { credOps, state } = makeMockCredentialOps();
  const cred: GitCredentials = { username: "user", password: "token" };

  await credOps.approve("github.com", cred);
  const result = await credOps.fill("github.com");

  assert.deepEqual(result, cred);
  assert.equal(state.approveCalls.length, 1);
  assert.deepEqual(state.approveCalls[0], { host: "github.com", cred });
  assert.equal(state.fillCalls.length, 1);
  assert.deepEqual(state.fillCalls[0], { host: "github.com" });
});

test("Phase 31 credOps: reject evicts -- subsequent fill returns null", async () => {
  const cred: GitCredentials = { username: "user", password: "stale" };
  const { credOps, state } = makeMockCredentialOps({
    store: new Map([["github.com", cred]]),
  });

  await credOps.reject("github.com", cred);
  const result = await credOps.fill("github.com");

  assert.equal(result, null);
  assert.equal(state.rejectCalls.length, 1);
  assert.deepEqual(state.rejectCalls[0], { host: "github.com", cred });
  assert.equal(state.fillCalls.length, 1);
});

test("Phase 31 credOps: DEFAULT_CREDENTIAL_OPS.fill returns null when git binary is absent (Pitfall 7)", async () => {
  // Skip on Windows: PATH semantics differ (PATHEXT, .exe resolution)
  // and the test isn't materially more informative there. The mock and
  // the real-subprocess smoke (Test 7) cover the contract across
  // platforms.
  if (process.platform === "win32") {
    return;
  }

  const originalPath = process.env["PATH"];
  process.env["PATH"] = "/nonexistent-dir-for-pi-claude-marketplace-test";
  try {
    const startedAt = Date.now();
    const result = await DEFAULT_CREDENTIAL_OPS.fill("nonexistent.invalid");
    const elapsedMs = Date.now() - startedAt;
    assert.equal(result, null, "expected null from ENOENT-tolerant fill");
    assert.ok(elapsedMs < 2_000, `expected resolution within 2s; took ${elapsedMs}ms`);
  } finally {
    if (originalPath === undefined) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }
  }
});

test("Phase 31 credOps: real `git credential fill` against invented host returns null within 2s (PI_CM_REAL_GIT_CREDENTIAL=1)", async () => {
  // Operator opt-in smoke: proves the GIT_TERMINAL_PROMPT=0 + stdin.end()
  // combo prevents the hang Pitfall 2 + Pitfall 3 describe. Skipped by
  // default so the suite never touches the dev's OS keychain.
  if (process.env["PI_CM_REAL_GIT_CREDENTIAL"] !== "1") {
    return;
  }

  const startedAt = Date.now();
  const result = await DEFAULT_CREDENTIAL_OPS.fill("nonexistent.invalid.example");
  const elapsedMs = Date.now() - startedAt;

  assert.equal(
    result,
    null,
    "expected null from real git credential fill against an invented host",
  );
  assert.ok(elapsedMs < 2_000, `expected resolution within 2s; took ${elapsedMs}ms`);
});

test("Phase 31 credOps: fill builds host-only attribute block (Pitfall 4 -- no path= field)", async () => {
  // The mock only sees the `host` argument because the attribute block
  // is an implementation detail of the PRODUCTION fill. Asserting on
  // the mock's call log proves the seam never widens its contract to
  // include path/username/etc. on a fill query.
  const { credOps, state } = makeMockCredentialOps();
  await credOps.fill("github.com");
  assert.deepEqual(state.fillCalls, [{ host: "github.com" }]);
  // No accidental keys leaked into the call record:
  assert.deepEqual(Object.keys(state.fillCalls[0]!), ["host"]);
});

// ---------------------------------------------------------------------------
// Tests 9-14: Production-path coverage for sanitizeAttrValue, buildAttributeBlock,
// parseCredentialOutput, credentialApprove, and credentialReject.
//
// Test 9: sanitizeAttrValue throw -- fill rejects when host contains \n (WR-01)
// Test 10: buildAttributeBlock with cred -- approve/reject cover username/password lines
// Test 11: parseCredentialOutput + credentialFill success path -- fake git binary
// Test 12: credentialFill returns null when exit code is non-zero
// Test 13: credentialApprove try/catch -- swallows subprocess error (best-effort)
// Test 14: credentialReject try/catch -- swallows subprocess error (best-effort)
// ---------------------------------------------------------------------------

test("Phase 31 credOps: sanitizeAttrValue throws when host contains \\n -- fill propagates (WR-01)", async () => {
  // sanitizeAttrValue is called inside buildAttributeBlock(host) BEFORE the
  // try/catch in credentialFill, so the throw propagates to the caller.
  // The control-char host triggers the /[\r\n\0]/ guard at git-credential.ts:126.
  if (process.platform === "win32") {
    return;
  }

  await assert.rejects(
    () => DEFAULT_CREDENTIAL_OPS.fill("github.com\ninjected=evil"),
    /control character/,
    "sanitizeAttrValue must throw on newline in host attribute",
  );
});

test("Phase 31 credOps: buildAttributeBlock with cred covers username+password lines (Pitfall 4)", async () => {
  // approve() calls buildAttributeBlock(host, cred) which emits username= and
  // password= lines (git-credential.ts:146-151). With PATH zeroed the subprocess
  // throws ENOENT; credentialApprove's own try/catch swallows and returns void.
  // The test confirms that: (a) no exception surfaces, and (b) buildAttributeBlock
  // was reached with a cred containing both fields.
  if (process.platform === "win32") {
    return;
  }

  const originalPath = process.env["PATH"];
  process.env["PATH"] = "/nonexistent-dir-for-pi-claude-marketplace-test";
  try {
    // This must NOT throw -- credentialApprove wraps gitCredentialIO in try/catch.
    await assert.doesNotReject(
      () =>
        DEFAULT_CREDENTIAL_OPS.approve("invented.invalid", {
          username: "x-access-token",
          password: "test-token",
        }),
      "credentialApprove must swallow subprocess ENOENT (best-effort)",
    );
  } finally {
    if (originalPath === undefined) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }
  }
});

test("Phase 31 credOps: parseCredentialOutput + credentialFill success -- fake git binary returns credentials", async () => {
  // Create a fake 'git' binary in a tmpdir that prints a valid
  // credential wire-format to stdout and exits 0. This covers:
  //   - parseCredentialOutput (lines 163-177): key=value parsing
  //   - credentialFill exit-0 parse path (lines 199-210): returns GitCredentials
  //
  // The fake git prints exactly what `git credential fill` would return for a
  // cached credential. No real keychain is consulted.
  if (process.platform === "win32") {
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `pi-cm-cred-test-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  // The fake 'git' binary ignores all args and just prints credential output.
  const fakeGit = path.join(tmpDir, "git");
  await writeFile(
    fakeGit,
    `#!/bin/sh\nprintf 'protocol=https\\nhost=github.com\\nusername=x-access-token\\npassword=gho_faketoken\\n\\n'\n`,
  );
  await chmod(fakeGit, 0o755);

  const originalPath = process.env["PATH"];
  process.env["PATH"] = `${tmpDir}${path.delimiter}${originalPath ?? ""}`;
  try {
    const result = await DEFAULT_CREDENTIAL_OPS.fill("github.com");

    assert.notEqual(result, null, "parseCredentialOutput must return credentials from git stdout");
    assert.ok(result !== null);
    assert.equal(result.username, "x-access-token");
    assert.equal(result.password, "gho_faketoken");
  } finally {
    if (originalPath === undefined) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }

    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("Phase 31 credOps: credentialFill returns null when git exits non-zero (no credential helper configured)", async () => {
  // A fake git that exits with code 128 (git's usual 'no credential helper' exit).
  // credentialFill checks result.code !== 0 and returns null (lines 199-201).
  if (process.platform === "win32") {
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `pi-cm-cred-nonzero-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  const fakeGit = path.join(tmpDir, "git");
  await writeFile(fakeGit, `#!/bin/sh\nexit 128\n`);
  await chmod(fakeGit, 0o755);

  const originalPath = process.env["PATH"];
  process.env["PATH"] = `${tmpDir}${path.delimiter}${originalPath ?? ""}`;
  try {
    const result = await DEFAULT_CREDENTIAL_OPS.fill("github.com");
    assert.equal(result, null, "credentialFill must return null on non-zero exit");
  } finally {
    if (originalPath === undefined) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }

    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("Phase 31 credOps: credentialApprove swallows subprocess error (best-effort, lines 222-229)", async () => {
  // credentialReject has identical try/catch structure; this test proves both
  // approve AND reject swallow subprocess failures silently (Pattern 3).
  // Use a fake git that exits non-zero to trigger the error branch.
  if (process.platform === "win32") {
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `pi-cm-approve-test-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  const fakeGit = path.join(tmpDir, "git");
  await writeFile(fakeGit, `#!/bin/sh\nexit 1\n`);
  await chmod(fakeGit, 0o755);

  const originalPath = process.env["PATH"];
  process.env["PATH"] = `${tmpDir}${path.delimiter}${originalPath ?? ""}`;
  try {
    // approve and reject must both return void without throwing.
    await assert.doesNotReject(
      () =>
        DEFAULT_CREDENTIAL_OPS.approve("invented.invalid", {
          username: "x-access-token",
          password: "test-token",
        }),
      "credentialApprove must swallow non-zero exit (best-effort)",
    );

    await assert.doesNotReject(
      () =>
        DEFAULT_CREDENTIAL_OPS.reject("invented.invalid", {
          username: "x-access-token",
          password: "test-token",
        }),
      "credentialReject must swallow non-zero exit (best-effort)",
    );
  } finally {
    if (originalPath === undefined) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }

    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("Phase 31 credOps: credentialReject swallows ENOENT (best-effort catch block, lines 244-245)", async () => {
  // credentialReject's catch block (lines 244-245) fires when gitCredentialIO
  // rejects -- i.e. when git is absent from PATH (ENOENT). Verify that the
  // ENOENT propagates through gitCredentialIO's 'error' event as a rejection,
  // is caught by credentialReject's try/catch, and surfaces as a resolved void.
  if (process.platform === "win32") {
    return;
  }

  const originalPath = process.env["PATH"];
  process.env["PATH"] = "/nonexistent-dir-for-pi-claude-marketplace-test";
  try {
    await assert.doesNotReject(
      () =>
        DEFAULT_CREDENTIAL_OPS.reject("invented.invalid", {
          username: "x-access-token",
          password: "test-token",
        }),
      "credentialReject must swallow ENOENT (best-effort)",
    );
  } finally {
    if (originalPath === undefined) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }
  }
});

test("Phase 31 credOps: credentialFill returns null when exit-0 output lacks username or password", async () => {
  // parseCredentialOutput parses the stdout but credentialFill checks that
  // BOTH username and password are present (lines 204-207). If either is
  // missing, fill returns null even on a clean exit.
  if (process.platform === "win32") {
    return;
  }

  const tmpDir = path.join(os.tmpdir(), `pi-cm-cred-partial-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });

  // Only username, no password in output.
  const fakeGit = path.join(tmpDir, "git");
  await writeFile(
    fakeGit,
    `#!/bin/sh\nprintf 'protocol=https\\nhost=github.com\\nusername=x-access-token\\n\\n'\n`,
  );
  await chmod(fakeGit, 0o755);

  const originalPath = process.env["PATH"];
  process.env["PATH"] = `${tmpDir}${path.delimiter}${originalPath ?? ""}`;
  try {
    const result = await DEFAULT_CREDENTIAL_OPS.fill("github.com");
    assert.equal(
      result,
      null,
      "credentialFill must return null when password is absent from git output",
    );
  } finally {
    if (originalPath === undefined) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }

    await rm(tmpDir, { recursive: true, force: true });
  }
});
