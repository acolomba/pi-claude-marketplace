// Phase 1 placeholder. Real exports land in subsequent phases per the
// Planned Contents list in this folder's README.md. The empty `export {}`
// keeps this file a module under "type": "module" and lets test fixtures
// and forward-reference imports resolve without ENOENT (so the
// `import-x/no-restricted-paths` canary at tests/fixtures/bad-imports/
// can violate THIS file's path without also tripping
// `import-x/no-unresolved`).
export {};
