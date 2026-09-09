import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

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

const EXTENSION_ROOT = "extensions/pi-claude-marketplace";

/** @type {readonly (readonly [string, string])[]} */
export const OWNER_PAIRS = Object.freeze(
  [
    "domain/component-paths",
    "domain/hooks-resolution",
    "domain/mcp-resolution",
    "domain/plugin-resolver",
    "domain/resolver-types",
    "domain/unsupported-components",
    "shared/compare-name-scope",
    "shared/notification-dispatch",
    "shared/notification-grammar",
    "shared/notification-summary",
    "shared/notification-types",
    "shared/redact-absolute-paths",
    "orchestrators/plugin/install-clone-probe",
    "orchestrators/plugin/install-declared-enabled",
    "orchestrators/plugin/install-disable-cascade",
    "orchestrators/plugin/install-flow",
    "orchestrators/plugin/install-outcome",
    "orchestrators/plugin/update-cascade",
    "orchestrators/plugin/update-flow",
    "orchestrators/plugin/update-preflight",
    "orchestrators/plugin/update-swap",
    "orchestrators/plugin/reinstall-clone-probe",
    "orchestrators/plugin/reinstall-flow",
    "orchestrators/plugin/reinstall-record",
    "orchestrators/plugin/reinstall-replace",
    "orchestrators/plugin/reinstall-targets",
    "orchestrators/plugin/list-candidate-row",
    "orchestrators/plugin/list-flow",
    "orchestrators/plugin/list-installed-row",
    "orchestrators/plugin/list-orphan-fold",
  ].map((stem) => [`${EXTENSION_ROOT}/${stem}.ts`, `tests/${stem}.test.ts`]),
);

/** @type {readonly string[]} */
export const CATALOG_FIXTURES = Object.freeze(
  [
    "plugin-list",
    "plugin-install",
    "plugin-uninstall",
    "plugin-reinstall",
    "plugin-update",
    "plugin-fetch",
    "plugin-import",
    "plugin-bootstrap",
    "marketplace-list",
    "marketplace-add",
    "marketplace-info",
    "plugin-info",
    "plugin-pending",
    "reconcile-applied",
    "marketplace-remove",
    "marketplace-update",
    "plugin-enable",
    "plugin-disable",
    "marketplace-autoupdate",
    "marketplace-noautoupdate",
  ].map((stem) => `tests/architecture/catalog-uat/fixtures/${stem}.ts`),
);

/** @type {readonly string[]} */
export const LEGACY_HUBS = Object.freeze([
  `${EXTENSION_ROOT}/domain/resolver.ts`,
  `${EXTENSION_ROOT}/shared/notify.ts`,
  "tests/architecture/catalog-uat.test.ts",
  `${EXTENSION_ROOT}/orchestrators/plugin/install.ts`,
  `${EXTENSION_ROOT}/orchestrators/plugin/update.ts`,
  `${EXTENSION_ROOT}/orchestrators/plugin/reinstall.ts`,
  `${EXTENSION_ROOT}/orchestrators/plugin/list.ts`,
]);

const RESIDUAL_CENSUS_IGNORES = new Set([
  "scripts/check-phase-06-hub-ledger.mjs",
  "tests/scripts/check-phase-06-hub-ledger.test.ts",
]);

