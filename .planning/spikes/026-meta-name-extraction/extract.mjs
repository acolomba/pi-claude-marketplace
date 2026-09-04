// Extract a Claude workflow's `meta.name` the way a bridge must: statically,
// from source, without executing the script.
//
//   node extract.mjs                 # run the built-in case table
//   node extract.mjs <file.js> ...   # extract from real files
//
// Requires: acorn (already transitive via eslint; a bridge would declare it).

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { parse } from 'acorn';

/** Static AST extraction: `export const meta = { name: '...' }`. */
export function extractMetaName(source) {
  let ast;
  try {
    ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true });
  } catch (e) {
    return { ok: false, reason: `unparseable: ${e.constructor.name}` };
  }

  for (const node of ast.body) {
    const decl = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    if (!decl || decl.type !== 'VariableDeclaration') continue;

    for (const d of decl.declarations) {
      if (d.id?.type !== 'Identifier' || d.id.name !== 'meta') continue;
      if (d.init?.type !== 'ObjectExpression') return { ok: false, reason: 'meta is not an object literal' };

      for (const p of d.init.properties) {
        if (p.type !== 'Property') continue;
        const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
        if (key !== 'name') continue;
        if (p.value.type !== 'Literal' || typeof p.value.value !== 'string') {
          return { ok: false, reason: 'meta.name is not a string literal' };
        }
        return { ok: true, name: p.value.value };
      }
      return { ok: false, reason: 'meta has no name property' };
    }
  }
  return { ok: false, reason: 'no meta declaration' };
}

/** The naive alternative, for contrast. */
function regexMetaName(source) {
  const m = /name:\s*['"]([^'"]+)['"]/.exec(source);
  return m ? m[1] : null;
}

const CASES = [
  ['plain', `export const meta = { name: 'release-audit', description: 'x' };\nreturn 1;`],
  ['suffix-style file', `export const meta = {\n  name: 'drafter',\n  description: 'x',\n};\nreturn 1;`],
  // A header comment that mentions a name: the exact shape that broke BOTH engines'
  // text-level preprocessors during spike 022.
  ['decoy in comment', `// Usage: set meta = { name: 'WRONG-from-comment' } at the top.\nexport const meta = { name: 'right-from-ast', description: 'x' };\nreturn 1;`],
  ['decoy in string', `const help = "name: 'WRONG-from-string'";\nexport const meta = { name: 'right-again', description: 'x' };\nreturn help;`],
  ['double-quoted key', `export const meta = { "name": "quoted-key", description: 'x' };\nreturn 1;`],
  ['no meta at all', `return 42;`],
  ['meta without name', `export const meta = { description: 'x' };\nreturn 1;`],
  ['computed name', `const n = 'x'; export const meta = { name: n };\nreturn 1;`],
  ['syntax error', `export const meta = { name: 'oops'`],
];

const files = process.argv.slice(2);
if (files.length === 0) {
  console.log('  ' + 'case'.padEnd(20) + 'acorn'.padEnd(30) + 'regex');
  for (const [label, src] of CASES) {
    const a = extractMetaName(src);
    const r = regexMetaName(src);
    const av = a.ok ? a.name : `(${a.reason})`;
    const flag = a.ok && r !== null && a.name !== r ? '   <-- regex WRONG' : '';
    console.log('  ' + label.padEnd(20) + av.padEnd(30) + (r === null ? '(none)' : r) + flag);
  }
} else {
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const a = extractMetaName(src);
    const stem = basename(f).replace(/\.js$/, '');
    const name = a.ok ? a.name : `(${a.reason})`;
    console.log('  ' + basename(f).padEnd(26) + ('stem=' + stem).padEnd(30) + ('meta.name=' + name).padEnd(28) + (a.ok && a.name !== stem ? 'DIVERGES' : 'match'));
  }
}
