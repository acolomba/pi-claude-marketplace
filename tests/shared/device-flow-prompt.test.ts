// tests/shared/device-flow-prompt.test.ts
//
// Byte-form lock for the AUTH-03 Device Flow user-code prompt.
//
// The prompt is the out-of-band ctx.ui.notify call emitted by
// initiateDeviceFlow (domain/github-auth.ts) after a successful
// POST /login/device/code and before the poll loop starts. The catalog
// documents the byte form at `docs/output-catalog.md`'s
// `## Out-of-band notifications` -> `### Device Flow user-code prompt`
// (catalog-state: device-flow-prompt). This test drives
// initiateDeviceFlow with a fully-controlled mock http + mock
// credentialOps + a recording notifyFn, then asserts the EXACT prompt
// string + severity match the catalog byte form. Any change to the
// emission string in github-auth.ts requires a lockstep update of
// BOTH the catalog AND this test (mirrors the
// tests/shared/snm38-indent-ladder.test.ts contract).
//
// AUTH-03: the user is shown user_code + verification_uri.
// AUTH-09: access_token is NOT in scope when this notify fires; the
// expected string contains NO credential field.
//
// The test parallels tests/domain/github-auth.test.ts's existing
// AUTH-03 test ("AUTH-03 notify content includes user_code AND
// verification_uri" -- substring assertion) but tightens substring
// checks to full byte-form equality against the catalog.

import assert from "node:assert/strict";
import test from "node:test";

import { initiateDeviceFlow } from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";
import { makeMockCredentialOps } from "../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../helpers/device-flow-mock.ts";

interface NotifyCall {
  readonly message: string;
  readonly severity?: "info" | "warning" | "error";
}

function makeNotifyRecorder(): {
  notifyFn: (message: string, severity?: "info" | "warning" | "error") => void;
  calls: NotifyCall[];
} {
  const calls: NotifyCall[] = [];
  const notifyFn = (message: string, severity?: "info" | "warning" | "error"): void => {
    calls.push(severity === undefined ? { message } : { message, severity });
  };

  return { notifyFn, calls };
}

test("AUTH-03: Device Flow prompt byte form matches docs/output-catalog.md exactly", async () => {
  // Mock values match the catalog example at
  // docs/output-catalog.md -> ## Out-of-band notifications ->
  // ### Device Flow user-code prompt (catalog-state: device-flow-prompt).
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [
      { kind: "success", accessToken: "gho_test_lock", tokenType: "bearer", scope: "repo" },
    ],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn, calls } = makeNotifyRecorder();

  await initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http });

  // The notify recorder must have exactly one call (the prompt). The
  // happy path does NOT emit a second notification on success; the
  // approve() persistence is silent.
  assert.equal(calls.length, 1, "exactly one notifyFn call expected from initiateDeviceFlow");

  const promptCall = calls[0];
  assert.ok(promptCall !== undefined);

  // BYTE-FORM LOCK: the message MUST match the catalog example exactly.
  // Any change here requires a lockstep edit of:
  //   docs/output-catalog.md -> ## Out-of-band notifications ->
  //     ### Device Flow user-code prompt (catalog-state: device-flow-prompt)
  //   extensions/pi-claude-marketplace/domain/github-auth.ts
  assert.equal(
    promptCall.message,
    "Open https://github.com/login/device and enter: ABCD-1234",
    "AUTH-03 byte-form lock: prompt must match the catalog byte-for-byte",
  );

  // SEVERITY LOCK: the severity arg MUST be "info" per the catalog
  // and the emission site (github-auth.ts).
  assert.equal(promptCall.severity, "info", 'AUTH-03 severity lock: severity must be "info"');
});

test("AUTH-03: Device Flow prompt is emitted BEFORE the poll loop (token not yet acquired -- AUTH-09)", async () => {
  // Drive a poll sequence that fails immediately (access_denied) so the
  // poll loop terminates on the first iteration. The prompt MUST still
  // fire before the failure -- it is emitted on the device-code response,
  // not on poll success. This proves AUTH-09: even when the access token
  // is never acquired, the prompt fires correctly.
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "WXYZ-5678",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 0,
    },
    pollQueue: [{ kind: "access_denied" }],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn, calls } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({
    host: "github.com",
    credentialOps: credOps,
    notifyFn,
    http,
  });

  // The Device Flow failed (access_denied), but the prompt fired exactly
  // once -- proving AUTH-03 holds independently of poll success.
  assert.equal(result.ok, false);
  assert.equal(calls.length, 1);

  const promptCall = calls[0];
  assert.ok(promptCall !== undefined);

  // Same byte form, different user_code -- proves the emission shape is
  // a template, not a hard-coded string.
  assert.equal(promptCall.message, "Open https://github.com/login/device and enter: WXYZ-5678");
  assert.equal(promptCall.severity, "info");

  // AUTH-09: the failure message MUST NOT contain the access_token (the
  // token was never acquired since poll returned access_denied; this is
  // a regression guard against a future bug where the prompt is moved
  // post-poll). The catalog promises the prompt is pre-poll.
  assert.ok(
    !promptCall.message.includes("access_token"),
    "AUTH-09: prompt must not interpolate access_token (token is never in scope at prompt time)",
  );
});
