/**
 * @fileoverview The companion extensions a profile Pi can load, found in the
 * optional peer cache (HAR-01, D-CF1-15).
 *
 * `scripts/install-test-peers.mjs` installs the declared floor of each
 * optional peer into `node_modules/.cache/optional-peers`. The cache path here
 * changes together with that script.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

// scripts/install-test-peers.mjs fills this directory; the two paths change together.
const PEER_CACHE_MODULES = fileURLToPath(
  new URL("../../node_modules/.cache/optional-peers/node_modules/", import.meta.url),
);

/** Returns whether `file` lies inside the optional peer cache. */
export function isInPeerCache(file: string): boolean {
  return file.startsWith(PEER_CACHE_MODULES) || `${file}${path.sep}` === PEER_CACHE_MODULES;
}
