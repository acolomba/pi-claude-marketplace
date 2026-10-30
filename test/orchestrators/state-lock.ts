import lockfile from "proper-lockfile";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { TestContext } from "node:test";

export type ReleaseStateLock = () => Promise<void>;

export function holdStateLock(locations: ScopedLocations): Promise<ReleaseStateLock> {
  return lockfile.lock(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });
}

export async function holdStateLockForTest(
  t: TestContext,
  locations: ScopedLocations,
): Promise<void> {
  const release = await holdStateLock(locations);
  t.after(async () => {
    await release();
  });
}

export async function whileStateLockHeld<T>(
  locations: ScopedLocations,
  action: () => Promise<T>,
): Promise<T> {
  const release = await holdStateLock(locations);
  try {
    return await action();
  } finally {
    await release();
  }
}

export function stateLockHeldCause(locations: ScopedLocations): string {
  return `Another pi-claude-marketplace operation is in progress for ${locations.scope} scope (${locations.stateLockFile}). Retry after it completes.`;
}
