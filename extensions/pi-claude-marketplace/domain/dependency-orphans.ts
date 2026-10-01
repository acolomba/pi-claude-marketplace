// domain/dependency-orphans.ts
//
// Two questions over one declaration index:
//
// - The dependents question: given a `plugin@marketplace` key and an index of
//   what every OTHER installed plugin in the scope declares, which of them
//   still declare it (D-05-14, PRUNE-05)?
// - The orphans question: after some keys are gone, which dependency-provenance
//   records does NO remaining record declare, iterated to a fixpoint (D-05-01,
//   D-05-02, PRUNE-01..03)?
//
// Both live in `domain/` because they are pure: no I/O, no clock, no
// filesystem and no network. The declaration index arrives as a PARAMETER, so
// a caller decides where each plugin's declared `dependencies` come from (the
// offline manifest read, D-05-06) and the tests here stay trivially testable
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
 * Lists the holder keys whose declared set contains `target`, in
 * `localeCompare` order -- the ordering every other rendered name list in this
 * extension uses. An empty index or a target nobody declares yields `[]`. The
 * input map is never mutated.
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

/**
 * One installed record as the orphan sweep sees it: its `name@marketplace`
 * key and the provenance the install recorded. Nothing else about the record
 * -- `enabled`, its inventory, its version -- bears on whether it is an orphan.
 */
export interface OrphanCandidate {
  readonly key: string;
  readonly provenance: "explicit" | "dependency";
}

/**
 * Reports whether any holder outside `gone` declares `key` -- the ONE-PASS
 * question, with no fixpoint behind it: a holder in `gone` is absent, every
 * other holder is present whatever `gone` implies about its own orphan status.
 *
 * `pruneOrphans` marks a whole batch gone on the assumption that every key
 * in it will be removed; when a removal fails, that key's holder is still
 * installed and still declares. The sweep asks this question again with the
 * keys that ACTUALLY left before removing each member of the precomputed
 * order, so a key only a failed member holds is kept (PRUNE-03, D-05-13).
 */
export function isHeldBy(index: DeclarationIndex, gone: ReadonlySet<string>, key: string): boolean {
  for (const [holder, declared] of index) {
    if (!gone.has(holder) && declared.has(key)) {
      return true;
    }
  }

  return false;
}

/**
 * Computes the keys `--prune` removes, in removal order, given every record in
 * the scope, the declaration index over those records, and the keys already
 * removed (the named plugin).
 *
 * D-05-01: the sweep is whole-scope -- a candidate nothing declares is pruned
 * whether or not `removed` names one of its former holders, so an orphan left
 * by an earlier plain uninstall or a reload goes too.
 *
 * D-05-02: repeat until stable. Each pass collects the records that are not
 * yet gone and that no holder still present declares, sorts them, and marks
 * them gone; the next pass sees those holders as absent. A later pass can only
 * contain keys the previous batch was holding, so the accumulated order is
 * dependents before dependencies by construction. Every pass either marks at
 * least one new key or ends the loop, so it runs at most `records.length + 1`
 * times.
 *
 * PRUNE-02: the provenance filter runs BEFORE any declaration is consulted;
 * an explicit record is never in a batch whatever the index says about it.
 *
 * PRUNE-03: a key any present holder declares is never in a batch, and the
 * index does not distinguish an enabled holder from a disabled one (D-05-04),
 * so a mutually-declaring island of dependency records holds itself.
 *
 * None of the inputs is mutated.
 */
export function pruneOrphans(
  records: readonly OrphanCandidate[],
  index: DeclarationIndex,
  removed: ReadonlySet<string>,
): readonly string[] {
  const gone = new Set(removed);
  const order: string[] = [];
  for (;;) {
    const batch = records
      .filter((record) => record.provenance === "dependency" && !gone.has(record.key))
      .filter((record) => !isHeldBy(index, gone, record.key))
      .map((record) => record.key)
      .sort((a, b) => a.localeCompare(b));
    if (batch.length === 0) {
      return order;
    }

    for (const key of batch) {
      gone.add(key);
      order.push(key);
    }
  }
}
