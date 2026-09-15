import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

/**
 * Compiler identity, declaration inventory and runtime-observation classification
 * for the unused-type-member gate.
 *
 * Members are identified by the checker's symbols and their declaration nodes,
 * never by property spelling, so a same-named member on an unrelated type is a
 * different candidate. Analysed source is only ever parsed: nothing here imports
 * or evaluates it.
 */

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
export function createProjectProgram({ root, overlayPath }) {
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

function identifierTextOf(nameNode) {
  if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) {
    return nameNode.text;
  }

  return undefined;
}

/**
 * The key a literal spells out. An identifier is deliberately not one: in an
 * element access an identifier names a variable whose value is only known from
 * its type, so treating its spelling as the key would invent a member.
 */
function literalTextOf(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }

  return undefined;
}

/**
 * The declared key of a member, and whether it is a literal name or a nominal
 * `unique symbol`. A computed key that is not a unique symbol has no stable
 * identity to report against, so it is left out of the inventory rather than
 * being reported under a name the source never wrote.
 */
function memberKeyOf(checker, nameNode) {
  const literal = identifierTextOf(nameNode);

  if (literal !== undefined) {
    return { key: literal, keyKind: "literal" };
  }

  if (!ts.isComputedPropertyName(nameNode)) {
    return undefined;
  }

  const symbol = checker.getSymbolAtLocation(nameNode.expression);

  if (symbol === undefined) {
    return undefined;
  }

  const type = checker.getTypeOfSymbolAtLocation(symbol, nameNode.expression);
  const unique = (type.flags & ts.TypeFlags.UniqueESSymbol) !== 0;
  return unique ? { key: symbol.name, keyKind: "unique-symbol" } : undefined;
}

function ownerSegmentOf(node) {
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    return { segment: node.name.text, stop: true };
  }

  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    return { segment: node.name === undefined ? undefined : node.name.text, stop: true };
  }

  if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
    return { segment: identifierTextOf(node.name), stop: ts.isVariableDeclaration(node) };
  }

  if (
    ts.isPropertySignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isMethodSignature(node)
  ) {
    return { segment: identifierTextOf(node.name), stop: false };
  }

  return { segment: undefined, stop: false };
}

/**
 * Names the shape a member belongs to, walking outwards to the nearest named
 * declaration and joining the property keys crossed on the way. A nested record
 * reads as `Owner.field` and a parameter shape as `functionName.parameterName`,
 * which keeps anonymous shapes reportable without inventing an identity.
 */
function ownerNameOf(node) {
  const segments = [];
  let current = node.parent;

  while (current !== undefined) {
    const { segment, stop } = ownerSegmentOf(current);

    if (segment !== undefined) {
      segments.push(segment);
    }

    if (stop) {
      break;
    }

    current = current.parent;
  }

  return segments.length === 0 ? "<anonymous>" : segments.reverse().join(".");
}

function categoryOf(container, member) {
  const shape = ts.isInterfaceDeclaration(container) ? "interface" : "type-literal";
  return ts.isMethodSignature(member) ? `${shape}-method` : `${shape}-member`;
}

