/**
 * Phase 32: GitHub OAuth Device Flow state machine.
 *
 * Ships `initiateDeviceFlow` -- the v1.6 authentication engine. Phase 33+
 * wraps this in isomorphic-git's `onAuth` / `onAuthFailure` closures via
 * `buildAuthCallbacks`; Phase 34 threads `onAuthRequired` through `GitOps`;
 * Phase 35 wires the orchestrator call sites. Phase 32 alone has zero
 * production call sites -- the file is exercised only by its unit tests
 * (tests/domain/github-auth.test.ts) until Phase 33 imports it.
 *
 * Locked decisions (32-CONTEXT.md):
 *   - D-32-01: file lives in domain/ (auth policy is domain-tier).
 *   - D-32-02: injectable DeviceFlowHttp seam (DEFAULT_DEVICE_FLOW_HTTP uses
 *     globalThis.fetch; tests inject makeMockDeviceFlowHttp).
 *   - D-32-03: GITHUB_OAUTH_CLIENT_ID is a PUBLIC compile-time constant
 *     (Device Flow has no client_secret; client_id is safe to commit per
 *     RFC 8628 §3.1 and GitHub OAuth Apps docs).
 *   - D-32-04: notifyFn callback (no `ctx` import; preserves shared/notify.ts
 *     chokepoint at the boundary).
 *   - D-32-05: every DeviceFlowResult -- success OR failure -- carries
 *     `authAttempted: true` so Phase 33's onAuthFailure can detect a second
 *     consecutive auth failure and return { cancel: true } instead of
 *     re-triggering Device Flow infinitely (AUTH-07; CP-9 retry-loop guard).
 *   - D-32-06: AUTH-09 discipline -- user_code and verification_uri MAY
 *     appear in notifyFn; access_token / cred.* / r.accessToken MUST NEVER
 *     appear in notifyFn or new Error(...) interpolation. Enforced by
 *     tests/architecture/no-credential-leak.test.ts.
 *
 * OPERATOR ACTION REQUIRED (P32-7): the GITHUB_OAUTH_CLIENT_ID below is
 * currently a placeholder. Before the first production smoke test, register
 * the pi-claude-marketplace OAuth App at github.com -> Settings -> Developer
 * settings -> OAuth Apps -> New OAuth App (with Device Flow enabled) and
 * substitute the placeholder with the real client_id. The mock-HTTP unit
 * tests do NOT depend on the real client_id value.
 *
 * Scope: hard-coded to `repo` for v1.6 (P32-8 -- full control of private
 * repositories; covers AUTH-01's "private GitHub marketplace" requirement).
 *
 * AUTH-09 discipline (mechanical lock): the
 * tests/architecture/no-credential-leak.test.ts gate scans THIS file for
 * `new Error(...)` and `notifyFn(...)` calls that interpolate access_token /
 * accessToken / cred.<field> / r.accessToken. The gate is active once this
 * file exists on disk.
 */

import { setTimeout as sleepMs } from "node:timers/promises";

import type { CredentialOps } from "../platform/git-credential.ts";
import type { GitCredentials } from "../platform/git.ts";

/**
 * Shape returned by GitHub's `/login/device/code` endpoint. Field-presence
 * is validated defensively by `requestCodeImpl`; the type cast at the
 * fetch boundary is acceptable because the validator throws on missing
 * fields BEFORE the data reaches the state machine.
 */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  /** Seconds until the device_code expires (GitHub default: 900). */
  expires_in: number;
  /** Initial poll interval in seconds (GitHub default: 5). */
  interval: number;
}

/**
 * Discriminated union over the poll-endpoint response shapes. The `success`
 * branch carries the access_token; the four error branches map to terminal
 * outcomes; `unexpected` is the forward-compat tail for future GitHub error
 * codes that have not been promoted to a dedicated branch.
 */
export type PollResult =
  | { kind: "success"; accessToken: string; tokenType: string; scope: string }
  | { kind: "pending" }
  | { kind: "slow_down" }
  | { kind: "access_denied" }
  | { kind: "expired_token" }
  | { kind: "unexpected"; error: string; description?: string };

/**
 * Injectable HTTP seam. The default impl (DEFAULT_DEVICE_FLOW_HTTP) calls
 * `globalThis.fetch` against github.com; tests inject makeMockDeviceFlowHttp
 * from tests/helpers/device-flow-mock.ts so the unit suite never hits the
 * network.
 */
export interface DeviceFlowHttp {
  /**
   * POST https://github.com/login/device/code with form-urlencoded body
   *   client_id=<clientId>&scope=<scope>
   * Accept: application/json header REQUIRED. Throws on HTTP 4xx/5xx
   * or network error; the caller's try/catch routes the throw to an
   * { ok: false, reason: <init failure string> } DeviceFlowResult.
   */
  requestCode(clientId: string, scope: string): Promise<DeviceCodeResponse>;

