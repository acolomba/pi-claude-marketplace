// NFR-1 asks for atomic tmp+rename. rename() is atomic only WITHIN a filesystem.
// The agents bridge stages under <extensionRoot> and renames into <scopeRoot>/agents/
// -- same scopeRoot, therefore same FS. A workflows bridge targeting
// ~/.pi/workflows/ from a project-scope extensionRoot at <cwd>/.pi/ has no such
// guarantee: $HOME and the project checkout can be different mounts.
import { mkdtempSync, writeFileSync, renameSync, mkdirSync, rmSync } from 'node:fs';
import { statfsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const homeProbe = join(homedir(), '.pi-exdev-probe');
mkdirSync(homeProbe, { recursive: true });
const tmpStage = mkdtempSync(join(tmpdir(), 'wf-stage-'));

const fsidOf = (p) => { const s = statfsSync(p); return `type=0x${s.type.toString(16)} bsize=${s.bsize}`; };
console.log('  tmpdir  :', tmpdir(), '->', fsidOf(tmpdir()));
console.log('  homedir :', homedir(), '->', fsidOf(homedir()));

const src = join(tmpStage, 'a.json');
writeFileSync(src, '{}');
try {
  renameSync(src, join(homeProbe, 'a.json'));
  console.log('\n  cross-mount rename: SUCCEEDED (same filesystem on this machine)');
} catch (e) {
  console.log(`\n  cross-mount rename: FAILED ${e.code} -- ${e.message.slice(0, 60)}`);
  console.log('  => staging MUST live adjacent to the target, not under extensionRoot');
}
rmSync(homeProbe, { recursive: true, force: true });
rmSync(tmpStage, { recursive: true, force: true });
