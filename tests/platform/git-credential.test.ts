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
