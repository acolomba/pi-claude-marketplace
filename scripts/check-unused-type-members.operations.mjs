import ts from "typescript";

/**
 * Whole-object operations for the unused-type-member gate.
 *
 * Most reads name one member. A few operations read an object's members all at
 * once instead: serialization walks it, a copy hands its values on, a deep
 * comparison descends through it. This module decides which calls those are,
 * which keys each one actually reads, and where a key is a question this
 * analysis cannot answer.
 *
 * Two rules hold everywhere here.
 *
 * An operation is settled by the declaration the checker resolved, never by the
 * spelling of the callee. A built-in is the member of an interface the default
 * library declares, or a function inside the ambient module that declares it, so
 * a local function that borrows the name is a different declaration and carries
 * none of the behaviour.
 *
 * A local wrapper earns a summary only by proving it in its own body: it must
 * pass one of its parameters into an operation this module already summarises.
 * The summary is then applied at the call site against the argument actually
 * written there, which is what keeps a caller's record alive through a wrapper
 * whose declared parameter is `unknown`. Change that body into one that
 * discards or merely returns its input and the proof is gone with it, because
 * nothing but the body ever established it.
 */

/** A serialization whose surviving keys this analysis cannot name. */
const serializerGap = "unmodeled-serializer-options";

/**
 * An operand whose members are not provably its own enumerable values. A
 * declared type states which members exist, not how the object carrying them
 * was built, so an accessor or a class instance leaves a whole-object read as a
 * question rather than an observation.
 */
const ownPropertiesGap = "unproven-own-properties";

// A path this deep is already past the point a reader follows by hand, and the
// transfer walk bounds its own trails at four segments. Stopping early
// under-credits, which leaves a finding to investigate rather than accepting a
// member nothing read.
const deepestReach = 3;

// A wrapper that hands its parameter on through more than this many local names
// is not a wrapper anybody reads as one.
const deepestWrapperHop = 2;

const defaultLibraryOwners = new Set(["JSON", "ObjectConstructor"]);

// `Object.keys` is deliberately absent: it enumerates names and reads no value,
// so it moves nothing and excuses nothing.
const enumeratingMembers = new Set(["values", "entries"]);

// The ambient modules Node's assertion library is declared in. A comparison is
// settled through the declaration inside one of these, so a local function of
// the same name is a different declaration and summarises nothing.
const assertionModules = new Set(["assert", "node:assert", "assert/strict", "node:assert/strict"]);

// Comparisons that walk both operands recursively. The identity members --
// `strictEqual` and its neighbours -- are deliberately absent: comparing two
// references reads no member of either.
const deepComparisons = new Set([
  "deepStrictEqual",
  "notDeepStrictEqual",
  "deepEqual",
  "notDeepEqual",
]);

/**
 * The interface a symbol is declared on inside the compiler's own default
 * library. `JSON.stringify` is the member of `interface JSON` in `lib.es5.d.ts`;
 * a local `stringify`, or a local object literal that spells the same two names,
 * resolves to a declaration in this project and reaches none of this.
 */
function defaultLibraryOwnerOf(symbol, program) {
  for (const declaration of symbol?.declarations ?? []) {
    const parent = declaration.parent;

    if (parent === undefined || !ts.isInterfaceDeclaration(parent)) {
      continue;
    }

    if (program.isSourceFileDefaultLibrary(declaration.getSourceFile())) {
      return parent.name.text;
    }
  }

  return undefined;
}

/** The ambient module a symbol is declared inside, if it is declared in one. */
function ambientModuleOf(symbol) {
  for (const declaration of symbol?.declarations ?? []) {
    let current = declaration.parent;

    while (current !== undefined) {
      if (ts.isModuleDeclaration(current) && ts.isStringLiteral(current.name)) {
        return current.name.text;
      }

      current = current.parent;
    }
  }

  return undefined;
}

