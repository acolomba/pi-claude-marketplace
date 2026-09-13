import type { MockCtx, MockPi } from "./mock-pi.ts";
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
  readonly emit?: (ctx: MockCtx, pi: MockPi) => void;
}

/** Catalog fixtures indexed by exact section and state names. */
export type FixtureMap = Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>;
