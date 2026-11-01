/**
 * @fileoverview Steps about the project trust a bridged skill needs: starting
 * the profile Pi in a project it does not trust (T-02-17).
 */

import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// Pi loads every extension twice in a project that needs a trust decision,
// once to ask the extensions and once with the decision, so this start gets
// two trusted starts' budget.
const UNTRUSTED_START_TIMEOUT_MS = 2 * PROFILE_PI_START_TIMEOUT_MS;

// D-CF1-07: the profile Pi starts with no entry in Pi's trust store. With a pi
// settings file in the project, that alone makes Pi distrust the project.
Given(
  "pi runs with the scripted model in an untrusted project that holds skills",
  { timeout: UNTRUSTED_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({ companions: [], trust: "untrusted" });
    await assert.rejects(access(path.join(this.tokens.agentDir, "trust.json")), {
      code: "ENOENT",
    });
  },
);
