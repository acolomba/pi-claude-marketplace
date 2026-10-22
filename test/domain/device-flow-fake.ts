import type {
  DeviceCodeResponse,
  DeviceFlowHttp,
  PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";

export interface DeviceFlowFakeOptions {
  readonly boundary: "memory";
  readonly network: "disabled";
  readonly deviceCode: DeviceCodeResponse;
  readonly pollResponses?: readonly PollResult[];
  readonly defaultPoll?: PollResult;
  readonly requestCodeError?: Error;
  readonly pollTokenError?: Error;
}

export interface DeviceFlowFakeCalls {
  readonly requestCode: Array<{ readonly clientId: string; readonly scope: string }>;
  readonly pollToken: Array<{
    readonly clientId: string;
    readonly deviceCode: string;
    readonly intervalSec: number;
  }>;
}

export interface DeviceFlowFake {
  readonly http: DeviceFlowHttp;
  readonly calls: DeviceFlowFakeCalls;
}

export function createDeviceFlowFake(options: DeviceFlowFakeOptions): DeviceFlowFake {
  if (options.boundary !== "memory") {
    throw new Error("createDeviceFlowFake requires the explicit memory boundary");
  }

  if (options.network !== "disabled") {
    throw new Error("createDeviceFlowFake requires the disabled network boundary");
  }

  const storedDeviceCode = structuredClone(options.deviceCode);
  const pollResponses = [...structuredClone(options.pollResponses ?? [])];
  const defaultPoll = structuredClone(options.defaultPoll ?? ({ kind: "pending" } as const));
  const calls: DeviceFlowFakeCalls = {
    requestCode: [],
    pollToken: [],
  };

  const http: DeviceFlowHttp = {
    async requestCode(clientId, scope) {
      calls.requestCode.push({ clientId, scope });
      if (options.requestCodeError !== undefined) {
        throw options.requestCodeError;
      }

      await Promise.resolve();
      return structuredClone(storedDeviceCode);
    },
    async pollToken(clientId, deviceCode, intervalSec) {
      calls.pollToken.push({ clientId, deviceCode, intervalSec });
      if (options.pollTokenError !== undefined) {
        throw options.pollTokenError;
      }

      await Promise.resolve();
      return structuredClone(pollResponses.shift() ?? defaultPoll);
    },
  };

  return { http, calls };
}