/** @type {readonly CensusRow[]} */
export const CENSUS_ROWS = Object.freeze([
  {
    id: "BA-009",
    sourcePath: `${EXTENSION_ROOT}/bridges/agents/frontmatter.ts`,
    symbol: "convertAgentFrontmatter / FoldState",
    ownerTest: "tests/bridges/agents/frontmatter.test.ts",
    graph: "agent staging -> frontmatter fold -> emitted Markdown",
    route: "phase-06",
    evidence:
      "Replacement: delete Object.prototype setter coverage; retain the typed fold guard and assert emitted frontmatter from plain case-owned fields.",
  },
  {
    id: "BA-012",
    sourcePath: `${EXTENSION_ROOT}/bridges/agents/convert.ts`,
    symbol: "convertAgent / tools projection",
    ownerTest: "tests/bridges/agents/convert.test.ts",
    graph: "agent discovery -> conversion -> diagnostic/output",
    route: "phase-06",
    evidence:
      "Replacement: remove the stateful tools getter and cover reachable omitted/declared tools with an ordinary case-owned agent object.",
  },
  {
    id: "BC-003",
    sourcePath: `${EXTENSION_ROOT}/bridges/commands/types.ts`,
    symbol: "StageCommandResult rename-pair projection",
    ownerTest: "tests/bridges/commands/stage.test.ts",
    graph: "command staging -> result projection -> command registry",
    route: "phase-06",
    evidence:
      "Replacement: use a case-owned filesystem obstruction and assert the complete public stage result instead of getter mutation.",
  },
  {
    id: "BC-004",
    sourcePath: `${EXTENSION_ROOT}/bridges/commands/discover.ts`,
    symbol: "discoverCommands / isErrnoException branch",
    ownerTest: "tests/bridges/commands/discover.test.ts",
    graph: "resources discovery -> command walk -> discovered command values",
    route: "phase-06",
    evidence:
      "Replacement: remove the lying errno accessor and builtin patch; a case-owned temporary tree preserves public discovery outcomes.",
  },
  {
    id: "BC-013",
    sourcePath: `${EXTENSION_ROOT}/bridges/commands/stage.ts`,
    symbol: "neutralizeCommandFrontmatter / generatedCommandName",
    ownerTest: "tests/bridges/commands/stage.test.ts",
    graph: "command frontmatter parse -> generated name -> staged bytes",
    route: "phase-06",
    evidence:
      "Replacement: remove String.prototype mutation and retain exact staged bytes for valid and invalid plain frontmatter inputs.",
  },
  {
    id: "BC-017",
    sourcePath: `${EXTENSION_ROOT}/bridges/commands/stage.ts`,
    symbol: "command staging/discovery lying-object census",
    ownerTest: "tests/bridges/commands/stage.test.ts",
    graph: "stage and discover owners -> rename/error projections -> public results",
    route: "phase-06",
    evidence:
      "Replacement: remove all six getter/prototype fabrications through the BC-003, BC-004, BC-013, and BC-019 owner routes.",
  },
  {
    id: "BC-019",
    sourcePath: `${EXTENSION_ROOT}/bridges/commands/discover.ts`,
    symbol: "badNameWarning / CommandNameError narrowing",
    ownerTest: "tests/bridges/commands/discover.test.ts",
    graph: "generated command-name validation -> warning -> discovered values",
    route: "phase-06",
    evidence:
      "Replacement: delete Symbol.hasInstance surgery while retaining compiler-required narrowing and exact malformed-name discovery output.",
  },
  {
    id: "BC-021",
    sourcePath: `${EXTENSION_ROOT}/bridges/commands/stage.ts`,
    symbol: "neutralizeCommandFrontmatter delimiter guards",
    ownerTest: "tests/bridges/commands/stage.test.ts",
    graph: "frontmatter parser -> delimiter neutralization -> staged bytes",
    route: "phase-06",
    evidence:
      "Replacement: delete String.prototype fabrication and retain exact outcomes from native parser inputs.",
  },
  {
    id: "BSKL-013",
    sourcePath: `${EXTENSION_ROOT}/bridges/skills/frontmatter-degrade.ts`,
    symbol: "degrade/rewrite frontmatter sparse-index guards",
    ownerTest: "tests/bridges/skills/frontmatter-degrade.test.ts",
    graph: "skill Markdown -> frontmatter degradation/rewrite -> emitted bytes",
    route: "phase-06",
    evidence:
      "Replacement: remove String.prototype.split fabrication; retain compiler guards and exact native-split byte outcomes.",
  },
  {
    id: "DC-008",
    sourcePath: `${EXTENSION_ROOT}/domain/components/hook-events.ts`,
    symbol: "isSupportedHookEvent",
    ownerTest: "tests/domain/components/hook-events.test.ts",
    graph: "hook manifest strings -> closed event validation -> supportability",
    route: "retained",
    evidence:
      "Trust boundary: the string-facing hook parser requires the closed-set guard; typed internal callers need no invalid-cast coverage.",
  },
  {
    id: "DC-033",
    sourcePath: `${EXTENSION_ROOT}/domain/components/hook-events.ts`,
    symbol: "isSupportedBucketAEvent",
    ownerTest: "tests/domain/components/hook-events.test.ts",
    graph: "parsed hook event -> Bucket-A classification -> routing",
    route: "retained",
    evidence:
      "Trust boundary: retain exhaustive Bucket-A classification with compile-time closed-union evidence, not a fabricated runtime member.",
  },
  {
    id: "EHR-F09",
    sourcePath: `${EXTENSION_ROOT}/edge/handlers/tools.ts`,
    symbol: "projectRowStatus",
    ownerTest: "tests/edge/handlers/tools.test.ts",
    graph: "plugin-list payload -> tool status projection -> LLM tool response",
    route: "retained",
    evidence:
      "Public projection remains production-used and rejects non-list statuses at the edge trust boundary; owner asserts returned tool rows and thrown values.",
  },
  {
    id: "ER-F19",
    sourcePath: `${EXTENSION_ROOT}/edge/args.ts`,
    symbol: "two dense indexed loops in edge args/shared handlers",
    ownerTest: "tests/edge/args.test.ts",
    graph: "tool arguments -> dense iteration -> parsed edge request",
    route: "phase-08",
    evidence:
      "Phase 8 RCOV-02 owns typed-iteration rewrites for both D-116-01a shortfalls; no Phase 6 edit is authorized.",
  },
  {
    id: "HIF-037",
    sourcePath: `${EXTENSION_ROOT}/bridges/hooks/if-field/index.ts`,
    symbol: "if-field path suffix parsing",
    ownerTest: "tests/bridges/hooks/if-field/index.test.ts",
    graph: "hook if-field -> path matcher -> dispatch eligibility",
    route: "phase-06",
    evidence:
      "Replacement: remove String.prototype.endsWith mutation and retain exact parser/matcher outcomes from ordinary strings.",
  },
  {
    id: "HRA-010",
    sourcePath: `${EXTENSION_ROOT}/bridges/hooks/async-rewake/registry.ts`,
    symbol: "spawned-child close finalization",
    ownerTest: "tests/bridges/hooks/async-rewake/registry.test.ts",
    graph: "owned child events -> exit/close fold -> dispatch outcome",
    route: "retained",
    evidence:
      "Lifecycle safety: retain the close fallback because child emitters are external; test real event sequences without replacing process globals.",
  },
  {
    id: "OMR-F13",
    sourcePath: `${EXTENSION_ROOT}/orchestrators/marketplace/remove.ts`,
    symbol: "marketplace source-kind removal projection",
    ownerTest: "tests/orchestrators/marketplace/remove.test.ts",
    graph: "recorded marketplace -> remove transaction -> state/tree/message",
    route: "phase-06",
    evidence:
      "Replacement: delete Object.prototype kind surgery and assert complete removal state/tree/output from normalized case-owned records.",
  },
  {
    id: "ORN-F011",
    sourcePath: `${EXTENSION_ROOT}/orchestrators/reconcile/notify.ts`,
    symbol: "reasonAsContent",
    ownerTest: "tests/orchestrators/reconcile/notify.test.ts",
    graph: "reconcile outcomes -> content reasons -> exact notification cascade",
    route: "retained",
    evidence:
      "Projection safety remains documented for scope-qualified sentinels; exact public cascade bytes, not a mutable discriminator, own the contract.",
  },
  {
    id: "ORN-F016",
    sourcePath: `${EXTENSION_ROOT}/orchestrators/reconcile/backfill.ts`,
    symbol: "backfill entry validation",
    ownerTest: "tests/orchestrators/reconcile/backfill.test.ts",
    graph: "manifest boundary -> backfill validation -> failed/success outcomes",
    route: "retained",
    evidence:
      "Trust boundary: repeated validation protects independently persisted manifests and remains covered through malformed case-owned input.",
  },
  {
    id: "PER-F020",
    sourcePath: `${EXTENSION_ROOT}/persistence/state-io.ts`,
    symbol: "firstValidationErrorDetail",
    ownerTest: "tests/persistence/state-io.test.ts",
    graph: "state bytes -> TypeBox validation -> redacted load error",
    route: "phase-06",
    evidence:
      "Replacement: remove validator-singleton surgery; retain exact malformed-state error and the defensive empty-detail fallback as compiler evidence.",
  },
  {
    id: "SHC-F004",
    sourcePath: `${EXTENSION_ROOT}/shared/fs-utils.ts`,
    symbol: "isPlainMarkdownFile",
    ownerTest: "tests/shared/fs-utils.test.ts",
    graph: "directory walk -> Dirent/file check -> readable Markdown owner",
    route: "phase-06",
    evidence:
      "Replacement: use a real case-owned file/symlink tree; remove mismatched Dirent object fabrication while retaining containment behavior.",
  },
  {
    id: "SHC-F023",
    sourcePath: `${EXTENSION_ROOT}/shared/fs-utils.ts`,
    symbol: "isPlainMarkdownFile lstat branch",
    ownerTest: "tests/shared/fs-utils.test.ts",
    graph: "matching Dirent -> lstat -> symlink refusal",
    route: "phase-06",
    evidence:
      "Replacement: assert real regular-file and symlink outcomes in a temporary directory, without mismatching a Dirent and path.",
  },
  {
    id: "SHC-F054",
    sourcePath: `${EXTENSION_ROOT}/shared/fs-utils.ts`,
    symbol: "isPlainMarkdownFile lstat result",
    ownerTest: "tests/shared/fs-utils.test.ts",
    graph: "component source walk -> lstat result -> accepted resource",
    route: "phase-06",
    evidence:
      "Replacement: remove fabricated directory/Dirent combinations and preserve returned booleans from a case-owned tree.",
  },
  {
    id: "SNA-F007",
    sourcePath: `${EXTENSION_ROOT}/shared/notify.ts`,
    symbol: "notification discriminant narrowing",
    ownerTest: "tests/shared/notify.test.ts",
    graph: "typed notification message -> renderer -> exact output bytes",
    route: "phase-06",
    evidence:
      "Replacement: delete the stateful discriminant getter; direct exact-output owners cover every legitimate message variant.",
  },
  {
    id: "SNC-F023",
    sourcePath: `${EXTENSION_ROOT}/shared/notify.ts`,
    symbol: "notification exhaustive renderer defaults",
    ownerTest: "tests/shared/notify.test.ts",
    graph: "closed message union -> grammar/summary/dispatch -> Pi notification",
    route: "phase-06",
    evidence:
      "Replacement: remove prototype/getter surgery while retaining compiler exhaustiveness and independently authored exact output cases.",
  },
]);

