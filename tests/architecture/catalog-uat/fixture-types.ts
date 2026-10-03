import type { MockCtx, MockPi } from "./mock-pi.ts";
import type { NotificationPresentation } from "../../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { NotificationMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

/** One programmatic input paired with an independent catalog output block. */
export interface CatalogFixture {
  readonly message: NotificationMessage;
  readonly pi: MockPi;
  readonly expectedSeverity?: "warning" | "error";
  /**
   * Emits states whose public bytes belong to an orchestrator seam rather than
   * the notification dispatcher, such as bulk update's never-silent no-op.
   */
  readonly emit?: (ctx: MockCtx, run: NotificationRun) => void;
  /**
   * The presentation the JSON strategy converts for a fixture whose bytes come
   * from an `emit` closure. It presents the same message through the same
   * presenter and row policies that closure's seam uses.
   */
  readonly present?: (run: NotificationRun) => NotificationPresentation;
}

/** Catalog fixtures indexed by exact section and state names. */
export type FixtureMap = Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>;
