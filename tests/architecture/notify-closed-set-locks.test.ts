/**
 * tests/architecture/notify-closed-set-locks.test.ts -- closed-set length
 * tripwires for the notification vocabulary (OUT-08 / SNM-02).
 *
 * The `REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, and `MARKETPLACE_STATUSES`
 * tuples are the closed sets the renderer, the catalog, and the per-command
 * `satisfies CommandContext` checks are written against. The compile-time proofs
 * (`notify-reasons.ts::_ReasonsCoverageProof`, the `assertNever` renderer tails)
 * catch a member that is REMOVED or RENAMED, but an ADDITIVE drift -- a new
 * literal appended to a set and given a home everywhere the type system looks --
 * is silently absorbed.
 *
 * These exact-length assertions are the deliberate-bump tripwire for that case:
 * appending a closed-set member forces a conscious update here, which is the
 * prompt to also add its catalog fixture / output-catalog.md row / renderer arm.
 * Bump the expected count in the SAME change that grows the set.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKETPLACE_STATUSES,
  PLUGIN_STATUSES,
  REASONS,
  STATUS_TOKENS,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

test("OUT-08: REASONS is the closed 32-entry reason set", () => {
  assert.equal(REASONS.length, 32);
});

test("SNM-02: STATUS_TOKENS is the closed 22-entry token set", () => {
  // FSTAT-02 / FSTAT-04 / D-66-05: +2 for the derived `force-installed` /
  // `force-upgradable` realized tokens. `will force install` is a render
  // modifier on `will install`, NOT a token, so the set grows by exactly 2.
  assert.equal(STATUS_TOKENS.length, 22);
});

test("SNM-02: PLUGIN_STATUSES is the closed 17-entry plugin-status set", () => {
  // FSTAT-02 / FSTAT-04 / D-66-05: +2 for `force-installed` / `force-upgradable`.
  assert.equal(PLUGIN_STATUSES.length, 17);
});

test("SNM-02: MARKETPLACE_STATUSES is the closed 7-entry marketplace-status set", () => {
  assert.equal(MARKETPLACE_STATUSES.length, 7);
});
