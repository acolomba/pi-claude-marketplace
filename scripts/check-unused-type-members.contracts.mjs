import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import {
  AnalysisSetupError,
  propertySymbolOf,
  resolveCandidates,
} from "./check-unused-type-members.model.mjs";

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
  "external-input": ["upstream", "necessity"],
  "nominal-brand": ["symbol"],
  "type-selection": ["filter"],
  "type-refinement": ["refines"],
};

// A refinement is followed one slot at a time into the shape it narrows. A
// chain longer than this is not something a maintainer reads as one narrowing,
// and stopping early refuses a contract rather than accepting an unproven one.
const deepestRefinement = 4;

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
 * The signatures an installed declaration expects this expression to satisfy.
 * The contextual type is what makes them a boundary: it is the shape an
 * installed declaration asked for, and the compiler checked the value against it.
 */
function externalCallSignatures(node, context) {
  const contextual = context.checker.getContextualType(node);

  if (contextual === undefined) {
    return [];
  }

  return context.checker
    .getSignaturesOfType(contextual, ts.SignatureKind.Call)
    .filter(
      (signature) =>
        signature.declaration !== undefined &&
        isExternalSource(signature.declaration.getSourceFile(), context.projectRoot),
    );
}

/**
 * The expression a return hands to an externally declared signature, or nothing
 * when no external declaration is expecting it.
 */
function externalReturnExpression(node, context) {
  if (!ts.isReturnStatement(node) || node.expression === undefined) {
    return undefined;
  }

  const container = enclosingFunction(node);

  if (container === undefined || insideAssertion(container)) {
    return undefined;
  }

  return externalCallSignatures(container, context).length > 0 ? node.expression : undefined;
}