/** @param {readonly string[]} values */
function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }

    seen.add(value);
  }

  return [...repeated];
}

/** @param {readonly string[]} actual @param {readonly string[]} expected @param {string} label */
function compareExactSet(actual, expected, label) {
  const errors = [];
  const repeated = duplicates(actual);
  if (repeated.length > 0) {
    errors.push(`${label} contains duplicate values: ${repeated.join(", ")}`);
  }

  const actualSet = new Set(actual);
  const missing = expected.filter((value) => !actualSet.has(value));
  const unexpected = actual.filter((value) => !expected.includes(value));
  if (missing.length > 0) {
    errors.push(`${label} is missing: ${missing.join(", ")}`);
  }

  if (unexpected.length > 0) {
    errors.push(`${label} has unexpected values: ${unexpected.join(", ")}`);
  }

  return errors;
}

/** @param {unknown} source @param {string} decision */
function findDecision(source, decision) {
  if (typeof source !== "object" || source === null) {
    return undefined;
  }

  const decisions = Reflect.get(source, "decisions");
  if (!Array.isArray(decisions)) {
    return undefined;
  }

  return decisions.find(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      Reflect.get(candidate, "id") === decision,
  );
}

/** @param {object} decision @param {string} id */
function validateDecision(decision, id) {
  const errors = [];
  if (Reflect.get(decision, "status") !== "resolved") {
    errors.push(`${id} is not resolved`);
  }

  if (Reflect.get(decision, "selectedOption") !== "Trace-preserving removal") {
    errors.push(`${id} does not select Trace-preserving removal`);
  }

  const premiseIds = Reflect.get(decision, "premiseFindingIds");
  if (!Array.isArray(premiseIds) || !premiseIds.every((premise) => typeof premise === "string")) {
    errors.push(`${id} premiseFindingIds are missing or malformed`);
  } else {
    errors.push(...compareExactSet(premiseIds, MF_DEC_01_IDS, `${id} premises`));
  }

  return errors;
}

