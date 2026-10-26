import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createDeviceFlowContractParticipant,
  DEVICE_FLOW_CASE_NAMES,
  deviceFlowContractCases,
  registerDeviceFlowContract,
  type DeviceFlowContractFactory,
  type DeviceFlowContractScenario,
} from "./device-flow-contract.ts";
import {
  createDeviceFlowFake,
  type DeviceFlowFake,
  type DeviceFlowFakeOptions,
} from "./device-flow-fake.ts";

function fakeOptions(scenario: DeviceFlowContractScenario): DeviceFlowFakeOptions {
  return {
    boundary: "memory",
    network: "disabled",
    deviceCode: scenario.deviceCode,
    pollResponses: scenario.pollResponses,
    ...(scenario.requestCodeError === undefined
      ? {}
      : { requestCodeError: scenario.requestCodeError }),
  };
}

function createFakeParticipant(scenario: DeviceFlowContractScenario) {
  const deviceFlow = createDeviceFlowFake(fakeOptions(scenario));
  return createDeviceFlowContractParticipant({
    http: deviceFlow.http,
    contractScenario: scenario,
  });
}

function createNonConsumingDeviceFlowFake(options: DeviceFlowFakeOptions): DeviceFlowFake {
  const deviceFlow = createDeviceFlowFake(options);
  const pollResponse = structuredClone(
    options.pollResponses?.[0] ?? ({ kind: "pending" } as const),
  );

  return {
    ...deviceFlow,
    http: {
      requestCode: (clientId, scope) => deviceFlow.http.requestCode(clientId, scope),
      async pollToken(clientId, deviceCode, intervalSec) {
        deviceFlow.calls.pollToken.push({ clientId, deviceCode, intervalSec });
        if (options.pollTokenError !== undefined) {
          throw options.pollTokenError;
        }

        await Promise.resolve();
        return structuredClone(pollResponse);
      },
    },
  };
}

const createBrokenParticipant: DeviceFlowContractFactory = (scenario) => {
  const deviceFlow = createNonConsumingDeviceFlowFake(fakeOptions(scenario));
  return createDeviceFlowContractParticipant({
    http: deviceFlow.http,
    contractScenario: scenario,
  });
};

describe("createDeviceFlowFake", () => {
  registerDeviceFlowContract(createFakeParticipant);

  test("keeps the source-defined contract case order", () => {
    // arrange
    const expectedNames = [...DEVICE_FLOW_CASE_NAMES];

    // act
    const names = deviceFlowContractCases.map(({ name }) => name);

    // assert
    assert.deepStrictEqual(names, expectedNames);
  });

  test("requires the explicit memory boundary", () => {
    // act & assert
    assert.throws(
      () =>
        Reflect.apply(createDeviceFlowFake, undefined, [
          {
            network: "disabled",
            deviceCode: {
              device_code: "device-1",
              user_code: "CODE-1",
              verification_uri: "https://verify.example/device",
              expires_in: 900,
              interval: 0,
            },
          },
        ]),
      {
        name: "Error",
        message: "createDeviceFlowFake requires the explicit memory boundary",
      },
    );
  });

  test("requires the disabled network boundary", () => {
    // act & assert
    assert.throws(
      () =>
        Reflect.apply(createDeviceFlowFake, undefined, [
          {
            boundary: "memory",
            deviceCode: {
              device_code: "device-1",
              user_code: "CODE-1",
              verification_uri: "https://verify.example/device",
              expires_in: 900,
              interval: 0,
            },
          },
        ]),
      {
        name: "Error",
        message: "createDeviceFlowFake requires the disabled network boundary",
      },
    );
  });

  test("detects only the non-consuming polling-response defect", async () => {
    // arrange
    const expectedFailures = ["consumes polling responses in order"];
    const failures: string[] = [];

    // act
    for (const contractCase of deviceFlowContractCases) {
      try {
        await contractCase.run(createBrokenParticipant);
      } catch (error) {
        if (!(error instanceof assert.AssertionError)) {
          throw error;
        }

        failures.push(contractCase.name);
      }
    }

    // assert
    assert.deepStrictEqual(failures, expectedFailures);
  });
});