function isAccessorMember(symbol) {
  return (symbol.declarations ?? []).some(
    (declaration) => ts.isGetAccessor(declaration) || ts.isSetAccessor(declaration),
  );
}

function isMethodMember(symbol) {
  return (symbol.declarations ?? []).some(
    (declaration) => ts.isMethodSignature(declaration) || ts.isMethodDeclaration(declaration),
  );
}

/**
 * A key a source can spell. The checker writes a symbol-keyed member as an
 * escaped name no property access reproduces, and `JSON.stringify` omits symbol
 * keys outright, so leaving them out is both the exact rule and the only
 * reportable one.
 */
function spelledKeyOf(symbol) {
  const name = symbol.getName();
  return name.startsWith("__@") ? undefined : name;
}

function propertyTypeOf(symbol, checker) {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  return declaration === undefined
    ? undefined
    : checker.getTypeOfSymbolAtLocation(symbol, declaration);
}

function constituentsOf(type) {
  return type.isUnion() ? type.types : [type];
}

/**
 * The keys one operation reads on one type, or the reason it cannot say.
 *
 * `toJSON` is the reason a serialization stops: the value written is whatever
 * that method returns, so the declared members are no longer what was read and
 * crediting them would be an invention.
 */
function eligibleKeysOf(type, summary, checker) {
  if (type.symbol !== undefined && (type.symbol.flags & ts.SymbolFlags.Class) !== 0) {
    return { keys: [], gap: ownPropertiesGap };
  }

  if (summary.skipMethods && checker.getPropertyOfType(type, "toJSON") !== undefined) {
    return { keys: [], gap: serializerGap };
  }

  const keys = [];

  for (const property of checker.getPropertiesOfType(type)) {
    if (isAccessorMember(property)) {
      return { keys: [], gap: ownPropertiesGap };
    }

    const key = spelledKeyOf(property);

    if (key === undefined || (summary.skipMethods && isMethodMember(property))) {
      continue;
    }

    if (summary.allow === undefined || summary.allow.includes(key)) {
      keys.push({ key, type: propertyTypeOf(property, checker) });
    }
  }

  return { keys, gap: undefined };
}

/**
 * Follows a container down to the values it holds, recording the synthetic path
 * segment for each step. An array of records is serialized element by element,
 * so the members that were read sit one element segment below the argument.
 */
function elementPathOf(type, path, context) {
  let current = type;
  let reached = path;

  while (
    reached.length < deepestReach &&
    (context.checker.isArrayType(current) || context.checker.isTupleType(current))
  ) {
    const element = context.checker.getTypeArguments(current)[0];

    if (element === undefined) {
      return undefined;
    }

    current = element;
    reached = [...reached, context.elementSegment];
  }

  return { type: current, path: reached };
}

function visitType(type, path, summary, context, found) {
  const reached = elementPathOf(type, path, context);

  if (reached === undefined || reached.path.length >= deepestReach) {
    return;
  }

  for (const constituent of constituentsOf(reached.type)) {
    visitShape(constituent, reached.path, summary, context, found);
  }
}

function visitShape(type, path, summary, context, found) {
  if (context.seen.has(type)) {
    return;
  }

  context.seen.add(type);
  const { keys, gap } = eligibleKeysOf(type, summary, context.checker);

  if (gap !== undefined) {
    found.gap ??= gap;
    return;
  }

  for (const { key, type: memberType } of keys) {
    found.reads.push({ path, key });

    if (summary.recursive && memberType !== undefined) {
      visitType(memberType, [...path, key], summary, context, found);
    }
  }

  context.seen.delete(type);
}

/**
 * Every place this operation reads on this operand: the path from the operand
 * down to the object being read, and the key read there. A shallow operation
 * stops at the operand's own keys; a recursive one keeps descending while the
 * path stays within reach.
 */
