/**
 * In-memory DeviceFlowHttp stub for tests.
 *
 * Sibling of tests/helpers/credential-mock.ts and tests/helpers/git-mock.ts;
 * mirrors the makeMockCredentialOps shape: closure-scoped state, per-method
 * call logs, optional throws overrides, programmable response queue. The mock
 * is pure in-memory: no filesystem ops, no environment mutation, no subprocess
 * spawn, no real HTTP -- the DeviceFlowHttp mock NEVER reaches github.com.
 *
 * initiateDeviceFlow tests inject this mock the same way credential tests
 * inject makeMockCredentialOps. The mock does NOT internally sleep: the
 * caller controls timing via deviceCode.interval, and tests use
 * `interval: 0` to spin the poll loop synchronously without mocking timers.
 *
 * Type-only import for DeviceFlowHttp / DeviceCodeResponse / PollResult so
 * the helper file does NOT runtime-couple to the production module. The
 * mirrored discipline in credential-mock.ts is the precedent.
 */

import type {
  DeviceCodeResponse,
  DeviceFlowHttp,
  PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";

export interface MockDeviceFlowState {
  /** Canned device code response returned by requestCode. */
  deviceCode: DeviceCodeResponse;
  /**
   * Queue of PollResult values consumed head-first by each pollToken call.
   * When empty, pollToken returns `defaultPoll`.
   */
  pollQueue: PollResult[];
  /** Fallback response when pollQueue is empty (default: { kind: "pending" }). */
  defaultPoll: PollResult;
  /** Per-method call logs for assertion. */
  requestCodeCalls: { clientId: string; scope: string }[];
  pollTokenCalls: { clientId: string; deviceCode: string; intervalSec: number }[];
  /**
   * Optional override hooks. When set, the corresponding method throws the
   * supplied error instead of touching the queue/log -- tests use this to
   * simulate network errors (DNS failure, TLS error) so callers can exercise
   * their own try/catch around the seam.
   */
  requestCodeThrows?: Error;
  pollTokenThrows?: Error;
}

export interface MockDeviceFlowHttpHandle {
  readonly http: DeviceFlowHttp;
  readonly state: MockDeviceFlowState;
}

/**
 * Build a fresh mock DeviceFlowHttp + bookkeeping state. Tests pass `state`
 * to assertions and pre-load `pollQueue` to drive the state machine through
 * a deterministic sequence of poll responses (pending / slow_down / success
 * / access_denied / expired_token / unexpected).
 *
 * The optional throws fields use the conditional-spread pattern to satisfy
 * exactOptionalPropertyTypes (mirrors the credential-mock.ts idiom:
 * `...(initial?.X !== undefined && { X: initial.X })`).
 */
export function makeMockDeviceFlowHttp(
  initial?: Partial<MockDeviceFlowState>,
): MockDeviceFlowHttpHandle {
  const state: MockDeviceFlowState = {
    deviceCode: initial?.deviceCode ?? {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      // interval:0 by default so a test that drives the poll loop without an
      // explicit deviceCode spins it synchronously instead of firing a real
      // ref'd sleepMs (which would block the worker for seconds of wall-clock
      // time). Tests that need a non-zero interval (e.g. slow_down back-off)
      // override deviceCode explicitly.
      interval: 0,
    },
    pollQueue: [...(initial?.pollQueue ?? [])],
    defaultPoll: initial?.defaultPoll ?? { kind: "pending" },
    requestCodeCalls: [],
    pollTokenCalls: [],
    ...(initial?.requestCodeThrows !== undefined && {
      requestCodeThrows: initial.requestCodeThrows,
    }),
    ...(initial?.pollTokenThrows !== undefined && { pollTokenThrows: initial.pollTokenThrows }),
  };

  const http: DeviceFlowHttp = {
    async requestCode(clientId: string, scope: string): Promise<DeviceCodeResponse> {
      state.requestCodeCalls.push({ clientId, scope });
      if (state.requestCodeThrows !== undefined) {
        throw state.requestCodeThrows;
      }

      await Promise.resolve();
      return state.deviceCode;
    },

    async pollToken(
      clientId: string,
      deviceCode: string,
      intervalSec: number,
    ): Promise<PollResult> {
      state.pollTokenCalls.push({ clientId, deviceCode, intervalSec });
      if (state.pollTokenThrows !== undefined) {
        throw state.pollTokenThrows;
      }

      await Promise.resolve();
      return state.pollQueue.shift() ?? state.defaultPoll;
    },
  };

  return { http, state };
}