const CENSUS_ROUTES = new Set(["phase-06", "phase-08", "retained", "already-removed"]);

/**
 * @param {CensusRow} row
 * @param {{codegraph: string, trackedPaths: ReadonlySet<string>, hasAggregateTrace: boolean}} evidence
 */
function validateCensusRow(row, evidence) {
  const errors = [];
  if (!CENSUS_ROUTES.has(row.route)) {
    errors.push(`${row.id} has unmapped route ${row.route}`);
  }

  if (!row.symbol.trim() || !row.graph.trim() || !row.evidence.trim()) {
    errors.push(`${row.id} has an unmapped symbol, graph, or evidence field`);
  }

  if (!evidence.trackedPaths.has(row.sourcePath)) {
    errors.push(`${row.id} has stale path ${row.sourcePath}`);
  }

  if (!evidence.trackedPaths.has(row.ownerTest)) {
    errors.push(`${row.id} has stale path ${row.ownerTest}`);
  }

  if (!evidence.hasAggregateTrace && !evidence.codegraph.includes(row.id)) {
    errors.push(`CodeGraph evidence is missing ${row.id}`);
  }

  if (row.route === "phase-06" && !row.evidence.includes("Replacement:")) {
    errors.push(`${row.id} has no legitimate Phase 6 replacement state/port`);
  }

  return errors;
}

