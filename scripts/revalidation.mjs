import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* eslint-disable sonarjs/cognitive-complexity */

const DEFAULT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const CORPUS_ROOT = ".planning/reviews/unit-test-adversarial";
const PHASE_ROOT = ".planning/phases/01-live-evidence-revalidation";
const LEDGER_PATH = `${PHASE_ROOT}/01-REVALIDATION.json`;
const MARKDOWN_PATH = `${PHASE_ROOT}/01-REVALIDATION.md`;
const ASSIGNMENT_PATH = `${PHASE_ROOT}/01-CORPUS-ASSIGNMENT.md`;
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
const SECRET_PATTERN = /(?:token|password|secret|authorization|api[-_]?key)\s*[=:]\s*\S+/i;

function toPosix(candidate) {
  return candidate.split(path.sep).join("/");
}

function violation(code, target, message) {
  return { code, target, message };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`path escapes repository root: ${candidate}`);
  }

  if (!mustExist) {
    return target;
  }

  if (!existsSync(target)) {
    throw new Error(`path does not exist: ${candidate}`);
  }

  const resolved = realpathSync(target);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`path resolves through a symlink outside repository root: ${candidate}`);
  }

  return resolved;
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
  return typeof route === "string" && (ROUTES.has(route) || /^Phase [2-9]\d*$/.test(route));
}

function terminalFinding(finding) {
  return finding && finding.evidenceStatus !== "inconclusive";
}

