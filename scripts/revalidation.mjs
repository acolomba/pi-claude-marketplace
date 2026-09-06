import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const CORPUS_ROOT = ".planning/reviews/unit-test-adversarial";
const PHASE_ROOT = ".planning/phases/01-live-evidence-revalidation";
const LEDGER_PATH = `${PHASE_ROOT}/01-REVALIDATION.json`;
const MARKDOWN_PATH = `${PHASE_ROOT}/01-REVALIDATION.md`;
const ASSIGNMENT_PATH = `${PHASE_ROOT}/01-CORPUS-ASSIGNMENT.md`;
const REQUIREMENTS_PATH = ".planning/REQUIREMENTS.md";
const ROADMAP_PATH = ".planning/ROADMAP.md";
const SUPPORTED_VERSIONS = new Set([1]);
const INVENTORY_MODES = new Set(["live", "fixture"]);
const STATUSES = new Set(["confirmed", "stale", "superseded", "duplicate", "inconclusive"]);
const ROUTES = new Set(["evidence-only closure", "deferred backlog", "operator decision"]);
const CATEGORIES = new Set(["first-pass", "adversarial", "control"]);
const REVIEW_STATUSES = new Set(["pending", "complete", "superseded"]);
const OUTCOMES = new Set([
  "unreviewed",
  "live findings",
  "no live findings",
  "control document",
  "superseded",
]);
const METHODS = new Set(["behavioral-probe", "surviving-mutation", "static-proof"]);
const PENDING_DECISION_IDS = Array.from(
  { length: 9 },
  (_, index) => `MF-DEC-${String(index + 1).padStart(2, "0")}`,
);
const SECRET_ASSIGNMENT_PATTERN =
  /["']?(?:token|password|secret|authorization|api[-_]?key)["']?\s*[=:]\s*["']?[^\s"',}]+/i;
const SECRET_FLAG_PATTERN = /--(?:token|password|secret|authorization|api[-_]?key)(?:=|\s+)\S+/i;
const AUTHORIZATION_HEADER_PATTERN = /\bauthorization\s*:\s*(?:basic|bearer)\s+\S+/i;
const ABSOLUTE_HOME_PATTERN =
  /(?:\/home\/[^/\s"'`]+|\/Users\/[^/\s"'`]+|\/root(?:\/|\b)|[A-Za-z]:[\\/]Users[\\/][^\\/\s"'`]+)/;
const FILE_PATH_PATTERN = /^[A-Za-z0-9._/-]+$/;
const IDENTITY_PATTERN = /^[A-Za-z0-9._/][A-Za-z0-9._/#:-]*$/;
const PLAN_PATTERN = /^\d{2}-\d{2}$/;
const SCOPE_ACTIONS = new Set(["keep", "move-to-evidence", "narrow/split"]);
const PUBLISH_JOURNAL_FIELDS = new Set(["status", "records"]);
const PUBLISH_RECORD_FIELDS = new Set(["destination", "staged", "backup", "hadDestination"]);
const PUBLISH_STATUSES = new Set(["staged", "published"]);
const TRANSACTION_ID_PATTERN = /^\d+-\d+-[0-9a-f]+$/;

function toPosix(candidate) {
  return candidate.split(path.sep).join("/");
}

function violation(code, target, message) {
  return { code, target, message };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function identityIsSafe(value) {
  return typeof value === "string" && IDENTITY_PATTERN.test(value);
}

function escapeMarkdownText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/([\\`*_[\]])/g, "\\$1");
}

function markdownCode(value) {
  return `\`${String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("`", "&#96;")}\``;
}

function containsSensitiveEvidence(value, visited = new Set()) {
  if (typeof value === "string") {
    return (
      SECRET_ASSIGNMENT_PATTERN.test(value) ||
      SECRET_FLAG_PATTERN.test(value) ||
      AUTHORIZATION_HEADER_PATTERN.test(value) ||
      ABSOLUTE_HOME_PATTERN.test(value)
    );
  }

  if (value === null || typeof value !== "object" || visited.has(value)) {
    return false;
  }

  visited.add(value);
  const nested = Array.isArray(value) ? value : Object.values(value);
  return nested.some((item) => containsSensitiveEvidence(item, visited));
}

function permittedValidationFields() {
  return new Set(["method", "tool", "command", "exitCode", "observed"]);
}

function assertSafeRelativePath(projectRoot, candidate, { mustExist = true } = {}) {
  if (typeof candidate !== "string" || candidate.length === 0 || path.isAbsolute(candidate)) {
    throw new Error(`path must be a non-empty repository-relative path: ${String(candidate)}`);
  }

  if (
    candidate.includes("\\") ||
    candidate.split("/").some((part) => part === "." || part === ".." || part === "")
  ) {
    throw new Error(`path must use normalized POSIX segments without dot-dot: ${candidate}`);
  }

  const root = realpathSync(projectRoot);
  const target = path.resolve(root, candidate);
  const targetStats = lstatSync(target, { throwIfNoEntry: false });
  if (mustExist && targetStats === undefined) {
    throw new Error(`path does not exist: ${candidate}`);
  }

  if (!mustExist && targetStats?.isSymbolicLink()) {
    throw new Error(`write target must not be a symlink: ${candidate}`);
  }

  if (!mustExist && targetStats !== undefined && !targetStats.isFile()) {
    throw new Error(`write target must be a regular file: ${candidate}`);
  }

  let existingParent = mustExist ? target : path.dirname(target);
  while (lstatSync(existingParent, { throwIfNoEntry: false }) === undefined) {
    existingParent = path.dirname(existingParent);
  }

  const resolved = realpathSync(existingParent);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`path resolves through a symlink outside repository root: ${candidate}`);
  }

  return mustExist ? realpathSync(target) : target;
}

export function enumerateCorpus(projectRoot = DEFAULT_ROOT) {
  const absoluteRoot = assertSafeRelativePath(projectRoot, CORPUS_ROOT);
  if (!lstatSync(absoluteRoot).isDirectory()) {
    throw new Error(`${CORPUS_ROOT} is not a directory`);
  }

  return readdirSync(absoluteRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => toPosix(path.relative(projectRoot, path.join(entry.parentPath, entry.name))))
    .sort();
}

export function parseAssignments(text) {
  const rows = [];
  for (const match of text.matchAll(
    /^\|\s*(\d{3})\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|$/gm,
  )) {
    rows.push({
      ordinal: Number(match[1]),
      plan: match[2].trim(),
      bytes: Number(match[3]),
      path: match[4],
    });
  }

  return rows;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates].sort();
}

function expectedOutcome(file, claims, findings) {
  if (file.reviewStatus === "pending") {
    return "unreviewed";
  }

  if (file.reviewStatus === "superseded") {
    return "superseded";
  }

  if (claims.length === 0) {
    return file.category === "control" ? "control document" : "no live findings";
  }

  const linked = claims.map((claim) => findings.get(claim.findingId)).filter(Boolean);
  return linked.some((finding) => finding.evidenceStatus === "confirmed")
    ? "live findings"
    : "no live findings";
}

function categoryForPath(candidate) {
  if (
    (!candidate.includes("/adversarial/") && candidate.split("/").at(-1).startsWith("_")) ||
    candidate.endsWith("/README.md") ||
    candidate.endsWith("/META-FINDINGS.md")
  ) {
    return "control";
  }

  return candidate.includes("/adversarial/") ? "adversarial" : "first-pass";
}

function validateReference(reference, projectRoot, target, violations) {
  if (!isObject(reference) || typeof reference.path !== "string") {
    violations.push(violation("invalid-reference", target, "reference must contain a path"));
    return;
  }

  if (reference.path === "N/A") {
    if (typeof reference.reason !== "string" || reference.reason.trim() === "") {
      violations.push(violation("invalid-reference", target, "N/A reference requires a reason"));
    }

    return;
  }

  try {
    assertSafeRelativePath(projectRoot, reference.path);
  } catch (error) {
    violations.push(violation("unsafe-reference", target, error.message));
  }
}

function routeIsValid(route) {
  if (ROUTES.has(route)) {
    return true;
  }

  if (typeof route !== "string") {
    return false;
  }

  const match = /^Phase (\d+)$/.exec(route);
  return match !== null && Number(match[1]) >= 2;
}

