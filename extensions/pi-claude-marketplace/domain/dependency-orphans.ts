// domain/dependency-orphans.ts
//
// The dependents question: given a `plugin@marketplace` key and an index of
// what every OTHER installed plugin in the scope declares, which of them still
// declare it (D-05-14, PRUNE-05)?
//
// The question lives in `domain/` because it is pure: no I/O, no clock, no
// filesystem and no network. The declaration index arrives as a PARAMETER, so
// a caller decides where each plugin's declared `dependencies` come from (the
// offline manifest read, D-05-06) and the test here stays trivially testable
// against a synthetic map.
//
// D-05-04: a DISABLED installed plugin still holds what it declares. That
// rule is enforced by construction rather than by a predicate here -- the
// index builder never filters on `enabled`, so every holder key it indexes is
// a holder this function reports.
//
// Matching is exact string equality on the `name@marketplace` key: no case
// folding, no Unicode normalization, no trimming. The index builder fills a
// declaration's missing marketplace with the declaring plugin's own, so the
// keys on both sides of the comparison follow the same fill rule.

/**
 * What every installed plugin in one scope declares, keyed by the holder's
 * `name@marketplace` key. Each value is the set of `name@marketplace` keys that
 * holder declares as dependencies, with a declaration's missing marketplace
 * already filled in with the holder's own.
 */
export type DeclarationIndex = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * The holder keys whose declared set contains `target`, in `localeCompare`
 * order -- the ordering every other rendered name list in this extension uses.
 * An empty index or a target nobody declares yields `[]`. The input map is
 * never mutated.
 */
export function findDependents(target: string, index: DeclarationIndex): readonly string[] {
  const dependents: string[] = [];
  for (const [holder, declared] of index) {
    if (declared.has(target)) {
      dependents.push(holder);
    }
  }

  return dependents.sort((a, b) => a.localeCompare(b));
}
