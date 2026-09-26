// Can we reproduce @quintinshaw's project-key derivation exactly?
// OUR candidate implementation vs THEIR real workflowProjectKey, across edge cases.
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { workflowProjectPaths } from './node_modules/@quintinshaw/pi-dynamic-workflows/dist/workflow-paths.js';

// Candidate reimplementation, transcribed from their source.
function ourSanitize(value) {
  const s = value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return s || 'project';
}
function ourProjectKey(cwd) {
  const projectPath = resolve(cwd);
  const slug = ourSanitize(basename(projectPath) || 'project');
  const hash = createHash('sha256').update(projectPath).digest('hex').slice(0, 12);
  return `${slug}-${hash}`;
}

const cases = [
  '/home/acolomba/some-project',
  '/home/acolomba/UPPER-Case-Name',
  '/home/acolomba/name with spaces & symbols!',
  '/home/acolomba/проект',
  '/home/acolomba/日本語プロジェクト',
  '/home/acolomba/---leading-and-trailing---',
  '/home/acolomba/' + 'a'.repeat(60),
  '/home/acolomba/' + 'a'.repeat(47) + '-b',   // truncation may leave a trailing dash
  '/home/acolomba/.hidden',
  '/home/acolomba/dots.in.name',
  '/',
  '/home/acolomba/trailing/',
  'relative/path',
  '/home/acolomba/../acolomba/some-project',   // must normalize to case 1
];

let mismatches = 0;
for (const c of cases) {
  const theirs = workflowProjectPaths(c).key;
  const ours = ourProjectKey(c);
  const match = theirs === ours;
  if (!match) mismatches++;
  console.log(`  ${match ? 'ok  ' : 'MISMATCH'} ${JSON.stringify(c).slice(0, 46).padEnd(48)} ${theirs}`);
}
console.log(`\n  cases: ${cases.length}, mismatches: ${mismatches}`);

// Does path normalization make two spellings of one project collide correctly?
const a = workflowProjectPaths('/home/acolomba/some-project').key;
const b = workflowProjectPaths('/home/acolomba/../acolomba/some-project').key;
console.log(`  normalization: two spellings -> same key: ${a === b}`);