function resolveDuplicateTarget(finding, findings) {
  const visited = new Set();
  let cursor = finding;
  while (cursor?.evidenceStatus === "duplicate") {
    if (
      typeof cursor.id !== "string" ||
      visited.has(cursor.id) ||
      typeof cursor.duplicateOf !== "string"
    ) {
      return undefined;
    }

    visited.add(cursor.id);
    cursor = findings.get(cursor.duplicateOf);
  }

  return cursor;
}

function terminalFinding(finding, findings) {
  const target = resolveDuplicateTarget(finding, findings);
  return target !== undefined && target.evidenceStatus !== "inconclusive";
}

const LEDGER_COLLECTIONS = ["files", "sourceClaims", "findings", "decisions", "scopeChanges"];

function assertLedgerShape(ledger) {
  if (!isObject(ledger)) {
    throw new TypeError("ledger must be an object");
  }

  for (const collection of LEDGER_COLLECTIONS) {
    if (!Array.isArray(ledger[collection])) {
      throw new TypeError(`ledger.${collection} must be an array`);
    }
  }
}

function validateSchema(ledger, requireLive, violations) {
  if (!SUPPORTED_VERSIONS.has(ledger.version)) {
    violations.push(violation("invalid-version", "version", String(ledger.version)));
  }

  if (!INVENTORY_MODES.has(ledger.inventoryMode)) {
    violations.push(
      violation("invalid-inventory-mode", "inventoryMode", String(ledger.inventoryMode)),
    );
  } else if (requireLive && ledger.inventoryMode !== "live") {
    violations.push(
      violation("canonical-inventory-mode", "inventoryMode", "canonical ledger must use live mode"),
    );
  }
}

function collectObjectRecords(records, code, target, message, violations, predicate = isObject) {
  const validRecords = [];
  for (const record of records) {
    if (!predicate(record)) {
      violations.push(violation(code, target, message));
      continue;
    }

    validRecords.push(record);
  }

  return validRecords;
}

function validateLiveInventoryCounts(ledger, expectedPaths, violations) {
  if (expectedPaths.length !== 110 || ledger.files.length !== 110) {
    violations.push(
      violation(
        "inventory-count",
        "files",
        `live inventory must contain exactly 110 paths; found ${ledger.files.length}`,
      ),
    );
  }

  const categoryCounts = Object.fromEntries(
    [...CATEGORIES].map((category) => [
      category,
      ledger.files.filter((file) => file.category === category).length,
    ]),
  );
  const actualCategoryCounts = [
    categoryCounts["first-pass"],
    categoryCounts.adversarial,
    categoryCounts.control,
  ];
  if (JSON.stringify(actualCategoryCounts) !== JSON.stringify([45, 58, 7])) {
    violations.push(
      violation(
        "category-count",
        "files",
        `live inventory must contain 45 first-pass, 58 adversarial, and 7 control files; found ${categoryCounts["first-pass"]}/${categoryCounts.adversarial}/${categoryCounts.control}`,
      ),
    );
  }

  const actualEvidenceCounts = [ledger.sourceClaims.length, ledger.findings.length];
  if (JSON.stringify(actualEvidenceCounts) !== JSON.stringify([2_897, 2_437])) {
    violations.push(
      violation(
        "evidence-count",
        "ledger",
        `live evidence must contain 2897 claims and 2437 findings; found ${ledger.sourceClaims.length}/${ledger.findings.length}`,
      ),
    );
  }
}

function validateInventory(ledger, projectRoot, expectedPaths, violations) {
  const filePaths = ledger.files.map((file) => file.path);
  for (const file of ledger.files) {
    assertSafeRelativePath(projectRoot, file.path);
    if (!FILE_PATH_PATTERN.test(file.path)) {
      violations.push(
        violation(
          "invalid-file-path-grammar",
          String(file.path),
          "file path has unsafe characters",
        ),
      );
    }
  }

  for (const duplicate of duplicateValues(filePaths)) {
    violations.push(violation("duplicate-file", duplicate, "file path appears more than once"));
  }

  if (JSON.stringify(filePaths) !== JSON.stringify([...filePaths].sort())) {
    violations.push(violation("file-order", "files", "file records are not sorted"));
  }

  const missing = expectedPaths.filter((candidate) => !filePaths.includes(candidate));
  const extra = filePaths.filter((candidate) => !expectedPaths.includes(candidate));
  if (missing.length > 0) {
    violations.push(violation("missing-files", "files", missing.join(", ")));
  }

  if (extra.length > 0) {
    violations.push(violation("extra-files", "files", extra.join(", ")));
  }

  if (ledger.inventoryMode === "live") {
    validateLiveInventoryCounts(ledger, expectedPaths, violations);
  }

  return filePaths;
}

function collectClaims(ledger, filePaths, violations) {
  const claims = new Map();
  for (const claim of ledger.sourceClaims) {
    if (!isObject(claim) || typeof claim.id !== "string") {
      violations.push(violation("invalid-claim", "sourceClaims", "claim requires an id"));
      continue;
    }

    if (claims.has(claim.id)) {
      violations.push(
        violation("duplicate-claim", claim.id, "claim identity appears more than once"),
      );
    }

    claims.set(claim.id, claim);
    if (!identityIsSafe(claim.id) || !identityIsSafe(claim.label)) {
      violations.push(
        violation("invalid-claim-identity", claim.id, "claim id and label have unsafe characters"),
      );
    }

    if (claim.id !== `${claim.filePath}#${claim.label}`) {
      violations.push(
        violation(
          "invalid-claim-id",
          claim.id,
          "claim id must namespace its label under the corpus path",
        ),
      );
    }

    if (!filePaths.includes(claim.filePath)) {
      violations.push(violation("dangling-claim-file", claim.id, claim.filePath));
    }
  }

  return claims;
}

function collectFindings(ledger, violations) {
  const findings = new Map();
  for (const finding of ledger.findings) {
    if (!isObject(finding) || typeof finding.id !== "string") {
      violations.push(violation("invalid-finding", "findings", "finding requires an id"));
      continue;
    }

    if (findings.has(finding.id)) {
      violations.push(
        violation("duplicate-finding", finding.id, "finding identity appears more than once"),
      );
    }

    findings.set(finding.id, finding);
    if (!identityIsSafe(finding.id)) {
      violations.push(
        violation("invalid-finding-id", finding.id, "finding id has unsafe characters"),
      );
    }
  }

  return findings;
}

function validateLiveFile(file, assignment, violations) {
  const assignmentRow = assignment.find((row) => row.path === file.path);
  if (!assignmentRow) {
    violations.push(
      violation("missing-assignment-row", file.path, "live file is absent from assignment"),
    );
  } else if (file.assignedPlan !== assignmentRow.plan) {
    violations.push(
      violation(
        "assigned-plan",
        file.path,
        `expected ${assignmentRow.plan}; found ${String(file.assignedPlan)}`,
      ),
    );
  }

  const expectedCategory = categoryForPath(file.path);
  if (file.category !== expectedCategory) {
    violations.push(
      violation(
        "file-category",
        file.path,
        `expected ${expectedCategory}; found ${String(file.category)}`,
      ),
    );
  }
}

function validateFile(file, state, violations) {
  if (!CATEGORIES.has(file.category)) {
    violations.push(violation("invalid-category", file.path, String(file.category)));
  }

  if (!REVIEW_STATUSES.has(file.reviewStatus)) {
    violations.push(violation("invalid-review-status", file.path, String(file.reviewStatus)));
  }

  if (!OUTCOMES.has(file.outcome)) {
    violations.push(violation("invalid-outcome", file.path, String(file.outcome)));
  }

  if (typeof file.assignedPlan !== "string" || !PLAN_PATTERN.test(file.assignedPlan)) {
    violations.push(violation("invalid-assigned-plan", file.path, String(file.assignedPlan)));
  }

  if (state.inventoryMode === "live") {
    validateLiveFile(file, state.assignment, violations);
  }

  const linkedClaims = [...state.claims.values()].filter((claim) => claim.filePath === file.path);
  const actualIds = linkedClaims.map((claim) => claim.id).sort();
  if (!Array.isArray(file.claimIds)) {
    violations.push(violation("invalid-file-claim-ids", file.path, "claimIds must be an array"));
  } else if (JSON.stringify(actualIds) !== JSON.stringify([...file.claimIds].sort())) {
    violations.push(
      violation("file-claim-links", file.path, "declared claimIds do not match sourceClaims"),
    );
  }

  const derived = expectedOutcome(file, linkedClaims, state.findings);
  if (file.outcome !== derived) {
    violations.push(violation("derived-outcome", file.path, `expected ${derived}`));
  }

  if (
    !state.allowIncomplete &&
    file.reviewStatus !== "complete" &&
    file.reviewStatus !== "superseded"
  ) {
    violations.push(violation("incomplete-file", file.path, "file review is not complete"));
  }
}

