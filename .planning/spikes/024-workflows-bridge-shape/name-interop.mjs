// Integration check: does OUR generated command name satisfy THEIR name validator?
// Reuse claim under test: domain/name.ts::generatedCommandName already emits the
// `<plugin>:<name>` shape Claude uses for plugin workflows, and quintinshaw's
// isSafeSavedWorkflowName accepts it -- so no new name generator is needed.
import { generatedCommandName } from '/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/domain/name.ts';
import { isSafeSavedWorkflowName } from './node_modules/@quintinshaw/pi-dynamic-workflows/dist/workflow-saved.js';

const cases = [
  ['acme-tools', 'release-audit'],
  ['acme-tools', 'acme-tools-release-audit'], // RN-1 prefix elision
  ['a', 'b'],
  ['plugin-with-long-name', 'some-fairly-long-workflow-name-here'],
];

let allOk = true;
for (const [plugin, source] of cases) {
  let generated, accepted, note = '';
  try {
    generated = generatedCommandName(plugin, source);
    accepted = isSafeSavedWorkflowName(generated);
  } catch (e) {
    generated = '(threw)'; accepted = false; note = e.constructor.name + ': ' + String(e.message).slice(0, 40);
  }
  allOk &&= accepted;
  console.log(`  ${(plugin + ' + ' + source).padEnd(56)} -> ${String(generated).padEnd(40)} ${accepted ? 'ACCEPTED' : 'REJECTED ' + note}`);
}
console.log('\n  reuse claim holds:', allOk);
