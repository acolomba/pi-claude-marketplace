/**
 * Deliberate stand-in for the contract engine.
 *
 * It excuses nothing and validates nothing, which is the exact mutant the
 * controls in `tests/scripts/check-unused-type-members.contracts.test.ts` exist
 * to catch: a gate that accepted every contract file as written would look green
 * while covering members no boundary supports.
 */
export function createContractEvaluator(_options) {
  return () => ({ decisions: [], diagnostics: [] });
}
