import { collectFlowObservations } from "./check-unused-type-members.flow.mjs";
import {
  AnalysisSetupError,
  collectCandidates,
  collectObservations,
  createProjectProgram,
  productionFileCount,
} from "./check-unused-type-members.model.mjs";

/**
 * Report assembly for the unused-type-member gate.
 *
 * The model module owns compiler identity, the candidate inventory and the
 * observation classifier. This module composes them into one deterministic,
 * versioned report and decides which statuses fail the run.
 */

/**
 * The analysis contract later stages read.
 *
 * - A candidate record is keyed by `id`, the stable declaration identity
 *   `path:line:column` of the member's own declaration, and carries its owner,
 *   key, key kind, optionality and category.
 * - A witness carries its own source site and its `production` or `test` origin,
 *   plus the `kind` it proves -- a `value-read` or a `presence` check -- and the
 *   `syntax` that proved it.
 * - An analysis gap is a reason string recorded against the candidates the
 *   opaque expression could have reached, and against no others.
 * - A contract decision is an `{ id, reason }` pair naming a candidate the
 *   inventory already holds.
 * - `transfers` is the directed value-transfer graph: one record per actual
 *   transfer site, naming the source expression and the place it flows into. It
 *   is part of the context handed to the contract evaluator.
 * - A witness proved through a transfer carries `via`, the site of the source
 *   expression that carried the value into the consumer that read it.
 * - `work` states what the transfer walk did: the steps it spent, the edges it
 *   indexed, the reads it traced and how long it took. It is a measurement of
 *   this run, not a threshold anything is compared against.
 *
 * `runtime-observed`, `test-only-observed` and `explicit-contract` pass;
 * `unread` and `unsupported-analysis` fail. A setup or internal analysis failure
 * is neither: it refuses to produce a report at all.
 */
const schemaVersion = 1;
const productionRoot = "extensions/pi-claude-marketplace";

// Measured against this repository: the walk visits 969,975 syntax nodes. The
// default leaves room for the tree to grow many times over while still bounding
// a runaway walk, and running out is a refusal rather than a partial answer.
const defaultNodeBudget = 20_000_000;

// The transfer walk indexes every transfer site once, then answers one memoised
// question per read site. Measured against this repository: 1,458,064 steps for
// 67,167 reads, so the default leaves the tree room to grow several times over
// while still bounding a runaway walk.
const defaultTransferBudget = 4_000_000;

/**
 * Folds one candidate-keyed map of entries into another, preserving the order
 * the source map recorded them in. The model's own observations stay first, so
 * a transferred witness never displaces the direct one that outranks it.
 */
function mergeByCandidate(target, extra) {
  for (const [id, entries] of extra) {
    const existing = target.get(id);

    if (existing === undefined) {
      target.set(id, [...entries]);
      continue;
    }

    existing.push(...entries);
  }
}

function assertContractShape(evaluated) {
  const decisions = evaluated?.decisions;
  const diagnostics = evaluated?.diagnostics;

  if (!Array.isArray(decisions) || !Array.isArray(diagnostics)) {
    throw new AnalysisSetupError("Contract evaluator must return decisions and diagnostics arrays");
  }

  for (const decision of decisions) {
    if (typeof decision?.id !== "string" || typeof decision.reason !== "string") {
      throw new AnalysisSetupError("Contract decision must carry a candidate id and a reason");
    }
  }

  return { decisions, diagnostics };
}

/**
 * Runs the injected contract validator, if one was supplied. The validator is the
 * only source of accepted exceptions; with no validator no member is excused, so
 * a missing injection can never widen what the gate accepts.
 */
function evaluateContracts(contractEvaluator, context) {
  if (contractEvaluator === undefined) {
    return { reasons: new Map(), diagnostics: [] };
  }

  const { decisions, diagnostics } = assertContractShape(contractEvaluator(context));
  const known = new Set(context.candidates.map((candidate) => candidate.id));
  const reasons = new Map();

  for (const decision of decisions) {
    if (!known.has(decision.id)) {
      throw new AnalysisSetupError(`Contract names an unknown declaration: ${decision.id}`);
    }

    reasons.set(decision.id, decision.reason);
  }

  return { reasons, diagnostics };
}

/**
 * An independently proven observation settles a candidate. An analysis gap only
 * blocks a candidate that has no witness of its own, which is what stops one
 * opaque expression from condemning every member of the type it touched.
 */
