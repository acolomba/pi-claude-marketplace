/**
 * tests/architecture/notify-closed-set-locks.test.ts -- closed-set length
 * tripwires for the notification vocabulary (OUT-08 / SNM-02).
 *
 * `Reason`, `StatusToken`, `PluginStatus`, and `MarketplaceStatus` are the
 * closed sets the renderer, the catalog, and the per-command
 * `satisfies CommandContext` checks are written against. The compile-time proofs
 * (`notify-reasons.ts`'s partition gate, the renderer's exhaustive switches) catch
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
  ContentReason,
  MarketplaceStatus,
  NotificationMessage,
  PluginStatus,
  PluginWillUninstallMessage,
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
  "data kept": true,
  "no matching version": true,
  "version conflict": true,
  "constraint too complex": true,
  "invalid version constraint": true,
  "dependency marketplace not added": true,
  "dependency cycle": true,
  "dependency failed": true,
  "dependency promoted": true,
  "dependency pruned": true,
  "dependency unsatisfied": true,
  "dependency version unsatisfied": true,
  "dependents unsatisfied": true,
  "dependency current copy": true,
  "dependency enabled": true,
  "dependents remain": true,
  "dependency installed": true,
  "dependents constrain": true,
  "cross-marketplace": true,
  "stale workflow command": true,
  "requires pi-dynamic-workflows": true,
  "components now supported": true,
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

// Standalone notifications have their own discriminator set. Scoped prune
// results and committed warnings are members; the cascade's absent kind remains optional.
const NOTIFICATION_KIND_ENROLLMENT: Record<
  Exclude<NotificationMessage["kind"], undefined>,
  true
> = {
  cascade: true,
  "marketplace-info": true,
  "plugin-info": true,
  "marketplace-info-cascade": true,
  "plugin-info-cascade": true,
  "marketplace-not-added": true,
  "reconcile-pending-empty": true,
  "prune-empty": true,
  "prune-committed-warning": true,
  "reconcile-applied-cascade": true,
};

test("OUT-08: Reason is the closed 65-entry reason set", () => {
  // The set is append-only and its declared order is catalog-stable, so this
  // length is a tripwire: an additive drift has to be a deliberate bump made
  // here, in the same edit as the member. The MEMBERSHIP is pinned separately by
  // enumeration in `compat-01-no-expansion.test.ts`, and each member's own
  // rationale lives beside its literal in `notification-types.ts`.
  //
  // No changelog of past counts lives here. Git holds that history, a comment is
  // not a gate, and a count restated far from this assertion is a claim nothing
  // turns red for.
  assert.strictEqual(Object.keys(REASON_ENROLLMENT).length, 65);
});

test("SNM-02: StatusToken is the closed 24-entry token set", () => {
  // FSTAT-02 / FSTAT-04 / D-66-05: +2 for the derived `partially-installed` /
  // `partially-upgradable` realized tokens. `will partially install` is a render
  // modifier on `will install`, NOT a token, so the set grows by exactly 2.
  // USTAT-02 / D-64-01: +1 for the de-collapsed not-installed `partially-available`
  // render token (22 -> 23).
  // RSTA-01 / D-80-06: +1 for the not-installed git-source `remote` token (23 -> 24).
  assert.strictEqual(Object.keys(STATUS_TOKEN_ENROLLMENT).length, 24);
});

test("SNM-02: PluginStatus is the closed 19-entry plugin-status set", () => {
  // FSTAT-02 / FSTAT-04 / D-66-05: +2 for `partially-installed` / `partially-upgradable`.
  // USTAT-02 / D-64-01: +1 for `partially-available` (17 -> 18). Both sets gain the
  // member; `PluginStatus` MUST because `PluginInfoRowBase.status` derives via
  // `Extract<PluginStatus, "partially-available">`.
  // RSTA-01 / D-80-06: +1 for `remote` (18 -> 19) -- likewise required in
  // `PluginStatus` because the info surface renders `(remote)` via
  // `Extract<PluginStatus, "remote">`.
  assert.strictEqual(Object.keys(PLUGIN_STATUS_ENROLLMENT).length, 19);
});

test("SNM-02: MarketplaceStatus is the closed 7-entry marketplace-status set", () => {
  assert.strictEqual(Object.keys(MARKETPLACE_STATUS_ENROLLMENT).length, 7);
});

test("standalone notification kinds include scoped prune outcomes exactly", () => {
  assert.strictEqual(Object.keys(NOTIFICATION_KIND_ENROLLMENT).length, 10);
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
void (true satisfies IsExact<
  keyof typeof NOTIFICATION_KIND_ENROLLMENT,
  Exclude<NotificationMessage["kind"], undefined>
>);

// A preview may name why prune would remove a member. Ordinary pending
// reconciliation must still be able to omit the reason entirely.
void (true satisfies IsExact<
  PluginWillUninstallMessage["reasons"],
  readonly ContentReason[] | undefined
>);
void ({ status: "will uninstall", name: "shared-lib" } satisfies PluginWillUninstallMessage);
void ({
  status: "will uninstall",
  name: "shared-lib",
  reasons: ["dependency pruned"],
} satisfies PluginWillUninstallMessage);

// A member the union does not hold, and a member it holds that an enrollment map
// would drop: both directions of the drift this file exists to catch.
void (false satisfies IsExact<Reason | "not a reason", Reason>);
void (false satisfies IsExact<Exclude<Reason, "components now supported">, Reason>);
