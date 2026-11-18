const DEVICE_FLOW_VARIABLE = "PI_CLAUDE_MARKETPLACE_DEVICE_FLOW";

const DEVICE_FLOW_DISABLED_VALUES: ReadonlySet<string> = new Set(["0", "false", "no", "off"]);

/**
 * Returns true when `PI_CLAUDE_MARKETPLACE_DEVICE_FLOW` turns interactive
 * OAuth Device Flow off. Reads the environment on every call and holds no
 * state.
 */
export function isDeviceFlowDisabled(): boolean {
  const value = process.env[DEVICE_FLOW_VARIABLE];
  return value !== undefined && DEVICE_FLOW_DISABLED_VALUES.has(value.trim().toLowerCase());
}