function validateFiles(ledger, state, violations) {
  for (const file of ledger.files) {
    validateFile(file, state, violations);
  }
}

function validateFindingStatus(finding, findings, violations) {
  if (!STATUSES.has(finding.evidenceStatus)) {
    violations.push(
      violation("invalid-evidence-status", finding.id, String(finding.evidenceStatus)),
    );
  }

  if (!routeIsValid(finding.route)) {
    violations.push(violation("invalid-route", finding.id, String(finding.route)));
  }

  if (finding.evidenceStatus === "duplicate") {
    if (typeof finding.duplicateOf !== "string" || !findings.has(finding.duplicateOf)) {
      violations.push(violation("dangling-duplicate", finding.id, String(finding.duplicateOf)));
    }
  } else if (finding.duplicateOf !== null) {
    violations.push(
      violation("invalid-duplicate-link", finding.id, "non-duplicate finding must use null"),
    );
  }
}

function validateFindingClaims(finding, claims, violations) {
  const expectedClaimIds = [...claims.values()]
    .filter((claim) => claim.findingId === finding.id)
    .map((claim) => claim.id)
    .sort();
  if (!Array.isArray(finding.claimIds)) {
    violations.push(
      violation("invalid-finding-claim-ids", finding.id, "claimIds must be an array"),
    );
    return;
  }

  if (JSON.stringify(expectedClaimIds) !== JSON.stringify([...finding.claimIds].sort())) {
    violations.push(
      violation("finding-claim-links", finding.id, "declared claimIds do not match sourceClaims"),
    );
  }

  for (const claimId of finding.claimIds) {
    if (!claims.has(claimId)) {
      violations.push(violation("dangling-finding-claim", finding.id, claimId));
    }
  }
}

function validateFindingReferences(finding, projectRoot, violations) {
  if (Array.isArray(finding.sourceRefs)) {
    for (const reference of finding.sourceRefs) {
      validateReference(reference, projectRoot, finding.id, violations);
    }
  }

  if (Array.isArray(finding.testRefs)) {
    for (const reference of finding.testRefs) {
      validateReference(reference, projectRoot, finding.id, violations);
    }
  }

  if (
    !Array.isArray(finding.sourceRefs) ||
    finding.sourceRefs.length === 0 ||
    !Array.isArray(finding.testRefs) ||
    finding.testRefs.length === 0
  ) {
    violations.push(
      violation("missing-references", finding.id, "sourceRefs and testRefs are mandatory"),
    );
  }
}

function validateEvidenceShape(finding, violations) {
  const validation = finding.validation;
  if (!isObject(validation) || !METHODS.has(validation.method)) {
    violations.push(
      violation("invalid-validation", finding.id, "validation method is missing or invalid"),
    );
    return;
  }

  if (
    validation.method === "static-proof" &&
    (typeof validation.tool !== "string" ||
      validation.tool.trim() === "" ||
      typeof validation.observed !== "string" ||
      validation.observed.trim() === "")
  ) {
    violations.push(
      violation("incomplete-validation", finding.id, "static proof requires tool and observed"),
    );
  }

  if (
    validation.method !== "static-proof" &&
    (typeof validation.command !== "string" ||
      validation.command.trim() === "" ||
      !Number.isInteger(validation.exitCode) ||
      validation.exitCode < 0 ||
      validation.exitCode > 255 ||
      typeof validation.observed !== "string" ||
      validation.observed.trim() === "")
  ) {
    violations.push(
      violation(
        "incomplete-validation",
        finding.id,
        "probe requires command, exitCode, and observed",
      ),
    );
  }

  const permittedFields = permittedValidationFields();
  const unexpectedFields = Object.keys(validation).filter((field) => !permittedFields.has(field));
  if (unexpectedFields.length > 0) {
    violations.push(
      violation("unexpected-validation-field", finding.id, unexpectedFields.sort().join(", ")),
    );
  }
}

function validateFindingEvidence(finding, allowInconclusive, violations) {
  validateEvidenceShape(finding, violations);
  if (containsSensitiveEvidence(finding.validation)) {
    violations.push(
      violation(
        "sensitive-evidence",
        finding.id,
        "validation evidence contains sensitive material",
      ),
    );
  }

  if (
    typeof finding.rationale !== "string" ||
    finding.rationale.trim() === "" ||
    typeof finding.destination !== "string" ||
    finding.destination.trim() === ""
  ) {
    violations.push(
      violation("incomplete-finding", finding.id, "rationale and destination are mandatory"),
    );
  }

  if (!allowInconclusive && finding.evidenceStatus === "inconclusive") {
    violations.push(
      violation("inconclusive-finding", finding.id, "inconclusive evidence blocks completion"),
    );
  }
}

function validateFindings(findings, state, violations) {
  for (const finding of findings.values()) {
    validateFindingStatus(finding, findings, violations);
    validateFindingClaims(finding, state.claims, violations);
    validateFindingReferences(finding, state.projectRoot, violations);
    validateFindingEvidence(finding, state.allowInconclusive, violations);
  }
}

function validateDuplicateCycles(findings, violations) {
  for (const finding of findings.values()) {
    const visited = new Set([finding.id]);
    let cursor = finding;
    while (cursor?.evidenceStatus === "duplicate" && typeof cursor.duplicateOf === "string") {
      if (visited.has(cursor.duplicateOf)) {
        violations.push(violation("duplicate-cycle", finding.id, "duplicate link cycle"));
        break;
      }

      visited.add(cursor.duplicateOf);
      cursor = findings.get(cursor.duplicateOf);
    }
  }
}

function validateCrossLinks(claims, findings, violations) {
  for (const claim of claims.values()) {
    if (!findings.has(claim.findingId)) {
      violations.push(violation("dangling-claim-finding", claim.id, String(claim.findingId)));
    }
  }

  validateDuplicateCycles(findings, violations);
}

function validateDecisionOptions(decision, violations) {
  if (!Array.isArray(decision.options)) {
    return;
  }

  const optionsAreValid = decision.options.every(
    (option) => typeof option === "string" && option.trim() !== "",
  );
  if (!optionsAreValid) {
    violations.push(
      violation("invalid-decision-option", decision.id, "options must be non-empty strings"),
    );
  }

  const duplicateOptions = duplicateValues(decision.options);
  if (duplicateOptions.length > 0) {
    violations.push(
      violation("duplicate-decision-option", decision.id, duplicateOptions.join(", ")),
    );
  }

  if (!decision.options.includes(decision.selectedOption)) {
    violations.push(
      violation("invalid-selected-option", decision.id, "selectedOption must be one of options"),
    );
  }

  if (!Array.isArray(decision.rejectedOptions)) {
    return;
  }

  const rejectedOptionsAreValid = decision.rejectedOptions.every(
    (option) => typeof option === "string" && option.trim() !== "",
  );
  if (!rejectedOptionsAreValid) {
    violations.push(
      violation(
        "invalid-rejected-option",
        decision.id,
        "rejectedOptions must be non-empty strings",
      ),
    );
  }

  const duplicateRejectedOptions = duplicateValues(decision.rejectedOptions);
  if (duplicateRejectedOptions.length > 0) {
    violations.push(
      violation("duplicate-rejected-option", decision.id, duplicateRejectedOptions.join(", ")),
    );
  }

  const expectedRejectedOptions = decision.options
    .filter((option) => option !== decision.selectedOption)
    .sort();
  const actualRejectedOptions = [...decision.rejectedOptions].sort();
  if (JSON.stringify(actualRejectedOptions) !== JSON.stringify(expectedRejectedOptions)) {
    violations.push(
      violation(
        "invalid-rejected-option",
        decision.id,
        "rejectedOptions must contain exactly every unselected option",
      ),
    );
  }
}

