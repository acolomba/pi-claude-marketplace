/**
 * @fileoverview The per-scenario world.
 *
 * Every scenario gets a fresh world with its own sandbox: a HOME, a Pi agent
 * directory, a project directory, and a local marketplace, all under one
 * temporary root outside the repository. The `After()` hook removes the root,
 * so no scenario sees the state of another.
 */

import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { After, Before, setDefaultTimeout, setWorldConstructor, World } from "@cucumber/cucumber";

import type { CascadePayload } from "./pi-commands.ts";
import type { RpcSandbox } from "../../tests/e2e/_rpc.ts";

// Each command starts a fresh Pi process, which takes about a second.
setDefaultTimeout(30_000);

export class PluginWorld extends World {
  root = "";
  sandbox: RpcSandbox = { home: "", agentDir: "", cwd: "" };
  marketplacesRoot = "";
  result: CascadePayload | undefined = undefined;

  /** Returns the result of the last command, which a `When` step must have run. */
  lastResult(): CascadePayload {
    if (this.result === undefined) {
      throw new Error("no command has run in this scenario");
    }

    return this.result;
  }
}

setWorldConstructor(PluginWorld);

Before(async function (this: PluginWorld) {
  this.root = await mkdtemp(path.join(tmpdir(), "pi-cm-features-"));
  this.sandbox = {
    home: path.join(this.root, "home"),
    agentDir: path.join(this.root, "agent"),
    cwd: path.join(this.root, "project"),
  };
  this.marketplacesRoot = path.join(this.root, "marketplaces");
  const { home, agentDir, cwd } = this.sandbox;
  await Promise.all([home, agentDir, cwd].map((location) => mkdir(location, { recursive: true })));
});

After(async function (this: PluginWorld) {
  await rm(this.root, { recursive: true, force: true });
});
