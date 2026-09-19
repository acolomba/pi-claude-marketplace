import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import { DependencyCascadeError } from "../../shared/errors.ts";
import { ICON_UNINSTALLABLE, pluginRow } from "../../shared/notification-grammar.ts";
import { companionSeverity, skipSeverity } from "../../shared/notify-reasons.ts";

import { INSTALL_CONTEXT } from "./install.messaging.ts";

import type { CascadeConstraintFailure, CascadeSkippedMember } from "./install-cascade.ts";
import type { InstallMsg } from "./install.messaging.ts";
import type { DependencyClosureResult } from "../../domain/dependency-closure.ts";
import type { SoftDepStatus } from "../../platform/pi-api.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type {
  ContentReason,
  PluginFailedMessage,
  PluginSkippedMessage,
} from "../../shared/notification-types.ts";
import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";
import type { RollbackPartial } from "../../transaction/phase-ledger.ts";

/**
 * install-cascade.messaging.ts -- the command-local notification vocabulary for
 * the dependency cascade (RESV-01 / RESV-06).
 *
 * The cascade's per-member statuses are COMMAND-PRIVATE and live here: a
 * cascade row is an install row plus the one RESV-05 skip, which is a fact about
 * how THIS command treated one closure member and not a new member of any shared
 * closed set. The shared presentation vocabulary stays central in
 * `shared/notification-grammar.ts` (D-11); this module CALLS it and writes no
 * row builder of its own. The reason tokens the failure rows carry ARE shared
 * closed-set members, declared in `shared/notification-types.ts::REASONS` and
 * pinned by enumeration -- no row here composes prose of its own for the brace.
 *
 * Three conventions are this block's and belong here rather than in the
 * orchestrator that emits it:
 *
 *   Subjects. A dependency renders by its full `<plugin>@<marketplace>` key,
 *   because it may resolve from a marketplace other than the block header's.
 *   The requesting plugin renders by its bare name, because the header already
 *   names its marketplace.
 *
 *   Order. Rows go through the project's canonical name-then-scope comparator,
 *   so the requesting plugin takes its alphabetical place among the members. One
 *   cascade's members all land in the requesting plugin's own scope (D-03-05),
 *   so the comparator's scope half never separates them and no row carries a
 *   `[scope]` bracket.
 *
 *   Failure attribution (RESV-06). The row carrying the reason is the
 *   DEPENDENCY's. The requesting plugin still gets its own row, stamped
 *   `{dependency failed}`, so the command the user typed is visibly accounted
 *   for instead of vanishing behind a dependency's name.
 *
 * Every value a row interpolates is a token-allowlisted plugin key, a bounded
 * rendered constraint, a recorded version, a validator field path, or a
 * closed-set classification -- so no cascade row can carry manifest prose or a
 * filesystem path.
 */

/**
 * The cascade block's own status set.
 *
 * `skipped` is the one status the cascade adds: RESV-05 found the dependency
 * already present in the target scope, CHECKED it against the effective
 * constraint, and left it exactly as it was. It is what makes "installed by this
 * command" readable apart from "already here".
 *
 * The rest are install's own statuses, UNIONED IN rather than restated. The
 * requesting plugin's row is composed by install's existing composers and lands
 * in this same block, so restating the list here would be a second copy free to
 * drift from the one the install surface is checked against.
 */
type CascadeMemberStatus = InstallMsg["status"] | "skipped";

/**
 * The cascade block's row union: install's own rows plus the RESV-05 skip.
 *
 * `dependencies` stays REQUIRED on the `installed` arm exactly as it is on
 * install's, so a materialized dependency that staged agents or MCP servers
 * fires the same `{requires pi-...}` marker an ordinary install row does.
 */
export type CascadeMsg = InstallMsg | PluginSkippedMessage;

/**
 * Render map total over the cascade's OWN statuses: omitting an arm is a TS2741
 * compile error at the `satisfies` site below.
 *
 * Install's map is SPREAD rather than re-declared, so every arm the requesting
 * plugin's row can take renders byte-identically whether or not the plugin
 * declared dependencies. The one added arm calls the shared `pluginRow`
 * composer, which is the same call the central switch's `skipped` arm makes.
 */
const CASCADE_RENDER: {
  [K in CascadeMemberStatus]: RenderFn<Extract<CascadeMsg, { status: K }>>;
} = {
  ...INSTALL_CONTEXT.render,
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
};

/**
 * D-04 / D-05: the cascade's `CommandContext`. The label is install's own --
 * the cascade IS an install, and a second operation name would read as a second
 * command in the trailing tally the label feeds.
 */
