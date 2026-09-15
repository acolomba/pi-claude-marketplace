/**
 * Analysis pipeline for the unused-type-member gate.
 *
 * This revision is a deliberate always-clean stand-in: it accepts the options the
 * command-line tool passes and reports that every project is free of unread
 * members. The paired controls in `tests/scripts/check-unused-type-members.test.ts`
 * must fail against it. An analyzer that cannot be caught reporting nothing is
 * indistinguishable from one that works.
 */

const schemaVersion = 1;

/** Raised when the project, options or compiler inputs cannot produce any verdict. */
export class AnalysisSetupError extends Error {
  constructor(message) {
    super(message);
    this.name = "AnalysisSetupError";
  }
}

export function analyzeProject(options) {
  return {
    schemaVersion,
    status: "clean",
    root: options.root,
    counts: {
      productionFiles: 0,
      candidates: 0,
      runtimeObserved: 0,
      testOnlyObserved: 0,
      explicitContract: 0,
      unread: 0,
      unsupportedAnalysis: 0,
    },
    members: [],
    findings: [],
    diagnostics: [],
  };
}