// Ledger validation intentionally centralizes cross-collection invariants so one
// deterministic pass can report all actionable violations together.
// fallow-ignore-next-line complexity -- one pass must accumulate every linked-ledger violation deterministically.
export function validateLedger(ledger, context = {}) {
  if (!isObject(ledger)) {
    throw new TypeError("ledger must be an object");
  }

  const projectRoot = context.projectRoot ?? DEFAULT_ROOT;
  const expectedPaths = context.expectedPaths ?? enumerateCorpus(projectRoot);
  const allowIncomplete = context.allowIncomplete ?? false;
  const allowInconclusive = context.allowInconclusive ?? false;
  const allowPendingDecisions = context.allowPendingDecisions ?? false;
  const requireLive = context.requireLive ?? false;
  const decisionId = context.decisionId;
  const violations = [];
  for (const collection of ["files", "sourceClaims", "findings", "decisions", "scopeChanges"]) {
    if (!Array.isArray(ledger[collection])) {
      throw new TypeError(`ledger.${collection} must be an array`);
    }
  }

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

  const filePaths = ledger.files.map((file) => file.path);
  for (const file of ledger.files) {
    assertSafeRelativePath(projectRoot, file.path);
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

  if (
    ledger.inventoryMode === "live" &&
    (expectedPaths.length !== 110 || ledger.files.length !== 110)
  ) {
    violations.push(
      violation(
        "inventory-count",
        "files",
        `live inventory must contain exactly 110 paths; found ${ledger.files.length}`,
      ),
    );
  }

  if (ledger.inventoryMode === "live") {
    const categoryCounts = Object.fromEntries(
      [...CATEGORIES].map((category) => [
        category,
        ledger.files.filter((file) => file.category === category).length,
      ]),
    );
    if (
      categoryCounts["first-pass"] !== 45 ||
      categoryCounts.adversarial !== 58 ||
      categoryCounts.control !== 7
    ) {
      violations.push(
        violation(
          "category-count",
          "files",
          `live inventory must contain 45 first-pass, 58 adversarial, and 7 control files; found ${categoryCounts["first-pass"]}/${categoryCounts.adversarial}/${categoryCounts.control}`,
        ),
      );
    }

    if (ledger.sourceClaims.length !== 2_897 || ledger.findings.length !== 2_437) {
      violations.push(
        violation(
          "evidence-count",
          "ledger",
          `live evidence must contain 2897 claims and 2437 findings; found ${ledger.sourceClaims.length}/${ledger.findings.length}`,
        ),
      );
    }
  }

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
  }

  for (const claim of claims.values()) {
    if (!findings.has(claim.findingId)) {
      violations.push(violation("dangling-claim-finding", claim.id, String(claim.findingId)));
    }
  }

  for (const file of ledger.files) {
    if (!CATEGORIES.has(file.category)) {
      violations.push(violation("invalid-category", file.path, String(file.category)));
    }

    if (!REVIEW_STATUSES.has(file.reviewStatus)) {
      violations.push(violation("invalid-review-status", file.path, String(file.reviewStatus)));
    }

    if (!OUTCOMES.has(file.outcome)) {
      violations.push(violation("invalid-outcome", file.path, String(file.outcome)));
    }

    const linkedClaims = [...claims.values()].filter((claim) => claim.filePath === file.path);
    const actualIds = linkedClaims.map((claim) => claim.id).sort();
    const declaredIds = Array.isArray(file.claimIds) ? [...file.claimIds].sort() : [];
    if (JSON.stringify(actualIds) !== JSON.stringify(declaredIds)) {
      violations.push(
        violation("file-claim-links", file.path, "declared claimIds do not match sourceClaims"),
      );
    }

    const derived = expectedOutcome(file, linkedClaims, findings);
    if (file.outcome !== derived) {
      violations.push(violation("derived-outcome", file.path, `expected ${derived}`));
    }

    if (
      !allowIncomplete &&
      file.reviewStatus !== "complete" &&
      file.reviewStatus !== "superseded"
    ) {
      violations.push(violation("incomplete-file", file.path, "file review is not complete"));
    }
  }

  for (const finding of findings.values()) {
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

    for (const claimId of finding.claimIds ?? []) {
      if (!claims.has(claimId)) {
        violations.push(violation("dangling-finding-claim", finding.id, claimId));
      }
    }

    for (const reference of finding.sourceRefs ?? []) {
      validateReference(reference, projectRoot, finding.id, violations);
    }

    for (const reference of finding.testRefs ?? []) {
      validateReference(reference, projectRoot, finding.id, violations);
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

    const validation = finding.validation;
    if (!isObject(validation) || !METHODS.has(validation.method)) {
      violations.push(
        violation("invalid-validation", finding.id, "validation method is missing or invalid"),
      );
    } else if (validation.method === "static-proof") {
      if (typeof validation.tool !== "string" || typeof validation.observed !== "string") {
        violations.push(
          violation("incomplete-validation", finding.id, "static proof requires tool and observed"),
        );
      }
    } else if (
      typeof validation.command !== "string" ||
      !Number.isInteger(validation.exitCode) ||
      typeof validation.observed !== "string"
    ) {
      violations.push(
        violation(
          "incomplete-validation",
          finding.id,
          "probe requires command, exitCode, and observed",
        ),
      );
    }

    const serializedValidation = JSON.stringify(validation ?? {});
    if (
      SECRET_PATTERN.test(serializedValidation) ||
      serializedValidation.includes(`${path.sep}home${path.sep}`)
    ) {
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

  const decisionIds = duplicateValues(ledger.decisions.map((decision) => decision.id));
  for (const id of decisionIds) {
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

  if (allowPendingDecisions) {
    const pendingDecisionIds = ledger.decisions
      .filter((decision) => decision.status === "pending")
      .map((decision) => decision.id)
      .sort();
    if (JSON.stringify(pendingDecisionIds) !== JSON.stringify(PENDING_DECISION_IDS)) {
      violations.push(
        violation(
          "pending-decision-set",
          "decisions",
          `pending decisions must be exactly ${PENDING_DECISION_IDS.join(", ")}`,
        ),
      );
    }
  }

  for (const decision of ledger.decisions) {
    if (!/^MF-DEC-\d{2}$/.test(decision.id ?? "")) {
      violations.push(violation("invalid-decision-id", String(decision.id), "expected MF-DEC-NN"));
    }

    for (const premise of decision.premiseFindingIds ?? []) {
      if (!findings.has(premise)) {
        violations.push(violation("dangling-decision-premise", decision.id, premise));
      }
    }

    if (decision.status === "resolved") {
      const prerequisites = (decision.premiseFindingIds ?? []).map((id) => findings.get(id));
      if (
        prerequisites.length === 0 ||
        prerequisites.some((finding) => !terminalFinding(finding))
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
    } else if (decision.status !== "pending") {
      violations.push(violation("invalid-decision-status", decision.id, String(decision.status)));
    }

    if (
      !allowPendingDecisions &&
      decision.status !== "resolved" &&
      (decisionId === undefined || decision.id === decisionId)
    ) {
      violations.push(
        violation("pending-decision", decision.id, "operator decision is unresolved"),
      );
    }
  }

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
      typeof change.action !== "string" ||
      typeof change.rationale !== "string"
    ) {
      violations.push(
        violation(
          "incomplete-scope-change",
          change.id,
          "requirementId, action, and rationale are mandatory",
        ),
      );
    }
  }

  return violations.sort((left, right) =>
    `${left.code}\0${left.target}\0${left.message}`.localeCompare(
      `${right.code}\0${right.target}\0${right.message}`,
    ),
  );
}

export function validateShard(shard, assignment) {
  if (!isObject(shard) || typeof shard.plan !== "string" || !Array.isArray(shard.files)) {
    throw new TypeError("shard requires plan and files");
  }

  const assignedPaths = assignment.filter((row) => row.plan === shard.plan).map((row) => row.path);
  const shardPaths = shard.files.map((file) => file.path);
  const violations = [];
  if (JSON.stringify(shardPaths) !== JSON.stringify(assignedPaths)) {
    violations.push(
      violation("shard-assignment", shard.plan, "shard paths must exactly match assignment order"),
    );
  }

  if (shard.files.some((file) => file.assignedPlan !== shard.plan)) {
    violations.push(
      violation("shard-owner", shard.plan, "every shard file must name its owning plan"),
    );
  }

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
    sourceClaims: ordered.flatMap((shard) => shard.sourceClaims ?? []),
    findings: ordered.flatMap((shard) => shard.findings ?? []),
  };
}

export function buildDecisionDossier(ledger, decisionId) {
  const decision = ledger.decisions.find((candidate) => candidate.id === decisionId);
  if (!decision) {
    throw new Error(`unknown decision: ${decisionId}`);
  }

  const findings = new Map(ledger.findings.map((finding) => [finding.id, finding]));
  const premises = (decision.premiseFindingIds ?? []).map((id) => findings.get(id));
  if (premises.length === 0 || premises.some((finding) => !terminalFinding(finding))) {
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
            `- \`${file.path}\` — ${file.outcome} (${file.reviewStatus}; ${file.claimIds.length} ${file.claimIds.length === 1 ? "claim" : "claims"})`,
        )),
    "",
    "## Findings",
    "",
    ...(findings.length === 0
      ? ["_None._"]
      : findings.map(
          (finding) => `- \`${finding.id}\` — ${finding.evidenceStatus} → ${finding.route}`,
        )),
    "",
    "## Decisions",
    "",
    ...(decisions.length === 0
      ? ["_None._"]
      : decisions.map((decision) => `- \`${decision.id}\` — ${decision.status}`)),
    "",
    "## Scope Changes",
    "",
    ...(scopeChanges.length === 0
      ? ["_None._"]
      : scopeChanges.map(
          (change) => `- \`${change.id}\` — ${change.requirementId}: ${change.action}`,
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

function validationContext(projectRoot, options) {
  return {
    projectRoot,
    requireLive: true,
    allowIncomplete: options["allow-incomplete"] === true,
    allowInconclusive: options["allow-inconclusive"] === true,
    allowPendingDecisions: options["allow-pending-decisions"] === true,
    decisionId: typeof options.decision === "string" ? options.decision : undefined,
  };
}

function writeAtomically(destination, contents) {
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  try {
    writeFileSync(temporary, contents, { flag: "wx" });
    renameSync(temporary, destination);
  } finally {
    if (existsSync(temporary)) {
      unlinkSync(temporary);
    }
  }
}

// CLI dispatch is kept in one boundary; all domain work remains in pure exports.
// fallow-ignore-next-line complexity -- command routing stays at the sole process boundary.
function main(args = process.argv.slice(2)) {
  const { positional, options } = parseArgs(args);
  const command = positional[0];
  const projectRoot = path.resolve(options.root ?? DEFAULT_ROOT);
  const ledger = existsSync(path.join(projectRoot, LEDGER_PATH))
    ? readJson(projectRoot, LEDGER_PATH)
    : null;
  if (command === "inventory") {
    const inventory = enumerateCorpus(projectRoot);
    const assignment = parseAssignments(
      readFileSync(
        assertSafeRelativePath(projectRoot, options.assignment ?? ASSIGNMENT_PATH),
        "utf8",
      ),
    );
    const assigned = assignment.map((row) => row.path);
    if (JSON.stringify(inventory) !== JSON.stringify(assigned)) {
      throw new Error("live inventory differs from corpus assignment");
    }

    const categories = {
      control: assigned.filter(
        (candidate) =>
          (!candidate.includes("/adversarial/") && candidate.split("/").at(-1).startsWith("_")) ||
          candidate.endsWith("/README.md") ||
          candidate.endsWith("/META-FINDINGS.md"),
      ).length,
      adversarial: assigned.filter((candidate) => candidate.includes("/adversarial/")).length,
    };
    categories["first-pass"] = assigned.length - categories.control - categories.adversarial;
    process.stdout.write(
      `Inventory valid: ${assigned.length} total (${categories["first-pass"]} first-pass, ${categories.adversarial} adversarial, ${categories.control} control)\n`,
    );
    return;
  }

  if (!ledger && !["validate-shard", "merge-shards"].includes(command)) {
    throw new Error(`missing ${LEDGER_PATH}`);
  }

  if (command === "render") {
    writeFileSync(
      assertSafeRelativePath(projectRoot, MARKDOWN_PATH, { mustExist: false }),
      renderRevalidation(ledger),
    );
    return;
  }

  if (command === "validate") {
    const violations = validateLedger(ledger, validationContext(projectRoot, options));
    const rendered = renderRevalidation(ledger);
    const markdown = readFileSync(assertSafeRelativePath(projectRoot, MARKDOWN_PATH), "utf8");
    if (markdown !== rendered) {
      violations.push(
        violation(
          "markdown-drift",
          MARKDOWN_PATH,
          "generated Markdown differs from canonical JSON",
        ),
      );
    }

    if (violations.length > 0) {
      for (const item of violations) {
        process.stderr.write(`${item.code}: ${item.target}: ${item.message}\n`);
      }

      process.exitCode = 1;
    } else {
      process.stdout.write("Revalidation ledger valid.\n");
    }

    return;
  }

  const assignmentPath = options.assignment ?? ASSIGNMENT_PATH;
  const assignment = parseAssignments(
    readFileSync(assertSafeRelativePath(projectRoot, assignmentPath), "utf8"),
  );
  if (command === "validate-shard") {
    const shard = readJson(projectRoot, options.shard);
    if (options.plan && shard.plan !== options.plan) {
      throw new Error(`shard plan ${shard.plan} does not match ${options.plan}`);
    }

    const violations = validateShard(shard, assignment);
    if (violations.length > 0) {
      for (const item of violations) {
        process.stderr.write(`${item.code}: ${item.target}: ${item.message}\n`);
      }

      process.exitCode = 1;
    }

    return;
  }

  if (command === "merge-shards") {
    const shardRoot = assertSafeRelativePath(projectRoot, options["shard-dir"]);
    const shards = readdirSync(shardRoot)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => JSON.parse(readFileSync(path.join(shardRoot, name), "utf8")));
    const merged = mergeShards(
      ledger ?? { version: 1, inventoryMode: "live", decisions: [], scopeChanges: [] },
      shards,
      assignment,
    );
    const violations = validateLedger(merged, validationContext(projectRoot, options));
    if (violations.length > 0) {
      for (const item of violations) {
        process.stderr.write(`${item.code}: ${item.target}: ${item.message}\n`);
      }

      process.exitCode = 1;
      return;
    }

    const json = `${JSON.stringify(merged, null, 2)}\n`;
    const markdown = renderRevalidation(merged);
    if (options.check === true) {
      process.stdout.write("Shard merge valid.\n");
      return;
    }

    writeAtomically(assertSafeRelativePath(projectRoot, LEDGER_PATH, { mustExist: false }), json);
    writeAtomically(
      assertSafeRelativePath(projectRoot, MARKDOWN_PATH, { mustExist: false }),
      markdown,
    );
    process.stdout.write("Shard merge published.\n");
    return;
  }

  if (command === "decision-dossier") {
    process.stdout.write(`${JSON.stringify(buildDecisionDossier(ledger, options.id), null, 2)}\n`);
    return;
  }

  if (command === "scope-impact") {
    process.stdout.write(`${JSON.stringify(deriveScopeImpact(ledger), null, 2)}\n`);
    return;
  }

  throw new Error(
    "command must be validate, render, inventory, validate-shard, merge-shards, decision-dossier, or scope-impact",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
