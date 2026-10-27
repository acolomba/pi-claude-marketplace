/**
 * @fileoverview The loopback stand-in for the npm registry that plugin package
 * installs reach.
 *
 * A scenario starts its own registry on `127.0.0.1`. The registry builds a
 * deterministic tarball for each package the scenario serves and answers it
 * at the path npm asks for, `/<name>/-/<name>-<version>.tgz`. It logs every
 * request with the status it answered, and it can be armed to answer an
 * error status for one package. Every other path answers 404. The sandbox npm
 * config that points npm at the registry, and the package files a plugin
 * ships, are built here too, so the lockfile names the URL and integrity of
 * the tarball the registry serves. This module registers nothing.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";

import { requireColumns } from "./path-marketplace.ts";

import type { DataTable } from "@cucumber/cucumber";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

/** A package of the npm registry: its name and its exact version. */
export interface NpmPackage {
  readonly name: string;
  readonly version: string;
}

/** A tarball the registry serves: its package, its path, its URL, and its integrity. */
export interface ServedTarball extends NpmPackage {
  readonly path: string;
  readonly resolved: string;
  readonly integrity: string;
}

/** One request the registry received, with the status it answered. */
export interface NpmRegistryRequest {
  readonly method: string;
  readonly path: string;
  readonly status: number;
}

const ARMED_STATUSES = [404, 500] as const;

type ArmedStatus = (typeof ARMED_STATUSES)[number];

const PACKAGE_NAME = /^[a-z0-9-]+$/u;

const PACKAGE_VERSION = /^\d+\.\d+\.\d+$/u;

const TAR_BLOCK = 512;

/** Returns the ustar header of a regular file `name` of `size` bytes. */
function tarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(TAR_BLOCK);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, "ascii");
  header.write("0000000\0", 108, "ascii");
  header.write("0000000\0", 116, "ascii");
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124, "ascii");
  header.write("00000000000\0", 136, "ascii");
  // The checksum field counts as eight spaces while the bytes are summed.
  header.write("        ", 148, "ascii");
  header.write("0", 156, "ascii");
  header.write("ustar\0", 257, "ascii");
  header.write("00", 263, "ascii");
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
  return header;
}

/** Returns one tar entry: the header, then `text` padded to a whole block. */
function tarEntry(name: string, text: string): Buffer {
  const body = Buffer.from(text, "utf8");
  const padding = Buffer.alloc((TAR_BLOCK - (body.length % TAR_BLOCK)) % TAR_BLOCK);
  return Buffer.concat([tarHeader(name, body.length), body, padding]);
}

/**
 * Returns the gzipped tarball of `pkg`: a `package.json` and an `index.js`
 * that exports `<name> <version>`, so a plugin that requires the package
 * shows which one it loaded.
 */
function packageTarball(pkg: NpmPackage): Buffer {
  const manifest = JSON.stringify({ name: pkg.name, version: pkg.version, main: "index.js" });
  const exported = JSON.stringify(`${pkg.name} ${pkg.version}`);
  const index = `module.exports = ${exported};\n`;
  return gzipSync(
    Buffer.concat([
      tarEntry("package/package.json", manifest),
      tarEntry("package/index.js", index),
      Buffer.alloc(TAR_BLOCK * 2),
    ]),
  );
}

/** The loopback npm registry of one scenario. */
export class NpmRegistry {
  /** The `127.0.0.1:<port>` address the registry listens on. */
  readonly address: string;
  private readonly server: Server;
  // The served tarballs and their bytes, by request path.
  private readonly tarballs = new Map<
    string,
    { readonly served: ServedTarball; readonly bytes: Buffer }
  >();
  // The status each armed package answers, by package name.
  private readonly arms = new Map<string, ArmedStatus>();
  private readonly log: NpmRegistryRequest[] = [];

  private constructor(server: Server, address: string) {
    this.server = server;
    this.address = address;
    server.on("request", (request: IncomingMessage, response: ServerResponse) => {
      this.answer(request, response);
    });
  }

  /** Starts a registry on a free port of `127.0.0.1`. */
  static async start(): Promise<NpmRegistry> {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
      server.close();
      throw new Error("the npm registry has no TCP address");
    }

