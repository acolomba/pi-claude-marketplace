// orchestrators/plugin/constraint-fold.ts
//
// What the installed records that declare a plugin hold it to, folded from a
// declaration map the caller already walked: the holders, the combined range,
// and the cause line every constraint arm shares (UPDT-01, UPDT-02).
//
// D-23 / NFR-5: the fold lists no release tag. It is outside `NETWORK_SEAMS`,
// so BLOCK F in `eslint.config.js` rejects a git surface here, and it imports
// no tag probe. `update-constraint-gate.ts` adds the tag search on top for
// `update`; the convergence planner judges the catalog version with the fold
// alone, so `pending`, the load and `apply` reach no tag-listing code.
//
// `evaluateCatalogConstraint` adds the declaration walk to the fold: the gate
// the shared runner selects when its policy lists no tag (D-23), so `apply`
// judges a range against the catalog version exactly as `pending` previews it.
//
// The range algebra is `intersectDependencyRanges` alone: the two
// project-owned caps on total input size and projected conjuncts live
// there, and calling `semver` directly from this leaf would bypass both.

import {
  intersectDependencyRanges,
  isUnconstrainedRange,
  recordedVersionSatisfies,
  renderConstraintRange,
  renderDeclaredRanges,
} from "../../domain/dependency-range.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";
import { DependencyDeclarationsUnreadableError } from "../../shared/errors.ts";

import { buildScopeDeclarationDetail } from "./dependency-index.ts";

import type { AddressedDependency } from "./dependency-index.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";

/**
 * One installed record that declares the target, with the range it declared
 * and whether it is currently disabled. `range` is absent when the
 * declaration names the key with no version -- it still HOLDS the key (a
 * declaration holds whatever it names), but contributes nothing to the fold.
 */
export interface ConstraintHolder {
  readonly key: string;
  readonly range?: string;
  readonly disabled: boolean;
}

/**
 * A satisfying release tag's identity: the commit it resolved to and the
 * version its name declares. Shared with `update-preflight.ts`'s candidate
 * resolution, which threads the SAME pin through the resolver's callbacks
 * (D-10-17) -- one declaration, not two structurally-identical ones.
 */
export interface UpdateTagPin {
  readonly oid: string;
  readonly version: string;
}

/**
 * What the target's installed dependents hold it to. `held` is a hold over a
 * declared range only (D-18-07); a declaration walk that cannot read a record
 * produces no verdict and rejects instead (D-18-17).
 */
export type UpdateConstraintVerdict =
  | { readonly kind: "unconstrained" }
  | {
      readonly kind: "admits";
      readonly range: string;
      readonly holders: readonly ConstraintHolder[];
      readonly pin?: UpdateTagPin;
      readonly fellBackToCurrentCopy: boolean;
      /**
       * D-10-13 / D-10-17a: the ceiling disclosure -- the holders' declared
       * ranges joined with `, ` (INR-05) and the holders, composed once here
       * so every `admits` arm has it ready for the two `unchanged`
       * construction sites and for `PreparedPluginUpdate.constraint`.
       * Composed the same way whether or not a pin or a fallback produced
       * this verdict; the caller decides which row (if any) actually shows
       * it.
       */
      readonly disclosure: string;
    }
  | { readonly kind: "held"; readonly cause: string };

/** Stage two's re-check of the version that actually landed. */
export type StageTwoVerdict =
  { readonly kind: "admitted" } | { readonly kind: "held"; readonly cause: string };

/**
 * The ways stage one can fail to admit a version, the two ranges
 * `intersectDependencyRanges` can fail to fold a set into (D-10-10), and the
 * three arms that describe a version already in hand rather than a search
 * failure: `out-of-range` is stage two's post-fetch guard (UPDT-02),
 * `already-resolved` is the D-10-13 ceiling disclosure, and `range-only`
 * is its counterpart on an arm where no tag search established a ceiling.
 */