function validateResolvedDecision(decision, findings, violations) {
  const premiseFindingIds = Array.isArray(decision.premiseFindingIds)
    ? decision.premiseFindingIds
    : [];
  const prerequisites = premiseFindingIds.map((id) => findings.get(id));
  if (
    prerequisites.length === 0 ||
    prerequisites.some((finding) => !terminalFinding(finding, findings))
  ) {
    violations.push(
      violation(
        "unresolved-decision-premise",
        decision.id,
        "every premise must have terminal evidence",
      ),
    );
  }

  for (const field of ["proof", "selectedOption", "recommendation", "downstreamConsequences"]) {
    if (typeof decision[field] !== "string" || decision[field].trim() === "") {
      violations.push(violation("incomplete-decision", decision.id, `${field} is mandatory`));
    }
  }

  if (
    !Array.isArray(decision.options) ||
    decision.options.length < 2 ||
    !Array.isArray(decision.rejectedOptions) ||
    !Array.isArray(decision.affectedIds) ||
    decision.affectedIds.length === 0
  ) {
    violations.push(
      violation(
        "incomplete-decision",
        decision.id,
        "options, rejectedOptions, and affectedIds are mandatory",
      ),
    );
  }

  validateDecisionOptions(decision, violations);
}

function validateDecisionCollections(decision, findings, violations) {
  for (const field of ["premiseFindingIds", "options", "rejectedOptions", "affectedIds"]) {
    if (!Array.isArray(decision[field])) {
      violations.push(
        violation("invalid-decision-collection", decision.id, `${field} must be an array`),
      );
    }
  }

  if (Array.isArray(decision.affectedIds)) {
    for (const affectedId of decision.affectedIds) {
      if (!identityIsSafe(affectedId)) {
        violations.push(violation("invalid-affected-id", decision.id, String(affectedId)));
      }
    }
  }

  if (Array.isArray(decision.premiseFindingIds)) {
    for (const premise of decision.premiseFindingIds) {
      if (!findings.has(premise)) {
        violations.push(violation("dangling-decision-premise", decision.id, premise));
      }
    }
  }
}

function validateDecision(decision, state, violations) {
  if (!/^MF-DEC-\d{2}$/.test(decision.id ?? "")) {
    violations.push(violation("invalid-decision-id", String(decision.id), "expected MF-DEC-NN"));
  }

  validateDecisionCollections(decision, state.findings, violations);

  if (decision.status === "resolved") {
    validateResolvedDecision(decision, state.findings, violations);
  } else if (decision.status !== "pending") {
    violations.push(violation("invalid-decision-status", decision.id, String(decision.status)));
  }

  if (
    !state.allowPendingDecisions &&
    decision.status !== "resolved" &&
    (state.decisionId === undefined || decision.id === state.decisionId)
  ) {
    violations.push(violation("pending-decision", decision.id, "operator decision is unresolved"));
  }
}

function validateDecisionSet(ledger, decisionId, violations) {
  for (const id of duplicateValues(ledger.decisions.map((decision) => decision.id))) {
    violations.push(
      violation("duplicate-decision", id, "decision identity appears more than once"),
    );
  }

  if (
    decisionId !== undefined &&
    !ledger.decisions.some((decision) => decision.id === decisionId)
  ) {
    violations.push(violation("unknown-decision", decisionId, "decision is not in the ledger"));
  }

  const ledgerDecisionIds = ledger.decisions.map((decision) => decision.id).sort();
  if (
    ledger.inventoryMode === "live" &&
    JSON.stringify(ledgerDecisionIds) !== JSON.stringify(PENDING_DECISION_IDS)
  ) {
    violations.push(
      violation(
        "decision-set",
        "decisions",
        `decisions must be exactly ${PENDING_DECISION_IDS.join(", ")}`,
      ),
    );
  }
}

function validateDecisions(ledger, state, violations) {
  validateDecisionSet(ledger, state.decisionId, violations);
  for (const decision of ledger.decisions) {
    validateDecision(decision, state, violations);
  }
}

function validateScopeAnchors(change, violations) {
  const anchors = [change.beforeAnchor, change.afterAnchor];
  if (anchors.some((anchor) => typeof anchor !== "string" || anchor.trim() === "")) {
    violations.push(
      violation("invalid-scope-anchor", change.id, "beforeAnchor and afterAnchor are mandatory"),
    );
  } else if (change.beforeAnchor === change.afterAnchor) {
    violations.push(
      violation("invalid-scope-anchor", change.id, "beforeAnchor and afterAnchor must differ"),
    );
  } else {
    for (const [name, anchor] of [
      ["beforeAnchor", change.beforeAnchor],
      ["afterAnchor", change.afterAnchor],
    ]) {
      const parts = anchor.split(" :: ");
      if (parts.length !== 3 || parts.some((part) => part.trim() === "")) {
        violations.push(
          violation("invalid-scope-anchor", change.id, `${name} must be a three-part locator`),
        );
      } else if (!anchor.includes(change.requirementId)) {
        violations.push(
          violation(
            "scope-anchor-identity",
            change.id,
            `${name} must identify ${change.requirementId}`,
          ),
        );
      }
    }
  }
}

function validateScopeChange(change, ledger, findings, violations) {
  if (!identityIsSafe(change.id)) {
    violations.push(
      violation("invalid-scope-change-id", String(change.id), "scope change id is unsafe"),
    );
  }

  if (
    !Array.isArray(change.findingIds) ||
    change.findingIds.length === 0 ||
    change.findingIds.some((id) => !findings.has(id))
  ) {
    violations.push(
      violation("invalid-scope-trace", change.id, "scope change must link existing findings"),
    );
  }

  if (
    !Array.isArray(change.decisionIds) ||
    change.decisionIds.some((id) => !ledger.decisions.some((decision) => decision.id === id))
  ) {
    violations.push(
      violation("invalid-scope-trace", change.id, "scope change has a dangling decision"),
    );
  }

  if (
    typeof change.requirementId !== "string" ||
    change.requirementId.trim() === "" ||
    typeof change.action !== "string" ||
    change.action.trim() === "" ||
    typeof change.rationale !== "string" ||
    change.rationale.trim() === ""
  ) {
    violations.push(
      violation(
        "incomplete-scope-change",
        change.id,
        "requirementId, action, and rationale are mandatory",
      ),
    );
  }

  if (!identityIsSafe(change.requirementId)) {
    violations.push(violation("invalid-requirement-id", change.id, String(change.requirementId)));
  }

  if (!SCOPE_ACTIONS.has(change.action)) {
    violations.push(violation("invalid-scope-action", change.id, String(change.action)));
  }

  validateScopeAnchors(change, violations);
}

function validateScopeChanges(ledger, findings, violations) {
  const scopeIds = new Set();
  for (const change of ledger.scopeChanges) {
    if (scopeIds.has(change.id)) {
      violations.push(
        violation(
          "duplicate-scope-change",
          change.id,
          "scope change identity appears more than once",
        ),
      );
    }

    scopeIds.add(change.id);
    validateScopeChange(change, ledger, findings, violations);
  }
}

export function validateLedger(ledger, context = {}) {
  assertLedgerShape(ledger);
  const projectRoot = context.projectRoot ?? DEFAULT_ROOT;
  const expectedPaths = context.expectedPaths ?? enumerateCorpus(projectRoot);
  const violations = [];
  const validatedLedger = {
    ...ledger,
    files: collectObjectRecords(
      ledger.files,
      "invalid-file",
      "files",
      "file requires a path",
      violations,
      (file) => isObject(file) && typeof file.path === "string",
    ),
    decisions: collectObjectRecords(
      ledger.decisions,
      "invalid-decision",
      "decisions",
      "decision must be an object",
      violations,
    ),
    scopeChanges: collectObjectRecords(
      ledger.scopeChanges,
      "invalid-scope-change",
      "scopeChanges",
      "scope change must be an object",
      violations,
    ),
  };
  validateSchema(validatedLedger, context.requireLive ?? false, violations);
  const filePaths = validateInventory(validatedLedger, projectRoot, expectedPaths, violations);
  const claims = collectClaims(validatedLedger, filePaths, violations);
  const findings = collectFindings(validatedLedger, violations);
  const state = {
    projectRoot,
    claims,
    findings,
    inventoryMode: validatedLedger.inventoryMode,
    assignment: context.assignment ?? [],
    allowIncomplete: context.allowIncomplete ?? false,
    allowInconclusive: context.allowInconclusive ?? false,
    allowPendingDecisions: context.allowPendingDecisions ?? false,
    decisionId: context.decisionId,
  };
  validateFiles(validatedLedger, state, violations);
  validateFindings(findings, state, violations);
  validateDecisions(validatedLedger, state, violations);
  validateScopeChanges(validatedLedger, findings, violations);
  validateCrossLinks(claims, findings, violations);
  return violations.sort((left, right) =>
    `${left.code}\0${left.target}\0${left.message}`.localeCompare(
      `${right.code}\0${right.target}\0${right.message}`,
    ),
  );
}

