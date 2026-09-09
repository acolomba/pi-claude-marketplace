export const MF_DEC_01_IDS = Object.freeze([
  "BA-009",
  "BA-012",
  "BC-003",
  "BC-004",
  "BC-013",
  "BC-017",
  "BC-019",
  "BC-021",
  "BSKL-013",
  "DC-008",
  "DC-033",
  "EHR-F09",
  "ER-F19",
  "HIF-037",
  "HRA-010",
  "OMR-F13",
  "ORN-F011",
  "ORN-F016",
  "PER-F020",
  "SHC-F004",
  "SHC-F023",
  "SHC-F054",
  "SNA-F007",
  "SNC-F023",
]);

/**
 * @typedef {object} CensusRow
 * @property {string} id
 * @property {string} sourcePath
 * @property {string} symbol
 * @property {string} ownerTest
 * @property {string} graph
 * @property {"phase-06" | "phase-08" | "retained" | "already-removed"} route
 * @property {string} evidence
 */

/** @type {readonly (readonly [string, string])[]} */
export const OWNER_PAIRS = Object.freeze([]);
/** @type {readonly string[]} */
export const CATALOG_FIXTURES = Object.freeze([]);
/** @type {readonly string[]} */
export const LEGACY_HUBS = Object.freeze([]);
/** @type {readonly CensusRow[]} */
export const CENSUS_ROWS = Object.freeze([]);

/** @param {unknown} _input @returns {string[]} */
export function validateCensus(_input) {
  return ["not implemented"];
}

/** @param {unknown} _input @returns {string[]} */
export function validatePreedit(_input) {
  return ["not implemented"];
}

/** @param {unknown} _input @returns {string[]} */
export function validateClosure(_input) {
  return ["not implemented"];
}