type ConstraintArm =
  | "disjoint"
  | "invalid"
  | "too-complex"
  | "no-satisfying-tag"
  | "transport"
  | "out-of-range"
  | "already-resolved"
  | "range-only";

/** Fixed clause per arm (D-10-10): the situation, never an identifier. */
const ARM_CLAUSE: Record<ConstraintArm, string> = {
  disjoint: "the declared ranges admit no version in common",
  invalid: "a declared range could not be read",
  "too-complex": "the declared ranges are too complex to combine",
  // A later stage's post-fetch guard reaches this arm: stage one itself
  // never holds on a no-satisfying-tag answer (it leaves the outcome open).
  "no-satisfying-tag": "no release tag satisfies the combined range",
  transport: "the release tags could not be listed",
  // UPDT-02: the version that actually landed (a no-tag repository, or a
  // drifted path-source current copy) falls outside what the dependents
  // named below admit; the line prints only their declared ranges.
  "out-of-range": "falls outside what the combined range admits",
  // D-10-13: the plugin is already at the highest version the combined
  // range admits -- disclosed on an `{up-to-date}` row's cause line, never a
  // second reason token. Only a PIN earns this clause: the tag search ran
  // and selected the highest satisfying release.
  "already-resolved": "already the highest version the combined range admits",
  // D-10-13 on an arm that established no ceiling -- no tag matched, the
  // listing was unreadable, or the entry source has no tag listing at all.
  // The range and its holders are still the truth; "highest admitted" is
  // not.
  "range-only": "constrained to the combined range",
};

/**
 * What one cause line says behind its arm clause. The `transport` arm names
 * its classification; every other arm names the holders' declared ranges, so
 * no caller can hand a range arm a fold or a fold diagnostic. `version` is
 * stage two's fetched version, printed ahead of the clause.
 */
type ConstraintLine =
  | { readonly arm: "transport"; readonly classification: string }
  | { readonly arm: Exclude<ConstraintArm, "transport">; readonly version?: string };

function nameHolder(holder: ConstraintHolder): string {
  return holder.disabled ? `"${holder.key}" (currently disabled)` : `"${holder.key}"`;
}

/**
 * Composes the ONE cause line every constraint arm shares (D-10-11): a fixed
 * arm clause, the detail behind it, and the declaring plugins in walk order,
 * each marked when currently disabled. Every new arm extends `ARM_CLAUSE`
 * rather than writing a second composer -- the holder-naming half is
 * identical across all of them, so a second composer would be a second place
 * to drift the disabled marking.
 *
 * INR-05: a range-naming arm's detail is the declared ranges of the holders
 * the line names, in holder order, joined with `, ` as Claude Code joins
 * them; a holder that declared no range is named but adds nothing. Each
 * declared range passed `domain/dependencies.ts`' allowlist and 64-character
 * bound at parse time, and the join is bounded again here. The `transport`
 * arm's classification is bounded the same way. A stage-two `version` is
 * interpolated with NO transformation (a resolved version is never
 * attacker-controlled length the way a declared range is).
 */
function describeConstraint(holders: readonly ConstraintHolder[], line: ConstraintLine): string {
  const detail =
    line.arm === "transport"
      ? renderConstraintRange(line.classification)
      : renderDeclaredRanges(
          holders.flatMap((holder) => (holder.range === undefined ? [] : [holder.range])),
        );
  const required = holders.map(nameHolder).join(", ");
  const fetched =
    line.arm === "transport" || line.version === undefined ? "" : `version ${line.version} `;
  return `${fetched}${ARM_CLAUSE[line.arm]} (${detail}) -- required by ${required}`;
}

/** The `name@marketplace` key naming one record, on the D-05-06 convention. */
function recordKey(name: string, marketplace: string): string {
  return `${name}@${marketplace}`;
}

