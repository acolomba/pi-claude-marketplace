import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import {
  DependencyCascadeError,
  DirectoryPinUnsatisfiedError,
  InstallMarketplaceAddError,
} from "../../shared/errors.ts";
import { classifyGitHostFailure } from "../../shared/git-failure-classifiers.ts";
import { printable } from "../../shared/notification-mcp.ts";
import { companionSeverity, skipSeverity } from "../../shared/notify-reasons.ts";
import { redactAbsolutePaths, redactCauseChain } from "../../shared/redact-absolute-paths.ts";

import { INSTALL_CONTEXT } from "./install.messaging.ts";

import type {
  CascadeConstraintFailure,
  CascadeSkippedMember,
  Unmaterialized,
} from "./install-cascade.ts";
import type { InstallMsg } from "./install.messaging.ts";
import type { DependencyClosureResult } from "../../domain/dependency-closure.ts";
import type { SoftDepStatus } from "../../platform/pi-api.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type {
  ContentReason,
  PluginFailedMessage,
  PluginInstalledMessage,
  PluginSkippedMessage,
  PluginUpdatedMessage,
} from "../../shared/notification-types.ts";
import type { CommandContext } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";
import type { RollbackPartial } from "../../transaction/phase-ledger.ts";
import type { UpdateDependencyRow } from "../types.ts";

/**
 * install-cascade.messaging.ts -- the command-local notification vocabulary for
 * the dependency cascade (RESV-01 / RESV-06).
 *
 * The cascade's per-member statuses are COMMAND-PRIVATE and live here: a
 * cascade row is an install row plus the one RESV-05 skip, which is a fact about
 * how THIS command treated one closure member and not a new member of any shared
 * closed set. The row layout stays central in `shared/notification-grammar.ts`
 * (D-notification-refactor-01-11); this module declares only the per-status reason policy and writes no
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
 *   for instead of vanishing behind a dependency's name. Every other member
 *   the install would have installed and did not gets the same
 *   `{dependency failed}` row with no cause, as Claude Code names every member
 *   on success (CAS-01, D-PL3-02).
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
type CascadeMemberStatus = InstallMsg["status"] | "skipped" | "updated";

/**
 * The cascade block's row union: install's own rows plus the RESV-05 skip.
 *
 * `dependencies` stays REQUIRED on the `installed` arm exactly as it is on
 * install's, so a materialized dependency that staged agents or MCP servers
 * fires the same `{requires pi-...}` marker an ordinary install row does.
 */
export type CascadeMsg = InstallMsg | PluginSkippedMessage | PluginUpdatedMessage;

/**
 * D-04 / D-05: the cascade's `CommandContext`. The label is install's own --
 * the cascade IS an install, and a second operation name would read as a second
 * command in the trailing tally the label feeds.
 *
 * Install's row policies are SPREAD rather than re-declared, so every status the
 * requesting plugin's row can take resolves identically whether or not the
 * plugin declared dependencies. The one added status takes the central
 * `skipped` policy.
 */
export const CASCADE_CONTEXT = {
  Messaging: { label: INSTALL_CONTEXT.Messaging.label },
  rowPolicies: {
    ...INSTALL_CONTEXT.rowPolicies,
    skipped: { markers: false, contentReasons: true },
    // UPD-DEP-D1: a dependency moved into the range before the install.
    updated: { markers: true, contentReasons: true },
  },
} as const satisfies CommandContext<CascadeMemberStatus>;

/** One member the cascade materialized, as the row composer needs to read it. */
export interface CascadeInstalledRow {
  readonly key: string;
  readonly version: string;
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  readonly declaresWorkflows: boolean;
  /**
   * TAGS-02: whether this member installed the marketplace's current copy
   * because no tag satisfied its constraint, rather than a pin.
   *
   * REQUIRED, not optional, on the same D-07 rationale as
   * `CascadeMemberOutcome.fellBackToCurrentCopy`: a hand-built row that omits
   * it is a compile error rather than a silently unreported fact.
   */
  readonly fellBackToCurrentCopy: boolean;
  /**
   * EDEP-03 / D-08-02: whether this member was already installed and
   * DISABLED, and this run turned it back on through its own record.
   *
   * REQUIRED on the same D-07 rationale as `fellBackToCurrentCopy`: a
   * hand-built row that omits it is a compile error rather than a silently
   * unreported fact.
   */
  readonly reEnabledFromRecord: boolean;
}

