import type { MockCtx, MockPi } from "./mock-pi.ts";
import type { NotificationPresentation } from "../../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { NotificationMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

/** The input and expectations every catalog fixture states. */
interface CatalogFixtureBase {
  readonly message: NotificationMessage;
  readonly pi: MockPi;
  readonly expectedSeverity?: "warning" | "error";
}

/**
 * A fixture whose public bytes belong to an orchestrator seam rather than the
 * notification dispatcher, such as bulk update's never-silent no-op. It must
 * state the presentation those bytes come from, so the JSON strategy converts
 * the same value the text bytes were formatted from.
 */
interface SeamFixture extends CatalogFixtureBase {
  /** Emits the state through the orchestrator seam. */
  readonly emit: (ctx: MockCtx, run: NotificationRun) => void;
  /** Presents the same message through the presenter and row policies `emit` uses. */
  readonly present: (run: NotificationRun) => NotificationPresentation;
}

/** A fixture the dispatcher presents and formats from `message` alone. */
interface DispatchFixture extends CatalogFixtureBase {
  readonly emit?: never;
  readonly present?: never;
}

/**
 * One programmatic input paired with an independent catalog output block. An
 * `emit` closure without its `present` hook does not type-check.
 */
export type CatalogFixture = SeamFixture | DispatchFixture;

/** Catalog fixtures indexed by exact section and state names. */
export type FixtureMap = Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>;
