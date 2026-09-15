import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

/**
 * Analysis pipeline for the unused-type-member gate.
 *
 * The pipeline compiles the configured project once, inventories the member
 * declarations that production source files own, and then looks for runtime
 * observations of those exact declarations. Members are matched through the
 * checker's symbols, never by property spelling, so a same-named member on an
 * unrelated type cannot keep a declaration alive.
 *
 * Analysed source is only ever parsed. Nothing here imports or evaluates it.
 */

const schemaVersion = 1;
const productionRoot = "extensions/pi-claude-marketplace";
const testRoot = "tests";
const configFileName = "tsconfig.json";

/** Raised when the project, options or compiler inputs cannot produce any verdict. */
export class AnalysisSetupError extends Error {
  constructor(message) {
    super(message);
    this.name = "AnalysisSetupError";
  }
}

function toProjectPath(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

function isProductionPath(projectPath) {
  return projectPath.startsWith(`${productionRoot}/`);
}

/**
 * Whether a source file may contribute observations, and under which provenance.
 * Files outside the production and test roots -- installed declarations, the
 * standard library -- contribute nothing, so their reads cannot vouch for a
 * project member.
 */
function observationOrigin(projectPath) {
  if (isProductionPath(projectPath)) {
    return "production";
  }

  if (projectPath.startsWith(`${testRoot}/`)) {
    return "test";
  }

  return undefined;
}

function positionOf(node) {
  const { line, character } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  return { line: line + 1, column: character + 1 };
}

function parseOverlayDocument(overlayPath) {
  let text;

  try {
    text = readFileSync(overlayPath, "utf8");
  } catch {
    throw new AnalysisSetupError(`Overlay file cannot be read: ${overlayPath}`);
  }

  let document;

  try {
    document = JSON.parse(text);
  } catch {
    throw new AnalysisSetupError(`Overlay file is not valid JSON: ${overlayPath}`);
  }

  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    throw new AnalysisSetupError(`Overlay file must hold a JSON object: ${overlayPath}`);
  }

  return document;
}

function overlayTarget(projectRoot, projectPath) {
  const absolutePath = path.resolve(projectRoot, projectPath);
  const contained =
    absolutePath === projectRoot || absolutePath.startsWith(`${projectRoot}${path.sep}`);
  const stats = contained ? statSync(absolutePath, { throwIfNoEntry: false }) : undefined;

  if (stats === undefined || !stats.isFile() || !projectPath.endsWith(".ts")) {
    throw new AnalysisSetupError(`Overlay path is not an existing project file: ${projectPath}`);
  }

  return absolutePath;
}

/**
 * Reads the overlay file into absolute-path replacements. Every entry must name
 * a TypeScript file that already exists inside the project: the overlay is a
 * compiler read override for analysis, not a way to introduce new sources or to
 * reach outside the project root.
 */
function readOverlay(projectRoot, overlayPath) {
  const replacements = new Map();

  if (overlayPath === undefined) {
    return replacements;
  }

  for (const [projectPath, replacement] of Object.entries(
    parseOverlayDocument(overlayPath, projectRoot),
  )) {
    if (typeof replacement !== "string") {
      throw new AnalysisSetupError(`Overlay replacement must be source text: ${projectPath}`);
    }

    replacements.set(overlayTarget(projectRoot, projectPath), replacement);
  }

  return replacements;
}

function parseConfiguration(projectRoot) {
  const configPath = path.join(projectRoot, configFileName);

  if (!existsSync(configPath)) {
    throw new AnalysisSetupError(`Project has no ${configFileName}: ${configPath}`);
  }

  const read = ts.readConfigFile(configPath, ts.sys.readFile);

  if (read.error !== undefined) {
    throw new AnalysisSetupError(
      `Cannot read ${configFileName}: ${ts.flattenDiagnosticMessageText(read.error.messageText, " ")}`,
    );
  }

  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    projectRoot,
    undefined,
    configPath,
  );

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new AnalysisSetupError(
      `Invalid ${configFileName}: ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`,
    );
  }

  if (parsed.fileNames.length === 0) {
    throw new AnalysisSetupError(`${configFileName} resolves no TypeScript inputs: ${configPath}`);
  }

  return parsed;
}