export function readsOfOperand(summary, operand, checker, elementSegment) {
  const found = { reads: [], gap: undefined };
  const context = { checker, elementSegment, seen: new Set() };
  visitType(checker.getTypeAtLocation(operand.node), [], summary, context, found);

  if (found.gap !== undefined) {
    return { reads: [], gap: found.gap };
  }

  return {
    reads: found.reads.filter((read) => !operand.exclude.includes(read.key)),
    gap: undefined,
  };
}

function operandsOf(nodes) {
  return nodes.filter((node) => node !== undefined).map((node) => ({ node, exclude: [] }));
}

/**
 * The keys a `JSON.stringify` replacer leaves in place, or the reason the run
 * cannot say. An array of string literals names every key that survives; a
 * function, a computed array or a variable decides at run time, and this
 * analysis does not evaluate it.
 */
function replacerOf(argument) {
  if (argument === undefined || argument.kind === ts.SyntaxKind.NullKeyword) {
    return { allow: undefined, gap: undefined };
  }

  if (!ts.isArrayLiteralExpression(argument)) {
    return { allow: undefined, gap: serializerGap };
  }

  const allow = [];

  for (const element of argument.elements) {
    if (!ts.isStringLiteral(element)) {
      return { allow: undefined, gap: serializerGap };
    }

    allow.push(element.text);
  }

  return { allow, gap: undefined };
}

function serializationSummary(call) {
  const { allow, gap } = replacerOf((call.arguments ?? [])[1]);
  return {
    syntax: "json-serialization",
    recursive: true,
    skipMethods: true,
    allow,
    gap,
    operands: operandsOf([(call.arguments ?? [])[0]]),
  };
}

/**
 * A copy reads its source's values and hands them on unchanged. It stops at
 * those values: copying a record does not read the members of the records it
 * holds, so the operation is shallow by the same rule that makes it a copy.
 */
function copySummary(nodes) {
  return {
    syntax: "object-copy",
    recursive: false,
    skipMethods: false,
    allow: undefined,
    gap: undefined,
    operands: operandsOf(nodes),
  };
}

/**
 * `Object.assign` reads its sources and writes its target. Naming the target as
 * a source too would credit every member of a shape that was only written into.
 */
function objectConstructorSummary(call, name) {
  const args = call.arguments ?? [];

  if (name === "assign") {
    return copySummary(args.slice(1));
  }

  if (!enumeratingMembers.has(name)) {
    return undefined;
  }

  return { ...copySummary([args[0]]), syntax: "object-enumeration" };
}

/**
 * A deep comparison reads both operands, but only one of them says anything
 * about production: the side whose value came out of production code. An
 * expected literal a test wrote is read just as thoroughly and proves nothing,
 * so the summary demands production lineage and the caller establishes it.
 */
function assertionSummary(call, symbol) {
  const ambient = ambientModuleOf(symbol);

  if (ambient === undefined || !assertionModules.has(ambient)) {
    return undefined;
  }

  if (!deepComparisons.has(symbol.getName())) {
    return undefined;
  }

  return {
    syntax: "deep-comparison",
    recursive: true,
    skipMethods: false,
    allow: undefined,
    gap: undefined,
    lineage: "production",
    operands: operandsOf((call.arguments ?? []).slice(0, 2)),
  };
}

function defaultLibrarySummary(call, symbol, program) {
  const owner = defaultLibraryOwnerOf(symbol, program);

  if (owner === undefined || !defaultLibraryOwners.has(owner)) {
    return undefined;
  }

  const name = symbol.getName();

  if (owner === "ObjectConstructor") {
    return objectConstructorSummary(call, name);
  }

  return name === "stringify" ? serializationSummary(call) : undefined;
}

/** The copy an object spread carries out on the expression it spreads. */
export function spreadSummary(property) {
  return copySummary([property.expression]);
}

/**
 * The copy a rest binding carries out, and the keys the pattern already took
 * out of it. The source is the expression the pattern destructures, so the
 * members settle on the type actually written there rather than on the
 * synthesized remainder, and the walk carries on from it exactly as it does for
 * any other expression. A pattern with no expression to destructure -- a nested
 * one, or a loop binding -- is left alone rather than guessed at.
 */
