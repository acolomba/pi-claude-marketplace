// orchestrators/plugin/update-constraint-gate.ts
//
// Answers what the installed records that declare a plugin hold it to: the
// gate `preparePluginUpdate` composes before resolving an update candidate,
// so a plugin's version never moves outside what its own dependents allow
// (UPDT-01, UPDT-02).
//
// Deliberately ABSENT from `tests/architecture/gate-targets.ts`'s
// `NETWORK_FREE_TARGETS`, for the same reason its future tag-probe callees
// will be (D-10-19): stage one's tag query (plan 10-02) reaches the network
// from inside this leaf, and `update-preflight.ts` composes and invokes it
// through the `constraintGate` injected field -- a name the network-free
// gate does not match -- so neither owner gains a git surface and no gate
// edit is needed.
//
// AUTH-09: the credential bundle is threaded in through `options.auth` from
// the caller, which builds it once and shares it with the clone probe; this
// leaf reads no credential value, stores none, and places none on a
// returned verdict.
//
// The range algebra is `intersectDependencyRanges` alone: the two
// project-owned caps on total input size and projected conjuncts live
// there, and calling `semver` directly from this leaf would bypass both.

import {
  intersectDependencyRanges,
  isUnconstrainedRange,
  renderConstraintRange,
} from "../../domain/dependency-range.ts";
import { isRecordedButDisabled } from "../../persistence/state-io.ts";

import { buildScopeDeclarationDetail } from "./dependency-index.ts";

import type { AddressedDependency } from "./dependency-index.ts";
import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { ReleaseTagCandidate } from "../../domain/release-tag.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { RemoteTag } from "../../platform/git.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

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
 * The declaration-walk operation this leaf inverts, injectable for tests.
 * Stage one's tag probes (plan 10-02) join this seam once they land; this
 * plan declares it with `buildScopeDeclarationDetail` alone.
 */
export interface UpdateConstraintSeam {
  readonly buildScopeDeclarationDetail: typeof buildScopeDeclarationDetail;
}

/** Inputs required to evaluate one plugin's declared constraints. */
export interface UpdateConstraintOptions {
  readonly plugin: string;
  readonly marketplace: string;
  readonly entry: PluginEntry;
  readonly marketplaceRoot: string;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly seam?: UpdateConstraintSeam;
  /**
   * Per-URL tag-listing memo, one cascade run wide (D-10-18). Declared here
   * so plan 10-02's stage-one probe needs no options widening; this plan
   * never reads it.
   */
  readonly tagMemo?: Map<string, readonly RemoteTag[]>;
  /** The path-source analogue of `tagMemo` (D-10-18), same status. */
  readonly marketplaceTagMemo?: Map<string, readonly ReleaseTagCandidate[]>;
  readonly auth: {
    readonly ctx?: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

/** What the target's installed dependents hold it to. */
export type UpdateConstraintVerdict =
  | { readonly kind: "unconstrained" }
  | {
      readonly kind: "admits";
      readonly range: string;
      readonly holders: readonly ConstraintHolder[];
      readonly pin?: { readonly oid: string; readonly version: string };
      readonly fellBackToCurrentCopy: boolean;
    }
  | { readonly kind: "held"; readonly cause: string };

const REAL_UPDATE_CONSTRAINT_SEAM: UpdateConstraintSeam = Object.freeze({
  buildScopeDeclarationDetail,
});

/** The three ways `intersectDependencyRanges` can fail to fold a set. */
type ConstraintArm = "disjoint" | "invalid" | "too-complex";

/** Fixed clause per arm (D-10-10): the situation, never an identifier. */
const ARM_CLAUSE: Record<ConstraintArm, string> = {
  disjoint: "the declared ranges admit no version in common",
  invalid: "a declared range could not be read",
  "too-complex": "the declared ranges are too complex to combine",
};

function nameHolder(holder: ConstraintHolder): string {
  return holder.disabled ? `"${holder.key}" (currently disabled)` : `"${holder.key}"`;
}

/**
 * Composes the ONE cause line every constraint arm shares (D-10-11): a fixed
 * arm clause, the bounded diagnostic detail behind it, and the declaring
 * plugins in walk order, each marked when currently disabled. Plans 10-02
 * and 10-03 add arms to this composer rather than writing their own -- the
 * holder-naming half is identical across all of them, so a second composer
 * would be a second place to drift the disabled marking. `detail` is
 * `intersectDependencyRanges`' own diagnostic text (measurements and field
 * positions only, never a declared range's raw content), passed through
 * `renderConstraintRange` so a synthesized detail cannot flood the line.
 */
// fallow-ignore-next-line unused-export -- production reaches this through the "held" arm below in the same module; exported so the paired test drives it directly, and plans 10-02/10-03 add arms to it.
export function describeConstraint(
  detail: string,
  holders: readonly ConstraintHolder[],
  // fallow-ignore-next-line private-type-leak -- ConstraintArm enumerates intersectDependencyRanges' own failure reasons; callers pass the string literals it already emits.
  arm: ConstraintArm,
): string {
  const bounded = renderConstraintRange(detail);
  const required = holders.map(nameHolder).join(", ");
  return `${ARM_CLAUSE[arm]} (${bounded}) -- required by ${required}`;
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
 * Evaluates what the target plugin's installed dependents hold it to.
 *
 * The `state` walked is the ONE document the caller already loaded for the
 * target scope: this leaf never loads a second scope's state, so constraints
 * are scope-local by construction (D-10-07). `entry`, `marketplaceRoot`,
 * `tagMemo`, `marketplaceTagMemo` and `auth` are unread by this plan's stage
 * -- they carry the stage-one tag probe's own inputs forward for plan 10-02.
 */
export async function evaluateUpdateConstraint(
  options: UpdateConstraintOptions,
): Promise<UpdateConstraintVerdict> {
  const seam = options.seam ?? REAL_UPDATE_CONSTRAINT_SEAM;
  const target = recordKey(options.plugin, options.marketplace);

  const walked = await seam.buildScopeDeclarationDetail({
    state: options.state,
    locations: options.locations,
  });
  if (!walked.ok) {
    // D-10-05: the walk's own message IS the rendered cause line -- it is
    // already path-redacted and built without `{ cause }` chaining, so the
    // renderer's cause-chain walk cannot print a raw path behind it.
    // Re-wrapping it here would reintroduce exactly that. This is the same
    // fail-closed model the uninstall refusal uses on an unreadable
    // declarer, and differs from it only in outcome: an update is SKIPPED
    // here, never refused.
    return { kind: "held", cause: walked.cause.message };
  }

  const holders = collectHolders(walked.declarations, options.state, target);
  // A declaration HOLDS the key whatever it names, but only a declared RANGE
  // constrains a version: a holder with no `range` stays in `holders` for
  // the cause line and is left out of the fold below.
  const ranges = holders.flatMap((holder) => (holder.range === undefined ? [] : [holder.range]));
  const fold = intersectDependencyRanges(ranges);
  if (fold.ok) {
    return isUnconstrainedRange(fold.range)
      ? { kind: "unconstrained" }
      : { kind: "admits", range: fold.range, holders, fellBackToCurrentCopy: false };
  }

  return { kind: "held", cause: describeConstraint(fold.detail, holders, fold.reason) };
}