  /**
   * POST https://github.com/login/oauth/access_token with form-urlencoded
   * body
   *   client_id=<clientId>&device_code=<deviceCode>&grant_type=urn:ietf:params:oauth:grant-type:device_code
   * Accept: application/json header REQUIRED. `intervalSec` is informational
   * (the caller already enforces it on the local clock; GitHub's slow_down
   * response is the authoritative back-off signal).
   * GitHub returns HTTP 200 even for error codes; body is source of truth.
   */
  pollToken(clientId: string, deviceCode: string, intervalSec: number): Promise<PollResult>;
}

/**
 * Pre-bound notify callback (D-32-04). Phase 35 binds at the orchestrator
 * call site (e.g. `ctx.ui.notify.bind(ctx)` or via shared/notify.ts).
 * Returns `void` -- fire-and-forget per P32-5; do NOT await.
 */
export type NotifyFn = (message: string, severity?: "info" | "warning" | "error") => void;

export interface InitiateDeviceFlowOpts {
  /** Bare hostname for credentialOps.approve key (e.g. "github.com"). */
  host: string;
  /** Phase 31 CredentialOps instance (default or mock). */
  credentialOps: CredentialOps;
  /** Pre-bound ctx.ui.notify callback per D-32-04. */
  notifyFn: NotifyFn;
  /** Defaults to DEFAULT_DEVICE_FLOW_HTTP; tests inject a mock. */
  http?: DeviceFlowHttp;
  /** Optional abort signal. Future-proofing; Phase 33 ignores for now. */
  signal?: AbortSignal;
}

/**
 * Discriminated result. Both branches carry `authAttempted: true` so Phase
 * 33's onAuthFailure closure can guard against the isomorphic-git retry
 * loop (CP-9) by inspecting a single field across success + failure.
 */
export type DeviceFlowResult =
  | { ok: true; cred: GitCredentials; authAttempted: true }
  | { ok: false; reason: string; authAttempted: true };

const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

/**
 * D-32-03: PUBLIC OAuth App client_id. Currently a placeholder (Plan 32-01
 * operator chose 'placeholder ok'); the operator substitutes the real
 * client_id before the first production smoke test. Unit tests pass the
 * constant through to mocks; they do not validate its value.
 */
const GITHUB_OAUTH_CLIENT_ID = "Ov23liNcyK08uGdU0mMl";

/** P32-8: full control of private repositories. */
const REQUESTED_SCOPE = "repo";