function validateShardAssignment(plan, files, assignment, violations) {
  const assignedPaths = assignment.filter((row) => row.plan === plan).map((row) => row.path);
  const shardPaths = files.map((file) => file.path);
  if (JSON.stringify(shardPaths) !== JSON.stringify(assignedPaths)) {
    violations.push(
      violation("shard-assignment", plan, "shard paths must exactly match assignment order"),
    );
  }

  if (files.some((file) => file.assignedPlan !== plan)) {
    violations.push(violation("shard-owner", plan, "every shard file must name its owning plan"));
  }

  return assignedPaths;
}

function validateShardClaimOwners(plan, claimsArePresent, claims, assignedPaths, violations) {
  const assignedPathSet = new Set(assignedPaths);
  if (
    !claimsArePresent ||
    claims.some((claim) => !isObject(claim) || !assignedPathSet.has(claim.filePath))
  ) {
    violations.push(
      violation("shard-claim-owner", plan, "every shard claim must belong to an assigned file"),
    );
  }
}

function validateShardFileClaimLinks(files, claims, violations) {
  for (const file of files) {
    const actualClaimIds = claims
      .filter((claim) => isObject(claim) && claim.filePath === file.path)
      .map((claim) => claim.id)
      .sort();
    const declaredClaimIds = Array.isArray(file.claimIds) ? [...file.claimIds].sort() : [];
    if (
      !Array.isArray(file.claimIds) ||
      JSON.stringify(actualClaimIds) !== JSON.stringify(declaredClaimIds)
    ) {
      violations.push(
        violation(
          "shard-file-claim-links",
          file.path,
          "file claimIds must exactly match shard-local sourceClaims",
        ),
      );
    }
  }
}

function validateShardFindingLinks(plan, findingsArePresent, claims, findings, violations) {
  const referencedFindingIds = [
    ...new Set(claims.filter(isObject).map((claim) => claim.findingId)),
  ].sort();
  const findingIds = findings.filter(isObject).map((finding) => finding.id);
  const duplicateFindingIds = duplicateValues(findingIds);
  const declaredFindingIds = [...new Set(findingIds)].sort();
  if (
    !findingsArePresent ||
    findings.some((finding) => !isObject(finding) || typeof finding.id !== "string") ||
    duplicateFindingIds.length > 0 ||
    JSON.stringify(referencedFindingIds) !== JSON.stringify(declaredFindingIds)
  ) {
    violations.push(
      violation(
        "shard-finding-links",
        plan,
        "findings must exactly match those referenced by shard-local claims",
      ),
    );
  }
}

export function validateShard(shard, assignment) {
  if (!isObject(shard) || typeof shard.plan !== "string" || !Array.isArray(shard.files)) {
    throw new TypeError("shard requires plan and files");
  }

  const violations = [];
  const files = collectObjectRecords(
    shard.files,
    "invalid-shard-file",
    shard.plan,
    "shard file requires a path",
    violations,
    (file) => isObject(file) && typeof file.path === "string",
  );
  const assignedPaths = validateShardAssignment(shard.plan, files, assignment, violations);
  const claimsArePresent = Array.isArray(shard.sourceClaims);
  const findingsArePresent = Array.isArray(shard.findings);
  const claims = claimsArePresent ? shard.sourceClaims : [];
  const findings = findingsArePresent ? shard.findings : [];
  validateShardClaimOwners(shard.plan, claimsArePresent, claims, assignedPaths, violations);
  validateShardFileClaimLinks(files, claims, violations);
  validateShardFindingLinks(shard.plan, findingsArePresent, claims, findings, violations);

  // A duplicateOf target may live in another shard; it remains a reference, not shard-owned data.

  return violations;
}

export function mergeShards(baseLedger, shards, assignment = []) {
  const planOrder = [...new Set(assignment.map((row) => row.plan))];
  const duplicatePlans = duplicateValues(shards.map((shard) => shard.plan));
  if (duplicatePlans.length > 0) {
    throw new Error(`duplicate shard plans: ${duplicatePlans.join(", ")}`);
  }

  const assignedPlans = new Set(planOrder);
  const unexpected = shards
    .map((shard) => shard.plan)
    .filter((plan) => !assignedPlans.has(plan))
    .sort();
  if (unexpected.length > 0) {
    throw new Error(`unexpected shard plans: ${unexpected.join(", ")}`);
  }

  const byPlan = new Map(shards.map((shard) => [shard.plan, shard]));
  const missing = planOrder.filter((plan) => !byPlan.has(plan));
  if (missing.length > 0) {
    throw new Error(`missing shards: ${missing.join(", ")}`);
  }

  for (const shard of shards) {
    const violations = validateShard(shard, assignment);
    if (violations.length > 0) {
      throw new Error(violations.map((item) => item.message).join("; "));
    }
  }

  const ordered = planOrder.map((plan) => byPlan.get(plan));
  return {
    ...baseLedger,
    files: ordered.flatMap((shard) => shard.files),
    sourceClaims: ordered.flatMap((shard) => shard.sourceClaims),
    findings: ordered.flatMap((shard) => shard.findings),
  };
}

export function buildDecisionDossier(ledger, decisionId) {
  const decision = ledger.decisions.find((candidate) => candidate.id === decisionId);
  if (!decision) {
    throw new Error(`unknown decision: ${decisionId}`);
  }

  const findings = new Map(ledger.findings.map((finding) => [finding.id, finding]));
  const premises = (decision.premiseFindingIds ?? []).map((id) => findings.get(id));
  if (premises.length === 0 || premises.some((finding) => !terminalFinding(finding, findings))) {
    throw new Error(`decision ${decisionId} has unresolved premises`);
  }

  return { ...decision, premises };
}

export function deriveScopeImpact(ledger) {
  return [...ledger.scopeChanges]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((change) => ({
      id: change.id,
      requirementId: change.requirementId,
      action: change.action,
      findingIds: [...change.findingIds],
      decisionIds: [...change.decisionIds],
      rationale: change.rationale,
    }));
}

export function renderRevalidation(ledger) {
  const files = [...ledger.files].sort((left, right) => left.path.localeCompare(right.path));
  const findings = [...ledger.findings].sort((left, right) => left.id.localeCompare(right.id));
  const decisions = [...ledger.decisions].sort((left, right) => left.id.localeCompare(right.id));
  const scopeChanges = [...ledger.scopeChanges].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const lines = [
    "# Live Evidence Revalidation",
    "",
    "## Summary",
    "",
    `- Files: ${files.length}`,
    `- Claims: ${ledger.sourceClaims.length}`,
    `- Findings: ${findings.length}`,
    `- Decisions: ${decisions.length}`,
    `- Scope changes: ${scopeChanges.length}`,
    "",
    "## Files",
    "",
    ...(files.length === 0
      ? ["_None._"]
      : files.map(
          (file) =>
            `- ${markdownCode(file.path)} — ${escapeMarkdownText(file.outcome)} (${escapeMarkdownText(file.reviewStatus)}; ${file.claimIds.length} ${file.claimIds.length === 1 ? "claim" : "claims"})`,
        )),
    "",
    "## Findings",
    "",
    ...(findings.length === 0
      ? ["_None._"]
      : findings.map(
          (finding) =>
            `- ${markdownCode(finding.id)} — ${escapeMarkdownText(finding.evidenceStatus)} → ${escapeMarkdownText(finding.route)}`,
        )),
    "",
    "## Decisions",
    "",
    ...(decisions.length === 0
      ? ["_None._"]
      : decisions.map(
          (decision) => `- ${markdownCode(decision.id)} — ${escapeMarkdownText(decision.status)}`,
        )),
    "",
    "## Scope Changes",
    "",
    ...(scopeChanges.length === 0
      ? ["_None._"]
      : scopeChanges.map(
          (change) =>
            `- ${markdownCode(change.id)} — ${escapeMarkdownText(change.requirementId)}: ${escapeMarkdownText(change.action)}`,
        )),
    "",
  ];
  return lines.join("\n");
}