function literalNameOf(node) {
  const name = node.name;
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

/**
 * The inventoried declarations a written slot fills. The contextual type is the
 * shape being built, so its property is the declaration the value is placed on;
 * the object literal's own synthetic property is not.
 *
 * That contextual type is a union whenever an `async` body is annotated with a
 * promise of the shape, because such a body may hand back the value or a
 * thenable of it. `propertySymbolOf` is what settles which arm a key belongs
 * to, and it refuses two arms rather than guessing -- the same rule the
 * transfer walk applies to a place a value flowed through.
 */
function originCandidates(node, context) {
  if (!ts.isPropertyAssignment(node) && !ts.isShorthandPropertyAssignment(node)) {
    return [];
  }

  const key = literalNameOf(node);
  const contextual = key === undefined ? undefined : context.checker.getContextualType(node.parent);
  const symbol =
    contextual === undefined ? undefined : propertySymbolOf(contextual, key, context.checker);
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

/**
 * The declaration node the contract's identity resolves to, settled against the
 * inventory's own declaration map. A coordinate that has drifted onto some other
 * syntax is refused here rather than silently proved against the wrong member.
 */
function declarationOf(entry, candidate, context) {
  const node = resolveNode(parseSite(entry.id, "id"), `${entry.id} declaration`, context);

  if (context.byDeclaration.get(node) !== candidate) {
    fail(`${entry.id} does not resolve to the declaration of ${candidate.owner}.${candidate.key}`);
  }

  return node;
}

function uniqueKeySymbol(node, context) {
  if (!ts.isPropertySignature(node) || !ts.isComputedPropertyName(node.name)) {
    return undefined;
  }

  const symbol = context.checker.getSymbolAtLocation(node.name.expression);

  if (symbol === undefined) {
    return undefined;
  }

  const type = context.checker.getTypeOfSymbolAtLocation(symbol, node.name.expression);
  return (type.flags & ts.TypeFlags.UniqueESSymbol) === 0 ? undefined : symbol;
}

/**
 * A brand slot may not carry a value an ordinary object could supply. `never` and
 * the unit types are the shapes nothing outside the branding module can produce,
 * which is what makes the marker a compile-time proof rather than a field.
 */
function assertMarkerType(entry, node, context) {
  const declared =
    node.type === undefined ? undefined : context.checker.getTypeFromTypeNode(node.type);

  if (declared !== undefined && (declared.flags & (ts.TypeFlags.Never | ts.TypeFlags.Unit)) !== 0) {
    return;
  }

  const described = declared === undefined ? "nothing" : context.checker.typeToString(declared);
  fail(`${entry.id} declares type ${described}, which an ordinary value can supply`);
}

/**
 * Proves a member is a nominal brand: a key spelled by a `unique symbol` that no
 * other module can reach, carrying a type no ordinary value satisfies. An
 * exported key symbol fails, because then the shape can be minted anywhere.
 */
function proveNominalBrand(entry, candidate, context) {
  const node = declarationOf(entry, candidate, context);
  const keySymbol = uniqueKeySymbol(node, context);

  if (keySymbol === undefined) {
    fail(`${entry.id} does not declare a computed unique-symbol key`);
  }

  const [declaration] = keySymbol.declarations ?? [];
  const site = declaration === undefined ? "nowhere" : siteKeyOf(declaration, context.projectRoot);

  if (site !== entry.symbol) {
    fail(`${entry.id} key symbol is declared at ${site}, not ${entry.symbol}`);
  }

  if ((ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Export) !== 0) {
    fail(`${entry.id} key symbol ${candidate.key} is exported, so any module can mint this shape`);
  }

  assertMarkerType(entry, node, context);
  return `(unique symbol ${entry.symbol} cannot be spelled outside its module)`;
}

/** The two-argument selection whose filter literal holds this member, if any. */
function selectionOf(node) {
  const literal = node.parent;
  const reference = literal?.parent;
  const holds =
    literal !== undefined &&
    ts.isTypeLiteralNode(literal) &&
    reference !== undefined &&
    ts.isTypeReferenceNode(reference) &&
    reference.typeArguments?.length === 2 &&
    reference.typeArguments[1] === literal;
  return holds ? reference : undefined;
}

/**
 * The distinct unit types the constituents declare for one key, or nothing when
 * the key does not tell them apart. Every constituent has to spell the key as a
 * unit type, and at least two of those spellings have to differ: a key every
 * variant spells the same way selects nothing, so no filter over it can be
 * doing type-system work. Two variants sharing one spelling is not that case --
 * the key still sorts the union into groups, and a filter selects one of them.
 */
function discriminantTypes(union, key, context) {
  const seen = [];

  for (const constituent of union.types) {
    const property = context.checker.getPropertyOfType(constituent, key);
    const declaration = property?.declarations?.[0];

    if (declaration === undefined) {
      return undefined;
    }

    const type = context.checker.getTypeOfSymbolAtLocation(property, declaration);

    if ((type.flags & ts.TypeFlags.Unit) === 0) {
      return undefined;
    }

    if (!seen.includes(type)) {
      seen.push(type);
    }
  }

  return seen.length > 1 ? seen : undefined;
}

function unionSize(type) {
  return type.isUnion() ? type.types.length : 1;
}

/**
 * Whether the checker left the selection unresolved because a type parameter is
 * still open. A deferred selection cannot be counted, so the discriminant proof
 * is the only evidence available for it.
 */
function isDeferred(type) {
  const parts = type.isUnion() ? type.types : [type];
  return parts.some((part) => (part.flags & ts.TypeFlags.Conditional) !== 0);
}

/**
 * The union a selection really chooses from. A type parameter stands for
 * whatever satisfies its bound, so the bound is the set the filter selects
 * within and the place the discriminant has to live. An unbounded parameter
 * stands for everything and resolves to itself, which discriminates nothing.
 */
function selectionSourceOf(filterNode, context) {
  const written = context.checker.getTypeFromTypeNode(filterNode.typeArguments[0]);
  return written.isTypeParameter()
    ? (context.checker.getBaseConstraintOfType(written) ?? written)
    : written;
}

/**
 * The two-argument selection a coordinate names. Several nodes can begin at one
 * character -- an indexed access and the selection it reads a slot out of --
 * and a site resolves to the outermost of them. The selection is whichever one
 * of them is one, so the search descends while the start does not move.
 */
function selectionNodeAt(node) {
  let current = node;

  while (current !== undefined) {
    if (ts.isTypeReferenceNode(current) && current.typeArguments?.length === 2) {
      return current;
    }

    current = ts.forEachChild(current, (child) =>
      child.getStart() === node.getStart() ? child : undefined,
    );
  }

  return undefined;
}

/**
 * Proves a member exists to select a variant rather than to be read. The member
 * has to sit in the filter position of the named selection, the source has to
 * discriminate on its key, and a selection the checker already resolved has to
 * come back narrower than it started.
 */
function proveTypeSelection(entry, candidate, context) {
  const filterNode = selectionNodeAt(
    resolveNode(parseSite(entry.filter, `${entry.id} filter`), `${entry.id} filter`, context),
  );

  if (filterNode === undefined) {
    fail(`${entry.id} filter ${entry.filter} is not a two-argument type selection`);
  }

  if (selectionOf(declarationOf(entry, candidate, context)) !== filterNode) {
    fail(`${entry.id} is not a member of the filter at ${entry.filter}`);
  }

  const source = selectionSourceOf(filterNode, context);

  if (!source.isUnion() || discriminantTypes(source, candidate.key, context) === undefined) {
    fail(
      `${entry.id} filter ${entry.filter} selects over a type that does not discriminate on ${candidate.key}`,
    );
  }

  const resolved = context.checker.getTypeFromTypeNode(filterNode);

  if (!isDeferred(resolved) && unionSize(resolved) >= unionSize(source)) {
    fail(`${entry.id} filter ${entry.filter} selects the whole union, so it refines nothing`);
  }

  return `(filter ${entry.filter} selects by ${candidate.key})`;
}

/**
 * Whether the installed declaration insists on this key. An optional upstream
 * slot compels no local mirror, which is the difference between a member the
 * boundary needs and one it merely happens to have.
 */
function upstreamRequires(entry, candidate, node, context) {
  const named =
    (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) &&
    literalNameOf(node) === candidate.key &&
    isExternalSource(node.getSourceFile(), context.projectRoot);

  if (!named) {
    fail(
      `${entry.id} upstream ${entry.upstream} does not declare ${candidate.key} in an installed declaration`,
    );
  }

  if (node.questionToken !== undefined) {
    fail(
      `${entry.id} upstream ${entry.upstream} declares ${candidate.key} as optional, so no local mirror is compelled`,
    );
  }
}

function signatureRequires(signature, key, context) {
  return signature.parameters.some((parameter) => {
    const type = context.checker.getTypeOfSymbolAtLocation(parameter, signature.declaration);
    const property = context.checker.getPropertyOfType(type, key);
    return property !== undefined && (property.flags & ts.SymbolFlags.Optional) === 0;
  });
}

function suppliesCandidate(parameter, candidate, context) {
  const type = context.checker.getTypeAtLocation(parameter);
  const property = context.checker.getPropertyOfType(type, candidate.key);
  return (
    property !== undefined &&
    resolveCandidates(context.checker, context.byDeclaration, property).includes(candidate)
  );
}

/**
 * Proves the local mirror carries its own weight: an installed declaration
 * checks this callback, that declaration requires the key, and this callback's
 * own parameter is the declaration the contract names.
 */
function assertLocalNecessity(entry, candidate, node, context) {
  if (!ts.isFunctionLike(node)) {
    fail(
      `${entry.id} necessity ${entry.necessity} is not a callback an external declaration checks`,
    );
  }

  if (insideAssertion(node)) {
    fail(
      `${entry.id} necessity ${entry.necessity} is reached only through an assertion, which checks nothing`,
    );
  }

  const checked = externalCallSignatures(node, context).some((signature) =>
    signatureRequires(signature, candidate.key, context),
  );

  if (!checked) {
    fail(
      `${entry.id} necessity ${entry.necessity} is not checked against an external declaration that requires ${candidate.key}`,
    );
  }

  if (!node.parameters.some((parameter) => suppliesCandidate(parameter, candidate, context))) {
    fail(
      `${entry.id} necessity ${entry.necessity} does not receive ${candidate.owner}.${candidate.key}`,
    );
  }
}

function proveExternalInput(entry, candidate, context) {
  const upstreamNode = resolveNode(
    parseSite(entry.upstream, `${entry.id} upstream`),
    `${entry.id} upstream`,
    context,
  );
  const necessityNode = resolveNode(
    parseSite(entry.necessity, `${entry.id} necessity`),
    `${entry.id} necessity`,
    context,
  );
  upstreamRequires(entry, candidate, upstreamNode, context);
  assertLocalNecessity(entry, candidate, necessityNode, context);
  return `(upstream ${entry.upstream} requires it at ${entry.necessity})`;
}

/**
 * The chain of keys leading from one operand of this intersection down to this
 * declaration, and nothing when the declaration sits somewhere else entirely. A
 * member of a literal nested inside an operand narrows the same slot one level
 * further in, so its path is just longer.
 */
function refinementPathOf(node, intersection) {
  const path = [];
  let current = node;

  while (
    current !== undefined &&
    ts.isPropertySignature(current) &&
    path.length <= deepestRefinement
  ) {
    const key = literalNameOf(current);
    const literal = current.parent;

    if (key === undefined || literal === undefined || !ts.isTypeLiteralNode(literal)) {
      return undefined;
    }

    path.unshift(key);

    if (intersection.types.includes(literal)) {
      return { path, operand: literal };
    }

    current = literal.parent;
  }

  return undefined;
}

/**
 * The slot one chain of keys leads to -- its type and whether the shape may
 * leave it out -- or nothing when the chain breaks. Both sides of a comparison
 * are read this way so an optional slot's type is spelled the same on each.
 */
function slotAlongPath(type, path, context) {
  let current = type;
  let optional = false;

  for (const key of path) {
    const property = context.checker.getPropertyOfType(current, key);
    const declaration = property?.valueDeclaration ?? property?.declarations?.[0];

    if (property === undefined || declaration === undefined) {
      return undefined;
    }

    optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
    current = context.checker.getTypeOfSymbolAtLocation(property, declaration);
  }

  return { type: current, optional };
}

/**
 * The set of values a type admits, as the constituents it is drawn from.
 *
 * `never` admits nothing, so its set is empty -- which is what makes an absence
 * marker a narrowing: the empty set is strictly smaller than any non-empty one
 * and is vacuously drawn from it. A marker over a slot the rest of the shape
 * already closes compares an empty set against an empty set and still narrows
 * nothing.
 */
function constituentsOf(type) {
  if ((type.flags & ts.TypeFlags.Never) !== 0) {
    return [];
  }

  return type.isUnion() ? type.types : [type];
}

function narrowsShape(refined, wider, context, depth) {
  let narrowed = false;

  for (const property of context.checker.getPropertiesOfType(refined)) {
    const inner = slotAlongPath(refined, [property.name], context);
    const outer = slotAlongPath(wider, [property.name], context);

    if (inner === undefined || outer === undefined) {
      return false;
    }

    narrowed = narrowsSlot(inner, outer, context, depth - 1) || narrowed;
  }

  return narrowed;
}

/**
 * Whether the refined type admits strictly less than the wider one already did.
 *
 * A shape narrows when every slot it spells is a slot the wider shape already
 * has and at least one of them is itself narrower; a slot the wider shape does
 * not have is an addition, not a narrowing. Anything else narrows only by
 * leaving out possibilities the wider type allowed, which is fewer constituents
 * drawn from the same set.
 */
function narrows(refined, wider, context, depth) {
  if (depth > 0 && !refined.isUnion() && (refined.flags & ts.TypeFlags.Object) !== 0) {
    return narrowsShape(refined, wider, context, depth);
  }

  const allowed = constituentsOf(wider);
  const chosen = constituentsOf(refined);
  return chosen.length < allowed.length && chosen.every((part) => allowed.includes(part));
}

/**
 * Whether one slot narrows another. Insisting on a slot the wider shape lets a
 * value omit is a narrowing in its own right: the refined shape then admits
 * strictly fewer values than one that could leave the slot out.
 */
function narrowsSlot(refined, wider, context, depth) {
  return (wider.optional && !refined.optional) || narrows(refined.type, wider.type, context, depth);
}

/**
 * The slot the rest of the intersection already gives this path, or nothing
 * when no other operand declares it at all.
 */
function widerSlotFor(intersection, operand, path, context) {
  for (const member of intersection.types) {
    if (member === operand) {
      continue;
    }

    const found = slotAlongPath(context.checker.getTypeFromTypeNode(member), path, context);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

/**
 * Proves a member exists to narrow a slot rather than to be read. The member has
 * to sit in an operand of the named intersection, the rest of the intersection
 * has to already declare the slot it names, and what this operand writes there
 * has to admit strictly less than what the rest allowed.
 */
function proveTypeRefinement(entry, candidate, context) {
  const node = declarationOf(entry, candidate, context);
  const site = parseSite(entry.refines, `${entry.id} refines`);
  const intersection = resolveNode(site, `${entry.id} refines`, context);

  if (!ts.isIntersectionTypeNode(intersection)) {
    fail(`${entry.id} refines ${entry.refines} is not an intersection type`);
  }

  const found = refinementPathOf(node, intersection);

  if (found === undefined) {
    fail(`${entry.id} is not a member of the intersection at ${entry.refines}`);
  }

  const wider = widerSlotFor(intersection, found.operand, found.path, context);

  if (wider === undefined) {
    fail(
      `${entry.id} refines ${entry.refines} adds ${candidate.key}, which the rest of the intersection does not declare`,
    );
  }

  const operandType = context.checker.getTypeFromTypeNode(found.operand);
  const refined = slotAlongPath(operandType, found.path, context);

  if (refined === undefined || !narrowsSlot(refined, wider, context, deepestRefinement)) {
    fail(`${entry.id} refines ${entry.refines} does not narrow ${candidate.key}`);
  }

  return `(intersection ${entry.refines} narrows ${found.path.join(".")})`;
}

const provers = {
  "external-output": proveExternalOutput,
  "external-input": proveExternalInput,
  "nominal-brand": proveNominalBrand,
  "type-selection": proveTypeSelection,
  "type-refinement": proveTypeRefinement,
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