/**
 * Every OTHER installed record that declares the target, sorted by key.
 *
 * Walks the scope's own records (never a second scope, D-10-07) rather than
 * the `declarations` map's keys, so each declarer's `enabled` bit is read off
 * the SAME record the walk already holds -- no second state lookup, and no
 * key-string parsing to recover a declarer's name and marketplace. A
 * declarer whose key equals the target's own is skipped before its
 * declarations are even read: a plugin that declares itself constrains
 * nothing. `provenance` is never read -- the question is who declares this
 * key, not how the record got here (D-10-08).
 */
function collectHolders(
  declarations: ReadonlyMap<string, readonly AddressedDependency[]>,
  state: ExtensionState,
  target: string,
): readonly ConstraintHolder[] {
  const holders: ConstraintHolder[] = [];
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const [name, record] of Object.entries(marketplace.plugins)) {
      const declarerKey = recordKey(name, marketplace.name);
      if (declarerKey === target) {
        continue;
      }

      const declared = declarations.get(declarerKey) ?? [];
      for (const dependency of declared) {
        if (recordKey(dependency.name, dependency.marketplace) !== target) {
          continue;
        }

        holders.push({
          key: declarerKey,
          ...(dependency.version !== undefined && { range: dependency.version }),
          disabled: isRecordedButDisabled(record),
        });
      }
    }
  }

  return holders.sort((left, right) => left.key.localeCompare(right.key));
}

/**
 * The `admits` arm, with or without a pin (the shape every stage-one branch
 * returns). `disclosure` is composed here ONCE per verdict, from the SAME
 * holders every branch already has, naming their declared ranges (INR-05)
 * while `range` keeps the fold, so it is ready for the `unchanged` ceiling
 * row (D-10-13) and `PreparedPluginUpdate.constraint` (D-10-17a) without a
 * second composition site.
 *
 * The clause follows the PIN. A pin means the tag search ran and chose the
 * highest satisfying release, so the ceiling is established and the line
 * may claim it. Every other admitting branch -- no matching tag, an
 * unreadable listing, a source with no tag listing at all -- searched
 * nothing or found nothing, so its line discloses the range alone.
 */
export function admitsRange(
  range: string,
  holders: readonly ConstraintHolder[],
  options?: { readonly pin?: UpdateTagPin; readonly fellBackToCurrentCopy?: boolean },
): UpdateConstraintVerdict {
  return {
    kind: "admits",
    range,
    holders,
    ...(options?.pin !== undefined && { pin: options.pin }),
    fellBackToCurrentCopy: options?.fellBackToCurrentCopy === true,
    disclosure: describeConstraint(holders, {
      arm: options?.pin === undefined ? "range-only" : "already-resolved",
    }),
  };
}

/**
 * The hold an unreachable tag listing produces: a repository that could not
 * be reached has not told us anything, so the line names the transport
 * classification instead of the declared ranges.
 */
export function transportHeld(
  holders: readonly ConstraintHolder[],
  classification: string,
): UpdateConstraintVerdict {
  return { kind: "held", cause: describeConstraint(holders, { arm: "transport", classification }) };
}

/**
 * Folds what the scope's records declare about the target into a verdict,
 * listing no tag (D-23): `held` when the declared ranges cannot be combined,
 * `unconstrained` when no declared range narrows the target, otherwise a
 * range-only `admits` with no pin.
 *
 * `state` is the ONE scope document the declarations were walked over, so
 * the holders are scope-local by construction (D-10-07).
 */
export function foldDeclaredConstraint(
  declarations: ReadonlyMap<string, readonly AddressedDependency[]>,
  state: ExtensionState,
  plugin: string,
  marketplace: string,
): UpdateConstraintVerdict {
  const holders = collectHolders(declarations, state, recordKey(plugin, marketplace));
  // A declaration HOLDS the key whatever it names, but only a declared RANGE
  // constrains a version: a holder with no `range` stays in `holders` for
  // the cause line and is left out of the fold below.
  const ranges = holders.flatMap((holder) => (holder.range === undefined ? [] : [holder.range]));
  const fold = intersectDependencyRanges(ranges);
  if (!fold.ok) {
    return { kind: "held", cause: describeConstraint(holders, { arm: fold.reason }) };
  }

  if (isUnconstrainedRange(fold.range)) {
    return { kind: "unconstrained" };
  }

  return admitsRange(fold.range, holders);
}

