import assert from "node:assert/strict";

import { Compile } from "typebox/compile";

import { NOTIFICATION_PAYLOAD_SCHEMA } from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";

import type { NotificationUi } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const PAYLOAD_VALIDATOR = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

/** An original append attempt, retained even when validation rejects it. */
export interface CapturedEntry {
  readonly customType: string;
  readonly payload: unknown;
}

/** Captures every entry and retains failures until the consumer asserts validity. */
export function createJsonCapture(): {
  readonly entries: CapturedEntry[];
  readonly entrySink: { readonly appendEntry: (customType: string, payload: unknown) => void };
  readonly ui: NotificationUi;
  assertValid(): void;
} {
  const entries: CapturedEntry[] = [];
  const failures: unknown[] = [];
  return {
    entries,
    entrySink: {
      appendEntry(customType: string, payload: unknown): void {
        entries.push({ customType, payload });
        try {
          assert.strictEqual(customType, "claude-plugin");
          assertJsonValue(payload);
          assert.ok(PAYLOAD_VALIDATOR.Check(JSON.parse(JSON.stringify(payload))));
        } catch (error: unknown) {
          failures.push(error);
          throw error;
        }
      },
    },
    get ui(): NotificationUi {
      const error = new Error("Machine output must not access the notification UI");
      failures.push(error);
      throw error;
    },
    assertValid(): void {
      assert.deepStrictEqual(failures, []);
    },
  };
}

function assertJsonValue(payload: unknown): void {
  if (typeof payload === "string" || typeof payload === "boolean") {
    return;
  }

  if (typeof payload === "number") {
    assert.ok(Number.isFinite(payload));
    return;
  }

  assert.ok(payload !== null && typeof payload === "object");
  assert.ok(Array.isArray(payload) || Object.getPrototypeOf(payload) === Object.prototype);
  assert.strictEqual(Object.getOwnPropertySymbols(payload).length, 0);
  for (const member of Object.values(payload)) {
    assertJsonValue(member);
  }
}