/**
 * @param {{decision: string, source: unknown, codegraph: string, rows: readonly CensusRow[], trackedPaths: ReadonlySet<string>}} input
 * @returns {string[]}
 */
export function validateCensus(input) {
  const errors = [];
  const decision = findDecision(input.source, input.decision);
  if (decision === undefined) {
    return [`decision ${input.decision} is missing`];
  }

  errors.push(...validateDecision(decision, input.decision));
  errors.push(
    ...compareExactSet(
      input.rows.map((row) => row.id),
      MF_DEC_01_IDS,
      "census rows",
    ),
  );
  if (input.rows.length !== MF_DEC_01_IDS.length) {
    errors.push(`census row count is ${input.rows.length}; expected ${MF_DEC_01_IDS.length}`);
  }

  const hasAggregateTrace = /all 24 MF-DEC-01 premise IDs/iu.test(input.codegraph);
  for (const row of input.rows) {
    errors.push(
      ...validateCensusRow(row, {
        codegraph: input.codegraph,
        trackedPaths: input.trackedPaths,
        hasAggregateTrace,
      }),
    );
  }

  const denseIndex = input.rows.find((row) => row.id === "ER-F19");
  if (denseIndex?.route !== "phase-08") {
    errors.push("ER-F19 must be routed to phase-08");
  }

  if (/\b(?:dependency cycle detected|cyclic dependency)\b/i.test(input.codegraph)) {
    errors.push("CodeGraph evidence reports a dependency cycle");
  }

  return errors;
}

/** @param {string} markdown */
function ledgerRows(markdown) {
  return markdown
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*[^-|]/u.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells[0]?.toLowerCase() !== "category");
}

const PREEDIT_CATEGORIES = Object.freeze([
  "exported symbol",
  "production caller",
  "source-scanning gate",
  "documentation comment",
  "test ownership",
  "completeness invariant",
  "dependency edge",
]);

/** @param {string[]} row */
function validatePreeditRow(row) {
  const errors = [];
  if (row.length < 4 || row.some((cell) => cell === "")) {
    errors.push("ledger contains an unmapped row");
  }

  if (/\b(?:TBD|unmapped|missing|stale)\b/iu.test(row.slice(2).join(" "))) {
    errors.push(`ledger contains an unmapped or stale destination: ${row.join(" | ")}`);
  }

  if (/\b(?:cycle|cyclic)\b/iu.test(row.slice(2).join(" "))) {
    errors.push(`ledger contains a dependency cycle: ${row.join(" | ")}`);
  }

  return errors;
}