/**
 * Stage two: re-checks the version that actually landed against the SAME
 * intersected range stage one already computed (UPDT-01, D-10-01). Catches a
 * no-tag repository and a drifted path-source current copy -- the two cases
 * a tag probe cannot answer on its own. PURE: no I/O, no seam, and no second
 * range fold -- `admits.range` is the fold stage one already produced.
 *
 * A version that fails the fold is held naming only the holders whose OWN
 * declared range rejects it (`!recordedVersionSatisfies(toVersion,
 * holder.range)`), never the whole holder set: a holder whose own range the
 * fetched version DOES satisfy would send the user to the wrong plugin. A
 * holder with no declared range never rejects -- it has nothing to test the
 * version against.
 */
export function admitResolvedVersion(
  admits: Extract<UpdateConstraintVerdict, { readonly kind: "admits" }>,
  toVersion: string,
): StageTwoVerdict {
  if (recordedVersionSatisfies(toVersion, admits.range)) {
    return { kind: "admitted" };
  }

  // The rejecting set is never empty here, so the line always has a subject
  // behind `-- required by`. `admits.range` IS the intersection of the
  // holders' own declared ranges, and a version outside an intersection is
  // outside at least one of its members. An `admits` verdict only exists once
  // that intersection is narrower than `*`, and a holder set whose members
  // all declared no range folds to `*` and returns `unconstrained` instead,
  // so at least one declared range is always in play.
  const rejecting = admits.holders.filter(
    (holder) => holder.range !== undefined && !recordedVersionSatisfies(toVersion, holder.range),
  );
  return {
    kind: "held",
    cause: describeConstraint(rejecting, { arm: "out-of-range", version: toVersion }),
  };
}

/** The declaration walk `evaluateCatalogConstraint` composes, injectable for tests. */
export interface CatalogConstraintSeam {
  readonly buildScopeDeclarationDetail: typeof buildScopeDeclarationDetail;
}

/** Inputs required to judge one plugin's declared constraints with no tag search. */
export interface CatalogConstraintOptions {
  readonly plugin: string;
  readonly marketplace: string;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly seam?: CatalogConstraintSeam;
}

const REAL_CATALOG_CONSTRAINT_SEAM: CatalogConstraintSeam = Object.freeze({
  buildScopeDeclarationDetail,
});

/**
 * D-23: what the target's installed dependents hold it to, judged with no tag
 * search. Walks the ONE scope document the caller loaded (D-10-07) and folds
 * the declared ranges, so an `admits` verdict carries no pin and stage two
 * judges the catalog version itself.
 *
 * Rejects with `DependencyDeclarationsUnreadableError` when the walk cannot
 * read a recorded plugin's declarations (D-18-17). The walk's own message is
 * the rendered cause line: it carries no load-error text and chains no
 * `{ cause }`, so the renderer's cause-chain walk cannot print a path or
 * parser text behind it.
 */
export async function evaluateCatalogConstraint(
  options: CatalogConstraintOptions,
): Promise<UpdateConstraintVerdict> {
  const seam = options.seam ?? REAL_CATALOG_CONSTRAINT_SEAM;
  const walked = await seam.buildScopeDeclarationDetail({
    state: options.state,
    locations: options.locations,
  });
  if (!walked.ok) {
    throw new DependencyDeclarationsUnreadableError(walked.declarer, walked.cause.message);
  }

  return foldDeclaredConstraint(
    walked.declarations,
    options.state,
    options.plugin,
    options.marketplace,
  );
}