export const CASCADE_CONTEXT = {
  Messaging: { label: INSTALL_CONTEXT.Messaging.label },
  render: CASCADE_RENDER,
} as const satisfies CommandContext<CascadeMemberStatus, CascadeMsg>;

/** One member the cascade materialized, as the row composer needs to read it. */
export interface CascadeInstalledRow {
  readonly key: string;
  readonly version: string;
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  /**
   * TAGS-02: whether this member installed the marketplace's current copy
   * because no tag satisfied its constraint, rather than a pin.
   *
   * REQUIRED, not optional, on the same D-07 rationale as
   * `CascadeMemberOutcome.fellBackToCurrentCopy`: a hand-built row that omits
   * it is a compile error rather than a silently unreported fact.
   */
  readonly fellBackToCurrentCopy: boolean;
}

/**
 * Why a cascade failed, as the row composer needs to read it.
 *
 * The `member` arm carries the failing member's OWN ledger error rather than a
 * text rendering of it, so its cause chain reaches the user intact -- the row is
 * reporting exactly the failure a single-plugin install of that dependency would
 * have reported.
 */
export type CascadeFailureSubject =
  | {
      readonly kind: "closure";
      readonly failure: Extract<DependencyClosureResult, { readonly ok: false }>;
    }
  | { readonly kind: "constraint"; readonly failure: CascadeConstraintFailure }
  | {
      readonly kind: "member";
      readonly key: string;
      readonly error: Error;
      readonly rollbackPartials: readonly RollbackPartial[];
    };

/** The subject key, brace and cause one cascade failure resolves to. */
interface CascadeFailureFacts {
  readonly key: string;
  readonly reasons: readonly ContentReason[];
  readonly cause: Error;
  readonly version?: string;
  readonly rollbackPartials?: readonly RollbackPartial[];
}

/**
 * Canonical row order for one cascade block.
 *
 * Every row is passed the SAME scope because D-03-05 puts every member of one
 * cascade in the requesting plugin's scope; the comparator's scope half is
 * therefore inert here by construction, and the ordering that reaches the user
 * is the name half. Calling the shared comparator rather than sorting by name
 * locally is what keeps this block ordered the way every other multi-row
 * surface is.
 */
function sortRows(rows: readonly CascadeMsg[], scope: Scope): readonly CascadeMsg[] {
  return [...rows].sort((a, b) =>
    compareByNameThenScope({ name: a.name, scope }, { name: b.name, scope }),
  );
}

/** The soft-dependency kinds a materialized member staged, in probe order. */
function stagedDependencies(member: CascadeInstalledRow): readonly Dependency[] {
  return [
    ...(member.declaresAgents ? (["agents"] as const) : []),
    ...(member.declaresMcp ? (["mcp"] as const) : []),
  ];
}

/**
 * RESV-01 / RESV-05 / RESV-06: one row per closure member, beside the requesting
 * plugin's own row.
 *
 * The requesting plugin's row arrives already composed, because what it says
 * depends on how its own install landed (clean, degraded, or disabled on its
 * author's declaration) and that verdict belongs to the install surface. A
 * member whose key IS the root is dropped from `installed`: the cascade's phase
 * array ends at the root, so it appears in both lists and would otherwise
 * render twice.
 *
 * SEV-01: a materialized member with a declared-but-unloaded companion is a
 * silent degradation exactly as it is for the plugin the user named, so its row
 * stamps the same `companionSeverity` verdict rather than a flat info.
 */
export function composeCascadeMemberRows(args: {
  readonly scope: Scope;
  readonly rootKey: string;
  readonly rootRow: InstallMsg;
  readonly installed: readonly CascadeInstalledRow[];
  readonly alreadyInstalled: readonly CascadeSkippedMember[];
  readonly probe: SoftDepStatus;
}): readonly CascadeMsg[] {
  const rows: CascadeMsg[] = [args.rootRow];
  for (const member of args.installed) {
    if (member.key === args.rootKey) {
      continue;
    }

    rows.push({
      status: "installed",
      name: member.key,
      dependencies: stagedDependencies(member),
      version: member.version,
      // TAGS-02 / D-07-03 / WR-05: the requesting plugin installed against a
      // dependency at an unverified version -- the same shape `skipSeverity`
      // already raises to `warning` for a non-idempotent skip reason, so the
      // fallback raises the same way rather than reporting at the same
      // severity as a clean, fully-constrained install. `companionSeverity`'s
      // range tops out at `warning` too, so this never UNDER-reports a
      // member that also carries an unloaded-companion degradation.
      ...(member.fellBackToCurrentCopy && { reasons: ["dependency current copy"] as const }),
      severity: member.fellBackToCurrentCopy
        ? "warning"
        : companionSeverity(
            { declaresAgents: member.declaresAgents, declaresMcp: member.declaresMcp },
            args.probe,
          ),
      needsReload: true,
    });
  }

  for (const member of args.alreadyInstalled) {
    // RESV-05: a disabled record keeps its inventory and its name reservations
    // while its artifacts are off disk, so `already installed` alone is true
    // and misleading together -- the requesting plugin installed against a
    // dependency that materialized nothing. The second token names that, and
    // `skipSeverity` reads the pair rather than the producer asserting a
    // verdict beside them: `already installed` alone is the benign idempotent
    // skip and stays `info`, and anything else is actionable.
    const reasons: ContentReason[] = member.disabled
      ? ["already installed", "dependency disabled"]
      : ["already installed"];
    rows.push({
      status: "skipped",
      name: member.key,
      ...(member.version !== undefined && { version: member.version }),
      reasons,
      severity: skipSeverity(reasons),
    });
  }

  return sortRows(rows, args.scope);
}

