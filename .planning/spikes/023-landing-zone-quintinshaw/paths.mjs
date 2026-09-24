import { createWorkflowStorage } from './node_modules/@quintinshaw/pi-dynamic-workflows/dist/workflow-saved.js';
import { workflowProjectPaths, workflowUserSavedDir } from './node_modules/@quintinshaw/pi-dynamic-workflows/dist/workflow-paths.js';
import { isSafeSavedWorkflowName } from './node_modules/@quintinshaw/pi-dynamic-workflows/dist/workflow-saved.js';

const FAKE_CWD = '/home/acolomba/some-project';
const paths = workflowProjectPaths(FAKE_CWD);
console.log('=== PATH MODEL for cwd=' + FAKE_CWD + ' ===');
console.log('  user saved     :', workflowUserSavedDir());
console.log('  project key    :', paths.key);
console.log('  project saved  :', paths.savedDir);
console.log('  LEGACY project :', paths.legacySavedDir);
console.log('  runs           :', paths.runsDir);

console.log('\n=== NAME RULES (Claude namespaces plugin workflows as <plugin>:<meta.name>) ===');
for (const n of ['release-audit', 'acme-tools:release-audit', 'a/b', '..', 'x'.repeat(129), 'has space', 'dot.name']) {
  console.log('  %s -> %s', JSON.stringify(n).padEnd(34), isSafeSavedWorkflowName(n) ? 'ACCEPTED' : 'rejected');
}