async function requestCodeImpl(clientId: string, scope: string): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({ client_id: clientId, scope }).toString();
  const res = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    // AUTH-09: ONLY the status code is interpolated, never the response
    // body (defense in depth -- the body shouldn't contain credentials at
    // this point but the discipline is uniform across the file).
    throw new Error(`Device code request failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as DeviceCodeResponse;
  if (
    typeof data.device_code !== "string" ||
    typeof data.user_code !== "string" ||
    typeof data.verification_uri !== "string" ||
    typeof data.expires_in !== "number" ||
    typeof data.interval !== "number"
  ) {
    throw new TypeError("Device code response missing required fields");
  }

  return data;
}

async function pollTokenImpl(
  clientId: string,
  deviceCode: string,
  _intervalSec: number,
): Promise<PollResult> {
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  }).toString();

  let res: Response;
  try {
    res = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (err) {
    // Network error (DNS, TLS, connection refused). Treat as terminal
    // unexpected; the description carries the error string (NO token in
    // this branch -- the request never reached the server).
    return { kind: "unexpected", error: "network_error", description: String(err) };
  }

  // P32-4: GitHub returns HTTP 200 for poll-error codes; the body's
  // `error` field is the source of truth.
  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return { kind: "unexpected", error: "invalid_json", description: `HTTP ${res.status}` };
  }

  // Destructure named fields (Phase 31 SUMMARY deviation: prefer
  // destructuring over bracket access on parsed objects).
  const {
    access_token: accessTokenRaw,
    token_type: tokenTypeRaw,
    scope: scopeRaw,
    error: errorRaw,
    error_description: errorDescRaw,
  } = data;

  if (typeof accessTokenRaw === "string") {
    return {
      kind: "success",
      accessToken: accessTokenRaw,
      tokenType: typeof tokenTypeRaw === "string" ? tokenTypeRaw : "bearer",
      scope: typeof scopeRaw === "string" ? scopeRaw : "",
    };
  }

  const errorCode = typeof errorRaw === "string" ? errorRaw : "unexpected";
  const description = typeof errorDescRaw === "string" ? errorDescRaw : undefined;
  switch (errorCode) {
    case "authorization_pending":
      return { kind: "pending" };
    case "slow_down":
      return { kind: "slow_down" };
    case "access_denied":
      return { kind: "access_denied" };
    case "expired_token":
      return { kind: "expired_token" };
    default:
      return {
        kind: "unexpected",
        error: errorCode,
        ...(description !== undefined && { description }),
      };
  }
}

export const DEFAULT_DEVICE_FLOW_HTTP: DeviceFlowHttp = {
  requestCode: requestCodeImpl,
  pollToken: pollTokenImpl,
};

/**
 * Run the GitHub Device Flow against the injected DeviceFlowHttp and persist
 * the resulting credential best-effort via the injected CredentialOps.
 *
 * Returns a discriminated DeviceFlowResult:
 *   - { ok: true, cred, authAttempted: true } -- token successfully obtained
 *     AND credentialOps.approve(host, cred) invoked (its failure -- if any
 *     -- propagates; the Phase 31 default impl swallows internally per its
 *     best-effort contract).
 *   - { ok: false, reason, authAttempted: true } -- terminal failure
 *     (access_denied / expired_token / deadline exceeded / init failure /
 *     unexpected error / caller aborted).
 *
 * D-32-05: authAttempted is true in BOTH branches so Phase 33's
 * onAuthFailure can guard the retry loop.
 */
async function safePollToken(
  http: DeviceFlowHttp,
  deviceCode: string,
  intervalSec: number,
): Promise<PollResult | { kind: "poll_error"; reason: string }> {
  try {
    return await http.pollToken(GITHUB_OAUTH_CLIENT_ID, deviceCode, intervalSec);
  } catch (err) {
    return {
      kind: "poll_error",
      reason: `Device Flow poll failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

async function runPollLoop(
  http: DeviceFlowHttp,
  deviceCode: DeviceCodeResponse,
  opts: InitiateDeviceFlowOpts,
): Promise<DeviceFlowResult> {
  let currentIntervalSec = deviceCode.interval;
  const deadlineMs = Date.now() + deviceCode.expires_in * 1000;

  while (Date.now() < deadlineMs) {
    try {
      await sleepMs(
        currentIntervalSec * 1000,
        undefined,
        opts.signal === undefined ? undefined : { signal: opts.signal },
      );
    } catch {
      return { ok: false, reason: "Device Flow cancelled.", authAttempted: true };
    }

    const r = await safePollToken(http, deviceCode.device_code, currentIntervalSec);

    switch (r.kind) {
      case "success": {
        const cred: GitCredentials = { username: "x-access-token", password: r.accessToken };
        await opts.credentialOps.approve(opts.host, cred);
        return { ok: true, cred, authAttempted: true };
      }

      case "pending":
        // CP-2: do NOT mutate currentIntervalSec on pending.
        continue;
      case "slow_down":
        // CP-1: CUMULATIVE +5 per slow_down occurrence.
        currentIntervalSec += 5;
        continue;
      case "access_denied":
        return {
          ok: false,
          reason: "User cancelled authorization. Run the command again to retry.",
          authAttempted: true,
        };
      case "expired_token":
        return {
          ok: false,
          reason: "Device code expired before authorization. Run the command again to restart.",
          authAttempted: true,
        };
      case "poll_error":
        return { ok: false, reason: r.reason, authAttempted: true };
      case "unexpected": {
        const detail = r.description === undefined ? "" : ` -- ${r.description}`;
        return {
          ok: false,
          reason: `Device Flow failed: ${r.error}${detail}`,
          authAttempted: true,
        };
      }
    }
  }

  return {
    ok: false,
    reason:
      "Device Flow timed out before authorization completed. Run the command again to restart.",
    authAttempted: true,
  };
}

export async function initiateDeviceFlow(opts: InitiateDeviceFlowOpts): Promise<DeviceFlowResult> {
  const http = opts.http ?? DEFAULT_DEVICE_FLOW_HTTP;

  let deviceCode: DeviceCodeResponse;
  try {
    deviceCode = await http.requestCode(GITHUB_OAUTH_CLIENT_ID, REQUESTED_SCOPE);
  } catch (err) {
    return {
      ok: false,
      reason: `Device Flow initialization failed: ${err instanceof Error ? err.message : "unknown error"}`,
      authAttempted: true,
    };
  }

  // AUTH-03 + AUTH-09: ONLY user_code + verification_uri interpolated.
  // Token is not yet acquired; never appears here.
  opts.notifyFn(`Open ${deviceCode.verification_uri} and enter: ${deviceCode.user_code}`, "info");

  return runPollLoop(http, deviceCode, opts);
}