/** @param {{hub: string, legacyTest: string, ledger: string, codegraph: string, trackedPaths: ReadonlySet<string>}} input */
function validatePreeditHeader(input) {
  const errors = [];
  if (!/^Status: READY$/mu.test(input.ledger)) {
    errors.push("ledger Status must be READY");
  }

  if (!input.ledger.includes(`Hub: ${input.hub}`)) {
    errors.push(`ledger hub does not match ${input.hub}`);
  }

  if (!input.ledger.includes(`Legacy test: ${input.legacyTest}`)) {
    errors.push(`ledger legacy test does not match ${input.legacyTest}`);
  }

  if (!input.trackedPaths.has(input.hub)) {
    errors.push(`stale caller/hub path: ${input.hub}`);
  }

  if (!input.trackedPaths.has(input.legacyTest)) {
    errors.push(`stale owner path: ${input.legacyTest}`);
  }

  if (!input.codegraph.trim() || !input.codegraph.includes(input.hub)) {
    errors.push(`CodeGraph evidence is absent for ${input.hub}`);
  }

  return errors;
}

/**
 * @param {{hub: string, legacyTest: string, ledger: string, codegraph: string, trackedPaths: ReadonlySet<string>}} input
 * @returns {string[]}
 */
export function validatePreedit(input) {
  const errors = validatePreeditHeader(input);
  const rows = ledgerRows(input.ledger);
  for (const category of PREEDIT_CATEGORIES) {
    if (!rows.some((row) => row[0]?.toLowerCase() === category)) {
      errors.push(`ledger is missing ${category} mapping`);
    }
  }

  for (const row of rows) {
    errors.push(...validatePreeditRow(row));
  }

  const ownerDestinations = rows
    .filter((row) => row[0]?.toLowerCase() === "test ownership")
    .map((row) => row[2] ?? "");
  const repeatedOwners = duplicates(ownerDestinations);
  if (repeatedOwners.length > 0) {
    errors.push(`duplicate owner destinations: ${repeatedOwners.join(", ")}`);
  }

  return errors;
}

/** @param {string} source @param {string} token */
function occurrenceCount(source, token) {
  return source.split(token).length - 1;
}

/**
 * @param {ReadonlyMap<string, string>} files
 * @param {readonly string[]} expected
 * @param {number} actualCount
 * @param {string} countLabel
 * @param {string} missingLabel
 */
function validateTrackedInventory(files, expected, actualCount, countLabel, missingLabel) {
  const errors = [];
  if (actualCount !== expected.length) {
    errors.push(`${countLabel} is ${actualCount}; expected ${expected.length}`);
  }

  for (const file of expected) {
    if (!files.has(file)) {
      errors.push(`${missingLabel}: ${file}`);
    }
  }

  return errors;
}

/**
 * @param {ReadonlyMap<string, string>} files
 * @param {readonly string[]} legacyHubs
 */
function validateLegacyInventory(files, legacyHubs) {
  const errors = compareExactSet(legacyHubs, LEGACY_HUBS, "legacy hub arguments");
  for (const legacy of LEGACY_HUBS) {
    if (files.has(legacy)) {
      errors.push(`legacy hub remains tracked: ${legacy}`);
    }
  }

  return errors;
}

/**
 * @param {ReadonlyMap<string, string>} files
 * @param {string} token
 * @param {number} expectedFiles
 * @param {number} expectedCalls
 * @param {readonly string[]} expectedResiduals
 */
function validateResidualCensus(files, token, expectedFiles, expectedCalls, expectedResiduals) {
  const entries = [...files].filter(
    ([file, source]) => !RESIDUAL_CENSUS_IGNORES.has(file) && source.includes(token),
  );
  const calls = entries.reduce((total, [, source]) => total + occurrenceCount(source, token), 0);
  const errors = compareExactSet(
    entries.map(([file]) => file),
    expectedResiduals,
    `${token.slice(0, -1)} residual files`,
  );
  if (entries.length !== expectedFiles || calls !== expectedCalls) {
    errors.push(
      `${token.slice(0, -1)} census is ${entries.length}/${calls}; expected ${expectedFiles}/${expectedCalls}`,
    );
  }

  return errors;
}

