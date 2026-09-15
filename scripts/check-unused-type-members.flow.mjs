/**
 * Directed value transfers for the unused-type-member gate.
 *
 * DELIBERATE STAND-IN. This module answers "no value ever transfers", which is
 * the exact mutant the flow controls exist to catch: every structural
 * observation still lands, and every credit that depends on an actual argument,
 * assignment, return or container edge is missing. The controls in
 * `tests/scripts/check-unused-type-members.flow.test.ts` are written against the
 * real behaviour and are expected to fail here.
 */

/**
 * Transferred observations, the gaps the transfer walk could not close, the
 * directed transfer records later stages read, and the work this walk did.
 */
export function collectFlowObservations() {
  return {
    witnesses: new Map(),
    unsupported: new Map(),
    transfers: [],
    counters: { steps: 0, edges: 0, reads: 0 },
    exhausted: undefined,
  };
}
