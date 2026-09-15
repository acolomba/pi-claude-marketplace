import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { AnalysisSetupError, resolveCandidates } from "./check-unused-type-members.model.mjs";

/**
 * Validated external and type-system contracts for the unused-type-member gate.
 *
 * A contract is the only way a member with no runtime read is accepted, so it
 * has to carry more weight than a comment. Every entry names one exact
 * declaration -- the `path:line:column` identity the inventory already holds --
 * and the evidence its category demands. Nothing here matches by property
 * spelling, file glob or type name: an entry that cannot be tied back to the
 * declaration the compiler resolved is refused, and so is an entry whose
 * evidence no longer holds.
 *
 * Refusal is an `AnalysisSetupError`, which the command-line tool reports as a
 * setup failure rather than a member finding. That separation is deliberate: a
 * stale contract means the gate cannot say anything trustworthy about the tree,
 * which is a different thing from having found an unread member.
 */

const schemaVersion = 1;
const analysedRoots = ["extensions/pi-claude-marketplace/", "tests/"];

// Following a value back through named places is bounded. A chain longer than
// this is a wrapper nobody reads by hand, and stopping early under-credits --
// which refuses a contract rather than accepting an unproven one.
const deepestSourceHop = 8;

const commonKeys = ["id", "owner", "key", "category", "purpose"];

/**
 * The evidence each category adds on top of the common keys. The set is closed:
 * a key outside it is a typo or an invented allowance, and both are refused.
 */
const categoryKeys = {
  "external-output": ["origin", "boundary"],
};

const projectPathOf = (projectRoot, fileName) =>
  path.relative(projectRoot, fileName).split(path.sep).join("/");

function fail(message) {
  throw new AnalysisSetupError(`Invalid contract: ${message}`);
}

function describeCause(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Parses one `path:line:column` reference. The path must be project-relative and
 * spelled exactly: a wildcard, a traversal segment or an absolute path would let
 * one entry cover a family of declarations, which is the whole failure mode
 * these contracts exist to avoid.
 */
function parseSite(value, describe) {
  const match = /^([^\s*?\\]+):(\d+):(\d+)$/u.exec(value);
  const projectPath = match?.[1];

  if (
    projectPath === undefined ||
    projectPath.startsWith("/") ||
    path.posix.normalize(projectPath) !== projectPath ||
    projectPath.split("/").includes("..")
  ) {
    fail(`${describe} must be a project-relative path:line:column with no wildcard, not ${value}`);
  }

  return { path: projectPath, line: Number(match[2]), column: Number(match[3]) };
}

function readDocument(contractsPath) {
  let text;

  try {
    text = readFileSync(contractsPath, "utf8");
  } catch (error) {
    throw new AnalysisSetupError(
      `Cannot read contract file ${contractsPath}: ${describeCause(error)}`,
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AnalysisSetupError(
      `Contract file ${contractsPath} is not valid JSON: ${describeCause(error)}`,
    );
  }
}

function contractsOf(document, contractsPath) {
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    fail(`file ${contractsPath} must hold an object`);
  }

  if (document.schemaVersion !== schemaVersion) {
    fail(
      `file states schema version ${document.schemaVersion}, but this gate reads version ${schemaVersion}`,
    );
  }

  if (!Array.isArray(document.contracts)) {
    fail(`file ${contractsPath} must hold a contracts array`);
  }

  return document.contracts;
}

function assertKeys(entry) {
  const extra = categoryKeys[entry.category];

  if (extra === undefined) {
    fail(`${entry.id} names unknown category ${JSON.stringify(entry.category)}`);
  }

  const allowed = new Set([...commonKeys, ...extra]);

  for (const key of Object.keys(entry)) {
    if (!allowed.has(key)) {
      fail(`${entry.id} carries unknown key ${key}`);
    }
  }

  for (const key of allowed) {
    if (typeof entry[key] !== "string" || entry[key].length === 0) {
      fail(`${entry.id} needs a non-empty ${key}`);
    }
  }
}

function assertEntry(entry, index) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    fail(`entry ${index} must be an object`);
  }

  if (typeof entry.id !== "string" || entry.id.length === 0) {
    fail(`entry ${index} needs a non-empty id`);
  }

  assertKeys(entry);
  parseSite(entry.id, "id");
}

function assertUnique(entries) {
  const seen = new Set();

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      fail(`${entry.id} is named by more than one contract`);
    }

    seen.add(entry.id);
  }
}

function loadEntries(contractsPath) {
  const entries = contractsOf(readDocument(contractsPath), contractsPath);
  entries.forEach(assertEntry);
  assertUnique(entries);
  return entries;
}

