import {
  type PluginAvailableMessage,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyAvailableMessage,
  type PluginPartiallyInstalledMessage,
  type PluginPartiallyUpgradableMessage,
  type PluginRemoteMessage,
  type PluginUnavailableMessage,
  type PluginUpgradableMessage,
} from "../../shared/notification-types.ts";

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * the list surface's private status set: the inventory `installed` token,
 * `available` / `unavailable` not-installed rows, `upgradable` rows, the
 * `disabled` inventory row, and a synthetic `failed` row for list-orchestration
 * failures.
 */
type ListStatus =
  | "installed"
  | "available"
  // USTAT-01 / D-64-01: not-installed, partially-available row -- distinct from
  // structural `unavailable` (renders `(partially-available)` / `⊖`).
  | "partially-available"
  | "unavailable"
  | "upgradable"
  | "disabled"
  | "failed"
  // FSTAT-02 / FSTAT-04 / D-66-01 / D-66-02: the derived partial-state inventory
  // rows. `partially-installed` is a recorded-installed plugin currently resolving
  // `partially-available`; `partially-upgradable` is a currently-clean plugin whose newer
  // candidate would newly degrade it.
  | "partially-installed"
  | "partially-upgradable"
  // RSTA-01 / D-80-06: the not-installed git-source row with no materialized
  // clone. Appended last per the closed-set tuple-ordering discipline.
  | "remote";

/** the list surface's row message union. */
export type ListMsg =
  | PluginInstalledMessage
  | PluginAvailableMessage
  | PluginPartiallyAvailableMessage
  | PluginUnavailableMessage
  | PluginUpgradableMessage
  | PluginDisabledMessage
  | PluginFailedMessage
  | PluginPartiallyInstalledMessage
  | PluginPartiallyUpgradableMessage
  | PluginRemoteMessage;

/** The command label and complete per-status reason policy. */
export const LIST_CONTEXT = {
  Messaging: { label: "Plugin list" },
  rowPolicies: {
    installed: { markers: true, contentReasons: true },
    available: { markers: false, contentReasons: true },
    "partially-available": { markers: false, contentReasons: true },
    unavailable: { markers: false, contentReasons: true },
    upgradable: { markers: false, contentReasons: true },
    "partially-installed": { markers: false, contentReasons: true },
    "partially-upgradable": { markers: false, contentReasons: true },
    disabled: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    remote: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<ListStatus>;
