import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveEnvelope } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

import type { ResolvedEnvelope } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type { NotificationMessage } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

for (const { name, message, expectedEnvelope } of [
  {
    name: "a clean cascade resolves to an info envelope",
    message: {
      kind: "cascade",
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              name: "alpha",
              status: "installed",
              dependencies: [],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    },
    expectedEnvelope: { severity: "info" },
  },
  {
    name: "a single warning row resolves to a warning envelope with its summary",
    message: {
      kind: "cascade",
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              name: "alpha",
              status: "skipped",
              reasons: ["not installed"],
              severity: "warning",
              needsReload: false,
            },
          ],
        },
      ],
    },
    expectedEnvelope: { severity: "warning", summary: "A plugin operation needs attention." },
  },
  {
    name: "an error cascade resolves to an error envelope with its summary",
    message: {
      kind: "cascade",
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              name: "alpha",
              status: "failed",
              reasons: ["not found"],
              severity: "error",
              needsReload: false,
            },
            {
              name: "beta",
              status: "failed",
              reasons: ["not found"],
              severity: "error",
              needsReload: false,
            },
          ],
        },
      ],
    },
    expectedEnvelope: { severity: "error", summary: "Some plugin operations have failed." },
  },
  {
    name: "a failed plugin info resolves to an error envelope",
    message: {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin: { name: "alpha", status: "failed", componentsResolved: false },
    },
    expectedEnvelope: { severity: "error", summary: "A plugin operation has failed." },
  },
  {
    name: "an absent marketplace resolves to an error envelope",
    message: { kind: "marketplace-not-added", name: "missing" },
    expectedEnvelope: { severity: "error", summary: "A marketplace operation has failed." },
  },
  {
    name: "a read-only info kind resolves to an info envelope",
    message: {
      kind: "marketplace-info",
      name: "official",
      scope: "user",
      details: { autoupdate: true },
      source: { sourceKind: "path", absPath: "/marketplaces/official" },
    },
    expectedEnvelope: { severity: "info" },
  },
] satisfies readonly {
  readonly name: string;
  readonly message: NotificationMessage;
  readonly expectedEnvelope: ResolvedEnvelope;
}[]) {
  test(name, () => {
    // act
    const envelope = resolveEnvelope(message);

    // assert
    assert.deepStrictEqual(envelope, expectedEnvelope);
  });
}