function createOverlayHost(compilerOptions, replacements) {
  const host = ts.createCompilerHost(compilerOptions, true);
  const readFileFromDisk = host.readFile.bind(host);
  const getSourceFileFromDisk = host.getSourceFile.bind(host);

  host.readFile = (fileName) =>
    replacements.get(path.resolve(fileName)) ?? readFileFromDisk(fileName);

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const replacement = replacements.get(path.resolve(fileName));

    if (replacement === undefined) {
      return getSourceFileFromDisk(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    }

    return ts.createSourceFile(fileName, replacement, languageVersion, true, ts.ScriptKind.TS);
  };

  return host;
}

/**
 * Compiles the configured project, applying any overlay as a read override.
 * A source that the configuration names but the compiler cannot parse is a setup
 * failure: an analysis run over a partly-unreadable program has no verdict to give.
 */
function createProjectProgram({ root, overlayPath }) {
  const projectRoot = path.resolve(root);
  const parsed = parseConfiguration(projectRoot);
  const replacements = readOverlay(projectRoot, overlayPath);
  const program = ts.createProgram(
    parsed.fileNames,
    parsed.options,
    createOverlayHost(parsed.options, replacements),
  );

  for (const fileName of parsed.fileNames) {
    if (program.getSourceFile(fileName) === undefined) {
      throw new AnalysisSetupError(
        `Compiler input did not resolve: ${toProjectPath(projectRoot, fileName)}`,
      );
    }
  }

  const syntactic = program.getSyntacticDiagnostics();

  if (syntactic.length > 0) {
    const first = syntactic[0];
    throw new AnalysisSetupError(
      `Compiler input has a syntax error: ${toProjectPath(projectRoot, first.file.fileName)}: ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`,
    );
  }

  return { program, checker: program.getTypeChecker(), projectRoot };
}

function literalKeyOf(nameNode) {
  if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode)) {
    return nameNode.text;
  }

  return undefined;
}

function addInterfaceMembers(declaration, projectPath, collected) {
  for (const member of declaration.members) {
    const key = ts.isPropertySignature(member) ? literalKeyOf(member.name) : undefined;

    if (key === undefined) {
      continue;
    }

    const { line, column } = positionOf(member);
    const candidate = {
      id: `${projectPath}:${line}:${column}`,
      path: projectPath,
      line,
      column,
      owner: declaration.name.text,
      key,
      optional: member.questionToken !== undefined,
      category: "interface-member",
    };

    collected.candidates.push(candidate);
    collected.byDeclaration.set(member, candidate);
  }
}

function compareCandidates(left, right) {
  if (left.path !== right.path) {
    return left.path < right.path ? -1 : 1;
  }

  if (left.line !== right.line) {
    return left.line - right.line;
  }

  return left.column - right.column;
}

/**
 * Inventories the member declarations production source files own. Test sources
 * are deliberately absent: they supply observations, never candidates, so a
 * test-local interface can never be reported and can never be kept alive by its
 * own declaration.
 */