/**
 * The subject, brace and cause a closure failure resolves to.
 *
 * The exhaustive `switch` deliberately has no runtime default: under
 * `noImplicitReturns`, a future fifth `DependencyClosureResult` failure reason
 * makes this function fail typecheck instead of falling through to a `default`
 * arm no case can ever reach.
 */
function closureFailureFacts(
  failure: Extract<DependencyClosureResult, { readonly ok: false }>,
  rootKey: string,
): CascadeFailureFacts {
  switch (failure.reason) {
    case "cycle": {
      // The subject is the key the walk met a second time on its own ancestor
      // chain, which the walk reports as the chain's last element. A chain the
      // walk never populated falls back to the root, so a defective report
      // still renders one coherent row instead of a nameless one.
      const key = failure.chain.at(-1) ?? rootKey;
      return {
        key,
        reasons: ["dependency cycle"],
        cause: new DependencyCascadeError(`Dependency cycle: ${failure.chain.join(" -> ")}.`, key),
      };
    }

    case "marketplace-not-added":
      return {
        key: failure.key,
        reasons: ["dependency marketplace not added"],
        // D-03-08: nothing adds or clones a marketplace to satisfy a
        // dependency, so the row names the command that would. `<source>` and
        // not the marketplace name, because that is what `marketplace add`
        // takes.
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" requires marketplace "${failure.marketplace}", which is not added. Run marketplace add <source> to add it.`,
          failure.key,
        ),
      };
    case "not-found":
      return {
        key: failure.key,
        reasons: ["not in manifest"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" is not declared by its marketplace.`,
          failure.key,
        ),
      };
    case "unusable-declaration":
      return {
        key: failure.key,
        reasons: ["invalid manifest"],
        cause: new DependencyCascadeError(
          `Plugin "${failure.key}" declares an unusable dependency (${failure.detail}).`,
          failure.key,
        ),
      };
  }
}

/** The two `range-conflict` arms, which differ in subject rather than in fact. */
function rangeConflictFacts(
  failure: Extract<CascadeConstraintFailure, { readonly kind: "range-conflict" }>,
): CascadeFailureFacts {
  return failure.why === "installed-unsatisfied"
    ? {
        key: failure.key,
        version: failure.recordedVersion,
        reasons: ["already installed", "version conflict"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" is installed at version ${failure.recordedVersion}, which does not satisfy "${failure.range}".`,
          failure.key,
        ),
      }
    : {
        key: failure.key,
        reasons: ["version conflict"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" has contradictory version constraints "${failure.range}" (${failure.detail}).`,
          failure.key,
        ),
      };
}

/**
 * The subject, brace and cause a constraint failure resolves to.
 *
 * The exhaustive `switch` deliberately has no runtime default: under
 * `noImplicitReturns`, a future sixth `CascadeConstraintFailure` kind makes
 * this function fail typecheck instead of falling through to a `default` arm
 * no case can ever reach.
 */
function constraintFailureFacts(failure: CascadeConstraintFailure): CascadeFailureFacts {
  switch (failure.kind) {
    case "range-conflict":
      return rangeConflictFacts(failure);
    case "no-matching-tag":
      return {
        key: failure.key,
        reasons: ["no matching version"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" has no release tag satisfying "${failure.range}".`,
          failure.key,
        ),
      };
    case "tag-listing-failed":
      return {
        key: failure.key,
        // The probe's transport classification is ALREADY a closed-set member,
        // so the row reuses it and the cascade mints nothing: a listing that
        // could not be READ is a different claim from one that held nothing
        // usable. An unclassifiable transport failure keeps the inherited
        // `unreadable`.
        reasons: [failure.classification ?? "unreadable"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" could not be checked against "${failure.range}" (${failure.classification ?? "tag listing failed"}).`,
          failure.key,
        ),
      };
    case "range-invalid":
      return {
        key: failure.key,
        reasons: ["invalid version constraint"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" declares an unparseable version constraint "${failure.range}" (${failure.detail}).`,
          failure.key,
        ),
      };
    case "range-too-complex":
      return {
        key: failure.key,
        reasons: ["constraint too complex"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" declares version constraints too complex to combine (${failure.detail}).`,
          failure.key,
        ),
      };
  }
}