function statusOf(witnesses, gaps, contractReason) {
  if (witnesses.some((witness) => witness.origin === "production")) {
    return "runtime-observed";
  }

  if (witnesses.length > 0) {
    return "test-only-observed";
  }

  if (contractReason !== undefined) {
    return "explicit-contract";
  }

  return gaps.length > 0 ? "unsupported-analysis" : "unread";
}

function countByStatus(members) {
  const counts = {
    runtimeObserved: 0,
    testOnlyObserved: 0,
    explicitContract: 0,
    unread: 0,
    unsupportedAnalysis: 0,
  };
  const byStatus = {
    "runtime-observed": "runtimeObserved",
    "test-only-observed": "testOnlyObserved",
    "explicit-contract": "explicitContract",
    unread: "unread",
    "unsupported-analysis": "unsupportedAnalysis",
  };

  for (const member of members) {
    counts[byStatus[member.status]] += 1;
  }

  return counts;
}

/**
 * Projects each candidate into the report's member record. The fields are listed
 * one by one rather than spread from the candidate, so the report schema stays a
 * decision of this module instead of drifting with the internal model.
 */
function buildMembers(candidates, witnesses, unsupported, contractReasons) {
  return candidates.map((candidate) => {
    const observed = witnesses.get(candidate.id) ?? [];
    const gaps = unsupported.get(candidate.id) ?? [];
    const contractReason = contractReasons.get(candidate.id);
    return {
      id: candidate.id,
      path: candidate.path,
      line: candidate.line,
      column: candidate.column,
      owner: candidate.owner,
      key: candidate.key,
      optional: candidate.optional,
      category: candidate.category,
      status: statusOf(observed, gaps, contractReason),
      witnesses: observed,
      reasons: contractReason === undefined ? gaps : [contractReason, ...gaps],
    };
  });
}

/**
 * Compiles the project and classifies every production member declaration.
 *
 * `contractEvaluator` is the injection seam the command-line tool uses to supply
 * a validated contract set. It receives the compiled program, the exact candidate
 * model and the observation graph, and returns validated decisions plus its own
 * diagnostics. It can only ever excuse declarations the inventory already knows.
 */
export function analyzeProject({ root, overlay, contractEvaluator, budget, flowBudget }) {
  const { program, checker, projectRoot } = createProjectProgram({ root, overlayPath: overlay });
  const productionFiles = productionFileCount({ program, projectRoot });

  if (productionFiles === 0) {
    throw new AnalysisSetupError(`No production source files under ${productionRoot}`);
  }

  const { candidates, byDeclaration } = collectCandidates({ program, checker, projectRoot });

  if (candidates.length === 0) {
    throw new AnalysisSetupError(`No member declarations found under ${productionRoot}`);
  }

  const { witnesses, unsupported, reads, exhausted } = collectObservations({
    program,
    checker,
    projectRoot,
    byDeclaration,
    budget: budget ?? defaultNodeBudget,
  });

  if (exhausted !== undefined) {
    throw new AnalysisSetupError(
      `Analysis budget of ${exhausted.budget} nodes exhausted while walking ${exhausted.path}`,
    );
  }

  const flow = collectFlowObservations({
    program,
    checker,
    projectRoot,
    byDeclaration,
    reads,
    budget: flowBudget ?? defaultTransferBudget,
  });

  if (flow.exhausted !== undefined) {
    throw new AnalysisSetupError(
      `Transfer budget of ${flow.exhausted.budget} steps exhausted while tracing ${flow.exhausted.path}`,
    );
  }

  mergeByCandidate(witnesses, flow.witnesses);
  mergeByCandidate(unsupported, flow.unsupported);

  const { reasons, diagnostics } = evaluateContracts(contractEvaluator, {
    program,
    checker,
    projectRoot,
    candidates,
    witnesses,
    transfers: flow.transfers,
  });
  const members = buildMembers(candidates, witnesses, unsupported, reasons);
  const findings = members.filter(
    (member) => member.status === "unread" || member.status === "unsupported-analysis",
  );

  return {
    schemaVersion,
    status: findings.length === 0 ? "clean" : "findings",
    root: projectRoot,
    counts: { productionFiles, candidates: candidates.length, ...countByStatus(members) },
    work: {
      transferSteps: flow.counters.steps,
      transferEdges: flow.counters.edges,
      transferReads: flow.counters.reads,
      transferMs: flow.counters.elapsedMs,
    },
    members,
    findings,
    diagnostics,
  };
}