function collectCandidates(program, projectRoot) {
  const collected = { candidates: [], byDeclaration: new Map() };

  for (const sourceFile of program.getSourceFiles()) {
    const projectPath = toProjectPath(projectRoot, sourceFile.fileName);

    if (sourceFile.isDeclarationFile || !isProductionPath(projectPath)) {
      continue;
    }

    const visit = (node) => {
      if (ts.isInterfaceDeclaration(node)) {
        addInterfaceMembers(node, projectPath, collected);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  collected.candidates.sort(compareCandidates);
  return collected;
}

function candidatesForName(checker, byDeclaration, nameNode) {
  const symbol = checker.getSymbolAtLocation(nameNode);

  if (symbol === undefined) {
    return [];
  }

  const merged = checker.getMergedSymbol(symbol);
  const found = [];

  for (const root of [merged, ...checker.getRootSymbols(merged)]) {
    for (const declaration of root.declarations ?? []) {
      const candidate = byDeclaration.get(declaration);

      if (candidate !== undefined && !found.includes(candidate)) {
        found.push(candidate);
      }
    }
  }

  return found;
}

function recordWitness(witnesses, candidate, witness) {
  const existing = witnesses.get(candidate.id);

  if (existing === undefined) {
    witnesses.set(candidate.id, [witness]);
    return;
  }

  existing.push(witness);
}

/**
 * Walks value positions looking for property reads of inventoried members.
 * Type nodes are skipped outright: an indexed-access type, a `keyof`, or a type
 * query mentions a member without ever reading one at run time.
 */
function collectObservations({ program, checker, projectRoot, byDeclaration }) {
  const witnesses = new Map();

  for (const sourceFile of program.getSourceFiles()) {
    const projectPath = toProjectPath(projectRoot, sourceFile.fileName);
    const origin = sourceFile.isDeclarationFile ? undefined : observationOrigin(projectPath);

    if (origin === undefined) {
      continue;
    }

    const visit = (node) => {
      if (ts.isTypeNode(node)) {
        return;
      }

      if (ts.isPropertyAccessExpression(node)) {
        for (const candidate of candidatesForName(checker, byDeclaration, node.name)) {
          const { line, column } = positionOf(node.name);
          recordWitness(witnesses, candidate, {
            path: projectPath,
            line,
            column,
            kind: "value-read",
            origin,
            syntax: "property-access",
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return witnesses;
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

function statusOf(witnesses, contractReason) {
  if (witnesses.some((witness) => witness.origin === "production")) {
    return "runtime-observed";
  }

  if (witnesses.length > 0) {
    return "test-only-observed";
  }

  if (contractReason !== undefined) {
    return "explicit-contract";
  }

  return "unread";
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

function buildMembers(candidates, witnesses, contractReasons) {
  return candidates.map((candidate) => {
    const observed = witnesses.get(candidate.id) ?? [];
    const contractReason = contractReasons.get(candidate.id);
    return {
      ...candidate,
      status: statusOf(observed, contractReason),
      witnesses: observed,
      reasons: contractReason === undefined ? [] : [contractReason],
    };
  });
}

function productionFileCount(program, projectRoot) {
  return program
    .getSourceFiles()
    .filter(
      (sourceFile) =>
        !sourceFile.isDeclarationFile &&
        isProductionPath(toProjectPath(projectRoot, sourceFile.fileName)),
    ).length;
}

/**
 * Compiles the project and classifies every production member declaration.
 *
 * `contractEvaluator` is the injection seam the command-line tool uses to supply
 * a validated contract set. It receives the compiled program, the exact candidate
 * model and the observation graph, and returns validated decisions plus its own
 * diagnostics. It can only ever excuse declarations the inventory already knows.
 */
export function analyzeProject({ root, overlay, contractEvaluator }) {
  const { program, checker, projectRoot } = createProjectProgram({ root, overlayPath: overlay });
  const productionFiles = productionFileCount(program, projectRoot);

  if (productionFiles === 0) {
    throw new AnalysisSetupError(`No production source files under ${productionRoot}`);
  }

  const { candidates, byDeclaration } = collectCandidates(program, projectRoot);

  if (candidates.length === 0) {
    throw new AnalysisSetupError(`No member declarations found under ${productionRoot}`);
  }

  const witnesses = collectObservations({ program, checker, projectRoot, byDeclaration });
  const { reasons, diagnostics } = evaluateContracts(contractEvaluator, {
    program,
    checker,
    projectRoot,
    candidates,
    witnesses,
    transfers: [],
  });
  const members = buildMembers(candidates, witnesses, reasons);
  const findings = members.filter(
    (member) => member.status === "unread" || member.status === "unsupported-analysis",
  );

  return {
    schemaVersion,
    status: findings.length === 0 ? "clean" : "findings",
    root: projectRoot,
    counts: { productionFiles, candidates: candidates.length, ...countByStatus(members) },
    members,
    findings,
    diagnostics,
  };
}