/**
 * RESV-06: the member arm's cause. The requesting plugin's own ledger failure
 * (`subject.key === rootKey`) is reported unwrapped -- the ledger's error IS
 * the fact. A DEPENDENCY's ledger failure (`subject.key !== rootKey`) is
 * wrapped in `DependencyCascadeError` so an orchestrated install outcome can
 * classify as `{dependency failed}` instead of the generic `{unreadable}`
 * probe fallback (`apply-outcomes.ts::classifyOrchestratorThrow`).
 *
 * The wrapper carries `subject.error`'s OWN message and moves straight to its
 * cause, rather than chaining `subject.error` itself: chaining `subject.error`
 * directly would repeat its message as two consecutive links, because
 * `causeChainTrailer` renders a link's own message before walking its cause.
 * Skipping to `subject.error`'s cause keeps the rendered cause-chain trailer
 * byte-identical to `subject.error`'s own.
 */
function memberCause(
  subject: Extract<CascadeFailureSubject, { readonly kind: "member" }>,
  rootKey: string,
): Error {
  if (subject.key === rootKey) {
    return subject.error;
  }

  return new DependencyCascadeError(
    subject.error.message,
    subject.key,
    subject.error.cause === undefined ? undefined : { cause: subject.error.cause },
  );
}

/** The subject, brace and cause any cascade failure resolves to. */
function failureFacts(subject: CascadeFailureSubject, rootKey: string): CascadeFailureFacts {
  if (subject.kind === "closure") {
    return closureFailureFacts(subject.failure, rootKey);
  }

  if (subject.kind === "constraint") {
    return constraintFailureFacts(subject.failure);
  }

  // The member resolved cleanly and its own six-phase ledger then failed, so
  // there is no cascade reason to add -- the ledger's error IS the fact, and the
  // renderer suppresses the empty brace. A rollback that could not finish is the
  // one thing worth naming on top of it, on the same terms the single-plugin
  // failure row names it.
  return {
    key: subject.key,
    reasons: subject.rollbackPartials.length > 0 ? ["rollback partial"] : [],
    cause: memberCause(subject, rootKey),
    ...(subject.rollbackPartials.length > 0 && { rollbackPartials: subject.rollbackPartials }),
  };
}

/**
 * The Error a cascade failure is reported as when it has to be THROWN rather
 * than rendered -- the orchestrator aborts its lock closure that way, and its
 * orchestrated-mode callers read the message as their `cause` string.
 *
 * It is the SAME `Error` the rendered row carries, taken from the same facts, so
 * the text a cascade-caller reads and the text the user reads cannot drift.
 */
export function cascadeFailureCause(subject: CascadeFailureSubject, rootKey: string): Error {
  return failureFacts(subject, rootKey).cause;
}

/**
 * RESV-06: the failing dependency as the row's subject, with the requesting
 * plugin's own row beside it.
 *
 * The second row is omitted when the failing subject IS the requesting plugin
 * (an unusable declaration on its own manifest, or its own ledger throwing),
 * because there is no dependency to distinguish it from and one subject cannot
 * be the reason for itself.
 */
export function composeCascadeFailureMessage(args: {
  readonly scope: Scope;
  readonly rootKey: string;
  readonly rootName: string;
  readonly subject: CascadeFailureSubject;
}): readonly CascadeMsg[] {
  const facts = failureFacts(args.subject, args.rootKey);
  const isRoot = facts.key === args.rootKey;
  const failed: PluginFailedMessage = {
    status: "failed",
    name: isRoot ? args.rootName : facts.key,
    reasons: facts.reasons,
    ...(facts.version !== undefined && { version: facts.version }),
    ...(facts.rollbackPartials !== undefined && {
      rollbackPartial: facts.rollbackPartials.map((partial) => ({
        phase: partial.phase,
        ...(partial.cause !== undefined && { cause: partial.cause }),
      })),
    }),
    cause: facts.cause,
    severity: "error",
    needsReload: false,
  };
  if (isRoot) {
    return [failed];
  }

  const root: PluginFailedMessage = {
    status: "failed",
    name: args.rootName,
    reasons: ["dependency failed"],
    severity: "error",
    needsReload: false,
  };
  return sortRows([failed, root], args.scope);
}
