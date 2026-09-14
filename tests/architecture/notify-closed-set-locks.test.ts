/**
 * tests/architecture/notify-closed-set-locks.test.ts -- closed-set length
 * tripwires for the notification vocabulary (OUT-08 / SNM-02).
 *
 * `Reason`, `StatusToken`, `PluginStatus`, and `MarketplaceStatus` are the
 * closed sets the renderer, the catalog, and the per-command
 * `satisfies CommandContext` checks are written against. The compile-time proofs
 * (`notify-reasons.ts`'s partition gate, the `assertNever` renderer tails) catch
 * a member that is REMOVED or RENAMED, but an ADDITIVE drift -- a new literal
 * appended to a set and given a home everywhere the type system looks -- is
 * silently absorbed.
 *
 * These exact-length assertions are the deliberate-bump tripwire for that case:
 * appending a closed-set member forces a conscious update here, which is the
 * prompt to also add its catalog fixture / output-catalog.md row / renderer arm.
 * Bump the expected count in the SAME change that grows the set.
 *
 * The sets are declared privately by their owner, so the counted subject is an
 * ENROLLMENT MAP written here: a `Record<Reason, true>` is exhaustive in both
 * directions, so a member added to the union arrives as a missing property (the
 * deliberate bump this file exists to force) and a literal written here that the
 * union does not hold arrives as an excess one. The map is this file's own
 * hand-written copy of the vocabulary -- never derived from the owner -- and the
 * count below is a fact about that map, which the exhaustiveness makes a fact
 * about the union.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type {
  MarketplaceStatus,
  PluginStatus,
  Reason,
  StatusToken,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

const REASON_ENROLLMENT: Record<Reason, true> = {
  "up-to-date": true,
  "not found": true,
  "already installed": true,
  "not installed": true,
  "not in manifest": true,
  "invalid manifest": true,
  "no longer installable": true,
  "unsupported source": true,
  "unsupported component": true,
  "unsupported hooks": true,
  lsp: true,
  "requires pi-subagents": true,
  "requires pi-mcp": true,
  "rollback partial": true,
  unreadable: true,
  unparseable: true,
  "unreadable manifest": true,
  "source mismatch": true,
  "plugins remain": true,
  "concurrently uninstalled": true,
  "concurrently updated": true,
  "stale clone": true,
  "duplicate name": true,
  "lock held": true,
  "already autoupdate": true,
  "already no autoupdate": true,
  "already enabled": true,
  "already disabled": true,
  "permission denied": true,
  "source missing": true,
  "network unreachable": true,
  "marketplace not added": true,
  "marketplace not added to user scope": true,
  "marketplace not added to project scope": true,
  "orphan rewake": true,
  "authentication required": true,
  "dangling reference": true,
  "malformed mcp": true,
  "malformed skill": true,
  "malformed command": true,
  "installs disabled": true,
  "marketplace in user scope": true,
  "marketplace in project scope": true,
  workflows: true,
};

const STATUS_TOKEN_ENROLLMENT: Record<StatusToken, true> = {
  installed: true,
  updated: true,
  reinstalled: true,
  uninstalled: true,
  added: true,
  removed: true,
  available: true,
  unavailable: true,
  upgradable: true,
  skipped: true,
  failed: true,
  "rollback failed": true,
  "manual recovery": true,
  "no marketplaces": true,
  "no plugins": true,
  "will install": true,
  "will uninstall": true,
  "will enable": true,
  "will disable": true,
  disabled: true,
  "partially-installed": true,
  "partially-upgradable": true,
  "partially-available": true,
  remote: true,
};

const PLUGIN_STATUS_ENROLLMENT: Record<PluginStatus, true> = {
  installed: true,
  updated: true,
  reinstalled: true,
  uninstalled: true,
  available: true,
  unavailable: true,
  upgradable: true,
  failed: true,
  skipped: true,
  "manual recovery": true,
  "will install": true,
  "will uninstall": true,
  "will enable": true,
  "will disable": true,
  disabled: true,
  "partially-installed": true,
  "partially-upgradable": true,
  "partially-available": true,
  remote: true,
};

const MARKETPLACE_STATUS_ENROLLMENT: Record<MarketplaceStatus, true> = {
  added: true,
  removed: true,
  updated: true,
  failed: true,
  "autoupdate enabled": true,
  "autoupdate disabled": true,
  skipped: true,
};

test("OUT-08: Reason is the closed 44-entry reason set", () => {
  // D-76-08: +1 for the `authentication required` failure-class member (32 -> 33).
  // PURL-06: +1 for the `dangling reference` failure-class member (33 -> 34).
  // MCPR-03 / D-02: +1 for the malformed mcp failure-class member (34 -> 35).
  // CLASS-01 / D-86-01: +2 for the per-kind `malformed skill` / `malformed
  // command` failure-class members (35 -> 37).
  // D-90-05: +1 for the `unsupported component` member -- the truthful marker
  // for a dropped non-carve-out component kind (37 -> 38).
  // OUT-01 / DFEN-04: +1 for the `installs disabled` member -- the marker for an
  // install that landed disabled on the plugin's own declaration (38 -> 39).
  // CMP-4 / SCOPE-01: +1 for `marketplace not added to user scope` -- the SECOND
  // structural marketplace-absent marker, replacing `marketplace not added` on the row when
  // the container was found in the scope the command did not target (39 -> 40),
  // +1 for its project-target sibling `marketplace not added to project scope`
  // (40 -> 41).
  // SCOPE-01 / D-01: +2 for the `marketplace in user scope` /
  // `marketplace in project scope` CONTENT pair -- the cross-scope qualifier an
  // absent-target lifecycle row joins to `not installed` so the
  // container-is-one-scope-over miss stops rendering byte-identically to the
  // container-is-here miss (41 -> 43).
  // WDET-04 / D-106-04: +1 for the dedicated final `workflows` member
  // (43 -> 44).
  assert.equal(Object.keys(REASON_ENROLLMENT).length, 44);
});

test("SNM-02: StatusToken is the closed 24-entry token set", () => {
  // FSTAT-02 / FSTAT-04 / D-66-05: +2 for the derived `partially-installed` /
  // `partially-upgradable` realized tokens. `will partially install` is a render
  // modifier on `will install`, NOT a token, so the set grows by exactly 2.
  // USTAT-02 / D-64-01: +1 for the de-collapsed not-installed `partially-available`
  // render token (22 -> 23).
  // RSTA-01 / D-80-06: +1 for the not-installed git-source `remote` token (23 -> 24).
  assert.equal(Object.keys(STATUS_TOKEN_ENROLLMENT).length, 24);
});

test("SNM-02: PluginStatus is the closed 19-entry plugin-status set", () => {
  // FSTAT-02 / FSTAT-04 / D-66-05: +2 for `partially-installed` / `partially-upgradable`.
  // USTAT-02 / D-64-01: +1 for `partially-available` (17 -> 18). Both sets gain the
  // member; `PluginStatus` MUST because `PluginInfoRowBase.status` derives via
  // `Extract<PluginStatus, "partially-available">`.
  // RSTA-01 / D-80-06: +1 for `remote` (18 -> 19) -- likewise required in
  // `PluginStatus` because the info surface renders `(remote)` via
  // `Extract<PluginStatus, "remote">`.
  assert.equal(Object.keys(PLUGIN_STATUS_ENROLLMENT).length, 19);
});

test("SNM-02: MarketplaceStatus is the closed 7-entry marketplace-status set", () => {
  assert.equal(Object.keys(MARKETPLACE_STATUS_ENROLLMENT).length, 7);
});

/**
 * Discriminating controls for the four maps above. An exhaustive `Record` is
 * only a tripwire if it actually rejects both drift directions, and a count over
 * a map the compiler never constrained would report the same number either way.
 * `IsExact` states what the map's key set is, so a control asserting `false`
 * fails HERE if the constraint had degenerated.
 */
type IsExact<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;

void (true satisfies IsExact<keyof typeof REASON_ENROLLMENT, Reason>);
void (true satisfies IsExact<keyof typeof STATUS_TOKEN_ENROLLMENT, StatusToken>);
void (true satisfies IsExact<keyof typeof PLUGIN_STATUS_ENROLLMENT, PluginStatus>);
void (true satisfies IsExact<keyof typeof MARKETPLACE_STATUS_ENROLLMENT, MarketplaceStatus>);

// A member the union does not hold, and a member it holds that an enrollment map
// would drop: both directions of the drift this file exists to catch.
void (false satisfies IsExact<Reason | "not a reason", Reason>);
void (false satisfies IsExact<Exclude<Reason, "workflows">, Reason>);
