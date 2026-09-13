/** One exact output example parsed from the independent output catalog. */
export interface CatalogExample {
  readonly section: string;
  readonly state: string;
  readonly expected: string;
}

interface PendingState {
  readonly value: string;
  readonly line: number;
}

interface CatalogScanState {
  currentSection: string | null;
  pendingState: PendingState | null;
  inFence: boolean;
  fenceBody: string[];
  fenceLine: number;
}

const CATALOG_SECTION_RE =
  /^## (`(\/claude:plugin [^`]+)`|Manual recovery anchors|reconcile-applied-cascade)\s*$/;
const CATALOG_STATE_RE = /^<!-- catalog-state: ([a-z0-9-]+) -->\s*$/;
const EMPTY_CATALOG_STATE_RE = /^<!-- catalog-state:\s*-->\s*$/;

function resolveSectionName(sectionMatch: RegExpExecArray): string {
  if (sectionMatch[2] !== undefined) {
    return sectionMatch[2];
  }

  const groupOne = sectionMatch[1] ?? "";
  return groupOne === "Manual recovery anchors" ? "manual-recovery-anchors" : groupOne;
}

function tupleKey(section: string, state: string): string {
  return `${section}::${state}`;
}

function lineError(line: number, detail: string): Error {
  return new Error(`Catalog parse error at line ${line}: ${detail}`);
}

function finishFence(
  line: number,
  scan: CatalogScanState,
  examples: CatalogExample[],
  parsedTuples: Set<string>,
): void {
  if (scan.currentSection !== null && scan.pendingState !== null) {
    const key = tupleKey(scan.currentSection, scan.pendingState.value);
    if (scan.fenceBody.length === 0) {
      throw lineError(line, `empty fenced output for tuple "${key}".`);
    }

    examples.push({
      section: scan.currentSection,
      state: scan.pendingState.value,
      expected: scan.fenceBody.join("\n"),
    });
    parsedTuples.add(key);
  }

  scan.pendingState = null;
  scan.fenceBody = [];
  scan.inFence = false;
  scan.fenceLine = 0;
}

function beginStateMarker(
  line: string,
  lineNumber: number,
  scan: CatalogScanState,
  parsedTuples: ReadonlySet<string>,
): boolean {
  const stateMatch = CATALOG_STATE_RE.exec(line);
  if (stateMatch === null) {
    return false;
  }

  if (scan.currentSection === null) {
    return true;
  }

  const state = stateMatch[1] ?? "";
  if (scan.pendingState !== null) {
    throw lineError(
      lineNumber,
      `adjacent catalog-state marker "${state}" follows pending marker "${scan.pendingState.value}" from line ${scan.pendingState.line}.`,
    );
  }

  const key = tupleKey(scan.currentSection, state);
  if (parsedTuples.has(key)) {
    throw lineError(lineNumber, `duplicate catalog tuple "${key}".`);
  }

  scan.pendingState = { value: state, line: lineNumber };
  return true;
}

function scanOutsideFence(
  line: string,
  lineNumber: number,
  scan: CatalogScanState,
  parsedTuples: ReadonlySet<string>,
): void {
  const sectionMatch = CATALOG_SECTION_RE.exec(line);
  if (sectionMatch !== null) {
    if (scan.pendingState !== null) {
      throw lineError(
        lineNumber,
        `marker "${scan.pendingState.value}" from line ${scan.pendingState.line} has no following fenced output.`,
      );
    }

    scan.currentSection = resolveSectionName(sectionMatch);
    return;
  }

  if (line.startsWith("## ")) {
    if (scan.pendingState !== null) {
      throw lineError(
        lineNumber,
        `marker "${scan.pendingState.value}" from line ${scan.pendingState.line} has no following fenced output.`,
      );
    }

    scan.currentSection = null;
    return;
  }

  if (beginStateMarker(line, lineNumber, scan, parsedTuples)) {
    return;
  }

  if (scan.currentSection !== null && line.trimStart().startsWith("<!-- catalog-state")) {
    if (EMPTY_CATALOG_STATE_RE.test(line)) {
      throw lineError(lineNumber, "empty catalog-state marker.");
    }

    throw lineError(lineNumber, `malformed catalog-state marker "${line}".`);
  }

  if (!line.startsWith("```")) {
    return;
  }

  if (scan.currentSection !== null && scan.pendingState === null) {
    throw lineError(
      lineNumber,
      `missing catalog-state marker before fenced output in section "${scan.currentSection}".`,
    );
  }

  scan.inFence = true;
  scan.fenceBody = [];
  scan.fenceLine = lineNumber;
}

/**
 * Parses exact `(section, state)` output tuples from the independent catalog.
 *
 * Recognized catalog sections fail closed when a marker or fence boundary is
 * missing, repeated, empty, adjacent, or malformed. Other H2 sections are not
 * part of this contract and their annotated examples are deliberately ignored.
 */
export function loadCatalogExamples(catalog: string): readonly CatalogExample[] {
  const examples: CatalogExample[] = [];
  const parsedTuples = new Set<string>();
  const scan: CatalogScanState = {
    currentSection: null,
    pendingState: null,
    inFence: false,
    fenceBody: [],
    fenceLine: 0,
  };

  const lines = catalog.split("\n");
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (!scan.inFence) {
      scanOutsideFence(line, lineNumber, scan, parsedTuples);
      continue;
    }

    if (line.startsWith("```")) {
      finishFence(lineNumber, scan, examples, parsedTuples);
    } else {
      scan.fenceBody.push(line);
    }
  }

  if (scan.inFence) {
    const section = scan.currentSection ?? "(ignored section)";
    const state = scan.pendingState?.value ?? "(unmarked)";
    throw new Error(
      `Catalog parse error at end of input: unclosed fenced output for tuple "${tupleKey(section, state)}" opened at line ${scan.fenceLine}.`,
    );
  }

  if (scan.pendingState !== null) {
    throw new Error(
      `Catalog parse error at end of input: marker "${scan.pendingState.value}" from line ${scan.pendingState.line} has no following fenced output.`,
    );
  }

  return examples;
}