function addMembers(container, projectPath, checker, collected) {
  for (const member of container.members) {
    const named = ts.isPropertySignature(member) || ts.isMethodSignature(member);
    const identity = named ? memberKeyOf(checker, member.name) : undefined;

    if (identity === undefined) {
      continue;
    }

    const { line, column } = positionOf(member);
    const candidate = {
      id: `${projectPath}:${line}:${column}`,
      path: projectPath,
      line,
      column,
      owner: ownerNameOf(member),
      key: identity.key,
      keyKind: identity.keyKind,
      optional: member.questionToken !== undefined,
      category: categoryOf(container, member),
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
 * Inventories the member declarations production source files own: named
 * interfaces, object types behind aliases, nested records and the anonymous
 * parameter and return shapes functions declare inline.
 *
 * Test sources are deliberately absent. They supply observations, never
 * candidates, so a test-local interface can never be reported and can never be
 * kept alive by its own declaration.
 */
export function collectCandidates({ program, checker, projectRoot }) {
  const collected = { candidates: [], byDeclaration: new Map() };

  for (const sourceFile of program.getSourceFiles()) {
    const projectPath = toProjectPath(projectRoot, sourceFile.fileName);

    if (sourceFile.isDeclarationFile || !isProductionPath(projectPath)) {
      continue;
    }

    const visit = (node) => {
      if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
        addMembers(node, projectPath, checker, collected);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  collected.candidates.sort(compareCandidates);
  return collected;
}

/**
 * The inventoried declarations one symbol stands for, resolved through the
 * checker's merged and root symbols so an alias, a declaration merge and an
 * instantiated property all land on the declarations that were inventoried.
 *
 * Exported because the transfer walk resolves the same identities from the
 * other end of an edge: member identity has exactly one definition here.
 */
export function resolveCandidates(checker, byDeclaration, symbol) {
  const merged = checker.getMergedSymbol(symbol);
  const resolved = [];

  for (const root of [merged, ...checker.getRootSymbols(merged)]) {
    for (const declaration of root.declarations ?? []) {
      const candidate = byDeclaration.get(declaration);

      if (candidate !== undefined && !resolved.includes(candidate)) {
        resolved.push(candidate);
      }
    }
  }

  return resolved;
}

// Symbol identity is stable for the life of one program, and the same symbol is
// reached from thousands of call sites, so each one is resolved once.
function addCandidatesOfSymbol(context, symbol, found) {
  if (symbol === undefined) {
    return;
  }

  let resolved = context.symbolCache.get(symbol);

  if (resolved === undefined) {
    resolved = resolveCandidates(context.checker, context.byDeclaration, symbol);
    context.symbolCache.set(symbol, resolved);
  }

  for (const candidate of resolved) {
    if (!found.includes(candidate)) {
      found.push(candidate);
    }
  }
}

function candidatesForName(context, nameNode) {
  const found = [];
  addCandidatesOfSymbol(context, context.checker.getSymbolAtLocation(nameNode), found);
  return found;
}

function candidatesForKey(context, receiverNode, key) {
  const receiver = context.checker.getTypeAtLocation(receiverNode);
  const found = [];
  addCandidatesOfSymbol(context, context.checker.getPropertyOfType(receiver, key), found);
  return found;
}

const compoundAssignmentOperators = new Set([
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

function isAssignmentTargetLiteral(node) {
  const parent = node.parent;

  if (ts.isBinaryExpression(parent)) {
    return parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.left === node;
  }

  const looping = ts.isForOfStatement(parent) || ts.isForInStatement(parent);
  return looping && parent.initializer === node;
}

/**
 * Whether an access sits inside an object or array literal that is itself an
 * assignment target, which makes the access a destination rather than a read.
 */
function isAssignmentPatternMember(node) {
  let current = node.parent;

  while (
    ts.isPropertyAssignment(current) ||
    ts.isObjectLiteralExpression(current) ||
    ts.isArrayLiteralExpression(current) ||
    ts.isSpreadAssignment(current) ||
    ts.isSpreadElement(current)
  ) {
    if (isAssignmentTargetLiteral(current)) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function assignmentRole(node) {
  const parent = node.parent;

  if (!ts.isBinaryExpression(parent) || parent.left !== node) {
    return undefined;
  }

  if (parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    return { syntax: undefined };
  }

  if (compoundAssignmentOperators.has(parent.operatorToken.kind)) {
    return { syntax: "compound-assignment" };
  }

  return undefined;
}

function isUpdateTarget(node) {
  const parent = node.parent;
  const unary = ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent);
  const stepping =
    unary &&
    (parent.operator === ts.SyntaxKind.PlusPlusToken ||
      parent.operator === ts.SyntaxKind.MinusMinusToken);
  return stepping;
}

function isNonReadingContext(node) {
  const parent = node.parent;

  if (ts.isDeleteExpression(parent)) {
    return true;
  }

  const looping = ts.isForOfStatement(parent) || ts.isForInStatement(parent);

  if (looping && parent.initializer === node) {
    return true;
  }

  return isAssignmentPatternMember(node);
}

/**
 * The syntax under which an access reads the member it names, or `undefined`
 * when it does not read it at all. Context decides this, not the property
 * symbol: the same access spelling is a read in one position and a destination
 * in another.
 */
function readSyntaxOf(node, defaultSyntax) {
  const assignment = assignmentRole(node);

  if (assignment !== undefined) {
    return assignment.syntax;
  }

  if (isUpdateTarget(node)) {
    return "update-expression";
  }

  return isNonReadingContext(node) ? undefined : defaultSyntax;
}

function record(target, candidate, entry) {
  const existing = target.get(candidate.id);

  if (existing === undefined) {
    target.set(candidate.id, [entry]);
    return;
  }

  existing.push(entry);
}

function witnessAt(context, node, kind, syntax) {
  const { line, column } = positionOf(node);
  return { path: context.projectPath, line, column, kind, origin: context.origin, syntax };
}

function observeAll(context, candidates, node, kind, syntax) {
  for (const candidate of candidates) {
    record(context.witnesses, candidate, witnessAt(context, node, kind, syntax));
  }
}

/**
 * The declaration a binding pattern destructures, and the property path from it
 * down to the element being bound. The transfer walk resolves what actually
 * reaches that declaration; the path records what the pattern selected on the
 * way, so a nested binding names the member it really reached.
 */
function bindingSourceOf(element) {
  const selected = [];
  let pattern = element.parent;

  while (ts.isBindingElement(pattern.parent)) {
    const outer = pattern.parent;
    const key = ts.isObjectBindingPattern(outer.parent)
      ? identifierTextOf(outer.propertyName ?? outer.name)
      : undefined;

    if (key === undefined) {
      return undefined;
    }

    selected.unshift(key);
    pattern = outer.parent;
  }

  const owner = pattern.parent;
  const supported = ts.isVariableDeclaration(owner) || ts.isParameter(owner);
  return supported ? { source: owner, path: selected } : undefined;
}

/** The same question for an assignment pattern, whose source is an expression. */
function assignmentSourceOf(literal) {
  const selected = [];
  let current = literal;

  while (ts.isPropertyAssignment(current.parent)) {
    const assignment = current.parent;
    const key = ts.isObjectLiteralExpression(assignment.parent)
      ? identifierTextOf(assignment.name)
      : undefined;

    if (key === undefined) {
      return undefined;
    }

    selected.unshift(key);
    current = assignment.parent;
  }

  const parent = current.parent;
  const targeted = ts.isBinaryExpression(parent) && parent.left === current;
  return targeted ? { source: parent.right, path: selected } : undefined;
}

/**
 * Records where a read happened and which place supplied the value it read.
 *
 * The transfer walk starts from these. A read of `key` at `path` below `source`
 * is exactly the question a directed edge into `source` can answer: whatever
 * flowed in could be what supplied that member. `direct` is what this read
 * already proved on its own, so the walk never restates it.
 */
function recordRead(context, origin, key, node, kind, direct) {
  if (origin === undefined) {
    return;
  }

  const { line, column } = positionOf(node);
  context.reads.push({
    source: origin.source,
    path: origin.path,
    key,
    kind,
    origin: context.origin,
    site: { path: context.projectPath, line, column },
    direct,
  });
}

function observePropertyAccess(node, context) {
  const syntax = readSyntaxOf(node, "property-access");

  if (syntax === undefined) {
    return;
  }

  const candidates = candidatesForName(context, node.name);
  observeAll(context, candidates, node.name, "value-read", syntax);
  recordRead(
    context,
    { source: node.expression, path: [] },
    node.name.text,
    node.name,
    "value-read",
    candidates,
  );
}

/**
 * The exact keys an element access can reach, or `undefined` when the key is not
 * bounded by literal types. A finite union of string literals names every member
 * it could select; anything wider is an analysis gap, not a read of everything.
 */
function boundedKeysOf(checker, argument) {
  const literal = literalTextOf(argument);

  if (literal !== undefined) {
    return [literal];
  }

  const argumentType = checker.getTypeAtLocation(argument);
  const constituents = argumentType.isUnion() ? argumentType.types : [argumentType];
  const keys = [];

  for (const constituent of constituents) {
    if (!constituent.isStringLiteral()) {
      return undefined;
    }

    keys.push(constituent.value);
  }

  return keys;
}

function receiverCandidates(context, receiverNode) {
  const receiver = context.checker.getTypeAtLocation(receiverNode);
  const found = [];

  for (const property of context.checker.getPropertiesOfType(receiver)) {
    addCandidatesOfSymbol(context, property, found);
  }

  return found;
}

function observeElementAccess(node, context) {
  const syntax = readSyntaxOf(node, "element-access");
  const keys = boundedKeysOf(context.checker, node.argumentExpression);

  if (keys === undefined) {
    const reached = receiverCandidates(context, node.expression);

    for (const candidate of reached) {
      record(context.unsupported, candidate, "unbounded-computed-access");
    }

    return;
  }

  if (syntax === undefined) {
    return;
  }

  for (const key of keys) {
    const candidates = candidatesForKey(context, node.expression, key);
    observeAll(context, candidates, node.argumentExpression, "value-read", syntax);
    recordRead(
      context,
      { source: node.expression, path: [] },
      key,
      node.argumentExpression,
      "value-read",
      candidates,
    );
  }
}

/**
 * A binding pattern reads the member it names on the source object. The local
 * name it binds to is irrelevant, so a rename, a default and a nested pattern
 * all count as reads of the source member.
 */
function observeBindingElement(node, context) {
  const keyNode = node.propertyName ?? node.name;
  const key = identifierTextOf(keyNode);

  if (key === undefined) {
    const reached = receiverCandidates(context, node.parent);

    for (const candidate of reached) {
      record(context.unsupported, candidate, "unresolved-binding-key");
    }

    return;
  }

  const candidates = candidatesForKey(context, node.parent, key);
  observeAll(context, candidates, keyNode, "value-read", "binding-destructuring");
  recordRead(context, bindingSourceOf(node), key, keyNode, "value-read", candidates);
}

function observeAssignmentPattern(node, context) {
  if (!isAssignmentTargetLiteral(node) && !isAssignmentPatternMember(node)) {
    return;
  }

  for (const property of node.properties) {
    const nameNode = property.name;

    if (nameNode === undefined || !ts.isIdentifier(nameNode)) {
      continue;
    }

    const found = [];
    const symbol = context.checker.getPropertySymbolOfDestructuringAssignment(nameNode);
    addCandidatesOfSymbol(context, symbol, found);
    observeAll(context, found, nameNode, "value-read", "assignment-destructuring");
    recordRead(context, assignmentSourceOf(node), nameNode.text, nameNode, "value-read", found);
  }
}

/**
 * An `in` test consumes a member's presence without reading its value, so it is
 * recorded as a presence observation and kept distinct from a value read.
 */
function observeInOperator(node, context) {
  if (!ts.isStringLiteral(node.left)) {
    return;
  }

  const candidates = candidatesForKey(context, node.right, node.left.text);
  observeAll(context, candidates, node.left, "presence", "presence-test");
  recordRead(
    context,
    { source: node.right, path: [] },
    node.left.text,
    node.left,
    "presence",
    candidates,
  );
}

function observeNode(node, context) {
  if (ts.isPropertyAccessExpression(node)) {
    observePropertyAccess(node, context);
    return;
  }

  if (ts.isElementAccessExpression(node)) {
    observeElementAccess(node, context);
    return;
  }

  if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
    observeBindingElement(node, context);
    return;
  }

  if (ts.isObjectLiteralExpression(node)) {
    observeAssignmentPattern(node, context);
    return;
  }

  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword) {
    observeInOperator(node, context);
  }
}

/**
 * A computed key written on a member declaration names the member; it does not
 * read one, so the walk stops before descending into it.
 */
function isDeclarationKey(node) {
  if (!ts.isComputedPropertyName(node)) {
    return false;
  }

  return ts.isPropertySignature(node.parent) || ts.isMethodSignature(node.parent);
}

/**
 * Walks one source file with an explicit worklist and an explicit budget, and
 * reports whether it finished. A syntax tree has exactly one parent per node, so
 * the walk cannot revisit a node and needs no seen-set; the budget is what bounds
 * it, and running out is a refusal to answer rather than a partial answer.
 *
 * Children are pushed in reverse so they pop in source order, which is what makes
 * the recorded witnesses deterministic.
 */
function walkSourceFile(sourceFile, context) {
  const stack = [sourceFile];
  const children = [];

  while (stack.length > 0) {
    if (context.budget.remaining <= 0) {
      return false;
    }

    const node = stack.pop();
    context.budget.remaining -= 1;

    if (ts.isTypeNode(node) || isDeclarationKey(node)) {
      continue;
    }

    observeNode(node, context);
    children.length = 0;
    ts.forEachChild(node, (child) => {
      children.push(child);
    });

    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

  return true;
}

/**
 * Walks value positions looking for observations of inventoried members.
 *
 * Type nodes are skipped outright: an indexed-access type, a `keyof` and a type
 * query all mention a member without reading one at run time. What remains is
 * classified by its syntax before any symbol is consulted, because the same
 * property access is a read in one position and a destination in another.
 *
 * Returns witnesses keyed by candidate id -- each carrying its own source site
 * and production or test origin -- analysis gaps keyed the same way, the read
 * sites the transfer walk starts from, and the budget exhaustion that stopped
 * the walk, if one did. Later stages read exactly these, so a gap is always
 * attributable and a cut-off walk is always distinguishable from a finished one.
 */
export function collectObservations({ program, checker, projectRoot, byDeclaration, budget }) {
  const witnesses = new Map();
  const unsupported = new Map();
  const reads = [];
  const symbolCache = new Map();
  const remaining = { remaining: budget };

  for (const sourceFile of program.getSourceFiles()) {
    const projectPath = toProjectPath(projectRoot, sourceFile.fileName);
    const origin = sourceFile.isDeclarationFile ? undefined : observationOrigin(projectPath);

    if (origin === undefined) {
      continue;
    }

    const finished = walkSourceFile(sourceFile, {
      checker,
      byDeclaration,
      witnesses,
      unsupported,
      reads,
      projectPath,
      origin,
      symbolCache,
      budget: remaining,
    });

    if (!finished) {
      return { witnesses, unsupported, reads, exhausted: { path: projectPath, budget } };
    }
  }

  return { witnesses, unsupported, reads, exhausted: undefined };
}

export function productionFileCount({ program, projectRoot }) {
  return program
    .getSourceFiles()
    .filter(
      (sourceFile) =>
        !sourceFile.isDeclarationFile &&
        isProductionPath(toProjectPath(projectRoot, sourceFile.fileName)),
    ).length;
}
