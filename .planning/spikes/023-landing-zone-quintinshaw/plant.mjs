import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWorkflowStorage } from './node_modules/@quintinshaw/pi-dynamic-workflows/dist/workflow-saved.js';
import { workflowProjectPaths, workflowUserSavedDir } from './node_modules/@quintinshaw/pi-dynamic-workflows/dist/workflow-paths.js';

const CWD = process.env.FAKE_CWD;
const paths = workflowProjectPaths(CWD);

// A bridged artifact, hand-written the way a bridge's commit step would:
// the Claude script verbatim inside quintinshaw's JSON envelope.
const CLAUDE_SCRIPT = [
  "export const meta = { name: 'release-audit', description: 'audit the release' };",
  "log('bridged from a claude plugin');",
  "return { ok: true };",
].join('\n');

const envelope = (name) => JSON.stringify({
  name,
  description: 'audit the release',
  script: CLAUDE_SCRIPT,
}, null, 2);

// Plant into all three read locations, each with a distinguishable name.
const targets = {
  'canonical project': [paths.savedDir, 'acme-tools:proj-canonical'],
  'legacy project':    [paths.legacySavedDir, 'acme-tools:proj-legacy'],
  'user':              [workflowUserSavedDir(), 'acme-tools:user-scope'],
};
for (const [label, [dir, name]] of Object.entries(targets)) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), envelope(name));
  console.log(`  planted ${label.padEnd(18)} -> ${join(dir, name + '.json')}`);
}

console.log('\n=== storage.list() sees ===');
const storage = createWorkflowStorage(CWD);
for (const w of storage.list()) {
  console.log(`  ${w.name.padEnd(28)} location=${w.location.padEnd(8)} scriptBytes=${w.script.length}`);
}

console.log('\n=== storage.load() round-trip ===');
const one = storage.load('acme-tools:proj-legacy');
console.log('  loaded:', one ? one.name : '(null)');
console.log('  script survived verbatim:', one ? (one.script === CLAUDE_SCRIPT) : false);