/**
 * @param {{files: ReadonlyMap<string, string>, ownerCount: number, catalogFixtureCount: number, legacyHubs: readonly string[], syncFiles: number, syncCalls: number, requireFiles: number, requireCalls: number}} input
 * @returns {string[]}
 */
export function validateClosure(input) {
  const expectedResiduals = [
    "tests/bridges/skills/stage.test.ts",
    "tests/orchestrators/plugin/uninstall.test.ts",
  ];
  const sourceFiles = OWNER_PAIRS.map(([source]) => source);
  const ownerTests = OWNER_PAIRS.map(([, owner]) => owner);
  return [
    ...validateTrackedInventory(
      input.files,
      sourceFiles,
      input.ownerCount,
      "owner count argument",
      "missing source owner",
    ),
    ...validateTrackedInventory(
      input.files,
      ownerTests,
      OWNER_PAIRS.length,
      "owner test count",
      "missing owner test",
    ),
    ...validateTrackedInventory(
      input.files,
      CATALOG_FIXTURES,
      input.catalogFixtureCount,
      "catalog fixture count argument",
      "missing catalog fixture",
    ),
    ...validateLegacyInventory(input.files, input.legacyHubs),
    ...validateResidualCensus(
      input.files,
      "syncBuiltinESMExports(",
      input.syncFiles,
      input.syncCalls,
      expectedResiduals,
    ),
    ...validateResidualCensus(
      input.files,
      "createRequire(",
      input.requireFiles,
      input.requireCalls,
      expectedResiduals,
    ),
  ];
}

/** @param {readonly CensusRow[]} rows */
function renderCensus(rows) {
  const lines = [
    "# Phase 6 MF-DEC-01 Census",
    "",
    "Decision: MF-DEC-01",
    "Selected option: Trace-preserving removal",
    "CodeGraph evidence: fresh per-ID trace captured before Phase 6 edits",
    "",
    "Columns: ID | current tracked path | symbol | owner test | CodeGraph callers/dependencies | route | evidence / legitimate replacement.",
    "",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.id} | \`${row.sourcePath}\` | \`${row.symbol}\` | \`${row.ownerTest}\` | ${row.graph} | ${row.route} | ${row.evidence} |`,
    );
  }

  lines.push(
    "",
    "The census is deterministic: `scripts/check-phase-06-hub-ledger.mjs census` validates the resolved decision, exact ID set, tracked owners, per-ID CodeGraph evidence, allowed routes, and the Phase 8 reservation before rewriting this file.",
    "",
  );
  return lines.join("\n");
}

/** @param {string} document @param {readonly CensusRow[]} expectedRows */
function validateCensusDocument(document, expectedRows) {
  const parsed = ledgerRows(document)
    .filter((cells) => MF_DEC_01_IDS.includes(cells[0] ?? ""))
    .map((cells) => cells.map((cell) => cell.replaceAll("`", "")));
  const errors = compareExactSet(
    parsed.map((cells) => cells[0] ?? ""),
    MF_DEC_01_IDS,
    "rendered census rows",
  );
  for (const row of expectedRows) {
    const cells = parsed.find((candidate) => candidate[0] === row.id);
    const expected = [
      row.id,
      row.sourcePath,
      row.symbol,
      row.ownerTest,
      row.graph,
      row.route,
      row.evidence,
    ];
    if (cells === undefined || cells.some((cell, index) => cell !== expected[index])) {
      errors.push(`rendered census row is stale or unmapped: ${row.id}`);
    }
  }

  return errors;
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const [mode, ...tokens] = argv;
  const values = new Map();
  for (let index = 0; index < tokens.length;) {
    const flag = tokens[index];
    if (flag === undefined || !flag.startsWith("--")) {
      throw new Error(`malformed argument near ${flag ?? "<end>"}`);
    }

    if (values.has(flag)) {
      throw new Error(`duplicate argument ${flag}`);
    }

    index += 1;
    const argumentsForFlag = [];
    while (index < tokens.length && !tokens[index]?.startsWith("--")) {
      argumentsForFlag.push(tokens[index]);
      index += 1;
    }

    if (argumentsForFlag.length === 0) {
      throw new Error(`malformed argument near ${flag}`);
    }

    values.set(flag, argumentsForFlag.join(" "));
  }

  return { mode, values };
}