export function restSummary(element) {
  const pattern = element.parent;
  const owner = pattern.parent;
  const source = ts.isVariableDeclaration(owner) ? owner.initializer : owner;

  if (source === undefined || (!ts.isVariableDeclaration(owner) && !ts.isParameter(owner))) {
    return undefined;
  }

  const exclude = [];

  for (const sibling of pattern.elements) {
    const name = sibling.propertyName ?? sibling.name;

    if (sibling !== element && ts.isIdentifier(name)) {
      exclude.push(name.text);
    }
  }

  return { ...copySummary([source]), operands: [{ node: source, exclude }] };
}

/** The parameter position an expression names, following local aliases. */
function parameterPositionOf(node, target, checker) {
  let current = node;

  for (let hop = 0; hop <= deepestWrapperHop; hop += 1) {
    if (!ts.isIdentifier(current)) {
      return undefined;
    }

    const declaration = checker.getSymbolAtLocation(current)?.declarations?.[0];

    if (declaration === undefined) {
      return undefined;
    }

    if (ts.isParameter(declaration)) {
      const position = target.parameters.indexOf(declaration);
      return position < 0 ? undefined : position;
    }

    if (!ts.isVariableDeclaration(declaration) || declaration.initializer === undefined) {
      return undefined;
    }

    current = declaration.initializer;
  }

  return undefined;
}

function hasBody(node) {
  return node !== undefined && ts.isFunctionLike(node) && node.body !== undefined;
}

function callsWithin(body) {
  const found = [];
  const stack = [body];

  while (stack.length > 0) {
    const node = stack.pop();

    if (ts.isCallExpression(node)) {
      found.push(node);
    }

    const children = [];
    ts.forEachChild(node, (child) => {
      children.push(child);
    });

    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

  return found;
}

export function createOperationModel({ checker, program, resolveTarget, calleeSymbolOf }) {
  const wrappers = new Map();
  const active = new Set();

  /**
   * The operation a call carries out, or nothing when it carries out none. A
   * built-in is settled by its declaring library interface; anything else has
   * to prove itself from the body the checker resolved the call into.
   */
  function summaryOfCall(call) {
    if (!ts.isCallExpression(call)) {
      return undefined;
    }

    const symbol = calleeSymbolOf(call);
    const builtIn = defaultLibrarySummary(call, symbol, program) ?? assertionSummary(call, symbol);

    if (builtIn !== undefined) {
      return builtIn;
    }

    const target = resolveTarget(call);

    if (!hasBody(target)) {
      return undefined;
    }

    const wrapper = wrapperSummaryOf(target);
    const argument = wrapper === undefined ? undefined : (call.arguments ?? [])[wrapper.position];
    return argument === undefined
      ? undefined
      : { ...wrapper.summary, operands: operandsOf([argument]) };
  }

  /**
   * The operation a function body carries out on one of its own parameters.
   *
   * The proof is the body and nothing else. A body that returns its parameter,
   * or ignores it, reaches no summarised operation and therefore earns no
   * summary, which is what makes a changed body invalidate the witnesses its
   * callers used to receive.
   */
  function wrapperSummaryOf(target) {
    if (wrappers.has(target)) {
      return wrappers.get(target);
    }

    if (active.has(target)) {
      return undefined;
    }

    active.add(target);
    const found = searchWrapperBody(target);
    active.delete(target);
    wrappers.set(target, found);
    return found;
  }

  function searchWrapperBody(target) {
    for (const call of callsWithin(target.body)) {
      const summary = summaryOfCall(call);

      for (const operand of summary?.operands ?? []) {
        const position = parameterPositionOf(operand.node, target, checker);

        if (position !== undefined) {
          return { position, summary };
        }
      }
    }

    return undefined;
  }

  return { summaryOfCall };
}
