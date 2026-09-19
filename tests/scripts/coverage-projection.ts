// The producer's output in the fixture corpus's own vocabulary: functions,
// statements and branches as spans with hits, sorted by position, so a
// converted file record can be compared whole against expectations written
// from the source text (D-03, D-09).

import type {
  ExpectedBranch,
  ExpectedFunction,
  ExpectedStatement,
  ProducerFixture,
  SourceSpan,
} from "./coverage-producer-fixtures.ts";
import type { IstanbulFileCoverage, IstanbulLocation } from "./coverage-run-support.ts";

export interface ProjectedCoverage {
  readonly functions: readonly ExpectedFunction[];
  readonly statements: readonly ExpectedStatement[];
  readonly branches: readonly ExpectedBranch[];
}

export function spanKey(span: SourceSpan): string {
  return `${span.start.line}:${span.start.column}-${span.end.line}:${span.end.column}`;
}

export function compareSpans(a: SourceSpan, b: SourceSpan): number {
  return (
    a.start.line - b.start.line ||
    a.start.column - b.start.column ||
    a.end.line - b.end.line ||
    a.end.column - b.end.column
  );
}

function asSpan(location: IstanbulLocation): SourceSpan {
  return {
    start: { line: location.start.line ?? -1, column: location.start.column ?? -1 },
    end: { line: location.end.line ?? -1, column: location.end.column ?? -1 },
  };
}

/** The converter output for one file, sorted by position. */
export function projectCoverage(file: IstanbulFileCoverage): ProjectedCoverage {
  const functions = Object.entries(file.fnMap)
    .map(([id, fn]) => ({
      name: fn.name,
      decl: asSpan(fn.decl),
      loc: asSpan(fn.loc),
      hits: file.f[id] ?? -1,
    }))
    .sort((a, b) => compareSpans(a.decl, b.decl));
  const statements = Object.entries(file.statementMap)
    .map(([id, loc]) => ({ loc: asSpan(loc), hits: file.s[id] ?? -1 }))
    .sort((a, b) => compareSpans(a.loc, b.loc));
  const branches = Object.entries(file.branchMap)
    .map(([id, branch]) => ({
      type: branch.type,
      loc: asSpan(branch.loc),
      locations: branch.locations.map((location) =>
        location.start.line === undefined
          ? {
              start: { line: undefined, column: undefined },
              end: { line: undefined, column: undefined },
            }
          : asSpan(location),
      ),
      hits: [...(file.b[id] ?? [])],
    }))
    .sort((a, b) => compareSpans(a.loc, b.loc));

  return { functions, statements, branches };
}

/** A fixture's expectations in the same sorted form. */
export function expectedCoverage(fixture: ProducerFixture): ProjectedCoverage {
  return {
    functions: [...fixture.functions].sort((a, b) => compareSpans(a.decl, b.decl)),
    statements: [...fixture.statements].sort((a, b) => compareSpans(a.loc, b.loc)),
    branches: [...fixture.branches].sort((a, b) => compareSpans(a.loc, b.loc)),
  };
}