/**
 * The outermost syntax starting exactly at one site. Several nodes can begin at
 * the same character -- a property assignment and the identifier naming it --
 * and the outer one is the node a maintainer means when they write down a
 * coordinate.
 */
function nodeAt(sourceFile, site) {
  let position;

  try {
    position = sourceFile.getPositionOfLineAndCharacter(site.line - 1, site.column - 1);
  } catch {
    return undefined;
  }

  let found;
  const visit = (node) => {
    if (found !== undefined || node.getStart() > position || node.getEnd() <= position) {
      return;
    }

    if (node.getStart() === position) {
      found = node;
      return;
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return found;
}

function nodeAtSite(site, context) {
  const sourceFile = context.sourceFiles.get(site.path);
  return sourceFile === undefined ? undefined : nodeAt(sourceFile, site);
}

function resolveNode(site, describe, context) {
  if (!context.sourceFiles.has(site.path)) {
    fail(`${describe} names ${site.path}, which this program does not compile`);
  }

  const node = nodeAtSite(site, context);

  if (node === undefined) {
    fail(`${describe} names no syntax at ${site.path}:${site.line}:${site.column}`);
  }

  return node;
}

function candidateFor(entry, context) {
  const candidate = context.byId.get(entry.id);

  if (candidate === undefined) {
    fail(`${entry.id} names no declaration in this program`);
  }

  if (candidate.owner !== entry.owner || candidate.key !== entry.key) {
    fail(
      `${entry.id} declares ${candidate.owner}.${candidate.key}, not ${entry.owner}.${entry.key}`,
    );
  }

  return candidate;
}

function assertNotRedundant(entry, context) {
  const [witness] = context.witnesses.get(entry.id) ?? [];

  if (witness !== undefined) {
    fail(
      `${entry.id} is already read at ${witness.path}:${witness.line}:${witness.column}; remove the contract`,
    );
  }
}

function isExternalSource(sourceFile, projectRoot) {
  const projectPath = projectPathOf(projectRoot, sourceFile.fileName);
  return (
    sourceFile.isDeclarationFile && !analysedRoots.some((root) => projectPath.startsWith(root))
  );
}

function enclosingFunction(node) {
  let current = node.parent;

  while (current !== undefined && !ts.isFunctionLike(current)) {
    current = current.parent;
  }

  return current;
}

/**
 * Whether an assertion stands between this expression and the position that
 * gives it its type. An asserted value is checked against nothing, so a boundary
 * reached only through one proves no external expectation.
 */
function insideAssertion(node) {
  let current = node.parent;

  while (current !== undefined && !ts.isStatement(current)) {
    if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

/**
 * The expression a return hands to an externally declared signature, or nothing
 * when no external declaration is expecting it. The contextual type is what
 * makes this a boundary: it is the shape an installed declaration asked for, and
 * the compiler checked the returned value against it.
 */
function externalReturnExpression(node, context) {
  if (!ts.isReturnStatement(node) || node.expression === undefined) {
    return undefined;
  }

  const container = enclosingFunction(node);

  if (container === undefined || insideAssertion(container)) {
    return undefined;
  }

  const contextual = context.checker.getContextualType(container);

  if (contextual === undefined) {
    return undefined;
  }

  const external = context.checker
    .getSignaturesOfType(contextual, ts.SignatureKind.Call)
    .some(
      (signature) =>
        signature.declaration !== undefined &&
        isExternalSource(signature.declaration.getSourceFile(), context.projectRoot),
    );
  return external ? node.expression : undefined;
}

function literalNameOf(node) {
  const name = node.name;
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

/**
 * The inventoried declarations a written slot fills. The contextual type is the
 * shape being built, so its property is the declaration the value is placed on;
 * the object literal's own synthetic property is not.
 */
function originCandidates(node, context) {
  if (!ts.isPropertyAssignment(node) && !ts.isShorthandPropertyAssignment(node)) {
    return [];
  }

  const key = literalNameOf(node);
  const contextual = key === undefined ? undefined : context.checker.getContextualType(node.parent);
  const symbol =
    contextual === undefined ? undefined : context.checker.getPropertyOfType(contextual, key);
  return symbol === undefined
    ? []
    : resolveCandidates(context.checker, context.byDeclaration, symbol);
}

function contains(outer, inner) {
  return (
    outer.getSourceFile() === inner.getSourceFile() &&
    outer.getStart() <= inner.getStart() &&
    inner.getEnd() <= outer.getEnd()
  );
}

function siteKeyOf(node, projectRoot) {
  const sourceFile = node.getSourceFile();
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return `${projectPathOf(projectRoot, sourceFile.fileName)}:${line + 1}:${character + 1}`;
}

/**
 * The expressions a named place was actually given its value from, taken from
 * the directed transfers the flow walk recorded. Structural compatibility is not
 * one of them: only a site where a value really moved appears here.
 */
function sourcesOf(expression, context) {
  const symbol = context.checker.getSymbolAtLocation(expression);
  const sources = [];

  for (const declaration of symbol?.declarations ?? []) {
    if (declaration.name === undefined) {
      continue;
    }

    const destination = siteKeyOf(declaration.name, context.projectRoot);

    for (const transfer of context.transfersTo.get(destination) ?? []) {
      const node = nodeAtSite(transfer.from, context);

      if (node !== undefined) {
        sources.push(node);
      }
    }
  }

  return sources;
}

function reaches(origin, expression, context, hops) {
  if (contains(expression, origin)) {
    return true;
  }

  if (hops === 0 || !ts.isIdentifier(expression)) {
    return false;
  }

  return sourcesOf(expression, context).some((source) =>
    reaches(origin, source, context, hops - 1),
  );
}

/**
 * Proves that this member's value really is handed to an external declaration.
 * Upstream declaring a matching slot proves nothing on its own; the value has to
 * be built at the named origin and arrive at the named boundary.
 */
function proveExternalOutput(entry, candidate, context) {
  const originSite = parseSite(entry.origin, `${entry.id} origin`);
  const boundarySite = parseSite(entry.boundary, `${entry.id} boundary`);
  const originNode = resolveNode(originSite, `${entry.id} origin`, context);
  const boundaryNode = resolveNode(boundarySite, `${entry.id} boundary`, context);

  if (!originCandidates(originNode, context).includes(candidate)) {
    fail(`${entry.id} origin ${entry.origin} does not build ${candidate.owner}.${candidate.key}`);
  }

  const returned = externalReturnExpression(boundaryNode, context);

  if (returned === undefined) {
    fail(`${entry.id} boundary ${entry.boundary} is not a return to an external declaration`);
  }

  if (!reaches(originNode, returned, context, deepestSourceHop)) {
    fail(`${entry.id} origin ${entry.origin} never reaches boundary ${entry.boundary}`);
  }

  return `(origin ${entry.origin} reaches boundary ${entry.boundary})`;
}

const provers = {
  "external-output": proveExternalOutput,
};

function decisionFor(entry, context) {
  const candidate = candidateFor(entry, context);
  assertNotRedundant(entry, context);
  const evidence = provers[entry.category](entry, candidate, context);
  return { id: entry.id, reason: `${entry.category}: ${entry.purpose} ${evidence}` };
}

function indexTransfers(transfers) {
  const byDestination = new Map();

  for (const transfer of transfers) {
    const key = `${transfer.to.path}:${transfer.to.line}:${transfer.to.column}`;
    const existing = byDestination.get(key);

    if (existing === undefined) {
      byDestination.set(key, [transfer]);
    } else {
      existing.push(transfer);
    }
  }

  return byDestination;
}

function sourceFilesByPath(program, projectRoot) {
  const byPath = new Map();

  for (const sourceFile of program.getSourceFiles()) {
    byPath.set(projectPathOf(projectRoot, sourceFile.fileName), sourceFile);
  }

  return byPath;
}

function contextFrom(given) {
  return {
    checker: given.checker,
    projectRoot: given.projectRoot,
    byDeclaration: given.byDeclaration,
    witnesses: given.witnesses,
    byId: new Map(given.candidates.map((candidate) => [candidate.id, candidate])),
    sourceFiles: sourceFilesByPath(given.program, given.projectRoot),
    transfersTo: indexTransfers(given.transfers),
  };
}

/**
 * Builds the gate's contract validator from one contract file.
 *
 * The file's shape is checked when the validator is built, so a malformed
 * document fails before the compiler is ever started. Each entry's evidence is
 * checked against the compiled program when the validator runs, because that is
 * the only moment the declarations, witnesses and transfers exist.
 */
export function createContractEvaluator({ contractsPath }) {
  const entries = loadEntries(contractsPath);

  return (given) => {
    const context = contextFrom(given);
    return {
      decisions: entries.map((entry) => decisionFor(entry, context)),
      diagnostics: [
        `contracts: ${entries.length} validated from ${projectPathOf(given.projectRoot, contractsPath)}`,
      ],
    };
  };
}
