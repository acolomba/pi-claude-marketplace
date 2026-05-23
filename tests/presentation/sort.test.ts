import assert from "node:assert/strict";
import test from "node:test";

import { compareByNameThenScope } from "../../extensions/pi-claude-marketplace/presentation/sort.ts";

test("MSG-GR-3: compares by name primary (case-insensitive)", () => {
  const r = compareByNameThenScope(
    { name: "alpha", scope: "user" },
    { name: "beta", scope: "user" },
  );
  assert.ok(r < 0, "alpha < beta");
});

test("MSG-GR-3: case-insensitive equality via sensitivity:'base'", () => {
  const r = compareByNameThenScope(
    { name: "ALPHA", scope: "user" },
    { name: "alpha", scope: "user" },
  );
  assert.equal(r, 0, "ALPHA and alpha are equal under sensitivity:'base'");
});

test("MSG-GR-3: project-before-user tie-breaker when names tie", () => {
  const r1 = compareByNameThenScope(
    { name: "alpha", scope: "project" },
    { name: "alpha", scope: "user" },
  );
  assert.ok(r1 < 0, "project precedes user when names match");

  const r2 = compareByNameThenScope(
    { name: "alpha", scope: "user" },
    { name: "alpha", scope: "project" },
  );
  assert.ok(r2 > 0, "user follows project when names match (reverse case)");
});

test("MSG-GR-3: stable when both name and scope tie (returns 0)", () => {
  const r = compareByNameThenScope(
    { name: "alpha", scope: "user" },
    { name: "alpha", scope: "user" },
  );
  assert.equal(r, 0);
});

test("MSG-GR-3: case-insensitive equality also returns 0 across scopes (so tie-breaker fires)", () => {
  const r = compareByNameThenScope(
    { name: "ALPHA", scope: "project" },
    { name: "alpha", scope: "user" },
  );
  assert.ok(r < 0, "case-insensitive tie still triggers project-before-user tie-breaker");
});

test("MSG-GR-3: sort applied to a heterogeneous array preserves Array.sort stability semantics", () => {
  const input = [
    { name: "beta", scope: "user" as const },
    { name: "alpha", scope: "user" as const },
    { name: "alpha", scope: "project" as const },
    { name: "Beta", scope: "project" as const },
  ];
  const sorted = [...input].sort(compareByNameThenScope);
  // Names: alpha(project), alpha(user), beta(project), Beta(user) -- or Beta(project) tied with beta(user)?
  // sensitivity:'base' treats "Beta" === "beta". So Beta(project) and beta(user) are name-equal:
  // project precedes user.
  assert.equal(sorted[0]?.name, "alpha");
  assert.equal(sorted[0]?.scope, "project");
  assert.equal(sorted[1]?.name, "alpha");
  assert.equal(sorted[1]?.scope, "user");
  // The next two are beta-class (Beta + beta). Beta(project) first, then beta(user).
  assert.equal(sorted[2]?.scope, "project");
  assert.equal(sorted[3]?.scope, "user");
});
