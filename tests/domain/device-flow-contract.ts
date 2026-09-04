import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import {
  initiateDeviceFlow,
  type DeviceCodeResponse,
  type DeviceFlowHttp,
  type DeviceFlowResult,
  type PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";

import type { GitAuthProvider } from "../../extensions/pi-claude-marketplace/domain/auth-registry.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";

export interface DeviceFlowContractScenario {
  readonly deviceCode: DeviceCodeResponse;
  readonly pollResponses: readonly PollResult[];
  readonly requestCodeError?: Error;
  readonly pollLimit?: number;
}

export interface DeviceFlowContractObservation {
  readonly deviceFlow: DeviceFlowResult;
  readonly notifications: ReadonlyArray<{
    readonly message: string;
    readonly severity?: "info" | "warning" | "error";
  }>;
  readonly approvedCredentials: ReadonlyArray<{
    readonly host: string;
    readonly credential: GitCredentials;
  }>;
  readonly waits: readonly number[];
}

export interface DeviceFlowContractParticipant {
  run(): Promise<DeviceFlowContractObservation>;
}

export type DeviceFlowContractFactory = (
  scenario: DeviceFlowContractScenario,
) => DeviceFlowContractParticipant | Promise<DeviceFlowContractParticipant>;

interface DeviceFlowContractCase {
  readonly name: string;
  readonly run: (createDeviceFlow: DeviceFlowContractFactory) => Promise<void>;
}

export const DEVICE_FLOW_CASE_NAMES = [
  "returns the complete successful device flow",
  "reports a request-code failure",
  "reports denied authorization",
  "reports an expired device code",
  "includes an unexpected polling description",
  "reports an unexpected poll without a description",
  "consumes polling responses in order",
  "copies the device-code response before use",
  "copies polling responses before use",
  "resets queued state between fresh participants",
] as const;

// Input validation is inapplicable because initiateDeviceFlow accepts a statically typed options
// object and defines no runtime validation contract. The production owner covers remote-payload
// validation, HTTP mechanics, cancellation, and thrown poll transport failures per D-09.

const provider = {
  id: "contract",
  hostMatch: (host) => host === "auth.example",
  deviceCodeUrl: "https://auth.example/device",
  tokenUrl: "https://auth.example/token",
  clientId: "client-1",
  scope: "read_repository",
  credentialFrom: (accessToken) => ({ username: "oauth2", password: accessToken }),
} satisfies GitAuthProvider;

function deviceCode(overrides: Partial<DeviceCodeResponse> = {}): DeviceCodeResponse {
  return {
    device_code: "device-1",
    user_code: "CODE-1",
    verification_uri: "https://verify.example/device",
    expires_in: 900,
    interval: 0,
    ...overrides,
  };
}

function scenario(
  pollResponses: readonly PollResult[],
  overrides: Partial<DeviceFlowContractScenario> = {},
): DeviceFlowContractScenario {
  return {
    deviceCode: deviceCode(),
    pollResponses,
    ...overrides,
  };
}

export function createDeviceFlowContractParticipant({
  http,
  contractScenario,
}: {
  readonly http?: DeviceFlowHttp;
  readonly contractScenario: DeviceFlowContractScenario;
}): DeviceFlowContractParticipant {
  return {
    async run() {
      const notifications: Array<{
        message: string;
        severity?: "info" | "warning" | "error";
      }> = [];
      const approvedCredentials: Array<{ host: string; credential: GitCredentials }> = [];
      const waits: number[] = [];
      const credentialOps = {
        fill: () => Promise.reject(new Error("Unexpected credential fill")),
        approve: async (host: string, credential: GitCredentials): Promise<void> => {
          await Promise.resolve();
          approvedCredentials.push({ host, credential: structuredClone(credential) });
        },
        reject: () => Promise.reject(new Error("Unexpected credential rejection")),
      };

      const deviceFlow = await initiateDeviceFlow({
        host: "auth.example",
        credentialOps,
        notifyFn: (message, severity) => {
          notifications.push(severity === undefined ? { message } : { message, severity });
        },
        ...(http === undefined ? {} : { http }),
        provider,
        waitForPoll: (milliseconds) => {
          waits.push(milliseconds);
          if (
            contractScenario.pollLimit !== undefined &&
            waits.length > contractScenario.pollLimit
          ) {
            return Promise.reject(new Error("Polling limit reached"));
          }

          return Promise.resolve();
        },
      });

      return {
        deviceFlow,
        notifications,
        approvedCredentials,
        waits,
      };
    },
  };
}

const contractCases: readonly DeviceFlowContractCase[] = [
  {
    name: "returns the complete successful device flow",
    run: async (createDeviceFlow) => {
      // arrange
      const participant = await createDeviceFlow(
        scenario([
          {
            kind: "success",
            accessToken: "token-1",
            tokenType: "bearer",
            scope: "read_repository",
          },
        ]),
      );

      // act
      const observation = await participant.run();

      // assert
      assert.deepStrictEqual(observation, {
        deviceFlow: {
          ok: true,
          cred: { username: "oauth2", password: "token-1" },
          authAttempted: true,
        },
        notifications: [
          {
            message: "Open https://verify.example/device and enter: CODE-1",
            severity: "info",
          },
        ],
        approvedCredentials: [
          {
            host: "auth.example",
            credential: { username: "oauth2", password: "token-1" },
          },
        ],
        waits: [0],
      });
    },
  },
  {
    name: "reports a request-code failure",
    run: async (createDeviceFlow) => {
      // arrange
      const participant = await createDeviceFlow(
        scenario([], { requestCodeError: new Error("request offline") }),
      );

      // act
      const observation = await participant.run();

      // assert
      assert.deepStrictEqual(observation, {
        deviceFlow: {
          ok: false,
          reason: "Device Flow initialization failed: request offline",
          authAttempted: true,
        },
        notifications: [],
        approvedCredentials: [],
        waits: [],
      });
    },
  },
  ...[
    {
      name: "reports denied authorization",
      pollResponse: { kind: "access_denied" } as const,
      expectedReason: "User cancelled authorization. Run the command again to retry.",
    },
    {
      name: "reports an expired device code",
      pollResponse: { kind: "expired_token" } as const,
      expectedReason: "Device code expired before authorization. Run the command again to restart.",
    },
    {
      name: "includes an unexpected polling description",
      pollResponse: {
        kind: "unexpected",
        error: "unknown_grant",
        description: "not supported",
      } as const,
      expectedReason: "Device Flow failed: unknown_grant -- not supported",
    },
    {
      name: "reports an unexpected poll without a description",
      pollResponse: { kind: "unexpected", error: "unknown_grant" } as const,
      expectedReason: "Device Flow failed: unknown_grant",
    },
  ].map(({ name, pollResponse, expectedReason }) => ({
    name,
    run: async (createDeviceFlow: DeviceFlowContractFactory) => {
      // arrange
      const participant = await createDeviceFlow(scenario([pollResponse]));

      // act
      const observation = await participant.run();

      // assert
      assert.deepStrictEqual(observation.deviceFlow, {
        ok: false,
        reason: expectedReason,
        authAttempted: true,
      });
      assert.deepStrictEqual(observation.notifications, [
        {
          message: "Open https://verify.example/device and enter: CODE-1",
          severity: "info",
        },
      ]);
      assert.deepStrictEqual(observation.approvedCredentials, []);
      assert.deepStrictEqual(observation.waits, [0]);
    },
  })),
  {
    name: "consumes polling responses in order",
    run: async (createDeviceFlow) => {
      // arrange
      const participant = await createDeviceFlow(
        scenario(
          [
            { kind: "pending" },
            { kind: "slow_down" },
            {
              kind: "success",
              accessToken: "token-1",
              tokenType: "bearer",
              scope: "read_repository",
            },
          ],
          { pollLimit: 3 },
        ),
      );

      // act
      const observation = await participant.run();

      // assert
      assert.deepStrictEqual(observation.deviceFlow, {
        ok: true,
        cred: { username: "oauth2", password: "token-1" },
        authAttempted: true,
      });
      assert.deepStrictEqual(observation.waits, [0, 0, 5_000]);
    },
  },
  {
    name: "copies the device-code response before use",
    run: async (createDeviceFlow) => {
      // arrange
      const mutableDeviceCode = deviceCode();
      const participant = await createDeviceFlow(
        scenario(
          [
            {
              kind: "success",
              accessToken: "token-1",
              tokenType: "bearer",
              scope: "read_repository",
            },
          ],
          { deviceCode: mutableDeviceCode },
        ),
      );

      // act
      mutableDeviceCode.user_code = "MUTATED";
      mutableDeviceCode.verification_uri = "https://mutated.example/device";
      const observation = await participant.run();

      // assert
      assert.deepStrictEqual(observation.notifications, [
        {
          message: "Open https://verify.example/device and enter: CODE-1",
          severity: "info",
        },
      ]);
    },
  },
  {
    name: "copies polling responses before use",
    run: async (createDeviceFlow) => {
      // arrange
      const mutablePollResponse: PollResult = {
        kind: "success",
        accessToken: "token-1",
        tokenType: "bearer",
        scope: "read_repository",
      };
      const participant = await createDeviceFlow(scenario([mutablePollResponse]));

      // act
      mutablePollResponse.accessToken = "mutated-token";
      const observation = await participant.run();

      // assert
      assert.deepStrictEqual(observation.deviceFlow, {
        ok: true,
        cred: { username: "oauth2", password: "token-1" },
        authAttempted: true,
      });
    },
  },
  {
    name: "resets queued state between fresh participants",
    run: async (createDeviceFlow) => {
      // arrange
      const contractScenario = scenario([
        {
          kind: "success",
          accessToken: "token-1",
          tokenType: "bearer",
          scope: "read_repository",
        },
      ]);
      const firstParticipant = await createDeviceFlow(contractScenario);

      // act
      const firstObservation = await firstParticipant.run();
      const secondParticipant = await createDeviceFlow(contractScenario);
      const secondObservation = await secondParticipant.run();

      // assert
      assert.deepStrictEqual(firstObservation.deviceFlow, {
        ok: true,
        cred: { username: "oauth2", password: "token-1" },
        authAttempted: true,
      });
      assert.deepStrictEqual(secondObservation.deviceFlow, firstObservation.deviceFlow);
      assert.deepStrictEqual(firstObservation.waits, [0]);
      assert.deepStrictEqual(secondObservation.waits, [0]);
    },
  },
] satisfies readonly DeviceFlowContractCase[];

export const deviceFlowContractCases = contractCases;

export function registerDeviceFlowContract(
  createDeviceFlow: (
    scenario: DeviceFlowContractScenario,
    context: TestContext,
  ) => DeviceFlowContractParticipant | Promise<DeviceFlowContractParticipant>,
): void {
  for (const contractCase of deviceFlowContractCases) {
    test(contractCase.name, async (context) => {
      // arrange
      const createParticipant: DeviceFlowContractFactory = (scenario) =>
        createDeviceFlow(scenario, context);

      // act
      const completed = contractCase.run(createParticipant);

      // assert
      await completed;
    });
  }
}