    return new NpmRegistry(server, `127.0.0.1:${address.port}`);
  }

  /** Serves the tarball of `pkg`, building it the first time, and returns it. */
  serve(pkg: NpmPackage): ServedTarball {
    const tarballPath = `/${pkg.name}/-/${pkg.name}-${pkg.version}.tgz`;
    const existing = this.tarballs.get(tarballPath);
    if (existing !== undefined) {
      return existing.served;
    }

    const bytes = packageTarball(pkg);
    const served: ServedTarball = {
      name: pkg.name,
      version: pkg.version,
      path: tarballPath,
      resolved: `http://${this.address}${tarballPath}`,
      integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    };
    this.tarballs.set(tarballPath, { served, bytes });
    return served;
  }

  /** Returns the tarball of `pkg`, failing when the scenario never served it. */
  served(pkg: NpmPackage): ServedTarball {
    const served = [...this.tarballs.values()].find(
      (tarball) => tarball.served.name === pkg.name && tarball.served.version === pkg.version,
    );
    if (served === undefined) {
      assert.fail(`the npm registry does not serve ${pkg.name} ${pkg.version}`);
    }

    return served.served;
  }

  /**
   * Makes every tarball request for the package `name`, which the registry
   * must serve, answer `status`, 404 or 500.
   */
  arm(name: string, status: number): void {
    const armed = ARMED_STATUSES.find((candidate) => candidate === status);
    if (armed === undefined) {
      throw new Error(
        `the npm registry cannot be armed to answer ${status}; expected one of ${ARMED_STATUSES.join(", ")}`,
      );
    }

    if (![...this.tarballs.values()].some((tarball) => tarball.served.name === name)) {
      assert.fail(`the npm registry serves no package ${name}`);
    }

    this.arms.set(name, armed);
  }

  /** Returns the length of the request log, which opens a window for `requestsSince()`. */
  mark(): number {
    return this.log.length;
  }

  /** Returns every request since the window `mark` opened. */
  requestsSince(mark: number): readonly NpmRegistryRequest[] {
    return this.log.slice(mark).map((request) => ({ ...request }));
  }

  /** Closes every connection, which npm keeps alive, and stops listening. */
  async close(): Promise<void> {
    const closed = once(this.server, "close");
    this.server.closeAllConnections();
    this.server.close();
    await closed;
  }

  private answer(request: IncomingMessage, response: ServerResponse): void {
    const method = request.method ?? "";
    const requestPath = request.url ?? "";
    const tarball = method === "GET" ? this.tarballs.get(requestPath) : undefined;
    const status = tarball === undefined ? 404 : (this.arms.get(tarball.served.name) ?? 200);
    this.log.push({ method, path: requestPath, status });
    request.resume();
    if (tarball === undefined || status !== 200) {
      response.writeHead(status, { "content-type": "text/plain" });
      response.end(`${status}\n`);
      return;
    }

    response.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": tarball.bytes.length,
    });
    response.end(tarball.bytes);
  }
}

/**
 * Reads a `| name | version |` table of npm packages, throwing on a missing
 * or unknown column, a name outside `[a-z0-9-]`, or a version that is not
 * three dot-separated numbers.
 */
export function readNpmPackages(table: DataTable): NpmPackage[] {
  requireColumns(table, ["name", "version"]);
  return table.hashes().map((row) => {
    const name = String(row.name);
    const version = String(row.version);
    if (!PACKAGE_NAME.test(name)) {
      throw new Error(`${name} is not an npm package name of [a-z0-9-]`);
    }

    if (!PACKAGE_VERSION.test(version)) {
      throw new Error(`${version} is not an exact major.minor.patch version`);
    }

    return { name, version };
  });
}

/** Returns `requests` as the string rows of a `| method | path | status |` table, header first. */
export function npmRequestTable(requests: readonly NpmRegistryRequest[]): string[][] {
  return [
    ["method", "path", "status"],
    ...requests.map(({ method, path, status }) => [method, path, String(status)]),
  ];
}

/**
 * Returns the sandbox `.npmrc` text that points npm at `registry`. npm keeps
 * quiet, so a failed install prints nothing that names the registry's port,
 * writes no log file, retries nothing, and never looks for its own update.
 */
export function npmConfigText(registry: NpmRegistry): string {
  return [
    `registry=http://${registry.address}/`,
    "update-notifier=false",
    "fetch-retries=0",
    "logs-max=0",
    "loglevel=silent",
    "",
  ].join("\n");
}

/**
 * Returns the `package.json` and `package-lock.json` texts of the plugin
 * `plugin` by file name. The plugin depends on each of `tarballs` at its
 * exact version, and the lockfile names the URL and integrity of each tarball
 * the registry serves.
 */
export function pluginPackageFiles(
  plugin: string,
  tarballs: readonly ServedTarball[],
): Readonly<Record<string, string>> {
  const dependencies = Object.fromEntries(
    tarballs.map((tarball) => [tarball.name, tarball.version]),
  );
  const lockedPackages = Object.fromEntries(
    tarballs.map((tarball) => [
      `node_modules/${tarball.name}`,
      { version: tarball.version, resolved: tarball.resolved, integrity: tarball.integrity },
    ]),
  );
  const manifest = { name: plugin, version: "0.0.0", dependencies };
  const lockfile = {
    name: plugin,
    version: "0.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: { "": manifest, ...lockedPackages },
  };
  return {
    "package.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "package-lock.json": `${JSON.stringify(lockfile, null, 2)}\n`,
  };
}
