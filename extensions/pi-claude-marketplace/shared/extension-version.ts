// shared/extension-version.ts
//
// BFILL-02: the running extension version, exposed as a checked-in constant.
//
// This is a plain string literal, NOT a runtime `import ... with { type:
// "json" }` of package.json. The literal read is zero-I/O, needs no
// experimental Node feature at the NFR-4 floor (import-attributes JSON is
// experimental below Node 22 and emits a runtime warning), and stays offline
// (NFR-5). The literal MUST equal package.json `version`; a drift-guard test
// (tests/architecture/extension-version-sync.test.ts) fails CI on any desync,
// so the two are bumped in lockstep.
//
// Consumed by the load-time backfill version gate: it is compared against the
// persisted `lastReconciledExtensionVersion` stamp to decide whether the
// supported-kind boundary may have moved since the last reconcile.
export const EXTENSION_VERSION = "0.9.0";
