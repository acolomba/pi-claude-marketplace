import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";

import { isDeviceFlowDisabled } from "../../extensions/pi-claude-marketplace/shared/device-flow.ts";

function assignDeviceFlowVariable(t: TestContext, value: string | undefined): void {
  const existed = Object.hasOwn(process.env, "PI_CLAUDE_MARKETPLACE_DEVICE_FLOW");
  const prior = process.env.PI_CLAUDE_MARKETPLACE_DEVICE_FLOW;
  t.after(() => {
    if (existed && prior !== undefined) {
      process.env.PI_CLAUDE_MARKETPLACE_DEVICE_FLOW = prior;
    } else {
      Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_DEVICE_FLOW");
    }
  });
  if (value === undefined) {
    Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_DEVICE_FLOW");
  } else {
    process.env.PI_CLAUDE_MARKETPLACE_DEVICE_FLOW = value;
  }
}

describe("isDeviceFlowDisabled", () => {
  for (const { label, value } of [
    { label: "unset", value: undefined },
    { label: "empty", value: "" },
    { label: "on", value: "on" },
    { label: "1", value: "1" },
    { label: "true", value: "true" },
    { label: "yes", value: "yes" },
    { label: "unrecognized", value: "disabled" },
  ]) {
    test(`returns false when PI_CLAUDE_MARKETPLACE_DEVICE_FLOW is ${label}`, (t) => {
      // arrange
      assignDeviceFlowVariable(t, value);

      // act
      const disabled = isDeviceFlowDisabled();

      // assert
      assert.strictEqual(disabled, false);
    });
  }

  for (const value of ["off", "OFF", "  off  ", "0", "false", "False", "no", "NO"]) {
    test(`returns true when PI_CLAUDE_MARKETPLACE_DEVICE_FLOW is ${JSON.stringify(value)}`, (t) => {
      // arrange
      assignDeviceFlowVariable(t, value);

      // act
      const disabled = isDeviceFlowDisabled();

      // assert
      assert.strictEqual(disabled, true);
    });
  }
});