function parseArgs(args) {
  const positional = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (!item.startsWith("--")) {
      positional.push(item);
      continue;
    }

    if (
      item === "--allow-incomplete" ||
      item === "--allow-inconclusive" ||
      item === "--allow-pending-decisions" ||
      item === "--check"
    ) {
      options[item.slice(2)] = true;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${item} requires a value`);
    }

    options[item.slice(2)] = value;
    index += 1;
  }

  return { positional, options };
}

function readJson(projectRoot, relativePath) {
  return JSON.parse(readFileSync(assertSafeRelativePath(projectRoot, relativePath), "utf8"));
}

function readAssignments(projectRoot, options) {
  return parseAssignments(
    readFileSync(
      assertSafeRelativePath(projectRoot, options.assignment ?? ASSIGNMENT_PATH),
      "utf8",
    ),
  );
}

function validationContext(projectRoot, options, assignment = []) {
  return {
    projectRoot,
    requireLive: realpathSync(projectRoot) === realpathSync(DEFAULT_ROOT),
    assignment,
    allowIncomplete: options["allow-incomplete"] === true,
    allowInconclusive: options["allow-inconclusive"] === true,
    allowPendingDecisions: options["allow-pending-decisions"] === true,
    decisionId: typeof options.decision === "string" ? options.decision : undefined,
  };
}

function writeDurableFile(destination, contents) {
  const noFollow = fsConstants.O_NOFOLLOW | 0;
  const fileDescriptor = openSync(
    destination,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollow,
    0o600,
  );
  try {
    writeFileSync(fileDescriptor, contents);
    fsyncSync(fileDescriptor);
  } finally {
    closeSync(fileDescriptor);
  }
}

function writeAtomically(destination, contents) {
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  try {
    writeDurableFile(temporary, contents);
    renameSync(temporary, destination);
  } finally {
    if (lstatSync(temporary, { throwIfNoEntry: false }) !== undefined) {
      unlinkSync(temporary);
    }
  }
}

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function acquirePublishLock(lockPath) {
  try {
    writeDurableFile(lockPath, `${JSON.stringify({ pid: process.pid })}\n`);
    return;
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }

    let owner;
    try {
      owner = JSON.parse(readFileSync(lockPath, "utf8"));
    } catch (parseError) {
      throw new Error(`publish lock is malformed: ${lockPath}`, { cause: parseError });
    }

    if (processIsRunning(owner.pid)) {
      throw new Error(`publish is already running under process ${owner.pid}`, {
        cause: error,
      });
    }

    unlinkSync(lockPath);
  }

  writeDurableFile(lockPath, `${JSON.stringify({ pid: process.pid })}\n`);
}

function removePublishedFile(candidate) {
  const stats = lstatSync(candidate, { throwIfNoEntry: false });
  if (stats === undefined) {
    return;
  }

  unlinkSync(candidate);
}

function rollbackPublish(projectRoot, records, publishedDestinations = new Set()) {
  for (const record of [...records].reverse()) {
    const destination = assertSafeRelativePath(projectRoot, record.destination, {
      mustExist: false,
    });
    const staged = assertSafeRelativePath(projectRoot, record.staged, { mustExist: false });
    const backup = assertSafeRelativePath(projectRoot, record.backup, { mustExist: false });
    if (lstatSync(backup, { throwIfNoEntry: false }) !== undefined) {
      removePublishedFile(destination);
      renameSync(backup, destination);
    } else if (publishedDestinations.has(record.destination)) {
      removePublishedFile(destination);
    }

    if (lstatSync(staged, { throwIfNoEntry: false }) !== undefined) {
      removePublishedFile(staged);
    }
  }
}

function validatePublishRecoveryState(journal, projectRoot, journalPath) {
  for (const record of journal.records) {
    const destination = assertSafeRelativePath(projectRoot, record.destination, {
      mustExist: false,
    });
    const staged = assertSafeRelativePath(projectRoot, record.staged, { mustExist: false });
    const backup = assertSafeRelativePath(projectRoot, record.backup, { mustExist: false });
    const destinationExists = lstatSync(destination, { throwIfNoEntry: false }) !== undefined;
    const stagedExists = lstatSync(staged, { throwIfNoEntry: false }) !== undefined;
    const backupExists = lstatSync(backup, { throwIfNoEntry: false }) !== undefined;
    const publishedStateIsValid =
      destinationExists && !stagedExists && (!backupExists || record.hadDestination);
    const stagedWithBackupIsValid =
      backupExists && record.hadDestination && destinationExists !== stagedExists;
    const stagedWithoutBackupIsValid =
      !backupExists && stagedExists && (destinationExists || !record.hadDestination);
    if (
      (journal.status === "published" && !publishedStateIsValid) ||
      (journal.status === "staged" && !stagedWithBackupIsValid && !stagedWithoutBackupIsValid)
    ) {
      throw new Error(`publish journal is malformed: ${journalPath}`);
    }
  }
}

function finishPublish(projectRoot, records) {
  for (const record of records) {
    for (const candidate of [record.staged, record.backup]) {
      const absolute = assertSafeRelativePath(projectRoot, candidate, { mustExist: false });
      if (lstatSync(absolute, { throwIfNoEntry: false }) !== undefined) {
        removePublishedFile(absolute);
      }
    }
  }
}

function hasExactFields(value, expectedFields) {
  return (
    isObject(value) &&
    Object.keys(value).length === expectedFields.size &&
    Object.keys(value).every((field) => expectedFields.has(field))
  );
}

function validatePublishJournal(journal, projectRoot, journalPath) {
  const destinations = [LEDGER_PATH, MARKDOWN_PATH];
  if (
    !hasExactFields(journal, PUBLISH_JOURNAL_FIELDS) ||
    !PUBLISH_STATUSES.has(journal.status) ||
    !Array.isArray(journal.records) ||
    journal.records.length !== destinations.length
  ) {
    throw new Error(`publish journal is malformed: ${journalPath}`);
  }

  const seenDestinations = new Set();
  const transactionIds = new Set();
  for (const record of journal.records) {
    if (
      !hasExactFields(record, PUBLISH_RECORD_FIELDS) ||
      !destinations.includes(record.destination) ||
      seenDestinations.has(record.destination) ||
      typeof record.staged !== "string" ||
      typeof record.backup !== "string" ||
      typeof record.hadDestination !== "boolean"
    ) {
      throw new Error(`publish journal is malformed: ${journalPath}`);
    }

    const stagePrefix = `${record.destination}.stage-`;
    if (!record.staged.startsWith(stagePrefix)) {
      throw new Error(`publish journal is malformed: ${journalPath}`);
    }

    const transactionId = record.staged.slice(stagePrefix.length);
    if (
      !TRANSACTION_ID_PATTERN.test(transactionId) ||
      record.backup !== `${record.destination}.backup-${transactionId}`
    ) {
      throw new Error(`publish journal is malformed: ${journalPath}`);
    }

    seenDestinations.add(record.destination);
    transactionIds.add(transactionId);
  }

  if (transactionIds.size !== 1) {
    throw new Error(`publish journal is malformed: ${journalPath}`);
  }

  for (const record of journal.records) {
    for (const candidate of [record.destination, record.staged, record.backup]) {
      assertSafeRelativePath(projectRoot, candidate, { mustExist: false });
    }
  }
}

function recoverPublish(projectRoot, journalPath) {
  if (lstatSync(journalPath, { throwIfNoEntry: false }) === undefined) {
    return;
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  validatePublishJournal(journal, projectRoot, journalPath);
  validatePublishRecoveryState(journal, projectRoot, journalPath);

  if (journal.status === "published") {
    finishPublish(projectRoot, journal.records);
  } else {
    rollbackPublish(projectRoot, journal.records);
  }

  unlinkSync(journalPath);
}

export function publishRevalidation(projectRoot, json, markdown, hooks = {}) {
  const lockPath = assertSafeRelativePath(projectRoot, `${PHASE_ROOT}/.publish.lock`, {
    mustExist: false,
  });
  const journalPath = assertSafeRelativePath(projectRoot, `${PHASE_ROOT}/.publish-journal.json`, {
    mustExist: false,
  });
  acquirePublishLock(lockPath);
  try {
    recoverPublish(projectRoot, journalPath);
    const transactionId = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const entries = [
      { destination: LEDGER_PATH, contents: json },
      { destination: MARKDOWN_PATH, contents: markdown },
    ];
    const records = entries.map((entry) => ({
      destination: entry.destination,
      staged: `${entry.destination}.stage-${transactionId}`,
      backup: `${entry.destination}.backup-${transactionId}`,
      hadDestination:
        lstatSync(assertSafeRelativePath(projectRoot, entry.destination, { mustExist: false }), {
          throwIfNoEntry: false,
        }) !== undefined,
    }));

    try {
      for (const [index, entry] of entries.entries()) {
        hooks.beforeStage?.(entry.destination);
        writeDurableFile(
          assertSafeRelativePath(projectRoot, records[index].staged, { mustExist: false }),
          entry.contents,
        );
      }

      hooks.afterStage?.();
      writeAtomically(journalPath, `${JSON.stringify({ status: "staged", records }, null, 2)}\n`);
    } catch (stagingError) {
      finishPublish(projectRoot, records);
      throw stagingError;
    }

    let published = false;
    const publishedDestinations = new Set();
    try {
      for (const record of records) {
        if (record.hadDestination) {
          renameSync(
            assertSafeRelativePath(projectRoot, record.destination, { mustExist: false }),
            assertSafeRelativePath(projectRoot, record.backup, { mustExist: false }),
          );
        }
      }

      for (const record of records) {
        renameSync(
          assertSafeRelativePath(projectRoot, record.staged, { mustExist: false }),
          assertSafeRelativePath(projectRoot, record.destination, { mustExist: false }),
        );
        publishedDestinations.add(record.destination);
        hooks.afterPublish?.(record.destination);
      }

      writeAtomically(
        journalPath,
        `${JSON.stringify({ status: "published", records }, null, 2)}\n`,
      );
      published = true;
      finishPublish(projectRoot, records);
      unlinkSync(journalPath);
    } catch (publishError) {
      if (published) {
        throw publishError;
      }

      try {
        rollbackPublish(projectRoot, records, publishedDestinations);
        unlinkSync(journalPath);
      } catch (rollbackError) {
        throw new AggregateError(
          [publishError, rollbackError],
          "publish failed and rollback did not complete; recovery journal retained",
          { cause: rollbackError },
        );
      }

      throw publishError;
    }
  } finally {
    unlinkSync(lockPath);
  }
}

function writeViolations(violations, runtime) {
  for (const item of violations) {
    runtime.stderr.write(`${item.code}: ${item.target}: ${item.message}\n`);
  }

  if (violations.length > 0) {
    runtime.exitCode = 1;
  }
}

function handleInventory({ projectRoot, options, runtime }) {
  const inventory = enumerateCorpus(projectRoot);
  const assigned = readAssignments(projectRoot, options).map((row) => row.path);
  if (JSON.stringify(inventory) !== JSON.stringify(assigned)) {
    throw new Error("live inventory differs from corpus assignment");
  }

  const categories = Object.fromEntries(
    [...CATEGORIES].map((category) => [
      category,
      assigned.filter((candidate) => categoryForPath(candidate) === category).length,
    ]),
  );
  runtime.stdout.write(
    `Inventory valid: ${assigned.length} total (${categories["first-pass"]} first-pass, ${categories.adversarial} adversarial, ${categories.control} control)\n`,
  );
}

function handleRender({ projectRoot, ledger }) {
  writeAtomically(
    assertSafeRelativePath(projectRoot, MARKDOWN_PATH, { mustExist: false }),
    renderRevalidation(ledger),
  );
}

function handleValidate({ projectRoot, ledger, options, runtime }) {
  const assignment = readAssignments(projectRoot, options);
  const violations = validateLedger(ledger, validationContext(projectRoot, options, assignment));
  const rendered = renderRevalidation(ledger);
  const markdown = readFileSync(assertSafeRelativePath(projectRoot, MARKDOWN_PATH), "utf8");
  if (markdown !== rendered) {
    violations.push(
      violation("markdown-drift", MARKDOWN_PATH, "generated Markdown differs from canonical JSON"),
    );
  }

  writeViolations(violations, runtime);
  if (violations.length === 0) {
    runtime.stdout.write("Revalidation ledger valid.\n");
  }
}

function handleValidateShard({ projectRoot, options, runtime }) {
  const assignment = readAssignments(projectRoot, options);
  const shard = readJson(projectRoot, options.shard);
  if (options.plan && shard.plan !== options.plan) {
    throw new Error(`shard plan ${shard.plan} does not match ${options.plan}`);
  }

  writeViolations(validateShard(shard, assignment), runtime);
}

function readShards(projectRoot, relativeRoot) {
  const absoluteRoot = assertSafeRelativePath(projectRoot, relativeRoot);
  return readdirSync(absoluteRoot, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const relativePath = toPosix(path.join(relativeRoot, entry.name));
      if (!entry.isFile()) {
        throw new Error(`shard member must be a regular file: ${relativePath}`);
      }

      const absolutePath = assertSafeRelativePath(projectRoot, relativePath);
      return JSON.parse(readFileSync(absolutePath, "utf8"));
    });
}

function handleMergeShards({ projectRoot, ledger, options, runtime }) {
  const assignment = readAssignments(projectRoot, options);
  const merged = mergeShards(
    ledger ?? { version: 1, inventoryMode: "live", decisions: [], scopeChanges: [] },
    readShards(projectRoot, options["shard-dir"]),
    assignment,
  );
  const violations = validateLedger(merged, validationContext(projectRoot, options, assignment));
  writeViolations(violations, runtime);
  if (violations.length > 0) {
    return;
  }

  const json = `${JSON.stringify(merged, null, 2)}\n`;
  const markdown = renderRevalidation(merged);
  if (options.check === true) {
    runtime.stdout.write("Shard merge valid.\n");
    return;
  }

  publishRevalidation(projectRoot, json, markdown);
  runtime.stdout.write("Shard merge published.\n");
}

function handleDecisionDossier({ ledger, options, runtime }) {
  runtime.stdout.write(`${JSON.stringify(buildDecisionDossier(ledger, options.id), null, 2)}\n`);
}

function parseRequirementsContract(markdown, violations) {
  const definitions = new Map();
  const history = new Map();
  let section = "";
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^#{2,3} (.+)$/);
    if (heading !== null) {
      section = heading[1];
      continue;
    }

    const definition = line.match(/^- \[[ x]\] \*\*([A-Z]+-\d+)\*\*:/);
    if (definition !== null) {
      const id = definition[1];
      if (definitions.has(id)) {
        violations.push(
          violation("duplicate-requirement", id, "requirement is defined more than once"),
        );
      } else {
        definitions.set(id, section);
      }
    }

    const historical =
      section === "Evidence and History" ? line.match(/^- \*\*([A-Z]+-\d+)\*\*/) : null;
    if (historical !== null) {
      const id = historical[1];
      if (history.has(id)) {
        violations.push(
          violation("duplicate-requirement", id, "requirement is recorded more than once"),
        );
      } else {
        history.set(id, section);
      }
    }
  }

  const dispositions = new Map();
  for (const match of markdown.matchAll(/^\| ([A-Z]+-\d+) \| ([^|]+) \| ([^|]+) \|$/gm)) {
    const [, id, route, status] = match;
    if (dispositions.has(id)) {
      violations.push(
        violation("duplicate-requirement-route", id, "traceability row appears more than once"),
      );
    } else {
      dispositions.set(id, { route: route.trim(), status: status.trim() });
    }
  }

  return { definitions, history, dispositions };
}

function parseRoadmapContract(markdown, violations) {
  const phases = new Map();
  const headings = [...markdown.matchAll(/^### Phase (\d+): (.+)$/gm)];
  for (const [index, match] of headings.entries()) {
    const number = Number(match[1]);
    if (number < 2 || number > 9) {
      continue;
    }

    const id = `PHASE-${String(number).padStart(2, "0")}`;
    if (phases.has(id)) {
      violations.push(
        violation("duplicate-phase-route", id, "roadmap phase appears more than once"),
      );
      continue;
    }

    const end = headings[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(match.index + match[0].length, end);
    const declaration = body.match(/^\*\*Requirements:\*\* (.+)$/m);
    phases.set(id, {
      number,
      title: match[2],
      requirements: declaration === null ? [] : declaration[1].split(", "),
    });
  }

  return phases;
}

function validateRequirementChange(requirements, requirementId, change, violations) {
  const id = `SCOPE-REQ-${requirementId}`;
  const disposition = requirements.dispositions.get(requirementId);
  const expectedSection =
    change.action === "move-to-evidence"
      ? requirements.history.get(requirementId)
      : requirements.definitions.get(requirementId);

  if (
    change.action === "move-to-evidence" &&
    disposition?.status !== undefined &&
    disposition.status !== "Evidence only"
  ) {
    violations.push(
      violation(
        "requirement-disposition",
        requirementId,
        "moved requirement must be evidence only",
      ),
    );
  }

  if (change.action !== "move-to-evidence" && disposition?.status === "Evidence only") {
    violations.push(
      violation(
        "requirement-disposition",
        requirementId,
        "active requirement cannot be evidence only",
      ),
    );
  }

  const afterParts = typeof change.afterAnchor === "string" ? change.afterAnchor.split(" :: ") : [];
  if (
    afterParts.length !== 3 ||
    afterParts[0] !== REQUIREMENTS_PATH ||
    afterParts[1] !== expectedSection ||
    !afterParts[2].startsWith(`${requirementId} —`)
  ) {
    violations.push(
      violation("scope-after-anchor", id, "afterAnchor does not resolve to requirement"),
    );
  }
}

function requirementRows(rows) {
  return new Map([...rows].filter(([id]) => id.startsWith("SCOPE-REQ-")));
}

function validateRequirementSets(requirements, rows, violations) {
  if (rows.size !== 32) {
    violations.push(
      violation(
        "scope-requirement-count",
        "scopeChanges",
        "expected exactly 32 unique requirement rows",
      ),
    );
  }

  const expectedIds = new Set([...rows.keys()].map((id) => id.slice("SCOPE-REQ-".length)));
  for (const requirementId of [...expectedIds].sort()) {
    const change = rows.get(`SCOPE-REQ-${requirementId}`);
    const hasDefinition = requirements.definitions.has(requirementId);
    const hasHistory = requirements.history.has(requirementId);
    const expectsHistory = change.action === "move-to-evidence";
    if ((expectsHistory && !hasHistory) || (!expectsHistory && !hasDefinition)) {
      violations.push(
        violation(
          "missing-requirement-definition",
          requirementId,
          expectsHistory ? "evidence/history record is absent" : "active definition is absent",
        ),
      );
    }

    if (!requirements.dispositions.has(requirementId)) {
      violations.push(
        violation("missing-requirement-route", requirementId, "traceability row is absent"),
      );
    }
  }

  const parsedIds = new Set([...requirements.definitions.keys(), ...requirements.history.keys()]);
  for (const requirementId of [...parsedIds].sort()) {
    if (!expectedIds.has(requirementId)) {
      violations.push(
        violation("unexpected-requirement-definition", requirementId, "scope row is absent"),
      );
    }
  }

  for (const requirementId of [...requirements.dispositions.keys()].sort()) {
    if (!expectedIds.has(requirementId)) {
      violations.push(
        violation("unexpected-requirement-route", requirementId, "scope row is absent"),
      );
    }
  }
}

function validateRequirementContracts(requirements, allRows, violations) {
  const rows = requirementRows(allRows);
  validateRequirementSets(requirements, rows, violations);
  for (const [id, change] of rows) {
    const requirementId = id.slice("SCOPE-REQ-".length);
    validateRequirementChange(requirements, requirementId, change, violations);
  }
}

function validatePhaseContracts(requirements, phases, rows, violations) {
  for (let number = 2; number <= 9; number += 1) {
    const phaseId = `PHASE-${String(number).padStart(2, "0")}`;
    const change = rows.get(`SCOPE-ROUTE-${phaseId}`);
    const phase = phases.get(phaseId);
    if (change === undefined) {
      violations.push(violation("missing-scope-route", phaseId, "scope route is absent"));
      continue;
    }

    if (phase === undefined) {
      violations.push(violation("missing-phase-route", phaseId, "roadmap phase is absent"));
      continue;
    }

    const expectedRequirements = [...requirements.dispositions.entries()]
      .filter(([, disposition]) => disposition.route === `Phase ${number}`)
      .map(([id]) => id)
      .sort();
    if (JSON.stringify([...phase.requirements].sort()) !== JSON.stringify(expectedRequirements)) {
      violations.push(
        violation("phase-requirements", phaseId, "roadmap membership differs from traceability"),
      );
    }

    const afterParts =
      typeof change.afterAnchor === "string" ? change.afterAnchor.split(" :: ") : [];
    if (
      afterParts.length !== 3 ||
      afterParts[0] !== ROADMAP_PATH ||
      afterParts[1] !== `${phaseId} / Phase ${number} ${phase.title}`
    ) {
      violations.push(
        violation("scope-after-anchor", change.id, "afterAnchor does not resolve to phase"),
      );
    }
  }
}

function validatePlanningContracts(ledger, requirementsMarkdown, roadmapMarkdown) {
  const violations = [];
  const requirements = parseRequirementsContract(requirementsMarkdown, violations);
  const phases = parseRoadmapContract(roadmapMarkdown, violations);
  const rows = new Map();
  for (const change of ledger.scopeChanges) {
    if (rows.has(change.id)) {
      violations.push(
        violation("duplicate-scope-contract", change.id, "scope row appears more than once"),
      );
    } else {
      rows.set(change.id, change);
    }
  }

  validateRequirementContracts(requirements, rows, violations);
  validatePhaseContracts(requirements, phases, rows, violations);

  if (ledger.scopeChanges.length !== 40 || rows.size !== 40) {
    violations.push(
      violation("scope-contract-count", "scopeChanges", "expected exactly 40 unique rows"),
    );
  }

  return violations.sort((left, right) =>
    `${left.code}\0${left.target}`.localeCompare(`${right.code}\0${right.target}`),
  );
}

function readPlanningContract(projectRoot, candidate) {
  const absolutePath = assertSafeRelativePath(projectRoot, candidate);
  if (!lstatSync(absolutePath).isFile()) {
    throw new Error(`path must be a regular file: ${candidate}`);
  }

  return readFileSync(absolutePath, "utf8");
}

function handleScopeImpact({ projectRoot, ledger, options, runtime }) {
  if (options.check === true) {
    const requirementsMarkdown = readPlanningContract(projectRoot, REQUIREMENTS_PATH);
    const roadmapMarkdown = readPlanningContract(projectRoot, ROADMAP_PATH);
    const violations = validatePlanningContracts(ledger, requirementsMarkdown, roadmapMarkdown);
    writeViolations(violations, runtime);
    if (violations.length === 0) {
      runtime.stdout.write(`Scope impact valid: ${ledger.scopeChanges.length} records.\n`);
    }

    return;
  }

  runtime.stdout.write(`${JSON.stringify(deriveScopeImpact(ledger), null, 2)}\n`);
}

const COMMAND_HANDLERS = new Map([
  ["inventory", handleInventory],
  ["render", handleRender],
  ["validate", handleValidate],
  ["validate-shard", handleValidateShard],
  ["merge-shards", handleMergeShards],
  ["decision-dossier", handleDecisionDossier],
  ["scope-impact", handleScopeImpact],
]);

export function main(args = process.argv.slice(2), runtime = process) {
  const { positional, options } = parseArgs(args);
  const command = positional[0];
  const projectRoot = path.resolve(options.root ?? DEFAULT_ROOT);
  const ledger = existsSync(path.join(projectRoot, LEDGER_PATH))
    ? readJson(projectRoot, LEDGER_PATH)
    : null;
  if (!ledger && !["inventory", "validate-shard", "merge-shards"].includes(command)) {
    throw new Error(`missing ${LEDGER_PATH}`);
  }

  const handler = COMMAND_HANDLERS.get(command);
  if (!handler) {
    throw new Error(
      "command must be validate, render, inventory, validate-shard, merge-shards, decision-dossier, or scope-impact",
    );
  }

  handler({ projectRoot, ledger, options, runtime });
}

export function reportCliError(error, runtime = process) {
  runtime.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  runtime.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    reportCliError(error);
  }
}