/**
 * Why a cascade failed, as the row composer needs to read it.
 *
 * The `member` arm carries the failing member's OWN ledger error rather than a
 * text rendering of it, so its cause chain reaches the user intact -- the row is
 * reporting exactly the failure a single-plugin install of that dependency would
 * have reported.
 *
 * A `closure` or `constraint` failure may list the members the install would
 * have installed and did not (CAS-01). The list is optional here because a
 * subject built outside the cascade has none to give.
 */
export type CascadeFailureSubject =
  | {
      readonly kind: "closure";
      readonly failure: Extract<DependencyClosureResult, { readonly ok: false }> &
        Partial<Unmaterialized>;
    }
  | {
      readonly kind: "constraint";
      readonly failure: CascadeConstraintFailure & Partial<Unmaterialized>;
    }
  | {
      readonly kind: "member";
      readonly key: string;
      readonly error: Error;
      readonly rollbackPartials: readonly RollbackPartial[];
      readonly unmaterialized?: readonly string[];
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
    ...(member.declaresWorkflows ? (["workflows"] as const) : []),
  ];
}

/**
 * One materialized closure member's row: installed fresh, or turned back on
 * through its own disabled record. UPD-DEP-D1: an update's dependency rows are
 * these rows too.
 */
export function composeCascadeMemberRow(
  member: CascadeInstalledRow,
  probe: SoftDepStatus,
): PluginInstalledMessage {
  return {
    status: "installed",
    name: member.key,
    dependencies: stagedDependencies(member),
    version: member.version,
    // TAGS-02 / D-07-03: the fallback names itself on the row but never
    // touches severity -- that stays exactly what `companionSeverity`
    // computes, so a member with an unloaded companion still reports the
    // genuine SEV-01 degradation the fallback must not paper over.
    ...(member.fellBackToCurrentCopy && { reasons: ["dependency current copy"] as const }),
    // D-08-02: a member re-materialized through its own disabled record
    // reports both what was already true and what this command is
    // responsible for, on the same split the promotion row's own
    // `["already installed", "dependency promoted"]` pair already sets out
    // -- never alongside the fallback token above, since a member is either
    // freshly resolved (possibly falling back) or already-installed and
    // disabled, never both.
    ...(member.reEnabledFromRecord && {
      reasons: ["already installed", "dependency enabled"] as const,
    }),
    severity: companionSeverity(
      {
        declaresAgents: member.declaresAgents,
        declaresMcp: member.declaresMcp,
        declaresWorkflows: member.declaresWorkflows,
      },
      probe,
    ),
    needsReload: true,
  };
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
  /** UPD-DEP-D1: the rows of the dependencies moved into range first. */
  readonly moved?: readonly UpdateDependencyRow[];
}): readonly CascadeMsg[] {
  const rows: CascadeMsg[] = [args.rootRow, ...(args.moved ?? [])];
  for (const member of args.installed) {
    if (member.key === args.rootKey) {
      continue;
    }

    rows.push(composeCascadeMemberRow(member, args.probe));
  }

  // UPD-DEP-D1: a dependency moved into range reports its move, not a skip.
  const moved = new Set((args.moved ?? []).map((row) => row.name));
  for (const member of args.alreadyInstalled.filter((entry) => !moved.has(entry.key))) {
    // RESV-05: every member reaching this loop is left-alone and ENABLED --
    // the cascade's walk never skips a disabled record, which re-enables as a
    // member of the `installed` loop above instead (EDEP-03) -- so the skip
    // is uniformly the benign idempotent one.
    const reasons: ContentReason[] = ["already installed"];
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

/** D-PL3-14: Claude Code's wording for the half of an id that breaks the token rule. */
const INVALID_ID_HALVES = {
  plugin: "the plugin's name does not; the marketplace's maintainer can rename it",
  marketplace: "the marketplace's name does not; the marketplace's maintainer can rename it",
  both: "they do not; the marketplace's maintainer can rename both",
} as const satisfies Record<
  Extract<DependencyClosureResult, { readonly reason: "invalid-root-id" }>["invalidPart"],
  string
>;

/**
 * The subject, brace and cause a closure failure resolves to.
 *
 * The exhaustive `switch` deliberately has no runtime default: under
 * `noImplicitReturns`, any future `DependencyClosureResult` failure reason
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
    case "cross-marketplace":
      return {
        key: failure.key,
        reasons: ["cross-marketplace"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}", declared by "${failure.requiredBy}", is from marketplace "${failure.marketplace}", which root marketplace "${failure.rootMarketplace}" does not allow. Install "${failure.key}" manually first, or add "${failure.marketplace}" to allowCrossMarketplaceDependenciesOn in the marketplace.json for root marketplace "${failure.rootMarketplace}".`,
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
    case "invalid-root-id":
      // CAS-02 / D-PL3-04: the id is outside the token allowlist by
      // definition, so it is printed with its control and format characters
      // escaped (D-PL3-14).
      return {
        key: failure.key,
        reasons: ["invalid manifest"],
        cause: new DependencyCascadeError(
          `Plugin "${printable(failure.key)}" cannot be installed, because its id is invalid: Each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here ${INVALID_ID_HALVES[failure.invalidPart]}.`,
          failure.key,
        ),
      };
  }
}

/**
 * RESV-05 / UPD-DEP-D1: the sentence for an installed copy outside the range.
 * When a move was judged and the plugin the user named declares the
 * dependency itself, the cause ends with Claude Code's next step, as Claude
 * Code adds it only under that condition (CAS-06, D-PL3-11). The hint names
 * only the dependency key, which the walk checked against the token allowlist.
 */
function installedUnsatisfiedCause(
  failure: Extract<CascadeConstraintFailure, { readonly why: "installed-unsatisfied" }>,
  rootKey: string,
): string {
  const head = `Dependency "${failure.key}" is installed at version ${failure.recordedVersion}, which does not satisfy ${failure.range}`;
  if (failure.moveRefusal === undefined) {
    return `${head}.`;
  }

  const refused = `${head}, and cannot move: ${failure.moveRefusal}`;
  if (failure.declaredBy?.includes(rootKey) !== true) {
    return refused;
  }

  const separator = failure.moveRefusal.endsWith(".") ? "" : ".";
  return `${refused}${separator} To look for a version in range, run /claude:plugin update ${failure.key}.`;
}

/** The two `range-conflict` arms, which differ in subject rather than in fact. */
function rangeConflictFacts(
  failure: Extract<CascadeConstraintFailure, { readonly kind: "range-conflict" }>,
  rootKey: string,
): CascadeFailureFacts {
  return failure.why === "installed-unsatisfied"
    ? {
        key: failure.key,
        version: failure.recordedVersion,
        reasons: ["already installed", "version conflict"],
        cause: new DependencyCascadeError(installedUnsatisfiedCause(failure, rootKey), failure.key),
      }
    : {
        key: failure.key,
        reasons: ["version conflict"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" has contradictory version constraints ${failure.range} (${failure.detail}).`,
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
function constraintFailureFacts(
  failure: CascadeConstraintFailure,
  rootKey: string,
): CascadeFailureFacts {
  switch (failure.kind) {
    case "range-conflict":
      return rangeConflictFacts(failure, rootKey);
    case "no-matching-tag":
      return {
        key: failure.key,
        reasons: ["no matching version"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" has no release tag satisfying ${failure.range}.`,
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
          `Dependency "${failure.key}" could not be checked against ${failure.range} (${failure.classification ?? "tag listing failed"}).`,
          failure.key,
        ),
      };
    case "range-invalid":
      return {
        key: failure.key,
        reasons: ["invalid version constraint"],
        cause: new DependencyCascadeError(
          `Dependency "${failure.key}" declares an unparseable version constraint ${failure.range} (${failure.detail}).`,
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
 * the same as `subject.error`'s own, except that every absolute path is cut to
 * its basename, as a dependency move's failure row cuts it (T-03-48): a
 * dependency's ledger error can name a path inside the scope's staging area.
 */
function memberCause(
  subject: Extract<CascadeFailureSubject, { readonly kind: "member" }>,
  rootKey: string,
): Error {
  if (subject.key === rootKey) {
    return subject.error;
  }

  const cause = redactCauseChain(subject.error.cause);
  return new DependencyCascadeError(
    redactAbsolutePaths(subject.error.message),
    subject.key,
    cause === undefined ? undefined : { cause },
  );
}

/**
 * The member arm's brace: a rollback partial, else the reason a direct install
 * reads -- a failed marketplace add's own reason, or the git host's refusal.
 */
function memberReasons(
  subject: Extract<CascadeFailureSubject, { readonly kind: "member" }>,
): readonly ContentReason[] {
  if (subject.rollbackPartials.length > 0) {
    return ["rollback partial"];
  }

  if (subject.error instanceof InstallMarketplaceAddError) {
    return [subject.error.reason];
  }

  // GV-01: a plugin directory copy outside its dependents' range.
  if (subject.error instanceof DirectoryPinUnsatisfiedError) {
    return ["version conflict"];
  }

  const gitReason = classifyGitHostFailure(subject.error);
  return gitReason !== undefined ? [gitReason] : [];
}

/** The subject, brace and cause any cascade failure resolves to. */
function failureFacts(subject: CascadeFailureSubject, rootKey: string): CascadeFailureFacts {
  if (subject.kind === "closure") {
    return closureFailureFacts(subject.failure, rootKey);
  }

  if (subject.kind === "constraint") {
    return constraintFailureFacts(subject.failure, rootKey);
  }

  // The member resolved cleanly and its own six-phase ledger then failed, so
  // there is no cascade reason to add -- the ledger's error IS the fact. A
  // rollback that could not finish is named on the same terms the
  // single-plugin failure row names it; otherwise a git host that refused the
  // member's clone reads the reason a direct install reads (INR-01), and any
  // other throw leaves the empty brace the renderer suppresses.
  return {
    key: subject.key,
    reasons: memberReasons(subject),
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

/** CAS-01: the members a subject lists as never installed; none when it carries no list. */
function unmaterializedOf(subject: CascadeFailureSubject): readonly string[] {
  const listed =
    subject.kind === "member" ? subject.unmaterialized : subject.failure.unmaterialized;
  return listed ?? [];
}

/**
 * CAS-01 / D-PL3-02: one cause-less `{dependency failed}` row per member the
 * install would have installed and did not. The failing member, the root, and
 * every `moved` key are excluded, because each already has its row (D-PL3-15).
 */
function unmaterializedRows(
  subject: CascadeFailureSubject,
  reported: readonly string[],
): PluginFailedMessage[] {
  return unmaterializedOf(subject)
    .filter((key) => !reported.includes(key))
    .map((key) => ({
      status: "failed",
      name: key,
      reasons: ["dependency failed"],
      severity: "error",
      needsReload: false,
    }));
}

/**
 * RESV-06: the failing dependency as the row's subject, with the requesting
 * plugin's own row beside it, and a `{dependency failed}` row with no cause for
 * every other member the install would have installed and did not (CAS-01,
 * D-PL3-01).
 *
 * The requesting plugin's second row is omitted when the failing subject IS
 * the requesting plugin (an unusable declaration on its own manifest, or its
 * own ledger throwing), because there is no dependency to distinguish it from
 * and one subject cannot be the reason for itself.
 *
 * `moved` holds the moved rows the caller appends beside these rows; the key
 * each one names gets no second, `{dependency failed}` row (D-PL3-15).
 */
export function composeCascadeFailureMessage(args: {
  readonly scope: Scope;
  readonly rootKey: string;
  readonly rootName: string;
  readonly subject: CascadeFailureSubject;
  readonly moved?: readonly { readonly name: string }[];
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
  const members = unmaterializedRows(args.subject, [
    facts.key,
    args.rootKey,
    ...(args.moved ?? []).map((row) => row.name),
  ]);
  if (isRoot) {
    return sortRows([failed, ...members], args.scope);
  }

  const root: PluginFailedMessage = {
    status: "failed",
    name: args.rootName,
    reasons: ["dependency failed"],
    severity: "error",
    needsReload: false,
  };
  return sortRows([failed, root, ...members], args.scope);
}
