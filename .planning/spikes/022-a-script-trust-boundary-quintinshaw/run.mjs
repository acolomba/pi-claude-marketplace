// Drive the REAL @quintinshaw/pi-dynamic-workflows engine over a fixture.
//
//   npm install @quintinshaw/pi-dynamic-workflows@3.5.1
//   node run.mjs                          # probe.workflow.js
//   node run.mjs determinism.workflow.js  # expect SCRIPT_VALIDATION_ERROR
//
// The engine's dist is imported by file path: its package.json `exports` map
// publishes only ".", so a subpath specifier fails with ERR_PACKAGE_PATH_NOT_EXPORTED.
import { readFileSync } from 'node:fs';

import { runWorkflow } from './node_modules/@quintinshaw/pi-dynamic-workflows/dist/workflow.js';

const fixture = process.argv[2] ?? 'probe.workflow.js';
const script = readFileSync(new URL(fixture, import.meta.url), 'utf8');

// The fixtures never call agent(), so no spawn machinery, model auth, or token
// spend is involved. persistLogs:false keeps the run from writing a log file.
const res = await runWorkflow(script, { persistLogs: false, cwd: process.cwd() });

console.log(JSON.stringify({ engine: '@quintinshaw/pi-dynamic-workflows', fixture, result: res.result ?? res.value ?? res }, null, 2));