/** @param {Map<string, string>} values @param {string} flag */
function required(values, flag) {
  const value = values.get(flag);
  if (value === undefined || value === "") {
    throw new Error(`missing ${flag}`);
  }

  return value;
}

/** @param {string} value @param {string} flag */
function positiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be an integer`);
  }

  return parsed;
}

/** @param {readonly string[]} roots */
function trackedFiles(roots) {
  const result = spawnSync("git", ["ls-files", "--", ...roots], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "git ls-files failed");
  }

  return new Set(result.stdout.split(/\r?\n/u).filter(Boolean));
}

/** @param {ReadonlySet<string>} paths */
function trackedContents(paths) {
  const files = new Map();
  for (const file of paths) {
    files.set(file, readFileSync(file, "utf8"));
  }

  return files;
}

/** @param {string[]} errors */
function assertValid(errors) {
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function runCli() {
  const { mode, values } = parseArgs(process.argv.slice(2));
  if (mode === "census") {
    const sourcePath = required(values, "--source");
    const codegraphPath = required(values, "--codegraph");
    const outPath = required(values, "--out");
    const source = JSON.parse(readFileSync(sourcePath, "utf8"));
    const codegraph = readFileSync(codegraphPath, "utf8");
    const trackedPaths = trackedFiles(["extensions", "tests"]);
    assertValid(
      validateCensus({
        decision: required(values, "--decision"),
        source,
        codegraph,
        rows: CENSUS_ROWS,
        trackedPaths,
      }),
    );
    if (existsSync(outPath)) {
      assertValid(validateCensusDocument(readFileSync(outPath, "utf8"), CENSUS_ROWS));
    } else {
      writeFileSync(outPath, renderCensus(CENSUS_ROWS), "utf8");
    }

    process.stdout.write(`MF-DEC-01 census: ${CENSUS_ROWS.length} rows verified\n`);
    return;
  }

  if (mode === "preedit") {
    const hub = required(values, "--hub");
    const legacyTest = required(values, "--legacy-test");
    const ledger = readFileSync(required(values, "--ledger"), "utf8");
    const codegraph = readFileSync(required(values, "--codegraph"), "utf8");
    const roots = required(values, "--roots")
      .split(/[\s,]+/u)
      .filter(Boolean);
    const trackedPaths = trackedFiles(roots);
    assertValid(validatePreedit({ hub, legacyTest, ledger, codegraph, trackedPaths }));
    process.stdout.write(`PRE-EDIT ledger READY: ${hub}\n`);
    return;
  }

  if (mode === "closure") {
    const roots = required(values, "--roots")
      .split(/[\s,]+/u)
      .filter(Boolean);
    const paths = trackedFiles(roots);
    assertValid(
      validateClosure({
        files: trackedContents(paths),
        ownerCount: positiveInteger(required(values, "--owner-count"), "--owner-count"),
        catalogFixtureCount: positiveInteger(
          required(values, "--catalog-fixture-count"),
          "--catalog-fixture-count",
        ),
        legacyHubs: required(values, "--legacy-hubs").split(",").filter(Boolean),
        syncFiles: positiveInteger(required(values, "--sync-files"), "--sync-files"),
        syncCalls: positiveInteger(required(values, "--sync-calls"), "--sync-calls"),
        requireFiles: positiveInteger(required(values, "--require-files"), "--require-files"),
        requireCalls: positiveInteger(required(values, "--require-calls"), "--require-calls"),
      }),
    );
    process.stdout.write(
      "Phase 6 closure: owner, fixture, legacy-hub, and residual censuses verified\n",
    );
    return;
  }

  throw new Error(`unknown mode ${mode ?? "<missing>"}; expected census, preedit, or closure`);
}

const isCli =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
